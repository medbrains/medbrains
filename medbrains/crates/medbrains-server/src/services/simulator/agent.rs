//! LLM-driven simulator engine.
//!
//! Fans out Claude agents across a factor matrix (role × department × locale ×
//! goal × fleet). Each agent logs in as that role's seeded demo user and drives
//! the LIVE public API — the same endpoints a real user hits — so it exercises
//! the real auth + route + permission stack. The loop is host-controlled: each
//! turn `llm::extract` returns the next `AgentDecision` from the world-state we
//! feed it, the host executes it as one authenticated HTTP call, maps
//! failures/permission-denials/agent-reported confusion to `FindingRecord`s, and
//! feeds the result back. Reusing the proven `extract` helper avoids a bespoke
//! tool-calling loop; the ceiling is one model round-trip per action.
//!
//! Scope (MVP): single generation, one cell run each. The self-improving loop
//! (re-weight → prime → promote across generations) is Phase 2.

use rand::SeedableRng;
use rand::rngs::StdRng;
use rand::seq::IndexedRandom;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_core::simulator::{AgentProfile, RunSummary};
use medbrains_server_core::state::AppState;
use medbrains_server_services::llm;

use super::agent_tools::{HttpOutcome, SimClient, catalog_text, find_tool, render_path, truncate};
use super::sweep_endpoints::SWEEP_ENDPOINTS;
use super::{StepRecord, verifier};
use crate::error::AppError;
use crate::middleware::auth::Claims;

const STEP_BUDGET: u32 = 20;
const MAX_CELLS: usize = 25;
const MAX_FLEET: u32 = 10;
const MAX_GENERATIONS: u32 = 5;
const DEFAULT_BASE: &str = "http://127.0.0.1:3000";
const DEFAULT_GOAL: &str = "Register a walk-in patient with a fever and route them to a doctor.";

/// One action the model chose for this turn.
#[derive(Debug, Deserialize, Serialize, schemars::JsonSchema)]
struct AgentDecision {
    /// Short rationale in the persona's voice.
    reasoning: String,
    /// Tool name to call, or "done" / "give_up".
    tool: String,
    /// Path params, e.g. {"encounter_id": "..."}.
    #[serde(default)]
    path_params: Value,
    /// JSON body for POST tools.
    #[serde(default)]
    body: Value,
    /// True when the goal is met or clearly impossible.
    #[serde(default)]
    done: bool,
    /// Optional finding the agent wants recorded this turn.
    #[serde(default)]
    finding: Option<DecisionFinding>,
}

#[derive(Debug, Deserialize, Serialize, schemars::JsonSchema)]
struct DecisionFinding {
    kind: String,
    severity: String,
    message: String,
}

/// A finding to persist (`simulator_run_findings`).
#[derive(Debug)]
pub struct FindingRecord {
    pub cell: Value,
    pub kind: String,
    pub severity: String,
    pub message: String,
    /// unverified | confirmed | plausible | rejected (set by the verifier).
    pub verdict: String,
    pub step_ref: Option<Uuid>,
}

/// One factor cell — the fixed identity an agent runs under.
struct Cell {
    role: String,
    department: Option<Uuid>,
    locale: String,
    goal: String,
    chaos: f32,
}

struct CellCtx<'a> {
    state: &'a AppState,
    tenant_id: Uuid,
    base: &'a str,
    /// Prior-generation findings summary, injected into each preamble so later
    /// generations probe known-weak areas instead of re-covering solved ground.
    context: &'a str,
}

struct RunAcc {
    steps: Vec<StepRecord>,
    findings: Vec<FindingRecord>,
    summary: RunSummary,
}

/// Entry point (manual / cron): run the full factor cross-product, optionally
/// across multiple self-improving generations. Each generation is primed with
/// the deduped findings of the prior ones; the loop stops early once a
/// generation surfaces nothing new (converged), bounded by `generations_cap`.
pub async fn run_agent(
    state: &AppState,
    claims: &Claims,
    profile: &AgentProfile,
) -> (RunSummary, Vec<StepRecord>, Vec<FindingRecord>) {
    if profile.roles.is_empty() {
        return empty_with_finding("Agent run has no roles configured — nothing to fan out.");
    }
    let generations = profile.generations_cap.clamp(1, MAX_GENERATIONS);
    let mut all_steps: Vec<StepRecord> = Vec::new();
    let mut all_findings: Vec<FindingRecord> = Vec::new();
    let mut seen: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();

    for generation in 1..=generations {
        let context = prime_context(&all_findings);
        let (cells, truncated) = build_cells(profile);
        // Sweep is exhaustive + role-keyed — run it once, on generation 1 only.
        let sweep_roles: &[String] = if profile.sweep && generation == 1 {
            &profile.roles
        } else {
            &[]
        };
        let (_, steps, findings) =
            drive(state, claims, cells, truncated, profile.verify, sweep_roles, &context).await;
        all_steps.extend(steps);
        let mut new_findings = 0u32;
        for f in findings {
            if seen.insert(finding_key(&f)) {
                new_findings += 1;
                all_findings.push(f);
            }
        }
        // Converged: a generation found nothing new.
        if generation > 1 && new_findings == 0 {
            break;
        }
    }

    let mut summary = RunSummary::default();
    for step in &all_steps {
        bump_summary(&mut summary, step.step_type, step.success);
    }
    (summary, all_steps, all_findings)
}

/// Summarise prior findings to prime the next generation's agents.
fn prime_context(findings: &[FindingRecord]) -> String {
    if findings.is_empty() {
        return String::new();
    }
    let lines: Vec<String> = findings
        .iter()
        .take(15)
        .map(|f| {
            let role = f.cell.get("role").and_then(Value::as_str).unwrap_or("?");
            format!("- [{role}] {}: {}", f.kind, truncate(&f.message, 160))
        })
        .collect();
    format!(
        "\n\nPRIOR FINDINGS from earlier test passes (do NOT just re-report these — probe deeper, \
         try adjacent flows, or confirm whether they still occur):\n{}",
        lines.join("\n")
    )
}

/// Dedup key for a finding across generations (role + kind + message).
fn finding_key(f: &FindingRecord) -> String {
    let role = f.cell.get("role").and_then(Value::as_str).unwrap_or("");
    format!("{role}|{}|{}", f.kind, f.message)
}

/// Entry point (census pacer): run exactly `count` randomly-sampled cells this
/// tick, drawn from the profile's factor pool.
pub async fn run_agent_sampled(
    state: &AppState,
    claims: &Claims,
    profile: &AgentProfile,
    count: u32,
) -> (RunSummary, Vec<StepRecord>, Vec<FindingRecord>) {
    if profile.roles.is_empty() {
        return empty_with_finding("Census pacer has no roles configured — nothing to run.");
    }
    let mut rng = StdRng::from_os_rng();
    let cells = sampled_cells(profile, count, &mut rng);
    // Census pacing fires every tick — never run the full endpoint sweep here,
    // or a single day would issue 310×roles GETs per 30s. Sweep is manual/cron only.
    // Single generation per tick (the pacer's continuous running is its own loop).
    drive(state, claims, cells, false, profile.verify, &[], "").await
}

/// Run a fixed set of cells and collect what to persist.
async fn drive(
    state: &AppState,
    claims: &Claims,
    cells: Vec<Cell>,
    truncated: bool,
    verify: bool,
    sweep_roles: &[String],
    context: &str,
) -> (RunSummary, Vec<StepRecord>, Vec<FindingRecord>) {
    let base = std::env::var("MEDBRAINS_API_BASE").unwrap_or_else(|_| DEFAULT_BASE.to_owned());
    let mut acc = RunAcc {
        steps: Vec::new(),
        findings: Vec::new(),
        summary: RunSummary::default(),
    };
    if truncated {
        acc.findings.push(confirmed(finding(
            &json!({}),
            "workflow",
            "info",
            format!("Factor matrix capped at {MAX_CELLS} cells this run; narrow the factors."),
            None,
        )));
    }
    let ctx = CellCtx {
        state,
        tenant_id: claims.tenant_id,
        base: &base,
        context,
    };
    for cell in &cells {
        run_cell(&ctx, cell, &mut acc).await;
    }
    if verify {
        verify_findings(state, &claims.tenant_id, &mut acc.findings).await;
    }
    if !sweep_roles.is_empty() {
        let mut roles = sweep_roles.to_vec();
        roles.sort();
        roles.dedup();
        run_sweep(state, &claims.tenant_id, &base, &roles, &mut acc).await;
    }
    observe(&cells, &acc);
    (acc.summary, acc.steps, acc.findings)
}

/// Coverage sweep: per role, GET every read-only list endpoint across ALL
/// modules and flag 5xx server errors. 403/401 are correct auth outcomes and
/// are ignored; only genuine server failures become findings. No LLM cost.
async fn run_sweep(
    state: &AppState,
    tenant_id: &Uuid,
    base: &str,
    roles: &[String],
    acc: &mut RunAcc,
) {
    for role in roles {
        let Ok(Some(username)) = find_demo_username(state, tenant_id, role).await else {
            continue;
        };
        let password = if role == "doctor" {
            "doctor123"
        } else {
            "test123"
        };
        let Ok(client) = SimClient::login(base, &username, password).await else {
            continue;
        };
        let cell = json!({ "role": role, "phase": "sweep" });
        let mut swept = 0usize;
        for endpoint in SWEEP_ENDPOINTS {
            let outcome = client.call("GET", endpoint, &Value::Null).await;
            swept += 1;
            if outcome.status >= 500 || outcome.status == 0 {
                let severity = if outcome.status == 0 { "high" } else { "critical" };
                acc.findings.push(confirmed(finding(
                    &cell,
                    "error",
                    severity,
                    format!("GET {endpoint} → HTTP {} (server error) as {role}", outcome.status),
                    None,
                )));
                acc.summary.errors += 1;
            }
        }
        tracing::info!(role = %role, swept, "simulator endpoint sweep complete");
    }
}

fn empty_with_finding(msg: &str) -> (RunSummary, Vec<StepRecord>, Vec<FindingRecord>) {
    (
        RunSummary::default(),
        Vec::new(),
        vec![confirmed(finding(&json!({}), "workflow", "medium", msg, None))],
    )
}

/// Adversarially verify subjective (unverified) findings, mutating their verdict.
async fn verify_findings(state: &AppState, tenant_id: &Uuid, findings: &mut [FindingRecord]) {
    for f in findings.iter_mut() {
        if f.verdict != "unverified" {
            continue;
        }
        f.verdict = verifier::verify(state, tenant_id, &f.kind, &f.message, &f.cell).await;
    }
}

/// Emit observability: a run summary line + one warn per confirmed finding, plus
/// tool coverage (distinct endpoints exercised).
fn observe(cells: &[Cell], acc: &RunAcc) {
    let tools: std::collections::BTreeSet<&str> = acc.steps.iter().map(|s| s.step_type).collect();
    let confirmed_count = acc
        .findings
        .iter()
        .filter(|f| f.verdict == "confirmed")
        .count();
    tracing::info!(
        cells = cells.len(),
        steps = acc.steps.len(),
        findings = acc.findings.len(),
        confirmed = confirmed_count,
        tools_exercised = tools.len(),
        errors = acc.summary.errors,
        "simulator agent run complete"
    );
    for f in acc.findings.iter().filter(|f| f.verdict == "confirmed") {
        tracing::warn!(kind = %f.kind, severity = %f.severity, message = %f.message, "simulator confirmed finding");
    }
}

/// Cross-product the factors into cells, capped and clamped.
fn build_cells(profile: &AgentProfile) -> (Vec<Cell>, bool) {
    let locales = if profile.locales.is_empty() {
        vec!["en".to_owned()]
    } else {
        profile.locales.clone()
    };
    let goals = if profile.goals.is_empty() {
        vec![DEFAULT_GOAL.to_owned()]
    } else {
        profile.goals.clone()
    };
    let departments: Vec<Option<Uuid>> = if profile.departments.is_empty() {
        vec![None]
    } else {
        profile.departments.iter().map(|d| Some(*d)).collect()
    };
    let fleet = profile.fleet_size.clamp(1, MAX_FLEET);
    let chaos = profile.chaos.clamp(0.0, 1.0);

    let mut cells = Vec::new();
    let mut truncated = false;
    'outer: for role in &profile.roles {
        for dept in &departments {
            for locale in &locales {
                for goal in &goals {
                    for _ in 0..fleet {
                        if cells.len() >= MAX_CELLS {
                            truncated = true;
                            break 'outer;
                        }
                        cells.push(Cell {
                            role: role.clone(),
                            department: *dept,
                            locale: locale.clone(),
                            goal: goal.clone(),
                            chaos,
                        });
                    }
                }
            }
        }
    }
    (cells, truncated)
}

/// Draw `count` random cells from the factor pool — one per expected patient,
/// used by the census pacer. Capped at `MAX_CELLS` as a per-tick runaway guard.
fn sampled_cells(profile: &AgentProfile, count: u32, rng: &mut StdRng) -> Vec<Cell> {
    let locales = if profile.locales.is_empty() {
        vec!["en".to_owned()]
    } else {
        profile.locales.clone()
    };
    let goals = if profile.goals.is_empty() {
        vec![DEFAULT_GOAL.to_owned()]
    } else {
        profile.goals.clone()
    };
    let departments: Vec<Option<Uuid>> = if profile.departments.is_empty() {
        vec![None]
    } else {
        profile.departments.iter().map(|d| Some(*d)).collect()
    };
    let chaos = profile.chaos.clamp(0.0, 1.0);
    let wanted = (count as usize).min(MAX_CELLS);
    let mut cells = Vec::with_capacity(wanted);
    for _ in 0..wanted {
        let (Some(role), Some(dept), Some(locale), Some(goal)) = (
            profile.roles.choose(rng),
            departments.choose(rng),
            locales.choose(rng),
            goals.choose(rng),
        ) else {
            break;
        };
        cells.push(Cell {
            role: role.clone(),
            department: *dept,
            locale: locale.clone(),
            goal: goal.clone(),
            chaos,
        });
    }
    cells
}

/// Log in as the cell's role and run the decision loop.
async fn run_cell(ctx: &CellCtx<'_>, cell: &Cell, acc: &mut RunAcc) {
    let cell_json = cell_json(cell);

    let username = match find_demo_username(ctx.state, &ctx.tenant_id, &cell.role).await {
        Ok(Some(u)) => u,
        Ok(None) => {
            acc.findings.push(confirmed(finding(
                &cell_json,
                "workflow",
                "high",
                format!(
                    "No demo user seeded for role '{}' — cannot exercise it. Seed demo data (MEDBRAINS_SEED_DEMO_DATA=true).",
                    cell.role
                ),
                None,
            )));
            return;
        }
        Err(err) => {
            acc.findings.push(confirmed(finding(
                &cell_json,
                "error",
                "medium",
                format!("Demo-user lookup for role '{}' failed: {err}", cell.role),
                None,
            )));
            return;
        }
    };

    let password = if cell.role == "doctor" {
        "doctor123"
    } else {
        "test123"
    };
    let client = match SimClient::login(ctx.base, &username, password).await {
        Ok(c) => c,
        Err(err) => {
            acc.findings.push(confirmed(finding(
                &cell_json,
                "error",
                "high",
                format!("Login as {username} (role {}) failed: {err}", cell.role),
                None,
            )));
            return;
        }
    };

    let preamble = build_preamble(cell, ctx.context);
    let mut history: Vec<Value> = Vec::new();
    let mut turn = 0u32;
    while turn < STEP_BUDGET {
        turn += 1;
        let prompt = json!({
            "goal": cell.goal,
            "recent_actions": history,
            "instruction": "Choose the next tool. Discover ids with list_* before creating. \
                Set done=true when the goal is met or clearly impossible. Attach a finding whenever \
                something is confusing, blocked, permission-denied, untranslated, or wrong."
        })
        .to_string();

        let decision: AgentDecision =
            match llm::extract(ctx.state, &ctx.tenant_id, &preamble, &prompt).await {
                Ok(d) => d,
                Err(err) => {
                    acc.findings.push(confirmed(finding(
                        &cell_json,
                        "error",
                        "medium",
                        format!("Agent decision call failed: {err}"),
                        None,
                    )));
                    break;
                }
            };

        if let Some(f) = &decision.finding {
            acc.findings.push(finding(
                &cell_json,
                sanitize_kind(&f.kind),
                sanitize_severity(&f.severity),
                f.message.clone(),
                None,
            ));
        }
        if decision.done || decision.tool == "done" || decision.tool == "give_up" {
            break;
        }

        let Some(spec) = find_tool(&decision.tool) else {
            acc.findings.push(finding(
                &cell_json,
                "discovery",
                "low",
                format!("Agent tried an unknown tool '{}'.", decision.tool),
                None,
            ));
            history.push(json!({ "tool": decision.tool, "error": "unknown tool" }));
            continue;
        };

        let mut body = decision.body.clone();
        if spec.method == "POST" {
            inject_dummy(&mut body);
        }
        let path = render_path(spec.path, &decision.path_params);
        let outcome = client.call(spec.method, &path, &body).await;
        record_outcome(acc, &cell_json, spec.name, &outcome);
        history.push(json!({
            "tool": spec.name,
            "status": outcome.status,
            "ok": outcome.success,
            "result": truncate(&outcome.body, 250)
        }));
        if history.len() > 8 {
            history.remove(0);
        }
    }
}

/// Record a tool call as a step + summary bump + auto-finding on failure.
fn record_outcome(acc: &mut RunAcc, cell_json: &Value, tool: &'static str, outcome: &HttpOutcome) {
    acc.steps.push(StepRecord {
        step_type: tool,
        target_id: outcome.target_id,
        success: outcome.success,
        error: if outcome.success {
            None
        } else {
            Some(truncate(&outcome.body, 400))
        },
    });
    bump_summary(&mut acc.summary, tool, outcome.success);
    if !outcome.success {
        let (kind, severity) = categorize(outcome.status);
        acc.findings.push(confirmed(finding(
            cell_json,
            kind,
            severity,
            format!(
                "{tool} → HTTP {}: {}",
                outcome.status,
                truncate(&outcome.body, 300)
            ),
            outcome.target_id,
        )));
    }
}

fn build_preamble(cell: &Cell, context: &str) -> String {
    let chaos_note = if cell.chaos > 0.0 {
        format!(
            " About {:.0}% of the time, act like a hurried/distracted user who makes plausible \
             mistakes (wrong field, skipped step) — this surfaces error paths.",
            cell.chaos * 100.0
        )
    } else {
        String::new()
    };
    let base = format!(
        "You are a synthetic hospital user for end-to-end testing.\n\
         Role: {role}. Locale: {locale}. You are logged in as this role and may act ONLY within its permissions.\n\
         Goal: {goal}.{chaos_note}\n\n\
         Tools (call ONE per turn):\n{catalog}\n\n\
         Put path ids in path_params and the JSON payload in body; the host adds is_dummy automatically. \
         Discover ids with the list_* tools before creating. Set done=true when the goal is achieved or \
         clearly impossible. Whenever something blocks you, is confusing, is untranslated for your locale, \
         or denies a permission you did not expect, attach a finding \
         (kind: usability|permission|locale|error|workflow|discovery).",
        role = cell.role,
        locale = cell.locale,
        goal = cell.goal,
        catalog = catalog_text(),
    );
    format!("{base}{context}")
}

fn bump_summary(summary: &mut RunSummary, tool: &str, ok: bool) {
    if !ok {
        summary.errors += 1;
        return;
    }
    match tool {
        "create_opd_encounter" => summary.opd_count += 1,
        "add_vitals" => summary.vitals_count += 1,
        "add_diagnosis" => summary.diagnoses_count += 1,
        "add_prescription" => summary.prescription_count += 1,
        "order_lab" => summary.lab_count += 1,
        "order_radiology" => summary.radiology_count += 1,
        "pharmacy_sale" => summary.pharmacy_count += 1,
        "admit_ipd" => summary.ipd_admission_count += 1,
        "create_er_visit" => summary.er_count += 1,
        "triage_er" => summary.triage_count += 1,
        "admit_er" => summary.er_admit_count += 1,
        _ => {}
    }
}

fn inject_dummy(body: &mut Value) {
    match body {
        Value::Object(map) => {
            map.insert("is_dummy".to_owned(), Value::Bool(true));
        }
        _ => *body = json!({ "is_dummy": true }),
    }
}

fn cell_json(cell: &Cell) -> Value {
    json!({
        "role": cell.role,
        "department": cell.department,
        "locale": cell.locale,
        "goal": cell.goal,
    })
}

fn finding(
    cell: &Value,
    kind: &str,
    severity: &str,
    message: impl Into<String>,
    step_ref: Option<Uuid>,
) -> FindingRecord {
    FindingRecord {
        cell: cell.clone(),
        kind: kind.to_owned(),
        severity: severity.to_owned(),
        message: message.into(),
        verdict: "unverified".to_owned(),
        step_ref,
    }
}

/// Mark a finding as objectively true (HTTP failure, missing demo user, …) so
/// the verifier skips it — only subjective, agent-reported findings need review.
fn confirmed(mut f: FindingRecord) -> FindingRecord {
    f.verdict = "confirmed".to_owned();
    f
}

/// Map an HTTP status to a finding (kind, severity). 5xx = server bug, 422/409 =
/// business-logic reject, 403 = permission, 404 = dead-end.
fn categorize(status: u16) -> (&'static str, &'static str) {
    match status {
        0 => ("error", "high"),
        403 => ("permission", "high"),
        404 => ("workflow", "medium"),
        409 | 422 => ("logic", "medium"),
        s if s >= 500 => ("error", "critical"),
        s if s >= 400 => ("error", "medium"),
        _ => ("error", "low"),
    }
}

/// Clamp an LLM-supplied kind to the DB CHECK set (default `workflow`).
fn sanitize_kind(kind: &str) -> &'static str {
    match kind {
        "usability" => "usability",
        "permission" => "permission",
        "locale" => "locale",
        "error" => "error",
        "discovery" => "discovery",
        "logic" => "logic",
        _ => "workflow",
    }
}

/// Clamp an LLM-supplied severity to the DB CHECK set (default `info`).
fn sanitize_severity(severity: &str) -> &'static str {
    match severity {
        "low" => "low",
        "medium" => "medium",
        "high" => "high",
        "critical" => "critical",
        _ => "info",
    }
}

async fn find_demo_username(
    state: &AppState,
    tenant_id: &Uuid,
    role: &str,
) -> Result<Option<String>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, tenant_id).await?;
    let username = sqlx::query_scalar::<_, String>(
        "SELECT username FROM users \
         WHERE role = $1 AND email LIKE '%@medbrains.localhost' \
         ORDER BY created_at LIMIT 1",
    )
    .bind(role)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(username)
}

/// Persist agent findings for a run (parallels `persist_steps`).
pub async fn persist_findings(
    pool: &PgPool,
    tenant_id: Uuid,
    run_id: Uuid,
    findings: &[FindingRecord],
) -> Result<(), AppError> {
    if findings.is_empty() {
        return Ok(());
    }
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    for f in findings {
        sqlx::query(
            "INSERT INTO simulator_run_findings \
             (tenant_id, run_id, cell, kind, severity, message, verdict, step_ref) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(tenant_id)
        .bind(run_id)
        .bind(&f.cell)
        .bind(&f.kind)
        .bind(&f.severity)
        .bind(&f.message)
        .bind(&f.verdict)
        .bind(f.step_ref)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{categorize, sanitize_kind, sanitize_severity};

    #[test]
    fn categorize_by_status() {
        assert_eq!(categorize(500), ("error", "critical"));
        assert_eq!(categorize(503), ("error", "critical"));
        assert_eq!(categorize(403), ("permission", "high"));
        assert_eq!(categorize(422), ("logic", "medium"));
        assert_eq!(categorize(409), ("logic", "medium"));
        assert_eq!(categorize(404), ("workflow", "medium"));
        assert_eq!(categorize(0), ("error", "high"));
    }

    #[test]
    fn sanitize_kind_clamps() {
        assert_eq!(sanitize_kind("logic"), "logic");
        assert_eq!(sanitize_kind("permission"), "permission");
        assert_eq!(sanitize_kind("nonsense"), "workflow");
    }

    #[test]
    fn sanitize_severity_defaults_info() {
        assert_eq!(sanitize_severity("critical"), "critical");
        assert_eq!(sanitize_severity("weird"), "info");
    }
}

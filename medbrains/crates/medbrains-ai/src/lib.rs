//! Shared LLM access for the AI-assisted routes (custom-code generation,
//! LMS course generation).
//!
//! Resolves the AI provider per tenant from `tenant_settings`
//! (category `ai`, key `config` → `{ provider, model, api_key_secret }`),
//! through `medbrains_server_services::llm`. Anthropic has no API key: it is
//! reached by workload identity federation with the machine's AWS identity.

use axum::response::IntoResponse as _;
use axum::routing::{get, post};
use axum::{
    Extension, Json,
    extract::{Path, State},
    response::sse::{Event, KeepAlive, Sse},
};
use futures::Stream;
use serde::{Deserialize, Serialize};
use tower::ServiceExt as _;
use uuid::Uuid;

use medbrains_core::ai_drug_check::DrugCheck;
use medbrains_core::ai_redact::Redacted;
use medbrains_core::permissions;

mod catalog;
mod contact_access;
mod dates;
mod redaction;
mod show;
mod turn;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::{error::AppError, state::AppState};
pub use redaction::session_for;

/// The finalized app router, stashed by `main` after construction, so read tools
/// can dispatch requests in-process (reusing auth/RLS/permission/audit). Set once.
pub static AI_ROUTER: std::sync::OnceLock<axum::Router> = std::sync::OnceLock::new();

/// GET-only path prefixes the `call_api` read tool may reach. Second line of
/// defence — the real per-route `require_permission` is the primary one, so the
/// model only ever reads what the caller's own permissions allow. Excludes
/// auth/admin/setup/security/integration/audit (sensitive config) and print-data.
const CALL_API_ALLOWLIST: &[&str] = &[
    // Clinical
    "/api/patients/",
    "/api/opd/",
    "/api/lab/",
    "/api/pharmacy/",
    "/api/ipd/",
    "/api/radiology/",
    "/api/blood-bank/",
    "/api/emergency/",
    "/api/nurse/",
    "/api/ot/",
    "/api/chronic-care/",
    "/api/cds/",
    "/api/order-sets/",
    "/api/infection-control/",
    "/api/bedside/",
    "/api/diet/",
    "/api/mrd/",
    "/api/documents/",
    "/api/specialty/",
    // Operational / non-clinical
    "/api/billing/",
    "/api/insurance/",
    "/api/payments/",
    "/api/indent/",
    "/api/procurement/",
    "/api/hr/",
    "/api/scheduling/",
    "/api/quality/",
    "/api/front-office/",
    "/api/facilities/",
    "/api/housekeeping/",
    "/api/camp/",
    "/api/communications/",
    "/api/command-center/",
    "/api/regulatory/",
    "/api/lms/",
];

/// Shared LLM access layer (provider resolution + structured extraction) now
/// lives in `medbrains-server-services` so leaf domain crates (custom-code, LMS)
/// can reach it without depending back on `medbrains-server`. Re-exported here so
/// the server-services LLM extract helper and the in-file chat routes keep resolving.
pub use medbrains_server_services::llm::{AiConfig, extract, resolve_config};

/// System preamble for the clinical assistant. Edit the prose in
/// `routes/ai_system_prompt.txt` (plain text — no Rust escaping).
const SYSTEM_PROMPT: &str = include_str!("ai_system_prompt.txt");

// ── Streaming chat (RFC-AI-CLINICAL-COPILOT Phase 1) ──────────────────
//
// `POST /api/ai/chat` streams the assistant reply over SSE, riding the normal
// auth/RLS/audit middleware (a WebSocket upgrade would bypass it). Persists both
// turns to `ai_conversations`/`ai_messages` so a thread survives reloads.
//
// Grounding: when the turn carries a `context.patient_id` and the caller passes
// the patient-viewer ReBAC, the patient's allergies + active medications + active
// problems are injected as de-identified clinical context (clinical facts only —
// never name/UHID/identifiers). Guarded tools + RAG over notes/KB + a general
// free-text redactor are later phases.

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub conversation_id: Option<Uuid>,
    pub message: String,
    #[serde(default)]
    pub context: Option<serde_json::Value>,
}

#[derive(sqlx::FromRow)]
struct HistoryRow {
    role: String,
    content: String,
}

/// De-identified clinical snapshot the overview tool returns — clinical facts
/// only (allergen / drug / diagnosis names, lab values), never patient name /
/// UHID / identifiers. Sent as JSON, so redaction withholds a restricted entry
/// (an HIV result) on its own instead of the whole overview.
#[derive(Default, Serialize)]
struct Grounding {
    #[serde(serialize_with = "none_recorded")]
    allergies: Vec<String>,
    #[serde(serialize_with = "none_recorded")]
    active_medications: Vec<String>,
    #[serde(serialize_with = "none_recorded")]
    active_problems: Vec<String>,
    /// Entries withheld from this viewer (mental-health content). Only the
    /// count reaches the model — the tombstone, never the content.
    restricted_entries_not_shown: usize,
    #[serde(serialize_with = "none_recorded")]
    recent_lab_results: Vec<LabEntry>,
}

/// An empty list says so in words: the model reports "none recorded" rather
/// than leaving the section out.
fn none_recorded<S: serde::Serializer, T: Serialize>(items: &[T], s: S) -> Result<S::Ok, S::Error> {
    if items.is_empty() {
        s.serialize_str("none recorded")
    } else {
        items.serialize(s)
    }
}

/// One lab result in the overview.
#[derive(sqlx::FromRow, Serialize)]
struct LabEntry {
    parameter: String,
    value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    unit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    flag: Option<String>,
}

/// Fetch a patient's allergies, active medications, and active problems, under
/// the caller's RLS. Caller must have already passed the patient-viewer `ReBAC`.
async fn fetch_patient_grounding(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    viewer: medbrains_authz_gate::mental_health::MentalHealthViewer,
) -> Result<Grounding, AppError> {
    let allergies = sqlx::query_scalar::<_, String>(
        "SELECT allergen_name FROM patient_allergies \
         WHERE patient_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    let active_medications = sqlx::query_scalar::<_, String>(
        "SELECT DISTINCT drug_name FROM medication_timeline_events \
         WHERE patient_id = $1 AND tenant_id = $2 \
         AND event_type IN ('started', 'resumed', 'dose_changed') \
         AND NOT EXISTS ( \
           SELECT 1 FROM medication_timeline_events mte2 \
           WHERE mte2.patient_id = medication_timeline_events.patient_id \
           AND mte2.drug_name = medication_timeline_events.drug_name \
           AND mte2.event_type IN ('discontinued', 'switched') \
           AND mte2.effective_date > medication_timeline_events.effective_date \
         ) ORDER BY drug_name LIMIT 30",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    // Mental-health problems this viewer may not see are counted, not named.
    let problems = sqlx::query_as::<_, (String, bool)>(
        "SELECT d.description, \
                public.mental_health_diagnosis_withheld(d.icd_system, d.icd_code, \
                    d.recorded_by, e.patient_id, $3, $4) \
         FROM diagnoses d \
         JOIN encounters e ON e.id = d.encounter_id \
         WHERE e.patient_id = $1 AND d.tenant_id = $2 AND d.resolved_date IS NULL \
           AND d.deleted_at IS NULL \
         ORDER BY d.created_at DESC LIMIT 15",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .bind(viewer.user_id)
    .bind(viewer.can_all)
    .fetch_all(&mut **tx)
    .await?;
    let restricted_entries_not_shown = problems.iter().filter(|(_, hidden)| *hidden).count();
    let active_problems = problems
        .into_iter()
        .filter_map(|(description, hidden)| (!hidden).then_some(description))
        .collect();

    let recent_lab_results = sqlx::query_as::<_, LabEntry>(
        "SELECT lr.parameter_name AS parameter, lr.value, lr.unit, lr.flag::text AS flag \
         FROM lab_results lr JOIN lab_orders lo ON lr.order_id = lo.id \
         WHERE lo.patient_id = $1 AND lr.tenant_id = $2 \
         ORDER BY lr.created_at DESC LIMIT 30",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    Ok(Grounding {
        allergies,
        active_medications,
        active_problems,
        restricted_entries_not_shown,
        recent_lab_results,
    })
}

/// One retrieved clinical-knowledge-base entry (grounding source).
#[derive(sqlx::FromRow, Clone)]
struct KbHit {
    term: String,
    snippet: Option<String>,
    source_name: String,
    source_url: Option<String>,
}

/// Full-text retrieval over the clinical knowledge base for the user's query.
/// RLS-scoped (tenant + global entries) via the caller's transaction context.
/// ponytail: on-the-fly `to_tsvector` scan; add a stored tsvector + GIN index
/// (and a pgvector semantic layer) when the corpus grows.
async fn retrieve_kb(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    query: &str,
) -> Result<Vec<KbHit>, AppError> {
    let hits = sqlx::query_as::<_, KbHit>(
        "SELECT term, coalesce(short_text, left(insert_text, 400)) AS snippet, \
                source_name, source_url \
         FROM clinical_corpus_entries \
         WHERE is_active \
           AND to_tsvector('english', coalesce(term,'') || ' ' || coalesce(short_text,'') \
                 || ' ' || coalesce(insert_text,'') || ' ' || array_to_string(aliases,' ')) \
               @@ websearch_to_tsquery('english', $1) \
         ORDER BY ts_rank( \
             to_tsvector('english', coalesce(term,'') || ' ' || coalesce(short_text,'') \
               || ' ' || coalesce(insert_text,'')), \
             websearch_to_tsquery('english', $1)) DESC \
         LIMIT 5",
    )
    .bind(query)
    .fetch_all(&mut **tx)
    .await?;
    Ok(hits)
}

/// Everything `open_turn` prepares for one assistant turn.
struct PreparedTurn {
    conversation_id: Uuid,
    /// As stored (redacted since migration 1212); redacted again before use.
    history: Vec<HistoryRow>,
    /// The patient the turn names (whether or not the caller may see them):
    /// their identifiers are redacted either way.
    patient_id: Option<Uuid>,
    grounded_patient: Option<Uuid>,
    kb_hits: Vec<KbHit>,
    /// The conversation's placeholder map, so placeholders stay stable.
    pseudonyms: Option<serde_json::Value>,
}

// ── Guarded clinical tool: drug safety check (RFC Phase 3) ────────────
// The assistant calls this before endorsing any medication; it runs the drug
// through the SAME pharmacy safety engine as the manual dispensing path
// (evaluate_medication_safety_in_tx — allergies + interactions), under the
// caller's RLS, and returns authoritative warnings the model is told to heed.
// Tool-layer regulation enforcement: same guard as the human workflow.

#[derive(serde::Deserialize)]
struct DrugSafetyArgs {
    drug: String,
}

struct DrugSafetyTool {
    /// Every result goes back to the model through this turn's redaction.
    session: redaction::Session,
    db: sqlx::PgPool,
    tenant_id: Uuid,
    department_ids: Vec<Uuid>,
    patient_id: Option<Uuid>,
    user_id: Uuid,
    /// The assistant run reading the chart, for the access trail.
    agent: serde_json::Value,
}

impl DrugSafetyTool {
    /// Run the pharmacy safety engine (allergies + interactions) for one drug,
    /// under the caller's RLS. Read-only.
    async fn evaluate(
        &self,
        drug: &str,
        patient_id: Uuid,
    ) -> Result<Vec<medbrains_pharmacy::MedicationSafetyWarning>, AppError> {
        // The engine reads the patient's allergies and medicines: that is a
        // chart read, and it is the assistant's, so it is on the trail as such.
        record_ai_read(
            &self.db,
            self.tenant_id,
            self.user_id,
            patient_id,
            &self.agent,
        )
        .await?;
        let mut tx = self.db.begin().await?;
        medbrains_db::pool::set_full_context(&mut tx, &self.tenant_id, &self.department_ids)
            .await?;
        let items = [medbrains_pharmacy::MedicationSafetyItem {
            catalog_item_id: None,
            drug_name: drug.to_owned(),
            quantity: 1,
        }];
        let warnings = medbrains_pharmacy::evaluate_medication_safety_in_tx(
            &mut tx,
            &self.tenant_id,
            &patient_id,
            &items,
        )
        .await?;
        drop(tx);
        Ok(warnings)
    }
}

impl rig::tool::Tool for DrugSafetyTool {
    const NAME: &'static str = "check_drug_safety";
    type Error = std::convert::Infallible;
    type Args = DrugSafetyArgs;
    type Output = Redacted;

    fn description(&self) -> String {
        "Check a drug the clinician intends to give against the current \
            patient's allergies and drug interactions using the pharmacy safety engine. Call \
            it whenever a clinician names a medication, and report its warnings exactly."
            .to_owned()
    }

    fn parameters(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "drug": {
                    "type": "string",
                    "description": "Proposed drug (generic or brand name)"
                }
            },
            "required": ["drug"]
        })
    }

    async fn call(
        &self,
        _context: &mut rig::tool::ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let out = match self.answer(args).await {
            Ok(out) => out,
            Err(never) => match never {},
        };
        Ok(redaction::for_model(
            &self.session,
            &serde_json::to_string(&out).unwrap_or_default(),
        ))
    }
}

impl DrugSafetyTool {
    /// The check's status is always stated (`checked`), never left for the
    /// model to infer from an empty warning list.
    async fn answer(&self, args: DrugSafetyArgs) -> Result<DrugCheck, std::convert::Infallible> {
        let Some(patient_id) = self.patient_id else {
            return Ok(DrugCheck::no_chart(args.drug));
        };
        Ok(match self.evaluate(&args.drug, patient_id).await {
            Ok(warnings) if warnings.is_empty() => DrugCheck::clear(args.drug),
            Ok(warnings) => DrugCheck::flagged(
                args.drug,
                warnings
                    .iter()
                    .map(|w| format!("[{:?}] {}", w.severity, w.message))
                    .collect(),
            ),
            Err(_) => DrugCheck::failed(args.drug),
        })
    }
}

// ── Guarded WRITE-action tool: draft a prescription ──────────────────
// The differentiator's hard edge: the assistant can DRAFT a prescription, but
// the SERVER — not the model — runs the pharmacy safety engine and REFUSES to
// stage it when the engine returns a Block-severity warning (contraindication).
// The block lives in server code, so the model cannot talk its way past it. Both
// the refusal and the proposal are audited. The AI never creates the order and
// stages nothing (#4895): a clean proposal is text the clinician may write on the
// prescription themselves.

#[derive(serde::Deserialize)]
struct DraftPrescriptionArgs {
    drug: String,
    #[serde(default)]
    dose: Option<String>,
}

#[derive(serde::Serialize)]
struct DraftPrescriptionResult {
    decision: String,
    drug: String,
    warnings: Vec<String>,
    message: String,
}

struct DraftPrescriptionTool {
    /// Every result goes back to the model through this turn's redaction.
    session: redaction::Session,
    db: sqlx::PgPool,
    tenant_id: Uuid,
    department_ids: Vec<Uuid>,
    patient_id: Option<Uuid>,
    user_id: Uuid,
    agent: serde_json::Value,
}

impl DraftPrescriptionTool {
    /// Run the safety engine for the drug and audit the decision. Returns
    /// `(blocked, warning_messages)`. Any Block-severity warning => blocked.
    async fn stage(
        &self,
        patient_id: Uuid,
        drug: &str,
        dose: Option<&str>,
    ) -> Result<(bool, Vec<String>), AppError> {
        let mut tx = self.db.begin().await?;
        medbrains_db::pool::set_full_context(&mut tx, &self.tenant_id, &self.department_ids)
            .await?;
        let items = [medbrains_pharmacy::MedicationSafetyItem {
            catalog_item_id: None,
            drug_name: drug.to_owned(),
            quantity: 1,
        }];
        let warnings = medbrains_pharmacy::evaluate_medication_safety_in_tx(
            &mut tx,
            &self.tenant_id,
            &patient_id,
            &items,
        )
        .await?;
        let blocked = warnings.iter().any(|w| {
            matches!(
                w.severity,
                medbrains_pharmacy::MedicationSafetySeverity::Block
            )
        });
        let messages: Vec<String> = warnings
            .iter()
            .map(|w| format!("[{:?}] {}", w.severity, w.message))
            .collect();
        let detail = serde_json::json!({
            "drug": drug, "dose": dose, "blocked": blocked, "warnings": messages,
        });
        let action = if blocked {
            "ai_prescription_blocked"
        } else {
            "ai_prescription_drafted"
        };
        medbrains_db::audit::AuditLogger::log(
            &mut tx,
            &medbrains_db::audit::AuditEntry {
                tenant_id: self.tenant_id,
                user_id: Some(self.user_id),
                action,
                entity_type: "ai_assistant",
                entity_id: Some(patient_id),
                old_values: None,
                new_values: Some(&detail),
                ip_address: None,
            },
        )
        .await?;
        tx.commit().await?;
        Ok((blocked, messages))
    }
}

impl rig::tool::Tool for DraftPrescriptionTool {
    const NAME: &'static str = "draft_prescription";
    type Error = std::convert::Infallible;
    type Args = DraftPrescriptionArgs;
    type Output = Redacted;

    fn description(&self) -> String {
        "Draft a prescription for the current patient. The server runs the pharmacy \
        safety engine and REFUSES (decision='blocked') on a contraindication — you cannot \
        override it. On success nothing is saved: tell the clinician it is a proposal \
        for them to write on the prescription. You never prescribe."
            .to_owned()
    }

    fn parameters(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "drug": { "type": "string", "description": "Drug (generic or brand name)" },
                "dose": { "type": "string", "description": "Dose/frequency, optional" }
            },
            "required": ["drug"]
        })
    }

    async fn call(
        &self,
        _context: &mut rig::tool::ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let out = match self.answer(args).await {
            Ok(out) => out,
            Err(never) => match never {},
        };
        Ok(redaction::for_model(
            &self.session,
            &serde_json::to_string(&out).unwrap_or_default(),
        ))
    }
}

impl DraftPrescriptionTool {
    async fn answer(
        &self,
        args: DraftPrescriptionArgs,
    ) -> Result<DraftPrescriptionResult, std::convert::Infallible> {
        let Some(patient_id) = self.patient_id else {
            return Ok(DraftPrescriptionResult {
                decision: "no_patient".to_owned(),
                drug: args.drug,
                warnings: Vec::new(),
                message: "No patient chart is loaded — cannot draft a prescription.".to_owned(),
            });
        };
        // The audit row for the decision is written inside the agent's scope,
        // so it names the assistant as well as the clinician.
        let staged = medbrains_db::audit::ACTING_AGENT
            .scope(
                self.agent.clone(),
                self.stage(patient_id, &args.drug, args.dose.as_deref()),
            )
            .await;
        match staged {
            Ok((true, messages)) => Ok(DraftPrescriptionResult {
                decision: "blocked".to_owned(),
                message: format!(
                    "REFUSED by the safety system — do not propose this prescription: {}. Do not \
                     recommend it; escalate to the clinician.",
                    messages.join("; ")
                ),
                warnings: messages,
                drug: args.drug,
            }),
            Ok((false, messages)) => Ok(DraftPrescriptionResult {
                decision: "proposed".to_owned(),
                message: if messages.is_empty() {
                    "Safety check passed. Nothing was prescribed or saved — the clinician writes it \
                     on the prescription if they agree."
                        .to_owned()
                } else {
                    format!(
                        "Safety check passed with advisories: {}. Nothing was prescribed or saved — \
                         the clinician decides and writes it on the prescription.",
                        messages.join("; ")
                    )
                },
                warnings: messages,
                drug: args.drug,
            }),
            Err(_) => Ok(DraftPrescriptionResult {
                decision: "error".to_owned(),
                drug: args.drug,
                warnings: Vec::new(),
                message: "Could not verify safety — do not propose it. Escalate to the clinician."
                    .to_owned(),
            }),
        }
    }
}

// ── Read tool: patient overview (a REST API plugged in as a tool) ────
// Generalised context pattern: the screen context carries the ids on screen; the
// assistant calls this to fetch a patient's clinical facts on demand (instead of
// pre-injecting them). Access-checked per patient. Add more tools (invoice,
// report…) the same way as new surfaces need them.

#[derive(serde::Deserialize)]
struct PatientOverviewArgs {
    patient_id: String,
}

struct PatientOverviewTool {
    /// Every result goes back to the model through this turn's redaction.
    session: redaction::Session,
    state: AppState,
    claims: Claims,
    /// The overview also waits here, as `patient_overview`, for a widget.
    shelf: show::Shelf,
}

impl PatientOverviewTool {
    async fn overview(&self, patient_id: Uuid) -> Result<String, AppError> {
        // Same access rule as the grounding gate: admins bypass, others ReBAC.
        let is_admin = medbrains_server_core::middleware::authorization::BYPASS_ROLES
            .contains(&self.claims.role.as_str());
        if !is_admin {
            medbrains_authz_gate::require_patient_access(&self.state, &self.claims, patient_id)
                .await?;
        }
        if let Some(agent) = &self.claims.act {
            record_ai_read(
                &self.state.db,
                self.claims.tenant_id,
                self.claims.sub,
                patient_id,
                &agent.to_audit_json(),
            )
            .await?;
        }
        let mut tx = self.state.db.begin().await?;
        medbrains_db::pool::set_full_context(
            &mut tx,
            &self.claims.tenant_id,
            &self.claims.department_ids,
        )
        .await?;
        let grounding = fetch_patient_grounding(
            &mut tx,
            self.claims.tenant_id,
            patient_id,
            medbrains_authz_gate::mental_health::MentalHealthViewer::of(&self.claims),
        )
        .await?;
        drop(tx);
        // Empty lists say "none recorded"; the model is told not to fill them.
        serde_json::to_string(&grounding)
            .map_err(|e| AppError::Internal(format!("overview did not serialise: {e}")))
    }
}

impl rig::tool::Tool for PatientOverviewTool {
    const NAME: &'static str = "get_patient_overview";
    type Error = std::convert::Infallible;
    type Args = PatientOverviewArgs;
    type Output = Redacted;

    fn description(&self) -> String {
        "Fetch a patient's allergies, active medications, active problems, and \
            recent lab results, as JSON. Pass a REAL patient_id taken verbatim from the screen context. \
            If no patient is in context, do NOT call this — call `request_patient` so the user \
            can choose one; never guess or invent an id. Call it at most once and use whatever \
            it returns."
            .to_owned()
    }

    fn parameters(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "string",
                    "description": "The patient's id from the screen context"
                }
            },
            "required": ["patient_id"]
        })
    }

    async fn call(
        &self,
        _context: &mut rig::tool::ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let out = match self.answer(args).await {
            Ok(out) => out,
            Err(never) => match never {},
        };
        Ok(redaction::for_model(&self.session, &out))
    }
}

impl PatientOverviewTool {
    async fn answer(&self, args: PatientOverviewArgs) -> Result<String, std::convert::Infallible> {
        let Ok(pid) = Uuid::parse_str(&args.patient_id) else {
            return Ok(
                "No valid patient id was provided. If no patient is in the screen context, \
                call `request_patient` so the user can choose one — do not guess an id."
                    .to_owned(),
            );
        };
        Ok(match self.overview(pid).await {
            Ok(text) => {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    show::shelve(&self.shelf, &self.session, "patient_overview", &json);
                }
                text
            }
            // A refusal and an outage are different answers (three outcomes,
            // never two): "no access" must not be said when nobody could check.
            Err(AppError::Forbidden | AppError::ForbiddenReason(_) | AppError::NotFound) => {
                "You do not have access to this patient's record.".to_owned()
            }
            Err(_) => UNKNOWN_FOR_MODEL.to_owned(),
        })
    }
}

// ── Generic read tool: the whole GET API surface as ONE tool ─────────
// Dispatches a GET into the app's own router IN-PROCESS (single binary), so the
// request runs through the real auth/RLS/permission/audit stack and can never
// exceed the user's access. No per-endpoint code — new GET routes are instantly
// callable; the allowlist + the model's catalog (in the description) bound it.

#[derive(serde::Deserialize)]
struct CallApiArgs {
    path: String,
}

struct CallApiTool {
    /// Every result goes back to the model through this turn's redaction.
    session: redaction::Session,
    state: AppState,
    /// The user's claims with `act` set to this assistant run.
    claims: Claims,
    /// Where the full result waits for a widget; the model gets it compacted.
    shelf: show::Shelf,
}

/// Told to the user when their question names a restricted class.
const RESTRICTED_QUESTION: &str = "This question mentions a restricted clinical area (HIV/STI, \
    mental health, PC-PNDT, medico-legal, substance use or reproductive care). That is never \
    shared with the AI, so it was not sent. Use the chart directly for it.";

/// Told to the model when a check could not run, so it never reads an outage
/// as "nothing there".
const UNKNOWN_FOR_MODEL: &str = "UNKNOWN — the system could not check this right now (a fault, \
    not an answer). Do not treat it as 'none' or 'no access'; tell the user it could not be checked.";

/// Dispatch one read into `router` as the AI agent in `claims.act`.
///
/// It runs on the user's behalf, through the real auth, permission, `ReBAC`,
/// RLS and audit stack with the user's authority — the agent can never exceed
/// it — and every audit/access row it produces names the agent.
///
/// # Errors
/// The token could not be minted or the path is not a valid URI.
pub async fn call_api_as_agent(
    router: axum::Router,
    state: &AppState,
    claims: &Claims,
    path: &str,
) -> Result<String, AppError> {
    if claims.act.is_none() {
        return Err(AppError::Internal("agent read without an actor".to_owned()));
    }
    if !CALL_API_ALLOWLIST.iter().any(|p| path.starts_with(p)) {
        return Ok(format!("Path '{path}' is not permitted for the assistant."));
    }
    // Restricted clinical classes are never fetched for a model at all —
    // cheaper and safer than fetching and withholding.
    if RESTRICTED_PATHS.iter().any(|seg| path.contains(seg)) {
        return Ok(
            "Not shared with the AI: this is a restricted clinical record (mental health, \
             medico-legal, PC-PNDT, HIV or reproductive care)."
                .to_owned(),
        );
    }
    // Mint a token for the caller so the request goes through the real auth path.
    let token =
        medbrains_server_core::middleware::auth::encode_jwt(claims, &state.jwt_encoding_key)
            .map_err(|_| AppError::Internal("token mint failed".to_owned()))?;
    let request = axum::http::Request::builder()
        .method(axum::http::Method::GET)
        .uri(path)
        .header(axum::http::header::AUTHORIZATION, format!("Bearer {token}"))
        .body(axum::body::Body::empty())
        .map_err(|_| AppError::BadRequest("invalid path".to_owned()))?;
    let response = match router.oneshot(request).await {
        Ok(r) => r,
        Err(never) => match never {},
    };
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), 256 * 1024)
        .await
        .map_err(|_| AppError::Internal("read body failed".to_owned()))?;
    Ok(describe_response(
        status,
        &minimum_necessary(&String::from_utf8_lossy(&bytes)),
    ))
}

/// Path segments of restricted-class records (MHCA 2017, PC&PNDT 1994,
/// medico-legal, HIV/AIDS Act 2017, ART/MTP Acts).
const RESTRICTED_PATHS: &[&str] = &[
    "/psychiatry",
    "/psychometric",
    "/mlc",
    "/pcpndt",
    "/mortuary",
    "/hiv",
    "/ivf",
    "/mtp",
];

/// Record metadata no assistant task needs: who edited it, from where, with
/// what token. Dropped before redaction (minimum necessary, DPDP s.6).
const NEVER_NEEDED: &[&str] = &[
    "created_by",
    "updated_by",
    "deleted_by",
    "ip_address",
    "user_agent",
    "session_id",
    "password_hash",
    "token",
    "refresh_token",
    "api_key",
    "secret",
    "signature",
    "signature_url",
    "photo_url",
    "hash",
    "prev_hash",
];

/// An API body cut down to what a model may need: metadata keys dropped.
/// (Identifiers and restricted classes are handled by the redactor after.)
fn minimum_necessary(body: &str) -> String {
    fn prune(v: &mut serde_json::Value) {
        match v {
            serde_json::Value::Object(map) => {
                map.retain(|k, _| !NEVER_NEEDED.contains(&k.as_str()));
                map.values_mut().for_each(prune);
            }
            serde_json::Value::Array(items) => items.iter_mut().for_each(prune),
            _ => {}
        }
    }
    serde_json::from_str::<serde_json::Value>(body).map_or_else(
        |_| body.to_owned(),
        |mut json| {
            prune(&mut json);
            json.to_string()
        },
    )
}

/// What the model is told about one API answer. A server fault is UNKNOWN,
/// never an empty answer; a refusal says so without the body.
fn describe_response(status: axum::http::StatusCode, body: &str) -> String {
    if status.is_server_error() {
        return format!("HTTP {}\n{UNKNOWN_FOR_MODEL}", status.as_u16());
    }
    if status == axum::http::StatusCode::FORBIDDEN || status == axum::http::StatusCode::NOT_FOUND {
        return format!(
            "HTTP {}\nNot available to this user (no permission, or no such record).",
            status.as_u16()
        );
    }
    format!("HTTP {}\n{body}", status.as_u16())
}

/// One `access_log` row for a chart read the assistant made directly (not over
/// HTTP), so the patient's access history names the assistant too.
async fn record_ai_read(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    user_id: Uuid,
    patient_id: Uuid,
    agent: &serde_json::Value,
) -> Result<(), AppError> {
    let row = medbrains_server_core::middleware::access_log::AccessRow {
        tenant_id,
        user_id,
        entity_type: "patients".to_owned(),
        entity_id: Some(patient_id),
        patient_id: Some(patient_id),
        ip_address: None,
        user_agent: None,
        module: "ai".to_owned(),
        correlation_id: None,
        acting_agent: Some(agent.clone()),
    };
    medbrains_server_core::middleware::access_log::insert_access_log(db, &row)
        .await
        .map_err(|e| AppError::Internal(format!("access trail write failed: {e}")))
}

impl CallApiTool {
    async fn get(&self, path: &str) -> Result<String, AppError> {
        let router = AI_ROUTER
            .get()
            .ok_or_else(|| AppError::Internal("router unavailable".to_owned()))?
            .clone();
        let path = dates::fill(path, chrono::Local::now().date_naive());
        call_api_as_agent(router, &self.state, &self.claims, &path).await
    }
}

impl rig::tool::Tool for CallApiTool {
    const NAME: &'static str = "call_api";
    type Error = std::convert::Infallible;
    type Args = CallApiArgs;
    type Output = Redacted;

    fn description(&self) -> String {
        "Fetch data from any MedBrains read API (GET). Runs with YOUR permissions, \
            so you can only read what you're allowed to — prefer this over asking the user. If \
            unsure which endpoint exists, call `list_apis` first to see them all. Pass a full \
            path with ids filled from the screen context, e.g. GET /api/patients/{id}/allergies, \
            /api/lab/orders/{orderId}/results, /api/billing/invoices?patient_id={id}. "
            .to_owned()
            + dates::HELP
    }

    fn parameters(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "GET path, e.g. /api/patients/<id>/allergies"
                }
            },
            "required": ["path"]
        })
    }

    async fn call(
        &self,
        _context: &mut rig::tool::ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        let out = match self.answer(args).await {
            Ok(out) => out,
            Err(never) => match never {},
        };
        Ok(redaction::for_model(&self.session, &out))
    }
}

impl CallApiTool {
    async fn answer(&self, args: CallApiArgs) -> Result<String, std::convert::Infallible> {
        Ok(match self.get(&args.path).await {
            Ok(text) => self.shelve_compact(&args.path, text),
            Err(e) => {
                tracing::warn!(error = %e, "assistant call_api failed");
                UNKNOWN_FOR_MODEL.to_owned()
            }
        })
    }
}

impl CallApiTool {
    /// A successful JSON answer goes on the shelf whole (for a widget) and
    /// to the model compacted: a long list costs it a sample and a count.
    fn shelve_compact(&self, path: &str, text: String) -> String {
        let Some(json) = text
            .strip_prefix(OK_PREFIX)
            .and_then(|body| serde_json::from_str::<serde_json::Value>(body).ok())
        else {
            return text;
        };
        show::shelve(&self.shelf, &self.session, path, &json);
        format!(
            "{OK_PREFIX}{}",
            medbrains_core::ai_widgets::compact_for_model(&json)
        )
    }
}

/// How [`describe_response`] opens a successful answer.
const OK_PREFIX: &str = "HTTP 200\n";

// ── Interactive tool: request a patient (client renders a picker) ────
// The model calls this when it needs a patient but none is in context. The
// backend stays UI-agnostic — it just surfaces the tool call; the CLIENT renders
// the patient search picker and continues the turn with the chosen patient.

#[derive(serde::Deserialize)]
struct RequestPatientArgs {}

struct RequestPatientTool;

impl rig::tool::Tool for RequestPatientTool {
    const NAME: &'static str = "request_patient";
    type Error = std::convert::Infallible;
    type Args = RequestPatientArgs;
    type Output = Redacted;

    fn description(&self) -> String {
        "Show the user a patient search box to choose a patient. Call this \
            WHENEVER you need a patient but none is in the screen context — NEVER invent or \
            guess a patient id. The chosen patient will be in context on the next message."
            .to_owned()
    }

    fn parameters(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "reason": { "type": "string", "description": "Why a patient is needed" }
            }
        })
    }

    fn call(
        &self,
        _context: &mut rig::tool::ToolContext,
        _args: Self::Args,
    ) -> impl Future<Output = Result<Self::Output, Self::Error>> + Send {
        std::future::ready(Ok(Redacted::fixed(
            "A patient search box is now shown to the user. STOP and wait for their selection; do \
            not call patient tools or invent an id. The chosen patient arrives in the next message.",
        )))
    }
}

// ── Discovery tool: list all read (GET) endpoints ───────────────────
// The whole read surface is large (650+ GET endpoints); rather than dump it into
// every request, the model calls this on demand to discover which path to hit,
// then uses call_api. Catalog is generated from mod.rs by
// scripts/gen_ai_read_catalog.py — regenerate after route changes.

#[derive(serde::Deserialize)]
struct ListApisArgs {
    /// Words from the question: `billing revenue`, `lab pending`.
    #[serde(default)]
    query: String,
}

struct ListApisTool {
    session: redaction::Session,
}

impl rig::tool::Tool for ListApisTool {
    const NAME: &'static str = "list_apis";
    type Error = std::convert::Infallible;
    type Args = ListApisArgs;
    type Output = Redacted;

    fn description(&self) -> String {
        "Search the read (GET) API endpoints call_api can reach: pass a few words from the \
            question (e.g. 'billing revenue', 'lab pending'); you get the matching paths. Call \
            it before call_api when unsure of a path."
            .to_owned()
    }

    fn parameters(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "query": { "type": "string", "description": "A few words from the question" }
            },
            "required": ["query"]
        })
    }

    fn call(
        &self,
        _context: &mut rig::tool::ToolContext,
        args: Self::Args,
    ) -> impl Future<Output = Result<Self::Output, Self::Error>> + Send {
        std::future::ready(Ok(redaction::for_model(
            &self.session,
            &catalog::search(&args.query),
        )))
    }
}

/// The boxed SSE body type — one alias so both provider branches unify.
type SseBody =
    std::pin::Pin<Box<dyn Stream<Item = Result<Event, std::convert::Infallible>> + Send>>;

/// One SSE frame carrying a JSON payload; falls back to `{}` if serialisation
/// somehow fails (avoids `unwrap`, which clippy denies).
// The `Result<_, Infallible>` wrap is required: it is the `Sse` stream item type.
#[allow(clippy::unnecessary_wraps)]
fn sse(payload: &serde_json::Value) -> Result<Event, std::convert::Infallible> {
    Ok(Event::default()
        .json_data(payload)
        .unwrap_or_else(|_| Event::default().data("{}")))
}

/// Resolve the grounded patient (`ReBAC`), open or continue the conversation,
/// and load prior history, KB hits and the placeholder map — under one RLS
/// transaction. The user's turn is stored later, redacted.
async fn open_turn(
    state: &AppState,
    claims: &Claims,
    req: &ChatRequest,
    cfg: &AiConfig,
    message: &str,
) -> Result<PreparedTurn, AppError> {
    let tenant_id = claims.tenant_id;

    // Grounding gate: only inject a patient's clinical facts if the caller may
    // view that patient. Access-denied silently skips (never blocks, never leaks).
    let patient_id = req
        .context
        .as_ref()
        .and_then(|c| c.get("patient_id"))
        .and_then(serde_json::Value::as_str)
        .and_then(|s| Uuid::parse_str(s).ok());
    // Admins bypass every other check, so they bypass the patient gate too
    // (otherwise a missing SpiceDB relation silently drops grounding for them).
    let is_admin = medbrains_server_core::middleware::authorization::BYPASS_ROLES
        .contains(&claims.role.as_str());
    let grounded_patient = match patient_id {
        None => None,
        Some(pid) if is_admin => Some(pid),
        // A refusal skips grounding silently, as designed — the copilot answers
        // generally rather than revealing that the patient exists.
        //
        // An outage must NOT take that path. `.is_ok()` used to fold both into
        // "skip", so a database fault produced a fluent clinical answer with
        // the patient's chart silently missing from it, and nothing on screen
        // said so. An ungrounded answer that looks grounded is worse than no
        // answer, so the request fails instead.
        Some(pid) => match medbrains_authz_gate::require_patient_access(state, claims, pid).await {
            Ok(()) => Some(pid),
            Err(err @ AppError::ServiceUnavailable(_)) => return Err(err),
            Err(_) => None,
        },
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &tenant_id, &claims.department_ids).await?;

    let mut pseudonyms = None;
    let conversation_id = if let Some(id) = req.conversation_id {
        let row = sqlx::query_as::<_, (Uuid, Option<Uuid>, serde_json::Value)>(
            "SELECT owner_user_id, patient_id, pseudonym_map FROM ai_conversations \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(id)
        .bind(tenant_id)
        .fetch_optional(&mut *tx)
        .await?;
        match row {
            Some((owner, about, map)) if owner == claims.sub => {
                bind_conversation_patient(&mut tx, id, about, patient_id).await?;
                pseudonyms = Some(map);
                id
            }
            Some(_) => return Err(AppError::Forbidden),
            None => return Err(AppError::BadRequest("conversation not found".to_owned())),
        }
    } else {
        // The title is shown in the history menu only; a placeholder title
        // keeps identifiers out of it until the turn's redaction exists.
        let title = "New conversation";
        sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO ai_conversations (tenant_id, owner_user_id, title, model, patient_id) \
             VALUES ($1, $2, $3, $4, $5) RETURNING id",
        )
        .bind(tenant_id)
        .bind(claims.sub)
        .bind(title)
        .bind(&cfg.model)
        .bind(patient_id)
        .fetch_one(&mut *tx)
        .await?
    };

    // The most recent messages only, oldest first: a bounded read, and a
    // bounded prompt however long the conversation runs.
    let mut history_rows = sqlx::query_as::<_, HistoryRow>(
        "SELECT role, content FROM ai_messages \
         WHERE conversation_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT $3",
    )
    .bind(conversation_id)
    .bind(tenant_id)
    .bind(i64::from(medbrains_core::ai_guard::HISTORY_MESSAGES))
    .fetch_all(&mut *tx)
    .await?;
    history_rows.reverse();

    let kb_hits = retrieve_kb(&mut tx, message).await?;
    tx.commit().await?;

    Ok(PreparedTurn {
        conversation_id,
        history: history_rows,
        patient_id,
        grounded_patient,
        kb_hits,
        pseudonyms,
    })
}

/// Whether a turn about `asked` may continue a conversation about `about`.
/// One conversation is about one patient: its history must never ground an
/// answer shown on another patient's screen. A thread with no patient yet
/// (the user picks one mid-thread) takes the first one named; a turn naming
/// no patient adds nothing about anyone and may continue any thread.
const fn continues_conversation(about: Option<Uuid>, asked: Option<Uuid>) -> bool {
    match (about, asked) {
        (Some(a), Some(b)) => a.as_u128() == b.as_u128(),
        _ => true,
    }
}

/// Refuse a turn about a different patient; pin a patient-less thread to the
/// first patient a turn names.
async fn bind_conversation_patient(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    conversation_id: Uuid,
    about: Option<Uuid>,
    asked: Option<Uuid>,
) -> Result<(), AppError> {
    if !continues_conversation(about, asked) {
        return Err(AppError::Conflict(
            "This conversation is about a different patient. Start a new conversation for this \
             patient."
                .to_owned(),
        ));
    }
    if about.is_none() && asked.is_some() {
        sqlx::query("UPDATE ai_conversations SET patient_id = $2 WHERE id = $1")
            .bind(conversation_id)
            .bind(asked)
            .execute(&mut **tx)
            .await?;
    }
    Ok(())
}

/// The turn's context block: the generic screen context (the ids of whatever
/// the user is viewing) and knowledge-base references. Data for those ids is
/// fetched on demand by the tools, not pre-injected. Redacted before use, and
/// sent in the user turn — never in the system prompt, whose bytes must not
/// change between turns or the cached prefix is rewritten every time.
fn build_context(context: Option<&serde_json::Value>, kb_hits: &[KbHit]) -> String {
    let mut parts: Vec<String> = Vec::new();
    if let Some(ctx) = context.filter(|c| !c.is_null()) {
        // Ids only, as JSON; what to do with them is in the cached system prompt.
        parts.push(format!("Screen: {ctx}"));
    }
    if !kb_hits.is_empty() {
        let refs: Vec<String> = kb_hits
            .iter()
            .map(|h| {
                format!(
                    "- {} [{}]: {}",
                    h.term,
                    h.source_name,
                    h.snippet.as_deref().unwrap_or("")
                )
            })
            .collect();
        parts.push(format!("Knowledge base:\n{}", refs.join("\n")));
    }
    parts.join("\n\n")
}

pub async fn chat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<ChatRequest>,
) -> Result<Sse<axum::response::sse::KeepAliveStream<SseBody>>, AppError> {
    require_permission(&claims, permissions::ai::assistant::USE)?;
    let message = req.message.trim().to_owned();
    if message.is_empty() {
        return Err(AppError::BadRequest("message must not be empty".to_owned()));
    }

    let cfg = resolve_config(&state, &claims.tenant_id).await?;
    if !cfg.enabled {
        return Err(AppError::Forbidden);
    }
    // Refused outside India before the turn is opened or stored.
    if cfg.provider == "bedrock" {
        medbrains_server_services::llm::bedrock_base_url()?;
    }

    let PreparedTurn {
        conversation_id,
        history,
        patient_id,
        grounded_patient,
        kb_hits,
        pseudonyms,
    } = open_turn(&state, &claims, &req, &cfg, &message).await?;
    let tenant_id = claims.tenant_id;
    // The assistant acts for the clinician, never as them: every read its tools
    // make carries this actor, so the trail says "AI assistant on behalf of".
    let agent = medbrains_server_core::middleware::auth::ActingAgent {
        kind: medbrains_server_core::middleware::auth::ActorKind::AiAgent,
        agent: "clinical_assistant".to_owned(),
        model: cfg.model.clone(),
        run_id: Uuid::new_v4(),
        conversation_id: Some(conversation_id),
    };
    let agent_json = agent.to_audit_json();
    let claims = Claims {
        act: Some(agent),
        ..claims
    };

    // Everything below reaches the model only through this turn's redaction
    // (every provider, local ones included). Fail closed: if it cannot be made
    // safe, the call is refused and nothing is sent or stored.
    let mut redactor = session_for(&state, &claims, patient_id, pseudonyms).await?;
    // Before any redaction, so only the patient's own contacts can be shown.
    let contacts = contact_access::for_turn(&state, &claims, grounded_patient, &redactor).await;
    let unsafe_ = |e: medbrains_core::ai_redact::RedactError| {
        medbrains_server_services::llm::unsafe_to_send(&e)
    };
    let context = redactor
        .redact(&build_context(req.context.as_ref(), &kb_hits))
        .map_err(unsafe_)?;
    let message = redactor.redact(&message).map_err(unsafe_)?;
    // A question that itself names a restricted class is not sent at all, and
    // the user is told why rather than given an answer to an empty question.
    if message.is_withheld() {
        return Err(AppError::BadRequest(RESTRICTED_QUESTION.to_owned()));
    }
    let mut prior = Vec::with_capacity(history.len());
    for row in history {
        let text = redactor.redact(&row.content).map_err(unsafe_)?;
        prior.push(match row.role.as_str() {
            "assistant" => rig::message::Message::assistant(text.for_model()),
            _ => rig::message::Message::user(text.for_model()),
        });
    }
    let session: redaction::Session = std::sync::Arc::new(std::sync::Mutex::new(redactor));
    // Stored as the model received it, with the map to read it back.
    store_turn(
        &state,
        tenant_id,
        conversation_id,
        "user",
        message.for_model(),
        &session,
    )
    .await?;

    let turn = turn::Turn {
        guard: std::sync::Arc::new(std::sync::Mutex::new(
            medbrains_core::ai_guard::AnswerGuard::new(message.for_model()).with_contacts(contacts),
        )),
        context: context.for_model().to_owned(),
        prompt: if context.for_model().is_empty() {
            message
        } else {
            context.join("\n\n", &message)
        },
        history: prior,
        state: state.clone(),
        tenant_id,
        conversation_id,
        kb_hits,
        session: std::sync::Arc::clone(&session),
    };

    let deps = turn::ToolDeps {
        session,
        state,
        claims,
        grounded_patient,
        agent_json,
    };
    let boxed = turn::stream_answer(&cfg, &deps, turn)?;

    // Heartbeat comments (default 15s) keep the connection alive through idle
    // gaps + proxy idle-timeouts (nginx/ALB) so a slow first token isn't dropped.
    Ok(Sse::new(boxed).keep_alive(KeepAlive::default()))
}

/// Store one turn (redacted text) and the conversation's placeholder map, and
/// touch the conversation, under RLS.
async fn store_turn(
    state: &AppState,
    tenant_id: Uuid,
    conversation_id: Uuid,
    role: &'static str,
    content: &str,
    session: &redaction::Session,
) -> Result<(), AppError> {
    let map = redaction::map_of(session)
        .ok_or_else(|| AppError::Internal("redaction map unavailable".to_owned()))?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    sqlx::query(
        "INSERT INTO ai_messages (tenant_id, conversation_id, role, content) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind(tenant_id)
    .bind(conversation_id)
    .bind(role)
    .bind(content)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE ai_conversations SET last_message_at = now(), pseudonym_map = $3, \
                title = CASE WHEN $4 = 'user' AND title = 'New conversation' \
                             THEN left($5, 60) ELSE title END \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(conversation_id)
    .bind(tenant_id)
    .bind(map)
    .bind(role)
    .bind(content)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

// ── Proactive whispers (step 1: critical-value SSE) ──────────────────
// A long-lived SSE the assistant UI subscribes to; it surfaces newly-fired,
// unacknowledged critical lab values (post-commit, polled) as "whispers", plus
// emergency-code activations. Rides the normal auth/RLS middleware.
//
// Per patient: a critical value reaches only a caller who may see that patient
// (the same visible set list screens use, one round trip per poll), and every
// whisper names its patient, so a value for one patient can never be read as
// belonging to the chart on screen. Per tenant: RLS plus the tenant predicate.
//
// A poll that cannot answer is "couldn't check", never silence: the stream
// says so once when it goes unknown and again when it recovers.
//
// ponytail: polling (~10s) and the visible set re-fetched per poll; a push bus
// off the outbox worker, and a cached visible set, are the upgrade paths.

#[derive(sqlx::FromRow)]
struct CriticalAlertRow {
    patient_id: Uuid,
    patient_name: Option<String>,
    uhid: Option<String>,
    parameter_name: String,
    value: String,
    flag: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(sqlx::FromRow)]
struct CodeRow {
    code_type: String,
    location: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
}

/// One event for the whisper stream.
#[derive(Debug)]
pub struct Whisper {
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub payload: serde_json::Value,
}

/// Whisper-worthy events fired since `since`.
///
/// Critical lab values for patients the caller may see, and emergency-code
/// activations. An unanswerable visible set is an error, never an empty list.
///
/// # Errors
/// The caller's visible patients could not be resolved, or the database failed.
pub async fn fetch_new_whispers(
    state: &AppState,
    claims: &Claims,
    since: chrono::DateTime<chrono::Utc>,
) -> Result<Vec<Whisper>, AppError> {
    let visible = medbrains_authz_gate::visible_patient_ids(state, claims).await?;
    let tenant_id = claims.tenant_id;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    let mut out: Vec<Whisper> = Vec::new();

    let alerts = sqlx::query_as::<_, CriticalAlertRow>(
        "SELECT a.patient_id, \
                NULLIF(concat_ws(' ', p.first_name, p.last_name), '') AS patient_name, \
                p.uhid, a.parameter_name, a.value, a.flag::text AS flag, a.created_at \
         FROM lab_critical_alerts a \
         JOIN patients p ON p.id = a.patient_id AND p.tenant_id = a.tenant_id \
         WHERE a.tenant_id = $1 AND a.created_at > $2 AND a.acknowledged_at IS NULL \
           AND ($3::uuid[] IS NULL OR a.patient_id = ANY($3)) \
         ORDER BY a.created_at LIMIT 20",
    )
    .bind(tenant_id)
    .bind(since)
    .bind(visible.as_deref())
    .fetch_all(&mut *tx)
    .await?;
    for a in alerts {
        let who = patient_label(a.patient_name.as_deref(), a.uhid.as_deref());
        out.push(Whisper {
            created_at: a.created_at,
            payload: serde_json::json!({
                "type": "whisper", "severity": "critical", "kind": "critical_lab_value",
                "title": format!("Critical lab value — {who}"),
                "message": format!("{} = {} [{}]", a.parameter_name, a.value, a.flag),
                "patientId": a.patient_id,
                "patientLabel": who,
            }),
        });
    }

    let codes = sqlx::query_as::<_, CodeRow>(
        "SELECT code_type, location, created_at FROM er_code_activations \
         WHERE tenant_id = $1 AND created_at > $2 ORDER BY created_at LIMIT 20",
    )
    .bind(tenant_id)
    .bind(since)
    .fetch_all(&mut *tx)
    .await?;
    for c in codes {
        let at = c.location.map(|l| format!(" at {l}")).unwrap_or_default();
        out.push(Whisper {
            created_at: c.created_at,
            payload: serde_json::json!({
                "type": "whisper", "severity": "critical", "kind": "emergency_code",
                "title": format!("Emergency: {}", c.code_type),
                "message": format!("{} activated{at}", c.code_type),
            }),
        });
    }

    tx.commit().await?;
    out.sort_by_key(|w| w.created_at);
    Ok(out)
}

/// "Name (UHID)" — so a whisper can never be taken for the chart on screen.
fn patient_label(name: Option<&str>, uhid: Option<&str>) -> String {
    match (name, uhid) {
        (Some(n), Some(u)) => format!("{n} ({u})"),
        (Some(n), None) => n.to_owned(),
        (None, Some(u)) => u.to_owned(),
        (None, None) => "unnamed patient".to_owned(),
    }
}

/// The stream-health event to send after a poll, if the health changed:
/// `unavailable` once when polls start failing, `ok` once when they answer
/// again (and on the first good poll, so the screen knows it is live).
fn health_change(was_ok: Option<bool>, now_ok: bool) -> Option<serde_json::Value> {
    if was_ok == Some(now_ok) {
        return None;
    }
    Some(if now_ok {
        serde_json::json!({ "type": "whisper_status", "status": "ok" })
    } else {
        serde_json::json!({
            "type": "whisper_status", "status": "unavailable",
            "message": "Couldn't check for critical alerts. Check the lab worklist directly until \
                this clears.",
        })
    })
}

pub async fn whispers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> axum::response::Response {
    // The stream carries patients' critical results; a role without the
    // lab-report permission has no business holding it open. Each item is
    // then filtered to the patients the caller may see.
    if let Err(error) = require_permission(&claims, permissions::lab::reports::VIEW) {
        return error.into_response();
    }

    let stream = async_stream::stream! {
        // Only surface alerts that fire AFTER the stream opens.
        let mut since = chrono::Utc::now();
        let mut was_ok: Option<bool> = None;
        loop {
            let polled = fetch_new_whispers(&state, &claims, since).await;
            if let Err(e) = &polled {
                tracing::warn!(error = %e, "whisper poll failed");
            }
            if let Some(status) = health_change(was_ok, polled.is_ok()) {
                yield sse(&status);
            }
            was_ok = Some(polled.is_ok());
            // On failure `since` stays put, so alerts fired during an outage
            // still arrive once polls answer again.
            for whisper in polled.unwrap_or_default() {
                if whisper.created_at > since {
                    since = whisper.created_at;
                }
                yield sse(&whisper.payload);
            }
            tokio::time::sleep(std::time::Duration::from_secs(10)).await;
        }
    };
    Sse::new(stream)
        .keep_alive(KeepAlive::default())
        .into_response()
}

// ── Conversation history (resume a thread) ───────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ConversationSummary {
    pub id: Uuid,
    pub title: Option<String>,
    pub last_message_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ConversationMessage {
    pub id: Uuid,
    pub role: String,
    pub content: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// The caller's own conversations, newest first — the assistant's history menu.
pub async fn list_conversations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ConversationSummary>>, AppError> {
    require_permission(&claims, permissions::ai::assistant::USE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<
        _,
        (
            Uuid,
            Option<String>,
            chrono::DateTime<chrono::Utc>,
            serde_json::Value,
        ),
    >(
        "SELECT id, title, last_message_at, pseudonym_map FROM ai_conversations \
         WHERE tenant_id = $1 AND owner_user_id = $2 AND archived_at IS NULL \
         ORDER BY last_message_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    // Titles are stored redacted; read back for their owner.
    Ok(Json(
        rows.into_iter()
            .map(|(id, title, last_message_at, map)| ConversationSummary {
                id,
                title: title.map(|t| redaction::map_from(Some(map)).rehydrate(&t)),
                last_message_at,
            })
            .collect(),
    ))
}

/// Messages of one conversation — owner-checked, so a thread only reopens for
/// its owner (sharing is a later phase).
pub async fn conversation_messages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ConversationMessage>>, AppError> {
    require_permission(&claims, permissions::ai::assistant::USE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let owner = sqlx::query_as::<_, (Uuid, serde_json::Value)>(
        "SELECT owner_user_id, pseudonym_map FROM ai_conversations \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let map = match owner {
        Some((o, map)) if o == claims.sub => redaction::map_from(Some(map)),
        Some(_) => return Err(AppError::Forbidden),
        None => return Err(AppError::BadRequest("conversation not found".to_owned())),
    };

    let mut rows = sqlx::query_as::<_, ConversationMessage>(
        "SELECT id, role, content, created_at FROM ai_messages \
         WHERE conversation_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    // Stored as the model saw it; read back for its owner.
    for row in &mut rows {
        row.content = map.rehydrate(&row.content);
    }
    Ok(Json(rows))
}

/// ai routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/ai/chat", post(chat))
        .route("/api/ai/whispers", get(whispers))
        .route("/api/ai/conversations", get(list_conversations))
        .route(
            "/api/ai/conversations/{id}/messages",
            get(conversation_messages),
        )
}

#[cfg(test)]
mod tests {
    use super::{UNKNOWN_FOR_MODEL, describe_response};
    use axum::http::StatusCode;

    /// An outage is UNKNOWN to the model, never an empty answer it could
    /// read as "nothing recorded".
    #[test]
    fn a_server_fault_is_unknown_not_empty() {
        let told = describe_response(StatusCode::SERVICE_UNAVAILABLE, "[]");
        assert!(told.contains(UNKNOWN_FOR_MODEL));
        assert!(!told.contains("[]"));
    }

    /// A refusal says so and carries no body.
    #[test]
    fn a_refusal_is_not_a_record() {
        let told = describe_response(StatusCode::FORBIDDEN, "{\"secret\":1}");
        assert!(told.starts_with("HTTP 403"));
        assert!(!told.contains("secret"));
    }

    /// A failed poll is said once, and recovery is said once — never silence.
    #[test]
    fn whisper_health_is_announced_on_change_only() {
        use super::health_change;
        assert_eq!(
            health_change(None, true).map(|v| v["status"].clone()),
            Some("ok".into())
        );
        assert_eq!(health_change(Some(true), true), None);
        let down = health_change(Some(true), false).map(|v| v["status"].clone());
        assert_eq!(down, Some("unavailable".into()));
        assert_eq!(health_change(Some(false), false), None);
        assert_eq!(
            health_change(None, false).map(|v| v["status"].clone()),
            Some("unavailable".into())
        );
    }

    /// One conversation, one patient.
    #[test]
    fn a_conversation_does_not_cross_patients() {
        use super::continues_conversation;
        let (a, b) = (uuid::Uuid::new_v4(), uuid::Uuid::new_v4());
        assert!(continues_conversation(Some(a), Some(a)));
        assert!(!continues_conversation(Some(a), Some(b)));
        assert!(continues_conversation(None, Some(b)));
        assert!(continues_conversation(Some(a), None));
    }

    #[test]
    fn record_metadata_is_dropped_before_the_model() {
        let out = super::minimum_necessary(
            r#"{"id":"1","created_by":"u","ip_address":"10.0.0.1","items":[{"token":"t","dose":"5 mg"}]}"#,
        );
        assert_eq!(out, r#"{"id":"1","items":[{"dose":"5 mg"}]}"#);
    }

    #[test]
    fn an_answer_passes_through() {
        assert_eq!(describe_response(StatusCode::OK, "{}"), "HTTP 200\n{}");
    }

    /// One restricted lab withholds that entry, not the whole overview
    /// (eval case 03); an empty section says "none recorded".
    #[test]
    fn a_restricted_lab_withholds_only_itself() {
        let overview = super::Grounding {
            allergies: vec!["Sulfa drugs".to_owned()],
            recent_lab_results: vec![super::LabEntry {
                parameter: "HIV 1/2 antibody".to_owned(),
                value: "Reactive".to_owned(),
                unit: None,
                flag: None,
            }],
            ..super::Grounding::default()
        };
        let json = serde_json::to_string(&overview).unwrap_or_default();
        let sent = medbrains_core::ai_redact::sensitive::withhold_in_text(&json);
        let (sent, withheld) = sent.unwrap_or_default();
        assert_eq!(withheld, 1);
        assert!(sent.contains("Sulfa drugs"), "{sent}");
        assert!(
            sent.contains(r#""active_medications":"none recorded""#),
            "{sent}"
        );
        assert!(
            !sent.contains("Reactive") && !sent.contains("HIV"),
            "{sent}"
        );
    }
}

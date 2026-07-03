//! Shared LLM access for the AI-assisted routes (custom-code generation,
//! LMS course generation).
//!
//! Resolves the AI provider per tenant from `tenant_settings`
//! (category `ai`, key `config` → `{ provider, model, api_key_secret }`),
//! falling back to `ANTHROPIC_API_KEY` from the environment so existing
//! deployments keep working. The API key is resolved through the configured
//! [`SecretResolver`](medbrains_core::secrets::SecretResolver) backend when a
//! `api_key_secret` reference is set, so keys live in the secret store rather
//! than the database or process env.

use axum::{
    Extension, Json,
    extract::{Path, State},
    response::sse::{Event, KeepAlive, Sse},
};
use futures::{Stream, StreamExt as _};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::middleware::auth::Claims;
use crate::{error::AppError, state::AppState};

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

/// Default model when the tenant has not configured one.
const DEFAULT_MODEL: &str = rig::providers::anthropic::completion::CLAUDE_SONNET_4_6;

/// System preamble for the clinical assistant. Safety-framed: suggest, don't
/// order; defer to the treating clinician; never invent clinical data.
const SYSTEM_PROMPT: &str = "You are the MedBrains clinical assistant for hospital staff. \
Be concise and clinically accurate. Do not give definitive diagnoses or treatment orders — \
suggest options and defer to the treating clinician. Cite sources when you have them. If you are \
unsure or lack grounded evidence, say so plainly rather than guessing. Never invent patient data, \
drug doses, or lab values. When you suggest or endorse a medication, FIRST call the \
`check_drug_safety` tool with the drug name and heed its result — never recommend a drug that \
conflicts with the patient's recorded allergies. To propose a prescription, call \
`draft_prescription`; if it returns decision 'blocked', the safety system has REFUSED the order — \
you must NOT recommend that drug. You never create or sign orders yourself; a clinician does. \
When the screen context gives you record ids (a patient, an invoice, a lab order…), FETCH the \
details with your tools (get_patient_overview, call_api) instead of asking the user to provide data.";

#[derive(Debug)]
struct AiConfig {
    provider: String,
    model: String,
    api_key: String,
    /// Tenant opt-out: `ai.config.assistant_enabled = false` disables the chat
    /// assistant while leaving the extraction features (code/course-gen) working.
    enabled: bool,
}

async fn resolve_config(state: &AppState, tenant_id: &Uuid) -> Result<AiConfig, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, tenant_id).await?;
    let stored = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'ai' AND key = 'config' AND deleted_at IS NULL",
    )
    .bind(*tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;

    let cfg = stored.unwrap_or_default();
    let str_field = |name: &str| {
        cfg.get(name)
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|s| !s.is_empty())
    };

    // Provider precedence: tenant config > AI_PROVIDER env > (openrouter if its
    // key is set, else anthropic). Set AI_PROVIDER=ollama for local/private
    // inference (no PHI egress).
    let provider = match str_field("provider") {
        Some(p) => p.to_owned(),
        None => std::env::var("AI_PROVIDER").ok().unwrap_or_else(|| {
            if std::env::var("OPENROUTER_API_KEY").is_ok() {
                "openrouter".to_owned()
            } else {
                "anthropic".to_owned()
            }
        }),
    };
    let default_model = match provider.as_str() {
        "openrouter" => "openai/gpt-4o-mini",
        "ollama" => "llama3.2",
        _ => DEFAULT_MODEL,
    };
    let model = str_field("model")
        .map(str::to_owned)
        .or_else(|| std::env::var("AI_MODEL").ok())
        .unwrap_or_else(|| default_model.to_owned());
    let enabled = cfg.get("assistant_enabled").and_then(serde_json::Value::as_bool) != Some(false);

    // Ollama is keyless (local). Others resolve a key from the secret store or env.
    let api_key = if provider == "ollama" {
        String::new()
    } else {
        match str_field("api_key_secret") {
            Some(secret) => state.secret_resolver.get(secret).await.map_err(|e| {
                AppError::BadRequest(format!("AI key secret '{secret}' unavailable: {e}"))
            })?,
            None => {
                let env_var = if provider == "openrouter" {
                    "OPENROUTER_API_KEY"
                } else {
                    "ANTHROPIC_API_KEY"
                };
                std::env::var(env_var).map_err(|_| {
                    AppError::BadRequest(format!(
                        "No AI provider configured: set tenant ai.config.api_key_secret or {env_var}"
                    ))
                })?
            }
        }
    };

    Ok(AiConfig {
        provider,
        model,
        api_key,
        enabled,
    })
}

/// Run a structured extraction with the tenant's configured AI provider.
///
/// `T` is the schema the model must return; it is extracted type-safely via
/// rig. Returns a `BadRequest` if the provider/key is unconfigured or the model
/// call fails.
pub async fn extract<T>(
    state: &AppState,
    tenant_id: &Uuid,
    preamble: &str,
    prompt: &str,
) -> Result<T, AppError>
where
    T: schemars::JsonSchema + DeserializeOwned + Serialize + Send + Sync + 'static,
{
    use rig::client::CompletionClient as _;
    use rig::providers::anthropic;

    let cfg = resolve_config(state, tenant_id).await?;

    match cfg.provider.as_str() {
        "anthropic" => {
            let client = anthropic::Client::new(&cfg.api_key)
                .map_err(|e| AppError::BadRequest(format!("Failed to create AI client: {e}")))?;
            let extractor = client
                .extractor::<T>(cfg.model.as_str())
                .preamble(preamble)
                .build();
            extractor
                .extract(prompt)
                .await
                .map_err(|e| AppError::BadRequest(format!("AI generation failed: {e}")))
        }
        other => Err(AppError::BadRequest(format!(
            "AI provider '{other}' is not supported by this build"
        ))),
    }
}

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

/// De-identified clinical snapshot injected as grounding — clinical facts only
/// (allergen / drug / diagnosis names), never patient name / UHID / identifiers.
#[derive(Default)]
struct Grounding {
    allergies: Vec<String>,
    medications: Vec<String>,
    diagnoses: Vec<String>,
    labs: Vec<String>,
}

impl Grounding {
    /// Render as a compact context block, or `None` when nothing is known.
    fn as_context(&self) -> Option<String> {
        let mut lines = Vec::new();
        if !self.allergies.is_empty() {
            lines.push(format!("Known allergies: {}", self.allergies.join(", ")));
        }
        if !self.medications.is_empty() {
            lines.push(format!("Active medications: {}", self.medications.join(", ")));
        }
        if !self.diagnoses.is_empty() {
            lines.push(format!("Active problems: {}", self.diagnoses.join(", ")));
        }
        if !self.labs.is_empty() {
            lines.push(format!("Recent lab results: {}", self.labs.join("; ")));
        }
        (!lines.is_empty()).then(|| lines.join("\n"))
    }
}

/// Fetch a patient's allergies, active medications, and active problems, under
/// the caller's RLS. Caller must have already passed the patient-viewer ReBAC.
async fn fetch_patient_grounding(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Grounding, AppError> {
    let allergies = sqlx::query_scalar::<_, String>(
        "SELECT allergen_name FROM patient_allergies \
         WHERE patient_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    let medications = sqlx::query_scalar::<_, String>(
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

    let diagnoses = sqlx::query_scalar::<_, String>(
        "SELECT d.description FROM diagnoses d \
         JOIN encounters e ON e.id = d.encounter_id \
         WHERE e.patient_id = $1 AND d.tenant_id = $2 AND d.resolved_date IS NULL \
         ORDER BY d.created_at DESC LIMIT 15",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    #[derive(sqlx::FromRow)]
    struct LabRow {
        parameter_name: String,
        value: String,
        unit: Option<String>,
        flag: Option<String>,
    }
    let labs = sqlx::query_as::<_, LabRow>(
        "SELECT lr.parameter_name, lr.value, lr.unit, lr.flag::text AS flag \
         FROM lab_results lr JOIN lab_orders lo ON lr.order_id = lo.id \
         WHERE lo.patient_id = $1 AND lr.tenant_id = $2 \
         ORDER BY lr.created_at DESC LIMIT 30",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?
    .into_iter()
    .map(|r| {
        let unit = r.unit.map(|u| format!(" {u}")).unwrap_or_default();
        let flag = r.flag.map(|f| format!(" [{f}]")).unwrap_or_default();
        format!("{}: {}{unit}{flag}", r.parameter_name, r.value)
    })
    .collect();

    Ok(Grounding {
        allergies,
        medications,
        diagnoses,
        labs,
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
    history: Vec<rig::completion::Message>,
    grounded_patient: Option<Uuid>,
    kb_hits: Vec<KbHit>,
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

#[derive(serde::Serialize)]
struct DrugSafetyResult {
    drug: String,
    safe: bool,
    warnings: Vec<String>,
    notes: String,
}

struct DrugSafetyTool {
    db: sqlx::PgPool,
    tenant_id: Uuid,
    department_ids: Vec<Uuid>,
    patient_id: Option<Uuid>,
}

impl DrugSafetyTool {
    /// Run the pharmacy safety engine (allergies + interactions) for one drug,
    /// under the caller's RLS. Read-only.
    async fn evaluate(
        &self,
        drug: &str,
        patient_id: Uuid,
    ) -> Result<Vec<crate::routes::pharmacy::MedicationSafetyWarning>, AppError> {
        let mut tx = self.db.begin().await?;
        medbrains_db::pool::set_full_context(&mut tx, &self.tenant_id, &self.department_ids).await?;
        let items = [crate::routes::pharmacy::MedicationSafetyItem {
            catalog_item_id: None,
            drug_name: drug.to_owned(),
            quantity: 1,
        }];
        let warnings = crate::routes::pharmacy::evaluate_medication_safety_in_tx(
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
    type Output = DrugSafetyResult;

    async fn definition(&self, _prompt: String) -> rig::completion::ToolDefinition {
        rig::completion::ToolDefinition {
            name: Self::NAME.to_owned(),
            description: "Check a proposed drug against the current patient's allergies and drug \
                interactions using the pharmacy safety engine. ALWAYS call this before suggesting or \
                endorsing a medication, and never recommend a drug that returns a warning."
                .to_owned(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "drug": {
                        "type": "string",
                        "description": "Proposed drug (generic or brand name)"
                    }
                },
                "required": ["drug"]
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        let Some(patient_id) = self.patient_id else {
            return Ok(DrugSafetyResult {
                drug: args.drug,
                safe: true,
                warnings: Vec::new(),
                notes: "No patient chart is loaded, so safety cannot be checked — ask the clinician \
                    to open the patient's chart before relying on a drug suggestion."
                    .to_owned(),
            });
        };
        match self.evaluate(&args.drug, patient_id).await {
            Ok(warnings) if warnings.is_empty() => Ok(DrugSafetyResult {
                drug: args.drug,
                safe: true,
                warnings: Vec::new(),
                notes: "No allergy or interaction warnings from the safety engine. Still verify \
                    dosing clinically."
                    .to_owned(),
            }),
            Ok(warnings) => {
                let messages: Vec<String> = warnings
                    .iter()
                    .map(|w| format!("[{:?}] {}", w.severity, w.message))
                    .collect();
                let notes = format!(
                    "SAFETY WARNINGS from the pharmacy engine — do NOT recommend this drug without \
                     resolving these and flagging to the clinician: {}",
                    messages.join("; ")
                );
                Ok(DrugSafetyResult {
                    drug: args.drug,
                    safe: false,
                    warnings: messages,
                    notes,
                })
            }
            Err(_) => Ok(DrugSafetyResult {
                drug: args.drug,
                safe: false,
                warnings: Vec::new(),
                notes: "Could not verify drug safety (system error) — do not rely on an unchecked \
                    recommendation; escalate to the clinician."
                    .to_owned(),
            }),
        }
    }
}

// ── Guarded WRITE-action tool: draft a prescription ──────────────────
// The differentiator's hard edge: the assistant can DRAFT a prescription, but
// the SERVER — not the model — runs the pharmacy safety engine and REFUSES to
// stage it when the engine returns a Block-severity warning (contraindication).
// The block lives in server code, so the model cannot talk its way past it. Both
// the refusal and the staged draft are audited. The AI never creates the order:
// a clean draft is handed to a clinician to sign via the normal workflow.

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
    db: sqlx::PgPool,
    tenant_id: Uuid,
    department_ids: Vec<Uuid>,
    patient_id: Option<Uuid>,
    user_id: Uuid,
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
        medbrains_db::pool::set_full_context(&mut tx, &self.tenant_id, &self.department_ids).await?;
        let items = [crate::routes::pharmacy::MedicationSafetyItem {
            catalog_item_id: None,
            drug_name: drug.to_owned(),
            quantity: 1,
        }];
        let warnings = crate::routes::pharmacy::evaluate_medication_safety_in_tx(
            &mut tx,
            &self.tenant_id,
            &patient_id,
            &items,
        )
        .await?;
        let blocked = warnings.iter().any(|w| {
            matches!(w.severity, crate::routes::pharmacy::MedicationSafetySeverity::Block)
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
    type Output = DraftPrescriptionResult;

    async fn definition(&self, _prompt: String) -> rig::completion::ToolDefinition {
        rig::completion::ToolDefinition {
            name: Self::NAME.to_owned(),
            description: "Draft a prescription for the current patient. The server runs the pharmacy \
                safety engine and REFUSES (decision='blocked') on a contraindication — you cannot \
                override it. On success the draft is staged for a clinician to sign; you never \
                prescribe directly."
                .to_owned(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "drug": { "type": "string", "description": "Drug (generic or brand name)" },
                    "dose": { "type": "string", "description": "Dose/frequency, optional" }
                },
                "required": ["drug"]
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        let Some(patient_id) = self.patient_id else {
            return Ok(DraftPrescriptionResult {
                decision: "no_patient".to_owned(),
                drug: args.drug,
                warnings: Vec::new(),
                message: "No patient chart is loaded — cannot draft a prescription.".to_owned(),
            });
        };
        match self.stage(patient_id, &args.drug, args.dose.as_deref()).await {
            Ok((true, messages)) => Ok(DraftPrescriptionResult {
                decision: "blocked".to_owned(),
                message: format!(
                    "REFUSED by the safety system — this prescription was NOT staged: {}. Do not \
                     recommend it; escalate to the clinician.",
                    messages.join("; ")
                ),
                warnings: messages,
                drug: args.drug,
            }),
            Ok((false, messages)) => Ok(DraftPrescriptionResult {
                decision: "staged".to_owned(),
                message: if messages.is_empty() {
                    "Draft staged for the clinician to review and sign. You have NOT prescribed it."
                        .to_owned()
                } else {
                    format!(
                        "Draft staged with advisories: {}. The clinician must review and sign; you \
                         have NOT prescribed it.",
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
                message: "Could not verify safety — draft NOT staged. Escalate to the clinician."
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
    state: AppState,
    claims: Claims,
}

impl PatientOverviewTool {
    async fn overview(&self, patient_id: Uuid) -> Result<String, AppError> {
        // Same access rule as the grounding gate: admins bypass, others ReBAC.
        let is_admin =
            crate::middleware::authorization::BYPASS_ROLES.contains(&self.claims.role.as_str());
        if !is_admin {
            crate::routes::patients::require_patient_viewer(&self.state, &self.claims, patient_id)
                .await?;
        }
        let mut tx = self.state.db.begin().await?;
        medbrains_db::pool::set_full_context(
            &mut tx,
            &self.claims.tenant_id,
            &self.claims.department_ids,
        )
        .await?;
        let grounding = fetch_patient_grounding(&mut tx, self.claims.tenant_id, patient_id).await?;
        drop(tx);
        Ok(grounding.as_context().unwrap_or_else(|| {
            "This patient has no recorded allergies, active medications, active problems, or recent \
             lab results."
                .to_owned()
        }))
    }
}

impl rig::tool::Tool for PatientOverviewTool {
    const NAME: &'static str = "get_patient_overview";
    type Error = std::convert::Infallible;
    type Args = PatientOverviewArgs;
    type Output = String;

    async fn definition(&self, _prompt: String) -> rig::completion::ToolDefinition {
        rig::completion::ToolDefinition {
            name: Self::NAME.to_owned(),
            description: "Fetch a patient's allergies, active medications, active problems, and \
                recent lab results. Call this with the patient_id from the screen context whenever \
                the user asks about the patient — never ask the user to provide this data."
                .to_owned(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "patient_id": {
                        "type": "string",
                        "description": "The patient's id from the screen context"
                    }
                },
                "required": ["patient_id"]
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        let Ok(pid) = Uuid::parse_str(&args.patient_id) else {
            return Ok("Invalid patient id.".to_owned());
        };
        Ok(match self.overview(pid).await {
            Ok(text) => text,
            Err(_) => {
                "You do not have access to this patient, or their data could not be loaded."
                    .to_owned()
            }
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
    state: AppState,
    claims: Claims,
}

impl CallApiTool {
    async fn get(&self, path: &str) -> Result<String, AppError> {
        if !CALL_API_ALLOWLIST.iter().any(|p| path.starts_with(p)) {
            return Ok(format!("Path '{path}' is not permitted for the assistant."));
        }
        let router = AI_ROUTER
            .get()
            .ok_or_else(|| AppError::Internal("router unavailable".to_owned()))?
            .clone();
        // Mint a token for the caller so the request goes through the real auth path.
        let token = crate::middleware::auth::encode_jwt(&self.claims, &self.state.jwt_encoding_key)
            .map_err(|_| AppError::Internal("token mint failed".to_owned()))?;
        let request = axum::http::Request::builder()
            .method(axum::http::Method::GET)
            .uri(path)
            .header(axum::http::header::AUTHORIZATION, format!("Bearer {token}"))
            .body(axum::body::Body::empty())
            .map_err(|_| AppError::BadRequest("invalid path".to_owned()))?;
        use tower::ServiceExt as _;
        let response = match router.oneshot(request).await {
            Ok(r) => r,
            Err(never) => match never {},
        };
        let status = response.status().as_u16();
        let bytes = axum::body::to_bytes(response.into_body(), 256 * 1024)
            .await
            .map_err(|_| AppError::Internal("read body failed".to_owned()))?;
        Ok(format!("HTTP {status}\n{}", String::from_utf8_lossy(&bytes)))
    }
}

impl rig::tool::Tool for CallApiTool {
    const NAME: &'static str = "call_api";
    type Error = std::convert::Infallible;
    type Args = CallApiArgs;
    type Output = String;

    async fn definition(&self, _prompt: String) -> rig::completion::ToolDefinition {
        rig::completion::ToolDefinition {
            name: Self::NAME.to_owned(),
            description: "Fetch data from any MedBrains read API (GET). Runs with your own \
                permissions, so you can only read what you're allowed to — prefer this over asking \
                the user. Clinical domains: patients, opd, lab, pharmacy, ipd, radiology, \
                blood-bank, emergency, nurse, ot, chronic-care, cds. Operational: billing, \
                insurance, indent, procurement, hr, scheduling, quality, facilities, front-office. \
                Examples: GET /api/patients/{id} · /api/patients/{id}/allergies · \
                /api/patients/{id}/lab-orders · /api/lab/orders/{orderId}/results · \
                /api/billing/invoices/{id}. Hit a collection endpoint first to discover ids, e.g. \
                GET /api/billing/invoices?patient_id={id}."
                .to_owned(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "GET path, e.g. /api/patients/<id>/allergies"
                    }
                },
                "required": ["path"]
            }),
        }
    }

    async fn call(&self, args: Self::Args) -> Result<Self::Output, Self::Error> {
        Ok(match self.get(&args.path).await {
            Ok(text) => text,
            Err(e) => format!("Error calling {}: {e}", args.path),
        })
    }
}

/// The boxed SSE body type — one alias so both provider branches unify.
type SseBody = std::pin::Pin<
    Box<dyn Stream<Item = Result<Event, std::convert::Infallible>> + Send>,
>;

/// One SSE frame carrying a JSON payload; falls back to `{}` if serialisation
/// somehow fails (avoids `unwrap`, which clippy denies).
// The `Result<_, Infallible>` wrap is required: it is the `Sse` stream item type.
#[allow(clippy::unnecessary_wraps)]
fn sse(payload: &serde_json::Value) -> Result<Event, std::convert::Infallible> {
    Ok(Event::default()
        .json_data(payload)
        .unwrap_or_else(|_| Event::default().data("{}")))
}

/// Resolve the grounded patient (ReBAC), persist the user turn, and load prior
/// history + de-identified grounding — all under one RLS transaction. Returns
/// `(conversation_id, rig history, grounding, grounded_patient)`.
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
    // Admins bypass every other check, so they bypass the patient-viewer gate too
    // (otherwise a missing SpiceDB relation silently drops grounding for them).
    let is_admin = crate::middleware::authorization::BYPASS_ROLES.contains(&claims.role.as_str());
    let grounded_patient = match patient_id {
        Some(pid)
            if is_admin
                || crate::routes::patients::require_patient_viewer(state, claims, pid)
                    .await
                    .is_ok() =>
        {
            Some(pid)
        }
        _ => None,
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &tenant_id, &claims.department_ids).await?;

    let conversation_id = match req.conversation_id {
        Some(id) => {
            let owner = sqlx::query_scalar::<_, Uuid>(
                "SELECT owner_user_id FROM ai_conversations WHERE id = $1 AND tenant_id = $2",
            )
            .bind(id)
            .bind(tenant_id)
            .fetch_optional(&mut *tx)
            .await?;
            match owner {
                Some(o) if o == claims.sub => id,
                Some(_) => return Err(AppError::Forbidden),
                None => return Err(AppError::BadRequest("conversation not found".to_owned())),
            }
        }
        None => {
            let title: String = message.chars().take(60).collect();
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO ai_conversations (tenant_id, owner_user_id, title, model) \
                 VALUES ($1, $2, $3, $4) RETURNING id",
            )
            .bind(tenant_id)
            .bind(claims.sub)
            .bind(&title)
            .bind(&cfg.model)
            .fetch_one(&mut *tx)
            .await?
        }
    };

    let history_rows = sqlx::query_as::<_, HistoryRow>(
        "SELECT role, content FROM ai_messages \
         WHERE conversation_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(conversation_id)
    .bind(tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let kb_hits = retrieve_kb(&mut tx, message).await?;

    sqlx::query(
        "INSERT INTO ai_messages (tenant_id, conversation_id, role, content) \
         VALUES ($1, $2, 'user', $3)",
    )
    .bind(tenant_id)
    .bind(conversation_id)
    .bind(message)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    let history = history_rows
        .into_iter()
        .map(|r| match r.role.as_str() {
            "assistant" => rig::completion::Message::assistant(r.content),
            _ => rig::completion::Message::user(r.content),
        })
        .collect();

    Ok(PreparedTurn {
        conversation_id,
        history,
        grounded_patient,
        kb_hits,
    })
}

/// Compose the turn preamble: system prompt + the generic screen context (the
/// ids of whatever the user is viewing) + knowledge-base references. Data for
/// those ids is fetched on demand by the assistant's tools, not pre-injected.
fn build_preamble(context: Option<&serde_json::Value>, kb_hits: &[KbHit]) -> String {
    let mut parts: Vec<String> = Vec::new();
    if let Some(ctx) = context.filter(|c| !c.is_null()) {
        parts.push(format!(
            "Current screen context (the record ids the user is viewing) — {ctx}\n\
             Use your tools to fetch details for these ids rather than asking the user for data."
        ));
    }
    if !kb_hits.is_empty() {
        let refs: Vec<String> = kb_hits
            .iter()
            .map(|h| {
                format!("- {} [{}]: {}", h.term, h.source_name, h.snippet.as_deref().unwrap_or(""))
            })
            .collect();
        parts.push(format!(
            "Knowledge-base references (cite these by name when you use them) —\n{}",
            refs.join("\n")
        ));
    }
    if parts.is_empty() {
        SYSTEM_PROMPT.to_owned()
    } else {
        format!("{SYSTEM_PROMPT}\n\n{}", parts.join("\n\n"))
    }
}

pub async fn chat(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<ChatRequest>,
) -> Result<Sse<axum::response::sse::KeepAliveStream<SseBody>>, AppError> {
    let message = req.message.trim().to_owned();
    if message.is_empty() {
        return Err(AppError::BadRequest("message must not be empty".to_owned()));
    }

    let cfg = resolve_config(&state, &claims.tenant_id).await?;
    if !cfg.enabled {
        return Err(AppError::Forbidden);
    }

    let PreparedTurn {
        conversation_id,
        history,
        grounded_patient,
        kb_hits,
    } = open_turn(&state, &claims, &req, &cfg, &message).await?;
    let tenant_id = claims.tenant_id;

    let preamble = build_preamble(req.context.as_ref(), &kb_hits);

    use rig::client::CompletionClient as _;
    let boxed: SseBody = match cfg.provider.as_str() {
        "anthropic" => {
            let client = rig::providers::anthropic::Client::new(&cfg.api_key)
                .map_err(|e| AppError::BadRequest(format!("AI client error: {e}")))?;
            let agent = client
                .agent(cfg.model.as_str())
                .preamble(preamble.as_str())
                .tool(DrugSafetyTool {
                    db: state.db.clone(),
                    tenant_id,
                    department_ids: claims.department_ids.clone(),
                    patient_id: grounded_patient,
                })
                .tool(DraftPrescriptionTool {
                    db: state.db.clone(),
                    tenant_id,
                    department_ids: claims.department_ids.clone(),
                    patient_id: grounded_patient,
                    user_id: claims.sub,
                })
                .tool(PatientOverviewTool {
                    state: state.clone(),
                    claims: claims.clone(),
                })
                .tool(CallApiTool {
                    state: state.clone(),
                    claims: claims.clone(),
                })
                .build();
            Box::pin(run_turn(
                agent,
                message,
                history,
                state,
                tenant_id,
                conversation_id,
                kb_hits,
            ))
        }
        "openrouter" => {
            let client = rig::providers::openrouter::Client::new(&cfg.api_key)
                .map_err(|e| AppError::BadRequest(format!("AI client error: {e}")))?;
            let agent = client
                .agent(cfg.model.as_str())
                .preamble(preamble.as_str())
                .tool(DrugSafetyTool {
                    db: state.db.clone(),
                    tenant_id,
                    department_ids: claims.department_ids.clone(),
                    patient_id: grounded_patient,
                })
                .tool(DraftPrescriptionTool {
                    db: state.db.clone(),
                    tenant_id,
                    department_ids: claims.department_ids.clone(),
                    patient_id: grounded_patient,
                    user_id: claims.sub,
                })
                .tool(PatientOverviewTool {
                    state: state.clone(),
                    claims: claims.clone(),
                })
                .tool(CallApiTool {
                    state: state.clone(),
                    claims: claims.clone(),
                })
                .build();
            Box::pin(run_turn(
                agent,
                message,
                history,
                state,
                tenant_id,
                conversation_id,
                kb_hits,
            ))
        }
        "ollama" => {
            // Local, keyless inference — no PHI leaves the machine.
            let base = std::env::var("OLLAMA_API_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:11434".to_owned());
            let client = rig::providers::ollama::Client::builder()
                .api_key(rig::client::Nothing)
                .base_url(&base)
                .build()
                .map_err(|e| AppError::BadRequest(format!("Ollama client error: {e}")))?;
            let agent = client
                .agent(cfg.model.as_str())
                .preamble(preamble.as_str())
                .tool(DrugSafetyTool {
                    db: state.db.clone(),
                    tenant_id,
                    department_ids: claims.department_ids.clone(),
                    patient_id: grounded_patient,
                })
                .tool(DraftPrescriptionTool {
                    db: state.db.clone(),
                    tenant_id,
                    department_ids: claims.department_ids.clone(),
                    patient_id: grounded_patient,
                    user_id: claims.sub,
                })
                .tool(PatientOverviewTool {
                    state: state.clone(),
                    claims: claims.clone(),
                })
                .tool(CallApiTool {
                    state: state.clone(),
                    claims: claims.clone(),
                })
                .build();
            Box::pin(run_turn(
                agent,
                message,
                history,
                state,
                tenant_id,
                conversation_id,
                kb_hits,
            ))
        }
        other => {
            return Err(AppError::BadRequest(format!(
                "AI provider '{other}' does not support streaming chat in this build"
            )));
        }
    };

    // Heartbeat comments (default 15s) keep the connection alive through idle
    // gaps + proxy idle-timeouts (nginx/ALB) so a slow first token isn't dropped.
    Ok(Sse::new(boxed).keep_alive(KeepAlive::default()))
}

/// Stream one assistant turn from a built agent (provider-agnostic) and persist
/// the result. Generic so anthropic + openrouter share the exact same loop.
fn run_turn<M, P>(
    agent: rig::agent::Agent<M, P>,
    message: String,
    history: Vec<rig::completion::Message>,
    state: AppState,
    tenant_id: Uuid,
    conversation_id: Uuid,
    kb_hits: Vec<KbHit>,
) -> impl Stream<Item = Result<Event, std::convert::Infallible>>
where
    M: rig::completion::CompletionModel + 'static,
    M::StreamingResponse: rig::completion::GetTokenUsage,
    P: rig::agent::PromptHook<M> + 'static,
{
    use rig::agent::MultiTurnStreamItem;
    use rig::streaming::{StreamedAssistantContent, StreamedUserContent, StreamingPrompt as _};

    async_stream::stream! {
        // Emit the retrieved KB entries as grounding sources (cited in the UI).
        for (i, hit) in kb_hits.iter().enumerate() {
            yield sse(&serde_json::json!({
                "type": "source",
                "source": {
                    "id": format!("kb-{i}"),
                    "title": hit.term,
                    "url": hit.source_url,
                    "snippet": hit.snippet,
                }
            }));
        }

        let mut answer = String::new();
        // multi_turn > 0 is REQUIRED for the tool loop — rig defaults to 0
        // ("one round-trip"), which errors after the first tool call.
        let mut chunks = agent
            .stream_prompt(message.as_str())
            .multi_turn(8)
            .with_history(history)
            .await;
        while let Some(item) = chunks.next().await {
            match item {
                Ok(MultiTurnStreamItem::StreamAssistantItem(StreamedAssistantContent::Text(t))) => {
                    answer.push_str(&t.text);
                    yield sse(&serde_json::json!({ "type": "text", "text": t.text }));
                }
                Ok(MultiTurnStreamItem::StreamAssistantItem(StreamedAssistantContent::ToolCall {
                    tool_call,
                    internal_call_id,
                })) => {
                    // Surface the guard the assistant is running.
                    yield sse(&serde_json::json!({
                        "type": "tool",
                        "toolCall": {
                            "id": internal_call_id,
                            "name": tool_call.function.name,
                            "args": tool_call.function.arguments,
                            "status": "running"
                        }
                    }));
                }
                Ok(MultiTurnStreamItem::StreamUserItem(StreamedUserContent::ToolResult {
                    tool_result,
                    internal_call_id,
                })) => {
                    // The tool's JSON output (e.g. a block decision) → to the UI.
                    let text = tool_result.content.iter().find_map(|c| match c {
                        rig::completion::message::ToolResultContent::Text(t) => Some(t.text.clone()),
                        rig::completion::message::ToolResultContent::Image(_) => None,
                    });
                    // Tool output may be JSON (a decision) or a plain string —
                    // fall back to the raw text so the UI never shows null.
                    let result: Option<serde_json::Value> = text.map(|t| {
                        serde_json::from_str(&t).unwrap_or(serde_json::Value::String(t))
                    });
                    yield sse(&serde_json::json!({
                        "type": "tool_result",
                        "id": internal_call_id,
                        "result": result
                    }));
                }
                Ok(_) => {}
                Err(e) => {
                    yield sse(&serde_json::json!({ "type": "error", "message": e.to_string() }));
                }
            }
        }

        // Persist the assistant turn + bump the conversation timestamp.
        match state.db.begin().await {
            Ok(tx) => {
                if let Err(e) = persist_assistant_turn(tx, &tenant_id, conversation_id, &answer).await {
                    tracing::error!(error = %e, "failed to persist assistant turn");
                }
            }
            Err(e) => tracing::error!(error = %e, "failed to open tx for assistant turn"),
        }

        yield sse(&serde_json::json!({ "type": "done", "conversationId": conversation_id }));
    }
}

/// Write the completed assistant message and touch the conversation, under RLS.
async fn persist_assistant_turn(
    mut tx: sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    conversation_id: Uuid,
    answer: &str,
) -> Result<(), AppError> {
    medbrains_db::pool::set_tenant_context(&mut tx, tenant_id).await?;
    sqlx::query(
        "INSERT INTO ai_messages (tenant_id, conversation_id, role, content) \
         VALUES ($1, $2, 'assistant', $3)",
    )
    .bind(tenant_id)
    .bind(conversation_id)
    .bind(answer)
    .execute(&mut *tx)
    .await?;
    sqlx::query("UPDATE ai_conversations SET last_message_at = now() WHERE id = $1 AND tenant_id = $2")
        .bind(conversation_id)
        .bind(tenant_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(())
}

// ── Proactive whispers (step 1: critical-value SSE) ──────────────────
// A long-lived SSE the assistant UI subscribes to; it surfaces newly-fired,
// unacknowledged critical lab values (post-commit, polled) as "whispers". Rides
// the normal auth/RLS middleware; tenant-scoped. ponytail: polling (~10s) for a
// simple, reliable first version — a push bus off the outbox worker is the
// upgrade path. Per-patient access filtering is a later refinement.

#[derive(sqlx::FromRow)]
struct CriticalAlertRow {
    patient_id: Uuid,
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

struct Whisper {
    created_at: chrono::DateTime<chrono::Utc>,
    payload: serde_json::Value,
}

/// Poll the committed alert tables for whisper-worthy events fired since `since`:
/// critical lab values + emergency-code activations. Tenant-scoped under RLS.
async fn fetch_new_whispers(
    state: &AppState,
    tenant_id: Uuid,
    since: chrono::DateTime<chrono::Utc>,
) -> Result<Vec<Whisper>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;

    let mut out: Vec<Whisper> = Vec::new();

    let alerts = sqlx::query_as::<_, CriticalAlertRow>(
        "SELECT patient_id, parameter_name, value, flag::text AS flag, created_at \
         FROM lab_critical_alerts \
         WHERE tenant_id = $1 AND created_at > $2 AND acknowledged_at IS NULL \
         ORDER BY created_at LIMIT 20",
    )
    .bind(tenant_id)
    .bind(since)
    .fetch_all(&mut *tx)
    .await?;
    for a in alerts {
        out.push(Whisper {
            created_at: a.created_at,
            payload: serde_json::json!({
                "type": "whisper", "severity": "critical", "kind": "critical_lab_value",
                "title": "Critical lab value",
                "message": format!("{} = {} [{}]", a.parameter_name, a.value, a.flag),
                "patientId": a.patient_id,
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

pub async fn whispers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl axum::response::IntoResponse {
    let tenant_id = claims.tenant_id;
    let stream = async_stream::stream! {
        // Only surface alerts that fire AFTER the stream opens.
        let mut since = chrono::Utc::now();
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(10)).await;
            let whispers = match fetch_new_whispers(&state, tenant_id, since).await {
                Ok(w) => w,
                Err(e) => {
                    tracing::warn!(error = %e, "whisper poll failed");
                    Vec::new()
                }
            };
            for whisper in whispers {
                if whisper.created_at > since {
                    since = whisper.created_at;
                }
                yield sse(&whisper.payload);
            }
        }
    };
    Sse::new(stream).keep_alive(KeepAlive::default())
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
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, ConversationSummary>(
        "SELECT id, title, last_message_at FROM ai_conversations \
         WHERE tenant_id = $1 AND owner_user_id = $2 AND archived_at IS NULL \
         ORDER BY last_message_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// Messages of one conversation — owner-checked, so a thread only reopens for
/// its owner (sharing is a later phase).
pub async fn conversation_messages(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<ConversationMessage>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let owner = sqlx::query_scalar::<_, Uuid>(
        "SELECT owner_user_id FROM ai_conversations WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    match owner {
        Some(o) if o == claims.sub => {}
        Some(_) => return Err(AppError::Forbidden),
        None => return Err(AppError::BadRequest("conversation not found".to_owned())),
    }

    let rows = sqlx::query_as::<_, ConversationMessage>(
        "SELECT id, role, content, created_at FROM ai_messages \
         WHERE conversation_id = $1 AND tenant_id = $2 ORDER BY created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

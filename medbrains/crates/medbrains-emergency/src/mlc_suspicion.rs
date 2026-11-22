//! A possible medico-legal case, waiting for a doctor.
//!
//! A complaint that reads like one ("road traffic accident", "assault") never
//! blocks the visit or the triage: whoever is at the desk saves, the visit is
//! marked `suspected`, and a holder of `emergency.mlc.review_suspected`
//! confirms it (registering the MLC case) or dismisses it with a reason.
//! Nothing here registers an MLC from text alone.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::emergency::ErVisit;
use medbrains_core::permissions;
use medbrains_db::audit::{AuditEntry, AuditLogger};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DecideSuspectedMlcRequest {
    /// `confirm` or `dismiss`.
    pub decision: String,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SuspectedMlcDecision {
    pub visit_id: Uuid,
    pub mlc_suspicion: String,
    pub is_mlc: bool,
    pub mlc_case_id: Option<Uuid>,
}

/// What a visit carries about a possible medico-legal case. `mlc_suspicion`
/// is `suspected` until a doctor decides, then `confirmed` or `dismissed`;
/// `None` means the complaint never raised the question.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MlcSuspicion {
    pub mlc_suspicion: Option<String>,
    pub mlc_suspected_type: Option<String>,
    pub mlc_suspicion_reason: Option<String>,
    pub mlc_suspicion_decided_by: Option<Uuid>,
    pub mlc_suspicion_decided_at: Option<DateTime<Utc>>,
}

/// An ER visit as the list and the visit page read it: the row and its
/// medico-legal suspicion, as one flat object.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ErVisitView {
    #[sqlx(flatten)]
    #[serde(flatten)]
    pub visit: ErVisit,
    #[sqlx(flatten)]
    #[serde(flatten)]
    pub mlc: MlcSuspicion,
}

impl ErVisitView {
    /// The visit as this caller may see it. A caller without the full ER
    /// view still sees that a decision is pending, but not the doctor's
    /// reason or name.
    pub(crate) fn for_caller(mut self, claims: &Claims) -> Self {
        if !super::can_view_full_er_visit(claims) {
            self.mlc.mlc_suspicion_reason = None;
            self.mlc.mlc_suspicion_decided_by = None;
        }
        self.visit = super::filter_er_visit_response(self.visit, claims);
        self
    }
}

/// Writes one row to the hash-chained audit log about a visit's MLC suspicion.
async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    visit_id: Uuid,
    action: &str,
    new_values: serde_json::Value,
) -> Result<(), AppError> {
    let entry = AuditEntry {
        tenant_id: claims.tenant_id,
        user_id: Some(claims.sub),
        action,
        entity_type: "er_visit",
        entity_id: Some(visit_id),
        old_values: None,
        new_values: Some(&new_values),
        ip_address: None,
    };
    Ok(AuditLogger::log(tx, &entry).await?)
}

/// Marks a visit as a possible medico-legal case because its complaint text
/// matched, and records who was saving and that the inference fired. A visit
/// that is already an MLC, or whose suspicion was already raised or decided,
/// is left alone, so a later triage cannot reopen a doctor's dismissal.
pub(crate) async fn flag_suspected(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    visit_id: Uuid,
    case_type: &str,
    source: &str,
) -> Result<(), AppError> {
    let flagged = sqlx::query!(
        "UPDATE er_visits
            SET mlc_suspicion = 'suspected', mlc_suspected_type = $3, updated_at = now()
          WHERE id = $1 AND tenant_id = $2 AND is_mlc = false AND mlc_suspicion IS NULL",
        visit_id,
        claims.tenant_id,
        case_type,
    )
    .execute(&mut **tx)
    .await?
    .rows_affected();
    if flagged == 0 {
        return Ok(());
    }
    let new = json!({ "mlc_suspicion": "suspected", "case_type": case_type,
        "inferred_from": "complaint_text", "saved_on": source });
    audit(tx, claims, visit_id, "er_visit.mlc_suspected", new).await
}

/// The patient's newest open ER visit that has no MLC case yet.
async fn open_visit_without_case(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    let visit_id = sqlx::query_scalar!(
        "SELECT v.id FROM er_visits v
          WHERE v.tenant_id = $1 AND v.patient_id = $2 AND v.deleted_at IS NULL
            AND v.status IN ('registered', 'triaged', 'in_treatment', 'observation')
            AND NOT EXISTS (SELECT 1 FROM mlc_cases m
                             WHERE m.er_visit_id = v.id AND m.tenant_id = v.tenant_id)
          ORDER BY v.arrival_time DESC LIMIT 1",
        tenant_id,
        patient_id,
    )
    .fetch_optional(&mut **tx)
    .await?;
    Ok(visit_id)
}

/// The MLC case registered on a visit, if there is one.
async fn case_on_visit(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    visit_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    let case_id = sqlx::query_scalar!(
        "SELECT id FROM mlc_cases WHERE er_visit_id = $1 AND tenant_id = $2 LIMIT 1",
        visit_id,
        tenant_id,
    )
    .fetch_optional(&mut **tx)
    .await?;
    Ok(case_id)
}

/// The ER visit a new MLC case belongs to: the one the caller named, or, when
/// none was named (the MLC tab names none), the patient's newest open ER
/// visit that has no case yet. Marks it as MLC and settles a pending
/// suspicion as confirmed by `decided_by`.
pub(crate) async fn link_case_to_visit(
    tx: &mut Transaction<'_, Postgres>,
    (tenant_id, decided_by): (Uuid, Uuid),
    named: Option<Uuid>,
    patient_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    let visit_id = if let Some(id) = named {
        super::ensure_er_visit_matches_patient(tx, tenant_id, id, patient_id).await?;
        if case_on_visit(tx, tenant_id, id).await?.is_some() {
            return Err(AppError::Conflict(
                "An MLC case is already linked to this ER visit".to_owned(),
            ));
        }
        id
    } else if let Some(id) = open_visit_without_case(tx, tenant_id, patient_id).await? {
        id
    } else {
        return Ok(None);
    };
    sqlx::query!(
        "UPDATE er_visits
            SET is_mlc = true, updated_at = now(),
                mlc_suspicion_decided_by = CASE WHEN mlc_suspicion = 'suspected' THEN $3
                                                ELSE mlc_suspicion_decided_by END,
                mlc_suspicion_decided_at = CASE WHEN mlc_suspicion = 'suspected' THEN now()
                                                ELSE mlc_suspicion_decided_at END,
                mlc_suspicion = CASE WHEN mlc_suspicion = 'suspected' THEN 'confirmed'
                                     ELSE mlc_suspicion END
          WHERE id = $1 AND tenant_id = $2",
        visit_id,
        tenant_id,
        decided_by,
    )
    .execute(&mut **tx)
    .await?;
    Ok(Some(visit_id))
}

/// Confirm (`true`) or dismiss (`false`), with the reason a dismissal must carry.
fn parse_decision(body: &DecideSuspectedMlcRequest) -> Result<(bool, Option<&str>), AppError> {
    let reason = body
        .reason
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty());
    match (body.decision.as_str(), reason) {
        ("confirm", reason) => Ok((true, reason)),
        ("dismiss", Some(reason)) => Ok((false, Some(reason))),
        ("dismiss", None) => Err(AppError::BadRequest(
            "Say why this is not a medico-legal case. The reason is kept on the record.".to_owned(),
        )),
        _ => Err(AppError::BadRequest(
            "decision must be confirm or dismiss".to_owned(),
        )),
    }
}

/// Settles a pending suspicion inside the caller's transaction: stores the
/// decision on the visit, registers the MLC case when confirmed, and audits
/// it. A visit with no suspicion pending answers 409.
async fn record_decision(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    visit_id: Uuid,
    confirm: bool,
    reason: Option<&str>,
) -> Result<SuspectedMlcDecision, AppError> {
    let outcome = if confirm { "confirmed" } else { "dismissed" };
    let visit = sqlx::query!(
        "UPDATE er_visits
            SET mlc_suspicion = $3, mlc_suspicion_reason = $4, mlc_suspicion_decided_by = $5,
                mlc_suspicion_decided_at = now(), is_mlc = $6, updated_at = now()
          WHERE id = $1 AND tenant_id = $2 AND mlc_suspicion = 'suspected'
      RETURNING patient_id, mlc_suspected_type, chief_complaint, notes",
        visit_id,
        claims.tenant_id,
        outcome,
        reason,
        claims.sub,
        confirm,
    )
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| {
        AppError::Conflict("This visit has no possible MLC waiting for a decision".to_owned())
    })?;
    let mlc_case_id = if confirm {
        let case_type = visit.mlc_suspected_type.as_deref();
        let history = visit.chief_complaint.as_deref().or(visit.notes.as_deref());
        super::auto_create_mlc_case_for_visit(
            tx,
            &claims.tenant_id,
            visit_id,
            visit.patient_id,
            claims.sub,
            case_type.unwrap_or("medico_legal"),
            history,
        )
        .await?;
        case_on_visit(tx, claims.tenant_id, visit_id).await?
    } else {
        None
    };
    let new = json!({ "mlc_suspicion": outcome, "reason": reason, "mlc_case_id": mlc_case_id });
    let action = format!("er_visit.mlc_suspicion_{outcome}");
    audit(tx, claims, visit_id, &action, new).await?;
    Ok(SuspectedMlcDecision {
        visit_id,
        mlc_suspicion: outcome.to_owned(),
        is_mlc: confirm,
        mlc_case_id,
    })
}

/// PUT /api/emergency/visits/{id}/mlc-suspicion: a doctor decides a possible MLC.
///
/// Confirming registers the MLC case on that visit; dismissing keeps the
/// reason. Either way the decision is audited, and a visit with nothing
/// pending answers 409.
pub async fn decide_suspected_mlc(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(visit_id): Path<Uuid>,
    Json(body): Json<DecideSuspectedMlcRequest>,
) -> Result<Json<SuspectedMlcDecision>, AppError> {
    require_permission(&claims, permissions::emergency::mlc::REVIEW_SUSPECTED)?;
    let (confirm, reason) = parse_decision(&body)?;
    if confirm {
        // Confirming files a medico-legal case, the act emergency.mlc.create guards.
        require_permission(&claims, permissions::emergency::mlc::CREATE)?;
    }
    let link = medbrains_authz_gate::links::ER_VISIT;
    medbrains_authz_gate::require_access_via(&state, &claims, link, visit_id).await?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let decision = record_decision(&mut tx, &claims, visit_id, confirm, reason).await?;
    tx.commit().await?;
    Ok(Json(decision))
}

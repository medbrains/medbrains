//! Antimicrobial stewardship and the formulary, at the moment of prescribing.
//!
//! A WHO AWaRe Reserve antibiotic needs an antimicrobial stewardship request
//! (NABH AMS, ICMR AMSP): the prescriber states the indication, the request is
//! raised here as `pending`, and the pharmacy dispenses once the stewardship
//! team approves it — `medbrains_pharmacy::rx_safety` holds that line. A
//! non-formulary medicine needs the prescriber's justification, filed to audit;
//! the pharmacy then needs formulary approval to dispense it.

use axum::extract::{Path, State};
use axum::{Extension, Json};
use chrono::NaiveDate;
use medbrains_core::permissions;
use medbrains_pharmacy::MedicationSafetyWarning;
use medbrains_pharmacy::rx_safety::{self, RxLine};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_any_permission;
use medbrains_server_core::state::AppState;
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::PrescriptionItemInput;

/// One prescription being written or edited, and the prescriber's answers.
/// Shared by OPD prescribing and the CPOE order basket.
pub struct RxPolicy<'a> {
    pub patient_id: Uuid,
    pub doctor_id: Uuid,
    pub prescription_id: Uuid,
    pub items: &'a [PrescriptionItemInput],
    pub stewardship_indication: Option<&'a str>,
    pub non_formulary_reason: Option<&'a str>,
}

fn given(text: Option<&str>) -> Option<&str> {
    text.map(str::trim).filter(|t| !t.is_empty())
}

fn drug_list(findings: &[&MedicationSafetyWarning]) -> String {
    findings
        .iter()
        .map(|f| f.drug_name.as_str())
        .collect::<Vec<_>>()
        .join(", ")
}

/// Reserve lines with no live (pending or approved) request for this patient.
fn unrequested_reserve(findings: &[MedicationSafetyWarning]) -> Vec<&MedicationSafetyWarning> {
    findings
        .iter()
        .filter(|f| {
            f.code == rx_safety::RESERVE_ANTIBIOTIC
                && f.detail
                    .get("request_status")
                    .is_none_or(serde_json::Value::is_null)
        })
        .collect()
}

/// Refuse a Reserve antibiotic without an indication and a non-formulary
/// medicine without a reason; with them, raise the stewardship request and file
/// the justification. Runs inside the prescription's transaction, so a refusal
/// leaves nothing behind.
pub async fn enforce_rx_policy(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    policy: &RxPolicy<'_>,
) -> Result<(), AppError> {
    let lines: Vec<RxLine> = policy
        .items
        .iter()
        .map(|i| RxLine {
            drug_name: i.drug_name.clone(),
            catalog_item_id: i.catalog_item_id,
        })
        .collect();
    let findings =
        rx_safety::policy_findings_in_tx(tx, claims.tenant_id, policy.patient_id, &lines).await?;
    let reserve = unrequested_reserve(&findings);
    let non_formulary: Vec<&MedicationSafetyWarning> = findings
        .iter()
        .filter(|f| f.code == rx_safety::NON_FORMULARY)
        .collect();

    let indication = given(policy.stewardship_indication);
    if !reserve.is_empty() && indication.is_none() {
        return Err(AppError::Conflict(format!(
            "{} is an AWaRe Reserve antibiotic. State the indication (organism, culture sent, \
             why an Access or Watch agent will not do) to raise an antimicrobial stewardship \
             request; the pharmacy dispenses it once the request is approved.",
            drug_list(&reserve)
        )));
    }
    let justification = given(policy.non_formulary_reason);
    if !non_formulary.is_empty() && justification.is_none() {
        return Err(AppError::Conflict(format!(
            "{} is not on the hospital formulary. Give the clinical reason for prescribing it; \
             the pharmacy needs formulary approval before dispensing.",
            drug_list(&non_formulary)
        )));
    }

    if let Some(indication) = indication.filter(|_| !reserve.is_empty()) {
        let mut request_ids = Vec::with_capacity(reserve.len());
        for finding in &reserve {
            request_ids
                .push(raise_stewardship_request(tx, claims, policy, finding, indication).await?);
        }
        audit(
            tx,
            claims,
            policy.prescription_id,
            "prescription.stewardship_requested",
            &serde_json::json!({
                "prescription_id": policy.prescription_id,
                "indication": indication,
                "antibiotics": drug_list(&reserve),
                "stewardship_request_ids": request_ids,
            }),
        )
        .await?;
    }
    if let Some(reason) = justification.filter(|_| !non_formulary.is_empty()) {
        audit(
            tx,
            claims,
            policy.prescription_id,
            "prescription.non_formulary_justified",
            &serde_json::json!({
                "prescription_id": policy.prescription_id,
                "reason": reason,
                "medicines": drug_list(&non_formulary),
            }),
        )
        .await?;
    }
    Ok(())
}

/// A pending request in the stewardship team's queue, named by the active
/// ingredient so the pharmacy's check finds it whatever the brand.
async fn raise_stewardship_request(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    policy: &RxPolicy<'_>,
    finding: &MedicationSafetyWarning,
    indication: &str,
) -> Result<Uuid, AppError> {
    let line = policy
        .items
        .iter()
        .find(|i| i.drug_name == finding.drug_name);
    let antibiotic = finding
        .detail
        .get("ingredient")
        .and_then(serde_json::Value::as_str)
        .unwrap_or(finding.drug_name.as_str());
    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO antibiotic_stewardship_requests \
           (tenant_id, patient_id, antibiotic_name, dose, route, frequency, indication, \
            requested_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(policy.patient_id)
    .bind(antibiotic)
    .bind(line.map(|l| l.dosage.as_str()))
    .bind(line.and_then(|l| l.route.as_deref()))
    .bind(line.map(|l| l.frequency.as_str()))
    .bind(indication)
    .bind(policy.doctor_id)
    .fetch_one(&mut **tx)
    .await?;
    Ok(id)
}

async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    prescription_id: Uuid,
    action: &str,
    values: &serde_json::Value,
) -> Result<(), AppError> {
    medbrains_db::audit::AuditLogger::log(
        tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type: "prescription",
            entity_id: Some(prescription_id),
            old_values: None,
            new_values: Some(values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

/// A stewardship request that still counts: pending or approved, not expired.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LiveStewardshipRequest {
    pub id: Uuid,
    pub antibiotic_name: String,
    pub request_status: String,
    pub auto_stop_date: Option<NaiveDate>,
}

/// `GET /api/opd/patients/{id}/stewardship-requests` — the patient's live
/// antimicrobial stewardship requests, so the prescription writer asks for an
/// indication only when the server will.
pub async fn list_live_stewardship_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<LiveStewardshipRequest>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::visit::UPDATE,
            permissions::nurse::prescriptions::DRAFT,
        ],
    )?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, LiveStewardshipRequest>(
        "SELECT id, antibiotic_name, request_status::text AS request_status, auto_stop_date \
           FROM antibiotic_stewardship_requests \
          WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
            AND request_status IN ('approved', 'pending') \
            AND (auto_stop_date IS NULL OR auto_stop_date >= CURRENT_DATE) \
          ORDER BY requested_at DESC \
          LIMIT 50",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

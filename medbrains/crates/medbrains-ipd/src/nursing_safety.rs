//! Bedside safety rules the ward record has to enforce, not just store.
//!
//! - **Chemotherapy needs a certified nurse** (IPSG-3, hazardous-drug
//!   handling). A dose of an antineoplastic (`pharmacy_catalog.is_cytotoxic`,
//!   ATC L01) can be recorded as given only by a user whose employee record
//!   carries an active, HR-verified, unexpired `chemotherapy_administration`
//!   credential.
//!   There is no override: the remedy is a certified nurse, not a reason.
//!   The refusal is audited.
//! - **A PRN dose says why it was given.** `prn_reason` existed and nothing
//!   wrote it.
//! - **A high Morse or Braden score acts.** Morse 45+ and Braden 12 or less
//!   flag the admission, open the prevention care plan and put a task on the
//!   ward's list. Before this, the score was a badge.

use medbrains_core::ipd::IpdMedicationAdministration;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use serde_json::json;
use uuid::Uuid;

use super::UpdateMarRequest;

const MORSE_HIGH_RISK: i64 = 45;
const BRADEN_HIGH_RISK: i64 = 12;
/// Minutes until the auto-raised prevention task is due.
const PREVENTION_TASK_DUE_MINS: i32 = 30;

pub(crate) const CHEMO_BLOCK_MESSAGE: &str = "This is a chemotherapy drug. Only a nurse with an \
     active, HR-verified chemotherapy-administration certification can give it. Ask a certified \
     nurse to give this dose, or ask HR to record and verify your certification.";

/// Whether the MAR row `m` is a chemotherapy dose: the ordered catalogue item
/// (via the prescription line) or, for a dose created at the bedside, one whose
/// name, generic or INN matches is antineoplastic. Shared by the gate and the
/// due-now list so the badge and the refusal cannot disagree.
pub(crate) const IS_CHEMO_DOSE_SQL: &str = "EXISTS ( \
       SELECT 1 FROM pharmacy_catalog pc \
        WHERE pc.tenant_id = m.tenant_id AND pc.deleted_at IS NULL AND pc.is_cytotoxic \
          AND (pc.id = (SELECT pi.catalog_item_id FROM prescription_items pi \
                         WHERE pi.id = m.prescription_item_id AND pi.tenant_id = m.tenant_id) \
               OR lower(trim(m.drug_name)) IN \
                  (lower(pc.name), lower(pc.generic_name), lower(pc.inn_name))))";

/// Statuses that record the drug as having gone into the patient.
fn records_administration(status: &str) -> bool {
    matches!(status.trim(), "given" | "self_administered")
}

/// PRN / SOS / "as needed" orders — given on demand, so each dose needs a reason.
pub(crate) fn is_prn_frequency(frequency: Option<&str>) -> bool {
    frequency.is_some_and(|f| {
        let f = f.trim().to_ascii_lowercase();
        f == "prn" || f == "sos" || f.starts_with("prn ") || f.contains("as needed")
    })
}

/// A PRN dose recorded as given must carry the reason it was needed.
pub(crate) fn require_prn_reason(
    existing: &IpdMedicationAdministration,
    body: &UpdateMarRequest,
) -> Result<(), AppError> {
    let reason_missing = body.prn_reason.as_deref().unwrap_or("").trim().is_empty();
    if records_administration(&body.status)
        && is_prn_frequency(existing.frequency.as_deref())
        && reason_missing
    {
        return Err(AppError::BadRequest(
            "This is an as-needed (PRN) dose. Record why it was given, e.g. \"pain score 7\"."
                .to_owned(),
        ));
    }
    Ok(())
}

/// The drug name when this dose is chemotherapy and `actor` holds no active,
/// verified, unexpired chemotherapy-administration credential; `None` when it
/// may proceed. A free-text drug that matches nothing in the catalogue is not
/// gated.
async fn uncertified_chemo_dose(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    actor: Uuid,
    mar_id: Uuid,
    admission_id: Option<Uuid>,
) -> Result<Option<String>, AppError> {
    let sql = format!(
        "SELECT m.drug_name, {IS_CHEMO_DOSE_SQL} AS is_chemo, \
                EXISTS ( \
                  SELECT 1 FROM employee_credentials ec \
                    JOIN employees e ON e.id = ec.employee_id AND e.tenant_id = ec.tenant_id \
                   WHERE e.user_id = $3 AND ec.tenant_id = m.tenant_id \
                     AND ec.credential_type = 'chemotherapy_administration'::credential_type \
                     AND ec.status = 'active'::credential_status \
                     AND ec.verified_at IS NOT NULL \
                     AND (ec.expiry_date IS NULL OR ec.expiry_date >= CURRENT_DATE) \
                     AND ec.deleted_at IS NULL AND e.deleted_at IS NULL \
                ) AS certified \
           FROM ipd_medication_administration m \
          WHERE m.id = $1 AND m.tenant_id = $2 AND ($4::uuid IS NULL OR m.admission_id = $4)"
    );
    let row = sqlx::query_as::<_, (String, bool, bool)>(&sql)
        .bind(mar_id)
        .bind(tenant_id)
        .bind(actor)
        .bind(admission_id)
        .fetch_optional(&mut **tx)
        .await?;
    Ok(row.and_then(|(drug, is_chemo, certified)| (is_chemo && !certified).then_some(drug)))
}

/// Every MAR status change goes through here: the chemotherapy gate, then the
/// IPSG-3 checks in `administer_mar_dose_in_tx`. A blocked chemotherapy dose
/// is audited and committed before the refusal is returned.
pub(crate) async fn administer_mar_dose(
    state: &AppState,
    claims: &Claims,
    mar_id: Uuid,
    admission_id: Option<Uuid>,
    body: &UpdateMarRequest,
) -> Result<IpdMedicationAdministration, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    if records_administration(&body.status) {
        let blocked =
            uncertified_chemo_dose(&mut tx, claims.tenant_id, claims.sub, mar_id, admission_id)
                .await?;
        if let Some(drug_name) = blocked {
            let values = json!({ "drug_name": drug_name, "status": body.status });
            medbrains_db::audit::AuditLogger::log(
                &mut tx,
                &medbrains_db::audit::AuditEntry {
                    tenant_id: claims.tenant_id,
                    user_id: Some(claims.sub),
                    action: "ipd.mar.chemo_administration_blocked",
                    entity_type: "ipd_medication_administration",
                    entity_id: Some(mar_id),
                    old_values: None,
                    new_values: Some(&values),
                    ip_address: None,
                },
            )
            .await?;
            tx.commit().await?;
            return Err(AppError::ForbiddenReason(CHEMO_BLOCK_MESSAGE.to_owned()));
        }
    }

    let row = super::administer_mar_dose_in_tx(
        &mut tx,
        claims.tenant_id,
        claims.sub,
        mar_id,
        admission_id,
        body,
    )
    .await?;
    tx.commit().await?;
    Ok(row)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Risk {
    Fall,
    PressureInjury,
}

struct Protocol {
    flag_sql: &'static str,
    diagnosis: &'static str,
    goals: &'static str,
    interventions: &'static [&'static str],
    task_type: &'static str,
    task_category: &'static str,
    task_description: &'static str,
}

const FALL: Protocol = Protocol {
    flag_sql: "UPDATE admissions SET is_fall_risk = $3 WHERE id = $1 AND tenant_id = $2",
    diagnosis: "Risk for falls (Morse 45 or more)",
    goals: "Patient remains free of falls for the rest of the admission.",
    interventions: &[
        "Fall-risk wristband and bedside signage",
        "Bed at lowest height, brakes on, side rails per policy",
        "Call bell and personal items within reach",
        "Non-slip footwear; assist with toileting and walking",
        "Reassess Morse every shift and after any fall or change in condition",
        "Teach the patient and attendant the fall precautions",
    ],
    task_type: "fall_precautions",
    task_category: "other",
    task_description: "High fall risk on Morse: put fall precautions in place (wristband, low \
                       bed, call bell in reach, assisted walking).",
};

const PRESSURE_INJURY: Protocol = Protocol {
    flag_sql: "UPDATE admissions SET is_pressure_injury_risk = $3 \
               WHERE id = $1 AND tenant_id = $2",
    diagnosis: "Risk for pressure injury (Braden 12 or less)",
    goals: "Skin stays intact; no new pressure injury.",
    interventions: &[
        "Reposition at least every 2 hours and record it on the turning chart",
        "Pressure-redistributing mattress or support surface",
        "Inspect skin over bony prominences every shift",
        "Keep skin clean and dry; manage moisture and incontinence",
        "Nutrition and hydration review",
        "Offload heels; avoid friction and shear during transfers",
    ],
    task_type: "pressure_injury_prevention",
    task_category: "repositioning",
    task_description: "High pressure-injury risk on Braden: start 2-hourly repositioning and \
                       arrange a pressure-relieving mattress.",
};

/// Which risk an assessment speaks to, and whether its score is high.
/// `None` for other scales, or when no score was recorded.
pub(crate) fn assessed_risk(assessment_type: &str, score: Option<Decimal>) -> Option<(Risk, bool)> {
    let score = score?;
    match assessment_type {
        "morse_fall_scale" => Some((Risk::Fall, score >= Decimal::from(MORSE_HIGH_RISK))),
        "braden_scale" => Some((
            Risk::PressureInjury,
            score <= Decimal::from(BRADEN_HIGH_RISK),
        )),
        _ => None,
    }
}

/// Act on a Morse or Braden score: the admission flag follows the latest
/// score; a high score opens the prevention care plan and a nursing task,
/// once — a reassessment while either is still open adds nothing.
pub(crate) async fn apply_risk_score_in_tx(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    admission_id: Uuid,
    nurse: Uuid,
    assessment_type: &str,
    score: Option<Decimal>,
) -> Result<(), AppError> {
    let Some((risk, high)) = assessed_risk(assessment_type, score) else {
        return Ok(());
    };
    let protocol = match risk {
        Risk::Fall => &FALL,
        Risk::PressureInjury => &PRESSURE_INJURY,
    };
    sqlx::query(protocol.flag_sql)
        .bind(admission_id)
        .bind(tenant_id)
        .bind(high)
        .execute(&mut **tx)
        .await?;
    if !high {
        return Ok(());
    }

    sqlx::query(
        "INSERT INTO ipd_care_plans \
           (tenant_id, admission_id, nursing_diagnosis, goals, interventions, \
            status, initiated_by, initiated_at) \
         SELECT $1, $2, $3, $4, $5, 'active'::care_plan_status, $6, NOW() \
          WHERE NOT EXISTS ( \
            SELECT 1 FROM ipd_care_plans \
             WHERE tenant_id = $1 AND admission_id = $2 AND nursing_diagnosis = $3 \
               AND status = 'active'::care_plan_status AND deleted_at IS NULL)",
    )
    .bind(tenant_id)
    .bind(admission_id)
    .bind(protocol.diagnosis)
    .bind(protocol.goals)
    .bind(json!(protocol.interventions))
    .bind(nurse)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        "INSERT INTO nursing_tasks \
           (tenant_id, admission_id, assigned_to, task_type, description, priority, \
            category, due_at) \
         SELECT $1, $2, a.primary_nurse_id, $3, $4, 'urgent'::nursing_task_priority, \
                $5::nursing_task_category, NOW() + make_interval(mins => $6) \
           FROM admissions a \
          WHERE a.id = $2 AND a.tenant_id = $1 \
            AND NOT EXISTS ( \
              SELECT 1 FROM nursing_tasks t \
               WHERE t.tenant_id = $1 AND t.admission_id = $2 AND t.task_type = $3 \
                 AND t.is_completed = false AND t.deleted_at IS NULL)",
    )
    .bind(tenant_id)
    .bind(admission_id)
    .bind(protocol.task_type)
    .bind(protocol.task_description)
    .bind(protocol.task_category)
    .bind(PREVENTION_TASK_DUE_MINS)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{Risk, assessed_risk, is_prn_frequency};
    use rust_decimal::Decimal;

    #[test]
    fn morse_is_high_from_45() {
        assert_eq!(
            assessed_risk("morse_fall_scale", Some(Decimal::from(44))),
            Some((Risk::Fall, false))
        );
        assert_eq!(
            assessed_risk("morse_fall_scale", Some(Decimal::from(45))),
            Some((Risk::Fall, true))
        );
    }

    #[test]
    fn braden_is_high_at_12_and_below() {
        assert_eq!(
            assessed_risk("braden_scale", Some(Decimal::from(13))),
            Some((Risk::PressureInjury, false))
        );
        assert_eq!(
            assessed_risk("braden_scale", Some(Decimal::from(12))),
            Some((Risk::PressureInjury, true))
        );
    }

    #[test]
    fn other_scales_and_missing_scores_change_nothing() {
        assert_eq!(assessed_risk("gcs", Some(Decimal::from(3))), None);
        assert_eq!(assessed_risk("morse_fall_scale", None), None);
    }

    #[test]
    fn prn_frequencies_are_recognised() {
        assert!(is_prn_frequency(Some("PRN")));
        assert!(is_prn_frequency(Some("sos")));
        assert!(is_prn_frequency(Some("PRN q6h")));
        assert!(is_prn_frequency(Some("As needed")));
        assert!(!is_prn_frequency(Some("BD")));
        assert!(!is_prn_frequency(None));
    }
}

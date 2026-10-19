//! PC-PNDT Form F, from the scan that needs it.
//!
//! Rule 9(4) of the PC-PNDT Rules: every ultrasonography of a pregnant woman
//! has a Form F, filled before the scan is reported, with her declaration and
//! the doctor's that the sex of the fetus was neither detected nor disclosed.
//! An ultrasound order for a pregnant woman opens a draft Form F linked to the
//! order, filled from her antenatal registration; the report cannot be
//! verified until it is complete.

use medbrains_server_core::error::AppError;
use uuid::Uuid;

/// Whether this order is an ultrasound of a pregnant woman: the exam is marked
/// PCPNDT-applicable, or the modality is ultrasound and she is pregnant (the
/// clinician said so, or she has an active antenatal registration here).
const REQUIRED_SQL: &str = "\
    SELECT EXISTS ( \
      SELECT 1 FROM radiology_orders o \
        JOIN radiology_modalities m ON m.id = o.modality_id \
        LEFT JOIN radiology_exams e ON e.id = o.exam_id \
       WHERE o.id = $1 AND o.tenant_id = $2 \
         AND (COALESCE(e.pcpndt_applicable, false) \
              OR (m.is_ultrasound AND (o.patient_pregnant OR EXISTS ( \
                    SELECT 1 FROM maternity_registrations r \
                     WHERE r.tenant_id = o.tenant_id AND r.patient_id = o.patient_id \
                       AND r.status = 'active' AND r.deleted_at IS NULL)))))";

/// Open the draft Form F for an order that needs one. Returns its id.
pub async fn open_if_required(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant: Uuid,
    order: Uuid,
    created_by: Uuid,
) -> Result<Option<Uuid>, AppError> {
    let required: bool = sqlx::query_scalar(REQUIRED_SQL)
        .bind(order)
        .bind(tenant)
        .fetch_one(&mut **tx)
        .await?;
    if !required {
        return Ok(None);
    }
    let number = medbrains_db::sequence::next_sequence(tx, tenant, "PCPNDT_FORM_F", "FF-", 6)
        .await
        .map_err(AppError::from)?;
    // Gestational age and LMP come from her antenatal registration when there is one.
    let id: Option<Uuid> = sqlx::query_scalar(
        "INSERT INTO pcpndt_forms \
           (tenant_id, form_number, patient_id, referral_doctor_id, procedure_type, \
            lmp_date, gestational_age_weeks, radiology_order_id, gender_disclosure_blocked, \
            created_by) \
         SELECT o.tenant_id, $3, o.patient_id, o.ordered_by, COALESCE(e.name, 'Ultrasonography'), \
                r.lmp_date, \
                CASE WHEN r.lmp_date IS NULL THEN NULL \
                     ELSE ((current_date - r.lmp_date) / 7)::int END, \
                o.id, true, $4 \
           FROM radiology_orders o \
           LEFT JOIN radiology_exams e ON e.id = o.exam_id \
           LEFT JOIN LATERAL ( \
             SELECT lmp_date FROM maternity_registrations \
              WHERE tenant_id = o.tenant_id AND patient_id = o.patient_id \
                AND status = 'active' AND deleted_at IS NULL \
              ORDER BY created_at DESC LIMIT 1) r ON true \
          WHERE o.id = $1 AND o.tenant_id = $2 \
         ON CONFLICT (tenant_id, radiology_order_id) \
           WHERE radiology_order_id IS NOT NULL AND deleted_at IS NULL DO NOTHING \
         RETURNING id",
    )
    .bind(order)
    .bind(tenant)
    .bind(&number)
    .bind(created_by)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(id)
}

/// Refuse to verify the report of a scan whose Form F is not complete.
pub async fn require_complete(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant: Uuid,
    order: Uuid,
) -> Result<(), AppError> {
    let incomplete: Option<String> = sqlx::query_scalar(
        "SELECT form_number FROM pcpndt_forms \
          WHERE tenant_id = $1 AND radiology_order_id = $2 AND deleted_at IS NULL \
            AND (woman_declared_at IS NULL OR doctor_declared_at IS NULL \
                 OR indication IS NULL OR performing_doctor_id IS NULL)",
    )
    .bind(tenant)
    .bind(order)
    .fetch_optional(&mut **tx)
    .await?;
    match incomplete {
        Some(number) => Err(AppError::Conflict(format!(
            "Form F {number} (PC-PNDT) for this scan is not complete: record the indication, \
             the performing doctor and both declarations before the report is verified"
        ))),
        None => Ok(()),
    }
}

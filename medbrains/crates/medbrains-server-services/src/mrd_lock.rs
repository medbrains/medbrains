//! The opt-in register-first lock: a hospital may require an OPD visit to be
//! registered (to hold a queue token) before its medical record is opened —
//! the case sheet, a scanned page, an MRD record.

use medbrains_server_core::error::AppError;
use uuid::Uuid;

const MRD_LOCK_MSG: &str = "Register the OPD visit before opening the medical record";

/// True when this tenant requires an OPD registration before medical records may be opened.
pub async fn mrd_lock_enabled(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<bool, AppError> {
    let value = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'mrd' AND key = 'require_opd_registration'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(value.and_then(|v| v.as_bool()).unwrap_or(false))
}

/// When the lock is on, require the encounter to carry an OPD registration (a queue token).
pub async fn assert_encounter_registered(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    encounter_id: Uuid,
) -> Result<(), AppError> {
    if !mrd_lock_enabled(tx, tenant_id).await? {
        return Ok(());
    }
    let registered = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM opd_queues WHERE tenant_id = $1 AND encounter_id = $2)",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .fetch_one(&mut **tx)
    .await?;
    if registered {
        Ok(())
    } else {
        Err(AppError::Conflict(MRD_LOCK_MSG.to_owned()))
    }
}

/// When the lock is on, require the patient to have an open OPD encounter / a registration today.
pub async fn assert_patient_opd_registered(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    patient_id: Uuid,
) -> Result<(), AppError> {
    if !mrd_lock_enabled(tx, tenant_id).await? {
        return Ok(());
    }
    let registered = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM encounters \
            WHERE tenant_id = $1 AND patient_id = $2 \
              AND encounter_type = 'opd' AND status = 'open') \
         OR EXISTS (SELECT 1 FROM opd_queues q \
            JOIN encounters e ON e.id = q.encounter_id \
            WHERE q.tenant_id = $1 AND q.queue_date = CURRENT_DATE AND e.patient_id = $2)",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_one(&mut **tx)
    .await?;
    if registered {
        Ok(())
    } else {
        Err(AppError::Conflict(MRD_LOCK_MSG.to_owned()))
    }
}

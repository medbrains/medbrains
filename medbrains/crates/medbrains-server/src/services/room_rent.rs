//! Daily room-rent auto-billing (audit P1 revenue linkage).
//!
//! Every occupied IPD bed accrues one room-rent invoice line per
//! hospital-local day, priced from `bed_types.daily_rate`. The pass
//! runs hourly and is idempotent: the `auto_charge` source dedup keys
//! on a deterministic per-admission-per-day UUID, so re-runs (and bed
//! transfers within a day) never double-bill. Tenants can opt out via
//! `tenant_settings billing.auto_charge_room_rent = false`.

use std::time::Duration;

use chrono::NaiveDate;
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::routes::billing::{AutoChargeInput, auto_charge, is_auto_billing_enabled};

const PASS_INTERVAL_SECS: u64 = 3600;

pub fn spawn(pool: PgPool) {
    tokio::spawn(async move {
        loop {
            match post_due_room_rent(&pool).await {
                Ok(posted) if posted > 0 => {
                    tracing::info!(posted, "room-rent billing pass complete");
                }
                Ok(_) => {}
                Err(error) => tracing::error!(%error, "room-rent billing pass failed"),
            }
            tokio::time::sleep(Duration::from_secs(PASS_INTERVAL_SECS)).await;
        }
    });
}

/// Deterministic id for "this admission, this day" — the idempotency
/// key auto_charge dedups on. SHA-256-derived (uuid's v5 feature is
/// not enabled workspace-wide).
fn room_rent_source_id(admission_id: Uuid, date: NaiveDate) -> Uuid {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(admission_id.as_bytes());
    hasher.update(date.to_string().as_bytes());
    let digest = hasher.finalize();
    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(&digest[..16]);
    Uuid::from_bytes(bytes)
}

#[derive(sqlx::FromRow)]
struct OccupiedBedAdmission {
    id: Uuid,
    tenant_id: Uuid,
    patient_id: Uuid,
    encounter_id: Uuid,
    bed_type_name: String,
    daily_rate: Decimal,
}

async fn post_due_room_rent(pool: &PgPool) -> Result<u64, AppError> {
    let admissions = sqlx::query_as::<_, OccupiedBedAdmission>(
        "SELECT a.id, a.tenant_id, a.patient_id, a.encounter_id, \
                bt.name AS bed_type_name, bt.daily_rate \
         FROM admissions a \
         JOIN ward_bed_mappings wbm \
           ON wbm.bed_location_id = a.bed_id AND wbm.tenant_id = a.tenant_id \
         JOIN bed_types bt ON bt.id = wbm.bed_type_id \
         WHERE a.status = 'admitted' AND a.bed_id IS NOT NULL \
           AND bt.daily_rate > 0 \
         ORDER BY a.tenant_id LIMIT 5000",
    )
    .fetch_all(pool)
    .await?;

    let mut posted = 0u64;
    for admission in admissions {
        let mut tx = pool.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &admission.tenant_id).await?;

        if !is_auto_billing_enabled(&mut tx, &admission.tenant_id, "room_rent").await? {
            continue;
        }

        let today = crate::hospital_time::tenant_local_today(&mut *tx, admission.tenant_id).await?;

        let result = auto_charge(
            &mut tx,
            &admission.tenant_id,
            AutoChargeInput {
                patient_id: admission.patient_id,
                encounter_id: Some(admission.encounter_id),
                charge_code: "ROOM_RENT".to_owned(),
                source: "ipd".to_owned(),
                source_id: room_rent_source_id(admission.id, today),
                quantity: 1,
                description_override: Some(format!(
                    "Room rent — {} ({today})",
                    admission.bed_type_name
                )),
                unit_price_override: Some(admission.daily_rate),
                tax_percent_override: None,
            },
        )
        .await?;

        tx.commit().await?;
        if !result.skipped_duplicate {
            posted += 1;
        }
    }

    Ok(posted)
}

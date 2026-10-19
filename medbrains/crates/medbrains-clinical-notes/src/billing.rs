//! A doctor's round on an admission is a charge: the first signature on a
//! doctor's progress note bills it, as writing the round note always has.

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Bill the round a progress note records, when IPD round billing is on.
///
/// Best effort, in a savepoint: a tariff missing a code must not cost the
/// doctor their signed note, so a failure is logged and the note stands.
pub async fn bill_doctor_round(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    note_id: Uuid,
    encounter_id: Uuid,
) -> Result<(), AppError> {
    let admission: Option<(Uuid, chrono::NaiveDate)> = sqlx::query_as(
        "SELECT e.patient_id, n.service_at::date FROM clinical_notes n \
           JOIN encounters e ON e.id = n.encounter_id \
          WHERE n.id = $1 AND e.encounter_type = 'ipd'",
    )
    .bind(note_id)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((patient_id, round_date)) = admission else {
        return Ok(());
    };
    sqlx::query("SAVEPOINT doctor_round_bill")
        .execute(&mut **tx)
        .await?;
    let charged = charge(tx, claims, note_id, encounter_id, patient_id, round_date).await;
    if let Err(error) = charged {
        sqlx::query("ROLLBACK TO SAVEPOINT doctor_round_bill")
            .execute(&mut **tx)
            .await?;
        tracing::warn!(%error, %note_id, "doctor round not billed; the signed note stands");
    }
    sqlx::query("RELEASE SAVEPOINT doctor_round_bill")
        .execute(&mut **tx)
        .await?;
    Ok(())
}

async fn charge(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    note_id: Uuid,
    encounter_id: Uuid,
    patient_id: Uuid,
    round_date: chrono::NaiveDate,
) -> Result<(), AppError> {
    use medbrains_server_services::billing;
    if !billing::is_auto_billing_enabled(tx, &claims.tenant_id, "ipd_doctor_round").await? {
        return Ok(());
    }
    billing::auto_charge(
        tx,
        &claims.tenant_id,
        billing::AutoChargeInput {
            patient_id,
            encounter_id: Some(encounter_id),
            charge_code: "CON_SPECIALIST".to_owned(),
            source: "ipd".to_owned(),
            source_id: note_id,
            quantity: 1,
            description_override: Some(format!("IPD doctor round - {round_date}")),
            unit_price_override: None,
            tax_percent_override: None,
        },
    )
    .await?;
    Ok(())
}

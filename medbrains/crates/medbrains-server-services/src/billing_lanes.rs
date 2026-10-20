//! Billing lanes (#4885): which bill a charge lands on, and when the front
//! desk's fees are charged.
//!
//! A lane is the department a charge is collected by. A lane billed
//! `individual` gets a bill of its own per visit, so its desk can collect it
//! without touching anyone else's; a lane billed `together` shares the visit's
//! one bill. An admitted patient's charges are always one bill. Each bill
//! also names the legal entity whose GSTIN and receipt series it uses.

use rust_decimal::Decimal;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use crate::billing::{AutoChargeInput, auto_charge};

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// Where a charge lands: the bill's lane key and its legal entity.
#[derive(Debug, sqlx::FromRow)]
pub struct ChargeLane {
    /// The lane for an `individual` lane, else `together`.
    pub lane_key: String,
    pub entity_id: Uuid,
}

/// The lane key and entity for a charge from `source`.
///
/// # Errors
/// A database fault.
pub async fn lane_for_charge(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    source: &str,
    admission_id: Option<Uuid>,
) -> Result<ChargeLane, AppError> {
    Ok(sqlx::query_as::<_, ChargeLane>(
        "WITH l AS (SELECT public.billing_item_lane($2, $3) AS lane) \
         SELECT CASE WHEN $3::uuid IS NULL \
                       AND COALESCE(bl.default_mode, public.billing_lane_default_mode(l.lane)) \
                           = 'individual' \
                     THEN l.lane ELSE 'together' END AS lane_key, \
                COALESCE(bl.legal_entity_id, public.billing_ensure_defaults($1)) AS entity_id \
           FROM l LEFT JOIN public.billing_lanes bl \
             ON bl.tenant_id = $1 AND bl.lane = l.lane AND bl.deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(source)
    .bind(admission_id)
    .fetch_one(&mut **tx)
    .await?)
}

/// The two moments a front-desk fee can be charged at.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FeeMoment {
    /// The patient registers or checks in for a visit.
    CheckIn,
    /// The consultation is completed.
    Complete,
}

#[derive(Debug, sqlx::FromRow)]
struct FeeTiming {
    charge_at: String,
    fee_amount: Option<Decimal>,
}

async fn fee_timing(tx: &mut Tx<'_>, tenant_id: Uuid, lane: &str) -> Result<FeeTiming, AppError> {
    let row = sqlx::query_as::<_, FeeTiming>(
        "SELECT charge_at, fee_amount FROM billing_lanes \
          WHERE tenant_id = $1 AND lane = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(lane)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row.unwrap_or_else(|| FeeTiming {
        charge_at: CHECKIN.to_owned(),
        fee_amount: None,
    }))
}

const CHECKIN: &str = "checkin";

/// Whether a lane's fee is charged at `moment`. Completion always charges:
/// a fee that was due at check-in but was not charged then (the visit came in
/// through another door) is charged by completion, once — charges are
/// idempotent on their source.
fn due_at(timing: &FeeTiming, moment: FeeMoment) -> bool {
    moment == FeeMoment::Complete || timing.charge_at == CHECKIN
}

/// Whether the OPD consultation is charged at `moment`.
///
/// # Errors
/// A database fault.
pub async fn consult_due_at(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    moment: FeeMoment,
) -> Result<bool, AppError> {
    Ok(due_at(&fee_timing(tx, tenant_id, "opd").await?, moment))
}

/// Charge the registration fee, once per patient, if the hospital charges one
/// and it is due at `moment`.
///
/// # Errors
/// A database fault.
pub async fn charge_registration_fee(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    patient_id: Uuid,
    encounter_id: Option<Uuid>,
    moment: FeeMoment,
) -> Result<(), AppError> {
    let timing = fee_timing(tx, tenant_id, "registration").await?;
    let Some(fee) = timing.fee_amount.filter(|f| *f > Decimal::ZERO) else {
        return Ok(());
    };
    if !due_at(&timing, moment) {
        return Ok(());
    }
    auto_charge(
        tx,
        &tenant_id,
        AutoChargeInput {
            patient_id,
            encounter_id,
            charge_code: "REG-FEE".to_owned(),
            source: "registration".to_owned(),
            source_id: patient_id,
            quantity: 1,
            description_override: Some("Registration fee".to_owned()),
            unit_price_override: Some(fee),
            tax_percent_override: None,
        },
    )
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn timing(at: &str) -> FeeTiming {
        FeeTiming {
            charge_at: at.to_owned(),
            fee_amount: None,
        }
    }

    #[test]
    fn checkin_fee_is_due_at_both_moments_complete_fee_only_at_completion() {
        assert!(due_at(&timing("checkin"), FeeMoment::CheckIn));
        assert!(due_at(&timing("checkin"), FeeMoment::Complete));
        assert!(!due_at(&timing("complete"), FeeMoment::CheckIn));
        assert!(due_at(&timing("complete"), FeeMoment::Complete));
    }
}

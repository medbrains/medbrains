//! Room eligibility against the patient's policy (revenue integrity RFC,
//! wave 1.4, register row IN4).
//!
//! IRDAI/HLT/REG/CIR/151/06/2020 (11 June 2020): when a policyholder takes a
//! room above the eligible category, the insurer may deduct the "associated
//! medical expenses" in the ratio eligible rent / actual rent, never the cost
//! of pharmacy and consumables, implants and medical devices, or diagnostics
//! (para 4), never at a hospital that does not follow differential billing
//! (para 6), and never on ICU charges (para 7).
//!
//! The admission desk checks before it allocates (`check_room`), and the
//! allocation records the outcome (`record::record_allocation`).

pub mod record;

use rust_decimal::{Decimal, RoundingStrategy};
use serde::Serialize;
use sqlx::PgConnection;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

pub use record::{
    ROOM_DISCLOSURE_VERSION, RoomAllocation, RoomConsentInput, consent_on_row, mark_actioned,
    record_allocation,
};

/// `charge_attention_items.source_module` of a room row; the subject is the
/// admission, so one admission has one open room row.
pub const SOURCE_ADMISSION_ROOM: &str = "admission_room";

/// The room-linked charges the cut may touch, by charge source and by
/// charge-master category: room and bed charges, nursing, doctors' visits,
/// OT and procedure fees. An allowlist, so a new kind of charge stays out of
/// the cut until someone decides it belongs.
const LINKED_SOURCES: &str = "('ipd', 'ot', 'procedure')";
const LINKED_CATEGORIES: &str =
    "('Room Charges', 'Nursing', 'Consultation', 'OT Charges', 'Procedures')";

/// What the check found, for the desk's warning and for the inbox row.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct RoomCheck {
    /// `not_insured` (cash: no check), `no_limit` (policy records none),
    /// `limit_unknown` (a % of a sum insured that is not recorded),
    /// `unpriced` (no daily rate), `icu` (outside the cut),
    /// `no_differential_billing` (this hospital charges the same in every
    /// room, so there is no cut), `within`, or `above`.
    pub status: &'static str,
    pub patient_insurance_id: Option<Uuid>,
    pub insurance_provider: Option<String>,
    pub room_rate: Option<Decimal>,
    pub eligible_rate: Option<Decimal>,
    /// Share of room-linked charges the insurer may pay; only when `above`.
    pub payable_ratio: Option<Decimal>,
    /// Room-linked charges on this visit's bills so far (a transfer).
    pub associated_so_far: Option<Decimal>,
}

#[derive(sqlx::FromRow)]
struct Policy {
    id: Uuid,
    insurance_provider: String,
    per_day: Option<Decimal>,
    percent: Option<Decimal>,
    sum_insured: Option<Decimal>,
}

/// The policy's eligible rent a day: `Ok(None)` when it records no limit,
/// `Err(())` when the limit is a percentage of a sum insured it lacks.
fn eligible_rate(p: &Policy) -> Result<Option<Decimal>, ()> {
    match (p.per_day, p.percent, p.sum_insured) {
        (Some(d), _, _) => Ok(Some(d)),
        (None, Some(pct), Some(si)) => Ok(Some((si * pct / Decimal::ONE_HUNDRED).round_dp(2))),
        (None, Some(_), None) => Err(()),
        (None, None, _) => Ok(None),
    }
}

#[derive(sqlx::FromRow)]
struct Room {
    daily_rate: Decimal,
    is_critical_care: bool,
}

/// The share of room-linked charges payable at `room` under `eligible` a day.
///
/// `None` when the room is within the limit. Rounded down to six places (never up to 1) and never below one millionth,
/// so a room a paisa above the limit still reads as above.
#[must_use]
pub fn payable_ratio(room: Decimal, eligible: Decimal) -> Option<Decimal> {
    (room > eligible && eligible > Decimal::ZERO).then(|| {
        (eligible / room)
            .round_dp_with_strategy(6, RoundingStrategy::ToZero)
            .max(Decimal::new(1, 6))
    })
}

/// The rupees the insurer may cut from `bill` of room-linked charges.
#[must_use]
pub fn deduction(bill: Decimal, ratio: Decimal) -> Decimal {
    (bill * (Decimal::ONE - ratio)).round_dp(2)
}

/// The active policy in force today, primary first.
async fn active_policy(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<Policy>, AppError> {
    Ok(sqlx::query_as::<_, Policy>(
        "SELECT id, insurance_provider, room_rent_limit_per_day AS per_day, \
                room_rent_limit_percent AS percent, sum_insured \
           FROM patient_insurance \
          WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL AND is_active \
            AND current_date BETWEEN valid_from AND valid_until \
          ORDER BY priority, created_at LIMIT 1",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(conn)
    .await?)
}

/// The bed's daily rate from its bed type, and whether it is critical care.
async fn room(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    bed_id: Uuid,
) -> Result<Option<Room>, AppError> {
    Ok(sqlx::query_as::<_, Room>(
        "SELECT bt.daily_rate, bt.is_critical_care \
           FROM ward_bed_mappings wbm JOIN bed_types bt ON bt.id = wbm.bed_type_id \
          WHERE wbm.tenant_id = $1 AND wbm.bed_location_id = $2 AND wbm.deleted_at IS NULL \
            AND bt.deleted_at IS NULL AND bt.daily_rate > 0 \
          ORDER BY wbm.created_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(bed_id)
    .fetch_optional(conn)
    .await?)
}

/// Whether this hospital charges differently by room category (the
/// `billing/differential_billing` setting, default yes). An unreadable
/// setting is an error, never a guess.
async fn bills_by_room(conn: &mut PgConnection, tenant_id: Uuid) -> Result<bool, AppError> {
    let value: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
          WHERE tenant_id = $1 AND category = 'billing' AND key = 'differential_billing'",
    )
    .bind(tenant_id)
    .fetch_optional(conn)
    .await?;
    Ok(value.is_none_or(|v| v.as_bool().unwrap_or_else(|| v.as_str() != Some("false"))))
}

/// Room-linked charges on the visit's live bills: the allowlisted sources
/// and categories, less implants (by catalogue category or the implant
/// registry) and bed-days already billed in a critical-care bed type.
// ponytail: an ICU bed-day is matched by the room-rent line's description,
// which names the bed type (`services::room_rent`); a bed-type id on the line
// would be exact if hospitals rename bed types mid-stay.
async fn associated_so_far(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    encounter_id: Uuid,
) -> Result<Decimal, AppError> {
    Ok(sqlx::query_scalar::<_, Decimal>(&format!(
        "SELECT COALESCE(SUM(ii.total_price), 0) FROM invoice_items ii \
           JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
          WHERE i.tenant_id = $1 AND i.encounter_id = $2 AND i.deleted_at IS NULL \
            AND ii.deleted_at IS NULL AND i.status NOT IN ('cancelled', 'refunded') \
            AND (ii.source::text IN {LINKED_SOURCES} OR ii.category IN {LINKED_CATEGORIES}) \
            AND COALESCE(ii.category, '') NOT ILIKE '%implant%' \
            AND NOT EXISTS (SELECT 1 FROM implant_registry ir \
                             WHERE ir.tenant_id = ii.tenant_id AND ir.id = ii.source_id) \
            AND NOT EXISTS (SELECT 1 FROM bed_types bt \
                             WHERE bt.tenant_id = ii.tenant_id AND bt.is_critical_care \
                               AND ii.description LIKE 'Room rent — ' || bt.name || ' (%')"
    ))
    .bind(tenant_id)
    .bind(encounter_id)
    .fetch_one(conn)
    .await?)
}

/// The check's status once the policy and room are known.
fn status_of(
    room: Option<&Room>,
    limit: Result<Option<Decimal>, ()>,
    by_room: bool,
) -> &'static str {
    match (room, limit) {
        (_, Err(())) => "limit_unknown",
        (None, _) => "unpriced",
        (Some(_), Ok(None)) => "no_limit",
        (Some(r), _) if r.is_critical_care => "icu",
        (Some(_), _) if !by_room => "no_differential_billing",
        (Some(r), Ok(Some(l))) if payable_ratio(r.daily_rate, l).is_some() => "above",
        (Some(_), Ok(Some(_))) => "within",
    }
}

/// Compare `bed_id`'s rate with the patient's policy limit. A failed read is
/// an error, never "within": the caller shows it as a fault.
pub async fn check_room(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient_id: Uuid,
    bed_id: Uuid,
    encounter_id: Option<Uuid>,
) -> Result<RoomCheck, AppError> {
    let mut check = RoomCheck {
        status: "not_insured",
        patient_insurance_id: None,
        insurance_provider: None,
        room_rate: None,
        eligible_rate: None,
        payable_ratio: None,
        associated_so_far: None,
    };
    let Some(policy) = active_policy(conn, tenant_id, patient_id).await? else {
        return Ok(check);
    };
    let limit = eligible_rate(&policy);
    check.patient_insurance_id = Some(policy.id);
    check.insurance_provider = Some(policy.insurance_provider);
    check.eligible_rate = limit.ok().flatten();
    let room = room(conn, tenant_id, bed_id).await?;
    check.room_rate = room.as_ref().map(|r| r.daily_rate);
    let by_room = bills_by_room(conn, tenant_id).await?;
    check.status = status_of(room.as_ref(), limit, by_room);
    if check.status != "above" {
        return Ok(check);
    }
    check.payable_ratio = check
        .room_rate
        .zip(check.eligible_rate)
        .and_then(|(r, l)| payable_ratio(r, l));
    if let Some(encounter) = encounter_id {
        check.associated_so_far = Some(associated_so_far(conn, tenant_id, encounter).await?);
    }
    Ok(check)
}

#[cfg(test)]
mod tests {
    use super::{deduction, payable_ratio};
    use rust_decimal::Decimal;

    #[test]
    fn a_room_above_the_limit_cuts_every_linked_charge_in_proportion() {
        // ₹8,000 room under a ₹5,000 limit: the insurer pays 62.5% of linked charges.
        let ratio = payable_ratio(Decimal::from(8000), Decimal::from(5000));
        assert_eq!(ratio, Some(Decimal::new(625_000, 6)));
        // On ₹1,00,000 of linked charges the cut is ₹37,500, not the ₹3,000 a day.
        assert_eq!(
            deduction(Decimal::from(100_000), Decimal::new(6250, 4)),
            Decimal::from(37_500)
        );
    }

    #[test]
    fn a_room_at_or_below_the_limit_has_no_cut() {
        assert_eq!(
            payable_ratio(Decimal::from(5000), Decimal::from(5000)),
            None
        );
        assert_eq!(
            payable_ratio(Decimal::from(3000), Decimal::from(5000)),
            None
        );
    }

    #[test]
    fn a_room_a_paisa_above_the_limit_never_rounds_to_within() {
        // ₹20,000.01 under ₹20,000: 0.9999995 must not become 1.
        let ratio = payable_ratio(Decimal::new(2_000_001, 2), Decimal::from(20_000));
        assert_eq!(ratio, Some(Decimal::new(999_999, 6)));
    }
}

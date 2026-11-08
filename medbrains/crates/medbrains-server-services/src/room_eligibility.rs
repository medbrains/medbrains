//! Room eligibility against the patient's policy (revenue integrity RFC,
//! wave 1.4, register row IN4).
//!
//! Under IRDAI's rules, a room above the policy's eligible room rent lets the
//! insurer pay every room-linked ("associated") charge only in the ratio
//! eligible rent / actual rent — not just refuse the rent difference.
//! Pharmacy, implants and devices, diagnostics and ICU are outside that cut
//! (IRDAI/HLT/REG/CIR, 17 March 2020, carried into the Master Circular on
//! Health Insurance Products, 29 May 2024).
//!
//! The admission desk checks before it allocates (`check_room`), and the
//! allocation itself records the outcome (`record_allocation`): a room above
//! the limit puts a `room_over_limit` row on the inbox with the expected cut;
//! the family's consent to pay it is kept in `room_upgrade_consents` and
//! closes the row; moving the patient into an eligible room closes it too.

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::PgConnection;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

/// `charge_attention_items.source_module` of a room row; the subject is the
/// admission, so one admission has one open room row.
pub const SOURCE_ADMISSION_ROOM: &str = "admission_room";

/// Charge sources outside the proportionate cut: pharmacy, consumables
/// (implants and devices are issued through these) and diagnostics.
// ponytail: by charge source, not by line; a hospital that bills implants as
// `manual` lines will see them counted in. Per-line flags if that matters.
const OUTSIDE_THE_CUT: &str = "('pharmacy', 'lab', 'radiology', 'consumable')";

/// What the check found, for the desk's warning and for the inbox row.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct RoomCheck {
    /// `not_insured` (cash: no check), `no_limit` (policy records none),
    /// `unpriced` (the room has no daily rate), `icu` (outside the cut),
    /// `within`, or `above`.
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

/// The patient's or a relative's agreement to pay the cut for a higher room.
#[derive(Debug, Clone, Deserialize)]
pub struct RoomConsentInput {
    pub consented_by_name: String,
    pub consenter_relation: String,
    /// The bill the family was shown the deduction on, if the desk had one.
    pub estimated_bill: Option<Decimal>,
}

/// One allocation of a bed to an admission, at admission or transfer.
#[derive(Debug, Clone, Copy)]
pub struct RoomAllocation<'a> {
    pub tenant_id: Uuid,
    pub actor: Uuid,
    pub admission_id: Uuid,
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub bed_id: Uuid,
    pub consent: Option<&'a RoomConsentInput>,
}

#[derive(sqlx::FromRow)]
struct Policy {
    id: Uuid,
    insurance_provider: String,
    eligible_rate: Option<Decimal>,
}

#[derive(sqlx::FromRow)]
struct Room {
    daily_rate: Decimal,
    is_icu: bool,
}

/// The share of room-linked charges payable in a room at `room` rupees a
/// day under a limit of `eligible`: `None` when the room is within it.
#[must_use]
pub fn payable_ratio(room: Decimal, eligible: Decimal) -> Option<Decimal> {
    (room > eligible && eligible > Decimal::ZERO).then(|| (eligible / room).round_dp(4))
}

/// The rupees the insurer may cut from `bill` of room-linked charges.
#[must_use]
pub fn deduction(bill: Decimal, ratio: Decimal) -> Decimal {
    (bill * (Decimal::ONE - ratio)).round_dp(2)
}

/// The active policy in force today, primary first, with its eligible rent:
/// the fixed amount, else the percentage of the sum insured.
async fn active_policy(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<Policy>, AppError> {
    Ok(sqlx::query_as::<_, Policy>(
        "SELECT id, insurance_provider, \
                COALESCE(room_rent_limit_per_day, \
                         round(sum_insured * room_rent_limit_percent / 100, 2)) AS eligible_rate \
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

/// The bed's daily rate from its bed type, and whether it is an ICU bed.
async fn room(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    bed_id: Uuid,
) -> Result<Option<Room>, AppError> {
    Ok(sqlx::query_as::<_, Room>(
        "SELECT bt.daily_rate, (bt.code ILIKE '%icu%' OR bt.name ILIKE '%icu%') AS is_icu \
           FROM ward_bed_mappings wbm JOIN bed_types bt ON bt.id = wbm.bed_type_id \
          WHERE wbm.tenant_id = $1 AND wbm.bed_location_id = $2 AND wbm.deleted_at IS NULL \
            AND bt.daily_rate > 0",
    )
    .bind(tenant_id)
    .bind(bed_id)
    .fetch_optional(conn)
    .await?)
}

/// Room-linked charges on the visit's live bills.
async fn associated_so_far(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    encounter_id: Uuid,
) -> Result<Decimal, AppError> {
    Ok(sqlx::query_scalar::<_, Decimal>(&format!(
        "SELECT COALESCE(SUM(ii.total_price), 0) FROM invoice_items ii \
           JOIN invoices i ON i.id = ii.invoice_id AND i.tenant_id = ii.tenant_id \
          WHERE i.tenant_id = $1 AND i.encounter_id = $2 AND i.deleted_at IS NULL \
            AND i.status NOT IN ('cancelled', 'refunded') \
            AND ii.source::text NOT IN {OUTSIDE_THE_CUT}"
    ))
    .bind(tenant_id)
    .bind(encounter_id)
    .fetch_one(conn)
    .await?)
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
    check.patient_insurance_id = Some(policy.id);
    check.insurance_provider = Some(policy.insurance_provider);
    check.eligible_rate = policy.eligible_rate;
    let room = room(conn, tenant_id, bed_id).await?;
    check.room_rate = room.as_ref().map(|r| r.daily_rate);
    check.status = match (&room, policy.eligible_rate) {
        (None, _) => "unpriced",
        (Some(_), None) => "no_limit",
        (Some(r), _) if r.is_icu => "icu",
        (Some(r), Some(limit)) => {
            check.payable_ratio = payable_ratio(r.daily_rate, limit);
            if check.payable_ratio.is_some() {
                "above"
            } else {
                "within"
            }
        }
    };
    if check.status == "above"
        && let Some(encounter) = encounter_id
    {
        check.associated_so_far = Some(associated_so_far(conn, tenant_id, encounter).await?);
    }
    Ok(check)
}

/// Trimmed consent fields, or 400 when a name or relation is missing.
fn validated(consent: &RoomConsentInput) -> Result<(String, String), AppError> {
    let name = consent.consented_by_name.trim();
    let relation = consent.consenter_relation.trim();
    if !(2..=120).contains(&name.chars().count()) || !(2..=40).contains(&relation.chars().count()) {
        return Err(AppError::BadRequest(
            "ipd.roomConsent.whoRequired".to_owned(),
        ));
    }
    if consent.estimated_bill.is_some_and(|b| b < Decimal::ZERO) {
        return Err(AppError::BadRequest(
            "ipd.roomConsent.billNegative".to_owned(),
        ));
    }
    Ok((name.to_owned(), relation.to_owned()))
}

/// Record what the allocation means for the bill: an open row above the
/// limit (closed by `consent` when given), or, within it, close any open row
/// for the admission because the patient was moved.
pub async fn record_allocation(
    conn: &mut PgConnection,
    alloc: RoomAllocation<'_>,
) -> Result<RoomCheck, AppError> {
    let consent = alloc.consent.map(validated).transpose()?;
    let check = check_room(
        conn,
        alloc.tenant_id,
        alloc.patient_id,
        alloc.bed_id,
        Some(alloc.encounter_id),
    )
    .await?;
    let (Some(ratio), Some(policy)) = (check.payable_ratio, check.patient_insurance_id) else {
        close_open_row(conn, &alloc).await?;
        return Ok(check);
    };
    let bill = alloc
        .consent
        .and_then(|c| c.estimated_bill)
        .or(check.associated_so_far);
    let evidence = serde_json::json!({
        "bed_id": alloc.bed_id,
        "patient_insurance_id": policy,
        "room_rate": check.room_rate,
        "eligible_rate": check.eligible_rate,
        "payable_ratio": ratio,
        "estimated_bill": bill,
    });
    let row = upsert_row(conn, &alloc, bill.map(|b| deduction(b, ratio)), &evidence).await?;
    if let Some((name, relation)) = consent {
        let consent_id =
            insert_consent(conn, alloc.tenant_id, alloc.actor, row, (&name, &relation)).await?;
        mark_actioned(
            conn,
            alloc.tenant_id,
            alloc.actor,
            row,
            serde_json::json!({ "consent_id": consent_id }),
        )
        .await?;
    }
    Ok(check)
}

/// The admission's open room row, raised or refreshed for this room.
async fn upsert_row(
    conn: &mut PgConnection,
    alloc: &RoomAllocation<'_>,
    amount: Option<Decimal>,
    evidence: &serde_json::Value,
) -> Result<Uuid, AppError> {
    Ok(sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO charge_attention_items \
           (tenant_id, kind, source_module, source_entity_id, patient_id, encounter_id, \
            reason, amount, evidence, service_at, created_by) \
         VALUES ($1, 'room_over_limit', $2, $3, $4, $5, 'room_over_limit', $6, $7, now(), $8) \
         ON CONFLICT (tenant_id, source_module, source_entity_id) \
           WHERE status = 'open' AND deleted_at IS NULL \
         DO UPDATE SET amount = EXCLUDED.amount, evidence = EXCLUDED.evidence, updated_at = now() \
         RETURNING id",
    )
    .bind(alloc.tenant_id)
    .bind(SOURCE_ADMISSION_ROOM)
    .bind(alloc.admission_id)
    .bind(alloc.patient_id)
    .bind(alloc.encounter_id)
    .bind(amount)
    .bind(evidence)
    .bind(alloc.actor)
    .fetch_one(conn)
    .await?)
}

/// Close the admission's open room row: the patient is now in a room the
/// policy covers (or one outside the cut), so no deduction is expected.
async fn close_open_row(
    conn: &mut PgConnection,
    alloc: &RoomAllocation<'_>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE charge_attention_items SET status = 'actioned', resolved_by = $4, \
                resolved_at = now(), \
                evidence = COALESCE(evidence, '{}'::jsonb) || '{\"resolution\": \"moved_within_limit\"}' \
          WHERE tenant_id = $1 AND source_module = $2 AND source_entity_id = $3 \
            AND status = 'open' AND deleted_at IS NULL",
    )
    .bind(alloc.tenant_id)
    .bind(SOURCE_ADMISSION_ROOM)
    .bind(alloc.admission_id)
    .bind(alloc.actor)
    .execute(conn)
    .await?;
    Ok(())
}

/// Keep the consent, with the numbers the family was shown, from the row.
async fn insert_consent(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    actor: Uuid,
    row: Uuid,
    (name, relation): (&str, &str),
) -> Result<Uuid, AppError> {
    sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO room_upgrade_consents \
           (tenant_id, patient_id, admission_id, patient_insurance_id, bed_id, room_rate, \
            eligible_rate, payable_ratio, estimated_bill, estimated_deduction, \
            consented_by_name, consenter_relation, recorded_by) \
         SELECT tenant_id, patient_id, source_entity_id, \
                (evidence->>'patient_insurance_id')::uuid, (evidence->>'bed_id')::uuid, \
                (evidence->>'room_rate')::numeric, (evidence->>'eligible_rate')::numeric, \
                (evidence->>'payable_ratio')::numeric, (evidence->>'estimated_bill')::numeric, \
                amount, $3, $4, $5 \
           FROM charge_attention_items \
          WHERE id = $1 AND tenant_id = $2 AND kind = 'room_over_limit' \
         RETURNING id",
    )
    .bind(row)
    .bind(tenant_id)
    .bind(name)
    .bind(relation)
    .bind(actor)
    .fetch_optional(conn)
    .await?
    .ok_or(AppError::NotFound)
}

/// Close an open inbox row as acted on, merging what was done into its evidence.
pub async fn mark_actioned(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    actor: Uuid,
    row: Uuid,
    what: serde_json::Value,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE charge_attention_items SET status = 'actioned', resolved_by = $3, \
                resolved_at = now(), evidence = COALESCE(evidence, '{}'::jsonb) || $4 \
          WHERE id = $1 AND tenant_id = $2 AND status = 'open'",
    )
    .bind(row)
    .bind(tenant_id)
    .bind(actor)
    .bind(what)
    .execute(conn)
    .await?;
    Ok(())
}

/// Consent given after the allocation, from the insurance desk's inbox: the
/// open room row's numbers are kept with it and the row closes.
pub async fn consent_on_row(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    actor: Uuid,
    row: Uuid,
    consent: &RoomConsentInput,
) -> Result<(), AppError> {
    let who = validated(consent)?;
    let consent_id = insert_consent(conn, tenant_id, actor, row, (&who.0, &who.1)).await?;
    mark_actioned(
        conn,
        tenant_id,
        actor,
        row,
        serde_json::json!({ "consent_id": consent_id }),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::{deduction, payable_ratio};
    use rust_decimal::Decimal;

    #[test]
    fn a_room_above_the_limit_cuts_every_linked_charge_in_proportion() {
        // ₹8,000 room under a ₹5,000 limit: the insurer pays 62.5% of linked charges.
        let ratio = payable_ratio(Decimal::from(8000), Decimal::from(5000));
        assert_eq!(ratio, Some(Decimal::new(6250, 4)));
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
}

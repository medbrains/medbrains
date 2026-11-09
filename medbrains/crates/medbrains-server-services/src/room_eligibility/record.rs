//! What a bed allocation leaves on the inbox.
//!
//! A room above the limit opens
//! (or refreshes) a `room_over_limit` row with the expected cut; the family's
//! consent, witnessed by a second member of staff, is kept in
//! `room_upgrade_consents` and closes it; a move into a room with no cut
//! closes it too. Any other answer (unpriced bed, no limit, an unknown) leaves
//! the row open with that answer on it, for the insurance desk.

use rust_decimal::Decimal;
use serde::Deserialize;
use sqlx::PgConnection;
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use super::{RoomCheck, SOURCE_ADMISSION_ROOM, associated_so_far, check_room, deduction};

/// The wording of the disclosure the desk shows the family (the web's
/// `ROOM_DISCLOSURE_VERSION`); a consent names the version it was given on.
pub const ROOM_DISCLOSURE_VERSION: &str = "room-cut-2026-11-v1";

/// The patient's or a relative's agreement to pay the cut for a higher room.
#[derive(Debug, Clone, Deserialize)]
pub struct RoomConsentInput {
    pub consented_by_name: String,
    pub consenter_relation: String,
    /// The bill the family was shown the deduction on, if the desk had one.
    pub estimated_bill: Option<Decimal>,
    /// A second member of staff who saw the family agree.
    pub witness_user_id: Uuid,
    /// The disclosure wording shown: must be the current one.
    pub disclosure_version: String,
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
    /// Only when the actor may record consent; otherwise the desk does.
    pub consent: Option<&'a RoomConsentInput>,
}

/// A consent's who, checked: 400 for a missing name or relation, a negative
/// bill, an old disclosure, or a witness who is the recorder or not active
/// staff of this hospital.
async fn validated(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    actor: Uuid,
    consent: &RoomConsentInput,
) -> Result<(String, String), AppError> {
    let name = consent.consented_by_name.trim();
    let relation = consent.consenter_relation.trim();
    let bad = |code: &str| Err(AppError::BadRequest(format!("ipd.roomConsent.{code}")));
    if !(2..=120).contains(&name.chars().count()) || !(2..=40).contains(&relation.chars().count()) {
        return bad("whoRequired");
    }
    if consent.estimated_bill.is_some_and(|b| b < Decimal::ZERO) {
        return bad("billNegative");
    }
    if consent.disclosure_version != ROOM_DISCLOSURE_VERSION {
        return bad("disclosureOutdated");
    }
    let is_staff: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 \
                          AND is_active AND deleted_at IS NULL)",
    )
    .bind(consent.witness_user_id)
    .bind(tenant_id)
    .fetch_one(conn)
    .await?;
    if !is_staff || consent.witness_user_id == actor {
        return bad("witnessRequired");
    }
    Ok((name.to_owned(), relation.to_owned()))
}

/// Record what the allocation means for the bill; see the module docs.
pub async fn record_allocation(
    conn: &mut PgConnection,
    alloc: RoomAllocation<'_>,
) -> Result<RoomCheck, AppError> {
    let who = match alloc.consent {
        Some(c) => Some(validated(conn, alloc.tenant_id, alloc.actor, c).await?),
        None => None,
    };
    let check = check_room(
        conn,
        alloc.tenant_id,
        alloc.patient_id,
        alloc.bed_id,
        Some(alloc.encounter_id),
    )
    .await?;
    let (Some(ratio), Some(policy)) = (check.payable_ratio, check.patient_insurance_id) else {
        settle_open_row(conn, &alloc, check.status).await?;
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
    if let (Some(c), Some(who)) = (alloc.consent, who) {
        let id = insert_consent(conn, (alloc.tenant_id, alloc.actor, row), c, &who).await?;
        mark_actioned(
            conn,
            alloc.tenant_id,
            alloc.actor,
            row,
            serde_json::json!({ "consent_id": id }),
        )
        .await?;
    }
    Ok(check)
}

/// The admission's open room row, raised or refreshed for this room. A
/// "could not check" row becomes a finding once a check succeeds.
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
         DO UPDATE SET reason = EXCLUDED.reason, amount = EXCLUDED.amount, \
                       evidence = EXCLUDED.evidence, updated_at = now() \
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

/// The admission's open room row after a check that found no cut. A room
/// really within the limit, an ICU bed, or a hospital without room-category
/// pricing closes it; any other answer leaves it open with that answer, so
/// the desk sees why it could not be settled.
async fn settle_open_row(
    conn: &mut PgConnection,
    alloc: &RoomAllocation<'_>,
    status: &str,
) -> Result<(), AppError> {
    let closes = matches!(status, "within" | "icu" | "no_differential_billing");
    sqlx::query(
        "UPDATE charge_attention_items SET \
                status = CASE WHEN $5 THEN 'actioned' ELSE status END, \
                resolved_by = CASE WHEN $5 THEN $4 ELSE resolved_by END, \
                resolved_at = CASE WHEN $5 THEN now() ELSE resolved_at END, \
                evidence = COALESCE(evidence, '{}'::jsonb) || \
                    jsonb_build_object(CASE WHEN $5 THEN 'resolution' ELSE 'last_check' END, \
                                       $6::text), \
                updated_at = now() \
          WHERE tenant_id = $1 AND source_module = $2 AND source_entity_id = $3 \
            AND status = 'open' AND deleted_at IS NULL",
    )
    .bind(alloc.tenant_id)
    .bind(SOURCE_ADMISSION_ROOM)
    .bind(alloc.admission_id)
    .bind(alloc.actor)
    .bind(closes)
    .bind(if status == "within" {
        "moved_within_limit"
    } else {
        status
    })
    .execute(conn)
    .await?;
    Ok(())
}

/// Keep the consent, with the numbers the family was shown, from the row.
async fn insert_consent(
    conn: &mut PgConnection,
    (tenant_id, actor, row): (Uuid, Uuid, Uuid),
    consent: &RoomConsentInput,
    (name, relation): &(String, String),
) -> Result<Uuid, AppError> {
    sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO room_upgrade_consents \
           (tenant_id, patient_id, admission_id, patient_insurance_id, bed_id, room_rate, \
            eligible_rate, payable_ratio, estimated_bill, estimated_deduction, \
            consented_by_name, consenter_relation, witness_user_id, disclosure_version, \
            recorded_by) \
         SELECT tenant_id, patient_id, source_entity_id, \
                (evidence->>'patient_insurance_id')::uuid, (evidence->>'bed_id')::uuid, \
                (evidence->>'room_rate')::numeric, (evidence->>'eligible_rate')::numeric, \
                (evidence->>'payable_ratio')::numeric, (evidence->>'estimated_bill')::numeric, \
                amount, $3, $4, $5, $6, $7 \
           FROM charge_attention_items \
          WHERE id = $1 AND tenant_id = $2 AND kind = 'room_over_limit' \
         RETURNING id",
    )
    .bind(row)
    .bind(tenant_id)
    .bind(name)
    .bind(relation)
    .bind(consent.witness_user_id)
    .bind(&consent.disclosure_version)
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

/// Bring the open room row's bill and cut up to date before a consent keeps
/// them: the visit's room-linked charges now, as the desk's list shows them
/// (the row was raised at allocation, often at ₹0).
async fn refresh_cut(conn: &mut PgConnection, tenant_id: Uuid, row: Uuid) -> Result<(), AppError> {
    let (encounter, ratio): (Option<Uuid>, Option<Decimal>) = sqlx::query_as(
        "SELECT encounter_id, (evidence->>'payable_ratio')::numeric \
           FROM charge_attention_items WHERE id = $1 AND tenant_id = $2",
    )
    .bind(row)
    .bind(tenant_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or(AppError::NotFound)?;
    let (Some(encounter), Some(ratio)) = (encounter, ratio) else {
        return Ok(());
    };
    let bill = associated_so_far(conn, tenant_id, encounter).await?;
    sqlx::query(
        "UPDATE charge_attention_items SET amount = $3, \
                evidence = evidence || jsonb_build_object('estimated_bill', $4::numeric) \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(row)
    .bind(tenant_id)
    .bind(deduction(bill, ratio))
    .bind(bill)
    .execute(conn)
    .await?;
    Ok(())
}

/// Consent given after the allocation, from the insurance desk's inbox: the
/// open room row's numbers, brought up to date, are kept with it and the row
/// closes.
pub async fn consent_on_row(
    conn: &mut PgConnection,
    (tenant_id, actor): (Uuid, Uuid),
    row: Uuid,
    consent: &RoomConsentInput,
) -> Result<(), AppError> {
    let who = validated(conn, tenant_id, actor, consent).await?;
    refresh_cut(conn, tenant_id, row).await?;
    let id = insert_consent(conn, (tenant_id, actor, row), consent, &who).await?;
    mark_actioned(
        conn,
        tenant_id,
        actor,
        row,
        serde_json::json!({ "consent_id": id }),
    )
    .await
}

//! Refills a patient asks for, from the portal or the patient apps.
//!
//! Where a request goes is `medbrains_core::rx_refills::route_request`: due
//! refills of drugs the pharmacy may refill go straight into its queue;
//! anything else waits for the prescribing doctor, whose approval issues the
//! refill (granting one more if the written refills are used up).

use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_core::rx_refills::{
    MAX_REFILLS, RefillPolicy, RefillState, RequestRoute, route_request,
};
use medbrains_notifications::{NewNotification, create_notification};
use medbrains_server_core::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::{is_bypass_role, require_permission},
    state::AppState,
};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::{AWAITING_SUPPLY, awaiting_supply, issue_refill, refill_state};

/// Prescriptions older than this aren't offered for refill.
const RECENT_DAYS: i32 = 365;
/// How many prescriptions the patient's list shows.
const LIST_LIMIT: i64 = 20;
/// An approval keeps the prescription valid at least this long.
const APPROVAL_VALID_DAYS: i32 = 30;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct RefillRequest {
    pub id: Uuid,
    pub prescription_id: Uuid,
    pub status: String,
    pub patient_note: Option<String>,
    pub decision_note: Option<String>,
    pub decided_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// One prescription as the patient sees it for refills.
#[derive(Debug, Serialize)]
pub struct PatientRefill {
    pub prescription_id: Uuid,
    pub prescribed_at: DateTime<Utc>,
    pub doctor_name: Option<String>,
    pub drugs: Vec<String>,
    pub refills_left: i32,
    pub valid_until: Option<NaiveDate>,
    /// "pharmacy", "doctor", or null when a request can't be made now.
    pub goes_to: Option<&'static str>,
    /// What happens if they ask, or why they can't — in the patient's words.
    pub message: String,
    pub latest_request: Option<RefillRequest>,
}

#[derive(sqlx::FromRow)]
struct RxRow {
    id: Uuid,
    created_at: DateTime<Utc>,
    doctor_name: Option<String>,
    repeats_allowed: i32,
    repeats_used: i32,
    repeat_interval_days: Option<i32>,
    valid_until: Option<NaiveDate>,
}

/// Each prescription's active lines with their refill policy, in one query.
async fn line_policies(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    rx_ids: &[Uuid],
) -> Result<HashMap<Uuid, Vec<(String, RefillPolicy)>>, AppError> {
    // A line not matched to the formulary is the doctor's call.
    let rows: Vec<(Uuid, String, String, bool)> = sqlx::query_as(
        "SELECT i.prescription_id, i.drug_name, \
                COALESCE(c.refill_policy, 'doctor_approval'), \
                COALESCE(c.is_controlled OR c.drug_schedule IN ('X', 'H1', 'NDPS'), false) \
           FROM prescription_items i \
           LEFT JOIN pharmacy_catalog c ON c.id = i.catalog_item_id AND c.tenant_id = i.tenant_id \
          WHERE i.tenant_id = $1 AND i.prescription_id = ANY($2) AND i.item_status = 'active' \
          ORDER BY i.created_at",
    )
    .bind(tenant_id)
    .bind(rx_ids)
    .fetch_all(&mut **tx)
    .await?;
    let mut by_rx: HashMap<Uuid, Vec<(String, RefillPolicy)>> = HashMap::new();
    for (rx, name, policy, controlled) in rows {
        by_rx
            .entry(rx)
            .or_default()
            .push((name, RefillPolicy::parse(&policy, controlled)));
    }
    Ok(by_rx)
}

const fn state_of(rx: &RxRow, last_refill_at: Option<DateTime<Utc>>) -> RefillState {
    RefillState {
        refills: rx.repeats_allowed,
        used: rx.repeats_used,
        interval_days: rx.repeat_interval_days,
        valid_until: rx.valid_until,
        issued_at: rx.created_at,
        last_refill_at,
    }
}

fn describe(route: &RequestRoute, doctor: Option<&str>) -> (Option<&'static str>, String) {
    match route {
        RequestRoute::Pharmacy => (Some("pharmacy"), "Goes straight to the pharmacy".to_owned()),
        RequestRoute::Doctor => (
            Some("doctor"),
            doctor.map_or_else(
                || "Your doctor approves it first".to_owned(),
                |d| format!("Dr. {d} approves it first"),
            ),
        ),
        RequestRoute::Refused(why) => (None, why.clone()),
    }
}

/// The patient's recent prescriptions, with what a refill request would do.
pub async fn patient_refills(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Vec<PatientRefill>, AppError> {
    let rxs = sqlx::query_as::<_, RxRow>(
        "SELECT p.id, p.created_at, u.full_name AS doctor_name, p.repeats_allowed, \
                p.repeats_used, p.repeat_interval_days, p.valid_until \
           FROM prescriptions p \
           LEFT JOIN encounters e ON e.id = p.encounter_id AND e.tenant_id = p.tenant_id \
           LEFT JOIN users u ON u.id = p.doctor_id \
          WHERE p.tenant_id = $1 AND COALESCE(p.patient_id, e.patient_id) = $2 \
            AND p.deleted_at IS NULL AND p.admission_id IS NULL \
            AND p.created_at > now() - make_interval(days => $3) \
          ORDER BY p.created_at DESC LIMIT $4",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(RECENT_DAYS)
    .bind(LIST_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    let ids: Vec<Uuid> = rxs.iter().map(|r| r.id).collect();
    let policies = line_policies(tx, tenant_id, &ids).await?;
    let waiting = awaiting_supply(tx, tenant_id, &ids).await?;
    let last: HashMap<Uuid, DateTime<Utc>> = sqlx::query_as::<_, (Uuid, DateTime<Utc>)>(
        "SELECT prescription_id, MAX(dispensed_at) FROM pharmacy_repeats \
          WHERE tenant_id = $1 AND prescription_id = ANY($2) AND deleted_at IS NULL \
          GROUP BY prescription_id",
    )
    .bind(tenant_id)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?
    .into_iter()
    .collect();
    let mut latest: HashMap<Uuid, RefillRequest> = sqlx::query_as::<_, RefillRequest>(
        "SELECT DISTINCT ON (prescription_id) id, prescription_id, status, patient_note, \
                decision_note, decided_at, created_at \
           FROM prescription_refill_requests \
          WHERE tenant_id = $1 AND prescription_id = ANY($2) AND deleted_at IS NULL \
          ORDER BY prescription_id, created_at DESC",
    )
    .bind(tenant_id)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?
    .into_iter()
    .map(|r| (r.prescription_id, r))
    .collect();

    let now = Utc::now();
    Ok(rxs
        .into_iter()
        .filter_map(|rx| {
            let lines = policies.get(&rx.id)?;
            let state = state_of(&rx, last.get(&rx.id).copied());
            let pending = latest
                .get(&rx.id)
                .is_some_and(|r| r.status == "with_doctor");
            let route = if pending {
                RequestRoute::Refused("Your request is with your doctor".to_owned())
            } else if waiting.contains(&rx.id) {
                RequestRoute::Refused(AWAITING_SUPPLY.to_owned())
            } else {
                route_request(state, lines, now)
            };
            let (goes_to, message) = describe(&route, rx.doctor_name.as_deref());
            Some(PatientRefill {
                prescription_id: rx.id,
                prescribed_at: rx.created_at,
                doctor_name: rx.doctor_name,
                drugs: lines.iter().map(|(name, _)| name.clone()).collect(),
                refills_left: state.remaining(),
                valid_until: rx.valid_until,
                goes_to,
                message,
                latest_request: latest.remove(&rx.id),
            })
        })
        .collect())
}

/// The patient asks for a refill. Refused with the reason the list showed.
pub async fn create_request(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    prescription_id: Uuid,
    note: Option<&str>,
) -> Result<RefillRequest, AppError> {
    // Theirs, and not an inpatient order; locked against a second request.
    let rx = sqlx::query_as::<_, RxRow>(
        "SELECT p.id, p.created_at, u.full_name AS doctor_name, p.repeats_allowed, \
                p.repeats_used, p.repeat_interval_days, p.valid_until \
           FROM prescriptions p \
           LEFT JOIN encounters e ON e.id = p.encounter_id AND e.tenant_id = p.tenant_id \
           LEFT JOIN users u ON u.id = p.doctor_id \
          WHERE p.tenant_id = $1 AND p.id = $2 AND COALESCE(p.patient_id, e.patient_id) = $3 \
            AND p.deleted_at IS NULL AND p.admission_id IS NULL \
          FOR UPDATE OF p",
    )
    .bind(tenant_id)
    .bind(prescription_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let doctor_id: Uuid = sqlx::query_scalar("SELECT doctor_id FROM prescriptions WHERE id = $1")
        .bind(prescription_id)
        .fetch_one(&mut **tx)
        .await?;
    let open: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM prescription_refill_requests \
          WHERE tenant_id = $1 AND prescription_id = $2 AND status = 'with_doctor' \
            AND deleted_at IS NULL)",
    )
    .bind(tenant_id)
    .bind(prescription_id)
    .fetch_one(&mut **tx)
    .await?;
    if open {
        return Err(AppError::Conflict(
            "Your request is already with your doctor".to_owned(),
        ));
    }
    if !awaiting_supply(tx, tenant_id, &[prescription_id]).await?.is_empty() {
        return Err(AppError::Conflict(AWAITING_SUPPLY.to_owned()));
    }
    let lines = line_policies(tx, tenant_id, &[prescription_id]).await?;
    let (state, _) = refill_state(tx, tenant_id, prescription_id, false).await?;
    let route = route_request(
        state,
        lines.get(&prescription_id).map_or(&[][..], Vec::as_slice),
        Utc::now(),
    );
    let (status, rx_queue_id) = match route {
        RequestRoute::Refused(why) => return Err(AppError::Conflict(why)),
        RequestRoute::Pharmacy => {
            let row = issue_refill(
                tx,
                tenant_id,
                prescription_id,
                state.used + 1,
                None,
                Some("Requested by the patient"),
            )
            .await?;
            ("sent_to_pharmacy", row.rx_queue_id)
        }
        RequestRoute::Doctor => ("with_doctor", None),
    };
    let request = sqlx::query_as::<_, RefillRequest>(
        "INSERT INTO prescription_refill_requests \
           (tenant_id, prescription_id, patient_id, doctor_id, status, patient_note, rx_queue_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         RETURNING id, prescription_id, status, patient_note, decision_note, decided_at, created_at",
    )
    .bind(tenant_id)
    .bind(rx.id)
    .bind(patient_id)
    .bind(doctor_id)
    .bind(status)
    .bind(note.map(str::trim).filter(|n| !n.is_empty()))
    .bind(rx_queue_id)
    .fetch_one(&mut **tx)
    .await?;
    if status == "with_doctor" {
        create_notification(
            tx,
            tenant_id,
            NewNotification {
                user_id: doctor_id,
                kind: "refill_request",
                title: "A patient asked for a refill",
                body: Some("Approve or decline it in your sign-offs."),
                category: Some("clinical"),
                entity_type: Some("prescription_refill_requests"),
                entity_id: Some(request.id),
                action_url: Some("/doctor/signoffs"),
            },
        )
        .await?;
    }
    Ok(request)
}

#[derive(Debug, Deserialize)]
pub struct DecideRequest {
    pub approve: bool,
    /// Shown to the patient. Required to decline.
    pub note: Option<String>,
}

/// `POST /api/doctors/me/refill-requests/{id}/decide` — the prescriber
/// approves (the refill goes to the pharmacy) or declines with a reason.
pub async fn decide(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DecideRequest>,
) -> Result<Json<RefillRequest>, AppError> {
    require_permission(&claims, permissions::doctor::refill_requests::DECIDE)?;
    let note = body
        .note
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty());
    if !body.approve && note.is_none() {
        return Err(AppError::BadRequest(
            "Tell the patient why it was declined".to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (prescription_id, doctor_id): (Uuid, Uuid) = sqlx::query_as(
        "SELECT prescription_id, doctor_id FROM prescription_refill_requests \
          WHERE id = $1 AND tenant_id = $2 AND status = 'with_doctor' AND deleted_at IS NULL \
          FOR UPDATE",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    // The prescriber's decision; not a colleague's.
    if doctor_id != claims.sub && !is_bypass_role(&claims) {
        return Err(AppError::NotFound);
    }

    let rx_queue_id = if body.approve {
        approve(&mut tx, &claims, prescription_id).await?
    } else {
        None
    };
    let request = sqlx::query_as::<_, RefillRequest>(
        "UPDATE prescription_refill_requests \
            SET status = $3, decision_note = $4, decided_by = $5, decided_at = now(), \
                rx_queue_id = $6 \
          WHERE id = $1 AND tenant_id = $2 \
         RETURNING id, prescription_id, status, patient_note, decision_note, decided_at, created_at",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(if body.approve { "sent_to_pharmacy" } else { "declined" })
    .bind(note)
    .bind(claims.sub)
    .bind(rx_queue_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(request))
}

/// Issue the refill the doctor approved, granting one more when the written
/// refills are used up, and keeping the prescription valid for a month.
async fn approve(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    prescription_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    let lines = line_policies(tx, claims.tenant_id, &[prescription_id]).await?;
    let never: Vec<&str> = lines
        .get(&prescription_id)
        .into_iter()
        .flatten()
        .filter(|(_, p)| *p == RefillPolicy::Never)
        .map(|(name, _)| name.as_str())
        .collect();
    if !never.is_empty() {
        return Err(AppError::Conflict(format!(
            "{} can't be refilled. Write a new prescription.",
            never.join(", ")
        )));
    }
    let (refill, _) = refill_state(tx, claims.tenant_id, prescription_id, true).await?;
    if refill.remaining() == 0 && refill.refills >= MAX_REFILLS {
        return Err(AppError::Conflict(format!(
            "All {MAX_REFILLS} refills are used. Write a new prescription."
        )));
    }
    sqlx::query(
        "UPDATE prescriptions \
            SET repeats_allowed = GREATEST(repeats_allowed, repeats_used + 1), \
                valid_until = GREATEST(COALESCE(valid_until, CURRENT_DATE), \
                                       CURRENT_DATE + $3) \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(prescription_id)
    .bind(claims.tenant_id)
    .bind(APPROVAL_VALID_DAYS)
    .execute(&mut **tx)
    .await?;
    let row = issue_refill(
        tx,
        claims.tenant_id,
        prescription_id,
        refill.used + 1,
        Some(claims.sub),
        Some("Approved by the prescriber on the patient's request"),
    )
    .await?;
    Ok(row.rx_queue_id)
}

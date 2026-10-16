//! The DPDP rights desk (Act s.11-14, Rules 2025 r.14). A patient asks to see
//! what the hospital holds, to correct or erase it, to name a nominee, or
//! complains; each request is recorded the day it arrives and answered within
//! 90 days. Erasure is limited by the law that keeps the medical record, so a
//! refusal must say why.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const REQUEST_TYPES: [&str; 5] = ["access", "correction", "erasure", "nominee", "grievance"];
const CHANNELS: [&str; 5] = ["desk", "email", "phone", "letter", "portal"];

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PrivacyRequest {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub patient_name: Option<String>,
    pub uhid: Option<String>,
    pub request_type: String,
    pub details: String,
    pub received_via: String,
    pub received_at: DateTime<Utc>,
    pub due_at: DateTime<Utc>,
    pub status: String,
    pub nominee_name: Option<String>,
    pub nominee_relation: Option<String>,
    pub nominee_contact: Option<String>,
    pub decision: Option<String>,
    pub decided_by_name: Option<String>,
    pub decided_at: Option<DateTime<Utc>>,
    pub recorded_by_name: Option<String>,
}

const SELECT: &str = "SELECT r.id, r.patient_id, \
        trim(concat_ws(' ', p.first_name, p.last_name)) AS patient_name, p.uhid, \
        r.request_type, r.details, r.received_via, r.received_at, r.due_at, r.status, \
        r.nominee_name, r.nominee_relation, r.nominee_contact, r.decision, \
        d.full_name AS decided_by_name, r.decided_at, rb.full_name AS recorded_by_name \
   FROM privacy_requests r \
   JOIN patients p ON p.id = r.patient_id \
   LEFT JOIN users d ON d.id = r.decided_by \
   LEFT JOIN users rb ON rb.id = r.recorded_by";

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub status: Option<String>,
    pub patient_id: Option<Uuid>,
}

/// `GET /api/privacy-requests` — the register, soonest due first.
pub async fn list_privacy_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListQuery>,
) -> Result<Json<Vec<PrivacyRequest>>, AppError> {
    require_permission(&claims, permissions::patients::privacy_requests::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, PrivacyRequest>(&format!(
        "{SELECT} WHERE r.tenant_id = $1 AND r.deleted_at IS NULL \
           AND ($2::text IS NULL OR r.status = $2) \
           AND ($3::uuid IS NULL OR r.patient_id = $3) \
         ORDER BY (r.status = 'open') DESC, r.due_at LIMIT 500"
    ))
    .bind(claims.tenant_id)
    .bind(q.status.as_deref())
    .bind(q.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct CreatePrivacyRequest {
    pub patient_id: Uuid,
    pub request_type: String,
    pub details: String,
    pub received_via: Option<String>,
    pub nominee_name: Option<String>,
    pub nominee_relation: Option<String>,
    pub nominee_contact: Option<String>,
}

fn trimmed(v: Option<&str>) -> Option<String> {
    v.map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

/// `POST /api/privacy-requests` — the 90-day clock starts now.
pub async fn create_privacy_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePrivacyRequest>,
) -> Result<Json<PrivacyRequest>, AppError> {
    require_permission(&claims, permissions::patients::privacy_requests::CREATE)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id).await?;
    if !REQUEST_TYPES.contains(&body.request_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "request type must be one of {}",
            REQUEST_TYPES.join(", ")
        )));
    }
    let via = body.received_via.as_deref().unwrap_or("desk");
    if !CHANNELS.contains(&via) {
        return Err(AppError::BadRequest(format!(
            "received via must be one of {}",
            CHANNELS.join(", ")
        )));
    }
    let details = body.details.trim();
    if details.len() < 5 {
        return Err(AppError::BadRequest(
            "Write down what the patient asked for".to_owned(),
        ));
    }
    let nominee = trimmed(body.nominee_name.as_deref());
    if body.request_type == "nominee" && nominee.is_none() {
        return Err(AppError::BadRequest("Name the nominee".to_owned()));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO privacy_requests (tenant_id, patient_id, request_type, details, received_via, \
           nominee_name, nominee_relation, nominee_contact, recorded_by) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(&body.request_type)
    .bind(details)
    .bind(via)
    .bind(nominee)
    .bind(trimmed(body.nominee_relation.as_deref()))
    .bind(trimmed(body.nominee_contact.as_deref()))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    let row = fetch_one(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

async fn fetch_one(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<PrivacyRequest, AppError> {
    sqlx::query_as::<_, PrivacyRequest>(&format!("{SELECT} WHERE r.id = $1 AND r.tenant_id = $2"))
        .bind(id)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

#[derive(Debug, Deserialize)]
pub struct DecidePrivacyRequest {
    /// `completed` | `refused`.
    pub status: String,
    pub decision: String,
}

/// `PUT /api/privacy-requests/{id}/decide` — answered once; the answer stays.
pub async fn decide_privacy_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DecidePrivacyRequest>,
) -> Result<Json<PrivacyRequest>, AppError> {
    require_permission(&claims, permissions::patients::privacy_requests::DECIDE)?;
    if !["completed", "refused"].contains(&body.status.as_str()) {
        return Err(AppError::BadRequest(
            "A request is completed or refused".to_owned(),
        ));
    }
    let decision = body.decision.trim();
    if decision.len() < 5 {
        return Err(AppError::BadRequest(if body.status == "refused" {
            "Say why it is refused — for erasure, the law that requires the record to be kept"
                .to_owned()
        } else {
            "Say what was done".to_owned()
        }));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let updated = sqlx::query(
        "UPDATE privacy_requests SET status = $3, decision = $4, decided_by = $5, decided_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'open' AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(decision)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    if updated.rows_affected() == 0 {
        fetch_one(&mut tx, claims.tenant_id, id).await?;
        return Err(AppError::Conflict(
            "This request has already been answered".to_owned(),
        ));
    }
    let row = fetch_one(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// One kind of record the hospital holds about the patient.
#[derive(Debug, Serialize)]
pub struct HeldData {
    pub category: &'static str,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct PatientDataSummary {
    pub held: Vec<HeldData>,
    /// Distinct staff who opened the record in the last year (s.11(1)(b)).
    pub staff_who_viewed: i64,
    pub insurers: Vec<String>,
}

/// What the summary counts, by the name the patient reads.
const HELD: [(&str, &str); 12] = [
    ("Visits", "encounters"),
    ("Admissions", "admissions"),
    ("Clinical notes", "clinical_notes"),
    ("Vital signs", "vitals"),
    ("Allergies", "patient_allergies"),
    ("Lab orders", "lab_orders"),
    ("Imaging orders", "radiology_orders"),
    ("Prescriptions", "prescriptions"),
    ("Pharmacy orders", "pharmacy_orders"),
    ("Bills", "invoices"),
    ("Documents", "patient_documents"),
    ("Identity documents", "patient_identifiers"),
];

/// `GET /api/patients/{id}/data-summary` — the answer to an access request:
/// what is held, who has looked, who it is shared with.
pub async fn patient_data_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<PatientDataSummary>, AppError> {
    require_permission(&claims, permissions::patients::privacy_requests::LIST)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // One round trip: a count per table, unioned.
    let union = HELD
        .iter()
        .map(|(label, table)| {
            format!(
                "SELECT '{label}'::text AS category, COUNT(*)::int8 AS n FROM {table} \
                 WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL"
            )
        })
        .collect::<Vec<_>>()
        .join(" UNION ALL ");
    let counts: Vec<(String, i64)> = sqlx::query_as(&union)
        .bind(claims.tenant_id)
        .bind(patient_id)
        .fetch_all(&mut *tx)
        .await?;
    let held = HELD
        .iter()
        .map(|(label, _)| HeldData {
            category: label,
            count: counts
                .iter()
                .find(|(c, _)| c == label)
                .map_or(0, |(_, n)| *n),
        })
        .collect();
    let staff_who_viewed: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT user_id) FROM access_log \
         WHERE tenant_id = $1 AND patient_id = $2 AND created_at > now() - interval '1 year'",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_one(&mut *tx)
    .await?;
    let insurers: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT insurance_provider FROM patient_insurance \
         WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
           AND insurance_provider IS NOT NULL LIMIT 20",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(PatientDataSummary {
        held,
        staff_who_viewed,
        insurers,
    }))
}

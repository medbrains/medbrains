//! The people patients and CERT-In reach: the Data Protection Officer, the
//! grievance officer (DPDP Rules 2025 r.9 and r.14(3)) and the CERT-In point
//! of contact (CERT-In Directions 28-04-2022, direction (iii)). Publishing
//! puts the grievance contact on the patient portal and the printed notice.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

pub const ROLES: [&str; 3] = ["dpo", "grievance_officer", "certin_poc"];

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct Officer {
    pub role: String,
    pub user_id: Option<Uuid>,
    pub name: String,
    pub designation: String,
    pub email: String,
    pub phone: String,
    pub address: Option<String>,
    pub hours: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

pub(crate) const SELECT: &str = "SELECT role, user_id, name, designation, email, phone, address, \
        hours, published_at, updated_at FROM privacy_officers \
  WHERE tenant_id = $1 AND deleted_at IS NULL";

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

pub(crate) async fn load(tx: &mut Tx<'_>, tenant_id: Uuid) -> Result<Vec<Officer>, AppError> {
    Ok(
        sqlx::query_as::<_, Officer>(&format!("{SELECT} ORDER BY role"))
            .bind(tenant_id)
            .fetch_all(&mut **tx)
            .await?,
    )
}

/// `GET /api/regulatory/dpdp/officers`
pub async fn list_officers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Officer>>, AppError> {
    require_permission(&claims, permissions::regulatory::dpdp::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = load(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct SetOfficer {
    pub user_id: Option<Uuid>,
    pub name: String,
    pub designation: String,
    pub email: String,
    pub phone: String,
    pub address: Option<String>,
    pub hours: Option<String>,
}

fn validate(role: &str, b: &SetOfficer) -> Result<(), AppError> {
    if !ROLES.contains(&role) {
        return Err(AppError::NotFound);
    }
    let email = b.email.trim();
    let at = email.find('@');
    if !at.is_some_and(|i| i > 0 && email[i + 1..].contains('.')) {
        return Err(AppError::BadRequest("Give a working email address".into()));
    }
    if b.name.trim().chars().count() < 2 || b.designation.trim().chars().count() < 2 {
        return Err(AppError::BadRequest(
            "Give the person's name and designation".into(),
        ));
    }
    if b.phone.trim().chars().filter(char::is_ascii_digit).count() < 6 {
        return Err(AppError::BadRequest(
            "Give a phone number patients can call".into(),
        ));
    }
    Ok(())
}

/// `PUT /api/regulatory/dpdp/officers/{role}` — set or change a contact.
/// A changed contact is unpublished until published again, so patients are
/// never shown details nobody has confirmed.
pub async fn set_officer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(role): Path<String>,
    Json(b): Json<SetOfficer>,
) -> Result<Json<Vec<Officer>>, AppError> {
    require_permission(&claims, permissions::regulatory::dpdp::OFFICERS)?;
    validate(&role, &b)?;
    let trim = |s: &Option<String>| {
        s.as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(str::to_owned)
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query(
        "INSERT INTO privacy_officers (tenant_id, role, user_id, name, designation, email, phone, \
             address, hours, updated_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
         ON CONFLICT (tenant_id, role) WHERE deleted_at IS NULL DO UPDATE SET \
             user_id = EXCLUDED.user_id, name = EXCLUDED.name, designation = EXCLUDED.designation, \
             email = EXCLUDED.email, phone = EXCLUDED.phone, address = EXCLUDED.address, \
             hours = EXCLUDED.hours, updated_by = EXCLUDED.updated_by, \
             published_at = NULL, published_by = NULL",
    )
    .bind(claims.tenant_id)
    .bind(&role)
    .bind(b.user_id)
    .bind(b.name.trim())
    .bind(b.designation.trim())
    .bind(b.email.trim())
    .bind(b.phone.trim())
    .bind(trim(&b.address))
    .bind(trim(&b.hours))
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    let rows = load(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `PUT /api/regulatory/dpdp/officers/{role}/publish` — show this contact
/// to patients (portal and printed notice).
pub async fn publish_officer(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(role): Path<String>,
) -> Result<Json<Vec<Officer>>, AppError> {
    require_permission(&claims, permissions::regulatory::dpdp::OFFICERS)?;
    if !ROLES.contains(&role.as_str()) {
        return Err(AppError::NotFound);
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let done = sqlx::query(
        "UPDATE privacy_officers SET published_at = now(), published_by = $1 \
          WHERE tenant_id = $2 AND role = $3 AND deleted_at IS NULL",
    )
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .bind(&role)
    .execute(&mut *tx)
    .await?;
    if done.rows_affected() == 0 {
        return Err(AppError::BadRequest(
            "Set the contact before publishing it".into(),
        ));
    }
    let rows = load(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// What a patient is shown: published contacts only, and the published
/// privacy notice in each language.
#[derive(Debug, Serialize)]
pub struct PublicPrivacyContact {
    pub grievance_officer: Option<PublicOfficer>,
    pub dpo: Option<PublicOfficer>,
    pub notices: Vec<PublishedNotice>,
}

#[derive(Debug, Serialize)]
pub struct PublicOfficer {
    pub name: String,
    pub designation: String,
    pub email: String,
    pub phone: String,
    pub address: Option<String>,
    pub hours: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PublishedNotice {
    pub language: String,
    pub version: i32,
    pub title: String,
    pub body: String,
    pub published_at: Option<DateTime<Utc>>,
}

/// The patient-facing contact and notice, for the portal and the print.
/// Called inside a tenant-scoped transaction by the portal route.
pub async fn public_contact(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
) -> Result<PublicPrivacyContact, AppError> {
    let officers = load(tx, tenant_id).await?;
    let public = |role: &str| {
        officers
            .iter()
            .find(|o| o.role == role && o.published_at.is_some())
            .map(|o| PublicOfficer {
                name: o.name.clone(),
                designation: o.designation.clone(),
                email: o.email.clone(),
                phone: o.phone.clone(),
                address: o.address.clone(),
                hours: o.hours.clone(),
            })
    };
    let notices = sqlx::query_as::<_, PublishedNotice>(
        "SELECT language, version, title, body, published_at FROM compliance_policies \
          WHERE tenant_id = $1 AND kind = 'privacy_notice' AND status = 'published' \
            AND deleted_at IS NULL ORDER BY language",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(PublicPrivacyContact {
        grievance_officer: public("grievance_officer"),
        dpo: public("dpo"),
        notices,
    })
}

/// `GET /api/regulatory/dpdp/public-notice` — the printed notice for the
/// desk and wards: what patients see, exactly as published.
pub async fn public_notice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<PublicPrivacyContact>, AppError> {
    require_permission(&claims, permissions::regulatory::dpdp::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let out = public_contact(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(out))
}

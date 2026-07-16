//! IAM-style access requests.
//!
//! This is the user-facing layer for module permissions. Base access still
//! comes from roles, and patient/resource sharing still uses the ReBAC graph.
//! Access requests add audited, time-bound overrides to users.access_matrix.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError,
    middleware::{
        auth::Claims,
        authorization::{is_bypass_role, require_permission},
    },
    notifications::{NewNotification, create_notification},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListAccessRequestsQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccessRequest {
    pub target_user_id: Option<Uuid>,
    pub requested_permissions: Vec<String>,
    pub requested_modules: Option<Vec<String>>,
    pub resource_scope: Option<Value>,
    pub reason: String,
    pub requested_expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewAccessRequest {
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RevokeAccessRequest {
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct IamAccessRequestRow {
    pub id: Uuid,
    pub requester_id: Uuid,
    pub requester_name: String,
    pub target_user_id: Uuid,
    pub target_user_name: String,
    pub target_role: String,
    pub requested_permissions: Vec<String>,
    pub requested_modules: Vec<String>,
    pub resource_scope: Value,
    pub reason: String,
    pub requested_expires_at: Option<DateTime<Utc>>,
    pub status: String,
    pub reviewed_by: Option<Uuid>,
    pub reviewer_name: Option<String>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub review_note: Option<String>,
    pub applied_at: Option<DateTime<Utc>>,
    pub revoked_by: Option<Uuid>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revoke_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

const ELEVATED_PERMISSION_PREFIXES: &[&str] = &[
    "admin.",
    "security.",
    "hr.",
    "audit.access.",
    "pharmacy.ndps.",
    "regulatory.pcpndt.",
    "mrd.deaths.",
    "ipd.death_records.",
];

const ELEVATED_PERMISSION_CODES: &[&str] = &[
    "audit.log.export",
    "audit.break_glass.review",
    "billing.write_off.approve",
    "billing.concessions.approve",
    "pharmacy.validation.bypass",
    "pharmacy_finance.free_dispensing.approve",
    "retrospective.approve",
];

pub async fn list_access_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAccessRequestsQuery>,
) -> Result<Json<Vec<IamAccessRequestRow>>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let can_admin = is_bypass_role(&claims)
        || claims.permissions.iter().any(|p| {
            p == permissions::security::access::LIST || p == permissions::security::access::MANAGE
        });

    let rows = if can_admin {
        if let Some(status) = params.status.as_deref().filter(|s| !s.trim().is_empty()) {
            sqlx::query_as::<_, IamAccessRequestRow>(ACCESS_REQUEST_SELECT_ADMIN_FILTERED)
                .bind(claims.tenant_id)
                .bind(status)
                .fetch_all(&mut *tx)
                .await?
        } else {
            sqlx::query_as::<_, IamAccessRequestRow>(ACCESS_REQUEST_SELECT_ADMIN)
                .bind(claims.tenant_id)
                .fetch_all(&mut *tx)
                .await?
        }
    } else {
        if let Some(status) = params.status.as_deref().filter(|s| !s.trim().is_empty()) {
            sqlx::query_as::<_, IamAccessRequestRow>(ACCESS_REQUEST_SELECT_OWN_FILTERED)
                .bind(claims.tenant_id)
                .bind(claims.sub)
                .bind(status)
                .fetch_all(&mut *tx)
                .await?
        } else {
            sqlx::query_as::<_, IamAccessRequestRow>(ACCESS_REQUEST_SELECT_OWN)
                .bind(claims.tenant_id)
                .bind(claims.sub)
                .fetch_all(&mut *tx)
                .await?
        }
    };

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_access_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAccessRequest>,
) -> Result<Json<IamAccessRequestRow>, AppError> {
    let target_user_id = body.target_user_id.unwrap_or(claims.sub);
    if target_user_id != claims.sub {
        require_permission(&claims, permissions::security::access::MANAGE)?;
    }

    let requested_permissions =
        normalize_codes("requested_permissions", body.requested_permissions, 100)?;
    let requested_modules = normalize_modules(body.requested_modules, &requested_permissions);
    let reason = body.reason.trim().to_owned();
    if reason.len() < 3 {
        return Err(AppError::BadRequest(
            "reason must be at least 3 characters".to_owned(),
        ));
    }
    let requested_expires_at = body.requested_expires_at.ok_or_else(|| {
        AppError::BadRequest("requested_expires_at is required for temporary access".to_owned())
    })?;
    if requested_expires_at <= Utc::now() {
        return Err(AppError::BadRequest(
            "requested_expires_at must be in the future".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let target_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 AND is_active = true)",
    )
    .bind(target_user_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    if !target_exists {
        return Err(AppError::NotFound);
    }

    let inserted_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO iam_access_requests \
         (tenant_id, requester_id, target_user_id, requested_permissions, requested_modules, \
          resource_scope, reason, requested_expires_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(target_user_id)
    .bind(&requested_permissions)
    .bind(&requested_modules)
    .bind(
        body.resource_scope
            .unwrap_or_else(|| Value::Object(Map::new())),
    )
    .bind(reason)
    .bind(requested_expires_at)
    .fetch_one(&mut *tx)
    .await?;

    let row = fetch_access_request(&mut tx, claims.tenant_id, inserted_id).await?;
    tx.commit().await?;
    Ok(Json(row))
}

pub async fn approve_access_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewAccessRequest>,
) -> Result<Json<IamAccessRequestRow>, AppError> {
    require_permission(&claims, permissions::security::access::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = fetch_access_request(&mut tx, claims.tenant_id, id).await?;
    if row.status != "pending" {
        return Err(AppError::Conflict(format!(
            "request is already {}",
            row.status
        )));
    }
    if let Some(expires_at) = row.requested_expires_at {
        if expires_at <= Utc::now() {
            sqlx::query(
                "UPDATE iam_access_requests \
                 SET status = 'expired', reviewed_by = $3, reviewed_at = now(), review_note = $4 \
                 WHERE id = $1 AND tenant_id = $2",
            )
            .bind(id)
            .bind(claims.tenant_id)
            .bind(claims.sub)
            .bind(body.note.as_deref())
            .execute(&mut *tx)
            .await?;
            return Err(AppError::Conflict(
                "request expired before approval".to_owned(),
            ));
        }
    }
    validate_review_authority(&claims, &row)?;

    let access_matrix = sqlx::query_scalar::<_, Value>(
        "SELECT access_matrix FROM users WHERE id = $1 AND tenant_id = $2",
    )
    .bind(row.target_user_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let grant = serde_json::json!({
        "request_id": row.id,
        "permissions": row.requested_permissions,
        "modules": row.requested_modules,
        "resource_scope": row.resource_scope,
        "reason": row.reason,
        "approved_by": claims.sub,
        "approved_at": Utc::now().to_rfc3339(),
        "expires_at": row.requested_expires_at.map(|d| d.to_rfc3339()),
        "revoked_at": null,
    });
    let updated_matrix = append_temporary_grant(access_matrix, grant);

    sqlx::query(
        "UPDATE users SET access_matrix = $1, perm_version = perm_version + 1 \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(updated_matrix)
    .bind(row.target_user_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE iam_access_requests \
         SET status = 'approved', reviewed_by = $3, reviewed_at = now(), review_note = $4, applied_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(body.note.as_deref())
    .execute(&mut *tx)
    .await?;

    create_notification(
        &mut tx,
        claims.tenant_id,
        NewNotification {
            user_id: row.requester_id,
            kind: "success",
            title: "Access request approved",
            body: Some(row.reason.as_str()),
            category: Some("Access"),
            entity_type: Some("access_request"),
            entity_id: Some(row.id),
            action_url: Some("/admin/access-requests"),
        },
    )
    .await?;

    let updated = fetch_access_request(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(updated))
}

pub async fn reject_access_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewAccessRequest>,
) -> Result<Json<IamAccessRequestRow>, AppError> {
    require_permission(&claims, permissions::security::access::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = fetch_access_request(&mut tx, claims.tenant_id, id).await?;
    if row.status != "pending" {
        return Err(AppError::Conflict(format!(
            "request is already {}",
            row.status
        )));
    }
    validate_review_authority(&claims, &row)?;

    sqlx::query(
        "UPDATE iam_access_requests \
         SET status = 'rejected', reviewed_by = $3, reviewed_at = now(), review_note = $4 \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(body.note.as_deref())
    .execute(&mut *tx)
    .await?;

    create_notification(
        &mut tx,
        claims.tenant_id,
        NewNotification {
            user_id: row.requester_id,
            kind: "warning",
            title: "Access request rejected",
            body: body.note.as_deref().or(Some(row.reason.as_str())),
            category: Some("Access"),
            entity_type: Some("access_request"),
            entity_id: Some(row.id),
            action_url: Some("/admin/access-requests"),
        },
    )
    .await?;

    let updated = fetch_access_request(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(updated))
}

pub async fn revoke_access_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RevokeAccessRequest>,
) -> Result<Json<IamAccessRequestRow>, AppError> {
    require_permission(&claims, permissions::security::access::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row = fetch_access_request(&mut tx, claims.tenant_id, id).await?;
    if !matches!(row.status.as_str(), "approved" | "pending") {
        return Err(AppError::Conflict(format!(
            "request is already {}",
            row.status
        )));
    }
    validate_review_authority(&claims, &row)?;

    if row.status == "approved" {
        let access_matrix = sqlx::query_scalar::<_, Value>(
            "SELECT access_matrix FROM users WHERE id = $1 AND tenant_id = $2",
        )
        .bind(row.target_user_id)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        let updated_matrix =
            revoke_temporary_grant(access_matrix, id, claims.sub, body.reason.as_deref());

        sqlx::query(
            "UPDATE users SET access_matrix = $1, perm_version = perm_version + 1 \
             WHERE id = $2 AND tenant_id = $3",
        )
        .bind(updated_matrix)
        .bind(row.target_user_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    sqlx::query(
        "UPDATE iam_access_requests \
         SET status = 'revoked', revoked_by = $3, revoked_at = now(), revoke_reason = $4 \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(body.reason.as_deref())
    .execute(&mut *tx)
    .await?;

    let updated = fetch_access_request(&mut tx, claims.tenant_id, id).await?;
    tx.commit().await?;
    Ok(Json(updated))
}

async fn fetch_access_request(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<IamAccessRequestRow, AppError> {
    sqlx::query_as::<_, IamAccessRequestRow>(ACCESS_REQUEST_SELECT_BY_ID)
        .bind(tenant_id)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

fn normalize_codes(
    field: &str,
    values: Vec<String>,
    limit: usize,
) -> Result<Vec<String>, AppError> {
    let mut out = Vec::new();
    for raw in values {
        let value = raw.trim();
        if value.is_empty() {
            continue;
        }
        if value.len() > 160
            || !value
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
        {
            return Err(AppError::BadRequest(format!(
                "{field} contains invalid code: {value}"
            )));
        }
        if !out.iter().any(|existing| existing == value) {
            out.push(value.to_owned());
        }
    }
    if out.is_empty() {
        return Err(AppError::BadRequest(format!("{field} cannot be empty")));
    }
    if out.len() > limit {
        return Err(AppError::BadRequest(format!(
            "{field} cannot exceed {limit} entries"
        )));
    }
    Ok(out)
}

fn normalize_modules(requested: Option<Vec<String>>, permissions: &[String]) -> Vec<String> {
    let source = requested.unwrap_or_else(|| {
        permissions
            .iter()
            .filter_map(|p| p.split('.').next().map(str::to_owned))
            .collect()
    });

    let mut out = Vec::new();
    for raw in source {
        let value = raw.trim();
        if value.is_empty() {
            continue;
        }
        if !out.iter().any(|existing| existing == value) {
            out.push(value.to_owned());
        }
    }
    out.sort();
    out
}

fn is_elevated_permission(permission: &str) -> bool {
    ELEVATED_PERMISSION_CODES.contains(&permission)
        || ELEVATED_PERMISSION_PREFIXES
            .iter()
            .any(|prefix| permission.starts_with(prefix))
}

fn validate_review_authority(claims: &Claims, row: &IamAccessRequestRow) -> Result<(), AppError> {
    if claims.sub == row.requester_id || claims.sub == row.target_user_id {
        return Err(AppError::Conflict(
            "access requests require a different reviewer".to_owned(),
        ));
    }

    if row
        .requested_permissions
        .iter()
        .any(|permission| is_elevated_permission(permission))
        && !is_bypass_role(claims)
    {
        return Err(AppError::Forbidden);
    }

    Ok(())
}

fn ensure_matrix_object(value: Value) -> Map<String, Value> {
    match value {
        Value::Object(map) => map,
        _ => Map::new(),
    }
}

fn append_temporary_grant(matrix: Value, grant: Value) -> Value {
    let mut map = ensure_matrix_object(matrix);
    let request_id = grant.get("request_id").cloned();
    let mut grants = map
        .remove("temporary_grants")
        .and_then(|v| match v {
            Value::Array(arr) => Some(arr),
            _ => None,
        })
        .unwrap_or_default();

    if let Some(request_id) = request_id {
        grants.retain(|existing| existing.get("request_id") != Some(&request_id));
    }
    grants.push(grant);
    map.insert("temporary_grants".to_owned(), Value::Array(grants));
    Value::Object(map)
}

fn revoke_temporary_grant(
    matrix: Value,
    request_id: Uuid,
    revoked_by: Uuid,
    reason: Option<&str>,
) -> Value {
    let mut map = ensure_matrix_object(matrix);
    let mut grants = map
        .remove("temporary_grants")
        .and_then(|v| match v {
            Value::Array(arr) => Some(arr),
            _ => None,
        })
        .unwrap_or_default();
    let request_id_text = request_id.to_string();

    for grant in &mut grants {
        if grant.get("request_id").and_then(Value::as_str) == Some(request_id_text.as_str()) {
            if let Value::Object(grant_map) = grant {
                grant_map.insert(
                    "revoked_at".to_owned(),
                    Value::String(Utc::now().to_rfc3339()),
                );
                grant_map.insert(
                    "revoked_by".to_owned(),
                    Value::String(revoked_by.to_string()),
                );
                if let Some(reason) = reason.filter(|r| !r.trim().is_empty()) {
                    grant_map.insert(
                        "revoke_reason".to_owned(),
                        Value::String(reason.trim().to_owned()),
                    );
                }
            }
        }
    }

    map.insert("temporary_grants".to_owned(), Value::Array(grants));
    Value::Object(map)
}

macro_rules! access_request_select {
    ($where_clause:literal) => {
        concat!(
            "SELECT r.id, r.requester_id, requester.full_name AS requester_name, ",
            "r.target_user_id, target.full_name AS target_user_name, target.role::text AS target_role, ",
            "r.requested_permissions, r.requested_modules, r.resource_scope, r.reason, ",
            "r.requested_expires_at, r.status::text AS status, r.reviewed_by, ",
            "reviewer.full_name AS reviewer_name, r.reviewed_at, r.review_note, r.applied_at, ",
            "r.revoked_by, r.revoked_at, r.revoke_reason, r.created_at, r.updated_at ",
            "FROM iam_access_requests r ",
            "JOIN users requester ON requester.id = r.requester_id ",
            "JOIN users target ON target.id = r.target_user_id ",
            "LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by ",
            $where_clause
        )
    };
}

const ACCESS_REQUEST_SELECT_ADMIN: &str =
    access_request_select!("WHERE r.tenant_id = $1 ORDER BY r.created_at DESC");

const ACCESS_REQUEST_SELECT_ADMIN_FILTERED: &str = access_request_select!(
    "WHERE r.tenant_id = $1 AND r.status = $2::iam_access_request_status ORDER BY r.created_at DESC"
);

const ACCESS_REQUEST_SELECT_OWN: &str = access_request_select!(
    "WHERE r.tenant_id = $1 AND (r.requester_id = $2 OR r.target_user_id = $2) ORDER BY r.created_at DESC"
);

const ACCESS_REQUEST_SELECT_OWN_FILTERED: &str = access_request_select!(
    "WHERE r.tenant_id = $1 AND (r.requester_id = $2 OR r.target_user_id = $2) AND r.status = $3::iam_access_request_status ORDER BY r.created_at DESC"
);

const ACCESS_REQUEST_SELECT_BY_ID: &str =
    access_request_select!("WHERE r.tenant_id = $1 AND r.id = $2");

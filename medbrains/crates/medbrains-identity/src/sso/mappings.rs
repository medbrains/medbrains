//! Directory-group mappings: which role or access group a provider's group grants at sign-in. A mapping hands
//! its grant to everyone in the group, so only an administrator makes or removes one, and it never names an
//! administrator role.

use axum::extract::rejection::JsonRejection;
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError,
    middleware::{
        auth::Claims,
        authorization::{BYPASS_ROLES, require_any_permission},
    },
    state::AppState,
};

use super::{MANAGE, MANAGE_PROVIDERS};
use crate::require_identity_admin;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct GroupMapping {
    pub id: Uuid,
    pub provider_id: Uuid,
    pub idp_group: String,
    pub role_code: Option<String>,
    pub access_group_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMappingRequest {
    pub idp_group: String,
    pub role_code: Option<String>,
    pub access_group_id: Option<Uuid>,
}

/// GET /api/admin/sso/providers/{id}/mappings
pub async fn list_mappings(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(provider_id): Path<Uuid>,
) -> Result<Json<Vec<GroupMapping>>, AppError> {
    require_any_permission(&claims, &[MANAGE, MANAGE_PROVIDERS])?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, GroupMapping>(
        "SELECT id, provider_id, idp_group, role_code, access_group_id, created_at \
         FROM idp_group_mappings WHERE provider_id = $1 ORDER BY idp_group LIMIT 500",
    )
    .bind(provider_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/admin/sso/providers/{id}/mappings
pub async fn create_mapping(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(provider_id): Path<Uuid>,
    req: Result<Json<CreateMappingRequest>, JsonRejection>,
) -> Result<Json<GroupMapping>, AppError> {
    require_identity_admin(&claims, MANAGE_PROVIDERS)?;
    let Json(req) = req?;
    if req.role_code.is_none() && req.access_group_id.is_none() {
        return Err(AppError::BadRequest(
            "a mapping must set role_code and/or access_group_id".to_owned(),
        ));
    }
    if req
        .role_code
        .as_deref()
        .is_some_and(|role| BYPASS_ROLES.contains(&role))
    {
        return Err(AppError::BadRequest(
            "A directory group cannot be mapped to an administrator role. Give administrators their \
             role by hand."
                .to_owned(),
        ));
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM identity_providers WHERE id = $1")
        .bind(provider_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;
    let row = sqlx::query_as::<_, GroupMapping>(
        "INSERT INTO idp_group_mappings (tenant_id, provider_id, idp_group, role_code, access_group_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, provider_id, idp_group, role_code, access_group_id, created_at",
    )
    .bind(claims.tenant_id)
    .bind(provider_id)
    .bind(&req.idp_group)
    .bind(&req.role_code)
    .bind(req.access_group_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// DELETE /api/admin/sso/mappings/{id}
pub async fn delete_mapping(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_identity_admin(&claims, MANAGE_PROVIDERS)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query("DELETE FROM idp_group_mappings WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

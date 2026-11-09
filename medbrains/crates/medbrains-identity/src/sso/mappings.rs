//! Directory-group mappings: which role or access group a provider's group grants at sign-in. A mapping hands
//! its grant to everyone in the group, so it never names an administrator role, and a non-administrator maps
//! only what they hold themselves, and nothing on the OS's own Kanidm.

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
        authorization::{BYPASS_ROLES, require_any_permission, require_permission},
    },
    os_identity::KANIDM_CODE,
    state::AppState,
};

use super::{MANAGE, MANAGE_PROVIDERS};
use crate::sso_link::target::{is_admin, is_group_member, mapping_role_refusal};

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
    require_permission(&claims, MANAGE_PROVIDERS)?;
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
    let code: String = sqlx::query_scalar("SELECT code FROM identity_providers WHERE id = $1")
        .bind(provider_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;
    if !is_admin(&claims) {
        guard_mapping_grant(&mut tx, &claims, &code, &req).await?;
    }
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

/// The refusal for a mapping on the OS's own Kanidm by anyone but an administrator.
const KANIDM_MAPPING: &str =
    "Only an administrator may change what the machine's own sign-in service's groups grant.";

/// Refuses a non-administrator's mapping that grants more than they hold: any mapping on the OS's own Kanidm,
/// a role with a code they lack or an `admin.*` power, or an access group they are not in.
async fn guard_mapping_grant(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    provider_code: &str,
    req: &CreateMappingRequest,
) -> Result<(), AppError> {
    if provider_code == KANIDM_CODE {
        return Err(AppError::ForbiddenReason(KANIDM_MAPPING.to_owned()));
    }
    if let Some(role) = req.role_code.as_deref() {
        let permissions: serde_json::Value = sqlx::query_scalar(
            "SELECT permissions FROM roles WHERE code = $1 AND is_active = true",
        )
        .bind(role)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| AppError::BadRequest("There is no such role.".to_owned()))?;
        // Unreadable codes refuse, never read as "none".
        let codes: Vec<String> = serde_json::from_value(permissions)
            .map_err(|e| AppError::Internal(format!("role permissions unreadable: {e}")))?;
        if let Some(reason) = mapping_role_refusal(&claims.permissions, &codes) {
            return Err(AppError::ForbiddenReason(reason.to_owned()));
        }
    }
    if let Some(group) = req.access_group_id
        && !is_group_member(tx, claims.sub, group).await?
    {
        return Err(AppError::ForbiddenReason(
            "You are not in this access group. Ask an administrator to map it.".to_owned(),
        ));
    }
    Ok(())
}

/// DELETE /api/admin/sso/mappings/{id}
pub async fn delete_mapping(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, MANAGE_PROVIDERS)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let code: Option<String> = sqlx::query_scalar(
        "SELECT p.code FROM idp_group_mappings m JOIN identity_providers p ON p.id = m.provider_id \
         WHERE m.id = $1",
    )
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;
    if code.as_deref() == Some(KANIDM_CODE) && !is_admin(&claims) {
        return Err(AppError::ForbiddenReason(KANIDM_MAPPING.to_owned()));
    }
    sqlx::query("DELETE FROM idp_group_mappings WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

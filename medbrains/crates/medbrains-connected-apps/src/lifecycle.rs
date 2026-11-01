//! Approve, revoke and re-key a connected app — the decisions a hospital
//! makes about an app after it is registered.

use axum::extract::rejection::JsonRejection;
use axum::extract::{Path, State};
use axum::{Extension, Json};
use medbrains_core::permissions;
use medbrains_kernel::authz::is_bypass_role;
use medbrains_kernel::{Actor, AppError, Claims, require_permission};
use medbrains_server_core::middleware::connected_app::new_client_secret;
use medbrains_server_core::state::AppState;
use uuid::Uuid;

use crate::{IssuedCredentials, RevokeRequest, record};

/// A person may not let in an app wider than themselves; otherwise
/// `connected_apps.manage` is a route to every permission in the system.
fn refuse_escalation(claims: &Claims, granted: &[String]) -> Result<(), AppError> {
    if is_bypass_role(claims) {
        return Ok(());
    }
    let missing: Vec<&str> = granted
        .iter()
        .map(String::as_str)
        .filter(|code| !claims.permissions.iter().any(|held| held == code))
        .collect();
    if missing.is_empty() {
        return Ok(());
    }
    Err(AppError::ForbiddenReason(format!(
        "You cannot approve an app with permissions you do not hold yourself: {}.",
        missing.join(", ")
    )))
}

pub(crate) async fn approve(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::connected_apps::MANAGE)?;
    let tenant = claims.tenant_id;
    medbrains_kernel::work(&state.db, Actor::from_claims(&claims), async |tx| {
        let row = sqlx::query!(
            "SELECT status, permissions, webhook_subscription_id FROM connected_apps \
              WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
            id,
            tenant,
        )
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)?;
        if row.status != "pending" {
            return Err(AppError::Conflict(format!("This app is {} — only a pending app can be approved", row.status)));
        }
        let granted: Vec<String> = serde_json::from_value(row.permissions.clone())
            .map_err(|e| AppError::Internal(format!("app permissions: {e}")))?;
        refuse_escalation(&claims, &granted)?;

        sqlx::query!(
            "UPDATE connected_apps SET status = 'approved', approved_at = now(), approved_by = $3 \
              WHERE id = $1 AND tenant_id = $2",
            id,
            tenant,
            claims.sub,
        )
        .execute(&mut **tx)
        .await?;
        if let Some(subscription) = row.webhook_subscription_id {
            sqlx::query!(
                "UPDATE webhook_subscriptions SET is_active = true WHERE id = $1 AND tenant_id = $2",
                subscription,
                tenant,
            )
            .execute(&mut **tx)
            .await?;
        }
        record(tx, "connected_app_approved", id, &serde_json::json!({ "permissions": granted })).await?;
        Ok(Json(serde_json::json!({ "approved": true })))
    })
    .await
}

pub(crate) async fn revoke(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    body: Result<Json<RevokeRequest>, JsonRejection>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::connected_apps::MANAGE)?;
    let Json(body) = body?;
    let tenant = claims.tenant_id;
    medbrains_kernel::work(&state.db, Actor::from_claims(&claims), async |tx| {
        // `status <> 'revoked'` in the predicate: two admins revoking at once
        // must not both report success.
        let row = sqlx::query!(
            "UPDATE connected_apps SET status = 'revoked', revoked_at = now(), revoked_by = $3, \
                    revoke_reason = $4 \
              WHERE id = $1 AND tenant_id = $2 AND status <> 'revoked' AND deleted_at IS NULL \
              RETURNING service_user_id, webhook_subscription_id",
            id,
            tenant,
            claims.sub,
            body.reason.as_deref(),
        )
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)?;

        // All three in this transaction, so there is no moment when the app is
        // revoked but a token still works.
        let tokens = sqlx::query!(
            "UPDATE api_keys SET revoked_at = now(), revoked_by = $3, revoke_reason = 'app revoked' \
              WHERE connected_app_id = $1 AND tenant_id = $2 AND revoked_at IS NULL",
            id,
            tenant,
            claims.sub,
        )
        .execute(&mut **tx)
        .await?
        .rows_affected();
        sqlx::query!(
            "UPDATE users SET is_active = false WHERE id = $1 AND tenant_id = $2 AND is_service_account",
            row.service_user_id,
            tenant,
        )
        .execute(&mut **tx)
        .await?;
        if let Some(subscription) = row.webhook_subscription_id {
            sqlx::query!(
                "UPDATE webhook_subscriptions SET is_active = false WHERE id = $1 AND tenant_id = $2",
                subscription,
                tenant,
            )
            .execute(&mut **tx)
            .await?;
        }
        let values = serde_json::json!({ "reason": body.reason, "tokens_revoked": tokens });
        record(tx, "connected_app_revoked", id, &values).await?;
        Ok(Json(serde_json::json!({ "revoked": true, "tokens_revoked": tokens })))
    })
    .await
}

/// A new client secret, shown once. The old one stops at once and every
/// token issued under it is revoked — a rotation is usually a leak response.
pub(crate) async fn rotate_secret(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<IssuedCredentials>, AppError> {
    require_permission(&claims, permissions::admin::connected_apps::MANAGE)?;
    let secret = new_client_secret()?;
    let tenant = claims.tenant_id;
    let client_id = medbrains_kernel::work(&state.db, Actor::from_claims(&claims), async |tx| {
        let client_id = sqlx::query_scalar!(
            "UPDATE connected_apps SET client_secret_hash = $3, secret_prefix = $4, \
                    secret_rotated_at = now() \
              WHERE id = $1 AND tenant_id = $2 AND status <> 'revoked' AND deleted_at IS NULL \
              RETURNING client_id",
            id,
            tenant,
            &secret.hash,
            &secret.prefix,
        )
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)?;
        sqlx::query!(
            "UPDATE api_keys SET revoked_at = now(), revoked_by = $3, revoke_reason = 'secret rotated' \
              WHERE connected_app_id = $1 AND tenant_id = $2 AND revoked_at IS NULL",
            id,
            tenant,
            claims.sub,
        )
        .execute(&mut **tx)
        .await?;
        record(tx, "connected_app_secret_rotated", id, &serde_json::json!({ "prefix": secret.prefix })).await?;
        Ok(client_id)
    })
    .await?;
    Ok(Json(IssuedCredentials {
        id,
        client_id,
        client_secret: secret.secret,
        webhook_signing_secret: None,
    }))
}

#[cfg(test)]
mod tests {
    use super::refuse_escalation;
    use medbrains_kernel::Claims;
    use uuid::Uuid;

    fn claims(role: &str, permissions: &[&str]) -> Claims {
        Claims {
            sub: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            role: role.to_owned(),
            permissions: permissions.iter().map(|p| (*p).to_owned()).collect(),
            department_ids: Vec::new(),
            perm_version: 0,
            paired_device_id: None,
            act: None,
            exp: 0,
        }
    }

    #[test]
    fn nobody_approves_an_app_wider_than_themselves() {
        let granted = vec!["patients.view".to_owned(), "lab.orders.view".to_owned()];
        assert!(refuse_escalation(&claims("audit_officer", &["patients.view"]), &granted).is_err());
        assert!(
            refuse_escalation(
                &claims("x", &["patients.view", "lab.orders.view"]),
                &granted
            )
            .is_ok()
        );
        assert!(refuse_escalation(&claims("hospital_admin", &[]), &granted).is_ok());
    }
}

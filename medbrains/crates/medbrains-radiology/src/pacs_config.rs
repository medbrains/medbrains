//! Settings → the hospital's PACS: its address, username and password.
//!
//! The password is write-only. It is sealed to the tenant, address and
//! username (`medbrains_outbox::handlers::pacs_target`) and never returned —
//! the screen learns only whether one is saved. A new address or username
//! needs the password entered again, so changing where the PACS is can never
//! carry the saved password to a new host. The address must pass the network
//! policy before it is stored, and every change is audited without secrets.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use medbrains_outbox::handlers::pacs_target::{self, PacsError, Policy, SEALED_PASSWORD_KEY};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{Postgres, Transaction};

#[derive(Debug, Deserialize)]
pub struct PacsConfigRequest {
    #[serde(default)]
    pub orthanc_url: String,
    #[serde(default)]
    pub orthanc_username: String,
    /// Absent or empty keeps the saved password, when the address and
    /// username are unchanged.
    pub orthanc_password: Option<String>,
    pub viewer_type: Option<String>,
    pub auto_sync: Option<bool>,
    pub sync_interval_minutes: Option<i64>,
}

fn text(config: &Value, key: &str) -> String {
    config
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_owned()
}

/// The configuration as a client may see it: no sealed password, only
/// whether one is saved.
fn redacted(config: Option<Value>) -> Value {
    let mut config = config.unwrap_or_else(|| {
        json!({
            "orthanc_url": "", "orthanc_username": "", "viewer_type": "ohif",
            "auto_sync": false, "sync_interval_minutes": 15
        })
    });
    let saved = config
        .get(SEALED_PASSWORD_KEY)
        .is_some_and(Value::is_string);
    if let Some(map) = config.as_object_mut() {
        map.remove(SEALED_PASSWORD_KEY);
        map.insert("password_set".to_owned(), json!(saved));
    }
    config
}

async fn stored(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    lock: bool,
) -> Result<Option<Value>, AppError> {
    let sql = if lock {
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = 'radiology' \
           AND key = 'pacs_config' AND deleted_at IS NULL FOR UPDATE"
    } else {
        "SELECT value FROM tenant_settings WHERE tenant_id = $1 AND category = 'radiology' \
           AND key = 'pacs_config' AND deleted_at IS NULL"
    };
    Ok(sqlx::query_scalar(sql)
        .bind(claims.tenant_id)
        .fetch_optional(&mut **tx)
        .await?)
}

async fn open_tx<'a>(
    state: &'a AppState,
    claims: &Claims,
) -> Result<Transaction<'a, Postgres>, AppError> {
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "radiology",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    Ok(tx)
}

fn to_app_error(error: PacsError) -> AppError {
    match error {
        PacsError::NotAllowed(msg) => AppError::BadRequest(msg),
        PacsError::NotSetUp(msg) => AppError::ServiceUnavailable(msg),
        PacsError::Db(e) => AppError::Internal(format!("PACS settings: {e}")),
    }
}

/// GET /api/radiology/pacs-config
pub async fn get_pacs_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::radiology::orders::LIST)?;
    let mut tx = open_tx(&state, &claims).await?;
    let config = stored(&mut tx, &claims, false).await?;
    tx.commit().await?;
    Ok(Json(redacted(config)))
}

/// The sealed password the new settings carry, or why they cannot be saved.
async fn next_sealed(
    state: &AppState,
    claims: &Claims,
    old: Option<&Value>,
    url: &str,
    body: &PacsConfigRequest,
) -> Result<Option<String>, AppError> {
    let username = body.orthanc_username.trim();
    if url.is_empty() || username.is_empty() {
        return Ok(None);
    }
    if let Some(password) = body.orthanc_password.as_deref().filter(|p| !p.is_empty()) {
        let key = pacs_target::sealing_key(state.secret_resolver.as_ref())
            .await
            .map_err(to_app_error)?;
        return pacs_target::seal(&key, claims.tenant_id, url, username, password)
            .map(Some)
            .map_err(to_app_error);
    }
    let unchanged = old.is_some_and(|o| {
        pacs_target::normalize_url(&text(o, "orthanc_url")) == url
            && text(o, "orthanc_username") == username
    });
    let kept = old
        .filter(|_| unchanged)
        .and_then(|o| o.get(SEALED_PASSWORD_KEY))
        .and_then(Value::as_str);
    match kept {
        Some(sealed) => Ok(Some(sealed.to_owned())),
        None if unchanged => Err(AppError::BadRequest(format!(
            "Enter the PACS password for {username}"
        ))),
        None => Err(AppError::BadRequest(
            "Enter the PACS password again: a new address or username needs it, so the saved \
             password is never sent anywhere new"
                .to_owned(),
        )),
    }
}

/// What the audit row records: where, who, and whether the password changed.
fn audit_view(config: Option<&Value>) -> Value {
    config.map_or(Value::Null, |c| {
        json!({
            "orthanc_url": text(c, "orthanc_url"),
            "orthanc_username": text(c, "orthanc_username"),
            "password_set": c.get(SEALED_PASSWORD_KEY).is_some_and(Value::is_string),
        })
    })
}

/// PUT /api/radiology/pacs-config
pub async fn update_pacs_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<PacsConfigRequest>,
) -> Result<Json<Value>, AppError> {
    // Where the PACS is decides where patient worklists and the PACS password
    // go — a management action, not the orders::LIST read permission.
    require_permission(&claims, permissions::radiology::modalities::MANAGE)?;
    let url = pacs_target::normalize_url(&body.orthanc_url);
    if !url.is_empty() {
        pacs_target::vet(&url, &Policy::from_env())
            .await
            .map_err(to_app_error)?;
    }
    let mut tx = open_tx(&state, &claims).await?;
    let old = stored(&mut tx, &claims, true).await?;
    let sealed = next_sealed(&state, &claims, old.as_ref(), &url, &body).await?;
    let mut value = json!({
        "orthanc_url": url,
        "orthanc_username": body.orthanc_username.trim(),
        "viewer_type": body.viewer_type.as_deref().unwrap_or("ohif"),
        "auto_sync": body.auto_sync.unwrap_or(!url.is_empty()),
        "sync_interval_minutes": body.sync_interval_minutes.unwrap_or(15),
    });
    if let (Some(sealed), Some(map)) = (sealed, value.as_object_mut()) {
        map.insert(SEALED_PASSWORD_KEY.to_owned(), json!(sealed));
    }
    sqlx::query(
        "INSERT INTO tenant_settings (id, tenant_id, category, key, value) \
         VALUES (gen_random_uuid(), $1, 'radiology', 'pacs_config', $2) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE SET deleted_at = NULL, \
           deleted_by = NULL, delete_reason = NULL, value = $2, updated_at = now()",
    )
    .bind(claims.tenant_id)
    .bind(&value)
    .execute(&mut *tx)
    .await?;
    let mut new_values = audit_view(Some(&value));
    new_values["password_changed"] = json!(
        body.orthanc_password
            .as_deref()
            .is_some_and(|p| !p.is_empty())
    );
    let old_values = audit_view(old.as_ref());
    medbrains_db::audit::AuditLogger::log(
        &mut tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "radiology.pacs_config.update",
            entity_type: "pacs_config",
            entity_id: None,
            old_values: Some(&old_values),
            new_values: Some(&new_values),
            ip_address: None,
        },
    )
    .await?;
    tx.commit().await?;
    Ok(Json(redacted(Some(value))))
}

#[cfg(test)]
mod tests {
    use super::{SEALED_PASSWORD_KEY, redacted};
    use serde_json::json;

    #[test]
    fn the_sealed_password_never_leaves_the_server() {
        let out = redacted(Some(
            json!({ "orthanc_url": "http://10.0.0.5", SEALED_PASSWORD_KEY: "mbx.abc" }),
        ));
        assert!(out.get(SEALED_PASSWORD_KEY).is_none());
        assert_eq!(out["password_set"], true);
        assert_eq!(redacted(None)["password_set"], false);
    }
}

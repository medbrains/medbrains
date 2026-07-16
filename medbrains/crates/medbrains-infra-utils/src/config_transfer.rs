//! Tenant configuration export/import (audit P2 #210): promote
//! staging-validated configuration to production exactly.
//!
//! Bundle = versioned JSON of `tenant_settings` (category/key/value)
//! plus active `document_templates` overrides. Import is two-phase:
//! `dry_run: true` returns the per-entry diff (create / update /
//! unchanged) without touching anything; the apply path upserts in one
//! transaction and writes an audit entry. Secrets never live in
//! tenant_settings (they're in the secret resolver), so bundles are
//! safe to move between environments.

use axum::{Extension, Json, extract::State};
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use medbrains_core::permissions;

const BUNDLE_VERSION: i32 = 1;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct SettingEntry {
    pub category: String,
    pub key: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct TemplateEntry {
    pub code: String,
    pub name: String,
    pub module_code: Option<String>,
    pub body_layout: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfigBundle {
    pub bundle_version: i32,
    pub exported_at: String,
    pub settings: Vec<SettingEntry>,
    pub document_templates: Vec<TemplateEntry>,
}

/// GET /api/setup/config-export
pub async fn export_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ConfigBundle>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let settings = sqlx::query_as::<_, SettingEntry>(
        "SELECT category, key, value FROM tenant_settings \
         WHERE tenant_id = $1 AND deleted_at IS NULL \
         ORDER BY category, key",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let document_templates = sqlx::query_as::<_, TemplateEntry>(
        "SELECT code, name, module_code, body_layout FROM document_templates \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY code",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(ConfigBundle {
        bundle_version: BUNDLE_VERSION,
        exported_at: chrono::Utc::now().to_rfc3339(),
        settings,
        document_templates,
    }))
}

#[derive(Debug, Deserialize)]
pub struct ImportRequest {
    pub bundle: ConfigBundle,
    /// true = diff only, change nothing.
    #[serde(default)]
    pub dry_run: bool,
}

#[derive(Debug, Serialize)]
struct DiffEntry {
    kind: &'static str,
    item: String,
    action: &'static str,
}

/// POST /api/setup/config-import
#[allow(clippy::too_many_lines)]
pub async fn import_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ImportRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    if body.bundle.bundle_version != BUNDLE_VERSION {
        return Err(AppError::BadRequest(format!(
            "unsupported bundle_version {} (expected {BUNDLE_VERSION})",
            body.bundle.bundle_version
        )));
    }

    // Validate template overrides compile before anything is written.
    for template in &body.bundle.document_templates {
        let Some(html) = template
            .body_layout
            .as_ref()
            .and_then(|v| v.get("html"))
            .and_then(serde_json::Value::as_str)
        else {
            continue;
        };
        if let Some(builtin) = medbrains_print::templates::find_template(&template.code) {
            let sample: serde_json::Value = serde_json::from_str(builtin.sample_context)
                .map_err(|e| AppError::Internal(e.to_string()))?;
            medbrains_print::engine::render_html(html, &sample).map_err(|e| {
                AppError::BadRequest(format!(
                    "template '{}' does not compile: {e}",
                    template.code
                ))
            })?;
        }
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut diff: Vec<DiffEntry> = Vec::new();

    for entry in &body.bundle.settings {
        let existing: Option<serde_json::Value> = sqlx::query_scalar(
            "SELECT value FROM tenant_settings \
             WHERE tenant_id = $1 AND category = $2 AND key = $3 AND deleted_at IS NULL",
        )
        .bind(claims.tenant_id)
        .bind(&entry.category)
        .bind(&entry.key)
        .fetch_optional(&mut *tx)
        .await?;

        let action = match &existing {
            None => "create",
            Some(current) if *current != entry.value => "update",
            Some(_) => "unchanged",
        };
        if action != "unchanged" {
            diff.push(DiffEntry {
                kind: "setting",
                item: format!("{}/{}", entry.category, entry.key),
                action,
            });
            if !body.dry_run {
                sqlx::query(
                    "INSERT INTO tenant_settings (tenant_id, category, key, value) \
                     VALUES ($1, $2, $3, $4) \
                     ON CONFLICT (tenant_id, category, key) \
                     DO UPDATE SET value = EXCLUDED.value, deleted_at = NULL, \
                       updated_at = now()",
                )
                .bind(claims.tenant_id)
                .bind(&entry.category)
                .bind(&entry.key)
                .bind(&entry.value)
                .execute(&mut *tx)
                .await?;
            }
        }
    }

    for template in &body.bundle.document_templates {
        let existing: Option<serde_json::Value> = sqlx::query_scalar(
            "SELECT body_layout FROM document_templates \
             WHERE tenant_id = $1 AND code = $2 AND is_active = true",
        )
        .bind(claims.tenant_id)
        .bind(&template.code)
        .fetch_optional(&mut *tx)
        .await?;

        let action = match &existing {
            None => "create",
            Some(current) if Some(current) != template.body_layout.as_ref() => "update",
            Some(_) => "unchanged",
        };
        if action != "unchanged" {
            diff.push(DiffEntry {
                kind: "document_template",
                item: template.code.clone(),
                action,
            });
            if !body.dry_run {
                sqlx::query(
                    "INSERT INTO document_templates \
                       (tenant_id, code, name, module_code, body_layout, created_by) \
                     VALUES ($1, $2, $3, $4, $5, $6) \
                     ON CONFLICT (tenant_id, code) DO UPDATE SET \
                       body_layout = EXCLUDED.body_layout, \
                       version = document_templates.version + 1, \
                       is_active = true, updated_at = now()",
                )
                .bind(claims.tenant_id)
                .bind(&template.code)
                .bind(&template.name)
                .bind(&template.module_code)
                .bind(&template.body_layout)
                .bind(claims.sub)
                .execute(&mut *tx)
                .await?;
            }
        }
    }

    if !body.dry_run && !diff.is_empty() {
        let details = serde_json::json!({
            "applied": diff.len(),
            "bundle_exported_at": body.bundle.exported_at,
        });
        medbrains_db::audit::AuditLogger::log(
            &mut tx,
            &medbrains_db::audit::AuditEntry {
                tenant_id: claims.tenant_id,
                user_id: Some(claims.sub),
                action: "config_import",
                entity_type: "tenant",
                entity_id: Some(claims.tenant_id),
                old_values: None,
                new_values: Some(&details),
                ip_address: None,
            },
        )
        .await
        .map_err(AppError::from)?;
    }

    tx.commit().await?;

    Ok(Json(serde_json::json!({
        "dry_run": body.dry_run,
        "changes": diff,
        "total_changes": diff.len(),
    })))
}

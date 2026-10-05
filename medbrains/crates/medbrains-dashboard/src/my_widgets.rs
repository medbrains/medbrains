//! A viewer choosing which catalogue widgets are on their own dashboard.
//!
//! The viewer names a catalogue entry by its code and says shown or hidden;
//! the server copies the entry's definition, data source and permission. A
//! client never supplies a data source or a permission code: a widget that
//! could name its own would read anything the resolver can.

use axum::Json;
use axum::extract::Extension;
use axum::extract::{Path, State};
use medbrains_core::dashboard::WidgetTemplate;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{is_bypass_role, require_permission};
use medbrains_server_core::state::AppState;
use serde::Deserialize;
use serde_json::{Value, json};
use uuid::Uuid;

/// The widget-access overrides that apply to the viewer: (role, user), each
/// `{template_id: "visible" | "hidden"}`.
pub async fn widget_access(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
) -> Result<(Value, Value), AppError> {
    let role: Value = sqlx::query_scalar(
        "SELECT COALESCE(widget_access_defaults, '{}'::jsonb) \
         FROM roles WHERE tenant_id = $1 AND deleted_at IS NULL AND code = $2",
    )
    .bind(claims.tenant_id)
    .bind(&claims.role)
    .fetch_optional(&mut **tx)
    .await?
    .unwrap_or_else(|| json!({}));
    let user: Value = sqlx::query_scalar(
        "SELECT COALESCE(access_matrix->'widget_access', '{}'::jsonb) \
         FROM users WHERE id = $1 AND tenant_id = $2",
    )
    .bind(claims.sub)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .unwrap_or_else(|| json!({}));
    Ok((role, user))
}

/// Whether the viewer may see and place a catalogue entry: a user override,
/// else a role override, else every required permission and one of the
/// required departments.
#[must_use]
pub fn template_allowed(t: &WidgetTemplate, claims: &Claims, role: &Value, user: &Value) -> bool {
    if is_bypass_role(claims) {
        return true;
    }
    let tid = t.id.to_string();
    for level in [user, role].map(|access| access.get(&tid).and_then(Value::as_str)) {
        match level {
            Some("hidden") => return false,
            Some("visible") => return true,
            _ => {}
        }
    }
    let has_all = t.required_permissions.as_array().is_none_or(|perms| {
        perms.iter().all(|p| {
            p.as_str()
                .is_some_and(|code| claims.permissions.iter().any(|c| c == code))
        })
    });
    let in_department = match t.required_departments.as_array() {
        Some(depts) if !depts.is_empty() => depts.iter().any(|d| {
            d.as_str()
                .is_some_and(|did| claims.department_ids.iter().any(|ud| ud.to_string() == did))
        }),
        _ => true,
    };
    has_all && in_department
}

#[derive(Debug, Deserialize)]
pub struct MyWidgetVisibility {
    pub visible: bool,
}

/// `PUT /api/dashboards/my/widgets/{code}` — show or hide a catalogue widget
/// on the viewer's own dashboard (made from their shared one on first use).
///
/// Showing a widget already there turns it back on; showing one not there
/// places it under the rest. A widget the viewer may not place answers 404,
/// as if the catalogue had no such entry.
pub async fn set_my_widget(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(code): Path<String>,
    Json(req): Json<MyWidgetVisibility>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, medbrains_core::permissions::dashboard::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let template = sqlx::query_as::<_, WidgetTemplate>(
        "SELECT * FROM widget_templates \
          WHERE code = $1 AND deleted_at IS NULL AND (tenant_id IS NULL OR tenant_id = $2) \
          ORDER BY tenant_id NULLS LAST LIMIT 1",
    )
    .bind(&code)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if req.visible {
        let (role, user) = widget_access(&mut tx, &claims).await?;
        if !template_allowed(&template, &claims, &role, &user) {
            return Err(AppError::NotFound);
        }
    }

    let dashboard_id = crate::ensure_personal_dashboard(&mut tx, &claims).await?;
    let placed: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM dashboard_widgets \
          WHERE dashboard_id = $1 AND template_code = $2 AND deleted_at IS NULL LIMIT 1",
    )
    .bind(dashboard_id)
    .bind(&code)
    .fetch_optional(&mut *tx)
    .await?;
    match placed {
        Some(id) => {
            sqlx::query("UPDATE dashboard_widgets SET is_visible = $1 WHERE id = $2")
                .bind(req.visible)
                .bind(id)
                .execute(&mut *tx)
                .await?;
        }
        None if req.visible => place(&mut tx, dashboard_id, &template).await?,
        None => {}
    }
    tx.commit().await?;
    Ok(Json(json!({ "code": code, "visible": req.visible })))
}

/// A copy of the catalogue entry under the dashboard's last row, carrying the
/// entry's own permission so rendering gates it like any other widget.
async fn place(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    dashboard_id: Uuid,
    t: &WidgetTemplate,
) -> Result<(), AppError> {
    let permission = t
        .required_permissions
        .as_array()
        .and_then(|p| p.first())
        .and_then(Value::as_str);
    sqlx::query(
        "INSERT INTO dashboard_widgets \
           (dashboard_id, widget_type, title, subtitle, icon, color, config, data_source, \
            position_x, position_y, width, height, permission_code, sort_order, template_code) \
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, 0, \
                COALESCE(MAX(position_y + height), 0), $9, $10, $11, \
                COALESCE(MAX(sort_order) + 1, 0), $12 \
           FROM dashboard_widgets WHERE dashboard_id = $1 AND deleted_at IS NULL",
    )
    .bind(dashboard_id)
    .bind(t.widget_type)
    .bind(&t.name)
    .bind(&t.description)
    .bind(&t.icon)
    .bind(&t.color)
    .bind(&t.default_config)
    .bind(&t.default_source)
    .bind(t.default_width)
    .bind(t.default_height)
    .bind(permission)
    .bind(&t.code)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

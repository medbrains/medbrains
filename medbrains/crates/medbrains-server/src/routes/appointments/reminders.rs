use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

use super::ReminderConfig;

/// GET /api/opd/appointments/reminder-config
pub async fn get_reminder_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ReminderConfig>, AppError> {
    require_permission(&claims, permissions::opd::appointment::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let config: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'appointments' AND key = 'reminder_config'",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    let reminder_config = config
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or(ReminderConfig {
            sms_enabled: false,
            whatsapp_enabled: false,
            email_enabled: false,
            remind_hours_before: vec![24, 2],
            sms_template: "Reminder: Appointment with Dr. {doctor} on {date} at {time}.".to_owned(),
            whatsapp_template:
                "Appointment confirmed for {date} at {time} with Dr. {doctor}. Show QR at kiosk."
                    .to_owned(),
        });

    Ok(Json(reminder_config))
}

/// PUT /api/opd/appointments/reminder-config
pub async fn update_reminder_config(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ReminderConfig>,
) -> Result<Json<ReminderConfig>, AppError> {
    require_permission(&claims, permissions::opd::appointment::UPDATE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let value =
        serde_json::to_value(&body).map_err(|error| AppError::Internal(error.to_string()))?;

    sqlx::query(
        "INSERT INTO tenant_settings (id, tenant_id, category, key, value) \
         VALUES (gen_random_uuid(), $1, 'appointments', 'reminder_config', $2) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET value = $2, updated_at = now()",
    )
    .bind(claims.tenant_id)
    .bind(&value)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(body))
}

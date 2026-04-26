//! Event registry — query the service catalog of registered events.
//!
//! Every module action (e.g. `opd.encounter.created`) is registered in the
//! `event_registry` table. The pipeline builder uses this to show available
//! trigger events and their payload schemas.

use medbrains_core::orchestration::EventRegistryRow;
use sqlx::PgPool;

use crate::error::AppError;

/// List registered events, optionally filtered by module.
pub async fn list_events(
    pool: &PgPool,
    module_filter: Option<&str>,
) -> Result<Vec<EventRegistryRow>, AppError> {
    let rows = match module_filter {
        Some(module) => {
            sqlx::query_as::<_, EventRegistryRow>(
                "SELECT id, module, entity, action, event_code, description, \
                        payload_schema, is_system, phase, is_blocking, category, created_at \
                 FROM event_registry \
                 WHERE module = $1 \
                 ORDER BY module, entity, action",
            )
            .bind(module)
            .fetch_all(pool)
            .await?
        }
        None => {
            sqlx::query_as::<_, EventRegistryRow>(
                "SELECT id, module, entity, action, event_code, description, \
                        payload_schema, is_system, phase, is_blocking, category, created_at \
                 FROM event_registry \
                 ORDER BY module, entity, action",
            )
            .fetch_all(pool)
            .await?
        }
    };

    Ok(rows)
}

/// Get a single event by its unique event code.
pub async fn get_event(pool: &PgPool, event_code: &str) -> Result<EventRegistryRow, AppError> {
    let row = sqlx::query_as::<_, EventRegistryRow>(
        "SELECT id, module, entity, action, event_code, description, \
                payload_schema, is_system, phase, is_blocking, category, created_at \
         FROM event_registry \
         WHERE event_code = $1",
    )
    .bind(event_code)
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(row)
}

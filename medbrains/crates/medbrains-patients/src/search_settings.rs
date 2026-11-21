//! What the patient search box and list offer at this hospital: the field the
//! box searches by default, whether OPD numbers are worth offering, and
//! whether the list shows every column or only the basic ones.
//!
//! `tenant_settings` `registration`/`search_default_by` (all, phone, uhid,
//! name, `opd_number`; all when unset or unreadable) and
//! `registration`/`patient_list_columns` (full or basic; full when unset or
//! unreadable, so every other hospital's list is unchanged), and
//! `registration`/`card_printer` (thermal or cr80; thermal when unset), which
//! decides the ID card the print menus print. Read with the list, lookup,
//! view or card-reprint permission, so every desk that can print a card sees
//! the same thing; it is configuration, not a patient's data.
//! Saved with `admin.settings.general.manage`.

use axum::extract::State;
use axum::routing::get;
use axum::{Extension, Json};
use medbrains_core::permissions;
use medbrains_kernel as kernel;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use medbrains_server_services::opd_number::{self, Mode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::search::SearchBy;

/// The search box's settings.
#[derive(Debug, Serialize)]
pub(crate) struct SearchSettings {
    /// The field searched until the desk picks another.
    pub default_by: String,
    /// Whether the hospital keeps an OPD number, so "OPD number" is offered.
    pub opd_number_enabled: bool,
    /// `full` (every column) or `basic` (UHID, name, age and sex, phone, OPD number).
    pub patient_list_columns: String,
    /// `thermal` (58 mm roll card) or `cr80` (bank-card size ID card).
    pub card_printer: String,
}

/// New settings; a field left out is unchanged.
#[derive(Debug, Deserialize)]
pub(crate) struct SearchSettingsUpdate {
    pub default_by: Option<String>,
    pub patient_list_columns: Option<String>,
    pub card_printer: Option<String>,
}

/// The list's column sets.
const COLUMN_SETS: [&str; 2] = ["full", "basic"];

/// The ID card printers: a thermal roll or a CR80 card printer.
const CARD_PRINTERS: [&str; 2] = ["thermal", "cr80"];

/// The routes, merged into the patients router.
pub(crate) fn router() -> axum::Router<AppState> {
    axum::Router::new().route(
        "/api/registration/search-settings",
        get(get_search_settings).put(update_search_settings),
    )
}

/// Read the settings in one transaction.
async fn read(state: &AppState, permit: &kernel::Permit) -> Result<SearchSettings, AppError> {
    let tenant_id = permit.tenant_id();
    let mut tx = kernel::actor_tx(&state.db, permit, None).await?;
    let Stored {
        by: stored_by,
        columns: stored_columns,
        card_printer,
    } = stored(&mut tx, tenant_id).await?;
    let policy = opd_number::read_policy(&mut tx, tenant_id).await?;
    tx.commit().await?;
    // Unreadable is the default, never a refusal: the box must always search.
    let default_by = stored_by
        .filter(|by| SearchBy::from_param(Some(by)).is_ok())
        .unwrap_or_else(|| "all".to_owned());
    let patient_list_columns = stored_columns
        .filter(|c| COLUMN_SETS.contains(&c.as_str()))
        .unwrap_or_else(|| "full".to_owned());
    let card_printer = card_printer
        .filter(|c| CARD_PRINTERS.contains(&c.as_str()))
        .unwrap_or_else(|| "thermal".to_owned());
    Ok(SearchSettings {
        default_by,
        opd_number_enabled: policy.mode != Mode::Off,
        patient_list_columns,
        card_printer,
    })
}

/// The stored registration settings, as text; `None` when unset.
struct Stored {
    by: Option<String>,
    columns: Option<String>,
    card_printer: Option<String>,
}

/// The stored search default, column set and card printer, in one query.
async fn stored(conn: &mut sqlx::PgConnection, tenant_id: Uuid) -> Result<Stored, AppError> {
    let rows = sqlx::query!(
        "SELECT key, value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'registration' \
           AND key IN ('search_default_by', 'patient_list_columns', 'card_printer') \
           AND deleted_at IS NULL",
        tenant_id
    )
    .fetch_all(&mut *conn)
    .await?;
    let text = |key: &str| {
        rows.iter()
            .find(|r| r.key == key)
            .and_then(|r| r.value.as_str().map(ToOwned::to_owned))
    };
    Ok(Stored {
        by: text("search_default_by"),
        columns: text("patient_list_columns"),
        card_printer: text("card_printer"),
    })
}

/// Save one validated registration setting.
async fn save(
    conn: &mut sqlx::PgConnection,
    tenant_id: Uuid,
    (key, value): (&str, &str),
) -> Result<(), AppError> {
    sqlx::query!(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'registration', $2, $3) \
         ON CONFLICT (tenant_id, category, key) \
         DO UPDATE SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, \
                       value = EXCLUDED.value, updated_at = now()",
        tenant_id,
        key,
        serde_json::Value::from(value.trim())
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// `GET /api/registration/search-settings`: for whoever can search patients or
/// print a card, since the card printer decides which card the menu prints.
pub(crate) async fn get_search_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<SearchSettings>, AppError> {
    let permit = kernel::authz::permit_any(
        &claims,
        &[
            permissions::patients::LIST,
            permissions::patients::FIND,
            permissions::patients::VIEW,
            permissions::patients::card::REPRINT,
        ],
    )?;
    Ok(Json(read(&state, &permit).await?))
}

/// `PUT /api/registration/search-settings`: the hospital's default field, list
/// columns and card printer.
pub(crate) async fn update_search_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SearchSettingsUpdate>,
) -> Result<Json<SearchSettings>, AppError> {
    let permit = kernel::authz::permit(&claims, permissions::admin::settings::general::MANAGE)?;
    let columns = body.patient_list_columns.as_deref().map(str::trim);
    let card_printer = body.card_printer.as_deref().map(str::trim);
    if let Some(by) = body.default_by.as_deref() {
        SearchBy::from_param(Some(by))?;
    }
    if columns.is_some_and(|c| !COLUMN_SETS.contains(&c)) {
        return Err(AppError::BadRequest(
            "Patient list columns: full or basic".into(),
        ));
    }
    if card_printer.is_some_and(|c| !CARD_PRINTERS.contains(&c)) {
        return Err(AppError::BadRequest("Card printer: thermal or cr80".into()));
    }
    let mut tx = kernel::actor_tx(&state.db, &permit, None).await?;
    if let Some(by) = body.default_by.as_deref() {
        save(&mut tx, permit.tenant_id(), ("search_default_by", by)).await?;
    }
    if let Some(columns) = columns {
        save(
            &mut tx,
            permit.tenant_id(),
            ("patient_list_columns", columns),
        )
        .await?;
    }
    if let Some(printer) = card_printer {
        save(&mut tx, permit.tenant_id(), ("card_printer", printer)).await?;
    }
    tx.commit().await?;
    Ok(Json(read(&state, &permit).await?))
}

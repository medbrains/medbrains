//! The onboarding workbook: a hospital's departments, wards, beds and staff
//! as a spreadsheet. Download it blank or filled with what the hospital has,
//! fill it in (or have the hospital fill it in), upload it back.
//!
//! An upload is always checked first: every sheet is applied inside one
//! transaction, which is rolled back on a dry run or on any row error, so a
//! hospital sees exactly what would change — or every problem, by sheet, row
//! and column — before anything does. Rows match by code (username for
//! staff), so uploading the same workbook twice changes nothing.

mod beds;
mod departments;
mod export;
mod staff;
mod wards;

use axum::{Extension, Json, extract::State, http::HeaderMap};
use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};
use serde::{Deserialize, Serialize};

pub use export::export_workbook;

/// More rows than a hospital has in any one sheet: a wrong file, not a list.
const MAX_ROWS_PER_SHEET: usize = 5_000;

/// One problem with one cell, as the hospital will find it in Excel.
#[derive(Debug, Clone, Serialize)]
pub struct RowProblem {
    pub sheet: &'static str,
    /// The spreadsheet row number (the header is row 1).
    pub row: u32,
    pub column: &'static str,
    pub message: String,
}

#[derive(Debug, Default)]
pub(crate) struct Problems(Vec<RowProblem>);

impl Problems {
    pub(crate) fn add(&mut self, sheet: &'static str, row: u32, column: &'static str, message: impl Into<String>) {
        self.0.push(RowProblem { sheet, row, column, message: message.into() });
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SheetTally {
    pub sheet: &'static str,
    pub added: u32,
    pub updated: u32,
}

/// A cell's text, trimmed; empty is `None`.
pub(crate) fn text(value: Option<&String>) -> Option<String> {
    value.map(|v| v.trim().to_owned()).filter(|v| !v.is_empty())
}

#[derive(Debug, Deserialize)]
pub struct ImportRequest {
    #[serde(default)]
    pub dry_run: bool,
    #[serde(default)]
    pub departments: Vec<departments::Row>,
    #[serde(default)]
    pub wards: Vec<wards::Row>,
    #[serde(default)]
    pub beds: Vec<beds::Row>,
    #[serde(default)]
    pub staff: Vec<staff::Row>,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub applied: bool,
    pub sheets: Vec<SheetTally>,
    pub problems: Vec<RowProblem>,
    /// New staff told by email how to set their password.
    pub welcomed: u32,
}

/// `POST /api/setup/workbook/import`
pub async fn import_workbook(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    headers: HeaderMap,
    Json(body): Json<ImportRequest>,
) -> Result<Json<ImportResult>, AppError> {
    require_permission(&claims, permissions::admin::workbook::IMPORT)?;
    for (sheet, len) in [
        ("Departments", body.departments.len()),
        ("Wards", body.wards.len()),
        ("Beds", body.beds.len()),
        ("Staff", body.staff.len()),
    ] {
        if len > MAX_ROWS_PER_SHEET {
            return Err(AppError::BadRequest(format!(
                "The {sheet} sheet has {len} rows; the most one upload takes is {MAX_ROWS_PER_SHEET}"
            )));
        }
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let mut problems = Problems::default();
    // Order matters: wards name departments, beds name wards, staff name departments.
    let mut sheets = vec![departments::import(&mut tx, claims.tenant_id, &body.departments, &mut problems).await?];
    sheets.push(wards::import(&mut tx, claims.tenant_id, &body.wards, &mut problems).await?);
    sheets.push(beds::import(&mut tx, claims.tenant_id, &body.beds, &mut problems).await?);
    let (tally, welcomed) =
        staff::import(&mut tx, &claims, &headers, &body.staff, &mut problems).await?;
    sheets.push(tally);

    let applied = !body.dry_run && problems.0.is_empty();
    if applied {
        tx.commit().await?;
    } else {
        tx.rollback().await?;
    }
    Ok(Json(ImportResult {
        applied,
        sheets,
        problems: problems.0,
        welcomed: if applied { welcomed } else { 0 },
    }))
}

pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/setup/workbook", axum::routing::get(export_workbook))
        .route("/api/setup/workbook/import", axum::routing::post(import_workbook))
}

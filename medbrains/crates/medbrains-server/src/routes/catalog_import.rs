//! Bulk catalog import (audit P1 onboarding blocker): lab catalog
//! (1000+ tests) and pharmacy formulary (5000+ drugs) were
//! single-record CRUD only — 6-12 weeks of manual entry per hospital.
//!
//! Same CSV contract as the existing user/location imports
//! (`CsvImportRequest`: headers + rows, parsed client-side): row-level
//! validation with a per-row error report, and idempotent upserts
//! keyed on (tenant_id, code) so re-running a corrected file updates
//! instead of duplicating.

use axum::{Extension, Json, extract::State};
use rust_decimal::Decimal;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::require_permission,
    routes::setup::{CsvImportRequest, CsvImportResult},
    state::AppState,
};
use medbrains_core::permissions;

fn parse_decimal(value: &str) -> Option<Decimal> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Some(Decimal::ZERO);
    }
    trimmed.parse().ok()
}

fn cell(row: &[String], idx: Option<usize>) -> &str {
    idx.and_then(|i| row.get(i)).map_or("", |v| v.trim())
}

fn optional(value: &str) -> Option<&str> {
    if value.is_empty() { None } else { Some(value) }
}

/// POST /api/lab/catalog/import
///
/// Columns: code*, name*, sample_type, normal_range, unit, price,
/// tat_hours, loinc_code, critical_low, critical_high
pub async fn import_lab_catalog(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CsvImportRequest>,
) -> Result<Json<CsvImportResult>, AppError> {
    require_permission(&claims, permissions::lab::orders::CREATE)?;

    let col = |name: &str| {
        body.headers
            .iter()
            .position(|h| h.eq_ignore_ascii_case(name))
    };
    let code_idx = col("code")
        .ok_or_else(|| AppError::BadRequest("CSV must have a 'code' column".to_owned()))?;
    let name_idx = col("name")
        .ok_or_else(|| AppError::BadRequest("CSV must have a 'name' column".to_owned()))?;
    let sample_type_idx = col("sample_type");
    let normal_range_idx = col("normal_range");
    let unit_idx = col("unit");
    let price_idx = col("price");
    let tat_idx = col("tat_hours");
    let loinc_idx = col("loinc_code");
    let crit_low_idx = col("critical_low");
    let crit_high_idx = col("critical_high");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut imported = 0i64;
    let mut skipped = 0i64;
    let mut errors = Vec::new();

    for (i, row) in body.rows.iter().enumerate() {
        let row_num = i + 2; // header is row 1
        let values = &row.values;
        let code = cell(values, Some(code_idx));
        let name = cell(values, Some(name_idx));
        if code.is_empty() || name.is_empty() {
            errors.push(format!("Row {row_num}: code and name are required"));
            skipped += 1;
            continue;
        }
        let Some(price) = parse_decimal(cell(values, price_idx)) else {
            errors.push(format!("Row {row_num}: invalid price"));
            skipped += 1;
            continue;
        };
        let tat_hours: Option<i32> = optional(cell(values, tat_idx)).and_then(|v| v.parse().ok());
        let critical_low: Option<Decimal> =
            optional(cell(values, crit_low_idx)).and_then(|v| v.parse().ok());
        let critical_high: Option<Decimal> =
            optional(cell(values, crit_high_idx)).and_then(|v| v.parse().ok());

        let result = sqlx::query(
            "INSERT INTO lab_test_catalog \
             (tenant_id, code, name, sample_type, normal_range, unit, price, \
              tat_hours, loinc_code, critical_low, critical_high) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) \
             ON CONFLICT (tenant_id, code) DO UPDATE SET \
               name = EXCLUDED.name, \
               sample_type = COALESCE(EXCLUDED.sample_type, lab_test_catalog.sample_type), \
               normal_range = COALESCE(EXCLUDED.normal_range, lab_test_catalog.normal_range), \
               unit = COALESCE(EXCLUDED.unit, lab_test_catalog.unit), \
               price = EXCLUDED.price, \
               tat_hours = COALESCE(EXCLUDED.tat_hours, lab_test_catalog.tat_hours), \
               loinc_code = COALESCE(EXCLUDED.loinc_code, lab_test_catalog.loinc_code), \
               critical_low = COALESCE(EXCLUDED.critical_low, lab_test_catalog.critical_low), \
               critical_high = COALESCE(EXCLUDED.critical_high, lab_test_catalog.critical_high), \
               is_active = true, updated_at = now()",
        )
        .bind(claims.tenant_id)
        .bind(code)
        .bind(name)
        .bind(optional(cell(values, sample_type_idx)))
        .bind(optional(cell(values, normal_range_idx)))
        .bind(optional(cell(values, unit_idx)))
        .bind(price)
        .bind(tat_hours)
        .bind(optional(cell(values, loinc_idx)))
        .bind(critical_low)
        .bind(critical_high)
        .execute(&mut *tx)
        .await;

        match result {
            Ok(_) => imported += 1,
            Err(e) => {
                errors.push(format!("Row {row_num} ({code}): {e}"));
                skipped += 1;
            }
        }
    }

    tx.commit().await?;
    Ok(Json(CsvImportResult {
        imported,
        skipped,
        errors,
    }))
}

const VALID_SCHEDULES: &[&str] = &["H", "H1", "X", "G", "OTC", "NDPS"];

/// POST /api/pharmacy/catalog/import
///
/// Columns: code*, name*, generic_name, category, manufacturer, unit,
/// base_price, tax_percent, reorder_level, drug_schedule, inn_name,
/// atc_code, mrp
pub async fn import_pharmacy_catalog(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CsvImportRequest>,
) -> Result<Json<CsvImportResult>, AppError> {
    require_permission(&claims, permissions::pharmacy::stock::MANAGE)?;

    let col = |name: &str| {
        body.headers
            .iter()
            .position(|h| h.eq_ignore_ascii_case(name))
    };
    let code_idx = col("code")
        .ok_or_else(|| AppError::BadRequest("CSV must have a 'code' column".to_owned()))?;
    let name_idx = col("name")
        .ok_or_else(|| AppError::BadRequest("CSV must have a 'name' column".to_owned()))?;
    let generic_idx = col("generic_name");
    let category_idx = col("category");
    let manufacturer_idx = col("manufacturer");
    let unit_idx = col("unit");
    let price_idx = col("base_price");
    let tax_idx = col("tax_percent");
    let reorder_idx = col("reorder_level");
    let schedule_idx = col("drug_schedule");
    let inn_idx = col("inn_name");
    let atc_idx = col("atc_code");
    let mrp_idx = col("mrp");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let mut imported = 0i64;
    let mut skipped = 0i64;
    let mut errors = Vec::new();

    for (i, row) in body.rows.iter().enumerate() {
        let row_num = i + 2;
        let values = &row.values;
        let code = cell(values, Some(code_idx));
        let name = cell(values, Some(name_idx));
        if code.is_empty() || name.is_empty() {
            errors.push(format!("Row {row_num}: code and name are required"));
            skipped += 1;
            continue;
        }
        let Some(base_price) = parse_decimal(cell(values, price_idx)) else {
            errors.push(format!("Row {row_num}: invalid base_price"));
            skipped += 1;
            continue;
        };
        let Some(tax_percent) = parse_decimal(cell(values, tax_idx)) else {
            errors.push(format!("Row {row_num}: invalid tax_percent"));
            skipped += 1;
            continue;
        };
        let schedule = optional(cell(values, schedule_idx)).map(str::to_uppercase);
        if let Some(ref s) = schedule {
            if !VALID_SCHEDULES.contains(&s.as_str()) {
                errors.push(format!(
                    "Row {row_num} ({code}): drug_schedule must be one of H, H1, X, G, OTC, NDPS"
                ));
                skipped += 1;
                continue;
            }
        }
        let reorder_level: i32 = optional(cell(values, reorder_idx))
            .and_then(|v| v.parse().ok())
            .unwrap_or(10);
        let mrp: Option<Decimal> = optional(cell(values, mrp_idx)).and_then(|v| v.parse().ok());
        // Schedule X and NDPS are controlled by definition (D&C / NDPS Act).
        let is_controlled = matches!(schedule.as_deref(), Some("X" | "NDPS"));

        let result = sqlx::query(
            "INSERT INTO pharmacy_catalog \
             (tenant_id, code, name, generic_name, category, manufacturer, unit, \
              base_price, tax_percent, reorder_level, drug_schedule, is_controlled, \
              inn_name, atc_code, mrp) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) \
             ON CONFLICT (tenant_id, code) WHERE is_active DO UPDATE SET \
               name = EXCLUDED.name, \
               generic_name = COALESCE(EXCLUDED.generic_name, pharmacy_catalog.generic_name), \
               category = COALESCE(EXCLUDED.category, pharmacy_catalog.category), \
               manufacturer = COALESCE(EXCLUDED.manufacturer, pharmacy_catalog.manufacturer), \
               unit = COALESCE(EXCLUDED.unit, pharmacy_catalog.unit), \
               base_price = EXCLUDED.base_price, \
               tax_percent = EXCLUDED.tax_percent, \
               reorder_level = EXCLUDED.reorder_level, \
               drug_schedule = COALESCE(EXCLUDED.drug_schedule, pharmacy_catalog.drug_schedule), \
               is_controlled = EXCLUDED.is_controlled OR pharmacy_catalog.is_controlled, \
               inn_name = COALESCE(EXCLUDED.inn_name, pharmacy_catalog.inn_name), \
               atc_code = COALESCE(EXCLUDED.atc_code, pharmacy_catalog.atc_code), \
               mrp = COALESCE(EXCLUDED.mrp, pharmacy_catalog.mrp), \
               updated_at = now()",
        )
        .bind(claims.tenant_id)
        .bind(code)
        .bind(name)
        .bind(optional(cell(values, generic_idx)))
        .bind(optional(cell(values, category_idx)))
        .bind(optional(cell(values, manufacturer_idx)))
        .bind(optional(cell(values, unit_idx)))
        .bind(base_price)
        .bind(tax_percent)
        .bind(reorder_level)
        .bind(schedule.as_deref())
        .bind(is_controlled)
        .bind(optional(cell(values, inn_idx)))
        .bind(optional(cell(values, atc_idx)))
        .bind(mrp)
        .execute(&mut *tx)
        .await;

        match result {
            Ok(_) => imported += 1,
            Err(e) => {
                errors.push(format!("Row {row_num} ({code}): {e}"));
                skipped += 1;
            }
        }
    }

    tx.commit().await?;
    Ok(Json(CsvImportResult {
        imported,
        skipped,
        errors,
    }))
}

//! The Radiological Safety Officer's registers (AERB).
//!
//! - **Equipment**: for each X-ray, CT, fluoroscopy or mammography unit in the
//!   biomedical register, its AERB licence and eLORA ID, licence expiry, the
//!   nominated RSO (required for CT and cath labs) and its QA dates — with
//!   what is expired or due computed for the screen.
//! - **Staff dosimetry**: TLD badge readings per monitoring period, summed
//!   per person against the occupational limits — 20 mSv a year averaged
//!   over five years (100 mSv in five), and 30 mSv in any single year.
//!
//! Gated on `radiology.radiation_safety.manage`: staff doses are personal
//! health data.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{Datelike, NaiveDate, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::dose::open_tx;

/// Days ahead a licence counts as due for renewal.
const LICENCE_WARN_DAYS: i64 = 60;
/// Days ahead a QA test counts as due.
const QA_WARN_DAYS: i64 = 30;
/// Modalities AERB requires a nominated RSO for.
const RSO_REQUIRED: [&str; 2] = ["CT", "XA"];
const ANNUAL_AVERAGE_MSV: f64 = 20.0;
const SINGLE_YEAR_MSV: f64 = 30.0;
const FIVE_YEAR_MSV: f64 = 100.0;
const MAX_READING_MSV: i64 = 1_000;
const MAX_PERIOD_DAYS: i64 = 366;
const LIST_LIMIT: i64 = 500;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EquipmentRow {
    pub id: Uuid,
    pub bme_equipment_id: Uuid,
    pub name: String,
    pub make: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub modality_id: Option<Uuid>,
    pub modality_code: Option<String>,
    pub aerb_licence_number: Option<String>,
    pub elora_id: Option<String>,
    pub licence_valid_until: Option<NaiveDate>,
    pub rso_user_id: Option<Uuid>,
    pub rso_name: Option<String>,
    pub qa_agency: Option<String>,
    pub last_qa_date: Option<NaiveDate>,
    pub qa_due_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Equipment {
    #[serde(flatten)]
    pub row: EquipmentRow,
    /// What is expired, due or missing, worst first.
    pub alerts: Vec<Alert>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct Alert {
    /// `danger` (expired / missing what AERB requires) or `warning` (due soon).
    pub level: &'static str,
    pub message: String,
}

const fn alert(level: &'static str, message: String) -> Alert {
    Alert { level, message }
}

/// What a unit's dates and record say is wrong, as of `today`.
#[must_use]
pub fn equipment_alerts(row: &EquipmentRow, today: NaiveDate) -> Vec<Alert> {
    let mut out = Vec::new();
    if row.aerb_licence_number.as_deref().is_none_or(str::is_empty) {
        out.push(alert("danger", "No AERB licence recorded".to_owned()));
    }
    match row.licence_valid_until {
        Some(d) if d < today => out.push(alert("danger", format!("Licence expired on {d}"))),
        Some(d) if (d - today).num_days() <= LICENCE_WARN_DAYS => {
            out.push(alert("warning", format!("Licence expires on {d}")));
        }
        None => out.push(alert("warning", "Licence expiry not recorded".to_owned())),
        _ => {}
    }
    match row.qa_due_date {
        Some(d) if d < today => out.push(alert("danger", format!("QA overdue since {d}"))),
        Some(d) if (d - today).num_days() <= QA_WARN_DAYS => {
            out.push(alert("warning", format!("QA due on {d}")));
        }
        None => out.push(alert("warning", "Next QA date not recorded".to_owned())),
        _ => {}
    }
    let needs_rso = row
        .modality_code
        .as_deref()
        .is_some_and(|m| RSO_REQUIRED.contains(&m));
    if needs_rso && row.rso_user_id.is_none() {
        out.push(alert(
            "danger",
            "No RSO nominated (required for CT and cath lab)".to_owned(),
        ));
    }
    out.sort_by_key(|a| a.level != "danger");
    out
}

/// `GET /api/radiology/radiation-equipment` — every registered unit and
/// what is expired or due.
pub async fn list_equipment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Equipment>>, AppError> {
    require_permission(&claims, permissions::radiology::radiation_safety::MANAGE)?;
    let mut tx = open_tx(&state, &claims).await?;
    let rows = sqlx::query_as::<_, EquipmentRow>(
        "SELECT r.id, r.bme_equipment_id, b.name, b.make, b.model, b.serial_number, \
                r.modality_id, m.code AS modality_code, r.aerb_licence_number, r.elora_id, \
                r.licence_valid_until, r.rso_user_id, u.full_name AS rso_name, r.qa_agency, \
                r.last_qa_date, r.qa_due_date, r.notes \
           FROM radiation_equipment r \
           JOIN bme_equipment b ON b.id = r.bme_equipment_id AND b.tenant_id = r.tenant_id \
           LEFT JOIN radiology_modalities m ON m.id = r.modality_id \
           LEFT JOIN users u ON u.id = r.rso_user_id \
          WHERE r.tenant_id = $1 AND r.deleted_at IS NULL AND b.deleted_at IS NULL \
          ORDER BY b.name LIMIT $2",
    )
    .bind(claims.tenant_id)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let today = Utc::now().date_naive();
    Ok(Json(
        rows.into_iter()
            .map(|row| Equipment {
                alerts: equipment_alerts(&row, today),
                row,
            })
            .collect(),
    ))
}

#[derive(Debug, Deserialize)]
pub struct EquipmentRequest {
    pub bme_equipment_id: Uuid,
    pub modality_id: Option<Uuid>,
    pub aerb_licence_number: Option<String>,
    pub elora_id: Option<String>,
    pub licence_valid_until: Option<NaiveDate>,
    pub rso_user_id: Option<Uuid>,
    pub qa_agency: Option<String>,
    pub last_qa_date: Option<NaiveDate>,
    pub qa_due_date: Option<NaiveDate>,
    pub notes: Option<String>,
}

fn text(v: Option<&String>) -> Option<String> {
    v.map(|s| s.trim().to_owned()).filter(|s| !s.is_empty())
}

/// `PUT /api/radiology/radiation-equipment` — record or update a unit's AERB
/// details, keyed by its biomedical register entry.
pub async fn save_equipment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<EquipmentRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::radiology::radiation_safety::MANAGE)?;
    if let (Some(last), Some(due)) = (body.last_qa_date, body.qa_due_date)
        && due < last
    {
        return Err(AppError::BadRequest(
            "The next QA cannot be before the last one".to_owned(),
        ));
    }
    let mut tx = open_tx(&state, &claims).await?;
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM bme_equipment WHERE id = $1 AND tenant_id = $2 \
           AND deleted_at IS NULL)",
    )
    .bind(body.bme_equipment_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if !exists {
        return Err(AppError::NotFound);
    }
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO radiation_equipment \
           (tenant_id, bme_equipment_id, modality_id, aerb_licence_number, elora_id, \
            licence_valid_until, rso_user_id, qa_agency, last_qa_date, qa_due_date, notes, \
            created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
         ON CONFLICT (tenant_id, bme_equipment_id) WHERE deleted_at IS NULL DO UPDATE SET \
           modality_id = EXCLUDED.modality_id, aerb_licence_number = EXCLUDED.aerb_licence_number, \
           elora_id = EXCLUDED.elora_id, licence_valid_until = EXCLUDED.licence_valid_until, \
           rso_user_id = EXCLUDED.rso_user_id, qa_agency = EXCLUDED.qa_agency, \
           last_qa_date = EXCLUDED.last_qa_date, qa_due_date = EXCLUDED.qa_due_date, \
           notes = EXCLUDED.notes, updated_at = now() \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.bme_equipment_id)
    .bind(body.modality_id)
    .bind(text(body.aerb_licence_number.as_ref()))
    .bind(text(body.elora_id.as_ref()))
    .bind(body.licence_valid_until)
    .bind(body.rso_user_id)
    .bind(text(body.qa_agency.as_ref()))
    .bind(body.last_qa_date)
    .bind(body.qa_due_date)
    .bind(text(body.notes.as_ref()))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "id": id })))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Reading {
    pub id: Uuid,
    pub staff_id: Uuid,
    pub staff_name: Option<String>,
    pub badge_number: String,
    pub monitoring_period_start: NaiveDate,
    pub monitoring_period_end: NaiveDate,
    pub dose_value: Decimal,
    pub notes: Option<String>,
}

/// One person's dose against the occupational limits.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StaffDose {
    pub staff_id: Uuid,
    pub staff_name: Option<String>,
    pub year_msv: f64,
    pub five_year_msv: f64,
    pub readings: i64,
    pub last_period_end: Option<NaiveDate>,
    #[sqlx(skip)]
    pub alerts: Vec<Alert>,
}

/// What a person's totals break, as of the year being looked at.
#[must_use]
pub fn dose_alerts(year_msv: f64, five_year_msv: f64) -> Vec<Alert> {
    let mut out = Vec::new();
    if year_msv > SINGLE_YEAR_MSV {
        out.push(alert(
            "danger",
            format!(
                "{year_msv:.2} mSv this year — over the {SINGLE_YEAR_MSV} mSv single-year limit"
            ),
        ));
    } else if year_msv > ANNUAL_AVERAGE_MSV {
        out.push(alert("warning", format!("{year_msv:.2} mSv this year — over the {ANNUAL_AVERAGE_MSV} mSv annual average; investigate")));
    }
    if five_year_msv > FIVE_YEAR_MSV {
        out.push(alert(
            "danger",
            format!("{five_year_msv:.2} mSv in five years — over {FIVE_YEAR_MSV} mSv"),
        ));
    }
    out
}

#[derive(Debug, Deserialize)]
pub struct YearQuery {
    pub year: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct Dosimetry {
    pub year: i32,
    pub staff: Vec<StaffDose>,
    pub readings: Vec<Reading>,
}

/// `GET /api/radiology/dosimetry?year=` — the year's readings, and each
/// person's year and five-year totals against the limits.
pub async fn list_dosimetry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<YearQuery>,
) -> Result<Json<Dosimetry>, AppError> {
    require_permission(&claims, permissions::radiology::radiation_safety::MANAGE)?;
    let year = q.year.unwrap_or_else(|| Utc::now().year());
    let mut tx = open_tx(&state, &claims).await?;
    let mut staff = sqlx::query_as::<_, StaffDose>(
        "SELECT d.staff_id, u.full_name AS staff_name, \
                COALESCE(SUM(d.dose_value) FILTER \
                  (WHERE EXTRACT(YEAR FROM d.monitoring_period_end) = $2), 0)::float8 AS year_msv, \
                COALESCE(SUM(d.dose_value), 0)::float8 AS five_year_msv, \
                COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM d.monitoring_period_end) = $2) AS readings, \
                MAX(d.monitoring_period_end) AS last_period_end \
           FROM radiology_dosimetry_records d LEFT JOIN users u ON u.id = d.staff_id \
          WHERE d.tenant_id = $1 AND d.deleted_at IS NULL \
            AND EXTRACT(YEAR FROM d.monitoring_period_end) BETWEEN $2 - 4 AND $2 \
          GROUP BY d.staff_id, u.full_name ORDER BY year_msv DESC LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(year)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    for s in &mut staff {
        s.alerts = dose_alerts(s.year_msv, s.five_year_msv);
    }
    let readings = sqlx::query_as::<_, Reading>(
        "SELECT d.id, d.staff_id, u.full_name AS staff_name, d.badge_number, \
                d.monitoring_period_start, d.monitoring_period_end, d.dose_value, d.notes \
           FROM radiology_dosimetry_records d LEFT JOIN users u ON u.id = d.staff_id \
          WHERE d.tenant_id = $1 AND d.deleted_at IS NULL \
            AND EXTRACT(YEAR FROM d.monitoring_period_end) = $2 \
          ORDER BY d.monitoring_period_end DESC LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(year)
    .bind(LIST_LIMIT)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(Dosimetry {
        year,
        staff,
        readings,
    }))
}

#[derive(Debug, Deserialize)]
pub struct ReadingRequest {
    pub staff_id: Uuid,
    pub badge_number: String,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    /// mSv.
    pub dose_value: Decimal,
    pub notes: Option<String>,
}

impl ReadingRequest {
    fn validate(&self) -> Result<(), AppError> {
        let bad = |m: &str| Err(AppError::BadRequest(m.to_owned()));
        if self.badge_number.trim().is_empty() {
            return bad("Enter the TLD badge number");
        }
        if self.period_end < self.period_start {
            return bad("The period ends before it starts");
        }
        if (self.period_end - self.period_start).num_days() > MAX_PERIOD_DAYS {
            return bad("A monitoring period is at most a year");
        }
        if self.period_end > Utc::now().date_naive() {
            return bad("A reading is for a period that has ended");
        }
        if self.dose_value.is_sign_negative() || self.dose_value > Decimal::from(MAX_READING_MSV) {
            return bad("A badge reading is between 0 and 1000 mSv");
        }
        Ok(())
    }
}

/// `POST /api/radiology/dosimetry` — record one badge reading. A period that
/// overlaps another reading for the same badge is refused (it would count
/// twice).
pub async fn record_reading(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ReadingRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::radiology::radiation_safety::MANAGE)?;
    body.validate()?;
    let mut tx = open_tx(&state, &claims).await?;
    let overlaps: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM radiology_dosimetry_records \
          WHERE tenant_id = $1 AND staff_id = $2 AND badge_number = $3 AND deleted_at IS NULL \
            AND daterange(monitoring_period_start, monitoring_period_end, '[]') && \
                daterange($4, $5, '[]'))",
    )
    .bind(claims.tenant_id)
    .bind(body.staff_id)
    .bind(body.badge_number.trim())
    .bind(body.period_start)
    .bind(body.period_end)
    .fetch_one(&mut *tx)
    .await?;
    if overlaps {
        return Err(AppError::Conflict(
            "This badge already has a reading for part of that period".to_owned(),
        ));
    }
    let year_before: f64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(dose_value), 0)::float8 FROM radiology_dosimetry_records \
          WHERE tenant_id = $1 AND staff_id = $2 AND deleted_at IS NULL \
            AND EXTRACT(YEAR FROM monitoring_period_end) = $3",
    )
    .bind(claims.tenant_id)
    .bind(body.staff_id)
    .bind(body.period_end.year())
    .fetch_one(&mut *tx)
    .await?;
    let year_total = year_before + body.dose_value.to_f64().unwrap_or_default();
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_dosimetry_records \
           (tenant_id, staff_id, badge_number, monitoring_period_start, monitoring_period_end, \
            dose_value, annual_limit, is_compliant, notes, recorded_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(body.staff_id)
    .bind(body.badge_number.trim())
    .bind(body.period_start)
    .bind(body.period_end)
    .bind(body.dose_value)
    .bind(ANNUAL_AVERAGE_MSV)
    .bind(year_total <= ANNUAL_AVERAGE_MSV)
    .bind(text(body.notes.as_ref()))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({
        "id": id,
        "year_msv": year_total,
        "alerts": dose_alerts(year_total, 0.0),
    })))
}

/// `DELETE /api/radiology/dosimetry/{id}` — a reading entered against the
/// wrong person or period. Kept, soft-deleted.
pub async fn remove_reading(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::radiology::radiation_safety::MANAGE)?;
    let mut tx = open_tx(&state, &claims).await?;
    let removed = sqlx::query(
        "UPDATE radiology_dosimetry_records SET deleted_at = now(), deleted_by = $3, \
                delete_reason = 'entered in error' \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if removed == 0 {
        return Err(AppError::NotFound);
    }
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "removed": true })))
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    fn unit(code: &str) -> EquipmentRow {
        EquipmentRow {
            id: Uuid::nil(),
            bme_equipment_id: Uuid::nil(),
            name: "CT 1".to_owned(),
            make: None,
            model: None,
            serial_number: None,
            modality_id: None,
            modality_code: Some(code.to_owned()),
            aerb_licence_number: Some("AERB/DX/123".to_owned()),
            elora_id: None,
            licence_valid_until: NaiveDate::from_ymd_opt(2027, 6, 1),
            rso_user_id: Some(Uuid::nil()),
            rso_name: None,
            qa_agency: None,
            last_qa_date: None,
            qa_due_date: NaiveDate::from_ymd_opt(2027, 1, 1),
            notes: None,
        }
    }

    fn today() -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 10, 29).unwrap()
    }

    #[test]
    fn a_unit_in_order_has_no_alerts() {
        assert_eq!(equipment_alerts(&unit("CT"), today()), Vec::new());
    }

    #[test]
    fn expired_due_and_missing_are_named_worst_first() {
        let mut u = unit("CT");
        u.licence_valid_until = NaiveDate::from_ymd_opt(2026, 10, 1);
        u.qa_due_date = NaiveDate::from_ymd_opt(2026, 11, 15);
        u.rso_user_id = None;
        let found = equipment_alerts(&u, today());
        let levels: Vec<_> = found.iter().map(|a| a.level).collect();
        assert_eq!(levels, ["danger", "danger", "warning"], "{found:?}");
        assert!(found[0].message.contains("expired"));
        let mut xray = unit("DX");
        xray.rso_user_id = None;
        assert_eq!(
            equipment_alerts(&xray, today()),
            Vec::new(),
            "an RSO is required for CT and cath lab"
        );
    }

    #[test]
    fn staff_dose_is_held_to_the_aerb_limits() {
        assert_eq!(dose_alerts(12.0, 40.0), Vec::new());
        assert_eq!(dose_alerts(22.0, 40.0)[0].level, "warning");
        assert_eq!(dose_alerts(31.0, 40.0)[0].level, "danger");
        assert_eq!(dose_alerts(10.0, 101.0)[0].level, "danger");
    }
}

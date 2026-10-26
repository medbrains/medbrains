//! TB notification to Ni-kshay (migration 1260).
//!
//! Every TB worklist row -- a TB diagnosis anywhere, or a positive smear,
//! `CBNAAT` or `TrueNat` -- is a notification the hospital owes. This module keeps
//! the fields the `MoHFW` hospital format (Annexure II of D.O.
//! Z-28015/2/2012-TB) asks for beyond the diagnosis, and builds that sheet for
//! a person to submit on Ni-kshay. The Ni-kshay ID they get back is stored as
//! the worklist row's `report_ref`, through the worklist's own submit.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

/// A worklist row is a TB notification when its disease is TB (A15-A19), or
/// the hospital's list sends it to Ni-kshay.
const IS_TB: &str = "(r.icd10_code ~ '^A1[5-9]' OR r.reporting_body ILIKE '%ni-kshay%')";

/// The basis of diagnosis a confirming lab test implies.
const LAB_BASIS: &str = "CASE \
     WHEN lab.label ~* '(cbnaat|xpert|truenat|naat|pcr)' THEN 'pcr' \
     WHEN lab.label ~* '(\\mlpa\\M|line probe)' THEN 'lpa' \
     WHEN lab.label ~* 'culture' THEN 'culture' \
     WHEN lab.label ~* '(\\mafb\\M|smear|acid.?fast|ziehl)' THEN 'smear' END";

/// One TB case on the Ni-kshay tab.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TbCase {
    pub report_id: Uuid,
    pub patient_id: Option<Uuid>,
    pub uhid: Option<String>,
    pub patient_name: Option<String>,
    pub icd10_code: String,
    pub disease_name: String,
    pub case_class: String,
    pub status: String,
    /// The Ni-kshay ID, once notified.
    pub nikshay_id: Option<String>,
    pub detected_at: DateTime<Utc>,
    pub due_at: Option<DateTime<Utc>>,
    pub site: Option<String>,
    pub ep_site: Option<String>,
    pub patient_type: Option<String>,
    /// Saved, or implied by the confirming lab test.
    pub basis: Option<String>,
    pub diagnosed_on: Option<NaiveDate>,
    pub treatment_started_on: Option<NaiveDate>,
    pub weight_kg: Option<Decimal>,
    pub regimen: Option<String>,
    pub notifying_doctor_id: Option<Uuid>,
    pub notifying_doctor_name: Option<String>,
}

fn cases_sql(filter: &str) -> String {
    format!(
        "SELECT r.id AS report_id, r.patient_id, p.uhid, \
                NULLIF(concat_ws(' ', p.first_name, p.middle_name, p.last_name), '') AS patient_name, \
                r.icd10_code, r.disease_name, r.case_class, r.status, r.report_ref AS nikshay_id, \
                r.detected_at, r.due_at, n.site, n.ep_site, n.patient_type, \
                COALESCE(n.basis, {LAB_BASIS}) AS basis, \
                COALESCE(n.diagnosed_on, (r.detected_at AT TIME ZONE 'Asia/Kolkata')::date) AS diagnosed_on, \
                n.treatment_started_on, n.weight_kg, n.regimen, \
                COALESCE(n.notifying_doctor_id, r.detected_by) AS notifying_doctor_id, \
                u.full_name AS notifying_doctor_name \
           FROM notifiable_disease_reports r \
           LEFT JOIN patients p ON p.id = r.patient_id \
           LEFT JOIN nikshay_notifications n ON n.report_id = r.id AND n.deleted_at IS NULL \
           LEFT JOIN LATERAL ( \
                SELECT COALESCE(t.name, '') || ' ' || COALESCE(t.code, '') AS label \
                  FROM lab_orders lo LEFT JOIN lab_test_catalog t ON t.id = lo.test_id \
                 WHERE lo.id = r.lab_order_id) lab ON true \
           LEFT JOIN users u ON u.id = COALESCE(n.notifying_doctor_id, r.detected_by) \
          WHERE r.tenant_id = $1 AND {IS_TB} AND {filter} \
          ORDER BY r.due_at ASC NULLS LAST, r.detected_at DESC LIMIT 500"
    )
}

#[derive(Debug, Deserialize)]
pub struct CaseQuery {
    pub status: Option<String>,
}

/// GET /api/ckb/nikshay — the hospital's TB notifications.
pub async fn list_cases(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<CaseQuery>,
) -> Result<Json<Vec<TbCase>>, AppError> {
    require_permission(&claims, permissions::ckb::reports::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, TbCase>(&cases_sql("($2::text IS NULL OR r.status = $2)"))
        .bind(claims.tenant_id)
        .bind(q.status.as_deref())
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct TbDetails {
    pub site: Option<String>,
    pub ep_site: Option<String>,
    pub patient_type: Option<String>,
    pub basis: Option<String>,
    pub diagnosed_on: Option<NaiveDate>,
    pub treatment_started_on: Option<NaiveDate>,
    pub weight_kg: Option<Decimal>,
    pub regimen: Option<String>,
    pub notifying_doctor_id: Option<Uuid>,
}

fn validate(d: &TbDetails) -> Result<(), AppError> {
    if d.site.as_deref() == Some("EP") && d.ep_site.as_deref().is_none_or(|s| s.trim().is_empty()) {
        return Err(AppError::BadRequest(
            "Name the extra-pulmonary site (pleura, lymph node, spine ...).".to_owned(),
        ));
    }
    if let (Some(dx), Some(rx)) = (d.diagnosed_on, d.treatment_started_on)
        && rx < dx
    {
        return Err(AppError::BadRequest(
            "Treatment cannot start before the diagnosis.".to_owned(),
        ));
    }
    Ok(())
}

/// `PUT /api/ckb/nikshay/{report_id}` — the TB details of one notification.
pub async fn save_details(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(report_id): Path<Uuid>,
    Json(body): Json<TbDetails>,
) -> Result<Json<TbCase>, AppError> {
    require_permission(&claims, permissions::ckb::reports::MANAGE)?;
    validate(&body)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let is_tb = sqlx::query_scalar::<_, bool>(&format!(
        "SELECT {IS_TB} FROM notifiable_disease_reports r WHERE r.id = $1 AND r.tenant_id = $2"
    ))
    .bind(report_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if !is_tb {
        return Err(AppError::BadRequest(
            "This report is not a TB notification.".to_owned(),
        ));
    }
    sqlx::query(
        "INSERT INTO nikshay_notifications (tenant_id, report_id, site, ep_site, patient_type, \
             basis, diagnosed_on, treatment_started_on, weight_kg, regimen, notifying_doctor_id, \
             updated_by) \
         VALUES ($1, $2, $3, NULLIF(btrim($4), ''), $5, $6, $7, $8, $9, NULLIF(btrim($10), ''), \
                 $11, $12) \
         ON CONFLICT (report_id) WHERE deleted_at IS NULL DO UPDATE SET \
           site = EXCLUDED.site, ep_site = EXCLUDED.ep_site, \
           patient_type = EXCLUDED.patient_type, basis = EXCLUDED.basis, \
           diagnosed_on = EXCLUDED.diagnosed_on, \
           treatment_started_on = EXCLUDED.treatment_started_on, \
           weight_kg = EXCLUDED.weight_kg, regimen = EXCLUDED.regimen, \
           notifying_doctor_id = EXCLUDED.notifying_doctor_id, updated_by = EXCLUDED.updated_by",
    )
    .bind(claims.tenant_id)
    .bind(report_id)
    .bind(body.site.as_deref())
    .bind(body.ep_site.as_deref())
    .bind(body.patient_type.as_deref())
    .bind(body.basis.as_deref())
    .bind(body.diagnosed_on)
    .bind(body.treatment_started_on)
    .bind(body.weight_kg)
    .bind(body.regimen.as_deref())
    .bind(body.notifying_doctor_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    let row = sqlx::query_as::<_, TbCase>(&cases_sql("r.id = $2"))
        .bind(claims.tenant_id)
        .bind(report_id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}

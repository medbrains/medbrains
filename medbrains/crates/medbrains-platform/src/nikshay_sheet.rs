//! The Ni-kshay notification sheet, in the `MoHFW` format for hospitals
//! (Annexure II, page 1, of D.O. Z-28015/2/2012-TB), and the hospital's
//! Health Establishment code that heads it.
//!
//! Making the sheet is a disclosure of patient data to a public authority, so
//! each one is written to the audit chain with the cases it held.

use axum::{Extension, Json, extract::State};
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

use crate::disclosure::{self, Disclosure};

/// The columns of Annexure II, page 1, in the form's order -- plus the
/// hospital's own reference, last, so a returned query can be traced.
pub const COLUMNS: [&str; 17] = [
    "Sr No",
    "Name of TB patient (surname first)",
    "Father / husband's name",
    "Age (yrs)",
    "Sex (M/F/O)",
    "GoI issued identification number",
    "Complete residential address",
    "PIN no",
    "Patient phone number",
    "Date of TB diagnosis",
    "Date of TB treatment initiation",
    "Site of disease (P / EP)",
    "Patient type",
    "Basis of diagnosis",
    "Weight in kg",
    "Drugs and dosages (in mg)",
    "Hospital reference (UHID)",
];

const STATUTE: &str = "TB notification, MoHFW Govt Order Z-28015/2/2012-TB (2012), \
     gazette notification March 2018";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Facility {
    pub name: String,
    pub registration_no: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub nikshay_he_code: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct SheetRow {
    report_id: Uuid,
    patient_name: Option<String>,
    guardian: Option<String>,
    age: Option<i32>,
    gender: Option<String>,
    gov_id: Option<String>,
    address: Option<String>,
    pin: Option<String>,
    phone: Option<String>,
    diagnosed_on: Option<NaiveDate>,
    treatment_started_on: Option<NaiveDate>,
    site: Option<String>,
    ep_site: Option<String>,
    patient_type: Option<String>,
    basis: Option<String>,
    weight_kg: Option<Decimal>,
    regimen: Option<String>,
    uhid: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MissingFields {
    pub report_id: Uuid,
    pub patient_name: Option<String>,
    pub fields: Vec<&'static str>,
}

#[derive(Debug, Serialize)]
pub struct Sheet {
    pub facility: Facility,
    pub period_from: Option<NaiveDate>,
    pub period_to: Option<NaiveDate>,
    pub columns: Vec<&'static str>,
    pub rows: Vec<Vec<String>>,
    /// Cases the form cannot be filed for yet, and what each lacks.
    pub missing: Vec<MissingFields>,
}

const FACILITY_SQL: &str = "SELECT name, registration_no, phone, \
       NULLIF(concat_ws(', ', address_line1, address_line2, city, pincode), '') AS address, \
       nikshay_he_code FROM tenants WHERE id = $1";

const SHEET_SQL: &str = "\
    SELECT r.id AS report_id, \
           NULLIF(concat_ws(' ', p.last_name, p.first_name, p.middle_name), '') AS patient_name, \
           COALESCE(p.father_name, p.spouse_name) AS guardian, \
           date_part('year', age(p.date_of_birth))::int AS age, p.gender::text AS gender, \
           p.abha_number AS gov_id, \
           COALESCE(NULLIF(concat_ws(', ', pa.address_line1, pa.address_line2, pa.village_town, \
                                     pa.city), ''), \
                    NULLIF(concat_ws(', ', p.address->>'line1', p.address->>'line2', \
                                     p.address->>'city', p.address->>'state'), ''), \
                    p.address_line1) AS address, \
           COALESCE(pa.postal_code, p.address->>'pincode') AS pin, p.phone, \
           COALESCE(n.diagnosed_on, (r.detected_at AT TIME ZONE 'Asia/Kolkata')::date) AS diagnosed_on, \
           n.treatment_started_on, n.site, n.ep_site, n.patient_type, n.basis, n.weight_kg, \
           n.regimen, p.uhid \
      FROM notifiable_disease_reports r \
      JOIN patients p ON p.id = r.patient_id \
      LEFT JOIN nikshay_notifications n ON n.report_id = r.id AND n.deleted_at IS NULL \
      LEFT JOIN LATERAL ( \
           SELECT address_line1, address_line2, village_town, city, postal_code \
             FROM patient_addresses \
            WHERE patient_id = p.id AND deleted_at IS NULL \
            ORDER BY is_primary DESC, created_at DESC LIMIT 1) pa ON true \
     WHERE r.tenant_id = $1 AND r.status = 'pending' \
       AND (r.icd10_code ~ '^A1[5-9]' OR r.reporting_body ILIKE '%ni-kshay%') \
     ORDER BY r.detected_at LIMIT 500";

fn sex(gender: Option<&str>) -> &'static str {
    match gender {
        Some("male") => "M",
        Some("female") => "F",
        Some("other") => "O",
        _ => "",
    }
}

fn patient_type(value: Option<&str>) -> &'static str {
    match value {
        Some("new") => "New TB case",
        Some("recurrent") => "Recurrent TB case",
        Some("treatment_change") => "Treatment change",
        _ => "",
    }
}

fn basis(value: Option<&str>) -> &'static str {
    match value {
        Some("smear") => "Smear microscopy",
        Some("culture") => "Culture",
        Some("pcr") => "PCR (CBNAAT / TrueNat)",
        Some("lpa") => "LPA",
        Some("fnac") => "FNAC",
        Some("histopathology") => "Histopathology",
        Some("clinical") => "Clinical exam",
        Some("xray") => "X-Ray",
        _ => "",
    }
}

fn date(d: Option<NaiveDate>) -> String {
    d.map(|d| d.format("%d/%m/%Y").to_string())
        .unwrap_or_default()
}

/// What the form needs that this case does not have yet.
fn missing(r: &SheetRow) -> Vec<&'static str> {
    let checks = [
        (r.site.is_none(), "site of disease"),
        (r.patient_type.is_none(), "patient type"),
        (r.basis.is_none(), "basis of diagnosis"),
        (r.treatment_started_on.is_none(), "treatment start"),
        (r.weight_kg.is_none(), "weight"),
        (r.address.is_none(), "address"),
        (r.phone.is_none(), "phone"),
    ];
    checks
        .into_iter()
        .filter_map(|(absent, name)| absent.then_some(name))
        .collect()
}

fn cells(sr: usize, r: &SheetRow) -> Vec<String> {
    let site = match (r.site.as_deref(), r.ep_site.as_deref()) {
        (Some("EP"), Some(where_)) => format!("EP ({where_})"),
        (Some(s), _) => s.to_owned(),
        _ => String::new(),
    };
    let text = |v: &Option<String>| v.clone().unwrap_or_default();
    vec![
        sr.to_string(),
        text(&r.patient_name),
        text(&r.guardian),
        r.age.map(|a| a.to_string()).unwrap_or_default(),
        sex(r.gender.as_deref()).to_owned(),
        text(&r.gov_id),
        text(&r.address),
        text(&r.pin),
        text(&r.phone),
        date(r.diagnosed_on),
        date(r.treatment_started_on),
        site,
        patient_type(r.patient_type.as_deref()).to_owned(),
        basis(r.basis.as_deref()).to_owned(),
        r.weight_kg.map(|w| w.to_string()).unwrap_or_default(),
        text(&r.regimen),
        text(&r.uhid),
    ]
}

/// GET /api/ckb/nikshay/sheet — every TB case not yet notified, as the form
/// for hospitals lays it out.
pub async fn notification_sheet(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Sheet>, AppError> {
    require_permission(&claims, permissions::ckb::reports::EXPORT)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let facility = sqlx::query_as::<_, Facility>(FACILITY_SQL)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
    let found = sqlx::query_as::<_, SheetRow>(SHEET_SQL)
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?;
    let ids: Vec<Uuid> = found.iter().map(|r| r.report_id).collect();
    if !ids.is_empty() {
        disclosure::record(
            &mut tx,
            &claims,
            &Disclosure {
                stage: "prepared",
                recipient: "Ni-kshay",
                statute: STATUTE,
                entity_type: "notifiable_disease_reports",
                record_ids: &ids,
                reference: None,
            },
        )
        .await?;
    }
    tx.commit().await?;
    let missing_fields = found
        .iter()
        .filter_map(|r| {
            let fields = missing(r);
            (!fields.is_empty()).then(|| MissingFields {
                report_id: r.report_id,
                patient_name: r.patient_name.clone(),
                fields,
            })
        })
        .collect();
    Ok(Json(Sheet {
        facility,
        period_from: found.iter().filter_map(|r| r.diagnosed_on).min(),
        period_to: Some(Utc::now().date_naive()),
        columns: COLUMNS.to_vec(),
        rows: found
            .iter()
            .enumerate()
            .map(|(i, r)| cells(i + 1, r))
            .collect(),
        missing: missing_fields,
    }))
}

/// GET /api/ckb/facility-codes — the hospital's codes on public-health portals.
pub async fn facility_codes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Facility>, AppError> {
    require_permission(&claims, permissions::ckb::reports::LIST)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, Facility>(FACILITY_SQL)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[derive(Debug, Deserialize)]
pub struct FacilityCodes {
    pub nikshay_he_code: Option<String>,
}

/// PUT /api/ckb/facility-codes — set them.
pub async fn set_facility_codes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<FacilityCodes>,
) -> Result<Json<Facility>, AppError> {
    require_permission(&claims, permissions::ckb::reports::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sqlx::query("UPDATE tenants SET nikshay_he_code = NULLIF(btrim($2), '') WHERE id = $1")
        .bind(claims.tenant_id)
        .bind(body.nikshay_he_code.as_deref())
        .execute(&mut *tx)
        .await?;
    let row = sqlx::query_as::<_, Facility>(FACILITY_SQL)
        .bind(claims.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::{COLUMNS, SheetRow, cells, missing};
    use uuid::Uuid;

    fn row() -> SheetRow {
        SheetRow {
            report_id: Uuid::nil(),
            patient_name: Some("Kumar Ravi".to_owned()),
            guardian: None,
            age: Some(42),
            gender: Some("male".to_owned()),
            gov_id: None,
            address: Some("12 Main Rd".to_owned()),
            pin: Some("600001".to_owned()),
            phone: Some("9990001111".to_owned()),
            diagnosed_on: chrono::NaiveDate::from_ymd_opt(2026, 10, 1),
            treatment_started_on: None,
            site: Some("EP".to_owned()),
            ep_site: Some("lymph node".to_owned()),
            patient_type: Some("new".to_owned()),
            basis: Some("pcr".to_owned()),
            weight_kg: None,
            regimen: None,
            uhid: Some("UH1".to_owned()),
        }
    }

    #[test]
    fn a_row_fills_the_form_in_its_order() {
        let c = cells(1, &row());
        assert_eq!(c.len(), COLUMNS.len());
        assert_eq!(c[4], "M");
        assert_eq!(c[9], "01/10/2026");
        assert_eq!(c[11], "EP (lymph node)");
        assert_eq!(c[12], "New TB case");
        assert_eq!(c[13], "PCR (CBNAAT / TrueNat)");
    }

    #[test]
    fn what_the_form_still_needs_is_named() {
        assert_eq!(missing(&row()), vec!["treatment start", "weight"]);
    }
}

//! The sheet the clerk keys into the NCDIR HBCR software: every complete,
//! reportable abstract not yet submitted, one row per case, columns headed by
//! the core-form item number. NCDIR publishes no bulk-upload format, so each
//! coded cell carries its code and its meaning ("2 - Microscopic").

use axum::{Extension, Json, extract::State};
use chrono::{Datelike, NaiveDate, Utc};
use medbrains_core::permissions::specialty::other::oncology::registry;
use medbrains_core::specialty::hbcr::{self, Codes};
use serde::Serialize;
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

/// Cases on one sheet at most.
const SHEET: i64 = 1000;

#[derive(Debug, sqlx::FromRow)]
struct Due {
    uhid: String,
    patient_name: String,
    date_of_birth: Option<NaiveDate>,
    gender: String,
    address: Option<String>,
    hbcr_registration_no: Option<String>,
    date_of_first_diagnosis: Option<NaiveDate>,
    case_registered_through: Option<i16>,
    referral_type: Option<String>,
    method_of_diagnosis: Option<i16>,
    icdo3_topography: Option<String>,
    icdo3_morphology: Option<String>,
    icd10_code: Option<String>,
    laterality: Option<i16>,
    sequence: Option<i16>,
    extent_of_disease: Option<i16>,
    staging_system: Option<i16>,
    t_stage: Option<String>,
    n_stage: Option<String>,
    m_stage: Option<String>,
    overall_stage: Option<String>,
    prior_treatment: Option<i16>,
    intention: Option<i16>,
    ecog: Option<i16>,
    treatment_at_ri: Option<i16>,
}

/// Column headings, numbered as the manual's core-form items.
const HEADER: &[&str] = &[
    "2 HBCR registration no",
    "4 Hospital registration no",
    "9 Name",
    "10 Age at diagnosis",
    "11 Date of birth",
    "12 Sex",
    "15 Address",
    "8 Date of first diagnosis",
    "6 Case registered through",
    "7 Type of referral",
    "20 Method of diagnosis",
    "23.1 Topography (ICD-O-3)",
    "23.2 Morphology (ICD-O-3)",
    "23 ICD-10",
    "25 Laterality",
    "26 Sequence",
    "27 Clinical extent of disease",
    "28.1 Staging system",
    "28.2 T",
    "28.2 N",
    "28.2 M",
    "28.3 Composite stage",
    "29 Treatment before registration",
    "29 Intention of treatment",
    "29.3 ECOG",
    "30 Treatment at reporting institution",
];

/// `"2 - Microscopic"`, or blank when not coded.
fn coded(codes: Codes, code: Option<i16>) -> String {
    code.map(|c| hbcr::meaning(codes, c).map_or_else(|| c.to_string(), |m| format!("{c} - {m}")))
        .unwrap_or_default()
}

/// HBCR sex: 1 male, 2 female, 8 others.
fn sex(gender: &str) -> &'static str {
    match gender {
        "male" => "1 - Male",
        "female" => "2 - Female",
        _ => "8 - Others",
    }
}

fn age(dob: Option<NaiveDate>, on: Option<NaiveDate>) -> String {
    let (Some(dob), Some(on)) = (dob, on) else {
        return String::new();
    };
    let birthday_passed = (on.month(), on.day()) >= (dob.month(), dob.day());
    (on.year() - dob.year() - i32::from(!birthday_passed)).to_string()
}

/// RFC 4180 quoting — a name or address may hold a comma or a quote.
fn cell(v: &str) -> String {
    if v.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", v.replace('"', "\"\""))
    } else {
        v.to_owned()
    }
}

fn row(c: &Due) -> String {
    let text = |v: &Option<String>| v.clone().unwrap_or_default();
    let date = |d: Option<NaiveDate>| {
        d.map(|d| d.format("%d/%m/%Y").to_string())
            .unwrap_or_default()
    };
    [
        text(&c.hbcr_registration_no),
        c.uhid.clone(),
        c.patient_name.clone(),
        age(c.date_of_birth, c.date_of_first_diagnosis),
        date(c.date_of_birth),
        sex(&c.gender).to_owned(),
        text(&c.address),
        date(c.date_of_first_diagnosis),
        coded(hbcr::CASE_REGISTERED_THROUGH, c.case_registered_through),
        text(&c.referral_type),
        coded(hbcr::METHOD_OF_DIAGNOSIS, c.method_of_diagnosis),
        text(&c.icdo3_topography),
        text(&c.icdo3_morphology),
        text(&c.icd10_code),
        coded(hbcr::LATERALITY, c.laterality),
        c.sequence.map(|s| s.to_string()).unwrap_or_default(),
        coded(hbcr::EXTENT_OF_DISEASE, c.extent_of_disease),
        coded(hbcr::STAGING_SYSTEM, c.staging_system),
        text(&c.t_stage),
        text(&c.n_stage),
        text(&c.m_stage),
        text(&c.overall_stage),
        coded(hbcr::PRIOR_TREATMENT, c.prior_treatment),
        coded(hbcr::INTENTION, c.intention),
        coded(hbcr::ECOG, c.ecog),
        coded(hbcr::TREATMENT_AT_RI, c.treatment_at_ri),
    ]
    .iter()
    .map(|v| cell(v))
    .collect::<Vec<_>>()
    .join(",")
}

#[derive(Debug, Serialize)]
pub struct Sheet {
    pub filename: String,
    pub content: String,
    pub count: usize,
}

/// `GET /api/specialty/oncology/registry/export` — the sheet of cases due to
/// NCDIR. Exporting changes nothing; the clerk marks each case submitted once
/// NCDIR gives it a registration.
pub async fn export_sheet(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Sheet>, AppError> {
    require_permission(&claims, registry::EXPORT)?;
    let permitted: Option<Vec<Uuid>> =
        medbrains_authz_gate::patient_filter(&state, &claims, None).await?;
    let mut tx = super::begin(&state, &claims).await?;
    let cases = sqlx::query_as::<_, Due>(
        "SELECT p.uhid, trim(p.first_name || ' ' || coalesce(p.middle_name || ' ', '') || p.last_name) \
           AS patient_name, p.date_of_birth, p.gender::text AS gender, \
           nullif(concat_ws(', ', p.address->>'line1', p.address->>'line2', p.address->>'city', \
             p.address->>'district', p.address->>'state', p.address->>'pincode'), '') AS address, \
           a.hbcr_registration_no, a.date_of_first_diagnosis, a.case_registered_through, \
           a.referral_type, a.method_of_diagnosis, a.icdo3_topography, a.icdo3_morphology, \
           a.icd10_code, a.laterality, a.sequence, a.extent_of_disease, a.staging_system, \
           s.t_stage, s.n_stage, s.m_stage, s.overall_stage, a.prior_treatment, a.intention, \
           a.ecog, a.treatment_at_ri \
         FROM cancer_registry_abstracts a \
         JOIN cancer_stagings s ON s.id = a.staging_id \
         JOIN patients p ON p.id = a.patient_id \
         WHERE a.tenant_id = $1 AND a.status = 'complete' AND a.deleted_at IS NULL \
           AND ($2::uuid[] IS NULL OR a.patient_id = ANY($2)) \
         ORDER BY a.date_of_first_diagnosis, p.uhid LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(permitted.as_deref())
    .bind(SHEET)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    let rows: Vec<String> = cases
        .iter()
        .filter(|c| hbcr::reportable(&coding_of(c)))
        .map(row)
        .collect();
    let mut content = HEADER.join(",");
    for r in &rows {
        content.push_str("\r\n");
        content.push_str(r);
    }
    Ok(Json(Sheet {
        filename: format!("hbcr-{}.csv", Utc::now().format("%Y-%m-%d")),
        content,
        count: rows.len(),
    }))
}

fn coding_of(c: &Due) -> hbcr::HbcrCoding {
    hbcr::HbcrCoding {
        icdo3_morphology: c.icdo3_morphology.clone(),
        extent_of_disease: c.extent_of_disease,
        ..hbcr::HbcrCoding::default()
    }
}

#[cfg(test)]
mod tests {
    use super::{Due, HEADER, age, cell, coded, row, sex};
    use chrono::NaiveDate;
    use medbrains_core::specialty::hbcr;

    fn d(y: i32, m: u32, day: u32) -> Option<NaiveDate> {
        NaiveDate::from_ymd_opt(y, m, day)
    }

    #[test]
    fn age_counts_whole_years_to_the_diagnosis() {
        assert_eq!(age(d(1970, 6, 15), d(2025, 6, 14)), "54");
        assert_eq!(age(d(1970, 6, 15), d(2025, 6, 15)), "55");
        assert_eq!(age(None, d(2025, 1, 1)), "");
    }

    #[test]
    fn codes_carry_their_meaning() {
        assert_eq!(coded(hbcr::METHOD_OF_DIAGNOSIS, Some(2)), "2 - Microscopic");
        assert_eq!(coded(hbcr::ECOG, None), "");
        assert_eq!(sex("female"), "2 - Female");
        assert_eq!(sex("other"), "8 - Others");
    }

    #[test]
    fn a_row_has_one_cell_per_heading() {
        let due = Due {
            uhid: "UH1".into(),
            patient_name: "Lakshmi, R".into(),
            date_of_birth: d(1970, 6, 15),
            gender: "female".into(),
            address: None,
            hbcr_registration_no: Some("2026/0001".into()),
            date_of_first_diagnosis: d(2026, 3, 2),
            case_registered_through: Some(1),
            referral_type: Some("self".into()),
            method_of_diagnosis: Some(2),
            icdo3_topography: Some("C50.4".into()),
            icdo3_morphology: Some("8500/3".into()),
            icd10_code: Some("C50.4".into()),
            laterality: Some(2),
            sequence: Some(0),
            extent_of_disease: Some(2),
            staging_system: Some(1),
            t_stage: Some("T2".into()),
            n_stage: Some("N1".into()),
            m_stage: Some("M0".into()),
            overall_stage: Some("IIB".into()),
            prior_treatment: Some(2),
            intention: Some(1),
            ecog: Some(1),
            treatment_at_ri: Some(1),
        };
        let r = row(&due);
        assert!(
            r.starts_with("2026/0001,UH1,\"Lakshmi, R\",55,15/06/1970,2 - Female,,02/03/2026,")
        );
        // The quoted name holds one comma that is not a separator.
        assert_eq!(r.matches(',').count(), HEADER.len());
    }

    #[test]
    fn cells_with_commas_or_quotes_are_quoted() {
        assert_eq!(cell("Chennai"), "Chennai");
        assert_eq!(cell("12, Main St"), "\"12, Main St\"");
        assert_eq!(cell("say \"hi\""), "\"say \"\"hi\"\"\"");
    }
}

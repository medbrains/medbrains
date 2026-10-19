//! Rows the NHCX eligibility and pre-auth tests start from.

use axum::http::StatusCode;
use serde_json::Value;
use uuid::Uuid;

use super::Nhcx;

/// A patient with a verified ABHA and an active policy; returns
/// (patient, policy, abha number).
pub async fn seed_insured_patient(n: &Nhcx) -> (Uuid, Uuid, String) {
    let db = &n.app.db;
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Elig', 'Patient', 'female'::gender, '9000000104') RETURNING id",
    )
    .bind(n.tenant)
    .bind(format!("UH-ELIG-{}", n.tag))
    .fetch_one(db)
    .await
    .expect("patient");
    let digits = format!("{:012}", Uuid::new_v4().as_u128() % 1_000_000_000_000);
    let abha = format!("91-{}-{}-{}", &digits[..4], &digits[4..8], &digits[8..]);
    sqlx::query(
        "INSERT INTO patient_abha_links (tenant_id, patient_id, abha_number, status, verified_at) \
         VALUES ($1, $2, $3, 'linked', now())",
    )
    .bind(n.tenant)
    .bind(patient)
    .bind(&abha)
    .execute(db)
    .await
    .expect("abha link");
    let policy: Uuid = sqlx::query_scalar(
        "INSERT INTO patient_insurance (tenant_id, patient_id, insurance_provider, policy_number, \
             member_id, plan_name, valid_from, valid_until) \
         VALUES ($1, $2, 'Mock Payer', $3, 'MEM-1', 'Gold', current_date - 30, current_date + 300) \
         RETURNING id",
    )
    .bind(n.tenant)
    .bind(patient)
    .bind(format!("POL-{}", n.tag))
    .fetch_one(db)
    .await
    .expect("policy");
    (patient, policy, abha)
}

/// The HFR id the bundle should carry — one is registered if none is.
pub async fn hospital_hfr_id(n: &Nhcx) -> String {
    let hfr = format!("IN{}", &n.tag.to_uppercase()[..8]) + "01";
    sqlx::query(
        "INSERT INTO facilities (tenant_id, code, name, facility_type, hfr_facility_id, hfr_status) \
         SELECT $1, $2, 'NHCX campus', 'main_hospital', $3, 'verified' \
         WHERE NOT EXISTS (SELECT 1 FROM facilities WHERE tenant_id = $1 \
                             AND hfr_facility_id IS NOT NULL AND deleted_at IS NULL)",
    )
    .bind(n.tenant)
    .bind(format!("NHCX-{}", n.tag))
    .bind(&hfr)
    .execute(&n.app.db)
    .await
    .expect("facility");
    sqlx::query_scalar(
        "SELECT hfr_facility_id FROM facilities \
         WHERE tenant_id = $1 AND deleted_at IS NULL AND hfr_facility_id IS NOT NULL \
         ORDER BY (parent_id IS NULL) DESC, (facility_type = 'main_hospital') DESC, created_at \
         LIMIT 1",
    )
    .bind(n.tenant)
    .fetch_one(&n.app.db)
    .await
    .expect("hfr id")
}

pub fn resources<'a>(bundle: &'a Value, kind: &'a str) -> impl Iterator<Item = &'a Value> + 'a {
    bundle["entry"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|e| &e["resource"])
        .filter(move |r| r["resourceType"] == kind)
}

pub fn has_identifier(resource: &Value, system: &str, value: &str) -> bool {
    resource["identifier"]
        .as_array()
        .into_iter()
        .flatten()
        .any(|i| i["system"] == system && i["value"] == value)
}

pub async fn post(n: &Nhcx, path: &str, body: &Value) -> reqwest::Response {
    n.app
        .client
        .post(n.app.url(path))
        .header("x-csrf-token", &n.csrf)
        .json(body)
        .send()
        .await
        .expect("request")
}

pub async fn get_json(n: &Nhcx, path: &str) -> Value {
    let resp = n.app.client.get(n.app.url(path)).send().await.expect("get");
    assert_eq!(resp.status(), StatusCode::OK, "{path}");
    resp.json().await.expect("json")
}

/// A pre-authorisation on an encounter with a coded diagnosis and one
/// supporting document; returns (prior auth, document).
pub async fn seed_preauth(n: &Nhcx, patient: Uuid, policy: Uuid) -> (Uuid, Uuid) {
    let db = &n.app.db;
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         VALUES ($1, $2, 'ipd') RETURNING id",
    )
    .bind(n.tenant)
    .bind(patient)
    .fetch_one(db)
    .await
    .expect("encounter");
    sqlx::query(
        "INSERT INTO diagnoses (tenant_id, encounter_id, icd_code, description, is_primary, \
             snomed_code) \
         VALUES ($1, $2, 'K35.80', 'Acute appendicitis', true, '85189001')",
    )
    .bind(n.tenant)
    .bind(encounter)
    .execute(db)
    .await
    .expect("diagnosis");
    let pa: Uuid = sqlx::query_scalar(
        "INSERT INTO prior_auth_requests (tenant_id, pa_number, patient_id, patient_insurance_id, \
             service_type, service_code, service_description, encounter_id, estimated_cost) \
         VALUES ($1, $2, $3, $4, 'surgery', '44950', 'Appendicectomy', $5, 50000) RETURNING id",
    )
    .bind(n.tenant)
    .bind(format!("PA-NHCX-{}", n.tag))
    .bind(patient)
    .bind(policy)
    .bind(encounter)
    .fetch_one(db)
    .await
    .expect("prior auth");
    let doc: Uuid = sqlx::query_scalar(
        "INSERT INTO prior_auth_documents (tenant_id, prior_auth_id, document_type, file_name, \
             mime_type) \
         VALUES ($1, $2, 'investigation', 'ct-abdomen.pdf', 'application/pdf') RETURNING id",
    )
    .bind(n.tenant)
    .bind(pa)
    .fetch_one(db)
    .await
    .expect("document");
    (pa, doc)
}

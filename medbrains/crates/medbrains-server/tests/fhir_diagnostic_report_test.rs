//! Released lab and imaging reports as FHIR `DiagnosticReport` (#225): a
//! verified lab order reads with its LOINC-coded results linked, a verified
//! imaging report reads with its impression, a draft does not leave, and the
//! patient's `$everything` carries both.

mod common;

use reqwest::StatusCode;
use serde_json::Value;
use uuid::Uuid;

struct Seeded {
    patient: Uuid,
    lab_order: Uuid,
    result: Uuid,
    imaging: Uuid,
    draft: Uuid,
}

async fn one(app: &common::TestApp, sql: &str, binds: &[Uuid]) -> Uuid {
    let mut q = sqlx::query_scalar::<_, Uuid>(sql);
    for b in binds {
        q = q.bind(*b);
    }
    q.fetch_one(&app.db).await.expect(sql)
}

async fn seed(app: &common::TestApp) -> Seeded {
    let tenant = one(
        app,
        "SELECT tenant_id FROM users WHERE username = 'admin'",
        &[],
    )
    .await;
    let admin = one(app, "SELECT id FROM users WHERE username = 'admin'", &[]).await;
    let tag = Uuid::new_v4().simple().to_string()[..10].to_owned();
    let patient = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Fhir', 'Report', 'female', '9000000225') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-DR-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let encounter = one(
        app,
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         VALUES ($1, $2, 'opd') RETURNING id",
        &[tenant, patient],
    )
    .await;
    let test = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO lab_test_catalog (tenant_id, code, name, loinc_code) \
         VALUES ($1, $2, 'Haemoglobin', '718-7') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("HB{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("test");
    let lab_order = one(
        app,
        "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by, \
                                 status, verified_at, interpretation) \
         VALUES ($1, $2, $3, $4, $5, 'verified', now(), 'Mild anaemia') RETURNING id",
        &[tenant, encounter, patient, test, admin],
    )
    .await;
    let result = one(
        app,
        "INSERT INTO lab_results (tenant_id, order_id, parameter_name, value, unit, flag) \
         VALUES ($1, $2, 'Haemoglobin', '10.2', 'g/dL', 'low') RETURNING id",
        &[tenant, lab_order],
    )
    .await;
    let modality = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO radiology_modalities (tenant_id, code, name) VALUES ($1, $2, 'X-ray') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("XR{}", &tag[..6]))
    .fetch_one(&app.db)
    .await
    .expect("modality");
    let ro = one(
        app,
        "INSERT INTO radiology_orders (tenant_id, patient_id, modality_id, ordered_by, body_part) \
         VALUES ($1, $2, $3, $4, 'Chest') RETURNING id",
        &[tenant, patient, modality, admin],
    )
    .await;
    let imaging = one(
        app,
        "INSERT INTO radiology_reports (tenant_id, order_id, reported_by, findings, impression, \
                                       status, verified_at) \
         VALUES ($1, $2, $3, 'Lungs clear.', 'No active disease', 'final', now()) RETURNING id",
        &[tenant, ro, admin],
    )
    .await;
    let draft = one(
        app,
        "INSERT INTO radiology_reports (tenant_id, order_id, reported_by, findings) \
         VALUES ($1, $2, $3, 'Working note') RETURNING id",
        &[tenant, ro, admin],
    )
    .await;
    Seeded {
        patient,
        lab_order,
        result,
        imaging,
        draft,
    }
}

async fn get(app: &common::TestApp, path: &str) -> (StatusCode, Value) {
    let resp = app.client.get(app.url(path)).send().await.expect("get");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

#[tokio::test]
async fn released_reports_read_as_fhir_and_a_draft_does_not() {
    let app = common::spawn_app().await;
    app.login_admin().await;
    let s = seed(&app).await;

    let (status, lab) = get(&app, &format!("/api/fhir/DiagnosticReport/{}", s.lab_order)).await;
    assert_eq!(status, StatusCode::OK, "{lab}");
    assert_eq!(lab["resourceType"], "DiagnosticReport");
    assert_eq!(lab["category"][0]["coding"][0]["code"], "LAB");
    assert_eq!(lab["code"]["coding"][0]["code"], "718-7");
    assert_eq!(lab["code"]["coding"][0]["system"], "http://loinc.org");
    assert_eq!(
        lab["result"][0]["reference"],
        format!("Observation/{}", s.result)
    );
    assert_eq!(lab["conclusion"], "Mild anaemia");

    let (status, obs) = get(&app, &format!("/api/fhir/Observation/{}", s.result)).await;
    assert_eq!(status, StatusCode::OK, "{obs}");
    assert_eq!(obs["code"]["coding"][0]["code"], "718-7");
    assert_eq!(obs["valueQuantity"]["value"], 10.2);
    assert_eq!(obs["interpretation"][0]["coding"][0]["code"], "L");

    let (status, xray) = get(&app, &format!("/api/fhir/DiagnosticReport/{}", s.imaging)).await;
    assert_eq!(status, StatusCode::OK, "{xray}");
    assert_eq!(xray["category"][0]["coding"][0]["code"], "RAD");
    assert_eq!(xray["conclusion"], "No active disease");

    let (status, _) = get(&app, &format!("/api/fhir/DiagnosticReport/{}", s.draft)).await;
    assert_eq!(status, StatusCode::NOT_FOUND, "a draft report never leaves");

    let (status, bundle) = get(
        &app,
        &format!("/api/fhir/Patient/{}/$everything", s.patient),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{bundle}");
    let urls: Vec<&str> = bundle["entry"]
        .as_array()
        .map(|e| e.iter().filter_map(|x| x["fullUrl"].as_str()).collect())
        .unwrap_or_default();
    for wanted in [
        format!("DiagnosticReport/{}", s.lab_order),
        format!("DiagnosticReport/{}", s.imaging),
        format!("Observation/{}", s.result),
    ] {
        assert!(
            urls.contains(&wanted.as_str()),
            "{wanted} missing from {urls:?}"
        );
    }
    assert!(!urls.contains(&format!("DiagnosticReport/{}", s.draft).as_str()));
}

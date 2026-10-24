//! The diagnosis coding switch (ICD-11 / ICD-10 / both) and the hospital's
//! own licensed ICD-10 catalogue. Every ICD-10 code here is a hand-written
//! fixture — MedBrains ships no ICD-10 content.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(csrf: &str, req: reqwest::RequestBuilder) -> (StatusCode, Value) {
    let resp = req
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn admin_tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin tenant")
}

/// The catalogue is tenant-scoped under forced RLS, so even the test's own
/// connection names the tenant.
async fn retire_catalogue(app: &common::TestApp, tenant: Uuid) {
    let mut tx = app.db.begin().await.expect("tx");
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .expect("tenant context");
    sqlx::query("UPDATE icd10_releases SET deleted_at = now() WHERE deleted_at IS NULL")
        .execute(&mut *tx)
        .await
        .expect("retire");
    tx.commit().await.expect("commit");
}

async fn encounter(app: &common::TestApp, csrf: &str) -> String {
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Coding', 'Switch', 'other'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("UH-DC-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let department: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = 'GEN-MEDICINE'",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (status, visit) = send(
        csrf,
        app.client
            .post(app.url("/api/opd/encounters"))
            .json(&json!({ "patient_id": patient, "department_id": department })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    visit["encounter"]["id"]
        .as_str()
        .expect("encounter")
        .to_owned()
}

/// Given a hospital created after the switch arrived, Then it codes in
/// ICD-11 from its first day — the default lives in git, not a hand fix.
#[tokio::test]
async fn a_new_hospital_codes_in_icd11() {
    let app = common::spawn_app().await;
    let mut tx = app.db.begin().await.expect("tx");
    let hospital_type: String =
        sqlx::query_scalar("SELECT hospital_type::text FROM tenants LIMIT 1")
            .fetch_one(&mut *tx)
            .await
            .expect("hospital type");
    let tenant = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO tenants (id, code, name, hospital_type, config) \
         VALUES ($1, $2, 'Coding check', $3::text::hospital_type, '{}'::jsonb)",
    )
    .bind(tenant)
    .bind(format!("DC{}", &tenant.simple().to_string()[..8]).to_uppercase())
    .bind(&hospital_type)
    .execute(&mut *tx)
    .await
    .expect("new hospital");
    let mode: Value = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
          WHERE tenant_id = $1 AND category = 'clinical' AND key = 'diagnosis_coding'",
    )
    .bind(tenant)
    .fetch_one(&mut *tx)
    .await
    .expect("the default row");
    tx.rollback().await.expect("rollback");
    assert_eq!(mode, json!("icd11"));
}

/// Given no ICD-10 catalogue is loaded, When a doctor searches ICD-10, Then
/// the answer says so (409) — never an empty "no match". When an
/// administrator loads the licensed file, Then ICD-10 codes are searchable
/// with their system, loading it again changes nothing, and the switch
/// decides which systems new diagnoses may be coded in. One test, because
/// the catalogue and the switch are one hospital's shared state.
#[tokio::test]
async fn icd10_catalogue_and_the_coding_switch() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = admin_tenant(&app).await;
    retire_catalogue(&app, tenant).await;

    let search = app.url("/api/terminology/search?system=icd10&q=A90");
    let (status, body) = send(&csrf, app.client.get(&search)).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(
        body.to_string().contains("ICD-10 catalogue not loaded"),
        "{body}"
    );

    let tag = Uuid::new_v4().simple().to_string();
    let file = format!(
        "code,title,chapter\nA90,Fixture fever,I\nE11.9,Fixture two,IV\nZ99.9,Fixture {tag},XXI\n"
    );
    let import = json!({
        "format": "csv", "version": "fixture", "source": "Test fixture",
        "licence_note": "Test fixture, not ICD-10 content", "file_name": "fixture.csv", "content": file,
    });
    let releases = app.url("/api/terminology/icd10/releases");
    let (status, first) = send(&csrf, app.client.post(&releases).json(&import)).await;
    assert_eq!(status, StatusCode::CREATED, "{first}");
    assert_eq!(first["release"]["code_count"], 3);
    assert_eq!(first["already_loaded"], false);
    let (status, again) = send(&csrf, app.client.post(&releases).json(&import)).await;
    assert_eq!(status, StatusCode::OK, "{again}");
    assert_eq!(again["already_loaded"], true);
    assert_eq!(again["release"]["id"], first["release"]["id"]);

    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE tenant_id = $1 AND action = 'icd10_catalogue_loaded' \
           AND entity_id = $2::uuid",
    )
    .bind(tenant)
    .bind(first["release"]["id"].as_str().expect("release id"))
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(audited, 1, "one load, one audit row");

    let (status, hits) = send(&csrf, app.client.get(&search)).await;
    assert_eq!(status, StatusCode::OK, "{hits}");
    assert_eq!(hits[0]["code"], "A90");
    assert_eq!(hits[0]["system"], "icd10");
    let (_, by_word) = send(
        &csrf,
        app.client
            .get(app.url("/api/terminology/search?system=icd10&q=e119")),
    )
    .await;
    assert_eq!(
        by_word[0]["code"], "E11.9",
        "the dot is optional: {by_word}"
    );

    let bad = json!({ "format": "csv", "version": "x", "source": "x", "licence_note": "x", "content": "1D2Z,Fixture eleven\n" });
    let (status, refused) = send(&csrf, app.client.post(&releases).json(&bad)).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "an ICD-11 file is not ICD-10: {refused}"
    );
    let no_licence = json!({ "format": "csv", "version": "x", "source": "x", "licence_note": " ", "content": file });
    let (status, _) = send(&csrf, app.client.post(&releases).json(&no_licence)).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "a load must record its licence"
    );

    // The switch governs new codes: ICD-10 only from the loaded catalogue,
    // a system the hospital does not code in refused, and a diagnosis coded
    // before a switch still editable. Only an administrator may switch.
    let coding = app.url("/api/terminology/diagnosis-coding");
    let (status, both) = send(
        &csrf,
        app.client.put(&coding).json(&json!({ "mode": "both" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{both}");
    assert_eq!(both["mode"], "both");
    assert!(both["icd10_catalogue"].is_object());

    let enc = encounter(&app, &csrf).await;
    // A writer that names no system: the code's shape labels it, whichever
    // revision it is (fixture codes).
    for (code, system) in [("K35.80", "icd10"), ("CA02", "icd11")] {
        let stored: String = sqlx::query_scalar(
            "INSERT INTO diagnoses (tenant_id, encounter_id, icd_code, description) \
             SELECT tenant_id, id, $2, 'Fixture' FROM encounters WHERE id = $1::uuid \
             RETURNING icd_system",
        )
        .bind(&enc)
        .bind(code)
        .fetch_one(&app.db)
        .await
        .expect("diagnosis without a system");
        assert_eq!(stored, system, "{code}");
    }
    let dx = app.url(&format!("/api/opd/encounters/{enc}/diagnoses"));
    let add = |system: &str, code: &str| json!({ "description": "Fixture", "icd_system": system, "icd_code": code });
    let (status, icd10) = send(&csrf, app.client.post(&dx).json(&add("icd10", "A90"))).await;
    assert_eq!(status, StatusCode::OK, "{icd10}");
    assert_eq!(icd10["icd_system"], "icd10");
    let (status, _) = send(&csrf, app.client.post(&dx).json(&add("icd11", "1D2Z"))).await;
    assert_eq!(status, StatusCode::OK, "both systems under both");
    let (status, missing) = send(&csrf, app.client.post(&dx).json(&add("icd10", "B99"))).await;
    assert_eq!(
        status,
        StatusCode::BAD_REQUEST,
        "not in the catalogue: {missing}"
    );

    let (status, _) = send(
        &csrf,
        app.client.put(&coding).json(&json!({ "mode": "icd11" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let (status, refused) = send(&csrf, app.client.post(&dx).json(&add("icd10", "A90"))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{refused}");
    assert!(refused.to_string().contains("ICD-11"), "{refused}");
    let id = icd10["id"].as_str().expect("id");
    let (status, resolved) = send(
        &csrf,
        app.client
            .put(format!("{dx}/{id}"))
            .json(&json!({ "certainty": "ruled_out" })),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "an older ICD-10 diagnosis stays editable: {resolved}"
    );
    assert_eq!(resolved["icd_system"], "icd10");

    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE tenant_id = $1 AND action = 'diagnosis_coding_changed'",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert!(audited >= 2, "each switch is audited");

    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let (status, seen) = send(&doctor.csrf, doctor.client.get(&coding)).await;
    assert_eq!(
        status,
        StatusCode::OK,
        "the picker reads the switch: {seen}"
    );
    assert_eq!(seen["mode"], "icd11");
    let (status, _) = send(
        &doctor.csrf,
        doctor.client.put(&coding).json(&json!({ "mode": "icd10" })),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN, "only administrators switch");
    let (status, _) = send(&doctor.csrf, doctor.client.get(&releases)).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

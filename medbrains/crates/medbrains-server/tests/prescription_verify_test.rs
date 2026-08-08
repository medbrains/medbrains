mod common;

use uuid::Uuid;

/// The QR on a printed prescription used to encode the raw encounter id at a
/// route that was never registered. Two things had to change together: the
/// route has to exist, and what it resolves must not be a raw entity id.
///
/// These pin the properties that make the replacement safe rather than merely
/// working.
#[tokio::test]
async fn an_unknown_token_is_refused_and_reveals_nothing() {
    let app = common::spawn_app().await;
    let anonymous = reqwest::Client::new();

    let invented = anonymous
        .get(app.url(&format!(
            "/api/public/prescriptions/verify/{}",
            Uuid::new_v4().simple()
        )))
        .send()
        .await
        .expect("request sends");

    assert_eq!(
        invented.status().as_u16(),
        404,
        "a token nobody issued must not resolve"
    );

    let body = invented.text().await.unwrap_or_default();
    assert!(
        !body.to_lowercase().contains("expired"),
        "the answer must not distinguish 'expired' from 'never existed' — that \
         would confirm a token once existed for this prescription: {body}"
    );
}

/// An expired link must stop working, and must fail the same way as one that
/// never existed.
#[tokio::test]
async fn an_expired_link_stops_resolving() {
    let app = common::spawn_app().await;
    let _csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");
    let department_id: Uuid =
        sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id = $1 LIMIT 1")
            .bind(tenant_id)
            .fetch_one(&app.db)
            .await
            .expect("a seeded department");
    let patient_id: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Verify', 'Expired', 'male', '9990002001') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("UH{}", &Uuid::new_v4().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("insert patient");

    let encounter_id: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, department_id) \
         VALUES ($1, $2, 'opd'::encounter_type, $3) RETURNING id",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(department_id)
    .fetch_one(&app.db)
    .await
    .expect("insert encounter");

    let stale_token = format!("stale-{}", Uuid::new_v4().simple());
    sqlx::query(
        "INSERT INTO prescription_verify_links \
         (tenant_id, encounter_id, token, expires_at) \
         VALUES ($1, $2, $3, now() - INTERVAL '1 day')",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(&stale_token)
    .execute(&app.db)
    .await
    .expect("insert expired link");

    let response = reqwest::Client::new()
        .get(app.url(&format!("/api/public/prescriptions/verify/{stale_token}")))
        .send()
        .await
        .expect("request sends");

    assert_eq!(
        response.status().as_u16(),
        404,
        "an expired link must stop resolving — this is the whole reason the QR \
         carries a token instead of the encounter id, which never expires"
    );
}

/// A live link resolves, returns the prescribed items so an altered paper can
/// be caught, and withholds the identifying detail a public page has no business
/// carrying.
#[tokio::test]
async fn a_live_link_returns_the_items_but_not_the_patient() {
    let app = common::spawn_app().await;
    let _csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");
    let department_id: Uuid =
        sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id = $1 LIMIT 1")
            .bind(tenant_id)
            .fetch_one(&app.db)
            .await
            .expect("a seeded department");
    let doctor_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE tenant_id = $1 LIMIT 1")
        .bind(tenant_id)
        .fetch_one(&app.db)
        .await
        .expect("a seeded user");

    let uhid = format!("UH{}", &Uuid::new_v4().to_string()[..8]);
    let patient_id: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Ramesh', 'Kulkarni', 'male', '9990002002') RETURNING id",
    )
    .bind(tenant_id)
    .bind(&uhid)
    .fetch_one(&app.db)
    .await
    .expect("insert patient");

    let encounter_id: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, department_id, doctor_id) \
         VALUES ($1, $2, 'opd'::encounter_type, $3, $4) RETURNING id",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(department_id)
    .bind(doctor_id)
    .fetch_one(&app.db)
    .await
    .expect("insert encounter");

    let prescription_id: Uuid = sqlx::query_scalar(
        "INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, patient_id) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(doctor_id)
    .bind(patient_id)
    .fetch_one(&app.db)
    .await
    .expect("insert prescription");

    sqlx::query(
        "INSERT INTO prescription_items \
         (tenant_id, prescription_id, drug_name, dosage, frequency, duration) \
         VALUES ($1, $2, 'Amoxicillin 500mg', '1 cap', 'TDS', '5 days')",
    )
    .bind(tenant_id)
    .bind(prescription_id)
    .execute(&app.db)
    .await
    .expect("insert item");

    let token = format!("live-{}", Uuid::new_v4().simple());
    sqlx::query(
        "INSERT INTO prescription_verify_links \
         (tenant_id, encounter_id, token, expires_at) \
         VALUES ($1, $2, $3, now() + INTERVAL '30 days')",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(&token)
    .execute(&app.db)
    .await
    .expect("insert link");

    let body: serde_json::Value = reqwest::Client::new()
        .get(app.url(&format!("/api/public/prescriptions/verify/{token}")))
        .send()
        .await
        .expect("request sends")
        .json()
        .await
        .expect("json body");

    let medications = body["medications"].as_array().expect("medications array");
    assert_eq!(
        medications.len(),
        1,
        "the items must come back — a page that cannot show them cannot catch \
         the usual forgery, which is an altered quantity on a real script: {body}"
    );
    assert_eq!(
        medications[0]["drug_name"].as_str(),
        Some("Amoxicillin 500mg")
    );

    assert_eq!(
        body["patient_initials"].as_str(),
        Some("RK"),
        "initials are enough to match the paper: {body}"
    );
    assert_eq!(
        body["uhid_suffix"].as_str(),
        Some(&uhid[uhid.len() - 4..]),
        "only the tail of the UHID: {body}"
    );

    let serialised = body.to_string();
    for leaked in ["Ramesh", "Kulkarni", "9990002002", &uhid] {
        assert!(
            !serialised.contains(leaked),
            "a public verification page must not carry {leaked} — the pharmacist \
             already holds the paper with the name on it, and this link would \
             otherwise let anyone who photographs a script look the person up: \
             {serialised}"
        );
    }
}

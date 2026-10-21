//! Code Pink: a baby is handed over only when its band matches the mother's
//! (a mismatch is refused, alerted and audited), and an infant tag leaving
//! its zone or tampered with raises one Code Pink — not one per reader ping.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn patient(app: &common::TestApp, tenant: Uuid, uhid: &str, first: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, $3, 'Pink', 'female', '9000000002') RETURNING id",
    )
    .bind(tenant)
    .bind(uhid)
    .bind(first)
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

async fn post(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> reqwest::Response {
    app.client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request")
}

#[tokio::test]
async fn a_band_mismatch_is_refused_and_an_infant_tag_exit_raises_one_code_pink() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let mother_uhid = format!("UH-CP-{tag}");
    let mother = patient(&app, tenant, &mother_uhid, "Mother").await;
    let baby = patient(&app, tenant, &format!("UH-CPB-{tag}"), "Baby").await;
    let band = format!("INF-{tag}");

    // An infant tag without its mother cannot be matched, so it is refused.
    let orphan = post(
        &app,
        &csrf,
        "/api/security/patient-tags",
        json!({
            "patient_id": baby, "tag_type": "infant_rfid", "tag_identifier": band,
        }),
    )
    .await;
    assert_eq!(orphan.status(), StatusCode::BAD_REQUEST);
    let created = post(&app, &csrf, "/api/security/patient-tags", json!({
        "patient_id": baby, "tag_type": "infant_rfid", "tag_identifier": band, "mother_id": mother,
    }))
    .await;
    assert_eq!(created.status(), StatusCode::OK);
    let tag_id: Uuid = created.json::<Value>().await.expect("tag")["id"]
        .as_str()
        .expect("id")
        .parse()
        .expect("uuid");

    // The wrong mother: refused, alerted, audited.
    let wrong = post(
        &app,
        &csrf,
        "/api/security/patient-tags/verify-match",
        json!({
            "infant_tag": band, "mother_band": "UH-SOMEONE-ELSE", "purpose": "handover",
        }),
    )
    .await;
    assert_eq!(
        wrong.status(),
        StatusCode::CONFLICT,
        "a band mismatch was let through"
    );
    let mismatch_alerts: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM security_tag_alerts WHERE tag_id = $1 AND alert_type = 'band_mismatch'",
    )
    .bind(tag_id)
    .fetch_one(&app.db)
    .await
    .expect("alerts");
    assert_eq!(mismatch_alerts, 1);
    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE entity_id = $1 AND action = 'security.band_match.mismatch'",
    )
    .bind(tag_id)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(audited, 1);

    // The right mother: matched (case does not matter on a scanner).
    let right = post(
        &app,
        &csrf,
        "/api/security/patient-tags/verify-match",
        json!({
            "infant_tag": band.to_lowercase(), "mother_band": mother_uhid, "purpose": "handover",
        }),
    )
    .await;
    assert_eq!(right.status(), StatusCode::OK);
    assert_eq!(
        right.json::<Value>().await.expect("match")["matched"],
        json!(true)
    );

    // The tag leaves its zone: an alert and a Code Pink.
    let exit = post(&app, &csrf, "/api/security/tag-events", json!({
        "tag_identifier": band, "event_type": "exit_zone", "location_description": "Maternity exit",
    }))
    .await;
    assert_eq!(exit.status(), StatusCode::OK);
    let exit: Value = exit.json().await.expect("event");
    let code = exit["code_pink_activation_id"]
        .as_str()
        .expect("no Code Pink")
        .to_owned();
    let code_type: String =
        sqlx::query_scalar("SELECT code_type FROM er_code_activations WHERE id = $1::uuid")
            .bind(&code)
            .fetch_one(&app.db)
            .await
            .expect("code");
    assert_eq!(code_type, "code_pink");

    // The reader fires again, then the band is cut: still one code.
    let again: Value = post(
        &app,
        &csrf,
        "/api/security/tag-events",
        json!({
            "tag_identifier": band, "event_type": "exit_zone",
        }),
    )
    .await
    .json()
    .await
    .expect("again");
    assert_eq!(again["deduplicated"], json!(true));
    let tamper: Value = post(
        &app,
        &csrf,
        "/api/security/tag-events",
        json!({
            "tag_identifier": band, "event_type": "tamper",
        }),
    )
    .await
    .json()
    .await
    .expect("tamper");
    assert_eq!(
        tamper["code_pink_activation_id"].as_str(),
        Some(code.as_str())
    );
    let codes: i64 = sqlx::query_scalar(
        "SELECT count(DISTINCT code_activation_id) FROM security_tag_alerts WHERE tag_id = $1",
    )
    .bind(tag_id)
    .fetch_one(&app.db)
    .await
    .expect("codes");
    assert_eq!(codes, 1, "one abduction raised more than one Code Pink");

    // The maternity newborn screen runs the same check: a wrong mother is
    // refused there too, and lands on the same infant tag as an alert.
    let reg: Uuid = sqlx::query_scalar(
        "INSERT INTO maternity_registrations (tenant_id, patient_id, registration_number, lmp_date, edd_date) \
         VALUES ($1, $2, $3, DATE '2026-01-01', DATE '2026-10-08') RETURNING id",
    )
    .bind(tenant)
    .bind(mother)
    .bind(format!("MAT-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("registration");
    let labor: Uuid = sqlx::query_scalar(
        "INSERT INTO labor_records (tenant_id, registration_id) VALUES ($1, $2) RETURNING id",
    )
    .bind(tenant)
    .bind(reg)
    .fetch_one(&app.db)
    .await
    .expect("labor");
    let newborn: Uuid = sqlx::query_scalar(
        "INSERT INTO newborn_records (tenant_id, labor_id, birth_date, gender, weight_gm, \
                                      baby_id, mother_id, id_band_number) \
         VALUES ($1, $2, CURRENT_DATE, 'female', 3100, $3, $4, $5) RETURNING id",
    )
    .bind(tenant)
    .bind(labor)
    .bind(baby)
    .bind(mother)
    .bind(&band)
    .fetch_one(&app.db)
    .await
    .expect("newborn");
    let path = format!("/api/specialty/maternity/newborns/{newborn}/verify-identity");
    let wrong = post(
        &app,
        &csrf,
        &path,
        json!({
            "scanned_mother_uhid": "UH-SOMEONE-ELSE", "scanned_band": band,
        }),
    )
    .await;
    let wrong_status = wrong.status();
    let wrong_body = wrong.text().await.unwrap_or_default();
    assert_eq!(
        wrong_status,
        StatusCode::CONFLICT,
        "maternity let a band mismatch through: {wrong_body}"
    );
    let mismatch_alerts: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM security_tag_alerts WHERE tag_id = $1 AND alert_type = 'band_mismatch'",
    )
    .bind(tag_id)
    .fetch_one(&app.db)
    .await
    .expect("alerts");
    assert_eq!(
        mismatch_alerts, 2,
        "the maternity mismatch did not reach the infant tag"
    );
    let right = post(
        &app,
        &csrf,
        &path,
        json!({
            "scanned_mother_uhid": mother_uhid, "scanned_band": band,
        }),
    )
    .await;
    assert_eq!(right.status(), StatusCode::OK);
    assert_eq!(
        right.json::<Value>().await.expect("verified")["verified"],
        json!(true)
    );

    // Stand the drill down so the dev screens are not left in Code Pink.
    sqlx::query("UPDATE er_code_activations SET deactivated_at = now(), outcome = 'false_alarm' WHERE id = $1::uuid")
        .bind(&code)
        .execute(&app.db)
        .await
        .expect("stand down");
}

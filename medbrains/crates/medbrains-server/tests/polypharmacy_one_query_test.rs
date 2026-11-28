//! The polypharmacy check finds the same interacting pairs it always did,
//! without one database round trip per pair of drugs (190 for 20 drugs).

use crate::{common, query_count};

use reqwest::StatusCode;
use serde_json::Value;
use std::collections::BTreeSet;
use uuid::Uuid;

#[tokio::test]
async fn twenty_drugs_find_their_three_interactions_in_a_few_statements() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tag = format!("Px{}", &Uuid::new_v4().simple().to_string()[..8]);
    let patient: Uuid = sqlx::query_scalar(
        "WITH u AS (SELECT id, tenant_id FROM users WHERE username = 'admin'), \
              p AS (INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
                    SELECT tenant_id, $1, 'Poly', 'Pharmacy', 'other'::gender, '9000000003' \
                      FROM u RETURNING id, tenant_id), \
              m AS (INSERT INTO medication_timeline_events \
                      (tenant_id, patient_id, event_type, drug_name, ordered_by) \
                    SELECT p.tenant_id, p.id, 'started', $1 || ' drug ' || lpad(n::text, 2, '0'), u.id \
                      FROM p, u, generate_series(1, 20) AS n) \
         SELECT id FROM p",
    )
    .bind(&tag)
    .fetch_one(&app.db)
    .await
    .expect("patient on 20 drugs");
    // 01-02 (listed twice), 04-03 the other way round and in capitals, 05-20.
    sqlx::query(
        "INSERT INTO drug_interactions (tenant_id, drug_a_name, drug_b_name, severity, description) \
         SELECT tenant_id, a, b, s, 'test' FROM users, (VALUES \
           ($1 || ' drug 01', $1 || ' drug 02', 'major'), \
           ($1 || ' drug 01', $1 || ' drug 02', 'major'), \
           (upper($1 || ' drug 04'), $1 || ' DRUG 03', 'moderate'), \
           ($1 || ' drug 05', $1 || ' drug 20', 'minor')) AS v(a, b, s) \
          WHERE username = 'admin'",
    )
    .bind(&tag)
    .execute(&app.db)
    .await
    .expect("interactions");

    let resp = app
        .client
        .post(app.url(&format!(
            "/api/chronic-care/patients/{patient}/check-interactions"
        )))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("request");
    assert_eq!(resp.status(), StatusCode::OK);
    let statements = query_count::of(&resp).expect("statement count");
    let alerts: Value = resp.json().await.expect("json");
    let found: BTreeSet<(String, String, String)> = alerts
        .as_array()
        .expect("alerts")
        .iter()
        .map(|a| {
            let s = |k: &str| a[k].as_str().unwrap_or_default().to_owned();
            (s("drug_a_name"), s("drug_b_name"), s("severity"))
        })
        .collect();
    let want: BTreeSet<_> = [
        ("01", "02", "major"),
        ("03", "04", "moderate"),
        ("05", "20", "minor"),
    ]
    .iter()
    .map(|(a, b, s)| {
        (
            format!("{tag} drug {a}"),
            format!("{tag} drug {b}"),
            (*s).to_owned(),
        )
    })
    .collect();
    assert_eq!(
        found, want,
        "the same pairs, named as the patient's drugs are"
    );
    assert!(
        statements < 40,
        "{statements} statements for one check of 20 drugs"
    );
}

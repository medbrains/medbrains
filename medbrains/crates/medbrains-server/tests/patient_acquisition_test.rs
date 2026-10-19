//! Which campaign brought a patient in: picked at registration, shown on the
//! patient, corrected later, and counted by the acquisition report. The
//! report is what marketing spend is judged on, so a correction must move
//! the count — a patient the desk mis-tagged is not the campaign's.

mod common;

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

#[tokio::test]
async fn a_campaign_counts_the_patients_it_brought_until_one_is_corrected() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tag = Uuid::new_v4().simple().to_string()[..6].to_uppercase();
    let name = format!("Heart camp {tag}");

    let (status, campaign) = send(
        &csrf,
        app.client
            .post(app.url("/api/marketing/campaigns"))
            .json(&json!({
                "name": name, "channel": "print", "source": "newspaper",
                "spend_minor": 500_000, "code": format!("hc{tag}"),
            })),
    )
    .await;
    assert!(status.is_success(), "{status} {campaign}");
    assert_eq!(
        campaign["code"],
        format!("HC{tag}"),
        "codes are kept upper-case"
    );
    let campaign_id = campaign["id"].as_str().expect("campaign id").to_owned();

    // The same code again is refused: a link must name one campaign.
    let (status, _) = send(
        &csrf,
        app.client
            .post(app.url("/api/marketing/campaigns"))
            .json(&json!({
                "name": format!("{name} copy"), "channel": "print", "source": "newspaper",
                "code": format!("HC{tag}"),
            })),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT);

    let options: Value = app
        .get(&app.client, "/api/marketing/campaigns/lookup")
        .await
        .json()
        .await
        .expect("json");
    assert!(
        options
            .as_array()
            .into_iter()
            .flatten()
            .any(|c| c["id"] == campaign_id.as_str()),
        "the registration picker lists it: {options}"
    );

    let mut patients = Vec::new();
    for n in 0..2 {
        let (status, patient) = send(
            &csrf,
            app.client.post(app.url("/api/patients")).json(&json!({
                "first_name": "Campaign", "last_name": format!("Patient{n}{tag}"),
                "gender": "female", "date_of_birth": "1980-01-01",
                "phone": format!("98{:08}", Uuid::new_v4().as_u128() % 100_000_000),
                "campaign_id": campaign_id,
            })),
        )
        .await;
        assert!(status.is_success(), "{status} {patient}");
        patients.push(patient["id"].as_str().expect("patient id").to_owned());
    }

    let first = &patients[0];
    let acquisition: Value = app
        .get(&app.client, &format!("/api/patients/{first}/acquisition"))
        .await
        .json()
        .await
        .expect("json");
    assert_eq!(acquisition["campaign_name"], name.as_str());
    assert_eq!(acquisition["captured_via"], "registration");

    let row = |report: &Value| {
        report["rows"]
            .as_array()
            .into_iter()
            .flatten()
            .find(|r| r["campaign"] == name.as_str())
            .cloned()
            .unwrap_or(Value::Null)
    };
    let report: Value = app
        .get(&app.client, "/api/reports/campaign-attribution/data")
        .await
        .json()
        .await
        .expect("json");
    assert_eq!(row(&report)["new_patients"], 2, "{report}");
    assert_eq!(
        row(&report)["spend"],
        5000.0,
        "spend is in rupees, from paise"
    );
    assert_eq!(row(&report)["cost_per_patient"], 2500.0);

    // The desk tagged the second patient wrongly: they came on their own.
    let second = &patients[1];
    let (status, corrected) = send(
        &csrf,
        app.client
            .put(app.url(&format!("/api/patients/{second}/acquisition")))
            .json(&json!({ "campaign_id": null })),
    )
    .await;
    assert!(status.is_success(), "{status} {corrected}");
    assert_eq!(corrected["captured_via"], "correction");
    assert!(corrected["campaign_id"].is_null());

    let audited: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_log WHERE action = 'patient.acquisition.corrected' AND entity_id = $1",
    )
    .bind(Uuid::parse_str(second).expect("uuid"))
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(audited, 1, "a correction is audited with the old campaign");

    let report: Value = app
        .get(&app.client, "/api/reports/campaign-attribution/data")
        .await
        .json()
        .await
        .expect("json");
    assert_eq!(
        row(&report)["new_patients"],
        1,
        "the corrected patient leaves the count: {report}"
    );
}

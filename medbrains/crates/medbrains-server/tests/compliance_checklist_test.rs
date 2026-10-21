//! A quality manager's accreditation checklist: criteria entered by the
//! hospital, each assessed, and a score the server computes — the share of
//! applicable criteria found compliant, unassessed ones counting against it.
//! The next period starts from the same criteria, unassessed; a criterion
//! entered by mistake can be removed and the score follows.

use crate::common;

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};

async fn call(
    app: &common::TestApp,
    csrf: &str,
    method: Method,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let resp = app
        .client
        .request(method, app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// The score as a number, whether it arrives as a decimal string or a float.
fn score(v: &Value) -> Option<f64> {
    v["compliance_score"]
        .as_f64()
        .or_else(|| v["compliance_score"].as_str()?.parse().ok())
}

fn checklist(copy_from: Option<&Value>) -> Value {
    json!({
        "accreditation_body": "nabh", "standard_code": "COP", "name": "Care of patients",
        "assessment_period_start": "2026-04-01", "assessment_period_end": "2026-09-30",
        "copy_criteria_from": copy_from,
    })
}

#[tokio::test]
async fn a_checklist_scores_what_was_assessed_and_carries_into_the_next_period() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (s, first) = call(
        &app,
        &csrf,
        Method::POST,
        "/api/regulatory/checklists",
        checklist(None),
    )
    .await;
    assert!(s.is_success(), "{first}");
    let id = first["id"].as_str().unwrap_or_default().to_owned();

    let criteria = [
        "Patients are identified with two identifiers",
        "Care is planned and recorded",
        "Paediatric dosing is weight based",
        "Fall risk is assessed on admission",
    ];
    let items: Vec<Value> = criteria
        .iter()
        .enumerate()
        .map(|(i, c)| json!({ "item_number": i + 1, "criterion": c, "status": "not_started" }))
        .collect();
    let (s, created) = call(
        &app,
        &csrf,
        Method::POST,
        &format!("/api/regulatory/checklists/{id}/items"),
        json!({ "items": items }),
    )
    .await;
    assert!(s.is_success(), "{created}");

    // Assess three: compliant, non-compliant, not applicable; one unassessed.
    for (i, status) in [
        (0, "compliant"),
        (1, "non_compliant"),
        (2, "not_applicable"),
    ] {
        let item = created[i]["id"].as_str().unwrap_or_default();
        let (s, body) = call(
            &app,
            &csrf,
            Method::PUT,
            &format!("/api/regulatory/checklists/{id}/items/{item}"),
            json!({ "status": status, "gap_description": "Seen on the ward round" }),
        )
        .await;
        assert!(s.is_success(), "{body}");
    }
    // A score sent by the client is not the score.
    call(
        &app,
        &csrf,
        Method::PUT,
        &format!("/api/regulatory/checklists/{id}"),
        json!({ "compliance_score": 100 }),
    )
    .await;
    let (_, got) = call(
        &app,
        &csrf,
        Method::GET,
        &format!("/api/regulatory/checklists/{id}"),
        Value::Null,
    )
    .await;
    assert_eq!(got["total_items"], 4);
    assert_eq!(got["compliant_items"], 1);
    assert_eq!(got["non_compliant_items"], 1);
    // 1 compliant of 3 applicable — the unassessed one counts against it.
    assert_eq!(score(&got), Some(33.33), "{got}");
    assert_eq!(got["overall_status"], "in_progress");

    // A criterion entered by mistake is removed; the score follows.
    let unassessed = created[3]["id"].as_str().unwrap_or_default();
    let (s, _) = call(
        &app,
        &csrf,
        Method::DELETE,
        &format!("/api/regulatory/checklists/{id}/items/{unassessed}"),
        Value::Null,
    )
    .await;
    assert!(s.is_success());
    let (_, got) = call(
        &app,
        &csrf,
        Method::GET,
        &format!("/api/regulatory/checklists/{id}"),
        Value::Null,
    )
    .await;
    assert_eq!(got["items"].as_array().map(Vec::len), Some(3));
    assert_eq!(score(&got), Some(50.0));

    // The next period starts from the same criteria, none of them assessed.
    let (s, next) = call(
        &app,
        &csrf,
        Method::POST,
        "/api/regulatory/checklists",
        checklist(Some(&json!(id))),
    )
    .await;
    assert!(s.is_success(), "{next}");
    assert_eq!(next["total_items"], 3);
    assert_eq!(next["overall_status"], "not_started");
    let (_, next) = call(
        &app,
        &csrf,
        Method::GET,
        &format!(
            "/api/regulatory/checklists/{}",
            next["id"].as_str().unwrap_or_default()
        ),
        Value::Null,
    )
    .await;
    let items = next["items"].as_array().cloned().unwrap_or_default();
    assert!(
        items
            .iter()
            .all(|i| i["status"] == "not_started" && i["gap_description"].is_null())
    );
    assert_eq!(items[0]["criterion"], criteria[0]);
}

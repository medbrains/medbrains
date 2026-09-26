//! A camp run as a route of stations
//! (RFCs/modules/RFC-MODULE-token-queues.md, P4a, scenarios 5 and 6).

mod common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn post(app: &common::TestApp, csrf: &str, path: &str, body: Value) -> (StatusCode, Value) {
    let resp = app
        .client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

async fn waiting_at(app: &common::TestApp, counter: &str) -> Vec<Value> {
    let tokens: Vec<Value> = app
        .client
        .get(app.url(&format!(
            "/api/tokens/board?module=camp&scope=counter&scope_id={counter}"
        )))
        .send()
        .await
        .expect("board")
        .json()
        .await
        .expect("board json");
    tokens
        .into_iter()
        .filter(|t| t["status"] == "waiting")
        .collect()
}

/// Given a camp started from "General camp", When a villager registers, Then
/// they wait at Vitals under a camp number; And each station that finishes
/// with them sends them to the next with the same number, until Pharmacy.
#[tokio::test]
async fn a_camp_patient_keeps_one_number_from_registration_to_pharmacy() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let camp: Uuid = sqlx::query_scalar(
        "INSERT INTO camps (tenant_id, camp_code, name, camp_type, scheduled_date, \
                            organizing_department_id) \
         SELECT u.tenant_id, $1, 'Route Camp', 'general_health'::camp_type, CURRENT_DATE, \
                (SELECT id FROM departments d WHERE d.tenant_id = u.tenant_id AND d.is_active LIMIT 1) \
           FROM users u WHERE u.username = 'admin' RETURNING id",
    )
    .bind(format!("RT{suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("camp");

    let (status, route) = post(
        &app,
        &csrf,
        &format!("/api/camp/camps/{camp}/route-template"),
        json!({ "template": "general" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{route}");
    let station = |i: usize| route[i]["counter_id"].as_str().expect("station").to_owned();
    assert_eq!(route[1]["name"], "Vitals");

    let (status, reg) = post(
        &app,
        &csrf,
        "/api/camp/registrations",
        json!({ "camp_id": camp, "person_name": "Lakshmi Devi" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{reg}");
    let number = reg["token_number"]
        .as_str()
        .expect("camp number")
        .to_owned();
    assert!(
        number.starts_with("C-"),
        "a camp number, not the hospital's: {number}"
    );

    for (from, to) in [(1, Some(2)), (2, Some(3)), (3, None)] {
        let here = waiting_at(&app, &station(from)).await;
        let token = here
            .iter()
            .find(|t| t["number"] == number.as_str())
            .expect("waiting here");
        let id = token["id"].as_str().expect("id");
        assert_eq!(
            post(&app, &csrf, &format!("/api/tokens/{id}/call"), json!({}))
                .await
                .0,
            StatusCode::OK
        );
        assert_eq!(
            post(
                &app,
                &csrf,
                &format!("/api/tokens/{id}/complete"),
                json!({})
            )
            .await
            .0,
            StatusCode::OK
        );
        if let Some(next) = to {
            let there = waiting_at(&app, &station(next)).await;
            assert!(
                there.iter().any(|t| t["number"] == number.as_str()),
                "same number at station {next}"
            );
        }
    }
    // After Pharmacy the route ends: the number is waiting nowhere.
    for i in 1..4 {
        assert!(
            !waiting_at(&app, &station(i))
                .await
                .iter()
                .any(|t| t["number"] == number.as_str())
        );
    }

    let (status, _) = post(
        &app,
        &csrf,
        &format!("/api/camp/camps/{camp}/route-template"),
        json!({ "template": "general" }),
    )
    .await;
    assert_eq!(
        status,
        StatusCode::CONFLICT,
        "a template never rearranges a running camp"
    );
}

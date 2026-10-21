//! In-app test tracking (#4804): one cycle open at a time; a fail or a block
//! needs a reason; answering again replaces the answer; a closed cycle takes
//! no more results.

use crate::common;

use serde_json::{Value, json};

#[tokio::test]
async fn a_test_cycle_records_one_answer_per_case_while_open() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    // Close anything a previous run left open.
    sqlx::query("UPDATE qa_test_cycles SET closed_at = now() WHERE closed_at IS NULL")
        .execute(&app.db)
        .await
        .expect("tidy");

    let send = |method: reqwest::Method, path: &str, body: Value| {
        app.client
            .request(method, app.url(path))
            .header("x-csrf-token", &csrf)
            .json(&body)
            .send()
    };
    let res = send(
        reqwest::Method::PUT,
        "/api/qa/results",
        json!({ "case_id": "x:sign-in", "result": "pass" }),
    )
    .await
    .expect("record");
    assert_eq!(res.status(), 409, "no cycle open");

    let cycle: Value = send(
        reqwest::Method::POST,
        "/api/qa/cycles",
        json!({ "name": "Round 1" }),
    )
    .await
    .expect("open")
    .json()
    .await
    .expect("json");
    let id = cycle["id"].as_str().expect("id").to_owned();
    let res = send(
        reqwest::Method::POST,
        "/api/qa/cycles",
        json!({ "name": "Round 2" }),
    )
    .await
    .expect("open");
    assert_eq!(res.status(), 409, "one open cycle at a time");

    let res = send(
        reqwest::Method::PUT,
        "/api/qa/results",
        json!({ "case_id": "x:see:/opd", "result": "fail" }),
    )
    .await
    .expect("record");
    assert_eq!(res.status(), 400, "a fail says why");
    for (result, note) in [("fail", "Queue showed an error"), ("pass", "")] {
        let res = send(
            reqwest::Method::PUT,
            "/api/qa/results",
            json!({ "case_id": "x:see:/opd", "result": result, "note": note, "tester_name": "Asha" }),
        )
        .await
        .expect("record");
        assert!(res.status().is_success(), "{}", res.status());
    }
    let listed: Vec<Value> = app
        .client
        .get(app.url(&format!("/api/qa/results?cycle_id={id}")))
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("json");
    let mine: Vec<&Value> = listed
        .iter()
        .filter(|r| r["case_id"] == "x:see:/opd")
        .collect();
    assert_eq!(mine.len(), 1, "answering again replaces the answer");
    assert_eq!(mine[0]["result"], "pass");
    assert_eq!(mine[0]["tester_name"], "Asha");

    let res = send(
        reqwest::Method::PUT,
        &format!("/api/qa/cycles/{id}/close"),
        json!({}),
    )
    .await
    .expect("close");
    assert!(res.status().is_success());
    let res = send(
        reqwest::Method::PUT,
        "/api/qa/results",
        json!({ "case_id": "x:sign-in", "result": "pass" }),
    )
    .await
    .expect("record");
    assert_eq!(res.status(), 409, "a closed cycle takes no more results");
}

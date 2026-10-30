//! MedBrains Flow (#4901): who may see it, that it is a licensed add-on,
//! that it never carries a patient's identity, and that every read is bounded.

use crate::flow_world;

use reqwest::StatusCode;
use serde_json::{Value, json};

use flow_world::{SERIAL, set_module, world};

/// Given the add-on switched off, When even a hospital admin opens Flow, Then
/// it is refused: a licence is not a permission and bypass roles do not
/// bypass it. Switched back on, it answers.
#[tokio::test]
async fn flow_is_refused_while_the_add_on_is_off() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    set_module(&w.app, &w.csrf, "disabled").await;
    let floors = format!("/api/flow/floors/{}/live", w.floor);
    let (off, _) = w.get_as(&w.app.client, &floors).await;
    let (board, _) = w
        .get_as(
            &w.app.client,
            &format!("/api/flow/board?floor_id={}", w.floor),
        )
        .await;
    set_module(&w.app, &w.csrf, "enabled").await;
    assert_eq!(off, StatusCode::FORBIDDEN);
    assert_eq!(board, StatusCode::FORBIDDEN);
    let (on, body) = w.get_as(&w.app.client, &floors).await;
    assert_eq!(on, StatusCode::OK, "{body}");
}

/// Given a nurse (no Flow permission), Then every Flow read and write is 403.
/// Given the front-office desk, Then it sees the map and acts on advice but
/// cannot change a zone's limits, which belong to facilities.
#[tokio::test]
async fn flow_screens_answer_only_the_roles_that_hold_them() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let nurse = w.staff("nurse").await;
    let desk = w.staff("front_office_staff").await;
    let facilities = w.staff("facilities_manager").await;
    let live = format!("/api/flow/floors/{}/live", w.floor);
    for path in [
        "/api/flow/floors".to_owned(),
        live.clone(),
        format!("/api/flow/floors/{}/history", w.floor),
        format!("/api/flow/floors/{}/forecast", w.floor),
        format!("/api/flow/zones/{}", w.billing_zone),
        "/api/flow/config/floors".to_owned(),
    ] {
        assert_eq!(
            w.get_as(&nurse.client, &path).await.0,
            StatusCode::FORBIDDEN,
            "nurse {path}"
        );
    }
    assert_eq!(w.get_as(&desk.client, &live).await.0, StatusCode::OK);
    assert_eq!(
        w.get_as(
            &desk.client,
            &format!("/api/flow/floors/{}/history", w.floor)
        )
        .await
        .0,
        StatusCode::OK
    );
    assert_eq!(
        w.get_as(&desk.client, "/api/flow/config/floors").await.0,
        StatusCode::FORBIDDEN
    );

    let limits = json!({ "capacity": 50, "comfort_limit": 30, "attendant_factor": 1.8,
                         "goal_wait_minutes": 15, "grid_row": 1, "grid_col": 1 });
    let path = w
        .app
        .url(&format!("/api/flow/config/zones/{}", w.billing_zone));
    let put = |client: &reqwest::Client, csrf: &str| {
        client
            .put(&path)
            .header("x-csrf-token", csrf)
            .json(&limits)
            .send()
    };
    assert_eq!(
        put(&desk.client, &desk.csrf).await.expect("put").status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        put(&nurse.client, &nurse.csrf).await.expect("put").status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        put(&facilities.client, &facilities.csrf)
            .await
            .expect("put")
            .status(),
        StatusCode::OK
    );

    let decide = w.app.url(&format!(
        "/api/flow/recommendations/{}/decide",
        uuid::Uuid::new_v4()
    ));
    let refused = nurse
        .client
        .post(&decide)
        .header("x-csrf-token", &nurse.csrf)
        .json(&json!({ "decision": "accepted" }))
        .send()
        .await
        .expect("decide");
    assert_eq!(refused.status(), StatusCode::FORBIDDEN);
}

/// Given named patients holding billing tokens, When the map, the drawer, the
/// wall board and the history are read, Then no name, token number or patient
/// id is in any of them — counts and counter labels only.
#[tokio::test]
async fn no_flow_response_carries_a_patient() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let name = format!("Zebulon Flowcheck{}", w.tag);
    w.issue_tokens(w.billing, "billing", 3, &name).await;
    w.checked_in(w.opd, 1).await;
    w.tick().await;
    let (numbers, patients): (Vec<String>, Vec<Option<uuid::Uuid>>) =
        sqlx::query_as::<_, (String, Option<uuid::Uuid>)>(
            "SELECT number, patient_id FROM tokens WHERE scope_id = $1",
        )
        .bind(w.billing)
        .fetch_all(&w.app.db)
        .await
        .expect("tokens")
        .into_iter()
        .unzip();
    let appointment_patients: Vec<uuid::Uuid> =
        sqlx::query_scalar("SELECT patient_id FROM appointments WHERE department_id = $1")
            .bind(w.opd)
            .fetch_all(&w.app.db)
            .await
            .expect("appointments");
    for path in [
        format!("/api/flow/floors/{}/live", w.floor),
        format!("/api/flow/zones/{}", w.billing_zone),
        format!("/api/flow/zones/{}", w.opd_zone),
        format!("/api/flow/board?floor_id={}", w.floor),
        format!("/api/flow/floors/{}/history", w.floor),
        format!("/api/flow/floors/{}/forecast", w.floor),
    ] {
        let (status, body) = w.get_as(&w.app.client, &path).await;
        assert_eq!(status, StatusCode::OK, "{path}: {body}");
        assert!(!body.contains("Zebulon"), "{path} carries a patient name");
        for number in &numbers {
            assert!(
                !body.contains(&format!("\"{number}\"")),
                "{path} carries token {number}"
            );
        }
        for id in patients.iter().flatten().chain(&appointment_patients) {
            assert!(
                !body.contains(&id.to_string()),
                "{path} carries a patient id"
            );
        }
    }
}

/// Every read has a ceiling: the forecast never plays more than 8 hours, a
/// snooze never runs past 4 hours, and the history is today in 15-minute steps.
#[tokio::test]
async fn flow_reads_are_bounded() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    w.issue_tokens(w.billing, "billing", 8, "Flow Patient")
        .await;
    w.tick().await;

    let (_, body) = w
        .get_as(
            &w.app.client,
            &format!("/api/flow/floors/{}/forecast?hours=500", w.floor),
        )
        .await;
    let forecast: Value = serde_json::from_str(&body).expect("forecast");
    assert_eq!(forecast["hours"], 8);
    assert_eq!(forecast["points"].as_array().map(Vec::len), Some(2 * 8 * 4));
    assert!(
        forecast["basis"]
            .as_str()
            .is_some_and(|b| b.starts_with("Estimate"))
    );

    let (_, body) = w
        .get_as(
            &w.app.client,
            &format!("/api/flow/floors/{}/history", w.floor),
        )
        .await;
    let history: Value = serde_json::from_str(&body).expect("history");
    assert!(
        history
            .as_array()
            .is_some_and(|h| !h.is_empty() && h.len() <= 2 * 96)
    );

    let id: uuid::Uuid = sqlx::query_scalar(
        "SELECT id FROM flow_recommendations WHERE location_id = $1 AND decision IS NULL",
    )
    .bind(w.billing_zone)
    .fetch_one(&w.app.db)
    .await
    .expect("recommendation");
    let resp = w
        .app
        .client
        .post(w.app.url(&format!("/api/flow/recommendations/{id}/decide")))
        .header("x-csrf-token", &w.csrf)
        .json(&json!({ "decision": "snoozed", "snooze_minutes": 100_000 }))
        .send()
        .await
        .expect("snooze");
    assert_eq!(resp.status(), StatusCode::OK);
    let minutes: f64 = sqlx::query_scalar(
        "SELECT EXTRACT(EPOCH FROM snoozed_until - decided_at)::float8 / 60 FROM flow_recommendations WHERE id = $1",
    )
    .bind(id)
    .fetch_one(&w.app.db)
    .await
    .expect("snooze");
    assert!((minutes - 240.0).abs() < 1.0, "snoozed {minutes} min");
}

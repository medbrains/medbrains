//! MedBrains Flow, Phase 0 (#4901): the crowd and wait view built from the
//! hospital's own records. These walk the aggregator over real sources and
//! read the result back through the screens' API.

use crate::flow_world;

use reqwest::StatusCode;
use serde_json::{Value, json};

use flow_world::{SERIAL, World, world};

/// Given 3 billing tokens, 2 staff on the billing roster, 2 checked-in OPD
/// patients, a visitor in an OPD room and 1 OPD nurse on duty, When the
/// aggregator runs, Then billing reads 3 waiting and 3 x 1.8 + 2 = 7 people,
/// and OPD reads 2 x 2.0 + 1 + 1 = 6, each labelled from its own sources.
#[tokio::test]
async fn each_source_is_counted_in_the_zone_it_is_mapped_to() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    w.issue_tokens(w.billing, "billing", 3, "Flow Patient")
        .await;
    w.rostered(w.billing, 2).await;
    w.checked_in(w.opd, 2).await;
    w.visitor_inside(w.opd_room).await;
    w.rostered(w.opd, 1).await;

    let summary = w.tick().await;
    assert!(summary.zones >= 2, "{summary:?}");
    let live = w.live().await;
    let billing = World::zone(&live, w.billing_zone);
    assert_eq!(billing["waiting"], 3);
    assert_eq!(billing["staff"], 2);
    assert_eq!(billing["people_est"], 7);
    // No token called yet: 3 waiting x the default 3 min, one counter.
    assert_eq!(billing["wait_minutes"], 9.0);
    let opd = World::zone(&live, w.opd_zone);
    assert_eq!(opd["checked_in"], 2);
    assert_eq!(opd["visitors"], 1);
    assert_eq!(opd["staff"], 1);
    assert_eq!(opd["people_est"], 6);
    assert_eq!(opd["unknown_sources"], json!([]));
    assert_eq!(live["stale"], false);

    // One row per zone for the minute, and nothing written anywhere clinical.
    let rows: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM flow_zone_minute WHERE tenant_id = $1 AND location_id = ANY($2) \
          AND minute >= now() - interval '2 minutes'",
    )
    .bind(w.tenant)
    .bind(vec![w.billing_zone, w.opd_zone])
    .fetch_one(&w.app.db)
    .await
    .expect("rows");
    assert_eq!(rows, 2, "one row per zone for the one pass");
}

/// Given the visitor log locked by another session, When the aggregator runs,
/// Then visitors read unknown — and so does every total that needs them —
/// rather than 0, and the screen is told which source failed.
#[tokio::test]
async fn a_source_that_cannot_be_read_is_unknown_never_zero() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    w.issue_tokens(w.billing, "billing", 2, "Flow Patient")
        .await;
    w.visitor_inside(w.opd_room).await;

    let mut blocker = w.app.db.begin().await.expect("blocker");
    sqlx::query("LOCK TABLE visitor_logs IN ACCESS EXCLUSIVE MODE")
        .execute(&mut *blocker)
        .await
        .expect("lock");
    w.tick().await;
    blocker.rollback().await.expect("release");

    let live = w.live().await;
    let opd = World::zone(&live, w.opd_zone);
    assert_eq!(
        opd["visitors"],
        Value::Null,
        "an outage is not an empty ward"
    );
    assert_eq!(opd["people_est"], Value::Null);
    assert_eq!(opd["unknown_sources"], json!(["visitors"]));
    // The sources that did answer still do.
    assert_eq!(World::zone(&live, w.billing_zone)["waiting"], 2);

    // And the drawer says so in words.
    let (status, body) = w
        .get_as(&w.app.client, &format!("/api/flow/zones/{}", w.opd_zone))
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let detail: Value = serde_json::from_str(&body).expect("detail");
    assert!(
        detail["reasons"][0]
            .as_str()
            .is_some_and(|r| r.contains("Could not read visitors"))
    );
}

/// Given billing over its comfort limit and its wait past the 15-minute goal,
/// When the aggregator runs twice, Then one alert is raised and the front-office
/// supervisor is told once; one "open another counter: 24 -> 12 min"
/// recommendation appears; When the supervisor accepts it, Then that is
/// recorded against them, a second decision is refused, and the next pass does
/// not raise the same advice again while it is given time to work.
#[tokio::test]
async fn a_pile_up_raises_one_alert_and_one_recommendation_that_a_supervisor_accepts() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let desk = w.staff("front_office_staff").await;
    w.issue_tokens(w.billing, "billing", 8, "Flow Patient")
        .await;
    w.rostered(w.billing, 2).await;
    w.tick().await;
    w.tick().await;

    let alerts: Vec<(String, i32)> = sqlx::query_as(
        "SELECT level, people_est FROM flow_alerts \
          WHERE location_id = $1 AND resolved_at IS NULL AND deleted_at IS NULL",
    )
    .bind(w.billing_zone)
    .fetch_all(&w.app.db)
    .await
    .expect("alerts");
    // 8 x 1.8 = 14.4 -> 14, + 2 staff = 16 > comfort 10 (capacity 40).
    assert_eq!(alerts, vec![("comfort".to_owned(), 16)]);
    let told: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND entity_id = $2 \
          AND entity_type = 'flow_zone' AND kind = 'warning'",
    )
    .bind(desk.user_id)
    .bind(w.billing_zone)
    .fetch_one(&w.app.db)
    .await
    .expect("notifications");
    assert_eq!(told, 1, "told once, not once a minute");

    let live = w.live().await;
    let rec = live["recommendations"]
        .as_array()
        .and_then(|r| r.iter().find(|r| r["location_id"] == json!(w.billing_zone)))
        .cloned()
        .expect("a recommendation for billing");
    assert_eq!(rec["action"], "open_counter");
    assert_eq!(rec["counters_open"], 1);
    assert_eq!(rec["counters_suggested"], 2);
    assert_eq!(rec["wait_before_minutes"], 24.0);
    assert_eq!(rec["wait_after_minutes"], 12.0);

    let id = rec["id"].as_str().expect("id");
    let decide = |client: reqwest::Client, csrf: String| {
        let url = w.app.url(&format!("/api/flow/recommendations/{id}/decide"));
        async move {
            client
                .post(url)
                .header("x-csrf-token", csrf)
                .json(&json!({ "decision": "accepted" }))
                .send()
                .await
                .expect("decide")
                .status()
        }
    };
    assert_eq!(
        decide(desk.client.clone(), desk.csrf.clone()).await,
        StatusCode::OK
    );
    let decided_by: Option<uuid::Uuid> =
        sqlx::query_scalar("SELECT decided_by FROM flow_recommendations WHERE id = $1::uuid")
            .bind(id)
            .fetch_one(&w.app.db)
            .await
            .expect("row");
    assert_eq!(decided_by, Some(desk.user_id));
    assert_eq!(
        decide(desk.client.clone(), desk.csrf.clone()).await,
        StatusCode::CONFLICT
    );

    w.tick().await;
    let open: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM flow_recommendations WHERE location_id = $1 \
          AND decision IS NULL AND expired_at IS NULL",
    )
    .bind(w.billing_zone)
    .fetch_one(&w.app.db)
    .await
    .expect("open");
    assert_eq!(open, 0, "accepted advice is given time to work");
}

/// Given the queue clears below 90% of the limit, When the aggregator runs,
/// Then the alert resolves and the recommendation expires.
#[tokio::test]
async fn an_alert_clears_and_advice_expires_when_the_crowd_goes() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    w.issue_tokens(w.billing, "billing", 8, "Flow Patient")
        .await;
    w.tick().await;
    sqlx::query("UPDATE tokens SET status = 'completed', completed_at = now() WHERE scope_id = $1")
        .bind(w.billing)
        .execute(&w.app.db)
        .await
        .expect("served");
    w.tick().await;
    let (open_alerts, open_recs): (i64, i64) = sqlx::query_as(
        "SELECT (SELECT COUNT(*) FROM flow_alerts WHERE location_id = $1 AND resolved_at IS NULL), \
                (SELECT COUNT(*) FROM flow_recommendations WHERE location_id = $1 \
                  AND decision IS NULL AND expired_at IS NULL)",
    )
    .bind(w.billing_zone)
    .fetch_one(&w.app.db)
    .await
    .expect("counts");
    assert_eq!((open_alerts, open_recs), (0, 0));
}

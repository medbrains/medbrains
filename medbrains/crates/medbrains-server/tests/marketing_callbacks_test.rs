mod common;

use uuid::Uuid;

/// A missed call books a callback, and the callback can now be opened.
///
/// `mkt_tasks` was write-only: `ingest_call` inserted a row whenever somebody
/// rang and nobody picked up, and every other statement touching the table was
/// a `count(*)`. There was even an index built for the worklist query —
/// `(tenant_id, status, due_at) WHERE status = 'open'` — and no query using
/// it. The hospital could see how many callbacks it owed and not one of them.
#[tokio::test]
async fn the_desk_can_open_the_calls_it_owes() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let phone = format!("89{}", &Uuid::new_v4().as_u128().to_string()[..8]);
    let contact_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_contacts (tenant_id, primary_phone, display_name, source) \
         VALUES ($1, $2, 'Callback Fixture', 'test') RETURNING id",
    )
    .bind(tenant_id)
    .bind(&phone)
    .fetch_one(&app.db)
    .await
    .expect("insert contact");

    // Owed for two hours — what a missed call at lunchtime looks like by mid
    // afternoon.
    sqlx::query(
        "INSERT INTO mkt_tasks (tenant_id, contact_id, due_at, kind, note) \
         VALUES ($1, $2, now() - interval '2 hours', 'callback', 'Missed call')",
    )
    .bind(tenant_id)
    .bind(contact_id)
    .execute(&app.db)
    .await
    .expect("insert callback");

    let rows: Vec<serde_json::Value> = app
        .client
        .get(app.url("/api/marketing/callbacks"))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("list callbacks")
        .json()
        .await
        .expect("callbacks json");

    let row = rows
        .iter()
        .find(|r| r["contact_id"].as_str() == Some(&contact_id.to_string()))
        .expect("the callback must appear in the worklist");

    assert_eq!(row["display_name"].as_str(), Some("Callback Fixture"));
    assert_eq!(
        row["primary_phone"].as_str(),
        Some(phone.as_str()),
        "the number must come back with the row — a worklist that needs a \
         second fetch to dial is not a worklist"
    );
    let overdue = row["overdue_seconds"].as_i64().expect("overdue_seconds");
    assert!(
        (7000..8000).contains(&overdue),
        "two hours owed should read as ~7200 seconds, got {overdue}"
    );
}

/// Closing a callback records that the call happened.
///
/// Marking the task done without writing the interaction would leave the
/// desk's own history saying nobody ever rang — the number would move and the
/// timeline would not.
#[tokio::test]
async fn completing_a_callback_writes_the_call_onto_the_timeline() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let contact_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_contacts (tenant_id, primary_phone, source) \
         VALUES ($1, $2, 'test') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("88{}", &Uuid::new_v4().as_u128().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("insert contact");

    let task_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_tasks (tenant_id, contact_id, due_at, kind) \
         VALUES ($1, $2, now() - interval '10 minutes', 'callback') RETURNING id",
    )
    .bind(tenant_id)
    .bind(contact_id)
    .fetch_one(&app.db)
    .await
    .expect("insert callback");

    let res = app
        .client
        .post(app.url(&format!("/api/marketing/callbacks/{task_id}/complete")))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({ "note": "Booked for Tuesday" }))
        .send()
        .await
        .expect("complete callback");
    assert!(res.status().is_success(), "complete rejected: {:?}", res.status());

    let logged: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_interactions \
         WHERE contact_id = $1 AND tenant_id = $2 AND disposition = 'callback_done'",
    )
    .bind(contact_id)
    .bind(tenant_id)
    .fetch_one(&app.db)
    .await
    .expect("count interactions");
    assert_eq!(logged, 1, "closing a callback must record the call it represents");

    let contacted: Option<chrono::DateTime<chrono::Utc>> =
        sqlx::query_scalar("SELECT last_contacted_at FROM mkt_contacts WHERE id = $1")
            .bind(contact_id)
            .fetch_one(&app.db)
            .await
            .expect("read last_contacted_at");
    assert!(
        contacted.is_some(),
        "the enquiry must count as contacted — the funnel's contacted rate \
         reads this column"
    );

    // Second close, by the colleague who was working the same list.
    let again = app
        .client
        .post(app.url(&format!("/api/marketing/callbacks/{task_id}/complete")))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({}))
        .send()
        .await
        .expect("second complete");
    assert_eq!(
        again.status().as_u16(),
        409,
        "two agents closing the same callback must be told why, not silently \
         succeed and log the call twice"
    );
}

/// Rescheduling moves the obligation rather than discharging it.
///
/// An agent who cannot reach somebody today should not have to choose between
/// a false "done" and leaving the row permanently overdue.
#[tokio::test]
async fn rescheduling_keeps_the_call_owed() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let contact_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_contacts (tenant_id, primary_phone, source) \
         VALUES ($1, $2, 'test') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("87{}", &Uuid::new_v4().as_u128().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("insert contact");

    let task_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_tasks (tenant_id, contact_id, due_at, kind) \
         VALUES ($1, $2, now() - interval '1 hour', 'callback') RETURNING id",
    )
    .bind(tenant_id)
    .bind(contact_id)
    .fetch_one(&app.db)
    .await
    .expect("insert callback");

    let later = chrono::Utc::now() + chrono::Duration::hours(3);
    let res = app
        .client
        .post(app.url(&format!("/api/marketing/callbacks/{task_id}/reschedule")))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({ "due_at": later, "note": "Asked to ring after six" }))
        .send()
        .await
        .expect("reschedule");
    assert!(res.status().is_success(), "reschedule rejected: {:?}", res.status());

    let status: String = sqlx::query_scalar("SELECT status FROM mkt_tasks WHERE id = $1")
        .bind(task_id)
        .fetch_one(&app.db)
        .await
        .expect("read status");
    assert_eq!(status, "open", "the call is still owed, just not yet");

    // A time already past would put the row straight back at the top of the
    // list, which is a snooze that does nothing.
    let backwards = app
        .client
        .post(app.url(&format!("/api/marketing/callbacks/{task_id}/reschedule")))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({ "due_at": chrono::Utc::now() - chrono::Duration::hours(1) }))
        .send()
        .await
        .expect("backwards reschedule");
    assert_eq!(backwards.status().as_u16(), 400);
}

mod common;

use uuid::Uuid;

/// Moving an enquiry records where it came FROM, not only where it went.
///
/// Before migration 0995 a stage change was one `mkt_interactions` row
/// carrying the destination code in `disposition` — a column shared with call
/// outcomes. That answers "where is this enquiry now", which
/// `mkt_contacts.stage_id` already answered. It cannot answer "how long did
/// it sit in 'booked'", because nothing recorded the stage it left.
///
/// This test asserts the transition is durable and complete: two moves
/// produce two events, the second one's `from_stage_id` is the first one's
/// destination, and the chain is therefore walkable without guessing.
#[tokio::test]
async fn a_stage_move_records_the_stage_it_left() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let stages: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM mkt_pipeline_stages WHERE tenant_id = $1 \
         ORDER BY position LIMIT 3",
    )
    .bind(tenant_id)
    .fetch_all(&app.db)
    .await
    .expect("seeded pipeline stages");
    assert!(
        stages.len() >= 3,
        "the seed must provide at least three stages to move between"
    );

    let phone = format!("94{}", &Uuid::new_v4().as_u128().to_string()[..8]);
    let contact: serde_json::Value = app
        .client
        .post(app.url("/api/marketing/contacts"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "display_name": "Funnel Fixture",
            "phone": phone,
            "source": "test",
        }))
        .send()
        .await
        .expect("create contact")
        .json()
        .await
        .expect("contact json");
    let contact_id = contact["id"].as_str().expect("contact id");

    for stage in stages.iter().take(2) {
        let res = app
            .client
            .post(app.url(&format!("/api/marketing/contacts/{contact_id}/stage")))
            .header("x-csrf-token", &csrf)
            .json(&serde_json::json!({ "stage_id": stage }))
            .send()
            .await
            .expect("move stage");
        assert!(res.status().is_success(), "move rejected: {:?}", res.status());
    }

    let events: Vec<(Option<Uuid>, Uuid)> = sqlx::query_as(
        "SELECT from_stage_id, to_stage_id FROM mkt_stage_events \
         WHERE contact_id = $1::uuid AND tenant_id = $2 ORDER BY occurred_at, id",
    )
    .bind(contact_id)
    .bind(tenant_id)
    .fetch_all(&app.db)
    .await
    .expect("read stage events");

    assert_eq!(events.len(), 2, "two moves must leave two events");
    assert_eq!(events[0].0, None, "the first move is entry and has no origin");
    assert_eq!(events[0].1, stages[0]);
    assert_eq!(
        events[1].0,
        Some(stages[0]),
        "the second move must name the stage it left — this is the half the \
         old interaction row was missing"
    );
    assert_eq!(events[1].1, stages[1]);
}

/// An enquiry still sitting in a stage must not count toward that stage's
/// median dwell time.
///
/// It has no dwell time yet, only a dwell-time-so-far, and counting it as
/// though it were finished biases the median downward — the longer something
/// sits unresolved, the more it understates. Right-censored observations are
/// excluded, which is the choice a survival analysis makes for the same
/// reason.
///
/// The scenario is built so the two answers are far apart and neither is a
/// rounding artefact: three enquiries leave after 2, 4 and 30 hours, and a
/// fourth has been sitting for 48. The median of the closed spans is 4h. If
/// the open one were included as though it had finished, the median of
/// {2, 4, 30, 48} would be 17h — so a regression here is unmissable rather
/// than a slightly different number.
#[tokio::test]
async fn an_enquiry_still_in_a_stage_is_excluded_from_its_median() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    // A pipeline of this test's own, so the assertion is not perturbed by
    // seed data or by another test's fixtures sharing the seeded stages.
    let pipeline_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_pipelines (tenant_id, name) VALUES ($1, $2) RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("censoring-{}", &Uuid::new_v4().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("insert pipeline");

    let waiting = insert_stage(&app.db, tenant_id, pipeline_id, "waiting", 1).await;
    let done = insert_stage(&app.db, tenant_id, pipeline_id, "done", 2).await;

    // Four enquiries enter `waiting` 48 hours ago. Three leave at 2, 4 and
    // 30 hours; the fourth is still there.
    for (i, exit_hours) in [Some(2), Some(4), Some(30), None].into_iter().enumerate() {
        let phone = format!("93{}", &Uuid::new_v4().as_u128().to_string()[..8]);
        let contact_id: Uuid = sqlx::query_scalar(
            "INSERT INTO mkt_contacts (tenant_id, primary_phone, source, first_seen_at) \
             VALUES ($1, $2, 'test', now() - interval '48 hours') RETURNING id",
        )
        .bind(tenant_id)
        .bind(&phone)
        .fetch_one(&app.db)
        .await
        .unwrap_or_else(|e| panic!("insert contact {i}: {e}"));

        sqlx::query(
            "INSERT INTO mkt_stage_events \
                (tenant_id, contact_id, from_stage_id, to_stage_id, occurred_at, source) \
             VALUES ($1, $2, NULL, $3, now() - interval '48 hours', 'system')",
        )
        .bind(tenant_id)
        .bind(contact_id)
        .bind(waiting)
        .execute(&app.db)
        .await
        .expect("insert entry event");

        if let Some(h) = exit_hours {
            sqlx::query(
                "INSERT INTO mkt_stage_events \
                    (tenant_id, contact_id, from_stage_id, to_stage_id, occurred_at, source) \
                 VALUES ($1, $2, $3, $4, \
                         now() - interval '48 hours' + make_interval(hours => $5), 'agent')",
            )
            .bind(tenant_id)
            .bind(contact_id)
            .bind(waiting)
            .bind(done)
            .bind(h)
            .execute(&app.db)
            .await
            .expect("insert exit event");
        }
    }

    let report: Vec<serde_json::Value> = app
        .client
        .get(app.url("/api/marketing/reports/funnel"))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("funnel report")
        .json()
        .await
        .expect("funnel json");

    let row = report
        .iter()
        .find(|r| r["stage_id"].as_str() == Some(&waiting.to_string()))
        .expect("the waiting stage must appear in the report");

    assert_eq!(row["entered"].as_i64(), Some(4));
    assert_eq!(row["exited"].as_i64(), Some(3));
    assert_eq!(
        row["currently_in"].as_i64(),
        Some(1),
        "the open enquiry is counted, just not measured"
    );

    let median_hours = row["median_seconds"]
        .as_f64()
        .expect("three closed spans must produce a median")
        / 3600.0;
    assert!(
        (median_hours - 4.0).abs() < 0.01,
        "median of the closed spans {{2, 4, 30}} is 4h, got {median_hours:.2}h — \
         17h means the open 48h enquiry was counted as finished"
    );
}

/// A second campaign for the same enquiry is recorded, not discarded.
///
/// `create_contact` fills `campaign_id` with `COALESCE(campaign_id, $5)`,
/// which makes it write-once: whichever campaign was first through the door
/// keeps the credit forever. A person hears about the hospital at a camp,
/// sees a hoarding, and is finally sent by their GP — and the camp was
/// getting all three.
#[tokio::test]
async fn a_second_campaign_touch_is_appended_not_dropped() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let camp = insert_campaign(&app.db, tenant_id, "camp").await;
    let hoarding = insert_campaign(&app.db, tenant_id, "hoarding").await;

    let phone = format!("92{}", &Uuid::new_v4().as_u128().to_string()[..8]);
    let contact: serde_json::Value = app
        .client
        .post(app.url("/api/marketing/contacts"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "display_name": "Attribution Fixture",
            "phone": phone,
            "source": "test",
            "campaign_id": camp,
        }))
        .send()
        .await
        .expect("create contact")
        .json()
        .await
        .expect("contact json");
    let contact_id = contact["id"].as_str().expect("contact id");

    let res = app
        .client
        .post(app.url(&format!("/api/marketing/contacts/{contact_id}/touchpoints")))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "campaign_id": hoarding,
            "kind": "walk_in",
            "source": "test",
        }))
        .send()
        .await
        .expect("add touchpoint");
    assert!(res.status().is_success(), "touchpoint rejected: {:?}", res.status());

    let touched: Vec<Uuid> = sqlx::query_scalar(
        "SELECT campaign_id FROM mkt_touchpoints \
         WHERE contact_id = $1::uuid AND tenant_id = $2 ORDER BY occurred_at, id",
    )
    .bind(contact_id)
    .bind(tenant_id)
    .fetch_all(&app.db)
    .await
    .expect("read touchpoints");

    assert_eq!(
        touched,
        vec![camp, hoarding],
        "both campaigns must survive, in order — first touch is the camp, \
         last touch is the hoarding, and the single column could hold only one"
    );
}

// ── Fixtures ─────────────────────────────────────────────────────────────
// Plain functions rather than closures: a closure capturing `app.db` moves
// the pool on first call, and every one of these is needed twice.

async fn insert_stage(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    pipeline_id: Uuid,
    code: &str,
    position: i32,
) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO mkt_pipeline_stages \
            (tenant_id, pipeline_id, code, name, position) \
         VALUES ($1, $2, $3, $3, $4) RETURNING id",
    )
    .bind(tenant_id)
    .bind(pipeline_id)
    .bind(code)
    .bind(position)
    .fetch_one(db)
    .await
    .expect("insert stage")
}

async fn insert_campaign(db: &sqlx::PgPool, tenant_id: Uuid, prefix: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO mkt_campaigns (tenant_id, name, channel, source) \
         VALUES ($1, $2, 'other', 'test') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("{prefix}-{}", &Uuid::new_v4().to_string()[..8]))
    .fetch_one(db)
    .await
    .expect("insert campaign")
}

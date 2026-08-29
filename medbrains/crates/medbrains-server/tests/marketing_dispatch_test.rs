mod common;

use uuid::Uuid;

/// Build an approved run over a cohort of `n` contacts, `granted` of whom have
/// consented. Returns the run id and the contact ids.
async fn approved_run(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    n: usize,
    granted: usize,
) -> (Uuid, Vec<Uuid>) {
    let cohort_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_cohorts (tenant_id, name, criteria_kind, criteria) \
         VALUES ($1, $2, 'enquiry', '{}'::jsonb) RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("run-{}", &Uuid::new_v4().to_string()[..8]))
    .fetch_one(db)
    .await
    .expect("insert cohort");

    let mut contacts = Vec::new();
    for i in 0..n {
        let contact_id: Uuid = sqlx::query_scalar(
            "INSERT INTO mkt_contacts (tenant_id, primary_phone, source) \
             VALUES ($1, $2, 'test') RETURNING id",
        )
        .bind(tenant_id)
        .bind(format!("+919{}", &Uuid::new_v4().as_u128().to_string()[..9]))
        .fetch_one(db)
        .await
        .expect("insert contact");

        if i < granted {
            sqlx::query(
                "INSERT INTO mkt_consents \
                    (tenant_id, contact_id, channel, purpose, action, source) \
                 VALUES ($1, $2, 'sms', 'promotional', 'granted', 'front_desk')",
            )
            .bind(tenant_id)
            .bind(contact_id)
            .execute(db)
            .await
            .expect("grant consent");
        }

        sqlx::query(
            "INSERT INTO mkt_cohort_members (tenant_id, cohort_id, contact_id) \
             VALUES ($1, $2, $3)",
        )
        .bind(tenant_id)
        .bind(cohort_id)
        .bind(contact_id)
        .execute(db)
        .await
        .expect("add member");
        contacts.push(contact_id);
    }

    let run_id: Uuid = sqlx::query_scalar(
        "INSERT INTO mkt_outreach_runs \
            (tenant_id, cohort_id, channel, status, traffic_class, purpose) \
         VALUES ($1, $2, 'sms', 'approved', 'promotional', 'promotional') \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(cohort_id)
    .fetch_one(db)
    .await
    .expect("insert run");

    (run_id, contacts)
}

/// Every recipient gets a ledger row, including the ones that were excluded.
///
/// An exclusion that exists only as a smaller number is not auditable — "why
/// didn't my mother get the reminder" would have no answer. And silence is not
/// consent, so the four who were never asked are blocked with a stated reason
/// rather than quietly dropped.
#[tokio::test]
async fn a_run_records_who_it_reached_and_why_it_skipped_the_rest() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    // Six recipients, two of whom have consented.
    let (run_id, _) = approved_run(&app.db, tenant_id, 6, 2).await;

    let body: serde_json::Value = app
        .client
        .post(app.url(&format!("/api/marketing/outreach/{run_id}/start")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("start run")
        .json()
        .await
        .expect("start json");

    assert_eq!(body["queued"].as_u64(), Some(2), "only the consenting two");
    assert_eq!(body["blocked"].as_u64(), Some(4), "the rest are recorded, not dropped");
    assert_eq!(
        body["blocked_by_reason"]["no_consent"].as_u64(),
        Some(4),
        "and the reason is stated — silence is not consent under DPDP"
    );

    let rows: Vec<(String, Option<String>)> = sqlx::query_as(
        "SELECT status, blocked_reason FROM mkt_messages \
         WHERE run_id = $1 AND tenant_id = $2",
    )
    .bind(run_id)
    .bind(tenant_id)
    .fetch_all(&app.db)
    .await
    .expect("read ledger");
    assert_eq!(rows.len(), 6, "a row per recipient, sent and blocked alike");

    // The run moves off 'approved' so a second click cannot re-fire it.
    let status: String = sqlx::query_scalar("SELECT status FROM mkt_outreach_runs WHERE id = $1")
        .bind(run_id)
        .fetch_one(&app.db)
        .await
        .expect("read run status");
    assert_eq!(status, "sending");
}

/// The queued sends reach the existing outbox, one event each, keyed on the
/// ledger row.
///
/// The id is the idempotency key precisely so a retried worker cannot
/// double-send, and building a second delivery pipeline here would have been a
/// second set of retry bugs beside the first.
#[tokio::test]
async fn a_dispatched_run_queues_through_the_existing_outbox() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let (run_id, _) = approved_run(&app.db, tenant_id, 3, 3).await;

    let res = app
        .client
        .post(app.url(&format!("/api/marketing/outreach/{run_id}/start")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("start run");
    assert!(res.status().is_success(), "start rejected: {:?}", res.status());

    let queued: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM outbox_events o \
         JOIN mkt_messages m ON m.id::text = o.idempotency_key \
         WHERE m.run_id = $1 AND o.tenant_id = $2 \
           AND o.event_type = 'sms.marketing_outreach'",
    )
    .bind(run_id)
    .bind(tenant_id)
    .fetch_one(&app.db)
    .await
    .expect("count outbox events");

    assert_eq!(
        queued, 3,
        "one outbox event per sendable recipient, keyed on its ledger row"
    );
}

/// Starting twice does not send twice.
///
/// The second call is refused because the run has left 'approved' — and even
/// if it had not, the unique index on (run, contact) means no second ledger
/// row and therefore no second outbox event.
#[tokio::test]
async fn a_run_cannot_be_dispatched_twice() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let (run_id, _) = approved_run(&app.db, tenant_id, 2, 2).await;
    let start = || {
        app.client
            .post(app.url(&format!("/api/marketing/outreach/{run_id}/start")))
            .header("x-csrf-token", &csrf)
            .send()
    };

    assert!(start().await.expect("first start").status().is_success());
    assert_eq!(
        start().await.expect("second start").status().as_u16(),
        409,
        "a second dispatch must say why, not silently succeed having sent nothing"
    );

    let rows: i64 = sqlx::query_scalar("SELECT count(*) FROM mkt_messages WHERE run_id = $1")
        .bind(run_id)
        .fetch_one(&app.db)
        .await
        .expect("count ledger rows");
    assert_eq!(rows, 2, "and no duplicate recipient rows");
}

/// An empty cohort is refused rather than dispatched.
///
/// An empty cohort is almost always one that was never resolved. Dispatching
/// it would mark the run completed having reached nobody, which reads
/// afterwards as "the campaign failed" rather than "the list was empty".
#[tokio::test]
async fn an_empty_cohort_is_refused_rather_than_sent_to_nobody() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let (run_id, _) = approved_run(&app.db, tenant_id, 0, 0).await;

    let res = app
        .client
        .post(app.url(&format!("/api/marketing/outreach/{run_id}/start")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("start run");

    assert_eq!(res.status().as_u16(), 409);

    let status: String = sqlx::query_scalar("SELECT status FROM mkt_outreach_runs WHERE id = $1")
        .bind(run_id)
        .fetch_one(&app.db)
        .await
        .expect("read status");
    assert_eq!(status, "approved", "and the run stays dispatchable once fixed");
}

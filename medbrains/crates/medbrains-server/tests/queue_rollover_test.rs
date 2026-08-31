mod common;

use uuid::Uuid;

async fn seeded_tenant(db: &sqlx::PgPool) -> Uuid {
    sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(db)
        .await
        .expect("a seeded tenant")
}

async fn token(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    patient_id: Uuid,
    module: &str,
    status: &str,
    days_ago: i32,
) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO tokens \
         (tenant_id, module, scope, number, seq, status, priority, patient_id, token_date) \
         VALUES ($1, $2, 'global', $3, 1, $4, 'normal', $5, CURRENT_DATE - $6) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(module)
    .bind(format!("X-{}", &Uuid::new_v4().to_string()[..6]))
    .bind(status)
    .bind(patient_id)
    .bind(days_ago)
    .fetch_one(db)
    .await
    .expect("insert token")
}

async fn status_of(db: &sqlx::PgPool, id: Uuid) -> String {
    sqlx::query_scalar("SELECT status FROM tokens WHERE id = $1")
        .bind(id)
        .fetch_one(db)
        .await
        .expect("read status")
}

/// Yesterday closes; today does not.
///
/// Nothing ever ended a day, so `opd_queues` and `tokens` accumulated rows that
/// stayed `waiting` indefinitely -- 363 from a single date in the seeded
/// database. They were invisible rather than closed, because every read filters
/// on the current date.
#[tokio::test]
async fn the_rollover_closes_yesterday_and_leaves_today_alone() {
    let app = common::spawn_app().await;
    let tenant_id = seeded_tenant(&app.db).await;
    let patient_id = Uuid::new_v4();

    let yesterday = token(&app.db, tenant_id, patient_id, "opd", "waiting", 1).await;
    let today = token(&app.db, tenant_id, patient_id, "lab", "waiting", 0).await;

    medbrains_server::services::queue_rollover::run_rollover_pass(&app.db)
        .await
        .expect("rollover pass");

    assert_eq!(
        status_of(&app.db, yesterday).await,
        "expired",
        "a token left open on a day that has ended must be closed"
    );
    assert_eq!(
        status_of(&app.db, today).await,
        "waiting",
        "today's queue is still being worked and must never be closed under it"
    );
}

/// A completed token is left exactly as it was.
///
/// The pass must not rewrite history: `expired` means nobody was seen, and
/// stamping it over a finished consultation would destroy the only record that
/// the patient *was* served.
#[tokio::test]
async fn the_rollover_does_not_touch_finished_tokens() {
    let app = common::spawn_app().await;
    let tenant_id = seeded_tenant(&app.db).await;
    let patient_id = Uuid::new_v4();

    let done = token(&app.db, tenant_id, patient_id, "opd", "completed", 2).await;
    let missed = token(&app.db, tenant_id, patient_id, "lab", "no_show", 2).await;

    medbrains_server::services::queue_rollover::run_rollover_pass(&app.db)
        .await
        .expect("rollover pass");

    assert_eq!(status_of(&app.db, done).await, "completed");
    assert_eq!(
        status_of(&app.db, missed).await,
        "no_show",
        "no_show is a statistic about patients who were called and did not \
         come; the rollover must not absorb it"
    );
}

/// Running it twice changes nothing the second time.
///
/// It runs hourly against every tenant, so it has to be safe to repeat.
#[tokio::test]
async fn the_rollover_is_idempotent() {
    let app = common::spawn_app().await;
    let tenant_id = seeded_tenant(&app.db).await;
    let patient_id = Uuid::new_v4();

    let stale = token(&app.db, tenant_id, patient_id, "opd", "waiting", 3).await;

    for _ in 0..2 {
        medbrains_server::services::queue_rollover::run_rollover_pass(&app.db)
            .await
            .expect("rollover pass");
    }

    assert_eq!(status_of(&app.db, stale).await, "expired");
}

/// The vocabulary puts a carried-over patient where it says it does.
///
/// Ahead of today's fresh walk-ins, because the hospital owes them a slot.
/// Behind every clinical and vulnerability reason, and behind a VIP courtesy
/// it must outrank -- a courtesy should never beat a debt. And an unknown
/// priority still sorts last, so a value a newer server introduces cannot jump
/// the queue on an older one.
#[tokio::test]
async fn carried_over_sorts_between_vulnerability_and_vip() {
    let app = common::spawn_app().await;

    let weight = |p: &'static str| {
        let db = app.db.clone();
        async move {
            sqlx::query_scalar::<_, i32>("SELECT token_priority_weight($1)")
                .bind(p)
                .fetch_one(&db)
                .await
                .expect("weight")
        }
    };

    let stat = weight("stat").await;
    let urgent = weight("urgent").await;
    let pregnant = weight("pregnant").await;
    let carried = weight("carried_over").await;
    let vip = weight("vip").await;
    let normal = weight("normal").await;
    let unknown = weight("something_a_newer_build_invented").await;

    assert!(stat < urgent, "a clinical emergency outranks everything");
    assert!(
        pregnant < carried,
        "a vulnerability category outranks being owed a slot"
    );
    assert!(
        carried < vip,
        "a debt the hospital owes outranks a courtesy it extends"
    );
    assert!(
        carried < normal,
        "somebody sent home unseen yesterday is ahead of today's walk-ins"
    );
    assert!(
        unknown >= normal,
        "an unrecognised priority must sort last, never first"
    );
}

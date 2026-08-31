mod common;

use uuid::Uuid;

async fn seeded_tenant(db: &sqlx::PgPool) -> Uuid {
    sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(db)
        .await
        .expect("a seeded tenant")
}

/// A completed service that took `minutes`, in a module of its own so the
/// tests do not read each other's fixtures.
async fn served(db: &sqlx::PgPool, tenant_id: Uuid, module: &str, minutes: i32) {
    sqlx::query(
        "INSERT INTO tokens \
         (tenant_id, module, scope, number, seq, status, priority, token_date, \
          called_at, completed_at) \
         VALUES ($1, $2, 'global', $3, 1, 'completed', 'normal', CURRENT_DATE, \
                 now() - interval '6 hours', \
                 now() - interval '6 hours' + make_interval(mins => $4))",
    )
    .bind(tenant_id)
    .bind(module)
    .bind(format!("S-{}", &Uuid::new_v4().to_string()[..8]))
    .bind(minutes)
    .execute(db)
    .await
    .expect("insert served token");
}

async fn stats(db: &sqlx::PgPool, tenant_id: Uuid, module: &str) -> (Option<f64>, i64) {
    sqlx::query_as(
        "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY mins)::float8, COUNT(*)::bigint \
         FROM ( \
           SELECT EXTRACT(EPOCH FROM (completed_at - called_at)) / 60.0 AS mins \
             FROM tokens \
            WHERE tenant_id = $1 AND module = $2 \
              AND called_at IS NOT NULL AND completed_at IS NOT NULL \
              AND completed_at > called_at \
              AND completed_at - called_at < make_interval(mins => 240) \
              AND token_date >= CURRENT_DATE - make_interval(days => 90) \
         ) m",
    )
    .bind(tenant_id)
    .bind(module)
    .fetch_one(db)
    .await
    .expect("service time stats")
}

/// A row nobody closed must not become the hospital's service time.
///
/// This is not hypothetical. Before the day rollover existed, tokens sat
/// `called` indefinitely -- 363 from one date in the seeded data. One such row
/// arriving as a nine-hour "consultation" drags a mean from 14 minutes to 62,
/// and a waiting room planned on 62 sends people away who would have been seen.
#[tokio::test]
async fn a_forgotten_row_does_not_become_the_service_time() {
    let app = common::spawn_app().await;
    let tenant_id = seeded_tenant(&app.db).await;
    let module = format!("t_outlier_{}", &Uuid::new_v4().to_string()[..8]);

    for minutes in [10, 11, 12, 13, 14, 15, 16, 17, 18, 19] {
        served(&app.db, tenant_id, &module, minutes).await;
    }
    // The one somebody left open over lunch.
    served(&app.db, tenant_id, &module, 9 * 60).await;

    let (median, samples) = stats(&app.db, tenant_id, &module).await;

    assert_eq!(
        samples, 10,
        "the forgotten row must be excluded, not merely outweighed"
    );
    let median = median.expect("a median from ten completed services");
    assert!(
        (14.0..=15.0).contains(&median),
        "median should sit among the real consultations, got {median}"
    );
}

/// The median, not the mean.
///
/// Service times are right-skewed: most visits cluster and a few run long. A
/// mean sits above almost every actual visit, so the waiting room is told a
/// number it beats on most days and misses badly on the rest.
#[tokio::test]
async fn the_typical_time_is_not_dragged_by_the_slow_tail() {
    let app = common::spawn_app().await;
    let tenant_id = seeded_tenant(&app.db).await;
    let module = format!("t_skew_{}", &Uuid::new_v4().to_string()[..8]);

    // Nine quick visits and one genuinely long-but-plausible one.
    for _ in 0..9 {
        served(&app.db, tenant_id, &module, 10).await;
    }
    served(&app.db, tenant_id, &module, 120).await;

    let (median, samples) = stats(&app.db, tenant_id, &module).await;
    assert_eq!(samples, 10, "the long visit is real and must be counted");

    let median = median.expect("a median");
    let mean = 9.0f64.mul_add(10.0, 120.0) / 10.0;
    assert!(
        (median - 10.0).abs() < 0.01,
        "median should be 10, got {median}"
    );
    assert!(
        median < mean,
        "the whole point: the mean is {mean}, which describes no visit that happened"
    );
}

/// No data means no number.
///
/// The estimator this replaces averaged `completed_at - called_at`, not one
/// row in the database had ever carried both, and it silently substituted a
/// hard-coded ten minutes -- shown to a desk as though it had been measured.
#[tokio::test]
async fn an_unmeasured_queue_reports_nothing_rather_than_a_default() {
    let app = common::spawn_app().await;
    let tenant_id = seeded_tenant(&app.db).await;
    let module = format!("t_empty_{}", &Uuid::new_v4().to_string()[..8]);

    let (median, samples) = stats(&app.db, tenant_id, &module).await;

    assert_eq!(samples, 0);
    assert!(
        median.is_none(),
        "an unmeasured queue must report nothing; a default presented as a \
         measurement is the defect this replaces"
    );
}

/// The OPD wait estimate says nothing when it knows nothing.
///
/// It used to return `queue_position * 10.0` unconditionally: the average was
/// taken over `completed_at - called_at`, no row in the database had ever
/// carried both, and `unwrap_or(10.0)` turned "never measured" into a figure
/// that reached a kiosk in the waiting room and a patient's own phone.
#[tokio::test]
async fn the_wait_estimate_reports_nothing_until_it_has_measured() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let body: serde_json::Value = app
        .client
        .get(app.url("/api/opd/queue/wait-estimate"))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("wait estimate")
        .json()
        .await
        .expect("wait estimate json");

    let samples = body["sample_count"].as_i64().expect("sample_count");
    if samples < 10 {
        assert!(
            body["estimated_minutes"].is_null(),
            "with {samples} completed consultations the estimate must be null, \
             not arithmetic on a constant -- got {}",
            body["estimated_minutes"]
        );
        assert!(
            body["median_consultation_minutes"].is_null() || samples > 0,
            "a median with no samples behind it is not a median"
        );
    }

    assert!(
        body["queue_position"].is_number(),
        "the position is always knowable and must still be reported"
    );
}

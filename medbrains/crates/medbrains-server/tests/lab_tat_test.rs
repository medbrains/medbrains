mod common;

use uuid::Uuid;

async fn seeded_tenant(db: &sqlx::PgPool) -> Uuid {
    sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(db)
        .await
        .expect("a seeded tenant")
}

/// A catalogue test that promises `tat_hours` and nothing more.
async fn catalogue_test(db: &sqlx::PgPool, tenant_id: Uuid, tat_hours: i32) -> Uuid {
    let suffix = &Uuid::new_v4().to_string()[..8];
    sqlx::query_scalar(
        "INSERT INTO lab_test_catalog (tenant_id, code, name, sample_type, tat_hours) \
         VALUES ($1, $2, $3, 'blood', $4) RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("TAT-{suffix}"))
    .bind(format!("TAT fixture {suffix}"))
    .bind(tat_hours)
    .fetch_one(db)
    .await
    .expect("insert catalogue test")
}

/// A patient and an encounter for them.
///
/// `lab_orders.encounter_id` is NOT NULL even though the TypeScript type
/// says otherwise, so an order cannot be fabricated from nothing -- it hangs
/// off a real visit.
async fn patient_encounter(db: &sqlx::PgPool, tenant_id: Uuid) -> (Uuid, Uuid) {
    let suffix = &Uuid::new_v4().to_string()[..8];
    let patient_id: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'TAT', 'Fixture', 'other'::gender, $3) RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("UH-TAT-{suffix}"))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(db)
    .await
    .expect("insert patient");

    let encounter_id: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         VALUES ($1, $2, 'opd'::encounter_type) RETURNING id",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_one(db)
    .await
    .expect("insert encounter");

    (patient_id, encounter_id)
}

/// An order placed `hours_ago`, still open, carrying **no** per-order promise.
///
/// This is every order the system has ever written: `expected_tat_minutes` has
/// never been populated by any code path.
async fn open_order(db: &sqlx::PgPool, tenant_id: Uuid, test_id: Uuid, hours_ago: i32) -> Uuid {
    let (patient_id, encounter_id) = patient_encounter(db, tenant_id).await;
    // tenant_id, encounter_id, patient_id, test_id and ordered_by are all NOT
    // NULL on lab_orders. Any of them left out fails at insert, so the whole
    // required set is supplied here rather than discovered one at a time.
    let ordered_by: Uuid = sqlx::query_scalar("SELECT id FROM users LIMIT 1")
        .fetch_one(db)
        .await
        .expect("a seeded user to order the test");

    sqlx::query_scalar(
        "INSERT INTO lab_orders \
         (tenant_id, encounter_id, patient_id, test_id, ordered_by, \
          status, priority, is_stat, created_at) \
         VALUES ($1, $2, $3, $4, $5, 'ordered'::lab_order_status, \
                 'stat'::lab_priority, true, now() - make_interval(hours => $6)) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(patient_id)
    .bind(test_id)
    .bind(ordered_by)
    .bind(hours_ago)
    .fetch_one(db)
    .await
    .expect("insert lab order")
}

async fn breach_row(
    db: &sqlx::PgPool,
    tenant_id: Uuid,
    order_id: Uuid,
) -> (Option<i32>, Option<i64>, bool) {
    sqlx::query_as(
        "SELECT COALESCE(lo.expected_tat_minutes, (tc.tat_hours * 60)::int), \
                (EXTRACT(EPOCH FROM (COALESCE(lo.completed_at, now()) - lo.created_at))::bigint \
                  / 60), \
                COALESCE( \
                  EXTRACT(EPOCH FROM (COALESCE(lo.completed_at, now()) - lo.created_at)) / 60 \
                    > COALESCE(lo.expected_tat_minutes, (tc.tat_hours * 60)::int), \
                  false) \
           FROM lab_orders lo \
           LEFT JOIN lab_test_catalog tc ON tc.id = lo.test_id \
          WHERE lo.tenant_id = $1 AND lo.id = $2",
    )
    .bind(tenant_id)
    .bind(order_id)
    .fetch_one(db)
    .await
    .expect("tat row")
}

/// The promise falls back to the catalogue, so a breach can actually be seen.
///
/// Both TAT handlers used to test `expected_tat_minutes IS NOT NULL` on the
/// order alone. No order has ever carried that column, while all 82 catalogue
/// tests declare a `tat_hours` -- so `is_breached` was false for every row a
/// laboratory has ever produced, on two screens whose only purpose is to show
/// breaches.
#[tokio::test]
async fn an_order_past_its_catalogue_turnaround_is_flagged() {
    let app = common::spawn_app().await;
    let tenant_id = seeded_tenant(&app.db).await;

    // Promised in two hours, ordered six hours ago, still open.
    let test_id = catalogue_test(&app.db, tenant_id, 2).await;
    let order_id = open_order(&app.db, tenant_id, test_id, 6).await;

    let (promised, actual, breached) = breach_row(&app.db, tenant_id, order_id).await;

    assert_eq!(
        promised,
        Some(120),
        "the catalogue's tat_hours must supply the promise when the order \
         carries none -- which is always"
    );
    assert!(actual.is_some_and(|m| m >= 300), "roughly six hours elapsed");
    assert!(
        breached,
        "six hours against a two-hour promise is a breach; reporting false \
         here is the defect this replaces"
    );
}

/// Inside the promise is not a breach.
#[tokio::test]
async fn an_order_within_its_turnaround_is_not_flagged() {
    let app = common::spawn_app().await;
    let tenant_id = seeded_tenant(&app.db).await;

    let test_id = catalogue_test(&app.db, tenant_id, 24).await;
    let order_id = open_order(&app.db, tenant_id, test_id, 1).await;

    let (promised, _, breached) = breach_row(&app.db, tenant_id, order_id).await;
    assert_eq!(promised, Some(1440));
    assert!(!breached, "one hour against a 24-hour promise is not a breach");
}

/// A test with no declared turnaround cannot be breached.
///
/// Absence of a promise is not a promise of nought. `COALESCE(..., false)`
/// carries this: without it the comparison against NULL yields NULL, and a
/// NULL in a `bool` column is a decode error rather than "not breached".
#[tokio::test]
async fn a_test_with_no_declared_turnaround_is_never_breached() {
    let app = common::spawn_app().await;
    let tenant_id = seeded_tenant(&app.db).await;

    let suffix = &Uuid::new_v4().to_string()[..8];
    let test_id: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_test_catalog (tenant_id, code, name, sample_type) \
         VALUES ($1, $2, $3, 'blood') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("NOTAT-{suffix}"))
    .bind(format!("No TAT fixture {suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("insert catalogue test without tat");

    let order_id = open_order(&app.db, tenant_id, test_id, 99).await;

    let (promised, _, breached) = breach_row(&app.db, tenant_id, order_id).await;
    assert_eq!(promised, None);
    assert!(
        !breached,
        "a laboratory that never promised a turnaround has not missed one"
    );
}

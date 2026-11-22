//! The OPD queue against a fresh, migrated database: a waiting patient whose
//! token the desk moved up is first on the list, with the priority and the
//! reason the desk gave; everyone else keeps arrival order; and once that
//! patient is no longer waiting they go back to their arrival place.

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use chrono::NaiveDate;
use medbrains_db_migrations::testing::{add_patient, add_tenant, fresh_db};
use medbrains_opd::queue::{ListQueueQuery, queue_rows};
use medbrains_server_core::middleware::auth::Claims;
use sqlx::PgPool;
use uuid::Uuid;

const REASON: &str = "Collapsed in the waiting area";

/// A hospital admin's claims (a bypass role: the test is about order, not access).
fn admin(tenant: Uuid) -> Claims {
    Claims {
        sub: Uuid::new_v4(),
        tenant_id: tenant,
        role: "hospital_admin".to_owned(),
        permissions: Vec::new(),
        department_ids: Vec::new(),
        perm_version: 1,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    }
}

/// One waiting patient: a visit, its queue row at `number` and its OPD token.
async fn arrive(
    db: &PgPool,
    (tenant, department): (Uuid, Uuid),
    number: i32,
    day: NaiveDate,
) -> Uuid {
    let patient = add_patient(db, tenant, &format!("QP-{number}"))
        .await
        .unwrap();
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, department_id) \
         VALUES ($1, $2, 'opd', 'in_progress', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(department)
    .fetch_one(db)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO opd_queues (tenant_id, encounter_id, department_id, token_number, queue_date) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(department)
    .bind(number)
    .bind(day)
    .execute(db)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO tokens (tenant_id, module, scope_id, number, seq, entity_type, entity_id, token_date) \
         VALUES ($1, 'opd', $2, $3, $4, 'encounter', $5, $6)",
    )
    .bind(tenant)
    .bind(department)
    .bind(format!("R-{number:03}"))
    .bind(number)
    .bind(encounter)
    .bind(day)
    .execute(db)
    .await
    .unwrap();
    encounter
}

/// The queue's legacy numbers in the order the list returns them.
async fn order(db: &PgPool, claims: &Claims, day: NaiveDate) -> Vec<i32> {
    let params = ListQueueQuery {
        date: Some(day),
        ..ListQueueQuery::default()
    };
    let mut conn = db.acquire().await.unwrap();
    let rows = queue_rows(&mut conn, claims, &params).await.unwrap();
    rows.iter().map(|row| row.token_number).collect()
}

#[tokio::test]
async fn a_patient_moved_up_is_first_on_the_doctors_list_with_the_reason() {
    let test_db = fresh_db().await.expect("test database");
    let db = test_db.owner().await.expect("owner");
    let tenant = add_tenant(&db, "QPRIO").await.unwrap();
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, 'GM', 'General Medicine', 'clinical') RETURNING id",
    )
    .bind(tenant)
    .fetch_one(&db)
    .await
    .unwrap();
    let day: NaiveDate = sqlx::query_scalar("SELECT CURRENT_DATE")
        .fetch_one(&db)
        .await
        .unwrap();
    let claims = admin(tenant);
    let mut visits = Vec::new();
    for number in 1..=3 {
        visits.push(arrive(&db, (tenant, department), number, day).await);
    }
    assert_eq!(
        order(&db, &claims, day).await,
        [1, 2, 3],
        "arrival order to begin with"
    );

    // What PUT /api/tokens/{id}/priority writes for the third arrival.
    sqlx::query(
        "UPDATE tokens SET priority = 'stat', priority_reason = $2, priority_changed_at = now() \
          WHERE entity_id = $1 AND module = 'opd'",
    )
    .bind(visits[2])
    .bind(REASON)
    .execute(&db)
    .await
    .unwrap();
    assert_eq!(
        order(&db, &claims, day).await,
        [3, 1, 2],
        "STAT first, then arrival order"
    );

    let params = ListQueueQuery {
        date: Some(day),
        ..ListQueueQuery::default()
    };
    let mut conn = db.acquire().await.unwrap();
    let rows = queue_rows(&mut conn, &claims, &params).await.unwrap();
    assert_eq!(rows[0].token_priority.as_deref(), Some("stat"));
    assert_eq!(rows[0].token_priority_reason.as_deref(), Some(REASON));
    assert!(rows[0].token_priority_escalated, "the desk moved it up");
    assert_eq!(rows[1].token_priority_reason, None);
    assert!(!rows[1].token_priority_escalated);

    // The reason is free text about a patient: a caller who holds the queue
    // code but may not see who the patient is gets the row without it.
    let mut queue_only = admin(tenant);
    queue_only.role = "nurse".to_owned();
    queue_only.permissions = vec![medbrains_core::permissions::opd::queue::LIST.to_owned()];
    let masked = queue_rows(&mut conn, &queue_only, &params).await.unwrap();
    assert_eq!(masked[0].token_priority.as_deref(), Some("stat"));
    assert_eq!(masked[0].token_priority_reason, None, "no reason");
    assert_eq!(masked[0].patient_name, None);
    queue_only
        .permissions
        .push(medbrains_core::permissions::patients::VIEW.to_owned());
    let seen = queue_rows(&mut conn, &queue_only, &params).await.unwrap();
    assert_eq!(seen[0].token_priority_reason.as_deref(), Some(REASON));

    // Seen: no longer waiting, so no longer ahead of anyone.
    sqlx::query("UPDATE opd_queues SET status = 'completed' WHERE encounter_id = $1")
        .bind(visits[2])
        .execute(&db)
        .await
        .unwrap();
    assert_eq!(order(&db, &claims, day).await, [1, 2, 3]);
}

//! Patient identity and consent against a real, migrated database: the promises
//! that moved here from the kernel with their outcomes unchanged, including a
//! real database fault reading as `Unknown`, never as a refusal.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-health-services -- --ignored
//! ```
//!
//! `DATABASE_URL` must name a migrated database and a role that may
//! `SET ROLE medbrains_app` (the owner does), so row level security applies.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use medbrains_health_services::consent;
use medbrains_health_services::patient::{self, PatientRef};
use medbrains_kernel::{Actor, Outcome, Tx};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

async fn pool(as_app: bool) -> PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    PgPoolOptions::new()
        .max_connections(2)
        .after_connect(move |conn, _| {
            Box::pin(async move {
                if as_app {
                    sqlx::query("SET ROLE medbrains_app").execute(conn).await?;
                }
                Ok(())
            })
        })
        .connect(&url)
        .await
        .expect("database")
}

/// A new tenant, as an actor in it.
async fn tenant(owner: &PgPool) -> Actor {
    let suffix = Uuid::new_v4().simple().to_string();
    let tenant_id = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Health services test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("HS{}", suffix[..8].to_uppercase()))
    .fetch_one(owner)
    .await
    .expect("tenant");
    Actor {
        tenant_id,
        user_id: Uuid::new_v4(),
    }
}

async fn add_patient(owner: &PgPool, tenant_id: Uuid) -> (Uuid, String) {
    let uhid = format!("HS-{}", Uuid::new_v4().simple());
    let id = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Test', 'Patient', 'male', '9000000000') RETURNING id",
    )
    .bind(tenant_id)
    .bind(&uhid)
    .fetch_one(owner)
    .await
    .expect("patient");
    (id, uhid)
}

/// Record a DPDP decision `age_hours` old.
async fn add_decision(
    owner: &PgPool,
    actor: Actor,
    patient_id: Uuid,
    purposes: &[&str],
    age_hours: i32,
) {
    sqlx::query(
        "INSERT INTO dpdp_consents (tenant_id, patient_id, purposes, created_at) \
         VALUES ($1, $2, $3, now() - make_interval(hours => $4))",
    )
    .bind(actor.tenant_id)
    .bind(patient_id)
    .bind(purposes)
    .bind(age_hours)
    .execute(owner)
    .await
    .expect("decision");
}

async fn check(app: &PgPool, actor: Actor, patient_id: Uuid, purpose: &str) -> Outcome {
    let mut tx = medbrains_kernel::begin(app, actor).await.unwrap();
    consent::check(&mut tx, patient_id, purpose).await
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn consent_keeps_its_three_outcomes() {
    let (owner, app) = (pool(false).await, pool(true).await);
    let (a, b) = (tenant(&owner).await, tenant(&owner).await);
    let (id, _) = add_patient(&owner, a.tenant_id).await;

    // Never asked is a refusal; a purpose the notice does not name has no answer.
    assert_eq!(check(&app, a, id, "research").await, Outcome::Deny);
    assert_eq!(check(&app, a, id, "marketing").await, Outcome::Unknown);

    add_decision(&owner, a, id, &["research"], 2).await;
    assert_eq!(check(&app, a, id, "research").await, Outcome::Allow);
    assert_eq!(check(&app, a, id, "abdm_linking").await, Outcome::Deny);

    // Another hospital's unit of work cannot read this patient's answer.
    assert_eq!(check(&app, b, id, "research").await, Outcome::Deny);

    // The newest decision wins: a withdrawal takes the agreement back.
    add_decision(&owner, a, id, &["insurance_claims"], 1).await;
    assert_eq!(check(&app, a, id, "research").await, Outcome::Deny);
    assert_eq!(check(&app, a, id, "insurance_claims").await, Outcome::Allow);
}

/// The transaction is aborted, so the ledger really cannot be read.
#[tokio::test]
#[ignore = "needs-pg"]
async fn a_database_fault_is_unknown_not_a_refusal() {
    let (owner, app) = (pool(false).await, pool(true).await);
    let a = tenant(&owner).await;
    let (id, _) = add_patient(&owner, a.tenant_id).await;
    add_decision(&owner, a, id, &["research"], 1).await;

    let mut tx: Tx = medbrains_kernel::begin(&app, a).await.unwrap();
    assert!(sqlx::query("SELECT 1 / 0").execute(&mut *tx).await.is_err());
    assert_eq!(
        consent::check(&mut tx, id, "research").await,
        Outcome::Unknown
    );
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn resolve_follows_merges_inside_the_tenant() {
    let (owner, app) = (pool(false).await, pool(true).await);
    let (a, b) = (tenant(&owner).await, tenant(&owner).await);
    let (kept, _) = add_patient(&owner, a.tenant_id).await;
    let (merged, merged_uhid) = add_patient(&owner, a.tenant_id).await;
    sqlx::query("UPDATE patients SET is_merged = true, merged_into_patient_id = $1 WHERE id = $2")
        .bind(kept)
        .bind(merged)
        .execute(&owner)
        .await
        .expect("merge");

    let resolve = async |actor: Actor, identifier: PatientRef<'_>| {
        let mut tx = medbrains_kernel::begin(&app, actor).await.unwrap();
        patient::resolve(&mut tx, identifier).await.unwrap()
    };
    assert_eq!(resolve(a, PatientRef::Id(kept)).await, Some(kept));
    assert_eq!(resolve(a, PatientRef::Id(merged)).await, Some(kept));
    assert_eq!(resolve(a, PatientRef::Uhid(&merged_uhid)).await, Some(kept));
    assert_eq!(resolve(a, PatientRef::Id(Uuid::new_v4())).await, None);
    assert_eq!(resolve(b, PatientRef::Id(kept)).await, None);
}

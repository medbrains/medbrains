//! Shared set-up for the change-set integration tests: a tenant with an
//! active Warfarin + Aspirin rule and 14 admitted patients on 3 wards, each
//! with an active prescription for both.

#![allow(
    dead_code,
    clippy::redundant_pub_crate,
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

use medbrains_core::permissions::{knowledge::change_sets as perm, pharmacy};
use medbrains_knowledge::engine;
use medbrains_knowledge::model::{
    Area, KnowledgeChangeSetDetail, KnowledgeImpactReport, NewKnowledgeChangeItem,
    NewKnowledgeChangeSet, Op,
};
use medbrains_server_core::middleware::auth::Claims;
use sqlx::PgPool;
use uuid::Uuid;

pub(crate) async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://medbrains:medbrains_dev@localhost:5435/medbrains_wt_kcs".to_owned()
    });
    PgPool::connect(&url)
        .await
        .expect("needs a migrated dev database")
}

pub(crate) fn claims(tenant: Uuid, user: Uuid, perms: &[&str]) -> Claims {
    Claims {
        sub: user,
        tenant_id: tenant,
        role: "staff".to_owned(),
        permissions: perms.iter().map(|p| (*p).to_owned()).collect(),
        department_ids: Vec::new(),
        perm_version: 1,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    }
}

pub(crate) struct World {
    pub(crate) pool: PgPool,
    pub(crate) tenant: Uuid,
    /// Drafts (pharmacist).
    pub(crate) author: Claims,
    /// Approves, applies and starts rollbacks (quality officer).
    pub(crate) checker: Claims,
    /// A second checker, to approve the rollback the first one starts.
    pub(crate) checker2: Claims,
    pub(crate) interaction: Uuid,
}

pub(crate) async fn exec(tx: &mut sqlx::Transaction<'_, sqlx::Postgres>, sql: &str) -> Uuid {
    sqlx::query_scalar(sql)
        .fetch_one(&mut **tx)
        .await
        .unwrap_or_else(|e| panic!("{sql}: {e}"))
}

/// A tenant with an active Warfarin + Aspirin rule and 14 admitted patients on
/// 3 wards, each with an active prescription for both.
pub(crate) async fn world() -> World {
    let pool = pool().await;
    let mut tx = pool.begin().await.unwrap();
    let tenant: Uuid = exec(
        &mut tx,
        &format!(
            "INSERT INTO tenants (code, name, hospital_type) VALUES ('KCS{}', 'Change set test', \
         'multi_specialty') RETURNING id",
            Uuid::new_v4().simple().to_string()[..10].to_uppercase()
        ),
    )
    .await;
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    let mut users = Vec::new();
    for role in ["pharmacist", "quality_officer", "quality_officer", "doctor"] {
        let n = Uuid::new_v4().simple().to_string()[..12].to_owned();
        users.push(
            exec(
                &mut tx,
                &format!(
                    "INSERT INTO users (tenant_id, username, email, full_name, role) VALUES \
             ('{tenant}', 'u{n}', '{n}@kcs.test', 'Test {role}', '{role}') RETURNING id"
                ),
            )
            .await,
        );
    }
    let doctor = users[3];
    let mut wards = Vec::new();
    for w in 0..3 {
        wards.push(exec(&mut tx, &format!(
            "INSERT INTO wards (tenant_id, code, name) VALUES ('{tenant}', 'W{w}', 'Ward {w}') RETURNING id")).await);
    }
    for i in 0..14 {
        let patient = exec(&mut tx, &format!(
            "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) VALUES \
             ('{tenant}', 'KCS-{i}-{}', 'Patient', '{i}', 'female', '9000000000') RETURNING id",
            Uuid::new_v4().simple())).await;
        let encounter = exec(
            &mut tx,
            &format!(
                "INSERT INTO encounters (tenant_id, patient_id, encounter_type) VALUES \
             ('{tenant}', '{patient}', 'ipd') RETURNING id"
            ),
        )
        .await;
        exec(&mut tx, &format!(
            "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, \
             admission_number, ward_id) VALUES ('{tenant}', '{encounter}', '{patient}', '{doctor}', \
             'ADM-{i}-{}', '{}') RETURNING id", Uuid::new_v4().simple(), wards[i % 3])).await;
        let rx = exec(
            &mut tx,
            &format!(
                "INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, patient_id) VALUES \
             ('{tenant}', '{encounter}', '{doctor}', '{patient}') RETURNING id"
            ),
        )
        .await;
        for drug in ["Warfarin", "Aspirin"] {
            exec(&mut tx, &format!(
                "INSERT INTO prescription_items (tenant_id, prescription_id, drug_name, dosage, \
                 frequency, duration) VALUES ('{tenant}', '{rx}', '{drug}', '1 tab', 'OD', '5 days') \
                 RETURNING id")).await;
        }
    }
    let interaction = exec(&mut tx, &format!(
        "INSERT INTO drug_interactions (tenant_id, drug_a_name, drug_b_name, severity, description) \
         VALUES ('{tenant}', 'Warfarin', 'Aspirin', 'major', 'Bleeding risk') RETURNING id")).await;
    tx.commit().await.unwrap();
    let drafter = [perm::LIST, perm::CREATE, pharmacy::interactions::MANAGE];
    let checker = [perm::LIST, perm::APPROVE, perm::APPLY, perm::ROLLBACK];
    World {
        pool,
        tenant,
        author: claims(tenant, users[0], &drafter),
        checker: claims(tenant, users[1], &checker),
        checker2: claims(tenant, users[2], &checker),
        interaction,
    }
}

pub(crate) fn removal(w: &World) -> NewKnowledgeChangeSet {
    NewKnowledgeChangeSet {
        area: Area::DrugInteractions,
        title: "Remove warfarin + aspirin".to_owned(),
        reason: "Duplicate of the national rule".to_owned(),
        items: vec![NewKnowledgeChangeItem {
            op: Op::Delete,
            target_id: Some(w.interaction),
            after: None,
        }],
    }
}

pub(crate) fn impact(d: &KnowledgeChangeSetDetail) -> KnowledgeImpactReport {
    serde_json::from_value(d.set.impact.clone().expect("previewed")).expect("impact shape")
}

/// Drafted, previewed and approved.
pub(crate) async fn approved(w: &World) -> KnowledgeChangeSetDetail {
    let d = engine::create(&w.pool, &w.author, &removal(w))
        .await
        .expect("draft");
    engine::preview(&w.pool, &w.author, d.set.id)
        .await
        .expect("preview");
    engine::approve(&w.pool, &w.checker, d.set.id, Some("ok"))
        .await
        .expect("approve")
}

pub(crate) async fn alerts(w: &World) -> usize {
    let mut tx = w.pool.begin().await.unwrap();
    let names = ["Warfarin".to_owned(), "Aspirin".to_owned()];
    let found = medbrains_telehealth::cds::interaction_alerts_for_drugs(&mut tx, w.tenant, &names)
        .await
        .expect("reader");
    found.len()
}

pub(crate) async fn status(w: &World, id: Uuid) -> String {
    engine::get(&w.pool, &w.author, id)
        .await
        .expect("get")
        .set
        .status
}

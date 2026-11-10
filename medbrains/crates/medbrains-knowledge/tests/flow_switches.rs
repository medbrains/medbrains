//! RFC-SOP-FLOWS §8: a switch change on the discharge flow is previewed, needs
//! the quality officer's and the medical superintendent's approval, applies
//! as a new flow version, and rolls back.
//!
//! ```text
//! DATABASE_URL=postgres://medbrains:medbrains_dev@localhost:5438/medbrains \
//!   cargo test -p medbrains-knowledge --test flow_switches -- --ignored
//! ```

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

use medbrains_knowledge::engine;
use medbrains_knowledge::model::{Area, NewKnowledgeChangeItem, NewKnowledgeChangeSet, Op};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_sop_flows::{discharge, store};
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

const KC: &str = "knowledge.change_sets.";

fn claims(tenant: Uuid, user: Uuid, role: &str, perms: &[&str]) -> Claims {
    Claims {
        sub: user,
        tenant_id: tenant,
        role: role.to_owned(),
        permissions: perms.iter().map(|p| (*p).to_owned()).collect(),
        department_ids: Vec::new(),
        perm_version: 1,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    }
}

struct World {
    pool: PgPool,
    tenant: Uuid,
    template: Uuid,
    author: Claims,
    qo: Claims,
    ms: Claims,
    admin: Claims,
}

async fn world() -> World {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://medbrains:medbrains_dev@localhost:5438/medbrains".to_owned()
    });
    let pool = PgPool::connect(&url)
        .await
        .expect("needs a migrated database");
    let mut tx = pool.begin().await.unwrap();
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar(&format!(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ('FSW{code}', 'Switch test', 'multi_specialty') RETURNING id"
    ))
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    let mut ids = Vec::new();
    for role in [
        "quality_officer",
        "quality_officer",
        "medical_superintendent",
        "hospital_admin",
    ] {
        let n = Uuid::new_v4().simple().to_string()[..12].to_owned();
        ids.push(
            sqlx::query_scalar::<_, Uuid>(&format!(
                "INSERT INTO users (tenant_id, username, email, full_name, role) VALUES \
                 ('{tenant}', 'u{n}', '{n}@fsw.test', 'Test {role}', '{role}') RETURNING id"
            ))
            .fetch_one(&mut *tx)
            .await
            .unwrap(),
        );
    }
    let template = store::ensure_published(&mut tx, tenant, &discharge::flow())
        .await
        .unwrap()
        .id;
    tx.commit().await.unwrap();
    let qo_perms = [
        &format!("{KC}list")[..],
        &format!("{KC}create"),
        &format!("{KC}approve"),
        &format!("{KC}apply"),
        &format!("{KC}rollback"),
        "flows.view",
        "flows.switch",
        "flows.publish",
    ];
    let ms_perms = [
        &format!("{KC}list")[..],
        &format!("{KC}approve"),
        "flows.view",
        "flows.publish",
    ];
    World {
        author: claims(tenant, ids[0], "quality_officer", &qo_perms),
        qo: claims(tenant, ids[1], "quality_officer", &qo_perms),
        ms: claims(tenant, ids[2], "medical_superintendent", &ms_perms),
        admin: claims(tenant, ids[3], "hospital_admin", &[]),
        pool,
        tenant,
        template,
    }
}

fn change(w: &World, tpa: bool) -> NewKnowledgeChangeSet {
    NewKnowledgeChangeSet {
        area: Area::FlowSwitches,
        title: "Insurance discharges wait for TPA".to_owned(),
        reason: "SOP 14 section 3".to_owned(),
        items: vec![NewKnowledgeChangeItem {
            op: Op::Update,
            target_id: Some(w.template),
            after: Some(json!({
                "flow_code": discharge::CODE,
                "tpa_before_billing": tpa,
                "final_signoff": "treating_doctor",
            })),
        }],
    }
}

async fn published(w: &World) -> (i32, Value) {
    let mut tx = w.pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(w.tenant.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    let t = store::published(&mut tx, w.tenant, discharge::CODE, false)
        .await
        .unwrap()
        .unwrap();
    (t.version, t.switches)
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_discharge_switch_change_needs_the_quality_officer_and_the_superintendent() {
    let w = world().await;
    let d = engine::create(&w.pool, &w.author, &change(&w, true))
        .await
        .expect("draft");
    let d = engine::preview(&w.pool, &w.author, d.set.id)
        .await
        .expect("preview");
    let impact = d.set.impact.clone().unwrap().to_string();
    assert!(
        impact.contains("Route now stops at TPA clearance for insurance patients"),
        "{impact}"
    );

    // The author never approves; a bypass role is not an office.
    assert!(
        engine::approve(&w.pool, &w.author, d.set.id, None)
            .await
            .is_err()
    );
    assert!(matches!(
        engine::approve(&w.pool, &w.admin, d.set.id, None).await,
        Err(AppError::ForbiddenReason(_))
    ));

    let d = engine::approve(&w.pool, &w.qo, d.set.id, Some("matches SOP"))
        .await
        .expect("QO");
    assert_eq!(
        d.set.status, "previewed",
        "one office is not enough for a clinical flow"
    );
    assert!(matches!(
        engine::apply(&w.pool, &w.qo, d.set.id).await,
        Err(AppError::Conflict(_))
    ));
    assert_eq!(published(&w).await.0, 1, "nothing changed yet");

    let d = engine::approve(&w.pool, &w.ms, d.set.id, None)
        .await
        .expect("MS");
    assert_eq!(d.set.status, "approved");
    assert_eq!(d.set.approver_role.as_deref(), Some("quality_officer"));
    assert_eq!(
        d.set.second_approver_role.as_deref(),
        Some("medical_superintendent")
    );
    let d = engine::apply(&w.pool, &w.qo, d.set.id)
        .await
        .expect("apply");
    assert_eq!(d.set.status, "applied");
    let (version, switches) = published(&w).await;
    assert_eq!(version, 2);
    assert_eq!(switches["tpa_before_billing"], json!(true));

    // Roll back: a new set, approved the same way, publishes version 3.
    let r = engine::rollback(&w.pool, &w.author, d.set.id, "SOP withdrawn")
        .await
        .expect("rollback");
    engine::preview(&w.pool, &w.author, r.set.id)
        .await
        .expect("preview");
    engine::approve(&w.pool, &w.ms, r.set.id, None)
        .await
        .expect("MS");
    engine::approve(&w.pool, &w.qo, r.set.id, None)
        .await
        .expect("QO");
    engine::apply(&w.pool, &w.qo, r.set.id)
        .await
        .expect("apply");
    let (version, switches) = published(&w).await;
    assert_eq!(
        (version, &switches["tpa_before_billing"]),
        (3, &json!(false))
    );
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn the_same_office_cannot_approve_twice() {
    let w = world().await;
    let d = engine::create(&w.pool, &w.author, &change(&w, true))
        .await
        .expect("draft");
    engine::preview(&w.pool, &w.author, d.set.id)
        .await
        .expect("preview");
    engine::approve(&w.pool, &w.qo, d.set.id, None)
        .await
        .expect("QO");
    let err = engine::approve(&w.pool, &w.qo, d.set.id, None)
        .await
        .unwrap_err();
    assert!(matches!(err, AppError::Conflict(_)), "{err}");
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_locked_signal_or_a_removal_is_refused() {
    let w = world().await;
    let mut locked = change(&w, true);
    locked.items[0].after.as_mut().unwrap()["summary_signed"] = json!(false);
    let err = engine::create(&w.pool, &w.author, &locked)
        .await
        .unwrap_err();
    assert!(err.to_string().contains("required safety signal"), "{err}");
    let mut removal = change(&w, true);
    removal.items[0].op = Op::Delete;
    removal.items[0].after = None;
    assert!(matches!(
        engine::create(&w.pool, &w.author, &removal).await,
        Err(AppError::BadRequest(_))
    ));
}

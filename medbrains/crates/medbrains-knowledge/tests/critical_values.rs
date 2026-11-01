//! RFC-KNOWLEDGE-CHANGE-SETS §7 for critical-value rules: impact judges
//! recent results the way result entry does.
//!
//!   cargo test -p medbrains-knowledge -- --ignored

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod common;

use common::{claims, exec, impact, world};
use medbrains_core::permissions::{knowledge::change_sets as perm, lab};
use medbrains_knowledge::engine;
use medbrains_knowledge::model::{
    Area, NewKnowledgeChangeItem, NewKnowledgeChangeSet, Op, Severity,
};

#[tokio::test]
#[ignore = "needs-pg"]
async fn removing_a_critical_rule_counts_results_that_would_stop_being_critical() {
    let w = world().await;
    let mut tx = w.pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(w.tenant.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    let t = w.tenant;
    let rule = exec(&mut tx, &format!(
        "INSERT INTO critical_value_rules (tenant_id, test_code, test_name, low_critical, \
         high_critical, alert_message) VALUES ('{t}', 'K', 'Potassium', 2.5, 6.5, 'Call') RETURNING id")).await;
    let patient = exec(
        &mut tx,
        &format!("SELECT id FROM patients WHERE tenant_id = '{t}' LIMIT 1"),
    )
    .await;
    let encounter = exec(
        &mut tx,
        &format!("SELECT id FROM encounters WHERE patient_id = '{patient}'"),
    )
    .await;
    let test = exec(&mut tx, &format!(
        "INSERT INTO lab_test_catalog (tenant_id, code, name) VALUES ('{t}', 'K', 'Potassium') RETURNING id")).await;
    let order = exec(&mut tx, &format!(
        "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by) VALUES \
         ('{t}', '{encounter}', '{patient}', '{test}', '{}') RETURNING id", w.author.sub)).await;
    for value in ["2.2", "4.1"] {
        exec(
            &mut tx,
            &format!(
                "INSERT INTO lab_results (tenant_id, order_id, parameter_name, value) VALUES \
             ('{t}', '{order}', 'Potassium', '{value}') RETURNING id"
            ),
        )
        .await;
    }
    tx.commit().await.unwrap();

    let lab_mgr = claims(
        w.tenant,
        w.author.sub,
        &[perm::CREATE, perm::LIST, lab::catalog::MANAGE],
    );
    let d = engine::create(
        &w.pool,
        &lab_mgr,
        &NewKnowledgeChangeSet {
            area: Area::CriticalValueRules,
            title: "Drop potassium rule".to_owned(),
            reason: "Test".to_owned(),
            items: vec![NewKnowledgeChangeItem {
                op: Op::Delete,
                target_id: Some(rule),
                after: None,
            }],
        },
    )
    .await
    .expect("draft");
    let d = engine::preview(&w.pool, &lab_mgr, d.set.id)
        .await
        .expect("preview");
    let report = impact(&d);
    let lost = report
        .entries
        .iter()
        .find(|e| e.relation == "recent_results_no_longer_critical")
        .expect("entry");
    assert_eq!(lost.count, 1, "only the 2.2 was critical");
    assert!(lost.examples[0].label.contains("Potassium 2.2"));
    let open = report
        .entries
        .iter()
        .find(|e| e.relation == "open_lab_orders")
        .expect("open orders");
    assert_eq!(open.count, 1);
    assert_eq!(open.severity, Severity::Safety);
}

//! RFC-KNOWLEDGE-CHANGE-SETS §7, end to end against a real database.
//!
//! ```text
//! DATABASE_URL=postgres://medbrains:medbrains_dev@localhost:5435/medbrains_wt_kcs \
//!   cargo test -p medbrains-knowledge -- --ignored
//! ```
//!
//! Each test builds its own tenant, so they run in parallel and the tenant's
//! audit chain holds only what the test wrote.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod common;

use common::{alerts, approved, claims, impact, removal, status, world};
use medbrains_core::permissions::{knowledge::change_sets as perm, lab};
use medbrains_db::audit::AuditLogger;
use medbrains_knowledge::engine;
use medbrains_knowledge::model::Severity;
use medbrains_knowledge::proof::{canonical, sha256_hex};
use medbrains_server_core::error::AppError;
use serde_json::json;
use uuid::Uuid;

#[tokio::test]
#[ignore = "needs-pg"]
async fn preview_counts_the_prescriptions_that_would_stop_warning() {
    let w = world().await;
    let d = engine::create(&w.pool, &w.author, &removal(&w))
        .await
        .expect("draft");
    let d = engine::preview(&w.pool, &w.author, d.set.id)
        .await
        .expect("preview");
    assert_eq!(d.set.status, "previewed");
    let report = impact(&d);
    let rx = report
        .entries
        .iter()
        .find(|e| e.relation == "active_prescriptions")
        .expect("entry");
    assert_eq!(rx.count, 14);
    assert_eq!(
        rx.summary,
        "14 active prescriptions on 3 wards would stop warning about Warfarin + Aspirin"
    );
    assert_eq!(rx.examples.len(), 14);
    assert!(
        rx.examples[0]
            .href
            .as_deref()
            .is_some_and(|h| h.starts_with("/patients/"))
    );
    // Safety first, and the preview left nothing behind.
    assert_eq!(report.entries[0].severity, Severity::Safety);
    assert_eq!(alerts(&w).await, 1, "preview must roll its edits back");
    assert!(d.items[0].before.is_some(), "before captured at preview");
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn the_author_cannot_approve_their_own_change() {
    let w = world().await;
    let d = engine::create(&w.pool, &w.author, &removal(&w))
        .await
        .expect("draft");
    engine::preview(&w.pool, &w.author, d.set.id)
        .await
        .expect("preview");
    // Even holding `approve`, the author is refused.
    let both = claims(w.tenant, w.author.sub, &[perm::LIST, perm::APPROVE]);
    let err = engine::approve(&w.pool, &both, d.set.id, None)
        .await
        .expect_err("refused");
    assert!(matches!(err, AppError::ForbiddenReason(_)), "{err:?}");
    assert_eq!(status(&w, d.set.id).await, "previewed");
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_direct_edit_after_preview_makes_apply_refuse_as_stale() {
    let w = world().await;
    let d = approved(&w).await;
    sqlx::query("UPDATE drug_interactions SET description = 'Edited directly' WHERE id = $1")
        .bind(w.interaction)
        .execute(&w.pool)
        .await
        .unwrap();
    let err = engine::apply(&w.pool, &w.checker, d.set.id)
        .await
        .expect_err("stale");
    assert!(matches!(err, AppError::Conflict(_)), "{err:?}");
    assert_eq!(status(&w, d.set.id).await, "stale");
    assert_eq!(alerts(&w).await, 1, "nothing was applied");
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn rollback_restores_the_rule_and_both_sets_are_in_the_audit_chain() {
    let w = world().await;
    let d = approved(&w).await;
    engine::apply(&w.pool, &w.checker, d.set.id)
        .await
        .expect("apply");
    assert_eq!(alerts(&w).await, 0, "the warning stopped");

    let back = engine::rollback(&w.pool, &w.checker, d.set.id, "Removed in error")
        .await
        .expect("rollback");
    assert_eq!(back.set.rollback_of_set_id, Some(d.set.id));
    assert_eq!(back.items[0].op, "update");
    engine::preview(&w.pool, &w.checker, back.set.id)
        .await
        .expect("preview rollback");
    engine::approve(&w.pool, &w.checker2, back.set.id, None)
        .await
        .expect("approve rollback");
    engine::apply(&w.pool, &w.checker2, back.set.id)
        .await
        .expect("apply rollback");

    assert_eq!(alerts(&w).await, 1, "the warning fires again");
    assert_eq!(status(&w, d.set.id).await, "rolled_back");
    let applied: Vec<Uuid> = sqlx::query_scalar(
        "SELECT entity_id FROM audit_log WHERE tenant_id = $1 AND action = 'knowledge_change.apply'",
    )
    .bind(w.tenant)
    .fetch_all(&w.pool)
    .await
    .unwrap();
    assert!(
        applied.contains(&d.set.id) && applied.contains(&back.set.id),
        "{applied:?}"
    );
    // A second rollback of the same change is refused.
    let again = engine::rollback(&w.pool, &w.checker, d.set.id, "again")
        .await
        .expect_err("refused");
    assert!(matches!(again, AppError::Conflict(_)));
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn the_proof_recomputes_offline_and_its_audit_rows_verify() {
    let w = world().await;
    let d = approved(&w).await;
    let applied = engine::apply(&w.pool, &w.checker, d.set.id)
        .await
        .expect("apply");
    let proof = medbrains_knowledge::proof_file::proof(&w.pool, &w.author, d.set.id)
        .await
        .expect("proof");

    assert_eq!(sha256_hex(&proof.canonical), proof.proof_hash);
    assert_eq!(canonical(&proof.input), proof.canonical);
    assert_eq!(
        applied.set.proof_hash.as_deref(),
        Some(proof.proof_hash.as_str())
    );
    assert_eq!(
        proof.input["items"][0]["before"]["drug_a_name"],
        json!("Warfarin")
    );
    let actions: Vec<&str> = proof.audit_rows.iter().map(|r| r.action.as_str()).collect();
    for a in [
        "knowledge_change.approve",
        "knowledge_change.apply_item",
        "knowledge_change.apply",
    ] {
        assert!(actions.contains(&a), "{actions:?}");
    }
    for row in &proof.audit_rows {
        let input = row
            .hash_input_canonical
            .as_deref()
            .expect("canonical audit input");
        assert_eq!(
            sha256_hex(input),
            row.hash,
            "audit row {} re-hashes",
            row.id
        );
    }
    let chain = AuditLogger::verify_chain_for_tenant(&w.pool, w.tenant)
        .await
        .unwrap();
    assert!(chain.valid, "chain broken at {:?}", chain.broken_at);
    // Tampering with the proof is caught.
    assert_ne!(
        sha256_hex(&proof.canonical.replace("Warfarin", "Warfarln")),
        proof.proof_hash
    );
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn without_the_permissions_nothing_is_read_or_drafted() {
    let w = world().await;
    let nobody = claims(w.tenant, w.author.sub, &[]);
    assert!(matches!(
        engine::list(&w.pool, &nobody, None, None).await,
        Err(AppError::Forbidden)
    ));
    assert!(matches!(
        medbrains_knowledge::proof_file::proof(&w.pool, &nobody, Uuid::new_v4()).await,
        Err(AppError::Forbidden)
    ));
    // `create` alone is not enough: the area's manage permission is needed too.
    let half = claims(w.tenant, w.author.sub, &[perm::CREATE]);
    let err = engine::create(&w.pool, &half, &removal(&w))
        .await
        .expect_err("refused");
    assert!(matches!(err, AppError::Forbidden));
    // And a lab manager cannot draft pharmacy rules.
    let lab_mgr = claims(
        w.tenant,
        w.author.sub,
        &[perm::CREATE, lab::catalog::MANAGE],
    );
    assert!(matches!(
        engine::create(&w.pool, &lab_mgr, &removal(&w)).await,
        Err(AppError::Forbidden)
    ));
    let settings = claims(w.tenant, w.author.sub, &[perm::APPLY]);
    assert!(matches!(
        engine::apply(&w.pool, &settings, Uuid::new_v4()).await,
        Err(AppError::NotFound)
    ));
}

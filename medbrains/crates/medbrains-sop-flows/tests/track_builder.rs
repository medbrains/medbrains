//! RFC-SOP-FLOWS §11, the track builder against a real database: drafts,
//! server-run checks, dry run, replay, and the authoritative proposal check.
//!
//! ```text
//! DATABASE_URL=postgres://medbrains:medbrains_dev@localhost:5440/medbrains \
//!   cargo test -p medbrains-sop-flows --test track_builder -- --ignored
//! ```

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod common;

use common::{World, claims, set_tenant, world};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_sop_flows::builder::{self, DryRunRequest, SaveDraft};
use medbrains_sop_flows::discharge::CODE;
use medbrains_sop_flows::model::{Station, StationKind};
use serde_json::{Value, json};

fn designer(w: &World) -> Claims {
    claims(
        w.tenant,
        w.user("quality_officer", 0),
        "quality_officer",
        &["flows.view", "flows.build"],
    )
}

fn physio() -> Station {
    Station {
        key: "physio".to_owned(),
        name: "Physiotherapy clearance".to_owned(),
        stage: "Before billing".to_owned(),
        kind: StationKind::Task {
            task: "ipd.physio_clearance".to_owned(),
        },
        lane: Some("Orthopaedics".to_owned()),
        switch_when: Value::Null,
        fact_when: json!({ "department": "ORTHO" }),
        sla_minutes: Some(60),
        locked: false,
        holder: String::new(),
        holder_role: None,
        required_by: None,
        path: String::new(),
    }
}

/// The library track with physiotherapy inserted before billing.
async fn with_physio(w: &World) -> Vec<Station> {
    let v = builder::get(&w.state.db, &designer(w), CODE)
        .await
        .expect("builder");
    let mut track = v.published;
    let at = track
        .iter()
        .position(|s| s.key == "billing_cleared")
        .unwrap();
    track.insert(at, physio());
    track
}

async fn check(
    w: &World,
    track: &[Station],
    draft: Option<(uuid::Uuid, i32)>,
) -> Result<(), String> {
    let mut tx = w.state.db.begin().await.unwrap();
    set_tenant(&mut tx, w.tenant).await;
    builder::check_proposal(&mut tx, w.tenant, CODE, track, draft)
        .await
        .expect("no fault")
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_draft_is_checked_dry_run_and_only_then_proposable() {
    let w = world().await;
    w.seed_roles().await;
    let d = designer(&w);
    let track = with_physio(&w).await;
    let v = builder::save(
        &w.state.db,
        &d,
        CODE,
        SaveDraft {
            revision: 0,
            stations: track.clone(),
        },
    )
    .await
    .expect("save");
    let draft = v.draft.expect("draft").draft;
    assert_eq!(draft.revision, 1);
    let failing: Vec<&str> = v
        .checks
        .iter()
        .filter(|c| !c.pass)
        .map(|c| c.rule)
        .collect();
    assert_eq!(failing, ["dry_run"], "everything but the dry run passes");
    let saved = draft.track().unwrap();
    assert!(saved[0].locked, "the server owns the lock");
    assert_eq!(
        saved.iter().find(|s| s.key == "physio").unwrap().holder,
        "Physiotherapy"
    );

    // Not dry-run yet: the server refuses, whatever the screen claims.
    let err = check(&w, &saved, Some((draft.id, 1))).await.unwrap_err();
    assert!(err.contains("test drive"), "{err}");

    let drive = builder::dry_run(&w.state.db, &d, CODE, &DryRunRequest { revision: 1 })
        .await
        .expect("dry run");
    assert!(
        drive
            .samples
            .iter()
            .any(|s| s.route.contains(&"physio".to_owned()))
    );
    assert!(
        drive
            .samples
            .iter()
            .any(|s| !s.route.contains(&"physio".to_owned()))
    );
    assert_eq!(drive.replay.journeys, 0);
    assert!(
        drive.replay.median_minutes_before.is_none(),
        "no history, no invented numbers"
    );
    assert!(drive.replay.sentences[0].contains("nothing to replay"));
    assert_eq!(check(&w, &saved, Some((draft.id, 1))).await, Ok(()));

    // Edited after the dry run: proposing the old revision is refused.
    builder::save(
        &w.state.db,
        &d,
        CODE,
        SaveDraft {
            revision: 1,
            stations: track,
        },
    )
    .await
    .expect("save again");
    assert!(check(&w, &saved, Some((draft.id, 1))).await.is_err());
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_track_not_from_a_draft_or_breaking_a_rule_is_refused() {
    let w = world().await;
    w.seed_roles().await;
    let mut track = with_physio(&w).await;
    let err = check(&w, &track, None).await.unwrap_err();
    assert!(err.contains("must come from a draft"), "{err}");
    // Removing Summary signed fails the checks even in a hand-built set.
    track.retain(|s| s.key != "summary_signed");
    let d = designer(&w);
    let v = builder::save(
        &w.state.db,
        &d,
        CODE,
        SaveDraft {
            revision: 0,
            stations: track.clone(),
        },
    )
    .await
    .expect("a failing draft still saves");
    let inv = v.checks.iter().find(|c| c.rule == "invariants").unwrap();
    assert!(!inv.pass);
    let id = v.draft.unwrap().draft.id;
    builder::dry_run(&w.state.db, &d, CODE, &DryRunRequest { revision: 1 })
        .await
        .expect("dry run");
    let saved = builder::get(&w.state.db, &d, CODE)
        .await
        .unwrap()
        .draft
        .unwrap()
        .draft
        .track()
        .unwrap();
    let err = check(&w, &saved, Some((id, 1))).await.unwrap_err();
    assert!(err.contains("Summary signed"), "{err}");
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_stale_save_is_refused() {
    let w = world().await;
    w.seed_roles().await;
    let d = designer(&w);
    let track = with_physio(&w).await;
    builder::save(
        &w.state.db,
        &d,
        CODE,
        SaveDraft {
            revision: 0,
            stations: track.clone(),
        },
    )
    .await
    .expect("save");
    let again = builder::save(
        &w.state.db,
        &d,
        CODE,
        SaveDraft {
            revision: 0,
            stations: track,
        },
    )
    .await
    .unwrap_err();
    assert!(matches!(again, AppError::Conflict(_)), "{again}");
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn without_flows_build_nothing_is_served() {
    let w = world().await;
    let viewer = claims(
        w.tenant,
        w.user("quality_officer", 1),
        "staff",
        &["flows.view", "flows.switch"],
    );
    assert!(matches!(
        builder::get(&w.state.db, &viewer, CODE).await,
        Err(AppError::Forbidden)
    ));
    assert!(matches!(
        builder::save(
            &w.state.db,
            &viewer,
            CODE,
            SaveDraft {
                revision: 0,
                stations: Vec::new()
            }
        )
        .await,
        Err(AppError::Forbidden)
    ));
    assert!(matches!(
        builder::dry_run(&w.state.db, &viewer, CODE, &DryRunRequest { revision: 1 }).await,
        Err(AppError::Forbidden)
    ));
    assert!(matches!(
        builder::discard(&w.state.db, &viewer, CODE).await,
        Err(AppError::Forbidden)
    ));
}

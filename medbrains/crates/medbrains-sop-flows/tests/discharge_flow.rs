//! RFC-SOP-FLOWS §8, the discharge flow end to end against a real database.
//!
//! ```text
//! DATABASE_URL=postgres://medbrains:medbrains_dev@localhost:5438/medbrains \
//!   cargo test -p medbrains-sop-flows -- --ignored
//! ```

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod common;

use axum::{Extension, Json, extract::Path, extract::State};
use common::{World, claims, set_tenant, world};
use medbrains_server_core::error::AppError;
use medbrains_sop_flows::discharge::{CODE, SW_TPA};
use medbrains_sop_flows::model::{RunRequest, Switches, Ticket};
use medbrains_sop_flows::{catalog, control_room, discharge, engine, route, store};
use serde_json::{Value, json};
use uuid::Uuid;

async fn ticket(w: &World, adm: Uuid) -> Ticket {
    engine::ticket(&w.state, &w.ward(), CODE, adm)
        .await
        .expect("ticket")
        .expect("started")
}

fn at(t: &Ticket) -> String {
    t.current
        .as_ref()
        .map_or_else(|| "(none)".to_owned(), |c| c.key.clone())
}

fn switches(tpa: bool) -> Switches {
    let mut s = route::defaults(&discharge::flow());
    s.insert(SW_TPA.to_owned(), json!(tpa));
    s
}

async fn publish(w: &World, s: &Switches) -> Uuid {
    let mut tx = w.state.db.begin().await.unwrap();
    set_tenant(&mut tx, w.tenant).await;
    let id = store::publish_switches(&mut tx, w.tenant, CODE, s)
        .await
        .expect("publish");
    tx.commit().await.unwrap();
    id
}

fn finalize() -> RunRequest {
    RunRequest {
        station: "finalize".to_owned(),
        input: json!({ "discharge_type": "normal" }),
    }
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn insurance_waits_for_tpa_and_cash_skips_it() {
    let w = world().await;
    publish(&w, &switches(true)).await;
    let (ins, cash) = (w.admit(true).await, w.admit(false).await);
    for adm in [ins, cash] {
        engine::start(&w.state, &w.ward(), CODE, adm)
            .await
            .expect("start");
        w.clear_to_billing(adm).await;
        w.clear_billing(adm).await;
    }
    let t = ticket(&w, ins).await;
    assert_eq!(at(&t), "tpa_clearance");
    let current = t.current.unwrap();
    assert_eq!(current.holder, "TPA desk");
    assert_eq!(
        current.routed_by.as_deref(),
        Some("Insurance patients need TPA clearance before billing")
    );
    assert_eq!(
        at(&ticket(&w, cash).await),
        "finalize",
        "cash patients skip TPA clearance"
    );

    w.sql(&format!(
        "UPDATE pre_authorization_requests SET status = 'approved', reviewed_at = now() \
          WHERE encounter_id = (SELECT encounter_id FROM admissions WHERE id = '{ins}')"
    ))
    .await;
    assert_eq!(at(&ticket(&w, ins).await), "finalize");
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn defaults_reproduce_todays_discharge() {
    let w = world().await;
    // An insurance patient on the default switches: no TPA, no superintendent.
    let adm = w.admit(true).await;
    let t = engine::start(&w.state, &w.ward(), CODE, adm)
        .await
        .expect("start");
    assert_eq!(t.version, 1);
    assert_eq!(at(&t), "summary_signed");
    w.clear_to_billing(adm).await;
    assert_eq!(at(&ticket(&w, adm).await), "billing_cleared");
    w.clear_billing(adm).await;
    let t = ticket(&w, adm).await;
    assert_eq!(at(&t), "finalize");
    let skipped: Vec<&str> = t
        .stops
        .iter()
        .filter(|s| s.state == "skipped")
        .map(|s| s.key.as_str())
        .collect();
    assert_eq!(skipped, ["tpa_clearance", "ms_signoff"]);

    // The settlement gate refuses through the flow exactly as it does direct.
    w.sql(&format!(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ('{}', 'billing', 'block_discharge_unsettled', 'true')",
        w.tenant
    ))
    .await;
    let direct_adm = w.admit(false).await;
    for a in [adm, direct_adm] {
        w.sql(&format!(
            "INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id, total_amount, \
             paid_amount, status) SELECT tenant_id, 'INV-' || gen_random_uuid(), patient_id, encounter_id, \
             500, 0, 'issued' FROM admissions WHERE id = '{a}'")).await;
    }
    let via_flow = engine::run(&w.state, &w.ward(), CODE, adm, &finalize())
        .await
        .unwrap_err();
    let direct = medbrains_ipd::discharge_patient(
        State(w.state.clone()),
        Extension(w.ward()),
        Path(direct_adm),
        Json(medbrains_ipd::DischargeRequest {
            discharge_type: "normal".to_owned(),
            discharge_summary: None,
        }),
    )
    .await
    .unwrap_err();
    assert_eq!(via_flow.to_string(), direct.to_string());

    // Settled, the same discharge goes through and the flow ends.
    w.sql(&format!(
        "UPDATE invoices SET paid_amount = total_amount WHERE encounter_id = \
                    (SELECT encounter_id FROM admissions WHERE id = '{adm}')"
    ))
    .await;
    let t = engine::run(&w.state, &w.ward(), CODE, adm, &finalize())
        .await
        .expect("discharged");
    assert_eq!(t.status, "completed");
    let status = w
        .scalar(&format!(
            "SELECT to_jsonb(status::text) FROM admissions WHERE id = '{adm}'"
        ))
        .await;
    assert_eq!(status, json!("discharged"));
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_failing_domain_action_holds_the_station_and_says_why() {
    let w = world().await;
    let adm = w.admit(false).await;
    engine::start(&w.state, &w.ward(), CODE, adm)
        .await
        .expect("start");
    w.clear_to_billing(adm).await;
    w.clear_billing(adm).await;
    w.sql(&format!(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ('{}', 'billing', 'block_discharge_unsettled', 'true')",
        w.tenant
    ))
    .await;
    w.sql(&format!(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id, total_amount, paid_amount, status) \
         SELECT tenant_id, 'INV-X', patient_id, encounter_id, 900, 100, 'issued' FROM admissions WHERE id = '{adm}'")).await;
    let err = engine::run(&w.state, &w.ward(), CODE, adm, &finalize())
        .await
        .unwrap_err();
    assert!(matches!(err, AppError::Conflict(_)), "{err}");
    let t = ticket(&w, adm).await;
    assert_eq!(at(&t), "finalize", "the flow did not advance");
    let reason = t.last_error.unwrap()["reason"].as_str().unwrap().to_owned();
    assert!(reason.contains("Outstanding balance"), "{reason}");
    let failed = w.scalar(&format!(
        "SELECT to_jsonb(COUNT(*)) FROM workflow_step_logs l JOIN workflow_instances i ON i.id = l.instance_id \
          WHERE i.subject_id = '{adm}' AND l.action = 'failed' AND l.step_name = 'finalize'")).await;
    assert_eq!(failed, json!(1));
    // The admission is untouched.
    let status = w
        .scalar(&format!(
            "SELECT to_jsonb(status::text) FROM admissions WHERE id = '{adm}'"
        ))
        .await;
    assert_eq!(status, json!("admitted"));
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn running_journeys_stay_on_their_version() {
    let w = world().await;
    let mut old = Vec::new();
    for _ in 0..3 {
        let adm = w.admit(true).await;
        let t = engine::start(&w.state, &w.ward(), CODE, adm)
            .await
            .expect("start");
        assert_eq!(t.version, 1);
        old.push(adm);
    }
    publish(&w, &switches(true)).await;
    let new = w.admit(true).await;
    assert_eq!(
        engine::start(&w.state, &w.ward(), CODE, new)
            .await
            .expect("start")
            .version,
        2
    );
    for adm in old.iter().copied().chain([new]) {
        w.clear_to_billing(adm).await;
        w.clear_billing(adm).await;
    }
    for adm in old {
        let t = ticket(&w, adm).await;
        assert_eq!(
            (t.version, at(&t).as_str()),
            (1, "finalize"),
            "v1 has no TPA station"
        );
    }
    let t = ticket(&w, new).await;
    assert_eq!((t.version, at(&t).as_str()), (2, "tpa_clearance"));
    let detail = catalog::detail(&w.state.db, &w.ward(), CODE)
        .await
        .expect("detail");
    let counts: Vec<(i32, i64)> = detail
        .in_flight
        .iter()
        .map(|v| (v.version, v.patients))
        .collect();
    assert_eq!(counts, [(1, 3), (2, 1)]);
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_patient_over_the_timetable_shows_overdue_with_the_time() {
    let w = world().await;
    let adm = w.admit(false).await;
    engine::start(&w.state, &w.ward(), CODE, adm)
        .await
        .expect("start");
    w.clear_to_billing(adm).await;
    w.sql(&format!(
        "UPDATE ipd_discharge_tat_log SET pharmacy_cleared_at = NULL WHERE admission_id = '{adm}'"
    ))
    .await;
    assert_eq!(at(&ticket(&w, adm).await), "pharmacy_returns");
    w.sql(&format!(
        "UPDATE workflow_step_logs SET started_at = now() - interval '2 hours' \
          WHERE step_name = 'pharmacy_returns' AND completed_at IS NULL AND instance_id = \
            (SELECT id FROM workflow_instances WHERE subject_id = '{adm}')"
    ))
    .await;
    let room = control_room::control_room(&w.state.db, &w.ward(), CODE)
        .await
        .expect("room");
    let pharmacy = room
        .stations
        .iter()
        .find(|s| s.key == "pharmacy_returns")
        .unwrap();
    assert_eq!(pharmacy.label, "overdue");
    assert_eq!(pharmacy.count, 1);
    assert!(pharmacy.longest_minutes.unwrap() >= 119);
    assert!(pharmacy.patients[0].overdue);
    let t = ticket(&w, adm).await;
    assert!(t.current.unwrap().overdue);
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn without_flows_view_nothing_is_served() {
    let w = world().await;
    let adm = w.admit(false).await;
    engine::start(&w.state, &w.ward(), CODE, adm)
        .await
        .expect("start");
    let nobody = claims(w.tenant, w.user("doctor", 0), "staff", &[]);
    assert!(matches!(
        catalog::list(&w.state.db, &nobody).await,
        Err(AppError::Forbidden)
    ));
    assert!(matches!(
        catalog::detail(&w.state.db, &nobody, CODE).await,
        Err(AppError::Forbidden)
    ));
    assert!(matches!(
        control_room::control_room(&w.state.db, &nobody, CODE).await,
        Err(AppError::Forbidden)
    ));
    assert!(matches!(
        engine::ticket(&w.state, &nobody, CODE, adm).await,
        Err(AppError::Forbidden)
    ));
    let switcher = claims(w.tenant, w.user("doctor", 0), "staff", &["flows.view"]);
    assert!(matches!(
        catalog::impact(&w.state.db, &switcher, CODE, &switches(true)).await,
        Err(AppError::Forbidden)
    ));
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_locked_signal_cannot_be_removed_in_preview() {
    let w = world().await;
    let qo = claims(
        w.tenant,
        w.user("quality_officer", 0),
        "quality_officer",
        &["flows.switch"],
    );
    let mut s = switches(false);
    s.insert("summary_signed".to_owned(), Value::Bool(false));
    let err = catalog::impact(&w.state.db, &qo, CODE, &s)
        .await
        .unwrap_err();
    assert!(err.to_string().contains("required safety signal"), "{err}");
    let report = catalog::impact(&w.state.db, &qo, CODE, &switches(true))
        .await
        .expect("impact");
    assert_eq!(
        report.route_changes,
        ["Route now stops at TPA clearance for insurance patients"]
    );
}

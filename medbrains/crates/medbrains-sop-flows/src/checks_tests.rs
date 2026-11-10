//! The six checks, each against a track that breaks exactly its rule.

#![allow(clippy::unwrap_used, clippy::expect_used, clippy::indexing_slicing)]

use std::collections::HashSet;

use medbrains_core::access::roles::BUILT_IN_ROLES;
use serde_json::{Value, json};

use super::*;
use crate::discharge;
use crate::model::{FlowDef, Station, StationKind};

fn built_in() -> Roles {
    BUILT_IN_ROLES
        .iter()
        .map(|r| {
            let perms = r
                .permissions
                .iter()
                .map(|p| (*p).to_owned())
                .collect::<HashSet<_>>();
            (r.code.to_owned(), Some(perms))
        })
        .collect()
}

fn library() -> (FlowDef, Vec<Station>) {
    let flow = discharge::flow();
    let track = flow.stations.clone();
    (flow, track)
}

fn failing(flow: &FlowDef, track: &[Station]) -> Vec<&'static str> {
    run(flow, track, Some(&built_in()), true)
        .into_iter()
        .filter(|c| !c.pass)
        .map(|c| c.rule)
        .collect()
}

fn at(track: &[Station], key: &str) -> usize {
    track.iter().position(|s| s.key == key).expect(key)
}

/// "Physiotherapy clearance" before billing for the orthopaedic department.
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
        holder: "Physiotherapy".to_owned(),
        holder_role: None,
        required_by: None,
        path: String::new(),
    }
}

#[test]
fn the_library_track_passes_every_check() {
    let (flow, track) = library();
    assert_eq!(failing(&flow, &track), Vec::<&str>::new());
}

#[test]
fn an_orthopaedic_physio_branch_before_billing_passes() {
    let (flow, mut track) = library();
    track.insert(at(&track, "billing_cleared"), physio());
    assert_eq!(failing(&flow, &track), Vec::<&str>::new());
    let ortho = paths(&flow, &track, Some(&crate::route::defaults(&flow)))
        .unwrap()
        .into_iter()
        .find(|p| p.combo.facts.get("department") == Some(&json!("ORTHO")))
        .unwrap();
    assert!(ortho.route.contains(&at(&track, "physio")));
}

#[test]
fn summary_signed_behind_a_branch_is_refused() {
    let (flow, mut track) = library();
    let i = at(&track, "summary_signed");
    track[i].fact_when = json!({ "is_insurance": true });
    let failed = failing(&flow, &track);
    assert!(failed.contains(&"invariants"), "{failed:?}");
    assert!(failed.contains(&"locked"), "{failed:?}");
    let inv = run(&flow, &track, Some(&built_in()), true).remove(0);
    assert!(
        inv.problems
            .iter()
            .any(|p| p.contains("without passing Summary signed"))
    );
    assert_eq!(
        inv.stations,
        ["finalize"],
        "the Discharge station is highlighted"
    );
}

#[test]
fn removing_summary_signed_is_refused() {
    let (flow, mut track) = library();
    track.remove(at(&track, "summary_signed"));
    let failed = failing(&flow, &track);
    assert!(
        failed.contains(&"invariants") && failed.contains(&"locked"),
        "{failed:?}"
    );
}

#[test]
fn moving_summary_signed_after_discharge_is_refused() {
    let (flow, mut track) = library();
    let s = track.remove(at(&track, "summary_signed"));
    track.insert(at(&track, "finalize") + 1, s);
    assert!(failing(&flow, &track).contains(&"invariants"));
}

#[test]
fn a_branch_that_bypasses_settlement_is_refused() {
    let (flow, mut track) = library();
    let i = at(&track, "billing_cleared");
    track[i].fact_when = json!({ "is_insurance": false });
    track[i].lane = Some("Cash".to_owned());
    let inv = run(&flow, &track, Some(&built_in()), true).remove(0);
    assert!(!inv.pass);
    assert!(
        inv.problems
            .iter()
            .any(|p| p.contains("Insurance (cashless) patient: yes")
                && p.contains("without passing Billing cleared")),
        "{:?}",
        inv.problems
    );
}

#[test]
fn medico_legal_patients_must_pass_the_police_intimation() {
    let (flow, mut track) = library();
    track.remove(at(&track, "mlc_intimation"));
    let inv = run(&flow, &track, Some(&built_in()), true).remove(0);
    assert!(
        inv.problems
            .iter()
            .any(|p| p.contains("Medico-legal case: yes") && p.contains("MLC police intimation"))
    );
    assert!(
        !inv.problems
            .iter()
            .any(|p| p.contains("Medico-legal case: no")),
        "only medico-legal patients need it"
    );
}

#[test]
fn a_dead_end_and_an_unreachable_station_are_refused() {
    let (flow, mut track) = library();
    track.pop();
    let ends = run(&flow, &track, Some(&built_in()), true).remove(2);
    assert!(
        !ends.pass
            && ends
                .problems
                .iter()
                .any(|p| p.contains("without reaching an end"))
    );

    let (flow, mut track) = library();
    let mut after = physio();
    after.key = "after_end".to_owned();
    after.fact_when = Value::Null;
    track.push(after);
    let ends = run(&flow, &track, Some(&built_in()), true).remove(2);
    assert!(!ends.pass);
    assert_eq!(ends.stations, ["after_end"]);
}

#[test]
fn an_always_false_condition_is_refused() {
    let (flow, mut track) = library();
    let mut never = physio();
    never.fact_when = json!({ "age_years": { "gt": 120, "lt": 10 } });
    track.insert(at(&track, "billing_cleared"), never);
    let cond = run(&flow, &track, Some(&built_in()), true).remove(3);
    assert!(!cond.pass);
    assert!(
        cond.problems.iter().any(|p| p.contains("never holds")),
        "{:?}",
        cond.problems
    );
    assert_eq!(cond.stations, ["physio"]);
}

#[test]
fn an_ill_typed_condition_is_refused() {
    let (flow, mut track) = library();
    let mut bad = physio();
    bad.fact_when = json!({ "department": { "gt": 3 } });
    track.insert(at(&track, "billing_cleared"), bad);
    assert!(failing(&flow, &track).contains(&"conditions"));
}

#[test]
fn a_holder_role_without_the_permission_is_refused() {
    let (flow, mut track) = library();
    let mut p = physio();
    p.holder_role = Some("receptionist".to_owned());
    track.insert(at(&track, "billing_cleared"), p);
    let staffed = run(&flow, &track, Some(&built_in()), true).remove(4);
    assert!(!staffed.pass);
    assert!(staffed.problems[0].contains("ipd.discharge.physio_clearance"));
    let mut roles = built_in();
    roles.remove("doctor");
    let (_, track) = library();
    assert_eq!(failing(&flow, &track), Vec::<&str>::new());
    assert!(
        !run(&flow, &track, Some(&roles), true)[4].pass,
        "a role the hospital does not have cannot hold a station"
    );
    assert!(
        !run(&flow, &track, None, true)[4].pass,
        "unknown roles never pass"
    );
}

#[test]
fn without_a_dry_run_the_draft_cannot_pass() {
    let (flow, track) = library();
    let checks = run(&flow, &track, Some(&built_in()), false);
    assert!(!all_pass(&checks));
    assert_eq!(
        checks
            .iter()
            .filter(|c| !c.pass)
            .map(|c| c.rule)
            .collect::<Vec<_>>(),
        ["dry_run"]
    );
}

#[test]
fn too_many_combinations_fail_instead_of_passing() {
    let (flow, mut track) = library();
    for n in 0..14 {
        let mut s = physio();
        s.key = format!("p{n}");
        s.fact_when = json!({ "age_years": { "gt": n * 7 }, "department": format!("D{n}") });
        track.insert(at(&track, "billing_cleared"), s);
    }
    let checks = run(&flow, &track, Some(&built_in()), true);
    for rule in ["invariants", "locked", "ends", "conditions"] {
        assert!(
            !checks.iter().find(|c| c.rule == rule).unwrap().pass,
            "{rule}"
        );
    }
}

#[test]
fn replay_skip_check_matches_the_invariant() {
    let (flow, track) = library();
    let combo = Combo {
        facts: json!({ "is_mlc": true, "is_insurance": false })
            .as_object()
            .cloned()
            .unwrap(),
        switches: crate::route::defaults(&flow),
    };
    assert!(!skips_required(&track, &combo));
    let mut no_mlc = track;
    no_mlc.remove(at(&no_mlc, "mlc_intimation"));
    assert!(skips_required(&no_mlc, &combo));
}

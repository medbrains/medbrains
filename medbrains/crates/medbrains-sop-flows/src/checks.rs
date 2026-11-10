//! The six checks a draft track must pass before it can be proposed (§11.2).
//!
//! Pure: the caller loads the tenant's roles; the server runs
//! these on every save, on dry run, and again — authoritatively — when a
//! change set carrying the track is created, previewed and applied.
//!
//! A track is a line of stations; a branch is a station only some patients
//! stop at (its fact and switch conditions). So a *path* is the route one
//! combination of facts and switch settings takes. The checks enumerate
//! every combination that can make a difference — each fact's values on
//! both sides of every threshold the track tests, every switch setting —
//! bounded by [`MAX_COMBINATIONS`], keep each distinct route once (a visited
//! set), and test each route. "Summary signed dominates Discharge" is then
//! exactly: on every route, it comes before Discharge.

use std::collections::{HashMap, HashSet};

use serde::Serialize;
use serde_json::Value;

use crate::blocks;
use crate::condition;
use crate::model::{FlowDef, Station, StationKind, SwitchKind};
use crate::paths::{Combo, MAX_COMBINATIONS, Path, describe_combo, paths, route_of};

/// What every path of a flow type must satisfy, declared in code.
#[derive(Debug)]
pub struct Invariants {
    /// The action every path must reach.
    pub action: &'static str,
    /// Signals every path must pass before it.
    pub before: &'static [&'static str],
    /// Signals a path must pass when a yes/no fact is yes (MLC).
    pub when: &'static [(&'static str, &'static str)],
}

/// Discharge: summary signed and billing settled on every path to Discharge;
/// medico-legal patients also pass the police intimation (RFC §11.2.1).
pub const DISCHARGE: Invariants = Invariants {
    action: "ipd.discharge.finalize",
    before: &["ipd.discharge_summary_signed", "ipd.billing_cleared"],
    when: &[("is_mlc", "mlc.police_intimated")],
};

/// One check's result, as the checks panel shows it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Check {
    /// `invariants`, `locked`, `ends`, `conditions`, `staffed`, `dry_run`.
    pub rule: &'static str,
    /// The rule as a sentence.
    pub sentence: String,
    pub pass: bool,
    /// What is wrong, one sentence each.
    pub problems: Vec<String>,
    /// Stations to highlight.
    pub stations: Vec<String>,
}

/// The tenant's roles and their permissions; `None` marks a bypass role.
pub type Roles = HashMap<String, Option<HashSet<String>>>;

fn holds(track: &[Station], route: &[usize], kind: &str, code: &str) -> Option<usize> {
    route.iter().position(|&i| {
        track
            .get(i)
            .is_some_and(|s| block_of(&s.kind) == Some((kind, code)))
    })
}

/// The registered block a station places: (kind, code).
#[must_use]
pub fn block_of(kind: &StationKind) -> Option<(&'static str, &str)> {
    match kind {
        StationKind::Action { action } => Some(("action", action)),
        StationKind::Task { task } => Some(("task", task)),
        StationKind::Signal { signal } => Some(("signal", signal)),
        StationKind::Switch { .. } | StationKind::End => None,
    }
}

fn block_name(kind: &str, code: &str) -> &'static str {
    blocks::block(kind, code).map_or("an unregistered block", |b| b.name)
}

fn check(
    rule: &'static str,
    sentence: &str,
    problems: Vec<String>,
    stations: Vec<String>,
) -> Check {
    Check {
        rule,
        sentence: sentence.to_owned(),
        pass: problems.is_empty(),
        problems,
        stations,
    }
}

fn invariants(track: &[Station], paths: &[Path]) -> Check {
    let inv = &DISCHARGE;
    let mut problems = Vec::new();
    let mut stations = Vec::new();
    for p in paths.iter().filter(|p| p.ends) {
        let who = describe_combo(&p.combo);
        let Some(at) = holds(track, &p.route, "action", inv.action) else {
            problems.push(format!("{who}: the route ends without reaching Discharge"));
            continue;
        };
        let required = inv.before.iter().copied().chain(
            inv.when
                .iter()
                .filter(|(f, _)| p.combo.facts.get(*f) == Some(&Value::Bool(true)))
                .map(|(_, s)| *s),
        );
        for signal in required {
            if holds(track, &p.route, "signal", signal).is_none_or(|i| i >= at) {
                problems.push(format!(
                    "{who}: reaches Discharge without passing {}",
                    block_name("signal", signal)
                ));
                stations.extend(
                    p.route
                        .get(at)
                        .and_then(|&i| track.get(i))
                        .map(|s| s.key.clone()),
                );
            }
        }
    }
    stations.sort();
    stations.dedup();
    check(
        "invariants",
        "Every path to Discharge passes Summary signed and Billing cleared; medico-legal patients also pass the police intimation",
        problems,
        stations,
    )
}

fn locked(flow: &FlowDef, track: &[Station], paths: &[Path]) -> Check {
    let mut problems = Vec::new();
    let mut stations = Vec::new();
    for lib in flow.stations.iter().filter(|s| s.locked) {
        let Some(block) = block_of(&lib.kind) else {
            continue;
        };
        let Some(idx) = track.iter().position(|s| block_of(&s.kind) == Some(block)) else {
            problems.push(format!(
                "{} is a required safety signal and was removed",
                lib.name
            ));
            continue;
        };
        let Some(s) = track.get(idx) else { continue };
        if !s.locked || !s.switch_when.is_null() || s.fact_when != lib.fact_when {
            problems.push(format!(
                "{} is required for {} and cannot be narrowed, unlocked or put behind a switch",
                lib.name,
                condition::audience(&lib.fact_when)
            ));
            stations.push(s.key.clone());
        }
        // It may move later, never past Discharge (the action every path needs).
        let late = paths.iter().any(|p| {
            let at = holds(track, &p.route, "action", DISCHARGE.action);
            let pos = p.route.iter().position(|&i| i == idx);
            matches!((at, pos), (Some(a), Some(q)) if q > a)
        });
        if late {
            problems.push(format!("{} has been moved after Discharge", lib.name));
            stations.push(s.key.clone());
        }
    }
    check(
        "locked",
        "Required safety signals are all still on the track, locked, and never bypassed",
        problems,
        stations,
    )
}

fn ends(track: &[Station], paths: &[Path]) -> Check {
    let mut problems = Vec::new();
    let mut stations = Vec::new();
    for p in paths.iter().filter(|p| !p.ends) {
        problems.push(format!(
            "{}: the route stops without reaching an end",
            describe_combo(&p.combo)
        ));
        stations.extend(
            p.route
                .last()
                .and_then(|&i| track.get(i))
                .map(|s| s.key.clone()),
        );
    }
    let reached: HashSet<usize> = paths.iter().flat_map(|p| p.route.iter().copied()).collect();
    for (i, s) in track.iter().enumerate() {
        let conditional = !s.fact_when.is_null() || !s.switch_when.is_null();
        if !reached.contains(&i) && !conditional {
            problems.push(format!("No patient can reach {}", s.name));
            stations.push(s.key.clone());
        }
    }
    check(
        "ends",
        "Every path ends, and every station can be reached (the track is a line, so it has no loops)",
        problems,
        stations,
    )
}

fn conditions(flow: &FlowDef, track: &[Station], paths: Option<&[Path]>) -> Check {
    let mut problems = Vec::new();
    let mut stations = Vec::new();
    let reached: HashSet<usize> = paths
        .unwrap_or_default()
        .iter()
        .flat_map(|p| p.route.iter().copied())
        .collect();
    for (i, s) in track.iter().enumerate() {
        let mut bad = |why: String| {
            problems.push(format!("{}: {why}", s.name));
            stations.push(s.key.clone());
        };
        if let Err(e) = condition::type_check(&s.fact_when) {
            bad(e);
            continue;
        }
        let unknown_switch = s
            .switch_when
            .as_object()
            .into_iter()
            .flatten()
            .find(|(k, v)| {
                !flow.switches.iter().any(|d| {
                    d.key.as_str() == k.as_str()
                        && match &d.kind {
                            SwitchKind::OnOff { .. } => v.is_boolean(),
                            SwitchKind::Choice { options, .. } => v
                                .as_str()
                                .is_some_and(|x| options.iter().any(|o| o.value == x)),
                        }
                })
            });
        if let Some((k, _)) = unknown_switch {
            bad(format!("\"{k}\" is not one of this flow's switch settings"));
        } else if !s.switch_when.is_null() && !s.switch_when.is_object() {
            bad("the switch condition is not readable".to_owned());
        } else if paths.is_some()
            && !reached.contains(&i)
            && (!s.fact_when.is_null() || !s.switch_when.is_null())
        {
            bad("its condition never holds for any patient".to_owned());
        }
    }
    if paths.is_none() {
        problems.push(format!(
            "The branches combine into more than {MAX_COMBINATIONS} cases; simplify them"
        ));
    }
    check(
        "conditions",
        "Every branch condition uses known facts and fits their type, none is always false, and patients who match no branch carry on along the main line",
        problems,
        stations,
    )
}

fn staffed(track: &[Station], roles: Option<&Roles>) -> Check {
    let mut problems = Vec::new();
    let mut stations = Vec::new();
    let Some(roles) = roles else {
        // Unknown is not a pass: say so and fail.
        return check(
            "staffed",
            "Every station's holder role exists in this hospital and has the permission it needs",
            vec!["The hospital's roles could not be read; try again".to_owned()],
            Vec::new(),
        );
    };
    for s in track {
        let Some((kind, code)) = block_of(&s.kind) else {
            continue;
        };
        let Some(b) = blocks::block(kind, code) else {
            problems.push(format!("{} is not a registered building block", s.name));
            stations.push(s.key.clone());
            continue;
        };
        let role = s.holder_role.as_deref().unwrap_or(b.role);
        let why = match roles.get(role) {
            None => Some(format!(
                "{}: the role \"{role}\" does not exist in this hospital",
                s.name
            )),
            Some(Some(perms)) if !perms.contains(b.permission) => Some(format!(
                "{}: the role \"{role}\" does not have the permission {}",
                s.name, b.permission
            )),
            Some(_) => None,
        };
        if let Some(why) = why {
            problems.push(why);
            stations.push(s.key.clone());
        }
    }
    check(
        "staffed",
        "Every station's holder role exists in this hospital and has the permission it needs",
        problems,
        stations,
    )
}

/// Run every check. `dry_run_current` is whether the server has dry-run
/// this exact revision.
#[must_use]
pub fn run(
    flow: &FlowDef,
    track: &[Station],
    roles: Option<&Roles>,
    dry_run_current: bool,
) -> Vec<Check> {
    let all = paths(flow, track, None);
    let none: &[Path] = &[];
    let p = all.as_deref().unwrap_or(none);
    // With no paths to look at, a path rule proves nothing: fail, never pass.
    let unproven = |mut c: Check| {
        if all.is_none() {
            c.pass = false;
            c.problems
                .push("Could not be checked: the branches combine into too many cases".to_owned());
        }
        c
    };
    vec![
        unproven(invariants(track, p)),
        unproven(locked(flow, track, p)),
        unproven(ends(track, p)),
        conditions(flow, track, all.as_deref()),
        staffed(track, roles),
        check(
            "dry_run",
            "A dry run of this draft has been run",
            if dry_run_current {
                Vec::new()
            } else {
                vec!["Run the test drive on this version of the draft".to_owned()]
            },
            Vec::new(),
        ),
    ]
}

/// Whether every check passed.
#[must_use]
pub fn all_pass(checks: &[Check]) -> bool {
    checks.iter().all(|c| c.pass)
}

/// Whether this one patient's route on `track` reaches Discharge without a
/// signal the flow type requires (for the what-if replay).
#[must_use]
pub fn skips_required(track: &[Station], combo: &Combo) -> bool {
    let (route, ends) = route_of(track, combo);
    let path = Path {
        combo: combo.clone(),
        route,
        ends: true,
    };
    !ends || !invariants(track, std::slice::from_ref(&path)).pass
}

#[cfg(test)]
#[path = "checks_tests.rs"]
mod tests;

//! Every route through a track: the combinations of facts and switch
//! settings that can make a difference, each distinct route kept once.
//!
//! A track is a line of stations; a branch is a station only some patients
//! stop at. So a path is the route one combination takes. Each fact is
//! tried on both sides of every threshold the track tests (and as "not
//! recorded"), every switch setting is tried, the total is capped at
//! [`MAX_COMBINATIONS`], and a visited set keeps each route once.

use std::collections::HashSet;

use serde_json::{Map, Value};

use crate::blocks::{self, FactType};
use crate::checks::{DISCHARGE, Invariants};
use crate::condition;
use crate::model::{FlowDef, Station, StationKind, SwitchKind, Switches};
use crate::route::on_patient_route;

/// Most fact/switch combinations a track may need checked. Beyond it the
/// track is too tangled to prove safe, and the checks say so.
pub const MAX_COMBINATIONS: usize = 4096;
/// A text fact's value no condition names ("another department").
pub const OTHER: &str = "(other)";

/// One combination of facts and switch settings.
#[derive(Debug, Clone)]
pub struct Combo {
    pub facts: Map<String, Value>,
    pub switches: Switches,
}

/// A distinct route with the first combination that takes it.
#[derive(Debug, Clone)]
pub struct Path {
    pub combo: Combo,
    /// Station indices, up to and including the first end.
    pub route: Vec<usize>,
    pub ends: bool,
}

/// The facts the track tests, plus the invariant's own.
fn tested_facts(track: &[Station], inv: &Invariants) -> Vec<String> {
    let mut keys: Vec<String> = inv.when.iter().map(|(f, _)| (*f).to_owned()).collect();
    for s in track {
        for f in condition::facts(&s.fact_when) {
            if !keys.contains(&f) {
                keys.push(f);
            }
        }
    }
    keys
}

/// The values worth trying for a fact: each side of every threshold.
fn domain(track: &[Station], key: &str) -> Vec<Value> {
    let Some(fact) = blocks::fact(key) else {
        return vec![Value::Null];
    };
    let lits: Vec<Value> = track
        .iter()
        .flat_map(|s| condition::literals(&s.fact_when, key))
        .collect();
    let mut out = match fact.ty {
        FactType::Bool => return vec![Value::Bool(true), Value::Bool(false)],
        FactType::Number => {
            let mut v = vec![Value::from(0)];
            for n in lits.iter().filter_map(Value::as_f64) {
                v.extend([n - 1.0, n, n + 1.0].map(Value::from));
            }
            v
        }
        FactType::Text => {
            let mut v: Vec<Value> = lits.into_iter().filter(Value::is_string).collect();
            v.push(Value::from(OTHER));
            v
        }
    };
    // Not recorded (no department on the admission, no date of birth).
    out.push(Value::Null);
    out.dedup();
    out
}

fn switch_domain(flow: &FlowDef) -> Vec<(String, Vec<Value>)> {
    flow.switches
        .iter()
        .map(|d| {
            let values = match &d.kind {
                SwitchKind::OnOff { .. } => vec![Value::Bool(true), Value::Bool(false)],
                SwitchKind::Choice { options, .. } => options
                    .iter()
                    .map(|o| Value::from(o.value.clone()))
                    .collect(),
            };
            (d.key.clone(), values)
        })
        .collect()
}

/// Every combination, or `None` when there are more than the cap.
fn combinations(axes: &[(String, Vec<Value>)]) -> Option<Vec<Map<String, Value>>> {
    let total = axes
        .iter()
        .try_fold(1usize, |n, (_, v)| n.checked_mul(v.len().max(1)))?;
    if total > MAX_COMBINATIONS {
        return None;
    }
    let mut out = vec![Map::new()];
    for (key, values) in axes {
        out = out
            .into_iter()
            .flat_map(|m| {
                values.iter().map(move |v| {
                    let mut m = m.clone();
                    m.insert(key.clone(), v.clone());
                    m
                })
            })
            .collect();
    }
    Some(out)
}

pub(crate) fn route_of(track: &[Station], combo: &Combo) -> (Vec<usize>, bool) {
    let facts = Value::Object(combo.facts.clone());
    let mut route = Vec::new();
    for (i, s) in track.iter().enumerate() {
        if on_patient_route(s, &combo.switches, &facts) {
            route.push(i);
            if s.kind == StationKind::End {
                return (route, true);
            }
        }
    }
    (route, false)
}

/// The distinct routes through the track, each with its first combination.
/// `switches` fixes the switch settings (a dry run); `None` tries them all.
/// `None` when the combinations exceed the cap.
#[must_use]
pub fn paths(flow: &FlowDef, track: &[Station], switches: Option<&Switches>) -> Option<Vec<Path>> {
    let fact_axes: Vec<(String, Vec<Value>)> = tested_facts(track, &DISCHARGE)
        .into_iter()
        .map(|k| {
            let d = domain(track, &k);
            (k, d)
        })
        .collect();
    let switch_axes = if switches.is_some() {
        Vec::new()
    } else {
        switch_domain(flow)
    };
    let mut axes = fact_axes.clone();
    axes.extend(switch_axes);
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for m in combinations(&axes)? {
        let (facts, sw): (Map<_, _>, Map<_, _>) = m
            .into_iter()
            .partition(|(k, _)| fact_axes.iter().any(|(f, _)| f == k));
        let combo = Combo {
            facts,
            switches: switches.cloned().unwrap_or(sw),
        };
        let (route, ends) = route_of(track, &combo);
        if seen.insert(route.clone()) {
            out.push(Path { combo, route, ends });
        }
    }
    Some(out)
}

/// Words for a combination: "Medico-legal case: yes, admitting department: ORTHO".
#[must_use]
pub fn describe_combo(combo: &Combo) -> String {
    let parts: Vec<String> = combo
        .facts
        .iter()
        .map(|(k, v)| {
            let label = blocks::fact(k).map_or(k.as_str(), |f| f.label);
            let v = match v {
                Value::Bool(true) => "yes".to_owned(),
                Value::Bool(false) => "no".to_owned(),
                Value::Null => "not recorded".to_owned(),
                Value::String(s) => s.clone(),
                other => other.to_string(),
            };
            format!("{label}: {v}")
        })
        .collect();
    if parts.is_empty() {
        "Any patient".to_owned()
    } else {
        parts.join(", ")
    }
}

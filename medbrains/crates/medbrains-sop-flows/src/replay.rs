//! What-if replay (RFC §5.2 #2, §11.2.6): the last 30 days of real
//! discharge journeys run through a draft track. Counts only what the
//! records hold; with too little history it says so instead of guessing.
//!
//! A journey's time on the draft is its real time, minus the real minutes
//! it spent at stations the draft drops, plus — for stations the draft adds
//! — the median minutes other patients spent there, or the station's
//! expected time when nobody has stopped there yet (and it says so).

use std::collections::HashMap;

use serde::Serialize;
use serde_json::{Map, Value};

use crate::checks;
use crate::model::{Station, Switches};
use crate::paths::Combo;
use crate::route::on_patient_route;

/// Fewer journeys than this and no time is estimated.
pub const MIN_HISTORY: usize = 5;
/// Most journeys replayed.
pub const MAX_JOURNEYS: i64 = 500;

/// One finished journey, as the records hold it.
#[derive(Debug)]
pub struct Journey {
    pub facts: Map<String, Value>,
    /// The station keys it actually cleared, in order (every stop on its
    /// route, junctions and the end included).
    pub cleared: Vec<String>,
    /// Minutes at each station it cleared.
    pub minutes: HashMap<String, i64>,
    /// Start to finish.
    pub total_minutes: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Replay {
    pub journeys: usize,
    pub route_differently: usize,
    pub skip_required: usize,
    /// `None` when there is not enough history to say.
    pub median_minutes_before: Option<i64>,
    pub median_minutes_after: Option<i64>,
    /// Some added station had no history, so its expected time was used.
    pub used_expected_times: bool,
    /// The result in plain sentences.
    pub sentences: Vec<String>,
}

#[must_use]
pub fn median(mut v: Vec<i64>) -> Option<i64> {
    if v.is_empty() {
        return None;
    }
    v.sort_unstable();
    let mid = v.len() / 2;
    let hi = *v.get(mid)?;
    Some(if v.len().is_multiple_of(2) {
        (v.get(mid - 1)? + hi) / 2
    } else {
        hi
    })
}

/// Median minutes per station key across the journeys.
fn station_medians(journeys: &[Journey]) -> HashMap<String, i64> {
    let mut by_key: HashMap<String, Vec<i64>> = HashMap::new();
    for j in journeys {
        for (k, m) in &j.minutes {
            by_key.entry(k.clone()).or_default().push(*m);
        }
    }
    by_key
        .into_iter()
        .filter_map(|(k, v)| median(v).map(|m| (k, m)))
        .collect()
}

/// "1 h 05 min", "40 min".
#[must_use]
pub fn duration(minutes: i64) -> String {
    let (h, m) = (minutes / 60, minutes % 60);
    if h > 0 {
        format!("{h} h {m:02} min")
    } else {
        format!("{m} min")
    }
}

fn people(n: usize) -> String {
    if n == 1 {
        "1 discharge".to_owned()
    } else {
        format!("{n} discharges")
    }
}

/// Replay `journeys` through `track` with the hospital's `switches`.
#[must_use]
pub fn replay(journeys: &[Journey], track: &[Station], switches: &Switches) -> Replay {
    let medians = station_medians(journeys);
    let mut used_expected = false;
    let mut differ = 0;
    let mut skips = 0;
    let mut before = Vec::with_capacity(journeys.len());
    let mut after = Vec::with_capacity(journeys.len());
    for j in journeys {
        let facts = Value::Object(j.facts.clone());
        let new: Vec<&Station> = track
            .iter()
            .filter(|s| on_patient_route(s, switches, &facts))
            .collect();
        let combo = Combo {
            facts: j.facts.clone(),
            switches: switches.clone(),
        };
        if checks::skips_required(track, &combo) {
            skips += 1;
        }
        let keys: Vec<&str> = new.iter().map(|s| s.key.as_str()).collect();
        if keys
            .iter()
            .copied()
            .ne(j.cleared.iter().map(String::as_str))
        {
            differ += 1;
        }
        let dropped: i64 = j
            .cleared
            .iter()
            .filter(|k| !keys.contains(&k.as_str()))
            .filter_map(|k| j.minutes.get(k))
            .sum();
        let added: i64 = new
            .iter()
            .filter(|s| !j.cleared.contains(&s.key))
            .map(|s| {
                medians.get(&s.key).copied().unwrap_or_else(|| {
                    used_expected |= s.sla_minutes.is_some();
                    s.sla_minutes.unwrap_or(0)
                })
            })
            .sum();
        before.push(j.total_minutes);
        after.push((j.total_minutes - dropped + added).max(0));
    }
    let n = journeys.len();
    let enough = n >= MIN_HISTORY;
    let (mb, ma) = if enough {
        (median(before), median(after))
    } else {
        (None, None)
    };
    let mut sentences = vec![if n == 0 {
        "No discharges were recorded by the flow in the last 30 days, so there is nothing to replay yet.".to_owned()
    } else {
        format!(
            "{} from the last 30 days were replayed through this draft.",
            people(n)
        )
    }];
    if n > 0 {
        sentences.push(format!("{} would route differently.", people(differ)));
    }
    match (mb, ma) {
        (Some(b), Some(a)) if a == b => sentences.push(format!(
            "Median discharge time would stay at {}.",
            duration(b)
        )),
        (Some(b), Some(a)) => sentences.push(format!(
            "Median discharge time would go from {} to {}{}.",
            duration(b),
            duration(a),
            if used_expected {
                " (new stations counted at their expected time)"
            } else {
                ""
            }
        )),
        _ if n > 0 => sentences.push(format!(
            "That is not enough history to estimate a time change (it needs at least {MIN_HISTORY})."
        )),
        _ => {}
    }
    if n > 0 {
        sentences.push(format!("{skips} would skip a required signal."));
    }
    Replay {
        journeys: n,
        route_differently: differ,
        skip_required: skips,
        median_minutes_before: mb,
        median_minutes_after: ma,
        used_expected_times: enough && used_expected,
        sentences,
    }
}

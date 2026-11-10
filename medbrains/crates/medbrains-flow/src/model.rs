//! The arithmetic of Flow, with no database in it: how source counts become a
//! zone's estimated people, how long a queue's wait is, when to recommend
//! another counter, and the play-forward forecast. Pure so it is unit-tested.
//!
//! Every count is an `Option`: `None` is "the source could not be read", and
//! it stays `None` through every sum it feeds. An outage must never read as an
//! empty hall.

use std::collections::HashMap;

use serde::Serialize;
use uuid::Uuid;

/// Minutes one token takes at one counter when the last half hour called too
/// few tokens to measure it. [inferred] — no published service time exists
/// for Indian billing or pharmacy counters; tune per site once data exists.
pub const DEFAULT_SERVICE_MINUTES: f64 = 3.0;
/// Calls in the last 30 minutes needed before the observed rate is trusted.
pub const MIN_CALLS_TO_MEASURE: i64 = 3;
/// The window the service rate and arrivals are measured over.
pub const WINDOW_MINUTES: f64 = 30.0;
/// Target wait when a zone has no team goal set. [inferred]
pub const DEFAULT_TARGET_WAIT_MINUTES: i32 = 15;
/// Most extra counters a single recommendation asks for.
pub const MAX_EXTRA_COUNTERS: i64 = 3;
/// Share of booked appointments that turn up. [inferred] — replace with the
/// tenant's own weekday show rate once `flow_zone_minute` has 4 weeks.
pub const SHOW_RATE: f64 = 0.85;
/// An alert clears once the zone falls below this share of its limit, so a
/// zone hovering at the line does not raise and clear every minute.
pub const RESOLVE_RATIO: f64 = 0.9;

/// One source the aggregator reads. Its name is what `unknown_sources` stores.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    Tokens,
    Appointments,
    Visitors,
    Roster,
}

impl Source {
    #[must_use]
    pub const fn name(self) -> &'static str {
        match self {
            Self::Tokens => "tokens",
            Self::Appointments => "appointments",
            Self::Visitors => "visitors",
            Self::Roster => "roster",
        }
    }
}

/// Today's tokens of one queue, grouped by counter. No token numbers, no names.
#[derive(Debug, Clone, Default, sqlx::FromRow)]
pub struct TokenRow {
    pub module: String,
    pub scope: String,
    pub scope_id: Option<Uuid>,
    pub counter_label: Option<String>,
    pub waiting: i64,
    pub called_30m: i64,
}

/// Where each department and token queue is counted.
#[derive(Debug, Default)]
pub struct ZoneMap {
    pub departments: HashMap<Uuid, Uuid>,
    /// `(module, Some(counter))` is one counter; `(module, None)` the whole queue.
    pub queues: HashMap<(String, Option<String>), Uuid>,
    /// Any location (a ward a visitor pass names) to the zone it sits in.
    pub locations: HashMap<Uuid, Uuid>,
}

impl ZoneMap {
    /// The zone a token row is counted in: its counter, then its queue, then
    /// its department. A token nobody mapped is counted nowhere.
    #[must_use]
    pub fn zone_of_token(&self, row: &TokenRow) -> Option<Uuid> {
        let counter = (row.module.clone(), row.counter_label.clone());
        let queue = (row.module.clone(), None);
        self.queues
            .get(&counter)
            .or_else(|| self.queues.get(&queue))
            .copied()
            .or_else(|| {
                (row.scope == "department")
                    .then_some(row.scope_id)
                    .flatten()
                    .and_then(|d| self.departments.get(&d).copied())
            })
    }
}

/// What each source said, or `None` when it could not be read.
#[derive(Debug, Default)]
pub struct Readings {
    pub tokens: Option<Vec<TokenRow>>,
    /// `(department_id, checked in and not yet seen)`
    pub checked_in: Option<Vec<(Uuid, i64)>>,
    /// `(location the pass names, visitors inside now)`
    pub visitors: Option<Vec<(Uuid, i64)>>,
    /// `(department_id, staff whose shift is on now)`
    pub staff: Option<Vec<(Uuid, i64)>>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CounterQueue {
    pub label: String,
    pub waiting: i64,
}

/// One zone, one minute. `None` = unknown.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ZoneMinute {
    pub people_est: Option<i32>,
    pub patients: Option<i32>,
    pub waiting: Option<i32>,
    pub checked_in: Option<i32>,
    pub visitors: Option<i32>,
    pub staff: Option<i32>,
    pub wait_minutes: Option<f64>,
    pub served_30m: Option<i32>,
    pub open_counters: Option<i32>,
    pub counters: Vec<CounterQueue>,
    pub unknown_sources: Vec<&'static str>,
}

fn sum_into(totals: &mut HashMap<Uuid, i64>, zone: Option<Uuid>, n: i64) {
    if let Some(zone) = zone {
        *totals.entry(zone).or_insert(0) += n;
    }
}

fn clamp_i32(n: i64) -> i32 {
    i32::try_from(n.max(0)).unwrap_or(i32::MAX)
}

/// A source's per-zone totals, or `None` for every zone when it failed.
fn per_zone<T>(
    rows: Option<&Vec<T>>,
    zone_of: impl Fn(&T) -> (Option<Uuid>, i64),
) -> Option<HashMap<Uuid, i64>> {
    rows.map(|rows| {
        let mut totals = HashMap::new();
        for row in rows {
            let (zone, n) = zone_of(row);
            sum_into(&mut totals, zone, n);
        }
        totals
    })
}

/// Minutes one token takes at one counter: observed when the last half hour
/// called enough tokens, otherwise the default.
#[must_use]
pub fn service_minutes(called_30m: i64, open_counters: i64) -> f64 {
    if called_30m >= MIN_CALLS_TO_MEASURE {
        WINDOW_MINUTES * open_counters.max(1) as f64 / called_30m as f64
    } else {
        DEFAULT_SERVICE_MINUTES
    }
}

/// How long a token joining now waits: the queue ahead, served by `counters`
/// counters at `service` minutes a token.
#[must_use]
pub fn queue_wait(waiting: i64, service: f64, counters: i64) -> f64 {
    let raw = waiting.max(0) as f64 * service / counters.max(1) as f64;
    (raw * 10.0).round() / 10.0
}

/// Every zone's minute from the readings. Zones absent from `zones` are skipped.
#[must_use]
pub fn zone_minutes(
    zones: &[(Uuid, f64)],
    map: &ZoneMap,
    readings: &Readings,
) -> HashMap<Uuid, ZoneMinute> {
    let waiting = per_zone(readings.tokens.as_ref(), |r| {
        (map.zone_of_token(r), r.waiting)
    });
    let called = per_zone(readings.tokens.as_ref(), |r| {
        (map.zone_of_token(r), r.called_30m)
    });
    let checked_in = per_zone(readings.checked_in.as_ref(), |(d, n)| {
        (map.departments.get(d).copied(), *n)
    });
    let visitors = per_zone(readings.visitors.as_ref(), |(l, n)| {
        (map.locations.get(l).copied(), *n)
    });
    let staff = per_zone(readings.staff.as_ref(), |(d, n)| {
        (map.departments.get(d).copied(), *n)
    });
    let counters = counters_by_zone(readings.tokens.as_ref(), map);

    let mut unknown = Vec::new();
    for (source, missing) in [
        (Source::Tokens, waiting.is_none()),
        (Source::Appointments, checked_in.is_none()),
        (Source::Visitors, visitors.is_none()),
        (Source::Roster, staff.is_none()),
    ] {
        if missing {
            unknown.push(source.name());
        }
    }

    let get = |m: &Option<HashMap<Uuid, i64>>, z: &Uuid| {
        m.as_ref().map(|m| m.get(z).copied().unwrap_or(0))
    };
    zones
        .iter()
        .map(|(zone, factor)| {
            let w = get(&waiting, zone);
            let c = get(&checked_in, zone);
            let v = get(&visitors, zone);
            let s = get(&staff, zone);
            let served = get(&called, zone);
            let zone_counters = counters
                .as_ref()
                .map(|m| m.get(zone).cloned().unwrap_or_default());
            let open = zone_counters
                .as_ref()
                .map(|(_, open)| *open)
                .filter(|_| w.is_some());
            // A checked-in patient usually also holds a token: count the
            // larger, never both. ponytail: max() undercounts a zone where
            // the two are different people; a visit-level join fixes it.
            let patients = w.zip(c).map(|(w, c)| w.max(c));
            let people = patients
                .zip(v)
                .zip(s)
                .map(|((p, v), s)| (p as f64 * factor).round() as i64 + v + s);
            let wait = w
                .zip(served)
                .zip(open)
                .map(|((w, served), open)| queue_wait(w, service_minutes(served, open), open));
            let minute = ZoneMinute {
                people_est: people.map(clamp_i32),
                patients: patients.map(clamp_i32),
                waiting: w.map(clamp_i32),
                checked_in: c.map(clamp_i32),
                visitors: v.map(clamp_i32),
                staff: s.map(clamp_i32),
                wait_minutes: wait,
                served_30m: served.map(clamp_i32),
                open_counters: open.map(clamp_i32),
                counters: zone_counters.map(|(c, _)| c).unwrap_or_default(),
                unknown_sources: unknown.clone(),
            };
            (*zone, minute)
        })
        .collect()
}

/// Per zone: each named counter's queue, and how many counters called in the
/// last 30 minutes (at least 1 while anyone waits).
fn counters_by_zone(
    tokens: Option<&Vec<TokenRow>>,
    map: &ZoneMap,
) -> Option<HashMap<Uuid, (Vec<CounterQueue>, i64)>> {
    let tokens = tokens?;
    let mut out: HashMap<Uuid, (Vec<CounterQueue>, i64)> = HashMap::new();
    for row in tokens {
        let Some(zone) = map.zone_of_token(row) else {
            continue;
        };
        let entry = out.entry(zone).or_default();
        if let Some(label) = &row.counter_label {
            if row.called_30m > 0 {
                entry.1 += 1;
            }
            match entry.0.iter_mut().find(|c| &c.label == label) {
                Some(c) => c.waiting += row.waiting,
                None => entry.0.push(CounterQueue {
                    label: label.clone(),
                    waiting: row.waiting,
                }),
            }
        }
    }
    for (counters, open) in out.values_mut() {
        *open = (*open).max(1);
        counters.sort_by(|a, b| a.label.cmp(&b.label));
    }
    Some(out)
}

/// "Open another counter: est. wait 22 -> 9 min".
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CounterAdvice {
    pub counters_open: i64,
    pub counters_suggested: i64,
    pub wait_before: f64,
    pub wait_after: f64,
    pub target: i32,
}

/// Recommend the fewest extra counters (up to [`MAX_EXTRA_COUNTERS`]) that
/// bring the wait to target, or `None` while the wait is already on target.
#[must_use]
pub fn recommend_counters(
    waiting: i64,
    service: f64,
    open: i64,
    target: i32,
) -> Option<CounterAdvice> {
    let open = open.max(1);
    let before = queue_wait(waiting, service, open);
    if before <= f64::from(target) {
        return None;
    }
    let suggested = (open + 1..=open + MAX_EXTRA_COUNTERS)
        .find(|n| queue_wait(waiting, service, *n) <= f64::from(target))
        .unwrap_or(open + MAX_EXTRA_COUNTERS);
    Some(CounterAdvice {
        counters_open: open,
        counters_suggested: suggested,
        wait_before: before,
        wait_after: queue_wait(waiting, service, suggested),
        target,
    })
}

/// The alert a zone has reached and the limit it passed: capacity outranks
/// comfort.
#[must_use]
pub fn alert_level(
    people: i32,
    comfort: Option<i32>,
    capacity: Option<i32>,
) -> Option<(&'static str, i32)> {
    match (comfort, capacity) {
        (_, Some(cap)) if people > cap => Some(("capacity", cap)),
        (Some(limit), _) if people > limit => Some(("comfort", limit)),
        _ => None,
    }
}

/// Whether an open alert at `limit` has cleared.
#[must_use]
pub fn alert_cleared(people: i32, limit: i32) -> bool {
    f64::from(people) < f64::from(limit) * RESOLVE_RATIO
}

/// One 15-minute step of the play-forward.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ForecastInput {
    /// Same-weekday average estimate at this time, last 4 weeks.
    pub history_avg: Option<f64>,
    /// Appointments booked from this step to an hour after it.
    pub booked_next_hour: i64,
}

/// Expected people at one step: the usual crowd at this time on this weekday
/// (or now, with no history), and never fewer than the patients booked in the
/// hour ahead who are expected to come, with their attendants. Seasonal-naive
/// plus appointments, per the brief; a model only if this misses by >20%.
#[must_use]
pub fn forecast_people(now: Option<i32>, step: ForecastInput, factor: f64) -> Option<i32> {
    let base = step.history_avg.or_else(|| now.map(f64::from));
    let booked = step.booked_next_hour as f64 * SHOW_RATE * factor;
    let people = match base {
        Some(base) => base.max(booked),
        None if step.booked_next_hour > 0 => booked,
        None => return None,
    };
    Some(clamp_i32(people.round() as i64))
}

/// What the inspect drawer knows about a zone, to say why it is red.
#[derive(Debug, Clone, Default)]
pub struct ZoneFacts {
    pub people: Option<i32>,
    pub comfort_limit: Option<i32>,
    pub capacity: Option<i32>,
    pub waiting: Option<i32>,
    pub wait_minutes: Option<f64>,
    pub target_minutes: i32,
    pub open_counters: Option<i32>,
    pub served_30m: Option<i32>,
    pub staff: Option<i32>,
    pub booked_next_hour: Option<i64>,
    pub unknown_sources: Vec<String>,
}

/// Plain reasons, worst first. Each names its numbers so a supervisor can
/// check it against the floor.
#[must_use]
pub fn why_red(f: &ZoneFacts) -> Vec<String> {
    let mut out = Vec::new();
    if !f.unknown_sources.is_empty() {
        out.push(format!(
            "Could not read {} this minute, so the counts that depend on it are unknown.",
            f.unknown_sources.join(", ")
        ));
    }
    if let Some(p) = f.people {
        match alert_level(p, f.comfort_limit, f.capacity) {
            Some(("capacity", cap)) => {
                out.push(format!("About {p} people, over the capacity of {cap}."));
            }
            Some((_, limit)) => out.push(format!(
                "About {p} people, over the comfort limit of {limit}."
            )),
            None => {}
        }
    }
    if let (Some(w), Some(waiting), Some(open)) = (f.wait_minutes, f.waiting, f.open_counters)
        && w > f64::from(f.target_minutes)
    {
        out.push(format!(
            "Wait about {w:.0} min against a target of {} min: {waiting} waiting for {open} open counter(s).",
            f.target_minutes
        ));
    }
    if f.served_30m == Some(0) && f.waiting.is_some_and(|w| w > 0) {
        out.push("No token has been called here in the last 30 minutes.".to_owned());
    }
    if let Some(booked) = f.booked_next_hour.filter(|b| *b > 0) {
        out.push(format!(
            "{booked} more patients are booked in the next hour."
        ));
    }
    if f.staff == Some(0) && f.waiting.is_some_and(|w| w > 0) {
        out.push("Nobody is rostered on duty here right now.".to_owned());
    }
    out
}

#[cfg(test)]
#[path = "model_tests.rs"]
mod tests;

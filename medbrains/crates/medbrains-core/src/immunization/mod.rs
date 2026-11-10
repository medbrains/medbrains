//! Childhood immunisation schedules: which dose is due, overdue or no longer
//! given, from the date of birth and the doses recorded.
//!
//! A recorded dose counts towards a series only when it was given at or
//! after the dose's minimum age and minimum interval (less a 4-day grace, as
//! WHO and ACIP allow) and before its maximum age. A dose that does not count
//! is shown with the reason -- it is never silently dropped, and never
//! silently counted.

pub mod products;
pub mod schedules;
#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used)]
mod tests;

use chrono::{Duration, NaiveDate};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use products::{Antigen, Product};
use schedules::{DoseRule, IAP, Series, UIP};

/// Days a dose may fall short of a minimum age or interval and still count.
pub const GRACE_DAYS: i64 = 4;
/// Days past the due date after which a dose is overdue rather than due.
pub const OVERDUE_AFTER_DAYS: i64 = 28;
const AGE_LIMIT: &str = "given after the age it is given until";

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScheduleKind {
    /// MoHFW Universal Immunization Programme.
    #[default]
    Uip,
    /// Indian Academy of Pediatrics (ACVIP) recommended schedule.
    Iap,
}

/// A hospital's choice (`tenant_settings` immunization/schedule).
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct ScheduleOptions {
    #[serde(default)]
    pub kind: ScheduleKind,
    /// JE is given in endemic districts only.
    #[serde(default)]
    pub include_je: bool,
}

impl ScheduleOptions {
    pub fn series(&self) -> impl Iterator<Item = &'static Series> + '_ {
        let all = match self.kind {
            ScheduleKind::Uip => UIP,
            ScheduleKind::Iap => IAP,
        };
        all.iter().filter(move |s| !s.optional || self.include_je)
    }
}

/// A dose on the patient's record.
#[derive(Debug, Clone)]
pub struct RecordedDose {
    pub id: Uuid,
    pub given_on: NaiveDate,
    pub vaccine_key: Option<String>,
    pub vaccine_name: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DoseState {
    Given,
    /// Recorded, but given too early, too soon, or too late to count.
    NotCounted,
    Upcoming,
    Due,
    Overdue,
    /// Past the age it is given at: no longer offered.
    AgePassed,
}

#[derive(Debug, Clone, Serialize)]
pub struct DoseStatus {
    pub label: &'static str,
    pub state: DoseState,
    /// The date given, or the date due.
    pub date: NaiveDate,
    /// The earliest date it may be given.
    pub earliest: Option<NaiveDate>,
    /// The last date it is still given.
    pub latest: Option<NaiveDate>,
    pub reason: Option<String>,
    pub dose_id: Option<Uuid>,
    /// The product to record it as.
    pub product_key: &'static str,
    pub product_name: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct SeriesStatus {
    pub key: &'static str,
    pub name: &'static str,
    pub note: &'static str,
    pub doses: Vec<DoseStatus>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Unmatched {
    pub dose_id: Uuid,
    pub given_on: NaiveDate,
    pub vaccine_name: String,
    pub reason: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScheduleView {
    pub kind: ScheduleKind,
    pub series: Vec<SeriesStatus>,
    /// Recorded doses no series could use.
    pub unmatched: Vec<Unmatched>,
}

struct Track {
    series: &'static Series,
    counted: usize,
    last: Option<NaiveDate>,
    doses: Vec<DoseStatus>,
}

impl Track {
    fn next_rule(&self) -> Option<&'static DoseRule> {
        self.series.doses.get(self.counted)
    }

    fn covers(&self, p: &Product) -> bool {
        let has_all = self.series.needs.iter().all(|a| p.antigens.contains(a));
        has_all && (!self.series.exact || p.antigens.len() == self.series.needs.len())
    }

    /// Why `on` cannot count as the next dose, or `None` when it can.
    fn refuses(&self, dob: NaiveDate, on: NaiveDate) -> Option<String> {
        let rule = self.next_rule()?;
        let age = (on - dob).num_days();
        if age < rule.min_age - GRACE_DAYS {
            return Some(format!(
                "{}: given at {age} days, before the minimum age of {} days",
                rule.label, rule.min_age
            ));
        }
        if rule.max_age.is_some_and(|m| age > m) {
            return Some(format!("{}: {AGE_LIMIT}", rule.label));
        }
        if let Some(last) = self.last {
            let gap = (on - last).num_days();
            if gap < rule.min_interval - GRACE_DAYS {
                return Some(format!(
                    "{}: given {gap} days after the previous dose; at least {} are needed",
                    rule.label, rule.min_interval
                ));
            }
        }
        None
    }
}

/// The child's schedule as of `today`.
pub fn evaluate(
    opts: ScheduleOptions,
    dob: NaiveDate,
    doses: &[RecordedDose],
    today: NaiveDate,
) -> ScheduleView {
    let mut tracks: Vec<Track> = opts
        .series()
        .map(|s| Track {
            series: s,
            counted: 0,
            last: None,
            doses: Vec::new(),
        })
        .collect();
    let mut unmatched = Vec::new();
    let mut sorted: Vec<&RecordedDose> = doses.iter().collect();
    sorted.sort_by_key(|d| d.given_on);
    for dose in sorted {
        let Some(product) = products::identify(dose.vaccine_key.as_deref(), &dose.vaccine_name)
        else {
            unmatched.push(Unmatched {
                dose_id: dose.id,
                given_on: dose.given_on,
                vaccine_name: dose.vaccine_name.clone(),
                reason: "not a vaccine this schedule recognises",
            });
            continue;
        };
        allocate(&mut tracks, dob, dose, product, &mut unmatched);
    }
    let series = tracks.into_iter().map(|t| finish(t, dob, today)).collect();
    ScheduleView {
        kind: opts.kind,
        series,
        unmatched,
    }
}

/// Count `dose` towards every series it can serve -- once per antigen, so a
/// hexavalent dose is DTP, Hib, hepatitis B and IPV, but one OPV dose is not
/// both the birth dose and OPV-1.
fn allocate(
    tracks: &mut [Track],
    dob: NaiveDate,
    dose: &RecordedDose,
    product: &'static Product,
    unmatched: &mut Vec<Unmatched>,
) {
    let mut used: Vec<Antigen> = Vec::new();
    let mut first_refusal: Option<(usize, String)> = None;
    for (i, t) in tracks.iter_mut().enumerate() {
        if !t.covers(product)
            || t.series.needs.iter().any(|a| used.contains(a))
            || t.next_rule().is_none()
        {
            continue;
        }
        match t.refuses(dob, dose.given_on) {
            None => {
                let rule = t.series.doses[t.counted];
                t.doses
                    .push(given(rule, dose, product, DoseState::Given, None));
                t.counted += 1;
                t.last = Some(dose.given_on);
                used.extend_from_slice(t.series.needs);
            }
            // Prefer a reason about this dose being early or close to the
            // last one over "too old for" another series it might have been.
            Some(why) => match &first_refusal {
                Some((_, prior)) if !prior.ends_with(AGE_LIMIT) => {}
                Some(_) if why.ends_with(AGE_LIMIT) => {}
                _ => first_refusal = Some((i, why)),
            },
        }
    }
    if !used.is_empty() {
        return;
    }
    match first_refusal {
        Some((i, why)) => {
            let rule = tracks[i].series.doses[tracks[i].counted];
            tracks[i]
                .doses
                .push(given(rule, dose, product, DoseState::NotCounted, Some(why)));
        }
        None => unmatched.push(Unmatched {
            dose_id: dose.id,
            given_on: dose.given_on,
            vaccine_name: dose.vaccine_name.clone(),
            reason: "an extra dose, or not part of this schedule",
        }),
    }
}

fn given(
    rule: DoseRule,
    dose: &RecordedDose,
    product: &'static Product,
    state: DoseState,
    reason: Option<String>,
) -> DoseStatus {
    DoseStatus {
        label: rule.label,
        state,
        date: dose.given_on,
        earliest: None,
        latest: None,
        reason,
        dose_id: Some(dose.id),
        product_key: product.key,
        product_name: product.name,
    }
}

/// Add the doses still to come, each after the one before it.
fn finish(mut t: Track, dob: NaiveDate, today: NaiveDate) -> SeriesStatus {
    let mut prev = t.last;
    let mut closed = false;
    for (i, rule) in t.series.doses.iter().enumerate().skip(t.counted) {
        let at = |days: i64| dob + Duration::days(days);
        let earliest = prev.map_or(at(rule.min_age), |p| {
            at(rule.min_age).max(p + Duration::days(rule.min_interval))
        });
        let due = at(rule.due_age).max(earliest);
        let latest = rule.max_age.map(at);
        let past = latest.is_some_and(|l| l < today.max(earliest));
        closed |= past;
        let state = if closed {
            DoseState::AgePassed
        } else if i > t.counted || today < due {
            DoseState::Upcoming
        } else if (today - due).num_days() <= OVERDUE_AFTER_DAYS {
            DoseState::Due
        } else {
            DoseState::Overdue
        };
        let product = products::by_key(rule.product);
        t.doses.push(DoseStatus {
            label: rule.label,
            state,
            date: due,
            earliest: Some(earliest),
            latest,
            reason: None,
            dose_id: None,
            product_key: rule.product,
            product_name: product.map_or(rule.product, |p| p.name),
        });
        // The next dose can come no sooner than this one, given today at the earliest.
        prev = Some(due.max(today));
    }
    SeriesStatus {
        key: t.series.key,
        name: t.series.name,
        note: t.series.note,
        doses: t.doses,
    }
}

//! The patient companion's decisions.
//!
//! Whether it is open at all, what a band is doing, and the daily brief.
//! Wellness only — every sentence produced here is an observation about what
//! happened, never an instruction about what to do next
//! (RFC-MODULE-patient-companion §3). The verdict vocabulary is a closed set
//! for that reason.

/// Whether the companion is open, and why.
///
/// Hidden is the default and the fallback: every unknown resolves to hidden,
/// including a fault, because a companion that fails open appears for a whole
/// tenant that never licensed it. Hospital first because that is the answer a
/// support call needs.
#[must_use]
pub fn companion_access(licensed_by_hospital: Option<bool>, band_paired: Option<bool>, purchased: Option<bool>) -> Option<&'static str> {
    if licensed_by_hospital == Some(true) {
        Some("hospital")
    } else if band_paired == Some(true) {
        Some("band")
    } else if purchased == Some(true) {
        Some("purchase")
    } else {
        None
    }
}

/// A band that has said nothing for this long is stale, not connected.
pub const STALE_AFTER_HOURS: i64 = 36;

/// `reporting`, `stale` or `never_synced`. "Connected" and "reporting" are
/// different facts, and a band silent for weeks must not show green.
#[must_use]
pub fn band_state(last_synced_unix: Option<i64>, now_unix: i64) -> &'static str {
    match last_synced_unix {
        None => "never_synced",
        Some(t) if now_unix - t > STALE_AFTER_HOURS * 3600 => "stale",
        Some(_) => "reporting",
    }
}

/// Plain words, never a claim the band is fine when it is silent.
#[must_use]
pub fn describe_band_state(state: &str) -> &'static str {
    match state {
        "reporting" => "Reporting",
        "stale" => "No data recently",
        _ => "Paired, nothing received yet",
    }
}

/// A medication plan as the phone stores it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MedicationPlan {
    pub id: String,
    pub name: String,
    pub instructions: String,
    /// Local times of day, `HH:MM`.
    pub times: Vec<String>,
    /// `YYYY-MM-DD`.
    pub started_on: String,
    pub ends_on: Option<String>,
}

/// One "I took it" / "I missed it" against a scheduled slot (ISO instant).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdherenceEvent {
    pub plan_id: String,
    pub scheduled_for: String,
    /// `taken`, `skipped` or `missed`.
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DoseSlot {
    pub plan_id: String,
    pub name: String,
    pub instructions: String,
    pub time: String,
    pub scheduled_for: String,
    /// The answer given, or `due`.
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DailyBrief {
    pub slots: Vec<DoseSlot>,
    /// Whole percent taken over the trailing week; `None` when nothing was scheduled, which is not 0%.
    pub adherence_percent: Option<u32>,
    /// Consecutive complete days ending yesterday.
    pub streak_days: u32,
    /// `calibrating`, `building` or `established`.
    pub confidence: String,
    /// From the closed set. Never an instruction.
    pub verdict: String,
}

const MAX_SLOTS: usize = 50;
const ADHERENCE_WINDOW_DAYS: i64 = 7;
const CALIBRATING_BELOW_DAYS: i64 = 7;
const ESTABLISHED_FROM_DAYS: i64 = 28;
const DAY: i64 = 86_400;

fn day_key(iso: &str) -> &str {
    iso.get(..10).unwrap_or(iso)
}

/// Days since the epoch for a `YYYY-MM-DD` prefix, for arithmetic without a calendar crate.
fn days_from_civil(iso: &str) -> Option<i64> {
    let y: i64 = iso.get(0..4)?.parse().ok()?;
    let m: i64 = iso.get(5..7)?.parse().ok()?;
    let d: i64 = iso.get(8..10)?.parse().ok()?;
    let (y, m) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let doy = (153 * m + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146_097 + doe - 719_468)
}

fn civil_from_days(z: i64) -> String {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{y:04}-{m:02}-{d:02}")
}

fn today_of(now_unix: i64) -> String {
    civil_from_days(now_unix.div_euclid(DAY))
}

/// Percent of scheduled doses taken in the trailing window; `None` when nothing was scheduled.
#[must_use]
pub fn adherence_over(adherence: &[AdherenceEvent], now_unix: i64, days: i64) -> Option<u32> {
    let to = today_of(now_unix);
    let from = today_of(now_unix - days * DAY);
    let (mut scheduled, mut taken) = (0u32, 0u32);
    for e in adherence {
        let day = day_key(&e.scheduled_for);
        if day < from.as_str() || day > to.as_str() {
            continue;
        }
        scheduled += 1;
        if e.status == "taken" {
            taken += 1;
        }
    }
    (scheduled > 0).then(|| ((f64::from(taken) / f64::from(scheduled)) * 100.0).round() as u32)
}

/// Consecutive complete days ending YESTERDAY, so a streak does not break every evening.
#[must_use]
pub fn streak_ending_yesterday(adherence: &[AdherenceEvent], now_unix: i64) -> u32 {
    let mut by_day: std::collections::HashMap<&str, (u32, u32)> = std::collections::HashMap::new();
    for e in adherence {
        let b = by_day.entry(day_key(&e.scheduled_for)).or_default();
        b.0 += 1;
        if e.status == "taken" {
            b.1 += 1;
        }
    }
    let mut streak = 0;
    for back in 1..=365 {
        let day = today_of(now_unix - back * DAY);
        match by_day.get(day.as_str()) {
            Some(&(scheduled, taken)) if scheduled > 0 && taken >= scheduled => streak += 1,
            _ => break,
        }
    }
    streak
}

/// Days between the earliest thing known and now, in words the person can trust.
#[must_use]
pub fn confidence_from(adherence: &[AdherenceEvent], observation_days: &[String], now_unix: i64) -> String {
    let earliest = adherence
        .iter()
        .map(|e| day_key(&e.scheduled_for).to_owned())
        .chain(observation_days.iter().map(|d| day_key(d).to_owned()))
        .min();
    let Some(earliest) = earliest else { return "calibrating".to_owned() };
    let Some(start) = days_from_civil(&earliest) else { return "calibrating".to_owned() };
    let days = now_unix.div_euclid(DAY) - start;
    if days < CALIBRATING_BELOW_DAYS {
        "calibrating".to_owned()
    } else if days >= ESTABLISHED_FROM_DAYS {
        "established".to_owned()
    } else {
        "building".to_owned()
    }
}

fn verdict_for(slots: &[DoseSlot], adherence: Option<u32>) -> String {
    if slots.is_empty() {
        return "Nothing scheduled today.".to_owned();
    }
    let remaining = slots.iter().filter(|s| s.status == "due").count();
    if remaining == 0 {
        return "Everything scheduled for today is marked done.".to_owned();
    }
    if let Some(a) = adherence.filter(|&a| a >= 80) {
        return format!("{remaining} left today. You are at {a}% this week.");
    }
    if remaining == 1 { "1 dose left today.".to_owned() } else { format!("{remaining} doses left today.") }
}

/// The brief for the day `now_unix` falls on (UTC civil day, as the phone stores slots).
#[must_use]
pub fn daily_brief(medications: &[MedicationPlan], adherence: &[AdherenceEvent], observation_days: &[String], now_unix: i64) -> DailyBrief {
    let today = today_of(now_unix);
    let answered: std::collections::HashMap<String, &str> =
        adherence.iter().map(|e| (format!("{}@{}", e.plan_id, e.scheduled_for), e.status.as_str())).collect();
    let mut slots = Vec::new();
    for plan in medications {
        if day_key(&plan.started_on) > today.as_str() || plan.ends_on.as_deref().is_some_and(|e| day_key(e) < today.as_str()) {
            continue;
        }
        for time in &plan.times {
            let scheduled_for = format!("{today}T{}{}.000Z", time, if time.len() == 5 { ":00" } else { "" });
            let status = answered.get(&format!("{}@{scheduled_for}", plan.id)).map_or("due", |s| s).to_owned();
            slots.push(DoseSlot { plan_id: plan.id.clone(), name: plan.name.clone(), instructions: plan.instructions.clone(), time: time.clone(), scheduled_for, status });
        }
    }
    slots.sort_by(|a, b| a.time.cmp(&b.time));
    slots.truncate(MAX_SLOTS);
    let adherence_percent = adherence_over(adherence, now_unix, ADHERENCE_WINDOW_DAYS);
    let verdict = verdict_for(&slots, adherence_percent);
    DailyBrief {
        slots,
        adherence_percent,
        streak_days: streak_ending_yesterday(adherence, now_unix),
        confidence: confidence_from(adherence, observation_days, now_unix),
        verdict,
    }
}

#[cfg(test)]
mod tests {
    use super::{AdherenceEvent, MedicationPlan, adherence_over, band_state, companion_access, confidence_from, daily_brief, streak_ending_yesterday};

    const NOW: i64 = 1_781_514_000; // 2026-06-15T09:00:00Z

    fn plan() -> MedicationPlan {
        MedicationPlan { id: "p1".into(), name: "Metformin 500".into(), instructions: "after food".into(), times: vec!["08:00".into(), "20:00".into()], started_on: "2026-01-01".into(), ends_on: None }
    }
    fn dose(day: &str, time: &str, status: &str) -> AdherenceEvent {
        AdherenceEvent { plan_id: "p1".into(), scheduled_for: format!("{day}T{time}:00.000Z"), status: status.into() }
    }

    #[test]
    fn hidden_unless_somebody_said_yes() {
        assert_eq!(companion_access(None, None, None), None);
        assert_eq!(companion_access(Some(false), Some(false), Some(false)), None);
        assert_eq!(companion_access(Some(true), None, None), Some("hospital"));
        assert_eq!(companion_access(Some(false), Some(true), None), Some("band"));
        assert_eq!(companion_access(None, None, Some(true)), Some("purchase"));
        assert_eq!(companion_access(Some(true), Some(true), Some(true)), Some("hospital"));
    }

    #[test]
    fn a_silent_band_is_not_connected() {
        assert_eq!(band_state(None, NOW), "never_synced");
        assert_eq!(band_state(Some(NOW - 3600), NOW), "reporting");
        assert_eq!(band_state(Some(NOW - 40 * 3600), NOW), "stale");
    }

    #[test]
    fn lists_todays_doses_in_time_order_marking_unanswered_due() {
        let b = daily_brief(&[plan()], &[], &[], NOW);
        assert_eq!(b.slots.iter().map(|s| s.time.as_str()).collect::<Vec<_>>(), vec!["08:00", "20:00"]);
        assert!(b.slots.iter().all(|s| s.status == "due"));
    }

    #[test]
    fn carries_an_answer_already_given() {
        let b = daily_brief(&[plan()], &[dose("2026-06-15", "08:00", "taken")], &[], NOW);
        assert_eq!(b.slots[0].status, "taken");
        assert_eq!(b.slots[1].status, "due");
    }

    #[test]
    fn omits_a_plan_not_started_or_ended() {
        let future = MedicationPlan { id: "later".into(), started_on: "2026-12-01".into(), ..plan() };
        let finished = MedicationPlan { id: "done".into(), ends_on: Some("2026-02-01".into()), ..plan() };
        assert!(daily_brief(&[future, finished], &[], &[], NOW).slots.is_empty());
    }

    #[test]
    fn nothing_scheduled_reads_as_null_not_zero() {
        let b = daily_brief(&[], &[], &[], NOW);
        assert_eq!(b.verdict, "Nothing scheduled today.");
        assert_eq!(b.adherence_percent, None);
        assert_eq!(adherence_over(&[], NOW, 7), None);
    }

    #[test]
    fn adherence_counts_inside_the_window_only() {
        let a = [dose("2026-06-14", "08:00", "taken"), dose("2026-06-14", "20:00", "missed"), dose("2026-01-01", "08:00", "missed")];
        assert_eq!(adherence_over(&a, NOW, 7), Some(50));
    }

    #[test]
    fn streak_counts_back_from_yesterday_not_today() {
        let a = [dose("2026-06-14", "08:00", "taken"), dose("2026-06-13", "08:00", "taken"), dose("2026-06-12", "08:00", "missed")];
        assert_eq!(streak_ending_yesterday(&a, NOW), 2);
        let b = [dose("2026-06-15", "08:00", "due"), dose("2026-06-14", "08:00", "taken")];
        assert_eq!(streak_ending_yesterday(&b, NOW), 1);
        assert_eq!(streak_ending_yesterday(&[], NOW), 0);
    }

    #[test]
    fn confidence_is_stated() {
        assert_eq!(confidence_from(&[], &[], NOW), "calibrating");
        assert_eq!(confidence_from(&[dose("2026-06-13", "08:00", "taken")], &[], NOW), "calibrating");
        assert_eq!(confidence_from(&[dose("2026-06-01", "08:00", "taken")], &[], NOW), "building");
        assert_eq!(confidence_from(&[dose("2026-04-01", "08:00", "taken")], &[], NOW), "established");
    }

    #[test]
    fn every_verdict_is_an_observation_never_an_instruction() {
        let briefs = [
            daily_brief(&[], &[], &[], NOW),
            daily_brief(&[plan()], &[], &[], NOW),
            daily_brief(&[plan()], &[dose("2026-06-15", "08:00", "taken"), dose("2026-06-15", "20:00", "taken")], &[], NOW),
        ];
        for b in briefs {
            let v = b.verdict.to_lowercase();
            for banned in ["you should", "see a doctor", "increase", "reduce"] {
                assert!(!v.contains(banned), "{v}");
            }
        }
    }
}

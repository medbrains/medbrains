//! Whether the hospital is doing what it is obliged to do.
//!
//! Every test here is phrased as the question an assessor asks, because that
//! is the only question this code exists to answer. Where the answer would be
//! "it depends on your accreditation level", the test pins the *mechanism* and
//! leaves the interval configurable — see the note on `default_catalogue`.

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic, clippy::indexing_slicing)]

use chrono::{DateTime, Duration, NaiveDate, TimeZone, Utc};
use medbrains_nabh::norms::{
    Basis, Cadence, Norm, Standing, assess, assess_all, default_catalogue, financial_year,
};

fn at(text: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(text)
        .expect("a valid timestamp")
        .with_timezone(&Utc)
}

fn norm(cadence: Cadence) -> Norm {
    Norm {
        code: "TEST.NORM",
        title: "A thing that must be done",
        evidence: "A record of it",
        source_table: "some_register",
        source_date_column: "happened_at",
        cadence,
        basis: Basis::Nabh,
        mandatory: true,
    }
}

const NOW: &str = "2026-08-22T09:00:00Z";

// ================================================================= standing

#[test]
fn something_done_recently_is_met() {
    let quarterly = norm(Cadence::Quarterly);
    let assessment = assess(&quarterly, Some(at("2026-08-01T09:00:00Z")), at(NOW));

    assert_eq!(assessment.standing, Standing::Met);
    assert_eq!(assessment.days_overdue, 0);
}

#[test]
fn something_past_its_interval_is_overdue_and_says_by_how_long() {
    // "Overdue" alone is not actionable. Ten days late and ninety days late
    // are different conversations with the same department.
    let quarterly = norm(Cadence::Quarterly);
    let assessment = assess(&quarterly, Some(at("2026-01-01T09:00:00Z")), at(NOW));

    assert_eq!(assessment.standing, Standing::Overdue);
    assert_eq!(assessment.days_overdue, 141);
}

#[test]
fn something_never_recorded_is_not_merely_overdue() {
    // A slipped schedule and an obligation nobody was ever made responsible
    // for look identical in a register of rows, and are not the same problem.
    let assessment = assess(&norm(Cadence::Yearly), None, at(NOW));

    assert_eq!(assessment.standing, Standing::NeverRecorded);
    assert!(assessment.due_at.is_none(), "nothing to count from");
    assert!(assessment.last_done.is_none());
}

#[test]
fn something_approaching_is_flagged_before_it_lapses() {
    // The point of the whole exercise: being told before the assessor is.
    let yearly = norm(Cadence::Yearly);
    let nearly_due = at(NOW) - Duration::days(330);

    let assessment = assess(&yearly, Some(nearly_due), at(NOW));

    assert_eq!(assessment.standing, Standing::DueSoon);
    assert_eq!(assessment.days_overdue, 0, "not late yet");
}

#[test]
fn a_daily_check_is_not_warned_about_a_week_ahead() {
    // A daily gas reading warned about days early is noise, and noise is how a
    // compliance screen stops being read.
    let daily = norm(Cadence::Daily);
    let done_an_hour_ago = at(NOW) - Duration::hours(1);

    assert_eq!(assess(&daily, Some(done_an_hour_ago), at(NOW)).standing, Standing::Met);
}

#[test]
fn an_annual_obligation_is_warned_about_well_ahead() {
    // Sixty days is the difference between renewing a licence and not having
    // one. A day's notice on an annual item is useless.
    let yearly = norm(Cadence::Yearly);
    let done = at(NOW) - Duration::days(320);

    assert_eq!(assess(&yearly, Some(done), at(NOW)).standing, Standing::DueSoon);
}

#[test]
fn the_moment_it_falls_due_it_is_not_yet_late() {
    // Exactly on the boundary. Reporting a hospital late on the day something
    // is due would have every daily item permanently red.
    let daily = norm(Cadence::Daily);
    let exactly_a_day_ago = at(NOW) - Duration::days(1);

    let assessment = assess(&daily, Some(exactly_a_day_ago), at(NOW));

    assert_eq!(assessment.standing, Standing::DueSoon);
    assert_eq!(assessment.days_overdue, 0);
}

#[test]
fn a_record_dated_in_the_future_does_not_buy_a_year_of_cover() {
    // Somebody types 2027 instead of 2026. Counting forward from that would
    // report a year of compliance from a typing mistake, which is the kind of
    // wrong answer that survives until an assessor asks.
    let yearly = norm(Cadence::Yearly);
    let mistyped = at(NOW) + Duration::days(365);

    let assessment = assess(&yearly, Some(mistyped), at(NOW));

    let due = assessment.due_at.expect("a due date");
    assert!(
        due <= at(NOW) + Duration::days(366),
        "a mistyped date bought cover until {due}"
    );
}

// ================================================================= ordering

#[test]
fn the_list_reads_as_a_work_queue_rather_than_an_index() {
    // Sorted alphabetically, a compliance screen is something nobody acts on.
    let norms = vec![
        Norm { code: "MET", cadence: Cadence::Yearly, ..norm(Cadence::Yearly) },
        Norm { code: "NEVER", cadence: Cadence::Yearly, ..norm(Cadence::Yearly) },
        Norm { code: "SLIGHTLY_LATE", cadence: Cadence::Yearly, ..norm(Cadence::Yearly) },
        Norm { code: "VERY_LATE", cadence: Cadence::Yearly, ..norm(Cadence::Yearly) },
    ];

    let last_done = |n: &Norm| match n.code {
        "MET" => Some(at(NOW) - Duration::days(10)),
        "NEVER" => None,
        "SLIGHTLY_LATE" => Some(at(NOW) - Duration::days(380)),
        _ => Some(at(NOW) - Duration::days(900)),
    };

    let order: Vec<&str> = assess_all(&norms, &last_done, at(NOW))
        .iter()
        .map(|a| a.code)
        .collect();

    assert_eq!(order, ["NEVER", "VERY_LATE", "SLIGHTLY_LATE", "MET"]);
}

#[test]
fn a_mandatory_lapse_outranks_an_advisory_one() {
    let mandatory = Norm { code: "MANDATORY", mandatory: true, ..norm(Cadence::Yearly) };
    let advisory = Norm { code: "ADVISORY", mandatory: false, ..norm(Cadence::Yearly) };
    let norms = vec![advisory, mandatory];

    let order: Vec<&str> = assess_all(&norms, &|_| None, at(NOW))
        .iter()
        .map(|a| a.code)
        .collect();

    assert_eq!(order[0], "MANDATORY");
}

#[test]
fn needs_attention_covers_late_and_never_but_not_approaching() {
    // What a notification should fire on. Including "due soon" would page
    // somebody every day about something that is not yet wrong.
    assert!(Standing::Overdue.needs_attention());
    assert!(Standing::NeverRecorded.needs_attention());
    assert!(!Standing::DueSoon.needs_attention());
    assert!(!Standing::Met.needs_attention());
}

// ============================================================ financial year

#[test]
fn the_financial_year_runs_april_to_march() {
    // Annual statutory returns are dated by it, and deriving it from the
    // calendar year is how a hospital files the wrong one every January.
    assert_eq!(financial_year(NaiveDate::from_ymd_opt(2026, 4, 1).unwrap()), (2026, 2027));
    assert_eq!(financial_year(NaiveDate::from_ymd_opt(2026, 12, 31).unwrap()), (2026, 2027));
    assert_eq!(financial_year(NaiveDate::from_ymd_opt(2027, 3, 31).unwrap()), (2026, 2027));
    assert_eq!(financial_year(NaiveDate::from_ymd_opt(2027, 4, 1).unwrap()), (2027, 2028));
}

// ================================================================ catalogue

#[test]
fn every_norm_points_at_a_register_that_could_prove_it() {
    // A norm with no evidence behind it can never be met, only asserted.
    for norm in default_catalogue() {
        assert!(!norm.source_table.is_empty(), "{} has no register", norm.code);
        assert!(!norm.source_date_column.is_empty(), "{} has no date", norm.code);
        assert!(!norm.evidence.is_empty(), "{} says nothing about evidence", norm.code);
    }
}

#[test]
fn every_norm_says_where_it_came_from() {
    // The intervals are defaults that a quality team has to confirm, so each
    // one has to say what it is claiming to be — a standard, a statutory rule,
    // or just local practice.
    for norm in default_catalogue() {
        assert!(
            matches!(
                norm.basis,
                Basis::Nabh
                    | Basis::BioMedicalWasteRules
                    | Basis::FireSafety
                    | Basis::HospitalPolicy
            ),
            "{} has no basis",
            norm.code
        );
    }
}

#[test]
fn norm_codes_are_unique() {
    // The code is what an override or an exemption attaches to; two norms
    // sharing one would have an exemption silently cover both.
    let catalogue = default_catalogue();
    let mut codes: Vec<&str> = catalogue.iter().map(|n| n.code).collect();
    codes.sort_unstable();
    let before = codes.len();
    codes.dedup();

    assert_eq!(codes.len(), before, "duplicate norm code");
}

#[test]
fn a_brand_new_hospital_sees_every_obligation_rather_than_a_clean_sheet() {
    // The first day a hospital switches this on, no register has anything in
    // it. Reporting that as full compliance would be the most dangerous
    // possible answer.
    let catalogue = default_catalogue();
    let assessed = assess_all(&catalogue, &|_| None, at(NOW));

    assert_eq!(assessed.len(), catalogue.len());
    assert!(assessed.iter().all(|a| a.standing == Standing::NeverRecorded));
    assert!(assessed.iter().all(|a| a.standing.needs_attention()));
}

#[test]
fn a_time_zone_does_not_change_whether_something_is_late() {
    // Records are written in local time and compared in UTC. A drill logged at
    // 23:00 IST must not read as tomorrow's.
    let daily = norm(Cadence::Daily);
    let ist_evening = Utc.with_ymd_and_hms(2026, 8, 21, 17, 30, 0).single().expect("a time");

    let assessment = assess(&daily, Some(ist_evening), at(NOW));

    assert_eq!(assessment.standing, Standing::Met);
}

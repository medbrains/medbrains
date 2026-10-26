//! Schedule edge cases: on time, early, late, catch-up, combination vaccines.

use chrono::NaiveDate;
use uuid::Uuid;

use super::{DoseState, RecordedDose, ScheduleKind, ScheduleOptions, ScheduleView, evaluate};

fn d(s: &str) -> NaiveDate {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
}

fn dose(on: &str, name: &str) -> RecordedDose {
    RecordedDose {
        id: Uuid::new_v4(),
        given_on: d(on),
        vaccine_key: None,
        vaccine_name: name.to_owned(),
    }
}

const UIP: ScheduleOptions = ScheduleOptions {
    kind: ScheduleKind::Uip,
    include_je: false,
};
const IAP: ScheduleOptions = ScheduleOptions {
    kind: ScheduleKind::Iap,
    include_je: false,
};
const DOB: &str = "2026-01-01";

fn states(v: &ScheduleView, series: &str) -> Vec<(String, DoseState)> {
    v.series
        .iter()
        .find(|s| s.key == series)
        .unwrap()
        .doses
        .iter()
        .map(|x| (x.label.to_owned(), x.state))
        .collect()
}

fn state_of(v: &ScheduleView, series: &str, label: &str) -> DoseState {
    states(v, series)
        .into_iter()
        .find(|(l, _)| l == label)
        .unwrap()
        .1
}

#[test]
fn a_newborn_has_the_birth_doses_due_and_the_6_week_doses_upcoming() {
    let v = evaluate(UIP, d(DOB), &[], d(DOB));
    assert_eq!(state_of(&v, "bcg", "BCG"), DoseState::Due);
    assert_eq!(state_of(&v, "hepb0", "Hep B-0"), DoseState::Due);
    assert_eq!(state_of(&v, "penta", "Penta-1"), DoseState::Upcoming);
    let p1 = &v.series.iter().find(|s| s.key == "penta").unwrap().doses[0];
    assert_eq!(p1.date, d("2026-02-12"), "6 weeks");
}

#[test]
fn on_time_doses_count_and_the_next_one_follows_the_interval() {
    let given = [
        dose("2026-01-01", "BCG"),
        dose("2026-01-01", "OPV"),
        dose("2026-02-12", "Pentavalent"),
        dose("2026-02-12", "OPV"),
    ];
    let v = evaluate(UIP, d(DOB), &given, d("2026-03-20"));
    assert_eq!(
        state_of(&v, "opv0", "OPV-0"),
        DoseState::Given,
        "the birth OPV is OPV-0"
    );
    assert_eq!(
        state_of(&v, "opv", "OPV-1"),
        DoseState::Given,
        "not counted twice"
    );
    assert_eq!(state_of(&v, "penta", "Penta-1"), DoseState::Given);
    // 10 weeks is 2026-03-12; on 2026-03-20 Penta-2 is due, not yet overdue.
    assert_eq!(state_of(&v, "penta", "Penta-2"), DoseState::Due);
    assert_eq!(state_of(&v, "penta", "Penta-3"), DoseState::Upcoming);
    // Hep B birth dose missed (more than 24 hours old): no longer given.
    assert_eq!(state_of(&v, "hepb0", "Hep B-0"), DoseState::AgePassed);
}

#[test]
fn a_dose_given_too_early_does_not_count_and_says_why() {
    // Penta at 4 weeks: before the 6-week minimum (less 4 days' grace).
    let v = evaluate(UIP, d(DOB), &[dose("2026-01-29", "Penta")], d("2026-02-20"));
    let s = states(&v, "penta");
    assert_eq!(s[0].1, DoseState::NotCounted);
    let why = v.series.iter().find(|x| x.key == "penta").unwrap().doses[0]
        .reason
        .clone()
        .unwrap();
    assert!(why.contains("minimum age"), "{why}");
    assert_eq!(
        s[1],
        ("Penta-1".to_owned(), DoseState::Due),
        "it still has to be given"
    );
}

#[test]
fn four_days_of_grace_on_age_and_interval() {
    // 38 days old (6 weeks less 4); then at 66 days, 24 days later (10 weeks
    // and 4 weeks, each less 4).
    let given = [dose("2026-02-08", "Penta"), dose("2026-03-08", "Penta")];
    let v = evaluate(UIP, d(DOB), &given, d("2026-03-09"));
    assert_eq!(state_of(&v, "penta", "Penta-1"), DoseState::Given);
    assert_eq!(state_of(&v, "penta", "Penta-2"), DoseState::Given);
    let too_soon = [dose("2026-02-20", "Penta"), dose("2026-03-12", "Penta")]; // 20 days later
    let v = evaluate(UIP, d(DOB), &too_soon, d("2026-03-13"));
    let s = states(&v, "penta");
    assert_eq!(s[1].1, DoseState::NotCounted);
}

#[test]
fn a_missed_dose_becomes_overdue_then_catch_up_ends_at_the_age_limit() {
    let v = evaluate(UIP, d(DOB), &[], d("2026-05-01"));
    assert_eq!(state_of(&v, "rota", "Rota-1"), DoseState::Overdue);
    // Catch-up: Rota-1 now, Rota-2 4 weeks after it.
    let r2 = &v.series.iter().find(|s| s.key == "rota").unwrap().doses[1];
    assert_eq!(r2.earliest, Some(d("2026-05-29")));
    // At 13 months, rotavirus and Pentavalent are no longer given; MR still is.
    let v = evaluate(UIP, d(DOB), &[], d("2027-02-01"));
    assert_eq!(state_of(&v, "rota", "Rota-1"), DoseState::AgePassed);
    assert_eq!(state_of(&v, "penta", "Penta-3"), DoseState::AgePassed);
    assert_eq!(state_of(&v, "mr", "MR-1"), DoseState::Overdue);
}

#[test]
fn a_late_series_start_leaves_no_room_for_the_last_dose() {
    // Rota-1 at 11 months: Rota-2 fits 4 weeks later, before 1 year; Rota-3
    // would come after the first birthday, so it is no longer given.
    let v = evaluate(
        UIP,
        d(DOB),
        &[dose("2026-12-01", "Rotavac")],
        d("2026-12-02"),
    );
    assert_eq!(state_of(&v, "rota", "Rota-1"), DoseState::Given);
    assert_eq!(state_of(&v, "rota", "Rota-2"), DoseState::Upcoming);
    assert_eq!(state_of(&v, "rota", "Rota-3"), DoseState::AgePassed);
}

#[test]
fn a_hexavalent_dose_counts_for_every_antigen_it_carries_on_iap() {
    let v = evaluate(
        IAP,
        d(DOB),
        &[dose("2026-02-12", "Hexaxim")],
        d("2026-02-13"),
    );
    for (series, label) in [
        ("dtp", "DTP-1"),
        ("hib", "Hib-1"),
        ("ipv", "IPV-1"),
        ("hepb", "Hep B-1"),
    ] {
        assert_eq!(state_of(&v, series, label), DoseState::Given, "{series}");
    }
    assert!(v.unmatched.is_empty());
}

#[test]
fn hepatitis_b_birth_dose_is_only_the_monovalent_vaccine() {
    // Pentavalent at birth is not a birth dose (and is too early for Penta-1).
    let v = evaluate(
        UIP,
        d(DOB),
        &[dose("2026-01-01", "Pentavalent")],
        d("2026-01-01"),
    );
    assert_eq!(state_of(&v, "hepb0", "Hep B-0"), DoseState::Due);
    assert_eq!(states(&v, "penta")[0].1, DoseState::NotCounted);
}

#[test]
fn unknown_names_and_extra_doses_are_shown_not_guessed() {
    let given = [
        dose("2026-01-01", "BCG"),
        dose("2026-02-01", "BCG"),
        dose("2026-02-01", "Vitamin A"),
    ];
    let v = evaluate(UIP, d(DOB), &given, d("2026-02-02"));
    let reasons: Vec<&str> = v.unmatched.iter().map(|u| u.reason).collect();
    assert_eq!(reasons.len(), 2, "{reasons:?}");
    assert!(reasons.contains(&"not a vaccine this schedule recognises"));
    assert!(reasons.contains(&"an extra dose, or not part of this schedule"));
}

#[test]
fn je_only_where_the_hospital_includes_it_and_notes_carry_contraindications() {
    let v = evaluate(UIP, d(DOB), &[], d(DOB));
    assert!(!v.series.iter().any(|s| s.key == "je"));
    let with_je = ScheduleOptions {
        include_je: true,
        ..UIP
    };
    assert!(
        evaluate(with_je, d(DOB), &[], d(DOB))
            .series
            .iter()
            .any(|s| s.key == "je")
    );
    let rota = v.series.iter().find(|s| s.key == "rota").unwrap();
    assert!(rota.note.contains("intussusception"));
    let mr = v.series.iter().find(|s| s.key == "mr").unwrap();
    assert!(mr.note.contains("immunodeficiency"));
}

#[test]
fn names_on_cards_are_matched_to_products() {
    use super::products::identify;
    let key = |n: &str| identify(None, n).map(|p| p.key);
    assert_eq!(key("MMR vaccine"), Some("mmr"));
    assert_eq!(key("MR-1"), Some("mr"));
    assert_eq!(key("DPT booster 1"), Some("dtp"));
    assert_eq!(key("Tdap (Boostrix)"), Some("tdap"));
    assert_eq!(key("fIPV-2"), Some("ipv"));
    assert_eq!(key("Hep B"), Some("hepb"));
    assert_eq!(key("Paracetamol"), None);
    assert_eq!(
        identify(Some("pcv"), "anything").map(|p| p.key),
        Some("pcv")
    );
}

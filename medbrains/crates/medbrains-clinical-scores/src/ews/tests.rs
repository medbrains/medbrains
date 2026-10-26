//! Every band boundary of every table, incomplete sets, tool choice and the
//! policy rules. Each case is (value, expected) at both sides of a cut-off.

use super::*;

fn adult_normal() -> Observation {
    Observation {
        respiratory_rate: Some(16),
        spo2: Some(97),
        temperature_tenths: Some(370),
        systolic_bp: Some(120),
        diastolic_bp: Some(75),
        pulse: Some(70),
        consciousness: Some(Consciousness::A),
        oxygen_device: Some(OxygenDevice::RoomAir),
        oxygen_flow_tenths: None,
        fio2_percent: None,
        capillary_refill_tenths: Some(20),
        respiratory_distress: Some(Distress::Nil),
    }
}

fn adult() -> PatientKind {
    PatientKind {
        age_months: Some(40 * 12),
        obstetric: false,
        spo2_scale2: false,
        tool_override: None,
    }
}

#[test]
fn news2_respiration_boundaries() {
    for (rr, s) in [
        (8, 3),
        (9, 1),
        (11, 1),
        (12, 0),
        (20, 0),
        (21, 2),
        (24, 2),
        (25, 3),
    ] {
        assert_eq!(news2_table::respiration(rr), s, "RR {rr}");
    }
}

#[test]
fn news2_spo2_scale1_boundaries() {
    for (v, s) in [
        (91, 3),
        (92, 2),
        (93, 2),
        (94, 1),
        (95, 1),
        (96, 0),
        (100, 0),
    ] {
        assert_eq!(news2_table::spo2_scale1(v), s, "SpO2 {v}");
    }
}

#[test]
fn news2_spo2_scale2_boundaries_on_air_and_oxygen() {
    let on_o2 = Some(true);
    let air = Some(false);
    for (v, s) in [
        (83, 3),
        (84, 2),
        (85, 2),
        (86, 1),
        (87, 1),
        (88, 0),
        (92, 0),
    ] {
        assert_eq!(
            news2_table::spo2_scale2(v, on_o2),
            Some(s),
            "SpO2 {v} on O2"
        );
        assert_eq!(news2_table::spo2_scale2(v, air), Some(s), "SpO2 {v} on air");
    }
    for (v, s) in [(93, 1), (94, 1), (95, 2), (96, 2), (97, 3), (100, 3)] {
        assert_eq!(
            news2_table::spo2_scale2(v, on_o2),
            Some(s),
            "SpO2 {v} on O2"
        );
        assert_eq!(news2_table::spo2_scale2(v, air), Some(0), "SpO2 {v} on air");
    }
    assert_eq!(
        news2_table::spo2_scale2(95, None),
        None,
        "needs air or oxygen"
    );
    assert_eq!(
        news2_table::spo2_scale2(90, None),
        Some(0),
        "88-92 scores 0 either way"
    );
}

#[test]
fn news2_systolic_pulse_temperature_consciousness_boundaries() {
    for (v, s) in [
        (90, 3),
        (91, 2),
        (100, 2),
        (101, 1),
        (110, 1),
        (111, 0),
        (219, 0),
        (220, 3),
    ] {
        assert_eq!(news2_table::systolic(v), s, "SBP {v}");
    }
    for (v, s) in [
        (40, 3),
        (41, 1),
        (50, 1),
        (51, 0),
        (90, 0),
        (91, 1),
        (110, 1),
        (111, 2),
        (130, 2),
        (131, 3),
    ] {
        assert_eq!(news2_table::pulse(v), s, "pulse {v}");
    }
    for (v, s) in [
        (350, 3),
        (351, 1),
        (360, 1),
        (361, 0),
        (380, 0),
        (381, 1),
        (390, 1),
        (391, 2),
    ] {
        assert_eq!(news2_table::temperature(v), s, "temp {v}");
    }
    assert_eq!(news2_table::consciousness(Consciousness::A), 0);
    for c in [
        Consciousness::C,
        Consciousness::V,
        Consciousness::P,
        Consciousness::U,
    ] {
        assert_eq!(news2_table::consciousness(c), 3);
    }
}

#[test]
fn news2_bands_follow_chart_2() {
    assert_eq!(news2_table::band(0, false), Band::Routine);
    assert_eq!(news2_table::band(1, false), Band::Low);
    assert_eq!(news2_table::band(4, false), Band::Low);
    assert_eq!(news2_table::band(3, true), Band::LowMedium);
    assert_eq!(news2_table::band(4, true), Band::LowMedium);
    assert_eq!(news2_table::band(5, false), Band::Urgent);
    assert_eq!(news2_table::band(6, true), Band::Urgent);
    assert_eq!(news2_table::band(7, false), Band::Emergency);
}

#[test]
fn news2_whole_reading() {
    let s = score(&adult_normal(), &adult());
    assert_eq!(
        (s.tool, s.total, s.band, s.incomplete),
        (Tool::News2, 0, Band::Routine, false)
    );
    let mut o = adult_normal();
    o.oxygen_device = Some(OxygenDevice::NasalProngs); // 2
    o.pulse = Some(115); // 2
    o.respiratory_rate = Some(22); // 2
    let s = score(&o, &adult());
    assert_eq!((s.total, s.band), (6, Band::Urgent));
    o.consciousness = Some(Consciousness::C); // 3
    assert_eq!(score(&o, &adult()).band, Band::Emergency);
}

#[test]
fn news2_scale2_only_when_prescribed() {
    let mut o = adult_normal();
    o.spo2 = Some(89);
    o.oxygen_device = Some(OxygenDevice::NasalProngs);
    let s1 = score(&o, &adult());
    assert_eq!((s1.spo2_scale, s1.total), (Some(1), 3 + 2));
    let mut k = adult();
    k.spo2_scale2 = true;
    let s2 = score(&o, &k);
    assert_eq!(
        (s2.spo2_scale, s2.total),
        (Some(2), 2),
        "88-92 on Scale 2 scores 0"
    );
}

#[test]
fn a_missing_parameter_is_never_scored_as_normal() {
    let mut o = adult_normal();
    o.respiratory_rate = None;
    o.consciousness = None;
    let s = score(&o, &adult());
    assert!(s.incomplete);
    assert_eq!(s.missing, vec!["respiratory_rate", "consciousness"]);
    assert!(s.params.iter().all(|p| p.name != "respiratory_rate"));
    // What was charted still bands: a pulse of 135 alone is a red score.
    o.pulse = Some(135);
    let s = score(&o, &adult());
    assert_eq!((s.band, s.incomplete), (Band::LowMedium, true));
}

#[test]
fn unknown_age_is_incomplete() {
    let k = PatientKind {
        age_months: None,
        ..adult()
    };
    let s = score(&adult_normal(), &k);
    assert_eq!(s.tool, Tool::News2);
    assert!(s.incomplete && s.missing.contains(&"age"));
}

#[test]
fn tool_follows_age_and_pregnancy() {
    let kind = |months: i32, obstetric: bool| PatientKind {
        age_months: Some(months),
        obstetric,
        spo2_scale2: false,
        tool_override: None,
    };
    let tool = |k: PatientKind| score(&adult_normal(), &k).tool;
    assert_eq!(tool(kind(191, false)), Tool::Pews, "15 years 11 months");
    assert_eq!(tool(kind(192, false)), Tool::News2, "16 years");
    assert_eq!(tool(kind(15 * 12, true)), Tool::Meows, "pregnant at 15");
    assert_eq!(tool(kind(30 * 12, true)), Tool::Meows);
    let over = PatientKind {
        tool_override: Some(Tool::News2),
        ..kind(30 * 12, true)
    };
    assert_eq!(tool(over), Tool::News2, "a clinician's choice wins");
}

const R: Zone = Zone::Red;
const Y: Zone = Zone::Yellow;
const W: Zone = Zone::White;

fn meows_with(f: impl Fn(&mut Observation)) -> EwsScore {
    let mut o = adult_normal();
    f(&mut o);
    meows_table::score(&o)
}

#[test]
fn meows_parameter_boundaries() {
    use meows_table as m;
    for (v, z) in [(9, R), (10, W), (20, W), (21, Y), (30, Y), (31, R)] {
        assert_eq!(m::respiration(v).1, z, "RR {v}");
    }
    for (v, z) in [(94, R), (95, W)] {
        assert_eq!(m::spo2(v).1, z, "SpO2 {v}");
    }
    for (v, z) in [(349, R), (350, Y), (359, Y), (360, W), (380, W), (381, R)] {
        assert_eq!(m::temperature(v).1, z, "temp {v}");
    }
    for (v, z) in [
        (39, R),
        (40, Y),
        (49, Y),
        (50, W),
        (100, W),
        (101, Y),
        (120, Y),
        (121, R),
    ] {
        assert_eq!(m::heart_rate(v).1, z, "HR {v}");
    }
    for (v, z) in [
        (89, R),
        (90, Y),
        (99, Y),
        (100, W),
        (140, W),
        (141, Y),
        (160, Y),
        (161, R),
    ] {
        assert_eq!(m::systolic(v).1, z, "SBP {v}");
    }
    for (v, z) in [(89, W), (90, Y), (100, Y), (101, R)] {
        assert_eq!(m::diastolic(v).1, z, "DBP {v}");
    }
    assert_eq!(m::consciousness(Consciousness::A).1, W);
    assert_eq!(m::consciousness(Consciousness::V).1, Y);
    for c in [Consciousness::C, Consciousness::P, Consciousness::U] {
        assert_eq!(m::consciousness(c).1, R);
    }
}

#[test]
fn meows_one_red_or_two_yellows() {
    assert_eq!(meows_with(|_| {}).band, Band::Routine);
    let one_yellow = meows_with(|o| o.pulse = Some(105));
    assert_eq!((one_yellow.band, one_yellow.total), (Band::Low, 1));
    let two_yellows = meows_with(|o| {
        o.pulse = Some(105);
        o.diastolic_bp = Some(95);
    });
    assert_eq!(two_yellows.band, Band::Urgent);
    assert_eq!(
        meows_with(|o| o.spo2 = Some(94)).band,
        Band::Urgent,
        "one red"
    );
    let missing = meows_with(|o| o.diastolic_bp = None);
    assert!(missing.incomplete && missing.missing == vec!["diastolic_bp"]);
}

#[test]
fn next_due_follows_rcp_chart_4_and_never_waits_on_an_incomplete_set() {
    let p = EwsPolicy::default();
    let due = |o: &Observation| p.next_due_minutes(&score(o, &adult()));
    assert_eq!(due(&adult_normal()), 720, "NEWS2 0: 12-hourly");
    let mut o = adult_normal();
    o.pulse = Some(95); // 1
    assert_eq!(due(&o), 240, "1-4: 4-6-hourly");
    o.pulse = Some(135); // single 3
    assert_eq!(due(&o), 60, "single 3: hourly");
    o.respiratory_rate = Some(22); // +2 = 5
    assert_eq!(due(&o), 60, "5-6: hourly");
    o.oxygen_device = Some(OxygenDevice::Mask); // +2 = 7
    assert_eq!(due(&o), 15, "7+: continuous");
    let mut partial = adult_normal();
    partial.consciousness = None;
    assert_eq!(due(&partial), 60, "incomplete 0 is not 12-hourly");
}

#[test]
fn escalation_bands_and_ack_windows() {
    let p = EwsPolicy::default();
    assert!(!p.escalates(Band::LowMedium));
    assert!(p.escalates(Band::Urgent) && p.escalates(Band::Emergency));
    assert_eq!(
        (p.ack_minutes(Band::Urgent), p.ack_minutes(Band::Emergency)),
        (30, 15)
    );
}

#[test]
fn unsafe_policies_are_refused() {
    assert!(EwsPolicy::default().validate().is_ok());
    let mut p = EwsPolicy::default();
    p.news2.emergency = 120; // sicker, observed less often
    assert!(p.validate().is_err());
    let mut p = EwsPolicy::default();
    p.escalate_bands = vec![Band::Urgent];
    assert!(p.validate().is_err(), "emergency must escalate");
    let mut p = EwsPolicy::default();
    p.ack_minutes_emergency = 60;
    assert!(
        p.validate().is_err(),
        "emergency cannot wait longer than urgent"
    );
    let mut p = EwsPolicy::default();
    p.news2.routine = 2000;
    assert!(p.validate().is_err());
}

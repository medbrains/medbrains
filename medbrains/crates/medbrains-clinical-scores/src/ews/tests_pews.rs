//! PEWS (HQSC Aotearoa NZ 2023, Table 1): every zone edge of every age
//! chart, the rows the four charts share, and the bands.

use super::*;

#[test]
fn pews_age_bands() {
    assert_eq!(AgeBand::for_months(0), Some(AgeBand::Infant));
    assert_eq!(AgeBand::for_months(11), Some(AgeBand::Infant));
    assert_eq!(AgeBand::for_months(12), Some(AgeBand::Toddler));
    assert_eq!(AgeBand::for_months(59), Some(AgeBand::Toddler));
    assert_eq!(AgeBand::for_months(60), Some(AgeBand::Child));
    assert_eq!(AgeBand::for_months(143), Some(AgeBand::Child));
    assert_eq!(AgeBand::for_months(144), Some(AgeBand::Adolescent));
    assert_eq!(AgeBand::for_months(191), Some(AgeBand::Adolescent));
    assert_eq!(AgeBand::for_months(192), None);
}

/// Score a child with every other parameter in the white zone.
fn pews_with(age: AgeBand, f: impl Fn(&mut Observation)) -> EwsScore {
    let mut o = Observation {
        respiratory_rate: None,
        pulse: None,
        systolic_bp: None,
        spo2: Some(98),
        oxygen_device: Some(OxygenDevice::RoomAir),
        capillary_refill_tenths: Some(20),
        respiratory_distress: Some(Distress::Nil),
        ..Observation::default()
    };
    let white = match age {
        AgeBand::Infant => (40, 130, 85),
        AgeBand::Toddler => (30, 110, 100),
        AgeBand::Child => (25, 100, 100),
        AgeBand::Adolescent => (20, 80, 120),
    };
    o.respiratory_rate = Some(white.0);
    o.pulse = Some(white.1);
    o.systolic_bp = Some(white.2);
    f(&mut o);
    pews_table::score(&o, age)
}

fn param(s: &EwsScore, name: &str) -> (i32, Zone) {
    let p = s.params.iter().find(|p| p.name == name).expect("param");
    (p.score, p.zone)
}

/// (value, score, zone) at every edge of a row.
fn check_row(age: AgeBand, name: &str, set: fn(&mut Observation, i32), cases: &[(i32, i32, Zone)]) {
    for &(v, sc, z) in cases {
        let s = pews_with(age, |o| set(o, v));
        assert_eq!(param(&s, name), (sc, z), "{age:?} {name} {v}");
    }
}

const B: Zone = Zone::Blue;
const R: Zone = Zone::Red;
const O: Zone = Zone::Orange;
const Y: Zone = Zone::Yellow;
const W: Zone = Zone::White;

fn rr(o: &mut Observation, v: i32) {
    o.respiratory_rate = Some(v);
}
fn hr(o: &mut Observation, v: i32) {
    o.pulse = Some(v);
}
fn bp(o: &mut Observation, v: i32) {
    o.systolic_bp = Some(v);
}

#[test]
fn pews_infant_rows() {
    let a = AgeBand::Infant;
    check_row(
        a,
        "respiratory_rate",
        rr,
        &[
            (9, 4, B),
            (10, 4, R),
            (19, 4, R),
            (20, 2, O),
            (24, 2, O),
            (25, 1, Y),
            (29, 1, Y),
            (30, 0, W),
            (49, 0, W),
            (50, 1, Y),
            (54, 1, Y),
            (55, 2, O),
            (69, 2, O),
            (70, 4, R),
        ],
    );
    check_row(
        a,
        "pulse",
        hr,
        &[
            (59, 4, B),
            (60, 4, R),
            (79, 4, R),
            (80, 2, O),
            (89, 2, O),
            (90, 1, Y),
            (109, 1, Y),
            (110, 0, W),
            (159, 0, W),
            (160, 1, Y),
            (169, 1, Y),
            (170, 2, O),
            (179, 2, O),
            (180, 4, R),
        ],
    );
    check_row(
        a,
        "systolic_bp",
        bp,
        &[
            (49, 4, B),
            (50, 4, R),
            (54, 4, R),
            (55, 2, O),
            (64, 2, O),
            (65, 1, Y),
            (74, 1, Y),
            (75, 0, W),
            (99, 0, W),
            (100, 1, Y),
            (119, 1, Y),
            (120, 2, O),
            (149, 2, O),
            (150, 4, R),
        ],
    );
}

#[test]
fn pews_toddler_rows() {
    let a = AgeBand::Toddler;
    check_row(
        a,
        "respiratory_rate",
        rr,
        &[
            (4, 4, B),
            (5, 4, R),
            (14, 4, R),
            (15, 2, O),
            (17, 2, O),
            (18, 1, Y),
            (19, 1, Y),
            (20, 0, W),
            (39, 0, W),
            (40, 1, Y),
            (44, 1, Y),
            (45, 2, O),
            (54, 2, O),
            (55, 4, R),
        ],
    );
    check_row(
        a,
        "pulse",
        hr,
        &[
            (59, 4, B),
            (60, 4, R),
            (69, 4, R),
            (70, 2, O),
            (79, 2, O),
            (80, 1, Y),
            (89, 1, Y),
            (90, 0, W),
            (139, 0, W),
            (140, 1, Y),
            (149, 1, Y),
            (150, 2, O),
            (159, 2, O),
            (160, 4, R),
        ],
    );
    check_row(
        a,
        "systolic_bp",
        bp,
        &[
            (54, 4, B),
            (55, 4, R),
            (64, 4, R),
            (65, 2, O),
            (74, 2, O),
            (75, 1, Y),
            (89, 1, Y),
            (90, 0, W),
            (109, 0, W),
            (110, 1, Y),
            (124, 1, Y),
            (125, 2, O),
            (159, 2, O),
            (160, 4, R),
        ],
    );
}

#[test]
fn pews_child_rows() {
    let a = AgeBand::Child;
    check_row(
        a,
        "respiratory_rate",
        rr,
        &[
            (4, 4, B),
            (5, 4, R),
            (11, 4, R),
            (12, 2, O),
            (14, 2, O),
            (15, 1, Y),
            (19, 1, Y),
            (20, 0, W),
            (29, 0, W),
            (30, 1, Y),
            (34, 1, Y),
            (35, 2, O),
            (44, 2, O),
            (45, 4, R),
        ],
    );
    check_row(
        a,
        "pulse",
        hr,
        &[
            (49, 4, B),
            (50, 4, R),
            (59, 4, R),
            (60, 2, O),
            (69, 2, O),
            (70, 1, Y),
            (79, 1, Y),
            (80, 0, W),
            (129, 0, W),
            (130, 1, Y),
            (139, 1, Y),
            (140, 2, O),
            (154, 2, O),
            (155, 4, R),
        ],
    );
    check_row(
        a,
        "systolic_bp",
        bp,
        &[
            (54, 4, B),
            (55, 4, R),
            (69, 4, R),
            (70, 2, O),
            (79, 2, O),
            (80, 1, Y),
            (89, 1, Y),
            (90, 0, W),
            (119, 0, W),
            (120, 1, Y),
            (139, 1, Y),
            (140, 2, O),
            (169, 2, O),
            (170, 4, R),
        ],
    );
}

#[test]
fn pews_adolescent_rows() {
    let a = AgeBand::Adolescent;
    check_row(
        a,
        "respiratory_rate",
        rr,
        &[
            (4, 4, B),
            (5, 4, R),
            (9, 4, R),
            (10, 2, O),
            (11, 2, O),
            (12, 1, Y),
            (14, 1, Y),
            (15, 0, W),
            (24, 0, W),
            (25, 1, Y),
            (29, 1, Y),
            (30, 2, O),
            (34, 2, O),
            (35, 4, R),
        ],
    );
    check_row(
        a,
        "pulse",
        hr,
        &[
            (39, 4, B),
            (40, 4, R),
            (49, 4, R),
            (50, 2, O),
            (59, 2, O),
            (60, 1, Y),
            (64, 1, Y),
            (65, 0, W),
            (109, 0, W),
            (110, 1, Y),
            (119, 1, Y),
            (120, 2, O),
            (134, 2, O),
            (135, 4, R),
        ],
    );
    check_row(
        a,
        "systolic_bp",
        bp,
        &[
            (64, 4, B),
            (65, 4, R),
            (69, 4, R),
            (70, 2, O),
            (84, 2, O),
            (85, 1, Y),
            (99, 1, Y),
            (100, 0, W),
            (134, 0, W),
            (135, 1, Y),
            (149, 1, Y),
            (150, 2, O),
            (189, 2, O),
            (190, 4, R),
        ],
    );
}

#[test]
fn pews_rows_shared_by_every_chart() {
    let a = AgeBand::Child;
    check_row(
        a,
        "spo2",
        |o, v| o.spo2 = Some(v),
        &[(90, 2, O), (91, 1, Y), (94, 1, Y), (95, 0, W)],
    );
    check_row(
        a,
        "capillary_refill",
        |o, v| o.capillary_refill_tenths = Some(v),
        &[(29, 0, W), (30, 4, R)],
    );
    let distress = |d: Distress| {
        param(
            &pews_with(a, |o| o.respiratory_distress = Some(d)),
            "respiratory_distress",
        )
    };
    assert_eq!(distress(Distress::Nil), (0, W));
    assert_eq!(distress(Distress::Mild), (1, Y));
    assert_eq!(distress(Distress::Moderate), (2, O));
    assert_eq!(distress(Distress::Severe), (4, R));
    let oxygen = |device: OxygenDevice, flow: Option<i32>, fio2: Option<i32>| {
        let s = pews_with(a, |o| {
            o.oxygen_device = Some(device);
            o.oxygen_flow_tenths = flow;
            o.fio2_percent = fio2;
        });
        s.params
            .iter()
            .find(|p| p.name == "oxygen")
            .map(|p| (p.score, p.zone))
    };
    assert_eq!(oxygen(OxygenDevice::RoomAir, None, None), Some((0, W)));
    assert_eq!(
        oxygen(OxygenDevice::NasalProngs, Some(10), None),
        Some((2, O)),
        "1 L/min"
    );
    assert_eq!(
        oxygen(OxygenDevice::NasalProngs, Some(39), None),
        Some((2, O))
    );
    assert_eq!(
        oxygen(OxygenDevice::Mask, Some(40), None),
        Some((4, R)),
        "4 L/min"
    );
    assert_eq!(
        oxygen(OxygenDevice::HighFlow, None, Some(21)),
        Some((2, O)),
        "HF at 21% is support"
    );
    assert_eq!(oxygen(OxygenDevice::HighFlow, None, Some(34)), Some((2, O)));
    assert_eq!(oxygen(OxygenDevice::HighFlow, None, Some(35)), Some((4, R)));
    assert_eq!(
        oxygen(OxygenDevice::Mask, None, None),
        None,
        "flow not charted"
    );
    assert_eq!(
        oxygen(OxygenDevice::HighFlow, Some(80), None),
        None,
        "FiO2 not charted"
    );
}

#[test]
fn pews_bands_and_blue_zone() {
    for (t, b) in [
        (0, Band::Routine),
        (1, Band::Low),
        (3, Band::Low),
        (4, Band::LowMedium),
        (5, Band::LowMedium),
        (6, Band::Urgent),
        (7, Band::Urgent),
        (8, Band::Emergency),
    ] {
        assert_eq!(pews_table::band(t, false), b, "PEWS {t}");
    }
    assert_eq!(pews_table::band(0, true), Band::Emergency);
    let s = pews_with(AgeBand::Infant, |o| o.pulse = Some(55));
    assert_eq!((s.total, s.band), (4, Band::Emergency), "blue heart rate");
    let s = pews_with(AgeBand::Infant, |_| {});
    assert_eq!((s.total, s.band, s.incomplete), (0, Band::Routine, false));
    let s = pews_with(AgeBand::Infant, |o| o.capillary_refill_tenths = None);
    assert!(s.incomplete && s.missing == vec!["capillary_refill"]);
}

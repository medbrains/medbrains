//! PEWS — Aotearoa New Zealand national paediatric early warning system,
//! Health Quality & Safety Commission, *Paediatric vital signs chart: user
//! guide* (2023), §3.6 and Table 1 "PEWS score matrix".
//!
//! Each parameter falls in a white, yellow, orange or red zone scoring 0, 1,
//! 2 or 4, and the seven scores add up to the PEWS. A parameter in the blue
//! zone is a single-parameter trigger for the rapid response team whatever
//! the total (§3.6); the guide gives the blue zone no score, so it counts 4
//! here — the most the adjacent red zone scores — and always bands as an
//! emergency. The heart-rate, respiratory-rate and systolic-pressure rows
//! differ by age chart; the other four are the same on all four charts.
//!
//! Bands follow the escalation steps printed on the generic HQSC chart
//! (PEWS 0, 1–3, 4–5, 6–7, 8+, any blue). The response to each step is local
//! policy (§4.1), set per hospital in [`super::EwsPolicy`].

use super::{AgeBand, Band, Distress, EwsScore, Observation, OxygenDevice, Tally, Tool, Zone};

/// One chart row: (lowest, highest, score, zone), inclusive, lowest first.
type Row = &'static [(i32, i32, i32, Zone)];

const B: Zone = Zone::Blue;
const R: Zone = Zone::Red;
const O: Zone = Zone::Orange;
const Y: Zone = Zone::Yellow;
const W: Zone = Zone::White;
const LO: i32 = i32::MIN;
const HI: i32 = i32::MAX;

const RR_0_11M: Row = &[
    (LO, 9, 4, B),
    (10, 19, 4, R),
    (20, 24, 2, O),
    (25, 29, 1, Y),
    (30, 49, 0, W),
    (50, 54, 1, Y),
    (55, 69, 2, O),
    (70, HI, 4, R),
];
const HR_0_11M: Row = &[
    (LO, 59, 4, B),
    (60, 79, 4, R),
    (80, 89, 2, O),
    (90, 109, 1, Y),
    (110, 159, 0, W),
    (160, 169, 1, Y),
    (170, 179, 2, O),
    (180, HI, 4, R),
];
const BP_0_11M: Row = &[
    (LO, 49, 4, B),
    (50, 54, 4, R),
    (55, 64, 2, O),
    (65, 74, 1, Y),
    (75, 99, 0, W),
    (100, 119, 1, Y),
    (120, 149, 2, O),
    (150, HI, 4, R),
];

const RR_1_4Y: Row = &[
    (LO, 4, 4, B),
    (5, 14, 4, R),
    (15, 17, 2, O),
    (18, 19, 1, Y),
    (20, 39, 0, W),
    (40, 44, 1, Y),
    (45, 54, 2, O),
    (55, HI, 4, R),
];
const HR_1_4Y: Row = &[
    (LO, 59, 4, B),
    (60, 69, 4, R),
    (70, 79, 2, O),
    (80, 89, 1, Y),
    (90, 139, 0, W),
    (140, 149, 1, Y),
    (150, 159, 2, O),
    (160, HI, 4, R),
];
const BP_1_4Y: Row = &[
    (LO, 54, 4, B),
    (55, 64, 4, R),
    (65, 74, 2, O),
    (75, 89, 1, Y),
    (90, 109, 0, W),
    (110, 124, 1, Y),
    (125, 159, 2, O),
    (160, HI, 4, R),
];

const RR_5_11Y: Row = &[
    (LO, 4, 4, B),
    (5, 11, 4, R),
    (12, 14, 2, O),
    (15, 19, 1, Y),
    (20, 29, 0, W),
    (30, 34, 1, Y),
    (35, 44, 2, O),
    (45, HI, 4, R),
];
const HR_5_11Y: Row = &[
    (LO, 49, 4, B),
    (50, 59, 4, R),
    (60, 69, 2, O),
    (70, 79, 1, Y),
    (80, 129, 0, W),
    (130, 139, 1, Y),
    (140, 154, 2, O),
    (155, HI, 4, R),
];
const BP_5_11Y: Row = &[
    (LO, 54, 4, B),
    (55, 69, 4, R),
    (70, 79, 2, O),
    (80, 89, 1, Y),
    (90, 119, 0, W),
    (120, 139, 1, Y),
    (140, 169, 2, O),
    (170, HI, 4, R),
];

const RR_12Y: Row = &[
    (LO, 4, 4, B),
    (5, 9, 4, R),
    (10, 11, 2, O),
    (12, 14, 1, Y),
    (15, 24, 0, W),
    (25, 29, 1, Y),
    (30, 34, 2, O),
    (35, HI, 4, R),
];
const HR_12Y: Row = &[
    (LO, 39, 4, B),
    (40, 49, 4, R),
    (50, 59, 2, O),
    (60, 64, 1, Y),
    (65, 109, 0, W),
    (110, 119, 1, Y),
    (120, 134, 2, O),
    (135, HI, 4, R),
];
const BP_12Y: Row = &[
    (LO, 64, 4, B),
    (65, 69, 4, R),
    (70, 84, 2, O),
    (85, 99, 1, Y),
    (100, 134, 0, W),
    (135, 149, 1, Y),
    (150, 189, 2, O),
    (190, HI, 4, R),
];

/// Oxygen saturation, the same on every chart: ≤90 orange, 91–94 yellow, ≥95 white.
const SPO2: Row = &[(LO, 90, 2, O), (91, 94, 1, Y), (95, HI, 0, W)];

fn rows(age: AgeBand) -> (Row, Row, Row) {
    match age {
        AgeBand::Infant => (RR_0_11M, HR_0_11M, BP_0_11M),
        AgeBand::Toddler => (RR_1_4Y, HR_1_4Y, BP_1_4Y),
        AgeBand::Child => (RR_5_11Y, HR_5_11Y, BP_5_11Y),
        AgeBand::Adolescent => (RR_12Y, HR_12Y, BP_12Y),
    }
}

fn lookup(row: Row, value: i32) -> Option<(i32, Zone)> {
    row.iter()
        .find(|(lo, hi, _, _)| (*lo..=*hi).contains(&value))
        .map(|(_, _, score, zone)| (*score, *zone))
}

const fn distress(d: Distress) -> (i32, Zone) {
    match d {
        Distress::Nil => (0, W),
        Distress::Mild => (1, Y),
        Distress::Moderate => (2, O),
        Distress::Severe => (4, R),
    }
}

/// Room air 0; under 4 L/min, or high flow under 35% FiO₂, 2; 4 L/min or
/// more, or high flow at 35% or more, 4. `None` when the flow (or, on high
/// flow, the FiO₂) the row needs was not charted.
fn oxygen(o: &Observation) -> Option<(i32, Zone)> {
    let high = |yes: bool| if yes { (4, R) } else { (2, O) };
    match o.oxygen_device? {
        OxygenDevice::RoomAir => Some((0, W)),
        OxygenDevice::HighFlow => o.fio2_percent.map(|f| high(f >= 35)),
        _ => o.oxygen_flow_tenths.map(|f| high(f >= 40)),
    }
}

/// Central capillary refill: under 3 seconds 0, 3 seconds or more 4.
const fn capillary_refill(tenths: i32) -> (i32, Zone) {
    if tenths >= 30 { (4, R) } else { (0, W) }
}

/// The band for a PEWS total; any blue parameter is an emergency.
#[must_use]
pub const fn band(total: i32, any_blue: bool) -> Band {
    if any_blue || total >= 8 {
        Band::Emergency
    } else if total >= 6 {
        Band::Urgent
    } else if total >= 4 {
        Band::LowMedium
    } else if total >= 1 {
        Band::Low
    } else {
        Band::Routine
    }
}

#[must_use]
pub fn score(o: &Observation, age: AgeBand) -> EwsScore {
    let (rr, hr, bp) = rows(age);
    let mut t = Tally::default();
    t.add(
        "respiratory_rate",
        o.respiratory_rate.and_then(|v| lookup(rr, v)),
    );
    t.add("respiratory_distress", o.respiratory_distress.map(distress));
    t.add("oxygen", oxygen(o));
    t.add("spo2", o.spo2.and_then(|v| lookup(SPO2, v)));
    t.add("pulse", o.pulse.and_then(|v| lookup(hr, v)));
    t.add(
        "capillary_refill",
        o.capillary_refill_tenths.map(capillary_refill),
    );
    t.add("systolic_bp", o.systolic_bp.and_then(|v| lookup(bp, v)));
    let total = t.total();
    EwsScore {
        tool: Tool::Pews,
        total,
        band: band(total, t.any(Zone::Blue)),
        incomplete: !t.missing.is_empty(),
        missing: t.missing,
        params: t.params,
        spo2_scale: None,
        age_band: Some(age),
    }
}

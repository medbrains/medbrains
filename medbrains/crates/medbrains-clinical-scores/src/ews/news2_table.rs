//! NEWS2 — Royal College of Physicians 2017, Chart 1 "The NEWS scoring
//! system" and Chart 2 "NEWS thresholds and triggers".
//!
//! | Parameter        | 3      | 2      | 1         | 0          | 1               | 2               | 3              |
//! |------------------|--------|--------|-----------|------------|-----------------|-----------------|----------------|
//! | Respiration rate | ≤8     |        | 9–11      | 12–20      |                 | 21–24           | ≥25            |
//! | SpO₂ Scale 1     | ≤91    | 92–93  | 94–95     | ≥96        |                 |                 |                |
//! | SpO₂ Scale 2     | ≤83    | 84–85  | 86–87     | 88–92, ≥93 on air | 93–94 on O₂ | 95–96 on O₂   | ≥97 on O₂      |
//! | Air or oxygen?   |        | Oxygen |           | Air        |                 |                 |                |
//! | Systolic BP      | ≤90    | 91–100 | 101–110   | 111–219    |                 |                 | ≥220           |
//! | Pulse            | ≤40    |        | 41–50     | 51–90      | 91–110          | 111–130         | ≥131           |
//! | Consciousness    |        |        |           | Alert      |                 |                 | CVPU           |
//! | Temperature (°C) | ≤35.0  |        | 35.1–36.0 | 36.1–38.0  | 38.1–39.0       | ≥39.1           |                |
//!
//! Clinical risk (Chart 2): aggregate 0–4 low; a 3 in any single parameter
//! low–medium; 5–6 medium (urgent response); 7 or more high (emergency).
//! An aggregate of 0 is kept apart from 1–4 because Chart 4 monitors it
//! less often (minimum 12-hourly against 4–6-hourly).

use super::{Band, Consciousness, EwsScore, Observation, Tally, Tool, Zone};

fn zone(score: i32) -> Zone {
    match score {
        0 => Zone::White,
        1 => Zone::Yellow,
        2 => Zone::Orange,
        _ => Zone::Red,
    }
}

fn scored(score: i32) -> Option<(i32, Zone)> {
    Some((score, zone(score)))
}

#[must_use]
pub const fn respiration(rr: i32) -> i32 {
    match rr {
        ..=8 => 3,
        9..=11 => 1,
        12..=20 => 0,
        21..=24 => 2,
        _ => 3,
    }
}

#[must_use]
pub const fn spo2_scale1(spo2: i32) -> i32 {
    match spo2 {
        ..=91 => 3,
        92..=93 => 2,
        94..=95 => 1,
        _ => 0,
    }
}

/// Scale 2 needs to know whether the patient is on oxygen only at 93% and
/// above; `None` when that is needed and was not charted.
#[must_use]
pub const fn spo2_scale2(spo2: i32, on_oxygen: Option<bool>) -> Option<i32> {
    match spo2 {
        ..=83 => Some(3),
        84..=85 => Some(2),
        86..=87 => Some(1),
        88..=92 => Some(0),
        _ => match on_oxygen {
            None => None,
            Some(false) => Some(0),
            Some(true) => Some(match spo2 {
                93..=94 => 1,
                95..=96 => 2,
                _ => 3,
            }),
        },
    }
}

#[must_use]
pub const fn systolic(sbp: i32) -> i32 {
    match sbp {
        ..=90 => 3,
        91..=100 => 2,
        101..=110 => 1,
        111..=219 => 0,
        _ => 3,
    }
}

#[must_use]
pub const fn pulse(p: i32) -> i32 {
    match p {
        ..=40 => 3,
        41..=50 => 1,
        51..=90 => 0,
        91..=110 => 1,
        111..=130 => 2,
        _ => 3,
    }
}

/// Temperature in tenths of a degree.
#[must_use]
pub const fn temperature(tenths: i32) -> i32 {
    match tenths {
        ..=350 => 3,
        351..=360 => 1,
        361..=380 => 0,
        381..=390 => 1,
        _ => 2,
    }
}

#[must_use]
pub const fn consciousness(c: Consciousness) -> i32 {
    match c {
        Consciousness::A => 0,
        _ => 3,
    }
}

/// The NEWS2 band for an aggregate and whether any single parameter scored 3.
#[must_use]
pub const fn band(total: i32, single_three: bool) -> Band {
    if total >= 7 {
        Band::Emergency
    } else if total >= 5 {
        Band::Urgent
    } else if single_three {
        Band::LowMedium
    } else if total == 0 {
        Band::Routine
    } else {
        Band::Low
    }
}

/// Score a reading. `scale2` is SpO₂ Scale 2, prescribed for hypercapnic
/// respiratory failure.
#[must_use]
pub fn score(o: &Observation, scale2: bool) -> EwsScore {
    let on_oxygen = o.on_oxygen();
    let mut t = Tally::default();
    t.add(
        "respiratory_rate",
        o.respiratory_rate.map(respiration).and_then(scored),
    );
    let spo2 = o.spo2.and_then(|s| {
        if scale2 {
            spo2_scale2(s, on_oxygen)
        } else {
            Some(spo2_scale1(s))
        }
    });
    t.add("spo2", spo2.and_then(scored));
    t.add(
        "air_or_oxygen",
        on_oxygen.map(|on| if on { 2 } else { 0 }).and_then(scored),
    );
    t.add("systolic_bp", o.systolic_bp.map(systolic).and_then(scored));
    t.add("pulse", o.pulse.map(pulse).and_then(scored));
    t.add(
        "consciousness",
        o.consciousness.map(consciousness).and_then(scored),
    );
    t.add(
        "temperature",
        o.temperature_tenths.map(temperature).and_then(scored),
    );
    let total = t.total();
    // "Air or oxygen" scores 2 at most, so a red parameter is a real 3.
    let single_three = t.params.iter().any(|p| p.score == 3);
    EwsScore {
        tool: Tool::News2,
        total,
        band: band(total, single_three),
        incomplete: !t.missing.is_empty(),
        missing: t.missing,
        params: t.params,
        spo2_scale: Some(if scale2 { 2 } else { 1 }),
        age_band: None,
    }
}

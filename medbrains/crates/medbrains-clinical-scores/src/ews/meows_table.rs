//! MEOWS — the CEMACH-recommended Modified Early Obstetric Warning System
//! (Lewis G, ed. *Saving Mothers' Lives*, CEMACH 2007), validated by Singh S,
//! McGlennan A, England A, Simons R, *Anaesthesia* 2012;67:12–18. A woman
//! triggers on one red parameter or two yellow ones at the same time.
//!
//! Parameter bands as tabulated in Singhal S et al., *J Family Med Prim
//! Care* 2023;11(12):7644–51, Table 1:
//!
//! | Parameter         | White    | Yellow                 | Red              |
//! |-------------------|----------|------------------------|------------------|
//! | Respiratory rate  | 10–20    | 21–30                  | <10 or >30       |
//! | SpO₂ (%)          | 95–100   | —                      | <95              |
//! | Temperature (°C)  | 36–38    | 35–<36                 | <35 or >38       |
//! | Heart rate        | 50–100   | >100–120 or 40–<50     | <40 or >120      |
//! | Systolic BP       | 100–140  | 90–<100 or >140–160    | <90 or >160      |
//! | Diastolic BP      | <90      | 90–100                 | >100             |
//! | Neural response   | Alert    | Responds to voice      | Pain, unresponsive |
//!
//! New confusion (the C of ACVPU) is not on the MEOWS chart; it is scored
//! red, as NEWS2 scores it 3, so it is never read as alert.

use super::{Band, Consciousness, EwsScore, Observation, Tally, Tool, Zone};

const fn red() -> (i32, Zone) {
    (1, Zone::Red)
}
const fn yellow() -> (i32, Zone) {
    (1, Zone::Yellow)
}
const fn white() -> (i32, Zone) {
    (0, Zone::White)
}

#[must_use]
pub const fn respiration(rr: i32) -> (i32, Zone) {
    match rr {
        ..=9 | 31.. => red(),
        21..=30 => yellow(),
        _ => white(),
    }
}

#[must_use]
pub const fn spo2(s: i32) -> (i32, Zone) {
    if s < 95 { red() } else { white() }
}

/// Temperature in tenths of a degree.
#[must_use]
pub const fn temperature(tenths: i32) -> (i32, Zone) {
    match tenths {
        ..=349 | 381.. => red(),
        350..=359 => yellow(),
        _ => white(),
    }
}

#[must_use]
pub const fn heart_rate(hr: i32) -> (i32, Zone) {
    match hr {
        ..=39 | 121.. => red(),
        40..=49 | 101..=120 => yellow(),
        _ => white(),
    }
}

#[must_use]
pub const fn systolic(sbp: i32) -> (i32, Zone) {
    match sbp {
        ..=89 | 161.. => red(),
        90..=99 | 141..=160 => yellow(),
        _ => white(),
    }
}

#[must_use]
pub const fn diastolic(dbp: i32) -> (i32, Zone) {
    match dbp {
        101.. => red(),
        90..=100 => yellow(),
        _ => white(),
    }
}

#[must_use]
pub const fn consciousness(c: Consciousness) -> (i32, Zone) {
    match c {
        Consciousness::A => white(),
        Consciousness::V => yellow(),
        Consciousness::C | Consciousness::P | Consciousness::U => red(),
    }
}

/// One red or two yellows trigger; a single yellow is watched more closely.
#[must_use]
pub const fn band(reds: i32, yellows: i32) -> Band {
    if reds >= 1 || yellows >= 2 {
        Band::Urgent
    } else if yellows == 1 {
        Band::Low
    } else {
        Band::Routine
    }
}

#[must_use]
pub fn score(o: &Observation) -> EwsScore {
    let mut t = Tally::default();
    t.add("respiratory_rate", o.respiratory_rate.map(respiration));
    t.add("spo2", o.spo2.map(spo2));
    t.add("temperature", o.temperature_tenths.map(temperature));
    t.add("pulse", o.pulse.map(heart_rate));
    t.add("systolic_bp", o.systolic_bp.map(systolic));
    t.add("diastolic_bp", o.diastolic_bp.map(diastolic));
    t.add("consciousness", o.consciousness.map(consciousness));
    let (reds, yellows) = (t.count(Zone::Red), t.count(Zone::Yellow));
    EwsScore {
        tool: Tool::Meows,
        total: reds + yellows,
        band: band(reds, yellows),
        incomplete: !t.missing.is_empty(),
        missing: t.missing,
        params: t.params,
        spo2_scale: None,
        age_band: None,
    }
}

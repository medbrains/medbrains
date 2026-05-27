//! Embedded India holiday + festival table for the simulator.
//!
//! No external calendar API on Day-4 — the dataset is small and slow-moving.
//! When a date is a holiday or festival, the simulator scales OPD/ER counts
//! and biases the ICD pool toward the festival's typical presentations
//! (Diwali → burns, asthma flares, RTAs; Holi → eye injuries, contact
//! dermatitis; etc.).
//!
//! Mirror this file in TS at `apps/simulator-admin/src/calendar.ts` for the
//! preview line in the UI. The Python diff script
//! `scripts/check_simulator_calendar.py` is the canonical drift gate.

use chrono::{Datelike, NaiveDate};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HolidayKind {
    PublicHoliday,
    Festival,
    Observance,
}

#[derive(Debug)]
pub struct HolidayInfo {
    pub kind: HolidayKind,
    pub name: &'static str,
    /// ICD-10 codes that should be over-represented on this date.
    pub icd_boost: &'static [&'static str],
}

/// Fixed-date holidays (same month/day every year).
const FIXED: &[((u32, u32), HolidayInfo)] = &[
    (
        (1, 14),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Pongal / Makar Sankranti",
            icd_boost: &["T20", "V01"],
        },
    ),
    (
        (1, 26),
        HolidayInfo {
            kind: HolidayKind::PublicHoliday,
            name: "Republic Day",
            icd_boost: &[],
        },
    ),
    (
        (8, 15),
        HolidayInfo {
            kind: HolidayKind::PublicHoliday,
            name: "Independence Day",
            icd_boost: &[],
        },
    ),
    (
        (10, 2),
        HolidayInfo {
            kind: HolidayKind::PublicHoliday,
            name: "Gandhi Jayanti",
            icd_boost: &[],
        },
    ),
    (
        (12, 25),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Christmas",
            icd_boost: &["F10"],
        },
    ),
    (
        (12, 31),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "New Year's Eve",
            icd_boost: &["F10", "V01"],
        },
    ),
];

/// Variable-date holidays known for 2025-2027. Updated yearly.
const VARIABLE: &[(NaiveDateLiteral, HolidayInfo)] = &[
    // 2025
    (
        NaiveDateLiteral(2025, 3, 14),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Holi",
            icd_boost: &["H10", "L23", "T20"],
        },
    ),
    (
        NaiveDateLiteral(2025, 3, 31),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Eid-ul-Fitr",
            icd_boost: &[],
        },
    ),
    (
        NaiveDateLiteral(2025, 6, 7),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Eid-ul-Adha",
            icd_boost: &[],
        },
    ),
    (
        NaiveDateLiteral(2025, 8, 16),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Janmashtami",
            icd_boost: &[],
        },
    ),
    (
        NaiveDateLiteral(2025, 8, 27),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Ganesh Chaturthi",
            icd_boost: &[],
        },
    ),
    (
        NaiveDateLiteral(2025, 10, 2),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Dussehra",
            icd_boost: &["T20"],
        },
    ),
    (
        NaiveDateLiteral(2025, 10, 20),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Diwali",
            icd_boost: &["T20", "J45", "V01"],
        },
    ),
    // 2026
    (
        NaiveDateLiteral(2026, 3, 4),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Holi",
            icd_boost: &["H10", "L23", "T20"],
        },
    ),
    (
        NaiveDateLiteral(2026, 3, 21),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Eid-ul-Fitr",
            icd_boost: &[],
        },
    ),
    (
        NaiveDateLiteral(2026, 5, 27),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Eid-ul-Adha",
            icd_boost: &[],
        },
    ),
    (
        NaiveDateLiteral(2026, 9, 5),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Janmashtami",
            icd_boost: &[],
        },
    ),
    (
        NaiveDateLiteral(2026, 9, 14),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Ganesh Chaturthi",
            icd_boost: &[],
        },
    ),
    (
        NaiveDateLiteral(2026, 10, 20),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Dussehra",
            icd_boost: &["T20"],
        },
    ),
    (
        NaiveDateLiteral(2026, 11, 8),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Diwali",
            icd_boost: &["T20", "J45", "V01"],
        },
    ),
    // 2027
    (
        NaiveDateLiteral(2027, 3, 22),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Holi",
            icd_boost: &["H10", "L23", "T20"],
        },
    ),
    (
        NaiveDateLiteral(2027, 3, 10),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Eid-ul-Fitr",
            icd_boost: &[],
        },
    ),
    (
        NaiveDateLiteral(2027, 5, 17),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Eid-ul-Adha",
            icd_boost: &[],
        },
    ),
    (
        NaiveDateLiteral(2027, 8, 25),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Janmashtami",
            icd_boost: &[],
        },
    ),
    (
        NaiveDateLiteral(2027, 9, 4),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Ganesh Chaturthi",
            icd_boost: &[],
        },
    ),
    (
        NaiveDateLiteral(2027, 10, 9),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Dussehra",
            icd_boost: &["T20"],
        },
    ),
    (
        NaiveDateLiteral(2027, 10, 29),
        HolidayInfo {
            kind: HolidayKind::Festival,
            name: "Diwali",
            icd_boost: &["T20", "J45", "V01"],
        },
    ),
];

#[allow(clippy::doc_markdown)]
struct NaiveDateLiteral(i32, u32, u32);

pub fn lookup(date: NaiveDate) -> Option<&'static HolidayInfo> {
    let (month, day) = (date.month(), date.day());
    for (key, info) in FIXED {
        if *key == (month, day) {
            return Some(info);
        }
    }
    for (literal, info) in VARIABLE {
        if literal.0 == date.year() && literal.1 == month && literal.2 == day {
            return Some(info);
        }
    }
    None
}

pub fn is_holiday(date: NaiveDate) -> bool {
    lookup(date).is_some()
}

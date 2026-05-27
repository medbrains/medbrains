//! Season → ICD / chief-complaint weighting.
//!
//! India-only on Day-4. Seasons:
//! - Summer (Mar–Jun): heat / GI presentations.
//! - Monsoon (Jul–Sep): vector-borne, gastroenteritis, viral fever.
//! - Post-monsoon (Oct–Nov): dengue peak, asthma flares.
//! - Winter (Dec–Feb): respiratory, cardiac, pollution-linked.

use chrono::{Datelike, NaiveDate};

#[derive(Debug, Clone, Copy)]
pub struct SeasonProfile {
    pub label: &'static str,
    pub boosted_icds: &'static [&'static str],
    pub boosted_complaints: &'static [&'static str],
}

pub const SUMMER: SeasonProfile = SeasonProfile {
    label: "summer",
    boosted_icds: &["T67", "A09", "R63.1", "R50.9"],
    boosted_complaints: &[
        "Heat exhaustion",
        "Loose motions",
        "High fever with chills",
        "Severe thirst / dehydration",
    ],
};

pub const MONSOON: SeasonProfile = SeasonProfile {
    label: "monsoon",
    boosted_icds: &["A90", "B50", "A27", "R50.9", "A09"],
    boosted_complaints: &[
        "High fever with chills",
        "Loose motions",
        "Joint pain",
        "Body ache and weakness",
    ],
};

pub const POST_MONSOON: SeasonProfile = SeasonProfile {
    label: "post_monsoon",
    boosted_icds: &["A90", "J45", "J18", "R50.9"],
    boosted_complaints: &["Breathlessness", "Cough and cold", "High fever with chills"],
};

pub const WINTER: SeasonProfile = SeasonProfile {
    label: "winter",
    boosted_icds: &["J06.9", "J18", "I21", "J45"],
    boosted_complaints: &[
        "Cough and cold",
        "Sore throat",
        "Chest pain",
        "Breathlessness",
    ],
};

pub fn season_for(date: NaiveDate, region: &str) -> SeasonProfile {
    if region != "IN" {
        // Day-4 only supports IN; fall back to Indian seasons elsewhere.
    }
    match date.month() {
        3..=6 => SUMMER,
        7..=9 => MONSOON,
        10..=11 => POST_MONSOON,
        _ => WINTER,
    }
}

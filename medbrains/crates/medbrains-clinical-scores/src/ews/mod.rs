//! Early-warning scores computed from a charted set of observations.
//!
//! Every vitals reading is scored with the tool that fits the patient:
//!
//! * **NEWS2** for adults (16 and over) — Royal College of Physicians,
//!   *National Early Warning Score (NEWS) 2*, 2017: Chart 1 (scoring),
//!   Chart 2 (thresholds and triggers), Chart 4 (clinical response and
//!   frequency of monitoring). SpO₂ Scale 2 is used only when a clinician has
//!   prescribed it for a patient with hypercapnic respiratory failure.
//! * **PEWS** for children (under 16) — the Aotearoa New Zealand national
//!   paediatric early warning system (Health Quality & Safety Commission,
//!   *Paediatric vital signs chart: user guide*, 2023, Table 1 "PEWS score
//!   matrix"), with its four age-banded charts.
//! * **MEOWS** for pregnant and post-partum women — the CEMACH-recommended
//!   Modified Early Obstetric Warning System (Lewis, *Saving Mothers' Lives*,
//!   2007), as validated by Singh et al., *Anaesthesia* 2012;67:12–18: one red
//!   or two yellow triggers. Parameter bands as tabulated in Singhal et al.,
//!   *J Family Med Prim Care* 2023;11:7644–51, Table 1.
//!
//! A parameter that was not charted is never scored as normal: the score is
//! marked incomplete, the missing parameters are named, and the band is the
//! one the charted parameters already reach (it can only rise once the rest
//! are charted).

use serde::{Deserialize, Serialize};

pub mod meows_table;
pub mod news2_table;
pub mod pews_table;
mod policy;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_pews;

pub use policy::{BandMinutes, EwsPolicy, PolicyError};

/// The scoring tool used for a reading.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Tool {
    News2,
    Pews,
    Meows,
}

impl Tool {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::News2 => "news2",
            Self::Pews => "pews",
            Self::Meows => "meows",
        }
    }

    #[must_use]
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "news2" => Some(Self::News2),
            "pews" => Some(Self::Pews),
            "meows" => Some(Self::Meows),
            _ => None,
        }
    }
}

/// How urgently a score needs a response, lowest first.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Band {
    Routine,
    Low,
    LowMedium,
    Urgent,
    Emergency,
}

impl Band {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Routine => "routine",
            Self::Low => "low",
            Self::LowMedium => "low_medium",
            Self::Urgent => "urgent",
            Self::Emergency => "emergency",
        }
    }

    #[must_use]
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "routine" => Some(Self::Routine),
            "low" => Some(Self::Low),
            "low_medium" => Some(Self::LowMedium),
            "urgent" => Some(Self::Urgent),
            "emergency" => Some(Self::Emergency),
            _ => None,
        }
    }
}

/// A parameter's colour zone, as the paper charts show it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Zone {
    White,
    Yellow,
    Orange,
    Red,
    /// PEWS single-parameter trigger: an emergency response whatever the total.
    Blue,
}

/// ACVPU: Alert, new Confusion, responds to Voice, to Pain, Unresponsive.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Consciousness {
    A,
    C,
    V,
    P,
    U,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OxygenDevice {
    RoomAir,
    NasalProngs,
    Mask,
    HighFlow,
    Other,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Distress {
    Nil,
    Mild,
    Moderate,
    Severe,
}

/// PEWS chart by age.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgeBand {
    #[serde(rename = "0-11m")]
    Infant,
    #[serde(rename = "1-4y")]
    Toddler,
    #[serde(rename = "5-11y")]
    Child,
    #[serde(rename = "12+y")]
    Adolescent,
}

impl AgeBand {
    /// The chart for a child of `months` completed months; `None` from 16 years.
    #[must_use]
    pub const fn for_months(months: i32) -> Option<Self> {
        match months {
            ..=11 => Some(Self::Infant),
            12..=59 => Some(Self::Toddler),
            60..=143 => Some(Self::Child),
            144..=191 => Some(Self::Adolescent),
            _ => None,
        }
    }

    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Infant => "0-11m",
            Self::Toddler => "1-4y",
            Self::Child => "5-11y",
            Self::Adolescent => "12+y",
        }
    }
}

/// One charted set of observations. Temperature, oxygen flow and capillary
/// refill are in tenths (36.8 °C → 368, 1.5 L/min → 15, 2.5 s → 25) so every
/// boundary is an exact integer comparison.
#[derive(Debug, Clone, Default)]
pub struct Observation {
    pub respiratory_rate: Option<i32>,
    pub spo2: Option<i32>,
    pub temperature_tenths: Option<i32>,
    pub systolic_bp: Option<i32>,
    pub diastolic_bp: Option<i32>,
    pub pulse: Option<i32>,
    pub consciousness: Option<Consciousness>,
    pub oxygen_device: Option<OxygenDevice>,
    pub oxygen_flow_tenths: Option<i32>,
    pub fio2_percent: Option<i32>,
    pub capillary_refill_tenths: Option<i32>,
    pub respiratory_distress: Option<Distress>,
}

impl Observation {
    /// On supplemental oxygen or respiratory support; `None` when not charted.
    #[must_use]
    pub fn on_oxygen(&self) -> Option<bool> {
        self.oxygen_device.map(|d| d != OxygenDevice::RoomAir)
    }
}

/// One parameter's contribution.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ParamScore {
    pub name: &'static str,
    pub score: i32,
    pub zone: Zone,
}

/// A scored reading.
#[derive(Debug, Clone, Serialize)]
pub struct EwsScore {
    pub tool: Tool,
    /// NEWS2 and PEWS: the aggregate. MEOWS: the number of parameters outside
    /// the white zone (MEOWS has no aggregate; it triggers on colours).
    pub total: i32,
    pub band: Band,
    pub incomplete: bool,
    pub missing: Vec<&'static str>,
    pub params: Vec<ParamScore>,
    /// NEWS2 only: 1 or 2.
    pub spo2_scale: Option<i16>,
    /// PEWS only.
    pub age_band: Option<AgeBand>,
}

/// Collects parameter scores and the names of parameters not charted.
#[derive(Default)]
pub(crate) struct Tally {
    pub(crate) params: Vec<ParamScore>,
    pub(crate) missing: Vec<&'static str>,
}

impl Tally {
    pub(crate) fn add(&mut self, name: &'static str, scored: Option<(i32, Zone)>) {
        match scored {
            Some((score, zone)) => self.params.push(ParamScore { name, score, zone }),
            None => self.missing.push(name),
        }
    }

    pub(crate) fn total(&self) -> i32 {
        self.params.iter().map(|p| p.score).sum()
    }

    pub(crate) fn any(&self, zone: Zone) -> bool {
        self.params.iter().any(|p| p.zone == zone)
    }

    pub(crate) fn count(&self, zone: Zone) -> i32 {
        i32::try_from(self.params.iter().filter(|p| p.zone == zone).count()).unwrap_or(i32::MAX)
    }
}

/// Which tool fits the patient: obstetric first (MEOWS applies at any age),
/// then by age; a patient of unknown age is scored as an adult and the
/// missing date of birth makes the score incomplete.
#[derive(Debug, Clone, Copy)]
pub struct PatientKind {
    pub age_months: Option<i32>,
    pub obstetric: bool,
    pub spo2_scale2: bool,
    /// A clinician's explicit choice, overriding the automatic one.
    pub tool_override: Option<Tool>,
}

/// Score `obs` with the tool that fits `kind`.
#[must_use]
pub fn score(obs: &Observation, kind: &PatientKind) -> EwsScore {
    let age_band = kind.age_months.and_then(AgeBand::for_months);
    let tool = kind.tool_override.unwrap_or(if kind.obstetric {
        Tool::Meows
    } else if age_band.is_some() {
        Tool::Pews
    } else {
        Tool::News2
    });
    let mut scored = match tool {
        Tool::News2 => news2_table::score(obs, kind.spo2_scale2),
        Tool::Meows => meows_table::score(obs),
        // An override to PEWS with no age band falls back to the 12+ chart and
        // is marked incomplete by the missing age below.
        Tool::Pews => pews_table::score(obs, age_band.unwrap_or(AgeBand::Adolescent)),
    };
    let age_unknown = kind.age_months.is_none() && !kind.obstetric && kind.tool_override.is_none();
    if age_unknown || (tool == Tool::Pews && age_band.is_none()) {
        scored.missing.push("age");
        scored.incomplete = true;
    }
    scored
}

//! What a hospital is obliged to do, and whether it has.
//!
//! The registers next door record what happened: this drill, that gas reading,
//! this waste handover. None of them can answer the question an assessor
//! actually asks, which is what did *not* happen. A fire drill that was never
//! run leaves no row, and a register of rows cannot show you an absence.
//!
//! So obligations are written down here as data — what must be done, how
//! often, and which register proves it — and the state of each is computed
//! against the calendar rather than tracked by hand.
//!
//! # The cadences are defaults, not law
//!
//! Every interval below is a starting point drawn from common NABH and
//! statutory practice, and **must be confirmed by the hospital's quality team
//! against the edition of the standard they are accredited under**. They vary
//! by entry level versus full accreditation, by state, and between editions.
//! A wrong interval here is worse than none: it reports compliance that was
//! never assessed. That is why every norm carries its [`Basis`], and why the
//! catalogue is a default an administrator is expected to override.

use chrono::{DateTime, Datelike, Duration, NaiveDate, Utc};

/// How often an obligation comes round.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Cadence {
    Daily,
    Weekly,
    Monthly,
    Quarterly,
    HalfYearly,
    Yearly,
    /// Every `n` days, for anything the fixed periods do not fit.
    EveryDays(u32),
}

impl Cadence {
    /// How long may pass between one occurrence and the next.
    #[must_use]
    pub fn interval(self) -> Duration {
        match self {
            Cadence::Daily => Duration::days(1),
            Cadence::Weekly => Duration::days(7),
            Cadence::Monthly => Duration::days(31),
            Cadence::Quarterly => Duration::days(92),
            Cadence::HalfYearly => Duration::days(183),
            Cadence::Yearly => Duration::days(366),
            Cadence::EveryDays(days) => Duration::days(i64::from(days.max(1))),
        }
    }

    /// How long before it falls due somebody should be told.
    ///
    /// Proportionate rather than fixed: a week's warning on a daily gas
    /// reading is noise, and a day's warning on an annual licence renewal is
    /// not enough time to do anything about it.
    #[must_use]
    pub fn warn_within(self) -> Duration {
        match self {
            Cadence::Daily => Duration::hours(4),
            Cadence::Weekly => Duration::days(2),
            Cadence::Monthly | Cadence::EveryDays(_) => Duration::days(5),
            Cadence::Quarterly => Duration::days(14),
            Cadence::HalfYearly => Duration::days(30),
            Cadence::Yearly => Duration::days(60),
        }
    }

    #[must_use]
    pub fn label(self) -> &'static str {
        match self {
            Cadence::Daily => "daily",
            Cadence::Weekly => "weekly",
            Cadence::Monthly => "monthly",
            Cadence::Quarterly => "quarterly",
            Cadence::HalfYearly => "twice a year",
            Cadence::Yearly => "yearly",
            Cadence::EveryDays(_) => "on a fixed interval",
        }
    }
}

/// Where an obligation comes from, so somebody can go and check it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Basis {
    /// An NABH standard. Chapter and clause vary by edition.
    Nabh,
    /// Bio-Medical Waste Management Rules.
    BioMedicalWasteRules,
    /// State fire safety licensing.
    FireSafety,
    /// Locally agreed practice, not an external requirement.
    HospitalPolicy,
}

/// One obligation.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Norm {
    /// Stable identifier, used to attach an override or an exemption.
    pub code: &'static str,
    pub title: &'static str,
    /// What an assessor would expect to be shown.
    pub evidence: &'static str,
    /// The register that holds it, and the column that dates it.
    pub source_table: &'static str,
    pub source_date_column: &'static str,
    pub cadence: Cadence,
    pub basis: Basis,
    /// Whether missing it is a finding or a note.
    pub mandatory: bool,
}

/// Where an obligation stands today.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Standing {
    /// Done recently enough.
    Met,
    /// Still met, but coming round soon.
    DueSoon,
    /// The interval has passed since it was last done.
    Overdue,
    /// No record of it ever having been done.
    ///
    /// Separate from overdue on purpose. "Late" and "never" are different
    /// conversations: one is a slipped schedule, the other usually means
    /// nobody was ever made responsible for it.
    NeverRecorded,
}

impl Standing {
    /// Whether this needs somebody's attention.
    #[must_use]
    pub fn needs_attention(self) -> bool {
        matches!(self, Standing::Overdue | Standing::NeverRecorded)
    }
}

/// An obligation, and where it stands.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Assessment {
    pub code: &'static str,
    pub title: &'static str,
    pub cadence: Cadence,
    pub basis: Basis,
    pub mandatory: bool,
    pub standing: Standing,
    /// When it was last done, if ever.
    pub last_done: Option<DateTime<Utc>>,
    /// When it next falls due. `None` when it has never been done, because
    /// there is nothing to count from — it is due now.
    pub due_at: Option<DateTime<Utc>>,
    /// How many days late, for the overdue ones. Sorting by this puts the
    /// worst first, which is the order anybody wants to read.
    pub days_overdue: i64,
}

/// Work out where one obligation stands.
///
/// `last_done` is whatever the register says, or `None` if it says nothing.
#[must_use]
pub fn assess(norm: &Norm, last_done: Option<DateTime<Utc>>, now: DateTime<Utc>) -> Assessment {
    let Some(last) = last_done else {
        return Assessment {
            code: norm.code,
            title: norm.title,
            cadence: norm.cadence,
            basis: norm.basis,
            mandatory: norm.mandatory,
            standing: Standing::NeverRecorded,
            last_done: None,
            due_at: None,
            days_overdue: 0,
        };
    };

    let due_at = last + norm.cadence.interval();
    // A record dated in the future is a data-entry mistake, not compliance
    // stretching further ahead than it should. Treated as done now so it does
    // not report a year of cover from one mistyped date.
    let due_at = if last > now { now + norm.cadence.interval() } else { due_at };

    let standing = if now > due_at {
        Standing::Overdue
    } else if now + norm.cadence.warn_within() >= due_at {
        Standing::DueSoon
    } else {
        Standing::Met
    };

    Assessment {
        code: norm.code,
        title: norm.title,
        cadence: norm.cadence,
        basis: norm.basis,
        mandatory: norm.mandatory,
        standing,
        last_done: Some(last),
        due_at: Some(due_at),
        days_overdue: (now - due_at).num_days().max(0),
    }
}

/// Assess a whole catalogue, worst first.
///
/// Ordered so the list reads as a work queue: never-recorded mandatory items
/// first, then the most overdue, then what is merely approaching. A compliance
/// screen sorted alphabetically is one nobody acts on.
#[must_use]
pub fn assess_all(
    norms: &[Norm],
    last_done: &dyn Fn(&Norm) -> Option<DateTime<Utc>>,
    now: DateTime<Utc>,
) -> Vec<Assessment> {
    let mut all: Vec<Assessment> = norms
        .iter()
        .map(|norm| assess(norm, last_done(norm), now))
        .collect();

    all.sort_by(|a, b| {
        severity(b).cmp(&severity(a)).then(b.days_overdue.cmp(&a.days_overdue))
    });
    all
}

/// How loudly something is asking for attention.
fn severity(assessment: &Assessment) -> u8 {
    let mandatory = u8::from(assessment.mandatory);
    match assessment.standing {
        Standing::NeverRecorded => 4 + mandatory,
        Standing::Overdue => 2 + mandatory,
        Standing::DueSoon => 1,
        Standing::Met => 0,
    }
}

/// The financial year an Indian statutory return covers, for a given date.
///
/// April to March. Worth having because the annual returns a hospital files
/// are dated by it, and computing it from the calendar year is the classic way
/// to file the wrong one every January.
#[must_use]
pub fn financial_year(on: NaiveDate) -> (i32, i32) {
    if on.month() >= 4 {
        (on.year(), on.year() + 1)
    } else {
        (on.year() - 1, on.year())
    }
}

/// The default catalogue.
///
/// **Every cadence here is a starting point, not a citation.** They differ by
/// accreditation level, by state, and by edition of the standard. Whoever runs
/// quality at the hospital has to confirm each one before it is trusted; until
/// then this reports a schedule, not compliance.
#[must_use]
pub fn default_catalogue() -> Vec<Norm> {
    vec![
        Norm {
            code: "FMS.FIRE.DRILL",
            title: "Mock fire drill",
            evidence: "Drill record with time to evacuate and corrective actions",
            source_table: "nabh_fire_safety_drills",
            source_date_column: "drill_at",
            cadence: Cadence::HalfYearly,
            basis: Basis::Nabh,
            mandatory: true,
        },
        Norm {
            code: "FMS.GAS.CHECK",
            title: "Medical gas line reading",
            evidence: "Reading log with pressure and signature",
            source_table: "fms_gas_readings",
            source_date_column: "reading_at",
            cadence: Cadence::Daily,
            basis: Basis::Nabh,
            mandatory: true,
        },
        Norm {
            code: "BMW.HANDOVER",
            title: "Bio-medical waste handover to the operator",
            evidence: "Handover log with weight by category",
            source_table: "nabh_bmw_disposal_log",
            source_date_column: "handed_over_at",
            cadence: Cadence::Daily,
            basis: Basis::BioMedicalWasteRules,
            mandatory: true,
        },
        Norm {
            code: "CODE.BLUE.DRILL",
            title: "Mock code blue",
            evidence: "Activation record with response time and debrief",
            source_table: "nabh_code_blue_activations",
            source_date_column: "activated_at",
            cadence: Cadence::Quarterly,
            basis: Basis::Nabh,
            mandatory: true,
        },
        Norm {
            code: "BME.CALIBRATION",
            title: "Biomedical equipment calibration",
            evidence: "Calibration certificate from the agency",
            source_table: "bme_calibrations",
            source_date_column: "last_calibrated_date",
            cadence: Cadence::Yearly,
            basis: Basis::Nabh,
            mandatory: true,
        },
    ]
}

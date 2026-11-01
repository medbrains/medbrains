//! The building-block catalogue a flow designer places (RFC §11.2).
//!
//! Every registered signal, task and action with what it does in one sentence,
//! who holds it, the permission that role needs, and its inputs; and every
//! fact a branch may test, with its type. A designer can place nothing else.
//! The behaviour of each block lives in `registry`; this is its label.

use medbrains_core::permissions;
use serde::Serialize;

/// One registered block.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct Block {
    /// `signal`, `task` or `action`, as the station kind names it.
    pub kind: &'static str,
    pub code: &'static str,
    pub name: &'static str,
    /// What it does, in one sentence.
    pub does: &'static str,
    /// Who holds it, in plain words.
    pub holder: &'static str,
    /// The role that holds it unless the designer picks another.
    pub role: &'static str,
    /// The permission the holder's role needs to clear it.
    pub permission: &'static str,
    /// What the holder records, in plain words.
    pub inputs: &'static [&'static str],
    /// The stage it usually sits in.
    pub stage: &'static str,
    /// Expected minutes, the timetable default.
    pub sla_minutes: Option<i64>,
}

const fn signal(
    code: &'static str,
    name: &'static str,
    does: &'static str,
    who: (&'static str, &'static str, &'static str),
    stage: &'static str,
) -> Block {
    Block {
        kind: "signal",
        code,
        name,
        does,
        holder: who.0,
        role: who.1,
        permission: who.2,
        inputs: &[],
        stage,
        sla_minutes: Some(60),
    }
}

pub const BLOCKS: &[Block] = &[
    signal(
        "ipd.discharge_summary_signed",
        "Summary signed",
        "Holds the patient until the discharge summary is finalised and signed.",
        (
            "Treating doctor",
            "doctor",
            permissions::ipd::discharge_summary::FINALIZE,
        ),
        "Clinical sign-off",
    ),
    signal(
        "ipd.doctor_cleared",
        "Doctor clearance",
        "Holds until the treating doctor clears the patient on the discharge TAT log.",
        (
            "Treating doctor",
            "doctor",
            permissions::ipd::discharge_tat::DOCTOR_UPDATE,
        ),
        "Clinical sign-off",
    ),
    signal(
        "ipd.nursing_cleared",
        "Nursing clearance",
        "Holds until the ward nurse clears the patient on the discharge TAT log.",
        (
            "Ward nurse",
            "nurse",
            permissions::ipd::discharge_tat::NURSING_UPDATE,
        ),
        "Ward handover",
    ),
    signal(
        "ipd.pharmacy_cleared",
        "Pharmacy returns",
        "Holds until pharmacy has taken back unused medicines and cleared the patient.",
        (
            "Pharmacy",
            "pharmacist",
            permissions::ipd::discharge_tat::PHARMACY_UPDATE,
        ),
        "Pharmacy",
    ),
    signal(
        "insurance.tpa_approved",
        "TPA clearance",
        "Holds until the TPA approves the pre-authorisation for this stay.",
        (
            "TPA desk",
            "insurance_officer",
            permissions::insurance::prior_auth::UPDATE,
        ),
        "Before billing",
    ),
    signal(
        "ipd.billing_cleared",
        "Billing cleared",
        "Holds until the bill is settled or the billing desk records clearance.",
        (
            "Billing desk",
            "billing_clerk",
            permissions::ipd::discharge_tat::BILLING_UPDATE,
        ),
        "Billing",
    ),
    signal(
        "mlc.police_intimated",
        "MLC police intimation",
        "Holds a medico-legal patient until the police are informed of the discharge.",
        (
            "Treating doctor",
            "doctor",
            permissions::emergency::mlc_police_intimations::CREATE,
        ),
        "Clinical sign-off",
    ),
    Block {
        kind: "task",
        code: "ipd.ward_handover",
        name: "Ward handover",
        does: "Waits until every handover item on the discharge checklist is done.",
        holder: "Ward nurse",
        role: "nurse",
        permission: permissions::ipd::discharge_checklist::UPDATE,
        inputs: &["Discharge checklist items"],
        stage: "Ward handover",
        sla_minutes: Some(90),
    },
    Block {
        kind: "task",
        code: "ipd.physio_clearance",
        name: "Physiotherapy clearance",
        does: "Waits until physiotherapy has seen the patient and clears them for discharge.",
        holder: "Physiotherapy",
        role: "doctor",
        permission: permissions::ipd::discharge::PHYSIO_CLEARANCE,
        inputs: &["Cleared by physiotherapy (yes)"],
        stage: "Before billing",
        sla_minutes: Some(60),
    },
    Block {
        kind: "task",
        code: "ipd.ms_signoff",
        name: "Superintendent sign-off",
        does: "Waits for the medical superintendent to sign off the discharge.",
        holder: "Medical superintendent",
        role: "medical_superintendent",
        permission: permissions::flows::VIEW,
        inputs: &["Sign-off (yes)"],
        stage: "Discharge",
        sla_minutes: Some(60),
    },
    Block {
        kind: "action",
        code: "ipd.discharge.finalize",
        name: "Discharge",
        does: "Discharges the patient through the IPD discharge, with all its own checks.",
        holder: "Treating doctor",
        role: "doctor",
        permission: permissions::ipd::discharge::CREATE,
        inputs: &["Discharge type"],
        stage: "Discharge",
        sla_minutes: Some(30),
    },
];

#[must_use]
pub fn block(kind: &str, code: &str) -> Option<&'static Block> {
    BLOCKS.iter().find(|b| b.kind == kind && b.code == code)
}

/// The type of a fact, which fixes the operators a branch may use on it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum FactType {
    Bool,
    Number,
    /// A code from a tenant list (a department code).
    Text,
}

impl FactType {
    #[must_use]
    pub const fn operators(self) -> &'static [&'static str] {
        match self {
            Self::Bool => &["eq", "ne"],
            Self::Number => &["eq", "ne", "gt", "gte", "lt", "lte"],
            Self::Text => &["eq", "ne", "in"],
        }
    }
}

/// A fact a branch may test.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct Fact {
    pub key: &'static str,
    pub label: &'static str,
    #[serde(rename = "type")]
    pub ty: FactType,
    /// Who a yes picks out, for sentences ("insurance patients"); empty for
    /// facts that are not yes/no.
    pub who: &'static str,
}

pub const FACTS: &[Fact] = &[
    Fact {
        key: "is_insurance",
        who: "insurance patients",
        label: "Insurance (cashless) patient",
        ty: FactType::Bool,
    },
    Fact {
        key: "is_mlc",
        who: "medico-legal patients",
        label: "Medico-legal case",
        ty: FactType::Bool,
    },
    Fact {
        key: "department",
        who: "",
        label: "Admitting department",
        ty: FactType::Text,
    },
    Fact {
        key: "age_years",
        who: "",
        label: "Age in years",
        ty: FactType::Number,
    },
];

#[must_use]
pub fn fact(key: &str) -> Option<&'static Fact> {
    FACTS.iter().find(|f| f.key == key)
}

//! The IPD discharge library flow (RFC §7 phase 1).
//!
//! The default route is today's discharge, station for station: the
//! checklist (`medbrains_ipd` `default_discharge_checklist_items`) in its
//! order, the four discharge-TAT clearances (doctor, nursing, pharmacy,
//! billing) that `update_discharge_tat` already requires before completion,
//! then the existing discharge endpoint. With the default switches nothing is
//! added: no TPA station, no superintendent sign-off.

use serde_json::{Value, json};

use crate::model::{FlowDef, Station, StationKind, SwitchDef, SwitchKind, SwitchOption};

pub const CODE: &str = "ipd.discharge";

/// Switch: insurance patients need TPA clearance before billing.
pub const SW_TPA: &str = "tpa_before_billing";
/// Switch: who signs off the final discharge.
pub const SW_SIGNOFF: &str = "final_signoff";

struct Spec {
    key: &'static str,
    name: &'static str,
    stage: &'static str,
    kind: StationKind,
    holder: &'static str,
    sla: Option<i64>,
}

fn station(s: Spec) -> Station {
    Station {
        key: s.key.to_owned(),
        name: s.name.to_owned(),
        stage: s.stage.to_owned(),
        kind: s.kind,
        lane: None,
        switch_when: Value::Null,
        fact_when: Value::Null,
        sla_minutes: s.sla,
        locked: false,
        holder: s.holder.to_owned(),
        required_by: None,
        path: String::new(),
    }
}

fn signal(name: &str) -> StationKind {
    StationKind::Signal {
        signal: name.to_owned(),
    }
}

fn task(name: &str) -> StationKind {
    StationKind::Task {
        task: name.to_owned(),
    }
}

#[allow(clippy::too_many_lines)] // one literal track, read top to bottom
fn stations() -> Vec<Station> {
    let summary = Station {
        locked: true,
        required_by: Some(
            "NABH: a signed discharge summary is handed to every discharged patient".to_owned(),
        ),
        ..station(Spec {
            key: "summary_signed",
            name: "Summary signed",
            stage: "Clinical sign-off",
            kind: signal("ipd.discharge_summary_signed"),
            holder: "Treating doctor",
            sla: Some(120),
        })
    };
    let tpa = Station {
        lane: Some("Insurance".to_owned()),
        switch_when: json!({ SW_TPA: true }),
        fact_when: json!({ "is_insurance": true }),
        ..station(Spec {
            key: "tpa_clearance",
            name: "TPA clearance",
            stage: "Before billing",
            kind: signal("insurance.tpa_approved"),
            holder: "TPA desk",
            sla: Some(180),
        })
    };
    let ms = Station {
        lane: Some("Superintendent".to_owned()),
        switch_when: json!({ SW_SIGNOFF: "medical_superintendent" }),
        ..station(Spec {
            key: "ms_signoff",
            name: "Superintendent sign-off",
            stage: "Discharge",
            kind: task("ipd.ms_signoff"),
            holder: "Medical superintendent",
            sla: Some(60),
        })
    };
    vec![
        summary,
        station(Spec {
            key: "doctor_cleared",
            name: "Doctor clearance",
            stage: "Clinical sign-off",
            kind: signal("ipd.doctor_cleared"),
            holder: "Treating doctor",
            sla: Some(60),
        }),
        station(Spec {
            key: "ward_handover",
            name: "Ward handover",
            stage: "Ward handover",
            kind: task("ipd.ward_handover"),
            holder: "Ward nurse",
            sla: Some(90),
        }),
        station(Spec {
            key: "nursing_cleared",
            name: "Nursing clearance",
            stage: "Ward handover",
            kind: signal("ipd.nursing_cleared"),
            holder: "Ward nurse",
            sla: Some(30),
        }),
        station(Spec {
            key: "pharmacy_returns",
            name: "Pharmacy returns",
            stage: "Pharmacy",
            kind: signal("ipd.pharmacy_cleared"),
            holder: "Pharmacy",
            sla: Some(60),
        }),
        station(Spec {
            key: "insurance_check",
            name: "Insurance patient?",
            stage: "Before billing",
            kind: StationKind::Switch {
                fact: "is_insurance".to_owned(),
            },
            holder: "Automatic",
            sla: None,
        }),
        tpa,
        station(Spec {
            key: "billing_cleared",
            name: "Billing cleared",
            stage: "Billing",
            kind: signal("ipd.billing_cleared"),
            holder: "Billing desk",
            sla: Some(60),
        }),
        ms,
        station(Spec {
            key: "finalize",
            name: "Discharge",
            stage: "Discharge",
            kind: StationKind::Action {
                action: "ipd.discharge.finalize".to_owned(),
            },
            holder: "Treating doctor",
            sla: Some(30),
        }),
        station(Spec {
            key: "done",
            name: "Discharged",
            stage: "Discharge",
            kind: StationKind::End,
            holder: "Automatic",
            sla: None,
        }),
    ]
}

fn effects(pairs: &[(&str, &str)]) -> Vec<SwitchOption> {
    pairs
        .iter()
        .map(|(value, label)| SwitchOption {
            value: (*value).to_owned(),
            label: (*label).to_owned(),
        })
        .collect()
}

fn switches() -> Vec<SwitchDef> {
    vec![
        SwitchDef {
            key: SW_TPA.to_owned(),
            stage: "Before billing".to_owned(),
            sentence: "Insurance patients need TPA clearance before billing".to_owned(),
            sop:
                "Cashless discharges wait for the TPA's final approval before the bill is settled."
                    .to_owned(),
            kind: SwitchKind::OnOff { default: false },
            effects: effects(&[
                (
                    "true",
                    "Insurance patients wait for TPA clearance before billing",
                ),
                (
                    "false",
                    "Insurance patients go straight to billing, as cash patients do",
                ),
            ]),
            path: String::new(),
        },
        SwitchDef {
            key: SW_SIGNOFF.to_owned(),
            stage: "Discharge".to_owned(),
            sentence: "Who signs off the final discharge".to_owned(),
            sop: "The treating doctor discharges; some hospitals also require the medical \
                  superintendent's sign-off."
                .to_owned(),
            kind: SwitchKind::Choice {
                options: vec![
                    SwitchOption {
                        value: "treating_doctor".to_owned(),
                        label: "Treating doctor".to_owned(),
                    },
                    SwitchOption {
                        value: "medical_superintendent".to_owned(),
                        label: "Doctor + superintendent".to_owned(),
                    },
                ],
                default: "treating_doctor".to_owned(),
            },
            effects: effects(&[
                (
                    "treating_doctor",
                    "The treating doctor discharges once billing clears",
                ),
                (
                    "medical_superintendent",
                    "Every discharge waits for the medical superintendent's sign-off",
                ),
            ]),
            path: String::new(),
        },
    ]
}

const NAME: &str = "IPD discharge";

/// The readable address of anything on the flow. Scope comes first so the
/// phase-5 resolver (ward › campus › hospital › library default) reads the
/// most specific path first; phase 1 has only the hospital scope.
fn path(stage: &str, name: &str) -> String {
    format!("Hospital › {NAME} › {stage} › {name}")
}

#[must_use]
pub fn flow() -> FlowDef {
    let stations = stations()
        .into_iter()
        .map(|s| Station {
            path: path(&s.stage, &s.name),
            ..s
        })
        .collect();
    let switches = switches()
        .into_iter()
        .map(|s| SwitchDef {
            path: path(&s.stage, &s.sentence),
            ..s
        })
        .collect();
    FlowDef {
        code: CODE.to_owned(),
        name: NAME.to_owned(),
        module: "IPD".to_owned(),
        subject_type: "admission".to_owned(),
        clinical: true,
        stations,
        switches,
    }
}

//! Default access-group definitions — single source of truth.
//!
//! Adding / changing a default group: edit this file. `seed::seed_default_groups`
//! reads from `DEFAULT_GROUPS` and writes the `access_groups` table; the
//! manifest API serves them to the frontend.

#[derive(Debug, Clone)]
pub struct DefaultGroup {
    pub code: &'static str,
    pub name: &'static str,
    pub description: &'static str,
}

pub const DEFAULT_GROUPS: &[DefaultGroup] = &[
    DefaultGroup {
        code: "integrations_admin",
        name: "Integrations Administrators",
        description: "Users authorized to create + manage integration pipelines.",
    },
    DefaultGroup {
        code: "pipeline_runners",
        name: "Pipeline Runners",
        description: "Users authorized to execute integration pipelines.",
    },
    DefaultGroup {
        code: "lab_seniors",
        name: "Lab Seniors",
        description: "Senior lab technicians authorized to amend results + manage QC.",
    },
    DefaultGroup {
        code: "billing_seniors",
        name: "Billing Seniors",
        description: "Senior billing clerks authorized to apply discounts + write-offs.",
    },
    DefaultGroup {
        code: "radiologists",
        name: "Radiologists",
        description: "Doctors authorized to read DICOM + finalize radiology reports.",
    },
    DefaultGroup {
        code: "mlc_signatories",
        name: "MLC Signatories",
        description: "Authorized signatories for medico-legal cases (IPC § 39).",
    },
    DefaultGroup {
        code: "code_blue_team",
        name: "Code Blue Team",
        description: "Clinical staff authorized to activate emergency code-blue protocols.",
    },
    DefaultGroup {
        code: "data_exporters",
        name: "Data Exporters",
        description: "Users authorized to export module data (with audit watermark).",
    },
];

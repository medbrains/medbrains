//! A blood bank crossmatch report as printed: the request, the bank's
//! status and result, and the units tested against the patient. Split from
//! `print_data.rs`, which re-exports it, to keep that file inside its budget.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrossmatchReportPrintData {
    pub patient_name: String,
    pub uhid: String,
    pub age: Option<String>,
    pub gender: String,
    pub blood_group: String,
    pub rh_type: String,
    pub request_date: String,
    pub request_number: String,
    pub ward: Option<String>,
    pub bed: Option<String>,
    pub diagnosis: Option<String>,
    pub requesting_doctor: Option<String>,
    pub units_requested: i32,
    pub component_type: String,
    /// The bank's crossmatch status: requested, testing, compatible, ...
    pub status: String,
    pub result: Option<String>,
    /// When the sample was tested, in the tenant's zone.
    pub tested_at: Option<String>,
    /// The tied bag, or "No unit allocated yet": the web never ties one.
    pub unit_allocation: String,
    pub crossmatch_results: Vec<CrossmatchUnit>,
    pub special_requirements: Option<String>,
    pub technician_name: Option<String>,
    pub hospital_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CrossmatchUnit {
    pub bag_number: String,
    pub donation_date: String,
    pub expiry_date: String,
    pub donor_blood_group: String,
    pub volume_ml: i32,
    pub crossmatch_result: String, // Compatible, Incompatible
    pub issue_status: String,
}

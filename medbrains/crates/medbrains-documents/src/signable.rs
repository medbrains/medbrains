//! Every record type the hospital signs through `/api/signatures/sign`, in one
//! table: its name, its label and the source table that carries `is_signed`
//! and `signed_record_id`.
//!
//! Signing (`signatures::mark_source_signed`) and the paperless meter
//! (`medbrains-analytics::paperless`) both read this list, so a type added
//! here is signed and counted with no other change. PR #5259 grows it to every
//! clinical record and adds who signs each and the SQL that reads it; this
//! file keeps the same names so that change replaces it in place.

/// One signable record type.
#[derive(Debug)]
pub struct SignableType {
    /// The `signed_records.record_type` value.
    pub record_type: &'static str,
    /// What the hospital calls it, for screens.
    pub label: &'static str,
    /// The source table; carries `is_signed` and `signed_record_id`.
    pub table: &'static str,
}

/// Every record type `/api/signatures/sign` accepts.
pub static SIGNABLE: &[SignableType] = &[
    SignableType {
        record_type: "prescription",
        label: "Prescription",
        table: "prescriptions",
    },
    SignableType {
        record_type: "lab_report",
        label: "Lab report",
        table: "lab_results",
    },
    SignableType {
        record_type: "radiology_report",
        label: "Radiology report",
        table: "radiology_reports",
    },
    SignableType {
        record_type: "discharge_summary",
        label: "Discharge summary",
        table: "ipd_discharge_summaries",
    },
];

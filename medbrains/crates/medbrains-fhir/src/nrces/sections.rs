//! Composition section codes, as the NRCeS IG 6.5.0 profiles fix them.
//!
//! Each slice of `Composition.section` is discriminated by
//! `code.coding.code`, with system and display fixed too; the values below
//! are copied from the StructureDefinitions (`StructureDefinition-
//! OPConsultRecord.json`, `-DischargeSummaryRecord.json`,
//! `-PrescriptionRecord.json`) and checked against the vendored extract in
//! `profiles.json` by the tests. A section that fits no slice is allowed only
//! after the sliced ones (`openAtEnd`).

use crate::mapper::{LOINC_SYSTEM, SNOMED_SYSTEM};

/// `(system, code, display)` of a section.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SectionCode(pub &'static str, pub &'static str, pub &'static str);

const fn sct(code: &'static str, display: &'static str) -> SectionCode {
    SectionCode(SNOMED_SYSTEM, code, display)
}

/// OPConsultRecord and DischargeSummaryRecord `ChiefComplaints` (Condition).
pub const CHIEF_COMPLAINTS: SectionCode = sct("422843007", "Chief complaint section");
/// OPConsultRecord and DischargeSummaryRecord `PhysicalExamination`.
pub const PHYSICAL_EXAMINATION: SectionCode = sct("425044008", "Physical exam section");
/// OPConsultRecord `FollowUp` (Appointment).
pub const OP_FOLLOW_UP: SectionCode = sct("390906007", "Follow-up encounter");
/// DischargeSummaryRecord `Investigations` (DiagnosticReport).
pub const DISCHARGE_INVESTIGATIONS: SectionCode = sct("721981007", "Diagnostic studies report");
/// DischargeSummaryRecord `CarePlan` (CarePlan).
pub const DISCHARGE_CARE_PLAN: SectionCode = sct("734163000", "Care plan");
/// PrescriptionRecord's single section (MedicationRequest).
pub const PRESCRIPTION: SectionCode = sct("440545006", "Prescription record");
/// DiagnosticReportRecord's single section: system fixed, code free.
pub const DIAGNOSTIC_REPORT: SectionCode = sct("721981007", "Diagnostic studies report");

// Narratives no slice covers, sent after the sliced sections.

/// The doctor's advice on an OP consult (no OPConsultRecord slice).
pub const OP_ADVICE: SectionCode = sct("736271009", "Outpatient care plan");
/// Course in hospital and treatment given (no DischargeSummaryRecord slice).
pub const HOSPITAL_COURSE: SectionCode =
    SectionCode(LOINC_SYSTEM, "8648-8", "Hospital course Narrative");

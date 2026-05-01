//! Centralized permission constants.
//!
//! Single source of truth for all permission codes, mirroring
//! the frontend `P` object in `packages/types/src/permissions.ts`.
//!
//! TODO (next iteration): add a flat `PERMISSIONS: &[PermissionDef]`
//! array alongside the hierarchical const modules so the access
//! manifest can iterate them without macros. See
//! `crates/medbrains-core/src/access/mod.rs` for the consolidated
//! access table this should plug into.

/// Permission count surfaced to the runtime manifest API. Hardcoded
/// for now until the hierarchical `pub const` tree is consolidated
/// into a flat array (see TODO above). Mirrors the count in
/// `packages/types/src/permissions.ts::PERMISSIONS.length`.
pub const PERMISSION_COUNT: usize = 660;

/// Returns all known permission codes. Currently hardcoded — see
/// TODO above. The CI check `make check-permissions-sync` (planned)
/// will validate this against `packages/types/src/permissions.ts`.
#[must_use]
pub fn all_codes() -> Vec<&'static str> {
    // Placeholder — once the flat array lands this returns &[&str].
    // For now the manifest API just exposes the count.
    Vec::new()
}

pub mod dashboard {
    pub const VIEW: &str = "dashboard.view";
}

pub mod patients {
    pub const LIST: &str = "patients.list";
    pub const VIEW: &str = "patients.view";
    pub const CREATE: &str = "patients.create";
    pub const UPDATE: &str = "patients.update";
    pub const DELETE: &str = "patients.delete";
}

pub mod opd {
    pub mod queue {
        pub const LIST: &str = "opd.queue.list";
        pub const VIEW: &str = "opd.queue.view";
    }

    pub mod visit {
        pub const CREATE: &str = "opd.visit.create";
        pub const UPDATE: &str = "opd.visit.update";
    }

    pub const TOKEN_MANAGE: &str = "opd.token.manage";

    pub mod appointment {
        pub const LIST: &str = "opd.appointment.list";
        pub const CREATE: &str = "opd.appointment.create";
        pub const UPDATE: &str = "opd.appointment.update";
        pub const CANCEL: &str = "opd.appointment.cancel";
    }

    pub mod schedule {
        pub const LIST: &str = "opd.schedule.list";
        pub const MANAGE: &str = "opd.schedule.manage";
    }
}

pub mod lab {
    pub mod orders {
        pub const LIST: &str = "lab.orders.list";
        pub const VIEW: &str = "lab.orders.view";
        pub const CREATE: &str = "lab.orders.create";
    }

    pub mod results {
        pub const CREATE: &str = "lab.results.create";
        pub const UPDATE: &str = "lab.results.update";
        pub const AMEND: &str = "lab.results.amend";
    }

    pub mod qc {
        pub const LIST: &str = "lab.qc.list";
        pub const CREATE: &str = "lab.qc.create";
        pub const MANAGE: &str = "lab.qc.manage";
    }

    pub mod phlebotomy {
        pub const LIST: &str = "lab.phlebotomy.list";
        pub const MANAGE: &str = "lab.phlebotomy.manage";
    }

    pub mod outsourced {
        pub const LIST: &str = "lab.outsourced.list";
        pub const MANAGE: &str = "lab.outsourced.manage";
    }

    pub mod reports {
        pub const VIEW: &str = "lab.reports.view";
    }

    pub mod samples {
        pub const LIST: &str = "lab.samples.list";
        pub const MANAGE: &str = "lab.samples.manage";
    }

    pub mod dispatch {
        pub const LIST: &str = "lab.dispatch.list";
        pub const MANAGE: &str = "lab.dispatch.manage";
    }

    pub mod specialized {
        pub const LIST: &str = "lab.specialized.list";
        pub const CREATE: &str = "lab.specialized.create";
    }

    pub mod b2b {
        pub const LIST: &str = "lab.b2b.list";
        pub const MANAGE: &str = "lab.b2b.manage";
    }
}

pub mod pharmacy {
    pub mod prescriptions {
        pub const LIST: &str = "pharmacy.prescriptions.list";
        pub const VIEW: &str = "pharmacy.prescriptions.view";
    }

    pub mod dispensing {
        pub const CREATE: &str = "pharmacy.dispensing.create";
    }

    pub mod stock {
        pub const MANAGE: &str = "pharmacy.stock.manage";
    }

    pub mod ndps {
        pub const LIST: &str = "pharmacy.ndps.list";
        pub const MANAGE: &str = "pharmacy.ndps.manage";
    }

    pub mod stores {
        pub const LIST: &str = "pharmacy.stores.list";
        pub const MANAGE: &str = "pharmacy.stores.manage";
    }

    pub mod analytics {
        pub const VIEW: &str = "pharmacy.analytics.view";
    }

    pub mod returns {
        pub const LIST: &str = "pharmacy.returns.list";
        pub const MANAGE: &str = "pharmacy.returns.manage";
    }

    pub mod formulary {
        pub const APPROVE: &str = "pharmacy.formulary.approve";
    }

    pub mod stewardship {
        pub const APPROVE: &str = "pharmacy.stewardship.approve";
    }

    pub mod validation {
        pub const BYPASS: &str = "pharmacy.validation.bypass";
    }

    pub mod rx_queue {
        pub const LIST: &str = "pharmacy.rx_queue.list";
        pub const REVIEW: &str = "pharmacy.rx_queue.review";
    }

    pub mod pos {
        pub const CREATE: &str = "pharmacy.pos.create";
        pub const VIEW: &str = "pharmacy.pos.view";
    }

    pub mod pricing {
        pub const MANAGE: &str = "pharmacy.pricing.manage";
    }

    pub mod safety {
        pub const VIEW: &str = "pharmacy.safety.view";
        pub const OVERRIDE: &str = "pharmacy.safety.override";
    }

    pub mod reconciliation {
        pub const MANAGE: &str = "pharmacy.reconciliation.manage";
    }
}

pub mod billing {
    pub mod invoices {
        pub const LIST: &str = "billing.invoices.list";
        pub const VIEW: &str = "billing.invoices.view";
        pub const CREATE: &str = "billing.invoices.create";
    }

    pub mod payments {
        pub const CREATE: &str = "billing.payments.create";
        pub const VOID: &str = "billing.payments.void";
    }

    pub mod advances {
        pub const LIST: &str = "billing.advances.list";
        pub const CREATE: &str = "billing.advances.create";
        pub const ADJUST: &str = "billing.advances.adjust";
        pub const REFUND: &str = "billing.advances.refund";
    }

    pub mod corporate {
        pub const LIST: &str = "billing.corporate.list";
        pub const CREATE: &str = "billing.corporate.create";
        pub const UPDATE: &str = "billing.corporate.update";
    }

    pub mod reports {
        pub const VIEW: &str = "billing.reports.view";
    }

    pub mod day_close {
        pub const CREATE: &str = "billing.day_close.create";
        pub const VERIFY: &str = "billing.day_close.verify";
    }

    pub mod write_off {
        pub const CREATE: &str = "billing.write_off.create";
        pub const APPROVE: &str = "billing.write_off.approve";
    }

    pub mod audit {
        pub const VIEW: &str = "billing.audit.view";
    }

    pub mod credit {
        pub const LIST: &str = "billing.credit.list";
        pub const MANAGE: &str = "billing.credit.manage";
    }

    pub mod journal {
        pub const LIST: &str = "billing.journal.list";
        pub const CREATE: &str = "billing.journal.create";
        pub const POST: &str = "billing.journal.post";
    }

    pub mod bank_recon {
        pub const LIST: &str = "billing.bank_recon.list";
        pub const MANAGE: &str = "billing.bank_recon.manage";
    }

    pub mod tds {
        pub const LIST: &str = "billing.tds.list";
        pub const MANAGE: &str = "billing.tds.manage";
    }

    pub mod gst_returns {
        pub const LIST: &str = "billing.gst_returns.list";
        pub const MANAGE: &str = "billing.gst_returns.manage";
    }

    pub mod erp {
        pub const EXPORT: &str = "billing.erp.export";
    }

    pub mod concessions {
        pub const LIST: &str = "billing.concessions.list";
        pub const CREATE: &str = "billing.concessions.create";
        pub const APPROVE: &str = "billing.concessions.approve";
    }
}

pub mod ipd {
    pub mod admissions {
        pub const LIST: &str = "ipd.admissions.list";
        pub const VIEW: &str = "ipd.admissions.view";
        pub const CREATE: &str = "ipd.admissions.create";
    }

    pub mod discharge {
        pub const CREATE: &str = "ipd.discharge.create";
    }

    pub mod beds {
        pub const MANAGE: &str = "ipd.beds.manage";
    }

    pub mod progress_notes {
        pub const LIST: &str = "ipd.progress_notes.list";
        pub const CREATE: &str = "ipd.progress_notes.create";
    }

    pub mod assessments {
        pub const LIST: &str = "ipd.assessments.list";
        pub const CREATE: &str = "ipd.assessments.create";
    }

    pub mod mar {
        pub const LIST: &str = "ipd.mar.list";
        pub const CREATE: &str = "ipd.mar.create";
        pub const UPDATE: &str = "ipd.mar.update";
    }

    pub mod io_chart {
        pub const LIST: &str = "ipd.io_chart.list";
        pub const CREATE: &str = "ipd.io_chart.create";
    }

    pub mod nursing_assessment {
        pub const LIST: &str = "ipd.nursing_assessment.list";
        pub const CREATE: &str = "ipd.nursing_assessment.create";
    }

    pub mod care_plans {
        pub const LIST: &str = "ipd.care_plans.list";
        pub const CREATE: &str = "ipd.care_plans.create";
    }

    pub mod handover {
        pub const LIST: &str = "ipd.handover.list";
        pub const CREATE: &str = "ipd.handover.create";
    }

    pub mod discharge_checklist {
        pub const LIST: &str = "ipd.discharge_checklist.list";
        pub const UPDATE: &str = "ipd.discharge_checklist.update";
    }

    pub mod bed_dashboard {
        pub const VIEW: &str = "ipd.bed_dashboard.view";
    }

    pub mod waitlist {
        pub const MANAGE: &str = "ipd.waitlist.manage";
    }

    pub mod wards {
        pub const MANAGE: &str = "ipd.wards.manage";
    }

    pub mod discharge_summary {
        pub const CREATE: &str = "ipd.discharge_summary.create";
        pub const FINALIZE: &str = "ipd.discharge_summary.finalize";
    }

    pub mod reports {
        pub const VIEW: &str = "ipd.reports.view";
    }

    pub mod clinical_docs {
        pub const LIST: &str = "ipd.clinical_docs.list";
        pub const CREATE: &str = "ipd.clinical_docs.create";
    }

    pub mod reservations {
        pub const MANAGE: &str = "ipd.reservations.manage";
    }

    pub mod transfers {
        pub const CREATE: &str = "ipd.transfers.create";
    }

    pub mod death_records {
        pub const MANAGE: &str = "ipd.death_records.manage";
    }

    pub mod birth_records {
        pub const MANAGE: &str = "ipd.birth_records.manage";
    }

    pub mod discharge_tat {
        pub const VIEW: &str = "ipd.discharge_tat.view";
    }
}

pub mod ot {
    pub mod bookings {
        pub const LIST: &str = "ot.bookings.list";
        pub const CREATE: &str = "ot.bookings.create";
        pub const UPDATE: &str = "ot.bookings.update";
    }

    pub mod rooms {
        pub const LIST: &str = "ot.rooms.list";
        pub const MANAGE: &str = "ot.rooms.manage";
    }

    pub mod preop {
        pub const LIST: &str = "ot.preop.list";
        pub const CREATE: &str = "ot.preop.create";
    }

    pub mod safety_checklist {
        pub const LIST: &str = "ot.safety_checklist.list";
        pub const CREATE: &str = "ot.safety_checklist.create";
    }

    pub mod case_records {
        pub const LIST: &str = "ot.case_records.list";
        pub const CREATE: &str = "ot.case_records.create";
    }

    pub mod anesthesia {
        pub const LIST: &str = "ot.anesthesia.list";
        pub const CREATE: &str = "ot.anesthesia.create";
    }

    pub mod postop {
        pub const LIST: &str = "ot.postop.list";
        pub const CREATE: &str = "ot.postop.create";
    }

    pub mod preferences {
        pub const LIST: &str = "ot.preferences.list";
        pub const MANAGE: &str = "ot.preferences.manage";
    }

    pub mod reports {
        pub const VIEW: &str = "ot.reports.view";
    }

    pub mod implants {
        pub const LIST: &str = "ot.implants.list";
    }

    pub mod consumables {
        pub const MANAGE: &str = "ot.consumables.manage";
    }
}

pub mod radiology {
    pub mod orders {
        pub const LIST: &str = "radiology.orders.list";
        pub const VIEW: &str = "radiology.orders.view";
        pub const CREATE: &str = "radiology.orders.create";
        pub const CANCEL: &str = "radiology.orders.cancel";
    }

    pub mod reports {
        pub const CREATE: &str = "radiology.reports.create";
        pub const VERIFY: &str = "radiology.reports.verify";
    }

    pub mod modalities {
        pub const MANAGE: &str = "radiology.modalities.manage";
    }
}

pub mod icu {
    pub mod flowsheets {
        pub const LIST: &str = "icu.flowsheets.list";
        pub const CREATE: &str = "icu.flowsheets.create";
    }

    pub mod ventilator {
        pub const LIST: &str = "icu.ventilator.list";
        pub const CREATE: &str = "icu.ventilator.create";
    }

    pub mod scores {
        pub const LIST: &str = "icu.scores.list";
        pub const CREATE: &str = "icu.scores.create";
    }

    pub mod devices {
        pub const LIST: &str = "icu.devices.list";
        pub const MANAGE: &str = "icu.devices.manage";
    }

    pub mod nutrition {
        pub const LIST: &str = "icu.nutrition.list";
        pub const CREATE: &str = "icu.nutrition.create";
    }

    pub mod neonatal {
        pub const LIST: &str = "icu.neonatal.list";
        pub const CREATE: &str = "icu.neonatal.create";
    }
}

pub mod ambulance {
    pub mod fleet {
        pub const LIST: &str = "ambulance.fleet.list";
        pub const CREATE: &str = "ambulance.fleet.create";
        pub const UPDATE: &str = "ambulance.fleet.update";
    }
    pub mod drivers {
        pub const LIST: &str = "ambulance.drivers.list";
        pub const MANAGE: &str = "ambulance.drivers.manage";
    }
    pub mod trips {
        pub const LIST: &str = "ambulance.trips.list";
        pub const CREATE: &str = "ambulance.trips.create";
        pub const UPDATE: &str = "ambulance.trips.update";
    }
    pub mod maintenance {
        pub const LIST: &str = "ambulance.maintenance.list";
        pub const MANAGE: &str = "ambulance.maintenance.manage";
    }
}

pub mod communications {
    pub mod messages {
        pub const LIST: &str = "communications.messages.list";
        pub const CREATE: &str = "communications.messages.create";
    }
    pub mod clinical {
        pub const LIST: &str = "communications.clinical.list";
        pub const CREATE: &str = "communications.clinical.create";
        pub const ACKNOWLEDGE: &str = "communications.clinical.acknowledge";
    }
    pub mod alerts {
        pub const LIST: &str = "communications.alerts.list";
        pub const CREATE: &str = "communications.alerts.create";
        pub const MANAGE: &str = "communications.alerts.manage";
    }
    pub mod complaints {
        pub const LIST: &str = "communications.complaints.list";
        pub const CREATE: &str = "communications.complaints.create";
        pub const MANAGE: &str = "communications.complaints.manage";
    }
    pub mod feedback {
        pub const LIST: &str = "communications.feedback.list";
        pub const CREATE: &str = "communications.feedback.create";
    }
    pub mod config {
        pub const MANAGE: &str = "communications.config.manage";
    }
    pub mod dlt {
        pub const LIST: &str = "communications.dlt.list";
        pub const MANAGE: &str = "communications.dlt.manage";
    }
}

pub mod camp {
    pub const LIST: &str = "camp.list";
    pub const CREATE: &str = "camp.create";
    pub const UPDATE: &str = "camp.update";

    pub mod registrations {
        pub const LIST: &str = "camp.registrations.list";
        pub const CREATE: &str = "camp.registrations.create";
    }

    pub mod screenings {
        pub const LIST: &str = "camp.screenings.list";
        pub const MANAGE: &str = "camp.screenings.manage";
    }

    pub mod lab {
        pub const LIST: &str = "camp.lab.list";
        pub const MANAGE: &str = "camp.lab.manage";
    }

    pub mod followups {
        pub const LIST: &str = "camp.followups.list";
        pub const MANAGE: &str = "camp.followups.manage";
    }
}

pub mod consent {
    pub mod templates {
        pub const LIST: &str = "consent.templates.list";
        pub const CREATE: &str = "consent.templates.create";
        pub const UPDATE: &str = "consent.templates.update";
        pub const DELETE: &str = "consent.templates.delete";
    }

    pub mod audit {
        pub const LIST: &str = "consent.audit.list";
    }

    pub const VERIFY: &str = "consent.verify";
    pub const REVOKE: &str = "consent.revoke";

    pub mod signatures {
        pub const LIST: &str = "consent.signatures.list";
        pub const MANAGE: &str = "consent.signatures.manage";
    }
}

pub mod blood_bank {
    pub mod donors {
        pub const LIST: &str = "blood_bank.donors.list";
        pub const CREATE: &str = "blood_bank.donors.create";
    }

    pub mod inventory {
        pub const LIST: &str = "blood_bank.inventory.list";
        pub const MANAGE: &str = "blood_bank.inventory.manage";
    }

    pub mod crossmatch {
        pub const LIST: &str = "blood_bank.crossmatch.list";
        pub const CREATE: &str = "blood_bank.crossmatch.create";
    }

    pub mod transfusion {
        pub const LIST: &str = "blood_bank.transfusion.list";
        pub const CREATE: &str = "blood_bank.transfusion.create";
    }
}

pub mod bedside {
    pub const VIEW: &str = "bedside.view";
    pub const REQUEST: &str = "bedside.request";

    pub mod videos {
        pub const LIST: &str = "bedside.videos.list";
        pub const MANAGE: &str = "bedside.videos.manage";
    }

    pub mod feedback {
        pub const LIST: &str = "bedside.feedback.list";
        pub const CREATE: &str = "bedside.feedback.create";
    }

    pub mod sessions {
        pub const LIST: &str = "bedside.sessions.list";
        pub const MANAGE: &str = "bedside.sessions.manage";
    }
}

pub mod diet {
    pub mod orders {
        pub const LIST: &str = "diet.orders.list";
        pub const CREATE: &str = "diet.orders.create";
    }

    pub mod templates {
        pub const LIST: &str = "diet.templates.list";
        pub const MANAGE: &str = "diet.templates.manage";
    }

    pub mod kitchen {
        pub const LIST: &str = "diet.kitchen.list";
        pub const MANAGE: &str = "diet.kitchen.manage";
    }

    pub mod inventory {
        pub const LIST: &str = "diet.inventory.list";
        pub const MANAGE: &str = "diet.inventory.manage";
    }

    pub mod audits {
        pub const LIST: &str = "diet.audits.list";
        pub const CREATE: &str = "diet.audits.create";
    }
}

pub mod cssd {
    pub mod instruments {
        pub const LIST: &str = "cssd.instruments.list";
        pub const MANAGE: &str = "cssd.instruments.manage";
    }

    pub mod sets {
        pub const LIST: &str = "cssd.sets.list";
        pub const MANAGE: &str = "cssd.sets.manage";
    }

    pub mod sterilization {
        pub const LIST: &str = "cssd.sterilization.list";
        pub const CREATE: &str = "cssd.sterilization.create";
    }

    pub mod issuance {
        pub const LIST: &str = "cssd.issuance.list";
        pub const CREATE: &str = "cssd.issuance.create";
    }

    pub mod equipment {
        pub const LIST: &str = "cssd.equipment.list";
        pub const MANAGE: &str = "cssd.equipment.manage";
    }
}

pub mod emergency {
    pub mod visits {
        pub const LIST: &str = "emergency.visits.list";
        pub const CREATE: &str = "emergency.visits.create";
        pub const UPDATE: &str = "emergency.visits.update";
    }

    pub mod triage {
        pub const LIST: &str = "emergency.triage.list";
        pub const CREATE: &str = "emergency.triage.create";
    }

    pub mod resuscitation {
        pub const LIST: &str = "emergency.resuscitation.list";
        pub const CREATE: &str = "emergency.resuscitation.create";
    }

    pub mod codes {
        pub const LIST: &str = "emergency.codes.list";
        pub const CREATE: &str = "emergency.codes.create";
    }

    pub mod mlc {
        pub const LIST: &str = "emergency.mlc.list";
        pub const CREATE: &str = "emergency.mlc.create";
        pub const UPDATE: &str = "emergency.mlc.update";
    }

    pub mod mass_casualty {
        pub const LIST: &str = "emergency.mass_casualty.list";
        pub const CREATE: &str = "emergency.mass_casualty.create";
        pub const UPDATE: &str = "emergency.mass_casualty.update";
    }
}

pub mod infection_control {
    pub mod surveillance {
        pub const LIST: &str = "infection_control.surveillance.list";
        pub const CREATE: &str = "infection_control.surveillance.create";
    }

    pub mod stewardship {
        pub const LIST: &str = "infection_control.stewardship.list";
        pub const CREATE: &str = "infection_control.stewardship.create";
    }

    pub mod biowaste {
        pub const LIST: &str = "infection_control.biowaste.list";
        pub const CREATE: &str = "infection_control.biowaste.create";
    }

    pub mod hygiene {
        pub const LIST: &str = "infection_control.hygiene.list";
        pub const CREATE: &str = "infection_control.hygiene.create";
    }

    pub mod outbreak {
        pub const LIST: &str = "infection_control.outbreak.list";
        pub const CREATE: &str = "infection_control.outbreak.create";
        pub const UPDATE: &str = "infection_control.outbreak.update";
    }
}

pub mod housekeeping {
    pub mod cleaning {
        pub const LIST: &str = "housekeeping.cleaning.list";
        pub const CREATE: &str = "housekeeping.cleaning.create";
        pub const MANAGE: &str = "housekeeping.cleaning.manage";
    }

    pub mod turnaround {
        pub const LIST: &str = "housekeeping.turnaround.list";
        pub const MANAGE: &str = "housekeeping.turnaround.manage";
    }

    pub mod pest_control {
        pub const LIST: &str = "housekeeping.pest_control.list";
        pub const MANAGE: &str = "housekeeping.pest_control.manage";
    }

    pub mod linen {
        pub const LIST: &str = "housekeeping.linen.list";
        pub const CREATE: &str = "housekeeping.linen.create";
        pub const MANAGE: &str = "housekeeping.linen.manage";
    }

    pub mod laundry {
        pub const LIST: &str = "housekeeping.laundry.list";
        pub const MANAGE: &str = "housekeeping.laundry.manage";
    }
}

pub mod hr {
    pub mod employees {
        pub const LIST: &str = "hr.employees.list";
        pub const CREATE: &str = "hr.employees.create";
        pub const UPDATE: &str = "hr.employees.update";
    }

    pub mod credentials {
        pub const LIST: &str = "hr.credentials.list";
        pub const MANAGE: &str = "hr.credentials.manage";
    }

    pub mod attendance {
        pub const LIST: &str = "hr.attendance.list";
        pub const MANAGE: &str = "hr.attendance.manage";
    }

    pub mod leave {
        pub const LIST: &str = "hr.leave.list";
        pub const CREATE: &str = "hr.leave.create";
        pub const APPROVE: &str = "hr.leave.approve";
    }

    pub mod roster {
        pub const LIST: &str = "hr.roster.list";
        pub const MANAGE: &str = "hr.roster.manage";
    }

    pub mod on_call {
        pub const LIST: &str = "hr.on_call.list";
        pub const MANAGE: &str = "hr.on_call.manage";
    }

    pub mod training {
        pub const LIST: &str = "hr.training.list";
        pub const MANAGE: &str = "hr.training.manage";
    }

    pub mod appraisal {
        pub const MANAGE: &str = "hr.appraisal.manage";
    }
}

pub mod indent {
    pub const LIST: &str = "indent.list";
    pub const VIEW: &str = "indent.view";
    pub const CREATE: &str = "indent.create";
    pub const APPROVE: &str = "indent.approve";
    pub const STOCK_MANAGE: &str = "indent.stock.manage";
    pub const ANALYTICS_VIEW: &str = "indent.analytics.view";
    pub const CONSUMABLES_LIST: &str = "indent.consumables.list";
    pub const CONSUMABLES_MANAGE: &str = "indent.consumables.manage";
    pub const IMPLANTS_LIST: &str = "indent.implants.list";
    pub const IMPLANTS_MANAGE: &str = "indent.implants.manage";
    pub const CONDEMNATION_LIST: &str = "indent.condemnation.list";
    pub const CONDEMNATION_MANAGE: &str = "indent.condemnation.manage";
}

pub mod procurement {
    pub mod vendors {
        pub const LIST: &str = "procurement.vendors.list";
        pub const CREATE: &str = "procurement.vendors.create";
        pub const UPDATE: &str = "procurement.vendors.update";
    }

    pub mod purchase_orders {
        pub const LIST: &str = "procurement.po.list";
        pub const CREATE: &str = "procurement.po.create";
        pub const APPROVE: &str = "procurement.po.approve";
    }

    pub mod grn {
        pub const LIST: &str = "procurement.grn.list";
        pub const CREATE: &str = "procurement.grn.create";
    }

    pub mod rate_contracts {
        pub const LIST: &str = "procurement.rc.list";
        pub const MANAGE: &str = "procurement.rc.manage";
    }

    pub mod stores {
        pub const LIST: &str = "procurement.stores.list";
        pub const MANAGE: &str = "procurement.stores.manage";
    }

    pub mod payments {
        pub const LIST: &str = "procurement.payments.list";
        pub const MANAGE: &str = "procurement.payments.manage";
    }

    pub const PERFORMANCE_VIEW: &str = "procurement.performance.view";
}

pub mod quality {
    pub mod indicators {
        pub const LIST: &str = "quality.indicators.list";
        pub const MANAGE: &str = "quality.indicators.manage";
    }

    pub mod documents {
        pub const LIST: &str = "quality.documents.list";
        pub const MANAGE: &str = "quality.documents.manage";
    }

    pub mod incidents {
        pub const LIST: &str = "quality.incidents.list";
        pub const CREATE: &str = "quality.incidents.create";
        pub const UPDATE: &str = "quality.incidents.update";
    }

    pub mod capa {
        pub const LIST: &str = "quality.capa.list";
        pub const MANAGE: &str = "quality.capa.manage";
    }

    pub mod committees {
        pub const LIST: &str = "quality.committees.list";
        pub const MANAGE: &str = "quality.committees.manage";
    }

    pub mod accreditation {
        pub const LIST: &str = "quality.accreditation.list";
        pub const MANAGE: &str = "quality.accreditation.manage";
    }

    pub mod audits {
        pub const LIST: &str = "quality.audits.list";
        pub const CREATE: &str = "quality.audits.create";
    }
}

pub mod front_office {
    pub mod visitors {
        pub const LIST: &str = "front_office.visitors.list";
        pub const CREATE: &str = "front_office.visitors.create";
        pub const MANAGE: &str = "front_office.visitors.manage";
    }

    pub mod passes {
        pub const LIST: &str = "front_office.passes.list";
        pub const MANAGE: &str = "front_office.passes.manage";
    }

    pub mod queue {
        pub const LIST: &str = "front_office.queue.list";
        pub const MANAGE: &str = "front_office.queue.manage";
    }

    pub mod enquiry {
        pub const LIST: &str = "front_office.enquiry.list";
        pub const CREATE: &str = "front_office.enquiry.create";
        pub const MANAGE: &str = "front_office.enquiry.manage";
    }
}

pub mod bme {
    pub mod equipment {
        pub const LIST: &str = "bme.equipment.list";
        pub const CREATE: &str = "bme.equipment.create";
        pub const UPDATE: &str = "bme.equipment.update";
    }

    pub mod pm {
        pub const LIST: &str = "bme.pm.list";
        pub const MANAGE: &str = "bme.pm.manage";
    }

    pub mod calibration {
        pub const LIST: &str = "bme.calibration.list";
        pub const MANAGE: &str = "bme.calibration.manage";
    }

    pub mod contracts {
        pub const LIST: &str = "bme.contracts.list";
        pub const MANAGE: &str = "bme.contracts.manage";
    }

    pub mod breakdowns {
        pub const LIST: &str = "bme.breakdowns.list";
        pub const CREATE: &str = "bme.breakdowns.create";
        pub const MANAGE: &str = "bme.breakdowns.manage";
    }

    pub mod evaluations {
        pub const MANAGE: &str = "bme.evaluations.manage";
    }
}

pub mod mrd {
    pub mod records {
        pub const LIST: &str = "mrd.records.list";
        pub const CREATE: &str = "mrd.records.create";
        pub const MANAGE: &str = "mrd.records.manage";
    }

    pub mod births {
        pub const LIST: &str = "mrd.births.list";
        pub const CREATE: &str = "mrd.births.create";
    }

    pub mod deaths {
        pub const LIST: &str = "mrd.deaths.list";
        pub const CREATE: &str = "mrd.deaths.create";
    }
}

pub mod facilities {
    pub mod gas {
        pub const LIST: &str = "facilities.gas.list";
        pub const MANAGE: &str = "facilities.gas.manage";
    }

    pub mod fire {
        pub const LIST: &str = "facilities.fire.list";
        pub const MANAGE: &str = "facilities.fire.manage";
    }

    pub mod water {
        pub const LIST: &str = "facilities.water.list";
        pub const MANAGE: &str = "facilities.water.manage";
    }

    pub mod energy {
        pub const LIST: &str = "facilities.energy.list";
        pub const MANAGE: &str = "facilities.energy.manage";
    }

    pub mod work_orders {
        pub const LIST: &str = "facilities.work_orders.list";
        pub const CREATE: &str = "facilities.work_orders.create";
        pub const MANAGE: &str = "facilities.work_orders.manage";
    }

    pub mod compliance {
        pub const LIST: &str = "facilities.compliance.list";
        pub const MANAGE: &str = "facilities.compliance.manage";
    }

    pub mod stats {
        pub const VIEW: &str = "facilities.stats.view";
    }
}

pub mod security {
    pub mod access {
        pub const LIST: &str = "security.access.list";
        pub const MANAGE: &str = "security.access.manage";
    }

    pub mod cctv {
        pub const LIST: &str = "security.cctv.list";
        pub const MANAGE: &str = "security.cctv.manage";
    }

    pub mod incidents {
        pub const LIST: &str = "security.incidents.list";
        pub const CREATE: &str = "security.incidents.create";
        pub const UPDATE: &str = "security.incidents.update";
    }

    pub mod patient_safety {
        pub const LIST: &str = "security.patient_safety.list";
        pub const MANAGE: &str = "security.patient_safety.manage";
    }

    pub mod debriefs {
        pub const LIST: &str = "security.debriefs.list";
        pub const CREATE: &str = "security.debriefs.create";
    }
}

pub mod integration {
    pub const LIST: &str = "integration.list";
    pub const VIEW: &str = "integration.view";
    pub const CREATE: &str = "integration.create";
    pub const UPDATE: &str = "integration.update";
    pub const DELETE: &str = "integration.delete";
    pub const EXECUTE: &str = "integration.execute";
}

pub mod specialty {
    pub mod cath_lab {
        pub mod procedures {
            pub const LIST: &str = "specialty.cath_lab.procedures.list";
            pub const CREATE: &str = "specialty.cath_lab.procedures.create";
        }
        pub mod devices {
            pub const LIST: &str = "specialty.cath_lab.devices.list";
            pub const MANAGE: &str = "specialty.cath_lab.devices.manage";
        }
        pub mod monitoring {
            pub const LIST: &str = "specialty.cath_lab.monitoring.list";
            pub const CREATE: &str = "specialty.cath_lab.monitoring.create";
        }
        pub mod stemi {
            pub const LIST: &str = "specialty.cath_lab.stemi.list";
            pub const MANAGE: &str = "specialty.cath_lab.stemi.manage";
        }
    }

    pub mod endoscopy {
        pub mod procedures {
            pub const LIST: &str = "specialty.endoscopy.procedures.list";
            pub const CREATE: &str = "specialty.endoscopy.procedures.create";
        }
        pub mod scopes {
            pub const LIST: &str = "specialty.endoscopy.scopes.list";
            pub const MANAGE: &str = "specialty.endoscopy.scopes.manage";
        }
        pub mod reprocessing {
            pub const LIST: &str = "specialty.endoscopy.reprocessing.list";
            pub const MANAGE: &str = "specialty.endoscopy.reprocessing.manage";
        }
    }

    pub mod psychiatry {
        pub mod patients {
            pub const LIST: &str = "specialty.psychiatry.patients.list";
            pub const CREATE: &str = "specialty.psychiatry.patients.create";
            pub const UPDATE: &str = "specialty.psychiatry.patients.update";
        }
        pub mod assessments {
            pub const LIST: &str = "specialty.psychiatry.assessments.list";
            pub const CREATE: &str = "specialty.psychiatry.assessments.create";
        }
        pub mod ect {
            pub const LIST: &str = "specialty.psychiatry.ect.list";
            pub const CREATE: &str = "specialty.psychiatry.ect.create";
        }
        pub mod restraint {
            pub const LIST: &str = "specialty.psychiatry.restraint.list";
            pub const MANAGE: &str = "specialty.psychiatry.restraint.manage";
        }
        pub mod mhrb {
            pub const MANAGE: &str = "specialty.psychiatry.mhrb.manage";
        }
    }

    pub mod pmr {
        pub mod plans {
            pub const LIST: &str = "specialty.pmr.plans.list";
            pub const CREATE: &str = "specialty.pmr.plans.create";
        }
        pub mod sessions {
            pub const LIST: &str = "specialty.pmr.sessions.list";
            pub const CREATE: &str = "specialty.pmr.sessions.create";
        }
        pub mod audiology {
            pub const LIST: &str = "specialty.pmr.audiology.list";
            pub const CREATE: &str = "specialty.pmr.audiology.create";
        }
        pub mod psychometric {
            pub const LIST: &str = "specialty.pmr.psychometric.list";
            pub const MANAGE: &str = "specialty.pmr.psychometric.manage";
        }
    }

    pub mod palliative {
        pub mod dnr {
            pub const LIST: &str = "specialty.palliative.dnr.list";
            pub const MANAGE: &str = "specialty.palliative.dnr.manage";
        }
        pub mod pain {
            pub const LIST: &str = "specialty.palliative.pain.list";
            pub const CREATE: &str = "specialty.palliative.pain.create";
        }
        pub mod mortuary {
            pub const LIST: &str = "specialty.palliative.mortuary.list";
            pub const MANAGE: &str = "specialty.palliative.mortuary.manage";
        }
        pub mod nucmed {
            pub const LIST: &str = "specialty.palliative.nucmed.list";
            pub const CREATE: &str = "specialty.palliative.nucmed.create";
            pub const MANAGE: &str = "specialty.palliative.nucmed.manage";
        }
    }

    pub mod maternity {
        pub mod registrations {
            pub const LIST: &str = "specialty.maternity.registrations.list";
            pub const CREATE: &str = "specialty.maternity.registrations.create";
        }
        pub mod anc {
            pub const LIST: &str = "specialty.maternity.anc.list";
            pub const CREATE: &str = "specialty.maternity.anc.create";
        }
        pub mod labor {
            pub const LIST: &str = "specialty.maternity.labor.list";
            pub const CREATE: &str = "specialty.maternity.labor.create";
        }
        pub mod newborn {
            pub const LIST: &str = "specialty.maternity.newborn.list";
            pub const CREATE: &str = "specialty.maternity.newborn.create";
        }
    }

    pub mod other {
        pub mod templates {
            pub const LIST: &str = "specialty.other.templates.list";
            pub const MANAGE: &str = "specialty.other.templates.manage";
        }
        pub mod records {
            pub const LIST: &str = "specialty.other.records.list";
            pub const CREATE: &str = "specialty.other.records.create";
        }
        pub mod dialysis {
            pub const LIST: &str = "specialty.other.dialysis.list";
            pub const MANAGE: &str = "specialty.other.dialysis.manage";
        }
    }
}

pub mod order_sets {
    pub mod templates {
        pub const LIST: &str = "order_sets.templates.list";
        pub const VIEW: &str = "order_sets.templates.view";
        pub const CREATE: &str = "order_sets.templates.create";
        pub const UPDATE: &str = "order_sets.templates.update";
        pub const APPROVE: &str = "order_sets.templates.approve";
    }

    pub mod activation {
        pub const CREATE: &str = "order_sets.activation.create";
        pub const VIEW: &str = "order_sets.activation.view";
    }

    pub mod analytics {
        pub const VIEW: &str = "order_sets.analytics.view";
    }
}

pub mod insurance {
    pub mod verification {
        pub const LIST: &str = "insurance.verification.list";
        pub const CREATE: &str = "insurance.verification.create";
    }

    pub mod prior_auth {
        pub const LIST: &str = "insurance.prior_auth.list";
        pub const CREATE: &str = "insurance.prior_auth.create";
        pub const UPDATE: &str = "insurance.prior_auth.update";
        pub const SUBMIT: &str = "insurance.prior_auth.submit";
    }

    pub mod appeals {
        pub const LIST: &str = "insurance.appeals.list";
        pub const CREATE: &str = "insurance.appeals.create";
    }

    pub mod rules {
        pub const LIST: &str = "insurance.rules.list";
        pub const MANAGE: &str = "insurance.rules.manage";
    }

    pub mod dashboard {
        pub const VIEW: &str = "insurance.dashboard.view";
    }
}

pub mod regulatory {
    pub mod dashboard {
        pub const VIEW: &str = "regulatory.dashboard.view";
    }

    pub mod checklists {
        pub const LIST: &str = "regulatory.checklists.list";
        pub const CREATE: &str = "regulatory.checklists.create";
        pub const UPDATE: &str = "regulatory.checklists.update";
    }

    pub mod adr {
        pub const LIST: &str = "regulatory.adr.list";
        pub const CREATE: &str = "regulatory.adr.create";
        pub const UPDATE: &str = "regulatory.adr.update";
    }

    pub mod materiovigilance {
        pub const LIST: &str = "regulatory.materiovigilance.list";
        pub const CREATE: &str = "regulatory.materiovigilance.create";
    }

    pub mod pcpndt {
        pub const LIST: &str = "regulatory.pcpndt.list";
        pub const CREATE: &str = "regulatory.pcpndt.create";
    }

    pub mod calendar {
        pub const MANAGE: &str = "regulatory.calendar.manage";
    }
}

pub mod care_view {
    pub const VIEW: &str = "care_view.view";
    pub const MY_TASKS: &str = "care_view.my_tasks";
    pub const HANDOVER: &str = "care_view.handover";
    pub const DISCHARGE_TRACKER: &str = "care_view.discharge_tracker";
    pub const MANAGE_TASKS: &str = "care_view.manage_tasks";
}

pub mod chronic {
    pub mod programs {
        pub const LIST: &str = "chronic.programs.list";
        pub const CREATE: &str = "chronic.programs.create";
    }

    pub mod enrollments {
        pub const LIST: &str = "chronic.enrollments.list";
        pub const CREATE: &str = "chronic.enrollments.create";
        pub const UPDATE: &str = "chronic.enrollments.update";
    }

    pub mod timeline {
        pub const VIEW: &str = "chronic.timeline.view";
        pub const CREATE: &str = "chronic.timeline.create";
    }

    pub mod adherence {
        pub const LIST: &str = "chronic.adherence.list";
        pub const CREATE: &str = "chronic.adherence.create";
    }

    pub mod outcomes {
        pub const VIEW: &str = "chronic.outcomes.view";
        pub const CREATE: &str = "chronic.outcomes.create";
    }
}

pub mod admin {
    pub mod users {
        pub const LIST: &str = "admin.users.list";
        pub const VIEW: &str = "admin.users.view";
        pub const CREATE: &str = "admin.users.create";
        pub const UPDATE: &str = "admin.users.update";
        pub const DELETE: &str = "admin.users.delete";
        pub const FORCE_LOGOUT: &str = "admin.users.force_logout";
    }

    /// Sprint A: per-tenant operating mode flip (normal/degraded/read_only).
    pub mod system_state {
        pub const VIEW: &str = "admin.system_state.view";
        pub const MANAGE: &str = "admin.system_state.manage";
    }

    /// Sprint A: outbox queue + DLQ admin surface.
    pub mod outbox {
        pub const VIEW: &str = "admin.outbox.view";
        pub const RETRY: &str = "admin.outbox.retry";

        pub mod dlq {
            pub const MANAGE: &str = "admin.outbox.dlq.manage";
        }
    }

    /// Sprint B: per-tenant Patroni vs Aurora topology selector.
    pub mod db_topology {
        pub const VIEW: &str = "admin.db_topology.view";
        pub const MANAGE: &str = "admin.db_topology.manage";
    }

    pub mod roles {
        pub const LIST: &str = "admin.roles.list";
        pub const VIEW: &str = "admin.roles.view";
        pub const CREATE: &str = "admin.roles.create";
        pub const UPDATE: &str = "admin.roles.update";
        pub const DELETE: &str = "admin.roles.delete";
    }

    pub mod settings {
        pub mod general {
            pub const MANAGE: &str = "admin.settings.general.manage";
        }

        pub mod facilities {
            pub const LIST: &str = "admin.settings.facilities.list";
            pub const CREATE: &str = "admin.settings.facilities.create";
            pub const UPDATE: &str = "admin.settings.facilities.update";
            pub const DELETE: &str = "admin.settings.facilities.delete";
        }

        pub mod locations {
            pub const LIST: &str = "admin.settings.locations.list";
            pub const CREATE: &str = "admin.settings.locations.create";
            pub const UPDATE: &str = "admin.settings.locations.update";
            pub const DELETE: &str = "admin.settings.locations.delete";
        }

        pub mod departments {
            pub const LIST: &str = "admin.settings.departments.list";
            pub const CREATE: &str = "admin.settings.departments.create";
            pub const UPDATE: &str = "admin.settings.departments.update";
            pub const DELETE: &str = "admin.settings.departments.delete";
        }

        pub mod modules {
            pub const MANAGE: &str = "admin.settings.modules.manage";
        }

        pub mod sequences {
            pub const MANAGE: &str = "admin.settings.sequences.manage";
        }

        pub mod services {
            pub const LIST: &str = "admin.settings.services.list";
            pub const CREATE: &str = "admin.settings.services.create";
            pub const UPDATE: &str = "admin.settings.services.update";
            pub const DELETE: &str = "admin.settings.services.delete";
        }

        pub mod bed_types {
            pub const MANAGE: &str = "admin.settings.bed_types.manage";
        }

        pub mod billing_tax {
            pub const MANAGE: &str = "admin.settings.billing_tax.manage";
        }

        pub mod branding {
            pub const MANAGE: &str = "admin.settings.branding.manage";
        }

        pub mod regulatory {
            pub const MANAGE: &str = "admin.settings.regulatory.manage";
        }

        pub mod clinical_masters {
            pub const LIST: &str = "admin.settings.clinical_masters.list";
            pub const CREATE: &str = "admin.settings.clinical_masters.create";
            pub const UPDATE: &str = "admin.settings.clinical_masters.update";
            pub const DELETE: &str = "admin.settings.clinical_masters.delete";
        }
    }

    // IT Security permissions
    pub const SECURITY: &str = "admin.security.manage";
    pub const CONFIG: &str = "admin.config.manage";
    pub const MIGRATION: &str = "admin.migration.manage";
    pub const COMPLIANCE: &str = "admin.compliance.manage";
    pub const SYSTEM: &str = "admin.system.view";
    pub const BACKUP: &str = "admin.backup.manage";
    pub const INCENTIVE: &str = "admin.incentive.manage";

    // Doctor administration (SPRINT-doctor-activities.md)
    pub mod doctors {
        pub const LIST: &str = "admin.doctors.list";
        pub const VIEW: &str = "admin.doctors.view";
        pub const CREATE: &str = "admin.doctors.create";
        pub const UPDATE: &str = "admin.doctors.update";
        pub const DELETE: &str = "admin.doctors.delete";
    }

    pub mod signature_credentials {
        pub const LIST: &str = "admin.signature_credentials.list";
        pub const ISSUE: &str = "admin.signature_credentials.issue";
        pub const REVOKE: &str = "admin.signature_credentials.revoke";
    }

    pub mod coverage {
        pub const LIST: &str = "admin.coverage.list";
        pub const MANAGE: &str = "admin.coverage.manage";
    }

    pub mod doctor_packages {
        pub const LIST: &str = "admin.doctor_packages.list";
        pub const MANAGE: &str = "admin.doctor_packages.manage";
    }
}

/// Doctor self-service activities (SPRINT-doctor-activities.md).
pub mod doctor {
    pub mod profile {
        pub const VIEW_OWN: &str = "doctor.profile.view_own";
        pub const UPDATE_OWN: &str = "doctor.profile.update_own";
    }

    pub mod signature {
        pub const SIGN: &str = "doctor.signature.sign";
        pub const CO_SIGN: &str = "doctor.signature.co_sign";
        pub const VERIFY: &str = "doctor.signature.verify";
    }

    pub mod dashboard {
        pub const VIEW_OWN: &str = "doctor.dashboard.view_own";
    }

    pub mod signoffs {
        pub const VIEW_OWN: &str = "doctor.signoffs.view_own";
    }
}

/// Patient-side packages (subscribing + consuming).
pub mod patient_packages {
    pub const VIEW: &str = "patient_packages.view";
    pub const SUBSCRIBE: &str = "patient_packages.subscribe";
    pub const CONSUME: &str = "patient_packages.consume";
    pub const REFUND: &str = "patient_packages.refund";
}

pub mod documents {
    pub mod templates {
        pub const LIST: &str = "documents.templates.list";
        pub const CREATE: &str = "documents.templates.create";
        pub const UPDATE: &str = "documents.templates.update";
        pub const DELETE: &str = "documents.templates.delete";
    }

    pub const GENERATE: &str = "documents.generate";
    pub const REPRINT: &str = "documents.reprint";
    pub const VOID: &str = "documents.void";

    pub mod audit {
        pub const LIST: &str = "documents.audit.list";
    }

    pub mod review {
        pub const LIST: &str = "documents.review.list";
        pub const MANAGE: &str = "documents.review.manage";
    }

    pub mod printers {
        pub const LIST: &str = "documents.printers.list";
        pub const MANAGE: &str = "documents.printers.manage";
    }
}

pub mod occ_health {
    pub mod screenings {
        pub const LIST: &str = "occ_health.screenings.list";
        pub const CREATE: &str = "occ_health.screenings.create";
        pub const UPDATE: &str = "occ_health.screenings.update";
    }

    pub mod drug_screens {
        pub const LIST: &str = "occ_health.drug_screens.list";
        pub const MANAGE: &str = "occ_health.drug_screens.manage";
    }

    pub mod vaccinations {
        pub const LIST: &str = "occ_health.vaccinations.list";
        pub const MANAGE: &str = "occ_health.vaccinations.manage";
    }

    pub mod injuries {
        pub const LIST: &str = "occ_health.injuries.list";
        pub const CREATE: &str = "occ_health.injuries.create";
        pub const MANAGE: &str = "occ_health.injuries.manage";
    }
}

pub mod ur {
    pub mod reviews {
        pub const LIST: &str = "ur.reviews.list";
        pub const CREATE: &str = "ur.reviews.create";
        pub const UPDATE: &str = "ur.reviews.update";
    }

    pub mod communications {
        pub const LIST: &str = "ur.communications.list";
        pub const CREATE: &str = "ur.communications.create";
    }

    pub mod conversions {
        pub const LIST: &str = "ur.conversions.list";
        pub const CREATE: &str = "ur.conversions.create";
    }
}

pub mod case_mgmt {
    pub mod assignments {
        pub const LIST: &str = "case_mgmt.assignments.list";
        pub const CREATE: &str = "case_mgmt.assignments.create";
        pub const UPDATE: &str = "case_mgmt.assignments.update";
    }

    pub mod barriers {
        pub const LIST: &str = "case_mgmt.barriers.list";
        pub const MANAGE: &str = "case_mgmt.barriers.manage";
    }

    pub mod referrals {
        pub const LIST: &str = "case_mgmt.referrals.list";
        pub const MANAGE: &str = "case_mgmt.referrals.manage";
    }

    pub mod analytics {
        pub const VIEW: &str = "case_mgmt.analytics.view";
    }
}

pub mod scheduling {
    pub mod predictions {
        pub const LIST: &str = "scheduling.predictions.list";
        pub const CREATE: &str = "scheduling.predictions.create";
    }

    pub mod waitlist {
        pub const LIST: &str = "scheduling.waitlist.list";
        pub const MANAGE: &str = "scheduling.waitlist.manage";
    }

    pub mod overbooking {
        pub const LIST: &str = "scheduling.overbooking.list";
        pub const MANAGE: &str = "scheduling.overbooking.manage";
    }

    pub mod analytics {
        pub const VIEW: &str = "scheduling.analytics.view";
    }

    pub const AUTO_FILL_MANAGE: &str = "scheduling.auto_fill.manage";
}

pub mod retrospective {
    pub const SETTINGS: &str = "retrospective.settings";
    pub const CREATE: &str = "retrospective.create";
    pub const LIST: &str = "retrospective.list";
    pub const APPROVE: &str = "retrospective.approve";
    pub const AUDIT: &str = "retrospective.audit";
}

pub mod audit {
    pub const VIEW: &str = "audit.log.view";
    pub const EXPORT: &str = "audit.log.export";
    pub const ACCESS_VIEW: &str = "audit.access.view";
    pub const REVIEW: &str = "audit.break_glass.review";
}

pub mod analytics {
    pub const VIEW: &str = "analytics.view";
    pub const EXPORT: &str = "analytics.export";
}

pub mod command_center {
    pub const VIEW: &str = "command_center.view";

    pub mod alerts {
        pub const MANAGE: &str = "command_center.alerts.manage";
    }

    pub mod transport {
        pub const LIST: &str = "command_center.transport.list";
        pub const MANAGE: &str = "command_center.transport.manage";
    }

    pub mod discharge {
        pub const VIEW: &str = "command_center.discharge.view";
    }
}

pub mod inventory {
    pub const VIEW: &str = "inventory.view";
    pub const DISPOSE: &str = "inventory.dispose";
    pub const APPROVE: &str = "inventory.approve";
}

pub mod devices {
    pub const LIST: &str = "devices.list";
    pub const VIEW: &str = "devices.view";
    pub const CREATE: &str = "devices.create";
    pub const UPDATE: &str = "devices.update";
    pub const DELETE: &str = "devices.delete";
    pub const TEST: &str = "devices.test";
    pub const INGEST: &str = "devices.ingest";

    pub mod messages {
        pub const VIEW: &str = "devices.messages.view";
        pub const RETRY: &str = "devices.messages.retry";
    }

    pub mod agents {
        pub const LIST: &str = "devices.agents.list";
        pub const MANAGE: &str = "devices.agents.manage";
    }

    pub mod catalog {
        pub const LIST: &str = "devices.catalog.list";
        pub const MANAGE: &str = "devices.catalog.manage";
    }
}

pub mod lms {
    pub mod courses {
        pub const LIST: &str = "lms.courses.list";
        pub const VIEW: &str = "lms.courses.view";
        pub const CREATE: &str = "lms.courses.create";
        pub const UPDATE: &str = "lms.courses.update";
        pub const DELETE: &str = "lms.courses.delete";
    }

    pub mod enrollments {
        pub const LIST: &str = "lms.enrollments.list";
        pub const CREATE: &str = "lms.enrollments.create";
        pub const UPDATE: &str = "lms.enrollments.update";
    }

    pub mod quizzes {
        pub const LIST: &str = "lms.quizzes.list";
        pub const CREATE: &str = "lms.quizzes.create";
        pub const ATTEMPT: &str = "lms.quizzes.attempt";
    }

    pub mod paths {
        pub const LIST: &str = "lms.paths.list";
        pub const CREATE: &str = "lms.paths.create";
        pub const UPDATE: &str = "lms.paths.update";
    }

    pub mod certificates {
        pub const LIST: &str = "lms.certificates.list";
        pub const CREATE: &str = "lms.certificates.create";
    }

    pub mod compliance {
        pub const VIEW: &str = "lms.compliance.view";
    }

    pub mod my_learning {
        pub const VIEW: &str = "lms.my_learning.view";
    }
}

/// Order Basket — atomic cross-module order signing
/// (RFCs/sprints/SPRINT-order-basket.md).
pub mod order_basket {
    pub const SIGN: &str = "clinical.order_basket.sign";
    pub const DRAFT: &str = "clinical.order_basket.draft";
    pub const VIEW_AUDIT: &str = "clinical.order_basket.view_audit";
}

pub mod nurse {
    pub mod profile {
        pub const VIEW: &str = "nurse.profile.view";
        pub const MANAGE: &str = "nurse.profile.manage";
    }
    pub mod shift {
        pub const VIEW: &str = "nurse.shift.view";
        pub const MANAGE: &str = "nurse.shift.manage";
    }
    pub mod mar {
        pub const VIEW: &str = "nurse.mar.view";
        pub const ADMINISTER: &str = "nurse.mar.administer";
        pub const HOLD: &str = "nurse.mar.hold";
        pub const REFUSE: &str = "nurse.mar.refuse";
    }
    pub mod vitals {
        pub const VIEW: &str = "nurse.vitals.view";
        pub const RECORD: &str = "nurse.vitals.record";
    }
    pub mod intake_output {
        pub const VIEW: &str = "nurse.intake_output.view";
        pub const RECORD: &str = "nurse.intake_output.record";
    }
    pub mod restraint {
        pub const VIEW: &str = "nurse.restraint.view";
        pub const RECORD: &str = "nurse.restraint.record";
    }
    pub mod pain {
        pub const VIEW: &str = "nurse.pain.view";
        pub const RECORD: &str = "nurse.pain.record";
    }
    pub mod wound {
        pub const VIEW: &str = "nurse.wound.view";
        pub const RECORD: &str = "nurse.wound.record";
    }
    pub mod fall_risk {
        pub const VIEW: &str = "nurse.fall_risk.view";
        pub const RECORD: &str = "nurse.fall_risk.record";
    }
    pub mod handoff {
        pub const VIEW: &str = "nurse.handoff.view";
        pub const RECORD: &str = "nurse.handoff.record";
    }
    pub mod code_blue {
        pub const VIEW: &str = "nurse.code_blue.view";
        pub const RECORD: &str = "nurse.code_blue.record";
    }
    pub mod equipment {
        pub const VIEW: &str = "nurse.equipment.view";
        pub const RECORD: &str = "nurse.equipment.record";
    }
    pub mod dashboard {
        pub const VIEW: &str = "nurse.dashboard.view";
    }
}

pub mod pharmacy_improvements {
    pub mod repeats {
        pub const VIEW: &str = "pharmacy_improvements.repeats.view";
        pub const DISPENSE: &str = "pharmacy_improvements.repeats.dispense";
    }
    pub mod substitution {
        pub const VIEW: &str = "pharmacy_improvements.substitution.view";
        pub const RECORD: &str = "pharmacy_improvements.substitution.record";
    }
    pub mod counseling {
        pub const VIEW: &str = "pharmacy_improvements.counseling.view";
        pub const RECORD: &str = "pharmacy_improvements.counseling.record";
    }
    pub mod coverage {
        pub const VIEW: &str = "pharmacy_improvements.coverage.view";
        pub const CHECK: &str = "pharmacy_improvements.coverage.check";
    }
}

pub mod pharmacy_finance {
    pub mod cash_drawer {
        pub const VIEW: &str = "pharmacy_finance.cash_drawer.view";
        pub const OPEN: &str = "pharmacy_finance.cash_drawer.open";
        pub const CLOSE: &str = "pharmacy_finance.cash_drawer.close";
    }
    pub mod petty_cash {
        pub const VIEW: &str = "pharmacy_finance.petty_cash.view";
        pub const RECORD: &str = "pharmacy_finance.petty_cash.record";
    }
    pub mod free_dispensing {
        pub const VIEW: &str = "pharmacy_finance.free_dispensing.view";
        pub const APPROVE: &str = "pharmacy_finance.free_dispensing.approve";
    }
    pub mod supplier_payments {
        pub const VIEW: &str = "pharmacy_finance.supplier_payments.view";
        pub const MANAGE: &str = "pharmacy_finance.supplier_payments.manage";
    }
    pub mod cashier_audit {
        pub const VIEW: &str = "pharmacy_finance.cashier_audit.view";
    }
    pub mod finance_reports {
        pub const VIEW: &str = "pharmacy_finance.finance_reports.view";
    }
}

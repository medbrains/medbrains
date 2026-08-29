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
pub const PERMISSION_COUNT: usize = 777;

/// Returns all known permission codes. Currently hardcoded — see
/// TODO above. The CI check `make check-permissions-sync` (planned)
/// will validate this against `packages/types/src/permissions.ts`.
#[must_use]
pub const fn all_codes() -> Vec<&'static str> {
    // Placeholder — once the flat array lands this returns &[&str].
    // For now the manifest API just exposes the count.
    Vec::new()
}

pub mod dashboard {
    pub const VIEW: &str = "dashboard.view";
}

/// Workflow automation.
///
/// `ACTIVATE` is separate from `MANAGE` on purpose: building a workflow is
/// harmless, and arming one is the moment it gains the authority to act on its
/// own. Whoever activates it lends it their permissions, so that is the step
/// worth gating separately.
pub mod automation {
    pub const VIEW: &str = "automation.view";
    pub const MANAGE: &str = "automation.manage";
    pub const ACTIVATE: &str = "automation.activate";
    pub const RUN: &str = "automation.run";
}

pub mod patients {
    pub const LIST: &str = "patients.list";
    pub const VIEW: &str = "patients.view";
    pub const CREATE: &str = "patients.create";
    pub const UPDATE: &str = "patients.update";
    pub const DELETE: &str = "patients.delete";

    pub mod notes {
        pub const VIEW: &str = "patients.notes.view";
        pub const EDIT: &str = "patients.notes.edit";
    }
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

    pub mod vitals {
        pub const LIST: &str = "opd.vitals.list";
        pub const CREATE: &str = "opd.vitals.create";
    }

    pub mod diagnoses {
        pub const LIST: &str = "opd.diagnoses.list";
        pub const CREATE: &str = "opd.diagnoses.create";
        pub const UPDATE: &str = "opd.diagnoses.update";
        pub const DELETE: &str = "opd.diagnoses.delete";
    }

    pub mod procedures {
        pub const LIST: &str = "opd.procedures.list";
        pub const CREATE: &str = "opd.procedures.create";
        pub const CANCEL: &str = "opd.procedures.cancel";
    }

    pub mod referrals {
        pub const LIST: &str = "opd.referrals.list";
        pub const CREATE: &str = "opd.referrals.create";
    }

    pub mod certificates {
        pub const LIST: &str = "opd.certificates.list";
        pub const CREATE: &str = "opd.certificates.create";
        pub const PRINT: &str = "opd.certificates.print";
        pub const REPRINT: &str = "opd.certificates.reprint";
        pub const VOID: &str = "opd.certificates.void";
    }

    pub mod reminders {
        pub const LIST: &str = "opd.reminders.list";
        pub const CREATE: &str = "opd.reminders.create";
        pub const UPDATE: &str = "opd.reminders.update";
    }

    pub mod feedback {
        pub const LIST: &str = "opd.feedback.list";
        pub const CREATE: &str = "opd.feedback.create";
    }

    pub mod consents {
        pub const LIST: &str = "opd.consents.list";
        pub const CREATE: &str = "opd.consents.create";
        pub const SIGN: &str = "opd.consents.sign";
        pub const PRINT: &str = "opd.consents.print";
        pub const REPRINT: &str = "opd.consents.reprint";
        pub const REVOKE: &str = "opd.consents.revoke";
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
        pub const PARTIAL: &str = "pharmacy.dispensing.partial";
        pub const CANCEL: &str = "pharmacy.dispensing.cancel";
        pub const VOID: &str = "pharmacy.dispensing.void";
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

        /// The four stages of a store indent, separately.
        ///
        /// `MANAGE` alone used to gate create, approve, issue AND receive, so
        /// whoever could raise a stock movement could approve it and receive it
        /// on their own. Every stage still accepts `MANAGE`, so no existing
        /// deployment loses access — but a hospital that wants the stages held
        /// by different people can now say so, which it could not before.
        pub mod indents {
            pub const CREATE: &str = "pharmacy.stores.indents.create";
            pub const APPROVE: &str = "pharmacy.stores.indents.approve";
            pub const ISSUE: &str = "pharmacy.stores.indents.issue";
            pub const RECEIVE: &str = "pharmacy.stores.indents.receive";
        }
    }

    /// Pick → pack → verify → dispatch, for pharmacies that hand medicine over
    /// away from the billing counter.
    ///
    /// Separate verbs even where one person holds all of them today: a
    /// four-eyes rule cannot be added later to a permission that never
    /// distinguished the acts it was gating.
    pub mod fulfilment {
        pub const PICK: &str = "pharmacy.fulfilment.pick";
        pub const PACK: &str = "pharmacy.fulfilment.pack";
        pub const VERIFY: &str = "pharmacy.fulfilment.verify";
        pub const DISPATCH: &str = "pharmacy.fulfilment.dispatch";
        pub const RELEASE: &str = "pharmacy.fulfilment.release";
    }

    pub mod analytics {
        pub const VIEW: &str = "pharmacy.analytics.view";
    }

    pub mod returns {
        pub const LIST: &str = "pharmacy.returns.list";
        pub const REQUEST: &str = "pharmacy.returns.request";
        pub const APPROVE: &str = "pharmacy.returns.approve";
        pub const RESTOCK: &str = "pharmacy.returns.restock";
        pub const DESTROY: &str = "pharmacy.returns.destroy";
        pub const REJECT: &str = "pharmacy.returns.reject";
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
        pub const CANCEL: &str = "pharmacy.pos.cancel";
        pub const RETURN: &str = "pharmacy.pos.return";
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
        pub const UPDATE: &str = "billing.invoices.update";
        pub const CANCEL: &str = "billing.invoices.cancel";
    }

    pub mod catalog {
        pub const MANAGE: &str = "billing.catalog.manage";
    }

    pub mod payments {
        pub const CREATE: &str = "billing.payments.create";
        pub const VOID: &str = "billing.payments.void";
    }

    pub mod receipts {
        pub const PRINT: &str = "billing.receipts.print";
        pub const REPRINT: &str = "billing.receipts.reprint";
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
        pub const ENROLL: &str = "billing.corporate.enroll";
        pub const UNENROLL: &str = "billing.corporate.unenroll";
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
        pub const APPLY: &str = "billing.credit.apply";
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
        pub const UPDATE: &str = "ipd.admissions.update";
        pub const PRINT: &str = "ipd.admissions.print";
        pub const REPRINT: &str = "ipd.admissions.reprint";
    }

    pub mod attenders {
        pub const MANAGE: &str = "ipd.attenders.manage";
    }

    pub mod wristband {
        pub const PRINT: &str = "ipd.wristband.print";
        pub const REPRINT: &str = "ipd.wristband.reprint";
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

    pub mod tariffs {
        pub const LIST: &str = "ipd.tariffs.list";
        pub const MANAGE: &str = "ipd.tariffs.manage";
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
        pub const UPDATE: &str = "ipd.discharge_tat.update";
        pub const BILLING_UPDATE: &str = "ipd.discharge_tat.billing.update";
        pub const PHARMACY_UPDATE: &str = "ipd.discharge_tat.pharmacy.update";
        pub const NURSING_UPDATE: &str = "ipd.discharge_tat.nursing.update";
        pub const DOCTOR_UPDATE: &str = "ipd.discharge_tat.doctor.update";
        pub const COMPLETE: &str = "ipd.discharge_tat.complete";
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

    pub mod assets {
        pub const MANAGE: &str = "camp.assets.manage";
    }

    pub mod registrations {
        pub const LIST: &str = "camp.registrations.list";
        pub const CREATE: &str = "camp.registrations.create";
        pub const UPDATE: &str = "camp.registrations.update";
    }

    pub mod screenings {
        pub const LIST: &str = "camp.screenings.list";
        pub const MANAGE: &str = "camp.screenings.manage";
    }

    pub mod referrals {
        pub const CREATE: &str = "camp.referrals.create";
        pub const UPDATE: &str = "camp.referrals.update";
        pub const STATUS: &str = "camp.referrals.status";
    }

    pub mod lab {
        pub const LIST: &str = "camp.lab.list";
        pub const MANAGE: &str = "camp.lab.manage";
    }

    pub mod billing {
        pub const LIST: &str = "camp.billing.list";
        pub const CREATE: &str = "camp.billing.create";
    }

    pub mod followups {
        pub const LIST: &str = "camp.followups.list";
        pub const MANAGE: &str = "camp.followups.manage";
        pub const SCHEDULE: &str = "camp.followups.schedule";
        pub const OUTCOME: &str = "camp.followups.outcome";
        pub const CONVERT: &str = "camp.followups.convert";
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

/// Wall displays: TVs, door boards and kiosks that show a queue.
///
/// A screen on a wall is not an administrator. `admin.tv_displays.board` and
/// `admin.tv_displays.list` are operator codes — the board's contents and the
/// screen's configuration — and neither was ever granted to a role, so every
/// TV surface in the product was readable only by a bypass account. Fixing
/// that by granting the admin code would have handed each display everything
/// an operator can see on a screen nobody is standing at.
///
/// This is the read-only half, sized for a device.
pub mod display {
    pub mod board {
        /// Read a wall board's live contents on a paired display.
        ///
        /// Only counts when the request carries a paired device: the role that
        /// holds this exists for screens bolted to walls, and a credential
        /// lifted off one should not become a way to read every ward board from
        /// a laptop. Operators keep reaching the same boards through
        /// `admin.tv_displays.board`, which carries no such condition.
        pub const READ: &str = "display.board.read";
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

    pub mod calls {
        /// See every open call in the ward.
        ///
        /// `bedside.view` answers "may I read this admission's bedside data",
        /// which is the question a patient's own tablet asks and the only
        /// question the bedside module could answer. A ward call board asks a
        /// different one — every patient waiting right now, across admissions
        /// the caller may hold no relationship to — and answering it is what
        /// makes a call button worth pressing.
        ///
        /// Separate rather than folded into `bedside.view`, because widening
        /// that would have handed the whole ward to every holder of a
        /// per-admission read, silently and retroactively.
        pub const BOARD: &str = "bedside.calls.board";
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
        pub const UPDATE: &str = "emergency.codes.update";
    }

    pub mod mlc {
        pub const LIST: &str = "emergency.mlc.list";
        pub const CREATE: &str = "emergency.mlc.create";
        pub const UPDATE: &str = "emergency.mlc.update";
        pub const PRINT: &str = "emergency.mlc.print";
        pub const REPRINT: &str = "emergency.mlc.reprint";
    }

    pub mod mlc_documents {
        pub const SBAR_CREATE: &str = "emergency.mlc_documents.sbar.create";
        pub const AGE_ESTIMATION_CREATE: &str = "emergency.mlc_documents.age_estimation.create";
        pub const POCSO_CREATE: &str = "emergency.mlc_documents.pocso.create";
        pub const COURT_SUMMONS_CREATE: &str = "emergency.mlc_documents.court_summons.create";
    }

    pub mod mlc_police_intimations {
        pub const LIST: &str = "emergency.mlc_police_intimations.list";
        pub const CREATE: &str = "emergency.mlc_police_intimations.create";
        pub const CONFIRM: &str = "emergency.mlc_police_intimations.confirm";
        pub const PRINT: &str = "emergency.mlc_police_intimations.print";
        pub const REPRINT: &str = "emergency.mlc_police_intimations.reprint";
    }

    pub mod mass_casualty {
        pub const LIST: &str = "emergency.mass_casualty.list";
        pub const CREATE: &str = "emergency.mass_casualty.create";
        pub const UPDATE: &str = "emergency.mass_casualty.update";
        pub const CLOSE: &str = "emergency.mass_casualty.close";
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
    pub mod payroll {
        pub mod structures {
            pub const LIST: &str = "hr.payroll.structures.list";
            pub const MANAGE: &str = "hr.payroll.structures.manage";
        }
        pub mod runs {
            pub const LIST: &str = "hr.payroll.runs.list";
            pub const CREATE: &str = "hr.payroll.runs.create";
        }
    }
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

    // ── NABH Phase 2 data captures (migration 0110) ──
    pub mod falls {
        pub const LIST: &str = "quality.falls.list";
        pub const CREATE: &str = "quality.falls.create";
        pub const UPDATE: &str = "quality.falls.update";
    }

    pub mod pressure_ulcer {
        pub const LIST: &str = "quality.pressure_ulcer.list";
        pub const CREATE: &str = "quality.pressure_ulcer.create";
        pub const UPDATE: &str = "quality.pressure_ulcer.update";
    }

    pub mod sentinel_events {
        pub const LIST: &str = "quality.sentinel_events.list";
        pub const CREATE: &str = "quality.sentinel_events.create";
        pub const UPDATE: &str = "quality.sentinel_events.update";
    }

    pub mod transfusion_reactions {
        pub const LIST: &str = "quality.transfusion_reactions.list";
        pub const CREATE: &str = "quality.transfusion_reactions.create";
        pub const UPDATE: &str = "quality.transfusion_reactions.update";
    }

    pub mod code_blue {
        pub const LIST: &str = "quality.code_blue.list";
        pub const CREATE: &str = "quality.code_blue.create";
        pub const UPDATE: &str = "quality.code_blue.update";
    }

    pub mod equipment_downtime {
        pub const LIST: &str = "quality.equipment_downtime.list";
        pub const CREATE: &str = "quality.equipment_downtime.create";
        pub const UPDATE: &str = "quality.equipment_downtime.update";
    }

    pub mod fire_drills {
        pub const LIST: &str = "quality.fire_drills.list";
        pub const CREATE: &str = "quality.fire_drills.create";
        pub const UPDATE: &str = "quality.fire_drills.update";
    }

    pub mod bmw_disposal {
        pub const LIST: &str = "quality.bmw_disposal.list";
        pub const CREATE: &str = "quality.bmw_disposal.create";
        pub const UPDATE: &str = "quality.bmw_disposal.update";
    }
}

/// Marketing — enquiries, acquisition pipeline and campaigns.
///
/// Deliberately separate from `patients.*`. These codes govern the enquiry
/// record, which exists before anybody is a patient and often for somebody who
/// never becomes one. A tele-calling executive needs the enquiry and must not
/// thereby get the chart.
pub mod marketing {
    pub mod contacts {
        /// List enquiry contacts.
        ///
        /// The enquiry record — name, number, what they asked about, which
        /// campaign produced them. Not the clinical record.
        pub const LIST: &str = "marketing.contacts.list";
        /// Open an enquiry contact.
        pub const VIEW: &str = "marketing.contacts.view";
        /// Record a new enquiry.
        pub const CREATE: &str = "marketing.contacts.create";
        /// Edit an enquiry contact.
        pub const UPDATE: &str = "marketing.contacts.update";
        /// Merge duplicate enquiry contacts.
        ///
        /// Merging is destructive to the losing record's identity, so it is
        /// separate from ordinary editing.
        pub const MERGE: &str = "marketing.contacts.merge";
    }

    pub mod pipeline {
        /// View the enquiry pipeline.
        pub const VIEW: &str = "marketing.pipeline.view";
        /// Move an enquiry between stages.
        pub const MOVE: &str = "marketing.pipeline.move";
        /// Assign or reassign an enquiry.
        pub const ASSIGN: &str = "marketing.pipeline.assign";
    }

    pub mod interactions {
        /// Log a call, message or note.
        pub const LOG: &str = "marketing.interactions.log";
        /// Play back a call recording.
        ///
        /// A recording carries whatever the caller said, including symptoms
        /// they were told not to describe. Held apart from reading the
        /// interaction timeline, which carries only the disposition.
        pub const PLAY_RECORDING: &str = "marketing.interactions.play_recording";
    }

    pub mod campaigns {
        /// View campaigns and their attribution.
        pub const VIEW: &str = "marketing.campaigns.view";
        /// Create and edit campaigns.
        pub const MANAGE: &str = "marketing.campaigns.manage";
    }

    pub mod consent {
        /// View a contact's consent history.
        ///
        /// What they agreed to, on which channel, and when they changed
        /// their mind. Reading it is how the desk knows whether it may ring.
        pub const VIEW: &str = "marketing.consent.view";
        /// Record a consent grant.
        ///
        /// A legal act, not an edit: it asserts a notice was shown and a
        /// person agreed. Separate from editing the enquiry so that whoever
        /// can fix a misspelt name cannot also manufacture a grant.
        pub const CAPTURE: &str = "marketing.consent.capture";
        /// Withdraw consent on a contact's behalf.
        ///
        /// The patient told somebody to stop. Whoever they told must be able
        /// to record it without waiting for a campaign manager.
        pub const WITHDRAW: &str = "marketing.consent.withdraw";
    }

    /// Add or lift a do-not-contact suppression.
    ///
    /// Suppression is keyed on the number rather than the enquiry record, so
    /// it outlives the record and survives the person being created again.
    /// Lifting one is why this is a single permission and not a read: the
    /// people who run campaigns may see that somebody is unreachable, and may
    /// not make them reachable.
    pub const SUPPRESSION_MANAGE: &str = "marketing.suppression.manage";

    pub mod cohorts {
        /// View cohort names and sizes.
        ///
        /// A cohort is a list of people to contact. Marketing sees its name,
        /// its size and when it was built — never why any individual is in it.
        pub const VIEW: &str = "marketing.cohorts.view";
        /// Build a cohort from enquiry criteria.
        ///
        /// Source, campaign, stage, last-contacted — the enquiry record only.
        pub const MANAGE: &str = "marketing.cohorts.manage";
        /// Build a cohort from clinical criteria.
        ///
        /// Recall lists — due for a screen, dormant after a procedure. The
        /// query runs with clinical authority and returns contactable
        /// identities; the diagnosis never crosses into the marketing tables.
        /// A clinical act wearing a marketing name, so it is held by
        /// clinicians and not by the people who run the campaign.
        pub const CLINICAL_DEFINE: &str = "marketing.cohorts.clinical_define";
    }

    pub mod outreach {
        /// Send a campaign to a cohort.
        ///
        /// Calls, SMS and WhatsApp alike. Separate from building the cohort,
        /// because the mistake that reaches thousands of people is the send,
        /// not the query.
        pub const SEND: &str = "marketing.outreach.send";
        /// Approve campaign content before it sends.
        ///
        /// NMC advertising rules and the Drugs and Magic Remedies Act bind
        /// what a hospital may say. Automation scales a wording error to the
        /// whole list, so approval is a second pair of eyes and deliberately
        /// not held by whoever wrote the campaign.
        pub const APPROVE: &str = "marketing.outreach.approve";
    }

    /// View acquisition funnel reports.
    ///
    /// Conversion by source, specialty and agent. Doctor-level conversion is
    /// deliberately NOT part of this code — see the module RFC.
    pub const REPORTS_VIEW: &str = "marketing.reports.view";

    pub mod messaging {
        /// Accept WhatsApp and SMS events from the provider.
        ///
        /// A sibling of `telephony.ingest` and deliberately a separate code.
        /// The two are usually different vendors — a telephony provider and a
        /// WhatsApp business solution provider — and a key that can write call
        /// history should not thereby be able to write message history. One
        /// code for both would mean a leaked BSP key could forge the record of
        /// what a hospital said to a patient.
        ///
        /// **Held by no built-in role**, for the same reason: this is machine
        /// identity, authenticated with an API key carrying an explicit
        /// permission list.
        pub const INGEST: &str = "marketing.messaging.ingest";
    }

    pub mod telephony {
        /// Accept call events from the phone system.
        ///
        /// A machine endpoint. The switch — FreePBX over AMI, or a provider
        /// webhook — posts what happened to a call, and the module turns it
        /// into an interaction and, if it was missed, a callback task.
        ///
        /// **Held by no built-in role, deliberately.** Nothing a human does in
        /// a browser should reach this: it is authenticated with an API key
        /// carrying an explicit permission list, which is what machine
        /// identity is for. A role holding it would let any of that role's
        /// holders fabricate call history, and call history is what the
        /// missed-call number and every conversion report are computed from.
        pub const INGEST: &str = "marketing.telephony.ingest";
    }

    /// Configure pipeline stages, templates and routing.
    pub const SETTINGS_MANAGE: &str = "marketing.settings.manage";
}

/// Research use of clinical data, as distinct from care use of it.
pub mod research {
    /// Export a de-identified research dataset.
    ///
    /// The triage research endpoints return aggregate performance and a
    /// 5,000-row de-identified extract — age banded, timing truncated to the
    /// ISO week, no name and no UHID. They ran on `opd.queue.view`, which the
    /// front desk holds to call the next patient, so anyone working a queue
    /// could pull the hospital's research corpus. Research use is a different
    /// act from care use even when the rows carry no direct identifier: free
    /// text and rare combinations re-identify.
    pub const TRIAGE_EXPORT: &str = "research.triage_export";
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

pub mod assets {
    pub const LIST: &str = "assets.list";
    pub const MANAGE: &str = "assets.manage";
    pub const RESERVE: &str = "assets.reserve";
    pub const ISSUE: &str = "assets.issue";
    pub const RETURN: &str = "assets.return";
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

    pub mod case_sheets {
        pub const VIEW: &str = "mrd.case_sheets.view";
        pub const GENERATE: &str = "mrd.case_sheets.generate";
        pub const PRINT: &str = "mrd.case_sheets.print";
        pub const FILE: &str = "mrd.case_sheets.file";
        pub const REPRINT: &str = "mrd.case_sheets.reprint";
    }

    pub mod storage {
        pub const MANAGE: &str = "mrd.storage.manage";
    }

    pub mod forms {
        pub const VIEW: &str = "mrd.forms.view";
        pub const MANAGE: &str = "mrd.forms.manage";
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

    /// Long-term and post-acute care — nursing-home residents, skilled
    /// nursing facility stays, home-care referrals and the family channel.
    ///
    /// The whole module ran on `ipd.nursing_assessment` before this, so
    /// recording one ward observation carried the right to read a resident's
    /// family messages and open a skilled-nursing admission, while an LTC
    /// coordinator could not be granted either without IPD nursing rights.
    pub mod ltc {
        pub mod mds {
            /// View MDS assessments.
            ///
            /// The Minimum Data Set — the standardised functional, cognitive
            /// and clinical assessment of a long-term care resident.
            pub const LIST: &str = "specialty.ltc.mds.list";
            /// Start an MDS assessment.
            pub const CREATE: &str = "specialty.ltc.mds.create";
            /// Complete an MDS assessment.
            ///
            /// Signs the assessment off; it drives the resident's care plan
            /// and reimbursement category, so completing is not editing.
            pub const COMPLETE: &str = "specialty.ltc.mds.complete";
        }
        pub mod medications {
            /// View long-term medications.
            pub const LIST: &str = "specialty.ltc.medications.list";
            /// Add a long-term medication.
            pub const CREATE: &str = "specialty.ltc.medications.create";
            /// Refill or amend a long-term medication.
            pub const UPDATE: &str = "specialty.ltc.medications.update";
        }
        pub mod rehab {
            /// View rehabilitation progress.
            pub const LIST: &str = "specialty.ltc.rehab.list";
            /// Record rehabilitation progress.
            pub const CREATE: &str = "specialty.ltc.rehab.create";
        }
        pub mod family {
            /// View family messages.
            ///
            /// Correspondence between a resident's relatives and the care
            /// team — read by families, so treated as resident-identifying.
            pub const LIST: &str = "specialty.ltc.family.list";
            /// Post a family message.
            pub const CREATE: &str = "specialty.ltc.family.create";
            /// Edit or withdraw a family message.
            pub const UPDATE: &str = "specialty.ltc.family.update";
        }
        pub mod readmission {
            /// View readmission risk assessments.
            pub const LIST: &str = "specialty.ltc.readmission.list";
            /// Assess readmission risk.
            pub const CREATE: &str = "specialty.ltc.readmission.create";
        }
        pub mod home_care {
            /// View home-care referrals.
            pub const LIST: &str = "specialty.ltc.home_care.list";
            /// Refer a resident to home care.
            pub const CREATE: &str = "specialty.ltc.home_care.create";
            /// Update a home-care referral.
            pub const UPDATE: &str = "specialty.ltc.home_care.update";
        }
        pub mod snf {
            /// View skilled nursing facility admissions.
            pub const LIST: &str = "specialty.ltc.snf.list";
            /// Admit a resident to a skilled nursing facility.
            pub const CREATE: &str = "specialty.ltc.snf.create";
            /// Update a skilled nursing facility admission.
            pub const UPDATE: &str = "specialty.ltc.snf.update";
        }
    }

    /// Clinical trials — a hospital research department's studies.
    ///
    /// These codes were checked as bare string literals with no definition
    /// anywhere, so no role could hold them and `require_permission` refused
    /// every non-bypass caller. The whole module worked for `super_admin` and
    /// `hospital_admin` only, and no administrator could grant it, because it
    /// never appeared in the catalogue the admin UI renders.
    pub mod clinical_trials {
        /// View trials and their participants.
        pub const LIST: &str = "specialty.clinical_trials.list";
        /// Register trials, consents, visits and adverse events.
        pub const CREATE: &str = "specialty.clinical_trials.create";
        /// Break a randomisation blind.
        ///
        /// Unblinding is a controlled act: it ends the masking for that
        /// participant and must be justified and auditable. It was gated on
        /// `create` — the same code as scheduling a visit.
        pub const UNBLIND: &str = "specialty.clinical_trials.unblind";
        /// Screen the patient population for trial candidates.
        ///
        /// Screening is not listing. It searches every patient in the tenant by
        /// diagnosis code and returns their names, so running it against a
        /// trial's ICD codes produces a named list of the people who carry that
        /// diagnosis — the disclosure is the diagnosis, not the trial. It was
        /// gated on `list`, which every trial user holds.
        pub const SCREEN: &str = "specialty.clinical_trials.screen";
    }

    /// Health packages — priced bundles sold at the front desk.
    pub mod health_packages {
        /// View health packages.
        pub const LIST: &str = "specialty.health_packages.list";
        /// Create and price health packages.
        pub const MANAGE: &str = "specialty.health_packages.manage";
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
        /// Postnatal records are the mother's recovery, not the baby's care.
        /// They were reached through the newborn permission, which quietly
        /// granted every clinician recording infant observations the right to
        /// write the mother's postnatal chart.
        pub mod postnatal {
            /// View postnatal records.
            ///
            /// The mother's recovery after delivery — fundal height, lochia,
            /// perineal healing, breastfeeding and mood observations.
            pub const LIST: &str = "specialty.maternity.postnatal.list";
            /// Record a postnatal visit.
            ///
            /// Adds an observation to the mother's postnatal chart.
            pub const CREATE: &str = "specialty.maternity.postnatal.create";
        }
    }

    pub mod ophthalmology {
        pub mod exams {
            pub const LIST: &str = "specialty.ophthalmology.exams.list";
            pub const CREATE: &str = "specialty.ophthalmology.exams.create";
            pub const UPDATE: &str = "specialty.ophthalmology.exams.update";
        }
    }

    pub mod dental {
        pub mod exams {
            pub const LIST: &str = "specialty.dental.exams.list";
            pub const CREATE: &str = "specialty.dental.exams.create";
            pub const UPDATE: &str = "specialty.dental.exams.update";
        }
        pub mod chart {
            pub const LIST: &str = "specialty.dental.chart.list";
            pub const CREATE: &str = "specialty.dental.chart.create";
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
        pub mod oncology {
            pub const LIST: &str = "specialty.other.oncology.list";
            pub const CREATE: &str = "specialty.other.oncology.create";
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

/// The clinical knowledge base — drug monographs, protocols, notifiable-disease
/// reference. Seeded clinical content, never patient data.
///
/// These existed only in the TypeScript catalogue, so `useRequirePermission`
/// on `/clinical-kb` matched a code the server had never defined and redirected
/// every non-bypass user away from the page.
pub mod ckb {
    /// Open the clinical knowledge base.
    pub const VIEW: &str = "ckb.view";

    pub mod reports {
        /// List knowledge-base reports.
        pub const LIST: &str = "ckb.reports.list";
        /// Create and edit knowledge-base reports.
        pub const MANAGE: &str = "ckb.reports.manage";
    }
}

/// Remote access for staff working off-site.
///
/// Same story as `ckb` — `/remote-access` guarded on `vpn.enroll`, which no
/// Rust constant defined, so the page was unreachable.
pub mod vpn {
    /// Enrol this device for remote access.
    pub const ENROLL: &str = "vpn.enroll";
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

    /// Oversight of the approvals platform.
    ///
    /// Without this you see an approval request only if you raised it, are an
    /// approver on it, or it is about you. That is the default because a
    /// request names what somebody asked for — a role, a permission, leave —
    /// and the queue is a directory of who wanted what.
    pub mod approvals {
        /// See every request in the tenant, not just your own.
        pub const OVERSEE: &str = "admin.approvals.oversee";
    }

    /// Machine credentials for the API.
    ///
    /// Separate from `admin.users` on purpose. A key is not a user and issuing
    /// one is not the same decision as creating a person: whoever can mint a
    /// key can mint a credential that outlives their own account, so the grant
    /// is its own thing rather than a side effect of user administration.
    ///
    /// There is no UPDATE. A key's permissions are fixed at creation — being
    /// able to widen one silently is exactly the property the explicit
    /// allowlist exists to prevent. Change the scope by issuing a new key and
    /// revoking the old one, which leaves a trail.
    pub mod api_keys {
        pub const LIST: &str = "admin.api_keys.list";
        pub const CREATE: &str = "admin.api_keys.create";
        pub const REVOKE: &str = "admin.api_keys.revoke";
        /// Reading what a key actually did — a forensic surface, so it is
        /// grantable to an auditor who cannot mint or revoke anything.
        pub const VIEW_USAGE: &str = "admin.api_keys.view_usage";
    }

    /// Sprint A: per-tenant operating mode flip (`normal/degraded/read_only`).
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

    pub mod sharing {
        pub const MANAGE: &str = "admin.sharing.manage";
    }

    /// Queue/TV display boards. These codes already existed on the frontend
    /// (`P.ADMIN.TV_DISPLAYS.*`) but had no Rust counterpart, so the handlers
    /// enforced nothing — the gate was UI-only.
    pub mod tv_displays {
        pub const LIST: &str = "admin.tv_displays.list";
        pub const CREATE: &str = "admin.tv_displays.create";
        pub const UPDATE: &str = "admin.tv_displays.update";
        pub const DELETE: &str = "admin.tv_displays.delete";
        pub const TOKENS: &str = "admin.tv_displays.tokens";
        pub const BROADCAST: &str = "admin.tv_displays.broadcast";
        /// Read a queue or bed board.
        ///
        /// Distinct from `list`, which is the display *configuration*: this is
        /// the board's live contents — the waiting counts, the ER acuity mix,
        /// the bed availability and the per-department queue analytics that
        /// drive the screens on the wall. Seven board endpoints checked nothing
        /// at all, so any authenticated user in the tenant could read them,
        /// while the display and token handlers beside them had been gated in
        /// an earlier pass. Widening `list` to cover this would have handed the
        /// boards to everyone who may edit a screen's settings.
        pub const BOARD: &str = "admin.tv_displays.board";
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

        /// Read tenant configuration.
        ///
        /// Not an administrative act. This is the configuration the application
        /// itself runs on — which vitals a ward captures, whether weights are
        /// metric, which locale to format in — and every clinical screen reads
        /// it on load. Reading was gated on `settings.modules.manage`, which no
        /// role holds, so for every non-bypass user the read failed and the
        /// screen fell back to defaults without saying so. A ward that
        /// configured its vitals set had that configuration ignored, and a
        /// hospital on imperial units was shown metric.
        ///
        /// Sensitive categories are NOT covered by this and still require
        /// `general.manage` — see `SENSITIVE_SETTING_CATEGORIES`.
        pub const READ: &str = "admin.settings.read";

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
        /// Ward/compliance-wide verbal & telephone order countersign register
        /// (NABH audit view) — broader than the prescriber's own queue.
        pub const VERBAL_REGISTER: &str = "doctor.signoffs.verbal_register";
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
    pub const START: &str = "audit.break_glass.start";
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

    pub mod pairing {
        pub const TOKEN_CREATE: &str = "devices.pairing.token.create";
        pub const PAIRED_LIST: &str = "devices.pairing.paired.list";
        pub const PAIRED_REVOKE: &str = "devices.pairing.paired.revoke";
        /// Read the peer-sync roster.
        ///
        /// Separate from `PAIRED_LIST` on purpose. An edge appliance
        /// polls the roster unattended and holds its credential on
        /// disk for months; giving it the operator's device-listing
        /// right means a leaked appliance token enumerates the whole
        /// estate. This is the one thing an appliance needs.
        pub const ROSTER_READ: &str = "devices.pairing.roster.read";
    }
}

pub mod storage {
    pub mod policies {
        pub const LIST: &str = "storage.policies.list";
        pub const MANAGE: &str = "storage.policies.manage";
    }

    pub mod transitions {
        pub const LIST: &str = "storage.transitions.list";
    }

    pub mod usage {
        pub const VIEW: &str = "storage.usage.view";
    }

    pub const RESTORE: &str = "storage.restore";
    pub const SWEEP_TRIGGER: &str = "storage.sweep.trigger";
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
    pub mod prescriptions {
        pub const DRAFT: &str = "nurse.prescriptions.draft";
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
    pub mod transfusion {
        /// See the transfusions running on a bed.
        ///
        /// Distinct from `blood_bank.transfusion.list`, which is the bank's
        /// issue register — who was given which bag out of stock. This is the
        /// bedside record: the two-person identity check, the observation
        /// schedule, and whether the patient reacted.
        pub const VIEW: &str = "nurse.transfusion.view";

        /// Start, observe and complete a transfusion at the bed.
        ///
        /// The bank issues the unit; a nurse hangs it, checks the patient
        /// against the bag with a second nurse, and watches for the first
        /// fifteen minutes. Those are different acts by different people in
        /// different rooms, and `blood_bank.transfusion.create` — held by
        /// blood_bank_tech and by nobody at a bedside — could not express the
        /// second one.
        pub const ADMINISTER: &str = "nurse.transfusion.administer";
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
    pub mod handoff_entries {
        // Lightweight T2 append-only log used by the offline-mode
        // handoff hook. Distinct from the SBAR `handoff` resource.
        pub const VIEW: &str = "nurse.handoff_entries.view";
        pub const RECORD: &str = "nurse.handoff_entries.record";
    }
    pub mod shift_notes {
        pub const VIEW: &str = "nurse.shift_notes.view";
        pub const EDIT: &str = "nurse.shift_notes.edit";
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

/// ABDM — Ayushman Bharat Digital Mission, India's national health-ID and
/// facility-registry integration.
///
/// These four codes lived as `const … : &str` inside the route files, which
/// meant `require_permission` compared against a string no role could ever
/// hold: every non-bypass caller got 403, and no administrator could grant
/// access, because the codes never reached the catalogue the admin UI renders.
/// The frontend guarded on the same literal, so the control was hidden too.
pub mod abdm {
    pub mod abha {
        /// View a patient's ABHA health ID.
        pub const VIEW: &str = "abdm.abha.view";
        /// Create or link a patient's ABHA health ID.
        pub const MANAGE: &str = "abdm.abha.manage";
    }
    pub mod hfr {
        /// View this facility's Health Facility Registry entry.
        pub const VIEW: &str = "abdm.hfr.view";
        /// Register or update the facility in the Health Facility Registry.
        ///
        /// A facility-level administrative act, not a clinical one.
        pub const REGISTER: &str = "abdm.hfr.register";
    }
}

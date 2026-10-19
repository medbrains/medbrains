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
pub const PERMISSION_COUNT: usize = 794;

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

/// Sticky notes: a person's own notes, shared to department boards or colleagues.
///
/// Notes are for the ward's logistics — rotas, reminders, a broken monitor —
/// never for patient information, which belongs in the chart where it is
/// audited and consented.
pub mod notes {
    /// Keep notes and share them.
    /// Write your own notes and share them to department boards or with colleagues.
    pub const USE: &str = "notes.use";
    /// Take notes off a department board.
    /// Remove a note from the board of a department you belong to, whoever wrote it.
    pub const MODERATE: &str = "notes.moderate";
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
    /// Find any patient at the desk.
    ///
    /// A desk lookup, not a browse. It searches every patient in the tenant by
    /// UHID, phone or name and returns identity only — name, UHID, phone, date
    /// of birth, sex — never a chart, never a diagnosis. `patients.list` is
    /// relationship-scoped, so a receptionist could not find a patient a
    /// colleague had registered and the returning patient was registered a
    /// second time, which is how a hospital ends up with two records and half
    /// a history in each. Widening `list` would have handed a tenant-wide
    /// browse to everyone already holding it; this is the narrower grant, and
    /// the lookup is audited like every other read under `/api/patients`.
    pub const FIND: &str = "patients.find";
    pub const VIEW: &str = "patients.view";
    pub const CREATE: &str = "patients.create";
    pub const UPDATE: &str = "patients.update";
    pub const DELETE: &str = "patients.delete";

    pub mod privacy_requests {
        /// See patients' privacy requests.
        ///
        /// The DPDP Act rights register: requests to see, correct or erase
        /// personal data, to name a nominee, and privacy grievances, with
        /// the 90-day answer due date of each.
        pub const LIST: &str = "patients.privacy_requests.list";
        /// Record a patient's privacy request.
        ///
        /// Take down a request the patient makes at the desk, by email or by
        /// phone, so it starts its 90-day clock the day it arrives.
        pub const CREATE: &str = "patients.privacy_requests.create";
        /// Answer a patient's privacy request.
        ///
        /// Close a request as done or refused. A refusal states its reason —
        /// an erasure refused because the law requires the medical record to
        /// be kept, for example.
        pub const DECIDE: &str = "patients.privacy_requests.decide";
    }

    pub mod acquisition {
        /// Correct where a patient came from.
        ///
        /// Set or change the campaign a registered patient is attributed to;
        /// every change is audited.
        pub const UPDATE: &str = "patients.acquisition.update";
    }

    pub mod allergies {
        /// Mark a recorded allergy as wrong.
        ///
        /// Retires an allergy as "entered in error" or "refuted" (not
        /// allergic, e.g. after testing) with a recorded reason. The allergy
        /// stops alerting and stays on the chart struck through, with who,
        /// when and why — a clinical record is corrected, never erased. A
        /// wrong penicillin label pushes patients onto broader antibiotics, so
        /// this is a doctor's call.
        pub const VERIFY: &str = "patients.allergies.verify";
    }

    pub mod notes {
        pub const VIEW: &str = "patients.notes.view";
        pub const EDIT: &str = "patients.notes.edit";
    }
}

/// The case sheet: every clinician's dated, signed notes on a visit.
pub mod clinical_notes {
    /// Read a visit's notes.
    /// Signed notes, and drafts as far as the hospital's draft setting allows.
    pub const VIEW: &str = "clinical_notes.view";
    /// Write your own notes.
    /// Start a note or addendum and keep its draft; nurses write nursing
    /// notes, doctors the physician notes.
    pub const WRITE: &str = "clinical_notes.write";
    /// Sign your own notes.
    /// Signing stamps your name and time and locks the note after the
    /// hospital's grace period; revising within it keeps the old version.
    pub const SIGN: &str = "clinical_notes.sign";
    /// Mark a note entered in error.
    /// Your own notes, with a reason; the text stays, struck through.
    pub const MARK_IN_ERROR: &str = "clinical_notes.mark_in_error";
    /// Countersign a resident's note.
    /// Notes signed by the doctors you supervise; return one with a comment
    /// and it goes back to its author to revise.
    pub const COSIGN: &str = "clinical_notes.cosign";
    /// Print a visit's case-sheet notes.
    /// Every signed note with its author, time and signature, as the paper
    /// sheet reads; the print is filed to the visit's medical record.
    pub const PRINT: &str = "clinical_notes.print";
    /// Export a visit's notes as FHIR.
    /// The signed notes as FHIR R4 Compositions, for another hospital, ABDM
    /// or an integration; drafts are never exported.
    pub const EXPORT: &str = "clinical_notes.export";
}

pub mod home_health {
    /// View home care.
    /// Home visits, home medication schedules, escalations, remote vitals,
    /// care packages, hospice, advance directives and bereavement follow-up.
    pub const LIST: &str = "home_health.list";
    /// Run home care.
    /// Schedule and document home visits, record home doses, raise and
    /// close escalations, and keep hospice and advance-directive records.
    pub const MANAGE: &str = "home_health.manage";
}

pub mod opd {
    pub mod queue {
        pub const LIST: &str = "opd.queue.list";
        pub const VIEW: &str = "opd.queue.view";
    }

    pub mod visit {
        pub const CREATE: &str = "opd.visit.create";
        pub const UPDATE: &str = "opd.visit.update";
        /// Move a waiting visit to another department.
        ///
        /// For a patient registered to the wrong department, before any
        /// doctor has called them: the visit, its queue place and its token
        /// move together, and the new department's doctor gains access.
        pub const TRANSFER: &str = "opd.visit.transfer";
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
        /// Accept, decline or answer a referral.
        /// Only referrals addressed to the caller, or to their department when
        /// no doctor is named. Accepting puts the patient in the caller's queue.
        pub const RESPOND: &str = "opd.referrals.respond";
        /// Withdraw a referral you sent.
        /// Only while it is still pending, and only the referring doctor.
        pub const CANCEL: &str = "opd.referrals.cancel";
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
        /// Register a walk-in lab order.
        ///
        /// For a patient who comes to the laboratory without a doctor's
        /// order in this hospital — self-referred, or carrying an outside
        /// prescription. Opens the lab visit, records who referred them
        /// (a hospital doctor, an outside doctor, or self) and raises the
        /// bill, in one step at the lab counter.
        pub const DIRECT: &str = "lab.orders.direct";
    }

    /// The test catalogue: which tests exist, and what they mean.
    ///
    /// Separate from ordering. Five handlers -- create/update catalogue entry
    /// and create/update/delete panel -- were gated on `lab.orders.create`,
    /// so anyone who could order a test could also rename one, change its
    /// reference range or critical values, or delete a panel outright. Every
    /// doctor and lab technician held that.
    ///
    /// Editing this catalogue changes what a result *means*: the reference
    /// range a clinician reads an abnormal flag against, the LOINC code the
    /// result is exchanged under, the critical thresholds that raise an alert,
    /// and the turnaround the laboratory is measured on. It is master data,
    /// not clinical work.
    pub mod catalog {
        /// Edit the laboratory test catalogue and panels.
        ///
        /// Covers reference ranges, critical values, LOINC codes and
        /// turnaround times. Master data, held by the laboratory manager
        /// rather than by everyone who can order a test.
        pub const MANAGE: &str = "lab.catalog.manage";
    }

    pub mod results {
        pub const CREATE: &str = "lab.results.create";
        pub const UPDATE: &str = "lab.results.update";
        pub const AMEND: &str = "lab.results.amend";
        /// Release lab results to the treating team.
        ///
        /// Verification is the clinical signature on a result, not another
        /// edit of it, and it was gated on `lab.results.update` — the same
        /// code that types the value in. One account could therefore enter a
        /// result and release it, which NABL and ISO 15189 both write rules
        /// against.
        ///
        /// Splitting the code does not by itself split the duty: this system
        /// has a single lab role, and a night shift with one technologist
        /// still has to be able to report, so `lab_technician` holds this too
        /// and the hard four-eyes rule stays where the harm is — a critical
        /// value may not be released by the person who entered it. What the
        /// separate code buys is the ability to grant release to a supervisor
        /// role without also granting result entry, which could not be
        /// expressed at all before.
        pub const VERIFY: &str = "lab.results.verify";
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
        /// Collect a sample for a lab order.
        ///
        /// Drawing blood is the phlebotomist's or the ward nurse's job, and it
        /// was gated on `lab.results.create` — so the only way to let a nurse
        /// record a draw was to let her type results in too. This is the
        /// draw alone: positive patient identification and the tube's barcode,
        /// nothing that touches a result.
        pub const COLLECT: &str = "lab.samples.collect";
    }

    pub mod report_delivery {
        /// Configure how lab reports reach patients.
        ///
        /// Turns SMS, WhatsApp and email delivery on or off and sets the
        /// default channel for the whole hospital. It was gated on
        /// `lab.orders.list`, so anyone who could see the order list could
        /// start sending patients' reports over a new channel.
        pub const MANAGE: &str = "lab.report_delivery.manage";
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
    pub mod catalog {
        /// Look up drugs by name in the formulary.
        ///
        /// Read-only names, generics and schedules — enough to record what
        /// a patient is allergic to at registration without the pharmacy's
        /// prescription or dispensing access.
        pub const LOOKUP: &str = "pharmacy.catalog.lookup";
    }

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

    pub mod deliveries {
        /// View home deliveries.
        ///
        /// The deliveries list and each delivery's address, status and
        /// payment. A runner sees the ones assigned to them.
        pub const VIEW: &str = "pharmacy.deliveries.view";
        /// Arrange home deliveries.
        ///
        /// Send an order out for delivery: address, runner or courier,
        /// payment, dispatch — and record a failed attempt.
        pub const ARRANGE: &str = "pharmacy.deliveries.arrange";
        /// Complete deliveries at the door.
        ///
        /// Hand the medicines over against the patient's one-time code and
        /// record cash collected on delivery.
        pub const COMPLETE: &str = "pharmacy.deliveries.complete";
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
        /// Take a counter return after the return window.
        ///
        /// A sale older than the hospital's return window (15 days unless set)
        /// is locked for return and refund. This takes it back anyway, with a
        /// reason recorded against the credit note.
        pub const OVERRIDE_WINDOW: &str = "pharmacy.returns.override_window";
        /// Take back a controlled or Schedule X drug.
        ///
        /// NDPS and Schedule X medicines are not returnable at the counter.
        /// The pharmacist-in-charge may accept one with a recorded reason.
        pub const CONTROLLED: &str = "pharmacy.returns.controlled";
    }

    pub mod day_close {
        /// See a counter's business day and Z-report.
        ///
        /// Totals by tender, counted against expected cash, for any counter
        /// day, open or closed.
        pub const VIEW: &str = "pharmacy.day_close.view";
        /// Close a counter's business day.
        ///
        /// Count the cash, explain any variance and lock the day: no sale,
        /// return or void is dated to it afterwards. Only a cashier who worked
        /// that counter that day.
        pub const CLOSE: &str = "pharmacy.day_close.close";
        /// Reopen a closed counter day.
        ///
        /// Unlocks a closed day for correction, with a reason that is audited.
        /// Also closes a counter day the closer did not work.
        pub const REOPEN: &str = "pharmacy.day_close.reopen";
    }

    pub mod formulary {
        /// Dispense a non-formulary medicine.
        ///
        /// Lets a pharmacist approve or dispense a medicine that is not on the
        /// hospital formulary, with a recorded reason that is audited.
        pub const APPROVE: &str = "pharmacy.formulary.approve";
    }

    pub mod stewardship {
        /// Dispense a Reserve antibiotic before approval.
        ///
        /// Lets a pharmacist approve or dispense an AWaRe Reserve antibiotic
        /// whose stewardship request is not yet approved — e.g. a first dose in
        /// sepsis — with a recorded reason that is audited.
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
        /// Approve a counter discount above the limit.
        ///
        /// A counter sale discounted beyond the hospital's configured limit
        /// needs a reason and an approver who holds this. The approval is
        /// recorded against the sale.
        pub const DISCOUNT_APPROVE: &str = "pharmacy.pos.discount_approve";
    }

    pub mod patients {
        /// Find a patient at the pharmacy counter.
        ///
        /// Name, UHID or phone to a patient's name, age and sex — enough to
        /// link a counter sale to the right person and nothing more of the
        /// record.
        pub const SEARCH: &str = "pharmacy.patients.search";
    }

    pub mod bills {
        /// Print a pharmacy GST bill.
        ///
        /// The tax invoice for a counter sale posted to a registered patient,
        /// without access to the rest of billing.
        pub const PRINT: &str = "pharmacy.bills.print";
    }

    pub mod pricing {
        pub const MANAGE: &str = "pharmacy.pricing.manage";
    }

    pub mod safety {
        pub const VIEW: &str = "pharmacy.safety.view";
        /// Override a medication safety block.
        ///
        /// Lets a pharmacist proceed past a documented drug allergy, a serious
        /// drug-drug interaction or another medication safety block, with a
        /// recorded clinical reason that is audited.
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

    pub mod exchange_rates {
        /// Set currency exchange rates.
        ///
        /// A rate decides what a foreign-currency patient is billed in rupees,
        /// so setting one is tariff work, kept apart from reading reports.
        /// Reading the rates only needs `billing.invoices.list`.
        pub const MANAGE: &str = "billing.exchange_rates.manage";
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

    pub mod payer_split {
        /// Split a bill between insurer and patient.
        ///
        /// Assign each bill line to the insurer, scheme or corporate, or to
        /// the patient, overriding the automatic non-payables list; and
        /// write the insurer's share onto the claim as the amount claimed.
        pub const MANAGE: &str = "billing.payer_split.manage";
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

    pub mod consent {
        /// Certify emergency implied consent for surgery.
        ///
        /// For an emergency booking only, when the patient cannot consent and no
        /// relative can be reached in time. Two different doctors must each
        /// certify, in their own session after re-entering their password, with
        /// a reason. Recorded, audited, and printed on the operation notes.
        pub const EMERGENCY_OVERRIDE: &str = "ot.consent.emergency_override";
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

    /// The exams each modality performs ("CT Brain Plain", "USG Abdomen").
    pub mod exams {
        /// Edit the radiology exam catalogue.
        ///
        /// Which exams each modality performs, their body part, contrast
        /// and the charge code they are billed under. Master data, held by
        /// the radiology department rather than by everyone who orders.
        pub const MANAGE: &str = "radiology.exams.manage";
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

    pub mod queue {
        /// Call patients through a camp's stations.
        ///
        /// Call, recall and complete tokens at a camp's registration, vitals,
        /// doctor and pharmacy stations; completing one sends the patient to
        /// the next station with the same number.
        pub const MANAGE: &str = "camp.queue.manage";
    }
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

pub mod forms {
    pub mod templates {
        /// See the hospital's forms.
        ///
        /// The list of forms the hospital has built or customised, with each
        /// one's drafts and published versions.
        pub const LIST: &str = "forms.templates.list";
        /// Build and edit form drafts.
        ///
        /// Create a form, change its draft, and retire it. A draft is never
        /// what staff fill in; only a published version is.
        pub const MANAGE: &str = "forms.templates.manage";
        /// Publish a form version.
        ///
        /// Makes the current draft the version staff fill in from now on. A
        /// published version never changes, so every record keeps the exact
        /// questions it was answered against.
        pub const PUBLISH: &str = "forms.templates.publish";
    }

    pub mod definitions {
        /// Load the live version of a form.
        ///
        /// Needed by anyone who fills in a configurable form, such as a
        /// procedure consent. It reveals the questions, never any answers.
        pub const READ: &str = "forms.definitions.read";
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
        /// Defer or reinstate a blood donor.
        ///
        /// Sets a temporary deferral with an end date, a permanent one, or
        /// lifts it, always with a reason and an audit row. A donor deferred
        /// for a reactive TTI result cannot be reinstated here.
        pub const DEFER: &str = "blood_bank.donors.defer";
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
        /// Release uncrossmatched O-negative in an emergency.
        ///
        /// Issues a red-cell unit with no compatible crossmatch for the patient,
        /// which every other issue is refused. Only an O-negative unit, only with
        /// a written reason, and every use is written to the audit log.
        pub const EMERGENCY_RELEASE: &str = "blood_bank.transfusion.emergency_release";
    }

    pub mod tti {
        /// View donor TTI screening results.
        ///
        /// The per-marker HIV, HBsAg, HCV, syphilis and malaria results of a
        /// donation. A donor's infection status, so not part of inventory read.
        pub const VIEW: &str = "blood_bank.tti.view";
        /// Record donor TTI screening results.
        ///
        /// Enters the per-marker screening result for a donation. A reactive
        /// result quarantines the donation's units and defers the donor, and
        /// cannot later be changed.
        pub const RECORD: &str = "blood_bank.tti.record";
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
        /// Recall a sterilisation load or an issued pack.
        ///
        /// Recalling a load bars every pack of it from issue and flags every
        /// pack already issued from it so it can be fetched back from the ward
        /// or theatre — the response to a failed biological indicator. A single
        /// issued pack can be recalled too. Always with a reason; audited.
        pub const RECALL: &str = "cssd.sterilization.recall";
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
        /// Amend a certified or closed MLC.
        ///
        /// Changes what a medico-legal case records after the opinion is
        /// given, while it is in court, or once it is closed. MLC records are
        /// legal evidence: every amendment needs a written reason and is
        /// written to the audit trail with the old and new values.
        pub const AMEND: &str = "emergency.mlc.amend";
    }

    pub mod mlc_injuries {
        /// View the injuries on an MLC.
        ///
        /// Each injury on a medico-legal case by site, type, size and the
        /// examining doctor's opinion of its nature — what the injury
        /// certificate lists.
        pub const LIST: &str = "emergency.mlc_injuries.list";
        /// Record an injury on an MLC.
        ///
        /// Appends an injury (site picked on the body, type, size, nature).
        /// A legal record: injuries are never edited, a correction is a new
        /// entry, and the examining doctor is recorded.
        pub const CREATE: &str = "emergency.mlc_injuries.create";
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

    pub mod tasks {
        /// Start and complete your own cleaning tasks.
        ///
        /// The housekeeper's right. Starting an unassigned task claims it;
        /// completing needs the task to be assigned to you. Verifying,
        /// rejecting and reassigning stay with `housekeeping.cleaning.manage`,
        /// which before this was the only way to mark any task done.
        pub const PERFORM: &str = "housekeeping.tasks.perform";
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
        /// File and view leave for any employee.
        ///
        /// HR's reach. Without it a caller files leave only for themselves and
        /// sees only their own leave and, as a department head, their
        /// department's. Nobody approves their own leave, with or without it.
        pub const MANAGE: &str = "hr.leave.manage";
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
        /// Pick a campaign when registering.
        ///
        /// The active campaigns' names and codes only — enough for the desk
        /// to record where a new patient heard of the hospital, without
        /// spend or results.
        pub const LOOKUP: &str = "marketing.campaigns.lookup";
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
        /// Start an approved outreach run.
        ///
        /// Approval says the words are lawful; dispatch is the act of sending
        /// them to four thousand people. Separate, so that whoever signs off
        /// the content is not thereby the person who fires it, and so the
        /// button can be withheld from a run whose DLT template has lapsed.
        pub const DISPATCH: &str = "marketing.outreach.dispatch";
    }

    pub mod messages {
        /// View who an outreach run actually reached.
        ///
        /// Names the individuals in a cohort, which cohort membership itself
        /// never does — `cohorts.view` promises marketing a cohort's name and
        /// size and never who is in it, so a recipient ledger cannot reuse it.
        /// A clinical recall run's recipient list is a patient list.
        pub const VIEW: &str = "marketing.messages.view";
        /// Accept delivery receipts from the messaging provider.
        ///
        /// Held by no built-in role. A machine identity with an API key and an
        /// explicit permission list, for the same reason telephony ingest is:
        /// the caller is a provider's webhook, not a person.
        pub const INGEST_RECEIPT: &str = "marketing.messages.ingest_receipt";
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
        /// Check a visitor pass at the gate.
        ///
        /// Scan a pass's QR to see whether it is valid now, who it was issued
        /// to and which ward it opens. Read-only: it cannot issue or revoke.
        pub const VERIFY: &str = "front_office.passes.verify";
    }

    pub mod visitor_logs {
        /// Record a visitor entering or leaving.
        ///
        /// The gate guard's right: check a valid pass in and out. Issuing and
        /// revoking passes stay with `front_office.passes.manage`, which until
        /// this was the only way to log a visitor's entry at all.
        pub const RECORD: &str = "front_office.visitor_logs.record";
    }

    pub mod queue {
        pub const LIST: &str = "front_office.queue.list";
        pub const MANAGE: &str = "front_office.queue.manage";

        pub mod config {
            /// See how the hospital's queues are set up.
            ///
            /// Read-only: each queue's numbering, daily limit, status and dates,
            /// and the places a queue can serve. The desk sees why a queue is
            /// paused or full without being able to change it.
            pub const VIEW: &str = "front_office.queue.config.view";
            /// Create, change, pause and close queues.
            ///
            /// Numbering, daily limits, temporary camp queues and their dates.
            /// Changes what every desk and board in that place does, so it is
            /// held by hospital administrators unless granted.
            pub const MANAGE: &str = "front_office.queue.config.manage";
        }
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
        /// Open every patient's medical record.
        /// For medical records staff, who file, issue and complete every
        /// chart — not only those of patients in their care. Each record
        /// opened this way is written to the patient's access log.
        pub const VIEW_ALL: &str = "mrd.records.view_all";
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
        /// Work on and complete work orders assigned to you.
        ///
        /// The technician's right: move your own work order to in progress,
        /// on hold or completed and record findings, actions and costs.
        /// Assigning, reassigning, choosing a vendor and cancelling stay with
        /// `facilities.work_orders.manage`.
        pub const PERFORM: &str = "facilities.work_orders.perform";
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

    pub mod breach {
        /// Assess breaches and record regulatory notices.
        ///
        /// Marks an incident as CERT-In reportable or as a DPDP personal-data
        /// breach, sets when it was noticed (which starts the 6-hour CERT-In
        /// and 72-hour Board clocks), and records the CERT-In report, the
        /// Board intimation and detailed report, and the notice to affected
        /// Data Principals. The incident response plan gives these to the
        /// DPO / incident commander, so no built-in role holds it.
        pub const MANAGE: &str = "security.breach.manage";
    }

    pub mod patient_safety {
        pub const LIST: &str = "security.patient_safety.list";
        pub const MANAGE: &str = "security.patient_safety.manage";
        /// Verify a mother–baby ID band match.
        ///
        /// Scanning both bands before a baby is handed to its mother, taken
        /// out of the nursery or discharged. A mismatch is refused, raised as
        /// a tag alert and audited. Held by nurses and security, who do the
        /// handover, without the right to create or retire tags.
        pub const VERIFY_MATCH: &str = "security.patient_safety.verify_match";
        /// Report an infant or wander tag event.
        ///
        /// A tag leaving its zone, a cut or tampered band. An infant tag
        /// leaving its zone or tampered with raises Code Pink at once. Used
        /// by the tag reader's machine identity and by staff who find a cut
        /// band.
        pub const REPORT_EVENT: &str = "security.patient_safety.report_event";
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

    /// Which built-in pipelines run for this hospital.
    ///
    /// Deliberately not `integration.update`, which covers editing an
    /// integration's own connection settings. Turning a built-in pipeline off
    /// stops a cross-module automation for the whole tenant — the critical-lab
    /// SMS to the ordering doctor, the blood-bank quarantine on a transfusion
    /// reaction — and it fails silently, because a pipeline that does not run
    /// looks exactly like one with nothing to do. Widening `integration.update`
    /// would have handed that to everyone who can edit a connector's API key.
    pub mod pipelines {
        /// Turn a built-in pipeline on or off for this hospital.
        pub const TOGGLE: &str = "integration.pipelines.toggle";
    }
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
            /// Sign a spectacle prescription.
            ///
            /// Completes the eye exam under the signer's name and registration
            /// number and locks its refraction; only a signed exam prints as a
            /// spectacle prescription without the DRAFT mark. Recording the
            /// workup does not need it.
            pub const SIGN: &str = "specialty.ophthalmology.exams.sign";
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
            /// Correct or remove a tooth finding.
            ///
            /// A removed finding is kept (soft delete) with who removed it.
            pub const UPDATE: &str = "specialty.dental.chart.update";
        }
        pub mod treatment {
            /// See a dental treatment plan.
            ///
            /// The procedures planned, done and cancelled, tooth by tooth,
            /// with their prices.
            pub const LIST: &str = "specialty.dental.treatment.list";
            /// Plan or cancel dental procedures.
            ///
            /// Adds procedures to a patient's dental plan with their price,
            /// or cancels one that has not been done.
            pub const MANAGE: &str = "specialty.dental.treatment.manage";
            /// Mark a dental procedure done.
            ///
            /// Records who did it and when, and charges it to the visit's bill.
            pub const COMPLETE: &str = "specialty.dental.treatment.complete";
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
            /// Set up dialysis machines and dialyzer reuse.
            ///
            /// The unit's machines, the serology each is dedicated to, which
            /// are under maintenance, and how many times a dialyzer may be
            /// reused here. Booking shifts and reprocessing dialyzers need only
            /// the manage permission.
            pub const CONFIGURE: &str = "specialty.other.dialysis.configure";
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

    /// NHCX — the National Health Claims Exchange.
    pub mod nhcx {
        /// Send claims to NHCX.
        ///
        /// Submit a claim or pre-authorisation, or check coverage
        /// eligibility, with a payer through NHCX.
        pub const SUBMIT: &str = "insurance.nhcx.submit";
        /// See NHCX exchanges.
        ///
        /// What was sent to NHCX for a claim, whether this hospital is set
        /// up for NHCX, and every response the payers sent back.
        pub const VIEW: &str = "insurance.nhcx.view";
        /// Set up the NHCX connection.
        ///
        /// The NHCX participant code, gateway keys and certificates, and
        /// whether the hospital talks to the sandbox or production.
        pub const CONFIGURE: &str = "insurance.nhcx.configure";
        /// Answer payer queries on NHCX.
        ///
        /// Reply to a payer's request for more information on a
        /// pre-authorisation or claim, with text and supporting documents,
        /// sent back through NHCX.
        pub const RESPOND: &str = "insurance.nhcx.respond";
        /// Cancel or reprocess NHCX claims.
        ///
        /// Ask a payer through NHCX to cancel a claim, or to reprocess one
        /// after its deductions or rejection have been answered.
        pub const CANCEL: &str = "insurance.nhcx.cancel";
        /// See and post NHCX payments.
        ///
        /// The payment notices payers send through NHCX — amount, UTR and
        /// TDS against each claim — and posting an unmatched one to its
        /// claim.
        pub const PAYMENTS: &str = "insurance.nhcx.payments";
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

    /// Clinical assessment scores recorded against a patient.
    ///
    /// Separate from `icu.scores.*`, which covers the same table from the
    /// intensive-care side. A recovery nurse scoring an Aldrete or a midwife
    /// scoring a MEOWS is not ICU staff, and granting them an ICU permission
    /// to record a ward assessment would hand them the ICU module as well.
    pub mod scores {
        /// See a patient's recorded assessment scores.
        pub const LIST: &str = "care_view.scores.list";
        /// Record an assessment score against a patient.
        ///
        /// The score is the clinical record, not a calculation: an Aldrete is
        /// the evidence a patient was fit to leave recovery, and NEWS2 only
        /// means anything as a trend.
        pub const RECORD: &str = "care_view.scores.record";
    }
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
pub mod terminology {
    /// Search clinical terminologies (ICD-11, SNOMED).
    ///
    /// Read-only lookup of codes and their display terms, for recording a
    /// provisional diagnosis at registration or a camp desk — not access to
    /// any patient's record.
    pub const SEARCH: &str = "terminology.search";

    /// The locally loaded SNOMED CT release store.
    ///
    /// SNOMED content is shared reference data under the deployment's
    /// affiliate licence, so loading a release is separate from reading one,
    /// and reading one is separate from counting a hospital's records by it.
    pub mod snomed {
        /// Load SNOMED CT releases.
        ///
        /// Upload or import an RF2 release package and watch its progress.
        /// The release replaces terminology every user of the deployment
        /// sees, so no built-in role holds it.
        pub const MANAGE: &str = "terminology.snomed.manage";
        /// Search and browse SNOMED CT concepts.
        ///
        /// Find a concept by any of its terms, see its parents and children,
        /// and run bounded hierarchy queries. Results are capped so the
        /// licensed content cannot be extracted in bulk.
        pub const VIEW: &str = "terminology.snomed.view";
        /// Count records by SNOMED CT hierarchy.
        ///
        /// See how many of the hospital's coded diagnoses fall under a
        /// concept or any of its descendants, and the roll-up by top-level
        /// category.
        pub const ANALYTICS: &str = "terminology.snomed.analytics";
    }
}

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
    /// Requests for temporary extra permissions, raised from the
    /// access-denied screen or the Access requests page.
    ///
    /// These used to be guarded by `security.access.*` — the physical-security
    /// codes for door zones and access cards — so every security guard could
    /// see and approve anyone's permission requests.
    pub mod access_requests {
        /// See every access request in the hospital.
        ///
        /// Without it you see only your own requests.
        pub const LIST: &str = "admin.access_requests.list";
        /// Approve, reject or revoke access requests.
        ///
        /// Grants temporary permissions to another person; a request for an
        /// elevated permission still needs an administrator. Approvers are
        /// notified of each new request.
        pub const REVIEW: &str = "admin.access_requests.review";
    }

    /// Setting a hospital up from a spreadsheet.
    pub mod workbook {
        /// Set up the hospital from a spreadsheet.
        ///
        /// Download the onboarding workbook — blank or filled with what the
        /// hospital already has — and upload it back to add or update
        /// departments, wards, beds and staff in one checked, all-or-nothing
        /// change. New staff are emailed how to set their password.
        pub const IMPORT: &str = "admin.workbook.import";
    }

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
        /// Read the API description.
        ///
        /// The OpenAPI document: every endpoint, method and the permission
        /// it needs. Grant it to an integration's key so its developers can
        /// generate a client.
        pub const DOCS: &str = "admin.api_keys.docs";
    }

    pub mod webhooks {
        /// See webhook subscriptions and their deliveries.
        ///
        /// Where the hospital's events are sent, which events, and whether
        /// each delivery landed.
        pub const LIST: &str = "admin.webhooks.list";
        /// Create, change and switch off webhooks.
        ///
        /// Decides which outside systems are told about events and where they
        /// are sent, and issues the signing secret.
        pub const MANAGE: &str = "admin.webhooks.manage";
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

    pub mod notifications {
        pub mod simulator {
            /// Open the message simulator (dev and test only).
            ///
            /// Shows, as a phone would, every SMS, WhatsApp message and email
            /// the system would have sent a patient or staff member. It exists
            /// only on deployments running with the simulator on — never in
            /// production — and shows real names and numbers from that database.
            pub const VIEW: &str = "admin.notifications.simulator.view";
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
    pub mod refill_requests {
        /// Decide patient refill requests.
        ///
        /// Approve or decline a refill a patient asked for on a prescription
        /// this doctor wrote; approving sends it to the pharmacy.
        pub const DECIDE: &str = "doctor.refill_requests.decide";
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

    pub mod print_jobs {
        /// Deliver print jobs to printers.
        ///
        /// Lets a site bridge take queued print jobs — the document already
        /// rendered for its printer as PDF, ZPL or ESC/POS, which carries
        /// patient details — send them to the printer and report the result.
        /// Grant it to the bridge's API key, not to people.
        pub const DELIVER: &str = "documents.print_jobs.deliver";
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
    /// The register of who processes patient data for the hospital.
    pub mod processors {
        /// See the data processors register.
        ///
        /// Every outside service that handles patient data — hosting, SMS,
        /// payments, AI — with what it receives, where it keeps it, and the
        /// agreement that binds it (DPDP Act s.8(2), s.16).
        pub const LIST: &str = "audit.processors.list";
        /// Add and update data processors.
        ///
        /// Record a processor and its agreement, and retire one the hospital
        /// stops using.
        pub const MANAGE: &str = "audit.processors.manage";
    }
    pub const VIEW: &str = "audit.log.view";
    pub const EXPORT: &str = "audit.log.export";
    pub const ACCESS_VIEW: &str = "audit.access.view";
    pub const START: &str = "audit.break_glass.start";
    pub const REVIEW: &str = "audit.break_glass.review";
}

pub mod analytics {
    pub const VIEW: &str = "analytics.view";
    pub const EXPORT: &str = "analytics.export";

    pub mod management {
        /// View management KPIs and per-doctor performance.
        ///
        /// OPD flow against the usual day, documentation completeness by
        /// doctor, department efficiency. Names clinicians next to their
        /// numbers, so it is granted to management and quality, not with
        /// general analytics access.
        pub const VIEW: &str = "analytics.management.view";
    }
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

    pub mod orders {
        /// Send lab orders to an analyzer.
        ///
        /// Lets a lab bridge read collected samples — barcode, test, and the
        /// patient's name, birth date and sex — to load them onto its
        /// analyzer's worklist, and record that it did. Grant it to the
        /// bridge's API key, not to people.
        pub const SEND: &str = "devices.orders.send";
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

pub mod qa {
    pub mod test_cases {
        /// Record test results.
        ///
        /// Shows the test-case panel and saves Pass, Fail or Blocked for the
        /// signed-in role's cases in the open test cycle. Given to the
        /// `test_<role>` accounts per user by scripts/create_test_accounts.py,
        /// never to a built-in role: real staff never see the panel.
        pub const RECORD: &str = "qa.test_cases.record";
    }

    pub mod test_cycles {
        /// Run test cycles.
        ///
        /// Open and close a test cycle, and see every role's progress and
        /// every failure across the hospital's testers.
        pub const MANAGE: &str = "qa.test_cycles.manage";
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

pub mod ai {
    pub mod assistant {
        /// Use the AI assistant.
        ///
        /// Chat, and the caller's own conversation history. The three
        /// handlers behind it checked nothing at all: any signed-in account
        /// could send a prompt about a patient to the model. Held by the
        /// clinical roles the assistant is built for.
        pub const USE: &str = "ai.assistant.use";
    }
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
    pub mod roster {
        /// See who is rostered on a ward.
        ///
        /// The ward's on-duty list, per shift and date. Distinct from
        /// `nurse.shift.*`, which covers a nurse's own duty session.
        pub const VIEW: &str = "nurse.roster.view";
        /// Roster nurses onto ward shifts.
        ///
        /// Deciding who staffs a ward. Held by no built-in role: with no
        /// charge-nurse role to give it to, granting it to every nurse
        /// would let any of them restaff the ward. Admins hold it by
        /// bypass, and it can be granted to a custom role.
        pub const MANAGE: &str = "nurse.roster.manage";
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
        /// Say you are responding to a code blue.
        ///
        /// The page is one-way until somebody answers it. Held by everyone
        /// the activation reaches, so the team lead can see who is coming.
        /// The first response is also the arrival time NABH measures.
        pub const RESPOND: &str = "nurse.code_blue.respond";
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
    /// Connecting this hospital to ABDM.
    pub mod settings {
        /// Set up the ABDM connection.
        /// Enter the ABDM client ID and secret and switch between sandbox and production.
        pub const MANAGE: &str = "abdm.settings.manage";
    }
    pub mod relay {
        /// Pull and acknowledge ABDM gateway callbacks.
        ///
        /// For the hospital's on-premises server, which collects the ABDM
        /// gateway's callbacks for its own facility and marks each one
        /// received. Callbacks carry patient health data, so only this
        /// hospital's own, never another's.
        pub const PULL: &str = "abdm.relay.pull";
    }
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
    /// Health records this hospital shares through ABDM as a Health
    /// Information Provider: care contexts, their links to ABHAs, the
    /// consents patients granted and the transfers made under them.
    pub mod records {
        /// View records shared through ABDM.
        ///
        /// Which of a patient's records are linked to their ABHA, why one is
        /// not, the consents received and every transfer made, and the
        /// hospital's monthly DHIS counts.
        pub const VIEW: &str = "abdm.records.view";
        /// Link or retry linking records to ABHA.
        ///
        /// Send a patient's finalised records to ABDM again after a failure,
        /// or link one that was captured before the ABHA was verified.
        pub const MANAGE: &str = "abdm.records.manage";
    }
    pub mod hpr {
        /// Record and verify doctors' HPR IDs.
        ///
        /// The Healthcare Professionals Registry ID each doctor signs FHIR
        /// records under, checked against the national registry, and the
        /// coverage report of active doctors still missing one.
        pub const MANAGE: &str = "abdm.hpr.manage";
    }
}

//! Screen registry — every navigable page, the app it belongs to and who may open it.
//!
//! Adding or changing a screen: edit this file, then run `python3 scripts/generate_app_screens.py`.
//! The web menu is built from its copy, `packages/types/src/app-screens.generated.ts` (CI runs the
//! generator with `--check`, and `scripts/check_nav_drift.py` refuses hand-written menu entries).
//! A screen that names its app `brick` sits in that app's side panel, and its route (and every
//! route under it) opens only while the hospital has that app on. `brick: None` is a core screen:
//! dashboard, compliance, administration; they share one side panel.

#[derive(Debug, Clone)]
pub struct ScreenDef {
    /// Unique stable code (e.g. "patients.list", "admin.users").
    pub code: &'static str,
    /// Human-readable label (i18n key for the frontend).
    pub label: &'static str,
    /// Frontend route path, e.g. "/patients".
    pub route: &'static str,
    /// Module the screen belongs to, e.g. "patients", "lab", "admin".
    pub module: &'static str,
    /// Permission code the user must hold to navigate to this screen. `None` with an empty
    /// `any_of` = shown to everyone signed in (the approvals inbox: there is no permission for
    /// having decisions waiting).
    pub required_permission: Option<&'static str>,
    /// Icon identifier used by the sidebar nav. Maps to a Tabler-icon
    /// name on the frontend.
    pub icon: &'static str,
    /// The `nav` translation key of its side-panel entry.
    pub nav_key: &'static str,
    /// The app brick (`module_config.code`) whose side panel lists this screen; `None` for a core
    /// screen, which no app owns.
    pub brick: Option<&'static str>,
    /// Permissions of which one must also be held, on top of `required_permission`. A list that
    /// contains `required_permission` adds nothing, so none is written that way.
    pub any_of: &'static [&'static str],
    /// Where the menu lists it. Tidiness only: the route and its permission are the same in
    /// every group, so a bookmark still opens for whoever may open it.
    pub group: ScreenGroup,
}

/// Where a screen sits in the menu, so a small hospital's Administration is not every screen.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScreenGroup {
    /// Listed as usual. An app's screen is always this: its brick already hides it.
    Essential,
    /// Listed in Administration under "Advanced", closed until opened: integrations, devices,
    /// identity plumbing.
    Advanced,
    /// Listed only in a development build: the kernel, the message simulator, test cycles.
    DevOnly,
}

/// Anyone working the front desk: visitors, passes, the queue, enquiries, or registering a walk-in.
#[rustfmt::skip]
const FRONT_OFFICE_ANY_OF: &[&str] = &[
    "front_office.visitors.list", "front_office.visitors.create", "front_office.visitors.manage",
    "front_office.passes.list", "front_office.passes.manage", "front_office.passes.verify",
    "front_office.queue.list", "front_office.queue.manage", "front_office.enquiry.list",
    "front_office.enquiry.create", "front_office.enquiry.manage", "patients.create",
    "opd.visit.create", "emergency.visits.create", "billing.invoices.create",
];

/// Anyone running doctor payouts: agreements, rate cards, the ledger, statements or payments.
#[rustfmt::skip]
const DOCTOR_PAYOUTS_ANY_OF: &[&str] = &[
    "doctor_payouts.agreements.manage", "doctor_payouts.rate_cards.manage", "doctor_payouts.ledger.view",
    "doctor_payouts.statements.prepare", "doctor_payouts.statements.approve", "doctor_payouts.payouts.execute",
    "doctor_payouts.day_settlement.execute", "doctor_payouts.reports.view", "doctor_payouts.policy.manage",
];

/// Anyone working the bedside tablet portal.
#[rustfmt::skip]
const BEDSIDE_PORTAL_ANY_OF: &[&str] = &[
    "bedside.view", "bedside.request", "bedside.videos.list",
    "bedside.videos.manage", "bedside.feedback.list", "bedside.feedback.create",
    "bedside.sessions.list", "bedside.sessions.manage",
];

/// Anyone handling the pharmacy's money: the cash drawer, petty cash, suppliers, free issues.
#[rustfmt::skip]
const PHARMACY_FINANCE_ANY_OF: &[&str] = &[
    "pharmacy_finance.cash_drawer.view", "pharmacy_finance.cash_drawer.open", "pharmacy_finance.cash_drawer.close",
    "pharmacy_finance.petty_cash.view", "pharmacy_finance.petty_cash.record", "pharmacy_finance.supplier_payments.view",
    "pharmacy_finance.supplier_payments.manage", "pharmacy_finance.free_dispensing.view", "pharmacy_finance.finance_reports.view",
];

/// Anyone booking, running or reporting on the operation theatres.
#[rustfmt::skip]
const OT_ANY_OF: &[&str] = &[
    "ot.bookings.list", "ot.bookings.create", "ot.rooms.list",
    "ot.rooms.manage", "ot.preferences.list", "ot.preferences.manage",
    "ot.reports.view",
];

/// Anyone viewing or recording a nursing activity.
#[rustfmt::skip]
const NURSE_ACTIVITIES_ANY_OF: &[&str] = &[
    "nurse.dashboard.view", "nurse.mar.view", "nurse.vitals.view",
    "nurse.vitals.record", "nurse.intake_output.view", "nurse.intake_output.record",
    "nurse.pain.view", "nurse.pain.record", "nurse.fall_risk.view",
    "nurse.fall_risk.record", "nurse.wound.view", "nurse.wound.record",
    "nurse.handoff.view", "nurse.handoff.record", "nurse.code_blue.view",
    "nurse.code_blue.record", "nurse.equipment.view", "nurse.equipment.record",
];

/// Anyone in stores, procurement or assets.
#[rustfmt::skip]
const MATERIALS_ANY_OF: &[&str] = &[
    "indent.list", "assets.list", "procurement.vendors.list",
    "procurement.po.list", "procurement.grn.list", "procurement.rc.list",
    "procurement.stores.list", "procurement.stores.manage", "procurement.payments.list",
    "procurement.performance.view", "indent.stock.manage",
];

/// Anyone who may read one of the reports; `pages/reports/report-readers.ts` lists the same codes.
#[rustfmt::skip]
const REPORTS_ANY_OF: &[&str] = &[
    "analytics.view", "billing.reports.view", "quality.indicators.list",
    "scheduling.analytics.view", "ipd.reports.view", "lab.reports.view",
    "radiology.orders.list", "pharmacy.analytics.view", "marketing.campaigns.view",
];

/// Anyone in palliative care: DNR, pain, mortuary or nuclear medicine.
#[rustfmt::skip]
const PALLIATIVE_ANY_OF: &[&str] = &[
    "specialty.palliative.dnr.list", "specialty.palliative.dnr.manage", "specialty.palliative.pain.list",
    "specialty.palliative.pain.create", "specialty.palliative.mortuary.list", "specialty.palliative.mortuary.manage",
    "specialty.palliative.nucmed.list", "specialty.palliative.nucmed.create", "specialty.palliative.nucmed.manage",
];

/// Anyone holding a section of Medical Records; `pages/mrd-access.ts` lists the same codes.
#[rustfmt::skip]
const MRD_ANY_OF: &[&str] = &[
    "mrd.records.list", "mrd.records.manage", "mrd.case_sheets.view",
    "mrd.births.list", "mrd.deaths.list", "mrd.crs.list",
    "mrd.file_request.view",
];

/// SNOMED's analytics, needed on top of the browse permission.
#[rustfmt::skip]
const SNOMED_ANY_OF: &[&str] = &[
    "terminology.snomed.analytics",
];

/// Every navigable screen, one row each: each app brick's screens in `bricks::BRICKS` order, its
/// door first, then the core screens no app owns (`brick: None`).
#[rustfmt::skip]
pub const SCREENS: &[ScreenDef] = &[
    ScreenDef { code: "patients", label: "Patients", route: "/patients", module: "patients", required_permission: Some("patients.list"), icon: "IconUsers", nav_key: "patients", brick: Some("registration"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "token-board", label: "Token Board", route: "/token-board", module: "registration", required_permission: Some("front_office.queue.list"), icon: "IconLayoutGrid", nav_key: "tokenBoard", brick: Some("registration"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "token-console", label: "Token Console", route: "/token-console", module: "registration", required_permission: Some("front_office.queue.manage"), icon: "IconHeadset", nav_key: "tokenConsole", brick: Some("registration"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "immunization-clinic", label: "Immunisation clinic", route: "/immunization-clinic", module: "registration", required_permission: Some("patients.immunizations.due_list"), icon: "IconVaccine", nav_key: "immunizationClinic", brick: Some("registration"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "front-office", label: "Front Office", route: "/front-office", module: "front_office", required_permission: None, icon: "IconDoorEnter", nav_key: "frontOffice", brick: Some("registration"), any_of: FRONT_OFFICE_ANY_OF, group: ScreenGroup::Essential },
    ScreenDef { code: "consent", label: "Consent", route: "/consent", module: "consent", required_permission: Some("consent.templates.list"), icon: "IconSignature", nav_key: "consent", brick: Some("registration"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "admin.queues", label: "Queues", route: "/admin/queues", module: "registration", required_permission: Some("front_office.queue.config.view"), icon: "IconListDetails", nav_key: "queues", brick: Some("registration"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "admin.history-import", label: "Import history", route: "/admin/history-import", module: "admin", required_permission: Some("admin.history_import.view"), icon: "IconHistory", nav_key: "historyImport", brick: Some("registration"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "billing", label: "Billing", route: "/billing", module: "billing", required_permission: Some("billing.invoices.list"), icon: "IconReceipt", nav_key: "billing", brick: Some("billing"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "my-earnings", label: "My Earnings", route: "/my-earnings", module: "billing", required_permission: Some("doctor_payouts.self.view"), icon: "IconChartBar", nav_key: "myEarnings", brick: Some("billing"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "billing.doctor-payouts", label: "Doctor Payouts", route: "/billing/doctor-payouts", module: "billing", required_permission: None, icon: "IconReceipt", nav_key: "doctorPayouts", brick: Some("billing"), any_of: DOCTOR_PAYOUTS_ANY_OF, group: ScreenGroup::Essential },
    ScreenDef { code: "insurance", label: "Insurance & TPA", route: "/insurance", module: "billing", required_permission: Some("insurance.verification.list"), icon: "IconShieldHalfFilled", nav_key: "insurance", brick: Some("billing"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "opd", label: "OPD", route: "/opd", module: "opd", required_permission: Some("opd.queue.list"), icon: "IconStethoscope", nav_key: "opdQueue", brick: Some("opd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "opd.reports", label: "OPD reports", route: "/opd/reports", module: "opd", required_permission: Some("opd.reports.view"), icon: "IconChartBar", nav_key: "opdReports", brick: Some("opd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "opd.appointments", label: "Appointments", route: "/opd/appointments", module: "opd", required_permission: Some("opd.appointment.list"), icon: "IconCalendar", nav_key: "appointments", brick: Some("opd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "opd.telemedicine", label: "Telemedicine", route: "/telemedicine", module: "opd", required_permission: Some("opd.queue.view"), icon: "IconVideo", nav_key: "telemedicine", brick: Some("opd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "opd.signoffs", label: "Doctor sign-offs", route: "/doctor/signoffs", module: "opd", required_permission: Some("doctor.signoffs.view_own"), icon: "IconSignature", nav_key: "doctorSignoffs", brick: Some("opd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "opd.chronic_care", label: "Chronic care", route: "/chronic-care", module: "opd", required_permission: Some("chronic.enrollments.list"), icon: "IconReportMedical", nav_key: "chronicCare", brick: Some("opd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "scheduling", label: "Smart Scheduling", route: "/scheduling", module: "opd", required_permission: Some("scheduling.predictions.list"), icon: "IconCalendarStats", nav_key: "scheduling", brick: Some("opd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "admin.doctor-schedules", label: "Doctor Schedules", route: "/admin/doctor-schedules", module: "opd", required_permission: Some("opd.schedule.list"), icon: "IconCalendar", nav_key: "doctorSchedules", brick: Some("opd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "ipd", label: "IPD", route: "/ipd", module: "ipd", required_permission: Some("ipd.admissions.list"), icon: "IconBed", nav_key: "ipd", brick: Some("ipd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "case-sheet-review", label: "Case sheet review", route: "/case-sheet-review", module: "ipd", required_permission: Some("mrd.case_sheets.view"), icon: "IconFileText", nav_key: "caseSheetReview", brick: Some("ipd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "icu", label: "ICU", route: "/icu", module: "icu", required_permission: Some("icu.flowsheets.list"), icon: "IconHeartRateMonitor", nav_key: "icu", brick: Some("ipd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "bedside-portal", label: "Bedside Portal", route: "/bedside-portal", module: "ipd", required_permission: None, icon: "IconDeviceTablet", nav_key: "bedsidePortal", brick: Some("ipd"), any_of: BEDSIDE_PORTAL_ANY_OF, group: ScreenGroup::Essential },
    ScreenDef { code: "inter-hospital-transfers", label: "Inter-hospital transfers", route: "/inter-hospital-transfers", module: "ipd", required_permission: Some("ipd.transfers.create"), icon: "IconAmbulance", nav_key: "interHospitalTransfers", brick: Some("ipd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "inter-hospital-stock", label: "Inter-hospital stock", route: "/inter-hospital-stock", module: "ipd", required_permission: Some("ipd.transfers.create"), icon: "IconPackage", nav_key: "interHospitalStock", brick: Some("ipd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "utilization-review", label: "Utilization Review", route: "/utilization-review", module: "ipd", required_permission: Some("ur.reviews.list"), icon: "IconClipboardCheck", nav_key: "utilizationReview", brick: Some("ipd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "case-management", label: "Case Management", route: "/case-management", module: "ipd", required_permission: Some("case_mgmt.assignments.list"), icon: "IconUserSearch", nav_key: "caseManagement", brick: Some("ipd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "long-term-care", label: "Long-term care", route: "/long-term-care", module: "ipd", required_permission: Some("ipd.nursing_assessment.list"), icon: "IconReportMedical", nav_key: "longTermCare", brick: Some("ipd"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "lab", label: "Lab", route: "/lab", module: "lab", required_permission: Some("lab.orders.list"), icon: "IconFlask", nav_key: "lab", brick: Some("lab"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "pharmacy", label: "Pharmacy", route: "/pharmacy", module: "pharmacy", required_permission: Some("pharmacy.prescriptions.list"), icon: "IconPill", nav_key: "pharmacy", brick: Some("pharmacy"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "ward-stock", label: "Ward Stock", route: "/ward-stock", module: "pharmacy", required_permission: Some("pharmacy.stores.manage"), icon: "IconBed", nav_key: "wardStock", brick: Some("pharmacy"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "pharmacy.finance", label: "Pharmacy Finance", route: "/pharmacy/finance", module: "pharmacy", required_permission: None, icon: "IconReceipt", nav_key: "pharmacyFinance", brick: Some("pharmacy"), any_of: PHARMACY_FINANCE_ANY_OF, group: ScreenGroup::Essential },
    ScreenDef { code: "pharmacy.fulfilment", label: "Fulfilment Queue", route: "/pharmacy/fulfilment", module: "pharmacy", required_permission: Some("pharmacy.fulfilment.pick"), icon: "IconPackage", nav_key: "pharmacyFulfilment", brick: Some("pharmacy"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "pharmacy.deliveries", label: "Home Deliveries", route: "/pharmacy/deliveries", module: "pharmacy", required_permission: Some("pharmacy.deliveries.view"), icon: "IconTruckDelivery", nav_key: "pharmacyDeliveries", brick: Some("pharmacy"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "pharmacy.online-orders", label: "Online orders", route: "/pharmacy/online-orders", module: "pharmacy", required_permission: Some("pharmacy.storefront.verify"), icon: "IconShoppingCart", nav_key: "pharmacyOnlineOrders", brick: Some("pharmacy"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "pharmacy.h1-register", label: "H1 register", route: "/pharmacy/h1-register", module: "pharmacy", required_permission: Some("pharmacy.h1_register.view"), icon: "IconNotebook", nav_key: "pharmacyH1Register", brick: Some("pharmacy"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "pharmacy.quarantine", label: "Returns quarantine", route: "/pharmacy/quarantine", module: "pharmacy", required_permission: Some("pharmacy.quarantine.manage"), icon: "IconFlame", nav_key: "pharmacyQuarantine", brick: Some("pharmacy"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "pharmacy.nppa-ceilings", label: "NPPA ceilings", route: "/pharmacy/nppa-ceilings", module: "pharmacy", required_permission: Some("pharmacy.nppa.manage"), icon: "IconReceiptTax", nav_key: "pharmacyNppaCeilings", brick: Some("pharmacy"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "pharmacy.dispatch", label: "Collection Counter", route: "/pharmacy/dispatch", module: "pharmacy", required_permission: Some("pharmacy.fulfilment.dispatch"), icon: "IconHandGrab", nav_key: "pharmacyDispatch", brick: Some("pharmacy"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "radiology", label: "Radiology", route: "/radiology", module: "radiology", required_permission: Some("radiology.orders.list"), icon: "IconRadioactive", nav_key: "radiology", brick: Some("radiology"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "blood-bank", label: "Blood Bank", route: "/blood-bank", module: "blood_bank", required_permission: Some("blood_bank.donors.list"), icon: "IconDroplet", nav_key: "bloodBank", brick: Some("blood_bank"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "ot", label: "Operation Theatre", route: "/ot", module: "ot", required_permission: None, icon: "IconScissors", nav_key: "ot", brick: Some("ot"), any_of: OT_ANY_OF, group: ScreenGroup::Essential },
    ScreenDef { code: "cssd", label: "CSSD", route: "/cssd", module: "cssd", required_permission: Some("cssd.instruments.list"), icon: "IconSpray", nav_key: "cssd", brick: Some("ot"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "emergency", label: "Emergency", route: "/emergency", module: "emergency", required_permission: Some("emergency.visits.list"), icon: "IconUrgent", nav_key: "emergency", brick: Some("emergency"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "ambulance", label: "Ambulance", route: "/ambulance", module: "emergency", required_permission: Some("ambulance.fleet.list"), icon: "IconAmbulance", nav_key: "ambulance", brick: Some("emergency"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "nurse", label: "Nurse Activities", route: "/nurse", module: "nursing", required_permission: None, icon: "IconClipboardCheck", nav_key: "nurseActivities", brick: Some("nursing"), any_of: NURSE_ACTIVITIES_ANY_OF, group: ScreenGroup::Essential },
    ScreenDef { code: "diet-kitchen", label: "Diet & Kitchen", route: "/diet-kitchen", module: "diet", required_permission: Some("diet.orders.list"), icon: "IconToolsKitchen2", nav_key: "dietKitchen", brick: Some("diet"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "hr", label: "HR", route: "/hr", module: "hr", required_permission: Some("hr.employees.list"), icon: "IconIdBadge2", nav_key: "hr", brick: Some("hr"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "hr.payroll", label: "Payroll", route: "/hr/payroll", module: "hr", required_permission: Some("hr.payroll.structures.list"), icon: "IconReceipt", nav_key: "payroll", brick: Some("hr"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "lms", label: "LMS", route: "/lms", module: "lms", required_permission: Some("lms.my_learning.view"), icon: "IconSchool", nav_key: "lms", brick: Some("hr"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "materials", label: "Materials", route: "/materials", module: "inventory", required_permission: None, icon: "IconBuildingWarehouse", nav_key: "materials", brick: Some("inventory"), any_of: MATERIALS_ANY_OF, group: ScreenGroup::Essential },
    ScreenDef { code: "procurement", label: "Procurement", route: "/procurement", module: "procurement", required_permission: Some("procurement.vendors.list"), icon: "IconTruck", nav_key: "procurement", brick: Some("inventory"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "indent", label: "Indent / Stores", route: "/indent", module: "indent", required_permission: Some("indent.list"), icon: "IconBoxSeam", nav_key: "indent", brick: Some("inventory"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "bme", label: "Biomedical Engineering", route: "/bme", module: "inventory", required_permission: Some("bme.equipment.list"), icon: "IconDeviceDesktopAnalytics", nav_key: "bme", brick: Some("inventory"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "command-center", label: "Command Center", route: "/command-center", module: "reports", required_permission: Some("command_center.view"), icon: "IconLayoutDashboard", nav_key: "commandCenter", brick: Some("reports"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "analytics", label: "Analytics & Dashboards", route: "/analytics", module: "reports", required_permission: Some("analytics.view"), icon: "IconChartBar", nav_key: "analytics", brick: Some("reports"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "analytics.paperless", label: "Paperless meter", route: "/analytics/paperless", module: "reports", required_permission: Some("analytics.paperless.view"), icon: "IconFileCheck", nav_key: "paperlessMeter", brick: Some("reports"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "reports", label: "Reports Center", route: "/reports", module: "reports", required_permission: None, icon: "IconReport", nav_key: "reports", brick: Some("reports"), any_of: REPORTS_ANY_OF, group: ScreenGroup::Essential },
    ScreenDef { code: "retrospective", label: "Retrospective Entry", route: "/retrospective", module: "reports", required_permission: Some("retrospective.list"), icon: "IconHistory", nav_key: "retrospective", brick: Some("reports"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "admin.nabh-indicators", label: "NABH Indicators", route: "/admin/nabh-indicators", module: "quality", required_permission: Some("quality.indicators.list"), icon: "IconChartBar", nav_key: "nabhIndicators", brick: Some("reports"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "specialty.maternity", label: "Maternity", route: "/specialty/maternity", module: "maternity", required_permission: Some("specialty.maternity.registrations.list"), icon: "IconBabyCarriage", nav_key: "maternity", brick: Some("maternity"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "specialty.ophthalmology", label: "Ophthalmology", route: "/specialty/ophthalmology", module: "ophthalmology", required_permission: Some("specialty.ophthalmology.exams.list"), icon: "IconEye", nav_key: "ophthalmology", brick: Some("ophthalmology"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "specialty.dental", label: "Dental", route: "/specialty/dental", module: "dental", required_permission: Some("specialty.dental.exams.list"), icon: "IconDental", nav_key: "dental", brick: Some("dental"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "specialty.cath-lab", label: "Cath Lab", route: "/specialty/cath-lab", module: "cath_lab", required_permission: Some("specialty.cath_lab.procedures.list"), icon: "IconHeartbeat", nav_key: "cathLab", brick: Some("cath_lab"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "specialty.endoscopy", label: "Endoscopy", route: "/specialty/endoscopy", module: "endoscopy", required_permission: Some("specialty.endoscopy.procedures.list"), icon: "IconMicroscope", nav_key: "endoscopy", brick: Some("endoscopy"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "specialty.psychiatry", label: "Psychiatry", route: "/specialty/psychiatry", module: "psychiatry", required_permission: Some("specialty.psychiatry.patients.list"), icon: "IconBrain", nav_key: "psychiatry", brick: Some("psychiatry"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "specialty.palliative", label: "Palliative Care", route: "/specialty/palliative", module: "palliative", required_permission: None, icon: "IconHeartHandshake", nav_key: "palliative", brick: Some("palliative"), any_of: PALLIATIVE_ANY_OF, group: ScreenGroup::Essential },
    ScreenDef { code: "specialty.pmr", label: "Physical Medicine", route: "/specialty/pmr", module: "pmr", required_permission: Some("specialty.pmr.plans.list"), icon: "IconStretching2", nav_key: "pmr", brick: Some("pmr"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "specialty.other", label: "Other Specialties", route: "/specialty/other", module: "specialty_other", required_permission: Some("specialty.other.records.list"), icon: "IconStethoscope", nav_key: "otherSpecialties", brick: Some("specialty_other"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "health-packages", label: "Health packages", route: "/health-packages", module: "specialty_other", required_permission: Some("specialty.health_packages.list"), icon: "IconGift", nav_key: "healthPackages", brick: Some("specialty_other"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "testimonials", label: "Testimonials", route: "/testimonials", module: "specialty_other", required_permission: Some("specialty.health_packages.list"), icon: "IconStar", nav_key: "testimonials", brick: Some("specialty_other"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "microsite-settings", label: "Micro-site settings", route: "/microsite-settings", module: "specialty_other", required_permission: Some("specialty.health_packages.list"), icon: "IconSettings", nav_key: "micrositeSettings", brick: Some("specialty_other"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "specialty.cancer-registry", label: "Cancer registry", route: "/specialty/cancer-registry", module: "specialty_other", required_permission: Some("specialty.other.oncology.registry.list"), icon: "IconRibbonHealth", nav_key: "cancerRegistry", brick: Some("specialty_other"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "clinical-trials", label: "Clinical trials", route: "/clinical-trials", module: "specialty_other", required_permission: Some("specialty.clinical_trials.list"), icon: "IconFlask", nav_key: "clinicalTrials", brick: Some("specialty_other"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "flow", label: "MedBrains Flow", route: "/flow", module: "flow", required_permission: Some("flow.view"), icon: "IconMapPin", nav_key: "flow", brick: Some("flow"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "admin.flows", label: "Flows", route: "/admin/flows", module: "flow", required_permission: Some("flows.view"), icon: "IconRoute", nav_key: "flows", brick: Some("flow"), any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "dashboard", label: "Dashboard", route: "/dashboard", module: "dashboard", required_permission: Some("dashboard.view"), icon: "IconDashboard", nav_key: "dashboard", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "approvals", label: "Approvals", route: "/approvals", module: "dashboard", required_permission: None, icon: "IconChecklist", nav_key: "approvals", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "health-pulse", label: "Health Pulse", route: "/health-pulse", module: "dashboard", required_permission: Some("dashboard.view"), icon: "IconNews", nav_key: "healthPulse", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "health-intel", label: "Health intelligence", route: "/health-intel", module: "health", required_permission: Some("health.intel.view"), icon: "IconRadar", nav_key: "healthIntel", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "order-sets", label: "Order Sets", route: "/order-sets", module: "order_sets", required_permission: Some("order_sets.templates.list"), icon: "IconListDetails", nav_key: "orderSets", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "home-healthcare", label: "Home healthcare", route: "/home-healthcare", module: "home_health", required_permission: Some("home_health.list"), icon: "IconHeartHandshake", nav_key: "homeHealthcare", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "home-visits", label: "Home visits", route: "/home-visits", module: "home_health", required_permission: Some("home_health.list"), icon: "IconMapPin", nav_key: "homeVisits", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "care-view", label: "Care View", route: "/care-view", module: "care_view", required_permission: Some("care_view.view"), icon: "IconHeartbeat", nav_key: "careView", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "communications", label: "Communications", route: "/communications", module: "communications", required_permission: Some("communications.messages.list"), icon: "IconMessage", nav_key: "communications", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "camp", label: "Camps", route: "/camp", module: "camp", required_permission: Some("camp.list"), icon: "IconFirstAidKit", nav_key: "camp", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "housekeeping", label: "Housekeeping", route: "/housekeeping", module: "housekeeping", required_permission: Some("housekeeping.cleaning.list"), icon: "IconWash", nav_key: "housekeeping", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "facilities", label: "Facilities", route: "/facilities", module: "facilities", required_permission: Some("facilities.gas.list"), icon: "IconBuildingFactory2", nav_key: "facilities", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "security", label: "Security", route: "/security", module: "security", required_permission: Some("security.access.list"), icon: "IconShieldLock", nav_key: "security", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "security.intelligence", label: "Security intelligence", route: "/security/intelligence", module: "security", required_permission: Some("security.intel.view"), icon: "IconShieldCheck", nav_key: "securityIntel", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "security.medbrains-access", label: "MedBrains access", route: "/security/medbrains-access", module: "security", required_permission: Some("security.vendor_access.view"), icon: "IconShieldLock", nav_key: "medbrainsAccess", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "mrd", label: "Medical Records", route: "/mrd", module: "mrd", required_permission: None, icon: "IconFileCertificate", nav_key: "mrd", brick: None, any_of: MRD_ANY_OF, group: ScreenGroup::Essential },
    ScreenDef { code: "clinical-kb", label: "Clinical Knowledge", route: "/clinical-kb", module: "ckb", required_permission: Some("ckb.view"), icon: "IconVirus", nav_key: "clinicalKb", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "directory", label: "Directory", route: "/directory", module: "admin", required_permission: Some("admin.settings.locations.list"), icon: "IconMapPin", nav_key: "directory", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "hospital-groups", label: "Hospital groups", route: "/hospital-groups", module: "admin", required_permission: Some("admin.system_state.view"), icon: "IconBuildingHospital", nav_key: "hospitalGroups", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "uhi-requests", label: "UHI requests", route: "/uhi-requests", module: "uhi", required_permission: Some("uhi.requests.view"), icon: "IconDeviceMobileMessage", nav_key: "uhiRequests", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "marketing", label: "Marketing", route: "/marketing", module: "marketing", required_permission: Some("marketing.contacts.list"), icon: "IconSpeakerphone", nav_key: "marketing", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "quality", label: "Quality", route: "/quality", module: "quality", required_permission: Some("quality.indicators.list"), icon: "IconReport", nav_key: "quality", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "infection-control", label: "Infection Control", route: "/infection-control", module: "infection_control", required_permission: Some("infection_control.surveillance.list"), icon: "IconShieldCheck", nav_key: "infectionControl", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "regulatory", label: "Regulatory", route: "/regulatory", module: "regulatory", required_permission: Some("regulatory.dashboard.view"), icon: "IconScale", nav_key: "regulatory", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "privacy-compliance", label: "Privacy & CERT-In", route: "/privacy-compliance", module: "regulatory", required_permission: Some("regulatory.dpdp.view"), icon: "IconUserShield", nav_key: "privacyCompliance", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "abdm.dashboard", label: "ABDM dashboard", route: "/abdm/dashboard", module: "abdm", required_permission: Some("abdm.dashboard.view"), icon: "IconIdBadge2", nav_key: "abdmDashboard", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "abdm.consent_requests", label: "ABDM consent requests", route: "/abdm/consent-requests", module: "abdm", required_permission: Some("abdm.consent.list"), icon: "IconFileCertificate", nav_key: "abdmConsentRequests", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "audit", label: "Audit Trail", route: "/audit", module: "audit", required_permission: Some("audit.log.view"), icon: "IconFileAnalytics", nav_key: "audit", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "terminology.snomed", label: "SNOMED CT", route: "/terminology/snomed", module: "terminology", required_permission: Some("terminology.snomed.view"), icon: "IconBinaryTree", nav_key: "snomed", brick: None, any_of: SNOMED_ANY_OF, group: ScreenGroup::Essential },
    ScreenDef { code: "occupational-health", label: "Occupational Health", route: "/occupational-health", module: "occ_health", required_permission: Some("occ_health.screenings.list"), icon: "IconHeartPlus", nav_key: "occHealth", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "admin-users", label: "Users", route: "/admin/users", module: "admin", required_permission: Some("admin.users.list"), icon: "IconUserCog", nav_key: "users", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "admin.doctors", label: "Doctors", route: "/admin/doctors", module: "admin", required_permission: Some("admin.doctors.list"), icon: "IconStethoscope", nav_key: "doctors", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "admin-roles", label: "Roles", route: "/admin/roles", module: "admin", required_permission: Some("admin.roles.list"), icon: "IconUserShield", nav_key: "roles", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "admin-groups", label: "Groups", route: "/admin/groups", module: "admin", required_permission: Some("admin.users.list"), icon: "IconUsersGroup", nav_key: "groups", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "admin-sso", label: "Single Sign-On", route: "/admin/sso", module: "admin", required_permission: Some("admin.sso.providers.manage"), icon: "IconLockSquareRounded", nav_key: "sso", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "admin.access-requests", label: "Access Requests", route: "/admin/access-requests", module: "admin", required_permission: Some("admin.access_requests.list"), icon: "IconShieldLock", nav_key: "accessRequests", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "setup-center", label: "Setup Center", route: "/setup", module: "admin", required_permission: Some("admin.settings.general.manage"), icon: "IconListDetails", nav_key: "setupCenter", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "admin.workbook", label: "Onboarding workbook", route: "/admin/workbook", module: "admin", required_permission: Some("admin.workbook.import"), icon: "IconFileSpreadsheet", nav_key: "onboardingWorkbook", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "admin.kernel", label: "Kernel", route: "/admin/kernel", module: "admin", required_permission: Some("admin.kernel.view"), icon: "IconCpu", nav_key: "kernel", brick: None, any_of: &[], group: ScreenGroup::DevOnly },
    ScreenDef { code: "admin.research-exports", label: "Research data exports", route: "/admin/research-exports", module: "research", required_permission: Some("research.dataset.export"), icon: "IconFileAnalytics", nav_key: "researchExports", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "admin.knowledge-changes", label: "Knowledge changes", route: "/admin/knowledge-changes", module: "knowledge", required_permission: Some("knowledge.change_sets.list"), icon: "IconGitCompare", nav_key: "knowledgeChanges", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "admin-settings", label: "Settings", route: "/admin/settings", module: "admin", required_permission: Some("admin.settings.general.manage"), icon: "IconSettings", nav_key: "settings", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "admin.document-templates", label: "Document Templates", route: "/admin/document-templates", module: "admin", required_permission: Some("admin.settings.general.manage"), icon: "IconFileTypePdf", nav_key: "documentTemplates", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "admin-integration", label: "Integration Hub", route: "/admin/integration-hub", module: "admin", required_permission: Some("integration.list"), icon: "IconPlug", nav_key: "integrationHub", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "admin.forms", label: "Forms", route: "/admin/forms", module: "forms", required_permission: Some("forms.templates.list"), icon: "IconForms", nav_key: "formTemplates", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "admin.test-cycles", label: "Test cycles", route: "/admin/test-cycles", module: "qa", required_permission: Some("qa.test_cycles.manage"), icon: "IconChecklist", nav_key: "testCycles", brick: None, any_of: &[], group: ScreenGroup::DevOnly },
    ScreenDef { code: "admin.api-keys", label: "API keys", route: "/admin/api-keys", module: "admin", required_permission: Some("admin.api_keys.list"), icon: "IconPlug", nav_key: "apiKeys", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "admin.connected-apps", label: "Connected apps", route: "/admin/connected-apps", module: "admin", required_permission: Some("admin.connected_apps.view"), icon: "IconPlug", nav_key: "connectedApps", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "admin.webhooks", label: "Webhooks", route: "/admin/webhooks", module: "admin", required_permission: Some("admin.webhooks.list"), icon: "IconPlug", nav_key: "webhooks", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "admin.documents", label: "Documents & Printing", route: "/admin/documents", module: "documents", required_permission: Some("documents.templates.list"), icon: "IconFileText", nav_key: "documents", brick: None, any_of: &[], group: ScreenGroup::Essential },
    ScreenDef { code: "admin-devices", label: "Devices", route: "/admin/devices", module: "admin", required_permission: Some("devices.list"), icon: "IconPlug", nav_key: "devices", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "admin.paired-devices", label: "Paired Devices", route: "/admin/paired-devices", module: "devices", required_permission: Some("devices.pairing.paired.list"), icon: "IconQrcode", nav_key: "pairedDevices", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "admin.machines", label: "Machines", route: "/admin/machines", module: "devices", required_permission: Some("devices.machines.view"), icon: "IconDeviceDesktop", nav_key: "machines", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "admin.hospital-binding", label: "Hospital Binding", route: "/admin/hospital-binding", module: "devices", required_permission: Some("devices.binding.list"), icon: "IconLink", nav_key: "hospitalBinding", brick: None, any_of: &[], group: ScreenGroup::Advanced },
    ScreenDef { code: "admin.message-simulator", label: "Message Simulator", route: "/admin/message-simulator", module: "admin", required_permission: Some("admin.notifications.simulator.view"), icon: "IconDeviceMobileMessage", nav_key: "messageSimulator", brick: None, any_of: &[], group: ScreenGroup::DevOnly },
];

#[cfg(test)]
mod tests {
    use super::{SCREENS, ScreenGroup};
    use crate::access::catalogue::all_codes;
    use crate::bricks::{BRICKS, find};

    #[test]
    fn routes_are_unique_and_permissions_are_real() {
        for (at, screen) in SCREENS.iter().enumerate() {
            assert!(
                SCREENS[..at].iter().all(|s| s.route != screen.route),
                "{} twice",
                screen.route
            );
            for code in screen.required_permission.iter().chain(screen.any_of) {
                assert!(
                    all_codes().contains(code),
                    "{} names unknown {code}",
                    screen.route
                );
            }
        }
    }

    /// An app screen the web cannot place would be dropped from the menu without a word, and
    /// one with no permission would show to everyone.
    #[test]
    fn each_app_screen_names_a_known_brick_and_a_permission() {
        for screen in SCREENS.iter().filter(|s| s.brick.is_some()) {
            let brick = screen.brick.unwrap_or_default();
            assert!(
                find(brick).is_some(),
                "{} names unknown brick {brick}",
                screen.route
            );
            assert!(
                screen.required_permission.is_some() || !screen.any_of.is_empty(),
                "{} has no permission",
                screen.route
            );
        }
    }

    /// Under the menu's rule both must hold, so an `any_of` holding `required_permission` is
    /// always met and only reads as if it widened the entry.
    #[test]
    fn no_any_of_repeats_the_required_permission() {
        for screen in SCREENS {
            let required = screen.required_permission.unwrap_or_default();
            assert!(
                !screen.any_of.contains(&required),
                "{} repeats {required} in any_of",
                screen.route
            );
        }
    }

    /// The panel is the app's own: a brick named here but never by a screen would be an app
    /// with an empty panel, and the launcher would offer no way into it.
    #[test]
    fn every_brick_with_permissions_has_a_screen() {
        for brick in BRICKS.iter().filter(|b| !b.permission_groups.is_empty()) {
            assert!(
                SCREENS.iter().any(|s| s.brick == Some(brick.id)),
                "{} has no screen",
                brick.id
            );
        }
    }

    /// A brick-owned screen already hides with its app, so a second rule would only contradict
    /// it; and the menu leaves out exactly the three developer screens.
    #[test]
    fn only_core_screens_leave_the_usual_menu() {
        for screen in SCREENS.iter().filter(|s| s.brick.is_some()) {
            assert_eq!(
                screen.group,
                ScreenGroup::Essential,
                "{} is an app's",
                screen.route
            );
        }
        let dev: Vec<_> = SCREENS
            .iter()
            .filter(|s| s.group == ScreenGroup::DevOnly)
            .map(|s| s.code)
            .collect();
        assert_eq!(
            dev,
            [
                "admin.kernel",
                "admin.test-cycles",
                "admin.message-simulator"
            ]
        );
    }
}

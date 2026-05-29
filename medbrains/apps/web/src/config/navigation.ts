import { PERMISSIONS } from "@medbrains/types";
import {
  IconAmbulance,
  IconAppWindow,
  IconBabyCarriage,
  IconBed,
  IconBrain,
  IconBuildingFactory2,
  IconBuildingHospital,
  IconCalendar,
  IconCalendarStats,
  IconChartBar,
  IconClipboardCheck,
  IconDashboard,
  IconDental,
  IconDeviceDesktopAnalytics,
  IconDeviceTablet,
  IconDoorEnter,
  IconDroplet,
  IconFileAnalytics,
  IconFileCertificate,
  IconFileText,
  IconFirstAidKit,
  IconFlask,
  IconForms,
  IconHeartbeat,
  IconHeartHandshake,
  IconHeartPlus,
  IconHeartRateMonitor,
  IconHistory,
  IconIdBadge2,
  IconLayoutDashboard,
  IconListDetails,
  IconMessage,
  IconMicroscope,
  IconPackage,
  IconPill,
  IconPlug,
  IconQrcode,
  IconRadioactive,
  IconReceipt,
  IconReport,
  IconReportMedical,
  IconScale,
  IconSchool,
  IconScissors,
  IconSettings,
  IconShieldCheck,
  IconShieldHalfFilled,
  IconShieldLock,
  IconSignature,
  IconSpray,
  IconStethoscope,
  IconStretching2,
  IconToolsKitchen2,
  IconTruck,
  IconUrgent,
  IconUserCog,
  IconUserSearch,
  IconUserShield,
  IconUsers,
  IconUsersGroup,
  IconWash,
} from "@tabler/icons-react";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { createElement } from "react";

// ── Types ──

export interface NavItemConfig {
  /** i18n key in the "nav" namespace */
  i18nKey: string;
  path: string;
  /** Icon name string — resolved via ICON_MAP */
  icon: string;
  requiredPermission?: string;
  requiredPermissions?: readonly string[];
  children?: NavItemConfig[];
}

export interface NavGroupConfig {
  key: string;
  items: NavItemConfig[];
}

export type AppWorkspaceKey =
  | "hims"
  | "lims"
  | "pacs"
  | "pharmacy"
  | "finance"
  | "specialty"
  | "operations"
  | "compliance"
  | "admin";

export interface AppWorkspaceConfig {
  key: AppWorkspaceKey;
  i18nKey: string;
  description: string;
  icon: string;
  color: string;
  defaultPath: string;
  pathPrefixes: readonly string[];
  permissionModules: readonly string[];
}

export const WORKSPACE_STORAGE_KEY = "medbrains.activeWorkspace";

// ── Icon Map ──

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; stroke?: number }>> = {
  IconAmbulance,
  IconAppWindow,
  IconMessage,
  IconBed,
  IconBuildingHospital,
  IconBuildingFactory2,
  IconDeviceTablet,
  IconWash,
  IconIdBadge2,
  IconFileCertificate,
  IconFirstAidKit,
  IconCalendar,
  IconChartBar,
  IconDashboard,
  IconDeviceDesktopAnalytics,
  IconDoorEnter,
  IconDroplet,
  IconFileText,
  IconFlask,
  IconForms,
  IconHeartRateMonitor,
  IconLayoutDashboard,
  IconPackage,
  IconPill,
  IconPlug,
  IconQrcode,
  IconRadioactive,
  IconReceipt,
  IconReport,
  IconSchool,
  IconScissors,
  IconSettings,
  IconShieldCheck,
  IconShieldLock,
  IconSignature,
  IconSpray,
  IconStethoscope,
  IconToolsKitchen2,
  IconTruck,
  IconUrgent,
  IconUserCog,
  IconUserShield,
  IconUsers,
  IconUsersGroup,
  IconHeartbeat,
  IconMicroscope,
  IconBrain,
  IconStretching2,
  IconHeartHandshake,
  IconBabyCarriage,
  IconScale,
  IconListDetails,
  IconShieldHalfFilled,
  IconReportMedical,
  IconHeartPlus,
  IconClipboardCheck,
  IconUserSearch,
  IconCalendarStats,
  IconHistory,
  IconFileAnalytics,
  IconDental,
};

export function resolveIcon(name: string, size = 20, stroke = 1.5): ReactNode {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return createElement(Icon, { size, stroke });
}

// ── Nav Groups ──

const SETTINGS_NAV_PERMISSIONS = [
  "admin.settings.general.manage",
  "admin.settings.facilities.list",
  "admin.settings.locations.list",
  "admin.settings.departments.list",
  "admin.doctors.list",
  "admin.users.list",
  "admin.roles.list",
  "admin.settings.modules.manage",
  "admin.settings.sequences.manage",
  "admin.settings.services.list",
  "admin.settings.clinical_masters.list",
  "admin.settings.bed_types.manage",
  "admin.settings.billing_tax.manage",
  "admin.settings.branding.manage",
  "admin.settings.regulatory.manage",
  "assets.list",
  "billing.corporate.list",
  "billing.invoices.list",
  "billing.journal.list",
  "communications.config.manage",
  "consent.templates.list",
  "diet.templates.list",
  "documents.templates.list",
  "indent.list",
  "integration.view",
  "ipd.admissions.list",
  "ipd.bed_dashboard.view",
  "ipd.discharge_summary.create",
  "ipd.discharge_summary.finalize",
  "ipd.wards.manage",
  "opd.queue.view",
  "opd.visit.create",
  "opd.visit.update",
  "opd.procedures.list",
  "ipd.tariffs.list",
  "ipd.tariffs.manage",
  "ot.rooms.list",
  "lab.orders.list",
  "lab.reports.view",
  "mrd.records.list",
  "order_sets.templates.list",
  "pharmacy.prescriptions.list",
  "pharmacy.stores.list",
  "pharmacy.stores.manage",
  "procurement.rc.list",
  "procurement.stores.list",
  "procurement.stores.manage",
  "procurement.vendors.list",
  "specialty.other.templates.list",
] as const;

const ADMIN_NAV_PERMISSIONS = [
  "admin.users.list",
  "admin.doctors.list",
  "admin.roles.list",
  "security.access.list",
  "quality.indicators.list",
  ...SETTINGS_NAV_PERMISSIONS,
  "integration.list",
  "opd.schedule.list",
  "documents.templates.list",
  "retrospective.list",
  "devices.list",
  "devices.pairing.paired.list",
] as const;

export const APP_WORKSPACES: AppWorkspaceConfig[] = [
  {
    key: "hims",
    i18nKey: "workspaceHims",
    description: "Patient flow, OPD, ER, IPD, ward and nursing work",
    icon: "IconBuildingHospital",
    color: "linear-gradient(135deg, #0f766e 0%, #38bdf8 100%)",
    defaultPath: "/dashboard",
    permissionModules: [
      "dashboard",
      "patients",
      "opd",
      "doctor",
      "emergency",
      "ipd",
      "icu",
      "ot",
      "nurse",
      "bedside",
      "diet",
      "clinical",
      "order_sets",
    ],
    pathPrefixes: [
      "/dashboard",
      "/patients",
      "/patients/*",
      "/opd",
      "/opd/*",
      "/doctor/*",
      "/emergency",
      "/ipd",
      "/ipd/*",
      "/care-view",
      "/icu",
      "/nurse",
      "/ot",
      "/diet-kitchen",
      "/bedside-portal",
      "/order-sets",
      "/chronic-care",
    ],
  },
  {
    key: "lims",
    i18nKey: "workspaceLims",
    description: "Laboratory, samples, reports, QC and blood bank",
    icon: "IconFlask",
    color: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
    defaultPath: "/lab",
    permissionModules: ["lab", "blood_bank"],
    pathPrefixes: ["/lab", "/blood-bank"],
  },
  {
    key: "pacs",
    i18nKey: "workspacePacs",
    description: "Radiology, imaging orders, DICOM and PACS work",
    icon: "IconRadioactive",
    color: "linear-gradient(135deg, #2563eb 0%, #a855f7 100%)",
    defaultPath: "/radiology",
    permissionModules: ["radiology"],
    pathPrefixes: ["/radiology", "/demo/dicom/*"],
  },
  {
    key: "pharmacy",
    i18nKey: "workspacePharmacy",
    description: "Pharmacy queue, dispensing, stores and safety",
    icon: "IconPill",
    color: "linear-gradient(135deg, #16a34a 0%, #f59e0b 100%)",
    defaultPath: "/pharmacy",
    permissionModules: ["pharmacy", "pharmacy_improvements"],
    pathPrefixes: ["/pharmacy"],
  },
  {
    key: "finance",
    i18nKey: "workspaceFinance",
    description: "Billing, payments, advances, insurance and TPA",
    icon: "IconReceipt",
    color: "linear-gradient(135deg, #0891b2 0%, #f97316 100%)",
    defaultPath: "/billing",
    permissionModules: ["billing", "insurance", "patient_packages", "pharmacy_finance"],
    pathPrefixes: ["/billing", "/billing/*", "/insurance", "/pharmacy/finance"],
  },
  {
    key: "specialty",
    i18nKey: "workspaceSpecialty",
    description: "Specialty clinics, procedure areas and care programs",
    icon: "IconStethoscope",
    color: "linear-gradient(135deg, #db2777 0%, #8b5cf6 100%)",
    defaultPath: "/specialty",
    permissionModules: ["specialty"],
    pathPrefixes: ["/specialty", "/specialty/*"],
  },
  {
    key: "operations",
    i18nKey: "workspaceOperations",
    description: "Stores, assets, camp, facilities, HR and support work",
    icon: "IconAppWindow",
    color: "linear-gradient(135deg, #475569 0%, #22c55e 100%)",
    defaultPath: "/indent",
    permissionModules: [
      "ambulance",
      "assets",
      "bme",
      "camp",
      "case_mgmt",
      "command_center",
      "communications",
      "cssd",
      "facilities",
      "front_office",
      "housekeeping",
      "hr",
      "indent",
      "lms",
      "mrd",
      "occ_health",
      "procurement",
      "scheduling",
      "security",
      "ur",
    ],
    pathPrefixes: [
      "/indent",
      "/indent/*",
      "/procurement",
      "/cssd",
      "/housekeeping",
      "/front-office",
      "/hr",
      "/lms",
      "/bme",
      "/assets",
      "/ambulance",
      "/communications",
      "/camp",
      "/camp/*",
      "/command-center",
      "/facilities",
      "/mrd",
      "/security",
      "/occupational-health",
      "/utilization-review",
      "/case-management",
      "/scheduling",
    ],
  },
  {
    key: "compliance",
    i18nKey: "workspaceCompliance",
    description: "Quality, infection control, regulatory, analytics and audit",
    icon: "IconShieldCheck",
    color: "linear-gradient(135deg, #b45309 0%, #14b8a6 100%)",
    defaultPath: "/quality",
    permissionModules: [
      "analytics",
      "audit",
      "consent",
      "infection_control",
      "quality",
      "regulatory",
    ],
    pathPrefixes: [
      "/quality",
      "/infection-control",
      "/consent",
      "/regulatory",
      "/analytics",
      "/reports",
      "/reports/*",
      "/audit",
    ],
  },
  {
    key: "admin",
    i18nKey: "workspaceAdmin",
    description: "Users, roles, settings, devices and integrations",
    icon: "IconSettings",
    color: "linear-gradient(135deg, #334155 0%, #0ea5e9 100%)",
    defaultPath: "/admin/users",
    permissionModules: ["admin", "devices", "documents", "integration", "retrospective", "storage"],
    pathPrefixes: ["/admin", "/admin/*", "/components-inputs", "/retrospective"],
  },
];

export const NAV_GROUPS: NavGroupConfig[] = [
  {
    key: "main",
    items: [
      {
        i18nKey: "dashboard",
        path: "/dashboard",
        icon: "IconDashboard",
        requiredPermission: "dashboard.view",
      },
    ],
  },
  {
    key: "clinical",
    items: [
      {
        i18nKey: "patients",
        path: "/patients",
        icon: "IconUsers",
        requiredPermission: "patients.list",
      },
      {
        i18nKey: "opdQueue",
        path: "/opd",
        icon: "IconStethoscope",
        requiredPermission: "opd.queue.list",
        requiredPermissions: [
          "opd.queue.list",
          "opd.queue.view",
          "opd.visit.create",
          "opd.visit.update",
          "opd.token.manage",
          "opd.appointment.list",
          "opd.referrals.list",
          "opd.referrals.create",
          "opd.vitals.list",
          "opd.vitals.create",
          "opd.diagnoses.list",
          "opd.diagnoses.create",
          "opd.diagnoses.update",
          "opd.diagnoses.delete",
          "opd.procedures.list",
          "opd.procedures.create",
          "opd.procedures.cancel",
          "opd.certificates.list",
          "opd.certificates.create",
          "opd.certificates.print",
          "opd.certificates.reprint",
          "opd.certificates.void",
          "opd.reminders.list",
          "opd.reminders.create",
          "opd.reminders.update",
          "opd.feedback.list",
          "opd.feedback.create",
          "opd.consents.list",
          "opd.consents.create",
          "opd.consents.sign",
          "opd.consents.print",
          "opd.consents.reprint",
          "opd.consents.revoke",
          "opd.schedule.list",
          "opd.schedule.manage",
          "nurse.vitals.record",
        ],
      },
      {
        i18nKey: "appointments",
        path: "/opd/appointments",
        icon: "IconCalendar",
        requiredPermission: "opd.appointment.list",
      },
      {
        i18nKey: "doctorSignoffs",
        path: "/doctor/signoffs",
        icon: "IconSignature",
        requiredPermission: "doctor.signoffs.view_own",
      },
      {
        i18nKey: "emergency",
        path: "/emergency",
        icon: "IconUrgent",
        requiredPermission: "emergency.visits.list",
        requiredPermissions: [
          "emergency.visits.list",
          "emergency.visits.create",
          "emergency.visits.update",
          "emergency.triage.list",
          "emergency.triage.create",
          "emergency.resuscitation.list",
          "emergency.resuscitation.create",
          "emergency.codes.list",
          "emergency.codes.create",
          "emergency.codes.update",
          "emergency.mlc.list",
          "emergency.mlc.create",
          "emergency.mlc.update",
          "emergency.mlc.print",
          "emergency.mlc.reprint",
          "emergency.mlc_documents.sbar.create",
          "emergency.mlc_documents.age_estimation.create",
          "emergency.mlc_documents.pocso.create",
          "emergency.mlc_documents.court_summons.create",
          "emergency.mlc_police_intimations.list",
          "emergency.mlc_police_intimations.create",
          "emergency.mlc_police_intimations.confirm",
          "emergency.mlc_police_intimations.print",
          "emergency.mlc_police_intimations.reprint",
          "emergency.mass_casualty.list",
          "emergency.mass_casualty.create",
          "emergency.mass_casualty.update",
          "emergency.mass_casualty.close",
        ],
      },
      {
        i18nKey: "orderSets",
        path: "/order-sets",
        icon: "IconListDetails",
        requiredPermission: "order_sets.templates.list",
      },
      {
        i18nKey: "chronicCare",
        path: "/chronic-care",
        icon: "IconReportMedical",
        requiredPermission: "chronic.enrollments.list",
      },
    ],
  },
  {
    key: "diagnostics",
    items: [
      { i18nKey: "lab", path: "/lab", icon: "IconFlask", requiredPermission: "lab.orders.list" },
      {
        i18nKey: "radiology",
        path: "/radiology",
        icon: "IconRadioactive",
        requiredPermission: "radiology.orders.list",
      },
      {
        i18nKey: "pharmacy",
        path: "/pharmacy",
        icon: "IconPill",
        requiredPermission: "pharmacy.prescriptions.list",
        requiredPermissions: [
          "pharmacy.prescriptions.list",
          "pharmacy.prescriptions.view",
          "pharmacy.dispensing.create",
          "pharmacy.dispensing.partial",
          "pharmacy.dispensing.cancel",
          "pharmacy.dispensing.void",
          "pharmacy.rx_queue.list",
          "pharmacy.rx_queue.review",
          "pharmacy.pos.view",
          "pharmacy.pos.create",
          "pharmacy.pos.cancel",
          "pharmacy.pos.return",
          "pharmacy.stock.manage",
          "pharmacy.ndps.list",
          "pharmacy.ndps.manage",
          "pharmacy.stores.list",
          "pharmacy.stores.manage",
          "pharmacy.analytics.view",
          "pharmacy.returns.list",
          "pharmacy.returns.request",
          "pharmacy.returns.approve",
          "pharmacy.returns.restock",
          "pharmacy.returns.destroy",
          "pharmacy.returns.reject",
          "pharmacy.safety.view",
        ],
      },
      {
        i18nKey: "pharmacyFinance",
        path: "/pharmacy/finance",
        icon: "IconReceipt",
        requiredPermissions: [
          "pharmacy_finance.cash_drawer.view",
          "pharmacy_finance.cash_drawer.open",
          "pharmacy_finance.cash_drawer.close",
          "pharmacy_finance.petty_cash.view",
          "pharmacy_finance.petty_cash.record",
          "pharmacy_finance.supplier_payments.view",
          "pharmacy_finance.supplier_payments.manage",
          "pharmacy_finance.free_dispensing.view",
          "pharmacy_finance.finance_reports.view",
        ],
      },
      {
        i18nKey: "bloodBank",
        path: "/blood-bank",
        icon: "IconDroplet",
        requiredPermission: "blood_bank.donors.list",
      },
    ],
  },
  {
    key: "inpatient",
    items: [
      {
        i18nKey: "ipd",
        path: "/ipd",
        icon: "IconBed",
        requiredPermission: "ipd.admissions.list",
        requiredPermissions: [
          "ipd.admissions.list",
          "ipd.admissions.view",
          "ipd.admissions.create",
          "ipd.admissions.update",
          "ipd.admissions.print",
          "ipd.admissions.reprint",
          "ipd.attenders.manage",
          "ipd.wristband.print",
          "ipd.wristband.reprint",
          "ipd.discharge.create",
          "ipd.progress_notes.list",
          "ipd.progress_notes.create",
          "ipd.assessments.list",
          "ipd.assessments.create",
          "ipd.mar.list",
          "ipd.mar.create",
          "ipd.mar.update",
          "ipd.io_chart.list",
          "ipd.io_chart.create",
          "ipd.nursing_assessment.list",
          "ipd.nursing_assessment.create",
          "ipd.care_plans.list",
          "ipd.care_plans.create",
          "ipd.handover.list",
          "ipd.handover.create",
          "ipd.discharge_checklist.list",
          "ipd.discharge_checklist.update",
          "ipd.discharge_summary.create",
          "ipd.discharge_summary.finalize",
          "ipd.clinical_docs.list",
          "ipd.clinical_docs.create",
          "ipd.transfers.create",
          "ipd.death_records.manage",
          "ipd.birth_records.manage",
          "ipd.tariffs.list",
          "ipd.tariffs.manage",
          "ipd.bed_dashboard.view",
          "ipd.beds.manage",
          "ipd.reservations.manage",
          "ipd.wards.manage",
          "ipd.reports.view",
          "ipd.discharge_tat.view",
          "ipd.discharge_tat.update",
          "ipd.discharge_tat.billing.update",
          "ipd.discharge_tat.pharmacy.update",
          "ipd.discharge_tat.nursing.update",
          "ipd.discharge_tat.doctor.update",
          "ipd.discharge_tat.complete",
          "pharmacy.prescriptions.list",
          "pharmacy.dispensing.create",
          "billing.invoices.list",
          "billing.invoices.view",
          "billing.advances.list",
          "billing.corporate.list",
          "consent.signatures.list",
          "emergency.mlc.list",
          "lab.orders.list",
          "lab.orders.view",
          "lab.reports.view",
          "lab.orders.create",
          "radiology.orders.list",
          "radiology.orders.view",
          "radiology.orders.create",
          "ot.bookings.list",
          "ot.bookings.create",
          "diet.orders.list",
          "diet.orders.create",
          "bedside.view",
          "nurse.dashboard.view",
          "nurse.mar.view",
          "nurse.vitals.view",
          "nurse.vitals.record",
          "nurse.intake_output.view",
          "nurse.intake_output.record",
          "nurse.pain.view",
          "nurse.pain.record",
          "nurse.fall_risk.view",
          "nurse.fall_risk.record",
          "nurse.wound.view",
          "nurse.wound.record",
          "nurse.handoff.view",
          "nurse.handoff.record",
          "nurse.equipment.view",
          "nurse.equipment.record",
          "nurse.code_blue.view",
          "nurse.code_blue.record",
          "indent.list",
          "indent.consumables.list",
          "assets.list",
          "bme.equipment.list",
          "infection_control.surveillance.list",
          "infection_control.biowaste.list",
          "facilities.gas.list",
          "mrd.case_sheets.generate",
        ],
      },
      {
        i18nKey: "careView",
        path: "/care-view",
        icon: "IconHeartbeat",
        requiredPermission: "care_view.view",
      },
      {
        i18nKey: "icu",
        path: "/icu",
        icon: "IconHeartRateMonitor",
        requiredPermission: "icu.flowsheets.list",
      },
      {
        i18nKey: "nurseActivities",
        path: "/nurse",
        icon: "IconClipboardCheck",
        requiredPermissions: [
          "nurse.dashboard.view",
          "nurse.mar.view",
          "nurse.vitals.view",
          "nurse.vitals.record",
          "nurse.intake_output.view",
          "nurse.intake_output.record",
          "nurse.pain.view",
          "nurse.pain.record",
          "nurse.fall_risk.view",
          "nurse.fall_risk.record",
          "nurse.wound.view",
          "nurse.wound.record",
          "nurse.handoff.view",
          "nurse.handoff.record",
          "nurse.code_blue.view",
          "nurse.code_blue.record",
          "nurse.equipment.view",
          "nurse.equipment.record",
        ],
      },
      {
        i18nKey: "ot",
        path: "/ot",
        icon: "IconScissors",
        requiredPermissions: [
          "ot.bookings.list",
          "ot.bookings.create",
          "ot.rooms.list",
          "ot.rooms.manage",
          "ot.preferences.list",
          "ot.preferences.manage",
          "ot.reports.view",
        ],
      },
      {
        i18nKey: "dietKitchen",
        path: "/diet-kitchen",
        icon: "IconToolsKitchen2",
        requiredPermission: "diet.orders.list",
        requiredPermissions: [
          "diet.orders.list",
          "diet.orders.create",
          "diet.templates.list",
          "diet.templates.manage",
          "diet.kitchen.list",
          "diet.kitchen.manage",
          "diet.inventory.list",
          "diet.inventory.manage",
          "diet.audits.list",
          "diet.audits.create",
        ],
      },
      {
        i18nKey: "bedsidePortal",
        path: "/bedside-portal",
        icon: "IconDeviceTablet",
        requiredPermissions: [
          "bedside.view",
          "bedside.request",
          "bedside.videos.list",
          "bedside.videos.manage",
          "bedside.feedback.list",
          "bedside.feedback.create",
          "bedside.sessions.list",
          "bedside.sessions.manage",
        ],
      },
    ],
  },
  {
    key: "finance",
    items: [
      {
        i18nKey: "billing",
        path: "/billing",
        icon: "IconReceipt",
        requiredPermission: "billing.invoices.list",
        requiredPermissions: [
          "billing.invoices.list",
          "billing.invoices.view",
          "billing.invoices.create",
          "billing.invoices.update",
          "billing.invoices.cancel",
          "billing.catalog.manage",
          "billing.payments.create",
          "billing.payments.void",
          "billing.receipts.print",
          "billing.receipts.reprint",
          "billing.advances.list",
          "billing.advances.create",
          "billing.advances.adjust",
          "billing.advances.refund",
          "billing.corporate.list",
          "billing.corporate.create",
          "billing.corporate.update",
          "billing.corporate.enroll",
          "billing.corporate.unenroll",
          "billing.reports.view",
          "billing.day_close.create",
          "billing.day_close.verify",
          "billing.write_off.create",
          "billing.write_off.approve",
          "billing.audit.view",
          "billing.credit.list",
          "billing.credit.manage",
          "billing.credit.apply",
          "billing.journal.list",
          "billing.journal.create",
          "billing.journal.post",
          "billing.bank_recon.list",
          "billing.bank_recon.manage",
          "billing.tds.list",
          "billing.tds.manage",
          "billing.gst_returns.list",
          "billing.gst_returns.manage",
          "billing.erp.export",
          "billing.concessions.list",
          "billing.concessions.create",
          "billing.concessions.approve",
        ],
      },
      {
        i18nKey: "insurance",
        path: "/insurance",
        icon: "IconShieldHalfFilled",
        requiredPermission: "insurance.verification.list",
      },
    ],
  },
  {
    key: "operations",
    items: [
      {
        i18nKey: "indent",
        path: "/indent",
        icon: "IconPackage",
        requiredPermission: "indent.list",
      },
      {
        i18nKey: "procurement",
        path: "/procurement",
        icon: "IconTruck",
        requiredPermission: "procurement.vendors.list",
      },
      {
        i18nKey: "cssd",
        path: "/cssd",
        icon: "IconSpray",
        requiredPermission: "cssd.instruments.list",
      },
      {
        i18nKey: "housekeeping",
        path: "/housekeeping",
        icon: "IconWash",
        requiredPermission: "housekeeping.cleaning.list",
      },
      {
        i18nKey: "frontOffice",
        path: "/front-office",
        icon: "IconDoorEnter",
        requiredPermission: "front_office.queue.list",
      },
      { i18nKey: "hr", path: "/hr", icon: "IconIdBadge2", requiredPermission: "hr.employees.list" },
      {
        i18nKey: "lms",
        path: "/lms",
        icon: "IconSchool",
        requiredPermission: "lms.my_learning.view",
      },
      {
        i18nKey: "bme",
        path: "/bme",
        icon: "IconDeviceDesktopAnalytics",
        requiredPermission: "bme.equipment.list",
      },
      {
        i18nKey: "assets",
        path: "/assets",
        icon: "IconPackage",
        requiredPermission: "assets.list",
      },
      {
        i18nKey: "ambulance",
        path: "/ambulance",
        icon: "IconAmbulance",
        requiredPermission: "ambulance.fleet.list",
      },
      {
        i18nKey: "communications",
        path: "/communications",
        icon: "IconMessage",
        requiredPermission: "communications.messages.list",
      },
      {
        i18nKey: "camp",
        path: "/camp",
        icon: "IconFirstAidKit",
        requiredPermission: "camp.list",
        requiredPermissions: [
          "camp.list",
          "camp.create",
          "camp.update",
          "camp.assets.manage",
          "camp.registrations.list",
          "camp.registrations.create",
          "camp.registrations.update",
          "camp.screenings.list",
          "camp.screenings.manage",
          "camp.referrals.create",
          "camp.referrals.update",
          "camp.referrals.status",
          "camp.lab.list",
          "camp.lab.manage",
          "camp.billing.list",
          "camp.billing.create",
          "camp.followups.list",
          "camp.followups.schedule",
          "camp.followups.outcome",
          "camp.followups.convert",
        ],
      },
      {
        i18nKey: "commandCenter",
        path: "/command-center",
        icon: "IconLayoutDashboard",
        requiredPermission: "command_center.view",
      },
      {
        i18nKey: "facilities",
        path: "/facilities",
        icon: "IconBuildingFactory2",
        requiredPermission: "facilities.gas.list",
      },
      {
        i18nKey: "mrd",
        path: "/mrd",
        icon: "IconFileCertificate",
        requiredPermission: "mrd.records.list",
      },
      {
        i18nKey: "security",
        path: "/security",
        icon: "IconShieldLock",
        requiredPermission: "security.access.list",
      },
      {
        i18nKey: "occHealth",
        path: "/occupational-health",
        icon: "IconHeartPlus",
        requiredPermission: "occ_health.screenings.list",
      },
      {
        i18nKey: "utilizationReview",
        path: "/utilization-review",
        icon: "IconClipboardCheck",
        requiredPermission: "ur.reviews.list",
      },
      {
        i18nKey: "caseManagement",
        path: "/case-management",
        icon: "IconUserSearch",
        requiredPermission: "case_mgmt.assignments.list",
      },
      {
        i18nKey: "scheduling",
        path: "/scheduling",
        icon: "IconCalendarStats",
        requiredPermission: "scheduling.predictions.list",
      },
    ],
  },
  {
    key: "compliance",
    items: [
      {
        i18nKey: "quality",
        path: "/quality",
        icon: "IconReport",
        requiredPermission: "quality.indicators.list",
      },
      {
        i18nKey: "infectionControl",
        path: "/infection-control",
        icon: "IconShieldCheck",
        requiredPermission: "infection_control.surveillance.list",
        requiredPermissions: [
          "infection_control.surveillance.list",
          "infection_control.stewardship.list",
          "infection_control.biowaste.list",
          "infection_control.hygiene.list",
          "infection_control.outbreak.list",
        ],
      },
      {
        i18nKey: "consent",
        path: "/consent",
        icon: "IconSignature",
        requiredPermission: "consent.templates.list",
      },
      {
        i18nKey: "regulatory",
        path: "/regulatory",
        icon: "IconScale",
        requiredPermission: "regulatory.dashboard.view",
      },
      {
        i18nKey: "analytics",
        path: "/analytics",
        icon: "IconChartBar",
        requiredPermission: "analytics.view",
      },
      {
        i18nKey: "reports",
        path: "/reports",
        icon: "IconReport",
        requiredPermission: "analytics.view",
      },
      {
        i18nKey: "audit",
        path: "/audit",
        icon: "IconFileAnalytics",
        requiredPermission: "audit.log.view",
      },
    ],
  },
  {
    key: "specialty",
    items: [
      {
        i18nKey: "cathLab",
        path: "/specialty/cath-lab",
        icon: "IconHeartbeat",
        requiredPermission: "specialty.cath_lab.procedures.list",
      },
      {
        i18nKey: "endoscopy",
        path: "/specialty/endoscopy",
        icon: "IconMicroscope",
        requiredPermission: "specialty.endoscopy.procedures.list",
      },
      {
        i18nKey: "psychiatry",
        path: "/specialty/psychiatry",
        icon: "IconBrain",
        requiredPermission: "specialty.psychiatry.patients.list",
      },
      {
        i18nKey: "pmr",
        path: "/specialty/pmr",
        icon: "IconStretching2",
        requiredPermission: "specialty.pmr.plans.list",
      },
      {
        i18nKey: "palliative",
        path: "/specialty/palliative",
        icon: "IconHeartHandshake",
        requiredPermissions: [
          "specialty.palliative.dnr.list",
          "specialty.palliative.dnr.manage",
          "specialty.palliative.pain.list",
          "specialty.palliative.pain.create",
          "specialty.palliative.mortuary.list",
          "specialty.palliative.mortuary.manage",
          "specialty.palliative.nucmed.list",
          "specialty.palliative.nucmed.create",
          "specialty.palliative.nucmed.manage",
        ],
      },
      {
        i18nKey: "maternity",
        path: "/specialty/maternity",
        icon: "IconBabyCarriage",
        requiredPermission: "specialty.maternity.registrations.list",
      },
      {
        i18nKey: "otherSpecialties",
        path: "/specialty/other",
        icon: "IconStethoscope",
        requiredPermission: "specialty.other.records.list",
      },
    ],
  },
  {
    key: "admin",
    items: [
      {
        i18nKey: "admin",
        path: "/admin/users",
        icon: "IconSettings",
        requiredPermissions: ADMIN_NAV_PERMISSIONS,
        children: [
          {
            i18nKey: "users",
            path: "/admin/users",
            icon: "IconUserCog",
            requiredPermission: "admin.users.list",
          },
          {
            i18nKey: "doctors",
            path: "/admin/doctors",
            icon: "IconStethoscope",
            requiredPermission: "admin.doctors.list",
          },
          {
            i18nKey: "roles",
            path: "/admin/roles",
            icon: "IconUserShield",
            requiredPermission: "admin.roles.list",
          },
          {
            i18nKey: "groups",
            path: "/admin/groups",
            icon: "IconUsersGroup",
            requiredPermission: "admin.users.list",
          },
          {
            i18nKey: "accessRequests",
            path: "/admin/access-requests",
            icon: "IconShieldLock",
            requiredPermission: "security.access.list",
          },
          {
            i18nKey: "nabhIndicators",
            path: "/admin/nabh-indicators",
            icon: "IconChartBar",
            requiredPermission: "quality.indicators.list",
          },
          {
            i18nKey: "settings",
            path: "/admin/settings",
            icon: "IconSettings",
            requiredPermission: "admin.settings.general.manage",
            requiredPermissions: SETTINGS_NAV_PERMISSIONS,
          },
          {
            i18nKey: "integrationHub",
            path: "/admin/integration-hub",
            icon: "IconPlug",
            requiredPermission: "integration.list",
          },
          {
            i18nKey: "doctorSchedules",
            path: "/admin/doctor-schedules",
            icon: "IconCalendar",
            requiredPermission: "opd.schedule.list",
          },
          {
            i18nKey: "documents",
            path: "/admin/documents",
            icon: "IconFileText",
            requiredPermission: "documents.templates.list",
          },
          {
            i18nKey: "retrospective",
            path: "/retrospective",
            icon: "IconHistory",
            requiredPermission: "retrospective.list",
          },
          {
            i18nKey: "devices",
            path: "/admin/devices",
            icon: "IconPlug",
            requiredPermission: "devices.list",
          },
          {
            i18nKey: "pairedDevices",
            path: "/admin/paired-devices",
            icon: "IconQrcode",
            requiredPermission: "devices.pairing.paired.list",
          },
        ],
      },
    ],
  },
];

function collectPermissionCodes(items: readonly NavItemConfig[], codes: Set<string>) {
  for (const item of items) {
    if (item.requiredPermission) {
      codes.add(item.requiredPermission);
    }
    for (const permission of item.requiredPermissions ?? []) {
      codes.add(permission);
    }
    if (item.children) {
      collectPermissionCodes(item.children, codes);
    }
  }
}

const PERMISSION_CODES_BY_MODULE = PERMISSIONS.reduce<Record<string, string[]>>(
  (acc, permission) => {
    const moduleCodes = acc[permission.module] ?? [];
    moduleCodes.push(permission.code);
    acc[permission.module] = moduleCodes;
    return acc;
  },
  {},
);

export function workspacePermissionCodes(workspace: AppWorkspaceConfig): readonly string[] {
  const codes = new Set<string>();
  for (const moduleName of workspace.permissionModules) {
    for (const code of PERMISSION_CODES_BY_MODULE[moduleName] ?? []) {
      codes.add(code);
    }
  }
  return [...codes];
}

export function workspaceHasPermission(
  workspace: AppWorkspaceConfig,
  hasPermission: (code: string) => boolean,
): boolean {
  return workspacePermissionCodes(workspace).some((code) => hasPermission(code));
}

export const APP_LAUNCHER_PERMISSIONS: readonly string[] = (() => {
  const codes = new Set<string>();
  for (const workspace of APP_WORKSPACES) {
    for (const code of workspacePermissionCodes(workspace)) {
      codes.add(code);
    }
  }
  for (const group of NAV_GROUPS) {
    collectPermissionCodes(group.items, codes);
  }
  return [...codes];
})();

// ── Breadcrumb path labels ──

/** Walk the nav tree and build a path→label map using the given translation function. */
export function buildPathLabels(groups: NavGroupConfig[], t: TFunction): Record<string, string> {
  const labels: Record<string, string> = {};

  function walk(items: NavItemConfig[]) {
    for (const item of items) {
      labels[item.path] = t(item.i18nKey, { ns: "nav" });
      if (item.children) walk(item.children);
    }
  }

  for (const group of groups) {
    walk(group.items);
  }

  // Extra labels for parent breadcrumb segments not in the nav tree
  labels["/admin"] = t("administration", { ns: "nav" });
  labels["/specialty"] = t("specialty", { ns: "nav" });
  labels["/m"] = t("modules", { ns: "nav" });
  labels["/apps"] = "Apps";
  labels["/patients/register"] = "Register Patient";
  labels["/opd/new"] = "New Visit";
  labels["/opd/queue"] = "Queue";
  labels["/billing/invoices"] = "Invoice";
  labels["/ipd/new"] = "New Admission";
  labels["/ipd/admissions"] = "Admission";
  labels["/camp/new"] = "New Camp";

  return labels;
}

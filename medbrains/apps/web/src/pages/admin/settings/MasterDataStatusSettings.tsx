import {
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconBed,
  IconBell,
  IconBuildingCommunity,
  IconBuildingStore,
  IconBuildingWarehouse,
  IconCash,
  IconCheck,
  IconChecklist,
  IconClipboardList,
  IconFileAnalytics,
  IconFileDescription,
  IconFlask,
  IconHash,
  IconHeartbeat,
  IconIdBadge2,
  IconMapPin,
  IconMedicalCross,
  IconMessageCircle,
  IconPackage,
  IconPill,
  IconPlug,
  IconReceipt,
  IconReportMedical,
  IconScissors,
  IconSearch,
  IconSettings,
  IconSitemap,
  IconStethoscope,
  IconTemplate,
  IconTruckDelivery,
  IconUserShield,
  IconUsers,
  IconWorld,
} from "@tabler/icons-react";
import { useQueries } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import { adminAccessService } from "../../../services/adminAccess.service";
import { adminDoctorsService } from "../../../services/adminDoctors.service";
import { assetsService } from "../../../services/assets.service";
import { billingService } from "../../../services/billing.service";
import { clinicalMastersService } from "../../../services/clinicalMasters.service";
import { clinicalSupportService } from "../../../services/clinicalSupport.service";
import { clinicalTemplatesService } from "../../../services/clinicalTemplates.service";
import { communicationsService } from "../../../services/communications.service";
import { consentService } from "../../../services/consent.service";
import { dietKitchenService } from "../../../services/diet-kitchen.service";
import { documentsService } from "../../../services/documents.service";
import { ipdService } from "../../../services/ipd.service";
import { labCatalogService } from "../../../services/labCatalog.service";
import { mrdService } from "../../../services/mrd.service";
import { orderSetsService } from "../../../services/order-sets.service";
import { otService } from "../../../services/ot.service";
import { pharmacyCatalogService } from "../../../services/pharmacyCatalog.service";
import { procurementService } from "../../../services/procurement.service";
import { reportsService } from "../../../services/reports.service";
import { settingsSetupService } from "../../../services/settingsSetup.service";
import { specialtyService } from "../../../services/specialty.service";
import { tenantSettingsService } from "../../../services/tenantSettings.service";

interface MasterDataItem {
  key: string;
  label: string;
  module: string;
  usedBy: string;
  owner: string;
  actionHref: string;
  actionLabel: string;
  icon: ReactNode;
  count: number | null;
  status: "ready" | "needs_setup" | "restricted" | "error";
  location: "settings" | "module";
  needsSetup: boolean;
}

interface MasterDataGapItem {
  key: string;
  label: string;
  module: string;
  requiredFor: string;
  targetOwner: string;
  actionHref: string;
  actionLabel: string;
  icon: ReactNode;
  priority?: "P0" | "P1" | "P2";
  targetType?: "settings" | "module" | "governance";
}

type SettingsCleanupStatus = "keep" | "advanced" | "move" | "retired";

interface SettingsCleanupItem {
  key: string;
  label: string;
  decision: string;
  status: SettingsCleanupStatus;
  reason: string;
  actionHref: string;
  actionLabel: string;
}

type MasterDataFilter =
  | "all"
  | "needs_setup"
  | "error"
  | "settings"
  | "module"
  | "restricted"
  | "missing";

const MASTER_DATA_FILTER_OPTIONS: { value: MasterDataFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs_setup", label: "Setup" },
  { value: "error", label: "Errors" },
  { value: "settings", label: "Settings" },
  { value: "module", label: "Modules" },
  { value: "missing", label: "Missing" },
  { value: "restricted", label: "No access" },
];

const SETTINGS_SCOPE_NOTES = [
  {
    label: "Settings-owned masters",
    color: "teal",
    text: "Facilities, locations, departments, services, sequences, bed types, billing tax/payment methods, clinical demographics and print templates.",
  },
  {
    label: "Module-owned masters",
    color: "blue",
    text: "Large operational catalogs stay with the module that owns their workflow, such as pharmacy, lab, billing, IPD, OT, MRD, stores and assets.",
  },
  {
    label: "Config/support panels",
    color: "grape",
    text: "General, branding, geography, standards, device integrations, offline mode and health checks are setup controls, not unused master tables.",
  },
];

const MASTER_SETUP_PATH = [
  "Hospital identity, geography, units, facilities and locations.",
  "Departments, doctors, users, roles and approval ownership.",
  "Services, bed types, IPD tariffs, tax categories and payment methods.",
  "Clinical demographics, insurance/TPA, procedure, lab and pharmacy catalogs.",
  "Print templates, communication templates, device integrations and standards readiness.",
];

const SETTINGS_NON_MASTER_PANELS = [
  {
    key: "general",
    label: "General",
    purpose: "Hospital identity, address, registration and accreditation defaults.",
    actionHref: "/admin/settings#general",
    icon: <IconBuildingCommunity size={20} />,
  },
  {
    key: "geo",
    label: "Geography",
    purpose: "Country, state, district and regulatory jurisdiction defaults.",
    actionHref: "/admin/settings#geo",
    icon: <IconMapPin size={20} />,
  },
  {
    key: "units",
    label: "Units & locale",
    purpose: "Timezone, currency, measurement and date-format settings.",
    actionHref: "/admin/settings#units",
    icon: <IconHash size={20} />,
  },
  {
    key: "branding",
    label: "Branding",
    purpose: "Logo, color identity and patient-facing visual defaults.",
    actionHref: "/admin/settings#branding",
    icon: <IconTemplate size={20} />,
  },
  {
    key: "compliance",
    label: "Compliance",
    purpose: "Regulatory toggles and privacy/security operating defaults.",
    actionHref: "/admin/settings#compliance",
    icon: <IconUserShield size={20} />,
  },
  {
    key: "standards",
    label: "Standards",
    purpose: "FHIR, ABDM, DICOM, ICD, SNOMED and LOINC readiness checks.",
    actionHref: "/admin/settings#standards",
    icon: <IconSitemap size={20} />,
  },
  {
    key: "device-integrations",
    label: "Device integrations",
    purpose: "Secure URLs and adapter settings for PACS, analyzers and edge devices.",
    actionHref: "/admin/settings#device-integrations",
    icon: <IconBuildingWarehouse size={20} />,
  },
  {
    key: "offline-system",
    label: "Offline & health",
    purpose: "Edge mode, config import/export and system completeness checks.",
    actionHref: "/admin/settings#system-health",
    icon: <IconChecklist size={20} />,
  },
];

const SETTINGS_RETIRED_PANELS = [
  {
    label: "Setup wizard",
    status: "Retired",
    reason:
      "Replaced by the master-data command center so setup progress is visible from one place.",
    actionHref: "/admin/settings#master-data",
    actionLabel: "Open command center",
  },
  {
    label: "Location tree",
    status: "Merged",
    reason:
      "Merged into Locations because campus, building, floor, room and bed hierarchy belongs there.",
    actionHref: "/admin/settings#locations",
    actionLabel: "Open locations",
  },
  {
    label: "Department hours",
    status: "Merged",
    reason: "Merged into Departments so working hours live next to the department record.",
    actionHref: "/admin/settings#departments",
    actionLabel: "Open departments",
  },
  {
    label: "Users & roles",
    status: "Moved",
    reason:
      "Moved out of Settings into Admin access because users, roles and overrides are operational security screens.",
    actionHref: "/admin/users",
    actionLabel: "Open users",
  },
];

const SETTINGS_CLEANUP_DECISIONS: SettingsCleanupItem[] = [
  {
    key: "core-masters",
    label: "Core setup masters",
    decision: "Keep in Settings",
    status: "keep",
    reason:
      "Facilities, locations, departments, services, sequences, bed types, tax/payment methods, clinical demographics and print templates are shared by many modules.",
    actionHref: "/admin/settings#master-data",
    actionLabel: "Open master map",
  },
  {
    key: "clinical-rules",
    label: "Clinical rules and templates",
    decision: "Keep, but not as masters",
    status: "advanced",
    reason:
      "Drug interactions, critical values, clinical protocols and consultation templates are rules/templates. They should stay accessible without crowding the default masters rail.",
    actionHref: "/admin/settings#drug-interactions",
    actionLabel: "Open rules",
  },
  {
    key: "integration-support",
    label: "Integrations and standards",
    decision: "Move behind support/integration flow",
    status: "move",
    reason:
      "DICOM/PACS, analyzers, ABDM, FHIR, mail/SMS/WhatsApp and finance connectors are operational adapters. Keep deep links, but route users through integration ownership.",
    actionHref: "/admin/integration-hub",
    actionLabel: "Open hub",
  },
  {
    key: "health-offline",
    label: "Health, import/export and offline mode",
    decision: "Advanced support only",
    status: "advanced",
    reason:
      "These controls are important for platform administrators but are not daily master-data setup screens.",
    actionHref: "/admin/settings#system-health",
    actionLabel: "Open health",
  },
  {
    key: "duplicate-settings",
    label: "Duplicate setup pages",
    decision: "Do not re-add",
    status: "retired",
    reason:
      "Setup wizard, separate location tree, department hours and users/roles settings created duplicate ownership and should stay merged or moved.",
    actionHref: "/admin/settings#master-data",
    actionLabel: "Open map",
  },
];

const MASTER_DATA_GAPS: MasterDataGapItem[] = [
  {
    key: "patient-categories",
    label: "Patient categories, identity and document types",
    module: "Registration",
    requiredFor:
      "OPD/IPD billing class, ABHA/ID capture, camp routing, concessions, priority lanes and reporting.",
    targetOwner: "Settings / Patient registration",
    actionHref: "/admin/settings#clinical-masters",
    actionLabel: "Open clinical masters",
    icon: <IconUsers size={24} />,
    priority: "P0",
    targetType: "settings",
  },
  {
    key: "country-phone-prefix-id-rules",
    label: "Country phone prefixes and ID format rules",
    module: "Registration / Settings",
    requiredFor:
      "Phone-prefix dropdowns, deployed-country defaults, alternate-phone validation, ABHA/ID hints and country-specific patient identity capture.",
    targetOwner: "Settings / Registration",
    actionHref: "/admin/settings#geo",
    actionLabel: "Open geography",
    icon: <IconWorld size={24} />,
    priority: "P0",
    targetType: "settings",
  },
  {
    key: "opd-visit-types",
    label: "OPD visit and slot types",
    module: "OPD",
    requiredFor: "New/follow-up/teleconsult routing, schedule capacity, token rules and tariffs.",
    targetOwner: "OPD schedules",
    actionHref: "/opd",
    actionLabel: "Open OPD",
    icon: <IconStethoscope size={24} />,
    priority: "P0",
    targetType: "settings",
  },
  {
    key: "doctor-session-templates",
    label: "Doctor session and schedule templates",
    module: "OPD / Admin",
    requiredFor:
      "Reusable clinic sessions, leave blocks, token capacity, room mapping and auto slot creation.",
    targetOwner: "Doctor schedules",
    actionHref: "/admin/doctor-schedules",
    actionLabel: "Open schedules",
    icon: <IconStethoscope size={24} />,
    priority: "P0",
    targetType: "governance",
  },
  {
    key: "holiday-calendar-demand-rules",
    label: "Holiday calendars and appointment demand rules",
    module: "OPD / Simulator",
    requiredFor:
      "Per-state holidays, doctor schedule availability, hourly volume curves, simulator preview and capacity planning.",
    targetOwner: "Doctor schedules / Simulator",
    actionHref: "/admin/doctor-schedules",
    actionLabel: "Open schedules",
    icon: <IconChecklist size={24} />,
    priority: "P1",
    targetType: "governance",
  },
  {
    key: "lab-specimens",
    label: "Specimen, container and analyzer masters",
    module: "Lab",
    requiredFor: "Order collection labels, analyzer routing, rejection reasons and NABL evidence.",
    targetOwner: "Lab catalog",
    actionHref: "/lab",
    actionLabel: "Open lab",
    icon: <IconFlask size={24} />,
    priority: "P0",
    targetType: "module",
  },
  {
    key: "radiology-modalities",
    label: "Radiology modality and PACS AE titles",
    module: "Radiology/PACS",
    requiredFor: "DICOM worklist routing, study ingestion, image viewer and modality billing.",
    targetOwner: "Device integrations",
    actionHref: "/admin/settings#device-integrations",
    actionLabel: "Open integrations",
    icon: <IconReportMedical size={24} />,
    priority: "P1",
    targetType: "settings",
  },
  {
    key: "pharmacy-manufacturers",
    label: "Manufacturer, brand and formulary classes",
    module: "Pharmacy",
    requiredFor:
      "Generic-brand substitution, DTC formulary, LASA warnings, AWaRe and NDPS controls.",
    targetOwner: "Pharmacy catalog",
    actionHref: "/pharmacy?tab=catalog",
    actionLabel: "Open catalog",
    icon: <IconPill size={24} />,
    priority: "P0",
    targetType: "module",
  },
  {
    key: "pharmacy-store-transfer-reasons",
    label: "Pharmacy stores, transfer and dispatch reasons",
    module: "Pharmacy / Stores",
    requiredFor:
      "Multi-pharmacy stock, store-to-store transfer, substitutions, quick dispatch and return audit.",
    targetOwner: "Pharmacy stores",
    actionHref: "/pharmacy?tab=stores",
    actionLabel: "Open stores",
    icon: <IconBuildingStore size={24} />,
    priority: "P0",
    targetType: "module",
  },
  {
    key: "billing-service-tags",
    label: "Service tags, tax maps and charge rules",
    module: "Billing",
    requiredFor:
      "Patient/pharmacy/lab/service billing tabs, GST/tax behavior, package inclusion and revenue reports.",
    targetOwner: "Billing catalog",
    actionHref: "/billing?tab=charge-master",
    actionLabel: "Open charge master",
    icon: <IconCash size={24} />,
    priority: "P0",
    targetType: "governance",
  },
  {
    key: "payment-reconciliation-masters",
    label: "Payment gateway and reconciliation masters",
    module: "Billing / Finance",
    requiredFor:
      "UPI QR intents, Razorpay/bank feed matching, cashier approval, refunds, reversals and settlement reports.",
    targetOwner: "Billing payments",
    actionHref: "/billing?tab=bank-recon",
    actionLabel: "Open reconciliation",
    icon: <IconReceipt size={24} />,
    priority: "P0",
    targetType: "governance",
  },
  {
    key: "external-finance-crm-connectors",
    label: "External finance, CRM and messaging connectors",
    module: "Integrations",
    requiredFor:
      "Tally, QuickBooks, Razorpay/bank feeds, Stalwart/mail setup, CRM handoff, WhatsApp/SMS and statement reconciliation adapters.",
    targetOwner: "Integration hub / Communications",
    actionHref: "/admin/integration-hub",
    actionLabel: "Open integrations",
    icon: <IconPlug size={24} />,
    priority: "P1",
    targetType: "settings",
  },
  {
    key: "ipd-room-class-rules",
    label: "Room class and transfer charge rules",
    module: "IPD",
    requiredFor:
      "Bed transfer impact, nursing charges, deposits, tax/service tags and package overrides.",
    targetOwner: "IPD tariffs",
    actionHref: "/ipd?tab=tariffs",
    actionLabel: "Open tariffs",
    icon: <IconBed size={24} />,
    priority: "P0",
    targetType: "governance",
  },
  {
    key: "ipd-doctor-visit-charge-rules",
    label: "IPD doctor visit and procedure charge rules",
    module: "IPD / Billing",
    requiredFor:
      "Consultant rounds, emergency visits, OT-linked visits, room-class pricing and taxable/non-taxable charges.",
    targetOwner: "IPD tariffs",
    actionHref: "/ipd?tab=tariffs",
    actionLabel: "Open tariffs",
    icon: <IconStethoscope size={24} />,
    priority: "P0",
    targetType: "governance",
  },
  {
    key: "nursing-task-library",
    label: "Nursing task and flowsheet library",
    module: "Nursing",
    requiredFor:
      "Vitals frequency, intake/output, fall risk, wound care, handoff and due-now timelines.",
    targetOwner: "Nurse Activities",
    actionHref: "/nurse-activities",
    actionLabel: "Open nursing",
    icon: <IconClipboardList size={24} />,
    priority: "P1",
    targetType: "module",
  },
  {
    key: "ot-anesthesia-templates",
    label: "OT procedure, anesthesia and implant sets",
    module: "OT",
    requiredFor: "Pre-op checklists, anesthesia notes, implants/consumables and OT charge capture.",
    targetOwner: "OT module",
    actionHref: "/ot",
    actionLabel: "Open OT",
    icon: <IconScissors size={24} />,
    priority: "P0",
    targetType: "module",
  },
  {
    key: "emergency-triage-masters",
    label: "ER triage, code-blue and MLC masters",
    module: "Emergency",
    requiredFor:
      "Acuity bands, crash-cart workflows, police station lookup, disaster tags and MLC printing.",
    targetOwner: "Emergency module",
    actionHref: "/emergency",
    actionLabel: "Open ER",
    icon: <IconMedicalCross size={24} />,
    priority: "P0",
    targetType: "module",
  },
  {
    key: "camp-sponsor-package-masters",
    label: "Camp sponsors, packages and referral outcomes",
    module: "Camp",
    requiredFor:
      "Free/paid/sponsor split, camp billing, follow-up queues, referral tracking and reports.",
    targetOwner: "Camp module",
    actionHref: "/camp",
    actionLabel: "Open camp",
    icon: <IconBuildingCommunity size={24} />,
    priority: "P1",
    targetType: "module",
  },
  {
    key: "front-office-request-types",
    label: "Front-office request and queue types",
    module: "Front office",
    requiredFor:
      "Desk routing, visitor requests, enquiry categories, token/service counters and notifications.",
    targetOwner: "Front office module",
    actionHref: "/front-office",
    actionLabel: "Open front office",
    icon: <IconBell size={24} />,
    priority: "P1",
    targetType: "settings",
  },
  {
    key: "notification-routing-rules",
    label: "User notification board and routing rules",
    module: "Communications / Access",
    requiredFor:
      "Role-based notification board, user task routing, doctor/nurse/cashier alerts, escalation rules and approval reminders.",
    targetOwner: "Communications / Admin access",
    actionHref: "/communications",
    actionLabel: "Open comms",
    icon: <IconMessageCircle size={24} />,
    priority: "P1",
    targetType: "settings",
  },
  {
    key: "hr-designations-shifts",
    label: "Designations, shifts and reporting lines",
    module: "HR / Access",
    requiredFor:
      "Org chart, who can request/approve access, rosters, handoff targets and staff activity.",
    targetOwner: "Admin access / HR",
    actionHref: "/admin/users",
    actionLabel: "Open users",
    icon: <IconUserShield size={24} />,
    priority: "P1",
    targetType: "governance",
  },
  {
    key: "approval-hierarchy-delegation",
    label: "Approval hierarchy and delegation matrix",
    module: "Access / HR",
    requiredFor:
      "Who may raise access, who may approve, indirect approvals, payment reversal approval, handoff targets and elevated-access expiry.",
    targetOwner: "Admin roles / Access requests",
    actionHref: "/admin/access-requests",
    actionLabel: "Open access",
    icon: <IconUserShield size={24} />,
    priority: "P0",
    targetType: "governance",
  },
  {
    key: "stock-transfer-borrow-cost-rules",
    label: "Stock transfer, borrow and cost-center rules",
    module: "Stores / Procurement",
    requiredFor:
      "Indent, issue, return, borrow, store-to-store transfer, landed cost and department consumption reports.",
    targetOwner: "Stores / Procurement",
    actionHref: "/procurement",
    actionLabel: "Open stores",
    icon: <IconPackage size={24} />,
    priority: "P1",
    targetType: "module",
  },
  {
    key: "diet-canteen-menus",
    label: "Diet, canteen and bedside menu masters",
    module: "Diet kitchen",
    requiredFor:
      "Bedside ordering, kitchen prep, diet restrictions, canteen billing and meal delivery.",
    targetOwner: "Diet kitchen module",
    actionHref: "/diet-kitchen?tab=templates",
    actionLabel: "Open diet",
    icon: <IconClipboardList size={24} />,
    priority: "P1",
    targetType: "module",
  },
  {
    key: "bme-equipment-types",
    label: "Biomedical equipment types and calibration schedules",
    module: "BME / Assets",
    requiredFor:
      "ICU/OT device safety, calibration, PM schedules, breakdowns and bed-linked equipment checks.",
    targetOwner: "Assets / BME",
    actionHref: "/assets",
    actionLabel: "Open assets",
    icon: <IconBuildingWarehouse size={24} />,
    priority: "P1",
    targetType: "module",
  },
  {
    key: "bio-waste-vendors",
    label: "Bio-waste categories, bins and vendors",
    module: "Housekeeping / Compliance",
    requiredFor:
      "BMW 2016 segregation, bag/barcode tracking, vendor manifest and infection-control reports.",
    targetOwner: "Compliance / Housekeeping",
    actionHref: "/admin/settings#compliance",
    actionLabel: "Open compliance",
    icon: <IconAlertCircle size={24} />,
    priority: "P2",
    targetType: "settings",
  },
];

function isMasterDataFilter(value: string): value is MasterDataFilter {
  return MASTER_DATA_FILTER_OPTIONS.some((option) => option.value === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectionCount(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (!isRecord(value)) return 0;
  if (Array.isArray(value.items)) return value.items.length;
  if (typeof value.total === "number") return value.total;
  if (typeof value.count === "number") return value.count;
  return 0;
}

function masterStatusColor(status: MasterDataItem["status"]) {
  if (status === "ready") return "success";
  if (status === "needs_setup") return "danger";
  if (status === "restricted") return "slate";
  return "orange";
}

function masterStatusLabel(status: MasterDataItem["status"]) {
  if (status === "ready") return "Ready";
  if (status === "needs_setup") return "Needs setup";
  if (status === "restricted") return "No access";
  return "Check failed";
}

function masterCountText(item: MasterDataItem) {
  if (item.status === "restricted") return "Restricted";
  if (item.status === "error") return "Error";
  return String(item.count ?? 0);
}

function gapPriority(item: MasterDataGapItem) {
  return item.priority ?? "P1";
}

function gapPriorityColor(priority: NonNullable<MasterDataGapItem["priority"]>) {
  if (priority === "P0") return "red";
  if (priority === "P1") return "orange";
  return "gray";
}

function gapTargetTypeLabel(targetType: MasterDataGapItem["targetType"]) {
  if (targetType === "settings") return "Settings target";
  if (targetType === "governance") return "Shared governance";
  return "Module target";
}

function gapTargetTypeColor(targetType: MasterDataGapItem["targetType"]) {
  if (targetType === "settings") return "teal";
  if (targetType === "governance") return "violet";
  return "blue";
}

function settingsCleanupColor(status: SettingsCleanupStatus) {
  if (status === "keep") return "teal";
  if (status === "advanced") return "grape";
  if (status === "move") return "blue";
  return "gray";
}

export function MasterDataStatusSettings() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MasterDataFilter>("missing");
  const canManageGeneralSettings = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const canViewFacilities = useHasPermission(P.ADMIN.SETTINGS.FACILITIES.LIST);
  const canViewPharmacyCatalog = useHasPermission(P.PHARMACY.PRESCRIPTIONS_LIST);
  const canViewLabCatalog = useHasPermission(P.LAB.ORDERS_LIST);
  const canViewProcedureCatalog = useHasPermission(P.OPD.PROCEDURES.LIST);
  const canViewOpdQueue = useHasPermission(P.OPD.QUEUE_VIEW);
  const canCreateOpdVisit = useHasPermission(P.OPD.VISIT_CREATE);
  const canUpdateOpdVisit = useHasPermission(P.OPD.VISIT_UPDATE);
  const canViewDepartments = useHasPermission(P.ADMIN.SETTINGS.DEPARTMENTS.LIST);
  const canViewUsers = useHasPermission(P.ADMIN.USERS.LIST);
  const canViewDoctors = useHasPermission(P.ADMIN.DOCTORS.LIST);
  const canViewRoles = useHasPermission(P.ADMIN.ROLES.LIST);
  const canViewLocations = useHasPermission(P.ADMIN.SETTINGS.LOCATIONS.LIST);
  const canViewServices = useHasPermission(P.ADMIN.SETTINGS.SERVICES.LIST);
  const canViewModules = useHasPermission(P.ADMIN.SETTINGS.MODULES.MANAGE);
  const canViewSequences = useHasPermission(P.ADMIN.SETTINGS.SEQUENCES.MANAGE);
  const canViewBedTypes = useHasPermission(P.ADMIN.SETTINGS.BED_TYPES.MANAGE);
  const canViewBillingMasters = useHasPermission(P.ADMIN.SETTINGS.BILLING_TAX.MANAGE);
  const canViewPrintTemplates = useHasPermission(P.ADMIN.SETTINGS.BRANDING.MANAGE);
  const canViewBillingCatalog = useHasPermission(P.BILLING.INVOICES_LIST);
  const canViewCorporateMasters = useHasPermission(P.BILLING.CORPORATE_LIST);
  const canViewGlAccounts = useHasPermission(P.BILLING.JOURNAL_LIST);
  const canViewProcurementVendors = useHasPermission(P.PROCUREMENT.VENDORS_LIST);
  const canViewProcurementStores = useHasPermission(P.PROCUREMENT.STORES_LIST);
  const canManageProcurementStores = useHasPermission(P.PROCUREMENT.STORES_MANAGE);
  const canViewRateContracts = useHasPermission(P.PROCUREMENT.RC_LIST);
  const canViewIndentCatalog = useHasPermission(P.INDENT.LIST);
  const canViewPharmacyStores = useHasPermission(P.PHARMACY.STORES_LIST);
  const canManagePharmacyStores = useHasPermission(P.PHARMACY.STORES_MANAGE);
  const canViewAssets = useHasPermission(P.ASSETS.LIST);
  const canViewConsentTemplates = useHasPermission(P.CONSENT.TEMPLATES_LIST);
  const canViewDocumentTemplates = useHasPermission(P.DOCUMENTS.TEMPLATES_LIST);
  const canViewDietTemplates = useHasPermission(P.DIET.TEMPLATES_LIST);
  const canViewOrderSetTemplates = useHasPermission(P.ORDER_SETS.TEMPLATES_LIST);
  const canViewClinicalMasters = useHasPermission(P.ADMIN.SETTINGS.CLINICAL_MASTERS.LIST);
  const canViewLabReports = useHasPermission(P.LAB.REPORTS_VIEW);
  const canViewCommConfig = useHasPermission(P.COMMUNICATIONS.CONFIG_MANAGE);
  const canViewSpecialtyTemplates = useHasPermission(P.SPECIALTY.OTHER.TEMPLATES_LIST);
  const canViewIpdAdmissions = useHasPermission(P.IPD.ADMISSIONS_LIST);
  const canManageIpdWards = useHasPermission(P.IPD.WARDS_MANAGE);
  const canViewIpdBedDashboard = useHasPermission(P.IPD.BED_DASHBOARD_VIEW);
  const canCreateDischargeSummary = useHasPermission(P.IPD.DISCHARGE_SUMMARY_CREATE);
  const canFinalizeDischargeSummary = useHasPermission(P.IPD.DISCHARGE_SUMMARY_FINALIZE);
  const canViewIpdTariffList = useHasPermission(P.IPD.TARIFFS_LIST);
  const canManageIpdTariffs = useHasPermission(P.IPD.TARIFFS_MANAGE);
  const canViewIpdTariffs = canViewIpdTariffList || canManageIpdTariffs;
  const canViewIpdWards = canViewIpdAdmissions || canManageIpdWards || canViewIpdBedDashboard;
  const canListOtRooms = useHasPermission(P.OT.ROOMS_LIST);
  const canManageOtRooms = useHasPermission(P.OT.ROOMS_MANAGE);
  const canListOtBookings = useHasPermission(P.OT.BOOKINGS_LIST);
  const canCreateOtBookings = useHasPermission(P.OT.BOOKINGS_CREATE);
  const canUpdateOtBookings = useHasPermission(P.OT.BOOKINGS_UPDATE);
  const canViewOtRooms =
    canListOtRooms ||
    canManageOtRooms ||
    canListOtBookings ||
    canCreateOtBookings ||
    canUpdateOtBookings;
  const otRoomsActionHref =
    canListOtRooms || canManageOtRooms ? "/ot?tab=rooms" : "/ot?tab=bookings";
  const otRoomsActionLabel = canListOtRooms || canManageOtRooms ? "Open rooms" : "Open bookings";
  const canViewMrdStorage = useHasPermission(P.MRD.RECORDS_LIST);
  const canViewClinicalRules = canManageGeneralSettings || canViewOpdQueue;
  const canViewConsultationTemplates = canViewOpdQueue || canCreateOpdVisit || canUpdateOpdVisit;
  const canViewPrescriptionTemplates = canViewConsultationTemplates;
  const canViewLabReportTemplates = canViewLabCatalog || canViewLabReports;
  const canViewDischargeTemplates =
    canViewIpdAdmissions || canCreateDischargeSummary || canFinalizeDischargeSummary;
  const canViewStoreLocations =
    canViewProcurementStores ||
    canManageProcurementStores ||
    canViewPharmacyStores ||
    canManagePharmacyStores;
  const canViewStoreCatalog =
    canViewIndentCatalog || canViewPharmacyStores || canManagePharmacyStores;

  const queries = useQueries({
    queries: [
      {
        queryKey: ["pharmacy-catalog"],
        queryFn: () => pharmacyCatalogService.listPharmacyCatalog(),
        enabled: canViewPharmacyCatalog,
      },
      {
        queryKey: ["lab-catalog"],
        queryFn: () => labCatalogService.listLabCatalog(),
        enabled: canViewLabCatalog,
      },
      {
        queryKey: ["procedure-catalog"],
        queryFn: () => settingsSetupService.listProcedureCatalog(),
        enabled: canViewProcedureCatalog,
      },
      {
        queryKey: ["setup-facilities"],
        queryFn: () => settingsSetupService.listFacilities(),
        enabled: canViewFacilities,
      },
      {
        queryKey: ["setup-departments"],
        queryFn: () => settingsSetupService.listDepartments(),
        enabled: canViewDepartments,
      },
      {
        queryKey: ["setup-users"],
        queryFn: () => adminAccessService.listUsers(),
        enabled: canViewUsers,
      },
      {
        queryKey: ["admin-doctors", "master-data"],
        queryFn: () => adminDoctorsService.listDoctors({ limit: 500 }),
        enabled: canViewDoctors,
      },
      {
        queryKey: ["setup-locations"],
        queryFn: () => settingsSetupService.listLocations(),
        enabled: canViewLocations,
      },
      {
        queryKey: ["setup-services"],
        queryFn: () => settingsSetupService.listServices(),
        enabled: canViewServices,
      },
      {
        queryKey: ["setup-modules"],
        queryFn: () => settingsSetupService.listModules(),
        enabled: canViewModules,
      },
      {
        queryKey: ["setup-sequences"],
        queryFn: () => settingsSetupService.listSequences(),
        enabled: canViewSequences,
      },
      {
        queryKey: ["setup-bed-types"],
        queryFn: () => settingsSetupService.listBedTypes(),
        enabled: canViewBedTypes,
      },
      {
        queryKey: ["setup-tax-categories"],
        queryFn: () => settingsSetupService.listTaxCategories(),
        enabled: canViewBillingMasters,
      },
      {
        queryKey: ["setup-payment-methods"],
        queryFn: () => settingsSetupService.listPaymentMethods(),
        enabled: canViewBillingMasters,
      },
      {
        queryKey: ["ipd-ip-types"],
        queryFn: () => ipdService.listIpTypes(),
        enabled: canViewIpdTariffs,
      },
      {
        queryKey: ["ipd-wards"],
        queryFn: () => ipdService.listWards(),
        enabled: canViewIpdWards,
      },
      {
        queryKey: ["ot-rooms"],
        queryFn: () => otService.listOtRooms(),
        enabled: canViewOtRooms,
      },
      {
        queryKey: ["mrd-storage-locations"],
        queryFn: () => mrdService.listMrdStorageLocations(),
        enabled: canViewMrdStorage,
      },
      {
        queryKey: ["drug-interactions"],
        queryFn: () => clinicalMastersService.listDrugInteractions(),
        enabled: canViewClinicalRules,
      },
      {
        queryKey: ["critical-value-rules"],
        queryFn: () => clinicalMastersService.listCriticalValueRules(),
        enabled: canViewClinicalRules,
      },
      {
        queryKey: ["clinical-protocols"],
        queryFn: () => clinicalMastersService.listClinicalProtocols(),
        enabled: canViewClinicalRules,
      },
      {
        queryKey: ["consultation-templates"],
        queryFn: () => clinicalTemplatesService.listConsultationTemplates(),
        enabled: canViewConsultationTemplates,
      },
      {
        queryKey: ["admin-religions"],
        queryFn: () => clinicalMastersService.listReligions(),
        enabled: canViewClinicalMasters,
      },
      {
        queryKey: ["admin-occupations"],
        queryFn: () => clinicalMastersService.listOccupations(),
        enabled: canViewClinicalMasters,
      },
      {
        queryKey: ["admin-relations"],
        queryFn: () => clinicalMastersService.listRelations(),
        enabled: canViewClinicalMasters,
      },
      {
        queryKey: ["admin-insurance-providers"],
        queryFn: () => clinicalMastersService.listInsuranceProviders(),
        enabled: canViewClinicalMasters,
      },
      {
        queryKey: ["billing-charge-master"],
        queryFn: () => billingService.listChargeMaster(),
        enabled: canViewBillingCatalog,
      },
      {
        queryKey: ["billing-packages"],
        queryFn: () => billingService.listPackages(),
        enabled: canViewBillingCatalog,
      },
      {
        queryKey: ["billing-rate-plans"],
        queryFn: () => billingService.listRatePlans(),
        enabled: canViewBillingCatalog,
      },
      {
        queryKey: ["billing-corporates"],
        queryFn: () => billingService.listCorporates(),
        enabled: canViewCorporateMasters,
      },
      {
        queryKey: ["billing-tpa-rate-cards"],
        queryFn: () => billingService.listTpaRateCards(),
        enabled: canViewCorporateMasters,
      },
      {
        queryKey: ["billing-gl-accounts"],
        queryFn: () => billingService.listGlAccounts(),
        enabled: canViewGlAccounts,
      },
      {
        queryKey: ["procurement-vendors"],
        queryFn: () => procurementService.listVendors(),
        enabled: canViewProcurementVendors,
      },
      {
        queryKey: ["procurement-store-locations"],
        queryFn: () => procurementService.listStoreLocations(),
        enabled: canViewStoreLocations,
      },
      {
        queryKey: ["procurement-rate-contracts"],
        queryFn: () => procurementService.listRateContracts(),
        enabled: canViewRateContracts,
      },
      {
        queryKey: ["store-catalog"],
        queryFn: () => procurementService.listStoreCatalog(),
        enabled: canViewStoreCatalog,
      },
      {
        queryKey: ["asset-categories"],
        queryFn: () => assetsService.listAssetCategories(),
        enabled: canViewAssets,
      },
      {
        queryKey: ["asset-store-categories"],
        queryFn: () => assetsService.listStoreCategories(),
        enabled: canViewAssets,
      },
      {
        queryKey: ["consent-templates"],
        queryFn: () => consentService.listConsentTemplates(),
        enabled: canViewConsentTemplates,
      },
      {
        queryKey: ["document-templates"],
        queryFn: () => documentsService.listDocumentTemplates(),
        enabled: canViewDocumentTemplates,
      },
      {
        queryKey: ["diet-templates"],
        queryFn: () => dietKitchenService.listDietTemplates(),
        enabled: canViewDietTemplates,
      },
      {
        queryKey: ["order-set-templates"],
        queryFn: () => orderSetsService.listOrderSetTemplates(),
        enabled: canViewOrderSetTemplates,
      },
      {
        queryKey: ["setup-roles"],
        queryFn: () => adminAccessService.listRoles(),
        enabled: canViewRoles,
      },
      {
        queryKey: ["setup-print-templates"],
        queryFn: () => tenantSettingsService.getPrintTemplates(),
        enabled: canViewPrintTemplates,
      },
      {
        queryKey: ["opd-prescription-templates"],
        queryFn: () => clinicalSupportService.listPrescriptionTemplates(),
        enabled: canViewPrescriptionTemplates,
      },
      {
        queryKey: ["lab-report-templates"],
        queryFn: () => reportsService.listReportTemplates(),
        enabled: canViewLabReportTemplates,
      },
      {
        queryKey: ["ipd-discharge-templates"],
        queryFn: () => ipdService.listDischargeTemplates(),
        enabled: canViewDischargeTemplates,
      },
      {
        queryKey: ["communication-templates"],
        queryFn: () => communicationsService.listCommTemplates(),
        enabled: canViewCommConfig,
      },
      {
        queryKey: ["communication-dlt-templates"],
        queryFn: () => communicationsService.listDltTemplates(),
        enabled: canViewCommConfig,
      },
      {
        queryKey: ["specialty-templates"],
        queryFn: () => specialtyService.listSpecialtyTemplates(),
        enabled: canViewSpecialtyTemplates,
      },
    ],
  });

  const isLoading = queries.some((q) => q.isLoading);

  const masterItems: MasterDataItem[] = useMemo(() => {
    const [
      pharmacyQuery,
      labQuery,
      procedureQuery,
      facilityQuery,
      deptQuery,
      userQuery,
      doctorQuery,
      locationQuery,
      servicesQuery,
      modulesQuery,
      sequencesQuery,
      bedTypesQuery,
      taxCategoriesQuery,
      paymentMethodsQuery,
      ipdTariffsQuery,
      ipdWardsQuery,
      otRoomsQuery,
      mrdStorageQuery,
      drugInteractionsQuery,
      criticalValueRulesQuery,
      clinicalProtocolsQuery,
      consultationTemplatesQuery,
      religionsQuery,
      occupationsQuery,
      relationsQuery,
      insuranceProvidersQuery,
      chargeMasterQuery,
      packagesQuery,
      ratePlansQuery,
      corporatesQuery,
      tpaRateCardsQuery,
      glAccountsQuery,
      vendorsQuery,
      storeLocationsQuery,
      rateContractsQuery,
      storeCatalogQuery,
      assetCategoriesQuery,
      storeCategoriesQuery,
      consentTemplatesQuery,
      documentTemplatesQuery,
      dietTemplatesQuery,
      orderSetTemplatesQuery,
      rolesQuery,
      printTemplatesQuery,
      prescriptionTemplatesQuery,
      labReportTemplatesQuery,
      dischargeTemplatesQuery,
      communicationTemplatesQuery,
      dltTemplatesQuery,
      specialtyTemplatesQuery,
    ] = queries;

    const status = (
      canView: boolean,
      isError: boolean,
      count: number,
    ): MasterDataItem["status"] => {
      if (!canView) return "restricted";
      if (isError) return "error";
      return count === 0 ? "needs_setup" : "ready";
    };

    const item = (
      params: Omit<MasterDataItem, "count" | "status" | "needsSetup"> & {
        canView: boolean;
        isError: boolean;
        count: number;
      },
    ): MasterDataItem => {
      const { canView, isError, count, ...itemParams } = params;
      const resolvedStatus = status(canView, isError, count);
      return {
        ...itemParams,
        count: canView && !isError ? count : null,
        status: resolvedStatus,
        needsSetup: resolvedStatus === "needs_setup",
      };
    };

    type MasterStatusQuery = (typeof queries)[number] | undefined;
    const queryCount = (query: MasterStatusQuery) => collectionCount(query?.data);
    const queryError = (query: MasterStatusQuery) => Boolean(query?.isError);

    const drugCount = queryCount(pharmacyQuery);
    const testCount = queryCount(labQuery);
    const procedureCount = queryCount(procedureQuery);
    const facilityCount = queryCount(facilityQuery);
    const deptCount = queryCount(deptQuery);
    const userCount = queryCount(userQuery);
    const doctorCount = queryCount(doctorQuery);
    const locationCount = queryCount(locationQuery);
    const serviceCount = queryCount(servicesQuery);
    const moduleCount = queryCount(modulesQuery);
    const sequenceCount = queryCount(sequencesQuery);
    const bedTypeCount = queryCount(bedTypesQuery);
    const taxCategoryCount = queryCount(taxCategoriesQuery);
    const paymentMethodCount = queryCount(paymentMethodsQuery);
    const ipdTariffCount = queryCount(ipdTariffsQuery);
    const ipdWardCount = queryCount(ipdWardsQuery);
    const otRoomCount = queryCount(otRoomsQuery);
    const mrdStorageCount = queryCount(mrdStorageQuery);
    const drugInteractionCount = queryCount(drugInteractionsQuery);
    const criticalValueRuleCount = queryCount(criticalValueRulesQuery);
    const clinicalProtocolCount = queryCount(clinicalProtocolsQuery);
    const consultationTemplateCount = queryCount(consultationTemplatesQuery);
    const clinicalMasterCount =
      queryCount(religionsQuery) + queryCount(occupationsQuery) + queryCount(relationsQuery);
    const clinicalMasterError =
      queryError(religionsQuery) || queryError(occupationsQuery) || queryError(relationsQuery);
    const insuranceProviderCount = queryCount(insuranceProvidersQuery);
    const chargeMasterCount = queryCount(chargeMasterQuery);
    const packageCount = queryCount(packagesQuery);
    const ratePlanCount = queryCount(ratePlansQuery);
    const corporateCount = queryCount(corporatesQuery);
    const tpaRateCardCount = queryCount(tpaRateCardsQuery);
    const glAccountCount = queryCount(glAccountsQuery);
    const vendorCount = queryCount(vendorsQuery);
    const storeLocationCount = queryCount(storeLocationsQuery);
    const rateContractCount = queryCount(rateContractsQuery);
    const storeCatalogCount = queryCount(storeCatalogQuery);
    const assetCategoryCount = queryCount(assetCategoriesQuery);
    const storeCategoryCount = queryCount(storeCategoriesQuery);
    const consentTemplateCount = queryCount(consentTemplatesQuery);
    const documentTemplateCount = queryCount(documentTemplatesQuery);
    const dietTemplateCount = queryCount(dietTemplatesQuery);
    const orderSetTemplateCount = queryCount(orderSetTemplatesQuery);
    const roleCount = queryCount(rolesQuery);
    const printTemplateCount = queryCount(printTemplatesQuery);
    const prescriptionTemplateCount = queryCount(prescriptionTemplatesQuery);
    const labReportTemplateCount = queryCount(labReportTemplatesQuery);
    const dischargeTemplateCount = queryCount(dischargeTemplatesQuery);
    const communicationTemplateCount = queryCount(communicationTemplatesQuery);
    const dltTemplateCount = queryCount(dltTemplatesQuery);
    const specialtyTemplateCount = queryCount(specialtyTemplatesQuery);

    return [
      item({
        key: "drugs",
        label: "Drugs",
        module: "Pharmacy",
        usedBy: "Prescribing, dispensing, billing, NDPS, stock",
        owner: "Pharmacy catalog",
        actionHref: "/pharmacy?tab=catalog",
        actionLabel: "Open catalog",
        icon: <IconPill size={24} />,
        count: drugCount,
        canView: canViewPharmacyCatalog,
        isError: queryError(pharmacyQuery),
        location: "module",
      }),
      item({
        key: "facilities",
        label: "Facilities",
        module: "Hospital",
        usedBy: "Tenant scope, access, locations, departments, reporting",
        owner: "Settings",
        actionHref: "/admin/settings#facilities",
        actionLabel: "Open facilities",
        icon: <IconBuildingCommunity size={24} />,
        count: facilityCount,
        canView: canViewFacilities,
        isError: queryError(facilityQuery),
        location: "settings",
      }),
      item({
        key: "services",
        label: "Services",
        module: "Billing",
        usedBy: "OPD, IPD, OT, lab, packages, invoices",
        owner: "Settings",
        actionHref: "/admin/settings#services",
        actionLabel: "Open services",
        icon: <IconReceipt size={24} />,
        count: serviceCount,
        canView: canViewServices,
        isError: queryError(servicesQuery),
        location: "settings",
      }),
      item({
        key: "modules",
        label: "Modules",
        module: "Platform",
        usedBy: "Drawer visibility, module rollout, tenant enablement",
        owner: "Settings",
        actionHref: "/admin/settings#modules",
        actionLabel: "Open modules",
        icon: <IconMedicalCross size={24} />,
        count: moduleCount,
        canView: canViewModules,
        isError: queryError(modulesQuery),
        location: "settings",
      }),
      item({
        key: "sequences",
        label: "Number sequences",
        module: "Platform",
        usedBy: "UHID, invoices, lab orders, admissions, documents",
        owner: "Settings",
        actionHref: "/admin/settings#sequences",
        actionLabel: "Open sequences",
        icon: <IconHash size={24} />,
        count: sequenceCount,
        canView: canViewSequences,
        isError: queryError(sequencesQuery),
        location: "settings",
      }),
      item({
        key: "bed-types",
        label: "Bed types",
        module: "IPD",
        usedBy: "Bed mapping, transfer impact, room rent",
        owner: "Settings",
        actionHref: "/admin/settings#bed-types",
        actionLabel: "Open bed types",
        icon: <IconBed size={24} />,
        count: bedTypeCount,
        canView: canViewBedTypes,
        isError: queryError(bedTypesQuery),
        location: "settings",
      }),
      item({
        key: "ipd-tariffs",
        label: "IPD tariffs",
        module: "IPD",
        usedBy: "Room/day, nursing/day, deposit, transfer charge impact and billing alerts",
        owner: "IPD tariff config",
        actionHref: "/ipd?tab=tariffs",
        actionLabel: "Open tariffs",
        icon: <IconReceipt size={24} />,
        count: ipdTariffCount,
        canView: canViewIpdTariffs,
        isError: queryError(ipdTariffsQuery),
        location: "module",
      }),
      item({
        key: "ipd-wards",
        label: "IPD wards",
        module: "IPD",
        usedBy: "Admissions, bed dashboard, transfers, nursing station and room rent context",
        owner: "IPD module",
        actionHref: "/ipd?tab=wards",
        actionLabel: "Open wards",
        icon: <IconBed size={24} />,
        count: ipdWardCount,
        canView: canViewIpdWards,
        isError: queryError(ipdWardsQuery),
        location: "module",
      }),
      item({
        key: "discharge-templates",
        label: "Discharge templates",
        module: "IPD",
        usedBy: "Discharge summary defaults, finalization, MRD packets",
        owner: "IPD module",
        actionHref: "/ipd",
        actionLabel: "Open IPD",
        icon: <IconFileAnalytics size={24} />,
        count: dischargeTemplateCount,
        canView: canViewDischargeTemplates,
        isError: queryError(dischargeTemplatesQuery),
        location: "module",
      }),
      item({
        key: "tax-categories",
        label: "Tax categories",
        module: "Billing",
        usedBy: "Charge master, invoices, pharmacy sale, returns",
        owner: "Settings",
        actionHref: "/admin/settings#billing",
        actionLabel: "Open billing",
        icon: <IconCash size={24} />,
        count: taxCategoryCount,
        canView: canViewBillingMasters,
        isError: queryError(taxCategoriesQuery),
        location: "settings",
      }),
      item({
        key: "payment-methods",
        label: "Payment methods",
        module: "Billing",
        usedBy: "Receipts, advances, refunds, reconciliation",
        owner: "Settings",
        actionHref: "/admin/settings#billing",
        actionLabel: "Open billing",
        icon: <IconCash size={24} />,
        count: paymentMethodCount,
        canView: canViewBillingMasters,
        isError: queryError(paymentMethodsQuery),
        location: "settings",
      }),
      item({
        key: "charge-master",
        label: "Charge master",
        module: "Billing",
        usedBy: "OPD/IPD/ER/lab/pharmacy billing and package pricing",
        owner: "Billing module",
        actionHref: "/billing?tab=charge-master",
        actionLabel: "Open charge master",
        icon: <IconCash size={24} />,
        count: chargeMasterCount,
        canView: canViewBillingCatalog,
        isError: queryError(chargeMasterQuery),
        location: "module",
      }),
      item({
        key: "billing-packages",
        label: "Billing packages",
        module: "Billing",
        usedBy: "Surgery bundles, health packages, corporate plans",
        owner: "Billing module",
        actionHref: "/billing?tab=packages",
        actionLabel: "Open packages",
        icon: <IconPackage size={24} />,
        count: packageCount,
        canView: canViewBillingCatalog,
        isError: queryError(packagesQuery),
        location: "module",
      }),
      item({
        key: "rate-plans",
        label: "Rate plans",
        module: "Billing",
        usedBy: "TPA/corporate tariffs, class-based rates, overrides",
        owner: "Billing module",
        actionHref: "/billing?tab=rate-plans",
        actionLabel: "Open rate plans",
        icon: <IconReceipt size={24} />,
        count: ratePlanCount,
        canView: canViewBillingCatalog,
        isError: queryError(ratePlansQuery),
        location: "module",
      }),
      item({
        key: "corporates",
        label: "Corporates",
        module: "Billing",
        usedBy: "Corporate billing, employee coverage, receivables",
        owner: "Billing module",
        actionHref: "/billing?tab=corporate",
        actionLabel: "Open corporate",
        icon: <IconBuildingStore size={24} />,
        count: corporateCount,
        canView: canViewCorporateMasters,
        isError: queryError(corporatesQuery),
        location: "module",
      }),
      item({
        key: "tpa-rate-cards",
        label: "TPA rate cards",
        module: "Billing/Insurance",
        usedBy: "Pre-auth, claim pricing, contracted package rates",
        owner: "Billing module",
        actionHref: "/billing?tab=insurance",
        actionLabel: "Open TPA",
        icon: <IconReceipt size={24} />,
        count: tpaRateCardCount,
        canView: canViewCorporateMasters,
        isError: queryError(tpaRateCardsQuery),
        location: "module",
      }),
      item({
        key: "gl-accounts",
        label: "GL accounts",
        module: "Finance",
        usedBy: "Journal posting, bank reconciliation, ERP export",
        owner: "Billing module",
        actionHref: "/billing?tab=journal",
        actionLabel: "Open finance",
        icon: <IconCash size={24} />,
        count: glAccountCount,
        canView: canViewGlAccounts,
        isError: queryError(glAccountsQuery),
        location: "module",
      }),
      item({
        key: "ot-rooms",
        label: "OT rooms",
        module: "OT",
        usedBy: "OT schedule, procedure booking selector, room utilization",
        owner: "OT module",
        actionHref: otRoomsActionHref,
        actionLabel: otRoomsActionLabel,
        icon: <IconScissors size={24} />,
        count: otRoomCount,
        canView: canViewOtRooms,
        isError: queryError(otRoomsQuery),
        location: "module",
      }),
      item({
        key: "tests",
        label: "Lab tests",
        module: "Lab",
        usedBy: "Lab orders, billing, reports, critical values",
        owner: "Lab catalog",
        actionHref: "/lab",
        actionLabel: "Open lab",
        icon: <IconFlask size={24} />,
        count: testCount,
        canView: canViewLabCatalog,
        isError: queryError(labQuery),
        location: "module",
      }),
      item({
        key: "lab-report-templates",
        label: "Lab report templates",
        module: "Lab",
        usedBy: "Report formatting, verification notes, NABL-ready print output",
        owner: "Lab module",
        actionHref: "/lab",
        actionLabel: "Open lab",
        icon: <IconReportMedical size={24} />,
        count: labReportTemplateCount,
        canView: canViewLabReportTemplates,
        isError: queryError(labReportTemplatesQuery),
        location: "module",
      }),
      item({
        key: "procedures",
        label: "Procedures",
        module: "OPD/OT",
        usedBy: "OPD procedures, OT booking, packages, consent",
        owner: "Procedure catalog",
        actionHref: "/opd",
        actionLabel: "Open OPD",
        icon: <IconMedicalCross size={24} />,
        count: procedureCount,
        canView: canViewProcedureCatalog,
        isError: queryError(procedureQuery),
        location: "module",
      }),
      item({
        key: "store-catalog",
        label: "Store catalog",
        module: "Stores",
        usedBy: "Indenting, procurement, issue/return, consumption costing",
        owner: "Indent/Stores module",
        actionHref: "/indent?tab=catalog",
        actionLabel: "Open stores",
        icon: <IconPackage size={24} />,
        count: storeCatalogCount,
        canView: canViewStoreCatalog,
        isError: queryError(storeCatalogQuery),
        location: "module",
      }),
      item({
        key: "store-locations",
        label: "Store locations",
        module: "Stores",
        usedBy: "Multi-store stock, pharmacy stores, procurement receipts",
        owner: "Procurement module",
        actionHref: "/procurement",
        actionLabel: "Open stores",
        icon: <IconBuildingWarehouse size={24} />,
        count: storeLocationCount,
        canView: canViewStoreLocations,
        isError: queryError(storeLocationsQuery),
        location: "module",
      }),
      item({
        key: "vendors",
        label: "Vendors",
        module: "Procurement",
        usedBy: "Purchase orders, GRN, supplier payments, rate comparison",
        owner: "Procurement module",
        actionHref: "/procurement",
        actionLabel: "Open vendors",
        icon: <IconTruckDelivery size={24} />,
        count: vendorCount,
        canView: canViewProcurementVendors,
        isError: queryError(vendorsQuery),
        location: "module",
      }),
      item({
        key: "rate-contracts",
        label: "Rate contracts",
        module: "Procurement",
        usedBy: "Vendor pricing, purchase control, contract validity",
        owner: "Procurement module",
        actionHref: "/procurement",
        actionLabel: "Open contracts",
        icon: <IconFileDescription size={24} />,
        count: rateContractCount,
        canView: canViewRateContracts,
        isError: queryError(rateContractsQuery),
        location: "module",
      }),
      item({
        key: "asset-categories",
        label: "Asset categories",
        module: "Assets/BME",
        usedBy: "Asset register, biomedical equipment, maintenance",
        owner: "Assets module",
        actionHref: "/assets",
        actionLabel: "Open assets",
        icon: <IconBuildingWarehouse size={24} />,
        count: assetCategoryCount,
        canView: canViewAssets,
        isError: queryError(assetCategoriesQuery),
        location: "module",
      }),
      item({
        key: "store-categories",
        label: "Store categories",
        module: "Assets/Stores",
        usedBy: "Consumables, housekeeping, kitchen, camp source control",
        owner: "Assets module",
        actionHref: "/assets",
        actionLabel: "Open assets",
        icon: <IconPackage size={24} />,
        count: storeCategoryCount,
        canView: canViewAssets,
        isError: queryError(storeCategoriesQuery),
        location: "module",
      }),
      item({
        key: "consent-templates",
        label: "Consent templates",
        module: "Consent",
        usedBy: "OPD, IPD, OT, procedure consent and audit",
        owner: "Consent module",
        actionHref: "/consent",
        actionLabel: "Open consents",
        icon: <IconChecklist size={24} />,
        count: consentTemplateCount,
        canView: canViewConsentTemplates,
        isError: queryError(consentTemplatesQuery),
        location: "module",
      }),
      item({
        key: "document-templates",
        label: "Document templates",
        module: "Documents",
        usedBy: "Certificates, letters, print packs, review workflow",
        owner: "Documents module",
        actionHref: "/admin/documents",
        actionLabel: "Open documents",
        icon: <IconFileDescription size={24} />,
        count: documentTemplateCount,
        canView: canViewDocumentTemplates,
        isError: queryError(documentTemplatesQuery),
        location: "module",
      }),
      item({
        key: "mrd-storage",
        label: "MRD storage",
        module: "MRD",
        usedBy: "Case-sheet filing, record issue/return, retention and rack/bin traceability",
        owner: "MRD module",
        actionHref: "/mrd?tab=storage",
        actionLabel: "Open MRD",
        icon: <IconFileDescription size={24} />,
        count: mrdStorageCount,
        canView: canViewMrdStorage,
        isError: queryError(mrdStorageQuery),
        location: "module",
      }),
      item({
        key: "print-templates",
        label: "Print templates",
        module: "Documents",
        usedBy: "Letterhead, prescription pad, invoice, lab report, discharge summary",
        owner: "Settings",
        actionHref: "/admin/settings#print-templates",
        actionLabel: "Open print",
        icon: <IconTemplate size={24} />,
        count: printTemplateCount,
        canView: canViewPrintTemplates,
        isError: queryError(printTemplatesQuery),
        location: "settings",
      }),
      item({
        key: "diet-templates",
        label: "Diet templates",
        module: "Diet kitchen",
        usedBy: "Bedside diet orders, nutrition plans, kitchen prep",
        owner: "Diet kitchen module",
        actionHref: "/diet-kitchen?tab=templates",
        actionLabel: "Open diet",
        icon: <IconClipboardList size={24} />,
        count: dietTemplateCount,
        canView: canViewDietTemplates,
        isError: queryError(dietTemplatesQuery),
        location: "module",
      }),
      item({
        key: "order-set-templates",
        label: "Order set templates",
        module: "Clinical",
        usedBy: "OPD/IPD protocols, lab/drug/radiology/diet baskets",
        owner: "Order sets module",
        actionHref: "/order-sets",
        actionLabel: "Open order sets",
        icon: <IconClipboardList size={24} />,
        count: orderSetTemplateCount,
        canView: canViewOrderSetTemplates,
        isError: queryError(orderSetTemplatesQuery),
        location: "module",
      }),
      item({
        key: "specialty-templates",
        label: "Specialty templates",
        module: "Specialty",
        usedBy: "Dialysis, chemotherapy, procedure records, specialty notes",
        owner: "Specialty module",
        actionHref: "/specialty/other",
        actionLabel: "Open specialty",
        icon: <IconFileDescription size={24} />,
        count: specialtyTemplateCount,
        canView: canViewSpecialtyTemplates,
        isError: queryError(specialtyTemplatesQuery),
        location: "module",
      }),
      item({
        key: "communication-templates",
        label: "Communication templates",
        module: "Communications",
        usedBy: "SMS, WhatsApp, email, patient notifications, reminders",
        owner: "Communications module",
        actionHref: "/communications",
        actionLabel: "Open comms",
        icon: <IconMessageCircle size={24} />,
        count: communicationTemplateCount,
        canView: canViewCommConfig,
        isError: queryError(communicationTemplatesQuery),
        location: "module",
      }),
      item({
        key: "dlt-templates",
        label: "DLT templates",
        module: "Communications",
        usedBy: "India SMS compliance, OTP/reminder sender IDs, template IDs",
        owner: "Communications module",
        actionHref: "/communications",
        actionLabel: "Open DLT",
        icon: <IconBell size={24} />,
        count: dltTemplateCount,
        canView: canViewCommConfig,
        isError: queryError(dltTemplatesQuery),
        location: "module",
      }),
      item({
        key: "drug-interactions",
        label: "Drug interactions",
        module: "Clinical safety",
        usedBy: "Prescription safety, allergy checks, CDS warnings",
        owner: "Settings",
        actionHref: "/admin/settings#drug-interactions",
        actionLabel: "Open rules",
        icon: <IconAlertTriangle size={24} />,
        count: drugInteractionCount,
        canView: canViewClinicalRules,
        isError: queryError(drugInteractionsQuery),
        location: "settings",
      }),
      item({
        key: "critical-values",
        label: "Critical value rules",
        module: "Lab",
        usedBy: "LIS alerts, result validation, escalation",
        owner: "Settings",
        actionHref: "/admin/settings#critical-values",
        actionLabel: "Open rules",
        icon: <IconAlertCircle size={24} />,
        count: criticalValueRuleCount,
        canView: canViewClinicalRules,
        isError: queryError(criticalValueRulesQuery),
        location: "settings",
      }),
      item({
        key: "clinical-protocols",
        label: "Clinical protocols",
        module: "CDS",
        usedBy: "Care pathways, alerts, treatment guidance",
        owner: "Settings",
        actionHref: "/admin/settings#clinical-protocols",
        actionLabel: "Open protocols",
        icon: <IconHeartbeat size={24} />,
        count: clinicalProtocolCount,
        canView: canViewClinicalRules,
        isError: queryError(clinicalProtocolsQuery),
        location: "settings",
      }),
      item({
        key: "consultation-templates",
        label: "Consultation templates",
        module: "OPD",
        usedBy: "Doctor notes, complaints, diagnosis and plan presets",
        owner: "Settings",
        actionHref: "/admin/settings#consultation-templates",
        actionLabel: "Open templates",
        icon: <IconStethoscope size={24} />,
        count: consultationTemplateCount,
        canView: canViewConsultationTemplates,
        isError: queryError(consultationTemplatesQuery),
        location: "settings",
      }),
      item({
        key: "prescription-templates",
        label: "Prescription templates",
        module: "OPD/Pharmacy",
        usedBy: "Repeat prescription sets, quick prescribing, pharmacy order flow",
        owner: "OPD module",
        actionHref: "/opd",
        actionLabel: "Open OPD",
        icon: <IconIdBadge2 size={24} />,
        count: prescriptionTemplateCount,
        canView: canViewPrescriptionTemplates,
        isError: queryError(prescriptionTemplatesQuery),
        location: "module",
      }),
      item({
        key: "departments",
        label: "Departments",
        module: "Hospital",
        usedBy: "OPD/IPD routing, doctor roster, operating hours, revenue split",
        owner: "Settings",
        actionHref: "/admin/settings#departments",
        actionLabel: "Open departments",
        icon: <IconSitemap size={24} />,
        count: deptCount,
        canView: canViewDepartments,
        isError: queryError(deptQuery),
        location: "settings",
      }),
      item({
        key: "doctors",
        label: "Doctors",
        module: "Clinical access",
        usedBy: "OPD/IPD/OT assignment, signatures, schedules, notes and approvals",
        owner: "Admin access",
        actionHref: "/admin/doctors",
        actionLabel: "Open doctors",
        icon: <IconStethoscope size={24} />,
        count: doctorCount,
        canView: canViewDoctors,
        isError: queryError(doctorQuery),
        location: "module",
      }),
      item({
        key: "users",
        label: "Users",
        module: "Access",
        usedBy: "Doctors, nurses, billing, approvals, audit",
        owner: "Admin access",
        actionHref: "/admin/users",
        actionLabel: "Open users",
        icon: <IconUsers size={24} />,
        count: userCount,
        canView: canViewUsers,
        isError: queryError(userQuery),
        location: "module",
      }),
      item({
        key: "roles",
        label: "Roles & approvals",
        module: "Access",
        usedBy: "Permissions, elevated access, approvals, break-glass review",
        owner: "Admin access",
        actionHref: "/admin/roles",
        actionLabel: "Open roles",
        icon: <IconUserShield size={24} />,
        count: roleCount,
        canView: canViewRoles,
        isError: queryError(rolesQuery),
        location: "module",
      }),
      item({
        key: "locations",
        label: "Locations",
        module: "Facility",
        usedBy: "Campus, building, floor, rooms, beds, OT",
        owner: "Settings",
        actionHref: "/admin/settings#locations",
        actionLabel: "Open locations",
        icon: <IconMapPin size={24} />,
        count: locationCount,
        canView: canViewLocations,
        isError: queryError(locationQuery),
        location: "settings",
      }),
      item({
        key: "clinical-masters",
        label: "Clinical masters",
        module: "Clinical",
        usedBy: "Registration demographics, relatives, staff workflows",
        owner: "Settings",
        actionHref: "/admin/settings#clinical-masters",
        actionLabel: "Open clinical",
        icon: <IconStethoscope size={24} />,
        count: clinicalMasterCount,
        canView: canViewClinicalMasters,
        isError: clinicalMasterError,
        location: "settings",
      }),
      item({
        key: "insurance-providers",
        label: "Insurance / TPA",
        module: "Billing",
        usedBy: "Registration, claim routing, pre-auth, billing",
        owner: "Settings",
        actionHref: "/admin/settings#clinical-masters",
        actionLabel: "Open masters",
        icon: <IconReceipt size={24} />,
        count: insuranceProviderCount,
        canView: canViewClinicalMasters,
        isError: queryError(insuranceProvidersQuery),
        location: "settings",
      }),
    ];
  }, [
    queries,
    canViewFacilities,
    canViewPharmacyCatalog,
    canViewLabCatalog,
    canViewProcedureCatalog,
    canViewClinicalRules,
    canViewConsultationTemplates,
    canViewDepartments,
    canViewUsers,
    canViewDoctors,
    canViewRoles,
    canViewLocations,
    canViewServices,
    canViewModules,
    canViewSequences,
    canViewBedTypes,
    canViewBillingMasters,
    canViewPrintTemplates,
    canViewBillingCatalog,
    canViewCorporateMasters,
    canViewGlAccounts,
    canViewProcurementVendors,
    canViewStoreLocations,
    canViewRateContracts,
    canViewStoreCatalog,
    canViewAssets,
    canViewConsentTemplates,
    canViewDocumentTemplates,
    canViewDietTemplates,
    canViewOrderSetTemplates,
    canViewClinicalMasters,
    canViewPrescriptionTemplates,
    canViewLabReportTemplates,
    canViewDischargeTemplates,
    canViewIpdWards,
    canViewCommConfig,
    canViewSpecialtyTemplates,
    canViewIpdTariffs,
    canViewOtRooms,
    otRoomsActionHref,
    otRoomsActionLabel,
    canViewMrdStorage,
  ]);

  const needsSetupCount = useMemo(
    () => masterItems.filter((item) => item.needsSetup).length,
    [masterItems],
  );
  const readyCount = useMemo(
    () => masterItems.filter((item) => item.status === "ready").length,
    [masterItems],
  );
  const errorCount = useMemo(
    () => masterItems.filter((item) => item.status === "error").length,
    [masterItems],
  );
  const restrictedCount = useMemo(
    () => masterItems.filter((item) => item.status === "restricted").length,
    [masterItems],
  );
  const moduleOwnedCount = useMemo(
    () => masterItems.filter((item) => item.location === "module").length,
    [masterItems],
  );
  const settingsOwnedCount = useMemo(
    () => masterItems.filter((item) => item.location === "settings").length,
    [masterItems],
  );
  const settingsOwnedReadyCount = useMemo(
    () =>
      masterItems.filter((item) => item.location === "settings" && item.status === "ready").length,
    [masterItems],
  );
  const settingsOwnedNeedsSetupCount = useMemo(
    () =>
      masterItems.filter(
        (item) =>
          item.location === "settings" &&
          (item.status === "needs_setup" || item.status === "error"),
      ).length,
    [masterItems],
  );
  const moduleOwnedNeedsSetupCount = useMemo(
    () =>
      masterItems.filter(
        (item) =>
          item.location === "module" && (item.status === "needs_setup" || item.status === "error"),
      ).length,
    [masterItems],
  );
  const missingMasterCount = MASTER_DATA_GAPS.length;
  const missingP0Count = MASTER_DATA_GAPS.filter((item) => gapPriority(item) === "P0").length;
  const missingSettingsTargetCount = MASTER_DATA_GAPS.filter(
    (item) => item.targetType === "settings" || item.targetType === "governance",
  ).length;
  const settingsOwnedAttentionItems = useMemo(
    () =>
      masterItems
        .filter(
          (item) =>
            item.location === "settings" &&
            (item.status === "needs_setup" || item.status === "error"),
        )
        .slice(0, 5),
    [masterItems],
  );
  const moduleOwnedAttentionItems = useMemo(
    () =>
      masterItems
        .filter(
          (item) =>
            item.location === "module" &&
            (item.status === "needs_setup" || item.status === "error"),
        )
        .slice(0, 5),
    [masterItems],
  );
  const p0GapItems = useMemo(
    () => MASTER_DATA_GAPS.filter((item) => gapPriority(item) === "P0").slice(0, 8),
    [],
  );
  const visibleMasterItems = useMemo(
    () => masterItems.filter((item) => item.status !== "restricted"),
    [masterItems],
  );
  const allMasterDataReady = useMemo(
    () =>
      visibleMasterItems.length > 0 && visibleMasterItems.every((item) => item.status === "ready"),
    [visibleMasterItems],
  );
  const filteredMasterItems = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    if (filter === "missing") return [];
    return masterItems.filter((item) => {
      const matchesFilter =
        filter === "all" ||
        item.status === filter ||
        (filter === "settings" && item.location === "settings") ||
        (filter === "module" && item.location === "module");
      if (!matchesFilter) return false;
      if (!searchText) return true;
      return [item.label, item.module, item.usedBy, item.owner, item.actionLabel]
        .join(" ")
        .toLowerCase()
        .includes(searchText);
    });
  }, [filter, masterItems, search]);
  const filteredGapItems = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    if (filter !== "all" && filter !== "missing" && filter !== "module" && filter !== "settings") {
      return [];
    }
    return MASTER_DATA_GAPS.filter((item) => {
      const matchesFilter =
        filter === "all" ||
        filter === "missing" ||
        (filter === "module" && item.targetType === "module") ||
        (filter === "settings" &&
          (item.targetType === "settings" || item.targetType === "governance"));
      if (!matchesFilter) return false;
      if (!searchText) return true;
      return [item.label, item.module, item.requiredFor, item.targetOwner, item.actionLabel]
        .join(" ")
        .toLowerCase()
        .includes(searchText);
    });
  }, [filter, search]);

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading master data status...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Master Data Configuration
        </Text>
        {needsSetupCount > 0 && (
          <Badge color="orange" variant="light" size="lg">
            {needsSetupCount} items need setup
          </Badge>
        )}
        {moduleOwnedCount > 0 && (
          <Badge color="blue" variant="light" size="lg">
            {moduleOwnedCount} outside settings
          </Badge>
        )}
        {missingMasterCount > 0 && (
          <Badge color="red" variant="light" size="lg">
            {missingMasterCount} not wired
          </Badge>
        )}
      </Group>

      <SimpleGrid cols={{ base: 2, md: 5 }} spacing="sm">
        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed">
            Ready
          </Text>
          <Text fw={800} size="xl">
            {readyCount}
          </Text>
        </Card>
        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed">
            Needs setup
          </Text>
          <Text fw={800} size="xl" c={needsSetupCount > 0 ? "danger" : undefined}>
            {needsSetupCount}
          </Text>
        </Card>
        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed">
            Check failed
          </Text>
          <Text fw={800} size="xl" c={errorCount > 0 ? "orange" : undefined}>
            {errorCount}
          </Text>
        </Card>
        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed">
            No access
          </Text>
          <Text fw={800} size="xl">
            {restrictedCount}
          </Text>
        </Card>
        <Card withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed">
            Not wired
          </Text>
          <Text fw={800} size="xl" c="danger">
            {missingMasterCount}
          </Text>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 4 }} spacing="sm">
        <Card withBorder padding="md" radius="md">
          <Stack gap="sm" h="100%">
            <Group justify="space-between">
              <ThemeIcon color="teal" variant="light" radius="xl">
                <IconChecklist size={18} />
              </ThemeIcon>
              <Badge color="teal" variant="light">
                {settingsOwnedCount}
              </Badge>
            </Group>
            <div style={{ flex: 1 }}>
              <Text fw={700}>Editable in Settings</Text>
              <Text size="sm" c="dimmed">
                {settingsOwnedReadyCount} ready / {settingsOwnedNeedsSetupCount} need attention.
              </Text>
            </div>
            <Button size="xs" variant="light" onClick={() => setFilter("settings")}>
              Show Settings masters
            </Button>
          </Stack>
        </Card>

        <Card withBorder padding="md" radius="md">
          <Stack gap="sm" h="100%">
            <Group justify="space-between">
              <ThemeIcon color="blue" variant="light" radius="xl">
                <IconBuildingWarehouse size={18} />
              </ThemeIcon>
              <Badge color="blue" variant="light">
                {moduleOwnedCount}
              </Badge>
            </Group>
            <div style={{ flex: 1 }}>
              <Text fw={700}>Owned by modules</Text>
              <Text size="sm" c="dimmed">
                {moduleOwnedNeedsSetupCount} module catalogs are empty or failing.
              </Text>
            </div>
            <Button size="xs" variant="light" onClick={() => setFilter("module")}>
              Show module masters
            </Button>
          </Stack>
        </Card>

        <Card withBorder padding="md" radius="md">
          <Stack gap="sm" h="100%">
            <Group justify="space-between">
              <ThemeIcon color="orange" variant="light" radius="xl">
                <IconAlertTriangle size={18} />
              </ThemeIcon>
              <Badge color="orange" variant="light">
                {missingMasterCount}
              </Badge>
            </Group>
            <div style={{ flex: 1 }}>
              <Text fw={700}>Not wired yet</Text>
              <Text size="sm" c="dimmed">
                {missingP0Count} P0 items and {missingSettingsTargetCount} shared/setup masters need
                screens or clear ownership.
              </Text>
            </div>
            <Button size="xs" variant="light" color="orange" onClick={() => setFilter("missing")}>
              Show missing masters
            </Button>
          </Stack>
        </Card>

        <Card withBorder padding="md" radius="md">
          <Stack gap="sm" h="100%">
            <Group justify="space-between">
              <ThemeIcon color="grape" variant="light" radius="xl">
                <IconSettings size={18} />
              </ThemeIcon>
              <Badge color="grape" variant="light">
                {SETTINGS_NON_MASTER_PANELS.length}
              </Badge>
            </Group>
            <div style={{ flex: 1 }}>
              <Text fw={700}>Not master data</Text>
              <Text size="sm" c="dimmed">
                {SETTINGS_RETIRED_PANELS.length} duplicate settings panels have been moved or
                retired.
              </Text>
            </div>
            <Button component="a" href="#settings-support-panels" size="xs" variant="light">
              Show config panels
            </Button>
          </Stack>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={700}>Master setup worklist</Text>
              <Text size="sm" c="dimmed">
                Start here: missing P0 masters first, then empty Settings masters, then module-owned
                catalogs.
              </Text>
            </div>
            <Badge color="red" variant="light">
              {missingP0Count} P0 gaps
            </Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
            <Stack gap="xs">
              <Group gap="xs">
                <Badge color="red" variant="light">
                  Missing P0
                </Badge>
                <Text size="xs" c="dimmed">
                  needs screens or ownership
                </Text>
              </Group>
              {p0GapItems.map((item) => (
                <Card key={item.key} withBorder padding="sm" radius="sm">
                  <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Text size="sm" fw={700}>
                        {item.label}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {item.targetOwner}
                      </Text>
                    </Stack>
                    <Button component="a" href={item.actionHref} size="compact-xs" variant="subtle">
                      Open
                    </Button>
                  </Group>
                </Card>
              ))}
            </Stack>

            <Stack gap="xs">
              <Group gap="xs">
                <Badge color="teal" variant="light">
                  Settings-owned
                </Badge>
                <Text size="xs" c="dimmed">
                  editable here
                </Text>
              </Group>
              {settingsOwnedAttentionItems.length > 0 ? (
                settingsOwnedAttentionItems.map((item) => (
                  <Card key={item.key} withBorder padding="sm" radius="sm">
                    <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
                      <Stack gap={2} style={{ flex: 1 }}>
                        <Text size="sm" fw={700}>
                          {item.label}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {masterStatusLabel(item.status)} · {item.owner}
                        </Text>
                      </Stack>
                      <Button
                        component="a"
                        href={item.actionHref}
                        size="compact-xs"
                        variant="subtle"
                      >
                        Open
                      </Button>
                    </Group>
                  </Card>
                ))
              ) : (
                <Card withBorder padding="sm" radius="sm">
                  <Text size="sm" c="dimmed">
                    No empty Settings-owned masters in your visible permission scope.
                  </Text>
                </Card>
              )}
            </Stack>

            <Stack gap="xs">
              <Group gap="xs">
                <Badge color="blue" variant="light">
                  Module-owned
                </Badge>
                <Text size="xs" c="dimmed">
                  configure in owning module
                </Text>
              </Group>
              {moduleOwnedAttentionItems.length > 0 ? (
                moduleOwnedAttentionItems.map((item) => (
                  <Card key={item.key} withBorder padding="sm" radius="sm">
                    <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
                      <Stack gap={2} style={{ flex: 1 }}>
                        <Text size="sm" fw={700}>
                          {item.label}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {masterStatusLabel(item.status)} · {item.owner}
                        </Text>
                      </Stack>
                      <Button
                        component="a"
                        href={item.actionHref}
                        size="compact-xs"
                        variant="subtle"
                      >
                        Open
                      </Button>
                    </Group>
                  </Card>
                ))
              ) : (
                <Card withBorder padding="sm" radius="sm">
                  <Text size="sm" c="dimmed">
                    No empty module-owned catalogs in your visible permission scope.
                  </Text>
                </Card>
              )}
            </Stack>
          </SimpleGrid>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
        {SETTINGS_SCOPE_NOTES.map((note) => (
          <Card key={note.label} withBorder padding="sm" radius="md">
            <Group gap="xs" mb={4}>
              <Badge color={note.color} variant="light">
                {note.label}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              {note.text}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={700}>Recommended setup path</Text>
              <Text size="sm" c="dimmed">
                Follow this order before treating module workflows as production-ready.
              </Text>
            </div>
            <Badge color="teal" variant="light">
              RFC onboarding flow
            </Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 5 }} spacing="xs">
            {MASTER_SETUP_PATH.map((step, index) => (
              <div
                key={step}
                style={{
                  border: "1px solid var(--mb-border-subtle)",
                  borderRadius: "var(--mantine-radius-sm)",
                  padding: "var(--mantine-spacing-sm)",
                }}
              >
                <Badge size="xs" variant="light" color="teal">
                  Step {index + 1}
                </Badge>
                <Text size="sm" mt={6}>
                  {step}
                </Text>
              </div>
            ))}
          </SimpleGrid>
        </Stack>
      </Card>

      <Group align="flex-end" gap="sm">
        <TextInput
          aria-label="Search master data"
          placeholder="Search masters, modules, owners"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          style={{ flex: 1, minWidth: 260 }}
        />
        <SegmentedControl
          value={filter}
          onChange={(value) => {
            if (isMasterDataFilter(value)) setFilter(value);
          }}
          data={MASTER_DATA_FILTER_OPTIONS}
        />
      </Group>

      {filteredGapItems.length > 0 && (
        <Stack gap="md">
          <Alert color="orange" variant="light" icon={<IconAlertTriangle size={18} />}>
            Missing coverage is shown before the API-backed card wall so setup gaps are not buried
            under modules that already have screens.
          </Alert>
          <Group justify="space-between">
            <div>
              <Text fw={700} size="lg">
                Missing master coverage
              </Text>
              <Text size="sm" c="dimmed">
                Operational masters requested by OPD, IPD, pharmacy, billing, camp, emergency,
                nursing, OT, assets, diet and compliance workflows.
              </Text>
            </div>
            <Group gap="xs">
              <Badge color="red" variant="light" size="lg">
                {missingP0Count} P0
              </Badge>
              <Badge color="orange" variant="light" size="lg">
                {filteredGapItems.length} shown
              </Badge>
            </Group>
          </Group>
          <Grid gap="md">
            {filteredGapItems.map((item) => (
              <Grid.Col key={item.key} span={{ base: 12, md: 6, lg: 4 }}>
                <Card withBorder padding="md" radius="md" h="100%">
                  <Stack gap="sm" h="100%">
                    <Group justify="space-between" align="flex-start">
                      <ThemeIcon size="xl" radius="xl" color="orange" variant="light">
                        {item.icon}
                      </ThemeIcon>
                      <Badge color="orange" variant="light">
                        Not wired
                      </Badge>
                    </Group>
                    <Group gap={6}>
                      <Badge color={gapPriorityColor(gapPriority(item))} variant="light">
                        {gapPriority(item)}
                      </Badge>
                      <Badge color={gapTargetTypeColor(item.targetType)} variant="light">
                        {gapTargetTypeLabel(item.targetType)}
                      </Badge>
                    </Group>
                    <div>
                      <Text fw={700}>{item.label}</Text>
                      <Text size="xs" c="dimmed">
                        {item.module}
                      </Text>
                    </div>
                    <Text size="sm" style={{ flex: 1 }}>
                      {item.requiredFor}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Target owner: {item.targetOwner}
                    </Text>
                    <Button component="a" href={item.actionHref} size="xs" variant="light">
                      {item.actionLabel}
                    </Button>
                  </Stack>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        </Stack>
      )}

      {filter !== "missing" && filteredMasterItems.length === 0 ? (
        <Card withBorder padding="lg" radius="md">
          <Text c="dimmed" ta="center">
            {filteredGapItems.length > 0
              ? "No API-backed master-data item matches the current filter."
              : "No master-data item matches the current filter."}
          </Text>
        </Card>
      ) : filter !== "missing" ? (
        <Grid gap="md">
          {filteredMasterItems.map((item) => (
            <Grid.Col key={item.key} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
              <Card
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
                style={{
                  borderColor: item.needsSetup
                    ? "var(--mb-danger-accent)"
                    : "var(--mb-border-subtle)",
                  height: "100%",
                }}
              >
                <Stack gap="sm" h="100%">
                  <Group justify="space-between">
                    <ThemeIcon
                      size="xl"
                      radius="xl"
                      variant="light"
                      color={masterStatusColor(item.status)}
                    >
                      {item.icon}
                    </ThemeIcon>
                    <Badge color={masterStatusColor(item.status)} variant="light" size="sm">
                      {masterStatusLabel(item.status)}
                    </Badge>
                  </Group>

                  <div>
                    <Text size="lg" fw={700}>
                      {masterCountText(item)}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {item.label}
                    </Text>
                  </div>

                  <Stack gap={2} style={{ flex: 1 }}>
                    <Group gap={6}>
                      <Badge
                        size="xs"
                        variant="light"
                        color={item.location === "module" ? "blue" : "gray"}
                      >
                        {item.location === "module" ? "Module-owned" : "Settings-owned"}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {item.module}
                      </Text>
                    </Group>
                    <Text size="xs">{item.usedBy}</Text>
                    <Text size="xs" c={item.location === "module" ? "orange" : "dimmed"}>
                      Owner: {item.owner}
                    </Text>
                  </Stack>

                  <Group justify="space-between" gap="xs">
                    <Button
                      component="a"
                      href={item.actionHref}
                      size="xs"
                      variant="light"
                      disabled={item.status === "restricted"}
                    >
                      {item.actionLabel}
                    </Button>
                    {item.needsSetup && (
                      <Group gap={4}>
                        <IconAlertCircle size={14} color="var(--mantine-color-red-6)" />
                        <Text size="xs" c="danger">
                          Empty
                        </Text>
                      </Group>
                    )}
                  </Group>
                </Stack>
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      ) : null}

      {allMasterDataReady && missingMasterCount === 0 && (
        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          style={{ background: "var(--mb-accent-gradient-soft)" }}
        >
          <Group gap="md">
            <ThemeIcon size="xl" radius="xl" color="success" variant="light">
              <IconCheck size={28} />
            </ThemeIcon>
            <div style={{ flex: 1 }}>
              <Text fw={600} size="md">
                All master data configured
              </Text>
              <Text size="sm" c="dimmed">
                Your system has all essential master data set up and ready to use.
              </Text>
            </div>
          </Group>
        </Card>
      )}

      <Card withBorder padding="md" radius="md" id="settings-support-panels">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={700}>Advanced/support panels, not daily master data</Text>
              <Text size="sm" c="dimmed">
                These panels stay available, but they are configuration, integrations, checks or
                cleanup notes. They should not be treated as missing operational masters.
              </Text>
            </div>
            <Badge color="grape" variant="light">
              {SETTINGS_NON_MASTER_PANELS.length} config panels
            </Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="xs">
            {SETTINGS_NON_MASTER_PANELS.map((panel) => (
              <div
                key={panel.key}
                style={{
                  border: "1px solid var(--mb-border-subtle)",
                  borderRadius: "var(--mantine-radius-sm)",
                  padding: "var(--mantine-spacing-sm)",
                }}
              >
                <Group align="flex-start" gap="sm" wrap="nowrap">
                  <ThemeIcon color="grape" variant="light" radius="xl">
                    {panel.icon}
                  </ThemeIcon>
                  <Stack gap={4} style={{ flex: 1 }}>
                    <Text fw={700} size="sm">
                      {panel.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {panel.purpose}
                    </Text>
                    <Button
                      component="a"
                      href={panel.actionHref}
                      size="compact-xs"
                      variant="subtle"
                    >
                      Open
                    </Button>
                  </Stack>
                </Group>
              </div>
            ))}
          </SimpleGrid>

          <Group justify="space-between" align="flex-start" mt="sm">
            <div>
              <Text fw={700}>Settings cleanup decisions</Text>
              <Text size="sm" c="dimmed">
                Ownership map for panels that looked unused, duplicated or misplaced.
              </Text>
            </div>
            <Badge color="teal" variant="light">
              {SETTINGS_CLEANUP_DECISIONS.length} decisions
            </Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
            {SETTINGS_CLEANUP_DECISIONS.map((panel) => (
              <div
                key={panel.key}
                style={{
                  border: "1px solid var(--mb-border-subtle)",
                  borderRadius: "var(--mantine-radius-sm)",
                  padding: "var(--mantine-spacing-sm)",
                }}
              >
                <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                  <Stack gap={4} style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Text fw={700} size="sm">
                        {panel.label}
                      </Text>
                      <Badge size="xs" color={settingsCleanupColor(panel.status)} variant="light">
                        {panel.decision}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {panel.reason}
                    </Text>
                  </Stack>
                  <Button component="a" href={panel.actionHref} size="compact-xs" variant="subtle">
                    {panel.actionLabel}
                  </Button>
                </Group>
              </div>
            ))}
          </SimpleGrid>

          <Group justify="space-between" align="flex-start" mt="sm">
            <div>
              <Text fw={700}>Retired or moved settings panels</Text>
              <Text size="sm" c="dimmed">
                These duplicate entries should not come back as separate Settings tabs.
              </Text>
            </div>
            <Badge color="gray" variant="light">
              {SETTINGS_RETIRED_PANELS.length} cleaned up
            </Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xs">
            {SETTINGS_RETIRED_PANELS.map((panel) => (
              <div
                key={panel.label}
                style={{
                  border: "1px solid var(--mb-border-subtle)",
                  borderRadius: "var(--mantine-radius-sm)",
                  padding: "var(--mantine-spacing-sm)",
                }}
              >
                <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                  <Stack gap={4} style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Text fw={700} size="sm">
                        {panel.label}
                      </Text>
                      <Badge size="xs" color="gray" variant="light">
                        {panel.status}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {panel.reason}
                    </Text>
                  </Stack>
                  <Button component="a" href={panel.actionHref} size="compact-xs" variant="subtle">
                    {panel.actionLabel}
                  </Button>
                </Group>
              </div>
            ))}
          </SimpleGrid>
        </Stack>
      </Card>
    </Stack>
  );
}

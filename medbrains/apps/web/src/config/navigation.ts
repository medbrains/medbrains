import {
  IconAmbulance,
  IconAppWindow,
  IconBabyCarriage,
  IconBed,
  IconBrain,
  IconBuildingFactory2,
  IconCalendar,
  IconCalendarStats,
  IconChartBar,
  IconClipboardCheck,
  IconDashboard,
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
  IconRadioactive,
  IconReceipt,
  IconReport,
  IconReportMedical,
  IconScale,
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
  children?: NavItemConfig[];
}

export interface NavGroupConfig {
  key: string;
  items: NavItemConfig[];
}

// ── Icon Map ──

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; stroke?: number }>> = {
  IconAmbulance,
  IconAppWindow,
  IconMessage,
  IconBed,
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
  IconRadioactive,
  IconReceipt,
  IconReport,
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
};

export function resolveIcon(name: string, size = 20, stroke = 1.5): ReactNode {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return createElement(Icon, { size, stroke });
}

// ── Nav Groups ──

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
      },
      {
        i18nKey: "appointments",
        path: "/opd/appointments",
        icon: "IconCalendar",
        requiredPermission: "opd.appointment.list",
      },
      {
        i18nKey: "emergency",
        path: "/emergency",
        icon: "IconUrgent",
        requiredPermission: "emergency.visits.list",
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
      { i18nKey: "ipd", path: "/ipd", icon: "IconBed", requiredPermission: "ipd.admissions.list" },
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
      { i18nKey: "ot", path: "/ot", icon: "IconScissors", requiredPermission: "ot.bookings.list" },
      {
        i18nKey: "dietKitchen",
        path: "/diet-kitchen",
        icon: "IconToolsKitchen2",
        requiredPermission: "diet.orders.list",
      },
      {
        i18nKey: "bedsidePortal",
        path: "/bedside-portal",
        icon: "IconDeviceTablet",
        requiredPermission: "bedside.view",
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
        i18nKey: "bme",
        path: "/bme",
        icon: "IconDeviceDesktopAnalytics",
        requiredPermission: "bme.equipment.list",
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
      { i18nKey: "camp", path: "/camp", icon: "IconFirstAidKit", requiredPermission: "camp.list" },
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
        requiredPermission: "specialty.palliative.dnr.list",
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
        requiredPermission: "admin.users.list",
        children: [
          {
            i18nKey: "users",
            path: "/admin/users",
            icon: "IconUserCog",
            requiredPermission: "admin.users.list",
          },
          {
            i18nKey: "roles",
            path: "/admin/roles",
            icon: "IconUserShield",
            requiredPermission: "admin.roles.list",
          },
          {
            i18nKey: "settings",
            path: "/admin/settings",
            icon: "IconSettings",
            requiredPermission: "admin.settings.general.manage",
          },
          {
            i18nKey: "formBuilder",
            path: "/admin/form-builder",
            icon: "IconForms",
            requiredPermission: "admin.form_builder.list",
          },
          {
            i18nKey: "dashboardBuilder",
            path: "/admin/dashboard-builder",
            icon: "IconLayoutDashboard",
            requiredPermission: "admin.dashboard_builder.list",
          },
          {
            i18nKey: "integrationHub",
            path: "/admin/integration-hub",
            icon: "IconPlug",
            requiredPermission: "integration.list",
          },
          {
            i18nKey: "screenBuilder",
            path: "/admin/screen-builder",
            icon: "IconLayoutDashboard",
            requiredPermission: "admin.screen_builder.list",
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
        ],
      },
    ],
  },
];

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

  return labels;
}

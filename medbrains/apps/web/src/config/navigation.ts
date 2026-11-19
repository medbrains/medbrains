import { APP_SCREENS, type AppScreen, BRICK_MANIFESTS } from "@medbrains/types";
import {
  IconAmbulance,
  IconAppWindow,
  IconBabyCarriage,
  IconBed,
  IconBinaryTree,
  IconBoxSeam,
  IconBrain,
  IconBuildingFactory2,
  IconBuildingHospital,
  IconBuildingWarehouse,
  IconCalendar,
  IconCalendarStats,
  IconChartBar,
  IconChecklist,
  IconClipboardCheck,
  IconCpu,
  IconDashboard,
  IconDental,
  IconDeviceDesktop,
  IconDeviceDesktopAnalytics,
  IconDeviceMobileMessage,
  IconDeviceTablet,
  IconDoorEnter,
  IconDroplet,
  IconEye,
  IconFileAnalytics,
  IconFileCertificate,
  IconFileCheck,
  IconFileSpreadsheet,
  IconFileText,
  IconFileTypePdf,
  IconFirstAidKit,
  IconFlame,
  IconFlask,
  IconForms,
  IconGift,
  IconGitCompare,
  IconHandGrab,
  IconHeadset,
  IconHeartbeat,
  IconHeartHandshake,
  IconHeartPlus,
  IconHeartRateMonitor,
  IconHistory,
  IconIdBadge2,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconLink,
  IconListDetails,
  IconLockSquareRounded,
  IconMapPin,
  IconMessage,
  IconMicroscope,
  IconNews,
  IconNotebook,
  IconPackage,
  IconPill,
  IconPlug,
  IconQrcode,
  IconRadar,
  IconRadioactive,
  IconReceipt,
  IconReceiptTax,
  IconReport,
  IconReportMedical,
  IconRibbonHealth,
  IconRoute,
  IconScale,
  IconSchool,
  IconScissors,
  IconSettings,
  IconShieldCheck,
  IconShieldHalfFilled,
  IconShieldLock,
  IconShoppingCart,
  IconSignature,
  IconSpeakerphone,
  IconSpray,
  IconStar,
  IconStethoscope,
  IconStretching2,
  IconToolsKitchen2,
  IconTruck,
  IconTruckDelivery,
  IconUrgent,
  IconUserCog,
  IconUserSearch,
  IconUserShield,
  IconUsers,
  IconUsersGroup,
  IconVaccine,
  IconVideo,
  IconVirus,
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
  /**
   * `module_config` code this item belongs to. When the tenant's edition switches
   * the module off (`disabled_modules` from /auth/me), the item is hidden. Absent
   * = always shown (permission-gated only).
   */
  moduleCode?: string;
  /** Listed in Administration under the closed "Advanced" group rather than with the rest. */
  isAdvanced?: boolean;
}

export interface NavGroupConfig {
  key: string;
  items: NavItemConfig[];
}

/** A registry screen as a menu item: an app's screen carries its brick, so switching it off hides it. */
function toNavItem(s: AppScreen): NavItemConfig {
  return {
    i18nKey: s.labelKey,
    path: s.path,
    icon: s.icon,
    ...(s.brick ? { moduleCode: s.brick } : {}),
    ...(s.permission ? { requiredPermission: s.permission } : {}),
    ...(s.anyOf.length > 0 ? { requiredPermissions: s.anyOf } : {}),
    ...(s.group === "advanced" ? { isAdvanced: true } : {}),
  };
}

/** An app brick's side-panel screens, in panel order, from the Rust screen registry. */
function appNavItems(brick: string): NavItemConfig[] {
  return APP_SCREENS.filter((s) => s.brick === brick).map(toNavItem);
}

// ── Icon Map ──

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; stroke?: number }>> = {
  IconVaccine,
  IconLayoutGrid,
  IconSpeakerphone,
  IconHeadset,
  IconNews,
  IconAmbulance,
  IconAppWindow,
  IconBoxSeam,
  IconDeviceMobileMessage,
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
  IconChecklist,
  IconForms,
  IconHandGrab,
  IconTruckDelivery,
  IconShoppingCart,
  IconNotebook,
  IconFlame,
  IconReceiptTax,
  IconHeartRateMonitor,
  IconLayoutDashboard,
  IconPackage,
  IconPill,
  IconFileTypePdf,
  IconPlug,
  IconQrcode,
  IconRadar,
  IconRadioactive,
  IconReceipt,
  IconReport,
  IconSchool,
  IconScissors,
  IconSettings,
  IconShieldCheck,
  IconFileSpreadsheet,
  IconShieldLock,
  IconSignature,
  IconSpray,
  IconStar,
  IconRibbonHealth,
  IconStethoscope,
  IconToolsKitchen2,
  IconTruck,
  IconUrgent,
  IconUserCog,
  IconUserShield,
  IconUsers,
  IconUsersGroup,
  IconEye,
  IconHeartbeat,
  IconMapPin,
  IconMicroscope,
  IconBrain,
  IconStretching2,
  IconHeartHandshake,
  IconGift,
  IconBabyCarriage,
  IconScale,
  IconListDetails,
  IconLockSquareRounded,
  IconShieldHalfFilled,
  IconReportMedical,
  IconVirus,
  IconHeartPlus,
  IconClipboardCheck,
  IconUserSearch,
  IconCalendarStats,
  IconHistory,
  IconFileAnalytics,
  IconGitCompare,
  IconBinaryTree,
  IconDental,
  IconVideo,
  IconLink,
  IconBuildingWarehouse,
  IconCpu,
  IconDeviceDesktop,
  IconFileCheck,
  IconRoute,
};

export function resolveIcon(name: string, size = 20, stroke = 1.5): ReactNode {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return createElement(Icon, { size, stroke });
}

// ── Module identity badges (Adobe-style mark, Carbon-styled) ──
// A short 2–3 letter mark + a hand-picked unique identity colour per module,
// shown in the nav rail and page headers in place of the icon — a compact,
// memorable wayfinding aid. Marks use natural clinical acronyms (OPD, IPD, ICU,
// MRD…); colours are deliberately distinct and dark enough for white text.
export interface ModuleBadge {
  abbr: string;
  color: string;
}

const MODULE_BADGE_DEFS: Record<string, ModuleBadge> = {
  "/dashboard": { abbr: "DB", color: "#4d5358" },
  "/health-pulse": { abbr: "HP", color: "#0f62fe" },
  "/health-intel": { abbr: "HI", color: "#007d79" },
  "/token-board": { abbr: "TB", color: "#007d79" },
  "/token-console": { abbr: "TC", color: "#6929c4" },
  "/patients": { abbr: "Pt", color: "#198038" },
  "/immunization-clinic": { abbr: "Imm", color: "#198038" },
  "/opd": { abbr: "OPD", color: "#9f1853" },
  "/opd/appointments": { abbr: "Apt", color: "#00539a" },
  "/telemedicine": { abbr: "Tel", color: "#4d5358" },
  "/doctor/signoffs": { abbr: "Sig", color: "#0043ce" },
  "/emergency": { abbr: "ER", color: "#da1e28" },
  "/order-sets": { abbr: "OS", color: "#005d5d" },
  "/chronic-care": { abbr: "CC", color: "#8a3ffc" },
  "/radiology": { abbr: "Rad", color: "#0e6027" },
  "/pharmacy": { abbr: "Rx", color: "#d02670" },
  "/pharmacy/finance": { abbr: "PhF", color: "#343a3f" },
  "/pharmacy/fulfilment": { abbr: "Pck", color: "#8a3ffc" },
  "/pharmacy/dispatch": { abbr: "Col", color: "#0e6027" },
  "/pharmacy/deliveries": { abbr: "Del", color: "#005d5d" },
  "/pharmacy/online-orders": { abbr: "Onl", color: "#0f62fe" },
  "/pharmacy/h1-register": { abbr: "H1", color: "#a2191f" },
  "/pharmacy/quarantine": { abbr: "Qtn", color: "#a2191f" },
  "/pharmacy/nppa-ceilings": { abbr: "NPPA", color: "#343a3f" },
  "/blood-bank": { abbr: "BB", color: "#9f1853" },
  "/ipd": { abbr: "IPD", color: "#0f62fe" },
  "/care-view": { abbr: "CV", color: "#007d79" },
  "/icu": { abbr: "ICU", color: "#a2191f" },
  "/nurse": { abbr: "Nur", color: "#6929c4" },
  "/ot": { abbr: "OT", color: "#198038" },
  "/diet-kitchen": { abbr: "DK", color: "#9f1853" },
  "/bedside-portal": { abbr: "BP", color: "#00539a" },
  "/billing": { abbr: "Bil", color: "#4d5358" },
  "/billing/doctor-payouts": { abbr: "DPy", color: "#4d5358" },
  "/my-earnings": { abbr: "Ern", color: "#4d5358" },
  "/insurance": { abbr: "Ins", color: "#0043ce" },
  "/materials": { abbr: "Mat", color: "#005d5d" },
  "/indent": { abbr: "Ind", color: "#005d5d" },
  "/procurement": { abbr: "Pro", color: "#8a3ffc" },
  "/cssd": { abbr: "CSD", color: "#0e6027" },
  "/housekeeping": { abbr: "HK", color: "#d02670" },
  "/front-office": { abbr: "FO", color: "#343a3f" },
  "/lms": { abbr: "LMS", color: "#0f62fe" },
  "/bme": { abbr: "BME", color: "#007d79" },
  "/assets": { abbr: "Ast", color: "#6929c4" },
  "/ambulance": { abbr: "Amb", color: "#b81921" },
  "/communications": { abbr: "Com", color: "#198038" },
  "/camp": { abbr: "Cmp", color: "#9f1853" },
  "/command-center": { abbr: "CMD", color: "#00539a" },
  "/flow": { abbr: "FLW", color: "#005d5d" },
  "/facilities": { abbr: "Fac", color: "#4d5358" },
  "/mrd": { abbr: "MRD", color: "#0043ce" },
  "/clinical-kb": { abbr: "KB", color: "#005d5d" },
  "/security": { abbr: "Sec", color: "#8a3ffc" },
  "/occupational-health": { abbr: "OH", color: "#0e6027" },
  "/utilization-review": { abbr: "UR", color: "#d02670" },
  "/case-management": { abbr: "CM", color: "#343a3f" },
  "/scheduling": { abbr: "Sch", color: "#0f62fe" },
  "/quality": { abbr: "QA", color: "#007d79" },
  "/infection-control": { abbr: "IC", color: "#6929c4" },
  "/consent": { abbr: "Cns", color: "#198038" },
  "/regulatory": { abbr: "Reg", color: "#9f1853" },
  "/privacy-compliance": { abbr: "DP", color: "#9f1853" },
  "/analytics": { abbr: "Ana", color: "#00539a" },
  "/reports": { abbr: "Rep", color: "#4d5358" },
  "/audit": { abbr: "Aud", color: "#0043ce" },
  "/specialty/ophthalmology": { abbr: "Eye", color: "#0043ce" },
  "/specialty/dental": { abbr: "Dnt", color: "#6929c4" },
  "/specialty/cath-lab": { abbr: "CL", color: "#005d5d" },
  "/specialty/endoscopy": { abbr: "End", color: "#8a3ffc" },
  "/specialty/psychiatry": { abbr: "Psy", color: "#0e6027" },
  "/specialty/pmr": { abbr: "PMR", color: "#d02670" },
  "/specialty/palliative": { abbr: "Pal", color: "#343a3f" },
  "/specialty/maternity": { abbr: "Mat", color: "#0f62fe" },
  "/specialty/other": { abbr: "Spc", color: "#007d79" },
  "/specialty/cancer-registry": { abbr: "CR", color: "#9f1853" },
  "/admin/users": { abbr: "Usr", color: "#6929c4" },
  "/admin/doctors": { abbr: "Doc", color: "#198038" },
  "/admin/roles": { abbr: "Rol", color: "#9f1853" },
  "/admin/groups": { abbr: "Grp", color: "#00539a" },
  "/admin/sso": { abbr: "SSO", color: "#4d5358" },
  "/admin/access-requests": { abbr: "AR", color: "#0043ce" },
  "/admin/nabh-indicators": { abbr: "NB", color: "#005d5d" },
  "/setup": { abbr: "Set", color: "#8a3ffc" },
  "/admin/settings": { abbr: "Cfg", color: "#0e6027" },
  "/admin/document-templates": { abbr: "DT", color: "#d02670" },
  "/admin/integration-hub": { abbr: "IH", color: "#343a3f" },
  "/admin/forms": { abbr: "Frm", color: "#6929c4" },
  "/admin/api-keys": { abbr: "Key", color: "#343a3f" },
  "/admin/connected-apps": { abbr: "App", color: "#343a3f" },
  "/admin/webhooks": { abbr: "WH", color: "#343a3f" },
  "/admin/doctor-schedules": { abbr: "DS", color: "#0f62fe" },
  "/admin/documents": { abbr: "Dcs", color: "#007d79" },
  "/retrospective": { abbr: "Rsp", color: "#6929c4" },
  "/admin/devices": { abbr: "Dev", color: "#198038" },
  "/admin/paired-devices": { abbr: "PD", color: "#9f1853" },
  "/admin/machines": { abbr: "MC", color: "#9f1853" },
  "/admin/hospital-binding": { abbr: "HB", color: "#9f1853" },
  "/lab": { abbr: "Lab", color: "#0072c3" },
  "/hr": { abbr: "HR", color: "#6929c4" },
};

/** Module badge for an exact nav path, or undefined if the module has none. */
export function getModuleBadge(path: string): ModuleBadge | undefined {
  return MODULE_BADGE_DEFS[path];
}

/** Module badge for a live location (longest-prefix match, e.g. /patients/42). */
export function matchModuleBadge(pathname: string): ModuleBadge | undefined {
  let best: string | undefined;
  for (const key of Object.keys(MODULE_BADGE_DEFS)) {
    if ((pathname === key || pathname.startsWith(`${key}/`)) && key.length > (best?.length ?? 0)) {
      best = key;
    }
  }
  return best ? getModuleBadge(best) : undefined;
}

// ── Nav Groups ──

/**
 * Whether Administration lists the screen: it sits under `/admin` or `/setup` (an app's one too,
 * shown while its app is on), or it is an Advanced or developer screen wherever it lives.
 */
function isAdministration(s: AppScreen): boolean {
  return /^\/(admin|setup)(\/|$)/.test(s.path) || s.group !== "essential";
}

/**
 * Administration's pages in panel order: the core essentials, the apps' admin screens, then the
 * Advanced ones. Developer screens are left out unless `showDevScreens` (a development build);
 * their routes still open by URL, since the permission, not the menu, is the gate.
 */
export function administrationPages(
  screens: readonly AppScreen[],
  showDevScreens: boolean,
): NavItemConfig[] {
  const pages = screens.filter(
    (s) => isAdministration(s) && (showDevScreens || s.group !== "dev_only"),
  );
  const rank = (s: AppScreen) => (s.group === "advanced" ? 2 : s.brick ? 1 : 0);
  return pages.sort((a, b) => rank(a) - rank(b)).map(toNavItem);
}

/**
 * Every screen, from the Rust screen registry: the core screens, one group per app brick (keyed
 * by its id, in brick order), then Administration as one entry with its pages. The side panel
 * shows one app's group at a time (see `layouts/appPanel.ts`); search, breadcrumbs and the
 * launcher read all of it. Nothing here is written by hand: add a screen in `screens.rs`.
 */
export const NAV_GROUPS: NavGroupConfig[] = [
  {
    key: "core",
    items: APP_SCREENS.filter((s) => !s.brick && !isAdministration(s)).map(toNavItem),
  },
  ...Object.keys(BRICK_MANIFESTS)
    .map((brick) => ({ key: brick, items: appNavItems(brick) }))
    .filter((group) => group.items.length > 0),
  {
    key: "admin",
    items: [
      {
        i18nKey: "admin",
        path: "/admin/users",
        icon: "IconSettings",
        children: administrationPages(APP_SCREENS, import.meta.env.DEV),
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
  labels["/patients/register"] = "Register Patient";
  labels["/opd/new"] = "New Visit";
  labels["/opd/queue"] = "Queue";
  labels["/billing/invoices"] = "Invoice";
  labels["/ipd/new"] = "New Admission";
  labels["/ipd/admissions"] = "Admission";
  labels["/camp/new"] = "New Camp";

  return labels;
}

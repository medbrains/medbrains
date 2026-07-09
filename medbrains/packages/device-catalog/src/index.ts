/**
 * Device catalog — the single string base for the whole fleet. Every rendered surface (TV / kiosk /
 * mobile / desktop) AND every headless device class (edge gateway, medical equipment, IoT sensor)
 * is classified here on one axis set: class, form-factor, whether it renders a UI, and which pairing
 * model it uses. Apps, the admin, and the boot manifest all resolve against this catalog instead of
 * ad-hoc `app_variant` strings.
 *
 * UI surfaces are seeded from the xlsx Apps column (`app-surfaces.json`). Non-UI equipment/IoT device
 * *types* stay authoritative in the backend `device_category` enum — this catalog carries the class
 * taxonomy + `classifyDeviceCategory()` to fold that enum into it without duplicating ~45 values.
 */

export type DeviceClass =
  | "ui-display" // 10-foot boards (TV-*)
  | "ui-touch" // self-service kiosks
  | "ui-mobile" // phones / tablets (Mobile-*)
  | "ui-desktop" // workstations, the web app
  | "headless-edge" // gateways / bridges — no screen
  | "headless-equipment" // lab analyzers, monitors, pumps
  | "headless-iot"; // sensors (cold-chain, environment)

export type DeviceFactor = "tv" | "kiosk" | "mobile" | "desktop" | "edge" | "equipment" | "sensor";

export type PairingModel = "paired_devices" | "device_instances" | "none";

export interface DeviceSurface {
  code: string;
  class: DeviceClass;
  factor: DeviceFactor;
  /** False for headless-* — the device is managed, never rendered. */
  renders: boolean;
  pairing: PairingModel;
  /** For UI surfaces: the module areas it shows (from the xlsx Apps column). */
  modules?: string[];
}

/** Default class / render / pairing per form-factor; per-surface entries may override pairing/renders. */
const FACTOR_DEFAULTS: Record<
  DeviceFactor,
  { class: DeviceClass; renders: boolean; pairing: PairingModel }
> = {
  tv: { class: "ui-display", renders: true, pairing: "paired_devices" },
  kiosk: { class: "ui-touch", renders: true, pairing: "paired_devices" },
  mobile: { class: "ui-mobile", renders: true, pairing: "paired_devices" },
  desktop: { class: "ui-desktop", renders: true, pairing: "paired_devices" },
  edge: { class: "headless-edge", renders: false, pairing: "device_instances" },
  equipment: { class: "headless-equipment", renders: false, pairing: "device_instances" },
  sensor: { class: "headless-iot", renders: false, pairing: "device_instances" },
};

interface Seed {
  code: string;
  factor: DeviceFactor;
  modules?: string[];
  pairing?: PairingModel;
  renders?: boolean;
}

const SEED: Seed[] = [
  // Desktop / web
  {
    code: "Web",
    factor: "desktop",
    pairing: "none",
    modules: ["OPD", "IPD", "Laboratory", "Pharmacy", "Billing"],
  },
  {
    code: "Desktop-Workstation",
    factor: "desktop",
    modules: ["Printing", "IPD", "Laboratory", "Pharmacy"],
  },
  {
    code: "Desktop-Kiosk",
    factor: "kiosk",
    modules: ["TV/Queue", "OPD", "Communication", "Patient Mgmt"],
  },
  {
    code: "Desktop-DeviceBridge",
    factor: "edge",
    modules: ["Device Integration", "Radiology", "Laboratory", "Ext Lab"],
  },
  // TV / display boards
  { code: "TV-Queue", factor: "tv", modules: ["TV/Queue", "OPD", "Front Office", "Printing"] },
  { code: "TV-Ward", factor: "tv", modules: ["TV/Queue", "IPD", "Care View", "Housekeeping"] },
  {
    code: "TV-Emergency",
    factor: "tv",
    modules: ["TV/Queue", "Emergency", "Security Dept", "ICU"],
  },
  { code: "TV-ICU", factor: "tv", modules: ["TV/Queue", "ICU", "Care View"] },
  { code: "TV-OT", factor: "tv", modules: ["IPD", "TV/Queue", "Command Center"] },
  { code: "TV-Pharmacy", factor: "tv", modules: ["TV/Queue", "Pharmacy", "Front Office"] },
  { code: "TV-Billing", factor: "tv", modules: ["TV/Queue", "Billing", "Front Office"] },
  { code: "TV-Lab", factor: "tv", modules: ["TV/Queue", "Laboratory", "Front Office"] },
  { code: "TV-Radiology", factor: "tv", modules: ["TV/Queue", "Radiology", "Front Office"] },
  { code: "TV-DoctorRoom", factor: "tv", modules: ["TV/Queue"] },
  { code: "TV-Education", factor: "tv", modules: ["TV/Queue", "Bedside Portal", "Communication"] },
  { code: "TV-Donor", factor: "tv", modules: ["Blood Bank", "TV/Queue"] },
  { code: "TV-Wayfinding", factor: "tv", modules: ["TV/Queue"] },
  { code: "TV-Cafeteria", factor: "tv", modules: ["TV/Queue"] },
  { code: "TV-Notice", factor: "tv", modules: ["TV/Queue"] },
  // Mobile — role-scoped
  {
    code: "Mobile-Doctor",
    factor: "mobile",
    modules: ["OPD", "Specialty", "IPD", "Offline Sync", "Emergency"],
  },
  {
    code: "Mobile-Nurse",
    factor: "mobile",
    modules: ["IPD", "Offline Sync", "ICU", "Infection Ctrl"],
  },
  { code: "Mobile-Pharmacist", factor: "mobile", modules: ["Pharmacy", "Inventory", "OPD"] },
  { code: "Mobile-LabTech", factor: "mobile", modules: ["Laboratory", "Blood Bank"] },
  {
    code: "Mobile-Phlebo",
    factor: "mobile",
    modules: ["Offline Sync", "Laboratory", "Phlebo App"],
  },
  {
    code: "Mobile-Radiologist",
    factor: "mobile",
    modules: ["Radiology", "Teleradiology", "Specialty"],
  },
  {
    code: "Mobile-Patient",
    factor: "mobile",
    modules: ["Patient App", "Telemedicine", "IPD", "Offline Sync"],
  },
  {
    code: "Mobile-Admin",
    factor: "mobile",
    modules: ["Quality", "HR", "Academic ERP", "Dashboards"],
  },
  {
    code: "Mobile-BME",
    factor: "mobile",
    modules: ["BME/CMMS", "Facilities", "Device Integration"],
  },
  { code: "Mobile-Housekeeping", factor: "mobile", modules: ["IPD", "Housekeeping", "Facilities"] },
  { code: "Mobile-Security", factor: "mobile", modules: ["Security Dept", "Front Office", "Fire"] },
  { code: "Mobile-Driver", factor: "mobile", modules: ["Emergency", "Ambulance"] },
  { code: "Mobile-Dietitian", factor: "mobile", modules: ["Diet & Kitchen", "ICU"] },
  { code: "Mobile-Faculty", factor: "mobile", modules: ["Academic ERP"] },
  { code: "Mobile-Student", factor: "mobile", modules: ["Academic ERP", "OPD", "Radiology"] },
  // Headless
  { code: "edge-gateway", factor: "edge", pairing: "none" },
];

export const DEVICE_SURFACES: DeviceSurface[] = SEED.map((s) => {
  const d = FACTOR_DEFAULTS[s.factor];
  return {
    code: s.code,
    class: d.class,
    factor: s.factor,
    renders: s.renders ?? d.renders,
    pairing: s.pairing ?? d.pairing,
    modules: s.modules,
  };
});

const BY_CODE = new Map(DEVICE_SURFACES.map((s) => [s.code, s]));

export function getSurface(code: string): DeviceSurface | undefined {
  return BY_CODE.get(code);
}

export function isRendered(code: string): boolean {
  return BY_CODE.get(code)?.renders ?? false;
}

export function factorOf(code: string): DeviceFactor | undefined {
  return BY_CODE.get(code)?.factor;
}

export function surfacesByClass(cls: DeviceClass): DeviceSurface[] {
  return DEVICE_SURFACES.filter((s) => s.class === cls);
}

/**
 * Fold a backend `device_category` (0010_devices.sql) into the catalog's class taxonomy, so the ~45
 * equipment/IoT categories map onto the same axes without being re-listed here.
 */
export function classifyDeviceCategory(category: string): DeviceClass {
  if (["queue_display", "digital_signage", "pharmacy_display"].includes(category)) {
    return "ui-display";
  }
  if (["self_checkin_kiosk", "wayfinding_kiosk"].includes(category)) {
    return "ui-touch";
  }
  if (["bedside_tablet", "nurse_station", "mobile_nurse", "mobile_doctor"].includes(category)) {
    return "ui-mobile";
  }
  if (["cold_chain_sensor", "environment_sensor"].includes(category)) {
    return "headless-iot";
  }
  // Everything else in the catalog (analyzers, monitors, pumps, imaging, scanners, servers) is
  // managed equipment.
  return "headless-equipment";
}

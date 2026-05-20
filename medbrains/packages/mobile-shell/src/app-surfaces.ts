/**
 * Canonical MedBrains app surfaces.
 *
 * This mirrors the feature tracker `Apps` column: a feature can belong to
 * Web, one or more role-specific mobile apps, desktop/kiosk targets, and
 * TV boards. Runtime apps use these codes to audit module scope and to
 * keep role/location-specific shells from drifting away from the tracker.
 */

export type AppSurfaceFamily = "web" | "desktop" | "mobile" | "tv" | "infra";

export interface AppSurfaceDefinition {
  code: string;
  family: AppSurfaceFamily;
  label: string;
  description: string;
  shippedTarget?: boolean;
}

export const APP_SURFACES = [
  {
    code: "Web",
    family: "web",
    label: "Web",
    description: "Main React SPA for role-gated hospital workflows.",
    shippedTarget: true,
  },
  {
    code: "Desktop-Kiosk",
    family: "desktop",
    label: "Desktop kiosk",
    description: "Patient self-service kiosk for lobby, OPD, and IPD entry.",
  },
  {
    code: "Desktop-Workstation",
    family: "desktop",
    label: "Desktop workstation",
    description: "Staff workstation bound to printer, counter, lab, OT, or ward hardware.",
  },
  {
    code: "Desktop-DeviceBridge",
    family: "desktop",
    label: "Desktop device bridge",
    description: "Headless bridge for analyzers, DICOM router, MGPS sensors, and modalities.",
  },
  {
    code: "Mobile-Doctor",
    family: "mobile",
    label: "Doctor",
    description: "Physician rounds, OPD, orders, e-Rx, notes, and clinical review.",
    shippedTarget: true,
  },
  {
    code: "Mobile-Nurse",
    family: "mobile",
    label: "Nurse",
    description: "Bedside vitals, eMAR, nursing rounds, handoff, and audits.",
    shippedTarget: true,
  },
  {
    code: "Mobile-Patient",
    family: "mobile",
    label: "Patient",
    description: "Appointments, records, payments, family sharing, and consents.",
    shippedTarget: true,
  },
  {
    code: "Mobile-Camp",
    family: "mobile",
    label: "Camp",
    description:
      "Dedicated rural/offline camp field app composed from doctor, nurse, phlebo, and registration workflows.",
    shippedTarget: true,
  },
  {
    code: "Mobile-Phlebo",
    family: "mobile",
    label: "Phlebo",
    description: "In-house and home sample collection, scan, and handoff.",
  },
  {
    code: "Mobile-Pharmacist",
    family: "mobile",
    label: "Pharmacist",
    description: "Pharmacy counter, ward dispensing, stock, NDPS, and cycle count.",
    shippedTarget: true,
  },
  {
    code: "Mobile-LabTech",
    family: "mobile",
    label: "Lab tech",
    description: "Sample receipt, analyzer bench, QC, and result workflow.",
    shippedTarget: true,
  },
  {
    code: "Mobile-Radiologist",
    family: "mobile",
    label: "Radiologist",
    description: "Reading, critical findings, voice report, and image review.",
  },
  {
    code: "Mobile-Admin",
    family: "mobile",
    label: "Admin",
    description: "CXO and manager KPIs, approvals, alerts, and controls.",
    shippedTarget: true,
  },
  {
    code: "Mobile-BME",
    family: "mobile",
    label: "BME",
    description: "Biomedical engineering assets, calibration, breakdown, and PM tickets.",
    shippedTarget: true,
  },
  {
    code: "Mobile-Housekeeping",
    family: "mobile",
    label: "Housekeeping",
    description: "Cleaning, turnaround, laundry, and facilities response.",
    shippedTarget: true,
  },
  {
    code: "Mobile-Security",
    family: "mobile",
    label: "Security",
    description: "Visitor pass, incident, code response, and gate checks.",
    shippedTarget: true,
  },
  {
    code: "Mobile-Driver",
    family: "mobile",
    label: "Driver",
    description: "Ambulance dispatch, navigation, logs, and field transport.",
  },
  {
    code: "Mobile-Dietitian",
    family: "mobile",
    label: "Dietitian",
    description: "Diet planning, kitchen rounds, and tray verification.",
  },
  {
    code: "Mobile-Student",
    family: "mobile",
    label: "Student",
    description: "Academic ERP, student logs, clinical exposure, and attendance.",
  },
  {
    code: "Mobile-Faculty",
    family: "mobile",
    label: "Faculty",
    description: "Faculty supervision, student review, attendance, and academic approvals.",
  },
  {
    code: "Mobile-Vendor",
    family: "mobile",
    label: "Vendor",
    description: "Vendor-facing service, AMC, ticket, and asset workflows.",
    shippedTarget: true,
  },
  {
    code: "TV-Queue",
    family: "tv",
    label: "Queue board",
    description: "OPD waiting hall token board.",
    shippedTarget: true,
  },
  {
    code: "TV-DoctorRoom",
    family: "tv",
    label: "Doctor room board",
    description: "Small display outside consultant rooms.",
    shippedTarget: true,
  },
  {
    code: "TV-Lab",
    family: "tv",
    label: "Lab board",
    description: "Lab sample collection and report status display.",
    shippedTarget: true,
  },
  {
    code: "TV-Pharmacy",
    family: "tv",
    label: "Pharmacy board",
    description: "Pharmacy counter queue and ready-for-pickup display.",
    shippedTarget: true,
  },
  {
    code: "TV-Radiology",
    family: "tv",
    label: "Radiology board",
    description: "Modality waiting area for X-ray, CT, MRI, and USG.",
  },
  {
    code: "TV-Billing",
    family: "tv",
    label: "Billing board",
    description: "Billing counter queue and payment status display.",
  },
  {
    code: "TV-Emergency",
    family: "tv",
    label: "Emergency board",
    description: "ER triage and code-alert display.",
    shippedTarget: true,
  },
  {
    code: "TV-Ward",
    family: "tv",
    label: "Ward board",
    description: "Nursing station and IPD ward dashboard.",
    shippedTarget: true,
  },
  {
    code: "TV-ICU",
    family: "tv",
    label: "ICU board",
    description: "ICU wall display and restricted family information screen.",
    shippedTarget: true,
  },
  {
    code: "TV-OT",
    family: "tv",
    label: "OT board",
    description: "OT corridor case status for waiting families.",
  },
  {
    code: "TV-Wayfinding",
    family: "tv",
    label: "Wayfinding",
    description: "Lobby and corridor directional signage.",
    shippedTarget: true,
  },
  {
    code: "TV-Cafeteria",
    family: "tv",
    label: "Cafeteria board",
    description: "Menu, diet notices, and cafeteria display.",
    shippedTarget: true,
  },
  {
    code: "TV-Education",
    family: "tv",
    label: "Education board",
    description: "Patient education content for bedside and waiting areas.",
    shippedTarget: true,
  },
  {
    code: "TV-Donor",
    family: "tv",
    label: "Donor board",
    description: "Blood bank donor wall and drive display.",
    shippedTarget: true,
  },
  {
    code: "TV-Notice",
    family: "tv",
    label: "Notice board",
    description: "General hospital noticeboard.",
    shippedTarget: true,
  },
  {
    code: "(infra - no UI)",
    family: "infra",
    label: "Infra only",
    description: "Backend/platform feature with no direct user-facing app surface.",
  },
] as const satisfies ReadonlyArray<AppSurfaceDefinition>;

export type AppSurfaceCode = (typeof APP_SURFACES)[number]["code"];

export const SHIPPED_APP_SURFACES = APP_SURFACES.filter(
  (surface) => "shippedTarget" in surface && surface.shippedTarget,
);

export function getAppSurface(code: AppSurfaceCode): AppSurfaceDefinition {
  return APP_SURFACES.find((surface) => surface.code === code) ?? APP_SURFACES[0];
}

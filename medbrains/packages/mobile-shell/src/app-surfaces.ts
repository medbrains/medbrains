/**
 * Canonical MedBrains app surfaces.
 *
 * This mirrors the feature tracker `Apps` column: a feature can belong to
 * Web, one or more role-specific mobile apps, desktop/kiosk targets, and
 * TV boards. Runtime apps use these codes to audit module scope and to
 * keep role/location-specific shells from drifting away from the tracker.
 */

import { mobileShellAppSurfaceText } from "./app-surfaces-text.js";

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
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.web.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.web.description"),
    shippedTarget: true,
  },
  {
    code: "Desktop-Kiosk",
    family: "desktop",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.desktopKiosk.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.desktopKiosk.description"),
  },
  {
    code: "Desktop-Workstation",
    family: "desktop",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.desktopWorkstation.label"),
    description: mobileShellAppSurfaceText(
      "mobileShell.appSurfaces.desktopWorkstation.description",
    ),
  },
  {
    code: "Desktop-DeviceBridge",
    family: "desktop",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.desktopDeviceBridge.label"),
    description: mobileShellAppSurfaceText(
      "mobileShell.appSurfaces.desktopDeviceBridge.description",
    ),
  },
  {
    code: "Mobile-Doctor",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileDoctor.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileDoctor.description"),
    shippedTarget: true,
  },
  {
    code: "Mobile-Nurse",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileNurse.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileNurse.description"),
    shippedTarget: true,
  },
  {
    code: "Mobile-Patient",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobilePatient.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobilePatient.description"),
    shippedTarget: true,
  },
  {
    code: "Mobile-Camp",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileCamp.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileCamp.description"),
    shippedTarget: true,
  },
  {
    code: "Mobile-Phlebo",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobilePhlebo.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobilePhlebo.description"),
  },
  {
    code: "Mobile-Pharmacist",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobilePharmacist.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobilePharmacist.description"),
    shippedTarget: true,
  },
  {
    code: "Mobile-LabTech",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileLabTech.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileLabTech.description"),
    shippedTarget: true,
  },
  {
    code: "Mobile-Radiologist",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileRadiologist.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileRadiologist.description"),
  },
  {
    code: "Mobile-Admin",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileAdmin.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileAdmin.description"),
    shippedTarget: true,
  },
  {
    code: "Mobile-BME",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileBme.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileBme.description"),
    shippedTarget: true,
  },
  {
    code: "Mobile-Housekeeping",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileHousekeeping.label"),
    description: mobileShellAppSurfaceText(
      "mobileShell.appSurfaces.mobileHousekeeping.description",
    ),
    shippedTarget: true,
  },
  {
    code: "Mobile-Security",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileSecurity.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileSecurity.description"),
    shippedTarget: true,
  },
  {
    code: "Mobile-Driver",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileDriver.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileDriver.description"),
  },
  {
    code: "Mobile-Dietitian",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileDietitian.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileDietitian.description"),
  },
  {
    code: "Mobile-Student",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileStudent.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileStudent.description"),
  },
  {
    code: "Mobile-Faculty",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileFaculty.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileFaculty.description"),
  },
  {
    code: "Mobile-Vendor",
    family: "mobile",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileVendor.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.mobileVendor.description"),
    shippedTarget: true,
  },
  {
    code: "TV-Queue",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvQueue.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvQueue.description"),
    shippedTarget: true,
  },
  {
    code: "TV-DoctorRoom",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvDoctorRoom.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvDoctorRoom.description"),
    shippedTarget: true,
  },
  {
    code: "TV-Lab",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvLab.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvLab.description"),
    shippedTarget: true,
  },
  {
    code: "TV-Pharmacy",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvPharmacy.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvPharmacy.description"),
    shippedTarget: true,
  },
  {
    code: "TV-Radiology",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvRadiology.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvRadiology.description"),
  },
  {
    code: "TV-Billing",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvBilling.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvBilling.description"),
  },
  {
    code: "TV-Emergency",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvEmergency.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvEmergency.description"),
    shippedTarget: true,
  },
  {
    code: "TV-Ward",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvWard.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvWard.description"),
    shippedTarget: true,
  },
  {
    code: "TV-ICU",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvIcu.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvIcu.description"),
    shippedTarget: true,
  },
  {
    code: "TV-OT",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvOt.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvOt.description"),
  },
  {
    code: "TV-Wayfinding",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvWayfinding.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvWayfinding.description"),
    shippedTarget: true,
  },
  {
    code: "TV-Cafeteria",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvCafeteria.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvCafeteria.description"),
    shippedTarget: true,
  },
  {
    code: "TV-Education",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvEducation.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvEducation.description"),
    shippedTarget: true,
  },
  {
    code: "TV-Donor",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvDonor.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvDonor.description"),
    shippedTarget: true,
  },
  {
    code: "TV-Notice",
    family: "tv",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvNotice.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.tvNotice.description"),
    shippedTarget: true,
  },
  {
    code: "(infra - no UI)",
    family: "infra",
    label: mobileShellAppSurfaceText("mobileShell.appSurfaces.infraOnly.label"),
    description: mobileShellAppSurfaceText("mobileShell.appSurfaces.infraOnly.description"),
  },
] as const satisfies ReadonlyArray<AppSurfaceDefinition>;

export type AppSurfaceCode = (typeof APP_SURFACES)[number]["code"];

export const SHIPPED_APP_SURFACES = APP_SURFACES.filter(
  (surface) => "shippedTarget" in surface && surface.shippedTarget,
);

export function getAppSurface(code: AppSurfaceCode): AppSurfaceDefinition {
  return APP_SURFACES.find((surface) => surface.code === code) ?? APP_SURFACES[0];
}

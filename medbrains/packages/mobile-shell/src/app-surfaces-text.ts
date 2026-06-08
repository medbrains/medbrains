type MobileShellAppSurfaceTextValues = Record<string, string | number | boolean>;

const MOBILE_SHELL_APP_SURFACE_MESSAGES: Record<string, string> = {
  "mobileShell.appSurfaces.desktopDeviceBridge.description":
    "Headless bridge for analyzers, DICOM router, MGPS sensors, and modalities.",
  "mobileShell.appSurfaces.desktopDeviceBridge.label": "Desktop device bridge",
  "mobileShell.appSurfaces.desktopKiosk.description":
    "Patient self-service kiosk for lobby, OPD, and IPD entry.",
  "mobileShell.appSurfaces.desktopKiosk.label": "Desktop kiosk",
  "mobileShell.appSurfaces.desktopWorkstation.description":
    "Staff workstation bound to printer, counter, lab, OT, or ward hardware.",
  "mobileShell.appSurfaces.desktopWorkstation.label": "Desktop workstation",
  "mobileShell.appSurfaces.infraOnly.description":
    "Backend/platform feature with no direct user-facing app surface.",
  "mobileShell.appSurfaces.infraOnly.label": "Infra only",
  "mobileShell.appSurfaces.mobileAdmin.description":
    "CXO and manager KPIs, approvals, alerts, and controls.",
  "mobileShell.appSurfaces.mobileAdmin.label": "Admin",
  "mobileShell.appSurfaces.mobileBme.description":
    "Biomedical engineering assets, calibration, breakdown, and PM tickets.",
  "mobileShell.appSurfaces.mobileBme.label": "BME",
  "mobileShell.appSurfaces.mobileCamp.description":
    "Dedicated rural/offline camp field app composed from doctor, nurse, phlebo, and registration workflows.",
  "mobileShell.appSurfaces.mobileCamp.label": "Camp",
  "mobileShell.appSurfaces.mobileDietitian.description":
    "Diet planning, kitchen rounds, and tray verification.",
  "mobileShell.appSurfaces.mobileDietitian.label": "Dietitian",
  "mobileShell.appSurfaces.mobileDoctor.description":
    "Physician rounds, OPD, orders, e-Rx, notes, and clinical review.",
  "mobileShell.appSurfaces.mobileDoctor.label": "Doctor",
  "mobileShell.appSurfaces.mobileDriver.description":
    "Ambulance dispatch, navigation, logs, and field transport.",
  "mobileShell.appSurfaces.mobileDriver.label": "Driver",
  "mobileShell.appSurfaces.mobileFaculty.description":
    "Faculty supervision, student review, attendance, and academic approvals.",
  "mobileShell.appSurfaces.mobileFaculty.label": "Faculty",
  "mobileShell.appSurfaces.mobileHousekeeping.description":
    "Cleaning, turnaround, laundry, and facilities response.",
  "mobileShell.appSurfaces.mobileHousekeeping.label": "Housekeeping",
  "mobileShell.appSurfaces.mobileLabTech.description":
    "Sample receipt, analyzer bench, QC, and result workflow.",
  "mobileShell.appSurfaces.mobileLabTech.label": "Lab tech",
  "mobileShell.appSurfaces.mobileNurse.description":
    "Bedside vitals, eMAR, nursing rounds, handoff, and audits.",
  "mobileShell.appSurfaces.mobileNurse.label": "Nurse",
  "mobileShell.appSurfaces.mobilePatient.description":
    "Appointments, records, payments, family sharing, and consents.",
  "mobileShell.appSurfaces.mobilePatient.label": "Patient",
  "mobileShell.appSurfaces.mobilePharmacist.description":
    "Pharmacy counter, ward dispensing, stock, NDPS, and cycle count.",
  "mobileShell.appSurfaces.mobilePharmacist.label": "Pharmacist",
  "mobileShell.appSurfaces.mobilePhlebo.description":
    "In-house and home sample collection, scan, and handoff.",
  "mobileShell.appSurfaces.mobilePhlebo.label": "Phlebo",
  "mobileShell.appSurfaces.mobileRadiologist.description":
    "Reading, critical findings, voice report, and image review.",
  "mobileShell.appSurfaces.mobileRadiologist.label": "Radiologist",
  "mobileShell.appSurfaces.mobileSecurity.description":
    "Visitor pass, incident, code response, and gate checks.",
  "mobileShell.appSurfaces.mobileSecurity.label": "Security",
  "mobileShell.appSurfaces.mobileStudent.description":
    "Academic ERP, student logs, clinical exposure, and attendance.",
  "mobileShell.appSurfaces.mobileStudent.label": "Student",
  "mobileShell.appSurfaces.mobileVendor.description":
    "Vendor-facing service, AMC, ticket, and asset workflows.",
  "mobileShell.appSurfaces.mobileVendor.label": "Vendor",
  "mobileShell.appSurfaces.tvBilling.description":
    "Billing counter queue and payment status display.",
  "mobileShell.appSurfaces.tvBilling.label": "Billing board",
  "mobileShell.appSurfaces.tvCafeteria.description": "Menu, diet notices, and cafeteria display.",
  "mobileShell.appSurfaces.tvCafeteria.label": "Cafeteria board",
  "mobileShell.appSurfaces.tvDoctorRoom.description": "Small display outside consultant rooms.",
  "mobileShell.appSurfaces.tvDoctorRoom.label": "Doctor room board",
  "mobileShell.appSurfaces.tvDonor.description": "Blood bank donor wall and drive display.",
  "mobileShell.appSurfaces.tvDonor.label": "Donor board",
  "mobileShell.appSurfaces.tvEducation.description":
    "Patient education content for bedside and waiting areas.",
  "mobileShell.appSurfaces.tvEducation.label": "Education board",
  "mobileShell.appSurfaces.tvEmergency.description": "ER triage and code-alert display.",
  "mobileShell.appSurfaces.tvEmergency.label": "Emergency board",
  "mobileShell.appSurfaces.tvIcu.description":
    "ICU wall display and restricted family information screen.",
  "mobileShell.appSurfaces.tvIcu.label": "ICU board",
  "mobileShell.appSurfaces.tvLab.description": "Lab sample collection and report status display.",
  "mobileShell.appSurfaces.tvLab.label": "Lab board",
  "mobileShell.appSurfaces.tvNotice.description": "General hospital noticeboard.",
  "mobileShell.appSurfaces.tvNotice.label": "Notice board",
  "mobileShell.appSurfaces.tvOt.description": "OT corridor case status for waiting families.",
  "mobileShell.appSurfaces.tvOt.label": "OT board",
  "mobileShell.appSurfaces.tvPharmacy.description":
    "Pharmacy counter queue and ready-for-pickup display.",
  "mobileShell.appSurfaces.tvPharmacy.label": "Pharmacy board",
  "mobileShell.appSurfaces.tvQueue.description": "OPD waiting hall token board.",
  "mobileShell.appSurfaces.tvQueue.label": "Queue board",
  "mobileShell.appSurfaces.tvRadiology.description":
    "Modality waiting area for X-ray, CT, MRI, and USG.",
  "mobileShell.appSurfaces.tvRadiology.label": "Radiology board",
  "mobileShell.appSurfaces.tvWard.description": "Nursing station and IPD ward dashboard.",
  "mobileShell.appSurfaces.tvWard.label": "Ward board",
  "mobileShell.appSurfaces.tvWayfinding.description": "Lobby and corridor directional signage.",
  "mobileShell.appSurfaces.tvWayfinding.label": "Wayfinding",
  "mobileShell.appSurfaces.web.description": "Main React SPA for role-gated hospital workflows.",
  "mobileShell.appSurfaces.web.label": "Web",
};

function interpolate(template: string, values?: MobileShellAppSurfaceTextValues): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function mobileShellAppSurfaceText(
  key: string,
  values?: MobileShellAppSurfaceTextValues,
): string {
  const template = MOBILE_SHELL_APP_SURFACE_MESSAGES[key];

  return template ? interpolate(template, values) : key;
}

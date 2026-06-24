import type { ServiceType } from "@medbrains/types";

/**
 * Foundation templates — the self-service accelerator. A non-technical admin
 * picks one and the wizard's essentials (departments, services, numbering) are
 * pre-filled, so they can go live in minutes and tweak the rest later. Modelled
 * on Epic/Cerner "Foundation System" starter configs.
 */
export interface FoundationOption {
  id: "clinic" | "general" | "specialty";
  label: string;
  description: string;
  departments: Array<{ code: string; name: string; department_type: string }>;
  services: Array<{ code: string; name: string; service_type: ServiceType; description?: string }>;
  sequences: {
    uhid_prefix: string;
    uhid_pad_width: number;
    invoice_prefix: string;
    invoice_pad_width: number;
  };
}

const STANDARD_SEQUENCES = {
  uhid_prefix: "UH",
  uhid_pad_width: 6,
  invoice_prefix: "INV",
  invoice_pad_width: 6,
};

const CONSULT = {
  code: "GEN-CONSULT",
  name: "General Consultation",
  service_type: "consultation" as ServiceType,
  description: "General outpatient consultation",
};
const SPECIALIST = {
  code: "SPEC-CONSULT",
  name: "Specialist Consultation",
  service_type: "consultation" as ServiceType,
  description: "Specialist outpatient consultation",
};
const LAB = {
  code: "LAB-INV",
  name: "Lab Investigation",
  service_type: "investigation" as ServiceType,
  description: "Laboratory diagnostic tests",
};
const RADIOLOGY = {
  code: "RAD-INV",
  name: "Radiology",
  service_type: "investigation" as ServiceType,
  description: "Imaging and radiology services",
};
const NURSING = {
  code: "NURSING-CARE",
  name: "Nursing Care",
  service_type: "nursing" as ServiceType,
  description: "General nursing services",
};
const ROOM = {
  code: "ROOM-CHARGES",
  name: "Room Charges",
  service_type: "other" as ServiceType,
  description: "Room and bed charges",
};

export const FOUNDATION_OPTIONS: FoundationOption[] = [
  {
    id: "clinic",
    label: "Standalone Clinic",
    description: "OPD-first single clinic — consultations, basic diagnostics, pharmacy. No IPD.",
    departments: [
      { code: "GEN-MED", name: "General Medicine", department_type: "clinical" },
      { code: "PHARMA", name: "Pharmacy", department_type: "support" },
      { code: "ADMIN", name: "Administration", department_type: "administrative" },
    ],
    services: [CONSULT, LAB],
    sequences: STANDARD_SEQUENCES,
  },
  {
    id: "general",
    label: "General Hospital",
    description: "Multi-department hospital with OPD, IPD, diagnostics, pharmacy and billing.",
    departments: [
      { code: "GEN-MED", name: "General Medicine", department_type: "clinical" },
      { code: "GEN-SURG", name: "General Surgery", department_type: "clinical" },
      { code: "PEDS", name: "Pediatrics", department_type: "clinical" },
      { code: "OBGYN", name: "Obstetrics & Gynecology", department_type: "clinical" },
      { code: "EMERG", name: "Emergency", department_type: "clinical" },
      { code: "ICU", name: "Intensive Care Unit", department_type: "clinical" },
      { code: "RADIO", name: "Radiology", department_type: "para_clinical" },
      { code: "PATH", name: "Pathology", department_type: "para_clinical" },
      { code: "PHARMA", name: "Pharmacy", department_type: "support" },
      { code: "ADMIN", name: "Administration", department_type: "administrative" },
    ],
    services: [CONSULT, SPECIALIST, LAB, RADIOLOGY, NURSING, ROOM],
    sequences: STANDARD_SEQUENCES,
  },
  {
    id: "specialty",
    label: "Single-Specialty",
    description:
      "Focused specialty centre (eye, dental, ortho…). Rename the clinical department after.",
    departments: [
      { code: "SPECIALTY", name: "Specialty Clinic", department_type: "clinical" },
      { code: "RADIO", name: "Diagnostics", department_type: "para_clinical" },
      { code: "PHARMA", name: "Pharmacy", department_type: "support" },
      { code: "ADMIN", name: "Administration", department_type: "administrative" },
    ],
    services: [SPECIALIST, LAB, ROOM],
    sequences: STANDARD_SEQUENCES,
  },
];

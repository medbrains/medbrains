// Landing marketing data — split from landing.tsx (pure move).

import {
  IconBed,
  IconFlask,
  IconPill,
  IconReceipt,
  IconStethoscope,
  IconUsers,
} from "@tabler/icons-react";

export interface FeatureEntry {
  category: string;
  module: string;
  subModule: string;
  feature: string;
  priority: string;
  status: string;
  web: string;
  mobile: string;
  tv: string;
}

export const coreFeatures = [
  {
    icon: IconUsers,
    title: "Patient Management",
    desc: "Complete patient registration, UHID generation, demographics, and document management.",
  },
  {
    icon: IconStethoscope,
    title: "OPD / Outpatient",
    desc: "Token queue, doctor assignments, visit tracking, and real-time consultation workflow.",
  },
  {
    icon: IconBed,
    title: "IPD / Inpatient",
    desc: "Bed management, admission-discharge-transfer, ward tracking, and nursing workflows.",
  },
  {
    icon: IconFlask,
    title: "Laboratory / LIS",
    desc: "Sample collection, test ordering, result entry with reference ranges, and reporting.",
  },
  {
    icon: IconPill,
    title: "Pharmacy",
    desc: "Drug inventory, prescription dispensing, stock management, and expiry tracking.",
  },
  {
    icon: IconReceipt,
    title: "Billing & Finance",
    desc: "Invoice generation, insurance claims, payment tracking, and financial reporting.",
  },
];

export const moduleCategories = [
  {
    category: "Clinical",
    modules: ["Patient Registration", "OPD", "Emergency", "OT Management", "Nursing"],
  },
  {
    category: "Diagnostics",
    modules: ["Laboratory / LIS", "Radiology / RIS", "Pathology", "Blood Bank"],
  },
  {
    category: "Inpatient",
    modules: ["IPD / Admissions", "Bed Management", "Diet & Nutrition", "Discharge Summary"],
  },
  {
    category: "Finance",
    modules: ["Billing", "Insurance / TPA", "Pharmacy POS", "Accounts Payable"],
  },
  {
    category: "Administration",
    modules: ["User Management", "Role-Based Access", "Audit Trails", "Multi-Tenant Config"],
  },
  {
    category: "Specialty",
    modules: ["Psychiatry", "Medical College", "Telemedicine", "Patient Experience"],
  },
];

export const stats = [
  { value: "2,189", label: "Features" },
  { value: "67+", label: "Modules" },
  { value: "NABH", label: "JCI Ready" },
  { value: "100%", label: "Open Source" },
];

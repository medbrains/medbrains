/**
 * Variant catalogs — module sets, distribution, and per-template
 * defaults. Single source of truth for everything the generator
 * branches on.
 */

export const VARIANTS = {
  staff: {
    label: "Staff (MDM-distributed clinical app)",
    distribution: "internal",
    biometricPolicy: "required",
    abdmDefault: false,
    moduleCatalog: [
      { value: "doctor", label: "Doctor — consultation, prescriptions, notes" },
      { value: "nurse", label: "Nurse — MAR, vitals, handoff, I/O" },
      { value: "pharmacy", label: "Pharmacy — dispensing, NDPS, stock" },
      { value: "lab", label: "Lab — orders, results, QC" },
      { value: "billing", label: "Billing — invoices, payments" },
      { value: "bme", label: "BME — equipment, calibrations, AMC" },
      { value: "facilities", label: "Facilities — work orders, maintenance" },
      { value: "housekeeping", label: "Housekeeping — linen, sanitation" },
      { value: "security", label: "Security — incident logs, visitor passes" },
      { value: "hr", label: "HR — attendance, leave, roster" },
      { value: "reception", label: "Reception — registration, queue, appointments" },
    ],
    defaultModules: ["doctor", "nurse"],
  },
  patient: {
    label: "Patient (public-store + ABHA login)",
    distribution: "public",
    biometricPolicy: "recommended",
    abdmDefault: true,
    moduleCatalog: [
      { value: "appointments", label: "Appointments — book, view, reschedule" },
      { value: "lab-reports", label: "Lab reports — own results, share via family link" },
      { value: "prescriptions", label: "Prescriptions — view, request renewal, locator" },
      { value: "bills", label: "Bills — view, pay (Razorpay)" },
      { value: "consent", label: "Consent — DPDP-aligned revocation" },
      { value: "family-share", label: "Family share — link, share PHR per-relation" },
    ],
    defaultModules: ["appointments", "lab-reports", "prescriptions"],
  },
  tv: {
    label: "TV (Android TV kiosk display)",
    distribution: "internal",
    biometricPolicy: "optional",
    abdmDefault: false,
    moduleCatalog: [
      { value: "queue", label: "Queue — OPD queue boards" },
      { value: "bed-status", label: "Bed status — ward occupancy" },
      { value: "lab-status", label: "Lab status — running tests, ETAs" },
      { value: "emergency-triage", label: "Emergency triage — code activations" },
      { value: "pharmacy-queue", label: "Pharmacy queue — dispensing queue" },
      { value: "digital-signage", label: "Digital signage — announcements" },
    ],
    defaultModules: ["queue", "bed-status"],
  },
  vendor: {
    label: "Vendor (3rd-party service contractor — skeleton)",
    distribution: "internal",
    biometricPolicy: "required",
    abdmDefault: false,
    moduleCatalog: [
      { value: "bme-amc", label: "BME AMC — work orders, service visits, certs" },
    ],
    defaultModules: ["bme-amc"],
  },
};

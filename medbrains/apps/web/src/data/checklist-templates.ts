// Standard hospital checklist templates seeded into admission_checklists.
// Sourced from CS Multispeciality Hospital case-sheet model (Karaikudi)
// and NABH Standard 5th Edition admission/pre-op practice.
//
// Each template returns an ordered array of `{ item_label, category }` rows
// suitable for the bulk POST /ipd/admissions/:id/checklist endpoint.

export interface ChecklistItem {
  item_label: string;
  category?: string;
}

export interface ChecklistTemplate {
  key: string;
  title: string;
  description: string;
  items: ChecklistItem[];
}

export const PREOP_CHECKLIST_27: ChecklistTemplate = {
  key: "preop-27",
  title: "Pre-Operative Checklist (27 items)",
  description:
    "Complete before sending the patient to the operation theatre. Ward nurse + OT nurse double sign-off.",
  items: [
    { item_label: "Procedure explained to patient and consent obtained", category: "Consent" },
    { item_label: "Surgical consent signed", category: "Consent" },
    {
      item_label: "Special / high-risk consent signed (if required)",
      category: "Consent",
    },
    { item_label: "Consultations completed (if required)", category: "Consent" },
    { item_label: "NPO instructed and maintained", category: "NPO" },
    { item_label: "Allergies to drugs / latex documented", category: "Safety" },
    { item_label: "Surgical site identified and marked", category: "Safety" },
    { item_label: "Surgical preparation done", category: "Site Prep" },
    { item_label: "Surgical preparation checked by", category: "Site Prep" },
    { item_label: "Chest X-ray and ECG with reports available", category: "Investigations" },
    {
      item_label: "All articles per operation list kept ready",
      category: "Equipment",
    },
    { item_label: "Vital signs checked and charted", category: "Vitals" },
    { item_label: "Presence of pacemaker / ICD documented", category: "Safety" },
    { item_label: "Blood and blood products arranged", category: "Blood Bank" },
    { item_label: "IV cannula in place and patent", category: "Access" },
    { item_label: "Dentures removed (if any)", category: "Patient Prep" },
    { item_label: "Inner dress / undergarments removed", category: "Patient Prep" },
    { item_label: "Virology marker (HIV / HBsAg / HCV) checked", category: "Safety" },
    { item_label: "Valuables and jewellery removed or secured", category: "Patient Prep" },
    {
      item_label: "Hairpins, makeup, nail-polish removed",
      category: "Patient Prep",
    },
    { item_label: "Inj. T.T. (Tetanus) date and time recorded", category: "Medication" },
    { item_label: "Inj. XYLO (test dose) date and time recorded", category: "Medication" },
    { item_label: "Clean gown and cap on", category: "Patient Prep" },
    { item_label: "Pre-op medication administered (date / time / nurse)", category: "Medication" },
    { item_label: "Post Pre-Antibiotic administered", category: "Medication" },
    { item_label: "Pre-op counselling completed", category: "Counselling" },
    { item_label: "Blood transfusion requisition on chart", category: "Blood Bank" },
    { item_label: "Surgery advance fees paid", category: "Billing" },
  ],
};

export const ADMISSION_ADVICE_12: ChecklistTemplate = {
  key: "admission-advice-12",
  title: "Patient Admission Advice (12 items)",
  description:
    "Items the nurse covers with the patient and family on arrival. Captured during the in-patient nursing initial assessment.",
  items: [
    {
      item_label: "Belongings — kept with patient or handed to relatives",
      category: "Orientation",
    },
    { item_label: "Visiting hours explained", category: "Orientation" },
    { item_label: "Light switches and call bell location shown", category: "Orientation" },
    { item_label: "Fall-prevention measures explained (side-rails, footwear)", category: "Safety" },
    { item_label: "ID band placed and verified (UHID + 2nd identifier)", category: "Safety" },
    { item_label: "Toilets and bathroom location shown", category: "Orientation" },
    { item_label: "Waste disposal — colour-coded bin instructions", category: "Infection" },
    { item_label: "Treating consultant introduced / informed", category: "Communication" },
    { item_label: "Advance payment requirement explained", category: "Billing" },
    { item_label: "Dorm / attender facility explained (if applicable)", category: "Orientation" },
    { item_label: "Drinking water source pointed out", category: "Orientation" },
    { item_label: "Side-rails of bed checked and engaged", category: "Safety" },
  ],
};

export const MRD_DEFICIENCY_26: ChecklistTemplate = {
  key: "mrd-deficiency-26",
  title: "MRD Deficiency Checklist (26 documents)",
  description:
    "Run at discharge. Each document is marked Compliant or Deficient. Deficiencies route back to the responsible role with a target time.",
  items: [
    { item_label: "Billing Card", category: "Billing" },
    { item_label: "Discharge Summary", category: "Discharge" },
    { item_label: "Admission Record / Face Sheet", category: "Admission" },
    { item_label: "Admission Order Slip", category: "Admission" },
    { item_label: "Admission Consent Form", category: "Consent" },
    { item_label: "Initial Doctor's Assessment", category: "Clinical" },
    { item_label: "In-Patient Nursing Assessment Form", category: "Nursing" },
    { item_label: "Doctor's Progress Notes", category: "Clinical" },
    { item_label: "Nurse's Notes / Progress Notes", category: "Nursing" },
    { item_label: "Critical Investigation Chart", category: "Diagnostics" },
    { item_label: "Drug Chart", category: "Medication" },
    { item_label: "Clinical Chart (vitals graph)", category: "Vitals" },
    { item_label: "Intake / Output Chart", category: "Vitals" },
    { item_label: "Diabetes Chart (if applicable)", category: "Specialty" },
    { item_label: "Critical Monitoring Chart (if applicable)", category: "Specialty" },
    { item_label: "Haemodialysis Flow Chart (if applicable)", category: "Specialty" },
    { item_label: "Blood Transfusion Monitoring Chart (if applicable)", category: "Blood Bank" },
    { item_label: "Consents (procedure / others)", category: "Consent" },
    { item_label: "Pre-Operative Checklist", category: "OT" },
    { item_label: "WHO Surgical Safety Checklist", category: "OT" },
    { item_label: "Anaesthesia Record", category: "OT" },
    { item_label: "Operation Theatre Record", category: "OT" },
    { item_label: "Nurse's Report (shift handover)", category: "Nursing" },
    { item_label: "Nutrition Progress Sheet", category: "Diet" },
    { item_label: "Physiotherapy Forms", category: "Physiotherapy" },
    { item_label: "Other Reports & Prescriptions", category: "Misc" },
  ],
};

export const ALL_TEMPLATES: ChecklistTemplate[] = [
  PREOP_CHECKLIST_27,
  ADMISSION_ADVICE_12,
  MRD_DEFICIENCY_26,
];

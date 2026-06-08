import { z } from "zod";
import {
  formNumberValue,
  hasTrimmedValue,
  nonNegativeInteger,
  nonNegativeNumber,
  optionalIsoDateString,
  optionalNonNegativeIntegerNumber,
  optionalNonNegativeIntegerString,
  optionalNonNegativeIntegerText,
  optionalNumericFormValue,
  optionalNumericText,
  positiveInteger,
  positiveNumber,
  requiredTrimmed,
} from "./form-primitives.js";

const phonePattern = /^[\d+\-() ]+$/;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const yearMonthPattern = /^\d{4}-\d{2}$/;
const financialYearPattern = /^\d{4}-\d{2}$/;
const panPattern = /^[A-Z]{5}\d{4}[A-Z]$/;
const setupCodePattern = /^[A-Z0-9][A-Z0-9-]*[A-Z0-9]$/;
const usernamePattern = /^[a-z][a-z0-9_]*$/;

export const genderValues = ["unknown", "male", "female", "other"] as const;
export const bloodGroupValues = [
  "a_positive",
  "a_negative",
  "b_positive",
  "b_negative",
  "ab_positive",
  "ab_negative",
  "o_positive",
  "o_negative",
  "unknown",
] as const;
export const maritalStatusValues = [
  "single",
  "married",
  "divorced",
  "widowed",
  "separated",
  "domestic_partner",
  "unknown",
] as const;
export const patientCategoryValues = [
  "general",
  "private",
  "insurance",
  "pmjay",
  "cghs",
  "staff",
  "vip",
  "mlc",
  "esi",
  "corporate",
  "free",
  "charity",
  "research_subject",
  "staff_dependent",
] as const;
export const registrationTypeValues = [
  "new",
  "revisit",
  "transfer_in",
  "referral",
  "emergency",
  "camp",
  "telemedicine",
  "pre_registration",
] as const;
export const registrationSourceValues = [
  "walk_in",
  "phone",
  "online_portal",
  "mobile_app",
  "kiosk",
  "referral",
  "ambulance",
  "camp",
  "telemedicine",
] as const;
export const financialClassValues = [
  "self_pay",
  "insurance",
  "government_scheme",
  "corporate",
  "charity",
  "research",
] as const;
export const referredByKindValues = [
  "doctor",
  "asha",
  "camp_worker",
  "facility",
  "ngo",
  "self",
  "other",
] as const;
export const drugInteractionSeveritySchema = z.enum([
  "minor",
  "moderate",
  "major",
  "contraindicated",
]);
export const drugInteractionSeverityValues = drugInteractionSeveritySchema.options;
export type DrugInteractionSeverityFormValue = z.infer<typeof drugInteractionSeveritySchema>;

export const clinicalProtocolCategorySchema = z.enum([
  "sepsis",
  "dvt_prophylaxis",
  "diabetes",
  "hypertension",
  "cardiac",
  "respiratory",
  "renal",
  "infection",
  "surgical",
  "other",
]);
export const clinicalProtocolCategoryValues = clinicalProtocolCategorySchema.options;
export type ClinicalProtocolCategoryFormValue = z.infer<typeof clinicalProtocolCategorySchema>;

export const criticalValueRuleFormSchema = z.object({
  test_code: requiredTrimmed("Test code is required", 64),
  test_name: requiredTrimmed("Test name is required", 255),
  low_critical: optionalNumericFormValue("Enter a valid low critical value"),
  high_critical: optionalNumericFormValue("Enter a valid high critical value"),
  unit: z.string().max(64, "Unit must be at most 64 characters"),
  gender: z.enum(["male", "female"]).nullable(),
  alert_message: requiredTrimmed("Alert message is required", 1000),
});
export type CriticalValueRuleFormInput = z.infer<typeof criticalValueRuleFormSchema>;

export const drugInteractionFormSchema = z.object({
  drug_a_name: requiredTrimmed("Drug A is required", 255),
  drug_b_name: requiredTrimmed("Drug B is required", 255),
  severity: drugInteractionSeveritySchema,
  description: requiredTrimmed("Description is required", 1000),
  mechanism: z.string().max(1000, "Mechanism must be at most 1000 characters"),
  management: z.string().max(1000, "Management must be at most 1000 characters"),
});
export type DrugInteractionFormInput = z.infer<typeof drugInteractionFormSchema>;

export const clinicalProtocolFormSchema = z.object({
  name: requiredTrimmed("Protocol name is required", 255),
  code: z.string().max(64, "Code must be at most 64 characters"),
  category: clinicalProtocolCategorySchema,
  description: z.string().max(1000, "Description must be at most 1000 characters"),
});
export type ClinicalProtocolFormInput = z.infer<typeof clinicalProtocolFormSchema>;

export const tvDisplayTypeValues = [
  "opd_queue",
  "pharmacy_queue",
  "billing_queue",
  "lab_queue",
  "radiology_queue",
  "bed_status",
  "emergency_triage",
  "digital_signage",
  "dashboard",
] as const;
export const queueTokenStatusValues = [
  "waiting",
  "called",
  "in_progress",
  "completed",
  "no_show",
  "cancelled",
] as const;
export const queuePriorityValues = [
  "normal",
  "elderly",
  "disabled",
  "pregnant",
  "emergency_referral",
  "vip",
] as const;
export const announcementPriorityValues = ["info", "warning", "emergency"] as const;

export const tvDisplayFormSchema = z.object({
  location_name: requiredTrimmed("Location name is required", 255),
  display_type: z.enum(tvDisplayTypeValues),
  department_id: z.string(),
  doctors_per_screen: positiveInteger("Enter doctors per screen"),
  show_patient_name: z.boolean(),
  show_wait_time: z.boolean(),
  language: z.array(z.string()).min(1, "Select at least one language"),
  announcement_enabled: z.boolean(),
  scroll_speed: positiveInteger("Enter scroll speed"),
});
export type TvDisplayFormInput = z.infer<typeof tvDisplayFormSchema>;

export const queueTokenFormSchema = z.object({
  department_id: requiredTrimmed("Department is required"),
  patient_id: z.string(),
  doctor_id: z.string(),
  priority: z.enum(queuePriorityValues),
});
export type QueueTokenFormInput = z.infer<typeof queueTokenFormSchema>;

export const tvAnnouncementFormSchema = z.object({
  message: requiredTrimmed("Message is required", 1000),
  priority: z.enum(announcementPriorityValues),
  display_ids: z.array(z.string()),
});
export type TvAnnouncementFormInput = z.infer<typeof tvAnnouncementFormSchema>;

export const securityZoneLevelValues = [
  "public",
  "general",
  "restricted",
  "high_security",
  "critical",
] as const;
export const securityAccessMethodValues = ["card", "biometric", "pin", "manual"] as const;
export const securityAccessDirectionValues = ["entry", "exit"] as const;
export const securityIncidentSeverityValues = ["low", "medium", "high", "critical"] as const;
export const securityIncidentCategoryValues = [
  "theft",
  "assault",
  "trespass",
  "property_damage",
  "policy_violation",
  "elopement",
  "other",
] as const;
export const securityPatientTagTypeValues = [
  "infant_rfid",
  "wander_guard",
  "elopement_risk",
] as const;
export const securityCameraTypeValues = ["dome", "bullet", "ptz", "box", "fisheye"] as const;

export const securityZoneFormSchema = z.object({
  zone_code: requiredTrimmed("Zone code is required", 64),
  name: requiredTrimmed("Zone name is required", 255),
  level: z.enum(securityZoneLevelValues).nullable(),
  description: z.string().max(1000, "Description must be at most 1000 characters"),
  after_hours_restricted: z.boolean(),
  after_hours_start: z.string().max(16, "Start time must be at most 16 characters"),
  after_hours_end: z.string().max(16, "End time must be at most 16 characters"),
});
export type SecurityZoneFormInput = z.infer<typeof securityZoneFormSchema>;

export const securityAccessCardFormSchema = z.object({
  employee_id: requiredTrimmed("Employee ID is required", 64),
  card_number: requiredTrimmed("Card number is required", 64),
  card_type: z.string().max(64, "Card type must be at most 64 characters"),
});
export type SecurityAccessCardFormInput = z.infer<typeof securityAccessCardFormSchema>;

export const securityAccessLogFormSchema = z.object({
  zone_id: requiredTrimmed("Zone is required"),
  person_name: z.string().max(255, "Person name must be at most 255 characters"),
  access_method: z.enum(securityAccessMethodValues).nullable(),
  direction: z.enum(securityAccessDirectionValues).nullable(),
  granted: z.boolean(),
  is_after_hours: z.boolean(),
});
export type SecurityAccessLogFormInput = z.infer<typeof securityAccessLogFormSchema>;

export const securityCameraFormSchema = z.object({
  name: requiredTrimmed("Camera name is required", 255),
  camera_id: z.string().max(64, "Camera ID must be at most 64 characters"),
  zone_id: z.string(),
  location_description: z.string().max(1000, "Location must be at most 1000 characters"),
  camera_type: z.enum(securityCameraTypeValues).nullable(),
  resolution: z.string().max(64, "Resolution must be at most 64 characters"),
  retention_days: positiveInteger("Enter valid retention days"),
  ip_address: z.string().max(64, "IP address must be at most 64 characters"),
});
export type SecurityCameraFormInput = z.infer<typeof securityCameraFormSchema>;

export const securityIncidentFormSchema = z.object({
  severity: z.enum(securityIncidentSeverityValues).nullable(),
  category: z.enum(securityIncidentCategoryValues),
  zone_id: z.string(),
  location_description: z.string().max(1000, "Location must be at most 1000 characters"),
  description: requiredTrimmed("Description is required", 2000),
  police_notified: z.boolean(),
  police_report_number: z.string().max(128, "Report number must be at most 128 characters"),
});
export type SecurityIncidentFormInput = z.infer<typeof securityIncidentFormSchema>;

export const securityPatientTagFormSchema = z.object({
  patient_id: requiredTrimmed("Patient is required"),
  tag_type: z.enum(securityPatientTagTypeValues),
  tag_identifier: z.string().max(128, "Tag identifier must be at most 128 characters"),
  allowed_zone_id: z.string(),
  mother_id: z.string().max(64, "Mother ID must be at most 64 characters"),
});
export type SecurityPatientTagFormInput = z.infer<typeof securityPatientTagFormSchema>;

export const securityCodeDebriefFormSchema = z.object({
  code_activation_id: requiredTrimmed("Code activation ID is required"),
  response_time_seconds: optionalNonNegativeIntegerNumber("Enter a valid response time"),
  total_duration_minutes: optionalNonNegativeIntegerNumber("Enter a valid duration"),
  what_went_well: z.string().max(2000, "Must be at most 2000 characters"),
  what_went_wrong: z.string().max(2000, "Must be at most 2000 characters"),
  root_cause: z.string().max(2000, "Must be at most 2000 characters"),
  lessons_learned: z.string().max(2000, "Must be at most 2000 characters"),
  equipment_issues: z.string().max(2000, "Must be at most 2000 characters"),
  training_gaps: z.string().max(2000, "Must be at most 2000 characters"),
  protocol_changes_recommended: z.string().max(2000, "Must be at most 2000 characters"),
});
export type SecurityCodeDebriefFormInput = z.infer<typeof securityCodeDebriefFormSchema>;

export const soapNoteFormSchema = z
  .object({
    chief_complaint: z.string().max(4000, "Subjective note must be at most 4000 characters"),
    examination: z.string().max(4000, "Objective note must be at most 4000 characters"),
    history: z.string().max(4000, "Assessment note must be at most 4000 characters"),
    plan: z.string().max(4000, "Plan note must be at most 4000 characters"),
    notes: z.string().max(8000, "Combined note must be at most 8000 characters"),
  })
  .refine(
    (value) =>
      value.chief_complaint.trim().length > 0 ||
      value.examination.trim().length > 0 ||
      value.history.trim().length > 0 ||
      value.plan.trim().length > 0 ||
      value.notes.trim().length > 0,
    {
      message: "Enter at least one SOAP section",
      path: ["chief_complaint"],
    },
  );
export type SoapNoteFormInput = z.infer<typeof soapNoteFormSchema>;

export const accessGroupFormSchema = z.object({
  code: requiredTrimmed("Group code is required", 64),
  name: requiredTrimmed("Group name is required", 255),
  description: z.string().max(1000, "Description must be at most 1000 characters"),
  permissions: z.array(z.string()),
});
export type AccessGroupFormInput = z.infer<typeof accessGroupFormSchema>;

export const accessGroupMemberFormSchema = z.object({
  user_id: requiredTrimmed("User is required"),
  expires_at: z.date().nullable(),
});
export type AccessGroupMemberFormInput = z.infer<typeof accessGroupMemberFormSchema>;

export const drugScheduleValues = ["OTC", "H", "H1", "X", "G", "NDPS"] as const;
export const formularyStatusValues = ["approved", "restricted", "non_formulary"] as const;
export const awareCategoryValues = ["access", "watch", "reserve"] as const;
export const vendorTypeValues = ["supplier", "manufacturer", "distributor", "importer"] as const;
export const supplyCategoryValues = [
  "pharmacy",
  "surgical",
  "lab",
  "radiology",
  "general",
  "dietary",
  "it",
  "housekeeping",
] as const;
export const appointmentTypeValues = [
  "new_visit",
  "follow_up",
  "consultation",
  "procedure",
  "walk_in",
] as const;
export const appointmentRecurrenceValues = ["weekly", "biweekly", "monthly"] as const;
export const shareRelationValues = ["viewer", "editor", "consultant"] as const;
export const sharingSubjectTypeValues = ["user", "role", "department", "group"] as const;
export const signerRoleValues = ["patient", "guardian", "witness", "doctor", "nurse"] as const;
export const paymentModeValues = ["online", "upi_qr", "cash"] as const;
export const billingChargeSourceValues = [
  "opd",
  "ipd",
  "lab",
  "pharmacy",
  "radiology",
  "procedure",
  "ot",
  "emergency",
  "diet",
  "cssd",
  "ambulance",
  "manual",
] as const;
export const billingPaymentModeValues = [
  "cash",
  "card",
  "upi",
  "bank_transfer",
  "cheque",
  "insurance",
  "credit",
] as const;
export const billingDiscountTypeValues = ["percentage", "fixed", "concession"] as const;
export const billingServiceCategoryValues = [
  "consultation",
  "procedure",
  "laboratory",
  "radiology",
  "pharmacy",
  "nursing",
  "room_rent",
  "ot",
  "icu",
  "physiotherapy",
  "ambulance",
  "consumables",
  "equipment",
  "miscellaneous",
] as const;
export const billingGstCategoryValues = [
  "healthcare",
  "pharmacy",
  "room_rent",
  "consumable",
  "equipment",
] as const;
export const billingAdvancePurposeValues = [
  "general",
  "admission",
  "prepaid",
  "procedure",
] as const;
export const billingInsuranceClaimTypeValues = ["cashless", "reimbursement"] as const;
export const billingInsuranceSchemeTypeValues = [
  "private",
  "tpa",
  "cghs",
  "echs",
  "pmjay",
  "esis",
  "esic",
  "ayushman_bharat",
  "state_scheme",
  "corporate",
  "cashless",
  "reimbursement",
  "other",
] as const;
export const billingCreditPatientStatusValues = [
  "active",
  "overdue",
  "suspended",
  "closed",
] as const;
export const billingTdsSectionValues = ["194J", "194C", "194H", "194I", "194A", "194Q"] as const;
export const billingTdsQuarterValues = ["Q1", "Q2", "Q3", "Q4"] as const;
export const billingGstrReturnTypeValues = ["GSTR-1", "GSTR-2B", "GSTR-3B"] as const;
export const billingErpTargetSystemValues = ["tally", "sap", "odoo", "zoho"] as const;
export const billingErpExportTypeValues = [
  "invoices",
  "payments",
  "journal_entries",
  "all",
] as const;
export const ipdNursingTaskTypeValues = [
  "medication",
  "vitals",
  "wound_care",
  "catheter_care",
  "hygiene",
  "feeding",
  "mobilization",
  "specimen",
  "documentation",
  "discharge_prep",
  "other",
] as const;
export const ipdProgressNoteTypeFormSchema = z.enum([
  "doctor_round",
  "nursing_note",
  "specialist_opinion",
  "dietitian_note",
  "physiotherapy_note",
  "social_worker_note",
  "discharge_note",
]);
export const labSampleTypeValues = [
  "blood",
  "serum",
  "plasma",
  "urine",
  "stool",
  "swab",
  "csf",
  "sputum",
  "tissue",
  "aspirate",
  "other",
] as const;
export const labMethodValues = [
  "photometry",
  "elisa",
  "pcr",
  "rt_pcr",
  "chromatography",
  "immunoassay",
  "spectrophotometry",
  "electrophoresis",
  "microscopy",
  "culture",
  "flow_cytometry",
  "sequencing",
  "other",
] as const;
export const labCollectionCenterTypeValues = ["hospital", "satellite", "partner", "camp"] as const;
export const labEqasEvaluationValues = [
  "acceptable",
  "marginal",
  "unacceptable",
  "pending",
] as const;
export const labNablDocumentTypeValues = [
  "sop",
  "manual",
  "form",
  "policy",
  "work_instruction",
  "record",
  "other",
] as const;
export const labBethesdaCategoryValues = [
  "NILM",
  "ASC-US",
  "ASC-H",
  "LSIL",
  "HSIL",
  "SCC",
  "AGC",
  "AIS",
] as const;
export const labMolecularTestMethodValues = [
  "rt_pcr",
  "pcr",
  "sequencing",
  "microarray",
  "fish",
  "western_blot",
  "southern_blot",
  "other",
] as const;
export const labMolecularResultInterpretationValues = [
  "positive",
  "negative",
  "indeterminate",
  "invalid",
  "detected",
  "not_detected",
] as const;
export const labB2bClientTypeValues = [
  "clinic",
  "laboratory",
  "hospital",
  "pharmacy",
  "diagnostic_center",
  "other",
] as const;
export const campTypeValues = [
  "general_health",
  "blood_donation",
  "vaccination",
  "eye_screening",
  "dental",
  "awareness",
  "specialized",
] as const;
export const campIdProofTypeValues = [
  "aadhar",
  "pan",
  "passport",
  "voter_id",
  "driving_license",
  "ration_card",
  "employee_id",
  "other",
] as const;
export const campFollowupTypeValues = ["phone_call", "hospital_visit", "home_visit"] as const;
export const assetDomainValues = [
  "biomedical",
  "diagnostic_monitoring",
  "therapeutic_life_support",
  "lab",
  "imaging",
  "ot_cssd",
  "dental_ent_ophthalmology",
  "facility_utility",
  "fire_safety",
  "it_device",
  "furniture_fixture",
  "mobility_transport",
  "housekeeping_laundry",
  "kitchen_dietary",
  "security_surveillance",
  "teaching_simulation",
  "camp_mobile",
  "general",
] as const;
export const storeDomainValues = [
  "pharmacy",
  "ndps_controlled",
  "medical_consumables",
  "surgical_consumables",
  "lab_reagents",
  "cssd_sterile",
  "linen_laundry",
  "kitchen_dietary",
  "housekeeping",
  "biomedical_spares",
  "it_store",
  "maintenance_engineering",
  "ppe_infection_control",
  "biomedical_waste",
  "blood_bank",
  "radiology_contrast",
  "stationery_forms",
  "camp_mobile",
  "general",
] as const;
export const assetCriticalityValues = ["critical", "high", "routine", "low"] as const;
export const assetCustodyModeValues = [
  "asset_tagged",
  "serialised",
  "pooled",
  "non_movable",
] as const;
export const campAssetReturnStatusValues = ["returned", "damaged", "lost"] as const;
export const dietTypeValues = [
  "regular",
  "diabetic",
  "renal",
  "cardiac",
  "liquid",
  "soft",
  "high_protein",
  "low_sodium",
  "npo",
  "custom",
] as const;
export const mealTypeValues = [
  "breakfast",
  "morning_snack",
  "lunch",
  "afternoon_snack",
  "dinner",
  "bedtime_snack",
] as const;
export const mealPrepStatusValues = [
  "pending",
  "preparing",
  "ready",
  "dispatched",
  "delivered",
] as const;
export const kitchenAuditTypeValues = ["routine", "surprise", "external"] as const;
export const caseMgmtStatusValues = [
  "assigned",
  "active",
  "pending_discharge",
  "discharged",
  "closed",
] as const;
export const caseMgmtPriorityValues = ["routine", "urgent", "complex"] as const;
export const dischargeBarrierTypeValues = [
  "insurance_auth",
  "placement",
  "equipment",
  "family",
  "transport",
  "financial",
  "clinical",
  "documentation",
  "other",
] as const;
export const caseReferralTypeValues = [
  "post_acute",
  "rehab",
  "home_health",
  "social_work",
  "hospice",
  "snf",
  "other",
] as const;
export const caseReferralStatusValues = [
  "pending",
  "accepted",
  "declined",
  "completed",
  "cancelled",
] as const;
export const cssdSterilizationMethodValues = [
  "steam",
  "eto",
  "plasma",
  "dry_heat",
  "flash",
] as const;
export const cssdIndicatorTypeValues = ["chemical", "biological"] as const;
export const cssdInstrumentCategoryValues = [
  "surgical",
  "diagnostic",
  "dental",
  "ophthalmic",
  "orthopedic",
  "endoscopy",
  "laparoscopy",
  "cardiology",
  "neurology",
  "urology",
  "gynecology",
  "ent",
  "other",
] as const;
export const cssdMaintenanceTypeValues = [
  "preventive",
  "corrective",
  "calibration",
  "validation",
  "inspection",
  "repair",
  "replacement",
  "cleaning",
  "other",
] as const;
export const ambulanceTypeValues = [
  "bls",
  "als",
  "patient_transport",
  "mortuary",
  "neonatal",
] as const;
export const ambulanceTripTypeValues = [
  "emergency",
  "scheduled",
  "inter_facility",
  "discharge",
] as const;
export const ambulanceTripPriorityValues = ["critical", "urgent", "routine"] as const;
export const ambulanceFuelTypeValues = ["diesel", "petrol", "cng", "electric"] as const;
export const ambulanceLicenseTypeValues = ["HMV", "LMV", "HPMV"] as const;
export const ambulanceShiftPatternValues = ["day", "night", "rotating"] as const;
export const ambulanceMaintenanceTypeValues = [
  "routine_service",
  "repair",
  "inspection",
  "fitness_renewal",
  "insurance_renewal",
] as const;
export const emergencyArrivalModeValues = ["walk_in", "ambulance", "police", "referred"] as const;
export const emergencyCodeTypeValues = [
  "code_blue",
  "code_yellow",
  "code_pink",
  "code_orange",
  "code_red",
  "code_silver",
  "code_black",
] as const;
export const emergencyCodeDeactivateOutcomeValues = [
  "resolved",
  "stable",
  "rosc",
  "transferred",
  "expired",
  "false_alarm",
  "escalated",
] as const;
export const emergencyResuscitationLogTypeValues = [
  "medication",
  "fluid",
  "procedure",
  "airway",
  "cpr",
  "defibrillation",
  "vitals",
  "note",
] as const;
export const emergencyMlcCaseTypeValues = [
  "assault",
  "rta",
  "burn",
  "poisoning",
  "sexual_assault",
  "suicide_attempt",
  "unknown",
] as const;
export const emergencyMlcBroughtByValues = ["police", "ambulance", "bystander", "self"] as const;
export const emergencyMlcPoliceSentViaValues = [
  "phone",
  "written_memo",
  "email",
  "police_portal",
  "in_person",
] as const;
export const emergencyMlcStatusValues = [
  "registered",
  "under_investigation",
  "opinion_given",
  "court_pending",
  "closed",
] as const;
export const emergencyMassCasualtyTypeValues = [
  "natural_disaster",
  "industrial",
  "transport",
  "violence",
  "other",
] as const;
export const emergencyMassCasualtyStatusValues = ["activated", "ongoing", "scaling_down"] as const;
export const orderSetContextValues = [
  "general",
  "admission",
  "pre_operative",
  "diagnosis_specific",
  "department_specific",
] as const;
export const orderSetItemTypeValues = ["lab", "medication", "nursing", "diet"] as const;
export const schedulingPriorityValues = ["low", "normal", "high", "urgent"] as const;
export const schedulingResourceTypeValues = ["doctor", "room", "equipment"] as const;
export const opdLabOrderPriorityFormSchema = z.enum(["routine", "urgent", "stat"]);
export const opdProcedureOrderPriorityFormSchema = z.enum(["routine", "urgent", "stat"]);
export const opdReferralUrgencyFormSchema = z.enum(["routine", "urgent", "emergency"]);
export const opdReferralUrgencyValues = opdReferralUrgencyFormSchema.options;
export const opdReminderPriorityFormSchema = z.enum(["low", "normal", "high", "urgent"]);
export const opdReminderTypeFormSchema = z.enum([
  "follow_up",
  "lab_review",
  "medication_review",
  "vaccination",
  "screening",
  "custom",
]);
export const opdProcedureConsentTypeFormSchema = z.enum([
  "procedure",
  "anesthesia",
  "blood_transfusion",
  "surgery",
  "investigation",
  "general",
]);
export const opdCertificateTypeFormSchema = z.enum([
  "medical",
  "fitness",
  "sick_leave",
  "disability",
  "death",
  "birth",
  "custom",
]);
export const opdRatingFormSchema = z.enum(["1", "2", "3", "4", "5"]);
export const otConsumableCategoryFormSchema = z.enum([
  "surgical_instrument",
  "implant",
  "disposable",
  "suture",
  "drug",
  "blood_product",
  "other",
]);
export const otCasePriorityFormSchema = z.enum(["elective", "urgent", "emergency"]);
export const otAsaClassificationFormSchema = z.enum([
  "asa_1",
  "asa_2",
  "asa_3",
  "asa_4",
  "asa_5",
  "asa_6",
]);
export const otPreopClearanceStatusFormSchema = z.enum([
  "pending",
  "cleared",
  "not_cleared",
  "conditional",
]);
export const otAnesthesiaTypeFormSchema = z.enum([
  "general",
  "spinal",
  "epidural",
  "regional_block",
  "local",
  "sedation",
  "combined",
]);
export const otPostopRecoveryStatusFormSchema = z.enum([
  "in_recovery",
  "stable",
  "shifted_to_ward",
  "shifted_to_icu",
  "discharged",
]);
export const otStatusReasonActionFormSchema = z.enum(["cancel", "postpone"]);
export const opdVisitTypeValues = [
  "walk_in",
  "booked",
  "follow_up",
  "referral",
  "emergency",
  "camp",
] as const;
export const damaRecordTypeValues = ["dama", "lama"] as const;
export const chronicProgramTypeValues = [
  "tb_dots",
  "hiv_art",
  "diabetes",
  "hypertension",
  "ckd",
  "copd",
  "asthma",
  "cancer_chemo",
  "mental_health",
  "epilepsy",
  "thyroid",
  "rheumatic",
  "other",
] as const;
export const departmentTypeValues = [
  "clinical",
  "pre_clinical",
  "para_clinical",
  "administrative",
  "support",
  "academic",
] as const;
export const facilityTypeValues = [
  "main_hospital",
  "medical_college",
  "dental_college",
  "nursing_college",
  "pharmacy_college",
  "ayush_hospital",
  "research_center",
  "blood_bank",
  "dialysis_center",
  "trauma_center",
  "burn_center",
  "rehabilitation_center",
  "palliative_care",
  "psychiatric_hospital",
  "eye_hospital",
  "maternity_hospital",
  "pediatric_hospital",
  "cancer_center",
  "cardiac_center",
  "neuro_center",
  "ortho_center",
  "day_care_center",
  "diagnostic_center",
  "telemedicine_hub",
  "community_health_center",
  "primary_health_center",
  "sub_center",
  "urban_health_center",
  "mobile_health_unit",
  "other",
] as const;
export const locationLevelValues = [
  "campus",
  "building",
  "floor",
  "wing",
  "zone",
  "room",
  "bed",
] as const;
export const serviceTypeValues = [
  "consultation",
  "procedure",
  "investigation",
  "nursing",
  "diet",
  "other",
] as const;
export const taxApplicabilityValues = ["taxable", "exempt", "zero_rated"] as const;
export const insuranceProviderTypeValues = ["private", "government", "tpa"] as const;
export const printTemplateTypeValues = [
  "letterhead",
  "prescription_pad",
  "invoice",
  "lab_report",
  "discharge_summary",
] as const;
export const printTemplateLogoPositionValues = ["left", "center", "right"] as const;
export const urReviewTypeValues = [
  "pre_admission",
  "admission",
  "continued_stay",
  "retrospective",
] as const;
export const urPatientStatusValues = ["inpatient", "observation"] as const;
export const urCommunicationTypeValues = [
  "initial_auth",
  "continued_stay",
  "denial_appeal",
  "peer_review",
  "info_request",
  "response",
] as const;
export const transportModeValues = [
  "wheelchair",
  "stretcher",
  "ambulance",
  "walking",
  "bed",
] as const;
export const transportPriorityValues = ["routine", "urgent", "emergency"] as const;
export const courtSummonsStatusValues = ["pending", "attended", "adjourned", "cancelled"] as const;
export const biowasteCategoryValues = [
  "yellow",
  "red",
  "white_translucent",
  "blue",
  "cytotoxic",
  "chemical",
  "radioactive",
] as const;
export const vendorPaymentTermsValues = ["net_30", "net_60", "net_90", "advance", "cod"] as const;
export const storeLocationTypeValues = [
  "main_store",
  "sub_store",
  "department_store",
  "pharmacy_store",
  "warehouse",
] as const;
export const supplierPaymentMethodValues = [
  "bank_transfer",
  "cheque",
  "cash",
  "upi",
  "demand_draft",
] as const;
export const orderBasketDrugFrequencyValues = [
  "OD",
  "BD",
  "TDS",
  "QID",
  "Q4H",
  "Q6H",
  "Q8H",
  "Q12H",
  "PRN",
  "STAT",
  "Once",
] as const;
export const orderBasketDrugRouteValues = [
  "PO",
  "IV",
  "IM",
  "SC",
  "Inhalation",
  "Topical",
  "PR",
  "SL",
  "Per NG",
] as const;
export const orderBasketLabPriorityValues = ["routine", "stat"] as const;
export const orderBasketRadiologyPriorityValues = ["routine", "urgent", "stat"] as const;
export const pharmacyStockTransactionTypeValues = [
  "receipt",
  "issue",
  "return",
  "adjustment",
] as const;
export const pharmacyNdpsActionValues = [
  "receipt",
  "dispensed",
  "destroyed",
  "transferred",
  "adjustment",
] as const;

export const genderFormSchema = z.enum(genderValues);
export const bloodGroupFormSchema = z.enum(bloodGroupValues);
export const maritalStatusFormSchema = z.enum(maritalStatusValues);
export const patientCategoryFormSchema = z.enum(patientCategoryValues);
export const registrationTypeFormSchema = z.enum(registrationTypeValues);
export const registrationSourceFormSchema = z.enum(registrationSourceValues);
export const financialClassFormSchema = z.enum(financialClassValues);
export const referredByKindFormSchema = z.enum(referredByKindValues);
export const drugScheduleFormSchema = z.enum(drugScheduleValues);
export const formularyStatusFormSchema = z.enum(formularyStatusValues);
export const awareCategoryFormSchema = z.enum(awareCategoryValues);
export const vendorTypeFormSchema = z.enum(vendorTypeValues);
export const supplyCategoryFormSchema = z.enum(supplyCategoryValues);
export const appointmentTypeFormSchema = z.enum(appointmentTypeValues);
export const appointmentRecurrenceFormSchema = z.enum(appointmentRecurrenceValues);
export const shareRelationFormSchema = z.enum(shareRelationValues);
export const sharingSubjectTypeFormSchema = z.enum(sharingSubjectTypeValues);
export const signerRoleFormSchema = z.enum(signerRoleValues);
export const paymentModeFormSchema = z.enum(paymentModeValues);
export const billingChargeSourceFormSchema = z.enum(billingChargeSourceValues);
export const billingPaymentModeFormSchema = z.enum(billingPaymentModeValues);
export const billingDiscountTypeFormSchema = z.enum(billingDiscountTypeValues);
export const billingServiceCategoryFormSchema = z.enum(billingServiceCategoryValues);
export const billingGstCategoryFormSchema = z.enum(billingGstCategoryValues);
export const billingAdvancePurposeFormSchema = z.enum(billingAdvancePurposeValues);
export const billingInsuranceClaimTypeFormSchema = z.enum(billingInsuranceClaimTypeValues);
export const billingInsuranceSchemeTypeFormSchema = z.enum(billingInsuranceSchemeTypeValues);
export const billingCreditPatientStatusFormSchema = z.enum(billingCreditPatientStatusValues);
export const billingTdsSectionFormSchema = z.enum(billingTdsSectionValues);
export const billingTdsQuarterFormSchema = z.enum(billingTdsQuarterValues);
export const billingGstrReturnTypeFormSchema = z.enum(billingGstrReturnTypeValues);
export const billingErpTargetSystemFormSchema = z.enum(billingErpTargetSystemValues);
export const billingErpExportTypeFormSchema = z.enum(billingErpExportTypeValues);
export const ipdAdmissionSourceFormSchema = z.enum([
  "er",
  "opd",
  "direct",
  "referral",
  "transfer_in",
]);
export const ipdTransferTypeFormSchema = z.enum([
  "inter_ward",
  "inter_department",
  "inter_hospital",
]);
export const ipdClinicalAssessmentTypeFormSchema = z.enum([
  "morse_fall_scale",
  "braden_scale",
  "gcs",
  "pain_vas",
  "pain_nrs",
  "pain_flacc",
  "barthel_adl",
  "norton_scale",
  "waterlow_score",
  "rass",
  "cam",
  "news2",
  "mews",
  "custom",
]);
export const ipdNursingTaskTypeFormSchema = z.enum(ipdNursingTaskTypeValues);
export const labSampleTypeFormSchema = z.enum(labSampleTypeValues);
export const labMethodFormSchema = z.enum(labMethodValues);
export const labCollectionCenterTypeFormSchema = z.enum(labCollectionCenterTypeValues);
export const labEqasEvaluationFormSchema = z.enum(labEqasEvaluationValues);
export const labNablDocumentTypeFormSchema = z.enum(labNablDocumentTypeValues);
export const labBethesdaCategoryFormSchema = z.enum(labBethesdaCategoryValues);
export const labMolecularTestMethodFormSchema = z.enum(labMolecularTestMethodValues);
export const labMolecularResultInterpretationFormSchema = z.enum(
  labMolecularResultInterpretationValues,
);
export const labB2bClientTypeFormSchema = z.enum(labB2bClientTypeValues);
export const campTypeFormSchema = z.enum(campTypeValues);
export const campIdProofTypeFormSchema = z.enum(campIdProofTypeValues);
export const campFollowupTypeFormSchema = z.enum(campFollowupTypeValues);
export const assetDomainFormSchema = z.enum(assetDomainValues);
export const storeDomainFormSchema = z.enum(storeDomainValues);
export const assetCriticalityFormSchema = z.enum(assetCriticalityValues);
export const assetCustodyModeFormSchema = z.enum(assetCustodyModeValues);
export const campAssetReturnStatusFormSchema = z.enum(campAssetReturnStatusValues);
export const dietTypeFormSchema = z.enum(dietTypeValues);
export const mealTypeFormSchema = z.enum(mealTypeValues);
export const mealPrepStatusFormSchema = z.enum(mealPrepStatusValues);
export const kitchenAuditTypeFormSchema = z.enum(kitchenAuditTypeValues);
export const caseMgmtStatusFormSchema = z.enum(caseMgmtStatusValues);
export const caseMgmtPriorityFormSchema = z.enum(caseMgmtPriorityValues);
export const dischargeBarrierTypeFormSchema = z.enum(dischargeBarrierTypeValues);
export const caseReferralTypeFormSchema = z.enum(caseReferralTypeValues);
export const caseReferralStatusFormSchema = z.enum(caseReferralStatusValues);
export const cssdSterilizationMethodFormSchema = z.enum(cssdSterilizationMethodValues);
export const cssdIndicatorTypeFormSchema = z.enum(cssdIndicatorTypeValues);
export const cssdInstrumentCategoryFormSchema = z.enum(cssdInstrumentCategoryValues);
export const cssdMaintenanceTypeFormSchema = z.enum(cssdMaintenanceTypeValues);
export const ambulanceTypeFormSchema = z.enum(ambulanceTypeValues);
export const ambulanceTripTypeFormSchema = z.enum(ambulanceTripTypeValues);
export const ambulanceTripPriorityFormSchema = z.enum(ambulanceTripPriorityValues);
export const ambulanceFuelTypeFormSchema = z.enum(ambulanceFuelTypeValues);
export const ambulanceLicenseTypeFormSchema = z.enum(ambulanceLicenseTypeValues);
export const ambulanceShiftPatternFormSchema = z.enum(ambulanceShiftPatternValues);
export const ambulanceMaintenanceTypeFormSchema = z.enum(ambulanceMaintenanceTypeValues);
export const emergencyArrivalModeFormSchema = z.enum(emergencyArrivalModeValues);
export const emergencyCodeTypeFormSchema = z.enum(emergencyCodeTypeValues);
export const emergencyCodeDeactivateOutcomeFormSchema = z.enum(
  emergencyCodeDeactivateOutcomeValues,
);
export const emergencyResuscitationLogTypeFormSchema = z.enum(emergencyResuscitationLogTypeValues);
export const emergencyMlcCaseTypeFormSchema = z.enum(emergencyMlcCaseTypeValues);
export const emergencyMlcBroughtByFormSchema = z.enum(emergencyMlcBroughtByValues);
export const emergencyMlcPoliceSentViaFormSchema = z.enum(emergencyMlcPoliceSentViaValues);
export const emergencyMlcStatusFormSchema = z.enum(emergencyMlcStatusValues);
export const emergencyMassCasualtyTypeFormSchema = z.enum(emergencyMassCasualtyTypeValues);
export const emergencyMassCasualtyStatusFormSchema = z.enum(emergencyMassCasualtyStatusValues);
export const orderSetContextFormSchema = z.enum(orderSetContextValues);
export const orderSetItemTypeFormSchema = z.enum(orderSetItemTypeValues);
export const schedulingPriorityFormSchema = z.enum(schedulingPriorityValues);
export const schedulingResourceTypeFormSchema = z.enum(schedulingResourceTypeValues);
export const opdVisitTypeFormSchema = z.enum(opdVisitTypeValues);
export const damaRecordTypeFormSchema = z.enum(damaRecordTypeValues);
export const chronicProgramTypeFormSchema = z.enum(chronicProgramTypeValues);
export const departmentTypeFormSchema = z.enum(departmentTypeValues);
export const facilityTypeFormSchema = z.enum(facilityTypeValues);
export const locationLevelFormSchema = z.enum(locationLevelValues);
export const serviceTypeFormSchema = z.enum(serviceTypeValues);
export const taxApplicabilityFormSchema = z.enum(taxApplicabilityValues);
export const insuranceProviderTypeFormSchema = z.enum(insuranceProviderTypeValues);
export const printTemplateTypeFormSchema = z.enum(printTemplateTypeValues);
export const printTemplateLogoPositionFormSchema = z.enum(printTemplateLogoPositionValues);
export const urReviewTypeFormSchema = z.enum(urReviewTypeValues);
export const urPatientStatusFormSchema = z.enum(urPatientStatusValues);
export const urCommunicationTypeFormSchema = z.enum(urCommunicationTypeValues);
export const transportModeFormSchema = z.enum(transportModeValues);
export const transportPriorityFormSchema = z.enum(transportPriorityValues);
export const courtSummonsStatusFormSchema = z.enum(courtSummonsStatusValues);
export const biowasteCategoryFormSchema = z.enum(biowasteCategoryValues);
export const vendorPaymentTermsFormSchema = z.enum(vendorPaymentTermsValues);
export const storeLocationTypeFormSchema = z.enum(storeLocationTypeValues);
export const supplierPaymentMethodFormSchema = z.enum(supplierPaymentMethodValues);
export const orderBasketDrugFrequencyFormSchema = z.enum(orderBasketDrugFrequencyValues);
export const orderBasketDrugRouteFormSchema = z.enum(orderBasketDrugRouteValues);
export const orderBasketLabPriorityFormSchema = z.enum(orderBasketLabPriorityValues);
export const orderBasketRadiologyPriorityFormSchema = z.enum(orderBasketRadiologyPriorityValues);
export const pharmacyStockTransactionTypeFormSchema = z.enum(pharmacyStockTransactionTypeValues);
export const pharmacyNdpsActionFormSchema = z.enum(pharmacyNdpsActionValues);
export const pharmacyPosPaymentModeFormSchema = z.enum([
  "cash",
  "card",
  "upi",
  "insurance",
  "credit",
]);
export const pharmacyPosPaymentModeValues = pharmacyPosPaymentModeFormSchema.options;

export const pharmacyCashDrawerOpenFormSchema = z.object({
  pharmacy_location_id: requiredTrimmed("Pharmacy location is required"),
  opening_float: nonNegativeNumber("Opening float cannot be negative"),
  notes: z.string(),
});

export const pharmacyCashDrawerCloseFormSchema = z.object({
  actual_close_amount: nonNegativeNumber("Actual counted cash cannot be negative"),
  variance_reason: z.string(),
});

export function toGenderFormValue(value: string | null): GenderFormValue {
  return genderFormSchema.catch("unknown").parse(value ?? "unknown");
}

export function toDrugScheduleFormValue(value: string | null): DrugScheduleFormValue {
  return drugScheduleFormSchema.catch("OTC").parse(value ?? "OTC");
}

export function toVendorTypeFormValue(value: string | null): VendorTypeFormValue {
  return vendorTypeFormSchema.catch("supplier").parse(value ?? "supplier");
}

export function toSupplyCategoryFormValues(values: string[]): SupplyCategoryFormValue[] {
  return values
    .map((value) => supplyCategoryFormSchema.safeParse(value))
    .filter((result): result is z.SafeParseSuccess<SupplyCategoryFormValue> => result.success)
    .map((result) => result.data);
}

export function toAppointmentTypeFormValue(value: string | null): AppointmentTypeFormValue {
  return appointmentTypeFormSchema.catch("new_visit").parse(value ?? "new_visit");
}

export function toAppointmentRecurrenceFormValue(
  value: string | null,
): AppointmentRecurrenceFormValue | null {
  if (!value) return null;
  const result = appointmentRecurrenceFormSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function toShareRelationFormValue(value: string | null): ShareRelationFormValue {
  return shareRelationFormSchema.catch("viewer").parse(value ?? "viewer");
}

export function toSharingSubjectTypeFormValue(value: string | null): SharingSubjectTypeFormValue {
  return sharingSubjectTypeFormSchema.catch("user").parse(value ?? "user");
}

export function parseSharingSubjectTypeFormValue(
  value: string,
): SharingSubjectTypeFormValue | null {
  const result = sharingSubjectTypeFormSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function toSignerRoleFormValue(value: string | null): SignerRoleFormValue {
  return signerRoleFormSchema.catch("patient").parse(value ?? "patient");
}

export function toChronicProgramTypeFormValue(value: string | null): ChronicProgramTypeFormValue {
  return chronicProgramTypeFormSchema.catch("other").parse(value ?? "other");
}

const setupCodeField = requiredTrimmed("Code is required", 20)
  .refine((value) => value.trim().length >= 2, "Code must be at least 2 characters")
  .refine(
    (value) => setupCodePattern.test(value.trim()),
    "Code must be uppercase alphanumeric with optional hyphens, no leading/trailing hyphen",
  );

const setupNameField = requiredTrimmed("Name is required", 100).refine(
  (value) => value.trim().length >= 2,
  "Name must be at least 2 characters",
);

const usernameField = requiredTrimmed("Username is required", 30)
  .refine((value) => value.length >= 3, "Username must be at least 3 characters")
  .refine(
    (value) => usernamePattern.test(value),
    "Username must start with a letter and contain only lowercase letters, digits, and underscores",
  );

const strongPasswordField = requiredTrimmed("Temporary password is required")
  .refine((value) => value.length >= 8, "Password must be at least 8 characters")
  .refine((value) => /[A-Z]/.test(value), "Password must contain at least one uppercase letter")
  .refine((value) => /[a-z]/.test(value), "Password must contain at least one lowercase letter")
  .refine((value) => /\d/.test(value), "Password must contain at least one digit")
  .refine(
    (value) => /[^A-Za-z0-9]/.test(value),
    "Password must contain at least one special character",
  );

const optionalPhone = z
  .string()
  .refine(
    (value) => value.trim().length === 0 || phonePattern.test(value.trim()),
    "Phone must contain only digits, +, -, spaces, and parentheses",
  );

const requiredPhone = requiredTrimmed("Phone is required").refine(
  (value) => phonePattern.test(value.trim()),
  "Phone must contain only digits, +, -, spaces, and parentheses",
);

const optionalEmail = z
  .string()
  .optional()
  .refine(
    (value) =>
      !value ||
      value.trim().length === 0 ||
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value.trim()),
    "Invalid email address",
  );

const optionalEmailText = z
  .string()
  .refine(
    (value) =>
      value.trim().length === 0 ||
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value.trim()),
    "Invalid email address",
  );

const optionalAbhaNumber = z
  .string()
  .optional()
  .refine((value) => {
    if (!value || value.trim().length === 0) return true;
    const digits = value.replace(/\D/g, "");
    return digits.length === 14;
  }, "ABHA number must be 14 digits");

const optionalAadhaarNumber = z
  .string()
  .optional()
  .refine((value) => {
    if (!value || value.trim().length === 0) return true;
    const digits = value.replace(/\D/g, "");
    return digits.length === 12;
  }, "Aadhaar must be a 12 digit number");

const requiredNullableString = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => !!value && value.trim().length > 0, message);

const optionalIsoDate = z
  .string()
  .optional()
  .refine((value) => !value || isoDatePattern.test(value), "Enter a valid date");

const requiredNullableIsoDate = (message: string) =>
  z
    .string()
    .nullable()
    .refine((value) => !!value && isoDatePattern.test(value), message);

export const miniRegisterPatientFormSchema = z.object({
  first_name: requiredTrimmed("First name is required", 100),
  last_name: requiredTrimmed("Last name / initial is required", 100),
  phone: optionalPhone,
  date_of_birth: z.string(),
  gender: genderFormSchema,
  duplicate_checked: z.boolean(),
});

export const patientAllergyTypeFormSchema = z.enum([
  "drug",
  "food",
  "environmental",
  "latex",
  "contrast_dye",
  "biological",
  "other",
]);

export const patientAllergySeverityFormSchema = z.enum([
  "mild",
  "moderate",
  "severe",
  "life_threatening",
]);

export const patientFamilyRelationshipFormSchema = z.enum([
  "father",
  "mother",
  "spouse",
  "child",
  "sibling",
  "guardian",
  "other",
]);

export const patientDocumentTypeFormSchema = z.enum([
  "id_proof",
  "consent_form",
  "referral_letter",
  "photo",
  "report",
  "prescription",
  "discharge_summary",
  "insurance_card",
  "other",
]);

export const patientDetailAllergyFormSchema = z.object({
  allergy_type: patientAllergyTypeFormSchema,
  allergen_name: requiredTrimmed("Allergen name is required", 255),
  severity: patientAllergySeverityFormSchema.nullable(),
  reaction: z.string().max(1000, "Reaction must be at most 1000 characters"),
});

export const patientDetailFamilyLinkFormSchema = z.object({
  related_patient_id: requiredTrimmed("Select a patient to link"),
  relationship: patientFamilyRelationshipFormSchema,
});

export const patientDetailDocumentFormSchema = z.object({
  document_type: patientDocumentTypeFormSchema,
  document_name: requiredTrimmed("Document name is required", 255),
  file_url: requiredTrimmed("File URL is required", 2048),
  notes: z.string().max(1000, "Notes must be at most 1000 characters"),
});

export const patientMergeFormSchema = z.object({
  merged_patient_id: requiredTrimmed("Select a duplicate patient"),
  merge_reason: requiredTrimmed("Merge reason is required", 1000),
});

export const patientRegistrationFormSchema = z
  .object({
    prefix: z.string().optional(),
    first_name: z.string().max(100, "First name must be at most 100 characters"),
    middle_name: z.string().optional(),
    last_name: z.string().max(100, "Last name must be at most 100 characters"),
    is_unknown_patient: z.boolean().optional(),
    suffix: z.string().optional(),
    date_of_birth: z.date().nullable().optional(),
    age_years: z.number().int().min(0).max(125).optional(),
    gender: genderFormSchema,
    blood_group: bloodGroupFormSchema.optional(),
    marital_status: maritalStatusFormSchema.optional(),
    religion: z.string().optional(),
    occupation: z.string().optional(),
    phone: optionalPhone,
    phone_secondary: optionalPhone.optional(),
    email: optionalEmail,
    father_name: z.string().optional(),
    guardian_name: z.string().optional(),
    guardian_relation: z.string().optional(),
    category: patientCategoryFormSchema.optional(),
    registration_type: registrationTypeFormSchema.optional(),
    registration_source: registrationSourceFormSchema.optional(),
    financial_class: financialClassFormSchema.optional(),
    abha_number: optionalAbhaNumber,
    abha_address: z.string().optional(),
    aadhaar_number: optionalAadhaarNumber,
    referred_by_kind: referredByKindFormSchema.optional(),
    referred_by_user_id: z.string().optional(),
    referred_by_name: z.string().optional(),
    referred_by_phone: optionalPhone.optional(),
    referred_by_facility: z.string().optional(),
    department_id: z.string().optional(),
    consultant_id: z.string().optional(),
    clinical_unit: z.string().optional(),
    camp_id: z.string().optional(),
    camp_name: z.string().optional(),
    initial_diagnosis_text: z.string().optional(),
    icd10_code: z.string().optional(),
    icd11_code: z.string().optional(),
    icd11_display: z.string().optional(),
    icd11_source_url: z.string().optional(),
    icd11_source_version: z.string().optional(),
    icd11_provider_mode: z.string().optional(),
    is_medico_legal: z.boolean().optional(),
    mlc_number: z.string().optional(),
    is_vip: z.boolean().optional(),
    allergy_status: z.enum(["not_asked_yet", "no_known_allergies", "known_allergies"]).optional(),
    known_allergies: z.string().optional(),
    drug_allergies: z.string().optional(),
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    district: z.string().optional(),
    state: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().optional(),
    landmark: z.string().optional(),
    next_of_kin_name: z.string().optional(),
    next_of_kin_relation: z.string().optional(),
    next_of_kin_phone: optionalPhone.optional(),
    emergency_contact_name: z.string().optional(),
    emergency_contact_phone: optionalPhone.optional(),
    emergency_contact_relation: z.string().optional(),
    preferred_room_class: z.string().optional(),
    dietary_preference: z.string().optional(),
    dietary_restrictions: z.string().optional(),
    religious_observances: z.string().optional(),
    language_preference: z.string().optional(),
    primary_physician_id: z.string().optional(),
    primary_physician_name: z.string().optional(),
    secondary_insurance_provider: z.string().optional(),
    secondary_insurance_policy_no: z.string().optional(),
    attendant_passes_count: optionalNonNegativeIntegerString,
    create_opd_visit: z.boolean().optional(),
    open_opd_after_registration: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.is_unknown_patient) {
      if (!hasTrimmedValue(value.first_name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["first_name"],
          message: "First name is required",
        });
      }
      if (!hasTrimmedValue(value.last_name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["last_name"],
          message: "Last name is required",
        });
      }
      if (!hasTrimmedValue(value.phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["phone"],
          message: "Phone is required",
        });
      }
      if (!value.date_of_birth && typeof value.age_years !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["age_years"],
          message: "Enter age or pick date of birth",
        });
      }
      if (!value.gender || value.gender === "unknown") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["gender"],
          message: "Gender is required",
        });
      }
    }

    if (
      !value.allergy_status ||
      !["not_asked_yet", "no_known_allergies", "known_allergies"].includes(value.allergy_status)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allergy_status"],
        message: "Confirm allergy state (Not asked / No known / Known)",
      });
    }

    const isCamp = value.registration_type === "camp" || value.registration_source === "camp";
    if (isCamp && !value.camp_id && !hasTrimmedValue(value.camp_name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["camp_id"],
        message: "Select a camp reference or enter the village / school camp name",
      });
    }

    const isReferral =
      value.registration_type === "referral" || value.registration_source === "referral";
    if (
      isReferral &&
      !value.referred_by_user_id &&
      !hasTrimmedValue(value.referred_by_name) &&
      !hasTrimmedValue(value.referred_by_facility)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referred_by_name"],
        message: "Referral source is required",
      });
    }

    if (
      value.referred_by_kind &&
      value.referred_by_kind !== "self" &&
      !value.referred_by_user_id &&
      !hasTrimmedValue(value.referred_by_name) &&
      !hasTrimmedValue(value.referred_by_facility)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["referred_by_name"],
        message: "Enter who referred the patient",
      });
    }

    if (value.is_medico_legal && !hasTrimmedValue(value.mlc_number)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mlc_number"],
        message: "MLC number is required for medico-legal patients",
      });
    }

    if (value.create_opd_visit && !hasTrimmedValue(value.department_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["department_id"],
        message: "Select a department to send the patient to OPD",
      });
    }

    if (value.create_opd_visit && isCamp && !hasTrimmedValue(value.camp_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["camp_id"],
        message: "Select an existing camp before sending camp patient to OPD",
      });
    }
  });

export const miniAddDrugFormSchema = z.object({
  name: requiredTrimmed("Drug name is required"),
  generic_name: z.string(),
  code: requiredTrimmed("Code is required"),
  unit: z.string(),
  base_price: nonNegativeNumber("Enter a valid amount"),
  reorder_level: nonNegativeInteger("Enter a valid whole number"),
  drug_schedule: drugScheduleFormSchema,
});

export const pharmacyCatalogFormSchema = z.object({
  code: requiredTrimmed("Code is required", 80),
  name: requiredTrimmed("Drug name is required", 255),
  generic_name: z.string(),
  category: z.string(),
  manufacturer: z.string(),
  unit: z.string(),
  base_price: formNumberValue
    .refine(
      (value) => typeof value === "number" || value.trim().length > 0,
      "Base price is required",
    )
    .refine((value) => {
      const parsed = typeof value === "number" ? value : Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }, "Base price cannot be negative"),
  tax_percent: nonNegativeNumber("Tax percent cannot be negative").refine((value) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed <= 100;
  }, "Tax percent cannot exceed 100"),
  reorder_level: nonNegativeInteger("Reorder level must be a whole number"),
  drug_schedule: drugScheduleFormSchema.optional(),
  formulary_status: formularyStatusFormSchema.optional(),
  aware_category: awareCategoryFormSchema.optional(),
  inn_name: z.string(),
  atc_code: z.string(),
  is_controlled: z.boolean(),
});

export const miniAddLabTestFormSchema = z.object({
  name: requiredTrimmed("Test name is required"),
  code: requiredTrimmed("Code is required"),
  sample_type: z.string(),
  unit: z.string(),
  price: nonNegativeNumber("Enter a valid amount"),
  tat_hours: positiveInteger("Enter a positive whole number"),
  loinc_code: z.string(),
});

const orderBasketDurationDays = formNumberValue.refine((value) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 365;
}, "Duration must be a whole number from 0 to 365");

const orderBasketQuantity = formNumberValue.refine((value) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 1;
}, "Quantity must be a whole number greater than 0");

export const orderBasketDrugFormSchema = z
  .object({
    drug_id: requiredTrimmed("Select a drug"),
    dose: requiredTrimmed("Dose is required", 80),
    frequency: orderBasketDrugFrequencyFormSchema,
    route: orderBasketDrugRouteFormSchema,
    duration_days: orderBasketDurationDays,
    quantity: orderBasketQuantity,
    indication: z.string(),
    schedule_x_serial: z.string(),
    is_schedule_x: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.is_schedule_x && value.schedule_x_serial.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["schedule_x_serial"],
        message: "Schedule X paper Rx serial number is required",
      });
    }
  });

export const orderBasketLabFormSchema = z.object({
  test_id: requiredTrimmed("Select a lab test"),
  priority: orderBasketLabPriorityFormSchema,
  indication: z.string(),
  notes: z.string(),
});

export const orderBasketRadiologyFormSchema = z.object({
  modality_id: requiredTrimmed("Select a radiology modality"),
  body_part: z.string(),
  clinical_indication: z.string(),
  priority: orderBasketRadiologyPriorityFormSchema,
  contrast_required: z.boolean(),
  pregnancy_checked: z.boolean(),
  allergy_flagged: z.boolean(),
  notes: z.string(),
});

const positiveFormInteger = formNumberValue.refine((value) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 1;
}, "Enter a whole number greater than 0");

export const pharmacyStockTransactionFormSchema = z.object({
  catalog_item_id: requiredTrimmed("Select a drug"),
  transaction_type: pharmacyStockTransactionTypeFormSchema,
  quantity: positiveFormInteger,
  notes: z.string(),
});

export const pharmacyNdpsEntryFormSchema = z.object({
  catalog_item_id: requiredTrimmed("Select a controlled drug"),
  action: pharmacyNdpsActionFormSchema,
  quantity: positiveFormInteger,
  notes: z.string(),
  witnessed_by: z.string(),
});

export const pharmacyReturnRequestItemFormSchema = z.object({
  order_item_id: requiredTrimmed("Select a dispensed medicine"),
  quantity_returned: positiveFormInteger,
  reason: z.string(),
});

export const pharmacyReturnRequestFormSchema = z.object({
  patient_id: requiredTrimmed("Select a patient"),
  items: z
    .array(pharmacyReturnRequestItemFormSchema)
    .min(1, "Select at least one dispensed medicine"),
});

export const pharmacyOrderItemFormSchema = z.object({
  catalog_item_id: z.string().optional(),
  drug_name: requiredTrimmed("Select a medicine"),
  quantity: positiveFormInteger,
  unit_price: nonNegativeNumber("Unit price cannot be negative"),
  tax_percent: nonNegativeNumber("GST cannot be negative"),
});

export const pharmacyOrderFormSchema = z.object({
  patient_id: requiredTrimmed("Select a patient"),
  notes: z.string(),
  safety_override_reason: z.string(),
  items: z.array(pharmacyOrderItemFormSchema).min(1, "Add at least one medicine"),
});

export const pharmacyPosSaleItemFormSchema = z.object({
  catalog_item_id: requiredTrimmed("Select a drug"),
  drug_name: requiredTrimmed("Drug name is required"),
  quantity: positiveFormInteger,
  unit_price: positiveNumber("Selling price must be greater than zero"),
});

export const pharmacyPosSaleFormSchema = z.object({
  patient_id: z.string(),
  patient_name: z.string(),
  patient_phone: z.string(),
  payment_mode: pharmacyPosPaymentModeFormSchema,
  amount_received: nonNegativeNumber("Amount received cannot be negative"),
  discount_percent: nonNegativeNumber("Discount cannot be negative").refine((value) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed <= 100;
  }, "Discount cannot exceed 100%"),
  items: z.array(pharmacyPosSaleItemFormSchema).min(1, "Add at least one medicine"),
});

export const pharmacyPosReturnItemFormSchema = z.object({
  item_id: requiredTrimmed("Sale item is required"),
  drug_name: requiredTrimmed("Drug name is required"),
  batch_number: z.string(),
  max_qty: nonNegativeNumber("Returnable quantity cannot be negative"),
  return_qty: optionalNonNegativeIntegerNumber("Return quantity must be a whole number"),
  unit_price: nonNegativeNumber("Unit price cannot be negative"),
});

export const pharmacyPosReturnFormSchema = z
  .object({
    reason: requiredTrimmed("Return reason is required", 255).refine(
      (value) => value.trim().length >= 3,
      "Enter at least 3 characters",
    ),
    items: z.array(pharmacyPosReturnItemFormSchema),
  })
  .superRefine((value, ctx) => {
    let hasReturn = false;

    value.items.forEach((item, index) => {
      const returnQty = Number(item.return_qty || 0);
      const maxQty = Number(item.max_qty || 0);
      if (returnQty > 0) {
        hasReturn = true;
      }
      if (returnQty > maxQty) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "return_qty"],
          message: "Return quantity cannot exceed remaining sale quantity",
        });
      }
    });

    if (!hasReturn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "Select at least one medicine to return",
      });
    }
  });

export const pharmacyRxReviewActionFormSchema = z.enum(["approved", "rejected", "on_hold"]);
export const pharmacyRxReviewActionValues = pharmacyRxReviewActionFormSchema.options;

export const pharmacyRxReviewItemFormSchema = z.object({
  prescription_item_id: requiredTrimmed("Prescription item is required"),
  catalog_item_id: z.string().nullable().optional(),
  quantity: positiveFormInteger,
  unit_price: nonNegativeNumber("Unit price cannot be negative"),
});

export const pharmacyRxReviewFormSchema = z
  .object({
    action: pharmacyRxReviewActionFormSchema,
    notes: z.string(),
    rejection_reason: z.string(),
    items: z.array(pharmacyRxReviewItemFormSchema),
  })
  .superRefine((value, ctx) => {
    if (value.action === "rejected" && value.rejection_reason.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejection_reason"],
        message: "Rejection reason is required",
      });
    }
  });

export const miniAddVendorFormSchema = z
  .object({
    name: requiredTrimmed("Vendor name is required"),
    code: requiredTrimmed("Code is required"),
    vendor_type: vendorTypeFormSchema,
    contact_person: z.string(),
    phone: z.string(),
    email: z.string(),
    gst_number: z.string(),
    supply_categories: z.array(supplyCategoryFormSchema),
    is_pharmacy_vendor: z.boolean(),
    drug_license_number: z.string(),
  })
  .superRefine((value, ctx) => {
    const requiresDrugLicense =
      value.is_pharmacy_vendor || value.supply_categories.includes("pharmacy");
    if (requiresDrugLicense && value.drug_license_number.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["drug_license_number"],
        message: "Drug license number is required",
      });
    }
  });

export const subscribePackageFormSchema = z.object({
  package_id: requiredNullableString("Package is required"),
  total_paid: nonNegativeNumber("Amount cannot be negative"),
  notes: z.string(),
});

export const paymentFormSchema = z.object({
  mode: paymentModeFormSchema,
  cashReceived: nonNegativeNumber("Cash received is required"),
  utrReference: z.string(),
});

const boundedTaxPercent = nonNegativeNumber("Tax percent cannot be negative").refine((value) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed <= 100;
}, "Tax percent cannot exceed 100");

export const billingInvoiceItemFormSchema = z.object({
  charge_code: requiredTrimmed("Charge code is required", 80),
  description: requiredTrimmed("Description is required", 255),
  source: billingChargeSourceFormSchema,
  quantity: positiveFormInteger,
  unit_price: nonNegativeNumber("Unit price cannot be negative"),
  tax_percent: boundedTaxPercent,
});

export const billingPaymentFormSchema = z.object({
  amount: positiveNumber("Payment amount must be greater than zero"),
  mode: billingPaymentModeFormSchema,
  reference_number: z.string(),
});

export const billingCreateInvoiceFormSchema = z.object({
  patient_id: requiredTrimmed("validation.patientRequired"),
  encounter_id: z.string(),
  admission_id: z.string(),
  notes: z.string(),
});

export const billingDiscountFormSchema = z.object({
  discount_type: billingDiscountTypeFormSchema,
  discount_value: positiveNumber("Discount value must be greater than zero"),
  reason: z.string(),
});

export const billingErFastInvoiceFormSchema = z.object({
  emergency_visit_id: requiredTrimmed("Emergency visit is required"),
});

export const billingChargeMasterFormSchema = z.object({
  code: requiredTrimmed("Charge code is required", 80),
  name: requiredTrimmed("Charge name is required", 255),
  category: billingServiceCategoryFormSchema,
  base_price: nonNegativeNumber("Base price cannot be negative"),
  tax_percent: boundedTaxPercent,
  hsn_sac_code: z.string(),
  gst_category: billingGstCategoryFormSchema.optional(),
});

export const billingRefundFormSchema = z.object({
  invoice_id: requiredTrimmed("Invoice is required"),
  amount: positiveNumber("Refund amount must be greater than zero"),
  reason: requiredTrimmed("Refund reason is required", 255),
  mode: billingPaymentModeFormSchema,
  reference_number: z.string(),
});

export const billingReceiptReprintFormSchema = z.object({
  reprint_reason: requiredTrimmed("Reprint reason is required", 255).refine(
    (value) => value.trim().length >= 5,
    "Enter at least 5 characters",
  ),
});

export const billingCreditNoteFormSchema = z.object({
  invoice_id: requiredTrimmed("Invoice is required"),
  amount: positiveNumber("Credit note amount must be greater than zero"),
  reason: requiredTrimmed("Credit note reason is required", 255),
});

export const billingCreditNoteApplyFormSchema = z.object({
  invoice_id: requiredTrimmed("Target invoice is required"),
});

export const billingWriteOffFormSchema = z.object({
  invoice_id: requiredTrimmed("Invoice is required"),
  amount: positiveNumber("Write-off amount must be greater than zero"),
  reason: requiredTrimmed("Write-off reason is required", 255),
  notes: z.string(),
});

export const billingPackageItemFormSchema = z.object({
  charge_code: requiredTrimmed("Charge code is required", 80),
  description: requiredTrimmed("Description is required", 255),
  quantity: positiveFormInteger,
  unit_price: nonNegativeNumber("Unit price cannot be negative"),
});

export const billingPackageFormSchema = z.object({
  code: requiredTrimmed("Package code is required", 80),
  name: requiredTrimmed("Package name is required", 255),
  description: z.string(),
  total_price: nonNegativeNumber("Total price cannot be negative"),
  discount_percent: boundedTaxPercent,
  items: z.array(billingPackageItemFormSchema).min(1, "At least one package item is required"),
});

export const billingRatePlanItemFormSchema = z.object({
  charge_code: requiredTrimmed("Charge code is required", 80),
  override_price: nonNegativeNumber("Override price cannot be negative"),
});

export const billingRatePlanFormSchema = z.object({
  name: requiredTrimmed("Rate plan name is required", 255),
  description: z.string(),
  patient_category: z.string(),
  items: z.array(billingRatePlanItemFormSchema).min(1, "At least one price override is required"),
});

export const billingAdvanceFormSchema = z.object({
  patient_id: requiredTrimmed("Patient is required"),
  encounter_id: z.string(),
  amount: positiveNumber("Advance amount must be greater than zero"),
  payment_mode: billingPaymentModeFormSchema,
  reference_number: z.string(),
  purpose: billingAdvancePurposeFormSchema,
  notes: z.string(),
});

export const billingAdvanceAdjustmentFormSchema = z.object({
  invoice_id: requiredTrimmed("Invoice is required"),
  amount: positiveNumber("Adjustment amount must be greater than zero"),
  notes: z.string(),
});

export const billingAdvanceRefundFormSchema = z.object({
  amount: positiveNumber("Refund amount must be greater than zero"),
  reason: requiredTrimmed("Refund reason is required", 255),
  mode: billingPaymentModeFormSchema,
  reference_number: z.string(),
});

export const billingCorporateFormSchema = z.object({
  code: requiredTrimmed("Corporate code is required", 80),
  name: requiredTrimmed("Corporate name is required", 255),
  gst_number: z.string(),
  billing_address: z.string(),
  contact_email: optionalEmailText,
  contact_phone: optionalPhone,
  credit_limit: optionalNumericFormValue("Credit limit cannot be negative", 0),
  credit_days: optionalNonNegativeIntegerNumber("Credit days must be a whole number"),
  agreed_discount_percent: optionalNumericFormValue(
    "Discount percent must be between 0 and 100",
    0,
    100,
  ),
});

export const billingCorporateUpdateFormSchema = z.object({
  name: requiredTrimmed("Corporate name is required", 255),
  gst_number: z.string(),
  billing_address: z.string(),
  contact_email: optionalEmailText,
  contact_phone: optionalPhone,
  credit_limit: optionalNumericFormValue("Credit limit cannot be negative", 0),
  credit_days: optionalNonNegativeIntegerNumber("Credit days must be a whole number"),
  agreed_discount_percent: optionalNumericFormValue(
    "Discount percent must be between 0 and 100",
    0,
    100,
  ),
  is_active: z.boolean(),
});

export const billingCorporateEnrollmentFormSchema = z.object({
  patient_id: requiredTrimmed("Patient is required"),
  employee_id: z.string(),
  department: z.string(),
});

export const billingDayCloseFormSchema = z.object({
  close_date: optionalIsoDateString.refine(
    (value) => value.trim().length > 0,
    "Close date is required",
  ),
  actual_cash: nonNegativeNumber("Actual cash cannot be negative"),
  notes: z.string(),
});

export const billingInsuranceClaimFormSchema = z.object({
  invoice_id: requiredTrimmed("Invoice is required"),
  patient_id: requiredTrimmed("Patient is required"),
  insurance_provider: requiredTrimmed("Insurance provider is required", 255),
  policy_number: z.string(),
  claim_type: billingInsuranceClaimTypeFormSchema,
  pre_auth_amount: optionalNumericFormValue("Pre-auth amount cannot be negative", 0),
  scheme_type: z.union([billingInsuranceSchemeTypeFormSchema, z.literal("")]),
  tpa_name: z.string(),
  co_pay_percent: optionalNumericFormValue("Co-pay percent must be between 0 and 100", 0, 100),
  deductible_amount: optionalNumericFormValue("Deductible amount cannot be negative", 0),
  member_id: z.string(),
  scheme_card_number: z.string(),
  notes: z.string(),
});

export const billingTpaRateCardFormSchema = z
  .object({
    tpa_name: requiredTrimmed("TPA name is required", 255),
    insurance_provider: requiredTrimmed("Insurance provider is required", 255),
    scheme_type: z.union([billingInsuranceSchemeTypeFormSchema, z.literal("")]),
    rate_plan_id: requiredTrimmed("Rate plan is required"),
    valid_from: optionalIsoDateString,
    valid_to: optionalIsoDateString,
    is_active: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const from = value.valid_from.trim();
    const to = value.valid_to.trim();
    if (from && to && to < from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valid_to"],
        message: "Valid to date must be after valid from date",
      });
    }
  });

export const billingConcessionFormSchema = z.object({
  invoice_id: requiredTrimmed("Invoice is required"),
  invoice_item_id: requiredTrimmed("Invoice item is required"),
  concession_type: requiredTrimmed("Concession type is required", 80),
  concession_amount: positiveNumber("Concession amount must be greater than zero"),
  reason: requiredTrimmed("Reason is required", 255),
});

export const billingCreditPatientFormSchema = z.object({
  patient_id: requiredTrimmed("Patient is required"),
  credit_limit: nonNegativeNumber("Credit limit cannot be negative"),
  notes: z.string(),
  status: z.union([billingCreditPatientStatusFormSchema, z.literal("")]),
});

export const billingTdsFormSchema = z.object({
  invoice_id: z.string(),
  deductee_name: requiredTrimmed("Deductee name is required", 255),
  deductee_pan: requiredTrimmed("PAN is required", 10).refine(
    (value) => panPattern.test(value.trim().toUpperCase()),
    "Enter a valid PAN",
  ),
  tds_section: billingTdsSectionFormSchema,
  tds_rate: boundedTaxPercent,
  base_amount: nonNegativeNumber("Base amount cannot be negative"),
  deducted_date: optionalIsoDateString.refine(
    (value) => value.trim().length > 0,
    "Deducted date is required",
  ),
  financial_year: requiredTrimmed("Financial year is required", 7).refine(
    (value) => financialYearPattern.test(value.trim()),
    "Use YYYY-YY financial year format",
  ),
  quarter: billingTdsQuarterFormSchema,
});

export const billingGstrFormSchema = z.object({
  return_type: billingGstrReturnTypeFormSchema,
  period: requiredTrimmed("Period is required", 7).refine(
    (value) => yearMonthPattern.test(value.trim()),
    "Use YYYY-MM period format",
  ),
});

export const billingErpExportFormSchema = z
  .object({
    target_system: billingErpTargetSystemFormSchema,
    export_type: billingErpExportTypeFormSchema,
    date_from: optionalIsoDateString,
    date_to: optionalIsoDateString,
  })
  .superRefine((value, ctx) => {
    const from = value.date_from.trim();
    const to = value.date_to.trim();
    if (from && to && to < from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["date_to"],
        message: "To date must be after from date",
      });
    }
  });

export const billingJournalLineFormSchema = z
  .object({
    account_id: requiredTrimmed("GL account is required"),
    department_id: z.string(),
    debit_amount: nonNegativeNumber("Debit cannot be negative"),
    credit_amount: nonNegativeNumber("Credit cannot be negative"),
    narration: z.string(),
  })
  .superRefine((value, ctx) => {
    const debit =
      typeof value.debit_amount === "number" ? value.debit_amount : Number(value.debit_amount);
    const credit =
      typeof value.credit_amount === "number" ? value.credit_amount : Number(value.credit_amount);
    if (debit > 0 && credit > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["credit_amount"],
        message: "Use either debit or credit for a line, not both",
      });
    }
    if (debit === 0 && credit === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["debit_amount"],
        message: "Enter a debit or credit amount",
      });
    }
  });

export const billingJournalEntryFormSchema = z
  .object({
    entry_date: optionalIsoDateString.refine(
      (value) => value.trim().length > 0,
      "Entry date is required",
    ),
    description: z.string(),
    reference_type: z.string(),
    reference_id: z.string(),
    lines: z.array(billingJournalLineFormSchema).min(2, "At least two journal lines are required"),
  })
  .superRefine((value, ctx) => {
    const totalDebit = value.lines.reduce((sum, line) => {
      const amount =
        typeof line.debit_amount === "number" ? line.debit_amount : Number(line.debit_amount);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    const totalCredit = value.lines.reduce((sum, line) => {
      const amount =
        typeof line.credit_amount === "number" ? line.credit_amount : Number(line.credit_amount);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    if (Math.abs(totalDebit - totalCredit) >= 0.01 || totalDebit <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lines"],
        message: "Debits and credits must balance and be greater than zero",
      });
    }
  });

export const ipdNursingTaskFormSchema = z.object({
  task_type: ipdNursingTaskTypeFormSchema,
  description: requiredTrimmed("Task description is required", 255),
  assigned_to: z.string(),
  notes: z.string(),
});

export const ipdAdmissionFormSchema = z.object({
  patient_id: requiredTrimmed("Patient is required"),
  department_id: requiredTrimmed("Department is required"),
  doctor_id: z.string(),
  bed_id: z.string(),
  ward_id: z.string(),
  admission_source: ipdAdmissionSourceFormSchema.nullable(),
  referral_from: z.string(),
  referral_doctor: z.string(),
  referral_notes: z.string(),
  admission_weight_kg: optionalNumericFormValue("Weight must be between 0 and 500", 0, 500),
  admission_height_cm: optionalNumericFormValue("Height must be between 0 and 300", 0, 300),
  expected_discharge_date: z.string(),
  notes: z.string(),
});

export const ipdAdmissionReprintFormSchema = z.object({
  reprint_reason: requiredTrimmed("Reprint reason is required", 255).refine(
    (value) => value.trim().length >= 5,
    "Enter at least 5 characters",
  ),
});

export const ipdTariffConfigFormSchema = z.object({
  daily_rate: nonNegativeNumber("Room daily rate cannot be negative"),
  nursing_charge: nonNegativeNumber("Nursing charge cannot be negative"),
  deposit_required: nonNegativeNumber("Deposit cannot be negative"),
  billing_alert_threshold: optionalNumericFormValue("Billing threshold cannot be negative", 0),
  auto_billing_enabled: z.boolean(),
});

export const ipdWristbandReprintFormSchema = z.object({
  reprint_reason: requiredTrimmed("Reprint reason is required", 255).refine(
    (value) => value.trim().length >= 5,
    "Enter at least 5 characters",
  ),
});

export const ipdTransferFormSchema = z.object({
  transfer_type: ipdTransferTypeFormSchema,
  reason: requiredTrimmed("Reason for transfer is required", 500).refine(
    (value) => value.trim().length >= 3,
    "Enter at least 3 characters",
  ),
  clinical_summary: z.string().max(2000, "Clinical summary must be at most 2000 characters"),
});

export const opdCertificateVoidFormSchema = z.object({
  void_reason: requiredTrimmed("Void reason is required", 255).refine(
    (value) => value.trim().length >= 5,
    "Enter at least 5 characters",
  ),
});

export const opdCertificateReprintFormSchema = z.object({
  reprint_reason: requiredTrimmed("Reprint reason is required", 255).refine(
    (value) => value.trim().length >= 5,
    "Enter at least 5 characters",
  ),
});

export const opdConsentRevokeFormSchema = z.object({
  withdrawal_reason: requiredTrimmed("Withdrawal reason is required", 255).refine(
    (value) => value.trim().length >= 5,
    "Enter at least 5 characters",
  ),
});

export const opdConsentReprintFormSchema = z.object({
  reprint_reason: requiredTrimmed("Reprint reason is required", 255).refine(
    (value) => value.trim().length >= 5,
    "Enter at least 5 characters",
  ),
});

export const ipdProgressNoteFormSchema = z.object({
  note_type: ipdProgressNoteTypeFormSchema,
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
});

const bradenScoreFormValue = z.coerce.number().min(1).max(4);

export const ipdClinicalAssessmentFormSchema = z.object({
  assessment_type: ipdClinicalAssessmentTypeFormSchema,
  score_value: optionalNumericFormValue("Score cannot be negative", 0),
  risk_level: z.string(),
  sensory_perception: bradenScoreFormValue,
  moisture: bradenScoreFormValue,
  activity: bradenScoreFormValue,
  mobility: bradenScoreFormValue,
  nutrition: bradenScoreFormValue,
  friction_shear: z.coerce.number().min(1).max(3),
  injury_present: z.boolean(),
  injury_stage: z.string(),
  injury_location: z.string(),
  injury_acquired: z.string(),
  repositioning_plan: z.string(),
  nutritional_plan: z.string(),
  skin_care_plan: z.string(),
  notes: z.string(),
});

export const ipdAttenderFormSchema = z.object({
  name: requiredTrimmed("Attender name is required", 255),
  relationship: requiredTrimmed("Relationship is required", 255),
  phone: z.string(),
  alt_phone: z.string(),
  address: z.string(),
  id_proof_type: z.string(),
  id_proof_number: z.string(),
  is_primary: z.boolean(),
});

export const icuFlowsheetFormSchema = z.object({
  heart_rate: optionalNonNegativeIntegerNumber("Heart rate must be a whole number"),
  systolic_bp: optionalNonNegativeIntegerNumber("Systolic BP must be a whole number"),
  diastolic_bp: optionalNonNegativeIntegerNumber("Diastolic BP must be a whole number"),
  mean_arterial_bp: optionalNonNegativeIntegerNumber("MAP must be a whole number"),
  respiratory_rate: optionalNonNegativeIntegerNumber("Respiratory rate must be a whole number"),
  spo2: optionalNumericFormValue("SpO2 must be between 0 and 100", 0, 100),
  temperature: optionalNumericFormValue("Temperature must be numeric"),
  cvp: optionalNumericFormValue("CVP must be numeric"),
  intake_ml: optionalNumericFormValue("Intake cannot be negative", 0),
  output_ml: optionalNumericFormValue("Output cannot be negative", 0),
  urine_ml: optionalNumericFormValue("Urine output cannot be negative", 0),
  drain_ml: optionalNumericFormValue("Drain output cannot be negative", 0),
  notes: z.string(),
});

export const icuVentilatorModeFormSchema = z.enum([
  "cmv",
  "acv",
  "simv",
  "psv",
  "cpap",
  "bipap",
  "hfov",
  "aprv",
  "niv",
  "other",
]);

export const icuVentilatorFormSchema = z.object({
  mode: icuVentilatorModeFormSchema,
  fio2: optionalNumericFormValue("FiO2 must be between 0 and 100", 0, 100),
  peep: optionalNumericFormValue("PEEP cannot be negative", 0),
  tidal_volume: optionalNumericFormValue("Tidal volume cannot be negative", 0),
  respiratory_rate: optionalNonNegativeIntegerNumber("Respiratory rate must be a whole number"),
  pip: optionalNumericFormValue("PIP cannot be negative", 0),
  plateau_pressure: optionalNumericFormValue("Plateau pressure cannot be negative", 0),
  ph: optionalNumericFormValue("pH must be between 0 and 14", 0, 14),
  pao2: optionalNumericFormValue("PaO2 cannot be negative", 0),
  paco2: optionalNumericFormValue("PaCO2 cannot be negative", 0),
  hco3: optionalNumericFormValue("HCO3 cannot be negative", 0),
  sao2: optionalNumericFormValue("SaO2 must be between 0 and 100", 0, 100),
  lactate: optionalNumericFormValue("Lactate cannot be negative", 0),
  notes: z.string(),
});

export const icuScoreTypeFormSchema = z.enum([
  "apache_ii",
  "apache_iv",
  "sofa",
  "gcs",
  "prism",
  "snappe",
  "rass",
  "cam_icu",
]);

export const icuScoreFormSchema = z.object({
  score_type: icuScoreTypeFormSchema,
  score_value: formNumberValue.refine((value) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed);
  }, "Score value is required"),
  predicted_mortality: optionalNumericFormValue(
    "Predicted mortality must be between 0 and 100",
    0,
    100,
  ),
  notes: z.string(),
});

export const icuDeviceTypeFormSchema = z.enum([
  "central_line",
  "urinary_catheter",
  "ventilator",
  "arterial_line",
  "peripheral_iv",
  "nasogastric_tube",
  "chest_tube",
  "tracheostomy",
]);

export const icuDeviceFormSchema = z.object({
  device_type: icuDeviceTypeFormSchema,
  site: z.string(),
  notes: z.string(),
});

export const icuBundleCheckFormSchema = z.object({
  is_compliant: z.boolean(),
  still_needed: z.boolean(),
  notes: z.string(),
});

export const icuNutritionRouteFormSchema = z.enum(["enteral", "parenteral", "oral", "npo"]);

export const icuNutritionFormSchema = z.object({
  route: icuNutritionRouteFormSchema,
  formula_name: z.string(),
  rate_ml_hr: optionalNumericFormValue("Rate cannot be negative", 0),
  volume_ml: optionalNumericFormValue("Volume cannot be negative", 0),
  calories_kcal: optionalNumericFormValue("Calories cannot be negative", 0),
  protein_gm: optionalNumericFormValue("Protein cannot be negative", 0),
  notes: z.string(),
});

export const icuNeonatalFormSchema = z.object({
  gestational_age_weeks: optionalNumericFormValue("Gestational age cannot be negative", 0),
  birth_weight_gm: optionalNumericFormValue("Birth weight cannot be negative", 0),
  current_weight_gm: optionalNumericFormValue("Current weight cannot be negative", 0),
  bilirubin_total: optionalNumericFormValue("Total bilirubin cannot be negative", 0),
  bilirubin_direct: optionalNumericFormValue("Direct bilirubin cannot be negative", 0),
  phototherapy_active: z.boolean(),
  phototherapy_hours: optionalNumericFormValue("Phototherapy hours cannot be negative", 0),
  breast_milk_type: z.string(),
  breast_milk_volume_ml: optionalNumericFormValue("Breast milk volume cannot be negative", 0),
  hearing_screen_result: z.string(),
  sepsis_screen_result: z.string(),
  mother_patient_id: z.string(),
  notes: z.string(),
});

export const labCatalogFormSchema = z.object({
  code: requiredTrimmed("Test code is required", 80),
  name: requiredTrimmed("Test name is required", 255),
  sample_type: z.union([labSampleTypeFormSchema, z.literal("")]),
  normal_range: z.string(),
  unit: z.string(),
  price: nonNegativeNumber("Price cannot be negative"),
  tat_hours: optionalNonNegativeIntegerNumber("TAT must be a whole number"),
  loinc_code: z.string(),
  method: z.union([labMethodFormSchema, z.literal("")]),
  specimen_volume: z.string(),
  critical_low: optionalNumericFormValue("Critical low must be numeric"),
  critical_high: optionalNumericFormValue("Critical high must be numeric"),
  delta_check_percent: optionalNumericFormValue("Delta check must be between 0 and 100", 0, 100),
});

export const labPanelFormSchema = z.object({
  code: requiredTrimmed("Panel code is required", 80),
  name: requiredTrimmed("Panel name is required", 255),
  description: z.string(),
  price: nonNegativeNumber("Panel price cannot be negative"),
  test_ids: z.array(requiredTrimmed("Test is required")).min(1, "Add at least one test"),
});

export const labReagentLotFormSchema = z.object({
  reagent_name: requiredTrimmed("Reagent name is required", 255),
  lot_number: requiredTrimmed("Lot number is required", 120),
  manufacturer: z.string(),
  test_id: z.string(),
  received_date: optionalIsoDateString,
  expiry_date: optionalIsoDateString,
  quantity: optionalNumericFormValue("Quantity cannot be negative", 0),
  quantity_unit: z.string(),
  notes: z.string(),
});

export const labQcResultFormSchema = z.object({
  test_id: requiredTrimmed("Test is required"),
  lot_id: requiredTrimmed("Reagent lot is required"),
  level: requiredTrimmed("QC level is required", 80),
  target_mean: optionalNumericFormValue("Target mean must be numeric"),
  target_sd: optionalNumericFormValue("Target SD must be numeric"),
  observed_value: optionalNumericFormValue("Observed value must be numeric"),
  run_date: optionalIsoDateString,
  reviewer_notes: z.string(),
});

export const labCalibrationFormSchema = z
  .object({
    test_id: requiredTrimmed("Test is required"),
    instrument_name: z.string(),
    calibrator_lot: z.string(),
    calibration_date: optionalIsoDateString,
    next_calibration_date: optionalIsoDateString,
    is_passed: z.boolean(),
    notes: z.string(),
  })
  .superRefine((value, ctx) => {
    const calibrationDate = value.calibration_date.trim();
    const nextDate = value.next_calibration_date.trim();
    if (calibrationDate && nextDate && nextDate < calibrationDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["next_calibration_date"],
        message: "Next calibration date must be after calibration date",
      });
    }
  });

export const labOutsourcedOrderFormSchema = z
  .object({
    order_id: requiredTrimmed("Order is required"),
    external_lab_name: requiredTrimmed("External lab name is required", 255),
    external_lab_code: z.string(),
    sent_date: optionalIsoDateString,
    expected_return_date: optionalIsoDateString,
    cost: optionalNumericFormValue("Cost cannot be negative", 0),
    notes: z.string(),
  })
  .superRefine((value, ctx) => {
    const sentDate = value.sent_date.trim();
    const expectedDate = value.expected_return_date.trim();
    if (sentDate && expectedDate && expectedDate < sentDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expected_return_date"],
        message: "Expected return date must be after sent date",
      });
    }
  });

export const labHomeCollectionFormSchema = z.object({
  order_id: z.string(),
  patient_id: requiredTrimmed("Patient is required"),
  scheduled_date: optionalIsoDateString.refine(
    (value) => value.trim().length > 0,
    "Scheduled date is required",
  ),
  scheduled_time_slot: z.string(),
  address_line: z.string(),
  city: z.string(),
  pincode: z.string(),
  contact_phone: optionalPhone,
  special_instructions: z.string(),
});

export const labCollectionCenterFormSchema = z.object({
  code: requiredTrimmed("Center code is required", 80),
  name: requiredTrimmed("Center name is required", 255),
  center_type: labCollectionCenterTypeFormSchema,
  address: z.string(),
  city: z.string(),
  phone: optionalPhone,
  contact_person: z.string(),
  notes: z.string(),
});

export const labSampleArchiveFormSchema = z
  .object({
    order_id: z.string(),
    patient_id: z.string(),
    sample_barcode: z.string(),
    storage_location: z.string(),
    notes: z.string(),
  })
  .superRefine((value, ctx) => {
    const hasSource =
      hasTrimmedValue(value.order_id) ||
      hasTrimmedValue(value.patient_id) ||
      hasTrimmedValue(value.sample_barcode);
    if (!hasSource) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sample_barcode"],
        message: "Enter an order, patient, or barcode to archive a sample",
      });
    }
  });

export const labEqasResultFormSchema = z.object({
  program_name: requiredTrimmed("Program name is required", 255),
  provider: z.string(),
  test_id: z.string(),
  cycle: z.string(),
  sample_number: z.string(),
  expected_value: optionalNumericFormValue("Expected value must be numeric"),
  reported_value: optionalNumericFormValue("Reported value must be numeric"),
  evaluation: labEqasEvaluationFormSchema,
  bias_percent: optionalNumericFormValue("Bias percent must be numeric"),
  z_score: optionalNumericFormValue("Z-score must be numeric"),
  report_date: optionalIsoDateString,
  notes: z.string(),
});

export const labProficiencyTestFormSchema = z
  .object({
    program: requiredTrimmed("Program is required", 255),
    test_id: z.string(),
    survey_round: z.string(),
    sample_id: z.string(),
    assigned_value: optionalNumericFormValue("Assigned value must be numeric"),
    reported_value: optionalNumericFormValue("Reported value must be numeric"),
    acceptable_range_low: optionalNumericFormValue("Low range must be numeric"),
    acceptable_range_high: optionalNumericFormValue("High range must be numeric"),
    is_acceptable: z.boolean().nullable(),
    evaluation_date: optionalIsoDateString,
    notes: z.string(),
  })
  .superRefine((value, ctx) => {
    const low =
      typeof value.acceptable_range_low === "number"
        ? value.acceptable_range_low
        : Number(value.acceptable_range_low);
    const high =
      typeof value.acceptable_range_high === "number"
        ? value.acceptable_range_high
        : Number(value.acceptable_range_high);
    if (
      Number.isFinite(low) &&
      Number.isFinite(high) &&
      value.acceptable_range_low !== "" &&
      value.acceptable_range_high !== "" &&
      high < low
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["acceptable_range_high"],
        message: "High range must be greater than low range",
      });
    }
  });

export const labNablDocumentFormSchema = z
  .object({
    document_type: z.union([labNablDocumentTypeFormSchema, z.literal("")]),
    document_number: requiredTrimmed("Document number is required", 120),
    title: requiredTrimmed("Title is required", 255),
    version: z.string(),
    effective_date: optionalIsoDateString,
    review_date: optionalIsoDateString,
    file_path: z.string(),
    is_current: z.boolean(),
    notes: z.string(),
  })
  .superRefine((value, ctx) => {
    const effectiveDate = value.effective_date.trim();
    const reviewDate = value.review_date.trim();
    if (effectiveDate && reviewDate && reviewDate < effectiveDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["review_date"],
        message: "Review date must be after effective date",
      });
    }
  });

export const labHistopathReportFormSchema = z.object({
  order_id: requiredTrimmed("Order is required"),
  patient_id: requiredTrimmed("Patient is required"),
  specimen_type: z.union([labSampleTypeFormSchema, z.literal("")]),
  clinical_history: z.string(),
  gross_description: z.string(),
  microscopy_findings: z.string(),
  diagnosis: z.string(),
  icd_code: z.string(),
  notes: z.string(),
  turnaround_days: optionalNonNegativeIntegerNumber("Turnaround must be a whole number"),
});

export const labCytologyReportFormSchema = z.object({
  order_id: requiredTrimmed("Order is required"),
  patient_id: requiredTrimmed("Patient is required"),
  specimen_type: z.union([labSampleTypeFormSchema, z.literal("")]),
  clinical_indication: z.string(),
  adequacy: z.string(),
  screening_findings: z.string(),
  diagnosis: z.string(),
  bethesda_category: z.union([labBethesdaCategoryFormSchema, z.literal("")]),
  icd_code: z.string(),
  notes: z.string(),
});

export const labMolecularReportFormSchema = z.object({
  order_id: requiredTrimmed("Order is required"),
  patient_id: requiredTrimmed("Patient is required"),
  test_method: z.union([labMolecularTestMethodFormSchema, z.literal("")]),
  target_gene: z.string(),
  ct_value: optionalNumericFormValue("Ct value must be numeric"),
  result_interpretation: z.union([labMolecularResultInterpretationFormSchema, z.literal("")]),
  quantitative_value: optionalNumericFormValue("Quantitative value must be numeric"),
  quantitative_unit: z.string(),
  kit_name: z.string(),
  kit_lot: z.string(),
  notes: z.string(),
});

export const labB2bClientFormSchema = z.object({
  code: requiredTrimmed("Client code is required", 80),
  name: requiredTrimmed("Client name is required", 255),
  client_type: z.union([labB2bClientTypeFormSchema, z.literal("")]),
  address: z.string(),
  city: z.string(),
  phone: optionalPhone,
  email: optionalEmailText,
  contact_person: z.string(),
  credit_limit: optionalNumericFormValue("Credit limit cannot be negative", 0),
  payment_terms_days: optionalNonNegativeIntegerNumber("Payment terms must be a whole number"),
});

export const labB2bRateFormSchema = z
  .object({
    test_id: requiredTrimmed("Test is required"),
    agreed_price: optionalNumericFormValue("Agreed price cannot be negative", 0),
    discount_percent: optionalNumericFormValue(
      "Discount percent must be between 0 and 100",
      0,
      100,
    ),
    effective_from: optionalIsoDateString,
    effective_to: optionalIsoDateString,
  })
  .superRefine((value, ctx) => {
    const from = value.effective_from.trim();
    const to = value.effective_to.trim();
    if (from && to && to < from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effective_to"],
        message: "Effective to date must be after effective from date",
      });
    }
  });

export const campCreateFormSchema = z
  .object({
    name: requiredTrimmed("Camp name is required", 255),
    camp_type: campTypeFormSchema,
    organizing_department_id: z.string().nullable(),
    supporting_department_ids: z.array(z.string()),
    coordinator_id: z.string().nullable(),
    planned_doctor_ids: z.array(z.string()),
    planned_staff_ids: z.array(z.string()),
    external_people: z.array(z.string()),
    service_lines: z.array(z.string()),
    service_offerings: z.array(
      z.object({
        service_line: z.string(),
        label: z.string(),
        charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
        planned_qty: optionalNumericFormValue("Planned quantity cannot be negative", 0),
        patient_rate: optionalNumericFormValue("Patient price cannot be negative", 0),
        camp_cost: optionalNumericFormValue("Camp cost cannot be negative", 0),
        concession_percentage: optionalNumericFormValue(
          "Concession must be between 0 and 100",
          0,
          100,
        ),
        is_billable: z.boolean(),
        notes: z.string(),
      }),
    ),
    doctor_engagements: z.array(
      z.object({
        doctor_id: z.string(),
        doctor_name: z.string(),
        charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
        expected_consults: optionalNumericFormValue("Expected consults cannot be negative", 0),
        consultation_fee: optionalNumericFormValue("Consultation fee cannot be negative", 0),
        salary_amount: optionalNumericFormValue("Doctor salary cannot be negative", 0),
        sponsor_covered_amount: optionalNumericFormValue("Sponsor amount cannot be negative", 0),
        concession_percentage: optionalNumericFormValue(
          "Concession must be between 0 and 100",
          0,
          100,
        ),
        notes: z.string(),
      }),
    ),
    planned_medicines: z.array(z.string()),
    planned_medicine_ids: z.array(z.string()),
    planned_medicine_refs: z.array(
      z.object({
        catalog_item_id: z.string(),
        medicine_name: z.string(),
        generic_name: z.string().nullable().optional(),
        unit: z.string().nullable().optional(),
        current_stock: z.number().optional(),
        store_location_id: z.string().nullable().optional(),
        store_name: z.string().nullable().optional(),
        batch_id: z.string().nullable().optional(),
        batch_number: z.string().nullable().optional(),
        expiry_date: z.string().nullable().optional(),
        planned_qty: optionalNumericFormValue("Planned quantity cannot be negative", 0),
        reserved_qty: optionalNumericFormValue("Reserved quantity cannot be negative", 0),
        issue_qty: optionalNumericFormValue("Issue quantity cannot be negative", 0),
        free_qty: optionalNumericFormValue("Free quantity cannot be negative", 0),
        paid_qty: optionalNumericFormValue("Paid quantity cannot be negative", 0),
        consumed_qty: optionalNumericFormValue("Consumed quantity cannot be negative", 0),
        return_qty: optionalNumericFormValue("Return quantity cannot be negative", 0),
        damaged_qty: optionalNumericFormValue("Damaged quantity cannot be negative", 0),
        unit_price: optionalNumericFormValue("Patient price cannot be negative", 0),
        tax_percent: optionalNumericFormValue("GST/tax must be between 0 and 100", 0, 100),
        cost_amount: optionalNumericFormValue("Camp cost cannot be negative", 0),
        sponsor_covered_amount: optionalNumericFormValue("Sponsor amount cannot be negative", 0),
        concession_percentage: optionalNumericFormValue(
          "Concession must be between 0 and 100",
          0,
          100,
        ),
        charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
        approval_required: z.boolean(),
        stock_source_notes: z.string(),
      }),
    ),
    camp_charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
    department_charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
    doctor_charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
    medicine_charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
    free_medicine_approval_required: z.boolean(),
    service_policy_notes: z.string(),
    budget_doctor_amount: optionalNumericFormValue("Doctor budget cannot be negative", 0),
    budget_medicine_amount: optionalNumericFormValue("Medicine budget cannot be negative", 0),
    budget_diagnostics_amount: optionalNumericFormValue("Diagnostics budget cannot be negative", 0),
    budget_consumables_amount: optionalNumericFormValue("Consumables budget cannot be negative", 0),
    budget_transport_amount: optionalNumericFormValue("Transport budget cannot be negative", 0),
    budget_food_amount: optionalNumericFormValue("Food budget cannot be negative", 0),
    budget_other_amount: optionalNumericFormValue("Other budget cannot be negative", 0),
    sponsor_covered_amount: optionalNumericFormValue("Sponsor amount cannot be negative", 0),
    patient_expected_collection: optionalNumericFormValue(
      "Expected patient collection cannot be negative",
      0,
    ),
    budget_notes: z.string(),
    scheduled_date: optionalIsoDateString.refine(
      (value) => value.trim().length > 0,
      "Scheduled date is required",
    ),
    start_time: z.string(),
    end_time: z.string(),
    venue_name: z.string(),
    venue_address: z.string(),
    venue_city: z.string(),
    venue_state: z.string(),
    venue_pincode: z.string(),
    expected_participants: optionalNonNegativeIntegerNumber(
      "Expected participants must be a whole number",
    ),
    budget_allocated: optionalNumericFormValue("Budget cannot be negative", 0),
    is_free: z.boolean(),
    logistics_notes: z.string(),
  })
  .superRefine((value, ctx) => {
    const start = value.start_time.trim();
    const end = value.end_time.trim();
    if (start && end && end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_time"],
        message: "End time must be after start time",
      });
    }
  });

export const campServicePlanFormSchema = z
  .object({
    service_lines: z.array(z.string()).default([]),
    supporting_department_ids: z.array(z.string()).default([]),
    planned_doctor_ids: z.array(z.string()).default([]),
    planned_staff_ids: z.array(z.string()).default([]),
    external_people: z.array(z.string()).default([]),
    planned_medicines: z.array(z.string()).default([]),
    planned_medicine_ids: z.array(z.string()).default([]),
    planned_medicine_refs: z
      .array(
        z.object({
          catalog_item_id: z.string(),
          medicine_name: z.string(),
          generic_name: z.string().nullable().optional(),
          unit: z.string().nullable().optional(),
          current_stock: z.number().optional(),
          store_location_id: z.string().nullable().optional(),
          store_name: z.string().nullable().optional(),
          batch_id: z.string().nullable().optional(),
          batch_number: z.string().nullable().optional(),
          expiry_date: z.string().nullable().optional(),
          planned_qty: z.number().default(0),
          reserved_qty: z.number().default(0),
          issue_qty: z.number().default(0),
          free_qty: z.number().default(0),
          paid_qty: z.number().default(0),
          consumed_qty: z.number().default(0),
          return_qty: z.number().default(0),
          damaged_qty: z.number().default(0),
          unit_price: z.number().default(0),
          tax_percent: z.number().default(0),
          cost_amount: z.number().default(0),
          sponsor_covered_amount: z.number().default(0),
          concession_percentage: z.number().default(0),
          charge_mode: z.string().optional(),
          approval_required: z.boolean().optional(),
          stock_source_notes: z.string().default(""),
        }),
      )
      .default([]),
    service_offerings: z
      .array(
        z.object({
          service_line: z.string(),
          label: z.string(),
          charge_mode: z.string().default("free"),
          planned_qty: z.number().default(0),
          patient_rate: z.number().default(0),
          camp_cost: z.number().default(0),
          concession_percentage: z.number().default(0),
          is_billable: z.boolean().default(false),
          notes: z.string().default(""),
        }),
      )
      .default([]),
    doctor_engagements: z
      .array(
        z.object({
          doctor_id: z.string(),
          doctor_name: z.string(),
          charge_mode: z.string().default("free"),
          expected_consults: z.number().default(0),
          consultation_fee: z.number().default(0),
          salary_amount: z.number().default(0),
          sponsor_covered_amount: z.number().default(0),
          concession_percentage: z.number().default(0),
          notes: z.string().default(""),
        }),
      )
      .default([]),
    camp_charge_mode: z.string().default("free"),
    department_charge_mode: z.string().default("free"),
    doctor_charge_mode: z.string().default("free"),
    medicine_charge_mode: z.string().default("free"),
    free_medicine_approval_required: z.boolean().default(true),
    service_policy_notes: z.string().default(""),
    budget_components: z
      .array(
        z.object({
          category: z.string(),
          label: z.string(),
          planned_amount: z.number().default(0),
          sponsor_covered_amount: z.number().default(0),
          patient_pay_amount: z.number().default(0),
          notes: z.string().default(""),
        }),
      )
      .default([]),
    budget_notes: z.string().default(""),
  })
  .catch({
    service_lines: [],
    supporting_department_ids: [],
    planned_doctor_ids: [],
    planned_staff_ids: [],
    external_people: [],
    planned_medicines: [],
    planned_medicine_ids: [],
    planned_medicine_refs: [],
    service_offerings: [],
    doctor_engagements: [],
    camp_charge_mode: "free",
    department_charge_mode: "free",
    doctor_charge_mode: "free",
    medicine_charge_mode: "free",
    free_medicine_approval_required: true,
    service_policy_notes: "",
    budget_components: [],
    budget_notes: "",
  });

export const campServicePlanEditorSchema = z.object({
  organizing_department_id: z.string().nullable(),
  coordinator_id: z.string().nullable(),
  service_lines: z.array(z.string()),
  supporting_department_ids: z.array(z.string()),
  planned_doctor_ids: z.array(z.string()),
  planned_staff_ids: z.array(z.string()),
  external_people: z.array(z.string()),
  planned_medicines: z.array(z.string()),
  planned_medicine_ids: z.array(z.string()),
  planned_medicine_refs: z.array(
    z.object({
      catalog_item_id: z.string(),
      medicine_name: z.string(),
      generic_name: z.string().nullable().optional(),
      unit: z.string().nullable().optional(),
      current_stock: z.number().optional(),
      store_location_id: z.string().nullable().optional(),
      store_name: z.string().nullable().optional(),
      batch_id: z.string().nullable().optional(),
      batch_number: z.string().nullable().optional(),
      expiry_date: z.string().nullable().optional(),
      planned_qty: optionalNumericFormValue("Planned quantity cannot be negative", 0),
      reserved_qty: optionalNumericFormValue("Reserved quantity cannot be negative", 0),
      issue_qty: optionalNumericFormValue("Issue quantity cannot be negative", 0),
      free_qty: optionalNumericFormValue("Free quantity cannot be negative", 0),
      paid_qty: optionalNumericFormValue("Paid quantity cannot be negative", 0),
      consumed_qty: optionalNumericFormValue("Consumed quantity cannot be negative", 0),
      return_qty: optionalNumericFormValue("Return quantity cannot be negative", 0),
      damaged_qty: optionalNumericFormValue("Damaged quantity cannot be negative", 0),
      unit_price: optionalNumericFormValue("Patient price cannot be negative", 0),
      tax_percent: optionalNumericFormValue("GST/tax must be between 0 and 100", 0, 100),
      cost_amount: optionalNumericFormValue("Camp cost cannot be negative", 0),
      sponsor_covered_amount: optionalNumericFormValue("Sponsor amount cannot be negative", 0),
      concession_percentage: optionalNumericFormValue(
        "Concession must be between 0 and 100",
        0,
        100,
      ),
      charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
      approval_required: z.boolean(),
      stock_source_notes: z.string(),
    }),
  ),
  service_offerings: z.array(
    z.object({
      service_line: z.string(),
      label: z.string(),
      charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
      planned_qty: optionalNumericFormValue("Planned quantity cannot be negative", 0),
      patient_rate: optionalNumericFormValue("Patient price cannot be negative", 0),
      camp_cost: optionalNumericFormValue("Camp cost cannot be negative", 0),
      concession_percentage: optionalNumericFormValue(
        "Concession must be between 0 and 100",
        0,
        100,
      ),
      is_billable: z.boolean(),
      notes: z.string(),
    }),
  ),
  doctor_engagements: z.array(
    z.object({
      doctor_id: z.string(),
      doctor_name: z.string(),
      charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
      expected_consults: optionalNumericFormValue("Expected consults cannot be negative", 0),
      consultation_fee: optionalNumericFormValue("Consultation fee cannot be negative", 0),
      salary_amount: optionalNumericFormValue("Doctor salary cannot be negative", 0),
      sponsor_covered_amount: optionalNumericFormValue("Sponsor amount cannot be negative", 0),
      concession_percentage: optionalNumericFormValue(
        "Concession must be between 0 and 100",
        0,
        100,
      ),
      notes: z.string(),
    }),
  ),
  camp_charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
  department_charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
  doctor_charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
  medicine_charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
  free_medicine_approval_required: z.boolean(),
  service_policy_notes: z.string(),
  budget_doctor_amount: optionalNumericFormValue("Doctor budget cannot be negative", 0),
  budget_medicine_amount: optionalNumericFormValue("Medicine budget cannot be negative", 0),
  budget_diagnostics_amount: optionalNumericFormValue("Diagnostics budget cannot be negative", 0),
  budget_consumables_amount: optionalNumericFormValue("Consumables budget cannot be negative", 0),
  budget_transport_amount: optionalNumericFormValue("Transport budget cannot be negative", 0),
  budget_food_amount: optionalNumericFormValue("Food budget cannot be negative", 0),
  budget_other_amount: optionalNumericFormValue("Other budget cannot be negative", 0),
  sponsor_covered_amount: optionalNumericFormValue("Sponsor amount cannot be negative", 0),
  patient_expected_collection: optionalNumericFormValue(
    "Expected patient collection cannot be negative",
    0,
  ),
  budget_notes: z.string(),
});

export const campRegistrationFormSchema = z.object({
  person_name: requiredTrimmed("Person name is required", 255),
  age: optionalNonNegativeIntegerNumber("Age must be a whole number").refine((value) => {
    if (typeof value === "string" && value.trim().length === 0) return true;
    const parsed = typeof value === "number" ? value : Number(value);
    return parsed <= 150;
  }, "Age cannot exceed 150"),
  gender: z.union([genderFormSchema, z.literal("")]),
  phone: optionalPhone,
  address: z.string(),
  id_proof_type: z.union([campIdProofTypeFormSchema, z.literal("")]),
  id_proof_number: z.string(),
  clinical_department_id: z.string().nullable(),
  attending_doctor_id: z.string().nullable(),
  service_line: z.string(),
  chief_complaint: z.string(),
  is_walk_in: z.boolean(),
});

const campSupplyCategoryFormSchema = z.union([
  z.literal("equipment"),
  z.literal("consumable"),
  z.literal("medicine"),
  z.literal("ppe"),
  z.literal("biomedical_waste"),
  z.literal("document"),
  z.literal("it"),
  z.literal("other"),
]);

const formValueToNumber = (value: z.infer<typeof formNumberValue>) => {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const campSupplyItemFormSchema = z
  .object({
    category: campSupplyCategoryFormSchema,
    catalog_item_id: z.string(),
    batch_stock_id: z.string(),
    store_location_id: z.string(),
    item_name: requiredTrimmed("Item name is required", 255),
    unit: z.string(),
    planned_qty: optionalNumericFormValue("Planned quantity cannot be negative", 0),
    packed_qty: optionalNumericFormValue("Packed quantity cannot be negative", 0),
    batch_no: z.string(),
    expiry_date: z.string(),
    charge_mode: z.enum(["free", "paid", "mixed", "sponsor_covered"]),
    unit_price: optionalNumericFormValue("Patient price cannot be negative", 0),
    tax_percent: optionalNumericFormValue("GST/tax must be between 0 and 100", 0, 100),
    cost_amount: optionalNumericFormValue("Camp cost cannot be negative", 0),
    sponsor_covered_amount: optionalNumericFormValue("Sponsor amount cannot be negative", 0),
    concession_percentage: optionalNumericFormValue("Concession must be between 0 and 100", 0, 100),
    approval_required: z.boolean(),
    is_critical: z.boolean(),
    shortage_notes: z.string(),
  })
  .superRefine((value, ctx) => {
    const packedQty = formValueToNumber(value.packed_qty);
    if (value.category !== "medicine" || packedQty <= 0) {
      return;
    }
    if (value.batch_no.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["batch_no"],
        message: "Batch number is required when medicine is packed for camp",
      });
    }
    if (value.expiry_date.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiry_date"],
        message: "Expiry date is required when medicine is packed for camp",
      });
    }
  });

export const assetCategoryFormSchema = z.object({
  code: z.string(),
  name: requiredTrimmed("Asset category name is required", 120),
  parent_id: z.string(),
  asset_domain: assetDomainFormSchema,
  description: z.string(),
  regulatory_class: z.string(),
  default_pm_frequency: z.string(),
  default_calibration_frequency: z.string(),
  requires_pm: z.boolean(),
  requires_calibration: z.boolean(),
  is_camp_eligible: z.boolean(),
  is_active: z.boolean(),
  sort_order: optionalNumericFormValue("Sort order cannot be negative", 0),
});

export const storeCategoryFormSchema = z.object({
  code: z.string(),
  name: requiredTrimmed("Store category name is required", 120),
  parent_id: z.string(),
  store_domain: storeDomainFormSchema,
  description: z.string(),
  requires_batch_tracking: z.boolean(),
  requires_expiry_tracking: z.boolean(),
  requires_temperature_log: z.boolean(),
  requires_license_tracking: z.boolean(),
  is_camp_source: z.boolean(),
  is_active: z.boolean(),
  sort_order: optionalNumericFormValue("Sort order cannot be negative", 0),
});

export const assetClassificationFormSchema = z.object({
  source_type: requiredTrimmed("Source type is required", 80),
  source_id: requiredTrimmed("Source id is required", 80),
  asset_category_id: z.string(),
  store_category_id: z.string(),
  asset_domain: assetDomainFormSchema,
  criticality: assetCriticalityFormSchema,
  custody_mode: assetCustodyModeFormSchema,
  is_camp_eligible: z.boolean(),
  tags: z.array(z.string()),
  notes: z.string(),
});

export const campAssetReservationFormSchema = z.object({
  asset_key: requiredTrimmed("Asset selection is required", 180),
  required_from: z.string(),
  required_to: z.string(),
  quantity: optionalNumericFormValue("Quantity must be greater than zero", 1),
  is_critical: z.boolean(),
  notes: z.string(),
});

export const campAssetIssueFormSchema = z.object({
  issued_to: z.string(),
  issue_condition: z.string(),
  notes: z.string(),
});

export const campAssetReturnFormSchema = z.object({
  status: campAssetReturnStatusFormSchema,
  return_condition: z.string(),
  damage_notes: z.string(),
  loss_notes: z.string(),
  reconciliation_notes: z.string(),
  notes: z.string(),
});

export const campClinicalVisitFormSchema = z.object({
  department_id: requiredNullableString("Select the department for this clinical visit"),
  doctor_id: z.string().nullable(),
});

export const campBillingFormSchema = z
  .object({
    registration_id: requiredTrimmed("Select a camp registration"),
    item_key: z.string(),
    service_description: requiredTrimmed("Service description is required", 255),
    standard_amount: optionalNumericFormValue("Standard amount cannot be negative", 0),
    discount_percentage: optionalNumericFormValue("Discount must be between 0 and 100", 0, 100),
    tax_percent: optionalNumericFormValue("GST/tax must be between 0 and 100", 0, 100),
    sponsor_covered_amount: optionalNumericFormValue("Sponsor amount cannot be negative", 0),
    is_free: z.boolean(),
    payment_mode: z.union([billingPaymentModeFormSchema, z.literal("")]),
    payment_reference: z.string(),
    source_module: z.string(),
    source_entity_id: z.string(),
  })
  .superRefine((value, ctx) => {
    const amount = formValueToNumber(value.standard_amount);
    const discount = formValueToNumber(value.discount_percentage);
    const sponsor = formValueToNumber(value.sponsor_covered_amount);
    const taxPercent = formValueToNumber(value.tax_percent);
    const taxable = Math.max(0, amount - (amount * discount) / 100 - sponsor);
    const payable = taxable + (taxable * taxPercent) / 100;
    if (!value.is_free && payable > 0 && value.payment_mode.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payment_mode"],
        message: "Select payment mode for paid camp services",
      });
    }
  });

export const campScreeningFormSchema = z.object({
  registration_id: requiredTrimmed("Select a camp registration"),
  bp_systolic: optionalNonNegativeIntegerNumber("Systolic BP must be a whole number").refine(
    (value) => {
      if (typeof value === "string" && value.trim().length === 0) return true;
      const parsed = typeof value === "number" ? value : Number(value);
      return parsed <= 300;
    },
    "Systolic BP cannot exceed 300",
  ),
  bp_diastolic: optionalNonNegativeIntegerNumber("Diastolic BP must be a whole number").refine(
    (value) => {
      if (typeof value === "string" && value.trim().length === 0) return true;
      const parsed = typeof value === "number" ? value : Number(value);
      return parsed <= 220;
    },
    "Diastolic BP cannot exceed 220",
  ),
  pulse_rate: optionalNonNegativeIntegerNumber("Pulse must be a whole number").refine((value) => {
    if (typeof value === "string" && value.trim().length === 0) return true;
    const parsed = typeof value === "number" ? value : Number(value);
    return parsed <= 300;
  }, "Pulse cannot exceed 300"),
  spo2: optionalNonNegativeIntegerNumber("SpO2 must be a whole number").refine((value) => {
    if (typeof value === "string" && value.trim().length === 0) return true;
    const parsed = typeof value === "number" ? value : Number(value);
    return parsed <= 100;
  }, "SpO2 cannot exceed 100"),
  temperature: optionalNumericFormValue("Temperature must be between 25 and 45 C", 25, 45),
  blood_sugar_random: optionalNumericFormValue("Random blood sugar cannot be negative", 0),
  height_cm: optionalNumericFormValue("Height must be between 30 and 250 cm", 30, 250),
  weight_kg: optionalNumericFormValue("Weight must be between 0.5 and 350 kg", 0.5, 350),
  bmi: optionalNumericFormValue("BMI cannot be negative", 0),
  visual_acuity_left: z.string(),
  visual_acuity_right: z.string(),
  findings: z.string(),
  diagnosis: z.string(),
  advice: z.string(),
  referred_to_hospital: z.boolean(),
  referral_department: z.string(),
  referral_urgency: z.string(),
});

export const campLabSampleFormSchema = z.object({
  registration_id: requiredTrimmed("Select a camp registration"),
  sample_type: requiredTrimmed("Sample type is required", 80),
  test_requested: requiredTrimmed("Select the requested lab test", 255),
  barcode: z.string(),
});

export const campFollowupFormSchema = z.object({
  registration_id: requiredTrimmed("Registration ID is required"),
  followup_date: optionalIsoDateString.refine(
    (value) => value.trim().length > 0,
    "Follow-up date is required",
  ),
  followup_type: campFollowupTypeFormSchema,
  notes: z.string(),
});

export const dietOrderFormSchema = z
  .object({
    admission_id: z.string(),
    patient_id: z.string(),
    template_id: z.string(),
    diet_type: dietTypeFormSchema,
    special_instructions: z.string(),
    calories_target: optionalNumericFormValue("Calories target cannot be negative", 0),
  })
  .superRefine((value, ctx) => {
    if (!hasTrimmedValue(value.admission_id) && !hasTrimmedValue(value.patient_id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["patient_id"],
        message: "Select an active admission or patient",
      });
    }
  });

export const dietTemplateFormSchema = z.object({
  name: requiredTrimmed("Template name is required", 255),
  diet_type: dietTypeFormSchema,
  description: z.string(),
  calories_target: optionalNumericFormValue("Calories target cannot be negative", 0),
  protein_g: optionalNumericFormValue("Protein grams cannot be negative", 0),
  carbs_g: optionalNumericFormValue("Carbohydrate grams cannot be negative", 0),
  fat_g: optionalNumericFormValue("Fat grams cannot be negative", 0),
});

export const kitchenMenuFormSchema = z.object({
  name: requiredTrimmed("Menu name is required", 255),
  week_number: optionalNonNegativeIntegerNumber("Week number must be a whole number").refine(
    (value) => {
      if (typeof value === "string" && value.trim().length === 0) return true;
      const parsed = typeof value === "number" ? value : Number(value);
      return parsed <= 53;
    },
    "Week number cannot exceed 53",
  ),
  season: z.string(),
});

export const mealPrepFormSchema = z.object({
  diet_order_id: requiredTrimmed("Diet order is required"),
  meal_type: mealTypeFormSchema,
});

export const kitchenInventoryFormSchema = z.object({
  item_name: requiredTrimmed("Item name is required", 255),
  category: z.string(),
  unit: z.string(),
  current_stock: optionalNumericFormValue("Current stock cannot be negative", 0),
  reorder_level: optionalNumericFormValue("Reorder level cannot be negative", 0),
  supplier: z.string(),
});

export const kitchenAuditFormSchema = z.object({
  auditor_name: requiredTrimmed("Auditor name is required", 255),
  audit_type: kitchenAuditTypeFormSchema,
  hygiene_score: optionalNumericFormValue("Hygiene score must be between 0 and 100", 0, 100),
  findings: z.string(),
  corrective_actions: z.string(),
});

export const caseAssignmentFormSchema = z.object({
  admission_id: requiredTrimmed("Admission ID is required"),
  patient_id: requiredTrimmed("Patient is required"),
  case_manager_id: requiredTrimmed("Case manager ID is required"),
  priority: caseMgmtPriorityFormSchema,
  target_discharge_date: optionalIsoDateString,
  notes: z.string(),
});

export const caseAutoAssignFormSchema = z.object({
  admission_id: requiredTrimmed("Admission ID is required"),
  patient_id: requiredTrimmed("Patient is required"),
  priority: z.union([caseMgmtPriorityFormSchema, z.literal("")]),
});

export const caseAssignmentUpdateFormSchema = z.object({
  status: z.union([caseMgmtStatusFormSchema, z.literal("")]),
  priority: z.union([caseMgmtPriorityFormSchema, z.literal("")]),
  target_discharge_date: optionalIsoDateString,
  actual_discharge_date: optionalIsoDateString,
  discharge_disposition: z.string(),
  notes: z.string(),
});

export const dischargeBarrierFormSchema = z.object({
  case_assignment_id: requiredTrimmed("Case assignment ID is required"),
  barrier_type: dischargeBarrierTypeFormSchema,
  description: requiredTrimmed("Description is required", 2000),
});

export const caseReferralFormSchema = z.object({
  case_assignment_id: requiredTrimmed("Case assignment ID is required"),
  referral_type: caseReferralTypeFormSchema,
  referred_to: requiredTrimmed("Referred to is required", 255),
  facility_name: z.string(),
});

export const caseReferralUpdateFormSchema = z.object({
  status: z.union([caseReferralStatusFormSchema, z.literal("")]),
  outcome: z.string(),
});

export const cssdInstrumentFormSchema = z.object({
  barcode: requiredTrimmed("Barcode is required", 120),
  name: requiredTrimmed("Instrument name is required", 255),
  category: z.union([cssdInstrumentCategoryFormSchema, z.literal("")]),
  manufacturer: z.string(),
  max_uses: optionalNonNegativeIntegerNumber("Max uses must be a whole number"),
  notes: z.string(),
});

export const cssdSetFormSchema = z.object({
  set_code: requiredTrimmed("Set code is required", 120),
  set_name: requiredTrimmed("Set name is required", 255),
  department: z.string(),
  description: z.string(),
});

export const cssdLoadFormSchema = z
  .object({
    sterilizer_id: requiredTrimmed("Sterilizer is required"),
    method: cssdSterilizationMethodFormSchema,
    is_flash: z.boolean(),
    flash_reason: z.string(),
    notes: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.is_flash && value.flash_reason.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["flash_reason"],
        message: "Flash reason is required for flash sterilization",
      });
    }
  });

export const cssdIndicatorFormSchema = z.object({
  indicator_type: cssdIndicatorTypeFormSchema,
  result_pass: z.boolean(),
  indicator_brand: z.string(),
  indicator_lot: z.string(),
});

export const cssdIssuanceFormSchema = z.object({
  issued_to_department: requiredTrimmed("Department is required", 255),
  issued_to_patient_id: z.string(),
  notes: z.string(),
});

export const cssdSterilizerFormSchema = z.object({
  name: requiredTrimmed("Sterilizer name is required", 255),
  model: z.string(),
  serial_number: z.string(),
  method: cssdSterilizationMethodFormSchema,
  chamber_size_liters: optionalNumericFormValue("Chamber size cannot be negative", 0),
  location: z.string(),
});

export const cssdMaintenanceFormSchema = z.object({
  maintenance_type: cssdMaintenanceTypeFormSchema,
  performed_by: z.string(),
  findings: z.string(),
  actions_taken: z.string(),
  cost: optionalNumericFormValue("Cost cannot be negative", 0),
});

const requiredIsoDate = (message: string) =>
  requiredTrimmed(message).refine(
    (value) => isoDatePattern.test(value.trim()),
    "Enter a valid date in YYYY-MM-DD format",
  );

export const ambulanceFleetFormSchema = z.object({
  vehicle_number: requiredTrimmed("Vehicle number is required", 80),
  ambulance_type: ambulanceTypeFormSchema,
  make: z.string(),
  model: z.string(),
  year_of_manufacture: optionalNonNegativeIntegerNumber("Year must be a whole number"),
  chassis_number: z.string(),
  engine_number: z.string(),
  fuel_type: z.union([ambulanceFuelTypeFormSchema, z.literal("")]),
  has_ventilator: z.boolean(),
  has_defibrillator: z.boolean(),
  has_oxygen: z.boolean(),
  gps_device_id: z.string(),
  notes: z.string(),
});

export const ambulanceTripFormSchema = z.object({
  trip_type: ambulanceTripTypeFormSchema,
  priority: ambulanceTripPriorityFormSchema,
  ambulance_id: z.string(),
  driver_id: z.string(),
  patient_name: z.string(),
  patient_phone: optionalPhone,
  pickup_address: requiredTrimmed("Pickup address is required", 1000),
  drop_address: z.string(),
});

export const ambulanceDriverFormSchema = z.object({
  employee_id: requiredTrimmed("Employee ID is required"),
  license_number: requiredTrimmed("License number is required"),
  license_type: ambulanceLicenseTypeFormSchema,
  license_expiry: requiredIsoDate("License expiry is required"),
  bls_certified: z.boolean(),
  defensive_driving: z.boolean(),
  shift_pattern: z.union([ambulanceShiftPatternFormSchema, z.literal("")]),
  phone: optionalPhone,
});

export const ambulanceMaintenanceFormSchema = z.object({
  ambulance_id: requiredTrimmed("Ambulance is required"),
  maintenance_type: ambulanceMaintenanceTypeFormSchema,
  scheduled_date: requiredIsoDate("Scheduled date is required"),
  description: z.string(),
  vendor_name: z.string(),
  cost: optionalNumericFormValue("Estimated cost cannot be negative", 0),
});

export const erVisitFormSchema = z.object({
  patient_id: requiredTrimmed("Patient is required"),
  arrival_mode: z.union([emergencyArrivalModeFormSchema, z.literal("")]),
  chief_complaint: z.string(),
  bay_number: z.string(),
  is_mlc: z.boolean(),
  notes: z.string(),
});

export const erAdmitFormSchema = z.object({
  bed_id: requiredTrimmed("Bed is required"),
  admitting_doctor_id: requiredTrimmed("Admitting doctor is required"),
  admission_notes: z.string(),
});

export const emergencyCodeActivationFormSchema = z.object({
  code_type: emergencyCodeTypeFormSchema,
  location: requiredTrimmed("Location is required", 255),
  notes: z.string(),
});

export const emergencyCodeDeactivateFormSchema = z.object({
  outcome: emergencyCodeDeactivateOutcomeFormSchema,
  notes: z.string(),
});

export const emergencyResuscitationLogFormSchema = z
  .object({
    er_visit_id: requiredTrimmed("ER visit is required"),
    log_type: emergencyResuscitationLogTypeFormSchema,
    medication_name: z.string(),
    dose: z.string(),
    route: z.string(),
    fluid_name: z.string(),
    fluid_volume_ml: optionalNonNegativeIntegerNumber("Fluid volume must be a whole number"),
    procedure_name: z.string(),
    procedure_notes: z.string(),
    notes: z.string(),
  })
  .superRefine((value, ctx) => {
    const requireText = (
      path: "medication_name" | "dose" | "route" | "fluid_name" | "procedure_name" | "notes",
      message: string,
    ) => {
      if (!hasTrimmedValue(value[path])) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
      }
    };

    if (value.log_type === "medication") {
      requireText("medication_name", "Medication is required");
      requireText("dose", "Dose is required");
      requireText("route", "Route is required");
    }

    if (value.log_type === "fluid") {
      requireText("fluid_name", "Fluid is required");
      requireText("route", "Route is required");
      const volume = value.fluid_volume_ml;
      const hasVolume =
        typeof volume === "number" || (typeof volume === "string" && volume.trim().length > 0);
      const parsedVolume = typeof volume === "number" ? volume : Number(volume);
      if (!hasVolume || !Number.isInteger(parsedVolume) || parsedVolume <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fluid_volume_ml"],
          message: "Enter a fluid volume greater than 0 ml",
        });
      }
    }

    if (["procedure", "airway", "cpr", "defibrillation"].includes(value.log_type)) {
      requireText("procedure_name", "Procedure/action is required");
    }

    if (value.log_type === "vitals" || value.log_type === "note") {
      requireText("notes", "Clinical notes are required");
    }
  });

export const mlcCaseFormSchema = z.object({
  patient_id: requiredTrimmed("Patient is required"),
  case_type: z.union([emergencyMlcCaseTypeFormSchema, z.literal("")]),
  fir_number: z.string(),
  police_station: z.string(),
  brought_by: z.union([emergencyMlcBroughtByFormSchema, z.literal("")]),
  informant_name: z.string(),
  informant_relation: z.string(),
  informant_contact: optionalPhone,
  history_of_incident: z.string(),
  is_pocso: z.boolean(),
  is_death_case: z.boolean(),
});

export const mlcCaseUpdateFormSchema = z.object({
  status: emergencyMlcStatusFormSchema,
  case_type: z.union([emergencyMlcCaseTypeFormSchema, z.literal("")]),
  fir_number: z.string(),
  police_station: z.string(),
  examination_findings: z.string(),
  medical_opinion: z.string(),
  cause_of_death: z.string(),
});

export const massCasualtyEventFormSchema = z.object({
  event_name: requiredTrimmed("Event name is required", 255),
  event_type: z.union([emergencyMassCasualtyTypeFormSchema, z.literal("")]),
  location: z.string(),
  estimated_casualties: optionalNonNegativeIntegerNumber(
    "Estimated casualties must be a whole number",
  ),
  notes: z.string(),
});

export const massCasualtyEventUpdateFormSchema = z.object({
  status: emergencyMassCasualtyStatusFormSchema,
  actual_casualties: optionalNonNegativeIntegerNumber("Actual casualties must be a whole number"),
  notes: z.string(),
});

export const orderSetTemplateFormSchema = z.object({
  name: requiredTrimmed("Template name is required", 255),
  code: z.string(),
  description: z.string(),
  context: orderSetContextFormSchema,
  surgery_type: z.string(),
  trigger_diagnoses_text: z.string(),
});

export const orderSetItemFormSchema = z.object({
  item_type: orderSetItemTypeFormSchema,
  sort_order: optionalNonNegativeIntegerNumber("Sort order must be a whole number"),
  is_mandatory: z.boolean(),
  default_selected: z.boolean(),
  lab_priority: z.string(),
  lab_notes: z.string(),
  drug_name: z.string(),
  dosage: z.string(),
  frequency: z.string(),
  duration: z.string(),
  route: z.string(),
  med_instructions: z.string(),
  task_type: z.string(),
  task_description: z.string(),
  task_frequency: z.string(),
  diet_type: z.string(),
  diet_instructions: z.string(),
});

const dayOfWeekFormValue = formNumberValue.refine((value) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 6;
}, "Day of week must be between Sunday and Saturday");

export const schedulingWaitlistFormSchema = z.object({
  patient_id: requiredTrimmed("Patient ID is required"),
  doctor_id: z.string(),
  department_id: z.string(),
  preferred_date_from: optionalIsoDateString,
  preferred_date_to: optionalIsoDateString,
  priority: schedulingPriorityFormSchema,
  reason: z.string(),
});

export const schedulingOverbookingRuleFormSchema = z.object({
  doctor_id: requiredTrimmed("Doctor ID is required"),
  department_id: requiredTrimmed("Department ID is required"),
  day_of_week: dayOfWeekFormValue,
  max_overbook_slots: positiveInteger("Max overbook slots must be at least 1"),
  overbook_threshold_probability: formNumberValue.refine((value) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1;
  }, "Threshold must be between 0 and 1"),
  is_active: z.boolean(),
});

export const schedulingRecurringFormSchema = z.object({
  resource_id: requiredTrimmed("Resource ID is required"),
  resource_type: schedulingResourceTypeFormSchema,
  day_of_week: dayOfWeekFormValue,
  start_time: requiredTrimmed("Start time is required", 10),
  end_time: requiredTrimmed("End time is required", 10),
  repeat_count: positiveInteger("Repeat count must be at least 1").refine((value) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return parsed <= 52;
  }, "Repeat count cannot exceed 52"),
  start_date: requiredIsoDate("Start date is required"),
});

export const schedulingBlockFormSchema = z.object({
  resource_id: requiredTrimmed("Resource ID is required"),
  resource_type: schedulingResourceTypeFormSchema,
  start_time: requiredTrimmed("Block start is required"),
  end_time: requiredTrimmed("Block end is required"),
  block_reason: requiredTrimmed("Reason is required", 500),
});

export const radiologyOrderFormSchema = z.object({
  patient_id: requiredTrimmed("Patient is required"),
  modality_id: requiredTrimmed("Modality is required"),
  body_part: z.string(),
  clinical_indication: z.string(),
  priority: orderBasketRadiologyPriorityFormSchema,
  contrast_required: z.boolean(),
  pregnancy_checked: z.boolean(),
  allergy_flagged: z.boolean(),
  notes: z.string(),
});

export const radiologyAppointmentFormSchema = z.object({
  patient_id: requiredTrimmed("Patient is required"),
  modality_id: requiredTrimmed("Modality is required"),
  encounter_id: requiredTrimmed("Encounter is required"),
  priority: orderBasketRadiologyPriorityFormSchema,
  notes: z.string(),
});

export const createPaymentFormSchema = (amount: number) =>
  paymentFormSchema.superRefine((value, ctx) => {
    if (value.mode === "cash") {
      const received =
        typeof value.cashReceived === "number" ? value.cashReceived : Number(value.cashReceived);
      if (!Number.isFinite(received) || received < amount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["cashReceived"],
          message: "Cash received is less than amount due",
        });
      }
    }
    if (value.mode === "upi_qr" && value.utrReference.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["utrReference"],
        message: "UTR / reference number is required",
      });
    }
  });

export const shareGrantFormSchema = z.object({
  subject_type: sharingSubjectTypeFormSchema,
  subject_id: requiredTrimmed("Subject is required"),
  relation: shareRelationFormSchema,
  expires_at: z.date().nullable(),
  reason: z.string(),
});

export const signatureCaptureFormSchema = z.object({
  signer_role: signerRoleFormSchema,
  signer_name: requiredTrimmed("Signer name is required"),
  designation: z.string(),
  registration_number: z.string(),
});

export const opdLabOrderFormSchema = z.object({
  test_id: requiredNullableString("Lab test is required"),
  priority: opdLabOrderPriorityFormSchema,
  notes: z.string(),
});

export const opdProcedureOrderFormSchema = z.object({
  procedure_id: requiredNullableString("Procedure is required"),
  priority: opdProcedureOrderPriorityFormSchema,
  notes: z.string(),
});

export const opdReferralFormSchema = z.object({
  to_department_id: requiredNullableString("Referral department is required"),
  urgency: opdReferralUrgencyFormSchema,
  reason: requiredTrimmed("Reason is required", 1000),
  clinical_notes: z.string(),
});

export const opdPreAuthFormSchema = z.object({
  insurance_provider: requiredTrimmed("Insurance provider is required", 255),
  policy_number: z.string().max(120, "Policy number must be at most 120 characters"),
  procedure_codes: z.string().max(1000, "Procedure codes must be at most 1000 characters"),
  diagnosis_codes: z.string().max(1000, "Diagnosis codes must be at most 1000 characters"),
  estimated_cost: optionalNumericText("Enter a valid non-negative amount", 0),
  notes: z.string().max(2000, "Notes must be at most 2000 characters"),
});

export const opdReminderFormSchema = z.object({
  reminder_type: opdReminderTypeFormSchema,
  reminder_date: requiredIsoDate("Reminder date is required"),
  title: requiredTrimmed("Title is required", 255),
  description: z.string(),
  priority: opdReminderPriorityFormSchema,
});

export const opdFeedbackFormSchema = z.object({
  rating: opdRatingFormSchema.nullable(),
  wait_time_rating: opdRatingFormSchema.nullable(),
  staff_rating: opdRatingFormSchema.nullable(),
  cleanliness_rating: opdRatingFormSchema.nullable(),
  overall_experience: z.string(),
  suggestions: z.string(),
});

export const opdProcedureConsentFormSchema = z.object({
  procedure_name: requiredTrimmed("Procedure name is required", 255),
  consent_type: opdProcedureConsentTypeFormSchema,
  risks_explained: z.string(),
  alternatives_explained: z.string(),
  benefits_explained: z.string(),
  consented_by_name: z.string(),
  consented_by_relation: z.string(),
  witness_name: z.string(),
});

export const opdMedicalCertificateFormSchema = z
  .object({
    certificate_type: opdCertificateTypeFormSchema,
    issued_date: requiredIsoDate("Issued date is required"),
    valid_from: optionalIsoDateString,
    valid_to: optionalIsoDateString,
    diagnosis: z.string().max(2000, "Diagnosis must be at most 2000 characters"),
    remarks: z.string().max(2000, "Remarks must be at most 2000 characters"),
  })
  .superRefine((value, ctx) => {
    if (
      value.valid_from.trim().length > 0 &&
      value.valid_to.trim().length > 0 &&
      value.valid_to < value.valid_from
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valid_to"],
        message: "Valid to must be on or after valid from",
      });
    }
  });

export const otConsumableFormSchema = z
  .object({
    item_name: requiredTrimmed("Item name is required", 255),
    category: otConsumableCategoryFormSchema.nullable(),
    quantity: positiveNumber("Quantity must be greater than zero"),
    unit: z.string(),
    unit_price: optionalNumericFormValue("Unit price cannot be negative", 0),
    batch_number: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.category === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: "Category is required",
      });
    }
  });

export const otBookingFormSchema = z.object({
  patient_id: requiredTrimmed("Patient is required"),
  admission_id: z.string(),
  ot_room_id: requiredTrimmed("OT room is required"),
  primary_surgeon_id: requiredTrimmed("Primary surgeon is required"),
  procedure_name: requiredTrimmed("Procedure name is required", 255),
  scheduled_date: requiredTrimmed("Scheduled date is required"),
  scheduled_start: requiredTrimmed("Scheduled start is required"),
  scheduled_end: requiredTrimmed("Scheduled end is required"),
  priority: otCasePriorityFormSchema,
  notes: z.string(),
});

export const otStatusReasonFormSchema = z.object({
  reason: requiredTrimmed("Reason is required", 500),
});

export const otPreopAssessmentFormSchema = z.object({
  asa_class: otAsaClassificationFormSchema.nullable(),
  fasting_status: z.boolean(),
  lab_results_reviewed: z.boolean(),
  imaging_reviewed: z.boolean(),
  blood_group_confirmed: z.boolean(),
  npo_since: z.string(),
  allergies_noted: z.string(),
  current_medications: z.string(),
  conditions: z.string(),
});

export const otPreopAssessmentUpdateFormSchema = z.object({
  clearance_status: otPreopClearanceStatusFormSchema,
  asa_class: otAsaClassificationFormSchema.nullable(),
});

export const otSurgeonPreferenceFormSchema = z.object({
  surgeon_id: requiredTrimmed("Surgeon is required"),
  procedure_name: requiredTrimmed("Procedure name is required", 255),
  position: z.string(),
  skin_prep: z.string(),
  draping: z.string(),
  special_instructions: z.string(),
});

export const otCaseRecordFormSchema = z.object({
  procedure_performed: requiredTrimmed("Procedure performed is required", 255),
  findings: z.string(),
  technique: z.string(),
  complications: z.string(),
  blood_loss_ml: optionalNumericFormValue("Blood loss cannot be negative", 0),
  incision_time: z.string(),
  closure_time: z.string(),
  patient_in_time: z.string(),
  patient_out_time: z.string(),
  instrument_count_correct_before: z.boolean(),
  instrument_count_correct_after: z.boolean(),
  sponge_count_correct: z.boolean(),
  specimens: z.string(),
  implants: z.string(),
  drains: z.string(),
  notes: z.string(),
});

export const otAnesthesiaRecordFormSchema = z.object({
  anesthesia_type: otAnesthesiaTypeFormSchema,
  asa_class: otAsaClassificationFormSchema.nullable(),
  induction_time: z.string(),
  intubation_time: z.string(),
  airway_details: z.string(),
  drugs_administered: z.string(),
  notes: z.string(),
});

export const otPostopRecordFormSchema = z.object({
  arrival_time: z.string(),
  aldrete_score_arrival: optionalNumericFormValue(
    "Aldrete arrival score must be between 0 and 10",
    0,
    10,
  ),
  pain_assessment: z.string(),
  fluid_orders: z.string(),
  diet_orders: z.string(),
  activity_orders: z.string(),
  notes: z.string(),
});

export const otPostopRecordUpdateFormSchema = z.object({
  recovery_status: otPostopRecoveryStatusFormSchema,
  aldrete_score_discharge: optionalNumericFormValue(
    "Aldrete discharge score must be between 0 and 10",
    0,
    10,
  ),
  discharge_time: z.string(),
  disposition: z.string(),
  notes: z.string(),
});

export const otRoomFormSchema = z.object({
  name: requiredTrimmed("Room name is required", 255),
  code: requiredTrimmed("Room code is required", 64),
});

export const otUtilizationFilterFormSchema = z
  .object({
    from: z.string(),
    to: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "To date cannot be before from date",
      });
    }
  });

const startOpdVisitFormShape = {
  department_id: requiredNullableString("Pick the OPD department before starting the visit"),
  doctor_id: z.string().nullable(),
  visit_type: opdVisitTypeFormSchema,
  camp_id: z.string().nullable(),
  notes: z.string(),
};

function requireCampForCampVisit(
  values: { visit_type: OpdVisitTypeFormValue; camp_id: string | null },
  ctx: z.RefinementCtx,
) {
  if (values.visit_type === "camp" && !values.camp_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["camp_id"],
      message: "Select the camp for camp OPD visits",
    });
  }
}

export const opdQueueVisitFormSchema = z
  .object({
    ...startOpdVisitFormShape,
    patient_id: requiredTrimmed("Patient is required"),
  })
  .superRefine(requireCampForCampVisit);

export const opdFollowUpAppointmentFormSchema = z.object({
  appointment_date: requiredNullableIsoDate("Follow-up date is required"),
  slot: requiredNullableString("Select an available slot"),
  reason: z.string(),
});

export const ipdDamaFormSchema = z
  .object({
    record_type: damaRecordTypeFormSchema,
    patient_signed: z.boolean(),
    relative_name: z.string(),
    relative_relation: z.string(),
    relative_signed: z.boolean(),
    witness_name: z.string(),
    witness_signed: z.boolean(),
    risks_explained: requiredTrimmed("Record the risks explained before saving DAMA/LAMA"),
    reason_for_leaving: z.string(),
    is_mlc_case: z.boolean(),
    notes: z.string(),
  })
  .superRefine((value, ctx) => {
    if (!value.patient_signed && !value.relative_signed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["patient_signed"],
        message: "Either patient or relative must sign before recording",
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["relative_signed"],
        message: "Either patient or relative must sign before recording",
      });
    }
  });

export const ipdTransferOutFormSchema = z.object({
  receiving_hospital: requiredTrimmed("Receiving hospital is required"),
  receiving_doctor: z.string(),
  receiving_phone: optionalPhone,
  reason: requiredTrimmed("Reason for transfer is required"),
  clinical_summary: z.string(),
  transport_mode: z.string(),
  accompanying_staff: z.string(),
});

export const ipdMarkDeathFormSchema = z
  .object({
    death_at: z.date().nullable(),
    cause_of_death: z.string(),
    primary_dx: z.string(),
    is_mlc_case: z.boolean(),
    autopsy_required: z.boolean(),
    notes: z.string(),
  })
  .superRefine((value, ctx) => {
    if (!value.death_at) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["death_at"],
        message: "Civil registration requires the exact death timestamp",
      });
    }
  });

export const miniDepartmentFormSchema = z.object({
  name: setupNameField,
  code: setupCodeField,
  department_type: departmentTypeFormSchema,
});

export const createDepartmentFormSchema = miniDepartmentFormSchema;

export const createFacilityFormSchema = z.object({
  code: setupCodeField,
  name: setupNameField,
  facility_type: facilityTypeFormSchema,
});

export const facilitySettingsFormSchema = createFacilityFormSchema.extend({
  parent_id: z.string().nullable(),
  address_line1: z.string(),
  city: z.string(),
  phone: optionalPhone,
  email: optionalEmail,
  bed_count: optionalNonNegativeIntegerNumber("Bed count must be a whole number"),
  shared_billing: z.boolean(),
  shared_pharmacy: z.boolean(),
  shared_lab: z.boolean(),
  shared_hr: z.boolean(),
});

export const sequenceSettingsFormSchema = z.object({
  seq_type: requiredTrimmed("Sequence type is required", 50).refine(
    (value) => /^[a-z][a-z0-9_]*$/.test(value.trim()),
    "Use lowercase letters, digits, and underscores; start with a letter",
  ),
  prefix: z.string().max(20, "Prefix must be at most 20 characters"),
  pad_width: positiveInteger("Pad width must be a positive whole number")
    .refine((value) => Number(value) >= 3, "Pad width must be at least 3")
    .refine((value) => Number(value) <= 10, "Pad width cannot exceed 10"),
});

export const generalSettingsFormSchema = z.object({
  address_line1: z.string(),
  address_line2: z.string(),
  city: z.string(),
  pincode: z.string(),
  phone: optionalPhone,
  email: optionalEmail,
  website: z.string(),
  registration_no: z.string(),
  accreditation: z.string(),
  timezone: requiredTrimmed("Timezone is required", 80),
  currency: requiredTrimmed("Currency is required", 3).refine(
    (value) => /^[A-Z]{3}$/.test(value.trim()),
    "Currency must be a 3-letter ISO code",
  ),
  fy_start_month: z.string().refine((value) => {
    const month = Number(value);
    return Number.isInteger(month) && month >= 1 && month <= 12;
  }, "Financial year start month is required"),
});

const hexColorField = requiredTrimmed("Color is required", 7).refine(
  (value) => /^#[0-9A-Fa-f]{6}$/.test(value.trim()),
  "Use a valid hex color",
);

export const brandingSettingsFormSchema = z.object({
  primary_color: hexColorField,
  secondary_color: hexColorField,
  logo_url: z.string(),
});

export const offlineModeSettingsFormSchema = z
  .object({
    offlineMode: z.boolean(),
    edgeUrl: z.string(),
  })
  .superRefine((value, ctx) => {
    const edgeUrl = value.edgeUrl.trim();
    if (value.offlineMode && edgeUrl.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edgeUrl"],
        message: "Edge URL is required when offline mode is enabled",
      });
      return;
    }
    if (edgeUrl.length > 0 && !edgeUrl.startsWith("ws://") && !edgeUrl.startsWith("wss://")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["edgeUrl"],
        message: "Use ws:// or wss:// for the edge appliance URL",
      });
    }
  });

const boundedInteger = (message: string, min: number, max: number) =>
  formNumberValue.refine((value) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isInteger(parsed) && parsed >= min && parsed <= max;
  }, message);

export const printTemplateSettingsFormSchema = z.object({
  header_text: z.string(),
  footer_text: z.string(),
  logo_position: printTemplateLogoPositionFormSchema,
  font_family: requiredTrimmed("Font family is required", 100),
  font_size: boundedInteger("Font size must be between 8 and 24", 8, 24),
  margin_top: boundedInteger("Top margin must be between 0 and 50", 0, 50),
  margin_bottom: boundedInteger("Bottom margin must be between 0 and 50", 0, 50),
  margin_left: boundedInteger("Left margin must be between 0 and 50", 0, 50),
  margin_right: boundedInteger("Right margin must be between 0 and 50", 0, 50),
  show_logo: z.boolean(),
  show_hospital_name: z.boolean(),
  show_hospital_address: z.boolean(),
  show_hospital_phone: z.boolean(),
  show_registration_no: z.boolean(),
  custom_css: z.string(),
});

export const consultationTemplateSettingsFormSchema = z.object({
  name: requiredTrimmed("Template name is required", 120),
  description: z.string(),
  specialty: z.string(),
  department_id: z.string().nullable(),
  is_shared: z.boolean(),
  chief_complaints: z.string(),
  default_plan: z.string(),
  common_diagnoses: z.string(),
});

export const utilizationReviewFormSchema = z.object({
  admission_id: requiredTrimmed("Admission ID is required"),
  patient_id: requiredTrimmed("Patient is required"),
  review_type: urReviewTypeFormSchema,
  patient_status: urPatientStatusFormSchema,
  criteria_source: z.string(),
  clinical_summary: z.string(),
  expected_los_days: optionalNonNegativeIntegerNumber("Expected LOS must be a whole number"),
  approved_days: optionalNonNegativeIntegerNumber("Approved days must be a whole number"),
  next_review_date: z
    .string()
    .nullable()
    .refine((value) => !value || isoDatePattern.test(value), "Enter a valid next review date"),
});

export const urCommunicationFormSchema = z.object({
  review_id: requiredTrimmed("Review ID is required"),
  communication_type: urCommunicationTypeFormSchema,
  payer_name: requiredTrimmed("Payer name is required", 120),
  reference_number: z.string(),
  summary: z.string(),
});

export const urStatusConversionFormSchema = z
  .object({
    admission_id: requiredTrimmed("Admission ID is required"),
    from_status: urPatientStatusFormSchema,
    to_status: urPatientStatusFormSchema,
    reason: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.from_status === value.to_status) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to_status"],
        message: "Target status must differ from current status",
      });
    }
  });

export const commandCenterTransportFormSchema = z.object({
  patient_id: z.string(),
  from_location_id: requiredTrimmed("From location ID is required"),
  to_location_id: requiredTrimmed("To location ID is required"),
  transport_mode: transportModeFormSchema,
  priority: transportPriorityFormSchema,
  notes: z.string(),
});

export const commandCenterAssignTransportFormSchema = z.object({
  assigned_to: requiredTrimmed("Assigned staff ID is required"),
});

export const commandCenterAlertThresholdFormSchema = z
  .object({
    department_id: requiredTrimmed("Department ID is required"),
    metric_code: requiredTrimmed("Metric is required"),
    warning_threshold: optionalNonNegativeIntegerNumber("Warning threshold must be non-negative"),
    critical_threshold: optionalNonNegativeIntegerNumber("Critical threshold must be non-negative"),
  })
  .superRefine((value, ctx) => {
    const hasWarning =
      typeof value.warning_threshold === "number" ||
      (typeof value.warning_threshold === "string" && value.warning_threshold.trim().length > 0);
    const hasCritical =
      typeof value.critical_threshold === "number" ||
      (typeof value.critical_threshold === "string" && value.critical_threshold.trim().length > 0);
    if (!hasWarning && !hasCritical) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["warning_threshold"],
        message: "Enter at least one threshold",
      });
    }
  });

export const mlcSbarFormSchema = z.object({
  situation: requiredTrimmed("Situation is required", 2000),
  background: requiredTrimmed("Background is required", 2000),
  assessment: requiredTrimmed("Assessment is required", 2000),
  recommendation: requiredTrimmed("Recommendation is required", 2000),
});

export const mlcAgeEstimationFormSchema = z.object({
  ossification_center_findings: requiredTrimmed("Ossification findings are required", 4000),
  dental_examination: requiredTrimmed("Dental examination is required", 4000),
  secondary_sexual_characteristics: z.string(),
  estimated_age_range: requiredTrimmed("Estimated age range is required", 120),
  examiner_opinion: requiredTrimmed("Examiner opinion is required", 4000),
});

export const mlcPocsoReportFormSchema = z.object({
  child_age: requiredTrimmed("Child age is required", 80),
  guardian_details: requiredTrimmed("Guardian details are required", 1000),
  statement_summary: requiredTrimmed("Statement summary is required", 4000),
  injuries_documented: requiredTrimmed("Injuries documented is required", 4000),
  psych_assessment_needed: z.boolean(),
});

export const mlcCourtSummonsFormSchema = z.object({
  date: requiredTrimmed("Summons date is required").refine(
    (value) => isoDatePattern.test(value.trim()),
    "Enter a valid summons date",
  ),
  court_name: requiredTrimmed("Court name is required", 200),
  case_number: requiredTrimmed("Case number is required", 120),
  status: courtSummonsStatusFormSchema,
  notes: z.string(),
});

export const mlcPoliceIntimationFormSchema = z.object({
  police_station: requiredTrimmed("Police station is required", 200),
  officer_name: z.string(),
  officer_designation: z.string(),
  officer_contact: z.string(),
  sent_via: emergencyMlcPoliceSentViaFormSchema,
  notes: z.string(),
});

export const mlcPoliceReceiptConfirmationFormSchema = z.object({
  receipt_number: requiredTrimmed("Receipt/reference number is required", 120),
  notes: z.string(),
});

export const mlcPrintPacketTypeValues = ["documentation", "register"] as const;
export const mlcPrintPacketTypeFormSchema = z.enum(mlcPrintPacketTypeValues);

export const mlcPrintReprintFormSchema = z.object({
  packet_type: mlcPrintPacketTypeFormSchema,
  reprint_reason: requiredTrimmed("Reprint reason is required", 255).refine(
    (value) => value.trim().length >= 5,
    "Enter at least 5 characters",
  ),
});

export const mrdCaseSheetFileFormSchema = z.object({
  storage_location_id: z.string().uuid("Storage location is required"),
  notes: z.string().max(500, "Notes must be 500 characters or less").optional(),
});

export type MrdCaseSheetFileFormInput = z.infer<typeof mrdCaseSheetFileFormSchema>;

export const mrdCaseSheetReprintFormSchema = z.object({
  reprint_reason: requiredTrimmed("Reprint reason is required", 255).refine(
    (value) => value.trim().length >= 5,
    "Enter at least 5 characters",
  ),
});

export type MrdCaseSheetReprintFormInput = z.infer<typeof mrdCaseSheetReprintFormSchema>;

export const documentPrintFormatValues = [
  "a4_portrait",
  "a4_landscape",
  "a5_portrait",
  "a5_landscape",
  "thermal_80mm",
  "thermal_58mm",
  "label_50x25mm",
  "wristband",
  "custom",
] as const;

export const printerTypeValues = ["laser", "thermal", "label", "wristband", "virtual"] as const;
export const printerConnectionTypeValues = ["network", "usb", "agent", "browser"] as const;
export const printCopyModeValues = [
  "customer",
  "office",
  "clinical",
  "mrd",
  "lab",
  "pharmacy",
  "police",
  "duplicate",
] as const;
export const logicalPrinterProfileValues = [
  "registration-a4",
  "patient-card",
  "opd-token-thermal",
  "opd-a4",
  "opd-summary",
  "opd-certificate-a4",
  "consent-a4",
  "ipd-a4",
  "ipd-discharge-a4",
  "wristband-label",
  "emergency-a4",
  "mlc-secure-printer",
  "camp-token-thermal",
  "camp-a4",
  "pharmacy-receipt-80mm",
  "pharmacy-drug-label",
  "lab-report-a4",
  "radiology-report-a4",
  "billing-receipt-80mm",
  "billing-a4",
  "mrd-a4",
  "mrd-record-room",
] as const;

export const createPrinterFormSchema = z.object({
  name: requiredTrimmed("Printer name is required", 120),
  printer_type: z.enum(printerTypeValues),
  connection_type: z.enum(printerConnectionTypeValues),
  connection_string: z.string().max(300, "Connection string is too long"),
  default_format: z.enum(documentPrintFormatValues),
  profile_code: z.enum(logicalPrinterProfileValues),
  copy_modes: z.array(z.enum(printCopyModeValues)).min(1, "Select at least one copy type"),
});

export const bmwTransportManifestFormSchema = z.object({
  department_id: requiredTrimmed("Department ID is required"),
  waste_category: biowasteCategoryFormSchema,
  weight_kg: nonNegativeNumber("Weight cannot be negative"),
  record_date: requiredTrimmed("Pickup date is required").refine(
    (value) => isoDatePattern.test(value.trim()),
    "Enter a valid pickup date",
  ),
  container_count: positiveInteger("Container count must be at least 1"),
  disposal_vendor: requiredTrimmed("Disposal vendor / CBWTF is required", 200),
  manifest_number: requiredTrimmed("Manifest number is required", 120),
  vehicle_number: requiredTrimmed("Vehicle number is required", 80),
  driver_name: requiredTrimmed("Driver name is required", 120),
  handover_person: requiredTrimmed("Handover person is required", 120),
  notes: z.string(),
});

export const procurementVendorFormSchema = z
  .object({
    code: requiredTrimmed("Vendor code is required", 80),
    name: requiredTrimmed("Vendor name is required", 200),
    vendor_type: vendorTypeFormSchema,
    contact_person: z.string(),
    phone: optionalPhone,
    email: optionalEmail,
    city: z.string(),
    gst_number: z.string(),
    payment_terms: vendorPaymentTermsFormSchema,
    supply_categories: z.array(supplyCategoryFormSchema),
    drug_license_number: z.string(),
    is_pharmacy_vendor: z.boolean(),
    product_lines: z.string(),
  })
  .superRefine((value, ctx) => {
    const requiresDrugLicense =
      value.is_pharmacy_vendor || value.supply_categories.includes("pharmacy");
    if (requiresDrugLicense && value.drug_license_number.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["drug_license_number"],
        message: "Drug license number is required for pharmacy vendors",
      });
    }
  });

const procurementPoItemFormSchema = z.object({
  catalog_item_id: z.string().nullable(),
  item_name: requiredTrimmed("Item name is required", 200),
  item_code: z.string(),
  unit: z.string(),
  quantity_ordered: positiveInteger("Quantity must be at least 1"),
  unit_price: nonNegativeNumber("Unit price cannot be negative"),
  tax_percent: optionalNumericText("Tax percent must be between 0 and 100", 0, 100),
  discount_percent: optionalNumericText("Discount percent must be between 0 and 100", 0, 100),
  indent_item_id: z.string().nullable(),
  notes: z.string(),
});

export const procurementPurchaseOrderFormSchema = z.object({
  vendor_id: requiredTrimmed("Vendor is required"),
  indent_requisition_id: z.string().nullable(),
  notes: z.string(),
  items: z.array(procurementPoItemFormSchema).min(1, "At least one item is required"),
});

const procurementGrnItemFormSchema = z
  .object({
    po_item_id: z.string().nullable(),
    catalog_item_id: z.string().nullable(),
    item_name: requiredTrimmed("Item name is required", 200),
    quantity_received: positiveInteger("Received quantity must be at least 1"),
    quantity_accepted: nonNegativeInteger("Accepted quantity cannot be negative"),
    quantity_rejected: nonNegativeInteger("Rejected quantity cannot be negative"),
    batch_number: z.string(),
    expiry_date: optionalIsoDateString,
    manufacture_date: optionalIsoDateString,
    unit_price: nonNegativeNumber("Unit price cannot be negative"),
    rejection_reason: z.string(),
    notes: z.string(),
  })
  .superRefine((value, ctx) => {
    const received = Number(value.quantity_received);
    const accepted = Number(value.quantity_accepted);
    const rejected = Number(value.quantity_rejected);

    if (Number.isFinite(received) && Number.isFinite(accepted) && accepted > received) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity_accepted"],
        message: "Accepted quantity cannot exceed received quantity",
      });
    }

    if (
      Number.isFinite(received) &&
      Number.isFinite(accepted) &&
      Number.isFinite(rejected) &&
      accepted + rejected > received
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity_rejected"],
        message: "Accepted plus rejected quantity cannot exceed received quantity",
      });
    }
  });

export const procurementGrnFormSchema = z.object({
  po_id: requiredTrimmed("Purchase order is required"),
  invoice_number: z.string(),
  notes: z.string(),
  items: z.array(procurementGrnItemFormSchema).min(1, "At least one item is required"),
});

const procurementRateContractItemFormSchema = z.object({
  catalog_item_id: requiredTrimmed("Catalog item is required"),
  contracted_price: nonNegativeNumber("Contracted price cannot be negative"),
  max_quantity: optionalNonNegativeIntegerNumber("Max quantity must be a whole number"),
  notes: z.string(),
});

export const procurementRateContractFormSchema = z
  .object({
    vendor_id: requiredTrimmed("Vendor is required"),
    start_date: requiredTrimmed("Start date is required").refine(
      (value) => isoDatePattern.test(value.trim()),
      "Enter a valid start date",
    ),
    end_date: requiredTrimmed("End date is required").refine(
      (value) => isoDatePattern.test(value.trim()),
      "Enter a valid end date",
    ),
    notes: z.string(),
    items: z.array(procurementRateContractItemFormSchema).min(1, "At least one item is required"),
  })
  .superRefine((value, ctx) => {
    if (value.start_date && value.end_date && value.end_date < value.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_date"],
        message: "End date must be on or after start date",
      });
    }
  });

export const procurementStoreLocationFormSchema = z.object({
  code: requiredTrimmed("Store code is required", 80),
  name: requiredTrimmed("Store name is required", 200),
  location_type: storeLocationTypeFormSchema,
  address: z.string(),
});

export const procurementSupplierPaymentFormSchema = z.object({
  vendor_id: requiredTrimmed("Vendor is required"),
  po_id: z.string().nullable(),
  invoice_amount: positiveNumber("Invoice amount must be greater than zero"),
  paid_amount: nonNegativeNumber("Paid amount cannot be negative"),
  due_date: optionalIsoDateString,
  payment_method: supplierPaymentMethodFormSchema.nullable(),
  reference_number: z.string(),
  notes: z.string(),
});

export const createLocationFormSchema = z.object({
  code: setupCodeField,
  name: setupNameField,
  level: locationLevelFormSchema,
});

export const inlineCreateRoleFormSchema = z.object({
  code: usernameField,
  name: setupNameField,
  description: z.string().max(500, "Description must be at most 500 characters"),
});

export const miniDoctorFormSchema = z.object({
  full_name: requiredTrimmed("Full name is required", 100).refine(
    (value) => value.trim().length >= 2,
    "Full name must be at least 2 characters",
  ),
  email: requiredTrimmed("Email is required").refine(
    (value) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value.trim()),
    "Enter a valid email",
  ),
  username: usernameField,
  password: strongPasswordField,
  role: requiredTrimmed("Role is required"),
  department_ids: z.array(z.string()),
  specialization: z.string(),
  medical_registration_number: z.string(),
  qualification: z.string(),
  consultation_fee: z.union([nonNegativeNumber("Fee cannot be negative"), z.literal("")]),
});

export const userCreateDrawerFormSchema = z.object({
  username: usernameField,
  email: requiredTrimmed("Email is required").refine(
    (value) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value.trim()),
    "Enter a valid email address",
  ),
  password: strongPasswordField,
  full_name: requiredTrimmed("Full name is required", 100).refine(
    (value) => value.trim().length >= 2,
    "Full name must be at least 2 characters",
  ),
  prefix: z.string(),
  phone: optionalPhone,
  role: requiredNullableString("Role is required"),
  departmentIds: z.array(z.string()),
  groupIds: z.array(z.string()),
  extra: z.array(z.string()),
  denied: z.array(z.string()),
});

const adminUserFormBaseSchema = z.object({
  full_name: requiredTrimmed("Full name is required", 100).refine(
    (value) => value.trim().length >= 2,
    "Full name must be at least 2 characters",
  ),
  username: usernameField,
  email: requiredTrimmed("Email is required").refine(
    (value) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value.trim()),
    "Enter a valid email address",
  ),
  password: z.string(),
  role: requiredNullableString("Role is required"),
  is_active: z.boolean(),
  specialization: z.string(),
  medical_registration_number: z.string(),
  qualification: z.string(),
  consultation_fee: z.union([
    nonNegativeNumber("Consultation fee cannot be negative"),
    z.literal(""),
  ]),
  department_ids: z.array(z.string()),
});

export const createAdminUserFormSchema = (isEdit: boolean) =>
  adminUserFormBaseSchema.superRefine((value, ctx) => {
    if (isEdit && value.password.trim().length === 0) {
      return;
    }
    const password = strongPasswordField.safeParse(value.password);
    if (!password.success) {
      for (const issue of password.error.issues) {
        ctx.addIssue({ ...issue, path: ["password"] });
      }
    }
  });

export const bulkImportUsersFormSchema = z.object({
  usersJson: requiredTrimmed("User JSON is required"),
});

export const editRoleFormSchema = z.object({
  name: setupNameField,
  description: z.string().max(500, "Description must be at most 500 characters"),
});

export const adminCreateRoleFormSchema = inlineCreateRoleFormSchema.extend({
  template: z.string().nullable(),
});

export const doctorProfileFormSchema = z.object({
  user_id: requiredNullableString("Linked doctor user is required"),
  prefix: z.string(),
  display_name: requiredTrimmed("Display name is required", 100).refine(
    (value) => value.trim().length >= 2,
    "Display name must be at least 2 characters",
  ),
  qualification_string: z.string(),
  mci_number: z.string(),
  state_council_number: z.string(),
  state_council_name: z.string(),
  subspecialty: z.string(),
  years_experience: z.string().refine((value) => {
    if (value.trim().length === 0) return true;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
  }, "Enter a valid experience in years"),
  is_visiting: z.boolean(),
  can_sign_mlc: z.boolean(),
  can_perform_surgery: z.boolean(),
});

export const linkedDoctorUserFormSchema = z.object({
  full_name: requiredTrimmed("Full name is required", 100).refine(
    (value) => value.trim().length >= 2,
    "Full name must be at least 2 characters",
  ),
  username: usernameField,
  email: requiredTrimmed("Email is required").refine(
    (value) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value.trim()),
    "Enter a valid email address",
  ),
  password: strongPasswordField,
  department_ids: z.array(z.string()),
  specialization: z.string(),
  medical_registration_number: z.string(),
  qualification: z.string(),
});

export const signatureCredentialIssueFormSchema = z.object({
  display_image_url: z.string().refine((value) => {
    if (value.trim().length === 0) return true;
    return value.startsWith("data:image/") || /^https?:\/\/.+/i.test(value.trim());
  }, "Enter a valid image URL or uploaded image"),
});

export const bookAppointmentFormSchema = z.object({
  patient_id: requiredNullableString("Patient is required"),
  doctor_id: requiredNullableString("Doctor is required"),
  department_id: requiredNullableString("Department is required"),
  appointment_date: requiredNullableIsoDate("Appointment date is required"),
  appointment_type: appointmentTypeFormSchema,
  reason: z.string(),
  recurrence_pattern: appointmentRecurrenceFormSchema.nullable(),
  recurrence_count: z.string(),
});

export const cancelAppointmentFormSchema = z.object({
  cancel_reason: z.string(),
});

export const rescheduleAppointmentFormSchema = z.object({
  appointment_date: requiredNullableIsoDate("Appointment date is required"),
});

export const chronicProgramFormSchema = z.object({
  name: requiredTrimmed("Program name is required"),
  code: requiredTrimmed("Code is required"),
  program_type: chronicProgramTypeFormSchema,
  description: z.string(),
  default_duration_months: z.union([
    positiveInteger("Enter a positive whole number"),
    z.literal(""),
  ]),
});

export const chronicEnrollmentFormSchema = z.object({
  patient_id: requiredTrimmed("Patient is required"),
  program_id: requiredTrimmed("Program is required"),
  icd_code: z.string().optional(),
  enrollment_date: optionalIsoDate,
  notes: z.string().optional(),
});

export const mobileShellLoginFormSchema = z.object({
  identifier: requiredTrimmed("Identifier is required").refine(
    (value) => value.trim().length >= 3,
    "Identifier must be at least 3 characters",
  ),
  password: requiredTrimmed("Password is required").refine(
    (value) => value.length >= 4,
    "Password must be at least 4 characters",
  ),
});

export const mobileLoginFormSchema = z.object({
  username: usernameField,
  password: requiredTrimmed("Password is required").refine(
    (value) => value.length >= 4,
    "Password must be at least 4 characters",
  ),
});

export const mobileVitalsEntryFormSchema = z.object({
  temperature: optionalNumericText(
    "patientJourney.mobile.vitals.errors.invalidTemperature",
    80,
    115,
  ),
  pulse: optionalNumericText("patientJourney.mobile.vitals.errors.invalidPulse", 1, 260),
  systolic: optionalNumericText("patientJourney.mobile.vitals.errors.invalidSystolic", 1, 300),
  diastolic: optionalNumericText("patientJourney.mobile.vitals.errors.invalidDiastolic", 1, 200),
  respiration: optionalNumericText(
    "patientJourney.mobile.vitals.errors.invalidRespiration",
    1,
    100,
  ),
  spo2: optionalNumericText("patientJourney.mobile.vitals.errors.invalidSpo2", 1, 100),
  weight: optionalNumericText("patientJourney.mobile.vitals.errors.invalidWeight", 0, 500),
  height: optionalNumericText("patientJourney.mobile.vitals.errors.invalidHeight", 0, 250),
  notes: z.string(),
});

export const mobileStaffPatientRegistrationFormSchema = z
  .object({
    first_name: requiredTrimmed("First name is required", 100),
    last_name: requiredTrimmed("Last name is required", 100),
    gender: genderFormSchema,
    phone: requiredPhone,
    date_of_birth: optionalIsoDateString,
    age: optionalNonNegativeIntegerText,
    registration_type: registrationTypeFormSchema,
    registration_source: registrationSourceFormSchema,
    camp_id: z.string(),
    camp_name: z.string(),
    referred_by_kind: referredByKindFormSchema,
    referred_by_user_id: z.string(),
    referred_by_facility_id: z.string(),
    referred_by_name: z.string(),
    referred_by_phone: optionalPhone,
    referred_by_facility: z.string(),
    department_id: z.string(),
    consultant_id: z.string(),
    clinical_unit: z.string(),
    diagnosis_text: z.string(),
    icd11_code: z.string(),
    is_medico_legal: z.boolean(),
    mlc_number: z.string(),
    is_vip: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.is_medico_legal && value.mlc_number.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mlc_number"],
        message: "MLC number is required for medico-legal registrations",
      });
    }
  });

export const mobileConsultationNotesFormSchema = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
});

const mobilePrescriptionRequiredTrimmed = (requiredMessage: string) =>
  z
    .string()
    .max(255, "patientJourney.mobile.prescription.errors.tooLong")
    .refine((value) => value.trim().length > 0, requiredMessage);

export const mobilePrescriptionItemFormSchema = z.object({
  drug_name: mobilePrescriptionRequiredTrimmed(
    "patientJourney.mobile.prescription.errors.drugNameRequired",
  ),
  generic_name: z.string().optional(),
  dosage: mobilePrescriptionRequiredTrimmed(
    "patientJourney.mobile.prescription.errors.dosageRequired",
  ),
  frequency: mobilePrescriptionRequiredTrimmed(
    "patientJourney.mobile.prescription.errors.frequencyRequired",
  ),
  duration: mobilePrescriptionRequiredTrimmed(
    "patientJourney.mobile.prescription.errors.durationRequired",
  ),
  route: mobilePrescriptionRequiredTrimmed(
    "patientJourney.mobile.prescription.errors.routeRequired",
  ),
  instructions: z.string().optional(),
});

export const mobilePatientProfileContactFormSchema = z.object({
  phone: optionalPhone,
  phone_secondary: optionalPhone,
  email: optionalEmail,
});

export const bedTypeSettingsFormSchema = z.object({
  code: setupCodeField,
  name: setupNameField,
  daily_rate: nonNegativeNumber("Daily rate cannot be negative"),
  description: z.string(),
});

export const serviceSettingsFormSchema = z.object({
  code: setupCodeField,
  name: setupNameField,
  service_type: serviceTypeFormSchema,
  base_price: nonNegativeNumber("Base price cannot be negative"),
  department_id: z.string().nullable(),
  description: z.string(),
});

export const taxCategorySettingsFormSchema = z.object({
  code: setupCodeField,
  name: setupNameField,
  rate_percent: nonNegativeNumber("Tax rate cannot be negative").refine((value) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed <= 100;
  }, "Tax rate cannot exceed 100%"),
  applicability: taxApplicabilityFormSchema,
  description: z.string(),
});

export const paymentMethodSettingsFormSchema = z.object({
  code: setupCodeField,
  name: setupNameField,
  is_default: z.boolean(),
});

export const clinicalMasterSettingsFormSchema = z.object({
  code: setupCodeField,
  name: setupNameField,
  sort_order: nonNegativeInteger("Sort order must be a whole number"),
});

export const insuranceProviderSettingsFormSchema = z.object({
  code: setupCodeField,
  name: setupNameField,
  provider_type: insuranceProviderTypeFormSchema,
  contact_phone: optionalPhone,
  contact_email: optionalEmail,
  website: z.string(),
});

export type GenderFormValue = z.infer<typeof genderFormSchema>;
export type BloodGroupFormValue = z.infer<typeof bloodGroupFormSchema>;
export type MaritalStatusFormValue = z.infer<typeof maritalStatusFormSchema>;
export type PatientCategoryFormValue = z.infer<typeof patientCategoryFormSchema>;
export type RegistrationTypeFormValue = z.infer<typeof registrationTypeFormSchema>;
export type RegistrationSourceFormValue = z.infer<typeof registrationSourceFormSchema>;
export type FinancialClassFormValue = z.infer<typeof financialClassFormSchema>;
export type ReferredByKindFormValue = z.infer<typeof referredByKindFormSchema>;
export type DrugScheduleFormValue = z.infer<typeof drugScheduleFormSchema>;
export type FormularyStatusFormValue = z.infer<typeof formularyStatusFormSchema>;
export type AwareCategoryFormValue = z.infer<typeof awareCategoryFormSchema>;
export type VendorTypeFormValue = z.infer<typeof vendorTypeFormSchema>;
export type SupplyCategoryFormValue = z.infer<typeof supplyCategoryFormSchema>;
export type AppointmentTypeFormValue = z.infer<typeof appointmentTypeFormSchema>;
export type AppointmentRecurrenceFormValue = z.infer<typeof appointmentRecurrenceFormSchema>;
export type ShareRelationFormValue = z.infer<typeof shareRelationFormSchema>;
export type SharingSubjectTypeFormValue = z.infer<typeof sharingSubjectTypeFormSchema>;
export type SignerRoleFormValue = z.infer<typeof signerRoleFormSchema>;
export type PaymentModeFormValue = z.infer<typeof paymentModeFormSchema>;
export type BillingChargeSourceFormValue = z.infer<typeof billingChargeSourceFormSchema>;
export type BillingPaymentModeFormValue = z.infer<typeof billingPaymentModeFormSchema>;
export type BillingDiscountTypeFormValue = z.infer<typeof billingDiscountTypeFormSchema>;
export type BillingServiceCategoryFormValue = z.infer<typeof billingServiceCategoryFormSchema>;
export type BillingGstCategoryFormValue = z.infer<typeof billingGstCategoryFormSchema>;
export type BillingAdvancePurposeFormValue = z.infer<typeof billingAdvancePurposeFormSchema>;
export type BillingInsuranceClaimTypeFormValue = z.infer<
  typeof billingInsuranceClaimTypeFormSchema
>;
export type BillingInsuranceSchemeTypeFormValue = z.infer<
  typeof billingInsuranceSchemeTypeFormSchema
>;
export type BillingCreditPatientStatusFormValue = z.infer<
  typeof billingCreditPatientStatusFormSchema
>;
export type BillingTdsSectionFormValue = z.infer<typeof billingTdsSectionFormSchema>;
export type BillingTdsQuarterFormValue = z.infer<typeof billingTdsQuarterFormSchema>;
export type BillingGstrReturnTypeFormValue = z.infer<typeof billingGstrReturnTypeFormSchema>;
export type BillingErpTargetSystemFormValue = z.infer<typeof billingErpTargetSystemFormSchema>;
export type BillingErpExportTypeFormValue = z.infer<typeof billingErpExportTypeFormSchema>;
export type IpdAdmissionSourceFormValue = z.infer<typeof ipdAdmissionSourceFormSchema>;
export type IpdTransferTypeFormValue = z.infer<typeof ipdTransferTypeFormSchema>;
export type IpdClinicalAssessmentTypeFormValue = z.infer<
  typeof ipdClinicalAssessmentTypeFormSchema
>;
export type IpdNursingTaskTypeFormValue = z.infer<typeof ipdNursingTaskTypeFormSchema>;
export type IpdProgressNoteTypeFormValue = z.infer<typeof ipdProgressNoteTypeFormSchema>;
export type LabSampleTypeFormValue = z.infer<typeof labSampleTypeFormSchema>;
export type LabMethodFormValue = z.infer<typeof labMethodFormSchema>;
export type LabCollectionCenterTypeFormValue = z.infer<typeof labCollectionCenterTypeFormSchema>;
export type LabEqasEvaluationFormValue = z.infer<typeof labEqasEvaluationFormSchema>;
export type LabNablDocumentTypeFormValue = z.infer<typeof labNablDocumentTypeFormSchema>;
export type LabBethesdaCategoryFormValue = z.infer<typeof labBethesdaCategoryFormSchema>;
export type LabMolecularTestMethodFormValue = z.infer<typeof labMolecularTestMethodFormSchema>;
export type LabMolecularResultInterpretationFormValue = z.infer<
  typeof labMolecularResultInterpretationFormSchema
>;
export type LabB2bClientTypeFormValue = z.infer<typeof labB2bClientTypeFormSchema>;
export type CampTypeFormValue = z.infer<typeof campTypeFormSchema>;
export type CampIdProofTypeFormValue = z.infer<typeof campIdProofTypeFormSchema>;
export type CampFollowupTypeFormValue = z.infer<typeof campFollowupTypeFormSchema>;
export type DietTypeFormValue = z.infer<typeof dietTypeFormSchema>;
export type MealTypeFormValue = z.infer<typeof mealTypeFormSchema>;
export type MealPrepStatusFormValue = z.infer<typeof mealPrepStatusFormSchema>;
export type KitchenAuditTypeFormValue = z.infer<typeof kitchenAuditTypeFormSchema>;
export type CaseMgmtStatusFormValue = z.infer<typeof caseMgmtStatusFormSchema>;
export type CaseMgmtPriorityFormValue = z.infer<typeof caseMgmtPriorityFormSchema>;
export type DischargeBarrierTypeFormValue = z.infer<typeof dischargeBarrierTypeFormSchema>;
export type CaseReferralTypeFormValue = z.infer<typeof caseReferralTypeFormSchema>;
export type CaseReferralStatusFormValue = z.infer<typeof caseReferralStatusFormSchema>;
export type CssdSterilizationMethodFormValue = z.infer<typeof cssdSterilizationMethodFormSchema>;
export type CssdIndicatorTypeFormValue = z.infer<typeof cssdIndicatorTypeFormSchema>;
export type CssdInstrumentCategoryFormValue = z.infer<typeof cssdInstrumentCategoryFormSchema>;
export type CssdMaintenanceTypeFormValue = z.infer<typeof cssdMaintenanceTypeFormSchema>;
export type AmbulanceTypeFormValue = z.infer<typeof ambulanceTypeFormSchema>;
export type AmbulanceTripTypeFormValue = z.infer<typeof ambulanceTripTypeFormSchema>;
export type AmbulanceTripPriorityFormValue = z.infer<typeof ambulanceTripPriorityFormSchema>;
export type AmbulanceFuelTypeFormValue = z.infer<typeof ambulanceFuelTypeFormSchema>;
export type AmbulanceLicenseTypeFormValue = z.infer<typeof ambulanceLicenseTypeFormSchema>;
export type AmbulanceShiftPatternFormValue = z.infer<typeof ambulanceShiftPatternFormSchema>;
export type AmbulanceMaintenanceTypeFormValue = z.infer<typeof ambulanceMaintenanceTypeFormSchema>;
export type EmergencyArrivalModeFormValue = z.infer<typeof emergencyArrivalModeFormSchema>;
export type EmergencyCodeTypeFormValue = z.infer<typeof emergencyCodeTypeFormSchema>;
export type EmergencyCodeDeactivateOutcomeFormValue = z.infer<
  typeof emergencyCodeDeactivateOutcomeFormSchema
>;
export type EmergencyResuscitationLogTypeFormValue = z.infer<
  typeof emergencyResuscitationLogTypeFormSchema
>;
export type EmergencyMlcCaseTypeFormValue = z.infer<typeof emergencyMlcCaseTypeFormSchema>;
export type EmergencyMlcBroughtByFormValue = z.infer<typeof emergencyMlcBroughtByFormSchema>;
export type EmergencyMlcPoliceSentViaFormValue = z.infer<
  typeof emergencyMlcPoliceSentViaFormSchema
>;
export type EmergencyMlcStatusFormValue = z.infer<typeof emergencyMlcStatusFormSchema>;
export type EmergencyMassCasualtyTypeFormValue = z.infer<
  typeof emergencyMassCasualtyTypeFormSchema
>;
export type EmergencyMassCasualtyStatusFormValue = z.infer<
  typeof emergencyMassCasualtyStatusFormSchema
>;
export type OrderSetContextFormValue = z.infer<typeof orderSetContextFormSchema>;
export type OrderSetItemTypeFormValue = z.infer<typeof orderSetItemTypeFormSchema>;
export type SchedulingPriorityFormValue = z.infer<typeof schedulingPriorityFormSchema>;
export type SchedulingResourceTypeFormValue = z.infer<typeof schedulingResourceTypeFormSchema>;
export type OpdLabOrderPriorityFormValue = z.infer<typeof opdLabOrderPriorityFormSchema>;
export type OpdProcedureOrderPriorityFormValue = z.infer<
  typeof opdProcedureOrderPriorityFormSchema
>;
export type OpdReminderPriorityFormValue = z.infer<typeof opdReminderPriorityFormSchema>;
export type OpdReminderTypeFormValue = z.infer<typeof opdReminderTypeFormSchema>;
export type OpdProcedureConsentTypeFormValue = z.infer<typeof opdProcedureConsentTypeFormSchema>;
export type OpdCertificateTypeFormValue = z.infer<typeof opdCertificateTypeFormSchema>;
export type OpdRatingFormValue = z.infer<typeof opdRatingFormSchema>;
export type OtConsumableCategoryFormValue = z.infer<typeof otConsumableCategoryFormSchema>;
export type OtCasePriorityFormValue = z.infer<typeof otCasePriorityFormSchema>;
export type OtAsaClassificationFormValue = z.infer<typeof otAsaClassificationFormSchema>;
export type OtPreopClearanceStatusFormValue = z.infer<typeof otPreopClearanceStatusFormSchema>;
export type OtAnesthesiaTypeFormValue = z.infer<typeof otAnesthesiaTypeFormSchema>;
export type OtPostopRecoveryStatusFormValue = z.infer<typeof otPostopRecoveryStatusFormSchema>;
export type OtStatusReasonActionFormValue = z.infer<typeof otStatusReasonActionFormSchema>;
export type OpdVisitTypeFormValue = z.infer<typeof opdVisitTypeFormSchema>;
export type DamaRecordTypeFormValue = z.infer<typeof damaRecordTypeFormSchema>;
export type ChronicProgramTypeFormValue = z.infer<typeof chronicProgramTypeFormSchema>;
export type DepartmentTypeFormValue = z.infer<typeof departmentTypeFormSchema>;
export type FacilityTypeFormValue = z.infer<typeof facilityTypeFormSchema>;
export type LocationLevelFormValue = z.infer<typeof locationLevelFormSchema>;
export type ServiceTypeFormValue = z.infer<typeof serviceTypeFormSchema>;
export type TaxApplicabilityFormValue = z.infer<typeof taxApplicabilityFormSchema>;
export type InsuranceProviderTypeFormValue = z.infer<typeof insuranceProviderTypeFormSchema>;
export type PrintTemplateTypeFormValue = z.infer<typeof printTemplateTypeFormSchema>;
export type PrintTemplateLogoPositionFormValue = z.infer<
  typeof printTemplateLogoPositionFormSchema
>;
export type UrReviewTypeFormValue = z.infer<typeof urReviewTypeFormSchema>;
export type UrPatientStatusFormValue = z.infer<typeof urPatientStatusFormSchema>;
export type UrCommunicationTypeFormValue = z.infer<typeof urCommunicationTypeFormSchema>;
export type TransportModeFormValue = z.infer<typeof transportModeFormSchema>;
export type TransportPriorityFormValue = z.infer<typeof transportPriorityFormSchema>;
export type CourtSummonsStatusFormValue = z.infer<typeof courtSummonsStatusFormSchema>;
export type BiowasteCategoryFormValue = z.infer<typeof biowasteCategoryFormSchema>;
export type VendorPaymentTermsFormValue = z.infer<typeof vendorPaymentTermsFormSchema>;
export type StoreLocationTypeFormValue = z.infer<typeof storeLocationTypeFormSchema>;
export type SupplierPaymentMethodFormValue = z.infer<typeof supplierPaymentMethodFormSchema>;
export type OrderBasketDrugFrequencyFormValue = z.infer<typeof orderBasketDrugFrequencyFormSchema>;
export type OrderBasketDrugRouteFormValue = z.infer<typeof orderBasketDrugRouteFormSchema>;
export type OrderBasketLabPriorityFormValue = z.infer<typeof orderBasketLabPriorityFormSchema>;
export type OrderBasketRadiologyPriorityFormValue = z.infer<
  typeof orderBasketRadiologyPriorityFormSchema
>;
export type PharmacyStockTransactionTypeFormValue = z.infer<
  typeof pharmacyStockTransactionTypeFormSchema
>;
export type PharmacyNdpsActionFormValue = z.infer<typeof pharmacyNdpsActionFormSchema>;

export type MiniRegisterPatientFormInput = z.infer<typeof miniRegisterPatientFormSchema>;
export type PatientAllergyTypeFormValue = z.infer<typeof patientAllergyTypeFormSchema>;
export type PatientAllergySeverityFormValue = z.infer<typeof patientAllergySeverityFormSchema>;
export type PatientFamilyRelationshipFormValue = z.infer<
  typeof patientFamilyRelationshipFormSchema
>;
export type PatientDocumentTypeFormValue = z.infer<typeof patientDocumentTypeFormSchema>;
export type PatientDetailAllergyFormInput = z.infer<typeof patientDetailAllergyFormSchema>;
export type PatientDetailFamilyLinkFormInput = z.infer<typeof patientDetailFamilyLinkFormSchema>;
export type PatientDetailDocumentFormInput = z.infer<typeof patientDetailDocumentFormSchema>;
export type PatientMergeFormInput = z.infer<typeof patientMergeFormSchema>;
export type PatientRegistrationFormInput = z.infer<typeof patientRegistrationFormSchema>;
export type PatientRegistrationInitialValues = Partial<
  Omit<PatientRegistrationFormInput, "date_of_birth">
> & {
  date_of_birth?: string | Date | null;
  is_dob_estimated?: boolean;
};
export type MiniAddDrugFormInput = z.infer<typeof miniAddDrugFormSchema>;
export type PharmacyCatalogFormInput = z.infer<typeof pharmacyCatalogFormSchema>;
export type MiniAddLabTestFormInput = z.infer<typeof miniAddLabTestFormSchema>;
export type OrderBasketDrugFormInput = z.infer<typeof orderBasketDrugFormSchema>;
export type OrderBasketLabFormInput = z.infer<typeof orderBasketLabFormSchema>;
export type OrderBasketRadiologyFormInput = z.infer<typeof orderBasketRadiologyFormSchema>;
export type PharmacyStockTransactionFormInput = z.infer<typeof pharmacyStockTransactionFormSchema>;
export type PharmacyNdpsEntryFormInput = z.infer<typeof pharmacyNdpsEntryFormSchema>;
export type PharmacyReturnRequestFormInput = z.infer<typeof pharmacyReturnRequestFormSchema>;
export type PharmacyOrderFormInput = z.infer<typeof pharmacyOrderFormSchema>;
export type PharmacyOrderItemFormInput = z.infer<typeof pharmacyOrderItemFormSchema>;
export type PharmacyPosPaymentModeFormValue = z.infer<typeof pharmacyPosPaymentModeFormSchema>;
export type PharmacyPosSaleFormInput = z.infer<typeof pharmacyPosSaleFormSchema>;
export type PharmacyPosReturnFormInput = z.infer<typeof pharmacyPosReturnFormSchema>;
export type PharmacyCashDrawerOpenFormInput = z.infer<typeof pharmacyCashDrawerOpenFormSchema>;
export type PharmacyCashDrawerCloseFormInput = z.infer<typeof pharmacyCashDrawerCloseFormSchema>;
export type PharmacyRxReviewFormInput = z.infer<typeof pharmacyRxReviewFormSchema>;
export type PharmacyRxReviewItemFormInput = z.infer<typeof pharmacyRxReviewItemFormSchema>;
export type MiniAddVendorFormInput = z.infer<typeof miniAddVendorFormSchema>;
export type SubscribePackageFormInput = z.infer<typeof subscribePackageFormSchema>;
export type PaymentFormInput = z.infer<typeof paymentFormSchema>;
export type BillingInvoiceItemFormInput = z.infer<typeof billingInvoiceItemFormSchema>;
export type BillingPaymentFormInput = z.infer<typeof billingPaymentFormSchema>;
export type BillingCreateInvoiceFormInput = z.infer<typeof billingCreateInvoiceFormSchema>;
export type BillingDiscountFormInput = z.infer<typeof billingDiscountFormSchema>;
export type BillingErFastInvoiceFormInput = z.infer<typeof billingErFastInvoiceFormSchema>;
export type BillingChargeMasterFormInput = z.infer<typeof billingChargeMasterFormSchema>;
export type BillingRefundFormInput = z.infer<typeof billingRefundFormSchema>;
export type BillingReceiptReprintFormInput = z.infer<typeof billingReceiptReprintFormSchema>;
export type BillingCreditNoteFormInput = z.infer<typeof billingCreditNoteFormSchema>;
export type BillingCreditNoteApplyFormInput = z.infer<typeof billingCreditNoteApplyFormSchema>;
export type BillingWriteOffFormInput = z.infer<typeof billingWriteOffFormSchema>;
export type BillingPackageFormInput = z.infer<typeof billingPackageFormSchema>;
export type BillingPackageItemFormInput = z.infer<typeof billingPackageItemFormSchema>;
export type BillingRatePlanFormInput = z.infer<typeof billingRatePlanFormSchema>;
export type BillingRatePlanItemFormInput = z.infer<typeof billingRatePlanItemFormSchema>;
export type BillingAdvanceFormInput = z.infer<typeof billingAdvanceFormSchema>;
export type BillingAdvanceAdjustmentFormInput = z.infer<typeof billingAdvanceAdjustmentFormSchema>;
export type BillingAdvanceRefundFormInput = z.infer<typeof billingAdvanceRefundFormSchema>;
export type BillingCorporateFormInput = z.infer<typeof billingCorporateFormSchema>;
export type BillingCorporateUpdateFormInput = z.infer<typeof billingCorporateUpdateFormSchema>;
export type BillingCorporateEnrollmentFormInput = z.infer<
  typeof billingCorporateEnrollmentFormSchema
>;
export type BillingDayCloseFormInput = z.infer<typeof billingDayCloseFormSchema>;
export type BillingInsuranceClaimFormInput = z.infer<typeof billingInsuranceClaimFormSchema>;
export type BillingTpaRateCardFormInput = z.infer<typeof billingTpaRateCardFormSchema>;
export type BillingConcessionFormInput = z.infer<typeof billingConcessionFormSchema>;
export type BillingCreditPatientFormInput = z.infer<typeof billingCreditPatientFormSchema>;
export type BillingTdsFormInput = z.infer<typeof billingTdsFormSchema>;
export type BillingGstrFormInput = z.infer<typeof billingGstrFormSchema>;
export type BillingErpExportFormInput = z.infer<typeof billingErpExportFormSchema>;
export type BillingJournalLineFormInput = z.infer<typeof billingJournalLineFormSchema>;
export type BillingJournalEntryFormInput = z.infer<typeof billingJournalEntryFormSchema>;
export type IpdAdmissionFormInput = z.infer<typeof ipdAdmissionFormSchema>;
export type IpdAdmissionReprintFormInput = z.infer<typeof ipdAdmissionReprintFormSchema>;
export type IpdTariffConfigFormInput = z.infer<typeof ipdTariffConfigFormSchema>;
export type IpdWristbandReprintFormInput = z.infer<typeof ipdWristbandReprintFormSchema>;
export type IpdTransferFormInput = z.infer<typeof ipdTransferFormSchema>;
export type OpdCertificateVoidFormInput = z.infer<typeof opdCertificateVoidFormSchema>;
export type OpdCertificateReprintFormInput = z.infer<typeof opdCertificateReprintFormSchema>;
export type OpdConsentRevokeFormInput = z.infer<typeof opdConsentRevokeFormSchema>;
export type OpdConsentReprintFormInput = z.infer<typeof opdConsentReprintFormSchema>;
export type IpdNursingTaskFormInput = z.infer<typeof ipdNursingTaskFormSchema>;
export type IpdProgressNoteFormInput = z.infer<typeof ipdProgressNoteFormSchema>;
export type IpdClinicalAssessmentFormInput = z.infer<typeof ipdClinicalAssessmentFormSchema>;
export type IpdAttenderFormInput = z.infer<typeof ipdAttenderFormSchema>;
export type IcuFlowsheetFormInput = z.infer<typeof icuFlowsheetFormSchema>;
export type IcuVentilatorModeFormValue = z.infer<typeof icuVentilatorModeFormSchema>;
export type IcuVentilatorFormInput = z.infer<typeof icuVentilatorFormSchema>;
export type IcuScoreTypeFormValue = z.infer<typeof icuScoreTypeFormSchema>;
export type IcuScoreFormInput = z.infer<typeof icuScoreFormSchema>;
export type IcuDeviceTypeFormValue = z.infer<typeof icuDeviceTypeFormSchema>;
export type IcuDeviceFormInput = z.infer<typeof icuDeviceFormSchema>;
export type IcuBundleCheckFormInput = z.infer<typeof icuBundleCheckFormSchema>;
export type IcuNutritionRouteFormValue = z.infer<typeof icuNutritionRouteFormSchema>;
export type IcuNutritionFormInput = z.infer<typeof icuNutritionFormSchema>;
export type IcuNeonatalFormInput = z.infer<typeof icuNeonatalFormSchema>;
export type LabCatalogFormInput = z.infer<typeof labCatalogFormSchema>;
export type LabPanelFormInput = z.infer<typeof labPanelFormSchema>;
export type LabReagentLotFormInput = z.infer<typeof labReagentLotFormSchema>;
export type LabQcResultFormInput = z.infer<typeof labQcResultFormSchema>;
export type LabCalibrationFormInput = z.infer<typeof labCalibrationFormSchema>;
export type LabOutsourcedOrderFormInput = z.infer<typeof labOutsourcedOrderFormSchema>;
export type LabHomeCollectionFormInput = z.infer<typeof labHomeCollectionFormSchema>;
export type LabCollectionCenterFormInput = z.infer<typeof labCollectionCenterFormSchema>;
export type LabSampleArchiveFormInput = z.infer<typeof labSampleArchiveFormSchema>;
export type LabEqasResultFormInput = z.infer<typeof labEqasResultFormSchema>;
export type LabProficiencyTestFormInput = z.infer<typeof labProficiencyTestFormSchema>;
export type LabNablDocumentFormInput = z.infer<typeof labNablDocumentFormSchema>;
export type LabHistopathReportFormInput = z.infer<typeof labHistopathReportFormSchema>;
export type LabCytologyReportFormInput = z.infer<typeof labCytologyReportFormSchema>;
export type LabMolecularReportFormInput = z.infer<typeof labMolecularReportFormSchema>;
export type LabB2bClientFormInput = z.infer<typeof labB2bClientFormSchema>;
export type LabB2bRateFormInput = z.infer<typeof labB2bRateFormSchema>;
export type CampCreateFormInput = z.infer<typeof campCreateFormSchema>;
export type CampServicePlanFormInput = z.infer<typeof campServicePlanFormSchema>;
export type CampServicePlanEditorInput = z.infer<typeof campServicePlanEditorSchema>;
export type CampSupplyItemFormInput = z.infer<typeof campSupplyItemFormSchema>;
export type AssetCategoryFormInput = z.infer<typeof assetCategoryFormSchema>;
export type StoreCategoryFormInput = z.infer<typeof storeCategoryFormSchema>;
export type AssetClassificationFormInput = z.infer<typeof assetClassificationFormSchema>;
export type CampAssetReservationFormInput = z.infer<typeof campAssetReservationFormSchema>;
export type CampAssetIssueFormInput = z.infer<typeof campAssetIssueFormSchema>;
export type CampAssetReturnFormInput = z.infer<typeof campAssetReturnFormSchema>;
export type CampRegistrationFormInput = z.infer<typeof campRegistrationFormSchema>;
export type CampClinicalVisitFormInput = z.infer<typeof campClinicalVisitFormSchema>;
export type CampBillingFormInput = z.infer<typeof campBillingFormSchema>;
export type CampScreeningFormInput = z.infer<typeof campScreeningFormSchema>;
export type CampLabSampleFormInput = z.infer<typeof campLabSampleFormSchema>;
export type CampFollowupFormInput = z.infer<typeof campFollowupFormSchema>;
export type DietOrderFormInput = z.infer<typeof dietOrderFormSchema>;
export type DietTemplateFormInput = z.infer<typeof dietTemplateFormSchema>;
export type KitchenMenuFormInput = z.infer<typeof kitchenMenuFormSchema>;
export type MealPrepFormInput = z.infer<typeof mealPrepFormSchema>;
export type KitchenInventoryFormInput = z.infer<typeof kitchenInventoryFormSchema>;
export type KitchenAuditFormInput = z.infer<typeof kitchenAuditFormSchema>;
export type CaseAssignmentFormInput = z.infer<typeof caseAssignmentFormSchema>;
export type CaseAutoAssignFormInput = z.infer<typeof caseAutoAssignFormSchema>;
export type CaseAssignmentUpdateFormInput = z.infer<typeof caseAssignmentUpdateFormSchema>;
export type DischargeBarrierFormInput = z.infer<typeof dischargeBarrierFormSchema>;
export type CaseReferralFormInput = z.infer<typeof caseReferralFormSchema>;
export type CaseReferralUpdateFormInput = z.infer<typeof caseReferralUpdateFormSchema>;
export type CssdInstrumentFormInput = z.infer<typeof cssdInstrumentFormSchema>;
export type CssdSetFormInput = z.infer<typeof cssdSetFormSchema>;
export type CssdLoadFormInput = z.infer<typeof cssdLoadFormSchema>;
export type CssdIndicatorFormInput = z.infer<typeof cssdIndicatorFormSchema>;
export type CssdIssuanceFormInput = z.infer<typeof cssdIssuanceFormSchema>;
export type CssdSterilizerFormInput = z.infer<typeof cssdSterilizerFormSchema>;
export type CssdMaintenanceFormInput = z.infer<typeof cssdMaintenanceFormSchema>;
export type AmbulanceFleetFormInput = z.infer<typeof ambulanceFleetFormSchema>;
export type AmbulanceTripFormInput = z.infer<typeof ambulanceTripFormSchema>;
export type AmbulanceDriverFormInput = z.infer<typeof ambulanceDriverFormSchema>;
export type AmbulanceMaintenanceFormInput = z.infer<typeof ambulanceMaintenanceFormSchema>;
export type ErVisitFormInput = z.infer<typeof erVisitFormSchema>;
export type ErAdmitFormInput = z.infer<typeof erAdmitFormSchema>;
export type EmergencyCodeActivationFormInput = z.infer<typeof emergencyCodeActivationFormSchema>;
export type EmergencyCodeDeactivateFormInput = z.infer<typeof emergencyCodeDeactivateFormSchema>;
export type EmergencyResuscitationLogFormInput = z.infer<
  typeof emergencyResuscitationLogFormSchema
>;
export type MlcCaseFormInput = z.infer<typeof mlcCaseFormSchema>;
export type MlcCaseUpdateFormInput = z.infer<typeof mlcCaseUpdateFormSchema>;
export type MassCasualtyEventFormInput = z.infer<typeof massCasualtyEventFormSchema>;
export type MassCasualtyEventUpdateFormInput = z.infer<typeof massCasualtyEventUpdateFormSchema>;
export type OrderSetTemplateFormInput = z.infer<typeof orderSetTemplateFormSchema>;
export type OrderSetItemFormInput = z.infer<typeof orderSetItemFormSchema>;
export type SchedulingWaitlistFormInput = z.infer<typeof schedulingWaitlistFormSchema>;
export type SchedulingOverbookingRuleFormInput = z.infer<
  typeof schedulingOverbookingRuleFormSchema
>;
export type SchedulingRecurringFormInput = z.infer<typeof schedulingRecurringFormSchema>;
export type SchedulingBlockFormInput = z.infer<typeof schedulingBlockFormSchema>;
export type RadiologyOrderFormInput = z.infer<typeof radiologyOrderFormSchema>;
export type RadiologyAppointmentFormInput = z.infer<typeof radiologyAppointmentFormSchema>;
export type ShareGrantFormInput = z.infer<typeof shareGrantFormSchema>;
export type SignatureCaptureFormInput = z.infer<typeof signatureCaptureFormSchema>;
export type OpdLabOrderFormInput = z.infer<typeof opdLabOrderFormSchema>;
export type OpdProcedureOrderFormInput = z.infer<typeof opdProcedureOrderFormSchema>;
export type OpdReferralFormInput = z.infer<typeof opdReferralFormSchema>;
export type OpdReferralUrgencyFormValue = z.infer<typeof opdReferralUrgencyFormSchema>;
export type OpdPreAuthFormInput = z.infer<typeof opdPreAuthFormSchema>;
export type OpdReminderFormInput = z.infer<typeof opdReminderFormSchema>;
export type OpdFeedbackFormInput = z.infer<typeof opdFeedbackFormSchema>;
export type OpdProcedureConsentFormInput = z.infer<typeof opdProcedureConsentFormSchema>;
export type OpdMedicalCertificateFormInput = z.infer<typeof opdMedicalCertificateFormSchema>;
export type OtConsumableFormInput = z.infer<typeof otConsumableFormSchema>;
export type OtBookingFormInput = z.infer<typeof otBookingFormSchema>;
export type OtPreopAssessmentFormInput = z.infer<typeof otPreopAssessmentFormSchema>;
export type OtPreopAssessmentUpdateFormInput = z.infer<typeof otPreopAssessmentUpdateFormSchema>;
export type OtSurgeonPreferenceFormInput = z.infer<typeof otSurgeonPreferenceFormSchema>;
export type OtCaseRecordFormInput = z.infer<typeof otCaseRecordFormSchema>;
export type OtAnesthesiaRecordFormInput = z.infer<typeof otAnesthesiaRecordFormSchema>;
export type OtPostopRecordFormInput = z.infer<typeof otPostopRecordFormSchema>;
export type OtPostopRecordUpdateFormInput = z.infer<typeof otPostopRecordUpdateFormSchema>;
export type OtStatusReasonFormInput = z.infer<typeof otStatusReasonFormSchema>;
export type OtRoomFormInput = z.infer<typeof otRoomFormSchema>;
export type OtUtilizationFilterFormInput = z.infer<typeof otUtilizationFilterFormSchema>;
export type OpdQueueVisitFormInput = z.infer<typeof opdQueueVisitFormSchema>;
export type OpdFollowUpAppointmentFormInput = z.infer<typeof opdFollowUpAppointmentFormSchema>;
export type IpdDamaFormInput = z.infer<typeof ipdDamaFormSchema>;
export type IpdTransferOutFormInput = z.infer<typeof ipdTransferOutFormSchema>;
export type IpdMarkDeathFormInput = z.infer<typeof ipdMarkDeathFormSchema>;
export type MiniDepartmentFormInput = z.infer<typeof miniDepartmentFormSchema>;
export type CreateDepartmentFormInput = z.infer<typeof createDepartmentFormSchema>;
export type CreateFacilityFormInput = z.infer<typeof createFacilityFormSchema>;
export type FacilitySettingsFormInput = z.infer<typeof facilitySettingsFormSchema>;
export type SequenceSettingsFormInput = z.infer<typeof sequenceSettingsFormSchema>;
export type GeneralSettingsFormInput = z.infer<typeof generalSettingsFormSchema>;
export type BrandingSettingsFormInput = z.infer<typeof brandingSettingsFormSchema>;
export type OfflineModeSettingsFormInput = z.infer<typeof offlineModeSettingsFormSchema>;
export type PrintTemplateSettingsFormInput = z.infer<typeof printTemplateSettingsFormSchema>;
export type ConsultationTemplateSettingsFormInput = z.infer<
  typeof consultationTemplateSettingsFormSchema
>;
export type UtilizationReviewFormInput = z.infer<typeof utilizationReviewFormSchema>;
export type UrCommunicationFormInput = z.infer<typeof urCommunicationFormSchema>;
export type UrStatusConversionFormInput = z.infer<typeof urStatusConversionFormSchema>;
export type CommandCenterTransportFormInput = z.infer<typeof commandCenterTransportFormSchema>;
export type CommandCenterAssignTransportFormInput = z.infer<
  typeof commandCenterAssignTransportFormSchema
>;
export type CommandCenterAlertThresholdFormInput = z.infer<
  typeof commandCenterAlertThresholdFormSchema
>;
export type MlcSbarFormInput = z.infer<typeof mlcSbarFormSchema>;
export type MlcAgeEstimationFormInput = z.infer<typeof mlcAgeEstimationFormSchema>;
export type MlcPocsoReportFormInput = z.infer<typeof mlcPocsoReportFormSchema>;
export type MlcCourtSummonsFormInput = z.infer<typeof mlcCourtSummonsFormSchema>;
export type MlcPoliceIntimationFormInput = z.infer<typeof mlcPoliceIntimationFormSchema>;
export type MlcPoliceReceiptConfirmationFormInput = z.infer<
  typeof mlcPoliceReceiptConfirmationFormSchema
>;
export type MlcPrintPacketTypeFormValue = z.infer<typeof mlcPrintPacketTypeFormSchema>;
export type MlcPrintReprintFormInput = z.infer<typeof mlcPrintReprintFormSchema>;
export type CreatePrinterFormInput = z.infer<typeof createPrinterFormSchema>;
export type BmwTransportManifestFormInput = z.infer<typeof bmwTransportManifestFormSchema>;
export type ProcurementVendorFormInput = z.infer<typeof procurementVendorFormSchema>;
export type ProcurementPurchaseOrderFormInput = z.infer<typeof procurementPurchaseOrderFormSchema>;
export type ProcurementGrnFormInput = z.infer<typeof procurementGrnFormSchema>;
export type ProcurementRateContractFormInput = z.infer<typeof procurementRateContractFormSchema>;
export type ProcurementStoreLocationFormInput = z.infer<typeof procurementStoreLocationFormSchema>;
export type ProcurementSupplierPaymentFormInput = z.infer<
  typeof procurementSupplierPaymentFormSchema
>;
export type CreateLocationFormInput = z.infer<typeof createLocationFormSchema>;
export type InlineCreateRoleFormInput = z.infer<typeof inlineCreateRoleFormSchema>;
export type MiniDoctorFormInput = z.infer<typeof miniDoctorFormSchema>;
export type UserCreateDrawerFormInput = z.infer<typeof userCreateDrawerFormSchema>;
export type AdminUserFormInput = z.infer<typeof adminUserFormBaseSchema>;
export type BulkImportUsersFormInput = z.infer<typeof bulkImportUsersFormSchema>;
export type EditRoleFormInput = z.infer<typeof editRoleFormSchema>;
export type AdminCreateRoleFormInput = z.infer<typeof adminCreateRoleFormSchema>;
export type DoctorProfileFormInput = z.infer<typeof doctorProfileFormSchema>;
export type LinkedDoctorUserFormInput = z.infer<typeof linkedDoctorUserFormSchema>;
export type SignatureCredentialIssueFormInput = z.infer<typeof signatureCredentialIssueFormSchema>;
export type BookAppointmentFormInput = z.infer<typeof bookAppointmentFormSchema>;
export type CancelAppointmentFormInput = z.infer<typeof cancelAppointmentFormSchema>;
export type RescheduleAppointmentFormInput = z.infer<typeof rescheduleAppointmentFormSchema>;
export type ChronicProgramFormInput = z.infer<typeof chronicProgramFormSchema>;
export type ChronicEnrollmentFormInput = z.infer<typeof chronicEnrollmentFormSchema>;
export type MobileShellLoginFormInput = z.infer<typeof mobileShellLoginFormSchema>;
export type MobileLoginFormInput = z.infer<typeof mobileLoginFormSchema>;
export type MobileVitalsEntryFormInput = z.infer<typeof mobileVitalsEntryFormSchema>;
export type MobileStaffPatientRegistrationFormInput = z.infer<
  typeof mobileStaffPatientRegistrationFormSchema
>;
export type MobileConsultationNotesFormInput = z.infer<typeof mobileConsultationNotesFormSchema>;
export type MobilePrescriptionItemFormInput = z.infer<typeof mobilePrescriptionItemFormSchema>;
export type MobilePatientProfileContactFormInput = z.infer<
  typeof mobilePatientProfileContactFormSchema
>;
export type BedTypeSettingsFormInput = z.infer<typeof bedTypeSettingsFormSchema>;
export type ServiceSettingsFormInput = z.infer<typeof serviceSettingsFormSchema>;
export type TaxCategorySettingsFormInput = z.infer<typeof taxCategorySettingsFormSchema>;
export type PaymentMethodSettingsFormInput = z.infer<typeof paymentMethodSettingsFormSchema>;
export type ClinicalMasterSettingsFormInput = z.infer<typeof clinicalMasterSettingsFormSchema>;
export type InsuranceProviderSettingsFormInput = z.infer<
  typeof insuranceProviderSettingsFormSchema
>;

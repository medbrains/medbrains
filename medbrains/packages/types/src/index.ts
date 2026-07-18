// Permissions

export * from "./admin-forms";
export * from "./ambulance-fleet";
export * from "./analytics-dashboards";
export * from "./billing-print-phase2";
export * from "./blood-bank-phase2";
export * from "./bme-engineering";
export * from "./care-view";
export * from "./cath-lab";
export * from "./chronic-care";
export * from "./clinical-identity-forms";
export * from "./clinical-knowledge-base";
export * from "./command-center";
export * from "./common";
export * from "./communication-hub";
export * from "./dashboard-widget-builder";
export * from "./device-integration";
export * from "./documents-module";
export * from "./emergency";
export * from "./emergency-drug-kits";
export * from "./emergency-request";
export * from "./field-mapping";
export * from "./form-builder";
export * from "./form-master";
export * from "./form-versioning";
export * from "./housekeeping";
export * from "./infection-control";
export * from "./insurance-tpa";
export * from "./ipd-clinical-expansion";
export * from "./ipd-phase2";
export * from "./ipd-post-discharge";
export * from "./lab-bloodbank-print-phase2";
export * from "./maternity-obgyn";
export * from "./medication-timing";
export * from "./mrd";
export * from "./mrd-form-print";
export * from "./order-sets";
export * from "./org-structure";
export * from "./other-specialties";
export * from "./palliative-mortuary-nuclear";
export * from "./patient-registration";
export * from "./pharmacy-phase2";
export * from "./pharmacy-phase3";
export * from "./phase3-clinical-charts-print";
export * from "./phase3-medicolegal-print";
export * from "./phase3-surgical-ot-print";
export * from "./print-data";
export * from "./procurement-request";
export * from "./psychiatry";
export * from "./regulatory-compliance";
export * from "./schema-registry";
export * from "./screen-layout-zone";
export * from "./screen-system";

import type { WorkingHours } from "./org-structure";

export * from "./abdm-integration";

export * from "./form-runtime";
export * from "./setup-config";
export * from "./tenant-facility";

import type { FacilityType } from "./tenant-facility";

export * from "./locale-units";
export * from "./onboarding-masters";

import type { ServiceType, TaxApplicability } from "./onboarding-masters";

export type {
  AccessMatrixMaskingBehavior,
  AccessMatrixPlatform,
  AccessMatrixPrintCopy,
  AccessMatrixSurface,
  AccessMatrixSurfaceKind,
  AccessMatrixWorkflowExpectation,
} from "./access-matrix.js";
export {
  ACCESS_MATRIX_SURFACES,
  ACCESS_MATRIX_WORKFLOW_EXPECTATIONS,
  accessMatrixModules,
  accessMatrixSurfaceKinds,
  CAMP_REGISTRATION_FIELD_ACCESS_KEYS,
  CAMP_REGISTRATION_ID_PROOF_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_NAME_FIELD_ACCESS_KEY,
  CAMP_REGISTRATION_PHONE_FIELD_ACCESS_KEY,
  PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
  PATIENT_NAME_FIELD_ACCESS_KEYS,
  PATIENT_UHID_FIELD_ACCESS_KEY,
} from "./access-matrix.js";
export type {
  BedBoardSignalPhase,
  BedBoardSignalShape,
  BedBoardSignalStatus,
  BedBoardSignalTone,
  BedBoardStatus,
  BedBoardStatusSignal,
} from "./bed-board-surfaces.js";
export {
  BED_BOARD_MUTABLE_STATUS_VALUES,
  BED_BOARD_SIGNAL_STATUS_VALUES,
  BED_BOARD_STATUS_VALUES,
  bedBoardSignalLabel,
  bedBoardSignalLabelKey,
  bedBoardStatusIsAssignable,
  bedBoardStatusLabel,
  bedBoardStatusLabelKey,
  bedBoardStatusSignal,
  isBedBoardSignalStatus,
} from "./bed-board-surfaces.js";
export type {
  BillingInvoiceSignal,
  BillingInvoiceSignalPhase,
  BillingInvoiceSignalShape,
  BillingInvoiceSignalTone,
  BillingInvoiceStatus,
} from "./billing-invoice-signals.js";
export {
  activeBillingInvoiceIdForJourney,
  BILLING_INVOICE_STATUS_VALUES,
  billingInvoiceBalance,
  billingInvoiceBalanceSignal,
  billingInvoiceBalanceSignalLabel,
  billingInvoiceBalanceSignalLabelKey,
  billingInvoiceDisplayStatus,
  billingInvoiceHasReceivedPayment,
  billingInvoiceIsFinalized,
  billingInvoiceIsPayable,
  billingInvoiceRequiresFollowUp,
  billingInvoiceStatusLabel,
  billingInvoiceStatusLabelKey,
  billingInvoiceStatusSignal,
} from "./billing-invoice-signals.js";
export type {
  DashboardMobileIntent,
  DashboardMobileRoute,
  DashboardReportFamily,
  DashboardReportIntent,
  DashboardReportPriority,
  DashboardStatIntent,
  DashboardStatIntentId,
} from "./dashboard-intents.js";
export { buildDashboardReportPath, DASHBOARD_STAT_INTENTS } from "./dashboard-intents.js";
export type {
  ClinicalJourneyActionBlocker,
  ClinicalJourneyActionDefinition,
  ClinicalJourneyActionDisabledReason,
  ClinicalJourneyActionId,
  ClinicalJourneyActionIntent,
  ClinicalJourneyActionMessage,
  ClinicalJourneyActionReadinessSummary,
  ClinicalJourneyActionSignal,
  ClinicalJourneyActionSignalPhase,
  ClinicalJourneyActionSignalShape,
  ClinicalJourneyActionSignalTone,
  ClinicalJourneyBlockedReason,
  ClinicalJourneyBlockingControl,
  ClinicalJourneyContext,
  ClinicalJourneyMessageValues,
  ClinicalJourneySurface,
  ClinicalOrderContext,
  ResolveClinicalJourneyActionsOptions,
  ResolvedClinicalJourneyAction,
} from "./event-actions.js";
export {
  activeCampRegistrationIdForJourney,
  CORE_PATIENT_JOURNEY_ACTIONS,
  clinicalJourneyActionSignal,
  clinicalJourneyActionSignalLabel,
  clinicalJourneyActionSignalLabelKey,
  deriveCampJourneyCompletedEvents,
  inferClinicalJourneyEventNames,
  resolveClinicalJourneyActions,
  summarizeClinicalJourneyActions,
} from "./event-actions.js";
export type {
  PatientContextSignal,
  PatientContextSignalKind,
  PatientContextSignalSeverity,
  PatientContextSignalShape,
  PatientContextSignalTone,
} from "./patient-context-signals.js";
export { patientContextSignal } from "./patient-context-signals.js";
export type {
  PatientFlowContextInput,
  PatientFlowModule,
  PatientFlowReadiness,
  PatientFlowReadinessItem,
  PatientFlowReadinessSummary,
} from "./patient-flow.js";
export {
  activePatientPharmacyOrderIdForJourney,
  activePatientPharmacyRxQueueIdForJourney,
  buildPatientFlowReadiness,
  hasReviewedPatientPharmacyPrescriptionForJourney,
  patientFlowJourneyContext,
  patientFlowReadinessSignal,
  patientPharmacyPrescriptionHasReviewedStatus,
} from "./patient-flow.js";
export type { PatientJourneyTranslator } from "./patient-journey-i18n.js";
export {
  CLINICAL_EVENT_I18N_KEYS,
  clinicalEventLabel,
  clinicalEventList,
  journeyActionAvailability,
  journeyActionDescription,
  journeyActionDisabledReason,
  journeyActionLabel,
  journeyActionShortLabel,
  journeyActionSignalLabel,
  journeyBlockedReasonLabel,
  journeyMessage,
  patientFlowItemDescription,
  patientFlowItemDisabledReason,
  patientFlowItemLabel,
} from "./patient-journey-i18n.js";
export type {
  PatientJourneyMobileBillingParams,
  PatientJourneyMobileCareContextModule,
  PatientJourneyMobileCareContextParams,
  PatientJourneyMobileOrderParams,
  PatientJourneyMobilePharmacyParams,
  PatientJourneyMobileTarget,
} from "./patient-journey-mobile-targets.js";
export {
  patientFlowMobileTarget,
  patientJourneyMobileActionTarget,
} from "./patient-journey-mobile-targets.js";
export { patientJourneyActionRoute } from "./patient-journey-routes.js";
export type { PermissionDef, PermissionGroup } from "./permissions.js";
export {
  buildPermissionTree,
  isValidPermissionCode,
  P,
  PERMISSIONS,
  ROLE_TEMPLATES,
} from "./permissions.js";
export type {
  PharmacyRxPriorityPhase,
  PharmacyRxSignal,
  PharmacyRxSignalShape,
  PharmacyRxSignalTone,
  PharmacyRxSourcePhase,
  PharmacyRxStatusPhase,
} from "./pharmacy-rx-signals.js";
export {
  PHARMACY_RX_STATUS_VALUES,
  pharmacyRxPriorityLabel,
  pharmacyRxPriorityLabelKey,
  pharmacyRxPrioritySignal,
  pharmacyRxSourceLabel,
  pharmacyRxSourceLabelKey,
  pharmacyRxSourceSignal,
  pharmacyRxStatusLabel,
  pharmacyRxStatusLabelKey,
  pharmacyRxStatusSignal,
} from "./pharmacy-rx-signals.js";
export type {
  BillingQueueLaneDefinition,
  BillingQueueLaneKey,
  TokenBoardDisplayMode,
  TokenBoardLaunchTargets,
  TokenBoardReadinessItem,
  TokenBoardReadinessTone,
  TokenBoardStatusPhase,
  TokenBoardStatusShape,
  TokenBoardStatusSignal,
  TokenBoardStatusTone,
  TokenBoardStatusValue,
  TokenBoardSurfaceDefinition,
  TokenBoardSurfaceFilter,
  TokenBoardSurfaceId,
  TokenBoardTvAppCode,
  TokenBoardTvDisplayType,
} from "./token-board-surfaces.js";
export {
  BILLING_QUEUE_LANES,
  getTokenBoardSurface,
  isTokenBoardStatusValue,
  isTokenBoardSurfaceId,
  TOKEN_BOARD_FAST_REFRESH_MS,
  TOKEN_BOARD_PUBLIC_PRIVACY_NOTICE,
  TOKEN_BOARD_STANDARD_REFRESH_MS,
  TOKEN_BOARD_STATUS_VALUES,
  TOKEN_BOARD_SURFACE_LIST,
  TOKEN_BOARD_SURFACES,
  tokenBoardFeedIsStale,
  tokenBoardFeedReadiness,
  tokenBoardMobileRouteParams,
  tokenBoardOperationalReadinessItems,
  tokenBoardReadinessLabel,
  tokenBoardReadinessLabelKey,
  tokenBoardReadinessValue,
  tokenBoardReadinessValueKey,
  tokenBoardRefreshLabel,
  tokenBoardRefreshValueKey,
  tokenBoardStatusLabel,
  tokenBoardStatusLabelKey,
  tokenBoardStatusSignal,
  tokenBoardSurfaceFilterFromParam,
  tokenBoardSurfaceFlowLabelKey,
} from "./token-board-surfaces.js";
export type {
  WorkflowSignalShape,
  WorkflowSignalShapeDefinition,
  WorkflowSignalShapeSemantic,
  WorkflowSignalTone,
} from "./workflow-signal-shapes.js";
export {
  WORKFLOW_SIGNAL_SHAPE_DEFINITIONS,
  WORKFLOW_SIGNAL_SHAPES,
  workflowSignalShapeDefinition,
} from "./workflow-signal-shapes.js";

// ── Onboarding Store Types ──────────────────────────────

export interface OnboardingFacility {
  local_id: string;
  code: string;
  name: string;
  facility_type: FacilityType;
  parent_local_id?: string;
  bed_count?: number;
  shared_billing: boolean;
  shared_pharmacy: boolean;
  shared_lab: boolean;
  shared_hr: boolean;
}

export interface OnboardingLocation {
  local_id: string;
  code: string;
  name: string;
  level: string;
  parent_local_id?: string;
}

export interface OnboardingDepartment {
  local_id: string;
  code: string;
  name: string;
  department_type: string;
  parent_local_id?: string;
  working_hours?: WorkingHours;
}

export interface OnboardingUser {
  local_id: string;
  full_name: string;
  username: string;
  email: string;
  password: string;
  role: string;
  specialization?: string;
  medical_registration_number?: string;
  qualification?: string;
  consultation_fee?: number;
  department_local_ids?: string[];
}

export interface OnboardingRole {
  local_id: string;
  code: string;
  name: string;
  description?: string;
}

export interface OnboardingService {
  local_id: string;
  code: string;
  name: string;
  service_type: ServiceType;
  description?: string;
}

export interface OnboardingBedType {
  local_id: string;
  code: string;
  name: string;
  daily_rate: number;
  description?: string;
}

export interface OnboardingTaxCategory {
  local_id: string;
  code: string;
  name: string;
  rate_percent: number;
  applicability: TaxApplicability;
  description?: string;
}

export interface OnboardingPaymentMethod {
  local_id: string;
  code: string;
  name: string;
  is_default: boolean;
}

export interface AdditionalSequence {
  seq_type: string;
  prefix: string;
  pad_width: number;
}

// ── Print Template Types ────────────────────────────────

/** Print template configuration for a form */
export interface PrintTemplateConfig {
  pageSize: "A4" | "A5" | "letter" | "prescription";
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };

  header: {
    template: string;
    height: number;
    showOnAllPages: boolean;
    showLogo: boolean;
    logoPosition: "left" | "center" | "right";
  };

  body: {
    mode: "form-fields" | "custom-template";
    template?: string;
    fieldLayout: "table" | "flow" | "grid";
    showLabels: boolean;
    showEmptyFields: boolean;
  };

  footer: {
    template: string;
    height: number;
    showOnAllPages: boolean;
    showPageNumbers: boolean;
    signatures: PrintSignatureSlot[];
  };
}

/** Signature slot in print footer */
export interface PrintSignatureSlot {
  label: string;
  position: "left" | "center" | "right";
  lineWidth: number;
}

// ── Onboarding Store Types ──────────────────────────────

export interface OnboardingSetupRequest {
  hospital_details?: {
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    pincode?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
    registration_no?: string | null;
    accreditation?: string | null;
    timezone: string;
    currency: string;
    fy_start_month: number;
  };
  geo?: {
    country_id?: string;
    state_id?: string;
    district_id?: string;
  };
  regulator_ids?: string[];
  facilities: OnboardingFacility[];
  locations: OnboardingLocation[];
  departments: OnboardingDepartment[];
  users: OnboardingUser[];
  roles: OnboardingRole[];
  module_statuses: Record<string, string>;
  sequences?: {
    uhid_prefix: string;
    uhid_pad_width: number;
    invoice_prefix: string;
    invoice_pad_width: number;
  };
  additional_sequences?: AdditionalSequence[];
  services?: OnboardingService[];
  bed_types?: OnboardingBedType[];
  tax_categories?: OnboardingTaxCategory[];
  payment_methods?: OnboardingPaymentMethod[];
  branding?: {
    primary_color: string;
    secondary_color: string;
    logo_url?: string;
  };
}

// ── Procurement Types ─────────────────────────────────────

export type PoStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "sent_to_vendor"
  | "partially_received"
  | "fully_received"
  | "closed"
  | "cancelled";
export type GrnStatus =
  | "draft"
  | "inspecting"
  | "accepted"
  | "partially_accepted"
  | "rejected"
  | "completed";
export type VendorStatus = "active" | "inactive" | "blacklisted" | "pending_approval";
export type RateContractStatus = "draft" | "active" | "expired" | "terminated";

export interface Vendor {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  display_name: string | null;
  vendor_type: string;
  status: VendorStatus;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  gst_number: string | null;
  pan_number: string | null;
  drug_license_number: string | null;
  fssai_license: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_ifsc: string | null;
  payment_terms: string | null;
  credit_limit: number;
  credit_days: number;
  rating: number;
  categories: unknown[];
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface StoreLocation {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  location_type: string;
  department_id: string | null;
  facility_id: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  po_number: string;
  vendor_id: string;
  store_location_id: string | null;
  status: PoStatus;
  indent_requisition_id: string | null;
  rate_contract_id: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  order_date: string;
  expected_delivery: string | null;
  payment_terms: string | null;
  delivery_terms: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  is_emergency: boolean;
  emergency_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  tenant_id: string;
  po_id: string;
  catalog_item_id: string | null;
  item_name: string;
  item_code: string | null;
  unit: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  tax_percent: number;
  tax_amount: number;
  discount_percent: number;
  discount_amount: number;
  total_amount: number;
  indent_item_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface GoodsReceiptNote {
  id: string;
  tenant_id: string;
  grn_number: string;
  po_id: string;
  vendor_id: string;
  store_location_id: string | null;
  status: GrnStatus;
  total_amount: number;
  receipt_date: string;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_amount: number | null;
  received_by: string;
  inspected_by: string | null;
  inspected_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrnItem {
  id: string;
  tenant_id: string;
  grn_id: string;
  po_item_id: string | null;
  catalog_item_id: string | null;
  item_name: string;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  batch_number: string | null;
  expiry_date: string | null;
  manufacture_date: string | null;
  unit_price: number;
  total_amount: number;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
}

export interface BatchStock {
  id: string;
  tenant_id: string;
  catalog_item_id: string;
  store_location_id: string | null;
  batch_number: string;
  expiry_date: string | null;
  manufacture_date: string | null;
  quantity: number;
  unit_cost: number;
  grn_id: string | null;
  vendor_id: string | null;
  is_consignment: boolean;
  serial_number: string | null;
  barcode: string | null;
  created_at: string;
  updated_at: string;
}

export interface RateContract {
  id: string;
  tenant_id: string;
  contract_number: string;
  vendor_id: string;
  status: RateContractStatus;
  start_date: string;
  end_date: string;
  payment_terms: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RateContractItem {
  id: string;
  tenant_id: string;
  contract_id: string;
  catalog_item_id: string;
  contracted_price: number;
  max_quantity: number | null;
  notes: string | null;
  created_at: string;
}

// ── Quality Management ──────────────────────────────────────

export type DocumentStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "released"
  | "revised"
  | "obsolete";
export type IncidentSeverityType = "near_miss" | "minor" | "moderate" | "major" | "sentinel";
export type IncidentStatusType =
  | "reported"
  | "acknowledged"
  | "investigating"
  | "rca_complete"
  | "capa_assigned"
  | "capa_in_progress"
  | "closed"
  | "reopened";
export type CapaStatusType = "open" | "in_progress" | "completed" | "verified" | "overdue";
export type IndicatorFrequencyType = "daily" | "weekly" | "monthly" | "quarterly" | "annually";
export type AccreditationBodyType = "nabh" | "nmc" | "nabl" | "jci" | "abdm" | "naac" | "other";
export type ComplianceStatusType =
  | "compliant"
  | "partially_compliant"
  | "non_compliant"
  | "not_applicable";
export type CommitteeFrequencyType =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "biannual"
  | "annual"
  | "as_needed";

export interface QualityIndicator {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  sub_category?: string;
  numerator_description?: string;
  denominator_description?: string;
  unit?: string;
  frequency: IndicatorFrequencyType;
  target_value?: number;
  threshold_warning?: number;
  threshold_critical?: number;
  benchmark_national?: number;
  benchmark_international?: number;
  auto_calculated: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QualityIndicatorValue {
  id: string;
  tenant_id: string;
  indicator_id: string;
  period_start: string;
  period_end: string;
  numerator_value?: number;
  denominator_value?: number;
  calculated_value?: number;
  department_id?: string;
  notes?: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface QualityDocument {
  id: string;
  tenant_id: string;
  document_number: string;
  title: string;
  category: string;
  department_id?: string;
  current_version: number;
  status: DocumentStatus;
  content?: string;
  summary?: string;
  author_id: string;
  reviewer_id?: string;
  approver_id?: string;
  released_at?: string;
  next_review_date?: string;
  review_cycle_months: number;
  is_training_required: boolean;
  attachments: unknown[];
  created_at: string;
  updated_at: string;
}

export interface QualityIncident {
  id: string;
  tenant_id: string;
  incident_number: string;
  title: string;
  description?: string;
  incident_type: string;
  severity: IncidentSeverityType;
  status: IncidentStatusType;
  department_id?: string;
  location?: string;
  incident_date: string;
  reported_by: string;
  is_anonymous: boolean;
  patient_id?: string;
  affected_persons: unknown[];
  immediate_action?: string;
  root_cause?: string;
  contributing_factors: unknown[];
  assigned_to?: string;
  closed_at?: string;
  is_reportable: boolean;
  regulatory_body?: string;
  attachments: unknown[];
  created_at: string;
  updated_at: string;
}

/** List row — omits description/immediate_action/root_cause + the JSONB fields
 * (affected_persons/contributing_factors/attachments); detail fetched by id. */
export interface QualityIncidentListItem {
  id: string;
  tenant_id: string;
  incident_number: string;
  title: string;
  incident_type: string;
  severity: IncidentSeverityType;
  status: IncidentStatusType;
  department_id?: string;
  location?: string;
  incident_date: string;
  reported_by: string;
  is_anonymous: boolean;
  patient_id?: string;
  assigned_to?: string;
  closed_at?: string;
  is_reportable: boolean;
  regulatory_body?: string;
  created_at: string;
  updated_at: string;
}

export interface QualityCapa {
  id: string;
  tenant_id: string;
  incident_id: string;
  capa_number: string;
  capa_type: string;
  description?: string;
  action_plan?: string;
  status: CapaStatusType;
  assigned_to: string;
  due_date: string;
  completed_at?: string;
  verified_by?: string;
  verified_at?: string;
  effectiveness_check?: string;
  created_at: string;
  updated_at: string;
}

export interface QualityCommittee {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  description?: string;
  committee_type: string;
  chairperson_id?: string;
  secretary_id?: string;
  members: unknown[];
  meeting_frequency: CommitteeFrequencyType;
  charter?: string;
  is_mandatory: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QualityCommitteeMeeting {
  id: string;
  tenant_id: string;
  committee_id: string;
  meeting_number?: string;
  scheduled_date: string;
  actual_date?: string;
  venue?: string;
  agenda: unknown[];
  minutes?: string;
  attendees: unknown[];
  absentees: unknown[];
  decisions: unknown[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface QualityActionItem {
  id: string;
  tenant_id: string;
  source_type: string;
  source_id: string;
  description?: string;
  assigned_to: string;
  due_date: string;
  status: string;
  completed_at?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface QualityAccreditationStandard {
  id: string;
  tenant_id: string;
  body: AccreditationBodyType;
  standard_code: string;
  standard_name: string;
  chapter?: string;
  description?: string;
  measurable_elements: unknown[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QualityAccreditationCompliance {
  id: string;
  tenant_id: string;
  standard_id: string;
  compliance: ComplianceStatusType;
  evidence_summary?: string;
  evidence_documents: unknown[];
  gap_description?: string;
  action_plan?: string;
  responsible_person_id?: string;
  target_date?: string;
  assessed_at?: string;
  assessed_by?: string;
  created_at: string;
  updated_at: string;
}

export interface QualityAudit {
  id: string;
  tenant_id: string;
  audit_number: string;
  audit_type: string;
  title: string;
  scope?: string;
  department_id?: string;
  auditor_id: string;
  audit_date: string;
  report_date?: string;
  findings: unknown[];
  non_conformities: number;
  observations: number;
  opportunities: number;
  overall_score?: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// Request types
export interface CreateQualityIndicatorRequest {
  code: string;
  name: string;
  description?: string;
  category: string;
  sub_category?: string;
  numerator_description?: string;
  denominator_description?: string;
  unit?: string;
  frequency: IndicatorFrequencyType;
  target_value?: number;
  threshold_warning?: number;
  threshold_critical?: number;
  auto_calculated?: boolean;
}

export interface RecordIndicatorValueRequest {
  indicator_id: string;
  period_start: string;
  period_end: string;
  numerator_value?: number;
  denominator_value?: number;
  calculated_value?: number;
  department_id?: string;
  notes?: string;
}

export interface CreateQualityDocumentRequest {
  document_number: string;
  title: string;
  category: string;
  department_id?: string;
  content?: string;
  summary?: string;
  reviewer_id?: string;
  is_training_required?: boolean;
}

export interface CreateQualityIncidentRequest {
  title: string;
  description?: string;
  incident_type: string;
  severity: IncidentSeverityType;
  department_id?: string;
  location?: string;
  incident_date: string;
  is_anonymous?: boolean;
  patient_id?: string;
  immediate_action?: string;
}

export interface UpdateQualityIncidentRequest {
  status?: IncidentStatusType;
  assigned_to?: string;
  root_cause?: string;
  contributing_factors?: unknown[];
  is_reportable?: boolean;
  regulatory_body?: string;
}

export interface CreateCapaRequest {
  incident_id: string;
  capa_type: string;
  description?: string;
  action_plan?: string;
  assigned_to: string;
  due_date: string;
}

export interface CreateQualityCommitteeRequest {
  name: string;
  code: string;
  description?: string;
  committee_type: string;
  chairperson_id?: string;
  secretary_id?: string;
  members?: unknown[];
  meeting_frequency: CommitteeFrequencyType;
  charter?: string;
  is_mandatory?: boolean;
}

export interface CreateMeetingRequest {
  committee_id: string;
  scheduled_date: string;
  venue?: string;
  agenda?: unknown[];
}

export interface CreateAccreditationStandardRequest {
  body: AccreditationBodyType;
  standard_code: string;
  standard_name: string;
  chapter?: string;
  description?: string;
  measurable_elements?: unknown[];
}

export interface UpdateComplianceRequest {
  standard_id: string;
  compliance: ComplianceStatusType;
  evidence_summary?: string;
  evidence_documents?: unknown[];
  gap_description?: string;
  action_plan?: string;
  responsible_person_id?: string;
  target_date?: string;
}

export interface CreateQualityAuditRequest {
  audit_type: string;
  title: string;
  scope?: string;
  department_id?: string;
  audit_date: string;
}

// ── HR & Staff Management ─────────────────────────────────

// Enum types
export type EmploymentType =
  | "permanent"
  | "contract"
  | "visiting"
  | "intern"
  | "resident"
  | "fellow"
  | "volunteer"
  | "outsourced";
export type EmployeeStatusType =
  | "active"
  | "on_leave"
  | "suspended"
  | "resigned"
  | "terminated"
  | "retired"
  | "absconding";
export type CredentialType =
  | "medical_council"
  | "nursing_council"
  | "pharmacy_council"
  | "dental_council"
  | "other_council"
  | "bls"
  | "acls"
  | "pals"
  | "nals"
  | "fire_safety"
  | "radiation_safety"
  | "nabh_orientation";
export type CredentialStatusType =
  | "active"
  | "expired"
  | "suspended"
  | "revoked"
  | "pending_renewal";
export type LeaveType =
  | "casual"
  | "earned"
  | "medical"
  | "maternity"
  | "paternity"
  | "compensatory"
  | "study"
  | "special"
  | "loss_of_pay";
export type LeaveStatusType =
  | "draft"
  | "pending_hod"
  | "pending_admin"
  | "approved"
  | "rejected"
  | "cancelled";
export type ShiftType =
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "general"
  | "split"
  | "on_call"
  | "custom";
export type TrainingStatusType = "scheduled" | "in_progress" | "completed" | "cancelled" | "failed";

// Entity interfaces
export interface Designation {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  level: number;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  tenant_id: string;
  user_id?: string;
  employee_code: string;
  first_name: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  employment_type: EmploymentType;
  status: EmployeeStatusType;
  department_id?: string;
  designation_id?: string;
  reporting_to?: string;
  date_of_joining: string;
  date_of_leaving?: string;
  qualifications: unknown;
  blood_group?: string;
  address: unknown;
  emergency_contact: unknown;
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  pf_number?: string;
  esi_number?: string;
  uan_number?: string;
  pan_number?: string;
  aadhaar_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileCompleteness {
  percent: number;
  filled: number;
  total: number;
  missing: string[];
}

export interface MyProfileResponse {
  employee: Employee | null;
  completeness: ProfileCompleteness;
}

export interface UpdateMyProfileRequest {
  phone?: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  address?: unknown;
  emergency_contact?: unknown;
  qualifications?: unknown;
}

export interface EmployeeCredential {
  id: string;
  tenant_id: string;
  employee_id: string;
  credential_type: CredentialType;
  issuing_body: string;
  registration_no: string;
  state_code?: string;
  issued_date?: string;
  expiry_date?: string;
  status: CredentialStatusType;
  verified_by?: string;
  verified_at?: string;
  document_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ShiftDefinition {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  shift_type: ShiftType;
  start_time: string;
  end_time: string;
  break_minutes: number;
  is_night: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DutyRoster {
  id: string;
  tenant_id: string;
  employee_id: string;
  department_id?: string;
  shift_id: string;
  roster_date: string;
  is_on_call: boolean;
  swap_with?: string;
  swap_approved: boolean;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  attendance_date: string;
  shift_id?: string;
  check_in?: string;
  check_out?: string;
  is_late: boolean;
  late_minutes: number;
  is_early_out: boolean;
  early_minutes: number;
  overtime_minutes: number;
  status: string;
  source: string;
  notes?: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export type ShiftSessionStatus = "off" | "on_duty" | "paused" | "ended";

export interface ShiftSession {
  id: string;
  session_status: ShiftSessionStatus;
  check_in: string | null;
  check_out: string | null;
  planned_end: string | null;
  extended_until: string | null;
  paused_at: string | null;
  paused_minutes: number;
  overtime_minutes: number;
  fatigue_ack_at: string | null;
}

export interface FatigueFlag {
  code: string;
  message: string;
}

export interface FatigueState {
  flags: FatigueFlag[];
  continuous_h: number;
  rest_h: number | null;
  week_h: number;
  acknowledged: boolean;
}

export interface ScheduledShift {
  shift_type: string;
  shift_name: string | null;
  start_time: string | null;
  end_time: string | null;
  charge_nurse_user_id: string | null;
}

export interface MyShiftResponse {
  scheduled: ScheduledShift | null;
  session: ShiftSession | null;
  fatigue: FatigueState;
}

export interface DutyHoursRow {
  employee_id: string;
  employee_name: string;
  department_id: string | null;
  session_status: ShiftSessionStatus | null;
  shift_end: string | null;
  continuous_h: number;
  week_h: number;
  overtime_h: number;
  flags: string[];
}

export interface LeaveBalance {
  id: string;
  tenant_id: string;
  employee_id: string;
  leave_type: LeaveType;
  year: number;
  opening: number;
  earned: number;
  used: number;
  balance: number;
  carry_forward: number;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  tenant_id: string;
  employee_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  is_half_day: boolean;
  reason?: string;
  status: LeaveStatusType;
  hod_id?: string;
  hod_action_at?: string;
  hod_remarks?: string;
  admin_id?: string;
  admin_action_at?: string;
  admin_remarks?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface OnCallSchedule {
  id: string;
  tenant_id: string;
  employee_id: string;
  department_id?: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  is_primary: boolean;
  contact_number?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingProgram {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string;
  is_mandatory: boolean;
  frequency_months?: number;
  duration_hours?: number;
  target_roles: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainingRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  program_id: string;
  training_date: string;
  status: TrainingStatusType;
  score?: number;
  certificate_no?: string;
  expiry_date?: string;
  trainer_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Appraisal {
  id: string;
  tenant_id: string;
  employee_id: string;
  appraisal_year: number;
  appraiser_id?: string;
  rating?: number;
  strengths?: string;
  improvements?: string;
  goals: unknown;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StatutoryRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  record_type: string;
  title: string;
  compliance_date?: string;
  expiry_date?: string;
  details: unknown;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Request types
export interface CreateDesignationRequest {
  code: string;
  name: string;
  level?: number;
  category?: string;
}
export interface UpdateDesignationRequest {
  name?: string;
  level?: number;
  category?: string;
  is_active?: boolean;
}
/** Payroll — salary structure, payroll run, and generated payslip. Money = string. */
export interface SalaryStructure {
  id: string;
  tenant_id: string;
  employee_id: string;
  basic: string;
  hra: string;
  other_allowances: string;
  monthly_tds: string;
  pf_applicable: boolean;
  esi_applicable: boolean;
  pt_applicable: boolean;
  effective_from: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollRun {
  id: string;
  tenant_id: string;
  period_month: number;
  period_year: number;
  status: string;
  working_days: number;
  employee_count: number;
  total_net_pay: string;
  run_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payslip {
  id: string;
  tenant_id: string;
  run_id: string;
  employee_id: string;
  working_days: number;
  lop_days: string;
  paid_days: string;
  gross: string;
  earned_gross: string;
  earned_basic: string;
  pf: string;
  esi: string;
  pt: string;
  tds: string;
  other_deductions: string;
  total_deductions: string;
  net_pay: string;
  earnings: unknown;
  deductions: unknown;
  created_at: string;
  updated_at: string;
}

export interface UpsertSalaryStructureRequest {
  employee_id: string;
  basic: number;
  hra: number;
  other_allowances: number;
  monthly_tds?: number;
  pf_applicable?: boolean;
  esi_applicable?: boolean;
  pt_applicable?: boolean;
}

export interface CreatePayrollRunRequest {
  period_month: number;
  period_year: number;
}

export interface CreateEmployeeRequest {
  employee_code: string;
  first_name: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  employment_type?: string;
  department_id?: string;
  designation_id?: string;
  reporting_to?: string;
  date_of_joining?: string;
  qualifications?: unknown;
  blood_group?: string;
  address?: unknown;
  emergency_contact?: unknown;
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  pf_number?: string;
  esi_number?: string;
  uan_number?: string;
  pan_number?: string;
  aadhaar_number?: string;
  user_id?: string;
  notes?: string;
  /** Auto-provision a linked login for this new employee. */
  provision_login?: boolean;
  login_username?: string;
  login_password?: string;
  login_role?: string;
}
export interface UpdateEmployeeRequest {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  employment_type?: string;
  status?: string;
  department_id?: string;
  designation_id?: string;
  reporting_to?: string;
  date_of_leaving?: string;
  qualifications?: unknown;
  blood_group?: string;
  address?: unknown;
  emergency_contact?: unknown;
  bank_name?: string;
  bank_account?: string;
  bank_ifsc?: string;
  pf_number?: string;
  esi_number?: string;
  uan_number?: string;
  pan_number?: string;
  aadhaar_number?: string;
  user_id?: string;
  notes?: string;
}
export interface CreateCredentialRequest {
  credential_type: string;
  issuing_body: string;
  registration_no: string;
  state_code?: string;
  issued_date?: string;
  expiry_date?: string;
  document_url?: string;
  notes?: string;
}
export interface UpdateCredentialRequest {
  status?: string;
  expiry_date?: string;
  verified_by?: string;
  document_url?: string;
  notes?: string;
}
export interface CreateShiftRequest {
  code: string;
  name: string;
  shift_type?: string;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  is_night?: boolean;
}
export interface UpdateShiftRequest {
  name?: string;
  shift_type?: string;
  start_time?: string;
  end_time?: string;
  break_minutes?: number;
  is_night?: boolean;
  is_active?: boolean;
}
export interface CreateRosterRequest {
  employee_id: string;
  department_id?: string;
  shift_id: string;
  roster_date: string;
  is_on_call?: boolean;
  notes?: string;
}
export interface CreateAttendanceRequest {
  employee_id: string;
  attendance_date: string;
  shift_id?: string;
  check_in?: string;
  check_out?: string;
  status?: string;
  source?: string;
  notes?: string;
}
export interface CreateLeaveRequestInput {
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days?: number;
  is_half_day?: boolean;
  reason?: string;
}
export interface LeaveActionRequest {
  action: string;
  remarks?: string;
}
export interface CreateOnCallRequest {
  employee_id: string;
  department_id?: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  is_primary?: boolean;
  contact_number?: string;
  notes?: string;
}
export interface CreateTrainingProgramRequest {
  code: string;
  name: string;
  description?: string;
  is_mandatory?: boolean;
  frequency_months?: number;
  duration_hours?: number;
  target_roles?: unknown;
}
export interface CreateTrainingRecordRequest {
  employee_id: string;
  program_id: string;
  training_date: string;
  status?: string;
  score?: number;
  certificate_no?: string;
  expiry_date?: string;
  trainer_name?: string;
  notes?: string;
}
export interface CreateAppraisalRequest {
  employee_id: string;
  appraisal_year: number;
  rating?: number;
  strengths?: string;
  improvements?: string;
  goals?: unknown;
  notes?: string;
}
export interface CreateStatutoryRecordRequest {
  employee_id: string;
  record_type: string;
  title: string;
  compliance_date?: string;
  expiry_date?: string;
  details?: unknown;
  notes?: string;
}

// ══════════════════════════════════════════════════════════
//  Front Office & Reception
// ══════════════════════════════════════════════════════════

export type VisitorPassStatus = "active" | "expired" | "revoked";
export type FrontOfficeVisitorCategory =
  | "general"
  | "legal_counsel"
  | "religious"
  | "vip"
  | "media"
  | "vendor"
  | "emergency";
export type FrontOfficeQueuePriority =
  | "normal"
  | "elderly"
  | "disabled"
  | "pregnant"
  | "emergency_referral"
  | "vip";

export interface VisitingHours {
  id: string;
  tenant_id: string;
  ward_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_visitors_per_patient: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VisitorRegistration {
  id: string;
  tenant_id: string;
  visitor_name: string;
  phone?: string;
  id_type?: string;
  id_number?: string;
  photo_url?: string;
  relationship?: string;
  category: FrontOfficeVisitorCategory;
  patient_id?: string;
  ward_id?: string;
  purpose?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface VisitorPass {
  id: string;
  tenant_id: string;
  registration_id: string;
  pass_number: string;
  ward_id?: string;
  bed_number?: string;
  valid_from: string;
  valid_until: string;
  status: VisitorPassStatus;
  qr_code?: string;
  issued_by?: string;
  revoked_at?: string;
  revoked_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface VisitorLog {
  id: string;
  tenant_id: string;
  pass_id: string;
  check_in_at: string;
  check_out_at?: string;
  logged_by?: string;
  gate?: string;
  created_at: string;
  updated_at: string;
}

export interface QueuePriorityRule {
  id: string;
  tenant_id: string;
  department_id?: string;
  priority: FrontOfficeQueuePriority;
  weight: number;
  auto_detect_criteria: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QueueDisplayConfig {
  id: string;
  tenant_id: string;
  department_id?: string;
  location_name: string;
  display_type: string;
  doctors_per_screen: number;
  show_patient_name: boolean;
  show_wait_time: boolean;
  language: unknown;
  announcement_enabled: boolean;
  scroll_speed: number;
  created_at: string;
  updated_at: string;
}

export interface FrontOfficeEnquiryLog {
  id: string;
  tenant_id: string;
  caller_name?: string;
  caller_phone?: string;
  enquiry_type: string;
  patient_id?: string;
  response_text?: string;
  handled_by?: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

export interface QueueStatsResponse {
  department_id?: string;
  waiting_count: number;
  avg_wait_minutes?: number;
}

// Request types
export interface UpsertVisitingHoursRequest {
  ward_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_visitors_per_patient?: number;
  is_active?: boolean;
}
export interface CreateVisitorRequest {
  visitor_name: string;
  phone?: string;
  id_type?: string;
  id_number?: string;
  photo_url?: string;
  relationship?: string;
  category?: string;
  patient_id?: string;
  ward_id?: string;
  purpose?: string;
}
export interface CreateVisitorPassRequest {
  registration_id: string;
  ward_id?: string;
  bed_number?: string;
  valid_hours?: number;
}
export interface RevokePassRequest {
  reason?: string;
}
export interface UpsertQueuePriorityRequest {
  department_id?: string;
  priority: string;
  weight?: number;
  auto_detect_criteria?: unknown;
  is_active?: boolean;
}
export interface UpsertDisplayConfigRequest {
  department_id?: string;
  location_name: string;
  display_type?: string;
  doctors_per_screen?: number;
  show_patient_name?: boolean;
  show_wait_time?: boolean;
  language?: unknown;
  announcement_enabled?: boolean;
  scroll_speed?: number;
}
export interface CreateEnquiryRequest {
  caller_name?: string;
  caller_phone?: string;
  enquiry_type?: string;
  patient_id?: string;
  response_text?: string;
}

// ═══════════════════════════════════════════════════════════
//  BME / CMMS — Biomedical Equipment Management
// ═══════════════════════════════════════════════════════════

export type BmeEquipmentStatus =
  | "active"
  | "under_maintenance"
  | "out_of_service"
  | "condemned"
  | "disposed";
export type BmeRiskCategory = "critical" | "high" | "medium" | "low";
export type BmeWorkOrderStatus = "open" | "assigned" | "in_progress" | "completed" | "cancelled";
export type BmeWorkOrderType =
  | "preventive"
  | "corrective"
  | "calibration"
  | "installation"
  | "inspection";
export type BmePmFrequency = "monthly" | "quarterly" | "semi_annual" | "annual";
export type BmeCalibrationStatus =
  | "calibrated"
  | "due"
  | "overdue"
  | "out_of_tolerance"
  | "exempted";
export type BmeContractType = "amc" | "cmc" | "warranty" | "camc";
export type BmeBreakdownPriority = "critical" | "high" | "medium" | "low";
export type BmeBreakdownStatus =
  | "reported"
  | "acknowledged"
  | "in_progress"
  | "parts_awaited"
  | "resolved"
  | "closed";

export interface BmeEquipment {
  id: string;
  tenant_id: string;
  name: string;
  make?: string;
  model?: string;
  serial_number?: string;
  asset_tag?: string;
  barcode_value?: string;
  category?: string;
  sub_category?: string;
  risk_category: BmeRiskCategory;
  is_critical: boolean;
  department_id?: string;
  location_description?: string;
  facility_id?: string;
  status: BmeEquipmentStatus;
  purchase_date?: string;
  purchase_cost?: number;
  installation_date?: string;
  commissioned_date?: string;
  installed_by?: string;
  commissioning_notes?: string;
  expected_life_years?: number;
  condemned_date?: string;
  disposal_date?: string;
  disposal_method?: string;
  warranty_start_date?: string;
  warranty_end_date?: string;
  warranty_terms?: string;
  vendor_id?: string;
  manufacturer_contact?: string;
  specifications: Record<string, unknown>;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BmePmSchedule {
  id: string;
  tenant_id: string;
  equipment_id: string;
  frequency: BmePmFrequency;
  checklist: unknown[];
  next_due_date?: string;
  last_completed_date?: string;
  assigned_to?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BmeWorkOrder {
  id: string;
  tenant_id: string;
  work_order_number: string;
  equipment_id: string;
  order_type: BmeWorkOrderType;
  status: BmeWorkOrderStatus;
  priority: BmeBreakdownPriority;
  assigned_to?: string;
  assigned_at?: string;
  scheduled_date?: string;
  started_at?: string;
  completed_at?: string;
  description?: string;
  findings?: string;
  actions_taken?: string;
  checklist_results: unknown[];
  labor_cost?: number;
  parts_cost?: number;
  vendor_cost?: number;
  total_cost?: number;
  technician_sign_off_by?: string;
  technician_sign_off_at?: string;
  supervisor_sign_off_by?: string;
  supervisor_sign_off_at?: string;
  pm_schedule_id?: string;
  breakdown_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BmeCalibration {
  id: string;
  tenant_id: string;
  equipment_id: string;
  calibration_status: BmeCalibrationStatus;
  frequency: BmePmFrequency;
  last_calibrated_date?: string;
  next_due_date?: string;
  calibrated_by?: string;
  calibration_vendor_id?: string;
  certificate_number?: string;
  certificate_url?: string;
  is_in_tolerance?: boolean;
  deviation_notes?: string;
  reference_standard?: string;
  is_locked: boolean;
  locked_at?: string;
  locked_reason?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BmeContract {
  id: string;
  tenant_id: string;
  contract_number: string;
  equipment_id: string;
  contract_type: BmeContractType;
  vendor_id: string;
  start_date: string;
  end_date: string;
  contract_value?: number;
  payment_terms?: string;
  coverage_details?: string;
  exclusions?: string;
  sla_response_hours?: number;
  sla_resolution_hours?: number;
  renewal_alert_days: number;
  is_renewed: boolean;
  renewed_contract_id?: string;
  is_active: boolean;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BmeBreakdown {
  id: string;
  tenant_id: string;
  equipment_id: string;
  reported_by?: string;
  reported_at: string;
  department_id?: string;
  priority: BmeBreakdownPriority;
  status: BmeBreakdownStatus;
  description: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolution_started_at?: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  downtime_start?: string;
  downtime_end?: string;
  downtime_minutes?: number;
  spare_parts_used?: string;
  spare_parts_cost?: number;
  vendor_visit_required: boolean;
  vendor_visit_date?: string;
  vendor_cost?: number;
  total_repair_cost?: number;
  vendor_id?: string;
  vendor_response_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BmeVendorEvaluation {
  id: string;
  tenant_id: string;
  vendor_id: string;
  contract_id?: string;
  evaluation_date: string;
  period_from?: string;
  period_to?: string;
  response_time_score?: number;
  resolution_quality_score?: number;
  spare_parts_availability_score?: number;
  professionalism_score?: number;
  overall_score?: number;
  total_calls?: number;
  calls_within_sla?: number;
  comments?: string;
  evaluated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface BmeStatsResponse {
  total_equipment: number;
  active_equipment: number;
  pm_overdue: number;
  calibration_overdue: number;
  open_breakdowns: number;
  expiring_contracts: number;
}

// Request types
export interface CreateBmeEquipmentRequest {
  name: string;
  make?: string;
  model?: string;
  serial_number?: string;
  asset_tag?: string;
  barcode_value?: string;
  category?: string;
  sub_category?: string;
  risk_category?: BmeRiskCategory;
  is_critical?: boolean;
  department_id?: string;
  location_description?: string;
  facility_id?: string;
  status?: BmeEquipmentStatus;
  purchase_date?: string;
  purchase_cost?: number;
  installation_date?: string;
  commissioned_date?: string;
  installed_by?: string;
  commissioning_notes?: string;
  expected_life_years?: number;
  warranty_start_date?: string;
  warranty_end_date?: string;
  warranty_terms?: string;
  vendor_id?: string;
  manufacturer_contact?: string;
  specifications?: Record<string, unknown>;
  notes?: string;
}

export interface UpdateBmeEquipmentRequest extends Partial<CreateBmeEquipmentRequest> {
  condemned_date?: string;
  disposal_date?: string;
  disposal_method?: string;
}

export interface CreateBmePmScheduleRequest {
  equipment_id: string;
  frequency: BmePmFrequency;
  checklist?: unknown[];
  next_due_date?: string;
  assigned_to?: string;
  notes?: string;
}
export interface UpdateBmePmScheduleRequest {
  frequency?: BmePmFrequency;
  checklist?: unknown[];
  next_due_date?: string;
  assigned_to?: string;
  is_active?: boolean;
  notes?: string;
}

export interface CreateBmeWorkOrderRequest {
  equipment_id: string;
  order_type: BmeWorkOrderType;
  priority?: BmeBreakdownPriority;
  assigned_to?: string;
  scheduled_date?: string;
  description?: string;
  pm_schedule_id?: string;
  breakdown_id?: string;
  notes?: string;
}
export interface UpdateBmeWorkOrderStatusRequest {
  status: BmeWorkOrderStatus;
  findings?: string;
  actions_taken?: string;
  checklist_results?: unknown[];
  labor_cost?: number;
  parts_cost?: number;
  vendor_cost?: number;
  total_cost?: number;
}

export interface CreateBmeCalibrationRequest {
  equipment_id: string;
  calibration_status?: BmeCalibrationStatus;
  frequency?: BmePmFrequency;
  last_calibrated_date?: string;
  next_due_date?: string;
  calibrated_by?: string;
  calibration_vendor_id?: string;
  certificate_number?: string;
  certificate_url?: string;
  is_in_tolerance?: boolean;
  deviation_notes?: string;
  reference_standard?: string;
  notes?: string;
}
export interface UpdateBmeCalibrationRequest extends Partial<CreateBmeCalibrationRequest> {
  is_locked?: boolean;
  locked_reason?: string;
}

export interface CreateBmeContractRequest {
  contract_number: string;
  equipment_id: string;
  contract_type: BmeContractType;
  vendor_id: string;
  start_date: string;
  end_date: string;
  contract_value?: number;
  payment_terms?: string;
  coverage_details?: string;
  exclusions?: string;
  sla_response_hours?: number;
  sla_resolution_hours?: number;
  renewal_alert_days?: number;
  notes?: string;
}
export interface UpdateBmeContractRequest {
  contract_type?: BmeContractType;
  vendor_id?: string;
  start_date?: string;
  end_date?: string;
  contract_value?: number;
  payment_terms?: string;
  coverage_details?: string;
  exclusions?: string;
  sla_response_hours?: number;
  sla_resolution_hours?: number;
  renewal_alert_days?: number;
  is_renewed?: boolean;
  renewed_contract_id?: string;
  is_active?: boolean;
  notes?: string;
}

export interface CreateBmeBreakdownRequest {
  equipment_id: string;
  department_id?: string;
  priority?: BmeBreakdownPriority;
  description: string;
  downtime_start?: string;
  vendor_visit_required?: boolean;
  notes?: string;
}
export interface UpdateBmeBreakdownStatusRequest {
  status: BmeBreakdownStatus;
  resolution_notes?: string;
  downtime_end?: string;
  spare_parts_used?: string;
  spare_parts_cost?: number;
  vendor_id?: string;
  vendor_cost?: number;
  total_repair_cost?: number;
}

export interface CreateBmeVendorEvaluationRequest {
  vendor_id: string;
  contract_id?: string;
  evaluation_date: string;
  period_from?: string;
  period_to?: string;
  response_time_score?: number;
  resolution_quality_score?: number;
  spare_parts_availability_score?: number;
  professionalism_score?: number;
  overall_score?: number;
  total_calls?: number;
  calls_within_sla?: number;
  comments?: string;
}

// ═══════════════════════════════════════════════════════════
//  Facilities Management (FMS)
// ═══════════════════════════════════════════════════════════

export type FmsGasType =
  | "oxygen"
  | "nitrous_oxide"
  | "nitrogen"
  | "medical_air"
  | "vacuum"
  | "co2"
  | "heliox";
export type FmsGasSourceType = "psa_plant" | "lmo_tank" | "cylinder_manifold" | "pipeline";
export type FmsFireEquipmentType =
  | "extinguisher_abc"
  | "extinguisher_co2"
  | "extinguisher_water"
  | "hydrant"
  | "hose_reel"
  | "smoke_detector"
  | "heat_detector"
  | "sprinkler"
  | "fire_alarm_panel"
  | "emergency_light";
export type FmsDrillType = "fire" | "code_red" | "evacuation" | "chemical_spill" | "bomb_threat";
export type FmsWaterSourceType = "municipal" | "borewell" | "tanker" | "ro_plant" | "stp_recycled";
export type FmsWaterTestType = "bacteriological" | "chemical" | "endotoxin" | "conductivity";
export type FmsEnergySourceType = "grid" | "dg_set" | "ups" | "solar" | "inverter";
export type FmsWorkOrderStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";

export interface FmsGasReading {
  id: string;
  tenant_id: string;
  gas_type: FmsGasType;
  source_type: FmsGasSourceType;
  location_id?: string;
  department_id?: string;
  purity_percent?: number;
  pressure_bar?: number;
  flow_lpm?: number;
  temperature_c?: number;
  tank_level_percent?: number;
  cylinder_count?: number;
  manifold_side?: string;
  is_alarm: boolean;
  alarm_reason?: string;
  reading_at: string;
  recorded_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FmsGasCompliance {
  id: string;
  tenant_id: string;
  facility_id?: string;
  gas_type: FmsGasType;
  peso_license_number?: string;
  peso_valid_from?: string;
  peso_valid_to?: string;
  drug_license_number?: string;
  drug_license_valid_to?: string;
  last_inspection_date?: string;
  next_inspection_date?: string;
  inspector_name?: string;
  compliance_status?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FmsFireEquipment {
  id: string;
  tenant_id: string;
  name: string;
  equipment_type: FmsFireEquipmentType;
  location_id?: string;
  department_id?: string;
  serial_number?: string;
  make?: string;
  capacity?: string;
  installation_date?: string;
  expiry_date?: string;
  last_refill_date?: string;
  next_refill_date?: string;
  barcode_value?: string;
  qr_code_value?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FmsFireInspection {
  id: string;
  tenant_id: string;
  equipment_id: string;
  inspection_date: string;
  is_functional: boolean;
  findings?: string;
  corrective_action?: string;
  inspected_by?: string;
  next_inspection_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FmsFireDrill {
  id: string;
  tenant_id: string;
  drill_type: FmsDrillType;
  facility_id?: string;
  drill_date: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  zones_covered?: string[];
  participants_count?: number;
  scenario_description?: string;
  evacuation_time_seconds?: number;
  response_time_seconds?: number;
  findings?: string;
  improvement_actions?: string;
  drill_report_url?: string;
  conducted_by?: string;
  approved_by?: string;
  next_drill_due?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FmsFireNoc {
  id: string;
  tenant_id: string;
  facility_id?: string;
  noc_number: string;
  issuing_authority?: string;
  issue_date?: string;
  valid_from?: string;
  valid_to?: string;
  renewal_alert_days: number;
  is_active: boolean;
  document_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FmsWaterTest {
  id: string;
  tenant_id: string;
  source_type: FmsWaterSourceType;
  test_type: FmsWaterTestType;
  location_id?: string;
  sample_date: string;
  result_date?: string;
  parameter_name: string;
  result_value?: number;
  unit?: string;
  acceptable_min?: number;
  acceptable_max?: number;
  is_within_limits?: boolean;
  corrective_action?: string;
  tested_by?: string;
  lab_name?: string;
  certificate_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FmsWaterSchedule {
  id: string;
  tenant_id: string;
  location_id?: string;
  schedule_type: string;
  frequency: string;
  last_completed_date?: string;
  next_due_date?: string;
  assigned_to?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FmsEnergyReading {
  id: string;
  tenant_id: string;
  source_type: FmsEnergySourceType;
  location_id?: string;
  equipment_name?: string;
  reading_at: string;
  voltage?: number;
  current_amps?: number;
  power_kw?: number;
  power_factor?: number;
  frequency_hz?: number;
  fuel_level_percent?: number;
  runtime_hours?: number;
  load_percent?: number;
  battery_voltage?: number;
  battery_health_percent?: number;
  backup_minutes?: number;
  switchover_time_seconds?: number;
  is_alarm: boolean;
  alarm_reason?: string;
  recorded_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FmsWorkOrder {
  id: string;
  tenant_id: string;
  work_order_number: string;
  category?: string;
  location_id?: string;
  department_id?: string;
  requested_by?: string;
  requested_at: string;
  priority: string;
  status: FmsWorkOrderStatus;
  description: string;
  assigned_to?: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
  findings?: string;
  actions_taken?: string;
  vendor_id?: string;
  vendor_report?: string;
  vendor_cost?: number;
  material_cost?: number;
  labor_cost?: number;
  total_cost?: number;
  completed_by?: string;
  sign_off_by?: string;
  sign_off_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FmsStatsResponse {
  overdue_fire_inspections: number;
  gas_compliance_expiring: number;
  water_tests_due: number;
  open_work_orders: number;
  energy_alarms: number;
}

// Request types
export interface CreateFmsGasReadingRequest {
  gas_type: FmsGasType;
  source_type: FmsGasSourceType;
  location_id?: string;
  department_id?: string;
  purity_percent?: number;
  pressure_bar?: number;
  flow_lpm?: number;
  temperature_c?: number;
  tank_level_percent?: number;
  cylinder_count?: number;
  manifold_side?: string;
  is_alarm?: boolean;
  alarm_reason?: string;
  reading_at?: string;
  notes?: string;
}

export interface CreateFmsGasComplianceRequest {
  facility_id?: string;
  gas_type: FmsGasType;
  peso_license_number?: string;
  peso_valid_from?: string;
  peso_valid_to?: string;
  drug_license_number?: string;
  drug_license_valid_to?: string;
  last_inspection_date?: string;
  next_inspection_date?: string;
  inspector_name?: string;
  compliance_status?: string;
  notes?: string;
}

export interface UpdateFmsGasComplianceRequest {
  peso_license_number?: string;
  peso_valid_from?: string;
  peso_valid_to?: string;
  drug_license_number?: string;
  drug_license_valid_to?: string;
  last_inspection_date?: string;
  next_inspection_date?: string;
  inspector_name?: string;
  compliance_status?: string;
  notes?: string;
}

export interface CreateFmsFireEquipmentRequest {
  name: string;
  equipment_type: FmsFireEquipmentType;
  location_id?: string;
  department_id?: string;
  serial_number?: string;
  make?: string;
  capacity?: string;
  installation_date?: string;
  expiry_date?: string;
  last_refill_date?: string;
  next_refill_date?: string;
  barcode_value?: string;
  qr_code_value?: string;
  notes?: string;
}

export interface UpdateFmsFireEquipmentRequest {
  name?: string;
  location_id?: string;
  department_id?: string;
  serial_number?: string;
  make?: string;
  capacity?: string;
  expiry_date?: string;
  last_refill_date?: string;
  next_refill_date?: string;
  barcode_value?: string;
  qr_code_value?: string;
  is_active?: boolean;
  notes?: string;
}

export interface CreateFmsFireInspectionRequest {
  equipment_id: string;
  inspection_date: string;
  is_functional: boolean;
  findings?: string;
  corrective_action?: string;
  next_inspection_date?: string;
  notes?: string;
}

export interface CreateFmsFireDrillRequest {
  drill_type: FmsDrillType;
  facility_id?: string;
  drill_date: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  zones_covered?: string[];
  participants_count?: number;
  scenario_description?: string;
  evacuation_time_seconds?: number;
  response_time_seconds?: number;
  findings?: string;
  improvement_actions?: string;
  drill_report_url?: string;
  approved_by?: string;
  next_drill_due?: string;
  notes?: string;
}

export interface CreateFmsFireNocRequest {
  facility_id?: string;
  noc_number: string;
  issuing_authority?: string;
  issue_date?: string;
  valid_from?: string;
  valid_to?: string;
  renewal_alert_days?: number;
  document_url?: string;
  notes?: string;
}

export interface UpdateFmsFireNocRequest {
  issuing_authority?: string;
  issue_date?: string;
  valid_from?: string;
  valid_to?: string;
  renewal_alert_days?: number;
  is_active?: boolean;
  document_url?: string;
  notes?: string;
}

export interface CreateFmsWaterTestRequest {
  source_type: FmsWaterSourceType;
  test_type: FmsWaterTestType;
  location_id?: string;
  sample_date: string;
  result_date?: string;
  parameter_name: string;
  result_value?: number;
  unit?: string;
  acceptable_min?: number;
  acceptable_max?: number;
  is_within_limits?: boolean;
  corrective_action?: string;
  tested_by?: string;
  lab_name?: string;
  certificate_number?: string;
  notes?: string;
}

export interface CreateFmsWaterScheduleRequest {
  location_id?: string;
  schedule_type: string;
  frequency: string;
  last_completed_date?: string;
  next_due_date?: string;
  assigned_to?: string;
  notes?: string;
}

export interface UpdateFmsWaterScheduleRequest {
  last_completed_date?: string;
  next_due_date?: string;
  assigned_to?: string;
  is_active?: boolean;
  notes?: string;
}

export interface CreateFmsEnergyReadingRequest {
  source_type: FmsEnergySourceType;
  location_id?: string;
  equipment_name?: string;
  reading_at?: string;
  voltage?: number;
  current_amps?: number;
  power_kw?: number;
  power_factor?: number;
  frequency_hz?: number;
  fuel_level_percent?: number;
  runtime_hours?: number;
  load_percent?: number;
  battery_voltage?: number;
  battery_health_percent?: number;
  backup_minutes?: number;
  switchover_time_seconds?: number;
  is_alarm?: boolean;
  alarm_reason?: string;
  notes?: string;
}

export interface CreateFmsWorkOrderRequest {
  category?: string;
  location_id?: string;
  department_id?: string;
  priority?: string;
  description: string;
  assigned_to?: string;
  vendor_id?: string;
  notes?: string;
}

export interface UpdateFmsWorkOrderStatusRequest {
  status: FmsWorkOrderStatus;
  assigned_to?: string;
  findings?: string;
  actions_taken?: string;
  vendor_id?: string;
  vendor_report?: string;
  vendor_cost?: number;
  material_cost?: number;
  labor_cost?: number;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════
//  Security Department
// ═══════════════════════════════════════════════════════════

export type SecAccessMethod = "card" | "biometric" | "pin" | "manual";
export type SecZoneLevel = "public" | "general" | "restricted" | "high_security" | "critical";
export type SecIncidentSeverity = "low" | "medium" | "high" | "critical";
export type SecIncidentStatus = "reported" | "investigating" | "resolved" | "closed";
export type SecPatientTagType = "infant_rfid" | "wander_guard" | "elopement_risk";
export type SecTagAlertStatus = "active" | "alert_triggered" | "resolved" | "deactivated";

export interface SecurityZone {
  id: string;
  tenant_id: string;
  name: string;
  zone_code: string;
  level: SecZoneLevel;
  department_id?: string;
  description?: string;
  allowed_methods?: unknown;
  after_hours_restricted: boolean;
  after_hours_start?: string;
  after_hours_end?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SecurityAccessLog {
  id: string;
  tenant_id: string;
  zone_id: string;
  employee_id?: string;
  person_name?: string;
  access_method: SecAccessMethod;
  card_number?: string;
  direction: string;
  granted: boolean;
  denied_reason?: string;
  is_after_hours: boolean;
  accessed_at: string;
  device_id?: string;
  recorded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SecurityAccessCard {
  id: string;
  tenant_id: string;
  employee_id: string;
  card_number: string;
  card_type?: string;
  issued_date: string;
  expiry_date?: string;
  allowed_zones?: unknown;
  is_active: boolean;
  deactivated_at?: string;
  deactivation_reason?: string;
  issued_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SecurityCamera {
  id: string;
  tenant_id: string;
  name: string;
  camera_id?: string;
  zone_id?: string;
  location_description?: string;
  camera_type?: string;
  resolution?: string;
  is_recording: boolean;
  retention_days: number;
  ip_address?: string;
  is_active: boolean;
  last_checked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SecurityIncident {
  id: string;
  tenant_id: string;
  incident_number: string;
  severity: SecIncidentSeverity;
  status: SecIncidentStatus;
  category: string;
  zone_id?: string;
  location_description?: string;
  occurred_at: string;
  description: string;
  persons_involved?: unknown;
  witnesses?: unknown;
  camera_ids?: unknown;
  video_timestamp_start?: string;
  video_timestamp_end?: string;
  police_notified: boolean;
  police_report_number?: string;
  investigation_notes?: string;
  resolution?: string;
  resolved_at?: string;
  resolved_by?: string;
  reported_by?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export interface SecurityPatientTag {
  id: string;
  tenant_id: string;
  patient_id: string;
  tag_type: SecPatientTagType;
  tag_identifier?: string;
  allowed_zone_id?: string;
  alert_status: SecTagAlertStatus;
  mother_id?: string;
  admission_id?: string;
  activated_at: string;
  deactivated_at?: string;
  activated_by?: string;
  deactivated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SecurityTagAlert {
  id: string;
  tenant_id: string;
  tag_id: string;
  alert_type: string;
  triggered_at: string;
  zone_id?: string;
  location_description?: string;
  is_resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  was_false_alarm: boolean;
  resolution_notes?: string;
  code_activation_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SecurityCodeDebrief {
  id: string;
  tenant_id: string;
  code_activation_id: string;
  debrief_date: string;
  facilitator_id?: string;
  attendees?: unknown;
  response_time_seconds?: number;
  total_duration_minutes?: number;
  what_went_well?: string;
  what_went_wrong?: string;
  root_cause?: string;
  lessons_learned?: string;
  action_items?: unknown;
  equipment_issues?: string;
  training_gaps?: string;
  protocol_changes_recommended?: string;
  created_at: string;
  updated_at: string;
}

// Request types
export interface CreateSecurityZoneRequest {
  name: string;
  zone_code: string;
  level?: SecZoneLevel;
  department_id?: string;
  description?: string;
  allowed_methods?: unknown;
  after_hours_restricted?: boolean;
  after_hours_start?: string;
  after_hours_end?: string;
}

export interface UpdateSecurityZoneRequest {
  name?: string;
  level?: SecZoneLevel;
  department_id?: string;
  description?: string;
  allowed_methods?: unknown;
  after_hours_restricted?: boolean;
  after_hours_start?: string;
  after_hours_end?: string;
  is_active?: boolean;
}

export interface CreateSecurityAccessLogRequest {
  zone_id: string;
  employee_id?: string;
  person_name?: string;
  access_method?: SecAccessMethod;
  card_number?: string;
  direction?: string;
  granted?: boolean;
  denied_reason?: string;
  is_after_hours?: boolean;
  accessed_at?: string;
  device_id?: string;
}

export interface CreateSecurityAccessCardRequest {
  employee_id: string;
  card_number: string;
  card_type?: string;
  issued_date?: string;
  expiry_date?: string;
  allowed_zones?: unknown;
}

export interface UpdateSecurityAccessCardRequest {
  card_type?: string;
  expiry_date?: string;
  allowed_zones?: unknown;
}

export interface CreateSecurityCameraRequest {
  name: string;
  camera_id?: string;
  zone_id?: string;
  location_description?: string;
  camera_type?: string;
  resolution?: string;
  is_recording?: boolean;
  retention_days?: number;
  ip_address?: string;
}

export interface UpdateSecurityCameraRequest {
  name?: string;
  camera_id?: string;
  zone_id?: string;
  location_description?: string;
  camera_type?: string;
  resolution?: string;
  is_recording?: boolean;
  retention_days?: number;
  ip_address?: string;
  is_active?: boolean;
}

export interface CreateSecurityIncidentRequest {
  severity?: SecIncidentSeverity;
  category: string;
  zone_id?: string;
  location_description?: string;
  occurred_at?: string;
  description: string;
  persons_involved?: unknown;
  witnesses?: unknown;
  camera_ids?: unknown;
  video_timestamp_start?: string;
  video_timestamp_end?: string;
  police_notified?: boolean;
  police_report_number?: string;
  assigned_to?: string;
}

export interface UpdateSecurityIncidentRequest {
  severity?: SecIncidentSeverity;
  status?: SecIncidentStatus;
  category?: string;
  zone_id?: string;
  location_description?: string;
  description?: string;
  persons_involved?: unknown;
  witnesses?: unknown;
  camera_ids?: unknown;
  video_timestamp_start?: string;
  video_timestamp_end?: string;
  police_notified?: boolean;
  police_report_number?: string;
  investigation_notes?: string;
  resolution?: string;
  assigned_to?: string;
}

export interface CreateSecurityPatientTagRequest {
  patient_id: string;
  tag_type: SecPatientTagType;
  tag_identifier?: string;
  allowed_zone_id?: string;
  mother_id?: string;
  admission_id?: string;
}

export interface ResolveSecurityTagAlertRequest {
  was_false_alarm?: boolean;
  resolution_notes?: string;
}

export interface CreateSecurityCodeDebriefRequest {
  code_activation_id: string;
  debrief_date?: string;
  facilitator_id?: string;
  attendees?: unknown;
  response_time_seconds?: number;
  total_duration_minutes?: number;
  what_went_well?: string;
  what_went_wrong?: string;
  root_cause?: string;
  lessons_learned?: string;
  action_items?: unknown;
  equipment_issues?: string;
  training_gaps?: string;
  protocol_changes_recommended?: string;
}

// ── Endoscopy ──

export type ScopeStatus = "available" | "in_use" | "reprocessing" | "quarantine" | "decommissioned";

export type HldResult = "pass" | "fail" | "pending";

export interface EndoscopyProcedure {
  id: string;
  tenant_id: string;
  patient_id: string;
  scope_id: string | null;
  procedure_type: string;
  sedation_type: string | null;
  findings: Record<string, unknown> | null;
  biopsy_taken: boolean;
  sedation_drugs: Record<string, unknown> | null;
  aldrete_score_pre: number | null;
  aldrete_score_post: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEndoscopyProcedureRequest {
  patient_id: string;
  scope_id?: string;
  procedure_type: string;
  sedation_type?: string;
  findings?: Record<string, unknown>;
  sedation_drugs?: Record<string, unknown>;
  aldrete_score_pre?: number;
  aldrete_score_post?: number;
}

export interface EndoscopyScope {
  id: string;
  tenant_id: string;
  serial_number: string;
  model: string | null;
  scope_type: string | null;
  status: ScopeStatus;
  last_hld_at: string | null;
  total_uses: number;
  last_culture_date: string | null;
  last_culture_result: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEndoscopyScopeRequest {
  serial_number: string;
  model?: string;
  scope_type?: string;
}

export interface EndoscopyReprocessing {
  id: string;
  tenant_id: string;
  scope_id: string;
  procedure_id: string | null;
  leak_test_passed: boolean;
  hld_chemical: string | null;
  hld_concentration: string | null;
  hld_soak_minutes: number | null;
  hld_temperature: number | null;
  hld_result: HldResult;
  reprocessed_by: string;
  created_at: string;
}

export interface CreateEndoscopyReprocessingRequest {
  scope_id: string;
  procedure_id?: string;
  leak_test_passed: boolean;
  hld_chemical?: string;
  hld_concentration?: string;
  hld_soak_minutes?: number;
  hld_temperature?: number;
  hld_result: HldResult;
}

export interface EndoscopyBiopsySpecimen {
  id: string;
  tenant_id: string;
  procedure_id: string;
  site: string;
  container_label: string | null;
  fixative: string | null;
  chain_of_custody: Record<string, unknown> | null;
  pathology_result: string | null;
  created_at: string;
}

export interface CreateEndoscopyBiopsyRequest {
  site: string;
  container_label?: string;
  fixative?: string;
  chain_of_custody?: Record<string, unknown>;
}

// ── PMR / Audiology ──

export type RehabDiscipline =
  | "physiotherapy"
  | "occupational_therapy"
  | "speech_therapy"
  | "psychology"
  | "prosthetics_orthotics";

export type HearingTestType = "pta" | "bera" | "oae" | "tympanometry" | "speech_audiometry";

export interface RehabPlan {
  id: string;
  tenant_id: string;
  patient_id: string;
  discipline: RehabDiscipline;
  goals: string | null;
  plan_details: Record<string, unknown> | null;
  fim_score_initial: number | null;
  barthel_score_initial: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRehabPlanRequest {
  patient_id: string;
  discipline: RehabDiscipline;
  goals?: string;
  plan_details?: Record<string, unknown>;
  fim_score_initial?: number;
  barthel_score_initial?: number;
}

export interface RehabSession {
  id: string;
  tenant_id: string;
  plan_id: string;
  session_number: number;
  therapist_id: string;
  intervention: string | null;
  pain_score: number | null;
  rom: Record<string, unknown> | null;
  strength: Record<string, unknown> | null;
  fim_score: number | null;
  barthel_score: number | null;
  created_at: string;
}

export interface CreateRehabSessionRequest {
  session_number: number;
  therapist_id: string;
  intervention?: string;
  pain_score?: number;
  rom?: Record<string, unknown>;
  strength?: Record<string, unknown>;
  fim_score?: number;
  barthel_score?: number;
}

export interface AudiologyTest {
  id: string;
  tenant_id: string;
  patient_id: string;
  test_type: HearingTestType;
  right_ear_results: Record<string, unknown> | null;
  left_ear_results: Record<string, unknown> | null;
  is_nhsp: boolean;
  nhsp_referral_needed: boolean;
  audiogram_data: Record<string, unknown> | null;
  created_at: string;
}

export interface CreateAudiologyTestRequest {
  patient_id: string;
  test_type: HearingTestType;
  right_ear_results?: Record<string, unknown>;
  left_ear_results?: Record<string, unknown>;
  is_nhsp?: boolean;
  nhsp_referral_needed?: boolean;
  audiogram_data?: Record<string, unknown>;
}

export interface PsychometricTest {
  id: string;
  tenant_id: string;
  patient_id: string;
  test_name: string;
  raw_data_encrypted: Record<string, unknown> | null;
  summary_for_clinician: string | null;
  is_restricted: boolean;
  created_at: string;
}

export interface CreatePsychometricTestRequest {
  patient_id: string;
  test_name: string;
  raw_data_encrypted?: Record<string, unknown>;
  summary_for_clinician?: string;
}

// ── IPD Phase 3a Response Types ────────────────────────────

export interface LabOrderSummary {
  id: string;
  test_name: string;
  ordered_at: string;
  status: string;
}

export interface LabResultSummary {
  id: string;
  order_id: string;
  parameter_name: string;
  value: string | null;
  unit: string | null;
  reference_range: string | null;
  is_abnormal: boolean;
}

export interface RadiologyOrderSummary {
  id: string;
  modality: string;
  body_part: string | null;
  ordered_at: string;
  status: string;
  findings: string | null;
}

export interface InvestigationsResponse {
  lab_orders: LabOrderSummary[];
  lab_results: LabResultSummary[];
  radiology_orders: RadiologyOrderSummary[];
}

export interface EstimatedCostResponse {
  daily_rate: number;
  nursing_charge: number;
  estimated_days: number;
  room_total: number;
  nursing_total: number;
  deposit_required: number;
  total_estimated: number;
}

export interface DeptChargeGroup {
  department_name: string;
  total: number;
}

export interface BillingSummaryResponse {
  charges_by_dept: DeptChargeGroup[];
  total_charges: number;
  total_payments: number;
  outstanding_balance: number;
}

export interface AdmissionPrintData {
  patient_name: string;
  uhid: string;
  age: number | null;
  gender: string | null;
  admission_date: string;
  bed_number: string | null;
  ward_name: string | null;
  department_name: string | null;
  doctor_name: string | null;
  ip_type: string | null;
  provisional_diagnosis: string | null;
}

export interface SurgeonCaseloadEntry {
  surgeon_id: string;
  surgeon_name: string;
  total_cases: number;
  avg_duration_minutes: number | null;
  complication_count: number;
  cancellation_count: number;
}

export interface AnesthesiaComplicationEntry {
  case_id: string;
  patient_name: string;
  procedure_name: string;
  anesthesia_type: string;
  complications: string | null;
  adverse_events: unknown;
  case_date: string;
}

export interface LinkMlcRequest {
  mlc_case_id: string;
}

// ── Admin/HR Forms ────────────────────────────────────────────────────────────

export interface EmployeeIdCardPrintData {
  employee_id: string;
  employee_name: string;
  designation: string;
  department: string;
  date_of_joining: string;
  blood_group: string | null;
  emergency_contact: string | null;
  photo_url: string | null;
  access_zones: string[];
  valid_from: string;
  valid_until: string;
  barcode_data: string;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface ShiftDefinition {
  shift_name: string;
  start_time: string;
  end_time: string;
  color_code: string | null;
}

export interface DayShift {
  date: string;
  shift: string;
  is_off: boolean;
}

export interface RosterEntry {
  employee_name: string;
  employee_id: string;
  designation: string;
  schedule: DayShift[];
}

export interface DutyRosterPrintData {
  department: string;
  period_start: string;
  period_end: string;
  generated_date: string;
  generated_by: string;
  shifts: ShiftDefinition[];
  roster_entries: RosterEntry[];
  hospital_name: string;
}

export interface LeaveApplicationPrintData {
  application_number: string;
  application_date: string;
  employee_name: string;
  employee_id: string;
  department: string;
  designation: string;
  leave_type: string;
  leave_from: string;
  leave_to: string;
  total_days: number;
  reason: string;
  leave_balance_before: number;
  leave_balance_after: number;
  relieving_officer: string | null;
  contact_during_leave: string | null;
  approver_name: string | null;
  approval_status: string;
  approval_date: string | null;
  remarks: string | null;
  hospital_name: string;
}

export interface DailyAttendance {
  date: string;
  status: string;
  in_time: string | null;
  out_time: string | null;
}

export interface AttendanceRecord {
  employee_name: string;
  employee_id: string;
  designation: string;
  days_present: number;
  days_absent: number;
  days_leave: number;
  late_arrivals: number;
  early_departures: number;
  overtime_hours: number;
  daily_attendance: DailyAttendance[];
}

export interface AttendanceSummary {
  total_staff: number;
  avg_attendance_percent: number;
  total_leave_days: number;
  total_absent_days: number;
}

export interface StaffAttendanceReportPrintData {
  department: string;
  month: string;
  year: number;
  generated_date: string;
  attendance_records: AttendanceRecord[];
  summary: AttendanceSummary;
  hospital_name: string;
}

export interface TrainingCertificatePrintData {
  certificate_number: string;
  certificate_date: string;
  employee_name: string;
  employee_id: string;
  designation: string;
  department: string;
  training_title: string;
  training_type: string;
  training_date: string;
  training_duration: string;
  trainer_name: string | null;
  trainer_organization: string | null;
  topics_covered: string[];
  score: number | null;
  grade: string | null;
  certificate_valid_until: string | null;
  issued_by: string;
  qr_verification_url: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface CredentialDetail {
  credential_type: string;
  credential_name: string;
  issuing_authority: string;
  credential_number: string;
  issue_date: string | null;
  expiry_date: string | null;
  verification_status: string;
  document_attached: boolean;
}

export interface StaffCredentialFormPrintData {
  verification_number: string;
  verification_date: string;
  employee_name: string;
  employee_id: string;
  designation: string;
  department: string;
  credentials: CredentialDetail[];
  verification_status: string;
  verified_by: string | null;
  remarks: string | null;
  hospital_name: string;
}

export interface VisitorEntry {
  serial_no: number;
  visitor_name: string;
  visitor_phone: string | null;
  visitor_id_type: string | null;
  visitor_id_number: string | null;
  purpose: string;
  visiting_department: string | null;
  visiting_person: string | null;
  patient_name: string | null;
  patient_uhid: string | null;
  in_time: string;
  out_time: string | null;
  badge_number: string | null;
}

export interface VisitorRegisterPrintData {
  register_date: string;
  location: string;
  entries: VisitorEntry[];
  total_visitors: number;
  hospital_name: string;
}

// ── Blood Bank & OT Forms ─────────────────────────────────────────────────────

export interface OtSurgeryEntry {
  serial_no: number;
  patient_name: string;
  uhid: string;
  age_gender: string;
  ip_number: string | null;
  diagnosis: string;
  procedure: string;
  surgery_type: string;
  surgeon: string;
  assistant_surgeon: string | null;
  anesthesiologist: string;
  anesthesia_type: string;
  scrub_nurse: string | null;
  circulating_nurse: string | null;
  scheduled_time: string;
  actual_start: string | null;
  actual_end: string | null;
  duration_minutes: number | null;
  outcome: string | null;
  complications: string | null;
}

export interface OtRegisterPrintData {
  register_date: string;
  ot_name: string;
  ot_number: string;
  surgeries: OtSurgeryEntry[];
  total_surgeries: number;
  total_elective: number;
  total_emergency: number;
  printed_by: string;
  hospital_name: string;
}

export interface DonorMedicalHistory {
  recent_illness: boolean;
  recent_surgery: boolean;
  recent_transfusion: boolean;
  chronic_disease: boolean;
  on_medication: boolean;
  pregnant_or_lactating: boolean;
  high_risk_behavior: boolean;
  tattoo_recent: boolean;
  details: string | null;
}

export interface DonorPhysicalExam {
  weight_kg: number;
  blood_pressure: string;
  pulse: number;
  temperature: number;
  hemoglobin: number;
  fit_to_donate: boolean;
  deferral_reason: string | null;
}

export interface BloodDonorFormPrintData {
  registration_number: string;
  registration_date: string;
  donor_name: string;
  age: number;
  gender: string;
  blood_group: string;
  rh_factor: string;
  father_husband_name: string | null;
  address: string;
  phone: string;
  email: string | null;
  id_proof_type: string;
  id_proof_number: string;
  occupation: string | null;
  donation_type: string;
  previous_donations: number;
  last_donation_date: string | null;
  medical_history: DonorMedicalHistory;
  physical_exam: DonorPhysicalExam;
  consent_given: boolean;
  consent_date: string | null;
  medical_officer: string | null;
  hospital_name: string;
}

export interface CrossMatchRequisitionPrintData {
  requisition_number: string;
  requisition_date: string;
  urgency: string;
  patient_name: string;
  uhid: string;
  age_gender: string;
  ip_number: string | null;
  ward_bed: string;
  blood_group: string;
  rh_factor: string;
  diagnosis: string;
  indication_for_transfusion: string;
  units_required: number;
  component_type: string;
  previous_transfusions: number;
  transfusion_reactions_history: boolean;
  reaction_details: string | null;
  sample_collected_by: string;
  sample_collected_at: string;
  requesting_doctor: string;
  doctor_signature_date: string;
  hospital_name: string;
}

// ── Consent Print Data ──────────────────────────────────

export interface ConsentPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  date_of_birth: string | null;
  address: string | null;
  phone: string;
  consent_type: string;
  consent_date: string;
  consent_time: string;
  admission_id: string | null;
  bed_number: string | null;
  ward_name: string | null;
  treating_doctor: string | null;
  department: string | null;
  procedure_name: string | null;
  procedure_date: string | null;
  surgeon_name: string | null;
  anesthetist_name: string | null;
  risks_explained: string[];
  alternatives_discussed: string[];
  special_instructions: string | null;
  blood_group: string | null;
  components_required: string[];
  reason_for_ama: string | null;
  advice_given_at_discharge: string | null;
  language: string;
  translated_content: unknown | null;
}

export interface ConsentSignatureBlock {
  signatory_type: string;
  name: string;
  designation: string | null;
  relation: string | null;
  signature_data: string | null;
  signed_at: string | null;
}

// ── Token Slip & Visitor Pass Print Data ─────────────────

export interface TokenSlipPrintData {
  token_number: string;
  token_date: string;
  token_time: string;
  patient_name: string | null;
  uhid: string | null;
  department_name: string;
  doctor_name: string | null;
  room_number: string | null;
  estimated_wait_minutes: number | null;
  priority: string;
  qr_code_data: string;
  instructions: string;
}

export interface VisitorPassPrintData {
  pass_number: string;
  visitor_name: string;
  visitor_phone: string;
  visitor_id_type: string | null;
  visitor_id_number: string | null;
  patient_name: string;
  patient_uhid: string;
  patient_ward: string | null;
  patient_bed: string | null;
  relation: string | null;
  valid_from: string;
  valid_until: string;
  issued_at: string;
  issued_by: string | null;
  photo_url: string | null;
  qr_code_data: string;
}

// ── Additional Consent Print Data (Phase 2) ─────────────

export interface DnrConsentPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  admission_date: string;
  bed_number: string | null;
  ward_name: string | null;
  diagnosis: string | null;
  prognosis: string | null;
  consent_date: string;
  consent_time: string;
  dnr_type: string;
  interventions_declined: string[];
  interventions_allowed: string[];
  patient_wishes: string | null;
  family_discussion_notes: string | null;
  treating_doctor: string | null;
  witness_name: string | null;
  language: string;
}

export interface OrganDonationConsentPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  address: string | null;
  consent_date: string;
  consent_type: string;
  organs_consented: string[];
  tissues_consented: string[];
  next_of_kin_name: string | null;
  next_of_kin_relation: string | null;
  next_of_kin_phone: string | null;
  thoa_registration_number: string | null;
  transplant_coordinator: string | null;
  hospital_name: string | null;
  language: string;
}

export interface ResearchConsentPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  consent_date: string;
  study_title: string;
  study_protocol_number: string;
  principal_investigator: string;
  iec_approval_number: string;
  iec_approval_date: string;
  sponsor_name: string | null;
  study_purpose: string;
  procedures_involved: string[];
  risks_benefits: string;
  compensation: string | null;
  confidentiality_statement: string;
  withdrawal_rights: string;
  contact_details: string;
  language: string;
}

export interface AbdmConsentPrintData {
  patient_name: string;
  uhid: string;
  abha_number: string | null;
  abha_address: string | null;
  consent_date: string;
  consent_type: string;
  purposes_consented: string[];
  health_info_types: string[];
  hip_name: string;
  hiu_name: string | null;
  validity_period: string | null;
  language: string;
}

export interface TeachingConsentPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  admission_id: string | null;
  consent_date: string;
  consent_type: string;
  teaching_activity: string;
  student_level: string;
  department: string | null;
  faculty_supervisor: string | null;
  patient_rights_explained: boolean;
  can_withdraw_anytime: boolean;
  language: string;
}

// ── Clinical Print Data (Phase 2) ───────────────────────

export interface TreatmentChartMedication {
  drug_name: string;
  dose: string;
  route: string;
  frequency: string;
  time_slots: string[];
  start_date: string;
  end_date: string | null;
  special_instructions: string | null;
}

export interface TreatmentChartIvFluid {
  fluid_name: string;
  volume_ml: number;
  rate: string;
  additives: string[];
  start_time: string;
  duration_hours: number | null;
}

export interface StatOrder {
  order_type: string;
  description: string;
  ordered_at: string;
  ordered_by: string | null;
}

export interface TreatmentChartPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  admission_date: string;
  bed_number: string | null;
  ward_name: string | null;
  diagnosis: string | null;
  allergies: string[];
  chart_date: string;
  medications: TreatmentChartMedication[];
  iv_fluids: TreatmentChartIvFluid[];
  stat_orders: StatOrder[];
  treating_doctor: string | null;
}

export interface TransferSummaryPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  transfer_date: string;
  transfer_time: string;
  from_ward: string;
  from_bed: string | null;
  to_ward: string;
  to_bed: string | null;
  transfer_reason: string;
  diagnosis: string | null;
  current_condition: string;
  vital_signs: string | null;
  current_medications: string[];
  pending_investigations: string[];
  pending_consultations: string[];
  special_precautions: string[];
  handover_notes: string | null;
  transferring_doctor: string | null;
  receiving_doctor: string | null;
  transferring_nurse: string | null;
  receiving_nurse: string | null;
}

export interface EducationSection {
  heading: string;
  content: string;
  bullet_points: string[];
}

export interface PatientEducationPrintData {
  patient_name: string;
  uhid: string;
  material_title: string;
  material_code: string;
  category: string;
  content_sections: EducationSection[];
  language: string;
  provided_date: string;
  provided_by: string | null;
  hospital_name: string | null;
}

// ── Identity Print Data (Phase 2) ───────────────────────

export interface RegistrationCardPrintData {
  patient_name: string;
  uhid: string;
  date_of_birth: string | null;
  age: string | null;
  gender: string;
  blood_group: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  allergies: string[];
  photo_url: string | null;
  qr_code_data: string;
  registration_date: string;
  hospital_name: string | null;
}

export interface InfantWristbandPrintData {
  mother_name: string;
  mother_uhid: string;
  baby_id: string;
  baby_gender: string;
  date_of_birth: string;
  time_of_birth: string;
  birth_weight_grams: number;
  delivery_type: string;
  ward_name: string | null;
  bed_number: string | null;
  attending_doctor: string | null;
  barcode_data: string;
  rfid_tag: string | null;
}

// ── Phase 3: Quality & Safety Print Data ──────────────────────────

export interface StaffInvolvedEntry {
  staff_name: string;
  designation: string | null;
  department: string | null;
  role_in_incident: string | null;
}

export interface IncidentReportPrintData {
  incident_number: string;
  incident_date: string;
  incident_time: string | null;
  incident_location: string | null;
  incident_type: string;
  incident_category: string | null;
  severity: string;
  patient_involved: boolean;
  patient_name: string | null;
  patient_uhid: string | null;
  visitor_involved: boolean;
  visitor_name: string | null;
  staff_involved: StaffInvolvedEntry[];
  incident_description: string | null;
  immediate_actions: string | null;
  patient_condition_before: string | null;
  patient_condition_after: string | null;
  harm_caused: string | null;
  harm_level: string | null;
  equipment_involved: string | null;
  equipment_id: string | null;
  medications_involved: string[];
  contributing_factors: string[];
  preventability: string | null;
  witness_names: string[];
  reported_by: string | null;
  reported_to: string | null;
  reported_at: string | null;
  notification_sent_to: string[];
  initial_response: string | null;
  follow_up_required: boolean;
  rca_required: boolean;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface RcaTeamMember {
  name: string;
  designation: string | null;
  department: string | null;
  role_in_rca: string | null;
}

export interface RcaTimelineEntry {
  event_time: string;
  event_description: string;
  personnel_involved: string | null;
  category: string | null;
}

export interface FiveWhyEntry {
  level: number;
  question: string;
  answer: string;
}

export interface FishboneCategory {
  category: string;
  causes: string[];
}

export interface CorrectiveAction {
  action: string;
  responsible: string | null;
  due_date: string | null;
  status: string;
}

export interface PreventiveAction {
  action: string;
  responsible: string | null;
  due_date: string | null;
  status: string;
}

export interface RcaTemplatePrintData {
  rca_number: string;
  incident_number: string;
  incident_date: string;
  incident_summary: string | null;
  rca_initiated_date: string;
  rca_completed_date: string | null;
  team_members: RcaTeamMember[];
  event_timeline: RcaTimelineEntry[];
  five_whys: FiveWhyEntry[];
  fishbone_analysis: FishboneCategory[];
  root_causes_identified: string[];
  contributing_factors: string[];
  proximate_causes: string[];
  system_issues: string[];
  process_gaps: string[];
  human_factors: string[];
  equipment_factors: string[];
  environment_factors: string[];
  corrective_actions: CorrectiveAction[];
  preventive_actions: PreventiveAction[];
  lessons_learned: string[];
  similar_incidents_reviewed: boolean;
  recommendations: string[];
  management_response: string | null;
  follow_up_plan: string | null;
  effectiveness_review_date: string | null;
  lead_investigator: string | null;
  approved_by: string | null;
  approval_date: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface CapaAction {
  action_number: number;
  action_type: string;
  description: string;
  responsible: string | null;
  due_date: string | null;
  completed_date: string | null;
  status: string;
  verification_method: string | null;
  verified_by: string | null;
  verification_date: string | null;
  effectiveness: string | null;
}

export interface CapaFormPrintData {
  capa_number: string;
  source_type: string;
  source_reference: string | null;
  issue_identified: string | null;
  issue_date: string | null;
  issue_category: string | null;
  department_affected: string | null;
  priority: string;
  capa_owner: string | null;
  capa_initiated_date: string;
  target_completion_date: string | null;
  actual_completion_date: string | null;
  root_cause_analysis: string | null;
  actions: CapaAction[];
  total_actions: number;
  completed_actions: number;
  verification_status: string | null;
  effectiveness_criteria: string | null;
  effectiveness_evaluation: string | null;
  capa_status: string;
  closure_remarks: string | null;
  closed_by: string | null;
  closure_date: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface SuspectedDrug {
  drug_name: string;
  brand_name: string | null;
  batch_number: string | null;
  manufacturer: string | null;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  start_date: string | null;
  stop_date: string | null;
  indication: string | null;
  dechallenge: string | null;
  rechallenge: string | null;
}

export interface ConcomitantDrug {
  drug_name: string;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  start_date: string | null;
  indication: string | null;
}

export interface AdrReportPrintData {
  report_number: string;
  pvpi_id: string | null;
  report_type: string;
  initial_or_followup: string;
  report_date: string;
  patient_initials: string | null;
  patient_age: number | null;
  patient_gender: string | null;
  patient_weight_kg: number | null;
  patient_height_cm: number | null;
  pregnancy_status: string | null;
  relevant_history: string | null;
  allergies: string[];
  suspected_drugs: SuspectedDrug[];
  concomitant_drugs: ConcomitantDrug[];
  reaction_onset_date: string | null;
  reaction_description: string | null;
  reaction_severity: string | null;
  seriousness_criteria: string[];
  outcome: string | null;
  outcome_date: string | null;
  causality_assessment: string | null;
  naranjo_score: number | null;
  who_umc_category: string | null;
  action_taken: string | null;
  treatment_given: string | null;
  sequelae: string | null;
  reporter_name: string | null;
  reporter_qualification: string | null;
  reporter_email: string | null;
  reporter_phone: string | null;
  institution_name: string | null;
  institution_address: string | null;
  submitted_to_pvpi: boolean;
  submission_date: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface TransfusionReactionPrintData {
  report_number: string;
  naco_id: string | null;
  report_date: string;
  patient_name: string | null;
  patient_uhid: string | null;
  patient_age: number | null;
  patient_gender: string | null;
  patient_blood_group: string | null;
  patient_rh_type: string | null;
  ward_name: string | null;
  bed_number: string | null;
  transfusion_date: string | null;
  transfusion_start_time: string | null;
  reaction_time: string | null;
  time_to_reaction_minutes: number | null;
  product_type: string | null;
  unit_number: string | null;
  donation_date: string | null;
  component_age_days: number | null;
  donor_blood_group: string | null;
  volume_transfused_ml: number | null;
  indication_for_transfusion: string | null;
  reaction_type: string | null;
  reaction_severity: string | null;
  imputability: string | null;
  signs_symptoms: string[];
  vital_signs_at_reaction: string | null;
  immediate_actions: string[];
  treatment_given: string | null;
  transfusion_stopped: boolean;
  unit_returned: boolean;
  samples_collected: string[];
  lab_investigations: string[];
  investigation_findings: string | null;
  final_diagnosis: string | null;
  outcome: string | null;
  sequelae: string | null;
  preventability: string | null;
  similar_previous_reactions: boolean;
  blood_bank_notified: boolean;
  blood_bank_notification_time: string | null;
  reported_by: string | null;
  reported_to: string | null;
  hemovigilance_officer: string | null;
  submitted_to_naco: boolean;
  submission_date: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

// ══════════════════════════════════════════════════════════
// Phase 4: Clinical Delivery Print Data
// ══════════════════════════════════════════════════════════

export interface OpdPrescriptionPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  phone: string | null;
  address: string | null;
  vitals: Record<string, string>;
  doctor_name: string;
  doctor_qualification: string | null;
  doctor_registration: string | null;
  department: string | null;
  encounter_date: string;
  encounter_time: string;
  chief_complaints: string[];
  diagnosis: string[];
  medications: PrescriptionMedication[];
  investigations: string[];
  advice: string | null;
  follow_up_date: string | null;
  follow_up_instructions: string | null;
  refer_to: string | null;
  hospital_name: string;
  hospital_address: string | null;
  hospital_phone: string | null;
  hospital_logo_url: string | null;
}

export interface PrescriptionMedication {
  drug_name: string;
  generic_name: string | null;
  strength: string | null;
  form: string | null;
  route: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string | null;
  timing: string | null;
  is_prn: boolean;
}

export interface LabReportFullPrintData {
  report_number: string;
  report_date: string;
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  phone: string | null;
  sample_type: string | null;
  sample_id: string | null;
  collection_date: string | null;
  collection_time: string | null;
  received_date: string | null;
  report_time: string | null;
  referring_doctor: string | null;
  department: string | null;
  test_name: string;
  test_code: string | null;
  parameters: LabParameter[];
  interpretation: string | null;
  comments: string | null;
  pathologist_name: string | null;
  pathologist_registration: string | null;
  pathologist_signature_url: string | null;
  verified_by: string | null;
  verified_at: string | null;
  is_critical: boolean;
  critical_values: string[];
  nabl_logo: boolean;
  nabl_certificate_number: string | null;
  hospital_name: string;
  hospital_address: string | null;
  hospital_logo_url: string | null;
  barcode_data: string | null;
}

export interface LabParameter {
  parameter_name: string;
  result: string;
  unit: string | null;
  reference_range: string | null;
  flag: string | null;
  is_critical: boolean;
}

export interface CumulativeLabReportPrintData {
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  report_date: string;
  date_range: string;
  test_name: string;
  parameters: CumulativeLabParameter[];
  trend_summary: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface CumulativeLabParameter {
  parameter_name: string;
  unit: string | null;
  reference_range: string | null;
  results: CumulativeResult[];
}

export interface CumulativeResult {
  date: string;
  value: string;
  flag: string | null;
}

export interface RadiologyReportFullPrintData {
  report_number: string;
  report_date: string;
  patient_name: string;
  uhid: string;
  age: string | null;
  gender: string;
  modality: string;
  study_description: string;
  accession_number: string | null;
  study_date: string;
  study_time: string | null;
  referring_doctor: string | null;
  department: string | null;
  clinical_history: string | null;
  technique: string | null;
  findings: string;
  impression: string;
  recommendations: string | null;
  key_images: KeyImage[];
  radiologist_name: string | null;
  radiologist_registration: string | null;
  radiologist_signature_url: string | null;
  verified_at: string | null;
  is_critical: boolean;
  critical_findings: string | null;
  hospital_name: string;
  hospital_address: string | null;
  hospital_logo_url: string | null;
}

export interface KeyImage {
  image_url: string;
  caption: string | null;
  sequence_number: number;
}

// ══════════════════════════════════════════════════════════
// Phase 4: Regulatory Print Data
// ══════════════════════════════════════════════════════════

// NABH KPI rollup: official 2025 KPI catalog plus live aggregates where
// source data is already wired. Coverage delta is reported alongside.
export interface NabhIndicator {
  code: string;
  label: string;
  category: "access" | "clinical" | "safety" | "experience" | "operations";
  direction: "higher_better" | "lower_better";
  unit: "minutes" | "hours" | "percent" | "count" | "days";
  target: number | null;
  value_current_month: number | null;
  value_prev_month: number | null;
  denominator_label: string | null;
  note: string | null;
}

export interface NabhCoverage {
  total_indicators: number;
  computed: number;
  pending_data_capture: number;
  note: string;
}

export interface NabhRollupResponse {
  generated_at: string;
  period_label: string;
  indicators: NabhIndicator[];
  coverage: NabhCoverage;
}

export interface NabhQualityReportPrintData {
  report_period: string;
  report_date: string;
  hospital_name: string;
  nabh_certificate_number: string | null;
  accreditation_valid_until: string | null;
  indicators: QualityIndicator[];
  summary: QualitySummary;
  action_items: string[];
  prepared_by: string | null;
  reviewed_by: string | null;
  hospital_logo_url: string | null;
}

export interface QualityIndicator {
  indicator_code: string;
  indicator_name: string;
  category: string;
  numerator: number;
  denominator: number;
  rate: number;
  benchmark: number | null;
  status: string;
  trend: string | null;
}

export interface QualitySummary {
  total_indicators: number;
  met_benchmark: number;
  below_benchmark: number;
  not_applicable: number;
}

export interface NmcComplianceReportPrintData {
  report_period: string;
  report_date: string;
  hospital_name: string;
  registration_number: string | null;
  compliance_sections: ComplianceSection[];
  overall_compliance_percentage: number;
  non_compliance_items: string[];
  corrective_actions: string[];
  prepared_by: string | null;
  hospital_logo_url: string | null;
}

export interface ComplianceSection {
  section_name: string;
  total_items: number;
  compliant_items: number;
  partial_items: number;
  non_compliant_items: number;
  compliance_percentage: number;
}

export interface NablQualityReportPrintData {
  report_period: string;
  report_date: string;
  lab_name: string;
  nabl_certificate_number: string | null;
  scope_of_accreditation: string | null;
  valid_until: string | null;
  internal_qc_results: InternalQcResult[];
  eqa_results: EqaResult[];
  proficiency_testing: ProficiencyTestResult[];
  non_conformances: NonConformance[];
  prepared_by: string | null;
  quality_manager: string | null;
  hospital_logo_url: string | null;
}

export interface InternalQcResult {
  test_name: string;
  level: string;
  mean: number;
  sd: number;
  cv_percent: number;
  within_limits: boolean;
}

export interface EqaResult {
  program_name: string;
  analyte: string;
  our_result: string;
  target_value: string;
  z_score: number | null;
  performance: string;
}

export interface ProficiencyTestResult {
  survey_name: string;
  date: string;
  score_percent: number;
  status: string;
}

export interface NonConformance {
  date: string;
  description: string;
  root_cause: string | null;
  corrective_action: string | null;
  status: string;
}

export interface SpcbBmwReturnsPrintData {
  quarter: string;
  year: number;
  report_date: string;
  hospital_name: string;
  authorization_number: string | null;
  valid_until: string | null;
  category_wise_generation: BmwCategoryData[];
  total_waste_kg: number;
  disposal_details: BmwDisposalDetail[];
  cbwtf_details: CbwtfDetail | null;
  incidents: string[];
  prepared_by: string | null;
  authorized_signatory: string | null;
  hospital_logo_url: string | null;
}

export interface BmwCategoryData {
  category: string;
  color_code: string;
  quantity_kg: number;
  treatment_method: string;
}

export interface BmwDisposalDetail {
  date: string;
  category: string;
  quantity_kg: number;
  collected_by: string;
  manifest_number: string | null;
}

export interface CbwtfDetail {
  name: string;
  authorization_number: string | null;
  address: string | null;
  contact: string | null;
}

export interface PesoComplianceReportPrintData {
  report_year: number;
  report_date: string;
  hospital_name: string;
  peso_license_number: string | null;
  license_valid_until: string | null;
  medical_gas_systems: MedicalGasSystem[];
  cylinder_storage: CylinderStorage;
  safety_inspections: SafetyInspection[];
  incidents: GasIncident[];
  compliance_status: string;
  prepared_by: string | null;
  hospital_logo_url: string | null;
}

export interface MedicalGasSystem {
  gas_type: string;
  source_type: string;
  location: string;
  capacity: string;
  last_tested: string | null;
  next_test_due: string | null;
  status: string;
}

export interface CylinderStorage {
  total_capacity: number;
  oxygen_cylinders: number;
  nitrous_oxide_cylinders: number;
  co2_cylinders: number;
  other_cylinders: number;
  storage_compliant: boolean;
}

export interface SafetyInspection {
  inspection_date: string;
  inspector: string;
  findings: string;
  status: string;
}

export interface GasIncident {
  incident_date: string;
  gas_type: string;
  description: string;
  action_taken: string;
}

export interface DrugLicenseReportPrintData {
  report_date: string;
  hospital_name: string;
  drug_license_number: string;
  license_type: string;
  valid_from: string;
  valid_until: string;
  licensing_authority: string;
  registered_pharmacist: string | null;
  registration_number: string | null;
  authorized_categories: string[];
  controlled_substance_license: string | null;
  storage_conditions_compliant: boolean;
  inspection_history: DrugInspection[];
  current_stock_summary: DrugStockCategory[];
  expiry_alerts: ExpiryAlert[];
  hospital_logo_url: string | null;
}

export interface DrugInspection {
  inspection_date: string;
  inspector_name: string;
  findings: string;
  compliance_status: string;
}

export interface DrugStockCategory {
  category: string;
  total_items: number;
  total_value: number;
}

export interface ExpiryAlert {
  drug_name: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  days_to_expiry: number;
}

export interface PcpndtReportPrintData {
  report_period: string;
  report_date: string;
  hospital_name: string;
  registration_number: string;
  registration_valid_until: string;
  appropriate_authority: string;
  registered_equipment: PcpndtEquipment[];
  qualified_personnel: PcpndtPersonnel[];
  procedures_performed: PcpndtProcedure[];
  form_f_compliance: FormFCompliance;
  inspections: PcpndtInspection[];
  declaration_text: string;
  signatory_name: string;
  signatory_designation: string;
  hospital_logo_url: string | null;
}

export interface PcpndtEquipment {
  equipment_name: string;
  registration_number: string;
  location: string;
}

export interface PcpndtPersonnel {
  name: string;
  qualification: string;
  registration_number: string;
  role: string;
}

export interface PcpndtProcedure {
  procedure_type: string;
  total_count: number;
  male_fetus: number;
  female_fetus: number;
  indeterminate: number;
}

export interface FormFCompliance {
  total_forms: number;
  complete_forms: number;
  incomplete_forms: number;
  compliance_percentage: number;
}

export interface PcpndtInspection {
  date: string;
  authority: string;
  findings: string;
  status: string;
}

export interface BirthRegisterPrintData {
  report_period: string;
  report_date: string;
  hospital_name: string;
  hospital_code: string | null;
  municipal_area: string | null;
  entries: BirthRegisterEntry[];
  total_births: number;
  male_births: number;
  female_births: number;
  live_births: number;
  still_births: number;
  prepared_by: string | null;
  verified_by: string | null;
  hospital_logo_url: string | null;
}

export interface BirthRegisterEntry {
  serial_number: number;
  registration_number: string;
  date_of_birth: string;
  time_of_birth: string;
  gender: string;
  birth_weight_grams: number;
  birth_type: string;
  mother_name: string;
  mother_age: number;
  father_name: string;
  address: string;
  delivery_type: string;
  attending_doctor: string;
}

export interface DeathRegisterPrintData {
  report_period: string;
  report_date: string;
  hospital_name: string;
  hospital_code: string | null;
  municipal_area: string | null;
  entries: DeathRegisterEntry[];
  total_deaths: number;
  male_deaths: number;
  female_deaths: number;
  mlc_cases: number;
  prepared_by: string | null;
  verified_by: string | null;
  hospital_logo_url: string | null;
}

export interface DeathRegisterEntry {
  serial_number: number;
  registration_number: string;
  date_of_death: string;
  time_of_death: string;
  deceased_name: string;
  age: string;
  gender: string;
  address: string;
  cause_of_death: string;
  icd_code: string | null;
  certifying_doctor: string;
  mlc_case: boolean;
}

export interface MlcRegisterSummaryPrintData {
  report_period: string;
  report_date: string;
  hospital_name: string;
  entries: MlcRegisterSummaryEntry[];
  total_cases: number;
  by_case_type: MlcCaseTypeCount[];
  by_outcome: MlcOutcomeCount[];
  pending_cases: number;
  prepared_by: string | null;
  hospital_logo_url: string | null;
}

export interface MlcRegisterSummaryEntry {
  serial_number: number;
  mlc_number: string;
  registration_date: string;
  patient_name: string;
  age_gender: string;
  case_type: string;
  police_station: string;
  fir_number: string | null;
  outcome: string;
  current_status: string;
}

export interface MlcCaseTypeCount {
  case_type: string;
  count: number;
}

export interface MlcOutcomeCount {
  outcome: string;
  count: number;
}

export interface AebasAttendanceReportPrintData {
  report_period: string;
  report_date: string;
  hospital_name: string;
  aebas_unit_code: string | null;
  department_summary: DepartmentAttendance[];
  total_employees: number;
  average_attendance_percentage: number;
  total_working_days: number;
  holidays: number;
  prepared_by: string | null;
  hospital_logo_url: string | null;
}

export interface DepartmentAttendance {
  department_name: string;
  total_employees: number;
  average_present: number;
  average_absent: number;
  average_leave: number;
  attendance_percentage: number;
}

export interface NmcNarfAssessmentPrintData {
  assessment_year: number;
  report_date: string;
  hospital_name: string;
  nmc_registration_number: string | null;
  assessment_sections: NarfSection[];
  overall_score: number;
  maximum_score: number;
  percentage: number;
  grade: string;
  strengths: string[];
  areas_for_improvement: string[];
  action_plan: string[];
  assessed_by: string | null;
  verified_by: string | null;
  hospital_logo_url: string | null;
}

export interface NarfSection {
  section_name: string;
  max_score: number;
  achieved_score: number;
  percentage: number;
  criteria: NarfCriterion[];
}

export interface NarfCriterion {
  criterion: string;
  max_marks: number;
  achieved_marks: number;
  evidence: string | null;
}

// ══════════════════════════════════════════════════════════
// Phase 4: Admin & Procurement Print Data
// ══════════════════════════════════════════════════════════

export interface IndentFormPrintData {
  indent_number: string;
  indent_date: string;
  indent_type: string;
  priority: string;
  requesting_department: string;
  requesting_store: string | null;
  requested_by: string;
  items: IndentFormItem[];
  total_items: number;
  estimated_value: number | null;
  justification: string | null;
  approved_by: string | null;
  approved_at: string | null;
  status: string;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface IndentFormItem {
  item_code: string;
  item_name: string;
  specification: string | null;
  unit: string;
  quantity_requested: number;
  quantity_approved: number | null;
  current_stock: number | null;
  remarks: string | null;
}

export interface PurchaseOrderPrintData {
  po_number: string;
  po_date: string;
  vendor_name: string;
  vendor_address: string | null;
  vendor_gstin: string | null;
  vendor_contact: string | null;
  delivery_address: string;
  delivery_date: string | null;
  payment_terms: string | null;
  items: PoItem[];
  subtotal: number;
  discount_percentage: number | null;
  discount_amount: number;
  tax_amount: number;
  freight_charges: number;
  total_amount: number;
  amount_in_words: string;
  terms_and_conditions: string[];
  prepared_by: string | null;
  approved_by: string | null;
  hospital_name: string;
  hospital_address: string | null;
  hospital_gstin: string | null;
  hospital_logo_url: string | null;
}

export interface PoItem {
  item_code: string;
  item_name: string;
  specification: string | null;
  hsn_code: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  amount: number;
}

export interface GrnPrintData {
  grn_number: string;
  grn_date: string;
  po_number: string | null;
  po_date: string | null;
  vendor_name: string;
  vendor_invoice_number: string | null;
  vendor_invoice_date: string | null;
  challan_number: string | null;
  receiving_store: string;
  items: GrnItem[];
  total_items: number;
  total_quantity: number;
  total_value: number;
  quality_check_done: boolean;
  quality_remarks: string | null;
  received_by: string;
  verified_by: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface GrnItem {
  item_code: string;
  item_name: string;
  batch_number: string | null;
  expiry_date: string | null;
  manufacturing_date: string | null;
  unit: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  rejection_reason: string | null;
  unit_price: number;
  amount: number;
}

export interface MaterialIssueVoucherPrintData {
  voucher_number: string;
  voucher_date: string;
  issue_type: string;
  issuing_store: string;
  receiving_department: string;
  receiving_cost_center: string | null;
  requested_by: string;
  items: IssueItem[];
  total_items: number;
  total_value: number;
  purpose: string | null;
  issued_by: string;
  received_by: string | null;
  received_at: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface IssueItem {
  item_code: string;
  item_name: string;
  batch_number: string | null;
  expiry_date: string | null;
  unit: string;
  quantity_requested: number;
  quantity_issued: number;
  unit_price: number;
  amount: number;
}

export interface StockTransferNotePrintData {
  transfer_number: string;
  transfer_date: string;
  from_store: string;
  to_store: string;
  transfer_type: string;
  items: TransferItem[];
  total_items: number;
  total_value: number;
  reason: string | null;
  initiated_by: string;
  dispatched_by: string | null;
  dispatched_at: string | null;
  received_by: string | null;
  received_at: string | null;
  status: string;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface TransferItem {
  item_code: string;
  item_name: string;
  batch_number: string | null;
  expiry_date: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface NdpsRegisterPrintData {
  report_period: string;
  report_date: string;
  store_name: string;
  license_number: string;
  license_valid_until: string;
  opening_balance: NdpsBalance[];
  transactions: NdpsTransaction[];
  closing_balance: NdpsBalance[];
  physical_verification_date: string | null;
  discrepancies: string[];
  register_maintained_by: string;
  verified_by: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface NdpsBalance {
  drug_name: string;
  schedule: string;
  batch_number: string;
  unit: string;
  quantity: number;
}

export interface NdpsTransaction {
  transaction_date: string;
  drug_name: string;
  batch_number: string;
  transaction_type: string;
  quantity: number;
  balance_after: number;
  patient_name: string | null;
  patient_uhid: string | null;
  prescribing_doctor: string | null;
  witness_name: string | null;
  reference_number: string;
}

export interface DrugExpiryAlertPrintData {
  report_date: string;
  store_name: string;
  alert_threshold_days: number;
  expired_drugs: ExpiryDrugItem[];
  expiring_soon: ExpiryDrugItem[];
  total_expired_value: number;
  total_expiring_value: number;
  prepared_by: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface ExpiryDrugItem {
  item_code: string;
  drug_name: string;
  batch_number: string;
  expiry_date: string;
  days_to_expiry: number;
  quantity: number;
  unit: string;
  unit_price: number;
  total_value: number;
  manufacturer: string | null;
  supplier: string | null;
  location: string;
}

export interface EquipmentCondemnationPrintData {
  condemnation_number: string;
  condemnation_date: string;
  equipment_name: string;
  equipment_code: string;
  serial_number: string | null;
  make: string | null;
  model: string | null;
  location: string;
  department: string;
  purchase_date: string | null;
  purchase_value: number | null;
  current_book_value: number | null;
  reason_for_condemnation: string;
  condition_assessment: string;
  inspection_findings: string;
  repair_history: RepairHistoryEntry[];
  total_repair_cost: number;
  disposal_recommendation: string;
  estimated_salvage_value: number | null;
  inspected_by: string;
  recommended_by: string;
  approved_by: string | null;
  approval_date: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface RepairHistoryEntry {
  repair_date: string;
  issue: string;
  action_taken: string;
  cost: number;
  vendor: string | null;
}

export interface WorkOrderPrintData {
  work_order_number: string;
  work_order_date: string;
  work_type: string;
  priority: string;
  requested_by: string;
  requesting_department: string;
  location: string;
  description: string;
  equipment_involved: string | null;
  equipment_code: string | null;
  estimated_hours: number | null;
  estimated_cost: number | null;
  materials_required: WorkOrderMaterial[];
  assigned_to: string | null;
  assigned_team: string | null;
  scheduled_date: string | null;
  completion_date: string | null;
  actual_hours: number | null;
  actual_cost: number | null;
  work_done: string | null;
  status: string;
  verified_by: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface WorkOrderMaterial {
  material_name: string;
  quantity: number;
  unit: string;
  estimated_cost: number;
}

export interface PmChecklistPrintData {
  pm_number: string;
  pm_date: string;
  equipment_name: string;
  equipment_code: string;
  serial_number: string | null;
  location: string;
  department: string;
  last_pm_date: string | null;
  pm_frequency: string;
  checklist_items: PmChecklistItem[];
  overall_condition: string;
  issues_found: string[];
  corrective_actions: string[];
  parts_replaced: PartReplaced[];
  next_pm_due: string | null;
  performed_by: string;
  verified_by: string | null;
  department_head_acknowledgment: string | null;
  hospital_name: string;
  hospital_logo_url: string | null;
}

export interface PmChecklistItem {
  item_number: number;
  check_description: string;
  status: string;
  remarks: string | null;
}

export interface PartReplaced {
  part_name: string;
  part_number: string | null;
  quantity: number;
  reason: string;
}

// ── Specialty Queue Displays ───────────────────────────────────────────────

/** Pharmacy queue token for display */
export interface PharmacyQueueToken {
  token_number: string;
  patient_name: string;
  prescription_count: number;
  status: string;
  counter: number | null;
  estimated_wait_minutes: number | null;
}

/** Pharmacy queue statistics */
export interface PharmacyQueueStats {
  waiting_count: number;
  preparing_count: number;
  ready_count: number;
  dispensed_today: number;
  avg_wait_minutes: number;
}

/** Pharmacy queue display data */
export interface PharmacyQueueDisplay {
  current_token: PharmacyQueueToken | null;
  preparing: PharmacyQueueToken[];
  ready_for_pickup: PharmacyQueueToken[];
  waiting: PharmacyQueueToken[];
  stats: PharmacyQueueStats;
}

/** Lab queue token for display */
export interface LabQueueToken {
  token_number: string;
  patient_name: string;
  test_count: number;
  is_fasting: boolean;
  is_pediatric: boolean;
  status: string;
  counter: number | null;
}

/** Lab queue statistics */
export interface LabQueueStats {
  waiting_count: number;
  collected_today: number;
  avg_wait_minutes: number;
  counters_active: number;
}

/** Lab queue display data */
export interface LabQueueDisplay {
  current_tokens: LabQueueToken[];
  waiting: LabQueueToken[];
  collection_in_progress: LabQueueToken[];
  stats: LabQueueStats;
}

/** Radiology queue token for display */
export interface RadiologyQueueToken {
  token_number: string;
  patient_name: string;
  modality: string;
  room_number: string;
  status: string;
  preparation_instructions: string | null;
}

/** Radiology queue statistics */
export interface RadiologyQueueStats {
  waiting_count: number;
  completed_today: number;
  avg_scan_minutes: number;
}

/** Radiology queue display data */
export interface RadiologyQueueDisplay {
  modality: string;
  room_number: string;
  current_token: RadiologyQueueToken | null;
  waiting: RadiologyQueueToken[];
  stats: RadiologyQueueStats;
}

/** ER triage color codes per Manchester Triage System (for display) */
export type TriageLevelColor = "red" | "orange" | "yellow" | "green" | "blue";

/** ER triage queue token (privacy-safe - no names on display) */
export interface ErTriageToken {
  token_number: string;
  triage_level: TriageLevelColor;
  waiting_minutes: number;
  target_wait_minutes: number;
  is_overdue: boolean;
}

/** ER queue display data */
export interface ErQueueDisplay {
  red: ErTriageToken[];
  orange: ErTriageToken[];
  yellow: ErTriageToken[];
  green: ErTriageToken[];
  blue: ErTriageToken[];
  resuscitation_bays_available: number;
  total_waiting: number;
}

/** Billing queue token for display */
export interface BillingQueueToken {
  token_number: string;
  patient_name: string;
  queue_type: string;
  counter: number | null;
  status: string;
}

/** Billing queue display data */
export interface BillingQueueDisplay {
  opd_billing: BillingQueueToken[];
  ipd_discharge: BillingQueueToken[];
  advance_deposit: BillingQueueToken[];
  insurance_desk: BillingQueueToken[];
}

/** Bed waiting entry for IPD */
export interface BedWaitingEntry {
  patient_name: string;
  ward_type: string;
  priority: string;
  wait_time_minutes: number;
  status: string;
}

/** Bed availability display data */
export interface BedAvailabilityDisplay {
  ward_type: string;
  total_beds: number;
  occupied: number;
  available: number;
  waiting_list: BedWaitingEntry[];
}

/** Queue analytics for a department */
export interface QueueAnalytics {
  department_name: string;
  date: string;
  total_tokens: number;
  completed: number;
  no_shows: number;
  avg_wait_minutes: number;
  peak_hour: number;
  peak_hour_count: number;
}

/** Real-time queue metrics - Note: QueueMetrics already exists at line 15401 */
export interface QueueMetricsRealtime {
  current_waiting: number;
  avg_wait_minutes: number;
  throughput_per_hour: number;
  estimated_wait_new_token: number;
}

// ============================================================================
// PHASE 6: ACADEMIC/SPECIALTY FORMS (Medical College & Branding)
// ============================================================================

export interface SubmittedDocument {
  document_name: string;
  original_submitted: boolean;
  verified: boolean;
}

export interface AdmissionFeeDetails {
  tuition_fee: number;
  hostel_fee: number | null;
  caution_deposit: number;
  total_amount: number;
  payment_mode: string;
  receipt_number: string | null;
}

export interface StudentAdmissionFormPrintData {
  admission_number: string;
  admission_date: string;
  academic_year: string;
  course: string;
  batch_year: number;
  student_name: string;
  date_of_birth: string;
  gender: string;
  photo_url: string | null;
  father_name: string;
  mother_name: string;
  permanent_address: string;
  correspondence_address: string;
  phone: string;
  email: string;
  emergency_contact: string;
  blood_group: string;
  nationality: string;
  category: string;
  admission_quota: string;
  neet_score: number | null;
  neet_rank: number | null;
  qualifying_exam: string;
  qualifying_marks_percent: number;
  documents_submitted: SubmittedDocument[];
  fee_details: AdmissionFeeDetails;
  hostel_opted: boolean;
  medical_fitness_certified: boolean;
  undertaking_signed: boolean;
  college_name: string;
  university_name: string;
  registrar_name: string;
}

export interface InternRotation {
  department: string;
  unit: string | null;
  start_date: string;
  end_date: string;
  duration_days: number;
  posting_type: string;
  supervisor: string;
  status: string;
}

export interface InternRotationSchedulePrintData {
  schedule_id: string;
  academic_year: string;
  intern_name: string;
  intern_registration_number: string;
  batch: string;
  internship_start_date: string;
  internship_end_date: string;
  rotations: InternRotation[];
  total_days: number;
  leave_allowed: number;
  current_posting: InternRotation | null;
  completed_rotations: number;
  pending_rotations: number;
  mentor_name: string;
  coordinator_name: string;
  college_name: string;
}

export interface PgCaseEntry {
  diagnosis: string;
  presenting_complaints: string;
  examination_findings: string;
  investigations: string;
  treatment_given: string;
  learning_points: string;
  case_outcome: string;
}

export interface PgProcedureEntry {
  procedure_name: string;
  indication: string;
  technique: string;
  complications: string | null;
  assisted_or_performed: string;
  count_this_rotation: number;
  cumulative_count: number;
}

export interface PgAcademicEntry {
  activity_type: string;
  topic: string;
  duration_minutes: number;
  feedback_received: string | null;
}

export interface PgLogbookEntryPrintData {
  entry_id: string;
  entry_date: string;
  resident_name: string;
  resident_registration: string;
  course: string;
  department: string;
  year_of_training: number;
  entry_type: string;
  case_details: PgCaseEntry | null;
  procedure_details: PgProcedureEntry | null;
  academic_activity: PgAcademicEntry | null;
  supervisor_name: string;
  supervisor_remarks: string | null;
  verified: boolean;
  verification_date: string | null;
  college_name: string;
}

export interface AssessmentComponent {
  component_name: string;
  marks_obtained: number;
  max_marks: number;
  date: string;
}

export interface InternalAssessmentMarksPrintData {
  assessment_id: string;
  academic_year: string;
  term: string;
  student_name: string;
  roll_number: string;
  course: string;
  year: number;
  subject: string;
  theory_marks: AssessmentComponent[];
  practical_marks: AssessmentComponent[];
  viva_marks: AssessmentComponent | null;
  theory_total: number;
  theory_max: number;
  practical_total: number;
  practical_max: number;
  grand_total: number;
  grand_max: number;
  percentage: number;
  attendance_percent: number;
  eligible_for_exam: boolean;
  remarks: string | null;
  faculty_name: string;
  hod_name: string;
  college_name: string;
}

export interface ExamSubject {
  subject_code: string;
  subject_name: string;
  exam_date: string;
  exam_time: string;
  paper_type: string;
}

export interface ExamHallTicketPrintData {
  hall_ticket_number: string;
  exam_name: string;
  exam_session: string;
  academic_year: string;
  student_name: string;
  roll_number: string;
  photo_url: string | null;
  course: string;
  year: number;
  subjects: ExamSubject[];
  exam_center: string;
  center_address: string;
  reporting_time: string;
  instructions: string[];
  student_signature_required: boolean;
  controller_exam_name: string;
  university_name: string;
  college_name: string;
  issue_date: string;
  barcode: string;
}

export interface OsceTask {
  task_number: number;
  task_description: string;
  max_marks: number;
  marks_obtained: number;
  competency_level: string;
}

export interface OsceGlobalRating {
  communication_skills: number;
  professionalism: number;
  clinical_judgment: number;
  overall_performance: string;
}

export interface OsceScoringSheetPrintData {
  exam_id: string;
  exam_date: string;
  station_number: number;
  station_name: string;
  station_type: string;
  time_allowed_minutes: number;
  candidate_roll: string;
  candidate_name: string;
  clinical_scenario: string;
  tasks: OsceTask[];
  global_rating: OsceGlobalRating | null;
  total_marks: number;
  max_marks: number;
  pass_marks: number;
  examiner_comments: string | null;
  examiner_name: string;
  examiner_signature_date: string;
  college_name: string;
}

export interface SimulationParticipant {
  name: string;
  role_assigned: string;
  course: string;
  year: number;
}

export interface SimulationEvent {
  timestamp_minutes: number;
  event_description: string;
  expected_action: string;
  actual_action: string;
  was_correct: boolean;
}

export interface DebriefingPoint {
  category: string;
  observation: string;
  discussion_summary: string;
}

export interface SimulationDebriefingPrintData {
  session_id: string;
  session_date: string;
  scenario_name: string;
  scenario_type: string;
  duration_minutes: number;
  participants: SimulationParticipant[];
  scenario_objectives: string[];
  events_timeline: SimulationEvent[];
  debriefing_points: DebriefingPoint[];
  key_learning_outcomes: string[];
  areas_for_improvement: string[];
  participant_feedback: string | null;
  facilitator_name: string;
  technician_name: string | null;
  simulation_center: string;
  college_name: string;
}

export interface CmeFaculty {
  name: string;
  designation: string;
  institution: string;
  topic: string;
}

export interface CmeCertificatePrintData {
  certificate_number: string;
  program_name: string;
  program_date: string;
  program_duration_hours: number;
  credit_hours_awarded: number;
  participant_name: string;
  participant_registration: string;
  participant_designation: string;
  participant_institution: string;
  topics_covered: string[];
  faculty_speakers: CmeFaculty[];
  organizing_department: string;
  accreditation_body: string;
  accreditation_number: string;
  organizing_secretary: string;
  dean_name: string;
  college_name: string;
  issue_date: string;
  qr_code_for_verification: string;
}

export interface IecApprovalCertificatePrintData {
  approval_number: string;
  approval_date: string;
  study_title: string;
  principal_investigator: string;
  pi_department: string;
  pi_designation: string;
  co_investigators: string[];
  study_type: string;
  study_design: string;
  sample_size: number;
  study_duration_months: number;
  approval_type: string;
  approval_category: string;
  conditions: string[];
  valid_until: string;
  reporting_requirements: string[];
  ctri_registration: string | null;
  iec_chairman: string;
  member_secretary: string;
  meeting_date: string;
  meeting_number: string;
  institution_name: string;
}

export interface CoInvestigator {
  name: string;
  designation: string;
  department: string;
  institution: string;
  role: string;
}

export interface BudgetSummary {
  personnel: number;
  equipment: number;
  consumables: number;
  travel: number;
  contingency: number;
  total: number;
}

export interface ResearchProposalFormPrintData {
  proposal_id: string;
  submission_date: string;
  project_title: string;
  principal_investigator: string;
  pi_designation: string;
  pi_department: string;
  pi_email: string;
  pi_phone: string;
  co_investigators: CoInvestigator[];
  research_type: string;
  study_design: string;
  objectives: string[];
  background_summary: string;
  methodology_summary: string;
  sample_size: number;
  sample_size_justification: string;
  inclusion_criteria: string[];
  exclusion_criteria: string[];
  outcome_measures: string[];
  statistical_methods: string;
  ethical_considerations: string;
  informed_consent_process: string;
  funding_source: string;
  budget_summary: BudgetSummary;
  timeline_months: number;
  expected_outcomes: string[];
  institution_name: string;
}

export interface HostelFeeDetails {
  room_rent: number;
  mess_charges: number;
  establishment_charges: number;
  electricity_advance: number;
  caution_money: number;
  total: number;
  payment_deadline: string;
}

export interface HostelAllotmentOrderPrintData {
  order_number: string;
  order_date: string;
  academic_year: string;
  student_name: string;
  student_roll: string;
  course: string;
  year: number;
  hostel_name: string;
  room_number: string;
  room_type: string;
  block_wing: string | null;
  floor: number;
  allotment_from: string;
  allotment_to: string;
  mess_facility: boolean;
  mess_type: string | null;
  fee_details: HostelFeeDetails;
  rules_acknowledged: boolean;
  emergency_contact: string;
  emergency_phone: string;
  medical_conditions: string | null;
  warden_name: string;
  chief_warden_name: string;
  college_name: string;
}

export interface AntiRaggingUndertakingPrintData {
  undertaking_number: string;
  date: string;
  academic_year: string;
  student_name: string;
  student_roll: string;
  course: string;
  year: number;
  student_phone: string;
  student_email: string;
  parent_guardian_name: string;
  parent_relationship: string;
  parent_phone: string;
  parent_email: string;
  parent_address: string;
  ugc_regulations_read: boolean;
  consequences_understood: boolean;
  student_declaration: string;
  parent_declaration: string;
  student_signature_date: string;
  parent_signature_date: string;
  aadhar_last_four: string;
  anti_ragging_helpline: string;
  anti_ragging_email: string;
  college_name: string;
}

export interface AccommodationItem {
  accommodation_type: string;
  description: string;
  approved: boolean;
  effective_from: string;
}

export interface DisabilityAccommodationPlanPrintData {
  plan_id: string;
  plan_date: string;
  academic_year: string;
  student_name: string;
  student_roll: string;
  course: string;
  year: number;
  disability_type: string;
  disability_percentage: number;
  disability_certificate_number: string;
  issuing_authority: string;
  functional_limitations: string[];
  accommodations_granted: AccommodationItem[];
  classroom_accommodations: string[];
  examination_accommodations: string[];
  hostel_accommodations: string[] | null;
  assistive_devices_provided: string[];
  support_staff_assigned: string | null;
  review_period_months: number;
  next_review_date: string;
  student_consent: boolean;
  disability_coordinator: string;
  dean_academics_name: string;
  college_name: string;
}

export interface InternshipPosting {
  department: string;
  duration_days: number;
  from_date: string;
  to_date: string;
  supervisor: string;
  satisfactory: boolean;
}

export interface InternshipCompletionCertificatePrintData {
  certificate_number: string;
  issue_date: string;
  intern_name: string;
  intern_registration: string;
  parent_name: string;
  permanent_address: string;
  date_of_birth: string;
  mbbs_pass_year: number;
  mbbs_university: string;
  internship_start_date: string;
  internship_end_date: string;
  total_days: number;
  leave_taken: number;
  extension_days: number;
  postings_completed: InternshipPosting[];
  conduct: string;
  eligible_for_registration: boolean;
  state_medical_council: string;
  principal_name: string;
  principal_registration: string;
  dean_name: string;
  university_name: string;
  college_name: string;
  college_address: string;
}

export interface ServiceBondAgreementPrintData {
  bond_number: string;
  bond_date: string;
  employee_name: string;
  employee_designation: string;
  employee_department: string;
  employee_address: string;
  employee_phone: string;
  date_of_joining: string;
  bond_period_years: number;
  bond_amount: number;
  bond_amount_words: string;
  terms_and_conditions: string[];
  leave_rules: string;
  exit_clause: string;
  penalty_clause: string;
  surety_name: string;
  surety_address: string;
  surety_relationship: string;
  surety_occupation: string;
  witness_1_name: string;
  witness_1_address: string;
  witness_2_name: string;
  witness_2_address: string;
  notarization_required: boolean;
  notary_name: string | null;
  notary_date: string | null;
  institution_name: string;
  institution_address: string;
  authorized_signatory: string;
  authorized_designation: string;
}

export interface StipendComponent {
  component_name: string;
  amount: number;
}

export interface StipendPaymentAdvicePrintData {
  advice_number: string;
  payment_month: string;
  payment_year: number;
  payment_date: string;
  recipient_name: string;
  recipient_type: string;
  recipient_registration: string;
  department: string;
  year_of_training: number;
  bank_name: string;
  bank_account: string;
  ifsc_code: string;
  earnings: StipendComponent[];
  deductions: StipendComponent[];
  gross_stipend: number;
  total_deductions: number;
  net_payable: number;
  attendance_days: number;
  leave_days: number;
  working_days_in_month: number;
  arrears: number;
  remarks: string | null;
  prepared_by: string;
  verified_by: string;
  approved_by: string;
  institution_name: string;
}

export interface HospitalRegistration {
  registration_type: string;
  registration_number: string;
  valid_until: string | null;
}

export interface HospitalBrandingPrintData {
  hospital_name: string;
  hospital_tagline: string | null;
  logo_url: string;
  logo_position: string;
  logo_size: string;
  secondary_logo_url: string | null;
  header_style: string;
  header_background_color: string | null;
  header_text_color: string | null;
  footer_style: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  pincode: string;
  phone_numbers: string[];
  email: string;
  website: string | null;
  registration_numbers: HospitalRegistration[];
  accreditations: string[];
  iso_certifications: string[];
  nabh_accredited: boolean;
  nabl_accredited: boolean;
  jci_accredited: boolean;
  watermark_text: string | null;
  watermark_opacity: number;
  footer_disclaimer: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Multi-Hospital Management Types
// ══════════════════════════════════════════════════════════════════════════════

// Hospital Groups (Chains)
export interface HospitalGroup {
  id: string;
  code: string;
  name: string;
  display_name: string | null;
  headquarters_address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  primary_color: string | null;
  config: Record<string, unknown>;
  default_currency: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateHospitalGroup {
  code: string;
  name: string;
  display_name?: string;
  headquarters_address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
  primary_color?: string;
  default_currency?: string;
  timezone?: string;
}

export interface UpdateHospitalGroup {
  name?: string;
  display_name?: string;
  headquarters_address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo_url?: string;
  primary_color?: string;
  default_currency?: string;
  timezone?: string;
  is_active?: boolean;
}

// Hospital Regions
export interface HospitalRegion {
  id: string;
  group_id: string;
  code: string;
  name: string;
  country: string;
  states: string[] | null;
  regional_head_name: string | null;
  regional_head_email: string | null;
  regional_head_phone: string | null;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateHospitalRegion {
  group_id: string;
  code: string;
  name: string;
  country?: string;
  states?: string[];
  regional_head_name?: string;
  regional_head_email?: string;
  regional_head_phone?: string;
}

// Hospital in Group
export interface HospitalInGroup {
  id: string;
  code: string;
  name: string;
  group_id: string | null;
  region_id: string | null;
  branch_code: string | null;
  is_headquarters: boolean;
  city: string | null;
  state: string | null;
}

export interface AssignHospitalToGroup {
  tenant_id: string;
  group_id: string;
  region_id?: string;
  branch_code?: string;
  is_headquarters?: boolean;
}

// Cross-Hospital User Assignments
export interface UserHospitalAssignment {
  id: string;
  user_id: string;
  tenant_id: string;
  role: string;
  permissions: unknown[];
  is_primary: boolean;
  is_active: boolean;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithAssignments {
  user_id: string;
  username: string;
  full_name: string;
  email: string;
  assignments: UserHospitalAssignment[];
}

export interface CreateUserHospitalAssignment {
  user_id: string;
  tenant_id: string;
  role: string;
  permissions?: string[];
  is_primary?: boolean;
  valid_from?: string;
  valid_to?: string;
}

// Patient Transfers
export type TransferStatus =
  | "requested"
  | "approved"
  | "in_transit"
  | "received"
  | "cancelled"
  | "rejected";

export interface PatientTransfer {
  id: string;
  source_tenant_id: string;
  dest_tenant_id: string;
  patient_id: string;
  admission_id: string | null;
  transfer_type: string;
  reason: string;
  clinical_summary: string | null;
  priority: string;
  status: TransferStatus;
  requested_at: string;
  approved_at: string | null;
  departed_at: string | null;
  arrived_at: string | null;
  requested_by: string;
  approved_by: string | null;
  received_by: string | null;
  transport_mode: string | null;
  transport_details: Record<string, unknown>;
  documents: unknown[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientTransferDisplay {
  id: string;
  source_hospital_name: string;
  dest_hospital_name: string;
  patient_name: string;
  uhid: string;
  transfer_type: string;
  reason: string;
  priority: string;
  status: TransferStatus;
  requested_at: string;
  requested_by_name: string;
}

export interface CreatePatientTransfer {
  dest_tenant_id: string;
  patient_id: string;
  admission_id?: string;
  transfer_type?: string;
  reason: string;
  clinical_summary?: string;
  priority?: string;
  transport_mode?: string;
}

export interface UpdateTransferStatus {
  status: TransferStatus;
  notes?: string;
}

// Stock Transfers
export type StockTransferStatus =
  | "requested"
  | "approved"
  | "dispatched"
  | "in_transit"
  | "received"
  | "cancelled";

export interface StockTransfer {
  id: string;
  source_tenant_id: string;
  dest_tenant_id: string;
  transfer_number: string;
  status: StockTransferStatus;
  priority: string;
  requested_at: string;
  approved_at: string | null;
  dispatched_at: string | null;
  received_at: string | null;
  requested_by: string;
  approved_by: string | null;
  dispatched_by: string | null;
  received_by: string | null;
  request_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockTransferItem {
  id: string;
  transfer_id: string;
  item_id: string;
  item_type: string;
  item_code: string;
  item_name: string;
  batch_number: string | null;
  expiry_date: string | null;
  requested_qty: number;
  approved_qty: number | null;
  dispatched_qty: number | null;
  received_qty: number | null;
  unit: string;
  unit_price: number | null;
  created_at: string;
}

export interface CreateStockTransferItem {
  item_id: string;
  item_type?: string;
  item_code: string;
  item_name: string;
  batch_number?: string;
  expiry_date?: string;
  requested_qty: number;
  unit: string;
  unit_price?: number;
}

export interface CreateStockTransfer {
  dest_tenant_id: string;
  priority?: string;
  request_reason?: string;
  items: CreateStockTransferItem[];
}

// Group KPIs & Dashboard
export interface GroupKpiSnapshot {
  id: string;
  group_id: string;
  tenant_id: string | null;
  snapshot_date: string;
  snapshot_type: string;
  total_beds: number | null;
  occupied_beds: number | null;
  occupancy_pct: number | null;
  opd_visits: number | null;
  new_patients: number | null;
  admissions: number | null;
  discharges: number | null;
  gross_revenue: number | null;
  net_revenue: number | null;
  collections: number | null;
  avg_los: number | null;
  mortality_rate: number | null;
  readmission_rate: number | null;
  infection_rate: number | null;
  metrics: Record<string, unknown>;
  created_at: string;
}

export interface HospitalKpiSummary {
  tenant_id: string;
  hospital_name: string;
  branch_code: string | null;
  region_name: string | null;
  total_beds: number;
  occupied_beds: number;
  occupancy_pct: number;
  opd_visits: number;
  admissions: number;
  revenue: number;
  avg_los: number;
}

export interface GroupDashboard {
  group_id: string;
  group_name: string;
  hospitals: HospitalKpiSummary[];
  total_beds: number;
  total_occupied: number;
  overall_occupancy_pct: number;
  total_opd_visits: number;
  total_admissions: number;
  total_revenue: number;
  snapshot_date: string;
}

// Doctor Rotation
export interface DoctorRotationSchedule {
  id: string;
  group_id: string;
  doctor_id: string;
  schedule_date: string;
  tenant_id: string;
  department_id: string | null;
  shift: string;
  start_time: string | null;
  end_time: string | null;
  is_locum: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctorRotationDisplay {
  id: string;
  doctor_name: string;
  doctor_specialty: string | null;
  hospital_name: string;
  department_name: string | null;
  schedule_date: string;
  shift: string;
  start_time: string | null;
  end_time: string | null;
  is_locum: boolean;
}

export interface CreateDoctorRotation {
  doctor_id: string;
  schedule_date: string;
  tenant_id: string;
  department_id?: string;
  shift?: string;
  start_time?: string;
  end_time?: string;
  is_locum?: boolean;
  notes?: string;
}

// Group Masters
export interface GroupDrugMaster {
  id: string;
  group_id: string;
  code: string;
  name: string;
  generic_name: string | null;
  manufacturer: string | null;
  drug_schedule: string | null;
  atc_code: string | null;
  formulation: string | null;
  strength: string | null;
  unit: string | null;
  hsn_code: string | null;
  gst_rate: number | null;
  is_controlled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupTestMaster {
  id: string;
  group_id: string;
  code: string;
  name: string;
  category: string | null;
  department: string | null;
  loinc_code: string | null;
  sample_type: string | null;
  container_type: string | null;
  volume_required: string | null;
  tat_hours: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GroupTariffMaster {
  id: string;
  group_id: string;
  service_code: string;
  service_name: string;
  category: string | null;
  base_price: number;
  gst_applicable: boolean;
  gst_rate: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HospitalPriceOverride {
  id: string;
  tenant_id: string;
  group_tariff_id: string;
  override_price: number;
  effective_from: string;
  effective_to: string | null;
  reason: string | null;
  approved_by: string | null;
  created_at: string;
}

// Group Templates
export interface GroupTemplate {
  id: string;
  group_id: string;
  template_type: string;
  code: string;
  name: string;
  content: Record<string, unknown>;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGroupTemplate {
  template_type: string;
  code: string;
  name: string;
  content: Record<string, unknown>;
}

// ══════════════════════════════════════════════════════════════════════════════
// CMS & Blog Types
// ══════════════════════════════════════════════════════════════════════════════

// Post Status
export type CmsPostStatus =
  | "draft"
  | "pending_review"
  | "pending_medical_review"
  | "approved"
  | "published"
  | "scheduled"
  | "archived";

// Content Type
export type CmsContentType =
  | "article"
  | "quick_post"
  | "opinion"
  | "case_study"
  | "news"
  | "event"
  | "announcement";

// Categories
export interface CmsCategory {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  requires_medical_review: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CmsCategoryWithChildren {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  requires_medical_review: boolean;
  sort_order: number;
  is_active: boolean;
  children: CmsCategoryWithChildren[];
}

export interface CreateCmsCategory {
  parent_id?: string;
  name: string;
  slug?: string;
  description?: string;
  color?: string;
  icon?: string;
  requires_medical_review?: boolean;
  sort_order?: number;
}

export interface UpdateCmsCategory {
  parent_id?: string;
  name?: string;
  slug?: string;
  description?: string;
  color?: string;
  icon?: string;
  requires_medical_review?: boolean;
  sort_order?: number;
  is_active?: boolean;
}

// Tags
export interface CmsTag {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export interface CreateCmsTag {
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateCmsTag {
  name?: string;
  slug?: string;
  description?: string;
}

// Authors
export interface CmsAuthor {
  id: string;
  tenant_id: string;
  user_id: string | null;
  name: string;
  slug: string;
  bio: string | null;
  credentials: string | null;
  designation: string | null;
  avatar_url: string | null;
  website: string | null;
  twitter: string | null;
  linkedin: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCmsAuthor {
  user_id?: string;
  name: string;
  slug?: string;
  bio?: string;
  credentials?: string;
  designation?: string;
  avatar_url?: string;
  website?: string;
  twitter?: string;
  linkedin?: string;
  role?: string;
}

export interface UpdateCmsAuthor {
  name?: string;
  slug?: string;
  bio?: string;
  credentials?: string;
  designation?: string;
  avatar_url?: string;
  website?: string;
  twitter?: string;
  linkedin?: string;
  role?: string;
  is_active?: boolean;
}

// Media Library
export interface CmsMedia {
  id: string;
  tenant_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface CreateCmsMedia {
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  url: string;
  thumbnail_url?: string;
  alt_text?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface UpdateCmsMedia {
  alt_text?: string;
  caption?: string;
}

// Posts
export interface CmsPost {
  id: string;
  tenant_id: string;
  author_id: string;
  category_id: string | null;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  content_type: CmsContentType;
  feature_image_id: string | null;
  feature_image_alt: string | null;
  feature_image_caption: string | null;
  meta_title: string | null;
  meta_description: string | null;
  og_image_id: string | null;
  canonical_url: string | null;
  status: CmsPostStatus;
  is_featured: boolean;
  reading_time_minutes: number | null;
  published_at: string | null;
  scheduled_at: string | null;
  submitted_for_review_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  medical_reviewed_by: string | null;
  medical_reviewed_at: string | null;
  medical_review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CmsPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content_type: CmsContentType;
  status: CmsPostStatus;
  is_featured: boolean;
  reading_time_minutes: number | null;
  feature_image_url: string | null;
  author_name: string;
  category_name: string | null;
  published_at: string | null;
  created_at: string;
}

export interface CmsPostDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  content_type: CmsContentType;
  status: CmsPostStatus;
  is_featured: boolean;
  reading_time_minutes: number | null;
  feature_image: CmsMedia | null;
  og_image: CmsMedia | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  author: CmsAuthor;
  category: CmsCategory | null;
  tags: CmsTag[];
  published_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCmsPost {
  author_id: string;
  category_id?: string;
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  content_type?: CmsContentType;
  feature_image_id?: string;
  feature_image_alt?: string;
  feature_image_caption?: string;
  meta_title?: string;
  meta_description?: string;
  og_image_id?: string;
  canonical_url?: string;
  is_featured?: boolean;
  tag_ids?: string[];
}

export interface UpdateCmsPost {
  category_id?: string;
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  content_type?: CmsContentType;
  feature_image_id?: string;
  feature_image_alt?: string;
  feature_image_caption?: string;
  meta_title?: string;
  meta_description?: string;
  og_image_id?: string;
  canonical_url?: string;
  is_featured?: boolean;
  tag_ids?: string[];
}

// Post Workflow
export interface SubmitPostForReview {
  notes?: string;
}

export type CmsReviewAction = "approve" | "reject" | "request_changes";

export interface ReviewPostAction {
  action: CmsReviewAction;
  notes?: string;
}

export interface SchedulePostRequest {
  scheduled_at: string;
}

// Post Revisions
export interface CmsPostRevision {
  id: string;
  post_id: string;
  revision_number: number;
  title: string;
  content: string;
  excerpt: string | null;
  created_by: string | null;
  created_at: string;
}

// Post Analytics
export interface CmsPostAnalytics {
  id: string;
  title: string;
  slug: string;
  status: CmsPostStatus;
  published_at: string | null;
  author_name: string;
  category_name: string | null;
  total_views: number;
  days_with_views: number;
  last_viewed_at: string | null;
}

export interface CmsDashboardStats {
  total_posts: number;
  published_posts: number;
  draft_posts: number;
  total_views: number;
  total_subscribers: number;
  active_subscribers: number;
  top_posts: CmsPostAnalytics[];
}

// Subscribers
export interface CmsSubscriber {
  id: string;
  tenant_id: string;
  email: string;
  name: string | null;
  status: string;
  confirmation_token: string | null;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
}

export interface CreateCmsSubscriber {
  email: string;
  name?: string;
}

// Static Pages
export interface CmsPage {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  content: string;
  template: string;
  meta_title: string | null;
  meta_description: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCmsPage {
  title: string;
  slug?: string;
  content: string;
  template?: string;
  meta_title?: string;
  meta_description?: string;
  is_published?: boolean;
  sort_order?: number;
}

export interface UpdateCmsPage {
  title?: string;
  slug?: string;
  content?: string;
  template?: string;
  meta_title?: string;
  meta_description?: string;
  is_published?: boolean;
  sort_order?: number;
}

// Site Settings
export interface CmsSettings {
  id: string;
  tenant_id: string;
  site_title: string | null;
  site_tagline: string | null;
  site_description: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  twitter_handle: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
  default_meta_title: string | null;
  default_meta_description: string | null;
  google_analytics_id: string | null;
  posts_per_page: number;
  show_author_bio: boolean;
  enable_comments: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  custom_css: string | null;
  custom_js: string | null;
  custom_head: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UpdateCmsSettings {
  site_title?: string;
  site_tagline?: string;
  site_description?: string;
  logo_url?: string;
  favicon_url?: string;
  twitter_handle?: string;
  facebook_url?: string;
  instagram_url?: string;
  youtube_url?: string;
  linkedin_url?: string;
  default_meta_title?: string;
  default_meta_description?: string;
  google_analytics_id?: string;
  posts_per_page?: number;
  show_author_bio?: boolean;
  enable_comments?: boolean;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  custom_css?: string;
  custom_js?: string;
  custom_head?: string;
}

// Menus
export interface CmsMenu {
  id: string;
  tenant_id: string;
  name: string;
  location: string;
  items: CmsMenuItem[];
  created_at: string;
  updated_at: string;
}

export interface CmsMenuItem {
  id: string;
  label: string;
  url: string | null;
  page_id: string | null;
  target: string | null;
  children: CmsMenuItem[];
}

export interface UpdateCmsMenu {
  name?: string;
  items?: CmsMenuItem[];
}

// Public API Types
export interface CmsPublicPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  content_type: CmsContentType;
  reading_time_minutes: number | null;
  feature_image_url: string | null;
  feature_image_alt: string | null;
  author: CmsPublicAuthor;
  category: CmsPublicCategory | null;
  tags: CmsPublicTag[];
  published_at: string;
}

export interface CmsPublicAuthor {
  name: string;
  slug: string;
  bio: string | null;
  credentials: string | null;
  avatar_url: string | null;
}

export interface CmsPublicCategory {
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
}

export interface CmsPublicTag {
  name: string;
  slug: string;
}

export interface CmsPostList {
  posts: CmsPublicPost[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ══════════════════════════════════════════════════════════════
// IT SECURITY: BREAK-GLASS
// ══════════════════════════════════════════════════════════════

export interface BreakGlassEvent {
  id: string;
  tenant_id: string;
  user_id: string;
  patient_id: string | null;
  reason: string;
  justification: string | null;
  modules_accessed: string[];
  scope_type: string;
  scope_id: string | null;
  requested_modules: string[];
  start_time: string;
  end_time: string | null;
  expires_at: string;
  is_active: boolean;
  ip_address: string | null;
  user_agent: string | null;
  supervisor_id: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  phi_access_count: number;
  last_phi_accessed_at: string | null;
  created_at: string;
}

export interface BreakGlassEventSummary {
  id: string;
  user_id: string;
  user_name: string | null;
  patient_id: string | null;
  patient_name: string | null;
  reason: string;
  scope_type: string;
  scope_id: string | null;
  requested_modules: string[];
  start_time: string;
  end_time: string | null;
  expires_at: string;
  is_active: boolean;
  phi_access_count: number;
  last_phi_accessed_at: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface CreateBreakGlassRequest {
  patient_id?: string;
  scope_type?: string;
  scope_id?: string;
  requested_modules?: string[];
  expires_in_minutes?: number;
  reason: string;
  justification?: string;
}

export interface EndBreakGlassRequest {
  modules_accessed: string[];
}

export interface ReviewBreakGlassRequest {
  review_notes?: string;
}

export interface BreakGlassQuery {
  user_id?: string;
  patient_id?: string;
  is_active?: boolean;
  reviewed?: boolean;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

// ══════════════════════════════════════════════════════════════
// IT SECURITY: CLINICAL ACCESS MONITOR
// ══════════════════════════════════════════════════════════════

export type SensitivityType =
  | "vip"
  | "celebrity"
  | "employee"
  | "staff_family"
  | "legal"
  | "research"
  | "other";

export interface SensitivePatient {
  id: string;
  tenant_id: string;
  patient_id: string;
  sensitivity_type: string;
  reason: string | null;
  access_restricted_to: string[] | null;
  alert_on_access: boolean;
  notify_users: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SensitivePatientSummary {
  id: string;
  patient_id: string;
  patient_name: string | null;
  sensitivity_type: string;
  reason: string | null;
  alert_on_access: boolean;
  created_at: string;
}

export interface CreateSensitivePatientRequest {
  patient_id: string;
  sensitivity_type: string;
  reason?: string;
  access_restricted_to?: string[];
  alert_on_access?: boolean;
  notify_users?: string[];
}

export interface AccessAlert {
  id: string;
  tenant_id: string;
  patient_id: string;
  patient_name: string | null;
  user_id: string;
  user_name: string | null;
  access_type: string;
  module: string | null;
  ip_address: string | null;
  is_authorized: boolean | null;
  alert_sent: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface AcknowledgeAlertRequest {
  notes?: string;
}

// ══════════════════════════════════════════════════════════════
// IT SECURITY: STOCK DISPOSAL
// ══════════════════════════════════════════════════════════════

export type DisposalMethod =
  | "incineration"
  | "autoclave"
  | "shredding"
  | "chemical"
  | "return_vendor"
  | "donation"
  | "landfill"
  | "other";
export type DisposalStatus = "pending" | "approved" | "in_progress" | "completed" | "cancelled";

export interface StockDisposalRequest {
  id: string;
  tenant_id: string;
  request_number: string;
  store_id: string | null;
  disposal_type: string;
  disposal_method: DisposalMethod | null;
  status: DisposalStatus;
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  executed_by: string | null;
  executed_at: string | null;
  total_value: string | null;
  reason: string | null;
  notes: string | null;
  certificate_number: string | null;
  witness_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockDisposalSummary {
  id: string;
  request_number: string;
  store_name: string | null;
  disposal_type: string;
  status: DisposalStatus;
  requested_by_name: string | null;
  total_value: string | null;
  item_count: number | null;
  created_at: string;
}

export interface StockDisposalItem {
  id: string;
  disposal_id: string;
  item_id: string | null;
  item_name: string;
  item_code: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  quantity: string;
  unit: string;
  unit_cost: string | null;
  total_cost: string | null;
  reason: string | null;
  created_at: string;
}

export interface CreateDisposalRequest {
  store_id?: string;
  disposal_type: string;
  disposal_method?: DisposalMethod;
  reason?: string;
  notes?: string;
  items: CreateDisposalItemRequest[];
}

export interface CreateDisposalItemRequest {
  item_id?: string;
  item_name: string;
  item_code?: string;
  batch_number?: string;
  expiry_date?: string;
  quantity: string;
  unit: string;
  unit_cost?: string;
  reason?: string;
}

export interface ApproveDisposalRequest {
  notes?: string;
}

export interface ExecuteDisposalRequest {
  certificate_number?: string;
  witness_id?: string;
  notes?: string;
}

export interface DisposalQuery {
  store_id?: string;
  disposal_type?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

// ══════════════════════════════════════════════════════════════
// IT SECURITY: TAT TRACKING
// ══════════════════════════════════════════════════════════════

export type TatCategory =
  | "lab"
  | "radiology"
  | "pharmacy"
  | "discharge"
  | "emergency"
  | "opd_wait"
  | "ipd_admission"
  | "surgery"
  | "blood_bank"
  | "other";

export interface TatBenchmark {
  id: string;
  tenant_id: string;
  category: TatCategory;
  sub_category: string | null;
  benchmark_minutes: number;
  warning_minutes: number | null;
  critical_minutes: number | null;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTatBenchmarkRequest {
  category: TatCategory;
  sub_category?: string;
  benchmark_minutes: number;
  warning_minutes?: number;
  critical_minutes?: number;
  department_id?: string;
}

export interface TatRecord {
  id: string;
  tenant_id: string;
  category: TatCategory;
  sub_category: string | null;
  entity_type: string;
  entity_id: string;
  patient_id: string | null;
  department_id: string | null;
  start_time: string;
  end_time: string | null;
  elapsed_minutes: number | null;
  benchmark_minutes: number | null;
  status: string | null;
  breach_reason: string | null;
  created_at: string;
}

export interface TatRecordSummary {
  id: string;
  category: TatCategory;
  sub_category: string | null;
  entity_type: string;
  entity_id: string;
  patient_name: string | null;
  start_time: string;
  end_time: string | null;
  elapsed_minutes: number | null;
  benchmark_minutes: number | null;
  status: string | null;
}

export interface CreateTatRecordRequest {
  category: TatCategory;
  sub_category?: string;
  entity_type: string;
  entity_id: string;
  patient_id?: string;
  department_id?: string;
}

export interface CompleteTatRecordRequest {
  breach_reason?: string;
}

export interface TatAlert {
  id: string;
  tenant_id: string;
  tat_record_id: string;
  alert_type: string;
  notified_users: string[] | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface TatQuery {
  category?: string;
  status?: string;
  department_id?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export interface TatDashboard {
  total_records: number;
  on_track: number;
  warning: number;
  breached: number;
  avg_tat_minutes: number | null;
  breach_rate: number;
  by_category: TatCategoryStats[];
}

export interface TatCategoryStats {
  category: string;
  total: number;
  on_track: number;
  breached: number;
  avg_minutes: number | null;
}

// ══════════════════════════════════════════════════════════════
// IT SECURITY: DATA MIGRATION
// ══════════════════════════════════════════════════════════════

export type MigrationStatus =
  | "pending"
  | "validating"
  | "validated"
  | "importing"
  | "completed"
  | "failed"
  | "cancelled";
export type MigrationDirection = "import" | "export";

export interface DataMigration {
  id: string;
  tenant_id: string;
  direction: MigrationDirection;
  entity_type: string;
  file_name: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  status: MigrationStatus;
  total_records: number | null;
  processed_records: number | null;
  success_count: number | null;
  error_count: number | null;
  warning_count: number | null;
  started_at: string | null;
  completed_at: string | null;
  initiated_by: string;
  error_log: unknown;
  mapping_config: unknown;
  options: unknown;
  created_at: string;
}

export interface CreateMigrationRequest {
  direction: MigrationDirection;
  entity_type: string;
  file_name?: string;
  mapping_config?: unknown;
  options?: unknown;
}

export interface MigrationQuery {
  direction?: string;
  entity_type?: string;
  status?: string;
  page?: number;
  per_page?: number;
}

// ══════════════════════════════════════════════════════════════
// IT SECURITY: EOD DIGEST
// ══════════════════════════════════════════════════════════════

export type DigestFrequency = "daily" | "weekly" | "monthly";

export interface EodDigestSubscription {
  id: string;
  tenant_id: string;
  user_id: string;
  frequency: DigestFrequency;
  delivery_time: string | null;
  delivery_days: number[] | null;
  modules: string[] | null;
  include_summary: boolean;
  include_alerts: boolean;
  include_pending_tasks: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDigestSubscriptionRequest {
  frequency?: DigestFrequency;
  delivery_time?: string;
  delivery_days?: number[];
  modules?: string[];
  include_summary?: boolean;
  include_alerts?: boolean;
  include_pending_tasks?: boolean;
  email_enabled?: boolean;
  push_enabled?: boolean;
}

export interface EodDigestHistory {
  id: string;
  tenant_id: string;
  user_id: string;
  digest_date: string;
  content: unknown;
  sent_at: string | null;
  delivery_status: string | null;
  error_message: string | null;
  created_at: string;
}

// ══════════════════════════════════════════════════════════════
// IT SECURITY: DATA QUALITY
// ══════════════════════════════════════════════════════════════

export type DataQualityCategory =
  | "completeness"
  | "accuracy"
  | "timeliness"
  | "consistency"
  | "duplicates";

export interface DataQualityRule {
  id: string;
  tenant_id: string;
  category: DataQualityCategory;
  entity_type: string;
  field_name: string | null;
  rule_name: string;
  rule_expression: string;
  severity: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDataQualityRuleRequest {
  category: DataQualityCategory;
  entity_type: string;
  field_name?: string;
  rule_name: string;
  rule_expression: string;
  severity?: string;
}

export interface DataQualityIssue {
  id: string;
  tenant_id: string;
  rule_id: string | null;
  category: DataQualityCategory;
  entity_type: string;
  entity_id: string | null;
  field_name: string | null;
  issue_description: string;
  severity: string | null;
  current_value: string | null;
  suggested_value: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface ResolveIssueRequest {
  resolution_notes?: string;
}

export interface DataQualityQuery {
  category?: string;
  entity_type?: string;
  severity?: string;
  is_resolved?: boolean;
  page?: number;
  per_page?: number;
}

export interface DataQualityScore {
  id: string;
  tenant_id: string;
  entity_type: string;
  score_date: string;
  completeness_score: string | null;
  accuracy_score: string | null;
  timeliness_score: string | null;
  consistency_score: string | null;
  overall_score: string | null;
  total_records: number | null;
  issues_found: number | null;
  created_at: string;
}

export interface DataQualityDashboard {
  overall_score: number;
  completeness_score: number;
  accuracy_score: number;
  timeliness_score: number;
  consistency_score: number;
  total_issues: number;
  unresolved_issues: number;
  critical_issues: number;
  by_entity_type: EntityQualityStats[];
}

export interface EntityQualityStats {
  entity_type: string;
  overall_score: number | null;
  total_issues: number;
  unresolved_issues: number;
}

// ══════════════════════════════════════════════════════════════
// IT SECURITY: CERT-IN COMPLIANCE
// ══════════════════════════════════════════════════════════════

export type CertInSeverity = "low" | "medium" | "high" | "critical";
export type CertInStatus =
  | "detected"
  | "investigating"
  | "contained"
  | "eradicated"
  | "recovered"
  | "closed";

export interface CertInIncident {
  id: string;
  tenant_id: string;
  incident_number: string;
  title: string;
  description: string | null;
  incident_type: string;
  severity: CertInSeverity;
  status: CertInStatus;
  detected_at: string;
  detected_by: string | null;
  affected_systems: string[] | null;
  affected_data_types: string[] | null;
  estimated_impact: string | null;
  containment_steps: string | null;
  eradication_steps: string | null;
  recovery_steps: string | null;
  lessons_learned: string | null;
  cert_in_reported: boolean;
  cert_in_report_date: string | null;
  cert_in_reference: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CertInIncidentSummary {
  id: string;
  incident_number: string;
  title: string;
  incident_type: string;
  severity: CertInSeverity;
  status: CertInStatus;
  detected_at: string;
  cert_in_reported: boolean;
  created_at: string;
}

export interface CreateCertInIncidentRequest {
  title: string;
  description?: string;
  incident_type: string;
  severity: CertInSeverity;
  detected_at: string;
  affected_systems?: string[];
  affected_data_types?: string[];
  estimated_impact?: string;
}

export interface UpdateCertInIncidentRequest {
  title?: string;
  description?: string;
  severity?: CertInSeverity;
  status?: CertInStatus;
  containment_steps?: string;
  eradication_steps?: string;
  recovery_steps?: string;
  lessons_learned?: string;
}

export interface ReportToCertInRequest {
  cert_in_reference?: string;
}

export interface CertInIncidentUpdate {
  id: string;
  incident_id: string;
  update_type: string;
  description: string;
  old_status: CertInStatus | null;
  new_status: CertInStatus | null;
  updated_by: string;
  updated_by_name: string | null;
  created_at: string;
}

export interface AddCertInUpdateRequest {
  update_type: string;
  description: string;
}

export interface CertInQuery {
  incident_type?: string;
  severity?: string;
  status?: string;
  cert_in_reported?: boolean;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export interface Vulnerability {
  id: string;
  tenant_id: string;
  cve_id: string | null;
  title: string;
  description: string | null;
  severity: CertInSeverity;
  affected_component: string;
  discovered_at: string;
  discovered_by: string | null;
  remediation_status: string | null;
  remediation_notes: string | null;
  remediation_deadline: string | null;
  remediated_at: string | null;
  remediated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVulnerabilityRequest {
  cve_id?: string;
  title: string;
  description?: string;
  severity: CertInSeverity;
  affected_component: string;
  discovered_at: string;
  discovered_by?: string;
  remediation_deadline?: string;
}

export interface UpdateVulnerabilityRequest {
  remediation_status?: string;
  remediation_notes?: string;
}

export interface ComplianceRequirement {
  id: string;
  tenant_id: string;
  framework: string;
  requirement_code: string;
  requirement_title: string;
  requirement_description: string | null;
  category: string | null;
  is_mandatory: boolean;
  compliance_status: string | null;
  evidence_links: string[] | null;
  last_assessed_at: string | null;
  assessed_by: string | null;
  next_review_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateComplianceRequest {
  compliance_status?: string;
  evidence_links?: string[];
  notes?: string;
  next_review_date?: string;
}

// ══════════════════════════════════════════════════════════════
// IT SECURITY: SYSTEM HEALTH & MONITORING
// ══════════════════════════════════════════════════════════════

export interface SystemHealthMetric {
  id: string;
  tenant_id: string | null;
  metric_name: string;
  metric_value: string;
  metric_unit: string | null;
  component: string;
  status: string | null;
  threshold_warning: string | null;
  threshold_critical: string | null;
  recorded_at: string;
}

export interface SystemHealthDashboard {
  overall_status: string;
  database_status: string;
  api_status: string;
  storage_status: string;
  metrics: SystemHealthMetric[];
}

export interface BackupHistory {
  id: string;
  tenant_id: string | null;
  backup_type: string;
  backup_name: string;
  file_path: string | null;
  file_size_bytes: number | null;
  status: string | null;
  started_at: string;
  completed_at: string | null;
  verification_at: string | null;
  retention_days: number | null;
  expires_at: string | null;
  error_message: string | null;
  created_at: string;
}

// ══════════════════════════════════════════════════════════════
// IT SECURITY: ONBOARDING WIZARD
// ══════════════════════════════════════════════════════════════

export interface ItSecurityOnboardingProgress {
  id: string;
  tenant_id: string;
  wizard_type: string;
  current_step: string;
  completed_steps: string[];
  step_data: unknown;
  is_completed: boolean;
  completed_at: string | null;
  started_by: string | null;
  started_at: string;
  updated_at: string;
}

export interface UpdateItSecurityOnboardingRequest {
  current_step: string;
  step_data?: unknown;
}

export interface CompleteItSecurityOnboardingStepRequest {
  step: string;
  step_data?: unknown;
}

// ══════════════════════════════════════════════════════════════
// IT SECURITY: INCENTIVE CONFIGURATION
// ══════════════════════════════════════════════════════════════

export interface IncentivePlan {
  id: string;
  tenant_id: string;
  plan_name: string;
  plan_code: string;
  description: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  calculation_basis: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateIncentivePlanRequest {
  plan_name: string;
  plan_code: string;
  description?: string;
  effective_from: string;
  effective_to?: string;
  calculation_basis?: string;
}

export interface IncentivePlanRule {
  id: string;
  plan_id: string;
  rule_name: string;
  service_type: string | null;
  department_id: string | null;
  min_threshold: string | null;
  max_threshold: string | null;
  percentage: string | null;
  fixed_amount: string | null;
  multiplier: string | null;
  created_at: string;
}

export interface CreateIncentiveRuleRequest {
  rule_name: string;
  service_type?: string;
  department_id?: string;
  min_threshold?: string;
  max_threshold?: string;
  percentage?: string;
  fixed_amount?: string;
  multiplier?: string;
}

export interface DoctorIncentiveAssignment {
  id: string;
  tenant_id: string;
  doctor_id: string;
  doctor_name: string | null;
  plan_id: string;
  plan_name: string | null;
  effective_from: string;
  effective_to: string | null;
  custom_percentage: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssignIncentivePlanRequest {
  doctor_id: string;
  plan_id: string;
  effective_from: string;
  effective_to?: string;
  custom_percentage?: string;
}

export interface IncentiveCalculation {
  id: string;
  tenant_id: string;
  doctor_id: string;
  doctor_name: string | null;
  plan_id: string;
  period_start: string;
  period_end: string;
  gross_revenue: string | null;
  eligible_revenue: string | null;
  incentive_amount: string | null;
  deductions: string | null;
  net_payable: string | null;
  status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  calculation_details: unknown;
  created_at: string;
  updated_at: string;
}

export interface CalculateIncentiveRequest {
  doctor_id: string;
  period_start: string;
  period_end: string;
}

export interface ApproveIncentiveRequest {
  notes?: string;
}

export interface MarkIncentivePaidRequest {
  payment_reference: string;
}

// ═══════════════════════════════════════════════════════════════
// ── Infrastructure & AI settings ──────────────────────────

export interface InfraStatus {
  /** Active secrets backend: "env" | "file" | "aws-secrets-manager". */
  secrets_backend: string;
  /** Active deploy mode: "saas" | "hybrid" | "onprem". */
  deploy_mode: string;
}

export interface AiSettings {
  provider: string;
  model: string;
  /** Reference (not the value) to the API key in the secret backend. */
  api_key_secret: string | null;
  /** Whether ANTHROPIC_API_KEY is present as a fallback. */
  env_fallback: boolean;
}

export interface UpdateAiSettingsRequest {
  provider: string;
  model: string;
  api_key_secret?: string | null;
}

export interface EmailSettings {
  /** "sendgrid" | "smtp" | "stalwart". */
  provider: string;
  smtp_host: string;
  smtp_port: string;
  smtp_tls: string;
  from_address: string;
  from_name: string;
  smtp_username: string;
  /** Reference (not the value) to the SMTP password in the secret backend. */
  smtp_password_secret: string | null;
  env_fallback: boolean;
}

export interface UpdateEmailSettingsRequest {
  provider: string;
  smtp_host: string;
  smtp_port: string;
  smtp_tls: string;
  from_address: string;
  from_name: string;
  smtp_username: string;
  smtp_password_secret?: string | null;
}

export interface DomainRecordStatus {
  kind: string;
  host: string;
  ok: boolean;
  detail: string;
}

export interface DomainStatus {
  domain: string;
  records: DomainRecordStatus[];
  all_ok: boolean;
}

export interface EmailLogEntry {
  id: string;
  event_type: string;
  recipient: string | null;
  status: string;
  attempts: number;
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
  expires_at: string;
  created_at: string;
}

export interface PublicInvite {
  email: string;
  role: string;
  full_name: string | null;
  hospital_name: string;
}

// ── AI Course Generation ──────────────────────────────────

export interface AiGeneratedCourse {
  title: string;
  description: string;
  category: string;
  duration_hours: number;
  is_mandatory: boolean;
  modules: AiGeneratedModule[];
  quiz: AiGeneratedQuiz;
}

export interface AiGeneratedModule {
  title: string;
  description: string;
  content: Record<string, unknown>;
}

export interface AiGeneratedQuiz {
  title: string;
  pass_percentage: number;
  questions: AiGeneratedQuestion[];
}

export interface AiGeneratedQuestion {
  question_text: string;
  question_type: string;
  options: { key: string; text: string }[];
  correct_answer: string;
  explanation: string;
}

// ── Custom Code (Pipeline Code Execution) ──────────────────

export type CodeLanguage = "expression" | "json_logic" | "lua" | "rust" | "wasm";

export interface CustomCodeSnippet {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  language: CodeLanguage;
  code: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  is_active: boolean;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CodeTestRequest {
  language: CodeLanguage;
  code: string;
  input: Record<string, unknown>;
  timeout_ms?: number;
}

export interface CodeTestResult {
  success: boolean;
  output: unknown;
  duration_ms: number;
  error: string | null;
}

export interface CompileRustRequest {
  code: string;
}

export interface CompileRustResult {
  success: boolean;
  wasm_base64: string | null;
  size_bytes: number;
  error: string | null;
}

export interface AiGenerateCodeRequest {
  prompt: string;
  language: CodeLanguage;
  input_schema: Record<string, unknown>;
  context?: string;
}

export interface AiGeneratedCode {
  code: string;
  output_schema: Record<string, unknown>;
  explanation: string;
}

export interface ExecutionStep {
  id: string;
  execution_id: string;
  node_id: string;
  node_label: string | null;
  step_type: "enter" | "execute" | "retry" | "complete" | "fail" | "skip";
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number | null;
  retry_attempt: number;
  created_at: string;
}

// ── Pharmacy Credit Notes & Store Indents ──────────────────

export type PharmacyCreditNoteType =
  | "customer_return"
  | "supplier_return"
  | "expiry_write_off"
  | "damage";
export type PharmacyCreditNoteStatus = "draft" | "approved" | "settled" | "cancelled";
export type PharmacyStoreIndentStatus =
  | "pending"
  | "approved"
  | "issued"
  | "received"
  | "rejected"
  | "cancelled";

export interface PharmacyCreditNote {
  id: string;
  tenant_id: string;
  credit_note_number: string;
  note_type: PharmacyCreditNoteType;
  reference_type: string | null;
  reference_id: string | null;
  patient_id: string | null;
  vendor_id: string | null;
  items: Array<{
    drug_id: string;
    drug_name: string;
    batch_number: string;
    quantity: number;
    unit_price: number;
    amount: number;
    reason: string;
  }>;
  total_amount: number;
  gst_amount: number;
  net_amount: number;
  status: PharmacyCreditNoteStatus;
  approved_by: string | null;
  approved_at: string | null;
  settled_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePharmacyCreditNoteRequest {
  note_type: PharmacyCreditNoteType;
  reference_type?: string;
  reference_id?: string;
  patient_id?: string;
  vendor_id?: string;
  items: Array<{
    drug_id: string;
    drug_name: string;
    batch_number: string;
    quantity: number;
    unit_price: number;
    amount: number;
    reason: string;
  }>;
  total_amount: number;
  gst_amount?: number;
  notes?: string;
}

export interface PharmacyStoreIndent {
  id: string;
  tenant_id: string;
  indent_number: string;
  from_store_id: string | null;
  to_store_id: string | null;
  status: PharmacyStoreIndentStatus;
  items: Array<{
    item_id?: string;
    name: string;
    quantity: number;
    unit: string;
  }>;
  total_items: number;
  notes: string | null;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  issued_by: string | null;
  issued_at: string | null;
  received_by: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStoreIndentRequest {
  from_store_id?: string;
  to_store_id?: string;
  items: Array<{ item_id?: string; name: string; quantity: number; unit: string }>;
  notes?: string;
}

// ── Pharmacy Drug Recalls ──────────────────────────────────

export interface PharmacyDrugRecall {
  id: string;
  tenant_id: string;
  recall_number: string;
  drug_id: string | null;
  drug_name: string | null;
  batch_numbers: string[];
  reason: string;
  severity: "class_i" | "class_ii" | "class_iii" | null;
  manufacturer_ref: string | null;
  fda_ref: string | null;
  status: "initiated" | "in_progress" | "completed" | "cancelled";
  affected_patients_count: number;
  recalled_quantity: number;
  action_taken: string | null;
  initiated_by: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Pharmacy Destruction Register ──────────────────────────

export interface PharmacyDestructionLog {
  id: string;
  tenant_id: string;
  certificate_number: string;
  destruction_date: string;
  method: "incineration" | "chemical" | "landfill" | "return_to_manufacturer" | "other";
  items: Array<{
    drug_name: string;
    batch_number: string;
    quantity: number;
    value: number;
    expiry_date?: string;
  }>;
  total_quantity: number;
  total_value: number;
  reason: "expired" | "damaged" | "recalled" | "contaminated" | "other";
  witnessed_by: string | null;
  witness_name: string;
  authorized_by: string | null;
  authorization_date: string | null;
  certificate_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

// ── Generic Substitution ───────────────────────────────────

export interface PharmacySubstitute {
  id: string;
  brand_drug_id: string;
  generic_drug_id: string;
  brand_name?: string;
  brand_price?: number;
  generic_name?: string;
  generic_price?: number;
  generic_stock?: number;
  is_therapeutic_equivalent: boolean;
  is_bioequivalent: boolean;
  price_difference: number | null;
  notes: string | null;
}

// ── Payment Transactions ───────────────────────────────────

export type PharmacyPaymentMode =
  | "cash"
  | "card"
  | "upi"
  | "gpay"
  | "phonepe"
  | "paytm"
  | "netbanking"
  | "insurance"
  | "credit"
  | "wallet"
  | "mixed";

export interface PharmacyPaymentTransaction {
  id: string;
  tenant_id: string;
  pos_sale_id: string | null;
  order_id: string | null;
  invoice_id: string | null;
  payment_mode: PharmacyPaymentMode;
  amount: number;
  reference_number: string | null;
  device_terminal_id: string | null;
  upi_transaction_id: string | null;
  card_last_four: string | null;
  card_network: string | null;
  card_approval_code: string | null;
  bank_name: string | null;
  reconciliation_status: "pending" | "matched" | "mismatch" | "manual_verified";
  reconciled_at: string | null;
  reconciled_by: string | null;
  shift_id: string | null;
  counter_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DayReconciliation {
  cash_total: number;
  card_total: number;
  upi_total: number;
  insurance_total: number;
  credit_total: number;
  transactions_count: number;
  matched_total: number;
  pending_total: number;
}

// ── Day Settlement ─────────────────────────────────────────

export interface PharmacyDaySettlement {
  id: string;
  tenant_id: string;
  settlement_date: string;
  counter_id: string | null;
  cash_system: number;
  cash_counted: number;
  cash_difference: number;
  card_system: number;
  card_settled: number;
  upi_system: number;
  upi_matched: number;
  upi_unmatched: number;
  insurance_system: number;
  credit_system: number;
  total_sales: number;
  total_returns: number;
  net_collection: number;
  transactions_count: number;
  returns_count: number;
  status: "open" | "closed" | "verified";
  closed_by: string | null;
  closed_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
}

// ── Notification centre (in-app feed) ──
export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body?: string | null;
  category?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  unread_count: number;
}

export interface UnreadCountResponse {
  unread_count: number;
}

// ── Unified token / queue system ──
export interface ModuleToken {
  id: string;
  module: string;
  scope: string;
  scope_id?: string | null;
  scope_label?: string | null;
  number: string;
  seq: number;
  status: string;
  priority: string;
  patient_id?: string | null;
  patient_name?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  counter_label?: string | null;
  called_at?: string | null;
  served_at?: string | null;
  completed_at?: string | null;
  token_date: string;
  created_at: string;
}

/** Hospital-authored blog post (tenant-scoped — `blog_posts`). */
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body_html: string;
  cover_image_url: string | null;
  status: "draft" | "published" | "archived";
  author_id: string | null;
  author_name: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** List row — omits `body_html` (the reader/editor fetches the full post by id). */
export interface BlogPostListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  status: "draft" | "published" | "archived";
  author_id: string | null;
  author_name: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertBlogInput {
  title: string;
  slug?: string;
  excerpt?: string | null;
  body_html?: string;
  cover_image_url?: string | null;
  status?: "draft" | "published" | "archived";
}

/** Ingested medical news article (global feed — `news_feed_articles`). */
// ── Enterprise SSO (identity providers + AD-group mappings) ──
export interface SsoProvider {
  id: string;
  code: string;
  name: string;
  protocol: "oidc" | "saml";
  is_active: boolean;
  discovery_url: string | null;
  metadata_url: string | null;
  client_id: string | null;
  has_client_secret: boolean;
  group_claim: string;
  default_role: string | null;
  jit_enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateSsoProviderRequest {
  code: string;
  name: string;
  protocol: "oidc" | "saml";
  discovery_url?: string;
  metadata_url?: string;
  client_id?: string;
  client_secret?: string;
  group_claim?: string;
  default_role?: string;
  jit_enabled?: boolean;
  is_active?: boolean;
  config?: Record<string, unknown>;
}

export interface UpdateSsoProviderRequest {
  name?: string;
  discovery_url?: string;
  metadata_url?: string;
  client_id?: string;
  client_secret?: string;
  group_claim?: string;
  default_role?: string;
  jit_enabled?: boolean;
  is_active?: boolean;
  config?: Record<string, unknown>;
}

export interface SsoGroupMapping {
  id: string;
  provider_id: string;
  idp_group: string;
  role_code: string | null;
  access_group_id: string | null;
  created_at: string;
}

/** Non-sensitive provider info for the login page (pre-auth). */
export interface SsoPublicProvider {
  id: string;
  name: string;
  protocol: "oidc" | "saml";
}

export interface CreateSsoGroupMappingRequest {
  idp_group: string;
  role_code?: string;
  access_group_id?: string;
}

export interface NewsFeedArticle {
  id: string;
  topic: string;
  source: string;
  title: string;
  summary: string | null;
  content: string | null;
  url: string;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
}

/** List row — omits `content` (the reader fetches the full article by id). */
export interface NewsFeedListItem {
  id: string;
  topic: string;
  source: string;
  title: string;
  summary: string | null;
  url: string;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
}

export interface IssueTokenInput {
  module: string;
  scope?: string;
  scope_id?: string;
  scope_label?: string;
  priority?: string;
  patient_id?: string;
  patient_name?: string;
  entity_type?: string;
  entity_id?: string;
}

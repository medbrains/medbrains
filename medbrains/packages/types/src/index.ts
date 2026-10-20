// Permissions

import type { Payment, PaymentMode, Receipt } from "./medication-timing";
import type {
  AdditionalSequence,
  OnboardingBedType,
  OnboardingDepartment,
  OnboardingFacility,
  OnboardingLocation,
  OnboardingPaymentMethod,
  OnboardingRole,
  OnboardingService,
  OnboardingTaxCategory,
  OnboardingUser,
} from "./onboarding-store";

export * from "./abdm-dashboard";
export * from "./abdm-hip";
export * from "./abdm-hiu";
export * from "./abdm-integration";
export * from "./abdm-registry";
export * from "./abdm-scan-share";
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
export * from "./admin-forms";
export * from "./ambulance-fleet";
export * from "./analytics-dashboards";
export * from "./approvals";
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
export * from "./blood-bank-phase2";
export * from "./blood-group";
export * from "./care-view";
export type { ClinicalScoreRow, RecordScoreRequest } from "./care-view-scores";
export * from "./cath-lab";
export * from "./chronic-care";
export * from "./clinical-identity-forms";
export * from "./clinical-knowledge-base";
export * from "./clinical-notes";
export * from "./collect";
export * from "./command-center";
export * from "./common";
export * from "./communication-hub";
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
// The procurement indent line owns the name `IndentItem`; the indent-form
// print line is reachable as `IndentFormPrintData["items"][number]`.
export type { IndentItem } from "./dashboard-widget-builder";
export * from "./dashboard-widget-builder";
export * from "./device-binding";
export * from "./device-integration";
export * from "./doctor-payouts";
export * from "./documents-module";
export * from "./emergency";
export * from "./emergency-drug-kits";
export * from "./emergency-request";
export * from "./endoscopy";
export * from "./enterprise-sso";
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
export * from "./field-access-catalogue";
export * from "./field-mapping";
export * from "./form-builder";
export * from "./form-master";
export * from "./form-runtime";
export * from "./form-templates";
export * from "./form-versioning";
export * from "./grn-scan";
export * from "./housekeeping";
export * from "./infection-control";
export * from "./insurance-tpa";
export * from "./ipd-clinical-expansion";
export * from "./ipd-phase2";
export * from "./ipd-phase3a";
export * from "./ipd-post-discharge";
export * from "./locale-units";
export * from "./marketing";
export * from "./maternity-obgyn";
export * from "./medication-timing";
export * from "./message-simulator";
export * from "./mrd";
export * from "./nhcx";
export * from "./notes";
export * from "./nurse-calls";
export * from "./onboarding-masters";
export * from "./onboarding-store";
export * from "./onboarding-workbook";
export * from "./order-sets";
export * from "./org-structure";
export * from "./other-specialties";
export * from "./palliative-mortuary-nuclear";
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
  activeLabOrderIsCollectedForJourney,
  activePatientLabOrderIdForJourney,
  activePatientPharmacyOrderIdForJourney,
  activePatientPharmacyRxQueueIdForJourney,
  activePatientRadiologyOrderIdForJourney,
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
export * from "./patient-registration";
export type { PermissionDef } from "./permissions.js";
export {
  P,
  PERMISSIONS,
  ROLE_TEMPLATES,
} from "./permissions.js";
export * from "./pharmacy-counter-close";
export * from "./pharmacy-credit-indents";
export * from "./pharmacy-delivery";
export * from "./pharmacy-fulfilment";
export * from "./pharmacy-phase2";
export * from "./pharmacy-phase3";
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
export * from "./pharmacy-storefront";
export * from "./pmr-audiology";
export * from "./print-data.generated";
export * from "./procurement-request";
export * from "./psychiatry";
export * from "./queues";
export * from "./regulatory-compliance";
export * from "./schema-registry";
export * from "./screen-layout-zone";
export * from "./screen-system";
export * from "./setup-config";
export * from "./snomed";
export * from "./tenant-facility";
export type {
  BillingQueueLaneDefinition,
  BillingQueueLaneKey,
  MissableToken,
  PortalAppointment,
  PortalInvoice,
  PortalLabReport,
  PortalPrescriptionItem,
  PortalRefill,
  PortalRefillRequest,
  PortalSession,
  PortalTeleconsult,
  PublicAvailableSlot,
  PublicBookableDoctor,
  PublicBookingDirectory,
  PublicBookingRequest,
  PublicBookingResponse,
  PublicTokenLink,
  PublicTokenStatus,
  RoomToken,
  ServiceTimeStats,
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
  TokenPriority,
} from "./token-board-surfaces.js";
export {
  BILLING_QUEUE_LANES,
  currentRoomToken,
  getTokenBoardSurface,
  isTokenBoardStatusValue,
  isTokenBoardSurfaceId,
  MISSED_TOKEN_BOARD_WINDOW_MINUTES,
  recentlyMissedTokens,
  SERVICE_TIME_MIN_SAMPLES,
  TOKEN_BOARD_FAST_REFRESH_MS,
  TOKEN_BOARD_PUBLIC_PRIVACY_NOTICE,
  TOKEN_BOARD_STANDARD_REFRESH_MS,
  TOKEN_BOARD_STATUS_VALUES,
  TOKEN_BOARD_SURFACE_LIST,
  TOKEN_BOARD_SURFACES,
  TOKEN_PRIORITY_LABEL,
  TOKEN_PRIORITY_ORDER,
  TOKEN_PRIORITY_REASON,
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
export * from "./uhi";
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
  /** GST e-invoice reference, when the bill carried one. */
  irn: string | null;
  /** When stock moved. A draft GRN has none. */
  posted_at: string | null;
  posted_by: string | null;
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
  mrp: number | null;
  ptr: number | null;
  free_quantity: number;
  discount_amount: number;
  gst_rate: number | null;
  hsn_code: string | null;
  pharmacy_batch_id: string | null;
  batch_stock_id: string | null;
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
  /** Null when the report was filed anonymously — the reporter is never stored. */
  reported_by: string | null;
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
  /** Null when the report was filed anonymously — the reporter is never stored. */
  reported_by: string | null;
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
  | "nabh_orientation"
  | "chemotherapy_administration";
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
  check_in_location?: PunchLocation | null;
  check_out_location?: PunchLocation | null;
  geofence_flagged: boolean;
  created_at: string;
  updated_at: string;
}

/** What a hospital does with a punch from outside its campus fences. */
export type GeofenceMode = "off" | "flag" | "block";

export type PunchPlace = "inside" | "outside" | "no_location" | "uncertain" | "not_checked";

/** Where a self-service punch was made, judged against the nearest fence. */
export interface PunchLocation {
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  distance_m: number | null;
  inside: boolean | null;
  place: PunchPlace;
  facility_id: string | null;
  facility_name: string | null;
  flagged: boolean;
}

/** The device's fix, sent with a start or end of shift. */
export interface PunchFix {
  latitude: number;
  longitude: number;
  accuracy_m: number;
}

export interface CampusFence {
  id: string;
  code: string;
  name: string;
  facility_type: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius_m: number | null;
}

export interface GeofenceSettings {
  mode: GeofenceMode;
  campuses: CampusFence[];
}

export interface SetCampusFenceRequest {
  latitude: number | null;
  longitude: number | null;
  radius_m: number | null;
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
  check_in_location: PunchLocation | null;
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
  /** Set by start and end of shift: where that punch was made. */
  punch: PunchLocation | null;
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
  /** Mark verified; the server records the caller as verifier. */
  verify?: boolean;
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
  /** Omitted = the caller's own leave; anyone else's needs `hr.leave.manage`. */
  employee_id?: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days?: number;
  is_half_day?: boolean;
  reason?: string;
}
/** One application from a department the caller heads (`GET /hr/me/team-leaves`). */
export interface TeamLeave {
  id: string;
  employee_id: string;
  employee_name: string;
  department_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  reason?: string | null;
}
/** How lab reports reach patients — one hospital-wide setting. */
export interface LabReportDeliveryConfig {
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  auto_dispatch: boolean;
  default_method: string;
}
export interface TeamLeaveResponse {
  is_department_head: boolean;
  leaves: TeamLeave[];
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

/** A visitor pass checked at the gate (`/front-office/passes/scan`). */
export interface VisitorPassCheck {
  /** Lets the holder in now. */
  valid: boolean;
  /** Why not: "revoked", "expired" or "not_yet_valid". */
  reason: string | null;
  pass_number: string;
  visitor_name: string;
  relationship: string | null;
  category: string;
  id_type: string | null;
  id_number: string | null;
  photo_url: string | null;
  ward_name: string | null;
  bed_number: string | null;
  valid_until: string;
  revoked_reason: string | null;
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
  /** Equipment kept out of patient use by an overdue or failed calibration. */
  calibration_locked: number;
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
  /** When it was noticed — every reporting clock starts here. */
  discovered_at: string | null;
  is_cert_in_reportable: boolean;
  is_personal_data_breach: boolean;
  breach_data_categories: string[];
  principals_affected_estimate: number | null;
  cert_in_reported: boolean;
  cert_in_report_date: string | null;
  cert_in_reference: string | null;
  board_intimated_at: string | null;
  board_report_sent_at: string | null;
  board_reference: string | null;
  principals_notified_at: string | null;
  principals_notified_count: number | null;
  /** discovered_at + 6 h, computed by the server when CERT-In reportable. */
  cert_in_due_at: string | null;
  /** discovered_at + 72 h, computed by the server for a personal-data breach. */
  board_due_at: string | null;
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

/** Scan both bands before a baby moves (Code Pink). A mismatch answers 409. */
export interface VerifySecurityBandMatchRequest {
  infant_tag: string;
  /** The mother's band — her UHID. */
  mother_band: string;
  purpose?: "handover" | "nursery_exit" | "discharge" | "feeding";
}

export interface SecurityBandMatchResult {
  matched: boolean;
  tag_id: string;
  infant_patient_id: string;
  mother_patient_id: string;
}

export type SecurityTagEventType =
  | "exit_zone"
  | "zone_breach"
  | "tamper"
  | "band_removed"
  | "low_battery";

export interface RecordSecurityTagEventRequest {
  tag_identifier: string;
  event_type: SecurityTagEventType;
  zone_id?: string;
  location_description?: string;
}

export interface SecurityTagEventResult {
  alert: SecurityTagAlert;
  /** Set when the event raised (or joined) a Code Pink. */
  code_pink_activation_id: string | null;
  deduplicated: boolean;
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

// ── Admin/HR Forms ────────────────────────────────────────────────────────────

// ── Consent Print Data ──────────────────────────────────

// ── Token Slip & Visitor Pass Print Data ─────────────────

// ── Clinical Print Data (Phase 2) ───────────────────────

// ── Identity Print Data (Phase 2) ───────────────────────

// ── Phase 3: Quality & Safety Print Data ──────────────────────────

// ══════════════════════════════════════════════════════════
// Phase 4: Clinical Delivery Print Data
// ══════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════
// Phase 4: Admin & Procurement Print Data
// ══════════════════════════════════════════════════════════

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

// ── Specialty Queue Displays ───────────────────────────────────────────────

/** Pharmacy queue token for display */
/**
 * One station on a camp board: a department, the counters mapped to it, whoever
 * is on duty, and its live queue. Field names mirror the Rust `CampBoardRow`.
 */
/**
 * A service point at a camp — consultation room, lab desk, pharmacy table —
 * and the department it serves. The camp board is built entirely from these.
 */
/** One run of the audit-log tamper-evidence check. */
export interface AuditChainVerification {
  id: string;
  completed_at: string | null;
  rows_checked: number;
  head_hash: string | null;
  /** The row where the chain first failed to verify; null when intact. */
  broken_at: string | null;
  valid: boolean;
  duration_ms: number | null;
  triggered_by: string;
}

/** A camp station a desk can work (`GET /api/tokens/camp-stations`). */
export interface CampStation {
  counter_id: string;
  camp_id: string;
  camp_name: string;
  name: string;
  flow_position: number;
  /** The rooms that call from this step's queue. */
  rooms: string[];
}

export interface CampCounter {
  id: string;
  tenant_id: string;
  camp_id: string;
  counter_type: string;
  counter_name: string;
  capacity_per_hour: number;
  location_label: string | null;
  status: string;
  notes: string | null;
  /** Null until the counter is mapped to a department; unmapped counters never reach the board. */
  department_id: string | null;
  department_name: string | null;
  /** This counter's step in the patient's route; null when not on it. */
  flow_position: number | null;
  created_at: string;
  updated_at: string;
}

export interface AddCampCounterRequest {
  counter_name: string;
  department_id: string;
  counter_type?: string;
  capacity_per_hour?: number;
  location_label?: string;
  notes?: string;
  /** Join an existing step of the camp's route (a second doctor's room). */
  flow_position?: number | null;
}

export interface CampBoardRow {
  department_id: string;
  department: string;
  /** Counters mapped to this department, comma-joined; null if none. */
  counter_name: string | null;
  location_label: string | null;
  /** Summed across the department's counters. */
  capacity_per_hour: number | null;
  /** Doctors rostered to the department and staff rostered to its counters. */
  staff: string[];
  /** Token numbers with a patient in the room; more than one where a counter is staffed by several. */
  serving: string[];
  waiting: number;
  completed: number;
}

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

/** What a processor receives (DPDP Act s.8(2)). */
export type ProcessorDataCategory =
  | "identity"
  | "contact"
  | "clinical"
  | "billing"
  | "images"
  | "staff";

export interface DataProcessor {
  id: string;
  name: string;
  service: string;
  data_categories: ProcessorDataCategory[];
  /** ISO 3166 alpha-2; anything but IN is a transfer abroad (s.16). */
  country: string;
  sub_processor_of: string | null;
  sub_processor_of_name: string | null;
  dpa_reference: string | null;
  dpa_signed_on: string | null;
  dpa_expires_on: string | null;
  status: "active" | "retired";
  notes: string | null;
  dpa_state: "missing" | "expired" | "expiring" | "in_force";
  created_at: string;
}

export interface DataProcessorInput {
  name: string;
  service: string;
  data_categories: ProcessorDataCategory[];
  country: string;
  sub_processor_of?: string;
  dpa_reference?: string;
  dpa_signed_on?: string;
  dpa_expires_on?: string;
  status?: "active" | "retired";
  notes?: string;
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
export type IncidentNoticeKind = "cert_in" | "board_initial" | "board_report" | "principals";

/** Records that a regulatory notice went out. Write-once per kind. */
export interface RecordIncidentNoticeRequest {
  kind: IncidentNoticeKind;
  /** CERT-In / Board acknowledgement number. */
  reference?: string;
  /** When it was sent; defaults to now on the server. */
  sent_at?: string;
  /** How many Data Principals were notified (kind = principals). */
  count?: number;
}

export interface AssessBreachRequest {
  discovered_at: string;
  is_cert_in_reportable: boolean;
  is_personal_data_breach: boolean;
  breach_data_categories: string[];
  principals_affected_estimate?: number | null;
}

export interface SecurityIncidentUpdate {
  id: string;
  incident_id: string;
  update_type: string;
  description: string;
  updated_by: string | null;
  updated_by_name: string | null;
  created_at: string;
}

export interface AddIncidentNoteRequest {
  description: string;
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

/** Proof the hospital controls its custom domain: a DNS TXT record. */
export interface DomainOwnership {
  domain: string;
  /** Where the TXT record goes, e.g. `_medbrains-verify.hms.hospital.com`. */
  record_name: string;
  /** What the TXT record must say. */
  token: string;
  verified_at: string | null;
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
/**
 * One queue row as the clinician working it sees it.
 *
 * The same token the board shows, plus who the patient is. The board's own
 * endpoint carries no name and a test holds it that way; this one is gated on a
 * clinical permission because it carries a name, a UHID and the encounter to
 * open. Two reads of one queue.
 */
export interface WorklistToken {
  id: string;
  number: string;
  seq: number;
  status: string;
  priority: string;
  scope_id: string | null;
  scope_label: string | null;
  counter_label: string | null;
  called_at: string | null;
  created_at: string;
  patient_id: string | null;
  patient_name: string | null;
  uhid: string | null;
  /** Null on a token issued before its encounter existed. */
  encounter_id: string | null;
}

/**
 * The two numbers above a token board.
 *
 * `avg_wait_minutes` is null until somebody has been called today. Render a
 * dash: a waiting room told the average wait is nought minutes at eight in the
 * morning learns something false about the day ahead.
 */
export interface TokenBoardMetrics {
  waiting: number;
  avg_wait_minutes: number | null;
}

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
  /** Groups a visit's tokens so one number carries OPD -> lab -> pharmacy. */
  visit_id?: string | null;
  /**
   * How many this department will call first — priority, then queue position.
   * Only returned by `myTokens`; a shared visit number is unreadable on a board
   * without it.
   */
  ahead?: number;
  called_at?: string | null;
  served_at?: string | null;
  completed_at?: string | null;
  token_date: string;
  created_at: string;
  /** Why this token was escalated, if it was — shown so a patient moved
   *  up does not read as a queue-jump to whoever is still waiting. */
  priority_reason?: string | null;
  priority_changed_at?: string | null;
  /** The configured queue this token belongs to, if any. */
  queue_id?: string | null;
  /** The queue's own name for this token's lane ("Staff"); null for built-in lanes. */
  priority_label?: string | null;
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

// ── Device-code pairing ───────────────────────────────────────────
// For surfaces with no camera to scan a pairing QR with — the display asks
// for a code, an administrator approves it, and the display polls for its JWT.

export interface DeviceCodeResponse {
  /** Shown on the display, grouped as `XXXX-XXXX` for reading aloud. */
  user_code: string;
  /** Secret. Never displayed; the only thing that can claim the approval. */
  device_code: string;
  expires_at: string;
  poll_interval_seconds: number;
}

export interface DeviceTokenResponse {
  status: "pending" | "approved" | "denied" | "expired";
  jwt: string | null;
  paired_device_id: string | null;
  tenant_id: string | null;
  user_id: string | null;
}

/** The board a paired screen shows (`GET /api/device/board`). */
export interface DeviceBoard {
  label: string;
  /** Null for a screen paired before boards were bound: pair it again. */
  module: string | null;
  department_id: string | null;
  department_name: string | null;
}

export interface DevicePairingRequest {
  id: string;
  user_code: string;
  app_variant: string;
  requested_label: string;
  expires_at: string;
  created_at: string;
}

/** What the QR on a printed prescription resolves to. */
export interface VerifiedMedication {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

/**
 * Deliberately carries no full name, phone, address, diagnosis or vitals — a
 * pharmacist already holds the paper with the name on it and needs only to
 * confirm it matches.
 */
export interface VerifiedPrescription {
  hospital_name: string;
  doctor_name: string;
  doctor_registration: string | null;
  patient_initials: string;
  uhid_suffix: string;
  issued_on: string;
  medications: VerifiedMedication[];
  previous_checks: number;
}

/** What a kiosk self-check-in returns. Mirrors KioskCheckinResponse in Rust. */
export interface KioskCheckinResult {
  appointment_id: string;
  patient_name: string;
  doctor_name: string;
  department_name: string;
  token_number: string;
  status: string;
  message: string;
  /**
   * Opaque, expiring handle the patient keeps on their phone to follow this
   * token. It addresses the queue row without exposing it.
   */
  status_token: string;
}

/**
 * A peer-to-peer node key bound to a paired device.
 *
 * The key alone proves possession of a private key and nothing more — see
 * `medbrains-edge::peer_admission` for why that is not an identity.
 */
export interface DeviceNodeKey {
  id: string;
  paired_device_id: string;
  node_id: string;
  revoked_at: string | null;
  last_seen_at: string | null;
  created_at: string;
}

/** One paired device's live node key, as the roster carries it. */
export interface PeerRosterEntry {
  node_id: string;
  paired_device_id: string;
  tenant_id: string;
  app_variant: string;
  revoked: boolean;
}

/**
 * Every live node key in the tenant, as of `issued_at` (epoch seconds).
 *
 * Issued for edge appliances and devices to admit peers offline, and read by
 * the admin UI so one call answers "which devices have a sync key" for a whole
 * fleet instead of one request per row.
 */
export interface PeerRosterDoc {
  tenant_id: string;
  issued_at: number;
  peers: PeerRosterEntry[];
}

// ── API keys ────────────────────────────────────────────────────────────────
//
// A machine credential. Not a user: it carries an explicit permission list
// rather than a role, so it cannot widen when a role does.

export interface ApiKeySummary {
  id: string;
  name: string;
  description: string | null;
  /** The visible leading characters, e.g. `mb_live_a3f2`. Never the secret. */
  key_prefix: string;
  permissions: string[];
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  /** The human who issued it. A machine action traces to a key, the key to a person. */
  created_by_name: string | null;
  /** Requests a minute before the key is answered 429. */
  rate_limit_per_minute: number;
}

/**
 * The only response that ever contains the secret.
 *
 * There is no endpoint that returns it again — only a hash is stored. The UI
 * must show it once and say so plainly, because the alternative is a user who
 * closes the dialog and files a support ticket that cannot be answered.
 */
export interface CreatedApiKey {
  id: string;
  secret: string;
  prefix: string;
  name: string;
  permissions: string[];
  expires_at: string;
  /** Username of the service account this key acts as, as it will appear in audit trails. */
  acts_as: string;
}

/** Where the hospital's events are sent (#224). The secret is never listed. */
export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  event_types: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Returned on create and rotate only: the secret, once. */
export interface WebhookWithSecret extends WebhookSubscription {
  signing_secret: string;
}

export interface WebhookInput {
  name: string;
  url: string;
  event_types: string[];
  is_active?: boolean;
}

export interface WebhookDelivery {
  id: string;
  outbox_event_id: string;
  event_type: string;
  attempt: number;
  status: "delivered" | "retrying" | "failed";
  response_status: number | null;
  error: string | null;
  created_at: string;
}

export interface CreateApiKeyInput {
  name: string;
  description?: string;
  permissions: string[];
  expires_in_days?: number;
  /** Requests a minute; defaults to 600, at most 6000. */
  rate_limit_per_minute?: number;
}

export interface ApiKeyUsageRow {
  method: string;
  path: string;
  status_code: number;
  occurred_at: string;
}

// ── EMI / Installment Payments ──────────────────────────────

export interface PaymentInstallment {
  id: string;
  tenant_id: string;
  invoice_id: string;
  total_amount: number;
  installment_count: number;
  installment_amount: number;
  frequency: string;
  interest_rate: number;
  penalty_rate: number;
  status: "active" | "completed" | "defaulted" | "cancelled";
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  pending_count?: number;
  items?: PaymentInstallmentItem[];
}

export interface PaymentInstallmentItem {
  id: string;
  tenant_id: string;
  installment_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  penalty_amount: number;
  status: "pending" | "paid" | "overdue" | "waived";
  payment_id?: string;
  paid_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PayInstallmentRequest {
  mode: Exclude<PaymentMode, "insurance" | "credit">;
  /** Required for every mode except cash. */
  reference_number?: string;
}

export interface PayInstallmentResponse {
  item: PaymentInstallmentItem;
  payment: Payment;
  receipt: Receipt;
}

export interface CreateInstallmentRequest {
  invoice_id: string;
  installment_count: number;
  frequency?: string;
  interest_rate?: number;
  penalty_rate?: number;
  notes?: string;
}

export type { PermissionGroup } from "./permission-helpers";
export { buildPermissionTree, isValidPermissionCode } from "./permission-helpers";

/** One nurse rostered onto a ward's shift. */
export interface NurseRosterEntry {
  id: string;
  nurse_user_id: string;
  nurse_name: string;
  ward_id: string | null;
  ward_name: string | null;
  shift_date: string;
  shift_type: string;
  primary_assigned: boolean;
  is_charge: boolean | null;
  patient_count: number;
}

export interface CreateNurseRosterEntryRequest {
  nurse_user_id: string;
  ward_id: string;
  shift_type: "day" | "evening" | "night";
  shift_date?: string;
  primary_assigned?: boolean;
  is_charge?: boolean;
}

/** One person who answered a code blue page. */
export interface CodeBlueResponder {
  code_blue_id: string;
  user_id: string;
  user_name: string;
  responded_at: string;
  /** Seconds between the call and this person answering it. */
  seconds_after_call: number;
}

/** An arrest in progress, as the code blue list returns it. */
export interface CodeBlueEventRow {
  id: string;
  patient_id: string;
  encounter_id?: string | null;
  location: string;
  started_at: string;
  ended_at?: string | null;
  outcome?: string | null;
}

/** One emergency code called on the floor — fire, abduction, disaster, and the rest. */
export interface EmergencyCodeActivation {
  id: string;
  code_type: string;
  activated_at: string;
  deactivated_at: string | null;
  location: string | null;
  outcome: string | null;
}

/** A nurse who can be put on a ward's shift. */
export interface NurseRosterCandidate {
  id: string;
  full_name: string;
}

// Tenant / facility / user onboarding types (Tenant, User, Onboarding, Geo, Facilities, Locations) — split from index.ts, barrel-re-exported.

// Tenant
export type HospitalType =
  | "medical_college"
  | "multi_specialty"
  | "district_hospital"
  | "community_health"
  | "primary_health"
  | "standalone_clinic"
  | "eye_hospital"
  | "dental_college";

export interface Tenant {
  id: string;
  code: string;
  name: string;
  hospital_type: HospitalType;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantSummary {
  id: string;
  code: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  registration_no: string | null;
  accreditation: string | null;
  timezone: string;
  locale: string;
  currency: string;
  fy_start_month: number;
  country_id: string | null;
  state_id: string | null;
  district_id: string | null;
  phone_code: string | null;
  /** Hospital's own domain (e.g. hms.apollo.com). Empty string clears it. */
  custom_domain: string | null;
}

/** Public (pre-auth) tenant branding resolved from the request host. */
export interface PublicTenant {
  id: string;
  name: string;
  logo_url: string | null;
  custom_domain: string | null;
}

// User
export type UserRole =
  | "super_admin"
  | "hospital_admin"
  | "doctor"
  | "nurse"
  | "receptionist"
  | "lab_technician"
  | "pharmacist"
  | "billing_clerk"
  | "housekeeping_staff"
  | "facilities_manager"
  | "audit_officer";

export interface User {
  id: string;
  tenant_id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  access_matrix: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SetupUser {
  id: string;
  tenant_id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  specialization: string | null;
  medical_registration_number: string | null;
  qualification: string | null;
  consultation_fee: number | null;
  department_ids: string[];
  access_matrix: Record<string, unknown>;
}

export type IamAccessRequestStatus = "pending" | "approved" | "rejected" | "revoked" | "expired";

export interface IamAccessRequest {
  id: string;
  requester_id: string;
  requester_name: string;
  target_user_id: string;
  target_user_name: string;
  target_role: string;
  requested_permissions: string[];
  requested_modules: string[];
  resource_scope: Record<string, unknown>;
  reason: string;
  requested_expires_at: string | null;
  status: IamAccessRequestStatus;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  applied_at: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateIamAccessRequest {
  target_user_id?: string;
  requested_permissions: string[];
  requested_modules?: string[];
  resource_scope?: Record<string, unknown>;
  reason: string;
  requested_expires_at?: string | null;
}

export interface UserFacilityAssignment {
  id: string;
  tenant_id: string;
  user_id: string;
  facility_id: string;
  is_primary: boolean;
  assigned_at: string;
}

export interface AssignUserFacilitiesRequest {
  facility_ids: string[];
  primary_facility_id?: string;
}

export interface ComplianceRow {
  id: string;
  tenant_id: string;
  facility_id: string;
  regulatory_body_id: string;
  license_number: string | null;
  status: string;
}

// Onboarding
export interface OnboardingStatusResponse {
  needs_setup: boolean;
  tenant_count: number;
}

export interface OnboardingInitRequest {
  hospital_name: string;
  hospital_code: string;
  hospital_type: string;
  admin_username: string;
  admin_email: string;
  admin_password: string;
  admin_full_name: string;
}

export interface OnboardingInitResponse {
  tenant_id: string;
  user_id: string;
  csrf_token: string;
}

export interface OnboardingProgress {
  id: string;
  tenant_id: string;
  current_step: number;
  completed_steps: number[];
  is_complete: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Geo
export interface GeoCountry {
  id: string;
  code: string;
  name: string;
  phone_code: string | null;
  currency: string | null;
  is_active: boolean;
  default_locale: string;
  default_timezone: string;
  date_format: string;
  measurement_system: string;
}

// Facilities
export type FacilityType =
  | "main_hospital"
  | "medical_college"
  | "dental_college"
  | "nursing_college"
  | "pharmacy_college"
  | "ayush_hospital"
  | "research_center"
  | "blood_bank"
  | "dialysis_center"
  | "trauma_center"
  | "burn_center"
  | "rehabilitation_center"
  | "palliative_care"
  | "psychiatric_hospital"
  | "eye_hospital"
  | "maternity_hospital"
  | "pediatric_hospital"
  | "cancer_center"
  | "cardiac_center"
  | "neuro_center"
  | "ortho_center"
  | "day_care_center"
  | "diagnostic_center"
  | "telemedicine_hub"
  | "community_health_center"
  | "primary_health_center"
  | "sub_center"
  | "urban_health_center"
  | "mobile_health_unit"
  | "other";

export interface Facility {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  code: string;
  name: string;
  facility_type: FacilityType;
  status: string;
  address_line1: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  bed_count: number;
  shared_billing: boolean;
  shared_pharmacy: boolean;
  shared_lab: boolean;
  shared_hr: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Locations
export interface LocationRow {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  level: string;
  code: string;
  name: string;
  is_active: boolean;
}

// Onboarding store types — split from index.ts, barrel-re-exported.

import type { ServiceType, TaxApplicability } from "./onboarding-masters";
import type { WorkingHours } from "./org-structure";
import type { FacilityType } from "./tenant-facility";

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

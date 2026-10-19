// ABDM Milestone 4 — HFR (per campus) and HPR (per doctor) registry state.
// Mirrors crates/medbrains-server/src/routes/abdm/{hfr,hpr}.rs.

export type HfrStatus = "not_registered" | "submitted" | "registered" | "verified";

export interface FacilityHfr {
  id: string;
  code: string;
  name: string;
  facility_type: string;
  bed_count: number;
  is_active: boolean;
  hfr_facility_id: string | null;
  hfr_status: HfrStatus;
  hfr_bed_count: number | null;
  hfr_ipd: boolean;
  hfr_checked_at: string | null;
  dhis_eligible: boolean;
}

export interface FacilityHfrList {
  registry_configured: boolean;
  facilities: FacilityHfr[];
}

export interface LinkHfrRequest {
  hfr_facility_id: string | null;
  hfr_bed_count: number | null;
  hfr_ipd: boolean;
}

export interface RegisterHfrRequest {
  ownership: "government" | "private" | "trust";
  state_lgd_code: string;
  district_lgd_code: string;
  pincode: string;
  hfr_bed_count: number | null;
  hfr_ipd: boolean;
  specializations: string[];
}

export interface HfrRegistration {
  id: string;
  facility_id: string | null;
  status: string;
  nha_facility_id: string | null;
  error_message: string | null;
  submitted_at: string;
  updated_at: string;
}

export interface DoctorHpr {
  id: string;
  user_id: string;
  display_name: string;
  mci_number: string | null;
  hpr_id: string | null;
  hpr_verified_at: string | null;
}

export interface HprCoverage {
  registry_configured: boolean;
  active_doctors: number;
  with_hpr_id: number;
  verified: number;
  coverage_percent: number;
  missing: DoctorHpr[];
}

export interface SetHprRequest {
  hpr_id: string | null;
}

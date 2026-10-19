// ABDM management dashboard. Mirrors
// crates/medbrains-server/src/routes/abdm/dashboard.rs and dhis.rs.

import type { AbdmSharingFailure } from "./abdm-hip";
import type { FacilityHfr } from "./abdm-registry";

/** One month's DHIS counts. */
export interface DhisMonth {
  month: string;
  linked_category_1: number;
  linked_category_2: number;
  /** Counted by DHIS: KYC-verified ABHAs, 1 per ABHA a day, 5 a month. */
  eligible_category_1: number;
  eligible_category_2: number;
  hiu_eligible_consents: number;
}

/** What a month would earn — always an estimate; NHA settles the claim. */
export interface DhisEstimate {
  threshold: number;
  eligible_links: number;
  threshold_met: boolean;
  hip_inr: number;
  hiu_inr: number;
  /** hip_inr + hiu_inr once the threshold is met, else 0. */
  payable_inr: number;
}

export interface AbdmDashboardMonth {
  month: string;
  opd_visits: number;
  opd_with_abha: number;
  abha_patients: number;
  kyc_patients: number;
  abhas_created: number;
  shares: number;
  shares_completed: number;
  shares_expired: number;
  hip_consents_granted: number;
  hip_consents_denied: number;
  hip_consents_revoked: number;
  hiu_consents_granted: number;
  hiu_consents_denied: number;
  hiu_consents_revoked: number;
  dhis: DhisMonth;
  estimate: DhisEstimate;
}

export interface AbdmHprCoverage {
  active_doctors: number;
  with_hpr_id: number;
  verified: number;
}

export interface AbdmFailureReason {
  reason: string;
  count: number;
}

export interface AbdmDashboard {
  month: string;
  configured: boolean;
  current: AbdmDashboardMonth;
  /** Oldest first, ending with the chosen month. */
  trend: AbdmDashboardMonth[];
  hpr: AbdmHprCoverage;
  facilities: FacilityHfr[];
  /** Open failures, not the month's: a failure stays until it is retried. */
  failures_open: number;
  failure_reasons: AbdmFailureReason[];
  failures: AbdmSharingFailure[];
}

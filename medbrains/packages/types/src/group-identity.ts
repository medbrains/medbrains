import type { MpiMatchResult } from "./patient-registration";

/** How a record was linked to the same person at another group hospital. */
export type GroupMatchMethod = "abha" | "aadhaar" | "probabilistic" | "manual";

/** The same person's record at another hospital of the group (identity only). */
export interface GroupRecord extends MpiMatchResult {
  link_id: string;
  hospital: string;
  match_method: GroupMatchMethod;
  linked_at: string;
}

/** A probable match waiting for a person to decide. */
export interface GroupCandidate extends MpiMatchResult {
  /** The candidate's id (the record elsewhere is `id`'s patient). */
  candidate_id: string;
  hospital: string;
  status: "pending" | "linked" | "rejected";
  created_at: string;
  /** The record at this hospital the match was found for. */
  local_patient_id: string;
}

export interface GroupIdentity {
  /** The hospital is in a group whose hospitals share records. */
  sharing: boolean;
  group_name: string | null;
  links: GroupRecord[];
  candidates: GroupCandidate[];
}

export interface GroupScanOutcome {
  linked: number;
  queued: number;
}

export interface GroupCandidateDecision {
  decision: "link" | "reject";
  reason?: string;
}

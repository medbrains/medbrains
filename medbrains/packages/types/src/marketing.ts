/**
 * Enquiry-side marketing types, mirroring `crates/medbrains-marketing/src/types.rs`.
 *
 * Everything here is enquiry-level. There is no clinical field on any of these
 * and none should be added: the module's Rust types carry the same warning,
 * because the moment a diagnosis can be serialised out of marketing the wall
 * that migration 0975 describes stops being real.
 */

/** Somebody who asked. They may or may not also be a patient. */
export interface MarketingContact {
  id: string;
  display_name: string | null;
  primary_phone: string | null;
  email: string | null;
  /**
   * Advisory link to a clinical record. Present does not mean reachable —
   * holding a marketing permission never opens a chart.
   */
  patient_id: string | null;
  campaign_id: string | null;
  department_id: string | null;
  source: string;
  stage_id: string | null;
  assigned_to: string | null;
  first_seen_at: string;
  last_contacted_at: string | null;
  consent_call: boolean;
  consent_sms: boolean;
  consent_whatsapp: boolean;
}

/** One line of a contact's timeline. */
export interface MarketingInteraction {
  id: string;
  contact_id: string;
  kind: string;
  channel: string;
  direction: string;
  occurred_at: string;
  answered: boolean | null;
  duration_secs: number | null;
  agent_id: string | null;
  disposition: string | null;
  note: string | null;
  external_ref: string | null;
}

/**
 * Stages are rows rather than an enum, so a dental clinic and an IVF unit can
 * differ without a deployment.
 */
export interface MarketingPipelineStage {
  id: string;
  pipeline_id: string;
  code: string;
  name: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
  sla_minutes: number | null;
}

/** What the desk sees when the phone rings. */
export interface MarketingScreenPop {
  contact: MarketingContact | null;
  is_new_caller: boolean;
  recent: MarketingInteraction[];
  campaign_name: string | null;
  stage_name: string | null;
  open_tasks: number;
}

export interface CreateMarketingContactRequest {
  display_name?: string;
  phone?: string;
  email?: string;
  source?: string;
  campaign_id?: string;
  department_id?: string;
  /** A label on the enquiry, never a way through to the chart. */
  patient_id?: string;
}

export interface ListMarketingContactsQuery {
  stage_id?: string;
  assigned_to?: string;
  campaign_id?: string;
  search?: string;
  limit?: number;
}

export interface MoveMarketingStageRequest {
  stage_id: string;
  note?: string;
}

export interface LogMarketingInteractionRequest {
  kind: string;
  channel: string;
  direction: string;
  disposition?: string;
  note?: string;
  duration_secs?: number;
}

/** A spend line. `spend_minor` is paise, never rupees. */
export interface MarketingCampaign {
  id: string;
  name: string;
  channel: string;
  source: string;
  external_ref: string | null;
  /** Minor units. Money in a float is how a reconciliation stops reconciling. */
  spend_minor: number;
  currency: string;
  started_on: string | null;
  ended_on: string | null;
  is_active: boolean;
}

/**
 * The PUT is a full replace, not a patch: a field left out is written NULL.
 * Always send the whole object back.
 */
export interface UpsertMarketingCampaignRequest {
  name: string;
  channel: string;
  source: string;
  external_ref?: string;
  spend_minor?: number;
  started_on?: string;
  ended_on?: string;
}

/**
 * One row of the funnel.
 *
 * `won` counts contacts on a stage flagged `is_won`, which is how attribution
 * survives a clinic renaming its own stages.
 */
export interface MarketingCampaignFunnelRow {
  campaign_id: string;
  campaign_name: string;
  source: string;
  spend_minor: number;
  enquiries: number;
  contacted: number;
  won: number;
}

/**
 * A batch of messages awaiting a second pair of eyes.
 *
 * `draft` → `pending` → `approved`. Cancellable from draft or pending; an
 * approved run is left alone, because cancelling something part-way through a
 * cohort is a different problem with a different answer.
 */
export interface MarketingOutreachRun {
  id: string;
  cohort_id: string;
  campaign_id: string | null;
  channel: string;
  template_ref: string | null;
  /** The TRAI-registered template id. Without it SMS fails silently at the carrier. */
  dlt_template_id: string | null;
  /** What the recipient will actually read, so the approver approves the words. */
  body_preview: string | null;
  status: string;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_count: number;
  failed_count: number;
}

/**
 * A list a campaign is sent to.
 *
 * Two kinds, and the difference is where the authority came from. An enquiry
 * cohort filters the marketing tables and stores its `criteria`. A clinical
 * cohort is defined under `marketing.cohorts.clinical_define` — held by
 * doctors and by nobody in marketing — and its `criteria` stay NULL by
 * database constraint, so the reason a person is on the list cannot be
 * reconstructed from this schema. All the campaign ever shows is
 * `criteria_label`, which the clinician writes and is deliberately coarse:
 * "annual review due", not a diagnosis code.
 */
export interface MarketingCohort {
  id: string;
  name: string;
  criteria_kind: string;
  /** Present only for an enquiry cohort. */
  criteria: Record<string, unknown> | null;
  criteria_label: string | null;
  member_count: number;
  refreshed_at: string | null;
}

export interface CreateMarketingEnquiryCohortRequest {
  name: string;
  criteria: Record<string, unknown>;
}

export interface CreateMarketingClinicalCohortRequest {
  name: string;
  /** The coarse label the campaign will show. Written by the clinician. */
  criteria_label: string;
  /** Nobody seen in this many days. */
  dormant_days: number;
  department_id?: string;
}

// Blood bank phase-2 types — split from index.ts, barrel-re-exported.

// ── Blood Bank Phase 2 ─────────────────────────────────

export type BbReturnStatus = "requested" | "inspecting" | "accepted" | "rejected";
export type BbLookbackStatus = "detected" | "investigating" | "notified" | "closed";
export type BbBillingStatus = "pending" | "invoiced" | "paid" | "waived";
export type BbColdChainAlertLevel = "normal" | "warning" | "critical";

export interface BbRecruitmentCampaignRow {
  id: string;
  tenant_id: string;
  campaign_name: string;
  campaign_type: string;
  target_blood_groups: unknown | null;
  target_count: number | null;
  actual_count: number | null;
  start_date: string;
  end_date: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BbColdChainDeviceRow {
  id: string;
  tenant_id: string;
  device_name: string;
  device_serial: string | null;
  location: string | null;
  equipment_type: string;
  min_temp: string | null;
  max_temp: string | null;
  alert_threshold_minutes: number | null;
  is_active: boolean;
  last_reading_at: string | null;
  last_temp: string | null;
  alert_level: BbColdChainAlertLevel | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BbColdChainReadingRow {
  id: string;
  tenant_id: string;
  device_id: string;
  temperature: string;
  humidity: string | null;
  alert_level: BbColdChainAlertLevel | null;
  recorded_at: string;
}

export interface BbBloodReturnRow {
  id: string;
  tenant_id: string;
  component_id: string;
  return_code: string;
  returned_by: string | null;
  return_reason: string | null;
  temperature_at_return: string | null;
  temperature_acceptable: boolean | null;
  time_out_minutes: number | null;
  status: BbReturnStatus;
  inspection_notes: string | null;
  inspected_by: string | null;
  inspected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BbMsbosGuidelineRow {
  id: string;
  tenant_id: string;
  procedure_name: string;
  procedure_code: string;
  blood_group: string | null;
  component_type: string;
  max_units: number;
  crossmatch_to_transfusion_ratio: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BbLookbackEventRow {
  id: string;
  tenant_id: string;
  event_code: string;
  donation_id: string | null;
  donor_id: string | null;
  infection_type: string;
  detection_date: string;
  status: BbLookbackStatus;
  affected_components: unknown | null;
  recipients_notified: number | null;
  investigation_notes: string | null;
  reported_to: string | null;
  reported_at: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BbBillingItemRow {
  id: string;
  tenant_id: string;
  component_id: string | null;
  patient_id: string | null;
  billing_code: string;
  component_type: string | null;
  blood_group: string | null;
  processing_fee: string | null;
  component_cost: string | null;
  cross_match_fee: string | null;
  total_amount: string | null;
  status: BbBillingStatus;
  invoice_id: string | null;
  waiver_reason: string | null;
  billed_by: string | null;
  billed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBbCampaignRequest {
  campaign_name: string;
  campaign_type: string;
  target_blood_groups?: unknown;
  target_count?: number;
  start_date: string;
  end_date?: string;
  notes?: string;
}
export interface UpdateBbCampaignRequest {
  status?: string;
  actual_count?: number;
  notes?: string;
}
export interface CreateBbDeviceRequest {
  device_name: string;
  device_serial?: string;
  location?: string;
  equipment_type: string;
  min_temp?: number;
  max_temp?: number;
  alert_threshold_minutes?: number;
  notes?: string;
}
export interface AddBbReadingRequest {
  device_id: string;
  temperature: number;
  humidity?: number;
}
export interface CreateBbReturnRequest {
  component_id: string;
  return_reason?: string;
  temperature_at_return?: number;
  time_out_minutes?: number;
}
export interface InspectBbReturnRequest {
  status: BbReturnStatus;
  inspection_notes?: string;
  temperature_acceptable?: boolean;
}
export interface CreateBbMsbosRequest {
  procedure_name: string;
  procedure_code: string;
  blood_group?: string;
  component_type: string;
  max_units: number;
  crossmatch_to_transfusion_ratio?: number;
  notes?: string;
}
export interface CreateBbLookbackRequest {
  donation_id?: string;
  donor_id?: string;
  infection_type: string;
  detection_date: string;
  affected_components?: unknown;
  investigation_notes?: string;
}
export interface UpdateBbLookbackRequest {
  status?: BbLookbackStatus;
  recipients_notified?: number;
  investigation_notes?: string;
  reported_to?: string;
}
export interface CreateBbBillingRequest {
  component_id?: string;
  patient_id?: string;
  component_type?: string;
  blood_group?: string;
  processing_fee?: number;
  component_cost?: number;
  cross_match_fee?: number;
  total_amount?: number;
}
export interface BbSbtcReport {
  donation_count: number;
  component_count: number;
  discard_count: number;
  reaction_count: number;
  lookback_count: number;
}

// ══════════════════════════════════════════════════════════
//  Bedside Portal
// ══════════════════════════════════════════════════════════

export type BedsideRequestType =
  | "nurse_call"
  | "pain_management"
  | "bathroom_assist"
  | "water_food"
  | "blanket_pillow"
  | "position_change"
  | "other";

export type BedsideRequestStatus =
  | "pending"
  | "acknowledged"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface BedsideSessionRow {
  id: string;
  tenant_id: string;
  admission_id: string;
  patient_id: string;
  bed_location: string | null;
  device_id: string | null;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface BedsideNurseRequestRow {
  id: string;
  tenant_id: string;
  admission_id: string;
  patient_id: string;
  request_type: BedsideRequestType;
  status: BedsideRequestStatus;
  notes: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BedsideEducationVideoRow {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string;
  condition_codes: unknown | null;
  language: string | null;
  duration_seconds: number | null;
  is_active: boolean;
  sort_order: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BedsideEducationViewRow {
  id: string;
  tenant_id: string;
  video_id: string;
  patient_id: string;
  admission_id: string;
  watched_seconds: number | null;
  completed: boolean;
  viewed_at: string;
}

export interface BedsideRealtimeFeedbackRow {
  id: string;
  tenant_id: string;
  admission_id: string;
  patient_id: string;
  pain_level: number | null;
  comfort_level: number | null;
  cleanliness_level: number | null;
  noise_level: number | null;
  staff_response: number | null;
  comments: string | null;
  submitted_at: string;
}

export interface BedsideDailyScheduleItem {
  event_type: string;
  scheduled_at: string | null;
  description: string;
  status: string | null;
}

export interface BedsideMedicationItem {
  id: string;
  drug_name: string | null;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  scheduled_at: string | null;
  status: string | null;
}

export interface BedsideVitalReading {
  id: string;
  vital_type: string | null;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  recorded_at: string | null;
}

export interface BedsideLabResultItem {
  id: string;
  test_name: string | null;
  result_value: string | null;
  unit: string | null;
  reference_range: string | null;
  is_abnormal: boolean | null;
  completed_at: string | null;
}

export interface BedsideDietOrderItem {
  id: string;
  diet_type: string | null;
  meal_type: string | null;
  instructions: string | null;
  status: string | null;
}

export interface CreateBedsideSessionRequest {
  admission_id: string;
  patient_id: string;
  bed_location?: string;
  device_id?: string;
}

export interface CreateBedsideNurseRequestPayload {
  patient_id: string;
  request_type: BedsideRequestType;
  notes?: string;
}

export interface UpdateBedsideRequestStatusPayload {
  status: BedsideRequestStatus;
}

export interface CreateBedsideVideoRequest {
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  category: string;
  condition_codes?: unknown;
  language?: string;
  duration_seconds?: number;
  sort_order?: number;
}

export interface UpdateBedsideVideoRequest {
  title?: string;
  description?: string;
  video_url?: string;
  thumbnail_url?: string;
  category?: string;
  condition_codes?: unknown;
  language?: string;
  duration_seconds?: number;
  is_active?: boolean;
  sort_order?: number;
}

export interface RecordBedsideVideoViewRequest {
  video_id: string;
  patient_id: string;
  watched_seconds?: number;
  completed?: boolean;
}

export interface SubmitBedsideFeedbackRequest {
  patient_id: string;
  pain_level?: number;
  comfort_level?: number;
  cleanliness_level?: number;
  noise_level?: number;
  staff_response?: number;
  comments?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// TV Displays & Queue
// ══════════════════════════════════════════════════════════════════════════════

export type TvDisplayType =
  | "opd_queue"
  | "lab_queue"
  | "radiology_queue"
  | "pharmacy_queue"
  | "billing_queue"
  | "bed_status"
  | "emergency_triage"
  | "digital_signage"
  | "dashboard";

export type QueueTokenStatus =
  | "waiting"
  | "called"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled";

export type QueuePriority =
  | "normal"
  | "elderly"
  | "disabled"
  | "pregnant"
  | "emergency_referral"
  | "vip";

export type AnnouncementPriority = "info" | "warning" | "emergency";

export interface TvDisplay {
  id: string;
  tenant_id: string;
  department_id: string | null;
  location_name: string;
  display_type: string;
  doctors_per_screen: number;
  show_patient_name: boolean;
  show_wait_time: boolean;
  language: string[];
  announcement_enabled: boolean;
  scroll_speed: number;
  created_at: string;
  updated_at: string;
}

export interface QueueToken {
  id: string;
  tenant_id: string;
  token_date: string;
  token_seq: number;
  token_number: string;
  patient_id: string | null;
  department_id: string;
  doctor_id: string | null;
  status: QueueTokenStatus;
  priority: QueuePriority;
  called_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface QueueTokenInfo {
  token_number: string;
  patient_name: string;
  department_name: string;
  doctor_name: string | null;
  status: string;
  counter: string | null;
  called_at: string | null;
}

export interface DepartmentQueueState {
  department_id: string;
  department_name: string;
  current_token: QueueTokenInfo | null;
  next_tokens: QueueTokenInfo[];
  waiting_count: number;
  completed_count: number;
}

export interface TvAnnouncement {
  id: string;
  message: string;
  priority: AnnouncementPriority;
  created_at: string;
}

export interface CreateTvDisplayRequest {
  location_name: string;
  display_type: string;
  department_id?: string;
  doctors_per_screen?: number;
  show_patient_name?: boolean;
  show_wait_time?: boolean;
  language?: string[];
  announcement_enabled?: boolean;
  scroll_speed?: number;
}

export interface UpdateTvDisplayRequest {
  location_name?: string;
  display_type?: string;
  department_id?: string;
  doctors_per_screen?: number;
  show_patient_name?: boolean;
  show_wait_time?: boolean;
  language?: string[];
  announcement_enabled?: boolean;
  scroll_speed?: number;
}

export interface CreateQueueTokenRequest {
  department_id: string;
  patient_id?: string;
  doctor_id?: string;
  priority?: QueuePriority;
}

export interface CreateQueueTokenResponse {
  id: string;
  token_number: string;
  department_name: string;
  queue_position: number;
  estimated_wait_minutes: number | null;
}

export interface ListQueueTokensQuery {
  department_id?: string;
  status?: QueueTokenStatus;
  date?: string;
}

export interface BroadcastAnnouncementRequest {
  message: string;
  priority?: AnnouncementPriority;
  display_ids?: string[];
  ends_at?: string;
}

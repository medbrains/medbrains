// Communication hub types — split from index.ts, barrel-re-exported.

// ── Communication Hub ───────────────────────────────────

export type CommChannel = "sms" | "whatsapp" | "email" | "push" | "ivr" | "portal";
export type CommMessageStatus = "queued" | "sent" | "delivered" | "failed" | "read";
export type CommTemplateType =
  | "appointment_reminder"
  | "lab_result"
  | "discharge_summary"
  | "billing"
  | "medication_reminder"
  | "follow_up"
  | "generic"
  | "marketing";
export type CommClinicalPriority = "routine" | "urgent" | "critical" | "stat";
export type CommAlertStatus = "triggered" | "acknowledged" | "escalated" | "resolved" | "expired";
export type CommComplaintStatus =
  | "open"
  | "assigned"
  | "in_progress"
  | "pending_review"
  | "resolved"
  | "closed"
  | "reopened";
export type CommComplaintSource =
  | "walk_in"
  | "phone"
  | "email"
  | "portal"
  | "kiosk"
  | "social_media"
  | "google_review";
export type CommFeedbackType = "bedside" | "post_discharge" | "nps" | "department" | "kiosk";

export interface DltTemplate {
  id: string;
  tenant_id: string;
  template_id: string;
  template_name: string;
  category: string;
  sender_id: string;
  entity_id: string;
  body_pattern: string;
  variable_count: number;
  scope: string | null;
  language: string;
  is_active: boolean;
  registered_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDltTemplateRequest {
  template_id: string;
  template_name: string;
  category: string;
  sender_id: string;
  entity_id: string;
  body_pattern: string;
  variable_count?: number;
  scope?: string;
  language?: string;
  registered_at?: string;
  expires_at?: string;
  notes?: string;
}

export interface UpdateDltTemplateRequest {
  template_name?: string;
  body_pattern?: string;
  variable_count?: number;
  scope?: string;
  language?: string;
  is_active?: boolean;
  expires_at?: string;
  notes?: string;
}

export interface CommTemplateRow {
  id: string;
  tenant_id: string;
  template_name: string;
  template_code: string;
  channel: CommChannel;
  template_type: CommTemplateType;
  subject: string | null;
  body_template: string;
  placeholders: unknown | null;
  language: string | null;
  is_active: boolean;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  external_template_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommMessageRow {
  id: string;
  tenant_id: string;
  message_code: string;
  template_id: string | null;
  channel: CommChannel;
  status: CommMessageStatus;
  recipient_type: string | null;
  recipient_id: string | null;
  recipient_name: string | null;
  recipient_contact: string;
  subject: string | null;
  body: string;
  scheduled_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  external_message_id: string | null;
  context_type: string | null;
  context_id: string | null;
  retry_count: number | null;
  sent_by: string | null;
  cost: number | null;
  created_at: string;
  updated_at: string;
}

export interface CommClinicalMessageRow {
  id: string;
  tenant_id: string;
  message_code: string;
  sender_id: string;
  recipient_id: string;
  recipient_department_id: string | null;
  patient_id: string | null;
  priority: CommClinicalPriority;
  message_type: string;
  subject: string | null;
  body: string;
  sbar_data: unknown | null;
  is_read: boolean;
  read_at: string | null;
  is_urgent: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  parent_message_id: string | null;
  attachments: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface CommCriticalAlertRow {
  id: string;
  tenant_id: string;
  alert_code: string;
  alert_source: string;
  source_id: string | null;
  patient_id: string;
  department_id: string | null;
  priority: CommClinicalPriority;
  status: CommAlertStatus;
  title: string;
  description: string;
  alert_value: string | null;
  normal_range: string | null;
  triggered_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  escalation_level: number | null;
  escalated_at: string | null;
  escalated_to: string | null;
  notification_log: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface CommComplaintRow {
  id: string;
  tenant_id: string;
  complaint_code: string;
  source: CommComplaintSource;
  status: CommComplaintStatus;
  patient_id: string | null;
  complainant_name: string;
  complainant_phone: string | null;
  complainant_email: string | null;
  department_id: string | null;
  category: string | null;
  subcategory: string | null;
  subject: string;
  description: string;
  severity: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  sla_hours: number | null;
  sla_deadline: string | null;
  sla_breached: boolean;
  sla_breached_at: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  satisfaction_score: number | null;
  service_recovery_action: string | null;
  service_recovery_cost: number | null;
  escalation_level: number | null;
  escalation_history: unknown | null;
  google_review_id: string | null;
  external_reference: string | null;
  attachments: unknown | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommFeedbackSurveyRow {
  id: string;
  tenant_id: string;
  feedback_code: string;
  feedback_type: CommFeedbackType;
  patient_id: string | null;
  department_id: string | null;
  doctor_id: string | null;
  overall_rating: number | null;
  nps_score: number | null;
  wait_time_rating: number | null;
  staff_rating: number | null;
  cleanliness_rating: number | null;
  food_rating: number | null;
  communication_rating: number | null;
  discharge_rating: number | null;
  would_recommend: boolean | null;
  comments: string | null;
  suggestions: string | null;
  is_anonymous: boolean;
  channel: string | null;
  survey_data: unknown | null;
  submitted_at: string;
  waiting_time_minutes: number | null;
  collection_point: string | null;
  created_at: string;
}

export interface FeedbackStatsResponse {
  total_responses: number;
  avg_overall: number;
  avg_nps: number;
  nps_score: number;
  avg_wait_time: number;
  avg_staff: number;
  avg_cleanliness: number;
  would_recommend_pct: number;
}

export interface CreateCommTemplateRequest {
  template_name: string;
  template_code: string;
  channel: CommChannel;
  template_type: CommTemplateType;
  subject?: string;
  body_template: string;
  placeholders?: unknown;
  language?: string;
  is_active?: boolean;
  requires_approval?: boolean;
  external_template_id?: string;
  notes?: string;
}
export interface UpdateCommTemplateRequest {
  template_name?: string;
  channel?: CommChannel;
  template_type?: CommTemplateType;
  subject?: string;
  body_template?: string;
  placeholders?: unknown;
  language?: string;
  is_active?: boolean;
  requires_approval?: boolean;
  external_template_id?: string;
  notes?: string;
}
export interface CreateCommMessageRequest {
  template_id?: string;
  channel: CommChannel;
  recipient_type?: string;
  recipient_id?: string;
  recipient_name?: string;
  recipient_contact: string;
  subject?: string;
  body: string;
  context_type?: string;
  context_id?: string;
}
export interface UpdateCommMessageStatusRequest {
  status: CommMessageStatus;
  failure_reason?: string;
  external_message_id?: string;
}
export interface CreateCommClinicalRequest {
  recipient_id: string;
  recipient_department_id?: string;
  patient_id?: string;
  priority?: CommClinicalPriority;
  message_type: string;
  subject?: string;
  body: string;
  sbar_data?: unknown;
  is_urgent?: boolean;
  parent_message_id?: string;
  attachments?: unknown;
}
export interface CreateCommAlertRequest {
  alert_source: string;
  source_id?: string;
  patient_id: string;
  department_id?: string;
  priority?: CommClinicalPriority;
  title: string;
  description: string;
  alert_value?: string;
  normal_range?: string;
}
export interface ResolveCommAlertRequest {
  resolution_notes?: string;
}
export interface CreateCommComplaintRequest {
  source: CommComplaintSource;
  patient_id?: string;
  complainant_name: string;
  complainant_phone?: string;
  complainant_email?: string;
  department_id?: string;
  category?: string;
  subcategory?: string;
  subject: string;
  description: string;
  severity?: string;
  sla_hours?: number;
}
export interface UpdateCommComplaintRequest {
  status?: CommComplaintStatus;
  assigned_to?: string;
  category?: string;
  severity?: string;
}
export interface ResolveCommComplaintRequest {
  resolution_notes?: string;
  satisfaction_score?: number;
  service_recovery_action?: string;
  service_recovery_cost?: number;
}
export interface CreateCommFeedbackRequest {
  feedback_type: CommFeedbackType;
  patient_id?: string;
  department_id?: string;
  doctor_id?: string;
  overall_rating?: number;
  nps_score?: number;
  wait_time_rating?: number;
  staff_rating?: number;
  cleanliness_rating?: number;
  food_rating?: number;
  communication_rating?: number;
  discharge_rating?: number;
  would_recommend?: boolean;
  comments?: string;
  suggestions?: string;
  is_anonymous?: boolean;
  channel?: string;
  survey_data?: unknown;
  waiting_time_minutes?: number;
  collection_point?: string;
}

// Device integration types — split from index.ts, barrel-re-exported.

// ── Device Integration Types ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════

export interface DeviceAdapterCatalog {
  id: string;
  adapter_code: string;
  manufacturer: string;
  manufacturer_code: string;
  model: string;
  model_code: string;
  device_category: string;
  device_subcategory: string | null;
  protocol: string;
  transport: string;
  default_port: number | null;
  default_baud_rate: number | null;
  default_config: Record<string, unknown>;
  field_mappings: unknown[];
  data_transforms: unknown[];
  qc_recommendations: unknown[];
  known_quirks: unknown[];
  supported_tests: unknown[];
  adapter_version: string;
  sdk_version: string;
  wasm_hash: string | null;
  wasm_size_bytes: number | null;
  is_verified: boolean;
  contributed_by: string;
  documentation_url: string | null;
  is_active: boolean;
}

export type DeviceInstanceStatus =
  | "pending_setup"
  | "configuring"
  | "testing"
  | "active"
  | "degraded"
  | "disconnected"
  | "maintenance"
  | "decommissioned";

export interface DeviceInstance {
  id: string;
  tenant_id: string;
  adapter_code: string;
  facility_id: string | null;
  department_id: string | null;
  name: string;
  code: string;
  serial_number: string | null;
  hostname: string | null;
  port: number | null;
  protocol_config: Record<string, unknown>;
  field_mappings: unknown[];
  data_transforms: unknown[];
  qc_config: Record<string, unknown>;
  ai_config_version: number;
  ai_confidence: number | null;
  human_overrides: Record<string, unknown>;
  config_source: string;
  status: DeviceInstanceStatus;
  last_heartbeat: string | null;
  last_message_at: string | null;
  last_error: string | null;
  error_count_24h: number;
  message_count_24h: number;
  bridge_agent_id: string | null;
  notes: string | null;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDeviceInstanceRequest {
  adapter_code: string;
  name: string;
  code: string;
  facility_id?: string;
  department_id?: string;
  serial_number?: string;
  hostname?: string;
  port?: number;
  credentials?: Record<string, unknown>;
  protocol_config?: Record<string, unknown>;
  field_mappings?: unknown[];
  data_transforms?: unknown[];
  qc_config?: Record<string, unknown>;
  notes?: string;
  tags?: string[];
}

export interface UpdateDeviceInstanceRequest {
  name?: string;
  facility_id?: string;
  department_id?: string;
  serial_number?: string;
  hostname?: string;
  port?: number;
  credentials?: Record<string, unknown>;
  protocol_config?: Record<string, unknown>;
  field_mappings?: unknown[];
  data_transforms?: unknown[];
  qc_config?: Record<string, unknown>;
  status?: DeviceInstanceStatus;
  bridge_agent_id?: string;
  notes?: string;
  tags?: string[];
}

export interface GeneratedDeviceConfig {
  protocol_config: Record<string, unknown>;
  field_mappings: unknown[];
  data_transforms: unknown[];
  qc_config: Record<string, unknown>;
  applied_quirks: string[];
  confidence: number;
  warnings: string[];
  suggested_name: string;
  suggested_code: string;
  default_port: number | null;
}

export interface BridgeAgent {
  id: string;
  tenant_id: string | null;
  name: string;
  deployment_mode: string;
  version: string | null;
  hostname: string | null;
  capabilities: string[];
  status: string;
  last_heartbeat: string | null;
  devices_connected: number;
  buffer_depth: number;
  is_active: boolean;
  created_at: string;
}

export type DeviceMessageStatus =
  | "received"
  | "parsed"
  | "mapped"
  | "validated"
  | "delivered"
  | "failed"
  | "rejected"
  | "dead_letter";

export interface DeviceMessage {
  id: string;
  tenant_id: string;
  device_instance_id: string;
  direction: string;
  protocol: string;
  parsed_payload: unknown | null;
  mapped_data: unknown | null;
  processing_status: DeviceMessageStatus;
  target_module: string | null;
  target_entity_id: string | null;
  error_message: string | null;
  retry_count: number;
  processing_duration_ms: number | null;
  created_at: string;
}

export interface DeviceConfigHistory {
  id: string;
  device_instance_id: string;
  change_type: string;
  previous_config: Record<string, unknown>;
  new_config: Record<string, unknown>;
  changed_fields: string[];
  changed_by: string | null;
  change_reason: string | null;
  ai_confidence: number | null;
  created_at: string;
}

export interface ManufacturerSummary {
  code: string;
  name: string;
  model_count: number;
}

export interface DeviceRoutingRule {
  id: string;
  tenant_id: string;
  device_instance_id: string | null;
  adapter_code: string | null;
  name: string;
  description: string | null;
  target_module: string;
  match_strategy: string;
  match_field: string;
  target_entity: string;
  field_mappings: unknown[];
  transform_rules: unknown[];
  auto_verify: boolean;
  notify_on_critical: boolean;
  reject_duplicates: boolean;
  trigger_pipeline: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRoutingRuleRequest {
  device_instance_id?: string;
  adapter_code?: string;
  name: string;
  description?: string;
  target_module: string;
  match_strategy: string;
  match_field: string;
  target_entity: string;
  field_mappings?: unknown[];
  transform_rules?: unknown[];
  auto_verify?: boolean;
  notify_on_critical?: boolean;
  reject_duplicates?: boolean;
  priority?: number;
}

export interface UpdateRoutingRuleRequest {
  name?: string;
  description?: string;
  target_module?: string;
  match_strategy?: string;
  match_field?: string;
  target_entity?: string;
  field_mappings?: unknown[];
  transform_rules?: unknown[];
  auto_verify?: boolean;
  notify_on_critical?: boolean;
  reject_duplicates?: boolean;
  priority?: number;
  is_active?: boolean;
}

// ══════════════════════════════════════════════════════════
//  LMS (Learning Management System)
// ══════════════════════════════════════════════════════════

export type LmsContentType = "text" | "video" | "document" | "slides" | "scorm" | "external_link";
export type LmsEnrollmentStatus =
  | "assigned"
  | "in_progress"
  | "completed"
  | "expired"
  | "cancelled";
export type LmsQuestionType = "single_choice" | "multiple_choice" | "true_false" | "fill_blank";

export interface LmsCourse {
  id: string;
  tenant_id: string;
  code: string;
  title: string;
  description?: string;
  category: string;
  duration_hours?: number;
  is_mandatory: boolean;
  target_roles: string[];
  thumbnail_url?: string;
  content_type: LmsContentType;
  is_active: boolean;
  created_by?: string;
  training_program_id?: string;
  created_at: string;
  updated_at: string;
}

export interface LmsCourseModule {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  sort_order: number;
  content: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LmsQuiz {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  pass_percentage: number;
  max_attempts: number;
  time_limit_minutes?: number;
  shuffle_questions: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LmsQuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: LmsQuestionType;
  options: { key: string; text: string }[];
  correct_answer?: unknown;
  explanation?: string;
  points: number;
  sort_order: number;
}

export interface LmsQuizQuestionPublic {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: LmsQuestionType;
  options: { key: string; text: string }[];
  points: number;
  sort_order: number;
}

export interface LmsEnrollment {
  id: string;
  tenant_id: string;
  user_id: string;
  course_id: string;
  assigned_by?: string;
  assigned_at: string;
  due_date?: string;
  started_at?: string;
  completed_at?: string;
  status: LmsEnrollmentStatus;
  progress_percentage: number;
  last_module_id?: string;
  created_at: string;
  updated_at: string;
}

export interface EnrollmentWithCourse {
  id: string;
  user_id: string;
  course_id: string;
  course_title: string;
  course_code: string;
  category: string;
  is_mandatory: boolean;
  status: LmsEnrollmentStatus;
  progress_percentage: number;
  due_date?: string;
  assigned_at: string;
  completed_at?: string;
}

export interface LmsQuizAttempt {
  id: string;
  enrollment_id: string;
  quiz_id: string;
  started_at: string;
  completed_at?: string;
  score?: number;
  max_score?: number;
  passed?: boolean;
  answers: unknown[];
  created_at: string;
}

export interface LmsLearningPath {
  id: string;
  tenant_id: string;
  code: string;
  title: string;
  description?: string;
  target_roles: string[];
  is_mandatory: boolean;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface LmsLearningPathCourse {
  id: string;
  path_id: string;
  course_id: string;
  sort_order: number;
  is_required: boolean;
}

export interface PathCourseRow {
  id: string;
  course_id: string;
  course_title: string;
  course_code: string;
  sort_order: number;
  is_required: boolean;
}

export interface LmsCertificate {
  id: string;
  tenant_id: string;
  user_id: string;
  course_id?: string;
  path_id?: string;
  enrollment_id?: string;
  certificate_no: string;
  issued_at: string;
  expires_at?: string;
  issued_by?: string;
  training_record_id?: string;
  created_at: string;
}

export interface CourseWithModules {
  course: LmsCourse;
  modules: LmsCourseModule[];
  quizzes: LmsQuiz[];
}

export interface LearningPathWithCourses {
  path: LmsLearningPath;
  courses: PathCourseRow[];
}

export interface LmsComplianceRow {
  course_id: string;
  course_title: string;
  is_mandatory: boolean;
  total_enrolled: number;
  completed: number;
  overdue: number;
}

export interface QuizAttemptStart {
  attempt_id: string;
  quiz: LmsQuiz;
  questions: LmsQuizQuestionPublic[];
}

export interface QuizAttemptResult {
  attempt: LmsQuizAttempt;
  passed: boolean;
  score: number;
  max_score: number;
  pass_percentage: number;
}

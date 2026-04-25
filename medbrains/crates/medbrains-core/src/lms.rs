//! Learning Management System (LMS) types — courses, quizzes, enrollments,
//! learning paths, certificates, and compliance tracking.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ──────────────────────────────────────────────
//  Enums
// ──────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lms_content_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LmsContentType {
    Text,
    Video,
    Document,
    Slides,
    Scorm,
    ExternalLink,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lms_enrollment_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LmsEnrollmentStatus {
    Assigned,
    InProgress,
    Completed,
    Expired,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "lms_question_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum LmsQuestionType {
    SingleChoice,
    MultipleChoice,
    TrueFalse,
    FillBlank,
}

// ──────────────────────────────────────────────
//  Course
// ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LmsCourse {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub title: String,
    pub description: Option<String>,
    pub category: String,
    pub duration_hours: Option<rust_decimal::Decimal>,
    pub is_mandatory: bool,
    pub target_roles: serde_json::Value,
    pub thumbnail_url: Option<String>,
    pub content_type: LmsContentType,
    pub is_active: bool,
    pub created_by: Option<Uuid>,
    pub training_program_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LmsCourseModule {
    pub id: Uuid,
    pub course_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub sort_order: i32,
    pub content: serde_json::Value,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ──────────────────────────────────────────────
//  Quiz
// ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LmsQuiz {
    pub id: Uuid,
    pub course_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub pass_percentage: i32,
    pub max_attempts: i32,
    pub time_limit_minutes: Option<i32>,
    pub shuffle_questions: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Full question — includes `correct_answer` (admin view only).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LmsQuizQuestion {
    pub id: Uuid,
    pub quiz_id: Uuid,
    pub question_text: String,
    pub question_type: LmsQuestionType,
    pub options: serde_json::Value,
    pub correct_answer: serde_json::Value,
    pub explanation: Option<String>,
    pub points: i32,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
}

/// Public question — `correct_answer` and explanation stripped for quiz-taking.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LmsQuizQuestionPublic {
    pub id: Uuid,
    pub quiz_id: Uuid,
    pub question_text: String,
    pub question_type: LmsQuestionType,
    pub options: serde_json::Value,
    pub points: i32,
    pub sort_order: i32,
}

// ──────────────────────────────────────────────
//  Enrollment
// ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LmsEnrollment {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub assigned_by: Option<Uuid>,
    pub assigned_at: DateTime<Utc>,
    pub due_date: Option<NaiveDate>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub status: LmsEnrollmentStatus,
    pub progress_percentage: i32,
    pub last_module_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Enrollment with joined course title for listing.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct EnrollmentWithCourse {
    pub id: Uuid,
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub course_title: String,
    pub course_code: String,
    pub category: String,
    pub is_mandatory: bool,
    pub status: LmsEnrollmentStatus,
    pub progress_percentage: i32,
    pub due_date: Option<NaiveDate>,
    pub assigned_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
}

// ──────────────────────────────────────────────
//  Quiz Attempt
// ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LmsQuizAttempt {
    pub id: Uuid,
    pub enrollment_id: Uuid,
    pub quiz_id: Uuid,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub score: Option<i32>,
    pub max_score: Option<i32>,
    pub passed: Option<bool>,
    pub answers: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

// ──────────────────────────────────────────────
//  Learning Path
// ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LmsLearningPath {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub code: String,
    pub title: String,
    pub description: Option<String>,
    pub target_roles: serde_json::Value,
    pub is_mandatory: bool,
    pub is_active: bool,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LmsLearningPathCourse {
    pub id: Uuid,
    pub path_id: Uuid,
    pub course_id: Uuid,
    pub sort_order: i32,
    pub is_required: bool,
}

/// Learning path with course titles for listing.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PathCourseRow {
    pub id: Uuid,
    pub course_id: Uuid,
    pub course_title: String,
    pub course_code: String,
    pub sort_order: i32,
    pub is_required: bool,
}

// ──────────────────────────────────────────────
//  Certificate
// ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LmsCertificate {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub course_id: Option<Uuid>,
    pub path_id: Option<Uuid>,
    pub enrollment_id: Option<Uuid>,
    pub certificate_no: String,
    pub issued_at: DateTime<Utc>,
    pub expires_at: Option<NaiveDate>,
    pub issued_by: Option<Uuid>,
    pub training_record_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

// ──────────────────────────────────────────────
//  Composite / Analytics
// ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourseWithModules {
    pub course: LmsCourse,
    pub modules: Vec<LmsCourseModule>,
    pub quizzes: Vec<LmsQuiz>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearningPathWithCourses {
    pub path: LmsLearningPath,
    pub courses: Vec<PathCourseRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LmsComplianceRow {
    pub course_id: Uuid,
    pub course_title: String,
    pub is_mandatory: bool,
    pub total_enrolled: i64,
    pub completed: i64,
    pub overdue: i64,
}

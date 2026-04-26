//! LMS (Learning Management System) route handlers.
//!
//! Courses, quizzes, enrollments, learning paths, certificates, compliance.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::lms::{
    CourseWithModules, EnrollmentWithCourse, LearningPathWithCourses, LmsCertificate,
    LmsComplianceRow, LmsCourse, LmsCourseModule, LmsEnrollment, LmsLearningPath,
    LmsLearningPathCourse, LmsQuiz, LmsQuizAttempt, LmsQuizQuestion, LmsQuizQuestionPublic,
    PathCourseRow,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CourseQuery {
    pub search: Option<String>,
    pub category: Option<String>,
    pub mandatory: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCourseRequest {
    pub code: String,
    pub title: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub duration_hours: Option<f64>,
    pub is_mandatory: Option<bool>,
    pub target_roles: Option<serde_json::Value>,
    pub thumbnail_url: Option<String>,
    pub content_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCourseRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub duration_hours: Option<f64>,
    pub is_mandatory: Option<bool>,
    pub target_roles: Option<serde_json::Value>,
    pub thumbnail_url: Option<String>,
    pub content_type: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateModuleRequest {
    pub title: String,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
    pub content: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateModuleRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub sort_order: Option<i32>,
    pub content: Option<serde_json::Value>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ReorderModulesRequest {
    pub module_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateQuizRequest {
    pub title: String,
    pub description: Option<String>,
    pub pass_percentage: Option<i32>,
    pub max_attempts: Option<i32>,
    pub time_limit_minutes: Option<i32>,
    pub shuffle_questions: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateQuizRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub pass_percentage: Option<i32>,
    pub max_attempts: Option<i32>,
    pub time_limit_minutes: Option<i32>,
    pub shuffle_questions: Option<bool>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateQuestionRequest {
    pub question_text: String,
    pub question_type: Option<String>,
    pub options: serde_json::Value,
    pub correct_answer: serde_json::Value,
    pub explanation: Option<String>,
    pub points: Option<i32>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct EnrollmentQuery {
    pub user_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AssignCourseRequest {
    pub user_id: Uuid,
    pub course_id: Uuid,
    pub due_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BulkAssignRequest {
    pub course_id: Uuid,
    pub role: String,
    pub due_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProgressRequest {
    pub module_id: Uuid,
    pub progress_percentage: i32,
}

#[derive(Debug, Deserialize)]
pub struct StartQuizRequest {
    pub quiz_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct SubmitQuizRequest {
    pub answers: Vec<QuizAnswer>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct QuizAnswer {
    pub question_id: Uuid,
    pub selected: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct CreatePathRequest {
    pub code: String,
    pub title: String,
    pub description: Option<String>,
    pub target_roles: Option<serde_json::Value>,
    pub is_mandatory: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePathRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub target_roles: Option<serde_json::Value>,
    pub is_mandatory: Option<bool>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct AddPathCourseRequest {
    pub course_id: Uuid,
    pub sort_order: Option<i32>,
    pub is_required: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct IssueCertificateRequest {
    pub user_id: Uuid,
    pub course_id: Option<Uuid>,
    pub path_id: Option<Uuid>,
    pub enrollment_id: Option<Uuid>,
    pub expires_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CertificateQuery {
    pub user_id: Option<Uuid>,
    pub course_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct QuizAttemptStart {
    pub attempt_id: Uuid,
    pub quiz: LmsQuiz,
    pub questions: Vec<LmsQuizQuestionPublic>,
}

#[derive(Debug, Serialize)]
pub struct QuizAttemptResult {
    pub attempt: LmsQuizAttempt,
    pub passed: bool,
    pub score: i32,
    pub max_score: i32,
    pub pass_percentage: i32,
}

// ══════════════════════════════════════════════════════════
//  Course Management
// ══════════════════════════════════════════════════════════

/// GET /api/lms/courses
pub async fn list_courses(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Query(q): Query<CourseQuery>,
) -> Result<Json<Vec<LmsCourse>>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::courses::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let search = q.search.map(|s| format!("%{s}%"));
    let courses = sqlx::query_as::<_, LmsCourse>(
        "SELECT * FROM lms_courses
         WHERE ($1::text IS NULL OR title ILIKE $1 OR code ILIKE $1)
           AND ($2::text IS NULL OR category = $2)
           AND ($3::bool IS NULL OR is_mandatory = $3)
         ORDER BY title",
    )
    .bind(&search)
    .bind(&q.category)
    .bind(q.mandatory)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(courses))
}

/// GET /api/lms/courses/{id}
pub async fn get_course(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<CourseWithModules>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::courses::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let course = sqlx::query_as::<_, LmsCourse>("SELECT * FROM lms_courses WHERE id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    let modules = sqlx::query_as::<_, LmsCourseModule>(
        "SELECT * FROM lms_course_modules WHERE course_id = $1 ORDER BY sort_order",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    let quizzes = sqlx::query_as::<_, LmsQuiz>(
        "SELECT * FROM lms_quizzes WHERE course_id = $1 ORDER BY created_at",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(CourseWithModules {
        course,
        modules,
        quizzes,
    }))
}

/// POST /api/lms/courses
pub async fn create_course(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Json(req): Json<CreateCourseRequest>,
) -> Result<Json<LmsCourse>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::courses::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let course = sqlx::query_as::<_, LmsCourse>(
        "INSERT INTO lms_courses (tenant_id, code, title, description, category,
                duration_hours, is_mandatory, target_roles, thumbnail_url, content_type, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 'text')::lms_content_type, $11)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&req.code)
    .bind(&req.title)
    .bind(&req.description)
    .bind(req.category.as_deref().unwrap_or("general"))
    .bind(
        req.duration_hours
            .map(rust_decimal::Decimal::try_from)
            .transpose()
            .ok()
            .flatten(),
    )
    .bind(req.is_mandatory.unwrap_or(false))
    .bind(req.target_roles.as_ref().unwrap_or(&serde_json::json!([])))
    .bind(&req.thumbnail_url)
    .bind(req.content_type.as_deref().unwrap_or("text"))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(course))
}

/// PUT /api/lms/courses/{id}
pub async fn update_course(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateCourseRequest>,
) -> Result<Json<LmsCourse>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::courses::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let course = sqlx::query_as::<_, LmsCourse>(
        "UPDATE lms_courses SET
            title = COALESCE($2, title),
            description = COALESCE($3, description),
            category = COALESCE($4, category),
            duration_hours = COALESCE($5, duration_hours),
            is_mandatory = COALESCE($6, is_mandatory),
            target_roles = COALESCE($7, target_roles),
            thumbnail_url = COALESCE($8, thumbnail_url),
            content_type = COALESCE($9::lms_content_type, content_type),
            is_active = COALESCE($10, is_active)
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(&req.category)
    .bind(
        req.duration_hours
            .map(rust_decimal::Decimal::try_from)
            .transpose()
            .ok()
            .flatten(),
    )
    .bind(req.is_mandatory)
    .bind(&req.target_roles)
    .bind(&req.thumbnail_url)
    .bind(&req.content_type)
    .bind(req.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(course))
}

/// DELETE /api/lms/courses/{id}
pub async fn delete_course(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::courses::DELETE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("UPDATE lms_courses SET is_active = false WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"deleted": true})))
}

// ══════════════════════════════════════════════════════════
//  Course Modules
// ══════════════════════════════════════════════════════════

/// POST /api/lms/courses/{id}/modules
pub async fn add_module(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(course_id): Path<Uuid>,
    Json(req): Json<CreateModuleRequest>,
) -> Result<Json<LmsCourseModule>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::courses::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let module = sqlx::query_as::<_, LmsCourseModule>(
        "INSERT INTO lms_course_modules (course_id, title, description, sort_order, content)
         VALUES ($1, $2, $3, COALESCE($4, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM lms_course_modules WHERE course_id = $1)), $5)
         RETURNING *",
    )
    .bind(course_id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(req.sort_order)
    .bind(req.content.as_ref().unwrap_or(&serde_json::json!({})))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(module))
}

/// PUT /`api/lms/courses/{course_id}/modules/{module_id`}
pub async fn update_module(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path((_, module_id)): Path<(Uuid, Uuid)>,
    Json(req): Json<UpdateModuleRequest>,
) -> Result<Json<LmsCourseModule>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::courses::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let module = sqlx::query_as::<_, LmsCourseModule>(
        "UPDATE lms_course_modules SET
            title = COALESCE($2, title),
            description = COALESCE($3, description),
            sort_order = COALESCE($4, sort_order),
            content = COALESCE($5, content),
            is_active = COALESCE($6, is_active)
         WHERE id = $1 RETURNING *",
    )
    .bind(module_id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(req.sort_order)
    .bind(&req.content)
    .bind(req.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(module))
}

/// DELETE /`api/lms/courses/{course_id}/modules/{module_id`}
pub async fn delete_module(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path((_, module_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::courses::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("DELETE FROM lms_course_modules WHERE id = $1")
        .bind(module_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"deleted": true})))
}

/// PUT /api/lms/courses/{id}/modules/reorder
pub async fn reorder_modules(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(course_id): Path<Uuid>,
    Json(req): Json<ReorderModulesRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::courses::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    for (i, mid) in req.module_ids.iter().enumerate() {
        sqlx::query(
            "UPDATE lms_course_modules SET sort_order = $1 WHERE id = $2 AND course_id = $3",
        )
        .bind(i as i32)
        .bind(mid)
        .bind(course_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({"reordered": true})))
}

// ══════════════════════════════════════════════════════════
//  Quizzes
// ══════════════════════════════════════════════════════════

/// GET /`api/lms/courses/{course_id}/quizzes`
pub async fn list_quizzes(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<Vec<LmsQuiz>>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::quizzes::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let quizzes = sqlx::query_as::<_, LmsQuiz>(
        "SELECT * FROM lms_quizzes WHERE course_id = $1 ORDER BY created_at",
    )
    .bind(course_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(quizzes))
}

/// POST /`api/lms/courses/{course_id}/quizzes`
pub async fn create_quiz(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(course_id): Path<Uuid>,
    Json(req): Json<CreateQuizRequest>,
) -> Result<Json<LmsQuiz>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::quizzes::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let quiz = sqlx::query_as::<_, LmsQuiz>(
        "INSERT INTO lms_quizzes (course_id, title, description, pass_percentage, max_attempts, time_limit_minutes, shuffle_questions)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(course_id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(req.pass_percentage.unwrap_or(70))
    .bind(req.max_attempts.unwrap_or(3))
    .bind(req.time_limit_minutes)
    .bind(req.shuffle_questions.unwrap_or(true))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(quiz))
}

/// PUT /api/lms/quizzes/{id}
pub async fn update_quiz(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateQuizRequest>,
) -> Result<Json<LmsQuiz>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::quizzes::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let quiz = sqlx::query_as::<_, LmsQuiz>(
        "UPDATE lms_quizzes SET
            title = COALESCE($2, title),
            description = COALESCE($3, description),
            pass_percentage = COALESCE($4, pass_percentage),
            max_attempts = COALESCE($5, max_attempts),
            time_limit_minutes = COALESCE($6, time_limit_minutes),
            shuffle_questions = COALESCE($7, shuffle_questions),
            is_active = COALESCE($8, is_active)
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(req.pass_percentage)
    .bind(req.max_attempts)
    .bind(req.time_limit_minutes)
    .bind(req.shuffle_questions)
    .bind(req.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(quiz))
}

// ══════════════════════════════════════════════════════════
//  Quiz Questions
// ══════════════════════════════════════════════════════════

/// POST /`api/lms/quizzes/{quiz_id}/questions`
pub async fn add_question(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(quiz_id): Path<Uuid>,
    Json(req): Json<CreateQuestionRequest>,
) -> Result<Json<LmsQuizQuestion>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::quizzes::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let question = sqlx::query_as::<_, LmsQuizQuestion>(
        "INSERT INTO lms_quiz_questions (quiz_id, question_text, question_type, options, correct_answer, explanation, points, sort_order)
         VALUES ($1, $2, COALESCE($3, 'single_choice')::lms_question_type, $4, $5, $6, $7,
                 COALESCE($8, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM lms_quiz_questions WHERE quiz_id = $1)))
         RETURNING *",
    )
    .bind(quiz_id)
    .bind(&req.question_text)
    .bind(req.question_type.as_deref().unwrap_or("single_choice"))
    .bind(&req.options)
    .bind(&req.correct_answer)
    .bind(&req.explanation)
    .bind(req.points.unwrap_or(1))
    .bind(req.sort_order)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(question))
}

/// PUT /`api/lms/quizzes/{quiz_id}/questions/{qid`}
pub async fn update_question(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path((_, qid)): Path<(Uuid, Uuid)>,
    Json(req): Json<CreateQuestionRequest>,
) -> Result<Json<LmsQuizQuestion>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::quizzes::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let question = sqlx::query_as::<_, LmsQuizQuestion>(
        "UPDATE lms_quiz_questions SET
            question_text = $2, question_type = $3::lms_question_type,
            options = $4, correct_answer = $5, explanation = $6,
            points = $7, sort_order = COALESCE($8, sort_order)
         WHERE id = $1 RETURNING *",
    )
    .bind(qid)
    .bind(&req.question_text)
    .bind(req.question_type.as_deref().unwrap_or("single_choice"))
    .bind(&req.options)
    .bind(&req.correct_answer)
    .bind(&req.explanation)
    .bind(req.points.unwrap_or(1))
    .bind(req.sort_order)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(question))
}

/// DELETE /`api/lms/quizzes/{quiz_id}/questions/{qid`}
pub async fn delete_question(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path((_, qid)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::quizzes::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("DELETE FROM lms_quiz_questions WHERE id = $1")
        .bind(qid)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"deleted": true})))
}

// ══════════════════════════════════════════════════════════
//  Enrollments
// ══════════════════════════════════════════════════════════

/// GET /api/lms/enrollments
pub async fn list_enrollments(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Query(q): Query<EnrollmentQuery>,
) -> Result<Json<Vec<EnrollmentWithCourse>>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::enrollments::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, EnrollmentWithCourse>(
        "SELECT e.id, e.user_id, e.course_id, c.title AS course_title, c.code AS course_code,
                c.category, c.is_mandatory, e.status, e.progress_percentage,
                e.due_date, e.assigned_at, e.completed_at
         FROM lms_enrollments e
         JOIN lms_courses c ON c.id = e.course_id
         WHERE ($1::uuid IS NULL OR e.user_id = $1)
           AND ($2::uuid IS NULL OR e.course_id = $2)
           AND ($3::text IS NULL OR e.status::text = $3)
         ORDER BY e.assigned_at DESC",
    )
    .bind(q.user_id)
    .bind(q.course_id)
    .bind(&q.status)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/lms/enrollments
pub async fn assign_course(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Json(req): Json<AssignCourseRequest>,
) -> Result<Json<LmsEnrollment>, AppError> {
    require_permission(
        &claims,
        medbrains_core::permissions::lms::enrollments::CREATE,
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let due = req
        .due_date
        .as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    let enrollment = sqlx::query_as::<_, LmsEnrollment>(
        "INSERT INTO lms_enrollments (tenant_id, user_id, course_id, assigned_by, due_date)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, user_id, course_id) DO UPDATE SET
           due_date = COALESCE(EXCLUDED.due_date, lms_enrollments.due_date),
           status = CASE WHEN lms_enrollments.status = 'cancelled' THEN 'assigned'::lms_enrollment_status ELSE lms_enrollments.status END
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(req.user_id)
    .bind(req.course_id)
    .bind(claims.sub)
    .bind(due)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(enrollment))
}

/// POST /api/lms/enrollments/bulk-role
pub async fn bulk_assign_by_role(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Json(req): Json<BulkAssignRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(
        &claims,
        medbrains_core::permissions::lms::enrollments::CREATE,
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let due = req
        .due_date
        .as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    let count = sqlx::query_scalar::<_, i64>(
        "WITH target_users AS (
            SELECT id FROM users WHERE tenant_id = $1 AND role = $2 AND is_active = true
         )
         INSERT INTO lms_enrollments (tenant_id, user_id, course_id, assigned_by, due_date)
         SELECT $1, tu.id, $3, $4, $5
         FROM target_users tu
         ON CONFLICT (tenant_id, user_id, course_id) DO NOTHING
         RETURNING 1::bigint",
    )
    .bind(claims.tenant_id)
    .bind(&req.role)
    .bind(req.course_id)
    .bind(claims.sub)
    .bind(due)
    .fetch_all(&mut *tx)
    .await?
    .len() as i64;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"enrolled": count})))
}

/// PUT /api/lms/enrollments/{id}
pub async fn update_enrollment(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<serde_json::Value>,
) -> Result<Json<LmsEnrollment>, AppError> {
    require_permission(
        &claims,
        medbrains_core::permissions::lms::enrollments::UPDATE,
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let status = req.get("status").and_then(serde_json::Value::as_str);
    let due_date = req
        .get("due_date")
        .and_then(serde_json::Value::as_str)
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    let enrollment = sqlx::query_as::<_, LmsEnrollment>(
        "UPDATE lms_enrollments SET
            status = COALESCE($2::lms_enrollment_status, status),
            due_date = COALESCE($3, due_date)
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(status)
    .bind(due_date)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(enrollment))
}

// ══════════════════════════════════════════════════════════
//  My Learning (current user)
// ══════════════════════════════════════════════════════════

/// GET /api/lms/my/enrollments
pub async fn my_enrollments(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
) -> Result<Json<Vec<EnrollmentWithCourse>>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::my_learning::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, EnrollmentWithCourse>(
        "SELECT e.id, e.user_id, e.course_id, c.title AS course_title, c.code AS course_code,
                c.category, c.is_mandatory, e.status, e.progress_percentage,
                e.due_date, e.assigned_at, e.completed_at
         FROM lms_enrollments e
         JOIN lms_courses c ON c.id = e.course_id
         WHERE e.user_id = $1 AND e.status != 'cancelled'
         ORDER BY
           CASE e.status WHEN 'in_progress' THEN 0 WHEN 'assigned' THEN 1 ELSE 2 END,
           e.due_date NULLS LAST",
    )
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// GET /api/lms/my/enrollments/{id}
pub async fn my_course_detail(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(enrollment_id): Path<Uuid>,
) -> Result<Json<CourseWithModules>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::my_learning::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let enrollment = sqlx::query_as::<_, LmsEnrollment>(
        "SELECT * FROM lms_enrollments WHERE id = $1 AND user_id = $2",
    )
    .bind(enrollment_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Mark as in_progress if assigned
    if enrollment.status == medbrains_core::lms::LmsEnrollmentStatus::Assigned {
        sqlx::query(
            "UPDATE lms_enrollments SET status = 'in_progress', started_at = now() WHERE id = $1",
        )
        .bind(enrollment_id)
        .execute(&mut *tx)
        .await?;
    }

    let course = sqlx::query_as::<_, LmsCourse>("SELECT * FROM lms_courses WHERE id = $1")
        .bind(enrollment.course_id)
        .fetch_one(&mut *tx)
        .await?;

    let modules = sqlx::query_as::<_, LmsCourseModule>(
        "SELECT * FROM lms_course_modules WHERE course_id = $1 AND is_active = true ORDER BY sort_order",
    )
    .bind(enrollment.course_id)
    .fetch_all(&mut *tx)
    .await?;

    let quizzes = sqlx::query_as::<_, LmsQuiz>(
        "SELECT * FROM lms_quizzes WHERE course_id = $1 AND is_active = true",
    )
    .bind(enrollment.course_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(CourseWithModules {
        course,
        modules,
        quizzes,
    }))
}

/// PUT /api/lms/my/enrollments/{id}/progress
pub async fn update_progress(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(enrollment_id): Path<Uuid>,
    Json(req): Json<UpdateProgressRequest>,
) -> Result<Json<LmsEnrollment>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::my_learning::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let progress = req.progress_percentage.clamp(0, 100);
    let completed = progress >= 100;

    let enrollment = sqlx::query_as::<_, LmsEnrollment>(
        "UPDATE lms_enrollments SET
            progress_percentage = $2,
            last_module_id = $3,
            status = CASE WHEN $4 THEN 'completed'::lms_enrollment_status ELSE 'in_progress'::lms_enrollment_status END,
            completed_at = CASE WHEN $4 THEN now() ELSE completed_at END
         WHERE id = $1 AND user_id = $5 RETURNING *",
    )
    .bind(enrollment_id)
    .bind(progress)
    .bind(req.module_id)
    .bind(completed)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(enrollment))
}

/// POST /api/lms/my/quiz-attempts
pub async fn start_quiz_attempt(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Json(req): Json<StartQuizRequest>,
) -> Result<Json<QuizAttemptStart>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::quizzes::ATTEMPT)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let quiz = sqlx::query_as::<_, LmsQuiz>(
        "SELECT * FROM lms_quizzes WHERE id = $1 AND is_active = true",
    )
    .bind(req.quiz_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Find enrollment
    let enrollment = sqlx::query_as::<_, LmsEnrollment>(
        "SELECT * FROM lms_enrollments
         WHERE user_id = $1 AND course_id = $2 AND status != 'cancelled'",
    )
    .bind(claims.sub)
    .bind(quiz.course_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("Not enrolled in this course".to_owned()))?;

    // Check attempt limit
    let attempt_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM lms_quiz_attempts
         WHERE enrollment_id = $1 AND quiz_id = $2",
    )
    .bind(enrollment.id)
    .bind(req.quiz_id)
    .fetch_one(&mut *tx)
    .await?;

    if attempt_count >= i64::from(quiz.max_attempts) {
        return Err(AppError::BadRequest("Maximum attempts reached".to_owned()));
    }

    // Create attempt
    let attempt_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO lms_quiz_attempts (enrollment_id, quiz_id) VALUES ($1, $2) RETURNING id",
    )
    .bind(enrollment.id)
    .bind(req.quiz_id)
    .fetch_one(&mut *tx)
    .await?;

    // Fetch questions WITHOUT correct_answer
    let questions = sqlx::query_as::<_, LmsQuizQuestionPublic>(
        "SELECT id, quiz_id, question_text, question_type, options, points, sort_order
         FROM lms_quiz_questions WHERE quiz_id = $1 ORDER BY sort_order",
    )
    .bind(req.quiz_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(QuizAttemptStart {
        attempt_id,
        quiz,
        questions,
    }))
}

/// PUT /api/lms/my/quiz-attempts/{id}
pub async fn submit_quiz_attempt(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(attempt_id): Path<Uuid>,
    Json(req): Json<SubmitQuizRequest>,
) -> Result<Json<QuizAttemptResult>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::quizzes::ATTEMPT)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Fetch attempt and verify ownership
    let attempt = sqlx::query_as::<_, LmsQuizAttempt>(
        "SELECT a.* FROM lms_quiz_attempts a
         JOIN lms_enrollments e ON e.id = a.enrollment_id
         WHERE a.id = $1 AND e.user_id = $2 AND a.completed_at IS NULL",
    )
    .bind(attempt_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Fetch quiz for pass percentage
    let quiz = sqlx::query_as::<_, LmsQuiz>("SELECT * FROM lms_quizzes WHERE id = $1")
        .bind(attempt.quiz_id)
        .fetch_one(&mut *tx)
        .await?;

    // Fetch correct answers
    let questions =
        sqlx::query_as::<_, LmsQuizQuestion>("SELECT * FROM lms_quiz_questions WHERE quiz_id = $1")
            .bind(attempt.quiz_id)
            .fetch_all(&mut *tx)
            .await?;

    // Grade
    let mut score = 0i32;
    let mut max_score = 0i32;
    let mut graded_answers = Vec::new();

    for ans in &req.answers {
        if let Some(q) = questions.iter().find(|q| q.id == ans.question_id) {
            max_score += q.points;
            let correct = ans.selected == q.correct_answer;
            if correct {
                score += q.points;
            }
            graded_answers.push(serde_json::json!({
                "question_id": ans.question_id,
                "selected": ans.selected,
                "correct": correct,
                "points": if correct { q.points } else { 0 },
            }));
        }
    }
    // Account for unanswered questions
    for q in &questions {
        if !req.answers.iter().any(|a| a.question_id == q.id) {
            max_score += q.points;
        }
    }

    let percentage = if max_score > 0 {
        (score * 100) / max_score
    } else {
        0
    };
    let passed = percentage >= quiz.pass_percentage;

    // Update attempt
    let updated = sqlx::query_as::<_, LmsQuizAttempt>(
        "UPDATE lms_quiz_attempts SET
            completed_at = now(), score = $2, max_score = $3, passed = $4,
            answers = $5::jsonb
         WHERE id = $1 RETURNING *",
    )
    .bind(attempt_id)
    .bind(score)
    .bind(max_score)
    .bind(passed)
    .bind(serde_json::to_value(&graded_answers).unwrap_or_default())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(QuizAttemptResult {
        attempt: updated,
        passed,
        score,
        max_score,
        pass_percentage: quiz.pass_percentage,
    }))
}

// ══════════════════════════════════════════════════════════
//  Learning Paths
// ══════════════════════════════════════════════════════════

/// GET /api/lms/paths
pub async fn list_paths(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
) -> Result<Json<Vec<LmsLearningPath>>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::paths::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let paths = sqlx::query_as::<_, LmsLearningPath>(
        "SELECT * FROM lms_learning_paths WHERE is_active = true ORDER BY title",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(paths))
}

/// GET /api/lms/paths/{id}
pub async fn get_path(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<LearningPathWithCourses>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::paths::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let path =
        sqlx::query_as::<_, LmsLearningPath>("SELECT * FROM lms_learning_paths WHERE id = $1")
            .bind(id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::NotFound)?;

    let courses = sqlx::query_as::<_, PathCourseRow>(
        "SELECT lpc.id, lpc.course_id, c.title AS course_title, c.code AS course_code,
                lpc.sort_order, lpc.is_required
         FROM lms_learning_path_courses lpc
         JOIN lms_courses c ON c.id = lpc.course_id
         WHERE lpc.path_id = $1
         ORDER BY lpc.sort_order",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(LearningPathWithCourses { path, courses }))
}

/// POST /api/lms/paths
pub async fn create_path(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Json(req): Json<CreatePathRequest>,
) -> Result<Json<LmsLearningPath>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::paths::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let path = sqlx::query_as::<_, LmsLearningPath>(
        "INSERT INTO lms_learning_paths (tenant_id, code, title, description, target_roles, is_mandatory, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&req.code)
    .bind(&req.title)
    .bind(&req.description)
    .bind(req.target_roles.as_ref().unwrap_or(&serde_json::json!([])))
    .bind(req.is_mandatory.unwrap_or(false))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(path))
}

/// PUT /api/lms/paths/{id}
pub async fn update_path(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdatePathRequest>,
) -> Result<Json<LmsLearningPath>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::paths::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let path = sqlx::query_as::<_, LmsLearningPath>(
        "UPDATE lms_learning_paths SET
            title = COALESCE($2, title),
            description = COALESCE($3, description),
            target_roles = COALESCE($4, target_roles),
            is_mandatory = COALESCE($5, is_mandatory),
            is_active = COALESCE($6, is_active)
         WHERE id = $1 RETURNING *",
    )
    .bind(id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(&req.target_roles)
    .bind(req.is_mandatory)
    .bind(req.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(path))
}

/// POST /api/lms/paths/{id}/courses
pub async fn add_path_course(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(path_id): Path<Uuid>,
    Json(req): Json<AddPathCourseRequest>,
) -> Result<Json<LmsLearningPathCourse>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::paths::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let lpc = sqlx::query_as::<_, LmsLearningPathCourse>(
        "INSERT INTO lms_learning_path_courses (path_id, course_id, sort_order, is_required)
         VALUES ($1, $2, COALESCE($3, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM lms_learning_path_courses WHERE path_id = $1)), $4)
         RETURNING *",
    )
    .bind(path_id)
    .bind(req.course_id)
    .bind(req.sort_order)
    .bind(req.is_required.unwrap_or(true))
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(lpc))
}

/// DELETE /`api/lms/paths/{path_id}/courses/{course_id`}
pub async fn remove_path_course(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path((path_id, course_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::paths::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query("DELETE FROM lms_learning_path_courses WHERE path_id = $1 AND course_id = $2")
        .bind(path_id)
        .bind(course_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({"deleted": true})))
}

// ══════════════════════════════════════════════════════════
//  Certificates
// ══════════════════════════════════════════════════════════

/// GET /api/lms/certificates
pub async fn list_certificates(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Query(q): Query<CertificateQuery>,
) -> Result<Json<Vec<LmsCertificate>>, AppError> {
    require_permission(
        &claims,
        medbrains_core::permissions::lms::certificates::LIST,
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let certs = sqlx::query_as::<_, LmsCertificate>(
        "SELECT * FROM lms_certificates
         WHERE ($1::uuid IS NULL OR user_id = $1)
           AND ($2::uuid IS NULL OR course_id = $2)
         ORDER BY issued_at DESC",
    )
    .bind(q.user_id)
    .bind(q.course_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(certs))
}

/// GET /api/lms/my/certificates
pub async fn my_certificates(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
) -> Result<Json<Vec<LmsCertificate>>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::my_learning::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let certs = sqlx::query_as::<_, LmsCertificate>(
        "SELECT * FROM lms_certificates WHERE user_id = $1 ORDER BY issued_at DESC",
    )
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(certs))
}

/// POST /api/lms/certificates
pub async fn issue_certificate(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Json(req): Json<IssueCertificateRequest>,
) -> Result<Json<LmsCertificate>, AppError> {
    require_permission(
        &claims,
        medbrains_core::permissions::lms::certificates::CREATE,
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let expires = req
        .expires_at
        .as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());

    let cert_no = format!(
        "LMS-CERT-{}",
        Uuid::new_v4()
            .to_string()
            .split('-')
            .next()
            .unwrap_or("0000")
    );

    let cert = sqlx::query_as::<_, LmsCertificate>(
        "INSERT INTO lms_certificates (tenant_id, user_id, course_id, path_id, enrollment_id,
                certificate_no, expires_at, issued_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(req.user_id)
    .bind(req.course_id)
    .bind(req.path_id)
    .bind(req.enrollment_id)
    .bind(&cert_no)
    .bind(expires)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(cert))
}

// ══════════════════════════════════════════════════════════
//  Compliance Dashboard
// ══════════════════════════════════════════════════════════

/// GET /api/lms/compliance
pub async fn compliance_overview(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
) -> Result<Json<Vec<LmsComplianceRow>>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::compliance::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, LmsComplianceRow>(
        "SELECT c.id AS course_id, c.title AS course_title, c.is_mandatory,
                COUNT(e.id) AS total_enrolled,
                COUNT(CASE WHEN e.status = 'completed' THEN 1 END) AS completed,
                COUNT(CASE WHEN e.due_date < CURRENT_DATE AND e.status NOT IN ('completed', 'cancelled') THEN 1 END) AS overdue
         FROM lms_courses c
         LEFT JOIN lms_enrollments e ON e.course_id = c.id
         WHERE c.is_active = true
         GROUP BY c.id, c.title, c.is_mandatory
         ORDER BY c.is_mandatory DESC, c.title",
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// GET /api/lms/compliance/courses/{id}
pub async fn compliance_by_course(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(course_id): Path<Uuid>,
) -> Result<Json<Vec<EnrollmentWithCourse>>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::compliance::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, EnrollmentWithCourse>(
        "SELECT e.id, e.user_id, e.course_id, c.title AS course_title, c.code AS course_code,
                c.category, c.is_mandatory, e.status, e.progress_percentage,
                e.due_date, e.assigned_at, e.completed_at
         FROM lms_enrollments e
         JOIN lms_courses c ON c.id = e.course_id
         WHERE e.course_id = $1
         ORDER BY e.status, e.due_date NULLS LAST",
    )
    .bind(course_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// GET /api/lms/compliance/users/{id}
pub async fn compliance_by_user(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Vec<EnrollmentWithCourse>>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::compliance::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, EnrollmentWithCourse>(
        "SELECT e.id, e.user_id, e.course_id, c.title AS course_title, c.code AS course_code,
                c.category, c.is_mandatory, e.status, e.progress_percentage,
                e.due_date, e.assigned_at, e.completed_at
         FROM lms_enrollments e
         JOIN lms_courses c ON c.id = e.course_id
         WHERE e.user_id = $1
         ORDER BY c.is_mandatory DESC, e.status",
    )
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  AI Course Generation
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct AiGenerateRequest {
    pub topic: String,
    pub target_roles: Option<Vec<String>>,
    pub duration_hours: Option<f64>,
    pub num_modules: Option<i32>,
    pub num_quiz_questions: Option<i32>,
    pub category: Option<String>,
    pub language: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct AiGeneratedCourse {
    /// Course title
    pub title: String,
    /// 2-3 sentence course description
    pub description: String,
    /// Category (e.g. safety, clinical, compliance)
    pub category: String,
    /// Duration in hours
    pub duration_hours: f64,
    /// Whether this course is mandatory for target roles
    pub is_mandatory: bool,
    /// Course modules/lessons
    pub modules: Vec<AiGeneratedModule>,
    /// Assessment quiz
    pub quiz: AiGeneratedQuiz,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct AiGeneratedModule {
    /// Module title
    pub title: String,
    /// Brief module summary
    pub description: String,
    /// Module content as JSON with "type" and "body" fields
    #[schemars(with = "std::collections::HashMap<String, String>")]
    pub content: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct AiGeneratedQuiz {
    /// Quiz title
    pub title: String,
    /// Minimum percentage to pass (e.g. 70)
    pub pass_percentage: i32,
    /// Quiz questions
    pub questions: Vec<AiGeneratedQuestion>,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct AiGeneratedQuestion {
    /// The question text
    pub question_text: String,
    /// Question type: `single_choice`, `multiple_choice`, `true_false`
    pub question_type: String,
    /// Answer options with key (A/B/C/D) and text
    pub options: Vec<AiQuestionOption>,
    /// Correct answer key (e.g. "A")
    pub correct_answer: String,
    /// Explanation of why the answer is correct
    pub explanation: String,
}

#[derive(Debug, Serialize, Deserialize, schemars::JsonSchema)]
pub struct AiQuestionOption {
    /// Option key (A, B, C, D)
    pub key: String,
    /// Option text
    pub text: String,
}

/// POST /api/lms/courses/ai-generate — generate a course outline + quiz using AI.
///
/// Uses Rig.rs for type-safe structured extraction via Claude API.
/// Requires `ANTHROPIC_API_KEY` env var. Returns a preview — admin reviews and saves.
pub async fn ai_generate_course(
    Extension(claims): Extension<Claims>,
    State(_state): State<AppState>,
    Json(req): Json<AiGenerateRequest>,
) -> Result<Json<AiGeneratedCourse>, AppError> {
    use rig::client::CompletionClient as _;
    use rig::providers::anthropic;

    require_permission(&claims, medbrains_core::permissions::lms::courses::CREATE)?;

    let api_key = std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| AppError::BadRequest("ANTHROPIC_API_KEY not configured".to_owned()))?;

    let num_modules = req.num_modules.unwrap_or(4);
    let num_questions = req.num_quiz_questions.unwrap_or(10);
    let duration = req.duration_hours.unwrap_or(2.0);
    let roles = req
        .target_roles
        .as_ref()
        .map_or_else(|| "all hospital staff".to_owned(), |r| r.join(", "));
    let lang = req.language.as_deref().unwrap_or("English");
    let category = req.category.as_deref().unwrap_or("general");

    let client = anthropic::Client::new(&api_key)
        .map_err(|e| AppError::BadRequest(format!("Failed to create AI client: {e}")))?;

    let extractor = client
        .extractor::<AiGeneratedCourse>(anthropic::completion::CLAUDE_SONNET_4_6)
        .preamble(
            "You are a medical education expert creating training courses \
             for hospital staff. Generate comprehensive, clinically accurate \
             course content with detailed module text (500-800 words each) \
             and well-crafted quiz questions with explanations.",
        )
        .build();

    let prompt = format!(
        "Generate a training course on: \"{topic}\"\n\
         Target audience: {roles}\n\
         Duration: {duration} hours\n\
         Category: {category}\n\
         Language: {lang}\n\
         Number of modules: {num_modules}\n\
         Number of quiz questions: {num_questions}\n\
         Each module content should have {{\"type\": \"text\", \"body\": \"...\"}} format.\n\
         Quiz questions should be single_choice with 4 options (A/B/C/D).",
        topic = req.topic,
        roles = roles,
        duration = duration,
        category = category,
        lang = lang,
        num_modules = num_modules,
        num_questions = num_questions,
    );

    let generated = extractor
        .extract(&prompt)
        .await
        .map_err(|e| AppError::BadRequest(format!("AI generation failed: {e}")))?;

    Ok(Json(generated))
}

/// POST /api/lms/courses/ai-save — save an AI-generated course after admin review.
pub async fn ai_save_course(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Json(req): Json<AiGeneratedCourse>,
) -> Result<Json<LmsCourse>, AppError> {
    require_permission(&claims, medbrains_core::permissions::lms::courses::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let code = format!(
        "AI-{}",
        Uuid::new_v4()
            .to_string()
            .split('-')
            .next()
            .unwrap_or("0000")
    );
    let dur = rust_decimal::Decimal::try_from(req.duration_hours).ok();

    let course = sqlx::query_as::<_, LmsCourse>(
        "INSERT INTO lms_courses (tenant_id, code, title, description, category,
                duration_hours, is_mandatory, target_roles, content_type, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '[]'::jsonb, 'text'::lms_content_type, $8)
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&code)
    .bind(&req.title)
    .bind(&req.description)
    .bind(&req.category)
    .bind(dur)
    .bind(req.is_mandatory)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    for (i, m) in req.modules.iter().enumerate() {
        sqlx::query(
            "INSERT INTO lms_course_modules (course_id, title, description, sort_order, content)
             VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(course.id)
        .bind(&m.title)
        .bind(&m.description)
        .bind(i as i32)
        .bind(&m.content)
        .execute(&mut *tx)
        .await?;
    }

    let quiz_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO lms_quizzes (course_id, title, pass_percentage, max_attempts)
         VALUES ($1, $2, $3, 3) RETURNING id",
    )
    .bind(course.id)
    .bind(&req.quiz.title)
    .bind(req.quiz.pass_percentage)
    .fetch_one(&mut *tx)
    .await?;

    for (i, q) in req.quiz.questions.iter().enumerate() {
        let options = serde_json::to_value(&q.options).unwrap_or_default();
        let answer = serde_json::Value::String(q.correct_answer.clone());

        sqlx::query(
            "INSERT INTO lms_quiz_questions (quiz_id, question_text, question_type,
                    options, correct_answer, explanation, points, sort_order)
             VALUES ($1, $2, COALESCE($3, 'single_choice')::lms_question_type,
                     $4::jsonb, $5::jsonb, $6, 1, $7)",
        )
        .bind(quiz_id)
        .bind(&q.question_text)
        .bind(&q.question_type)
        .bind(&options)
        .bind(&answer)
        .bind(&q.explanation)
        .bind(i as i32)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(course))
}

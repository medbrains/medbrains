//! In-app test tracking (#4804): test cycles and the results testers record.
//!
//! The cases are computed in the app from the code (menu + role grants +
//! workflows), so the server stores only results: one per case per role per
//! cycle, last answer wins. A tester records for the role they are signed in
//! as — never for another — and only while a cycle is open.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{
        auth::Claims,
        authorization::{is_bypass_role, require_any_permission, require_permission},
    },
    state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TestCycle {
    pub id: Uuid,
    pub name: String,
    pub opened_at: DateTime<Utc>,
    pub closed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TestResult {
    pub id: Uuid,
    pub cycle_id: Uuid,
    pub case_id: String,
    pub role: String,
    pub tester_name: Option<String>,
    pub result: String,
    pub note: Option<String>,
    pub screen_path: Option<String>,
    pub recorded_at: DateTime<Utc>,
    pub recorded_by: Option<String>,
}

const CYCLE_COLS: &str = "id, name, opened_at, closed_at";

async fn tx(
    state: &AppState,
    claims: &Claims,
) -> Result<sqlx::Transaction<'static, sqlx::Postgres>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    Ok(tx)
}

/// `GET /api/qa/cycle` — the open cycle, if any.
pub async fn open_cycle(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Option<TestCycle>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::qa::test_cases::RECORD,
            permissions::qa::test_cycles::MANAGE,
        ],
    )?;
    let mut tx = tx(&state, &claims).await?;
    let cycle = sqlx::query_as::<_, TestCycle>(&format!(
        "SELECT {CYCLE_COLS} FROM qa_test_cycles \
          WHERE tenant_id = $1 AND closed_at IS NULL AND deleted_at IS NULL"
    ))
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(cycle))
}

/// `GET /api/qa/cycles` — every cycle, newest first.
pub async fn list_cycles(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<TestCycle>>, AppError> {
    require_permission(&claims, permissions::qa::test_cycles::MANAGE)?;
    let mut tx = tx(&state, &claims).await?;
    let rows = sqlx::query_as::<_, TestCycle>(&format!(
        "SELECT {CYCLE_COLS} FROM qa_test_cycles WHERE tenant_id = $1 AND deleted_at IS NULL \
          ORDER BY opened_at DESC LIMIT 100"
    ))
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct OpenCycle {
    pub name: String,
}

/// `POST /api/qa/cycles` — open a new cycle; one may be open at a time.
pub async fn create_cycle(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<OpenCycle>,
) -> Result<Json<TestCycle>, AppError> {
    require_permission(&claims, permissions::qa::test_cycles::MANAGE)?;
    let name = body.name.trim();
    if !(3..=120).contains(&name.len()) {
        return Err(AppError::BadRequest(
            "Name the cycle (3 to 120 characters)".to_owned(),
        ));
    }
    let mut tx = tx(&state, &claims).await?;
    let open: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM qa_test_cycles WHERE tenant_id = $1 AND closed_at IS NULL \
           AND deleted_at IS NULL)",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if open {
        return Err(AppError::Conflict(
            "A test cycle is already open — close it first.".to_owned(),
        ));
    }
    let cycle = sqlx::query_as::<_, TestCycle>(&format!(
        "INSERT INTO qa_test_cycles (tenant_id, name, opened_by) VALUES ($1, $2, $3) RETURNING {CYCLE_COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(name)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(cycle))
}

/// `PUT /api/qa/cycles/{id}/close` — results are kept, recording stops.
pub async fn close_cycle(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<TestCycle>, AppError> {
    require_permission(&claims, permissions::qa::test_cycles::MANAGE)?;
    let mut tx = tx(&state, &claims).await?;
    let cycle = sqlx::query_as::<_, TestCycle>(&format!(
        "UPDATE qa_test_cycles SET closed_at = now(), closed_by = $3 \
          WHERE id = $1 AND tenant_id = $2 AND closed_at IS NULL AND deleted_at IS NULL \
         RETURNING {CYCLE_COLS}"
    ))
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Conflict("That cycle is not open.".to_owned()))?;
    tx.commit().await?;
    Ok(Json(cycle))
}

#[derive(Debug, Deserialize)]
pub struct ResultsQuery {
    pub cycle_id: Uuid,
}

/// `GET /api/qa/results?cycle_id=` — a tester gets their own role's results;
/// whoever runs the cycles gets everyone's.
pub async fn list_results(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ResultsQuery>,
) -> Result<Json<Vec<TestResult>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::qa::test_cases::RECORD,
            permissions::qa::test_cycles::MANAGE,
        ],
    )?;
    // In-memory role grant (cannot fail like the ReBAC backend): who sees whose results.
    let manager = is_bypass_role(&claims)
        || claims
            .permissions
            .iter()
            .any(|p| p == permissions::qa::test_cycles::MANAGE);
    let mut tx = tx(&state, &claims).await?;
    let rows = sqlx::query_as::<_, TestResult>(
        "SELECT r.id, r.cycle_id, r.case_id, r.role, r.tester_name, r.result, r.note, r.screen_path, \
                r.recorded_at, u.username AS recorded_by \
           FROM qa_test_results r LEFT JOIN users u ON u.id = r.user_id \
          WHERE r.tenant_id = $1 AND r.cycle_id = $2 AND r.deleted_at IS NULL \
            AND ($3 OR r.role = $4) \
          ORDER BY r.recorded_at DESC LIMIT 20000",
    )
    .bind(claims.tenant_id)
    .bind(q.cycle_id)
    .bind(manager)
    .bind(&claims.role)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Deserialize)]
pub struct RecordResult {
    pub case_id: String,
    pub result: String,
    pub note: Option<String>,
    pub tester_name: Option<String>,
    pub screen_path: Option<String>,
}

fn validate(body: &RecordResult) -> Result<(), AppError> {
    if body.case_id.trim().is_empty() || body.case_id.len() > 200 {
        return Err(AppError::BadRequest("Unknown test case".to_owned()));
    }
    if !matches!(body.result.as_str(), "pass" | "fail" | "blocked") {
        return Err(AppError::BadRequest(
            "Result is pass, fail or blocked".to_owned(),
        ));
    }
    let note = body.note.as_deref().map_or(0, |n| n.trim().len());
    if body.result != "pass" && note < 3 {
        return Err(AppError::BadRequest(
            "Say what went wrong (a few words) for a fail or a block".to_owned(),
        ));
    }
    Ok(())
}

/// `PUT /api/qa/results` — record or change a result for the signed-in role
/// in the open cycle.
pub async fn record_result(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RecordResult>,
) -> Result<Json<TestResult>, AppError> {
    require_permission(&claims, permissions::qa::test_cases::RECORD)?;
    validate(&body)?;
    let mut tx = tx(&state, &claims).await?;
    let cycle: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM qa_test_cycles WHERE tenant_id = $1 AND closed_at IS NULL AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let cycle = cycle.ok_or_else(|| {
        AppError::Conflict(
            "No test cycle is open — ask whoever runs testing to open one.".to_owned(),
        )
    })?;
    let trim = |s: Option<String>, max: usize| {
        s.map(|v| v.trim().chars().take(max).collect::<String>())
            .filter(|v| !v.is_empty())
    };
    let row = sqlx::query_as::<_, TestResult>(
        "WITH r AS ( \
           INSERT INTO qa_test_results (tenant_id, cycle_id, case_id, role, user_id, tester_name, result, \
                                        note, screen_path) \
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
           ON CONFLICT (cycle_id, role, case_id) WHERE deleted_at IS NULL DO UPDATE SET \
             user_id = EXCLUDED.user_id, tester_name = EXCLUDED.tester_name, result = EXCLUDED.result, \
             note = EXCLUDED.note, screen_path = EXCLUDED.screen_path, recorded_at = now(), \
             deleted_at = NULL, deleted_by = NULL, delete_reason = NULL \
           RETURNING *) \
         SELECT r.id, r.cycle_id, r.case_id, r.role, r.tester_name, r.result, r.note, r.screen_path, \
                r.recorded_at, u.username AS recorded_by FROM r LEFT JOIN users u ON u.id = r.user_id",
    )
    .bind(claims.tenant_id)
    .bind(cycle)
    .bind(body.case_id.trim())
    .bind(&claims.role)
    .bind(claims.sub)
    .bind(trim(body.tester_name, 80))
    .bind(&body.result)
    .bind(trim(body.note, 2000))
    .bind(trim(body.screen_path, 300))
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::{RecordResult, validate};

    fn r(result: &str, note: Option<&str>) -> RecordResult {
        RecordResult {
            case_id: "nurse:see:/opd".into(),
            result: result.into(),
            note: note.map(Into::into),
            tester_name: None,
            screen_path: None,
        }
    }

    #[test]
    fn a_fail_or_a_block_must_say_why() {
        assert!(validate(&r("pass", None)).is_ok());
        assert!(validate(&r("fail", None)).is_err());
        assert!(validate(&r("blocked", Some("  "))).is_err());
        assert!(validate(&r("fail", Some("Screen showed an error"))).is_ok());
        assert!(validate(&r("maybe", None)).is_err());
    }
}

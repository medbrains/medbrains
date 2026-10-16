//! The radiology exam catalogue: which exams each modality performs, and
//! the charge code each is billed under. Prices stay in `charge_master`;
//! an exam with no priced charge code bills at zero, and its list row says
//! so (`price` is `None`) so the maker screen can show it.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use medbrains_core::permissions;
use medbrains_core::radiology::RadiologyExam;
use medbrains_core::synonyms::clean_synonyms;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{
    require_any_permission, require_permission,
};
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

const LIMIT_DEFAULT: i64 = 50;
const LIMIT_MAX: i64 = 200;
const CONTRAST_VALUES: [&str; 4] = ["none", "with", "without", "with_and_without"];

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RadiologyExamListItem {
    #[serde(flatten)]
    #[sqlx(flatten)]
    pub exam: RadiologyExam,
    pub modality_code: String,
    pub modality_name: String,
    /// Price of the code billing will use (the exam's charge code, else
    /// `RAD-<modality code>`); `None` when that code is not priced.
    pub price: Option<Decimal>,
    /// The charge code billing uses for this exam.
    pub billing_code: String,
}

#[derive(Debug, Deserialize)]
pub struct ExamListQuery {
    pub modality_id: Option<Uuid>,
    pub search: Option<String>,
    pub limit: Option<i64>,
    /// The maker screen lists retired-from-ordering (inactive) exams too.
    #[serde(default)]
    pub include_inactive: bool,
}

#[derive(Debug, Deserialize)]
pub struct ExamInput {
    pub modality_id: Option<Uuid>,
    pub code: Option<String>,
    pub name: Option<String>,
    pub body_part: Option<String>,
    pub body_part_code: Option<String>,
    pub laterality_required: Option<bool>,
    pub contrast: Option<String>,
    pub synonyms: Option<Vec<String>>,
    pub charge_code: Option<String>,
    pub preparation: Option<String>,
    pub is_active: Option<bool>,
}

// Ranked like the lab test search: exact code / short name, prefix, word
// prefix, contains. Bounded by LIMIT; one tenant's exams are a few hundred.
const LIST_SQL: &str = "\
WITH p AS ( \
  SELECT lower(btrim(COALESCE($3, ''))) AS q, \
         replace(replace(replace(lower(btrim(COALESCE($3, ''))), '\\', '\\\\'), '%', '\\%'), '_', '\\_') AS e \
) \
SELECT e.*, m.code AS modality_code, m.name AS modality_name, cm.base_price AS price, \
       COALESCE(e.charge_code, 'RAD-' || m.code) AS billing_code \
FROM radiology_exams e \
JOIN radiology_modalities m ON m.id = e.modality_id AND m.tenant_id = e.tenant_id \
LEFT JOIN charge_master cm ON cm.tenant_id = e.tenant_id \
     AND cm.code = COALESCE(e.charge_code, 'RAD-' || m.code) \
     AND cm.deleted_at IS NULL AND cm.is_active \
CROSS JOIN p \
WHERE e.tenant_id = $1 AND e.deleted_at IS NULL AND m.deleted_at IS NULL \
  AND ($4 OR (e.is_active AND m.is_active)) \
  AND ($2::uuid IS NULL OR e.modality_id = $2) \
  AND ( p.q = '' \
     OR lower(e.code) LIKE '%' || p.e || '%' \
     OR lower(e.name) LIKE '%' || p.e || '%' \
     OR lower(COALESCE(e.body_part, '')) LIKE '%' || p.e || '%' \
     OR EXISTS (SELECT 1 FROM unnest(e.synonyms) s WHERE lower(s) LIKE p.e || '%') ) \
ORDER BY \
  CASE WHEN p.q = '' THEN 0 \
       WHEN lower(e.code) = p.q OR EXISTS (SELECT 1 FROM unnest(e.synonyms) s WHERE lower(s) = p.q) THEN 0 \
       WHEN lower(e.name) LIKE p.e || '%' THEN 1 \
       WHEN ' ' || regexp_replace(lower(e.name), '[^a-z0-9]+', ' ', 'g') LIKE '% ' || p.e || '%' THEN 2 \
       ELSE 3 END, \
  m.name, e.name \
LIMIT $5";

/// GET /api/radiology/exams
pub async fn list_exams(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<ExamListQuery>,
) -> Result<Json<Vec<RadiologyExamListItem>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::radiology::orders::LIST,
            permissions::radiology::orders::CREATE,
            permissions::radiology::exams::MANAGE,
        ],
    )?;
    let limit = query.limit.map_or(LIMIT_DEFAULT, |n| n.clamp(1, LIMIT_MAX));
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, RadiologyExamListItem>(LIST_SQL)
        .bind(claims.tenant_id)
        .bind(query.modality_id)
        .bind(query.search.as_deref())
        .bind(query.include_inactive)
        .bind(limit)
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/radiology/exams
pub async fn create_exam(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ExamInput>,
) -> Result<Json<RadiologyExam>, AppError> {
    require_permission(&claims, permissions::radiology::exams::MANAGE)?;
    let modality_id = body
        .modality_id
        .ok_or_else(|| AppError::BadRequest("Pick the modality.".to_owned()))?;
    let code = required(body.code.as_deref(), "Enter a code, e.g. CT-BRAIN-P.")?.to_uppercase();
    let name = required(body.name.as_deref(), "Enter the exam name.")?;
    let contrast = contrast_of(body.contrast.as_deref())?.unwrap_or("none");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let exam = sqlx::query_as::<_, RadiologyExam>(
        "INSERT INTO radiology_exams \
         (tenant_id, modality_id, code, name, body_part, body_part_code, laterality_required, \
          contrast, synonyms, charge_code, preparation) \
         SELECT $1, m.id, $3, $4, $5, $6, COALESCE($7, false), $8, $9, $10, $11 \
         FROM radiology_modalities m \
         WHERE m.id = $2 AND m.tenant_id = $1 AND m.deleted_at IS NULL \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(modality_id)
    .bind(&code)
    .bind(name)
    .bind(trimmed(body.body_part.as_deref()))
    .bind(trimmed(body.body_part_code.as_deref()))
    .bind(body.laterality_required)
    .bind(contrast)
    .bind(clean_synonyms(body.synonyms.as_deref()))
    .bind(trimmed(body.charge_code.as_deref()).map(str::to_uppercase))
    .bind(trimmed(body.preparation.as_deref()))
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("That modality is not on file.".to_owned()))?;
    tx.commit().await?;
    Ok(Json(exam))
}

/// PUT /api/radiology/exams/{id} — the code is the exam's identity and does not change.
pub async fn update_exam(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ExamInput>,
) -> Result<Json<RadiologyExam>, AppError> {
    require_permission(&claims, permissions::radiology::exams::MANAGE)?;
    let contrast = contrast_of(body.contrast.as_deref())?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let exam = sqlx::query_as::<_, RadiologyExam>(
        "UPDATE radiology_exams SET \
         name = COALESCE($3, name), \
         modality_id = COALESCE((SELECT id FROM radiology_modalities \
                                 WHERE id = $4 AND tenant_id = $2 AND deleted_at IS NULL), modality_id), \
         body_part = COALESCE($5, body_part), \
         body_part_code = COALESCE($6, body_part_code), \
         laterality_required = COALESCE($7, laterality_required), \
         contrast = COALESCE($8, contrast), \
         synonyms = COALESCE($9, synonyms), \
         charge_code = COALESCE($10, charge_code), \
         preparation = COALESCE($11, preparation), \
         is_active = COALESCE($12, is_active) \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(trimmed(body.name.as_deref()))
    .bind(body.modality_id)
    .bind(body.body_part.as_deref().map(str::trim))
    .bind(body.body_part_code.as_deref().map(str::trim))
    .bind(body.laterality_required)
    .bind(contrast)
    .bind(body.synonyms.as_deref().map(|list| clean_synonyms(Some(list))))
    .bind(body.charge_code.as_deref().map(|c| c.trim().to_uppercase()))
    .bind(body.preparation.as_deref().map(str::trim))
    .bind(body.is_active)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(exam))
}

/// DELETE /api/radiology/exams/{id} — soft delete; past orders keep their exam.
pub async fn delete_exam(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::radiology::exams::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let result = sqlx::query(
        "UPDATE radiology_exams SET deleted_at = now(), \
         deleted_by = NULLIF(current_setting('app.user_id', true), '')::uuid, \
         delete_reason = 'Deleted from the application', is_active = false \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

fn trimmed(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|v| !v.is_empty())
}

fn required<'a>(value: Option<&'a str>, message: &str) -> Result<&'a str, AppError> {
    trimmed(value).ok_or_else(|| AppError::BadRequest(message.to_owned()))
}

fn contrast_of(value: Option<&str>) -> Result<Option<&'static str>, AppError> {
    let Some(raw) = trimmed(value) else {
        return Ok(None);
    };
    CONTRAST_VALUES
        .iter()
        .find(|c| c.eq_ignore_ascii_case(raw))
        .map(|c| Some(*c))
        .ok_or_else(|| AppError::BadRequest(format!("Unknown contrast option: {raw}")))
}

#[cfg(test)]
mod tests {
    use super::contrast_of;

    #[test]
    fn contrast_accepts_only_the_four_options() {
        assert_eq!(contrast_of(Some("WITH")).ok().flatten(), Some("with"));
        assert_eq!(contrast_of(Some(" ")).ok().flatten(), None);
        assert!(contrast_of(Some("iv")).is_err());
    }
}

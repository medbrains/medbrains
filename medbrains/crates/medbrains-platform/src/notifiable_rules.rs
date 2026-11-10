//! The hospital's notifiable-disease list: the national list with its state's
//! overlay (migration 1230, `notifiable_state_overrides`).
//!
//! States notify more than the national IDSP list -- scrub typhus, AES,
//! Kyasanur forest disease -- and the hospital is held to its own state's
//! notification. An override adds a disease, takes a national one off this
//! hospital's list, or corrects its reporting body, timeframe or ICD-11 code.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

/// One disease on this hospital's effective list.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EffectiveDisease {
    pub disease_code: String,
    pub icd11_code: Option<String>,
    pub disease_name: String,
    pub reporting_body: Option<String>,
    pub report_timeframe: Option<String>,
    /// The hospital's overlay set or changed this row.
    pub overridden: bool,
}

#[derive(Debug, Serialize)]
pub struct EffectiveList {
    /// The hospital's state, which its overlay stands for; `None` when the
    /// hospital's address has no state yet.
    pub state_name: Option<String>,
    pub diseases: Vec<EffectiveDisease>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Override {
    pub id: Uuid,
    pub icd10_code: String,
    pub icd11_code: Option<String>,
    pub disease_name: Option<String>,
    pub is_notifiable: bool,
    pub reporting_body: Option<String>,
    pub report_timeframe: Option<String>,
    pub notes: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertOverrideRequest {
    pub icd10_code: String,
    pub icd11_code: Option<String>,
    pub disease_name: Option<String>,
    pub is_notifiable: bool,
    pub reporting_body: Option<String>,
    pub report_timeframe: Option<String>,
    pub notes: Option<String>,
}

const OVERRIDE_COLUMNS: &str = "id, icd10_code, icd11_code, disease_name, is_notifiable, \
     reporting_body, report_timeframe, notes, updated_at";

/// GET /api/ckb/notifiable-list — what this hospital must notify.
pub async fn effective_list(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<EffectiveList>, AppError> {
    require_permission(&claims, permissions::ckb::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let state_name = sqlx::query_scalar::<_, Option<String>>(
        "SELECT gs.name FROM tenants t LEFT JOIN geo_states gs ON gs.id = t.state_id \
          WHERE t.id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .flatten();
    let diseases = sqlx::query_as::<_, EffectiveDisease>(
        "SELECT disease_code, icd11_code, disease_name, reporting_body, report_timeframe, \
                overridden \
           FROM notifiable_effective($1) ORDER BY disease_name LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(EffectiveList {
        state_name,
        diseases,
    }))
}

/// GET /api/ckb/notifiable-overrides — the hospital's overlay rows, including
/// national diseases it has taken off its list.
pub async fn list_overrides(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Override>>, AppError> {
    require_permission(&claims, permissions::ckb::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let sql = format!(
        "SELECT {OVERRIDE_COLUMNS} FROM notifiable_state_overrides \
          WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY icd10_code LIMIT 500"
    );
    let rows = sqlx::query_as::<_, Override>(&sql)
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// Trimmed, upper-cased; empty is absent.
fn code(value: Option<&str>) -> Option<String> {
    value
        .map(|v| v.trim().to_uppercase())
        .filter(|v| !v.is_empty())
}

fn validate(body: &UpsertOverrideRequest) -> Result<String, AppError> {
    let icd10 = code(Some(&body.icd10_code))
        .ok_or_else(|| AppError::BadRequest("Give the disease's ICD-10 code.".to_owned()))?;
    if let Some(tf) = body.report_timeframe.as_deref()
        && !matches!(tf, "24h" | "weekly")
    {
        return Err(AppError::BadRequest(
            "The reporting timeframe is 24h or weekly.".to_owned(),
        ));
    }
    Ok(icd10)
}

/// PUT /api/ckb/notifiable-overrides — add, change or remove a disease on
/// this hospital's list, by its ICD-10 code.
pub async fn upsert_override(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertOverrideRequest>,
) -> Result<Json<Override>, AppError> {
    require_permission(&claims, permissions::ckb::notifiable_rules::MANAGE)?;
    let icd10 = validate(&body)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // A disease the national list does not know needs a name to be reported by.
    let known = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM cds_diagnosis_reference WHERE icd10_code = $1)",
    )
    .bind(&icd10)
    .fetch_one(&mut *tx)
    .await?;
    let name = body
        .disease_name
        .as_deref()
        .map(str::trim)
        .filter(|n| !n.is_empty());
    if body.is_notifiable && !known && name.is_none() {
        return Err(AppError::BadRequest(
            "Name the disease: its code is not on the national list.".to_owned(),
        ));
    }
    let sql = format!(
        "INSERT INTO notifiable_state_overrides \
           (tenant_id, state_code, icd10_code, icd11_code, disease_name, is_notifiable, \
            reporting_body, report_timeframe, notes, created_by) \
         SELECT $1, (SELECT gs.code FROM tenants t JOIN geo_states gs ON gs.id = t.state_id \
                      WHERE t.id = $1), \
                $2, $3, $4, $5, $6, $7, $8, $9 \
         ON CONFLICT (tenant_id, upper(icd10_code)) WHERE deleted_at IS NULL DO UPDATE SET \
           icd11_code = EXCLUDED.icd11_code, disease_name = EXCLUDED.disease_name, \
           is_notifiable = EXCLUDED.is_notifiable, reporting_body = EXCLUDED.reporting_body, \
           report_timeframe = EXCLUDED.report_timeframe, notes = EXCLUDED.notes \
         RETURNING {OVERRIDE_COLUMNS}"
    );
    let row = sqlx::query_as::<_, Override>(&sql)
        .bind(claims.tenant_id)
        .bind(&icd10)
        .bind(code(body.icd11_code.as_deref()))
        .bind(name)
        .bind(body.is_notifiable)
        .bind(
            body.reporting_body
                .as_deref()
                .map(str::trim)
                .filter(|b| !b.is_empty()),
        )
        .bind(body.report_timeframe.as_deref())
        .bind(body.notes.as_deref())
        .bind(claims.sub)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(row))
}

/// DELETE /api/ckb/notifiable-overrides/{id} — back to the national list.
pub async fn delete_override(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::ckb::notifiable_rules::MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let deleted = sqlx::query(
        "UPDATE notifiable_state_overrides \
            SET deleted_at = now(), deleted_by = $3, delete_reason = 'Back to the national list' \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    if deleted.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

#[cfg(test)]
mod tests {
    use super::{UpsertOverrideRequest, code, validate};

    fn req(icd10: &str, timeframe: Option<&str>) -> UpsertOverrideRequest {
        UpsertOverrideRequest {
            icd10_code: icd10.to_owned(),
            icd11_code: None,
            disease_name: None,
            is_notifiable: true,
            reporting_body: None,
            report_timeframe: timeframe.map(str::to_owned),
            notes: None,
        }
    }

    #[test]
    fn codes_are_trimmed_and_upper_cased() {
        assert_eq!(code(Some(" a75.3 ")).as_deref(), Some("A75.3"));
        assert_eq!(code(Some("  ")), None);
    }

    #[test]
    fn an_override_needs_a_code_and_a_known_timeframe() {
        assert!(validate(&req("", None)).is_err());
        assert!(validate(&req("A75.3", Some("monthly"))).is_err());
        assert_eq!(
            validate(&req("a75.3", Some("24h"))).ok().as_deref(),
            Some("A75.3")
        );
    }
}

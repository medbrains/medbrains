//! Injuries on a medico-legal case — the list an injury certificate prints.
//!
//! Each injury is numbered within its case, carries its site (picked on the
//! body: words, FMA code, side), type, size, probable age and weapon, and the
//! examining doctor's opinion of its nature. Appended, never edited: a
//! correction is a new entry. Both routes authorize the case itself.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::body_site::Laterality;
use medbrains_core::emergency::{InjuryNature, InjuryType, MlcInjury};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use medbrains_server_core::validation::ValidationErrors;
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;

const COLUMNS: &str = "id, tenant_id, mlc_case_id, injury_number, injury_type, location, \
     body_site_code, body_site_laterality, size_cm, description, probable_age, probable_weapon, \
     nature, recorded_by, created_at";

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateMlcInjuryRequest {
    pub body_site: String,
    pub body_site_code: Option<String>,
    pub body_site_laterality: Option<Laterality>,
    pub injury_type: InjuryType,
    pub length_cm: Option<Decimal>,
    pub width_cm: Option<Decimal>,
    pub depth_cm: Option<Decimal>,
    pub description: Option<String>,
    pub probable_age: Option<String>,
    pub probable_weapon: Option<String>,
    pub nature: Option<InjuryNature>,
}

/// The size as the certificate prints it: "4.5 × 0.5 × 1 cm", or none.
fn printed_size(dims: [Option<Decimal>; 3]) -> Option<String> {
    let parts: Vec<String> = dims
        .into_iter()
        .flatten()
        .filter(|d| *d > Decimal::ZERO)
        .map(|d| d.normalize().to_string())
        .collect();
    (!parts.is_empty()).then(|| format!("{} cm", parts.join(" × ")))
}

fn non_blank(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|v| !v.is_empty())
}

async fn authorize_case(state: &AppState, claims: &Claims, mlc_id: Uuid) -> Result<(), AppError> {
    medbrains_authz_gate::require_access_via(
        state,
        claims,
        medbrains_authz_gate::links::MLC_CASE,
        mlc_id,
    )
    .await?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "emergency",
    )
    .await
}

/// `GET /api/emergency/mlc/{mlc_id}/injuries`
pub async fn list_mlc_injuries(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(mlc_id): Path<Uuid>,
) -> Result<Json<Vec<MlcInjury>>, AppError> {
    require_permission(&claims, permissions::emergency::mlc_injuries::LIST)?;
    authorize_case(&state, &claims, mlc_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, MlcInjury>(&format!(
        "SELECT {COLUMNS} FROM mlc_injuries \
          WHERE mlc_case_id = $1 AND tenant_id = $2 AND deleted_at IS NULL \
          ORDER BY injury_number"
    ))
    .bind(mlc_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/emergency/mlc/{mlc_id}/injuries`
pub async fn create_mlc_injury(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(mlc_id): Path<Uuid>,
    Json(body): Json<CreateMlcInjuryRequest>,
) -> Result<Json<MlcInjury>, AppError> {
    require_permission(&claims, permissions::emergency::mlc_injuries::CREATE)?;
    let Some(site) = non_blank(Some(&body.body_site)) else {
        let mut errors = ValidationErrors::new();
        errors.add("body_site", "Where on the body is the injury?");
        return Err(AppError::ValidationFailed(errors));
    };
    authorize_case(&state, &claims, mlc_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // Lock the case so two doctors adding at once do not take the same number.
    sqlx::query("SELECT 1 FROM mlc_cases WHERE id = $1 AND tenant_id = $2 FOR UPDATE")
        .bind(mlc_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;
    let row = sqlx::query_as::<_, MlcInjury>(&format!(
        "INSERT INTO mlc_injuries \
           (tenant_id, mlc_case_id, injury_number, injury_type, location, body_site_code, \
            body_site_laterality, size_cm, description, probable_age, probable_weapon, nature, \
            recorded_by) \
         SELECT $1, $2, COALESCE(MAX(injury_number), 0) + 1, $3, $4, $5, $6, $7, $8, $9, $10, \
                $11, $12 \
           FROM mlc_injuries WHERE mlc_case_id = $2 AND tenant_id = $1 \
         RETURNING {COLUMNS}"
    ))
    .bind(claims.tenant_id)
    .bind(mlc_id)
    .bind(body.injury_type.as_str())
    .bind(site)
    .bind(non_blank(body.body_site_code.as_deref()))
    .bind(body.body_site_laterality.map(Laterality::as_str))
    .bind(printed_size([body.length_cm, body.width_cm, body.depth_cm]))
    .bind(non_blank(body.description.as_deref()))
    .bind(non_blank(body.probable_age.as_deref()))
    .bind(non_blank(body.probable_weapon.as_deref()))
    .bind(body.nature.unwrap_or(InjuryNature::Undetermined).as_str())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::printed_size;
    use rust_decimal::Decimal;

    #[test]
    fn the_size_prints_as_the_certificate_reads_it() {
        let d = |s: &str| s.parse::<Decimal>().ok();
        assert_eq!(
            printed_size([d("4.50"), d("0.5"), None]).as_deref(),
            Some("4.5 × 0.5 cm")
        );
        assert_eq!(printed_size([None, None, None]), None);
        assert_eq!(
            printed_size([d("0"), None, None]),
            None,
            "a zero is not a size"
        );
    }
}

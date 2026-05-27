use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::{require_any_permission, require_permission},
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct ListAssetsQuery {
    pub source_type: Option<String>,
    pub source_id: Option<Uuid>,
    pub asset_domain: Option<String>,
    pub asset_category_id: Option<Uuid>,
    pub camp_eligible: Option<bool>,
    pub available_only: Option<bool>,
    pub search: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UnifiedAsset {
    pub tenant_id: Uuid,
    pub source_type: String,
    pub source_id: Uuid,
    pub display_code: Option<String>,
    pub name: String,
    pub asset_domain: String,
    pub asset_category_id: Option<Uuid>,
    pub asset_category_name: Option<String>,
    pub store_category_id: Option<Uuid>,
    pub store_category_name: Option<String>,
    pub department_id: Option<Uuid>,
    pub location_id: Option<Uuid>,
    pub facility_id: Option<Uuid>,
    pub location_label: Option<String>,
    pub status: String,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub serial_number: Option<String>,
    pub barcode_value: Option<String>,
    pub is_active: bool,
    pub is_critical: bool,
    pub camp_eligible: bool,
    pub requires_pm: bool,
    pub requires_calibration: bool,
    pub next_pm_due: Option<NaiveDate>,
    pub next_calibration_due: Option<NaiveDate>,
    pub compliance_state: String,
    pub open_reservation_count: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AssetCategory {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub parent_id: Option<Uuid>,
    pub asset_domain: String,
    pub description: Option<String>,
    pub regulatory_class: Option<String>,
    pub default_pm_frequency: Option<String>,
    pub default_calibration_frequency: Option<String>,
    pub requires_pm: bool,
    pub requires_calibration: bool,
    pub is_camp_eligible: bool,
    pub is_active: bool,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAssetCategoryRequest {
    pub code: Option<String>,
    pub name: String,
    pub parent_id: Option<Uuid>,
    pub asset_domain: String,
    pub description: Option<String>,
    pub regulatory_class: Option<String>,
    pub default_pm_frequency: Option<String>,
    pub default_calibration_frequency: Option<String>,
    pub requires_pm: Option<bool>,
    pub requires_calibration: Option<bool>,
    pub is_camp_eligible: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAssetCategoryRequest {
    pub name: Option<String>,
    pub parent_id: Option<Uuid>,
    pub asset_domain: Option<String>,
    pub description: Option<String>,
    pub regulatory_class: Option<String>,
    pub default_pm_frequency: Option<String>,
    pub default_calibration_frequency: Option<String>,
    pub requires_pm: Option<bool>,
    pub requires_calibration: Option<bool>,
    pub is_camp_eligible: Option<bool>,
    pub is_active: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StoreCategory {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub code: String,
    pub name: String,
    pub parent_id: Option<Uuid>,
    pub store_domain: String,
    pub description: Option<String>,
    pub requires_batch_tracking: bool,
    pub requires_expiry_tracking: bool,
    pub requires_temperature_log: bool,
    pub requires_license_tracking: bool,
    pub is_camp_source: bool,
    pub is_active: bool,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStoreCategoryRequest {
    pub code: Option<String>,
    pub name: String,
    pub parent_id: Option<Uuid>,
    pub store_domain: String,
    pub description: Option<String>,
    pub requires_batch_tracking: Option<bool>,
    pub requires_expiry_tracking: Option<bool>,
    pub requires_temperature_log: Option<bool>,
    pub requires_license_tracking: Option<bool>,
    pub is_camp_source: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStoreCategoryRequest {
    pub name: Option<String>,
    pub parent_id: Option<Uuid>,
    pub store_domain: Option<String>,
    pub description: Option<String>,
    pub requires_batch_tracking: Option<bool>,
    pub requires_expiry_tracking: Option<bool>,
    pub requires_temperature_log: Option<bool>,
    pub requires_license_tracking: Option<bool>,
    pub is_camp_source: Option<bool>,
    pub is_active: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AssetClassification {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub source_type: String,
    pub source_id: Uuid,
    pub asset_category_id: Option<Uuid>,
    pub store_category_id: Option<Uuid>,
    pub asset_domain: String,
    pub criticality: String,
    pub custody_mode: String,
    pub is_camp_eligible: bool,
    pub tags: Vec<String>,
    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertAssetClassificationRequest {
    pub source_type: String,
    pub source_id: Uuid,
    pub asset_category_id: Option<Uuid>,
    pub store_category_id: Option<Uuid>,
    pub asset_domain: String,
    pub criticality: Option<String>,
    pub custody_mode: Option<String>,
    pub is_camp_eligible: Option<bool>,
    pub tags: Option<Vec<String>>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CampAssetCandidateQuery {
    pub source_type: Option<String>,
    pub asset_domain: Option<String>,
    pub asset_category_id: Option<Uuid>,
    pub search: Option<String>,
    pub required_from: Option<DateTime<Utc>>,
    pub required_to: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CampAssetReservation {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub camp_id: Uuid,
    pub asset_classification_id: Option<Uuid>,
    pub source_type: String,
    pub source_id: Uuid,
    pub asset_category_id: Option<Uuid>,
    pub asset_code: Option<String>,
    pub asset_name: String,
    pub asset_snapshot: Value,
    pub required_from: Option<DateTime<Utc>>,
    pub required_to: Option<DateTime<Utc>>,
    pub quantity: i32,
    pub status: String,
    pub is_critical: bool,
    pub requested_by: Option<Uuid>,
    pub reserved_by: Option<Uuid>,
    pub reserved_at: Option<DateTime<Utc>>,
    pub issued_by: Option<Uuid>,
    pub issued_to: Option<Uuid>,
    pub issued_at: Option<DateTime<Utc>>,
    pub returned_by: Option<Uuid>,
    pub returned_at: Option<DateTime<Utc>>,
    pub issue_condition: Option<String>,
    pub return_condition: Option<String>,
    pub damage_notes: Option<String>,
    pub loss_notes: Option<String>,
    pub reconciliation_notes: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCampAssetReservationRequest {
    pub source_type: String,
    pub source_id: Uuid,
    pub asset_category_id: Option<Uuid>,
    pub required_from: Option<DateTime<Utc>>,
    pub required_to: Option<DateTime<Utc>>,
    pub quantity: Option<i32>,
    pub is_critical: Option<bool>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct IssueCampAssetRequest {
    pub issued_to: Option<Uuid>,
    pub issue_condition: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReturnCampAssetRequest {
    pub status: Option<String>,
    pub return_condition: Option<String>,
    pub damage_notes: Option<String>,
    pub loss_notes: Option<String>,
    pub reconciliation_notes: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct CountRow {
    count: Option<i64>,
}

const UNIFIED_ASSETS_SQL: &str = r"
WITH unified AS (
    SELECT
        e.tenant_id,
        'bme_equipment'::text AS source_type,
        e.id AS source_id,
        COALESCE(e.asset_tag, e.barcode_value, e.serial_number) AS display_code,
        e.name,
        COALESCE(cls.asset_domain, ac.asset_domain, 'biomedical') AS asset_domain,
        cls.asset_category_id,
        ac.name AS asset_category_name,
        cls.store_category_id,
        sc.name AS store_category_name,
        e.department_id,
        NULL::uuid AS location_id,
        e.facility_id,
        e.location_description AS location_label,
        e.status::text AS status,
        e.make AS manufacturer,
        e.model,
        e.serial_number,
        e.barcode_value,
        (e.status::text = 'active') AS is_active,
        COALESCE(e.is_critical, cls.criticality IN ('critical', 'high'), false) AS is_critical,
        COALESCE(cls.is_camp_eligible, ac.is_camp_eligible, true) AS camp_eligible,
        COALESCE(ac.requires_pm, true) AS requires_pm,
        COALESCE(ac.requires_calibration, true) AS requires_calibration,
        pm.next_pm_due,
        cal.next_calibration_due,
        CASE
            WHEN e.status::text <> 'active' THEN 'unavailable'
            WHEN cal.next_calibration_due IS NOT NULL AND cal.next_calibration_due < CURRENT_DATE THEN 'calibration_overdue'
            WHEN pm.next_pm_due IS NOT NULL AND pm.next_pm_due < CURRENT_DATE THEN 'pm_overdue'
            ELSE 'ready'
        END AS compliance_state
    FROM bme_equipment e
    LEFT JOIN asset_classifications cls
        ON cls.tenant_id = e.tenant_id
       AND cls.source_type = 'bme_equipment'
       AND cls.source_id = e.id
    LEFT JOIN asset_categories ac ON ac.id = cls.asset_category_id
    LEFT JOIN store_categories sc ON sc.id = cls.store_category_id
    LEFT JOIN LATERAL (
        SELECT MIN(next_due_date) AS next_pm_due
        FROM bme_pm_schedules
        WHERE tenant_id = e.tenant_id AND equipment_id = e.id AND is_active
    ) pm ON true
    LEFT JOIN LATERAL (
        SELECT MIN(next_due_date) AS next_calibration_due
        FROM bme_calibrations
        WHERE tenant_id = e.tenant_id AND equipment_id = e.id AND NOT is_locked
    ) cal ON true

    UNION ALL

    SELECT
        e.tenant_id,
        'equipment'::text AS source_type,
        e.id AS source_id,
        COALESCE(e.equipment_code, e.asset_tag, e.serial_number) AS display_code,
        e.name,
        COALESCE(cls.asset_domain, ac.asset_domain, 'general') AS asset_domain,
        cls.asset_category_id,
        COALESCE(ac.name, e.category) AS asset_category_name,
        cls.store_category_id,
        sc.name AS store_category_name,
        e.department_id,
        e.location_id,
        NULL::uuid AS facility_id,
        NULL::text AS location_label,
        COALESCE(NULLIF(e.status, ''), 'active') AS status,
        e.manufacturer,
        e.model,
        e.serial_number,
        NULL::text AS barcode_value,
        COALESCE(NULLIF(e.status, ''), 'active') NOT IN ('inactive', 'retired', 'condemned', 'disposed', 'out_of_service') AS is_active,
        COALESCE(cls.criticality IN ('critical', 'high'), false) AS is_critical,
        COALESCE(cls.is_camp_eligible, ac.is_camp_eligible, true) AS camp_eligible,
        COALESCE(ac.requires_pm, true) AS requires_pm,
        COALESCE(ac.requires_calibration, false) AS requires_calibration,
        NULL::date AS next_pm_due,
        NULL::date AS next_calibration_due,
        CASE
            WHEN COALESCE(NULLIF(e.status, ''), 'active') IN ('inactive', 'retired', 'condemned', 'disposed', 'out_of_service') THEN 'unavailable'
            ELSE 'ready'
        END AS compliance_state
    FROM equipment e
    LEFT JOIN asset_classifications cls
        ON cls.tenant_id = e.tenant_id
       AND cls.source_type = 'equipment'
       AND cls.source_id = e.id
    LEFT JOIN asset_categories ac ON ac.id = cls.asset_category_id
    LEFT JOIN store_categories sc ON sc.id = cls.store_category_id

    UNION ALL

    SELECT
        e.tenant_id,
        'fms_fire_equipment'::text AS source_type,
        e.id AS source_id,
        COALESCE(e.barcode_value, e.qr_code_value, e.serial_number) AS display_code,
        e.name,
        COALESCE(cls.asset_domain, ac.asset_domain, 'fire_safety') AS asset_domain,
        cls.asset_category_id,
        COALESCE(ac.name, e.equipment_type::text) AS asset_category_name,
        cls.store_category_id,
        sc.name AS store_category_name,
        e.department_id,
        e.location_id,
        NULL::uuid AS facility_id,
        NULL::text AS location_label,
        CASE WHEN e.is_active THEN 'active' ELSE 'inactive' END AS status,
        e.make AS manufacturer,
        NULL::text AS model,
        e.serial_number,
        e.barcode_value,
        e.is_active,
        COALESCE(cls.criticality IN ('critical', 'high'), false) AS is_critical,
        COALESCE(cls.is_camp_eligible, ac.is_camp_eligible, true) AS camp_eligible,
        COALESCE(ac.requires_pm, true) AS requires_pm,
        false AS requires_calibration,
        e.next_refill_date AS next_pm_due,
        NULL::date AS next_calibration_due,
        CASE
            WHEN NOT e.is_active THEN 'unavailable'
            WHEN e.expiry_date IS NOT NULL AND e.expiry_date < CURRENT_DATE THEN 'expired'
            WHEN e.next_refill_date IS NOT NULL AND e.next_refill_date < CURRENT_DATE THEN 'refill_overdue'
            ELSE 'ready'
        END AS compliance_state
    FROM fms_fire_equipment e
    LEFT JOIN asset_classifications cls
        ON cls.tenant_id = e.tenant_id
       AND cls.source_type = 'fms_fire_equipment'
       AND cls.source_id = e.id
    LEFT JOIN asset_categories ac ON ac.id = cls.asset_category_id
    LEFT JOIN store_categories sc ON sc.id = cls.store_category_id

    UNION ALL

    SELECT
        i.tenant_id,
        'cssd_instrument'::text AS source_type,
        i.id AS source_id,
        i.barcode AS display_code,
        i.name,
        COALESCE(cls.asset_domain, ac.asset_domain, 'ot_cssd') AS asset_domain,
        cls.asset_category_id,
        COALESCE(ac.name, i.category) AS asset_category_name,
        cls.store_category_id,
        sc.name AS store_category_name,
        NULL::uuid AS department_id,
        NULL::uuid AS location_id,
        NULL::uuid AS facility_id,
        NULL::text AS location_label,
        i.status::text AS status,
        i.manufacturer,
        NULL::text AS model,
        NULL::text AS serial_number,
        i.barcode AS barcode_value,
        i.status::text NOT IN ('condemned', 'lost') AS is_active,
        COALESCE(cls.criticality IN ('critical', 'high'), false) AS is_critical,
        COALESCE(cls.is_camp_eligible, ac.is_camp_eligible, false) AS camp_eligible,
        COALESCE(ac.requires_pm, false) AS requires_pm,
        COALESCE(ac.requires_calibration, false) AS requires_calibration,
        NULL::date AS next_pm_due,
        NULL::date AS next_calibration_due,
        CASE
            WHEN i.status::text IN ('available', 'sterile') THEN 'ready'
            ELSE 'unavailable'
        END AS compliance_state
    FROM cssd_instruments i
    LEFT JOIN asset_classifications cls
        ON cls.tenant_id = i.tenant_id
       AND cls.source_type = 'cssd_instrument'
       AND cls.source_id = i.id
    LEFT JOIN asset_categories ac ON ac.id = cls.asset_category_id
    LEFT JOIN store_categories sc ON sc.id = cls.store_category_id

    UNION ALL

    SELECT
        s.tenant_id,
        'cssd_sterilizer'::text AS source_type,
        s.id AS source_id,
        s.serial_number AS display_code,
        s.name,
        COALESCE(cls.asset_domain, ac.asset_domain, 'ot_cssd') AS asset_domain,
        cls.asset_category_id,
        COALESCE(ac.name, s.method::text) AS asset_category_name,
        cls.store_category_id,
        sc.name AS store_category_name,
        NULL::uuid AS department_id,
        NULL::uuid AS location_id,
        NULL::uuid AS facility_id,
        s.location AS location_label,
        CASE WHEN s.is_active THEN 'active' ELSE 'inactive' END AS status,
        NULL::text AS manufacturer,
        s.model,
        s.serial_number,
        NULL::text AS barcode_value,
        s.is_active,
        COALESCE(cls.criticality IN ('critical', 'high'), true) AS is_critical,
        COALESCE(cls.is_camp_eligible, ac.is_camp_eligible, false) AS camp_eligible,
        COALESCE(ac.requires_pm, true) AS requires_pm,
        COALESCE(ac.requires_calibration, false) AS requires_calibration,
        s.next_maintenance_at::date AS next_pm_due,
        NULL::date AS next_calibration_due,
        CASE
            WHEN NOT s.is_active THEN 'unavailable'
            WHEN s.next_maintenance_at IS NOT NULL AND s.next_maintenance_at::date < CURRENT_DATE THEN 'pm_overdue'
            ELSE 'ready'
        END AS compliance_state
    FROM cssd_sterilizers s
    LEFT JOIN asset_classifications cls
        ON cls.tenant_id = s.tenant_id
       AND cls.source_type = 'cssd_sterilizer'
       AND cls.source_id = s.id
    LEFT JOIN asset_categories ac ON ac.id = cls.asset_category_id
    LEFT JOIN store_categories sc ON sc.id = cls.store_category_id

    UNION ALL

    SELECT
        l.tenant_id,
        'linen_item'::text AS source_type,
        l.id AS source_id,
        l.barcode AS display_code,
        l.item_type AS name,
        COALESCE(cls.asset_domain, ac.asset_domain, 'housekeeping_laundry') AS asset_domain,
        cls.asset_category_id,
        ac.name AS asset_category_name,
        cls.store_category_id,
        sc.name AS store_category_name,
        NULL::uuid AS department_id,
        NULL::uuid AS location_id,
        NULL::uuid AS facility_id,
        NULL::text AS location_label,
        l.current_status::text AS status,
        NULL::text AS manufacturer,
        NULL::text AS model,
        NULL::text AS serial_number,
        l.barcode AS barcode_value,
        l.condemned_date IS NULL AND l.current_status::text <> 'condemned' AS is_active,
        false AS is_critical,
        COALESCE(cls.is_camp_eligible, ac.is_camp_eligible, false) AS camp_eligible,
        false AS requires_pm,
        false AS requires_calibration,
        NULL::date AS next_pm_due,
        NULL::date AS next_calibration_due,
        CASE
            WHEN l.condemned_date IS NOT NULL OR l.current_status::text = 'condemned' THEN 'unavailable'
            ELSE 'ready'
        END AS compliance_state
    FROM linen_items l
    LEFT JOIN asset_classifications cls
        ON cls.tenant_id = l.tenant_id
       AND cls.source_type = 'linen_item'
       AND cls.source_id = l.id
    LEFT JOIN asset_categories ac ON ac.id = cls.asset_category_id
    LEFT JOIN store_categories sc ON sc.id = cls.store_category_id
)
SELECT
    unified.*,
    COALESCE(reservations.open_reservation_count, 0)::bigint AS open_reservation_count
FROM unified
LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint AS open_reservation_count
    FROM camp_asset_reservations r
    WHERE r.tenant_id = unified.tenant_id
      AND r.source_type = unified.source_type
      AND r.source_id = unified.source_id
      AND r.status IN ('requested', 'reserved', 'issued')
) reservations ON true
WHERE ($1::text IS NULL OR unified.source_type = $1)
  AND ($2::text IS NULL OR unified.asset_domain = $2)
  AND ($3::uuid IS NULL OR unified.asset_category_id = $3)
  AND ($4::bool IS NULL OR unified.camp_eligible = $4)
  AND ($5::text IS NULL OR (
      lower(unified.name) LIKE lower($5)
      OR lower(COALESCE(unified.display_code, '')) LIKE lower($5)
      OR lower(COALESCE(unified.serial_number, '')) LIKE lower($5)
      OR lower(COALESCE(unified.barcode_value, '')) LIKE lower($5)
  ))
  AND ($6::uuid IS NULL OR unified.source_id = $6)
  AND ($7::bool IS NULL OR $7 = false OR COALESCE(reservations.open_reservation_count, 0) = 0)
ORDER BY unified.name
LIMIT 500
";

fn normalized_code(value: Option<&str>, fallback: &str) -> String {
    let source = value
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .unwrap_or(fallback);
    let mut output = String::with_capacity(source.len());
    let mut last_underscore = false;
    for character in source.chars() {
        if character.is_ascii_alphanumeric() {
            output.push(character.to_ascii_uppercase());
            last_underscore = false;
        } else if !last_underscore {
            output.push('_');
            last_underscore = true;
        }
    }
    let trimmed = output.trim_matches('_').to_owned();
    if trimmed.is_empty() {
        "CATEGORY".to_owned()
    } else {
        trimmed
    }
}

fn normalized_search(search: Option<String>) -> Option<String> {
    search
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .map(|value| format!("%{value}%"))
}

fn validate_reservation_window(
    required_from: Option<DateTime<Utc>>,
    required_to: Option<DateTime<Utc>>,
) -> Result<(), AppError> {
    if let (Some(from), Some(to)) = (required_from, required_to)
        && to < from
    {
        return Err(AppError::BadRequest(
            "required_to must be after required_from".to_owned(),
        ));
    }
    Ok(())
}

async fn fetch_asset(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    source_type: &str,
    source_id: Uuid,
) -> Result<UnifiedAsset, AppError> {
    sqlx::query_as::<_, UnifiedAsset>(UNIFIED_ASSETS_SQL)
        .bind(Some(source_type))
        .bind(Option::<String>::None)
        .bind(Option::<Uuid>::None)
        .bind(Option::<bool>::None)
        .bind(Option::<String>::None)
        .bind(Some(source_id))
        .bind(Option::<bool>::None)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

async fn overlapping_reservations(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    source_type: &str,
    source_id: Uuid,
    required_from: Option<DateTime<Utc>>,
    required_to: Option<DateTime<Utc>>,
    exclude_id: Option<Uuid>,
) -> Result<i64, AppError> {
    let row = sqlx::query_as::<_, CountRow>(
        "SELECT COUNT(*)::bigint AS count \
         FROM camp_asset_reservations \
         WHERE tenant_id = $1 \
           AND source_type = $2 \
           AND source_id = $3 \
           AND status IN ('requested', 'reserved', 'issued') \
           AND ($4::timestamptz IS NULL OR required_to IS NULL OR required_to >= $4) \
           AND ($5::timestamptz IS NULL OR required_from IS NULL OR required_from <= $5) \
           AND ($6::uuid IS NULL OR id <> $6)",
    )
    .bind(tenant_id)
    .bind(source_type)
    .bind(source_id)
    .bind(required_from)
    .bind(required_to)
    .bind(exclude_id)
    .fetch_one(&mut **tx)
    .await?;

    Ok(row.count.unwrap_or(0))
}

pub async fn list_assets(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListAssetsQuery>,
) -> Result<Json<Vec<UnifiedAsset>>, AppError> {
    require_permission(&claims, permissions::assets::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, UnifiedAsset>(UNIFIED_ASSETS_SQL)
        .bind(params.source_type)
        .bind(params.asset_domain)
        .bind(params.asset_category_id)
        .bind(params.camp_eligible)
        .bind(normalized_search(params.search))
        .bind(params.source_id)
        .bind(params.available_only)
        .fetch_all(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn list_asset_categories(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<AssetCategory>>, AppError> {
    require_permission(&claims, permissions::assets::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, AssetCategory>(
        "SELECT * FROM asset_categories \
         WHERE tenant_id IS NULL OR tenant_id = $1 \
         ORDER BY sort_order, asset_domain, name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_asset_category(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateAssetCategoryRequest>,
) -> Result<Json<AssetCategory>, AppError> {
    require_permission(&claims, permissions::assets::MANAGE)?;

    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest(
            "asset category name is required".to_owned(),
        ));
    }
    let code = normalized_code(body.code.as_deref(), &body.name);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AssetCategory>(
        "INSERT INTO asset_categories \
         (tenant_id, code, name, parent_id, asset_domain, description, regulatory_class, \
          default_pm_frequency, default_calibration_frequency, requires_pm, \
          requires_calibration, is_camp_eligible, sort_order) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, false), \
                 COALESCE($11, false), COALESCE($12, false), COALESCE($13, 0)) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(code)
    .bind(body.name.trim())
    .bind(body.parent_id)
    .bind(body.asset_domain)
    .bind(body.description)
    .bind(body.regulatory_class)
    .bind(body.default_pm_frequency)
    .bind(body.default_calibration_frequency)
    .bind(body.requires_pm)
    .bind(body.requires_calibration)
    .bind(body.is_camp_eligible)
    .bind(body.sort_order)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_asset_category(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateAssetCategoryRequest>,
) -> Result<Json<AssetCategory>, AppError> {
    require_permission(&claims, permissions::assets::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, AssetCategory>(
        "UPDATE asset_categories SET \
         name = COALESCE($2, name), \
         parent_id = COALESCE($3, parent_id), \
         asset_domain = COALESCE($4, asset_domain), \
         description = COALESCE($5, description), \
         regulatory_class = COALESCE($6, regulatory_class), \
         default_pm_frequency = COALESCE($7, default_pm_frequency), \
         default_calibration_frequency = COALESCE($8, default_calibration_frequency), \
         requires_pm = COALESCE($9, requires_pm), \
         requires_calibration = COALESCE($10, requires_calibration), \
         is_camp_eligible = COALESCE($11, is_camp_eligible), \
         is_active = COALESCE($12, is_active), \
         sort_order = COALESCE($13, sort_order) \
         WHERE id = $1 AND tenant_id = $14 \
         RETURNING *",
    )
    .bind(id)
    .bind(body.name)
    .bind(body.parent_id)
    .bind(body.asset_domain)
    .bind(body.description)
    .bind(body.regulatory_class)
    .bind(body.default_pm_frequency)
    .bind(body.default_calibration_frequency)
    .bind(body.requires_pm)
    .bind(body.requires_calibration)
    .bind(body.is_camp_eligible)
    .bind(body.is_active)
    .bind(body.sort_order)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_store_categories(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<StoreCategory>>, AppError> {
    require_permission(&claims, permissions::assets::LIST)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, StoreCategory>(
        "SELECT * FROM store_categories \
         WHERE tenant_id IS NULL OR tenant_id = $1 \
         ORDER BY sort_order, store_domain, name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_store_category(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateStoreCategoryRequest>,
) -> Result<Json<StoreCategory>, AppError> {
    require_permission(&claims, permissions::assets::MANAGE)?;

    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest(
            "store category name is required".to_owned(),
        ));
    }
    let code = normalized_code(body.code.as_deref(), &body.name);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, StoreCategory>(
        "INSERT INTO store_categories \
         (tenant_id, code, name, parent_id, store_domain, description, \
          requires_batch_tracking, requires_expiry_tracking, requires_temperature_log, \
          requires_license_tracking, is_camp_source, sort_order) \
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, false), COALESCE($8, false), \
                 COALESCE($9, false), COALESCE($10, false), COALESCE($11, false), \
                 COALESCE($12, 0)) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(code)
    .bind(body.name.trim())
    .bind(body.parent_id)
    .bind(body.store_domain)
    .bind(body.description)
    .bind(body.requires_batch_tracking)
    .bind(body.requires_expiry_tracking)
    .bind(body.requires_temperature_log)
    .bind(body.requires_license_tracking)
    .bind(body.is_camp_source)
    .bind(body.sort_order)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_store_category(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateStoreCategoryRequest>,
) -> Result<Json<StoreCategory>, AppError> {
    require_permission(&claims, permissions::assets::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, StoreCategory>(
        "UPDATE store_categories SET \
         name = COALESCE($2, name), \
         parent_id = COALESCE($3, parent_id), \
         store_domain = COALESCE($4, store_domain), \
         description = COALESCE($5, description), \
         requires_batch_tracking = COALESCE($6, requires_batch_tracking), \
         requires_expiry_tracking = COALESCE($7, requires_expiry_tracking), \
         requires_temperature_log = COALESCE($8, requires_temperature_log), \
         requires_license_tracking = COALESCE($9, requires_license_tracking), \
         is_camp_source = COALESCE($10, is_camp_source), \
         is_active = COALESCE($11, is_active), \
         sort_order = COALESCE($12, sort_order) \
         WHERE id = $1 AND tenant_id = $13 \
         RETURNING *",
    )
    .bind(id)
    .bind(body.name)
    .bind(body.parent_id)
    .bind(body.store_domain)
    .bind(body.description)
    .bind(body.requires_batch_tracking)
    .bind(body.requires_expiry_tracking)
    .bind(body.requires_temperature_log)
    .bind(body.requires_license_tracking)
    .bind(body.is_camp_source)
    .bind(body.is_active)
    .bind(body.sort_order)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn upsert_asset_classification(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertAssetClassificationRequest>,
) -> Result<Json<AssetClassification>, AppError> {
    require_permission(&claims, permissions::assets::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let _asset = fetch_asset(&mut tx, &body.source_type, body.source_id).await?;

    let row = sqlx::query_as::<_, AssetClassification>(
        "INSERT INTO asset_classifications \
         (tenant_id, source_type, source_id, asset_category_id, store_category_id, asset_domain, \
          criticality, custody_mode, is_camp_eligible, tags, notes, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'routine'), \
                 COALESCE($8, 'asset_tagged'), COALESCE($9, false), \
                 COALESCE($10, ARRAY[]::text[]), $11, $12) \
         ON CONFLICT (tenant_id, source_type, source_id) DO UPDATE SET \
           asset_category_id = EXCLUDED.asset_category_id, \
           store_category_id = EXCLUDED.store_category_id, \
           asset_domain = EXCLUDED.asset_domain, \
           criticality = EXCLUDED.criticality, \
           custody_mode = EXCLUDED.custody_mode, \
           is_camp_eligible = EXCLUDED.is_camp_eligible, \
           tags = EXCLUDED.tags, \
           notes = EXCLUDED.notes \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.source_type)
    .bind(body.source_id)
    .bind(body.asset_category_id)
    .bind(body.store_category_id)
    .bind(body.asset_domain)
    .bind(body.criticality)
    .bind(body.custody_mode)
    .bind(body.is_camp_eligible)
    .bind(body.tags)
    .bind(body.notes)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_camp_asset_candidates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
    Query(params): Query<CampAssetCandidateQuery>,
) -> Result<Json<Vec<UnifiedAsset>>, AppError> {
    require_any_permission(
        &claims,
        &[permissions::camp::LIST, permissions::camp::assets::MANAGE],
    )?;
    require_permission(&claims, permissions::assets::LIST)?;
    validate_reservation_window(params.required_from, params.required_to)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query_scalar::<_, Uuid>("SELECT id FROM camps WHERE tenant_id = $1 AND id = $2")
        .bind(claims.tenant_id)
        .bind(camp_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    let mut rows = sqlx::query_as::<_, UnifiedAsset>(UNIFIED_ASSETS_SQL)
        .bind(params.source_type)
        .bind(params.asset_domain)
        .bind(params.asset_category_id)
        .bind(Some(true))
        .bind(normalized_search(params.search))
        .bind(Option::<Uuid>::None)
        .bind(Some(true))
        .fetch_all(&mut *tx)
        .await?;

    if params.required_from.is_some() || params.required_to.is_some() {
        let mut available = Vec::with_capacity(rows.len());
        for asset in rows {
            let overlaps = overlapping_reservations(
                &mut tx,
                claims.tenant_id,
                &asset.source_type,
                asset.source_id,
                params.required_from,
                params.required_to,
                None,
            )
            .await?;
            if overlaps == 0 {
                available.push(asset);
            }
        }
        rows = available;
    }

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn list_camp_asset_reservations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
) -> Result<Json<Vec<CampAssetReservation>>, AppError> {
    require_any_permission(
        &claims,
        &[permissions::camp::LIST, permissions::camp::assets::MANAGE],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CampAssetReservation>(
        "SELECT * FROM camp_asset_reservations \
         WHERE tenant_id = $1 AND camp_id = $2 \
         ORDER BY created_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_camp_asset_reservation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(camp_id): Path<Uuid>,
    Json(body): Json<CreateCampAssetReservationRequest>,
) -> Result<Json<CampAssetReservation>, AppError> {
    require_permission(&claims, permissions::camp::assets::MANAGE)?;
    require_permission(&claims, permissions::assets::RESERVE)?;
    validate_reservation_window(body.required_from, body.required_to)?;

    let quantity = body.quantity.unwrap_or(1);
    if quantity <= 0 {
        return Err(AppError::BadRequest(
            "reservation quantity must be greater than zero".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query_scalar::<_, Uuid>("SELECT id FROM camps WHERE tenant_id = $1 AND id = $2")
        .bind(claims.tenant_id)
        .bind(camp_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?;

    let asset = fetch_asset(&mut tx, &body.source_type, body.source_id).await?;
    if !asset.is_active || asset.compliance_state == "unavailable" {
        return Err(AppError::BadRequest(format!(
            "asset is not available for camp issue: {}",
            asset.name
        )));
    }

    let overlaps = overlapping_reservations(
        &mut tx,
        claims.tenant_id,
        &body.source_type,
        body.source_id,
        body.required_from,
        body.required_to,
        None,
    )
    .await?;
    if overlaps > 0 {
        return Err(AppError::Conflict(
            "asset already has an open reservation for the selected window".to_owned(),
        ));
    }

    let classification_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM asset_classifications \
         WHERE tenant_id = $1 AND source_type = $2 AND source_id = $3",
    )
    .bind(claims.tenant_id)
    .bind(&body.source_type)
    .bind(body.source_id)
    .fetch_optional(&mut *tx)
    .await?;

    let snapshot = serde_json::json!({
        "source_type": asset.source_type,
        "source_id": asset.source_id,
        "display_code": asset.display_code,
        "name": asset.name,
        "asset_domain": asset.asset_domain,
        "asset_category_name": asset.asset_category_name,
        "status": asset.status,
        "manufacturer": asset.manufacturer,
        "model": asset.model,
        "serial_number": asset.serial_number,
        "barcode_value": asset.barcode_value,
        "compliance_state": asset.compliance_state,
        "next_pm_due": asset.next_pm_due,
        "next_calibration_due": asset.next_calibration_due
    });

    let row = sqlx::query_as::<_, CampAssetReservation>(
        "INSERT INTO camp_asset_reservations \
         (tenant_id, camp_id, asset_classification_id, source_type, source_id, \
          asset_category_id, asset_code, asset_name, asset_snapshot, required_from, \
          required_to, quantity, status, is_critical, requested_by, reserved_by, \
          reserved_at, notes) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'reserved', \
                 COALESCE($13, false), $14, $14, now(), $15) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(camp_id)
    .bind(classification_id)
    .bind(body.source_type)
    .bind(body.source_id)
    .bind(body.asset_category_id.or(asset.asset_category_id))
    .bind(asset.display_code)
    .bind(asset.name)
    .bind(snapshot)
    .bind(body.required_from)
    .bind(body.required_to)
    .bind(quantity)
    .bind(body.is_critical.or(Some(asset.is_critical)))
    .bind(claims.sub)
    .bind(body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn issue_camp_asset_reservation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<IssueCampAssetRequest>,
) -> Result<Json<CampAssetReservation>, AppError> {
    require_permission(&claims, permissions::camp::assets::MANAGE)?;
    require_permission(&claims, permissions::assets::ISSUE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampAssetReservation>(
        "UPDATE camp_asset_reservations SET \
         status = 'issued', \
         issued_by = $2, \
         issued_to = $3, \
         issued_at = now(), \
         issue_condition = COALESCE($4, issue_condition), \
         notes = COALESCE($5, notes) \
         WHERE id = $1 AND tenant_id = $6 AND status IN ('requested', 'reserved') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.sub)
    .bind(body.issued_to)
    .bind(body.issue_condition)
    .bind(body.notes)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn return_camp_asset_reservation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReturnCampAssetRequest>,
) -> Result<Json<CampAssetReservation>, AppError> {
    require_permission(&claims, permissions::camp::assets::MANAGE)?;
    require_permission(&claims, permissions::assets::RETURN)?;

    let status = match body.status.as_deref().unwrap_or("returned") {
        "returned" => "returned",
        "damaged" => "damaged",
        "lost" => "lost",
        other => {
            return Err(AppError::BadRequest(format!(
                "invalid asset return status: {other}"
            )));
        }
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampAssetReservation>(
        "UPDATE camp_asset_reservations SET \
         status = $2, \
         returned_by = $3, \
         returned_at = now(), \
         return_condition = COALESCE($4, return_condition), \
         damage_notes = COALESCE($5, damage_notes), \
         loss_notes = COALESCE($6, loss_notes), \
         reconciliation_notes = COALESCE($7, reconciliation_notes), \
         notes = COALESCE($8, notes) \
         WHERE id = $1 AND tenant_id = $9 AND status IN ('issued', 'damaged', 'lost') \
         RETURNING *",
    )
    .bind(id)
    .bind(status)
    .bind(claims.sub)
    .bind(body.return_condition)
    .bind(body.damage_notes)
    .bind(body.loss_notes)
    .bind(body.reconciliation_notes)
    .bind(body.notes)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn cancel_camp_asset_reservation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CampAssetReservation>, AppError> {
    require_permission(&claims, permissions::camp::assets::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CampAssetReservation>(
        "UPDATE camp_asset_reservations SET status = 'cancelled' \
         WHERE id = $1 AND tenant_id = $2 AND status IN ('requested', 'reserved') \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(row))
}

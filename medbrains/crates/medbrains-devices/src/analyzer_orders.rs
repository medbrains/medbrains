//! Orders out to an analyzer (#227).
//!
//! An analyzer runs a sample only once it knows what to run on it. The lab
//! bridge polls this worklist for its device: samples collected in the last
//! day, for tests in the device's department, not yet delivered to it. It
//! sends each as an HL7 ORM to the analyzer and reports back what the
//! analyzer acknowledged. Every send is an outbound `device_messages` row on
//! the order, so the lab sees on the device screen what went where.

use axum::{Extension, Json, extract::Path, extract::State};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;

/// A failed order is retried on later polls, but not forever.
const MAX_FAILED_SENDS: i64 = 5;
/// Orders handed to the bridge per poll.
const PAGE: i64 = 50;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AnalyzerOrder {
    pub order_id: Uuid,
    pub sample_barcode: String,
    pub sample_type: Option<String>,
    pub is_stat: bool,
    pub collected_at: chrono::DateTime<chrono::Utc>,
    pub test_code: String,
    pub test_name: String,
    pub uhid: String,
    pub first_name: String,
    pub last_name: Option<String>,
    pub date_of_birth: Option<chrono::NaiveDate>,
    pub gender: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Analyzer {
    pub name: String,
    pub host: Option<String>,
    pub port: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct AnalyzerWorklist {
    pub analyzer: Analyzer,
    pub orders: Vec<AnalyzerOrder>,
}

pub async fn list_analyzer_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(device_id): Path<Uuid>,
) -> Result<Json<AnalyzerWorklist>, AppError> {
    super::require_permission(&claims, permissions::devices::orders::SEND)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let analyzer = sqlx::query_as::<_, Analyzer>(
        "SELECT name, hostname AS host, port FROM device_instances \
          WHERE id = $1 AND tenant_id = $2 AND is_active AND deleted_at IS NULL",
    )
    .bind(device_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let orders = sqlx::query_as::<_, AnalyzerOrder>(
        "SELECT o.id AS order_id, o.sample_barcode, o.sample_type, o.is_stat, \
                COALESCE(o.collected_at, o.created_at) AS collected_at, \
                t.code AS test_code, t.name AS test_name, \
                p.uhid, p.first_name, p.last_name, p.date_of_birth, p.gender::text AS gender \
           FROM lab_orders o \
           JOIN lab_test_catalog t ON t.id = o.test_id \
           JOIN patients p ON p.id = o.patient_id \
           JOIN device_instances d ON d.id = $1 AND d.tenant_id = o.tenant_id \
          WHERE o.tenant_id = $2 AND o.status = 'sample_collected' \
            AND o.sample_barcode IS NOT NULL AND o.deleted_at IS NULL AND NOT o.is_outsourced \
            AND COALESCE(o.collected_at, o.created_at) > now() - interval '24 hours' \
            AND (d.department_id IS NULL OR t.department_id = d.department_id) \
            AND NOT EXISTS (SELECT 1 FROM device_messages m \
                 WHERE m.device_instance_id = d.id AND m.direction = 'outbound' \
                   AND m.target_entity_id = o.id AND m.deleted_at IS NULL \
                   AND m.processing_status = 'delivered') \
            AND (SELECT count(*) FROM device_messages m \
                 WHERE m.device_instance_id = d.id AND m.direction = 'outbound' \
                   AND m.target_entity_id = o.id AND m.deleted_at IS NULL) < $3 \
          ORDER BY o.is_stat DESC, COALESCE(o.collected_at, o.created_at) LIMIT $4",
    )
    .bind(device_id)
    .bind(claims.tenant_id)
    .bind(MAX_FAILED_SENDS)
    .bind(PAGE)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(AnalyzerWorklist { analyzer, orders }))
}

/// What the analyzer said about one order.
#[derive(Debug, Deserialize)]
pub struct SentOrder {
    pub order_id: Uuid,
    /// The message control id the ORM carried.
    pub control_id: String,
    pub delivered: bool,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SentOrders {
    pub sent: Vec<SentOrder>,
}

pub async fn record_analyzer_orders_sent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(device_id): Path<Uuid>,
    Json(body): Json<SentOrders>,
) -> Result<Json<serde_json::Value>, AppError> {
    super::require_permission(&claims, permissions::devices::orders::SEND)?;
    if body.sent.len() > usize::try_from(PAGE).unwrap_or(50) {
        return Err(AppError::BadRequest(format!(
            "At most {PAGE} orders per report"
        )));
    }
    let ids: Vec<Uuid> = body.sent.iter().map(|s| s.order_id).collect();
    let controls: Vec<&str> = body.sent.iter().map(|s| s.control_id.as_str()).collect();
    let delivered: Vec<bool> = body.sent.iter().map(|s| s.delivered).collect();
    let errors: Vec<Option<&str>> = body.sent.iter().map(|s| s.error.as_deref()).collect();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // Only this tenant's device and orders: anything else is silently not a match.
    let recorded = sqlx::query(
        "INSERT INTO device_messages (tenant_id, device_instance_id, direction, protocol, \
             mapped_data, processing_status, target_module, target_entity_id, error_message) \
         SELECT o.tenant_id, d.id, 'outbound', 'hl7_v2', \
                jsonb_build_object('message_type', 'ORM^O01', 'control_id', s.control_id, \
                  'identifiers', jsonb_build_object('sample_barcode', o.sample_barcode, 'order_id', o.id), \
                  'test_code', t.code), \
                CASE WHEN s.delivered THEN 'delivered' ELSE 'failed' END::device_message_status, \
                'lab', o.id, s.error \
           FROM unnest($1::uuid[], $2::text[], $3::bool[], $4::text[]) \
                AS s(order_id, control_id, delivered, error) \
           JOIN lab_orders o ON o.id = s.order_id AND o.tenant_id = $5 \
           JOIN lab_test_catalog t ON t.id = o.test_id \
           JOIN device_instances d ON d.id = $6 AND d.tenant_id = $5 AND d.deleted_at IS NULL",
    )
    .bind(&ids)
    .bind(&controls)
    .bind(&delivered)
    .bind(&errors)
    .bind(claims.tenant_id)
    .bind(device_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "recorded": recorded })))
}

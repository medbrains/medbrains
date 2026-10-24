//! Patient package subscriptions + consumption tracking.
//! See `RFCs/sprints/SPRINT-doctor-activities.md` §2.3.

use axum::routing::{get, post};
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Duration, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::HashMap;
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PatientPackageSubscription {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub package_id: Uuid,
    pub patient_id: Uuid,
    pub purchased_at: DateTime<Utc>,
    pub purchased_via_invoice_id: Option<Uuid>,
    pub valid_until: DateTime<Utc>,
    pub total_paid: Decimal,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct SubscriptionWithBalance {
    #[serde(flatten)]
    pub subscription: PatientPackageSubscription,
    pub package_name: Option<String>,
    pub balances: Vec<InclusionBalance>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InclusionBalance {
    pub inclusion_id: Uuid,
    pub inclusion_type: String,
    pub included_quantity: i32,
    pub consumed_quantity: i32,
    pub remaining: i32,
}

/// One inclusion's balance, tagged with the subscription it belongs to.
#[derive(Debug, sqlx::FromRow)]
struct SubscriptionBalanceRow {
    subscription_id: Uuid,
    inclusion_id: Uuid,
    inclusion_type: String,
    included_quantity: i32,
    consumed_quantity: i32,
    remaining: i32,
}

#[derive(Debug, Deserialize)]
pub struct SubscribeRequest {
    pub package_id: Uuid,
    pub patient_id: Uuid,
    pub purchased_via_invoice_id: Option<Uuid>,
    pub total_paid: Decimal,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ConsumeRequest {
    pub inclusion_type: String,
    pub consumed_visit_id: Option<Uuid>,
    pub consumed_service_id: Option<Uuid>,
    pub consumed_test_id: Option<Uuid>,
    pub consumed_procedure_id: Option<Uuid>,
    pub consumed_quantity: Option<i32>,
    pub notes: Option<String>,
}

/// Gate a read or write on one subscription: a direct billing grant on the
/// patient who bought it, the same check `subscribe` makes on the body's patient.
async fn require_subscription_access(
    state: &AppState,
    claims: &Claims,
    subscription_id: Uuid,
) -> Result<(), AppError> {
    let patient_id: Uuid = sqlx::query_scalar(
        "SELECT patient_id FROM patient_package_subscriptions \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(subscription_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_patient_billing_access(state, claims, patient_id).await
}

pub async fn subscribe(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SubscribeRequest>,
) -> Result<Json<PatientPackageSubscription>, AppError> {
    require_permission(&claims, permissions::patient_packages::SUBSCRIBE)?;
    // Subscribing a named patient to a package commits them to a price.
    // The billing helper rather than the clinical one, for the reason
    // er_fast_invoice gives: the payer relationship is its own question.
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, body.patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Read validity_days from package
    let validity: (i32,) = sqlx::query_as(
        "SELECT validity_days FROM doctor_packages \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(body.package_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::BadRequest("package not found".to_owned()))?;

    let valid_until = Utc::now() + Duration::days(i64::from(validity.0));

    let row = sqlx::query_as::<_, PatientPackageSubscription>(
        "INSERT INTO patient_package_subscriptions \
         (tenant_id, package_id, patient_id, purchased_via_invoice_id, \
          valid_until, total_paid, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.package_id)
    .bind(body.patient_id)
    .bind(body.purchased_via_invoice_id)
    .bind(valid_until)
    .bind(body.total_paid)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn list_for_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<SubscriptionWithBalance>>, AppError> {
    require_permission(&claims, permissions::patient_packages::VIEW)?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let subs = sqlx::query_as::<_, PatientPackageSubscription>(
        "SELECT * FROM patient_package_subscriptions \
         WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
         ORDER BY purchased_at DESC LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    // Names and balances for every subscription in two queries, not two per
    // subscription.
    let sub_ids: Vec<Uuid> = subs.iter().map(|s| s.id).collect();
    let package_ids: Vec<Uuid> = subs.iter().map(|s| s.package_id).collect();

    let names: HashMap<Uuid, String> = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT id, name FROM doctor_packages \
         WHERE tenant_id = $1 AND id = ANY($2) AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(&package_ids)
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .collect();

    let balance_rows = sqlx::query_as::<_, SubscriptionBalanceRow>(
        "SELECT \
            s.id AS subscription_id, \
            i.id AS inclusion_id, \
            i.inclusion_type, \
            i.included_quantity, \
            COALESCE(SUM(c.consumed_quantity)::int, 0) AS consumed_quantity, \
            i.included_quantity - COALESCE(SUM(c.consumed_quantity)::int, 0) AS remaining \
         FROM patient_package_subscriptions s \
         JOIN doctor_package_inclusions i \
            ON i.package_id = s.package_id AND i.tenant_id = s.tenant_id \
           AND i.deleted_at IS NULL \
         LEFT JOIN patient_package_consumptions c \
            ON c.subscription_id = s.id \
           AND c.tenant_id = s.tenant_id \
           AND c.inclusion_type = i.inclusion_type \
           AND c.deleted_at IS NULL \
         WHERE s.tenant_id = $1 AND s.id = ANY($2) \
         GROUP BY s.id, i.id \
         ORDER BY s.id, i.sort_order, i.id LIMIT 50000",
    )
    .bind(claims.tenant_id)
    .bind(&sub_ids)
    .fetch_all(&mut *tx)
    .await?;

    let mut balances: HashMap<Uuid, Vec<InclusionBalance>> = HashMap::new();
    for r in balance_rows {
        balances
            .entry(r.subscription_id)
            .or_default()
            .push(InclusionBalance {
                inclusion_id: r.inclusion_id,
                inclusion_type: r.inclusion_type,
                included_quantity: r.included_quantity,
                consumed_quantity: r.consumed_quantity,
                remaining: r.remaining,
            });
    }

    let result = subs
        .into_iter()
        .map(|sub| SubscriptionWithBalance {
            package_name: names.get(&sub.package_id).cloned(),
            balances: balances.remove(&sub.id).unwrap_or_default(),
            subscription: sub,
        })
        .collect();

    tx.commit().await?;
    Ok(Json(result))
}

pub async fn consume(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(subscription_id): Path<Uuid>,
    Json(body): Json<ConsumeRequest>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::patient_packages::CONSUME)?;
    require_subscription_access(&state, &claims, subscription_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Lock subscription row
    let sub: PatientPackageSubscription = sqlx::query_as(
        "SELECT * FROM patient_package_subscriptions \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(subscription_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if sub.status != "active" {
        return Err(AppError::BadRequest(format!(
            "subscription is {}, cannot consume",
            sub.status
        )));
    }
    if sub.valid_until < Utc::now() {
        // Auto-flip to expired. Committed before refusing: an error return
        // drops the transaction, which would roll the flip back.
        sqlx::query(
            "UPDATE patient_package_subscriptions SET status = 'expired' \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(subscription_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        return Err(AppError::BadRequest("subscription expired".to_owned()));
    }

    // Check remaining quota for inclusion_type
    let qty = body.consumed_quantity.unwrap_or(1);
    let row: (i32, i32) = sqlx::query_as(
        "SELECT \
            COALESCE(SUM(i.included_quantity)::int, 0), \
            COALESCE((SELECT SUM(c.consumed_quantity)::int \
                      FROM patient_package_consumptions c \
                      WHERE c.subscription_id = $1 AND c.tenant_id = $2 \
                        AND c.inclusion_type = $3 AND c.deleted_at IS NULL), 0) \
         FROM doctor_package_inclusions i \
         WHERE i.tenant_id = $2 AND i.package_id = $4 \
           AND i.inclusion_type = $3 AND i.deleted_at IS NULL",
    )
    .bind(subscription_id)
    .bind(claims.tenant_id)
    .bind(&body.inclusion_type)
    .bind(sub.package_id)
    .fetch_one(&mut *tx)
    .await?;

    let (included, consumed) = row;
    let remaining = included - consumed;
    if remaining < qty {
        return Err(AppError::BadRequest(format!(
            "insufficient remaining quota: have {remaining}, need {qty}"
        )));
    }

    // Insert consumption
    let consumed_id: Uuid = sqlx::query_scalar(
        "INSERT INTO patient_package_consumptions \
         (tenant_id, subscription_id, inclusion_type, consumed_visit_id, \
          consumed_service_id, consumed_test_id, consumed_procedure_id, \
          consumed_quantity, consumed_by_user_id, notes) \
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(subscription_id)
    .bind(&body.inclusion_type)
    .bind(body.consumed_visit_id)
    .bind(body.consumed_service_id)
    .bind(body.consumed_test_id)
    .bind(body.consumed_procedure_id)
    .bind(qty)
    .bind(claims.sub)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await?;

    // If now exhausted (no inclusion type has remaining), flip status
    let any_remaining: (i64,) = sqlx::query_as(
        "SELECT COUNT(*)::bigint FROM doctor_package_inclusions i \
         WHERE i.tenant_id = $1 AND i.package_id = $2 AND i.deleted_at IS NULL \
           AND i.included_quantity > COALESCE( \
               (SELECT SUM(c.consumed_quantity)::int \
                FROM patient_package_consumptions c \
                WHERE c.subscription_id = $3 AND c.tenant_id = $1 \
                  AND c.inclusion_type = i.inclusion_type AND c.deleted_at IS NULL), 0)",
    )
    .bind(claims.tenant_id)
    .bind(sub.package_id)
    .bind(subscription_id)
    .fetch_one(&mut *tx)
    .await?;
    if any_remaining.0 == 0 {
        sqlx::query(
            "UPDATE patient_package_subscriptions SET status = 'exhausted' \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(subscription_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(Json(
        json!({ "consumption_id": consumed_id, "remaining_after": remaining - qty }),
    ))
}

pub async fn refund(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(subscription_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::patient_packages::REFUND)?;
    require_subscription_access(&state, &claims, subscription_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let n = sqlx::query(
        "UPDATE patient_package_subscriptions SET status = 'refunded' \
         WHERE id = $1 AND tenant_id = $2 AND status = 'active' AND deleted_at IS NULL",
    )
    .bind(subscription_id)
    .bind(claims.tenant_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    if n.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(json!({ "refunded": true })))
}

/// patient_packages routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/patient-packages/subscribe", post(subscribe))
        .route(
            "/api/patient-packages/patient/{patient_id}",
            get(list_for_patient),
        )
        .route("/api/patient-packages/{sub_id}/consume", post(consume))
        .route("/api/patient-packages/{sub_id}/refund", post(refund))
}

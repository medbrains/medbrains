//! Patient package subscriptions + consumption tracking.
//! See `RFCs/sprints/SPRINT-doctor-activities.md` §2.3.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Duration, Utc};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::{
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

pub async fn subscribe(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SubscribeRequest>,
) -> Result<Json<PatientPackageSubscription>, AppError> {
    require_permission(&claims, permissions::patient_packages::SUBSCRIBE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Read validity_days from package
    let validity: (i32,) = sqlx::query_as(
        "SELECT validity_days FROM doctor_packages WHERE id = $1 AND tenant_id = $2",
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
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let subs = sqlx::query_as::<_, PatientPackageSubscription>(
        "SELECT * FROM patient_package_subscriptions \
         WHERE tenant_id = $1 AND patient_id = $2 \
         ORDER BY purchased_at DESC",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;

    let mut result = Vec::with_capacity(subs.len());
    for sub in subs {
        let pkg: Option<(String,)> = sqlx::query_as(
            "SELECT name FROM doctor_packages WHERE id = $1 AND tenant_id = $2",
        )
        .bind(sub.package_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?;

        let balances = sqlx::query_as::<_, InclusionBalance>(
            "SELECT \
                i.id AS inclusion_id, \
                i.inclusion_type, \
                i.included_quantity, \
                COALESCE(SUM(c.consumed_quantity)::int, 0) AS consumed_quantity, \
                i.included_quantity - COALESCE(SUM(c.consumed_quantity)::int, 0) AS remaining \
             FROM doctor_package_inclusions i \
             LEFT JOIN patient_package_consumptions c \
                ON c.subscription_id = $2 \
               AND c.tenant_id = i.tenant_id \
               AND c.inclusion_type = i.inclusion_type \
             WHERE i.tenant_id = $1 AND i.package_id = $3 \
             GROUP BY i.id \
             ORDER BY i.sort_order, i.id",
        )
        .bind(claims.tenant_id)
        .bind(sub.id)
        .bind(sub.package_id)
        .fetch_all(&mut *tx)
        .await?;

        result.push(SubscriptionWithBalance {
            subscription: sub,
            package_name: pkg.map(|p| p.0),
            balances,
        });
    }

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
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Lock subscription row
    let sub: PatientPackageSubscription = sqlx::query_as(
        "SELECT * FROM patient_package_subscriptions \
         WHERE id = $1 AND tenant_id = $2 FOR UPDATE",
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
        // Auto-flip to expired
        let _ = sqlx::query(
            "UPDATE patient_package_subscriptions SET status = 'expired' \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(subscription_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await;
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
                        AND c.inclusion_type = $3), 0) \
         FROM doctor_package_inclusions i \
         WHERE i.tenant_id = $2 AND i.package_id = $4 \
           AND i.inclusion_type = $3",
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
         WHERE i.tenant_id = $1 AND i.package_id = $2 \
           AND i.included_quantity > COALESCE( \
               (SELECT SUM(c.consumed_quantity)::int \
                FROM patient_package_consumptions c \
                WHERE c.subscription_id = $3 AND c.tenant_id = $1 \
                  AND c.inclusion_type = i.inclusion_type), 0)",
    )
    .bind(claims.tenant_id)
    .bind(sub.package_id)
    .bind(subscription_id)
    .fetch_one(&mut *tx)
    .await?;
    if any_remaining.0 == 0 {
        let _ = sqlx::query(
            "UPDATE patient_package_subscriptions SET status = 'exhausted' \
             WHERE id = $1 AND tenant_id = $2",
        )
        .bind(subscription_id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await;
    }

    tx.commit().await?;
    Ok(Json(json!({ "consumption_id": consumed_id, "remaining_after": remaining - qty })))
}

pub async fn refund(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(subscription_id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::patient_packages::REFUND)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let n = sqlx::query(
        "UPDATE patient_package_subscriptions SET status = 'refunded' \
         WHERE id = $1 AND tenant_id = $2 AND status = 'active'",
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

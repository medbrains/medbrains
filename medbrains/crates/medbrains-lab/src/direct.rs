//! Walk-in laboratory visits: a patient at the lab counter with no doctor's
//! order in this hospital — self-referred, or carrying an outside
//! prescription.
//!
//! One request opens the lab visit, records who referred the patient (a
//! hospital doctor, an outside doctor, or self), places every test and puts
//! them on the bill, atomically. Billing is unconditional here — a walk-in
//! pays before the sample is drawn, whatever the auto-billing setting. The
//! visit closes on its own once nothing on it is still outstanding
//! ([`close_walk_in_visit_if_done`]).

use axum::{Extension, Json, extract::State};
use medbrains_core::lab::LabOrder;
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    CreateOrderOptions, CreateOrderRequest, charge_lab_order_in_tx,
    create_order_in_tx_with_options, grant_lab_order_access,
};

/// Most tests one walk-in request may place.
const MAX_TESTS: usize = 30;
/// Marks the encounters this module opens, so it only ever closes its own.
const VISIT_SOURCE: &str = "lab_direct";

/// Who sent the patient. Exactly one of the three, always stated.
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Referral {
    /// A doctor on this hospital's staff.
    Internal { doctor_id: Uuid },
    /// An outside doctor: one already on file, or name + registration no.
    External {
        referral_doctor_id: Option<Uuid>,
        name: Option<String>,
        registration_no: Option<String>,
        phone: Option<String>,
    },
    /// The patient came on their own.
    #[serde(rename = "self")]
    SelfReferred,
}

#[derive(Debug, Deserialize)]
pub struct DirectOrderRequest {
    pub patient_id: Uuid,
    pub test_ids: Vec<Uuid>,
    pub priority: Option<String>,
    pub clinical_history: Option<String>,
    pub referral: Referral,
}

#[derive(Debug, Serialize)]
pub struct DirectOrderResponse {
    pub encounter_id: Uuid,
    pub orders: Vec<LabOrder>,
    /// The draft invoice the tests were charged to.
    pub invoice_id: Option<Uuid>,
    pub total: Decimal,
}

/// What the referral resolves to on each order row.
struct ResolvedReferral {
    doctor_id: Option<Uuid>,
    referral_doctor_id: Option<Uuid>,
    is_self: bool,
    kind: &'static str,
}

/// POST /api/lab/direct-orders
pub async fn create_direct_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<DirectOrderRequest>,
) -> Result<Json<DirectOrderResponse>, AppError> {
    require_permission(&claims, permissions::lab::orders::DIRECT)?;
    let test_ids = distinct_tests(&body.test_ids)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    ensure_patient(&mut tx, claims.tenant_id, body.patient_id).await?;
    let total = price_tests(&mut tx, claims.tenant_id, &test_ids).await?;
    let referral = resolve_referral(&mut tx, claims.tenant_id, &body.referral).await?;
    let encounter_id = open_visit(&mut tx, &claims, body.patient_id, &referral).await?;

    let mut order_ids = Vec::with_capacity(test_ids.len());
    let mut invoice_id = None;
    // ponytail: one insert per test (≤ MAX_TESTS) through the shared order path,
    // so tokens, checks and billing stay identical to every other lab order.
    for test_id in &test_ids {
        let request = CreateOrderRequest {
            encounter_id,
            patient_id: body.patient_id,
            test_id: *test_id,
            priority: body.priority.clone(),
            notes: None,
            is_dummy: None,
        };
        let order = create_order_in_tx_with_options(
            &mut tx,
            &claims,
            &request,
            CreateOrderOptions { auto_bill: false },
        )
        .await?;
        invoice_id = charge_lab_order_in_tx(&mut tx, &claims, &order)
            .await?
            .or(invoice_id);
        order_ids.push(order.id);
    }

    let orders = stamp_referral(&mut tx, &claims, &order_ids, &referral, &body).await?;
    tx.commit().await?;

    for order in &orders {
        grant_lab_order_access(&state, &claims, order.id, "lab_direct_order").await?;
    }
    Ok(Json(DirectOrderResponse {
        encounter_id,
        orders,
        invoice_id,
        total,
    }))
}

fn distinct_tests(ids: &[Uuid]) -> Result<Vec<Uuid>, AppError> {
    let mut seen = std::collections::HashSet::new();
    let tests: Vec<Uuid> = ids.iter().copied().filter(|id| seen.insert(*id)).collect();
    if tests.is_empty() || tests.len() > MAX_TESTS {
        return Err(AppError::BadRequest(format!(
            "Pick between 1 and {MAX_TESTS} tests."
        )));
    }
    Ok(tests)
}

async fn ensure_patient(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<(), AppError> {
    let found = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM patients WHERE id = $1 AND tenant_id = $2 \
         AND deleted_at IS NULL AND is_active AND NOT is_merged)",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    if found {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}

/// The bill total, and proof every test is orderable — one round trip.
async fn price_tests(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    test_ids: &[Uuid],
) -> Result<Decimal, AppError> {
    let (found, total): (i64, Decimal) = sqlx::query_as(
        "SELECT count(*), COALESCE(sum(price), 0) FROM lab_test_catalog \
         WHERE tenant_id = $1 AND id = ANY($2) AND is_active AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(test_ids)
    .fetch_one(&mut **tx)
    .await?;
    if usize::try_from(found).ok() != Some(test_ids.len()) {
        return Err(AppError::BadRequest(
            "A test is retired or not in the catalogue — search again.".to_owned(),
        ));
    }
    Ok(total)
}

async fn resolve_referral(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    referral: &Referral,
) -> Result<ResolvedReferral, AppError> {
    match referral {
        Referral::Internal { doctor_id } => {
            let is_doctor = sqlx::query_scalar::<_, bool>(
                "SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 \
                 AND role = 'doctor' AND is_active)",
            )
            .bind(doctor_id)
            .bind(tenant_id)
            .fetch_one(&mut **tx)
            .await?;
            if !is_doctor {
                return Err(AppError::BadRequest(
                    "Pick an active hospital doctor.".to_owned(),
                ));
            }
            Ok(ResolvedReferral {
                doctor_id: Some(*doctor_id),
                referral_doctor_id: None,
                is_self: false,
                kind: "internal",
            })
        }
        Referral::External {
            referral_doctor_id,
            name,
            registration_no,
            phone,
        } => {
            let id = external_doctor(
                tx,
                tenant_id,
                *referral_doctor_id,
                name.as_deref(),
                registration_no.as_deref(),
                phone.as_deref(),
            )
            .await?;
            Ok(ResolvedReferral {
                doctor_id: None,
                referral_doctor_id: Some(id),
                is_self: false,
                kind: "external",
            })
        }
        Referral::SelfReferred => Ok(ResolvedReferral {
            doctor_id: None,
            referral_doctor_id: None,
            is_self: true,
            kind: "self",
        }),
    }
}

/// An outside doctor already on file, or found / added by name and
/// registration number — so the same doctor is not filed twice.
async fn external_doctor(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    existing: Option<Uuid>,
    name: Option<&str>,
    registration_no: Option<&str>,
    phone: Option<&str>,
) -> Result<Uuid, AppError> {
    if let Some(id) = existing {
        return sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM lab_referral_doctors WHERE id = $1 AND tenant_id = $2 \
             AND deleted_at IS NULL AND is_active",
        )
        .bind(id)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or_else(|| {
            AppError::BadRequest("That referring doctor is no longer on file.".to_owned())
        });
    }
    let name = name
        .map(str::trim)
        .filter(|n| !n.is_empty())
        .ok_or_else(|| AppError::BadRequest("Enter the referring doctor's name.".to_owned()))?;
    let registration_no = registration_no.map(str::trim).filter(|r| !r.is_empty());
    let phone = phone.map(str::trim).filter(|p| !p.is_empty());
    let id = sqlx::query_scalar::<_, Uuid>(
        "WITH found AS ( \
           SELECT id FROM lab_referral_doctors \
           WHERE tenant_id = $1 AND deleted_at IS NULL \
             AND lower(name) = lower($2) \
             AND registration_no IS NOT DISTINCT FROM $3 \
           LIMIT 1 \
         ), added AS ( \
           INSERT INTO lab_referral_doctors (tenant_id, name, registration_no, phone) \
           SELECT $1, $2, $3, $4 WHERE NOT EXISTS (SELECT 1 FROM found) \
           RETURNING id \
         ) \
         SELECT id FROM found UNION ALL SELECT id FROM added",
    )
    .bind(tenant_id)
    .bind(name)
    .bind(registration_no)
    .bind(phone)
    .fetch_one(&mut **tx)
    .await?;
    Ok(id)
}

async fn open_visit(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    patient_id: Uuid,
    referral: &ResolvedReferral,
) -> Result<Uuid, AppError> {
    let attributes = serde_json::json!({ "source": VISIT_SOURCE, "referral": referral.kind });
    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO encounters \
         (tenant_id, patient_id, encounter_type, status, doctor_id, visit_type, \
          notes, attributes, created_by) \
         VALUES ($1, $2, 'opd'::encounter_type, 'open'::encounter_status, $3, 'walk_in', \
                 'Direct laboratory visit', $4, $5) \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(referral.doctor_id)
    .bind(attributes)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?;
    Ok(id)
}

async fn stamp_referral(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    claims: &Claims,
    order_ids: &[Uuid],
    referral: &ResolvedReferral,
    body: &DirectOrderRequest,
) -> Result<Vec<LabOrder>, AppError> {
    let history = body
        .clinical_history
        .as_deref()
        .map(str::trim)
        .filter(|h| !h.is_empty());
    let orders = sqlx::query_as::<_, LabOrder>(
        "UPDATE lab_orders SET ordering_doctor_id = $1, referral_doctor_id = $2, \
         is_self_referred = $3, clinical_history = $4, updated_at = now() \
         WHERE tenant_id = $5 AND id = ANY($6) \
         RETURNING *",
    )
    .bind(referral.doctor_id)
    .bind(referral.referral_doctor_id)
    .bind(referral.is_self)
    .bind(history)
    .bind(claims.tenant_id)
    .bind(order_ids)
    .fetch_all(&mut **tx)
    .await?;
    Ok(orders)
}

/// Closes a walk-in lab visit once none of its orders is still outstanding
/// (every one verified or cancelled). Visits this module did not open are
/// left alone — an OPD visit closes when the doctor closes it.
pub(crate) async fn close_walk_in_visit_if_done(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    encounter_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE encounters e SET status = 'completed'::encounter_status, updated_at = now() \
         WHERE e.id = $1 AND e.tenant_id = $2 \
           AND e.status IN ('open'::encounter_status, 'in_progress'::encounter_status) \
           AND e.attributes->>'source' = $3 \
           AND NOT EXISTS ( \
             SELECT 1 FROM lab_orders lo \
             WHERE lo.encounter_id = e.id AND lo.tenant_id = e.tenant_id \
               AND lo.deleted_at IS NULL \
               AND lo.status NOT IN ('verified'::lab_order_status, 'cancelled'::lab_order_status))",
    )
    .bind(encounter_id)
    .bind(tenant_id)
    .bind(VISIT_SOURCE)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{MAX_TESTS, distinct_tests};
    use uuid::Uuid;

    #[test]
    fn tests_are_deduplicated_and_bounded() {
        let a = Uuid::new_v4();
        assert_eq!(distinct_tests(&[a, a]).ok(), Some(vec![a]));
        assert!(distinct_tests(&[]).is_err());
        let many: Vec<Uuid> = (0..=MAX_TESTS).map(|_| Uuid::new_v4()).collect();
        assert!(distinct_tests(&many).is_err());
    }

    #[test]
    fn referral_kind_is_explicit() {
        let parsed: super::Referral =
            serde_json::from_str(r#"{"kind":"self"}"#).unwrap_or(super::Referral::Internal {
                doctor_id: Uuid::nil(),
            });
        assert!(matches!(parsed, super::Referral::SelfReferred));
        assert!(serde_json::from_str::<super::Referral>(r#"{"kind":"nobody"}"#).is_err());
    }
}

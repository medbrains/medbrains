//! Orders for the leakage tests: a visit in a department, a verified lab
//! test, a reported X-ray, a completed procedure, and a payer rate card.

use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

use medbrains_server_core::middleware::auth::Claims;

use super::{Tx, fixture, scoped};

/// One visit with a department, and the ids the orders hang off.
pub(crate) struct Visit {
    pub(crate) tenant: Uuid,
    pub(crate) user: Uuid,
    pub(crate) patient: Uuid,
    pub(crate) encounter: Uuid,
    pub(crate) department: Uuid,
    /// The CBC in the lab catalogue, ₹350.
    pub(crate) test: Uuid,
}

/// A hospital, a patient and an OPD visit in Pathology, with a CBC in the
/// lab catalogue.
pub(crate) async fn visit(db: &PgPool) -> (Claims, Visit) {
    let (claims, patient) = fixture(db).await;
    let mut tx = scoped(db, claims.tenant_id).await;
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, department_type, name, code) \
         VALUES ($1, 'clinical', 'Pathology', 'LKPATH') RETURNING id",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    let encounter = encounter(&mut tx, claims.tenant_id, patient, department).await;
    let test: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_test_catalog (tenant_id, code, name, price) \
         VALUES ($1, 'LKCBC', 'Complete blood count', 350) RETURNING id",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let v = Visit {
        tenant: claims.tenant_id,
        user: claims.sub,
        patient,
        encounter,
        department,
        test,
    };
    (claims, v)
}

pub(crate) async fn encounter(tx: &mut Tx, tenant: Uuid, patient: Uuid, department: Uuid) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, department_id) \
         VALUES ($1, $2, 'opd', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(department)
    .fetch_one(&mut **tx)
    .await
    .unwrap()
}

/// A CBC order in `status`, verified `hours_ago`.
pub(crate) async fn lab_order(db: &PgPool, v: &Visit, status: &str, hours_ago: i32) -> Uuid {
    let mut tx = scoped(db, v.tenant).await;
    let id = sqlx::query_scalar(
        "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by, \
           status, verified_at) \
         VALUES ($1, $2, $3, $4, $5, $6::lab_order_status, now() - make_interval(hours => $7)) \
         RETURNING id",
    )
    .bind(v.tenant)
    .bind(v.encounter)
    .bind(v.patient)
    .bind(v.test)
    .bind(v.user)
    .bind(status)
    .bind(hours_ago)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    id
}

/// A chest X-ray reported a day ago, priced ₹500 in the charge master.
pub(crate) async fn radiology_order(db: &PgPool, v: &Visit) -> Uuid {
    let mut tx = scoped(db, v.tenant).await;
    let modality: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_modalities (tenant_id, code, name) \
         VALUES ($1, 'LKXR', 'X-ray') RETURNING id",
    )
    .bind(v.tenant)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO charge_master (tenant_id, code, name, category, base_price, tax_percent) \
         VALUES ($1, 'RAD-LKXR', 'X-ray', 'radiology', 500, 0)",
    )
    .bind(v.tenant)
    .execute(&mut *tx)
    .await
    .unwrap();
    let id = sqlx::query_scalar(
        "INSERT INTO radiology_orders (tenant_id, patient_id, encounter_id, modality_id, \
           ordered_by, status, completed_at, body_part) \
         VALUES ($1, $2, $3, $4, $5, 'reported', now() - interval '1 day', 'Chest') RETURNING id",
    )
    .bind(v.tenant)
    .bind(v.patient)
    .bind(v.encounter)
    .bind(modality)
    .bind(v.user)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    id
}

/// A dressing (₹200 in the procedure catalogue) completed five hours ago.
/// Returns the order and the catalogue procedure.
pub(crate) async fn procedure_order(db: &PgPool, v: &Visit) -> (Uuid, Uuid) {
    let mut tx = scoped(db, v.tenant).await;
    let procedure: Uuid = sqlx::query_scalar(
        "INSERT INTO procedure_catalog (tenant_id, code, name, base_price) \
         VALUES ($1, 'LKDRESS', 'Dressing', 200) RETURNING id",
    )
    .bind(v.tenant)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    let id = sqlx::query_scalar(
        "INSERT INTO procedure_orders (tenant_id, patient_id, encounter_id, procedure_id, \
           ordered_by, status, completed_at) \
         VALUES ($1, $2, $3, $4, $5, 'completed', now() - interval '5 hours') RETURNING id",
    )
    .bind(v.tenant)
    .bind(v.patient)
    .bind(v.encounter)
    .bind(procedure)
    .bind(v.user)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    (id, procedure)
}

/// Insure the patient with a TPA whose rate card prices `code` at `price`.
pub(crate) async fn payer_rate(db: &PgPool, v: &Visit, code: &str, price: i64) {
    let mut tx = scoped(db, v.tenant).await;
    sqlx::query(
        "WITH plan AS (INSERT INTO rate_plans (tenant_id, name) VALUES ($1, 'Star TPA') \
                       RETURNING id), \
              item AS (INSERT INTO rate_plan_items (tenant_id, rate_plan_id, charge_code, \
                         override_price) SELECT $1, id, $3, $4 FROM plan), \
              card AS (INSERT INTO tpa_rate_cards (tenant_id, tpa_name, insurance_provider, \
                         rate_plan_id) SELECT $1, 'Medi Assist', 'Star Health', id FROM plan) \
         INSERT INTO patient_insurance (tenant_id, patient_id, insurance_provider, \
           policy_number, valid_from, valid_until, tpa_name) \
         VALUES ($1, $2, 'Star Health', 'P-1', current_date - 30, current_date + 300, \
           'Medi Assist')",
    )
    .bind(v.tenant)
    .bind(v.patient)
    .bind(code)
    .bind(Decimal::from(price))
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
}

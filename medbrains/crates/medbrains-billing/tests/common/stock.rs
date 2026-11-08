//! Stock for the stock-leakage tests: an admitted patient on a ward with
//! imprest stock, a consignment implant batch, and a fault that refuses one
//! charge code so a charge can be made to fail on purpose.

use axum::extract::State;
use axum::{Extension, Json};
use medbrains_billing::leakage::run_for;
use medbrains_core::permissions;
use medbrains_kernel::Actor;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_ward_stock::consume::{
    WardStockConsumeRequest, WardStockConsumeResponse, consume_ward_stock,
};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

use super::orders::{Visit, visit};
use super::{scoped, state};

/// The visit, admitted, on a ward that holds 50 of one drug.
pub(crate) struct Ward {
    pub(crate) v: Visit,
    pub(crate) admission: Uuid,
    /// The drug the ward holds.
    pub(crate) item: Uuid,
}

/// An admitted patient on a ward holding 50 of `code` at ₹`price`, billable
/// to patients when `billable`.
pub(crate) async fn ward(db: &PgPool, code: &str, price: i64, billable: bool) -> (Claims, Ward) {
    let (claims, v) = visit(db).await;
    let mut tx = scoped(db, v.tenant).await;
    let admission: Uuid = sqlx::query_scalar(
        "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(v.tenant)
    .bind(v.encounter)
    .bind(v.patient)
    .bind(v.user)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let item = ward_item(db, &v, code, price, billable).await;
    (claims, Ward { v, admission, item })
}

/// Another drug on the ward: 50 held, at ₹`price`.
pub(crate) async fn ward_item(
    db: &PgPool,
    v: &Visit,
    code: &str,
    price: i64,
    billable: bool,
) -> Uuid {
    let mut tx = scoped(db, v.tenant).await;
    let item: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, base_price, is_patient_billable) \
         VALUES ($1, $2, $2 || ' item', $3, $4) RETURNING id",
    )
    .bind(v.tenant)
    .bind(code)
    .bind(Decimal::from(price))
    .bind(billable)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO ward_stock (tenant_id, department_id, catalog_item_id, quantity) \
         VALUES ($1, $2, $3, 50)",
    )
    .bind(v.tenant)
    .bind(v.department)
    .bind(item)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    item
}

/// A consignment batch `K-77` of 3 knee implants at ₹85,000. Returns the batch.
pub(crate) async fn consignment(db: &PgPool, v: &Visit) -> Uuid {
    let mut tx = scoped(db, v.tenant).await;
    let batch = sqlx::query_scalar(
        "WITH item AS (INSERT INTO store_catalog (tenant_id, code, name, base_price, \
                         current_stock, is_implant) \
                       VALUES ($1, 'LKKNEE', 'Knee implant', 85000, 3, true) RETURNING id) \
         INSERT INTO batch_stock (tenant_id, catalog_item_id, batch_number, quantity, \
           unit_cost, is_consignment) \
         SELECT $1, id, 'K-77', 3, 60000, true FROM item RETURNING id",
    )
    .bind(v.tenant)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    batch
}

/// Make every charge line whose code starts `LKFAIL` fail, as a database
/// fault would. Idempotent; affects no other code.
pub(crate) async fn refuse_failing_codes(db: &PgPool) {
    sqlx::query(
        "CREATE OR REPLACE FUNCTION test_refuse_lkfail() RETURNS trigger LANGUAGE plpgsql AS \
         $$ BEGIN IF NEW.charge_code LIKE 'LKFAIL%' THEN \
              RAISE EXCEPTION 'injected charge fault'; END IF; RETURN NEW; END $$",
    )
    .execute(db)
    .await
    .unwrap();
    sqlx::query(
        "CREATE OR REPLACE TRIGGER test_refuse_lkfail BEFORE INSERT ON invoice_items \
         FOR EACH ROW EXECUTE FUNCTION test_refuse_lkfail()",
    )
    .execute(db)
    .await
    .unwrap();
}

/// Move every stock record of the tenant `hours` into the past, past the
/// detector's grace window.
pub(crate) async fn age_stock(db: &PgPool, tenant: Uuid, hours: i32) {
    for table in ["ward_stock_consumptions", "store_stock_movements"] {
        sqlx::query(&format!(
            "UPDATE {table} SET created_at = created_at - make_interval(hours => $2) \
              WHERE tenant_id = $1"
        ))
        .bind(tenant)
        .bind(hours)
        .execute(db)
        .await
        .unwrap();
    }
}

/// Use `quantity` of `item` on the ward, on `patient` when given.
pub(crate) async fn consume(
    db: &PgPool,
    claims: &Claims,
    w: &Ward,
    item: Uuid,
    patient: Option<Uuid>,
) -> Result<WardStockConsumeResponse, AppError> {
    consume_ward_stock(
        State(state(db.clone())),
        Extension(claims.clone()),
        Json(WardStockConsumeRequest {
            department_id: w.v.department,
            catalog_item_id: item,
            quantity: 2,
            patient_id: patient,
        }),
    )
    .await
    .map(|j| j.0)
}

/// Bill lines naming `source_id`: (quantity, unit price).
pub(crate) async fn lines(db: &PgPool, source_id: Uuid) -> Vec<(i32, Decimal)> {
    sqlx::query_as(
        "SELECT quantity, unit_price FROM invoice_items \
          WHERE source = 'consumable' AND source_id = $1",
    )
    .bind(source_id)
    .fetch_all(db)
    .await
    .unwrap()
}

/// The tenant's queue rows: (source, reason, setting, patient).
pub(crate) async fn queue(db: &PgPool, tenant: Uuid) -> Vec<(Uuid, String, String, Option<Uuid>)> {
    sqlx::query_as(
        "SELECT source_entity_id, reason, setting_module, patient_id \
           FROM charge_attention_items WHERE tenant_id = $1 ORDER BY created_at",
    )
    .bind(tenant)
    .fetch_all(db)
    .await
    .unwrap()
}

/// Run the detector as the claims' user.
pub(crate) async fn scan(db: &PgPool, claims: &Claims) -> u64 {
    run_for(db, Actor::from_claims(claims), false)
        .await
        .expect("scan")
}

/// The desk's leakage grants, on top of the fixture's.
pub(crate) fn leakage_desk(claims: &mut Claims) {
    claims
        .permissions
        .push(permissions::billing::leakage::VIEW.to_owned());
    claims
        .permissions
        .push(permissions::billing::leakage::RESOLVE.to_owned());
}

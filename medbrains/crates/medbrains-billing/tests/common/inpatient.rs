//! An insured inpatient for the pre-auth and room tests: a visit with an
//! admission, a policy, a bed of a given rate, an approved pre-auth and a
//! bill whose total can be raised the way a posted charge raises it.

#![allow(clippy::expect_used, clippy::unwrap_used, dead_code)]

use medbrains_server_core::middleware::auth::Claims;
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

use super::scoped;

/// The ids an inpatient's tests need.
pub(crate) struct Inpatient {
    pub tenant: Uuid,
    pub patient: Uuid,
    pub encounter: Uuid,
    pub admission: Uuid,
}

/// Admit `patient` under `claims`' hospital, with `claims.sub` as doctor.
pub(crate) async fn admit(db: &PgPool, claims: &Claims, patient: Uuid) -> Inpatient {
    let t = claims.tenant_id;
    let mut tx = scoped(db, t).await;
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         VALUES ($1, $2, 'ipd') RETURNING id",
    )
    .bind(t)
    .bind(patient)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    let admission: Uuid = sqlx::query_scalar(
        "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, \
           admission_number) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    )
    .bind(t)
    .bind(encounter)
    .bind(patient)
    .bind(claims.sub)
    .bind(format!("ADM-{}", Uuid::new_v4().simple()))
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    Inpatient {
        tenant: t,
        patient,
        encounter,
        admission,
    }
}

/// A policy in force today with the given room limit (₹/day or % of SI).
pub(crate) async fn policy(
    db: &PgPool,
    tenant: Uuid,
    patient: Uuid,
    limit: (Option<i64>, Option<i64>),
) -> Uuid {
    let mut tx = scoped(db, tenant).await;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO patient_insurance (tenant_id, patient_id, insurance_provider, \
           policy_number, valid_from, valid_until, sum_insured, room_rent_limit_per_day, \
           room_rent_limit_percent) \
         VALUES ($1, $2, 'Star Health', 'P-ROOM', current_date - 30, current_date + 300, \
           500000, $3, $4) RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(limit.0.map(Decimal::from))
    .bind(limit.1.map(Decimal::from))
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    id
}

/// A bed whose bed type costs `rate` a day; `name` "ICU" makes it an ICU bed.
pub(crate) async fn bed(db: &PgPool, tenant: Uuid, rate: i64, name: &str) -> Uuid {
    let tag = Uuid::new_v4().simple().to_string()[..8].to_uppercase();
    let mut tx = scoped(db, tenant).await;
    let bed: Uuid = sqlx::query_scalar(
        "WITH bt AS (INSERT INTO bed_types (tenant_id, code, name, daily_rate) \
                     VALUES ($1, $2, $3, $4) RETURNING id), \
              w AS (INSERT INTO wards (tenant_id, code, name) VALUES ($1, $2, 'Ward') \
                    RETURNING id), \
              loc AS (INSERT INTO locations (tenant_id, level, code, name) \
                      VALUES ($1, 'bed', $2, 'Bed 1') RETURNING id), \
              m AS (INSERT INTO ward_bed_mappings (tenant_id, ward_id, bed_location_id, \
                      bed_type_id) SELECT $1, w.id, loc.id, bt.id FROM w, loc, bt) \
         SELECT id FROM loc",
    )
    .bind(tenant)
    .bind(format!("B{tag}"))
    .bind(format!("{name} {tag}"))
    .bind(Decimal::from(rate))
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    bed
}

/// An approved pre-auth on the inpatient's visit; `None` is an approval
/// whose amount could not be read.
pub(crate) async fn approved_preauth(
    db: &PgPool,
    inp: &Inpatient,
    policy: Uuid,
    approved: Option<i64>,
) -> Uuid {
    let mut tx = scoped(db, inp.tenant).await;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO prior_auth_requests (tenant_id, pa_number, patient_id, \
           patient_insurance_id, service_type, encounter_id, status, approved_amount, \
           responded_at) \
         VALUES ($1, $2, $3, $4, 'surgery', $5, 'approved', $6, now()) RETURNING id",
    )
    .bind(inp.tenant)
    .bind(format!("PA-{}", Uuid::new_v4().simple()))
    .bind(inp.patient)
    .bind(policy)
    .bind(inp.encounter)
    .bind(approved.map(Decimal::from))
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    id
}

/// A draft bill on the visit, starting at ₹0.
pub(crate) async fn bill(db: &PgPool, inp: &Inpatient) -> Uuid {
    let mut tx = scoped(db, inp.tenant).await;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id, encounter_id, \
           admission_id, status) VALUES ($1, $2, $3, $4, $5, 'draft') RETURNING id",
    )
    .bind(inp.tenant)
    .bind(format!("INV-{}", Uuid::new_v4().simple()))
    .bind(inp.patient)
    .bind(inp.encounter)
    .bind(inp.admission)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    id
}

/// Raise the bill's total, as `recalculate_invoice_totals` does after a charge.
pub(crate) async fn raise_bill(db: &PgPool, tenant: Uuid, invoice: Uuid, total: i64) {
    let mut tx = scoped(db, tenant).await;
    sqlx::query("UPDATE invoices SET total_amount = $2 WHERE id = $1")
        .bind(invoice)
        .bind(Decimal::from(total))
        .execute(&mut *tx)
        .await
        .unwrap();
    tx.commit().await.unwrap();
}

/// A room-linked line (`ipd`) and a pharmacy line, outside the cut, on the bill.
pub(crate) async fn bill_lines(db: &PgPool, tenant: Uuid, invoice: Uuid, linked: i64, drugs: i64) {
    let mut tx = scoped(db, tenant).await;
    sqlx::query(
        "INSERT INTO invoice_items (tenant_id, invoice_id, charge_code, description, source, \
           quantity, unit_price, total_price) \
         VALUES ($1, $2, 'ROOM', 'Room', 'ipd', 1, $3, $3), \
                ($1, $2, 'DRUG', 'Drugs', 'pharmacy', 1, $4, $4)",
    )
    .bind(tenant)
    .bind(invoice)
    .bind(Decimal::from(linked))
    .bind(Decimal::from(drugs))
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
}

/// The inbox rows of `kind` for the hospital: (id, reason, status, amount).
pub(crate) async fn rows(
    db: &PgPool,
    tenant: Uuid,
    kind: &str,
) -> Vec<(Uuid, String, String, Option<Decimal>)> {
    sqlx::query_as(
        "SELECT id, reason, status, amount FROM charge_attention_items \
          WHERE tenant_id = $1 AND kind = $2 ORDER BY created_at",
    )
    .bind(tenant)
    .bind(kind)
    .fetch_all(db)
    .await
    .unwrap()
}

/// Claims of a non-bypass user holding only `perms`.
pub(crate) fn holding(claims: &Claims, perms: &[&str]) -> Claims {
    Claims {
        role: "billing_clerk".to_owned(),
        permissions: perms.iter().map(|p| (*p).to_owned()).collect(),
        ..claims.clone()
    }
}

#![allow(dead_code, unreachable_pub)]

//! The world the collect tests (#4885) run in: patients with bills from
//! named departments, desk staff who may see them, and the reads that prove
//! what a collection saved.

use axum::http::StatusCode;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::common::{self, Staff};
use crate::payments_world::World;

pub fn key() -> String {
    format!("collect-{}", Uuid::new_v4().simple())
}

pub fn money(v: &Value) -> Decimal {
    v.as_str()
        .and_then(|s| s.parse().ok())
        .or_else(|| v.as_f64().and_then(|f| Decimal::try_from(f).ok()))
        .unwrap_or_default()
}

pub async fn patient(w: &World) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Collect', 'Anywhere', 'female', $3) RETURNING id",
    )
    .bind(w.tenant)
    .bind(format!(
        "UH-CL-{}",
        &Uuid::new_v4().simple().to_string()[..10]
    ))
    .bind(format!("8{:09}", Uuid::new_v4().as_u128() % 1_000_000_000))
    .fetch_one(&w.app.db)
    .await
    .expect("patient")
}

/// A bill for `patient` with one `source` line of `total` rupees; issued
/// unless `issue` is false (a draft).
pub async fn bill(w: &World, patient: Uuid, source: &str, total: i64, issue: bool) -> Uuid {
    let (status, invoice) = w
        .call(
            "POST",
            "/api/billing/invoices",
            json!({ "patient_id": patient }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{invoice}");
    let id = invoice["id"].as_str().expect("invoice id").to_owned();
    let (status, item) = w
        .call(
            "POST",
            &format!("/api/billing/invoices/{id}/items"),
            json!({ "charge_code": format!("T-{}", source.to_uppercase()),
                    "description": format!("{source} charge"), "source": source,
                    "quantity": 1, "unit_price": total, "tax_percent": 0 }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{item}");
    if issue {
        let (status, issued) = w
            .call(
                "POST",
                &format!("/api/billing/invoices/{id}/issue"),
                json!({}),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{issued}");
    }
    id.parse().expect("uuid")
}

/// A signed-in desk user of `role` who may see `patients` (a care grant,
/// as the desk that registered or treats them would hold).
pub async fn desk(w: &World, role: &str, denied: &[&str], patients: &[Uuid]) -> Staff {
    let staff = common::provision_staff(&w.app, &w.csrf, role, denied).await;
    for p in patients {
        grant_view(w, &staff, *p).await;
    }
    staff
}

pub async fn grant_view(w: &World, staff: &Staff, patient: Uuid) {
    sqlx::query(
        "INSERT INTO relation_tuples (tuple_id, tenant_id, object_type, object_id, relation, \
           subject_type, subject_id, granted_by, granted_reason, source) \
         SELECT gen_random_uuid(), $1, 'patient', $2, 'viewer', 'user', $3::text, u.id, \
                'collect_test', 'explicit' \
           FROM users u WHERE u.username = 'admin'",
    )
    .bind(w.tenant)
    .bind(patient)
    .bind(staff.user_id)
    .execute(&w.app.db)
    .await
    .expect("grant");
}

/// A request as `staff`.
pub async fn as_staff(
    w: &World,
    staff: &Staff,
    method: &str,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let url = w.app.url(path);
    let req = match method {
        "GET" => staff.client.get(url),
        "PUT" => staff.client.put(url).json(&body),
        _ => staff.client.post(url).json(&body),
    };
    let resp = req
        .header("x-csrf-token", &staff.csrf)
        .send()
        .await
        .expect("request");
    let status = StatusCode::from_u16(resp.status().as_u16()).expect("status");
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// A PUT as the admin.
pub async fn put(w: &World, path: &str, body: Value) -> (StatusCode, Value) {
    let resp = w
        .app
        .client
        .put(w.app.url(path))
        .header("x-csrf-token", &w.csrf)
        .json(&body)
        .send()
        .await
        .expect("put");
    let status = StatusCode::from_u16(resp.status().as_u16()).expect("status");
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// A collection body: `tenders` over `scope`.
pub fn collect_body(patient: Uuid, scope: Value, tenders: Value, key: &str) -> Value {
    let mut body = json!({ "patient_id": patient, "tenders": tenders, "idempotency_key": key });
    if let (Some(b), Value::Object(s)) = (body.as_object_mut(), scope) {
        b.extend(s);
    }
    body
}

pub async fn collect(w: &World, body: Value) -> (StatusCode, Value) {
    w.call("POST", "/api/billing/collect", body).await
}

/// (paid amount, status) of a bill.
pub async fn bill_state(w: &World, invoice: Uuid) -> (Decimal, String) {
    w.invoice(invoice).await
}

/// How many payments the collection holds.
pub async fn payments_in(w: &World, collection: &Value) -> i64 {
    let id: Uuid = collection["collection_id"]
        .as_str()
        .expect("collection id")
        .parse()
        .expect("uuid");
    sqlx::query_scalar("SELECT count(*) FROM payments WHERE collection_id = $1")
        .bind(id)
        .fetch_one(&w.app.db)
        .await
        .expect("count")
}

/// The department seeded under `code`, if this hospital has one.
pub async fn department(w: &World, code: &str) -> Option<Uuid> {
    sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 AND code = $2 AND deleted_at IS NULL LIMIT 1",
    )
    .bind(w.tenant)
    .bind(code)
    .fetch_optional(&w.app.db)
    .await
    .expect("department")
}

/// The department each line of a bill was booked to.
pub async fn item_departments(w: &World, invoice: Uuid) -> Vec<Option<Uuid>> {
    sqlx::query_scalar("SELECT department_id FROM invoice_items WHERE invoice_id = $1")
        .bind(invoice)
        .fetch_all(&w.app.db)
        .await
        .expect("items")
}

/// A billing entity of the test's own, with its own receipt prefix.
pub async fn entity(w: &World) -> (Uuid, String) {
    let tag = Uuid::new_v4().simple().to_string()[..6].to_uppercase();
    let prefix = format!("P{tag}");
    let (status, e) = w
        .call(
            "POST",
            "/api/billing/entities",
            json!({ "code": format!("PH-{tag}"), "name": format!("Pharmacy {tag}"),
                    "receipt_prefix": prefix, "drug_licence": "TN-DL-0001" }),
        )
        .await;
    assert_eq!(status, StatusCode::OK, "{e}");
    (e["id"].as_str().expect("id").parse().expect("uuid"), prefix)
}

/// The serial number at the end of a receipt number (`RCT/26-27/000012` → 12).
pub fn serial(number: &str) -> u64 {
    number
        .rsplit('/')
        .next()
        .and_then(|s| s.parse().ok())
        .unwrap_or_default()
}

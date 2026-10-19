#![allow(dead_code, unreachable_pub)]

//! A hospital ready to receive a supplier bill (#4861): its own supplier
//! (with a GSTIN), store, two catalogued drugs (store item bridged to a
//! pharmacy drug, HSN 3004 at 5%), and a purchase order sent to the supplier
//! for 100 of each at ₹20. Also the people: a store keeper, a store keeper
//! who may not post, and the bill reader's machine account.

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::common;

#[derive(Debug, Clone)]
pub struct Drug {
    pub store_id: Uuid,
    pub pharmacy_id: Uuid,
    pub name: String,
}

#[derive(Debug)]
pub struct World {
    pub app: common::TestApp,
    pub csrf: String,
    pub tenant: Uuid,
    pub tag: String,
    pub vendor: Uuid,
    pub gstin: String,
    pub store: Uuid,
    pub drugs: Vec<Drug>,
    pub po: Uuid,
    pub po_items: Vec<Uuid>,
}

/// A signed-in user and the CSRF token their writes carry.
#[derive(Debug)]
pub struct User {
    pub client: Client,
    pub csrf: String,
}

pub async fn send(
    user: (&Client, &str),
    app: &common::TestApp,
    method: &str,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let url = app.url(path);
    let req = match method {
        "GET" => user.0.get(url),
        "PUT" => user.0.put(url).json(&body),
        _ => user.0.post(url).json(&body),
    };
    let resp = req
        .header("x-csrf-token", user.1)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

/// A user of `role` with `extra` codes granted and `denied` codes withheld.
pub async fn user(
    app: &common::TestApp,
    admin_csrf: &str,
    role: &str,
    extra: &[&str],
    denied: &[&str],
) -> User {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("g{role}_{tag}"), format!("Grn#{tag}Aa9"));
    let resp = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", admin_csrf)
        .json(&json!({
            "username": username, "email": format!("{username}@example.test"),
            "password": password, "full_name": format!("Test {role}"), "role": role,
        }))
        .send()
        .await
        .expect("provision");
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );
    sqlx::query(
        "UPDATE users SET access_matrix = jsonb_build_object('extra', $2::jsonb, 'denied', $3::jsonb), \
                perm_version = perm_version + 1 WHERE username = $1",
    )
    .bind(&username)
    .bind(json!(extra))
    .bind(json!(denied))
    .execute(&app.db)
    .await
    .expect("access");
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    User {
        client,
        csrf: login["csrf_token"].as_str().unwrap_or_default().to_owned(),
    }
}

async fn drug(app: &common::TestApp, tenant: Uuid, name: &str, schedule: &str) -> Drug {
    let code = format!("G{}", &Uuid::new_v4().simple().to_string()[..10]).to_uppercase();
    let store_id: Uuid = sqlx::query_scalar(
        "INSERT INTO store_catalog (tenant_id, code, name, hsn_code) VALUES ($1, $2, $3, '3004') RETURNING id",
    )
    .bind(tenant)
    .bind(&code)
    .bind(name)
    .fetch_one(&app.db)
    .await
    .expect("store item");
    let pharmacy_id: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, generic_name, inn_name, strength, \
             dosage_form, drug_schedule, hsn_code, gst_rate, store_catalog_id) \
         VALUES ($1, $2, $3, 'zorbelin', 'zorbelin', '650 mg', 'tablet', $4, '3004', 5, $5) RETURNING id",
    )
    .bind(tenant)
    .bind(&code)
    .bind(name)
    .bind(schedule)
    .bind(store_id)
    .fetch_one(&app.db)
    .await
    .expect("drug");
    Drug {
        store_id,
        pharmacy_id,
        name: name.to_owned(),
    }
}

pub async fn world() -> World {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..6].to_uppercase();
    let gstin = format!("29ABCDE{}1Z5", &tag[..4])
        .chars()
        .take(15)
        .collect::<String>();
    let vendor: Uuid = sqlx::query_scalar(
        "INSERT INTO vendors (tenant_id, code, name, gst_number) VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("GV{tag}"))
    .bind(format!("Stockist {tag}"))
    .bind(&gstin)
    .fetch_one(&app.db)
    .await
    .expect("vendor");
    let store: Uuid = sqlx::query_scalar(
        "INSERT INTO store_locations (tenant_id, code, name, location_type) \
         VALUES ($1, $2, $3, 'pharmacy') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("GS{tag}"))
    .bind(format!("Receiving pharmacy {tag}"))
    .fetch_one(&app.db)
    .await
    .expect("store");
    let drugs = vec![
        drug(&app, tenant, &format!("Zorbelin 650 Tablet {tag}"), "H").await,
        drug(&app, tenant, &format!("Quintavir 200 Capsule {tag}"), "H").await,
    ];
    let po: Uuid = sqlx::query_scalar(
        "INSERT INTO purchase_orders (tenant_id, po_number, vendor_id, status, created_by, total_amount) \
         SELECT $1, $2, $3, 'sent_to_vendor', id, 4000 FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(tenant)
    .bind(format!("PO-G{tag}"))
    .bind(vendor)
    .fetch_one(&app.db)
    .await
    .expect("po");
    let mut po_items = Vec::new();
    for d in &drugs {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO purchase_order_items (tenant_id, po_id, catalog_item_id, item_name, \
                 quantity_ordered, unit_price, total_amount) \
             VALUES ($1, $2, $3, $4, 100, 20, 2000) RETURNING id",
        )
        .bind(tenant)
        .bind(po)
        .bind(d.store_id)
        .bind(&d.name)
        .fetch_one(&app.db)
        .await
        .expect("po item");
        po_items.push(id);
    }
    World {
        app,
        csrf,
        tenant,
        tag,
        vendor,
        gstin,
        store,
        drugs,
        po,
        po_items,
    }
}

impl World {
    pub fn admin(&self) -> (&Client, &str) {
        (&self.app.client, &self.csrf)
    }

    pub async fn call(&self, method: &str, path: &str, body: Value) -> (StatusCode, Value) {
        send(self.admin(), &self.app, method, path, body).await
    }

    /// A GRN line for drug `i`: 10 billed at ₹20, MRP ₹30, 5% GST.
    pub fn line(&self, i: usize, batch: &str) -> Value {
        json!({
            "po_item_id": self.po_items[i], "catalog_item_id": self.drugs[i].store_id,
            "item_name": self.drugs[i].name, "quantity_received": 10, "quantity_accepted": 10,
            "batch_number": batch, "expiry_date": "2030-06-30", "unit_price": "20",
            "mrp": "30", "gst_rate": "5", "hsn_code": "3004", "free_quantity": 1,
        })
    }

    pub fn grn(&self, invoice: &str, date: &str, lines: Vec<Value>) -> Value {
        // 10 × ₹20 + 5% = ₹210 a line.
        let total = 210 * lines.len();
        json!({
            "po_id": self.po, "store_location_id": self.store, "invoice_number": invoice,
            "invoice_date": date, "invoice_amount": total.to_string(), "items": lines,
        })
    }

    pub async fn pharmacy_stock(&self, i: usize) -> i32 {
        sqlx::query_scalar("SELECT current_stock FROM pharmacy_catalog WHERE id = $1")
            .bind(self.drugs[i].pharmacy_id)
            .fetch_one(&self.app.db)
            .await
            .expect("stock")
    }

    pub async fn po_received(&self, i: usize) -> i32 {
        sqlx::query_scalar("SELECT quantity_received FROM purchase_order_items WHERE id = $1")
            .bind(self.po_items[i])
            .fetch_one(&self.app.db)
            .await
            .expect("po received")
    }

    pub async fn batches_on(&self, grn: &str) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM pharmacy_batches WHERE grn_id = $1::uuid")
            .bind(grn)
            .fetch_one(&self.app.db)
            .await
            .expect("batches")
    }
}

/// What the bill reader sends back for a bill of `lines` (name, batch, qty).
pub fn parse_result(gstin: &str, invoice: &str, lines: &[(&str, &str, i32)]) -> Value {
    let field = |v: Value, c: f64| json!({ "value": v, "confidence": c, "page": 1 });
    let total = 21 * lines.iter().map(|l| l.2).sum::<i32>();
    json!({
        "worker": "mock-reader-1",
        "overall_confidence": 0.91,
        "header": {
            "supplier_gstin": field(json!(gstin), 0.99),
            "supplier_name": field(json!("Stockist"), 0.97),
            "invoice_number": field(json!(invoice), 0.98),
            "invoice_date": field(json!("01/10/2026"), 0.97),
            "invoice_total": field(json!(total.to_string()), 0.96),
        },
        "lines": lines.iter().map(|(name, batch, qty)| json!({
            "product_name": field(json!(name), 0.93),
            "batch_number": field(json!(batch), 0.62),
            "expiry_date": field(json!("09/30"), 0.9),
            "quantity": field(json!(qty.to_string()), 0.97),
            "rate": field(json!("20.00"), 0.96),
            "mrp": field(json!("30.00"), 0.95),
            "gst_rate": field(json!("5"), 0.99),
            "hsn_code": field(json!("3004"), 0.99),
        })).collect::<Vec<_>>(),
    })
}

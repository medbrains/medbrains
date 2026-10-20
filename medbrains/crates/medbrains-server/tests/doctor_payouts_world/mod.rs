#![allow(dead_code, unreachable_pub)]

//! The world the doctor-payout tests run in: the seeded hospital, doctors
//! provisioned per test, rate cards and agreements made through the API,
//! and bills raised, issued and paid through the billing API.

use reqwest::{Client, StatusCode};
use rust_decimal::Decimal;
use serde_json::{Value, json};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::common::{self, Staff};

/// Payout settings are per tenant and these tests share one.
pub static SERIAL: Mutex<()> = Mutex::const_new(());

pub struct World {
    pub app: common::TestApp,
    pub csrf: String,
    pub tenant: Uuid,
}

pub async fn world() -> World {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar(
        "SELECT t.id FROM tenants t JOIN users u ON u.tenant_id = t.id WHERE u.username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("tenant");
    sqlx::query(
        "UPDATE doctor_payout_settings SET referral_enabled = false, \
         referral_individuals_enabled = false WHERE tenant_id = $1",
    )
    .bind(tenant)
    .execute(&app.db)
    .await
    .expect("reset settings");
    World { app, csrf, tenant }
}

pub fn tag() -> String {
    Uuid::new_v4().simple().to_string()[..8].to_uppercase()
}

/// A valid-looking PAN nobody else in the tenant has.
pub fn pan() -> String {
    let n = Uuid::new_v4().as_u128();
    let letters: String = (0..5)
        .map(|i| char::from(b'A' + ((n >> (i * 5)) % 26) as u8))
        .collect();
    format!("{letters}{:04}Z", (n >> 40) % 10_000)
}

pub fn d(v: &str) -> Decimal {
    v.parse().expect("decimal")
}

impl World {
    pub async fn send(
        &self,
        client: &Client,
        csrf: &str,
        method: &str,
        path: &str,
        body: Value,
    ) -> (StatusCode, Value) {
        let url = self.app.url(path);
        let req = match method {
            "GET" => client.get(url),
            "PUT" => client.put(url).json(&body),
            "DELETE" => client.delete(url),
            _ => client.post(url).json(&body),
        };
        let resp = req
            .header("x-csrf-token", csrf)
            .send()
            .await
            .expect("request");
        let status = resp.status();
        (status, resp.json().await.unwrap_or(Value::Null))
    }

    /// As the bootstrap admin (a bypass role).
    pub async fn call(&self, method: &str, path: &str, body: Value) -> (StatusCode, Value) {
        self.send(&self.app.client, &self.csrf, method, path, body)
            .await
    }

    pub async fn ok(&self, method: &str, path: &str, body: Value) -> Value {
        let (status, out) = self.call(method, path, body).await;
        assert_eq!(status, StatusCode::OK, "{method} {path}: {out}");
        out
    }

    pub async fn as_staff(
        &self,
        s: &Staff,
        method: &str,
        path: &str,
        body: Value,
    ) -> (StatusCode, Value) {
        self.send(&s.client, &s.csrf, method, path, body).await
    }

    pub async fn staff(&self, role: &str) -> Staff {
        common::provision_staff(&self.app, &self.csrf, role, &[]).await
    }

    pub async fn today(&self) -> String {
        sqlx::query_scalar::<_, String>("SELECT CURRENT_DATE::text")
            .fetch_one(&self.app.db)
            .await
            .expect("today")
    }

    /// A rate card with these rules; returns its id.
    pub async fn rate_card(&self, rules: &[Value]) -> Uuid {
        let id = self
            .ok(
                "POST",
                "/api/doctor-payouts/rate-cards",
                json!({ "plan_name": "Test card", "plan_code": format!("RC{}", tag()),
                        "effective_from": "2020-01-01" }),
            )
            .await;
        let id: Uuid = id.as_str().expect("card id").parse().expect("uuid");
        for rule in rules {
            self.ok(
                "POST",
                &format!("/api/doctor-payouts/rate-cards/{id}/rules"),
                rule.clone(),
            )
            .await;
        }
        id
    }

    /// An agreement on `card` with these terms over the defaults.
    pub async fn agreement(&self, doctor: Uuid, card: Uuid, terms: Value) -> Value {
        let mut body = json!({
            "doctor_id": doctor, "plan_id": card, "effective_from": "2020-01-01",
            "engagement_type": "fee_for_service", "accrual_basis": "billed", "share_on": "net",
            "discount_bearer": "pro_rata", "disallowance_bearer": "pro_rata",
            "charity_rule": "zero", "settlement_cycle": "monthly", "payout_mode": "cash",
        });
        if let (Some(b), Some(t)) = (body.as_object_mut(), terms.as_object()) {
            for (k, v) in t {
                b.insert(k.clone(), v.clone());
            }
        }
        self.ok("POST", "/api/doctor-payouts/agreements", body)
            .await
    }

    pub async fn patient(&self) -> Uuid {
        sqlx::query_scalar(
            "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
             VALUES ($1, $2, 'Ravi', 'Kumar', 'male', $3) RETURNING id",
        )
        .bind(self.tenant)
        .bind(format!("UH-DP-{}", tag()))
        .bind(format!("9{:09}", Uuid::new_v4().as_u128() % 1_000_000_000))
        .fetch_one(&self.app.db)
        .await
        .expect("patient")
    }

    /// A draft bill for `patient` with these lines (each `{charge_code,
    /// unit_price, ...}`, `source` defaults to manual).
    pub async fn bill_for(&self, patient: Uuid, lines: &[Value]) -> Uuid {
        let invoice = self
            .ok(
                "POST",
                "/api/billing/invoices",
                json!({ "patient_id": patient }),
            )
            .await;
        let id: Uuid = invoice["id"]
            .as_str()
            .expect("invoice id")
            .parse()
            .expect("uuid");
        for line in lines {
            let mut body = json!({ "description": "Service", "source": "manual", "quantity": 1,
                                   "tax_percent": 0 });
            if let (Some(b), Some(l)) = (body.as_object_mut(), line.as_object()) {
                for (k, v) in l {
                    b.insert(k.clone(), v.clone());
                }
            }
            self.ok("POST", &format!("/api/billing/invoices/{id}/items"), body)
                .await;
        }
        id
    }

    pub async fn bill(&self, lines: &[Value]) -> Uuid {
        let patient = self.patient().await;
        self.bill_for(patient, lines).await
    }

    pub async fn issue(&self, invoice: Uuid) {
        self.ok(
            "POST",
            &format!("/api/billing/invoices/{invoice}/issue"),
            json!({}),
        )
        .await;
    }

    pub async fn pay(&self, invoice: Uuid, amount: &str) -> Value {
        self.ok(
            "POST",
            &format!("/api/billing/invoices/{invoice}/payments"),
            json!({ "amount": amount, "mode": "cash" }),
        )
        .await
    }

    /// Every ledger row of a doctor: (event, role, amount), oldest first.
    pub async fn ledger(&self, doctor: Uuid) -> Vec<(String, String, Decimal)> {
        sqlx::query_as(
            "SELECT event, role, amount FROM doctor_payout_accruals \
              WHERE doctor_id = $1 ORDER BY created_at, id",
        )
        .bind(doctor)
        .fetch_all(&self.app.db)
        .await
        .expect("ledger")
    }

    pub async fn earned(&self, doctor: Uuid) -> Decimal {
        self.ledger(doctor).await.iter().map(|r| r.2).sum()
    }

    /// Prepare a statement for today as the admin.
    pub async fn prepare(&self, doctor: Uuid) -> (StatusCode, Value) {
        let today = self.today().await;
        self.call(
            "POST",
            "/api/doctor-payouts/statements",
            json!({ "doctor_id": doctor, "period_start": "2020-01-01", "period_end": today }),
        )
        .await
    }

    /// A staff member of `role` holding `extra` permissions on top.
    pub async fn staff_with(&self, role: &str, extra: &[&str]) -> Staff {
        let t = tag().to_lowercase();
        let (username, password) = (format!("dp{role}_{t}"), format!("Staff#{t}Aa9"));
        let (status, out) = self
            .call(
                "POST",
                "/api/setup/users",
                json!({ "username": username, "email": format!("{username}@example.test"),
                        "password": password, "full_name": format!("Dr Test {t}"), "role": role }),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{out}");
        let user_id: Uuid = sqlx::query_scalar(
            "UPDATE users SET access_matrix = jsonb_build_object('extra', $2::jsonb, 'denied', '[]'::jsonb), \
                    perm_version = perm_version + 1 WHERE username = $1 RETURNING id",
        )
        .bind(&username)
        .bind(json!(extra))
        .fetch_one(&self.app.db)
        .await
        .expect("user");
        let client = Client::builder()
            .cookie_store(true)
            .build()
            .expect("client");
        let login: Value = client
            .post(self.app.url("/api/auth/login"))
            .json(&json!({ "username": username, "password": password }))
            .send()
            .await
            .expect("login")
            .json()
            .await
            .expect("login json");
        let csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();
        Staff {
            client,
            csrf,
            user_id,
        }
    }

    /// A second approver, not the admin who prepared.
    pub async fn approver(&self) -> Staff {
        self.staff_with(
            "billing_clerk",
            &[
                "doctor_payouts.statements.approve",
                "doctor_payouts.payouts.execute",
            ],
        )
        .await
    }
}

pub fn fixed(code: &str, amount: &str) -> Value {
    json!({ "rule_name": format!("{code} fixed"), "charge_code": code, "role": "primary",
            "calc_kind": "fixed", "fixed_amount": amount })
}

pub fn percent(code: &str, pct: &str) -> Value {
    json!({ "rule_name": format!("{code} share"), "charge_code": code, "role": "primary",
            "calc_kind": "percent", "percentage": pct })
}

/// Record a manual cash payout of an approved statement.
pub async fn pay_cash(w: &World, statement: &str) {
    w.ok(
        "POST",
        "/api/doctor-payouts/payouts",
        json!({ "statement_ids": [statement], "provider": "manual", "mode": "cash", "reference": "RCPT-1" }),
    )
    .await;
}

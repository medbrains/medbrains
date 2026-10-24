#![allow(dead_code, unreachable_pub)]

//! The world the provider-parametrised payments suite runs in: the real
//! server pointed (through each provider's `<CODE>_API_BASE_OVERRIDE`) at
//! stand-ins for Razorpay, Cashfree, PhonePe and PayU, a hospital with keys
//! for all four, and each provider's webhook signed the way that provider
//! signs it.

pub mod notices;
pub mod stand_in;

use std::collections::HashMap;
use std::sync::Arc;

use axum::http::StatusCode;
use base64::Engine as _;
use hmac::{Hmac, KeyInit, Mac};
use serde_json::{Value, json};
use sha2::{Digest, Sha256, Sha512};
use uuid::Uuid;

use crate::common;
use crate::payments_world::{Razorpay, World, hmac_hex};
use stand_in::Stand;

pub const PROVIDERS: [&str; 4] = ["razorpay", "cashfree", "phonepe", "payu"];
pub const RETURN_URL: &str = "http://127.0.0.1:5173/billing/invoices";

const RZ_SECRET: &str = "online-rz-secret";
const RZ_WEBHOOK: &str = "online-rz-webhook";
const CF_SECRET: &str = "online-cf-secret";
const PP_USER: &str = "medbrains-hook";
const PP_PASS: &str = "online-pp-pass";
const PAYU_KEY: &str = "gtKFFx";
const PAYU_SALT: &str = "online-payu-salt";

/// The hospital's keys for a provider.
pub fn keys(provider: &str) -> Value {
    match provider {
        "razorpay" => {
            json!({ "key_id": "rzp_test_online", "key_secret": RZ_SECRET, "webhook_secret": RZ_WEBHOOK })
        }
        "cashfree" => json!({ "client_id": "cf-app", "client_secret": CF_SECRET }),
        "phonepe" => {
            json!({ "client_id": "pp-client", "client_version": "1", "client_secret": "pp-secret",
                              "webhook_username": PP_USER, "webhook_password": PP_PASS })
        }
        _ => json!({ "key": PAYU_KEY, "salt": PAYU_SALT }),
    }
}

pub struct Online {
    pub w: World,
    pub stand: Arc<Stand>,
    /// Where each stand-in is, by provider.
    pub bases: HashMap<&'static str, String>,
}

pub async fn online() -> Online {
    let stand = Arc::new(Stand::default());
    let bases = stand_in::spawn(Arc::clone(&stand)).await;
    let mut secrets = common::TestSecrets::default();
    for (code, base) in &bases {
        secrets = secrets.with(
            &format!("{}_API_BASE_OVERRIDE", code.to_ascii_uppercase()),
            base.clone(),
        );
    }
    let app = common::spawn_app_with_secrets(secrets).await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar(
        "SELECT t.id FROM tenants t JOIN users u ON u.tenant_id = t.id WHERE u.username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("tenant");
    let w = World {
        app,
        csrf,
        tenant,
        razorpay: Arc::new(Razorpay::default()),
    };
    for p in PROVIDERS {
        w.setting(&format!("{p}_config"), keys(p)).await;
    }
    w.setting("upi_vpa", json!("hospital@okaxis")).await;
    Online { w, stand, bases }
}

impl Online {
    /// The hospital takes online payments through `provider`, no fallback.
    pub async fn use_provider(&self, provider: &str) {
        self.w.setting("active_provider", json!(provider)).await;
        self.w.setting("fallback_provider", Value::Null).await;
        self.stand.down.lock().expect("down").clear();
    }

    /// Start an online payment: (status, body).
    pub async fn create(
        &self,
        invoice: Uuid,
        amount: i64,
        provider: Option<&str>,
    ) -> (StatusCode, Value) {
        self.w
            .call(
                "POST",
                "/api/payments/create-order",
                json!({ "invoice_id": invoice, "amount": amount,
                "callback_url": RETURN_URL, "provider": provider }),
            )
            .await
    }

    /// An order that opened: (transaction id, the provider's order ref).
    pub async fn order(&self, invoice: Uuid, amount: i64) -> (Uuid, String) {
        let (status, body) = self.create(invoice, amount, None).await;
        assert_eq!(status, StatusCode::OK, "{body}");
        (
            body["transaction_id"]
                .as_str()
                .expect("txn")
                .parse()
                .expect("uuid"),
            body["order_id"].as_str().expect("order").to_owned(),
        )
    }

    /// The browser's return from checkout, as each provider's checkout gives it.
    pub async fn verify(
        &self,
        provider: &str,
        txn: Uuid,
        order: &str,
        payment: &str,
    ) -> (StatusCode, Value) {
        let body = if provider == "razorpay" {
            json!({ "razorpay_order_id": order, "razorpay_payment_id": payment,
                    "razorpay_signature": hmac_hex(RZ_SECRET, &format!("{order}|{payment}")) })
        } else {
            json!({ "transaction_id": txn })
        };
        self.w.call("POST", "/api/payments/verify", body).await
    }

    /// Post a provider's webhook, signed as it signs (or forged).
    pub async fn notify(&self, provider: &str, body: &Value, forged: bool) -> StatusCode {
        let client = reqwest::Client::new();
        let url = self.w.app.url(&format!("/api/webhooks/{provider}"));
        let request = match provider {
            "razorpay" => {
                let raw = body.to_string();
                let secret = if forged { "nope" } else { RZ_WEBHOOK };
                client
                    .post(url)
                    .header("content-type", "application/json")
                    .header("x-razorpay-signature", hmac_hex(secret, &raw))
                    .header(
                        "x-razorpay-event-id",
                        format!("evt_{}", Uuid::new_v4().simple()),
                    )
                    .body(raw)
            }
            "cashfree" => {
                let raw = body.to_string();
                let ts = chrono::Utc::now().timestamp_millis().to_string();
                let key: &[u8] = if forged {
                    b"nope"
                } else {
                    CF_SECRET.as_bytes()
                };
                let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("hmac");
                mac.update(ts.as_bytes());
                mac.update(raw.as_bytes());
                let sig =
                    base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());
                client
                    .post(url)
                    .header("content-type", "application/json")
                    .header("x-webhook-timestamp", ts)
                    .header("x-webhook-signature", sig)
                    .body(raw)
            }
            "phonepe" => {
                let pass = if forged { "nope" } else { PP_PASS };
                let auth = hex::encode(Sha256::digest(format!("{PP_USER}:{pass}").as_bytes()));
                client
                    .post(url)
                    .header("content-type", "application/json")
                    .header("authorization", auth)
                    .body(body.to_string())
            }
            _ => {
                let salt = if forged { "nope" } else { PAYU_SALT };
                client.post(url).form(&payu_signed(body, salt))
            }
        };
        StatusCode::from_u16(request.send().await.expect("webhook").status().as_u16())
            .expect("status")
    }

    /// A payment row waiting for its link, as a delivery opens one.
    pub async fn pending_row(&self, invoice: Uuid, amount: i64) -> Uuid {
        sqlx::query_scalar(
            "INSERT INTO payment_gateway_transactions (tenant_id, invoice_id, gateway, gateway_order_id, \
             amount, currency, status, notes) \
             VALUES ($1, $2, 'razorpay', '', $3, 'INR', 'pending_gateway', '{}'::jsonb) RETURNING id",
        )
        .bind(self.w.tenant)
        .bind(invoice)
        .bind(rust_decimal::Decimal::from(amount))
        .fetch_one(&self.w.app.db)
        .await
        .expect("row")
    }

    /// The outbox worker makes the row's link: (gateway, gateway_order_id, status).
    pub async fn make_link(&self, row: Uuid) -> (String, String, String) {
        use medbrains_outbox::Handler as _;
        let handler = medbrains_payment_gateway::payment_link::PaymentLinkHandler;
        let mut secrets = common::TestSecrets::default();
        for (code, base) in &self.bases {
            secrets = secrets.with(
                &format!("{}_API_BASE_OVERRIDE", code.to_ascii_uppercase()),
                base.clone(),
            );
        }
        let ctx = medbrains_outbox::HandlerCtx {
            pool: self.w.app.db.clone(),
            tenant_id: self.w.tenant,
            event_id: Uuid::new_v4(),
            event_type: handler.event_type().to_owned(),
            actor_user_id: None,
            attempts: 0,
            secret_resolver: Arc::new(secrets),
            http_client: reqwest::Client::new(),
            object_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
                std::env::temp_dir().join("medbrains-test-docs"),
            )),
        };
        handler
            .handle(
                &ctx,
                &json!({ "internal_payment_id": row, "description": "Medicines" }),
            )
            .await
            .expect("handled");
        sqlx::query_as("SELECT gateway, gateway_order_id, status FROM payment_gateway_transactions WHERE id = $1")
            .bind(row)
            .fetch_one(&self.w.app.db)
            .await
            .expect("row")
    }
}

/// PayU's callback fields with the reverse hash under `salt`.
pub fn payu_signed(fields: &Value, salt: &str) -> Vec<(String, String)> {
    let g = |k: &str| fields[k].as_str().unwrap_or_default().to_owned();
    let text = format!(
        "{salt}|{}|||||||||||{}|{}|{}|{}|{}|{PAYU_KEY}",
        g("status"),
        g("email"),
        g("firstname"),
        g("productinfo"),
        g("amount"),
        g("txnid")
    );
    let mut out: Vec<(String, String)> = fields
        .as_object()
        .map(|m| {
            m.iter()
                .map(|(k, v)| (k.clone(), v.as_str().unwrap_or_default().to_owned()))
                .collect()
        })
        .unwrap_or_default();
    out.push(("key".to_owned(), PAYU_KEY.to_owned()));
    out.push((
        "hash".to_owned(),
        hex::encode(Sha512::digest(text.as_bytes())),
    ));
    out
}

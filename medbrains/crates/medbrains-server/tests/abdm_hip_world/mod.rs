#![allow(dead_code, unreachable_pub)]

//! The stand-in world the ABDM M2 tests run in: a mock gateway and HIU that
//! record every call, the gateway's signing key, a campus with an HFR ID and a
//! patient with a verified ABHA.

pub mod hiu;

use std::{
    collections::HashMap,
    future::Future,
    pin::Pin,
    sync::{Arc, Mutex},
};

use axum::{
    Json, Router,
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode, Uri},
    routing::post,
};
use openssl::{pkey::PKey, rsa::Rsa};
use serde_json::{Map, Value, json};
use uuid::Uuid;

use crate::common;

#[derive(Clone, Debug)]
pub struct Call {
    pub path: String,
    pub headers: HeaderMap,
    pub body: Value,
}

pub type Calls = Arc<Mutex<Vec<Call>>>;
/// Run while the gateway call is still open — ABDM answering before our
/// call returns.
pub type Hook = Arc<dyn Fn(Call) -> Pin<Box<dyn Future<Output = ()> + Send>> + Send + Sync>;
pub type Hooks = Arc<Mutex<HashMap<String, Hook>>>;

/// The gateway (sessions + every HIP call, answered 202) and the HIU push URL.
async fn spawn_mock(calls: Calls, hooks: Hooks) -> String {
    async fn record(
        State((c, hooks)): State<(Calls, Hooks)>,
        uri: Uri,
        headers: HeaderMap,
        body: Bytes,
    ) -> StatusCode {
        let body = serde_json::from_slice(&body).unwrap_or(Value::Null);
        let call = Call {
            path: uri.path().to_owned(),
            headers,
            body,
        };
        c.lock().expect("calls").push(call.clone());
        let hook = hooks.lock().expect("hooks").get(&call.path).cloned();
        if let Some(hook) = hook {
            hook(call).await;
        }
        StatusCode::ACCEPTED
    }
    let app = Router::new()
        .route(
            "/sessions",
            post(|| async { Json(json!({ "accessToken": "session-token", "expiresIn": 1200 })) }),
        )
        .fallback(record)
        .with_state((calls, hooks));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock");
    let addr = listener.local_addr().expect("addr");
    tokio::spawn(async move { axum::serve(listener, app).await.ok() });
    format!("http://{addr}")
}

pub struct World {
    pub app: common::TestApp,
    pub csrf: String,
    pub calls: Calls,
    pub hooks: Hooks,
    pub mock: String,
    pub gateway_key: Vec<u8>,
    pub hip_id: String,
    pub patient_id: Uuid,
    pub uhid: String,
    pub address: String,
}

impl std::fmt::Debug for World {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("World")
            .field("hip_id", &self.hip_id)
            .field("patient_id", &self.patient_id)
            .finish_non_exhaustive()
    }
}

impl World {
    /// Calls to `path` so far.
    pub fn count(&self, path: &str) -> usize {
        self.calls
            .lock()
            .expect("calls")
            .iter()
            .filter(|c| c.path == path)
            .count()
    }

    /// Answer calls to `path` with `hook` before the gateway replies.
    pub fn on(&self, path: &str, hook: Hook) {
        self.hooks
            .lock()
            .expect("hooks")
            .insert(path.to_owned(), hook);
    }

    pub fn last(&self, path: &str) -> Call {
        let calls = self.calls.lock().expect("calls");
        let found = calls.iter().rev().find(|c| c.path == path).cloned();
        let seen: Vec<&str> = calls.iter().map(|c| c.path.as_str()).collect();
        assert!(found.is_some(), "no call to {path}; saw {seen:?}");
        found.expect("recorded call")
    }

    /// A gateway callback, signed with `key` (the gateway's unless a test forges one).
    pub async fn callback(&self, path: &str, key: &[u8], body: Value) -> StatusCode {
        let jwt =
            medbrains_crypto::jws::sign_rs256(Map::new(), std::time::Duration::from_secs(60), key)
                .expect("sign");
        let resp = reqwest::Client::new()
            .post(self.app.url(path))
            .bearer_auth(jwt)
            .header("REQUEST-ID", Uuid::new_v4().to_string())
            .header("X-HIP-ID", &self.hip_id)
            .json(&body)
            .send()
            .await
            .expect("callback");
        StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR)
    }

    pub async fn context(&self, reference: &str) -> (Uuid, String, Option<String>) {
        sqlx::query_as("SELECT id, link_status, linked_via FROM abdm_care_contexts WHERE reference_number = $1")
            .bind(reference)
            .fetch_one(&self.app.db)
            .await
            .expect("care context")
    }

    /// Close an OPD consultation for the patient; returns its care-context reference.
    pub async fn close_consultation(&self) -> String {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status, chief_complaints, diagnosis) \
             SELECT tenant_id, id, 'opd', 'open', 'Fever for 3 days', 'Viral fever' FROM patients WHERE id = $1 \
             RETURNING id",
        )
        .bind(self.patient_id)
        .fetch_one(&self.app.db)
        .await
        .expect("encounter");
        sqlx::query("UPDATE encounters SET status = 'completed' WHERE id = $1")
            .bind(id)
            .execute(&self.app.db)
            .await
            .expect("close");
        format!("OPC-{id}")
    }
}

pub async fn world() -> World {
    let calls: Calls = Arc::default();
    let hooks: Hooks = Arc::default();
    let mock = spawn_mock(calls.clone(), hooks.clone()).await;
    let gateway = PKey::from_rsa(Rsa::generate(2048).expect("rsa")).expect("pkey");
    let public = String::from_utf8(gateway.public_key_to_pem().expect("pem")).expect("utf8");
    let app = common::spawn_app_with_secrets(
        common::TestSecrets::default()
            .with(medbrains_abdm::ABDM_BASE_URL_OVERRIDE, mock.clone())
            .with(
                medbrains_abdm::gateway::ABDM_GATEWAY_BASE_URL_OVERRIDE,
                mock.clone(),
            )
            .with("ABDM_GATEWAY_JWT_PUBLIC_KEY_OVERRIDE", public)
            // Where HIPs are told to push records to us (M3).
            .with("MEDBRAINS_PUBLIC_BASE_URL", "https://hospital.test")
            // A stand-in HIP serving linked entries on loopback (M3).
            .with("ABDM_HIU_LINK_ALLOW_LOOPBACK", "true"),
    )
    .await;
    let csrf = app.login_admin().await;
    let saved = app
        .client
        .put(app.url("/api/abdm/settings"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "environment": "sandbox", "client_id": "sbx-client", "client_secret": "sbx-secret" }))
        .send()
        .await
        .expect("settings");
    assert!(saved.status().is_success());

    let tag = Uuid::new_v4().simple().to_string().to_uppercase();
    let hip_id = format!("IN{}", &tag[..10]);
    // A fresh database has no campus yet.
    sqlx::query(
        "INSERT INTO facilities (tenant_id, code, name, facility_type) \
           SELECT tenant_id, 'MAIN', 'Main hospital', 'main_hospital' FROM users \
           WHERE username = 'admin' AND NOT EXISTS (SELECT 1 FROM facilities f \
             WHERE f.tenant_id = users.tenant_id AND f.deleted_at IS NULL AND f.parent_id IS NULL)",
    )
    .execute(&app.db)
    .await
    .expect("campus");
    // The campus records are shared as: the one the server would pick.
    sqlx::query(
        "UPDATE facilities SET hfr_facility_id = $1 WHERE id = (SELECT id FROM facilities \
           WHERE tenant_id = (SELECT tenant_id FROM users WHERE username = 'admin') \
             AND deleted_at IS NULL AND parent_id IS NULL \
           ORDER BY (hfr_facility_id IS NOT NULL) DESC, (facility_type = 'main_hospital') DESC, created_at LIMIT 1)",
    )
    .bind(&hip_id)
    .execute(&app.db)
    .await
    .expect("hfr id");

    let abha = format!("91{:012}", Uuid::new_v4().as_u128() % 1_000_000_000_000);
    let address = format!("priya.{}@sbx", &tag[10..16].to_lowercase());
    let verification: Uuid = sqlx::query_scalar(
        "INSERT INTO abha_verifications (tenant_id, created_by, method, otp_system, environment, \
            login_id_cipher, abdm_txn_id, stage, abha_number, abha_address, profile, verified_at, expires_at) \
         SELECT tenant_id, id, 'abha_number', 'aadhaar', 'sandbox', 'cipher', 'txn', 'verified', $1, $2, $3, \
                now(), now() + interval '30 minutes' FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(&abha)
    .bind(&address)
    .bind(json!({ "abha_number": abha, "abha_address": address, "kyc_verified": true, "first_name": "Priya",
                  "last_name": "Varude", "date_of_birth": "1989-11-26", "gender": "female" }))
    .fetch_one(&app.db)
    .await
    .expect("verification");
    let patient: Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&json!({
            "first_name": "Priya", "last_name": "Varude", "gender": "female", "date_of_birth": "1989-11-26",
            "phone": format!("9{:09}", Uuid::new_v4().as_u128() % 1_000_000_000),
            "abha_number": abha, "abha_verification_id": verification,
        }))
        .send()
        .await
        .expect("register")
        .json()
        .await
        .expect("patient");
    let patient_id = Uuid::parse_str(patient["id"].as_str().expect("id")).expect("uuid");
    sqlx::query("UPDATE patient_abha_links SET abha_address = $2 WHERE patient_id = $1")
        .bind(patient_id)
        .bind(&address)
        .execute(&app.db)
        .await
        .expect("address");
    let uhid: String = sqlx::query_scalar("SELECT uhid FROM patients WHERE id = $1")
        .bind(patient_id)
        .fetch_one(&app.db)
        .await
        .expect("uhid");
    World {
        app,
        csrf,
        calls,
        hooks,
        mock,
        gateway_key: gateway.private_key_to_pem_pkcs8().expect("private"),
        hip_id,
        patient_id,
        uhid,
        address,
    }
}

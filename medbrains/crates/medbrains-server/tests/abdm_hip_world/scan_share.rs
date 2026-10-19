//! Scan & Share steps the tests share: a registration counter, a share
//! signed as the gateway would sign it, and the stored share rows.

use axum::http::StatusCode;
use medbrains_abdm::scan_share::CB_PROFILE_SHARE;
use serde_json::{Map, Value, json};
use uuid::Uuid;

use super::World;

/// A registration counter (a Reception station) with a fresh code.
pub async fn counter(w: &World) -> (Uuid, String) {
    let code = format!("REG-{}", &Uuid::new_v4().simple().to_string()[..8]);
    let id = sqlx::query_scalar(
        "INSERT INTO stations (tenant_id, code, name, station_type) \
         SELECT tenant_id, $1, 'Registration 1', 'reception' FROM users WHERE username = 'admin' \
         RETURNING id",
    )
    .bind(&code)
    .fetch_one(&w.app.db)
    .await
    .expect("station");
    (id, code)
}

pub fn new_abha() -> (String, String) {
    let n = Uuid::new_v4().as_u128();
    (
        format!("91{:012}", n % 1_000_000_000_000),
        format!("anil.{}@sbx", n % 1_000_000),
    )
}

pub fn body(code: &str, number: &str, address: &str) -> Value {
    json!({
        "intent": "PROFILE_SHARE",
        "metaData": { "context": code },
        "profile": { "patient": {
            "abhaNumber": number, "abhaAddress": address, "name": "Anil Kumar Rao",
            "gender": "M", "dayOfBirth": "5", "monthOfBirth": "6", "yearOfBirth": "1980",
            "phoneNumber": format!("9{:09}", Uuid::new_v4().as_u128() % 1_000_000_000),
            "address": { "line": "4 Station Road", "district": "Pune", "state": "Maharashtra",
                         "pincode": "411001" },
        } },
    })
}

/// The share callback with a chosen `REQUEST-ID`, signed with `key`.
pub async fn share(w: &World, key: &[u8], request_id: &str, body: &Value) -> StatusCode {
    let jwt =
        medbrains_crypto::jws::sign_rs256(Map::new(), std::time::Duration::from_secs(60), key)
            .expect("sign");
    let resp = reqwest::Client::new()
        .post(w.app.url(CB_PROFILE_SHARE))
        .bearer_auth(jwt)
        .header("REQUEST-ID", request_id)
        .header("X-HIP-ID", &w.hip_id)
        .json(body)
        .send()
        .await
        .expect("share");
    StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Debug, sqlx::FromRow)]
pub struct Row {
    pub id: Uuid,
    pub status: String,
    pub token_number: Option<String>,
    pub patient_id: Option<Uuid>,
    pub token_id: Option<Uuid>,
}

pub async fn rows(w: &World, address: &str) -> Vec<Row> {
    sqlx::query_as(
        "SELECT id, status, token_number, patient_id, token_id FROM abdm_profile_shares \
          WHERE abha_address = $1 ORDER BY created_at",
    )
    .bind(address)
    .fetch_all(&w.app.db)
    .await
    .expect("shares")
}

pub async fn post(w: &World, path: &str, body: &Value) -> reqwest::Response {
    w.app
        .client
        .post(w.app.url(path))
        .header("x-csrf-token", &w.csrf)
        .json(body)
        .send()
        .await
        .expect("post")
}

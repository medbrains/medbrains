#![allow(dead_code, unreachable_pub)]

//! Staff on wards, each signed in on a client of their own — what the sticky
//! notes tests start from.

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::common;

pub struct Staff {
    pub client: Client,
    pub csrf: String,
}

impl Staff {
    pub async fn send(&self, req: reqwest::RequestBuilder) -> (StatusCode, Value) {
        let resp = req
            .header("x-csrf-token", &self.csrf)
            .send()
            .await
            .expect("request");
        let status = resp.status();
        (status, resp.json().await.unwrap_or(Value::Null))
    }
}

pub async fn department(app: &common::TestApp, tag: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         SELECT tenant_id, $1, $2, 'clinical' FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!("SN{}", tag.to_uppercase()))
    .bind(format!("Ward {tag}"))
    .fetch_one(&app.db)
    .await
    .expect("department")
}

/// A nurse in `department`, signed in on a client of their own.
pub async fn nurse(app: &common::TestApp, admin_csrf: &str, department: Uuid) -> (Staff, Uuid) {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("note_{tag}"), format!("Note#{tag}Aa9"));
    let resp = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", admin_csrf)
        .json(&json!({
            "username": username,
            "email": format!("{username}@example.test"),
            "password": password,
            "full_name": format!("Nurse {tag}"),
            "role": "nurse",
            "department_ids": [department],
        }))
        .send()
        .await
        .expect("create user");
    assert_eq!(resp.status(), StatusCode::OK);
    let id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = $1")
        .bind(&username)
        .fetch_one(&app.db)
        .await
        .expect("user id");
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
    let csrf = login["csrf_token"].as_str().expect("csrf").to_owned();
    (Staff { client, csrf }, id)
}

pub fn ids(list: &Value) -> Vec<String> {
    list.as_array()
        .map(|a| {
            a.iter()
                .filter_map(|n| n["id"].as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

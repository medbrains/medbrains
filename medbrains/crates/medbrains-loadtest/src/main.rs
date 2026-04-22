// MedBrains — Goose Load Testing
//
// Usage:
//   cargo run --release -p medbrains-loadtest -- \
//     --host http://localhost:3000 --users 10 --hatch-rate 2 --run-time 30s
//
// Reports:
//   --report-file target/loadtest-report.html

use goose::prelude::*;
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

// ── Session State ──────────────────────────────────────────────

/// Per-user session holding the CSRF token from login.
#[derive(Debug, Default)]
struct Session {
    csrf_token: Option<String>,
}

// ── Helpers ────────────────────────────────────────────────────

/// POST with JSON body + CSRF header.
async fn json_post(
    user: &mut GooseUser,
    path: &str,
    body: &serde_json::Value,
) -> TransactionResult {
    let session: &Arc<Mutex<Session>> = user.get_session_data_unchecked();
    let csrf = session.lock().await.csrf_token.clone();

    let mut reqwest_builder = user
        .get_request_builder(&GooseMethod::Post, path)?
        .json(body);

    if let Some(token) = &csrf {
        reqwest_builder = reqwest_builder.header("X-CSRF-Token", token.as_str());
    }

    let request = GooseRequest::builder()
        .path(path)
        .method(GooseMethod::Post)
        .set_request_builder(reqwest_builder)
        .build();

    user.request(request).await?;
    Ok(())
}

// ── Entry Point ────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<(), GooseError> {
    GooseAttack::initialize()?
        // ── Scenario 1: Health Check (no auth, lightweight) ──
        .register_scenario(
            scenario!("HealthCheck")
                .set_weight(2)?
                .set_wait_time(Duration::from_secs(1), Duration::from_secs(3))?
                .register_transaction(transaction!(init_session).set_on_start())
                .register_transaction(transaction!(health_check)),
        )
        // ── Scenario 2: Auth Flow (login → me → logout) ──
        .register_scenario(
            scenario!("AuthFlow")
                .set_weight(3)?
                .set_wait_time(Duration::from_secs(1), Duration::from_secs(3))?
                .register_transaction(transaction!(init_session).set_on_start())
                .register_transaction(transaction!(login).set_on_start())
                .register_transaction(transaction!(get_me))
                .register_transaction(transaction!(logout).set_on_stop()),
        )
        // ── Scenario 3: Patient Browse (list + search) ──
        .register_scenario(
            scenario!("PatientBrowse")
                .set_weight(5)?
                .set_wait_time(Duration::from_secs(2), Duration::from_secs(5))?
                .register_transaction(transaction!(init_session).set_on_start())
                .register_transaction(transaction!(login).set_on_start())
                .register_transaction(transaction!(list_patients))
                .register_transaction(transaction!(search_patients))
                .register_transaction(transaction!(list_patients_page2))
                .register_transaction(transaction!(logout).set_on_stop()),
        )
        // ── Scenario 4: Patient Registration ──
        .register_scenario(
            scenario!("PatientRegistration")
                .set_weight(2)?
                .set_wait_time(Duration::from_secs(3), Duration::from_secs(8))?
                .register_transaction(transaction!(init_session).set_on_start())
                .register_transaction(transaction!(login).set_on_start())
                .register_transaction(transaction!(create_patient))
                .register_transaction(transaction!(logout).set_on_stop()),
        )
        // ── Scenario 5: Dashboard Overview ──
        .register_scenario(
            scenario!("DashboardOverview")
                .set_weight(3)?
                .set_wait_time(Duration::from_secs(5), Duration::from_secs(10))?
                .register_transaction(transaction!(init_session).set_on_start())
                .register_transaction(transaction!(login).set_on_start())
                .register_transaction(transaction!(dashboard_load))
                .register_transaction(transaction!(logout).set_on_stop()),
        )
        // ── Scenario 6: Master Data Reads ──
        .register_scenario(
            scenario!("MasterDataReads")
                .set_weight(1)?
                .set_wait_time(Duration::from_secs(2), Duration::from_secs(6))?
                .register_transaction(transaction!(init_session).set_on_start())
                .register_transaction(transaction!(login).set_on_start())
                .register_transaction(transaction!(read_religions))
                .register_transaction(transaction!(read_occupations))
                .register_transaction(transaction!(read_relations))
                .register_transaction(transaction!(logout).set_on_stop()),
        )
        .execute()
        .await?;

    Ok(())
}

// ── Session Init ───────────────────────────────────────────────

async fn init_session(user: &mut GooseUser) -> TransactionResult {
    user.set_session_data(Arc::new(Mutex::new(Session::default())));
    Ok(())
}

// ── Health ─────────────────────────────────────────────────────

async fn health_check(user: &mut GooseUser) -> TransactionResult {
    let _goose = user.get("/api/health").await?;
    Ok(())
}

// ── Auth ───────────────────────────────────────────────────────

async fn login(user: &mut GooseUser) -> TransactionResult {
    let body = json!({
        "username": "admin",
        "password": "admin123"
    });

    let reqwest_builder = user
        .get_request_builder(&GooseMethod::Post, "/api/auth/login")?
        .json(&body);

    let request = GooseRequest::builder()
        .path("/api/auth/login")
        .method(GooseMethod::Post)
        .set_request_builder(reqwest_builder)
        .build();

    let goose = user.request(request).await?;

    // Extract CSRF token from login response JSON
    if let Ok(response) = goose.response
        && let Ok(resp_body) = response.json::<serde_json::Value>().await
            && let Some(token) = resp_body.get("csrf_token").and_then(|v| v.as_str()) {
                let session: &Arc<Mutex<Session>> = user.get_session_data_unchecked();
                session.lock().await.csrf_token = Some(token.to_owned());
            }

    Ok(())
}

async fn get_me(user: &mut GooseUser) -> TransactionResult {
    let _goose = user.get("/api/auth/me").await?;
    Ok(())
}

async fn logout(user: &mut GooseUser) -> TransactionResult {
    json_post(user, "/api/auth/logout", &json!({})).await
}

// ── Patients ───────────────────────────────────────────────────

async fn list_patients(user: &mut GooseUser) -> TransactionResult {
    let _goose = user.get("/api/patients?page=1&per_page=20").await?;
    Ok(())
}

async fn list_patients_page2(user: &mut GooseUser) -> TransactionResult {
    let _goose = user.get("/api/patients?page=2&per_page=20").await?;
    Ok(())
}

async fn search_patients(user: &mut GooseUser) -> TransactionResult {
    let names = ["john", "jane", "raj", "priya", "kumar", "singh", "patel", "sharma"];
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos() as usize;
    let idx = nanos % names.len();
    let path = format!("/api/patients?search={}&per_page=10", names[idx]);
    let _goose = user.get(&path).await?;
    Ok(())
}

async fn create_patient(user: &mut GooseUser) -> TransactionResult {
    let id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    let body = json!({
        "first_name": format!("Load{}", id % 100_000),
        "last_name": format!("Test{}", id % 100_000),
        "gender": "male",
        "phone": format!("90{:08}", id % 100_000_000),
        "registration_type": "new",
        "registration_source": "opd",
        "category": "general",
        "financial_class": "self_pay"
    });
    json_post(user, "/api/patients", &body).await
}

// ── Dashboard ──────────────────────────────────────────────────

async fn dashboard_load(user: &mut GooseUser) -> TransactionResult {
    let _health = user.get("/api/health").await?;
    let _patients = user.get("/api/patients?page=1&per_page=5").await?;
    Ok(())
}

// ── Master Data ────────────────────────────────────────────────

async fn read_religions(user: &mut GooseUser) -> TransactionResult {
    let _goose = user.get("/api/masters/religions").await?;
    Ok(())
}

async fn read_occupations(user: &mut GooseUser) -> TransactionResult {
    let _goose = user.get("/api/masters/occupations").await?;
    Ok(())
}

async fn read_relations(user: &mut GooseUser) -> TransactionResult {
    let _goose = user.get("/api/masters/relations").await?;
    Ok(())
}

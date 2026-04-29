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

mod generated;

// ── Session State ──────────────────────────────────────────────

/// Per-user session holding the CSRF token + cached seed IDs.
///
/// Master IDs (drug, lab test, OPD/IPD departments) are resolved once
/// per virtual user via `seed_cache` and reused across iterations.
#[derive(Debug, Default)]
pub(crate) struct Session {
    csrf_token: Option<String>,
    drug_id: Option<String>,
    drug_name: Option<String>,
    lab_test_id: Option<String>,
    opd_dept_id: Option<String>,
    ipd_dept_id: Option<String>,
}

// ── Helpers ────────────────────────────────────────────────────

/// POST with JSON body + CSRF header.
pub(crate) async fn json_post(
    user: &mut GooseUser,
    path: &str,
    body: &serde_json::Value,
) -> TransactionResult {
    let _ = json_request(user, GooseMethod::Post, path, Some(body)).await?;
    Ok(())
}

/// PUT with JSON body + CSRF header.
pub(crate) async fn json_put(
    user: &mut GooseUser,
    path: &str,
    body: &serde_json::Value,
) -> TransactionResult {
    let _ = json_request(user, GooseMethod::Put, path, Some(body)).await?;
    Ok(())
}

/// POST/PUT/PATCH with JSON body that returns the response JSON value.
/// Used by chained transactions that need the new resource's `id`.
pub(crate) async fn json_request(
    user: &mut GooseUser,
    method: GooseMethod,
    path: &str,
    body: Option<&serde_json::Value>,
) -> Result<Option<serde_json::Value>, Box<TransactionError>> {
    let session: &Arc<Mutex<Session>> = user.get_session_data_unchecked();
    let csrf = session.lock().await.csrf_token.clone();

    let mut reqwest_builder = user.get_request_builder(&method, path)?;
    if let Some(b) = body {
        reqwest_builder = reqwest_builder.json(b);
    }
    if let Some(token) = &csrf {
        reqwest_builder = reqwest_builder.header("X-CSRF-Token", token.as_str());
    }

    let method_label = format!("{method:?}");
    let request = GooseRequest::builder()
        .path(path)
        .method(method)
        .set_request_builder(reqwest_builder)
        .build();

    let goose = user.request(request).await?;
    if let Ok(resp) = goose.response {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if !status.is_success() && std::env::var("LOADTEST_DEBUG").is_ok() {
            eprintln!("[loadtest] {method_label} {path} -> {status}: {text}");
        }
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
            return Ok(Some(value));
        }
    }
    Ok(None)
}

/// Authenticated GET that parses the response JSON.
pub(crate) async fn json_get(
    user: &mut GooseUser,
    path: &str,
) -> Result<Option<serde_json::Value>, Box<TransactionError>> {
    let goose = user.get(path).await?;
    if let Ok(resp) = goose.response
        && let Ok(value) = resp.json::<serde_json::Value>().await
    {
        return Ok(Some(value));
    }
    Ok(None)
}

/// Generate a unique-ish suffix from the system clock — used to build
/// patient names, phone numbers, etc. across virtual users.
fn unique_suffix() -> u32 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos()
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

        )
        // ── Scenario 4: Patient Registration ──
        .register_scenario(
            scenario!("PatientRegistration")
                .set_weight(2)?
                .set_wait_time(Duration::from_secs(3), Duration::from_secs(8))?
                .register_transaction(transaction!(init_session).set_on_start())
                .register_transaction(transaction!(login).set_on_start())
                .register_transaction(transaction!(create_patient))

        )
        // ── Scenario 5: Dashboard Overview ──
        .register_scenario(
            scenario!("DashboardOverview")
                .set_weight(3)?
                .set_wait_time(Duration::from_secs(5), Duration::from_secs(10))?
                .register_transaction(transaction!(init_session).set_on_start())
                .register_transaction(transaction!(login).set_on_start())
                .register_transaction(transaction!(dashboard_load))

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

        )
        // ── Scenario 7: Lab Order Flow (multi-step) ──
        // patient → encounter → lab order → fetch → cancel
        .register_scenario(
            scenario!("LabOrderFlow")
                .set_weight(3)?
                .set_wait_time(Duration::from_secs(2), Duration::from_secs(5))?
                .register_transaction(transaction!(init_session).set_on_start())
                .register_transaction(transaction!(login).set_on_start())
                .register_transaction(transaction!(seed_cache).set_on_start())
                .register_transaction(transaction!(lab_order_flow))

        )
        // ── Scenario 8: Pharmacy Dispense Flow (multi-step) ──
        // patient → encounter → prescription → pharmacy order → dispense
        .register_scenario(
            scenario!("PharmacyDispenseFlow")
                .set_weight(3)?
                .set_wait_time(Duration::from_secs(3), Duration::from_secs(7))?
                .register_transaction(transaction!(init_session).set_on_start())
                .register_transaction(transaction!(login).set_on_start())
                .register_transaction(transaction!(seed_cache).set_on_start())
                .register_transaction(transaction!(pharmacy_dispense_flow))

        )
        // ── Scenario 9: Billing Invoice Flow (multi-step) ──
        // patient → encounter → invoice → fetch detail
        .register_scenario(
            scenario!("BillingInvoiceFlow")
                .set_weight(2)?
                .set_wait_time(Duration::from_secs(3), Duration::from_secs(7))?
                .register_transaction(transaction!(init_session).set_on_start())
                .register_transaction(transaction!(login).set_on_start())
                .register_transaction(transaction!(seed_cache).set_on_start())
                .register_transaction(transaction!(billing_invoice_flow))

        )
        // ── Scenario 10: IPD Admission Flow (multi-step) ──
        // patient → admission → fetch detail
        .register_scenario(
            scenario!("IpdAdmissionFlow")
                .set_weight(2)?
                .set_wait_time(Duration::from_secs(4), Duration::from_secs(10))?
                .register_transaction(transaction!(init_session).set_on_start())
                .register_transaction(transaction!(login).set_on_start())
                .register_transaction(transaction!(seed_cache).set_on_start())
                .register_transaction(transaction!(ipd_admission_flow))

        )
        // ── Scenario 11: AllEndpoints (auto-generated breadth coverage) ──
        // One transaction per (method, path) parsed from routes/mod.rs.
        // Hits 939+ endpoints with placeholder UUIDs / empty bodies. 4xx/5xx
        // responses are expected for endpoints that need real resource state;
        // we still record latency + status histograms to spot regressions.
        .register_scenario(generated::build_all_endpoints_scenario()?.set_weight(1)?)
        .execute()
        .await?;

    Ok(())
}

// ── Session Init ───────────────────────────────────────────────

pub(crate) async fn init_session(user: &mut GooseUser) -> TransactionResult {
    user.set_session_data(Arc::new(Mutex::new(Session::default())));
    Ok(())
}

// ── Health ─────────────────────────────────────────────────────

async fn health_check(user: &mut GooseUser) -> TransactionResult {
    let _goose = user.get("/api/health").await?;
    Ok(())
}

// ── Auth ───────────────────────────────────────────────────────

pub(crate) async fn login(user: &mut GooseUser) -> TransactionResult {
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
        && let Some(token) = resp_body.get("csrf_token").and_then(|v| v.as_str())
    {
        let session: &Arc<Mutex<Session>> = user.get_session_data_unchecked();
        session.lock().await.csrf_token = Some(token.to_owned());
    }

    Ok(())
}

async fn get_me(user: &mut GooseUser) -> TransactionResult {
    let _goose = user.get("/api/auth/me").await?;
    Ok(())
}

/// Kept for ad-hoc smoke runs that want to drive the full auth lifecycle.
/// Not registered on any scenario by default — logout bumps `perm_version`
/// which invalidates the access token shared by every virtual user (they
/// all impersonate `admin`), so concurrent logout produces 401s that
/// pollute the loadtest signal.
#[allow(dead_code)]
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
    let names = [
        "john", "jane", "raj", "priya", "kumar", "singh", "patel", "sharma",
    ];
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

// ── Seed Cache ─────────────────────────────────────────────────
//
// Resolve master IDs once per virtual user (drugs, lab tests, OPD/IPD
// departments). Subsequent flow transactions reuse them so each iteration
// only stresses the operational endpoints, not the lookup ones.

async fn seed_cache(user: &mut GooseUser) -> TransactionResult {
    let depts = json_get(user, "/api/setup/departments").await?;
    let drugs = json_get(user, "/api/pharmacy/catalog").await?;
    let tests = json_get(user, "/api/lab/catalog").await?;

    let session: &Arc<Mutex<Session>> = user.get_session_data_unchecked();
    let mut s = session.lock().await;

    if let Some(arr) = depts.as_ref().and_then(|v| v.as_array()) {
        s.opd_dept_id = first_id_matching(arr, &["opd", "general", "consultation"]);
        s.ipd_dept_id =
            first_id_matching(arr, &["ipd", "medicine", "ward", "inpatient"])
                .or_else(|| s.opd_dept_id.clone());
    }
    if let Some(arr) = drugs.as_ref().and_then(|v| v.as_array())
        && let Some(first) = arr.first()
    {
        s.drug_id = first
            .get("id")
            .and_then(|v| v.as_str())
            .map(str::to_owned);
        s.drug_name = first
            .get("name")
            .and_then(|v| v.as_str())
            .map(str::to_owned);
    }
    if let Some(arr) = tests.as_ref().and_then(|v| v.as_array())
        && let Some(first) = arr.first()
    {
        s.lab_test_id = first
            .get("id")
            .and_then(|v| v.as_str())
            .map(str::to_owned);
    }
    Ok(())
}

fn first_id_matching(arr: &[serde_json::Value], needles: &[&str]) -> Option<String> {
    for needle in needles {
        if let Some(hit) = arr.iter().find(|d| {
            d.get("name")
                .and_then(|v| v.as_str())
                .is_some_and(|n| n.to_lowercase().contains(needle))
                || d.get("code")
                    .and_then(|v| v.as_str())
                    .is_some_and(|c| c.to_lowercase().contains(needle))
        }) {
            return hit
                .get("id")
                .and_then(|v| v.as_str())
                .map(str::to_owned);
        }
    }
    arr.first()
        .and_then(|d| d.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_owned)
}

// ── Multi-step Flows ───────────────────────────────────────────

/// Patient → encounter → lab order → fetch detail → cancel.
/// Mirrors the e2e `crud/lab.spec.ts` lifecycle.
async fn lab_order_flow(user: &mut GooseUser) -> TransactionResult {
    let Some(patient_id) = create_patient_inline(user).await? else {
        return Ok(());
    };
    let Some(encounter_id) = create_encounter_inline(user, &patient_id).await? else {
        return Ok(());
    };

    let test_id = {
        let session: &Arc<Mutex<Session>> = user.get_session_data_unchecked();
        session.lock().await.lab_test_id.clone()
    };
    let Some(test_id) = test_id else { return Ok(()) };

    let order_resp = json_request(
        user,
        GooseMethod::Post,
        "/api/lab/orders",
        Some(&json!({
            "patient_id": patient_id,
            "encounter_id": encounter_id,
            "test_id": test_id,
            "priority": "routine",
        })),
    )
    .await?;
    let Some(order_id) = order_resp
        .as_ref()
        .and_then(|v| v.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_owned)
    else {
        return Ok(());
    };

    // GET /lab/orders/{id} returns { order, results }
    let _ = json_get(user, &format!("/api/lab/orders/{order_id}")).await?;
    json_put(
        user,
        &format!("/api/lab/orders/{order_id}/cancel"),
        &json!({ "reason": "loadtest" }),
    )
    .await?;
    Ok(())
}

/// Patient → encounter → prescription → pharmacy order → dispense.
async fn pharmacy_dispense_flow(user: &mut GooseUser) -> TransactionResult {
    let Some(patient_id) = create_patient_inline(user).await? else {
        return Ok(());
    };
    let Some(encounter_id) = create_encounter_inline(user, &patient_id).await? else {
        return Ok(());
    };

    let (drug_id, drug_name) = {
        let session: &Arc<Mutex<Session>> = user.get_session_data_unchecked();
        let s = session.lock().await;
        (s.drug_id.clone(), s.drug_name.clone())
    };
    let (Some(drug_id), Some(drug_name)) = (drug_id, drug_name) else {
        return Ok(());
    };

    // Prescription
    let rx_resp = json_request(
        user,
        GooseMethod::Post,
        &format!("/api/opd/encounters/{encounter_id}/prescriptions"),
        Some(&json!({
            "items": [{
                "drug_name": drug_name,
                "catalog_item_id": drug_id,
                "dosage": "1 tab",
                "frequency": "TID",
                "duration": "5 days",
                "route": "oral",
            }]
        })),
    )
    .await?;
    let Some(rx_id) = rx_resp
        .as_ref()
        .and_then(|v| v.get("prescription"))
        .and_then(|v| v.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_owned)
    else {
        return Ok(());
    };

    // Pharmacy order — POST returns { order, items }
    let order_resp = json_request(
        user,
        GooseMethod::Post,
        "/api/pharmacy/orders",
        Some(&json!({
            "patient_id": patient_id,
            "prescription_id": rx_id,
            "encounter_id": encounter_id,
            "dispensing_type": "prescription",
            "items": [{
                "catalog_item_id": drug_id,
                "drug_name": drug_name,
                "quantity": 10,
                "unit_price": 5,
            }]
        })),
    )
    .await?;
    let Some(order_id) = order_resp
        .as_ref()
        .and_then(|v| v.get("order"))
        .and_then(|v| v.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_owned)
    else {
        return Ok(());
    };

    json_put(
        user,
        &format!("/api/pharmacy/orders/{order_id}/dispense"),
        &json!({}),
    )
    .await?;
    Ok(())
}

/// Patient → encounter → invoice → fetch detail.
async fn billing_invoice_flow(user: &mut GooseUser) -> TransactionResult {
    let Some(patient_id) = create_patient_inline(user).await? else {
        return Ok(());
    };
    let Some(encounter_id) = create_encounter_inline(user, &patient_id).await? else {
        return Ok(());
    };

    let inv_resp = json_request(
        user,
        GooseMethod::Post,
        "/api/billing/invoices",
        Some(&json!({
            "patient_id": patient_id,
            "encounter_id": encounter_id,
        })),
    )
    .await?;
    let Some(inv_id) = inv_resp
        .as_ref()
        .and_then(|v| v.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_owned)
    else {
        return Ok(());
    };

    let _ = json_get(user, &format!("/api/billing/invoices/{inv_id}")).await?;
    Ok(())
}

/// Patient → IPD admission → fetch detail.
async fn ipd_admission_flow(user: &mut GooseUser) -> TransactionResult {
    let Some(patient_id) = create_patient_inline(user).await? else {
        return Ok(());
    };

    let (ipd_dept_id,) = {
        let session: &Arc<Mutex<Session>> = user.get_session_data_unchecked();
        let s = session.lock().await;
        (s.ipd_dept_id.clone(),)
    };
    let Some(ipd_dept_id) = ipd_dept_id else {
        return Ok(());
    };

    // Pick a vacant bed (ignored if none seeded — admission may still 4xx
    // but goose records that as the response under test).
    let bed_id = json_get(user, "/api/ipd/beds/available")
        .await?
        .and_then(|v| v.as_array().cloned())
        .and_then(|arr| arr.first().cloned())
        .and_then(|b| b.get("id").cloned())
        .and_then(|v| v.as_str().map(str::to_owned));

    let body = if let Some(bed) = bed_id {
        json!({
            "patient_id": patient_id,
            "department_id": ipd_dept_id,
            "bed_id": bed,
            "admission_source": "opd",
        })
    } else {
        json!({
            "patient_id": patient_id,
            "department_id": ipd_dept_id,
            "admission_source": "opd",
        })
    };

    // POST returns { encounter, admission }
    let adm_resp = json_request(
        user,
        GooseMethod::Post,
        "/api/ipd/admissions",
        Some(&body),
    )
    .await?;
    let Some(admission_id) = adm_resp
        .as_ref()
        .and_then(|v| v.get("admission"))
        .and_then(|v| v.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_owned)
    else {
        return Ok(());
    };

    let _ = json_get(user, &format!("/api/ipd/admissions/{admission_id}")).await?;
    Ok(())
}

// ── Inline helpers (return new resource id without registering as
// their own goose transaction — the underlying request is still
// recorded by goose as `/api/patients` etc.).

async fn create_patient_inline(
    user: &mut GooseUser,
) -> Result<Option<String>, Box<TransactionError>> {
    let id = unique_suffix();
    let body = json!({
        "first_name": format!("Load{}", id % 100_000),
        "last_name": format!("Test{}", id % 100_000),
        "gender": "male",
        "phone": format!("90{:08}", id % 100_000_000),
    });
    let resp = json_request(user, GooseMethod::Post, "/api/patients", Some(&body)).await?;
    Ok(resp
        .and_then(|v| v.get("id").cloned())
        .and_then(|v| v.as_str().map(str::to_owned)))
}

async fn create_encounter_inline(
    user: &mut GooseUser,
    patient_id: &str,
) -> Result<Option<String>, Box<TransactionError>> {
    let opd_dept_id = {
        let session: &Arc<Mutex<Session>> = user.get_session_data_unchecked();
        session.lock().await.opd_dept_id.clone()
    };
    let Some(dept) = opd_dept_id else {
        return Ok(None);
    };
    let resp = json_request(
        user,
        GooseMethod::Post,
        "/api/opd/encounters",
        Some(&json!({
            "patient_id": patient_id,
            "department_id": dept,
            "visit_type": "walk_in",
        })),
    )
    .await?;
    Ok(resp
        .as_ref()
        .and_then(|v| v.get("encounter"))
        .and_then(|v| v.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_owned))
}

//! The pharmacy runs the medication safety checks it records. A pharmacist
//! reviewing a prescription that pairs two seriously interacting medicines is
//! stopped until someone with override rights gives a reason, and the review
//! then records the check it actually ran. An AWaRe Reserve antibiotic is
//! prescribed only with an indication, which raises a stewardship request; the
//! pharmacy approves and dispenses it only while that request is approved.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

async fn send(
    app: &common::TestApp,
    csrf: &str,
    method: &str,
    path: &str,
    body: Value,
) -> (StatusCode, Value) {
    let request = match method {
        "PUT" => app.client.put(app.url(path)),
        "PATCH" => app.client.patch(app.url(path)),
        _ => app.client.post(app.url(path)),
    };
    let resp = request
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("request");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}

fn line(id: Uuid, name: &str) -> Value {
    json!({ "drug_name": name, "catalog_item_id": id, "dosage": "1 tab",
            "frequency": "OD", "duration": "5 days", "route": "oral" })
}

fn queue_id(body: &Value) -> Uuid {
    body["pharmacy_rx_queue_id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("rx queue id")
}

async fn audit_count(app: &common::TestApp, record: Uuid, action: &str) -> i64 {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM cpoe_safety_audit \
          WHERE source_record_id = $1 AND action_taken = $2",
    )
    .bind(record)
    .bind(action)
    .fetch_one(&app.db)
    .await
    .expect("audit count")
}

async fn pending_requests(app: &common::TestApp, patient: Uuid) -> i64 {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM antibiotic_stewardship_requests \
          WHERE patient_id = $1 AND request_status = 'pending' AND deleted_at IS NULL",
    )
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("requests")
}

#[tokio::test]
async fn review_and_dispense_run_interaction_and_stewardship_checks() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let stepped = app
        .client
        .post(app.url("/api/auth/step-up"))
        .header("x-csrf-token", &csrf)
        .json(&json!({ "password": "admin123" }))
        .send()
        .await
        .expect("step-up");
    assert!(
        stepped.status().is_success(),
        "step-up: {}",
        stepped.status()
    );

    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();

    // Three stocked, priced medicines; two of them interact seriously.
    let mut drugs = Vec::new();
    for (brand, generic, aware) in [
        ("Warfrin", "warfarin", None),
        ("Ecosprin", "aspirin", None),
        ("Meronem", "meropenem", Some("reserve")),
    ] {
        let name = format!("{brand}-{tag}");
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO pharmacy_catalog (tenant_id, code, name, generic_name, aware_category, \
                                           base_price, current_stock) \
             VALUES ($1, $2, $3, $4, $5, 10.00, 500) RETURNING id",
        )
        .bind(tenant)
        .bind(format!("RXS-{brand}-{tag}"))
        .bind(&name)
        .bind(format!("{generic}{tag}"))
        .bind(aware)
        .fetch_one(&app.db)
        .await
        .expect("catalog");
        drugs.push((id, name));
    }
    let [
        (warfarin, warfarin_name),
        (aspirin, aspirin_name),
        (mero, mero_name),
    ] = <[(Uuid, String); 3]>::try_from(drugs).expect("three drugs");
    sqlx::query(
        "INSERT INTO drug_interactions (tenant_id, drug_a_name, drug_b_name, severity, description) \
         VALUES ($1, $2, $3, 'major', 'Additive bleeding risk')",
    )
    .bind(tenant)
    .bind(format!("warfarin{tag}"))
    .bind(format!("aspirin{tag}"))
    .execute(&app.db)
    .await
    .expect("interaction");

    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Safety', 'Gate', 'male', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-RXS-{tag}"))
    .bind(format!("8{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let department: Uuid = sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 AND code = 'GEN-MEDICINE'",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (status, visit) = send(
        &app,
        &csrf,
        "POST",
        "/api/opd/encounters",
        json!({ "patient_id": patient, "department_id": department }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    let rx_path = format!(
        "/api/opd/encounters/{}/prescriptions",
        visit["encounter"]["id"].as_str().unwrap_or_default()
    );

    // ── Prescribing a Reserve antibiotic needs an indication ──
    let (status, body) = send(
        &app,
        &csrf,
        "POST",
        &rx_path,
        json!({ "items": [line(mero, &mero_name)] }),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(body.to_string().contains("Reserve"), "{body}");
    let (status, body) = send(
        &app,
        &csrf,
        "POST",
        &rx_path,
        json!({ "items": [line(mero, &mero_name)],
                "stewardship_indication": "CRE bacteraemia on blood culture" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let mero_queue = queue_id(&body);
    let (request, request_status): (Uuid, String) = sqlx::query_as(
        "SELECT id, request_status::text FROM antibiotic_stewardship_requests \
          WHERE patient_id = $1 AND deleted_at IS NULL",
    )
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("the prescription raised one stewardship request");
    assert_eq!(request_status, "pending");

    // ── An interacting pair reaches the pharmacist, who is stopped ──
    let (status, body) = send(
        &app,
        &csrf,
        "POST",
        &rx_path,
        json!({ "items": [line(warfarin, &warfarin_name), line(aspirin, &aspirin_name)],
                "interaction_override_reason": "INR monitored weekly" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let pair_queue = queue_id(&body);

    let detail: Value = app
        .get(&app.client, &format!("/api/pharmacy/rx-queue/{pair_queue}"))
        .await
        .json()
        .await
        .expect("detail");
    let findings = detail["safety"]["findings"].as_array().expect("findings");
    assert!(
        findings
            .iter()
            .any(|f| f["code"] == "DRUG_INTERACTION" && f["severity"] == "block"),
        "the review screen shows the interaction: {detail}"
    );

    let review = format!("/api/pharmacy/rx-queue/{pair_queue}/review");
    let (status, body) = send(&app, &csrf, "PUT", &review, json!({ "action": "approved" })).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    let (state, checked): (String, bool) = sqlx::query_as(
        "SELECT status::text, interaction_check_done FROM pharmacy_prescriptions WHERE id = $1",
    )
    .bind(pair_queue)
    .fetch_one(&app.db)
    .await
    .expect("queue entry");
    assert_eq!((state.as_str(), checked), ("pending_review", false));
    assert!(
        audit_count(&app, pair_queue, "blocked").await > 0,
        "the refusal is audited"
    );

    let (status, body) = send(
        &app,
        &csrf,
        "PUT",
        &review,
        json!({ "action": "approved",
                "safety_override_reason": "Cardiology advised dual therapy; INR weekly" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (checked, result, order): (bool, Value, Uuid) = sqlx::query_as(
        "SELECT interaction_check_done, interaction_check_result, pharmacy_order_id \
           FROM pharmacy_prescriptions WHERE id = $1",
    )
    .bind(pair_queue)
    .fetch_one(&app.db)
    .await
    .expect("reviewed entry");
    assert!(checked);
    assert!(
        result.to_string().contains("DRUG_INTERACTION"),
        "the recorded check is the one that ran: {result}"
    );
    assert_eq!(audit_count(&app, order, "overridden").await, 1);

    // ── The Reserve antibiotic waits for stewardship approval ──
    let review = format!("/api/pharmacy/rx-queue/{mero_queue}/review");
    let (status, body) = send(&app, &csrf, "PUT", &review, json!({ "action": "approved" })).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(body.to_string().contains("awaiting approval"), "{body}");

    let (status, body) = send(
        &app,
        &csrf,
        "PATCH",
        &format!("/api/infection-control/stewardship/{request}"),
        json!({ "request_status": "approved", "review_notes": "ID physician agrees" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let (status, body) = send(&app, &csrf, "PUT", &review, json!({ "action": "approved" })).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let mero_order: Uuid =
        sqlx::query_scalar("SELECT pharmacy_order_id FROM pharmacy_prescriptions WHERE id = $1")
            .bind(mero_queue)
            .fetch_one(&app.db)
            .await
            .expect("order");

    // ── Dispense checks again: a withdrawn approval stops the hand-over ──
    sqlx::query(
        "UPDATE antibiotic_stewardship_requests SET request_status = 'denied' WHERE id = $1",
    )
    .bind(request)
    .execute(&app.db)
    .await
    .expect("withdraw approval");
    let (status, body) = send(
        &app,
        &csrf,
        "PUT",
        &format!("/api/pharmacy/orders/{mero_order}/dispense"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(
        body.to_string()
            .contains("no approved antimicrobial stewardship request"),
        "{body}"
    );
}

/// A pack-and-collect order takes its medicine off the shelf when a picker
/// claims it, so the claim is held by the same gate as a counter dispense.
#[tokio::test]
async fn picking_a_pack_and_collect_order_runs_the_safety_gate() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let admin: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();

    let store: Uuid = sqlx::query_scalar(
        "INSERT INTO store_locations (tenant_id, code, name) VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("PC-{tag}"))
    .bind(format!("Pack and collect {tag}"))
    .fetch_one(&app.db)
    .await
    .expect("store");
    sqlx::query(
        "INSERT INTO pharmacy_store_assignments (tenant_id, store_location_id, fulfilment_mode) \
         VALUES ($1, $2, 'pack_and_collect')",
    )
    .bind(tenant)
    .bind(store)
    .execute(&app.db)
    .await
    .expect("store mode");

    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Pick', 'Gate', 'female', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-PCK-{tag}"))
    .bind(format!("8{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");

    let mut ids = Vec::new();
    for generic in ["clopidogrel", "omeprazole"] {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO pharmacy_catalog (tenant_id, code, name, generic_name, base_price, \
                                           current_stock) \
             VALUES ($1, $2, $3, $4, 5.00, 100) RETURNING id",
        )
        .bind(tenant)
        .bind(format!("PCK-{generic}-{tag}"))
        .bind(format!("{generic}-{tag} tab"))
        .bind(format!("{generic}{tag}"))
        .fetch_one(&app.db)
        .await
        .expect("catalog");
        sqlx::query(
            "INSERT INTO pharmacy_batches (tenant_id, catalog_item_id, batch_number, expiry_date, \
                                           quantity_received, quantity_on_hand, store_location_id) \
             VALUES ($1, $2, $3, CURRENT_DATE + 365, 50, 50, $4)",
        )
        .bind(tenant)
        .bind(id)
        .bind(format!("B-{generic}-{tag}"))
        .bind(store)
        .execute(&app.db)
        .await
        .expect("batch");
        ids.push((id, format!("{generic}-{tag} tab")));
    }
    sqlx::query(
        "INSERT INTO drug_interactions (tenant_id, drug_a_name, drug_b_name, severity, description) \
         VALUES ($1, $2, $3, 'contraindicated', 'Loss of antiplatelet effect')",
    )
    .bind(tenant)
    .bind(format!("clopidogrel{tag}"))
    .bind(format!("omeprazole{tag}"))
    .execute(&app.db)
    .await
    .expect("interaction");

    // The patient already has clopidogrel; omeprazole is now waiting to be picked.
    let mut orders = Vec::new();
    for (status, (drug, name)) in [("dispensed", &ids[0]), ("ordered", &ids[1])] {
        let order: Uuid = sqlx::query_scalar(
            "INSERT INTO pharmacy_orders (tenant_id, patient_id, ordered_by, status, \
                                          store_location_id) \
             VALUES ($1, $2, $3, $4, $5) RETURNING id",
        )
        .bind(tenant)
        .bind(patient)
        .bind(admin)
        .bind(status)
        .bind(store)
        .fetch_one(&app.db)
        .await
        .expect("order");
        sqlx::query(
            "INSERT INTO pharmacy_order_items (tenant_id, order_id, catalog_item_id, drug_name, \
                                               quantity, unit_price, total_price) \
             VALUES ($1, $2, $3, $4, 2, 5.00, 10.00)",
        )
        .bind(tenant)
        .bind(order)
        .bind(drug)
        .bind(name)
        .execute(&app.db)
        .await
        .expect("line");
        orders.push(order);
    }
    let pick = orders[1];
    let claim = format!("/api/pharmacy/fulfilment/{pick}/claim");

    let (status, body) = send(&app, &csrf, "POST", &claim, json!({})).await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    assert!(body.to_string().contains("contraindicated"), "{body}");
    let still: String = sqlx::query_scalar("SELECT status FROM pharmacy_orders WHERE id = $1")
        .bind(pick)
        .fetch_one(&app.db)
        .await
        .expect("status");
    assert_eq!(still, "ordered", "nothing left the shelf");
    assert!(
        audit_count(&app, pick, "blocked").await > 0,
        "the refusal is audited"
    );

    let (status, body) = send(
        &app,
        &csrf,
        "POST",
        &claim,
        json!({ "safety_override_reason": "Prescriber switched to pantoprazole tomorrow" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(audit_count(&app, pick, "overridden").await, 1);
}

/// The CPOE order basket prescribes under the same stewardship rule as OPD:
/// a Reserve antibiotic signed without an indication is refused, and with one
/// it raises a pending stewardship request, filed to audit.
#[tokio::test]
async fn basket_reserve_antibiotic_needs_an_indication_and_raises_a_request() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = Uuid::new_v4().simple().to_string()[..8].to_owned();

    let drug_name = format!("Colistin-{tag} 1MIU");
    let drug: Uuid = sqlx::query_scalar(
        "INSERT INTO pharmacy_catalog (tenant_id, code, name, generic_name, aware_category, \
                                       base_price, current_stock) \
         VALUES ($1, $2, $3, $4, 'reserve', 50.00, 500) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("BSK-COL-{tag}"))
    .bind(&drug_name)
    .bind(format!("colistin{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("catalog");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Basket', 'Gate', 'female', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-BSK-{tag}"))
    .bind(format!("8{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let department: Uuid = sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 AND code = 'GEN-MEDICINE'",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("department");
    let (status, visit) = send(
        &app,
        &csrf,
        "POST",
        "/api/opd/encounters",
        json!({ "patient_id": patient, "department_id": department }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{visit}");
    let encounter = visit["encounter"]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();

    let sign = |indication: Option<&str>| {
        json!({
            "encounter_id": encounter,
            "patient_id": patient,
            "items": [{
                "kind": "drug", "drug_id": drug, "drug_name": drug_name,
                "dose": "4.5 MIU", "frequency": "BD", "route": "IV", "duration_days": 7,
                "indication": indication, "is_prn": false, "instructions": null,
                "quantity": 14, "unit_price": "50.00", "schedule_x_serial": null
            }],
        })
    };

    let (status, body) = send(&app, &csrf, "POST", "/api/orders/basket/sign", sign(None)).await;
    assert!(
        status.is_client_error(),
        "refused without an indication: {status} {body}"
    );
    assert!(body.to_string().contains("Reserve"), "{body}");
    assert_eq!(
        pending_requests(&app, patient).await,
        0,
        "a refused basket raises nothing"
    );

    let (status, body) = send(
        &app,
        &csrf,
        "POST",
        "/api/orders/basket/sign",
        sign(Some("Carbapenem-resistant Acinetobacter on blood culture")),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(
        pending_requests(&app, patient).await,
        1,
        "the indication raised one stewardship request"
    );
    let prescription: Uuid = body["created"][0]["order_id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("created prescription");
    let audited: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_log \
          WHERE entity_id = $1 AND action = 'prescription.stewardship_requested'",
    )
    .bind(prescription)
    .fetch_one(&app.db)
    .await
    .expect("audit");
    assert_eq!(audited, 1, "the request is filed against the prescription");
}

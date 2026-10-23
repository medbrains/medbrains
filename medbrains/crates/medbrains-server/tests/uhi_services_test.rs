//! UHI provider (HSPA): the search filters and the newer services. A
//! speciality narrows the doctors offered; a hospital holiday removes its
//! slots; a visit at the hospital books an OPD appointment with no video;
//! a lab test is found with its price, requested, and becomes a real lab
//! order only when the lab accepts it — and each answer needs its
//! permissions.

use crate::common;
use crate::uhi_world;

use axum::http::StatusCode;
use chrono::{Duration, Utc};
use medbrains_server::routes::uhi::protocol::{CONSULTATION_DOMAIN, LAB_DOMAIN};
use serde_json::{Value, json};
use uhi_world::{World, doctor, world};
use uuid::Uuid;

use uhi_world::SERIAL;

fn txn() -> String {
    Uuid::new_v4().to_string()
}

fn tomorrow() -> chrono::NaiveDate {
    (Utc::now() + Duration::days(1)).date_naive()
}

/// Search tomorrow's consultations with `intent` merged in; the slots
/// answered, or none when nothing was answered at all.
async fn search(w: &World, kind: &str, intent: Value) -> Vec<Value> {
    let day = tomorrow();
    let id = txn();
    let mut body = json!({ "fulfillment": { "type": kind,
        "start": { "time": { "timestamp": format!("{day}T00:00:00") } },
        "end": { "time": { "timestamp": format!("{day}T23:59:59") } } } });
    if let (Some(base), Some(more)) = (body.as_object_mut(), intent.as_object()) {
        for (k, v) in more {
            if k == "fulfillment" {
                if let (Some(f), Some(extra)) = (base["fulfillment"].as_object_mut(), v.as_object())
                {
                    f.extend(extra.clone());
                }
            } else {
                base.insert(k.clone(), v.clone());
            }
        }
    }
    let message = w.message(
        CONSULTATION_DOMAIN,
        "search",
        &id,
        json!({ "intent": body }),
    );
    w.call("search", &message).await;
    if w.outbox_count(&id).await == 0 {
        return Vec::new();
    }
    let on_search = w.deliver(&id, "on_search").await;
    on_search.body["message"]["catalog"]["providers"][0]["fulfillments"]
        .as_array()
        .cloned()
        .unwrap_or_default()
}

fn doctors(slots: &[Value]) -> std::collections::HashSet<String> {
    slots
        .iter()
        .filter_map(|s| s["agent"]["name"].as_str().map(str::to_owned))
        .collect()
}

/// Given two doctors in different departments, When the app searches by
/// one department's name (as a category, or as the doctor's speciality
/// tag), Then only that department's doctor is offered; an unknown
/// speciality gets no answer.
#[tokio::test]
async fn the_speciality_filter_narrows_the_doctors() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (cardio, cardio_name) = doctor(&w).await;
    let (_, other_name) = doctor(&w).await;
    let (department, _) = w.department_of(cardio).await;
    let speciality = format!("Cardiology {}", &txn()[..6]);
    sqlx::query("UPDATE departments SET name = $2 WHERE id = $1")
        .bind(department)
        .bind(&speciality)
        .execute(&w.app.db)
        .await
        .expect("rename");

    let by_category = search(
        &w,
        "Online",
        json!({ "category": { "descriptor": { "name": speciality.to_uppercase() } } }),
    )
    .await;
    let found = doctors(&by_category);
    assert!(found.contains(&cardio_name), "{found:?}");
    assert!(!found.contains(&other_name), "{found:?}");

    let by_tag = search(
        &w,
        "Online",
        json!({ "fulfillment": { "agent": { "tags": { "@abdm/gov.in/speciality": speciality } } } }),
    )
    .await;
    assert_eq!(doctors(&by_tag), found);

    let none = search(
        &w,
        "Online",
        json!({ "category": { "descriptor": { "name": "No such speciality" } } }),
    )
    .await;
    assert!(none.is_empty());
}

/// Given tomorrow is a hospital holiday, Then a doctor's slots that day are
/// not offered — unless the doctor is marked available that day.
#[tokio::test]
async fn a_hospital_holiday_removes_its_slots() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (doctor_id, name) = doctor(&w).await;
    let mine = json!({ "fulfillment": { "agent": { "name": name } } });
    assert_eq!(search(&w, "Online", mine.clone()).await.len(), 8);
    w.set_setting(
        "operations",
        "holidays",
        json!([{ "date": tomorrow().to_string(), "name": "UHI test holiday" }]),
    )
    .await;
    let on_holiday = search(&w, "Online", mine.clone()).await;
    sqlx::query(
        "INSERT INTO doctor_schedule_exceptions (tenant_id, doctor_id, exception_date, \
            is_available, reason) VALUES ($1, $2, $3, true, 'On call for the holiday')",
    )
    .bind(w.tenant)
    .bind(doctor_id)
    .bind(tomorrow())
    .execute(&w.app.db)
    .await
    .expect("exception");
    let on_call = search(&w, "Online", mine).await;
    w.clear_setting("operations", "holidays").await;
    assert!(on_holiday.is_empty(), "{on_holiday:?}");
    assert_eq!(
        on_call.len(),
        8,
        "a doctor marked available still sees patients"
    );
}

/// When a patient app books a visit at the hospital, Then it is an OPD
/// appointment like any other, with no video session, paid at the desk.
#[tokio::test]
async fn a_physical_consultation_books_an_opd_visit_without_video() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (_, name) = doctor(&w).await;
    let slots = search(
        &w,
        "Physical",
        json!({ "fulfillment": { "agent": { "name": name } } }),
    )
    .await;
    assert_eq!(slots[0]["type"], "Physical");
    let slot = slots[0]["id"].clone();
    let id = txn();
    // The app echoes the fulfilment it was offered, type included.
    let order = json!({ "order": { "items": [{ "id": slot }],
        "fulfillment": { "id": slot, "type": "Physical" },
        "billing": { "name": "Kiran Das", "phone": "9876500055" } } });
    w.call(
        "confirm",
        &w.message(CONSULTATION_DOMAIN, "confirm", &id, order),
    )
    .await;
    let on_confirm = w.deliver(&id, "on_confirm").await;
    let confirmed = &on_confirm.body["message"]["order"];
    assert_eq!(confirmed["state"], "CONFIRMED", "{confirmed}");
    assert_eq!(confirmed["fulfillment"]["type"], "Physical");
    assert!(
        confirmed["fulfillment"].get("tags").is_none(),
        "no video link"
    );
    assert_eq!(confirmed["payment"]["type"], "ON-FULFILLMENT");
    let (status, source, videos): (String, String, i64) = sqlx::query_as(
        "SELECT a.status::text, a.booking_source, \
                (SELECT count(*) FROM tele_consultations t WHERE t.appointment_id = a.id) \
           FROM uhi_transactions u JOIN appointments a ON a.id = u.appointment_id \
          WHERE u.transaction_id = $1 AND u.service = 'physical_consultation'",
    )
    .bind(&id)
    .fetch_one(&w.app.db)
    .await
    .expect("an OPD appointment");
    assert_eq!(
        (status.as_str(), source.as_str(), videos),
        ("confirmed", "uhi", 0)
    );
}

async fn lab_test(w: &World, name: &str, orderable: bool) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO lab_test_catalog (tenant_id, code, name, price, is_patient_orderable) \
         VALUES ($1, $2, $3, 350, $4) RETURNING id",
    )
    .bind(w.tenant)
    .bind(format!("UHI-{}", &txn()[..8]))
    .bind(name)
    .bind(orderable)
    .fetch_one(&w.app.db)
    .await
    .expect("lab test")
}

async fn accept(staff: &common::Staff, w: &World, request: &str) -> reqwest::Response {
    staff
        .client
        .post(w.app.url(&format!("/api/uhi/requests/{request}/accept")))
        .header("x-csrf-token", &staff.csrf)
        .send()
        .await
        .expect("accept")
}

/// Given one test the lab lets patients book and one it does not, When a
/// patient app searches, Then only the first is offered, at its price;
/// When the app asks for a home collection, Then it waits as a request and
/// no lab order exists; staff without walk-in ordering, or without sample
/// management for a home visit, are refused; When the lab accepts, Then
/// the lab order and the home collection exist and the app is told.
#[tokio::test]
async fn a_lab_test_is_found_priced_and_ordered_only_when_the_lab_accepts() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let tag = &txn()[..6];
    let test = lab_test(&w, &format!("Uhi CBC {tag}"), true).await;
    lab_test(&w, &format!("Uhi Restricted {tag}"), false).await;
    let id = txn();
    let search = w.message(
        LAB_DOMAIN,
        "search",
        &id,
        json!({ "intent": { "item": { "descriptor": { "name": tag } } } }),
    );
    w.call("search", &search).await;
    let items =
        w.deliver(&id, "on_search").await.body["message"]["catalog"]["providers"][0]["items"]
            .clone();
    let items = items.as_array().expect("items");
    assert_eq!(items.len(), 1, "only what patients may book: {items:?}");
    assert_eq!(items[0]["id"], test.to_string());
    assert_eq!(items[0]["price"]["value"], "350.00");

    let address = format!("{tag} MG Road, Bengaluru");
    let order = json!({ "order": { "items": [{ "id": test }],
        "fulfillment": { "type": "HomeCollection", "start": {
            "location": { "address": address },
            "time": { "timestamp": format!("{}T08:00:00", tomorrow()) } } },
        "billing": { "name": "Lata Menon", "phone": "9876500066" } } });
    w.call("confirm", &w.message(LAB_DOMAIN, "confirm", &id, order))
        .await;
    let on_confirm = w.deliver(&id, "on_confirm").await;
    assert_eq!(on_confirm.body["message"]["order"]["state"], "PENDING");
    assert_eq!(
        on_confirm.body["message"]["order"]["quote"]["price"]["value"],
        "350.00"
    );
    let orders = || {
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM lab_orders WHERE test_id = $1")
            .bind(test)
            .fetch_one(&w.app.db)
    };
    assert_eq!(
        orders().await.expect("count"),
        0,
        "nothing clinical before the lab accepts"
    );
    let request = w.row(&id).await.to_string();

    let driver = common::provision_staff(&w.app, &w.csrf, "ambulance_driver", &[]).await;
    assert_eq!(
        accept(&driver, &w, &request).await.status(),
        StatusCode::FORBIDDEN
    );
    let no_samples =
        common::provision_staff(&w.app, &w.csrf, "lab_technician", &["lab.samples.manage"]).await;
    assert_eq!(
        accept(&no_samples, &w, &request).await.status(),
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        orders().await.expect("count"),
        0,
        "a refusal changes nothing"
    );

    let lab = common::provision_staff(&w.app, &w.csrf, "lab_technician", &[]).await;
    let queue: Value = lab
        .client
        .get(w.app.url("/api/uhi/requests?state=pending"))
        .send()
        .await
        .expect("queue")
        .json()
        .await
        .expect("json");
    let row = queue
        .as_array()
        .expect("rows")
        .iter()
        .find(|r| r["id"] == request.as_str())
        .expect("the lab sees the request")
        .clone();
    assert_eq!(row["home_collection"], true);
    let accepted: Value = accept(&lab, &w, &request).await.json().await.expect("json");
    assert_eq!(accepted["state"], "confirmed", "{accepted}");
    assert_eq!(accepted["lab_order_ids"].as_array().map(Vec::len), Some(1));
    let collected_at: String = sqlx::query_scalar(
        "SELECT h.address_line FROM lab_home_collections h JOIN lab_orders o ON o.id = h.order_id \
          WHERE o.test_id = $1",
    )
    .bind(test)
    .fetch_one(&w.app.db)
    .await
    .expect("the home collection is booked");
    assert_eq!(collected_at, address);
    let on_status = w.deliver(&id, "on_status").await;
    assert_eq!(on_status.body["message"]["order"]["state"], "CONFIRMED");
}

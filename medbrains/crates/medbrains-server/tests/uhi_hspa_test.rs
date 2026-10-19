//! UHI provider side (HSPA) against a stand-in patient app and gateway, so
//! the whole flow is proven before NHA registers the hospital: a call that
//! is not signed by a registered key is refused with a NACK; a
//! teleconsultation search answers from real schedules and a confirm books
//! a real appointment exactly once; an ambulance request waits for staff
//! and their answer reaches the app; blood search tells counts, never
//! donors; each staff screen needs its permission.

mod common;
mod uhi_world;

use axum::http::StatusCode;
use chrono::{Duration, Utc};
use medbrains_server::routes::uhi::protocol::{
    AMBULANCE_DOMAIN, BLOOD_BANK_DOMAIN, CONSULTATION_DOMAIN,
};
use serde_json::{Value, json};
use uhi_world::{doctor, world};
use uuid::Uuid;

/// Every test sets up UHI for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn txn() -> String {
    Uuid::new_v4().to_string()
}

/// Given a call signed with a key the registry does not hold, or not signed
/// at all, Then it is refused 401 with a UHI NACK and nothing is queued.
#[tokio::test]
async fn a_call_that_is_not_signed_by_a_registered_key_is_refused() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let id = txn();
    let search = w.message(CONSULTATION_DOMAIN, "search", &id, json!({ "intent": {} }));
    let forger = medbrains_crypto::beckn::generate();
    let (status, nack) = w.send("search", &search, Some(&forger), false).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(nack["message"]["ack"]["status"], "NACK");
    assert_eq!(nack["error"]["code"], "UHI-1405");
    let (status, nack) = w.send("search", &search, None, false).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(nack["error"]["code"], "UHI-1401");
    // Signed by the app, but the body says someone else sent it.
    let mut other = search.clone();
    other["context"]["consumer_id"] = json!("someone.else");
    let (status, _) = w.send("search", &other, Some(&w.eua), false).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(
        w.outbox_count(&id).await,
        0,
        "a refused call is never answered"
    );
}

/// Given a doctor with an HPR ID and a weekly schedule, When a patient app
/// searches for them through the gateway, Then the gateway gets a signed
/// on_search with tomorrow's open slots; When the app confirms one, Then a
/// real appointment and video session are booked and on_confirm carries the
/// link; a repeated confirm books nothing more.
#[tokio::test]
async fn a_teleconsultation_is_found_and_booked_once() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (doctor_id, name) = doctor(&w).await;
    let day = (Utc::now() + Duration::days(1)).date_naive();
    let id = txn();
    let search = w.message(
        CONSULTATION_DOMAIN,
        "search",
        &id,
        json!({ "intent": { "fulfillment": {
        "type": "Online", "agent": { "name": name },
        "start": { "time": { "timestamp": format!("{day}T00:00:00") } },
        "end": { "time": { "timestamp": format!("{day}T23:59:59") } } } } }),
    );
    let (status, _) = w.send("search", &search, Some(&w.eua), true).await;
    assert_eq!(status, StatusCode::OK);
    let on_search = w.deliver(&id, "on_search").await;
    assert_eq!(
        on_search.path, "/on_search",
        "a gateway search is answered to the gateway"
    );
    let provider = &on_search.body["message"]["catalog"]["providers"][0];
    let slots = provider["fulfillments"].as_array().expect("slots");
    assert_eq!(slots.len(), 8, "09:00–13:00 in 30-minute slots: {slots:?}");
    assert_eq!(slots[0]["agent"]["name"], name.as_str());
    assert!(slots[0]["agent"]["tags"]["@abdm/gov.in/hpr_id"].is_string());
    assert_eq!(
        slots[0]["start"]["time"]["timestamp"],
        format!("{day}T09:00:00")
    );
    let slot = slots[0]["id"].as_str().expect("slot id").to_owned();

    let select = w.message(
        CONSULTATION_DOMAIN,
        "select",
        &id,
        json!({ "order": { "items": [{ "id": slot }] } }),
    );
    w.call("select", &select).await;
    let on_select = w.deliver(&id, "on_select").await;
    assert_eq!(
        on_select.path, "/eua/on_select",
        "everything else goes to the app"
    );
    assert_eq!(
        on_select.body["message"]["order"]["quote"]["price"]["currency"],
        "INR"
    );

    let order = json!({ "order": { "items": [{ "id": slot }], "fulfillment": { "id": slot },
        "customer": { "id": "ravi.k@sbx" },
        "billing": { "name": "Ravi Kumar", "phone": "9876500011" } } });
    w.call(
        "confirm",
        &w.message(CONSULTATION_DOMAIN, "confirm", &id, order.clone()),
    )
    .await;
    let on_confirm = w.deliver(&id, "on_confirm").await;
    let confirmed = &on_confirm.body["message"]["order"];
    assert_eq!(confirmed["state"], "CONFIRMED", "{confirmed}");
    let link = confirmed["fulfillment"]["tags"]["@abdm/gov.in/teleconf_url"]
        .as_str()
        .expect("link");
    assert!(link.contains("medbrains-"), "{link}");

    let (appointment, source): (Uuid, String) = sqlx::query_as(
        "SELECT a.id, a.booking_source FROM uhi_transactions u \
           JOIN appointments a ON a.id = u.appointment_id \
           JOIN tele_consultations t ON t.id = u.tele_consultation_id AND t.appointment_id = a.id \
          WHERE u.transaction_id = $1 AND u.state = 'confirmed'",
    )
    .bind(&id)
    .fetch_one(&w.app.db)
    .await
    .expect("a real appointment with its video session");
    assert_eq!(source, "uhi");

    // The app retries the confirm (a lost ACK): the same booking, no second one.
    w.call(
        "confirm",
        &w.message(CONSULTATION_DOMAIN, "confirm", &id, order),
    )
    .await;
    let again = w.deliver(&id, "on_confirm").await;
    assert_eq!(again.body["message"]["order"]["id"], confirmed["id"]);
    let booked: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 \
            AND status <> 'cancelled'",
    )
    .bind(doctor_id)
    .bind(day)
    .fetch_one(&w.app.db)
    .await
    .expect("count");
    assert_eq!(booked, 1);

    // The booking is in the hospital's own appointment list.
    let listed = w
        .app
        .client
        .get(w.app.url(&format!(
            "/api/opd/appointments?doctor_id={doctor_id}&date={day}"
        )))
        .send()
        .await
        .expect("list")
        .text()
        .await
        .expect("text");
    assert!(listed.contains(&appointment.to_string()), "{listed}");
}

/// Given an available ALS ambulance, When a patient app searches and
/// confirms with a pickup address, Then on_confirm says PENDING and the
/// request waits on the UHI requests screen; When a dispatcher accepts,
/// Then the ambulance module has the trip and the app gets on_status
/// CONFIRMED; it cannot be answered twice.
#[tokio::test]
async fn an_ambulance_request_waits_for_dispatch_and_the_answer_reaches_the_app() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    sqlx::query(
        "INSERT INTO ambulances (tenant_id, vehicle_number, ambulance_code, ambulance_type) \
         VALUES ($1, $2, $2, 'als')",
    )
    .bind(w.tenant)
    .bind(format!("KA01-{}", &txn()[..6]))
    .execute(&w.app.db)
    .await
    .expect("ambulance");
    let id = txn();
    w.call(
        "search",
        &w.message(AMBULANCE_DOMAIN, "search", &id, json!({ "intent": {} })),
    )
    .await;
    let on_search = w.deliver(&id, "on_search").await;
    let items = on_search.body["message"]["catalog"]["providers"][0]["items"].to_string();
    assert!(items.contains("\"als\""), "{items}");
    assert!(!items.contains("mortuary"));

    let order = json!({ "order": { "items": [{ "id": "als" }],
        "fulfillment": { "start": { "location": { "address": "12 MG Road, Bengaluru" } } },
        "billing": { "name": "Asha Rao", "phone": "9876500022" } } });
    w.call(
        "confirm",
        &w.message(AMBULANCE_DOMAIN, "confirm", &id, order),
    )
    .await;
    let on_confirm = w.deliver(&id, "on_confirm").await;
    assert_eq!(on_confirm.body["message"]["order"]["state"], "PENDING");

    let queue: Value = w
        .app
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
        .find(|r| r["customer_phone"] == "9876500022")
        .expect("the request is queued")
        .clone();
    assert_eq!(row["summary"], "Pickup: 12 MG Road, Bengaluru");

    let dispatcher = common::provision_staff(&w.app, &w.csrf, "ambulance_driver", &[]).await;
    let accept = |client: &reqwest::Client, csrf: &str| {
        client
            .post(w.app.url(&format!(
                "/api/uhi/requests/{}/accept",
                row["id"].as_str().unwrap_or("")
            )))
            .header("x-csrf-token", csrf.to_owned())
            .send()
    };
    let accepted: Value = accept(&dispatcher.client, &dispatcher.csrf)
        .await
        .expect("accept")
        .json()
        .await
        .expect("json");
    assert_eq!(accepted["state"], "confirmed", "{accepted}");
    let trip: (String, String) =
        sqlx::query_as("SELECT status::text, pickup_address FROM ambulance_trips WHERE id = $1")
            .bind(
                Uuid::parse_str(accepted["ambulance_trip_id"].as_str().expect("trip"))
                    .expect("uuid"),
            )
            .fetch_one(&w.app.db)
            .await
            .expect("trip");
    assert_eq!(
        trip,
        ("requested".to_owned(), "12 MG Road, Bengaluru".to_owned())
    );
    let on_status = w.deliver(&id, "on_status").await;
    assert_eq!(on_status.path, "/eua/on_status");
    assert_eq!(on_status.body["message"]["order"]["state"], "CONFIRMED");
    let twice = accept(&dispatcher.client, &dispatcher.csrf)
        .await
        .expect("again");
    assert_eq!(twice.status(), reqwest::StatusCode::CONFLICT);
}

/// Given released, in-date blood units, When a patient app searches the
/// blood bank, Then it gets counts by group and component — never a bag
/// number or a donor.
#[tokio::test]
async fn blood_search_tells_counts_never_donors() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let bag = format!("BAG-{}", &txn()[..8]);
    sqlx::query(
        "WITH d AS (INSERT INTO blood_donors (tenant_id, donor_number, first_name, last_name, \
                      blood_group) VALUES ($1, $2, 'Secret', 'Donor', 'o_negative') RETURNING id), \
              n AS (INSERT INTO blood_donations (tenant_id, donor_id, bag_number, volume_ml) \
                      SELECT $1, id, $2, 450 FROM d RETURNING id) \
         INSERT INTO blood_components (tenant_id, donation_id, component_type, bag_number, \
                blood_group, volume_ml, status, expiry_at) \
         SELECT $1, id, 'prbc', $2, 'o_negative', 250, 'available', now() + interval '20 days' FROM n",
    )
    .bind(w.tenant)
    .bind(&bag)
    .execute(&w.app.db)
    .await
    .expect("blood unit");
    let id = txn();
    let search = w.message(
        BLOOD_BANK_DOMAIN,
        "search",
        &id,
        json!({ "intent": { "item": { "descriptor": { "name": "O-Ve" } } } }),
    );
    w.call("search", &search).await;
    let on_search = w.deliver(&id, "on_search").await;
    let items = on_search.body["message"]["catalog"]["providers"][0]["items"].clone();
    let items = items.as_array().expect("items");
    assert!(
        items.iter().all(|i| i["descriptor"]["name"] == "O-Ve"),
        "filtered to the group asked"
    );
    assert!(
        items
            .iter()
            .any(|i| i["id"] == "prbc:o_negative" && i["quantity"]["count"].as_i64() >= Some(1))
    );
    let text = on_search.body.to_string();
    assert!(
        !text.contains(&bag) && !text.contains("Secret"),
        "no bag number, no donor"
    );
}

/// Each screen needs its permission: the desk sees the queue but cannot
/// answer it; the blood bank cannot accept an ambulance; a lab technician
/// sees nothing; only an administrator opens Settings → UHI.
#[tokio::test]
async fn the_uhi_screens_need_their_permissions() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let id = txn();
    let order = json!({ "order": {
        "fulfillment": { "start": { "location": { "address": "Gate 2" } } },
        "billing": { "name": "Perm Test", "phone": "9876500033" } } });
    w.call(
        "confirm",
        &w.message(AMBULANCE_DOMAIN, "confirm", &id, order),
    )
    .await;
    let request: Uuid =
        sqlx::query_scalar("SELECT id FROM uhi_transactions WHERE transaction_id = $1")
            .bind(&id)
            .fetch_one(&w.app.db)
            .await
            .expect("request");
    let accept = format!("/api/uhi/requests/{request}/accept");

    let desk = common::provision_staff(&w.app, &w.csrf, "receptionist", &[]).await;
    let status = |r: reqwest::Response| r.status();
    assert_eq!(
        status(
            desk.client
                .get(w.app.url("/api/uhi/requests"))
                .send()
                .await
                .expect("list")
        ),
        reqwest::StatusCode::OK
    );
    assert_eq!(
        status(
            desk.client
                .post(w.app.url(&accept))
                .header("x-csrf-token", &desk.csrf)
                .send()
                .await
                .expect("accept")
        ),
        reqwest::StatusCode::FORBIDDEN
    );
    assert_eq!(
        status(
            desk.client
                .get(w.app.url("/api/uhi/settings"))
                .send()
                .await
                .expect("settings")
        ),
        reqwest::StatusCode::FORBIDDEN
    );

    let bank = common::provision_staff(&w.app, &w.csrf, "blood_bank_tech", &[]).await;
    assert_eq!(
        status(
            bank.client
                .post(w.app.url(&accept))
                .header("x-csrf-token", &bank.csrf)
                .send()
                .await
                .expect("accept")
        ),
        reqwest::StatusCode::FORBIDDEN,
        "accepting an ambulance needs ambulance.trips.create"
    );

    let lab = common::provision_staff(&w.app, &w.csrf, "lab_technician", &[]).await;
    assert_eq!(
        status(
            lab.client
                .get(w.app.url("/api/uhi/requests"))
                .send()
                .await
                .expect("list")
        ),
        reqwest::StatusCode::FORBIDDEN
    );
    let pending: String = sqlx::query_scalar("SELECT state FROM uhi_transactions WHERE id = $1")
        .bind(request)
        .fetch_one(&w.app.db)
        .await
        .expect("state");
    assert_eq!(pending, "pending", "a refused answer changes nothing");
}

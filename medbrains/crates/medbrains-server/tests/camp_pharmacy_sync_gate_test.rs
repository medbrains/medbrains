//! A camp's offline work, synced later, is held to the hospital's rules.
//!
//! The doctor's own prescription is signed at sync through the signing path
//! when the sync carries a fresh step-up; one naming another doctor is not.
//! A pharmacist with the built-in role syncs the dispenses: Schedule X, NDPS
//! and controlled lines, and lines with no catalogue item, are refused and
//! named, and nothing leaves the shelf. A Schedule H dispense that already
//! happened and fails the gate is posted, filed as `CAMP_DISPENSE_EXCEPTION`,
//! and listed under the pharmacy's camp exceptions; one the signed
//! prescription covers is applied clean.

use crate::{
    dispense_world::{self, Signed, staff},
    signatures_test::issue_default_credential,
};

use serde_json::{Value, json};
use uuid::Uuid;

/// The admin's camp, created through the API.
async fn camp(d: &dispense_world::Desk) -> Uuid {
    let camp: Value = d
        .app
        .client
        .post(d.app.url("/api/camp/camps"))
        .header("x-csrf-token", &d.admin_csrf)
        .json(&json!({
            "name": format!("Sync gate camp {}", dispense_world::tag()),
            "camp_type": "general_health",
            "scheduled_date": "2026-11-09",
        }))
        .send()
        .await
        .expect("create camp")
        .json()
        .await
        .expect("camp json");
    Uuid::parse_str(camp["id"].as_str().expect("camp id")).expect("uuid")
}

/// The camp visit the registration desk opens for `doctor`: a registration
/// for the desk's patient, then `open-encounter`, which makes the doctor the
/// visit's attending physician, as on the day.
async fn camp_visit(d: &dispense_world::Desk, camp: Uuid, doctor: Uuid) -> Uuid {
    let registration: Uuid = sqlx::query_scalar(
        "INSERT INTO camp_registrations (tenant_id, camp_id, registration_number, person_name, \
                                         patient_id) \
         VALUES ($1, $2, $3, 'Desk Patient', $4) RETURNING id",
    )
    .bind(d.tenant)
    .bind(camp)
    .bind(format!("REG-{}", dispense_world::tag()))
    .bind(d.patient)
    .fetch_one(&d.app.db)
    .await
    .expect("registration");
    let opened: Value = d
        .app
        .client
        .post(d.app.url(&format!(
            "/api/camp/registrations/{registration}/open-encounter"
        )))
        .header("x-csrf-token", &d.admin_csrf)
        .json(&json!({ "department_id": d.department, "doctor_id": doctor }))
        .send()
        .await
        .expect("open encounter")
        .json()
        .await
        .expect("encounter json");
    Uuid::parse_str(
        opened["encounter_id"]
            .as_str()
            .unwrap_or_else(|| panic!("{opened}")),
    )
    .expect("uuid")
}

/// A synced prescription on `visit` for one Schedule H drug, 1 tab BD for
/// 5 days (10), naming `doctor` when given.
fn prescription_event(
    d: &dispense_world::Desk,
    visit: Uuid,
    doctor: Option<Uuid>,
    drug: Uuid,
) -> Value {
    json!({
        "idempotency_key": format!("rx-{}", Uuid::new_v4()),
        "event_type": "camp.prescription.create",
        "client_entity_id": Uuid::new_v4(),
        "payload": {
            "patient_id": d.patient,
            "encounter_id": visit,
            "doctor_id": doctor,
            "items": [{
                "drug_name": "Camp H drug", "dosage": "1 tab", "frequency": "BD",
                "duration": "5 days", "catalog_item_id": drug,
            }],
        },
    })
}

/// A synced dispense of `items` (drug or free text, quantity) to the patient.
fn dispense_event(
    d: &dispense_world::Desk,
    rx: Option<Uuid>,
    items: &[(Option<Uuid>, i32)],
) -> Value {
    json!({
        "idempotency_key": format!("dx-{}", Uuid::new_v4()),
        "event_type": "camp.pharmacy.dispense",
        "client_entity_id": Uuid::new_v4(),
        "payload": {
            "patient_id": d.patient,
            "encounter_id": d.encounter,
            "prescription_id": rx,
            "items": items.iter().map(|(drug, quantity)| json!({
                "catalog_item_id": drug,
                "drug_name": drug.map_or("Free text tonic".to_owned(), |id| format!("Line {id}")),
                "quantity": quantity,
                "unit_price": "10.00",
            })).collect::<Vec<_>>(),
        },
    })
}

/// One synced event's outcome.
#[derive(Debug)]
struct Synced {
    status: String,
    message: String,
    entities: Value,
}

/// `who` sends the events in order.
async fn sync(
    d: &dispense_world::Desk,
    who: &Signed,
    camp: Uuid,
    events: Vec<Value>,
) -> Vec<Synced> {
    let synced: Value = who
        .client
        .post(d.app.url("/api/camp/sync/inbound"))
        .header("x-csrf-token", &who.csrf)
        .json(&json!({ "camp_id": camp, "device_id": "sync-gate-tablet", "events": events }))
        .send()
        .await
        .expect("sync")
        .json()
        .await
        .expect("sync json");
    synced["results"]
        .as_array()
        .unwrap_or_else(|| panic!("results: {synced}"))
        .iter()
        .map(|r| Synced {
            status: r["status"].as_str().unwrap_or_default().to_owned(),
            message: r["message"].as_str().unwrap_or_default().to_owned(),
            entities: r["server_entities"].clone(),
        })
        .collect()
}

/// The id a synced event created, by its key in `server_entities`.
fn created(s: &Synced, key: &str) -> Uuid {
    Uuid::parse_str(
        s.entities[key]
            .as_str()
            .unwrap_or_else(|| panic!("{key}: {s:?}")),
    )
    .expect("uuid")
}

/// What the catalogue holds of a drug.
async fn stock(d: &dispense_world::Desk, drug: Uuid) -> i32 {
    sqlx::query_scalar("SELECT current_stock FROM pharmacy_catalog WHERE id = $1")
        .bind(drug)
        .fetch_one(&d.app.db)
        .await
        .expect("stock")
}

/// Whether the prescription is signed, and by a `signed_records` row.
async fn signed(d: &dispense_world::Desk, rx: Uuid) -> (bool, bool) {
    sqlx::query_as(
        "SELECT p.is_signed, EXISTS (SELECT 1 FROM signed_records s \
                                      WHERE s.id = p.signed_record_id \
                                        AND s.record_type = 'prescription' \
                                        AND s.record_id = p.id) \
           FROM prescriptions p WHERE p.id = $1",
    )
    .bind(rx)
    .fetch_one(&d.app.db)
    .await
    .expect("signed")
}

/// The orders the pharmacy's camp exceptions list shows.
async fn camp_exceptions(d: &dispense_world::Desk) -> Vec<Uuid> {
    let list: Value = d
        .app
        .client
        .get(
            d.app
                .url("/api/pharmacy/orders?camp_exceptions=true&per_page=100"),
        )
        .send()
        .await
        .expect("list")
        .json()
        .await
        .expect("list json");
    list["orders"]
        .as_array()
        .unwrap_or_else(|| panic!("orders: {list}"))
        .iter()
        .filter_map(|o| o["id"].as_str().and_then(|id| Uuid::parse_str(id).ok()))
        .collect()
}

#[tokio::test]
async fn a_camp_sync_signs_its_doctors_prescription_and_flags_what_the_gate_refuses() {
    let d = dispense_world::desk().await;
    let camp = camp(&d).await;
    let x = d.drug(Some("X"), true).await;
    let ndps = d.drug(Some("NDPS"), true).await;
    let h = d.drug(Some("H"), false).await;

    let doctor = staff(
        &d.app,
        &d.admin_csrf,
        ("doctor", d.department),
        &["camp.list"],
    )
    .await;
    issue_default_credential(&d.app, &d.admin_csrf, &doctor.user_id.to_string()).await;
    let visit = camp_visit(&d, camp, doctor.user_id).await;
    d.app
        .step_up(&doctor.client, &doctor.csrf, &doctor.password)
        .await;
    let written = sync(
        &d,
        &doctor,
        camp,
        vec![
            prescription_event(&d, visit, None, h),
            prescription_event(&d, visit, Some(d.doctor), h),
        ],
    )
    .await;
    let [own, others] = written.as_slice() else {
        panic!("two results: {written:?}");
    };
    assert_eq!(own.status, "applied", "{own:?}");
    assert_eq!(own.message, "", "signed without a note: {own:?}");
    let rx = created(own, "prescription_id");
    assert_eq!(
        signed(&d, rx).await,
        (true, true),
        "signed by the signing path"
    );
    assert_eq!(others.status, "applied", "{others:?}");
    assert!(
        others.message.contains("names another doctor"),
        "{others:?}"
    );
    let unsigned_rx = created(others, "prescription_id");
    assert_eq!(signed(&d, unsigned_rx).await, (false, false));

    let pharmacist = staff(
        &d.app,
        &d.admin_csrf,
        ("pharmacist", d.department),
        &["camp.list"],
    )
    .await;
    let results = sync(
        &d,
        &pharmacist,
        camp,
        vec![
            dispense_event(&d, Some(rx), &[(Some(x), 1), (Some(ndps), 1), (Some(h), 1)]),
            dispense_event(&d, Some(rx), &[(None, 1)]),
            dispense_event(&d, None, &[(Some(h), 2)]),
            dispense_event(&d, Some(rx), &[(Some(h), 10)]),
            dispense_event(&d, Some(rx), &[(Some(h), 1)]),
            dispense_event(&d, Some(unsigned_rx), &[(Some(h), 1)]),
        ],
    )
    .await;
    let [controlled, free_text, unprescribed, within, over, unsigned] = results.as_slice() else {
        panic!("six results: {results:?}");
    };

    assert_eq!(controlled.status, "failed", "{controlled:?}");
    for drug in [x, ndps] {
        assert!(
            controlled.message.contains(&format!("Line {drug}")),
            "{controlled:?}"
        );
    }
    assert!(
        controlled
            .message
            .contains("cannot be dispensed through camp offline sync")
    );
    assert!(
        !controlled.message.contains(&format!("Line {h}")),
        "H is not refused here"
    );
    assert_eq!(free_text.status, "failed", "{free_text:?}");
    assert!(
        free_text
            .message
            .contains("Free text tonic: choose the drug from the catalogue"),
        "{free_text:?}"
    );

    assert_eq!(within.status, "applied", "{within:?}");
    assert_eq!(
        within.message, "",
        "the signed prescription covers it: {within:?}"
    );
    let flagged = [
        (unprescribed, "no prescription for this patient"),
        (over, "10 already went out"),
        (unsigned, "not signed by the doctor"),
    ];
    let listed = camp_exceptions(&d).await;
    for (result, why) in flagged {
        assert_eq!(result.status, "applied", "posted, not retried: {result:?}");
        assert!(
            result.message.contains("flagged for pharmacist review"),
            "{result:?}"
        );
        assert!(result.message.contains(why), "{why}: {result:?}");
        let order = created(result, "pharmacy_order_id");
        assert_eq!(
            d.filed(order, "CAMP_DISPENSE_EXCEPTION", "blocked").await,
            1
        );
        assert!(
            listed.contains(&order),
            "{order} on the camp exceptions list"
        );
    }
    assert!(!listed.contains(&created(within, "pharmacy_order_id")));

    assert_eq!(stock(&d, x).await, 500, "nothing left the shelf");
    assert_eq!(stock(&d, ndps).await, 500);
    assert_eq!(
        stock(&d, h).await,
        486,
        "2 + 10 + 1 + 1 were handed over at the camp"
    );
}

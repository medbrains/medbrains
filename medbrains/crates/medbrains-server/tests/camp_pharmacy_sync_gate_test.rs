//! A camp's offline work, synced later, is held to the hospital's rules.
//!
//! A synced prescription names its doctor or is refused, and is never
//! signed at sync: it waits, unsigned, until the doctor signs it on the
//! review screen. A dispense on it before then is a camp exception.
//! A pharmacist with the built-in role syncs the dispenses: Schedule X, NDPS
//! and controlled lines, and lines with no catalogue item ("Pick the item
//! from the catalogue"), are refused and named, and nothing leaves the shelf.
//! A dispense naming a prescription that is not this patient's fails alone;
//! one linked to the patient only through the visit is theirs. A Schedule H dispense that already
//! happened and fails the gate is posted, filed as `CAMP_DISPENSE_EXCEPTION`,
//! and listed under the pharmacy's camp exceptions; one the signed
//! prescription covers is applied clean.

use crate::{
    dispense_world::{self, Signed, staff},
    signable_types_test::review_and_sign,
    signatures_test::issue_default_credential,
};

use reqwest::StatusCode;

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
async fn a_camp_prescription_waits_for_its_doctor_and_the_gate_flags_what_it_refuses() {
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
    // A step-up on the sync signs nothing.
    d.app
        .step_up(&doctor.client, &doctor.csrf, &doctor.password)
        .await;
    let written = sync(
        &d,
        &doctor,
        camp,
        vec![
            prescription_event(&d, visit, Some(doctor.user_id), h),
            prescription_event(&d, visit, None, h),
        ],
    )
    .await;
    let [own, nobody] = written.as_slice() else {
        panic!("two results: {written:?}");
    };
    assert_eq!(own.status, "applied", "{own:?}");
    assert!(own.message.contains("saved unsigned"), "{own:?}");
    let rx = created(own, "prescription_id");
    assert_eq!(signed(&d, rx).await, (false, false), "not signed at sync");
    assert_eq!(nobody.status, "failed", "{nobody:?}");
    assert!(nobody.message.contains("doctor_id"), "{nobody:?}");

    let pharmacist = staff(
        &d.app,
        &d.admin_csrf,
        ("pharmacist", d.department),
        &["camp.list"],
    )
    .await;
    let before_signing = sync(
        &d,
        &pharmacist,
        camp,
        vec![dispense_event(&d, Some(rx), &[(Some(h), 1)])],
    )
    .await;
    let [unsigned] = before_signing.as_slice() else {
        panic!("one result: {before_signing:?}");
    };

    // The doctor signs it from the inbox, through the review screen.
    let (status, body) =
        review_and_sign(&doctor.client, &d.app, &doctor.csrf, "prescription", rx).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(
        signed(&d, rx).await,
        (true, true),
        "signed by the signing path"
    );

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
            dispense_event(&d, Some(rx), &[(Some(h), 9)]),
            dispense_event(&d, Some(rx), &[(Some(h), 1)]),
        ],
    )
    .await;
    let [controlled, free_text, unprescribed, within, over] = results.as_slice() else {
        panic!("five results: {results:?}");
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
        free_text.message.contains(&format!(
            "Free text tonic: {}",
            medbrains_pharmacy::schedule_gate::PICK_FROM_CATALOGUE
        )),
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
        487,
        "1 + 2 + 9 + 1 were handed over at the camp"
    );
}

/// Another patient of the desk's tenant, with an open visit and a signed
/// prescription for one tablet of `drug`: a real prescription, not this
/// patient's.
async fn another_patients_prescription(d: &dispense_world::Desk, drug: Uuid) -> Uuid {
    let t = dispense_world::tag().to_uppercase();
    let other: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, \
                               no_known_allergies) \
         VALUES ($1, $2, 'Other', 'Patient', 'male', $3, true) RETURNING id",
    )
    .bind(d.tenant)
    .bind(format!("UH-OT-{t}"))
    .bind(format!("7{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&d.app.db)
    .await
    .expect("other patient");
    let visit: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status) \
         VALUES ($1, $2, 'opd', 'open') RETURNING id",
    )
    .bind(d.tenant)
    .bind(other)
    .fetch_one(&d.app.db)
    .await
    .expect("other visit");
    let rx: Uuid = sqlx::query_scalar(
        "INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, patient_id, \
                                    valid_until, order_mode, is_signed) \
         VALUES ($1, $2, $3, $4, '2999-01-01', 'written', true) RETURNING id",
    )
    .bind(d.tenant)
    .bind(visit)
    .bind(d.doctor)
    .bind(other)
    .fetch_one(&d.app.db)
    .await
    .expect("other prescription");
    add_item(d, rx, drug).await;
    rx
}

/// A signed prescription that names the desk's patient only through the
/// visit (`patient_id` unset), as an OPD prescription does.
async fn visit_linked_prescription(d: &dispense_world::Desk, drug: Uuid) -> Uuid {
    let rx: Uuid = sqlx::query_scalar(
        "INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, valid_until, order_mode, \
                                    is_signed) \
         VALUES ($1, $2, $3, '2999-01-01', 'written', true) RETURNING id",
    )
    .bind(d.tenant)
    .bind(d.encounter)
    .bind(d.doctor)
    .fetch_one(&d.app.db)
    .await
    .expect("visit prescription");
    add_item(d, rx, drug).await;
    rx
}

/// One tablet BD of `drug` for 5 days on `rx`.
async fn add_item(d: &dispense_world::Desk, rx: Uuid, drug: Uuid) {
    sqlx::query(
        "INSERT INTO prescription_items (tenant_id, prescription_id, drug_name, dosage, \
                                         frequency, duration, catalog_item_id, quantity) \
         VALUES ($1, $2, 'as prescribed', '1 tab', 'BD', '5 days', $3, 10)",
    )
    .bind(d.tenant)
    .bind(rx)
    .bind(drug)
    .execute(&d.app.db)
    .await
    .expect("prescription item");
}

#[tokio::test]
async fn a_dispense_naming_a_prescription_not_this_patients_fails_alone() {
    let d = dispense_world::desk().await;
    let camp = camp(&d).await;
    let plain = d.drug(None, false).await;
    let others = another_patients_prescription(&d, plain).await;
    let visit_linked = visit_linked_prescription(&d, plain).await;
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
            dispense_event(&d, Some(Uuid::new_v4()), &[(Some(plain), 1)]),
            dispense_event(&d, Some(others), &[(Some(plain), 1)]),
            dispense_event(&d, Some(visit_linked), &[(Some(plain), 1)]),
            dispense_event(&d, None, &[(Some(plain), 1)]),
        ],
    )
    .await;
    let [unknown, not_theirs, through_visit, later] = results.as_slice() else {
        panic!("four results: {results:?}");
    };
    for refused in [unknown, not_theirs] {
        assert_eq!(refused.status, "failed", "{refused:?}");
        assert!(refused.message.contains("not on record"), "{refused:?}");
    }
    assert_eq!(through_visit.status, "applied", "{through_visit:?}");
    assert_eq!(through_visit.message, "", "{through_visit:?}");
    assert_eq!(later.status, "applied", "{later:?}");
    assert_eq!(
        stock(&d, plain).await,
        498,
        "only the visit-linked and the later events dispensed"
    );
}

//! A camp's offline dispense, synced later, is held to the hospital's rules.
//!
//! Schedule X, NDPS and controlled lines are refused outright and named, and
//! nothing leaves the shelf. Schedule H lines must stand on the synced
//! prescription and within its quantity, counting what earlier synced
//! dispenses on it already gave.

use crate::dispense_world;

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

/// A synced dispense of `items` (drug, quantity) to the desk's patient.
fn dispense_event(d: &dispense_world::Desk, rx: Option<Uuid>, items: &[(Uuid, i32)]) -> Value {
    json!({
        "idempotency_key": format!("rx-{}", Uuid::new_v4()),
        "event_type": "camp.pharmacy.dispense",
        "client_entity_id": Uuid::new_v4(),
        "payload": {
            "patient_id": d.patient,
            "encounter_id": d.encounter,
            "prescription_id": rx,
            "items": items.iter().map(|(drug, quantity)| json!({
                "catalog_item_id": drug,
                "drug_name": format!("Line {drug}"),
                "quantity": quantity,
                "unit_price": "10.00",
            })).collect::<Vec<_>>(),
        },
    })
}

/// Sends the events in order and returns each one's (status, message).
async fn sync(d: &dispense_world::Desk, camp: Uuid, events: Vec<Value>) -> Vec<(String, String)> {
    let synced: Value = d
        .app
        .client
        .post(d.app.url("/api/camp/sync/inbound"))
        .header("x-csrf-token", &d.admin_csrf)
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
        .map(|r| {
            (
                r["status"].as_str().unwrap_or_default().to_owned(),
                r["message"].as_str().unwrap_or_default().to_owned(),
            )
        })
        .collect()
}

/// What the catalogue holds of a drug.
async fn stock(d: &dispense_world::Desk, drug: Uuid) -> i32 {
    sqlx::query_scalar("SELECT current_stock FROM pharmacy_catalog WHERE id = $1")
        .bind(drug)
        .fetch_one(&d.app.db)
        .await
        .expect("stock")
}

#[tokio::test]
async fn a_camp_sync_refuses_controlled_lines_and_holds_schedule_h_to_the_prescription() {
    let d = dispense_world::desk().await;
    let camp = camp(&d).await;
    let x = d.drug(Some("X"), true).await;
    let ndps = d.drug(Some("NDPS"), true).await;
    let h = d.drug(Some("H"), false).await;
    let rx = d.prescription(&[(h, Some(10), "BD")]).await;

    let results = sync(
        &d,
        camp,
        vec![
            dispense_event(&d, Some(rx), &[(x, 1), (ndps, 1), (h, 1)]),
            dispense_event(&d, None, &[(h, 2)]),
            dispense_event(&d, Some(rx), &[(h, 12)]),
            dispense_event(&d, Some(rx), &[(h, 10)]),
            dispense_event(&d, Some(rx), &[(h, 1)]),
        ],
    )
    .await;
    let [controlled, unprescribed, over, within, after] = results.as_slice() else {
        panic!("five results: {results:?}");
    };

    assert_eq!(controlled.0, "failed", "{controlled:?}");
    for drug in [x, ndps] {
        assert!(
            controlled.1.contains(&format!("Line {drug}")),
            "{controlled:?}"
        );
    }
    assert!(
        controlled
            .1
            .contains("cannot be dispensed through camp offline sync")
    );
    assert!(
        !controlled.1.contains(&format!("Line {h}")),
        "H is not refused here"
    );
    assert!(
        unprescribed.1.contains("no prescription for this patient"),
        "{unprescribed:?}"
    );
    assert!(over.1.contains("the prescription allows 10"), "{over:?}");
    assert_eq!(within.0, "applied", "{within:?}");
    assert!(after.1.contains("10 already went out"), "{after:?}");

    assert_eq!(stock(&d, x).await, 500, "nothing left the shelf");
    assert_eq!(stock(&d, ndps).await, 500);
    assert_eq!(
        stock(&d, h).await,
        490,
        "only the one dispense the prescription covers"
    );
}

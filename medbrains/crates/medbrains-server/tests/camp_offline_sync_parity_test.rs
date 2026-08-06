mod common;

use uuid::Uuid;

/// The offline path must not quietly lose what the online path keeps.
///
/// A camp runs on the mobile app with no signal: intake queues sync events
/// locally and replays them later. Those events parse into the same request
/// structs the HTTP handlers use, so widening the structs made the new camp-form
/// fields *look* supported over sync while the sync INSERTs still listed the old
/// columns — the fields would have been accepted, acknowledged, and dropped.
///
/// Silent loss on the offline path is the worst version of this bug: the tablet
/// reports success, the field team moves on, and the data is gone by the time
/// anybody looks.
#[tokio::test]
async fn offline_sync_keeps_every_camp_form_field() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let camp: serde_json::Value = app
        .client
        .post(app.url("/api/camp/camps"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "name": "Offline Sync Parity Camp",
            "camp_type": "general_health",
            "scheduled_date": "2026-08-06",
        }))
        .send()
        .await
        .expect("create camp")
        .json()
        .await
        .expect("camp json");
    let camp_id = Uuid::parse_str(camp["id"].as_str().expect("camp id")).expect("uuid");

    // The tablet mints its own ids offline and replays them on reconnect.
    let registration_client_id = Uuid::new_v4();

    let synced: serde_json::Value = app
        .client
        .post(app.url("/api/camp/sync/inbound"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "camp_id": camp_id,
            "device_id": "offline-parity-tablet",
            "events": [
                {
                    "idempotency_key": format!("reg-{registration_client_id}"),
                    "event_type": "camp.registration.create",
                    "client_entity_id": registration_client_id,
                    "payload": {
                        "camp_id": camp_id,
                        "person_name": "Offline Parity",
                        "age": 61,
                        "gender": "male",
                        "father_spouse_name": "Offline Spouse",
                        "marital_status": "Married",
                        "blood_group": "B+",
                        "insurance_details": "NIA / NIA-4471",
                        "is_walk_in": true,
                    },
                },
                {
                    "idempotency_key": format!("scr-{registration_client_id}"),
                    "event_type": "camp.screening.create",
                    "client_entity_id": Uuid::new_v4(),
                    "payload": {
                        "registration_id": registration_client_id,
                        "bp_systolic": 148,
                        "bp_diastolic": 92,
                        "mh_diabetes": true,
                        "mh_hypertension": true,
                        "mh_asthma": false,
                        "medical_history_notes": "On amlodipine",
                        "test_hba1c": "8.2",
                        "test_ecg": "Left axis deviation",
                        "referral_doctor_name": "Dr Offline",
                        "icd_codes": ["I10", "E11.9"],
                    },
                },
            ],
        }))
        .send()
        .await
        .expect("sync request")
        .json()
        .await
        .expect("sync json");

    let results = synced["results"].as_array().expect("results array");
    for result in results {
        assert_ne!(
            result["status"].as_str(),
            Some("failed"),
            "every queued event should apply: {synced}"
        );
    }

    // Read the registration back through the API the field team actually uses.
    let registrations: serde_json::Value = app
        .get(
            &app.client,
            &format!("/api/camp/registrations?camp_id={camp_id}"),
        )
        .await
        .json()
        .await
        .expect("registrations json");
    let rows = registrations
        .as_array()
        .cloned()
        .or_else(|| registrations["registrations"].as_array().cloned())
        .expect("a registration list");
    let registration = rows
        .iter()
        .find(|row| row["person_name"].as_str() == Some("Offline Parity"))
        .unwrap_or_else(|| panic!("the synced registration should exist: {registrations}"));

    assert_eq!(
        registration["father_spouse_name"].as_str(),
        Some("Offline Spouse"),
        "sync must not drop identity fields: {registration}"
    );
    assert_eq!(registration["blood_group"].as_str(), Some("B+"));
    assert_eq!(
        registration["insurance_details"].as_str(),
        Some("NIA / NIA-4471")
    );

    let registration_id = registration["id"].as_str().expect("registration id");
    let screenings: serde_json::Value = app
        .get(
            &app.client,
            &format!("/api/camp/screenings?registration_id={registration_id}"),
        )
        .await
        .json()
        .await
        .expect("screenings json");
    let screening_rows = screenings
        .as_array()
        .cloned()
        .or_else(|| screenings["screenings"].as_array().cloned())
        .expect("a screening list");
    let screening = screening_rows
        .first()
        .unwrap_or_else(|| panic!("the synced screening should exist: {screenings}"));

    assert_eq!(
        screening["mh_diabetes"].as_bool(),
        Some(true),
        "sync must not drop the comorbidity a camp exists to find: {screening}"
    );
    assert_eq!(screening["mh_asthma"].as_bool(), Some(false));
    assert_eq!(
        screening["medical_history_notes"].as_str(),
        Some("On amlodipine")
    );
    assert_eq!(screening["test_ecg"].as_str(), Some("Left axis deviation"));
    assert_eq!(
        screening["referral_doctor_name"].as_str(),
        Some("Dr Offline")
    );

    let codes: Vec<&str> = screening["icd_codes"]
        .as_array()
        .expect("icd_codes array survives sync")
        .iter()
        .filter_map(serde_json::Value::as_str)
        .collect();
    assert_eq!(codes, vec!["I10", "E11.9"]);
}

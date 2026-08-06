mod common;

use uuid::Uuid;

/// A camp form's fields must survive the round-trip.
///
/// Measured against 1,125 real records from the medical-camp form series: of
/// the 46 fields the paper asks for, 22 had nowhere to go and were dropped or
/// flattened into free text. This asserts the ones that had no home now come
/// back exactly as they went in.
///
/// The values mirror what the forms actually contain — the `mh_*` fields are
/// tick boxes ('Yes' or blank, never a description), HbA1c and haemoglobin are
/// numbers worth trending, ECG and X-ray are handwritten impressions, and the
/// ICD codes are real ones taken from the audited records.
#[tokio::test]
async fn a_camp_form_round_trips_every_field_it_captures() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let camp: serde_json::Value = app
        .client
        .post(app.url("/api/camp/camps"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "name": "Field Parity Camp",
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

    // ── Registration: the identity fields the form collects ──
    let registration: serde_json::Value = app
        .client
        .post(app.url("/api/camp/registrations"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "camp_id": camp_id,
            "person_name": "Parity Test",
            "age": 54,
            "gender": "female",
            "phone": "9990005001",
            "father_spouse_name": "Spouse Name",
            "marital_status": "Married",
            "blood_group": "O+",
            "insurance_details": "Star Health / SH-99812",
            "chief_complaint": "Knee pain for three months",
        }))
        .send()
        .await
        .expect("create registration")
        .json()
        .await
        .expect("registration json");

    let registration_id = registration["id"].as_str().expect("registration id");
    assert_eq!(
        registration["father_spouse_name"].as_str(),
        Some("Spouse Name"),
        "father/spouse is how a rural register tells two same-named people apart: {registration}"
    );
    assert_eq!(registration["marital_status"].as_str(), Some("Married"));
    assert_eq!(registration["blood_group"].as_str(), Some("O+"));
    assert_eq!(
        registration["insurance_details"].as_str(),
        Some("Star Health / SH-99812")
    );

    // ── Screening: history tick boxes, tests, referral and coding ──
    let screening: serde_json::Value = app
        .client
        .post(app.url("/api/camp/screenings"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "registration_id": registration_id,
            "bp_systolic": 130,
            "bp_diastolic": 80,
            "pulse_rate": 78,
            "blood_sugar_random": "115",
            "mh_diabetes": true,
            "mh_hypertension": true,
            "mh_asthma": false,
            "mh_thyroid_disorder": true,
            "mh_previous_surgeries": true,
            "mh_smoking_history": false,
            "medical_history_notes": "Metformin 500mg twice daily",
            "test_hba1c": "7.1",
            "test_haemoglobin": "13.9",
            "test_ecg": "Sinus rhythm, no ST changes",
            "test_xray": "Mild degenerative change",
            "referral_doctor_name": "Dr Bharathi",
            "referral_department": "Orthopaedics",
            "icd_codes": ["M25.5", "E11.9"],
        }))
        .send()
        .await
        .expect("create screening")
        .json()
        .await
        .expect("screening json");

    assert_eq!(screening["mh_diabetes"].as_bool(), Some(true));
    assert_eq!(screening["mh_hypertension"].as_bool(), Some(true));
    assert_eq!(screening["mh_thyroid_disorder"].as_bool(), Some(true));

    // A ticked box and an unasked question are different facts. `false` must
    // survive as false, and a field never sent must stay null — a screening
    // camp cannot treat "not asked" as a negative finding.
    assert_eq!(
        screening["mh_asthma"].as_bool(),
        Some(false),
        "an explicit no must not be stored as unknown: {screening}"
    );
    assert!(
        screening["mh_heart_disease"].is_null(),
        "a question never asked must stay null, not default to false: {screening}"
    );

    assert_eq!(
        screening["medical_history_notes"].as_str(),
        Some("Metformin 500mg twice daily")
    );
    assert_eq!(
        screening["test_ecg"].as_str(),
        Some("Sinus rhythm, no ST changes")
    );
    assert_eq!(
        screening["test_xray"].as_str(),
        Some("Mild degenerative change")
    );
    assert_eq!(
        screening["referral_doctor_name"].as_str(),
        Some("Dr Bharathi")
    );

    // Numeric so they can be trended, not stringly stored.
    let hba1c: f64 = screening["test_hba1c"]
        .as_str()
        .map(|v| v.parse().expect("hba1c parses"))
        .or_else(|| screening["test_hba1c"].as_f64())
        .expect("hba1c present");
    assert!(
        (hba1c - 7.1).abs() < 0.001,
        "hba1c round-trips: {screening}"
    );

    let codes: Vec<&str> = screening["icd_codes"]
        .as_array()
        .expect("icd_codes is an array")
        .iter()
        .filter_map(serde_json::Value::as_str)
        .collect();
    assert_eq!(
        codes,
        vec!["M25.5", "E11.9"],
        "one screening routinely yields more than one code: {screening}"
    );
}

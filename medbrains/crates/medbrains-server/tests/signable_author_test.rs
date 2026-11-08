//! Who authors a report, and what the signature covers beyond the record.
//!
//! Scenarios:
//! - a lab report is signed by the pathologist who validated it (ISO 15189 /
//!   NABL authorised signatory); a technician cannot sign it; an
//!   auto-validated result nobody validated answers 409;
//! - a radiology report verified by a consultant is the consultant's to sign
//!   as primary, not the resident who drafted it;
//! - correcting the side on an OT booking takes the signed checklist's
//!   signature off.

use crate::signable_types_test::{
    admin_signer, attend, audits, is_signed, keyed_staff, patient_visit, review_and_sign,
};
use crate::{common, signatures_test};

use reqwest::StatusCode;
use uuid::Uuid;

/// A registered doctor, stepped up and keyed, attending `patient`.
async fn doctor_for(
    app: &common::TestApp,
    csrf: &str,
    tenant: Uuid,
    patient: Uuid,
) -> common::Staff {
    let doctor = keyed_staff(app, csrf, "doctor").await;
    signatures_test::register_doctor(app, &doctor.user_id.to_string()).await;
    attend(app, tenant, patient, doctor.user_id).await;
    doctor
}

/// A result entered by `entered_by` on an order `validator` validated;
/// `auto` marks it auto-validated by the analyser. (patient, result).
async fn lab_result(
    app: &common::TestApp,
    tenant: Uuid,
    admin: Uuid,
    validator: Option<Uuid>,
    auto: bool,
) -> (Uuid, Uuid) {
    let (patient, encounter, dept) = patient_visit(app, tenant, admin).await;
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let test: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_test_catalog (tenant_id, code, name) VALUES ($1, $2, 'Creatinine') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("SIG-CR-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("test");
    let order: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by, \
            department_id, verified_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(patient)
    .bind(test)
    .bind(admin)
    .bind(dept)
    .bind(validator)
    .fetch_one(&app.db)
    .await
    .expect("order");
    let result: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_results (tenant_id, order_id, parameter_name, value, unit, entered_by, \
            is_auto_validated) VALUES ($1, $2, 'Creatinine', '1.1', 'mg/dL', $3, $4) RETURNING id",
    )
    .bind(tenant)
    .bind(order)
    .bind(admin)
    .bind(auto)
    .fetch_one(&app.db)
    .await
    .expect("result");
    (patient, result)
}

#[tokio::test]
async fn the_validating_pathologist_signs_a_lab_report_and_nobody_signs_an_unvalidated_one() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = admin_signer(&app).await;

    // The pathologist who validated signs; the admin, who only entered it, does not.
    let pathologist = keyed_staff(&app, &csrf, "doctor").await;
    signatures_test::register_doctor(&app, &pathologist.user_id.to_string()).await;
    let (patient, validated) =
        lab_result(&app, tenant, admin, Some(pathologist.user_id), false).await;
    attend(&app, tenant, patient, pathologist.user_id).await;
    let entered_only = review_and_sign(&app.client, &app, &csrf, "lab_report", validated)
        .await
        .0;
    assert_eq!(
        entered_only,
        StatusCode::NOT_FOUND,
        "entering a result is not authoring the report"
    );
    let (status, body) = review_and_sign(
        &pathologist.client,
        &app,
        &pathologist.csrf,
        "lab_report",
        validated,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "the validator signs: {body}");

    // A technician has no signing right at all.
    let technician = keyed_staff(&app, &csrf, "lab_technician").await;
    let (status, _) = review_and_sign(
        &technician.client,
        &app,
        &technician.csrf,
        "lab_report",
        validated,
    )
    .await;
    assert!(
        matches!(status, StatusCode::FORBIDDEN | StatusCode::NOT_FOUND),
        "technician: {status}"
    );

    // Auto-validated by the analyser, validated by no one: no one signs.
    let (_, auto) = lab_result(&app, tenant, admin, None, true).await;
    let (status, body) = signable_post(&app, &csrf, auto).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert!(body.contains("pathologist must validate"), "{body}");
}

/// Open `result` on the review screen as the admin; the status and body text.
async fn signable_post(app: &common::TestApp, csrf: &str, result: Uuid) -> (StatusCode, String) {
    let resp = app
        .client
        .post(app.url("/api/signatures/review"))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({ "record_type": "lab_report", "record_id": result }))
        .send()
        .await
        .expect("review");
    let status = resp.status();
    (status, resp.text().await.unwrap_or_default())
}

#[tokio::test]
async fn the_verifying_radiologist_signs_a_report_a_resident_drafted() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = admin_signer(&app).await;
    let (patient, _, _) = patient_visit(&app, tenant, admin).await;
    let consultant = doctor_for(&app, &csrf, tenant, patient).await;
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let modality: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_modalities (tenant_id, code, name) VALUES ($1, $2, 'CT') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("SIG-CT-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("modality");
    let order: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_orders (tenant_id, patient_id, modality_id, ordered_by, body_part) \
         VALUES ($1, $2, $3, $4, 'Head') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(modality)
    .bind(admin)
    .fetch_one(&app.db)
    .await
    .expect("order");
    // Drafted by the admin as the resident, verified by the consultant.
    let report: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_reports (tenant_id, order_id, reported_by, verified_by, findings) \
         VALUES ($1, $2, $3, $4, 'No intracranial bleed') RETURNING id",
    )
    .bind(tenant)
    .bind(order)
    .bind(admin)
    .bind(consultant.user_id)
    .fetch_one(&app.db)
    .await
    .expect("report");
    let (status, _) = review_and_sign(&app.client, &app, &csrf, "radiology_report", report).await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "the resident co-signs once a consultant verified"
    );
    let (status, body) = review_and_sign(
        &consultant.client,
        &app,
        &consultant.csrf,
        "radiology_report",
        report,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "the consultant signs: {body}");

    // Correcting the side of the study takes the signature off.
    sqlx::query("UPDATE radiology_orders SET body_part = 'Chest' WHERE id = $1")
        .bind(order)
        .execute(&app.db)
        .await
        .expect("correct the order");
    assert!(!is_signed(&app, "radiology_reports", report).await);
}

#[tokio::test]
async fn correcting_the_side_on_a_booking_takes_the_checklist_signature_off() {
    let app = common::spawn_app_as_request_role().await;
    let (csrf, admin, tenant) = admin_signer(&app).await;
    let (patient, _, _) = patient_visit(&app, tenant, admin).await;
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let room: Uuid = sqlx::query_scalar(
        "INSERT INTO ot_rooms (tenant_id, name, code) VALUES ($1, 'OT 1', $2) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("OT{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("room");
    let booking: Uuid = sqlx::query_scalar(
        "INSERT INTO ot_bookings (tenant_id, patient_id, ot_room_id, primary_surgeon_id, \
            scheduled_date, scheduled_start, scheduled_end, procedure_name, laterality) \
         VALUES ($1, $2, $3, $4, CURRENT_DATE, now(), now() + interval '2 hours', \
                 'Knee arthroscopy', 'left') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(room)
    .bind(admin)
    .fetch_one(&app.db)
    .await
    .expect("booking");
    let checklist: Uuid = sqlx::query_scalar(
        "INSERT INTO ot_surgical_safety_checklists (tenant_id, booking_id, phase, items, completed, \
            completed_by, completed_at) \
         VALUES ($1, $2, 'sign_in', '[{\"item\":\"site marked\",\"checked\":true}]'::jsonb, true, $3, now()) \
         RETURNING id",
    )
    .bind(tenant)
    .bind(booking)
    .bind(admin)
    .fetch_one(&app.db)
    .await
    .expect("checklist");
    let (status, body) =
        review_and_sign(&app.client, &app, &csrf, "ot_safety_checklist", checklist).await;
    assert_eq!(status, StatusCode::OK, "{body}");

    sqlx::query("UPDATE ot_bookings SET laterality = 'right' WHERE id = $1")
        .bind(booking)
        .execute(&app.db)
        .await
        .expect("correct the side");
    assert!(
        !is_signed(&app, "ot_surgical_safety_checklists", checklist).await,
        "a checklist signed for the left knee is not a checklist for the right"
    );
    assert_eq!(
        audits(&app, "ot_safety_checklist.signature_cleared", checklist).await,
        1
    );
}

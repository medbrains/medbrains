//! ABDM M1 P1: changing the patient's own ABHA, and the patient leaving,
//! against the stand-in in `abdm_abha_world`:
//! - re-KYC (PROF_ABHA_604) and a new photo (602);
//! - delete or deactivate (605), and what the hospital stops using;
//! - opt-out here (M2 HIP_INIT_ABHA_OPTOUT_DEACTIVATE) and linking back.

use crate::abdm_abha_world::{
    NUMBER, SERIAL, app_with_keys, call, patient_with_the_abha, verified,
};
use crate::common;

use base64::{Engine, engine::general_purpose::STANDARD};
use reqwest::StatusCode;
use serde_json::json;

/// Given a verified ABHA, When the desk re-KYCs it and changes its photo,
/// Then ABDM gets the re-kyc scope by Aadhaar OTP with `reasons` (the
/// swagger requires it), the profile is read again, and only a real image
/// is sent as the photo.
#[tokio::test]
async fn re_kyc_and_a_new_photo_go_to_abdm_as_the_swagger_asks() {
    let _serial = SERIAL.lock().await;
    let (app, csrf, mock) = app_with_keys().await;
    let id = verified(&app, &csrf).await;
    let base = format!("/api/abdm/abha/verifications/{id}");
    let (s, _) = call(
        &app,
        &csrf,
        &format!("{base}/re-kyc/verify"),
        json!({ "otp": "123456" }),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "no re-KYC OTP was sent");
    let (s, _) = call(&app, &csrf, &format!("{base}/re-kyc"), json!({})).await;
    assert_eq!(s, StatusCode::OK);
    let asked = &mock.sent("/v3/profile/account/request/otp")[0];
    assert_eq!(asked["scope"], json!(["abha-profile", "re-kyc"]));
    assert_eq!(
        (asked["loginHint"].as_str(), asked["otpSystem"].as_str()),
        (Some("abha-number"), Some("aadhaar"))
    );
    assert_eq!(mock.decrypt(&asked["loginId"]), NUMBER.replace('-', ""));
    let (s, step) = call(
        &app,
        &csrf,
        &format!("{base}/re-kyc/verify"),
        json!({ "otp": "123456" }),
    )
    .await;
    assert_eq!(
        (s, step["stage"].as_str()),
        (StatusCode::OK, Some("verified")),
        "{step}"
    );
    let checked = &mock.sent("/v3/profile/account/verify")[0];
    assert_eq!(checked["reasons"], json!([]));
    assert_eq!(checked["scope"], json!(["abha-profile", "re-kyc"]));

    let (s, _) = call(
        &app,
        &csrf,
        &format!("{base}/photo"),
        json!({ "photo": STANDARD.encode(b"%PDF-1.7") }),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "a PDF is no photo");
    let jpeg = STANDARD.encode([0xFF, 0xD8, 0xFF, 0xE0, 0, 16]);
    let (s, _) = call(
        &app,
        &csrf,
        &format!("{base}/photo"),
        json!({ "photo": format!("data:image/jpeg;base64,{jpeg}") }),
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(
        mock.sent("/v3/profile/account")[0]["profilePhoto"],
        jpeg,
        "sent without the data: prefix"
    );
}

/// Given a patient here carrying a verified ABHA, When they delete it at the
/// desk (staff holding `abdm.abha.deactivate` only, a reason, ABDM's OTP),
/// Then ABDM gets the delete scope with the reason, and the hospital stops
/// using it: link ended, consents deleted, audited.
#[tokio::test]
async fn deleting_an_abha_needs_the_permission_and_ends_its_use_here() {
    let _serial = SERIAL.lock().await;
    let (app, csrf, mock) = app_with_keys().await;
    let id = verified(&app, &csrf).await;
    let patient = patient_with_the_abha(&app, &csrf, &id).await;
    let base = format!("/api/abdm/abha/verifications/{id}");

    let lab = common::provision_staff(&app, &csrf, "lab_technician", &[]).await;
    let refused = lab
        .client
        .post(app.url(&format!("{base}/close")))
        .header("x-csrf-token", &lab.csrf)
        .json(&json!({ "action": "delete", "otp_via": "aadhaar", "reason": "x" }))
        .send()
        .await
        .expect("close");
    assert_eq!(
        refused.status(),
        StatusCode::FORBIDDEN,
        "closing an ABHA is its own permission"
    );

    let (s, _) = call(
        &app,
        &csrf,
        &format!("{base}/close"),
        json!({ "action": "delete", "otp_via": "abdm", "reason": " " }),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "a reason is required");
    let (s, _) = call(
        &app,
        &csrf,
        &format!("{base}/close"),
        json!({ "action": "delete", "otp_via": "abdm", "reason": "Moving abroad" }),
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    let asked = &mock.sent("/v3/profile/account/request/otp")[0];
    assert_eq!(
        (asked["scope"].clone(), asked["otpSystem"].as_str()),
        (json!(["abha-profile", "delete"]), Some("abdm"))
    );
    let (s, closed) = call(
        &app,
        &csrf,
        &format!("{base}/close/verify"),
        json!({ "otp": "123456" }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{closed}");
    assert_eq!(closed["unlinked"]["patient_id"], patient.to_string());
    assert_eq!(
        mock.sent("/v3/profile/account/verify")[0]["reasons"],
        json!(["Moving abroad"])
    );

    let (live_links, consents, audited): (i64, i64, i64) = sqlx::query_as(
        "SELECT (SELECT count(*) FROM patient_abha_links WHERE patient_id = $1 AND deleted_at IS NULL), \
                (SELECT count(*) FROM abdm_consent_artefacts WHERE patient_id = $1 AND deleted_at IS NULL), \
                (SELECT count(*) FROM audit_log WHERE entity_id = $1 AND action = 'patient.abha.unlinked')")
        .bind(patient).fetch_one(&app.db).await.expect("after");
    assert_eq!((live_links, consents, audited), (0, 0, 1));
    let (s, _) = call(&app, &csrf, &format!("{base}/re-kyc"), json!({})).await;
    assert_eq!(
        s,
        StatusCode::BAD_REQUEST,
        "the closed ABHA's session opens nothing"
    );
}

/// Given a patient carrying an ABHA, When they opt out of ABDM here, Then
/// the link and consents go, a second opt-out finds nothing, and verifying
/// the ABHA again links it back with the opt-out cleared.
#[tokio::test]
async fn an_opt_out_unlinks_and_a_new_verification_links_back() {
    let _serial = SERIAL.lock().await;
    let (app, csrf, _mock) = app_with_keys().await;
    let id = verified(&app, &csrf).await;
    let patient = patient_with_the_abha(&app, &csrf, &id).await;
    let path = format!("/api/abdm/patients/{patient}/abha/opt-out");
    let (s, _) = call(&app, &csrf, &path, json!({ "reason": "" })).await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, out) = call(
        &app,
        &csrf,
        &path,
        json!({ "reason": "Does not want records shared" }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{out}");
    assert_eq!(
        (
            out["abha_ending"].as_str(),
            out["consents_deleted"].as_i64()
        ),
        (Some("3333"), Some(1))
    );
    let (s, _) = call(&app, &csrf, &path, json!({ "reason": "again" })).await;
    assert_eq!(s, StatusCode::NOT_FOUND, "nothing left to opt out of");

    let again = verified(&app, &csrf).await;
    let (s, linked) = call(
        &app,
        &csrf,
        &format!("/api/abdm/abha/verifications/{again}/link"),
        json!({ "patient_id": patient, "apply": [] }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{linked}");
    let opted_out: Option<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
        "SELECT opted_out_at FROM patient_abha_links WHERE patient_id = $1 AND deleted_at IS NULL",
    )
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("link");
    assert_eq!(opted_out, None);
}

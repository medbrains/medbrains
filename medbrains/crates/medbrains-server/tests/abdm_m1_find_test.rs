//! ABDM M1 P1: finding an ABHA and reading what ABDM says, against the
//! stand-in in `abdm_abha_world`:
//! - find ABHA by mobile (VRFY_ABHA_301–305) and by Aadhaar (401–405);
//! - ABDM's error codes read as a fix, not as ABDM's terse words;
//! - reading the QR on an ABHA card (VRFY_ABHA_501).

use crate::abdm_abha_world::{EXPIRED_OTP, NO_ABHA_AADHAAR, NUMBER, SERIAL, app_with_keys, call};

use reqwest::StatusCode;
use serde_json::json;

/// Given a mobile with two ABHAs, When the desk finds by mobile, Then ABDM
/// lists them masked before any OTP; the OTP goes to the one picked,
/// chained to the search (scope search-abha, hint index, its txnId), a
/// resend repeats exactly that, and the OTP verifies that ABHA.
#[tokio::test]
async fn finding_by_mobile_lists_the_abhas_then_verifies_the_one_picked() {
    let _serial = SERIAL.lock().await;
    let (app, csrf, mock) = app_with_keys().await;
    let (s, found) = call(
        &app,
        &csrf,
        "/api/abdm/abha/verifications",
        json!({ "method": "find_mobile", "value": "98765 43210" }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{found}");
    assert_eq!(found["stage"], "search_results");
    assert_eq!(found["accounts"].as_array().map(Vec::len), Some(2));
    assert!(
        mock.sent("/v3/profile/login/request/otp").is_empty(),
        "no OTP before the pick"
    );
    let search = &mock.sent("/v3/profile/account/abha/search")[0];
    assert_eq!(search["scope"], json!(["search-abha"]));
    assert_eq!(mock.decrypt(&search["mobile"]), "9876543210");

    let id = found["id"].as_str().expect("id").to_owned();
    let (s, refused) = call(
        &app,
        &csrf,
        &format!("/api/abdm/abha/verifications/{id}/account"),
        json!({ "abha_number": "91-0000-0000-0000" }),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST, "only a listed ABHA: {refused}");
    let (s, sent) = call(
        &app,
        &csrf,
        &format!("/api/abdm/abha/verifications/{id}/account"),
        json!({ "abha_number": "xx-xxxx-xxxx-2222" }),
    )
    .await;
    assert_eq!(
        (s, sent["stage"].as_str()),
        (StatusCode::OK, Some("otp_sent")),
        "{sent}"
    );
    let otp = &mock.sent("/v3/profile/login/request/otp")[0];
    assert_eq!(
        otp["scope"],
        json!(["abha-login", "search-abha", "mobile-verify"])
    );
    assert_eq!(
        (otp["loginHint"].as_str(), otp["txnId"].as_str()),
        (Some("index"), Some("search-txn"))
    );
    assert_eq!(
        mock.decrypt(&otp["loginId"]),
        "2",
        "the picked account's index"
    );

    sqlx::query("UPDATE abha_verifications SET otp_sent_at = now() - interval '2 minutes' WHERE id = $1::uuid")
        .bind(&id).execute(&app.db).await.expect("backdate");
    let (s, again) = call(
        &app,
        &csrf,
        &format!("/api/abdm/abha/verifications/{id}/resend"),
        json!({}),
    )
    .await;
    assert_eq!(
        (s, again["resends_left"].as_i64()),
        (StatusCode::OK, Some(1)),
        "{again}"
    );
    let resent = &mock.sent("/v3/profile/login/request/otp")[1];
    assert_eq!(
        (resent["txnId"].as_str(), mock.decrypt(&resent["loginId"])),
        (Some("search-txn"), "2".to_owned())
    );

    let (s, done) = call(
        &app,
        &csrf,
        &format!("/api/abdm/abha/verifications/{id}/otp"),
        json!({ "otp": "123456" }),
    )
    .await;
    assert_eq!(
        (s, done["stage"].as_str()),
        (StatusCode::OK, Some("verified")),
        "{done}"
    );
    assert_eq!(done["profile"]["abha_number"], NUMBER);
    let verify = &mock.sent("/v3/profile/login/verify")[0];
    assert_eq!(verify["scope"], json!(["abha-login", "mobile-verify"]));
    assert_eq!(
        mock.sent("/v3/profile/login/verify/user").len(),
        1,
        "the one account opened"
    );
}

/// Given an Aadhaar number, When the desk finds the ABHA by it, Then the
/// OTP goes to the Aadhaar mobile (scope aadhaar-verify, hint aadhaar), the
/// number is never stored, a resend needs it typed again, and an Aadhaar
/// with no ABHA says so and what to do (VRFY_ABHA_403).
#[tokio::test]
async fn finding_by_aadhaar_never_stores_it_and_says_when_there_is_no_abha() {
    let _serial = SERIAL.lock().await;
    let (app, csrf, mock) = app_with_keys().await;
    let (s, step) = call(
        &app,
        &csrf,
        "/api/abdm/abha/verifications",
        json!({ "method": "aadhaar", "value": "2345 6789 0123" }),
    )
    .await;
    assert_eq!(s, StatusCode::OK, "{step}");
    let id = step["id"].as_str().expect("id").to_owned();
    let otp = &mock.sent("/v3/profile/login/request/otp")[0];
    assert_eq!(otp["scope"], json!(["abha-login", "aadhaar-verify"]));
    assert_eq!(
        (otp["loginHint"].as_str(), otp["otpSystem"].as_str()),
        (Some("aadhaar"), Some("aadhaar"))
    );
    assert_eq!(mock.decrypt(&otp["loginId"]), "234567890123");
    let kept: String =
        sqlx::query_scalar("SELECT login_id_cipher FROM abha_verifications WHERE id = $1::uuid")
            .bind(&id)
            .fetch_one(&app.db)
            .await
            .expect("row");
    assert_eq!(kept, "", "not even the encrypted Aadhaar is kept");

    sqlx::query("UPDATE abha_verifications SET otp_sent_at = now() - interval '2 minutes' WHERE id = $1::uuid")
        .bind(&id).execute(&app.db).await.expect("backdate");
    let (s, _) = call(
        &app,
        &csrf,
        &format!("/api/abdm/abha/verifications/{id}/resend"),
        json!({}),
    )
    .await;
    assert_eq!(
        s,
        StatusCode::BAD_REQUEST,
        "the Aadhaar must be typed again"
    );
    let (s, _) = call(
        &app,
        &csrf,
        &format!("/api/abdm/abha/verifications/{id}/resend"),
        json!({ "value": "234567890123" }),
    )
    .await;
    assert_eq!(s, StatusCode::OK);
    let (s, done) = call(
        &app,
        &csrf,
        &format!("/api/abdm/abha/verifications/{id}/otp"),
        json!({ "otp": "123456" }),
    )
    .await;
    assert_eq!(
        (s, done["stage"].as_str()),
        (StatusCode::OK, Some("verified")),
        "{done}"
    );

    let (_, none) = call(
        &app,
        &csrf,
        "/api/abdm/abha/verifications",
        json!({ "method": "aadhaar", "value": NO_ABHA_AADHAAR }),
    )
    .await;
    let none_id = none["id"].as_str().expect("id").to_owned();
    let (s, said) = call(
        &app,
        &csrf,
        &format!("/api/abdm/abha/verifications/{none_id}/otp"),
        json!({ "otp": "123456" }),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    assert!(
        said.to_string()
            .contains("no ABHA is linked to this Aadhaar"),
        "{said}"
    );
}

/// Given ABDM refuses with a code, Then staff read what to do — not
/// "Invalid TransactionId" — with the code kept for support.
#[tokio::test]
async fn an_abdm_error_code_reads_as_a_fix() {
    let _serial = SERIAL.lock().await;
    let (app, csrf, _mock) = app_with_keys().await;
    let (_, step) = call(
        &app,
        &csrf,
        "/api/abdm/abha/verifications",
        json!({ "method": "abha_number", "value": NUMBER, "otp_via": "abdm" }),
    )
    .await;
    let id = step["id"].as_str().expect("id").to_owned();
    let (s, said) = call(
        &app,
        &csrf,
        &format!("/api/abdm/abha/verifications/{id}/otp"),
        json!({ "otp": EXPIRED_OTP }),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let text = said.to_string();
    assert!(
        text.contains("This ABDM step has expired. Start again"),
        "{text}"
    );
    assert!(text.contains("(code ABDM-1017)"), "{text}");
}

/// Given an ABHA card's QR (or something else), Then the desk gets the
/// number and address to verify — or is told it is not an ABHA card.
#[tokio::test]
async fn a_card_qr_names_the_abha_to_verify() {
    let _serial = SERIAL.lock().await;
    let (app, csrf, _mock) = app_with_keys().await;
    let card = r#"{"hidn":"91-4173-3253-1234","hid":"asha@abdm","name":"Asha Rao","gender":"F","dob":"1-1-1990"}"#;
    let (s, read) = call(&app, &csrf, "/api/abdm/abha/qr", json!({ "payload": card })).await;
    assert_eq!(s, StatusCode::OK, "{read}");
    assert_eq!(
        (read["abha_number"].as_str(), read["gender"].as_str()),
        (Some("91-4173-3253-1234"), Some("female"))
    );
    let (s, _) = call(
        &app,
        &csrf,
        "/api/abdm/abha/qr",
        json!({ "payload": "upi://pay?pa=shop@okbank" }),
    )
    .await;
    assert_eq!(s, StatusCode::BAD_REQUEST);
}

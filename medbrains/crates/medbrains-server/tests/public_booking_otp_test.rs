//! The public booking phone check: wrong codes count, and sending is bounded.
//!
//! A wrong code was counted inside the booking transaction, which the refusal
//! then rolled back, so the count never grew. And asking for a code had no cap
//! per mobile or per address, each request an SMS on the hospital's account.

use crate::common;

use reqwest::StatusCode;
use serde_json::json;
use uuid::Uuid;

const PHONE: &str = "+919800011122";

/// A hospital of its own with public booking and its phone check switched on.
async fn a_bookable_hospital(app: &common::TestApp) -> String {
    let code = format!(
        "PB{}",
        Uuid::new_v4().simple().to_string()[..10].to_uppercase()
    );
    let tenant: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Public Booking Hospital', 'multi_specialty') RETURNING id",
    )
    .bind(&code)
    .fetch_one(&app.db)
    .await
    .expect("tenant");
    for key in ["public_booking_enabled", "public_booking_otp_required"] {
        sqlx::query(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) \
             VALUES ($1, 'appointments', $2, 'true'::jsonb) \
             ON CONFLICT (tenant_id, category, key) DO UPDATE SET value = EXCLUDED.value, \
               deleted_at = NULL",
        )
        .bind(tenant)
        .bind(key)
        .execute(&app.db)
        .await
        .expect("setting");
    }
    code
}

/// Book with `otp`; the slot itself never matters, verification comes first.
async fn book_with(app: &common::TestApp, hospital: &str, otp: &str) -> StatusCode {
    let body = json!({
        "tenant_code": hospital, "doctor_id": Uuid::new_v4(), "department_id": Uuid::new_v4(),
        "appointment_date": "2030-01-02", "slot_start": "10:00:00", "slot_end": "10:15:00",
        "patient_name": "Asha", "patient_phone": PHONE, "otp": otp,
    });
    app.post_json(&app.client, "/api/public/appointments/book", &body)
        .await
        .status()
}

/// Ask for a code from `address`.
async fn ask_from(app: &common::TestApp, hospital: &str, address: &str) -> StatusCode {
    app.client
        .post(app.url("/api/public/appointments/otp"))
        .header("x-forwarded-for", address)
        .json(&json!({ "tenant_code": hospital, "patient_phone": PHONE }))
        .send()
        .await
        .expect("ask")
        .status()
}

/// The attempt counts of the codes the hospital holds for the mobile.
async fn codes(app: &common::TestApp, hospital: &str) -> Vec<i32> {
    sqlx::query_scalar(
        "SELECT o.attempts FROM public_booking_otps o JOIN tenants t ON t.id = o.tenant_id \
          WHERE t.code = $1 AND o.phone = $2 ORDER BY o.created_at",
    )
    .bind(hospital)
    .bind(PHONE)
    .fetch_all(&app.db)
    .await
    .expect("codes")
}

/// Given a code was sent, When five wrong codes are tried, Then each is counted
/// and the right code no longer verifies.
#[tokio::test]
async fn wrong_booking_codes_are_counted_and_burn_the_code() {
    let app = common::spawn_app().await;
    let hospital = a_bookable_hospital(&app).await;
    sqlx::query(
        "INSERT INTO public_booking_otps (tenant_id, phone, otp_hash, expires_at) \
         SELECT id, $2, encode(sha256('123456'::bytea), 'hex'), now() + interval '10 minutes' \
           FROM tenants WHERE code = $1",
    )
    .bind(&hospital)
    .bind(PHONE)
    .execute(&app.db)
    .await
    .expect("code");

    for _ in 0..5 {
        assert_eq!(
            book_with(&app, &hospital, "000000").await,
            StatusCode::BAD_REQUEST
        );
    }
    assert_eq!(
        codes(&app, &hospital).await,
        vec![5],
        "every wrong code counts"
    );
    assert_eq!(
        book_with(&app, &hospital, "123456").await,
        StatusCode::BAD_REQUEST,
        "a code guessed at five times is spent"
    );
}

/// Given one mobile, When codes are asked for again and again from many
/// addresses, Then only its share is sent.
#[tokio::test]
async fn one_mobile_is_sent_only_its_share_of_codes() {
    let app = common::spawn_app().await;
    let hospital = a_bookable_hospital(&app).await;
    for n in 0..6 {
        let status = ask_from(&app, &hospital, &format!("203.0.113.{}", 10 + n)).await;
        assert_eq!(status, StatusCode::OK, "the answer never changes");
    }
    assert_eq!(codes(&app, &hospital).await.len(), 3);
}

/// Given one address, When it asks for codes past the limit, Then it is refused.
#[tokio::test]
async fn one_address_cannot_ask_for_codes_without_limit() {
    let app = common::spawn_app().await;
    let hospital = a_bookable_hospital(&app).await;
    for _ in 0..5 {
        assert_eq!(
            ask_from(&app, &hospital, "198.51.100.40").await,
            StatusCode::OK
        );
    }
    assert_eq!(
        ask_from(&app, &hospital, "198.51.100.40").await,
        StatusCode::TOO_MANY_REQUESTS
    );
}

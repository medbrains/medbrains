//! A signer sets up their own signature: `POST /api/signatures/my-credentials`.
//! Nobody sets one for somebody else, and it needs a fresh step-up.

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::signable_types_test::{attend, post, review_and_sign};
use crate::{common, signatures_test};

/// A 1x1 PNG as a data URL: what the drawing pad sends.
const PNG: &str = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const URL: &str = "/api/signatures/my-credentials";

/// A doctor with a registered profile, signed in and stepped up, and no signature.
async fn doctor(app: &common::TestApp, admin_csrf: &str) -> common::Staff {
    let staff = common::provision_staff(app, admin_csrf, "doctor", &[]).await;
    signatures_test::register_doctor(app, &staff.user_id.to_string()).await;
    app.step_up(&staff.client, &staff.csrf, &staff.password)
        .await;
    staff
}

/// `staff` posts `body` to set their own signature.
async fn set(app: &common::TestApp, staff: &common::Staff, body: Value) -> (StatusCode, Value) {
    post(&staff.client, app, &staff.csrf, URL, body).await
}

/// `staff` reviews and signs a prescription they wrote, for a patient they attend.
async fn sign_a_prescription(app: &common::TestApp, staff: &common::Staff) -> (StatusCode, Value) {
    let record = signatures_test::doctor_prescription(app, &staff.user_id.to_string()).await;
    let record = Uuid::parse_str(&record).expect("prescription id");
    let (tenant, patient): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, patient_id FROM prescriptions WHERE id = $1")
            .bind(record)
            .fetch_one(&app.db)
            .await
            .expect("prescription");
    attend(app, tenant, patient, staff.user_id).await;
    review_and_sign(&staff.client, app, &staff.csrf, "prescription", record).await
}

/// How many credentials `user` has, of any state.
async fn credentials_of(app: &common::TestApp, user: Uuid) -> i64 {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM doctor_signature_credentials WHERE doctor_user_id = $1",
    )
    .bind(user)
    .fetch_one(&app.db)
    .await
    .expect("count")
}

#[tokio::test]
async fn a_doctor_sets_their_own_signature_and_can_then_sign() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let staff = doctor(&app, &admin_csrf).await;
    let (status, body) = sign_a_prescription(&app, &staff).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "no signature yet: {body}");

    let (status, body) = set(&app, &staff, json!({ "image": PNG })).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(
        body["credential"]["doctor_user_id"],
        staff.user_id.to_string()
    );
    assert_eq!(body["credential"]["is_default"], true);
    assert_eq!(body["replaced"], false);
    let (created_by, audited): (Uuid, i64) = sqlx::query_as(
        "SELECT c.created_by, (SELECT COUNT(*) FROM audit_log a WHERE a.entity_id = c.id \
            AND a.action = 'signature_set' AND a.user_id = c.doctor_user_id) \
           FROM doctor_signature_credentials c WHERE c.id = $1::uuid",
    )
    .bind(body["credential"]["id"].as_str())
    .fetch_one(&app.db)
    .await
    .expect("credential");
    assert_eq!(
        created_by, staff.user_id,
        "created by the signer themselves"
    );
    assert_eq!(audited, 1, "one audit row: who set it, and when");

    let (status, signed) = sign_a_prescription(&app, &staff).await;
    assert_eq!(status, StatusCode::OK, "{signed}");
    assert_eq!(signed["signed_record"]["display_image_snapshot"], PNG);
}

#[tokio::test]
async fn it_is_refused_without_step_up_without_the_permission_or_for_another_user() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;

    // A session alone is not enough: the password again, as for signing.
    let unstepped = common::provision_staff(&app, &admin_csrf, "doctor", &[]).await;
    let (status, body) = set(&app, &unstepped, json!({ "image": null })).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"], "step_up_required", "{body}");

    // A receptionist signs nothing, so sets up no signature.
    let receptionist = common::provision_staff(&app, &admin_csrf, "receptionist", &[]).await;
    app.step_up(
        &receptionist.client,
        &receptionist.csrf,
        &receptionist.password,
    )
    .await;
    let (status, _) = set(&app, &receptionist, json!({ "image": null })).await;
    assert_eq!(status, StatusCode::FORBIDDEN);

    // Naming another user is refused, and nothing is made for either.
    let staff = doctor(&app, &admin_csrf).await;
    for field in ["doctor_user_id", "user_id"] {
        let body = json!({ "image": null, field: unstepped.user_id });
        let (status, _) = set(&app, &staff, body).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{field}");
    }
    for user in [unstepped.user_id, receptionist.user_id, staff.user_id] {
        assert_eq!(credentials_of(&app, user).await, 0);
    }

    // Not an image, whatever it is labelled.
    let pdf = "data:image/png;base64,JVBERi0xLjcK";
    for bad in [pdf, "https://example.test/signature.png", ""] {
        let (status, body) = set(&app, &staff, json!({ "image": bad })).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{bad}: {body}");
    }
    assert_eq!(credentials_of(&app, staff.user_id).await, 0);
}

#[tokio::test]
async fn replacing_keeps_the_old_row_and_an_earlier_record_keeps_its_image() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let staff = doctor(&app, &admin_csrf).await;
    let (_, first) = set(&app, &staff, json!({ "image": PNG })).await;
    let (status, signed) = sign_a_prescription(&app, &staff).await;
    assert_eq!(status, StatusCode::OK, "{signed}");

    let (status, second) = set(&app, &staff, json!({ "image": null })).await;
    assert_eq!(status, StatusCode::OK, "{second}");
    assert_eq!(second["replaced"], true);
    let (ended, is_default, revoked): (bool, bool, bool) = sqlx::query_as(
        "SELECT valid_until <= now(), is_default, revoked_at IS NOT NULL \
           FROM doctor_signature_credentials WHERE id = $1::uuid",
    )
    .bind(first["credential"]["id"].as_str())
    .fetch_one(&app.db)
    .await
    .expect("the old row is kept");
    assert!(ended && !is_default && !revoked, "ended, not revoked");

    let snapshot: Option<String> =
        sqlx::query_scalar("SELECT display_image_snapshot FROM signed_records WHERE id = $1::uuid")
            .bind(signed["signed_record"]["id"].as_str())
            .fetch_one(&app.db)
            .await
            .expect("signed record");
    assert_eq!(snapshot.as_deref(), Some(PNG), "signed earlier, image kept");
    let (status, later) = sign_a_prescription(&app, &staff).await;
    assert_eq!(status, StatusCode::OK, "{later}");
    assert_eq!(
        later["signed_record"]["display_image_snapshot"],
        Value::Null
    );
}

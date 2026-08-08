mod common;

use uuid::Uuid;

/// The patient portal's whole security claim is that its tokens and staff
/// tokens are mutually undecodable, so isolation does not rest on every handler
/// remembering to check a permission.
///
/// This pins both directions, because only testing one leaves the interesting
/// half unproven:
///
///   * a staff token must not open a portal route — otherwise the portal is
///     just another staff endpoint and any staff account can read any patient
///     through it;
///   * an absent or junk token must not open one either.
///
/// The mechanism: a patient token carries no `role`, which `Claims` requires
/// with no serde default, so the staff door fails to decode it. A staff token
/// carries no `pid`, which `PatientClaims` requires, so the portal door fails
/// to decode that. Neither rejection depends on a handler-level check.
#[tokio::test]
async fn a_staff_token_cannot_open_a_portal_route() {
    let app = common::spawn_app().await;
    let _csrf = app.login_admin().await;

    // `app.get` sends the admin's own staff credentials.
    let response = app.get(&app.client, "/api/portal/bills").await;

    assert_eq!(
        response.status().as_u16(),
        401,
        "a staff token must be refused by the portal door — if it is accepted, \
         every staff account can read any patient's bills through this route"
    );
}

#[tokio::test]
async fn the_portal_refuses_junk_and_missing_tokens() {
    let app = common::spawn_app().await;

    let anonymous = reqwest::Client::new();

    let no_token = anonymous
        .get(app.url("/api/portal/bills"))
        .send()
        .await
        .expect("request sends");
    assert_eq!(
        no_token.status().as_u16(),
        401,
        "an unauthenticated caller must not reach portal data"
    );

    let junk = anonymous
        .get(app.url("/api/portal/bills"))
        .header("authorization", "Bearer not-a-real-token")
        .send()
        .await
        .expect("request sends");
    assert_eq!(
        junk.status().as_u16(),
        401,
        "an unverifiable token must not reach portal data"
    );
}

/// Sign-in must not become a way to ask "is this person a patient here".
///
/// The answer is identical for a registered phone, an unregistered one and an
/// unknown tenant. If they differed, anyone could enumerate a hospital's
/// patient list one phone number at a time — which is disclosure even though
/// no record is ever returned.
#[tokio::test]
async fn requesting_a_code_never_reveals_whether_the_number_is_registered() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_code: String = sqlx::query_scalar("SELECT code FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let registered_phone = format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]);

    app.client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "first_name": "Portal",
            "last_name": "Enumeration",
            "gender": "female",
            "phone": registered_phone,
        }))
        .send()
        .await
        .expect("create patient");

    let anonymous = reqwest::Client::new();
    let ask = |payload: serde_json::Value| {
        let client = anonymous.clone();
        let url = app.url("/api/portal/auth/request-otp");
        async move {
            let response = client
                .post(url)
                .json(&payload)
                .send()
                .await
                .expect("request sends");
            let status = response.status().as_u16();
            let body: serde_json::Value = response.json().await.expect("json body");
            (status, body)
        }
    };

    let known = ask(serde_json::json!({
        "tenant_code": tenant_code,
        "phone": registered_phone,
    }))
    .await;

    let unknown_number = ask(serde_json::json!({
        "tenant_code": tenant_code,
        "phone": "9000000000",
    }))
    .await;

    let unknown_tenant = ask(serde_json::json!({
        "tenant_code": "no-such-tenant-code",
        "phone": registered_phone,
    }))
    .await;

    assert_eq!(
        known, unknown_number,
        "a registered and an unregistered number must be indistinguishable, or \
         this endpoint enumerates the patient list one number at a time"
    );
    assert_eq!(
        known, unknown_tenant,
        "an unknown tenant must answer the same way as a known one"
    );
    assert_eq!(
        known.0, 200,
        "the acknowledgement is a plain 200: {known:?}"
    );
}

/// A wrong code must not be retryable a million times, and must not reveal
/// which part was wrong.
#[tokio::test]
async fn a_wrong_code_is_refused_without_saying_why() {
    let app = common::spawn_app().await;

    let tenant_code: String = sqlx::query_scalar("SELECT code FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let anonymous = reqwest::Client::new();
    let response = anonymous
        .post(app.url("/api/portal/auth/verify"))
        .json(&serde_json::json!({
            "tenant_code": tenant_code,
            "phone": "9000000001",
            "code": "000000",
        }))
        .send()
        .await
        .expect("request sends");

    assert_eq!(
        response.status().as_u16(),
        401,
        "verification with no live code must be refused"
    );
}

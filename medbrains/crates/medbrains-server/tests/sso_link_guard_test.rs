//! Linking an account to a Kanidm person hands whoever controls that person the account, so the link screen
//! must never hand its caller more than they hold. IT (who holds `admin.users.link_identity` but is not an
//! administrator) may link only an account whose permissions are all theirs and include no `admin.*`; a linked
//! account is never re-pointed, only unlinked, and only an administrator unlinks; the holder is told, in the
//! app and by email, of every link made or removed.

use crate::common;

use reqwest::{Client, StatusCode};
use uuid::Uuid;

const PERSON_A: &str = "0a0a0a0a-0000-4000-8000-00000000000a";
const PERSON_B: &str = "0b0b0b0b-0000-4000-8000-00000000000b";
const PERSON_C: &str = "0c0c0c0c-0000-4000-8000-00000000000c";

async fn put_link(
    app: &common::TestApp,
    client: &Client,
    csrf: &str,
    user: Uuid,
    subject: &str,
) -> StatusCode {
    client
        .put(app.url(&format!("/api/admin/users/{user}/sso-link")))
        .header("x-csrf-token", csrf)
        .json(&serde_json::json!({ "subject": subject }))
        .send()
        .await
        .expect("link")
        .status()
}

async fn delete_link(app: &common::TestApp, client: &Client, csrf: &str, user: Uuid) -> StatusCode {
    client
        .delete(app.url(&format!("/api/admin/users/{user}/sso-link")))
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("unlink")
        .status()
}

/// The titles of the security notices this account's holder has been sent.
async fn notices(app: &common::TestApp, user: Uuid) -> Vec<String> {
    sqlx::query_scalar(
        "SELECT title FROM notifications WHERE user_id = $1 AND category = 'Security' ORDER BY created_at",
    )
    .bind(user)
    .fetch_all(&app.db)
    .await
    .expect("notices")
}

async fn email_of(app: &common::TestApp, user: Uuid) -> String {
    sqlx::query_scalar("SELECT email FROM users WHERE id = $1")
        .bind(user)
        .fetch_one(&app.db)
        .await
        .expect("email")
}

#[tokio::test]
async fn a_link_never_hands_it_more_than_it_holds_and_the_holder_is_told() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let existing: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM identity_providers WHERE tenant_id = $1 AND code = 'kanidm'",
    )
    .bind(tenant)
    .fetch_optional(&app.db)
    .await
    .expect("provider");
    let made_provider = existing.is_none();
    if made_provider {
        sqlx::query(
            "INSERT INTO identity_providers (tenant_id, code, name, protocol, is_active, discovery_url) \
             VALUES ($1, 'kanidm', 'Kanidm', 'oidc', true, \
                     'https://idm.medbrains.local:9443/oauth2/openid/medbrains/.well-known/openid-configuration')",
        )
        .bind(tenant)
        .execute(&app.db)
        .await
        .expect("kanidm provider");
    }

    // "IT" here is a nurse granted the link permission (the harness's usernames are too short for the
    // it_security_officer role's name), so a plain nurse holds nothing IT does not, and a doctor does.
    let it = common::provision_staff_with(
        &app,
        &admin_csrf,
        "nurse",
        &[medbrains_core::permissions::admin::users::LINK_IDENTITY],
        &[],
    )
    .await;
    let nurse = common::provision_staff_with(&app, &admin_csrf, "nurse", &[], &[]).await;
    let nurse_admin =
        common::provision_staff_with(&app, &admin_csrf, "nurse", &["admin.users.create"], &[])
            .await;
    let doctor = common::provision_staff(&app, &admin_csrf, "doctor", &[]).await;

    // 1. Only an account within IT's own permissions, holding no admin.*, is linkable by IT.
    assert_eq!(
        put_link(&app, &it.client, &it.csrf, doctor.user_id, PERSON_C).await,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        put_link(&app, &it.client, &it.csrf, nurse_admin.user_id, PERSON_C).await,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        put_link(&app, &it.client, &it.csrf, it.user_id, PERSON_C).await,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        put_link(&app, &it.client, &it.csrf, nurse.user_id, PERSON_A).await,
        StatusCode::OK
    );

    // 2. A linked account is never re-pointed; the same link again changes nothing.
    assert_eq!(
        put_link(&app, &it.client, &it.csrf, nurse.user_id, PERSON_B).await,
        StatusCode::CONFLICT
    );
    assert_eq!(
        put_link(&app, &app.client, &admin_csrf, nurse.user_id, PERSON_B).await,
        StatusCode::CONFLICT
    );
    assert_eq!(
        put_link(&app, &it.client, &it.csrf, nurse.user_id, PERSON_A).await,
        StatusCode::OK
    );
    //    Only an administrator unlinks.
    assert_eq!(
        delete_link(&app, &it.client, &it.csrf, nurse.user_id).await,
        StatusCode::FORBIDDEN
    );
    let still: Option<String> =
        sqlx::query_scalar("SELECT external_subject FROM users WHERE id = $1")
            .bind(nurse.user_id)
            .fetch_one(&app.db)
            .await
            .expect("subject");
    assert_eq!(still.as_deref(), Some(PERSON_A));
    assert_eq!(
        delete_link(&app, &app.client, &admin_csrf, nurse.user_id).await,
        StatusCode::OK
    );
    //    An administrator may link anyone, the doctor included.
    assert_eq!(
        put_link(&app, &app.client, &admin_csrf, doctor.user_id, PERSON_C).await,
        StatusCode::OK
    );

    // 3. The holder is told of the link and of its removal — once each, not for the repeated link — and by
    //    email too; nobody is told of a refused change.
    assert_eq!(
        notices(&app, nurse.user_id).await,
        [
            "Your account was linked to a sign-in",
            "Your account's sign-in link was removed"
        ]
    );
    let nurse_mail = app
        .outbox_rows("email.account_link", &email_of(&app, nurse.user_id).await)
        .await;
    assert_eq!(nurse_mail.len(), 2, "{nurse_mail:?}");
    assert_eq!(
        nurse_mail[0]["subject"],
        "Your account was linked to a sign-in"
    );
    assert!(notices(&app, nurse_admin.user_id).await.is_empty());
    assert_eq!(
        notices(&app, doctor.user_id).await,
        ["Your account was linked to a sign-in"]
    );

    assert_eq!(
        delete_link(&app, &app.client, &admin_csrf, doctor.user_id).await,
        StatusCode::OK
    );
    if made_provider {
        sqlx::query("DELETE FROM identity_providers WHERE tenant_id = $1 AND code = 'kanidm'")
            .bind(tenant)
            .execute(&app.db)
            .await
            .expect("drop provider");
    }
}

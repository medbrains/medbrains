//! Linking an account to a Kanidm person hands whoever controls that person the account, so only an
//! administrator (a bypass role, on top of `admin.users.link_identity`) links, unlinks or searches the directory;
//! a permission granted any other way is refused. An administrator's account links only to a person in Kanidm's
//! high-privilege group; a linked account is never re-pointed, only unlinked; the holder is told of every link
//! made or removed. A linked account keeps its local password for step-up but cannot sign in with it, except
//! the setup administrator's break-glass, and the OS's own Kanidm provider row cannot be changed through the
//! admin API.

use crate::common;

use reqwest::{Client, StatusCode};
use uuid::Uuid;

const PERSON_A: &str = "0a0a0a0a-0000-4000-8000-00000000000a";
const PERSON_B: &str = "0b0b0b0b-0000-4000-8000-00000000000b";
const PERSON_C: &str = "0c0c0c0c-0000-4000-8000-00000000000c";
const PERSON_E: &str = "0e0e0e0e-0000-4000-8000-00000000000e";

pub(crate) async fn put_link(
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

/// The account's Kanidm subject and whether it still has a local password.
pub(crate) async fn link_state(app: &common::TestApp, user: Uuid) -> (Option<String>, bool) {
    sqlx::query_as("SELECT external_subject, password_hash IS NOT NULL FROM users WHERE id = $1")
        .bind(user)
        .fetch_one(&app.db)
        .await
        .expect("link state")
}

/// A password sign-in's status and body.
pub(crate) async fn password_login(
    app: &common::TestApp,
    username: &str,
    password: &str,
) -> (StatusCode, String) {
    let resp = Client::new()
        .post(app.url("/api/auth/login"))
        .json(&serde_json::json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login");
    (resp.status(), resp.text().await.unwrap_or_default())
}

pub(crate) async fn username_of(app: &common::TestApp, user: Uuid) -> String {
    sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(user)
        .fetch_one(&app.db)
        .await
        .expect("username")
}

/// The tenant of the seeded admin, and its Kanidm provider (made here if missing, and whether it was).
pub(crate) async fn kanidm_provider(app: &common::TestApp) -> (Uuid, Uuid, bool) {
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
    if let Some(id) = existing {
        return (tenant, id, false);
    }
    let id = sqlx::query_scalar(
        "INSERT INTO identity_providers (tenant_id, code, name, protocol, is_active, discovery_url, client_id) \
         VALUES ($1, 'kanidm', 'Kanidm', 'oidc', true, \
                 'https://idm.medbrains.local:9443/oauth2/openid/medbrains/.well-known/openid-configuration', \
                 'medbrains') RETURNING id",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("kanidm provider");
    (tenant, id, true)
}

pub(crate) async fn drop_provider(app: &common::TestApp, tenant: Uuid, made: bool) {
    if made {
        sqlx::query("DELETE FROM identity_providers WHERE tenant_id = $1 AND code = 'kanidm'")
            .bind(tenant)
            .execute(&app.db)
            .await
            .expect("drop provider");
    }
}

/// The status of a GET as this client.
async fn get_status(app: &common::TestApp, client: &Client, path: &str) -> StatusCode {
    client
        .get(app.url(path))
        .send()
        .await
        .expect("get")
        .status()
}

#[tokio::test]
async fn only_an_administrator_links_and_the_holder_is_told() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let (tenant, _, made_provider) = kanidm_provider(&app).await;

    // A non-administrator granted the link permission through `access_matrix.extra` is still refused, on every
    // link route, and nothing is written.
    let it = common::provision_staff_with(
        &app,
        &admin_csrf,
        "nurse",
        &[medbrains_core::permissions::admin::users::LINK_IDENTITY],
        &[],
    )
    .await;
    let nurse = common::provision_staff(&app, &admin_csrf, "nurse", &[]).await;
    let nurse_admin =
        common::provision_staff_with(&app, &admin_csrf, "nurse", &["admin.users.create"], &[])
            .await;
    let doctor = common::provision_staff(&app, &admin_csrf, "doctor", &[]).await;
    let link_path = format!("/api/admin/users/{}/sso-link", nurse.user_id);
    for path in ["/api/admin/identity/kanidm/people?q=", link_path.as_str()] {
        assert_eq!(
            get_status(&app, &it.client, path).await,
            StatusCode::FORBIDDEN,
            "{path}"
        );
    }
    assert_eq!(
        put_link(&app, &it.client, &it.csrf, nurse.user_id, PERSON_A).await,
        StatusCode::FORBIDDEN
    );
    assert_eq!(link_state(&app, nurse.user_id).await, (None, true));

    // 1. An administrator links; the account keeps its local password (step-up), and the password form sends it
    //    to Kanidm.
    assert_eq!(
        put_link(&app, &app.client, &admin_csrf, nurse.user_id, PERSON_A).await,
        StatusCode::OK
    );
    assert_eq!(
        link_state(&app, nurse.user_id).await,
        (Some(PERSON_A.to_owned()), true)
    );
    let (status, body) = password_login(
        &app,
        &username_of(&app, nurse.user_id).await,
        &nurse.password,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    assert!(body.contains("MedBrains account"), "{body}");
    assert_eq!(
        delete_link(&app, &it.client, &it.csrf, nurse.user_id).await,
        StatusCode::FORBIDDEN
    );

    // 2. A linked account is never re-pointed; the same link again changes nothing; an administrator unlinks.
    assert_eq!(
        put_link(&app, &app.client, &admin_csrf, nurse.user_id, PERSON_B).await,
        StatusCode::CONFLICT
    );
    assert_eq!(
        put_link(&app, &app.client, &admin_csrf, nurse.user_id, PERSON_A).await,
        StatusCode::OK
    );
    assert_eq!(
        delete_link(&app, &app.client, &admin_csrf, nurse.user_id).await,
        StatusCode::OK
    );
    assert_eq!(
        put_link(&app, &app.client, &admin_csrf, doctor.user_id, PERSON_C).await,
        StatusCode::OK
    );
    //    An administrator's account needs a Kanidm person in the high-privilege group, as the directory says;
    //    with no directory to ask, the link is refused and nothing is written.
    assert_ne!(
        put_link(
            &app,
            &app.client,
            &admin_csrf,
            nurse_admin.user_id,
            PERSON_E
        )
        .await,
        StatusCode::OK
    );
    assert_eq!(link_state(&app, nurse_admin.user_id).await, (None, true));

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
    drop_provider(&app, tenant, made_provider).await;
}

/// The setup administrator keeps a password beside its Kanidm link, as the one audited break-glass; any other
/// linked account's password, even one that survived the link, no longer signs in. The OS's own Kanidm row
/// cannot be created, changed or deleted through the admin API, and provider changes need their own permission.
#[tokio::test]
async fn only_the_setup_admin_keeps_a_password_and_the_kanidm_row_is_pinned() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let (tenant, provider, made_provider) = kanidm_provider(&app).await;
    let link_by_hand = |user: Uuid, subject: &'static str| {
        sqlx::query("UPDATE users SET idp_id = $2, external_subject = $3 WHERE id = $1")
            .bind(user)
            .bind(provider)
            .bind(subject)
            .execute(&app.db)
    };
    let unlink_by_hand = |user: Uuid| {
        sqlx::query("UPDATE users SET idp_id = NULL, external_subject = NULL WHERE id = $1")
            .bind(user)
            .execute(&app.db)
    };

    // A nurse linked the way kanidm-setup links (by SQL, password kept) still cannot use the password.
    let nurse = common::provision_staff(&app, &admin_csrf, "nurse", &[]).await;
    link_by_hand(nurse.user_id, PERSON_B)
        .await
        .expect("link nurse");
    let (status, body) = password_login(
        &app,
        &username_of(&app, nurse.user_id).await,
        &nurse.password,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    unlink_by_hand(nurse.user_id).await.expect("unlink nurse");

    // The setup administrator, linked the same way, signs in with its password, audited as the break-glass.
    let admin_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin");
    let before: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE user_id = $1 AND action = 'break_glass_password_login'",
    )
    .bind(admin_id)
    .fetch_one(&app.db)
    .await
    .expect("count");
    link_by_hand(admin_id, PERSON_A).await.expect("link admin");
    let (status, body) = password_login(&app, "admin", "admin123").await;
    unlink_by_hand(admin_id).await.expect("unlink admin");
    assert_eq!(status, StatusCode::OK, "{body}");
    let after: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE user_id = $1 AND action = 'break_glass_password_login'",
    )
    .bind(admin_id)
    .fetch_one(&app.db)
    .await
    .expect("count");
    assert_eq!(after, before + 1);

    // The Kanidm row: no change, no delete, no second one, and its discovery URL is what setup wrote.
    let row_url = || {
        sqlx::query_scalar::<_, Option<String>>(
            "SELECT discovery_url FROM identity_providers WHERE id = $1",
        )
        .bind(provider)
        .fetch_one(&app.db)
    };
    let url_before = row_url().await.expect("url");
    let edit = app
        .client
        .put(app.url(&format!("/api/admin/sso/providers/{provider}")))
        .header("x-csrf-token", &admin_csrf)
        .json(&serde_json::json!({ "discovery_url": "https://evil.example/.well-known/openid-configuration" }))
        .send()
        .await
        .expect("edit");
    assert_eq!(edit.status(), StatusCode::FORBIDDEN);
    let delete = app
        .client
        .delete(app.url(&format!("/api/admin/sso/providers/{provider}")))
        .header("x-csrf-token", &admin_csrf)
        .send()
        .await
        .expect("delete");
    assert_eq!(delete.status(), StatusCode::FORBIDDEN);
    let create = app
        .client
        .post(app.url("/api/admin/sso/providers"))
        .header("x-csrf-token", &admin_csrf)
        .json(&serde_json::json!({ "code": "kanidm", "name": "Fake", "protocol": "oidc" }))
        .send()
        .await
        .expect("create");
    assert_eq!(create.status(), StatusCode::FORBIDDEN);
    assert_eq!(row_url().await.expect("url"), url_before);

    // Changing any provider needs admin.sso.providers.manage, not the general-settings code.
    let settings_only = common::provision_staff_with(
        &app,
        &admin_csrf,
        "receptionist",
        &["admin.settings.general.manage"],
        &[],
    )
    .await;
    let create = settings_only
        .client
        .post(app.url("/api/admin/sso/providers"))
        .header("x-csrf-token", &settings_only.csrf)
        .json(&serde_json::json!({ "code": "partner", "name": "Partner", "protocol": "oidc" }))
        .send()
        .await
        .expect("create");
    assert_eq!(create.status(), StatusCode::FORBIDDEN);
    drop_provider(&app, tenant, made_provider).await;
}

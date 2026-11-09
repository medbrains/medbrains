//! What a directory-group mapping or a provider hands out, and what a Kanidm sign-in into an administrator's
//! account must show.
//!
//! Only an administrator (a bypass role, on top of `admin.sso.providers.manage`) creates, changes or deletes a
//! provider or a mapping; the permission granted any other way is refused. A mapping never names an
//! administrator role, and one stored some other way grants nothing at sign-in. A Kanidm sign-in into an
//! administrator's account goes on only when its person is in `mb_it_admins`, and stops when that cannot be
//! read. A linked account keeps its password for step-up inside a session but cannot sign in with it.

use crate::common;
use crate::sso_link_guard_test::{
    drop_provider, kanidm_provider, link_state, password_login, put_link, username_of,
};

use medbrains_core::permissions::admin::sso::providers::MANAGE;
use medbrains_server_core::error::AppError;
use reqwest::{Client, StatusCode};
use std::sync::atomic::{AtomicBool, Ordering};
use uuid::Uuid;

const PERSON_F: &str = "0f0f0f0f-0000-4000-8000-00000000000f";
const PERSON_G: &str = "10101010-0000-4000-8000-000000000010";

/// POSTs `body` to `path` as this client, returning the status and the JSON answer.
async fn post(
    app: &common::TestApp,
    client: &Client,
    csrf: &str,
    path: &str,
    body: serde_json::Value,
) -> (StatusCode, serde_json::Value) {
    let resp = client
        .post(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("post");
    (resp.status(), resp.json().await.unwrap_or_default())
}

async fn put_status(
    app: &common::TestApp,
    client: &Client,
    csrf: &str,
    path: &str,
    body: serde_json::Value,
) -> StatusCode {
    client
        .put(app.url(path))
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect("put")
        .status()
}

async fn delete_status(
    app: &common::TestApp,
    client: &Client,
    csrf: &str,
    path: &str,
) -> StatusCode {
    client
        .delete(app.url(path))
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("delete")
        .status()
}

#[tokio::test]
async fn only_an_administrator_manages_providers_and_mappings() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let (tenant, kanidm, made_provider) = kanidm_provider(&app).await;
    let it = common::provision_staff_with(&app, &admin_csrf, "nurse", &[MANAGE], &[]).await;
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let partner_body =
        serde_json::json!({ "code": format!("p_{tag}"), "name": "Partner", "protocol": "oidc" });

    // The permission through `access_matrix.extra` is not enough: no provider is made, changed or deleted.
    let (status, _) = post(
        &app,
        &it.client,
        &it.csrf,
        "/api/admin/sso/providers",
        partner_body.clone(),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, provider) = post(
        &app,
        &app.client,
        &admin_csrf,
        "/api/admin/sso/providers",
        partner_body,
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{provider}");
    let partner = provider["id"].as_str().expect("id").to_owned();
    let provider_path = format!("/api/admin/sso/providers/{partner}");
    let edit = serde_json::json!({ "jit_enabled": false });
    assert_eq!(
        put_status(&app, &it.client, &it.csrf, &provider_path, edit.clone()).await,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        delete_status(&app, &it.client, &it.csrf, &provider_path).await,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        put_status(&app, &app.client, &admin_csrf, &provider_path, edit).await,
        StatusCode::OK
    );

    // Mappings: never to a bypass role, and only an administrator makes or removes one, on Kanidm too.
    let map = |role: &str| serde_json::json!({ "idp_group": "staff", "role_code": role });
    for provider_id in [partner.as_str(), &kanidm.to_string()] {
        let mappings = format!("/api/admin/sso/providers/{provider_id}/mappings");
        let (status, _) = post(&app, &it.client, &it.csrf, &mappings, map("nurse")).await;
        assert_eq!(status, StatusCode::FORBIDDEN);
        let (status, _) = post(
            &app,
            &app.client,
            &admin_csrf,
            &mappings,
            map("super_admin"),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        let (status, mapping) = post(&app, &app.client, &admin_csrf, &mappings, map("nurse")).await;
        assert_eq!(status, StatusCode::OK, "{mapping}");
        let mapping_path = format!(
            "/api/admin/sso/mappings/{}",
            mapping["id"].as_str().expect("id")
        );
        assert_eq!(
            delete_status(&app, &it.client, &it.csrf, &mapping_path).await,
            StatusCode::FORBIDDEN
        );
        assert_eq!(
            delete_status(&app, &app.client, &admin_csrf, &mapping_path).await,
            StatusCode::OK
        );
    }

    assert_eq!(
        delete_status(&app, &app.client, &admin_csrf, &provider_path).await,
        StatusCode::OK
    );
    drop_provider(&app, tenant, made_provider).await;
}

/// A mapping to a bypass role written past the API (an old row, or SQL) grants nothing at sign-in; the
/// person's other mapped groups still count.
#[tokio::test]
async fn a_stored_bypass_role_mapping_grants_nothing_at_sign_in() {
    let app = common::spawn_app().await;
    let _ = app.login_admin().await;
    let (tenant, provider, made_provider) = kanidm_provider(&app).await;
    let tag = Uuid::new_v4().simple().to_string();
    let (admins, staff) = (format!("admins_{tag}"), format!("staff_{tag}"));
    for (group, role) in [
        (&admins, "super_admin"),
        (&admins, "hospital_admin"),
        (&staff, "nurse"),
    ] {
        sqlx::query(
            "INSERT INTO idp_group_mappings (tenant_id, provider_id, idp_group, role_code) VALUES ($1, $2, $3, $4)",
        )
        .bind(tenant)
        .bind(provider)
        .bind(group)
        .bind(role)
        .execute(&app.db)
        .await
        .expect("mapping");
    }

    let mut tx = app.db.begin().await.expect("tx");
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant)
        .await
        .expect("tenant");
    let only_admins = medbrains_sso_login::mapped_targets(&mut tx, provider, &[admins.clone()])
        .await
        .expect("targets");
    assert_eq!(only_admins, (None, Vec::new()));
    let both =
        medbrains_sso_login::mapped_targets(&mut tx, provider, &[admins.clone(), staff.clone()])
            .await
            .expect("targets");
    assert_eq!(both.0.as_deref(), Some("nurse"));
    tx.rollback().await.expect("rollback");

    sqlx::query("DELETE FROM idp_group_mappings WHERE provider_id = $1 AND idp_group = ANY($2)")
        .bind(provider)
        .bind(vec![admins, staff])
        .execute(&app.db)
        .await
        .expect("clean");
    drop_provider(&app, tenant, made_provider).await;
}

/// A Kanidm sign-in into an administrator's account (a bypass role, or an `admin.*` power from any source) is
/// refused unless the person is in `mb_it_admins`, and stopped, never let through, when the directory cannot be
/// read; an ordinary account never asks the directory.
#[tokio::test]
async fn a_kanidm_sign_in_to_an_administrators_account_needs_the_high_privilege_group() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let (tenant, _, made_provider) = kanidm_provider(&app).await;
    let admin_id: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("admin");
    let powered =
        common::provision_staff_with(&app, &admin_csrf, "nurse", &["admin.users.create"], &[])
            .await;
    let nurse = common::provision_staff(&app, &admin_csrf, "nurse", &[]).await;
    let decide = |user: Uuid, role: &'static str, answer: Result<bool, AppError>| {
        let db = app.db.clone();
        async move {
            medbrains_sso_login::admin_sign_in_refusal(
                &db,
                (tenant, user),
                role,
                move || async move { answer },
            )
            .await
            .expect("decision")
        }
    };

    for (user, role) in [(admin_id, "super_admin"), (powered.user_id, "nurse")] {
        assert_eq!(
            decide(user, role, Ok(false)).await,
            Some("/login?sso_error=admin_group"),
            "{role}"
        );
        let unreachable =
            AppError::ServiceUnavailable("Kanidm's directory did not answer".to_owned());
        assert_eq!(
            decide(user, role, Err(unreachable)).await,
            Some("/login?sso_error=admin_group_unchecked"),
            "{role}"
        );
        assert_eq!(decide(user, role, Ok(true)).await, None, "{role}");
    }

    let asked = AtomicBool::new(false);
    let flag = &asked;
    let ordinary = medbrains_sso_login::admin_sign_in_refusal(
        &app.db,
        (tenant, nurse.user_id),
        "nurse",
        move || async move {
            flag.store(true, Ordering::SeqCst);
            Ok(false)
        },
    )
    .await
    .expect("decision");
    assert_eq!(ordinary, None);
    assert!(!asked.load(Ordering::SeqCst));
    drop_provider(&app, tenant, made_provider).await;
}

/// A linked account keeps its password: it cannot sign in with it, even right, without saying so to a wrong
/// guess, but inside a session it still steps up to sign a record.
#[tokio::test]
async fn a_linked_account_steps_up_with_its_password_but_cannot_sign_in_with_it() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let (tenant, provider, made_provider) = kanidm_provider(&app).await;
    let nurse = common::provision_staff(&app, &admin_csrf, "nurse", &[]).await;
    let username = username_of(&app, nurse.user_id).await;

    // Linked by an administrator through the screen: the password stays.
    assert_eq!(
        put_link(&app, &app.client, &admin_csrf, nurse.user_id, PERSON_F).await,
        StatusCode::OK
    );
    assert_eq!(
        link_state(&app, nurse.user_id).await,
        (Some(PERSON_F.to_owned()), true)
    );
    let (status, body) = password_login(&app, &username, &nurse.password).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    let (status, body) = password_login(&app, &username, "not-the-password").await;
    assert_eq!(status, StatusCode::UNAUTHORIZED, "{body}");
    assert!(!body.contains("MedBrains account"), "{body}");

    // A session already open on the account (a Kanidm sign-in, here linked the way kanidm-setup links, so the
    // session stays current) steps up with the password.
    let signer = common::provision_staff(&app, &admin_csrf, "nurse", &[]).await;
    sqlx::query("UPDATE users SET idp_id = $2, external_subject = $3 WHERE id = $1")
        .bind(signer.user_id)
        .bind(provider)
        .bind(PERSON_G)
        .execute(&app.db)
        .await
        .expect("link");
    app.step_up(&signer.client, &signer.csrf, &signer.password)
        .await;
    let (status, _) = password_login(
        &app,
        &username_of(&app, signer.user_id).await,
        &signer.password,
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    sqlx::query("UPDATE users SET idp_id = NULL, external_subject = NULL WHERE id = ANY($1)")
        .bind(vec![nurse.user_id, signer.user_id])
        .execute(&app.db)
        .await
        .expect("unlink");
    drop_provider(&app, tenant, made_provider).await;
}

//! What a directory-group mapping or a provider's flags hand out, and what a Kanidm link keeps once made.
//!
//! A mapping grants its role or access group to everyone in the group at every sign-in, so it never names an
//! administrator role, and a non-administrator (IT with `admin.sso.providers.manage`) maps only what they hold
//! and nothing on the OS's own Kanidm; only an administrator lets a provider create accounts or link them by
//! email. A linked account keeps its password for step-up inside a session but cannot sign in with it, and a
//! link a non-administrator made is dropped, with its sessions, once the account's access changes.

use crate::common;
use crate::sso_link_guard_test::{
    NURSE_SIGNING, drop_provider, kanidm_provider, link_state, password_login, put_link,
    username_of,
};

use medbrains_core::permissions::admin::{sso::providers::MANAGE, users::LINK_IDENTITY};
use reqwest::{Client, StatusCode};
use uuid::Uuid;

const PERSON_F: &str = "0f0f0f0f-0000-4000-8000-00000000000f";
const PERSON_G: &str = "10101010-0000-4000-8000-000000000010";
const PERSON_H: &str = "11111111-0000-4000-8000-000000000011";
const PERSON_I: &str = "12121212-0000-4000-8000-000000000012";
const PERSON_J: &str = "13131313-0000-4000-8000-000000000013";

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

/// A new active access group in this tenant.
async fn new_group(app: &common::TestApp, tenant: Uuid) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO access_groups (tenant_id, code, name) VALUES ($1, $2, 'Mapping test group') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("map_test_{}", &Uuid::new_v4().simple().to_string()[..8]))
    .fetch_one(&app.db)
    .await
    .expect("group")
}

async fn join_group(app: &common::TestApp, tenant: Uuid, group: Uuid, user: Uuid) {
    sqlx::query(
        "INSERT INTO access_group_members (group_id, user_id, tenant_id) VALUES ($1, $2, $3)",
    )
    .bind(group)
    .bind(user)
    .bind(tenant)
    .execute(&app.db)
    .await
    .expect("member");
}

/// Signs `staff` in again on its own client: a new group membership bumps `perm_version`, ending its session.
async fn sign_in_again(app: &common::TestApp, staff: &mut common::Staff) {
    let username = username_of(app, staff.user_id).await;
    let login: serde_json::Value = staff
        .client
        .post(app.url("/api/auth/login"))
        .json(&serde_json::json!({ "username": username, "password": staff.password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    staff.csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();
}

#[tokio::test]
async fn a_mapping_or_provider_flag_never_hands_out_more_than_its_maker_holds() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let (tenant, kanidm, made_provider) = kanidm_provider(&app).await;
    let mut it = common::provision_staff_with(&app, &admin_csrf, "nurse", &[MANAGE], &[]).await;
    let tag = &Uuid::new_v4().simple().to_string()[..8];

    // Provider flags: IT may not turn on new accounts or email linking; left out, new accounts are off.
    for flags in [
        serde_json::json!({ "jit_enabled": true }),
        serde_json::json!({ "link_by_email": true }),
    ] {
        let mut body = serde_json::json!({ "code": format!("p_{tag}_x"), "name": "Partner", "protocol": "oidc" });
        body.as_object_mut()
            .expect("object")
            .extend(flags.as_object().expect("flags").clone());
        let (status, _) = post(&app, &it.client, &it.csrf, "/api/admin/sso/providers", body).await;
        assert_eq!(status, StatusCode::FORBIDDEN);
    }
    let (status, provider) = post(
        &app,
        &it.client,
        &it.csrf,
        "/api/admin/sso/providers",
        serde_json::json!({ "code": format!("p_{tag}"), "name": "Partner", "protocol": "oidc" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{provider}");
    assert_eq!(provider["jit_enabled"], false);
    let partner = provider["id"].as_str().expect("id").to_owned();
    let provider_path = format!("/api/admin/sso/providers/{partner}");
    assert_eq!(
        put_status(
            &app,
            &it.client,
            &it.csrf,
            &provider_path,
            serde_json::json!({ "jit_enabled": true })
        )
        .await,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        put_status(
            &app,
            &app.client,
            &admin_csrf,
            &provider_path,
            serde_json::json!({ "jit_enabled": true })
        )
        .await,
        StatusCode::OK
    );

    // A bypass role is never mapped, by anyone.
    let mappings = format!("/api/admin/sso/providers/{partner}/mappings");
    for (client, csrf) in [(&it.client, &it.csrf), (&app.client, &admin_csrf)] {
        let (status, _) = post(
            &app,
            client,
            csrf,
            &mappings,
            serde_json::json!({ "idp_group": "it", "role_code": "super_admin" }),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }
    // IT maps only a role within its codes, and only an access group it is in.
    let map = |role: Option<&str>, group: Option<Uuid>| serde_json::json!({ "idp_group": "staff", "role_code": role, "access_group_id": group });
    let (status, _) = post(
        &app,
        &it.client,
        &it.csrf,
        &mappings,
        map(Some("doctor"), None),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, body) = post(
        &app,
        &it.client,
        &it.csrf,
        &mappings,
        map(Some("nurse"), None),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let group = new_group(&app, tenant).await;
    let (status, _) = post(
        &app,
        &it.client,
        &it.csrf,
        &mappings,
        map(None, Some(group)),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    join_group(&app, tenant, group, it.user_id).await;
    sign_in_again(&app, &mut it).await;
    let (status, _) = post(
        &app,
        &it.client,
        &it.csrf,
        &mappings,
        map(None, Some(group)),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // On the OS's Kanidm, only an administrator creates or deletes a mapping.
    let kanidm_mappings = format!("/api/admin/sso/providers/{kanidm}/mappings");
    let (status, _) = post(
        &app,
        &it.client,
        &it.csrf,
        &kanidm_mappings,
        map(Some("nurse"), None),
    )
    .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    let (status, mapping) = post(
        &app,
        &app.client,
        &admin_csrf,
        &kanidm_mappings,
        map(Some("nurse"), None),
    )
    .await;
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

    assert_eq!(
        delete_status(&app, &app.client, &admin_csrf, &provider_path).await,
        StatusCode::OK
    );
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

/// Who linked, and whether an administrator: a link IT made is dropped, and its sessions ended, when the
/// account's department, role or access groups change; an administrator's link stays.
#[tokio::test]
async fn a_link_it_made_is_dropped_when_the_accounts_access_changes() {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let (tenant, _, made_provider) = kanidm_provider(&app).await;
    let mut it =
        common::provision_staff_with(&app, &admin_csrf, "nurse", &[LINK_IDENTITY], &[]).await;
    let mut nurses = Vec::new();
    for _ in 0..4 {
        nurses.push(
            common::provision_staff(&app, &admin_csrf, "nurse", &NURSE_SIGNING)
                .await
                .user_id,
        );
    }
    let [by_department, by_role, by_membership, by_group_codes]: [Uuid; 4] =
        nurses.clone().try_into().expect("four nurses");
    let doctor = common::provision_staff(&app, &admin_csrf, "doctor", &[])
        .await
        .user_id;
    let shared = new_group(&app, tenant).await;
    join_group(&app, tenant, shared, it.user_id).await;
    sign_in_again(&app, &mut it).await;
    join_group(&app, tenant, shared, by_group_codes).await;

    for (target, person) in [
        (by_department, PERSON_F),
        (by_role, PERSON_G),
        (by_membership, PERSON_H),
        (by_group_codes, PERSON_I),
    ] {
        assert_eq!(
            put_link(&app, &it.client, &it.csrf, target, person).await,
            StatusCode::OK
        );
    }
    assert_eq!(
        put_link(&app, &app.client, &admin_csrf, doctor, PERSON_J).await,
        StatusCode::OK
    );
    let linked_by: (Option<Uuid>, Option<bool>) =
        sqlx::query_as("SELECT sso_linked_by, sso_linked_by_admin FROM users WHERE id = $1")
            .bind(by_role)
            .fetch_one(&app.db)
            .await
            .expect("linked by");
    assert_eq!(linked_by, (Some(it.user_id), Some(false)));

    let run = |sql: &'static str, id: Uuid| sqlx::query(sql).bind(id).execute(&app.db);
    run(
        "UPDATE users SET department_ids = ARRAY[gen_random_uuid()] WHERE id = $1",
        by_department,
    )
    .await
    .expect("department");
    run(
        "UPDATE users SET role = 'receptionist' WHERE id = $1",
        by_role,
    )
    .await
    .expect("role");
    join_group(&app, tenant, new_group(&app, tenant).await, by_membership).await;
    run(
        "UPDATE access_groups SET permissions = '[\"opd.visit.view\"]'::jsonb WHERE id = $1",
        shared,
    )
    .await
    .expect("group codes");
    run(
        "UPDATE users SET department_ids = ARRAY[gen_random_uuid()] WHERE id = $1",
        doctor,
    )
    .await
    .expect("doctor department");

    for target in nurses {
        assert_eq!(link_state(&app, target).await.0, None, "{target}");
        let live: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM refresh_tokens WHERE user_id = $1 AND revoked = false",
        )
        .bind(target)
        .fetch_one(&app.db)
        .await
        .expect("sessions");
        assert_eq!(live, 0, "{target}");
    }
    assert_eq!(link_state(&app, doctor).await.0.as_deref(), Some(PERSON_J));

    run(
        "UPDATE users SET idp_id = NULL, external_subject = NULL WHERE id = $1",
        doctor,
    )
    .await
    .expect("unlink");
    drop_provider(&app, tenant, made_provider).await;
}

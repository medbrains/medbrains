use crate::common;

use medbrains_device_pairing::machine_agent::{JoinFiling, JoinState, file_request};
use uuid::Uuid;

/// A machine waiting for a person, as the agent files it, with `code` on both screens.
async fn waiting_machine(db: &sqlx::PgPool, tenant_id: Uuid, code: &str) -> (Uuid, String) {
    let id = Uuid::new_v4();
    let node_id = format!("machine-{}", id.simple());
    sqlx::query(
        "INSERT INTO device_pairing_requests \
           (id, tenant_id, device_code, user_code, app_variant, requested_label, expires_at, \
            node_id, join_code) \
         VALUES ($1, $2, $3, $3, 'Desktop-Workstation', 'Reception 1', \
                 now() + interval '10 minutes', $4, $5)",
    )
    .bind(id)
    .bind(tenant_id)
    .bind(format!("machine:{id}"))
    .bind(&node_id)
    .bind(code)
    .execute(db)
    .await
    .expect("insert request");
    (id, node_id)
}

/// How many live keys this machine has: the only thing the agent admits.
async fn live_keys(db: &sqlx::PgPool, node_id: &str) -> i64 {
    sqlx::query_scalar("SELECT count(*) FROM device_node_keys WHERE node_id = $1 AND revoked_at IS NULL")
        .bind(node_id)
        .fetch_one(db)
        .await
        .expect("count keys")
}

async fn admin_tenant(db: &sqlx::PgPool) -> Uuid {
    sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(db)
        .await
        .expect("a seeded tenant")
}

/// A wrong code must admit nothing, and a script guessing gets three tries, not a million.
#[tokio::test]
async fn a_wrong_code_admits_nothing_and_the_third_refuses_the_request() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = admin_tenant(&app.db).await;
    let (id, node_id) = waiting_machine(&app.db, tenant, "123456").await;
    let url = app.url(&format!("/api/admin/machines/requests/{id}/approve"));
    let try_code = |code: &'static str| {
        let (client, url, csrf) = (app.client.clone(), url.clone(), csrf.clone());
        async move {
            let body = serde_json::json!({ "code": code });
            let request = client.post(url).header("x-csrf-token", csrf).json(&body);
            request.send().await.expect("sends").status().as_u16()
        }
    };
    assert_eq!(try_code("000000").await, 403);
    assert_eq!(try_code("000001").await, 403);
    assert_eq!(live_keys(&app.db, &node_id).await, 0);
    assert_eq!(try_code("000002").await, 403);
    assert_eq!(try_code("123456").await, 404, "refused by now, even with the right code");
    assert_eq!(live_keys(&app.db, &node_id).await, 0);
}

/// The right code writes the same rows a device's sync key has; removal retires them at once.
#[tokio::test]
async fn approving_writes_the_key_and_removing_retires_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = admin_tenant(&app.db).await;
    let (id, node_id) = waiting_machine(&app.db, tenant, "654321").await;
    let approved: serde_json::Value = app
        .client
        .post(app.url(&format!("/api/admin/machines/requests/{id}/approve")))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({ "code": "654321" }))
        .send()
        .await
        .expect("sends")
        .json()
        .await
        .expect("json");
    assert_eq!(live_keys(&app.db, &node_id).await, 1);
    let device = approved["id"].as_str().expect("the machine's id");
    let removed = app
        .client
        .delete(app.url(&format!("/api/admin/machines/{device}")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("sends");
    assert_eq!(removed.status().as_u16(), 200);
    assert_eq!(live_keys(&app.db, &node_id).await, 0);
}

/// The agent's routes without its token look like nothing at all, and with no token configured,
/// as here, no value passes. So nobody on the network can file a request or read the roster.
#[tokio::test]
async fn the_agent_routes_refuse_anyone_without_the_token() {
    let app = common::spawn_app().await;
    let sync = app.client.post(app.url("/api/machine-agent/sync")).json(&serde_json::json!({}));
    assert_eq!(sync.send().await.expect("sends").status().as_u16(), 404);
    let guessed = app
        .client
        .post(app.url("/api/machine-agent/sync"))
        .header("x-machine-agent-token", "")
        .json(&serde_json::json!({}));
    assert_eq!(guessed.send().await.expect("sends").status().as_u16(), 404);
}

/// Viewing, approving and removing are separate duties, on the server and not only on the screen.
#[tokio::test]
async fn each_duty_needs_its_own_permission() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = admin_tenant(&app.db).await;
    let (id, node_id) = waiting_machine(&app.db, tenant, "111222").await;

    let front_desk = common::provision_staff(&app, &csrf, "receptionist", &[]).await;
    let list = front_desk.client.get(app.url("/api/admin/machines")).send().await.expect("sends");
    assert_eq!(list.status().as_u16(), 403, "no permission, no list");

    // What the IT security officer's role grants: may look and cut off, may not let in.
    let view_and_remove = ["devices.machines.view", "devices.machines.remove"];
    let security =
        common::provision_staff_with(&app, &csrf, "receptionist", &view_and_remove, &[]).await;
    let list = security.client.get(app.url("/api/admin/machines")).send().await.expect("sends");
    assert_eq!(list.status().as_u16(), 200, "may view");
    let approve = security
        .client
        .post(app.url(&format!("/api/admin/machines/requests/{id}/approve")))
        .header("x-csrf-token", &security.csrf)
        .json(&serde_json::json!({ "code": "111222" }))
        .send()
        .await
        .expect("sends");
    assert_eq!(approve.status().as_u16(), 403, "removing a machine is not letting one in");
    assert_eq!(live_keys(&app.db, &node_id).await, 0);
}

/// Files a request the way the agent's route does.
async fn file(db: &sqlx::PgPool, tenant: Uuid, key: &str, address: &str) -> JoinState {
    let filing = JoinFiling {
        node_id: key.to_owned(),
        address: address.to_owned(),
        label: format!("Request {key}"),
        kind: "workstation".to_owned(),
        code: "123456".to_owned(),
    };
    file_request(db, tenant, &filing).await.expect("a filing is never refused")
}

/// How many requests from `address` are waiting, and how many were pushed out.
async fn counts(db: &sqlx::PgPool, address: &str) -> (i64, i64) {
    sqlx::query_as(
        "SELECT count(*) FILTER (WHERE status = 'pending'), count(*) FILTER (WHERE drop_reason IS NOT NULL) \
           FROM device_pairing_requests WHERE source_address = $1",
    )
    .bind(address)
    .fetch_one(db)
    .await
    .expect("count")
}

/// A stranger on the LAN must not be able to stop a hospital adding a machine: however much one
/// address files, a real machine's request goes in, stays in, and the flood's oldest are recorded.
#[tokio::test]
async fn one_address_flooding_cannot_block_or_push_out_another() {
    let app = common::spawn_app().await;
    let tenant = admin_tenant(&app.db).await;
    let tag = Uuid::new_v4().simple().to_string();
    let (stranger, real) = (format!("s-{tag}"), format!("r-{tag}"));
    assert_eq!(file(&app.db, tenant, &format!("real-{tag}"), &real).await, JoinState::Pending);
    for i in 0..40 {
        let key = format!("flood-{tag}-{i}");
        assert_eq!(file(&app.db, tenant, &key, &stranger).await, JoinState::Pending);
    }
    let (waiting, dropped) = counts(&app.db, &stranger).await;
    assert_eq!(waiting, 3, "one address holds three places at most");
    assert!(dropped > 0, "what went must be there for the administrator to see");
    assert_eq!(counts(&app.db, &real).await, (1, 0), "the real machine is untouched");
}

/// Many addresses at once fill the list, and still a new request goes in, with the oldest making way.
#[tokio::test]
async fn a_full_list_lets_the_newest_in_and_stays_bounded() {
    let app = common::spawn_app().await;
    let tenant = admin_tenant(&app.db).await;
    let tag = Uuid::new_v4().simple().to_string();
    for i in 0..60 {
        let (key, address) = (format!("wide-{tag}-{i}"), format!("a-{tag}-{i}"));
        assert_eq!(file(&app.db, tenant, &key, &address).await, JoinState::Pending);
    }
    let waiting: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM device_pairing_requests \
          WHERE node_id IS NOT NULL AND status = 'pending' AND expires_at > now()",
    )
    .fetch_one(&app.db)
    .await
    .expect("count");
    assert!(waiting <= 20, "{waiting} waiting");
    let last = format!("a-{tag}-59");
    assert_eq!(counts(&app.db, &last).await, (1, 0), "the newest is in");
    let kept: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM device_pairing_requests WHERE drop_reason IS NOT NULL",
    )
    .fetch_one(&app.db)
    .await
    .expect("count");
    assert!(kept <= 50, "the record of what went has a ceiling: {kept}");
}

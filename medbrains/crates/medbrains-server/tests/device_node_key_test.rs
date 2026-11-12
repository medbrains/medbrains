use crate::common;

use uuid::Uuid;

/// A paired device of `tenant_id`, which is what a node key binds to.
async fn paired_device(db: &sqlx::PgPool, tenant_id: Uuid) -> Uuid {
    let suffix = Uuid::new_v4().simple().to_string();
    sqlx::query_scalar(
        "INSERT INTO paired_devices (tenant_id, label, app_variant, cert_fingerprint, cert_pem) \
         VALUES ($1, $2, 'tv', $3, 'test-pem') RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("Node Key Fixture {}", &suffix[..8]))
    .bind(format!("fp-{suffix}"))
    .fetch_one(db)
    .await
    .expect("insert paired device")
}

/// Enrolling a peer node key is a privileged act against a device this tenant
/// owns. These pin the parts that would be dangerous to get wrong.
#[tokio::test]
async fn a_node_key_cannot_be_claimed_twice() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let make_device = || paired_device(&app.db, tenant_id);

    let first = make_device().await;
    let second = make_device().await;
    let node_id = format!("node-{}", Uuid::new_v4().simple());

    let enrol = |device: Uuid, node: String| {
        let client = app.client.clone();
        let url = app.url(&format!("/api/device-pairing/paired/{device}/node-key"));
        let csrf = csrf.clone();
        async move {
            client
                .post(url)
                .header("x-csrf-token", csrf)
                .json(&serde_json::json!({ "node_id": node }))
                .send()
                .await
                .expect("request sends")
                .status()
                .as_u16()
        }
    };

    assert_eq!(enrol(first, node_id.clone()).await, 200, "first enrolment");

    // The unique index is global on purpose: two devices sharing a key makes
    // the admission lookup ambiguous exactly where it must not be.
    assert_eq!(
        enrol(second, node_id.clone()).await,
        409,
        "a key already claimed must not be silently rebound to another device"
    );
}

/// Re-registering rotates rather than accumulating: an old key must not stay
/// usable after a device presents a new one.
#[tokio::test]
async fn rotating_a_key_retires_the_previous_one() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");
    let device = paired_device(&app.db, tenant_id).await;

    let url = app.url(&format!("/api/device-pairing/paired/{device}/node-key"));
    let old = format!("old-{}", Uuid::new_v4().simple());
    let new = format!("new-{}", Uuid::new_v4().simple());

    for node in [&old, &new] {
        app.client
            .post(url.clone())
            .header("x-csrf-token", &csrf)
            .json(&serde_json::json!({ "node_id": node }))
            .send()
            .await
            .expect("enrol");
    }

    let live: Vec<String> = sqlx::query_scalar(
        "SELECT node_id FROM device_node_keys \
         WHERE paired_device_id = $1 AND revoked_at IS NULL",
    )
    .bind(device)
    .fetch_all(&app.db)
    .await
    .expect("query live keys");

    assert_eq!(
        live,
        vec![new],
        "only the newest key stays live — a rotated key that still worked would \
         defeat the point of rotating it"
    );

    let retired: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM device_node_keys \
         WHERE paired_device_id = $1 AND revoked_at IS NOT NULL",
    )
    .bind(device)
    .fetch_one(&app.db)
    .await
    .expect("count retired");

    assert_eq!(
        retired, 1,
        "and the old one is retained rather than deleted — an audit asking which \
         device held a key needs the history"
    );
}

/// Enrolling against a device that is not this tenant's must not succeed, and
/// must not disclose whether the device exists at all.
#[tokio::test]
async fn a_device_from_another_tenant_is_not_found() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let response = app
        .client
        .post(app.url(&format!(
            "/api/device-pairing/paired/{}/node-key",
            Uuid::new_v4()
        )))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({ "node_id": "whatever" }))
        .send()
        .await
        .expect("request sends");

    assert_eq!(response.status().as_u16(), 404);
}

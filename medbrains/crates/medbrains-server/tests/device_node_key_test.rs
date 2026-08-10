mod common;

use uuid::Uuid;

/// Enrolling a peer node key is a privileged act against a device this tenant
/// owns. These pin the parts that would be dangerous to get wrong.
#[tokio::test]
async fn a_node_key_cannot_be_claimed_twice() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");

    let make_device = || {
        let db = app.db.clone();
        async move {
            let suffix = &Uuid::new_v4().to_string()[..8];
            sqlx::query_scalar::<_, Uuid>(
                "INSERT INTO device_instances \
                 (tenant_id, adapter_code, name, code, status) \
                 VALUES ($1, 'generic', $2, $3, 'active'::device_instance_status) \
                 RETURNING id",
            )
            .bind(tenant_id)
            .bind(format!("Node Key Fixture {suffix}"))
            .bind(format!("NK-{suffix}"))
            .fetch_one(&db)
            .await
            .expect("insert device")
        }
    };

    let first = make_device().await;
    let second = make_device().await;
    let node_id = format!("node-{}", Uuid::new_v4().simple());

    let enrol = |device: Uuid, node: String| {
        let client = app.client.clone();
        let url = app.url(&format!("/api/devices/instances/{device}/node-key"));
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

    let tenant_id: Uuid = sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("a seeded tenant");
    let suffix = &Uuid::new_v4().to_string()[..8];
    let device: Uuid = sqlx::query_scalar(
        "INSERT INTO device_instances \
         (tenant_id, adapter_code, name, code, status) \
         VALUES ($1, 'generic', $2, $3, 'active'::device_instance_status) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("Rotation Fixture {suffix}"))
    .bind(format!("NKR-{suffix}"))
    .fetch_one(&app.db)
    .await
    .expect("insert device");

    let url = app.url(&format!("/api/devices/instances/{device}/node-key"));
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
         WHERE device_instance_id = $1 AND revoked_at IS NULL",
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
         WHERE device_instance_id = $1 AND revoked_at IS NOT NULL",
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
            "/api/devices/instances/{}/node-key",
            Uuid::new_v4()
        )))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({ "node_id": "whatever" }))
        .send()
        .await
        .expect("request sends");

    assert_eq!(response.status().as_u16(), 404);
}

//! Printed documents carry the hospital's local time, not the server's UTC.
//!
//! 20:00 UTC on 11 Oct is 01:30 IST on 12 Oct — the wrong date as well as the
//! wrong hour on a legal document if the zone is ignored.

use crate::common;

use reqwest::StatusCode;
use serde_json::Value;

#[tokio::test]
async fn a_token_slip_prints_in_the_hospitals_zone() {
    let app = common::spawn_app().await;
    app.login_admin().await;
    let tenant: uuid::Uuid = sqlx::query_scalar(
        "UPDATE tenants SET timezone = 'Asia/Kolkata' \
          WHERE id = (SELECT tenant_id FROM users WHERE username = 'admin') RETURNING id",
    )
    .fetch_one(&app.db)
    .await
    .expect("tenant");
    let token: uuid::Uuid = sqlx::query_scalar(
        "INSERT INTO tokens (tenant_id, module, scope, number, seq, token_date, created_at) \
         VALUES ($1, 'registration', 'global', 'TZ-001', 1, '2026-10-12', \
                 '2026-10-11 20:00:00+00') RETURNING id",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("token");

    let resp = app
        .get(&app.client, &format!("/api/print-data/token-slip/{token}"))
        .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let slip: Value = resp.json().await.expect("json");
    assert_eq!(slip["token_date"], "12-Oct-2026", "{slip}");
    assert_eq!(slip["token_time"], "01:30", "{slip}");

    // The offset handed to Rust-side formatting agrees with the SQL side.
    let mut tx = app.db.begin().await.expect("tx");
    let tz = medbrains_print_data::set_print_timezone(&mut tx, &tenant)
        .await
        .expect("zone");
    let instant = chrono::DateTime::parse_from_rfc3339("2026-10-11T20:00:00Z")
        .expect("instant")
        .with_timezone(&chrono::Utc);
    assert_eq!(
        instant
            .with_timezone(&tz)
            .format("%d-%b-%Y %H:%M")
            .to_string(),
        "12-Oct-2026 01:30"
    );
}

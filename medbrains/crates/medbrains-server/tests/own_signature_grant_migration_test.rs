//! Migration 1498: once administrators stop issuing signatures, a hospital's own role that
//! signs still lets its holders set their own signature.

use serde_json::{Value, json};
use uuid::Uuid;

use crate::common;

const MIGRATION: &str = include_str!(
    "../../medbrains-db-migrations/src/migrations/1498_grant_own_signature_to_custom_signers.sql"
);
const OWN: &str = "signatures.own.manage";

/// Given custom roles holding `doctor.signature.sign`, `nurse.signature.sign` and neither,
/// When migration 1498 runs (twice: it is idempotent), Then each signing role holds
/// `signatures.own.manage` exactly once and the other role does not.
#[tokio::test]
async fn custom_signing_roles_get_the_own_signature_permission() {
    let app = common::spawn_app().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT id FROM tenants ORDER BY created_at LIMIT 1")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let roles = [
        (
            format!("consultant_{tag}"),
            json!(["doctor.signature.sign", "opd.visit.list"]),
            true,
        ),
        (
            format!("charge_rn_{tag}"),
            json!(["nurse.signature.sign"]),
            true,
        ),
        (format!("ward_clerk_{tag}"), json!(["ipd.mar.list"]), false),
    ];
    for (code, perms, _) in &roles {
        sqlx::query(
            "INSERT INTO roles (tenant_id, code, name, permissions, is_system) \
             VALUES ($1, $2, $2, $3, false)",
        )
        .bind(tenant)
        .bind(code)
        .bind(perms)
        .execute(&app.db)
        .await
        .expect("custom role");
    }

    for _ in 0..2 {
        sqlx::raw_sql(MIGRATION)
            .execute(&app.db)
            .await
            .expect("migration 1498");
    }

    for (code, _, signs) in &roles {
        let perms: Value =
            sqlx::query_scalar("SELECT permissions FROM roles WHERE tenant_id = $1 AND code = $2")
                .bind(tenant)
                .bind(code)
                .fetch_one(&app.db)
                .await
                .expect("role");
        let held = perms
            .as_array()
            .map_or(0, |p| p.iter().filter(|c| *c == OWN).count());
        assert_eq!(held, usize::from(*signs), "{code}: {perms}");
    }
}

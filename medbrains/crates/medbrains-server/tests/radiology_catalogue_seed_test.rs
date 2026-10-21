//! Every hospital can order imaging from its first day: the default radiology
//! modalities and exams arrive with the tenant row, whichever path creates it.

use crate::common;

use uuid::Uuid;

/// Given a hospital created after the catalogue migration ran, When its row is
/// inserted, Then it has the default modalities and exams — not an empty
/// Radiology tab — and exams that need a side say so.
#[tokio::test]
async fn a_new_hospital_has_the_default_radiology_catalogue() {
    let app = common::spawn_app().await;
    let mut tx = app.db.begin().await.expect("tx");
    let hospital_type: String =
        sqlx::query_scalar("SELECT hospital_type::text FROM tenants LIMIT 1")
            .fetch_one(&mut *tx)
            .await
            .expect("a hospital type");
    let tenant = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO tenants (id, code, name, hospital_type, config) \
         VALUES ($1, $2, 'Radiology catalogue check', $3::text::hospital_type, '{}'::jsonb)",
    )
    .bind(tenant)
    .bind(format!("RC{}", &tenant.simple().to_string()[..8]).to_uppercase())
    .bind(&hospital_type)
    .execute(&mut *tx)
    .await
    .expect("new hospital");
    // radiology_exams forces row-level security: read as that hospital.
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .expect("tenant context");

    let modalities: Vec<String> = sqlx::query_scalar(
        "SELECT code FROM radiology_modalities WHERE tenant_id = $1 AND deleted_at IS NULL \
         ORDER BY code",
    )
    .bind(tenant)
    .fetch_all(&mut *tx)
    .await
    .expect("modalities");
    let (exams, lateral): (i64, i64) = sqlx::query_as(
        "SELECT count(*), count(*) FILTER (WHERE laterality_required) FROM radiology_exams \
         WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL",
    )
    .bind(tenant)
    .fetch_one(&mut *tx)
    .await
    .expect("exams");
    let knee_side: bool = sqlx::query_scalar(
        "SELECT laterality_required FROM radiology_exams WHERE tenant_id = $1 AND code = 'XR-KNEE'",
    )
    .bind(tenant)
    .fetch_one(&mut *tx)
    .await
    .expect("x-ray knee");
    tx.rollback().await.expect("rollback");

    assert_eq!(modalities, ["BMD", "CT", "DX", "MG", "MR", "RF", "US"]);
    assert!(exams >= 60, "{exams} exams");
    assert!(lateral > 0 && lateral < exams, "{lateral} of {exams} need a side");
    assert!(knee_side, "a knee x-ray must ask which knee");
}

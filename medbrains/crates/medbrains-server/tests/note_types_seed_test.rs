//! Every hospital can write a clinical note from its first day (#4906): the
//! default note types arrive with the tenant row, whichever path creates it.

use crate::common;

use uuid::Uuid;

/// Given a hospital created after the note-type migrations ran, When its row
/// is inserted, Then it has the ten default note types — not none.
#[tokio::test]
async fn a_new_hospital_has_the_default_note_types() {
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
         VALUES ($1, $2, 'Note types check', $3::text::hospital_type, '{}'::jsonb)",
    )
    .bind(tenant)
    .bind(format!("NT{}", &tenant.simple().to_string()[..8]).to_uppercase())
    .bind(&hospital_type)
    .execute(&mut *tx)
    .await
    .expect("new hospital");

    let codes: Vec<String> = sqlx::query_scalar(
        "SELECT code FROM note_types WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL \
         ORDER BY code",
    )
    .bind(tenant)
    .fetch_all(&mut *tx)
    .await
    .expect("note types");
    tx.rollback().await.expect("rollback");

    assert_eq!(codes.len(), 10, "{codes:?}");
    assert!(codes.contains(&"consultation".to_owned()), "{codes:?}");
    assert!(codes.contains(&"nursing".to_owned()), "{codes:?}");
}

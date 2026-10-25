//! Every doctor account is on the Doctors page (migration 1215).
//!
//! The page reads `doctor_profiles`, which only its own form used to write, so
//! a hospital whose doctors were created as users saw "0 doctors".

use crate::common;

use serde_json::Value;
use uuid::Uuid;

/// Given a doctor created as a user, When the admin opens Doctors, Then the
/// doctor is listed with their specialty and no registration recorded; And a
/// nurse is not listed.
#[tokio::test]
async fn a_doctor_created_as_a_user_is_on_the_doctors_page() {
    let app = common::spawn_app().await;
    app.login_admin().await;
    let suffix = Uuid::new_v4().simple().to_string()[..8].to_owned();
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");

    let mut tx = app.db.begin().await.expect("tx");
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .expect("context");
    let mut ids = Vec::new();
    for (name, role) in [("Doctor", "doctor"), ("Nurse", "nurse")] {
        let username = format!("{}_{suffix}", role);
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO users (tenant_id, username, email, full_name, role, password_hash, specialization) \
             SELECT $1, $2, $2 || '@profile-check.example.org', $3, $4::user_role, password_hash, 'Cardiology' \
               FROM users WHERE username = 'admin' RETURNING id",
        )
        .bind(tenant)
        .bind(&username)
        .bind(format!("{name} {suffix}"))
        .bind(role)
        .fetch_one(&mut *tx)
        .await
        .expect("user");
        ids.push(id);
    }
    tx.commit().await.expect("commit");

    let doctors: Vec<Value> = app
        .get(&app.client, &format!("/api/admin/doctors?search={suffix}"))
        .await
        .json()
        .await
        .expect("doctors");
    assert_eq!(doctors.len(), 1, "{doctors:?}");
    assert_eq!(doctors[0]["user_id"], ids[0].to_string());
    assert_eq!(doctors[0]["display_name"], format!("Doctor {suffix}"));
    assert_eq!(doctors[0]["subspecialty"], "Cardiology");
    assert!(doctors[0]["mci_number"].is_null(), "registration left for the admin");
    assert_eq!(doctors[0]["is_active"], true);
}

//! Who an admission opens to, written when the patient is admitted.
//!
//! `grant_admission_care_team` links the treating department and the admitting
//! doctor on both the admission and its encounter, and the ward's department
//! on the admission. Without these tuples the admission's own doctor and the
//! ward nurses cannot open it.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

type R<T> = Result<T, Box<dyn std::error::Error>>;

/// Given a ward that belongs to a different department than the one admitting,
/// When a patient is admitted to a bed on it, Then the admission and its
/// encounter both name the admitting department and doctor, and the admission
/// also opens to the ward's department.
#[tokio::test]
async fn an_admission_opens_to_its_department_doctor_and_ward() -> R<()> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await?;
    let depts: Vec<Uuid> = sqlx::query_scalar(
        "SELECT id FROM departments WHERE tenant_id = $1 AND deleted_at IS NULL ORDER BY code LIMIT 2",
    )
    .bind(tenant)
    .fetch_all(&app.db)
    .await?;
    let [admitting, ward_dept] = depts[..] else {
        return Err("two departments are seeded".into());
    };
    let (ward, bed) = common::vacant_ward_bed(&app, tenant).await;
    sqlx::query("UPDATE wards SET department_id = $1 WHERE id = $2")
        .bind(ward_dept)
        .bind(ward)
        .execute(&app.db)
        .await?;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let patient: Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "first_name": "Care", "last_name": "Team", "gender": "female",
                       "date_of_birth": "1980-08-08", "phone": "9990000087" }),
        )
        .send()
        .await?
        .json()
        .await?;
    let resp = app
        .client
        .post(app.url("/api/ipd/admissions"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "patient_id": patient["id"], "department_id": admitting,
                       "bed_id": bed, "doctor_id": doctor.user_id }),
        )
        .send()
        .await?;
    assert_eq!(resp.status(), StatusCode::OK);
    let created: Value = resp.json().await?;
    let admission: Uuid = created["admission"]["id"]
        .as_str()
        .ok_or("admission id")?
        .parse()?;
    let encounter: Uuid = sqlx::query_scalar("SELECT encounter_id FROM admissions WHERE id = $1")
        .bind(admission)
        .fetch_one(&app.db)
        .await?;

    let tuples: Vec<(String, Uuid, String, String)> = sqlx::query_as(
        "SELECT object_type, object_id, relation, subject_id FROM relation_tuples \
          WHERE tenant_id = $1 AND object_id = ANY($2) AND deleted_at IS NULL",
    )
    .bind(tenant)
    .bind(vec![admission, encounter])
    .fetch_all(&app.db)
    .await?;
    let has = |object: Uuid, relation: &str, subject: Uuid| {
        tuples
            .iter()
            .any(|(_, o, r, s)| *o == object && r == relation && *s == subject.to_string())
    };
    for object in [admission, encounter] {
        assert!(
            has(object, "dept_member", admitting),
            "{object}: {tuples:?}"
        );
        assert!(
            has(object, "attending_physician", doctor.user_id),
            "{object}: {tuples:?}"
        );
    }
    assert!(has(admission, "ward_member", ward_dept), "{tuples:?}");
    assert!(
        !has(encounter, "ward_member", ward_dept),
        "the ward sees the stay, not the visit"
    );
    Ok(())
}

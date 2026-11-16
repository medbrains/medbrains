//! A doctor's sign-off queue lists only what that doctor signs (#6009).
//!
//! Two doctors in one hospital each have an unsigned lab report, radiology
//! report and discharge summary. Each type's "mine" is the author the signing
//! registry names: the validating pathologist for a lab result, the verifying
//! consultant else the reporter for a radiology report, the verifier else the
//! preparer for a discharge summary. The doctor who merely ordered a test
//! signs nothing for it.

use crate::common;
use crate::signable_types_test::patient_visit;

use reqwest::StatusCode;
use serde_json::Value;
use std::collections::HashSet;
use uuid::Uuid;

/// The three unsigned records authored by `doctor`, on a patient of their own.
async fn authored_records(app: &common::TestApp, tenant: Uuid, doctor: Uuid) -> [Uuid; 3] {
    let (patient, encounter, dept) = patient_visit(app, tenant, doctor).await;
    let lab = lab_result(
        app,
        tenant,
        (patient, encounter, dept),
        doctor,
        Some(doctor),
    )
    .await;
    let radiology = radiology_report(app, tenant, patient, doctor).await;
    let discharge = discharge_summary(app, tenant, (patient, encounter), doctor).await;
    [lab, radiology, discharge]
}

/// An unsigned lab result ordered by `ordered_by`, validated by `validator`.
async fn lab_result(
    app: &common::TestApp,
    tenant: Uuid,
    (patient, encounter, dept): (Uuid, Uuid, Uuid),
    ordered_by: Uuid,
    validator: Option<Uuid>,
) -> Uuid {
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let test: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_test_catalog (tenant_id, code, name) VALUES ($1, $2, 'Creatinine') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("PSO-CR-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("test");
    let order: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by, \
            department_id, verified_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(patient)
    .bind(test)
    .bind(ordered_by)
    .bind(dept)
    .bind(validator)
    .fetch_one(&app.db)
    .await
    .expect("order");
    sqlx::query_scalar(
        "INSERT INTO lab_results (tenant_id, order_id, parameter_name, value, unit) \
         VALUES ($1, $2, 'Creatinine', '1.1', 'mg/dL') RETURNING id",
    )
    .bind(tenant)
    .bind(order)
    .fetch_one(&app.db)
    .await
    .expect("result")
}

/// An unsigned radiology report `reporter` wrote, with no verifier named.
async fn radiology_report(
    app: &common::TestApp,
    tenant: Uuid,
    patient: Uuid,
    reporter: Uuid,
) -> Uuid {
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let modality: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_modalities (tenant_id, code, name) VALUES ($1, $2, 'CT') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("PSO-CT-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("modality");
    let order: Uuid = sqlx::query_scalar(
        "INSERT INTO radiology_orders (tenant_id, patient_id, modality_id, ordered_by, body_part) \
         VALUES ($1, $2, $3, $4, 'Head') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .bind(modality)
    .bind(reporter)
    .fetch_one(&app.db)
    .await
    .expect("order");
    sqlx::query_scalar(
        "INSERT INTO radiology_reports (tenant_id, order_id, reported_by, findings) \
         VALUES ($1, $2, $3, 'No intracranial bleed') RETURNING id",
    )
    .bind(tenant)
    .bind(order)
    .bind(reporter)
    .fetch_one(&app.db)
    .await
    .expect("report")
}

/// An unsigned draft discharge summary `preparer` wrote for their admission.
async fn discharge_summary(
    app: &common::TestApp,
    tenant: Uuid,
    (patient, encounter): (Uuid, Uuid),
    preparer: Uuid,
) -> Uuid {
    let admission: Uuid = sqlx::query_scalar(
        "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor) \
         VALUES ($1, $2, $3, $4) RETURNING id",
    )
    .bind(tenant)
    .bind(encounter)
    .bind(patient)
    .bind(preparer)
    .fetch_one(&app.db)
    .await
    .expect("admission");
    sqlx::query_scalar(
        "INSERT INTO ipd_discharge_summaries (tenant_id, admission_id, prepared_by) \
         VALUES ($1, $2, $3) RETURNING id",
    )
    .bind(tenant)
    .bind(admission)
    .bind(preparer)
    .fetch_one(&app.db)
    .await
    .expect("summary")
}

/// GET `path` as `doctor`; the JSON body, after asserting a 200.
async fn get_as(app: &common::TestApp, doctor: &common::Staff, path: &str) -> Value {
    let resp = doctor
        .client
        .get(app.url(path))
        .send()
        .await
        .expect("request");
    assert_eq!(resp.status(), StatusCode::OK, "{path}");
    resp.json().await.expect("json")
}

#[tokio::test]
async fn a_doctor_sees_only_the_reports_they_sign() {
    let app = common::spawn_app_as_request_role().await;
    let csrf = app.login_admin().await;
    let a = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let b = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE id = $1")
        .bind(a.user_id)
        .fetch_one(&app.db)
        .await
        .expect("tenant");

    let mine = authored_records(&app, tenant, a.user_id).await;
    let theirs = authored_records(&app, tenant, b.user_id).await;
    // A ordered this test, but nobody validated it: it has no author yet.
    let (patient, encounter, dept) = patient_visit(&app, tenant, a.user_id).await;
    let unvalidated = lab_result(&app, tenant, (patient, encounter, dept), a.user_id, None).await;

    let listed: HashSet<Uuid> = get_as(&app, &a, "/api/doctors/me/pending-signoffs")
        .await
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|e| e["record_id"].as_str()?.parse().ok())
        .collect();
    for id in mine {
        assert!(listed.contains(&id), "A's own record {id} is missing");
    }
    for id in theirs.into_iter().chain([unvalidated]) {
        assert!(
            !listed.contains(&id),
            "A was shown {id}, which A does not sign"
        );
    }

    // The My Day tile counts the same three, not the hospital's.
    let day = get_as(&app, &a, "/api/doctors/me/dashboard").await;
    assert_eq!(day["pending_signoffs"]["total"], 3, "{day}");
}

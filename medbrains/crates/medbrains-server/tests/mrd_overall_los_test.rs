//! The MRD admission-discharge report's overall length of stay is total days
//! over total admissions. It was the plain mean of the department means, so
//! one long stay in a small department weighed as much as a whole ward.

use crate::common;

use reqwest::StatusCode;
use serde_json::Value;
use uuid::Uuid;

#[tokio::test]
async fn overall_stay_is_weighted_by_admissions() {
    let app = common::spawn_app().await;
    app.login_admin().await;
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    // January 2032, which no other test admits into: one 10-day stay in one
    // department, three 2-day stays in another. Overall 16 days / 4 = 4.
    sqlx::query(
        "UPDATE admissions SET deleted_at = now() WHERE admitted_at >= '2032-01-01' \
           AND admitted_at < '2032-02-01' AND deleted_at IS NULL",
    )
    .execute(&app.db)
    .await
    .expect("empty the month");
    sqlx::query(
        "WITH u AS (SELECT id, tenant_id FROM users WHERE username = 'admin'), \
              dep AS (INSERT INTO departments (tenant_id, code, name, department_type) \
                      SELECT u.tenant_id, $1 || d, $1 || d, 'clinical' FROM u, \
                             (VALUES ('A'), ('B')) AS v(d) RETURNING id, code), \
              stays AS (SELECT dep.id AS department_id, s.days \
                          FROM dep JOIN (VALUES ('A', 10), ('B', 2), ('B', 2), ('B', 2)) \
                               AS s(d, days) ON dep.code = $1 || s.d), \
              p AS (INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
                    SELECT u.tenant_id, $1 || '-' || gen_random_uuid(), 'Los', 'Patient', \
                           'other'::gender, '9000000002' FROM u, stays RETURNING id), \
              pe AS (SELECT p.id AS patient_id, s.department_id, s.days \
                       FROM (SELECT id, row_number() OVER () AS n FROM p) p \
                       JOIN (SELECT *, row_number() OVER () AS n FROM stays) s USING (n)), \
              e AS (INSERT INTO encounters (tenant_id, patient_id, encounter_type, department_id) \
                    SELECT u.tenant_id, pe.patient_id, 'ipd', pe.department_id FROM u, pe \
                    RETURNING id, patient_id) \
         INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, \
                                 status, admitted_at, discharged_at) \
         SELECT u.tenant_id, e.id, e.patient_id, u.id, 'discharged', \
                TIMESTAMPTZ '2032-01-05 12:00:00+00', \
                TIMESTAMPTZ '2032-01-05 12:00:00+00' + make_interval(days => pe.days) \
           FROM u, e JOIN pe USING (patient_id)",
    )
    .bind(format!("LOS{tag}"))
    .execute(&app.db)
    .await
    .expect("four stays");

    let resp = app
        .get(
            &app.client,
            "/api/mrd/stats/admission-discharge?from_date=2032-01-01&to_date=2032-01-31",
        )
        .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let report: Value = resp.json().await.expect("json");
    assert_eq!(report["total_admitted"], 4, "{report}");
    let overall = report["overall_avg_los_days"].as_f64().expect("overall");
    assert!(
        (overall - 4.0).abs() < 1e-9,
        "overall stay {overall} days, want 4"
    );
}

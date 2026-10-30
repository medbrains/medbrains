//! The NABH "time taken for discharge" KPI and the care-view discharge tracker
//! read `ipd_discharge_tat_log`, the row the discharge workflow writes. Both
//! used to read `ipd_discharge_tat_logs`, a lookalike table nothing writes, so
//! the KPI was always blank and every clearance on the tracker read pending.

use crate::common;

use serde_json::Value;
use uuid::Uuid;

struct Seed {
    tenant: Uuid,
    admin: Uuid,
    tag: String,
}

async fn seed() -> (common::TestApp, Seed) {
    let app = common::spawn_app().await;
    let _csrf = app.login_admin().await;
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("seeded admin");
    let tag = Uuid::new_v4().simple().to_string()[..10].to_owned();
    (app, Seed { tenant, admin, tag })
}

/// An admitted patient expected home tomorrow; returns the admission id.
async fn admit(app: &common::TestApp, s: &Seed, n: u8) -> Uuid {
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Tat', 'Reader', 'female', '9000000065') RETURNING id",
    )
    .bind(s.tenant)
    .bind(format!("UH-TAT-{}-{n}", s.tag))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
         VALUES ($1, $2, 'ipd') RETURNING id",
    )
    .bind(s.tenant)
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("encounter");
    sqlx::query_scalar(
        "INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, \
                                 admission_number, expected_discharge_date) \
         VALUES ($1, $2, $3, $4, $5, CURRENT_DATE + 1) RETURNING id",
    )
    .bind(s.tenant)
    .bind(encounter)
    .bind(patient)
    .bind(s.admin)
    .bind(format!("IP-TAT-{}-{n}", s.tag))
    .fetch_one(&app.db)
    .await
    .expect("admission")
}

async fn kpi(app: &common::TestApp) -> Option<f64> {
    let body: Value = app
        .get(&app.client, "/api/nabh/indicators")
        .await
        .json()
        .await
        .expect("indicators json");
    body["indicators"]
        .as_array()
        .expect("indicators array")
        .iter()
        .find(|i| i["code"] == "OPS_DISCHARGE_TAT")
        .unwrap_or_else(|| panic!("discharge TAT indicator present: {body}"))["value_current_month"]
        .as_f64()
}

/// Mean minutes approval→completion over this tenant's valid rows this month,
/// with `n` rows — computed before the test's own row goes in.
async fn baseline(app: &common::TestApp, tenant: Uuid) -> (f64, i64) {
    sqlx::query_as(
        "SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (discharge_completed_at - doctor_cleared_at)) \
                / 60.0), 0)::float8, COUNT(*) \
         FROM ipd_discharge_tat_log \
         WHERE tenant_id = $1 AND deleted_at IS NULL AND doctor_cleared_at IS NOT NULL \
           AND discharge_completed_at >= doctor_cleared_at \
           AND discharge_completed_at >= date_trunc('month', now())",
    )
    .bind(tenant)
    .fetch_one(&app.db)
    .await
    .expect("baseline")
}

/// NABH measures from the consultant's discharge approval to the patient
/// leaving, so the KPI must use `doctor_cleared_at → discharge_completed_at`,
/// not `total_tat_minutes` (which starts when the checklist was opened).
#[tokio::test]
async fn kpi_measures_approval_to_departure_from_the_written_table() {
    let (app, s) = seed().await;
    let (sum_before, n_before) = baseline(&app, s.tenant).await;

    let good = admit(&app, &s, 1).await;
    // Checklist opened 10 hours ago, consultant approved 90 minutes before the
    // patient left. total_tat_minutes says 600; NABH's number is 90.
    sqlx::query(
        "INSERT INTO ipd_discharge_tat_log \
           (tenant_id, admission_id, discharge_initiated_at, billing_cleared_at, \
            pharmacy_cleared_at, nursing_cleared_at, doctor_cleared_at, \
            discharge_completed_at, total_tat_minutes) \
         VALUES ($1, $2, now() - interval '10 hours', now() - interval '1 hour', \
                 now() - interval '1 hour', now() - interval '1 hour', \
                 now() - interval '90 minutes', now(), 600)",
    )
    .bind(s.tenant)
    .bind(good)
    .execute(&app.db)
    .await
    .expect("tat row");

    // Completion stamped before approval: bad data, must not pull the mean.
    let bad = admit(&app, &s, 2).await;
    sqlx::query(
        "INSERT INTO ipd_discharge_tat_log \
           (tenant_id, admission_id, discharge_initiated_at, doctor_cleared_at, \
            discharge_completed_at) \
         VALUES ($1, $2, now() - interval '3 hours', now(), now() - interval '2 hours')",
    )
    .bind(s.tenant)
    .bind(bad)
    .execute(&app.db)
    .await
    .expect("bad tat row");

    let expected = (sum_before + 90.0) / (n_before + 1) as f64;
    let got = kpi(&app)
        .await
        .expect("KPI is live once a discharge is recorded");
    assert!(
        (got - (expected * 10.0).round() / 10.0).abs() < 0.2,
        "KPI {got} should be the approval→departure mean {expected}, not total_tat_minutes"
    );
}

/// The tracker shows each of the four clearances the workflow records.
#[tokio::test]
async fn tracker_reads_clearances_from_the_written_table() {
    let (app, s) = seed().await;
    let admission = admit(&app, &s, 3).await;
    sqlx::query(
        "INSERT INTO ipd_discharge_tat_log \
           (tenant_id, admission_id, discharge_initiated_at, billing_cleared_at, \
            nursing_cleared_at) \
         VALUES ($1, $2, now() - interval '2 hours', now() - interval '1 hour', now())",
    )
    .bind(s.tenant)
    .bind(admission)
    .execute(&app.db)
    .await
    .expect("tat row");

    let rows: Value = app
        .get(&app.client, "/api/care-view/discharge-tracker")
        .await
        .json()
        .await
        .expect("tracker json");
    let id = admission.to_string();
    let row = rows
        .as_array()
        .unwrap_or_else(|| panic!("tracker returns a list: {rows}"))
        .iter()
        .find(|r| r["admission_id"].as_str() == Some(id.as_str()))
        .unwrap_or_else(|| panic!("admission on the tracker: {rows}"));

    assert_eq!(row["billing_cleared"], true, "{row}");
    assert_eq!(row["nursing_cleared"], true, "{row}");
    assert_eq!(row["pharmacy_cleared"], false, "{row}");
    assert_eq!(row["doctor_cleared"], false, "{row}");
    assert_eq!(row["readiness_pct"], 50, "two of four clearances: {row}");
}

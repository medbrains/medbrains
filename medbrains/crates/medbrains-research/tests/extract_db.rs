//! The extract against a real database: the SQL reads what the release
//! needs, keeps to the hospital, and leaves medico-legal stays out. Runs when
//! `RESEARCH_TEST_DATABASE_URL` names a migrated scratch database (it plants
//! and removes two hospitals); does nothing otherwise.

use chrono::NaiveDate;
use medbrains_research::{datasets, deid};
use uuid::Uuid;

const A: &str = "7e5e0000-0000-0000-0000-00000000000a";
const B: &str = "7e5e0000-0000-0000-0000-00000000000b";

fn plant() -> String {
    let mut sql = format!(
        "SET session_replication_role = replica;
         INSERT INTO tenants (id, code, name, hospital_type) VALUES
           ('{A}', 'RSTA', 'Research test A', 'community_health'),
           ('{B}', 'RSTB', 'Research test B', 'community_health');"
    );
    // Seven patients at A, one at B; all female, born 1980, pincode 560020.
    for i in 1..=8_u32 {
        let tenant = if i == 8 { B } else { A };
        sql.push_str(&format!(
            "INSERT INTO patients (id, tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth, address)
             VALUES ('7e5e0000-0000-0000-0001-{i:012}', '{tenant}', 'RST-{i}', 'Asha{i}', 'Rao', 'female',
                     '+9198450112{i:02}', '1980-06-01', '{{\"pincode\": \"560020\"}}');
             INSERT INTO encounters (id, tenant_id, patient_id, encounter_type, encounter_date)
             VALUES ('7e5e0000-0000-0000-0002-{i:012}', '{tenant}', '7e5e0000-0000-0000-0001-{i:012}', 'opd', '2026-03-14');
             INSERT INTO diagnoses (tenant_id, encounter_id, description, icd_code)
             VALUES ('{tenant}', '7e5e0000-0000-0000-0002-{i:012}', 'Type 2 diabetes', 'E11'),
                    ('{tenant}', '7e5e0000-0000-0000-0002-{i:012}', 'HIV disease', 'B20');
             INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, admission_number, admitted_at, mlc_case_id)
             VALUES ('{tenant}', '7e5e0000-0000-0000-0002-{i:012}', '7e5e0000-0000-0000-0001-{i:012}', gen_random_uuid(),
                     'RST-A{i}', '2026-03-14', CASE WHEN {i} = 1 THEN gen_random_uuid() END);"
        ));
    }
    sql.push_str("SET session_replication_role = origin;");
    sql
}

fn clear() -> String {
    format!(
        "SET session_replication_role = replica;
         DELETE FROM admissions WHERE tenant_id IN ('{A}', '{B}');
         DELETE FROM diagnoses WHERE tenant_id IN ('{A}', '{B}');
         DELETE FROM encounters WHERE tenant_id IN ('{A}', '{B}');
         DELETE FROM patients WHERE tenant_id IN ('{A}', '{B}');
         DELETE FROM tenants WHERE id IN ('{A}', '{B}');
         SET session_replication_role = origin;"
    )
}

#[tokio::test]
async fn an_extract_keeps_to_its_hospital_and_leaves_restricted_records_out() {
    let Ok(url) = std::env::var("RESEARCH_TEST_DATABASE_URL") else {
        return;
    };
    let db = sqlx::PgPool::connect(&url)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    sqlx::raw_sql(&clear())
        .execute(&db)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    sqlx::raw_sql(&plant())
        .execute(&db)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    let a: Uuid = A.parse().unwrap_or_default();
    let period = (
        NaiveDate::from_ymd_opt(2026, 3, 1).unwrap_or_default(),
        NaiveDate::from_ymd_opt(2026, 3, 31).unwrap_or_default(),
    );
    let mut tx = db.begin().await.unwrap_or_else(|e| panic!("{e}"));
    medbrains_db::pool::set_tenant_context(&mut tx, &a)
        .await
        .unwrap_or_else(|e| panic!("{e}"));

    let raw = datasets::read(&mut tx, a, "diagnoses", period)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    assert_eq!(raw.len(), 14, "7 patients x 2 diagnoses at A, none from B");
    let fields = datasets::fields("diagnoses").unwrap_or_default();
    let out = deid::release(fields, raw, b"salt", "ref");
    let csv = deid::to_csv(&out.header, &out.rows);
    assert_eq!(out.rows.len(), 7);
    assert!(
        !csv.contains("B20")
            && !csv.contains("Asha")
            && !csv.contains("RST-")
            && !csv.contains("98450")
    );
    assert!(csv.contains("\"560\"") && csv.contains("\"45-49\"") && csv.contains("\"2026-03\""));

    let stays = datasets::read(&mut tx, a, "admissions", period)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    assert_eq!(stays.len(), 6, "the medico-legal stay is not read");
    // Every dataset's SQL runs against the real schema.
    for name in datasets::NAMES {
        datasets::read(&mut tx, a, name, period)
            .await
            .unwrap_or_else(|e| panic!("{name}: {e}"));
    }
    let raw = datasets::read(&mut tx, a, "diagnoses", period)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    assert!(
        raw.iter().all(|r| r.hidden.is_some()),
        "diagnosis names are read for the class check"
    );
    let visits = datasets::read(&mut tx, a, "visits", period)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    assert_eq!(visits.len(), 7);
    drop(tx);
    sqlx::raw_sql(&clear())
        .execute(&db)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
}

//! The query path against a real database: the walls that hold even when the
//! statement check is skipped. Runs when `AI_QUERY_TEST_DATABASE_URL` names a
//! migrated scratch database (it plants and removes two hospitals); does
//! nothing otherwise.

use serde_json::json;
use uuid::Uuid;

use super::{Ran, run};

const A: Uuid = Uuid::from_u128(0x5a11_0000_0000_0000_0000_0000_0000_000a);
const B: Uuid = Uuid::from_u128(0x5a11_0000_0000_0000_0000_0000_0000_000b);

const PLANT: &str = "
SET session_replication_role = replica;
INSERT INTO tenants (id, code, name, hospital_type) VALUES
 ('5a110000-0000-0000-0000-00000000000a', 'AIQTA', 'Query test A', 'community_health'),
 ('5a110000-0000-0000-0000-00000000000b', 'AIQTB', 'Query test B', 'community_health');
INSERT INTO encounters (id, tenant_id, patient_id, encounter_type, encounter_date) VALUES
 ('5a110000-0000-0000-0000-0000000000e1', '5a110000-0000-0000-0000-00000000000a', gen_random_uuid(), 'opd', '2026-10-01');
INSERT INTO diagnoses (tenant_id, encounter_id, description, icd_code) VALUES
 ('5a110000-0000-0000-0000-00000000000a', '5a110000-0000-0000-0000-0000000000e1', 'Type 2 diabetes', 'E11'),
 ('5a110000-0000-0000-0000-00000000000a', '5a110000-0000-0000-0000-0000000000e1', 'HIV disease', 'B20'),
 ('5a110000-0000-0000-0000-00000000000a', '5a110000-0000-0000-0000-0000000000e1', 'Viral load monitoring', 'Z09');
INSERT INTO invoices (tenant_id, invoice_number, patient_id, total_amount) VALUES
 ('5a110000-0000-0000-0000-00000000000a', 'AIQ-1', gen_random_uuid(), 100),
 ('5a110000-0000-0000-0000-00000000000b', 'AIQ-2', gen_random_uuid(), 200);
SET session_replication_role = origin;";

const CLEAR: &str = "
SET session_replication_role = replica;
DELETE FROM invoices WHERE tenant_id IN ('5a110000-0000-0000-0000-00000000000a', '5a110000-0000-0000-0000-00000000000b');
DELETE FROM diagnoses WHERE tenant_id = '5a110000-0000-0000-0000-00000000000a';
DELETE FROM encounters WHERE tenant_id = '5a110000-0000-0000-0000-00000000000a';
DELETE FROM tenants WHERE id IN ('5a110000-0000-0000-0000-00000000000a', '5a110000-0000-0000-0000-00000000000b');
SET session_replication_role = origin;";

fn rows(ran: Ran) -> Vec<serde_json::Value> {
    match ran {
        Ran::Rows(rows) => rows,
        Ran::Timeout => panic!("timed out"),
        Ran::Failed(why) => panic!("failed: {why}"),
    }
}

fn failed(ran: Ran) -> String {
    match ran {
        Ran::Failed(why) => why,
        Ran::Rows(rows) => panic!("ran: {rows:?}"),
        Ran::Timeout => panic!("timed out"),
    }
}

#[tokio::test]
async fn the_database_holds_the_line_on_its_own() {
    let Ok(url) = std::env::var("AI_QUERY_TEST_DATABASE_URL") else {
        return;
    };
    let db = sqlx::PgPool::connect(&url)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    sqlx::raw_sql(CLEAR)
        .execute(&db)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    sqlx::raw_sql(PLANT)
        .execute(&db)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    let at_a = (&A, &[][..]);
    let at_b = (&B, &[][..]);

    // Restricted classes are not in the view, so not in any count.
    let diagnoses = rows(run(&db, at_a, "SELECT icd_code FROM diagnoses ORDER BY 1").await);
    assert_eq!(diagnoses, vec![json!({"icd_code": "E11"})]);

    // Each hospital sees its own money and nothing of the other's.
    let sum = "SELECT count(*) AS n, sum(total_amount) AS total FROM invoices";
    assert_eq!(
        rows(run(&db, at_a, sum).await),
        vec![json!({"n": 1, "total": 100.00})]
    );
    assert_eq!(
        rows(run(&db, at_b, sum).await),
        vec![json!({"n": 1, "total": 200.00})]
    );

    // Even unchecked, the role can read no table and write nothing.
    assert!(
        failed(run(&db, at_a, "SELECT count(*) FROM public.invoices").await)
            .contains("permission denied")
    );
    assert!(
        failed(run(&db, at_a, "SELECT count(*) FROM pg_catalog.pg_authid").await)
            .contains("permission denied")
    );
    let write = "WITH x AS (DELETE FROM invoices RETURNING 1) SELECT count(*) FROM x";
    assert!(!failed(run(&db, at_a, write).await).is_empty());

    // A slow query is stopped, not waited for.
    let slow = "SELECT count(*) FROM generate_series(1, 400000000)";
    assert!(matches!(run(&db, at_a, slow).await, Ran::Timeout));

    sqlx::raw_sql(CLEAR)
        .execute(&db)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
}

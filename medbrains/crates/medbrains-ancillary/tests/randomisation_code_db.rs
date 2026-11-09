//! A randomisation code that carries the patient's UHID is refused before it is
//! written, whatever separators or case it is typed with. Runs against
//! `RESEARCH_TEST_DATABASE_URL` (else `DATABASE_URL`); skipped locally when
//! neither is set, and failing in CI when none is given.

#![allow(clippy::panic)]

use medbrains_ancillary::clinical_trials::refuse_code_with_uhid;
use medbrains_server_core::error::AppError;
use uuid::Uuid;

#[tokio::test]
async fn a_code_holding_the_uhid_in_any_spelling_is_refused() {
    let url = std::env::var("RESEARCH_TEST_DATABASE_URL")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .ok();
    let Some(url) = url else {
        assert!(std::env::var_os("CI").is_none(), "CI must set DATABASE_URL");
        return;
    };
    let db = sqlx::PgPool::connect(&url)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    medbrains_db_migrations::run(&db)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    let (t, p) = (Uuid::new_v4(), Uuid::new_v4());
    let code = &t.simple().to_string()[..8];
    let up = code.to_uppercase();
    sqlx::raw_sql(&format!(
        "SET session_replication_role = replica;
         INSERT INTO tenants (id, code, name, hospital_type)
           VALUES ('{t}', 'RC{up}', 'Randomisation code test', 'community_health');
         INSERT INTO patients (id, tenant_id, uhid, first_name, last_name, gender, phone,
             date_of_birth)
           VALUES ('{p}', '{t}', 'UHID{code}00042', 'Meena', 'Raj', 'female', '+919800000000',
             '1980-01-01');
         SET session_replication_role = origin;"
    ))
    .execute(&db)
    .await
    .unwrap_or_else(|e| panic!("{e}"));
    let mut tx = db.begin().await.unwrap_or_else(|e| panic!("{e}"));
    for typed in [
        format!("UHID{code}00042"),
        format!("UHID {code} 00042"),
        format!("uhid_{code}_00042"),
    ] {
        let refused = refuse_code_with_uhid(&mut tx, p, Some(&typed)).await;
        assert!(
            matches!(refused, Err(AppError::BadRequest(_))),
            "{typed}: {refused:?}"
        );
    }
    for allowed in ["R-001", "00042"] {
        let ok = refuse_code_with_uhid(&mut tx, p, Some(allowed)).await;
        assert!(ok.is_ok(), "{allowed}: {ok:?}");
    }
}

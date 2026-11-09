//! The sponsor export against a real database: a trial user who may only
//! list is refused, another hospital's trial is not found, an export names
//! subjects only by key, keeps the blind, redacts typed text that names its
//! participant, and each export leaves an audit row. Runs against
//! [`common::database`] (each run plants its own hospital).

#![allow(clippy::panic, clippy::format_push_string)]

mod common;

use medbrains_core::permissions::specialty::clinical_trials;
use medbrains_kernel::Claims;
use medbrains_research::trial_export::{AUDIT_ACTION, export};
use medbrains_research::trial_subject::REDACTED;
use medbrains_server_core::error::AppError;
use sqlx::PgPool;
use uuid::Uuid;

/// The server key the tests derive subject keys from.
const KEY: &[u8] = b"trial-export-test-server-key-000";

/// What the planted participants are called and numbered; none may leave.
const IDENTIFIERS: [&str; 6] = [
    "Kavitha",
    "Ramanathan",
    "UHID-TX",
    "+9198450",
    "Aadhaar",
    "Anna Nagar",
];

/// A hospital, a trial coordinator, a trial and two consented, visited,
/// randomised participants (one with an adverse event).
fn plant(t: Uuid, user: Uuid, trial: Uuid) -> String {
    let code = &t.simple().to_string()[..8];
    let up = code.to_uppercase();
    let mut sql = format!(
        "SET session_replication_role = replica;
         INSERT INTO tenants (id, code, name, hospital_type)
           VALUES ('{t}', 'TX{up}', 'Trial export test', 'community_health');
         INSERT INTO users (id, tenant_id, username, email, full_name, role)
           VALUES ('{user}', '{t}', 'tx{code}', 'tx{code}@t.test', 'Coordinator', 'doctor');
         INSERT INTO clinical_trials (id, tenant_id, protocol_number, title, sponsor)
           VALUES ('{trial}', '{t}', 'PROTO-{code}', 'Lipid trial', 'Sponsor Ltd');"
    );
    for i in 1..=2_u32 {
        let p = Uuid::new_v4();
        // The second participant's typed text names them; it must be redacted.
        let (visit, rand) = if i == 1 {
            ("Week 4".to_owned(), "R-001".to_owned())
        } else {
            ("Week 4 kavitha2".to_owned(), format!("R-uhid-tx-{code}-2"))
        };
        sql.push_str(&format!(
            "INSERT INTO patients (id, tenant_id, uhid, first_name, last_name, gender, phone,
                date_of_birth, address, attributes)
             VALUES ('{p}', '{t}', 'UHID-TX-{code}-{i}', 'Kavitha{i}', 'Ramanathan', 'female',
                '+91984501120{i}', '1980-06-01', '{{\"line1\": \"Anna Nagar\"}}',
                '{{\"Aadhaar\": \"2345 6789 012{i}\"}}');
             INSERT INTO consent_records (tenant_id, patient_id, consent_type, created_by, trial_id,
                signed_by_patient, patient_signed_at)
               VALUES ('{t}', '{p}', 'research', '{user}', '{trial}', true, now());
             INSERT INTO trial_visits (tenant_id, trial_id, patient_id, visit_name, scheduled_date, notes)
               VALUES ('{t}', '{trial}', '{p}', '{visit}', '2026-11-01', 'Kavitha{i} came with her son');
             INSERT INTO trial_randomizations (tenant_id, trial_id, patient_id, arm, randomization_code)
               VALUES ('{t}', '{trial}', '{p}', 'statin', '{rand}');"
        ));
        if i == 1 {
            sql.push_str(&format!(
                "INSERT INTO trial_adverse_events (tenant_id, trial_id, patient_id, event_term,
                    description)
                 VALUES ('{t}', '{trial}', '{p}', 'Myalgia', 'Kavitha1 Ramanathan, UHID-TX');"
            ));
        }
    }
    sql.push_str("SET session_replication_role = origin;");
    sql
}

/// Claims for `user` at `t` holding exactly `perms`, as a role that bypasses nothing.
fn claims(t: Uuid, user: Uuid, perms: &[&str]) -> Claims {
    Claims {
        sub: user,
        tenant_id: t,
        role: "doctor".to_owned(),
        permissions: perms.iter().map(|p| (*p).to_owned()).collect(),
        department_ids: vec![],
        perm_version: 0,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    }
}

/// The test database with a fresh hospital, or `None` when none is named.
async fn world() -> Option<(PgPool, Uuid, Uuid, Uuid)> {
    let db = common::database().await?;
    let (t, user, trial) = (Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4());
    sqlx::raw_sql(&plant(t, user, trial))
        .execute(&db)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    Some((db, t, user, trial))
}

/// How many sponsor-export audit rows name `trial`, and the last one's subject count.
async fn audited(db: &PgPool, t: Uuid, trial: Uuid) -> (i64, Option<i64>) {
    sqlx::query_as(
        "SELECT count(*), max((new_values->>'subjects')::bigint) FROM audit_log \
         WHERE tenant_id = $1 AND entity_id = $2 AND action = $3",
    )
    .bind(t)
    .bind(trial)
    .bind(AUDIT_ACTION)
    .fetch_one(db)
    .await
    .unwrap_or_else(|e| panic!("{e}"))
}

#[tokio::test]
async fn a_user_who_may_only_list_trials_cannot_export_one() {
    let Some((db, t, user, trial)) = world().await else {
        return;
    };
    let lister = claims(t, user, &[clinical_trials::LIST, clinical_trials::CREATE]);
    let refused = export(&db, KEY, &lister, trial).await;
    assert!(matches!(refused, Err(AppError::Forbidden)), "{refused:?}");
    assert_eq!(
        audited(&db, t, trial).await.0,
        0,
        "a refusal exports nothing"
    );
}

#[tokio::test]
async fn an_export_names_subjects_only_by_key_and_is_audited() {
    let Some((db, t, user, trial)) = world().await else {
        return;
    };
    let coordinator = claims(t, user, &[clinical_trials::EXPORT]);
    let bundle = export(&db, KEY, &coordinator, trial)
        .await
        .unwrap_or_else(|e| panic!("{e:?}"));
    let json = serde_json::to_string(&bundle).unwrap_or_else(|e| panic!("{e}"));
    for id in IDENTIFIERS {
        assert!(!json.contains(id), "{id} leaked: {json}");
    }
    let patients: Vec<Uuid> = sqlx::query_scalar("SELECT id FROM patients WHERE tenant_id = $1")
        .bind(t)
        .fetch_all(&db)
        .await
        .unwrap_or_else(|e| panic!("{e}"));
    for p in &patients {
        assert!(!json.contains(&p.to_string()), "patient id leaked");
    }
    assert_eq!(bundle.subject_count, 2);
    assert!(json.contains("R-001"), "the trial's own numbers go out");
    assert!(json.contains("Myalgia"), "the event term goes out");
    assert!(
        !json.to_lowercase().contains("statin"),
        "a blinded arm stays concealed: {json}"
    );
    let codes: Vec<Option<&str>> = bundle
        .randomizations
        .iter()
        .map(|r| r.row.randomization_code.as_deref())
        .collect();
    assert!(
        codes.contains(&Some(REDACTED)),
        "the UHID in a code is redacted"
    );
    let visits: Vec<&str> = bundle
        .visits
        .iter()
        .map(|v| v.row.visit_name.as_str())
        .collect();
    assert!(
        visits.contains(&REDACTED),
        "a name in a visit name is redacted"
    );
    assert!(
        visits.contains(&"Week 4"),
        "a visit name that names nobody goes out"
    );
    // One subject, one key, in every list.
    let keys = |v: &serde_json::Value, list: &str| -> Vec<String> {
        let mut k: Vec<String> = v[list]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(|r| r["subject_key"].as_str().map(str::to_owned))
            .collect();
        k.sort();
        k
    };
    let v: serde_json::Value = serde_json::from_str(&json).unwrap_or_else(|e| panic!("{e}"));
    assert_eq!(keys(&v, "consents").len(), 2);
    assert_eq!(keys(&v, "consents"), keys(&v, "visits"));
    assert_eq!(keys(&v, "consents"), keys(&v, "randomizations"));
    // The same subject keeps the same key in the next transfer.
    let again = export(&db, KEY, &coordinator, trial)
        .await
        .unwrap_or_else(|e| panic!("{e:?}"));
    assert_eq!(
        again
            .consents
            .iter()
            .map(|c| &c.subject_key)
            .collect::<Vec<_>>(),
        bundle
            .consents
            .iter()
            .map(|c| &c.subject_key)
            .collect::<Vec<_>>()
    );
    assert_eq!(audited(&db, t, trial).await, (2, Some(2)));
}

#[tokio::test]
async fn another_hospitals_trial_is_not_found() {
    let Some((db, _, _, trial)) = world().await else {
        return;
    };
    let Some((_, other, other_user, _)) = world().await else {
        return;
    };
    let outsider = claims(other, other_user, &[clinical_trials::EXPORT]);
    let refused = export(&db, KEY, &outsider, trial).await;
    assert!(matches!(refused, Err(AppError::NotFound)), "{refused:?}");
}

//! A patient's running note is read and replaced only by callers who may reach
//! that patient. Holding the notes permission is not enough: a clinician with
//! no path to the patient gets 404 on both routes and the note stays as it was,
//! and an authorization outage is an error, never a refusal or an empty note.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-clinical-offline -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::{Extension, Json};
use jsonwebtoken::{DecodingKey, EncodingKey};
use medbrains_authz::backend_test::InMemoryBackend;
use medbrains_authz::{AuthzBackend, Relation, Subject};
use medbrains_clinical_offline::{UpdatePatientNotes, get_patient_notes, update_patient_notes};
use medbrains_core::permissions;
use medbrains_kernel::Claims;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::authorization::authz_context;
use medbrains_server_core::state::{AppState, CookieConfig};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

fn state(db: PgPool, authz: Arc<dyn AuthzBackend>) -> AppState {
    let key = [7u8; 32];
    let resolver: Arc<dyn medbrains_db_topology::TopologyResolver> = Arc::new(
        medbrains_db_topology::PostgresTopologyResolver::new(db.clone()),
    );
    AppState {
        db: db.clone(),
        jwt_encoding_key: EncodingKey::from_secret(&key),
        jwt_decoding_key: DecodingKey::from_secret(&key),
        cookie_config: CookieConfig {
            domain: None,
            secure: false,
            cors_origin: String::new(),
        },
        queue_broadcaster: medbrains_server_core::queue_broadcast::QueueBroadcaster::new(),
        notifications: medbrains_server_core::notification_hub::NotificationHub::new(),
        trusted_proxies: Arc::new(vec![]),
        system_state_cache: medbrains_server_core::middleware::system_state::SystemStateCache::new(
        ),
        outbox: Arc::new(medbrains_outbox::Registry::new()),
        topology: Arc::new(medbrains_db_topology::TopologyRouter::new(
            db.clone(),
            db,
            resolver,
        )),
        authz,
        secret_resolver: Arc::new(medbrains_core::secrets::EnvSecretResolver::new()),
        s3: None,
        gotenberg: None,
        reports: medbrains_server_core::report_runner::ReportGate::default(),
        documents_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("notes-test-docs"),
        )),
    }
}

async fn id(db: &PgPool, tenant: Uuid, sql: &str) -> Uuid {
    let mut tx = db.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    let id = sqlx::query_scalar(sql)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or_else(|e| panic!("{sql}: {e}"));
    tx.commit().await.unwrap();
    id
}

fn doctor(tenant_id: Uuid, sub: Uuid) -> Claims {
    Claims {
        sub,
        tenant_id,
        role: "doctor".to_owned(),
        permissions: vec![
            permissions::patients::notes::VIEW.to_owned(),
            permissions::patients::notes::EDIT.to_owned(),
        ],
        department_ids: Vec::new(),
        perm_version: 1,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    }
}

/// A hospital, one patient, the treating doctor and a doctor with no path to the patient.
async fn fixture(db: &PgPool) -> (Claims, Claims, Uuid) {
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let t: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ($1, 'Notes test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("NOTE{code}"))
    .fetch_one(db)
    .await
    .expect("tenant");
    let mut users = Vec::new();
    for who in ["treating", "other"] {
        let n = Uuid::new_v4().simple().to_string()[..12].to_owned();
        users.push(
            id(
                db,
                t,
                &format!(
                    "INSERT INTO users (tenant_id, username, email, full_name, role) \
                     VALUES ('{t}', 'u{n}', '{n}@notes.test', 'Dr {who}', 'doctor') RETURNING id"
                ),
            )
            .await,
        );
    }
    let n = Uuid::new_v4().simple().to_string()[..12].to_owned();
    let patient = id(
        db,
        t,
        &format!(
            "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
             VALUES ('{t}', 'NOTE-{n}', 'Pat', 'Notes', 'female', '9000000000') RETURNING id"
        ),
    )
    .await;
    (doctor(t, users[0]), doctor(t, users[1]), patient)
}

async fn read(state: &AppState, claims: &Claims, patient: Uuid) -> Result<String, AppError> {
    get_patient_notes(
        State(state.clone()),
        Extension(claims.clone()),
        Path(patient),
    )
    .await
    .map(|Json(n)| n.text)
}

async fn write(
    state: &AppState,
    claims: &Claims,
    patient: Uuid,
    text: &str,
) -> Result<String, AppError> {
    let body = UpdatePatientNotes {
        text: text.to_owned(),
        if_version: None,
    };
    update_patient_notes(
        State(state.clone()),
        Extension(claims.clone()),
        Path(patient),
        Json(body),
    )
    .await
    .map(|Json(n)| n.text)
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn notes_reach_only_callers_who_may_see_the_patient() {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    let db = PgPool::connect(&url).await.expect("database");
    let (treating, other, patient) = fixture(&db).await;

    let authz = Arc::new(InMemoryBackend::new());
    authz
        .write_tuple(
            &authz_context(&treating),
            "patient",
            patient,
            Relation::Viewer,
            Subject::User(treating.sub),
            None,
            Some("test: under this doctor's care".to_owned()),
        )
        .await
        .expect("grant");
    let app = state(db.clone(), authz);

    assert_eq!(
        write(&app, &treating, patient, "allergic to penicillin")
            .await
            .unwrap(),
        "allergic to penicillin"
    );

    assert!(
        matches!(read(&app, &other, patient).await, Err(AppError::NotFound)),
        "a doctor with no path to the patient read the note"
    );
    assert!(
        matches!(
            write(&app, &other, patient, "replaced").await,
            Err(AppError::NotFound)
        ),
        "a doctor with no path to the patient replaced the note"
    );
    assert_eq!(
        read(&app, &treating, patient).await.unwrap(),
        "allergic to penicillin",
        "a refused write changed the note"
    );

    // An unreachable authorization engine is an outage (503), never a 404 or an empty note.
    let gone = PgPoolOptions::new()
        .connect_lazy("postgres://nobody@127.0.0.1:1/none")
        .expect("lazy pool");
    gone.close().await;
    let broken = state(
        db,
        Arc::new(medbrains_authz::backend_pg::PgAuthzBackend::new(gone)),
    );
    assert!(
        matches!(
            read(&broken, &treating, patient).await,
            Err(AppError::ServiceUnavailable(_))
        ),
        "an authorization fault was answered as a refusal or a note"
    );
    assert!(
        matches!(
            write(&broken, &treating, patient, "during outage").await,
            Err(AppError::ServiceUnavailable(_))
        ),
        "an authorization fault let a write through"
    );
}

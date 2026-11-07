//! Charges needing attention against a real, migrated database: a failed
//! charge keeps the clinical write and is queued, an unreadable setting is
//! queued, a posted charge queues nothing, the desk can post or dismiss (with
//! a reason), a caller without the permission is refused, and another
//! hospital cannot see the rows.
//!
//! ```text
//! DATABASE_URL=… cargo test -p medbrains-billing --test charge_attention -- --ignored
//! ```

#![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic)]

use std::sync::Arc;

use axum::Extension;
use axum::Json;
use axum::extract::{Path, Query, State};
use jsonwebtoken::{DecodingKey, EncodingKey};
use medbrains_authz::backend_test::InMemoryBackend;
use medbrains_billing::charge_attention::{
    DismissRequest, ListChargeAttentionQuery, dismiss_charge_attention, list_charge_attention,
    post_charge_attention,
};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::{AppState, CookieConfig};
use medbrains_server_services::billing::{
    AutoChargeInput, ChargeOutcome, ChargeRequest, REASON_SETTING_UNREADABLE, charge_or_queue,
};
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

/// The unreadable-setting test locks `tenant_settings`; nothing else in this
/// file may read it meanwhile.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

type Tx = sqlx::Transaction<'static, sqlx::Postgres>;

fn state(db: PgPool) -> AppState {
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
        authz: Arc::new(InMemoryBackend::new()),
        secret_resolver: Arc::new(medbrains_core::secrets::EnvSecretResolver::new()),
        s3: None,
        gotenberg: None,
        documents_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("charge-attention-test-docs"),
        )),
    }
}

async fn pool() -> PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL");
    PgPoolOptions::new()
        .max_connections(6)
        .connect(&url)
        .await
        .expect("connect")
}

/// A hospital, a billing user and a patient. Returns the user's claims and
/// the patient.
async fn fixture(db: &PgPool) -> (Claims, Uuid) {
    let code = Uuid::new_v4().simple().to_string()[..10].to_owned();
    let t: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) \
         VALUES ($1, 'Charge attention test', 'multi_specialty') RETURNING id",
    )
    .bind(format!("CA{}", code.to_uppercase()))
    .fetch_one(db)
    .await
    .expect("tenant");
    let mut tx = scoped(db, t).await;
    let user: Uuid = sqlx::query_scalar(
        "INSERT INTO users (tenant_id, username, email, full_name, role) \
         VALUES ($1, $2, $3, 'Desk Clerk', 'billing_clerk') RETURNING id",
    )
    .bind(t)
    .bind(format!("ca{code}"))
    .bind(format!("ca{code}@charge.test"))
    .fetch_one(&mut *tx)
    .await
    .expect("user");
    let patient = insert_patient(&mut tx, t).await;
    tx.commit().await.unwrap();
    let claims = Claims {
        sub: user,
        tenant_id: t,
        role: "super_admin".to_owned(),
        permissions: vec![
            permissions::billing::charge_attention::VIEW.to_owned(),
            permissions::billing::charge_attention::RESOLVE.to_owned(),
        ],
        department_ids: Vec::new(),
        perm_version: 1,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    };
    (claims, patient)
}

/// A transaction under the tenant, set the way the request path sets it.
async fn scoped(db: &PgPool, tenant: Uuid) -> Tx {
    let mut tx = db.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    tx
}

async fn insert_patient(tx: &mut Tx, tenant: Uuid) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Test', 'Patient', 'female', '9000000000') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("CA-{}", Uuid::new_v4().simple()))
    .fetch_one(&mut **tx)
    .await
    .expect("patient")
}

fn diet_charge(claims: &Claims, patient: Uuid, encounter: Option<Uuid>) -> ChargeRequest<'static> {
    ChargeRequest {
        tenant_id: claims.tenant_id,
        requested_by: claims.sub,
        setting_module: "diet",
        charge: AutoChargeInput {
            patient_id: patient,
            encounter_id: encounter,
            charge_code: "DIET_ORDER".to_owned(),
            source: "diet".to_owned(),
            source_id: Uuid::new_v4(),
            quantity: 1,
            ..Default::default()
        },
        apply_concessions: true,
    }
}

async fn queued(db: &PgPool, tenant: Uuid) -> Vec<(Uuid, String, String)> {
    sqlx::query_as(
        "SELECT id, reason, status FROM charge_attention_items WHERE tenant_id = $1 \
         ORDER BY created_at",
    )
    .bind(tenant)
    .fetch_all(db)
    .await
    .unwrap()
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_failed_charge_keeps_the_clinical_write_and_is_queued() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let mut tx = scoped(&db, claims.tenant_id).await;
    // The clinical write: a second patient registered in the same transaction.
    let clinical = insert_patient(&mut tx, claims.tenant_id).await;
    // An encounter that does not exist: the invoice's foreign key refuses it.
    let outcome = charge_or_queue(&mut tx, diet_charge(&claims, patient, Some(Uuid::new_v4())))
        .await
        .expect("queued, not failed");
    assert!(matches!(outcome, ChargeOutcome::Queued), "{outcome:?}");
    tx.commit().await.expect("the transaction was not aborted");

    let kept: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM patients WHERE id = $1")
        .bind(clinical)
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(
        kept, 1,
        "the clinical write was rolled back with the charge"
    );
    let rows = queued(&db, claims.tenant_id).await;
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].1, "charge_failed:database");
    assert_eq!(rows[0].2, "open");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn an_unreadable_setting_is_queued_not_read_as_off() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    // Hold tenant_settings so the setting read times out.
    let mut holder = db.begin().await.unwrap();
    sqlx::query("LOCK TABLE tenant_settings IN ACCESS EXCLUSIVE MODE")
        .execute(&mut *holder)
        .await
        .unwrap();
    let mut tx = scoped(&db, claims.tenant_id).await;
    sqlx::query("SET LOCAL lock_timeout = '200ms'")
        .execute(&mut *tx)
        .await
        .unwrap();
    let outcome = charge_or_queue(&mut tx, diet_charge(&claims, patient, None))
        .await
        .expect("queued, not failed");
    tx.commit().await.expect("commit");
    holder.rollback().await.unwrap();

    assert!(matches!(outcome, ChargeOutcome::Queued), "{outcome:?}");
    let rows = queued(&db, claims.tenant_id).await;
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].1, REASON_SETTING_UNREADABLE);
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn a_posted_charge_queues_nothing() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let mut tx = scoped(&db, claims.tenant_id).await;
    let outcome = charge_or_queue(&mut tx, diet_charge(&claims, patient, None))
        .await
        .unwrap();
    tx.commit().await.unwrap();
    assert!(matches!(outcome, ChargeOutcome::Posted(_)), "{outcome:?}");
    assert!(queued(&db, claims.tenant_id).await.is_empty());
}

/// Queue a charge the way a failed setting read would, with data that posts.
async fn queue_one(db: &PgPool, claims: &Claims, patient: Uuid) -> Uuid {
    let req = diet_charge(claims, patient, None);
    let mut tx = scoped(db, claims.tenant_id).await;
    sqlx::query(
        "INSERT INTO charge_attention_items (tenant_id, source_module, setting_module, \
           source_entity_id, patient_id, charge_code, quantity, apply_concessions, reason, \
           created_by) VALUES ($1, 'diet', 'diet', $2, $3, 'DIET_ORDER', 1, true, $4, $5)",
    )
    .bind(claims.tenant_id)
    .bind(req.charge.source_id)
    .bind(patient)
    .bind(REASON_SETTING_UNREADABLE)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    queued(db, claims.tenant_id).await[0].0
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn posting_from_the_queue_creates_the_charge_and_closes_the_item() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let id = queue_one(&db, &claims, patient).await;
    let st = state(db.clone());

    let item = post_charge_attention(State(st.clone()), Extension(claims.clone()), Path(id))
        .await
        .expect("posted")
        .0;
    assert_eq!(item.status, "posted");
    let invoice = item.invoice_id.expect("invoice");
    let lines: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM invoice_items WHERE invoice_id = $1 AND charge_code = 'DIET_ORDER'",
    )
    .bind(invoice)
    .fetch_one(&db)
    .await
    .unwrap();
    assert_eq!(lines, 1);
    assert!(item.resolved_at.is_some());

    let again = post_charge_attention(State(st), Extension(claims), Path(id)).await;
    assert!(
        matches!(again, Err(AppError::Conflict(_))),
        "resolved twice"
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn dismissing_needs_a_reason() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let id = queue_one(&db, &claims, patient).await;
    let st = state(db.clone());

    let blank = dismiss_charge_attention(
        State(st.clone()),
        Extension(claims.clone()),
        Path(id),
        Json(DismissRequest {
            reason: "  ".to_owned(),
        }),
    )
    .await;
    assert!(matches!(blank, Err(AppError::BadRequest(_))));

    let item = dismiss_charge_attention(
        State(st),
        Extension(claims),
        Path(id),
        Json(DismissRequest {
            reason: "Charged by hand on the IP bill".to_owned(),
        }),
    )
    .await
    .expect("dismissed")
    .0;
    assert_eq!(item.status, "dismissed");
    assert_eq!(
        item.dismiss_reason.as_deref(),
        Some("Charged by hand on the IP bill")
    );
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn without_the_permission_the_queue_is_refused() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let (mut claims, patient) = fixture(&db).await;
    let id = queue_one(&db, &claims, patient).await;
    claims.role = "billing_clerk".to_owned();
    claims.permissions = vec![permissions::billing::charge_attention::VIEW.to_owned()];
    let st = state(db);

    let post = post_charge_attention(State(st.clone()), Extension(claims.clone()), Path(id)).await;
    assert!(matches!(post, Err(AppError::Forbidden)), "post: {post:?}");
    claims.permissions.clear();
    let list = list_charge_attention(
        State(st),
        Extension(claims),
        Query(ListChargeAttentionQuery {
            status: None,
            page: None,
            limit: None,
        }),
    )
    .await;
    assert!(matches!(list, Err(AppError::Forbidden)), "list");
}

#[tokio::test]
#[ignore = "needs DATABASE_URL"]
async fn another_hospital_cannot_see_the_rows() {
    let _serial = SERIAL.lock().await;
    let db = pool().await;
    let (claims, patient) = fixture(&db).await;
    let (other, _) = fixture(&db).await;
    queue_one(&db, &claims, patient).await;

    let count_as = |tenant: Uuid| {
        let db = db.clone();
        async move {
            let mut tx = scoped(&db, tenant).await;
            sqlx::query("SET LOCAL ROLE medbrains_app")
                .execute(&mut *tx)
                .await
                .unwrap();
            let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM charge_attention_items")
                .fetch_one(&mut *tx)
                .await
                .unwrap();
            tx.rollback().await.unwrap();
            n
        }
    };
    assert_eq!(count_as(other.tenant_id).await, 0, "RLS leaked a row");
    assert_eq!(count_as(claims.tenant_id).await, 1);
}

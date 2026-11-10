//! RFC-SOP-FLOWS §11: a track a flow designer built is proposed as a change
//! set, needs the quality officer and the medical superintendent, applies as
//! a new version that new discharges follow while running ones stay pinned,
//! and the server re-runs the checks however the set was built.
//!
//! ```text
//! DATABASE_URL=postgres://medbrains:medbrains_dev@localhost:5440/medbrains \
//!   cargo test -p medbrains-knowledge --test flow_tracks -- --ignored
//! ```

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

use std::sync::Arc;

use jsonwebtoken::{DecodingKey, EncodingKey};
use medbrains_knowledge::engine;
use medbrains_knowledge::model::{Area, NewKnowledgeChangeItem, NewKnowledgeChangeSet, Op};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::{AppState, CookieConfig};
use medbrains_sop_flows::builder::{self, DryRunRequest, SaveDraft};
use medbrains_sop_flows::discharge::CODE;
use medbrains_sop_flows::model::{Station, StationKind};
use medbrains_sop_flows::{engine as flows, store};
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

fn claims(tenant: Uuid, user: Uuid, role: &str, perms: &[&str]) -> Claims {
    Claims {
        sub: user,
        tenant_id: tenant,
        role: role.to_owned(),
        permissions: perms.iter().map(|p| (*p).to_owned()).collect(),
        department_ids: Vec::new(),
        perm_version: 1,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    }
}

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
            db.clone(),
            resolver,
        )),
        authz: Arc::new(medbrains_authz::backend_pg::PgAuthzBackend::new(db)),
        secret_resolver: Arc::new(medbrains_core::secrets::EnvSecretResolver::new()),
        s3: None,
        gotenberg: None,
        documents_store: Arc::new(medbrains_core::object_store::LocalFsObjectStore::new(
            std::env::temp_dir().join("flow-tracks-test-docs"),
        )),
    }
}

async fn exec(pool: &PgPool, tenant: Uuid, sql: &str) -> Value {
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    let v: Value = sqlx::query_scalar(sql)
        .fetch_one(&mut *tx)
        .await
        .unwrap_or_else(|e| panic!("{sql}: {e}"));
    tx.commit().await.unwrap();
    v
}

struct World {
    state: AppState,
    tenant: Uuid,
    author: Claims,
    qo: Claims,
    ms: Claims,
    ward: Claims,
}

async fn world() -> World {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://medbrains:medbrains_dev@localhost:5440/medbrains".to_owned()
    });
    let pool = PgPool::connect(&url)
        .await
        .expect("needs a migrated database");
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar(&format!(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ('FTR{code}', 'Track test', 'multi_specialty') RETURNING id"
    ))
    .fetch_one(&pool)
    .await
    .unwrap();
    let mut users = Vec::new();
    for role in [
        "quality_officer",
        "quality_officer",
        "medical_superintendent",
        "doctor",
    ] {
        let n = Uuid::new_v4().simple().to_string()[..12].to_owned();
        users.push(
            exec(&pool, tenant, &format!(
                "INSERT INTO users (tenant_id, username, email, full_name, role) VALUES \
                 ('{tenant}', 'u{n}', '{n}@ftr.test', 'Test {role}', '{role}') RETURNING to_jsonb(id)"
            ))
            .await,
        );
    }
    let id = |i: usize| Uuid::parse_str(users[i].as_str().unwrap()).unwrap();
    for r in medbrains_core::access::roles::BUILT_IN_ROLES {
        exec(
            &pool,
            tenant,
            &format!(
                "INSERT INTO roles (tenant_id, code, name, permissions, is_system) VALUES \
             ('{tenant}', '{}', '{}', '{}'::jsonb, true) RETURNING to_jsonb(id)",
                r.code,
                r.name.replace('\'', "''"),
                json!(r.permissions)
            ),
        )
        .await;
    }
    exec(
        &pool,
        tenant,
        &format!(
            "INSERT INTO departments (tenant_id, code, name, department_type) VALUES \
         ('{tenant}', 'ORTHO', 'Orthopaedics', 'clinical') RETURNING to_jsonb(id)"
        ),
    )
    .await;
    let kc = |p: &str| format!("knowledge.change_sets.{p}");
    let qo = [
        kc("list"),
        kc("create"),
        kc("approve"),
        kc("apply"),
        kc("rollback"),
        "flows.view".into(),
        "flows.switch".into(),
        "flows.publish".into(),
        "flows.build".into(),
    ];
    let qo: Vec<&str> = qo.iter().map(String::as_str).collect();
    let ms = [
        kc("list"),
        kc("approve"),
        "flows.view".into(),
        "flows.publish".into(),
    ];
    let ms: Vec<&str> = ms.iter().map(String::as_str).collect();
    World {
        author: claims(tenant, id(0), "quality_officer", &qo),
        qo: claims(tenant, id(1), "quality_officer", &qo),
        ms: claims(tenant, id(2), "medical_superintendent", &ms),
        ward: claims(tenant, id(3), "super_admin", &[]),
        state: state(pool),
        tenant,
    }
}

impl World {
    async fn admit(&self, department: Option<&str>) -> Uuid {
        let t = self.tenant;
        let n = Uuid::new_v4().simple().to_string();
        let dept = department.map_or_else(
            || "NULL".to_owned(),
            |d| format!("(SELECT id FROM departments WHERE tenant_id = '{t}' AND code = '{d}')"),
        );
        let v = exec(&self.state.db, t, &format!(
            "WITH p AS (INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
               VALUES ('{t}', 'FTR-{n}', 'Pat', 'Track', 'female', '9000000000') RETURNING id), \
             e AS (INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
               SELECT '{t}', id, 'ipd' FROM p RETURNING id, patient_id) \
             INSERT INTO admissions (tenant_id, encounter_id, patient_id, admitting_doctor, admission_number, department_id) \
             SELECT '{t}', e.id, e.patient_id, '{}', 'ADM-{n}', {dept} FROM e RETURNING to_jsonb(id)",
            self.ward.sub
        ))
        .await;
        Uuid::parse_str(v.as_str().unwrap()).unwrap()
    }

    async fn published(&self) -> (i32, Vec<Station>, Uuid, Value) {
        let mut tx = self.state.db.begin().await.unwrap();
        sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
            .bind(self.tenant.to_string())
            .execute(&mut *tx)
            .await
            .unwrap();
        let t = store::published(&mut tx, self.tenant, CODE, false)
            .await
            .unwrap()
            .unwrap();
        (t.version, store::stations(&t).unwrap(), t.id, t.switches)
    }
}

fn physio() -> Station {
    Station {
        key: "physio".to_owned(),
        name: "Physiotherapy clearance".to_owned(),
        stage: "Before billing".to_owned(),
        kind: StationKind::Task {
            task: "ipd.physio_clearance".to_owned(),
        },
        lane: Some("Orthopaedics".to_owned()),
        switch_when: Value::Null,
        fact_when: json!({ "department": "ORTHO" }),
        sla_minutes: Some(60),
        locked: false,
        holder: String::new(),
        holder_role: None,
        required_by: None,
        path: String::new(),
    }
}

fn proposal(template: Uuid, after: Value) -> NewKnowledgeChangeSet {
    NewKnowledgeChangeSet {
        area: Area::FlowSwitches,
        title: "IPD discharge: physiotherapy clearance for orthopaedics".to_owned(),
        reason: "Ortho SOP 7".to_owned(),
        items: vec![NewKnowledgeChangeItem {
            op: Op::Update,
            target_id: Some(template),
            after: Some(after),
        }],
    }
}

#[tokio::test]
#[ignore = "needs-pg"]
#[allow(clippy::too_many_lines)] // one journey, read top to bottom
async fn an_approved_track_reaches_new_discharges_and_running_ones_stay_pinned() {
    let w = world().await;
    let pool = &w.state.db;
    let running = w.admit(Some("ORTHO")).await;
    flows::start(&w.state, &w.ward, CODE, running)
        .await
        .expect("start v1");
    let (v1, mut track, template, switches) = w.published().await;
    let at = track
        .iter()
        .position(|s| s.key == "billing_cleared")
        .unwrap();
    track.insert(at, physio());
    let draft = builder::save(
        pool,
        &w.author,
        CODE,
        SaveDraft {
            revision: 0,
            stations: track,
        },
    )
    .await
    .expect("save")
    .draft
    .unwrap()
    .draft;
    let mut after = json!({ "flow_code": CODE, "track": draft.stations,
                            "draft_id": draft.id, "draft_revision": draft.revision });
    for (k, v) in switches.as_object().unwrap() {
        after[k] = v.clone();
    }
    // Not dry-run: refused on create, whatever the screen showed.
    let err = engine::create(pool, &w.author, &proposal(template, after.clone()))
        .await
        .unwrap_err();
    assert!(err.to_string().contains("test drive"), "{err}");

    builder::dry_run(
        pool,
        &w.author,
        CODE,
        &DryRunRequest {
            revision: draft.revision,
        },
    )
    .await
    .expect("dry run");
    let set = engine::create(pool, &w.author, &proposal(template, after))
        .await
        .expect("create");
    let set = engine::preview(pool, &w.author, set.set.id)
        .await
        .expect("preview");
    let impact = set.set.impact.clone().unwrap().to_string();
    assert!(
        impact.contains("Adds Physiotherapy clearance before Billing cleared"),
        "{impact}"
    );
    engine::approve(pool, &w.qo, set.set.id, None)
        .await
        .expect("QO");
    assert_eq!(w.published().await.0, v1, "one approval changes nothing");
    engine::approve(pool, &w.ms, set.set.id, None)
        .await
        .expect("MS");
    engine::apply(pool, &w.qo, set.set.id).await.expect("apply");
    let (v2, live, _, _) = w.published().await;
    assert_eq!(v2, v1 + 1);
    assert!(live.iter().any(|s| s.key == "physio"));

    // A new orthopaedic discharge stops at physiotherapy before billing...
    let fresh = w.admit(Some("ORTHO")).await;
    let t = flows::start(&w.state, &w.ward, CODE, fresh)
        .await
        .expect("start v2");
    assert_eq!(t.version, v2);
    assert!(
        t.stops
            .iter()
            .any(|s| s.key == "physio" && s.state == "ahead")
    );
    // ...a general one skips it, and the running one keeps version 1.
    let general = w.admit(None).await;
    let t = flows::start(&w.state, &w.ward, CODE, general)
        .await
        .expect("start general");
    assert!(
        t.stops
            .iter()
            .any(|s| s.key == "physio" && s.state == "skipped")
    );
    let old = flows::ticket(&w.state, &w.ward, CODE, running)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(old.version, v1);
    assert!(!old.stops.iter().any(|s| s.key == "physio"));
    let status = exec(
        pool,
        w.tenant,
        &format!(
            "SELECT to_jsonb(status) FROM flow_track_drafts WHERE id = '{}'",
            draft.id
        ),
    )
    .await;
    assert_eq!(status, json!("published"));
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_hand_built_track_is_rechecked_by_the_server() {
    let w = world().await;
    builder::get(&w.state.db, &w.author, CODE)
        .await
        .expect("publishes v1");
    let (_, mut track, template, switches) = w.published().await;
    // No draft, Summary signed removed: refused even though a client "passed" it.
    track.retain(|s| s.key != "summary_signed");
    let mut after = json!({ "flow_code": CODE, "track": track });
    for (k, v) in switches.as_object().unwrap() {
        after[k] = v.clone();
    }
    let err = engine::create(&w.state.db, &w.author, &proposal(template, after))
        .await
        .unwrap_err();
    assert!(matches!(err, AppError::BadRequest(_)), "{err}");
    assert!(err.to_string().contains("must come from a draft"), "{err}");
}

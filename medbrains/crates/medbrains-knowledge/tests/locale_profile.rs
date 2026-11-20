//! RFC-WORLD-READY §2.4: a hospital's locale profile changes only through a
//! change set the hospital administrator drafts, a second person approves and
//! the administrator applies; every other writer is refused by the database;
//! the `tenants` columns follow; a facility sets only its own fields; the
//! currency is fixed once money has moved.
//!
//! ```text
//! DATABASE_URL=postgres://medbrains:medbrains_dev@localhost:5438/medbrains \
//!   cargo test -p medbrains-knowledge --test locale_profile -- --ignored
//! ```

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

use medbrains_knowledge::engine;
use medbrains_knowledge::model::{Area, NewKnowledgeChangeItem, NewKnowledgeChangeSet, Op};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
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

struct World {
    pool: PgPool,
    tenant: Uuid,
    facility: Uuid,
    admin: Claims,
    /// Approves (quality officer): may draft knowledge, not the profile.
    qo: Claims,
}

async fn tx_for(pool: &PgPool, tenant: Uuid) -> sqlx::Transaction<'static, sqlx::Postgres> {
    let mut tx = pool.begin().await.unwrap();
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await
        .unwrap();
    tx
}

/// An Indian hospital as the backfill leaves one, with a facility and two
/// people.
async fn world() -> World {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://medbrains:medbrains_dev@localhost:5438/medbrains".to_owned()
    });
    let pool = PgPool::connect(&url)
        .await
        .expect("needs a migrated database");
    let code = Uuid::new_v4().simple().to_string()[..10].to_uppercase();
    let tenant: Uuid = sqlx::query_scalar(&format!(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ('LOC{code}', 'Locale test', \
         'multi_specialty') RETURNING id"
    ))
    .fetch_one(&pool)
    .await
    .unwrap();
    let mut tx = tx_for(&pool, tenant).await;
    for (key, value) in [
        ("country", json!("IN")),
        ("currency", json!("INR")),
        ("locale", json!("en-IN")),
        ("timezone", json!("Asia/Kolkata")),
        ("fiscal_year_start", json!(4)),
    ] {
        sqlx::query(
            "INSERT INTO tenant_settings (tenant_id, category, key, value) VALUES ($1, 'locale', $2, $3)",
        )
        .bind(tenant)
        .bind(key)
        .bind(value)
        .execute(&mut *tx)
        .await
        .unwrap();
    }
    let facility: Uuid = sqlx::query_scalar(
        "INSERT INTO facilities (tenant_id, code, name, facility_type) \
         VALUES ($1, 'SAT-1', 'Satellite clinic', 'day_care_center') RETURNING id",
    )
    .bind(tenant)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    let mut ids = Vec::new();
    for role in ["hospital_admin", "quality_officer"] {
        let n = Uuid::new_v4().simple().to_string()[..12].to_owned();
        ids.push(
            sqlx::query_scalar::<_, Uuid>(&format!(
                "INSERT INTO users (tenant_id, username, email, full_name, role) VALUES \
                 ('{tenant}', 'u{n}', '{n}@loc.test', 'Test {role}', '{role}') RETURNING id"
            ))
            .fetch_one(&mut *tx)
            .await
            .unwrap(),
        );
    }
    tx.commit().await.unwrap();
    let kc = |a: &str| format!("knowledge.change_sets.{a}");
    let qo_perms = [kc("list"), kc("create"), kc("approve"), kc("apply")];
    let qo_perms: Vec<&str> = qo_perms.iter().map(String::as_str).collect();
    World {
        admin: claims(tenant, ids[0], "hospital_admin", &[]),
        qo: claims(tenant, ids[1], "quality_officer", &qo_perms),
        pool,
        tenant,
        facility,
    }
}

fn change(target: Uuid, after: Value) -> NewKnowledgeChangeSet {
    let mut after = after;
    after["scope_id"] = json!(target);
    NewKnowledgeChangeSet {
        area: Area::LocaleProfile,
        title: "Move to the Dubai rules".to_owned(),
        reason: "The hospital is registered with DHA".to_owned(),
        items: vec![NewKnowledgeChangeItem {
            op: Op::Update,
            target_id: Some(target),
            after: Some(after),
        }],
    }
}

fn dubai() -> Value {
    json!({
        "country": "AE",
        "region": "AE-DU",
        "currency": "AED",
        "locale": "ar-AE",
        "timezone": "Asia/Dubai",
        "fiscal_year_start": 1,
        "calendars": {"primary": "gregory", "also": ["islamic-umalqura"]},
    })
}

async fn tenant_row(w: &World) -> (String, String, i32) {
    sqlx::query_as("SELECT currency, timezone, fy_start_month FROM tenants WHERE id = $1")
        .bind(w.tenant)
        .fetch_one(&w.pool)
        .await
        .unwrap()
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_country_change_needs_a_second_person_and_the_admin_to_apply() {
    let w = world().await;
    // Knowledge drafting alone is not enough: the profile has its own code.
    assert!(matches!(
        engine::create(&w.pool, &w.qo, &change(w.tenant, dubai())).await,
        Err(AppError::Forbidden | AppError::ForbiddenReason(_))
    ));

    let d = engine::create(&w.pool, &w.admin, &change(w.tenant, dubai()))
        .await
        .expect("draft");
    let d = engine::preview(&w.pool, &w.admin, d.set.id)
        .await
        .expect("preview");
    let impact = d.set.impact.clone().unwrap().to_string();
    assert!(
        impact.contains("\"safety\"") && impact.contains("India"),
        "{impact}"
    );
    assert!(impact.contains("AED"), "{impact}");

    assert!(
        engine::approve(&w.pool, &w.admin, d.set.id, None)
            .await
            .is_err(),
        "own change"
    );
    let d = engine::approve(&w.pool, &w.qo, d.set.id, Some("checked DHA licence"))
        .await
        .expect("second person");
    assert_eq!(d.set.status, "approved");
    assert!(
        engine::apply(&w.pool, &w.qo, d.set.id).await.is_err(),
        "only the hospital administrator applies"
    );
    assert_eq!(
        tenant_row(&w).await.0,
        "INR",
        "nothing changed before apply"
    );

    engine::apply(&w.pool, &w.admin, d.set.id)
        .await
        .expect("apply");
    assert_eq!(
        tenant_row(&w).await,
        ("AED".to_owned(), "Asia/Dubai".to_owned(), 1),
        "the tenants columns follow the profile"
    );

    let mut tx = tx_for(&w.pool, w.tenant).await;
    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE tenant_id = $1 \
           AND action = 'knowledge_change.apply_item' AND old_values ? 'country'",
    )
    .bind(w.tenant)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    assert_eq!(audited, 1, "the apply is audited with the values before");
    let profile = medbrains_country::for_user(&mut tx, w.tenant, w.admin.sub)
        .await
        .unwrap();
    assert_eq!(profile.pack, "world", "no UAE pack yet: the floor applies");
    assert_eq!(profile.values["locale"], json!("ar-AE"));
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn every_other_writer_is_refused_by_the_database() {
    let w = world().await;
    let mut tx = tx_for(&w.pool, w.tenant).await;
    let generic = sqlx::query(
        "UPDATE tenant_settings SET value = '\"USD\"' \
          WHERE tenant_id = $1 AND category = 'locale' AND key = 'currency'",
    )
    .bind(w.tenant)
    .execute(&mut *tx)
    .await;
    let code = generic.err().and_then(|e| {
        e.as_database_error()
            .and_then(|d| d.code().map(std::borrow::Cow::into_owned))
    });
    assert_eq!(code.as_deref(), Some("MB409"));
    tx.rollback().await.unwrap();

    let column = sqlx::query("UPDATE tenants SET timezone = 'UTC' WHERE id = $1")
        .bind(w.tenant)
        .execute(&w.pool)
        .await;
    assert!(
        column.is_err(),
        "a column write cannot change a set profile value"
    );
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn a_facility_sets_its_own_zone_but_never_the_currency() {
    let w = world().await;
    let refused = engine::create(
        &w.pool,
        &w.admin,
        &change(w.facility, json!({"currency": "AED"})),
    )
    .await;
    assert!(matches!(refused, Err(AppError::BadRequest(m)) if m.contains("whole hospital")));

    let d = engine::create(
        &w.pool,
        &w.admin,
        &change(w.facility, json!({"timezone": "Asia/Dubai"})),
    )
    .await
    .expect("draft");
    engine::preview(&w.pool, &w.admin, d.set.id)
        .await
        .expect("preview");
    engine::approve(&w.pool, &w.qo, d.set.id, None)
        .await
        .expect("approve");
    engine::apply(&w.pool, &w.admin, d.set.id)
        .await
        .expect("apply");

    let mut tx = tx_for(&w.pool, w.tenant).await;
    sqlx::query(
        "INSERT INTO user_facility_assignments (tenant_id, user_id, facility_id, is_primary) \
         VALUES ($1, $2, $3, true)",
    )
    .bind(w.tenant)
    .bind(w.qo.sub)
    .bind(w.facility)
    .execute(&mut *tx)
    .await
    .unwrap();
    let at_satellite = medbrains_country::for_user(&mut tx, w.tenant, w.qo.sub)
        .await
        .unwrap();
    assert_eq!(at_satellite.values["timezone"], json!("Asia/Dubai"));
    assert_eq!(at_satellite.sources["timezone"], "facility");
    let at_main = medbrains_country::for_user(&mut tx, w.tenant, w.admin.sub)
        .await
        .unwrap();
    assert_eq!(at_main.values["timezone"], json!("Asia/Kolkata"));
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn the_currency_is_fixed_once_money_has_moved() {
    let w = world().await;
    let mut tx = tx_for(&w.pool, w.tenant).await;
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, 'LOC-1', 'Test', 'Patient', 'female', '0000000000') RETURNING id",
    )
    .bind(w.tenant)
    .fetch_one(&mut *tx)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO invoices (tenant_id, invoice_number, patient_id) VALUES ($1, 'LOC-INV-1', $2)",
    )
    .bind(w.tenant)
    .bind(patient)
    .execute(&mut *tx)
    .await
    .unwrap();
    tx.commit().await.unwrap();
    let mut after = dubai();
    after["country"] = json!("IN");
    after["region"] = Value::Null;
    let refused = engine::create(&w.pool, &w.admin, &change(w.tenant, after)).await;
    assert!(matches!(refused, Err(AppError::BadRequest(m)) if m.contains("bills or payments")));
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn the_database_guard_knows_every_profile_field() {
    let w = world().await;
    let guarded: Vec<String> = sqlx::query_scalar("SELECT unnest(public.locale_profile_keys())")
        .fetch_all(&w.pool)
        .await
        .unwrap();
    let mut fields: Vec<String> = medbrains_country::Field::ALL
        .iter()
        .map(|f| f.key().to_owned())
        .collect();
    let mut guarded = guarded;
    guarded.sort();
    fields.sort();
    assert_eq!(
        guarded, fields,
        "migration 1462's guard and Field::ALL disagree"
    );
}

#[tokio::test]
#[ignore = "needs-pg"]
async fn the_impact_names_the_scope() {
    let w = world().await;
    let d = engine::create(
        &w.pool,
        &w.admin,
        &change(w.facility, json!({"timezone": "Asia/Dubai"})),
    )
    .await
    .expect("draft");
    let d = engine::preview(&w.pool, &w.admin, d.set.id)
        .await
        .expect("preview");
    let impact = d.set.impact.clone().unwrap().to_string();
    assert!(impact.contains("Satellite clinic"), "{impact}");
    assert_eq!(
        d.items[0].before.as_ref().unwrap()["scope_name"],
        json!("Satellite clinic")
    );
}

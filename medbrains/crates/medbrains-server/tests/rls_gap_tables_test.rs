//! Row level security on the tables that had none (migration 1200), proven as
//! `medbrains_app` — the role production requests use, which RLS applies to.
//!
//! The isolation tests run in one owner transaction that is rolled back: rows
//! are planted as the owner with triggers and foreign keys off
//! (`session_replication_role = replica`), then read back after
//! `SET LOCAL ROLE medbrains_app` with each hospital's context in turn.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use sqlx::{Connection, Postgres, Transaction};
use uuid::Uuid;

/// Tables with no row level security by design: identical for every hospital,
/// or the registry that tenant resolution reads before any tenant is known.
/// A new table is either tenant-scoped or added here with a reason.
const GLOBAL_TABLES: &[&str] = &[
    "_sqlx_migrations",
    "_sqlx_migrations_pre_baseline",
    // Clinical knowledge base, seeded from committed CSVs.
    "cds_diagnosis_reference",
    "cds_drug_ingredient",
    "cds_drug_reference",
    "cds_ingredient_incompatibility",
    "cds_lab_reference",
    "cds_state_formulary",
    // Device driver marketplace; install_count is a global counter.
    "device_adapter_catalog",
    // Code registries: events and entity schemas.
    "event_registry",
    "event_schemas",
    "module_entity_schemas",
    "geo_countries",
    "geo_districts",
    "geo_states",
    "geo_subdistricts",
    "geo_towns",
    "regulatory_bodies",
    // Public medical news, ingested once for everybody.
    "news_feed_articles",
    "partition_config",
    // SNOMED CT release, loaded once per install.
    "snomed_codes",
    "snomed_concept",
    "snomed_description",
    "snomed_refset_member",
    "snomed_relationship",
    "snomed_release",
    "snomed_transitive_closure",
    // The tenant registry itself: login and domain resolution read it before
    // a tenant is known, and every policy's app_visible_tenants() reads it.
    // Handlers guard it explicitly (require_group_access).
    "tenants",
    "hospital_groups",
    "hospital_regions",
];

/// Reference tables the application only reads.
const READ_ONLY_FOR_APP: &[&str] = &[
    "_sqlx_migrations",
    "cds_diagnosis_reference",
    "cds_drug_ingredient",
    "cds_drug_reference",
    "cds_ingredient_incompatibility",
    "cds_lab_reference",
    "cds_state_formulary",
    "event_registry",
    "event_schemas",
    "module_entity_schemas",
    "geo_countries",
    "geo_states",
    "geo_districts",
    "geo_subdistricts",
    "geo_towns",
    "regulatory_bodies",
    "partition_config",
];

/// (child, foreign key, parent): the child belongs to its parent's hospital.
const TENANT_CHILDREN: &[(&str, &str, &str)] = &[
    ("dashboard_widgets", "dashboard_id", "dashboards"),
    ("cms_post_revisions", "post_id", "cms_posts"),
    ("cms_post_tags", "post_id", "cms_posts"),
    ("cms_post_views", "post_id", "cms_posts"),
    (
        "integration_execution_steps",
        "execution_id",
        "integration_executions",
    ),
    ("lms_course_modules", "course_id", "lms_courses"),
    ("lms_quizzes", "course_id", "lms_courses"),
    ("lms_quiz_questions", "quiz_id", "lms_quizzes"),
    ("lms_learning_path_courses", "path_id", "lms_learning_paths"),
    ("lms_quiz_attempts", "enrollment_id", "lms_enrollments"),
    (
        "stock_disposal_items",
        "disposal_id",
        "stock_disposal_requests",
    ),
];

/// (table, one end, the other end): visible to both hospitals, nobody else.
const TWO_ENDED: &[(&str, &str, &str)] = &[
    ("patient_transfers", "source_tenant_id", "dest_tenant_id"),
    (
        "inter_hospital_stock_transfers",
        "source_tenant_id",
        "dest_tenant_id",
    ),
    ("lab_sample_routes", "source_tenant_id", "dest_tenant_id"),
    (
        "cross_hospital_appointments",
        "booking_tenant_id",
        "service_tenant_id",
    ),
];

const GROUP_MASTERS: &[&str] = &[
    "group_drug_master",
    "group_test_master",
    "group_tariff_master",
    "group_templates",
];

/// Insert one row into `table` with `set` columns fixed; every other NOT NULL
/// column without a default gets a placeholder of its type (text: the first
/// value a CHECK constraint on it allows).
async fn plant(
    tx: &mut Transaction<'_, Postgres>,
    table: &str,
    set: &[(&str, Uuid)],
) -> Result<(), sqlx::Error> {
    let fill: Vec<(String, String)> = sqlx::query_as(
        "SELECT a.attname::text, CASE \
           WHEN t.typtype = 'e' THEN quote_literal((SELECT enumlabel FROM pg_enum \
                WHERE enumtypid = t.oid ORDER BY enumsortorder LIMIT 1)) \
                || '::' || format_type(a.atttypid, a.atttypmod) \
           WHEN t.typcategory = 'A' THEN '''{}''::' || format_type(a.atttypid, a.atttypmod) \
           WHEN t.typcategory = 'S' THEN COALESCE(quote_literal((SELECT substring( \
                pg_get_constraintdef(c.oid) FROM '''([^'']*)''') FROM pg_constraint c \
                WHERE c.conrelid = a.attrelid AND c.contype = 'c' AND a.attnum = ANY (c.conkey) \
                LIMIT 1)), 'left(md5(random()::text), 8)') \
           WHEN t.typname = 'uuid' THEN 'gen_random_uuid()' \
           WHEN t.typcategory = 'N' THEN '1' \
           WHEN t.typcategory = 'B' THEN 'false' \
           WHEN t.typname IN ('json', 'jsonb') THEN '''{}''' \
           WHEN t.typcategory = 'D' THEN 'now()' \
           ELSE 'NULL' END \
         FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid \
         WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped \
           AND a.attnotnull AND NOT a.atthasdef AND a.attidentity = '' \
           AND a.attgenerated = '' ORDER BY a.attnum",
    )
    .bind(format!("public.{table}"))
    .fetch_all(&mut **tx)
    .await?;
    let mut cols: Vec<String> = set.iter().map(|(c, _)| (*c).to_owned()).collect();
    let mut vals: Vec<String> = (1..=set.len()).map(|i| format!("${i}")).collect();
    for (col, expr) in fill {
        if !cols.contains(&col) {
            cols.push(col);
            vals.push(expr);
        }
    }
    let sql = format!(
        "INSERT INTO public.{table} ({}) VALUES ({})",
        cols.join(", "),
        vals.join(", ")
    );
    let mut q = sqlx::query(&sql);
    for (_, v) in set {
        q = q.bind(*v);
    }
    q.execute(&mut **tx).await.map(|_| ())
}

/// A hospital nobody else uses, optionally in `group`.
async fn hospital(tx: &mut Transaction<'_, Postgres>, group: Option<Uuid>) -> Uuid {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type, group_id) \
         VALUES ($1, 'RLS gap probe', (SELECT hospital_type FROM tenants LIMIT 1), $2) RETURNING id",
    )
    .bind(format!("RLSGAP-{}", tag.to_uppercase()))
    .bind(group)
    .fetch_one(&mut **tx)
    .await
    .expect("tenant")
}

async fn group(tx: &mut Transaction<'_, Postgres>) -> Uuid {
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    sqlx::query_scalar(
        "INSERT INTO hospital_groups (code, name) VALUES ($1, 'RLS gap') RETURNING id",
    )
    .bind(format!("RLSGAP-{}", tag.to_uppercase()))
    .fetch_one(&mut **tx)
    .await
    .expect("group")
}

/// Owner transaction with triggers and foreign keys off, for planting rows.
async fn planting(app: &common::TestApp) -> Transaction<'static, Postgres> {
    let mut tx = app.db.begin().await.expect("tx");
    sqlx::query("SET LOCAL session_replication_role = replica")
        .execute(&mut *tx)
        .await
        .expect("replica");
    tx
}

/// From here on the transaction is `medbrains_app`, working at `tenant`.
async fn as_app(tx: &mut Transaction<'_, Postgres>, tenant: Uuid) {
    sqlx::raw_sql("SET LOCAL session_replication_role = origin; SET LOCAL ROLE medbrains_app")
        .execute(&mut **tx)
        .await
        .expect("role");
    sqlx::query("SELECT set_config('app.tenant_id', $1, true)")
        .bind(tenant.to_string())
        .execute(&mut **tx)
        .await
        .expect("tenant");
}

async fn visible(
    tx: &mut Transaction<'_, Postgres>,
    table: &str,
    col: &str,
    ids: &[Uuid],
) -> Vec<Uuid> {
    sqlx::query_scalar(&format!(
        "SELECT {col} FROM public.{table} WHERE {col} = ANY($1) ORDER BY 1"
    ))
    .bind(ids)
    .fetch_all(&mut **tx)
    .await
    .unwrap_or_else(|e| panic!("{table}: {e}"))
}

#[tokio::test]
async fn every_table_without_rls_is_declared_global() {
    let app = common::spawn_app().await;
    let open: Vec<String> = sqlx::query_scalar(
        "SELECT c.relname::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace \
         WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relispartition \
           AND NOT c.relrowsecurity AND c.relname NOT LIKE 'zz\\_%' ORDER BY 1",
    )
    .fetch_all(&app.db)
    .await
    .expect("tables");
    let undeclared: Vec<&String> = open
        .iter()
        .filter(|t| !GLOBAL_TABLES.contains(&t.as_str()))
        .collect();
    assert!(
        undeclared.is_empty(),
        "tables with no row level security: {undeclared:?}. Give them a tenant policy, \
         or add them to GLOBAL_TABLES with the reason they hold no hospital's data"
    );
}

#[tokio::test]
async fn reference_tables_are_read_only_for_the_app() {
    let app = common::spawn_app().await;
    for t in READ_ONLY_FOR_APP {
        let (read, write): (bool, bool) = sqlx::query_as(
            "SELECT has_table_privilege('medbrains_app', $1, 'SELECT'), \
                    has_table_privilege('medbrains_app', $1, 'INSERT, UPDATE, DELETE, TRUNCATE')",
        )
        .bind(format!("public.{t}"))
        .fetch_one(&app.db)
        .await
        .expect("grants");
        assert_eq!((read, write), (true, false), "{t}: read yes, write no");
    }
}

#[tokio::test]
async fn a_hospital_sees_only_its_own_child_rows() {
    let app = common::spawn_app().await;
    let mut tx = planting(&app).await;
    // Same group, not sharing clinical records: still two hospitals' data.
    let g = group(&mut tx).await;
    let (a, b) = (
        hospital(&mut tx, Some(g)).await,
        hospital(&mut tx, Some(g)).await,
    );
    let mut parents = Vec::new();
    for (child, fk, parent) in TENANT_CHILDREN {
        let (pa, pb) = (Uuid::new_v4(), Uuid::new_v4());
        for (p, t) in [(pa, a), (pb, b)] {
            plant(&mut tx, parent, &[("id", p), ("tenant_id", t)])
                .await
                .expect(parent);
            plant(&mut tx, child, &[(fk, p), ("tenant_id", t)])
                .await
                .expect(child);
        }
        parents.push((pa, pb));
    }
    as_app(&mut tx, a).await;
    for ((child, fk, parent), (pa, pb)) in TENANT_CHILDREN.iter().zip(&parents) {
        assert_eq!(
            visible(&mut tx, child, fk, &[*pa, *pb]).await,
            vec![*pa],
            "{child}"
        );

        // The trigger takes the hospital from the parent, whatever was sent,
        // and a child of another hospital's parent is refused.
        let only_parent_fk: bool = sqlx::query_scalar(
            "SELECT count(*) = 1 FROM pg_constraint WHERE conrelid = $1::regclass AND contype = 'f'",
        )
        .bind(format!("public.{child}"))
        .fetch_one(&mut *tx)
        .await
        .expect("fks");
        if !only_parent_fk {
            continue;
        }
        let mut sp = Connection::begin(&mut *tx).await.expect("savepoint");
        plant(&mut sp, child, &[(fk, *pa), ("tenant_id", b)])
            .await
            .expect(child);
        let owner: Vec<Uuid> = sqlx::query_scalar(&format!(
            "SELECT DISTINCT tenant_id FROM public.{child} WHERE {fk} = $1"
        ))
        .bind(pa)
        .fetch_all(&mut *sp)
        .await
        .expect("tenant");
        assert_eq!(owner, vec![a], "{child} takes its hospital from {parent}");
        sp.rollback().await.expect("rollback");
        let mut sp = Connection::begin(&mut *tx).await.expect("savepoint");
        assert!(
            plant(&mut sp, child, &[(fk, *pb)]).await.is_err(),
            "{child}: attached to another hospital's {parent}"
        );
        sp.rollback().await.expect("rollback");
    }
    tx.rollback().await.expect("rollback");
}

#[tokio::test]
async fn a_two_hospital_record_is_visible_at_both_ends_only() {
    let app = common::spawn_app().await;
    let mut tx = planting(&app).await;
    let g = group(&mut tx).await;
    let (a, b) = (
        hospital(&mut tx, Some(g)).await,
        hospital(&mut tx, Some(g)).await,
    );
    let c = hospital(&mut tx, None).await;
    let (ab, cc) = (Uuid::new_v4(), Uuid::new_v4());
    for (table, from, to) in TWO_ENDED {
        for (id, s, d) in [(ab, a, b), (cc, c, c)] {
            plant(&mut tx, table, &[("id", id), (from, s), (to, d)])
                .await
                .expect(table);
        }
    }
    for transfer in [ab, cc] {
        plant(
            &mut tx,
            "inter_hospital_stock_transfer_items",
            &[("transfer_id", transfer)],
        )
        .await
        .expect("item");
    }
    for (who, sees) in [(a, ab), (b, ab), (c, cc)] {
        let mut sp = Connection::begin(&mut *tx).await.expect("savepoint");
        as_app(&mut sp, who).await;
        for (table, ..) in TWO_ENDED {
            assert_eq!(
                visible(&mut sp, table, "id", &[ab, cc]).await,
                vec![sees],
                "{table}"
            );
        }
        let items = visible(
            &mut sp,
            "inter_hospital_stock_transfer_items",
            "transfer_id",
            &[ab, cc],
        )
        .await;
        assert_eq!(
            items,
            vec![sees],
            "stock transfer lines follow their transfer"
        );
        sp.rollback().await.expect("rollback");
    }
    tx.rollback().await.expect("rollback");
}

#[tokio::test]
async fn group_masters_are_shared_within_the_group_only() {
    let app = common::spawn_app().await;
    let mut tx = planting(&app).await;
    let (g, h) = (group(&mut tx).await, group(&mut tx).await);
    let (a, b) = (
        hospital(&mut tx, Some(g)).await,
        hospital(&mut tx, Some(g)).await,
    );
    let (c, alone) = (
        hospital(&mut tx, Some(h)).await,
        hospital(&mut tx, None).await,
    );
    for table in GROUP_MASTERS {
        for grp in [g, h] {
            plant(&mut tx, table, &[("group_id", grp)])
                .await
                .expect(table);
        }
    }
    for (who, sees) in [(a, vec![g]), (b, vec![g]), (c, vec![h]), (alone, vec![])] {
        let mut sp = Connection::begin(&mut *tx).await.expect("savepoint");
        as_app(&mut sp, who).await;
        for table in GROUP_MASTERS {
            assert_eq!(
                visible(&mut sp, table, "group_id", &[g, h]).await,
                sees,
                "{table}"
            );
        }
        sp.rollback().await.expect("rollback");
    }
    let mut sp = Connection::begin(&mut *tx).await.expect("savepoint");
    as_app(&mut sp, a).await;
    assert!(
        plant(&mut sp, "group_drug_master", &[("group_id", h)])
            .await
            .is_err(),
        "a hospital cannot write another group's master"
    );
    sp.rollback().await.expect("rollback");
    tx.rollback().await.expect("rollback");
}

// ── The screens that use these tables, as medbrains_app ─────────────────

async fn send(app: &common::TestApp, csrf: &str, method: &str, path: &str, body: Value) -> Value {
    let req = match method {
        "POST" => app.client.post(app.url(path)),
        "PUT" => app.client.put(app.url(path)),
        "DELETE" => app.client.delete(app.url(path)),
        _ => app.client.get(app.url(path)),
    };
    let resp = req
        .header("x-csrf-token", csrf)
        .json(&body)
        .send()
        .await
        .expect(path);
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    assert!(status.is_success(), "{method} {path}: {status} {text}");
    if status == StatusCode::NO_CONTENT {
        return Value::Null;
    }
    serde_json::from_str(&text).unwrap_or(Value::Null)
}

fn id(v: &Value) -> String {
    v["id"].as_str().unwrap_or_default().to_owned()
}

#[tokio::test]
async fn transfers_group_templates_and_quizzes_work_under_rls() {
    let app = common::spawn_app_as_request_role().await;
    let csrf = app.login_admin().await;
    let (admin, home): (Uuid, Uuid) =
        sqlx::query_as("SELECT id, tenant_id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let g: Uuid = sqlx::query_scalar(
        "INSERT INTO hospital_groups (code, name) VALUES ($1, 'RLS gap flows') RETURNING id",
    )
    .bind(format!("RLSGAP-{}", tag.to_uppercase()))
    .fetch_one(&app.db)
    .await
    .expect("group");
    let dest: Uuid = sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type, group_id) \
         VALUES ($1, 'RLS gap destination', (SELECT hospital_type FROM tenants WHERE id = $2), $3) \
         RETURNING id",
    )
    .bind(format!("RLSGAP-{}", tag.to_uppercase()))
    .bind(home)
    .bind(g)
    .fetch_one(&app.db)
    .await
    .expect("destination");
    let previous_group: Option<Uuid> =
        sqlx::query_scalar("SELECT group_id FROM tenants WHERE id = $1")
            .bind(home)
            .fetch_one(&app.db)
            .await
            .expect("group before");
    sqlx::query("UPDATE tenants SET group_id = $2 WHERE id = $1")
        .bind(home)
        .bind(g)
        .execute(&app.db)
        .await
        .expect("join group");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth) \
         VALUES ($1, $2, 'Meena', 'Raj', 'female'::gender, '9000000412', '1975-01-02') RETURNING id",
    )
    .bind(home)
    .bind(format!("UH-RLS-{tag}"))
    .fetch_one(&app.db)
    .await
    .expect("patient");

    // Patient transfer to the other hospital in the group.
    let t = send(
        &app,
        &csrf,
        "POST",
        "/api/multi-hospital/transfers/patients",
        json!({ "dest_tenant_id": dest, "patient_id": patient, "reason": "ICU bed" }),
    )
    .await;
    let out = send(
        &app,
        &csrf,
        "GET",
        "/api/multi-hospital/transfers/patients/outgoing",
        json!({}),
    )
    .await;
    assert!(
        out.to_string().contains(&id(&t)),
        "outgoing lists the transfer"
    );
    send(
        &app,
        &csrf,
        "GET",
        &format!("/api/multi-hospital/transfers/patients/{}", id(&t)),
        json!({}),
    )
    .await;

    // Stock transfer with a line.
    let s = send(&app, &csrf, "POST", "/api/multi-hospital/transfers/stock", json!({
        "dest_tenant_id": dest,
        "items": [{ "item_id": Uuid::new_v4(), "item_code": "PCM500", "item_name": "Paracetamol 500",
                    "requested_qty": 10.0, "unit": "strip" }]
    })).await;
    let items = send(
        &app,
        &csrf,
        "GET",
        &format!("/api/multi-hospital/transfers/stock/{}/items", id(&s)),
        json!({}),
    )
    .await;
    assert_eq!(
        items.as_array().map(Vec::len),
        Some(1),
        "the line is visible"
    );
    let out = send(
        &app,
        &csrf,
        "GET",
        "/api/multi-hospital/transfers/stock/outgoing",
        json!({}),
    )
    .await;
    assert!(
        out.to_string().contains(&id(&s)),
        "outgoing lists the stock transfer"
    );

    // Group template: create, list, read, retire.
    let tpl = send(
        &app,
        &csrf,
        "POST",
        &format!("/api/multi-hospital/groups/{g}/templates"),
        json!({ "template_type": "discharge", "code": format!("DS-{tag}"), "name": "Discharge",
                "content": {} }),
    )
    .await;
    let list = send(
        &app,
        &csrf,
        "GET",
        &format!("/api/multi-hospital/groups/{g}/templates"),
        json!({}),
    )
    .await;
    assert!(
        list.to_string().contains(&id(&tpl)),
        "the group lists its template"
    );
    send(
        &app,
        &csrf,
        "GET",
        &format!("/api/multi-hospital/templates/{}", id(&tpl)),
        json!({}),
    )
    .await;
    send(
        &app,
        &csrf,
        "DELETE",
        &format!("/api/multi-hospital/templates/{}", id(&tpl)),
        json!({}),
    )
    .await;

    // LMS: course, quiz, question, enrolment, attempt.
    let course = send(
        &app,
        &csrf,
        "POST",
        "/api/lms/courses",
        json!({ "code": format!("RLS-{tag}"), "title": "Hand hygiene" }),
    )
    .await;
    let quiz = send(
        &app,
        &csrf,
        "POST",
        &format!("/api/lms/courses/{}/quizzes", id(&course)),
        json!({ "title": "Five moments" }),
    )
    .await;
    let q = send(
        &app,
        &csrf,
        "POST",
        &format!("/api/lms/quizzes/{}/questions", id(&quiz)),
        json!({ "question_text": "Before touching a patient?", "options": ["yes", "no"],
                "correct_answer": "yes" }),
    )
    .await;
    send(
        &app,
        &csrf,
        "POST",
        "/api/lms/enrollments",
        json!({ "user_id": admin, "course_id": id(&course) }),
    )
    .await;
    let attempt = send(
        &app,
        &csrf,
        "POST",
        "/api/lms/my/quiz-attempts",
        json!({ "quiz_id": id(&quiz) }),
    )
    .await;
    assert_eq!(
        attempt["questions"].as_array().map(Vec::len),
        Some(1),
        "the question is visible"
    );
    let attempt_id = attempt["attempt_id"].as_str().unwrap_or_default();
    let result = send(
        &app,
        &csrf,
        "PUT",
        &format!("/api/lms/my/quiz-attempts/{attempt_id}"),
        json!({ "answers": [{ "question_id": id(&q), "selected": "yes" }] }),
    )
    .await;
    assert_eq!(result["passed"], json!(true), "{result}");

    sqlx::query("UPDATE tenants SET group_id = $2 WHERE id = $1")
        .bind(home)
        .bind(previous_group)
        .execute(&app.db)
        .await
        .expect("leave group");
}

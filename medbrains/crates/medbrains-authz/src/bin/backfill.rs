//! ReBAC backfill CLI — emits derived tuples from existing FK columns.
//!
//! Usage:
//!     cargo run -p medbrains-authz --bin rebac-backfill -- \
//!         --tenant <uuid> [--dry-run]
//!
//! Idempotent: SpiceDB `WriteRelationships` with `Touch` operation
//! upserts. Re-runs are safe (no duplicates).
//!
//! Streams in batches of `BATCH_SIZE` (5000) to keep wire-time small
//! and SpiceDB GC manageable. Per-FK tuple counts printed at the end.

use std::env;

use medbrains_authz::backend_spicedb::SpiceDbBackend;
use medbrains_authz::{AuthzBackend, AuthzContext, Subject, relations::Relation};
use sqlx::PgPool;
use uuid::Uuid;

const BATCH_SIZE: usize = 5_000;

#[tokio::main(flavor = "current_thread")]
async fn main() -> anyhow::Result<()> {
    // ── Parse args ──────────────────────────────────────────
    let args: Vec<String> = env::args().collect();
    let mut tenant: Option<Uuid> = None;
    let mut dry_run = false;
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--tenant" => {
                i += 1;
                tenant = Some(args[i].parse()?);
            }
            "--dry-run" => dry_run = true,
            "--help" | "-h" => {
                eprintln!(
                    "usage: rebac-backfill --tenant <uuid> [--dry-run]\n\n\
                     Emits derived tuples to SpiceDB from existing FK columns:\n\
                       patients.registered_by    → patient:#owner@user:\n\
                       encounters.doctor_id      → encounter:#attending@user:\n\
                       encounters.department_id  → encounter:#dept_member@department:#member\n\
                       admissions.admitting_doctor → admission:#attending@user:\n\
                       lab_orders.ordered_by     → lab_order:#ordering_provider@user:\n\
                       pharmacy_orders.ordered_by → pharmacy_order:#prescriber@user:\n\
                       radiology_orders.ordered_by → radiology_order:#ordering_provider@user:\n\
                       access_group_members      → access_group:#member@user:\n\
                       users.department_ids[]    → department:#member@user:\n"
                );
                return Ok(());
            }
            other => {
                eprintln!("unknown flag: {other}");
                std::process::exit(2);
            }
        }
        i += 1;
    }

    let tenant = tenant.ok_or_else(|| anyhow::anyhow!("--tenant <uuid> required"))?;

    // ── Connect ─────────────────────────────────────────────
    let database_url = env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL env required"))?;
    let pg = PgPool::connect(&database_url).await?;

    let spicedb_endpoint =
        env::var("SPICEDB_ENDPOINT").unwrap_or_else(|_| "http://localhost:50051".to_owned());
    let spicedb_token = env::var("SPICEDB_TOKEN").unwrap_or_else(|_| "devsecret".to_owned());
    let backend = SpiceDbBackend::connect(&spicedb_endpoint, &spicedb_token).await?;

    // System context — bypass so writes go through unconditionally.
    let ctx = AuthzContext {
        tenant_id: tenant,
        user_id: Uuid::nil(),
        role: "super_admin".to_owned(),
        department_ids: vec![],
        is_bypass: true,
    };

    println!(
        "rebac-backfill — tenant={} endpoint={} dry_run={}",
        tenant, spicedb_endpoint, dry_run
    );

    let mut total_written = 0u64;

    // ── 1. patients.registered_by → patient#owner ───────────
    let rows: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT id, registered_by FROM patients \
         WHERE tenant_id = $1 AND registered_by IS NOT NULL",
    )
    .bind(tenant)
    .fetch_all(&pg)
    .await?;
    total_written += write_raw_batch(
        &backend,
        "patient",
        "owner",
        &rows,
        |(id, by)| (*id, Subject::User(*by)),
        "patients.registered_by",
        dry_run,
    )
    .await?;

    // ── 2. encounters.doctor_id → encounter#attending ───────
    let rows: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT id, doctor_id FROM encounters \
         WHERE tenant_id = $1 AND doctor_id IS NOT NULL",
    )
    .bind(tenant)
    .fetch_all(&pg)
    .await?;
    total_written += write_raw_batch(
        &backend,
        "encounter",
        "attending",
        &rows,
        |(id, by)| (*id, Subject::User(*by)),
        "encounters.doctor_id",
        dry_run,
    )
    .await?;

    // ── 3. encounters.department_id → encounter#dept_member@department#member
    let rows: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT id, department_id FROM encounters \
         WHERE tenant_id = $1 AND department_id IS NOT NULL",
    )
    .bind(tenant)
    .fetch_all(&pg)
    .await?;
    total_written += write_raw_batch(
        &backend,
        "encounter",
        "dept_member",
        &rows,
        |(id, dept)| (*id, Subject::Department(*dept)),
        "encounters.department_id",
        dry_run,
    )
    .await?;

    // ── 4. admissions.admitting_doctor → admission#attending
    let rows: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT id, admitting_doctor FROM admissions WHERE tenant_id = $1",
    )
    .bind(tenant)
    .fetch_all(&pg)
    .await?;
    total_written += write_raw_batch(
        &backend,
        "admission",
        "attending",
        &rows,
        |(id, by)| (*id, Subject::User(*by)),
        "admissions.admitting_doctor",
        dry_run,
    )
    .await?;

    // ── 5. lab_orders.ordered_by → lab_order#ordering_provider
    let rows: Vec<(Uuid, Uuid)> =
        sqlx::query_as("SELECT id, ordered_by FROM lab_orders WHERE tenant_id = $1")
            .bind(tenant)
            .fetch_all(&pg)
            .await?;
    total_written += write_raw_batch(
        &backend,
        "lab_order",
        "ordering_provider",
        &rows,
        |(id, by)| (*id, Subject::User(*by)),
        "lab_orders.ordered_by",
        dry_run,
    )
    .await?;

    // ── 6. pharmacy_orders.ordered_by → pharmacy_order#prescriber
    let rows: Vec<(Uuid, Uuid)> =
        sqlx::query_as("SELECT id, ordered_by FROM pharmacy_orders WHERE tenant_id = $1")
            .bind(tenant)
            .fetch_all(&pg)
            .await?;
    total_written += write_raw_batch(
        &backend,
        "pharmacy_order",
        "prescriber",
        &rows,
        |(id, by)| (*id, Subject::User(*by)),
        "pharmacy_orders.ordered_by",
        dry_run,
    )
    .await?;

    // ── 7. radiology_orders.ordered_by → radiology_order#ordering_provider
    let rows: Vec<(Uuid, Uuid)> =
        sqlx::query_as("SELECT id, ordered_by FROM radiology_orders WHERE tenant_id = $1")
            .bind(tenant)
            .fetch_all(&pg)
            .await?;
    total_written += write_raw_batch(
        &backend,
        "radiology_order",
        "ordering_provider",
        &rows,
        |(id, by)| (*id, Subject::User(*by)),
        "radiology_orders.ordered_by",
        dry_run,
    )
    .await?;

    // ── 8. access_group_members → access_group#member ───────
    let rows: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT group_id, user_id FROM access_group_members \
         WHERE tenant_id = $1 \
           AND (expires_at IS NULL OR expires_at > now())",
    )
    .bind(tenant)
    .fetch_all(&pg)
    .await?;
    total_written += write_raw_batch(
        &backend,
        "access_group",
        "member",
        &rows,
        |(g, u)| (*g, Subject::User(*u)),
        "access_group_members",
        dry_run,
    )
    .await?;

    // ── 9. users.department_ids[] → department#member ───────
    let rows: Vec<(Uuid, Vec<Uuid>)> = sqlx::query_as(
        "SELECT id, department_ids FROM users \
         WHERE tenant_id = $1 AND coalesce(array_length(department_ids, 1), 0) > 0",
    )
    .bind(tenant)
    .fetch_all(&pg)
    .await?;
    let mut dept_pairs: Vec<(Uuid, Uuid)> = Vec::with_capacity(rows.len() * 2);
    for (uid, depts) in rows {
        for d in depts {
            dept_pairs.push((d, uid));
        }
    }
    total_written += write_raw_batch(
        &backend,
        "department",
        "member",
        &dept_pairs,
        |(d, u)| (*d, Subject::User(*u)),
        "users.department_ids",
        dry_run,
    )
    .await?;

    println!(
        "\n✅ done — total tuples written: {} (dry_run={})",
        total_written, dry_run
    );
    Ok(())
}

/// Write a slice of (object_id, subject) pairs as derived tuples
/// using a `Relation` enum value (which maps to a SpiceDB schema
/// relation name internally). For relations the enum doesn't cover
/// (dept_member, member, ward_member), use `write_raw_batch`.
async fn write_batch<T>(
    backend: &SpiceDbBackend,
    ctx: &AuthzContext,
    object_type: &str,
    relation: Relation,
    rows: &[T],
    map: impl Fn(&T) -> (Uuid, Subject),
    label: &str,
    dry_run: bool,
) -> anyhow::Result<u64> {
    if rows.is_empty() {
        println!("  {label:<32} 0 rows");
        return Ok(0);
    }
    if dry_run {
        println!("  {label:<32} {} rows (dry-run)", rows.len());
        return Ok(rows.len() as u64);
    }
    let total = rows.len();
    let mut written = 0u64;
    for chunk in rows.chunks(BATCH_SIZE) {
        for row in chunk {
            let (object_id, subject) = map(row);
            backend
                .write_tuple(
                    ctx,
                    object_type,
                    object_id,
                    relation,
                    subject,
                    None,
                    Some(format!("backfill:{label}")),
                )
                .await
                .map_err(|e| anyhow::anyhow!("write_tuple {object_type} {object_id}: {e}"))?;
            written += 1;
        }
        println!("  {label:<32} {written}/{total}");
    }
    Ok(written)
}

/// Write tuples with an explicit relation name string. Used for
/// `dept_member`, `member`, `ward_member` etc. that aren't in the
/// `Relation` enum.
async fn write_raw_batch<T>(
    backend: &SpiceDbBackend,
    object_type: &str,
    relation_name: &str,
    rows: &[T],
    map: impl Fn(&T) -> (Uuid, Subject),
    label: &str,
    dry_run: bool,
) -> anyhow::Result<u64> {
    if rows.is_empty() {
        println!("  {label:<32} 0 rows");
        return Ok(0);
    }
    if dry_run {
        println!("  {label:<32} {} rows (dry-run)", rows.len());
        return Ok(rows.len() as u64);
    }
    let total = rows.len();
    let mut written = 0u64;
    for chunk in rows.chunks(BATCH_SIZE) {
        for row in chunk {
            let (object_id, subject) = map(row);
            backend
                .write_raw(object_type, object_id, relation_name, subject, None)
                .await
                .map_err(|e| {
                    anyhow::anyhow!("write_raw {object_type}#{relation_name} {object_id}: {e}")
                })?;
            written += 1;
        }
        println!("  {label:<32} {written}/{total}");
    }
    Ok(written)
}

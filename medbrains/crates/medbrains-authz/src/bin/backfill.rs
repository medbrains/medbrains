//! `ReBAC` backfill CLI — emits derived tuples from existing FK columns.
//!
//! Usage:
//!     cargo run -p medbrains-authz --bin rebac-backfill -- \
//!         --tenant <uuid> [--dry-run]
//!
//! Writes to `relation_tuples` — the durable store — and lets the outbox
//! worker push to `SpiceDB`. It used to write straight to `SpiceDB`, which put
//! grants in the index that the store had never heard of: invisible to the
//! Postgres fallback, and lost the moment the index is rebuilt from the store.
//!
//! Idempotent via `NOT EXISTS` on the logical triple. Re-runs are safe.
//!
//! Streams in batches of `BATCH_SIZE` (5000) to keep wire-time small
//! and `SpiceDB` GC manageable. Per-FK tuple counts printed at the end.

// CLI binary — println / eprintln are the user-facing UI.
#![allow(clippy::print_stdout, clippy::print_stderr)]

use std::env;

use medbrains_authz::Subject;
use sqlx::PgPool;
use uuid::Uuid;

const BATCH_SIZE: usize = 5_000;

#[tokio::main(flavor = "current_thread")]
async fn main() -> anyhow::Result<()> {
    // ── Parse args ──────────────────────────────────────────
    let args: Vec<String> = env::args().collect();
    let mut tenant: Option<Uuid> = None;
    let mut dry_run = false;
    let mut granted_by: Option<Uuid> = None;
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--tenant" => {
                i += 1;
                tenant = Some(args[i].parse()?);
            }
            "--dry-run" => dry_run = true,
            "--granted-by" => {
                i += 1;
                granted_by = Some(args[i].parse()?);
            }
            "--help" | "-h" => {
                eprintln!(
                    "usage: rebac-backfill --tenant <uuid> [--granted-by <uuid>] [--dry-run]\n\n\
                     Inserts derived tuples into relation_tuples (the durable store;\n\
                     the outbox worker pushes them to SpiceDB) from existing FK columns:\n\
                       patients.registered_by    → patient:#owner@user:\n\
                       encounters.doctor_id      → encounter:#attending@user:\n\
                       encounters.created_by     → encounter:#owner@user:\n\
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
    let database_url =
        env::var("DATABASE_URL").map_err(|_| anyhow::anyhow!("DATABASE_URL env required"))?;
    let pg = PgPool::connect(&database_url).await?;

    // `granted_by` is NOT NULL and belongs in the audit trail — "who granted
    // this" for a derived tuple is the operator who ran the backfill, not the
    // clinician the grant is about. Resolved from the tenant's admin unless
    // given explicitly, so the row names a real accountable account.
    let granted_by = match granted_by {
        Some(id) => id,
        None => sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM users \
             WHERE tenant_id = $1 AND role IN ('super_admin', 'hospital_admin') \
               AND deleted_at IS NULL \
             ORDER BY created_at LIMIT 1",
        )
        .bind(tenant)
        .fetch_optional(&pg)
        .await?
        .ok_or_else(|| {
            anyhow::anyhow!(
                "no admin user in tenant {tenant} to attribute the backfill to; \
                 pass --granted-by <uuid>"
            )
        })?,
    };

    println!(
        "rebac-backfill — tenant={tenant} granted_by={granted_by} dry_run={dry_run}\n\
         writing to relation_tuples (source='derived'); the outbox worker syncs SpiceDB"
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
    total_written += write_derived_batch(
        &pg,
        tenant,
        granted_by,
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
    total_written += write_derived_batch(
        &pg,
        tenant,
        granted_by,
        "encounter",
        "attending",
        &rows,
        |(id, by)| (*id, Subject::User(*by)),
        "encounters.doctor_id",
        dry_run,
    )
    .await?;

    // ── 2b. encounters.created_by → encounter#owner ─────────
    // `schema.zed` declares this edge ("FK: encounters.created_by") and nothing
    // was writing it, so the relation that feeds view/edit/delete/share had no
    // tuples at all. `doctor_id` is null on every encounter in this dataset,
    // which makes `created_by` the only user-subject edge an encounter has.
    let rows: Vec<(Uuid, Uuid)> = sqlx::query_as(
        "SELECT id, created_by FROM encounters \
         WHERE tenant_id = $1 AND created_by IS NOT NULL",
    )
    .bind(tenant)
    .fetch_all(&pg)
    .await?;
    total_written += write_derived_batch(
        &pg,
        tenant,
        granted_by,
        "encounter",
        "owner",
        &rows,
        |(id, by)| (*id, Subject::User(*by)),
        "encounters.created_by",
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
    total_written += write_derived_batch(
        &pg,
        tenant,
        granted_by,
        "encounter",
        "dept_member",
        &rows,
        |(id, dept)| (*id, Subject::Department(*dept)),
        "encounters.department_id",
        dry_run,
    )
    .await?;

    // ── 4. admissions.admitting_doctor → admission#attending
    let rows: Vec<(Uuid, Uuid)> =
        sqlx::query_as("SELECT id, admitting_doctor FROM admissions WHERE tenant_id = $1")
            .bind(tenant)
            .fetch_all(&pg)
            .await?;
    total_written += write_derived_batch(
        &pg,
        tenant,
        granted_by,
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
    total_written += write_derived_batch(
        &pg,
        tenant,
        granted_by,
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
    total_written += write_derived_batch(
        &pg,
        tenant,
        granted_by,
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
    total_written += write_derived_batch(
        &pg,
        tenant,
        granted_by,
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
    total_written += write_derived_batch(
        &pg,
        tenant,
        granted_by,
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
    total_written += write_derived_batch(
        &pg,
        tenant,
        granted_by,
        "department",
        "member",
        &dept_pairs,
        |(d, u)| (*d, Subject::User(*u)),
        "users.department_ids",
        dry_run,
    )
    .await?;

    println!("\n✅ done — total tuples written: {total_written} (dry_run={dry_run})");
    Ok(())
}

/// Insert derived tuples into `relation_tuples`, the durable store.
///
/// **Not** straight into `SpiceDB`, which is what this did before. Two reasons.
///
/// `relation_tuples` is the write-ahead store and `SpiceDB` is an index built
/// from it — that is the whole premise of `DurableSpiceDbBackend`. A grant that
/// exists only in the index is invisible to `PgAuthzBackend`, which is what
/// serves every check when the sidecar is unreachable or `SPICEDB_ENDPOINT` is
/// unset; and it does not survive rebuilding the index from the store, because
/// there is nothing in the store to rebuild it from. Backfilling 300k grants
/// into the index alone builds exactly the divergence the outbox exists to
/// prevent.
///
/// Second, the old path made one gRPC round trip *per row* — `BATCH_SIZE` only
/// chunked the progress line. This is a single multi-row INSERT per chunk.
///
/// Idempotent by `NOT EXISTS` on the logical triple rather than `ON CONFLICT`:
/// the table has no unique index on it, only a primary key on `tuple_id`.
async fn write_derived_batch<T>(
    pg: &PgPool,
    tenant: Uuid,
    granted_by: Uuid,
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
    // A dry run does the real INSERT and rolls it back, rather than counting
    // source rows. Counting source rows over-reports every time: 364 patients
    // have a `registered_by`, but tuples for them already exist, so the honest
    // answer is 0 and the old dry run would have promised 364. One code path
    // means the rehearsal cannot disagree with the performance.
    let total = rows.len();
    let mut written = 0u64;
    let mut tx = pg.begin().await?;
    for chunk in rows.chunks(BATCH_SIZE) {
        let mut object_ids: Vec<Uuid> = Vec::with_capacity(chunk.len());
        let mut subject_types: Vec<String> = Vec::with_capacity(chunk.len());
        let mut subject_ids: Vec<String> = Vec::with_capacity(chunk.len());
        for row in chunk {
            let (object_id, subject) = map(row);
            let (kind, id) = match subject {
                Subject::User(u) => ("user", u.to_string()),
                Subject::Department(d) => ("department", d.to_string()),
                Subject::Group(g) => ("group", g.to_string()),
                Subject::Role(r) => ("role", r),
                Subject::TupleSet(t) => ("tuple_set", t),
            };
            object_ids.push(object_id);
            subject_types.push(kind.to_owned());
            subject_ids.push(id);
        }

        // `spicedb_sync_status` defaults to 'pending', so the outbox worker
        // picks these up and pushes them to the index — the same path a live
        // grant takes. Nothing here talks to SpiceDB directly.
        let inserted = sqlx::query(
            "INSERT INTO relation_tuples (
                 tuple_id, tenant_id, object_type, object_id, relation,
                 subject_type, subject_id, granted_by, granted_reason,
                 source, derived_from
             )
             SELECT gen_random_uuid(), $1, $2, t.object_id, $3,
                    t.subject_type, t.subject_id, $4, $5, 'derived', $5
             FROM UNNEST($6::uuid[], $7::text[], $8::text[])
                  AS t(object_id, subject_type, subject_id)
             WHERE NOT EXISTS (
                 SELECT 1 FROM relation_tuples existing
                 WHERE existing.tenant_id = $1
                   AND existing.object_type = $2
                   AND existing.object_id = t.object_id
                   AND existing.relation = $3
                   AND existing.subject_type = t.subject_type
                   AND existing.subject_id = t.subject_id
                   AND existing.status = 'active'
             )",
        )
        .bind(tenant)
        .bind(object_type)
        .bind(relation_name)
        .bind(granted_by)
        .bind(label)
        .bind(&object_ids)
        .bind(&subject_types)
        .bind(&subject_ids)
        .execute(&mut *tx)
        .await
        .map_err(|e| anyhow::anyhow!("insert {object_type}#{relation_name}: {e}"))?;

        written += inserted.rows_affected();
    }

    if dry_run {
        tx.rollback().await?;
        println!("  {label:<32} {written} new / {total} scanned (dry-run, rolled back)");
    } else {
        tx.commit().await?;
        println!("  {label:<32} {written} new / {total} scanned");
    }
    Ok(written)
}

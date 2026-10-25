//! Running one batch: masters and earlier imports loaded once, then every
//! record checked and written inside its own savepoint.

use std::collections::{HashMap, HashSet};

use chrono::{DateTime, Utc};
use medbrains_server_core::error::AppError;
use uuid::Uuid;

use crate::{
    Kind, Record, Tally, clinical,
    ctx::{Ctx, Ref},
    money, orders, patients,
};

/// Masters and earlier imports, each loaded once for the whole batch.
pub(crate) async fn load_context<'t>(
    mut tx: sqlx::Transaction<'t, sqlx::Postgres>,
    tenant: Uuid,
    user: Uuid,
    batch: Uuid,
    go_live: DateTime<Utc>,
    records: &[Record],
) -> Result<Ctx<'t>, AppError> {
    let departments: HashMap<String, Uuid> = sqlx::query_as::<_, (String, Uuid)>(
        "SELECT upper(code), id FROM departments WHERE tenant_id = $1 AND deleted_at IS NULL AND is_active",
    )
    .bind(tenant)
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .collect();
    let doctors: HashMap<String, Uuid> = sqlx::query_as::<_, (String, Uuid)>(
        "SELECT lower(username), id FROM users WHERE tenant_id = $1 AND role::text = 'doctor' \
            AND is_active AND deleted_at IS NULL",
    )
    .bind(tenant)
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .collect();
    let named = |rows: Vec<(String, Uuid, String)>| {
        rows.into_iter()
            .map(|(c, id, n)| (c.to_uppercase(), (id, n)))
            .collect()
    };
    let lab_tests = named(
        sqlx::query_as("SELECT code, id, name FROM lab_test_catalog WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL")
            .bind(tenant)
            .fetch_all(&mut *tx)
            .await?,
    );
    let drugs = named(
        sqlx::query_as("SELECT code, id, name FROM pharmacy_catalog WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL")
            .bind(tenant)
            .fetch_all(&mut *tx)
            .await?,
    );
    let mentioned: Vec<String> = records
        .iter()
        .flat_map(Record::mentions)
        .map(str::to_owned)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    let patients_by_uhid = sqlx::query_as::<_, (String, Uuid)>(
        "SELECT uhid, id FROM patients WHERE tenant_id = $1 AND uhid = ANY($2) AND deleted_at IS NULL",
    )
    .bind(tenant)
    .bind(&mentioned)
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .collect();
    let tz: String =
        sqlx::query_scalar("SELECT COALESCE((SELECT timezone FROM tenants WHERE id = $1), 'UTC')")
            .bind(tenant)
            .fetch_one(&mut *tx)
            .await?;
    let refs = load_refs(&mut tx, tenant, &mentioned).await?;
    Ok(Ctx {
        tx,
        tenant,
        user,
        batch,
        go_live,
        now: Utc::now(),
        tz,
        problems: Vec::new(),
        departments,
        doctors,
        lab_tests,
        drugs,
        refs,
        patients_by_uhid,
        at: (0, Kind::Patient, String::new()),
    })
}

type RefRow = (
    String,
    String,
    Uuid,
    DateTime<Utc>,
    Option<Uuid>,
    Option<Uuid>,
    Option<Uuid>,
);

async fn load_refs(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant: Uuid,
    mentioned: &[String],
) -> Result<HashMap<(Kind, String), Ref>, AppError> {
    let rows = sqlx::query_as::<_, RefRow>(
        "SELECT r.kind, r.external_id, r.target_id, r.occurred_at, \
                COALESCE(p.id, e.patient_id, a.patient_id, i.patient_id, lo.patient_id, po.patient_id, c.patient_id), \
                COALESCE(e.id, a.encounter_id, i.encounter_id), COALESCE(a.id, i.admission_id) \
           FROM history_import_records r \
           LEFT JOIN patients p ON r.target_table = 'patients' AND p.id = r.target_id \
           LEFT JOIN encounters e ON r.target_table = 'encounters' AND e.id = r.target_id \
           LEFT JOIN admissions a ON r.target_table = 'admissions' AND a.id = r.target_id \
           LEFT JOIN invoices i ON r.target_table = 'invoices' AND i.id = r.target_id \
           LEFT JOIN lab_orders lo ON r.target_table = 'lab_orders' AND lo.id = r.target_id \
           LEFT JOIN pharmacy_orders po ON r.target_table = 'pharmacy_orders' AND po.id = r.target_id \
           LEFT JOIN insurance_claims c ON r.target_table = 'insurance_claims' AND c.id = r.target_id \
          WHERE r.tenant_id = $1 AND r.external_id = ANY($2) AND r.deleted_at IS NULL",
    )
    .bind(tenant)
    .bind(mentioned)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .filter_map(|(kind, ext, id, at, patient, encounter, admission)| {
            Some((
                (Kind::parse(&kind)?, ext),
                Ref {
                    id,
                    patient: patient?,
                    encounter,
                    admission,
                    at,
                },
            ))
        })
        .collect())
}

pub(crate) async fn import_all(
    ctx: &mut Ctx<'_>,
    records: &[Record],
) -> Result<Vec<Tally>, AppError> {
    let mut order: Vec<(usize, &Record)> = records.iter().enumerate().collect();
    order.sort_by_key(|(i, r)| (r.kind(), *i));
    let mut tallies: Vec<Tally> = Vec::new();
    let mut seen: HashSet<(Kind, &str)> = HashSet::new();
    for (i, record) in order {
        let (kind, ext) = (record.kind(), record.external_id().trim());
        ctx.at = (i + 1, kind, ext.to_owned());
        let pos = tallies
            .iter()
            .position(|t| t.kind == kind)
            .unwrap_or_else(|| {
                tallies.push(Tally {
                    kind,
                    added: 0,
                    skipped: 0,
                });
                tallies.len() - 1
            });
        if ext.is_empty() {
            ctx.problem(
                "external_id",
                "Every record needs the id it had in the old system",
            );
            continue;
        }
        if !seen.insert((kind, ext)) {
            ctx.problem("external_id", "This external id appears twice in the batch");
            continue;
        }
        if ctx.refs.contains_key(&(kind, ext.to_owned())) {
            tallies[pos].skipped += 1;
            continue;
        }
        if import_one(ctx, record).await? {
            tallies[pos].added += 1;
        }
    }
    Ok(tallies)
}

/// One record inside its own savepoint, so a refused record leaves no trace
/// and the rest of the batch can still be checked.
async fn import_one(ctx: &mut Ctx<'_>, record: &Record) -> Result<bool, AppError> {
    let before = ctx.problems.len();
    sqlx::query("SAVEPOINT history_record")
        .execute(&mut *ctx.tx)
        .await?;
    let made = match record {
        Record::Patient(r) => patients::patient(ctx, r).await,
        Record::Visit(r) => clinical::visit(ctx, r).await,
        Record::Admission(r) => clinical::admission(ctx, r).await,
        Record::LabOrder(r) => orders::lab_order(ctx, r).await,
        Record::Dispense(r) => orders::dispense(ctx, r).await,
        Record::Invoice(r) => money::invoice(ctx, r).await,
        Record::Claim(r) => money::claim(ctx, r).await,
    };
    let made = match made {
        Ok(made) => made,
        // A database refusal (a duplicate legacy bill number, a broken constraint) is a problem
        // with this record, not a failure of the batch.
        Err(AppError::Database(e)) => {
            ctx.problem("record", format!("The database refused it: {e}"));
            None
        }
        Err(other) => return Err(other),
    };
    let ok = made.is_some() && ctx.problems.len() == before;
    let sql = if ok {
        "RELEASE SAVEPOINT history_record"
    } else {
        "ROLLBACK TO SAVEPOINT history_record"
    };
    sqlx::query(sql).execute(&mut *ctx.tx).await?;
    if let (true, Some(r)) = (ok, made) {
        let (_, kind, ext) = ctx.at.clone();
        ctx.remember(kind, &ext, r);
    }
    Ok(ok)
}

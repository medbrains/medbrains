//! The pull. Order matters: departments → designations → employees (then
//! reporting lines and department heads) → credentials, shifts, leaves,
//! balances → the roster / on-call and attendance windows, which name shifts.

use std::time::Duration;

use chrono::Utc;
use medbrains_server_core::error::AppError;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{Acquire, PgPool};
use uuid::Uuid;

use crate::upserts::{record_key, upsert_sql};
use crate::{HUMANEX, HumanexConfig, Tx, load_config, providers};

const PAGE: usize = 500;
/// A run stops after this many pages of one entity (100k rows) and resumes
/// from its cursor on the next pass, so a feed that never ends cannot pin it.
const MAX_PAGES: usize = 200;
/// Roster window: a week back, a month ahead. Attendance: the last week.
const ROSTER_BACK_DAYS: i64 = 7;
const ROSTER_AHEAD_DAYS: i64 = 31;
const ATTENDANCE_BACK_DAYS: i64 = 7;
const PAGED: [&str; 7] = [
    "departments",
    "designations",
    "employees",
    "credentials",
    "shifts",
    "leaves",
    "leave_balances",
];

/// How one entity's pull went.
#[derive(Debug, Serialize)]
pub struct EntityOutcome {
    pub entity: String,
    pub upserted: usize,
    pub failed: usize,
    pub error: Option<String>,
}

impl EntityOutcome {
    fn new(entity: &str) -> Self {
        Self {
            entity: entity.to_owned(),
            upserted: 0,
            failed: 0,
            error: None,
        }
    }
}

struct Client {
    http: reqwest::Client,
    base: String,
    key: String,
}

#[derive(Deserialize)]
struct Page {
    items: Vec<Value>,
    next_cursor: Option<String>,
}

impl Client {
    fn new(cfg: &HumanexConfig) -> Result<Self, AppError> {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| AppError::Internal(format!("http client: {e}")))?;
        Ok(Self {
            http,
            base: cfg.base_url.trim_end_matches('/').to_owned(),
            key: cfg.api_key.clone(),
        })
    }

    async fn get<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        query: &[(&str, String)],
    ) -> Result<T, String> {
        let res = self
            .http
            .get(format!("{}{path}", self.base))
            .bearer_auth(&self.key)
            .query(query)
            .send()
            .await
            .map_err(|e| format!("Humanex {path} did not answer: {e}"))?;
        if !res.status().is_success() {
            return Err(format!("Humanex {path} answered HTTP {}", res.status()));
        }
        res.json()
            .await
            .map_err(|e| format!("Humanex {path} sent a body we cannot read: {e}"))
    }
}

async fn tenant_tx(pool: &PgPool, tenant_id: Uuid) -> Result<Tx<'_>, AppError> {
    let mut tx = pool.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id).await?;
    Ok(tx)
}

/// Pull every entity for one tenant from each provider its routing names.
/// A feed that fails is recorded on its entity and the run moves on, so one
/// Humanex hiccup does not stall the rest.
///
/// # Errors
/// Not configured, a routing setup naming a provider with no adapter, or a
/// database fault.
pub async fn sync_tenant(pool: &PgPool, tenant_id: Uuid) -> Result<Vec<EntityOutcome>, AppError> {
    let mut tx = tenant_tx(pool, tenant_id).await?;
    let cfg = load_config(&mut tx, tenant_id).await?;
    let route = providers(&mut tx, tenant_id).await?;
    tx.commit().await?;
    let cfg = cfg.ok_or_else(|| AppError::BadRequest("Humanex HRMS is not set up".into()))?;
    let mut outcomes = Vec::new();
    for provider in route {
        // ponytail: the only adapter. A second one brings the hub's
        // `Connector` trait and its fallback / fan-out combining.
        if provider.as_str() != HUMANEX {
            return Err(AppError::BadRequest(format!(
                "No HRMS adapter for '{}'",
                provider.as_str()
            )));
        }
        outcomes.extend(pull_humanex(pool, tenant_id, &cfg).await?);
    }
    Ok(outcomes)
}

async fn pull_humanex(
    pool: &PgPool,
    tenant_id: Uuid,
    cfg: &HumanexConfig,
) -> Result<Vec<EntityOutcome>, AppError> {
    let client = Client::new(cfg)?;
    let mut links = Links::default();
    let mut outcomes = Vec::new();
    for entity in PAGED {
        outcomes.push(pull_paged(pool, (tenant_id, cfg), &client, entity, &mut links).await?);
    }
    links.apply(pool, tenant_id).await?;
    let today = Utc::now().date_naive();
    let windows = [
        (
            "roster",
            today - chrono::Duration::days(ROSTER_BACK_DAYS),
            today + chrono::Duration::days(ROSTER_AHEAD_DAYS),
        ),
        (
            "attendance",
            today - chrono::Duration::days(ATTENDANCE_BACK_DAYS),
            today,
        ),
    ];
    for (entity, from, to) in windows {
        let query = [("from", from.to_string()), ("to", to.to_string())];
        let mut out = EntityOutcome::new(entity);
        match client
            .get::<Vec<Value>>(&format!("/sync/v1/{entity}"), &query)
            .await
        {
            Ok(rows) => {
                for chunk in rows.chunks(PAGE) {
                    apply_batch(pool, (tenant_id, cfg), entity, chunk, &mut out).await?;
                }
            }
            Err(e) => out.error = Some(e),
        }
        save_state(pool, tenant_id, None, &out).await?;
        outcomes.push(out);
    }
    Ok(outcomes)
}

/// Reporting lines and department heads, set once both sides exist.
#[derive(Default)]
struct Links {
    reports_to: Vec<(String, String)>,
    dept_heads: Vec<(String, String)>,
}

impl Links {
    fn collect(&mut self, entity: &str, d: &Value) {
        let s = |k: &str| d.get(k).and_then(Value::as_str).map(String::from);
        let (list, a, b) = match entity {
            "employees" => (&mut self.reports_to, "employee_code", "reporting_to_code"),
            "departments" => (&mut self.dept_heads, "code", "head_employee_code"),
            _ => return,
        };
        if let (Some(x), Some(y)) = (s(a), s(b)) {
            list.push((x, y));
        }
    }

    async fn apply(&self, pool: &PgPool, tenant_id: Uuid) -> Result<(), AppError> {
        if self.reports_to.is_empty() && self.dept_heads.is_empty() {
            return Ok(());
        }
        let unzip =
            |v: &[(String, String)]| -> (Vec<String>, Vec<String>) { v.iter().cloned().unzip() };
        let (codes, managers) = unzip(&self.reports_to);
        let (depts, heads) = unzip(&self.dept_heads);
        let mut tx = tenant_tx(pool, tenant_id).await?;
        // One statement per kind, not one per row.
        sqlx::query(
            "UPDATE employees e SET reporting_to = m.id \
             FROM unnest($2::text[], $3::text[]) AS l(code, mgr) \
             JOIN employees m ON m.tenant_id = $1 AND m.employee_code = l.mgr \
             WHERE e.tenant_id = $1 AND e.employee_code = l.code",
        )
        .bind(tenant_id)
        .bind(&codes)
        .bind(&managers)
        .execute(&mut *tx)
        .await?;
        sqlx::query(
            "UPDATE departments d SET head_employee_id = e.id \
             FROM unnest($2::text[], $3::text[]) AS l(code, head) \
             JOIN employees e ON e.tenant_id = $1 AND e.employee_code = l.head \
             WHERE d.tenant_id = $1 AND d.code = l.code AND d.deleted_at IS NULL",
        )
        .bind(tenant_id)
        .bind(&depts)
        .bind(&heads)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        Ok(())
    }
}

async fn pull_paged(
    pool: &PgPool,
    (tenant_id, cfg): (Uuid, &HumanexConfig),
    client: &Client,
    entity: &str,
    links: &mut Links,
) -> Result<EntityOutcome, AppError> {
    let mut out = EntityOutcome::new(entity);
    let mut cursor = stored_cursor(pool, tenant_id, entity).await?;
    for _ in 0..MAX_PAGES {
        let mut q = vec![("limit", PAGE.to_string())];
        if let Some(c) = &cursor {
            q.push(("cursor", c.clone()));
        }
        let page: Page = match client.get(&format!("/sync/v1/{entity}"), &q).await {
            Ok(p) => p,
            Err(e) => {
                out.error = Some(e);
                break;
            }
        };
        for d in &page.items {
            links.collect(entity, d);
        }
        apply_batch(pool, (tenant_id, cfg), entity, &page.items, &mut out).await?;
        cursor = page.next_cursor.or(cursor);
        save_state(pool, tenant_id, cursor.as_deref(), &out).await?;
        if page.items.len() < PAGE {
            break; // drained; the cursor marks where the next run resumes
        }
    }
    Ok(out)
}

async fn stored_cursor(
    pool: &PgPool,
    tenant_id: Uuid,
    entity: &str,
) -> Result<Option<String>, AppError> {
    let mut tx = tenant_tx(pool, tenant_id).await?;
    let cursor: Option<Option<String>> = sqlx::query_scalar(
        "SELECT cursor FROM hrms_sync_state \
         WHERE tenant_id = $1 AND provider = $2 AND entity = $3",
    )
    .bind(tenant_id)
    .bind(HUMANEX)
    .bind(entity)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(cursor.flatten())
}

/// Apply one batch in one tenant transaction, one savepoint per row; a row
/// that fails is kept in `hrms_sync_exceptions` with its payload.
async fn apply_batch(
    pool: &PgPool,
    (tenant_id, cfg): (Uuid, &HumanexConfig),
    entity: &str,
    docs: &[Value],
    out: &mut EntityOutcome,
) -> Result<(), AppError> {
    let mut tx = tenant_tx(pool, tenant_id).await?;
    for doc in docs {
        let Some(sql) = upsert_sql(entity, doc) else {
            continue;
        };
        let mut sp = (&mut tx).begin().await?;
        let applied = sqlx::query(sql)
            .bind(tenant_id)
            .bind(doc)
            .bind(cfg.system_user_id)
            .execute(&mut *sp)
            .await;
        match applied {
            Ok(_) => {
                sp.commit().await?;
                out.upserted += 1;
            }
            Err(e) => {
                sp.rollback().await?;
                out.failed += 1;
                record_exception(&mut tx, tenant_id, entity, doc, &e.to_string()).await?;
            }
        }
    }
    tx.commit().await?;
    Ok(())
}

async fn record_exception(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    entity: &str,
    doc: &Value,
    error: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO hrms_sync_exceptions \
           (tenant_id, provider, entity, record_key, error, payload) \
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(tenant_id)
    .bind(HUMANEX)
    .bind(entity)
    .bind(record_key(entity, doc))
    .bind(error)
    .bind(doc)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn save_state(
    pool: &PgPool,
    tenant_id: Uuid,
    cursor: Option<&str>,
    out: &EntityOutcome,
) -> Result<(), AppError> {
    let count = |n: usize| i32::try_from(n).unwrap_or(i32::MAX);
    let mut tx = tenant_tx(pool, tenant_id).await?;
    sqlx::query(
        "INSERT INTO hrms_sync_state \
           (tenant_id, provider, entity, cursor, last_run_at, last_status, last_error, \
            upserted, failed) \
         VALUES ($1, $2, $3, $4, now(), $5, $6, $7, $8) \
         ON CONFLICT (tenant_id, provider, entity) DO UPDATE SET \
             cursor = coalesce(EXCLUDED.cursor, hrms_sync_state.cursor), last_run_at = now(), \
             last_status = EXCLUDED.last_status, last_error = EXCLUDED.last_error, \
             upserted = EXCLUDED.upserted, failed = EXCLUDED.failed",
    )
    .bind(tenant_id)
    .bind(HUMANEX)
    .bind(&out.entity)
    .bind(cursor)
    .bind(if out.error.is_some() { "error" } else { "ok" })
    .bind(&out.error)
    .bind(count(out.upserted))
    .bind(count(out.failed))
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(())
}

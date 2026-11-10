//! The assistant's read-only query, for a question no report answers.
//!
//! Holders of `ai.assistant.query` get one more tool: the model writes one
//! SELECT over the curated `ai_query` views (migration 1220). It runs only
//! after [`super::query_check`] accepts it, as the statement printed from its
//! parse, inside a transaction that is read-only, time-boxed and capped, as
//! the role `medbrains_ai_query` — which can read those views and nothing
//! else — with the user's hospital as the row-level-security context.
//!
//! The rows go to the user's screen through the widget shelf; the model gets
//! them through the redactor (restricted classes withheld, `patient_key`
//! dropped, small counts shown as "<5" to a user who may not list patients)
//! and, when long, only their ends plus exact totals. Every attempt — run,
//! refused or failed — is written to `ai_query_log`.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use std::sync::atomic::{AtomicU8, Ordering};
use std::time::Instant;

use medbrains_core::ai_widgets::{compact_for_model, summary};
use medbrains_core::permissions;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde_json::{Value, json};

use super::query_check::{self, Refusal};

/// Rows read at most; one more is fetched to know the result was cut.
const MAX_ROWS: usize = 500;
/// Attempts per turn: the first and one corrected retry.
const MAX_ATTEMPTS: u8 = 2;
/// Read-only, time-boxed, memory-capped, then the query role.
const SESSION: &[&str] = &[
    "SET TRANSACTION READ ONLY",
    "SET LOCAL statement_timeout = '3s'",
    "SET LOCAL lock_timeout = '1s'",
    "SET LOCAL work_mem = '16MB'",
];
const AS_QUERY_ROLE: &[&str] = &[
    "SET LOCAL search_path = ai_query",
    "SET LOCAL ROLE medbrains_ai_query",
];

/// Views with no patient in them, open to every holder of the permission.
const OPERATIONAL: &[&str] = &["departments", "staff", "beds", "incidents"];
/// Views with a `patient_key`: need sight of every patient, not a subset.
const CLINICAL: &[&str] = &["visits", "admissions", "diagnoses", "lab_orders"];
/// Views with money (`billing.amount`): need `billing.reports.view` too.
const FINANCIAL: &[&str] = &["invoices", "payments", "insurance_claims", "pharmacy_sales"];
/// Financial views that also carry a `patient_key`.
const FINANCIAL_WITH_PATIENT: &[&str] = &["invoices", "insurance_claims"];
/// Columns that name a period, never a count.
const PERIOD_COLUMNS: &[&str] = &["year", "month", "week", "day", "hour", "quarter", "dow"];

/// The views `claims` may query; `all_patients` is whether the user sees
/// every patient (no visibility subset).
pub(super) fn permitted_views(claims: &Claims, all_patients: bool) -> Vec<&'static str> {
    let money = require_permission(claims, permissions::billing::reports::VIEW).is_ok();
    let mut views = OPERATIONAL.to_vec();
    if all_patients {
        views.extend(CLINICAL);
    }
    if money {
        views.extend(
            FINANCIAL
                .iter()
                .filter(|v| all_patients || !FINANCIAL_WITH_PATIENT.contains(v)),
        );
    }
    views
}

/// Rows as the user and the model may see them: no `patient_key`, and
/// counts of 1–4 as "<5" for a user who may not list patients.
pub(super) fn safe_rows(mut rows: Vec<Value>, can_list: bool) -> Vec<Value> {
    for row in &mut rows {
        let Some(map) = row.as_object_mut() else {
            continue;
        };
        map.remove("patient_key");
        if can_list {
            continue;
        }
        for (k, v) in map.iter_mut() {
            let small = v.as_i64().is_some_and(|n| (1..=4).contains(&n));
            if small && !PERIOD_COLUMNS.contains(&k.to_lowercase().as_str()) {
                *v = json!("<5");
            }
        }
    }
    rows
}

/// What the model is told about a result.
pub(super) fn told(rows: &[Value], cut: bool, source: &str) -> Value {
    let mut told = json!({
        "rows": compact_for_model(&Value::Array(rows.to_vec())),
        "row_count": rows.len(),
        "show_source": source,
    });
    if cut {
        told["incomplete"] = json!(format!(
            "only the first {MAX_ROWS} rows were read; aggregate in SQL instead"
        ));
    }
    if rows.is_empty() {
        told["rows"] = json!("none");
    } else if rows.len() > 1 && told["rows"].is_array() {
        // A short result is sent whole; its totals and extremes come with it
        // so the one sentence beside the widget need not add anything up.
        told["summary_of_all_rows"] = summary(rows);
    }
    told
}

enum Ran {
    Rows(Vec<Value>),
    Timeout,
    Failed(String),
}

async fn read_rows(
    db: &sqlx::PgPool,
    at: Hospital<'_>,
    wrapped: &str,
) -> Result<String, sqlx::Error> {
    let mut tx = db.begin().await?;
    for statement in SESSION {
        sqlx::query(statement).execute(&mut *tx).await?;
    }
    medbrains_db::pool::set_full_context(&mut tx, at.0, at.1)
        .await
        .map_err(|e| sqlx::Error::Protocol(e.to_string()))?;
    for statement in AS_QUERY_ROLE {
        sqlx::query(statement).execute(&mut *tx).await?;
    }
    let text: String = sqlx::query_scalar(wrapped).fetch_one(&mut *tx).await?;
    tx.rollback().await?;
    Ok(text)
}

/// The hospital and departments a query runs at.
type Hospital<'a> = (&'a uuid::Uuid, &'a [uuid::Uuid]);

async fn run(db: &sqlx::PgPool, at: Hospital<'_>, sql: &str) -> Ran {
    let wrapped = format!(
        "SELECT COALESCE(json_agg(r), '[]'::json)::text FROM \
         (SELECT * FROM ({sql}) q LIMIT {}) r",
        MAX_ROWS + 1
    );
    match read_rows(db, at, &wrapped).await {
        Ok(text) => serde_json::from_str::<Vec<Value>>(&text)
            .map_or_else(|e| Ran::Failed(e.to_string()), Ran::Rows),
        Err(sqlx::Error::Database(e)) if e.code().as_deref() == Some("57014") => Ran::Timeout,
        Err(sqlx::Error::Database(e)) => Ran::Failed(e.message().to_owned()),
        Err(e) => {
            tracing::warn!(target: "ai", error = %e, "ai query failed");
            Ran::Failed("the database could not be reached".to_owned())
        }
    }
}

#[derive(serde::Deserialize)]
pub(super) struct QueryArgs {
    sql: String,
    /// The user's question, as the model read it.
    #[serde(default)]
    question: String,
}

/// The read-only query tool; registered only for holders of the permission.
pub(super) struct QueryTool {
    pub(super) session: super::redaction::Session,
    pub(super) state: AppState,
    pub(super) claims: Claims,
    pub(super) shelf: super::show::Shelf,
    pub(super) attempts: AtomicU8,
}

/// One attempt, for the audit log.
struct Attempt<'a> {
    args: &'a QueryArgs,
    sql: &'a str,
    outcome: &'a str,
    reason: Option<&'a str>,
    rows: Option<usize>,
    started: Instant,
}

impl QueryTool {
    async fn answer(&self, args: &QueryArgs) -> String {
        if self.attempts.fetch_add(1, Ordering::Relaxed) >= MAX_ATTEMPTS {
            return "Not available: the query was refused twice. Tell the user this question \
                    cannot be answered from the data you can reach."
                .to_owned();
        }
        let started = Instant::now();
        let all_patients = matches!(
            medbrains_authz_gate::visible_patient_ids(&self.state, &self.claims).await,
            Ok(None)
        );
        let views = permitted_views(&self.claims, all_patients);
        let sql = match query_check::check(&args.sql, &views) {
            Ok(sql) => sql,
            Err(Refusal(why)) => {
                self.log(Attempt {
                    args,
                    sql: &args.sql,
                    outcome: "refused",
                    reason: Some(&why),
                    rows: None,
                    started,
                })
                .await;
                return format!(
                    "Refused: {why}. Correct it and try once more, or say it cannot be answered."
                );
            }
        };
        let at = (
            &self.claims.tenant_id,
            self.claims.department_ids.as_slice(),
        );
        match run(&self.state.db, at, &sql).await {
            Ran::Rows(rows) => {
                self.log(Attempt {
                    args,
                    sql: &sql,
                    outcome: "ok",
                    reason: None,
                    rows: Some(rows.len()),
                    started,
                })
                .await;
                self.shown(rows)
            }
            Ran::Timeout => {
                self.log(Attempt {
                    args,
                    sql: &sql,
                    outcome: "timeout",
                    reason: None,
                    rows: None,
                    started,
                })
                .await;
                "Not available: the query took too long and was stopped. Say the figure is \
                 unavailable right now; do not estimate it."
                    .to_owned()
            }
            Ran::Failed(why) => {
                self.log(Attempt {
                    args,
                    sql: &sql,
                    outcome: "failed",
                    reason: Some(&why),
                    rows: None,
                    started,
                })
                .await;
                format!(
                    "Failed: {why}. Correct it and try once more, or say it cannot be answered."
                )
            }
        }
    }

    fn shown(&self, mut rows: Vec<Value>) -> String {
        let cut = rows.len() > MAX_ROWS;
        rows.truncate(MAX_ROWS);
        let mut rows = safe_rows(rows, super::aggregate::can_list(&self.claims));
        let mut all = Value::Array(std::mem::take(&mut rows));
        if let Err(e) = medbrains_core::ai_redact::sensitive::withhold_in_json(&mut all) {
            tracing::error!(target: "ai", error = %e, "query result withheld");
            return super::UNKNOWN_FOR_MODEL.to_owned();
        }
        let rows = match all {
            Value::Array(rows) => rows,
            _ => Vec::new(),
        };
        let n = self.attempts.load(Ordering::Relaxed);
        let source = format!("query:{n}");
        super::show::shelve(
            &self.shelf,
            &self.session,
            &source,
            &Value::Array(rows.clone()),
        );
        told(&rows, cut, &source).to_string()
    }

    async fn log(&self, a: Attempt<'_>) {
        if let Err(e) = write_log(&self.state, &self.claims, &a).await {
            tracing::error!(target: "ai", error = %e, outcome = a.outcome, "ai query not logged");
        }
    }
}

async fn write_log(state: &AppState, claims: &Claims, a: &Attempt<'_>) -> Result<(), sqlx::Error> {
    let act = claims.act.as_ref();
    let ms = i32::try_from(a.started.elapsed().as_millis()).unwrap_or(i32::MAX);
    let rows = a.rows.and_then(|n| i32::try_from(n).ok());
    let question: String = a.args.question.chars().take(500).collect();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id)
        .await
        .map_err(|e| sqlx::Error::Protocol(e.to_string()))?;
    sqlx::query(
        "INSERT INTO ai_query_log (tenant_id, user_id, conversation_id, run_id, model, \
         question, sql, outcome, reason, row_count, duration_ms) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(act.and_then(|a| a.conversation_id))
    .bind(act.map(|a| a.run_id))
    .bind(act.map_or("unknown", |a| a.model.as_str()))
    .bind(question)
    .bind(a.sql)
    .bind(a.outcome)
    .bind(a.reason)
    .bind(rows)
    .bind(ms)
    .execute(&mut *tx)
    .await?;
    tx.commit().await
}

impl rig::tool::Tool for QueryTool {
    const NAME: &'static str = "query";
    type Error = std::convert::Infallible;
    type Args = QueryArgs;
    type Output = medbrains_core::ai_redact::Redacted;

    fn description(&self) -> String {
        format!(
            "Last resort, for a whole-hospital question no listed API or aggregate metric \
            answers: one PostgreSQL SELECT over the views of schema {schema}. Views: \
            departments(department, department_type, is_active); staff(department, role, \
            designation, is_active, date_of_joining); beds(ward, ward_type, is_occupied); \
            incidents(incident_date, incident_type, incident_category, severity, department, \
            patient_involved, patient_harm_level); visits(visit_date, encounter_type, visit_type, \
            status, department, doctor, patient_key); admissions(admitted_at, discharged_at, \
            status, department, ward, ip_type, admission_source, discharge_type, priority, \
            is_critical, length_of_stay_days, patient_key); diagnoses(diagnosed_on, \
            encounter_type, department, icd_code, diagnosis, is_primary, patient_key); \
            lab_orders(ordered_at, test, department, status, priority, is_stat, collected_at, \
            completed_at, turnaround_minutes, has_critical_result, patient_key); \
            invoices(invoice_date, status, department, doctor, is_interim, subtotal, \
            discount_amount, tax_amount, total_amount, paid_amount, patient_key); \
            payments(paid_at, amount, mode, payment_type, status); insurance_claims(submitted_at, \
            settled_at, status, claim_type, scheme_type, insurance_provider, tpa_name, \
            claim_amount, pre_auth_amount, approved_amount, settled_amount, patient_key); \
            pharmacy_sales(sale_date, status, payment_mode, subtotal, discount_amount, \
            gst_amount, total_amount, refund_amount). patient_key is only for \
            count(DISTINCT patient_key). Aggregate in SQL (GROUP BY) — at most {MAX_ROWS} rows \
            are read. Dates: current_date and intervals, e.g. invoice_date >= current_date - \
            interval '12 months'. Exclude status 'cancelled' for money. A refusal says why; \
            correct and retry once. Show the result with show(source = its show_source).",
            schema = query_check::SCHEMA
        )
    }

    fn parameters(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "sql": { "type": "string", "description": "One SELECT (WITH allowed)" },
                "question": { "type": "string", "description": "The user's question it answers" }
            },
            "required": ["sql", "question"]
        })
    }

    async fn call(
        &self,
        _context: &mut rig::tool::ToolContext,
        args: Self::Args,
    ) -> Result<Self::Output, Self::Error> {
        Ok(super::redaction::for_model(
            &self.session,
            &self.answer(&args).await,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::{safe_rows, told};
    use serde_json::json;

    #[test]
    fn rows_lose_the_patient_key_and_small_counts_without_list_permission() {
        let rows =
            vec![json!({"month": 3, "department": "ENT", "patients": 3, "patient_key": "ab"})];
        let hidden = safe_rows(rows.clone(), false);
        assert_eq!(
            hidden[0],
            json!({"month": 3, "department": "ENT", "patients": "<5"})
        );
        let shown = safe_rows(rows, true);
        assert_eq!(
            shown[0],
            json!({"month": 3, "department": "ENT", "patients": 3})
        );
    }

    #[test]
    fn the_model_is_told_ends_and_totals_of_a_long_result() {
        let rows: Vec<_> = (1..=60).map(|d| json!({"day": d, "billed": 100})).collect();
        let t = told(&rows, true, "query:1");
        assert_eq!(t["row_count"], 60);
        assert_eq!(t["rows"]["rows_total"], 60);
        assert_eq!(t["rows"]["summary_of_all_rows"]["billed"]["sum"], "6000");
        assert!(t["incomplete"].as_str().is_some_and(|s| s.contains("500")));
        assert_eq!(told(&[], false, "query:1")["rows"], "none");
    }
}

#[cfg(test)]
#[path = "query_db_tests.rs"]
mod db_tests;

//! Print delivery (#221): which printer a document goes to, and handing
//! queued jobs to the site bridge that sends them to the printer.
//!
//! The server renders each job for its printer — the stored PDF for a page
//! printer, ZPL for a wristband or label printer, ESC/POS for a receipt
//! printer — so the bridge only moves bytes. A bridge claims jobs (they turn
//! `printing`), sends them, and reports each one `completed` or `failed`.

use axum::{Extension, Json, extract::Path, extract::State};
use base64::Engine;
use medbrains_print::thermal::{Language, render, supports};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

/// Connections the site bridge serves (the printer screen's choices): a
/// network printer (`host:port`, 9100 by default), or one on the bridge
/// machine's USB or local print agent (a device path). Browser-dialog
/// printers print from the screen and are never queued.
const DELIVERABLE: [&str; 3] = ["network", "usb", "agent"];
/// Jobs handed to one bridge per poll.
const MAX_CLAIM: i64 = 10;
/// A job taken this long ago and never reported was lost with its bridge.
const STALE_MINUTES: i32 = 10;

/// The printer type a template wants first.
fn preferred_type(template_code: &str) -> &'static str {
    match template_code {
        "patient_wristband" => "wristband",
        "pharmacy_label" => "label",
        "queue_token_slip" | "payment_receipt" => "thermal",
        _ => "laser",
    }
}

#[derive(Debug, sqlx::FromRow)]
pub struct Printer {
    pub id: Uuid,
    pub name: String,
    pub printer_type: String,
}

/// The printer for this document: the one named, if it can carry it; else
/// the best match — the template's kind of printer before any other that can
/// carry it, the caller's department before the rest.
pub async fn route(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    template_code: &str,
    named: Option<Uuid>,
) -> Result<Printer, AppError> {
    let printers = sqlx::query_as::<_, Printer>(
        "SELECT id, name, printer_type FROM printer_configs \
          WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL \
            AND connection_type = ANY($2) AND ($3::uuid IS NULL OR id = $3) \
          ORDER BY (printer_type = $4) DESC, (department_id = ANY($5)) DESC NULLS LAST, name \
          LIMIT 50",
    )
    .bind(claims.tenant_id)
    .bind(&DELIVERABLE[..])
    .bind(named)
    .bind(preferred_type(template_code))
    .bind(&claims.department_ids)
    .fetch_all(&mut **tx)
    .await?;
    let found = printers
        .into_iter()
        .find(|p| supports(Language::for_printer(&p.printer_type), template_code));
    found.ok_or_else(|| {
        AppError::Conflict(match named {
            Some(_) => "That printer cannot print this document, or is not reachable by a bridge."
                .to_owned(),
            None => "No printer can print this document. Add one under Documents → Printers \
                     (network or USB, connected through the site bridge)."
                .to_owned(),
        })
    })
}

#[derive(Debug, Deserialize)]
pub struct ClaimRequest {
    /// Only these printers (the ones this bridge can reach); all when absent.
    pub printer_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, sqlx::FromRow)]
struct ClaimedRow {
    job_id: Uuid,
    copies: i32,
    printer_name: String,
    printer_type: String,
    connection_type: String,
    connection_string: Option<String>,
    template_code: Option<String>,
    file_url: Option<String>,
    context_snapshot: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct DeliverableJob {
    pub job_id: Uuid,
    pub copies: i32,
    pub printer_name: String,
    pub connection_type: String,
    pub connection_string: String,
    pub content_type: &'static str,
    pub payload_base64: String,
}

async fn finish(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    job_id: Uuid,
    error: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE print_jobs SET status = CASE WHEN $3::text IS NULL THEN 'completed' ELSE 'failed' END::print_job_status, \
                error_message = $3, completed_at = now(), updated_at = now() \
          WHERE id = $1 AND tenant_id = $2 AND status = 'printing'",
    )
    .bind(job_id)
    .bind(tenant_id)
    .bind(error)
    .execute(&mut **tx)
    .await?;
    if error.is_none() {
        sqlx::query(
            "UPDATE document_outputs d SET print_count = print_count + j.copies, \
                    first_printed_at = COALESCE(first_printed_at, now()), last_printed_at = now() \
               FROM print_jobs j WHERE j.id = $1 AND j.tenant_id = $2 AND d.id = j.document_output_id",
        )
        .bind(job_id)
        .bind(tenant_id)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

/// `POST /api/documents/print-jobs/claim` — the bridge takes queued jobs,
/// each already rendered for its printer.
pub async fn claim_print_jobs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ClaimRequest>,
) -> Result<Json<Vec<DeliverableJob>>, AppError> {
    require_permission(&claims, permissions::documents::print_jobs::DELIVER)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // Failed, not re-sent: the page may already be in the tray, and a second
    // wristband is worse than the desk pressing Retry.
    sqlx::query(
        "UPDATE print_jobs SET status = 'failed', completed_at = now(), updated_at = now(), \
                error_message = 'No result from the bridge — check the printer, then retry' \
          WHERE tenant_id = $1 AND status = 'printing' AND deleted_at IS NULL \
            AND started_at < now() - make_interval(mins => $2)",
    )
    .bind(claims.tenant_id)
    .bind(STALE_MINUTES)
    .execute(&mut *tx)
    .await?;
    let rows = sqlx::query_as::<_, ClaimedRow>(
        "WITH picked AS ( \
             SELECT j.id FROM print_jobs j JOIN printer_configs p ON p.id = j.printer_id \
              WHERE j.tenant_id = $1 AND j.status = 'queued' AND j.deleted_at IS NULL \
                AND p.is_active AND p.connection_type = ANY($2) \
                AND ($3::uuid[] IS NULL OR p.id = ANY($3)) \
              ORDER BY j.priority DESC, j.created_at LIMIT $4 FOR UPDATE OF j SKIP LOCKED), \
         claimed AS ( \
             UPDATE print_jobs j SET status = 'printing', started_at = now(), updated_at = now() \
               FROM picked WHERE j.id = picked.id RETURNING j.*) \
         SELECT c.id AS job_id, c.copies, p.name AS printer_name, p.printer_type, p.connection_type, \
                p.connection_string, d.template_code, d.file_url, d.context_snapshot \
           FROM claimed c JOIN printer_configs p ON p.id = c.printer_id \
           JOIN document_outputs d ON d.id = c.document_output_id",
    )
    .bind(claims.tenant_id)
    .bind(&DELIVERABLE[..])
    .bind(body.printer_ids.as_deref())
    .bind(MAX_CLAIM)
    .fetch_all(&mut *tx)
    .await?;

    let mut jobs = Vec::with_capacity(rows.len());
    for row in rows {
        match payload(&state, &row).await {
            Ok((content_type, bytes)) => jobs.push(DeliverableJob {
                job_id: row.job_id,
                copies: row.copies,
                printer_name: row.printer_name,
                connection_type: row.connection_type,
                connection_string: row.connection_string.unwrap_or_default(),
                content_type,
                payload_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
            }),
            // Nothing a bridge could do about it: fail the job where the desk sees it.
            Err(why) => finish(&mut tx, claims.tenant_id, row.job_id, Some(&why)).await?,
        }
    }
    tx.commit().await?;
    Ok(Json(jobs))
}

async fn payload(state: &AppState, row: &ClaimedRow) -> Result<(&'static str, Vec<u8>), String> {
    if row
        .connection_string
        .as_deref()
        .is_none_or(|c| c.trim().is_empty())
    {
        return Err(format!("{} has no address set", row.printer_name));
    }
    let language = Language::for_printer(&row.printer_type);
    let template = row.template_code.as_deref().unwrap_or_default();
    if language == Language::Pdf {
        let key = row
            .file_url
            .as_deref()
            .ok_or("the document has no stored file")?;
        let bytes = state
            .documents_store
            .get(key)
            .await
            .map_err(|e| format!("document file unavailable: {e}"))?;
        return Ok((language.content_type(), bytes));
    }
    let ctx = row
        .context_snapshot
        .as_ref()
        .ok_or("the document kept no context to print from")?;
    render(language, template, ctx).map(|b| (language.content_type(), b))
}

#[derive(Debug, Deserialize)]
pub struct JobResult {
    /// Why the printer refused or could not be reached; absent = printed.
    pub error: Option<String>,
}

/// `POST /api/documents/print-jobs/{id}/result` — the bridge reports back.
pub async fn report_print_job(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<JobResult>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::documents::print_jobs::DELIVER)?;
    let error = body
        .error
        .as_deref()
        .map(str::trim)
        .filter(|e| !e.is_empty());
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    finish(&mut tx, claims.tenant_id, id, error).await?;
    tx.commit().await?;
    if let Some(error) = error {
        tracing::warn!(job_id = %id, error, "print job failed at the printer");
    }
    Ok(Json(
        serde_json::json!({ "status": if error.is_some() { "failed" } else { "completed" } }),
    ))
}

#[cfg(test)]
mod tests {
    use super::preferred_type;

    #[test]
    fn each_document_asks_for_its_kind_of_printer_first() {
        assert_eq!(preferred_type("patient_wristband"), "wristband");
        assert_eq!(preferred_type("pharmacy_label"), "label");
        assert_eq!(preferred_type("queue_token_slip"), "thermal");
        assert_eq!(preferred_type("discharge_summary"), "laser");
    }
}

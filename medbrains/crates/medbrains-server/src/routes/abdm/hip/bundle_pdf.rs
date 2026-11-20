//! The PDF rendition each shared structured record carries (ABDM M2,
//! `HIP_INIT_SHARE_CARECONTEXT`): the printed copy names the patient (name,
//! age, gender, mobile, ABHA number and address) and the doctor (name,
//! speciality), on the hospital's own letterhead, rendered by rustenberg
//! through the Gotenberg-compatible client.
//!
//! What it says is read from the finished bundle
//! (`medbrains_fhir::nrces::rendition`), so the PDF cannot disagree with the
//! structured data. A record whose PDF cannot be printed (no renderer,
//! renderer down, too large) is still sent, structured only, and the reason
//! logged: the consent's window is the patient's, and the structured
//! record is the one HIUs read.

use base64::{Engine, engine::general_purpose::STANDARD};
use chrono::Utc;
use futures::{StreamExt, stream};
use medbrains_fhir::nrces::{attach_pdf, rendition};
use medbrains_print::{abdm_record, engine::render_html, gotenberg::GotenbergClient};
use serde_json::{Value, json};
use uuid::Uuid;

use super::bundle_records::{Tx, parties};
use super::bundles::ContextRow;
use crate::{error::AppError, state::AppState};

/// The largest rendition sent inline. A record's printed copy is tens of
/// KB; anything near this is a runaway record, not a page.
// ponytail: a cap, not compression — ABDM pushes one page per transfer
// (TRANSFER_LIMIT records), so the worst case is 100 MB; page the push if
// HIUs refuse that size.
const MAX_PDF_BYTES: usize = 1024 * 1024;
/// Renders in flight at once, so a 100-record transfer does not take 100
/// sequential Chromium round trips nor flood the renderer.
const RENDERS_IN_FLIGHT: usize = 4;

/// What printing a patient's records needs besides the bundles.
#[derive(Debug)]
pub struct Print<'a> {
    pub tenant_id: Uuid,
    /// rustenberg (`GOTENBERG_URL`); none configured means no PDFs.
    pub renderer: Option<&'a GotenbergClient>,
    /// Shown on the printed copy only; the FHIR Patient does not carry it.
    pub abha_address: Option<&'a str>,
}

/// The transfer's bundles, each structured record with its printed PDF:
/// the uploaded documents read from storage, the bundles built, then each
/// record printed and its PDF attached.
///
/// # Errors
/// As [`super::bundles::build`] and [`attach`].
#[tracing::instrument(skip_all, fields(tenant_id = %tenant_id))]
pub async fn printed_bundles(
    state: &AppState,
    tx: Tx<'_, '_>,
    (tenant_id, patient_id): (Uuid, Uuid),
    contexts: &[ContextRow],
) -> Result<Vec<(String, Value)>, AppError> {
    let files = super::bundle_records::document_files(state, tx, tenant_id, contexts).await?;
    let (mut out, abha_address) =
        super::bundles::build(tx, tenant_id, patient_id, contexts, &files).await?;
    let print = Print {
        tenant_id,
        renderer: state.gotenberg.as_ref(),
        abha_address: abha_address.as_deref(),
    };
    attach(tx, &print, &mut out).await?;
    Ok(out)
}

/// Print each structured record in `out` and attach the PDF where its
/// profile takes one. An invoice or an uploaded document is left as is.
///
/// # Errors
/// Database faults reading the doctors and the letterhead; a render
/// failure is logged and leaves that record without its PDF.
#[tracing::instrument(skip_all, fields(tenant_id = %p.tenant_id))]
pub async fn attach(
    tx: Tx<'_, '_>,
    p: &Print<'_>,
    out: &mut [(String, Value)],
) -> Result<(), AppError> {
    let today = Utc::now().date_naive();
    let pages: Vec<(usize, Value)> = out
        .iter()
        .enumerate()
        .filter_map(|(i, (_, b))| rendition(b, today).map(|r| (i, r)))
        .collect();
    if pages.is_empty() {
        return Ok(());
    }
    let Some(renderer) = p.renderer else {
        tracing::warn!("abdm: no PDF renderer configured, so records go without their PDF");
        return Ok(());
    };
    let htmls = pages_html(tx, p, pages).await?;
    for (i, pdf) in render(renderer, htmls).await {
        match pdf {
            Ok(bytes) if bytes.len() <= MAX_PDF_BYTES => {
                attach_pdf(&mut out[i].1, &STANDARD.encode(bytes));
            }
            Ok(bytes) => tracing::warn!(size = bytes.len(), "abdm: a record's PDF is too large"),
            Err(e) => tracing::warn!(error = %e, "abdm: a record's PDF could not be printed"),
        }
    }
    Ok(())
}

/// Each page's HTML, with the ABHA address, each doctor's speciality and
/// the hospital's letterhead added to its rendition. Doctors are read once.
async fn pages_html(
    tx: Tx<'_, '_>,
    p: &Print<'_>,
    pages: Vec<(usize, Value)>,
) -> Result<Vec<(usize, String)>, AppError> {
    let doctor_of = |r: &Value| r["record"]["doctor"]["id"].as_str()?.parse::<Uuid>().ok();
    let staff = parties(
        tx,
        p.tenant_id,
        pages.iter().filter_map(|(_, r)| doctor_of(r)),
    )
    .await?;
    let branding = medbrains_documents_render::branding_context(tx, p.tenant_id).await?;
    let generated_at = Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    Ok(pages
        .into_iter()
        .filter_map(|(i, mut ctx)| {
            if ctx["record"]["patient"].is_object() {
                ctx["record"]["patient"]["abha_address"] = json!(p.abha_address);
            }
            if let Some((_, speciality)) = doctor_of(&ctx).and_then(|id| staff.get(&id)) {
                ctx["record"]["doctor"]["speciality"] = json!(speciality);
            }
            ctx["branding"] = branding.clone();
            ctx["generated_at"] = json!(generated_at);
            render_html(abdm_record::HTML, &ctx)
                .map_err(|e| tracing::warn!(error = %e, "abdm: a record's PDF page did not render"))
                .ok()
                .map(|html| (i, html))
        })
        .collect())
}

/// The pages as PDF bytes, [`RENDERS_IN_FLIGHT`] at a time.
async fn render(
    renderer: &GotenbergClient,
    htmls: Vec<(usize, String)>,
) -> Vec<(usize, Result<Vec<u8>, medbrains_print::PrintError>)> {
    stream::iter(htmls)
        .map(|(i, html)| async move {
            let pdf = renderer
                .html_to_pdf(&html, abdm_record::PAPER, abdm_record::MARGINS)
                .await;
            (i, pdf)
        })
        .buffer_unordered(RENDERS_IN_FLIGHT)
        .collect()
        .await
}

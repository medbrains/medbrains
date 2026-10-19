//! The documents an NHCX final claim carries as PDFs: the finalised
//! discharge summary, the final itemised bill, the stay's released
//! investigation reports, and any stored patient document the desk adds.
//!
//! Each is rendered through the hospital's print path (Gotenberg) — as the
//! person sending, so their permission to read it is checked by the print
//! handler — or read from storage. Per-file and total caps keep the bundle
//! deliverable; whatever is left out is reported with its reason and kept
//! on the claim beside what went.
//!
//! When the PDF service is unavailable the claim is **refused** (503), not
//! queued without its discharge summary and not queued to retry: the desk
//! is waiting on the answer, nothing has been sent, and the claim stays as
//! it was, so sending again once the service is back is the whole recovery.
//! A retry queue would hold a claim nobody is watching, with a bundle built
//! from a bill and summary that may change before it renders.

use axum::Json;
use axum::extract::{Extension, Path, State};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

use crate::nhcx_common::Tx;

/// Largest single file sent. INFERRED — neither the HCX protocol nor the
/// NRCeS NHCX IG 6.5.0 publishes an attachment or payload limit; 5 MiB keeps
/// a scanned report and stays well inside common gateway body limits.
pub const MAX_FILE_BYTES: usize = 5 * 1024 * 1024;
/// Largest total of all files in one claim. INFERRED, as above: base64 adds
/// a third, so 10 MiB of files is a ~14 MB encrypted payload.
pub const MAX_TOTAL_BYTES: usize = 10 * 1024 * 1024;
/// Most investigation reports gathered for a stay — the latest released.
pub const MAX_INVESTIGATION_REPORTS: i64 = 10;

/// What a document is, as the payer's adjudicator files it.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum DocKind {
    DischargeSummary,
    FinalBill,
    LabReport,
    RadiologyReport,
    PatientDocument,
}

impl DocKind {
    /// NRCeS `ndhm-supportinginfo-category` and `ndhm-supportinginfo-code`
    /// (IG 6.5.0). A desk-added document has no fixed code.
    pub(crate) const fn nrces_codes(self) -> (&'static str, Option<&'static str>) {
        match self {
            Self::DischargeSummary => ("HDS", Some("DCR")),
            Self::FinalBill => ("MB", Some("FB")),
            Self::LabReport => ("INV", Some("LIR")),
            Self::RadiologyReport => ("INV", Some("RDR")),
            Self::PatientDocument => ("ATT", None),
        }
    }

    pub(crate) fn of_template(code: &str) -> Option<Self> {
        match code {
            "discharge_summary" => Some(Self::DischargeSummary),
            "ipd_consolidated_bill" | "invoice_gst" => Some(Self::FinalBill),
            "lab_report" => Some(Self::LabReport),
            _ => None,
        }
    }
}

/// Where a document's bytes come from.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DocSource {
    /// A `document_outputs` row the print path rendered.
    Rendered,
    /// A `patient_documents` upload.
    Stored,
}

/// A document the desk chose to send.
#[derive(Debug, Clone, Deserialize)]
pub struct DocumentPick {
    pub source: DocSource,
    pub id: Uuid,
}

/// A document that goes (or would go) with the claim.
#[derive(Debug, Clone, Serialize)]
pub struct ClaimDocument {
    pub kind: DocKind,
    pub source: DocSource,
    pub id: Uuid,
    pub title: String,
    pub mime_type: String,
    pub size_bytes: usize,
    pub created_at: DateTime<Utc>,
    /// The rendered PDF through the authenticated download route.
    pub preview_url: Option<String>,
}

/// A document that does not go, and why.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct LeftOut {
    pub kind: DocKind,
    pub title: String,
    pub reason: String,
}

/// A document with its content.
pub(crate) struct Loaded {
    pub(crate) doc: ClaimDocument,
    pub(crate) bytes: Vec<u8>,
}

/// The claim the documents belong to.
pub(crate) struct ClaimScope {
    pub(crate) tenant_id: Uuid,
    pub(crate) patient_id: Uuid,
    pub(crate) invoice_id: Uuid,
    pub(crate) admission_id: Option<Uuid>,
    /// When the stay's discharge summary was finalised.
    pub(crate) summary_final_at: Option<DateTime<Utc>>,
}

fn mib(bytes: usize) -> String {
    let m = bytes as f64 / (1024.0 * 1024.0);
    format!("{m:.1} MB")
}

/// Keep documents in order of what the payer needs most — summary, bill,
/// investigations, the rest — while each fits the per-file cap and the
/// running total stays under `total_cap`. Everything else is reported.
pub(crate) fn apply_caps(mut docs: Vec<Loaded>, total_cap: usize) -> (Vec<Loaded>, Vec<LeftOut>) {
    docs.sort_by_key(|d| d.doc.kind);
    let mut kept = Vec::with_capacity(docs.len());
    let mut left = Vec::new();
    let mut total = 0usize;
    for d in docs {
        let size = d.doc.size_bytes;
        let reason = if size > MAX_FILE_BYTES {
            Some(format!(
                "{} is over the {} limit for one file",
                mib(size),
                mib(MAX_FILE_BYTES)
            ))
        } else if total.saturating_add(size) > total_cap {
            Some(format!(
                "adding its {} would take the claim over {} in all",
                mib(size),
                mib(total_cap)
            ))
        } else {
            None
        };
        match reason {
            Some(reason) => left.push(LeftOut {
                kind: d.doc.kind,
                title: d.doc.title,
                reason,
            }),
            None => {
                total += size;
                kept.push(d);
            }
        }
    }
    (kept, left)
}

/// A stay's final claim does not go without its discharge summary.
pub(crate) fn require_discharge_summary(
    kept: &[Loaded],
    left: &[LeftOut],
    scope: &ClaimScope,
) -> Result<(), AppError> {
    if scope.admission_id.is_none() || kept.iter().any(|d| d.doc.kind == DocKind::DischargeSummary)
    {
        return Ok(());
    }
    let why = left
        .iter()
        .find(|l| l.kind == DocKind::DischargeSummary)
        .map_or_else(
            || "it was not among the documents".to_owned(),
            |l| l.reason.clone(),
        );
    Err(AppError::BadRequest(format!(
        "the discharge summary must go with the final claim, and {why} — the claim was not sent"
    )))
}

fn rendered(kind: DocKind, out: medbrains_documents_render::StoredPdf) -> Loaded {
    let id = out.document_output_id;
    Loaded {
        doc: ClaimDocument {
            kind,
            source: DocSource::Rendered,
            id,
            title: out.title.to_owned(),
            mime_type: "application/pdf".to_owned(),
            size_bytes: out.pdf.len(),
            created_at: Utc::now(),
            preview_url: Some(format!("/api/documents/{id}/download")),
        },
        bytes: out.pdf,
    }
}

/// Render one document; the PDF service being down refuses the claim.
async fn render(
    state: &AppState,
    claims: &Claims,
    (kind, template, source): (DocKind, &str, Uuid),
) -> Result<Loaded, AppError> {
    let out = medbrains_documents_render::render_stored(state, claims, template, source, None)
        .await
        .map_err(|e| match e {
            AppError::ServiceUnavailable(m) => AppError::ServiceUnavailable(format!(
                "the {} could not be made into a PDF ({m}); the claim was not sent — \
                 send it again when the PDF service is back",
                template.replace('_', " ")
            )),
            other => other,
        })?;
    Ok(rendered(kind, out))
}

#[derive(FromRow)]
struct LabRow {
    id: Uuid,
    test_name: String,
    total: i64,
}

/// The stay's encounters: the admission's and the bill's.
const STAY_ENCOUNTERS: &str = "SELECT encounter_id FROM admissions WHERE id = $3 AND tenant_id = $1 \
     UNION SELECT encounter_id FROM invoices WHERE id = $2 AND tenant_id = $1";

/// Render the documents a final claim carries by default.
pub(crate) async fn render_defaults(
    state: &AppState,
    claims: &Claims,
    tx: &mut Tx<'_>,
    scope: &ClaimScope,
) -> Result<(Vec<Loaded>, Vec<LeftOut>), AppError> {
    let mut docs = Vec::new();
    let mut left = Vec::new();
    if let Some(admission) = scope.admission_id {
        docs.push(
            render(
                state,
                claims,
                (DocKind::DischargeSummary, "discharge_summary", admission),
            )
            .await?,
        );
        docs.push(
            render(
                state,
                claims,
                (DocKind::FinalBill, "ipd_consolidated_bill", admission),
            )
            .await?,
        );
    } else {
        docs.push(
            render(
                state,
                claims,
                (DocKind::FinalBill, "invoice_gst", scope.invoice_id),
            )
            .await?,
        );
    }
    let labs = sqlx::query_as::<_, LabRow>(&format!(
        "SELECT lo.id, tc.name AS test_name, count(*) OVER () AS total \
           FROM lab_orders lo \
           JOIN lab_test_catalog tc ON tc.id = lo.test_id AND tc.tenant_id = lo.tenant_id \
          WHERE lo.tenant_id = $1 AND lo.deleted_at IS NULL AND lo.verified_at IS NOT NULL \
            AND lo.encounter_id IN ({STAY_ENCOUNTERS}) \
          ORDER BY lo.verified_at DESC LIMIT $4"
    ))
    .bind(claims.tenant_id)
    .bind(scope.invoice_id)
    .bind(scope.admission_id)
    .bind(MAX_INVESTIGATION_REPORTS)
    .fetch_all(&mut **tx)
    .await?;
    if let Some(total) = labs
        .first()
        .map(|l| l.total)
        .filter(|t| *t > MAX_INVESTIGATION_REPORTS)
    {
        left.push(LeftOut {
            kind: DocKind::LabReport,
            title: format!("{} older lab reports", total - MAX_INVESTIGATION_REPORTS),
            reason: format!(
                "only the latest {MAX_INVESTIGATION_REPORTS} lab reports go by default"
            ),
        });
    }
    for lab in labs {
        match render(state, claims, (DocKind::LabReport, "lab_report", lab.id)).await {
            Ok(mut d) => {
                d.doc.title = format!("Lab report — {}", lab.test_name);
                docs.push(d);
            }
            Err(e @ AppError::ServiceUnavailable(_)) => return Err(e),
            Err(e) => left.push(LeftOut {
                kind: DocKind::LabReport,
                title: format!("Lab report — {}", lab.test_name),
                reason: format!("it could not be printed: {e}"),
            }),
        }
    }
    let radiology: i64 = sqlx::query_scalar(&format!(
        "SELECT count(*) FROM radiology_reports rr \
           JOIN radiology_orders ro ON ro.id = rr.order_id AND ro.tenant_id = rr.tenant_id \
          WHERE rr.tenant_id = $1 AND rr.deleted_at IS NULL \
            AND rr.status IN ('final', 'amended') AND ro.encounter_id IN ({STAY_ENCOUNTERS})"
    ))
    .bind(claims.tenant_id)
    .bind(scope.invoice_id)
    .bind(scope.admission_id)
    .fetch_one(&mut **tx)
    .await?;
    if radiology > 0 {
        left.push(LeftOut {
            kind: DocKind::RadiologyReport,
            title: format!("{radiology} radiology report(s)"),
            reason: "MedBrains has no PDF print for radiology reports yet — attach a stored copy"
                .to_owned(),
        });
    }
    Ok((docs, left))
}

/// What the claim records about what went.
pub(crate) fn record(kept: &[Loaded], left: &[LeftOut]) -> Value {
    json!({
        "attached": kept.iter().map(|d| &d.doc).collect::<Vec<_>>(),
        "left_out": left,
    })
}

/// `POST /api/billing/insurance-claims/{id}/nhcx/documents` — render the
/// documents a final claim would carry, so the desk can see, preview and
/// choose them before sending.
///
/// # Errors
/// 503 when the PDF service is unavailable; 400 while the stay's discharge
/// summary is not finalised; 404 for an unknown claim; 403
/// without `insurance.nhcx.submit`, access to the patient, or permission to
/// read the discharge summary or bill.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn prepare_claim_documents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>, AppError> {
    require_permission(&claims, permissions::insurance::nhcx::SUBMIT)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (patient_id, invoice_id, admission_id) = sqlx::query_as::<_, (Uuid, Uuid, Option<Uuid>)>(
        "SELECT patient_id, invoice_id, admission_id FROM insurance_claims \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_patient_billing_access(&state, &claims, patient_id).await?;
    // A stay's summary is printed for the payer only once it is final.
    let summary_final_at =
        crate::nhcx_final_claim::summary_finalised_at(&mut tx, claims.tenant_id, admission_id)
            .await?;
    let scope = ClaimScope {
        tenant_id: claims.tenant_id,
        patient_id,
        invoice_id,
        admission_id,
        summary_final_at,
    };
    let (docs, mut left) = render_defaults(&state, &claims, &mut tx, &scope).await?;
    tx.commit().await?;
    // The total depends on the desk's choice; only the per-file cap is final here.
    let (kept, too_big) = apply_caps(docs, usize::MAX);
    left.extend(too_big);
    Ok(Json(json!({
        "patient_id": patient_id,
        "documents": kept.iter().map(|d| &d.doc).collect::<Vec<_>>(),
        "left_out": left,
        "max_file_bytes": MAX_FILE_BYTES,
        "max_total_bytes": MAX_TOTAL_BYTES,
    })))
}

#[cfg(test)]
#[path = "nhcx_claim_documents_tests.rs"]
mod tests;

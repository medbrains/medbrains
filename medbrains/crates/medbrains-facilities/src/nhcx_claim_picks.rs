//! Loading the documents the desk picked for an NHCX final claim: rendered
//! claim documents from the document store, stored uploads from S3.

use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;

use crate::nhcx_claim_documents::{
    ClaimDocument, ClaimScope, DocKind, DocSource, DocumentPick, LeftOut, Loaded,
};
use crate::nhcx_common::Tx;

/// Most documents the desk may pick for one claim.
const MAX_PICKS: usize = 25;
/// What a payer can open. INFERRED from the FHIR Attachment examples in the
/// NHCX IG (PDF) plus the image types scans arrive as.
const SENDABLE_MIME: &[&str] = &["application/pdf", "image/jpeg", "image/png"];

#[derive(FromRow)]
struct OutputRow {
    id: Uuid,
    template_code: Option<String>,
    source_id: Option<Uuid>,
    title: String,
    file_url: Option<String>,
    created_at: DateTime<Utc>,
}

#[derive(FromRow)]
struct StoredRow {
    id: Uuid,
    document_name: String,
    file_url: String,
    mime_type: Option<String>,
    created_at: DateTime<Utc>,
}

/// Load the documents the desk picked. Each must be this patient's; a
/// rendered one must be a claim document, and a discharge summary must be
/// this stay's, made after it was finalised.
pub(crate) async fn load_picks(
    state: &AppState,
    tx: &mut Tx<'_>,
    scope: &ClaimScope,
    picks: &[DocumentPick],
) -> Result<(Vec<Loaded>, Vec<LeftOut>), AppError> {
    let tenant_id = scope.tenant_id;
    if picks.len() > MAX_PICKS {
        return Err(AppError::BadRequest(format!(
            "attach at most {MAX_PICKS} documents"
        )));
    }
    let ids = |s: DocSource| {
        picks
            .iter()
            .filter(|p| p.source == s)
            .map(|p| p.id)
            .collect::<Vec<_>>()
    };
    let (out_ids, stored_ids) = (ids(DocSource::Rendered), ids(DocSource::Stored));
    let outputs = sqlx::query_as::<_, OutputRow>(
        "SELECT id, template_code, source_id, title, file_url, created_at FROM document_outputs \
          WHERE tenant_id = $1 AND patient_id = $2 AND id = ANY($3) AND deleted_at IS NULL \
            AND status <> 'voided'::document_output_status",
    )
    .bind(tenant_id)
    .bind(scope.patient_id)
    .bind(&out_ids)
    .fetch_all(&mut **tx)
    .await?;
    let stored = sqlx::query_as::<_, StoredRow>(
        "SELECT id, document_name, file_url, mime_type, created_at FROM patient_documents \
          WHERE tenant_id = $1 AND patient_id = $2 AND id = ANY($3) AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(scope.patient_id)
    .bind(&stored_ids)
    .fetch_all(&mut **tx)
    .await?;
    if outputs.len() != out_ids.len() || stored.len() != stored_ids.len() {
        return Err(AppError::BadRequest(
            "attach only this patient's documents".to_owned(),
        ));
    }
    let mut docs = Vec::new();
    let mut left = Vec::new();
    for o in outputs {
        let kind = o
            .template_code
            .as_deref()
            .and_then(DocKind::of_template)
            .ok_or_else(|| AppError::BadRequest(format!("{} is not a claim document", o.title)))?;
        if kind == DocKind::DischargeSummary
            && (o.source_id != scope.admission_id
                || scope.summary_final_at.is_some_and(|f| o.created_at < f))
        {
            return Err(AppError::BadRequest(
                "the discharge summary picked is not this stay's finalised one — \
                 prepare the documents again"
                    .to_owned(),
            ));
        }
        let Some(key) = o.file_url else {
            left.push(LeftOut {
                kind,
                title: o.title,
                reason: "its PDF was never stored".to_owned(),
            });
            continue;
        };
        match state.documents_store.get(&key).await {
            Ok(bytes) => docs.push(Loaded {
                doc: ClaimDocument {
                    kind,
                    source: DocSource::Rendered,
                    id: o.id,
                    title: o.title,
                    mime_type: "application/pdf".to_owned(),
                    size_bytes: bytes.len(),
                    created_at: o.created_at,
                    preview_url: Some(format!("/api/documents/{}/download", o.id)),
                },
                bytes,
            }),
            Err(e) => left.push(LeftOut {
                kind,
                title: o.title,
                reason: format!("its PDF could not be read: {e}"),
            }),
        }
    }
    for s in stored {
        docs.extend(load_stored(state, s, &mut left).await);
    }
    Ok((docs, left))
}

async fn load_stored(state: &AppState, s: StoredRow, left: &mut Vec<LeftOut>) -> Option<Loaded> {
    let kind = DocKind::PatientDocument;
    let mime = s.mime_type.unwrap_or_default();
    let refuse = |reason: String| LeftOut {
        kind,
        title: s.document_name.clone(),
        reason,
    };
    if !SENDABLE_MIME.contains(&mime.as_str()) {
        left.push(refuse(format!(
            "a payer cannot open a {mime} file — send a PDF or an image"
        )));
        return None;
    }
    let Some(s3) = state.s3.as_ref() else {
        left.push(refuse(
            "file storage is not configured on this server".to_owned(),
        ));
        return None;
    };
    match s3.download_object(&s.file_url).await {
        Ok(bytes) => Some(Loaded {
            doc: ClaimDocument {
                kind,
                source: DocSource::Stored,
                id: s.id,
                title: s.document_name.clone(),
                mime_type: mime,
                size_bytes: bytes.len(),
                created_at: s.created_at,
                preview_url: None,
            },
            bytes,
        }),
        Err(e) => {
            left.push(refuse(format!("it could not be read from storage: {e}")));
            None
        }
    }
}

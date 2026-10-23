//! Uploaded clinical documents as HealthDocumentRecord bundles: their bytes
//! from file storage, inline in a DocumentReference (the profile requires
//! `content.attachment.data`).

use std::collections::HashMap;

use base64::{Engine, engine::general_purpose::STANDARD};
use chrono::{DateTime, Utc};
use medbrains_fhir::nrces::{
    DocumentLine, RecordKind, document_reference, sections::HEALTH_DOCUMENT,
};
use serde_json::Value;
use uuid::Uuid;

use super::bundle_records::{
    Common, MAX_DOCUMENT_BYTES, One, Tx, Who, bundle, clinical, ids, section, who,
};
use super::bundles::ContextRow;
use crate::{error::AppError, state::AppState};

/// An uploaded document's type and base64 content, by its `patient_documents` id.
pub type Files = HashMap<Uuid, (String, String)>;

#[derive(sqlx::FromRow)]
struct DocRow {
    #[sqlx(flatten)]
    who: Who,
    document_name: String,
    created_at: DateTime<Utc>,
}

/// The bytes of the clinical documents among `contexts`, from file storage.
/// One that cannot be read (no storage configured, missing, too large) is
/// left out, and its care context goes unsent rather than sent empty.
///
/// # Errors
/// Database faults.
#[tracing::instrument(skip_all, fields(tenant_id = %tenant_id))]
pub async fn document_files(
    state: &AppState,
    tx: Tx<'_, '_>,
    tenant_id: Uuid,
    contexts: &[ContextRow],
) -> Result<Files, AppError> {
    let ids: Vec<Uuid> = contexts
        .iter()
        .filter(|c| c.source_kind == "health_document")
        .map(|c| c.source_id)
        .collect();
    let mut files = Files::new();
    if ids.is_empty() {
        return Ok(files);
    }
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let rows: Vec<(Uuid, String, Option<String>)> = sqlx::query_as(
        "SELECT id, file_url, mime_type FROM patient_documents \
          WHERE tenant_id = $1 AND id = ANY($2) AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?;
    let Some(s3) = state.s3.as_ref() else {
        tracing::warn!("abdm: file storage is not configured, so documents cannot be shared");
        return Ok(files);
    };
    for (id, key, mime) in rows {
        match s3.download_object(&key).await {
            Ok(bytes) if bytes.len() <= MAX_DOCUMENT_BYTES => {
                let mime = mime.unwrap_or_else(|| "application/pdf".to_owned());
                files.insert(id, (mime, STANDARD.encode(bytes)));
            }
            Ok(_) => tracing::warn!(%id, "abdm: a document is too large to share inline"),
            Err(e) => tracing::warn!(%id, error = %e, "abdm: a document could not be read"),
        }
    }
    Ok(files)
}

pub(super) async fn documents(
    tx: Tx<'_, '_>,
    c: &Common<'_>,
    mine: &[&ContextRow],
    files: &Files,
    out: &mut Vec<(String, Value)>,
) -> Result<(), AppError> {
    if mine.is_empty() {
        return Ok(());
    }
    let sql = format!(
        "SELECT x.id, x.document_name, x.created_at, {} \
          WHERE x.tenant_id = $1 AND x.id = ANY($2) AND x.deleted_at IS NULL",
        who("x.uploaded_by", "NULL::uuid").replace("{from}", "patient_documents x")
    );
    // allow-raw-sql: binds tenant_id inside a set_tenant_context transaction
    let rows: HashMap<Uuid, DocRow> = sqlx::query_as::<_, DocRow>(&sql)
        .bind(c.tenant_id)
        .bind(ids(mine))
        .fetch_all(&mut **tx)
        .await?
        .into_iter()
        .map(|r| (r.who.id, r))
        .collect();
    for context in mine {
        let (Some(r), Some((mime, data))) =
            (rows.get(&context.source_id), files.get(&context.source_id))
        else {
            continue;
        };
        let author = r.who.author();
        let ctx = clinical(c, author.as_ref(), None, r.created_at);
        let doc = document_reference(
            &ctx,
            &DocumentLine {
                id: r.who.id,
                title: r.document_name.clone(),
                content_type: mime.clone(),
                data: data.clone(),
                created: r.created_at,
            },
        );
        out.push(bundle(
            c,
            One {
                kind: RecordKind::HealthDocument,
                context,
                at: r.created_at,
                author,
                encounter: None,
                sections: vec![section(&r.document_name, Some(HEALTH_DOCUMENT), vec![doc])],
            },
        ));
    }
    Ok(())
}

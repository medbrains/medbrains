//! A resident's note is countersigned by their consultant.
//!
//! Until then it is not the final record (RFCs/RFC-MODULE-clinical-notes.md,
//! phase 3b). The consultant is the author's supervisor
//! (`users.supervisor_id`); they countersign the signed note, or return it
//! with a comment and it goes back to its author as a draft.

use axum::Json;
use axum::extract::{Extension, Path, State};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{is_bypass_role, require_permission};
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::model::Note;
use crate::{begin, store};

/// On signing, ask the author's supervisor to countersign — if they have
/// one. A re-signed note (revised, or returned and corrected) asks again.
pub async fn request_countersign(
    tx: &mut Transaction<'_, Postgres>,
    note_id: Uuid,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE clinical_notes n SET cosigner_id = u.supervisor_id, cosign_status = 'pending', \
                cosigned_at = NULL, cosign_comment = NULL \
           FROM users u \
          WHERE n.id = $1 AND u.id = n.author_id \
            AND u.supervisor_id IS NOT NULL AND u.supervisor_id <> n.author_id",
    )
    .bind(note_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// encounter, version, status, cosigner, cosign status, note type code.
type CosignRow = (Uuid, i32, String, Option<Uuid>, Option<String>, String);

/// The note, locked, if it waits on the caller's countersignature —
/// otherwise 404, so the endpoint does not reveal others' notes.
async fn awaiting_me(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    id: Uuid,
) -> Result<(Uuid, i32, String), AppError> {
    let row: Option<CosignRow> = sqlx::query_as(
        "SELECT n.encounter_id, n.current_version, n.status, n.cosigner_id, n.cosign_status, \
                t.code \
           FROM clinical_notes n JOIN note_types t ON t.id = n.note_type_id \
          WHERE n.id = $1 AND n.tenant_id = $2 AND n.deleted_at IS NULL \
          FOR UPDATE OF n",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    let (encounter_id, version, status, cosigner, cosign_status, type_code) =
        row.ok_or(AppError::NotFound)?;
    if cosigner != Some(claims.sub) && !is_bypass_role(claims) {
        return Err(AppError::NotFound);
    }
    if status != "signed" || cosign_status.as_deref() != Some("pending") {
        return Err(AppError::Conflict(
            "This note is not waiting for a countersignature".to_owned(),
        ));
    }
    Ok((encounter_id, version, type_code))
}

/// `POST /api/clinical-notes/{id}/countersign`
pub async fn countersign(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Note>, AppError> {
    require_permission(&claims, permissions::clinical_notes::COSIGN)?;
    let mut tx = begin(&state, &claims).await?;
    let (_, version, _) = awaiting_me(&mut tx, &claims, id).await?;
    sqlx::query(
        "UPDATE clinical_notes SET cosign_status = 'countersigned', cosigned_at = now() \
          WHERE id = $1",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;
    // The countersignature is over the same text the author signed.
    sqlx::query(
        "INSERT INTO note_signatures (tenant_id, note_id, version, signer_id, mode, content_hash) \
         SELECT $1, $2, $3, $4, 'cosign', content_hash FROM note_versions \
          WHERE note_id = $2 AND version = $3",
    )
    .bind(claims.tenant_id)
    .bind(id)
    .bind(version)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    let note = store::one_note(&mut tx, claims.tenant_id, id, claims.sub).await?;
    tx.commit().await?;
    Ok(Json(note))
}

#[derive(Debug, Deserialize)]
pub struct ReturnRequest {
    pub comment: String,
}

/// `POST /api/clinical-notes/{id}/return` — back to its author, as a draft,
/// with what to change. The signed version is kept.
pub async fn return_to_author(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReturnRequest>,
) -> Result<Json<Note>, AppError> {
    require_permission(&claims, permissions::clinical_notes::COSIGN)?;
    let comment = body.comment.trim();
    if comment.is_empty() {
        return Err(AppError::BadRequest(
            "Say what the author should change".to_owned(),
        ));
    }
    let mut tx = begin(&state, &claims).await?;
    let (encounter_id, version, type_code) = awaiting_me(&mut tx, &claims, id).await?;
    sqlx::query(
        "INSERT INTO note_versions (tenant_id, note_id, version, sections, saved_by) \
         SELECT tenant_id, note_id, version + 1, sections, $3 FROM note_versions \
          WHERE note_id = $1 AND version = $2",
    )
    .bind(id)
    .bind(version)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE clinical_notes SET status = 'draft', current_version = current_version + 1, \
                cosign_status = 'returned', cosign_comment = $2 WHERE id = $1",
    )
    .bind(id)
    .bind(comment)
    .execute(&mut *tx)
    .await?;
    // A returned consultation is no longer signed: the screens that read the
    // visit's consultation row fall back to what still is.
    if type_code == "consultation" {
        store::project_consultation(&mut tx, claims.tenant_id, encounter_id).await?;
    }
    let note = store::one_note(&mut tx, claims.tenant_id, id, claims.sub).await?;
    tx.commit().await?;
    Ok(Json(note))
}

/// A note waiting on the caller's countersignature.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PendingCountersign {
    pub id: Uuid,
    pub encounter_id: Uuid,
    pub encounter_type: String,
    pub admission_id: Option<Uuid>,
    pub er_visit_id: Option<Uuid>,
    pub patient_name: String,
    pub uhid: String,
    pub note_type_name: String,
    pub author_name: String,
    pub signed_at: Option<DateTime<Utc>>,
}

/// `GET /api/clinical-notes/countersign/pending` — oldest signature first.
pub async fn pending_countersign(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PendingCountersign>>, AppError> {
    require_permission(&claims, permissions::clinical_notes::COSIGN)?;
    let mut tx = begin(&state, &claims).await?;
    let rows = sqlx::query_as::<_, PendingCountersign>(
        "SELECT n.id, n.encounter_id, e.encounter_type::text AS encounter_type, \
                a.id AS admission_id, er.id AS er_visit_id, \
                concat_ws(' ', p.first_name, p.last_name) AS patient_name, p.uhid, \
                t.name AS note_type_name, u.full_name AS author_name, n.signed_at \
           FROM clinical_notes n \
           JOIN encounters e ON e.id = n.encounter_id \
           JOIN patients p ON p.id = n.patient_id \
           JOIN note_types t ON t.id = n.note_type_id \
           JOIN users u ON u.id = n.author_id \
           LEFT JOIN admissions a ON a.encounter_id = n.encounter_id \
           LEFT JOIN er_visits er ON er.encounter_id = n.encounter_id \
          WHERE n.tenant_id = $1 AND n.cosigner_id = $2 AND n.cosign_status = 'pending' \
            AND n.status = 'signed' AND n.deleted_at IS NULL \
          ORDER BY n.signed_at LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

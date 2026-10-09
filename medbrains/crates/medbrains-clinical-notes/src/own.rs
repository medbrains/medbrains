//! The caller's own note: found, locked and checked before an author
//! changes it, and returned fresh once they have.

use axum::Json;
use chrono::{DateTime, Utc};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::model::{Note, Section};
use crate::{soap_access, store};

/// The caller's own note, locked for the change about to be made.
pub(crate) async fn own_note(
    state: &AppState,
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    note_id: Uuid,
) -> Result<OwnNote, AppError> {
    let note = sqlx::query_as::<_, OwnNote>(
        "SELECT n.id, n.encounter_id, n.author_id, n.status, n.current_version, n.service_at, \
                n.signed_at, n.locked_at, n.migrated_from, v.sections, t.code AS type_code, \
                t.sections AS type_sections \
           FROM clinical_notes n \
           JOIN note_types t ON t.id = n.note_type_id \
           JOIN note_versions v ON v.note_id = n.id AND v.version = n.current_version \
          WHERE n.id = $1 AND n.tenant_id = $2 AND n.deleted_at IS NULL \
          FOR UPDATE OF n",
    )
    .bind(note_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    // Somebody else's note is not theirs to change, and is not confirmed to
    // exist by the refusal.
    if note.author_id != claims.sub {
        return Err(AppError::NotFound);
    }
    soap_access::require_write(state, claims, &note.type_code).await?;
    Ok(note)
}

#[derive(Debug, sqlx::FromRow)]
pub(crate) struct OwnNote {
    pub(crate) id: Uuid,
    pub(crate) encounter_id: Uuid,
    pub(crate) author_id: Uuid,
    pub(crate) status: String,
    pub(crate) current_version: i32,
    pub(crate) service_at: DateTime<Utc>,
    pub(crate) signed_at: Option<DateTime<Utc>>,
    pub(crate) locked_at: Option<DateTime<Utc>>,
    pub(crate) migrated_from: Option<String>,
    pub(crate) sections: serde_json::Value,
    pub(crate) type_code: String,
    pub(crate) type_sections: serde_json::Value,
}

impl OwnNote {
    pub(crate) fn sections(&self) -> Result<Vec<Section>, AppError> {
        serde_json::from_value(self.sections.clone())
            .map_err(|e| AppError::Internal(format!("note sections: {e}")))
    }

    /// The draft's sections, with any the note type has gained since it was
    /// started placed where the type has them.
    pub(crate) fn draft_sections(&self) -> Result<Vec<Section>, AppError> {
        let own = self.sections()?;
        let template: Vec<Section> = serde_json::from_value(self.type_sections.clone())
            .map_err(|e| AppError::Internal(format!("note type sections: {e}")))?;
        let mut out: Vec<Section> = template
            .into_iter()
            .map(|t| own.iter().find(|s| s.code == t.code).cloned().unwrap_or(t))
            .collect();
        let extra: Vec<Section> = own
            .into_iter()
            .filter(|s| !out.iter().any(|o| o.code == s.code))
            .collect();
        out.extend(extra);
        Ok(out)
    }
}

pub(crate) fn require_draft(note: &OwnNote) -> Result<(), AppError> {
    if note.status == "draft" {
        Ok(())
    } else {
        Err(AppError::Conflict(
            "This note is signed — revise it within the grace period, or add an addendum"
                .to_owned(),
        ))
    }
}

pub(crate) async fn finish(
    mut tx: Transaction<'_, Postgres>,
    claims: &Claims,
    note: &OwnNote,
    signed_record_changed: bool,
) -> Result<Json<Note>, AppError> {
    // Only what is signed reaches the screens that read the visit's
    // consultation row: a draft is the author's until they sign it.
    if signed_record_changed && note.type_code == "consultation" {
        store::project_consultation(&mut tx, claims.tenant_id, note.encounter_id).await?;
    }
    let fresh = store::one_note(&mut tx, claims.tenant_id, note.id, claims.sub).await?;
    tx.commit().await?;
    Ok(Json(fresh))
}

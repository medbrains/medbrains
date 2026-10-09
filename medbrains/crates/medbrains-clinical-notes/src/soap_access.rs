//! The `opd.soap_note` field restriction, on the case sheet.
//!
//! A hospital may restrict a role's or a user's access to the doctor's
//! consultation (Admin → Users → field access). The field is clinical content
//! (`DataClass::Sensitive`), so any restriction resolves to withheld: such a
//! user does not write, sign or countersign a consultation, sees its notes
//! marked withheld rather than blank, and does not print or export a sheet
//! that would be a copy of the record with the consultation missing. Other
//! note types are not affected.

use medbrains_core::form::FieldAccessLevel;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::field_access::resolve_restricted_fields;
use medbrains_server_core::state::AppState;
use serde_json::json;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::model::{Note, NoteType};

const FIELD: &str = "opd.soap_note";
const CONSULTATION: &str = "consultation";

/// Whether the caller's access to the consultation is restricted.
pub(crate) async fn is_restricted(state: &AppState, claims: &Claims) -> Result<bool, AppError> {
    let restricted =
        resolve_restricted_fields(&state.db, claims.tenant_id, claims.sub, &claims.role).await?;
    Ok(restricted
        .get(FIELD)
        .is_some_and(|level| *level != FieldAccessLevel::Edit))
}

fn refusal() -> AppError {
    AppError::ForbiddenReason(
        "Your access to consultation notes is restricted; ask your administrator".to_owned(),
    )
}

/// Refuse to change a consultation for a caller whose access is restricted.
pub(crate) async fn require_write(
    state: &AppState,
    claims: &Claims,
    type_code: &str,
) -> Result<(), AppError> {
    if type_code == CONSULTATION && is_restricted(state, claims).await? {
        return Err(refusal());
    }
    Ok(())
}

/// `require_write` for a note about to be started, known by its type's id.
pub(crate) async fn require_write_type(
    state: &AppState,
    claims: &Claims,
    tx: &mut Transaction<'_, Postgres>,
    type_id: Uuid,
) -> Result<(), AppError> {
    if !is_restricted(state, claims).await? {
        return Ok(());
    }
    let code: String = sqlx::query_scalar("SELECT code FROM note_types WHERE id = $1")
        .bind(type_id)
        .fetch_one(&mut **tx)
        .await?;
    if code == CONSULTATION {
        return Err(refusal());
    }
    Ok(())
}

/// Leave the consultation out of the types a restricted caller may start, so
/// the New note menu offers only what the server will accept.
pub(crate) async fn drop_unwritable(
    state: &AppState,
    claims: &Claims,
    types: &mut Vec<NoteType>,
) -> Result<(), AppError> {
    if types.iter().any(|t| t.code == CONSULTATION) && is_restricted(state, claims).await? {
        types.retain(|t| t.code != CONSULTATION);
    }
    Ok(())
}

/// Refuse a whole-record copy (print, export) to a restricted caller: a
/// sheet with the consultation silently missing reads as complete.
pub(crate) async fn require_whole_record(
    state: &AppState,
    claims: &Claims,
) -> Result<(), AppError> {
    if is_restricted(state, claims).await? {
        return Err(refusal());
    }
    Ok(())
}

/// Withhold the content of consultation notes from a restricted caller,
/// marking them so the screen says so instead of showing an empty note.
pub(crate) async fn withhold(
    state: &AppState,
    claims: &Claims,
    notes: &mut [Note],
) -> Result<(), AppError> {
    if !notes.iter().any(|n| n.note_type_code == CONSULTATION)
        || !is_restricted(state, claims).await?
    {
        return Ok(());
    }
    for note in notes
        .iter_mut()
        .filter(|n| n.note_type_code == CONSULTATION)
    {
        note.sections = json!([]);
        note.withheld = true;
    }
    Ok(())
}

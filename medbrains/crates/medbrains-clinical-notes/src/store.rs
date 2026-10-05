//! Reading notes and the hospital's note settings, and keeping the legacy
//! `consultations` row in step for the screens and reports that still read it.

use medbrains_server_core::error::AppError;
use serde_json::Value;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::model::{Note, Section};

/// The hospital's choices about notes (`tenant_settings`, category
/// `clinical_notes`), each with the default a hospital gets before choosing.
#[derive(Debug)]
pub struct NoteSettings {
    /// Minutes after signing in which the author may still revise.
    pub grace_minutes: i64,
    /// `author_only`, or anything else for the visit's care team.
    pub draft_visibility: String,
    /// Hours between the care and the signature beyond which it is a late
    /// entry that must say why.
    pub late_entry_hours: i64,
}

pub async fn settings(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<NoteSettings, AppError> {
    let rows: Vec<(String, Value)> = sqlx::query_as(
        "SELECT key, value FROM tenant_settings \
          WHERE tenant_id = $1 AND category = 'clinical_notes' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    let get = |key: &str| rows.iter().find(|(k, _)| k == key).map(|(_, v)| v);
    let number = |key: &str, default: i64| {
        get(key)
            .and_then(|v| v.as_i64().or_else(|| v.as_str()?.parse().ok()))
            .filter(|n| *n >= 0)
            .unwrap_or(default)
    };
    Ok(NoteSettings {
        grace_minutes: number("grace_minutes", 30),
        draft_visibility: get("draft_visibility")
            .and_then(Value::as_str)
            .unwrap_or("care_team")
            .to_owned(),
        late_entry_hours: number("late_entry_hours", 24),
    })
}

/// The SELECT every note read shares; `$me` is the caller, the rest of the
/// WHERE clause is the caller's.
fn note_select(me: usize) -> String {
    format!(
        "SELECT n.id, n.encounter_id, n.patient_id, t.code AS note_type_code, \
                t.name AS note_type_name, n.author_id, u.full_name AS author_name, \
                n.author_role, \
                COALESCE(u.medical_registration_number, u.registration_number) \
                  AS author_registration, \
                d.name AS department_name, n.status, n.service_at, n.signed_at, \
                n.locked_at, n.late_entry_reason, n.current_version, n.amends_note_id, \
                n.migrated_from, n.entered_in_error_at, n.entered_in_error_reason, \
                v.sections, v.saved_at, n.created_at, \
                n.author_id = ${me} AS is_mine, \
                (n.author_id = ${me} AND n.status = 'signed' \
                  AND n.migrated_from IS NULL AND now() < n.locked_at) AS revisable \
           FROM clinical_notes n \
           JOIN note_types t ON t.id = n.note_type_id \
           JOIN users u ON u.id = n.author_id \
           JOIN note_versions v ON v.note_id = n.id AND v.version = n.current_version \
           LEFT JOIN departments d ON d.id = n.service_department_id"
    )
}

/// A visit's notes in the order care happened, drafts as the hospital's
/// setting allows.
pub async fn encounter_notes(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    encounter_id: Uuid,
    me: Uuid,
    author_only_drafts: bool,
) -> Result<Vec<Note>, AppError> {
    let sql = format!(
        "{} WHERE n.tenant_id = $2 AND n.encounter_id = $3 AND n.deleted_at IS NULL \
             AND (n.status <> 'draft' OR NOT $4 OR n.author_id = $1) \
           ORDER BY n.service_at, n.created_at LIMIT 500",
        note_select(1)
    );
    Ok(sqlx::query_as::<_, Note>(&sql)
        .bind(me)
        .bind(tenant_id)
        .bind(encounter_id)
        .bind(author_only_drafts)
        .fetch_all(&mut **tx)
        .await?)
}

pub async fn one_note(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    note_id: Uuid,
    me: Uuid,
) -> Result<Note, AppError> {
    let sql = format!(
        "{} WHERE n.tenant_id = $2 AND n.id = $3 AND n.deleted_at IS NULL",
        note_select(1)
    );
    sqlx::query_as::<_, Note>(&sql)
        .bind(me)
        .bind(tenant_id)
        .bind(note_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

/// Keep the visit's `consultations` row showing its latest Consultation note.
///
/// Print, the MRD packet, the AI copilot, the management KPIs and the native
/// apps read that row; until each reads the case sheet, it is the case sheet's
/// copy, not a second place anyone writes.
pub async fn project_consultation(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    encounter_id: Uuid,
) -> Result<(), AppError> {
    let latest: Option<(Uuid, Value)> = sqlx::query_as(
        "SELECT n.author_id, v.sections \
           FROM clinical_notes n \
           JOIN note_types t ON t.id = n.note_type_id AND t.code = 'consultation' \
           JOIN note_versions v ON v.note_id = n.id AND v.version = n.current_version \
          WHERE n.tenant_id = $1 AND n.encounter_id = $2 AND n.deleted_at IS NULL \
            AND n.status <> 'entered_in_error' AND n.amends_note_id IS NULL \
          ORDER BY n.service_at DESC, n.created_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((author, sections)) = latest else {
        return Ok(());
    };
    let sections: Vec<Section> = serde_json::from_value(sections).unwrap_or_default();
    let text = |code: &str| {
        sections
            .iter()
            .find(|s| s.code == code)
            .map(|s| s.text.clone())
    };
    let updated = sqlx::query(
        "UPDATE consultations SET chief_complaint = $3, examination = $4, history = $5, \
                plan = $6, updated_at = now() \
          WHERE tenant_id = $1 AND encounter_id = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(text("subjective"))
    .bind(text("objective"))
    .bind(text("assessment"))
    .bind(text("plan"))
    .execute(&mut **tx)
    .await?;
    if updated.rows_affected() == 0 {
        sqlx::query(
            "INSERT INTO consultations \
               (tenant_id, encounter_id, doctor_id, chief_complaint, examination, history, plan) \
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(tenant_id)
        .bind(encounter_id)
        .bind(author)
        .bind(text("subjective"))
        .bind(text("objective"))
        .bind(text("assessment"))
        .bind(text("plan"))
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

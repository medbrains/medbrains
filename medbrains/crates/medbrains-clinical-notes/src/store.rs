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
pub(crate) fn note_select(me: usize) -> String {
    format!(
        "SELECT n.id, n.encounter_id, n.patient_id, t.code AS note_type_code, \
                t.name AS note_type_name, n.author_id, u.full_name AS author_name, \
                n.author_role, \
                COALESCE(u.medical_registration_number, u.registration_number) \
                  AS author_registration, \
                adp.hpr_id AS author_hpr_id, \
                d.name AS department_name, n.status, n.service_at, n.signed_at, \
                n.locked_at, n.late_entry_reason, n.current_version, n.amends_note_id, \
                n.migrated_from, n.entered_in_error_at, n.entered_in_error_reason, \
                v.sections, v.saved_at, n.created_at, \
                n.author_id = ${me} AS is_mine, \
                COALESCE(n.author_id = ${me} AND n.status = 'signed' \
                  AND n.migrated_from IS NULL AND now() < n.locked_at, false) AS revisable, \
                cu.full_name AS cosigner_name, n.cosign_status, n.cosigned_at, \
                n.cosign_comment, \
                COALESCE(n.cosigner_id = ${me} AND n.cosign_status = 'pending' \
                  AND n.status = 'signed', false) AS is_my_cosign \
           FROM clinical_notes n \
           JOIN note_types t ON t.id = n.note_type_id \
           JOIN users u ON u.id = n.author_id \
           LEFT JOIN users cu ON cu.id = n.cosigner_id \
           JOIN note_versions v ON v.note_id = n.id AND v.version = n.current_version \
           LEFT JOIN departments d ON d.id = n.service_department_id \
           LEFT JOIN doctor_profiles adp ON adp.user_id = n.author_id \
                AND adp.tenant_id = n.tenant_id AND adp.deleted_at IS NULL"
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

/// The visit's current structured record: what the History, ROS and
/// Examination sections say once their latest signed note is projected.
#[derive(Debug, sqlx::FromRow)]
struct Structured {
    hpi: Option<String>,
    past_medical_history: Option<Value>,
    past_surgical_history: Option<Value>,
    family_history: Option<Value>,
    social_history: Option<Value>,
    review_of_systems: Option<Value>,
    physical_examination: Option<Value>,
    general_appearance: Option<String>,
}

impl Structured {
    fn history(&self) -> Value {
        serde_json::json!({
            "hpi": self.hpi,
            "past_medical_history": self.past_medical_history,
            "past_surgical_history": self.past_surgical_history,
            "family_history": self.family_history,
            "social_history": self.social_history,
        })
    }

    fn has_history(&self) -> bool {
        self.hpi.as_deref().is_some_and(|h| !h.trim().is_empty())
            || [
                &self.past_medical_history,
                &self.past_surgical_history,
                &self.family_history,
                &self.social_history,
            ]
            .iter()
            .any(|v| v.as_ref().is_some_and(|v| !v.is_null()))
    }
}

const STRUCTURED_COLUMNS: &str = "hpi, past_medical_history, past_surgical_history, family_history, \
     social_history, review_of_systems, physical_examination, general_appearance";

/// Start a doctor's note from what is already known, so nothing is retyped.
///
/// The visit's review of systems and examination, and the visit's history —
/// or, on a first note, the history recorded at the patient's last visit
/// (past illnesses, surgery, family and social history carry over).
pub async fn prefill_structured(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    encounter_id: Uuid,
    patient_id: Uuid,
    sections: &mut [Section],
) -> Result<(), AppError> {
    if !sections
        .iter()
        .any(|s| matches!(s.code.as_str(), "history" | "ros" | "examination"))
    {
        return Ok(());
    }
    let visit: Option<Structured> = sqlx::query_as(&format!(
        "SELECT {STRUCTURED_COLUMNS} FROM consultations \
          WHERE tenant_id = $1 AND encounter_id = $2 AND deleted_at IS NULL LIMIT 1"
    ))
    .bind(tenant_id)
    .bind(encounter_id)
    .fetch_optional(&mut **tx)
    .await?;
    let history = match visit.as_ref().filter(|v| v.has_history()) {
        Some(v) => Some(v.history()),
        None => sqlx::query_as::<_, Structured>(
            "SELECT c.hpi, c.past_medical_history, c.past_surgical_history, c.family_history, \
                    c.social_history, NULL::jsonb AS review_of_systems, \
                    NULL::jsonb AS physical_examination, NULL::text AS general_appearance \
               FROM consultations c JOIN encounters e ON e.id = c.encounter_id \
              WHERE c.tenant_id = $1 AND e.patient_id = $2 AND c.deleted_at IS NULL \
                AND COALESCE(c.past_medical_history, c.past_surgical_history, \
                             c.family_history, c.social_history) IS NOT NULL \
              ORDER BY c.updated_at DESC LIMIT 1",
        )
        .bind(tenant_id)
        .bind(patient_id)
        .fetch_optional(&mut **tx)
        .await?
        // The last visit's complaint is not this one's: carry the background only.
        .map(|v| Structured { hpi: None, ..v }.history()),
    };
    for section in sections.iter_mut() {
        section.data = match section.code.as_str() {
            "history" => history.clone(),
            "ros" => visit.as_ref().and_then(|v| v.review_of_systems.clone()),
            "examination" => visit.as_ref().map(|v| {
                serde_json::json!({
                    "exam": v.physical_examination,
                    "general_appearance": v.general_appearance,
                })
            }),
            _ => section.data.take(),
        };
    }
    Ok(())
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
            AND n.status = 'signed' AND n.amends_note_id IS NULL \
          ORDER BY n.service_at DESC, n.created_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .fetch_optional(&mut **tx)
    .await?;
    let Some((author, sections)) = latest else {
        // Every consultation note on the visit is in error: the row must not
        // keep showing what was struck out.
        sqlx::query(
            "UPDATE consultations SET chief_complaint = NULL, examination = NULL, \
                    history = NULL, plan = NULL, updated_at = now() \
              WHERE tenant_id = $1 AND encounter_id = $2 AND deleted_at IS NULL",
        )
        .bind(tenant_id)
        .bind(encounter_id)
        .execute(&mut **tx)
        .await?;
        return Ok(());
    };
    let sections: Vec<Section> = serde_json::from_value(sections).unwrap_or_default();
    let text = |code: &str| {
        sections
            .iter()
            .find(|s| s.code == code)
            .map(|s| s.text.clone())
    };
    let data = |code: &str| {
        sections
            .iter()
            .find(|s| s.code == code)
            .and_then(|s| s.data.clone())
    };
    let history = data("history").unwrap_or(Value::Null);
    let exam = data("examination").unwrap_or(Value::Null);
    let field = |v: &Value, key: &str| v.get(key).filter(|x| !x.is_null()).cloned();
    let row = Projection {
        chief_complaint: text("subjective"),
        examination: text("objective"),
        history: text("assessment"),
        plan: text("plan"),
        hpi: field(&history, "hpi").and_then(|v| v.as_str().map(str::to_owned)),
        past_medical_history: field(&history, "past_medical_history"),
        past_surgical_history: field(&history, "past_surgical_history"),
        family_history: field(&history, "family_history"),
        social_history: field(&history, "social_history"),
        review_of_systems: data("ros").filter(|v| !v.is_null()),
        physical_examination: field(&exam, "exam"),
        general_appearance: field(&exam, "general_appearance")
            .and_then(|v| v.as_str().map(str::to_owned)),
    };
    write_projection(tx, tenant_id, encounter_id, author, &row).await
}

/// The consultation row's columns as the latest signed note has them.
struct Projection {
    chief_complaint: Option<String>,
    examination: Option<String>,
    history: Option<String>,
    plan: Option<String>,
    hpi: Option<String>,
    past_medical_history: Option<Value>,
    past_surgical_history: Option<Value>,
    family_history: Option<Value>,
    social_history: Option<Value>,
    review_of_systems: Option<Value>,
    physical_examination: Option<Value>,
    general_appearance: Option<String>,
}

async fn write_projection(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    encounter_id: Uuid,
    author: Uuid,
    row: &Projection,
) -> Result<(), AppError> {
    // Structured columns a note does not carry (a migrated note, an older
    // shape) keep what they hold rather than being cleared.
    let updated = sqlx::query(
        "UPDATE consultations SET chief_complaint = $3, examination = $4, history = $5, \
                plan = $6, hpi = COALESCE($7, hpi), \
                past_medical_history = COALESCE($8, past_medical_history), \
                past_surgical_history = COALESCE($9, past_surgical_history), \
                family_history = COALESCE($10, family_history), \
                social_history = COALESCE($11, social_history), \
                review_of_systems = COALESCE($12, review_of_systems), \
                physical_examination = COALESCE($13, physical_examination), \
                general_appearance = COALESCE($14, general_appearance), updated_at = now() \
          WHERE tenant_id = $1 AND encounter_id = $2 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(&row.chief_complaint)
    .bind(&row.examination)
    .bind(&row.history)
    .bind(&row.plan)
    .bind(&row.hpi)
    .bind(&row.past_medical_history)
    .bind(&row.past_surgical_history)
    .bind(&row.family_history)
    .bind(&row.social_history)
    .bind(&row.review_of_systems)
    .bind(&row.physical_examination)
    .bind(&row.general_appearance)
    .execute(&mut **tx)
    .await?;
    if updated.rows_affected() == 0 {
        sqlx::query(
            "INSERT INTO consultations \
               (tenant_id, encounter_id, doctor_id, chief_complaint, examination, history, plan, \
                hpi, past_medical_history, past_surgical_history, family_history, social_history, \
                review_of_systems, physical_examination, general_appearance) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)",
        )
        .bind(tenant_id)
        .bind(encounter_id)
        .bind(author)
        .bind(&row.chief_complaint)
        .bind(&row.examination)
        .bind(&row.history)
        .bind(&row.plan)
        .bind(&row.hpi)
        .bind(&row.past_medical_history)
        .bind(&row.past_surgical_history)
        .bind(&row.family_history)
        .bind(&row.social_history)
        .bind(&row.review_of_systems)
        .bind(&row.physical_examination)
        .bind(&row.general_appearance)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

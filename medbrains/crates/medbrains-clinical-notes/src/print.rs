//! The visit's case sheet on paper: every signed note with its author,
//! times and signature, addenda beneath their note, notes in error struck
//! through — and the print filed to the visit's medical record
//! (RFCs/RFC-MODULE-clinical-notes.md, phase 4).

use std::collections::HashMap;

use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde_json::{Value, json};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::model::{Note, Section};
use crate::summary::summarise_section;

/// The visit and patient the sheet is headed with, times in the hospital's
/// own zone.
#[derive(Debug, sqlx::FromRow)]
struct Heading {
    patient_id: Uuid,
    patient_name: String,
    uhid: String,
    gender: Option<String>,
    age: Option<String>,
    encounter_type: String,
    encounter_number: Option<String>,
    encounter_date: Option<String>,
    department_name: Option<String>,
    timezone: String,
}

/// A note's times as the paper prints them.
#[derive(Debug, sqlx::FromRow)]
struct Times {
    id: Uuid,
    service_at: String,
    signed_at: Option<String>,
    cosigned_at: Option<String>,
}

/// Rich text as plain paragraphs: what the editor's markup says, without it.
pub fn paragraphs(html: &str) -> Vec<String> {
    let broken = html
        .replace("</p>", "\n")
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
        .replace("<li>", "\n• ")
        .replace("</li>", "\n");
    let mut out = String::with_capacity(broken.len());
    let mut in_tag = false;
    for c in broken.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out.replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(str::to_owned)
        .collect()
}

fn note_json(note: &Note, times: Option<&Times>) -> Value {
    let sections: Vec<Section> = serde_json::from_value(note.sections.clone()).unwrap_or_default();
    let written: Vec<Value> = sections
        .iter()
        .filter_map(|s| {
            let lines = s
                .data
                .as_ref()
                .map_or_else(Vec::new, |d| summarise_section(&s.code, d));
            let text = paragraphs(&s.text);
            (!lines.is_empty() || !text.is_empty())
                .then(|| json!({ "title": s.title, "lines": lines, "paragraphs": text }))
        })
        .collect();
    let cosign = match note.cosign_status.as_deref() {
        Some("countersigned") => Some(format!(
            "Countersigned by {} {}",
            note.cosigner_name.as_deref().unwrap_or("the consultant"),
            times
                .and_then(|t| t.cosigned_at.as_deref())
                .unwrap_or_default()
        )),
        Some("pending") => Some(format!(
            "Awaiting countersign by {}",
            note.cosigner_name.as_deref().unwrap_or("the consultant")
        )),
        _ => None,
    };
    json!({
        "title": if note.amends_note_id.is_some() { "Addendum" } else { note.note_type_name.as_str() },
        "author": note.author_name,
        "role": note.author_role.replace('_', " "),
        "registration": note.author_registration,
        "department": note.department_name,
        "service_at": times.map(|t| t.service_at.as_str()),
        "signed_at": times.and_then(|t| t.signed_at.as_deref()),
        "recorded": note.migrated_from.is_some(),
        "revised": note.current_version > 1,
        "in_error": note.status == "entered_in_error",
        "in_error_reason": note.entered_in_error_reason,
        "late_entry_reason": note.late_entry_reason,
        "cosign": cosign,
        "addendum": note.amends_note_id.is_some(),
        "sections": written,
    })
}

/// The sheet's data: heading and notes. Drafts are not part of the record,
/// so they are not printed.
pub async fn case_sheet_context(
    state: &AppState,
    claims: &Claims,
    encounter_id: Uuid,
) -> Result<(Value, Uuid), AppError> {
    require_permission(claims, permissions::clinical_notes::PRINT)?;
    medbrains_authz_gate::require_encounter_access(state, claims, encounter_id).await?;
    crate::soap_access::require_whole_record(state, claims).await?;
    let mut tx = crate::begin(state, claims).await?;
    let h = heading(&mut tx, claims.tenant_id, encounter_id).await?;
    let notes: Vec<Note> =
        crate::store::encounter_notes(&mut tx, claims.tenant_id, encounter_id, claims.sub, true)
            .await?
            .into_iter()
            .filter(|n| n.status != "draft")
            .collect();
    let ids: Vec<Uuid> = notes.iter().map(|n| n.id).collect();
    let times: HashMap<Uuid, Times> = sqlx::query_as::<_, Times>(
        "SELECT id, to_char(service_at AT TIME ZONE $3, 'DD Mon YYYY HH24:MI') AS service_at, \
                to_char(signed_at AT TIME ZONE $3, 'DD Mon YYYY HH24:MI') AS signed_at, \
                to_char(cosigned_at AT TIME ZONE $3, 'DD Mon YYYY HH24:MI') AS cosigned_at \
           FROM clinical_notes WHERE tenant_id = $1 AND id = ANY($2)",
    )
    .bind(claims.tenant_id)
    .bind(&ids)
    .bind(&h.timezone)
    .fetch_all(&mut *tx)
    .await?
    .into_iter()
    .map(|t| (t.id, t))
    .collect();
    tx.commit().await?;

    // Each note, then its addenda: the paper reads in that order.
    let mut addenda: HashMap<Uuid, Vec<&Note>> = HashMap::new();
    for n in &notes {
        if let Some(parent) = n.amends_note_id {
            addenda.entry(parent).or_default().push(n);
        }
    }
    let mut entries: Vec<Value> = Vec::with_capacity(notes.len());
    for n in notes.iter().filter(|n| n.amends_note_id.is_none()) {
        entries.push(note_json(n, times.get(&n.id)));
        for a in addenda.remove(&n.id).unwrap_or_default() {
            entries.push(note_json(a, times.get(&a.id)));
        }
    }
    let kind = match h.encounter_type.as_str() {
        "ipd" => "Admission",
        "emergency" => "Emergency visit",
        "home_health" => "Home visit",
        _ => "OPD visit",
    };
    let sheet = json!({
        "patient_name": h.patient_name,
        "uhid": h.uhid,
        "gender": h.gender,
        "age": h.age,
        "visit_kind": kind,
        "visit_number": h.encounter_number,
        "visit_date": h.encounter_date,
        "department": h.department_name,
        "notes": entries,
    });
    Ok((json!({ "sheet": sheet }), h.patient_id))
}

async fn heading(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    encounter_id: Uuid,
) -> Result<Heading, AppError> {
    sqlx::query_as::<_, Heading>(
        "SELECT p.id AS patient_id, concat_ws(' ', p.first_name, p.last_name) AS patient_name, \
                p.uhid, p.gender::text AS gender, \
                CASE WHEN p.date_of_birth IS NOT NULL \
                     THEN extract(year FROM age(p.date_of_birth))::int || ' yrs' END AS age, \
                e.encounter_type::text AS encounter_type, e.encounter_number, \
                to_char(e.encounter_date, 'DD Mon YYYY') AS encounter_date, \
                d.name AS department_name, t.timezone \
           FROM encounters e \
           JOIN patients p ON p.id = e.patient_id \
           JOIN tenants t ON t.id = e.tenant_id \
           LEFT JOIN departments d ON d.id = e.department_id \
          WHERE e.tenant_id = $1 AND e.id = $2",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// File the print to the visit's medical record: the notes page of its
/// latest case-sheet packet (OPD by visit, IPD by admission) now holds it.
pub async fn file_to_mrd(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    encounter_id: Uuid,
    document_output_id: Uuid,
) -> Result<bool, AppError> {
    let filed = sqlx::query(
        "UPDATE mrd_case_sheet_pages pg \
            SET document_output_id = $3, printed_at = now(), status = 'printed' \
          WHERE pg.tenant_id = $1 AND pg.source_table = 'clinical_notes' \
            AND pg.deleted_at IS NULL \
            AND pg.packet_id = ( \
              SELECT pk.id FROM mrd_case_sheet_packets pk \
               WHERE pk.tenant_id = $1 AND pk.deleted_at IS NULL AND pk.status <> 'voided' \
                 AND (pk.encounter_id = $2 OR pk.admission_id = \
                      (SELECT a.id FROM admissions a WHERE a.encounter_id = $2 LIMIT 1)) \
               ORDER BY pk.version DESC LIMIT 1)",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(document_output_id)
    .execute(&mut **tx)
    .await?;
    Ok(filed.rows_affected() > 0)
}

#[cfg(test)]
mod tests {
    use super::paragraphs;

    #[test]
    fn markup_becomes_paragraphs_a_reader_sees() {
        assert_eq!(
            paragraphs("<p>Cough &amp; fever</p><ul><li>CXR</li><li>CBC</li></ul><p></p>"),
            vec!["Cough & fever", "• CXR", "• CBC"]
        );
    }
}

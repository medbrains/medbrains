//! The case sheet as FHIR R4: each signed note a `Composition`, so another
//! hospital, ABDM or an integration reads the record as it was signed
//! (RFCs/RFC-MODULE-clinical-notes.md, phase 4). Drafts are not the record
//! and are never exported.

use axum::Json;
use axum::extract::{Extension, Path, Query, State};
use chrono::Utc;
use medbrains_core::permissions;
use medbrains_fhir::r4::Resource;
use medbrains_fhir::r4::bundle::{Bundle, BundleEntry, BundleType};
use medbrains_fhir::r4::coding::CodeableConcept;
use medbrains_fhir::r4::composition::{
    Attester, Composition, CompositionSection, Narrative, RelatesTo,
};
use medbrains_fhir::r4::reference::Reference;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::Deserialize;
use std::collections::HashMap;
use uuid::Uuid;

use crate::model::{Note, Section};
use crate::print::paragraphs;
use crate::summary::summarise_section;

const LOINC: &str = "http://loinc.org";

/// FHIR's status for a note: revised notes are `amended`.
fn status_of(note: &Note) -> &'static str {
    match note.status.as_str() {
        "entered_in_error" => "entered-in-error",
        "draft" => "preliminary",
        _ if note.current_version > 1 => "amended",
        _ => "final",
    }
}

/// One note as a Composition; `loinc` is its note type's document code.
pub fn to_composition(note: &Note, loinc: Option<&str>) -> Composition {
    let sections: Vec<Section> = serde_json::from_value(note.sections.clone()).unwrap_or_default();
    let section = sections
        .iter()
        .filter_map(|s| {
            let mut lines = s
                .data
                .as_ref()
                .map_or_else(Vec::new, |d| summarise_section(&s.code, d));
            lines.extend(paragraphs(&s.text));
            (!lines.is_empty()).then(|| CompositionSection {
                title: s.title.clone(),
                text: Narrative::from_lines(&lines),
            })
        })
        .collect();
    let author = Reference::to("Practitioner", note.author_id).with_display(&note.author_name);
    let mut attester = Vec::new();
    if let Some(signed) = note.signed_at {
        attester.push(Attester {
            mode: "legal".to_owned(),
            time: Some(signed.to_rfc3339()),
            party: Some(author.clone()),
        });
    }
    if note.cosign_status.as_deref() == Some("countersigned") {
        attester.push(Attester {
            mode: "professional".to_owned(),
            time: note.cosigned_at.map(|t| t.to_rfc3339()),
            party: note.cosigner_name.as_ref().map(|n| Reference {
                reference: String::new(),
                display: Some(n.clone()),
            }),
        });
    }
    let kind = loinc.map_or_else(
        || CodeableConcept::from_text(&note.note_type_name),
        |code| CodeableConcept::from_coding(LOINC, code, &note.note_type_name),
    );
    Composition {
        id: note.id.to_string(),
        status: status_of(note).to_owned(),
        kind,
        subject: Reference::to("Patient", note.patient_id),
        encounter: Some(Reference::to("Encounter", note.encounter_id)),
        date: note.service_at.to_rfc3339(),
        author: vec![author],
        title: if note.amends_note_id.is_some() {
            format!("Addendum — {}", note.note_type_name)
        } else {
            note.note_type_name.clone()
        },
        attester,
        relates_to: note
            .amends_note_id
            .map(|parent| RelatesTo {
                code: "appends".to_owned(),
                target_reference: Reference::to("Composition", parent),
            })
            .into_iter()
            .collect(),
        section,
    }
}

/// The LOINC document code of each note type, by type code.
async fn loinc_codes(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
) -> Result<HashMap<String, String>, AppError> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT code, loinc_code FROM note_types \
          WHERE tenant_id = $1 AND loinc_code IS NOT NULL",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows.into_iter().collect())
}

#[derive(Debug, Deserialize)]
pub struct CompositionSearch {
    pub encounter: Uuid,
}

/// `GET /api/fhir/Composition?encounter={id}` — the visit's signed notes
/// (and those entered in error, so a receiver can retract them), a
/// searchset Bundle.
pub async fn search_compositions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<CompositionSearch>,
) -> Result<Json<Resource>, AppError> {
    require_permission(&claims, permissions::clinical_notes::EXPORT)?;
    medbrains_authz_gate::require_encounter_access(&state, &claims, q.encounter).await?;
    let mut tx = crate::begin(&state, &claims).await?;
    let loinc = loinc_codes(&mut tx, claims.tenant_id).await?;
    let notes =
        crate::store::encounter_notes(&mut tx, claims.tenant_id, q.encounter, claims.sub, true)
            .await?;
    tx.commit().await?;
    let entry: Vec<BundleEntry> = notes
        .iter()
        .filter(|n| n.status != "draft")
        .map(|n| BundleEntry {
            full_url: Some(format!("Composition/{}", n.id)),
            resource: Resource::Composition(to_composition(
                n,
                loinc.get(&n.note_type_code).map(String::as_str),
            )),
        })
        .collect();
    Ok(Json(Resource::Bundle(Bundle {
        id: Uuid::new_v4().to_string(),
        meta: None,
        r#type: BundleType::Searchset,
        timestamp: Utc::now().to_rfc3339(),
        total: Some(u32::try_from(entry.len()).unwrap_or(u32::MAX)),
        entry,
    })))
}

/// `GET /api/fhir/Composition/{id}` — one signed note.
pub async fn read_composition(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Resource>, AppError> {
    require_permission(&claims, permissions::clinical_notes::EXPORT)?;
    let mut tx = crate::begin(&state, &claims).await?;
    let note = crate::store::one_note(&mut tx, claims.tenant_id, id, claims.sub).await?;
    // A draft is not the record: to a reader it does not exist yet.
    if note.status == "draft" {
        return Err(AppError::NotFound);
    }
    let loinc = loinc_codes(&mut tx, claims.tenant_id).await?;
    tx.commit().await?;
    medbrains_authz_gate::require_encounter_access(&state, &claims, note.encounter_id).await?;
    let code = loinc.get(&note.note_type_code).map(String::as_str);
    Ok(Json(Resource::Composition(to_composition(&note, code))))
}

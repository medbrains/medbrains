//! The doctor's decision on a draft: every section and medicine accepted,
//! edited or rejected, logged as an AI-governance record with the size of the
//! edit. The accepted text has already gone into the note through the normal
//! clinical-notes draft save; this records what happened and deletes the
//! recording.

use std::collections::HashMap;

use axum::Json;
use axum::extract::{Extension, Path, State};
use medbrains_core::permissions;
use medbrains_kernel::{Actor, Claims};
use medbrains_server_core::error::AppError;
use medbrains_server_core::state::AppState;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::structure::{Draft, ModelMedicine};
use crate::view::{SessionRow, load_own};

/// Words compared per text: a note section holds 20,000 characters at most,
/// about 3,500 words, so the O(n·m) comparison stays near ten million steps.
const MAX_WORDS: usize = 4000;
const FEATURE: &str = "dictation";

/// What the doctor did with one suggestion.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Decision {
    Accepted,
    Rejected,
}

/// A section decision; `text` is what the doctor kept, edits included.
#[derive(Debug, Deserialize)]
pub struct SectionDecision {
    pub code: String,
    pub decision: Decision,
    pub text: Option<String>,
}

/// A medicine decision, by its position in the draft.
#[derive(Debug, Deserialize)]
pub struct MedicineDecision {
    pub index: usize,
    pub decision: Decision,
}

#[derive(Debug, Deserialize)]
pub struct ReviewRequest {
    /// The doctor's consultation note the accepted text was saved into.
    /// None only when everything was rejected.
    pub note_id: Option<Uuid>,
    #[serde(default)]
    pub sections: Vec<SectionDecision>,
    #[serde(default)]
    pub medicines: Vec<MedicineDecision>,
}

#[derive(Debug, Serialize)]
pub struct ReviewSummary {
    pub status: String,
    pub accepted: usize,
    pub edited: usize,
    pub rejected: usize,
}

/// One logged outcome.
struct Outcome {
    kind: &'static str,
    key: String,
    suggested: String,
    kept: Option<String>,
    label: &'static str,
    distance: usize,
    ratio: f64,
}

/// `POST /api/opd/dictations/{id}/review` — record the doctor's decisions,
/// link the note, delete the recording.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id, dictation_id = %id))]
pub async fn review_dictation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewRequest>,
) -> Result<Json<ReviewSummary>, AppError> {
    medbrains_kernel::require_permission(&claims, permissions::opd::dictation::USE)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let session = load_own(&mut tx, &claims, id).await?;
    medbrains_health_services::patient::require_patient_access(&state, &claims, session.patient_id)
        .await?;
    if session.status != "drafted" {
        return Err(AppError::Conflict(
            "This dictation has already been reviewed".to_owned(),
        ));
    }
    let draft: Draft = session
        .draft
        .clone()
        .and_then(|d| serde_json::from_value(d).ok())
        .ok_or_else(|| AppError::Conflict("This dictation has no draft to review".to_owned()))?;
    let outcomes = decide(&draft, &body);
    let kept_any = outcomes
        .iter()
        .any(|o| o.label != "rejected" && o.kind == "section");
    let status = match body.note_id {
        Some(note_id) => {
            require_own_note(&mut tx, &claims, &session, note_id).await?;
            "saved"
        }
        None if kept_any => {
            return Err(AppError::BadRequest(
                "Save the accepted text to the consultation note first".to_owned(),
            ));
        }
        None => "rejected",
    };
    for outcome in &outcomes {
        insert_outcome(&mut tx, &claims, &session, outcome).await?;
    }
    finish(&mut tx, &session, body.note_id, status).await?;
    let summary = summarise(status, &outcomes);
    audit_use(&mut tx, &claims, &session, body.note_id, &summary).await?;
    tx.commit().await?;
    Ok(Json(summary))
}

/// Every suggestion gets an outcome; one the doctor did not decide is
/// rejected (it was not taken into the note).
fn decide(draft: &Draft, body: &ReviewRequest) -> Vec<Outcome> {
    let sections: HashMap<&str, &SectionDecision> =
        body.sections.iter().map(|d| (d.code.as_str(), d)).collect();
    let medicines: HashMap<usize, Decision> = body
        .medicines
        .iter()
        .map(|d| (d.index, d.decision))
        .collect();
    let mut out: Vec<Outcome> = draft
        .sections
        .iter()
        .map(|s| {
            let kept = sections
                .get(s.code.as_str())
                .filter(|d| d.decision == Decision::Accepted)
                .and_then(|d| d.text.clone())
                .filter(|t| !t.trim().is_empty());
            outcome("section", s.code.clone(), &s.text, kept)
        })
        .collect();
    out.extend(draft.medicines.iter().enumerate().map(|(i, m)| {
        let line = medicine_line(m);
        let kept = (medicines.get(&i) == Some(&Decision::Accepted)).then(|| line.clone());
        outcome("medicine", i.to_string(), &line, kept)
    }));
    out
}

/// Compare what was kept with what was suggested.
fn outcome(kind: &'static str, key: String, suggested: &str, kept: Option<String>) -> Outcome {
    let (label, distance) = match kept.as_deref() {
        None => ("rejected", words(suggested).len()),
        Some(text) => match word_distance(suggested, text) {
            0 => ("accepted", 0),
            d => ("edited", d),
        },
    };
    let base = words(suggested).len().max(1);
    #[allow(clippy::cast_precision_loss)] // word counts are far below 2^52
    let ratio = (distance as f64 / base as f64).min(99.0);
    Outcome {
        kind,
        key,
        suggested: suggested.to_owned(),
        kept,
        label,
        distance,
        ratio,
    }
}

/// A drafted medicine as one line: what the doctor saw and decided on.
fn medicine_line(m: &ModelMedicine) -> String {
    [&m.name, &m.dose, &m.frequency, &m.duration, &m.route]
        .into_iter()
        .filter(|p| !p.is_empty())
        .cloned()
        .collect::<Vec<_>>()
        .join(" ")
}

/// The words of `text`, bounded at [`MAX_WORDS`].
fn words(text: &str) -> Vec<&str> {
    text.split_whitespace().take(MAX_WORDS).collect()
}

/// Word-level Levenshtein distance (insert, delete, substitute), two rows.
fn word_distance(a: &str, b: &str) -> usize {
    let (a, b) = (words(a), words(b));
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    let mut row = vec![0; b.len() + 1];
    for (i, wa) in a.iter().enumerate() {
        row[0] = i + 1;
        for (j, wb) in b.iter().enumerate() {
            let substitute = prev[j] + usize::from(wa != wb);
            row[j + 1] = substitute.min(prev[j + 1] + 1).min(row[j] + 1);
        }
        std::mem::swap(&mut prev, &mut row);
    }
    prev[b.len()]
}

/// The note must be the doctor's own, on this visit.
async fn require_own_note(
    tx: &mut medbrains_kernel::Tx,
    claims: &Claims,
    session: &SessionRow,
    note_id: Uuid,
) -> Result<(), AppError> {
    let found: Option<Uuid> = sqlx::query_scalar!(
        "SELECT id FROM clinical_notes \
          WHERE id = $1 AND tenant_id = $2 AND encounter_id = $3 AND author_id = $4 \
            AND deleted_at IS NULL",
        note_id,
        claims.tenant_id,
        session.encounter_id,
        claims.sub,
    )
    .fetch_optional(&mut **tx)
    .await?;
    found
        .map(|_| ())
        .ok_or_else(|| AppError::BadRequest("That note is not your note on this visit".to_owned()))
}

/// Write one governance row; a retried review adds nothing twice.
async fn insert_outcome(
    tx: &mut medbrains_kernel::Tx,
    claims: &Claims,
    session: &SessionRow,
    o: &Outcome,
) -> Result<(), AppError> {
    sqlx::query!(
        "INSERT INTO ai_suggestion_outcomes \
           (tenant_id, feature, source_id, patient_id, kind, item_key, model, suggested, \
            final_text, outcome, edit_distance, edit_ratio, decided_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::float8::numeric(6,4), $13) \
         ON CONFLICT (tenant_id, feature, source_id, kind, item_key) WHERE deleted_at IS NULL \
         DO NOTHING",
        claims.tenant_id,
        FEATURE,
        session.id,
        session.patient_id,
        o.kind,
        o.key,
        session.llm_model,
        o.suggested,
        o.kept,
        o.label,
        i32::try_from(o.distance).unwrap_or(i32::MAX),
        o.ratio,
        claims.sub,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Close the session and delete its recording in the same unit of work. The
/// transcript and draft are kept only with a saved note, as its provenance.
async fn finish(
    tx: &mut medbrains_kernel::Tx,
    session: &SessionRow,
    note_id: Option<Uuid>,
    status: &str,
) -> Result<(), AppError> {
    sqlx::query!(
        "DELETE FROM dictation_audio WHERE session_id = $1",
        session.id
    )
    .execute(&mut **tx)
    .await?;
    // Nothing was kept, so nothing needs its provenance: the words go too.
    if status != "saved" {
        sqlx::query!(
            "DELETE FROM dictation_content WHERE session_id = $1",
            session.id
        )
        .execute(&mut **tx)
        .await?;
    }
    sqlx::query!(
        "UPDATE dictation_sessions \
            SET status = $2, note_id = $3, \
                saved_at = CASE WHEN $2 = 'saved' THEN now() END, \
                audio_deleted_at = now() \
          WHERE id = $1",
        session.id,
        status,
        note_id,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Counts of each outcome, sections and medicines together.
fn summarise(status: &str, outcomes: &[Outcome]) -> ReviewSummary {
    let count = |label: &str| outcomes.iter().filter(|o| o.label == label).count();
    ReviewSummary {
        status: status.to_owned(),
        accepted: count("accepted"),
        edited: count("edited"),
        rejected: count("rejected"),
    }
}

/// The audit chain records that dictation was used on this note, and how
/// long the note took from first word to save.
async fn audit_use(
    tx: &mut medbrains_kernel::Tx,
    claims: &Claims,
    session: &SessionRow,
    note_id: Option<Uuid>,
    summary: &ReviewSummary,
) -> Result<(), AppError> {
    let detail = serde_json::json!({
        "dictation_id": session.id,
        "encounter_id": session.encounter_id,
        "status": summary.status,
        "accepted": summary.accepted,
        "edited": summary.edited,
        "rejected": summary.rejected,
        "seconds_from_start": (chrono::Utc::now() - session.started_at).num_seconds(),
        "ai_generated": true,
    });
    let entry = medbrains_kernel::audit::AuditEntry {
        tenant_id: claims.tenant_id,
        user_id: Some(claims.sub),
        action: "dictation_used",
        entity_type: if note_id.is_some() {
            "clinical_note"
        } else {
            "dictation_session"
        },
        entity_id: Some(note_id.unwrap_or(session.id)),
        old_values: None,
        new_values: Some(&detail),
        ip_address: None,
    };
    medbrains_kernel::audit(tx, &entry).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{outcome, word_distance};

    #[test]
    fn distance_counts_changed_words() {
        assert_eq!(
            word_distance("fever for three days", "fever for three days"),
            0
        );
        assert_eq!(
            word_distance("fever for three days", "fever for two days"),
            1
        );
        assert_eq!(word_distance("a b c", ""), 3);
        assert_eq!(word_distance("", "a b"), 2);
    }

    #[test]
    fn outcomes_follow_what_was_kept() {
        assert_eq!(
            outcome("section", "plan".into(), "rest", Some("rest".into())).label,
            "accepted"
        );
        let edited = outcome(
            "section",
            "plan".into(),
            "rest two days",
            Some("rest five days".into()),
        );
        assert_eq!((edited.label, edited.distance), ("edited", 1));
        assert!((edited.ratio - 1.0 / 3.0).abs() < 1e-9);
        let rejected = outcome("section", "plan".into(), "rest two days", None);
        assert_eq!((rejected.label, rejected.distance), ("rejected", 3));
        // Whitespace alone is not an edit.
        assert_eq!(
            outcome("section", "p".into(), "a  b", Some("a b\n".into())).label,
            "accepted"
        );
    }
}

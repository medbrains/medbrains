//! A clinician's own unsigned notes, wherever they were started: the paper
//! sheet's "sign your entries before you leave", kept for them.

use axum::Json;
use axum::extract::{Extension, State};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::Serialize;
use uuid::Uuid;

/// One of the caller's drafts, with what the screen needs to open it.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UnsignedNote {
    pub id: Uuid,
    pub encounter_id: Uuid,
    /// `opd`, `ipd` or `emergency`: which screen holds the case sheet.
    pub encounter_type: String,
    pub admission_id: Option<Uuid>,
    pub er_visit_id: Option<Uuid>,
    pub patient_id: Uuid,
    pub patient_name: String,
    pub uhid: String,
    pub note_type_name: String,
    /// A revision of a signed note, rather than a note never signed.
    pub is_revision: bool,
    pub service_at: DateTime<Utc>,
    pub saved_at: DateTime<Utc>,
}

/// `GET /api/clinical-notes/mine/unsigned` — the caller's drafts, oldest
/// care first: the longest-unsigned is the one most at risk.
pub async fn my_unsigned_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<UnsignedNote>>, AppError> {
    require_permission(&claims, permissions::clinical_notes::WRITE)?;
    let mut tx = crate::begin(&state, &claims).await?;
    let rows = sqlx::query_as::<_, UnsignedNote>(
        "SELECT n.id, n.encounter_id, e.encounter_type::text AS encounter_type, \
                a.id AS admission_id, er.id AS er_visit_id, n.patient_id, \
                concat_ws(' ', p.first_name, p.last_name) AS patient_name, p.uhid, \
                t.name AS note_type_name, n.current_version > 1 AS is_revision, \
                n.service_at, v.saved_at \
           FROM clinical_notes n \
           JOIN encounters e ON e.id = n.encounter_id \
           JOIN patients p ON p.id = n.patient_id \
           JOIN note_types t ON t.id = n.note_type_id \
           JOIN note_versions v ON v.note_id = n.id AND v.version = n.current_version \
           LEFT JOIN admissions a ON a.encounter_id = n.encounter_id \
           LEFT JOIN er_visits er ON er.encounter_id = n.encounter_id \
          WHERE n.tenant_id = $1 AND n.author_id = $2 AND n.status = 'draft' \
            AND n.deleted_at IS NULL \
          ORDER BY n.service_at LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

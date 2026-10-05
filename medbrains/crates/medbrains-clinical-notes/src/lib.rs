//! The case sheet: every clinician's dated, signed notes on a visit
//! (RFCs/RFC-MODULE-clinical-notes.md, phase 1).
//!
//! A note is its author's: a draft that autosaves, then signed — stamped with
//! who and when, its text fingerprinted and frozen. Within the hospital's
//! grace period the author may revise it (the signed version is kept); after
//! that only an addendum adds to it. A note written in error is marked so,
//! with a reason, and stays on the sheet struck through.

pub mod billing;
pub mod lifecycle;
pub mod model;
pub mod store;

use axum::Json;
use axum::extract::{Extension, Path, Query, State};
use axum::routing::{get, post, put};
use chrono::{DateTime, Duration, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::{is_bypass_role, require_permission};
use medbrains_server_core::state::AppState;
use serde::Deserialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use model::{Note, NoteType, Section, SectionPatch};

pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/clinical-notes/types", get(list_note_types))
        .route(
            "/api/encounters/{id}/clinical-notes",
            get(list_encounter_notes).post(create_note),
        )
        .route("/api/clinical-notes/{id}/draft", put(save_draft))
        .route("/api/clinical-notes/{id}/sign", post(lifecycle::sign_note))
        .route(
            "/api/clinical-notes/{id}/revise",
            post(lifecycle::revise_note),
        )
        .route(
            "/api/clinical-notes/{id}/discard",
            post(lifecycle::discard_note),
        )
        .route(
            "/api/clinical-notes/{id}/entered-in-error",
            post(lifecycle::mark_in_error),
        )
}

pub async fn begin(
    state: &AppState,
    claims: &Claims,
) -> Result<Transaction<'static, Postgres>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    Ok(tx)
}

#[derive(Debug, Deserialize)]
pub struct NoteTypesQuery {
    /// Only the types the caller may write on this visit.
    pub encounter_id: Option<Uuid>,
}

/// `GET /api/clinical-notes/types` — the kinds of note this hospital writes,
/// or with `encounter_id`, those the caller may start on that visit.
pub async fn list_note_types(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<NoteTypesQuery>,
) -> Result<Json<Vec<NoteType>>, AppError> {
    require_permission(&claims, permissions::clinical_notes::VIEW)?;
    let mut tx = begin(&state, &claims).await?;
    // A hospital created after the notes migration gets the same starting set.
    sqlx::query("SELECT seed_note_types($1)")
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?;
    let kind = match params.encounter_id {
        Some(id) => Some(encounter_kind(&mut tx, &claims, id).await?),
        None => None,
    };
    let types = sqlx::query_as::<_, NoteType>(
        "SELECT id, code, name, loinc_code, category, sections, author_roles, encounter_kinds \
           FROM note_types \
          WHERE tenant_id = $1 AND is_active AND deleted_at IS NULL \
            AND ($2::text IS NULL OR ($2 = ANY(encounter_kinds) \
                 AND ($4 OR cardinality(author_roles) = 0 OR $3 = ANY(author_roles)))) \
          ORDER BY sort_order, name",
    )
    .bind(claims.tenant_id)
    .bind(kind)
    .bind(&claims.role)
    .bind(is_bypass_role(&claims))
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(types))
}

/// `opd`, `ipd` or `emergency`.
async fn encounter_kind(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    encounter_id: Uuid,
) -> Result<String, AppError> {
    sqlx::query_scalar(
        "SELECT encounter_type::text FROM encounters WHERE id = $1 AND tenant_id = $2",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// `GET /api/encounters/{id}/clinical-notes` — the visit's case sheet.
pub async fn list_encounter_notes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<Vec<Note>>, AppError> {
    require_permission(&claims, permissions::clinical_notes::VIEW)?;
    medbrains_authz_gate::require_encounter_access(&state, &claims, encounter_id).await?;
    let mut tx = begin(&state, &claims).await?;
    let settings = store::settings(&mut tx, claims.tenant_id).await?;
    let notes = store::encounter_notes(
        &mut tx,
        claims.tenant_id,
        encounter_id,
        claims.sub,
        settings.draft_visibility == "author_only",
    )
    .await?;
    tx.commit().await?;
    Ok(Json(notes))
}

#[derive(Debug, Deserialize)]
pub struct CreateNoteRequest {
    pub note_type_code: String,
    /// When the care happened, if not now (a late entry).
    pub service_at: Option<DateTime<Utc>>,
    /// The signed note this one adds to.
    pub amends_note_id: Option<Uuid>,
    #[serde(default)]
    pub sections: Vec<SectionPatch>,
}

/// Whether the caller's role writes this type: its listed roles, or anyone
/// who may write notes when it lists none.
fn may_write(claims: &Claims, author_roles: &[String]) -> bool {
    is_bypass_role(claims) || author_roles.is_empty() || author_roles.contains(&claims.role)
}

/// `POST /api/encounters/{id}/clinical-notes` — start a note or an addendum.
pub async fn create_note(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
    Json(body): Json<CreateNoteRequest>,
) -> Result<Json<Note>, AppError> {
    require_permission(&claims, permissions::clinical_notes::WRITE)?;
    medbrains_authz_gate::require_encounter_access(&state, &claims, encounter_id).await?;
    if body
        .service_at
        .is_some_and(|at| at > Utc::now() + Duration::minutes(5))
    {
        return Err(AppError::BadRequest(
            "A note cannot be for care in the future".to_owned(),
        ));
    }
    let mut tx = begin(&state, &claims).await?;

    let (patient_id, department_id, kind): (Uuid, Option<Uuid>, String) = sqlx::query_as(
        "SELECT patient_id, department_id, encounter_type::text FROM encounters \
          WHERE id = $1 AND tenant_id = $2",
    )
    .bind(encounter_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let (type_id, author_roles, template) = if let Some(parent) = body.amends_note_id {
        addendum_type(&mut tx, &claims, encounter_id, parent).await?
    } else {
        let (id, name, sections, roles, kinds): (
            Uuid,
            String,
            serde_json::Value,
            Vec<String>,
            Vec<String>,
        ) = sqlx::query_as(
            "SELECT id, name, sections, author_roles, encounter_kinds FROM note_types \
                  WHERE tenant_id = $1 AND code = $2 AND is_active AND deleted_at IS NULL",
        )
        .bind(claims.tenant_id)
        .bind(&body.note_type_code)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(|| AppError::BadRequest("Choose a note type".to_owned()))?;
        if !kinds.contains(&kind) {
            return Err(AppError::BadRequest(format!(
                "A {name} is not written on this kind of visit"
            )));
        }
        let template: Vec<Section> = serde_json::from_value(sections)
            .map_err(|e| AppError::Internal(format!("note type sections: {e}")))?;
        (id, roles, template)
    };
    if !may_write(&claims, &author_roles) {
        return Err(AppError::Forbidden);
    }
    let mut base = template;
    if body.amends_note_id.is_none() {
        store::prefill_structured(
            &mut tx,
            claims.tenant_id,
            encounter_id,
            patient_id,
            &mut base,
        )
        .await?;
    }
    let sections = model::apply_patches(&base, &body.sections).map_err(AppError::BadRequest)?;

    let note_id: Uuid = sqlx::query_scalar(
        "INSERT INTO clinical_notes \
           (tenant_id, patient_id, encounter_id, note_type_id, service_department_id, \
            author_id, author_role, service_at, amends_note_id) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, now()), $9) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(patient_id)
    .bind(encounter_id)
    .bind(type_id)
    .bind(department_id)
    .bind(claims.sub)
    .bind(&claims.role)
    .bind(body.service_at)
    .bind(body.amends_note_id)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO note_versions (tenant_id, note_id, version, sections, saved_by) \
         VALUES ($1, $2, 1, $3, $4)",
    )
    .bind(claims.tenant_id)
    .bind(note_id)
    .bind(serde_json::to_value(&sections).map_err(|e| AppError::Internal(e.to_string()))?)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    let note = store::one_note(&mut tx, claims.tenant_id, note_id, claims.sub).await?;
    tx.commit().await?;
    Ok(Json(note))
}

/// An addendum is to a signed note on the same visit, of the same type, and
/// holds one section: what is being added.
async fn addendum_type(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    encounter_id: Uuid,
    parent: Uuid,
) -> Result<(Uuid, Vec<String>, Vec<Section>), AppError> {
    let (type_id, roles, status): (Uuid, Vec<String>, String) = sqlx::query_as(
        "SELECT n.note_type_id, t.author_roles, n.status FROM clinical_notes n \
           JOIN note_types t ON t.id = n.note_type_id \
          WHERE n.id = $1 AND n.tenant_id = $2 AND n.encounter_id = $3 \
            AND n.deleted_at IS NULL",
    )
    .bind(parent)
    .bind(claims.tenant_id)
    .bind(encounter_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    if status != "signed" {
        return Err(AppError::Conflict(
            "Only a signed note takes an addendum".to_owned(),
        ));
    }
    let section = Section {
        code: "addendum".to_owned(),
        title: "Addendum".to_owned(),
        text: String::new(),
        data: None,
    };
    Ok((type_id, roles, vec![section]))
}

/// The caller's own note, locked for the change about to be made.
pub async fn own_note(
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
    Ok(note)
}

#[derive(Debug, sqlx::FromRow)]
pub struct OwnNote {
    pub id: Uuid,
    pub encounter_id: Uuid,
    pub author_id: Uuid,
    pub status: String,
    pub current_version: i32,
    pub service_at: DateTime<Utc>,
    pub signed_at: Option<DateTime<Utc>>,
    pub locked_at: Option<DateTime<Utc>>,
    pub migrated_from: Option<String>,
    pub sections: serde_json::Value,
    pub type_code: String,
    pub type_sections: serde_json::Value,
}

impl OwnNote {
    pub fn sections(&self) -> Result<Vec<Section>, AppError> {
        serde_json::from_value(self.sections.clone())
            .map_err(|e| AppError::Internal(format!("note sections: {e}")))
    }

    /// The draft's sections, with any the note type has gained since it was
    /// started placed where the type has them.
    pub fn draft_sections(&self) -> Result<Vec<Section>, AppError> {
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

pub fn require_draft(note: &OwnNote) -> Result<(), AppError> {
    if note.status == "draft" {
        Ok(())
    } else {
        Err(AppError::Conflict(
            "This note is signed — revise it within the grace period, or add an addendum"
                .to_owned(),
        ))
    }
}

pub async fn finish(
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

#[derive(Debug, Deserialize)]
pub struct SaveDraftRequest {
    pub sections: Vec<SectionPatch>,
}

/// `PUT /api/clinical-notes/{id}/draft` — the author's autosave.
pub async fn save_draft(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<SaveDraftRequest>,
) -> Result<Json<Note>, AppError> {
    require_permission(&claims, permissions::clinical_notes::WRITE)?;
    let mut tx = begin(&state, &claims).await?;
    let note = own_note(&mut tx, &claims, id).await?;
    require_draft(&note)?;
    let sections = model::apply_patches(&note.draft_sections()?, &body.sections)
        .map_err(AppError::BadRequest)?;
    sqlx::query(
        "UPDATE note_versions SET sections = $3, saved_at = now() \
          WHERE note_id = $1 AND version = $2",
    )
    .bind(note.id)
    .bind(note.current_version)
    .bind(serde_json::to_value(&sections).map_err(|e| AppError::Internal(e.to_string()))?)
    .execute(&mut *tx)
    .await?;
    finish(tx, &claims, &note, false).await
}

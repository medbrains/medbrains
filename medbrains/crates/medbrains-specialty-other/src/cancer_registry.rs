//! NCDIR hospital-based cancer registry (HBCR): the registry clerk's
//! worklist, the abstract for each staged cancer, and the sheet for NCDIR.
//!
//! Every `cancer_stagings` row is a case the hospital owes the registry. Its
//! abstract (`cancer_registry_abstracts`, migration 1390) holds the core-form
//! items the clinical record does not, coded to the manual
//! (`medbrains_core::specialty::hbcr`). Name, age, sex, address and hospital
//! number come from the patient; site, histology, TNM and stage from the
//! staging. A complete, reportable abstract goes on the export sheet; the
//! NCDIR registration the clerk gets back marks it submitted.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::permissions::specialty::other::oncology::registry;
use medbrains_core::specialty::hbcr::{self, HbcrCoding};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission},
    state::AppState,
};

/// Rows in the worklist at most.
const WORKLIST: i64 = 500;

/// One staged cancer in the clerk's worklist.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct WorklistRow {
    pub staging_id: Uuid,
    pub patient_id: Uuid,
    pub patient_name: String,
    pub uhid: String,
    pub primary_site: String,
    pub histology: Option<String>,
    pub staged_at: Option<DateTime<Utc>>,
    /// `due` when no abstract has been started.
    pub status: String,
    pub ncdir_reference: Option<String>,
    pub submitted_at: Option<DateTime<Utc>>,
}

/// What the clinical record already holds for a case.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CaseFacts {
    pub staging_id: Uuid,
    pub patient_id: Uuid,
    pub uhid: String,
    pub patient_name: String,
    pub date_of_birth: Option<NaiveDate>,
    pub gender: String,
    pub address: Option<serde_json::Value>,
    pub primary_site: String,
    pub histology: Option<String>,
    pub t_stage: Option<String>,
    pub n_stage: Option<String>,
    pub m_stage: Option<String>,
    pub overall_stage: Option<String>,
    pub staged_at: Option<DateTime<Utc>>,
}

/// A case with its abstract and what still stops it being complete.
#[derive(Debug, Serialize)]
pub struct CaseAbstract {
    pub facts: CaseFacts,
    pub status: String,
    pub coding: HbcrCoding,
    pub missing: Vec<&'static str>,
    pub ncdir_reference: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
struct Stored {
    status: String,
    hbcr_registration_no: Option<String>,
    date_of_first_diagnosis: Option<NaiveDate>,
    case_registered_through: Option<i16>,
    referral_type: Option<String>,
    method_of_diagnosis: Option<i16>,
    icdo3_topography: Option<String>,
    icdo3_morphology: Option<String>,
    icd10_code: Option<String>,
    laterality: Option<i16>,
    sequence: Option<i16>,
    extent_of_disease: Option<i16>,
    staging_system: Option<i16>,
    prior_treatment: Option<i16>,
    intention: Option<i16>,
    ecog: Option<i16>,
    treatment_at_ri: Option<i16>,
    ncdir_reference: Option<String>,
}

impl Stored {
    fn coding(&self) -> HbcrCoding {
        HbcrCoding {
            hbcr_registration_no: self.hbcr_registration_no.clone(),
            date_of_first_diagnosis: self.date_of_first_diagnosis,
            case_registered_through: self.case_registered_through,
            referral_type: self.referral_type.clone(),
            method_of_diagnosis: self.method_of_diagnosis,
            icdo3_topography: self.icdo3_topography.clone(),
            icdo3_morphology: self.icdo3_morphology.clone(),
            icd10_code: self.icd10_code.clone(),
            laterality: self.laterality,
            sequence: self.sequence,
            extent_of_disease: self.extent_of_disease,
            staging_system: self.staging_system,
            prior_treatment: self.prior_treatment,
            intention: self.intention,
            ecog: self.ecog,
            treatment_at_ri: self.treatment_at_ri,
        }
    }
}

const STORED: &str = "status, hbcr_registration_no, date_of_first_diagnosis, case_registered_through, \
    referral_type, method_of_diagnosis, icdo3_topography, icdo3_morphology, icd10_code, laterality, \
    sequence, extent_of_disease, staging_system, prior_treatment, intention, ecog, treatment_at_ri, \
    ncdir_reference";

const FACTS: &str = "SELECT s.id AS staging_id, s.patient_id, p.uhid, \
    trim(p.first_name || ' ' || coalesce(p.middle_name || ' ', '') || p.last_name) AS patient_name, \
    p.date_of_birth, p.gender::text AS gender, p.address, s.primary_site, s.histology, \
    s.t_stage, s.n_stage, s.m_stage, s.overall_stage, s.staged_at \
    FROM cancer_stagings s JOIN patients p ON p.id = s.patient_id \
    WHERE s.tenant_id = $1 AND s.id = $2";

async fn begin(
    state: &AppState,
    claims: &Claims,
) -> Result<sqlx::Transaction<'static, sqlx::Postgres>, AppError> {
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "specialty_other",
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    Ok(tx)
}

/// `GET /api/oncology/registry` — every staged cancer the user may see, with
/// its abstract's status.
pub async fn worklist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<WorklistRow>>, AppError> {
    require_permission(&claims, registry::LIST)?;
    let permitted = medbrains_authz_gate::patient_filter(&state, &claims, None).await?;
    let mut tx = begin(&state, &claims).await?;
    let rows = sqlx::query_as::<_, WorklistRow>(
        "SELECT s.id AS staging_id, s.patient_id, \
           trim(p.first_name || ' ' || p.last_name) AS patient_name, p.uhid, s.primary_site, \
           s.histology, s.staged_at, coalesce(a.status, 'due') AS status, a.ncdir_reference, \
           a.submitted_at \
         FROM cancer_stagings s JOIN patients p ON p.id = s.patient_id \
         LEFT JOIN cancer_registry_abstracts a ON a.staging_id = s.id AND a.deleted_at IS NULL \
         WHERE s.tenant_id = $1 AND ($2::uuid[] IS NULL OR s.patient_id = ANY($2)) \
         ORDER BY (coalesce(a.status, 'due') = 'submitted'), s.staged_at DESC NULLS LAST LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(permitted.as_deref())
    .bind(WORKLIST)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows))
}

async fn load(
    tx: &mut sqlx::Transaction<'static, sqlx::Postgres>,
    tenant: Uuid,
    staging_id: Uuid,
) -> Result<CaseAbstract, AppError> {
    let facts = sqlx::query_as::<_, CaseFacts>(FACTS)
        .bind(tenant)
        .bind(staging_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)?;
    let stored = sqlx::query_as::<_, Stored>(&format!(
        "SELECT {STORED} FROM cancer_registry_abstracts \
         WHERE tenant_id = $1 AND staging_id = $2 AND deleted_at IS NULL"
    ))
    .bind(tenant)
    .bind(staging_id)
    .fetch_optional(&mut **tx)
    .await?;
    let coding = stored.as_ref().map(Stored::coding).unwrap_or_default();
    Ok(CaseAbstract {
        missing: hbcr::missing(&coding),
        status: stored
            .as_ref()
            .map_or_else(|| "due".to_owned(), |s| s.status.clone()),
        ncdir_reference: stored.and_then(|s| s.ncdir_reference),
        coding,
        facts,
    })
}

async fn patient_of(state: &AppState, claims: &Claims, staging_id: Uuid) -> Result<(), AppError> {
    let mut tx = begin(state, claims).await?;
    let patient: Option<Uuid> = sqlx::query_scalar(
        "SELECT patient_id FROM cancer_stagings WHERE tenant_id = $1 AND id = $2",
    )
    .bind(claims.tenant_id)
    .bind(staging_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;
    medbrains_authz_gate::require_patient_access(state, claims, patient.ok_or(AppError::NotFound)?)
        .await
}

/// `GET /api/oncology/registry/{staging_id}` — one case and its abstract.
pub async fn get_abstract(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(staging_id): Path<Uuid>,
) -> Result<Json<CaseAbstract>, AppError> {
    require_permission(&claims, registry::LIST)?;
    patient_of(&state, &claims, staging_id).await?;
    let mut tx = begin(&state, &claims).await?;
    let case = load(&mut tx, claims.tenant_id, staging_id).await?;
    tx.commit().await?;
    Ok(Json(case))
}

/// `PUT /api/oncology/registry/{staging_id}` — save the abstract. It is
/// complete when no mandatory item is blank; a submitted one cannot change.
pub async fn save_abstract(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(staging_id): Path<Uuid>,
    Json(c): Json<HbcrCoding>,
) -> Result<Json<CaseAbstract>, AppError> {
    require_permission(&claims, registry::ABSTRACT)?;
    patient_of(&state, &claims, staging_id).await?;
    let errors = hbcr::invalid(&c);
    if !errors.is_empty() {
        return Err(AppError::BadRequest(errors.join("; ")));
    }
    let status = if hbcr::missing(&c).is_empty() {
        "complete"
    } else {
        "draft"
    };
    let mut tx = begin(&state, &claims).await?;
    let current = load(&mut tx, claims.tenant_id, staging_id).await?;
    if current.status == "submitted" {
        return Err(AppError::Conflict(
            "this case has been submitted to NCDIR".to_owned(),
        ));
    }
    let trimmed = |s: &Option<String>| {
        s.as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(str::to_owned)
    };
    sqlx::query(
        "INSERT INTO cancer_registry_abstracts (tenant_id, staging_id, patient_id, status, \
           hbcr_registration_no, date_of_first_diagnosis, case_registered_through, referral_type, \
           method_of_diagnosis, icdo3_topography, icdo3_morphology, icd10_code, laterality, sequence, \
           extent_of_disease, staging_system, prior_treatment, intention, ecog, treatment_at_ri, \
           completed_by, completed_at, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, \
           CASE WHEN $4 = 'complete' THEN $21 END, CASE WHEN $4 = 'complete' THEN now() END, $21) \
         ON CONFLICT (staging_id) WHERE deleted_at IS NULL DO UPDATE SET \
           status = EXCLUDED.status, hbcr_registration_no = EXCLUDED.hbcr_registration_no, \
           date_of_first_diagnosis = EXCLUDED.date_of_first_diagnosis, \
           case_registered_through = EXCLUDED.case_registered_through, \
           referral_type = EXCLUDED.referral_type, method_of_diagnosis = EXCLUDED.method_of_diagnosis, \
           icdo3_topography = EXCLUDED.icdo3_topography, icdo3_morphology = EXCLUDED.icdo3_morphology, \
           icd10_code = EXCLUDED.icd10_code, laterality = EXCLUDED.laterality, \
           sequence = EXCLUDED.sequence, extent_of_disease = EXCLUDED.extent_of_disease, \
           staging_system = EXCLUDED.staging_system, prior_treatment = EXCLUDED.prior_treatment, \
           intention = EXCLUDED.intention, ecog = EXCLUDED.ecog, \
           treatment_at_ri = EXCLUDED.treatment_at_ri, completed_by = EXCLUDED.completed_by, \
           completed_at = EXCLUDED.completed_at",
    )
    .bind(claims.tenant_id)
    .bind(staging_id)
    .bind(current.facts.patient_id)
    .bind(status)
    .bind(trimmed(&c.hbcr_registration_no))
    .bind(c.date_of_first_diagnosis)
    .bind(c.case_registered_through)
    .bind(c.referral_type.as_deref())
    .bind(c.method_of_diagnosis)
    .bind(trimmed(&c.icdo3_topography))
    .bind(trimmed(&c.icdo3_morphology))
    .bind(trimmed(&c.icd10_code))
    .bind(c.laterality)
    .bind(c.sequence)
    .bind(c.extent_of_disease)
    .bind(c.staging_system)
    .bind(c.prior_treatment)
    .bind(c.intention)
    .bind(c.ecog)
    .bind(c.treatment_at_ri)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    let case = load(&mut tx, claims.tenant_id, staging_id).await?;
    tx.commit().await?;
    Ok(Json(case))
}

#[derive(Debug, Deserialize)]
pub struct Submitted {
    pub ncdir_reference: String,
}

/// `POST /api/oncology/registry/{staging_id}/submitted` — record that a
/// complete abstract was submitted to NCDIR, with the registration it got.
pub async fn mark_submitted(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(staging_id): Path<Uuid>,
    Json(body): Json<Submitted>,
) -> Result<Json<CaseAbstract>, AppError> {
    require_permission(&claims, registry::EXPORT)?;
    patient_of(&state, &claims, staging_id).await?;
    let reference = body.ncdir_reference.trim();
    if reference.is_empty() || reference.chars().count() > 60 {
        return Err(AppError::BadRequest(
            "give the NCDIR registration (up to 60 characters)".to_owned(),
        ));
    }
    let mut tx = begin(&state, &claims).await?;
    let updated = sqlx::query(
        "UPDATE cancer_registry_abstracts SET status = 'submitted', ncdir_reference = $3, \
           submitted_by = $4, submitted_at = now() \
         WHERE tenant_id = $1 AND staging_id = $2 AND status = 'complete' AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(staging_id)
    .bind(reference)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if updated == 0 {
        return Err(AppError::Conflict(
            "only a complete abstract can be submitted".to_owned(),
        ));
    }
    let case = load(&mut tx, claims.tenant_id, staging_id).await?;
    tx.commit().await?;
    Ok(Json(case))
}

/// `GET /api/specialty/oncology/registry/codes` — the manual's code lists,
/// keyed by abstract field, so the form offers exactly the codes the server
/// accepts.
pub async fn code_lists(
    Extension(claims): Extension<Claims>,
) -> Result<Json<std::collections::BTreeMap<&'static str, hbcr::Codes>>, AppError> {
    require_permission(&claims, registry::LIST)?;
    Ok(Json(hbcr::CODE_LISTS.iter().copied().collect()))
}

#[path = "cancer_registry_export.rs"]
mod export;
pub use export::export_sheet;

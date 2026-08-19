//! Surviving Sepsis Campaign "Hour-1 bundle" tracker. Sepsis is a time-critical emergency — the five
//! bundle elements (measure lactate, blood cultures before antibiotics, broad-spectrum antibiotics,
//! 30 mL/kg crystalloid for hypotension or lactate >= 4, vasopressors for persisting hypotension) must
//! be delivered within one hour of recognition, and every hour of antibiotic delay raises mortality.
//! Each element's completion time is recorded and the "within the hour" compliance is computed
//! server-side, so the NABH Hour-1-bundle KPI reflects real timing rather than a guess.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SepsisBundle {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    pub recognised_at: DateTime<Utc>,
    pub fluids_indicated: bool,
    pub initial_lactate: Option<f64>,
    pub lactate_measured_at: Option<DateTime<Utc>>,
    pub blood_cultures_at: Option<DateTime<Utc>>,
    pub antibiotics_at: Option<DateTime<Utc>>,
    pub fluids_started_at: Option<DateTime<Utc>>,
    pub vasopressors_at: Option<DateTime<Utc>>,
    pub bundle_compliant: bool,
    pub notes: Option<String>,
    pub recorded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// One bundle element with its delivery + on-time status, for the checklist UI.
#[derive(Debug, Serialize)]
pub struct SepsisBundleElement {
    pub key: &'static str,
    pub label: &'static str,
    pub done: bool,
    /// Delivered within one hour of recognition.
    pub on_time: bool,
    /// Whether this element counts toward compliance for this patient.
    pub required: bool,
}

#[derive(Debug, Serialize)]
pub struct SepsisBundleView {
    pub bundle: SepsisBundle,
    pub elements: Vec<SepsisBundleElement>,
}

const COLS: &str = "id, patient_id, admission_id, recognised_at, fluids_indicated, \
     initial_lactate, lactate_measured_at, blood_cultures_at, antibiotics_at, fluids_started_at, \
     vasopressors_at, bundle_compliant, notes, recorded_by, created_at, updated_at";

fn on_time(recognised: DateTime<Utc>, ts: Option<DateTime<Utc>>) -> bool {
    ts.is_some_and(|t| t <= recognised + chrono::Duration::hours(1))
}

fn build_view(b: SepsisBundle) -> SepsisBundleView {
    let r = b.recognised_at;
    let fluids_required = b.fluids_indicated;
    let elements = vec![
        SepsisBundleElement {
            key: "lactate",
            label: "Measure lactate level",
            done: b.lactate_measured_at.is_some(),
            on_time: on_time(r, b.lactate_measured_at),
            required: true,
        },
        SepsisBundleElement {
            key: "cultures",
            label: "Blood cultures before antibiotics",
            done: b.blood_cultures_at.is_some(),
            on_time: on_time(r, b.blood_cultures_at),
            required: true,
        },
        SepsisBundleElement {
            key: "antibiotics",
            label: "Broad-spectrum antibiotics",
            done: b.antibiotics_at.is_some(),
            on_time: on_time(r, b.antibiotics_at),
            required: true,
        },
        SepsisBundleElement {
            key: "fluids",
            label: "30 mL/kg crystalloid (hypotension or lactate ≥ 4)",
            done: b.fluids_started_at.is_some(),
            on_time: on_time(r, b.fluids_started_at),
            required: fluids_required,
        },
        SepsisBundleElement {
            key: "vasopressors",
            label: "Vasopressors for persisting hypotension (MAP ≥ 65)",
            done: b.vasopressors_at.is_some(),
            on_time: on_time(r, b.vasopressors_at),
            required: fluids_required,
        },
    ];
    SepsisBundleView { bundle: b, elements }
}

/// All required elements delivered within one hour of recognition.
fn compute_compliant(b: &SepsisBundle) -> bool {
    let r = b.recognised_at;
    let core = on_time(r, b.lactate_measured_at)
        && on_time(r, b.blood_cultures_at)
        && on_time(r, b.antibiotics_at);
    let fluids = !b.fluids_indicated
        || (on_time(r, b.fluids_started_at) && on_time(r, b.vasopressors_at));
    core && fluids
}

#[derive(Debug, Deserialize)]
pub struct CreateSepsisBundleRequest {
    pub patient_id: Uuid,
    pub admission_id: Option<Uuid>,
    /// Defaults to now — the moment sepsis was recognised, when the Hour-1 clock starts.
    pub recognised_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub fluids_indicated: bool,
    pub initial_lactate: Option<f64>,
    pub notes: Option<String>,
}

/// `POST /api/clinical/sepsis-bundle`
pub async fn create_sepsis_bundle(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateSepsisBundleRequest>,
) -> Result<Json<SepsisBundleView>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    // A sepsis bundle is an emergency treatment record on the named patient.
    medbrains_authz_gate::require_patient_access(&state, &claims, body.patient_id)
        .await?;
    let recognised_at = body.recognised_at.unwrap_or_else(Utc::now);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let row = sqlx::query_as::<_, SepsisBundle>(&format!(
        "INSERT INTO sepsis_hour1_bundles \
         (tenant_id, patient_id, admission_id, recognised_at, fluids_indicated, initial_lactate, \
          notes, recorded_by, bundle_compliant) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false) \
         RETURNING {COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.admission_id)
    .bind(recognised_at)
    .bind(body.fluids_indicated)
    .bind(body.initial_lactate)
    .bind(body.notes.as_deref())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(build_view(row)))
}

#[derive(Debug, Deserialize)]
pub struct UpdateSepsisBundleRequest {
    /// Stamp the element's completion at "now" if not already recorded.
    #[serde(default)]
    pub mark_lactate: bool,
    #[serde(default)]
    pub mark_cultures: bool,
    #[serde(default)]
    pub mark_antibiotics: bool,
    #[serde(default)]
    pub mark_fluids: bool,
    #[serde(default)]
    pub mark_vasopressors: bool,
    pub fluids_indicated: Option<bool>,
    pub initial_lactate: Option<f64>,
    pub notes: Option<String>,
}

/// `PATCH /api/clinical/sepsis-bundle/{id}` — record element completions and recompute compliance.
pub async fn update_sepsis_bundle(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSepsisBundleRequest>,
) -> Result<Json<SepsisBundleView>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::CREATE)?;
    // Sepsis hour-1 timings are the record of how fast somebody was treated.
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::SEPSIS_BUNDLE,
        id,
    )
    .await?;
    let now = Utc::now();

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let mut existing = sqlx::query_as::<_, SepsisBundle>(&format!(
        "SELECT {COLS} FROM sepsis_hour1_bundles WHERE tenant_id = $1 AND id = $2 FOR UPDATE"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Stamp each newly-completed element; never overwrite an existing time.
    let stamp = |current: Option<DateTime<Utc>>, mark: bool| current.or(mark.then_some(now));
    existing.lactate_measured_at = stamp(existing.lactate_measured_at, body.mark_lactate);
    existing.blood_cultures_at = stamp(existing.blood_cultures_at, body.mark_cultures);
    existing.antibiotics_at = stamp(existing.antibiotics_at, body.mark_antibiotics);
    existing.fluids_started_at = stamp(existing.fluids_started_at, body.mark_fluids);
    existing.vasopressors_at = stamp(existing.vasopressors_at, body.mark_vasopressors);
    if let Some(fi) = body.fluids_indicated {
        existing.fluids_indicated = fi;
    }
    if let Some(lac) = body.initial_lactate {
        existing.initial_lactate = Some(lac);
    }
    if let Some(n) = body.notes.as_deref() {
        existing.notes = Some(n.to_owned());
    }
    let compliant = compute_compliant(&existing);

    let row = sqlx::query_as::<_, SepsisBundle>(&format!(
        "UPDATE sepsis_hour1_bundles SET \
         lactate_measured_at = $3, blood_cultures_at = $4, antibiotics_at = $5, \
         fluids_started_at = $6, vasopressors_at = $7, fluids_indicated = $8, \
         initial_lactate = $9, notes = $10, bundle_compliant = $11, updated_at = now() \
         WHERE tenant_id = $1 AND id = $2 RETURNING {COLS}"
    ))
    .bind(claims.tenant_id)
    .bind(id)
    .bind(existing.lactate_measured_at)
    .bind(existing.blood_cultures_at)
    .bind(existing.antibiotics_at)
    .bind(existing.fluids_started_at)
    .bind(existing.vasopressors_at)
    .bind(existing.fluids_indicated)
    .bind(existing.initial_lactate)
    .bind(existing.notes.as_deref())
    .bind(compliant)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(build_view(row)))
}

#[derive(Debug, Deserialize)]
pub struct ListSepsisBundleQuery {
    pub patient_id: Uuid,
}

/// `GET /api/clinical/sepsis-bundles?patient_id=`
pub async fn list_sepsis_bundles(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListSepsisBundleQuery>,
) -> Result<Json<Vec<SepsisBundleView>>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    // One patient's sepsis bundles — an empty list here reads as "no sepsis".
    medbrains_authz_gate::require_patient_access(&state, &claims, params.patient_id)
        .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let rows = sqlx::query_as::<_, SepsisBundle>(&format!(
        "SELECT {COLS} FROM sepsis_hour1_bundles \
         WHERE tenant_id = $1 AND patient_id = $2 ORDER BY recognised_at DESC LIMIT 100"
    ))
    .bind(claims.tenant_id)
    .bind(params.patient_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Json(rows.into_iter().map(build_view).collect()))
}

#[cfg(test)]
mod tests {
    use super::{SepsisBundle, compute_compliant};
    use chrono::{Duration, Utc};
    use uuid::Uuid;

    fn bundle(recognised_offset_min: i64) -> SepsisBundle {
        let r = Utc::now();
        SepsisBundle {
            id: Uuid::nil(),
            patient_id: Uuid::nil(),
            admission_id: None,
            recognised_at: r,
            fluids_indicated: false,
            initial_lactate: None,
            lactate_measured_at: Some(r + Duration::minutes(recognised_offset_min)),
            blood_cultures_at: Some(r + Duration::minutes(recognised_offset_min)),
            antibiotics_at: Some(r + Duration::minutes(recognised_offset_min)),
            fluids_started_at: None,
            vasopressors_at: None,
            bundle_compliant: false,
            notes: None,
            recorded_by: None,
            created_at: r,
            updated_at: r,
        }
    }

    #[test]
    fn core_elements_within_hour_are_compliant() {
        assert!(compute_compliant(&bundle(30)));
    }

    #[test]
    fn element_after_hour_is_not_compliant() {
        assert!(!compute_compliant(&bundle(75)));
    }

    #[test]
    fn missing_core_element_is_not_compliant() {
        let mut b = bundle(20);
        b.antibiotics_at = None;
        assert!(!compute_compliant(&b));
    }

    #[test]
    fn fluids_required_when_indicated() {
        let mut b = bundle(20);
        b.fluids_indicated = true; // now fluids + vasopressors required, both still None
        assert!(!compute_compliant(&b));
        b.fluids_started_at = Some(b.recognised_at + Duration::minutes(40));
        b.vasopressors_at = Some(b.recognised_at + Duration::minutes(50));
        assert!(compute_compliant(&b));
    }
}

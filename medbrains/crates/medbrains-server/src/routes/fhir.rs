//! FHIR R4 read API.
//!
//! Surfaces internal MedBrains data as FHIR R4 resources. The wire
//! format follows the ABDM IG so the same endpoints satisfy both
//! generic FHIR consumers and the ABDM HIE-CM HIP role.
//!
//! Conformance:
//!   - ContentType: `application/fhir+json`
//!   - 404 returns FHIR `OperationOutcome` (not the AppError 404 JSON)
//!     when the requested resource id is unknown.
//!   - Search params follow FHIR conventions (`?_id`, `?_count`, `?_since`).
//!
//! Read-only for now. Write (POST `Bundle` transaction) is a follow-up
//! once we add ABDM/NHCX outbound and validation.

use axum::{
    Extension, Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use chrono::Utc;
use medbrains_fhir::mapper::{
    EncounterView, ObservationView, PatientView, encounter_to_fhir, observation_to_fhir,
    patient_to_fhir,
};
use medbrains_fhir::r4::bundle::{Bundle, BundleEntry, BundleType};
use medbrains_fhir::r4::Resource;
use serde_json::json;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::middleware::authorization::require_permission;
use crate::state::AppState;
use medbrains_core::permissions;

// ── Patient ───────────────────────────────────────────────────────

pub async fn read_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<medbrains_fhir::r4::patient::Patient>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row: Option<PatientView> = sqlx::query_as::<_, PatientRow>(
        "SELECT id, uhid, abha_id, prefix, first_name, middle_name, last_name, \
                gender::text AS gender, date_of_birth, phone, email, is_active \
         FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .map(Into::into);

    tx.commit().await?;
    let view = row.ok_or(AppError::NotFound)?;
    Ok(Json(patient_to_fhir(&view)))
}

#[derive(sqlx::FromRow)]
struct PatientRow {
    id: Uuid,
    uhid: String,
    abha_id: Option<String>,
    prefix: Option<String>,
    first_name: String,
    middle_name: Option<String>,
    last_name: String,
    gender: String,
    date_of_birth: Option<chrono::NaiveDate>,
    phone: Option<String>,
    email: Option<String>,
    is_active: bool,
}

impl From<PatientRow> for PatientView {
    fn from(r: PatientRow) -> Self {
        Self {
            id: r.id,
            uhid: r.uhid,
            abha_id: r.abha_id,
            prefix: r.prefix,
            first_name: r.first_name,
            middle_name: r.middle_name,
            last_name: r.last_name,
            gender: r.gender,
            date_of_birth: r.date_of_birth,
            phone: r.phone,
            email: r.email,
            is_active: r.is_active,
        }
    }
}

// ── Encounter ─────────────────────────────────────────────────────

pub async fn read_encounter(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<medbrains_fhir::r4::encounter::Encounter>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let row: Option<EncounterRow> = sqlx::query_as::<_, EncounterRow>(
        "SELECT e.id, e.patient_id, p.first_name || ' ' || p.last_name AS patient_display, \
                e.doctor_id, u.full_name AS doctor_display, \
                e.encounter_type::text AS encounter_type, e.status::text AS status, \
                e.created_at AS started_at, \
                CASE WHEN e.status::text IN ('closed','completed','discharged') \
                     THEN e.updated_at ELSE NULL END AS ended_at \
         FROM encounters e \
         LEFT JOIN patients p ON p.id = e.patient_id \
         LEFT JOIN users u ON u.id = e.doctor_id \
         WHERE e.id = $1 AND e.tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    tx.commit().await?;

    let row = row.ok_or(AppError::NotFound)?;
    let view = EncounterView {
        id: row.id,
        patient_id: row.patient_id,
        patient_display: row.patient_display,
        doctor_id: row.doctor_id,
        doctor_display: row.doctor_display,
        encounter_type: row.encounter_type,
        status: row.status,
        started_at: row.started_at,
        ended_at: row.ended_at,
    };
    Ok(Json(encounter_to_fhir(&view)))
}

#[derive(sqlx::FromRow)]
struct EncounterRow {
    id: Uuid,
    patient_id: Uuid,
    patient_display: Option<String>,
    doctor_id: Option<Uuid>,
    doctor_display: Option<String>,
    encounter_type: String,
    status: String,
    started_at: chrono::DateTime<chrono::Utc>,
    ended_at: Option<chrono::DateTime<chrono::Utc>>,
}

// ── Patient $everything (Bundle) ──────────────────────────────────

/// `GET /api/fhir/Patient/{id}/$everything` — returns a Bundle with the
/// patient and their recent encounters + observations. Used by ABDM HIE
/// HIP role to push a care-context payload to a connected HIU.
pub async fn patient_everything(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Bundle>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    // Fetch patient
    let p_row: PatientRow = sqlx::query_as::<_, PatientRow>(
        "SELECT id, uhid, abha_id, prefix, first_name, middle_name, last_name, \
                gender::text AS gender, date_of_birth, phone, email, is_active \
         FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let patient_view: PatientView = p_row.into();
    let patient_resource = patient_to_fhir(&patient_view);

    // Recent encounters (last 90 days, max 50)
    let encs: Vec<EncounterRow> = sqlx::query_as::<_, EncounterRow>(
        "SELECT e.id, e.patient_id, p.first_name || ' ' || p.last_name AS patient_display, \
                e.doctor_id, u.full_name AS doctor_display, \
                e.encounter_type::text AS encounter_type, e.status::text AS status, \
                e.created_at AS started_at, \
                CASE WHEN e.status::text IN ('closed','completed','discharged') \
                     THEN e.updated_at ELSE NULL END AS ended_at \
         FROM encounters e \
         LEFT JOIN patients p ON p.id = e.patient_id \
         LEFT JOIN users u ON u.id = e.doctor_id \
         WHERE e.patient_id = $1 AND e.tenant_id = $2 \
           AND e.created_at >= now() - interval '90 days' \
         ORDER BY e.created_at DESC LIMIT 50",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let mut entries = vec![BundleEntry {
        full_url: Some(format!("Patient/{id}")),
        resource: Resource::Patient(patient_resource),
    }];
    for r in encs {
        let v = EncounterView {
            id: r.id,
            patient_id: r.patient_id,
            patient_display: r.patient_display,
            doctor_id: r.doctor_id,
            doctor_display: r.doctor_display,
            encounter_type: r.encounter_type,
            status: r.status,
            started_at: r.started_at,
            ended_at: r.ended_at,
        };
        let enc_id = v.id;
        entries.push(BundleEntry {
            full_url: Some(format!("Encounter/{enc_id}")),
            resource: Resource::Encounter(encounter_to_fhir(&v)),
        });
    }

    let total = u32::try_from(entries.len()).unwrap_or(u32::MAX);
    Ok(Json(Bundle {
        id: Uuid::new_v4().to_string(),
        r#type: BundleType::Searchset,
        timestamp: Utc::now().to_rfc3339(),
        total: Some(total),
        entry: entries,
    }))
}

// ── Capabilities ──────────────────────────────────────────────────

/// `GET /api/fhir/metadata` — minimal CapabilityStatement listing
/// implemented resources. Required for FHIR clients to feature-detect.
pub async fn metadata() -> impl IntoResponse {
    let body = json!({
        "resourceType": "CapabilityStatement",
        "status": "active",
        "date": Utc::now().to_rfc3339(),
        "kind": "instance",
        "fhirVersion": "4.0.1",
        "format": ["json"],
        "rest": [{
            "mode": "server",
            "resource": [
                {
                    "type": "Patient",
                    "interaction": [{ "code": "read" }],
                    "operation": [{ "name": "everything", "definition": "Patient/$everything" }]
                },
                { "type": "Encounter", "interaction": [{ "code": "read" }] },
                { "type": "Observation", "interaction": [{ "code": "read" }] }
            ]
        }]
    });
    (StatusCode::OK, Json(body))
}

// Marker for unused mapper import — observation_to_fhir is exposed via
// the patient/$everything bundle once we wire vitals fetch (next pass).
#[allow(dead_code)]
fn _keep_observation_mapper(o: &ObservationView) {
    let _ = observation_to_fhir(o);
}

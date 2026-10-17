//! Released lab and imaging reports as FHIR `DiagnosticReport`, with each
//! lab report's results as LOINC-coded `Observation`s (#225) — what an ABDM
//! HIP shares with a consented HIU.
//!
//! Only released reports leave: a lab order once verified, an imaging report
//! once verified (a draft is the radiologist's working copy).

use std::collections::HashMap;

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_fhir::mapper::{ObservationView, observation_to_fhir};
use medbrains_fhir::r4::Resource;
use medbrains_fhir::r4::bundle::BundleEntry;
use medbrains_fhir::r4::diagnostic_report::{
    DiagnosticReportView, ReportKind, diagnostic_report_to_fhir,
};
use medbrains_server_core::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::{is_bypass_role, require_permission},
    state::AppState,
};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Bound on reports per `$everything`; the same 90-day window as encounters.
const MAX_REPORTS: i64 = 200;

#[derive(sqlx::FromRow)]
struct LabOrderRow {
    id: Uuid,
    patient_id: Uuid,
    encounter_id: Option<Uuid>,
    code: String,
    display: String,
    effective_at: DateTime<Utc>,
    verified_at: DateTime<Utc>,
    conclusion: Option<String>,
}

#[derive(sqlx::FromRow)]
struct ResultRow {
    id: Uuid,
    order_id: Uuid,
    code: String,
    display: String,
    value: String,
    unit: Option<String>,
    flag: Option<String>,
}

#[derive(sqlx::FromRow)]
struct ImagingRow {
    id: Uuid,
    patient_id: Uuid,
    encounter_id: Option<Uuid>,
    code: String,
    display: String,
    status: String,
    effective_at: DateTime<Utc>,
    verified_at: Option<DateTime<Utc>>,
    conclusion: Option<String>,
}

/// Which records to read: one by id, or a patient's recent ones.
#[derive(Debug, Clone, Copy)]
pub enum Scope {
    Record(Uuid),
    PatientRecent(Uuid),
}

impl Scope {
    const fn ids(self) -> (Option<Uuid>, Option<Uuid>) {
        match self {
            Self::Record(id) => (Some(id), None),
            Self::PatientRecent(p) => (None, Some(p)),
        }
    }
}

/// The HL7 v3 `ObservationInterpretation` code for a result flag.
fn interpretation(flag: &str) -> Option<&'static str> {
    match flag {
        "high" => Some("H"),
        "low" => Some("L"),
        "critical_high" => Some("HH"),
        "critical_low" => Some("LL"),
        "abnormal" => Some("A"),
        _ => None,
    }
}

/// Released lab reports and their results, as bundle entries (reports first).
pub async fn lab_entries(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    scope: Scope,
) -> Result<Vec<BundleEntry>, AppError> {
    let (order, patient) = scope.ids();
    let orders = sqlx::query_as::<_, LabOrderRow>(
        "SELECT lo.id, lo.patient_id, lo.encounter_id, \
                COALESCE(NULLIF(t.loinc_code, ''), t.code) AS code, t.name AS display, \
                COALESCE(lo.collected_at, lo.created_at) AS effective_at, lo.verified_at, \
                NULLIF(lo.interpretation, '') AS conclusion \
           FROM lab_orders lo JOIN lab_test_catalog t ON t.id = lo.test_id \
          WHERE lo.tenant_id = $1 AND lo.deleted_at IS NULL AND lo.verified_at IS NOT NULL \
            AND ($2::uuid IS NULL OR lo.id = $2) \
            AND ($3::uuid IS NULL OR (lo.patient_id = $3 AND lo.verified_at >= now() - interval '90 days')) \
          ORDER BY lo.verified_at DESC LIMIT $4",
    )
    .bind(tenant_id)
    .bind(order)
    .bind(patient)
    .bind(MAX_REPORTS)
    .fetch_all(&mut **tx)
    .await?;
    let ids: Vec<Uuid> = orders.iter().map(|o| o.id).collect();
    // One round trip for every report's results.
    let results = sqlx::query_as::<_, ResultRow>(
        "SELECT r.id, r.order_id, COALESCE(NULLIF(t.loinc_code, ''), r.parameter_name) AS code, \
                r.parameter_name AS display, r.value, r.unit, r.flag::text AS flag \
           FROM lab_results r \
           JOIN lab_orders lo ON lo.id = r.order_id AND lo.tenant_id = r.tenant_id \
           JOIN lab_test_catalog t ON t.id = lo.test_id \
          WHERE r.tenant_id = $1 AND r.order_id = ANY($2) AND r.deleted_at IS NULL \
          ORDER BY r.display_order NULLS LAST, r.created_at",
    )
    .bind(tenant_id)
    .bind(&ids)
    .fetch_all(&mut **tx)
    .await?;
    let mut by_order: HashMap<Uuid, Vec<ResultRow>> = HashMap::new();
    for r in results {
        by_order.entry(r.order_id).or_default().push(r);
    }

    let mut entries = Vec::new();
    for o in orders {
        let rows = by_order.remove(&o.id).unwrap_or_default();
        entries.push(entry(
            "DiagnosticReport",
            o.id,
            Resource::DiagnosticReport(diagnostic_report_to_fhir(&DiagnosticReportView {
                id: o.id,
                kind: ReportKind::Laboratory,
                patient_id: o.patient_id,
                encounter_id: o.encounter_id,
                code: o.code,
                display: o.display,
                status: "final".to_owned(),
                effective_at: o.effective_at,
                issued_at: Some(o.verified_at),
                conclusion: o.conclusion,
                observation_ids: rows.iter().map(|r| r.id).collect(),
            })),
        ));
        for r in rows {
            entries.push(observation_entry(
                &r,
                o.patient_id,
                o.encounter_id,
                o.verified_at,
            ));
        }
    }
    Ok(entries)
}

fn observation_entry(
    r: &ResultRow,
    patient_id: Uuid,
    encounter_id: Option<Uuid>,
    at: DateTime<Utc>,
) -> BundleEntry {
    entry(
        "Observation",
        r.id,
        Resource::Observation(observation_to_fhir(&ObservationView {
            id: r.id,
            patient_id,
            encounter_id,
            code: r.code.clone(),
            display: r.display.clone(),
            category: "laboratory".to_owned(),
            effective_at: at,
            value_numeric: r.value.trim().parse().ok(),
            unit: r.unit.clone(),
            value_string: Some(r.value.clone()),
            status: "final".to_owned(),
            abnormal_flag: r
                .flag
                .as_deref()
                .and_then(interpretation)
                .map(str::to_owned),
        })),
    )
}

fn entry(kind: &str, id: Uuid, resource: Resource) -> BundleEntry {
    BundleEntry {
        full_url: Some(format!("{kind}/{id}")),
        resource,
    }
}

/// Released imaging reports, as bundle entries.
pub async fn imaging_entries(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    scope: Scope,
) -> Result<Vec<BundleEntry>, AppError> {
    let (report, patient) = scope.ids();
    let rows = sqlx::query_as::<_, ImagingRow>(
        "SELECT rr.id, ro.patient_id, ro.encounter_id, \
                COALESCE(e.code, m.code) AS code, \
                COALESCE(e.name, m.name || COALESCE(' — ' || ro.body_part, '')) AS display, \
                rr.status::text AS status, COALESCE(ro.completed_at, rr.created_at) AS effective_at, \
                rr.verified_at, COALESCE(NULLIF(rr.impression, ''), rr.findings) AS conclusion \
           FROM radiology_reports rr \
           JOIN radiology_orders ro ON ro.id = rr.order_id AND ro.tenant_id = rr.tenant_id \
           JOIN radiology_modalities m ON m.id = ro.modality_id \
           LEFT JOIN radiology_exams e ON e.id = ro.exam_id \
          WHERE rr.tenant_id = $1 AND rr.deleted_at IS NULL AND ro.deleted_at IS NULL \
            AND rr.verified_at IS NOT NULL AND rr.status::text <> 'draft' \
            AND ($2::uuid IS NULL OR rr.id = $2) \
            AND ($3::uuid IS NULL OR (ro.patient_id = $3 AND rr.verified_at >= now() - interval '90 days')) \
          ORDER BY rr.verified_at DESC LIMIT $4",
    )
    .bind(tenant_id)
    .bind(report)
    .bind(patient)
    .bind(MAX_REPORTS)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| {
            entry(
                "DiagnosticReport",
                r.id,
                Resource::DiagnosticReport(diagnostic_report_to_fhir(&DiagnosticReportView {
                    id: r.id,
                    kind: ReportKind::Imaging,
                    patient_id: r.patient_id,
                    encounter_id: r.encounter_id,
                    code: r.code,
                    display: r.display,
                    status: r.status,
                    effective_at: r.effective_at,
                    issued_at: r.verified_at,
                    conclusion: r.conclusion,
                    observation_ids: Vec::new(),
                })),
            )
        })
        .collect())
}

fn patient_of(resource: &Resource) -> Option<Uuid> {
    let subject = match resource {
        Resource::DiagnosticReport(r) => &r.subject,
        Resource::Observation(o) => &o.subject,
        _ => return None,
    };
    subject.reference.strip_prefix("Patient/")?.parse().ok()
}

/// The first entry whose resource is `kind`, once the caller may see whose it is.
async fn release(
    state: &AppState,
    claims: &Claims,
    entries: Vec<BundleEntry>,
    kind: &str,
) -> Result<Json<Resource>, AppError> {
    let found = entries
        .into_iter()
        .find(|e| e.full_url.as_deref().is_some_and(|u| u.starts_with(kind)))
        .ok_or(AppError::NotFound)?;
    let patient = patient_of(&found.resource).ok_or(AppError::NotFound)?;
    medbrains_authz_gate::require_patient_access(state, claims, patient).await?;
    Ok(Json(found.resource))
}

/// Whether the caller holds `perm` — a read of their token, which cannot fail.
fn holds(claims: &Claims, perm: &str) -> bool {
    is_bypass_role(claims) || claims.permissions.iter().any(|p| p == perm)
}

/// `GET /api/fhir/DiagnosticReport/{id}` — a lab order id or an imaging report id.
pub async fn read_diagnostic_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Resource>, AppError> {
    let can_lab = holds(&claims, permissions::lab::orders::VIEW);
    let can_imaging = holds(&claims, permissions::radiology::orders::VIEW);
    if !can_lab && !can_imaging {
        return Err(AppError::Forbidden);
    }
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let mut entries = Vec::new();
    if can_lab {
        entries = lab_entries(&mut tx, claims.tenant_id, Scope::Record(id)).await?;
    }
    if entries.is_empty() && can_imaging {
        entries = imaging_entries(&mut tx, claims.tenant_id, Scope::Record(id)).await?;
    }
    tx.commit().await?;
    release(&state, &claims, entries, "DiagnosticReport").await
}

/// `GET /api/fhir/Observation/{id}` — one released lab result.
pub async fn read_observation(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Resource>, AppError> {
    require_permission(&claims, permissions::lab::orders::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let order: Option<Uuid> = sqlx::query_scalar(
        "SELECT order_id FROM lab_results WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;
    let entries = match order {
        Some(order) => lab_entries(&mut tx, claims.tenant_id, Scope::Record(order)).await?,
        None => Vec::new(),
    };
    tx.commit().await?;
    let wanted = format!("Observation/{id}");
    let only: Vec<BundleEntry> = entries
        .into_iter()
        .filter(|e| e.full_url.as_deref() == Some(wanted.as_str()))
        .collect();
    release(&state, &claims, only, "Observation").await
}

//! The OPD card: the patient's identity under the hospital's own letterhead
//! and, when printed for a visit, its date, department, doctor and token.
//!
//! Two routes, one card. Registration prints it for the patient; the OPD queue
//! prints it for a visit. Neither reads a clinical field.

use axum::routing::get;
use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, FixedOffset, Months, NaiveDate, Utc};
use serde_json::json;
use sqlx::PgConnection;
use uuid::Uuid;

use medbrains_core::clinical_events::{ClinicalEventEnvelope, ClinicalEventName};
use medbrains_core::permissions;
use medbrains_core::print_data::{OpdCardPrintData, OpdCardVisit};
use medbrains_health_services::patient::require_patient_access;
use medbrains_kernel::{Actor, require_permission};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;

/// GET /api/print-data/opd-card/{patient_id}
///
/// The card as registration hands it over, before or without a visit.
pub async fn get_opd_card_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<OpdCardPrintData>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    require_patient_access(&state, &claims, patient_id).await?;
    print_card(&state, &claims, CardFor::Patient(patient_id))
        .await
        .map(Json)
}

/// GET /api/print-data/opd-visit-card/{encounter_id}
///
/// The card for one OPD visit: the patient's identity plus its token. The
/// visit names the patient, and the patient's gate decides, as on the other
/// route: the card is the patient's identity, not the encounter's chart.
pub async fn get_opd_visit_card_print_data(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(encounter_id): Path<Uuid>,
) -> Result<Json<OpdCardPrintData>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    print_card(&state, &claims, CardFor::Visit(encounter_id))
        .await
        .map(Json)
}

/// Which record the card is printed against.
#[derive(Clone, Copy)]
enum CardFor {
    Patient(Uuid),
    Visit(Uuid),
}

/// Reads the card in one transaction and records that it was printed.
///
/// On the visit route the visit is read first, because it names the patient
/// whose gate then decides; nothing is returned before it has.
async fn print_card(
    state: &AppState,
    claims: &Claims,
    card_for: CardFor,
) -> Result<OpdCardPrintData, AppError> {
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(claims)).await?;
    let tz = crate::set_print_timezone(&mut tx, &claims.tenant_id).await?;

    let (patient_id, visit) = match card_for {
        CardFor::Patient(id) => (id, None),
        CardFor::Visit(encounter_id) => {
            let row = visit_row(&mut tx, claims.tenant_id, encounter_id).await?;
            require_patient_access(state, claims, row.patient_id).await?;
            (row.patient_id, Some(row))
        }
    };
    let hospital = hospital_row(&mut tx, claims.tenant_id).await?;
    let patient = patient_row(&mut tx, claims.tenant_id, patient_id).await?;
    let encounter_id = match card_for {
        CardFor::Visit(id) => Some(id),
        CardFor::Patient(_) => None,
    };
    queue_printed(&mut tx, claims, patient_id, encounter_id).await?;
    tx.commit().await?;

    let today = Utc::now().with_timezone(&tz).date_naive();
    Ok(OpdCardPrintData {
        hospital_name: hospital.name,
        hospital_logo_url: hospital.logo_url,
        hospital_address: hospital.address,
        hospital_phone: hospital.phone,
        hospital_registration_no: hospital.registration_no,
        patient_name: patient.patient_name,
        uhid: patient.uhid,
        age: patient.date_of_birth.map(|dob| age_label(dob, today)),
        gender: patient.gender,
        phone: patient.phone,
        address: patient.address,
        registered_on: patient
            .created_at
            .with_timezone(&tz)
            .format("%d-%b-%Y")
            .to_string(),
        visit: visit.map(|row| visit_of(row, tz)),
    })
}

/// The hospital's letterhead, from its own profile.
struct HospitalRow {
    name: String,
    logo_url: Option<String>,
    address: Option<String>,
    phone: Option<String>,
    registration_no: Option<String>,
}

/// Name, address and registration from `tenants`; the logo from the branding
/// setting, which is where onboarding and the admin screen save it.
/// `tenants.logo_url` is read only as a fallback: nothing in the app writes it.
async fn hospital_row(conn: &mut PgConnection, tenant_id: Uuid) -> Result<HospitalRow, AppError> {
    sqlx::query_as!(
        HospitalRow,
        "SELECT t.name, \
           COALESCE(NULLIF(btrim(s.value #>> '{}'), ''), t.logo_url) AS logo_url, \
           NULLIF(concat_ws(', ', NULLIF(btrim(t.address_line1), ''), \
             NULLIF(btrim(t.address_line2), ''), NULLIF(btrim(t.city), ''), gs.name, \
             NULLIF(btrim(t.pincode), '')), '') AS address, \
           NULLIF(btrim(t.phone), '') AS phone, \
           NULLIF(btrim(t.registration_no), '') AS registration_no \
         FROM tenants t \
         LEFT JOIN geo_states gs ON gs.id = t.state_id \
         LEFT JOIN tenant_settings s ON s.tenant_id = t.id AND s.category = 'branding' \
           AND s.key = 'logo_url' AND s.deleted_at IS NULL \
         WHERE t.id = $1 AND t.deleted_at IS NULL",
        tenant_id,
    )
    .fetch_optional(conn)
    .await?
    .ok_or(AppError::NotFound)
}

/// The patient's identity: what the desk lookup already shows.
struct PatientRow {
    patient_name: String,
    uhid: String,
    date_of_birth: Option<NaiveDate>,
    gender: String,
    phone: String,
    address: Option<String>,
    created_at: DateTime<Utc>,
}

/// One patient, or `NotFound` when the patient is not this tenant's or is deleted.
async fn patient_row(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<PatientRow, AppError> {
    sqlx::query_as!(
        PatientRow,
        "SELECT concat_ws(' ', p.first_name, NULLIF(btrim(p.middle_name), ''), p.last_name) \
             AS \"patient_name!\", \
           p.uhid, p.date_of_birth, p.gender::text AS \"gender!\", p.phone, \
           NULLIF(concat_ws(', ', NULLIF(btrim(p.address->>'line1'), ''), \
             NULLIF(btrim(p.address->>'city'), '')), '') AS address, \
           p.created_at \
         FROM patients p \
         WHERE p.id = $1 AND p.tenant_id = $2 AND p.deleted_at IS NULL",
        patient_id,
        tenant_id,
    )
    .fetch_optional(conn)
    .await?
    .ok_or(AppError::NotFound)
}

/// One OPD visit as the card prints it.
struct VisitRow {
    patient_id: Uuid,
    created_at: DateTime<Utc>,
    department: Option<String>,
    doctor: Option<String>,
    token_number: Option<String>,
    is_repeat: bool,
    follow_up_date: Option<NaiveDate>,
}

/// The visit, its department and doctor, and the token the board calls.
///
/// The token is the unified `tokens` row the board reads; the clinic's own
/// `opd_queues` counter is the fallback for visits from before it existed.
/// "Repeat" means an earlier OPD visit at this hospital.
async fn visit_row(
    conn: &mut PgConnection,
    tenant_id: Uuid,
    encounter_id: Uuid,
) -> Result<VisitRow, AppError> {
    sqlx::query_as!(
        VisitRow,
        "SELECT e.patient_id, e.created_at, d.name AS \"department?\", \
           doc.full_name AS \"doctor?\", \
           COALESCE(tok.number, q.token_number::text) AS token_number, \
           EXISTS (SELECT 1 FROM encounters prev \
             WHERE prev.tenant_id = e.tenant_id AND prev.patient_id = e.patient_id \
               AND prev.encounter_type = 'opd' AND prev.deleted_at IS NULL \
               AND prev.id <> e.id AND prev.created_at < e.created_at) AS \"is_repeat!\", \
           e.follow_up_date \
         FROM encounters e \
         LEFT JOIN departments d ON d.id = e.department_id AND d.tenant_id = e.tenant_id \
         LEFT JOIN users doc ON doc.id = e.doctor_id AND doc.tenant_id = e.tenant_id \
         LEFT JOIN LATERAL (SELECT t.number FROM tokens t \
           WHERE t.tenant_id = e.tenant_id AND t.module = 'opd' \
             AND t.entity_type = 'encounter' AND t.entity_id = e.id \
           ORDER BY t.created_at LIMIT 1) tok ON true \
         LEFT JOIN LATERAL (SELECT oq.token_number FROM opd_queues oq \
           WHERE oq.tenant_id = e.tenant_id AND oq.encounter_id = e.id \
             AND oq.deleted_at IS NULL \
           ORDER BY oq.created_at LIMIT 1) q ON true \
         WHERE e.id = $1 AND e.tenant_id = $2 AND e.encounter_type = 'opd' \
           AND e.deleted_at IS NULL",
        encounter_id,
        tenant_id,
    )
    .fetch_optional(conn)
    .await?
    .ok_or(AppError::NotFound)
}

/// The visit block, its times in the hospital's zone.
fn visit_of(row: VisitRow, tz: FixedOffset) -> OpdCardVisit {
    let at = row.created_at.with_timezone(&tz);
    OpdCardVisit {
        visit_date: at.format("%d-%b-%Y").to_string(),
        visit_time: at.format("%H:%M").to_string(),
        department: row.department,
        doctor: row.doctor,
        token_number: row.token_number,
        is_repeat: row.is_repeat,
        follow_up_date: row.follow_up_date.map(|d| d.format("%d-%b-%Y").to_string()),
    }
}

/// Age as an OPD card writes it: years, or months for an infant, or days
/// for a newborn. Whole units, rounded down, as a birthday counts them.
fn age_label(dob: NaiveDate, today: NaiveDate) -> String {
    if let Some(years) = today.years_since(dob).filter(|y| *y > 0) {
        return format!("{years} Y");
    }
    // Under a year: at most eleven whole months to try.
    let months = (1..12).rev().find(|m| {
        dob.checked_add_months(Months::new(*m))
            .is_some_and(|d| d <= today)
    });
    months.map_or_else(
        || format!("{} D", (today - dob).num_days().max(0)),
        |m| format!("{m} M"),
    )
}

/// Records the print on the clinical event stream, the same event the
/// registration card raises, so the patient's access history shows it.
async fn queue_printed(
    conn: &mut PgConnection,
    claims: &Claims,
    patient_id: Uuid,
    encounter_id: Option<Uuid>,
) -> Result<(), AppError> {
    let print_request_id = Uuid::new_v4();
    let event = ClinicalEventEnvelope::new(
        claims.tenant_id,
        ClinicalEventName::PatientCardPrinted,
        print_request_id,
        claims.sub,
        json!({
            "patient_id": patient_id,
            "encounter_id": encounter_id,
            "print_request_id": print_request_id,
            "artifact": "opd_card",
        }),
    )
    .with_patient(patient_id);
    let row = medbrains_workflow::events::clinical_event_outbox_row(&event)?;
    medbrains_outbox::queue::queue_on(conn, row)
        .await
        .map_err(|e| AppError::Internal(format!("clinical event outbox queue failed: {e}")))?;
    Ok(())
}

/// OPD card print-data routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/print-data/opd-card/{patient_id}",
            get(get_opd_card_print_data),
        )
        .route(
            "/api/print-data/opd-visit-card/{encounter_id}",
            get(get_opd_visit_card_print_data),
        )
}

#[cfg(test)]
mod tests {
    use super::age_label;
    use chrono::NaiveDate;

    fn day(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap_or_default()
    }

    #[test]
    fn age_counts_whole_years_then_months_then_days() {
        let today = day(2026, 11, 17);
        assert_eq!(age_label(day(1990, 11, 17), today), "36 Y");
        assert_eq!(age_label(day(1990, 11, 18), today), "35 Y");
        assert_eq!(age_label(day(2026, 4, 30), today), "6 M");
        assert_eq!(age_label(day(2026, 11, 5), today), "12 D");
        assert_eq!(age_label(day(2026, 10, 18), today), "30 D");
    }
}

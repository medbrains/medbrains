//! A patient's own record as one FHIR R4 `Bundle` (type `collection`): who
//! they are, every visit, and every released lab result — the answer to a
//! DPDP access request (Act s.11) in the format other hospitals and ABDM
//! read. Results follow the portal's rule exactly: verified, and none still
//! carrying an unacknowledged critical value, so the export never shows a
//! patient more than their Results screen does.

use chrono::{DateTime, Utc};
use medbrains_fhir::mapper::{
    EncounterView, ObservationView, PatientView, encounter_to_fhir, observation_to_fhir,
    patient_to_fhir,
};
use medbrains_fhir::r4::Resource;
use medbrains_fhir::r4::bundle::{Bundle, BundleEntry, BundleType};
use medbrains_server_core::error::AppError;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Bounds on what one export carries; a lifetime record fits well inside.
const MAX_ENCOUNTERS: i64 = 2_000;
const MAX_RESULTS: i64 = 10_000;

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

#[derive(sqlx::FromRow)]
struct EncounterRow {
    id: Uuid,
    patient_id: Uuid,
    patient_display: Option<String>,
    doctor_id: Option<Uuid>,
    doctor_display: Option<String>,
    encounter_type: String,
    status: String,
    started_at: DateTime<Utc>,
    ended_at: Option<DateTime<Utc>>,
}

#[derive(sqlx::FromRow)]
struct ResultRow {
    id: Uuid,
    encounter_id: Option<Uuid>,
    code: String,
    display: String,
    effective_at: DateTime<Utc>,
    value: String,
    unit: Option<String>,
    flag: Option<String>,
}

/// The HL7 v3 ObservationInterpretation code for a result flag; normal has none.
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

/// The patient's record as a FHIR collection bundle.
pub async fn patient_export(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Bundle, AppError> {
    let p = sqlx::query_as::<_, PatientRow>(
        "SELECT id, uhid, abha_id, prefix, first_name, middle_name, last_name, \
                gender::text AS gender, date_of_birth, phone, email, is_active \
           FROM patients WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let display = format!("{} {}", p.first_name, p.last_name);
    let patient = PatientView {
        id: p.id,
        uhid: p.uhid,
        abha_id: p.abha_id,
        prefix: p.prefix,
        first_name: p.first_name,
        middle_name: p.middle_name,
        last_name: p.last_name,
        gender: p.gender,
        date_of_birth: p.date_of_birth,
        phone: p.phone,
        email: p.email,
        is_active: p.is_active,
    };
    let mut entry = vec![BundleEntry {
        full_url: Some(format!("Patient/{patient_id}")),
        resource: Resource::Patient(patient_to_fhir(&patient)),
    }];

    let encounters = sqlx::query_as::<_, EncounterRow>(
        "SELECT e.id, e.patient_id, $3::text AS patient_display, e.doctor_id, \
                u.full_name AS doctor_display, e.encounter_type::text AS encounter_type, \
                e.status::text AS status, e.created_at AS started_at, \
                CASE WHEN e.status::text IN ('closed','completed','discharged') \
                     THEN e.updated_at END AS ended_at \
           FROM encounters e LEFT JOIN users u ON u.id = e.doctor_id \
          WHERE e.patient_id = $1 AND e.tenant_id = $2 AND e.deleted_at IS NULL \
          ORDER BY e.created_at DESC LIMIT $4",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .bind(&display)
    .bind(MAX_ENCOUNTERS)
    .fetch_all(&mut **tx)
    .await?;
    entry.extend(encounters.into_iter().map(|r| {
        let id = r.id;
        BundleEntry {
            full_url: Some(format!("Encounter/{id}")),
            resource: Resource::Encounter(encounter_to_fhir(&EncounterView {
                id: r.id,
                patient_id: r.patient_id,
                patient_display: r.patient_display,
                doctor_id: r.doctor_id,
                doctor_display: r.doctor_display,
                encounter_type: r.encounter_type,
                status: r.status,
                started_at: r.started_at,
                ended_at: r.ended_at,
            })),
        }
    }));

    let results = sqlx::query_as::<_, ResultRow>(
        "SELECT r.id, lo.encounter_id, COALESCE(NULLIF(t.loinc_code, ''), r.parameter_name) AS code, \
                CASE WHEN r.parameter_name = t.name THEN t.name \
                     ELSE t.name || ' — ' || r.parameter_name END AS display, \
                COALESCE(lo.verified_at, r.created_at) AS effective_at, r.value, r.unit, \
                r.flag::text AS flag \
           FROM lab_results r \
           JOIN lab_orders lo ON lo.id = r.order_id AND lo.tenant_id = r.tenant_id \
           JOIN lab_test_catalog t ON t.id = lo.test_id \
          WHERE r.tenant_id = $1 AND lo.patient_id = $2 AND lo.verified_at IS NOT NULL \
            AND r.deleted_at IS NULL AND lo.deleted_at IS NULL \
            AND NOT EXISTS (SELECT 1 FROM lab_critical_alerts a \
                 WHERE a.tenant_id = r.tenant_id AND a.result_id = r.id AND a.acknowledged_at IS NULL) \
          ORDER BY effective_at DESC LIMIT $3",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(MAX_RESULTS)
    .fetch_all(&mut **tx)
    .await?;
    entry.extend(results.into_iter().map(|r| {
        let id = r.id;
        BundleEntry {
            full_url: Some(format!("Observation/{id}")),
            resource: Resource::Observation(observation_to_fhir(&ObservationView {
                id: r.id,
                patient_id,
                encounter_id: r.encounter_id,
                code: r.code,
                display: r.display,
                category: "laboratory".to_owned(),
                effective_at: r.effective_at,
                value_numeric: r.value.trim().parse().ok(),
                unit: r.unit,
                value_string: Some(r.value),
                status: "final".to_owned(),
                abnormal_flag: r
                    .flag
                    .as_deref()
                    .and_then(interpretation)
                    .map(str::to_owned),
            })),
        }
    }));

    Ok(Bundle {
        id: Uuid::new_v4().to_string(),
        meta: None,
        r#type: BundleType::Collection,
        timestamp: Utc::now().to_rfc3339(),
        total: None,
        entry,
    })
}

#[cfg(test)]
mod tests {
    use super::interpretation;

    #[test]
    fn result_flags_become_hl7_interpretation_codes() {
        assert_eq!(interpretation("critical_high"), Some("HH"));
        assert_eq!(interpretation("low"), Some("L"));
        assert_eq!(interpretation("normal"), None);
    }
}

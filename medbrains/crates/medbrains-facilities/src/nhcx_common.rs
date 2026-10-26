//! What every outbound NHCX message shares: the onboarding and payer
//! checks that refuse a message before it is queued, the parties a bundle
//! names (patient, policy, hospital, doctor), and queueing the outbox event.

use chrono::NaiveDate;
use serde_json::{Value, json};
use sqlx::FromRow;
use uuid::Uuid;

use medbrains_core::nhcx::{NhcxOperation, NhcxRecord};
use medbrains_fhir::nrces::Party;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;

use crate::nhcx_bundle::DiagnosisLine;

pub(crate) type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// The payer's HCX participant code, trimmed and required.
pub(crate) fn required_recipient(code: &str) -> Result<&str, AppError> {
    let code = code.trim();
    if code.is_empty() {
        return Err(AppError::BadRequest(
            "recipient_code (payer HCX id) is required".to_owned(),
        ));
    }
    Ok(code)
}

/// Refuse to queue anything for NHCX until this hospital holds an NHCX
/// participant code. Without it nothing can be sent — and a request accepted
/// here that never reaches the payer is worse than one the desk knows to file
/// on the payer's portal.
pub(crate) async fn require_nhcx_onboarded(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
) -> Result<(), AppError> {
    let code: Option<String> =
        sqlx::query_scalar("SELECT abdm_hcx_sender_code FROM tenants WHERE id = $1")
            .bind(tenant_id)
            .fetch_one(&mut **tx)
            .await?;
    if code.as_deref().is_none_or(|c| c.trim().is_empty()) {
        return Err(AppError::ServiceUnavailable(
            "NHCX is not set up for this hospital yet — file this on the payer's portal for now"
                .to_owned(),
        ));
    }
    Ok(())
}

/// Refuse a payer the handler could not encrypt for — before anything is queued.
pub(crate) async fn require_payer_certificate(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    recipient: &str,
) -> Result<(), AppError> {
    let has_cert: Option<bool> = sqlx::query_scalar(
        "SELECT COALESCE(btrim(encryption_cert), '') <> '' FROM nhcx_participants \
         WHERE tenant_id = $1 AND participant_code = $2 AND is_active",
    )
    .bind(tenant_id)
    .bind(recipient)
    .fetch_optional(&mut **tx)
    .await?;
    match has_cert {
        Some(true) => Ok(()),
        Some(false) => Err(AppError::BadRequest(format!(
            "payer {recipient} has no encryption certificate — add it in the NHCX payer directory"
        ))),
        None => Err(AppError::BadRequest(format!(
            "payer {recipient} is not in the NHCX payer directory"
        ))),
    }
}

/// One outbound message, ready to queue.
pub(crate) struct Outbound<'a> {
    pub(crate) record: NhcxRecord,
    pub(crate) record_id: Uuid,
    pub(crate) operation: NhcxOperation,
    pub(crate) recipient: &'a str,
    /// On a request, the same as `api_call_id` (NHCX: the initiator seeds
    /// the thread from its own call id); on a reply, the payer's.
    pub(crate) correlation_id: Uuid,
    pub(crate) api_call_id: Uuid,
    /// The step code (`x-hcx-workflow_id`), where the message has one.
    pub(crate) workflow_id: Option<&'a str>,
    pub(crate) payload: &'a Value,
}

/// Queue the outbox event, in the caller's transaction — the same one that
/// records the exchange ids on the record, so a callback can never arrive
/// for a record that does not know its correlation id.
///
/// A message that breaks its NRCeS profile is refused here, with every rule
/// it breaks, and the whole transaction rolls back: the payer would refuse
/// it anyway, later and less clearly, and the desk would see only "sent".
pub(crate) async fn queue(
    tx: &mut Tx<'_>,
    claims: &Claims,
    msg: &Outbound<'_>,
) -> Result<Value, AppError> {
    let broken = medbrains_fhir::nrces::conformance::nhcx_violations(msg.payload);
    if !broken.is_empty() {
        tracing::warn!(rules = ?broken, "nhcx: message refused before sending, not NRCeS-conformant");
        return Err(AppError::BadRequest(format!(
            "This cannot go to NHCX yet — the message is missing what the payer requires: {}",
            broken.join("; ")
        )));
    }
    let event_id = medbrains_outbox::queue_in_tx(
        tx,
        medbrains_outbox::queue::OutboxRow {
            tenant_id: claims.tenant_id,
            aggregate_type: msg.record.table(),
            aggregate_id: Some(msg.record_id),
            event_type: msg.operation.event_type(),
            payload: json!({
                "record": msg.record,
                "record_id": msg.record_id,
                "recipient_code": msg.recipient,
                "correlation_id": msg.correlation_id,
                "api_call_id": msg.api_call_id,
                "workflow_id": msg.workflow_id,
                "bundle": msg.payload,
            }),
            idempotency_key: None,
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("nhcx queue failed: {e}")))?;
    Ok(json!({
        "record_id": msg.record_id,
        "queued": true,
        "correlation_id": msg.correlation_id,
        "outbox_event_id": event_id,
    }))
}

#[derive(Debug, FromRow)]
pub(crate) struct PatientParty {
    pub(crate) id: Uuid,
    pub(crate) uhid: String,
    pub(crate) first_name: String,
    pub(crate) last_name: String,
    pub(crate) gender: String,
    pub(crate) date_of_birth: Option<NaiveDate>,
    /// Only an ABHA verified against ABDM is sent to a payer.
    pub(crate) abha_number: Option<String>,
}

pub(crate) async fn load_patient(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<PatientParty, AppError> {
    sqlx::query_as::<_, PatientParty>(
        "SELECT p.id, p.uhid, p.first_name, p.last_name, p.gender::text AS gender, p.date_of_birth, \
                (SELECT l.abha_number FROM patient_abha_links l \
                  WHERE l.patient_id = p.id AND l.tenant_id = p.tenant_id \
                    AND l.verified_at IS NOT NULL AND l.status = 'linked' AND l.deleted_at IS NULL \
                  ORDER BY l.verified_at DESC LIMIT 1) AS abha_number \
         FROM patients p WHERE p.id = $1 AND p.tenant_id = $2",
    )
    .bind(patient_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// The policy the Coverage resource is built from.
#[derive(Debug, Default, FromRow)]
pub(crate) struct PolicyParty {
    pub(crate) insurance_provider: String,
    pub(crate) policy_number: Option<String>,
    pub(crate) member_id: Option<String>,
    pub(crate) plan_name: Option<String>,
    pub(crate) policy_holder_relation: Option<String>,
    pub(crate) valid_from: Option<NaiveDate>,
    pub(crate) valid_until: Option<NaiveDate>,
}

#[derive(Debug, FromRow)]
struct PolicyRow {
    id: Uuid,
    #[sqlx(flatten)]
    policy: PolicyParty,
}

/// The patient's policy — the one named, else their first active one.
pub(crate) async fn load_policy(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    patient_id: Uuid,
    policy_id: Option<Uuid>,
) -> Result<Option<(Uuid, PolicyParty)>, AppError> {
    let row = sqlx::query_as::<_, PolicyRow>(
        "SELECT id, insurance_provider, policy_number, member_id, plan_name, \
                policy_holder_relation, valid_from, valid_until \
         FROM patient_insurance \
         WHERE tenant_id = $1 AND patient_id = $2 AND deleted_at IS NULL \
           AND ($3::uuid IS NULL OR id = $3) AND ($3::uuid IS NOT NULL OR is_active) \
         ORDER BY priority, valid_until DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(policy_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row.map(|r| (r.id, r.policy)))
}

/// The hospital as NHCX knows it: the campus registered with HFR (the main
/// campus first).
#[derive(Debug, FromRow)]
pub(crate) struct ProviderParty {
    /// The facility's id, or the tenant's when no campus is registered.
    pub(crate) id: Uuid,
    pub(crate) name: String,
    pub(crate) hfr_facility_id: Option<String>,
}

// ponytail: always the main HFR campus; pick the encounter's campus once
// encounters carry a facility.
pub(crate) async fn load_provider(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
) -> Result<ProviderParty, AppError> {
    let facility = sqlx::query_as::<_, ProviderParty>(
        "SELECT id, name, hfr_facility_id FROM facilities \
         WHERE tenant_id = $1 AND deleted_at IS NULL AND hfr_facility_id IS NOT NULL \
         ORDER BY (parent_id IS NULL) DESC, (facility_type = 'main_hospital') DESC, created_at \
         LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    if let Some(f) = facility {
        return Ok(f);
    }
    let name: String = sqlx::query_scalar("SELECT name FROM tenants WHERE id = $1")
        .bind(tenant_id)
        .fetch_one(&mut **tx)
        .await?;
    Ok(ProviderParty {
        id: tenant_id,
        name,
        hfr_facility_id: None,
    })
}

/// A staff member as a bundle names them: name, and HPR id when known.
pub(crate) async fn load_doctor(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    user_id: Option<Uuid>,
) -> Result<Option<Party>, AppError> {
    let Some(user_id) = user_id else {
        return Ok(None);
    };
    let row: Option<(Uuid, String, Option<String>)> = sqlx::query_as(
        "SELECT u.id, COALESCE(d.display_name, u.full_name), d.hpr_id \
         FROM users u LEFT JOIN doctor_profiles d \
           ON d.user_id = u.id AND d.tenant_id = u.tenant_id AND d.deleted_at IS NULL \
         WHERE u.id = $1 AND u.tenant_id = $2",
    )
    .bind(user_id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    Ok(row.map(|(id, name, registry_id)| Party {
        id,
        name,
        registry_id,
    }))
}

const DIAGNOSIS_COLUMNS: &str = "d.icd_code, d.icd_system::text AS icd_system, d.description, \
     d.snomed_code, d.is_primary";

/// The coded diagnoses of an encounter, principal first.
pub(crate) async fn encounter_diagnoses(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    encounter_id: Option<Uuid>,
) -> Result<Vec<DiagnosisLine>, AppError> {
    let sql = format!(
        "SELECT {DIAGNOSIS_COLUMNS} FROM diagnoses d \
         WHERE d.encounter_id = $1 AND d.tenant_id = $2 AND d.deleted_at IS NULL \
         ORDER BY d.is_primary DESC, d.created_at LIMIT 50"
    );
    Ok(sqlx::query_as::<_, DiagnosisLine>(&sql)
        .bind(encounter_id)
        .bind(tenant_id)
        .fetch_all(&mut **tx)
        .await?)
}

/// The coded diagnoses of an admission's encounter.
pub(crate) async fn admission_diagnoses(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    admission_id: Option<Uuid>,
) -> Result<Vec<DiagnosisLine>, AppError> {
    let encounter: Option<Uuid> =
        sqlx::query_scalar("SELECT encounter_id FROM admissions WHERE id = $1 AND tenant_id = $2")
            .bind(admission_id)
            .bind(tenant_id)
            .fetch_optional(&mut **tx)
            .await?;
    encounter_diagnoses(tx, tenant_id, encounter).await
}

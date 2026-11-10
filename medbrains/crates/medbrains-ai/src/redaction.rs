//! The assistant's side of the redaction door (`medbrains_core::ai_redact`).
//!
//! One [`Session`] per assistant turn: the patient's own identifiers, the
//! clinician's name, and the conversation's stored placeholder map. Every text
//! for the model — preamble, message, history, every tool result — goes
//! through it; every text for the user — streamed answer, tool chips — comes
//! back re-hydrated through it. Fail closed: a tool result that cannot be made
//! safe is withheld from the model, never sent as it was.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use std::sync::{Arc, Mutex};

use medbrains_core::ai_redact::{Kind, KnownIdentifiers, PseudonymMap, Redacted, Redactor};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::state::AppState;
use uuid::Uuid;

/// The redaction session shared by a turn's tools and its stream.
pub(super) type Session = Arc<Mutex<Redactor>>;

/// Told to the model instead of a tool result that could not be made safe.
const WITHHELD: &str = "WITHHELD — this result could not be made safe to share with the AI, so \
    it was not sent. Tell the user you could not use it; do not guess its contents.";

/// A tool result as the model may see it.
pub(super) fn for_model(session: &Session, text: &str) -> Redacted {
    let Ok(mut redactor) = session.lock() else {
        return Redacted::fixed(WITHHELD);
    };
    redactor.redact(text).unwrap_or_else(|e| {
        tracing::error!(target: "ai", error = %e, "tool result withheld from the model");
        Redacted::fixed(WITHHELD)
    })
}

/// Model text as the authorised user may see it.
pub(super) fn for_user(session: &Session, text: &str) -> String {
    session
        .lock()
        .map_or_else(|_| text.to_owned(), |r| r.rehydrate(text))
}

/// A snapshot of the map, to persist with the conversation.
pub(super) fn map_of(session: &Session) -> Option<serde_json::Value> {
    let redactor = session.lock().ok()?;
    serde_json::to_value(redactor.map()).ok()
}

#[derive(sqlx::FromRow)]
struct PatientIds {
    first_name: Option<String>,
    middle_name: Option<String>,
    last_name: Option<String>,
    full_name_local: Option<String>,
    temporary_name: Option<String>,
    father_name: Option<String>,
    mother_name: Option<String>,
    spouse_name: Option<String>,
    guardian_name: Option<String>,
    emergency_contact_name: Option<String>,
    emergency_contact_phone: Option<String>,
    phone: Option<String>,
    phone_secondary: Option<String>,
    email: Option<String>,
    uhid: Option<String>,
    abha_id: Option<String>,
    abha_number: Option<String>,
    abha_address: Option<String>,
    address_line1: Option<String>,
    birth_place: Option<String>,
}

#[derive(sqlx::FromRow)]
struct ContactIds {
    contact_name: Option<String>,
    phone: Option<String>,
    phone_alt: Option<String>,
    email: Option<String>,
}

#[derive(sqlx::FromRow)]
struct AddressIds {
    address_line1: Option<String>,
    address_line2: Option<String>,
    postal_code: Option<String>,
}

/// The identifiers known to be in scope for this turn: the patient's own
/// record (names, relatives, contacts, numbers, addresses) and the
/// clinician's name. Loaded for redaction only — none of it is sent anywhere.
/// A failure here refuses the AI call (fail closed), it does not skip.
///
/// # Errors
/// The record could not be read.
async fn known_identifiers(
    state: &AppState,
    claims: &Claims,
    patient_id: Option<Uuid>,
) -> Result<KnownIdentifiers, AppError> {
    let mut known = KnownIdentifiers::default();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let me: Option<String> = sqlx::query_scalar("SELECT full_name FROM users WHERE id = $1")
        .bind(claims.sub)
        .fetch_optional(&mut *tx)
        .await?;
    known.add(Kind::Staff, me.as_deref());
    if let Some(pid) = patient_id {
        add_patient(&mut tx, claims.tenant_id, pid, &mut known).await?;
    }
    tx.commit().await?;
    Ok(known)
}

async fn add_patient(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    pid: Uuid,
    known: &mut KnownIdentifiers,
) -> Result<(), AppError> {
    let p = sqlx::query_as::<_, PatientIds>(
        "SELECT first_name, middle_name, last_name, full_name_local, temporary_name, \
                father_name, mother_name, spouse_name, guardian_name, emergency_contact_name, \
                emergency_contact_phone, phone, phone_secondary, email, uhid, abha_id, \
                abha_number, abha_address, address_line1, birth_place \
         FROM patients WHERE id = $1 AND tenant_id = $2",
    )
    .bind(pid)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;
    if let Some(p) = p {
        let full = [&p.first_name, &p.middle_name, &p.last_name]
            .iter()
            .filter_map(|s| s.as_deref())
            .collect::<Vec<_>>()
            .join(" ");
        known.add(Kind::Patient, Some(full.as_str()));
        for v in [&p.full_name_local, &p.temporary_name] {
            known.add(Kind::Patient, v.as_deref());
        }
        for v in [
            &p.father_name,
            &p.mother_name,
            &p.spouse_name,
            &p.guardian_name,
            &p.emergency_contact_name,
        ] {
            known.add(Kind::Relative, v.as_deref());
        }
        for v in [&p.phone, &p.phone_secondary, &p.emergency_contact_phone] {
            known.add(Kind::Phone, v.as_deref());
        }
        known.add(Kind::Email, p.email.as_deref());
        known.add(Kind::Uhid, p.uhid.as_deref());
        known.add(Kind::Abha, p.abha_number.as_deref());
        known.add(Kind::Abha, p.abha_id.as_deref());
        known.add(Kind::AbhaAddress, p.abha_address.as_deref());
        known.add(Kind::Address, p.address_line1.as_deref());
        known.add(Kind::Address, p.birth_place.as_deref());
    }
    let contacts = sqlx::query_as::<_, ContactIds>(
        "SELECT contact_name, phone, phone_alt, email FROM patient_contacts \
         WHERE patient_id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 20",
    )
    .bind(pid)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    for c in &contacts {
        known.add(Kind::Relative, c.contact_name.as_deref());
        known.add(Kind::Phone, c.phone.as_deref());
        known.add(Kind::Phone, c.phone_alt.as_deref());
        known.add(Kind::Email, c.email.as_deref());
    }
    let addresses = sqlx::query_as::<_, AddressIds>(
        "SELECT address_line1, address_line2, postal_code FROM patient_addresses \
         WHERE patient_id = $1 AND tenant_id = $2 AND deleted_at IS NULL LIMIT 10",
    )
    .bind(pid)
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    for a in &addresses {
        known.add(Kind::Address, a.address_line1.as_deref());
        known.add(Kind::Address, a.address_line2.as_deref());
        known.add(Kind::Pincode, a.postal_code.as_deref());
    }
    Ok(())
}

/// A redaction session for one assistant turn.
///
/// It is about `patient_id` and continues `stored` (the conversation's map).
/// The patient's identifiers are loaded whether or not the caller may see the
/// chart — they are only used to strip them.
///
/// # Errors
/// The identifiers could not be loaded: the AI call must be refused.
pub async fn session_for(
    state: &AppState,
    claims: &Claims,
    patient_id: Option<Uuid>,
    stored: Option<serde_json::Value>,
) -> Result<Redactor, AppError> {
    let known = known_identifiers(state, claims, patient_id).await?;
    Ok(Redactor::new(
        map_from(stored),
        &known,
        chrono::Utc::now().date_naive(),
    ))
}

/// A conversation's stored map, or a fresh one.
pub(super) fn map_from(value: Option<serde_json::Value>) -> PseudonymMap {
    value
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

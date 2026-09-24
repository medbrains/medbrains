#![allow(clippy::needless_pass_by_value)]

//! React Native bridge for the Loro CRDT engine.
//!
//! Phase 12 of the hybrid roadmap. Same Rust core that powers the
//! `medbrains-edge` server now compiles for iOS (staticlib) and
//! Android (cdylib) so the mobile + TV apps run the *same* CRDT
//! conflict-resolution code as web — no JS-side reimplementation
//! that could drift.
//!
//! `UniFFI` generates Kotlin, Swift, and TypeScript bindings from
//! `edge_rn.udl`. The TS binding is consumed by React Native via
//! `uniffi-bindgen-react-native` (deferred to the mobile-app PR).
//!
//! Phase B (the current PR) extends the surface with offline auth +
//! permissions: `verify_jwt`, `is_action_offline_required`,
//! `AuthzCacheHandle`, `RevocationCacheHandle`. All of these route
//! into `medbrains-offline-core` so the same logic the edge server
//! uses now runs on every device.
//!
//! What this crate explicitly does NOT do:
//! - WebSocket transport (handled by the existing JS layer; the
//!   Rust core stays transport-free)
//! - Per-doc persistence to disk (the mobile app picks a storage
//!   location — defaults to RN's documents directory — and feeds
//!   bytes in/out via `apply_update` / `export_since`)

use std::fmt;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, UNIX_EPOCH};
use thiserror::Error;
use uuid::Uuid;

use medbrains_offline_core as offline;

use medbrains_clinical_core as clinical;

uniffi::include_scaffolding!("edge_rn");

#[derive(Debug, Error)]
pub enum BridgeError {
    #[error("doc not found")]
    DocNotFound,

    #[error("invalid update")]
    InvalidUpdate,

    #[error("invalid version vector")]
    InvalidVersionVector,

    #[error("loro: {0}")]
    Loro(String),

    #[error("serde: {0}")]
    Serde(String),

    #[error("bad verifying key: {0}")]
    BadVerifyingKey(String),

    #[error("authz cache: {0}")]
    AuthzCache(String),

    #[error("revocation cache: {0}")]
    RevocationCache(String),

    #[error("invalid uuid: {0}")]
    InvalidUuid(String),

    #[error("invalid node key: {0}")]
    InvalidNodeKey(String),
}

impl From<loro::LoroError> for BridgeError {
    fn from(value: loro::LoroError) -> Self {
        Self::Loro(value.to_string())
    }
}

impl From<loro::LoroEncodeError> for BridgeError {
    fn from(value: loro::LoroEncodeError) -> Self {
        Self::Loro(format!("encode: {value}"))
    }
}

impl From<serde_json::Error> for BridgeError {
    fn from(value: serde_json::Error) -> Self {
        Self::Serde(value.to_string())
    }
}

#[derive(Debug, Clone)]
pub struct AppendItem {
    pub json_value: String,
}

#[derive(Debug, Clone)]
pub struct TextSnapshot {
    pub text: String,
    pub version_vector: Vec<u8>,
}

/// Opaque handle the mobile/TV app holds for the lifetime of a
/// document mount. `UniFFI` requires interface impls to be `Send +
/// Sync`; `LoroDoc` itself is `Send` but not `Sync`, so we wrap in
/// `Mutex`. Doc updates are short — measured in microseconds at the
/// CRDT layer — so contention is fine.
pub struct DocHandle {
    inner: Arc<Mutex<loro::LoroDoc>>,
    doc_id: String,
}

impl fmt::Debug for DocHandle {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("DocHandle")
            .field("doc_id", &self.doc_id)
            .finish_non_exhaustive()
    }
}

impl DocHandle {
    pub fn new(doc_id: String) -> Result<Self, BridgeError> {
        Ok(Self {
            inner: Arc::new(Mutex::new(loro::LoroDoc::new())),
            doc_id,
        })
    }

    pub fn doc_id(&self) -> String {
        self.doc_id.clone()
    }

    pub fn apply_update(&self, update_bytes: Vec<u8>) -> Result<Vec<u8>, BridgeError> {
        let doc = self
            .inner
            .lock()
            .map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        doc.import(&update_bytes)?;
        Ok(doc.oplog_vv().encode())
    }

    pub fn export_since(&self, their_vv: Vec<u8>) -> Result<Vec<u8>, BridgeError> {
        let vv = loro::VersionVector::decode(&their_vv)
            .map_err(|_| BridgeError::InvalidVersionVector)?;
        let doc = self
            .inner
            .lock()
            .map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        Ok(doc.export(loro::ExportMode::updates(&vv))?)
    }

    pub fn version_vector(&self) -> Result<Vec<u8>, BridgeError> {
        let doc = self
            .inner
            .lock()
            .map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        Ok(doc.oplog_vv().encode())
    }

    /// Append a JSON-encoded item to a Loro list container, matching
    /// the wire format the web hook expects.
    pub fn append_to_list(
        &self,
        container_name: String,
        item: AppendItem,
    ) -> Result<Vec<u8>, BridgeError> {
        let value: serde_json::Value = serde_json::from_str(&item.json_value)?;
        let doc = self
            .inner
            .lock()
            .map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        let list = doc.get_list(container_name);
        list.push(loro::LoroValue::String(
            serde_json::to_string(&value)?.into(),
        ))?;
        let vv_before = doc.oplog_vv();
        Ok(doc.export(loro::ExportMode::updates(&vv_before))?)
    }

    pub fn list_entries(&self, container_name: String) -> Result<Vec<String>, BridgeError> {
        let doc = self
            .inner
            .lock()
            .map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        let list = doc.get_list(container_name);
        let mut out = Vec::with_capacity(list.len());
        for i in 0..list.len() {
            if let Some(v) = list.get(i) {
                if let Some(s) = value_or_container_as_string(&v) {
                    out.push(s);
                }
            }
        }
        Ok(out)
    }

    /// Replace the text container's contents with `new_text`. Loro's
    /// text container handles diff/merge internally.
    pub fn set_text(
        &self,
        container_name: String,
        new_text: String,
    ) -> Result<Vec<u8>, BridgeError> {
        let doc = self
            .inner
            .lock()
            .map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        let text = doc.get_text(container_name);
        text.update(&new_text, loro::UpdateOptions::default())
            .map_err(|e| BridgeError::Loro(format!("text update: {e}")))?;
        let vv_before = doc.oplog_vv();
        Ok(doc.export(loro::ExportMode::updates(&vv_before))?)
    }

    pub fn read_text(&self, container_name: String) -> Result<TextSnapshot, BridgeError> {
        let doc = self
            .inner
            .lock()
            .map_err(|_| BridgeError::Loro("lock poisoned".into()))?;
        let text = doc.get_text(container_name);
        Ok(TextSnapshot {
            text: text.to_string(),
            version_vector: doc.oplog_vv().encode(),
        })
    }
}

fn value_or_container_as_string(v: &loro::ValueOrContainer) -> Option<String> {
    match v {
        loro::ValueOrContainer::Value(loro::LoroValue::String(s)) => Some(s.to_string()),
        _ => None,
    }
}

// ── Phase B: JWT verify ────────────────────────────────────────────

/// Wire-compatible mirror of `medbrains_offline_core::JwtClaims`.
/// `UniFFI` requires owned `String`s for UUIDs (no Uuid type bridge).
#[derive(Debug, Clone)]
pub struct JwtClaims {
    pub sub: String,
    pub tenant_id: String,
    pub iat: i64,
    pub exp: i64,
    pub department_ids: Vec<String>,
    pub permissions: Vec<String>,
    pub role: Option<String>,
}

impl From<offline::JwtClaims> for JwtClaims {
    fn from(c: offline::JwtClaims) -> Self {
        Self {
            sub: c.sub.to_string(),
            tenant_id: c.tenant_id.to_string(),
            iat: c.iat,
            exp: c.exp,
            department_ids: c
                .department_ids
                .into_iter()
                .map(|u| u.to_string())
                .collect(),
            permissions: c.permissions,
            role: c.role,
        }
    }
}

/// UniFFI-friendly mirror of `medbrains_offline_core::JwtOutcome`.
///
/// We re-shape Valid(claims) → variant-with-data + the timing failure
/// modes as separate variants so callers can branch with Swift / Kotlin
/// pattern-match natively.
#[derive(Debug, Clone)]
pub enum JwtOutcome {
    Valid { claims: JwtClaims },
    Expired,
    NotYetValid,
    InvalidSignature,
    Malformed { reason: String },
}

impl From<offline::JwtOutcome> for JwtOutcome {
    fn from(o: offline::JwtOutcome) -> Self {
        match o {
            offline::JwtOutcome::Valid(c) => Self::Valid { claims: c.into() },
            offline::JwtOutcome::Expired => Self::Expired,
            offline::JwtOutcome::NotYetValid => Self::NotYetValid,
            offline::JwtOutcome::InvalidSignature => Self::InvalidSignature,
            offline::JwtOutcome::Malformed(r) => Self::Malformed { reason: r },
        }
    }
}

/// Top-level `namespace edge_rn` function. Delegates to
/// `medbrains_offline_core::verify_jwt`.
pub fn verify_jwt(
    token: String,
    public_key_bytes: Vec<u8>,
    now_unix: i64,
    clock_skew_secs: u64,
) -> JwtOutcome {
    let Ok(key_array) = <[u8; 32]>::try_from(public_key_bytes.as_slice()) else {
        return JwtOutcome::Malformed {
            reason: format!(
                "public key must be 32 bytes, got {}",
                public_key_bytes.len()
            ),
        };
    };
    let key = match offline::VerifyingKey::from_bytes(key_array) {
        Ok(k) => k,
        Err(e) => {
            return JwtOutcome::Malformed {
                reason: format!("verifying key: {e}"),
            }
        }
    };
    let now = if now_unix < 0 {
        UNIX_EPOCH
    } else {
        UNIX_EPOCH + Duration::from_secs(now_unix as u64)
    };
    offline::verify_jwt(&token, &key, now, Duration::from_secs(clock_skew_secs)).into()
}

/// Top-level `namespace edge_rn` function. Cheap helper —
/// short-circuits `AuthzCache` check on the host side.
pub fn is_action_offline_required(object_type: String, action: String) -> bool {
    offline::ONLINE_REQUIRED_ACTIONS
        .iter()
        .any(|(t, a)| *t == object_type && *a == action)
}

// ── Bedside decisions ──────────────────────────────────────────────
// Thin FFI faces over `medbrains-clinical-core`; the logic and its tests
// live there so the Swift and Kotlin apps share one answer.

#[derive(Debug, Clone)]
pub struct WitnessCandidate {
    pub nurse_user_id: String,
    pub nurse_name: String,
    pub is_charge: bool,
}

impl From<WitnessCandidate> for clinical::bcma::WitnessCandidate {
    fn from(w: WitnessCandidate) -> Self {
        Self { nurse_user_id: w.nurse_user_id, nurse_name: w.nurse_name, is_charge: w.is_charge }
    }
}

impl From<clinical::bcma::WitnessCandidate> for WitnessCandidate {
    fn from(w: clinical::bcma::WitnessCandidate) -> Self {
        Self { nurse_user_id: w.nurse_user_id, nurse_name: w.nurse_name, is_charge: w.is_charge }
    }
}

pub fn bcma_eligible_witnesses(on_duty: Vec<WitnessCandidate>, actor_id: String) -> Vec<WitnessCandidate> {
    clinical::bcma::eligible_witnesses(on_duty.into_iter().map(Into::into).collect(), &actor_id)
        .into_iter()
        .map(Into::into)
        .collect()
}

pub fn bcma_can_record_given(is_high_alert: bool, witness_id: Option<String>) -> bool {
    clinical::bcma::can_record_given(is_high_alert, witness_id.as_deref())
}

pub fn bcma_scan_rights_summary(right_patient: bool, right_drug: bool) -> String {
    clinical::bcma::scan_rights_summary(right_patient, right_drug)
}

#[derive(Debug, Clone)]
pub struct TransfusionPhaseState {
    pub phase: String,
    pub recorded: bool,
    pub overdue: bool,
}

pub fn transfusion_phase_states(
    started_unix: Option<i64>,
    ended: bool,
    recorded_phases: Vec<String>,
    now_unix: i64,
) -> Vec<TransfusionPhaseState> {
    clinical::transfusion::phase_states(started_unix, ended, &recorded_phases, now_unix)
        .into_iter()
        .map(|p| TransfusionPhaseState { phase: p.phase, recorded: p.recorded, overdue: p.overdue })
        .collect()
}

pub fn transfusion_is_running(started_unix: Option<i64>, ended: bool) -> bool {
    clinical::transfusion::is_running(started_unix, ended)
}

#[allow(clippy::too_many_arguments, clippy::fn_params_excessive_bools)]
pub fn transfusion_can_start(
    bag_number: String,
    blood_group: String,
    product_type: String,
    expiry_date: String,
    consent_on_file: bool,
    crossmatch_compatible: bool,
    second_nurse_id: Option<String>,
) -> bool {
    clinical::transfusion::can_start_transfusion(
        &bag_number,
        &blood_group,
        &product_type,
        &expiry_date,
        consent_on_file,
        crossmatch_compatible,
        second_nurse_id.as_deref(),
    )
}

pub fn nurse_call_wait_label(waiting_seconds: i64) -> String {
    clinical::nurse_calls::wait_label(waiting_seconds)
}

pub fn nurse_call_is_open(status: String) -> bool {
    clinical::nurse_calls::is_open_nurse_call(&status)
}

pub fn nurse_call_is_overdue(escalation: String) -> bool {
    clinical::nurse_calls::is_overdue_nurse_call(&escalation)
}

pub fn fall_risk_morse_level(score: i64) -> String {
    clinical::fall_risk::morse_level(score).to_owned()
}

#[derive(Debug, Clone)]
pub struct CodeBlueRef {
    pub id: String,
    pub location: String,
}

#[derive(Debug, Clone)]
pub struct EmergencyCodeRef {
    pub id: String,
    pub code_type: String,
    pub location: Option<String>,
}

#[derive(Debug, Clone)]
pub struct OpenEmergencyCode {
    pub key: String,
    pub label: String,
    pub code_type: String,
    pub location: String,
    pub code_blue_id: Option<String>,
}

pub fn emergency_open_codes(
    code_blues: Vec<CodeBlueRef>,
    er_codes: Vec<EmergencyCodeRef>,
    silenced_keys: Vec<String>,
) -> Vec<OpenEmergencyCode> {
    let cbs: Vec<clinical::emergency::CodeBlueRef> = code_blues
        .into_iter()
        .map(|c| clinical::emergency::CodeBlueRef { id: c.id, location: c.location })
        .collect();
    let ers: Vec<clinical::emergency::EmergencyCodeRef> = er_codes
        .into_iter()
        .map(|e| clinical::emergency::EmergencyCodeRef { id: e.id, code_type: e.code_type, location: e.location })
        .collect();
    clinical::emergency::open_codes(&cbs, &ers, &silenced_keys)
        .into_iter()
        .map(|c| OpenEmergencyCode {
            key: c.key,
            label: c.label,
            code_type: c.code_type,
            location: c.location,
            code_blue_id: c.code_blue_id,
        })
        .collect()
}

#[derive(Debug, Clone)]
pub struct TapOutcome {
    pub taps_ms: Vec<i64>,
    pub triple: bool,
}

pub fn emergency_register_tap(taps_ms: Vec<i64>, now_ms: i64) -> TapOutcome {
    let out = clinical::emergency::register_tap(&taps_ms, now_ms);
    TapOutcome { taps_ms: out.taps, triple: out.triple }
}

pub fn clinic_order(start_times: Vec<Option<String>>) -> Vec<u32> {
    clinical::clinic_day::clinic_order(&start_times)
}

pub fn clinic_next_patient(start_times: Vec<Option<String>>, statuses: Vec<String>) -> Option<u32> {
    clinical::clinic_day::next_patient(&start_times, &statuses)
}

pub fn clinic_remaining_count(statuses: Vec<String>) -> u32 {
    clinical::clinic_day::remaining_count(&statuses)
}

pub fn clinic_is_still_to_come(status: String) -> bool {
    clinical::clinic_day::is_still_to_come(&status)
}

pub fn consultation_problem(chief_complaint: String, examination: String, assessment: String, plan: String) -> Option<String> {
    clinical::consultation::consultation_problem(&chief_complaint, &examination, &assessment, &plan)
}

/// What the desk typed, as the registration rules see it (UDL record).
#[derive(Debug, Clone)]
pub struct RegistrationDraft {
    pub first_name: String,
    pub last_name: String,
    pub phone: String,
    pub date_of_birth: String,
    pub age_years: Option<u32>,
    pub is_medico_legal: bool,
    pub mlc_number: String,
    pub abha_number: String,
}

impl From<RegistrationDraft> for clinical::registration::RegistrationDraft {
    fn from(d: RegistrationDraft) -> Self {
        Self {
            first_name: d.first_name,
            last_name: d.last_name,
            phone: d.phone,
            date_of_birth: d.date_of_birth,
            age_years: d.age_years,
            is_medico_legal: d.is_medico_legal,
            mlc_number: d.mlc_number,
            abha_number: d.abha_number,
        }
    }
}

/// A refusal on one registration field, in the desk's words (UDL record).
#[derive(Debug, Clone)]
pub struct RegistrationProblem {
    pub field: String,
    pub message: String,
}

impl From<clinical::registration::RegistrationProblem> for RegistrationProblem {
    fn from(p: clinical::registration::RegistrationProblem) -> Self {
        Self { field: p.field, message: p.message }
    }
}

pub fn registration_action(check_unavailable: bool, matches: u32) -> String {
    clinical::registration::registration_action(check_unavailable, matches).to_owned()
}

pub fn registration_carries_over(field: String) -> bool {
    clinical::registration::registration_carries_over(&field)
}

pub fn registration_problem(draft: RegistrationDraft) -> Option<RegistrationProblem> {
    clinical::registration::registration_problem(&draft.into()).map(Into::into)
}

pub fn estimated_date_of_birth(age_years: u32, today_year: i32) -> String {
    clinical::registration::estimated_date_of_birth(age_years, today_year)
}

pub fn appointment_actions(status: String, is_today: bool) -> Vec<String> {
    clinical::appointment::appointment_actions(&status, is_today).into_iter().map(str::to_owned).collect()
}

pub fn slot_is_bookable(date: String, start_time: String, today: String, now_time: String, is_available: bool) -> bool {
    clinical::appointment::slot_is_bookable(&date, &start_time, &today, &now_time, is_available)
}

pub fn pass_state(status: String, valid_until: String, now: String) -> String {
    clinical::visitors::pass_state(&status, &valid_until, &now).to_owned()
}

pub fn pass_is_inside(state: String, checked_out: bool) -> bool {
    clinical::visitors::pass_is_inside(&state, checked_out)
}

pub fn pass_actions(state: String, inside: bool) -> Vec<String> {
    clinical::visitors::pass_actions(&state, inside).into_iter().map(str::to_owned).collect()
}

pub fn companion_access(licensed_by_hospital: Option<bool>, band_paired: Option<bool>, purchased: Option<bool>) -> Option<String> {
    clinical::companion::companion_access(licensed_by_hospital, band_paired, purchased).map(str::to_owned)
}

pub fn band_state(last_synced_unix: Option<i64>, now_unix: i64) -> String {
    clinical::companion::band_state(last_synced_unix, now_unix).to_owned()
}

pub fn describe_band_state(state: String) -> String {
    clinical::companion::describe_band_state(&state).to_owned()
}

#[derive(Debug, Clone)]
pub struct MedicationPlan {
    pub id: String,
    pub name: String,
    pub instructions: String,
    pub times: Vec<String>,
    pub started_on: String,
    pub ends_on: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AdherenceEvent {
    pub plan_id: String,
    pub scheduled_for: String,
    pub status: String,
}

#[derive(Debug, Clone)]
pub struct DoseSlot {
    pub plan_id: String,
    pub name: String,
    pub instructions: String,
    pub time: String,
    pub scheduled_for: String,
    pub status: String,
}

#[derive(Debug, Clone)]
pub struct DailyBrief {
    pub slots: Vec<DoseSlot>,
    pub adherence_percent: Option<u32>,
    pub streak_days: u32,
    pub confidence: String,
    pub verdict: String,
}

pub fn daily_brief(medications: Vec<MedicationPlan>, adherence: Vec<AdherenceEvent>, observation_days: Vec<String>, now_unix: i64) -> DailyBrief {
    let meds: Vec<clinical::companion::MedicationPlan> = medications
        .into_iter()
        .map(|m| clinical::companion::MedicationPlan { id: m.id, name: m.name, instructions: m.instructions, times: m.times, started_on: m.started_on, ends_on: m.ends_on })
        .collect();
    let events: Vec<clinical::companion::AdherenceEvent> = adherence
        .into_iter()
        .map(|a| clinical::companion::AdherenceEvent { plan_id: a.plan_id, scheduled_for: a.scheduled_for, status: a.status })
        .collect();
    let b = clinical::companion::daily_brief(&meds, &events, &observation_days, now_unix);
    DailyBrief {
        slots: b.slots.into_iter().map(|s| DoseSlot { plan_id: s.plan_id, name: s.name, instructions: s.instructions, time: s.time, scheduled_for: s.scheduled_for, status: s.status }).collect(),
        adherence_percent: b.adherence_percent,
        streak_days: b.streak_days,
        confidence: b.confidence,
        verdict: b.verdict,
    }
}

// ── Peer-to-peer sync identity ─────────────────────────────────────

/// A device's peer-to-peer sync identity.
///
/// Split deliberately: the secret never leaves the device, and the
/// node id is meant to be read aloud. Keeping them in one struct
/// makes it obvious which half is which at the call site.
#[derive(Debug, Clone)]
pub struct NodeIdentity {
    /// Hex-encoded private key. Secure storage only.
    pub secret_hex: String,
    /// The public node id, exactly as a peer sees it on the wire.
    pub node_id: String,
}

/// Create this device's sync identity.
///
/// Generated here rather than issued by the server, because a key the
/// server has seen is a key the server could impersonate the device
/// with. The device makes its own and shows only the public half.
///
/// The caller MUST store `secret_hex` in platform secure storage —
/// Keychain or Keystore — and never in `AsyncStorage` or a log.
/// Anyone holding it can be this device.
pub fn generate_node_identity() -> Result<NodeIdentity, BridgeError> {
    let mut bytes = [0u8; 32];
    // Fails loudly. A device whose OS could not give 32 random bytes
    // must not end up holding a predictable key — it would pair
    // normally and be impersonable for the rest of its life.
    getrandom::fill(&mut bytes)
        .map_err(|e| BridgeError::InvalidNodeKey(format!("no secure randomness: {e}")))?;
    let secret = iroh_base::SecretKey::from_bytes(&bytes);
    Ok(NodeIdentity {
        secret_hex: hex::encode(secret.to_bytes()),
        node_id: secret.public().to_string(),
    })
}

/// Recover the node id from a stored secret.
///
/// Derived rather than stored alongside, so a device cannot end up
/// presenting a node id that does not match the key it will dial with
/// — which would look to an administrator like a correctly bound
/// device that silently never connects.
pub fn node_id_for_secret(secret_hex: String) -> Result<String, BridgeError> {
    let raw = hex::decode(secret_hex.trim())
        .map_err(|e| BridgeError::InvalidNodeKey(format!("not hex: {e}")))?;
    let bytes: [u8; 32] = raw
        .as_slice()
        .try_into()
        .map_err(|_| BridgeError::InvalidNodeKey(format!("expected 32 bytes, got {}", raw.len())))?;
    Ok(iroh_base::SecretKey::from_bytes(&bytes).public().to_string())
}

// ── Phase B: AuthzCache handle ─────────────────────────────────────

#[derive(Debug, Clone)]
pub struct CacheKey {
    pub tenant_id: String,
    pub user_id: String,
    pub object_type: String,
    pub object_id: String,
    pub action: String,
}

impl CacheKey {
    fn try_into_offline(self) -> Result<offline::CacheKey, BridgeError> {
        Ok(offline::CacheKey {
            tenant_id: parse_uuid(&self.tenant_id, "tenant_id")?,
            user_id: parse_uuid(&self.user_id, "user_id")?,
            object_type: self.object_type,
            object_id: self.object_id,
            action: self.action,
        })
    }
}

#[derive(Debug, Clone)]
pub enum CacheSourceKind {
    CloudFresh,
    CloudCached,
    JwtFallback,
    OnlineRequiredDeny,
}

impl From<CacheSourceKind> for offline::CacheSource {
    fn from(s: CacheSourceKind) -> Self {
        match s {
            CacheSourceKind::CloudFresh => Self::CloudFresh,
            CacheSourceKind::CloudCached => Self::CloudCached,
            CacheSourceKind::JwtFallback => Self::JwtFallback,
            CacheSourceKind::OnlineRequiredDeny => Self::OnlineRequiredDeny,
        }
    }
}

impl From<offline::CacheSource> for CacheSourceKind {
    fn from(s: offline::CacheSource) -> Self {
        match s {
            offline::CacheSource::CloudFresh => Self::CloudFresh,
            offline::CacheSource::CloudCached => Self::CloudCached,
            offline::CacheSource::JwtFallback => Self::JwtFallback,
            offline::CacheSource::OnlineRequiredDeny => Self::OnlineRequiredDeny,
        }
    }
}

#[derive(Debug, Clone)]
pub enum DenyReasonKind {
    CacheMissStrict,
    JwtLacksPermission,
    OnlineRequired,
    Expired,
}

impl From<offline::DenyReason> for DenyReasonKind {
    fn from(r: offline::DenyReason) -> Self {
        match r {
            offline::DenyReason::CacheMissStrict => Self::CacheMissStrict,
            offline::DenyReason::JwtLacksPermission => Self::JwtLacksPermission,
            offline::DenyReason::OnlineRequired => Self::OnlineRequired,
            offline::DenyReason::Expired => Self::Expired,
        }
    }
}

#[derive(Debug, Clone)]
pub enum CheckOutcome {
    Allow { source: CacheSourceKind },
    Deny { reason: DenyReasonKind },
}

impl From<offline::CheckOutcome> for CheckOutcome {
    fn from(o: offline::CheckOutcome) -> Self {
        match o {
            offline::CheckOutcome::Allow { source } => Self::Allow {
                source: source.into(),
            },
            offline::CheckOutcome::Deny { reason } => Self::Deny {
                reason: reason.into(),
            },
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum OfflinePolicyKind {
    CacheOnly,
    CacheThenJwt,
    OnlineRequired,
}

impl From<OfflinePolicyKind> for offline::OfflinePolicy {
    fn from(p: OfflinePolicyKind) -> Self {
        match p {
            OfflinePolicyKind::CacheOnly => Self::CacheOnly,
            OfflinePolicyKind::CacheThenJwt => Self::CacheThenJwt,
            OfflinePolicyKind::OnlineRequired => Self::OnlineRequired,
        }
    }
}

pub struct AuthzCacheHandle {
    inner: offline::AuthzCache,
}

impl fmt::Debug for AuthzCacheHandle {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AuthzCacheHandle").finish_non_exhaustive()
    }
}

impl AuthzCacheHandle {
    pub fn new(path: String, capacity: u32, default_ttl_secs: u64) -> Result<Self, BridgeError> {
        let p = PathBuf::from(path);
        let inner =
            offline::AuthzCache::new(&p, capacity as usize, Duration::from_secs(default_ttl_secs))
                .map_err(|e| BridgeError::AuthzCache(e.to_string()))?;
        Ok(Self { inner })
    }

    pub fn check_offline(
        &self,
        key: CacheKey,
        jwt_permissions: Vec<String>,
        policy: OfflinePolicyKind,
    ) -> Result<CheckOutcome, BridgeError> {
        let k = key.try_into_offline()?;
        Ok(self
            .inner
            .check_offline(&k, &jwt_permissions, policy.into())
            .into())
    }

    pub fn record(
        &self,
        key: CacheKey,
        allowed: bool,
        source: CacheSourceKind,
    ) -> Result<(), BridgeError> {
        let k = key.try_into_offline()?;
        self.inner.record(k, allowed, source.into());
        Ok(())
    }

    pub fn invalidate(&self, keys: Vec<CacheKey>) -> Result<(), BridgeError> {
        let parsed: Result<Vec<_>, _> = keys.into_iter().map(CacheKey::try_into_offline).collect();
        self.inner.invalidate(&parsed?);
        Ok(())
    }
}

// ── Phase B: RevocationCache handle ────────────────────────────────

pub struct RevocationCacheHandle {
    inner: offline::RevocationCache,
}

impl fmt::Debug for RevocationCacheHandle {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("RevocationCacheHandle")
            .finish_non_exhaustive()
    }
}

impl RevocationCacheHandle {
    pub fn new(path: String, capacity: u32) -> Result<Self, BridgeError> {
        let p = PathBuf::from(path);
        let inner = offline::RevocationCache::new(&p, capacity as usize)
            .map_err(|e| BridgeError::RevocationCache(e.to_string()))?;
        Ok(Self { inner })
    }

    pub fn record_revocation(
        &self,
        user_id: String,
        revoked_at_unix: i64,
    ) -> Result<(), BridgeError> {
        let uid = parse_uuid(&user_id, "user_id")?;
        self.inner
            .record_revocation(uid, revoked_at_unix)
            .map_err(|e| BridgeError::RevocationCache(e.to_string()))
    }

    pub fn is_revoked(&self, user_id: String, jwt_iat_unix: i64) -> Result<bool, BridgeError> {
        let uid = parse_uuid(&user_id, "user_id")?;
        Ok(self.inner.is_revoked(uid, jwt_iat_unix))
    }

    pub fn pull_window_max(&self) -> i64 {
        self.inner.pull_window_max()
    }

    pub fn forget(&self, user_id: String) -> Result<(), BridgeError> {
        let uid = parse_uuid(&user_id, "user_id")?;
        self.inner
            .forget(uid)
            .map_err(|e| BridgeError::RevocationCache(e.to_string()))
    }

    pub fn len(&self) -> u32 {
        self.inner.len() as u32
    }

    pub fn is_empty(&self) -> bool {
        self.inner.len() == 0
    }
}

fn parse_uuid(s: &str, field: &str) -> Result<Uuid, BridgeError> {
    Uuid::parse_str(s).map_err(|e| BridgeError::InvalidUuid(format!("{field}: {e}")))
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::*;

    #[test]
    fn doc_handle_carries_id() {
        let h = DocHandle::new("vitals:abc".into()).unwrap();
        assert_eq!(h.doc_id(), "vitals:abc");
    }

    #[test]
    fn append_then_list_roundtrip() {
        let h = DocHandle::new("notes:xyz".into()).unwrap();
        h.append_to_list(
            "entries".into(),
            AppendItem {
                json_value: r#"{"note":"first"}"#.to_owned(),
            },
        )
        .unwrap();
        h.append_to_list(
            "entries".into(),
            AppendItem {
                json_value: r#"{"note":"second"}"#.to_owned(),
            },
        )
        .unwrap();
        let entries = h.list_entries("entries".into()).unwrap();
        assert_eq!(entries.len(), 2);
        assert!(entries[0].contains("first"));
        assert!(entries[1].contains("second"));
    }

    #[test]
    fn text_set_then_read() {
        let h = DocHandle::new("doc:1".into()).unwrap();
        h.set_text("body".into(), "hello".into()).unwrap();
        let snap = h.read_text("body".into()).unwrap();
        assert_eq!(snap.text, "hello");
        assert!(!snap.version_vector.is_empty());
    }

    #[test]
    fn export_apply_roundtrip_between_handles() {
        // Two devices simulated by two DocHandles. The update from
        // A applies cleanly into B and vice versa — the merge is
        // commutative which is the whole point of CRDTs.
        let a = DocHandle::new("shared".into()).unwrap();
        let b = DocHandle::new("shared".into()).unwrap();

        a.append_to_list(
            "log".into(),
            AppendItem {
                json_value: r#"{"v":1}"#.to_owned(),
            },
        )
        .unwrap();
        let empty_vv = loro::VersionVector::default().encode();
        let a_to_b = a.export_since(empty_vv.clone()).unwrap();
        b.apply_update(a_to_b).unwrap();

        b.append_to_list(
            "log".into(),
            AppendItem {
                json_value: r#"{"v":2}"#.to_owned(),
            },
        )
        .unwrap();
        let b_to_a = b.export_since(empty_vv).unwrap();
        a.apply_update(b_to_a).unwrap();

        let final_a = a.list_entries("log".into()).unwrap();
        let final_b = b.list_entries("log".into()).unwrap();
        assert_eq!(final_a.len(), 2);
        assert_eq!(final_b.len(), 2);
        // Same membership — order is implementation-defined for
        // append-only lists during merge but membership is invariant.
        let mut sorted_a = final_a.clone();
        sorted_a.sort();
        let mut sorted_b = final_b.clone();
        sorted_b.sort();
        assert_eq!(sorted_a, sorted_b);
    }

    #[test]
    fn version_vector_advances_on_write() {
        let h = DocHandle::new("doc".into()).unwrap();
        let vv0 = h.version_vector().unwrap();
        h.append_to_list(
            "log".into(),
            AppendItem {
                json_value: "true".into(),
            },
        )
        .unwrap();
        let vv1 = h.version_vector().unwrap();
        assert_ne!(vv0, vv1, "VV must advance after a write");
    }

    #[test]
    fn invalid_version_vector_returns_typed_error() {
        let h = DocHandle::new("doc".into()).unwrap();
        let err = h.export_since(vec![0xff, 0xfe, 0xfd]).unwrap_err();
        assert!(matches!(err, BridgeError::InvalidVersionVector));
    }

    // ── Phase B tests ──────────────────────────────────────────────

    #[test]
    fn is_action_offline_required_matches_core_list() {
        // Anchor on the entries the offline-core crate maintains.
        // If the core list grows, this test still passes — it only
        // verifies the bridge call routes correctly.
        assert!(super::is_action_offline_required(
            "prescription".into(),
            "sign".into()
        ));
        assert!(super::is_action_offline_required(
            "narcotic".into(),
            "dispense".into()
        ));
        assert!(!super::is_action_offline_required(
            "vitals".into(),
            "create".into()
        ));
    }

    #[test]
    fn verify_jwt_short_key_returns_malformed() {
        let outcome = super::verify_jwt(
            "a.b.c".into(),
            vec![0u8; 10], // wrong length
            1_700_000_000,
            300,
        );
        match outcome {
            JwtOutcome::Malformed { reason } => assert!(reason.contains("32 bytes")),
            other => panic!("expected Malformed, got {other:?}"),
        }
    }

    #[test]
    fn verify_jwt_malformed_token() {
        let outcome = super::verify_jwt(
            "not-a-jwt".into(),
            vec![
                0xd7, 0x5a, 0x98, 0x01, 0x82, 0xb1, 0x0a, 0xb7, 0xd5, 0x4b, 0xfe, 0xd3, 0xc9, 0x64,
                0x07, 0x3a, 0x0e, 0xe1, 0x72, 0xf3, 0xda, 0xa6, 0x23, 0x25, 0xaf, 0x02, 0x1a, 0x68,
                0xf7, 0x07, 0x51, 0x1a,
            ],
            1_700_000_000,
            300,
        );
        assert!(matches!(outcome, JwtOutcome::Malformed { .. }));
    }

    #[test]
    fn revocation_cache_round_trip() {
        let dir = tempfile::TempDir::new().unwrap();
        let cache =
            RevocationCacheHandle::new(dir.path().to_string_lossy().into_owned(), 64).unwrap();
        let user = Uuid::new_v4().to_string();
        cache
            .record_revocation(user.clone(), 1_700_000_000)
            .unwrap();
        assert!(cache.is_revoked(user.clone(), 1_699_000_000).unwrap());
        assert!(!cache.is_revoked(user.clone(), 1_700_000_001).unwrap());
        assert_eq!(cache.pull_window_max(), 1_700_000_000);
        cache.forget(user.clone()).unwrap();
        assert!(!cache.is_revoked(user, 1_699_000_000).unwrap());
    }

    #[test]
    fn revocation_cache_rejects_bad_uuid() {
        let dir = tempfile::TempDir::new().unwrap();
        let cache =
            RevocationCacheHandle::new(dir.path().to_string_lossy().into_owned(), 16).unwrap();
        let err = cache
            .record_revocation("not-a-uuid".into(), 1_700_000_000)
            .unwrap_err();
        assert!(matches!(err, BridgeError::InvalidUuid(_)));
    }

    #[test]
    fn authz_cache_check_returns_outcome() {
        let dir = tempfile::TempDir::new().unwrap();
        let cache =
            AuthzCacheHandle::new(dir.path().to_string_lossy().into_owned(), 64, 300).unwrap();
        let key = CacheKey {
            tenant_id: Uuid::new_v4().to_string(),
            user_id: Uuid::new_v4().to_string(),
            object_type: "vitals".into(),
            object_id: "abc".into(),
            action: "create".into(),
        };
        let outcome = cache
            .check_offline(key, vec![], OfflinePolicyKind::CacheOnly)
            .unwrap();
        // Empty cache, CacheOnly policy → Deny(CacheMissStrict)
        match outcome {
            CheckOutcome::Deny {
                reason: DenyReasonKind::CacheMissStrict,
            } => {}
            other => panic!("expected Deny(CacheMissStrict), got {other:?}"),
        }
    }

    /// The whole point of deriving rather than storing: what the
    /// device shows an administrator must be what it later dials
    /// with. If these drift, the binding looks correct and the device
    /// silently never connects.
    #[test]
    fn a_stored_secret_recovers_the_same_node_id() {
        let identity = generate_node_identity().expect("generate");
        let recovered = node_id_for_secret(identity.secret_hex.clone()).expect("recover");
        assert_eq!(recovered, identity.node_id);
    }

    #[test]
    fn two_devices_do_not_share_an_identity() {
        let a = generate_node_identity().expect("a");
        let b = generate_node_identity().expect("b");
        assert_ne!(a.secret_hex, b.secret_hex);
        assert_ne!(a.node_id, b.node_id);
    }

    /// A device offering a node id that is not 32 bytes of key is a
    /// device with a corrupted or half-written secret. Deriving
    /// something from it anyway would produce an id nobody can dial.
    #[test]
    fn a_malformed_secret_is_refused_rather_than_coerced() {
        for bad in ["", "not-hex", "abcd"] {
            assert!(
                matches!(
                    node_id_for_secret(bad.to_owned()),
                    Err(BridgeError::InvalidNodeKey(_))
                ),
                "{bad:?} must be refused"
            );
        }
    }

    /// Surrounding whitespace comes free with copy-paste and secure
    /// storage round-trips; it should not cost a device its identity.
    #[test]
    fn a_secret_survives_stray_whitespace() {
        let identity = generate_node_identity().expect("generate");
        let padded = format!("  {}\n", identity.secret_hex);
        assert_eq!(node_id_for_secret(padded).expect("recover"), identity.node_id);
    }
}

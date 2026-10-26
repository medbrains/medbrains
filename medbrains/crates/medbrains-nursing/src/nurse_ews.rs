//! The early-warning score charted with every vitals reading.
//!
//! When a nurse charts vitals (web or the native bedside apps — both post to
//! `/api/nurse/vitals`), the reading is scored with the tool that fits the
//! patient (`medbrains_clinical_scores::ews`), the score is stored on the
//! reading, the next full set is due by the hospital's frequency for that
//! band, and a score in an escalating band opens an escalation: the people
//! responsible for the patient are told, and it waits for someone to
//! acknowledge it with what they did.
//!
//! All of it happens in the transaction that wrote the reading: a reading is
//! never stored without its score.

use chrono::{DateTime, Duration, Utc};
use medbrains_clinical_scores::ews::{
    self, Band, Consciousness, Distress, EwsPolicy, EwsScore, Observation, OxygenDevice,
    PatientKind, Tool,
};
use medbrains_notifications::NewNotification;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::error::AppError;

type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// tenant_settings ('ews', 'policy').
pub const POLICY_CATEGORY: &str = "ews";
pub const POLICY_KEY: &str = "policy";

/// The parameters a score needs beyond the classic vitals.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct ScoringInputs {
    pub consciousness: Option<Consciousness>,
    pub oxygen_device: Option<OxygenDevice>,
    pub oxygen_flow_lpm: Option<Decimal>,
    pub fio2_percent: Option<i32>,
    pub capillary_refill_seconds: Option<Decimal>,
    pub respiratory_distress: Option<Distress>,
}

/// Tenths, exactly: the vitals columns hold one decimal place.
fn tenths(d: Option<Decimal>) -> Option<i32> {
    d.and_then(|v| (v.round_dp(1) * Decimal::TEN).to_i32())
}

/// The classic vitals of a reading.
#[derive(Debug, Clone, Copy, Default)]
pub struct Vitals {
    pub temperature: Option<Decimal>,
    pub pulse: Option<i32>,
    pub systolic_bp: Option<i32>,
    pub diastolic_bp: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub spo2: Option<i32>,
}

#[must_use]
pub fn observation(v: &Vitals, s: &ScoringInputs) -> Observation {
    Observation {
        respiratory_rate: v.respiratory_rate,
        spo2: v.spo2,
        temperature_tenths: tenths(v.temperature),
        systolic_bp: v.systolic_bp,
        diastolic_bp: v.diastolic_bp,
        pulse: v.pulse,
        consciousness: s.consciousness,
        oxygen_device: s.oxygen_device,
        oxygen_flow_tenths: tenths(s.oxygen_flow_lpm),
        fio2_percent: s.fio2_percent,
        capillary_refill_tenths: tenths(s.capillary_refill_seconds),
        respiratory_distress: s.respiratory_distress,
    }
}

/// Everything about the patient a score depends on, in one query.
#[derive(Debug, sqlx::FromRow)]
pub struct Context {
    pub patient_id: Uuid,
    pub age_months: Option<i32>,
    pub obstetric: bool,
    pub spo2_scale2: Option<bool>,
    pub tool_override: Option<String>,
    pub admission_id: Option<Uuid>,
    pub ward_id: Option<Uuid>,
    pub department_id: Option<Uuid>,
    pub primary_nurse_id: Option<Uuid>,
    pub doctor_id: Option<Uuid>,
    pub patient_label: String,
}

/// Pregnant: an active maternity registration not yet delivered and not
/// more than eight weeks past its EDD. Post-partum: delivered in the last
/// 42 days (the WHO puerperium).
const CONTEXT_SQL: &str = "SELECT p.id AS patient_id, \
        CASE WHEN p.date_of_birth IS NULL THEN NULL ELSE \
          (EXTRACT(YEAR FROM age(now(), p.date_of_birth)) * 12 \
           + EXTRACT(MONTH FROM age(now(), p.date_of_birth)))::int END AS age_months, \
        (EXISTS (SELECT 1 FROM maternity_registrations mr \
                  WHERE mr.patient_id = p.id AND mr.tenant_id = e.tenant_id \
                    AND mr.deleted_at IS NULL AND mr.status = 'active' \
                    AND mr.edd_date > CURRENT_DATE - 56 \
                    AND NOT EXISTS (SELECT 1 FROM labor_records lr \
                                     WHERE lr.registration_id = mr.id AND lr.deleted_at IS NULL \
                                       AND lr.delivery_time IS NOT NULL)) \
         OR EXISTS (SELECT 1 FROM labor_records lr \
                      JOIN maternity_registrations mr ON mr.id = lr.registration_id \
                     WHERE mr.patient_id = p.id AND lr.tenant_id = e.tenant_id \
                       AND lr.deleted_at IS NULL AND lr.delivery_time > now() - interval '42 days')) \
          AS obstetric, \
        pl.spo2_scale2, pl.tool_override, \
        a.id AS admission_id, a.ward_id, a.department_id, a.primary_nurse_id, \
        COALESCE(a.attending_doctor_id, a.admitting_doctor) AS doctor_id, \
        btrim(concat_ws(' ', p.first_name, p.last_name)) || ' (' || p.uhid || ')' AS patient_label \
   FROM encounters e \
   JOIN patients p ON p.id = e.patient_id \
   LEFT JOIN ews_encounter_plans pl ON pl.encounter_id = e.id AND pl.tenant_id = e.tenant_id \
        AND pl.deleted_at IS NULL \
   LEFT JOIN LATERAL (SELECT a.* FROM admissions a \
                       WHERE a.encounter_id = e.id AND a.tenant_id = e.tenant_id \
                         AND a.status = 'admitted' AND a.deleted_at IS NULL \
                       ORDER BY a.admitted_at DESC LIMIT 1) a ON true \
  WHERE e.id = $1 AND e.tenant_id = $2";

pub async fn context(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    encounter_id: Uuid,
) -> Result<Context, AppError> {
    sqlx::query_as::<_, Context>(CONTEXT_SQL)
        .bind(encounter_id)
        .bind(tenant_id)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

impl Context {
    #[must_use]
    pub fn kind(&self) -> PatientKind {
        PatientKind {
            age_months: self.age_months,
            obstetric: self.obstetric,
            spo2_scale2: self.spo2_scale2.unwrap_or(false),
            tool_override: self.tool_override.as_deref().and_then(Tool::parse),
        }
    }
}

/// The hospital's policy, or the defaults. A stored policy that no longer
/// passes validation is not trusted: the safe defaults apply and it is logged.
pub async fn load_policy(tx: &mut Tx<'_>, tenant_id: Uuid) -> Result<EwsPolicy, AppError> {
    let stored: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT value FROM tenant_settings \
          WHERE tenant_id = $1 AND category = $2 AND key = $3 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(POLICY_CATEGORY)
    .bind(POLICY_KEY)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(value) = stored else {
        return Ok(EwsPolicy::default());
    };
    match serde_json::from_value::<EwsPolicy>(value) {
        Ok(p) if p.validate().is_ok() => Ok(p),
        _ => {
            tracing::error!(%tenant_id, "stored early-warning policy is invalid; using defaults");
            Ok(EwsPolicy::default())
        }
    }
}

/// The score as the API returns it with a reading.
#[derive(Debug, Clone, Serialize)]
pub struct EwsView {
    #[serde(flatten)]
    pub score: EwsScore,
    pub next_due_at: DateTime<Utc>,
    pub escalation_id: Option<Uuid>,
}

/// Notifications written in the transaction, published once it commits.
pub type Outgoing = Vec<(Uuid, NewNotificationOwned)>;

#[derive(Debug, Clone)]
pub struct NewNotificationOwned {
    pub user_id: Uuid,
    pub kind: &'static str,
    pub title: String,
    pub body: String,
    pub entity_id: Uuid,
    pub action_url: String,
}

impl NewNotificationOwned {
    #[must_use]
    pub fn borrow(&self) -> NewNotification<'_> {
        NewNotification {
            user_id: self.user_id,
            kind: self.kind,
            title: &self.title,
            body: Some(&self.body),
            category: Some("ews"),
            entity_type: Some("ews_escalation"),
            entity_id: Some(self.entity_id),
            action_url: Some(&self.action_url),
        }
    }
}

/// Score a stored reading, write the score onto it, move the schedule, and
/// open or update an escalation.
pub async fn score_reading(
    tx: &mut Tx<'_>,
    (tenant_id, actor): (Uuid, Uuid),
    (encounter_id, vitals_id): (Uuid, Uuid),
    obs: &Observation,
) -> Result<(EwsView, Outgoing), AppError> {
    let ctx = context(tx, tenant_id, encounter_id).await?;
    let policy = load_policy(tx, tenant_id).await?;
    let score = ews::score(obs, &ctx.kind());
    let next_due_at = Utc::now() + Duration::minutes(i64::from(policy.next_due_minutes(&score)));
    store(tx, tenant_id, vitals_id, &score, next_due_at).await?;
    sqlx::query(
        "UPDATE vitals_capture_schedules SET next_due_at = LEAST(next_due_at, $3) \
          WHERE tenant_id = $1 AND encounter_id = $2 AND ended_at IS NULL",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(next_due_at)
    .execute(&mut **tx)
    .await?;
    let mut outgoing = Vec::new();
    let mut escalation_id = None;
    if let Some(admission_id) = ctx.admission_id.filter(|_| policy.escalates(score.band)) {
        let opened = crate::nurse_ews_escalate::open_or_update(
            tx,
            &crate::nurse_ews_escalate::Trigger {
                tenant_id,
                actor,
                encounter_id,
                admission_id,
                vitals_id,
                ctx: &ctx,
                score: &score,
                ack_minutes: policy.ack_minutes(score.band),
            },
        )
        .await?;
        escalation_id = Some(opened.0);
        outgoing = opened.1;
    }
    Ok((
        EwsView {
            score,
            next_due_at,
            escalation_id,
        },
        outgoing,
    ))
}

async fn store(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    vitals_id: Uuid,
    s: &EwsScore,
    next_due_at: DateTime<Utc>,
) -> Result<(), AppError> {
    let missing: Vec<&str> = s.missing.clone();
    sqlx::query(
        "UPDATE vitals SET ews_tool = $1, ews_total = $2, ews_band = $3, ews_incomplete = $4, \
                ews_missing = $5, ews_params = $6, ews_spo2_scale = $7, ews_age_band = $8, \
                ews_next_due_at = $9 \
          WHERE id = $10 AND tenant_id = $11",
    )
    .bind(s.tool.as_str())
    .bind(s.total)
    .bind(s.band.as_str())
    .bind(s.incomplete)
    .bind(&missing)
    .bind(serde_json::to_value(&s.params).map_err(|e| AppError::Internal(e.to_string()))?)
    .bind(s.spo2_scale)
    .bind(s.age_band.map(ews::AgeBand::as_str))
    .bind(next_due_at)
    .bind(vitals_id)
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// Band severity for comparing an open escalation with a new score.
#[must_use]
pub fn band_of(s: &str) -> Band {
    Band::parse(s).unwrap_or(Band::Emergency)
}

/// A reading as charted, with the early-warning score it was given.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ScoredVital {
    #[serde(flatten)]
    #[sqlx(flatten)]
    pub vital: medbrains_core::consultation::Vital,
    pub consciousness: Option<String>,
    pub oxygen_device: Option<String>,
    pub oxygen_flow_lpm: Option<Decimal>,
    pub fio2_percent: Option<i32>,
    pub capillary_refill_seconds: Option<Decimal>,
    pub respiratory_distress: Option<String>,
    pub ews_tool: Option<String>,
    pub ews_total: Option<i32>,
    pub ews_band: Option<String>,
    pub ews_incomplete: Option<bool>,
    pub ews_missing: Option<Vec<String>>,
    pub ews_params: Option<serde_json::Value>,
    pub ews_spo2_scale: Option<i16>,
    pub ews_age_band: Option<String>,
    pub ews_next_due_at: Option<DateTime<Utc>>,
}

/// `POST /api/nurse/vitals` response: the reading and its score.
#[derive(Debug, Serialize)]
pub struct CreatedVital {
    #[serde(flatten)]
    pub vital: medbrains_core::consultation::Vital,
    pub ews: EwsView,
}

/// The text a snake_case/ACVPU enum is stored as.
pub fn enum_text<T: Serialize>(v: &T) -> String {
    serde_json::to_value(v)
        .ok()
        .and_then(|j| j.as_str().map(str::to_owned))
        .unwrap_or_default()
}

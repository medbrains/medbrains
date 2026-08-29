//! Consent, suppression, and the gate every send must pass through.
//!
//! # The defect this closes
//!
//! `consent_call`, `consent_sms` and `consent_whatsapp` exist on
//! `mkt_contacts` and appear in this crate only inside SELECT lists — never an
//! UPDATE, never a WHERE. There was no way to record a grant and no way to
//! record a withdrawal. The flags were decoration, and the first send adapter
//! to ship would have been the first code that could consult them, with
//! nothing failing if it forgot.
//!
//! [`resolve_sendable`] exists so that forgetting is not possible: it is the
//! only way to turn a list of contacts into a list of addresses.
//!
//! # Three outcomes, never two
//!
//! A refusal and a fault are different answers and must not wear the same
//! disguise. If a database error resolved to "blocked", a run that failed to
//! read the ledger would skip four thousand people and report a successful
//! send of zero — the outage would be indistinguishable from a tenant whose
//! patients had all opted out. [`Sendability::Unknown`] is therefore a
//! first-class outcome, and the dispatcher must stop rather than treat it as
//! a refusal. See `RFC-AUTHZ-2026-001` §Code.
//!
//! # Why the purpose is coarse
//!
//! Four purposes, fixed by a CHECK constraint: service, appointment, recall,
//! promotional. `recall` may not become `diabetic_retinopathy_recall`. The
//! wall in `0975_marketing.sql` is breached as easily by a vocabulary as by a
//! column, and a purpose string is exactly where somebody would put the
//! reason.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use medbrains_core::permissions;
use medbrains_db::pool::set_tenant_context;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, Transaction};
use std::collections::HashMap;
use uuid::Uuid;

use crate::contacts::canonical_value;

/// Traffic classes, mirroring TRAI's categories and the CHECK constraint in
/// `0996_marketing_consent.sql`.
pub mod traffic {
    /// Transactional — a bill, a report, a discharge instruction.
    pub const SERVICE_IMPLICIT: &str = "service_implicit";
    /// Service-explicit — an appointment reminder the patient asked for.
    pub const SERVICE_EXPLICIT: &str = "service_explicit";
    /// Promotional. The only class the frequency cap and quiet hours apply to.
    pub const PROMOTIONAL: &str = "promotional";
}

/// Why one recipient was excluded. A closed, operational vocabulary — none of
/// these is a clinical reason, and none may become one.
pub mod blocked {
    pub const NO_CONSENT: &str = "no_consent";
    pub const WITHDRAWN: &str = "withdrawn";
    pub const SUPPRESSED: &str = "suppressed";
    pub const OVER_CAP: &str = "over_cap";
    pub const NO_ADDRESS: &str = "no_address";
    /// The gate could not decide. Never written by a send — the dispatcher
    /// refuses to start on an unresolved recipient — but present so a match
    /// on `Sendability` stays exhaustive without a catch-all that would
    /// silently treat a future outcome as sendable.
    pub const UNKNOWN: &str = "unknown";
}

/// The answer for one contact.
///
/// `Unknown` is not a refusal and must never be rendered as one. It means the
/// gate could not reach an answer — and a caller that treats it as "blocked"
/// turns an outage into a silent, plausible-looking send of nothing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum Sendability {
    Sendable { address: String },
    Blocked { reason: &'static str },
    Unknown,
}

impl Sendability {
    #[must_use]
    pub const fn is_sendable(&self) -> bool {
        matches!(self, Self::Sendable { .. })
    }
}

/// What the gate returns for a whole cohort.
#[derive(Debug, Default, Serialize)]
pub struct SendableSet {
    pub decisions: HashMap<Uuid, Sendability>,
}

impl SendableSet {
    #[must_use]
    pub fn sendable_count(&self) -> usize {
        self.decisions.values().filter(|d| d.is_sendable()).count()
    }

    /// Recipients the gate could not decide. Non-empty means the run must not
    /// start: sending to only the ones that resolved would quietly drop the
    /// rest, and reporting them as blocked would be a lie about why.
    #[must_use]
    pub fn unresolved(&self) -> Vec<Uuid> {
        self.decisions
            .iter()
            .filter(|(_, d)| matches!(d, Sendability::Unknown))
            .map(|(id, _)| *id)
            .collect()
    }

    /// Excluded recipients grouped by reason, for the compose-screen preview.
    #[must_use]
    pub fn blocked_tally(&self) -> HashMap<&'static str, usize> {
        let mut tally = HashMap::new();
        for decision in self.decisions.values() {
            if let Sendability::Blocked { reason } = decision {
                *tally.entry(*reason).or_insert(0) += 1;
            }
        }
        tally
    }
}

#[derive(Debug, sqlx::FromRow)]
struct GateRow {
    contact_id: Uuid,
    address: Option<String>,
    latest_action: Option<String>,
    suppressed: bool,
    /// True when this contact has already had as many promotional messages in
    /// the policy window as the tenant allows.
    over_cap: bool,
}

/// Decides who in a cohort may lawfully be sent to, and why each excluded
/// recipient was excluded.
///
/// One round trip for the whole cohort — `ANY($2)`, never a check per
/// recipient. A cohort of five thousand resolved one at a time is five
/// thousand round trips on a path an operator is watching.
///
/// Service traffic is not subject to the promotional consent check: an
/// appointment reminder is not an offer, and gating it on a marketing opt-in
/// is how a patient stops being told when to come in. It is still subject to
/// an `all`-scope suppression, because that is what a bereaved family asked
/// for.
///
/// # Errors
/// Returns the database error rather than swallowing it. A caller that
/// converts this into "everybody is blocked" has reintroduced the exact defect
/// this module exists to prevent.
pub async fn resolve_sendable(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    contact_ids: &[Uuid],
    ctx: &SendContext<'_>,
) -> Result<SendableSet, AppError> {
    let mut set = SendableSet::default();
    if contact_ids.is_empty() {
        return Ok(set);
    }

    let promotional = ctx.traffic_class == traffic::PROMOTIONAL;

    // `DISTINCT ON` gives the latest ledger row per contact for this channel
    // and purpose; the suppression join is on the identity value, which is why
    // an opt-out survives the contact being deleted and recreated.
    let rows = sqlx::query_as::<_, GateRow>(
        "SELECT c.id AS contact_id, \
                CASE WHEN $3 = 'email' THEN c.email ELSE c.primary_phone END AS address, \
                latest.action AS latest_action, \
                (s.id IS NOT NULL) AS suppressed, \
                ($5::boolean AND ( \
                    COALESCE(recent.today, 0) >= COALESCE(pol.max_per_day, 1) \
                 OR COALESCE(recent.week, 0) >= COALESCE(pol.max_per_week, 3) \
                )) AS over_cap \
         FROM mkt_contacts c \
         LEFT JOIN mkt_send_policy pol ON pol.tenant_id = c.tenant_id \
         LEFT JOIN LATERAL ( \
             SELECT count(*) FILTER (WHERE m.sent_at > now() - interval '1 day') AS today, \
                    count(*) FILTER (WHERE m.sent_at > now() - interval '7 days') AS week \
             FROM mkt_messages m \
             WHERE m.tenant_id = c.tenant_id AND m.contact_id = c.id \
               AND m.traffic_class = 'promotional' AND m.sent_at IS NOT NULL \
         ) recent ON true \
         LEFT JOIN LATERAL ( \
             SELECT k.action FROM mkt_consents k \
             WHERE k.tenant_id = c.tenant_id AND k.contact_id = c.id \
               AND k.channel = $3 AND k.purpose = $4 \
             ORDER BY k.occurred_at DESC, k.id DESC LIMIT 1 \
         ) latest ON true \
         LEFT JOIN mkt_suppressions s \
                ON s.tenant_id = c.tenant_id AND s.channel = $3 \
               AND s.value = CASE WHEN $3 = 'email' THEN lower(c.email) \
                                  ELSE c.primary_phone END \
               AND (s.scope = 'all' OR $5::boolean) \
         WHERE c.tenant_id = $1 AND c.id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(contact_ids)
    .bind(ctx.channel)
    .bind(ctx.purpose)
    .bind(promotional)
    .fetch_all(&mut **tx)
    .await?;

    for row in rows {
        set.decisions.insert(row.contact_id, decide(&row, promotional));
    }

    // A contact the query did not return is not a refusal — it is a contact
    // the gate has no answer for. Recording it as `Unknown` keeps the count
    // honest instead of silently shrinking the cohort.
    for id in contact_ids {
        set.decisions.entry(*id).or_insert(Sendability::Unknown);
    }

    Ok(set)
}

/// The decision for one row, given the traffic class.
///
/// Split out so the ordering is testable without a database: suppression
/// outranks consent, and a missing address outranks both — telling somebody
/// they opted out when the real problem is that no number was ever recorded
/// sends the desk looking in the wrong place.
fn decide(row: &GateRow, promotional: bool) -> Sendability {
    let Some(address) = row.address.as_deref().map(str::trim).filter(|a| !a.is_empty()) else {
        return Sendability::Blocked { reason: blocked::NO_ADDRESS };
    };
    if row.suppressed {
        return Sendability::Blocked { reason: blocked::SUPPRESSED };
    }
    if promotional {
        return match row.latest_action.as_deref() {
            // The cap applies only to somebody who actually agreed. Below
            // consent on purpose: a person who never agreed is refused for
            // never agreeing, not for a cap they were never subject to, and
            // the desk reads the reason to decide which conversation to have.
            Some("granted") if row.over_cap => {
                Sendability::Blocked { reason: blocked::OVER_CAP }
            }
            Some("granted") => Sendability::Sendable { address: address.to_owned() },
            Some("withdrawn") => Sendability::Blocked { reason: blocked::WITHDRAWN },
            // Never asked. Distinct from withdrawn in the ledger, and the same
            // answer here: silence is not consent under DPDP.
            _ => Sendability::Blocked { reason: blocked::NO_CONSENT },
        };
    }
    // Service traffic. An appointment reminder is not an offer, and gating it
    // on a marketing opt-in is how a patient stops being told when to come in.
    Sendability::Sendable { address: address.to_owned() }
}

/// What is being sent, and under what class.
#[derive(Debug)]
pub struct SendContext<'a> {
    pub channel: &'a str,
    pub purpose: &'a str,
    pub traffic_class: &'a str,
}

// ── Ledger endpoints ─────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ConsentEntry {
    pub id: Uuid,
    pub channel: String,
    pub purpose: String,
    pub action: String,
    pub legal_basis: String,
    pub notice_version: Option<String>,
    pub source: String,
    pub occurred_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RecordConsentRequest {
    pub channel: String,
    pub purpose: String,
    pub source: String,
    pub notice_version: Option<String>,
    pub evidence_ref: Option<String>,
}

/// `GET /api/marketing/contacts/{id}/consent`
///
/// The ledger for one contact, newest first. The history, not a current
/// state: "she agreed in March and withdrew in August" is the answer, and a
/// boolean cannot give it.
///
/// # Errors
/// Returns 403 without `marketing.consent.view`.
pub async fn list_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(contact_id): Path<Uuid>,
) -> Result<Json<Vec<ConsentEntry>>, AppError> {
    require_permission(&claims, permissions::marketing::consent::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ConsentEntry>(
        "SELECT id, channel, purpose, action, legal_basis, notice_version, \
                source, occurred_at \
         FROM mkt_consents WHERE contact_id = $1 AND tenant_id = $2 \
         ORDER BY occurred_at DESC, id DESC",
    )
    .bind(contact_id)
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// `POST /api/marketing/contacts/{id}/consent`
///
/// Appends a grant. Requires `marketing.consent.capture`, which is separate
/// from editing the enquiry: capture asserts that a notice was shown and a
/// person agreed, and whoever can fix a misspelt name should not thereby be
/// able to manufacture that assertion.
///
/// # Errors
/// Returns 403 without the permission, 404 if the contact is not in this
/// tenant, 400 on an unknown channel or purpose.
pub async fn record_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(contact_id): Path<Uuid>,
    Json(body): Json<RecordConsentRequest>,
) -> Result<Json<ConsentEntry>, AppError> {
    require_permission(&claims, permissions::marketing::consent::CAPTURE)?;
    append(&state, &claims, contact_id, &body, "granted").await
}

/// `POST /api/marketing/contacts/{id}/consent/withdraw`
///
/// Appends a withdrawal. Never an UPDATE: DPDP §6 asks what the consent was at
/// the moment of send, and a flag flipped to false destroys the grant that
/// preceded it.
///
/// # Errors
/// Returns 403 without `marketing.consent.withdraw`, 404 if the contact is not
/// in this tenant.
pub async fn withdraw_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(contact_id): Path<Uuid>,
    Json(body): Json<RecordConsentRequest>,
) -> Result<Json<ConsentEntry>, AppError> {
    require_permission(&claims, permissions::marketing::consent::WITHDRAW)?;
    append(&state, &claims, contact_id, &body, "withdrawn").await
}

async fn append(
    state: &AppState,
    claims: &Claims,
    contact_id: Uuid,
    body: &RecordConsentRequest,
    action: &str,
) -> Result<Json<ConsentEntry>, AppError> {
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let exists: Option<Uuid> =
        sqlx::query_scalar("SELECT id FROM mkt_contacts WHERE id = $1 AND tenant_id = $2")
            .bind(contact_id)
            .bind(claims.tenant_id)
            .fetch_optional(&mut *tx)
            .await?;
    if exists.is_none() {
        return Err(AppError::NotFound);
    }

    let row = sqlx::query_as::<_, ConsentEntry>(
        "INSERT INTO mkt_consents \
            (tenant_id, contact_id, channel, purpose, action, source, \
             notice_version, evidence_ref, captured_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         RETURNING id, channel, purpose, action, legal_basis, notice_version, \
                   source, occurred_at",
    )
    .bind(claims.tenant_id)
    .bind(contact_id)
    .bind(body.channel.trim())
    .bind(body.purpose.trim())
    .bind(action)
    .bind(body.source.trim())
    .bind(body.notice_version.as_deref())
    .bind(body.evidence_ref.as_deref())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    // The legacy booleans stay, demoted to a cache of the ledger so existing
    // reads keep working. Written in the same transaction, so they cannot
    // disagree with the row that authorises a send.
    let granted = action == "granted";
    sqlx::query(
        "UPDATE mkt_contacts SET \
            consent_call     = CASE WHEN $3 = 'phone'    THEN $4 ELSE consent_call END, \
            consent_sms      = CASE WHEN $3 = 'sms'      THEN $4 ELSE consent_sms END, \
            consent_whatsapp = CASE WHEN $3 = 'whatsapp' THEN $4 ELSE consent_whatsapp END, \
            consent_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2",
    )
    .bind(contact_id)
    .bind(claims.tenant_id)
    .bind(body.channel.trim())
    .bind(granted)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

// ── Suppression ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Suppression {
    pub id: Uuid,
    pub channel: String,
    pub value: String,
    pub reason: String,
    pub scope: String,
    pub since: chrono::DateTime<chrono::Utc>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddSuppressionRequest {
    pub channel: String,
    pub value: String,
    pub reason: String,
    pub scope: Option<String>,
    pub note: Option<String>,
}

/// `POST /api/marketing/suppressions`
///
/// "Never call this number again", from the front desk.
///
/// Keyed on the normalised identity value rather than a contact id, and it
/// does not cascade. `retention_until` deletes a contact; the next inbound
/// call manufactures a fresh one with `consent_* = false`, which reads as "not
/// yet asked" and is indistinguishable from "asked and refused". An opt-out
/// has to outlive the record it was recorded against.
///
/// # Errors
/// Returns 403 without `marketing.suppression.manage`, 400 on an
/// unnormalisable number.
pub async fn add_suppression(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AddSuppressionRequest>,
) -> Result<Json<Suppression>, AppError> {
    require_permission(&claims, permissions::marketing::SUPPRESSION_MANAGE)?;

    // The same normalisation the identity table uses. A number suppressed as
    // the desk typed it must match the number a provider webhook reports, or
    // the opt-out silently fails to apply.
    let value = canonical_value(&body.channel, &body.value)?;
    let scope = body.scope.as_deref().unwrap_or("promotional");

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Re-suppressing an already-suppressed number is the desk doing its job
    // twice, not an error worth showing somebody.
    let row = sqlx::query_as::<_, Suppression>(
        "INSERT INTO mkt_suppressions \
            (tenant_id, channel, value, reason, scope, note, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) \
         ON CONFLICT (tenant_id, channel, value, scope) DO UPDATE \
             SET reason = EXCLUDED.reason, note = EXCLUDED.note \
         RETURNING id, channel, value, reason, scope, since, note",
    )
    .bind(claims.tenant_id)
    .bind(body.channel.trim())
    .bind(&value)
    .bind(body.reason.trim())
    .bind(scope)
    .bind(body.note.as_deref())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// `GET /api/marketing/suppressions`
///
/// # Errors
/// Returns 403 without `marketing.consent.view`.
pub async fn list_suppressions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<Suppression>>, AppError> {
    // Reading the list is a consent read; adding to it is a separate act.
    require_permission(&claims, permissions::marketing::consent::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, Suppression>(
        "SELECT id, channel, value, reason, scope, since, note \
         FROM mkt_suppressions WHERE tenant_id = $1 \
         ORDER BY since DESC LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[cfg(test)]
mod tests {
    use super::{GateRow, Sendability, blocked, decide};
    use uuid::Uuid;

    fn row(address: Option<&str>, action: Option<&str>, suppressed: bool) -> GateRow {
        GateRow {
            contact_id: Uuid::new_v4(),
            address: address.map(str::to_owned),
            latest_action: action.map(str::to_owned),
            suppressed,
            over_cap: false,
        }
    }

    fn capped(action: Option<&str>) -> GateRow {
        GateRow { over_cap: true, ..row(Some("+919000000001"), action, false) }
    }

    /// Silence is not consent. A contact nobody ever asked is refused for
    /// promotional traffic, and refused for a different stated reason than
    /// somebody who withdrew — the desk needs to know which conversation to
    /// have.
    #[test]
    fn never_asked_is_refused_and_is_not_the_same_as_withdrawn() {
        assert_eq!(
            decide(&row(Some("+919000000001"), None, false), true),
            Sendability::Blocked { reason: blocked::NO_CONSENT }
        );
        assert_eq!(
            decide(&row(Some("+919000000001"), Some("withdrawn"), false), true),
            Sendability::Blocked { reason: blocked::WITHDRAWN }
        );
    }

    #[test]
    fn a_granted_promotional_consent_is_sendable() {
        assert!(decide(&row(Some("+919000000001"), Some("granted"), false), true).is_sendable());
    }

    /// An appointment reminder is not an offer. Gating service traffic on a
    /// marketing opt-in is how a patient stops being told when to come in.
    #[test]
    fn service_traffic_does_not_need_a_promotional_opt_in() {
        assert!(decide(&row(Some("+919000000001"), None, false), false).is_sendable());
    }

    /// Suppression outranks consent, on both traffic classes. Somebody who
    /// said "never contact me again" has not been made contactable by an old
    /// grant sitting further up the ledger.
    #[test]
    fn suppression_beats_an_existing_grant() {
        assert_eq!(
            decide(&row(Some("+919000000001"), Some("granted"), true), true),
            Sendability::Blocked { reason: blocked::SUPPRESSED }
        );
        assert_eq!(
            decide(&row(Some("+919000000001"), Some("granted"), true), false),
            Sendability::Blocked { reason: blocked::SUPPRESSED }
        );
    }

    /// A missing address outranks both, because "she opted out" sends the desk
    /// looking for a conversation that never happened when the real problem is
    /// that nobody ever recorded a number.
    #[test]
    fn a_missing_address_is_reported_as_itself() {
        assert_eq!(
            decide(&row(None, Some("granted"), false), true),
            Sendability::Blocked { reason: blocked::NO_ADDRESS }
        );
        assert_eq!(
            decide(&row(Some("   "), Some("granted"), false), true),
            Sendability::Blocked { reason: blocked::NO_ADDRESS }
        );
    }

    /// Somebody messaged too often this week is refused, and told apart from
    /// somebody who refused us. Both block the send and they are different
    /// facts: one is our own policy, the other is their answer.
    #[test]
    fn a_contact_over_the_frequency_cap_is_refused_for_that_reason() {
        assert_eq!(
            decide(&capped(Some("granted")), true),
            Sendability::Blocked { reason: blocked::OVER_CAP }
        );
    }

    /// The cap sits below consent. Somebody who never agreed is refused for
    /// never agreeing, not for a cap they were never subject to — the desk
    /// reads the reason to decide which conversation to have.
    #[test]
    fn never_asked_outranks_the_cap() {
        assert_eq!(
            decide(&capped(None), true),
            Sendability::Blocked { reason: blocked::NO_CONSENT }
        );
    }

    /// A cap is a marketing policy. An appointment reminder is not marketing,
    /// and a patient who got three offers this week must still be told when to
    /// come in.
    #[test]
    fn the_cap_does_not_apply_to_service_traffic() {
        assert!(decide(&capped(Some("granted")), false).is_sendable());
    }

    /// The whole point of the module. A fault is not a refusal, and the two
    /// must not be the same value — if `Unknown` compared equal to any
    /// `Blocked`, a caller filtering on "not blocked" would send to contacts
    /// the gate never resolved.
    #[test]
    fn unknown_is_not_a_refusal() {
        assert_ne!(Sendability::Unknown, Sendability::Blocked { reason: blocked::NO_CONSENT });
        assert!(!Sendability::Unknown.is_sendable());
    }
}

// ── Send policy ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SendPolicy {
    pub max_per_day: i32,
    pub max_per_week: i32,
    pub quiet_from: chrono::NaiveTime,
    pub quiet_to: chrono::NaiveTime,
    pub timezone: String,
}

#[derive(Debug, Deserialize)]
pub struct UpsertSendPolicyRequest {
    pub max_per_day: i32,
    pub max_per_week: i32,
    pub quiet_from: chrono::NaiveTime,
    pub quiet_to: chrono::NaiveTime,
    pub timezone: String,
}

const POLICY_COLUMNS: &str = "max_per_day, max_per_week, quiet_from, quiet_to, timezone";

/// `GET /api/marketing/send-policy`
///
/// The caps and quiet hours, with the defaults from `0996` when the tenant has
/// never set them — so the screen shows what is actually being enforced rather
/// than an empty form implying nothing is.
///
/// # Errors
/// Returns 403 without `marketing.consent.view`.
pub async fn get_send_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<SendPolicy>, AppError> {
    require_permission(&claims, permissions::marketing::consent::VIEW)?;

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, SendPolicy>(&format!(
        "SELECT {POLICY_COLUMNS} FROM mkt_send_policy WHERE tenant_id = $1"
    ))
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row.unwrap_or_else(|| SendPolicy {
        max_per_day: 1,
        max_per_week: 3,
        quiet_from: chrono::NaiveTime::from_hms_opt(21, 0, 0).unwrap_or_default(),
        quiet_to: chrono::NaiveTime::from_hms_opt(9, 0, 0).unwrap_or_default(),
        timezone: "Asia/Kolkata".to_owned(),
    })))
}

/// `PUT /api/marketing/send-policy`
///
/// # Errors
/// Returns 403 without `marketing.settings.manage`, 400 on a negative cap.
pub async fn update_send_policy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertSendPolicyRequest>,
) -> Result<Json<SendPolicy>, AppError> {
    // The permission that until now no handler used.
    require_permission(&claims, permissions::marketing::SETTINGS_MANAGE)?;

    if body.max_per_day < 0 || body.max_per_week < 0 {
        return Err(AppError::BadRequest(
            "a cap cannot be negative — zero stops promotional sending entirely".to_owned(),
        ));
    }
    if body.max_per_day > body.max_per_week {
        // Not pedantry: a daily cap above the weekly one is silently the
        // weekly one, and somebody would set it and wonder why it did nothing.
        return Err(AppError::BadRequest(
            "the daily cap cannot exceed the weekly one".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, SendPolicy>(&format!(
        "INSERT INTO mkt_send_policy \
            (tenant_id, max_per_day, max_per_week, quiet_from, quiet_to, timezone) \
         VALUES ($1, $2, $3, $4, $5, $6) \
         ON CONFLICT (tenant_id) DO UPDATE SET \
             max_per_day = EXCLUDED.max_per_day, \
             max_per_week = EXCLUDED.max_per_week, \
             quiet_from = EXCLUDED.quiet_from, \
             quiet_to = EXCLUDED.quiet_to, \
             timezone = EXCLUDED.timezone, \
             updated_at = now() \
         RETURNING {POLICY_COLUMNS}"
    ))
    .bind(claims.tenant_id)
    .bind(body.max_per_day)
    .bind(body.max_per_week)
    .bind(body.quiet_from)
    .bind(body.quiet_to)
    .bind(body.timezone.trim())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// Whether promotional sending is inside the tenant's quiet window right now.
///
/// A run-level question, not a per-recipient one: it is a fact about the clock,
/// so the dispatcher refuses the whole run rather than marking four thousand
/// people blocked for something that will stop being true at nine.
///
/// Evaluated in the tenant's own zone. "No promotional messages after nine" is
/// a statement about the recipient's evening, and a server in UTC deciding it
/// would silence a hospital in the afternoon.
///
/// # Errors
/// Propagates the database error. A caller must not read a fault as "quiet" or
/// as "fine" — both are guesses about the law.
pub async fn in_quiet_hours(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
) -> Result<bool, AppError> {
    let quiet: Option<bool> = sqlx::query_scalar(
        "SELECT CASE \
            WHEN p.quiet_from = p.quiet_to THEN false \
            WHEN p.quiet_from < p.quiet_to THEN \
                 (now() AT TIME ZONE p.timezone)::time >= p.quiet_from \
             AND (now() AT TIME ZONE p.timezone)::time < p.quiet_to \
            ELSE (now() AT TIME ZONE p.timezone)::time >= p.quiet_from \
              OR (now() AT TIME ZONE p.timezone)::time < p.quiet_to \
         END \
         FROM mkt_send_policy p WHERE p.tenant_id = $1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    // No policy row means the tenant has never set one, and the migration's
    // defaults are not enforced until they do. Silence is not a curfew.
    Ok(quiet.unwrap_or(false))
}

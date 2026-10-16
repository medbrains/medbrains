//! Breach register on the security incident record — CERT-In and DPDP.
//!
//! The clocks start when the incident is **noticed** (`discovered_at`), per
//! `docs/compliance/INCIDENT-RESPONSE.md` §6:
//!
//! - CERT-In Directions 2022, direction (ii): an Annexure I incident is
//!   reported within 6 hours.
//! - DPDP Act s.8(6) + Rules 2025 rule 7: the Board is intimated without
//!   delay and the detailed report follows within 72 hours; each affected Data
//!   Principal is told.
//!
//! The deadlines are computed by [`SecurityIncident::with_deadlines`]; each
//! notice is recorded once, written to the incident timeline and to the audit
//! chain in the same transaction. Overdue clocks are escalated by
//! `medbrains-server`'s `breach_deadline_escalation` pass.

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Duration, Utc};
use medbrains_core::permissions;
use medbrains_core::security::SecurityIncident;
use serde::Deserialize;
use uuid::Uuid;

use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

pub(crate) type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// Personal-data categories a breach can involve. Health data is its own
/// line because it decides how the patient notice is worded.
const DATA_CATEGORIES: &[&str] = &[
    "health_records",
    "identity",
    "contact",
    "financial",
    "biometric",
    "children",
    "credentials",
    "other",
];

/// A clock may be backdated, never forward-dated beyond clock skew.
const CLOCK_SKEW_MINUTES: i64 = 5;

#[derive(Debug, Deserialize)]
pub struct AssessBreachRequest {
    pub discovered_at: DateTime<Utc>,
    pub is_cert_in_reportable: bool,
    pub is_personal_data_breach: bool,
    #[serde(default)]
    pub breach_data_categories: Vec<String>,
    pub principals_affected_estimate: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct RecordNoticeRequest {
    /// `cert_in`, `board_initial`, `board_report` or `principals`.
    pub kind: String,
    pub reference: Option<String>,
    pub sent_at: Option<DateTime<Utc>>,
    pub count: Option<i32>,
}

pub(crate) async fn locked_incident(
    tx: &mut Tx<'_>,
    tenant_id: Uuid,
    id: Uuid,
) -> Result<SecurityIncident, AppError> {
    sqlx::query_as::<_, SecurityIncident>(
        "SELECT * FROM security_incidents \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(id)
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)
}

/// One timeline row and one audit-chain row for the same act.
async fn record(
    tx: &mut Tx<'_>,
    claims: &Claims,
    incident_id: Uuid,
    update_type: &str,
    description: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO security_incident_updates \
         (tenant_id, incident_id, update_type, description, updated_by) \
         VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(claims.tenant_id)
    .bind(incident_id)
    .bind(update_type)
    .bind(description)
    .bind(claims.sub)
    .execute(&mut **tx)
    .await?;
    let values = serde_json::json!({ "update_type": update_type, "description": description });
    medbrains_db::audit::AuditLogger::log(
        tx,
        &medbrains_db::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "security_incident.breach",
            entity_type: "security_incident",
            entity_id: Some(incident_id),
            old_values: None,
            new_values: Some(&values),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

fn validate_assessment(body: &AssessBreachRequest, now: DateTime<Utc>) -> Result<(), AppError> {
    if body.discovered_at > now + Duration::minutes(CLOCK_SKEW_MINUTES) {
        return Err(AppError::BadRequest(
            "When it was noticed cannot be in the future.".into(),
        ));
    }
    if let Some(bad) = body
        .breach_data_categories
        .iter()
        .find(|c| !DATA_CATEGORIES.contains(&c.as_str()))
    {
        return Err(AppError::BadRequest(format!(
            "Unknown data category '{bad}'. Use: {}.",
            DATA_CATEGORIES.join(", ")
        )));
    }
    if body.is_personal_data_breach && body.breach_data_categories.is_empty() {
        return Err(AppError::BadRequest(
            "Say which kinds of personal data were involved — the Board and patient notices need it."
                .into(),
        ));
    }
    if body.principals_affected_estimate.is_some_and(|n| n < 0) {
        return Err(AppError::BadRequest(
            "The number of people affected cannot be negative.".into(),
        ));
    }
    Ok(())
}

/// `PUT /api/security/incidents/{id}/breach` — classify the incident and start the clocks.
pub async fn assess_breach(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<AssessBreachRequest>,
) -> Result<Json<SecurityIncident>, AppError> {
    require_permission(&claims, permissions::security::breach::MANAGE)?;
    validate_assessment(&body, Utc::now())?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let current = locked_incident(&mut tx, claims.tenant_id, id).await?;

    // A notice already sent cannot be un-needed: the filing stands on record.
    if current.cert_in_report_date.is_some() && !body.is_cert_in_reportable {
        return Err(AppError::Conflict(
            "CERT-In has already been notified, so this stays a CERT-In incident.".into(),
        ));
    }
    let notified_board =
        current.board_intimated_at.is_some() || current.board_report_sent_at.is_some();
    if (notified_board || current.principals_notified_at.is_some()) && !body.is_personal_data_breach
    {
        return Err(AppError::Conflict(
            "Breach notices have already gone out, so this stays a personal-data breach.".into(),
        ));
    }

    let row = sqlx::query_as::<_, SecurityIncident>(
        "UPDATE security_incidents SET \
         discovered_at = $3, is_cert_in_reportable = $4, is_personal_data_breach = $5, \
         breach_data_categories = $6, principals_affected_estimate = $7 \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(body.discovered_at)
    .bind(body.is_cert_in_reportable)
    .bind(body.is_personal_data_breach)
    .bind(&body.breach_data_categories)
    .bind(body.principals_affected_estimate)
    .fetch_one(&mut *tx)
    .await?;

    let summary = format!(
        "Assessed: noticed {}; CERT-In reportable: {}; personal-data breach: {}{}",
        body.discovered_at.format("%d %b %Y %H:%M UTC"),
        yes_no(body.is_cert_in_reportable),
        yes_no(body.is_personal_data_breach),
        if body.is_personal_data_breach {
            format!(
                " ({}; about {} people)",
                body.breach_data_categories.join(", "),
                body.principals_affected_estimate
                    .map_or_else(|| "an unknown number of".to_owned(), |n| n.to_string())
            )
        } else {
            String::new()
        }
    );
    record(&mut tx, &claims, id, "assessment", &summary).await?;
    tx.commit().await?;
    Ok(Json(row.with_deadlines()))
}

const fn yes_no(b: bool) -> &'static str {
    if b { "yes" } else { "no" }
}

/// What a notice kind requires and which column records it.
fn notice_rule(kind: &str) -> Result<(&'static str, bool), AppError> {
    Ok(match kind {
        "cert_in" => ("CERT-In report", true),
        "board_initial" => ("Board intimation", false),
        "board_report" => ("Board detailed report", false),
        "principals" => ("Notice to affected people", false),
        _ => {
            return Err(AppError::BadRequest(
                "Unknown notice. Use cert_in, board_initial, board_report or principals.".into(),
            ));
        }
    })
}

/// Whether this notice was already recorded on the incident.
fn already_sent(incident: &SecurityIncident, kind: &str) -> Option<DateTime<Utc>> {
    match kind {
        "cert_in" => incident.cert_in_report_date,
        "board_initial" => incident.board_intimated_at,
        "board_report" => incident.board_report_sent_at,
        _ => incident.principals_notified_at,
    }
}

/// `POST /api/security/incidents/{id}/notices` — record that a notice went out. Write-once.
pub async fn record_notice(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<RecordNoticeRequest>,
) -> Result<Json<SecurityIncident>, AppError> {
    require_permission(&claims, permissions::security::breach::MANAGE)?;
    let (label, is_cert_in) = notice_rule(&body.kind)?;
    let now = Utc::now();
    let sent_at = body.sent_at.unwrap_or(now);
    if sent_at > now + Duration::minutes(CLOCK_SKEW_MINUTES) {
        return Err(AppError::BadRequest(
            "A notice cannot be sent in the future.".into(),
        ));
    }
    let count = body.count.filter(|n| *n > 0);
    if body.kind == "principals" && count.is_none() {
        return Err(AppError::BadRequest(
            "Say how many people were notified.".into(),
        ));
    }
    let reference = body
        .reference
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty());

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let incident = locked_incident(&mut tx, claims.tenant_id, id)
        .await?
        .with_deadlines();

    let applies = if is_cert_in {
        incident.is_cert_in_reportable
    } else {
        incident.is_personal_data_breach
    };
    if !applies {
        return Err(AppError::Conflict(format!(
            "Assess the incident as {} first.",
            if is_cert_in {
                "CERT-In reportable"
            } else {
                "a personal-data breach"
            }
        )));
    }
    if let Some(at) = already_sent(&incident, &body.kind) {
        return Err(AppError::Conflict(format!(
            "The {label} was already recorded at {}.",
            at.format("%d %b %Y %H:%M UTC")
        )));
    }
    if incident.discovered_at.is_some_and(|d| sent_at < d) {
        return Err(AppError::BadRequest(
            "A notice cannot be sent before the incident was noticed.".into(),
        ));
    }

    let row = sqlx::query_as::<_, SecurityIncident>(
        "UPDATE security_incidents SET \
         cert_in_reported = cert_in_reported OR $3 = 'cert_in', \
         cert_in_report_date = CASE WHEN $3 = 'cert_in' THEN $4 ELSE cert_in_report_date END, \
         cert_in_reference = CASE WHEN $3 = 'cert_in' THEN $5 ELSE cert_in_reference END, \
         board_intimated_at = CASE WHEN $3 = 'board_initial' THEN $4 ELSE board_intimated_at END, \
         board_report_sent_at = CASE WHEN $3 = 'board_report' THEN $4 ELSE board_report_sent_at END, \
         board_reference = CASE WHEN $3 IN ('board_initial', 'board_report') \
                                THEN COALESCE($5, board_reference) ELSE board_reference END, \
         principals_notified_at = CASE WHEN $3 = 'principals' THEN $4 ELSE principals_notified_at END, \
         principals_notified_count = CASE WHEN $3 = 'principals' THEN $6 \
                                          ELSE principals_notified_count END \
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.kind)
    .bind(sent_at)
    .bind(reference)
    .bind(count)
    .fetch_one(&mut *tx)
    .await?;

    let due = if is_cert_in {
        incident.cert_in_due_at
    } else {
        incident
            .board_due_at
            .filter(|_| body.kind == "board_report")
    };
    let timing = due.map_or_else(String::new, |d| {
        if sent_at <= d {
            " — within the deadline".to_owned()
        } else {
            format!(" — {} h late", (sent_at - d).num_hours().max(1))
        }
    });
    let summary = format!(
        "{label} sent {}{}{}{}",
        sent_at.format("%d %b %Y %H:%M UTC"),
        reference.map_or_else(String::new, |r| format!(", ref {r}")),
        count.map_or_else(String::new, |n| format!(", {n} people")),
        timing
    );
    record(&mut tx, &claims, id, &body.kind, &summary).await?;
    tx.commit().await?;
    Ok(Json(row.with_deadlines()))
}

#[cfg(test)]
mod tests {
    use super::{AssessBreachRequest, validate_assessment};
    use chrono::{Duration, Utc};

    fn body(breach: bool, categories: &[&str]) -> AssessBreachRequest {
        AssessBreachRequest {
            discovered_at: Utc::now(),
            is_cert_in_reportable: true,
            is_personal_data_breach: breach,
            breach_data_categories: categories.iter().map(|c| (*c).to_owned()).collect(),
            principals_affected_estimate: Some(120),
        }
    }

    #[test]
    fn a_breach_names_its_data() {
        let now = Utc::now();
        assert!(validate_assessment(&body(true, &["health_records"]), now).is_ok());
        assert!(validate_assessment(&body(true, &[]), now).is_err());
        assert!(validate_assessment(&body(true, &["gossip"]), now).is_err());
        assert!(validate_assessment(&body(false, &[]), now).is_ok());
    }

    #[test]
    fn the_clock_cannot_start_in_the_future() {
        let mut b = body(false, &[]);
        b.discovered_at = Utc::now() + Duration::hours(2);
        assert!(validate_assessment(&b, Utc::now()).is_err());
    }
}

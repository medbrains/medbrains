//! What an MLC records beyond the register line — the examination, the
//! incident, the police officer who came — and the rule that a certified
//! case is amended, never silently edited.
//!
//! These columns print on the MLC register and the wound certificate. Until
//! this module nothing wrote them, so both printed blank.

use chrono::{DateTime, Duration, Utc};
use medbrains_core::emergency::{
    MLC_CLINICAL_COURSE_FIELD, MLC_INCIDENT_DETAILS_FIELD, MLC_POLICE_OFFICER_FIELD, MlcCase,
    MlcStatus,
};
use medbrains_core::permissions;
use medbrains_db::audit::{AuditEntry, AuditLogger};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::validation::ValidationErrors;
use serde::Deserialize;
use serde_json::{Map, Value, json};
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

/// Clocks on ward PCs drift; a time a few minutes "ahead" is not the future.
const CLOCK_SKEW_MINUTES: i64 = 5;
/// An amendment reason short enough to be "edit" or "typo" says nothing a
/// court could weigh.
const MIN_AMENDMENT_REASON_CHARS: usize = 10;

/// The examination and incident fields, shared by create and update.
#[derive(Debug, Default, Deserialize)]
pub struct MlcRecordFields {
    pub examining_doctor_id: Option<Uuid>,
    pub examined_at: Option<DateTime<Utc>>,
    pub date_time_of_incident: Option<DateTime<Utc>>,
    pub place_of_incident: Option<String>,
    pub weapon_used: Option<String>,
    pub police_officer_name: Option<String>,
    pub police_officer_rank: Option<String>,
    pub police_dd_number: Option<String>,
    pub condition_on_arrival: Option<String>,
    pub treatment_given: Option<String>,
    pub samples_handed_to: Option<String>,
    pub patient_condition_at_discharge: Option<String>,
}

fn non_blank(value: Option<String>) -> Option<String> {
    value.map(|v| v.trim().to_owned()).filter(|v| !v.is_empty())
}

impl MlcRecordFields {
    /// Which field-access groups this write touches, for
    /// `reject_restricted_mlc_field_writes`: `(key, label, written)`.
    pub const fn restricted_writes(&self) -> [(&'static str, &'static str, bool); 3] {
        [
            (
                MLC_POLICE_OFFICER_FIELD,
                "police officer",
                self.police_officer_name.is_some()
                    || self.police_officer_rank.is_some()
                    || self.police_dd_number.is_some(),
            ),
            (
                MLC_INCIDENT_DETAILS_FIELD,
                "incident details",
                self.date_time_of_incident.is_some()
                    || self.place_of_incident.is_some()
                    || self.weapon_used.is_some(),
            ),
            (
                MLC_CLINICAL_COURSE_FIELD,
                "clinical course",
                self.condition_on_arrival.is_some()
                    || self.treatment_given.is_some()
                    || self.samples_handed_to.is_some()
                    || self.patient_condition_at_discharge.is_some(),
            ),
        ]
    }

    /// Blank text means "not given", never "erase what is on file".
    #[must_use]
    pub fn normalized(self) -> Self {
        Self {
            place_of_incident: non_blank(self.place_of_incident),
            weapon_used: non_blank(self.weapon_used),
            police_officer_name: non_blank(self.police_officer_name),
            police_officer_rank: non_blank(self.police_officer_rank),
            police_dd_number: non_blank(self.police_dd_number),
            condition_on_arrival: non_blank(self.condition_on_arrival),
            treatment_given: non_blank(self.treatment_given),
            samples_handed_to: non_blank(self.samples_handed_to),
            patient_condition_at_discharge: non_blank(self.patient_condition_at_discharge),
            ..self
        }
    }

    /// The time rules a court would test: nothing in the future, the
    /// incident before the registration, the examination after the incident.
    /// `current_*` are the values already on file (none on create).
    pub fn validate_times(
        &self,
        current_incident: Option<DateTime<Utc>>,
        current_examined: Option<DateTime<Utc>>,
        registered_at: DateTime<Utc>,
        now: DateTime<Utc>,
    ) -> Result<(), AppError> {
        let skew = Duration::minutes(CLOCK_SKEW_MINUTES);
        let mut errors = ValidationErrors::new();
        if let Some(incident) = self.date_time_of_incident {
            if incident > now + skew {
                errors.add(
                    "date_time_of_incident",
                    "The incident cannot be in the future.",
                );
            } else if incident > registered_at + skew {
                errors.add(
                    "date_time_of_incident",
                    "The incident cannot be after the MLC was registered.",
                );
            }
        }
        if let Some(examined) = self.examined_at
            && examined > now + skew
        {
            errors.add(
                "examined_at",
                "The examination time cannot be in the future.",
            );
        }
        let incident = self.date_time_of_incident.or(current_incident);
        let examined = self.examined_at.or(current_examined);
        let touched = self.date_time_of_incident.is_some() || self.examined_at.is_some();
        if touched
            && let (Some(incident), Some(examined)) = (incident, examined)
            && examined < incident
        {
            errors.add(
                "examined_at",
                "The examination cannot be before the incident.",
            );
        }
        if errors.has_errors() {
            return Err(AppError::ValidationFailed(errors));
        }
        Ok(())
    }
}

/// The examining doctor must be an active doctor of this hospital — the
/// certificate prints their name and registration number.
pub async fn ensure_examining_doctor(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    doctor_id: Option<Uuid>,
) -> Result<(), AppError> {
    let Some(doctor_id) = doctor_id else {
        return Ok(());
    };
    let is_doctor = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND tenant_id = $2 \
           AND role = 'doctor' AND is_active = true)",
    )
    .bind(doctor_id)
    .bind(tenant_id)
    .fetch_one(&mut **tx)
    .await?;
    if is_doctor {
        return Ok(());
    }
    let mut errors = ValidationErrors::new();
    errors.add(
        "examining_doctor_id",
        "Choose an active doctor as the examining doctor.",
    );
    Err(AppError::ValidationFailed(errors))
}

/// Opinion given, in court or closed: the record has been relied on.
pub const fn is_certified(status: &MlcStatus) -> bool {
    matches!(
        status,
        MlcStatus::OpinionGiven | MlcStatus::CourtPending | MlcStatus::Closed
    )
}

const fn status_code(status: &MlcStatus) -> &'static str {
    match status {
        MlcStatus::Registered => "registered",
        MlcStatus::UnderInvestigation => "under_investigation",
        MlcStatus::OpinionGiven => "opinion_given",
        MlcStatus::CourtPending => "court_pending",
        MlcStatus::Closed => "closed",
    }
}

/// The fields an update would actually change, as `(old, new)` maps.
/// A value resent unchanged (forms send everything) is not a change.
#[derive(Debug, Default)]
pub struct MlcChanges {
    pub old: Map<String, Value>,
    pub new: Map<String, Value>,
}

impl MlcChanges {
    pub fn text(&mut self, field: &str, current: Option<&str>, proposed: Option<&str>) {
        if let Some(proposed) = proposed
            && current != Some(proposed)
        {
            self.old.insert(field.to_owned(), json!(current));
            self.new.insert(field.to_owned(), json!(proposed));
        }
    }

    pub fn value<T: PartialEq + serde::Serialize>(
        &mut self,
        field: &str,
        current: Option<&T>,
        proposed: Option<&T>,
    ) {
        if let Some(proposed) = proposed
            && current != Some(proposed)
        {
            self.old.insert(field.to_owned(), json!(current));
            self.new.insert(field.to_owned(), json!(proposed));
        }
    }

    /// Moving a certified case back to an open status reopens evidence.
    pub fn status(&mut self, current: &MlcStatus, proposed: Option<&str>) {
        let Some(proposed) = proposed else { return };
        let reopens =
            is_certified(current) && matches!(proposed, "registered" | "under_investigation");
        if reopens {
            self.old
                .insert("status".to_owned(), json!(status_code(current)));
            self.new.insert("status".to_owned(), json!(proposed));
        }
    }

    /// The examination/incident fields of one update.
    pub fn record(&mut self, current: &MlcCase, fields: &MlcRecordFields) {
        self.value(
            "examining_doctor_id",
            current.examining_doctor_id.as_ref(),
            fields.examining_doctor_id.as_ref(),
        );
        self.value(
            "examined_at",
            current.examined_at.as_ref(),
            fields.examined_at.as_ref(),
        );
        self.value(
            "date_time_of_incident",
            current.date_time_of_incident.as_ref(),
            fields.date_time_of_incident.as_ref(),
        );
        let texts: [(&str, Option<&String>, Option<&String>); 9] = [
            (
                "place_of_incident",
                current.place_of_incident.as_ref(),
                fields.place_of_incident.as_ref(),
            ),
            (
                "weapon_used",
                current.weapon_used.as_ref(),
                fields.weapon_used.as_ref(),
            ),
            (
                "police_officer_name",
                current.police_officer_name.as_ref(),
                fields.police_officer_name.as_ref(),
            ),
            (
                "police_officer_rank",
                current.police_officer_rank.as_ref(),
                fields.police_officer_rank.as_ref(),
            ),
            (
                "police_dd_number",
                current.police_dd_number.as_ref(),
                fields.police_dd_number.as_ref(),
            ),
            (
                "condition_on_arrival",
                current.condition_on_arrival.as_ref(),
                fields.condition_on_arrival.as_ref(),
            ),
            (
                "treatment_given",
                current.treatment_given.as_ref(),
                fields.treatment_given.as_ref(),
            ),
            (
                "samples_handed_to",
                current.samples_handed_to.as_ref(),
                fields.samples_handed_to.as_ref(),
            ),
            (
                "patient_condition_at_discharge",
                current.patient_condition_at_discharge.as_ref(),
                fields.patient_condition_at_discharge.as_ref(),
            ),
        ];
        for (field, old, new) in texts {
            self.text(field, old.map(String::as_str), new.map(String::as_str));
        }
    }
}

/// A certified MLC changes only as an amendment: by a holder of
/// `emergency.mlc.amend`, with a reason, written to the hash-chained audit
/// log with the before and after. Anything else on a certified case is
/// refused. An uncertified case passes untouched.
pub async fn enforce_amendment(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    current: &MlcCase,
    changes: MlcChanges,
    reason: Option<&str>,
) -> Result<(), AppError> {
    if !is_certified(&current.status) || changes.new.is_empty() {
        return Ok(());
    }
    require_permission(claims, permissions::emergency::mlc::AMEND)?;
    let reason = reason.map(str::trim).unwrap_or_default();
    if reason.chars().count() < MIN_AMENDMENT_REASON_CHARS {
        let mut errors = ValidationErrors::new();
        errors.add(
            "amendment_reason",
            format!(
                "This MLC is {} and is legal evidence. Say why it is being amended \
                 (at least {MIN_AMENDMENT_REASON_CHARS} characters).",
                status_code(&current.status).replace('_', " ")
            ),
        );
        return Err(AppError::ValidationFailed(errors));
    }
    let old = Value::Object(changes.old);
    let mut new = changes.new;
    new.insert("amendment_reason".to_owned(), json!(reason));
    let new = Value::Object(new);
    AuditLogger::log(
        tx,
        &AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action: "mlc_case.amend",
            entity_type: "mlc_case",
            entity_id: Some(current.id),
            old_values: Some(&old),
            new_values: Some(&new),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{MlcChanges, MlcRecordFields, is_certified};
    use chrono::{Duration, Utc};
    use medbrains_core::emergency::MlcStatus;

    #[test]
    fn the_time_rules_hold() {
        let now = Utc::now();
        let registered = now - Duration::hours(2);
        let future = MlcRecordFields {
            examined_at: Some(now + Duration::hours(1)),
            ..MlcRecordFields::default()
        };
        assert!(future.validate_times(None, None, registered, now).is_err());

        let after_registration = MlcRecordFields {
            date_time_of_incident: Some(now - Duration::hours(1)),
            ..MlcRecordFields::default()
        };
        assert!(
            after_registration
                .validate_times(None, None, registered, now)
                .is_err()
        );

        let examined_before_incident = MlcRecordFields {
            examined_at: Some(now - Duration::hours(5)),
            ..MlcRecordFields::default()
        };
        let on_file_incident = Some(now - Duration::hours(3));
        assert!(
            examined_before_incident
                .validate_times(on_file_incident, None, registered, now)
                .is_err()
        );

        let fine = MlcRecordFields {
            date_time_of_incident: Some(now - Duration::hours(3)),
            examined_at: Some(now - Duration::hours(1)),
            ..MlcRecordFields::default()
        };
        assert!(fine.validate_times(None, None, registered, now).is_ok());
    }

    #[test]
    fn an_unchanged_resend_is_not_an_amendment() {
        let mut changes = MlcChanges::default();
        changes.text("weapon_used", Some("knife"), Some("knife"));
        changes.text("weapon_used", Some("knife"), None);
        assert!(changes.new.is_empty());
        changes.text("weapon_used", Some("knife"), Some("blunt object"));
        assert_eq!(changes.new.len(), 1);
    }

    #[test]
    fn reopening_a_certified_case_is_an_amendment() {
        let mut changes = MlcChanges::default();
        changes.status(&MlcStatus::Closed, Some("closed"));
        assert!(changes.new.is_empty());
        changes.status(&MlcStatus::Closed, Some("under_investigation"));
        assert!(!changes.new.is_empty());
        assert!(is_certified(&MlcStatus::OpinionGiven));
        assert!(!is_certified(&MlcStatus::UnderInvestigation));
    }
}

//! What one import batch knows while it runs: the hospital's masters (loaded
//! once, not per record), the records earlier batches brought in, the go-live
//! cut-over, and every problem found so far.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use medbrains_server_core::error::AppError;

use crate::Kind;

/// One problem with one record, as the person who prepared the file will find it.
#[derive(Debug, Clone, Serialize)]
pub(crate) struct Problem {
    /// 1-based position of the record in the upload.
    pub(crate) record: usize,
    pub(crate) kind: Kind,
    pub(crate) external_id: String,
    pub(crate) field: &'static str,
    pub(crate) message: String,
}

/// A record imported earlier that later records point at.
#[derive(Debug, Clone, Copy)]
pub(crate) struct Ref {
    pub(crate) id: Uuid,
    pub(crate) patient: Uuid,
    pub(crate) encounter: Option<Uuid>,
    pub(crate) admission: Option<Uuid>,
    pub(crate) at: DateTime<Utc>,
}

pub(crate) struct Ctx<'t> {
    pub(crate) tx: Transaction<'t, Postgres>,
    pub(crate) tenant: Uuid,
    pub(crate) user: Uuid,
    pub(crate) batch: Uuid,
    pub(crate) go_live: DateTime<Utc>,
    pub(crate) now: DateTime<Utc>,
    /// The hospital's time zone, for the calendar date of an event.
    pub(crate) tz: String,
    pub(crate) problems: Vec<Problem>,
    pub(crate) departments: HashMap<String, Uuid>,
    pub(crate) doctors: HashMap<String, Uuid>,
    pub(crate) lab_tests: HashMap<String, (Uuid, String)>,
    pub(crate) drugs: HashMap<String, (Uuid, String)>,
    pub(crate) refs: HashMap<(Kind, String), Ref>,
    pub(crate) patients_by_uhid: HashMap<String, Uuid>,
    /// UHIDs reserved for this batch's new patients, handed out in order.
    pub(crate) uhids: std::vec::IntoIter<String>,
    /// Position and identity of the record being processed.
    pub(crate) at: (usize, Kind, String),
}

impl std::fmt::Debug for Ctx<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Ctx")
            .field("batch", &self.batch)
            .field("problems", &self.problems.len())
            .finish_non_exhaustive()
    }
}

impl Ctx<'_> {
    pub(crate) fn problem(&mut self, field: &'static str, message: impl Into<String>) {
        let (record, kind, external_id) = self.at.clone();
        self.problems.push(Problem {
            record,
            kind,
            external_id,
            field,
            message: message.into(),
        });
    }

    /// A past moment inside the history period: before go-live and not in the future.
    pub(crate) fn past(&mut self, field: &'static str, at: DateTime<Utc>) -> bool {
        if at >= self.go_live {
            self.problem(
                field,
                format!(
                    "{at} is on or after go-live ({}); history must end before it",
                    self.go_live
                ),
            );
            return false;
        }
        if at > self.now {
            self.problem(field, "A historical record cannot be dated in the future");
            return false;
        }
        true
    }

    /// `later` must not come before `earlier` (a discharge before its admission, a payment before its bill).
    pub(crate) fn in_order(
        &mut self,
        field: &'static str,
        earlier: DateTime<Utc>,
        later: DateTime<Utc>,
    ) -> bool {
        if later < earlier {
            self.problem(field, format!("{later} is before {earlier}"));
            return false;
        }
        true
    }

    pub(crate) fn department(&mut self, code: &str) -> Option<Uuid> {
        let found = self.departments.get(&code.trim().to_uppercase()).copied();
        if found.is_none() {
            self.problem("department", format!("No department has the code {code}"));
        }
        found
    }

    pub(crate) fn doctor(&mut self, username: &str) -> Option<Uuid> {
        let found = self.doctors.get(&username.trim().to_lowercase()).copied();
        if found.is_none() {
            self.problem(
                "doctor",
                format!("No active doctor has the username {username}"),
            );
        }
        found
    }

    /// A patient by the import id an earlier patient record carried (with the
    /// date the old system registered them), or by the UHID of a patient
    /// registered here — whose earlier history may well predate that registration.
    pub(crate) fn patient(&mut self, key: &str) -> Option<(Uuid, Option<DateTime<Utc>>)> {
        if let Some(r) = self.refs.get(&(Kind::Patient, key.to_owned())) {
            return Some((r.id, Some(r.at)));
        }
        let found = self.patients_by_uhid.get(key).copied();
        if found.is_none() {
            self.problem(
                "patient",
                format!("No patient has the UHID or import id {key}"),
            );
        }
        found.map(|id| (id, None))
    }

    /// The event must not come before the old system registered the patient.
    pub(crate) fn after_registration(
        &mut self,
        registered: Option<DateTime<Utc>>,
        at: DateTime<Utc>,
    ) -> bool {
        match registered {
            Some(reg) if at < reg => {
                self.problem(
                    "patient",
                    format!("The patient was registered on {reg}, after this record"),
                );
                false
            }
            _ => true,
        }
    }

    /// The visit or admission a record belongs to; it must be the same patient's.
    pub(crate) fn episode(
        &mut self,
        visit: Option<&String>,
        admission: Option<&String>,
        patient: Uuid,
    ) -> Option<Ref> {
        let found = match (visit, admission) {
            (Some(v), None) => self.refs.get(&(Kind::Visit, v.clone())).copied(),
            (None, Some(a)) => self.refs.get(&(Kind::Admission, a.clone())).copied(),
            _ => {
                self.problem(
                    "visit / admission",
                    "Name exactly one visit or one admission",
                );
                return None;
            }
        };
        let Some(found) = found else {
            self.problem(
                "visit / admission",
                "That visit or admission has not been imported",
            );
            return None;
        };
        if found.patient != patient {
            self.problem(
                "patient",
                "The visit or admission belongs to a different patient",
            );
            return None;
        }
        Some(found)
    }

    pub(crate) fn remember(&mut self, kind: Kind, external_id: &str, r: Ref) {
        self.refs.insert((kind, external_id.to_owned()), r);
    }

    /// Provenance row: which batch brought this record in, and what it became.
    pub(crate) async fn record_provenance(
        &mut self,
        table: &str,
        target: Uuid,
        occurred_at: DateTime<Utc>,
    ) -> Result<(), AppError> {
        let (_, kind, external_id) = &self.at;
        sqlx::query(
            "INSERT INTO history_import_records (tenant_id, batch_id, kind, external_id, target_table, target_id, occurred_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(self.tenant)
        .bind(self.batch)
        .bind(kind.as_str())
        .bind(external_id)
        .bind(table)
        .bind(target)
        .bind(occurred_at)
        .execute(&mut *self.tx)
        .await?;
        Ok(())
    }
}

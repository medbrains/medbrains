//! What is waiting for the signed-in person across their apps: `GET /api/users/me/work`.
//!
//! The launcher's "Needs you now" and "Waiting for you" sections. Every item is the caller's
//! own work (critical values notified or escalated to them, their OPD queue today, their draft
//! notes, the approvals assigned to them), never a hospital-wide total, so an admin who passes
//! every permission still sees only their own (owner, 2026-11-17).
//!
//! - An item shows only while the caller holds every permission of the screen it opens and its
//!   brick is on. Otherwise it is left out, so the answer does not reveal which modules exist.
//!   A brick whose switch cannot be read makes its item `failed`, never absent.
//! - Items run one after another on one connection, each in its own savepoint under a
//!   [`ITEM_TIMEOUT`] statement timeout (docs/DECISIONS.md): one connection per page view, not
//!   one per item. A failure is that item's `failed` with no count, never a 0.
//! - The critical item may name the patient, and only after `require_patient_access` passes
//!   for that patient. The name is read with the count but never leaves the server otherwise.
//!
//! The route sits under `/api/users/me/`, which an API key can never reach.

use axum::Json;
use axum::extract::{Extension, State};
use medbrains_core::permissions;
use medbrains_kernel::authz::is_bypass_role;
use medbrains_kernel::{Actor, Outcome};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::entitlement::module_entitlement;
use medbrains_server_core::state::AppState;
use serde::Serialize;
use sqlx::{PgConnection, PgPool};

pub mod items;

use items::{COUNT_CEILING, Count, Detail, Key, PatientLabel};

/// The longest one item's query may run before it is cancelled and shown as `failed`.
pub const ITEM_TIMEOUT: &str = "150ms";

/// Which launcher section an item belongs in. Fixed in code: safety items always come first.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Section {
    Now,
    Waiting,
}

/// How loudly the launcher shows a non-zero count.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Severity {
    Critical,
    Info,
}

/// Whether an item's count could be read. There is no third state: a hidden item is absent.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Ok,
    Failed,
}

/// One item's fixed description: what it counts, where it opens, and who may see it.
#[derive(Debug)]
pub struct Spec {
    pub key: Key,
    pub name: &'static str,
    pub brick: Option<&'static str>,
    pub section: Section,
    pub severity: Severity,
    /// Every permission the item needs: its list's read code and the screen it opens.
    pub needs: &'static [&'static str],
    pub href: &'static str,
}

/// Every item, in the order the launcher shows them.
pub const SPECS: &[Spec] = &[
    Spec {
        key: Key::LabCritical,
        name: "lab_critical",
        brick: Some("lab"),
        section: Section::Now,
        severity: Severity::Critical,
        // Listing critical values, acknowledging one, and the inbox that does it.
        needs: &[
            permissions::lab::orders::LIST,
            permissions::lab::results::UPDATE,
            permissions::doctor::signoffs::VIEW_OWN,
        ],
        href: "/doctor/signoffs",
    },
    Spec {
        key: Key::OpdWaiting,
        name: "opd_waiting",
        brick: Some("opd"),
        section: Section::Waiting,
        severity: Severity::Info,
        needs: &[permissions::opd::queue::LIST],
        href: "/opd",
    },
    Spec {
        key: Key::NotesUnsigned,
        name: "notes_unsigned",
        brick: Some("opd"),
        section: Section::Waiting,
        severity: Severity::Info,
        needs: &[
            permissions::clinical_notes::WRITE,
            permissions::doctor::signoffs::VIEW_OWN,
        ],
        href: "/doctor/signoffs",
    },
    Spec {
        key: Key::Approvals,
        name: "approvals",
        brick: None,
        section: Section::Waiting,
        severity: Severity::Info,
        // The inbox is everyone's own queue; it has no permission (navigation.ts).
        needs: &[],
        href: "/approvals",
    },
];

/// One item as the launcher shows it. `count` is set only when `status` is `ok`.
#[derive(Debug, Serialize)]
pub struct WorkItem {
    pub key: &'static str,
    pub brick: Option<&'static str>,
    pub section: Section,
    pub severity: Severity,
    pub status: Status,
    pub count: Option<i64>,
    /// The count stopped at the ceiling: show it as "99+".
    pub capped: bool,
    pub detail: Option<Detail>,
    pub href: &'static str,
    #[serde(skip)]
    subject: Option<(uuid::Uuid, PatientLabel)>,
}

/// `GET /api/users/me/work`.
#[derive(Debug, Serialize)]
pub struct WorkResponse {
    pub items: Vec<WorkItem>,
}

/// Whether the caller holds every permission the item needs. Bypass roles hold them all; the
/// item's own scope still limits them to their own work.
fn holds_all(spec: &Spec, claims: &Claims) -> bool {
    is_bypass_role(claims)
        || spec
            .needs
            .iter()
            .all(|need| claims.permissions.iter().any(|held| held == need))
}

/// The items this caller may see, each with its brick's switch. A brick that is off drops the
/// item; one that cannot be read keeps it as `Unknown`, so it shows as `failed`.
pub async fn plan(db: &PgPool, claims: &Claims) -> Vec<(&'static Spec, Outcome)> {
    let mut planned = Vec::with_capacity(SPECS.len());
    for spec in SPECS.iter().filter(|spec| holds_all(spec, claims)) {
        let switch = match spec.brick {
            Some(code) => module_entitlement(db, claims.tenant_id, code).await,
            None => Outcome::Allow,
        };
        if switch != Outcome::Deny {
            planned.push((spec, switch));
        }
    }
    planned
}

/// Shape one item's answer for the screen: a count stopped at 99 with `capped`, or `failed`.
fn item_from(spec: &Spec, counted: Option<Count>) -> WorkItem {
    let (status, count, capped, detail, subject) = match counted {
        Some(c) => {
            let capped = c.total >= COUNT_CEILING;
            let shown = if capped { COUNT_CEILING - 1 } else { c.total };
            (Status::Ok, Some(shown), capped, c.detail, c.subject)
        }
        None => (Status::Failed, None, false, None, None),
    };
    WorkItem {
        key: spec.name,
        brick: spec.brick,
        section: spec.section,
        severity: spec.severity,
        status,
        count,
        capped,
        detail,
        href: spec.href,
        subject,
    }
}

/// Count one item inside its own savepoint, so its failure leaves the transaction usable.
async fn in_savepoint(conn: &mut PgConnection, key: Key, me: Actor) -> Result<Count, sqlx::Error> {
    let mut savepoint = sqlx::Connection::begin(&mut *conn).await?;
    match items::count(&mut savepoint, key, me).await {
        Ok(count) => {
            savepoint.commit().await?;
            Ok(count)
        }
        Err(err) => {
            if let Err(rollback) = savepoint.rollback().await {
                tracing::warn!(error = %rollback, "work item savepoint did not roll back");
            }
            Err(err)
        }
    }
}

/// Count every planned item, one after another on `conn`, which must be inside a transaction
/// with the caller's tenant context. Each item answers alone: one failure is one `failed`.
pub async fn count_all(
    conn: &mut PgConnection,
    me: Actor,
    planned: &[(&'static Spec, Outcome)],
) -> Vec<WorkItem> {
    let limit = sqlx::query_scalar!(
        r#"SELECT set_config('statement_timeout', $1, true) AS "set!""#,
        ITEM_TIMEOUT,
    )
    .fetch_one(&mut *conn)
    .await;
    if let Err(err) = limit {
        tracing::warn!(error = %err, "work items: statement timeout not set");
    }
    let mut items = Vec::with_capacity(planned.len());
    for &(spec, switch) in planned {
        let counted = match switch {
            Outcome::Allow => match in_savepoint(conn, spec.key, me).await {
                Ok(count) => Some(count),
                Err(err) => {
                    tracing::warn!(item = spec.name, error = %err, "work item did not load");
                    None
                }
            },
            Outcome::Deny | Outcome::Unknown => None,
        };
        items.push(item_from(spec, counted));
    }
    items
}

/// Name the patient on an item only when the caller may open that patient's record. A refusal
/// or an unreadable check keeps the count and the result but leaves the name out.
async fn reveal_patients(state: &AppState, claims: &Claims, items: &mut [WorkItem]) {
    for item in items.iter_mut() {
        let Some((patient_id, label)) = item.subject.take() else {
            continue;
        };
        let access =
            medbrains_health_services::patient::require_patient_access(state, claims, patient_id)
                .await;
        match (access, item.detail.as_mut()) {
            (Ok(()), Some(Detail::CriticalResult { patient, .. })) => *patient = Some(label),
            (Ok(()) | Err(AppError::Forbidden | AppError::NotFound), _) => {}
            (Err(err), _) => {
                tracing::warn!(item = item.key, error = %err, "patient access unknown: name left out");
            }
        }
    }
}

/// GET /api/users/me/work — the caller's work counts, each item `ok` or `failed`.
///
/// Always 200 with an `items` array: when the transaction cannot open, every item the caller
/// may see is `failed`, so the screen says "didn't load" item by item rather than nothing.
pub async fn get_my_work(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Json<WorkResponse> {
    let planned = plan(&state.db, &claims).await;
    let mut items = if planned.is_empty() {
        Vec::new()
    } else {
        match medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await {
            Ok(mut tx) => count_all(&mut tx, Actor::from_claims(&claims), &planned).await,
            Err(err) => {
                tracing::warn!(error = %err, "work items: no transaction");
                planned
                    .iter()
                    .map(|&(spec, _)| item_from(spec, None))
                    .collect()
            }
        }
    };
    reveal_patients(&state, &claims, &mut items).await;
    Json(WorkResponse { items })
}

#[cfg(test)]
mod tests {
    use super::{Count, SPECS, Section, Status, item_from};

    #[test]
    fn a_count_past_the_ceiling_shows_as_99_plus() {
        let spec = &SPECS[1];
        let full = item_from(
            spec,
            Some(Count {
                total: 100,
                detail: None,
                subject: None,
            }),
        );
        assert_eq!((full.count, full.capped), (Some(99), true));
        let some = item_from(
            spec,
            Some(Count {
                total: 7,
                detail: None,
                subject: None,
            }),
        );
        assert_eq!((some.count, some.capped), (Some(7), false));
    }

    #[test]
    fn a_failed_item_has_no_count() {
        let failed = item_from(&SPECS[0], None);
        assert_eq!((failed.status, failed.count), (Status::Failed, None));
    }

    #[test]
    fn only_critical_items_sit_in_needs_you_now() {
        for spec in SPECS {
            assert_eq!(spec.section == Section::Now, spec.name == "lab_critical");
        }
    }
}

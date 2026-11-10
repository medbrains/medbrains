//! Hospital-wide questions ("which allergies are common here?") answered from
//! a closed list of approved counts, never from patient rows.
//!
//! Every count runs over exactly the patients the user may see
//! ([`visible_patient_ids`]: everyone for a bypass role, the batched access
//! set otherwise, and an outage is "could not check", never zero). Restricted
//! classes are withheld row by row. A user who cannot list patients sees a
//! count under [`SMALL`] as `"<5"`, so a statistic cannot single anyone out;
//! a user who can list them gets exact counts and a drill-down to the
//! patients behind a row, which the screen fetches itself — names and UHIDs
//! never pass through the model.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use axum::extract::{Path, Query, State};
use axum::{Extension, Json};
use chrono::NaiveDate;
use medbrains_authz_gate::visible_patient_ids;
use medbrains_core::permissions;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::{error::AppError, state::AppState};
use serde_json::{Value, json};
use uuid::Uuid;

/// Counts below this are shown as `"<5"` to a user who cannot list patients.
const SMALL: i64 = 5;
/// Rows one aggregate returns (the most common first).
const TOP: i64 = 20;
/// Patients one drill-down lists.
const MAX_PATIENTS: i64 = 200;

/// The approved counts, and only these.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Metric {
    Allergies,
    Diagnoses,
    OpdByDepartment,
    AdmissionsByDay,
    CriticalLabAlerts,
}

impl Metric {
    pub(super) fn parse(name: &str) -> Option<Self> {
        Some(match name {
            "allergies" => Self::Allergies,
            "diagnoses" => Self::Diagnoses,
            "opd_visits_by_department" => Self::OpdByDepartment,
            "admissions_by_day" => Self::AdmissionsByDay,
            "critical_lab_alerts" => Self::CriticalLabAlerts,
            _ => return None,
        })
    }

    pub(super) const fn name(self) -> &'static str {
        match self {
            Self::Allergies => "allergies",
            Self::Diagnoses => "diagnoses",
            Self::OpdByDepartment => "opd_visits_by_department",
            Self::AdmissionsByDay => "admissions_by_day",
            Self::CriticalLabAlerts => "critical_lab_alerts",
        }
    }

    /// The row's key field and its count field, as the model and widget see them.
    pub(super) const fn fields(self) -> (&'static str, &'static str) {
        match self {
            Self::Allergies => ("allergen", "patients"),
            Self::Diagnoses => ("icd_code", "patients"),
            Self::OpdByDepartment => ("department", "visits"),
            Self::AdmissionsByDay => ("date", "admissions"),
            Self::CriticalLabAlerts => ("parameter", "alerts"),
        }
    }

    /// `(key, label, count)` rows over the visible patients in `[from, to]`.
    const fn counts_sql(self) -> &'static str {
        match self {
            // All-time: an allergy is a standing fact, not an event in a range.
            Self::Allergies => {
                "SELECT lower(trim(a.allergen_name)) AS key, MIN(a.allergen_name) AS label, \
                   COUNT(DISTINCT a.patient_id) AS n \
                 FROM patient_allergies a \
                 WHERE a.tenant_id = $1 AND a.deleted_at IS NULL \
                   AND ($2::uuid[] IS NULL OR a.patient_id = ANY($2)) \
                   AND $3::date IS NOT NULL AND $4::date IS NOT NULL \
                 GROUP BY 1 ORDER BY 3 DESC, 1 LIMIT $5"
            }
            Self::Diagnoses => {
                "SELECT d.icd_code AS key, MIN(d.description) AS label, \
                   COUNT(DISTINCT e.patient_id) AS n \
                 FROM diagnoses d JOIN encounters e ON e.id = d.encounter_id \
                 WHERE d.tenant_id = $1 AND d.deleted_at IS NULL AND e.deleted_at IS NULL \
                   AND ($2::uuid[] IS NULL OR e.patient_id = ANY($2)) \
                   AND d.created_at >= $3::date AND d.created_at < ($4::date + 1) \
                 GROUP BY 1 ORDER BY 3 DESC, 1 LIMIT $5"
            }
            Self::OpdByDepartment => {
                "SELECT COALESCE(dep.name, 'Unassigned') AS key, \
                   COALESCE(dep.name, 'Unassigned') AS label, COUNT(*) AS n \
                 FROM encounters e LEFT JOIN departments dep ON dep.id = e.department_id \
                 WHERE e.tenant_id = $1 AND e.deleted_at IS NULL AND e.encounter_type = 'opd' \
                   AND ($2::uuid[] IS NULL OR e.patient_id = ANY($2)) \
                   AND e.encounter_date >= $3::date AND e.encounter_date <= $4::date \
                 GROUP BY 1, 2 ORDER BY 3 DESC, 1 LIMIT $5"
            }
            Self::AdmissionsByDay => {
                "SELECT a.admitted_at::date::text AS key, a.admitted_at::date::text AS label, \
                   COUNT(*) AS n \
                 FROM admissions a \
                 WHERE a.tenant_id = $1 AND a.deleted_at IS NULL \
                   AND ($2::uuid[] IS NULL OR a.patient_id = ANY($2)) \
                   AND a.admitted_at >= $3::date AND a.admitted_at < ($4::date + 1) \
                 GROUP BY 1, 2 ORDER BY 1 LIMIT 400"
            }
            Self::CriticalLabAlerts => {
                "SELECT c.parameter_name AS key, c.parameter_name AS label, COUNT(*) AS n \
                 FROM lab_critical_alerts c \
                 WHERE c.tenant_id = $1 AND c.deleted_at IS NULL \
                   AND ($2::uuid[] IS NULL OR c.patient_id = ANY($2)) \
                   AND c.created_at >= $3::date AND c.created_at < ($4::date + 1) \
                 GROUP BY 1, 2 ORDER BY 3 DESC, 1 LIMIT $5"
            }
        }
    }

    /// The visible patients behind one row (`$5` = the row's key).
    const fn patients_sql(self) -> &'static str {
        match self {
            Self::Allergies => {
                "SELECT DISTINCT a.patient_id FROM patient_allergies a \
                 WHERE a.tenant_id = $1 AND a.deleted_at IS NULL \
                   AND ($2::uuid[] IS NULL OR a.patient_id = ANY($2)) \
                   AND $3::date IS NOT NULL AND $4::date IS NOT NULL \
                   AND lower(trim(a.allergen_name)) = $5"
            }
            Self::Diagnoses => {
                "SELECT DISTINCT e.patient_id FROM diagnoses d \
                 JOIN encounters e ON e.id = d.encounter_id \
                 WHERE d.tenant_id = $1 AND d.deleted_at IS NULL AND e.deleted_at IS NULL \
                   AND ($2::uuid[] IS NULL OR e.patient_id = ANY($2)) \
                   AND d.created_at >= $3::date AND d.created_at < ($4::date + 1) \
                   AND d.icd_code = $5"
            }
            Self::OpdByDepartment => {
                "SELECT DISTINCT e.patient_id FROM encounters e \
                 LEFT JOIN departments dep ON dep.id = e.department_id \
                 WHERE e.tenant_id = $1 AND e.deleted_at IS NULL AND e.encounter_type = 'opd' \
                   AND ($2::uuid[] IS NULL OR e.patient_id = ANY($2)) \
                   AND e.encounter_date >= $3::date AND e.encounter_date <= $4::date \
                   AND COALESCE(dep.name, 'Unassigned') = $5"
            }
            Self::AdmissionsByDay => {
                "SELECT DISTINCT a.patient_id FROM admissions a \
                 WHERE a.tenant_id = $1 AND a.deleted_at IS NULL \
                   AND ($2::uuid[] IS NULL OR a.patient_id = ANY($2)) \
                   AND a.admitted_at >= $3::date AND a.admitted_at < ($4::date + 1) \
                   AND a.admitted_at::date::text = $5"
            }
            Self::CriticalLabAlerts => {
                "SELECT DISTINCT c.patient_id FROM lab_critical_alerts c \
                 WHERE c.tenant_id = $1 AND c.deleted_at IS NULL \
                   AND ($2::uuid[] IS NULL OR c.patient_id = ANY($2)) \
                   AND c.created_at >= $3::date AND c.created_at < ($4::date + 1) \
                   AND c.parameter_name = $5"
            }
        }
    }
}

/// A count as the user may see it: exact, or `"<5"` when small and the user
/// cannot see the patients behind it.
pub(super) fn shown_count(n: i64, exact: bool) -> Value {
    if exact || n >= SMALL || n == 0 {
        json!(n)
    } else {
        json!(format!("<{SMALL}"))
    }
}

/// Whether the user may see the patients behind a count.
pub(super) fn can_list(claims: &Claims) -> bool {
    medbrains_server_core::middleware::authorization::BYPASS_ROLES.contains(&claims.role.as_str())
        || claims
            .permissions
            .iter()
            .any(|p| p == permissions::patients::LIST)
}

/// The rows of `metric` over `[from, to]`, as the model and the widget see
/// them, with how many restricted rows were withheld.
///
/// # Errors
/// `ServiceUnavailable` when the access set cannot be read (never an empty
/// answer); a database error.
pub(super) async fn counts(
    state: &AppState,
    claims: &Claims,
    metric: Metric,
    (from, to): (NaiveDate, NaiveDate),
) -> Result<Value, AppError> {
    let visible = visible_patient_ids(state, claims).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let rows = sqlx::query_as::<_, (String, Option<String>, i64)>(metric.counts_sql())
        .bind(claims.tenant_id)
        .bind(visible.as_deref())
        .bind(from)
        .bind(to)
        .bind(TOP)
        .fetch_all(&mut *tx)
        .await?;
    drop(tx);
    let exact = can_list(claims);
    let (key, count) = metric.fields();
    let mut rows = Value::Array(
        rows.into_iter()
            .map(|(k, label, n)| {
                let mut row = serde_json::Map::new();
                row.insert(key.to_owned(), json!(k));
                if metric == Metric::Diagnoses {
                    row.insert("description".to_owned(), json!(label));
                }
                row.insert(count.to_owned(), shown_count(n, exact));
                Value::Object(row)
            })
            .collect(),
    );
    let withheld = medbrains_core::ai_redact::sensitive::withhold_in_json(&mut rows)
        .map_err(AppError::Internal)?;
    let rows: Vec<Value> = rows
        .as_array()
        .map(|r| r.iter().filter(|v| v.is_object()).cloned().collect())
        .unwrap_or_default();
    // The period is stated here, so the model never works one out of dates.
    let period = if metric == Metric::Allergies {
        json!({ "period": "all recorded allergies" })
    } else {
        json!({
            "from": from.to_string(),
            "to": to.to_string(),
            "days_in_range": (to - from).num_days() + 1,
        })
    };
    let mut out = json!({
        "metric": metric.name(),
        "rows": rows,
        "restricted_rows_not_shown": withheld,
        "counts_are_exact": exact,
    });
    if let (Some(o), Value::Object(p)) = (out.as_object_mut(), period) {
        o.extend(p);
    }
    Ok(out)
}

#[derive(serde::Deserialize)]
pub(super) struct DrillQuery {
    key: String,
    from: NaiveDate,
    to: NaiveDate,
}

/// `GET /api/ai/aggregate/{metric}/patients?key=&from=&to=` — the visible
/// patients behind one aggregate row, for the screen's drill-down. Needs the
/// assistant and the patient-list permission; the model never sees this.
///
/// # Errors
/// 403 without either permission; 404 for an unknown metric; 503 when the
/// access set cannot be read.
pub(super) async fn drill_patients(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(metric): Path<String>,
    Query(q): Query<DrillQuery>,
) -> Result<Json<Vec<Value>>, AppError> {
    require_permission(&claims, permissions::ai::assistant::USE)?;
    require_permission(&claims, permissions::patients::LIST)?;
    let metric = Metric::parse(&metric).ok_or(AppError::NotFound)?;
    let visible = visible_patient_ids(&state, &claims).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;
    let ids = sqlx::query_scalar::<_, Uuid>(metric.patients_sql())
        .bind(claims.tenant_id)
        .bind(visible.as_deref())
        .bind(q.from)
        .bind(q.to)
        .bind(&q.key)
        .fetch_all(&mut *tx)
        .await?;
    let rows = sqlx::query_as::<_, (Uuid, String, String)>(
        "SELECT p.id, trim(concat_ws(' ', p.first_name, p.last_name)), p.uhid FROM patients p \
         WHERE p.tenant_id = $1 AND p.deleted_at IS NULL AND p.id = ANY($2) \
         ORDER BY 2 LIMIT $3",
    )
    .bind(claims.tenant_id)
    .bind(&ids)
    .bind(MAX_PATIENTS)
    .fetch_all(&mut *tx)
    .await?;
    Ok(Json(
        rows.into_iter()
            .map(|(id, name, uhid)| json!({ "patient_id": id, "name": name, "uhid": uhid }))
            .collect(),
    ))
}

#[cfg(test)]
mod tests {
    use super::{Metric, shown_count};
    use serde_json::json;

    #[test]
    fn small_counts_are_suppressed_only_for_users_who_cannot_list() {
        assert_eq!(shown_count(3, false), json!("<5"));
        assert_eq!(shown_count(3, true), json!(3));
        assert_eq!(shown_count(5, false), json!(5));
        assert_eq!(shown_count(0, false), json!(0));
    }

    #[test]
    fn only_the_approved_metrics_exist() {
        for m in [
            "allergies",
            "diagnoses",
            "opd_visits_by_department",
            "admissions_by_day",
            "critical_lab_alerts",
        ] {
            assert_eq!(Metric::parse(m).map(Metric::name), Some(m));
        }
        assert!(Metric::parse("patients").is_none());
        assert!(Metric::parse("hiv_results").is_none());
    }
}

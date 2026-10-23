//! Transfusion-transmissible infection screening, marker by marker.
//!
//! D&C Rules Schedule F Part XII-B and the NACO/NBTC standards require every
//! donation to be screened for HIV 1/2, `HBsAg`, HCV, syphilis and malaria, and
//! forbid releasing a unit until all five are non-reactive. The schema had a
//! single `tti_status` string on each component that nothing ever wrote, and
//! nothing read it before a unit was released or issued.
//!
//! The gate here is what every release path calls: marking a unit available,
//! accepting a returned unit back into stock, issuing it, and hanging it.

use std::collections::HashMap;
use std::collections::HashSet;

use axum::{
    Extension, Json,
    extract::{Path, State},
};
use chrono::{DateTime, Utc};
use medbrains_core::form::FieldAccessLevel;
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

use crate::issue_gates::audited;

/// The per-marker result. `Restricted`: a role whose field access masks or
/// hides it gets the panel withheld entirely, status included.
const TTI_RESULT_FIELD: &str = "blood_bank.tti.result";

/// The statutory panel. All five must be non-reactive before release.
pub const TTI_MARKERS: [&str; 5] = ["hiv", "hbsag", "hcv", "syphilis", "malaria"];
const RESULTS: [&str; 3] = ["non_reactive", "reactive", "indeterminate"];

fn marker_label(marker: &str) -> &str {
    match marker {
        "hiv" => "HIV 1/2",
        "hbsag" => "HBsAg",
        "hcv" => "HCV",
        "syphilis" => "syphilis",
        "malaria" => "malaria",
        other => other,
    }
}

fn labels(markers: &[String]) -> String {
    markers
        .iter()
        .map(|m| marker_label(m))
        .collect::<Vec<_>>()
        .join(", ")
}

/// Whether a donation's screening allows its units out of quarantine.
#[derive(Debug, PartialEq, Eq)]
pub enum TtiClearance {
    Cleared,
    /// Any reactive marker — final, whatever else is recorded.
    Reactive(Vec<String>),
    /// Markers not yet recorded non-reactive (missing or indeterminate).
    Incomplete(Vec<String>),
}

/// The decision, from `(marker, result)` pairs.
#[must_use]
pub fn tti_clearance(results: &[(String, String)]) -> TtiClearance {
    let by_marker: HashMap<&str, &str> = results
        .iter()
        .map(|(m, r)| (m.as_str(), r.as_str()))
        .collect();
    let reactive: Vec<String> = TTI_MARKERS
        .iter()
        .filter(|m| by_marker.get(*m) == Some(&"reactive"))
        .map(|m| (*m).to_owned())
        .collect();
    if !reactive.is_empty() {
        return TtiClearance::Reactive(reactive);
    }
    let pending: Vec<String> = TTI_MARKERS
        .iter()
        .filter(|m| by_marker.get(*m) != Some(&"non_reactive"))
        .map(|m| (*m).to_owned())
        .collect();
    if pending.is_empty() {
        TtiClearance::Cleared
    } else {
        TtiClearance::Incomplete(pending)
    }
}

async fn load_results(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    donation_id: Uuid,
) -> Result<Vec<TtiResult>, AppError> {
    Ok(sqlx::query_as::<_, TtiResult>(
        "SELECT id, donation_id, marker, result, method, kit_lot, notes, tested_by, tested_at \
           FROM blood_tti_results \
          WHERE tenant_id = $1 AND donation_id = $2 AND deleted_at IS NULL \
          ORDER BY marker",
    )
    .bind(tenant_id)
    .bind(donation_id)
    .fetch_all(&mut **tx)
    .await?)
}

fn clearance_of(rows: &[TtiResult]) -> TtiClearance {
    let pairs: Vec<(String, String)> = rows
        .iter()
        .map(|r| (r.marker.clone(), r.result.clone()))
        .collect();
    tti_clearance(&pairs)
}

/// Refuse (409) unless every marker of the donation is non-reactive.
pub(crate) async fn require_tti_cleared(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    donation_id: Uuid,
) -> Result<(), AppError> {
    match clearance_of(&load_results(tx, tenant_id, donation_id).await?) {
        TtiClearance::Cleared => Ok(()),
        TtiClearance::Reactive(m) => Err(AppError::Conflict(format!(
            "This unit's donation is TTI reactive for {}. It must not be released or issued: \
             keep it quarantined and discard it.",
            labels(&m)
        ))),
        TtiClearance::Incomplete(m) => Err(AppError::Conflict(format!(
            "TTI screening is not complete for this unit's donation — no non-reactive result \
             for {}. Record all five markers (HIV 1/2, HBsAg, HCV, syphilis, malaria) before \
             releasing or issuing it.",
            labels(&m)
        ))),
    }
}

/// Bring the donation's components in line with its screening: the summary
/// the reports read, and quarantine for every unit still in stock when any
/// marker is reactive. Returns how many units were already transfused —
/// a reactive result on those needs a lookback.
pub(crate) async fn sync_components(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    donation_id: Uuid,
    clearance: &TtiClearance,
) -> Result<i64, AppError> {
    let (summary, quarantine) = match clearance {
        TtiClearance::Cleared => ("non_reactive", false),
        TtiClearance::Reactive(_) => ("reactive", true),
        TtiClearance::Incomplete(_) => ("pending", false),
    };
    let transfused = sqlx::query_scalar::<_, i64>(
        "WITH upd AS ( \
           UPDATE blood_components SET \
             tti_status = $3, tti_tested_at = now(), updated_at = now(), \
             status = CASE WHEN $4 AND status NOT IN ('transfused', 'discarded') \
                           THEN 'quarantined'::blood_bag_status ELSE status END \
            WHERE tenant_id = $1 AND donation_id = $2 AND deleted_at IS NULL \
           RETURNING status) \
         SELECT count(*) FILTER (WHERE status = 'transfused') FROM upd",
    )
    .bind(tenant_id)
    .bind(donation_id)
    .bind(summary)
    .bind(quarantine)
    .fetch_one(&mut **tx)
    .await?;
    Ok(transfused)
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TtiResult {
    pub id: Uuid,
    pub donation_id: Uuid,
    pub marker: String,
    pub result: String,
    pub method: Option<String>,
    pub kit_lot: Option<String>,
    pub notes: Option<String>,
    pub tested_by: Uuid,
    pub tested_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct TtiPanel {
    pub donation_id: Uuid,
    pub results: Vec<TtiResult>,
    /// `cleared`, `reactive` or `incomplete`.
    pub status: &'static str,
    /// Markers that are reactive, or not yet non-reactive.
    pub outstanding: Vec<String>,
    /// Units of this donation already transfused — non-zero on a reactive
    /// donation means a lookback is owed.
    pub transfused_units: i64,
}

/// Withhold the panel from a caller whose field access restricts the result.
async fn apply_field_access(
    state: &AppState,
    claims: &Claims,
    panel: TtiPanel,
) -> Result<TtiPanel, AppError> {
    let restricted = medbrains_server_core::middleware::field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    let withheld = matches!(
        restricted.get(TTI_RESULT_FIELD),
        Some(FieldAccessLevel::Mask | FieldAccessLevel::Hidden)
    );
    Ok(if withheld {
        TtiPanel {
            donation_id: panel.donation_id,
            results: Vec::new(),
            status: "withheld",
            outstanding: Vec::new(),
            transfused_units: 0,
        }
    } else {
        panel
    })
}

fn panel(donation_id: Uuid, results: Vec<TtiResult>, transfused_units: i64) -> TtiPanel {
    let (status, outstanding) = match clearance_of(&results) {
        TtiClearance::Cleared => ("cleared", Vec::new()),
        TtiClearance::Reactive(m) => ("reactive", m),
        TtiClearance::Incomplete(m) => ("incomplete", m),
    };
    TtiPanel {
        donation_id,
        results,
        status,
        outstanding,
        transfused_units,
    }
}

#[derive(Debug, Deserialize)]
pub struct TtiResultInput {
    pub marker: String,
    pub result: String,
    pub method: Option<String>,
    pub kit_lot: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RecordTtiRequest {
    pub results: Vec<TtiResultInput>,
}

fn validate(body: &RecordTtiRequest) -> Result<(), AppError> {
    if body.results.is_empty() {
        return Err(AppError::BadRequest(
            "Enter at least one marker result.".to_owned(),
        ));
    }
    let mut seen = HashSet::new();
    for r in &body.results {
        if !TTI_MARKERS.contains(&r.marker.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Unknown TTI marker '{}'.",
                r.marker
            )));
        }
        if !RESULTS.contains(&r.result.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Result for {} must be non-reactive, reactive or indeterminate.",
                marker_label(&r.marker)
            )));
        }
        if !seen.insert(r.marker.as_str()) {
            return Err(AppError::BadRequest(format!(
                "{} is entered twice.",
                marker_label(&r.marker)
            )));
        }
    }
    Ok(())
}

/// `GET /api/blood-bank/donations/{donation_id}/tti`
pub async fn list_tti_results(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(donation_id): Path<Uuid>,
) -> Result<Json<TtiPanel>, AppError> {
    require_permission(&claims, permissions::blood_bank::tti::VIEW)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "blood_bank",
    )
    .await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let results = load_results(&mut tx, claims.tenant_id, donation_id).await?;
    let transfused = sqlx::query_scalar::<_, i64>(
        "SELECT count(*) FROM blood_components \
          WHERE tenant_id = $1 AND donation_id = $2 AND status = 'transfused' \
            AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(donation_id)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    let full = panel(donation_id, results, transfused);
    Ok(Json(apply_field_access(&state, &claims, full).await?))
}

/// `POST /api/blood-bank/donations/{donation_id}/tti` — record results.
///
/// A reactive result is final: it is never overwritten, it quarantines every
/// unit of the donation still in stock, and it defers the donor.
pub async fn record_tti_results(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(donation_id): Path<Uuid>,
    Json(body): Json<RecordTtiRequest>,
) -> Result<Json<TtiPanel>, AppError> {
    require_permission(&claims, permissions::blood_bank::tti::RECORD)?;
    medbrains_server_core::middleware::entitlement::require_module_enabled(
        &state.db,
        claims.tenant_id,
        "blood_bank",
    )
    .await?;
    validate(&body)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Locks the donation so two technicians entering results at once are
    // applied one after the other, against the same panel.
    let donor_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT donor_id FROM blood_donations \
          WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL FOR UPDATE",
    )
    .bind(donation_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    for r in &body.results {
        let written = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO blood_tti_results \
               (tenant_id, donation_id, marker, result, method, kit_lot, notes, tested_by) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
             ON CONFLICT (tenant_id, donation_id, marker) WHERE deleted_at IS NULL \
             DO UPDATE SET result = EXCLUDED.result, method = EXCLUDED.method, \
                           kit_lot = EXCLUDED.kit_lot, notes = EXCLUDED.notes, \
                           tested_by = EXCLUDED.tested_by, tested_at = now() \
              WHERE blood_tti_results.result <> 'reactive' \
             RETURNING id",
        )
        .bind(claims.tenant_id)
        .bind(donation_id)
        .bind(&r.marker)
        .bind(&r.result)
        .bind(&r.method)
        .bind(&r.kit_lot)
        .bind(&r.notes)
        .bind(claims.sub)
        .fetch_optional(&mut *tx)
        .await?;
        // Nothing written means the stored result is reactive. Re-entering
        // reactive changes nothing; anything else would clear a positive.
        if written.is_none() && r.result != "reactive" {
            drop(tx);
            let err = AppError::Conflict(format!(
                "{} is already recorded reactive for this donation. A reactive result is final: \
                 its units stay quarantined for discard and the donor stays deferred.",
                marker_label(&r.marker)
            ));
            return Err(audited(
                &state,
                &claims,
                "blood_bank.tti_overwrite_refused",
                Some(donation_id),
                err,
            )
            .await);
        }
    }

    let results = load_results(&mut tx, claims.tenant_id, donation_id).await?;
    let clearance = clearance_of(&results);
    let transfused = sync_components(&mut tx, claims.tenant_id, donation_id, &clearance).await?;
    if matches!(clearance, TtiClearance::Reactive(_)) {
        // Permanent deferral and referral for confirmatory testing and
        // counselling (NACO). No end date: lifting it is a medical decision.
        // The reason names no marker: the donor register is read far more
        // widely than the screening results, which are restricted.
        sqlx::query(
            "UPDATE blood_donors SET is_deferred = true, deferral_until = NULL, \
                    deferral_reason = $3, updated_at = now() \
              WHERE id = $1 AND tenant_id = $2",
        )
        .bind(donor_id)
        .bind(claims.tenant_id)
        .bind("TTI reactive — refer for confirmatory testing and counselling")
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    let full = panel(donation_id, results, transfused);
    Ok(Json(apply_field_access(&state, &claims, full).await?))
}

#[cfg(test)]
mod tests {
    use super::{TtiClearance, tti_clearance};

    fn pairs(rows: &[(&str, &str)]) -> Vec<(String, String)> {
        rows.iter()
            .map(|(m, r)| ((*m).to_owned(), (*r).to_owned()))
            .collect()
    }

    #[test]
    fn all_five_non_reactive_clears() {
        let rows = pairs(&[
            ("hiv", "non_reactive"),
            ("hbsag", "non_reactive"),
            ("hcv", "non_reactive"),
            ("syphilis", "non_reactive"),
            ("malaria", "non_reactive"),
        ]);
        assert_eq!(tti_clearance(&rows), TtiClearance::Cleared);
    }

    #[test]
    fn a_missing_or_indeterminate_marker_is_not_cleared() {
        let rows = pairs(&[
            ("hiv", "non_reactive"),
            ("hbsag", "non_reactive"),
            ("hcv", "indeterminate"),
            ("syphilis", "non_reactive"),
        ]);
        assert_eq!(
            tti_clearance(&rows),
            TtiClearance::Incomplete(vec!["hcv".to_owned(), "malaria".to_owned()])
        );
        assert!(matches!(tti_clearance(&[]), TtiClearance::Incomplete(m) if m.len() == 5));
    }

    #[test]
    fn any_reactive_marker_wins_over_missing_ones() {
        let rows = pairs(&[("hiv", "non_reactive"), ("syphilis", "reactive")]);
        assert_eq!(
            tti_clearance(&rows),
            TtiClearance::Reactive(vec!["syphilis".to_owned()])
        );
    }
}

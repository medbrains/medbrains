//! PEWS (Paediatric Early Warning Score, Brighton model) — a track-and-trigger score for children.
//! NEWS2 and MEOWS are not valid in paediatrics (normal heart rate and respiratory rate vary widely
//! by age), so children need a dedicated tool. The Brighton chart scores three clinical domains —
//! behaviour, cardiovascular, respiratory — each 0-3, plus 2 points for a quarter-hourly nebuliser
//! and 2 for persistent post-operative vomiting. The score and its escalation trigger are computed
//! server-side so a deteriorating child can't be missed at the bedside. NABH paediatric-safety
//! deterioration measure.
//!
//! The trigger thresholds below follow the widely-used Brighton escalation guidance and are the
//! shipped default policy (local charts vary); the robust part is that any single domain scoring 3,
//! or an aggregate >= 4, escalates to urgent medical review.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct PewsRequest {
    /// 0 playing/appropriate · 1 sleeping · 2 irritable · 3 lethargic/confused or reduced pain response.
    pub behaviour: i32,
    /// 0 pink or cap-refill 1-2s · 1 pale or cap-refill 3s · 2 grey/cap-refill 4s or HR >20 over normal
    /// · 3 grey & mottled/cap-refill >=5s or HR >=30 over normal or bradycardia.
    pub cardiovascular: i32,
    /// 0 normal, no recession · 1 RR >10 over normal, accessory muscles, or FiO2 30% · 2 RR >20 over
    /// normal, recessing, or FiO2 40% · 3 RR >=5 below normal with recession/grunting or FiO2 >=50%.
    pub respiratory: i32,
    /// +2 — a child on quarter-hourly nebulisers.
    #[serde(default)]
    pub quarter_hourly_nebuliser: bool,
    /// +2 — persistent post-operative vomiting.
    #[serde(default)]
    pub persistent_vomiting: bool,
}

#[derive(Debug, Serialize)]
pub struct PewsResult {
    pub total: i32,
    pub behaviour: i32,
    pub cardiovascular: i32,
    pub respiratory: i32,
    pub extra: i32,
    /// Highest single domain score — any domain at 3 escalates on its own.
    pub max_domain: i32,
    pub triggered: bool,
    pub response: &'static str,
}

fn validate_domain(name: &str, value: i32) -> Result<(), AppError> {
    if !(0..=3).contains(&value) {
        return Err(AppError::BadRequest(format!("{name} must be between 0 and 3")));
    }
    Ok(())
}

pub fn compute_pews(r: &PewsRequest) -> PewsResult {
    let extra =
        i32::from(r.quarter_hourly_nebuliser) * 2 + i32::from(r.persistent_vomiting) * 2;
    let total = r.behaviour + r.cardiovascular + r.respiratory + extra;
    let max_domain = r.behaviour.max(r.cardiovascular).max(r.respiratory);
    // Any single domain at 3, or an aggregate >= 4, is a red trigger for urgent review.
    let triggered = max_domain >= 3 || total >= 4;
    let response = if triggered {
        "Urgent — call for immediate medical review by the paediatric team, increase observation to \
         continuous, and consider the paediatric outreach/rapid-response team."
    } else if total >= 1 {
        "Elevated — inform the nurse in charge, increase observation frequency, and reassess PEWS \
         after any intervention."
    } else {
        "Within normal PEWS parameters — continue routine observations at the charted frequency."
    };
    PewsResult {
        total,
        behaviour: r.behaviour,
        cardiovascular: r.cardiovascular,
        respiratory: r.respiratory,
        extra,
        max_domain,
        triggered,
        response,
    }
}

/// `POST /api/clinical/pews` — compute the paediatric early-warning score + escalation trigger.
pub async fn pews_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<PewsRequest>,
) -> Result<Json<PewsResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    validate_domain("behaviour", body.behaviour)?;
    validate_domain("cardiovascular", body.cardiovascular)?;
    validate_domain("respiratory", body.respiratory)?;
    Ok(Json(compute_pews(&body)))
}

#[cfg(test)]
mod tests {
    use super::{PewsRequest, compute_pews};

    fn base() -> PewsRequest {
        PewsRequest {
            behaviour: 0,
            cardiovascular: 0,
            respiratory: 0,
            quarter_hourly_nebuliser: false,
            persistent_vomiting: false,
        }
    }

    #[test]
    fn normal_does_not_trigger() {
        let r = compute_pews(&base());
        assert_eq!(r.total, 0);
        assert!(!r.triggered);
    }

    #[test]
    fn low_aggregate_is_elevated_not_triggered() {
        let mut req = base();
        req.behaviour = 1;
        req.respiratory = 1; // total 2
        let r = compute_pews(&req);
        assert_eq!(r.total, 2);
        assert!(!r.triggered);
    }

    #[test]
    fn single_domain_three_triggers() {
        let mut req = base();
        req.respiratory = 3;
        let r = compute_pews(&req);
        assert_eq!(r.max_domain, 3);
        assert!(r.triggered);
    }

    #[test]
    fn aggregate_four_triggers() {
        let mut req = base();
        req.behaviour = 2;
        req.cardiovascular = 2; // total 4, no single 3
        let r = compute_pews(&req);
        assert_eq!(r.total, 4);
        assert_eq!(r.max_domain, 2);
        assert!(r.triggered);
    }

    #[test]
    fn extra_points_count() {
        let mut req = base();
        req.behaviour = 1;
        req.quarter_hourly_nebuliser = true; // +2
        req.persistent_vomiting = true; // +2
        let r = compute_pews(&req);
        assert_eq!(r.extra, 4);
        assert_eq!(r.total, 5);
        assert!(r.triggered);
    }
}

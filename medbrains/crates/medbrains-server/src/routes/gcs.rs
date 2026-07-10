//! Glasgow Coma Scale (GCS) — the standard neurological consciousness score. Eye (1-4), verbal (1-5)
//! and motor (1-6) responses sum to 3-15. It is recorded in several places as loose component + total
//! fields, so the total can drift from the components; this computes the authoritative total and the
//! coma-severity band server-side, including the "GCS <= 8" airway-protection trigger.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct GcsRequest {
    /// Eye-opening response, 1 (none) - 4 (spontaneous).
    pub eye: i32,
    /// Verbal response, 1 (none) - 5 (oriented).
    pub verbal: i32,
    /// Motor response, 1 (none) - 6 (obeys commands).
    pub motor: i32,
}

#[derive(Debug, Serialize)]
pub struct GcsResult {
    pub total: i32,
    pub eye: i32,
    pub verbal: i32,
    pub motor: i32,
    /// mild (13-15) | moderate (9-12) | severe (3-8).
    pub severity: &'static str,
    /// True when total <= 8 — the threshold for considering airway protection.
    pub airway_at_risk: bool,
    pub response: &'static str,
}

pub fn compute_gcs(eye: i32, verbal: i32, motor: i32) -> GcsResult {
    let total = eye + verbal + motor;
    let (severity, response) = if total <= 8 {
        (
            "severe",
            "Severe (GCS <= 8) — high risk of airway compromise; protect the airway (consider \
             intubation), urgent neurosurgical/critical-care review and imaging.",
        )
    } else if total <= 12 {
        (
            "moderate",
            "Moderate impairment — continuous monitoring, frequent GCS reassessment and imaging as \
             indicated; escalate on any drop.",
        )
    } else {
        (
            "mild",
            "Mild — continue observation and repeat GCS; escalate promptly on any deterioration.",
        )
    };
    GcsResult { total, eye, verbal, motor, severity, airway_at_risk: total <= 8, response }
}

/// `POST /api/clinical/gcs` — compute the Glasgow Coma Scale total + coma-severity band.
pub async fn gcs_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<GcsRequest>,
) -> Result<Json<GcsResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    if !(1..=4).contains(&body.eye) {
        return Err(AppError::BadRequest("eye response must be between 1 and 4".into()));
    }
    if !(1..=5).contains(&body.verbal) {
        return Err(AppError::BadRequest("verbal response must be between 1 and 5".into()));
    }
    if !(1..=6).contains(&body.motor) {
        return Err(AppError::BadRequest("motor response must be between 1 and 6".into()));
    }
    Ok(Json(compute_gcs(body.eye, body.verbal, body.motor)))
}

#[cfg(test)]
mod tests {
    use super::compute_gcs;

    #[test]
    fn full_score_is_mild() {
        let r = compute_gcs(4, 5, 6);
        assert_eq!(r.total, 15);
        assert_eq!(r.severity, "mild");
        assert!(!r.airway_at_risk);
    }

    #[test]
    fn eight_is_severe_and_airway_at_risk() {
        let r = compute_gcs(2, 2, 4); // 8
        assert_eq!(r.total, 8);
        assert_eq!(r.severity, "severe");
        assert!(r.airway_at_risk);
    }

    #[test]
    fn twelve_is_moderate() {
        let r = compute_gcs(3, 4, 5); // 12
        assert_eq!(r.total, 12);
        assert_eq!(r.severity, "moderate");
    }

    #[test]
    fn thirteen_is_mild() {
        let r = compute_gcs(4, 4, 5); // 13
        assert_eq!(r.severity, "mild");
    }
}

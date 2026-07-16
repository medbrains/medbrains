//! CIWA-Ar (Clinical Institute Withdrawal Assessment for Alcohol, revised) — the standard bedside
//! score for alcohol withdrawal severity. It drives symptom-triggered benzodiazepine dosing: treating
//! to the score gives less medication and shorter courses than fixed schedules, while under-treatment
//! risks withdrawal seizures and delirium tremens (a medical emergency with real mortality). Because
//! the dosing threshold is fixed, the total is computed server-side so every nurse escalates at the
//! same cut-off. NABH patient-safety / medication-safety measure.
//!
//! Ten items: nine scored 0-7 (nausea/vomiting, tremor, paroxysmal sweats, anxiety, agitation,
//! tactile, auditory and visual disturbances, headache) and orientation scored 0-4, for a maximum of
//! 67. < 8 minimal, 8-15 mild-to-moderate, >= 16 severe.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct CiwaArRequest {
    /// Nausea and vomiting (0-7).
    pub nausea_vomiting: i32,
    /// Tremor (0-7).
    pub tremor: i32,
    /// Paroxysmal sweats (0-7).
    pub paroxysmal_sweats: i32,
    /// Anxiety (0-7).
    pub anxiety: i32,
    /// Agitation (0-7).
    pub agitation: i32,
    /// Tactile disturbances — itching, pins and needles, formication (0-7).
    pub tactile_disturbances: i32,
    /// Auditory disturbances (0-7).
    pub auditory_disturbances: i32,
    /// Visual disturbances (0-7).
    pub visual_disturbances: i32,
    /// Headache / fullness in the head (0-7).
    pub headache: i32,
    /// Orientation and clouding of sensorium (0-4).
    pub orientation: i32,
}

#[derive(Debug, Serialize)]
pub struct CiwaArResult {
    pub total: i32,
    /// "minimal", "mild-to-moderate" or "severe".
    pub severity: &'static str,
    /// True at total >= 8 — the usual symptom-triggered medication threshold.
    pub medication_indicated: bool,
    pub response: &'static str,
}

fn validate(name: &str, value: i32, max: i32) -> Result<(), AppError> {
    if !(0..=max).contains(&value) {
        return Err(AppError::BadRequest(format!("{name} must be between 0 and {max}")));
    }
    Ok(())
}

pub fn compute_ciwa_ar(r: &CiwaArRequest) -> CiwaArResult {
    let total = r.nausea_vomiting
        + r.tremor
        + r.paroxysmal_sweats
        + r.anxiety
        + r.agitation
        + r.tactile_disturbances
        + r.auditory_disturbances
        + r.visual_disturbances
        + r.headache
        + r.orientation;
    // Symptom-triggered protocols dose benzodiazepines at CIWA-Ar >= 8.
    let medication_indicated = total >= 8;
    let (severity, response) = if total >= 16 {
        (
            "severe",
            "Severe withdrawal (CIWA-Ar >= 16) — high risk of seizures and delirium tremens. Give a \
             benzodiazepine per the symptom-triggered protocol, reassess every 1 hour, ensure thiamine \
             before glucose, and escalate to the medical team; consider a monitored bed.",
        )
    } else if total >= 8 {
        (
            "mild-to-moderate",
            "Mild-to-moderate withdrawal (CIWA-Ar 8-15) — give a benzodiazepine per the \
             symptom-triggered protocol and reassess in 1 hour; give thiamine.",
        )
    } else {
        (
            "minimal",
            "Minimal or no withdrawal (CIWA-Ar < 8) — no benzodiazepine needed now. Continue \
             symptom-triggered monitoring at the charted interval and give thiamine.",
        )
    };
    CiwaArResult { total, severity, medication_indicated, response }
}

/// `POST /api/clinical/ciwa-ar` — alcohol-withdrawal severity + medication threshold.
pub async fn ciwa_ar_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CiwaArRequest>,
) -> Result<Json<CiwaArResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    validate("nausea_vomiting", body.nausea_vomiting, 7)?;
    validate("tremor", body.tremor, 7)?;
    validate("paroxysmal_sweats", body.paroxysmal_sweats, 7)?;
    validate("anxiety", body.anxiety, 7)?;
    validate("agitation", body.agitation, 7)?;
    validate("tactile_disturbances", body.tactile_disturbances, 7)?;
    validate("auditory_disturbances", body.auditory_disturbances, 7)?;
    validate("visual_disturbances", body.visual_disturbances, 7)?;
    validate("headache", body.headache, 7)?;
    validate("orientation", body.orientation, 4)?;
    Ok(Json(compute_ciwa_ar(&body)))
}

#[cfg(test)]
mod tests {
    use super::{CiwaArRequest, compute_ciwa_ar};

    fn zero() -> CiwaArRequest {
        CiwaArRequest {
            nausea_vomiting: 0,
            tremor: 0,
            paroxysmal_sweats: 0,
            anxiety: 0,
            agitation: 0,
            tactile_disturbances: 0,
            auditory_disturbances: 0,
            visual_disturbances: 0,
            headache: 0,
            orientation: 0,
        }
    }

    #[test]
    fn no_symptoms_is_minimal_no_meds() {
        let r = compute_ciwa_ar(&zero());
        assert_eq!(r.total, 0);
        assert_eq!(r.severity, "minimal");
        assert!(!r.medication_indicated);
    }

    #[test]
    fn seven_is_still_minimal_boundary() {
        let mut req = zero();
        req.tremor = 7;
        let r = compute_ciwa_ar(&req);
        assert_eq!(r.total, 7);
        assert!(!r.medication_indicated);
    }

    #[test]
    fn eight_triggers_medication() {
        let mut req = zero();
        req.tremor = 4;
        req.anxiety = 4; // 8
        let r = compute_ciwa_ar(&req);
        assert_eq!(r.total, 8);
        assert_eq!(r.severity, "mild-to-moderate");
        assert!(r.medication_indicated);
    }

    #[test]
    fn sixteen_is_severe() {
        let mut req = zero();
        req.tremor = 7;
        req.agitation = 7;
        req.anxiety = 2; // 16
        let r = compute_ciwa_ar(&req);
        assert_eq!(r.total, 16);
        assert_eq!(r.severity, "severe");
        assert!(r.medication_indicated);
    }

    #[test]
    fn maximum_is_sixty_seven() {
        let req = CiwaArRequest {
            nausea_vomiting: 7,
            tremor: 7,
            paroxysmal_sweats: 7,
            anxiety: 7,
            agitation: 7,
            tactile_disturbances: 7,
            auditory_disturbances: 7,
            visual_disturbances: 7,
            headache: 7,
            orientation: 4,
        };
        let r = compute_ciwa_ar(&req);
        assert_eq!(r.total, 67);
        assert_eq!(r.severity, "severe");
    }
}

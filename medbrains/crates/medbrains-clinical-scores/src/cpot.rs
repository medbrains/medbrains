//! CPOT (Critical-Care Pain Observation Tool) — a behavioural pain scale for ICU patients who
//! cannot self-report (sedated, intubated, delirious). Self-report (the numeric rating scale)
//! remains the gold standard, but when it is impossible pain must still be assessed from observed
//! behaviour, or it goes untreated — and untreated pain drives agitation, ventilator asynchrony and
//! delirium. CPOT scores four behavioural domains 0-2 for a total of 0-8; a total >= 3 indicates
//! significant pain that warrants analgesia and reassessment. NABH pain-management / IPSG measure,
//! and a natural companion to CAM-ICU delirium screening.
//!
//! The fourth domain depends on the airway: an intubated patient is scored on compliance with the
//! ventilator, an extubated patient on vocalisation. The numeric contribution is identical (0-2);
//! `intubated` only selects which descriptor the bedside nurse used.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct CpotRequest {
    /// 0 relaxed/neutral · 1 tense (frowning, brow lowering) · 2 grimacing (all of the above + eyelids
    /// tightly closed).
    pub facial_expression: i32,
    /// 0 absence of movement · 1 protection (slow cautious movement, touching the pain site) · 2
    /// restlessness/agitation (pulling tubes, trying to sit up, not following commands).
    pub body_movements: i32,
    /// 0 relaxed on passive flexion · 1 tense/rigid · 2 very tense or rigid, resistant to movement.
    pub muscle_tension: i32,
    /// Intubated: 0 tolerating ventilator · 1 coughing but tolerating · 2 fighting the ventilator.
    /// Extubated: 0 talking in normal tone or silent · 1 sighing/moaning · 2 crying out/sobbing.
    pub ventilator_or_vocalization: i32,
    /// Whether the patient is intubated — selects which descriptor was used for the fourth domain.
    #[serde(default)]
    pub intubated: bool,
}

#[derive(Debug, Serialize)]
pub struct CpotResult {
    pub total: i32,
    pub facial_expression: i32,
    pub body_movements: i32,
    pub muscle_tension: i32,
    pub ventilator_or_vocalization: i32,
    /// True when total >= 3 — significant pain warranting analgesia and reassessment.
    pub significant_pain: bool,
    pub response: &'static str,
}

fn validate_domain(name: &str, value: i32) -> Result<(), AppError> {
    if !(0..=2).contains(&value) {
        return Err(AppError::BadRequest(format!("{name} must be between 0 and 2")));
    }
    Ok(())
}

pub fn compute_cpot(r: &CpotRequest) -> CpotResult {
    let total =
        r.facial_expression + r.body_movements + r.muscle_tension + r.ventilator_or_vocalization;
    // The validated cut-off for significant pain in the ICU is a CPOT total of 3 or more.
    let significant_pain = total >= 3;
    let response = if significant_pain {
        "Significant pain (CPOT >= 3) — treat: give or up-titrate analgesia per protocol, address \
         reversible causes (position, tubes, distension), and reassess CPOT after the intervention \
         peaks. Uncontrolled pain worsens agitation, ventilator asynchrony and delirium."
    } else {
        "No significant pain behaviour (CPOT < 3) — continue routine analgesia and reassess each \
         shift, after painful procedures, and on any change in behaviour."
    };
    CpotResult {
        total,
        facial_expression: r.facial_expression,
        body_movements: r.body_movements,
        muscle_tension: r.muscle_tension,
        ventilator_or_vocalization: r.ventilator_or_vocalization,
        significant_pain,
        response,
    }
}

/// `POST /api/clinical/cpot` — behavioural pain score for a non-self-reporting ICU patient.
pub async fn cpot_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CpotRequest>,
) -> Result<Json<CpotResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    validate_domain("facial_expression", body.facial_expression)?;
    validate_domain("body_movements", body.body_movements)?;
    validate_domain("muscle_tension", body.muscle_tension)?;
    validate_domain("ventilator_or_vocalization", body.ventilator_or_vocalization)?;
    Ok(Json(compute_cpot(&body)))
}

#[cfg(test)]
mod tests {
    use super::{CpotRequest, compute_cpot};

    fn req(face: i32, body: i32, muscle: i32, vent: i32) -> CpotRequest {
        CpotRequest {
            facial_expression: face,
            body_movements: body,
            muscle_tension: muscle,
            ventilator_or_vocalization: vent,
            intubated: true,
        }
    }

    #[test]
    fn calm_patient_no_significant_pain() {
        let r = compute_cpot(&req(0, 0, 0, 0));
        assert_eq!(r.total, 0);
        assert!(!r.significant_pain);
    }

    #[test]
    fn two_is_below_cutoff() {
        let r = compute_cpot(&req(1, 0, 1, 0));
        assert_eq!(r.total, 2);
        assert!(!r.significant_pain);
    }

    #[test]
    fn three_is_significant() {
        let r = compute_cpot(&req(1, 1, 1, 0));
        assert_eq!(r.total, 3);
        assert!(r.significant_pain);
    }

    #[test]
    fn max_score_is_eight() {
        let r = compute_cpot(&req(2, 2, 2, 2));
        assert_eq!(r.total, 8);
        assert!(r.significant_pain);
    }
}

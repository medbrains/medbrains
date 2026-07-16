//! HAS-BLED — major-bleeding risk for a patient with atrial fibrillation on (or being considered
//! for) oral anticoagulation. It is the counterpart to CHA2DS2-VASc: CHA2DS2-VASc says whether to
//! anticoagulate, HAS-BLED flags how much bleeding risk to manage. Crucially a high HAS-BLED is NOT
//! a reason to withhold anticoagulation — it identifies and prompts correction of *modifiable*
//! bleeding factors (uncontrolled BP, labile INR, concomitant antiplatelet/NSAID, alcohol) and more
//! frequent review. NABH therapeutic-safety measure.
//!
//! One point each (max 9): Hypertension (uncontrolled, SBP > 160); Abnormal renal function;
//! Abnormal liver function; Stroke history; Bleeding history or predisposition; Labile INR;
//! Elderly (age > 65); antiplatelet/NSAID Drugs; Alcohol excess. Score >= 3 is high risk.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct HasBledRequest {
    /// Age in years — the "Elderly" criterion scores 1 point at age > 65.
    pub age: i32,
    /// Uncontrolled hypertension (systolic BP > 160 mmHg). +1
    #[serde(default)]
    pub uncontrolled_hypertension: bool,
    /// Abnormal renal function (dialysis, transplant, or creatinine > 200 µmol/L). +1
    #[serde(default)]
    pub abnormal_renal_function: bool,
    /// Abnormal liver function (cirrhosis, bilirubin > 2x normal with AST/ALT/ALP > 3x). +1
    #[serde(default)]
    pub abnormal_liver_function: bool,
    /// Prior stroke. +1
    #[serde(default)]
    pub stroke: bool,
    /// Prior major bleeding or a predisposition to bleeding (e.g. anaemia). +1
    #[serde(default)]
    pub bleeding_history: bool,
    /// Labile INR (unstable/high, or time-in-therapeutic-range < 60% on a vitamin-K antagonist). +1
    #[serde(default)]
    pub labile_inr: bool,
    /// Concomitant antiplatelet agents or NSAIDs. +1
    #[serde(default)]
    pub drugs_antiplatelet_nsaid: bool,
    /// Alcohol excess (>= 8 units per week). +1
    #[serde(default)]
    pub alcohol_excess: bool,
}

#[derive(Debug, Serialize)]
pub struct HasBledResult {
    pub score: i32,
    pub elderly_point: i32,
    pub risk: &'static str,
    /// True when score >= 3 — high bleeding risk (manage, do not automatically withhold anticoagulation).
    pub high_risk: bool,
    pub response: &'static str,
}

pub fn compute_has_bled(r: &HasBledRequest) -> HasBledResult {
    let elderly = i32::from(r.age > 65);
    let score = i32::from(r.uncontrolled_hypertension)
        + i32::from(r.abnormal_renal_function)
        + i32::from(r.abnormal_liver_function)
        + i32::from(r.stroke)
        + i32::from(r.bleeding_history)
        + i32::from(r.labile_inr)
        + elderly
        + i32::from(r.drugs_antiplatelet_nsaid)
        + i32::from(r.alcohol_excess);
    let high_risk = score >= 3;
    let risk = if high_risk { "high" } else { "low-to-moderate" };
    let response = if high_risk {
        "High bleeding risk (HAS-BLED >= 3) — this is NOT a reason to withhold anticoagulation. \
         Correct modifiable factors (control BP, improve INR control or switch to a DOAC, stop \
         concomitant antiplatelet/NSAID, reduce alcohol) and review the patient more frequently."
    } else {
        "Low-to-moderate bleeding risk — proceed with anticoagulation per CHA2DS2-VASc and review at \
         routine intervals; reassess if a modifiable factor changes."
    };
    HasBledResult { score, elderly_point: elderly, risk, high_risk, response }
}

/// `POST /api/clinical/has-bled` — major-bleeding risk for AF anticoagulation.
pub async fn has_bled_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<HasBledRequest>,
) -> Result<Json<HasBledResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    if !(0..=130).contains(&body.age) {
        return Err(AppError::BadRequest("age must be between 0 and 130".to_owned()));
    }
    Ok(Json(compute_has_bled(&body)))
}

#[cfg(test)]
mod tests {
    use super::{HasBledRequest, compute_has_bled};

    fn base(age: i32) -> HasBledRequest {
        HasBledRequest {
            age,
            uncontrolled_hypertension: false,
            abnormal_renal_function: false,
            abnormal_liver_function: false,
            stroke: false,
            bleeding_history: false,
            labile_inr: false,
            drugs_antiplatelet_nsaid: false,
            alcohol_excess: false,
        }
    }

    #[test]
    fn young_no_factors_is_low() {
        let r = compute_has_bled(&base(50));
        assert_eq!(r.score, 0);
        assert!(!r.high_risk);
    }

    #[test]
    fn elderly_scores_the_age_point() {
        let r = compute_has_bled(&base(70));
        assert_eq!(r.elderly_point, 1);
        assert_eq!(r.score, 1);
        assert!(!r.high_risk);
    }

    #[test]
    fn three_factors_is_high_risk() {
        let mut req = base(70); // +1 elderly
        req.uncontrolled_hypertension = true; // +1
        req.labile_inr = true; // +1 -> 3
        let r = compute_has_bled(&req);
        assert_eq!(r.score, 3);
        assert!(r.high_risk);
        assert_eq!(r.risk, "high");
    }

    #[test]
    fn boundary_two_is_not_high() {
        let mut req = base(50);
        req.stroke = true; // +1
        req.bleeding_history = true; // +1 -> 2
        let r = compute_has_bled(&req);
        assert_eq!(r.score, 2);
        assert!(!r.high_risk);
    }

    #[test]
    fn all_factors_max_nine() {
        let mut req = base(70); // +1 elderly
        req.uncontrolled_hypertension = true;
        req.abnormal_renal_function = true;
        req.abnormal_liver_function = true;
        req.stroke = true;
        req.bleeding_history = true;
        req.labile_inr = true;
        req.drugs_antiplatelet_nsaid = true;
        req.alcohol_excess = true;
        let r = compute_has_bled(&req);
        assert_eq!(r.score, 9);
    }
}

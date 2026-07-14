//! Wells score for deep vein thrombosis — the pre-test probability rule for a patient with a
//! SUSPECTED lower-limb DVT (painful, swollen leg). It is diagnostic, and complements the Wells PE
//! score already in the suite. In its two-tier form it drives the next step: "DVT unlikely" (< 2)
//! is ruled out with a D-dimer; "DVT likely" (>= 2) goes to compression ultrasound. A missed DVT can
//! propagate to a fatal PE, and over-imaging every leg wastes scans — so the score is computed
//! server-side. NABH diagnostic-safety measure.
//!
//! Nine +1 criteria plus one −2 criterion (an alternative diagnosis at least as likely as DVT).
//! Three-tier: >= 3 high, 1-2 moderate, <= 0 low. Two-tier: >= 2 "likely", < 2 "unlikely".

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct WellsDvtRequest {
    /// Active cancer (treatment within 6 months, or palliative). +1
    #[serde(default)]
    pub active_cancer: bool,
    /// Paralysis, paresis, or recent plaster immobilisation of the lower extremity. +1
    #[serde(default)]
    pub paralysis_or_immobilisation: bool,
    /// Recently bedridden >= 3 days, or major surgery within 12 weeks. +1
    #[serde(default)]
    pub bedridden_or_surgery: bool,
    /// Localised tenderness along the deep venous system. +1
    #[serde(default)]
    pub localized_tenderness: bool,
    /// Entire leg swollen. +1
    #[serde(default)]
    pub entire_leg_swollen: bool,
    /// Calf swelling >= 3 cm compared with the asymptomatic leg. +1
    #[serde(default)]
    pub calf_swelling_3cm: bool,
    /// Pitting oedema confined to the symptomatic leg. +1
    #[serde(default)]
    pub pitting_edema: bool,
    /// Collateral (non-varicose) superficial veins. +1
    #[serde(default)]
    pub collateral_veins: bool,
    /// Previously documented DVT. +1
    #[serde(default)]
    pub previous_dvt: bool,
    /// An alternative diagnosis at least as likely as DVT. −2
    #[serde(default)]
    pub alternative_diagnosis: bool,
}

#[derive(Debug, Serialize)]
pub struct WellsDvtResult {
    pub score: i32,
    /// Three-tier stratification: "low", "moderate" or "high".
    pub risk_tier: &'static str,
    /// Two-tier dichotomised result: true when score >= 2 ("DVT likely").
    pub dvt_likely: bool,
    pub recommended_workup: &'static str,
    pub response: &'static str,
}

pub fn compute_wells_dvt(r: &WellsDvtRequest) -> WellsDvtResult {
    let positives = i32::from(r.active_cancer)
        + i32::from(r.paralysis_or_immobilisation)
        + i32::from(r.bedridden_or_surgery)
        + i32::from(r.localized_tenderness)
        + i32::from(r.entire_leg_swollen)
        + i32::from(r.calf_swelling_3cm)
        + i32::from(r.pitting_edema)
        + i32::from(r.collateral_veins)
        + i32::from(r.previous_dvt);
    let score = positives - i32::from(r.alternative_diagnosis) * 2;

    let risk_tier = if score >= 3 {
        "high"
    } else if score >= 1 {
        "moderate"
    } else {
        "low"
    };
    // Two-tier model: >= 2 is "DVT likely" and goes to ultrasound; < 2 is ruled out with a D-dimer.
    let dvt_likely = score >= 2;
    let recommended_workup = if dvt_likely {
        "Compression ultrasound of the leg — DVT likely. A negative D-dimer alone does not rule out \
         at this probability."
    } else {
        "D-dimer — DVT unlikely. A negative high-sensitivity D-dimer safely excludes DVT; a positive \
         result escalates to compression ultrasound."
    };
    let response = if score >= 3 {
        "High pre-test probability of DVT — arrange compression ultrasound promptly and consider \
         interim anticoagulation if imaging is delayed and bleeding risk is acceptable."
    } else if score >= 1 {
        "Moderate probability — follow the two-tier pathway (ultrasound if 'likely', else D-dimer) \
         and reassess with the result."
    } else {
        "Low probability — a negative D-dimer safely excludes DVT without imaging."
    };
    WellsDvtResult { score, risk_tier, dvt_likely, recommended_workup, response }
}

/// `POST /api/clinical/wells-dvt` — Wells pre-test probability for suspected deep vein thrombosis.
pub async fn wells_dvt_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<WellsDvtRequest>,
) -> Result<Json<WellsDvtResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    Ok(Json(compute_wells_dvt(&body)))
}

#[cfg(test)]
mod tests {
    use super::{WellsDvtRequest, compute_wells_dvt};

    fn none() -> WellsDvtRequest {
        WellsDvtRequest {
            active_cancer: false,
            paralysis_or_immobilisation: false,
            bedridden_or_surgery: false,
            localized_tenderness: false,
            entire_leg_swollen: false,
            calf_swelling_3cm: false,
            pitting_edema: false,
            collateral_veins: false,
            previous_dvt: false,
            alternative_diagnosis: false,
        }
    }

    #[test]
    fn no_criteria_is_low_and_unlikely() {
        let r = compute_wells_dvt(&none());
        assert_eq!(r.score, 0);
        assert_eq!(r.risk_tier, "low");
        assert!(!r.dvt_likely);
    }

    #[test]
    fn two_positives_is_likely() {
        let mut req = none();
        req.active_cancer = true;
        req.localized_tenderness = true; // 2
        let r = compute_wells_dvt(&req);
        assert_eq!(r.score, 2);
        assert!(r.dvt_likely);
        assert_eq!(r.risk_tier, "moderate");
    }

    #[test]
    fn alternative_diagnosis_subtracts_two() {
        let mut req = none();
        req.active_cancer = true;
        req.localized_tenderness = true; // +2
        req.alternative_diagnosis = true; // -2 -> 0
        let r = compute_wells_dvt(&req);
        assert_eq!(r.score, 0);
        assert!(!r.dvt_likely);
        assert_eq!(r.risk_tier, "low");
    }

    #[test]
    fn three_positives_is_high() {
        let mut req = none();
        req.active_cancer = true;
        req.entire_leg_swollen = true;
        req.previous_dvt = true; // 3
        let r = compute_wells_dvt(&req);
        assert_eq!(r.score, 3);
        assert_eq!(r.risk_tier, "high");
        assert!(r.dvt_likely);
    }

    #[test]
    fn can_go_negative() {
        let mut req = none();
        req.alternative_diagnosis = true; // -2
        let r = compute_wells_dvt(&req);
        assert_eq!(r.score, -2);
        assert_eq!(r.risk_tier, "low");
        assert!(!r.dvt_likely);
    }
}

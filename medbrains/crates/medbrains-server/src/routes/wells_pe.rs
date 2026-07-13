//! Wells score for pulmonary embolism — the standard pre-test probability rule for a patient with
//! SUSPECTED PE. It is diagnostic, not preventive: given a symptomatic patient (pleuritic chest
//! pain, dyspnoea, tachycardia) it stratifies the likelihood of PE and, in its two-tier form, drives
//! the next step — D-dimer when PE is "unlikely", straight to CT pulmonary angiography when "likely".
//! This is distinct from the Padua/VTE prophylaxis score (which decides thromboprophylaxis in
//! asymptomatic inpatients). NABH diagnostic-safety measure — a missed PE is a high-mortality
//! never-event.
//!
//! Criteria and weights (Wells et al.): clinical signs of DVT 3.0; PE the most likely diagnosis 3.0;
//! heart rate > 100 1.5; immobilisation/surgery in the last 4 weeks 1.5; previous DVT/PE 1.5;
//! haemoptysis 1.0; active malignancy 1.0. Three-tier: < 2 low, 2-6 moderate, > 6 high. Two-tier
//! (dichotomised): <= 4 "PE unlikely", > 4 "PE likely".

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct WellsPeRequest {
    /// Clinical signs and symptoms of DVT (leg swelling, pain on deep-vein palpation). +3.0
    #[serde(default)]
    pub clinical_signs_dvt: bool,
    /// PE is the most likely diagnosis, or at least as likely as the alternatives. +3.0
    #[serde(default)]
    pub pe_most_likely: bool,
    /// Heart rate > 100 beats per minute. +1.5
    #[serde(default)]
    pub heart_rate_over_100: bool,
    /// Immobilisation >= 3 days or surgery in the previous 4 weeks. +1.5
    #[serde(default)]
    pub immobilization_or_surgery: bool,
    /// Previously diagnosed DVT or PE. +1.5
    #[serde(default)]
    pub previous_dvt_pe: bool,
    /// Haemoptysis. +1.0
    #[serde(default)]
    pub hemoptysis: bool,
    /// Active malignancy (treatment within 6 months or palliative). +1.0
    #[serde(default)]
    pub malignancy: bool,
}

#[derive(Debug, Serialize)]
pub struct WellsPeResult {
    pub score: f64,
    /// Three-tier stratification: "low", "moderate" or "high".
    pub risk_tier: &'static str,
    /// Two-tier dichotomised result: true when score > 4 ("PE likely").
    pub pe_likely: bool,
    /// The recommended next diagnostic step given the two-tier result.
    pub recommended_workup: &'static str,
    pub response: &'static str,
}

pub fn compute_wells_pe(r: &WellsPeRequest) -> WellsPeResult {
    let mut score = 0.0_f64;
    if r.clinical_signs_dvt {
        score += 3.0;
    }
    if r.pe_most_likely {
        score += 3.0;
    }
    if r.heart_rate_over_100 {
        score += 1.5;
    }
    if r.immobilization_or_surgery {
        score += 1.5;
    }
    if r.previous_dvt_pe {
        score += 1.5;
    }
    if r.hemoptysis {
        score += 1.0;
    }
    if r.malignancy {
        score += 1.0;
    }

    let risk_tier = if score > 6.0 {
        "high"
    } else if score >= 2.0 {
        "moderate"
    } else {
        "low"
    };
    // Two-tier model: > 4 is "PE likely" and goes straight to imaging; <= 4 is "unlikely" and is
    // ruled out with a D-dimer first.
    let pe_likely = score > 4.0;
    let recommended_workup = if pe_likely {
        "CT pulmonary angiography (CTPA) — PE likely, imaging first. A D-dimer is not sufficient to \
         rule out at this probability."
    } else {
        "D-dimer — PE unlikely. A negative high-sensitivity D-dimer rules out PE; a positive result \
         escalates to CTPA."
    };
    let response = if score > 6.0 {
        "High pre-test probability of PE — do not delay: start empirical anticoagulation unless \
         contraindicated while arranging urgent CTPA, and escalate to the medical team."
    } else if score >= 2.0 {
        "Moderate pre-test probability — follow the two-tier pathway (imaging if 'likely', else \
         D-dimer) and reassess with the result."
    } else {
        "Low pre-test probability — apply the two-tier pathway or PERC rule; a negative D-dimer \
         safely excludes PE."
    };
    WellsPeResult { score, risk_tier, pe_likely, recommended_workup, response }
}

/// `POST /api/clinical/wells-pe` — Wells pre-test probability for suspected pulmonary embolism.
pub async fn wells_pe_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<WellsPeRequest>,
) -> Result<Json<WellsPeResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    Ok(Json(compute_wells_pe(&body)))
}

#[cfg(test)]
mod tests {
    use super::{WellsPeRequest, compute_wells_pe};

    fn none() -> WellsPeRequest {
        WellsPeRequest {
            clinical_signs_dvt: false,
            pe_most_likely: false,
            heart_rate_over_100: false,
            immobilization_or_surgery: false,
            previous_dvt_pe: false,
            hemoptysis: false,
            malignancy: false,
        }
    }

    #[test]
    fn no_criteria_is_low_and_unlikely() {
        let r = compute_wells_pe(&none());
        assert_eq!(r.score, 0.0);
        assert_eq!(r.risk_tier, "low");
        assert!(!r.pe_likely);
    }

    #[test]
    fn two_threes_is_high_and_likely() {
        let mut req = none();
        req.clinical_signs_dvt = true; // 3.0
        req.pe_most_likely = true; // 3.0 -> 6.0
        let r = compute_wells_pe(&req);
        assert_eq!(r.score, 6.0);
        // 6.0 is not > 6.0, so moderate on the three-tier, but > 4.0 so "likely" on the two-tier.
        assert_eq!(r.risk_tier, "moderate");
        assert!(r.pe_likely);
    }

    #[test]
    fn above_six_is_high() {
        let mut req = none();
        req.clinical_signs_dvt = true; // 3.0
        req.pe_most_likely = true; // 3.0
        req.heart_rate_over_100 = true; // 1.5 -> 7.5
        let r = compute_wells_pe(&req);
        assert_eq!(r.score, 7.5);
        assert_eq!(r.risk_tier, "high");
        assert!(r.pe_likely);
    }

    #[test]
    fn score_four_is_unlikely_boundary() {
        let mut req = none();
        req.heart_rate_over_100 = true; // 1.5
        req.immobilization_or_surgery = true; // 1.5
        req.hemoptysis = true; // 1.0 -> 4.0
        let r = compute_wells_pe(&req);
        assert_eq!(r.score, 4.0);
        // exactly 4.0 is NOT > 4.0 -> unlikely; and >= 2.0 -> moderate tier.
        assert!(!r.pe_likely);
        assert_eq!(r.risk_tier, "moderate");
    }

    #[test]
    fn low_tier_below_two() {
        let mut req = none();
        req.malignancy = true; // 1.0
        let r = compute_wells_pe(&req);
        assert_eq!(r.score, 1.0);
        assert_eq!(r.risk_tier, "low");
    }
}

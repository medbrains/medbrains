//! MELD (Model for End-Stage Liver Disease) — predicts 90-day mortality in chronic liver disease
//! from three objective labs (bilirubin, INR, creatinine) and is the basis for deceased-donor liver
//! transplant prioritisation. It complements Child-Pugh (which adds ascites + encephalopathy) with a
//! continuous, lab-only score. Because the formula has fixed flooring/capping rules that are easy to
//! get wrong by hand, it is computed server-side. NABH therapeutic-safety / transplant-referral
//! measure.
//!
//! Formula: MELD = 3.78·ln(bilirubin) + 11.2·ln(INR) + 9.57·ln(creatinine) + 6.43, then rounded and
//! clamped to 6-40. Flooring rules (to avoid negative logs / gaming): any lab < 1.0 is set to 1.0;
//! creatinine is capped at 4.0, and set to 4.0 if the patient had dialysis >= twice in the past week.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct MeldRequest {
    /// Total bilirubin, mg/dL.
    pub bilirubin_mg_dl: f64,
    /// INR.
    pub inr: f64,
    /// Serum creatinine, mg/dL.
    pub creatinine_mg_dl: f64,
    /// Dialysis >= twice in the past week (or 24h of CVVHD) — forces creatinine to 4.0.
    #[serde(default)]
    pub dialysis_twice_past_week: bool,
}

#[derive(Debug, Serialize)]
pub struct MeldResult {
    pub score: i32,
    /// Approximate 90-day mortality band for the score.
    pub mortality_band: &'static str,
    pub response: &'static str,
}

/// Values below 1.0 are floored to 1.0 so the natural log never goes negative.
fn floor_one(v: f64) -> f64 {
    if v < 1.0 { 1.0 } else { v }
}

pub fn compute_meld(r: &MeldRequest) -> MeldResult {
    let bilirubin = floor_one(r.bilirubin_mg_dl);
    let inr = floor_one(r.inr);
    // Creatinine floored to 1.0, capped at 4.0; dialysis forces the 4.0 cap.
    let creatinine = if r.dialysis_twice_past_week {
        4.0
    } else {
        floor_one(r.creatinine_mg_dl).min(4.0)
    };

    let raw = 9.57f64.mul_add(
        creatinine.ln(),
        11.2f64.mul_add(inr.ln(), 3.78 * bilirubin.ln()),
    ) + 6.43;
    // Round to the nearest integer, then clamp to the reported MELD range 6-40.
    let score = (raw.round() as i32).clamp(6, 40);

    let mortality_band = if score >= 40 {
        "~71% (90-day)"
    } else if score >= 30 {
        "~53% (90-day)"
    } else if score >= 20 {
        "~20% (90-day)"
    } else if score >= 10 {
        "~6% (90-day)"
    } else {
        "~2% (90-day)"
    };
    let response = if score >= 30 {
        "Very high 90-day mortality — decompensated end-stage liver disease. Involve hepatology / \
         transplant services urgently, optimise organ support, and review goals of care."
    } else if score >= 15 {
        "Elevated 90-day mortality — the benefit of transplantation generally outweighs its risk \
         above MELD 15. Refer to hepatology / transplant assessment and re-score as labs change."
    } else {
        "Lower short-term mortality — continue surveillance for decompensation, treat the underlying \
         cause, and re-score periodically (MELD guides transplant timing as it rises)."
    };
    MeldResult { score, mortality_band, response }
}

/// `POST /api/clinical/meld` — MELD score (6-40) + 90-day mortality band.
pub async fn meld_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<MeldRequest>,
) -> Result<Json<MeldResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    if body.bilirubin_mg_dl < 0.0 || body.inr < 0.0 || body.creatinine_mg_dl < 0.0 {
        return Err(AppError::BadRequest("lab values must not be negative".to_owned()));
    }
    Ok(Json(compute_meld(&body)))
}

#[cfg(test)]
mod tests {
    use super::{MeldRequest, compute_meld};

    fn req(bili: f64, inr: f64, cr: f64, dialysis: bool) -> MeldRequest {
        MeldRequest {
            bilirubin_mg_dl: bili,
            inr,
            creatinine_mg_dl: cr,
            dialysis_twice_past_week: dialysis,
        }
    }

    #[test]
    fn all_normal_floors_to_minimum_six() {
        // ln(1)=0 for all → 6.43 → rounds to 6 (the reported floor).
        let r = compute_meld(&req(1.0, 1.0, 1.0, false));
        assert_eq!(r.score, 6);
    }

    #[test]
    fn sub_one_values_are_floored() {
        // Values < 1.0 must be treated as 1.0, giving the same minimum.
        let r = compute_meld(&req(0.4, 0.9, 0.7, false));
        assert_eq!(r.score, 6);
    }

    #[test]
    fn dialysis_forces_creatinine_cap() {
        let with_dialysis = compute_meld(&req(2.0, 1.5, 1.0, true));
        let creat_four = compute_meld(&req(2.0, 1.5, 4.0, false));
        assert_eq!(with_dialysis.score, creat_four.score);
    }

    #[test]
    fn creatinine_capped_at_four() {
        let at_four = compute_meld(&req(2.0, 1.5, 4.0, false));
        let above_four = compute_meld(&req(2.0, 1.5, 8.0, false));
        assert_eq!(at_four.score, above_four.score);
    }

    #[test]
    fn high_values_score_in_thirties() {
        // bili 10, inr 2, cr 4 ≈ 36.
        let r = compute_meld(&req(10.0, 2.0, 4.0, false));
        assert_eq!(r.score, 36);
        assert_eq!(r.mortality_band, "~53% (90-day)");
    }

    #[test]
    fn score_is_clamped_to_forty() {
        let r = compute_meld(&req(50.0, 10.0, 4.0, false));
        assert_eq!(r.score, 40);
    }
}

//! Glasgow-Blatchford Score (GBS) — risk-stratifies acute UPPER gastrointestinal bleeding by the
//! likelihood of needing intervention (transfusion, endoscopic therapy or surgery). Its main value
//! is at the low end: a score of 0 (some use <= 1) identifies patients who can be managed as
//! outpatients, safely avoiding admission — while a high score flags the need for urgent resus and
//! early endoscopy. NABH clinical-safety / appropriate-care measure.
//!
//! Points: blood urea (mmol/L), haemoglobin (sex-specific), systolic BP, plus pulse >= 100 (+1),
//! melaena (+1), syncope (+2), hepatic disease (+2) and cardiac failure (+2). Max 23.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct GlasgowBlatchfordRequest {
    /// Blood urea, mmol/L (BUN mg/dL ÷ 2.8 ≈ urea mmol/L).
    pub urea_mmol_l: f64,
    /// Haemoglobin, g/dL (thresholds differ by sex).
    pub hemoglobin_g_dl: f64,
    /// Male — selects the male haemoglobin thresholds.
    #[serde(default)]
    pub sex_male: bool,
    /// Systolic blood pressure, mmHg.
    pub systolic_bp: i32,
    /// Pulse >= 100 bpm. +1
    #[serde(default)]
    pub pulse_100_plus: bool,
    /// Presentation with melaena. +1
    #[serde(default)]
    pub melena: bool,
    /// Presentation with syncope. +2
    #[serde(default)]
    pub syncope: bool,
    /// Known hepatic disease. +2
    #[serde(default)]
    pub hepatic_disease: bool,
    /// Known cardiac failure. +2
    #[serde(default)]
    pub cardiac_failure: bool,
}

#[derive(Debug, Serialize)]
pub struct GlasgowBlatchfordResult {
    pub score: i32,
    pub urea_points: i32,
    pub hemoglobin_points: i32,
    pub systolic_bp_points: i32,
    pub risk: &'static str,
    pub response: &'static str,
}

fn urea_points(urea: f64) -> i32 {
    if urea >= 25.0 {
        6
    } else if urea >= 10.0 {
        4
    } else if urea >= 8.0 {
        3
    } else if urea >= 6.5 {
        2
    } else {
        0
    }
}

fn hemoglobin_points(hgb: f64, male: bool) -> i32 {
    if hgb < 10.0 {
        6
    } else if male {
        if hgb < 12.0 {
            3
        } else if hgb < 13.0 {
            1
        } else {
            0
        }
    } else if hgb < 12.0 {
        1
    } else {
        0
    }
}

fn systolic_bp_points(sbp: i32) -> i32 {
    if sbp < 90 {
        3
    } else if sbp < 100 {
        2
    } else if sbp < 110 {
        1
    } else {
        0
    }
}

pub fn compute_glasgow_blatchford(r: &GlasgowBlatchfordRequest) -> GlasgowBlatchfordResult {
    let urea_pts = urea_points(r.urea_mmol_l);
    let hgb_pts = hemoglobin_points(r.hemoglobin_g_dl, r.sex_male);
    let sbp_pts = systolic_bp_points(r.systolic_bp);
    let other = i32::from(r.pulse_100_plus)
        + i32::from(r.melena)
        + i32::from(r.syncope) * 2
        + i32::from(r.hepatic_disease) * 2
        + i32::from(r.cardiac_failure) * 2;
    let score = urea_pts + hgb_pts + sbp_pts + other;

    let (risk, response) = if score == 0 {
        (
            "very low",
            "Very low risk (GBS 0) — the patient may be suitable for outpatient management with early \
             follow-up rather than admission, if there is no other clinical concern.",
        )
    } else if score >= 6 {
        (
            "high",
            "High risk (GBS >= 6) — resuscitate, keep nil by mouth, transfuse to target, and arrange \
             urgent upper GI endoscopy; involve the senior/GI team early.",
        )
    } else {
        (
            "intermediate",
            "Intermediate risk (GBS 1-5) — admit for observation and inpatient endoscopy; a score >= 1 \
             generally warrants admission over outpatient care.",
        )
    };
    GlasgowBlatchfordResult {
        score,
        urea_points: urea_pts,
        hemoglobin_points: hgb_pts,
        systolic_bp_points: sbp_pts,
        risk,
        response,
    }
}

/// `POST /api/clinical/glasgow-blatchford` — upper GI bleed risk + disposition guidance.
pub async fn glasgow_blatchford_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<GlasgowBlatchfordRequest>,
) -> Result<Json<GlasgowBlatchfordResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    if body.urea_mmol_l < 0.0 || body.hemoglobin_g_dl < 0.0 || body.systolic_bp < 0 {
        return Err(AppError::BadRequest("values must not be negative".to_owned()));
    }
    Ok(Json(compute_glasgow_blatchford(&body)))
}

#[cfg(test)]
mod tests {
    use super::{GlasgowBlatchfordRequest, compute_glasgow_blatchford};

    fn well() -> GlasgowBlatchfordRequest {
        GlasgowBlatchfordRequest {
            urea_mmol_l: 5.0,
            hemoglobin_g_dl: 15.0,
            sex_male: true,
            systolic_bp: 120,
            pulse_100_plus: false,
            melena: false,
            syncope: false,
            hepatic_disease: false,
            cardiac_failure: false,
        }
    }

    #[test]
    fn well_patient_is_zero_very_low() {
        let r = compute_glasgow_blatchford(&well());
        assert_eq!(r.score, 0);
        assert_eq!(r.risk, "very low");
    }

    #[test]
    fn sex_specific_hemoglobin() {
        let mut req = well();
        req.hemoglobin_g_dl = 12.5;
        req.sex_male = true; // 12-12.9 male -> 1
        assert_eq!(compute_glasgow_blatchford(&req).hemoglobin_points, 1);
        req.sex_male = false; // >=12 female -> 0
        assert_eq!(compute_glasgow_blatchford(&req).hemoglobin_points, 0);
    }

    #[test]
    fn urea_and_bp_thresholds() {
        let mut req = well();
        req.urea_mmol_l = 10.0; // 10-24.9 -> 4
        req.systolic_bp = 95; // 90-99 -> 2
        let r = compute_glasgow_blatchford(&req);
        assert_eq!(r.urea_points, 4);
        assert_eq!(r.systolic_bp_points, 2);
    }

    #[test]
    fn other_markers_weighted() {
        let mut req = well();
        req.syncope = true; // +2
        req.melena = true; // +1
        req.cardiac_failure = true; // +2
        let r = compute_glasgow_blatchford(&req);
        assert_eq!(r.score, 5);
        assert_eq!(r.risk, "intermediate");
    }

    #[test]
    fn high_risk_over_six() {
        let mut req = well();
        req.urea_mmol_l = 26.0; // 6
        req.hemoglobin_g_dl = 9.0; // 6
        let r = compute_glasgow_blatchford(&req);
        assert!(r.score >= 6);
        assert_eq!(r.risk, "high");
    }
}

//! Serum anion gap — a first-line step in the metabolic-acidosis workup.
//!
//! It separates life-threatening high-anion-gap causes (ketoacidosis, lactic acidosis, toxic
//! alcohols, salicylate, uraemia) from normal-gap (bicarbonate-loss) causes, and corrects for
//! albumin since hypoalbuminaemia masks a genuinely high gap. Computed server-side so the value
//! is authoritative.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct AnionGapRequest {
    pub sodium: f64,
    pub chloride: f64,
    pub bicarbonate: f64,
    /// Serum albumin in g/dL — enables the albumin-corrected gap.
    pub albumin_g_dl: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct AnionGapResult {
    pub anion_gap: f64,
    /// Albumin-corrected gap (when albumin supplied): AG + 2.5 * (4.0 - albumin).
    pub corrected_anion_gap: Option<f64>,
    /// high (>12) | normal (8-12) | low (<8), on the corrected gap when available.
    pub category: &'static str,
    pub response: &'static str,
}

pub fn compute_anion_gap(
    sodium: f64,
    chloride: f64,
    bicarbonate: f64,
    albumin_g_dl: Option<f64>,
) -> AnionGapResult {
    let anion_gap = sodium - (chloride + bicarbonate);
    let corrected_anion_gap = albumin_g_dl.map(|a| 2.5_f64.mul_add(4.0 - a, anion_gap));
    let effective = corrected_anion_gap.unwrap_or(anion_gap);

    let (category, response) = if effective > 12.0 {
        (
            "high",
            "High anion gap — with acidosis this is a HAGMA: consider ketoacidosis, lactic acidosis, \
             toxic alcohols (methanol / ethylene glycol), salicylate, or uraemia. Check lactate, \
             ketones, glucose and an osmolar gap.",
        )
    } else if effective >= 8.0 {
        (
            "normal",
            "Normal anion gap — if acidotic, consider a hyperchloraemic (normal-gap) acidosis from GI \
             or renal bicarbonate loss (e.g. diarrhoea, RTA).",
        )
    } else {
        (
            "low",
            "Low anion gap — consider hypoalbuminaemia (correct for albumin), paraproteinaemia, \
             lithium/bromide, or laboratory error.",
        )
    };

    AnionGapResult {
        anion_gap: (anion_gap * 10.0).round() / 10.0,
        corrected_anion_gap: corrected_anion_gap.map(|c| (c * 10.0).round() / 10.0),
        category,
        response,
    }
}

/// `POST /api/clinical/anion-gap` — serum anion gap (+ albumin correction) and interpretation.
pub async fn anion_gap(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AnionGapRequest>,
) -> Result<Json<AnionGapResult>, AppError> {
    require_permission(&claims, permissions::lab::orders::LIST)?;
    if !(100.0..=180.0).contains(&body.sodium) {
        return Err(AppError::BadRequest("sodium must be between 100 and 180 mmol/L".into()));
    }
    if !(60.0..=140.0).contains(&body.chloride) {
        return Err(AppError::BadRequest("chloride must be between 60 and 140 mmol/L".into()));
    }
    if !(2.0..=50.0).contains(&body.bicarbonate) {
        return Err(AppError::BadRequest("bicarbonate must be between 2 and 50 mmol/L".into()));
    }
    if let Some(a) = body.albumin_g_dl {
        if !(0.5..=6.0).contains(&a) {
            return Err(AppError::BadRequest("albumin_g_dl must be between 0.5 and 6".into()));
        }
    }
    Ok(Json(compute_anion_gap(body.sodium, body.chloride, body.bicarbonate, body.albumin_g_dl)))
}

#[cfg(test)]
mod tests {
    use super::compute_anion_gap;

    #[test]
    fn normal_gap() {
        // 140 - (104 + 24) = 12 -> normal boundary.
        let r = compute_anion_gap(140.0, 104.0, 24.0, None);
        assert!((r.anion_gap - 12.0).abs() < 1e-9);
        assert_eq!(r.category, "normal");
    }

    #[test]
    fn high_gap_dka() {
        // 140 - (100 + 10) = 30 -> high.
        let r = compute_anion_gap(140.0, 100.0, 10.0, None);
        assert!((r.anion_gap - 30.0).abs() < 1e-9);
        assert_eq!(r.category, "high");
    }

    #[test]
    fn albumin_correction_unmasks_high_gap() {
        // AG 12 but albumin 2.0 -> corrected 12 + 2.5*2 = 17 -> high.
        let r = compute_anion_gap(140.0, 104.0, 24.0, Some(2.0));
        assert_eq!(r.corrected_anion_gap, Some(17.0));
        assert_eq!(r.category, "high");
    }
}

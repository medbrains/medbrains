//! Lung-protective ventilation target (ARDSNet). Tidal volume must be set from IDEAL body weight, not
//! actual weight — ventilating at ~6 mL/kg IBW (range 4-8) with plateau pressure <= 30 cmH2O reduces
//! ventilator-induced lung injury and mortality. IBW depends only on height and sex, so this computes
//! it (Devine formula) and the target tidal-volume range server-side, and checks a proposed setting.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct LungProtectiveRequest {
    pub height_cm: f64,
    /// "male" | "female" — determines the Devine IBW base.
    pub sex: String,
    /// Optional proposed tidal volume (mL) to check against the target range.
    pub tidal_volume_ml: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct LungProtectiveResult {
    pub ibw_kg: f64,
    /// Target tidal volume at 6 mL/kg IBW.
    pub target_ml: i32,
    /// Lower bound at 4 mL/kg IBW.
    pub low_ml: i32,
    /// Upper bound at 8 mL/kg IBW.
    pub high_ml: i32,
    /// The proposed setting expressed as mL/kg IBW (when a tidal volume was supplied).
    pub set_ml_per_kg: Option<f64>,
    /// Whether the proposed setting is within the 4-8 mL/kg lung-protective range.
    pub within_range: Option<bool>,
    pub response: &'static str,
}

/// Devine ideal body weight (kg) from height and sex. Clamped at 0 for very short stature.
pub fn ibw_kg(height_cm: f64, is_male: bool) -> f64 {
    let height_in = height_cm / 2.54;
    let base = if is_male { 50.0 } else { 45.5 };
    (base + 2.3 * (height_in - 60.0)).max(0.0)
}

pub fn compute_lung_protective(
    height_cm: f64,
    is_male: bool,
    tidal_volume_ml: Option<i32>,
) -> LungProtectiveResult {
    let ibw = ibw_kg(height_cm, is_male);
    #[allow(clippy::cast_possible_truncation)]
    let target_ml = (ibw * 6.0).round() as i32;
    #[allow(clippy::cast_possible_truncation)]
    let low_ml = (ibw * 4.0).round() as i32;
    #[allow(clippy::cast_possible_truncation)]
    let high_ml = (ibw * 8.0).round() as i32;

    let set_ml_per_kg = tidal_volume_ml.and_then(|v| {
        if ibw > 0.0 {
            Some((f64::from(v) / ibw * 10.0).round() / 10.0)
        } else {
            None
        }
    });
    let within_range = set_ml_per_kg.map(|r| (4.0..=8.0).contains(&r));
    let response = match within_range {
        Some(false) => {
            "Set tidal volume is outside the lung-protective 4-8 mL/kg IBW range — adjust toward \
             6 mL/kg and keep plateau pressure <= 30 cmH2O."
        }
        Some(true) => {
            "Set tidal volume is within the lung-protective range; keep plateau pressure <= 30 cmH2O."
        }
        None => {
            "Target ~6 mL/kg ideal body weight (range 4-8 mL/kg); keep plateau pressure <= 30 cmH2O."
        }
    };

    LungProtectiveResult {
        ibw_kg: (ibw * 10.0).round() / 10.0,
        target_ml,
        low_ml,
        high_ml,
        set_ml_per_kg,
        within_range,
        response,
    }
}

/// `POST /api/clinical/lung-protective` — IBW + lung-protective tidal-volume target and setting check.
pub async fn lung_protective(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<LungProtectiveRequest>,
) -> Result<Json<LungProtectiveResult>, AppError> {
    require_permission(&claims, permissions::icu::ventilator::LIST)?;
    if !(100.0..=250.0).contains(&body.height_cm) {
        return Err(AppError::BadRequest("height_cm must be between 100 and 250".into()));
    }
    let is_male = match body.sex.to_lowercase().as_str() {
        "male" | "m" => true,
        "female" | "f" => false,
        _ => return Err(AppError::BadRequest("sex must be 'male' or 'female'".into())),
    };
    Ok(Json(compute_lung_protective(body.height_cm, is_male, body.tidal_volume_ml)))
}

#[cfg(test)]
mod tests {
    use super::{compute_lung_protective, ibw_kg};

    #[test]
    fn ibw_devine_male() {
        // 175 cm male: 68.9 in -> 50 + 2.3*(68.9-60) = ~70.5 kg.
        let w = ibw_kg(175.0, true);
        assert!((w - 70.5).abs() < 1.0);
    }

    #[test]
    fn target_is_six_ml_per_kg() {
        let r = compute_lung_protective(175.0, true, None);
        // ~70.5 kg * 6 = ~423 mL.
        assert!((r.target_ml - 423).abs() <= 2);
        assert!(r.within_range.is_none());
    }

    #[test]
    fn high_tidal_volume_flags_out_of_range() {
        // 700 mL on ~70 kg IBW ~= 10 mL/kg -> out of range.
        let r = compute_lung_protective(175.0, true, Some(700));
        assert_eq!(r.within_range, Some(false));
    }

    #[test]
    fn six_ml_per_kg_is_within_range() {
        let r = compute_lung_protective(175.0, true, Some(r6_ml()));
        assert_eq!(r.within_range, Some(true));
    }

    fn r6_ml() -> i32 {
        (ibw_kg(175.0, true) * 6.0).round() as i32
    }
}

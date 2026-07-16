//! Paediatric maintenance IV fluid (Holliday-Segar / "4-2-1" rule). Getting a child's maintenance rate
//! or fluid tonicity wrong is a real cause of harm — hypotonic maintenance fluid causes hospital-
//! acquired hyponatraemia, seizures and death (NICE / AAP now mandate ISOTONIC maintenance fluid). This
//! computes the hourly rate and 24h volume server-side from weight so the number is authoritative, and
//! always returns the isotonic-fluid safety reminder.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct PaediatricFluidRequest {
    pub weight_kg: f64,
}

#[derive(Debug, Serialize)]
pub struct PaediatricFluidResult {
    pub weight_kg: f64,
    /// Maintenance rate in mL/hour (4-2-1 rule).
    pub hourly_ml: f64,
    /// Maintenance volume over 24 hours (100-50-20 rule).
    pub daily_ml: f64,
    pub response: &'static str,
}

/// Holliday-Segar maintenance: 4 mL/kg/h for the first 10 kg, 2 mL/kg/h for the next 10 kg, 1 mL/kg/h
/// beyond 20 kg (equivalently 100/50/20 mL/kg/day).
pub fn maintenance_hourly_ml(weight_kg: f64) -> f64 {
    if weight_kg <= 10.0 {
        4.0 * weight_kg
    } else if weight_kg <= 20.0 {
        40.0 + 2.0 * (weight_kg - 10.0)
    } else {
        60.0 + 1.0 * (weight_kg - 20.0)
    }
}

pub fn maintenance_daily_ml(weight_kg: f64) -> f64 {
    if weight_kg <= 10.0 {
        100.0 * weight_kg
    } else if weight_kg <= 20.0 {
        1000.0 + 50.0 * (weight_kg - 10.0)
    } else {
        1500.0 + 20.0 * (weight_kg - 20.0)
    }
}

/// `POST /api/clinical/paediatric-fluid` — Holliday-Segar maintenance IV fluid rate + 24h volume.
pub async fn paediatric_fluid(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<PaediatricFluidRequest>,
) -> Result<Json<PaediatricFluidResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    if !(0.5..=150.0).contains(&body.weight_kg) {
        return Err(AppError::BadRequest("weight_kg must be between 0.5 and 150".into()));
    }
    let hourly_ml = (maintenance_hourly_ml(body.weight_kg) * 10.0).round() / 10.0;
    let daily_ml = maintenance_daily_ml(body.weight_kg).round();
    Ok(Json(PaediatricFluidResult {
        weight_kg: body.weight_kg,
        hourly_ml,
        daily_ml,
        response:
            "Use an ISOTONIC maintenance fluid (e.g. 0.9% saline +/- glucose/KCl) — hypotonic fluid \
             causes hospital-acquired hyponatraemia. This is a maintenance estimate only: add \
             replacement for deficits/ongoing losses, reassess with electrolytes, and restrict in \
             SIADH/cardiac/renal states.",
    }))
}

#[cfg(test)]
mod tests {
    use super::{maintenance_daily_ml, maintenance_hourly_ml};

    #[test]
    fn infant_8kg() {
        assert!((maintenance_hourly_ml(8.0) - 32.0).abs() < 1e-9);
        assert!((maintenance_daily_ml(8.0) - 800.0).abs() < 1e-9);
    }

    #[test]
    fn child_15kg() {
        // 40 + 2*5 = 50 mL/h; 1000 + 50*5 = 1250 mL/day.
        assert!((maintenance_hourly_ml(15.0) - 50.0).abs() < 1e-9);
        assert!((maintenance_daily_ml(15.0) - 1250.0).abs() < 1e-9);
    }

    #[test]
    fn child_30kg() {
        // 60 + 10 = 70 mL/h; 1500 + 20*10 = 1700 mL/day.
        assert!((maintenance_hourly_ml(30.0) - 70.0).abs() < 1e-9);
        assert!((maintenance_daily_ml(30.0) - 1700.0).abs() < 1e-9);
    }
}

//! Serum osmolar gap — the companion to the anion gap in the toxic-alcohol workup.
//!
//! A raised osmolar gap (measured osmolality minus the calculated value) flags unmeasured osmoles:
//! most urgently methanol and ethylene glycol, which cause a high-anion-gap metabolic acidosis and
//! need fomepizole/dialysis before the parent alcohol is metabolised. Computed server-side so the
//! calculated osmolality and gap are authoritative.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct OsmolarGapRequest {
    pub sodium: f64,
    /// Glucose in mg/dL.
    pub glucose_mg_dl: f64,
    /// Blood urea nitrogen in mg/dL.
    pub bun_mg_dl: f64,
    /// Measured serum osmolality in mOsm/kg (freezing-point osmometry).
    pub measured_osm: f64,
    /// Optional measured ethanol in mg/dL — added to the calculated osmolality so known alcohol
    /// intake doesn't masquerade as a toxic-alcohol gap.
    pub ethanol_mg_dl: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct OsmolarGapResult {
    /// 2*Na + glucose/18 + BUN/2.8 (+ ethanol/3.7 when supplied).
    pub calculated_osm: f64,
    pub osmolar_gap: f64,
    /// elevated (>10) | normal (<=10).
    pub category: &'static str,
    pub response: &'static str,
}

pub fn compute_osmolar_gap(
    sodium: f64,
    glucose_mg_dl: f64,
    bun_mg_dl: f64,
    measured_osm: f64,
    ethanol_mg_dl: Option<f64>,
) -> OsmolarGapResult {
    let ethanol_term = ethanol_mg_dl.unwrap_or(0.0) / 3.7;
    let calculated_osm =
        2.0_f64.mul_add(sodium, glucose_mg_dl / 18.0 + bun_mg_dl / 2.8 + ethanol_term);
    let osmolar_gap = measured_osm - calculated_osm;

    let (category, response) = if osmolar_gap > 10.0 {
        (
            "elevated",
            "Elevated osmolar gap — unmeasured osmoles present. With a high anion gap metabolic \
             acidosis this is toxic-alcohol poisoning (methanol / ethylene glycol) until proven \
             otherwise: treat empirically (fomepizole), consider dialysis, and send toxic-alcohol \
             levels. Also seen with isopropanol, mannitol, glycerol and severe ketoacidosis.",
        )
    } else {
        (
            "normal",
            "Normal osmolar gap — a normal gap does not exclude early toxic-alcohol ingestion, since \
             the gap falls as the parent alcohol is metabolised to acids. Correlate with the anion \
             gap and clinical picture.",
        )
    };

    OsmolarGapResult {
        calculated_osm: (calculated_osm * 10.0).round() / 10.0,
        osmolar_gap: (osmolar_gap * 10.0).round() / 10.0,
        category,
        response,
    }
}

/// `POST /api/clinical/osmolar-gap` — serum osmolar gap and toxic-alcohol interpretation.
pub async fn osmolar_gap(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<OsmolarGapRequest>,
) -> Result<Json<OsmolarGapResult>, AppError> {
    require_permission(&claims, permissions::lab::orders::LIST)?;
    if !(100.0..=180.0).contains(&body.sodium) {
        return Err(AppError::BadRequest("sodium must be between 100 and 180 mmol/L".into()));
    }
    if !(20.0..=1500.0).contains(&body.glucose_mg_dl) {
        return Err(AppError::BadRequest("glucose must be between 20 and 1500 mg/dL".into()));
    }
    if !(2.0..=300.0).contains(&body.bun_mg_dl) {
        return Err(AppError::BadRequest("BUN must be between 2 and 300 mg/dL".into()));
    }
    if !(200.0..=400.0).contains(&body.measured_osm) {
        return Err(AppError::BadRequest("measured osmolality must be between 200 and 400 mOsm/kg".into()));
    }
    if let Some(e) = body.ethanol_mg_dl {
        if !(0.0..=600.0).contains(&e) {
            return Err(AppError::BadRequest("ethanol must be between 0 and 600 mg/dL".into()));
        }
    }
    Ok(Json(compute_osmolar_gap(
        body.sodium,
        body.glucose_mg_dl,
        body.bun_mg_dl,
        body.measured_osm,
        body.ethanol_mg_dl,
    )))
}

#[cfg(test)]
mod tests {
    use super::compute_osmolar_gap;

    #[test]
    fn normal_gap() {
        // 2*140 + 90/18 + 14/2.8 = 280 + 5 + 5 = 290; measured 295 -> gap 5 -> normal.
        let r = compute_osmolar_gap(140.0, 90.0, 14.0, 295.0, None);
        assert!((r.calculated_osm - 290.0).abs() < 1e-9);
        assert_eq!(r.osmolar_gap, 5.0);
        assert_eq!(r.category, "normal");
    }

    #[test]
    fn elevated_gap_toxic_alcohol() {
        // calc 290, measured 330 -> gap 40 -> elevated.
        let r = compute_osmolar_gap(140.0, 90.0, 14.0, 330.0, None);
        assert_eq!(r.osmolar_gap, 40.0);
        assert_eq!(r.category, "elevated");
    }

    #[test]
    fn ethanol_narrows_the_gap() {
        // ethanol 100 mg/dL adds 100/3.7 = 27.03 to calc osm, shrinking the gap below 10.
        let with = compute_osmolar_gap(140.0, 90.0, 14.0, 312.0, Some(100.0));
        assert_eq!(with.category, "normal");
        let without = compute_osmolar_gap(140.0, 90.0, 14.0, 312.0, None);
        assert_eq!(without.category, "elevated");
    }
}

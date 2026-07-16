//! SOFA (Sequential Organ Failure Assessment) — grades dysfunction across six organ systems
//! (respiration, coagulation, liver, cardiovascular, CNS, renal), each 0-4, for a total of 0-24.
//! It tracks the severity of critical illness over time and underpins the Sepsis-3 definition: a
//! rise in SOFA of >= 2 points from baseline in a patient with suspected infection defines sepsis.
//! A higher total predicts higher ICU mortality. Computed server-side so the thresholds are applied
//! consistently. NABH critical-care / sepsis-safety measure; complements the existing qSOFA screen.
//!
//! Five systems are derived from objective values here; the cardiovascular sub-score is supplied
//! directly (0-4) because it depends on the specific vasopressor agent and dose (MAP < 70 = 1;
//! dopamine <= 5 or any dobutamine = 2; dopamine > 5 / adrenaline <= 0.1 / noradrenaline <= 0.1 = 3;
//! dopamine > 15 / adrenaline > 0.1 / noradrenaline > 0.1 = 4).

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct SofaRequest {
    /// PaO2/FiO2 ratio (mmHg). Scores 3 and 4 require respiratory support.
    pub pao2_fio2: f64,
    /// On mechanical ventilation / CPAP — enables the <200 (3) and <100 (4) respiratory sub-scores.
    #[serde(default)]
    pub respiratory_support: bool,
    /// Platelets, x10^3/µL.
    pub platelets: i32,
    /// Total bilirubin, mg/dL.
    pub bilirubin_mg_dl: f64,
    /// Cardiovascular sub-score 0-4 (from MAP + vasopressor agent/dose — see module docs).
    pub cardiovascular_score: i32,
    /// Glasgow Coma Scale total (3-15).
    pub gcs: i32,
    /// Creatinine, mg/dL.
    pub creatinine_mg_dl: f64,
}

#[derive(Debug, Serialize)]
pub struct SofaResult {
    pub total: i32,
    pub respiration: i32,
    pub coagulation: i32,
    pub liver: i32,
    pub cardiovascular: i32,
    pub cns: i32,
    pub renal: i32,
    pub mortality_band: &'static str,
    pub response: &'static str,
}

fn respiration_points(ratio: f64, support: bool) -> i32 {
    if support && ratio < 100.0 {
        4
    } else if support && ratio < 200.0 {
        3
    } else if ratio < 300.0 {
        2
    } else if ratio < 400.0 {
        1
    } else {
        0
    }
}

fn coagulation_points(plt: i32) -> i32 {
    if plt < 20 {
        4
    } else if plt < 50 {
        3
    } else if plt < 100 {
        2
    } else if plt < 150 {
        1
    } else {
        0
    }
}

fn liver_points(bili: f64) -> i32 {
    if bili >= 12.0 {
        4
    } else if bili >= 6.0 {
        3
    } else if bili >= 2.0 {
        2
    } else if bili >= 1.2 {
        1
    } else {
        0
    }
}

fn cns_points(gcs: i32) -> i32 {
    if gcs < 6 {
        4
    } else if gcs <= 9 {
        3
    } else if gcs <= 12 {
        2
    } else if gcs <= 14 {
        1
    } else {
        0
    }
}

fn renal_points(cr: f64) -> i32 {
    if cr >= 5.0 {
        4
    } else if cr >= 3.5 {
        3
    } else if cr >= 2.0 {
        2
    } else if cr >= 1.2 {
        1
    } else {
        0
    }
}

pub fn compute_sofa(r: &SofaRequest) -> SofaResult {
    let respiration = respiration_points(r.pao2_fio2, r.respiratory_support);
    let coagulation = coagulation_points(r.platelets);
    let liver = liver_points(r.bilirubin_mg_dl);
    let cardiovascular = r.cardiovascular_score;
    let cns = cns_points(r.gcs);
    let renal = renal_points(r.creatinine_mg_dl);
    let total = respiration + coagulation + liver + cardiovascular + cns + renal;
    // Approximate ICU mortality bands from the original SOFA validation.
    let mortality_band = if total >= 15 {
        "very high (>80%)"
    } else if total >= 13 {
        "high (~50-60%)"
    } else if total >= 10 {
        "elevated (~40-50%)"
    } else if total >= 7 {
        "moderate (~15-20%)"
    } else {
        "low (<10%)"
    };
    let response = if total >= 10 {
        "Severe multi-organ dysfunction — high predicted mortality. Ensure organ support is optimised, \
         source-control any infection, and review goals of care with the team. A rise of >= 2 points \
         with suspected infection meets the Sepsis-3 definition."
    } else {
        "Track SOFA as a trend — a rise of >= 2 points from baseline in a patient with suspected \
         infection defines sepsis (Sepsis-3); reassess each shift and after interventions."
    };
    SofaResult {
        total,
        respiration,
        coagulation,
        liver,
        cardiovascular,
        cns,
        renal,
        mortality_band,
        response,
    }
}

/// `POST /api/clinical/sofa` — six-system organ-dysfunction score (0-24) + mortality band.
pub async fn sofa_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<SofaRequest>,
) -> Result<Json<SofaResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    if !(0..=4).contains(&body.cardiovascular_score) {
        return Err(AppError::BadRequest("cardiovascular_score must be between 0 and 4".to_owned()));
    }
    if !(3..=15).contains(&body.gcs) {
        return Err(AppError::BadRequest("gcs must be between 3 and 15".to_owned()));
    }
    if body.pao2_fio2 < 0.0 || body.platelets < 0 || body.bilirubin_mg_dl < 0.0 || body.creatinine_mg_dl < 0.0
    {
        return Err(AppError::BadRequest("values must not be negative".to_owned()));
    }
    Ok(Json(compute_sofa(&body)))
}

#[cfg(test)]
mod tests {
    use super::{SofaRequest, compute_sofa};

    fn healthy() -> SofaRequest {
        SofaRequest {
            pao2_fio2: 450.0,
            respiratory_support: false,
            platelets: 250,
            bilirubin_mg_dl: 0.5,
            cardiovascular_score: 0,
            gcs: 15,
            creatinine_mg_dl: 0.8,
        }
    }

    #[test]
    fn healthy_is_zero() {
        let r = compute_sofa(&healthy());
        assert_eq!(r.total, 0);
        assert_eq!(r.mortality_band, "low (<10%)");
    }

    #[test]
    fn respiratory_support_enables_high_sub_scores() {
        let mut req = healthy();
        req.pao2_fio2 = 150.0;
        req.respiratory_support = true; // <200 with support -> 3
        assert_eq!(compute_sofa(&req).respiration, 3);
        req.respiratory_support = false; // <300 without support -> 2
        assert_eq!(compute_sofa(&req).respiration, 2);
    }

    #[test]
    fn each_system_thresholds() {
        let mut req = healthy();
        req.platelets = 30; // <50 -> 3
        req.bilirubin_mg_dl = 7.0; // 6-11.9 -> 3
        req.gcs = 8; // 6-9 -> 3
        req.creatinine_mg_dl = 4.0; // 3.5-4.9 -> 3
        let r = compute_sofa(&req);
        assert_eq!(r.coagulation, 3);
        assert_eq!(r.liver, 3);
        assert_eq!(r.cns, 3);
        assert_eq!(r.renal, 3);
    }

    #[test]
    fn severe_totals_high_band() {
        let req = SofaRequest {
            pao2_fio2: 90.0,
            respiratory_support: true, // 4
            platelets: 10,             // 4
            bilirubin_mg_dl: 13.0,     // 4
            cardiovascular_score: 4,   // 4
            gcs: 4,                    // 4
            creatinine_mg_dl: 6.0,     // 4
        };
        let r = compute_sofa(&req);
        assert_eq!(r.total, 24);
        assert_eq!(r.mortality_band, "very high (>80%)");
    }
}

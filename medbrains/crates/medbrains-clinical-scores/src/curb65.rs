//! CURB-65 — severity score for community-acquired pneumonia (CAP) that guides the site-of-care
//! decision: manage at home, admit to a ward, or consider ICU/HDU. Five one-point criteria:
//! Confusion, Urea > 7 mmol/L (BUN > 19 mg/dL), Respiratory rate >= 30, Blood pressure low
//! (systolic < 90 or diastolic <= 60), and age >= 65. Getting the disposition right matters — a
//! severe CAP sent home can deteriorate fatally, while admitting every mild case wastes beds.
//! NABH clinical-safety / appropriate-care measure.
//!
//! Bands: 0-1 low risk (outpatient), 2 moderate (short-stay/supervised admission), 3-5 severe
//! (admit; 4-5 assess for ICU).

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct Curb65Request {
    /// New mental confusion (abbreviated mental test score <= 8, or new disorientation). +1
    #[serde(default)]
    pub confusion: bool,
    /// Blood urea > 7 mmol/L (BUN > 19 mg/dL). +1
    #[serde(default)]
    pub urea_over_7: bool,
    /// Respiratory rate >= 30 breaths/min. +1
    #[serde(default)]
    pub respiratory_rate_30_plus: bool,
    /// Low blood pressure — systolic < 90 mmHg or diastolic <= 60 mmHg. +1
    #[serde(default)]
    pub low_blood_pressure: bool,
    /// Age in years — scores 1 point at age >= 65.
    pub age: i32,
}

#[derive(Debug, Serialize)]
pub struct Curb65Result {
    pub score: i32,
    pub age_point: i32,
    pub risk: &'static str,
    pub disposition: &'static str,
    pub response: &'static str,
}

pub fn compute_curb65(r: &Curb65Request) -> Curb65Result {
    let age_point = i32::from(r.age >= 65);
    let score = i32::from(r.confusion)
        + i32::from(r.urea_over_7)
        + i32::from(r.respiratory_rate_30_plus)
        + i32::from(r.low_blood_pressure)
        + age_point;
    let (risk, disposition, response) = if score >= 3 {
        (
            "severe",
            "admit — assess for ICU/HDU if 4-5",
            "Severe CAP (CURB-65 3-5) — admit. At 4-5, assess for ICU/HDU and early senior review; \
             start prompt guideline antibiotics and monitor closely.",
        )
    } else if score == 2 {
        (
            "moderate",
            "consider admission / short-stay supervised care",
            "Moderate CAP (CURB-65 2) — consider a short-stay or supervised hospital admission; \
             clinical judgement and social factors apply.",
        )
    } else {
        (
            "low",
            "outpatient management usually appropriate",
            "Low-risk CAP (CURB-65 0-1) — outpatient treatment is usually appropriate with oral \
             antibiotics and safety-netting, if no other concern (hypoxia, comorbidity, social).",
        )
    };
    Curb65Result { score, age_point, risk, disposition, response }
}

/// `POST /api/clinical/curb-65` — community-acquired pneumonia severity + site-of-care guidance.
pub async fn curb65_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<Curb65Request>,
) -> Result<Json<Curb65Result>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    if !(0..=130).contains(&body.age) {
        return Err(AppError::BadRequest("age must be between 0 and 130".to_owned()));
    }
    Ok(Json(compute_curb65(&body)))
}

#[cfg(test)]
mod tests {
    use super::{Curb65Request, compute_curb65};

    fn base(age: i32) -> Curb65Request {
        Curb65Request {
            confusion: false,
            urea_over_7: false,
            respiratory_rate_30_plus: false,
            low_blood_pressure: false,
            age,
        }
    }

    #[test]
    fn young_no_criteria_is_low() {
        let r = compute_curb65(&base(40));
        assert_eq!(r.score, 0);
        assert_eq!(r.risk, "low");
    }

    #[test]
    fn age_65_scores_the_age_point() {
        let r = compute_curb65(&base(70));
        assert_eq!(r.age_point, 1);
        assert_eq!(r.score, 1);
        assert_eq!(r.risk, "low");
    }

    #[test]
    fn two_is_moderate() {
        let mut req = base(70); // +1 age
        req.confusion = true; // +1 -> 2
        let r = compute_curb65(&req);
        assert_eq!(r.score, 2);
        assert_eq!(r.risk, "moderate");
    }

    #[test]
    fn three_is_severe() {
        let mut req = base(70); // +1 age
        req.confusion = true; // +1
        req.low_blood_pressure = true; // +1 -> 3
        let r = compute_curb65(&req);
        assert_eq!(r.score, 3);
        assert_eq!(r.risk, "severe");
    }

    #[test]
    fn all_five_is_max() {
        let mut req = base(80);
        req.confusion = true;
        req.urea_over_7 = true;
        req.respiratory_rate_30_plus = true;
        req.low_blood_pressure = true;
        let r = compute_curb65(&req);
        assert_eq!(r.score, 5);
        assert_eq!(r.risk, "severe");
    }
}

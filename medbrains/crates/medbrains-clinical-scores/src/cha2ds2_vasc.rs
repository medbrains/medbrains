//! CHA2DS2-VASc — stroke-risk stratification for non-valvular atrial fibrillation. It decides
//! whether a patient with AF should be on oral anticoagulation, weighing their annual thromboembolic
//! (stroke) risk. Under-anticoagulating a high-risk patient risks a disabling stroke; anticoagulating
//! a genuinely low-risk one adds bleeding risk for no benefit — so the score must be computed
//! consistently. NABH diagnostic/therapeutic-safety measure; pairs with HAS-BLED (bleeding risk).
//!
//! Points: Congestive heart failure 1, Hypertension 1, Age >= 75 **2**, Diabetes 1, prior
//! Stroke/TIA/thromboembolism **2**, Vascular disease 1, Age 65-74 1, Sex category (female) 1.
//! Maximum 9. Female sex is a risk *modifier*, not a risk factor on its own, so the recommendation
//! keys off the "non-sex" score: 0 = low (no anticoagulation), 1 = consider, >= 2 = anticoagulate.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct Cha2ds2VascRequest {
    /// Age in years — contributes 2 points at >= 75, 1 point at 65-74, else 0.
    pub age: i32,
    /// Sex category: female adds 1 point (a modifier, not a standalone indication).
    #[serde(default)]
    pub sex_female: bool,
    /// Congestive heart failure / LV dysfunction. +1
    #[serde(default)]
    pub congestive_heart_failure: bool,
    /// Hypertension (or on treatment). +1
    #[serde(default)]
    pub hypertension: bool,
    /// Diabetes mellitus. +1
    #[serde(default)]
    pub diabetes: bool,
    /// Prior stroke, TIA or thromboembolism. +2
    #[serde(default)]
    pub stroke_tia_thromboembolism: bool,
    /// Vascular disease (prior MI, peripheral artery disease, or aortic plaque). +1
    #[serde(default)]
    pub vascular_disease: bool,
}

#[derive(Debug, Serialize)]
pub struct Cha2ds2VascResult {
    pub score: i32,
    pub age_points: i32,
    pub sex_points: i32,
    /// Score excluding the sex modifier — what the anticoagulation recommendation keys off.
    pub non_sex_score: i32,
    pub anticoagulation: &'static str,
    pub response: &'static str,
}

fn age_points(age: i32) -> i32 {
    if age >= 75 {
        2
    } else if age >= 65 {
        1
    } else {
        0
    }
}

pub fn compute_cha2ds2_vasc(r: &Cha2ds2VascRequest) -> Cha2ds2VascResult {
    let age_pts = age_points(r.age);
    let sex_pts = i32::from(r.sex_female);
    let clinical = i32::from(r.congestive_heart_failure)
        + i32::from(r.hypertension)
        + age_pts
        + i32::from(r.diabetes)
        + i32::from(r.stroke_tia_thromboembolism) * 2
        + i32::from(r.vascular_disease);
    let score = clinical + sex_pts;
    // Female sex alone (non-sex score 0) stays "low risk" — it is a modifier, not an indication.
    let (anticoagulation, response) = if clinical == 0 {
        (
            "not recommended",
            "Low stroke risk — oral anticoagulation is not recommended; no antithrombotic therapy is \
             preferred over aspirin. Reassess if risk factors change.",
        )
    } else if clinical == 1 {
        (
            "consider",
            "Intermediate risk — consider oral anticoagulation after weighing bleeding risk \
             (HAS-BLED) and patient preference; a DOAC is generally preferred where appropriate.",
        )
    } else {
        (
            "recommended",
            "Oral anticoagulation is recommended unless contraindicated — assess bleeding risk with \
             HAS-BLED (do not withhold anticoagulation on a high HAS-BLED alone; correct modifiable \
             factors) and prefer a DOAC where appropriate.",
        )
    };
    Cha2ds2VascResult {
        score,
        age_points: age_pts,
        sex_points: sex_pts,
        non_sex_score: clinical,
        anticoagulation,
        response,
    }
}

/// `POST /api/clinical/cha2ds2-vasc` — stroke risk + anticoagulation guidance for AF.
pub async fn cha2ds2_vasc_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<Cha2ds2VascRequest>,
) -> Result<Json<Cha2ds2VascResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    if !(0..=130).contains(&body.age) {
        return Err(AppError::BadRequest("age must be between 0 and 130".to_owned()));
    }
    Ok(Json(compute_cha2ds2_vasc(&body)))
}

#[cfg(test)]
mod tests {
    use super::{Cha2ds2VascRequest, compute_cha2ds2_vasc};

    fn base(age: i32, female: bool) -> Cha2ds2VascRequest {
        Cha2ds2VascRequest {
            age,
            sex_female: female,
            congestive_heart_failure: false,
            hypertension: false,
            diabetes: false,
            stroke_tia_thromboembolism: false,
            vascular_disease: false,
        }
    }

    #[test]
    fn young_male_no_factors_is_low() {
        let r = compute_cha2ds2_vasc(&base(50, false));
        assert_eq!(r.score, 0);
        assert_eq!(r.anticoagulation, "not recommended");
    }

    #[test]
    fn female_sex_alone_stays_low() {
        // Score 1 from sex only, but non-sex score 0 → still "not recommended".
        let r = compute_cha2ds2_vasc(&base(50, true));
        assert_eq!(r.score, 1);
        assert_eq!(r.non_sex_score, 0);
        assert_eq!(r.anticoagulation, "not recommended");
    }

    #[test]
    fn age_75_scores_two() {
        let r = compute_cha2ds2_vasc(&base(80, false));
        assert_eq!(r.age_points, 2);
        assert_eq!(r.score, 2);
        assert_eq!(r.anticoagulation, "recommended");
    }

    #[test]
    fn age_65_to_74_scores_one_consider() {
        let r = compute_cha2ds2_vasc(&base(70, false));
        assert_eq!(r.age_points, 1);
        assert_eq!(r.non_sex_score, 1);
        assert_eq!(r.anticoagulation, "consider");
    }

    #[test]
    fn stroke_history_counts_double() {
        let mut req = base(50, false);
        req.stroke_tia_thromboembolism = true;
        let r = compute_cha2ds2_vasc(&req);
        assert_eq!(r.score, 2);
        assert_eq!(r.anticoagulation, "recommended");
    }

    #[test]
    fn full_house_female() {
        let mut req = base(80, true);
        req.congestive_heart_failure = true;
        req.hypertension = true;
        req.diabetes = true;
        req.stroke_tia_thromboembolism = true;
        req.vascular_disease = true;
        // 2 (age) +1 sex +1 chf +1 htn +1 dm +2 stroke +1 vasc = 9 (max)
        let r = compute_cha2ds2_vasc(&req);
        assert_eq!(r.score, 9);
    }
}

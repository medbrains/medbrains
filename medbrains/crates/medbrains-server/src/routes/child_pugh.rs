//! Child-Pugh score — severity of chronic liver disease (cirrhosis). It classifies a cirrhotic
//! patient into class A/B/C, which drives prognosis, peri-operative and procedural risk, drug-dosing
//! caution (hepatically cleared drugs), and referral/transplant discussion. Getting the class right
//! matters for consent and for avoiding an operation a decompensated (class C) patient will not
//! survive. NABH therapeutic/procedural-safety measure.
//!
//! Five parameters, each 1-3 points: total bilirubin, serum albumin, INR, ascites and hepatic
//! encephalopathy. Total 5-15 → class A 5-6, B 7-9, C 10-15.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct ChildPughRequest {
    /// Total bilirubin, mg/dL. < 2 = 1, 2-3 = 2, > 3 = 3.
    pub bilirubin_mg_dl: f64,
    /// Serum albumin, g/dL. > 3.5 = 1, 2.8-3.5 = 2, < 2.8 = 3.
    pub albumin_g_dl: f64,
    /// INR. < 1.7 = 1, 1.7-2.3 = 2, > 2.3 = 3.
    pub inr: f64,
    /// Ascites: "none" (1), "mild" (2), or "moderate_severe" (3).
    pub ascites: String,
    /// Hepatic encephalopathy: "none" (1), "grade_1_2" (2), or "grade_3_4" (3).
    pub encephalopathy: String,
}

#[derive(Debug, Serialize)]
pub struct ChildPughResult {
    pub total: i32,
    pub bilirubin_points: i32,
    pub albumin_points: i32,
    pub inr_points: i32,
    pub ascites_points: i32,
    pub encephalopathy_points: i32,
    pub class: &'static str,
    pub response: &'static str,
}

fn bilirubin_points(v: f64) -> i32 {
    if v > 3.0 {
        3
    } else if v >= 2.0 {
        2
    } else {
        1
    }
}

fn albumin_points(v: f64) -> i32 {
    if v < 2.8 {
        3
    } else if v <= 3.5 {
        2
    } else {
        1
    }
}

fn inr_points(v: f64) -> i32 {
    if v > 2.3 {
        3
    } else if v >= 1.7 {
        2
    } else {
        1
    }
}

fn category_points(value: &str, mild: &str, severe: &str, field: &str) -> Result<i32, AppError> {
    if value == "none" {
        Ok(1)
    } else if value == mild {
        Ok(2)
    } else if value == severe {
        Ok(3)
    } else {
        Err(AppError::BadRequest(format!("invalid {field} value '{value}'")))
    }
}

pub fn compute_child_pugh(r: &ChildPughRequest) -> Result<ChildPughResult, AppError> {
    let bilirubin_pts = bilirubin_points(r.bilirubin_mg_dl);
    let albumin_pts = albumin_points(r.albumin_g_dl);
    let inr_pts = inr_points(r.inr);
    let ascites_pts = category_points(&r.ascites, "mild", "moderate_severe", "ascites")?;
    let enceph_pts =
        category_points(&r.encephalopathy, "grade_1_2", "grade_3_4", "encephalopathy")?;
    let total = bilirubin_pts + albumin_pts + inr_pts + ascites_pts + enceph_pts;
    let (class, response) = if total >= 10 {
        (
            "C",
            "Class C — decompensated cirrhosis (poorest prognosis). High operative and procedural \
             mortality: avoid elective surgery, dose hepatically-cleared drugs with great caution, \
             and involve hepatology / consider transplant assessment.",
        )
    } else if total >= 7 {
        (
            "B",
            "Class B — significant functional compromise. Elevated peri-procedural risk; optimise \
             before any elective intervention, review hepatically-cleared drug doses, and involve \
             hepatology.",
        )
    } else {
        (
            "A",
            "Class A — well-compensated disease. Best prognosis, but still monitor for \
             decompensation and review hepatically-cleared drugs.",
        )
    };
    Ok(ChildPughResult {
        total,
        bilirubin_points: bilirubin_pts,
        albumin_points: albumin_pts,
        inr_points: inr_pts,
        ascites_points: ascites_pts,
        encephalopathy_points: enceph_pts,
        class,
        response,
    })
}

/// `POST /api/clinical/child-pugh` — cirrhosis severity classification (A/B/C).
pub async fn child_pugh_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<ChildPughRequest>,
) -> Result<Json<ChildPughResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    if body.bilirubin_mg_dl < 0.0 || body.albumin_g_dl < 0.0 || body.inr < 0.0 {
        return Err(AppError::BadRequest("lab values must not be negative".to_owned()));
    }
    Ok(Json(compute_child_pugh(&body)?))
}

#[cfg(test)]
mod tests {
    use super::{ChildPughRequest, compute_child_pugh};

    fn req(bili: f64, alb: f64, inr: f64, asc: &str, enc: &str) -> ChildPughRequest {
        ChildPughRequest {
            bilirubin_mg_dl: bili,
            albumin_g_dl: alb,
            inr,
            ascites: asc.to_owned(),
            encephalopathy: enc.to_owned(),
        }
    }

    #[test]
    fn all_best_is_class_a_five() {
        let r = compute_child_pugh(&req(1.0, 4.0, 1.0, "none", "none")).unwrap();
        assert_eq!(r.total, 5);
        assert_eq!(r.class, "A");
    }

    #[test]
    fn all_worst_is_class_c_fifteen() {
        let r = compute_child_pugh(&req(5.0, 2.0, 3.0, "moderate_severe", "grade_3_4")).unwrap();
        assert_eq!(r.total, 15);
        assert_eq!(r.class, "C");
    }

    #[test]
    fn class_b_boundary_seven() {
        // bili 2-3 (2) + albumin 2.8-3.5 (2) + inr <1.7 (1) + mild ascites (2) + none (1) = 8 -> B
        let r = compute_child_pugh(&req(2.5, 3.0, 1.2, "mild", "none")).unwrap();
        assert_eq!(r.total, 8);
        assert_eq!(r.class, "B");
    }

    #[test]
    fn bilirubin_thresholds() {
        assert_eq!(compute_child_pugh(&req(1.9, 4.0, 1.0, "none", "none")).unwrap().bilirubin_points, 1);
        assert_eq!(compute_child_pugh(&req(2.0, 4.0, 1.0, "none", "none")).unwrap().bilirubin_points, 2);
        assert_eq!(compute_child_pugh(&req(3.1, 4.0, 1.0, "none", "none")).unwrap().bilirubin_points, 3);
    }

    #[test]
    fn invalid_ascites_is_rejected() {
        assert!(compute_child_pugh(&req(1.0, 4.0, 1.0, "huge", "none")).is_err());
    }
}

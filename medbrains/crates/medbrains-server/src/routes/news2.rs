//! NEWS2 (National Early Warning Score 2, RCP 2017) — aggregate physiological score for detecting
//! acutely deteriorating patients. Computed server-side from the bedside parameters so the score and
//! its escalation band are authoritative and can't be mis-added at the bedside. A single parameter
//! scoring 3, or an aggregate >= 5, triggers escalation. NABH/IPSG deterioration-detection tool.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct News2Request {
    pub respiratory_rate: i32,
    pub spo2: i32,
    #[serde(default)]
    pub on_oxygen: bool,
    pub temperature: f64,
    pub systolic_bp: i32,
    pub pulse: i32,
    /// ACVPU: true when the patient is anything other than Alert (Confusion/Voice/Pain/Unresponsive).
    #[serde(default)]
    pub confused_or_worse: bool,
}

#[derive(Debug, Serialize)]
pub struct News2Result {
    pub total: i32,
    pub respiratory_rate: i32,
    pub spo2: i32,
    pub supplemental_o2: i32,
    pub temperature: i32,
    pub systolic_bp: i32,
    pub pulse: i32,
    pub consciousness: i32,
    /// True when any single parameter scored 3 — escalate even at a low aggregate.
    pub any_param_three: bool,
    pub risk: &'static str,
    pub response: &'static str,
}

fn score_resp_rate(rr: i32) -> i32 {
    match rr {
        ..=8 => 3,
        9..=11 => 1,
        12..=20 => 0,
        21..=24 => 2,
        _ => 3,
    }
}

fn score_spo2(spo2: i32) -> i32 {
    match spo2 {
        ..=91 => 3,
        92..=93 => 2,
        94..=95 => 1,
        _ => 0,
    }
}

fn score_temp(t: f64) -> i32 {
    if t <= 35.0 {
        3
    } else if t <= 36.0 {
        1
    } else if t <= 38.0 {
        0
    } else if t <= 39.0 {
        1
    } else {
        2
    }
}

fn score_sbp(sbp: i32) -> i32 {
    match sbp {
        ..=90 => 3,
        91..=100 => 2,
        101..=110 => 1,
        111..=219 => 0,
        _ => 3,
    }
}

fn score_pulse(p: i32) -> i32 {
    match p {
        ..=40 => 3,
        41..=50 => 1,
        51..=90 => 0,
        91..=110 => 1,
        111..=130 => 2,
        _ => 3,
    }
}

pub fn compute_news2(r: &News2Request) -> News2Result {
    let respiratory_rate = score_resp_rate(r.respiratory_rate);
    let spo2 = score_spo2(r.spo2);
    let supplemental_o2 = i32::from(r.on_oxygen) * 2;
    let temperature = score_temp(r.temperature);
    let systolic_bp = score_sbp(r.systolic_bp);
    let pulse = score_pulse(r.pulse);
    let consciousness = if r.confused_or_worse { 3 } else { 0 };
    let total = respiratory_rate
        + spo2
        + supplemental_o2
        + temperature
        + systolic_bp
        + pulse
        + consciousness;
    let any_param_three = [
        respiratory_rate,
        spo2,
        temperature,
        systolic_bp,
        pulse,
        consciousness,
    ]
    .contains(&3);

    let (risk, response) = if total >= 7 {
        (
            "high",
            "Emergency — continuous monitoring and immediate emergency clinical assessment (consider critical care).",
        )
    } else if total >= 5 {
        (
            "medium",
            "Urgent — at least hourly monitoring and urgent review by a clinician competent to assess acute illness.",
        )
    } else if any_param_three {
        (
            "low-medium",
            "Increased — hourly monitoring and review by a registered nurse; escalate if concerned.",
        )
    } else {
        (
            "low",
            "Routine — 4-to-6-hourly monitoring; continue standard observations.",
        )
    };

    News2Result {
        total,
        respiratory_rate,
        spo2,
        supplemental_o2,
        temperature,
        systolic_bp,
        pulse,
        consciousness,
        any_param_three,
        risk,
        response,
    }
}

/// `POST /api/clinical/news2` — compute the NEWS2 score + escalation band from bedside parameters.
pub async fn news2_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<News2Request>,
) -> Result<Json<News2Result>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    Ok(Json(compute_news2(&body)))
}

#[cfg(test)]
mod tests {
    use super::{News2Request, compute_news2};

    fn normal() -> News2Request {
        News2Request {
            respiratory_rate: 16,
            spo2: 98,
            on_oxygen: false,
            temperature: 37.0,
            systolic_bp: 120,
            pulse: 70,
            confused_or_worse: false,
        }
    }

    #[test]
    fn normal_is_zero_low() {
        let r = compute_news2(&normal());
        assert_eq!(r.total, 0);
        assert_eq!(r.risk, "low");
    }

    #[test]
    fn single_param_three_flags_low_medium() {
        let mut req = normal();
        req.respiratory_rate = 26; // scores 3
        let r = compute_news2(&req);
        assert_eq!(r.total, 3);
        assert!(r.any_param_three);
        assert_eq!(r.risk, "low-medium");
    }

    #[test]
    fn deteriorating_is_high() {
        let req = News2Request {
            respiratory_rate: 26, // 3
            spo2: 91,             // 3
            on_oxygen: true,      // 2
            temperature: 39.5,    // 2
            systolic_bp: 88,      // 3
            pulse: 135,           // 3
            confused_or_worse: true, // 3
        };
        let r = compute_news2(&req);
        assert_eq!(r.total, 19);
        assert_eq!(r.risk, "high");
    }
}

//! MEOWS (Modified Early Obstetric Warning Score) — a track-and-trigger chart for pregnant and
//! recently-delivered women. NEWS2 is explicitly NOT validated in pregnancy (normal pregnancy shifts
//! respiratory rate, heart rate and blood pressure), so obstetric patients need a dedicated tool.
//! Each vital sign maps to a white / yellow / red band; the escalation rule is a single RED trigger
//! OR two YELLOW triggers -> summon senior obstetric review. Computed server-side so the trigger can't
//! be missed at the bedside. NABH/CEMACH maternal-deterioration safety measure.
//!
//! The bands are the CEMACH MEOWS chart validated by Singh et al. 2012 — see `ews::meows_table`
//! for the table and its sources.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct MeowsRequest {
    pub respiratory_rate: i32,
    pub spo2: i32,
    pub temperature: f64,
    pub systolic_bp: i32,
    pub diastolic_bp: i32,
    pub pulse: i32,
    /// AVPU — true when the woman is not fully Alert (responds to Voice/Pain only, or Unresponsive).
    #[serde(default)]
    pub not_alert: bool,
}

/// A single parameter's track-and-trigger band.
const WHITE: &str = "white";
const YELLOW: &str = "yellow";
const RED: &str = "red";

#[derive(Debug, Serialize)]
pub struct MeowsParam {
    pub name: &'static str,
    pub band: &'static str,
}

#[derive(Debug, Serialize)]
pub struct MeowsResult {
    pub params: Vec<MeowsParam>,
    pub yellow_count: i32,
    pub red_count: i32,
    /// True when a single red or two yellows are present — activate senior obstetric review.
    pub triggered: bool,
    pub response: &'static str,
}

// The bands are the auto-score's own (`ews::meows_table`), so the calculator
// and the score charted with each vitals reading can never disagree.
fn band(scored: (i32, crate::ews::Zone)) -> &'static str {
    match scored.1 {
        crate::ews::Zone::White => WHITE,
        crate::ews::Zone::Yellow => YELLOW,
        _ => RED,
    }
}

fn band_resp_rate(rr: i32) -> &'static str {
    band(crate::ews::meows_table::respiration(rr))
}

fn band_spo2(spo2: i32) -> &'static str {
    band(crate::ews::meows_table::spo2(spo2))
}

fn band_temp(t: f64) -> &'static str {
    // Charted to one decimal place; tenths make the 35.0 / 38.0 edges exact.
    #[allow(clippy::cast_possible_truncation)]
    let tenths = (t * 10.0).round() as i32;
    band(crate::ews::meows_table::temperature(tenths))
}

fn band_sbp(sbp: i32) -> &'static str {
    band(crate::ews::meows_table::systolic(sbp))
}

fn band_dbp(dbp: i32) -> &'static str {
    band(crate::ews::meows_table::diastolic(dbp))
}

fn band_pulse(p: i32) -> &'static str {
    band(crate::ews::meows_table::heart_rate(p))
}

pub fn compute_meows(r: &MeowsRequest) -> MeowsResult {
    let params = vec![
        MeowsParam {
            name: "Respiratory rate",
            band: band_resp_rate(r.respiratory_rate),
        },
        MeowsParam {
            name: "SpO₂",
            band: band_spo2(r.spo2),
        },
        MeowsParam {
            name: "Temperature",
            band: band_temp(r.temperature),
        },
        MeowsParam {
            name: "Systolic BP",
            band: band_sbp(r.systolic_bp),
        },
        MeowsParam {
            name: "Diastolic BP",
            band: band_dbp(r.diastolic_bp),
        },
        MeowsParam {
            name: "Pulse",
            band: band_pulse(r.pulse),
        },
        // Any reduction in consciousness is a red trigger on its own.
        MeowsParam {
            name: "Consciousness (AVPU)",
            band: if r.not_alert { RED } else { WHITE },
        },
    ];
    let red_count = params.iter().filter(|p| p.band == RED).count() as i32;
    let yellow_count = params.iter().filter(|p| p.band == YELLOW).count() as i32;
    let triggered = red_count >= 1 || yellow_count >= 2;
    let response = if triggered {
        "Triggered — summon senior obstetric and anaesthetic review now, increase observation \
         frequency, and manage the underlying cause (haemorrhage, sepsis, pre-eclampsia/eclampsia, \
         thromboembolism)."
    } else {
        "Within normal MEOWS parameters — continue routine observations at the charted frequency."
    };
    MeowsResult {
        params,
        yellow_count,
        red_count,
        triggered,
        response,
    }
}

/// `POST /api/clinical/meows` — compute the MEOWS bands + escalation trigger from bedside parameters.
pub async fn meows_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<MeowsRequest>,
) -> Result<Json<MeowsResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    Ok(Json(compute_meows(&body)))
}

#[cfg(test)]
mod tests {
    use super::{MeowsRequest, compute_meows};

    fn normal() -> MeowsRequest {
        MeowsRequest {
            respiratory_rate: 16,
            spo2: 98,
            temperature: 37.0,
            systolic_bp: 120,
            diastolic_bp: 75,
            pulse: 80,
            not_alert: false,
        }
    }

    #[test]
    fn normal_does_not_trigger() {
        let r = compute_meows(&normal());
        assert_eq!(r.red_count, 0);
        assert_eq!(r.yellow_count, 0);
        assert!(!r.triggered);
    }

    #[test]
    fn single_yellow_does_not_trigger() {
        let mut req = normal();
        req.systolic_bp = 95; // one yellow
        let r = compute_meows(&req);
        assert_eq!(r.yellow_count, 1);
        assert!(!r.triggered);
    }

    #[test]
    fn two_yellows_trigger() {
        let mut req = normal();
        req.systolic_bp = 95; // yellow
        req.pulse = 105; // yellow
        let r = compute_meows(&req);
        assert_eq!(r.yellow_count, 2);
        assert!(r.triggered);
    }

    #[test]
    fn single_red_triggers() {
        let mut req = normal();
        req.systolic_bp = 85; // red
        let r = compute_meows(&req);
        assert_eq!(r.red_count, 1);
        assert!(r.triggered);
    }

    #[test]
    fn not_alert_is_red_and_triggers() {
        let mut req = normal();
        req.not_alert = true;
        let r = compute_meows(&req);
        assert_eq!(r.red_count, 1);
        assert!(r.triggered);
    }
}

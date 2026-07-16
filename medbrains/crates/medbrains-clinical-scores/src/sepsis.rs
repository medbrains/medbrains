//! qSOFA (quick Sequential Organ Failure Assessment) — a 3-criterion bedside screen for patients
//! with suspected infection who are at higher risk of a poor outcome from sepsis. Score >= 2 flags a
//! patient who warrants escalation and the Surviving Sepsis Campaign Hour-1 bundle. Computed
//! server-side so the score and its escalation trigger are authoritative and can't be mis-added at the
//! bedside. Feeds the NABH sepsis Hour-1-bundle KPI.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct QsofaRequest {
    pub respiratory_rate: i32,
    pub systolic_bp: i32,
    /// Altered mentation — GCS < 15 or any acute change in mental status (not fully alert).
    #[serde(default)]
    pub altered_mentation: bool,
}

#[derive(Debug, Serialize)]
pub struct QsofaResult {
    pub total: i32,
    pub respiratory_rate: i32,
    pub systolic_bp: i32,
    pub mentation: i32,
    /// True when total >= 2 — high risk of poor sepsis outcome; escalate and start the Hour-1 bundle.
    pub high_risk: bool,
    pub response: &'static str,
}

pub fn compute_qsofa(r: &QsofaRequest) -> QsofaResult {
    // Each criterion scores 1: RR >= 22/min, SBP <= 100 mmHg, altered mentation (GCS < 15).
    let respiratory_rate = i32::from(r.respiratory_rate >= 22);
    let systolic_bp = i32::from(r.systolic_bp <= 100);
    let mentation = i32::from(r.altered_mentation);
    let total = respiratory_rate + systolic_bp + mentation;
    let high_risk = total >= 2;
    let response = if high_risk {
        "High risk — escalate to a clinician now and start the Surviving Sepsis Hour-1 bundle: \
         measure lactate, draw blood cultures before antibiotics, give broad-spectrum antibiotics, \
         begin 30 mL/kg crystalloid for hypotension or lactate >= 4, apply vasopressors to keep \
         MAP >= 65."
    } else {
        "Lower risk — sepsis not excluded. Continue monitoring and reassess qSOFA if the clinical \
         picture changes; screen for organ dysfunction if infection is suspected."
    };
    QsofaResult { total, respiratory_rate, systolic_bp, mentation, high_risk, response }
}

/// `POST /api/clinical/qsofa` — compute the qSOFA sepsis screen from bedside parameters.
pub async fn qsofa_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<QsofaRequest>,
) -> Result<Json<QsofaResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    Ok(Json(compute_qsofa(&body)))
}

#[cfg(test)]
mod tests {
    use super::{QsofaRequest, compute_qsofa};

    #[test]
    fn normal_is_low_risk() {
        let r = compute_qsofa(&QsofaRequest {
            respiratory_rate: 16,
            systolic_bp: 120,
            altered_mentation: false,
        });
        assert_eq!(r.total, 0);
        assert!(!r.high_risk);
    }

    #[test]
    fn single_criterion_is_low_risk() {
        let r = compute_qsofa(&QsofaRequest {
            respiratory_rate: 24, // 1
            systolic_bp: 120,
            altered_mentation: false,
        });
        assert_eq!(r.total, 1);
        assert!(!r.high_risk);
    }

    #[test]
    fn two_criteria_flag_high_risk() {
        let r = compute_qsofa(&QsofaRequest {
            respiratory_rate: 24, // 1
            systolic_bp: 92,      // 1
            altered_mentation: false,
        });
        assert_eq!(r.total, 2);
        assert!(r.high_risk);
    }

    #[test]
    fn boundary_values_score() {
        // RR exactly 22 and SBP exactly 100 both count.
        let r = compute_qsofa(&QsofaRequest {
            respiratory_rate: 22,
            systolic_bp: 100,
            altered_mentation: true,
        });
        assert_eq!(r.total, 3);
        assert!(r.high_risk);
    }
}

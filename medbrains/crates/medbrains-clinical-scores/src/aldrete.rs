//! Modified Aldrete score — the post-anaesthesia recovery (PACU) discharge-readiness score. Five
//! parameters (activity, respiration, circulation, consciousness, oxygenation) each score 0-2; a total
//! of >= 9 is the standard threshold for discharge from recovery to the ward. Computing it server-side
//! from the components makes the number authoritative — the OT PACU discharge gate checks an Aldrete
//! score, and it should be a computed value, not a hand-typed one. NABH/anaesthesia recovery safety.

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct AldreteRequest {
    /// 2 moves 4 extremities · 1 moves 2 · 0 moves 0.
    pub activity: i32,
    /// 2 breathes deeply/coughs freely · 1 dyspnoea/shallow · 0 apnoeic.
    pub respiration: i32,
    /// BP vs pre-anaesthetic: 2 within ±20 mmHg · 1 ±20-50 · 0 beyond ±50.
    pub circulation: i32,
    /// 2 fully awake · 1 arousable on calling · 0 not responding.
    pub consciousness: i32,
    /// 2 SpO₂ >92% on room air · 1 needs O₂ to keep >90% · 0 <90% even with O₂.
    pub oxygenation: i32,
}

#[derive(Debug, Serialize)]
pub struct AldreteResult {
    pub total: i32,
    pub activity: i32,
    pub respiration: i32,
    pub circulation: i32,
    pub consciousness: i32,
    pub oxygenation: i32,
    /// True when total >= 9 — the standard PACU discharge-readiness threshold.
    pub discharge_ready: bool,
    pub response: &'static str,
}

fn validate(name: &str, value: i32) -> Result<(), AppError> {
    if !(0..=2).contains(&value) {
        return Err(AppError::BadRequest(format!("{name} must be between 0 and 2")));
    }
    Ok(())
}

pub fn compute_aldrete(r: &AldreteRequest) -> AldreteResult {
    let total = r.activity + r.respiration + r.circulation + r.consciousness + r.oxygenation;
    let discharge_ready = total >= 9;
    let response = if discharge_ready {
        "Discharge-ready — meets the Aldrete >= 9 threshold; a patient may be transferred from \
         recovery to the ward when the anaesthetist concurs."
    } else {
        "Not yet dischargeable — continue recovery monitoring and reassess; any single parameter at \
         0 needs active management before transfer."
    };
    AldreteResult {
        total,
        activity: r.activity,
        respiration: r.respiration,
        circulation: r.circulation,
        consciousness: r.consciousness,
        oxygenation: r.oxygenation,
        discharge_ready,
        response,
    }
}

/// `POST /api/clinical/aldrete` — compute the modified Aldrete PACU discharge-readiness score.
pub async fn aldrete_score(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AldreteRequest>,
) -> Result<Json<AldreteResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    validate("activity", body.activity)?;
    validate("respiration", body.respiration)?;
    validate("circulation", body.circulation)?;
    validate("consciousness", body.consciousness)?;
    validate("oxygenation", body.oxygenation)?;
    Ok(Json(compute_aldrete(&body)))
}

#[cfg(test)]
mod tests {
    use super::{AldreteRequest, compute_aldrete};

    fn full() -> AldreteRequest {
        AldreteRequest {
            activity: 2,
            respiration: 2,
            circulation: 2,
            consciousness: 2,
            oxygenation: 2,
        }
    }

    #[test]
    fn full_score_is_discharge_ready() {
        let r = compute_aldrete(&full());
        assert_eq!(r.total, 10);
        assert!(r.discharge_ready);
    }

    #[test]
    fn nine_is_the_threshold() {
        let mut req = full();
        req.oxygenation = 1; // total 9
        let r = compute_aldrete(&req);
        assert_eq!(r.total, 9);
        assert!(r.discharge_ready);
    }

    #[test]
    fn eight_is_not_dischargeable() {
        let mut req = full();
        req.activity = 0; // total 8
        let r = compute_aldrete(&req);
        assert_eq!(r.total, 8);
        assert!(!r.discharge_ready);
    }
}

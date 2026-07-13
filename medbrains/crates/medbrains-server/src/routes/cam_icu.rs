//! CAM-ICU (Confusion Assessment Method for the ICU) — the standard bedside screen for delirium in
//! critically-ill patients. ICU delirium is common, under-recognised, and independently associated
//! with longer ventilation, longer stay and higher mortality, so it must be screened at least once
//! per shift. The algorithm is a fixed diagnostic tree layered on top of the RASS sedation level, so
//! it is computed server-side to keep the logic identical at every bedside. NABH critical-care and
//! patient-safety (delirium surveillance) measure.
//!
//! Algorithm (Ely et al.): first establish arousal with RASS. If RASS is -4 or -5 (deeply sedated /
//! unarousable) the patient cannot be assessed — stop and reassess later. Otherwise apply the four
//! features:
//!   Feature 1 — Acute onset of altered mental status OR a fluctuating course.
//!   Feature 2 — Inattention (errors on the letter-attention screen).
//!   Feature 3 — Altered level of consciousness (any current RASS other than 0). Derived from RASS.
//!   Feature 4 — Disorganised thinking (errors on the yes/no questions + command).
//! CAM-ICU is POSITIVE (delirium present) when Feature 1 AND Feature 2 AND (Feature 3 OR Feature 4).

use axum::{Extension, Json, extract::State};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

#[derive(Debug, Deserialize)]
pub struct CamIcuRequest {
    /// Richmond Agitation-Sedation Scale, -5 (unarousable) .. +4 (combative); 0 is alert and calm.
    pub rass: i32,
    /// Feature 1 — acute change in mental status from baseline OR a course that fluctuates over 24h.
    pub acute_change_or_fluctuating: bool,
    /// Feature 2 — inattention: the patient makes errors on the attention screen (e.g. SAVEAHAART).
    pub inattention: bool,
    /// Feature 4 — disorganised thinking: errors on the yes/no logic questions and the command.
    pub disorganized_thinking: bool,
}

#[derive(Debug, Serialize)]
pub struct CamIcuResult {
    pub rass: i32,
    /// False when RASS <= -4 — the patient is too sedated to screen and CAM-ICU is not applicable.
    pub assessable: bool,
    pub feature1_acute_or_fluctuating: bool,
    pub feature2_inattention: bool,
    /// Feature 3 — altered LOC, derived: any current RASS other than 0.
    pub feature3_altered_loc: bool,
    pub feature4_disorganized_thinking: bool,
    pub delirium_present: bool,
    pub response: &'static str,
}

pub fn compute_cam_icu(r: &CamIcuRequest) -> CamIcuResult {
    // RASS -4/-5 = deeply sedated or unarousable: the screen cannot be performed.
    if r.rass <= -4 {
        return CamIcuResult {
            rass: r.rass,
            assessable: false,
            feature1_acute_or_fluctuating: r.acute_change_or_fluctuating,
            feature2_inattention: r.inattention,
            feature3_altered_loc: false,
            feature4_disorganized_thinking: r.disorganized_thinking,
            delirium_present: false,
            response: "Deeply sedated or unarousable (RASS -4/-5) — CAM-ICU cannot be assessed. \
                       Reassess arousal and re-screen once the patient responds to voice (RASS >= -3).",
        };
    }
    // Feature 3 (altered level of consciousness) is any RASS other than alert-and-calm (0).
    let feature3 = r.rass != 0;
    let delirium_present =
        r.acute_change_or_fluctuating && r.inattention && (feature3 || r.disorganized_thinking);
    let response = if delirium_present {
        "CAM-ICU POSITIVE — delirium present. Apply the ABCDEF bundle: assess and treat pain, target \
         light sedation, minimise deliriogenic drugs (benzodiazepines, anticholinergics), screen for \
         causes (hypoxia, sepsis, metabolic, withdrawal), reorient, mobilise early and restore \
         sleep-wake cycle; inform the treating team."
    } else {
        "CAM-ICU negative — no delirium detected. Continue screening at least once per shift and on \
         any change in mental status."
    };
    CamIcuResult {
        rass: r.rass,
        assessable: true,
        feature1_acute_or_fluctuating: r.acute_change_or_fluctuating,
        feature2_inattention: r.inattention,
        feature3_altered_loc: feature3,
        feature4_disorganized_thinking: r.disorganized_thinking,
        delirium_present,
        response,
    }
}

/// `POST /api/clinical/cam-icu` — screen an ICU patient for delirium (RASS-gated CAM-ICU algorithm).
pub async fn cam_icu_assessment(
    State(_state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CamIcuRequest>,
) -> Result<Json<CamIcuResult>, AppError> {
    require_permission(&claims, permissions::ipd::nursing_assessment::LIST)?;
    if !(-5..=4).contains(&body.rass) {
        return Err(AppError::BadRequest("rass must be between -5 and +4".to_owned()));
    }
    Ok(Json(compute_cam_icu(&body)))
}

#[cfg(test)]
mod tests {
    use super::{CamIcuRequest, compute_cam_icu};

    fn req(rass: i32, acute: bool, inattention: bool, disorganized: bool) -> CamIcuRequest {
        CamIcuRequest {
            rass,
            acute_change_or_fluctuating: acute,
            inattention,
            disorganized_thinking: disorganized,
        }
    }

    #[test]
    fn deeply_sedated_is_not_assessable() {
        let r = compute_cam_icu(&req(-4, true, true, true));
        assert!(!r.assessable);
        assert!(!r.delirium_present);
    }

    #[test]
    fn positive_via_altered_loc() {
        // Feature 1 + Feature 2 present, RASS -1 makes Feature 3 (altered LOC) positive.
        let r = compute_cam_icu(&req(-1, true, true, false));
        assert!(r.assessable);
        assert!(r.feature3_altered_loc);
        assert!(r.delirium_present);
    }

    #[test]
    fn positive_via_disorganized_thinking() {
        // RASS 0 (Feature 3 negative) but disorganised thinking (Feature 4) carries it.
        let r = compute_cam_icu(&req(0, true, true, true));
        assert!(!r.feature3_altered_loc);
        assert!(r.delirium_present);
    }

    #[test]
    fn negative_without_inattention() {
        // Feature 2 absent breaks the AND — cannot be positive even with everything else.
        let r = compute_cam_icu(&req(-2, true, false, true));
        assert!(r.assessable);
        assert!(!r.delirium_present);
    }

    #[test]
    fn negative_when_only_features_3_and_4() {
        // Feature 1 absent breaks the AND.
        let r = compute_cam_icu(&req(-1, false, false, true));
        assert!(!r.delirium_present);
    }
}

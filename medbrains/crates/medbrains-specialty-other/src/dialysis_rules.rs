//! The rules of a dialysis unit, without the database: whose dialyzer this
//! is and whether it may be used again, when reprocessing has worn it out,
//! and which machine a patient may go on.

/// Dialyzer reuse when the hospital has not set its own limit.
pub const DEFAULT_MAX_USES: i32 = 6;
/// The most any hospital may set: reuse beyond this is not credible practice.
pub const MAX_ALLOWED_USES: i32 = 20;
/// A reprocessed dialyzer whose total cell volume falls below this share of
/// its first measurement has lost too many fibres to clear blood properly.
pub const MIN_TCV_PERCENT: u32 = 80;

pub const SEROLOGIES: &[&str] = &["none", "hbsag", "hcv", "hiv"];
pub const SHIFTS: &[&str] = &["morning", "afternoon", "evening", "night"];

/// What the database knows about a dialyzer when it is about to be used.
pub struct DialyzerState<'a> {
    pub patient_matches: bool,
    pub status: &'a str,
    pub uses: i32,
    pub max_uses: i32,
}

/// Why this dialyzer may not be used for this session, if it may not.
pub fn refuse_use(d: &DialyzerState<'_>) -> Option<String> {
    if !d.patient_matches {
        return Some("This dialyzer belongs to another patient; a dialyzer is never shared".to_owned());
    }
    if d.status != "in_use" {
        return Some("This dialyzer has been discarded".to_owned());
    }
    if d.uses >= d.max_uses {
        return Some(format!(
            "This dialyzer has been used {} of {} times; issue a new one",
            d.uses, d.max_uses
        ));
    }
    None
}

/// A seropositive patient's dialyzer is used once; otherwise the hospital's limit.
pub fn max_uses_for(serology: &str, hospital_limit: i32) -> i32 {
    if serology == "none" { hospital_limit.clamp(1, MAX_ALLOWED_USES) } else { 1 }
}

/// Whether a reprocessed dialyzer's TCV is still enough to use it again.
pub fn tcv_passes(baseline_ml: f64, measured_ml: f64) -> bool {
    baseline_ml > 0.0 && measured_ml * 100.0 >= baseline_ml * f64::from(MIN_TCV_PERCENT)
}

/// Why this patient may not go on this machine, if they may not.
pub fn refuse_machine(machine_serology: &str, machine_status: &str, patient_serology: &str) -> Option<String> {
    if machine_status != "active" {
        return Some(format!("This machine is {machine_status}"));
    }
    if machine_serology != patient_serology {
        return Some(if patient_serology == "none" {
            format!("This machine is kept for {} patients", machine_serology.to_uppercase())
        } else {
            format!("A {} patient goes only on a machine kept for {}", patient_serology.to_uppercase(), patient_serology.to_uppercase())
        });
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state(patient_matches: bool, status: &str, uses: i32, max_uses: i32) -> DialyzerState<'_> {
        DialyzerState { patient_matches, status, uses, max_uses }
    }

    #[test]
    fn a_dialyzer_is_never_shared_and_stops_at_its_limit() {
        assert!(refuse_use(&state(false, "in_use", 0, 6)).is_some_and(|m| m.contains("another patient")));
        assert!(refuse_use(&state(true, "discarded", 2, 6)).is_some());
        assert_eq!(refuse_use(&state(true, "in_use", 5, 6)), None);
        assert!(refuse_use(&state(true, "in_use", 6, 6)).is_some_and(|m| m.contains("6 of 6")));
    }

    #[test]
    fn a_seropositive_patients_dialyzer_is_single_use() {
        assert_eq!(max_uses_for("hbsag", 6), 1);
        assert_eq!(max_uses_for("hiv", 10), 1);
        assert_eq!(max_uses_for("none", 6), 6);
        assert_eq!(max_uses_for("none", 99), MAX_ALLOWED_USES);
    }

    #[test]
    fn worn_fibres_fail_the_tcv_check() {
        assert!(tcv_passes(100.0, 80.0));
        assert!(!tcv_passes(100.0, 79.9));
        assert!(!tcv_passes(0.0, 50.0));
    }

    #[test]
    fn serology_decides_the_machine() {
        assert_eq!(refuse_machine("none", "active", "none"), None);
        assert_eq!(refuse_machine("hbsag", "active", "hbsag"), None);
        assert!(refuse_machine("hbsag", "active", "none").is_some_and(|m| m.contains("kept for HBSAG")));
        assert!(refuse_machine("none", "active", "hcv").is_some());
        assert!(refuse_machine("none", "maintenance", "none").is_some_and(|m| m.contains("maintenance")));
    }
}

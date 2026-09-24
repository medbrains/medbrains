//! The emergency flash's decisions: which open code owns the screen, and the
//! triple-tap that silences it on this phone only.

/// Three taps inside this window is an acknowledgement, not a fidget.
pub const TRIPLE_TAP_WINDOW_MS: i64 = 700;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TapOutcome {
    /// The taps still inside the window, to feed back on the next tap.
    pub taps: Vec<i64>,
    pub triple: bool,
}

/// Feed one tap. Three taps must land inside the window together — two slow
/// taps and a third do not count.
#[must_use]
pub fn register_tap(taps: &[i64], now_ms: i64) -> TapOutcome {
    let mut recent: Vec<i64> = taps.iter().copied().filter(|t| now_ms - t < TRIPLE_TAP_WINDOW_MS).collect();
    recent.push(now_ms);
    if recent.len() >= 3 {
        TapOutcome { taps: Vec::new(), triple: true }
    } else {
        TapOutcome { taps: recent, triple: false }
    }
}

/// One open code as the flash shows it. `code_blue_id` is set for the nursing
/// code blue, which can be responded to from the phone.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpenCode {
    /// Stable across polls, so a silence sticks to one activation.
    pub key: String,
    pub label: String,
    /// The server's `code_type` (`code_blue`, `code_red`, …); the app maps it
    /// to the fixed patient-safety colour, never this crate.
    pub code_type: String,
    pub location: String,
    pub code_blue_id: Option<String>,
}

/// An arrest as the code blue list returns it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CodeBlueRef {
    pub id: String,
    pub location: String,
}

/// An emergency code as the floor list returns it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmergencyCodeRef {
    pub id: String,
    pub code_type: String,
    pub location: Option<String>,
}

/// The word for a code the phone may never have heard of: `code_silver` is
/// still an alarm, labelled "CODE SILVER".
#[must_use]
pub fn code_label(code_type: &str) -> String {
    code_type.replace('_', " ").to_uppercase()
}

/// Everything open that this phone has not silenced. A code blue comes first:
/// it is the one with a heart behind it, and the one that can be answered here.
#[must_use]
pub fn open_codes(code_blues: &[CodeBlueRef], er_codes: &[EmergencyCodeRef], silenced: &[String]) -> Vec<OpenCode> {
    let mut out: Vec<OpenCode> = code_blues
        .iter()
        .map(|cb| OpenCode {
            key: format!("cb:{}", cb.id),
            label: "CODE BLUE".to_owned(),
            code_type: "code_blue".to_owned(),
            location: cb.location.clone(),
            code_blue_id: Some(cb.id.clone()),
        })
        .collect();
    out.extend(er_codes.iter().map(|er| OpenCode {
        key: format!("er:{}", er.id),
        label: code_label(&er.code_type),
        code_type: er.code_type.clone(),
        location: er.location.clone().unwrap_or_else(|| "location not recorded".to_owned()),
        code_blue_id: None,
    }));
    out.retain(|c| !silenced.iter().any(|s| s == &c.key));
    out
}

#[cfg(test)]
mod tests {
    use super::{CodeBlueRef, EmergencyCodeRef, code_label, open_codes, register_tap};

    fn cb() -> CodeBlueRef {
        CodeBlueRef { id: "cb1".into(), location: "Ward 1".into() }
    }
    fn fire() -> EmergencyCodeRef {
        EmergencyCodeRef { id: "er1".into(), code_type: "code_red".into(), location: Some("Kitchen".into()) }
    }

    #[test]
    fn a_code_blue_outranks_a_fire_called_first() {
        let open = open_codes(&[cb()], &[fire()], &[]);
        assert_eq!(open[0].code_blue_id.as_deref(), Some("cb1"));
        assert_eq!(open[1].label, "CODE RED");
    }

    #[test]
    fn silencing_one_code_does_not_silence_the_other() {
        let open = open_codes(&[cb()], &[fire()], &["cb:cb1".into()]);
        let keys: Vec<&str> = open.iter().map(|c| c.key.as_str()).collect();
        assert_eq!(keys, vec!["er:er1"]);
    }

    #[test]
    fn an_unknown_code_is_still_an_alarm_in_words() {
        assert_eq!(code_label("code_silver"), "CODE SILVER");
        let open = open_codes(&[], &[EmergencyCodeRef { location: None, ..fire() }], &[]);
        assert_eq!(open[0].location, "location not recorded");
    }

    #[test]
    fn three_quick_taps_silence() {
        let s = register_tap(&[], 0);
        let s = register_tap(&s.taps, 200);
        let s = register_tap(&s.taps, 400);
        assert!(s.triple);
        assert!(s.taps.is_empty());
    }

    #[test]
    fn three_taps_spread_over_the_window_do_not() {
        let s = register_tap(&[], 0);
        let s = register_tap(&s.taps, 500);
        let s = register_tap(&s.taps, 1000);
        assert!(!s.triple);
    }

    #[test]
    fn a_slow_tap_then_two_quick_ones_is_not_a_triple() {
        let s = register_tap(&[], 0);
        let s = register_tap(&s.taps, 900);
        let s = register_tap(&s.taps, 1000);
        assert!(!s.triple);
        assert_eq!(s.taps.len(), 2);
    }
}

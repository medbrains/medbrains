//! Translating an analyzer's HL7 abnormal-flag into `lab_result_flag`.
//!
//! The old mapping was wrong in three ways, and all three failed towards
//! "normal".
//!
//! `HH` and `LL` are HL7 Table 0078's *panic* codes -- the analyzer saying this
//! value needs somebody telephoned -- and they were mapped onto plain
//! `high`/`low`. `critical_high` and `critical_low` were reachable only from
//! `HU`/`LU`, which are not in Table 0078 at all, so no conforming analyzer
//! could ever raise a critical result and the critical-alert path was
//! unreachable over HL7.
//!
//! `A` and `AA` were mapped to the string `"abnormal"`, which is not one of the
//! `lab_result_flag` enum's values, so the insert casting `$n::lab_result_flag`
//! would fail outright.
//!
//! And the catch-all mapped every unrecognised code to `normal`, so a flag this
//! build had never seen was recorded as a reassurance. There is no way to say
//! "abnormal, direction unknown" in this enum -- `A`, `AA` and the off-scale
//! markers are all like that -- so those record no flag instead. A missing flag
//! leaves the value to be judged on its own merits and keeps it out of
//! autoverification; a wrong flag of `normal` does neither.

/// `None` means the analyzer's assertion cannot be expressed as a
/// `lab_result_flag`. It never means normal.
pub(crate) fn map_hl7_flag(flag: Option<&str>) -> Option<&'static str> {
    match flag.map(str::trim) {
        // The analyzer positively asserted the value is in range.
        Some("N") => Some("normal"),
        Some("H") => Some("high"),
        Some("L") => Some("low"),
        // Table 0078: "above/below upper/lower panic limits".
        Some("HH") => Some("critical_high"),
        Some("LL") => Some("critical_low"),
        // Absent, or a code carrying no direction we can record: A, AA, the
        // off-scale markers `>` and `<`, the susceptibility codes, and
        // anything a future analyzer sends.
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::map_hl7_flag;

    #[test]
    fn panic_codes_become_critical_not_merely_abnormal() {
        // The regression. HH/LL are what an analyzer sends when a value needs
        // somebody telephoned; mapping them to high/low kept every HL7 result
        // out of the critical-alert path.
        assert_eq!(map_hl7_flag(Some("HH")), Some("critical_high"));
        assert_eq!(map_hl7_flag(Some("LL")), Some("critical_low"));
    }

    #[test]
    fn ordinary_direction_codes_map_across() {
        assert_eq!(map_hl7_flag(Some("H")), Some("high"));
        assert_eq!(map_hl7_flag(Some("L")), Some("low"));
        assert_eq!(map_hl7_flag(Some("N")), Some("normal"));
    }

    #[test]
    fn a_directionless_abnormal_records_no_flag_rather_than_normal() {
        // `A`/`AA` say "abnormal" without saying which way, and the enum has no
        // word for that. Recording `normal` would invert the analyzer's meaning
        // exactly where it matters most.
        assert_eq!(map_hl7_flag(Some("A")), None);
        assert_eq!(map_hl7_flag(Some("AA")), None);
    }

    #[test]
    fn an_unrecognised_code_is_never_read_as_normal() {
        // The catch-all used to answer "normal" here, so a flag from a newer
        // analyzer became a reassurance rather than an unknown.
        assert_eq!(map_hl7_flag(Some(">")), None);
        assert_eq!(map_hl7_flag(Some("VS")), None);
        assert_eq!(map_hl7_flag(Some("something-new")), None);
    }

    #[test]
    fn an_absent_or_empty_flag_asserts_nothing() {
        // HL7 leaves OBX-8 empty when the analyzer makes no claim, which is not
        // the same as claiming the value is in range. The reference range
        // judges it instead.
        assert_eq!(map_hl7_flag(None), None);
        assert_eq!(map_hl7_flag(Some("")), None);
        assert_eq!(map_hl7_flag(Some("   ")), None);
    }

    #[test]
    fn surrounding_whitespace_does_not_hide_a_panic_code() {
        assert_eq!(map_hl7_flag(Some(" HH ")), Some("critical_high"));
    }
}

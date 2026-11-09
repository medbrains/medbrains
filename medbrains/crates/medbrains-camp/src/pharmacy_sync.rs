//! Which medicines a camp may dispense offline and sync later.
//!
//! A camp's dispense arrives after the fact, from a device that had no
//! witness check, no NDPS register and no retained duplicate. Schedule X,
//! NDPS and controlled drugs therefore never travel this path: the sync
//! refuses the line and names it, and the drug is dispensed at a hospital
//! pharmacy counter. Schedule H and H1 lines go through the hospital's own
//! gate (`medbrains_pharmacy::schedule_gate`) against the synced prescription.

/// The sync error for one line, when its drug may not be dispensed by a camp.
pub(crate) fn controlled_line_refusal(
    drug_name: &str,
    schedule: Option<&str>,
    is_controlled: bool,
    narcotic_class: Option<&str>,
) -> Option<String> {
    let kind = match schedule {
        Some("X") => "Schedule X",
        Some("NDPS") => "NDPS",
        _ if is_controlled || narcotic_class.is_some() => "controlled",
        _ => return None,
    };
    Some(format!(
        "{drug_name}: a {kind} drug cannot be dispensed through camp offline sync; dispense it at \
         the hospital pharmacy counter with a witness"
    ))
}

#[cfg(test)]
mod tests {
    use super::controlled_line_refusal;

    #[test]
    fn only_schedule_x_ndps_and_controlled_lines_are_refused() {
        let x = controlled_line_refusal("Buprenorphine 2mg", Some("X"), true, None);
        assert!(x.is_some_and(|m| m.contains("Buprenorphine 2mg") && m.contains("Schedule X")));
        assert!(controlled_line_refusal("Morphine 10mg", Some("NDPS"), true, None).is_some());
        assert!(controlled_line_refusal("Tramadol", Some("H"), true, None).is_some());
        assert!(controlled_line_refusal("Codeine", None, false, Some("opioid")).is_some());
        assert!(controlled_line_refusal("Amoxicillin", Some("H"), false, None).is_none());
        assert!(controlled_line_refusal("Paracetamol", None, false, None).is_none());
    }
}

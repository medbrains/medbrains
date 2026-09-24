//! The handheld consultation note's rule, mirroring
//! `mobileStaffConsultationFormSchema`: a chief complaint is required, the
//! rest bounded. The message is the one the field shows.

/// `Some(message)` when the note may not be saved.
#[must_use]
pub fn consultation_problem(chief_complaint: &str, examination: &str, assessment: &str, plan: &str) -> Option<String> {
    if chief_complaint.trim().is_empty() {
        return Some("Record why the patient is here".to_owned());
    }
    if chief_complaint.chars().count() > 2000 {
        return Some("Chief complaint is too long".to_owned());
    }
    for (text, label) in [(examination, "Examination"), (assessment, "Assessment"), (plan, "Plan")] {
        if text.chars().count() > 4000 {
            return Some(format!("{label} is too long"));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::consultation_problem;

    #[test]
    fn refuses_an_empty_complaint_on_the_field() {
        assert_eq!(consultation_problem("   ", "", "", ""), Some("Record why the patient is here".to_owned()));
        assert_eq!(consultation_problem("Fever", "", "", ""), None);
    }

    #[test]
    fn bounds_each_field() {
        let long = "x".repeat(4001);
        assert_eq!(consultation_problem("Fever", &long, "", ""), Some("Examination is too long".to_owned()));
        assert_eq!(consultation_problem(&"x".repeat(2001), "", "", ""), Some("Chief complaint is too long".to_owned()));
    }
}

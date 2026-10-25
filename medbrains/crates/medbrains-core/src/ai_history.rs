//! What a turn remembers of a long conversation.
//!
//! The last few messages in
//! full ([`crate::ai_guard::HISTORY_MESSAGES`]) and, before them, the user's
//! own earlier questions as one short line — so a terse follow-up ("total
//! charges", "past 12 months") still reads in the topic set many turns ago.
//! No model call makes it: the questions are quoted, trimmed, as asked.

/// Earlier user questions the line keeps (the most recent ones).
pub const EARLIER_QUESTIONS: usize = 6;
/// Characters kept of each earlier question.
const QUESTION_CHARS: usize = 140;

/// The line for `earlier` (the user's older questions, oldest first, in the
/// model's form), or `None` when there are none.
#[must_use]
pub fn earlier_questions(earlier: &[&str]) -> Option<String> {
    let kept: Vec<String> = earlier
        .iter()
        .rev()
        .take(EARLIER_QUESTIONS)
        .rev()
        .map(|q| {
            let q = q.trim().replace('\n', " ");
            let cut: String = q.chars().take(QUESTION_CHARS).collect();
            format!("\"{cut}\"")
        })
        .filter(|q| q.len() > 2)
        .collect();
    (!kept.is_empty()).then(|| {
        format!(
            "Earlier in this conversation the user asked: {}. Read a short follow-up in that light.",
            kept.join("; ")
        )
    })
}

#[cfg(test)]
mod tests {
    use super::{EARLIER_QUESTIONS, earlier_questions};

    #[test]
    fn the_topic_set_long_ago_survives_as_one_line() {
        let line = earlier_questions(&["What was our revenue this month?", "And collections?"]);
        assert_eq!(
            line.as_deref(),
            Some(
                "Earlier in this conversation the user asked: \"What was our revenue this \
                 month?\"; \"And collections?\". Read a short follow-up in that light."
            )
        );
        assert_eq!(earlier_questions(&[]), None);
    }

    #[test]
    fn only_the_most_recent_earlier_questions_are_kept_and_each_is_short() {
        let many: Vec<String> = (0..10).map(|i| format!("q{i}")).collect();
        let refs: Vec<&str> = many.iter().map(String::as_str).collect();
        let line = earlier_questions(&refs).unwrap_or_default();
        assert!(!line.contains("\"q3\"") && line.contains("\"q4\"") && line.contains("\"q9\""));
        assert_eq!(line.matches('"').count(), 2 * EARLIER_QUESTIONS);
        let long = "x".repeat(500);
        assert!(earlier_questions(&[&long]).unwrap_or_default().len() < 260);
    }
}

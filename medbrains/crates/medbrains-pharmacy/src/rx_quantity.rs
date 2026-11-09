//! How much a prescription line adds up to: dose x doses a day x days.
//!
//! The Schedule H/H1/X gate caps a dispense on this number when the line
//! states no quantity, so a frequency it cannot read exactly is uncountable
//! (`None`), never a guess: weekly, fortnightly and monthly schedules, as-needed
//! doses (PRN, SOS, "if needed", "as required") and words it does not know.
//! "stat" is one dose. Intervals are read as numbers — "every 48 hours" and
//! `q4h` are 24/N doses a day — not by spotting a substring, which read
//! "every 4 days" as six doses a day and "twice weekly" as two; "N hours"
//! counts only as "every N hours", "qN h" or "N hourly". Only a dose in a
//! discrete unit (tablet, capsule, sachet, suppository, patch, vial, ampoule)
//! is counted: "5 ml" or "2 puffs" says nothing about how many bottles or
//! inhalers leave the shelf, so the doctor states the quantity.

/// How often a dose is taken, as far as the words say.
#[derive(Debug, Clone, Copy, PartialEq)]
enum Frequency {
    /// Once, now: one dose whatever the duration.
    Stat,
    PerDay(f64),
}

/// Word stems of a schedule slower than daily, which the cap does not count.
const SLOWER_THAN_DAILY: [&str; 4] = ["week", "wk", "month", "fortnight"];
/// Words of an as-needed dose, which has no countable quantity.
const AS_NEEDED: [&str; 4] = ["prn", "sos", "needed", "required"];
/// Spellings of "hour" after an interval's number.
const HOUR_WORDS: [&str; 7] = ["h", "hr", "hrs", "hour", "hours", "hourly", "hrly"];

/// Doses a day for a frequency the cap can count, or `None` for one it cannot.
fn read_frequency(frequency: &str) -> Option<Frequency> {
    let text = frequency.trim().to_ascii_lowercase();
    if text.is_empty() {
        return None;
    }
    if let Some(sum) = dash_frequency_units_per_day(&text) {
        return Some(Frequency::PerDay(sum));
    }
    // "t.d.s." is tds.
    let text = text.replace('.', "");
    let words: Vec<&str> = text
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|w| !w.is_empty())
        .collect();
    let slower = words
        .iter()
        .any(|w| SLOWER_THAN_DAILY.iter().any(|s| w.starts_with(s)));
    if slower || words.iter().any(|w| AS_NEEDED.contains(w)) {
        return None;
    }
    if words.contains(&"stat") {
        return Some(Frequency::Stat);
    }
    interval_per_day(&words)
        .or_else(|| keyword_per_day(&words))
        .map(Frequency::PerDay)
}

/// "1-0-1" style: the doses at each time of day, summed.
fn dash_frequency_units_per_day(text: &str) -> Option<f64> {
    let parts: Vec<&str> = text.split('-').collect();
    if parts.len() < 2 {
        return None;
    }
    let mut sum = 0.0;
    for part in parts {
        let trimmed = part.trim();
        if trimmed.is_empty() || !trimmed.chars().all(|ch| ch.is_ascii_digit()) {
            return None;
        }
        sum += trimmed.parse::<f64>().ok()?;
    }
    (sum > 0.0).then_some(sum)
}

/// A number with an hour unit glued on ("8h", "6hourly", "q4h"), and whether
/// the word itself says it is an interval (a `q` prefix or "hourly").
fn glued_hours(word: &str) -> Option<(f64, bool)> {
    let (rest, q) = word.strip_prefix('q').map_or((word, false), |r| (r, true));
    let split = rest.find(|c: char| !c.is_ascii_digit())?;
    let (number, unit) = rest.split_at(split);
    if number.is_empty() || !HOUR_WORDS.contains(&unit) {
        return None;
    }
    Some((number.parse().ok()?, q || unit.ends_with("ly")))
}

/// Doses a day from an interval: every N hours (`q4h`, "8 hourly", "every 48
/// hours") is 24/N; every N days ("every 4 days", "every other day") is 1/N.
/// "N hours" is an interval only after "every" or "q", or spelt "hourly":
/// "once daily at 8 hrs" is a time of day, not every eight hours.
fn interval_per_day(words: &[&str]) -> Option<f64> {
    for (i, word) in words.iter().enumerate() {
        let next = words.get(i + 1).copied().unwrap_or_default();
        let prev = if i > 0 { words[i - 1] } else { "" };
        let after_every = prev == "every";
        let introduced = after_every || prev == "q";
        let hours = glued_hours(word)
            .and_then(|(n, says)| (says || introduced).then_some(n))
            .or_else(|| {
                word.parse::<f64>()
                    .ok()
                    .filter(|_| HOUR_WORDS.contains(&next) && (introduced || next.ends_with("ly")))
            });
        if let Some(n) = hours.filter(|n| *n > 0.0) {
            return Some(24.0 / n);
        }
        let days = match *word {
            "other" | "alternate" if after_every => Some(2.0),
            _ if after_every && matches!(next, "day" | "days") => word.parse::<f64>().ok(),
            _ => None,
        };
        if let Some(n) = days.filter(|n| *n > 0.0) {
            return Some(1.0 / n);
        }
    }
    None
}

/// Doses a day from the usual Latin and English words.
fn keyword_per_day(words: &[&str]) -> Option<f64> {
    let has = |w: &str| words.contains(&w);
    let times = |n: &str| has(n) && has("times");
    if has("qid") || has("qds") || times("four") {
        Some(4.0)
    } else if has("tid") || has("tds") || times("three") {
        Some(3.0)
    } else if has("bid") || has("bd") || has("twice") {
        Some(2.0)
    } else if has("qod") || has("eod") || has("alternate") {
        Some(0.5)
    } else if ["od", "qd", "hs", "qhs", "nocte", "once", "daily"]
        .iter()
        .any(|w| has(w))
        || (has("every") && has("day"))
    {
        Some(1.0)
    } else {
        None
    }
}

/// The first number in the text, decimals included.
fn first_number(text: &str) -> Option<f64> {
    let mut buf = String::new();
    let mut seen_digit = false;
    for ch in text.chars() {
        if ch.is_ascii_digit() || (ch == '.' && seen_digit && !buf.contains('.')) {
            seen_digit |= ch.is_ascii_digit();
            buf.push(ch);
        } else if seen_digit {
            break;
        }
    }
    if seen_digit { buf.parse().ok() } else { None }
}

/// Days a duration covers; one when it names no number.
fn duration_days(duration: &str) -> f64 {
    let d = duration.trim().to_ascii_lowercase();
    let Some(value) = first_number(&d) else {
        return 1.0;
    };
    if d.contains("week") || d.contains(" wk") || d.ends_with("wk") {
        value * 7.0
    } else if d.contains("month") || d.contains(" mon") || d.ends_with("mo") {
        value * 30.0
    } else if d.contains("hour") || d.ends_with('h') {
        (value / 24.0).max(1.0)
    } else {
        value
    }
}

/// Discrete dispensing units a dose can be counted in. A vial or ampoule
/// counts when the dose is stated in vials or ampoules, i.e. the item is one.
const DISCRETE_UNITS: [&str; 22] = [
    "tab",
    "tabs",
    "tablet",
    "tablets",
    "cap",
    "caps",
    "capsule",
    "capsules",
    "sachet",
    "sachets",
    "suppository",
    "suppositories",
    "supp",
    "patch",
    "patches",
    "vial",
    "vials",
    "amp",
    "amps",
    "ampoule",
    "ampoules",
    "ampule",
];

/// Byte offset of the first word in `d` that is a discrete dispensing unit.
fn unit_word_at(d: &str) -> Option<usize> {
    let mut start = None;
    for (i, c) in d.char_indices().chain(std::iter::once((d.len(), ' '))) {
        match (c.is_ascii_alphabetic(), start) {
            (true, None) => start = Some(i),
            (false, Some(s)) => {
                if DISCRETE_UNITS.contains(&&d[s..i]) {
                    return Some(s);
                }
                start = None;
            }
            _ => {}
        }
    }
    None
}

/// Discrete units per dose, read from the number just before the unit word
/// ("2 tabs" is 2, "500 mg 1 tab" is 1, "1/2 tab" counts as 1, a unit with
/// no number before it as 1), or `None` when the dose is not stated in a
/// discrete dispensing unit: "5 ml", "2 drops", "2 puffs", "1 g", "500 mg",
/// "10 units" say nothing about how many packs leave the shelf.
fn dose_units_per_administration(dosage: &str) -> Option<f64> {
    let d = dosage.trim().to_ascii_lowercase();
    let before = d[..unit_word_at(&d)?].trim_end();
    let digits = before.len()
        - before
            .trim_end_matches(|c: char| c.is_ascii_digit() || c == '.' || c == '/')
            .len();
    let number = &before[before.len() - digits..];
    let value = match number.split_once('/') {
        Some((n, m)) => n
            .parse::<f64>()
            .ok()
            .zip(m.parse::<f64>().ok())
            .map(|(n, m)| n / m),
        None => number.parse::<f64>().ok(),
    };
    Some(value.filter(|v| v.is_finite()).map_or(1.0, |v| v.max(1.0)))
}

/// Units for a counted frequency: one dose for stat, else per day x days.
fn units(per_dose: f64, frequency: Frequency, duration: &str) -> i32 {
    let doses = match frequency {
        Frequency::Stat => 1.0,
        Frequency::PerDay(per_day) => per_day * duration_days(duration),
    };
    (per_dose * doses).ceil().clamp(1.0, 9_999.0) as i32
}

/// The quantity a prescription line adds up to, when its dose is in a
/// discrete unit and its frequency is one the cap can count: the Schedule
/// H/H1 gate's ceiling for a line that states no quantity of its own. `None`
/// means the line cannot back a scheduled dispense: the doctor states it.
pub(crate) fn countable_rx_quantity(dosage: &str, frequency: &str, duration: &str) -> Option<i32> {
    let per_dose = dose_units_per_administration(dosage)?;
    read_frequency(frequency).map(|f| units(per_dose, f, duration))
}

/// The dispense-quantity estimate: one dose a day for a spelling the cap
/// cannot count, and one unit a dose for a dose not in a discrete unit, which
/// the pharmacist corrects at review.
pub(crate) fn estimate_rx_dispense_quantity(dosage: &str, frequency: &str, duration: &str) -> i32 {
    let frequency = read_frequency(frequency).unwrap_or(Frequency::PerDay(1.0));
    units(
        dose_units_per_administration(dosage).unwrap_or(1.0),
        frequency,
        duration,
    )
}

#[cfg(test)]
mod tests {
    use super::countable_rx_quantity;

    /// One tablet a dose, for `duration`.
    fn count(frequency: &str, duration: &str) -> Option<i32> {
        countable_rx_quantity("1 tab", frequency, duration)
    }

    #[test]
    fn schedules_slower_than_daily_and_as_needed_doses_are_not_counted() {
        for spelling in [
            "once weekly",
            "twice weekly",
            "q4h prn",
            "SOS",
            "1 tab if needed",
            "as required",
            "monthly",
            "every 2 weeks",
            "",
            "whenever",
        ] {
            assert_eq!(count(spelling, "5 days"), None, "{spelling:?}");
        }
    }

    #[test]
    fn intervals_are_read_as_numbers() {
        assert_eq!(count("every 4 days", "8 days"), Some(2));
        assert_eq!(count("every 48 hours", "10 days"), Some(5));
        assert_eq!(count("q4h", "2 days"), Some(12));
        assert_eq!(count("Q6H", "1 day"), Some(4));
        assert_eq!(count("8 hourly", "5 days"), Some(15));
        assert_eq!(count("every 12h", "5 days"), Some(10));
        assert_eq!(count("every other day", "10 days"), Some(5));
    }

    #[test]
    fn stat_is_one_dose_and_the_usual_words_still_count() {
        assert_eq!(count("stat", "5 days"), Some(1));
        assert_eq!(countable_rx_quantity("2 tabs", "STAT", "3 days"), Some(2));
        assert_eq!(count("BD", "5 days"), Some(10));
        assert_eq!(count("t.d.s.", "5 days"), Some(15));
        assert_eq!(count("three times a day", "2 days"), Some(6));
        assert_eq!(count("1-0-1", "5 days"), Some(10));
        assert_eq!(count("once daily", "1 week"), Some(7));
        // "bd" inside another word is not twice a day.
        assert_eq!(count("abdominal", "5 days"), None);
    }

    #[test]
    fn an_hour_is_an_interval_only_after_every_or_q() {
        assert_eq!(count("once daily at 8 hrs", "5 days"), Some(5));
        assert_eq!(count("OD at 8h", "5 days"), Some(5));
        assert_eq!(count("q 6 h", "1 day"), Some(4));
        assert_eq!(count("6 hrly", "1 day"), Some(4));
    }

    #[test]
    fn only_a_discrete_dispensing_unit_is_counted() {
        for dose in [
            "5 ml", "2 drops", "2 puffs", "1 g", "500 mg", "10 units", "1", "",
        ] {
            assert_eq!(
                countable_rx_quantity(dose, "tds", "5 days"),
                None,
                "{dose:?}"
            );
        }
        assert_eq!(countable_rx_quantity("2 tabs", "bd", "5 days"), Some(20));
        assert_eq!(
            countable_rx_quantity("1 cap (500 mg)", "tds", "5 days"),
            Some(15)
        );
        assert_eq!(countable_rx_quantity("1 sachet", "od", "3 days"), Some(3));
        assert_eq!(
            countable_rx_quantity("500 mg 1 tab", "bd", "5 days"),
            Some(10),
            "the number before the unit, not the strength"
        );
        assert_eq!(countable_rx_quantity("2tabs", "od", "3 days"), Some(6));
        assert_eq!(countable_rx_quantity("1/2 tab", "od", "4 days"), Some(4));
        assert_eq!(countable_rx_quantity("1 vial", "bd", "2 days"), Some(4));
        assert_eq!(
            countable_rx_quantity("1 patch", "every 3 days", "9 days"),
            Some(3)
        );
    }
}

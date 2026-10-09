//! What a structured note section says, as lines a reader of the printed
//! case sheet takes in: the paper sheet's "PMH: DM (controlled)".
//!
//! The screen says the same through `section-summary.ts`; both are held to
//! `fixtures/section-summary.json`.

use serde_json::{Map, Value};

fn text<'a>(v: &'a Value, key: &str) -> Option<&'a str> {
    v.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
}

fn humanise(key: &str) -> String {
    let spaced = key.replace('_', " ");
    let mut chars = spaced.chars();
    chars.next().map_or_else(String::new, |first| {
        first.to_uppercase().chain(chars).collect()
    })
}

fn joined<I: IntoIterator<Item = Option<String>>>(parts: I) -> String {
    parts
        .into_iter()
        .flatten()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(", ")
}

fn list(v: &Value, key: &str) -> Vec<Value> {
    v.get(key)
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

/// Keys in a fixed order: the database does not keep the order they were
/// written in, and the print must read the same as the screen.
fn sorted(map: &Map<String, Value>) -> Vec<(&String, &Value)> {
    let mut entries: Vec<_> = map.iter().collect();
    entries.sort_by(|a, b| a.0.cmp(b.0));
    entries
}

fn history_lines(d: &Value) -> Vec<String> {
    let social = d.get("social_history").cloned().unwrap_or(Value::Null);
    let habit = |key: &str, label: &str| {
        social
            .get(key)
            .and_then(|h| text(h, "status"))
            .map(|s| format!("{label} {s}"))
    };
    let habits = joined([
        habit("smoking", "smoking"),
        habit("alcohol", "alcohol"),
        habit("tobacco_chewing", "tobacco chewing"),
        text(&social, "occupation").map(|o| format!("works as {o}")),
        text(&social, "notes").map(str::to_owned),
    ]);
    let pmh = joined(list(d, "past_medical_history").iter().map(|e| {
        Some(format!(
            "{} ({})",
            text(e, "condition").unwrap_or_default(),
            text(e, "status").unwrap_or_default()
        ))
    }));
    let psh = joined(list(d, "past_surgical_history").iter().map(|e| {
        Some(joined([
            text(e, "procedure").map(str::to_owned),
            e.get("year").filter(|y| !y.is_null()).map(|y| match y {
                Value::String(s) => s.clone(),
                other => other.to_string(),
            }),
        ]))
    }));
    let family = joined(list(d, "family_history").iter().map(|e| {
        Some(format!(
            "{}: {}",
            text(e, "relation").unwrap_or_default(),
            text(e, "condition").unwrap_or_default()
        ))
    }));
    [
        text(d, "hpi").map(|h| format!("HPI: {h}")),
        (!pmh.is_empty()).then(|| format!("Past medical: {pmh}")),
        (!psh.is_empty()).then(|| format!("Past surgical: {psh}")),
        (!family.is_empty()).then(|| format!("Family: {family}")),
        (!habits.is_empty()).then(|| format!("Social: {habits}")),
    ]
    .into_iter()
    .flatten()
    .collect()
}

fn ros_lines(d: &Map<String, Value>) -> Vec<String> {
    let entries: Vec<_> = sorted(d)
        .into_iter()
        .filter(|(_, v)| !v.is_null())
        .collect();
    let abnormal = |v: &Value| v.get("abnormal").and_then(Value::as_bool).unwrap_or(false);
    let mut lines: Vec<String> = entries
        .iter()
        .filter(|(_, v)| abnormal(v))
        .map(|(k, v)| {
            format!(
                "{}: {}",
                humanise(k),
                text(v, "details").unwrap_or("abnormal")
            )
        })
        .collect();
    let normal: Vec<String> = entries
        .iter()
        .filter(|(_, v)| !abnormal(v))
        .map(|(k, _)| humanise(k))
        .collect();
    if !normal.is_empty() {
        lines.push(format!("Normal: {}", normal.join(", ")));
    }
    lines
}

/// A body site as the examination tab shows it: the side added unless the
/// label already says it.
fn body_site(label: &str, laterality: Option<&str>) -> String {
    match laterality {
        Some(side)
            if !label
                .split(|c: char| !c.is_alphanumeric())
                .any(|w| w.eq_ignore_ascii_case(side)) =>
        {
            format!("{label} ({side})")
        }
        _ => label.to_owned(),
    }
}

fn exam_lines(d: &Value) -> Vec<String> {
    let mut lines: Vec<String> = text(d, "general_appearance")
        .map(|g| format!("General appearance: {g}"))
        .into_iter()
        .collect();
    let Some(exam) = d.get("exam").and_then(Value::as_object) else {
        return lines;
    };
    for (k, v) in sorted(exam) {
        if let Some(s) = v.as_str().map(str::trim).filter(|s| !s.is_empty())
            && k != "findings"
        {
            lines.push(format!("{}: {s}", humanise(k)));
        }
    }
    for f in exam
        .get("findings")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        let site = body_site(
            f.get("site").and_then(Value::as_str).unwrap_or_default(),
            f.get("laterality").and_then(Value::as_str),
        );
        let finding = f.get("finding").and_then(Value::as_str).unwrap_or_default();
        lines.push(format!("{site}: {finding}"));
    }
    lines
}

/// The lines a structured section reads as; none when it records nothing.
pub fn summarise_section(code: &str, data: &Value) -> Vec<String> {
    match (code, data) {
        ("history", Value::Object(_)) => history_lines(data),
        ("ros", Value::Object(map)) => ros_lines(map),
        ("examination", Value::Object(_)) => exam_lines(data),
        _ => Vec::new(),
    }
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn the_print_reads_the_same_as_the_screen() {
        let fixture: Vec<Value> =
            serde_json::from_str(include_str!("../fixtures/section-summary.json"))
                .expect("fixture");
        for case in fixture {
            let lines: Vec<String> = serde_json::from_value(case["lines"].clone()).expect("lines");
            assert_eq!(
                summarise_section(case["code"].as_str().expect("code"), &case["data"]),
                lines,
                "{}",
                case["name"]
            );
        }
    }
}

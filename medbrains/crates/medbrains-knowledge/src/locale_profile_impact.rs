//! What a locale-profile change does, as impact lines for the approver.

use medbrains_country::Field;

use crate::locale_profile::LocaleProfileRow;
use crate::model::{KnowledgeImpactEntry, Severity};

/// One impact line per changed field that matters beyond display.
pub(crate) fn impact_of(
    before: &LocaleProfileRow,
    after: &LocaleProfileRow,
    schedules: i64,
) -> Vec<KnowledgeImpactEntry> {
    let name = after
        .scope_name
        .as_deref()
        .or(before.scope_name.as_deref())
        .unwrap_or("This scope");
    let changed = |f: Field| {
        before.values.get(f.key()).filter(|v| !v.is_null())
            != after.values.get(f.key()).filter(|v| !v.is_null())
    };
    let show = |r: &LocaleProfileRow, f: Field| {
        r.values
            .get(f.key())
            .filter(|v| !v.is_null())
            .map_or_else(|| "inherited".to_owned(), ToString::to_string)
    };
    let entry = |severity, relation: &str, summary: String, count| KnowledgeImpactEntry {
        severity,
        relation: relation.to_owned(),
        summary,
        count,
        examples: Vec::new(),
        truncated: false,
    };
    let mut out = Vec::new();
    if changed(Field::Country) {
        let pack = |r: &LocaleProfileRow| {
            medbrains_country::pack::for_country(r.text(Field::Country))
                .map_or_else(|_| "?".to_owned(), |p| p.pack.name.clone())
        };
        out.push(entry(Severity::Safety, "country", format!(
            "{name}: country {} → {}. The {} pack's rules switch off and the {} pack's switch on",
            show(before, Field::Country), show(after, Field::Country), pack(before), pack(after)), 1));
    }
    if changed(Field::Currency) {
        out.push(entry(
            Severity::Money,
            "currency",
            format!(
                "{name}: every amount shows as {} instead of {}",
                show(after, Field::Currency),
                show(before, Field::Currency)
            ),
            1,
        ));
    }
    if changed(Field::Timezone) {
        out.push(entry(Severity::Info, "doctor_schedules", format!(
            "{name}: clinical times show in {} instead of {}. Doctor schedules are wall-clock times: review them",
            show(after, Field::Timezone), show(before, Field::Timezone)), schedules));
    }
    let display: Vec<&str> = Field::ALL
        .iter()
        .filter(|f| {
            !matches!(f, Field::Country | Field::Currency | Field::Timezone) && changed(**f)
        })
        .map(|f| f.key())
        .collect();
    if !display.is_empty() {
        out.push(entry(
            Severity::Info,
            "display",
            format!(
                "{name}: {} change on every screen and print",
                display.join(", ")
            ),
            i64::try_from(display.len()).unwrap_or(i64::MAX),
        ));
    }
    out
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use serde_json::{Value, json};
    use uuid::Uuid;

    use super::*;

    fn row(values: Value) -> LocaleProfileRow {
        let mut v = values;
        v["scope_id"] = json!(Uuid::nil());
        serde_json::from_value(v).unwrap()
    }

    #[test]
    fn a_country_change_is_graded_safety_and_names_both_packs() {
        let before = row(json!({"country": "IN", "currency": "INR"}));
        let after = row(json!({"country": "AE", "currency": "INR"}));
        let impact = impact_of(&before, &after, 0);
        assert_eq!(impact.len(), 1);
        assert_eq!(impact[0].severity, Severity::Safety);
        assert!(impact[0].summary.contains("India"), "{}", impact[0].summary);
    }

    #[test]
    fn a_timezone_change_counts_wall_clock_schedules() {
        let before = row(json!({"timezone": "Asia/Kolkata"}));
        let after = row(json!({"timezone": "Asia/Dubai", "hour_cycle": "h23"}));
        let impact = impact_of(&before, &after, 7);
        assert!(
            impact
                .iter()
                .any(|e| e.relation == "doctor_schedules" && e.count == 7)
        );
        assert!(impact.iter().any(|e| e.relation == "display"));
    }
}

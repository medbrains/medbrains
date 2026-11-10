//! Rich answers are exact: every value a widget shows is a value of the tool
//! result it was built from, never one the model wrote.

use medbrains_ai_eval::default_cases_dir;
use medbrains_core::ai_widgets::{Widget, build};
use serde_json::Value;

/// Every scalar anywhere in `v`.
fn scalars(v: &Value, out: &mut Vec<Value>) {
    match v {
        Value::Object(m) => m.values().for_each(|x| scalars(x, out)),
        Value::Array(a) => a.iter().for_each(|x| scalars(x, out)),
        other => out.push(other.clone()),
    }
}

/// The values a widget shows (labels are derived from keys, not values).
fn shown(w: &Widget) -> Vec<Value> {
    match w {
        Widget::Kpis { tiles, .. } => tiles.iter().map(|t| t.value.clone()).collect(),
        Widget::Table { rows, .. } | Widget::Chart { rows, .. } => {
            rows.iter().flat_map(|r| r.values().cloned()).collect()
        }
        Widget::List { items, .. } => items
            .iter()
            .filter_map(|i| i.status.clone().map(Value::String))
            .collect(),
    }
}

#[test]
fn every_widget_value_comes_from_its_tool_result() {
    let dir = default_cases_dir().join("widgets");
    let mut seen = 0;
    for entry in std::fs::read_dir(&dir).into_iter().flatten().flatten() {
        let text = std::fs::read_to_string(entry.path()).unwrap_or_default();
        let case: Value = serde_json::from_str(&text).unwrap_or_default();
        let (kind, title) = (
            case["kind"].as_str().unwrap_or(""),
            case["title"].as_str().unwrap_or(""),
        );
        let built = build(kind, title, &case["source"]);
        assert!(built.is_ok(), "{}: {built:?}", entry.path().display());
        let Ok(widget) = built else { continue };
        let mut source = Vec::new();
        scalars(&case["source"], &mut source);
        // A list's status is the record's value written as text (false → "false").
        let as_text: Vec<String> = source
            .iter()
            .map(|v| v.as_str().map_or_else(|| v.to_string(), str::to_owned))
            .collect();
        for v in shown(&widget) {
            let text = v.as_str().map_or_else(|| v.to_string(), str::to_owned);
            assert!(
                source.contains(&v) || as_text.contains(&text),
                "{}: {v} is not in the tool result",
                entry.path().display()
            );
        }
        seen += 1;
    }
    assert!(seen >= 3, "widget cases went missing");
}

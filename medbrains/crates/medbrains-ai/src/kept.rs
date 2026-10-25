//! What an answer keeps besides its text (`ai_messages.parts`), so a reopened
//! conversation shows what the live one showed.
//!
//! Kept: each tool step as its name and outcome (done, blocked, not checked —
//! never the payload), widgets built from approved counts (their values hold
//! no identifier), sources, the guard's notices, the retry marker, tokens,
//! time and model. Not kept: raw tool results, and any widget built from a
//! fetched record (it may list patients) — for those only what to fetch again
//! is stored, and the screen fetches it under the user's permissions when the
//! conversation is reopened. Text is kept as the model saw it (identifiers as
//! the conversation's placeholders) and read back through its map, like the
//! message itself.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use rig::message::{ToolResult, ToolResultContent};
use serde_json::{Value, json};

/// Sources whose widgets may be kept with their values.
const KEPT_SOURCE_PREFIX: &str = "aggregate:";

#[derive(Debug, Default)]
pub(super) struct Kept {
    steps: Vec<Value>,
    widgets: Vec<Value>,
    pub(super) sources: Vec<Value>,
    pub(super) notices: Vec<String>,
    pub(super) retried: bool,
}

/// A tool's outcome as its chip shows it, without the payload.
pub(super) fn outcome(text: &str) -> Value {
    let Ok(v) = serde_json::from_str::<Value>(text) else {
        return json!({});
    };
    let words = |k: &str| v.get(k).and_then(Value::as_str).map(str::to_owned);
    if v.get("checked") == Some(&Value::Bool(false)) {
        json!({ "checked": false, "notes": words("notes") })
    } else if v.get("decision").and_then(Value::as_str) == Some("blocked")
        || v.get("safe") == Some(&Value::Bool(false))
    {
        json!({ "decision": "blocked", "message": words("message").or_else(|| words("notes")) })
    } else {
        json!({})
    }
}

impl Kept {
    pub(super) fn step(&mut self, result: &ToolResult) {
        let text = result.content.iter().find_map(|c| match c {
            ToolResultContent::Text(t) => Some(t.text.as_str()),
            _ => None,
        });
        self.steps.push(json!({
            "id": result.call.to_string(),
            "name": result.name.to_string(),
            "status": "done",
            "args": {},
            "result": text.map_or_else(|| json!({}), outcome),
        }));
    }

    /// A widget shown live: kept whole when built from an approved count,
    /// otherwise only as what to fetch again.
    pub(super) fn widget(&mut self, source: &str, widget: &Value) {
        if source.starts_with(KEPT_SOURCE_PREFIX) {
            self.widgets.push(json!({ "widget": widget }));
        } else {
            self.widgets.push(json!({
                "refetch": { "source": source },
                "kind": widget.get("kind"),
                "title": widget.get("title"),
            }));
        }
    }

    pub(super) fn to_json(&self, usage: Option<&Value>, elapsed_ms: u128, model: &str) -> Value {
        json!({
            "toolCalls": self.steps,
            "widgets": self.widgets,
            "sources": self.sources,
            "guardNotices": self.notices,
            "retried": self.retried,
            "usage": usage,
            "elapsedMs": u64::try_from(elapsed_ms).unwrap_or(u64::MAX),
            "model": model,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{Kept, outcome};
    use serde_json::json;

    #[test]
    fn a_step_keeps_its_outcome_never_its_payload() {
        assert_eq!(
            outcome(r#"{"drug":"X","checked":false,"notes":"X was not checked."}"#),
            json!({"checked": false, "notes": "X was not checked."})
        );
        assert_eq!(
            outcome(r#"{"decision":"blocked","message":"Allergy","warnings":["w"]}"#),
            json!({"decision": "blocked", "message": "Allergy"})
        );
        assert_eq!(outcome(r#"{"rows":[{"name":"[PATIENT_1]"}]}"#), json!({}));
        assert_eq!(outcome("HTTP 200\nnot json"), json!({}));
    }

    #[test]
    fn only_approved_counts_keep_their_values() {
        let mut k = Kept::default();
        let w = json!({"kind": "table", "title": "Bills", "rows": [{"name": "Ravi"}]});
        k.widget("/api/billing/invoices", &w);
        k.widget(
            "aggregate:allergies",
            &json!({"kind": "kpis", "title": "A", "tiles": []}),
        );
        let parts = k.to_json(None, 1200, "m");
        assert_eq!(
            parts["widgets"][0],
            json!({"refetch": {"source": "/api/billing/invoices"}, "kind": "table", "title": "Bills"})
        );
        assert_eq!(parts["widgets"][1]["widget"]["kind"], "kpis");
        assert!(!parts.to_string().contains("Ravi"));
    }
}

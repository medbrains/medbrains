//! When a parameter should be visible.
//!
//! Mirrors n8n's `displayOptions`. A field lists the other parameters (and the
//! values of those parameters) that reveal or hide it, which is what lets one
//! node describe a whole API: pick a Resource, and only that resource's
//! Operations appear; pick an Operation, and only its fields appear.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

/// Parameter name -> the values of that parameter this rule matches.
pub type Conditions = BTreeMap<String, Vec<Value>>;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayOptions {
    /// Every listed parameter must hold one of the listed values.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub show: Conditions,
    /// Any match here hides the field, and wins over `show`.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub hide: Conditions,
}

impl DisplayOptions {
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.show.is_empty() && self.hide.is_empty()
    }

    /// Reveal this field only when `parameter` currently holds one of `values`.
    #[must_use]
    pub fn show_when(mut self, parameter: &str, values: &[&str]) -> Self {
        self.show.insert(parameter.to_owned(), to_values(values));
        self
    }

    /// Hide this field whenever `parameter` holds one of `values`.
    #[must_use]
    pub fn hide_when(mut self, parameter: &str, values: &[&str]) -> Self {
        self.hide.insert(parameter.to_owned(), to_values(values));
        self
    }

    /// Should the field be shown, given the parameters set on the node?
    ///
    /// An absent parameter never satisfies a `show` rule — a field gated on a
    /// choice the user has not made yet stays hidden.
    #[must_use]
    pub fn is_visible(&self, parameters: &Value) -> bool {
        if self
            .hide
            .iter()
            .any(|(name, values)| matches(parameters, name, values))
        {
            return false;
        }
        self.show
            .iter()
            .all(|(name, values)| matches(parameters, name, values))
    }
}

fn matches(parameters: &Value, name: &str, values: &[Value]) -> bool {
    parameters
        .get(name)
        .is_some_and(|current| values.contains(current))
}

fn to_values(values: &[&str]) -> Vec<Value> {
    values
        .iter()
        .map(|v| Value::String((*v).to_owned()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_field_with_no_rules_is_always_visible() {
        assert!(DisplayOptions::default().is_visible(&json!({})));
    }

    #[test]
    fn a_shown_field_stays_hidden_until_its_trigger_is_chosen() {
        let rule = DisplayOptions::default().show_when("resource", &["message"]);
        assert!(!rule.is_visible(&json!({})), "no choice made yet");
        assert!(!rule.is_visible(&json!({ "resource": "channel" })));
        assert!(rule.is_visible(&json!({ "resource": "message" })));
    }

    #[test]
    fn every_show_condition_must_hold() {
        // This is what makes resource + operation cascades work.
        let rule = DisplayOptions::default()
            .show_when("resource", &["message"])
            .show_when("operation", &["post"]);

        assert!(!rule.is_visible(&json!({ "resource": "message", "operation": "update" })));
        assert!(rule.is_visible(&json!({ "resource": "message", "operation": "post" })));
    }

    #[test]
    fn hide_beats_show() {
        let rule = DisplayOptions::default()
            .show_when("resource", &["message"])
            .hide_when("mode", &["simple"]);

        assert!(!rule.is_visible(&json!({ "resource": "message", "mode": "simple" })));
        assert!(rule.is_visible(&json!({ "resource": "message", "mode": "advanced" })));
    }

    #[test]
    fn conditions_compare_by_value_not_by_string() {
        let mut rule = DisplayOptions::default();
        rule.show.insert("count".into(), vec![json!(1)]);

        assert!(rule.is_visible(&json!({ "count": 1 })));
        assert!(!rule.is_visible(&json!({ "count": "1" })), "\"1\" is not 1");
    }
}

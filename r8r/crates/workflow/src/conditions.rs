//! Structured conditions: the filter you build instead of write.
//!
//! Expressions are the power tool, but most routing decisions are simple
//! comparisons, and a workflow is easier to review when they are data rather
//! than code. A condition tree is a group of comparisons joined by AND or OR,
//! and groups nest — which is how "(A and B) or C" gets expressed without
//! anyone writing a line of Rhai.

use crate::errors::{Result, WorkflowError};
use crate::expression::{Expression, truthy};
use crate::interfaces::Items;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// How the members of a group are joined.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Combinator {
    #[default]
    And,
    Or,
}

/// What a single comparison asks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Operator {
    Equals,
    NotEquals,
    Contains,
    NotContains,
    StartsWith,
    EndsWith,
    Matches,
    GreaterThan,
    GreaterOrEqual,
    LessThan,
    LessOrEqual,
    IsEmpty,
    IsNotEmpty,
    IsTrue,
    IsFalse,
    Exists,
    NotExists,
}

impl Operator {
    /// Does this operator compare against a value, or only inspect the left?
    #[must_use]
    pub fn needs_right(&self) -> bool {
        !matches!(
            self,
            Operator::IsEmpty
                | Operator::IsNotEmpty
                | Operator::IsTrue
                | Operator::IsFalse
                | Operator::Exists
                | Operator::NotExists
        )
    }
}

/// One comparison.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Condition {
    /// A dot path into the item (`customer.tier`) or a `{{ expression }}`.
    pub left: String,
    pub operator: Operator,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub right: Option<Value>,
    /// Compare text without regard to case. Off by default, because silently
    /// ignoring case surprises people more often than it helps.
    #[serde(default)]
    pub ignore_case: bool,
}

impl Condition {
    #[must_use]
    pub fn new(left: &str, operator: Operator, right: Value) -> Self {
        Condition {
            left: left.to_owned(),
            operator,
            right: Some(right),
            ignore_case: false,
        }
    }

    #[must_use]
    pub fn unary(left: &str, operator: Operator) -> Self {
        Condition {
            left: left.to_owned(),
            operator,
            right: None,
            ignore_case: false,
        }
    }
}

/// A member of a group: either a comparison or a nested group.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ConditionNode {
    Group(ConditionGroup),
    Leaf(Condition),
}

/// Comparisons joined by one combinator, with nesting for the rest.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConditionGroup {
    #[serde(default)]
    pub combinator: Combinator,
    #[serde(default)]
    pub conditions: Vec<ConditionNode>,
}

impl ConditionGroup {
    #[must_use]
    pub fn all(conditions: Vec<ConditionNode>) -> Self {
        ConditionGroup {
            combinator: Combinator::And,
            conditions,
        }
    }

    #[must_use]
    pub fn any(conditions: Vec<ConditionNode>) -> Self {
        ConditionGroup {
            combinator: Combinator::Or,
            conditions,
        }
    }

    /// Evaluate against one item.
    ///
    /// An empty group is true: a filter nobody configured should let items
    /// through rather than silently discarding the whole batch.
    pub fn evaluate(
        &self,
        expression: &Expression,
        item: &Value,
        idx: usize,
        items: &Items,
    ) -> Result<bool> {
        if self.conditions.is_empty() {
            return Ok(true);
        }

        let mut verdict = matches!(self.combinator, Combinator::And);
        for node in &self.conditions {
            let outcome = match node {
                ConditionNode::Leaf(condition) => {
                    evaluate_condition(condition, expression, item, idx, items)?
                }
                ConditionNode::Group(group) => group.evaluate(expression, item, idx, items)?,
            };

            match self.combinator {
                // Short-circuit: a false in an AND (or a true in an OR) settles
                // it, and skipping the rest avoids evaluating expressions that
                // cannot change the answer.
                Combinator::And => {
                    verdict = verdict && outcome;
                    if !verdict {
                        return Ok(false);
                    }
                }
                Combinator::Or => {
                    verdict = verdict || outcome;
                    if verdict {
                        return Ok(true);
                    }
                }
            }
        }
        Ok(verdict)
    }
}

fn evaluate_condition(
    condition: &Condition,
    expression: &Expression,
    item: &Value,
    idx: usize,
    items: &Items,
) -> Result<bool> {
    // The two sides are read differently on purpose: the left names a field,
    // so a bare string is a path into the item; the right supplies a value, so
    // a bare string is that literal text. Only `{{ }}` makes either an
    // expression. Without this asymmetry, comparing `tier` to `"vip"` would
    // look up `item.vip` and compare a field to nothing.
    let left = resolve_left(&condition.left, expression, item, idx, items)?;

    let right = match &condition.right {
        Some(Value::String(text)) if text.contains("{{") => {
            expression.resolve(&Value::String(text.clone()), item, idx, items)?
        }
        Some(other) => other.clone(),
        None => Value::Null,
    };

    if condition.operator.needs_right() && condition.right.is_none() {
        return Err(WorkflowError::Other(format!(
            "`{}` needs a value to compare against",
            condition.left
        )));
    }

    Ok(compare(
        &left,
        condition.operator,
        &right,
        condition.ignore_case,
    ))
}

/// The left side names a field: a `{{ expression }}`, or a dot path.
fn resolve_left(
    source: &str,
    expression: &Expression,
    item: &Value,
    idx: usize,
    items: &Items,
) -> Result<Value> {
    if source.contains("{{") {
        return expression.resolve(&Value::String(source.to_owned()), item, idx, items);
    }
    Ok(crate::node_helpers::get_path(item, source)
        .cloned()
        .unwrap_or(Value::Null))
}

fn compare(left: &Value, operator: Operator, right: &Value, ignore_case: bool) -> bool {
    match operator {
        Operator::Exists => !left.is_null(),
        Operator::NotExists => left.is_null(),
        Operator::IsEmpty => is_empty(left),
        Operator::IsNotEmpty => !is_empty(left),
        Operator::IsTrue => truthy(left),
        Operator::IsFalse => !truthy(left),

        Operator::Equals => equal(left, right, ignore_case),
        Operator::NotEquals => !equal(left, right, ignore_case),

        Operator::Contains => contains(left, right, ignore_case),
        Operator::NotContains => !contains(left, right, ignore_case),

        Operator::StartsWith => with_text(left, right, ignore_case, |a, b| a.starts_with(b)),
        Operator::EndsWith => with_text(left, right, ignore_case, |a, b| a.ends_with(b)),

        // Substring matching rather than a regex engine: a full regex is a
        // denial-of-service surface, and `contains` covers what people reach
        // for. Expressions remain available for anything genuinely regular.
        Operator::Matches => with_text(left, right, ignore_case, |a, b| a.contains(b)),

        Operator::GreaterThan => order(left, right).is_some_and(std::cmp::Ordering::is_gt),
        Operator::GreaterOrEqual => order(left, right).is_some_and(std::cmp::Ordering::is_ge),
        Operator::LessThan => order(left, right).is_some_and(std::cmp::Ordering::is_lt),
        Operator::LessOrEqual => order(left, right).is_some_and(std::cmp::Ordering::is_le),
    }
}

fn is_empty(value: &Value) -> bool {
    match value {
        Value::Null => true,
        Value::String(text) => text.is_empty(),
        Value::Array(items) => items.is_empty(),
        Value::Object(object) => object.is_empty(),
        _ => false,
    }
}

/// Equality that does not care whether a number arrived as `7` or `"7"` —
/// query strings and CSV columns make that distinction meaningless.
fn equal(left: &Value, right: &Value, ignore_case: bool) -> bool {
    if let (Some(a), Some(b)) = (number_of(left), number_of(right)) {
        return (a - b).abs() < f64::EPSILON;
    }
    match (text_of(left), text_of(right)) {
        (Some(a), Some(b)) if ignore_case => a.eq_ignore_ascii_case(&b),
        (Some(a), Some(b)) => a == b,
        _ => left == right,
    }
}

fn contains(left: &Value, right: &Value, ignore_case: bool) -> bool {
    // An array contains an element; text contains a substring.
    if let Value::Array(entries) = left {
        return entries.iter().any(|entry| equal(entry, right, ignore_case));
    }
    with_text(left, right, ignore_case, |a, b| a.contains(b))
}

fn with_text(
    left: &Value,
    right: &Value,
    ignore_case: bool,
    test: impl Fn(&str, &str) -> bool,
) -> bool {
    let (Some(a), Some(b)) = (text_of(left), text_of(right)) else {
        return false;
    };
    if ignore_case {
        test(&a.to_lowercase(), &b.to_lowercase())
    } else {
        test(&a, &b)
    }
}

/// Ordering, numeric when both sides look numeric and lexical otherwise —
/// so dates in ISO form still sort correctly.
fn order(left: &Value, right: &Value) -> Option<std::cmp::Ordering> {
    if let (Some(a), Some(b)) = (number_of(left), number_of(right)) {
        return a.partial_cmp(&b);
    }
    match (text_of(left), text_of(right)) {
        (Some(a), Some(b)) => Some(a.cmp(&b)),
        _ => None,
    }
}

fn number_of(value: &Value) -> Option<f64> {
    match value {
        Value::Number(number) => number.as_f64(),
        Value::String(text) => text.trim().parse().ok(),
        Value::Bool(_) | Value::Null | Value::Array(_) | Value::Object(_) => None,
    }
}

fn text_of(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Number(number) => Some(number.to_string()),
        Value::Bool(flag) => Some(flag.to_string()),
        _ => None,
    }
}

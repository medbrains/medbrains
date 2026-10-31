//! Small conversions every node implementation ends up needing.
//! Mirrors `packages/workflow/src/node-helpers.ts`.

use crate::interfaces::Items;
use serde_json::{Map, Value, json};

/// A node that produced nothing still emits one empty item, so downstream
/// nodes run once rather than being skipped.
pub fn ensure_one(items: Items) -> Items {
    if items.is_empty() {
        vec![json!({})]
    } else {
        items
    }
}

/// Read a string parameter, falling back when absent or of another type.
pub fn str_param(params: &Value, key: &str, default: &str) -> String {
    match params.get(key) {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Null) | None => default.to_string(),
        Some(other) => other.to_string(),
    }
}

pub fn bool_param(params: &Value, key: &str, default: bool) -> bool {
    match params.get(key) {
        Some(Value::Bool(b)) => *b,
        Some(Value::String(s)) => s == "true",
        Some(Value::Number(n)) => n.as_f64().map_or(default, |f| f != 0.0),
        _ => default,
    }
}

pub fn num_param(params: &Value, key: &str, default: f64) -> f64 {
    match params.get(key) {
        Some(Value::Number(n)) => n.as_f64().unwrap_or(default),
        Some(Value::String(s)) => s.parse().unwrap_or(default),
        _ => default,
    }
}

/// Accept a key/value map either as a real object or as JSON in a string —
/// the editor sends the former, hand-written workflows often the latter.
pub fn object_param(params: &Value, key: &str) -> Map<String, Value> {
    match params.get(key) {
        Some(Value::Object(o)) => o.clone(),
        Some(Value::String(s)) if !s.trim().is_empty() => serde_json::from_str::<Value>(s)
            .ok()
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default(),
        _ => Map::new(),
    }
}

/// Wrap whatever a node returns into an item object. Bare scalars and arrays
/// get boxed so every item flowing through the graph is a JSON object.
pub fn as_item(v: Value) -> Value {
    match v {
        Value::Object(_) => v,
        other => json!({ "value": other }),
    }
}

/// Convert a user-supplied number into a bounded millisecond count.
///
/// Every duration in r8r goes through here so that exactly one place performs
/// the float-to-integer narrowing, under a proven bound: NaN and negatives
/// become 0 and anything above `max` is clamped, so the cast below cannot
/// truncate or lose a sign.
#[must_use]
pub fn millis(value: f64, max: u64) -> u64 {
    // NaN is the only value with no sensible ordering, so it takes the floor.
    // Everything else — including +inf — is clamped into [0, max]; a hostile
    // timeout must never come out as "no timeout at all".
    if value.is_nan() || value <= 0.0 {
        return 0;
    }
    #[allow(clippy::cast_precision_loss)]
    // Precision only matters above 2^53 ms (~285,000 years); every ceiling in
    // r8r is minutes, so the comparison is exact for real inputs.
    let ceiling = max as f64;
    if value >= ceiling {
        return max;
    }
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    // Safe: the guards above prove 0 < value < max <= u64::MAX.
    let narrowed = value as u64;
    narrowed
}

/// Read a dot path out of a value: `customer.address.city`, or `lines.0.sku`
/// to step into an array.
///
/// Returns `None` at the first missing hop rather than panicking, because a
/// half-populated record is normal input, not a bug.
#[must_use]
pub fn get_path<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    if path.is_empty() {
        return Some(value);
    }
    let mut current = value;
    for segment in path.split('.') {
        current = match current {
            Value::Object(object) => object.get(segment)?,
            Value::Array(items) => items.get(segment.parse::<usize>().ok()?)?,
            _ => return None,
        };
    }
    Some(current)
}

/// Write a dot path into a value, creating the objects along the way.
///
/// Mapping between two APIs almost always means building a nested destination
/// out of a flat source, so this has to create `customer.address` rather than
/// requiring it to exist. A segment whose parent is not an object is replaced,
/// because the destination shape the user asked for wins.
pub fn set_path(target: &mut Value, path: &str, value: Value) {
    if path.is_empty() {
        *target = value;
        return;
    }
    if !target.is_object() {
        *target = Value::Object(Map::new());
    }

    let segments: Vec<&str> = path.split('.').collect();
    let mut current = target;

    // Bounded by the number of segments in the path.
    for segment in segments.iter().take(segments.len().saturating_sub(1)) {
        let object = match current {
            Value::Object(object) => object,
            other => {
                *other = Value::Object(Map::new());
                match other {
                    Value::Object(object) => object,
                    _ => return,
                }
            }
        };
        current = object
            .entry((*segment).to_owned())
            .or_insert_with(|| Value::Object(Map::new()));
    }

    if let (Value::Object(object), Some(last)) = (current, segments.last()) {
        object.insert((*last).to_owned(), value);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn object_param_accepts_both_shapes() {
        let real = json!({ "headers": { "a": "1" } });
        let stringy = json!({ "headers": "{\"a\": \"1\"}" });
        assert_eq!(
            object_param(&real, "headers"),
            object_param(&stringy, "headers")
        );
        assert!(object_param(&json!({}), "headers").is_empty());
    }

    #[test]
    fn millis_clamps_every_hostile_input() {
        assert_eq!(millis(1500.0, 5000), 1500);
        assert_eq!(millis(-1.0, 5000), 0, "negative waits become zero");
        assert_eq!(millis(f64::NAN, 5000), 0, "NaN must not reach the cast");
        assert_eq!(
            millis(f64::INFINITY, 5000),
            5000,
            "infinity clamps to the ceiling"
        );
        assert_eq!(millis(9_999_999.0, 5000), 5000);
        assert_eq!(millis(0.4, 5000), 0);
    }

    #[test]
    fn scalars_are_boxed_into_items() {
        assert_eq!(as_item(json!(5)), json!({ "value": 5 }));
        assert_eq!(as_item(json!({ "a": 1 })), json!({ "a": 1 }));
    }
}

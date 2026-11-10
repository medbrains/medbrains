//! Canonical JSON and its hash: what an auditor recomputes offline.
//!
//! Canonical means object keys sorted by byte order at every depth, no
//! whitespace, strings and numbers as `serde_json` writes them. Sorting is done
//! here rather than trusted to the map type, so the output does not change if
//! some crate in the build turns on `serde_json/preserve_order`.

use serde_json::Value;
use sha2::{Digest, Sha256};

/// `value` written canonically.
#[must_use]
pub fn canonical(value: &Value) -> String {
    let mut out = String::new();
    write(value, &mut out);
    out
}

fn write(value: &Value, out: &mut String) {
    match value {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            out.push('{');
            for (i, key) in keys.into_iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                out.push_str(&Value::String(key.clone()).to_string());
                out.push(':');
                if let Some(v) = map.get(key) {
                    write(v, out);
                }
            }
            out.push('}');
        }
        Value::Array(items) => {
            out.push('[');
            for (i, v) in items.iter().enumerate() {
                if i > 0 {
                    out.push(',');
                }
                write(v, out);
            }
            out.push(']');
        }
        scalar => out.push_str(&scalar.to_string()),
    }
}

/// Lower-case hex sha256 of `text`.
#[must_use]
pub fn sha256_hex(text: &str) -> String {
    hex::encode(Sha256::digest(text.as_bytes()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn keys_are_sorted_at_every_depth_and_whitespace_dropped() {
        let v = json!({"b": 1, "a": {"z": [true, null], "y": "x"}});
        assert_eq!(canonical(&v), r#"{"a":{"y":"x","z":[true,null]},"b":1}"#);
    }

    #[test]
    fn the_hash_is_of_the_canonical_text() {
        // sha256("{}"), independently known.
        assert_eq!(
            sha256_hex(&canonical(&json!({}))),
            "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a"
        );
    }
}

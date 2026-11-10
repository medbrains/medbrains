//! `application/x-www-form-urlencoded`, both directions.
//!
//! Small enough to implement precisely rather than take a dependency for, and
//! implementing it here means the percent-decoding rules are visible and
//! tested rather than assumed.

use serde_json::{Map, Value};

/// Parse `a=1&b=hello%20world` into an object.
///
/// A repeated key becomes an array, because that is how forms express a
/// multi-select and dropping the earlier value would lose data.
#[must_use]
pub fn to_json(text: &str) -> Value {
    let mut out: Map<String, Value> = Map::new();

    for pair in text.trim().split('&').filter(|pair| !pair.is_empty()) {
        let (raw_key, raw_value) = match pair.split_once('=') {
            Some(split) => split,
            None => (pair, ""),
        };
        let key = decode(raw_key);
        let value = Value::String(decode(raw_value));

        match out.get_mut(&key) {
            Some(Value::Array(existing)) => existing.push(value),
            Some(existing) => {
                let first = existing.clone();
                *existing = Value::Array(vec![first, value]);
            }
            None => {
                out.insert(key, value);
            }
        }
    }

    Value::Object(out)
}

/// Render an object as a form body. Arrays repeat their key, matching what
/// [`to_json`] reads back.
#[must_use]
pub fn from_json(value: &Value) -> String {
    let Some(object) = value.as_object() else {
        return String::new();
    };

    let mut pairs: Vec<String> = Vec::new();
    for (key, entry) in object {
        match entry {
            Value::Array(items) => {
                for item in items {
                    pairs.push(format!("{}={}", encode(key), encode(&text_of(item))));
                }
            }
            other => pairs.push(format!("{}={}", encode(key), encode(&text_of(other)))),
        }
    }
    pairs.join("&")
}

fn text_of(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

/// Percent-decoding, with `+` meaning a space as forms require.
fn decode(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut index = 0;

    // Bounded by the input length (Power of 10 rule 2).
    while index < bytes.len() {
        match bytes.get(index) {
            Some(b'+') => {
                out.push(b' ');
                index += 1;
            }
            Some(b'%') => {
                let hex = text
                    .get(index + 1..index + 3)
                    .and_then(|pair| u8::from_str_radix(pair, 16).ok());
                if let Some(byte) = hex {
                    out.push(byte);
                    index += 3;
                } else {
                    // A stray '%' is data, not a broken escape.
                    out.push(b'%');
                    index += 1;
                }
            }
            Some(byte) => {
                out.push(*byte);
                index += 1;
            }
            None => break,
        }
    }

    String::from_utf8_lossy(&out).into_owned()
}

fn encode(text: &str) -> String {
    use std::fmt::Write as _;

    let mut out = String::with_capacity(text.len());
    for byte in text.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            b' ' => out.push_str("%20"),
            other => {
                // Writing into a String cannot fail.
                let _ = write!(out, "%{other:02X}");
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn a_simple_body_becomes_an_object() {
        assert_eq!(to_json("a=1&b=2"), json!({ "a": "1", "b": "2" }));
    }

    #[test]
    fn percent_escapes_and_plus_signs_are_decoded() {
        assert_eq!(
            to_json("q=hello+world&path=%2Fusers%2F1"),
            json!({ "q": "hello world", "path": "/users/1" })
        );
    }

    #[test]
    fn a_repeated_key_becomes_an_array_rather_than_losing_a_value() {
        assert_eq!(
            to_json("tag=a&tag=b&tag=c"),
            json!({ "tag": ["a", "b", "c"] })
        );
    }

    #[test]
    fn a_key_with_no_value_is_an_empty_string() {
        assert_eq!(to_json("flag&a=1"), json!({ "flag": "", "a": "1" }));
    }

    #[test]
    fn an_empty_body_is_an_empty_object() {
        assert_eq!(to_json(""), json!({}));
        assert_eq!(to_json("   "), json!({}));
    }

    #[test]
    fn a_stray_percent_is_treated_as_data_not_a_broken_escape() {
        assert_eq!(to_json("discount=50%"), json!({ "discount": "50%" }));
        assert_eq!(to_json("bad=%zz"), json!({ "bad": "%zz" }));
    }

    #[test]
    fn utf8_survives_the_round_trip() {
        let original = json!({ "name": "café 🚀", "note": "a&b=c" });
        assert_eq!(to_json(&from_json(&original)), original);
    }

    #[test]
    fn writing_repeats_a_key_for_each_array_entry() {
        assert_eq!(from_json(&json!({ "tag": ["a", "b"] })), "tag=a&tag=b");
    }

    #[test]
    fn numbers_and_booleans_are_written_as_text() {
        assert_eq!(from_json(&json!({ "n": 5, "ok": true })), "n=5&ok=true");
    }

    #[test]
    fn anything_that_is_not_an_object_writes_as_nothing() {
        assert_eq!(from_json(&json!([1, 2])), "");
        assert_eq!(from_json(&json!("text")), "");
    }
}

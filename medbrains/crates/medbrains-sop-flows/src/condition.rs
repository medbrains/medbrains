//! Branch conditions as a designer builds them from the form.
//!
//! Fact, operator, value, in AND groups with `$any` OR groups. Evaluated by
//! `medbrains_approvals_core::conditions::matches`; here they are typed
//! against the fact catalogue, described in words, and their facts listed.

use medbrains_approvals_core::conditions::ANY;
use serde_json::{Map, Value};

use crate::blocks::{self, FactType};

/// Deepest OR nesting a condition may have; the form builds one level.
const MAX_DEPTH: usize = 3;

/// The facts a condition reads, in first-seen order.
#[must_use]
pub fn facts(cond: &Value) -> Vec<String> {
    let mut out = Vec::new();
    collect(cond, &mut out, 0);
    out
}

fn collect(cond: &Value, out: &mut Vec<String>, depth: usize) {
    let Some(clauses) = cond.as_object() else {
        return;
    };
    for (key, value) in clauses {
        if key == ANY && depth < MAX_DEPTH {
            for alt in value.as_array().into_iter().flatten() {
                collect(alt, out, depth + 1);
            }
        } else if !out.contains(key) {
            out.push(key.clone());
        }
    }
}

/// Every literal a condition compares `fact` with, so the checks can try
/// each side of every threshold.
#[must_use]
pub fn literals(cond: &Value, fact: &str) -> Vec<Value> {
    let mut out = Vec::new();
    literals_into(cond, fact, &mut out, 0);
    out
}

fn literals_into(cond: &Value, fact: &str, out: &mut Vec<Value>, depth: usize) {
    let Some(clauses) = cond.as_object() else {
        return;
    };
    for (key, value) in clauses {
        if key == ANY && depth < MAX_DEPTH {
            for alt in value.as_array().into_iter().flatten() {
                literals_into(alt, fact, out, depth + 1);
            }
        } else if key == fact {
            match value {
                Value::Object(ops) => {
                    for operand in ops.values() {
                        match operand {
                            Value::Array(items) => out.extend(items.iter().cloned()),
                            v => out.push(v.clone()),
                        }
                    }
                }
                v => out.push(v.clone()),
            }
        }
    }
}

fn fits(ty: FactType, v: &Value) -> bool {
    match ty {
        FactType::Bool => v.is_boolean(),
        FactType::Number => v.is_number(),
        FactType::Text => v.as_str().is_some_and(|s| !s.trim().is_empty()),
    }
}

/// Whether a condition only names registered facts with operators and
/// values that fit their type.
///
/// # Errors
/// A sentence saying what is wrong.
pub fn type_check(cond: &Value) -> Result<(), String> {
    check(cond, 0)
}

fn check(cond: &Value, depth: usize) -> Result<(), String> {
    if cond.is_null() {
        return Ok(());
    }
    let clauses = cond
        .as_object()
        .ok_or("A condition must be a set of rules")?;
    if clauses.is_empty() {
        return Err("An empty condition is not allowed; remove the branch instead".to_owned());
    }
    for (key, value) in clauses {
        if key == ANY {
            let alts = value
                .as_array()
                .filter(|a| a.len() >= 2)
                .ok_or("An \"any of\" group needs at least two rules")?;
            if depth >= MAX_DEPTH {
                return Err("Groups are nested too deeply".to_owned());
            }
            for alt in alts {
                check(alt, depth + 1)?;
            }
            continue;
        }
        let fact = blocks::fact(key).ok_or_else(|| format!("\"{key}\" is not a known fact"))?;
        clause(fact, value)?;
    }
    Ok(())
}

fn clause(fact: &blocks::Fact, value: &Value) -> Result<(), String> {
    let bad = |what: &str| format!("{}: {what}", fact.label);
    let Some(ops) = value.as_object() else {
        return if fits(fact.ty, value) {
            Ok(())
        } else {
            Err(bad("the value does not fit this fact"))
        };
    };
    if ops.is_empty() {
        return Err(bad("pick an operator"));
    }
    for (op, operand) in ops {
        if !fact.ty.operators().contains(&op.as_str()) {
            return Err(bad(&format!("\"{op}\" cannot be used here")));
        }
        let ok = if op == "in" {
            operand
                .as_array()
                .is_some_and(|a| !a.is_empty() && a.iter().all(|v| fits(fact.ty, v)))
        } else {
            fits(fact.ty, operand)
        };
        if !ok {
            return Err(bad("the value does not fit this fact"));
        }
    }
    Ok(())
}

fn show(v: &Value) -> String {
    match v {
        Value::Bool(true) => "yes".to_owned(),
        Value::Bool(false) => "no".to_owned(),
        Value::String(s) => s.clone(),
        Value::Array(items) => items.iter().map(show).collect::<Vec<_>>().join(", "),
        other => other.to_string(),
    }
}

fn op_words(op: &str) -> &'static str {
    match op {
        "ne" => "is not",
        "gt" => "is over",
        "gte" => "is at least",
        "lt" => "is under",
        "lte" => "is at most",
        "in" => "is one of",
        _ => "is",
    }
}

fn words(clauses: &Map<String, Value>) -> Vec<String> {
    clauses
        .iter()
        .map(|(key, value)| {
            if key == ANY {
                let alts: Vec<String> = value
                    .as_array()
                    .into_iter()
                    .flatten()
                    .map(describe)
                    .collect();
                return format!("({})", alts.join(" or "));
            }
            let label = blocks::fact(key).map_or(key.as_str(), |f| f.label);
            let label = label.to_lowercase();
            value.as_object().map_or_else(
                || format!("{label} is {}", show(value)),
                |ops| {
                    ops.iter()
                        .map(|(op, v)| format!("{label} {} {}", op_words(op), show(v)))
                        .collect::<Vec<_>>()
                        .join(" and ")
                },
            )
        })
        .collect()
}

/// A condition in words: "admitting department is ORTHO and age in years
/// is at least 65".
#[must_use]
pub fn describe(cond: &Value) -> String {
    cond.as_object()
        .map_or_else(|| "always".to_owned(), |c| words(c).join(" and "))
}

/// Who a branch condition picks out: "every patient", "insurance
/// patients", "patients whose admitting department is ORTHO".
#[must_use]
pub fn audience(cond: &Value) -> String {
    let Some(clauses) = cond.as_object().filter(|c| !c.is_empty()) else {
        return "every patient".to_owned();
    };
    if let [(key, Value::Bool(true))] = clauses.iter().collect::<Vec<_>>().as_slice()
        && let Some(f) = blocks::fact(key).filter(|f| !f.who.is_empty())
    {
        return f.who.to_owned();
    }
    format!("patients whose {}", describe(cond))
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn conditions_are_typed_against_the_catalogue() {
        assert!(type_check(&json!({"department": "ORTHO"})).is_ok());
        assert!(type_check(&json!({"age_years": {"gte": 65}})).is_ok());
        assert!(
            type_check(&json!({"$any": [{"is_mlc": true}, {"department": {"in": ["ORTHO"]}}]}))
                .is_ok()
        );
        assert!(
            type_check(&json!({"blood_type": "O"}))
                .unwrap_err()
                .contains("not a known fact")
        );
        assert!(type_check(&json!({"age_years": "old"})).is_err());
        assert!(
            type_check(&json!({"is_mlc": {"gt": 1}}))
                .unwrap_err()
                .contains("cannot be used")
        );
        assert!(type_check(&json!({"department": {"in": []}})).is_err());
        assert!(type_check(&json!({"$any": [{"is_mlc": true}]})).is_err());
        assert!(type_check(&json!({})).is_err());
    }

    #[test]
    fn conditions_read_as_sentences() {
        assert_eq!(audience(&Value::Null), "every patient");
        assert_eq!(
            audience(&json!({"is_insurance": true})),
            "insurance patients"
        );
        assert_eq!(
            audience(&json!({"department": "ORTHO"})),
            "patients whose admitting department is ORTHO"
        );
        assert_eq!(
            describe(&json!({"$any": [{"is_mlc": true}, {"age_years": {"gte": 65}}]})),
            "(medico-legal case is yes or age in years is at least 65)"
        );
    }

    #[test]
    fn facts_and_literals_are_found_inside_groups() {
        let c = json!({"$any": [{"department": "ORTHO"}, {"department": {"in": ["NEURO"]}}], "age_years": {"gt": 60}});
        assert_eq!(facts(&c), ["department", "age_years"]);
        assert_eq!(literals(&c, "department"), [json!("ORTHO"), json!("NEURO")]);
        assert_eq!(literals(&c, "age_years"), [json!(60)]);
    }
}

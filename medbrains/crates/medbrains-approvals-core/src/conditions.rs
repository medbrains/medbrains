//! Choosing which chain a request takes.
//!
//! A request type can have several workflows — leave over ten days needs the
//! department head *and* administration, leave over one needs only the
//! manager. Which applies is decided by matching the workflow's `conditions`
//! against the request payload.
//!
//! The matcher is deliberately small. A condition language grows into a
//! programming language, and a programming language in a JSONB column is one
//! nobody can test, review or reason about at three in the morning. Four
//! operators cover every chain the sixteen existing domains actually use; a
//! fifth can be added when a real chain needs it, with a test.
//!
//! # Failing closed
//!
//! An operator this build does not recognise makes the condition **not
//! match**, so the workflow is passed over rather than selected. Matching on
//! an unreadable condition would pick a chain on the strength of a rule the
//! server could not read — and the cheaper chain is usually the shorter one,
//! so guessing would tend to under-approve.

use serde_json::Value;

/// Whether a workflow's conditions hold for a payload.
///
/// An empty condition set matches everything, which is how a type's single
/// default chain is expressed.
#[must_use]
pub fn matches(conditions: &Value, payload: &Value) -> bool {
    let Some(clauses) = conditions.as_object() else {
        // A non-object condition — a bare string, a number — is not something
        // this can evaluate, so it does not match.
        return conditions.is_null();
    };
    if clauses.is_empty() {
        return true;
    }
    // Every clause must hold. An "any of" would need nesting, and nothing in
    // the existing domains asks for it.
    clauses
        .iter()
        .all(|(field, expected)| clause_holds(payload.get(field), expected))
}

/// One clause: either a literal to equal, or `{"op": value}`.
fn clause_holds(actual: Option<&Value>, expected: &Value) -> bool {
    let Some(actual) = actual else {
        // The payload does not carry the field the condition asks about, so
        // the condition cannot hold. Treating absence as a match would apply
        // a "leave over 10 days" chain to a request with no duration at all.
        return false;
    };

    let Some(operator) = expected.as_object() else {
        return actual == expected;
    };

    operator.iter().all(|(op, operand)| match op.as_str() {
        "eq" => actual == operand,
        "ne" => actual != operand,
        "gt" => compare(actual, operand).is_some_and(std::cmp::Ordering::is_gt),
        "gte" => compare(actual, operand).is_some_and(std::cmp::Ordering::is_ge),
        "lt" => compare(actual, operand).is_some_and(std::cmp::Ordering::is_lt),
        "lte" => compare(actual, operand).is_some_and(std::cmp::Ordering::is_le),
        "in" => operand
            .as_array()
            .is_some_and(|allowed| allowed.contains(actual)),
        // Unrecognised: does not match. See the module comment.
        _ => false,
    })
}

/// Numeric comparison, or `None` when either side is not a number.
///
/// Strings are not ordered here on purpose. `"10" > "9"` is false
/// lexicographically and true numerically, and a chain that depends on which
/// one a payload happened to use is a chain nobody can predict.
fn compare(actual: &Value, operand: &Value) -> Option<std::cmp::Ordering> {
    let left = actual.as_f64()?;
    let right = operand.as_f64()?;
    left.partial_cmp(&right)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::matches;
    use serde_json::json;

    #[test]
    fn no_conditions_matches_everything() {
        // How a type's single default chain is expressed.
        assert!(matches(&json!({}), &json!({"days": 3})));
        assert!(matches(&json!({}), &json!({})));
    }

    #[test]
    fn a_threshold_selects_the_longer_chain() {
        // The real case: leave over ten days needs an extra stage.
        let over_ten = json!({"days": {"gt": 10}});
        assert!(matches(&over_ten, &json!({"days": 14})));
        assert!(!matches(&over_ten, &json!({"days": 10})));
        assert!(!matches(&over_ten, &json!({"days": 3})));
    }

    #[test]
    fn inclusive_and_exclusive_bounds_differ() {
        assert!(matches(&json!({"days": {"gte": 10}}), &json!({"days": 10})));
        assert!(!matches(&json!({"days": {"gt": 10}}), &json!({"days": 10})));
    }

    #[test]
    fn every_clause_must_hold() {
        let both = json!({"days": {"gt": 5}, "paid": true});
        assert!(matches(&both, &json!({"days": 10, "paid": true})));
        assert!(!matches(&both, &json!({"days": 10, "paid": false})));
        assert!(!matches(&both, &json!({"days": 2, "paid": true})));
    }

    #[test]
    fn a_missing_field_never_matches() {
        // Otherwise a "leave over 10 days" chain would apply to a request
        // that states no duration at all.
        assert!(!matches(&json!({"days": {"gt": 10}}), &json!({})));
        assert!(!matches(&json!({"days": 3}), &json!({"other": 3})));
    }

    #[test]
    fn an_unknown_operator_does_not_match() {
        // Selecting a chain on the strength of a rule the server cannot read
        // would tend to pick the shorter chain, and so under-approve.
        assert!(!matches(
            &json!({"days": {"approximately": 10}}),
            &json!({"days": 10})
        ));
    }

    #[test]
    fn strings_are_not_ordered_numerically_by_accident() {
        // "10" > "9" is false lexicographically and true numerically. A chain
        // that depends on which the payload used is unpredictable, so ordered
        // comparison simply does not apply to strings.
        assert!(!matches(
            &json!({"days": {"gt": 5}}),
            &json!({"days": "10"})
        ));
    }

    #[test]
    fn membership_and_equality_work_on_plain_values() {
        assert!(matches(
            &json!({"category": {"in": ["narcotic", "psychotropic"]}}),
            &json!({"category": "narcotic"})
        ));
        assert!(!matches(
            &json!({"category": {"in": ["narcotic"]}}),
            &json!({"category": "antibiotic"})
        ));
        assert!(matches(&json!({"urgent": true}), &json!({"urgent": true})));
        assert!(matches(
            &json!({"kind": {"ne": "x"}}),
            &json!({"kind": "y"})
        ));
    }
}

//! The routing decisions a workflow makes, expressed as data.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

use r8r_workflow::Expression;
use r8r_workflow::conditions::{Combinator, Condition, ConditionGroup, ConditionNode, Operator};
use serde_json::{Value, json};

fn holds(group: &ConditionGroup, item: &Value) -> bool {
    group
        .evaluate(&Expression::new("wf", "test"), item, 0, &vec![item.clone()])
        .unwrap_or_else(|e| panic!("condition should evaluate: {e}"))
}

fn leaf(left: &str, operator: Operator, right: Value) -> ConditionNode {
    ConditionNode::Leaf(Condition::new(left, operator, right))
}

fn unary(left: &str, operator: Operator) -> ConditionNode {
    ConditionNode::Leaf(Condition::unary(left, operator))
}

// ============================================================== combinators

#[test]
fn an_and_group_needs_every_condition_to_hold() {
    let group = ConditionGroup::all(vec![
        leaf("tier", Operator::Equals, json!("vip")),
        leaf("mrr", Operator::GreaterThan, json!(100)),
    ]);

    assert!(holds(&group, &json!({ "tier": "vip", "mrr": 150 })));
    assert!(!holds(&group, &json!({ "tier": "vip", "mrr": 50 })));
    assert!(!holds(&group, &json!({ "tier": "free", "mrr": 150 })));
}

#[test]
fn an_or_group_needs_only_one() {
    let group = ConditionGroup::any(vec![
        leaf("tier", Operator::Equals, json!("vip")),
        leaf("mrr", Operator::GreaterThan, json!(100)),
    ]);

    assert!(holds(&group, &json!({ "tier": "free", "mrr": 150 })));
    assert!(holds(&group, &json!({ "tier": "vip", "mrr": 0 })));
    assert!(!holds(&group, &json!({ "tier": "free", "mrr": 0 })));
}

#[test]
fn groups_nest_so_a_and_b_or_c_can_be_expressed() {
    // (tier = vip AND mrr > 100) OR country = DE
    let group = ConditionGroup::any(vec![
        ConditionNode::Group(ConditionGroup::all(vec![
            leaf("tier", Operator::Equals, json!("vip")),
            leaf("mrr", Operator::GreaterThan, json!(100)),
        ])),
        leaf("country", Operator::Equals, json!("DE")),
    ]);

    assert!(holds(
        &group,
        &json!({ "tier": "vip", "mrr": 200, "country": "FR" })
    ));
    assert!(holds(
        &group,
        &json!({ "tier": "free", "mrr": 0, "country": "DE" })
    ));
    assert!(!holds(
        &group,
        &json!({ "tier": "free", "mrr": 0, "country": "FR" })
    ));
}

#[test]
fn groups_nest_three_deep() {
    let group = ConditionGroup::all(vec![
        unary("active", Operator::IsTrue),
        ConditionNode::Group(ConditionGroup::any(vec![
            leaf("plan", Operator::Equals, json!("pro")),
            ConditionNode::Group(ConditionGroup::all(vec![
                leaf("plan", Operator::Equals, json!("free")),
                leaf("trialDays", Operator::GreaterThan, json!(0)),
            ])),
        ])),
    ]);

    assert!(holds(
        &group,
        &json!({ "active": true, "plan": "pro", "trialDays": 0 })
    ));
    assert!(holds(
        &group,
        &json!({ "active": true, "plan": "free", "trialDays": 5 })
    ));
    assert!(!holds(
        &group,
        &json!({ "active": true, "plan": "free", "trialDays": 0 })
    ));
    assert!(!holds(
        &group,
        &json!({ "active": false, "plan": "pro", "trialDays": 9 })
    ));
}

#[test]
fn an_unconfigured_filter_lets_everything_through() {
    // Discarding a whole batch because nobody filled the form in would be the
    // most destructive possible default.
    assert!(holds(&ConditionGroup::default(), &json!({})));
}

// ================================================================ operators

#[test]
fn equality_ignores_whether_a_number_arrived_as_text() {
    let group = ConditionGroup::all(vec![leaf("id", Operator::Equals, json!(7))]);

    assert!(holds(&group, &json!({ "id": 7 })));
    assert!(holds(&group, &json!({ "id": "7" })));
    assert!(!holds(&group, &json!({ "id": 8 })));
}

#[test]
fn case_can_be_ignored_when_asked_for_and_not_before() {
    let sensitive = ConditionGroup::all(vec![leaf("tier", Operator::Equals, json!("VIP"))]);
    assert!(!holds(&sensitive, &json!({ "tier": "vip" })));

    let insensitive = ConditionGroup::all(vec![ConditionNode::Leaf(Condition {
        ignore_case: true,
        ..Condition::new("tier", Operator::Equals, json!("VIP"))
    })]);
    assert!(holds(&insensitive, &json!({ "tier": "vip" })));
}

#[test]
fn text_operators_do_what_they_say() {
    let item = json!({ "email": "ada@example.com" });

    for (operator, right, expected) in [
        (Operator::Contains, json!("@example."), true),
        (Operator::Contains, json!("@other."), false),
        (Operator::NotContains, json!("@other."), true),
        (Operator::StartsWith, json!("ada@"), true),
        (Operator::StartsWith, json!("bob@"), false),
        (Operator::EndsWith, json!(".com"), true),
        (Operator::Matches, json!("example"), true),
    ] {
        let group = ConditionGroup::all(vec![leaf("email", operator, right.clone())]);
        assert_eq!(holds(&group, &item), expected, "{operator:?} {right}");
    }
}

#[test]
fn contains_checks_membership_when_the_left_side_is_a_list() {
    let group = ConditionGroup::all(vec![leaf("tags", Operator::Contains, json!("urgent"))]);

    assert!(holds(&group, &json!({ "tags": ["billing", "urgent"] })));
    assert!(!holds(&group, &json!({ "tags": ["billing"] })));
}

#[test]
fn ordering_is_numeric_for_numbers_and_lexical_for_text() {
    let numeric = ConditionGroup::all(vec![leaf("n", Operator::GreaterThan, json!(9))]);
    assert!(holds(&numeric, &json!({ "n": 10 })), "10 > 9 numerically");
    // Lexically "10" < "9", so this proves numbers are compared as numbers.
    assert!(holds(&numeric, &json!({ "n": "10" })));

    let dates = ConditionGroup::all(vec![leaf(
        "date",
        Operator::GreaterOrEqual,
        json!("2026-01-01"),
    )]);
    assert!(holds(&dates, &json!({ "date": "2026-08-21" })));
    assert!(!holds(&dates, &json!({ "date": "2025-12-31" })));
}

#[test]
fn presence_and_emptiness_are_different_questions() {
    let exists = ConditionGroup::all(vec![unary("note", Operator::Exists)]);
    let empty = ConditionGroup::all(vec![unary("note", Operator::IsEmpty)]);

    assert!(
        !holds(&exists, &json!({})),
        "a missing field does not exist"
    );
    assert!(holds(&empty, &json!({})), "and counts as empty");

    assert!(
        holds(&exists, &json!({ "note": "" })),
        "a blank field exists"
    );
    assert!(holds(&empty, &json!({ "note": "" })), "and is empty");

    assert!(holds(&exists, &json!({ "note": "hi" })));
    assert!(!holds(&empty, &json!({ "note": "hi" })));
}

#[test]
fn an_empty_list_or_object_counts_as_empty() {
    let empty = ConditionGroup::all(vec![unary("items", Operator::IsEmpty)]);
    assert!(holds(&empty, &json!({ "items": [] })));
    assert!(holds(&empty, &json!({ "items": {} })));
    assert!(!holds(&empty, &json!({ "items": [1] })));
}

#[test]
fn truthiness_follows_the_rest_of_the_engine() {
    let is_true = ConditionGroup::all(vec![unary("flag", Operator::IsTrue)]);

    assert!(holds(&is_true, &json!({ "flag": true })));
    assert!(holds(&is_true, &json!({ "flag": "yes" })));
    assert!(!holds(&is_true, &json!({ "flag": false })));
    assert!(!holds(&is_true, &json!({ "flag": "" })));
    assert!(!holds(&is_true, &json!({})));
}

// =================================================================== paths

#[test]
fn a_condition_reads_a_nested_field_by_path() {
    let group = ConditionGroup::all(vec![leaf(
        "customer.address.country",
        Operator::Equals,
        json!("DE"),
    )]);

    assert!(holds(
        &group,
        &json!({ "customer": { "address": { "country": "DE" } } })
    ));
    assert!(!holds(&group, &json!({ "customer": { "address": {} } })));
    assert!(
        !holds(&group, &json!({})),
        "a missing branch is simply not a match"
    );
}

#[test]
fn a_condition_can_index_into_a_list() {
    let group = ConditionGroup::all(vec![leaf("lines.0.sku", Operator::Equals, json!("A1"))]);
    assert!(holds(
        &group,
        &json!({ "lines": [{ "sku": "A1" }, { "sku": "B2" }] })
    ));
}

#[test]
fn either_side_can_be_an_expression() {
    let group = ConditionGroup::all(vec![ConditionNode::Leaf(Condition::new(
        "{{ item.price * item.qty }}",
        Operator::GreaterThan,
        json!("{{ item.budget }}"),
    ))]);

    assert!(holds(
        &group,
        &json!({ "price": 10, "qty": 3, "budget": 25 })
    ));
    assert!(!holds(
        &group,
        &json!({ "price": 10, "qty": 2, "budget": 25 })
    ));
}

// ============================================================ serialisation

#[test]
fn a_condition_tree_survives_the_json_it_is_stored_as() {
    let group = ConditionGroup::any(vec![
        ConditionNode::Group(ConditionGroup::all(vec![
            leaf("tier", Operator::Equals, json!("vip")),
            leaf("mrr", Operator::GreaterThan, json!(100)),
        ])),
        unary("vipOverride", Operator::IsTrue),
    ]);

    let encoded = serde_json::to_string(&group).expect("serialises");
    let decoded: ConditionGroup = serde_json::from_str(&encoded).expect("deserialises");

    assert_eq!(decoded.combinator, Combinator::Or);
    assert_eq!(decoded.conditions.len(), 2);
    assert!(holds(&decoded, &json!({ "tier": "vip", "mrr": 200 })));
    assert!(holds(&decoded, &json!({ "vipOverride": true })));
}

#[test]
fn a_comparison_without_its_value_is_refused_rather_than_guessed() {
    let group = ConditionGroup::all(vec![ConditionNode::Leaf(Condition {
        left: "tier".into(),
        operator: Operator::Equals,
        right: None,
        ignore_case: false,
    })]);

    let outcome = group.evaluate(&Expression::new("wf", "t"), &json!({}), 0, &vec![]);
    assert!(
        outcome.is_err(),
        "silently comparing against nothing would be worse"
    );
}

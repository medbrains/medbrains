//! Instance variables, and what an expression is not allowed to reach.
//!
//! Two separate concerns that meet in the same scope. Variables exist so the
//! same workflow runs in a test hospital and a live one without editing every
//! node. The withholding exists because writing a workflow is not the same
//! authority as administering the server that runs it.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use r8r_workflow::Expression;
use r8r_workflow::expression::{WITHHELD, visible_env};
use serde_json::{Map, Value, json};

fn vars(pairs: &[(&str, Value)]) -> Map<String, Value> {
    pairs
        .iter()
        .map(|(key, value)| ((*key).to_owned(), value.clone()))
        .collect()
}

/// Resolve a whole parameter, the way a node's URL field is resolved — so a
/// template surrounded by ordinary text behaves here as it does in a workflow.
fn resolve(expression: &Expression, template: &str) -> Value {
    expression
        .resolve(&json!(template), &json!({}), 0, &Vec::new())
        .expect("parameter should resolve")
}

fn evaluate(expression: &Expression, script: &str) -> Value {
    expression
        .eval(script, &json!({}), 0, &Vec::new())
        .expect("expression should evaluate")
}

// ================================================================ variables

#[test]
fn a_variable_is_read_by_name() {
    let expression = Expression::new("wf", "Sync").with_vars(vars(&[(
        "FHIR_BASE_URL",
        json!("https://hims.example.org/api/fhir"),
    )]));

    assert_eq!(
        evaluate(&expression, "{{ vars.FHIR_BASE_URL }}"),
        json!("https://hims.example.org/api/fhir")
    );
}

#[test]
fn the_same_workflow_reads_differently_on_two_instances() {
    // The whole point: promoting a workflow is a copy, not an edit of every
    // step that mentions a hostname.
    let script = "{{ vars.FHIR_BASE_URL }}/Patient";

    let test = Expression::new("wf", "Sync")
        .with_vars(vars(&[("FHIR_BASE_URL", json!("https://test.local"))]));
    let live = Expression::new("wf", "Sync").with_vars(vars(&[(
        "FHIR_BASE_URL",
        json!("https://hims.example.org"),
    )]));

    assert_eq!(resolve(&test, script), json!("https://test.local/Patient"));
    assert_eq!(
        resolve(&live, script),
        json!("https://hims.example.org/Patient")
    );
}

#[test]
fn a_variable_keeps_the_type_it_was_given() {
    // A batch size that arrives as the string "500" fails differently, and
    // later, than one that arrives as a number.
    let expression = Expression::new("wf", "Sync").with_vars(vars(&[
        ("BATCH_SIZE", json!(500)),
        ("DRY_RUN", json!(true)),
    ]));

    assert_eq!(evaluate(&expression, "{{ vars.BATCH_SIZE }}"), json!(500));
    assert_eq!(evaluate(&expression, "{{ vars.DRY_RUN }}"), json!(true));
}

#[test]
fn a_variable_that_was_never_set_reads_as_nothing_rather_than_failing() {
    // A missing variable is a configuration mistake, and it should surface as
    // an obviously empty URL rather than aborting the run with a Rhai error.
    let expression = Expression::new("wf", "Sync").with_vars(vars(&[]));

    assert_eq!(evaluate(&expression, "{{ vars.NOT_SET }}"), Value::Null);
}

#[test]
fn variables_are_available_without_being_declared_anywhere() {
    // No `with_vars` call at all — an instance with no variables configured is
    // the common case and must not be a different code path.
    let expression = Expression::new("wf", "Sync");

    assert_eq!(evaluate(&expression, "{{ vars.ANYTHING }}"), Value::Null);
}

#[test]
fn variables_and_the_environment_are_separate_names() {
    // Separate on purpose, so setting a variable can never shadow a secret an
    // existing workflow already reads from the environment.
    let expression =
        Expression::new("wf", "Sync").with_vars(vars(&[("REGION", json!("eu-west-1"))]));

    assert_eq!(
        evaluate(&expression, "{{ vars.REGION }}"),
        json!("eu-west-1")
    );
    assert_eq!(evaluate(&expression, "{{ env.REGION }}"), Value::Null);
}

// ================================================================ withheld

#[test]
fn the_instance_encryption_key_is_not_readable_from_a_workflow() {
    // Otherwise anyone who can edit a workflow can read every credential the
    // instance stores: put the key in a Set node, POST it somewhere, done.
    // In a hospital the people who build workflows are ward staff, and the
    // people who hold the instance key are not.
    let visible = visible_env([
        ("R8R_ENCRYPTION_KEY", "a-real-looking-secret"),
        ("SLACK_TOKEN", "xoxb-not-real"),
    ]);

    assert!(!visible.contains_key("R8R_ENCRYPTION_KEY"));
    assert_eq!(visible.get("SLACK_TOKEN"), Some(&json!("xoxb-not-real")));
}

#[test]
fn a_withheld_name_is_withheld_whatever_case_it_is_written_in() {
    for spelling in [
        "r8r_encryption_key",
        "R8r_Encryption_Key",
        "R8R_ENCRYPTION_KEY",
    ] {
        let visible = visible_env([(spelling, "secret")]);
        assert!(visible.is_empty(), "{spelling} was visible");
    }
}

#[test]
fn everything_else_in_the_environment_is_still_readable() {
    // Narrowing `env` to a short allow-list would break every workflow that
    // reads a token from it. What is withheld is r8r's own secrets, nothing
    // more; `vars` is the mechanism for wanting something narrower.
    let visible = visible_env([
        ("HOME", "/root"),
        ("SLACK_TOKEN", "xoxb-not-real"),
        ("FHIR_BASE_URL", "https://hims.example.org"),
    ]);

    assert_eq!(visible.len(), 3);
}

#[test]
fn the_withheld_list_is_not_empty_and_names_the_encryption_key() {
    // A refactor that empties this list would silently reopen the hole, and
    // a test driven only through `visible_env` would still pass.
    assert!(WITHHELD.contains(&"R8R_ENCRYPTION_KEY"));
}

#[test]
fn a_real_expression_context_withholds_the_same_things() {
    // `visible_env` being correct is only useful if `Expression::new` uses it.
    let expression = Expression::new("wf", "Exfiltrate");

    assert_eq!(
        evaluate(&expression, "{{ env.R8R_ENCRYPTION_KEY }}"),
        Value::Null
    );
}

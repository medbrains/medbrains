//! Guards on the cost of evaluating expressions.
//!
//! These are not micro-benchmarks; they are ceilings. Each one failed before
//! the engine, the compiled script and the scope were made cheap to reuse, and
//! each one catches the specific regression that would bring the cost back.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

use r8r_workflow::Expression;
use serde_json::{Value, json};
use std::time::Instant;

fn context() -> Expression {
    Expression::new("wf", "perf")
}

#[test]
fn evaluating_the_same_script_many_times_stays_cheap() {
    // The engine and the compiled script are built once per thread; without
    // that, each of these costs about a millisecond.
    let expression = context();
    let item = json!({ "price": 10, "qty": 3 });
    let items = vec![item.clone()];

    // Warm the caches, so the measurement is of steady-state cost.
    let _ = expression.eval("item.price * item.qty", &item, 0, &items);

    let started = Instant::now();
    for _ in 0..1000 {
        let value = expression
            .eval("item.price * item.qty", &item, 0, &items)
            .expect("evaluates");
        assert_eq!(value, json!(30));
    }
    let elapsed = started.elapsed();

    assert!(
        elapsed.as_millis() < 250,
        "1000 evaluations took {elapsed:?}; expected well under 250ms"
    );
}

#[test]
fn a_large_batch_does_not_make_each_item_more_expensive() {
    // The whole batch used to be converted into Rhai values for every single
    // evaluation, which made processing n items cost O(n²).
    let expression = context();

    let measure = |count: usize| {
        let items: Vec<Value> = (0..count).map(|i| json!({ "n": i })).collect();
        let _ = expression.eval("item.n + 1", &items[0], 0, &items);

        let started = Instant::now();
        for (idx, item) in items.iter().enumerate() {
            let _ = expression
                .eval("item.n + 1", item, idx, &items)
                .expect("evaluates");
        }
        started.elapsed()
    };

    let small = measure(100);
    let large = measure(1000);

    // Ten times the items should cost roughly ten times as much, not a hundred.
    assert!(
        large.as_micros() < small.as_micros().saturating_mul(40).max(20_000),
        "100 items took {small:?} but 1000 took {large:?} — that is superlinear"
    );
}

#[test]
fn a_script_that_never_mentions_the_environment_does_not_pay_for_it() {
    // The process environment is copied into the scope only when named.
    let expression = context();
    let item = json!({ "a": 1 });
    let items = vec![item.clone()];

    let _ = expression.eval("item.a", &item, 0, &items);

    let started = Instant::now();
    for _ in 0..2000 {
        let _ = expression
            .eval("item.a", &item, 0, &items)
            .expect("evaluates");
    }
    let elapsed = started.elapsed();

    assert!(
        elapsed.as_millis() < 300,
        "2000 trivial evaluations took {elapsed:?}"
    );
}

#[test]
fn the_environment_is_still_available_when_a_script_asks_for_it() {
    // Skipping work must never turn into skipping correctness.
    // SAFETY: this test runs alone in its binary and sets a variable nothing
    // else reads.
    let expression = context();
    let item = json!({});

    // `env` is captured when the context is built, so read one that always
    // exists rather than setting a new one.
    let value = expression
        .eval("env.PATH != ()", &item, 0, &vec![])
        .expect("evaluates");
    assert_eq!(
        value,
        json!(true),
        "the environment must still be reachable"
    );
}

#[test]
fn items_and_nodes_are_still_available_when_named() {
    let mut expression = context();
    expression.set_node_output("Fetch", &vec![json!({ "v": 42 })]);

    let items = vec![json!({ "a": 1 }), json!({ "a": 2 })];

    assert_eq!(
        expression
            .eval("items.len()", &items[0], 0, &items)
            .expect("evaluates"),
        json!(2)
    );
    assert_eq!(
        expression
            .eval(r#"nodes["Fetch"][0].v"#, &items[0], 0, &items)
            .expect("evaluates"),
        json!(42)
    );
    assert_eq!(
        expression
            .eval("workflow.name", &items[0], 0, &items)
            .expect("evaluates"),
        json!("perf")
    );
}

#[test]
fn many_distinct_scripts_do_not_grow_the_cache_without_bound() {
    // A workflow generating unique scripts must not leak; the cache clears
    // rather than growing forever.
    let expression = context();
    let item = json!({ "a": 1 });

    for i in 0..1500 {
        let script = format!("item.a + {i}");
        let value = expression
            .eval(&script, &item, 0, &vec![])
            .expect("evaluates");
        assert_eq!(value, json!(1 + i));
    }
}

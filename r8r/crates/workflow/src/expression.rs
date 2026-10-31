//! `{{ ... }}` template resolution backed by a sandboxed Rhai engine.
//!
//! Mirrors `expression.ts` + `workflow-data-proxy.ts` in n8n. Rhai was chosen
//! over an embedded JS runtime because it is pure Rust and sandboxed by
//! default: no filesystem, no network, no process access, and hard caps on
//! operations, recursion depth and string size.

use crate::errors::{Result, WorkflowError};
use crate::interfaces::Items;
use rhai::serde::{from_dynamic, to_dynamic};
use rhai::{AST, Dynamic, Engine, EvalAltResult, Scope};
use serde_json::{Map, Value, json};
use std::cell::RefCell;
use std::collections::HashMap;

/// Ceilings that stop a runaway expression from wedging a worker thread.
const MAX_OPERATIONS: u64 = 500_000;
const MAX_STRING_SIZE: usize = 5_000_000;
const MAX_ARRAY_SIZE: usize = 100_000;
const MAX_EXPR_DEPTH: usize = 64;
/// How many distinct scripts to keep compiled per thread.
const MAX_CACHED_SCRIPTS: usize = 512;

/// Environment variables an expression never sees.
///
/// r8r's own secrets, not the workflow author's. Writing a workflow is not the
/// same authority as administering the server that runs it: in a hospital the
/// people who build workflows are ward staff, and the people who hold the
/// instance key are not. Handing `R8R_ENCRYPTION_KEY` to a Set node would let
/// anyone who can edit a workflow read every credential the instance stores,
/// through an ordinary HTTP node and without touching the database.
///
/// This is a prefix match, so it also covers anything r8r adds later under the
/// same names. Everything else in the environment is still visible — narrowing
/// that further is what `vars` is for.
pub const WITHHELD: &[&str] = &["R8R_ENCRYPTION_KEY", "R8R_DATABASE_URL"];

fn is_withheld(name: &str) -> bool {
    WITHHELD
        .iter()
        .any(|secret| name.eq_ignore_ascii_case(secret))
}

/// The part of an environment a workflow may read.
///
/// Taken as an iterator rather than read from the process so that what is
/// withheld can be tested without a test setting a real environment variable —
/// which is process-wide, and so would leak into every other test in the
/// binary.
pub fn visible_env<I, K, V>(vars: I) -> Map<String, Value>
where
    I: IntoIterator<Item = (K, V)>,
    K: AsRef<str> + Into<String>,
    V: Into<String>,
{
    vars.into_iter()
        .filter(|(name, _)| !is_withheld(name.as_ref()))
        .map(|(name, value)| (name.into(), Value::String(value.into())))
        .collect()
}

/// Read-only context an expression is evaluated against.
#[derive(Debug, Clone, Default)]
pub struct Expression {
    env: Value,
    /// Instance variables, exposed as `vars`. See [`Expression::with_vars`].
    vars: Value,
    /// Node label -> that node's `main` output, so later nodes can look back.
    nodes: Map<String, Value>,
    workflow: Value,
    /// Extra variables for a narrower context — a declarative integration puts
    /// `parameter` and `credentials` here, visible to its routing templates and
    /// to nothing else.
    extra: Map<String, Value>,
}

impl Expression {
    /// Build a context exposing the process environment as `env`.
    ///
    /// Environment variables are one of r8r's credential mechanisms: reference
    /// a secret as `{{ env.SLACK_TOKEN }}` rather than storing it in the
    /// workflow. See [`WITHHELD`] for what an expression cannot reach.
    pub fn new(workflow_id: &str, workflow_name: &str) -> Self {
        let env = visible_env(std::env::vars());
        Expression {
            env: Value::Object(env),
            vars: Value::Object(Map::new()),
            nodes: Map::new(),
            workflow: json!({ "id": workflow_id, "name": workflow_name }),
            extra: Map::new(),
        }
    }

    /// Supply the instance's variables, read as `{{ vars.FHIR_BASE_URL }}`.
    ///
    /// The point is that the same workflow runs in two places. A URL, a
    /// hospital code, a batch size — anything that differs between a test
    /// instance and the live one — lives here rather than typed into a node,
    /// so promoting a workflow is a copy rather than an edit of every step.
    ///
    /// Distinct from `env` on purpose. `env` is whatever the operating system
    /// handed the process, which is a large surface nobody curated; `vars` is
    /// a short list somebody chose, stored with the instance and editable
    /// without a restart.
    #[must_use]
    pub fn with_vars(mut self, vars: Map<String, Value>) -> Self {
        self.vars = Value::Object(vars);
        self
    }

    /// Make one more variable visible to expressions evaluated with this
    /// context. Scoped to the clone it is set on, so secrets exposed for a
    /// routing template never leak into a user's Code node.
    pub fn set_variable(&mut self, name: &str, value: Value) {
        self.extra.insert(name.to_owned(), value);
    }

    /// Record a node's output so downstream expressions can read
    /// `nodes["Fetch users"]`.
    pub fn set_node_output(&mut self, label: &str, items: &Items) {
        self.nodes.insert(label.to_string(), json!(items));
    }

    /// One engine per thread, built once.
    ///
    /// `Engine::new()` constructs the whole standard package, which costs
    /// roughly a millisecond — fine once, ruinous when a workflow evaluates a
    /// template per field per item. Caching it per thread avoids both the cost
    /// and any need for locking.
    fn with_engine<T>(work: impl FnOnce(&Engine) -> T) -> T {
        thread_local! {
            static ENGINE: Engine = Expression::build_engine();
        }
        ENGINE.with(work)
    }

    /// Compile a script once and reuse it.
    ///
    /// Scripts are workflow parameters, so the same handful runs over every
    /// item in a batch. Parsing them each time is pure waste.
    fn with_ast<T>(engine: &Engine, script: &str, work: impl FnOnce(&AST) -> T) -> Result<T> {
        thread_local! {
            static CACHE: RefCell<HashMap<String, AST>> = RefCell::new(HashMap::new());
        }

        CACHE.with(|cache| {
            let mut cache = cache.borrow_mut();
            if !cache.contains_key(script) {
                // Bounded so a workflow generating unique scripts cannot grow
                // this without limit.
                if cache.len() >= MAX_CACHED_SCRIPTS {
                    cache.clear();
                }
                let compiled = engine
                    .compile(script)
                    .map_err(|e| WorkflowError::Expression(e.to_string()))?;
                cache.insert(script.to_owned(), compiled);
            }
            let ast = cache.get(script).ok_or_else(|| {
                WorkflowError::Expression("compiled script vanished from the cache".into())
            })?;
            Ok(work(ast))
        })
    }

    fn build_engine() -> Engine {
        let mut e = Engine::new();
        e.set_max_expr_depths(MAX_EXPR_DEPTH, MAX_EXPR_DEPTH);
        e.set_max_operations(MAX_OPERATIONS);
        e.set_max_string_size(MAX_STRING_SIZE);
        e.set_max_array_size(MAX_ARRAY_SIZE);

        e.register_fn("json_encode", |v: Dynamic| {
            from_dynamic::<Value>(&v)
                .map(|j| j.to_string())
                .unwrap_or_default()
        });
        e.register_fn("json_decode", |s: &str| {
            serde_json::from_str::<Value>(s)
                .ok()
                .and_then(|v| to_dynamic(v).ok())
                .unwrap_or(Dynamic::UNIT)
        });
        e.register_fn("uuid", || uuid::Uuid::new_v4().to_string());
        e.register_fn("now", || chrono::Utc::now().to_rfc3339());
        e.register_fn("now_ms", || chrono::Utc::now().timestamp_millis());
        e.register_fn("today", || {
            chrono::Utc::now().format("%Y-%m-%d").to_string()
        });
        // Safe nested access: `dig(item, "user.address.city")` yields () when
        // any hop is missing, instead of raising.
        e.register_fn("dig", |v: Dynamic, path: &str| dig(&v, path));
        e
    }

    /// Build the scope for one evaluation.
    ///
    /// Only `item` is always materialised. Converting the whole batch, the
    /// process environment and every earlier node's output into Rhai values
    /// costs more than the script usually does — and turns a per-item loop into
    /// quadratic work — so the expensive ones are provided only when the script
    /// actually names them. The check is a substring scan, which over-provides
    /// rather than under-provides, so it can never hide a variable a script
    /// needs.
    fn scope(
        &self,
        script: &str,
        item: &Value,
        idx: usize,
        items: &Items,
    ) -> Result<Scope<'static>> {
        let dyn_of = |v: &Value| -> Result<Dynamic> {
            to_dynamic(v.clone()).map_err(|e| WorkflowError::Expression(e.to_string()))
        };

        let mut s = Scope::new();
        s.push_dynamic("item", dyn_of(item)?);
        if script.contains("json") {
            s.push_dynamic("json", dyn_of(item)?); // n8n muscle memory
        }
        s.push_dynamic("idx", Dynamic::from(i64::try_from(idx).unwrap_or(i64::MAX)));
        if script.contains("items") {
            s.push_dynamic("items", dyn_of(&json!(items))?);
        }
        if script.contains("vars") {
            s.push_dynamic("vars", dyn_of(&self.vars)?);
        }
        if script.contains("env") {
            s.push_dynamic("env", dyn_of(&self.env)?);
        }
        if script.contains("nodes") {
            s.push_dynamic("nodes", dyn_of(&Value::Object(self.nodes.clone()))?);
        }
        if script.contains("workflow") {
            s.push_dynamic("workflow", dyn_of(&self.workflow)?);
        }
        for (name, value) in &self.extra {
            if script.contains(name.as_str()) {
                s.push_dynamic(name.clone(), dyn_of(value)?);
            }
        }
        Ok(s)
    }

    /// Evaluate a bare script (no `{{ }}`) and return its final value as JSON.
    ///
    /// A path that does not exist evaluates to `null` rather than failing.
    /// Half-populated records are the norm in automation — `item.address.city`
    /// on a contact with no address should leave the field blank, not abort a
    /// run that was otherwise fine. Every other kind of error still propagates.
    pub fn eval(&self, script: &str, item: &Value, idx: usize, items: &Items) -> Result<Value> {
        let mut scope = self.scope(script, item, idx, items)?;

        Self::with_engine(|engine| {
            let outcome = Self::with_ast(engine, script, |ast| {
                engine.eval_ast_with_scope::<Dynamic>(&mut scope, ast)
            })?;

            match outcome {
                Ok(out) => from_dynamic::<Value>(&out)
                    .map_err(|e| WorkflowError::Expression(e.to_string())),
                Err(e) if is_missing_path(&e) => Ok(Value::Null),
                Err(e) => Err(WorkflowError::Expression(e.to_string())),
            }
        })
    }

    pub fn eval_bool(&self, script: &str, item: &Value, idx: usize, items: &Items) -> Result<bool> {
        Ok(truthy(&self.eval(script, item, idx, items)?))
    }

    /// Walk a parameter tree, replacing every `{{ ... }}` template it contains.
    pub fn resolve(
        &self,
        params: &Value,
        item: &Value,
        idx: usize,
        items: &Items,
    ) -> Result<Value> {
        match params {
            Value::String(s) => self.resolve_str(s, item, idx, items),
            Value::Array(a) => a
                .iter()
                .map(|v| self.resolve(v, item, idx, items))
                .collect::<Result<Vec<_>>>()
                .map(Value::Array),
            Value::Object(o) => {
                let mut out = Map::new();
                for (k, v) in o {
                    out.insert(k.clone(), self.resolve(v, item, idx, items)?);
                }
                Ok(Value::Object(out))
            }
            other => Ok(other.clone()),
        }
    }

    fn resolve_str(&self, s: &str, item: &Value, idx: usize, items: &Items) -> Result<Value> {
        let Some((mut a, mut b)) = next_template(s, 0) else {
            return Ok(Value::String(s.into()));
        };
        // A string that is *only* a template keeps the value's real type, so
        // `{{ 1 + 1 }}` yields the number 2 rather than the string "2".
        if a == 0 && b == s.len() {
            return self.eval(&s[a + 2..b - 2], item, idx, items);
        }
        let mut out = String::new();
        let mut cur = 0usize;
        loop {
            out.push_str(&s[cur..a]);
            out.push_str(&stringify(&self.eval(
                &s[a + 2..b - 2],
                item,
                idx,
                items,
            )?));
            cur = b;
            match next_template(s, cur) {
                Some(n) => (a, b) = n,
                None => break,
            }
        }
        out.push_str(&s[cur..]);
        Ok(Value::String(out))
    }
}

/// Did this fail only because the expression walked into something absent?
///
/// Rhai raises `ErrorDotExpr` when a property is read from a value that has no
/// such property — including the unit value a missing key evaluates to. That is
/// exactly the "undefined path" case, and nothing else raises it.
fn is_missing_path(error: &EvalAltResult) -> bool {
    matches!(error, EvalAltResult::ErrorDotExpr(..))
}

/// Byte range of the next `{{ ... }}` at or after `from`, braces included.
fn next_template(s: &str, from: usize) -> Option<(usize, usize)> {
    let open = s.get(from..)?.find("{{")? + from;
    let close = s.get(open + 2..)?.find("}}")? + open + 2;
    Some((open, close + 2))
}

fn dig(v: &Dynamic, path: &str) -> Dynamic {
    let Ok(json) = from_dynamic::<Value>(v) else {
        return Dynamic::UNIT;
    };
    let mut cur = &json;
    for hop in path.split('.') {
        cur = match cur.get(hop) {
            Some(next) => next,
            None => return Dynamic::UNIT,
        };
    }
    to_dynamic(cur.clone()).unwrap_or(Dynamic::UNIT)
}

/// JSON -> string the way a template interpolation should render it.
pub fn stringify(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

/// JavaScript-ish truthiness, so `if` conditions behave the way users expect.
pub fn truthy(v: &Value) -> bool {
    match v {
        Value::Bool(b) => *b,
        Value::Null => false,
        Value::Number(n) => n.as_f64().is_some_and(|f| f != 0.0),
        Value::String(s) => !s.is_empty() && s != "false" && s != "0",
        Value::Array(a) => !a.is_empty(),
        Value::Object(_) => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx() -> Expression {
        Expression::new("wf1", "test")
    }

    #[test]
    fn whole_string_template_keeps_its_type() {
        let v = ctx().eval("1 + 1", &json!({}), 0, &vec![]).unwrap();
        assert_eq!(v, json!(2));
        let v = ctx()
            .resolve(&json!("{{ 1 + 1 }}"), &json!({}), 0, &vec![])
            .unwrap();
        assert_eq!(v, json!(2), "sole template must not stringify");
    }

    #[test]
    fn interpolation_mixes_text_and_values() {
        let item = json!({ "name": "ada", "n": 3 });
        let v = ctx()
            .resolve(
                &json!("hi {{ item.name }} x{{ item.n }}"),
                &item,
                0,
                &vec![],
            )
            .unwrap();
        assert_eq!(v, json!("hi ada x3"));
    }

    #[test]
    fn resolves_nested_params() {
        let item = json!({ "id": 7 });
        let v = ctx()
            .resolve(
                &json!({ "url": "http://x/{{ item.id }}", "opts": ["{{ item.id }}", "plain"] }),
                &item,
                0,
                &vec![],
            )
            .unwrap();
        assert_eq!(v, json!({ "url": "http://x/7", "opts": [7, "plain"] }));
    }

    #[test]
    fn dig_is_safe_on_missing_keys() {
        let v = ctx()
            .eval(
                r#"dig(item, "a.b.c")"#,
                &json!({"a": {"b": {"c": 5}}}),
                0,
                &vec![],
            )
            .unwrap();
        assert_eq!(v, json!(5));
        let v = ctx()
            .eval(r#"dig(item, "a.nope.c")"#, &json!({"a": {}}), 0, &vec![])
            .unwrap();
        assert_eq!(v, Value::Null);
    }

    #[test]
    fn node_outputs_are_visible_downstream() {
        let mut c = ctx();
        c.set_node_output("Fetch", &vec![json!({"v": 42})]);
        let v = c
            .eval(r#"nodes["Fetch"][0].v"#, &json!({}), 0, &vec![])
            .unwrap();
        assert_eq!(v, json!(42));
    }

    #[test]
    fn a_path_through_a_missing_object_is_null_not_an_error() {
        let contact = json!({ "name": "ada" });
        let v = ctx()
            .eval("item.address.city", &contact, 0, &vec![])
            .unwrap();
        assert_eq!(
            v,
            Value::Null,
            "a missing intermediate must not abort the run"
        );
    }

    #[test]
    fn a_real_error_still_propagates() {
        // Syntax errors and operation limits are bugs, not missing data.
        assert!(
            ctx()
                .eval("this is not rhai (", &json!({}), 0, &vec![])
                .is_err()
        );
    }

    #[test]
    fn extra_variables_are_visible_only_to_the_context_they_were_set_on() {
        let base = ctx();
        let mut scoped = base.clone();
        scoped.set_variable("credentials", json!({ "token": "secret" }));

        let seen = scoped
            .eval("credentials.token", &json!({}), 0, &vec![])
            .unwrap();
        assert_eq!(seen, json!("secret"));

        // The original context never learned about it.
        assert!(
            base.eval("credentials.token", &json!({}), 0, &vec![])
                .is_err()
        );
    }

    #[test]
    fn runaway_loops_are_capped() {
        let err = ctx().eval("let i = 0; loop { i += 1; }", &json!({}), 0, &vec![]);
        assert!(err.is_err(), "infinite loop must hit the operation cap");
    }

    #[test]
    fn truthiness_matches_expectations() {
        assert!(truthy(&json!("yes")));
        assert!(!truthy(&json!("")));
        assert!(!truthy(&json!("false")));
        assert!(!truthy(&Value::Null));
        assert!(truthy(&json!([1])));
        assert!(!truthy(&json!([])));
    }
}

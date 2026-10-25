//! Whether a statement the assistant wrote may run: one SELECT over the
//! `ai_query` views the user may read, calling only plain functions.
//!
//! The database is the wall that holds — the statement runs read-only as a
//! role that can read those views and nothing else ([`super::query`]). This
//! check comes first so a refusal has a reason the model can act on, and so
//! what runs is the parsed statement printed back, never the text as written:
//! a comment or a second statement cannot ride along.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use std::collections::HashSet;
use std::ops::ControlFlow;

use sqlparser::ast::{
    Expr, ObjectName, Query, Select, SetExpr, Statement, TableFactor, Visit, Visitor,
};
use sqlparser::dialect::PostgreSqlDialect;
use sqlparser::parser::Parser;

/// Longest statement accepted.
const MAX_SQL_CHARS: usize = 4_000;
/// The schema every view lives in.
pub(super) const SCHEMA: &str = "ai_query";

/// Functions a query may call: aggregates, windows, dates, text and numbers.
/// Anything else — `pg_sleep`, `pg_read_file`, `set_config`, `dblink`,
/// `lo_import`, `nextval` — is refused by not being here.
const FUNCTIONS: &[&str] = &[
    "count",
    "sum",
    "avg",
    "min",
    "max",
    "stddev",
    "stddev_samp",
    "variance",
    "percentile_cont",
    "percentile_disc",
    "mode",
    "bool_and",
    "bool_or",
    "every",
    "string_agg",
    "array_agg",
    "row_number",
    "rank",
    "dense_rank",
    "ntile",
    "lag",
    "lead",
    "first_value",
    "last_value",
    "cume_dist",
    "percent_rank",
    "round",
    "trunc",
    "ceil",
    "ceiling",
    "floor",
    "abs",
    "sign",
    "greatest",
    "least",
    "coalesce",
    "nullif",
    "date_trunc",
    "date_part",
    "extract",
    "to_char",
    "make_date",
    "age",
    "now",
    "current_date",
    "current_timestamp",
    "localtimestamp",
    "justify_days",
    "justify_interval",
    "lower",
    "upper",
    "initcap",
    "trim",
    "btrim",
    "length",
    "left",
    "right",
    "concat",
    "replace",
    "split_part",
    "position",
    "substring",
    "generate_series",
];

/// Functions that may stand in FROM as a row source.
const ROW_FUNCTIONS: &[&str] = &["generate_series"];

/// Why a statement may not run, in words the model can act on.
#[derive(Debug, PartialEq, Eq)]
pub(super) struct Refusal(pub(super) String);

fn refuse<T>(why: impl Into<String>) -> Result<T, Refusal> {
    Err(Refusal(why.into()))
}

/// The statement to run, printed from its parse, if `sql` is one SELECT over
/// `views` (names in [`SCHEMA`], schema optional) calling only allowed
/// functions.
///
/// # Errors
/// Why it may not run.
pub(super) fn check(sql: &str, views: &[&str]) -> Result<String, Refusal> {
    if sql.chars().count() > MAX_SQL_CHARS {
        return refuse(format!(
            "the query is longer than {MAX_SQL_CHARS} characters"
        ));
    }
    let statements = Parser::parse_sql(&PostgreSqlDialect {}, sql)
        .or_else(|e| refuse(format!("it is not valid SQL ({e})")))?;
    let [statement] = statements.as_slice() else {
        return refuse("write exactly one statement");
    };
    if !matches!(statement, Statement::Query(_)) {
        return refuse("only a SELECT may run");
    }
    let mut rules = Rules {
        views,
        ctes: HashSet::new(),
        statements: 0,
    };
    if let ControlFlow::Break(why) = statement.visit(&mut rules) {
        return refuse(why);
    }
    Ok(statement.to_string())
}

struct Rules<'a> {
    views: &'a [&'a str],
    ctes: HashSet<String>,
    statements: usize,
}

/// `TABLE x` reads a relation without naming it as one; refused.
fn has_table_command(body: &SetExpr) -> bool {
    match body {
        SetExpr::Table(_) => true,
        SetExpr::SetOperation { left, right, .. } => {
            has_table_command(left) || has_table_command(right)
        }
        _ => false,
    }
}

fn lower_parts(name: &ObjectName) -> Vec<String> {
    name.0
        .iter()
        .map(|p| p.to_string().trim_matches('"').to_lowercase())
        .collect()
}

impl Visitor for Rules<'_> {
    type Break = String;

    fn pre_visit_statement(&mut self, statement: &Statement) -> ControlFlow<String> {
        self.statements += 1;
        if self.statements > 1 || !matches!(statement, Statement::Query(_)) {
            return ControlFlow::Break(
                "only reading is allowed — no INSERT, UPDATE, DELETE or MERGE, even inside WITH"
                    .to_owned(),
            );
        }
        ControlFlow::Continue(())
    }

    fn pre_visit_query(&mut self, query: &Query) -> ControlFlow<String> {
        if !query.locks.is_empty() || query.for_clause.is_some() {
            return ControlFlow::Break("FOR UPDATE / FOR SHARE is not allowed".to_owned());
        }
        if query.settings.is_some()
            || query.format_clause.is_some()
            || !query.pipe_operators.is_empty()
        {
            return ControlFlow::Break("use plain PostgreSQL SELECT syntax".to_owned());
        }
        if has_table_command(&query.body) {
            return ControlFlow::Break("name the view in FROM instead of TABLE".to_owned());
        }
        if matches!(
            *query.body,
            SetExpr::Insert(_) | SetExpr::Update(_) | SetExpr::Delete(_) | SetExpr::Merge(_)
        ) {
            return ControlFlow::Break("only reading is allowed".to_owned());
        }
        if let Some(with) = &query.with {
            for cte in &with.cte_tables {
                self.ctes.insert(cte.alias.name.value.to_lowercase());
            }
        }
        ControlFlow::Continue(())
    }

    fn pre_visit_select(&mut self, select: &Select) -> ControlFlow<String> {
        if select.into.is_some() {
            return ControlFlow::Break("SELECT INTO is not allowed".to_owned());
        }
        ControlFlow::Continue(())
    }

    fn pre_visit_relation(&mut self, relation: &ObjectName) -> ControlFlow<String> {
        let parts = lower_parts(relation);
        let ok = match parts.as_slice() {
            [schema, view] => schema == SCHEMA && self.views.contains(&view.as_str()),
            [name] => {
                self.views.contains(&name.as_str())
                    || self.ctes.contains(name)
                    || ROW_FUNCTIONS.contains(&name.as_str())
            }
            _ => false,
        };
        if ok {
            ControlFlow::Continue(())
        } else {
            ControlFlow::Break(format!(
                "{relation} is not one of the views you may query ({})",
                self.views.join(", ")
            ))
        }
    }

    fn pre_visit_table_factor(&mut self, factor: &TableFactor) -> ControlFlow<String> {
        match factor {
            TableFactor::Table { name, args, .. } => {
                let parts = lower_parts(name);
                let is_row_fn =
                    matches!(parts.as_slice(), [n] if ROW_FUNCTIONS.contains(&n.as_str()));
                if args.is_some() && !is_row_fn {
                    return ControlFlow::Break(format!("{name}(...) may not be used in FROM"));
                }
                if args.is_none() && is_row_fn {
                    return ControlFlow::Break(format!("{name} needs its arguments"));
                }
                ControlFlow::Continue(())
            }
            TableFactor::Derived { .. } | TableFactor::NestedJoin { .. } => {
                ControlFlow::Continue(())
            }
            other => ControlFlow::Break(format!("{other} may not be used in FROM")),
        }
    }

    fn pre_visit_expr(&mut self, expr: &Expr) -> ControlFlow<String> {
        match expr {
            Expr::Function(f) => {
                let parts = lower_parts(&f.name);
                match parts.as_slice() {
                    [name] if FUNCTIONS.contains(&name.as_str()) => ControlFlow::Continue(()),
                    _ => ControlFlow::Break(format!("the function {} is not allowed", f.name)),
                }
            }
            Expr::Cast { data_type, .. }
                if data_type.to_string().to_lowercase().starts_with("reg") =>
            {
                ControlFlow::Break("casts to catalogue types are not allowed".to_owned())
            }
            _ => ControlFlow::Continue(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Refusal, check};

    const VIEWS: &[&str] = &["invoices", "visits"];

    fn refused(sql: &str) -> String {
        match check(sql, VIEWS) {
            Err(Refusal(why)) => why,
            Ok(s) => panic!("ran: {s}"),
        }
    }

    #[test]
    fn a_plain_report_runs_as_printed_from_its_parse() {
        let sql = "-- revenue\nSELECT date_trunc('month', invoice_date) AS month, sum(total_amount) \
                   FROM ai_query.invoices WHERE invoice_date >= current_date - interval '12 months' \
                   GROUP BY 1 ORDER BY 1";
        let ran = check(sql, VIEWS).unwrap_or_default();
        assert!(ran.starts_with("SELECT date_trunc('month', invoice_date)"));
        assert!(!ran.contains("--"));
        let cte = "WITH m AS (SELECT department, count(DISTINCT patient_key) AS n FROM visits GROUP BY 1) \
                   SELECT * FROM m ORDER BY n DESC";
        assert!(check(cte, VIEWS).is_ok());
        assert!(check("SELECT g FROM generate_series(1, 3) AS g", VIEWS).is_ok());
    }

    #[test]
    fn writes_are_refused_wherever_they_hide() {
        assert!(refused("DELETE FROM invoices").contains("only"));
        assert!(
            refused("WITH x AS (DELETE FROM invoices RETURNING *) SELECT * FROM x")
                .contains("reading")
        );
        assert!(refused("SELECT 1; DROP TABLE invoices").contains("one statement"));
        assert!(
            refused("SELECT 1 /* ; */ ; UPDATE invoices SET total_amount = 0")
                .contains("one statement")
        );
        assert!(refused("SELECT * INTO t FROM invoices").contains("INTO"));
        assert!(refused("SELECT * FROM invoices FOR UPDATE").contains("FOR UPDATE"));
        assert!(refused("SET ROLE medbrains").contains("only a SELECT"));
        assert!(refused("COPY invoices TO '/tmp/x'").contains("only a SELECT"));
    }

    #[test]
    fn only_the_permitted_views_may_be_read() {
        assert!(refused("SELECT * FROM public.invoices").contains("not one of the views"));
        assert!(refused("SELECT * FROM patients").contains("not one of the views"));
        assert!(refused("SELECT * FROM pg_catalog.pg_roles").contains("not one of the views"));
        assert!(
            refused("SELECT * FROM information_schema.tables").contains("not one of the views")
        );
        assert!(refused("SELECT * FROM ai_query.payments").contains("not one of the views"));
        assert!(
            refused("SELECT * FROM invoices WHERE patient_key IN (SELECT id::text FROM patients)")
                .contains("not one of the views")
        );
        assert!(refused("TABLE invoices").contains("TABLE"));
    }

    #[test]
    fn only_plain_functions_may_be_called() {
        assert!(refused("SELECT pg_sleep(10)").contains("pg_sleep"));
        assert!(refused("SELECT pg_read_file('/etc/passwd')").contains("pg_read_file"));
        assert!(refused("SELECT set_config('app.tenant_id', 'x', true)").contains("set_config"));
        assert!(refused("SELECT pg_catalog.count(*) FROM invoices").contains("not allowed"));
        assert!(refused("SELECT 'invoices'::regclass").contains("catalogue"));
        assert!(refused("SELECT * FROM dblink('x', 'y') AS t(a int)").contains("FROM"));
    }
}

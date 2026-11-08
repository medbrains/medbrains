//! The signable table agrees with itself and with migration 1418.

use super::SIGNABLE;
use std::collections::HashSet;

/// Tables a payload may read for context, beside its record and children.
/// An edit to them is not an edit to the signed record (a patient's address,
/// an order's status); a new child table must be declared in `children`.
const CONTEXT_TABLES: &[&str] = &[
    "patients",
    "encounters",
    "admissions",
    "ot_bookings",
    "er_visits",
    "lab_orders",
    "radiology_orders",
];

const MIGRATION: &str =
    include_str!("../../../medbrains-db-migrations/src/migrations/1418_sign_every_record.sql");

/// The identifier that starts `text`.
fn ident(text: &str) -> String {
    text.chars()
        .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
        .collect()
}

/// The alias `table` is read under in `sql`, if it is read.
fn alias_of(sql: &str, table: &str) -> Option<String> {
    let from = format!("FROM {table} ");
    let join = format!("JOIN {table} ");
    sql.find(&from)
        .map(|at| ident(&sql[at + from.len()..]))
        .or_else(|| sql.find(&join).map(|at| ident(&sql[at + join.len()..])))
}

/// Every column of `alias` the SQL reads, anywhere: select list, joins and
/// filters (a filter column decides whether the record is there at all).
fn columns_of(sql: &str, alias: &str) -> Vec<String> {
    let prefix = format!("{alias}.");
    let bytes = sql.as_bytes();
    let mut cols: Vec<String> = sql
        .match_indices(&prefix)
        .filter(|(i, _)| *i == 0 || !(bytes[i - 1].is_ascii_alphanumeric() || bytes[i - 1] == b'_'))
        .map(|(i, _)| ident(&sql[i + prefix.len()..]))
        .filter(|c| !matches!(c.as_str(), "id" | "tenant_id" | "created_at"))
        .collect();
    cols.sort();
    cols.dedup();
    cols
}

/// Every table the SQL reads.
fn tables_of(sql: &str) -> HashSet<String> {
    ["FROM ", "JOIN "]
        .iter()
        .flat_map(|kw| sql.match_indices(kw).map(move |(i, _)| ident(&sql[i + kw.len()..])))
        .filter(|t| !t.is_empty())
        .collect()
}

/// The trigger line in the migration that starts with `marker`.
fn trigger_line(marker: &str) -> &'static str {
    MIGRATION.lines().find(|l| l.contains(marker)).unwrap_or_default()
}

/// Each type is listed once, binds only tenant and record, names its own
/// type, and signs its author column as content.
#[test]
fn every_type_is_unique_and_signs_its_author() {
    let mut seen = HashSet::new();
    for t in SIGNABLE {
        assert!(seen.insert(t.record_type), "{} listed twice", t.record_type);
        assert!(t.payload_sql.contains("$2"), "{} binds the record", t.record_type);
        assert!(!t.payload_sql.contains("$3"), "{}: authorship is checked apart", t.record_type);
        let flat = t.payload_sql.split_whitespace().collect::<Vec<_>>().join(" ");
        assert!(
            flat.contains(&format!("'record_type', '{}'", t.record_type)),
            "{}: the payload names its own type",
            t.record_type
        );
        let alias = alias_of(t.payload_sql, t.table).unwrap_or_default();
        assert!(
            columns_of(t.payload_sql, &alias).contains(&t.author.to_owned()),
            "{}: the author column {} is signed content",
            t.record_type,
            t.author
        );
    }
}

/// The edit guard of migration 1418 watches every column of the record a
/// payload reads, and a child guard watches every child it reads; a column
/// left out would let an edit keep a signature over content it no longer
/// matches.
#[test]
fn the_edit_guards_watch_every_signed_column() {
    for t in SIGNABLE {
        let line = trigger_line(&format!("signable_edit_guard('{}',", t.record_type));
        assert!(!line.is_empty(), "{} has no edit guard", t.record_type);
        assert!(
            MIGRATION.contains(&format!("ON public.{}\n    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('{}',", t.table, t.record_type)),
            "{}: the guard sits on {}",
            t.record_type,
            t.table
        );
        let alias = alias_of(t.payload_sql, t.table).unwrap_or_default();
        for col in columns_of(t.payload_sql, &alias) {
            assert!(line.contains(&format!("'{col}'")), "{}: the guard misses {col}", t.record_type);
        }
        for (child, fk) in t.children {
            let line = trigger_line(&format!("signable_child_guard('{}', '{child}'", t.record_type));
            assert!(!line.is_empty(), "{}: no child guard on {child}", t.record_type);
            assert!(line.contains(&format!("'{fk}'")), "{}: {child} names its record by {fk}", t.record_type);
            let alias = alias_of(t.payload_sql, child).unwrap_or_default();
            for col in columns_of(t.payload_sql, &alias) {
                assert!(line.contains(&format!("'{col}'")), "{child}: the guard misses {col}");
            }
        }
    }
}

/// A payload reads only its record, its declared children and context
/// tables, so no signed child can be left without a guard.
#[test]
fn every_table_a_payload_reads_is_declared() {
    for t in SIGNABLE {
        for table in tables_of(t.payload_sql) {
            let declared = table == t.table
                || t.children.iter().any(|(c, _)| *c == table)
                || CONTEXT_TABLES.contains(&table.as_str());
            assert!(declared, "{} reads {table}: declare it as a child or context", t.record_type);
        }
    }
}

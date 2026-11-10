//! The signable table agrees with itself and with migration 1418.

use super::{SIGNABLE, SignableType};
use std::collections::HashSet;

/// Tables a payload may read for context only, beside its record and its
/// related tables: an edit there (a patient's address, an admission's bed)
/// is not an edit to the signed document.
const CONTEXT_TABLES: &[&str] = &["patients", "encounters", "admissions", "er_visits"];

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
    ["FROM ", "JOIN "].iter().find_map(|kw| {
        let marker = format!("{kw}{table} ");
        sql.find(&marker).map(|at| ident(&sql[at + marker.len()..]))
    })
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
        .flat_map(|kw| {
            sql.match_indices(kw)
                .map(move |(i, _)| ident(&sql[i + kw.len()..]))
        })
        .filter(|t| !t.is_empty())
        .collect()
}

/// The trigger line in the migration that contains `marker`.
fn trigger_line(marker: &str) -> &'static str {
    MIGRATION
        .lines()
        .find(|l| l.contains(marker))
        .unwrap_or_default()
}

/// The record guard's line for `t`.
fn record_guard(t: &SignableType) -> &'static str {
    trigger_line(&format!("signable_edit_guard('{}',", t.record_type))
}

/// The related guard's line for `t` on `table`.
fn related_guard(t: &SignableType, table: &str) -> &'static str {
    trigger_line(&format!(
        "signable_related_guard('{}', '{table}'",
        t.record_type
    ))
}

/// Each type is listed once, binds only tenant and record, and names its
/// own type.
#[test]
fn every_type_is_unique_and_names_itself() {
    let mut seen = HashSet::new();
    for t in SIGNABLE {
        assert!(seen.insert(t.record_type), "{} listed twice", t.record_type);
        assert!(
            t.payload_sql.contains("$2"),
            "{} binds the record",
            t.record_type
        );
        assert!(
            !t.payload_sql.contains("$3"),
            "{}: authorship is checked apart",
            t.record_type
        );
        let flat = t
            .payload_sql
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        assert!(
            flat.contains(&format!("'record_type', '{}'", t.record_type)),
            "{}: the payload names its own type",
            t.record_type
        );
    }
}

/// Whoever the author expression names is watched: change the validator or
/// the verifying consultant and the signature comes off.
#[test]
fn every_column_naming_the_author_is_watched() {
    for t in SIGNABLE {
        for col in columns_of(t.author, "r") {
            assert!(
                record_guard(t).contains(&format!("'{col}'")),
                "{}: author r.{col} unwatched",
                t.record_type
            );
        }
        for table in tables_of(t.author) {
            let alias = alias_of(t.author, &table).unwrap_or_default();
            let line = related_guard(t, &table);
            assert!(
                !line.is_empty(),
                "{}: the author reads {table}, which is unguarded",
                t.record_type
            );
            for col in columns_of(t.author, &alias) {
                assert!(
                    line.contains(&format!("'{col}'")),
                    "{}: author {table}.{col} unwatched",
                    t.record_type
                );
            }
        }
    }
}

/// The record guard watches every column of the record a payload reads, and
/// a related guard every column of a child it signs; a column left out would
/// let an edit keep a signature over content it no longer matches.
#[test]
fn the_edit_guards_watch_every_signed_column() {
    for t in SIGNABLE {
        let line = record_guard(t);
        assert!(!line.is_empty(), "{} has no edit guard", t.record_type);
        assert!(
            MIGRATION.contains(&format!(
                "ON public.{}\n    FOR EACH ROW EXECUTE FUNCTION public.signable_edit_guard('{}',",
                t.table, t.record_type
            )),
            "{}: the guard sits on {}",
            t.record_type,
            t.table
        );
        let alias = alias_of(t.payload_sql, t.table).unwrap_or_default();
        for col in columns_of(t.payload_sql, &alias) {
            assert!(
                line.contains(&format!("'{col}'")),
                "{}: the guard misses {col}",
                t.record_type
            );
        }
        for rel in t.related {
            let line = related_guard(t, rel.table);
            assert!(
                !line.is_empty(),
                "{}: no guard on {}",
                t.record_type,
                rel.table
            );
            let link = format!("'{}', '{}', '{}'", t.table, rel.record_col, rel.key);
            assert!(
                line.contains(&link),
                "{}: {} links by {link}",
                t.record_type,
                rel.table
            );
            if rel.record_col == "id" {
                let alias = alias_of(t.payload_sql, rel.table).unwrap_or_default();
                for col in columns_of(t.payload_sql, &alias) {
                    assert!(
                        line.contains(&format!("'{col}'")),
                        "{}: the guard misses {col}",
                        rel.table
                    );
                }
            }
        }
    }
}

/// A payload reads only its record, its related tables and context tables,
/// so no signed table can be left without a guard.
#[test]
fn every_table_a_payload_reads_is_declared() {
    for t in SIGNABLE {
        for table in tables_of(t.payload_sql) {
            let declared = table == t.table
                || t.related.iter().any(|r| r.table == table)
                || CONTEXT_TABLES.contains(&table.as_str());
            assert!(
                declared,
                "{} reads {table}: declare it as related or context",
                t.record_type
            );
        }
    }
}

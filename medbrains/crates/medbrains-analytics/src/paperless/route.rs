//! Counting a signable type: the statement that writes its `paperless_daily`
//! rows, built from the type's registry entry
//! (`medbrains_documents::signable::SIGNABLE`) and the columns its tables
//! have, read from the catalogue at run time. A type added to the registry is
//! counted with no change here.
//!
//! The day is the record's `created_at` (`signed_at` for a table that has only
//! that, the doctor's order basket). The department is the first found of:
//! the record's own `department_id` or `from_department_id` (a referral is
//! written by the referring department); its parent's (the registry's
//! `related` entry the record points at: the lab order, the OT booking);
//! the encounter's, reached from the record, the parent or its ER visit; the
//! admission's, reached the same ways. A record that reaches none (a blood
//! transfusion record names only the patient) counts under "no department".
//!
//! A record is signed while its `signed_record_id` points at a live primary
//! signature: the edit guard (migration 1418) clears that link when the
//! record changes, so a signature on content since edited is not counted, and
//! a co-signature or witness on its own is not the author's signature.

use std::collections::{HashMap, HashSet};
use std::fmt::Write as _;

use medbrains_documents::signable::{Related, SignableType};

/// Columns looked for on every table, besides the parent links.
const LOOKED_FOR: &[&str] = &[
    "created_at",
    "signed_at",
    "deleted_at",
    "department_id",
    "from_department_id",
    "encounter_id",
    "admission_id",
    "er_visit_id",
    "signed_record_id",
];

/// Columns each table has, of those the routing looks for.
pub(super) type Columns = HashMap<String, HashSet<String>>;

/// The registry's parent for a type: a related table the record points at
/// (`record_col` on the record, the parent's `id`), not a child.
fn parent(spec: &SignableType) -> Option<&'static Related> {
    spec.related
        .iter()
        .find(|r| r.record_col != "id" && r.key == "id")
}

/// The tables whose columns the statements need: each type's own, its
/// parent's, and the ER visit every ER record hangs from.
pub(super) fn tables_to_read(types: &[SignableType]) -> Vec<String> {
    let mut tables: Vec<String> = types.iter().map(|t| t.table.to_owned()).collect();
    tables.extend(types.iter().filter_map(parent).map(|r| r.table.to_owned()));
    tables.push("er_visits".to_owned());
    tables
}

/// The columns to look for: [`LOOKED_FOR`] and every parent link.
pub(super) fn columns_to_read(types: &[SignableType]) -> Vec<String> {
    let mut cols: Vec<String> = LOOKED_FOR.iter().map(|c| (*c).to_owned()).collect();
    cols.extend(
        types
            .iter()
            .filter_map(parent)
            .map(|r| r.record_col.to_owned()),
    );
    cols
}

/// Whether `name` is a plain lower-case identifier, safe to put in SQL.
pub(super) fn is_identifier(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 63
        && name.starts_with(|c: char| c.is_ascii_lowercase() || c == '_')
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

/// Why a registered type cannot be counted on this database.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Unfit {
    /// Its table is not there.
    Missing,
    /// Its table has no time to date a record by.
    NoTime,
    /// Its table has no `signed_record_id`, so a signature cannot be read.
    NoSignatureLink,
    /// Its table's name is not a plain identifier.
    BadName,
}

impl Unfit {
    /// The reason in words, for the screen and the log.
    pub(super) const fn reason(self) -> &'static str {
        match self {
            Self::Missing => "its table is missing",
            Self::NoTime => "its table has no creation time",
            Self::NoSignatureLink => "its table has no signature link",
            Self::BadName => "its table name is not plain",
        }
    }
}

/// The statement counting one signable type, binding `$5` its record type,
/// or why it cannot be counted (it is reported as not counted).
pub(super) fn signable_statement(spec: &SignableType, columns: &Columns) -> Result<String, Unfit> {
    let own = columns.get(spec.table).ok_or(Unfit::Missing)?;
    let at = ["created_at", "signed_at"]
        .into_iter()
        .find(|c| own.contains(*c))
        .ok_or(Unfit::NoTime)?;
    if !own.contains("signed_record_id") {
        return Err(Unfit::NoSignatureLink);
    }
    if !is_identifier(spec.table) {
        return Err(Unfit::BadName);
    }
    let (joins, department) = department_of(spec, columns);
    let live = if own.contains("deleted_at") {
        " AND r.deleted_at IS NULL"
    } else {
        ""
    };
    Ok(format!(
        "SELECT $1, timezone($4, r.{at})::date, {department}, $5, \
                COUNT(*)::int, COUNT(*) FILTER (WHERE s.id IS NOT NULL)::int, 0, 0 \
           FROM {table} r {joins} \
           LEFT JOIN signed_records s ON s.tenant_id = r.tenant_id \
                 AND s.id = r.signed_record_id AND s.deleted_at IS NULL \
                 AND s.signer_role = 'primary' \
          WHERE r.tenant_id = $1 \
            AND r.{at} >= ($2::date::timestamp AT TIME ZONE $4) \
            AND r.{at} < (($3::date + 1)::timestamp AT TIME ZONE $4){live} \
          GROUP BY 2, 3",
        table = spec.table,
    ))
}

/// Where a record's department may be found, gathered while joining.
#[derive(Default)]
struct Route {
    joins: String,
    departments: Vec<String>,
    encounters: Vec<String>,
    admissions: Vec<String>,
}

impl Route {
    /// Take what the table aliased `alias` offers.
    fn offer(&mut self, alias: &str, cols: &HashSet<String>) {
        let has = |col: &str| cols.contains(col).then(|| format!("{alias}.{col}"));
        self.departments.extend(has("department_id"));
        self.departments.extend(has("from_department_id"));
        self.encounters.extend(has("encounter_id"));
        self.admissions.extend(has("admission_id"));
    }

    /// `LEFT JOIN table alias` on `alias.id` = the first of `ids`, and the
    /// department it adds, when any id can reach it.
    fn join(&mut self, table: &str, alias: &str, ids: &[String]) {
        if !ids.is_empty() {
            let _ = write!(
                self.joins,
                " LEFT JOIN {table} {alias} ON {alias}.tenant_id = r.tenant_id \
                  AND {alias}.id = COALESCE({}, NULL::uuid)",
                ids.join(", ")
            );
            self.departments.push(format!("{alias}.department_id"));
        }
    }
}

/// The joins and the `COALESCE` that find a record's department.
fn department_of(spec: &SignableType, columns: &Columns) -> (String, String) {
    let mut route = Route::default();
    let empty = HashSet::new();
    let own = columns.get(spec.table).unwrap_or(&empty);
    route.offer("r", own);
    let linked = parent(spec).filter(|p| {
        own.contains(p.record_col) && is_identifier(p.table) && is_identifier(p.record_col)
    });
    if let Some((p, cols)) = linked.and_then(|p| columns.get(p.table).map(|c| (p, c))) {
        let _ = write!(
            route.joins,
            " LEFT JOIN {} o ON o.tenant_id = r.tenant_id AND o.id = r.{}",
            p.table, p.record_col
        );
        route.offer("o", cols);
    }
    if own.contains("er_visit_id") {
        route.joins.push_str(
            " LEFT JOIN er_visits v ON v.tenant_id = r.tenant_id AND v.id = r.er_visit_id",
        );
        route.offer("v", columns.get("er_visits").unwrap_or(&empty));
    }
    let (encounters, admissions) = (route.encounters.clone(), route.admissions.clone());
    route.join("encounters", "e", &encounters);
    route.join("admissions", "a", &admissions);
    route.departments.push("NULL::uuid".to_owned());
    (
        route.joins,
        format!("COALESCE({})", route.departments.join(", ")),
    )
}

#[cfg(test)]
mod tests {
    use super::{Columns, Unfit, is_identifier, signable_statement};
    use medbrains_documents::signable::{SIGNABLE, SignableType};

    fn cols(entries: &[(&str, &[&str])]) -> Columns {
        entries
            .iter()
            .map(|(t, c)| ((*t).to_owned(), c.iter().map(|s| (*s).to_owned()).collect()))
            .collect()
    }

    fn spec(record_type: &str) -> &'static SignableType {
        SIGNABLE
            .iter()
            .find(|t| t.record_type == record_type)
            .unwrap_or(&SIGNABLE[0])
    }

    #[test]
    fn a_lab_report_takes_its_orders_department_then_its_visits() {
        let c = cols(&[
            (
                "lab_results",
                &["created_at", "deleted_at", "order_id", "signed_record_id"],
            ),
            ("lab_orders", &["department_id", "encounter_id"]),
        ]);
        let sql = signable_statement(spec("lab_report"), &c).unwrap_or_default();
        assert!(sql.contains("s.id = r.signed_record_id"), "{sql}");
        assert!(sql.contains("s.signer_role = 'primary'"), "{sql}");
        assert!(
            sql.contains(
                "LEFT JOIN lab_orders o ON o.tenant_id = r.tenant_id AND o.id = r.order_id"
            ),
            "{sql}"
        );
        assert!(
            sql.contains("COALESCE(o.department_id, e.department_id, NULL::uuid)"),
            "{sql}"
        );
        assert!(sql.contains("r.deleted_at IS NULL"));
    }

    #[test]
    fn an_ot_checklist_reaches_its_bookings_admission() {
        let c = cols(&[
            (
                "ot_surgical_safety_checklists",
                &["created_at", "deleted_at", "booking_id", "signed_record_id"],
            ),
            ("ot_bookings", &["admission_id"]),
        ]);
        let sql = signable_statement(spec("ot_safety_checklist"), &c).unwrap_or_default();
        assert!(
            sql.contains(
                "LEFT JOIN ot_bookings o ON o.tenant_id = r.tenant_id AND o.id = r.booking_id"
            ),
            "{sql}"
        );
        assert!(
            sql.contains("a.id = COALESCE(o.admission_id, NULL::uuid)"),
            "{sql}"
        );
        assert!(
            sql.contains("COALESCE(a.department_id, NULL::uuid)"),
            "{sql}"
        );
    }

    #[test]
    fn the_order_basket_is_dated_by_its_signing_and_er_records_by_their_visit() {
        let basket = cols(&[(
            "order_basket_signatures",
            &["signed_at", "encounter_id", "signed_record_id"],
        )]);
        let sql = signable_statement(spec("order_basket"), &basket).unwrap_or_default();
        assert!(sql.contains("timezone($4, r.signed_at)"), "{sql}");
        let er = cols(&[
            (
                "er_triage_assessments",
                &["created_at", "er_visit_id", "signed_record_id"],
            ),
            ("er_visits", &["encounter_id", "admission_id"]),
        ]);
        let sql = signable_statement(spec("er_triage"), &er).unwrap_or_default();
        assert!(
            sql.contains("COALESCE(e.department_id, a.department_id, NULL::uuid)"),
            "{sql}"
        );
        assert!(
            sql.contains("e.id = COALESCE(v.encounter_id, NULL::uuid)"),
            "{sql}"
        );
    }

    #[test]
    fn a_table_without_a_time_a_signature_link_or_at_all_is_not_counted() {
        let lab = spec("lab_report");
        let no_time = cols(&[("lab_results", &["order_id", "signed_record_id"])]);
        assert_eq!(signable_statement(lab, &no_time), Err(Unfit::NoTime));
        let no_link = cols(&[("lab_results", &["created_at"])]);
        assert_eq!(
            signable_statement(lab, &no_link),
            Err(Unfit::NoSignatureLink)
        );
        assert_eq!(signable_statement(lab, &cols(&[])), Err(Unfit::Missing));
    }

    #[test]
    fn only_plain_identifiers_reach_sql() {
        assert!(is_identifier("ipd_discharge_summaries"));
        assert!(!is_identifier("x; DROP TABLE y"));
        assert!(!is_identifier("Upper"));
        assert!(!is_identifier(""));
    }

    #[test]
    fn every_registered_type_is_a_plain_identifier() {
        assert!(
            SIGNABLE.len() >= 21,
            "the registry holds {} types",
            SIGNABLE.len()
        );
        for t in SIGNABLE {
            assert!(is_identifier(t.table), "{}", t.table);
        }
    }
}

//! The statements that count one window of days into `paperless_daily`.
//!
//! Every statement binds `$1` tenant, `$2..=$3` the local days, `$4` the
//! hospital's time zone, and writes `(tenant_id, day, department_id,
//! doc_type, created, signed, scanned, printed)` rows.
//!
//! Signable types come from `medbrains_documents::signable::SIGNABLE`, so a
//! type added there is counted with no change here. Its department is found
//! from the columns its table has (read from the catalogue at run time): its
//! own `department_id`, else its order's, else its encounter's, else its
//! admission's. A table with none counts under "no department".

use std::collections::{HashMap, HashSet};

use medbrains_documents::signable::SignableType;

/// Columns the department search and the window look for.
pub(super) const LOOKED_FOR: &[&str] = &[
    "created_at",
    "deleted_at",
    "department_id",
    "encounter_id",
    "admission_id",
    "order_id",
];

/// Result tables whose order (on `order_id`) names the department or visit.
/// ponytail: two entries; a registry type with an order parent and no
/// department column of its own adds one here.
const ORDER_PARENTS: &[(&str, &str)] = &[
    ("lab_results", "lab_orders"),
    ("radiology_reports", "radiology_orders"),
];

/// The window on a timestamp column, in the hospital's days.
macro_rules! window {
    ($col:literal) => {
        concat!(
            $col,
            " >= ($2::date::timestamp AT TIME ZONE $4) AND ",
            $col,
            " < (($3::date + 1)::timestamp AT TIME ZONE $4)"
        )
    };
}

/// The [`LOOKED_FOR`] columns each table has, from the catalogue.
pub(super) type Columns = HashMap<String, HashSet<String>>;

/// The tables whose columns the signable statements need: each type's own
/// and its order parent's.
pub(super) fn tables_to_read(types: &[SignableType]) -> Vec<String> {
    let mut tables: Vec<String> = types.iter().map(|t| t.table.to_owned()).collect();
    tables.extend(ORDER_PARENTS.iter().map(|(_, p)| (*p).to_owned()));
    tables
}

/// Whether `name` is a plain lower-case identifier, safe to put in SQL.
fn is_identifier(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 63
        && name.starts_with(|c: char| c.is_ascii_lowercase() || c == '_')
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
}

/// The statement counting one signable type, binding `$5` its record type,
/// or `None` when its table is not there or has no `created_at` (it is
/// reported as not counted).
pub(super) fn signable_statement(spec: &SignableType, columns: &Columns) -> Option<String> {
    let own = columns.get(spec.table)?;
    if !is_identifier(spec.table) || !own.contains("created_at") {
        return None;
    }
    let parent = ORDER_PARENTS
        .iter()
        .find(|(t, _)| *t == spec.table && own.contains("order_id"))
        .and_then(|(_, p)| columns.get(*p).map(|cols| (*p, cols)));
    let (joins, department) = department_of(own, parent);
    let live = if own.contains("deleted_at") {
        " AND r.deleted_at IS NULL"
    } else {
        ""
    };
    Some(format!(
        "SELECT $1, timezone($4, r.created_at)::date, {department}, $5, \
                COUNT(*)::int, \
                COUNT(*) FILTER (WHERE EXISTS ( \
                  SELECT 1 FROM signed_records s \
                   WHERE s.tenant_id = r.tenant_id AND s.record_type = $5 \
                     AND s.record_id = r.id AND s.deleted_at IS NULL))::int, 0, 0 \
           FROM {table} r {joins} \
          WHERE r.tenant_id = $1 AND {window}{live} \
          GROUP BY 2, 3",
        table = spec.table,
        window = window!("r.created_at"),
    ))
}

/// The joins and the `COALESCE` that find a record's department, from the
/// columns of its table (`r`) and of its order parent (`o`), if any.
fn department_of(
    own: &HashSet<String>,
    parent: Option<(&str, &HashSet<String>)>,
) -> (String, String) {
    let mut joins = String::new();
    let mut terms: Vec<&str> = Vec::new();
    let mut visit: Vec<&str> = Vec::new();
    if own.contains("department_id") {
        terms.push("r.department_id");
    }
    if let Some((table, cols)) = parent.filter(|(t, _)| is_identifier(t)) {
        joins.push_str(&format!(
            " LEFT JOIN {table} o ON o.tenant_id = r.tenant_id AND o.id = r.order_id"
        ));
        if cols.contains("department_id") {
            terms.push("o.department_id");
        }
        if cols.contains("encounter_id") {
            visit.push("o.encounter_id");
        }
    }
    if own.contains("encounter_id") {
        visit.insert(0, "r.encounter_id");
    }
    if !visit.is_empty() {
        joins.push_str(&format!(
            " LEFT JOIN encounters e ON e.tenant_id = r.tenant_id AND e.id = COALESCE({}, NULL::uuid)",
            visit.join(", ")
        ));
        terms.push("e.department_id");
    }
    if own.contains("admission_id") {
        joins.push_str(
            " LEFT JOIN admissions a ON a.tenant_id = r.tenant_id AND a.id = r.admission_id",
        );
        terms.push("a.department_id");
    }
    terms.push("NULL::uuid");
    (joins, format!("COALESCE({})", terms.join(", ")))
}

/// Clinical notes (OPD consultation, progress, nursing, ...), signed through
/// their own ledger: a note is signed once its status says so. A note entered
/// in error is not a document.
pub(super) const CLINICAL_NOTES: &str = concat!(
    "SELECT $1, timezone($4, n.created_at)::date, \
            COALESCE(n.service_department_id, e.department_id), 'clinical_note', \
            COUNT(*)::int, COUNT(*) FILTER (WHERE n.status = 'signed')::int, 0, 0 \
       FROM clinical_notes n \
       LEFT JOIN encounters e ON e.tenant_id = n.tenant_id AND e.id = n.encounter_id \
      WHERE n.tenant_id = $1 AND n.deleted_at IS NULL AND n.status <> 'entered_in_error' AND ",
    window!("n.created_at"),
    " GROUP BY 2, 3"
);

/// Paper case sheets scanned in (`medbrains-case-sheet-scan`), whatever
/// became of the parse: the sheet was paper either way.
pub(super) const CASE_SHEET_SCANS: &str = concat!(
    "SELECT $1, timezone($4, c.created_at)::date, e.department_id, 'case_sheet_scan', \
            0, 0, COUNT(*)::int, 0 \
       FROM case_sheet_scans c \
       LEFT JOIN encounters e ON e.tenant_id = c.tenant_id AND e.id = c.encounter_id \
      WHERE c.tenant_id = $1 AND ",
    window!("c.created_at"),
    " GROUP BY 2, 3"
);

/// System documents printed for the first time: a document made from a
/// record (`source_id`), so a digital copy exists. Only the first print has a
/// date (`first_printed_at`); later prints are a bare counter.
pub(super) const FIRST_PRINTS: &str = concat!(
    "SELECT $1, timezone($4, d.first_printed_at)::date, \
            COALESCE(e.department_id, a.department_id), 'printed_document', \
            0, 0, 0, COUNT(*)::int \
       FROM document_outputs d \
       LEFT JOIN encounters e ON e.tenant_id = d.tenant_id AND e.id = d.visit_id \
       LEFT JOIN admissions a ON a.tenant_id = d.tenant_id AND a.id = d.admission_id \
      WHERE d.tenant_id = $1 AND d.deleted_at IS NULL AND d.source_id IS NOT NULL \
        AND d.first_printed_at IS NOT NULL AND ",
    window!("d.first_printed_at"),
    " GROUP BY 2, 3"
);

#[cfg(test)]
mod tests {
    use super::{Columns, SignableType, is_identifier, signable_statement};

    fn cols(entries: &[(&str, &[&str])]) -> Columns {
        entries
            .iter()
            .map(|(t, c)| ((*t).to_owned(), c.iter().map(|s| (*s).to_owned()).collect()))
            .collect()
    }

    const LAB: SignableType = SignableType {
        record_type: "lab_report",
        label: "Lab report",
        table: "lab_results",
    };

    #[test]
    fn a_lab_report_takes_its_orders_department_then_its_visits() {
        let c = cols(&[
            ("lab_results", &["created_at", "deleted_at", "order_id"]),
            ("lab_orders", &["department_id", "encounter_id"]),
        ]);
        let sql = signable_statement(&LAB, &c).unwrap_or_default();
        assert!(sql.contains("LEFT JOIN lab_orders o"), "{sql}");
        assert!(
            sql.contains("COALESCE(o.department_id, e.department_id, NULL::uuid)"),
            "{sql}"
        );
        assert!(sql.contains("r.deleted_at IS NULL"));
    }

    #[test]
    fn a_table_without_created_at_or_missing_is_not_counted() {
        assert!(signable_statement(&LAB, &cols(&[("lab_results", &["order_id"])])).is_none());
        assert!(signable_statement(&LAB, &cols(&[])).is_none());
    }

    #[test]
    fn only_plain_identifiers_reach_sql() {
        assert!(is_identifier("ipd_discharge_summaries"));
        assert!(!is_identifier("x; DROP TABLE y"));
        assert!(!is_identifier("Upper"));
        assert!(!is_identifier(""));
    }
}

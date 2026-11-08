//! The fixed statements that count one window of days into
//! `paperless_daily`: clinical notes, scanned case sheets and first prints.
//! Signable types are counted by `route`.
//!
//! Every statement binds `$1` tenant, `$2..=$3` the local days, `$4` the
//! hospital's time zone, and writes `(tenant_id, day, department_id,
//! doc_type, created, signed, scanned, printed)` rows.

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

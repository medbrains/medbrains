use super::*;

fn doc(kind: DocKind, title: &str, size_bytes: usize) -> Loaded {
    Loaded {
        doc: ClaimDocument {
            kind,
            source: DocSource::Rendered,
            id: Uuid::new_v4(),
            title: title.to_owned(),
            mime_type: "application/pdf".to_owned(),
            size_bytes,
            created_at: Utc::now(),
            preview_url: None,
        },
        bytes: Vec::new(),
    }
}

fn scope(admission: bool) -> ClaimScope {
    ClaimScope {
        tenant_id: Uuid::new_v4(),
        patient_id: Uuid::new_v4(),
        invoice_id: Uuid::new_v4(),
        admission_id: admission.then(Uuid::new_v4),
        summary_final_at: None,
    }
}

#[test]
fn a_file_over_the_per_file_cap_is_left_out_with_its_reason() {
    let (kept, left) = apply_caps(
        vec![
            doc(DocKind::LabReport, "Lab", MAX_FILE_BYTES + 1),
            doc(DocKind::DischargeSummary, "Summary", 1_000),
        ],
        MAX_TOTAL_BYTES,
    );
    assert_eq!(kept.len(), 1);
    assert_eq!(kept[0].doc.kind, DocKind::DischargeSummary);
    assert_eq!(left.len(), 1);
    assert_eq!(left[0].title, "Lab");
    assert!(
        left[0].reason.contains("limit for one file"),
        "{}",
        left[0].reason
    );
}

#[test]
fn the_total_cap_drops_the_least_needed_document_first() {
    let half = MAX_TOTAL_BYTES / 2;
    let (kept, left) = apply_caps(
        vec![
            doc(DocKind::PatientDocument, "Scan", half),
            doc(DocKind::LabReport, "Lab", half),
            doc(DocKind::DischargeSummary, "Summary", 10),
        ],
        MAX_TOTAL_BYTES,
    );
    let kinds: Vec<DocKind> = kept.iter().map(|d| d.doc.kind).collect();
    assert_eq!(kinds, [DocKind::DischargeSummary, DocKind::LabReport]);
    assert_eq!(left[0].title, "Scan");
    assert!(left[0].reason.contains("in all"), "{}", left[0].reason);
}

#[test]
fn a_stays_claim_is_refused_without_its_discharge_summary() {
    let (kept, left) = apply_caps(
        vec![doc(
            DocKind::DischargeSummary,
            "Summary",
            MAX_FILE_BYTES + 1,
        )],
        MAX_TOTAL_BYTES,
    );
    let err = require_discharge_summary(&kept, &left, &scope(true))
        .err()
        .map(|e| e.to_string())
        .unwrap_or_default();
    assert!(err.contains("limit for one file"), "refused: {err}");
    assert!(
        require_discharge_summary(&[], &[], &scope(false)).is_ok(),
        "OPD has no stay"
    );
}

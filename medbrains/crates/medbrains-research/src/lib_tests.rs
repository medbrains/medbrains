use super::{ExportRow, NewExport, invalid, may_download};
use chrono::{Duration, NaiveDate, Utc};
use uuid::Uuid;

fn row(status: &str, hours_left: i64) -> ExportRow {
    let now = Utc::now();
    ExportRow {
        id: Uuid::nil(),
        dataset: "visits".into(),
        period_from: NaiveDate::default(),
        period_to: NaiveDate::default(),
        purpose: String::new(),
        iec_reference: String::new(),
        status: status.into(),
        requested_by: Uuid::from_u128(1),
        requested_by_name: None,
        requested_via: "screen".into(),
        decided_by: Some(Uuid::from_u128(2)),
        decided_by_name: None,
        decided_at: None,
        decision_note: None,
        row_count: None,
        suppressed_rows: None,
        suppression_report: None,
        data_sha256: None,
        ready_at: None,
        expires_at: Some(now + Duration::hours(hours_left)),
        created_at: now,
    }
}

#[test]
fn only_a_ready_unexpired_export_reaches_its_requester_or_approver() {
    let now = Utc::now();
    assert!(may_download(&row("ready", 3), Uuid::from_u128(1), now).is_ok());
    assert!(may_download(&row("ready", 3), Uuid::from_u128(2), now).is_ok());
    assert!(may_download(&row("ready", 3), Uuid::from_u128(3), now).is_err());
    assert!(may_download(&row("ready", -1), Uuid::from_u128(1), now).is_err());
    assert!(may_download(&row("requested", 3), Uuid::from_u128(1), now).is_err());
    assert!(may_download(&row("rejected", 3), Uuid::from_u128(1), now).is_err());
}

#[test]
fn a_request_names_its_study_and_approval() {
    let d = |s: &str| NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap_or_default();
    let ok = NewExport {
        dataset: "diagnoses".into(),
        period_from: d("2025-04-01"),
        period_to: d("2026-03-31"),
        purpose: "Prevalence of type 2 diabetes in OPD attendees".into(),
        iec_reference: "IEC/2026/041".into(),
    };
    assert_eq!(invalid(&ok), None);
    assert!(
        invalid(&NewExport {
            dataset: "patients".into(),
            ..clone(&ok)
        })
        .is_some()
    );
    assert!(
        invalid(&NewExport {
            purpose: "study".into(),
            ..clone(&ok)
        })
        .is_some()
    );
    assert!(
        invalid(&NewExport {
            iec_reference: " ".into(),
            ..clone(&ok)
        })
        .is_some()
    );
    assert!(
        invalid(&NewExport {
            period_from: d("2026-04-01"),
            ..clone(&ok)
        })
        .is_some()
    );
}

fn clone(n: &NewExport) -> NewExport {
    NewExport {
        dataset: n.dataset.clone(),
        period_from: n.period_from,
        period_to: n.period_to,
        purpose: n.purpose.clone(),
        iec_reference: n.iec_reference.clone(),
    }
}

//! Unit tests for the bill reader contract.
use super::*;

fn f(value: serde_json::Value, confidence: f64) -> Field {
    Field {
        value,
        confidence,
        ..Field::default()
    }
}

#[test]
fn bill_dates_in_every_printed_form() {
    let sep27 = NaiveDate::from_ymd_opt(2027, 9, 30);
    for raw in [
        "09/27",
        "09/2027",
        "SEP-27",
        "Sep 2027",
        "2027-09-30",
        "30/09/2027",
    ] {
        assert_eq!(parse_bill_date(raw), sep27, "{raw}");
    }
    assert_eq!(
        parse_bill_date("02/28"),
        NaiveDate::from_ymd_opt(2028, 2, 29)
    );
    assert_eq!(parse_bill_date("13/27"), None);
    assert_eq!(parse_bill_date("soon"), None);
}

#[test]
fn a_scheme_quantity_splits_into_free_goods_and_is_flagged() {
    let parsed = ParseResult {
        lines: vec![ParsedLine {
            quantity: f(serde_json::json!("10+1"), 0.99),
            batch_number: f(serde_json::json!("B12"), 0.9),
            expiry_date: f(serde_json::json!("not a date"), 0.95),
            ..ParsedLine::default()
        }],
        ..ParseResult::default()
    };
    let d = to_draft(&parsed);
    assert_eq!(
        (d.lines[0].quantity, d.lines[0].free_quantity),
        (Some(10), Some(1))
    );
    assert_eq!(d.confidence.get("lines[0].quantity"), Some(&0.0));
    assert_eq!(d.confidence.get("lines[0].batch_number"), Some(&0.9));
    assert_eq!(d.confidence.get("lines[0].expiry_date"), Some(&0.0));
    assert_eq!(d.lines[0].expiry_date, None);
}

#[test]
fn the_qr_cross_checks_the_header() {
    let mut d = Draft::default();
    d.header.invoice_number = Some("INV/0045".into());
    d.header.invoice_amount = Some(Decimal::from(1050));
    let qr = EinvoiceQr {
        doc_no: Some("INV-0045".into()),
        tot_inv_val: Some(Decimal::from(1150)),
        item_cnt: Some(0),
        ..EinvoiceQr::default()
    };
    let found = qr_mismatches(&d, &qr);
    assert_eq!(found.len(), 1, "{found:?}");
    assert!(found[0].starts_with("Invoice total"));
}

#[test]
fn a_line_read_twice_is_flagged_not_dropped() {
    let line = DraftLine {
        product_name: Some("Dolo 650".into()),
        batch_number: Some("b1".into()),
        quantity: Some(10),
        ..DraftLine::default()
    };
    let other = DraftLine {
        batch_number: Some("B2".into()),
        ..line.clone()
    };
    let lines = vec![
        line.clone(),
        DraftLine {
            batch_number: Some("B1".into()),
            ..line
        },
        other,
    ];
    assert_eq!(repeated_lines(&lines), vec![(1, 0)]);
}

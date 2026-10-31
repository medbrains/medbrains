//! Excel workbooks, round-tripped through a real `.xlsx` file.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

use r8r_formats::{Format, parse, serialize};
use serde_json::{Value, json};

/// Build a workbook and read it straight back, which is the only way to test
/// this without checking a binary fixture into the repository.
fn round_trip(value: &Value) -> Value {
    let encoded = serialize(value, Format::Xlsx).unwrap_or_else(|e| panic!("should write: {e}"));
    parse(&encoded, Format::Xlsx).unwrap_or_else(|e| panic!("should read: {e}"))
}

#[test]
fn rows_survive_a_round_trip_through_a_real_workbook() {
    let rows = json!([
        { "id": 1, "name": "Ada", "active": true },
        { "id": 2, "name": "Grace", "active": false }
    ]);

    let back = round_trip(&rows);

    assert_eq!(back["Sheet1"].as_array().unwrap().len(), 2);
    assert_eq!(back["Sheet1"][0]["name"], json!("Ada"));
    assert_eq!(back["Sheet1"][1]["id"], json!(2.0));
    assert_eq!(back["Sheet1"][0]["active"], json!(true));
}

#[test]
fn the_first_row_becomes_the_column_names() {
    let back = round_trip(&json!([{ "sku": "A1", "qty": 3 }]));
    let row = &back["Sheet1"][0];

    assert!(row.get("sku").is_some());
    assert!(row.get("qty").is_some());
}

#[test]
fn a_row_missing_a_field_leaves_a_gap_rather_than_shifting_the_columns() {
    let rows = json!([{ "a": 1, "b": 2 }, { "a": 3 }]);
    let back = round_trip(&rows);

    assert_eq!(back["Sheet1"][1]["a"], json!(3.0));
    assert_eq!(back["Sheet1"][1]["b"], Value::Null, "the gap stays a gap");
}

#[test]
fn several_sheets_can_be_written_and_read_back_by_name() {
    let workbook = json!({
        "Customers": [{ "name": "Ada" }],
        "Orders": [{ "reference": "ORD-1" }, { "reference": "ORD-2" }]
    });

    let back = round_trip(&workbook);

    assert_eq!(back["Customers"].as_array().unwrap().len(), 1);
    assert_eq!(back["Orders"].as_array().unwrap().len(), 2);
    assert_eq!(back["Orders"][1]["reference"], json!("ORD-2"));
}

#[test]
fn a_sheet_name_excel_would_reject_is_corrected_rather_than_failing() {
    // Excel forbids these characters and caps names at 31 characters.
    let workbook = json!({ "Q1/Q2 [draft]": [{ "a": 1 }] });
    let back = round_trip(&workbook);

    let name = back
        .as_object()
        .unwrap()
        .keys()
        .next()
        .expect("a sheet")
        .clone();
    assert!(!name.contains('/'));
    assert!(!name.contains('['));
    assert!(name.len() <= 31);
}

#[test]
fn nested_values_are_kept_as_json_rather_than_dropped() {
    let back = round_trip(&json!([{ "meta": { "source": "api" } }]));
    assert_eq!(back["Sheet1"][0]["meta"], json!("{\"source\":\"api\"}"));
}

#[test]
fn text_that_looks_numeric_stays_text() {
    let back = round_trip(&json!([{ "account": "0071" }]));
    assert_eq!(
        back["Sheet1"][0]["account"],
        json!("0071"),
        "a leading zero must survive"
    );
}

#[test]
fn a_sheet_with_no_columns_is_refused_with_a_clear_reason() {
    let error = serialize(&json!([1, 2, 3]), Format::Xlsx).expect_err("should fail");
    assert!(error.to_string().contains("columns"));
}

#[test]
fn something_that_is_not_base64_is_reported_as_such() {
    let error = parse("this is not a workbook", Format::Xlsx).expect_err("should fail");
    assert!(error.to_string().contains("base64"));
}

#[test]
fn base64_that_is_not_a_workbook_is_reported_too() {
    // Valid base64, meaningless bytes.
    let error = parse("aGVsbG8gd29ybGQ=", Format::Xlsx).expect_err("should fail");
    assert!(error.to_string().contains("XLSX"));
}

#[test]
fn the_format_is_recognised_by_name_and_by_content_type() {
    for name in ["xlsx", "excel", "xls", "ods", "spreadsheet"] {
        assert_eq!(Format::parse_name(name), Format::Xlsx, "{name}");
    }
    assert_eq!(
        r8r_formats::detect(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "",
        ),
        Format::Xlsx
    );
}

#[test]
fn a_workbook_written_from_one_object_still_produces_a_sheet() {
    let back = round_trip(&json!({ "id": 1, "name": "Ada" }));
    assert_eq!(back["Sheet1"][0]["name"], json!("Ada"));
}

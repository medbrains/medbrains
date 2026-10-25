use serde_json::json;

use super::{MODEL_ROWS, Widget, WidgetError, build, compact_for_model};

#[test]
fn kpi_tiles_copy_the_record_values_exactly() {
    let report = json!({"data": {"date": "2026-10-25", "invoices_created": 23, "total_billed": "6647.28", "tenant_id": "t"}});
    let Ok(Widget::Kpis { tiles, .. }) = build("kpis", "Today", &report) else {
        unreachable!("a report with numbers makes tiles");
    };
    let mut got: Vec<(String, serde_json::Value)> =
        tiles.into_iter().map(|t| (t.label, t.value)).collect();
    got.sort_by(|a, b| a.0.cmp(&b.0));
    assert_eq!(
        got,
        vec![
            ("Invoices created".to_owned(), json!(23)),
            ("Total billed".to_owned(), json!("6647.28")),
        ]
    );
}

#[test]
fn a_table_keeps_every_row_and_drops_ids_but_keeps_the_patient_link() {
    let rows: Vec<serde_json::Value> = (0..250)
        .map(|i| json!({"id": i, "patient_id": format!("p{i}"), "name": format!("N{i}"), "amount": i}))
        .collect();
    let Ok(Widget::Table {
        columns,
        rows,
        total_rows,
        ..
    }) = build("table", "Bills", &json!(rows))
    else {
        unreachable!("rows make a table");
    };
    assert_eq!(total_rows, 250);
    assert_eq!(rows.len(), 200);
    let mut keys: Vec<&str> = columns.iter().map(|c| c.key.as_str()).collect();
    keys.sort_unstable();
    assert_eq!(keys, vec!["amount", "name"]);
    assert_eq!(rows[7]["amount"], json!(7));
    assert_eq!(rows[7]["patient_id"], json!("p7"));
}

#[test]
fn a_chart_needs_a_label_and_a_number() {
    let trend = json!([{"day": "Mon", "visits": 40}, {"day": "Tue", "visits": 52}]);
    let Ok(Widget::Chart {
        x, series, rows, ..
    }) = build("chart", "Visits", &trend)
    else {
        unreachable!("label + number make a chart");
    };
    assert_eq!((x.key.as_str(), series[0].key.as_str()), ("day", "visits"));
    assert_eq!(rows[1]["visits"], json!(52));
    assert_eq!(
        build("chart", "x", &json!([{"day": "Mon"}])),
        Err(WidgetError::Shape("numeric series"))
    );
}

#[test]
fn a_status_map_becomes_a_list_with_statuses() {
    let clearances = json!({"billing": "cleared", "pharmacy_return": "pending"});
    let Ok(Widget::List { items, .. }) = build("list", "Clearances", &clearances) else {
        unreachable!("a status map makes a list");
    };
    assert_eq!(items[1].label, "Pharmacy return");
    assert_eq!(items[1].status.as_deref(), Some("pending"));
}

#[test]
fn a_kind_outside_the_catalogue_or_a_wrong_shape_is_refused() {
    assert!(matches!(
        build("html", "x", &json!({})),
        Err(WidgetError::UnknownKind(_))
    ));
    assert_eq!(
        build("kpis", "x", &json!({"note": "none"})),
        Err(WidgetError::Shape("headline numbers"))
    );
    assert_eq!(
        build("table", "x", &json!({"note": "none"})),
        Err(WidgetError::Shape("rows"))
    );
}

#[test]
fn the_model_gets_the_ends_and_an_exact_summary_of_a_long_result() {
    let long: Vec<serde_json::Value> = (0..45)
        .map(|i| json!({"date": format!("d{i}"), "billed": if i == 44 { "998118.20".to_owned() } else { "0.10".to_owned() }}))
        .collect();
    let compact = compact_for_model(&json!({"data": long}));
    let c = &compact["data"];
    assert_eq!(c["rows_total"], json!(45));
    assert_eq!(c["rows_between_not_sent"], json!(15));
    assert_eq!(c["last_rows"][14]["billed"], json!("998118.20"));
    assert_eq!(
        c["summary_of_all_rows"]["billed"]["max"],
        json!("998118.20")
    );
    assert_eq!(
        c["summary_of_all_rows"]["billed"]["sum"],
        json!("998122.60")
    );
    let month: Vec<serde_json::Value> = (0..MODEL_ROWS).map(|i| json!({"n": i})).collect();
    let short = json!({"data": month});
    assert_eq!(compact_for_model(&short), short);
}

#[test]
fn money_fields_are_marked_and_counts_are_not() {
    let report =
        json!({"invoice_count": 232, "total_billed": "998118.20", "collected": "449954.84"});
    let Ok(Widget::Kpis { tiles, .. }) = build("kpis", "Today", &report) else {
        unreachable!("numbers make tiles");
    };
    let mut money: Vec<(&str, bool)> = tiles.iter().map(|t| (t.label.as_str(), t.money)).collect();
    money.sort_unstable();
    assert_eq!(
        money,
        vec![
            ("Collected", true),
            ("Invoice count", false),
            ("Total billed", true)
        ]
    );
}

#[test]
fn a_chart_names_its_strong_and_weak_days_from_the_data() {
    let days = json!([
        {"date": "2026-10-23", "billed": "5000.00", "invoice_count": 4},
        {"date": "2026-10-24", "billed": "120.50", "invoice_count": 1},
        {"date": "2026-10-25", "billed": "998118.20", "invoice_count": 232}
    ]);
    let Ok(Widget::Chart { peaks, series, .. }) = build("chart", "Revenue", &days) else {
        unreachable!("dates + amounts make a chart");
    };
    assert_eq!(series[0].key, "billed");
    assert!(series[0].money);
    assert_eq!(
        (peaks[0].high_x.clone(), peaks[0].high.clone()),
        (json!("2026-10-25"), json!("998118.20"))
    );
    assert_eq!(
        (peaks[0].low_x.clone(), peaks[0].low.clone()),
        (json!("2026-10-24"), json!("120.50"))
    );
}

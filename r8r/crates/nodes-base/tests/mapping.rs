//! Reshaping data between systems: the mapper, the parser and the converter.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

mod support;

use serde_json::{Value, json};
use support::{expect_failure, expect_success, node, output_on, run_chain};

// =============================================================== map fields

#[tokio::test]
async fn a_flat_source_maps_onto_a_nested_destination() {
    // The everyday case: one API's shape into another's.
    let result = run_chain(
        vec![node(
            "map",
            "mapFields",
            json!({
                "mappings": {
                    "customer.name": "full_name",
                    "customer.address.city": "city",
                    "order.reference": "id"
                }
            }),
        )],
        vec![json!({ "full_name": "Ada Lovelace", "city": "London", "id": "ORD-1" })],
    )
    .await;

    assert_eq!(
        expect_success(&result)[0],
        json!({
            "customer": { "name": "Ada Lovelace", "address": { "city": "London" } },
            "order": { "reference": "ORD-1" }
        })
    );
}

#[tokio::test]
async fn a_nested_source_maps_onto_a_flat_destination() {
    let result = run_chain(
        vec![node(
            "map",
            "mapFields",
            json!({ "mappings": { "city": "customer.address.city", "sku": "lines.0.sku" } }),
        )],
        vec![json!({
            "customer": { "address": { "city": "Berlin" } },
            "lines": [{ "sku": "A1" }, { "sku": "B2" }]
        })],
    )
    .await;

    assert_eq!(
        expect_success(&result)[0],
        json!({ "city": "Berlin", "sku": "A1" })
    );
}

#[tokio::test]
async fn unmapped_source_fields_are_dropped_by_default() {
    // Mapping to a partner's API should not leak internal fields.
    let result = run_chain(
        vec![node(
            "map",
            "mapFields",
            json!({ "mappings": { "name": "full_name" } }),
        )],
        vec![json!({ "full_name": "Ada", "internalNotes": "do not send" })],
    )
    .await;

    let mapped = &expect_success(&result)[0];
    assert_eq!(mapped["name"], json!("Ada"));
    assert!(
        mapped.get("internalNotes").is_none(),
        "unmapped fields must not leak"
    );
}

#[tokio::test]
async fn unmapped_fields_can_be_kept_when_the_mapper_is_used_to_augment() {
    let result = run_chain(
        vec![node(
            "map",
            "mapFields",
            json!({ "mappings": { "name": "full_name" }, "mode": "keep" }),
        )],
        vec![json!({ "full_name": "Ada", "id": 7 })],
    )
    .await;

    let mapped = &expect_success(&result)[0];
    assert_eq!(mapped["name"], json!("Ada"));
    assert_eq!(mapped["id"], json!(7));
}

#[tokio::test]
async fn a_destination_can_combine_several_sources() {
    let result = run_chain(
        vec![node(
            "map",
            "mapFields",
            json!({ "mappings": { "fullName": "{{ item.first + \" \" + item.last }}" } }),
        )],
        vec![json!({ "first": "Ada", "last": "Lovelace" })],
    )
    .await;

    assert_eq!(
        expect_success(&result)[0]["fullName"],
        json!("Ada Lovelace")
    );
}

#[tokio::test]
async fn a_destination_can_be_calculated() {
    let result = run_chain(
        vec![node(
            "map",
            "mapFields",
            json!({
                "mappings": {
                    "total": "{{ item.price * item.qty }}",
                    "totalWithTax": "{{ item.price * item.qty * 1.2 }}"
                }
            }),
        )],
        vec![json!({ "price": 10, "qty": 3 })],
    )
    .await;

    let mapped = &expect_success(&result)[0];
    assert_eq!(mapped["total"], json!(30));
    assert!((mapped["totalWithTax"].as_f64().unwrap() - 36.0).abs() < 0.001);
}

#[tokio::test]
async fn a_destination_can_apply_and_or_logic() {
    let result = run_chain(
        vec![node(
            "map",
            "mapFields",
            json!({
                "mappings": {
                    "priority": "{{ if item.vip && item.overdue { \"high\" } else { \"normal\" } }}",
                    "reachable": "{{ item.email != () || item.phone != () }}"
                }
            }),
        )],
        vec![
            json!({ "vip": true, "overdue": true, "email": "a@b.c" }),
            json!({ "vip": true, "overdue": false }),
        ],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out[0]["priority"], json!("high"));
    assert_eq!(out[0]["reachable"], json!(true));
    assert_eq!(out[1]["priority"], json!("normal"));
    assert_eq!(out[1]["reachable"], json!(false));
}

#[tokio::test]
async fn a_missing_source_becomes_null_so_the_destination_shape_stays_stable() {
    // A partner API expecting a field every time should get it every time.
    let result = run_chain(
        vec![node(
            "map",
            "mapFields",
            json!({ "mappings": { "city": "address.city" } }),
        )],
        vec![json!({ "name": "Ada" })],
    )
    .await;

    assert_eq!(expect_success(&result)[0], json!({ "city": Value::Null }));
}

#[tokio::test]
async fn a_missing_source_can_be_left_out_entirely_instead() {
    let result = run_chain(
        vec![node(
            "map",
            "mapFields",
            json!({ "mappings": { "city": "address.city" }, "skipMissing": true }),
        )],
        vec![json!({ "name": "Ada" })],
    )
    .await;

    assert_eq!(expect_success(&result)[0], json!({}));
}

#[tokio::test]
async fn mapping_runs_once_per_item() {
    let result = run_chain(
        vec![node(
            "map",
            "mapFields",
            json!({ "mappings": { "id": "reference" } }),
        )],
        vec![json!({ "reference": "A" }), json!({ "reference": "B" })],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out.len(), 2);
    assert_eq!(out[1]["id"], json!("B"));
}

// =============================================================== parse data

#[tokio::test]
async fn a_soap_response_becomes_usable_items() {
    let envelope = r#"<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body><GetPriceResponse><Price>34.50</Price></GetPriceResponse></soap:Body>
    </soap:Envelope>"#;

    let result = run_chain(
        vec![node(
            "parse",
            "parseData",
            json!({ "sourceField": "body", "format": "soap" }),
        )],
        vec![json!({ "body": envelope })],
    )
    .await;

    assert_eq!(expect_success(&result)[0]["Price"], json!("34.50"));
}

#[tokio::test]
async fn a_csv_export_becomes_one_item_per_row() {
    let result = run_chain(
        vec![node(
            "parse",
            "parseData",
            json!({ "sourceField": "body", "format": "csv" }),
        )],
        vec![json!({ "body": "id,name\n1,Ada\n2,Grace\n" })],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out.len(), 2);
    assert_eq!(out[1]["name"], json!("Grace"));
}

#[tokio::test]
async fn rows_can_be_kept_together_when_the_workflow_wants_the_whole_table() {
    let result = run_chain(
        vec![node(
            "parse",
            "parseData",
            json!({ "sourceField": "body", "format": "csv", "splitArrays": false }),
        )],
        vec![json!({ "body": "id,name\n1,Ada\n2,Grace\n" })],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out.len(), 1);
    assert_eq!(out[0]["value"].as_array().unwrap().len(), 2);
}

#[tokio::test]
async fn the_format_is_detected_when_it_is_not_stated() {
    for (body, probe, expected) in [
        (json!({ "body": "{\"a\":1}" }), "a", json!(1)),
        (json!({ "body": "<a>1</a>" }), "a", json!("1")),
        (json!({ "body": "a=1" }), "a", json!("1")),
    ] {
        let result = run_chain(
            vec![node(
                "parse",
                "parseData",
                json!({ "sourceField": "body", "format": "auto" }),
            )],
            vec![body.clone()],
        )
        .await;
        assert_eq!(expect_success(&result)[0][probe], expected, "for {body}");
    }
}

#[tokio::test]
async fn the_parsed_value_can_be_placed_beside_the_original() {
    let result = run_chain(
        vec![node(
            "parse",
            "parseData",
            json!({ "sourceField": "body", "format": "yaml", "targetField": "config" }),
        )],
        vec![json!({ "id": 7, "body": "name: r8r\nport: 5678\n" })],
    )
    .await;

    let item = &expect_success(&result)[0];
    assert_eq!(item["id"], json!(7), "the original item survives");
    assert_eq!(item["config"]["port"], json!(5678));
}

#[tokio::test]
async fn text_that_does_not_match_the_stated_format_fails_loudly() {
    let result = run_chain(
        vec![node(
            "parse",
            "parseData",
            json!({ "sourceField": "body", "format": "json" }),
        )],
        vec![json!({ "body": "<not>json</not>" })],
    )
    .await;

    assert!(expect_failure(&result).contains("JSON"));
}

#[tokio::test]
async fn a_missing_source_field_is_named_in_the_error() {
    let result = run_chain(
        vec![node(
            "parse",
            "parseData",
            json!({ "sourceField": "payload.text" }),
        )],
        vec![json!({ "body": "x" })],
    )
    .await;

    assert!(expect_failure(&result).contains("payload.text"));
}

#[tokio::test]
async fn already_structured_data_passes_through_untouched() {
    let result = run_chain(
        vec![node("parse", "parseData", json!({ "sourceField": "body" }))],
        vec![json!({ "body": { "already": "json" } })],
    )
    .await;

    assert_eq!(expect_success(&result)[0], json!({ "already": "json" }));
}

// ============================================================= convert data

#[tokio::test]
async fn items_can_be_written_as_xml_for_a_soap_endpoint() {
    let result = run_chain(
        vec![node(
            "convert",
            "convertData",
            json!({ "format": "xml", "targetField": "payload" }),
        )],
        vec![json!({ "Price": "34.50" })],
    )
    .await;

    let out = &expect_success(&result)[0];
    assert!(
        out["payload"]
            .as_str()
            .unwrap()
            .contains("<Price>34.50</Price>")
    );
    assert_eq!(out["contentType"], json!("application/xml"));
}

#[tokio::test]
async fn every_item_becomes_one_csv_document_when_asked() {
    let result = run_chain(
        vec![node(
            "convert",
            "convertData",
            json!({ "format": "csv", "mode": "allItems", "targetField": "file" }),
        )],
        vec![
            json!({ "id": 1, "name": "Ada" }),
            json!({ "id": 2, "name": "Grace" }),
        ],
    )
    .await;

    let out = expect_success(&result);
    assert_eq!(out.len(), 1, "one document, not one per row");
    let csv = out[0]["file"].as_str().unwrap();
    assert!(csv.starts_with("id,name\n"));
    assert!(csv.contains("2,Grace"));
    assert_eq!(out[0]["itemCount"], json!(2));
}

#[tokio::test]
async fn one_field_can_be_converted_rather_than_the_whole_item() {
    let result = run_chain(
        vec![node(
            "convert",
            "convertData",
            json!({ "format": "yaml", "sourceField": "config", "targetField": "yaml" }),
        )],
        vec![json!({ "id": 7, "config": { "port": 5678 } })],
    )
    .await;

    let yaml = expect_success(&result)[0]["yaml"]
        .as_str()
        .unwrap()
        .to_owned();
    assert!(yaml.contains("port: 5678"));
    assert!(
        !yaml.contains("id:"),
        "only the named field should be converted"
    );
}

#[tokio::test]
async fn parse_and_convert_are_inverses() {
    let result = run_chain(
        vec![
            node(
                "parse",
                "parseData",
                json!({ "sourceField": "body", "format": "xml" }),
            ),
            node(
                "convert",
                "convertData",
                json!({ "format": "json", "targetField": "text" }),
            ),
            node(
                "back",
                "parseData",
                json!({ "sourceField": "text", "format": "json" }),
            ),
        ],
        vec![json!({ "body": "<order><id>7</id></order>" })],
    )
    .await;

    assert_eq!(expect_success(&result)[0]["order"]["id"], json!("7"));
}

#[tokio::test]
async fn a_real_pipeline_parses_maps_and_converts() {
    // A SOAP response reshaped for a JSON API — the whole reason these nodes
    // exist.
    let envelope = r"<Envelope><Body><GetCustomer>
        <FirstName>Ada</FirstName><LastName>Lovelace</LastName><City>London</City>
    </GetCustomer></Body></Envelope>";

    let result = run_chain(
        vec![
            node(
                "parse",
                "parseData",
                json!({ "sourceField": "body", "format": "soap" }),
            ),
            node(
                "map",
                "mapFields",
                json!({
                    "mappings": {
                        "customer.name": "{{ item.FirstName + \" \" + item.LastName }}",
                        "customer.address.city": "City"
                    }
                }),
            ),
            node(
                "convert",
                "convertData",
                json!({ "format": "json", "targetField": "body" }),
            ),
        ],
        vec![json!({ "body": envelope })],
    )
    .await;

    let body = expect_success(&result)[0]["body"]
        .as_str()
        .unwrap()
        .to_owned();
    let parsed: Value = serde_json::from_str(&body).expect("valid JSON");

    assert_eq!(parsed["customer"]["name"], json!("Ada Lovelace"));
    assert_eq!(parsed["customer"]["address"]["city"], json!("London"));
}

#[tokio::test]
async fn the_output_port_carries_every_mapped_item() {
    let result = run_chain(
        vec![node(
            "map",
            "mapFields",
            json!({ "mappings": { "a": "b" } }),
        )],
        vec![json!({ "b": 1 }), json!({ "b": 2 })],
    )
    .await;

    assert_eq!(output_on(&result, "map", "main").len(), 2);
}

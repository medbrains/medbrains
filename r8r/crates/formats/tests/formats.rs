//! The payloads workflows actually receive, and what r8r makes of them.

#![allow(
    clippy::expect_used,
    clippy::unwrap_used,
    clippy::panic,
    clippy::indexing_slicing
)]

use r8r_formats::{Format, parse, serialize, xml};
use serde_json::{Value, json};

fn parsed(text: &str, format: Format) -> Value {
    parse(text, format).unwrap_or_else(|e| panic!("should parse: {e}"))
}

// ====================================================================== xml

#[test]
fn an_element_holding_only_text_becomes_that_text() {
    assert_eq!(
        parsed("<name>Ada</name>", Format::Xml),
        json!({ "name": "Ada" })
    );
}

#[test]
fn nested_elements_become_nested_objects() {
    let document = "<order><id>7</id><customer><name>Ada</name></customer></order>";
    assert_eq!(
        parsed(document, Format::Xml),
        json!({ "order": { "id": "7", "customer": { "name": "Ada" } } })
    );
}

#[test]
fn repeated_children_become_an_array_so_lists_have_one_shape() {
    let document = "<order><line>a</line><line>b</line><line>c</line></order>";
    assert_eq!(
        parsed(document, Format::Xml)["order"]["line"],
        json!(["a", "b", "c"])
    );
}

#[test]
fn attributes_are_prefixed_so_they_never_collide_with_elements() {
    let document = r#"<order id="7" currency="EUR"><id>inner</id></order>"#;
    let value = parsed(document, Format::Xml);

    assert_eq!(value["order"]["@id"], json!("7"));
    assert_eq!(value["order"]["@currency"], json!("EUR"));
    assert_eq!(
        value["order"]["id"],
        json!("inner"),
        "the element is untouched"
    );
}

#[test]
fn text_alongside_attributes_lands_under_a_known_key() {
    let document = r#"<amount currency="EUR">42.50</amount>"#;
    let value = parsed(document, Format::Xml);

    assert_eq!(value["amount"]["@currency"], json!("EUR"));
    assert_eq!(value["amount"]["#text"], json!("42.50"));
}

#[test]
fn a_self_closing_element_is_empty_rather_than_missing() {
    let value = parsed("<order><note/></order>", Format::Xml);
    assert_eq!(value["order"]["note"], json!(""));
}

#[test]
fn cdata_is_taken_literally() {
    let document = "<script><![CDATA[if (a < b && c > d) { }]]></script>";
    assert_eq!(
        parsed(document, Format::Xml)["script"],
        json!("if (a < b && c > d) { }")
    );
}

#[test]
fn entities_are_decoded() {
    let document = "<note>Tom &amp; Jerry &lt;3</note>";
    assert_eq!(
        parsed(document, Format::Xml)["note"],
        json!("Tom & Jerry <3")
    );
}

#[test]
fn a_declaration_and_namespaces_do_not_change_the_shape() {
    let document = r#"<?xml version="1.0"?><ns:order xmlns:ns="urn:x"><ns:id>7</ns:id></ns:order>"#;
    assert_eq!(
        parsed(document, Format::Xml),
        json!({ "order": { "id": "7" } })
    );
}

#[test]
fn malformed_xml_is_reported_rather_than_half_parsed() {
    let error = parse("<order><id>7</order>", Format::Xml).expect_err("should fail");
    assert!(error.to_string().contains("XML"));
}

#[test]
fn json_round_trips_through_xml() {
    let original = json!({ "id": "7", "customer": { "name": "Ada" } });
    let document = serialize(&original, Format::Xml).expect("writes");
    let back = parsed(&document, Format::Xml);

    assert_eq!(back["root"], original);
}

#[test]
fn writing_xml_escapes_characters_that_would_break_the_document() {
    let document = serialize(&json!({ "note": "a < b & c" }), Format::Xml).expect("writes");
    assert!(document.contains("a &lt; b &amp; c"));
    assert_eq!(
        parsed(&document, Format::Xml)["root"]["note"],
        json!("a < b & c")
    );
}

#[test]
fn writing_an_array_repeats_the_element_name() {
    let document = serialize(&json!({ "line": ["a", "b"] }), Format::Xml).expect("writes");
    assert!(document.contains("<line>a</line><line>b</line>"));
}

// ===================================================================== soap

const ENVELOPE: &str = r#"<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header><auth>token</auth></soap:Header>
  <soap:Body>
    <GetPriceResponse><Price>34.50</Price><Currency>EUR</Currency></GetPriceResponse>
  </soap:Body>
</soap:Envelope>"#;

#[test]
fn a_soap_response_yields_the_payload_not_the_envelope() {
    let value = parsed(ENVELOPE, Format::Soap);

    assert_eq!(value["Price"], json!("34.50"));
    assert_eq!(value["Currency"], json!("EUR"));
    assert!(value.get("Header").is_none(), "the envelope should be gone");
}

#[test]
fn reading_the_same_envelope_as_plain_xml_keeps_the_wrapper() {
    let value = parsed(ENVELOPE, Format::Xml);
    assert!(value["Envelope"]["Body"]["GetPriceResponse"]["Price"] == json!("34.50"));
}

#[test]
fn a_soap_fault_can_be_recognised() {
    let fault = r#"<soap:Envelope xmlns:soap="x"><soap:Body><soap:Fault>
        <faultcode>soap:Server</faultcode><faultstring>Item not found</faultstring>
    </soap:Fault></soap:Body></soap:Envelope>"#;

    let value = parsed(fault, Format::Xml);
    let found = xml::soap_fault(&value).expect("a fault should be recognised");
    assert_eq!(found["faultstring"], json!("Item not found"));
}

#[test]
fn a_body_holding_several_elements_is_returned_whole() {
    let document = r"<Envelope><Body><A>1</A><B>2</B></Body></Envelope>";
    let value = parsed(document, Format::Soap);
    assert_eq!(value, json!({ "A": "1", "B": "2" }));
}

#[test]
fn xml_that_is_not_soap_passes_through_unwrapping_untouched() {
    let value = parsed("<order><id>7</id></order>", Format::Soap);
    assert_eq!(value, json!({ "order": { "id": "7" } }));
}

// ===================================================================== yaml

#[test]
fn yaml_becomes_the_same_json_it_describes() {
    let document = "name: r8r\nreplicas: 3\nports:\n  - 5678\n  - 5679\nnested:\n  a: true\n";
    assert_eq!(
        parsed(document, Format::Yaml),
        json!({ "name": "r8r", "replicas": 3, "ports": [5678, 5679], "nested": { "a": true } })
    );
}

#[test]
fn yaml_round_trips() {
    let original = json!({ "a": [1, 2], "b": { "c": "d" } });
    let document = serialize(&original, Format::Yaml).expect("writes");
    assert_eq!(parsed(&document, Format::Yaml), original);
}

#[test]
fn broken_yaml_is_reported() {
    let error = parse("a:\n  - b\n c: d\n", Format::Yaml).expect_err("should fail");
    assert!(error.to_string().contains("YAML"));
}

// ===================================================================== toml

#[test]
fn toml_becomes_json_with_its_tables_intact() {
    let document = "name = \"r8r\"\nport = 5678\n\n[database]\npath = \"r8r.sqlite\"\n";
    assert_eq!(
        parsed(document, Format::Toml),
        json!({ "name": "r8r", "port": 5678, "database": { "path": "r8r.sqlite" } })
    );
}

#[test]
fn toml_round_trips() {
    let original = json!({ "name": "r8r", "table": { "value": 1 } });
    let document = serialize(&original, Format::Toml).expect("writes");
    assert_eq!(parsed(&document, Format::Toml), original);
}

#[test]
fn broken_toml_is_reported() {
    assert!(parse("name = ", Format::Toml).is_err());
}

// ====================================================================== csv

#[test]
fn csv_becomes_one_object_per_row_keyed_by_the_header() {
    let document = "id,name,plan\n1,Ada,pro\n2,Grace,free\n";
    assert_eq!(
        parsed(document, Format::Csv),
        json!([
            { "id": "1", "name": "Ada", "plan": "pro" },
            { "id": "2", "name": "Grace", "plan": "free" }
        ])
    );
}

#[test]
fn csv_cells_stay_strings_so_identifiers_survive() {
    // A leading-zero account number must not become the number 71.
    let value = parsed("account\n0071\n", Format::Csv);
    assert_eq!(value[0]["account"], json!("0071"));
}

#[test]
fn quoted_cells_containing_commas_are_read_whole() {
    let value = parsed("id,note\n1,\"a, b, c\"\n", Format::Csv);
    assert_eq!(value[0]["note"], json!("a, b, c"));
}

#[test]
fn a_header_only_file_yields_no_rows() {
    assert_eq!(parsed("id,name\n", Format::Csv), json!([]));
}

#[test]
fn a_short_row_leaves_the_missing_cells_empty() {
    let value = parsed("a,b,c\n1,2\n", Format::Csv);
    assert_eq!(value[0], json!({ "a": "1", "b": "2", "c": "" }));
}

#[test]
fn csv_is_written_from_the_union_of_every_row_s_keys() {
    let rows = json!([{ "a": 1, "b": 2 }, { "a": 3, "c": 4 }]);
    let document = serialize(&rows, Format::Csv).expect("writes");

    assert!(document.starts_with("a,b,c\n"));
    assert!(document.contains("1,2,\n"));
    assert!(document.contains("3,,4\n"));
}

#[test]
fn writing_csv_from_something_without_fields_is_refused_clearly() {
    let error = serialize(&json!([1, 2, 3]), Format::Csv).expect_err("should fail");
    assert!(error.to_string().contains("columns"));
}

// ================================================================ auto mode

#[test]
fn auto_mode_recognises_each_format_from_its_text() {
    assert_eq!(parsed(r#"{"a":1}"#, Format::Auto), json!({ "a": 1 }));
    assert_eq!(parsed("<a>1</a>", Format::Auto), json!({ "a": "1" }));
    assert_eq!(
        parsed("a=1&b=2", Format::Auto),
        json!({ "a": "1", "b": "2" })
    );
    assert_eq!(parsed("---\na: 1\n", Format::Auto), json!({ "a": 1 }));
}

#[test]
fn auto_mode_leaves_prose_as_text_rather_than_guessing() {
    assert_eq!(
        parsed("just some words", Format::Auto),
        json!("just some words")
    );
}

#[test]
fn a_named_format_is_taken_at_its_word_and_fails_loudly() {
    // Auto would fall back to text; naming JSON should surface the error.
    assert!(parse("not json at all", Format::Json).is_err());
}

// =============================================================== the names

#[test]
fn format_names_survive_a_round_trip_and_unknown_names_degrade() {
    for format in [
        Format::Json,
        Format::Xml,
        Format::Soap,
        Format::Yaml,
        Format::Toml,
        Format::Csv,
        Format::Form,
        Format::Text,
    ] {
        assert_eq!(Format::parse_name(format.as_str()), format);
        assert!(!format.content_type().is_empty());
    }

    assert_eq!(Format::parse_name("yml"), Format::Yaml);
    assert_eq!(
        Format::parse_name("protobuf"),
        Format::Auto,
        "unknown names degrade to auto"
    );
}

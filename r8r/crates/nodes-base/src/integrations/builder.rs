//! Small helpers that keep an integration manifest readable.
//!
//! Without these, every vendor file would repeat the same `NodeProperty`
//! plumbing; with them a manifest reads as a list of resources, operations and
//! fields, which is the whole point of the declarative approach.

use r8r_workflow::interfaces::{NodeProperty, NodePropertyKind, PropertyOption};
use r8r_workflow::routing::{HttpMethod, OutputRouting, RequestRouting, Routing};
use serde_json::{Value, json};

/// The `Resource` dropdown every integration node starts with.
#[must_use]
pub fn resource(options: Vec<PropertyOption>) -> NodeProperty {
    let default = options.first().map_or_else(
        || Value::String(String::new()),
        |option| option.value.clone(),
    );

    NodeProperty::new("resource", "Resource", NodePropertyKind::Options, default)
        .with_options(options)
        .describe("What you want to work with")
}

/// The `Operation` dropdown shown for one resource.
///
/// One of these exists per resource; `displayOptions` decides which is visible,
/// so the editor only ever offers operations that resource supports.
#[must_use]
pub fn operations(for_resource: &str, options: Vec<PropertyOption>) -> NodeProperty {
    let default = options.first().map_or_else(
        || Value::String(String::new()),
        |option| option.value.clone(),
    );

    NodeProperty::new("operation", "Operation", NodePropertyKind::Options, default)
        .with_options(options)
        .show_when("resource", &[for_resource])
}

/// A text field that only appears for one resource/operation pair.
#[must_use]
pub fn field(
    name: &str,
    display_name: &str,
    for_resource: &str,
    for_operations: &[&str],
) -> NodeProperty {
    NodeProperty::new(name, display_name, NodePropertyKind::String, json!(""))
        .show_when("resource", &[for_resource])
        .show_when("operation", for_operations)
}

/// The same, for a field the request cannot be built without.
#[must_use]
pub fn required_field(
    name: &str,
    display_name: &str,
    for_resource: &str,
    for_operations: &[&str],
) -> NodeProperty {
    field(name, display_name, for_resource, for_operations).required()
}

#[must_use]
pub fn number_field(
    name: &str,
    display_name: &str,
    default: i64,
    for_resource: &str,
    for_operations: &[&str],
) -> NodeProperty {
    NodeProperty::new(name, display_name, NodePropertyKind::Number, json!(default))
        .show_when("resource", &[for_resource])
        .show_when("operation", for_operations)
}

#[must_use]
pub fn boolean_field(
    name: &str,
    display_name: &str,
    default: bool,
    for_resource: &str,
    for_operations: &[&str],
) -> NodeProperty {
    NodeProperty::new(
        name,
        display_name,
        NodePropertyKind::Boolean,
        json!(default),
    )
    .show_when("resource", &[for_resource])
    .show_when("operation", for_operations)
}

#[must_use]
pub fn multiline_field(
    name: &str,
    display_name: &str,
    for_resource: &str,
    for_operations: &[&str],
) -> NodeProperty {
    NodeProperty::new(
        name,
        display_name,
        NodePropertyKind::MultilineString,
        json!(""),
    )
    .show_when("resource", &[for_resource])
    .show_when("operation", for_operations)
}

/// An operation that GETs a URL and returns the response as one item.
#[must_use]
pub fn get(name: &str, value: &str, url: &str, action: &str) -> PropertyOption {
    PropertyOption::new(name, value)
        .describes(action)
        .routes(Routing::new(HttpMethod::Get, url))
}

/// An operation that GETs a list and fans `property` out into items.
#[must_use]
pub fn get_list(
    name: &str,
    value: &str,
    url: &str,
    property: &str,
    query: Value,
    action: &str,
) -> PropertyOption {
    PropertyOption::new(name, value).describes(action).routes(
        Routing::new(HttpMethod::Get, url)
            .with_request(RequestRouting::new(HttpMethod::Get, url).with_query(query))
            .returning(OutputRouting::list(property)),
    )
}

/// An operation that sends a JSON body.
#[must_use]
pub fn send_json(
    name: &str,
    value: &str,
    method: HttpMethod,
    url: &str,
    body: Value,
    action: &str,
) -> PropertyOption {
    PropertyOption::new(name, value).describes(action).routes(
        Routing::new(method, url)
            .with_request(RequestRouting::new(method, url).with_json_body(body)),
    )
}

/// An operation whose response body is not interesting — emit `{success:true}`.
#[must_use]
pub fn acknowledge(
    name: &str,
    value: &str,
    method: HttpMethod,
    url: &str,
    action: &str,
) -> PropertyOption {
    PropertyOption::new(name, value)
        .describes(action)
        .routes(Routing::new(method, url).returning(OutputRouting::acknowledge()))
}

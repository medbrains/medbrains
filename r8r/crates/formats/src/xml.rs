//! XML and SOAP, mapped to and from JSON.
//!
//! XML has no single correct JSON representation, so the rules are stated here
//! and tested rather than left implicit:
//!
//! * an element containing only text becomes that text
//! * an element with children becomes an object
//! * children sharing a name become an array, so a list of one and a list of
//!   many have the same shape
//! * attributes become keys prefixed with `@`
//! * text alongside attributes or children lands under `#text`

use crate::errors::{FormatError, Result};
use quick_xml::Reader;
use quick_xml::XmlVersion;
use quick_xml::escape::{escape, resolve_predefined_entity};
use quick_xml::events::Event;
use serde_json::{Map, Value};

pub const ATTRIBUTE_PREFIX: &str = "@";
pub const TEXT_KEY: &str = "#text";

/// Guard against a hostile document nesting itself into a stack overflow.
const MAX_DEPTH: usize = 256;

/// Parse XML into JSON using the rules above.
pub fn to_json(text: &str) -> Result<Value> {
    let mut stack: Vec<Node> = vec![Node::default()];
    read_events(text, &mut stack)?;
    let root = stack.into_iter().next().unwrap_or_default();
    Ok(Value::Object(root.children))
}

/// Drive the parser, folding each event into the node stack.
fn read_events(text: &str, stack: &mut Vec<Node>) -> Result<()> {
    let mut reader = Reader::from_str(text);
    // Text is *not* trimmed here: an entity splits a run of text into several
    // events, and trimming each fragment would eat the spaces around it.
    // Whitespace is trimmed once, when the element is finished.
    reader.config_mut().trim_text(false);

    // An explicit stack rather than recursion, so depth is bounded by a number
    // we choose instead of by the thread's stack size.
    loop {
        let event = reader.read_event().map_err(|e| FormatError::Parse {
            format: "XML",
            message: e.to_string(),
        })?;

        match event {
            Event::Start(start) => {
                if stack.len() >= MAX_DEPTH {
                    return Err(FormatError::Parse {
                        format: "XML",
                        message: format!("document nests deeper than {MAX_DEPTH} elements"),
                    });
                }
                stack.push(open(&start)?);
            }

            Event::Empty(start) => {
                let node = open(&start)?;
                close(stack, node);
            }

            Event::End(_) => {
                // The root sentinel is never popped.
                if stack.len() <= 1 {
                    continue;
                }
                let Some(node) = stack.pop() else { break };
                close(stack, node);
            }

            Event::Text(text) => {
                push_text(stack, &text.xml10_content());
            }

            // An entity reference arrives as its own event; resolving it here
            // is what keeps `Tom &amp; Jerry` intact.
            Event::GeneralRef(reference) => {
                let raw: &str = reference.as_ref();
                let resolved = resolve_predefined_entity(raw)
                    .map(str::to_owned)
                    .or_else(|| numeric_entity(raw))
                    // An unknown entity is left as written rather than dropped.
                    .unwrap_or_else(|| format!("&{raw};"));
                push_text(stack, &resolved);
            }

            Event::CData(data) => {
                push_text(stack, data.as_ref());
            }

            Event::Eof => break,
            _ => {}
        }
    }
    Ok(())
}

/// Render JSON as XML, inverting the rules above.
pub fn from_json(value: &Value, root: &str) -> Result<String> {
    let mut out = String::from("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
    write_value(&mut out, root, value, 0)?;
    Ok(out)
}

/// Pull the payload out of a SOAP envelope.
///
/// SOAP callers care about the body's contents, never the envelope, and a
/// `Fault` is an error the workflow should see rather than a payload — but
/// unwrapping is the caller's decision, so it is returned as data.
#[must_use]
pub fn unwrap_soap_body(value: &Value) -> Value {
    let Some(envelope) = find_key_ignoring_namespace(value, "Envelope") else {
        return value.clone();
    };
    let Some(body) = find_key_ignoring_namespace(envelope, "Body") else {
        return value.clone();
    };

    // A body wrapping exactly one element is almost always that element.
    match body
        .as_object()
        .filter(|object| object.len() == 1)
        .and_then(|o| o.values().next())
    {
        Some(only) => only.clone(),
        None => body.clone(),
    }
}

/// Was this response a SOAP fault?
#[must_use]
pub fn soap_fault(value: &Value) -> Option<Value> {
    let envelope = find_key_ignoring_namespace(value, "Envelope")?;
    let body = find_key_ignoring_namespace(envelope, "Body")?;
    find_key_ignoring_namespace(body, "Fault").cloned()
}

// --------------------------------------------------------------- internals

#[derive(Default)]
struct Node {
    name: String,
    text: String,
    children: Map<String, Value>,
    attributes: Map<String, Value>,
}

impl Node {
    /// Merge a child in, promoting to an array when the name repeats.
    fn add_child(&mut self, name: &str, value: Value) {
        match self.children.get_mut(name) {
            Some(Value::Array(existing)) => existing.push(value),
            Some(existing) => {
                let first = existing.clone();
                *existing = Value::Array(vec![first, value]);
            }
            None => {
                self.children.insert(name.to_owned(), value);
            }
        }
    }

    /// Collapse the node into the JSON value it represents.
    fn finish(self) -> (String, Value) {
        let text = self.text.trim().to_owned();
        let has_structure = !self.children.is_empty() || !self.attributes.is_empty();

        if !has_structure {
            return (self.name, Value::String(text));
        }

        let mut object = self.attributes;
        for (key, value) in self.children {
            object.insert(key, value);
        }
        if !text.is_empty() {
            object.insert(TEXT_KEY.to_owned(), Value::String(text));
        }
        (self.name, Value::Object(object))
    }
}

/// Begin an element.
fn open(start: &quick_xml::events::BytesStart<'_>) -> Result<Node> {
    let mut node = Node {
        name: local_name(start.name().as_ref()),
        ..Node::default()
    };
    read_attributes(start, &mut node)?;
    Ok(node)
}

/// Finish an element and hand it to its parent.
fn close(stack: &mut [Node], node: Node) {
    let (name, value) = node.finish();
    if let Some(parent) = stack.last_mut() {
        parent.add_child(&name, value);
    }
}

fn push_text(stack: &mut [Node], text: &str) {
    if let Some(node) = stack.last_mut() {
        node.text.push_str(text);
    }
}

/// `&#38;` and `&#x26;`.
fn numeric_entity(raw: &str) -> Option<String> {
    let digits = raw.strip_prefix('#')?;
    let code = match digits.strip_prefix(['x', 'X']) {
        Some(hex) => u32::from_str_radix(hex, 16).ok()?,
        None => digits.parse::<u32>().ok()?,
    };
    char::from_u32(code).map(String::from)
}

fn read_attributes(start: &quick_xml::events::BytesStart<'_>, node: &mut Node) -> Result<()> {
    for attribute in start.attributes() {
        let attribute = attribute.map_err(|e| FormatError::Parse {
            format: "XML",
            message: e.to_string(),
        })?;

        // Namespace declarations are transport detail, not data.
        let raw_key: &str = attribute.key.as_ref();
        if raw_key == "xmlns" || raw_key.starts_with("xmlns:") {
            continue;
        }

        let key = local_name(attribute.key.as_ref());
        let value = attribute
            .normalized_value(XmlVersion::Implicit1_0)
            .map_err(|e| FormatError::Parse {
                format: "XML",
                message: e.to_string(),
            })?
            .into_owned();
        node.attributes
            .insert(format!("{ATTRIBUTE_PREFIX}{key}"), Value::String(value));
    }
    Ok(())
}

/// `soap:Envelope` and `Envelope` should behave the same; namespaces are
/// transport detail, not data.
fn local_name(name: &str) -> String {
    name.rsplit(':').next().unwrap_or(name).to_owned()
}

fn find_key_ignoring_namespace<'a>(value: &'a Value, wanted: &str) -> Option<&'a Value> {
    value
        .as_object()?
        .iter()
        .find(|(key, _)| {
            key.rsplit(':')
                .next()
                .unwrap_or(key)
                .eq_ignore_ascii_case(wanted)
        })
        .map(|(_, found)| found)
}

fn write_value(out: &mut String, name: &str, value: &Value, depth: usize) -> Result<()> {
    use std::fmt::Write as _;

    if depth >= MAX_DEPTH {
        return Err(FormatError::Serialize {
            format: "XML",
            message: format!("value nests deeper than {MAX_DEPTH} levels"),
        });
    }

    match value {
        // An array repeats its parent's tag rather than inventing a wrapper.
        Value::Array(items) => {
            for item in items {
                write_value(out, name, item, depth + 1)?;
            }
        }

        Value::Object(object) => {
            let attributes: String = object
                .iter()
                .filter_map(|(key, entry)| {
                    key.strip_prefix(ATTRIBUTE_PREFIX)
                        .map(|attribute| format!(" {attribute}=\"{}\"", escape(text_of(entry))))
                })
                .collect();

            // Writing into a String cannot fail.
            let _ = write!(out, "<{name}{attributes}>");
            for (key, entry) in object {
                if key.starts_with(ATTRIBUTE_PREFIX) {
                    continue;
                }
                if key == TEXT_KEY {
                    out.push_str(&escape(text_of(entry)));
                    continue;
                }
                write_value(out, key, entry, depth + 1)?;
            }
            let _ = write!(out, "</{name}>");
        }

        other => {
            let _ = write!(out, "<{name}>{}</{name}>", escape(text_of(other)));
        }
    }
    Ok(())
}

fn text_of(value: &Value) -> std::borrow::Cow<'_, str> {
    match value {
        Value::String(text) => std::borrow::Cow::Borrowed(text),
        Value::Null => std::borrow::Cow::Borrowed(""),
        other => std::borrow::Cow::Owned(other.to_string()),
    }
}

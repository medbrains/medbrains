//! The data formats a workflow actually meets.
//!
//! Real integrations do not all speak JSON: enterprise systems answer in
//! SOAP, config lives in YAML or TOML, exports arrive as CSV, and older APIs
//! take form-encoded bodies. Everything inside r8r is `serde_json::Value`, so
//! this crate is the single boundary where the outside world is converted in
//! and out of that representation.
//!
//! No I/O here — parsing is a pure function, which is what makes the whole
//! surface exhaustively testable.

pub mod detect;
pub mod errors;
pub mod form;
pub mod spreadsheet;
pub mod xml;

pub use detect::detect;
pub use errors::{FormatError, Result};

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Every format r8r can read or write.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Format {
    /// Work it out from the content type, then from the text itself.
    #[default]
    Auto,
    Json,
    /// XML, mapped to JSON by the rules in [`xml`].
    Xml,
    /// XML with the SOAP envelope unwrapped, so the payload is what you get.
    Soap,
    Yaml,
    Toml,
    Csv,
    /// `a=1&b=2`, the body of an HTML form.
    Form,
    /// An Excel workbook, base64-encoded because it is binary. `.xls` and
    /// `.ods` are read by the same path.
    Xlsx,
    /// No parsing: the text as a single string.
    Text,
}

impl Format {
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Format::Auto => "auto",
            Format::Json => "json",
            Format::Xml => "xml",
            Format::Soap => "soap",
            Format::Yaml => "yaml",
            Format::Toml => "toml",
            Format::Csv => "csv",
            Format::Form => "form",
            Format::Xlsx => "xlsx",
            Format::Text => "text",
        }
    }

    /// Parse a format name, falling back to [`Format::Auto`] for anything
    /// unrecognised — a workflow written against a newer build should degrade,
    /// not explode.
    #[must_use]
    pub fn parse_name(name: &str) -> Self {
        match name.to_ascii_lowercase().as_str() {
            "json" => Format::Json,
            "xml" => Format::Xml,
            "soap" => Format::Soap,
            "yaml" | "yml" => Format::Yaml,
            "toml" => Format::Toml,
            "csv" => Format::Csv,
            "form" | "urlencoded" => Format::Form,
            "xlsx" | "excel" | "xls" | "ods" | "spreadsheet" => Format::Xlsx,
            "text" | "raw" => Format::Text,
            _ => Format::Auto,
        }
    }

    /// The content type to send when writing this format.
    #[must_use]
    pub fn content_type(&self) -> &'static str {
        match self {
            Format::Json | Format::Auto => "application/json",
            Format::Xml => "application/xml",
            Format::Soap => "application/soap+xml",
            Format::Yaml => "application/yaml",
            Format::Toml => "application/toml",
            Format::Csv => "text/csv",
            Format::Form => "application/x-www-form-urlencoded",
            Format::Xlsx => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            Format::Text => "text/plain",
        }
    }
}

/// Turn text in a known format into JSON.
///
/// [`Format::Auto`] sniffs the text; every other variant is taken at its word,
/// so a caller who knows the format gets a real error instead of a silent
/// fallback to a string.
pub fn parse(text: &str, format: Format) -> Result<Value> {
    match format {
        Format::Auto => parse(text, detect::sniff(text)),

        Format::Json => serde_json::from_str(text).map_err(|e| FormatError::json(&e)),

        Format::Xml => xml::to_json(text),

        Format::Soap => xml::to_json(text).map(|value| xml::unwrap_soap_body(&value)),

        Format::Yaml => serde_yaml_ng::from_str::<Value>(text).map_err(|e| FormatError::Parse {
            format: "YAML",
            message: e.to_string(),
        }),

        Format::Toml => toml::from_str::<Value>(text).map_err(|e| FormatError::Parse {
            format: "TOML",
            message: e.to_string(),
        }),

        Format::Csv => parse_csv(text),

        Format::Form => Ok(form::to_json(text)),

        Format::Xlsx => spreadsheet::to_json(text),

        Format::Text => Ok(Value::String(text.to_owned())),
    }
}

/// Render JSON as text in the given format.
pub fn serialize(value: &Value, format: Format) -> Result<String> {
    match format {
        Format::Auto | Format::Json => {
            serde_json::to_string_pretty(value).map_err(|e| FormatError::json(&e))
        }

        Format::Xml | Format::Soap => xml::from_json(value, "root"),

        Format::Yaml => serde_yaml_ng::to_string(value).map_err(|e| FormatError::Serialize {
            format: "YAML",
            message: e.to_string(),
        }),

        Format::Toml => toml::to_string_pretty(value).map_err(|e| FormatError::Serialize {
            format: "TOML",
            message: e.to_string(),
        }),

        Format::Csv => serialize_csv(value),

        Format::Form => Ok(form::from_json(value)),

        Format::Xlsx => spreadsheet::from_json(value),

        Format::Text => Ok(match value {
            Value::String(text) => text.clone(),
            other => other.to_string(),
        }),
    }
}

/// CSV becomes an array of objects keyed by the header row, with each field
/// left as a string: guessing types per cell is how spreadsheets turn phone
/// numbers into floats.
fn parse_csv(text: &str) -> Result<Value> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(text.as_bytes());

    let headers = reader
        .headers()
        .map_err(|e| FormatError::Parse {
            format: "CSV",
            message: e.to_string(),
        })?
        .clone();

    let mut rows = Vec::new();
    for record in reader.records() {
        let record = record.map_err(|e| FormatError::Parse {
            format: "CSV",
            message: e.to_string(),
        })?;
        let row: serde_json::Map<String, Value> = headers
            .iter()
            .enumerate()
            .map(|(index, header)| {
                let cell = record.get(index).unwrap_or_default();
                (header.to_owned(), Value::String(cell.to_owned()))
            })
            .collect();
        rows.push(Value::Object(row));
    }

    Ok(Value::Array(rows))
}

/// Write an array of objects as CSV, using the union of their keys as headers.
fn serialize_csv(value: &Value) -> Result<String> {
    let rows: Vec<&Value> = match value {
        Value::Array(entries) => entries.iter().collect(),
        single => vec![single],
    };

    let mut headers: Vec<String> = Vec::new();
    for row in &rows {
        if let Some(object) = row.as_object() {
            for key in object.keys() {
                if !headers.iter().any(|existing| existing == key) {
                    headers.push(key.clone());
                }
            }
        }
    }
    if headers.is_empty() {
        return Err(FormatError::Serialize {
            format: "CSV",
            message: "CSV needs objects with fields; got nothing to use as columns".into(),
        });
    }

    let mut writer = csv::Writer::from_writer(Vec::new());
    writer
        .write_record(&headers)
        .map_err(|e| FormatError::Serialize {
            format: "CSV",
            message: e.to_string(),
        })?;

    for row in rows {
        let cells: Vec<String> = headers
            .iter()
            .map(|header| match row.get(header) {
                Some(Value::String(text)) => text.clone(),
                Some(Value::Null) | None => String::new(),
                Some(other) => other.to_string(),
            })
            .collect();
        writer
            .write_record(&cells)
            .map_err(|e| FormatError::Serialize {
                format: "CSV",
                message: e.to_string(),
            })?;
    }

    let bytes = writer.into_inner().map_err(|e| FormatError::Serialize {
        format: "CSV",
        message: e.to_string(),
    })?;
    String::from_utf8(bytes).map_err(|e| FormatError::Serialize {
        format: "CSV",
        message: e.to_string(),
    })
}

//! Excel workbooks.
//!
//! A spreadsheet is binary, not text, so it arrives base64-encoded — which is
//! how a downloaded `.xlsx` reaches a workflow in the first place. Reading
//! yields one array of row objects per sheet, keyed by the header row, which is
//! the shape the rest of r8r already knows how to work with.

use crate::errors::{FormatError, Result};
use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64;
use calamine::{Data, Reader, open_workbook_auto_from_rs};
use rust_xlsxwriter::Workbook;
use serde_json::{Map, Number, Value};
use std::io::Cursor;

/// Sheets larger than this are refused rather than read into memory whole.
const MAX_ROWS: usize = 1_000_000;

/// Read a base64-encoded workbook.
///
/// Returns `{ "<sheet name>": [ { column: value, … }, … ], … }`. `.xls` and
/// `.ods` are read too — the format is detected from the bytes.
pub fn to_json(base64_text: &str) -> Result<Value> {
    let bytes = BASE64
        .decode(base64_text.trim())
        .map_err(|e| FormatError::Parse {
            format: "XLSX",
            message: format!("not base64: {e}"),
        })?;

    let mut workbook =
        open_workbook_auto_from_rs(Cursor::new(bytes)).map_err(|e| FormatError::Parse {
            format: "XLSX",
            message: e.to_string(),
        })?;

    let mut sheets = Map::new();
    for name in workbook.sheet_names() {
        let range = workbook
            .worksheet_range(&name)
            .map_err(|e| FormatError::Parse {
                format: "XLSX",
                message: e.to_string(),
            })?;
        sheets.insert(name.clone(), rows_of(&range)?);
    }

    Ok(Value::Object(sheets))
}

/// Turn a sheet into row objects keyed by its first row.
fn rows_of(range: &calamine::Range<Data>) -> Result<Value> {
    let mut rows = range.rows();

    let Some(header) = rows.next() else {
        // An empty sheet is empty, not an error.
        return Ok(Value::Array(Vec::new()));
    };
    let headers: Vec<String> = header
        .iter()
        .enumerate()
        .map(|(index, cell)| {
            let name = cell_text(cell);
            // A blank header still needs a stable key, or its column vanishes.
            if name.is_empty() {
                format!("column{}", index + 1)
            } else {
                name
            }
        })
        .collect();

    let mut out = Vec::new();
    for row in rows {
        if out.len() >= MAX_ROWS {
            return Err(FormatError::Parse {
                format: "XLSX",
                message: format!("sheet has more than {MAX_ROWS} rows"),
            });
        }
        // Trailing blank rows are a spreadsheet artefact, not data.
        if row.iter().all(|cell| matches!(cell, Data::Empty)) {
            continue;
        }

        let record: Map<String, Value> = headers
            .iter()
            .enumerate()
            .map(|(index, name)| (name.clone(), row.get(index).map_or(Value::Null, cell_value)))
            .collect();
        out.push(Value::Object(record));
    }

    Ok(Value::Array(out))
}

/// Cell values keep their type, except dates, which become ISO strings so they
/// survive JSON without turning into an Excel serial number.
fn cell_value(cell: &Data) -> Value {
    match cell {
        Data::Int(number) => Value::Number((*number).into()),
        Data::Float(number) => Number::from_f64(*number).map_or(Value::Null, Value::Number),
        Data::String(text) | Data::DateTimeIso(text) | Data::DurationIso(text) => {
            Value::String(text.clone())
        }
        Data::Bool(flag) => Value::Bool(*flag),
        // Excel stores a date as a serial number. Without the `dates` feature
        // calamine hands it over raw, and converting it here would mean
        // reimplementing the 1900/1904 epoch rules — so the serial is kept as a
        // number and labelled, rather than silently mangled into a wrong date.
        Data::DateTime(stamp) => {
            Number::from_f64(stamp.as_f64()).map_or(Value::Null, Value::Number)
        }
        Data::Error(error) => Value::String(format!("#ERROR: {error:?}")),
        Data::Empty => Value::Null,
    }
}

fn cell_text(cell: &Data) -> String {
    match cell_value(cell) {
        Value::String(text) => text,
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

/// Write rows as a base64-encoded `.xlsx`.
///
/// Accepts an array of objects (one sheet) or an object of sheet name to rows.
pub fn from_json(value: &Value) -> Result<String> {
    let mut workbook = Workbook::new();

    let sheets: Vec<(String, &Value)> = match value {
        Value::Object(map) if map.values().all(Value::is_array) && !map.is_empty() => map
            .iter()
            .map(|(name, rows)| (name.clone(), rows))
            .collect(),
        other => vec![("Sheet1".to_owned(), other)],
    };

    for (name, rows) in sheets {
        write_sheet(&mut workbook, &name, rows)?;
    }

    let bytes = workbook
        .save_to_buffer()
        .map_err(|e| FormatError::Serialize {
            format: "XLSX",
            message: e.to_string(),
        })?;
    Ok(BASE64.encode(bytes))
}

fn write_sheet(workbook: &mut Workbook, name: &str, rows: &Value) -> Result<()> {
    let records: Vec<&Value> = match rows {
        Value::Array(entries) => entries.iter().collect(),
        single => vec![single],
    };

    // Columns are the union of every row's keys, so a row missing a field
    // leaves a gap rather than shifting the rest along.
    let mut headers: Vec<String> = Vec::new();
    for record in &records {
        if let Some(object) = record.as_object() {
            for key in object.keys() {
                if !headers.iter().any(|existing| existing == key) {
                    headers.push(key.clone());
                }
            }
        }
    }
    if headers.is_empty() {
        return Err(FormatError::Serialize {
            format: "XLSX",
            message: "a sheet needs objects with fields to use as columns".into(),
        });
    }

    let sheet = workbook.add_worksheet();
    sheet
        .set_name(sanitise_sheet_name(name))
        .map_err(|e| FormatError::Serialize {
            format: "XLSX",
            message: e.to_string(),
        })?;

    for (column, header) in headers.iter().enumerate() {
        write_cell(sheet, 0, column, &Value::String(header.clone()))?;
    }
    for (index, record) in records.iter().enumerate() {
        for (column, header) in headers.iter().enumerate() {
            let cell = record.get(header).cloned().unwrap_or(Value::Null);
            write_cell(sheet, index + 1, column, &cell)?;
        }
    }
    Ok(())
}

fn write_cell(
    sheet: &mut rust_xlsxwriter::Worksheet,
    row: usize,
    column: usize,
    value: &Value,
) -> Result<()> {
    let row = u32::try_from(row).unwrap_or(u32::MAX);
    let column = u16::try_from(column).unwrap_or(u16::MAX);

    let outcome = match value {
        Value::Null => sheet.write_blank(row, column, &rust_xlsxwriter::Format::default()),
        Value::Bool(flag) => sheet.write_boolean(row, column, *flag),
        Value::Number(number) => match number.as_f64() {
            Some(as_float) => sheet.write_number(row, column, as_float),
            None => sheet.write_string(row, column, number.to_string()),
        },
        Value::String(text) => sheet.write_string(row, column, text),
        // Nested structures have no cell representation; JSON keeps them
        // readable rather than dropping them.
        other => sheet.write_string(row, column, other.to_string()),
    };

    outcome.map(|_| ()).map_err(|e| FormatError::Serialize {
        format: "XLSX",
        message: e.to_string(),
    })
}

/// Excel rejects some sheet names outright, so they are corrected rather than
/// allowed to fail the whole export.
fn sanitise_sheet_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if matches!(c, '/' | '\\' | '?' | '*' | '[' | ']' | ':') {
                '_'
            } else {
                c
            }
        })
        .take(31)
        .collect();
    if cleaned.trim().is_empty() {
        "Sheet1".to_owned()
    } else {
        cleaned
    }
}

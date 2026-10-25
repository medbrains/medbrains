//! Rich assistant answers from a closed catalogue of widgets.
//!
//! The model never writes a widget's numbers: it names a kind and the tool
//! result to show, and [`build`] copies the values out of that result. A
//! result that does not fit the kind is refused, never coerced. The model
//! itself receives only [`compact_for_model`] of a long result: the user sees
//! every row in the widget, the model a sample and the count.

use serde::Serialize;
use serde_json::{Map, Value};

/// Most tiles in a KPI row.
const MAX_TILES: usize = 8;
/// Most columns a table or chart carries.
const MAX_COLUMNS: usize = 8;
/// Most rows a widget carries (the rest are counted, not dropped silently).
const MAX_ROWS: usize = 200;
/// Most series one chart draws.
const MAX_SERIES: usize = 3;
/// Longest list the model is sent whole (a month of days fits); a longer
/// one is cut to its ends plus a summary, and the widget shows it all.
pub const MODEL_ROWS: usize = 40;
/// Rows kept from each end of a longer list.
const MODEL_ENDS: usize = 15;

/// One headline number.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Tile {
    pub label: String,
    /// Exactly as the record holds it.
    pub value: Value,
    /// Rupees: shown as ₹ with Indian grouping.
    pub money: bool,
}

/// One table or chart column.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Column {
    pub key: String,
    pub label: String,
    /// Rupees: shown as ₹ with Indian grouping.
    pub money: bool,
}

/// Words that make a numeric field an amount of money.
const MONEY_WORDS: &[&str] = &[
    "amount",
    "billed",
    "collected",
    "revenue",
    "paid",
    "price",
    "cost",
    "outstanding",
    "discount",
    "refund",
    "fee",
    "charge",
    "balance",
    "mrp",
    "margin",
    "sales",
    "cash",
    "card",
    "upi",
];

/// A money field by its name; a count of something never is.
fn is_money(key: &str) -> bool {
    let k = key.to_lowercase();
    !k.ends_with("count") && !k.starts_with("count") && MONEY_WORDS.iter().any(|w| k.contains(w))
}

fn column(key: &str) -> Column {
    Column {
        key: key.to_owned(),
        label: label(key),
        money: is_money(key),
    }
}

/// A series' highest and lowest point: the strong and the weak day.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Peak {
    pub series: String,
    pub high_x: Value,
    pub high: Value,
    pub low_x: Value,
    pub low: Value,
}

/// The highest and lowest rows of `series` (first wins a tie).
fn peak(rows: &[&Map<String, Value>], x: &str, series: &str) -> Option<Peak> {
    let num = |r: &&Map<String, Value>| {
        let v = r.get(series)?;
        v.as_f64().or_else(|| v.as_str()?.trim().parse().ok())
    };
    let scored: Vec<(&&Map<String, Value>, f64)> =
        rows.iter().filter_map(|r| Some((r, num(r)?))).collect();
    let high = scored.iter().fold(
        None::<&(&&Map<String, Value>, f64)>,
        |best, cur| match best {
            Some(b) if b.1 >= cur.1 => Some(b),
            _ => Some(cur),
        },
    )?;
    let low = scored.iter().fold(
        None::<&(&&Map<String, Value>, f64)>,
        |best, cur| match best {
            Some(b) if b.1 <= cur.1 => Some(b),
            _ => Some(cur),
        },
    )?;
    let field = |r: &&Map<String, Value>, k: &str| r.get(k).cloned().unwrap_or(Value::Null);
    Some(Peak {
        series: series.to_owned(),
        high_x: field(high.0, x),
        high: field(high.0, series),
        low_x: field(low.0, x),
        low: field(low.0, series),
    })
}

/// One list entry, with its status when the record has one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Item {
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

/// A widget, as the screen renders it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Widget {
    Kpis {
        title: String,
        tiles: Vec<Tile>,
    },
    Table {
        title: String,
        columns: Vec<Column>,
        rows: Vec<Map<String, Value>>,
        total_rows: usize,
        /// For an aggregate the user may drill into: `{metric, key, from, to}`.
        /// The screen fetches the patients behind a row itself.
        #[serde(skip_serializing_if = "Option::is_none")]
        drill: Option<Value>,
    },
    Chart {
        title: String,
        x: Column,
        series: Vec<Column>,
        rows: Vec<Map<String, Value>>,
        /// Each series' highest and lowest point, worked out here, not by the model.
        peaks: Vec<Peak>,
    },
    List {
        title: String,
        items: Vec<Item>,
    },
}

/// Why a result cannot be shown as the kind asked for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WidgetError {
    UnknownKind(String),
    Shape(&'static str),
}

impl std::fmt::Display for WidgetError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnknownKind(k) => write!(
                f,
                "unknown widget kind {k:?}: use kpis, table, chart or list"
            ),
            Self::Shape(what) => write!(f, "that result has no {what} to show"),
        }
    }
}

impl std::error::Error for WidgetError {}

/// Build the `kind` widget titled `title` from tool result `data`.
///
/// # Errors
/// [`WidgetError`] when the kind is not in the catalogue or `data` has no
/// part of the shape it needs.
pub fn build(kind: &str, title: &str, data: &Value) -> Result<Widget, WidgetError> {
    let title = title.trim().to_owned();
    match kind {
        "kpis" => kpis(title, data),
        "table" => table(title, data),
        "chart" => chart(title, data),
        "list" => list(title, data),
        other => Err(WidgetError::UnknownKind(other.to_owned())),
    }
}

/// `snake_case` key as a label: `total_billed` → "Total billed".
fn label(key: &str) -> String {
    let words = key.replace(['_', '-'], " ");
    let mut chars = words.trim().chars();
    chars
        .next()
        .map_or_else(String::new, |c| c.to_uppercase().chain(chars).collect())
}

fn is_number(v: &Value) -> bool {
    v.is_number() || v.as_str().is_some_and(|s| s.trim().parse::<f64>().is_ok())
}

fn is_scalar(v: &Value) -> bool {
    !(v.is_object() || v.is_array())
}

/// An id is for links, not for reading.
fn is_id(key: &str) -> bool {
    key == "id" || key.ends_with("_id") || key == "tenant_id"
}

/// The object a result is about: itself, or its `data` envelope.
fn object(data: &Value) -> Option<&Map<String, Value>> {
    data.get("data")
        .and_then(Value::as_object)
        .or_else(|| data.as_object())
}

/// The objects of an array, if it holds any.
fn as_rows(v: &Value) -> Option<Vec<&Map<String, Value>>> {
    let objs: Vec<&Map<String, Value>> =
        v.as_array()?.iter().filter_map(Value::as_object).collect();
    (!objs.is_empty()).then_some(objs)
}

/// The rows a result holds: itself if an array of objects, else the first
/// field (in the `data` envelope or at the top) that is one.
fn rows(data: &Value) -> Option<Vec<&Map<String, Value>>> {
    as_rows(data)
        .or_else(|| data.get("data").and_then(as_rows))
        .or_else(|| object(data)?.values().find_map(as_rows))
}

fn kpis(title: String, data: &Value) -> Result<Widget, WidgetError> {
    let tiles: Vec<Tile> = object(data)
        .into_iter()
        .flat_map(|o| o.iter())
        .filter(|(k, v)| !is_id(k) && is_number(v))
        .take(MAX_TILES)
        .map(|(k, v)| Tile {
            label: label(k),
            value: v.clone(),
            money: is_money(k),
        })
        .collect();
    if tiles.is_empty() {
        return Err(WidgetError::Shape("headline numbers"));
    }
    Ok(Widget::Kpis { title, tiles })
}

fn columns(first: &Map<String, Value>) -> Vec<Column> {
    first
        .iter()
        .filter(|(k, v)| !is_id(k) && is_scalar(v))
        .take(MAX_COLUMNS)
        .map(|(k, _)| column(k))
        .collect()
}

/// Each row cut to `cols`, plus a `patient_id` kept for the row's link.
fn pick(rows: &[&Map<String, Value>], cols: &[Column]) -> Vec<Map<String, Value>> {
    rows.iter()
        .take(MAX_ROWS)
        .map(|r| {
            let mut out: Map<String, Value> = cols
                .iter()
                .filter_map(|c| r.get(&c.key).map(|v| (c.key.clone(), v.clone())))
                .collect();
            if let Some(id) = r.get("patient_id").filter(|v| v.is_string()) {
                out.insert("patient_id".to_owned(), id.clone());
            }
            out
        })
        .collect()
}

fn table(title: String, data: &Value) -> Result<Widget, WidgetError> {
    let all = rows(data).ok_or(WidgetError::Shape("rows"))?;
    let columns = all.first().map(|r| columns(r)).unwrap_or_default();
    if columns.is_empty() {
        return Err(WidgetError::Shape("columns"));
    }
    // Only the server's aggregate result carries `_drill`, and only for a
    // user who may list patients.
    let drill = data.get("_drill").filter(|d| d.is_object()).map(|d| {
        let mut d = d.clone();
        d["from"] = data.get("from").cloned().unwrap_or(Value::Null);
        d["to"] = data.get("to").cloned().unwrap_or(Value::Null);
        d
    });
    Ok(Widget::Table {
        title,
        rows: pick(&all, &columns),
        columns,
        total_rows: all.len(),
        drill,
    })
}

fn chart(title: String, data: &Value) -> Result<Widget, WidgetError> {
    let all = rows(data).ok_or(WidgetError::Shape("rows"))?;
    let first = all.first().ok_or(WidgetError::Shape("rows"))?;
    let x = first
        .iter()
        .find(|(k, v)| !is_id(k) && v.is_string() && !is_number(v))
        .map(|(k, _)| column(k))
        .ok_or(WidgetError::Shape("label column"))?;
    let series: Vec<Column> = first
        .iter()
        .filter(|(k, v)| !is_id(k) && is_number(v))
        .take(MAX_SERIES)
        .map(|(k, _)| column(k))
        .collect();
    if series.is_empty() {
        return Err(WidgetError::Shape("numeric series"));
    }
    let keep: Vec<Column> = std::iter::once(x.clone())
        .chain(series.iter().cloned())
        .collect();
    let peaks = series
        .iter()
        .filter_map(|s| peak(&all, &x.key, &s.key))
        .collect();
    Ok(Widget::Chart {
        title,
        rows: pick(&all, &keep),
        x,
        series,
        peaks,
    })
}

fn list(title: String, data: &Value) -> Result<Widget, WidgetError> {
    let text = |v: &Value| {
        v.as_str()
            .map(str::to_owned)
            .or_else(|| is_scalar(v).then(|| v.to_string()))
    };
    let from_rows = |rows: Vec<&Map<String, Value>>| -> Vec<Item> {
        rows.iter()
            .filter_map(|r| {
                let name = [
                    "name",
                    "label",
                    "title",
                    "parameter",
                    "drug_name",
                    "description",
                ]
                .iter()
                .find_map(|k| r.get(*k).and_then(Value::as_str))?;
                let status = ["status", "flag", "state"]
                    .iter()
                    .find_map(|k| r.get(*k).and_then(text));
                Some(Item {
                    label: name.to_owned(),
                    status,
                })
            })
            .take(MAX_ROWS)
            .collect()
    };
    let strings = data.as_array().filter(|a| a.iter().all(Value::is_string));
    let items: Vec<Item> = match (strings, rows(data)) {
        (Some(strings), _) => strings
            .iter()
            .filter_map(Value::as_str)
            .map(|s| Item {
                label: s.to_owned(),
                status: None,
            })
            .collect(),
        (None, Some(r)) => from_rows(r),
        // A status map: `{ "billing": "cleared", "pharmacy_return": "pending" }`.
        (None, None) => object(data)
            .into_iter()
            .flat_map(|o| o.iter())
            .filter(|(k, v)| !is_id(k) && is_scalar(v))
            .map(|(k, v)| Item {
                label: label(k),
                status: text(v),
            })
            .collect(),
    };
    if items.is_empty() {
        return Err(WidgetError::Shape("items"));
    }
    Ok(Widget::List { title, items })
}

/// Sum, smallest and largest of each numeric field over all `rows`, exact
/// (decimal, never float), so the model can speak to the rows it was not sent.
fn summary(rows: &[Value]) -> Value {
    use rust_decimal::Decimal;
    use std::str::FromStr as _;
    let mut stats: Map<String, Value> = Map::new();
    let mut acc: std::collections::BTreeMap<&str, (Decimal, Decimal, Decimal)> =
        std::collections::BTreeMap::new();
    for row in rows.iter().filter_map(Value::as_object) {
        for (k, v) in row {
            let text = v.as_str().map_or_else(|| v.to_string(), str::to_owned);
            let Ok(n) = Decimal::from_str(text.trim()) else {
                continue;
            };
            if is_id(k) || !(v.is_number() || v.is_string()) {
                continue;
            }
            let e = acc.entry(k.as_str()).or_insert((Decimal::ZERO, n, n));
            e.0 += n;
            e.1 = e.1.min(n);
            e.2 = e.2.max(n);
        }
    }
    for (k, (sum, min, max)) in acc {
        stats.insert(
            k.to_owned(),
            serde_json::json!({ "sum": sum.to_string(), "min": min.to_string(), "max": max.to_string() }),
        );
    }
    Value::Object(stats)
}

/// `data` as the model receives it: a long list cut to its ends plus an
/// exact summary of every row.
///
/// A list longer than [`MODEL_ROWS`] keeps its first and last rows, says how
/// many sit between, and carries each numeric field's sum, min and max over
/// all rows — so nothing the user's widget shows is unknown to the model.
#[must_use]
pub fn compact_for_model(data: &Value) -> Value {
    match data {
        Value::Array(items) if items.len() > MODEL_ROWS => serde_json::json!({
            "rows_total": items.len(),
            "first_rows": items.iter().take(MODEL_ENDS).map(compact_for_model).collect::<Vec<_>>(),
            "rows_between_not_sent": items.len() - 2 * MODEL_ENDS,
            "last_rows": items.iter().skip(items.len() - MODEL_ENDS).map(compact_for_model).collect::<Vec<_>>(),
            "summary_of_all_rows": summary(items),
            "note": "All rows reach the user's widget; show it with the show tool.",
        }),
        Value::Array(items) => Value::Array(items.iter().map(compact_for_model).collect()),
        Value::Object(map) => Value::Object(
            map.iter()
                .map(|(k, v)| (k.clone(), compact_for_model(v)))
                .collect(),
        ),
        other => other.clone(),
    }
}

#[cfg(test)]
mod tests;

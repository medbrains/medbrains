//! The bill reader's contract (#4861). The reader is an external on-prem
//! worker (MinerU for layout, a VLM on the page images); this file is all
//! it needs to know.
//!
//! 1. `POST /api/procurement/grn-scans/claim` with `{}` (or `{"scan_id"}`) —
//!    take the oldest queued bill (or that one) under a 10-minute lease. Answers `null` when the queue is empty, else
//!    `{ scan, image_url, lease_until }`.
//! 2. Read the bill. Decode any GST e-invoice QR first.
//! 3. `POST /api/procurement/grn-scans/{id}/parse-result` with [`ParseResult`]
//!    while the lease is held. A late or second post gets 409.
//!
//! Every value is a [`Field`]: what was read, how sure the reader is (0–1),
//! and where on which page. Values may be strings or numbers; the server
//! parses them and a value it cannot parse arrives in the draft empty with
//! confidence 0, so the reviewer sees it. Nothing here posts stock.

use std::collections::BTreeMap;

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// One value the reader saw.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct Field {
    #[serde(default)]
    pub value: serde_json::Value,
    #[serde(default)]
    pub confidence: f64,
    /// `[x0, y0, x1, y1]` in page pixels.
    #[serde(default)]
    pub bbox: Option<[f64; 4]>,
    #[serde(default)]
    pub page: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(default)]
pub struct ParsedHeader {
    pub supplier_gstin: Field,
    pub supplier_name: Field,
    pub invoice_number: Field,
    pub invoice_date: Field,
    pub invoice_total: Field,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(default)]
pub struct ParsedLine {
    pub product_name: Field,
    pub supplier_code: Field,
    pub pack: Field,
    pub strength: Field,
    pub dosage_form: Field,
    pub manufacturer: Field,
    pub inn_name: Field,
    pub hsn_code: Field,
    pub batch_number: Field,
    pub expiry_date: Field,
    pub manufacture_date: Field,
    pub mrp: Field,
    pub ptr: Field,
    pub rate: Field,
    pub quantity: Field,
    pub free_quantity: Field,
    pub discount_amount: Field,
    pub gst_rate: Field,
    pub line_total: Field,
}

/// The decoded `data` of a GST e-invoice signed QR. It carries no lines;
/// it is a header cross-check and a duplicate key. `signature_verified` is
/// the reader's claim — verifying the IRP's JWS needs the GSTN public key,
/// which no tenant has configured yet (inferred, brief §12.6(c)).
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(default)]
pub struct EinvoiceQr {
    pub irn: Option<String>,
    pub seller_gstin: Option<String>,
    pub buyer_gstin: Option<String>,
    pub doc_no: Option<String>,
    pub doc_typ: Option<String>,
    /// `dd/mm/yyyy` as the QR carries it.
    pub doc_dt: Option<String>,
    pub tot_inv_val: Option<Decimal>,
    pub item_cnt: Option<u32>,
    pub signature_verified: bool,
}

/// `POST …/parse-result` body.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(default)]
pub struct ParseResult {
    /// Reader name and version, e.g. `mineru-2.1+qwen3-vl-8b`.
    pub worker: Option<String>,
    /// Set when the bill could not be read; the scan goes to `failed`.
    pub error: Option<String>,
    pub overall_confidence: Option<f64>,
    pub einvoice_qr: Option<EinvoiceQr>,
    pub header: ParsedHeader,
    pub lines: Vec<ParsedLine>,
}

/// The editable draft the reviewer corrects. Typed; `confidence` keys are
/// field paths (`header.invoice_number`, `lines[2].batch_number`).
#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
#[serde(default)]
pub struct Draft {
    pub header: DraftHeader,
    pub lines: Vec<DraftLine>,
    pub confidence: BTreeMap<String, f64>,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
#[serde(default)]
pub struct DraftHeader {
    pub vendor_id: Option<Uuid>,
    pub po_id: Option<Uuid>,
    pub store_location_id: Option<Uuid>,
    pub supplier_gstin: Option<String>,
    pub supplier_name: Option<String>,
    pub invoice_number: Option<String>,
    pub invoice_date: Option<NaiveDate>,
    pub invoice_amount: Option<Decimal>,
    pub irn: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
#[serde(default)]
pub struct DraftLine {
    pub product_name: Option<String>,
    pub supplier_code: Option<String>,
    pub pack: Option<String>,
    pub strength: Option<String>,
    pub dosage_form: Option<String>,
    pub manufacturer: Option<String>,
    pub inn_name: Option<String>,
    pub hsn_code: Option<String>,
    pub batch_number: Option<String>,
    pub expiry_date: Option<NaiveDate>,
    pub manufacture_date: Option<NaiveDate>,
    pub mrp: Option<Decimal>,
    pub ptr: Option<Decimal>,
    pub rate: Option<Decimal>,
    pub quantity: Option<i32>,
    pub free_quantity: Option<i32>,
    pub discount_amount: Option<Decimal>,
    pub gst_rate: Option<Decimal>,
    /// Units rejected at the door; accepted = quantity − rejected.
    pub quantity_rejected: Option<i32>,
    /// The reviewer's catalogue item (store catalogue).
    pub catalog_item_id: Option<Uuid>,
    /// What the system proposed from a confirmed supplier alias. Never
    /// edited by the screen; compared with `catalog_item_id` for accuracy.
    pub suggested_item_id: Option<Uuid>,
    pub po_item_id: Option<Uuid>,
}

fn text(f: &Field) -> Option<String> {
    match &f.value {
        serde_json::Value::String(s) => Some(s.trim().to_owned()).filter(|s| !s.is_empty()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn decimal(f: &Field) -> Option<Decimal> {
    let raw = text(f)?;
    let cleaned: String = raw
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
        .collect();
    cleaned.parse().ok()
}

/// `"10"`, `"10.0"`, and the scheme form `"10+1"` → (10, Some(1)).
fn quantity(f: &Field) -> (Option<i32>, Option<i32>) {
    let Some(raw) = text(f) else {
        return (None, None);
    };
    let mut parts = raw
        .split('+')
        .map(|p| p.trim().split('.').next().unwrap_or("").parse::<i32>().ok());
    let billed = parts.next().flatten();
    let free = parts.next().flatten();
    (billed, free)
}

fn last_day(year: i32, month: u32) -> Option<NaiveDate> {
    let (ny, nm) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    NaiveDate::from_ymd_opt(ny, nm, 1)?.pred_opt()
}

const MONTHS: [&str; 12] = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/// Bill dates: `2027-09-30`, `30/09/2027`, `30-09-2027`, and the month-year
/// expiry forms `09/27`, `09/2027`, `SEP-27`, `SEP 2027` (→ last day of month).
pub fn parse_bill_date(raw: &str) -> Option<NaiveDate> {
    let s = raw.trim().to_uppercase();
    if let Ok(d) = NaiveDate::parse_from_str(&s, "%Y-%m-%d") {
        return Some(d);
    }
    for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"] {
        if let Ok(d) = NaiveDate::parse_from_str(&s, fmt) {
            return Some(d);
        }
    }
    let parts: Vec<&str> = s
        .split(['/', '-', ' ', '.'])
        .filter(|p| !p.is_empty())
        .collect();
    let [m, y] = parts.as_slice() else {
        return None;
    };
    let month = m.parse::<u32>().ok().or_else(|| {
        MONTHS
            .iter()
            .position(|name| m.starts_with(name))
            .and_then(|i| u32::try_from(i + 1).ok())
    })?;
    let year = y.parse::<i32>().ok()?;
    let year = if year < 100 { 2000 + year } else { year };
    (1..=12)
        .contains(&month)
        .then(|| last_day(year, month))
        .flatten()
}

fn date(f: &Field) -> Option<NaiveDate> {
    text(f).as_deref().and_then(parse_bill_date)
}

/// Confidence kept for a field; a value the server could not parse is 0.
fn note(conf: &mut BTreeMap<String, f64>, path: String, f: &Field, parsed: bool) {
    if f.value.is_null() {
        return;
    }
    conf.insert(
        path,
        if parsed {
            f.confidence.clamp(0.0, 1.0)
        } else {
            0.0
        },
    );
}

fn draft_line(i: usize, l: &ParsedLine, conf: &mut BTreeMap<String, f64>) -> DraftLine {
    let at = |k: &str| format!("lines[{i}].{k}");
    let (qty, scheme_free) = quantity(&l.quantity);
    let free = quantity(&l.free_quantity).0.or(scheme_free);
    let line = DraftLine {
        product_name: text(&l.product_name),
        supplier_code: text(&l.supplier_code),
        pack: text(&l.pack),
        strength: text(&l.strength),
        dosage_form: text(&l.dosage_form),
        manufacturer: text(&l.manufacturer),
        inn_name: text(&l.inn_name),
        hsn_code: text(&l.hsn_code).map(|h| h.chars().filter(char::is_ascii_digit).collect()),
        batch_number: text(&l.batch_number),
        expiry_date: date(&l.expiry_date),
        manufacture_date: date(&l.manufacture_date),
        mrp: decimal(&l.mrp),
        ptr: decimal(&l.ptr),
        rate: decimal(&l.rate),
        quantity: qty,
        free_quantity: free,
        discount_amount: decimal(&l.discount_amount),
        gst_rate: decimal(&l.gst_rate),
        ..DraftLine::default()
    };
    note(
        conf,
        at("product_name"),
        &l.product_name,
        line.product_name.is_some(),
    );
    note(
        conf,
        at("batch_number"),
        &l.batch_number,
        line.batch_number.is_some(),
    );
    note(
        conf,
        at("expiry_date"),
        &l.expiry_date,
        line.expiry_date.is_some(),
    );
    note(
        conf,
        at("manufacture_date"),
        &l.manufacture_date,
        line.manufacture_date.is_some(),
    );
    note(conf, at("mrp"), &l.mrp, line.mrp.is_some());
    note(conf, at("rate"), &l.rate, line.rate.is_some());
    note(conf, at("gst_rate"), &l.gst_rate, line.gst_rate.is_some());
    note(conf, at("hsn_code"), &l.hsn_code, line.hsn_code.is_some());
    // "10+1" read as one figure is the classic merge of free into billed.
    let qty_ok = qty.is_some() && scheme_free.is_none();
    note(conf, at("quantity"), &l.quantity, qty_ok);
    note(
        conf,
        at("free_quantity"),
        &l.free_quantity,
        line.free_quantity.is_some(),
    );
    line
}

/// The first draft from what the reader saw. Pure: the same extraction
/// always gives the same draft, so corrections are measured against it.
pub fn to_draft(parsed: &ParseResult) -> Draft {
    let mut conf = BTreeMap::new();
    let h = &parsed.header;
    let mut header = DraftHeader {
        supplier_gstin: text(&h.supplier_gstin).map(|g| g.to_uppercase()),
        supplier_name: text(&h.supplier_name),
        invoice_number: text(&h.invoice_number),
        invoice_date: date(&h.invoice_date),
        invoice_amount: decimal(&h.invoice_total),
        ..DraftHeader::default()
    };
    note(
        &mut conf,
        "header.invoice_number".into(),
        &h.invoice_number,
        header.invoice_number.is_some(),
    );
    note(
        &mut conf,
        "header.invoice_date".into(),
        &h.invoice_date,
        header.invoice_date.is_some(),
    );
    note(
        &mut conf,
        "header.invoice_amount".into(),
        &h.invoice_total,
        header.invoice_amount.is_some(),
    );
    note(
        &mut conf,
        "header.supplier_gstin".into(),
        &h.supplier_gstin,
        header.supplier_gstin.is_some(),
    );
    if let Some(qr) = &parsed.einvoice_qr {
        header.irn = qr
            .irn
            .as_ref()
            .map(|s| s.trim().to_lowercase())
            .filter(|s| s.len() == 64);
    }
    let lines = parsed
        .lines
        .iter()
        .enumerate()
        .map(|(i, l)| draft_line(i, l, &mut conf))
        .collect();
    Draft {
        header,
        lines,
        confidence: conf,
    }
}

/// Where the e-invoice QR disagrees with the bill as read. The QR is signed
/// by the IRP; a mismatch means the reader, not the QR, is wrong.
pub fn qr_mismatches(draft: &Draft, qr: &EinvoiceQr) -> Vec<String> {
    let mut out = Vec::new();
    let norm = |s: &str| {
        s.chars()
            .filter(char::is_ascii_alphanumeric)
            .collect::<String>()
            .to_uppercase()
    };
    if let (Some(a), Some(b)) = (&qr.doc_no, &draft.header.invoice_number)
        && norm(a) != norm(b)
    {
        out.push(format!("Invoice number: QR says {a}, the bill reads {b}"));
    }
    if let (Some(a), Some(b)) = (
        qr.doc_dt.as_deref().and_then(parse_bill_date),
        draft.header.invoice_date,
    ) && a != b
    {
        out.push(format!("Invoice date: QR says {a}, the bill reads {b}"));
    }
    if let (Some(a), Some(b)) = (qr.tot_inv_val, draft.header.invoice_amount)
        && (a - b).abs() > Decimal::ONE
    {
        out.push(format!("Invoice total: QR says ₹{a}, the bill reads ₹{b}"));
    }
    if let (Some(a), Some(b)) = (&qr.seller_gstin, &draft.header.supplier_gstin)
        && !a.eq_ignore_ascii_case(b)
    {
        out.push(format!("Supplier GSTIN: QR says {a}, the bill reads {b}"));
    }
    if let Some(n) = qr.item_cnt
        && usize::try_from(n).ok() != Some(draft.lines.len())
    {
        out.push(format!(
            "The QR counts {n} lines, {} were read: a line missed or read twice",
            draft.lines.len()
        ));
    }
    out
}

/// Adjacent lines with the same item (or name), batch and quantity: a line
/// read twice. Flagged with the index it repeats; never dropped — a
/// stockist can genuinely split a batch over two lines.
pub fn repeated_lines(lines: &[DraftLine]) -> Vec<(usize, usize)> {
    let key = |l: &DraftLine| {
        (
            l.catalog_item_id
                .map(|u| u.to_string())
                .or_else(|| l.product_name.as_ref().map(|n| n.to_lowercase())),
            l.batch_number.as_ref().map(|b| b.to_uppercase()),
            l.quantity,
        )
    };
    lines
        .windows(2)
        .enumerate()
        .filter(|(_, w)| key(&w[0]).0.is_some() && key(&w[0]) == key(&w[1]))
        .map(|(i, _)| (i + 1, i))
        .collect()
}

#[cfg(test)]
#[path = "grn_scan_contract_tests.rs"]
mod tests;

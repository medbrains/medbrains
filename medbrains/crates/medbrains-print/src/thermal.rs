//! Documents for printers that do not take a PDF (#221): ZPL for Zebra-class
//! wristband and label printers, ESC/POS for receipt printers. Each is built
//! from the same context the PDF was rendered with, so the band on the wrist
//! says what the screen said.

use serde_json::Value;

/// What a printer speaks, from its configured type.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Language {
    Pdf,
    Zpl,
    EscPos,
}

impl Language {
    #[must_use]
    pub fn for_printer(printer_type: &str) -> Self {
        match printer_type {
            "wristband" | "label" => Self::Zpl,
            "thermal" => Self::EscPos,
            _ => Self::Pdf,
        }
    }

    #[must_use]
    pub const fn content_type(self) -> &'static str {
        match self {
            Self::Pdf => "application/pdf",
            Self::Zpl => "application/zpl",
            Self::EscPos => "application/escpos",
        }
    }
}

/// Which templates a printer language can carry. A page printer takes them all.
#[must_use]
pub fn supports(language: Language, template_code: &str) -> bool {
    match language {
        Language::Pdf => true,
        Language::Zpl => matches!(template_code, "patient_wristband" | "pharmacy_label"),
        Language::EscPos => matches!(template_code, "queue_token_slip" | "payment_receipt"),
    }
}

fn text<'a>(ctx: &'a Value, path: &[&str]) -> &'a str {
    path.iter()
        .try_fold(ctx, |v, k| v.get(k))
        .and_then(Value::as_str)
        .unwrap_or_default()
}

/// ZPL field data: `^` and `~` are commands, never text.
fn zf(s: &str) -> String {
    s.replace(['^', '~'], " ").trim().to_owned()
}

/// A patient wristband, 1" × 11" at 203 dpi, printed along the band: the two
/// identifiers (name, UHID) large, age/sex and admission beneath, allergies
/// flagged, and the UHID as a Code 128 barcode for bedside scanning.
// ponytail: geometry is for 203 dpi Zebra bands; a 300 dpi printer needs its
// own offsets — add a dpi capability on the printer when one arrives.
fn zpl_wristband(ctx: &Value) -> String {
    let b = |k: &str| zf(text(ctx, &["band", k]));
    let allergies: Vec<String> = ctx["band"]["allergies"]
        .as_array()
        .map(|a| a.iter().filter_map(Value::as_str).map(zf).collect())
        .unwrap_or_default();
    let allergy = if allergies.is_empty() {
        "NKDA".to_owned()
    } else {
        format!("ALLERGY: {}", allergies.join(", "))
    };
    let place = [b("ward_name"), b("bed_number")]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" / ");
    format!(
        "^XA^CI28^PW203^LL2236^FWR\n\
         ^FO150,420^A0R,40,40^FD{name}^FS\n\
         ^FO105,420^A0R,34,34^FDUHID {uhid}^FS\n\
         ^FO70,420^A0R,26,26^FD{age} {gender}  {blood}  IP {adm}^FS\n\
         ^FO40,420^A0R,24,24^FD{allergy}^FS\n\
         ^FO10,420^A0R,22,22^FD{place}^FS\n\
         ^FO40,1300^BY2^BCR,110,N,N,N^FD{uhid}^FS\n\
         ^XZ\n",
        name = b("patient_name"),
        uhid = b("uhid"),
        age = b("age"),
        gender = b("gender"),
        blood = b("blood_group"),
        adm = b("admission_number"),
    )
}

/// A 50 × 25 mm dispensing label at 203 dpi.
fn zpl_pharmacy_label(ctx: &Value) -> String {
    let l = |k: &str| zf(text(ctx, &["label", k]));
    format!(
        "^XA^CI28^PW400^LL200\n\
         ^FO10,8^A0N,26,26^FD{drug}^FS\n\
         ^FO10,40^A0N,22,22^FD{dose} {freq} x {dur}^FS\n\
         ^FO10,68^A0N,20,20^FD{instr}^FS\n\
         ^FO10,100^A0N,20,20^FD{name}^FS\n\
         ^FO10,124^A0N,20,20^FD{uhid}  {date}^FS\n\
         ^FO10,150^BY1^BCN,40,N,N,N^FD{uhid}^FS\n\
         ^XZ\n",
        drug = l("drug_name"),
        dose = l("dosage"),
        freq = l("frequency"),
        dur = l("duration"),
        instr = l("instructions"),
        name = l("patient_name"),
        uhid = l("uhid"),
        date = l("dispensed_date"),
    )
}

const ESC: u8 = 0x1B;
const GS: u8 = 0x1D;

/// Receipt printers have no font for most scripts: anything outside ASCII
/// prints as `?` rather than as garbage bytes.
// ponytail: ASCII only; per-printer code pages when a hospital needs Tamil
// or Hindi on the slip.
fn ascii(s: &str) -> String {
    s.replace('₹', "Rs ")
        .chars()
        .map(|c| {
            if c.is_ascii() && !c.is_ascii_control() {
                c
            } else {
                '?'
            }
        })
        .collect()
}

struct Slip(Vec<u8>);

impl Slip {
    fn new() -> Self {
        Self(vec![ESC, b'@'])
    }
    fn center(&mut self, on: bool) -> &mut Self {
        self.0.extend([ESC, b'a', u8::from(on)]);
        self
    }
    fn big(&mut self, on: bool) -> &mut Self {
        self.0.extend([GS, b'!', if on { 0x11 } else { 0 }]);
        self
    }
    fn line(&mut self, s: &str) -> &mut Self {
        self.0.extend(ascii(s).bytes());
        self.0.push(b'\n');
        self
    }
    fn cut(mut self) -> Vec<u8> {
        self.0.extend([b'\n', b'\n', b'\n', GS, b'V', 66, 0]);
        self.0
    }
}

fn escpos_token_slip(ctx: &Value) -> Vec<u8> {
    let t = |k: &str| text(ctx, &["token", k]).to_owned();
    let mut s = Slip::new();
    s.center(true)
        .line(&t("department_name"))
        .big(true)
        .line(&t("token_number"))
        .big(false);
    s.line(&format!("{} {}", t("doctor_name"), t("room_number")).replace("  ", " "));
    s.center(false)
        .line(&format!("{} ({})", t("patient_name"), t("uhid")));
    s.line(&format!("{} {}", t("token_date"), t("token_time")));
    if let Some(wait) = ctx["token"]["estimated_wait_minutes"].as_i64() {
        s.line(&format!("Estimated wait: {wait} min"));
    }
    s.line(&t("instructions"));
    s.cut()
}

fn escpos_receipt(ctx: &Value) -> Vec<u8> {
    let r = |k: &str| text(ctx, &["receipt", k]).to_owned();
    let mut s = Slip::new();
    s.center(true)
        .line("PAYMENT RECEIPT")
        .line(&r("receipt_number"))
        .center(false);
    s.line(&format!("{} ({})", r("patient_name"), r("uhid")));
    s.line(&format!("Bill: {}", r("invoice_number")));
    s.big(true).line(&format!("Rs {}", r("amount"))).big(false);
    s.line(&format!("{} {}", r("payment_mode"), r("reference_number")));
    s.line(&format!("{}  {}", r("paid_at"), r("received_by")));
    s.cut()
}

/// The bytes for a thermal printer, or why it cannot print this document.
pub fn render(language: Language, template_code: &str, ctx: &Value) -> Result<Vec<u8>, String> {
    match (language, template_code) {
        (Language::Zpl, "patient_wristband") => Ok(zpl_wristband(ctx).into_bytes()),
        (Language::Zpl, "pharmacy_label") => Ok(zpl_pharmacy_label(ctx).into_bytes()),
        (Language::EscPos, "queue_token_slip") => Ok(escpos_token_slip(ctx)),
        (Language::EscPos, "payment_receipt") => Ok(escpos_receipt(ctx)),
        _ => Err(format!(
            "a {language:?} printer cannot print '{template_code}'; send it to a page printer"
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn band() -> Value {
        json!({ "band": {
            "patient_name": "R. Lakshmi^~", "uhid": "ACMS-2026-00042", "age": "42y", "gender": "F",
            "blood_group": "B+", "admission_number": "IP-000042", "ward_name": "GW-A", "bed_number": "12",
            "allergies": ["Penicillin", "Sulfa"],
        }})
    }

    #[test]
    fn a_wristband_carries_both_identifiers_allergies_and_a_scannable_uhid() {
        let zpl = String::from_utf8(
            render(Language::Zpl, "patient_wristband", &band()).unwrap_or_default(),
        )
        .unwrap_or_default();
        assert!(zpl.starts_with("^XA") && zpl.trim_end().ends_with("^XZ"));
        assert!(
            zpl.contains("^FDR. Lakshmi^FS"),
            "a ^ or ~ in a name must not become a command: {zpl}"
        );
        assert!(zpl.contains("^FDUHID ACMS-2026-00042^FS"));
        assert!(zpl.contains("ALLERGY: Penicillin, Sulfa"));
        assert!(zpl.contains("^BCR,110,N,N,N^FDACMS-2026-00042^FS"));
        assert!(zpl.contains("GW-A / 12"));
        let none = render(
            Language::Zpl,
            "patient_wristband",
            &json!({ "band": { "allergies": [] } }),
        )
        .unwrap_or_default();
        assert!(String::from_utf8_lossy(&none).contains("NKDA"));
    }

    #[test]
    fn a_token_slip_is_esc_pos_with_a_big_number_and_a_cut() {
        let bytes = render(
            Language::EscPos,
            "queue_token_slip",
            &json!({ "token": { "token_number": "CARD-014", "department_name": "Cardiology",
                     "patient_name": "லட்சுமி", "uhid": "U1", "estimated_wait_minutes": 18 } }),
        )
        .unwrap_or_default();
        assert_eq!(&bytes[..2], &[ESC, b'@']);
        let big = bytes
            .windows(3)
            .position(|w| w == [GS, b'!', 0x11])
            .unwrap_or(usize::MAX);
        let number = bytes.windows(8).position(|w| w == b"CARD-014").unwrap_or(0);
        assert!(big < number, "the token number prints large");
        assert!(
            String::from_utf8_lossy(&bytes).contains("??????? (U1)"),
            "non-ASCII never reaches the printer raw"
        );
        assert!(String::from_utf8_lossy(&bytes).contains("Estimated wait: 18 min"));
        assert_eq!(&bytes[bytes.len() - 4..], &[GS, b'V', 66, 0]);
    }

    #[test]
    fn printers_refuse_what_they_cannot_carry() {
        assert_eq!(Language::for_printer("wristband"), Language::Zpl);
        assert_eq!(Language::for_printer("thermal"), Language::EscPos);
        assert_eq!(Language::for_printer("laser"), Language::Pdf);
        assert!(supports(Language::Pdf, "discharge_summary"));
        assert!(!supports(Language::Zpl, "discharge_summary"));
        assert!(render(Language::EscPos, "patient_wristband", &json!({})).is_err());
    }
}

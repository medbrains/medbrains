//! Clinical classes that never reach a model.
//!
//! Pseudonymising a name is not enough for these: "[PATIENT_1] is HIV
//! positive" is still the disclosure, and the law treats each class as more
//! than ordinary PHI — HIV/AIDS Act 2017 s.8–11, Mental Healthcare Act 2017
//! s.23, PC&PNDT Act 1994 s.5/s.6, the medico-legal record (CrPC/BNSS, POCSO
//! s.23), substance use (NDPS / de-addiction confidentiality), and the ART
//! (Regulation) Act 2021 / MTP Act 1971 for reproductive care. No current AI
//! task needs any of them, so they are withheld from every model input. A
//! future task that does must name the class *and* check the user's
//! entitlement to it (e.g. `specialty.psychiatry.restricted.view`) before
//! this is relaxed for it.
//!
//! Withheld, not deleted silently: the model is told an entry was withheld,
//! so it can say "there are restricted entries I cannot see" rather than
//! answer as if the chart were complete.

use std::sync::LazyLock;

use regex::Regex;
use serde_json::Value;

/// A class of clinical data excluded from model input.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SensitiveClass {
    HivSti,
    MentalHealth,
    Pcpndt,
    MedicoLegal,
    SubstanceUse,
    Reproductive,
}

/// What a withheld value is replaced by.
pub const WITHHELD: &str = "[WITHHELD: restricted clinical class, not shared with the AI]";

static MARKERS: LazyLock<Result<Vec<(Regex, SensitiveClass)>, regex::Error>> = LazyLock::new(
    || {
        let c = |re: &str, class| Regex::new(&format!("(?i){re}")).map(|r| (r, class));
        Ok(vec![
            c(
                r"\bhiv\b|\bplhiv\b|hiv/aids|retrovir|\bictc\b|\bart\s+(?:centre|center|clinic)|\bcd4\b|viral\s+load|syphilis|\bvdrl\b|\brpr\b|\btpha\b|gonorrh|chlamydia|\bstis?\b|\bstds?\b|genital\s+(?:herpes|wart|ulcer)|tenofovir|dolutegravir|zidovudine|efavirenz|nevirapine",
                SensitiveClass::HivSti,
            )?,
            c(
                r"schizo|bipolar|psychos[ie]s|psychotic|depressive\s+disorder|major\s+depress|suicid|self[- ]harm|mental\s+health|psychiatr|antipsychotic|olanzapine|risperidone|haloperidol|clozapine|quetiapine|aripiprazole|\blithium\b|electroconvulsive|\bect\b|\bmhca\b|mental\s+healthcare\s+act|obsessive[- ]compulsive|\bptsd\b|anorexia\s+nervosa|bulimia",
                SensitiveClass::MentalHealth,
            )?,
            c(
                r"sex\s+determination|sex\s+of\s+(?:the\s+)?f[oe]etus|f[oe]etal\s+sex|gender\s+of\s+(?:the\s+)?f[oe]etus|pc\s*-?\s*pndt|\bpndt\b|\bform\s*-?\s*f\b",
                SensitiveClass::Pcpndt,
            )?,
            c(
                r"\bmlc\b|medico[- ]?legal|police\s+(?:intimation|case|station|officer)|\bfir\b|\bpocso\b|sexual\s+assault|\brape\b|\bassault\b",
                SensitiveClass::MedicoLegal,
            )?,
            c(
                r"alcohol\s+(?:dependence|use\s+disorder|withdrawal)|opioid\s+(?:dependence|use\s+disorder|substitution)|substance\s+(?:use|abuse|dependence)|de-?\s?addiction|buprenorphine|methadone|naltrexone|heroin|cannabis\s+use|drug\s+abuse|\bost\b",
                SensitiveClass::SubstanceUse,
            )?,
            c(
                r"\bivf\b|in\s+vitro\s+fertili|\bicsi\b|\biui\b|embryo|oocyte|surrogacy|\bart\s+act\b|\bmtp\b|medical\s+termination|abortion|termination\s+of\s+pregnancy|infertility\s+treatment|semen\s+analysis|sperm\s+(?:donor|bank)",
                SensitiveClass::Reproductive,
            )?,
        ])
    },
);

/// ICD-11 stem codes that are a restricted class on their own. An ICD-11
/// code has a letter in second place (`6A20`, `1C62`, `PB80`); ICD-10 has a
/// digit (`F20`, `B20`).
fn class_of_icd11(code: &str) -> Option<SensitiveClass> {
    let starts = |prefixes: &[&str]| prefixes.iter().any(|p| code.starts_with(p));
    if starts(&["6C4", "6C5"]) {
        // Disorders due to substance use or addictive behaviours.
        Some(SensitiveClass::SubstanceUse)
    } else if starts(&["6A", "6B", "6C", "6D", "6E"]) {
        // Chapter 06: mental, behavioural or neurodevelopmental disorders.
        Some(SensitiveClass::MentalHealth)
    } else if starts(&["1C60", "1C61", "1C62", "1A6", "1A7", "1A8", "1A9"]) {
        // HIV disease; predominantly sexually transmitted infections.
        Some(SensitiveClass::HivSti)
    } else if starts(&["JA00"]) {
        // Abortion, including medical termination.
        Some(SensitiveClass::Reproductive)
    } else if starts(&["PB8", "PB9", "PC", "PD0", "PD1", "PD2", "PD3"]) {
        // Intentional self-harm.
        Some(SensitiveClass::MentalHealth)
    } else if starts(&["PD5", "PD6", "PD7", "PD8", "PD9", "PE", "PF0", "PF1", "PF2"]) {
        // Assault.
        Some(SensitiveClass::MedicoLegal)
    } else {
        None
    }
}

/// ICD-10 or ICD-11 codes that are a restricted class on their own.
fn class_of_icd(code: &str) -> Option<SensitiveClass> {
    let code = code.trim().to_ascii_uppercase();
    if code.as_bytes().get(1).is_some_and(u8::is_ascii_alphabetic) {
        return class_of_icd11(&code);
    }
    let num = |from: usize| code.get(from..3).and_then(|n| n.parse::<u32>().ok());
    match code.chars().next()? {
        'F' => Some(if (10..=19).contains(&num(1)?) {
            SensitiveClass::SubstanceUse
        } else {
            SensitiveClass::MentalHealth
        }),
        'B' if (20..=24).contains(&num(1)?) => Some(SensitiveClass::HivSti),
        'A' if (50..=64).contains(&num(1)?) => Some(SensitiveClass::HivSti),
        'Z' if code.starts_with("Z21") => Some(SensitiveClass::HivSti),
        'Z' if code.starts_with("Z31") => Some(SensitiveClass::Reproductive),
        'O' if code.starts_with("O04") => Some(SensitiveClass::Reproductive),
        // Intentional self-harm, then assault.
        'X' if (60..=84).contains(&num(1)?) => Some(SensitiveClass::MentalHealth),
        'X' if (85..=99).contains(&num(1)?) => Some(SensitiveClass::MedicoLegal),
        'Y' if num(1)? <= 9 => Some(SensitiveClass::MedicoLegal),
        _ => None,
    }
}

/// Keys whose presence marks a medico-legal or PCPNDT record.
const CLASS_KEYS: &[(&str, SensitiveClass)] = &[
    ("mlc_number", SensitiveClass::MedicoLegal),
    ("fir_number", SensitiveClass::MedicoLegal),
    ("police_station", SensitiveClass::MedicoLegal),
    ("pocso_report", SensitiveClass::MedicoLegal),
    ("is_mlc", SensitiveClass::MedicoLegal),
    ("form_f", SensitiveClass::Pcpndt),
    ("pcpndt", SensitiveClass::Pcpndt),
    ("hiv_status", SensitiveClass::HivSti),
];

/// The class a piece of text belongs to, if any.
///
/// # Errors
/// The markers could not be compiled — the caller must refuse the AI call.
pub fn class_of_text(text: &str) -> Result<Option<SensitiveClass>, String> {
    let markers = MARKERS.as_ref().map_err(ToString::to_string)?;
    Ok(markers
        .iter()
        .find(|(re, _)| re.is_match(text))
        .map(|(_, class)| *class))
}

/// Remove every restricted-class entry from a JSON value in place: an object
/// carrying a restricted ICD code, a class key, or a string naming a class is
/// replaced whole; a bare string naming a class is replaced. Returns how many were
/// withheld.
///
/// # Errors
/// The markers could not be compiled.
pub fn withhold_in_json(value: &mut Value) -> Result<usize, String> {
    match value {
        Value::Object(map) => {
            let by_code = ["icd_code", "icd10_code", "code", "diagnosis_code"]
                .iter()
                .filter_map(|k| map.get(*k).and_then(Value::as_str))
                .any(|c| class_of_icd(c).is_some());
            let by_key = CLASS_KEYS.iter().any(|(k, _)| {
                map.get(*k)
                    .is_some_and(|v| !v.is_null() && v != &Value::Bool(false))
            });
            // A leaf record whose own text names a class goes whole: its other
            // fields ("value": "Reactive") are the disclosure too. A container
            // (a chart with lists inside) loses only the offending text.
            let leaf = map.values().all(|v| !v.is_object() && !v.is_array());
            let mut by_text = false;
            for v in map.values().filter(|_| leaf) {
                if let Value::String(s) = v
                    && class_of_text(s)?.is_some()
                {
                    by_text = true;
                    break;
                }
            }
            if by_code || by_key || by_text {
                *value = Value::String(WITHHELD.to_owned());
                return Ok(1);
            }
            let mut n = 0;
            for v in map.values_mut() {
                n += withhold_in_json(v)?;
            }
            // A key can be the disclosure too (`"mlc": "[WITHHELD…]"`): a
            // withheld value under a key naming its class loses the key.
            let mut leaky = Vec::new();
            for (k, v) in map.iter() {
                let named = CLASS_KEYS.iter().any(|(c, _)| c == k)
                    || class_of_text(&k.replace('_', " "))?.is_some();
                if named && v.as_str() == Some(WITHHELD) {
                    leaky.push(k.clone());
                }
            }
            for (i, k) in leaky.iter().enumerate() {
                if let Some(v) = map.remove(k) {
                    map.insert(format!("withheld_{}", i + 1), v);
                }
            }
            Ok(n)
        }
        Value::Array(items) => {
            let mut n = 0;
            for v in items {
                n += withhold_in_json(v)?;
            }
            Ok(n)
        }
        Value::String(s) => {
            if class_of_text(s)?.is_some() {
                WITHHELD.clone_into(s);
                Ok(1)
            } else {
                Ok(0)
            }
        }
        _ => Ok(0),
    }
}

/// The same rule for plain text: a text naming a restricted class is
/// withheld whole (a sentence cannot be safely half-sent).
///
/// # Errors
/// The markers could not be compiled.
pub fn withhold_in_text(text: &str) -> Result<(String, usize), String> {
    if let Ok(mut json) = serde_json::from_str::<Value>(text) {
        let n = withhold_in_json(&mut json)?;
        return Ok((json.to_string(), n));
    }
    Ok(match class_of_text(text)? {
        Some(_) => (WITHHELD.to_owned(), 1),
        None => (text.to_owned(), 0),
    })
}

#[cfg(test)]
mod tests {
    use super::{SensitiveClass, WITHHELD, class_of_text, withhold_in_json, withhold_in_text};
    use serde_json::json;

    #[test]
    fn each_class_is_recognised_in_a_note() {
        let cases = [
            (
                "Known PLHIV on TLD (tenofovir/lamivudine/dolutegravir)",
                SensitiveClass::HivSti,
            ),
            (
                "VDRL reactive, treated for syphilis",
                SensitiveClass::HivSti,
            ),
            (
                "k/c/o schizophrenia on olanzapine",
                SensitiveClass::MentalHealth,
            ),
            (
                "h/o suicidal ideation last year",
                SensitiveClass::MentalHealth,
            ),
            (
                "Family asked about sex of the foetus",
                SensitiveClass::Pcpndt,
            ),
            (
                "MLC registered, police intimation sent",
                SensitiveClass::MedicoLegal,
            ),
            (
                "Alcohol dependence syndrome, on de-addiction programme",
                SensitiveClass::SubstanceUse,
            ),
            (
                "Second IVF cycle, embryo transfer done",
                SensitiveClass::Reproductive,
            ),
            ("MTP done at 8 weeks", SensitiveClass::Reproductive),
        ];
        for (text, class) in cases {
            assert_eq!(class_of_text(text), Ok(Some(class)), "{text}");
        }
    }

    #[test]
    fn icd11_codes_carry_their_class_and_ordinary_ones_pass() {
        use super::class_of_icd;
        let restricted = [
            ("6A20", SensitiveClass::MentalHealth),
            ("6A70.1", SensitiveClass::MentalHealth),
            ("6C40.2", SensitiveClass::SubstanceUse),
            ("1C62.Z", SensitiveClass::HivSti),
            ("1A60", SensitiveClass::HivSti),
            ("JA00.1", SensitiveClass::Reproductive),
            ("PB80", SensitiveClass::MentalHealth),
            ("PD50", SensitiveClass::MedicoLegal),
        ];
        for (code, class) in restricted {
            assert_eq!(class_of_icd(code), Some(class), "{code}");
        }
        // Osteoarthritis of hip, diabetes, pneumonia: ICD-11 codes whose first
        // letter an ICD-10 rule would misread.
        for code in ["FA01", "5A11", "CA40", "BA00", "1D20"] {
            assert_eq!(class_of_icd(code), None, "{code}");
        }
        assert_eq!(class_of_icd("F20.0"), Some(SensitiveClass::MentalHealth));
    }

    #[test]
    fn ordinary_clinical_text_passes() {
        for text in [
            "ST depression in V4-V6, troponin awaited",
            "Type 2 diabetes on metformin, HbA1c 7.2",
            "Partial thromboplastin time normal; art line in situ",
        ] {
            assert_eq!(class_of_text(text), Ok(None), "{text}");
        }
    }

    #[test]
    fn a_record_carrying_a_restricted_code_is_withheld_whole() {
        let mut chart = json!({
            "problems": [
                {"icd_code": "E11.9", "description": "Type 2 diabetes"},
                {"icd_code": "F20.0", "description": "Paranoid schizophrenia"},
                {"icd_code": "B20", "description": "HIV disease"},
                {"icd_code": "F10.2", "description": "Alcohol dependence"}
            ],
            "labs": [
                {"parameter_name": "HIV 1/2 antibody", "value": "Reactive"},
                {"parameter_name": "Potassium", "value": "5.9"}
            ],
            "mlc": {"mlc_number": "MLC/2026/14", "injuries": "abrasion"}
        });
        let n = withhold_in_json(&mut chart).unwrap_or_default();
        let out = chart.to_string();
        assert_eq!(n, 5, "{out}");
        for gone in [
            "schizophrenia",
            "HIV",
            "Alcohol",
            "Reactive",
            "MLC/2026",
            "mlc",
        ] {
            assert!(!out.contains(gone), "{gone} reached the model: {out}");
        }
        assert!(
            out.contains("Type 2 diabetes") && out.contains("Potassium") && out.contains(WITHHELD)
        );
    }

    #[test]
    fn plain_text_naming_a_class_is_withheld_whole() {
        let (out, n) = withhold_in_text("Patient is HIV positive, CD4 220").unwrap_or_default();
        assert_eq!((out.as_str(), n), (WITHHELD, 1));
        let (out, n) = withhold_in_text("BP 130/80").unwrap_or_default();
        assert_eq!((out.as_str(), n), ("BP 130/80", 0));
    }
}

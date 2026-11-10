//! Reading the dose a scanner gave from what it sent to the PACS.
//!
//! Two sources, best first:
//!
//! - **RDSR** — the X-Ray Radiation Dose Structured Report a modality sends
//!   alongside the images (SOP class 1.2.840.10008.5.1.4.1.1.88.67). Its
//!   content tree carries the totals the scanner computed: DLP, `CTDIvol`,
//!   dose-area product, screening time, and one container per exposure.
//! - **Image headers** — when there is no RDSR, the per-image attributes:
//!   `CTDIvol` (0018,9345), area dose product (0018,115E), kVp and mAs. DLP is
//!   not in image headers, so a CT read this way has `CTDIvol` only.
//!
//! Both take Orthanc's `?simplify` tag JSON (keywords as keys, sequences as
//! arrays of objects, numbers as strings). Pure functions: the sync fetches,
//! these read.

use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;
use serde_json::Value;

/// X-Ray Radiation Dose SR Storage.
pub const RDSR_SOP_CLASS: &str = "1.2.840.10008.5.1.4.1.1.88.67";
/// How deep and how wide an RDSR tree is walked; real reports are far smaller.
const MAX_DEPTH: usize = 12;
const MAX_NODES: usize = 20_000;

// DICOM (DCM) concept codes in an RDSR.
const DLP_TOTAL: &str = "113813";
const DLP_EVENT: &str = "113838";
const MEAN_CTDIVOL: &str = "113830";
const DAP_TOTAL: &str = "113722";
const DAP_EVENT: &str = "122130";
const FLUORO_TIME_TOTAL: &str = "113730";
const IRRADIATION_EVENT: &str = "113706";
const CT_ACQUISITION: &str = "113819";
const KVP: &str = "113733";
const EXPOSURE_UAS: &str = "113736";

/// The figures one study's dose came to.
#[derive(Debug, Default, Clone, PartialEq)]
pub struct CapturedDose {
    /// mGy·cm.
    pub dlp: Option<f64>,
    /// mGy, the highest of the acquisitions.
    pub ctdi_vol: Option<f64>,
    /// Gy·cm².
    pub dap: Option<f64>,
    pub fluoroscopy_time_seconds: Option<f64>,
    pub exposure_count: Option<i32>,
    /// Technique, only when the study was a single exposure.
    pub kvp: Option<f64>,
    pub mas: Option<f64>,
}

impl CapturedDose {
    #[must_use]
    pub const fn is_empty(&self) -> bool {
        self.dlp.is_none()
            && self.ctdi_vol.is_none()
            && self.dap.is_none()
            && self.fluoroscopy_time_seconds.is_none()
    }

    /// The figures as the dose table stores them, at its precision.
    #[must_use]
    pub fn decimals(&self) -> [Option<Decimal>; 5] {
        let d = |v: Option<f64>| v.and_then(Decimal::from_f64).map(|d| d.round_dp(4));
        [
            d(self.dlp),
            d(self.ctdi_vol),
            d(self.dap),
            d(self.kvp),
            d(self.mas),
        ]
    }
}

fn number(v: &Value) -> Option<f64> {
    match v {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.split('\\').next()?.trim().parse().ok(),
        _ => None,
    }
    .filter(|n: &f64| n.is_finite() && *n >= 0.0)
}

fn first<'a>(node: &'a Value, key: &str) -> Option<&'a Value> {
    node.get(key)
        .and_then(|v| v.as_array())
        .and_then(|a| a.first())
}

fn concept(node: &Value) -> Option<&str> {
    first(node, "ConceptNameCodeSequence")?
        .get("CodeValue")?
        .as_str()
}

/// A NUM item's value and its unit code.
fn measured(node: &Value) -> Option<(f64, &str)> {
    let m = first(node, "MeasuredValueSequence")?;
    let unit = first(m, "MeasurementUnitsCodeSequence")
        .and_then(|u| u.get("CodeValue"))
        .and_then(Value::as_str)
        .unwrap_or_default();
    Some((number(m.get("NumericValue")?)?, unit))
}

/// Dose-area product in Gy·cm², from whatever unit the report used.
fn dap_gy_cm2(value: f64, unit: &str) -> f64 {
    match unit {
        "Gy.m2" => value * 10_000.0,
        "dGy.cm2" => value / 10.0,
        "cGy.cm2" | "uGy.m2" => value / 100.0,
        "mGy.cm2" => value / 1000.0,
        _ => value,
    }
}

#[derive(Default)]
struct Walk {
    dlp_total: Option<f64>,
    dlp_events: f64,
    ctdi: Option<f64>,
    dap_total: Option<f64>,
    dap_events: f64,
    fluoro: Option<f64>,
    events: i32,
    kvp: Option<f64>,
    uas: Option<f64>,
    nodes: usize,
}

/// The larger of a running maximum and a new value.
#[allow(clippy::unnecessary_wraps)] // folds into `Option` fields
fn max(a: Option<f64>, b: f64) -> Option<f64> {
    Some(a.map_or(b, |a| a.max(b)))
}

fn visit(node: &Value, depth: usize, w: &mut Walk) {
    w.nodes += 1;
    if depth > MAX_DEPTH || w.nodes > MAX_NODES {
        return;
    }
    let code = concept(node);
    if matches!(code, Some(IRRADIATION_EVENT | CT_ACQUISITION)) {
        w.events += 1;
    }
    if let (Some(code), Some((value, unit))) = (code, measured(node)) {
        match code {
            DLP_TOTAL => w.dlp_total = Some(value),
            DLP_EVENT => w.dlp_events += value,
            MEAN_CTDIVOL => w.ctdi = max(w.ctdi, value),
            DAP_TOTAL => w.dap_total = Some(dap_gy_cm2(value, unit)),
            DAP_EVENT => w.dap_events += dap_gy_cm2(value, unit),
            FLUORO_TIME_TOTAL => w.fluoro = Some(value),
            KVP => w.kvp = max(w.kvp, value),
            EXPOSURE_UAS => w.uas = Some(w.uas.unwrap_or(0.0) + value),
            _ => {}
        }
    }
    if let Some(children) = node.get("ContentSequence").and_then(Value::as_array) {
        for child in children {
            visit(child, depth + 1, w);
        }
    }
}

const fn positive(v: f64) -> Option<f64> {
    if v > 0.0 { Some(v) } else { None }
}

/// The dose in an RDSR's simplified tags; `None` when it is not an RDSR.
#[must_use]
pub fn from_rdsr(tags: &Value) -> Option<CapturedDose> {
    if tags.get("SOPClassUID").and_then(Value::as_str) != Some(RDSR_SOP_CLASS) {
        return None;
    }
    let mut w = Walk::default();
    visit(tags, 0, &mut w);
    let single = w.events == 1;
    Some(CapturedDose {
        dlp: w.dlp_total.or_else(|| positive(w.dlp_events)),
        ctdi_vol: w.ctdi,
        dap: w.dap_total.or_else(|| positive(w.dap_events)),
        fluoroscopy_time_seconds: w.fluoro,
        exposure_count: (w.events > 0).then_some(w.events),
        kvp: w.kvp.filter(|_| single),
        mas: w.uas.map(|u| u / 1000.0).filter(|_| single),
    })
}

/// Projection radiography: every image is one exposure.
#[must_use]
pub fn is_projection(modality: &str) -> bool {
    matches!(modality, "CR" | "DX" | "MG" | "RF" | "XA" | "IO" | "PX")
}

/// The dose readable from image headers: `(modality, simplified tags)` for
/// each image read.
#[must_use]
pub fn from_headers<'a>(images: impl IntoIterator<Item = (&'a str, &'a Value)>) -> CapturedDose {
    let mut out = CapturedDose::default();
    let (mut exposures, mut dap, mut kvp, mut mas) = (0, 0.0, None, None);
    for (modality, tags) in images {
        if let Some(ctdi) = tags.get("CTDIvol").and_then(number) {
            out.ctdi_vol = max(out.ctdi_vol, ctdi);
        }
        if let Some(d) = tags
            .get("ImageAndFluoroscopyAreaDoseProduct")
            .and_then(number)
        {
            dap += dap_gy_cm2(d, "dGy.cm2");
        }
        if is_projection(modality) {
            exposures += 1;
            kvp = tags.get("KVP").and_then(number).or(kvp);
            mas = tags
                .get("Exposure")
                .and_then(number)
                .or_else(|| {
                    tags.get("ExposureInuAs")
                        .and_then(number)
                        .map(|u| u / 1000.0)
                })
                .or(mas);
        }
    }
    out.dap = positive(dap);
    if exposures > 0 {
        out.exposure_count = Some(exposures);
        if exposures == 1 {
            (out.kvp, out.mas) = (kvp, mas);
        }
    }
    out
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use serde_json::json;

    fn num(code: &str, value: &str, unit: &str) -> Value {
        json!({
            "ValueType": "NUM",
            "ConceptNameCodeSequence": [{ "CodeValue": code, "CodingSchemeDesignator": "DCM" }],
            "MeasuredValueSequence": [{
                "NumericValue": value,
                "MeasurementUnitsCodeSequence": [{ "CodeValue": unit }]
            }]
        })
    }

    fn container(code: &str, children: Vec<Value>) -> Value {
        json!({
            "ValueType": "CONTAINER",
            "ConceptNameCodeSequence": [{ "CodeValue": code }],
            "ContentSequence": children
        })
    }

    #[test]
    fn a_ct_rdsr_gives_its_total_dlp_and_highest_ctdivol() {
        let report = json!({
            "SOPClassUID": RDSR_SOP_CLASS,
            "ContentSequence": [
                container("113811", vec![num(DLP_TOTAL, "812.40", "mGy.cm")]),
                container(CT_ACQUISITION, vec![num(MEAN_CTDIVOL, "11.2", "mGy"), num(DLP_EVENT, "400", "mGy.cm")]),
                container(CT_ACQUISITION, vec![num(MEAN_CTDIVOL, "14.9", "mGy"), num(DLP_EVENT, "412.4", "mGy.cm")]),
            ]
        });
        let dose = from_rdsr(&report).unwrap();
        assert_eq!(dose.dlp, Some(812.4));
        assert_eq!(dose.ctdi_vol, Some(14.9));
        assert_eq!(dose.exposure_count, Some(2));
        assert_eq!(dose.kvp, None, "technique is per exposure, not per study");
    }

    #[test]
    fn a_fluoroscopy_rdsr_gives_dap_in_gy_cm2_and_screening_time() {
        let report = json!({
            "SOPClassUID": RDSR_SOP_CLASS,
            "ContentSequence": [container("113702", vec![
                num(DAP_TOTAL, "0.00253", "Gy.m2"),
                num(FLUORO_TIME_TOTAL, "184", "s"),
            ])]
        });
        let dose = from_rdsr(&report).unwrap();
        assert!((dose.dap.unwrap() - 25.3).abs() < 1e-9);
        assert_eq!(dose.fluoroscopy_time_seconds, Some(184.0));
    }

    #[test]
    fn event_dlp_is_summed_when_the_report_has_no_total() {
        let report = json!({
            "SOPClassUID": RDSR_SOP_CLASS,
            "ContentSequence": [
                container(CT_ACQUISITION, vec![num(DLP_EVENT, "100", "mGy.cm")]),
                container(CT_ACQUISITION, vec![num(DLP_EVENT, "50.5", "mGy.cm")]),
            ]
        });
        assert_eq!(from_rdsr(&report).unwrap().dlp, Some(150.5));
    }

    #[test]
    fn a_structured_report_that_is_not_a_dose_report_is_ignored() {
        assert!(from_rdsr(&json!({ "SOPClassUID": "1.2.840.10008.5.1.4.1.1.88.33" })).is_none());
    }

    #[test]
    fn headers_give_ct_ctdivol_and_a_radiographs_technique() {
        let ct = json!({ "CTDIvol": "9.81" });
        let ct2 = json!({ "CTDIvol": "12.0" });
        let dose = from_headers([("CT", &ct), ("CT", &ct2)]);
        assert_eq!(
            (dose.ctdi_vol, dose.dlp, dose.exposure_count),
            (Some(12.0), None, None)
        );

        let chest =
            json!({ "KVP": "110", "Exposure": "4", "ImageAndFluoroscopyAreaDoseProduct": "0.81" });
        let dose = from_headers([("DX", &chest)]);
        assert_eq!(dose.exposure_count, Some(1));
        assert_eq!((dose.kvp, dose.mas), (Some(110.0), Some(4.0)));
        assert!((dose.dap.unwrap() - 0.081).abs() < 1e-9);
    }

    #[test]
    fn nonsense_values_are_not_doses() {
        let bad = json!({ "CTDIvol": "-3", "KVP": "abc" });
        assert!(from_headers([("CT", &bad)]).is_empty());
    }
}

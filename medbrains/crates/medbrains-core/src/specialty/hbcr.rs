//! The NCDIR hospital-based cancer registry (HBCR) core form: its codes and
//! what makes an abstract complete.
//!
//! Source: ICMR-NCDIR, National Cancer Registry Programme, *HBCR Procedure
//! Manual 2025* (<https://hbcr.ncdirindia.org/HBCR_Master/assets/Pdf/Procedure_manual_2025.pdf>),
//! items 1–32, read with ICD-O-3 and ICD-10. Item numbers below are the
//! manual's. NCDIR collects the core form through its own HBCR software; it
//! publishes no bulk-upload format, so the abstract is prepared here, coded
//! to the manual, for the registry clerk to enter or upload there.

use std::sync::LazyLock;

use regex::Regex;
use serde::{Deserialize, Serialize};

/// A coded item: `(code, meaning)` as the manual lists them.
pub type Codes = &'static [(i16, &'static str)];

/// Item 6, case registered through.
pub const CASE_REGISTERED_THROUGH: Codes = &[
    (1, "Out-patient"),
    (2, "In-patient (elective)"),
    (3, "In-patient (emergency)"),
    (8, "Others"),
    (9, "Unknown"),
];
/// Item 12, sex.
pub const SEX: Codes = &[(1, "Male"), (2, "Female"), (8, "Others")];
/// Item 20, method of diagnosis.
pub const METHOD_OF_DIAGNOSIS: Codes = &[
    (1, "Clinical only"),
    (2, "Microscopic"),
    (3, "X-ray/imaging techniques"),
    (4, "DCO"),
    (8, "Others"),
    (9, "Unknown"),
];
/// Item 25, laterality (0 = not a paired site; 1–6 for a paired site).
pub const LATERALITY: Codes = &[
    (0, "Not a paired site"),
    (1, "Right"),
    (2, "Left"),
    (3, "Only one side involved, origin unknown"),
    (4, "Bilateral involvement, origin unknown"),
    (5, "Paired site, midline tumour"),
    (6, "Paired site, no information on laterality"),
    (9, "Unknown"),
];
/// Item 27, clinical extent of disease before cancer-directed treatment.
pub const EXTENT_OF_DISEASE: Codes = &[
    (1, "In-situ/benign/borderline/pre-invasive"),
    (2, "Localised"),
    (3, "Direct extension"),
    (4, "Regional nodes"),
    (5, "Direct extension with regional node involvement"),
    (6, "Distant metastasis"),
    (7, "Not palpable"),
    (8, "Too advanced"),
    (9, "Not applicable"),
    (10, "Recurrence"),
    (88, "Others"),
    (99, "Unknown"),
];
/// Item 28.1, staging system followed.
pub const STAGING_SYSTEM: Codes = &[
    (1, "TNM"),
    (2, "FIGO"),
    (3, "Ann Arbor"),
    (4, "Toronto (childhood cancers)"),
    (5, "Not applicable"),
    (8, "Others"),
    (9, "Unknown"),
];
/// Item 29, treatment before registration at the reporting institution.
pub const PRIOR_TREATMENT: Codes = &[(1, "Yes"), (2, "No"), (9, "Unknown")];
/// Items 29/30, intention of treatment.
pub const INTENTION: Codes = &[
    (1, "Curative/radical"),
    (2, "Palliative"),
    (3, "Symptomatic (includes pain relief)"),
    (9, "Unknown"),
];
/// Item 29.3, ECOG performance status (9 = unknown).
pub const ECOG: Codes = &[
    (0, "Fully active"),
    (1, "Restricted in strenuous activity"),
    (2, "Ambulatory, self-care, unable to work"),
    (3, "Limited self-care"),
    (4, "Completely disabled"),
    (5, "Dead"),
    (9, "Unknown"),
];
/// Item 30, cancer-directed treatment at the reporting institution.
pub const TREATMENT_AT_RI: Codes = &[
    (1, "Completed treatment"),
    (2, "No treatment"),
    (3, "Treatment advised but not accepted"),
    (4, "Incomplete treatment"),
];

/// Every coded item, keyed by its [`HbcrCoding`] field, for the abstract form.
pub const CODE_LISTS: &[(&str, Codes)] = &[
    ("case_registered_through", CASE_REGISTERED_THROUGH),
    ("method_of_diagnosis", METHOD_OF_DIAGNOSIS),
    ("laterality", LATERALITY),
    ("extent_of_disease", EXTENT_OF_DISEASE),
    ("staging_system", STAGING_SYSTEM),
    ("prior_treatment", PRIOR_TREATMENT),
    ("intention", INTENTION),
    ("ecog", ECOG),
    ("treatment_at_ri", TREATMENT_AT_RI),
];

/// The meaning of `code` in `codes`, if it is one of them.
#[must_use]
pub fn meaning(codes: Codes, code: i16) -> Option<&'static str> {
    codes.iter().find(|(c, _)| *c == code).map(|(_, m)| *m)
}

static TOPOGRAPHY: LazyLock<Result<Regex, regex::Error>> =
    LazyLock::new(|| Regex::new(r"^C[0-8][0-9]\.[0-9]$"));
static MORPHOLOGY: LazyLock<Result<Regex, regex::Error>> =
    LazyLock::new(|| Regex::new(r"^[89][0-9]{3}/[0-369]$"));
static ICD10: LazyLock<Result<Regex, regex::Error>> =
    LazyLock::new(|| Regex::new(r"^[CD][0-9]{2}(\.[0-9])?$"));

/// The coded part of an abstract the registry clerk completes.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct HbcrCoding {
    pub hbcr_registration_no: Option<String>,
    pub date_of_first_diagnosis: Option<chrono::NaiveDate>,
    pub case_registered_through: Option<i16>,
    /// Item 7, as the manual describes it: `self`, `other_facility` or `unknown`.
    pub referral_type: Option<String>,
    pub method_of_diagnosis: Option<i16>,
    /// ICD-O-3 topography, e.g. `C50.4`.
    pub icdo3_topography: Option<String>,
    /// ICD-O-3 morphology with behaviour, e.g. `8500/3`.
    pub icdo3_morphology: Option<String>,
    pub icd10_code: Option<String>,
    pub laterality: Option<i16>,
    /// Item 26: 0 for a single primary, 1, 2, … for later primaries.
    pub sequence: Option<i16>,
    pub extent_of_disease: Option<i16>,
    pub staging_system: Option<i16>,
    pub prior_treatment: Option<i16>,
    pub intention: Option<i16>,
    pub ecog: Option<i16>,
    pub treatment_at_ri: Option<i16>,
}

fn coded(name: &str, codes: Codes, v: Option<i16>, out: &mut Vec<String>) {
    if let Some(v) = v
        && meaning(codes, v).is_none()
    {
        out.push(format!("{name}: {v} is not a code in the HBCR manual"));
    }
}

fn shaped(
    name: &str,
    re: &LazyLock<Result<Regex, regex::Error>>,
    v: Option<&str>,
    hint: &str,
    out: &mut Vec<String>,
) {
    if let Some(v) = v
        && !re.as_ref().is_ok_and(|r| r.is_match(v.trim()))
    {
        out.push(format!("{name}: {v} is not {hint}"));
    }
}

/// Values that are present but wrong. A blank is not wrong here; it is what
/// [`missing`] reports.
#[must_use]
pub fn invalid(c: &HbcrCoding) -> Vec<String> {
    let mut out = Vec::new();
    coded(
        "case registered through",
        CASE_REGISTERED_THROUGH,
        c.case_registered_through,
        &mut out,
    );
    coded(
        "method of diagnosis",
        METHOD_OF_DIAGNOSIS,
        c.method_of_diagnosis,
        &mut out,
    );
    coded("laterality", LATERALITY, c.laterality, &mut out);
    coded(
        "extent of disease",
        EXTENT_OF_DISEASE,
        c.extent_of_disease,
        &mut out,
    );
    coded("staging system", STAGING_SYSTEM, c.staging_system, &mut out);
    coded(
        "prior treatment",
        PRIOR_TREATMENT,
        c.prior_treatment,
        &mut out,
    );
    coded("intention of treatment", INTENTION, c.intention, &mut out);
    coded("ECOG", ECOG, c.ecog, &mut out);
    coded(
        "treatment at the reporting institution",
        TREATMENT_AT_RI,
        c.treatment_at_ri,
        &mut out,
    );
    shaped(
        "ICD-O-3 topography",
        &TOPOGRAPHY,
        c.icdo3_topography.as_deref(),
        "like C50.4",
        &mut out,
    );
    shaped(
        "ICD-O-3 morphology",
        &MORPHOLOGY,
        c.icdo3_morphology.as_deref(),
        "like 8500/3",
        &mut out,
    );
    shaped(
        "ICD-10",
        &ICD10,
        c.icd10_code.as_deref(),
        "like C50.4",
        &mut out,
    );
    if c.sequence.is_some_and(|s| !(0..=9).contains(&s)) {
        out.push("sequence: 0 for a single primary, 1–9 for later ones".to_owned());
    }
    if c.referral_type
        .as_deref()
        .is_some_and(|r| !matches!(r, "self" | "other_facility" | "unknown"))
    {
        out.push("referral: self, other facility or unknown".to_owned());
    }
    out
}

/// Mandatory items still blank, by the manual's item numbers.
#[must_use]
pub fn missing(c: &HbcrCoding) -> Vec<&'static str> {
    let mut out = Vec::new();
    let mut need = |present: bool, item: &'static str| {
        if !present {
            out.push(item);
        }
    };
    need(
        c.hbcr_registration_no
            .as_deref()
            .is_some_and(|s| !s.trim().is_empty()),
        "2 HBCR registration number",
    );
    need(
        c.case_registered_through.is_some(),
        "6 case registered through",
    );
    need(c.referral_type.is_some(), "7 type of referral");
    need(
        c.date_of_first_diagnosis.is_some(),
        "8 date of first diagnosis",
    );
    need(c.method_of_diagnosis.is_some(), "20 method of diagnosis");
    need(c.icdo3_topography.is_some(), "23.1 ICD-O-3 topography");
    need(c.icdo3_morphology.is_some(), "23.2 ICD-O-3 morphology");
    need(c.icd10_code.is_some(), "23 ICD-10");
    need(c.laterality.is_some(), "25 laterality");
    need(c.sequence.is_some(), "26 sequence");
    need(
        c.extent_of_disease.is_some(),
        "27 clinical extent of disease",
    );
    need(c.staging_system.is_some(), "28.1 staging system");
    need(
        c.prior_treatment.is_some(),
        "29 treatment before registration",
    );
    need(c.intention.is_some(), "29/30 intention of treatment");
    need(c.ecog.is_some(), "29.3 ECOG performance status");
    need(
        c.treatment_at_ri.is_some(),
        "30 treatment at the reporting institution",
    );
    out
}

/// Whether a case belongs in the report to the coordinating unit: the manual
/// registers in-situ, benign and borderline tumours but does not report them.
#[must_use]
pub fn reportable(c: &HbcrCoding) -> bool {
    c.icdo3_morphology.as_deref().is_none_or(|m| {
        m.trim().ends_with("/3") || m.trim().ends_with("/6") || m.trim().ends_with("/9")
    }) && c.extent_of_disease != Some(1)
}

#[cfg(test)]
mod tests {
    use super::{HbcrCoding, invalid, missing, reportable};

    fn complete() -> HbcrCoding {
        HbcrCoding {
            hbcr_registration_no: Some("2026/0001".into()),
            date_of_first_diagnosis: chrono::NaiveDate::from_ymd_opt(2026, 3, 2),
            case_registered_through: Some(1),
            referral_type: Some("other_facility".into()),
            method_of_diagnosis: Some(2),
            icdo3_topography: Some("C50.4".into()),
            icdo3_morphology: Some("8500/3".into()),
            icd10_code: Some("C50.4".into()),
            laterality: Some(2),
            sequence: Some(0),
            extent_of_disease: Some(4),
            staging_system: Some(1),
            prior_treatment: Some(2),
            intention: Some(1),
            ecog: Some(1),
            treatment_at_ri: Some(1),
        }
    }

    #[test]
    fn a_complete_abstract_has_nothing_missing_or_wrong() {
        assert!(invalid(&complete()).is_empty());
        assert!(missing(&complete()).is_empty());
        assert!(reportable(&complete()));
    }

    #[test]
    fn codes_outside_the_manual_and_malformed_icd_o_are_refused() {
        let c = HbcrCoding {
            method_of_diagnosis: Some(5),
            extent_of_disease: Some(11),
            icdo3_topography: Some("C50".into()),
            icdo3_morphology: Some("8500-3".into()),
            ecog: Some(6),
            ..complete()
        };
        let errors = invalid(&c);
        assert_eq!(errors.len(), 5, "{errors:?}");
    }

    #[test]
    fn blanks_are_reported_by_item_number() {
        let c = HbcrCoding {
            ecog: None,
            laterality: None,
            ..complete()
        };
        assert_eq!(
            missing(&c),
            vec!["25 laterality", "29.3 ECOG performance status"]
        );
    }

    #[test]
    fn in_situ_and_benign_tumours_are_registered_but_not_reported() {
        assert!(!reportable(&HbcrCoding {
            icdo3_morphology: Some("8500/2".into()),
            ..complete()
        }));
        assert!(!reportable(&HbcrCoding {
            extent_of_disease: Some(1),
            ..complete()
        }));
    }
}

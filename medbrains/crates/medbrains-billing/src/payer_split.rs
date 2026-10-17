//! Who pays each line of a bill (#294) — the arithmetic, kept pure.
//!
//! A line's payer is, in order: what the desk assigned; the patient, when the
//! line is on the hospital's non-payables list; otherwise the bill's insurer,
//! scheme or corporate, when it has one. The insurer's share then carries
//! the policy's co-pay and deductible, which move to the patient.

use rust_decimal::{Decimal, RoundingStrategy};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Payer {
    ThirdParty,
    Patient,
}

/// One entry of the non-payables list (`billing.non_payables`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Rule {
    /// `keyword` (in the line's description), `category` or `charge_code`.
    pub match_on: String,
    pub value: String,
    pub reason: String,
}

/// Non-medical items insurers do not pay for — after IRDAI's standard list of
/// excluded items (List I). A starting point; the hospital edits its own.
pub fn default_rules() -> Vec<Rule> {
    const IRDAI_LIST_I: &str = "IRDAI List I — non-medical item";
    [
        "registration",
        "admission kit",
        "toiletr",
        "cosmetic",
        "attendant",
        "telephone",
        "television",
        "baby food",
        "diaper",
        "sanitary pad",
        "slipper",
        "comb",
        "documentation charge",
        "medical records charge",
        "birth certificate",
        "death certificate",
    ]
    .into_iter()
    .map(|k| Rule {
        match_on: "keyword".into(),
        value: k.into(),
        reason: IRDAI_LIST_I.into(),
    })
    .collect()
}

/// A bill line as the split sees it.
#[derive(Debug, Clone)]
pub struct Line {
    pub id: Uuid,
    pub description: String,
    pub charge_code: String,
    pub category: Option<String>,
    pub total: Decimal,
    pub payer: Option<Payer>,
    pub payer_reason: Option<String>,
}

/// The bill's third party and its policy terms; `None` = self-pay.
#[derive(Debug, Clone, Copy, Default)]
pub struct Terms {
    pub copay_percent: Decimal,
    pub deductible: Decimal,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct SplitLine {
    pub id: Uuid,
    pub payer: Payer,
    pub reason: String,
    /// False when the desk assigned it.
    pub automatic: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct Split {
    /// Per-line decisions; the API sends its own fuller lines instead.
    #[serde(skip)]
    pub lines: Vec<SplitLine>,
    pub third_party_gross: Decimal,
    pub copay: Decimal,
    pub deductible: Decimal,
    pub third_party_net: Decimal,
    /// Lines the patient pays in full (non-payables and desk assignments).
    pub patient_lines: Decimal,
    /// Everything the patient pays: their lines plus co-pay and deductible.
    pub patient_total: Decimal,
}

fn matches(rule: &Rule, line: &Line) -> bool {
    let v = rule.value.trim().to_lowercase();
    if v.is_empty() {
        return false;
    }
    match rule.match_on.as_str() {
        "keyword" => line.description.to_lowercase().contains(&v),
        "category" => line
            .category
            .as_deref()
            .is_some_and(|c| c.to_lowercase() == v),
        "charge_code" => line.charge_code.to_lowercase() == v,
        _ => false,
    }
}

fn money(v: Decimal) -> Decimal {
    v.round_dp_with_strategy(2, RoundingStrategy::MidpointAwayFromZero)
}

/// Split the bill. `terms` is `None` when nobody but the patient pays.
pub fn split(lines: &[Line], rules: &[Rule], terms: Option<Terms>) -> Split {
    let mut out = Vec::with_capacity(lines.len());
    let (mut gross, mut patient_lines) = (Decimal::ZERO, Decimal::ZERO);
    for line in lines {
        let (payer, reason, automatic) = if let Some(p) = line.payer {
            (
                p,
                line.payer_reason
                    .clone()
                    .unwrap_or_else(|| "Assigned by the desk".into()),
                false,
            )
        } else if let Some(rule) = rules.iter().find(|r| matches(r, line)) {
            (Payer::Patient, rule.reason.clone(), true)
        } else if terms.is_some() {
            (Payer::ThirdParty, "Covered".into(), true)
        } else {
            (Payer::Patient, "Self-pay bill".into(), true)
        };
        // A third-party line on a self-pay bill has nobody to bill: the patient's.
        let payer = if terms.is_none() {
            Payer::Patient
        } else {
            payer
        };
        match payer {
            Payer::ThirdParty => gross += line.total,
            Payer::Patient => patient_lines += line.total,
        }
        out.push(SplitLine {
            id: line.id,
            payer,
            reason,
            automatic,
        });
    }
    let t = terms.unwrap_or_default();
    let copay = money(gross * t.copay_percent / Decimal::from(100)).min(gross);
    let deductible = money(t.deductible).min(gross - copay).max(Decimal::ZERO);
    let net = gross - copay - deductible;
    Split {
        lines: out,
        third_party_gross: gross,
        copay,
        deductible,
        third_party_net: net,
        patient_lines,
        patient_total: patient_lines + copay + deductible,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(desc: &str, total: i64) -> Line {
        Line {
            id: Uuid::new_v4(),
            description: desc.into(),
            charge_code: "X".into(),
            category: None,
            total: Decimal::from(total),
            payer: None,
            payer_reason: None,
        }
    }

    #[test]
    fn non_payables_go_to_the_patient_and_copay_comes_off_the_insurer() {
        let lines = [
            line("Room rent — semi-private", 6000),
            line("Admission kit", 500),
            line("CBC", 400),
        ];
        let s = split(
            &lines,
            &default_rules(),
            Some(Terms {
                copay_percent: Decimal::from(10),
                deductible: Decimal::from(1000),
            }),
        );
        assert_eq!(s.lines[1].payer, Payer::Patient);
        assert!(s.lines[1].reason.contains("IRDAI"));
        assert_eq!(s.third_party_gross, Decimal::from(6400));
        assert_eq!(s.copay, Decimal::from(640));
        assert_eq!(s.deductible, Decimal::from(1000));
        assert_eq!(s.third_party_net, Decimal::from(4760));
        assert_eq!(s.patient_total, Decimal::from(500 + 640 + 1000));
        assert_eq!(
            s.third_party_net + s.patient_total,
            Decimal::from(6900),
            "nothing lost or doubled"
        );
    }

    #[test]
    fn the_desk_overrides_the_list_either_way() {
        let mut kit = line("Admission kit", 500);
        kit.payer = Some(Payer::ThirdParty);
        kit.payer_reason = Some("Policy covers kit".into());
        let mut mri = line("MRI brain", 8000);
        mri.payer = Some(Payer::Patient);
        let s = split(&[kit, mri], &default_rules(), Some(Terms::default()));
        assert_eq!(
            (s.lines[0].payer, s.lines[0].automatic),
            (Payer::ThirdParty, false)
        );
        assert_eq!(s.lines[0].reason, "Policy covers kit");
        assert_eq!(s.third_party_net, Decimal::from(500));
        assert_eq!(s.patient_total, Decimal::from(8000));
    }

    #[test]
    fn a_self_pay_bill_is_all_the_patients() {
        let s = split(&[line("CBC", 400)], &default_rules(), None);
        assert_eq!(s.lines[0].payer, Payer::Patient);
        assert_eq!(s.patient_total, Decimal::from(400));
        assert_eq!(s.third_party_net, Decimal::ZERO);
    }

    #[test]
    fn a_deductible_larger_than_the_claim_cannot_go_negative() {
        let s = split(
            &[line("CBC", 400)],
            &[],
            Some(Terms {
                copay_percent: Decimal::ZERO,
                deductible: Decimal::from(5000),
            }),
        );
        assert_eq!(s.deductible, Decimal::from(400));
        assert_eq!(s.third_party_net, Decimal::ZERO);
        assert_eq!(s.patient_total, Decimal::from(400));
    }

    #[test]
    fn rules_match_by_category_and_code_too() {
        let mut l = line("Mineral water", 40);
        l.category = Some("Consumables".into());
        let by_cat = Rule {
            match_on: "category".into(),
            value: "consumables".into(),
            reason: "r".into(),
        };
        assert!(matches(&by_cat, &l));
        let by_code = Rule {
            match_on: "charge_code".into(),
            value: "x".into(),
            reason: "r".into(),
        };
        assert!(matches(&by_code, &l));
        let blank = Rule {
            match_on: "keyword".into(),
            value: " ".into(),
            reason: "r".into(),
        };
        assert!(
            !matches(&blank, &l),
            "a blank keyword must not match everything"
        );
    }
}

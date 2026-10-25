//! What we test is what ships: every drug-safety case's source is exactly
//! what production's `check_drug_safety` tool would hand the model.

use medbrains_ai_eval::{Case, default_cases_dir};
use medbrains_core::ai_drug_check::DrugCheck;
use serde_json::Value;

/// The production result with the same inputs as `source`.
fn production(source: &Value) -> Option<DrugCheck> {
    let drug = source["drug"].as_str()?.to_owned();
    let warnings: Vec<String> = source["warnings"]
        .as_array()
        .map(|w| w.iter().filter_map(Value::as_str).map(str::to_owned).collect())
        .unwrap_or_default();
    Some(match (source["checked"].as_bool()?, warnings.is_empty()) {
        (false, _) if source["notes"] == DrugCheck::failed(drug.clone()).notes.as_str() => {
            DrugCheck::failed(drug)
        }
        (false, _) => DrugCheck::no_chart(drug),
        (true, true) => DrugCheck::clear(drug),
        (true, false) => DrugCheck::flagged(drug, warnings),
    })
}

#[test]
fn drug_safety_cases_carry_the_production_shape() {
    let cases = Case::load_all(&default_cases_dir()).unwrap_or_default();
    let drug_cases: Vec<&Case> = cases
        .iter()
        .filter(|c| c.task == "check_drug_safety")
        .collect();
    assert!(drug_cases.len() >= 3, "drug-safety cases went missing");
    for case in drug_cases {
        let want = production(&case.source).map(|p| serde_json::to_value(p).unwrap_or_default());
        assert_eq!(want.as_ref(), Some(&case.source), "{}", case.id);
    }
}

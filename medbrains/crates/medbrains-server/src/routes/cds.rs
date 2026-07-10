#![allow(clippy::too_many_lines)]

//! Clinical Decision Support routes — drug interactions, critical values,
//! clinical protocols, antibiotic stewardship, pre-authorization, PG logbook.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{NaiveDate, Utc};
use medbrains_core::cds::{
    ClinicalProtocol, CoSignatureRequest, CriticalValueRule, DrugInteraction, PgLogbookEntry,
    PreAuthorizationRequest, RestrictedDrugApproval,
};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::auth::Claims,
    middleware::authorization::{require_any_permission, require_permission},
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CheckDrugInteractionsRequest {
    pub drug_names: Vec<String>,
    pub patient_id: Option<Uuid>,
    /// Per-line dose context for max-dose-per-day checking (optional —
    /// `drug_names` alone still drives the DDI + allergy checks).
    #[serde(default)]
    pub items: Vec<DoseCheckItem>,
}

#[derive(Debug, Deserialize)]
pub struct DoseCheckItem {
    pub drug_name: String,
    /// Per-dose amount as written, e.g. "500 mg".
    pub dosage: String,
    /// Frequency code, e.g. "TID" / "1-0-1".
    pub frequency: String,
    pub catalog_item_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct DoseAlert {
    pub drug_name: String,
    pub per_dose: String,
    pub doses_per_day: u32,
    pub total_per_day_label: String,
    pub max_per_day_label: String,
}

#[derive(Debug, Serialize)]
pub struct WeightDoseAlert {
    pub drug_name: String,
    /// "over" or "under" the weight-based recommendation.
    pub direction: String,
    pub prescribed_per_day_label: String,
    pub recommended_per_day_label: String,
    pub weight_kg: f64,
}

#[derive(Debug, Serialize)]
pub struct RenalDoseAlert {
    pub drug_name: String,
    pub egfr: f64,
    pub threshold: f64,
    /// Pharmacist-authored adjustment rule, e.g. "Reduce dose 50%" / "Avoid".
    pub rule: String,
}

#[derive(Debug, Serialize)]
pub struct HepaticAlert {
    pub drug_name: String,
    pub caution: String,
}

#[derive(Debug, Serialize)]
pub struct IngredientAlert {
    /// "duplicate" (same active ingredient in 2+ products) or "incompatible".
    pub kind: String,
    pub label: String,
    pub detail: String,
    pub severity: String,
}

#[derive(Debug, Serialize)]
pub struct DrugInteractionAlert {
    pub drug_a: String,
    pub drug_b: String,
    pub severity: String,
    pub description: String,
    pub management: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AllergyConflict {
    pub drug_name: String,
    pub allergen_name: String,
    pub allergy_type: String,
    pub severity: Option<String>,
    pub reaction: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PregnancyAlert {
    pub drug_name: String,
    /// US FDA pregnancy category on the catalogue (A/B/C/D/X); only D and X are flagged.
    pub pregnancy_category: String,
    /// "contraindicated" (X) | "caution" (D).
    pub severity: String,
    pub description: String,
}

/// Synthesised verdict over all detectors — the AI-pluggable conclusion seam.
#[derive(Debug, Serialize)]
pub struct ClinicalConclusion {
    /// "critical" | "warning" | "clear".
    pub severity: String,
    pub summary: String,
    pub recommendation: String,
    pub issue_count: u32,
}

#[derive(Debug, Serialize)]
pub struct DrugSafetyCheckResult {
    pub interactions: Vec<DrugInteractionAlert>,
    pub allergy_conflicts: Vec<AllergyConflict>,
    pub dose_alerts: Vec<DoseAlert>,
    pub weight_alerts: Vec<WeightDoseAlert>,
    pub renal_alerts: Vec<RenalDoseAlert>,
    pub hepatic_alerts: Vec<HepaticAlert>,
    pub ingredient_alerts: Vec<IngredientAlert>,
    pub pregnancy_alerts: Vec<PregnancyAlert>,
    pub conclusion: ClinicalConclusion,
}

/// Reach a single clinical conclusion from all detector outputs. **This is the
/// AI-pluggable seam**: a deterministic, severity-ranked synthesis today; an LLM
/// clinical reasoner can replace this one function (it has the full structured
/// safety picture) without changing any call site.
fn synthesize_conclusion(result: &DrugSafetyCheckResult) -> ClinicalConclusion {
    // (severity_rank, message) — rank 2 = critical, 1 = warning.
    let mut issues: Vec<(u8, String)> = Vec::new();
    for a in &result.allergy_conflicts {
        issues.push((2, format!("allergy: {} × {}", a.drug_name, a.allergen_name)));
    }
    for i in &result.interactions {
        if i.severity == "major" || i.severity == "contraindicated" {
            issues.push((2, format!("interaction: {} × {}", i.drug_a, i.drug_b)));
        } else {
            issues.push((1, format!("interaction: {} × {}", i.drug_a, i.drug_b)));
        }
    }
    for a in &result.ingredient_alerts {
        let rank = if a.kind == "incompatible" { 2 } else { 1 };
        issues.push((rank, a.label.clone()));
    }
    for a in &result.dose_alerts {
        issues.push((1, format!("over-max: {}", a.drug_name)));
    }
    for a in &result.weight_alerts {
        issues.push((1, format!("paeds dose: {}", a.drug_name)));
    }
    for a in &result.renal_alerts {
        issues.push((1, format!("renal: {}", a.drug_name)));
    }
    for a in &result.hepatic_alerts {
        issues.push((1, format!("hepatic: {}", a.drug_name)));
    }
    for a in &result.pregnancy_alerts {
        // Category X (contraindicated) is critical; category D is a warning.
        let rank = if a.severity == "contraindicated" { 2 } else { 1 };
        issues.push((rank, format!("pregnancy {}: {}", a.pregnancy_category, a.drug_name)));
    }

    let issue_count = issues.len() as u32;
    if issues.is_empty() {
        return ClinicalConclusion {
            severity: "clear".to_owned(),
            summary: "No safety issues detected for this order.".to_owned(),
            recommendation: "Safe to proceed.".to_owned(),
            issue_count: 0,
        };
    }
    issues.sort_by(|a, b| b.0.cmp(&a.0));
    let critical = issues.iter().filter(|i| i.0 == 2).count();
    let severity = if critical > 0 { "critical" } else { "warning" };
    let top: Vec<String> = issues.iter().take(3).map(|i| i.1.clone()).collect();
    let summary = format!(
        "{issue_count} issue(s){}: {}.",
        if critical > 0 { format!(" ({critical} critical)") } else { String::new() },
        top.join("; ")
    );
    let recommendation = if critical > 0 {
        "Review critical findings and acknowledge or change the order before signing.".to_owned()
    } else {
        "Review the advisories; proceed with monitoring if clinically appropriate.".to_owned()
    };
    ClinicalConclusion { severity: severity.to_owned(), summary, recommendation, issue_count }
}

#[derive(Debug, Deserialize)]
pub struct CreateDrugInteractionRequest {
    pub drug_a_name: String,
    pub drug_b_name: String,
    pub severity: String,
    pub description: String,
    pub mechanism: Option<String>,
    pub management: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCriticalValueRuleRequest {
    pub test_code: String,
    pub test_name: String,
    pub low_critical: Option<rust_decimal::Decimal>,
    pub high_critical: Option<rust_decimal::Decimal>,
    pub unit: Option<String>,
    pub age_min: Option<i32>,
    pub age_max: Option<i32>,
    pub gender: Option<String>,
    pub alert_message: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateClinicalProtocolRequest {
    pub name: String,
    pub code: Option<String>,
    pub category: String,
    pub description: Option<String>,
    pub trigger_conditions: Option<serde_json::Value>,
    pub steps: Option<serde_json::Value>,
    pub department_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRestrictedDrugApprovalRequest {
    pub encounter_id: Uuid,
    pub patient_id: Uuid,
    pub drug_name: String,
    pub catalog_item_id: Option<Uuid>,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct ApprovalDecisionRequest {
    pub status: String,
    pub denied_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePreAuthRequest {
    pub patient_id: Uuid,
    pub encounter_id: Uuid,
    pub insurance_provider: String,
    pub policy_number: Option<String>,
    pub procedure_codes: Option<Vec<String>>,
    pub diagnosis_codes: Option<Vec<String>>,
    pub estimated_cost: Option<rust_decimal::Decimal>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePreAuthRequest {
    pub status: Option<String>,
    pub auth_number: Option<String>,
    pub approved_amount: Option<rust_decimal::Decimal>,
    pub valid_from: Option<NaiveDate>,
    pub valid_until: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePgLogbookRequest {
    pub encounter_id: Option<Uuid>,
    pub entry_type: String,
    pub title: String,
    pub description: Option<String>,
    pub diagnosis_codes: Option<Vec<String>>,
    pub procedure_codes: Option<Vec<String>>,
    pub department_id: Option<Uuid>,
    pub supervisor_id: Option<Uuid>,
    pub entry_date: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct ListPgLogbookQuery {
    pub user_id: Option<Uuid>,
    pub supervisor_id: Option<Uuid>,
    pub pending_verification: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCoSignatureRequest {
    pub encounter_id: Uuid,
    pub order_type: String,
    pub order_id: Uuid,
    pub approver_id: Uuid,
}

#[derive(Debug, Deserialize)]
pub struct CoSignatureDecisionRequest {
    pub status: String,
    pub denied_reason: Option<String>,
}

// ══════════════════════════════════════════════════════════
//  Drug Interactions
// ══════════════════════════════════════════════════════════

/// POST /api/cds/drug-safety-check — check drug interactions + allergy conflicts
pub async fn check_drug_safety(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CheckDrugInteractionsRequest>,
) -> Result<Json<DrugSafetyCheckResult>, AppError> {
    require_permission(&claims, permissions::opd::visit::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Check drug-drug interactions for all pairs
    let interactions = interaction_alerts_for_drugs(&mut tx, claims.tenant_id, &body.drug_names).await?;

    // Check allergy conflicts
    let mut allergy_conflicts = Vec::new();
    if let Some(patient_id) = body.patient_id {
        #[derive(sqlx::FromRow)]
        struct AllergyRow {
            allergen_name: String,
            allergy_type: String,
            severity: Option<String>,
            reaction: Option<String>,
        }

        let allergies = sqlx::query_as::<_, AllergyRow>(
            "SELECT allergen_name, allergy_type::text, severity::text, reaction \
             FROM patient_allergies \
             WHERE tenant_id = $1 AND patient_id = $2 AND is_active = true \
             AND allergy_type = 'drug'",
        )
        .bind(claims.tenant_id)
        .bind(patient_id)
        .fetch_all(&mut *tx)
        .await?;

        for allergy in &allergies {
            let allergen_lower = allergy.allergen_name.to_lowercase();
            for drug in &body.drug_names {
                if drug.to_lowercase().contains(&allergen_lower)
                    || allergen_lower.contains(&drug.to_lowercase())
                {
                    allergy_conflicts.push(AllergyConflict {
                        drug_name: drug.clone(),
                        allergen_name: allergy.allergen_name.clone(),
                        allergy_type: allergy.allergy_type.clone(),
                        severity: allergy.severity.clone(),
                        reaction: allergy.reaction.clone(),
                    });
                }
            }
        }
    }

    let dose_alerts = dose_alerts_for_items(&mut tx, claims.tenant_id, &body.items).await?;

    // Paediatric weight-based (mg/kg/day) advisory — only when the patient is a
    // child with a recorded weight. Advisory only; never gates prescribing.
    let mut weight_alerts = Vec::new();
    if let Some(patient_id) = body.patient_id {
        if !body.items.is_empty() {
            if let Some((weight_kg, age_years)) =
                patient_weight_and_age(&mut tx, claims.tenant_id, patient_id).await?
            {
                if age_years < 18 && weight_kg > 0.0 {
                    weight_alerts =
                        weight_alerts_for_items(&mut tx, claims.tenant_id, &body.items, weight_kg)
                            .await?;
                }
            }
        }
    }

    // Renal (eGFR-based) + hepatic dosing advisory — pharmacist-seeded rules on
    // the catalogue. Advisory only; never gates prescribing.
    let (renal_alerts, hepatic_alerts) = if body.items.is_empty() {
        (Vec::new(), Vec::new())
    } else {
        let egfr = match body.patient_id {
            Some(pid) => patient_latest_egfr(&mut tx, claims.tenant_id, pid).await?,
            None => None,
        };
        renal_hepatic_alerts_for_items(&mut tx, claims.tenant_id, &body.items, egfr).await?
    };

    // Combination chemistry: duplicate active ingredients + incompatible pairs.
    let ingredient_alerts = ingredient_alerts_for_items(&mut tx, claims.tenant_id, &body.items).await?;

    // Pregnancy teratogenicity: category D/X products when the patient is pregnant.
    let pregnancy_alerts = match body.patient_id {
        Some(pid) if !body.items.is_empty() => {
            pregnancy_alerts_for_items(&mut tx, claims.tenant_id, pid, &body.items).await?
        }
        _ => Vec::new(),
    };

    tx.commit().await?;

    let mut result = DrugSafetyCheckResult {
        interactions,
        allergy_conflicts,
        dose_alerts,
        weight_alerts,
        renal_alerts,
        hepatic_alerts,
        ingredient_alerts,
        pregnancy_alerts,
        conclusion: ClinicalConclusion {
            severity: "clear".to_owned(),
            summary: String::new(),
            recommendation: String::new(),
            issue_count: 0,
        },
    };
    result.conclusion = synthesize_conclusion(&result);
    Ok(Json(result))
}

/// Pregnancy-category detector: when the patient has an active maternity registration (i.e. is
/// pregnant), flag any prescribed product whose catalogue FDA pregnancy category is D (evidence of
/// fetal risk) or X (contraindicated). Advisory — surfaces teratogenic risk at prescribing.
async fn pregnancy_alerts_for_items(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    items: &[DoseCheckItem],
) -> Result<Vec<PregnancyAlert>, AppError> {
    let catalog_ids: Vec<Uuid> = items.iter().filter_map(|i| i.catalog_item_id).collect();
    if catalog_ids.is_empty() {
        return Ok(Vec::new());
    }
    let pregnant: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM maternity_registrations \
         WHERE tenant_id = $1 AND patient_id = $2 AND status = 'active')",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_one(&mut **tx)
    .await?;
    if !pregnant {
        return Ok(Vec::new());
    }

    #[derive(sqlx::FromRow)]
    struct CatRow {
        id: Uuid,
        pregnancy_category: Option<String>,
    }
    let rows = sqlx::query_as::<_, CatRow>(
        "SELECT id, pregnancy_category FROM pharmacy_catalog \
         WHERE tenant_id = $1 AND id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(&catalog_ids)
    .fetch_all(&mut **tx)
    .await?;
    let id_to_cat: std::collections::HashMap<Uuid, String> = rows
        .into_iter()
        .filter_map(|r| r.pregnancy_category.map(|c| (r.id, c)))
        .collect();

    let mut alerts = Vec::new();
    for item in items {
        let Some(cat) = item.catalog_item_id.and_then(|cid| id_to_cat.get(&cid)) else {
            continue;
        };
        let (severity, description) = match cat.as_str() {
            "X" => (
                "contraindicated",
                "FDA category X — contraindicated in pregnancy; do not prescribe.",
            ),
            "D" => (
                "caution",
                "FDA category D — positive evidence of fetal risk; use only if the benefit clearly \
                 outweighs the risk and a safer alternative is unavailable.",
            ),
            _ => continue,
        };
        alerts.push(PregnancyAlert {
            drug_name: item.drug_name.clone(),
            pregnancy_category: cat.clone(),
            severity: severity.to_owned(),
            description: description.to_owned(),
        });
    }
    Ok(alerts)
}

/// Combination-chemistry detector: expand prescribed products to active
/// ingredients (global `cds_drug_ingredient`), then flag (a) the same
/// ingredient in 2+ products (additive-dose risk) and (b) known incompatible
/// ingredient pairs (`cds_ingredient_incompatibility`).
async fn ingredient_alerts_for_items(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    items: &[DoseCheckItem],
) -> Result<Vec<IngredientAlert>, AppError> {
    let catalog_ids: Vec<Uuid> = items.iter().filter_map(|i| i.catalog_item_id).collect();
    if catalog_ids.is_empty() {
        return Ok(Vec::new());
    }

    #[derive(sqlx::FromRow)]
    struct GenRow {
        id: Uuid,
        generic: Option<String>,
    }
    let gens = sqlx::query_as::<_, GenRow>(
        "SELECT id, lower(COALESCE(NULLIF(inn_name, ''), generic_name, name)) AS generic \
         FROM pharmacy_catalog WHERE tenant_id = $1 AND id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(&catalog_ids)
    .fetch_all(&mut **tx)
    .await?;
    let id_to_generic: std::collections::HashMap<Uuid, String> = gens
        .into_iter()
        .filter_map(|g| g.generic.map(|name| (g.id, name)))
        .collect();

    let generics: Vec<String> = id_to_generic.values().cloned().collect();
    #[derive(sqlx::FromRow)]
    struct IngRow {
        generic_name: String,
        ingredient: String,
    }
    let ing_rows = sqlx::query_as::<_, IngRow>(
        "SELECT generic_name, ingredient FROM cds_drug_ingredient WHERE generic_name = ANY($1)",
    )
    .bind(&generics)
    .fetch_all(&mut **tx)
    .await?;
    let mut generic_to_ings: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for r in ing_rows {
        generic_to_ings.entry(r.generic_name).or_default().push(r.ingredient);
    }

    // ingredient → distinct product names that contain it.
    let mut ing_to_drugs: std::collections::BTreeMap<String, std::collections::BTreeSet<String>> =
        std::collections::BTreeMap::new();
    for item in items {
        let Some(generic) = item.catalog_item_id.and_then(|cid| id_to_generic.get(&cid)) else {
            continue;
        };
        let ings = generic_to_ings
            .get(generic)
            .cloned()
            .unwrap_or_else(|| vec![generic.clone()]);
        for ing in ings {
            ing_to_drugs.entry(ing).or_default().insert(item.drug_name.clone());
        }
    }

    let mut alerts = Vec::new();
    for (ing, drugs) in &ing_to_drugs {
        if drugs.len() >= 2 {
            alerts.push(IngredientAlert {
                kind: "duplicate".to_owned(),
                label: ing.clone(),
                detail: format!("Same ingredient in: {}", drugs.iter().cloned().collect::<Vec<_>>().join(", ")),
                severity: "duplicate".to_owned(),
            });
        }
    }

    let all_ings: Vec<String> = ing_to_drugs.keys().cloned().collect();
    if all_ings.len() >= 2 {
        #[derive(sqlx::FromRow)]
        struct IncRow {
            ingredient_a: String,
            ingredient_b: String,
            severity: Option<String>,
            mechanism: Option<String>,
        }
        let inc = sqlx::query_as::<_, IncRow>(
            "SELECT ingredient_a, ingredient_b, severity, mechanism \
             FROM cds_ingredient_incompatibility \
             WHERE ingredient_a = ANY($1) AND ingredient_b = ANY($1)",
        )
        .bind(&all_ings)
        .fetch_all(&mut **tx)
        .await?;
        for r in inc {
            alerts.push(IngredientAlert {
                kind: "incompatible".to_owned(),
                label: format!("{} + {}", r.ingredient_a, r.ingredient_b),
                detail: r.mechanism.unwrap_or_default(),
                severity: r.severity.unwrap_or_else(|| "major".to_owned()),
            });
        }
    }
    Ok(alerts)
}

/// Latest recorded eGFR (mL/min/1.73m²) for a patient from lab results, if any.
async fn patient_latest_egfr(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<f64>, AppError> {
    let egfr = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT lr.numeric_value::float8 FROM lab_results lr \
         JOIN lab_orders lo ON lo.id = lr.order_id AND lo.tenant_id = lr.tenant_id \
         WHERE lr.tenant_id = $1 AND lo.patient_id = $2 AND lr.numeric_value IS NOT NULL \
           AND (lower(lr.parameter_name) LIKE '%egfr%' OR lower(lr.parameter_name) LIKE '%gfr%') \
         ORDER BY lr.created_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten();
    Ok(egfr)
}

/// Renal + hepatic advisories for the given lines from the catalogue rules.
async fn renal_hepatic_alerts_for_items(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    items: &[DoseCheckItem],
    egfr: Option<f64>,
) -> Result<(Vec<RenalDoseAlert>, Vec<HepaticAlert>), AppError> {
    let catalog_ids: Vec<Uuid> = items.iter().filter_map(|i| i.catalog_item_id).collect();
    if catalog_ids.is_empty() {
        return Ok((Vec::new(), Vec::new()));
    }

    #[derive(sqlx::FromRow)]
    struct RuleRow {
        id: Uuid,
        renal_adjust_egfr_threshold: Option<f64>,
        renal_adjust_rule: Option<String>,
        hepatic_caution: Option<String>,
    }
    let rows = sqlx::query_as::<_, RuleRow>(
        "SELECT pc.id, \
                COALESCE(pc.renal_adjust_egfr_threshold, ref.renal_adjust_egfr_threshold)::float8 \
                    AS renal_adjust_egfr_threshold, \
                COALESCE(pc.renal_adjust_rule, ref.renal_adjust_rule) AS renal_adjust_rule, \
                COALESCE(pc.hepatic_caution, ref.hepatic_caution) AS hepatic_caution \
         FROM pharmacy_catalog pc \
         LEFT JOIN cds_drug_reference ref ON lower(ref.generic_name) = \
             lower(COALESCE(NULLIF(pc.inn_name, ''), pc.generic_name, pc.name)) \
         WHERE pc.tenant_id = $1 AND pc.id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(&catalog_ids)
    .fetch_all(&mut **tx)
    .await?;

    let mut renal = Vec::new();
    let mut hepatic = Vec::new();
    for item in items {
        let Some(catalog_id) = item.catalog_item_id else {
            continue;
        };
        let Some(row) = rows.iter().find(|r| r.id == catalog_id) else {
            continue;
        };
        if let Some(caution) = row.hepatic_caution.as_deref().filter(|c| !c.trim().is_empty()) {
            hepatic.push(HepaticAlert {
                drug_name: item.drug_name.clone(),
                caution: caution.to_owned(),
            });
        }
        if let (Some(egfr), Some(threshold), Some(rule)) = (
            egfr,
            row.renal_adjust_egfr_threshold,
            row.renal_adjust_rule.as_deref().filter(|r| !r.trim().is_empty()),
        ) {
            if egfr < threshold {
                renal.push(RenalDoseAlert {
                    drug_name: item.drug_name.clone(),
                    egfr,
                    threshold,
                    rule: rule.to_owned(),
                });
            }
        }
    }
    Ok((renal, hepatic))
}

/// Latest recorded weight (kg) and current age (years) for a patient, when known.
async fn patient_weight_and_age(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
) -> Result<Option<(f64, i32)>, AppError> {
    let dob = sqlx::query_scalar::<_, Option<NaiveDate>>(
        "SELECT date_of_birth FROM patients WHERE tenant_id = $1 AND id = $2",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten();
    let Some(dob) = dob else {
        return Ok(None);
    };
    let age_years = i32::try_from(
        (Utc::now().date_naive().signed_duration_since(dob).num_days() / 365).max(0),
    )
    .unwrap_or(0);

    let weight = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT v.weight_kg::float8 FROM vitals v \
         JOIN encounters e ON e.id = v.encounter_id \
         WHERE v.tenant_id = $1 AND e.patient_id = $2 AND v.weight_kg IS NOT NULL \
         ORDER BY v.recorded_at DESC LIMIT 1",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?
    .flatten();

    Ok(weight.map(|w| (w, age_years)))
}

/// Weight-based (mg/kg/day) dose advisories for the given lines.
async fn weight_alerts_for_items(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    items: &[DoseCheckItem],
    weight_kg: f64,
) -> Result<Vec<WeightDoseAlert>, AppError> {
    let catalog_ids: Vec<Uuid> = items.iter().filter_map(|i| i.catalog_item_id).collect();
    if catalog_ids.is_empty() {
        return Ok(Vec::new());
    }

    #[derive(sqlx::FromRow)]
    struct PerKgRow {
        id: Uuid,
        dose_per_kg: Option<String>,
    }
    let rows = sqlx::query_as::<_, PerKgRow>(
        "SELECT pc.id, COALESCE(pc.dose_per_kg, ref.dose_per_kg) AS dose_per_kg \
         FROM pharmacy_catalog pc \
         LEFT JOIN cds_drug_reference ref ON lower(ref.generic_name) = \
             lower(COALESCE(NULLIF(pc.inn_name, ''), pc.generic_name, pc.name)) \
         WHERE pc.tenant_id = $1 AND pc.id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(&catalog_ids)
    .fetch_all(&mut **tx)
    .await?;

    let mut alerts = Vec::new();
    for item in items {
        let Some(catalog_id) = item.catalog_item_id else {
            continue;
        };
        let Some(per_kg) = rows
            .iter()
            .find(|r| r.id == catalog_id)
            .and_then(|r| r.dose_per_kg.as_deref())
        else {
            continue;
        };
        let Some(doses) = medbrains_core::mar_schedule::doses_per_day(&item.frequency) else {
            continue;
        };
        if let Some(advice) = medbrains_core::dose_safety::evaluate_weight_dose(
            &item.dosage,
            doses,
            weight_kg,
            per_kg,
        ) {
            let direction = match advice.direction {
                medbrains_core::dose_safety::DoseDirection::Over => "over",
                medbrains_core::dose_safety::DoseDirection::Under => "under",
            };
            alerts.push(WeightDoseAlert {
                drug_name: item.drug_name.clone(),
                direction: direction.to_owned(),
                prescribed_per_day_label: format!(
                    "{} {}",
                    trim_float(advice.prescribed_per_day),
                    advice.unit
                ),
                recommended_per_day_label: format!(
                    "{} {}",
                    trim_float(advice.recommended_per_day),
                    advice.unit
                ),
                weight_kg,
            });
        }
    }
    Ok(alerts)
}

/// Compute max-dose-per-day exceedances for the given prescription lines.
///
/// Looks up each line's catalogue `max_dose_per_day`, derives doses/day from
/// the frequency, and flags lines whose daily total exceeds the maximum.
/// Shared by the CDS advisory check and the prescribe-time backstop.
/// Active drug-drug interaction alerts for the given drug names (both members
/// of the pair must be present). Shared by the CDS safety-check endpoint and
/// the prescribing backstop in `opd::create_prescription`.
pub async fn interaction_alerts_for_drugs(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    drug_names: &[String],
) -> Result<Vec<DrugInteractionAlert>, AppError> {
    let lowered: Vec<String> = drug_names.iter().map(|n| n.to_lowercase()).collect();
    if lowered.len() < 2 {
        return Ok(Vec::new());
    }

    let rows = sqlx::query_as::<_, DrugInteraction>(
        "SELECT * FROM drug_interactions \
         WHERE tenant_id = $1 AND is_active = true \
         AND (lower(drug_a_name) = ANY($2) OR lower(drug_b_name) = ANY($2))",
    )
    .bind(tenant_id)
    .bind(&lowered)
    .fetch_all(&mut **tx)
    .await?;

    let mut alerts = Vec::new();
    for row in &rows {
        let a_lower = row.drug_a_name.to_lowercase();
        let b_lower = row.drug_b_name.to_lowercase();
        if lowered.contains(&a_lower) && lowered.contains(&b_lower) {
            alerts.push(DrugInteractionAlert {
                drug_a: row.drug_a_name.clone(),
                drug_b: row.drug_b_name.clone(),
                severity: row.severity.clone(),
                description: row.description.clone(),
                management: row.management.clone(),
            });
        }
    }
    Ok(alerts)
}

pub async fn dose_alerts_for_items(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    items: &[DoseCheckItem],
) -> Result<Vec<DoseAlert>, AppError> {
    let catalog_ids: Vec<Uuid> = items.iter().filter_map(|i| i.catalog_item_id).collect();
    if catalog_ids.is_empty() {
        return Ok(Vec::new());
    }

    #[derive(sqlx::FromRow)]
    struct MaxDoseRow {
        id: Uuid,
        max_dose_per_day: Option<String>,
    }
    let rows = sqlx::query_as::<_, MaxDoseRow>(
        "SELECT pc.id, COALESCE(pc.max_dose_per_day, ref.max_dose_per_day) AS max_dose_per_day \
         FROM pharmacy_catalog pc \
         LEFT JOIN cds_drug_reference ref ON lower(ref.generic_name) = \
             lower(COALESCE(NULLIF(pc.inn_name, ''), pc.generic_name, pc.name)) \
         WHERE pc.tenant_id = $1 AND pc.id = ANY($2)",
    )
    .bind(tenant_id)
    .bind(&catalog_ids)
    .fetch_all(&mut **tx)
    .await?;

    let mut alerts = Vec::new();
    for item in items {
        let Some(catalog_id) = item.catalog_item_id else {
            continue;
        };
        let Some(max_raw) = rows
            .iter()
            .find(|r| r.id == catalog_id)
            .and_then(|r| r.max_dose_per_day.as_deref())
        else {
            continue;
        };
        let Some(doses) = medbrains_core::mar_schedule::doses_per_day(&item.frequency) else {
            continue;
        };
        if let Some(hit) =
            medbrains_core::dose_safety::evaluate_max_dose(&item.dosage, doses, max_raw)
        {
            alerts.push(DoseAlert {
                drug_name: item.drug_name.clone(),
                per_dose: item.dosage.clone(),
                doses_per_day: doses,
                total_per_day_label: format!("{} {}", trim_float(hit.total_per_day), hit.unit),
                max_per_day_label: format!("{} {}", trim_float(hit.max_per_day), hit.unit),
            });
        }
    }
    Ok(alerts)
}

/// Render a dose value without a trailing `.0` for whole numbers.
fn trim_float(value: f64) -> String {
    if (value.fract()).abs() < f64::EPSILON {
        format!("{value:.0}")
    } else {
        format!("{value}")
    }
}

/// GET /api/cds/drug-interactions — list all drug interactions
pub async fn list_drug_interactions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DrugInteraction>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::queue::VIEW,
            permissions::admin::settings::general::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DrugInteraction>(
        "SELECT * FROM drug_interactions \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY drug_a_name, drug_b_name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/cds/drug-interactions — create a drug interaction rule
pub async fn create_drug_interaction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDrugInteractionRequest>,
) -> Result<Json<DrugInteraction>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DrugInteraction>(
        "INSERT INTO drug_interactions \
         (tenant_id, drug_a_name, drug_b_name, severity, description, mechanism, management) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.drug_a_name)
    .bind(&body.drug_b_name)
    .bind(&body.severity)
    .bind(&body.description)
    .bind(body.mechanism.as_deref())
    .bind(body.management.as_deref())
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// DELETE /api/cds/drug-interactions/{id}
pub async fn delete_drug_interaction(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DrugInteraction>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, DrugInteraction>(
        "UPDATE drug_interactions SET is_active = false, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND is_active = true RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ══════════════════════════════════════════════════════════
//  Critical Value Rules
// ══════════════════════════════════════════════════════════

/// GET /api/cds/critical-value-rules
pub async fn list_critical_value_rules(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CriticalValueRule>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::queue::VIEW,
            permissions::admin::settings::general::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CriticalValueRule>(
        "SELECT * FROM critical_value_rules \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY test_name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/cds/critical-value-rules
pub async fn create_critical_value_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCriticalValueRuleRequest>,
) -> Result<Json<CriticalValueRule>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CriticalValueRule>(
        "INSERT INTO critical_value_rules \
         (tenant_id, test_code, test_name, low_critical, high_critical, unit, \
          age_min, age_max, gender, alert_message) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.test_code)
    .bind(&body.test_name)
    .bind(body.low_critical)
    .bind(body.high_critical)
    .bind(body.unit.as_deref())
    .bind(body.age_min)
    .bind(body.age_max)
    .bind(body.gender.as_deref())
    .bind(&body.alert_message)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// DELETE /api/cds/critical-value-rules/{id}
pub async fn delete_critical_value_rule(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<CriticalValueRule>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CriticalValueRule>(
        "UPDATE critical_value_rules SET is_active = false, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND is_active = true RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ══════════════════════════════════════════════════════════
//  Clinical Protocols
// ══════════════════════════════════════════════════════════

/// GET /api/cds/protocols
pub async fn list_protocols(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<ClinicalProtocol>>, AppError> {
    require_any_permission(
        &claims,
        &[
            permissions::opd::queue::VIEW,
            permissions::admin::settings::general::MANAGE,
        ],
    )?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ClinicalProtocol>(
        "SELECT * FROM clinical_protocols \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY category, name LIMIT 5000",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/cds/protocols
pub async fn create_protocol(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateClinicalProtocolRequest>,
) -> Result<Json<ClinicalProtocol>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let trigger = body
        .trigger_conditions
        .as_ref()
        .map_or_else(|| serde_json::json!([]), Clone::clone);
    let steps = body
        .steps
        .as_ref()
        .map_or_else(|| serde_json::json!([]), Clone::clone);

    let row = sqlx::query_as::<_, ClinicalProtocol>(
        "INSERT INTO clinical_protocols \
         (tenant_id, name, code, category, description, trigger_conditions, steps, \
          department_id, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(&body.name)
    .bind(body.code.as_deref())
    .bind(&body.category)
    .bind(body.description.as_deref())
    .bind(&trigger)
    .bind(&steps)
    .bind(body.department_id)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// DELETE /api/cds/protocols/{id}
pub async fn delete_protocol(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<ClinicalProtocol>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, ClinicalProtocol>(
        "UPDATE clinical_protocols SET is_active = false, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND is_active = true RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ══════════════════════════════════════════════════════════
//  Restricted Drug Approvals (Antibiotic Stewardship)
// ══════════════════════════════════════════════════════════

/// GET /api/cds/restricted-drug-approvals
pub async fn list_restricted_drug_approvals(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<RestrictedDrugApproval>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, RestrictedDrugApproval>(
        "SELECT * FROM restricted_drug_approvals \
         WHERE tenant_id = $1 \
         ORDER BY created_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/cds/restricted-drug-approvals
pub async fn create_restricted_drug_approval(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateRestrictedDrugApprovalRequest>,
) -> Result<Json<RestrictedDrugApproval>, AppError> {
    require_permission(&claims, permissions::opd::visit::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, RestrictedDrugApproval>(
        "INSERT INTO restricted_drug_approvals \
         (tenant_id, encounter_id, patient_id, drug_name, catalog_item_id, reason, requested_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .bind(body.patient_id)
    .bind(&body.drug_name)
    .bind(body.catalog_item_id)
    .bind(&body.reason)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// PUT /api/cds/restricted-drug-approvals/{id}
pub async fn update_restricted_drug_approval(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ApprovalDecisionRequest>,
) -> Result<Json<RestrictedDrugApproval>, AppError> {
    require_permission(&claims, permissions::admin::settings::general::MANAGE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let approved_at = if body.status == "approved" {
        Some(Utc::now())
    } else {
        None
    };

    let row = sqlx::query_as::<_, RestrictedDrugApproval>(
        "UPDATE restricted_drug_approvals \
         SET status = $3, approved_by = $4, approved_at = $5, denied_reason = $6, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND status = 'pending' RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(claims.sub)
    .bind(approved_at)
    .bind(body.denied_reason.as_deref())
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ══════════════════════════════════════════════════════════
//  Pre-Authorization Requests
// ══════════════════════════════════════════════════════════

fn trimmed_optional(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_owned())
        .filter(|item| !item.is_empty())
}

fn normalized_code_list(values: Option<Vec<String>>) -> Vec<String> {
    values
        .unwrap_or_default()
        .into_iter()
        .map(|item| item.trim().to_owned())
        .filter(|item| !item.is_empty())
        .collect()
}

fn normalized_pre_auth_status(status: Option<String>) -> Result<Option<String>, AppError> {
    let Some(status) = trimmed_optional(status) else {
        return Ok(None);
    };
    match status.as_str() {
        "pending" | "submitted" | "approved" | "denied" | "expired" => Ok(Some(status)),
        _ => Err(AppError::BadRequest(
            "invalid pre-authorization status".to_owned(),
        )),
    }
}

/// GET /api/cds/pre-auth-requests?patient_id=...
pub async fn list_pre_auth_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<PreAuthorizationRequest>>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::LIST)?;
    let patient_filter = q
        .get("patient_id")
        .map(|value| {
            require_permission(&claims, permissions::patients::VIEW)?;
            value
                .parse::<Uuid>()
                .map_err(|_| AppError::BadRequest("invalid patient id".to_owned()))
        })
        .transpose()?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(pid) = patient_filter {
        sqlx::query_as::<_, PreAuthorizationRequest>(
            "SELECT * FROM pre_authorization_requests \
             WHERE tenant_id = $1 AND patient_id = $2 \
             ORDER BY created_at DESC LIMIT 5000",
        )
        .bind(claims.tenant_id)
        .bind(pid)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, PreAuthorizationRequest>(
            "SELECT * FROM pre_authorization_requests \
             WHERE tenant_id = $1 \
             ORDER BY created_at DESC LIMIT 100",
        )
        .bind(claims.tenant_id)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/cds/pre-auth-requests
pub async fn create_pre_auth_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePreAuthRequest>,
) -> Result<Json<PreAuthorizationRequest>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::CREATE)?;
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let insurance_provider = body.insurance_provider.trim().to_owned();
    if insurance_provider.len() < 2 {
        return Err(AppError::BadRequest(
            "insurance provider is required".to_owned(),
        ));
    }
    if matches!(body.estimated_cost, Some(amount) if amount < rust_decimal::Decimal::ZERO) {
        return Err(AppError::BadRequest(
            "estimated cost cannot be negative".to_owned(),
        ));
    }

    let context_exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS( \
             SELECT 1 FROM encounters \
             WHERE tenant_id = $1 AND id = $2 AND patient_id = $3 \
         )",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .bind(body.patient_id)
    .fetch_one(&mut *tx)
    .await?;

    if !context_exists {
        return Err(AppError::BadRequest(
            "pre-authorization encounter does not match patient".to_owned(),
        ));
    }

    let proc_codes = normalized_code_list(body.procedure_codes);
    let diag_codes = normalized_code_list(body.diagnosis_codes);
    let policy_number = trimmed_optional(body.policy_number);
    let notes = trimmed_optional(body.notes);

    let row = sqlx::query_as::<_, PreAuthorizationRequest>(
        "INSERT INTO pre_authorization_requests \
         (tenant_id, patient_id, encounter_id, insurance_provider, policy_number, \
          procedure_codes, diagnosis_codes, estimated_cost, notes, submitted_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(&insurance_provider)
    .bind(policy_number.as_deref())
    .bind(&proc_codes)
    .bind(&diag_codes)
    .bind(body.estimated_cost)
    .bind(notes.as_deref())
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// PUT /api/cds/pre-auth-requests/{id}
pub async fn update_pre_auth_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePreAuthRequest>,
) -> Result<Json<PreAuthorizationRequest>, AppError> {
    require_permission(&claims, permissions::insurance::prior_auth::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let status = normalized_pre_auth_status(body.status)?;
    if matches!(status.as_deref(), Some("submitted")) {
        require_permission(&claims, permissions::insurance::prior_auth::SUBMIT)?;
    }
    if matches!(body.approved_amount, Some(amount) if amount < rust_decimal::Decimal::ZERO) {
        return Err(AppError::BadRequest(
            "approved amount cannot be negative".to_owned(),
        ));
    }
    if let (Some(valid_from), Some(valid_until)) = (body.valid_from, body.valid_until) {
        if valid_from > valid_until {
            return Err(AppError::BadRequest(
                "valid from cannot be after valid until".to_owned(),
            ));
        }
    }

    let auth_number = trimmed_optional(body.auth_number);
    let notes = trimmed_optional(body.notes);
    let reviewed_at = if status.is_some() {
        Some(Utc::now())
    } else {
        None
    };

    let row = sqlx::query_as::<_, PreAuthorizationRequest>(
        "UPDATE pre_authorization_requests SET \
         status = COALESCE($3, status), auth_number = COALESCE($4, auth_number), \
         approved_amount = COALESCE($5, approved_amount), valid_from = COALESCE($6, valid_from), \
         valid_until = COALESCE($7, valid_until), notes = COALESCE($8, notes), \
         reviewed_at = COALESCE($9, reviewed_at), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(status.as_deref())
    .bind(auth_number.as_deref())
    .bind(body.approved_amount)
    .bind(body.valid_from)
    .bind(body.valid_until)
    .bind(notes.as_deref())
    .bind(reviewed_at)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ══════════════════════════════════════════════════════════
//  PG Logbook
// ══════════════════════════════════════════════════════════

/// GET /api/cds/pg-logbook
pub async fn list_pg_logbook(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListPgLogbookQuery>,
) -> Result<Json<Vec<PgLogbookEntry>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(supervisor_id) = q.supervisor_id {
        if q.pending_verification.unwrap_or(false) {
            sqlx::query_as::<_, PgLogbookEntry>(
                "SELECT * FROM pg_logbook_entries \
                 WHERE tenant_id = $1 AND supervisor_id = $2 AND supervisor_verified = false \
                 ORDER BY entry_date DESC LIMIT 100",
            )
            .bind(claims.tenant_id)
            .bind(supervisor_id)
            .fetch_all(&mut *tx)
            .await?
        } else {
            sqlx::query_as::<_, PgLogbookEntry>(
                "SELECT * FROM pg_logbook_entries \
                 WHERE tenant_id = $1 AND supervisor_id = $2 \
                 ORDER BY entry_date DESC LIMIT 100",
            )
            .bind(claims.tenant_id)
            .bind(supervisor_id)
            .fetch_all(&mut *tx)
            .await?
        }
    } else if let Some(user_id) = q.user_id {
        sqlx::query_as::<_, PgLogbookEntry>(
            "SELECT * FROM pg_logbook_entries \
             WHERE tenant_id = $1 AND user_id = $2 \
             ORDER BY entry_date DESC LIMIT 100",
        )
        .bind(claims.tenant_id)
        .bind(user_id)
        .fetch_all(&mut *tx)
        .await?
    } else {
        sqlx::query_as::<_, PgLogbookEntry>(
            "SELECT * FROM pg_logbook_entries \
             WHERE tenant_id = $1 AND user_id = $2 \
             ORDER BY entry_date DESC LIMIT 100",
        )
        .bind(claims.tenant_id)
        .bind(claims.sub)
        .fetch_all(&mut *tx)
        .await?
    };

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/cds/pg-logbook
pub async fn create_pg_logbook_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePgLogbookRequest>,
) -> Result<Json<PgLogbookEntry>, AppError> {
    require_permission(&claims, permissions::opd::visit::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let diag_codes = body.diagnosis_codes.unwrap_or_default();
    let proc_codes = body.procedure_codes.unwrap_or_default();
    let entry_date = body.entry_date.unwrap_or_else(|| Utc::now().date_naive());

    let row = sqlx::query_as::<_, PgLogbookEntry>(
        "INSERT INTO pg_logbook_entries \
         (tenant_id, user_id, encounter_id, entry_type, title, description, \
          diagnosis_codes, procedure_codes, department_id, supervisor_id, entry_date) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .bind(body.encounter_id)
    .bind(&body.entry_type)
    .bind(&body.title)
    .bind(body.description.as_deref())
    .bind(&diag_codes)
    .bind(&proc_codes)
    .bind(body.department_id)
    .bind(body.supervisor_id)
    .bind(entry_date)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// PUT /api/cds/pg-logbook/{id}/verify
pub async fn verify_pg_logbook_entry(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PgLogbookEntry>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, PgLogbookEntry>(
        "UPDATE pg_logbook_entries \
         SET supervisor_verified = true, verified_at = now(), updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND supervisor_id = $3 AND supervisor_verified = false \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

// ══════════════════════════════════════════════════════════
//  Co-Signature Requests
// ══════════════════════════════════════════════════════════

/// GET /api/cds/co-signatures?approver_id=...
pub async fn list_co_signatures(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<CoSignatureRequest>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CoSignatureRequest>(
        "SELECT * FROM co_signature_requests \
         WHERE tenant_id = $1 AND (approver_id = $2 OR requested_by = $2) \
         ORDER BY created_at DESC LIMIT 100",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/cds/co-signatures
pub async fn create_co_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateCoSignatureRequest>,
) -> Result<Json<CoSignatureRequest>, AppError> {
    require_permission(&claims, permissions::opd::visit::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as::<_, CoSignatureRequest>(
        "INSERT INTO co_signature_requests \
         (tenant_id, encounter_id, order_type, order_id, requested_by, approver_id) \
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.encounter_id)
    .bind(&body.order_type)
    .bind(body.order_id)
    .bind(claims.sub)
    .bind(body.approver_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

/// PUT /api/cds/co-signatures/{id}
pub async fn update_co_signature(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<CoSignatureDecisionRequest>,
) -> Result<Json<CoSignatureRequest>, AppError> {
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let approved_at = if body.status == "approved" {
        Some(Utc::now())
    } else {
        None
    };

    let row = sqlx::query_as::<_, CoSignatureRequest>(
        "UPDATE co_signature_requests \
         SET status = $3, approved_at = $4, denied_reason = $5, updated_at = now() \
         WHERE id = $1 AND tenant_id = $2 AND approver_id = $6 AND status = 'pending' \
         RETURNING *",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .bind(&body.status)
    .bind(approved_at)
    .bind(body.denied_reason.as_deref())
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

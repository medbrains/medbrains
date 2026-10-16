//! The pharmacist's medication-safety gate, run when a prescription is reviewed
//! and again when an order is dispensed.
//!
//! Four checks, each against data the hospital already records:
//! - a documented drug allergy, including a cross-reactive class
//!   (`patient_allergies`, via `medbrains_core::allergy`);
//! - a drug–drug interaction between this order and the patient's other active
//!   medicines (`drug_interactions`, via the CDS engine prescribing uses);
//! - a WHO AWaRe Reserve antibiotic with no approved antimicrobial stewardship
//!   request for this patient (`antibiotic_stewardship_requests`);
//! - a medicine that is not on the hospital formulary
//!   (`pharmacy_catalog.formulary_status`).
//!
//! A blocking finding stops the action unless someone holding that finding's
//! override permission records a reason. Every outcome — refused, overridden or
//! warned — is written to `cpoe_safety_audit`. A check is only ever recorded as
//! done by the code that ran it.

use std::collections::{HashMap, HashSet};

use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::is_bypass_role;
use medbrains_server_core::state::AppState;
use serde_json::json;
use sqlx::{Postgres, Transaction};
use uuid::Uuid;

use crate::{
    MedicationSafetySeverity, MedicationSafetyWarning, drug_allergy_conflicts,
    record_cpoe_safety_audit_in_tx, warning_detail,
};

pub const ALLERGY: &str = "DRUG_ALLERGY_CONFLICT";
pub const INTERACTION: &str = "DRUG_INTERACTION";
pub const RESERVE_ANTIBIOTIC: &str = "RESERVE_ANTIBIOTIC_APPROVAL_REQUIRED";
pub const NON_FORMULARY: &str = "NON_FORMULARY_APPROVAL_REQUIRED";

/// Shortest override reason `cpoe_safety_audit` accepts (its CHECK constraint).
const MIN_REASON_CHARS: usize = 5;
/// The most of the patient's other order lines compared for interactions.
const ACTIVE_MED_LIMIT: i64 = 200;

/// One medicine on the prescription or order being checked.
#[derive(Debug, Clone)]
pub struct RxLine {
    pub drug_name: String,
    pub catalog_item_id: Option<Uuid>,
}

/// Whose record a check is about, and which record it is filed against.
#[derive(Debug, Clone, Copy)]
pub struct Subject {
    pub patient_id: Uuid,
    pub encounter_id: Option<Uuid>,
    pub record_id: Option<Uuid>,
}

/// The permission that lets a pharmacist proceed past a blocking finding.
pub fn override_permission(code: &str) -> &'static str {
    match code {
        RESERVE_ANTIBIOTIC => permissions::pharmacy::stewardship::APPROVE,
        NON_FORMULARY => permissions::pharmacy::formulary::APPROVE,
        _ => permissions::pharmacy::safety::OVERRIDE,
    }
}

fn holds(claims: &Claims, permission: &str) -> bool {
    is_bypass_role(claims) || claims.permissions.iter().any(|p| p == permission)
}

/// Whether `claims` may override a blocking finding with this code.
pub fn can_override(claims: &Claims, code: &str) -> bool {
    holds(claims, override_permission(code))
}

/// A line resolved to its catalogue row, with this patient's stewardship
/// request for it when it is a Reserve antibiotic.
#[derive(Debug, sqlx::FromRow)]
struct LinePolicyRow {
    idx: i64,
    catalog_item_id: Uuid,
    name: String,
    generic_name: Option<String>,
    inn_name: Option<String>,
    formulary_status: String,
    aware_category: Option<String>,
    stewardship_status: Option<String>,
}

impl LinePolicyRow {
    /// The active ingredient a stewardship request names.
    fn ingredient(&self) -> &str {
        [self.inn_name.as_deref(), self.generic_name.as_deref()]
            .into_iter()
            .flatten()
            .map(str::trim)
            .find(|s| !s.is_empty())
            .unwrap_or(self.name.as_str())
    }
}

/// Resolve every line to its catalogue row in one round trip — by id first,
/// then by brand or generic name, as the review screen matches them — and
/// attach the best live stewardship request (approved over pending) for
/// Reserve antibiotics. A line with no catalogue row is simply absent.
async fn resolve_lines(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Option<Uuid>,
    lines: &[RxLine],
) -> Result<Vec<LinePolicyRow>, AppError> {
    let names: Vec<String> = lines.iter().map(|l| l.drug_name.clone()).collect();
    let ids: Vec<Option<Uuid>> = lines.iter().map(|l| l.catalog_item_id).collect();
    let rows = sqlx::query_as::<_, LinePolicyRow>(
        "SELECT l.idx, r.id AS catalog_item_id, r.name, r.generic_name, r.inn_name, \
                r.formulary_status, r.aware_category, s.request_status AS stewardship_status \
           FROM unnest($2::text[], $3::uuid[]) WITH ORDINALITY AS l(drug_name, catalog_id, idx) \
           JOIN LATERAL ( \
                SELECT c.id, c.name, c.generic_name, c.inn_name, c.formulary_status, c.aware_category \
                  FROM pharmacy_catalog c \
                 WHERE c.tenant_id = $1 AND c.deleted_at IS NULL \
                   AND (c.id = l.catalog_id OR lower(c.name) = lower(l.drug_name) \
                        OR lower(c.generic_name) = lower(l.drug_name)) \
                 ORDER BY (c.id = l.catalog_id) DESC NULLS LAST, \
                          (lower(c.name) = lower(l.drug_name)) DESC, c.name \
                 LIMIT 1) r ON true \
           LEFT JOIN LATERAL ( \
                SELECT s.request_status::text AS request_status \
                  FROM antibiotic_stewardship_requests s \
                 WHERE r.aware_category = 'reserve' \
                   AND s.tenant_id = $1 AND s.patient_id = $4 AND s.deleted_at IS NULL \
                   AND s.request_status IN ('approved', 'pending') \
                   AND (s.auto_stop_date IS NULL OR s.auto_stop_date >= CURRENT_DATE) \
                   AND (lower(s.antibiotic_name) IN \
                            (lower(r.name), lower(r.generic_name), lower(r.inn_name)) \
                        OR strpos(lower(s.antibiotic_name), lower(COALESCE( \
                            NULLIF(r.inn_name, ''), NULLIF(r.generic_name, ''), r.name))) > 0) \
                 ORDER BY (s.request_status = 'approved') DESC, s.requested_at DESC \
                 LIMIT 1) s ON true \
          ORDER BY l.idx",
    )
    .bind(tenant_id)
    .bind(&names)
    .bind(&ids)
    .bind(patient_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows)
}

fn line_for<'a>(lines: &'a [RxLine], row: &LinePolicyRow) -> Option<&'a RxLine> {
    usize::try_from(row.idx - 1).ok().and_then(|i| lines.get(i))
}

fn block(
    code: &str,
    line: &RxLine,
    catalog_item_id: Option<Uuid>,
    message: String,
) -> MedicationSafetyWarning {
    MedicationSafetyWarning {
        code: code.to_owned(),
        severity: MedicationSafetySeverity::Block,
        message,
        catalog_item_id,
        drug_name: line.drug_name.clone(),
        detail: json!({}),
    }
}

/// Stewardship and formulary findings for resolved lines. Pure: the rule
/// lives here, the data comes from `resolve_lines`.
fn policy_findings(lines: &[RxLine], rows: &[LinePolicyRow]) -> Vec<MedicationSafetyWarning> {
    let mut out = Vec::new();
    for row in rows {
        let Some(line) = line_for(lines, row) else {
            continue;
        };
        let reserve = row.aware_category.as_deref() == Some("reserve");
        if reserve && row.stewardship_status.as_deref() != Some("approved") {
            let message = if row.stewardship_status.as_deref() == Some("pending") {
                format!(
                    "{} is an AWaRe Reserve antibiotic and its stewardship request is still \
                     awaiting approval",
                    line.drug_name
                )
            } else {
                format!(
                    "{} is an AWaRe Reserve antibiotic with no approved antimicrobial \
                     stewardship request for this patient",
                    line.drug_name
                )
            };
            let mut finding = block(RESERVE_ANTIBIOTIC, line, Some(row.catalog_item_id), message);
            finding.detail = warning_detail(vec![
                ("request_status", json!(row.stewardship_status)),
                ("ingredient", json!(row.ingredient())),
                (
                    "override_permission",
                    json!(override_permission(RESERVE_ANTIBIOTIC)),
                ),
            ]);
            out.push(finding);
        }
        if row.formulary_status == "non_formulary" {
            let message = format!("{} is not on the hospital formulary", line.drug_name);
            let mut finding = block(NON_FORMULARY, line, Some(row.catalog_item_id), message);
            finding.detail = warning_detail(vec![
                ("formulary_status", json!(row.formulary_status)),
                (
                    "override_permission",
                    json!(override_permission(NON_FORMULARY)),
                ),
            ]);
            out.push(finding);
        }
    }
    out
}

/// AWaRe Reserve and non-formulary findings only — what the prescriber must
/// answer for at the moment of prescribing.
pub async fn policy_findings_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    lines: &[RxLine],
) -> Result<Vec<MedicationSafetyWarning>, AppError> {
    let rows = resolve_lines(tx, tenant_id, Some(patient_id), lines).await?;
    Ok(policy_findings(lines, &rows))
}

/// Every lowercased name a line goes by (as written, catalogue name, generic,
/// INN), mapped back to the line as written.
fn own_names(lines: &[RxLine], rows: &[LinePolicyRow]) -> HashMap<String, String> {
    let mut names = HashMap::new();
    for line in lines {
        names.insert(line.drug_name.trim().to_lowercase(), line.drug_name.clone());
    }
    for row in rows {
        let Some(line) = line_for(lines, row) else {
            continue;
        };
        for name in [
            Some(row.name.as_str()),
            row.generic_name.as_deref(),
            row.inn_name.as_deref(),
        ]
        .into_iter()
        .flatten()
        .map(|n| n.trim().to_lowercase())
        .filter(|n| !n.is_empty())
        {
            names.entry(name).or_insert_with(|| line.drug_name.clone());
        }
    }
    names
}

/// Names of what else the patient is on: their other pharmacy orders of the
/// last 30 days that are open or were handed over.
// ponytail: 30-day window as in check_drug_interactions; per-course end dates if it matters
async fn other_active_med_names(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Option<Uuid>,
    exclude_order_id: Option<Uuid>,
) -> Result<Vec<String>, AppError> {
    let rows = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
        "SELECT oi.drug_name, c.generic_name, c.inn_name \
           FROM pharmacy_orders o \
           JOIN pharmacy_order_items oi ON oi.order_id = o.id AND oi.tenant_id = o.tenant_id \
            AND oi.removed_at IS NULL AND oi.deleted_at IS NULL \
           LEFT JOIN pharmacy_catalog c ON c.id = oi.catalog_item_id AND c.tenant_id = oi.tenant_id \
          WHERE o.tenant_id = $1 AND o.patient_id = $2 AND o.deleted_at IS NULL \
            AND o.status IN ('ordered', 'partially_dispensed', 'dispensed') \
            AND o.created_at >= now() - interval '30 days' \
            AND o.id IS DISTINCT FROM $3 \
          ORDER BY o.created_at DESC \
          LIMIT $4",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(exclude_order_id)
    .bind(ACTIVE_MED_LIMIT)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .flat_map(|(name, generic, inn)| [Some(name), generic, inn])
        .flatten()
        .map(|n| n.trim().to_lowercase())
        .filter(|n| !n.is_empty())
        .collect())
}

fn interaction_findings(
    alerts: &[medbrains_telehealth::cds::DrugInteractionAlert],
    own: &HashMap<String, String>,
) -> Vec<MedicationSafetyWarning> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for alert in alerts {
        let (a, b) = (alert.drug_a.to_lowercase(), alert.drug_b.to_lowercase());
        // A pair between two of the patient's other medicines is not this
        // order's to answer for.
        let Some(line_name) = own.get(&a).or_else(|| own.get(&b)) else {
            continue;
        };
        let pair = if a <= b { (a, b) } else { (b, a) };
        if !seen.insert(pair) {
            continue;
        }
        let serious = matches!(alert.severity.as_str(), "major" | "contraindicated");
        out.push(MedicationSafetyWarning {
            code: INTERACTION.to_owned(),
            severity: if serious {
                MedicationSafetySeverity::Block
            } else {
                MedicationSafetySeverity::Warn
            },
            message: format!(
                "{} × {} — {} interaction: {}",
                alert.drug_a, alert.drug_b, alert.severity, alert.description
            ),
            catalog_item_id: None,
            drug_name: line_name.clone(),
            detail: warning_detail(vec![
                ("drug_a", json!(alert.drug_a)),
                ("drug_b", json!(alert.drug_b)),
                ("severity", json!(alert.severity)),
                ("management", json!(alert.management)),
                (
                    "override_permission",
                    json!(override_permission(INTERACTION)),
                ),
            ]),
        });
    }
    out
}

fn allergy_findings(
    conflicts: &[medbrains_core::allergy::DrugAllergyConflict],
    own: &HashMap<String, String>,
) -> Vec<MedicationSafetyWarning> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for c in conflicts {
        let line_name = own
            .get(&c.drug_name.trim().to_lowercase())
            .cloned()
            .unwrap_or_else(|| c.drug_name.clone());
        if !seen.insert((line_name.to_lowercase(), c.allergen.to_lowercase())) {
            continue;
        }
        let cross = if c.kind == medbrains_core::allergy::AllergyMatchKind::CrossReactive {
            format!(
                " (cross-reactive {})",
                c.class.as_deref().unwrap_or("class")
            )
        } else {
            String::new()
        };
        out.push(MedicationSafetyWarning {
            code: ALLERGY.to_owned(),
            severity: MedicationSafetySeverity::Block,
            message: format!("{line_name} — documented allergy to {}{cross}", c.allergen),
            catalog_item_id: None,
            drug_name: line_name,
            detail: warning_detail(vec![
                ("allergen", json!(c.allergen)),
                ("override_permission", json!(override_permission(ALLERGY))),
            ]),
        });
    }
    out
}

/// Run all four checks for `lines`. `exclude_order_id` is the order being
/// dispensed, so it is not compared against itself. With no patient (a walk-in
/// counter sale) only what the lines themselves carry can be checked: the
/// interactions among them, Reserve status and formulary status.
pub async fn check_rx_lines_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Option<Uuid>,
    lines: &[RxLine],
    exclude_order_id: Option<Uuid>,
) -> Result<Vec<MedicationSafetyWarning>, AppError> {
    if lines.is_empty() {
        return Ok(Vec::new());
    }
    let rows = resolve_lines(tx, tenant_id, patient_id, lines).await?;
    let own = own_names(lines, &rows);
    let own_list: Vec<String> = own.keys().cloned().collect();

    let conflicts = match patient_id {
        Some(patient_id) => drug_allergy_conflicts(tx, tenant_id, patient_id, &own_list).await?,
        None => Vec::new(),
    };

    let mut all_names: HashSet<String> = own.keys().cloned().collect();
    all_names.extend(other_active_med_names(tx, tenant_id, patient_id, exclude_order_id).await?);
    let all_names: Vec<String> = all_names.into_iter().collect();
    let alerts =
        medbrains_telehealth::cds::interaction_alerts_for_drugs(tx, tenant_id, &all_names).await?;

    let mut findings = allergy_findings(&conflicts, &own);
    findings.extend(interaction_findings(&alerts, &own));
    findings.extend(policy_findings(lines, &rows));
    Ok(findings)
}

/// Drop findings already overridden, with a reason, against this order — at
/// review or when the order was raised — so a pharmacist is not asked twice for
/// the same thing. A finding that has changed (a new interacting medicine, a
/// request now denied) reads differently and is asked again.
pub async fn drop_already_overridden_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    order_id: Uuid,
    mut findings: Vec<MedicationSafetyWarning>,
) -> Result<Vec<MedicationSafetyWarning>, AppError> {
    let done: HashSet<(String, String)> = sqlx::query_as::<_, (String, String)>(
        "SELECT warning_code, message FROM cpoe_safety_audit \
          WHERE tenant_id = $1 AND source_module = 'pharmacy' AND source_record_id = $2 \
            AND action_taken = 'overridden' AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(order_id)
    .fetch_all(&mut **tx)
    .await?
    .into_iter()
    .collect();
    findings.retain(|f| !done.contains(&(f.code.clone(), f.message.clone())));
    Ok(findings)
}

/// May `claims` proceed past `findings`? Returns the override reason to file
/// when a block is being overridden. Refuses with 409 when a block has no
/// reason, and 403 when the reason comes from someone without the right to
/// override that kind of finding.
pub fn authorize<'a>(
    claims: &Claims,
    findings: &[MedicationSafetyWarning],
    reason: Option<&'a str>,
) -> Result<Option<&'a str>, AppError> {
    let blocks: Vec<&MedicationSafetyWarning> = findings
        .iter()
        .filter(|f| f.severity == MedicationSafetySeverity::Block)
        .collect();
    if blocks.is_empty() {
        return Ok(None);
    }
    let summary = blocks
        .iter()
        .map(|b| b.message.as_str())
        .collect::<Vec<_>>()
        .join("; ");
    let Some(reason) = reason
        .map(str::trim)
        .filter(|r| r.chars().count() >= MIN_REASON_CHARS)
    else {
        return Err(AppError::Conflict(format!(
            "Medication safety check: {summary}. Put the prescription on hold and contact the \
             prescriber, or, if you hold override rights, record a clinical reason (at least \
             {MIN_REASON_CHARS} characters) to proceed."
        )));
    };
    let mut missing: Vec<&str> = blocks
        .iter()
        .map(|b| override_permission(&b.code))
        .filter(|p| !holds(claims, p))
        .collect();
    missing.sort_unstable();
    missing.dedup();
    if !missing.is_empty() {
        return Err(AppError::ForbiddenReason(format!(
            "Overriding this needs the {} permission: {summary}",
            missing.join(", ")
        )));
    }
    Ok(Some(reason))
}

/// `authorize`, filing a refusal as `blocked` in its own transaction — the
/// caller's transaction rolls back with the refusal and would take the audit
/// row with it.
pub async fn enforce<'a>(
    state: &AppState,
    claims: &Claims,
    subject: &Subject,
    findings: &[MedicationSafetyWarning],
    reason: Option<&'a str>,
) -> Result<Option<&'a str>, AppError> {
    match authorize(claims, findings, reason) {
        Ok(reason) => Ok(reason),
        Err(refusal) => {
            if let Err(audit_error) = audit_refusal(state, claims, subject, findings).await {
                // The refusal still stands; losing its audit row must not turn
                // a safety message into a generic server error.
                tracing::error!(
                    error = %audit_error,
                    patient_id = %subject.patient_id,
                    "could not file a refused medication-safety override"
                );
            }
            Err(refusal)
        }
    }
}

async fn audit_refusal(
    state: &AppState,
    claims: &Claims,
    subject: &Subject,
    findings: &[MedicationSafetyWarning],
) -> Result<(), AppError> {
    let blocks: Vec<MedicationSafetyWarning> = findings
        .iter()
        .filter(|f| f.severity == MedicationSafetySeverity::Block)
        .cloned()
        .collect();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    record_cpoe_safety_audit_in_tx(
        &mut tx,
        claims,
        subject.patient_id,
        subject.encounter_id,
        "pharmacy",
        subject.record_id,
        &blocks,
        None,
    )
    .await?;
    tx.commit().await?;
    Ok(())
}

/// One release of medicine to a patient about to happen.
#[derive(Debug, Clone, Copy)]
pub struct Release<'a> {
    /// `None` for a walk-in counter sale.
    pub patient_id: Option<Uuid>,
    pub encounter_id: Option<Uuid>,
    /// The order the release is filed against. Overrides already given for it
    /// — at review, or when it was raised — are not asked for again.
    pub order_id: Option<Uuid>,
    pub lines: &'a [RxLine],
    pub override_reason: Option<&'a str>,
}

/// The gate every path that releases medicine goes through — dispense, the
/// pick of a pack-and-collect order, discharge, OTC and POS sales. Allergy is
/// left to each path's own allergy gate and log; everything else is checked,
/// refused or overridden by the same rules, and filed.
pub async fn gate_release_in_tx(
    state: &AppState,
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    release: &Release<'_>,
) -> Result<(), AppError> {
    let mut findings = check_rx_lines_in_tx(
        tx,
        claims.tenant_id,
        release.patient_id,
        release.lines,
        release.order_id,
    )
    .await?;
    findings.retain(|f| f.code != ALLERGY);
    if let Some(order_id) = release.order_id {
        findings = drop_already_overridden_in_tx(tx, claims.tenant_id, order_id, findings).await?;
    }
    let Some(patient_id) = release.patient_id else {
        return refuse_walk_in(&findings);
    };
    let subject = Subject {
        patient_id,
        encounter_id: release.encounter_id,
        record_id: release.order_id,
    };
    let reason = enforce(state, claims, &subject, &findings, release.override_reason).await?;
    record_in_tx(tx, claims, &subject, &findings, reason).await
}

/// An override is filed against a patient; a walk-in sale has none, so a
/// blocking finding there cannot be overridden at all.
fn refuse_walk_in(findings: &[MedicationSafetyWarning]) -> Result<(), AppError> {
    let blocks: Vec<&str> = findings
        .iter()
        .filter(|f| f.severity == MedicationSafetySeverity::Block)
        .map(|f| f.message.as_str())
        .collect();
    if blocks.is_empty() {
        return Ok(());
    }
    Err(AppError::Conflict(format!(
        "Medication safety check on a walk-in sale — {}. It cannot be overridden — sell it against a \
         registered patient so the check and any override are on their record.",
        blocks.join("; ")
    )))
}

/// File what the check found and what the pharmacist did about it.
pub async fn record_in_tx(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
    subject: &Subject,
    findings: &[MedicationSafetyWarning],
    override_reason: Option<&str>,
) -> Result<(), AppError> {
    record_cpoe_safety_audit_in_tx(
        tx,
        claims,
        subject.patient_id,
        subject.encounter_id,
        "pharmacy",
        subject.record_id,
        findings,
        override_reason,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn claims_with(permissions: &[&str]) -> Claims {
        Claims {
            sub: Uuid::nil(),
            tenant_id: Uuid::nil(),
            role: "pharmacist".to_owned(),
            permissions: permissions.iter().map(|p| (*p).to_owned()).collect(),
            department_ids: Vec::new(),
            perm_version: 0,
            paired_device_id: None,
            exp: 0,
        }
    }

    fn finding(code: &str, severity: MedicationSafetySeverity) -> MedicationSafetyWarning {
        MedicationSafetyWarning {
            code: code.to_owned(),
            severity,
            message: format!("{code} hit"),
            catalog_item_id: None,
            drug_name: "Drug".to_owned(),
            detail: json!({}),
        }
    }

    #[test]
    fn warnings_alone_never_stop_the_pharmacist() {
        let claims = claims_with(&[]);
        let findings = [finding(INTERACTION, MedicationSafetySeverity::Warn)];
        assert!(matches!(authorize(&claims, &findings, None), Ok(None)));
    }

    #[test]
    fn a_block_without_a_reason_is_refused_even_for_an_override_holder() {
        let claims = claims_with(&[permissions::pharmacy::safety::OVERRIDE]);
        let findings = [finding(INTERACTION, MedicationSafetySeverity::Block)];
        assert!(matches!(
            authorize(&claims, &findings, Some("  ok ")),
            Err(AppError::Conflict(_))
        ));
    }

    #[test]
    fn each_kind_of_block_needs_its_own_override_right() {
        let findings = [
            finding(INTERACTION, MedicationSafetySeverity::Block),
            finding(RESERVE_ANTIBIOTIC, MedicationSafetySeverity::Block),
        ];
        let safety_only = claims_with(&[permissions::pharmacy::safety::OVERRIDE]);
        assert!(matches!(
            authorize(&safety_only, &findings, Some("septic shock, ID consulted")),
            Err(AppError::ForbiddenReason(_))
        ));
        let both = claims_with(&[
            permissions::pharmacy::safety::OVERRIDE,
            permissions::pharmacy::stewardship::APPROVE,
        ]);
        assert!(matches!(
            authorize(&both, &findings, Some("septic shock, ID consulted")),
            Ok(Some("septic shock, ID consulted"))
        ));
    }

    #[test]
    fn non_formulary_is_overridden_by_formulary_approval() {
        assert_eq!(
            override_permission(NON_FORMULARY),
            permissions::pharmacy::formulary::APPROVE
        );
        assert_eq!(
            override_permission(ALLERGY),
            permissions::pharmacy::safety::OVERRIDE
        );
    }
}

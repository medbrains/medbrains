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
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CheckDrugInteractionsRequest {
    pub drug_names: Vec<String>,
    pub patient_id: Option<Uuid>,
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
pub struct DrugSafetyCheckResult {
    pub interactions: Vec<DrugInteractionAlert>,
    pub allergy_conflicts: Vec<AllergyConflict>,
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
    let mut interactions = Vec::new();
    let drug_names: Vec<String> = body.drug_names.iter().map(|n| n.to_lowercase()).collect();

    if drug_names.len() > 1 {
        let rows = sqlx::query_as::<_, DrugInteraction>(
            "SELECT * FROM drug_interactions \
             WHERE tenant_id = $1 AND is_active = true \
             AND (lower(drug_a_name) = ANY($2) OR lower(drug_b_name) = ANY($2))",
        )
        .bind(claims.tenant_id)
        .bind(&drug_names)
        .fetch_all(&mut *tx)
        .await?;

        for row in &rows {
            let a_lower = row.drug_a_name.to_lowercase();
            let b_lower = row.drug_b_name.to_lowercase();
            if drug_names.contains(&a_lower) && drug_names.contains(&b_lower) {
                interactions.push(DrugInteractionAlert {
                    drug_a: row.drug_a_name.clone(),
                    drug_b: row.drug_b_name.clone(),
                    severity: row.severity.clone(),
                    description: row.description.clone(),
                    management: row.management.clone(),
                });
            }
        }
    }

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

    tx.commit().await?;

    Ok(Json(DrugSafetyCheckResult {
        interactions,
        allergy_conflicts,
    }))
}

/// GET /api/cds/drug-interactions — list all drug interactions
pub async fn list_drug_interactions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<DrugInteraction>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, DrugInteraction>(
        "SELECT * FROM drug_interactions \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY drug_a_name, drug_b_name",
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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, CriticalValueRule>(
        "SELECT * FROM critical_value_rules \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY test_name",
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
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, ClinicalProtocol>(
        "SELECT * FROM clinical_protocols \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY category, name",
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

/// GET /api/cds/pre-auth-requests?patient_id=...
pub async fn list_pre_auth_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Vec<PreAuthorizationRequest>>, AppError> {
    require_permission(&claims, permissions::opd::queue::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = if let Some(pid) = q.get("patient_id").and_then(|v| v.parse::<Uuid>().ok()) {
        sqlx::query_as::<_, PreAuthorizationRequest>(
            "SELECT * FROM pre_authorization_requests \
             WHERE tenant_id = $1 AND patient_id = $2 \
             ORDER BY created_at DESC",
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
    require_permission(&claims, permissions::opd::visit::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let proc_codes = body.procedure_codes.unwrap_or_default();
    let diag_codes = body.diagnosis_codes.unwrap_or_default();

    let row = sqlx::query_as::<_, PreAuthorizationRequest>(
        "INSERT INTO pre_authorization_requests \
         (tenant_id, patient_id, encounter_id, insurance_provider, policy_number, \
          procedure_codes, diagnosis_codes, estimated_cost, notes, submitted_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.patient_id)
    .bind(body.encounter_id)
    .bind(&body.insurance_provider)
    .bind(body.policy_number.as_deref())
    .bind(&proc_codes)
    .bind(&diag_codes)
    .bind(body.estimated_cost)
    .bind(body.notes.as_deref())
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
    require_permission(&claims, permissions::opd::visit::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let reviewed_at = if body.status.is_some() {
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
    .bind(body.status.as_deref())
    .bind(body.auth_number.as_deref())
    .bind(body.approved_amount)
    .bind(body.valid_from)
    .bind(body.valid_until)
    .bind(body.notes.as_deref())
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

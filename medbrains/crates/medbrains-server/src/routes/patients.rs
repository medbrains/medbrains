#![allow(clippy::too_many_lines)]

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use chrono::{DateTime, NaiveDate, Utc};
use medbrains_core::billing::InvoiceStatus;
use medbrains_core::encounter::{EncounterStatus, EncounterType};
use medbrains_core::lab::LabOrderStatus;
use medbrains_core::patient::{
    AddressType, AllergySeverity, AllergyType, BloodGroup, ConsentCaptureMode, ConsentStatus,
    ConsentType, FinancialClass, Gender, IdentifierType, MaritalStatus, MasterOccupation,
    MasterRelation, MasterReligion, Patient, PatientAddress, PatientAllergy, PatientCategory,
    PatientConsent, PatientContact, PatientDocument, PatientFamilyLink, PatientIdentifier,
    PatientInsurance, PatientMergeHistory, RegistrationSource, RegistrationType,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::{auth::Claims, authorization::require_permission, field_access},
    state::AppState,
    validation::{self, ValidationErrors},
};

// ══════════════════════════════════════════════════════════
//  Query / Request / Response types — Patients
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ListPatientsQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub search: Option<String>,
    pub category: Option<String>,
    pub financial_class: Option<String>,
    pub is_vip: Option<bool>,
    pub is_medico_legal: Option<bool>,
    pub is_active: Option<bool>,
    pub blood_group: Option<String>,
    pub registration_type: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PatientListResponse {
    pub patients: Vec<Patient>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CreatePatientRequest {
    // ── Name ──
    pub prefix: Option<String>,
    pub first_name: String,
    pub middle_name: Option<String>,
    pub last_name: String,
    pub suffix: Option<String>,

    // ── Family ──
    pub father_name: Option<String>,
    pub guardian_name: Option<String>,
    pub guardian_relation: Option<String>,

    // ── Demographics ──
    pub date_of_birth: Option<NaiveDate>,
    pub is_dob_estimated: Option<bool>,
    pub gender: Gender,
    pub marital_status: Option<MaritalStatus>,
    pub religion: Option<String>,
    pub nationality_id: Option<Uuid>,
    pub preferred_language: Option<String>,

    // ── Clinical ──
    pub blood_group: Option<BloodGroup>,

    // ── Socioeconomic ──
    pub occupation: Option<String>,

    // ── Contact ──
    pub phone: String,
    pub phone_secondary: Option<String>,
    pub email: Option<String>,

    // ── Legacy JSON address ──
    pub address: Option<serde_json::Value>,

    // ── Registration metadata ──
    pub category: Option<PatientCategory>,
    pub registration_type: Option<RegistrationType>,
    pub registration_source: Option<RegistrationSource>,
    pub financial_class: Option<FinancialClass>,

    // ── MLC ──
    pub is_medico_legal: Option<bool>,
    pub mlc_number: Option<String>,

    // ── Special flags ──
    pub is_vip: Option<bool>,
    pub is_unknown_patient: Option<bool>,

    // ── Extensible ──
    pub attributes: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpdatePatientRequest {
    // ── Name ──
    pub prefix: Option<String>,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub suffix: Option<String>,

    // ── Family ──
    pub father_name: Option<String>,
    pub guardian_name: Option<String>,
    pub guardian_relation: Option<String>,

    // ── Demographics ──
    pub date_of_birth: Option<NaiveDate>,
    pub is_dob_estimated: Option<bool>,
    pub gender: Option<Gender>,
    pub marital_status: Option<MaritalStatus>,
    pub religion: Option<String>,
    pub nationality_id: Option<Uuid>,
    pub preferred_language: Option<String>,

    // ── Clinical ──
    pub blood_group: Option<BloodGroup>,

    // ── Socioeconomic ──
    pub occupation: Option<String>,

    // ── Contact ──
    pub phone: Option<String>,
    pub phone_secondary: Option<String>,
    pub email: Option<String>,

    // ── Legacy JSON address ──
    pub address: Option<serde_json::Value>,

    // ── Registration metadata ──
    pub category: Option<PatientCategory>,
    pub registration_type: Option<RegistrationType>,
    pub registration_source: Option<RegistrationSource>,
    pub financial_class: Option<FinancialClass>,

    // ── MLC ──
    pub is_medico_legal: Option<bool>,
    pub mlc_number: Option<String>,

    // ── Special flags ──
    pub is_vip: Option<bool>,
    pub is_unknown_patient: Option<bool>,

    // ── Extensible ──
    pub attributes: Option<serde_json::Value>,

    // ── Lifecycle ──
    pub is_active: Option<bool>,
}

// ══════════════════════════════════════════════════════════
//  Sub-resource request types
// ══════════════════════════════════════════════════════════

// ── Identifiers ──

#[derive(Debug, Deserialize)]
pub struct CreateIdentifierRequest {
    pub id_type: IdentifierType,
    pub id_number: String,
    pub id_number_hash: Option<String>,
    pub issuing_authority: Option<String>,
    pub issuing_country_id: Option<Uuid>,
    pub valid_from: Option<NaiveDate>,
    pub valid_until: Option<NaiveDate>,
    pub is_verified: Option<bool>,
    pub document_url: Option<String>,
    pub is_primary: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateIdentifierRequest {
    pub id_type: Option<IdentifierType>,
    pub id_number: Option<String>,
    pub id_number_hash: Option<String>,
    pub issuing_authority: Option<String>,
    pub issuing_country_id: Option<Uuid>,
    pub valid_from: Option<NaiveDate>,
    pub valid_until: Option<NaiveDate>,
    pub is_verified: Option<bool>,
    pub document_url: Option<String>,
    pub is_primary: Option<bool>,
}

// ── Addresses ──

#[derive(Debug, Deserialize)]
pub struct CreateAddressRequest {
    pub address_type: AddressType,
    pub address_line1: String,
    pub address_line2: Option<String>,
    pub village_town: Option<String>,
    pub city: String,
    pub district_id: Option<Uuid>,
    pub state_id: Option<Uuid>,
    pub country_id: Uuid,
    pub postal_code: String,
    pub latitude: Option<Decimal>,
    pub longitude: Option<Decimal>,
    pub is_primary: Option<bool>,
    pub valid_from: Option<NaiveDate>,
    pub valid_until: Option<NaiveDate>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAddressRequest {
    pub address_type: Option<AddressType>,
    pub address_line1: Option<String>,
    pub address_line2: Option<String>,
    pub village_town: Option<String>,
    pub city: Option<String>,
    pub district_id: Option<Uuid>,
    pub state_id: Option<Uuid>,
    pub country_id: Option<Uuid>,
    pub postal_code: Option<String>,
    pub latitude: Option<Decimal>,
    pub longitude: Option<Decimal>,
    pub is_primary: Option<bool>,
    pub valid_from: Option<NaiveDate>,
    pub valid_until: Option<NaiveDate>,
}

// ── Contacts ──

#[derive(Debug, Deserialize)]
pub struct CreateContactRequest {
    pub contact_name: String,
    pub relation: String,
    pub phone: String,
    pub phone_alt: Option<String>,
    pub email: Option<String>,
    pub address: Option<serde_json::Value>,
    pub is_emergency_contact: Option<bool>,
    pub is_next_of_kin: Option<bool>,
    pub is_legal_guardian: Option<bool>,
    pub priority: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateContactRequest {
    pub contact_name: Option<String>,
    pub relation: Option<String>,
    pub phone: Option<String>,
    pub phone_alt: Option<String>,
    pub email: Option<String>,
    pub address: Option<serde_json::Value>,
    pub is_emergency_contact: Option<bool>,
    pub is_next_of_kin: Option<bool>,
    pub is_legal_guardian: Option<bool>,
    pub priority: Option<i32>,
}

// ── Insurance ──

#[derive(Debug, Deserialize)]
pub struct CreateInsuranceRequest {
    pub insurance_provider: String,
    pub policy_number: String,
    pub group_number: Option<String>,
    pub member_id: Option<String>,
    pub plan_name: Option<String>,
    pub policy_holder_name: Option<String>,
    pub policy_holder_relation: Option<String>,
    pub valid_from: NaiveDate,
    pub valid_until: NaiveDate,
    pub sum_insured: Option<Decimal>,
    pub tpa_name: Option<String>,
    pub tpa_id: Option<String>,
    pub coverage_type: Option<String>,
    pub priority: Option<i32>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInsuranceRequest {
    pub insurance_provider: Option<String>,
    pub policy_number: Option<String>,
    pub group_number: Option<String>,
    pub member_id: Option<String>,
    pub plan_name: Option<String>,
    pub policy_holder_name: Option<String>,
    pub policy_holder_relation: Option<String>,
    pub valid_from: Option<NaiveDate>,
    pub valid_until: Option<NaiveDate>,
    pub sum_insured: Option<Decimal>,
    pub tpa_name: Option<String>,
    pub tpa_id: Option<String>,
    pub coverage_type: Option<String>,
    pub priority: Option<i32>,
    pub is_active: Option<bool>,
}

// ── Allergies ──

#[derive(Debug, Deserialize)]
pub struct CreateAllergyRequest {
    pub allergy_type: AllergyType,
    pub allergen_name: String,
    pub allergen_code: Option<String>,
    pub reaction: Option<String>,
    pub severity: Option<AllergySeverity>,
    pub onset_date: Option<NaiveDate>,
    pub reported_by: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAllergyRequest {
    pub allergy_type: Option<AllergyType>,
    pub allergen_name: Option<String>,
    pub allergen_code: Option<String>,
    pub reaction: Option<String>,
    pub severity: Option<AllergySeverity>,
    pub onset_date: Option<NaiveDate>,
    pub reported_by: Option<String>,
    pub is_active: Option<bool>,
}

// ── Consents ──

#[derive(Debug, Deserialize)]
pub struct CreateConsentRequest {
    pub consent_type: ConsentType,
    pub consent_status: ConsentStatus,
    pub consent_date: Option<DateTime<Utc>>,
    pub consent_version: Option<String>,
    pub consented_by: String,
    pub consented_by_relation: Option<String>,
    pub witness_name: Option<String>,
    pub capture_mode: ConsentCaptureMode,
    pub document_url: Option<String>,
    pub valid_until: Option<NaiveDate>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateConsentRequest {
    pub consent_status: Option<ConsentStatus>,
    pub consent_version: Option<String>,
    pub consented_by: Option<String>,
    pub consented_by_relation: Option<String>,
    pub witness_name: Option<String>,
    pub capture_mode: Option<ConsentCaptureMode>,
    pub document_url: Option<String>,
    pub valid_until: Option<NaiveDate>,
    pub notes: Option<String>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revoked_reason: Option<String>,
}

// ── MPI Match ──

#[derive(Debug, Deserialize)]
pub struct MatchRequest {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub date_of_birth: Option<NaiveDate>,
    pub phone: Option<String>,
    pub identifier_hash: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MatchResult {
    pub id: Uuid,
    pub uhid: String,
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: Option<NaiveDate>,
    pub phone: String,
    pub gender: Gender,
    pub score: f64,
}

// ══════════════════════════════════════════════════════════
//  UHID generation
// ══════════════════════════════════════════════════════════

#[derive(Debug, sqlx::FromRow)]
struct SequenceResult {
    current_val: i64,
    prefix: String,
    pad_width: i32,
}

async fn generate_uhid(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let seq = sqlx::query_as!(
        SequenceResult,
        "UPDATE sequences SET current_val = current_val + 1 \
         WHERE tenant_id = $1 AND seq_type = 'UHID' \
         RETURNING current_val, prefix, pad_width",
        tenant_id,
    )
    .fetch_optional(&mut **tx)
    .await?;

    let seq = seq.ok_or_else(|| {
        AppError::Internal("UHID sequence not configured for this tenant".to_owned())
    })?;

    let pad = usize::try_from(seq.pad_width).unwrap_or(5);
    Ok(format!("{}{:0>pad$}", seq.prefix, seq.current_val))
}

// ══════════════════════════════════════════════════════════
//  Helper: convert optional enum to its serde string form
// ══════════════════════════════════════════════════════════

fn enum_to_str<T: Serialize>(val: &T) -> String {
    serde_json::to_value(val)
        .ok()
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_default()
}

// ══════════════════════════════════════════════════════════
//  GET /api/patients
// ══════════════════════════════════════════════════════════

pub async fn list_patients(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListPatientsQuery>,
) -> Result<Json<PatientListResponse>, AppError> {
    require_permission(&claims, permissions::patients::LIST)?;
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * per_page;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Build dynamic WHERE conditions
    let mut conditions = vec!["tenant_id = $1".to_owned()];
    let mut bind_idx: usize = 2;

    // We collect bind values as strings/bools to apply later via a
    // single dynamic query. For simplicity, we build the SQL string and
    // use sqlx::query_as with runtime binds.
    #[allow(clippy::items_after_statements)]
    struct BindVal {
        string_val: Option<String>,
        bool_val: Option<bool>,
    }
    let mut binds: Vec<BindVal> = Vec::new();

    if let Some(ref search) = params.search {
        let pattern = format!("%{search}%");
        conditions.push(format!(
            "(uhid ILIKE ${bind_idx} OR first_name ILIKE ${bind_idx} \
             OR last_name ILIKE ${bind_idx} OR phone ILIKE ${bind_idx})"
        ));
        binds.push(BindVal {
            string_val: Some(pattern),
            bool_val: None,
        });
        bind_idx += 1;
    }

    if let Some(ref category) = params.category {
        conditions.push(format!("category::text = ${bind_idx}"));
        binds.push(BindVal {
            string_val: Some(category.clone()),
            bool_val: None,
        });
        bind_idx += 1;
    }

    if let Some(ref fc) = params.financial_class {
        conditions.push(format!("financial_class::text = ${bind_idx}"));
        binds.push(BindVal {
            string_val: Some(fc.clone()),
            bool_val: None,
        });
        bind_idx += 1;
    }

    if let Some(ref bg) = params.blood_group {
        conditions.push(format!("blood_group::text = ${bind_idx}"));
        binds.push(BindVal {
            string_val: Some(bg.clone()),
            bool_val: None,
        });
        bind_idx += 1;
    }

    if let Some(ref rt) = params.registration_type {
        conditions.push(format!("registration_type::text = ${bind_idx}"));
        binds.push(BindVal {
            string_val: Some(rt.clone()),
            bool_val: None,
        });
        bind_idx += 1;
    }

    if let Some(is_vip) = params.is_vip {
        conditions.push(format!("is_vip = ${bind_idx}"));
        binds.push(BindVal {
            string_val: None,
            bool_val: Some(is_vip),
        });
        bind_idx += 1;
    }

    if let Some(is_mlc) = params.is_medico_legal {
        conditions.push(format!("is_medico_legal = ${bind_idx}"));
        binds.push(BindVal {
            string_val: None,
            bool_val: Some(is_mlc),
        });
        bind_idx += 1;
    }

    if let Some(is_active) = params.is_active {
        conditions.push(format!("is_active = ${bind_idx}"));
        binds.push(BindVal {
            string_val: None,
            bool_val: Some(is_active),
        });
        bind_idx += 1;
    }

    let where_clause = conditions.join(" AND ");

    // Count query
    let count_sql = format!("SELECT COUNT(*) FROM patients WHERE {where_clause}");
    let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(ref s) = b.string_val {
            count_query = count_query.bind(s.clone());
        }
        if let Some(bv) = b.bool_val {
            count_query = count_query.bind(bv);
        }
    }
    let total: i64 = count_query.fetch_one(&mut *tx).await?;

    // Data query
    let data_sql = format!(
        "SELECT * FROM patients WHERE {where_clause} \
         ORDER BY created_at DESC LIMIT ${bind_idx} OFFSET ${}",
        bind_idx + 1
    );
    let mut data_query = sqlx::query_as::<_, Patient>(&data_sql).bind(claims.tenant_id);
    for b in &binds {
        if let Some(ref s) = b.string_val {
            data_query = data_query.bind(s.clone());
        }
        if let Some(bv) = b.bool_val {
            data_query = data_query.bind(bv);
        }
    }
    let patients = data_query
        .bind(per_page)
        .bind(offset)
        .fetch_all(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(PatientListResponse {
        patients,
        total,
        page,
        per_page,
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/patients
// ══════════════════════════════════════════════════════════

pub async fn create_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePatientRequest>,
) -> Result<Json<Patient>, AppError> {
    require_permission(&claims, permissions::patients::CREATE)?;

    // Validate field-level write access
    let restricted = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    let body_json = serde_json::to_value(&body)
        .map_err(|e| AppError::Internal(format!("serialize error: {e}")))?;
    field_access::validate_write_access(&body_json, &restricted, "patients")?;

    let mut errors = ValidationErrors::new();
    validation::validate_name(&mut errors, "first_name", &body.first_name);
    validation::validate_name(&mut errors, "last_name", &body.last_name);
    validation::validate_optional_phone(&mut errors, "phone", &body.phone);
    if let Some(ref email) = body.email {
        validation::validate_optional_email(&mut errors, "email", email);
    }
    if let Some(ref phone2) = body.phone_secondary {
        validation::validate_optional_phone(&mut errors, "phone_secondary", phone2);
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let category = body.category.unwrap_or(PatientCategory::General);
    let reg_type = body.registration_type.unwrap_or(RegistrationType::New);
    let fin_class = body.financial_class.unwrap_or(FinancialClass::SelfPay);
    let is_dob_estimated = body.is_dob_estimated.unwrap_or(false);
    let is_medico_legal = body.is_medico_legal.unwrap_or(false);
    let is_vip = body.is_vip.unwrap_or(false);
    let is_unknown_patient = body.is_unknown_patient.unwrap_or(false);
    let attributes = body
        .attributes
        .clone()
        .unwrap_or_else(|| serde_json::json!({}));
    let address = body.address.clone();

    // Cast enums to strings for SQL binding
    let gender_str = enum_to_str(&body.gender);
    let category_str = enum_to_str(&category);
    let reg_type_str = enum_to_str(&reg_type);
    let fin_class_str = enum_to_str(&fin_class);
    let marital_str = body.marital_status.map(|m| enum_to_str(&m));
    let blood_str = body.blood_group.map(|b| enum_to_str(&b));
    let reg_source_str = body.registration_source.map(|s| enum_to_str(&s));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let uhid = generate_uhid(&mut tx, &claims.tenant_id).await?;

    let patient = sqlx::query_as_unchecked!(
        Patient,
        r#"INSERT INTO patients
           (tenant_id, uhid, prefix, first_name, middle_name, last_name, suffix,
            father_name, guardian_name, guardian_relation,
            date_of_birth, is_dob_estimated, gender, marital_status,
            religion, nationality_id, preferred_language,
            blood_group, occupation,
            phone, phone_secondary, email, address,
            category, registration_type, registration_source, financial_class,
            is_medico_legal, mlc_number, is_vip, is_unknown_patient,
            attributes, created_by, registered_by, registered_at_facility)
           VALUES ($1, $2, $3, $4, $5, $6, $7,
                   $8, $9, $10,
                   $11, $12, $13::gender, $14::marital_status,
                   $15, $16, $17,
                   $18::blood_group, $19,
                   $20, $21, $22, $23,
                   $24::patient_category, $25::registration_type,
                   $26::registration_source, $27::financial_class,
                   $28, $29, $30, $31,
                   $32, $33, $33, NULL)
           RETURNING id, tenant_id, uhid, abha_id, prefix, first_name, middle_name, last_name, suffix,
                     full_name_local, father_name, mother_name, spouse_name, guardian_name,
                     guardian_relation, date_of_birth, is_dob_estimated, gender, gender_identity,
                     marital_status, religion, nationality_id, preferred_language, birth_place,
                     blood_group, blood_group_verified, no_known_allergies, occupation,
                     education_level, phone, phone_secondary, email, preferred_contact_method,
                     address, category, registration_type, registration_source, registered_by,
                     registered_at_facility, financial_class, is_medico_legal, mlc_number,
                     is_unknown_patient, temporary_name, is_vip, is_deceased, deceased_date,
                     photo_url, photo_captured_at, data_quality_score, last_visit_date, total_visits,
                     is_merged, merged_into_patient_id, source_system, legacy_id, attributes,
                     is_active, created_by, created_at, updated_at"#,
        claims.tenant_id,
        &uhid,
        &body.prefix,
        &body.first_name,
        &body.middle_name,
        &body.last_name,
        &body.suffix,
        &body.father_name,
        &body.guardian_name,
        &body.guardian_relation,
        body.date_of_birth,
        is_dob_estimated,
        &gender_str,
        &marital_str,
        &body.religion,
        body.nationality_id,
        &body.preferred_language,
        &blood_str,
        &body.occupation,
        &body.phone,
        &body.phone_secondary,
        &body.email,
        &address,
        &category_str,
        &reg_type_str,
        &reg_source_str,
        &fin_class_str,
        is_medico_legal,
        &body.mlc_number,
        is_vip,
        is_unknown_patient,
        &attributes,
        claims.sub,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    // Emit integration event
    let _ = crate::events::emit_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "patient.registered",
        serde_json::json!({
            "patient_id": patient.id,
            "uhid": patient.uhid,
        }),
    )
    .await;

    Ok(Json(patient))
}

// ══════════════════════════════════════════════════════════
//  GET /api/patients/{id}
// ══════════════════════════════════════════════════════════

pub async fn get_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<Patient>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let patient = sqlx::query_as_unchecked!(
        Patient,
        r#"SELECT id, tenant_id, uhid, abha_id, prefix, first_name, middle_name, last_name, suffix,
                  full_name_local, father_name, mother_name, spouse_name, guardian_name,
                  guardian_relation, date_of_birth, is_dob_estimated, gender, gender_identity,
                  marital_status, religion, nationality_id, preferred_language, birth_place,
                  blood_group, blood_group_verified, no_known_allergies, occupation,
                  education_level, phone, phone_secondary, email, preferred_contact_method,
                  address, category, registration_type, registration_source, registered_by,
                  registered_at_facility, financial_class, is_medico_legal, mlc_number,
                  is_unknown_patient, temporary_name, is_vip, is_deceased, deceased_date,
                  photo_url, photo_captured_at, data_quality_score, last_visit_date, total_visits,
                  is_merged, merged_into_patient_id, source_system, legacy_id, attributes,
                  is_active, created_by, created_at, updated_at
           FROM patients
           WHERE id = $1 AND tenant_id = $2"#,
        id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    patient.map_or_else(|| Err(AppError::NotFound), |p| Ok(Json(p)))
}

// ══════════════════════════════════════════════════════════
//  PUT /api/patients/{id}
// ══════════════════════════════════════════════════════════

pub async fn update_patient(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePatientRequest>,
) -> Result<Json<Patient>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    // Validate field-level write access
    let restricted = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    let body_json = serde_json::to_value(&body)
        .map_err(|e| AppError::Internal(format!("serialize error: {e}")))?;
    field_access::validate_write_access(&body_json, &restricted, "patients")?;

    let mut errors = ValidationErrors::new();
    if let Some(ref first_name) = body.first_name {
        validation::validate_name(&mut errors, "first_name", first_name);
    }
    if let Some(ref last_name) = body.last_name {
        validation::validate_name(&mut errors, "last_name", last_name);
    }
    if let Some(ref phone) = body.phone {
        validation::validate_optional_phone(&mut errors, "phone", phone);
    }
    if let Some(ref email) = body.email {
        validation::validate_optional_email(&mut errors, "email", email);
    }
    if let Some(ref phone2) = body.phone_secondary {
        validation::validate_optional_phone(&mut errors, "phone_secondary", phone2);
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Cast optional enums to text for COALESCE, then cast back
    let gender_str = body.gender.map(|g| enum_to_str(&g));
    let category_str = body.category.map(|c| enum_to_str(&c));
    let marital_str = body.marital_status.map(|m| enum_to_str(&m));
    let blood_str = body.blood_group.map(|b| enum_to_str(&b));
    let reg_type_str = body.registration_type.map(|r| enum_to_str(&r));
    let reg_source_str = body.registration_source.map(|s| enum_to_str(&s));
    let fin_class_str = body.financial_class.map(|f| enum_to_str(&f));

    let patient = sqlx::query_as_unchecked!(
        Patient,
        r#"UPDATE patients SET
               prefix = COALESCE($1, prefix),
               first_name = COALESCE($2, first_name),
               middle_name = COALESCE($3, middle_name),
               last_name = COALESCE($4, last_name),
               suffix = COALESCE($5, suffix),
               father_name = COALESCE($6, father_name),
               guardian_name = COALESCE($7, guardian_name),
               guardian_relation = COALESCE($8, guardian_relation),
               date_of_birth = COALESCE($9, date_of_birth),
               is_dob_estimated = COALESCE($10, is_dob_estimated),
               gender = COALESCE($11::gender, gender),
               marital_status = COALESCE($12::marital_status, marital_status),
               religion = COALESCE($13, religion),
               nationality_id = COALESCE($14, nationality_id),
               preferred_language = COALESCE($15, preferred_language),
               blood_group = COALESCE($16::blood_group, blood_group),
               occupation = COALESCE($17, occupation),
               phone = COALESCE($18, phone),
               phone_secondary = COALESCE($19, phone_secondary),
               email = COALESCE($20, email),
               address = COALESCE($21, address),
               category = COALESCE($22::patient_category, category),
               registration_type = COALESCE($23::registration_type, registration_type),
               registration_source = COALESCE($24::registration_source, registration_source),
               financial_class = COALESCE($25::financial_class, financial_class),
               is_medico_legal = COALESCE($26, is_medico_legal),
               mlc_number = COALESCE($27, mlc_number),
               is_vip = COALESCE($28, is_vip),
               is_unknown_patient = COALESCE($29, is_unknown_patient),
               attributes = COALESCE($30, attributes),
               is_active = COALESCE($31, is_active),
               updated_at = now()
           WHERE id = $32 AND tenant_id = $33
           RETURNING id, tenant_id, uhid, abha_id, prefix, first_name, middle_name, last_name, suffix,
                     full_name_local, father_name, mother_name, spouse_name, guardian_name,
                     guardian_relation, date_of_birth, is_dob_estimated, gender, gender_identity,
                     marital_status, religion, nationality_id, preferred_language, birth_place,
                     blood_group, blood_group_verified, no_known_allergies, occupation,
                     education_level, phone, phone_secondary, email, preferred_contact_method,
                     address, category, registration_type, registration_source, registered_by,
                     registered_at_facility, financial_class, is_medico_legal, mlc_number,
                     is_unknown_patient, temporary_name, is_vip, is_deceased, deceased_date,
                     photo_url, photo_captured_at, data_quality_score, last_visit_date, total_visits,
                     is_merged, merged_into_patient_id, source_system, legacy_id, attributes,
                     is_active, created_by, created_at, updated_at"#,
        &body.prefix,
        &body.first_name,
        &body.middle_name,
        &body.last_name,
        &body.suffix,
        &body.father_name,
        &body.guardian_name,
        &body.guardian_relation,
        body.date_of_birth,
        body.is_dob_estimated,
        &gender_str,
        &marital_str,
        &body.religion,
        body.nationality_id,
        &body.preferred_language,
        &blood_str,
        &body.occupation,
        &body.phone,
        &body.phone_secondary,
        &body.email,
        &body.address,
        &category_str,
        &reg_type_str,
        &reg_source_str,
        &fin_class_str,
        body.is_medico_legal,
        &body.mlc_number,
        body.is_vip,
        body.is_unknown_patient,
        &body.attributes,
        body.is_active,
        id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;

    patient.map_or_else(|| Err(AppError::NotFound), |p| Ok(Json(p)))
}

// ══════════════════════════════════════════════════════════
//  Patient Identifiers — CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_patient_identifiers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientIdentifier>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as_unchecked!(
        PatientIdentifier,
        "SELECT * FROM patient_identifiers \
         WHERE patient_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
        patient_id,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_patient_identifier(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<CreateIdentifierRequest>,
) -> Result<Json<PatientIdentifier>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let mut errors = ValidationErrors::new();
    if body.id_number.is_empty() {
        errors.add("id_number", "Identifier number is required");
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let id_type_str = enum_to_str(&body.id_type);
    let is_verified = body.is_verified.unwrap_or(false);
    let is_primary = body.is_primary.unwrap_or(false);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as_unchecked!(
        PatientIdentifier,
        "INSERT INTO patient_identifiers \
         (tenant_id, patient_id, id_type, id_number, id_number_hash, \
          issuing_authority, issuing_country_id, valid_from, valid_until, \
          is_verified, document_url, is_primary) \
         VALUES ($1, $2, $3::identifier_type, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
         RETURNING *",
        claims.tenant_id,
        patient_id,
        &id_type_str,
        &body.id_number,
        &body.id_number_hash,
        &body.issuing_authority,
        body.issuing_country_id,
        body.valid_from,
        body.valid_until,
        is_verified,
        &body.document_url,
        is_primary,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_patient_identifier(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((patient_id, id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateIdentifierRequest>,
) -> Result<Json<PatientIdentifier>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let id_type_str = body.id_type.map(|t| enum_to_str(&t));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as_unchecked!(
        PatientIdentifier,
        "UPDATE patient_identifiers SET \
         id_type = COALESCE($1::identifier_type, id_type), \
         id_number = COALESCE($2, id_number), \
         id_number_hash = COALESCE($3, id_number_hash), \
         issuing_authority = COALESCE($4, issuing_authority), \
         issuing_country_id = COALESCE($5, issuing_country_id), \
         valid_from = COALESCE($6, valid_from), \
         valid_until = COALESCE($7, valid_until), \
         is_verified = COALESCE($8, is_verified), \
         document_url = COALESCE($9, document_url), \
         is_primary = COALESCE($10, is_primary), \
         updated_at = now() \
         WHERE id = $11 AND patient_id = $12 AND tenant_id = $13 \
         RETURNING *",
        &id_type_str,
        &body.id_number,
        &body.id_number_hash,
        &body.issuing_authority,
        body.issuing_country_id,
        body.valid_from,
        body.valid_until,
        body.is_verified,
        &body.document_url,
        body.is_primary,
        id,
        patient_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_patient_identifier(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((patient_id, id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::patients::DELETE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query!(
        "DELETE FROM patient_identifiers \
         WHERE id = $1 AND patient_id = $2 AND tenant_id = $3",
        id,
        patient_id,
        claims.tenant_id,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Patient Addresses — CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_patient_addresses(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientAddress>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as_unchecked!(
        PatientAddress,
        "SELECT * FROM patient_addresses \
         WHERE patient_id = $1 AND tenant_id = $2 \
         ORDER BY is_primary DESC, created_at",
        patient_id,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_patient_address(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<CreateAddressRequest>,
) -> Result<Json<PatientAddress>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let mut errors = ValidationErrors::new();
    if body.address_line1.is_empty() {
        errors.add("address_line1", "Address line 1 is required");
    }
    if body.city.is_empty() {
        errors.add("city", "City is required");
    }
    if body.postal_code.is_empty() {
        errors.add("postal_code", "Postal code is required");
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let addr_type_str = enum_to_str(&body.address_type);
    let is_primary = body.is_primary.unwrap_or(false);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as_unchecked!(
        PatientAddress,
        "INSERT INTO patient_addresses \
         (tenant_id, patient_id, address_type, address_line1, address_line2, \
          village_town, city, district_id, state_id, country_id, postal_code, \
          latitude, longitude, is_primary, valid_from, valid_until) \
         VALUES ($1, $2, $3::address_type, $4, $5, $6, $7, $8, $9, $10, $11, \
                 $12, $13, $14, $15, $16) \
         RETURNING *",
        claims.tenant_id,
        patient_id,
        &addr_type_str,
        &body.address_line1,
        &body.address_line2,
        &body.village_town,
        &body.city,
        body.district_id,
        body.state_id,
        body.country_id,
        &body.postal_code,
        body.latitude,
        body.longitude,
        is_primary,
        body.valid_from,
        body.valid_until,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_patient_address(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((patient_id, id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateAddressRequest>,
) -> Result<Json<PatientAddress>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let addr_type_str = body.address_type.map(|t| enum_to_str(&t));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as_unchecked!(
        PatientAddress,
        "UPDATE patient_addresses SET \
         address_type = COALESCE($1::address_type, address_type), \
         address_line1 = COALESCE($2, address_line1), \
         address_line2 = COALESCE($3, address_line2), \
         village_town = COALESCE($4, village_town), \
         city = COALESCE($5, city), \
         district_id = COALESCE($6, district_id), \
         state_id = COALESCE($7, state_id), \
         country_id = COALESCE($8, country_id), \
         postal_code = COALESCE($9, postal_code), \
         latitude = COALESCE($10, latitude), \
         longitude = COALESCE($11, longitude), \
         is_primary = COALESCE($12, is_primary), \
         valid_from = COALESCE($13, valid_from), \
         valid_until = COALESCE($14, valid_until), \
         updated_at = now() \
         WHERE id = $15 AND patient_id = $16 AND tenant_id = $17 \
         RETURNING *",
        &addr_type_str,
        &body.address_line1,
        &body.address_line2,
        &body.village_town,
        &body.city,
        body.district_id,
        body.state_id,
        body.country_id,
        &body.postal_code,
        body.latitude,
        body.longitude,
        body.is_primary,
        body.valid_from,
        body.valid_until,
        id,
        patient_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_patient_address(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((patient_id, id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::patients::DELETE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query!(
        "DELETE FROM patient_addresses \
         WHERE id = $1 AND patient_id = $2 AND tenant_id = $3",
        id,
        patient_id,
        claims.tenant_id,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Patient Contacts — CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_patient_contacts(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientContact>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as!(
        PatientContact,
        "SELECT * FROM patient_contacts \
         WHERE patient_id = $1 AND tenant_id = $2 \
         ORDER BY priority ASC, created_at",
        patient_id,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_patient_contact(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<CreateContactRequest>,
) -> Result<Json<PatientContact>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let mut errors = ValidationErrors::new();
    validation::validate_name(&mut errors, "contact_name", &body.contact_name);
    validation::validate_optional_phone(&mut errors, "phone", &body.phone);
    if let Some(ref email) = body.email {
        validation::validate_optional_email(&mut errors, "email", email);
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let is_emergency = body.is_emergency_contact.unwrap_or(false);
    let is_nok = body.is_next_of_kin.unwrap_or(false);
    let is_guardian = body.is_legal_guardian.unwrap_or(false);
    let priority = body.priority.unwrap_or(1);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as_unchecked!(
        PatientContact,
        "INSERT INTO patient_contacts \
         (tenant_id, patient_id, contact_name, relation, phone, phone_alt, \
          email, address, is_emergency_contact, is_next_of_kin, \
          is_legal_guardian, priority) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) \
         RETURNING *",
        claims.tenant_id,
        patient_id,
        &body.contact_name,
        &body.relation,
        &body.phone,
        &body.phone_alt,
        &body.email,
        &body.address,
        is_emergency,
        is_nok,
        is_guardian,
        priority,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_patient_contact(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((patient_id, id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateContactRequest>,
) -> Result<Json<PatientContact>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let mut errors = ValidationErrors::new();
    if let Some(ref name) = body.contact_name {
        validation::validate_name(&mut errors, "contact_name", name);
    }
    if let Some(ref phone) = body.phone {
        validation::validate_optional_phone(&mut errors, "phone", phone);
    }
    if let Some(ref email) = body.email {
        validation::validate_optional_email(&mut errors, "email", email);
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as_unchecked!(
        PatientContact,
        "UPDATE patient_contacts SET \
         contact_name = COALESCE($1, contact_name), \
         relation = COALESCE($2, relation), \
         phone = COALESCE($3, phone), \
         phone_alt = COALESCE($4, phone_alt), \
         email = COALESCE($5, email), \
         address = COALESCE($6, address), \
         is_emergency_contact = COALESCE($7, is_emergency_contact), \
         is_next_of_kin = COALESCE($8, is_next_of_kin), \
         is_legal_guardian = COALESCE($9, is_legal_guardian), \
         priority = COALESCE($10, priority), \
         updated_at = now() \
         WHERE id = $11 AND patient_id = $12 AND tenant_id = $13 \
         RETURNING *",
        &body.contact_name,
        &body.relation,
        &body.phone,
        &body.phone_alt,
        &body.email,
        &body.address,
        body.is_emergency_contact,
        body.is_next_of_kin,
        body.is_legal_guardian,
        body.priority,
        id,
        patient_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_patient_contact(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((patient_id, id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::patients::DELETE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query!(
        "DELETE FROM patient_contacts \
         WHERE id = $1 AND patient_id = $2 AND tenant_id = $3",
        id,
        patient_id,
        claims.tenant_id,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Patient Insurance — CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_patient_insurance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientInsurance>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as!(
        PatientInsurance,
        "SELECT * FROM patient_insurance \
         WHERE patient_id = $1 AND tenant_id = $2 \
         ORDER BY priority ASC, created_at",
        patient_id,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_patient_insurance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<CreateInsuranceRequest>,
) -> Result<Json<PatientInsurance>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let mut errors = ValidationErrors::new();
    if body.insurance_provider.is_empty() {
        errors.add("insurance_provider", "Insurance provider is required");
    }
    if body.policy_number.is_empty() {
        errors.add("policy_number", "Policy number is required");
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let priority = body.priority.unwrap_or(1);
    let is_active = body.is_active.unwrap_or(true);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as_unchecked!(
        PatientInsurance,
        "INSERT INTO patient_insurance \
         (tenant_id, patient_id, insurance_provider, policy_number, group_number, \
          member_id, plan_name, policy_holder_name, policy_holder_relation, \
          valid_from, valid_until, sum_insured, tpa_name, tpa_id, \
          coverage_type, priority, is_active) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, \
                 $13, $14, $15, $16, $17) \
         RETURNING *",
        claims.tenant_id,
        patient_id,
        &body.insurance_provider,
        &body.policy_number,
        &body.group_number,
        &body.member_id,
        &body.plan_name,
        &body.policy_holder_name,
        &body.policy_holder_relation,
        body.valid_from,
        body.valid_until,
        body.sum_insured,
        &body.tpa_name,
        &body.tpa_id,
        &body.coverage_type,
        priority,
        is_active,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_patient_insurance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((patient_id, id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateInsuranceRequest>,
) -> Result<Json<PatientInsurance>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as_unchecked!(
        PatientInsurance,
        "UPDATE patient_insurance SET \
         insurance_provider = COALESCE($1, insurance_provider), \
         policy_number = COALESCE($2, policy_number), \
         group_number = COALESCE($3, group_number), \
         member_id = COALESCE($4, member_id), \
         plan_name = COALESCE($5, plan_name), \
         policy_holder_name = COALESCE($6, policy_holder_name), \
         policy_holder_relation = COALESCE($7, policy_holder_relation), \
         valid_from = COALESCE($8, valid_from), \
         valid_until = COALESCE($9, valid_until), \
         sum_insured = COALESCE($10, sum_insured), \
         tpa_name = COALESCE($11, tpa_name), \
         tpa_id = COALESCE($12, tpa_id), \
         coverage_type = COALESCE($13, coverage_type), \
         priority = COALESCE($14, priority), \
         is_active = COALESCE($15, is_active), \
         updated_at = now() \
         WHERE id = $16 AND patient_id = $17 AND tenant_id = $18 \
         RETURNING *",
        &body.insurance_provider,
        &body.policy_number,
        &body.group_number,
        &body.member_id,
        &body.plan_name,
        &body.policy_holder_name,
        &body.policy_holder_relation,
        body.valid_from,
        body.valid_until,
        body.sum_insured,
        &body.tpa_name,
        &body.tpa_id,
        &body.coverage_type,
        body.priority,
        body.is_active,
        id,
        patient_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_patient_insurance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((patient_id, id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::patients::DELETE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query!(
        "DELETE FROM patient_insurance \
         WHERE id = $1 AND patient_id = $2 AND tenant_id = $3",
        id,
        patient_id,
        claims.tenant_id,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Patient Allergies — CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_patient_allergies(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientAllergy>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as_unchecked!(
        PatientAllergy,
        "SELECT * FROM patient_allergies \
         WHERE patient_id = $1 AND tenant_id = $2 \
         ORDER BY created_at",
        patient_id,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_patient_allergy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<CreateAllergyRequest>,
) -> Result<Json<PatientAllergy>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let mut errors = ValidationErrors::new();
    if body.allergen_name.is_empty() {
        errors.add("allergen_name", "Allergen name is required");
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let allergy_type_str = enum_to_str(&body.allergy_type);
    let severity_str = body.severity.map(|s| enum_to_str(&s));
    let is_active = body.is_active.unwrap_or(true);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as_unchecked!(
        PatientAllergy,
        "INSERT INTO patient_allergies \
         (tenant_id, patient_id, allergy_type, allergen_name, allergen_code, \
          reaction, severity, onset_date, reported_by, is_active) \
         VALUES ($1, $2, $3::allergy_type, $4, $5, $6, \
                 $7::allergy_severity, $8, $9, $10) \
         RETURNING *",
        claims.tenant_id,
        patient_id,
        &allergy_type_str,
        &body.allergen_name,
        &body.allergen_code,
        &body.reaction,
        &severity_str,
        body.onset_date,
        &body.reported_by,
        is_active,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_patient_allergy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((patient_id, id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateAllergyRequest>,
) -> Result<Json<PatientAllergy>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let allergy_type_str = body.allergy_type.map(|t| enum_to_str(&t));
    let severity_str = body.severity.map(|s| enum_to_str(&s));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as_unchecked!(
        PatientAllergy,
        "UPDATE patient_allergies SET \
         allergy_type = COALESCE($1::allergy_type, allergy_type), \
         allergen_name = COALESCE($2, allergen_name), \
         allergen_code = COALESCE($3, allergen_code), \
         reaction = COALESCE($4, reaction), \
         severity = COALESCE($5::allergy_severity, severity), \
         onset_date = COALESCE($6, onset_date), \
         reported_by = COALESCE($7, reported_by), \
         is_active = COALESCE($8, is_active), \
         updated_at = now() \
         WHERE id = $9 AND patient_id = $10 AND tenant_id = $11 \
         RETURNING *",
        &allergy_type_str,
        &body.allergen_name,
        &body.allergen_code,
        &body.reaction,
        &severity_str,
        body.onset_date,
        &body.reported_by,
        body.is_active,
        id,
        patient_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_patient_allergy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((patient_id, id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::patients::DELETE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query!(
        "DELETE FROM patient_allergies \
         WHERE id = $1 AND patient_id = $2 AND tenant_id = $3",
        id,
        patient_id,
        claims.tenant_id,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Patient Consents — CRUD
// ══════════════════════════════════════════════════════════

pub async fn list_patient_consents(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientConsent>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as_unchecked!(
        PatientConsent,
        r#"SELECT id, tenant_id, patient_id, consent_type, consent_status, consent_date,
                  consent_version, consented_by, consented_by_relation, witness_name, capture_mode,
                  document_url, valid_until, notes, revoked_at, revoked_reason, created_at, updated_at
           FROM patient_consents
           WHERE patient_id = $1 AND tenant_id = $2
           ORDER BY consent_date DESC"#,
        patient_id,
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn create_patient_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<CreateConsentRequest>,
) -> Result<Json<PatientConsent>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let mut errors = ValidationErrors::new();
    if body.consented_by.is_empty() {
        errors.add("consented_by", "Consented by is required");
    }
    if errors.has_errors() {
        return Err(AppError::ValidationFailed(errors));
    }

    let consent_type_str = enum_to_str(&body.consent_type);
    let consent_status_str = enum_to_str(&body.consent_status);
    let capture_mode_str = enum_to_str(&body.capture_mode);
    let consent_date = body.consent_date.unwrap_or_else(Utc::now);

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as_unchecked!(
        PatientConsent,
        r#"INSERT INTO patient_consents
           (tenant_id, patient_id, consent_type, consent_status, consent_date,
            consent_version, consented_by, consented_by_relation, witness_name,
            capture_mode, document_url, valid_until, notes)
           VALUES ($1, $2, $3::consent_type, $4::consent_status, $5,
                   $6, $7, $8, $9, $10::consent_capture_mode, $11, $12, $13)
           RETURNING id, tenant_id, patient_id, consent_type, consent_status, consent_date,
                     consent_version, consented_by, consented_by_relation, witness_name, capture_mode,
                     document_url, valid_until, notes, revoked_at, revoked_reason, created_at, updated_at"#,
        claims.tenant_id,
        patient_id,
        &consent_type_str,
        &consent_status_str,
        consent_date,
        &body.consent_version,
        &body.consented_by,
        &body.consented_by_relation,
        &body.witness_name,
        &capture_mode_str,
        &body.document_url,
        body.valid_until,
        &body.notes,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(row))
}

pub async fn update_patient_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((patient_id, id)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateConsentRequest>,
) -> Result<Json<PatientConsent>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let consent_status_str = body.consent_status.map(|s| enum_to_str(&s));
    let capture_mode_str = body.capture_mode.map(|m| enum_to_str(&m));

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query_as_unchecked!(
        PatientConsent,
        r#"UPDATE patient_consents SET
               consent_status = COALESCE($1::consent_status, consent_status),
               consent_version = COALESCE($2, consent_version),
               consented_by = COALESCE($3, consented_by),
               consented_by_relation = COALESCE($4, consented_by_relation),
               witness_name = COALESCE($5, witness_name),
               capture_mode = COALESCE($6::consent_capture_mode, capture_mode),
               document_url = COALESCE($7, document_url),
               valid_until = COALESCE($8, valid_until),
               notes = COALESCE($9, notes),
               revoked_at = COALESCE($10, revoked_at),
               revoked_reason = COALESCE($11, revoked_reason),
               updated_at = now()
           WHERE id = $12 AND patient_id = $13 AND tenant_id = $14
           RETURNING id, tenant_id, patient_id, consent_type, consent_status, consent_date,
                     consent_version, consented_by, consented_by_relation, witness_name, capture_mode,
                     document_url, valid_until, notes, revoked_at, revoked_reason, created_at, updated_at"#,
        &consent_status_str,
        &body.consent_version,
        &body.consented_by,
        &body.consented_by_relation,
        &body.witness_name,
        &capture_mode_str,
        &body.document_url,
        body.valid_until,
        &body.notes,
        body.revoked_at,
        &body.revoked_reason,
        id,
        patient_id,
        claims.tenant_id,
    )
    .fetch_optional(&mut *tx)
    .await?;

    tx.commit().await?;
    row.map_or_else(|| Err(AppError::NotFound), |r| Ok(Json(r)))
}

pub async fn delete_patient_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((patient_id, id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::patients::DELETE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query!(
        "DELETE FROM patient_consents \
         WHERE id = $1 AND patient_id = $2 AND tenant_id = $3",
        id,
        patient_id,
        claims.tenant_id,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  MPI Duplicate Match — POST /api/patients/match
// ══════════════════════════════════════════════════════════

pub async fn match_patients(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<MatchRequest>,
) -> Result<Json<Vec<MatchResult>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Step 1: Check for exact identifier hash match (highest confidence)
    if let Some(ref hash) = body.identifier_hash {
        let id_matches = sqlx::query_as_unchecked!(
            MatchResult,
            "SELECT p.id, p.uhid, p.first_name, p.last_name, \
                    p.date_of_birth, p.phone, p.gender, \
                    1.0::float8 AS score \
             FROM patients p \
             JOIN patient_identifiers pi ON pi.patient_id = p.id AND pi.tenant_id = p.tenant_id \
             WHERE p.tenant_id = $1 AND pi.id_number_hash = $2 \
               AND p.is_merged = false AND p.is_active = true \
             LIMIT 10",
            claims.tenant_id,
            hash,
        )
        .fetch_all(&mut *tx)
        .await?;

        if !id_matches.is_empty() {
            tx.commit().await?;
            return Ok(Json(id_matches));
        }
    }

    // Step 2: Fuzzy match on name + DOB + phone using pg_trgm similarity()
    // Build a scoring query that combines multiple signals
    let first_name = body.first_name.clone().unwrap_or_default();
    let last_name = body.last_name.clone().unwrap_or_default();
    let phone = body.phone.clone().unwrap_or_default();

    let matches = sqlx::query_as_unchecked!(
        MatchResult,
        "SELECT id, uhid, first_name, last_name, date_of_birth, phone, gender, \
         ( \
           COALESCE(similarity(first_name, $2), 0) * 0.3 + \
           COALESCE(similarity(last_name, $3), 0) * 0.3 + \
           CASE WHEN date_of_birth = $4 THEN 0.25 ELSE 0.0 END + \
           CASE WHEN phone = $5 THEN 0.15 ELSE 0.0 END \
         )::float8 AS score \
         FROM patients \
         WHERE tenant_id = $1 \
           AND is_merged = false \
           AND is_active = true \
           AND ( \
             similarity(first_name, $2) > 0.3 \
             OR similarity(last_name, $3) > 0.3 \
             OR date_of_birth = $4 \
             OR phone = $5 \
           ) \
         ORDER BY score DESC \
         LIMIT 20",
        claims.tenant_id,
        &first_name,
        &last_name,
        body.date_of_birth,
        &phone,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(matches))
}

// ══════════════════════════════════════════════════════════
//  Masters — Religions, Occupations, Relations
// ══════════════════════════════════════════════════════════

pub async fn list_religions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MasterReligion>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as!(
        MasterReligion,
        "SELECT * FROM master_religions \
         WHERE (tenant_id = $1 OR tenant_id IS NULL) AND is_active = true \
         ORDER BY sort_order, name",
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn list_occupations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MasterOccupation>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as!(
        MasterOccupation,
        "SELECT * FROM master_occupations \
         WHERE (tenant_id = $1 OR tenant_id IS NULL) AND is_active = true \
         ORDER BY sort_order, name",
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

pub async fn list_relations(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<MasterRelation>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as!(
        MasterRelation,
        "SELECT * FROM master_relations \
         WHERE (tenant_id = $1 OR tenant_id IS NULL) AND is_active = true \
         ORDER BY sort_order, name",
        claims.tenant_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Patient Visit History & Timeline
// ══════════════════════════════════════════════════════════

/// Visit summary row — encounter with doctor/department names and key counts.
#[derive(Debug, sqlx::FromRow, Serialize)]
pub struct PatientVisitRow {
    pub id: Uuid,
    pub encounter_type: EncounterType,
    pub status: EncounterStatus,
    pub encounter_date: NaiveDate,
    pub doctor_name: Option<String>,
    pub department_name: Option<String>,
    pub chief_complaint: Option<String>,
    pub diagnosis_count: Option<i64>,
    pub prescription_count: Option<i64>,
    pub lab_order_count: Option<i64>,
    pub created_at: DateTime<Utc>,
}

/// GET /api/patients/{id}/visits — list encounters for a patient.
pub async fn list_patient_visits(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientVisitRow>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as_unchecked!(PatientVisitRow,
        "SELECT
            e.id,
            e.encounter_type,
            e.status,
            e.encounter_date,
            u.full_name AS doctor_name,
            d.name AS department_name,
            c.chief_complaint,
            (SELECT COUNT(*) FROM diagnoses dg WHERE dg.encounter_id = e.id) AS diagnosis_count,
            (SELECT COUNT(*) FROM prescriptions p WHERE p.encounter_id = e.id) AS prescription_count,
            (SELECT COUNT(*) FROM lab_orders lo WHERE lo.encounter_id = e.id) AS lab_order_count,
            e.created_at
         FROM encounters e
         LEFT JOIN users u ON u.id = e.doctor_id
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN consultations c ON c.encounter_id = e.id
         WHERE e.patient_id = $1
         ORDER BY e.encounter_date DESC, e.created_at DESC",
        patient_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Patient lab order summary row.
#[derive(Debug, sqlx::FromRow, Serialize)]
pub struct PatientLabOrderRow {
    pub id: Uuid,
    pub test_name: Option<String>,
    pub status: LabOrderStatus,
    pub priority: String,
    pub ordered_by_name: Option<String>,
    pub result_count: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// GET /api/patients/{id}/lab-orders — list lab orders for a patient.
pub async fn list_patient_lab_orders(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientLabOrderRow>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as_unchecked!(
        PatientLabOrderRow,
        "SELECT
            lo.id,
            tc.name AS test_name,
            lo.status,
            lo.priority::text AS priority,
            u.full_name AS ordered_by_name,
            (SELECT COUNT(*) FROM lab_results lr WHERE lr.order_id = lo.id) AS result_count,
            lo.created_at,
            lo.updated_at
         FROM lab_orders lo
         LEFT JOIN lab_test_catalog tc ON tc.id = lo.test_id
         LEFT JOIN users u ON u.id = lo.ordered_by
         WHERE lo.patient_id = $1
         ORDER BY lo.created_at DESC",
        patient_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Patient invoice summary row.
#[derive(Debug, sqlx::FromRow, Serialize)]
pub struct PatientInvoiceRow {
    pub id: Uuid,
    pub invoice_number: String,
    pub status: InvoiceStatus,
    pub total_amount: Decimal,
    pub paid_amount: Decimal,
    pub balance: Decimal,
    pub item_count: Option<i64>,
    pub issued_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// GET /api/patients/{id}/invoices — list invoices for a patient.
pub async fn list_patient_invoices(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientInvoiceRow>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as_unchecked!(
        PatientInvoiceRow,
        "SELECT
            i.id,
            i.invoice_number,
            i.status,
            i.total_amount,
            i.paid_amount,
            (i.total_amount - i.paid_amount) AS balance,
            (SELECT COUNT(*) FROM invoice_items ii WHERE ii.invoice_id = i.id) AS item_count,
            i.issued_at,
            i.created_at
         FROM invoices i
         WHERE i.patient_id = $1
         ORDER BY i.created_at DESC",
        patient_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// Patient appointment summary row.
#[derive(Debug, sqlx::FromRow, Serialize)]
pub struct PatientAppointmentRow {
    pub id: Uuid,
    pub appointment_date: NaiveDate,
    pub slot_start: chrono::NaiveTime,
    pub slot_end: chrono::NaiveTime,
    pub appointment_type: String,
    pub status: String,
    pub doctor_name: Option<String>,
    pub department_name: Option<String>,
    pub reason: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// GET /api/patients/{id}/appointments — list appointments for a patient.
pub async fn list_patient_appointments(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientAppointmentRow>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as_unchecked!(
        PatientAppointmentRow,
        "SELECT
            a.id,
            a.appointment_date,
            a.slot_start,
            a.slot_end,
            a.appointment_type::text AS appointment_type,
            a.status::text AS status,
            u.full_name AS doctor_name,
            d.name AS department_name,
            a.reason,
            a.created_at
         FROM appointments a
         LEFT JOIN users u ON u.id = a.doctor_id
         LEFT JOIN departments d ON d.id = a.department_id
         WHERE a.patient_id = $1
         ORDER BY a.appointment_date DESC, a.slot_start DESC",
        patient_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Patient Merge / Unmerge
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct MergePatientRequest {
    pub surviving_patient_id: Uuid,
    pub merged_patient_id: Uuid,
    pub merge_reason: String,
}

/// POST /api/patients/merge — merge two patient records.
pub async fn merge_patients(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Json(body): Json<MergePatientRequest>,
) -> Result<Json<PatientMergeHistory>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    if body.surviving_patient_id == body.merged_patient_id {
        return Err(AppError::BadRequest(
            "Cannot merge a patient with itself".into(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Snapshot the merged patient before marking
    let merged_patient = sqlx::query_as_unchecked!(
        Patient,
        r#"SELECT id, tenant_id, uhid, abha_id, prefix, first_name, middle_name, last_name, suffix,
                  full_name_local, father_name, mother_name, spouse_name, guardian_name,
                  guardian_relation, date_of_birth, is_dob_estimated, gender, gender_identity,
                  marital_status, religion, nationality_id, preferred_language, birth_place,
                  blood_group, blood_group_verified, no_known_allergies, occupation,
                  education_level, phone, phone_secondary, email, preferred_contact_method,
                  address, category, registration_type, registration_source, registered_by,
                  registered_at_facility, financial_class, is_medico_legal, mlc_number,
                  is_unknown_patient, temporary_name, is_vip, is_deceased, deceased_date,
                  photo_url, photo_captured_at, data_quality_score, last_visit_date, total_visits,
                  is_merged, merged_into_patient_id, source_system, legacy_id, attributes,
                  is_active, created_by, created_at, updated_at
           FROM patients
           WHERE id = $1 AND is_merged = false"#,
        body.merged_patient_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    let merge_data =
        serde_json::to_value(&merged_patient).unwrap_or_else(|_| serde_json::json!({}));

    // Mark the merged patient
    sqlx::query!(
        "UPDATE patients SET is_merged = true, merged_into_patient_id = $1, is_active = false, updated_at = now()
         WHERE id = $2",
        body.surviving_patient_id,
        body.merged_patient_id,
    )
    .execute(&mut *tx)
    .await?;

    // Create merge history
    let record = sqlx::query_as!(PatientMergeHistory,
        "INSERT INTO patient_merge_history (tenant_id, surviving_patient_id, merged_patient_id, merged_by, merge_reason, merge_data)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *",
        claims.tenant_id,
        body.surviving_patient_id,
        body.merged_patient_id,
        claims.sub,
        &body.merge_reason,
        &merge_data,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(record))
}

/// POST /api/patients/unmerge/{id} — unmerge a previously merged patient.
pub async fn unmerge_patient(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(merge_history_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let history = sqlx::query_as!(
        PatientMergeHistory,
        "SELECT * FROM patient_merge_history WHERE id = $1 AND unmerged_at IS NULL",
        merge_history_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::NotFound)?;

    // Restore the merged patient
    sqlx::query!(
        "UPDATE patients SET is_merged = false, merged_into_patient_id = NULL, is_active = true, updated_at = now()
         WHERE id = $1",
        history.merged_patient_id,
    )
    .execute(&mut *tx)
    .await?;

    // Mark unmerged
    sqlx::query!(
        "UPDATE patient_merge_history SET unmerged_at = now(), unmerged_by = $1 WHERE id = $2",
        claims.sub,
        merge_history_id,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "unmerged" })))
}

/// GET /api/patients/{id}/merge-history — list merge events for a patient.
pub async fn list_merge_history(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientMergeHistory>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as!(
        PatientMergeHistory,
        "SELECT * FROM patient_merge_history
         WHERE surviving_patient_id = $1 OR merged_patient_id = $1
         ORDER BY created_at DESC",
        patient_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

// ══════════════════════════════════════════════════════════
//  Patient Family Links
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateFamilyLinkRequest {
    pub related_patient_id: Uuid,
    pub relationship: String,
    pub is_primary_contact: Option<bool>,
    pub notes: Option<String>,
}

/// GET /api/patients/{patient_id}/family-links
pub async fn list_family_links(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<FamilyLinkRow>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as!(
        FamilyLinkRow,
        "SELECT fl.id, fl.patient_id, fl.related_patient_id, fl.relationship,
                fl.is_primary_contact, fl.notes, fl.created_at, fl.updated_at,
                p.uhid AS related_uhid,
                COALESCE(p.prefix || ' ', '') || p.first_name || ' ' || p.last_name AS related_name,
                p.phone AS related_phone,
                p.gender::text AS related_gender
         FROM patient_family_links fl
         JOIN patients p ON p.id = fl.related_patient_id
         WHERE fl.patient_id = $1
         ORDER BY fl.created_at DESC",
        patient_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FamilyLinkRow {
    pub id: Uuid,
    pub patient_id: Uuid,
    pub related_patient_id: Uuid,
    pub relationship: String,
    pub is_primary_contact: bool,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub related_uhid: Option<String>,
    pub related_name: Option<String>,
    pub related_phone: Option<String>,
    pub related_gender: Option<String>,
}

/// POST /api/patients/{patient_id}/family-links
pub async fn create_family_link(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<CreateFamilyLinkRequest>,
) -> Result<Json<PatientFamilyLink>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    if patient_id == body.related_patient_id {
        return Err(AppError::BadRequest(
            "Cannot link a patient to themselves".into(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let link = sqlx::query_as!(PatientFamilyLink,
        "INSERT INTO patient_family_links (tenant_id, patient_id, related_patient_id, relationship, is_primary_contact, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *",
        claims.tenant_id,
        patient_id,
        body.related_patient_id,
        &body.relationship,
        body.is_primary_contact.unwrap_or(false),
        body.notes.as_deref(),
        claims.sub,
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(link))
}

/// DELETE /api/patients/{patient_id}/family-links/{id}
pub async fn delete_family_link(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path((patient_id, id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query!(
        "DELETE FROM patient_family_links WHERE id = $1 AND patient_id = $2",
        id,
        patient_id,
    )
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

// ══════════════════════════════════════════════════════════
//  Patient Documents
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateDocumentRequest {
    pub document_type: String,
    pub document_name: String,
    pub file_url: String,
    pub file_size: Option<i64>,
    pub mime_type: Option<String>,
    pub notes: Option<String>,
}

/// GET /`api/patients/{patient_id}/documents`
pub async fn list_patient_documents(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<Vec<PatientDocument>>, AppError> {
    require_permission(&claims, permissions::patients::VIEW)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as!(
        PatientDocument,
        "SELECT * FROM patient_documents WHERE patient_id = $1 ORDER BY created_at DESC",
        patient_id,
    )
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /`api/patients/{patient_id}/documents`
pub async fn create_patient_document(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<CreateDocumentRequest>,
) -> Result<Json<PatientDocument>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let doc = sqlx::query_as!(PatientDocument,
        "INSERT INTO patient_documents (tenant_id, patient_id, document_type, document_name, file_url, file_size, mime_type, uploaded_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *",
        claims.tenant_id,
        patient_id,
        &body.document_type,
        &body.document_name,
        &body.file_url,
        body.file_size,
        body.mime_type.as_deref(),
        claims.sub,
        body.notes.as_deref(),
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(doc))
}

/// DELETE /`api/patients/{patient_id}/documents/{id`}
pub async fn delete_patient_document(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path((patient_id, id)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::patients::DELETE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let result = sqlx::query!(
        "DELETE FROM patient_documents WHERE id = $1 AND patient_id = $2",
        id,
        patient_id,
    )
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

/// PATCH /api/patients/{id}/photo — update patient photo URL.
pub async fn update_patient_photo(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(patient_id): Path<Uuid>,
    Json(body): Json<UpdatePhotoRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::patients::UPDATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    sqlx::query!(
        "UPDATE patients SET photo_url = $1, photo_captured_at = now(), updated_at = now() WHERE id = $2",
        &body.photo_url,
        patient_id,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "photo_url": body.photo_url })))
}

#[derive(Debug, Deserialize)]
pub struct UpdatePhotoRequest {
    pub photo_url: String,
}

//! Patients from the old system's register, with the date it registered them.

use chrono::{DateTime, NaiveDate, Utc};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use medbrains_server_core::{error::AppError, validation};

use crate::clinical::{one_of, provenance};
use crate::ctx::{Ctx, Ref};

const GENDERS: &[&str] = &["male", "female", "other", "unknown"];
const CATEGORIES: &[&str] = &[
    "general",
    "private",
    "insurance",
    "pmjay",
    "cghs",
    "staff",
    "vip",
    "esi",
    "corporate",
    "free",
    "charity",
];
const FINANCIAL: &[&str] = &[
    "self_pay",
    "insurance",
    "government_scheme",
    "corporate",
    "charity",
];
const BLOOD: &[&str] = &[
    "a_positive",
    "a_negative",
    "b_positive",
    "b_negative",
    "ab_positive",
    "ab_negative",
    "o_positive",
    "o_negative",
    "unknown",
];

#[derive(Debug, Deserialize)]
pub(crate) struct PatientRec {
    pub(crate) external_id: String,
    pub(crate) first_name: String,
    pub(crate) last_name: String,
    pub(crate) gender: String,
    pub(crate) date_of_birth: Option<NaiveDate>,
    pub(crate) phone: String,
    pub(crate) registered_at: DateTime<Utc>,
    pub(crate) category: Option<String>,
    pub(crate) financial_class: Option<String>,
    pub(crate) blood_group: Option<String>,
    pub(crate) city: Option<String>,
    pub(crate) state: Option<String>,
    pub(crate) preferred_language: Option<String>,
}

pub(crate) async fn patient(ctx: &mut Ctx<'_>, r: &PatientRec) -> Result<Option<Ref>, AppError> {
    let mut errors = validation::ValidationErrors::new();
    validation::validate_person_name(&mut errors, "first_name", &r.first_name);
    validation::validate_person_name(&mut errors, "last_name", &r.last_name);
    validation::validate_optional_phone(&mut errors, "phone", &r.phone);
    for (field, messages) in errors.into_fields() {
        for m in messages {
            ctx.problem(if field == "phone" { "phone" } else { "name" }, m);
        }
    }
    if r.phone.trim().is_empty() {
        ctx.problem("phone", "A patient needs a phone number");
    }
    let gender = one_of(ctx, "gender", Some(&r.gender), GENDERS, "unknown");
    let category = one_of(ctx, "category", r.category.as_ref(), CATEGORIES, "general");
    let financial = one_of(
        ctx,
        "financial_class",
        r.financial_class.as_ref(),
        FINANCIAL,
        "self_pay",
    );
    let blood = one_of(ctx, "blood_group", r.blood_group.as_ref(), BLOOD, "unknown");
    let in_past = ctx.past("registered_at", r.registered_at);
    if let Some(dob) = r
        .date_of_birth
        .filter(|d| *d > r.registered_at.date_naive())
    {
        ctx.problem(
            "date_of_birth",
            format!("Born {dob}, after being registered"),
        );
    }
    let (Some(gender), Some(category), Some(financial), Some(blood), true) =
        (gender, category, financial, blood, in_past)
    else {
        return Ok(None);
    };
    let uhid = ctx
        .uhids
        .next()
        .ok_or_else(|| AppError::Internal("ran out of reserved UHIDs".to_owned()))?;
    let address = json!({ "city": r.city, "state": r.state, "country": "India" });
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, date_of_birth, phone, \
            category, financial_class, blood_group, address, preferred_language, registration_type, \
            registration_source, created_at, updated_at, created_by, registered_by, source_system, legacy_id, attributes) \
         VALUES ($1, $2, $3, $4, $5::gender, $6, $7, $8::patient_category, $9::financial_class, \
            $10::blood_group, $11, $12, 'new', 'walk_in', $13, $13, $14, $14, 'historical_import', $15, $16) RETURNING id",
    )
    .bind(ctx.tenant)
    .bind(&uhid)
    .bind(r.first_name.trim())
    .bind(r.last_name.trim())
    .bind(gender)
    .bind(r.date_of_birth)
    .bind(r.phone.trim())
    .bind(category)
    .bind(financial)
    .bind(blood)
    .bind(address)
    .bind(&r.preferred_language)
    .bind(r.registered_at)
    .bind(ctx.user)
    .bind(&r.external_id)
    .bind(json!({ "history_import": provenance(ctx) }))
    .fetch_one(&mut *ctx.tx)
    .await?;
    ctx.record_provenance("patients", id, r.registered_at)
        .await?;
    Ok(Some(Ref {
        id,
        patient: id,
        encounter: None,
        admission: None,
        at: r.registered_at,
    }))
}

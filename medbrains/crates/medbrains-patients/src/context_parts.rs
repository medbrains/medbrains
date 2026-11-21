//! The small parts of `GET /api/patients/{id}/context`: last vitals, an
//! allergy, next of kin, an insurance and a pending consent.

use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct LastVitalsContext {
    pub recorded_at: DateTime<Utc>,
    pub temperature: Option<Decimal>,
    pub pulse: Option<i32>,
    pub systolic_bp: Option<i32>,
    pub diastolic_bp: Option<i32>,
    pub respiratory_rate: Option<i32>,
    pub spo2: Option<i32>,
    pub weight_kg: Option<Decimal>,
    pub height_cm: Option<Decimal>,
    pub bmi: Option<Decimal>,
}

#[derive(Debug, Serialize)]
pub struct AllergyContext {
    pub substance: String,
    pub allergy_type: String,
    pub severity: String,
    pub reaction: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct NextOfKinContext {
    pub name: String,
    pub phone: Option<String>,
    pub relation: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct InsuranceContext {
    pub provider_name: String,
    pub policy_number: Option<String>,
    pub valid_till: Option<NaiveDate>,
}

#[derive(Debug, Serialize)]
pub struct PendingConsentContext {
    pub consent_type: String,
    pub status: String,
}

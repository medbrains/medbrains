//! The patient list's row: the slim projection of a patient it renders.

use chrono::NaiveDate;
use medbrains_core::patient::{BloodGroup, Gender, Patient, PatientCategory, RegistrationType};
use serde::Serialize;
use uuid::Uuid;

/// Slim projection of `Patient` for LIST responses. Only the fields the list
/// table + search/picker consumers actually render — the full 40-field entity
/// (addresses, guardians, audit, attributes, extra UUIDs) is fetched on demand
/// via `GET /patients/{id}` for detail/edit. Cuts the list payload ~half (raw
/// serialize/parse/memory; the wire is already compressed). Built from the
/// already field-access-redacted `Patient`, so privacy masking is preserved.
#[derive(Debug, Serialize)]
pub struct PatientListRow {
    pub id: Uuid,
    pub uhid: String,
    pub prefix: Option<String>,
    pub first_name: String,
    pub middle_name: Option<String>,
    pub last_name: String,
    pub suffix: Option<String>,
    pub full_name_local: Option<String>,
    pub phone: String,
    pub gender: Gender,
    pub date_of_birth: Option<NaiveDate>,
    pub blood_group: Option<BloodGroup>,
    pub category: PatientCategory,
    pub registration_type: RegistrationType,
    pub is_vip: bool,
    pub is_medico_legal: bool,
    pub mlc_number: Option<String>,
    pub is_deceased: bool,
}

impl From<Patient> for PatientListRow {
    fn from(p: Patient) -> Self {
        Self {
            id: p.id,
            uhid: p.uhid,
            prefix: p.prefix,
            first_name: p.first_name,
            middle_name: p.middle_name,
            last_name: p.last_name,
            suffix: p.suffix,
            full_name_local: p.full_name_local,
            phone: p.phone,
            gender: p.gender,
            date_of_birth: p.date_of_birth,
            blood_group: p.blood_group,
            category: p.category,
            registration_type: p.registration_type,
            is_vip: p.is_vip,
            is_medico_legal: p.is_medico_legal,
            mlc_number: p.mlc_number,
            is_deceased: p.is_deceased,
        }
    }
}

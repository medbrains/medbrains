//! The OPD card: what a patient carries from registration and each OPD visit.
//! Split from `print_data.rs`, which re-exports it, to keep that file inside
//! its budget.
//!
//! Identity and visit logistics only. The card travels in a pocket and is
//! shown at every counter, so no diagnosis, allergy or other clinical field is
//! carried, and the hospital's letterhead comes from the tenant's own profile.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpdCardPrintData {
    /// `tenants.name`, never a product name.
    pub hospital_name: String,
    /// The branding setting the admin screen and onboarding write.
    pub hospital_logo_url: Option<String>,
    pub hospital_address: Option<String>,
    pub hospital_phone: Option<String>,
    /// The hospital's registration (Clinical Establishments) number.
    pub hospital_registration_no: Option<String>,
    pub patient_name: String,
    pub uhid: String,
    /// "34 Y", "7 M" or "12 D".
    pub age: Option<String>,
    pub gender: String,
    pub phone: String,
    /// Street and city, nothing more.
    pub address: Option<String>,
    pub registered_on: String,
    /// Present when the card is printed for an OPD visit.
    pub visit: Option<OpdCardVisit>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpdCardVisit {
    pub visit_date: String,
    pub visit_time: String,
    pub department: Option<String>,
    pub doctor: Option<String>,
    /// The number the board calls; null when the queue refused one.
    pub token_number: Option<String>,
    /// True when the patient has an earlier OPD visit here.
    pub is_repeat: bool,
}

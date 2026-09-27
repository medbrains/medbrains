//! Fixed choices on the registration form. Values are what the server stores
//! and must match its enums (`medbrains-core::patient`).

use super::catalogue::Opt;

const fn o(value: &'static str, label: &'static str) -> Opt {
    Opt { value, label }
}

/// "Unknown" is not offered: it is what an untouched field would mean, and an
/// unknown patient is registered as one.
pub const GENDER: &[Opt] = &[
    o("female", "Female"),
    o("male", "Male"),
    o("other", "Other"),
];

/// "Not asked yet" is honest; an empty answer reads as "none" to the next clinician.
pub const ALLERGY_STATUS: &[Opt] = &[
    o("not_asked_yet", "Not asked yet"),
    o("no_known_allergies", "No known allergies"),
    o("known_allergies", "Known allergies"),
];

pub const PREFIX: &[Opt] = &[
    o("Mr.", "Mr."),
    o("Mrs.", "Mrs."),
    o("Ms.", "Ms."),
    o("Miss", "Miss"),
    o("Master", "Master"),
    o("Baby", "Baby"),
    o("Baby of", "Baby of"),
    o("Dr.", "Dr."),
    o("Prof.", "Prof."),
    o("Shri", "Shri"),
    o("Smt.", "Smt."),
    o("Kumari", "Kumari"),
    o("Rev.", "Rev."),
    o("Mx.", "Mx."),
];

pub const BLOOD_GROUP: &[Opt] = &[
    o("a_positive", "A+"),
    o("a_negative", "A-"),
    o("b_positive", "B+"),
    o("b_negative", "B-"),
    o("ab_positive", "AB+"),
    o("ab_negative", "AB-"),
    o("o_positive", "O+"),
    o("o_negative", "O-"),
    o("unknown", "Unknown"),
];

pub const MARITAL_STATUS: &[Opt] = &[
    o("single", "Single"),
    o("married", "Married"),
    o("divorced", "Divorced"),
    o("widowed", "Widowed"),
    o("separated", "Separated"),
    o("domestic_partner", "Domestic partner"),
    o("unknown", "Unknown"),
];

pub const CATEGORY: &[Opt] = &[
    o("general", "General"),
    o("private", "Private"),
    o("insurance", "Insurance"),
    o("pmjay", "PMJAY"),
    o("cghs", "CGHS"),
    o("esi", "ESI"),
    o("corporate", "Corporate"),
    o("staff", "Staff"),
    o("vip", "VIP"),
    o("mlc", "MLC"),
    o("free", "Free"),
    o("charity", "Charity"),
];

pub const FINANCIAL_CLASS: &[Opt] = &[
    o("self_pay", "Self pay"),
    o("insurance", "Insurance"),
    o("government_scheme", "Government scheme"),
    o("corporate", "Corporate"),
    o("charity", "Charity"),
    o("research", "Research"),
];

pub const REGISTRATION_TYPE: &[Opt] = &[
    o("new", "New"),
    o("revisit", "Revisit"),
    o("transfer_in", "Transfer in"),
    o("referral", "Referral"),
    o("emergency", "Emergency"),
    o("camp", "Camp"),
    o("telemedicine", "Telemedicine"),
    o("pre_registration", "Pre-registration"),
];

pub const REGISTRATION_SOURCE: &[Opt] = &[
    o("walk_in", "Walk-in"),
    o("phone", "Phone"),
    o("online_portal", "Online portal"),
    o("mobile_app", "Mobile app"),
    o("kiosk", "Kiosk"),
    o("referral", "Referral"),
    o("ambulance", "Ambulance"),
    o("camp", "Camp"),
    o("telemedicine", "Telemedicine"),
];

pub const REFERRED_BY_KIND: &[Opt] = &[
    o("self", "Self / walk-in"),
    o("doctor", "Doctor"),
    o("asha", "ASHA"),
    o("camp_worker", "Camp worker"),
    o("facility", "Facility / hospital"),
    o("ngo", "NGO"),
    o("other", "Other"),
];

/// Referral kinds that name somebody other than the patient.
pub const REFERRED_BY_SOMEONE: &[&str] =
    &["doctor", "asha", "camp_worker", "facility", "ngo", "other"];

pub const CONTACT_METHOD: &[Opt] = &[
    o("sms", "SMS"),
    o("whatsapp", "WhatsApp"),
    o("email", "Email"),
    o("call", "Call"),
];

pub const ROOM_CLASS: &[Opt] = &[
    o("general", "General"),
    o("semi_private", "Semi-private"),
    o("private", "Private"),
    o("deluxe", "Deluxe"),
    o("suite", "Suite"),
    o("icu", "ICU"),
];

pub const DIET: &[Opt] = &[
    o("vegetarian", "Vegetarian"),
    o("vegan", "Vegan"),
    o("non_veg", "Non-vegetarian"),
    o("jain", "Jain"),
    o("halal", "Halal"),
    o("kosher", "Kosher"),
    o("diabetic", "Diabetic"),
];

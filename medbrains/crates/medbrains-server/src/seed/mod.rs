mod bed_types;
mod charge_master;
mod default_dashboard;
mod demo_patients;
mod departments;
mod insurance_providers;
mod lab_catalog;
mod locations;
mod module_config;
mod payment_methods;
mod pharmacy_catalog;
mod role_dashboards;
// Screen builder removed (see migration 123). seed/screens.rs retained as
// dead code for git history but not compiled.
// mod screens;
mod services;
mod store_catalog;
mod tax_categories;

use argon2::{
    Argon2,
    password_hash::{PasswordHasher, SaltString, rand_core::OsRng},
};
use medbrains_core::permissions;
use sqlx::PgPool;

/// Built-in role definitions with their default permissions.
/// These mirror the frontend `ROLE_TEMPLATES` in `packages/types/src/permissions.ts`.
struct BuiltInRole {
    code: &'static str,
    name: &'static str,
    description: &'static str,
    permissions: &'static [&'static str],
}

const BUILT_IN_ROLES: &[BuiltInRole] = &[
    BuiltInRole {
        code: "super_admin",
        name: "Super Admin",
        description: "Full system access — bypasses all permission checks",
        permissions: &[], // bypass role, no explicit permissions needed
    },
    BuiltInRole {
        code: "hospital_admin",
        name: "Hospital Admin",
        description: "Full hospital access — bypasses all permission checks",
        permissions: &[], // bypass role, no explicit permissions needed
    },
    BuiltInRole {
        code: "doctor",
        name: "Doctor",
        description: "Clinical staff — patient care, OPD, orders, admissions",
        permissions: &[
            permissions::dashboard::VIEW,
            permissions::patients::LIST,
            permissions::patients::VIEW,
            permissions::patients::CREATE,
            permissions::patients::UPDATE,
            permissions::opd::queue::LIST,
            permissions::opd::queue::VIEW,
            permissions::opd::visit::CREATE,
            permissions::opd::visit::UPDATE,
            permissions::lab::orders::LIST,
            permissions::lab::orders::VIEW,
            permissions::lab::orders::CREATE,
            permissions::lab::reports::VIEW,
            permissions::lab::dispatch::LIST,
            permissions::lab::specialized::LIST,
            permissions::lab::specialized::CREATE,
            permissions::lab::b2b::LIST,
            permissions::pharmacy::prescriptions::LIST,
            permissions::pharmacy::prescriptions::VIEW,
            permissions::pharmacy::ndps::LIST,
            permissions::pharmacy::analytics::VIEW,
            permissions::pharmacy::validation::BYPASS,
            permissions::pharmacy::rx_queue::LIST,
            permissions::pharmacy::safety::VIEW,
            permissions::ipd::admissions::LIST,
            permissions::ipd::admissions::VIEW,
            permissions::ipd::admissions::CREATE,
            permissions::ipd::discharge::CREATE,
            permissions::ipd::discharge_summary::CREATE,
            permissions::ipd::bed_dashboard::VIEW,
            permissions::ipd::reports::VIEW,
            permissions::ipd::clinical_docs::LIST,
            permissions::ipd::clinical_docs::CREATE,
            permissions::ipd::transfers::CREATE,
            permissions::ipd::death_records::MANAGE,
            permissions::ipd::birth_records::MANAGE,
            permissions::ipd::discharge_tat::VIEW,
            permissions::ot::consumables::MANAGE,
            permissions::indent::LIST,
            permissions::indent::VIEW,
            permissions::indent::CREATE,
            // Consent
            permissions::consent::VERIFY,
            permissions::consent::REVOKE,
            permissions::consent::templates::LIST,
            permissions::consent::signatures::LIST,
            // Specialty Clinical
            permissions::specialty::cath_lab::procedures::LIST,
            permissions::specialty::cath_lab::procedures::CREATE,
            permissions::specialty::cath_lab::devices::LIST,
            permissions::specialty::cath_lab::stemi::LIST,
            permissions::specialty::cath_lab::monitoring::LIST,
            permissions::specialty::cath_lab::monitoring::CREATE,
            permissions::specialty::endoscopy::procedures::LIST,
            permissions::specialty::endoscopy::procedures::CREATE,
            permissions::specialty::endoscopy::scopes::LIST,
            permissions::specialty::psychiatry::patients::LIST,
            permissions::specialty::psychiatry::patients::CREATE,
            permissions::specialty::psychiatry::patients::UPDATE,
            permissions::specialty::psychiatry::assessments::LIST,
            permissions::specialty::psychiatry::assessments::CREATE,
            permissions::specialty::psychiatry::ect::LIST,
            permissions::specialty::psychiatry::ect::CREATE,
            permissions::specialty::psychiatry::restraint::LIST,
            permissions::specialty::pmr::plans::LIST,
            permissions::specialty::pmr::plans::CREATE,
            permissions::specialty::pmr::sessions::LIST,
            permissions::specialty::pmr::sessions::CREATE,
            permissions::specialty::pmr::audiology::LIST,
            permissions::specialty::pmr::audiology::CREATE,
            permissions::specialty::palliative::dnr::LIST,
            permissions::specialty::palliative::pain::LIST,
            permissions::specialty::palliative::pain::CREATE,
            permissions::specialty::palliative::mortuary::LIST,
            permissions::specialty::palliative::nucmed::LIST,
            permissions::specialty::palliative::nucmed::CREATE,
            permissions::specialty::maternity::registrations::LIST,
            permissions::specialty::maternity::registrations::CREATE,
            permissions::specialty::maternity::anc::LIST,
            permissions::specialty::maternity::anc::CREATE,
            permissions::specialty::maternity::labor::LIST,
            permissions::specialty::maternity::labor::CREATE,
            permissions::specialty::maternity::newborn::LIST,
            permissions::specialty::maternity::newborn::CREATE,
            permissions::specialty::other::templates::LIST,
            permissions::specialty::other::records::LIST,
            permissions::specialty::other::records::CREATE,
            permissions::specialty::other::dialysis::LIST,
            // Documents
            permissions::documents::templates::LIST,
            permissions::documents::GENERATE,
            permissions::documents::REPRINT,
            permissions::documents::audit::LIST,
            // Order Sets
            permissions::order_sets::templates::LIST,
            permissions::order_sets::templates::VIEW,
            permissions::order_sets::templates::CREATE,
            permissions::order_sets::templates::UPDATE,
            permissions::order_sets::templates::APPROVE,
            permissions::order_sets::activation::CREATE,
            permissions::order_sets::activation::VIEW,
            permissions::order_sets::analytics::VIEW,
            // Insurance
            permissions::insurance::verification::LIST,
            permissions::insurance::prior_auth::LIST,
            permissions::insurance::prior_auth::CREATE,
            permissions::insurance::prior_auth::SUBMIT,
            permissions::insurance::appeals::LIST,
            permissions::insurance::dashboard::VIEW,
            // Care View
            permissions::care_view::VIEW,
            permissions::care_view::DISCHARGE_TRACKER,
            // Chronic Care
            permissions::chronic::programs::LIST,
            permissions::chronic::enrollments::LIST,
            permissions::chronic::enrollments::CREATE,
            permissions::chronic::enrollments::UPDATE,
            permissions::chronic::timeline::VIEW,
            permissions::chronic::timeline::CREATE,
            permissions::chronic::outcomes::VIEW,
            permissions::chronic::outcomes::CREATE,
            // Regulatory
            permissions::regulatory::dashboard::VIEW,
            permissions::regulatory::adr::LIST,
            permissions::regulatory::adr::CREATE,
            permissions::regulatory::pcpndt::LIST,
            permissions::regulatory::pcpndt::CREATE,
            // Retrospective
            permissions::retrospective::CREATE,
            permissions::retrospective::AUDIT,
            // LMS
            permissions::lms::my_learning::VIEW,
            permissions::lms::quizzes::ATTEMPT,
            permissions::lms::courses::LIST,
            permissions::lms::certificates::LIST,
        ],
    },
    BuiltInRole {
        code: "nurse",
        name: "Nurse",
        description: "Nursing staff — patient view, OPD queue, bed management",
        permissions: &[
            permissions::dashboard::VIEW,
            permissions::patients::LIST,
            permissions::patients::VIEW,
            permissions::opd::queue::LIST,
            permissions::opd::queue::VIEW,
            permissions::lab::phlebotomy::LIST,
            permissions::ipd::admissions::LIST,
            permissions::ipd::admissions::VIEW,
            permissions::ipd::beds::MANAGE,
            permissions::ipd::bed_dashboard::VIEW,
            permissions::ipd::wards::MANAGE,
            permissions::ipd::clinical_docs::LIST,
            permissions::ipd::clinical_docs::CREATE,
            permissions::ipd::reservations::MANAGE,
            permissions::ipd::transfers::CREATE,
            permissions::ipd::discharge_tat::VIEW,
            permissions::indent::LIST,
            permissions::indent::VIEW,
            permissions::indent::CREATE,
            // Specialty Clinical (list access)
            permissions::specialty::cath_lab::procedures::LIST,
            permissions::specialty::cath_lab::monitoring::LIST,
            permissions::specialty::endoscopy::procedures::LIST,
            permissions::specialty::psychiatry::patients::LIST,
            permissions::specialty::psychiatry::assessments::LIST,
            permissions::specialty::psychiatry::restraint::LIST,
            permissions::specialty::pmr::plans::LIST,
            permissions::specialty::pmr::sessions::LIST,
            permissions::specialty::palliative::dnr::LIST,
            permissions::specialty::palliative::pain::LIST,
            permissions::specialty::maternity::registrations::LIST,
            permissions::specialty::maternity::anc::LIST,
            permissions::specialty::maternity::labor::LIST,
            permissions::specialty::maternity::newborn::LIST,
            permissions::specialty::other::records::LIST,
            // Documents
            permissions::documents::templates::LIST,
            permissions::documents::GENERATE,
            permissions::documents::REPRINT,
            // Order Sets (activation only)
            permissions::order_sets::activation::CREATE,
            permissions::order_sets::activation::VIEW,
            // Care View
            permissions::care_view::VIEW,
            permissions::care_view::MY_TASKS,
            permissions::care_view::HANDOVER,
            permissions::care_view::DISCHARGE_TRACKER,
            permissions::care_view::MANAGE_TASKS,
            // Chronic Care
            permissions::chronic::enrollments::LIST,
            permissions::chronic::timeline::VIEW,
            permissions::chronic::adherence::LIST,
            permissions::chronic::adherence::CREATE,
            permissions::chronic::outcomes::VIEW,
            // Regulatory
            permissions::regulatory::dashboard::VIEW,
            permissions::regulatory::adr::LIST,
            permissions::regulatory::adr::CREATE,
            // Retrospective
            permissions::retrospective::CREATE,
            // LMS
            permissions::lms::my_learning::VIEW,
            permissions::lms::quizzes::ATTEMPT,
            permissions::lms::courses::LIST,
            permissions::lms::certificates::LIST,
            // Nurse activities
            permissions::nurse::dashboard::VIEW,
            permissions::nurse::profile::VIEW,
            permissions::nurse::shift::VIEW,
            permissions::nurse::mar::VIEW,
            permissions::nurse::mar::ADMINISTER,
            permissions::nurse::mar::HOLD,
            permissions::nurse::mar::REFUSE,
            permissions::nurse::vitals::VIEW,
            permissions::nurse::vitals::RECORD,
            permissions::nurse::intake_output::VIEW,
            permissions::nurse::intake_output::RECORD,
            permissions::nurse::restraint::VIEW,
            permissions::nurse::restraint::RECORD,
            permissions::nurse::pain::VIEW,
            permissions::nurse::pain::RECORD,
            permissions::nurse::wound::VIEW,
            permissions::nurse::wound::RECORD,
            permissions::nurse::fall_risk::VIEW,
            permissions::nurse::fall_risk::RECORD,
            permissions::nurse::handoff::VIEW,
            permissions::nurse::handoff::RECORD,
            permissions::nurse::code_blue::VIEW,
            permissions::nurse::code_blue::RECORD,
            permissions::nurse::equipment::VIEW,
            permissions::nurse::equipment::RECORD,
        ],
    },
    BuiltInRole {
        code: "receptionist",
        name: "Receptionist",
        description: "Front desk — registration, OPD visits, billing",
        permissions: &[
            permissions::dashboard::VIEW,
            permissions::patients::LIST,
            permissions::patients::VIEW,
            permissions::patients::CREATE,
            permissions::patients::UPDATE,
            permissions::opd::queue::LIST,
            permissions::opd::queue::VIEW,
            permissions::opd::visit::CREATE,
            permissions::opd::TOKEN_MANAGE,
            permissions::billing::invoices::LIST,
            permissions::billing::invoices::VIEW,
            permissions::billing::invoices::CREATE,
            permissions::billing::payments::CREATE,
            // Front Office
            permissions::front_office::visitors::LIST,
            permissions::front_office::visitors::CREATE,
            permissions::front_office::visitors::MANAGE,
            permissions::front_office::passes::LIST,
            permissions::front_office::passes::MANAGE,
            permissions::front_office::queue::LIST,
            permissions::front_office::enquiry::LIST,
            permissions::front_office::enquiry::CREATE,
            permissions::front_office::enquiry::MANAGE,
            // Insurance
            permissions::insurance::verification::LIST,
            permissions::insurance::verification::CREATE,
            permissions::insurance::prior_auth::LIST,
            // Documents
            permissions::documents::templates::LIST,
            permissions::documents::GENERATE,
            permissions::documents::REPRINT,
            // LMS
            permissions::lms::my_learning::VIEW,
            permissions::lms::quizzes::ATTEMPT,
            permissions::lms::courses::LIST,
            permissions::lms::certificates::LIST,
        ],
    },
    BuiltInRole {
        code: "lab_technician",
        name: "Lab Technician",
        description: "Lab staff — orders, results, QC, phlebotomy, outsourced",
        permissions: &[
            permissions::dashboard::VIEW,
            permissions::patients::VIEW,
            permissions::lab::orders::LIST,
            permissions::lab::orders::VIEW,
            permissions::lab::orders::CREATE,
            permissions::lab::results::CREATE,
            permissions::lab::results::UPDATE,
            permissions::lab::results::AMEND,
            permissions::lab::qc::LIST,
            permissions::lab::qc::CREATE,
            permissions::lab::qc::MANAGE,
            permissions::lab::phlebotomy::LIST,
            permissions::lab::phlebotomy::MANAGE,
            permissions::lab::outsourced::LIST,
            permissions::lab::outsourced::MANAGE,
            permissions::lab::reports::VIEW,
            // Phase 3
            permissions::lab::samples::LIST,
            permissions::lab::samples::MANAGE,
            permissions::lab::dispatch::LIST,
            permissions::lab::specialized::LIST,
            permissions::lab::b2b::LIST,
            // Documents
            permissions::documents::templates::LIST,
            permissions::documents::GENERATE,
            permissions::documents::REPRINT,
            // LMS
            permissions::lms::my_learning::VIEW,
            permissions::lms::quizzes::ATTEMPT,
            permissions::lms::courses::LIST,
            permissions::lms::certificates::LIST,
        ],
    },
    BuiltInRole {
        code: "pharmacist",
        name: "Pharmacist",
        description: "Pharmacy staff — prescriptions, dispensing, stock",
        permissions: &[
            permissions::dashboard::VIEW,
            permissions::patients::VIEW,
            permissions::pharmacy::prescriptions::LIST,
            permissions::pharmacy::prescriptions::VIEW,
            permissions::pharmacy::dispensing::CREATE,
            permissions::pharmacy::stock::MANAGE,
            permissions::pharmacy::ndps::LIST,
            permissions::pharmacy::ndps::MANAGE,
            permissions::pharmacy::stores::LIST,
            permissions::pharmacy::stores::MANAGE,
            permissions::pharmacy::analytics::VIEW,
            permissions::pharmacy::returns::LIST,
            permissions::pharmacy::returns::MANAGE,
            permissions::pharmacy::formulary::APPROVE,
            permissions::pharmacy::stewardship::APPROVE,
            permissions::pharmacy::validation::BYPASS,
            // Pharmacy Phase 3
            permissions::pharmacy::rx_queue::LIST,
            permissions::pharmacy::rx_queue::REVIEW,
            permissions::pharmacy::pos::CREATE,
            permissions::pharmacy::pos::VIEW,
            permissions::pharmacy::pricing::MANAGE,
            permissions::pharmacy::safety::VIEW,
            permissions::pharmacy::safety::OVERRIDE,
            permissions::pharmacy::reconciliation::MANAGE,
            permissions::indent::LIST,
            permissions::indent::VIEW,
            permissions::indent::STOCK_MANAGE,
            // Documents
            permissions::documents::templates::LIST,
            permissions::documents::GENERATE,
            permissions::documents::REPRINT,
            // Regulatory
            permissions::regulatory::dashboard::VIEW,
            permissions::regulatory::adr::LIST,
            permissions::regulatory::adr::CREATE,
            // LMS
            permissions::lms::my_learning::VIEW,
            permissions::lms::quizzes::ATTEMPT,
            permissions::lms::courses::LIST,
            permissions::lms::certificates::LIST,
            // Pharmacy improvements
            permissions::pharmacy_improvements::repeats::VIEW,
            permissions::pharmacy_improvements::repeats::DISPENSE,
            permissions::pharmacy_improvements::substitution::VIEW,
            permissions::pharmacy_improvements::substitution::RECORD,
            permissions::pharmacy_improvements::counseling::VIEW,
            permissions::pharmacy_improvements::counseling::RECORD,
            permissions::pharmacy_improvements::coverage::VIEW,
            permissions::pharmacy_improvements::coverage::CHECK,
            // Pharmacy finance
            permissions::pharmacy_finance::cash_drawer::VIEW,
            permissions::pharmacy_finance::cash_drawer::OPEN,
            permissions::pharmacy_finance::cash_drawer::CLOSE,
            permissions::pharmacy_finance::petty_cash::VIEW,
            permissions::pharmacy_finance::petty_cash::RECORD,
            permissions::pharmacy_finance::free_dispensing::VIEW,
            permissions::pharmacy_finance::supplier_payments::VIEW,
            permissions::pharmacy_finance::finance_reports::VIEW,
        ],
    },
    BuiltInRole {
        code: "billing_clerk",
        name: "Billing Clerk",
        description: "Billing staff — invoices, payments, advances, corporate, reports",
        permissions: &[
            permissions::dashboard::VIEW,
            permissions::patients::LIST,
            permissions::patients::VIEW,
            permissions::billing::invoices::LIST,
            permissions::billing::invoices::VIEW,
            permissions::billing::invoices::CREATE,
            permissions::billing::payments::CREATE,
            permissions::billing::payments::VOID,
            permissions::billing::advances::LIST,
            permissions::billing::advances::CREATE,
            permissions::billing::advances::ADJUST,
            permissions::billing::advances::REFUND,
            permissions::billing::corporate::LIST,
            permissions::billing::corporate::CREATE,
            permissions::billing::corporate::UPDATE,
            permissions::billing::reports::VIEW,
            permissions::billing::day_close::CREATE,
            permissions::billing::day_close::VERIFY,
            permissions::billing::write_off::CREATE,
            permissions::billing::audit::VIEW,
            // Phase 3 — credit, accounting, tax, recon, ERP
            permissions::billing::credit::LIST,
            permissions::billing::credit::MANAGE,
            permissions::billing::journal::LIST,
            permissions::billing::journal::CREATE,
            permissions::billing::journal::POST,
            permissions::billing::bank_recon::LIST,
            permissions::billing::bank_recon::MANAGE,
            permissions::billing::tds::LIST,
            permissions::billing::tds::MANAGE,
            permissions::billing::gst_returns::LIST,
            permissions::billing::gst_returns::MANAGE,
            permissions::billing::erp::EXPORT,
            permissions::ipd::discharge_tat::VIEW,
            // Insurance — full access
            permissions::insurance::verification::LIST,
            permissions::insurance::verification::CREATE,
            permissions::insurance::prior_auth::LIST,
            permissions::insurance::prior_auth::CREATE,
            permissions::insurance::prior_auth::UPDATE,
            permissions::insurance::prior_auth::SUBMIT,
            permissions::insurance::appeals::LIST,
            permissions::insurance::appeals::CREATE,
            permissions::insurance::rules::LIST,
            permissions::insurance::rules::MANAGE,
            permissions::insurance::dashboard::VIEW,
            // Lab B2B & Dispatch
            permissions::lab::b2b::LIST,
            permissions::lab::b2b::MANAGE,
            permissions::lab::dispatch::LIST,
            // Documents
            permissions::documents::templates::LIST,
            permissions::documents::GENERATE,
            permissions::documents::REPRINT,
            // LMS
            permissions::lms::my_learning::VIEW,
            permissions::lms::quizzes::ATTEMPT,
            permissions::lms::courses::LIST,
            permissions::lms::certificates::LIST,
        ],
    },
    BuiltInRole {
        code: "housekeeping_staff",
        name: "Housekeeping Staff",
        description: "Housekeeping — cleaning tasks, room turnaround, linen management",
        permissions: &[
            permissions::dashboard::VIEW,
            permissions::housekeeping::cleaning::LIST,
            permissions::housekeeping::cleaning::CREATE,
            permissions::housekeeping::turnaround::LIST,
            permissions::housekeeping::turnaround::MANAGE,
            permissions::housekeeping::linen::LIST,
            permissions::housekeeping::linen::CREATE,
            permissions::housekeeping::laundry::LIST,
            // LMS
            permissions::lms::my_learning::VIEW,
            permissions::lms::quizzes::ATTEMPT,
            permissions::lms::courses::LIST,
            permissions::lms::certificates::LIST,
        ],
    },
    BuiltInRole {
        code: "facilities_manager",
        name: "Facilities Manager",
        description: "Facilities management — dashboard, bed management, indent approval, integrations",
        permissions: &[
            permissions::dashboard::VIEW,
            permissions::ipd::beds::MANAGE,
            permissions::ipd::wards::MANAGE,
            permissions::ipd::bed_dashboard::VIEW,
            permissions::ipd::reports::VIEW,
            permissions::indent::LIST,
            permissions::indent::VIEW,
            permissions::indent::CREATE,
            permissions::indent::APPROVE,
            permissions::indent::STOCK_MANAGE,
            permissions::integration::LIST,
            permissions::integration::VIEW,
            // Housekeeping
            permissions::housekeeping::cleaning::LIST,
            permissions::housekeeping::cleaning::CREATE,
            permissions::housekeeping::cleaning::MANAGE,
            permissions::housekeeping::turnaround::LIST,
            permissions::housekeeping::turnaround::MANAGE,
            permissions::housekeeping::pest_control::LIST,
            permissions::housekeeping::pest_control::MANAGE,
            permissions::housekeeping::linen::LIST,
            permissions::housekeeping::linen::CREATE,
            permissions::housekeeping::linen::MANAGE,
            permissions::housekeeping::laundry::LIST,
            permissions::housekeeping::laundry::MANAGE,
            // HR
            permissions::hr::employees::LIST,
            permissions::hr::employees::CREATE,
            permissions::hr::employees::UPDATE,
            permissions::hr::credentials::LIST,
            permissions::hr::credentials::MANAGE,
            permissions::hr::attendance::LIST,
            permissions::hr::attendance::MANAGE,
            permissions::hr::leave::LIST,
            permissions::hr::leave::CREATE,
            permissions::hr::leave::APPROVE,
            permissions::hr::roster::LIST,
            permissions::hr::roster::MANAGE,
            permissions::hr::on_call::LIST,
            permissions::hr::on_call::MANAGE,
            permissions::hr::training::LIST,
            permissions::hr::training::MANAGE,
            permissions::hr::appraisal::MANAGE,
            // BME / CMMS
            permissions::bme::equipment::LIST,
            permissions::bme::equipment::CREATE,
            permissions::bme::equipment::UPDATE,
            permissions::bme::pm::LIST,
            permissions::bme::pm::MANAGE,
            permissions::bme::calibration::LIST,
            permissions::bme::calibration::MANAGE,
            permissions::bme::contracts::LIST,
            permissions::bme::contracts::MANAGE,
            permissions::bme::breakdowns::LIST,
            permissions::bme::breakdowns::CREATE,
            permissions::bme::breakdowns::MANAGE,
            permissions::bme::evaluations::MANAGE,
            // Facilities Management
            permissions::facilities::gas::LIST,
            permissions::facilities::gas::MANAGE,
            permissions::facilities::fire::LIST,
            permissions::facilities::fire::MANAGE,
            permissions::facilities::water::LIST,
            permissions::facilities::water::MANAGE,
            permissions::facilities::energy::LIST,
            permissions::facilities::energy::MANAGE,
            permissions::facilities::work_orders::LIST,
            permissions::facilities::work_orders::CREATE,
            permissions::facilities::work_orders::MANAGE,
            permissions::facilities::compliance::LIST,
            permissions::facilities::compliance::MANAGE,
            permissions::facilities::stats::VIEW,
            // Documents
            permissions::documents::templates::LIST,
            permissions::documents::templates::CREATE,
            permissions::documents::templates::UPDATE,
            permissions::documents::GENERATE,
            permissions::documents::REPRINT,
            permissions::documents::VOID,
            permissions::documents::audit::LIST,
            permissions::documents::review::LIST,
            permissions::documents::review::MANAGE,
            // Regulatory
            permissions::regulatory::dashboard::VIEW,
            permissions::regulatory::checklists::LIST,
            permissions::regulatory::checklists::CREATE,
            permissions::regulatory::checklists::UPDATE,
            permissions::regulatory::calendar::MANAGE,
            // LMS (full admin — manages training)
            permissions::lms::my_learning::VIEW,
            permissions::lms::quizzes::ATTEMPT,
            permissions::lms::courses::LIST,
            permissions::lms::courses::VIEW,
            permissions::lms::courses::CREATE,
            permissions::lms::courses::UPDATE,
            permissions::lms::enrollments::LIST,
            permissions::lms::enrollments::CREATE,
            permissions::lms::enrollments::UPDATE,
            permissions::lms::quizzes::LIST,
            permissions::lms::quizzes::CREATE,
            permissions::lms::paths::LIST,
            permissions::lms::paths::CREATE,
            permissions::lms::paths::UPDATE,
            permissions::lms::certificates::LIST,
            permissions::lms::certificates::CREATE,
            permissions::lms::compliance::VIEW,
        ],
    },
    BuiltInRole {
        code: "audit_officer",
        name: "Audit Officer",
        description: "Audit & compliance — read-only access across modules",
        permissions: &[
            permissions::dashboard::VIEW,
            permissions::patients::LIST,
            permissions::patients::VIEW,
            permissions::opd::queue::LIST,
            permissions::opd::queue::VIEW,
            permissions::lab::orders::LIST,
            permissions::lab::orders::VIEW,
            permissions::lab::reports::VIEW,
            permissions::lab::qc::LIST,
            permissions::pharmacy::prescriptions::LIST,
            permissions::pharmacy::prescriptions::VIEW,
            permissions::billing::invoices::LIST,
            permissions::billing::invoices::VIEW,
            permissions::ipd::admissions::LIST,
            permissions::ipd::admissions::VIEW,
            // MRD (read-only for audit)
            permissions::mrd::records::LIST,
            permissions::mrd::births::LIST,
            permissions::mrd::deaths::LIST,
            // Camp (read-only for audit)
            permissions::camp::LIST,
            // Consent (read-only for audit)
            permissions::consent::templates::LIST,
            permissions::consent::audit::LIST,
            // Security (read-only for audit)
            permissions::security::access::LIST,
            permissions::security::cctv::LIST,
            permissions::security::incidents::LIST,
            permissions::security::patient_safety::LIST,
            permissions::security::debriefs::LIST,
            // Documents (read-only for audit)
            permissions::documents::templates::LIST,
            permissions::documents::audit::LIST,
            permissions::documents::review::LIST,
            // Regulatory (all read permissions for audit)
            permissions::regulatory::dashboard::VIEW,
            permissions::regulatory::checklists::LIST,
            permissions::regulatory::adr::LIST,
            permissions::regulatory::materiovigilance::LIST,
            permissions::regulatory::pcpndt::LIST,
            permissions::regulatory::calendar::MANAGE,
            // LMS
            permissions::lms::my_learning::VIEW,
            permissions::lms::quizzes::ATTEMPT,
            permissions::lms::courses::LIST,
            permissions::lms::certificates::LIST,
            permissions::lms::compliance::VIEW,
        ],
    },
    BuiltInRole {
        code: "quality_officer",
        name: "Quality Officer",
        description: "Quality & compliance — full regulatory access",
        permissions: &[
            permissions::dashboard::VIEW,
            permissions::quality::indicators::LIST,
            permissions::quality::indicators::MANAGE,
            permissions::quality::documents::LIST,
            permissions::quality::documents::MANAGE,
            permissions::quality::incidents::LIST,
            permissions::quality::incidents::CREATE,
            permissions::quality::incidents::UPDATE,
            permissions::quality::capa::LIST,
            permissions::quality::capa::MANAGE,
            permissions::quality::committees::LIST,
            permissions::quality::committees::MANAGE,
            permissions::quality::accreditation::LIST,
            permissions::quality::accreditation::MANAGE,
            permissions::quality::audits::LIST,
            permissions::quality::audits::CREATE,
            // Order Sets (analytics)
            permissions::order_sets::templates::LIST,
            permissions::order_sets::templates::VIEW,
            permissions::order_sets::analytics::VIEW,
            // Regulatory — all 12 permissions
            permissions::regulatory::dashboard::VIEW,
            permissions::regulatory::checklists::LIST,
            permissions::regulatory::checklists::CREATE,
            permissions::regulatory::checklists::UPDATE,
            permissions::regulatory::adr::LIST,
            permissions::regulatory::adr::CREATE,
            permissions::regulatory::adr::UPDATE,
            permissions::regulatory::materiovigilance::LIST,
            permissions::regulatory::materiovigilance::CREATE,
            permissions::regulatory::pcpndt::LIST,
            permissions::regulatory::pcpndt::CREATE,
            permissions::regulatory::calendar::MANAGE,
            // LMS
            permissions::lms::my_learning::VIEW,
            permissions::lms::quizzes::ATTEMPT,
            permissions::lms::courses::LIST,
            permissions::lms::certificates::LIST,
            permissions::lms::compliance::VIEW,
        ],
    },
    BuiltInRole {
        code: "occ_health_officer",
        name: "Occupational Health Officer",
        description: "Employee health screenings, drug testing, vaccinations, injury reports",
        permissions: &[
            permissions::dashboard::VIEW,
            permissions::occ_health::screenings::LIST,
            permissions::occ_health::screenings::CREATE,
            permissions::occ_health::screenings::UPDATE,
            permissions::occ_health::drug_screens::LIST,
            permissions::occ_health::drug_screens::MANAGE,
            permissions::occ_health::vaccinations::LIST,
            permissions::occ_health::vaccinations::MANAGE,
            permissions::occ_health::injuries::LIST,
            permissions::occ_health::injuries::CREATE,
            permissions::occ_health::injuries::MANAGE,
        ],
    },
    BuiltInRole {
        code: "utilization_reviewer",
        name: "Utilization Reviewer",
        description: "Admission reviews, LOS monitoring, payer communications",
        permissions: &[
            permissions::dashboard::VIEW,
            permissions::ur::reviews::LIST,
            permissions::ur::reviews::CREATE,
            permissions::ur::reviews::UPDATE,
            permissions::ur::communications::LIST,
            permissions::ur::communications::CREATE,
            permissions::ur::conversions::LIST,
            permissions::ur::conversions::CREATE,
        ],
    },
    BuiltInRole {
        code: "case_manager",
        name: "Case Manager",
        description: "Discharge planning, barrier tracking, referrals, analytics",
        permissions: &[
            permissions::dashboard::VIEW,
            permissions::case_mgmt::assignments::LIST,
            permissions::case_mgmt::assignments::CREATE,
            permissions::case_mgmt::assignments::UPDATE,
            permissions::case_mgmt::barriers::LIST,
            permissions::case_mgmt::barriers::MANAGE,
            permissions::case_mgmt::referrals::LIST,
            permissions::case_mgmt::referrals::MANAGE,
            permissions::case_mgmt::analytics::VIEW,
        ],
    },
    BuiltInRole {
        code: "scheduling_admin",
        name: "Scheduling Admin",
        description: "No-show predictions, waitlist management, overbooking rules",
        permissions: &[
            permissions::dashboard::VIEW,
            permissions::scheduling::predictions::LIST,
            permissions::scheduling::predictions::CREATE,
            permissions::scheduling::waitlist::LIST,
            permissions::scheduling::waitlist::MANAGE,
            permissions::scheduling::overbooking::LIST,
            permissions::scheduling::overbooking::MANAGE,
            permissions::scheduling::analytics::VIEW,
            permissions::scheduling::AUTO_FILL_MANAGE,
        ],
    },
];

/// Insert DEFAULT tenant + `super_admin` user + built-in roles + operational
/// master data if they don't already exist.
pub async fn run_seed(pool: &PgPool) -> Result<(), Box<dyn std::error::Error>> {
    // Check if default tenant exists
    let tenant_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM tenants WHERE code = 'DEFAULT')")
            .fetch_one(pool)
            .await?;

    let tenant_id: uuid::Uuid;

    if tenant_exists {
        tracing::debug!("Default tenant already exists, skipping tenant seed");
        let tid: Option<uuid::Uuid> =
            sqlx::query_scalar("SELECT id FROM tenants WHERE code = 'DEFAULT'")
                .fetch_optional(pool)
                .await?;
        tenant_id = tid.ok_or("DEFAULT tenant row missing after EXISTS check")?;
    } else {
        tracing::info!("Seeding default tenant and super_admin user");

        tenant_id = uuid::Uuid::new_v4();

        // Insert default tenant
        sqlx::query(
            "INSERT INTO tenants (id, code, name, hospital_type, config) \
             VALUES ($1, 'DEFAULT', 'Alagappa Medical College & Hospital', \
             'medical_college', '{}')",
        )
        .bind(tenant_id)
        .execute(pool)
        .await?;

        // Hash the default password
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let password_hash = argon2
            .hash_password(b"admin123", &salt)
            .map_err(|e| format!("password hash error: {e}"))?
            .to_string();

        // Insert super_admin user (need to set tenant context first for RLS)
        let mut tx = pool.begin().await?;

        sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
            .bind(tenant_id.to_string())
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            "INSERT INTO users (tenant_id, username, email, password_hash, full_name, role) \
             VALUES ($1, 'admin', 'admin@medbrains.local', $2, \
             'System Administrator', 'super_admin')",
        )
        .bind(tenant_id)
        .bind(&password_hash)
        .execute(&mut *tx)
        .await?;

        // Seed default sequences
        sqlx::query(
            "INSERT INTO sequences (tenant_id, seq_type, prefix, current_val, pad_width) VALUES \
             ($1, 'UHID', 'ACMS-2026-', 0, 5), \
             ($1, 'INVOICE', 'INV-', 0, 6), \
             ($1, 'OPD_TOKEN', 'T', 0, 3), \
             ($1, 'INDENT', 'IND-', 0, 6), \
             ($1, 'ADVANCE', 'ADV-', 0, 6), \
             ($1, 'CORPORATE_INVOICE', 'CINV-', 0, 6)",
        )
        .bind(tenant_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        tracing::info!(%tenant_id, "Seed complete — admin/admin123");
    }

    // Idempotent seeds — always run (ON CONFLICT DO NOTHING / DO UPDATE)
    seed_built_in_roles(pool, tenant_id).await?;
    departments::seed_departments(pool, tenant_id).await?;
    lab_catalog::seed_lab_catalog(pool, tenant_id).await?;
    pharmacy_catalog::seed_pharmacy_catalog(pool, tenant_id).await?;
    charge_master::seed_charge_master(pool, tenant_id).await?;
    bed_types::seed_bed_types(pool, tenant_id).await?;
    tax_categories::seed_tax_categories(pool, tenant_id).await?;
    payment_methods::seed_payment_methods(pool, tenant_id).await?;
    services::seed_services(pool, tenant_id).await?;
    module_config::seed_module_config(pool, tenant_id).await?;
    store_catalog::seed_store_catalog(pool, tenant_id).await?;
    insurance_providers::seed_insurance_providers(pool, tenant_id).await?;
    locations::seed_locations(pool, tenant_id).await?;
    default_dashboard::seed_default_dashboard(pool, tenant_id).await?;
    role_dashboards::seed_role_dashboards(pool, tenant_id).await?;

    // Demo patients + OPD visits for testing
    demo_patients::seed_demo_patients(pool, tenant_id).await?;

    // Screen definitions removed — screen builder eradicated
    // (see migration 123_drop_builders.sql + RFC nuke-builders).
    let _ = pool;

    Ok(())
}

/// Insert built-in system roles into the `roles` table.
/// Idempotent — updates roles that already exist via `ON CONFLICT DO UPDATE`.
async fn seed_built_in_roles(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    for role in BUILT_IN_ROLES {
        let perms_json = serde_json::Value::Array(
            role.permissions
                .iter()
                .map(|s| serde_json::Value::String((*s).to_string()))
                .collect(),
        );

        sqlx::query(
            "INSERT INTO roles (tenant_id, code, name, description, permissions, is_system) \
             VALUES ($1, $2, $3, $4, $5, true) \
             ON CONFLICT (tenant_id, code) DO UPDATE SET \
               permissions = EXCLUDED.permissions, \
               name = EXCLUDED.name, \
               description = EXCLUDED.description",
        )
        .bind(tenant_id)
        .bind(role.code)
        .bind(role.name)
        .bind(role.description)
        .bind(&perms_json)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    tracing::info!("Seeded {} built-in roles", BUILT_IN_ROLES.len());

    Ok(())
}

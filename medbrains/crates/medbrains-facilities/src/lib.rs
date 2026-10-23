//! Facilities/ICU/insurance/NHCX leaf crate: facility management, ICU, insurance
//! + TPA, NHCX claim submission + participants. Mounted via `router()`.

use axum::{
    Router,
    routing::{delete, get, post, put},
};
use medbrains_server_core::state::AppState;

pub mod facilities;
pub mod icu;
pub mod insurance;
mod nhcx_bundle;
pub mod nhcx_claim_documents;
mod nhcx_claim_picks;
pub mod nhcx_claim_view;
mod nhcx_common;
pub mod nhcx_eligibility;
mod nhcx_final_claim;
pub mod nhcx_participants;
pub mod nhcx_preauth;
pub mod nhcx_queries;
pub mod nhcx_sla;
pub mod nhcx_submit;
mod nhcx_task_bundle;
pub mod nhcx_tasks;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/facilities/gas-readings",
            get(facilities::list_gas_readings).post(facilities::create_gas_reading),
        )
        .route(
            "/api/facilities/gas-compliance",
            get(facilities::list_gas_compliance).post(facilities::create_gas_compliance),
        )
        .route(
            "/api/facilities/gas-compliance/{id}",
            put(facilities::update_gas_compliance),
        )
        .route(
            "/api/facilities/fire-equipment",
            get(facilities::list_fire_equipment).post(facilities::create_fire_equipment),
        )
        .route(
            "/api/facilities/fire-equipment/{id}",
            put(facilities::update_fire_equipment),
        )
        .route(
            "/api/facilities/fire-inspections",
            get(facilities::list_fire_inspections).post(facilities::create_fire_inspection),
        )
        .route(
            "/api/facilities/fire-drills",
            get(facilities::list_fire_drills).post(facilities::create_fire_drill),
        )
        .route(
            "/api/facilities/fire-noc",
            get(facilities::list_fire_noc).post(facilities::create_fire_noc),
        )
        .route(
            "/api/facilities/fire-noc/{id}",
            put(facilities::update_fire_noc),
        )
        .route(
            "/api/facilities/water-tests",
            get(facilities::list_water_tests).post(facilities::create_water_test),
        )
        .route(
            "/api/facilities/water-schedules",
            get(facilities::list_water_schedules).post(facilities::create_water_schedule),
        )
        .route(
            "/api/facilities/water-schedules/{id}",
            put(facilities::update_water_schedule),
        )
        .route(
            "/api/facilities/energy-readings",
            get(facilities::list_energy_readings).post(facilities::create_energy_reading),
        )
        .route(
            "/api/facilities/work-orders",
            get(facilities::list_work_orders).post(facilities::create_work_order),
        )
        .route(
            "/api/facilities/work-orders/{id}",
            get(facilities::get_work_order),
        )
        .route(
            "/api/facilities/work-orders/{id}/status",
            put(facilities::update_work_order_status),
        )
        .route("/api/facilities/stats", get(facilities::get_fms_stats))
        .route("/api/facilities/pm/schedule", post(facilities::schedule_pm))
        .route(
            "/api/facilities/energy/analytics",
            get(facilities::energy_analytics),
        )
        .route(
            "/api/icu/admissions/{id}/flowsheets",
            get(icu::list_flowsheets).post(icu::create_flowsheet),
        )
        .route(
            "/api/icu/admissions/{id}/ventilator",
            get(icu::list_ventilator_records).post(icu::create_ventilator_record),
        )
        .route(
            "/api/icu/admissions/{id}/scores",
            get(icu::list_scores).post(icu::create_score),
        )
        .route(
            "/api/icu/admissions/{id}/devices",
            get(icu::list_devices).post(icu::create_device),
        )
        .route(
            "/api/icu/admissions/{id}/devices/{device_id}",
            put(icu::remove_device),
        )
        .route(
            "/api/icu/admissions/{id}/devices/{device_id}/bundle-checks",
            get(icu::list_bundle_checks).post(icu::create_bundle_check),
        )
        .route(
            "/api/icu/admissions/{id}/nutrition",
            get(icu::list_nutrition).post(icu::create_nutrition),
        )
        .route(
            "/api/icu/admissions/{id}/neonatal",
            get(icu::list_neonatal_records).post(icu::create_neonatal_record),
        )
        .route("/api/icu/analytics/los", get(icu::get_los_analytics))
        .route(
            "/api/icu/analytics/device-infections",
            get(icu::get_device_infection_rates),
        )
        .route(
            "/api/insurance/verifications",
            get(insurance::list_verifications).post(insurance::run_verification),
        )
        .route(
            "/api/insurance/verifications/{id}",
            get(insurance::get_verification),
        )
        .route(
            "/api/insurance/verifications/patient/{patient_id}/benefits",
            get(insurance::get_patient_benefits),
        )
        .route(
            "/api/insurance/prior-auths",
            get(insurance::list_prior_auths).post(insurance::create_prior_auth),
        )
        .route(
            "/api/insurance/prior-auths/{id}",
            get(insurance::get_prior_auth).put(insurance::update_prior_auth),
        )
        .route(
            "/api/insurance/prior-auths/{id}/submit",
            post(insurance::submit_prior_auth),
        )
        .route(
            "/api/insurance/prior-auths/{id}/respond",
            post(insurance::respond_prior_auth),
        )
        .route(
            "/api/insurance/prior-auths/{id}/cancel",
            post(insurance::cancel_prior_auth),
        )
        .route(
            "/api/insurance/check-pa",
            post(insurance::check_pa_required),
        )
        .route(
            "/api/insurance/prior-auths/{pa_id}/documents",
            get(insurance::list_documents).post(insurance::attach_document),
        )
        .route(
            "/api/insurance/prior-auths/{pa_id}/documents/{doc_id}",
            delete(insurance::remove_document),
        )
        .route(
            "/api/insurance/appeals",
            get(insurance::list_appeals).post(insurance::create_appeal),
        )
        .route("/api/insurance/appeals/{id}", put(insurance::update_appeal))
        .route(
            "/api/insurance/rules",
            get(insurance::list_rules).post(insurance::create_rule),
        )
        .route("/api/insurance/rules/{id}", put(insurance::update_rule))
        .route("/api/insurance/dashboard", get(insurance::dashboard))
        .route(
            "/api/billing/insurance-claims/{id}/submit-to-nhcx",
            post(nhcx_submit::submit_claim_to_nhcx),
        )
        .route(
            "/api/insurance/verifications/nhcx",
            post(nhcx_eligibility::check_nhcx_eligibility),
        )
        .route(
            "/api/insurance/nhcx/eligibility",
            get(nhcx_eligibility::list_nhcx_eligibility),
        )
        .route(
            "/api/insurance/prior-auths/{id}/submit-to-nhcx",
            post(nhcx_preauth::submit_preauth_to_nhcx),
        )
        .route(
            "/api/insurance/prior-auths/{id}/nhcx",
            get(nhcx_preauth::get_preauth_nhcx),
        )
        .route(
            "/api/insurance/nhcx/queries/{id}/answer",
            post(nhcx_queries::answer_payer_query),
        )
        .route("/api/insurance/nhcx/sla", get(nhcx_sla::list_nhcx_sla))
        .route(
            "/api/billing/insurance-claims/{id}/nhcx",
            get(nhcx_claim_view::get_claim_nhcx),
        )
        .route(
            "/api/billing/insurance-claims/{id}/nhcx/documents",
            post(nhcx_claim_documents::prepare_claim_documents),
        )
        .route(
            "/api/billing/insurance-claims/{id}/nhcx/status",
            post(nhcx_tasks::claim_status),
        )
        .route(
            "/api/billing/insurance-claims/{id}/nhcx/cancel",
            post(nhcx_tasks::cancel_claim),
        )
        .route(
            "/api/billing/insurance-claims/{id}/nhcx/reprocess",
            post(nhcx_tasks::reprocess_claim),
        )
        .route(
            "/api/insurance/prior-auths/{id}/nhcx/status",
            post(nhcx_tasks::preauth_status),
        )
        .route(
            "/api/insurance/nhcx/search",
            post(nhcx_tasks::search_claims),
        )
        .route(
            "/api/insurance/nhcx/searches",
            get(nhcx_claim_view::list_searches),
        )
        .route(
            "/api/nhcx/participants",
            get(nhcx_participants::list_nhcx_participants)
                .post(nhcx_participants::upsert_nhcx_participant),
        )
}

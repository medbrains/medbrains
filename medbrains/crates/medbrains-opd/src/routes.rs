//! The OPD crate's HTTP routes, in two halves the server merges differently.
//!
//! [`router`] is the clinical-visit core, merged ungated, because IPD and Emergency chart on the
//! same `encounters` rows through it. [`opd_only_router`] is the outpatient desk, which the server
//! merges through `gated("opd", …)`. Kept out of `lib.rs` so the routing reads in one place.

use axum::routing::{delete, get, post, put};
use medbrains_server_core::state::AppState;

use super::{
    admit_from_opd, book_appointment_group, call_queue_entry, cancel_procedure_order,
    cancel_reminder, check_duplicate_orders, complete_queue_entry, complete_reminder,
    create_certificate, create_clinical_corpus_entry, create_consent, create_consultation_template,
    create_diagnosis, create_encounter, create_feedback, create_prescription,
    create_prescription_template, create_procedure_order, create_referral, create_reminder,
    create_vital, delete_consultation_template, delete_diagnosis, delete_prescription_template,
    followup_compliance, generate_doctor_docket, get_consultation, get_doctor_docket,
    get_encounter, get_prescription, get_registration_policy, get_wait_estimate,
    list_appointment_group, list_certificates, list_chief_complaints, list_consents,
    list_consultation_templates, list_diagnoses, list_encounters, list_feedback,
    list_patient_diagnoses, list_patient_prescriptions, list_patient_referrals,
    list_patient_vitals_history, list_prescription_templates, list_prescriptions,
    list_procedure_catalog, list_procedure_orders, list_queue, list_reminders, list_verbal_orders,
    list_vitals, mark_no_show, pharmacy_dispatch_status, referral_tracking, revoke_consent,
    search_clinical_corpus, search_icd11, search_snomed, sign_consent, start_consultation,
    update_clinical_corpus_entry, update_diagnosis, update_encounter, update_prescription,
    update_registration_policy, void_certificate,
};
use crate::{last_visit, referral_lifecycle, rx_policy, transfer};

/// The clinical-visit core: what any encounter needs, whichever app opened it.
///
/// IPD and Emergency write rows into the same `encounters` table and chart on them through these
/// routes (vitals, prescriptions, diagnoses, orders, notes), so they stay on when the EMR (`opd`
/// brick) is off. The OPD-only half is [`opd_only_router`], which the server gates on `opd`.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .merge(encounter_routes())
        .merge(patient_routes())
        .merge(catalogue_routes())
}

/// Charting on one encounter id: vitals, consultation, diagnoses, prescriptions, procedures.
fn encounter_routes() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/opd/verbal-orders", get(list_verbal_orders))
        .route(
            "/api/opd/encounters/{id}",
            get(get_encounter).put(update_encounter),
        )
        // ponytail: transfer edits `opd_queues`, but the token console (not the EMR) calls it;
        // ungated until that screen checks the brick itself.
        .route(
            "/api/opd/encounters/{id}/transfer",
            post(transfer::transfer_encounter),
        )
        .route(
            "/api/opd/encounters/{id}/vitals",
            get(list_vitals).post(create_vital),
        )
        .route(
            "/api/opd/encounters/{id}/consultation",
            get(get_consultation),
        )
        .route(
            "/api/opd/encounters/{id}/diagnoses",
            get(list_diagnoses).post(create_diagnosis),
        )
        .route(
            "/api/opd/encounters/{id}/diagnoses/{did}",
            put(update_diagnosis).delete(delete_diagnosis),
        )
        .route(
            "/api/opd/encounters/{id}/prescriptions",
            get(list_prescriptions).post(create_prescription),
        )
        .route(
            "/api/opd/prescriptions/{id}",
            get(get_prescription).put(update_prescription),
        )
        .route(
            "/api/opd/encounters/{id}/procedure-orders",
            get(list_procedure_orders),
        )
        .route("/api/opd/procedure-orders", post(create_procedure_order))
        .route(
            "/api/opd/procedure-orders/{id}",
            delete(cancel_procedure_order),
        )
        .route(
            "/api/opd/visits/{id}/pharmacy-status",
            get(pharmacy_dispatch_status),
        )
}

/// A patient's clinical record across encounters: history, certificates, referrals, consents.
fn patient_routes() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/opd/patients/{id}/prescriptions",
            get(list_patient_prescriptions),
        )
        .route(
            "/api/opd/patients/{id}/stewardship-requests",
            get(rx_policy::list_live_stewardship_requests),
        )
        .route(
            "/api/opd/patients/{id}/diagnoses",
            get(list_patient_diagnoses),
        )
        .route(
            "/api/opd/patients/{id}/certificates",
            get(list_certificates),
        )
        .route("/api/opd/certificates", post(create_certificate))
        .route("/api/opd/certificates/{id}/void", put(void_certificate))
        .route(
            "/api/opd/patients/{id}/vitals-history",
            get(list_patient_vitals_history),
        )
        .route(
            "/api/opd/patients/{id}/referrals",
            get(list_patient_referrals),
        )
        .route("/api/opd/referrals", post(create_referral))
        .route("/api/opd/referrals/tracking", get(referral_tracking))
        .route(
            "/api/opd/referrals/{id}/accept",
            put(referral_lifecycle::accept_referral),
        )
        .route(
            "/api/opd/referrals/{id}/decline",
            put(referral_lifecycle::decline_referral),
        )
        .route(
            "/api/opd/referrals/{id}/complete",
            put(referral_lifecycle::complete_referral),
        )
        .route(
            "/api/opd/referrals/{id}/cancel",
            put(referral_lifecycle::cancel_referral),
        )
        .route("/api/opd/patients/{id}/feedback", get(list_feedback))
        .route("/api/opd/feedback", post(create_feedback))
        .route("/api/opd/patients/{id}/consents", get(list_consents))
        .route("/api/opd/consents", post(create_consent))
        .route("/api/opd/consents/{id}/sign", put(sign_consent))
        .route("/api/opd/consents/{id}/revoke", put(revoke_consent))
}

/// Prescribing and coding look-ups and templates every prescriber uses.
fn catalogue_routes() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/opd/prescription-templates",
            get(list_prescription_templates).post(create_prescription_template),
        )
        .route(
            "/api/opd/prescription-templates/{id}",
            delete(delete_prescription_template),
        )
        .route("/api/opd/procedure-catalog", get(list_procedure_catalog))
        .route("/api/opd/duplicate-check", get(check_duplicate_orders))
        .route("/api/opd/icd11/search", get(search_icd11))
        .route(
            "/api/opd/clinical-corpus",
            get(search_clinical_corpus).post(create_clinical_corpus_entry),
        )
        .route(
            "/api/opd/clinical-corpus/{id}",
            put(update_clinical_corpus_entry),
        )
        .route("/api/opd/chief-complaints", get(list_chief_complaints))
        .route(
            "/api/opd/consultation-templates",
            get(list_consultation_templates).post(create_consultation_template),
        )
        .route(
            "/api/opd/consultation-templates/{id}",
            delete(delete_consultation_template),
        )
        .route("/api/opd/snomed/search", get(search_snomed))
}

/// The outpatient desk itself: OPD visits, the queue, the wait, the docket, follow-ups.
///
/// None of it has a meaning without the EMR, so the server merges it through `gated("opd", …)`
/// and it answers "switched off" while the brick is off. Every URL is unchanged.
pub fn opd_only_router() -> axum::Router<AppState> {
    axum::Router::new()
        .route(
            "/api/opd/encounters",
            get(list_encounters).post(create_encounter),
        )
        .route(
            "/api/opd/patients/{id}/last-visit",
            get(last_visit::get_last_visit),
        )
        .route(
            "/api/opd/registration-policy",
            get(get_registration_policy).put(update_registration_policy),
        )
        .route(
            "/api/opd/auto-close",
            get(crate::auto_close::get_auto_close).put(crate::auto_close::update_auto_close),
        )
        .route("/api/opd/queue", get(list_queue))
        .route("/api/opd/queue/{id}/call", put(call_queue_entry))
        .route("/api/opd/queue/{id}/start", put(start_consultation))
        .route("/api/opd/queue/{id}/complete", put(complete_queue_entry))
        .route("/api/opd/queue/{id}/no-show", put(mark_no_show))
        .route("/api/opd/queue/wait-estimate", get(get_wait_estimate))
        .route("/api/opd/docket", get(get_doctor_docket))
        .route("/api/opd/docket/generate", post(generate_doctor_docket))
        .route(
            "/api/opd/reminders",
            get(list_reminders).post(create_reminder),
        )
        .route("/api/opd/reminders/{id}/complete", put(complete_reminder))
        .route("/api/opd/reminders/{id}/cancel", put(cancel_reminder))
        .route("/api/opd/appointment-groups", post(book_appointment_group))
        .route(
            "/api/opd/appointment-groups/{group_id}",
            get(list_appointment_group),
        )
        .route(
            "/api/opd/encounters/{id}/admit-to-ipd",
            post(admit_from_opd),
        )
        .route("/api/opd/analytics/followup", get(followup_compliance))
}

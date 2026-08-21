//! Marketing — enquiries, the acquisition pipeline and outreach.
//!
//! A hospital buys advertising, the advertising produces phone calls, and the
//! calls are lost between a call log, a WhatsApp group and a paper register.
//! This module is the record of the enquiry: who asked, what about, which
//! campaign produced them, who called back and when.
//!
//! # The line this module does not cross
//!
//! Everything here is enquiry-level. `mkt_contacts` is not `patients`: an
//! enquiry exists before anybody is a patient and often for somebody who never
//! becomes one, and the tele-calling desk has no business holding a chart.
//! `patient_id` is an advisory label with no foreign key — see
//! `0975_marketing.sql` for why that is a schema decision rather than a
//! convention.
//!
//! Recall campaigns are the exception that proves it. "Everybody due for a
//! retinopathy screen" is a list of people with diabetes, so the criteria stay
//! on the clinical side of the wall: the cohort query runs under
//! `marketing.cohorts.clinical_define`, held by clinicians, and what crosses
//! into these tables is identities and a coarse label. No row in this module
//! carries a diagnosis.
//!
//! # Why there is no patient filter on the lists
//!
//! Every other module in this repo scopes a list to the caller's permitted
//! patients. Here that would empty the worklist: most enquiries have no
//! patient at all, and the front desk's job is the ones it has never met. The
//! tenant boundary and the permission are the control, and what is being
//! protected is a phone number and a question, not a record.
//!
//! # Telephony
//!
//! Nothing in this crate talks to a switch. [`telephony::CallEvent`] is the
//! only vocabulary it knows, and an adapter — FreePBX over AMI, or a provider
//! webhook — produces it. That keeps "buy telephony now, own it later" a
//! configuration change rather than a rewrite.

pub mod audit;
pub mod campaigns;
pub mod cohorts;
pub mod contacts;
pub mod interactions;
pub mod outreach;
pub mod phone;
pub mod pipeline;
pub mod screen_pop;
pub mod telephony;
pub mod types;
pub mod webhook;

use axum::Router;
use axum::routing::{get, post, put};
use medbrains_server_core::state::AppState;

/// Marketing routes.
#[must_use]
pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/marketing/contacts",
            get(contacts::list_contacts).post(contacts::create_contact),
        )
        .route("/api/marketing/contacts/{id}", get(contacts::get_contact))
        .route(
            "/api/marketing/contacts/{id}/interactions",
            get(interactions::list_interactions).post(interactions::log_interaction),
        )
        .route(
            "/api/marketing/contacts/{id}/stage",
            post(pipeline::move_stage),
        )
        .route("/api/marketing/screen-pop", get(screen_pop::screen_pop))
        .route(
            "/api/marketing/campaigns",
            get(campaigns::list_campaigns).post(campaigns::create_campaign),
        )
        .route(
            "/api/marketing/campaigns/{id}",
            put(campaigns::update_campaign),
        )
        .route(
            "/api/marketing/reports/campaign-funnel",
            get(campaigns::campaign_funnel),
        )
        .route(
            "/api/marketing/reports/enquiry-audit",
            get(audit::enquiry_audit),
        )
        .route(
            "/api/marketing/cohorts",
            get(cohorts::list_cohorts).post(cohorts::create_enquiry_cohort),
        )
        .route(
            "/api/marketing/cohorts/clinical",
            post(cohorts::create_clinical_cohort),
        )
        .route("/api/marketing/cohorts/{id}/size", get(cohorts::cohort_size))
        .route(
            "/api/marketing/outreach",
            get(outreach::list_runs).post(outreach::create_run),
        )
        .route("/api/marketing/outreach/{id}/submit", post(outreach::submit_run))
        .route("/api/marketing/outreach/{id}/approve", post(outreach::approve_run))
        .route("/api/marketing/outreach/{id}/cancel", post(outreach::cancel_run))
        .route("/api/marketing/stages", get(pipeline::list_stages))
        .route(
            "/api/marketing/telephony/calls",
            post(webhook::ingest_call_webhook),
        )
        .route(
            "/api/marketing/reports/missed-calls",
            get(interactions::missed_call_summary),
        )
}

#[cfg(test)]
mod permission_tests {
    use medbrains_core::permissions::marketing;

    /// These strings are the contract with `packages/types/src/permissions.ts`,
    /// which is generated from them. A rename on either side silently opens a
    /// hole, so the values are asserted rather than assumed.
    #[test]
    fn codes_match_the_generated_frontend_strings() {
        assert_eq!(marketing::contacts::LIST, "marketing.contacts.list");
        assert_eq!(marketing::contacts::VIEW, "marketing.contacts.view");
        assert_eq!(marketing::contacts::CREATE, "marketing.contacts.create");
        assert_eq!(marketing::pipeline::MOVE, "marketing.pipeline.move");
        assert_eq!(marketing::interactions::LOG, "marketing.interactions.log");
        assert_eq!(
            marketing::interactions::PLAY_RECORDING,
            "marketing.interactions.play_recording"
        );
        assert_eq!(
            marketing::cohorts::CLINICAL_DEFINE,
            "marketing.cohorts.clinical_define"
        );
        assert_eq!(marketing::outreach::APPROVE, "marketing.outreach.approve");
        assert_eq!(marketing::REPORTS_VIEW, "marketing.reports.view");
    }

    /// Reading the timeline and playing the recording must never be the same
    /// code. A recording carries whatever the caller said, including the
    /// symptoms the IVR asked them not to describe.
    #[test]
    fn playing_a_recording_is_not_the_same_code_as_reading_the_timeline() {
        assert_ne!(marketing::interactions::PLAY_RECORDING, marketing::contacts::VIEW);
        assert_ne!(marketing::interactions::PLAY_RECORDING, marketing::interactions::LOG);
    }
}

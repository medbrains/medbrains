pub mod abdm;
pub mod uhi;
pub mod access;
pub mod admin;
pub mod admin_simulator;
pub mod message_simulator;
pub mod appointments;
pub mod audit;
pub mod coverage;
pub mod debug;
pub mod health;
pub mod nhcx_onboarding;
pub mod portal;
pub mod portal_deliveries;
pub mod portal_pay;
pub mod portal_privacy;
pub mod portal_refills;
pub mod portal_store;
pub mod portal_tele;
pub mod bill_verify;
pub mod rx_verify;
pub mod store_public;
pub use medbrains_nabh as nabh_evidence;
// scheduling routes moved to the medbrains-scheduling leaf; re-exported so
// reports.rs (which reuses scheduling helpers) keeps resolving crate::routes::scheduling.
pub use medbrains_identity::sso;
pub use medbrains_platform::ckb;
pub use medbrains_print_data::billing as print_data_billing;
pub use medbrains_print_data::clinical as print_data_clinical;
pub use medbrains_scheduling::scheduling;
pub use medbrains_notifications as notifications;
pub use medbrains_signing::signed_documents;
pub use medbrains_server_core::step_up;
pub use medbrains_telehealth::cds;
// order_basket reaches diet's order-creation helper via super::diet
pub use medbrains_diet as diet;
// opd/order_basket reach radiology order helpers via super::radiology; public viewer route too
pub use medbrains_radiology as radiology;
// opd/order_basket reach lab order helpers via super::lab
pub use medbrains_lab as lab;
// ai/ipd_post_discharge/order_basket reach pharmacy order + med-safety helpers via super::pharmacy
pub use medbrains_pharmacy as pharmacy;
// case_sheet_scan/mrd/appointments reach opd helpers via super::opd
pub use medbrains_opd as opd;
// ai/appointments reach patients helpers via super::patients
pub use medbrains_patients as patients;
// payment_gateway webhook routes stay in the no-auth public chain in mod.rs
pub use medbrains_payment_gateway as payment_gateway;
pub use medbrains_setup as setup;
pub use medbrains_vpn as vpn;
// billing/lab/pharmacy/patients/appointments reach token helpers via crate::routes::tokens
pub use medbrains_tokens as tokens;
pub mod orchestration;

pub mod ws;

use axum::{
    Router,
    middleware::{from_fn, from_fn_with_state},
    routing::{delete, get, post, put},
};

use crate::{
    middleware::{
        access_log::access_log_layer,
        audit::audit_layer,
        auth::auth_middleware,
        client_ip::client_ip_middleware,
        csrf::csrf_middleware,
        ip_restrict::ip_restrict_middleware,
        rate_limit::{
            RateLimiter, rate_limit_middleware, storefront_rate_limit_middleware,
            tiered_rate_limit_middleware,
        },
        system_state::system_state_layer,
    },
    state::AppState,
};

/// An uploaded prescription arrives base64 in JSON: 8 MB of photo is about
/// 11 MB on the wire.
const STORE_RX_BODY_LIMIT: usize = 12 * 1024 * 1024;

/// Build the application router — auth + health + onboarding + setup + geo + patients.
#[allow(clippy::too_many_lines, clippy::large_stack_frames)]
pub fn build_router(state: AppState) -> Router {
    // Rate limiter for login endpoint (5 attempts per 60s per IP)
    let login_limiter = RateLimiter::new();

    // Rate-limited login route
    let login_route = Router::new()
        .merge(medbrains_auth::router())
        .layer(from_fn_with_state(login_limiter, rate_limit_middleware));

    // Password reset — public, shares the login limiter shape (per-IP)
    let reset_limiter = RateLimiter::new();
    let password_reset_routes =
        Router::new().layer(from_fn_with_state(reset_limiter, rate_limit_middleware));

    // Public routes (no auth required)
    let public = Router::new()
        .merge(login_route)
        .merge(password_reset_routes)
        .route("/api/health", get(health::health_check))
        // Caddy on-demand TLS asks before issuing a certificate.
        .merge(medbrains_infra_settings::public_router())
        // Enterprise SSO login flow — pre-auth (no JWT yet).
        .merge(medbrains_sso_login::router())
        // NHCX gateway callbacks — authenticated by the gateway's RS256 JWT,
        // not a user session, so they live on the public router.
        .merge(medbrains_nhcx_callback::public_router())
        // ABDM gateway callbacks (HIP) — each authenticated by the gateway's
        // JWT and the HFR facility ID in X-HIP-ID, never by a user session.
        .merge(abdm::hip::public_router())
        // ABDM HIU callbacks (X-HIU-ID) and the HIPs' data push to us.
        .merge(abdm::hiu::public_router())
        // UHI calls from patient apps — each signed, naming its hospital by
        // the subscriber ID in the path.
        .merge(uhi::public_router())
        .route(
            "/api/abdm/gateway/callback",
            post(abdm::hip_relay::receive_callback),
        )
        // Device pairing — gated by short-lived one-time token, not JWT
        .merge(medbrains_device_pairing::router())
        // Device-code pairing — a display has no credentials yet, so asking for a
        // code and polling for the result are public; approving is not.
        .merge(medbrains_device_pairing::device_code_router())
        // Onboarding — public endpoints
        .merge(medbrains_onboarding::public_router())
        // Geo — public read-only endpoints
        // CMS Public API (no auth required)
        .route("/api/public/tenant-by-host", get(setup::tenant_by_host))
        .merge(medbrains_onboarding::email_verification::router())
        // Accepting an invitation happens before the account exists.
        .merge(medbrains_invitations::public_router())
        // The public website — published posts, pages, subscribe/unsubscribe.
        .merge(medbrains_cms::public_router())
        // WebSocket routes (TV displays)
        .route("/ws/queue/{department_id}", get(ws::queue_ws_handler))
        .route("/ws/queue", get(ws::queue_ws_handler_all))
        .route("/api/ws/notifications", get(notifications::notifications_ws_handler))
        // Payment Gateway Webhooks (no auth — called by the provider)
        .route("/api/webhooks/razorpay", post(payment_gateway::razorpay_webhook))
        .route("/api/webhooks/cashfree", post(payment_gateway::cashfree_webhook))
        .route("/api/webhooks/razorpayx", post(payment_gateway::razorpayx_webhook))
        .route("/api/webhooks/phonepe", post(payment_gateway::phonepe_webhook))
        .route("/api/webhooks/payu", post(payment_gateway::payu_webhook))
        .route("/api/webhooks/ccavenue", post(payment_gateway::ccavenue_webhook));

    // Protected routes (auth required)
    let protected = Router::new()
        // Auth — me/logout/change-password/revocations need Extension<Claims>
        .merge(medbrains_auth::protected_router())
        .merge(medbrains_client_errors::router())
        .merge(medbrains_device_pairing::device_code_admin_router())
        // Admin halves of three routers that used to sit on the public side,
        // where their handlers' `Claims` extension never arrived and every
        // call answered 500 — see each crate's admin_router doc comment.
        .merge(medbrains_device_pairing::admin_router())
        .merge(medbrains_invitations::admin_router())
        .merge(medbrains_cms::admin_router())
        .route("/api/access/manifest", get(access::get_manifest))
        .merge(medbrains_app_manifest::router())
        .merge(medbrains_clinical_scores::router())
        .merge(medbrains_clinical_ops::router())
        .merge(medbrains_vte::router())
        .merge(medbrains_marketing::router())
        .merge(medbrains_setup::router())
        // ── FHIR R4 read API (ABDM HIE-CM HIP role + generic interop) ──
        .merge(medbrains_fhir_api::router())
        .route("/api/debug/authz-probe", get(health::authz_probe))
        .route(
            "/api/debug/e2e/canonical-fixtures",
            post(debug::seed_canonical_fixtures),
        )
        // ── Sharing API (manual per-resource grants) ─────────
        .merge(medbrains_sharing::router())
        .merge(medbrains_identity::router())
        .merge(medbrains_approvals_api::router())
        .merge(medbrains_onboarding::router())
        .merge(medbrains_api_keys_api::router())
        .route("/api/auth/step-up", post(step_up::step_up))
        .merge(medbrains_mfa::router())
        // Phase A.1 — offline JWT revocation feed for mobile/TV/edge
        // Onboarding progress
        // Setup — tenant
        // Setup — generic tenant settings
        // Setup — brand entities (multi-entity branding)
        // Setup — facilities
        // Setup — locations
        // Setup — departments
        // Setup — roles
        // Setup — users
        // Server-side document rendering (epic #267)
        .merge(medbrains_documents_render::router())
        // Setup — modules
        // Setup — sequences
        // Setup — services
        .merge(medbrains_catalog_import::router())
        // SNOMED CT store: releases, search, hierarchy, ECL, analytics
        .merge(medbrains_terminology::router())
        .merge(medbrains_infra_settings::router())
        .merge(medbrains_mail_provisioning::router())
        // Setup — bed types
        // Setup — tax categories
        // Setup — payment methods
        // Setup — branding
        // Setup — module master data seeding
        // Setup — CSV import
        // Setup — user-facility assignments
        // Setup — auto-create compliance checklist
        // Setup — print templates
        // Setup — clinical masters (religions, occupations, relations)
        // Setup — insurance providers
        // Setup — bulk / template / health / config
        // Patients
        .merge(medbrains_patients::router())
        // Patient — identifiers
        // Patient — addresses
        // Patient — contacts
        // Patient — insurance
        // Patient — allergies
        // Patient — consents
        // Patient — family links
        // Patient — documents
        // Patient — photo
        // Patient — merge history
        // Patient visit history / timeline
        // Masters — religions, occupations, relations
        .merge(medbrains_tokens::router())
        // Notification centre — per-user in-app feed
        .route("/api/notifications", get(notifications::list_notifications))
        .route(
            "/api/notifications/unread-count",
            get(notifications::notifications_unread_count),
        )
        .route(
            "/api/notifications/{id}/read",
            post(notifications::mark_notification_read),
        )
        .route(
            "/api/notifications/read-all",
            post(notifications::mark_all_notifications_read),
        )
        .route(
            "/api/notifications/push-tokens",
            post(notifications::register_push_token),
        )
        // Dashboards — user-facing
        .merge(medbrains_dashboard::router())
        // Widget templates — user-facing (permission/dept filtered)
        // Dashboard — summary
        // Dashboard — widget data
        // ── OPD + OPD Appointments ──────────────────────────
        .merge(medbrains_opd::router())
        // Minted when a prescription is printed; the QR on the paper points at
        // the token this returns.
        .route(
            "/api/opd/encounters/{id}/verify-link",
            post(rx_verify::issue_verify_link),
        )
        .route(
            "/api/opd/schedules",
            get(appointments::list_schedules).post(appointments::create_schedule),
        )
        .route(
            "/api/opd/schedules/{id}",
            put(appointments::update_schedule).delete(appointments::delete_schedule),
        )
        .route(
            "/api/opd/schedule-exceptions",
            get(appointments::list_exceptions).post(appointments::create_exception),
        )
        .route(
            "/api/opd/schedule-exceptions/{id}",
            delete(appointments::delete_exception),
        )
        .route(
            "/api/opd/doctors/{doctor_id}/slots",
            get(appointments::get_available_slots),
        )
        .route(
            "/api/opd/appointments",
            get(appointments::list_appointments).post(appointments::book_appointment),
        )
        .route(
            "/api/opd/appointments/{id}",
            get(appointments::get_appointment),
        )
        .route(
            "/api/opd/appointments/{id}/reschedule",
            put(appointments::reschedule_appointment),
        )
        .route(
            "/api/opd/appointments/{id}/cancel",
            put(appointments::cancel_appointment),
        )
        .route(
            "/api/opd/appointments/{id}/check-in",
            put(appointments::check_in_appointment),
        )
        .route(
            "/api/opd/queue-tokens/{id}/status-link",
            get(appointments::queue_token_status_link),
        )
        .route(
            "/api/opd/appointments/{id}/complete",
            put(appointments::complete_appointment),
        )
        .route(
            "/api/opd/appointments/{id}/no-show",
            put(appointments::mark_appointment_no_show),
        )
        .merge(medbrains_platform::router())
        .merge(medbrains_telehealth::router())
        // ── Billing ──────────────────────────────────────
        .merge(medbrains_billing::router())
        // Interim MUST be before {id} to avoid matching "interim" as a UUID
        // ── Billing Advances ─────────────────────────────
        // ── Billing Corporates ───────────────────────────
        // ── Billing Reports ──────────────────────────────
        // ── Billing Day Close ──────────────────────────────
        // ── Billing Write-Offs ─────────────────────────────
        // ── Billing TPA Rate Cards ─────────────────────────
        // ── Billing Clone & Audit ──────────────────────────
        // ── Billing Phase 3 — Exchange Rates ─────────────
        // ── Billing Phase 3 — Invoice Print & Threshold ──
        // ── Billing Phase 3 — Credit Patients ────────────
        // Static route MUST be before {id} to avoid "aging" matching as UUID
        // ── Billing Phase 3 — Dual Insurance ─────────────
        // ── Billing Phase 3 — GL Accounts ────────────────
        // ── Billing Phase 3 — Journal Entries ────────────
        // ── Billing Phase 3 — Bank Reconciliation ────────
        // Static routes MUST be before {id}
        // ── TPA reconciliation (priority #4) ─────────────
        // ── Billing Phase 3 — TDS ───────────────────────
        // ── Billing Phase 3 — GST Returns ────────────────
        // Static route MUST be before {id}
        // ── Billing Phase 3 — Financial MIS & P&L ───────
        // ── Billing Phase 3 — ERP Export ─────────────────
        // ── Billing Concessions ─────────────────────────
        // ── Payment Gateway ─────────────────────────────
        .merge(medbrains_payment_gateway::router())
        // ── OAuth connect (common token module) ──────────
        .merge(medbrains_oauth::router())
        // ── Lab ──────────────────────────────────────────
        .merge(medbrains_lab::router())
        .merge(medbrains_radiology::router())
        // ── Pharmacy ────────────────────────────────────
        .merge(medbrains_pharmacy::router())
        .merge(medbrains_ward_stock::router())
        .merge(medbrains_clinical_notes::router())
        // ── Pharmacy Finance (credit notes + store indents) ──
        .merge(medbrains_pharmacy_finance::router())
        .merge(medbrains_pharmacy_fulfilment::router())
        // ── Pharmacy Safety ──────────────────────────────
        .merge(medbrains_pharmacy_safety::router())
        // ── Pharmacy Payments ────────────────────────────
        .merge(medbrains_pharmacy_payments::router())
        // ── ABDM (Phase 11): HFR/HPR registries + gateway HIP relay ─
        .route("/api/abdm/hfr", get(abdm::hfr::list_registrations))
        .route("/api/abdm/hfr/facilities", get(abdm::hfr::list_facilities))
        .route("/api/abdm/hfr/facilities/{id}", put(abdm::hfr::link_facility))
        .route(
            "/api/abdm/hfr/facilities/{id}/register",
            post(abdm::hfr::register_facility),
        )
        .route("/api/abdm/hpr/coverage", get(abdm::hpr::coverage))
        .route("/api/abdm/hpr/doctors/{id}", put(abdm::hpr::set_hpr_id))
        .route(
            "/api/abdm/hpr/doctors/{id}/verify",
            post(abdm::hpr::verify_hpr_id),
        )
        .route(
            "/api/abdm/settings",
            get(abdm::settings::get_settings).put(abdm::settings::save_settings),
        )
        .route(
            "/api/abdm/settings/test",
            post(abdm::settings::test_connection),
        )
        .route(
            "/api/abdm/abha/status",
            get(abdm::abha::status),
        )
        .route(
            "/api/abdm/abha/verifications",
            post(abdm::abha_verify::start),
        )
        .route(
            "/api/abdm/abha/verifications/{id}/resend",
            post(abdm::abha_verify::resend),
        )
        .route(
            "/api/abdm/abha/verifications/{id}/otp",
            post(abdm::abha_verify::submit_otp),
        )
        .route(
            "/api/abdm/abha/verifications/{id}/account",
            post(abdm::abha_verify::choose_account),
        )
        .route(
            "/api/abdm/abha/enrolments",
            post(abdm::abha_enrol::start),
        )
        .route(
            "/api/abdm/abha/enrolments/{id}/otp",
            post(abdm::abha_enrol::submit_otp),
        )
        .route(
            "/api/abdm/abha/enrolments/{id}/mobile-otp",
            post(abdm::abha_enrol::submit_mobile_otp),
        )
        .route(
            "/api/abdm/abha/enrolments/{id}/address",
            post(abdm::abha_enrol::choose_address),
        )
        .route(
            "/api/abdm/abha/verifications/{id}/qr",
            get(abdm::abha_card::qr),
        )
        .route(
            "/api/abdm/abha/verifications/{id}/mobile",
            post(abdm::abha_account::request_mobile),
        )
        .route(
            "/api/abdm/abha/verifications/{id}/mobile/verify",
            post(abdm::abha_account::verify_mobile),
        )
        .route(
            "/api/abdm/abha/verifications/{id}/email",
            post(abdm::abha_account::request_email),
        )
        .route(
            "/api/abdm/abha/verifications/{id}/card",
            get(abdm::abha_card::card),
        )
        .route(
            "/api/abdm/abha/verifications/{id}/link",
            post(abdm::abha_link::link),
        )
        .route(
            "/api/abdm/patients/{patient_id}/records",
            get(abdm::hip::records::patient_records),
        )
        .route(
            "/api/abdm/care-contexts/{id}/link",
            post(abdm::hip::records::link_now),
        )
        .route(
            "/api/abdm/sharing/summary",
            get(abdm::hip::records::sharing_summary),
        )
        .route("/api/abdm/dashboard", get(abdm::dashboard::dashboard))
        .route(
            "/api/abdm/scan-share/counters",
            get(abdm::scan_share::counters),
        )
        .route("/api/abdm/scan-share/queue", get(abdm::scan_share::queue))
        .route(
            "/api/abdm/scan-share/{id}/verification",
            post(abdm::scan_share::verification),
        )
        .route(
            "/api/abdm/scan-share/{id}/complete",
            post(abdm::scan_share::complete),
        )
        .route(
            "/api/abdm/scan-share/{id}/dismiss",
            post(abdm::scan_share::dismiss),
        )
        .route(
            "/api/abdm/patients/{patient_id}/consent-requests",
            post(abdm::hiu::requests::raise),
        )
        .route(
            "/api/abdm/patients/{patient_id}/received-records",
            get(abdm::hiu::view::patient_view),
        )
        .route(
            "/api/abdm/consent-requests/{id}/check-status",
            post(abdm::hiu::status::check),
        )
        .route(
            "/api/abdm/received-records/{id}",
            get(abdm::hiu::view::received_record),
        )
        .route(
            "/api/uhi/settings",
            get(uhi::settings::get_settings).put(uhi::settings::save_settings),
        )
        .route("/api/uhi/settings/keys", post(uhi::settings::generate_keys))
        .route("/api/uhi/requests", get(uhi::queue::list))
        .route("/api/uhi/requests/{id}/accept", post(uhi::queue::accept))
        .route("/api/uhi/requests/{id}/decline", post(uhi::queue::decline))
        .route(
            "/api/abdm/gateway/callbacks/pending",
            get(abdm::hip_relay::list_pending_callbacks),
        )
        .route(
            "/api/abdm/gateway/callbacks/{id}/ack",
            put(abdm::hip_relay::ack_callback),
        )
        // ── Pharmacy Improvements: Repeats ─────────────────
        .merge(medbrains_pharmacy_repeats::router())
        .merge(medbrains_pharmacy_delivery::router())
        // ── Pharmacy Finance: Cash Drawer ──────────────────
        .merge(medbrains_pharmacy_cash_drawer::router())
        // ── Nurse Activities: MAR (canonical ipd_medication_administration) ──
        .merge(medbrains_ipd::router())
        .merge(medbrains_nursing::router())
        // ── Clinical offline-mode REST adapters (Phase 7) ─────────────
        // Mirror endpoints for the four CRDT hooks. Same data the edge
        // node holds in Loro containers — surfaced here for tenants
        // running in REST mode.
        .merge(medbrains_clinical_offline::router())
        // ── Pharmacy Improvements: Substitution + Counseling + Coverage
        .merge(medbrains_pharmacy_dispense_ops::router())
        // ── Pharmacy Finance: Petty Cash + Float Movements ─
        .merge(medbrains_pharmacy_petty_cash::router())
        // ── Pharmacy Finance: Free Dispensing + Overrides + Suppliers + Margins
        .merge(medbrains_pharmacy_free_dispensing::router())
        .merge(medbrains_indent::router())
        .merge(medbrains_materials::router())
        // ── Quality Management ──────────────────────────────
        .merge(medbrains_quality::router())
        // ── Quality Extended Analytics ───────────────────
        // ── Regulatory & Compliance ──────────────────────
        // Dashboard
        .merge(medbrains_regulatory::router())
        // Checklists
        // ADR Reports
        // Materiovigilance
        // PCPNDT Forms
        // Compliance Calendar
        // ── Regulatory Extended ─────────────────────────
        .merge(medbrains_infection_control::router())
        .merge(medbrains_infra_utils::router())
        // ── Orchestration Engine ────────────────────────────
        .route(
            "/api/orchestration/events",
            get(orchestration::list_events),
        )
        .route(
            "/api/orchestration/connectors",
            get(orchestration::list_connectors)
                .post(orchestration::create_connector),
        )
        .route(
            "/api/orchestration/connectors/{id}",
            put(orchestration::update_connector),
        )
        .route(
            "/api/orchestration/connectors/{id}/test",
            post(orchestration::test_connector),
        )
        .route(
            "/api/orchestration/jobs",
            get(orchestration::list_jobs),
        )
        .route(
            "/api/orchestration/jobs/stats",
            get(orchestration::job_stats),
        )
        .merge(medbrains_custom_code::router())
        // ── AI Clinical Copilot — streaming chat (SSE) + history + whispers ─
        .merge(medbrains_ai::router())
        // ── VPN platform — device enrollment (RFC-VPN-PLATFORM) ─
        .merge(medbrains_vpn::router())
        // ── IPD Phase 2: Wards, Bed Dashboard, Reports, Templates ─
        // Registered BEFORE /api/ipd/admissions/{id} to avoid path collision
        .merge(medbrains_microsite::router())
        .merge(medbrains_specialty::router())
        .merge(medbrains_ancillary::router())
        .merge(medbrains_home_health::router())
        // ── Case-sheet digitization (B2 ingestion) ──
        .merge(medbrains_case_sheet_scan::router())
        // ── IPD Admissions ──────────────────────────────────
        // ── IPD Clinical Expansion ─────────────────────────
        // ── IPD Phase 2b: IP Types, Checklists, Reservations, Clinical Docs, etc. ──
        // ── IPD Phase 3a: Cross-module reads ────────────────
        // ── IPD post-discharge workflow (Track 1A.bis.4) ──
        .merge(medbrains_ipd_post_discharge::router())
        // ── NABH KPI rollup ───────────────────────────────
        .merge(medbrains_reports::nabh_indicators::router())
        // ── Operation Theatre ──────────────────────────────
        .merge(medbrains_ot::router())
        .merge(medbrains_blood_bank::router())
        .merge(medbrains_cssd::router())
        .merge(medbrains_emergency::router())
        .merge(medbrains_diet::router())
        // ── HR & Staff Management ───────────────────────────
        .merge(medbrains_hr::router())
        // ── Payroll ──
        .merge(medbrains_payroll::router())
        // ── BME / CMMS ───────────────────────────────────────
        .merge(medbrains_bme::router())
        // ── Unified Assets & Stores ─────────────────────────
        .merge(medbrains_assets::router())
        .merge(medbrains_materials::ops::router())
        .merge(medbrains_lms::router())
        // ── MRD (Medical Records Department) ────────────────────
        .merge(medbrains_mrd::router())
        // ── Consent Management ───────────────────────────────
        .merge(medbrains_consent::router())
        .merge(medbrains_forms::router())
        // ── Camp Management ───────────────────────────────────
        .merge(medbrains_camp::router())
        .merge(medbrains_ambulance::router())
        .merge(medbrains_care_mgmt::router())
        // ── Communication Hub ─────────────────────────────────
        .merge(medbrains_communications::router())
        .merge(medbrains_analytics::router())
        .merge(medbrains_facilities::router())
        // NHCX — callback history, status and Settings → NHCX.
        .merge(medbrains_nhcx_callback::router())
        // ── Security Department ──────────────────────────────────
        .merge(medbrains_security::router())
        // ── Specialty Clinical: Oncology depth (staging + radiation) ──
        .merge(medbrains_specialty_other::router())
        // ── Specialty Clinical: Cath Lab ──
        .merge(medbrains_specialty_interventional::router())
        // ── Specialty Clinical: Endoscopy ──
        // ── Specialty Clinical: PMR / Audiology ──
        // ── Specialty Clinical: Palliative / Mortuary / Nuclear Medicine ──
        // ── Specialty Clinical: Other Specialties ──
        .merge(medbrains_documents::router())
        // ── Order Basket ────────────────────────────────────
        .merge(medbrains_order_basket::router())
        // ── Doctor Packages (admin) ─────────────────────────
        .merge(medbrains_doctor_packages::router())
        .merge(medbrains_doctor_payouts::router())
        // ── Patient Packages ────────────────────────────────
        .merge(medbrains_patient_packages::router())
        // ── Doctor Coverage (admin) ─────────────────────────
        .route(
            "/api/admin/coverage",
            get(coverage::list_coverage).post(coverage::create_coverage),
        )
        .route(
            "/api/admin/coverage/{id}",
            delete(coverage::delete_coverage),
        )
        // ── Order Sets ──────────────────────────────────────
        .merge(medbrains_order_sets::router())
        .merge(medbrains_community_health::router())
        .merge(medbrains_scheduling::router())
        // ── Clinical & Operational Analytics ────────────────────
        .merge(medbrains_reports::analytics::router())
        // ── Governed Reports Command Center ───────────────────
        .merge(medbrains_reports::reports::router())
        // ── Print Data (clinical) ─────────────────────────────
        .merge(medbrains_print_data::general::router())
        .merge(medbrains_print_data::clinical::router())
        // ── Print Data (billing) ──────────────────────────────
        .merge(medbrains_print_data::billing::router())
        // ── Print Data (consent forms) ───────────────────────────
        .merge(medbrains_print_data::consent::router())
        // ── Print Data (MRD forms) ───────────────────────────────
        .merge(medbrains_print_data::mrd::router())
        // ── Print Data (Phase 3: Clinical Charts) ───────────────
        // ── Print Data (Phase 3: Surgical & OT) ─────────────────
        .merge(medbrains_print_data::surgical::router())
        // ── Print Data (Phase 3: Medico-Legal) ──────────────────
        .merge(medbrains_print_data::medicolegal::router())
        // ── Print Data (Phase 3: Quality & Safety) ──────────────
        .merge(medbrains_print_data::quality::router())
        // ── Phase 4: Clinical Delivery Prints ─────────────────────
        // Phase 4 billing prints already registered above (credit-note, package-bill, insurance-claim, tds-certificate)
        // ── Phase 4: Regulatory Prints ─────────────────────────────
        .merge(medbrains_print_data::regulatory::router())
        // ── Phase 4: Admin & Procurement Prints ─────────────────────
        .merge(medbrains_print_data::admin::router())
        // ══════════════════════════════════════════════════════════
        // PHASE 5: Admin/HR, BME, Blood Bank, OT, Clinical Forms
        // ══════════════════════════════════════════════════════════
        // ── Phase 5: Admin/HR Forms ───────────────────────────────
        .merge(medbrains_print_data::hr::router())
        // ── Phase 5: BME/Engineering Forms ────────────────────────
        .merge(medbrains_print_data::bme::router())
        // ── Phase 5: Blood Bank & OT Forms ────────────────────────
        // ── Phase 5: Clinical/Identity Forms ──────────────────────
        // appointment-slip already registered above
        // ══════════════════════════════════════════════════════════
        // PHASE 6: ACADEMIC/SPECIALTY FORMS & BRANDING
        // ══════════════════════════════════════════════════════════
        // -- Phase 6: Academic/Medical College Forms --
        .merge(medbrains_print_data::academic::router())
        // -- Phase 6: Hospital Branding --
        // ── Multi-Hospital Management ──────────────────────────────────
        .merge(medbrains_admin::router())
        // ── CMS & Blog ──────────────────────────────────────────────
        // Dashboard
        // Categories
        // Tags
        // Authors
        // Media Library
        // Posts
        // Post Workflow
        // Post Revisions
        // Post Analytics
        // Subscribers
        // Pages
        // Settings
        // Menus
        // ── TV Displays & Queue ──────────────────────────────────
        .merge(medbrains_tv::router())
        // Specialty queue displays
        // ── Audit Trail ────────────────────────────────────────
        .route(
            "/api/audit/log",
            get(audit::list_audit_log),
        )
        .route(
            "/api/audit/log/{id}",
            get(audit::get_audit_entry),
        )
        .route(
            "/api/audit/log/entity/{entity_type}/{entity_id}",
            get(audit::entity_audit_trail),
        )
        .route(
            "/api/audit/chain-verifications",
            get(audit::list_chain_verifications),
        )
        .route(
            "/api/audit/stats",
            get(audit::audit_stats),
        )
        .route(
            "/api/audit/access-log",
            get(audit::list_access_log).post(audit::log_access),
        )
        // Internal data simulator control plane (super_admin / hospital_admin).
        // Schedules carry a JSON profile + cron; run-now kicks the engine
        // in a detached task and returns the run_id immediately.
        .route(
            "/api/admin/simulator/schedules",
            get(admin_simulator::list_schedules).post(admin_simulator::create_schedule),
        )
        .route(
            "/api/admin/simulator/schedules/{id}",
            get(admin_simulator::get_schedule)
                .put(admin_simulator::update_schedule)
                .delete(admin_simulator::delete_schedule),
        )
        .route(
            "/api/admin/simulator/schedules/{id}/run-now",
            post(admin_simulator::run_now),
        )
        // Message simulator phone view — 404 unless the simulator is on.
        .route(
            "/api/admin/message-simulator/messages",
            get(message_simulator::list_messages),
        )
        .route("/api/admin/simulator/preview", post(admin_simulator::preview))
        .route(
            "/api/admin/simulator/runs/{id}/approve",
            post(admin_simulator::approve_run),
        )
        .route(
            "/api/admin/simulator/runs/{id}/reject",
            post(admin_simulator::reject_run),
        )
        .route("/api/admin/simulator/runs", get(admin_simulator::list_runs))
        .route(
            "/api/admin/simulator/runs/{id}",
            get(admin_simulator::get_run),
        )
        // Medical news feed — global ingested articles (list/search + reader).
        // News / health advisories — public list (any auth'd role), admin CRUD.
        .merge(medbrains_news::router())
        .merge(medbrains_notes::router())
        .route(
            "/api/audit/access-log/patient/{id}",
            get(audit::patient_access_log),
        )
        .route(
            "/api/audit/modules",
            get(audit::list_modules),
        )
        .route(
            "/api/audit/entity-types",
            get(audit::list_entity_types),
        )
        .route(
            "/api/audit/export",
            get(audit::export_audit_log),
        )
        .route(
            "/api/audit/verify-integrity",
            get(audit::verify_integrity),
        )
        .route(
            "/api/audit/user/{id}/activity",
            get(audit::user_activity),
        )
        .route(
            "/api/audit/timeline/{entity_type}/{entity_id}",
            get(audit::entity_timeline),
        )
        // ── IT Security: Break-Glass ─────────────────────────────────
        .merge(medbrains_it_security::router())
        // ── IT Security: Clinical Access Monitor ─────────────────────
        // ── IT Security: Stock Disposal ──────────────────────────────
        // ── IT Security: TAT Tracking ────────────────────────────────
        // ── IT Security: Data Migration ──────────────────────────────
        // ── IT Security: EOD Digest ──────────────────────────────────
        // ── IT Security: Data Quality ────────────────────────────────
        // ── IT Security: CERT-In Compliance ──────────────────────────
        // ── IT Security: System Health & Monitoring ──────────────────
        // ── IT Security: Onboarding Wizard ───────────────────────────
        // ── IT Security: Incentive Configuration ─────────────────────
        // ── Device Integration ───────────────────────────────────────
        // Adapter catalog (global knowledge base)
        .merge(medbrains_devices::router())
        // Device instances (per-tenant CRUD)
        // Routing rules
        // Bridge agents
        // Device data ingest (bridge agent calls)
        // Mobile/TV device pairing — admin mints a one-time QR token,
        // device exchanges for JWT + cert fingerprint
        // S3 presigned upload / download URL endpoints
        .merge(medbrains_upload::router())
        // Sprint A.6 — system_state middleware short-circuits non-GET when
        // tenant is in read_only/degraded mode. Innermost so claims + path
        // are populated and 503 response carries no audit weight.
        .layer(from_fn_with_state(state.clone(), system_state_layer))
        // RFC-INFRA-2026-002 Phase 2 — audit + read-side PHI access logging.
        // Layers run outer→inner, so order here is: ip_restrict → csrf →
        // auth → client_ip → audit_layer → access_log_layer → handler.
        // audit needs auth + client_ip already populated, so it sits inside.
        .layer(from_fn_with_state(state.clone(), audit_layer))
        // Tiered per-IP rate limiting: heavy read paths (reports,
        // analytics, exports, print-data) 30/min; everything else a
        // 600/min runaway-client safety net (audit P1 #170).
        .layer(from_fn_with_state(
            RateLimiter::new(),
            tiered_rate_limit_middleware,
        ))
        .layer(from_fn_with_state(state.clone(), access_log_layer))
        .layer(from_fn_with_state(state.clone(), ip_restrict_middleware))
        .layer(from_fn(csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
        .layer(from_fn_with_state(state.clone(), client_ip_middleware));

    // ── Bridge Agent Registration (no JWT auth — uses API key) ──
    let bridge_routes = medbrains_devices::bridge_router();

    // ── Public endpoints (no auth) ──
    let public_booking = Router::new()
        .route(
            "/api/public/appointments/slots",
            get(appointments::public_available_slots),
        )
        .route(
            "/api/public/appointments/book",
            post(appointments::public_book_appointment),
        )
        .route(
            "/api/public/appointments/otp",
            post(appointments::request_public_booking_otp),
        )
        .route(
            "/api/public/appointments/directory",
            get(appointments::public_bookable_doctors),
        )
        .route(
            "/api/public/kiosk/checkin",
            post(appointments::kiosk_checkin),
        )
        .route(
            "/api/public/queue-token/{token}",
            get(appointments::public_token_status),
        )
        .route(
            "/api/public/radiology/viewer/{token}",
            get(radiology::validate_share_link),
        )
        // Patient portal sign-in. Unauthenticated by necessity — this is how a
        // patient gets a token in the first place.
        .route("/api/portal/auth/request-otp", post(portal::request_portal_otp))
        .route("/api/portal/auth/verify", post(portal::verify_portal_otp))
        // Scanned by a pharmacist at a counter, who is not a user of this
        // system — so the token in the URL is the whole credential.
        .route(
            "/api/public/prescriptions/verify/{token}",
            get(rx_verify::verify_prescription),
        )
        // The QR on a printed bill: insurers and patients check it is genuine.
        .route("/api/public/bills/verify", get(bill_verify::verify_bill))
        // The hospital's own "contact us" form. Off unless the tenant turns it
        // on, and 404 either way so this cannot enumerate who runs MedBrains.
        .merge(medbrains_marketing::public_router());

    // ── Patient portal — behind require_patient, never the staff auth stack.
    //    A staff token cannot satisfy this extractor and a patient token cannot
    //    satisfy the staff one; the two shapes are mutually undecodable.
    let portal_routes = Router::new()
        .route("/api/portal/bills", get(portal::portal_bills))
        .route("/api/portal/bills/{id}/pay", post(portal_pay::portal_pay_bill))
        .route("/api/portal/lab-reports", get(portal::portal_lab_reports))
        .route(
            "/api/portal/prescriptions",
            get(portal::portal_prescriptions),
        )
        .route("/api/portal/appointments", get(portal::portal_appointments))
        .route("/api/portal/entitlements", get(portal::portal_entitlements))
        .route("/api/portal/refills", get(portal_refills::portal_refills))
        .route("/api/portal/teleconsults", get(portal_tele::portal_teleconsults))
        .route(
            "/api/portal/prescriptions/{id}/refill-request",
            post(portal_refills::portal_request_refill),
        )
        .route(
            "/api/portal/prescriptions/{id}/delivery-options",
            get(portal_deliveries::portal_delivery_options),
        )
        .route("/api/portal/deliveries", get(portal_deliveries::portal_deliveries))
        // The storefront, signed in: cart, prescription, checkout, orders.
        .route("/api/portal/store/cart", get(portal_store::store_cart))
        .route(
            "/api/portal/store/cart/items/{id}",
            put(portal_store::store_set_quantity),
        )
        .route(
            "/api/portal/store/cart/prescription",
            put(portal_store::store_upload_prescription)
                .layer(axum::extract::DefaultBodyLimit::max(STORE_RX_BODY_LIMIT)),
        )
        .route(
            "/api/portal/store/delivery-options",
            get(portal_store::store_delivery_options),
        )
        .route("/api/portal/store/checkout", post(portal_store::store_checkout))
        .route("/api/portal/store/orders", get(portal_store::store_orders))
        .route("/api/portal/store/orders/{id}", get(portal_store::store_order))
        .route(
            "/api/portal/store/prescriptions/{id}/order",
            post(portal_store::store_order_prescription),
        )
        .route(
            "/api/portal/deliveries/{id}",
            get(portal_deliveries::portal_delivery),
        )
        .route("/api/portal/privacy", get(portal_privacy::portal_privacy))
        .route("/api/portal/privacy/export", get(portal_privacy::portal_export))
        .route("/api/portal/dpdp-consent", put(portal_privacy::portal_set_consent))
        .route(
            "/api/portal/privacy-requests",
            post(portal_privacy::portal_create_request),
        )
        .layer(from_fn_with_state(state.clone(), portal::require_patient));

    // ── The storefront before sign-in: browse, and sign in with a mobile.
    //    Public, so bounded per IP; codes far more tightly than browsing.
    let store_public_routes = Router::new()
        .route("/api/store/{tenant_code}/about", get(store_public::store_about))
        .route("/api/store/{tenant_code}/items", get(store_public::store_items))
        .route(
            "/api/store/{tenant_code}/items/{id}",
            get(store_public::store_item),
        )
        .route(
            "/api/store/{tenant_code}/otp",
            post(store_public::store_request_code),
        )
        .route(
            "/api/store/{tenant_code}/sign-in",
            post(store_public::store_sign_in),
        )
        .layer(from_fn_with_state(
            RateLimiter::new(),
            storefront_rate_limit_middleware,
        ));

    // ── Reminder config — protected, must run through the same auth +
    //    csrf + audit middleware stack as `protected`. Without these
    //    layers the handler's `Extension<Claims>` extractor 500s.
    let reminder_routes = Router::new()
        .route(
            "/api/opd/appointments/reminder-config",
            get(appointments::get_reminder_config).put(appointments::update_reminder_config),
        )
        .layer(from_fn_with_state(state.clone(), audit_layer))
        .layer(from_fn_with_state(state.clone(), access_log_layer))
        .layer(from_fn_with_state(state.clone(), ip_restrict_middleware))
        .layer(from_fn(csrf_middleware))
        .layer(from_fn_with_state(state.clone(), auth_middleware))
        .layer(from_fn_with_state(state.clone(), client_ip_middleware));

    public
        .merge(protected)
        .merge(bridge_routes)
        .merge(public_booking)
        .merge(portal_routes)
        .merge(store_public_routes)
        .merge(reminder_routes)
        // An API path nothing answers is a JSON 404, never the app's HTML:
        // the SPA fallback answers 200, so a mistyped call would otherwise
        // read as success. Specific routes win over the wildcard.
        .route(
            "/api/{*rest}",
            axum::routing::any(|| async { medbrains_server_core::error::AppError::NotFound }),
        )
        .with_state(state)
}

pub mod abdm;
pub mod access;
pub mod app_manifest;
pub mod vte;
pub mod admin;
pub mod admin_simulator;
pub mod ai;
pub mod appointments;
pub mod audit;
pub mod auth;
pub mod billing;
pub mod catalog_import;
pub mod client_errors;
pub mod clinical_offline;
pub mod coverage;
pub mod debug;
pub mod device_pairing;
pub mod doctor_packages;
pub mod documents_render;
pub mod email_verification;
pub mod fhir;
pub mod health;
pub mod infra_settings;
pub mod invitations;
pub mod mail_provisioning;
pub mod ipd_post_discharge;
pub mod materials;
pub mod mfa;
pub use medbrains_server_core::nabh_evidence;
// scheduling routes moved to the medbrains-scheduling leaf; re-exported so
// reports.rs (which reuses scheduling helpers) keeps resolving crate::routes::scheduling.
pub use medbrains_scheduling::scheduling;
pub use medbrains_telehealth::cds;
pub use medbrains_platform::ckb;
pub mod news;
pub mod nhcx_callback;
pub mod nhcx_onboarding;
pub use medbrains_server_core::notifications;
pub use medbrains_identity::sso;
pub use medbrains_server_core::step_up;
pub use medbrains_server_core::signed_documents;
pub use medbrains_print_data::billing as print_data_billing;
pub use medbrains_print_data::clinical as print_data_clinical;
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
pub use medbrains_vpn as vpn;
pub use medbrains_setup as setup;
// billing/lab/pharmacy/patients/appointments reach token helpers via crate::routes::tokens
pub use medbrains_tokens as tokens;
pub mod oauth;
pub mod onboarding;
pub mod orchestration;
pub mod order_basket;
pub mod patient_packages;
pub mod payroll;
pub mod pharmacy_cash_drawer;
pub mod pharmacy_dispense_ops;
pub mod pharmacy_free_dispensing;
pub mod pharmacy_payments;
pub mod pharmacy_petty_cash;
pub mod pharmacy_repeats;
pub mod sso_login;

pub mod case_sheet_scan;
pub mod ward_stock;
pub mod sharing;

pub mod upload;
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
        rate_limit::{RateLimiter, rate_limit_middleware, tiered_rate_limit_middleware},
        system_state::system_state_layer,
    },
    state::AppState,
};

/// Build the application router — auth + health + onboarding + setup + geo + patients.
#[allow(clippy::too_many_lines, clippy::large_stack_frames)]
pub fn build_router(state: AppState) -> Router {
    // Rate limiter for login endpoint (5 attempts per 60s per IP)
    let login_limiter = RateLimiter::new();

    // Rate-limited login route
    let login_route = Router::new()
        .route("/api/auth/login", post(auth::login))
        .layer(from_fn_with_state(login_limiter, rate_limit_middleware));

    // Password reset — public, shares the login limiter shape (per-IP)
    let reset_limiter = RateLimiter::new();
    let password_reset_routes = Router::new()
        .route(
            "/api/auth/password-reset/request",
            post(auth::request_password_reset),
        )
        .route(
            "/api/auth/password-reset/confirm",
            post(auth::confirm_password_reset),
        )
        .layer(from_fn_with_state(reset_limiter, rate_limit_middleware));

    // Public routes (no auth required)
    let public = Router::new()
        .merge(login_route)
        .merge(password_reset_routes)
        .route("/api/health", get(health::health_check))
        .route("/api/auth/refresh", post(auth::refresh_token))
        // Enterprise SSO login flow — pre-auth (no JWT yet).
        .route(
            "/api/auth/sso/providers",
            get(sso_login::list_active_providers),
        )
        .route(
            "/api/auth/sso/{provider_id}/authorize",
            get(sso_login::oidc_authorize),
        )
        .route("/api/auth/sso/callback", get(sso_login::oidc_callback))
        // NHCX async-response webhook — gateway authenticates via JWS,
        // not bearer token, so this lives on the public router.
        .route(
            "/api/integrations/nhcx/callback",
            post(nhcx_callback::receive_callback),
        )
        // Device pairing — gated by short-lived one-time token, not JWT
        .route("/api/device-pairing/pair", post(device_pairing::pair_device))
        // Onboarding — public endpoints
        .route("/api/onboarding/status", get(onboarding::status))
        .route("/api/onboarding/init", post(onboarding::init))
        // Geo — public read-only endpoints
        // CMS Public API (no auth required)
        .route("/api/public/tenant-by-host", get(setup::tenant_by_host))
        .route(
            "/api/auth/verify-email",
            post(email_verification::verify_email),
        )
        .route(
            "/api/public/invitations/{token}",
            get(invitations::get_public),
        )
        .route(
            "/api/public/invitations/{token}/accept",
            post(invitations::accept),
        )
        .merge(medbrains_cms::router())
        // WebSocket routes (TV displays)
        .route("/ws/queue/{department_id}", get(ws::queue_ws_handler))
        .route("/ws/queue", get(ws::queue_ws_handler_all))
        .route("/ws/notifications", get(notifications::notifications_ws_handler))
        // Payment Gateway Webhooks (no auth — called by the provider)
        .route("/api/webhooks/razorpay", post(payment_gateway::razorpay_webhook))
        .route("/api/webhooks/cashfree", post(payment_gateway::cashfree_webhook))
        .route("/api/webhooks/razorpayx", post(payment_gateway::razorpayx_webhook));

    // Protected routes (auth required)
    let protected = Router::new()
        // Auth
        .route("/api/auth/me", get(auth::me))
        .route(
            "/api/auth/resend-verification",
            post(email_verification::resend),
        )
        .route("/api/client-errors/report", post(client_errors::report_client_error))
        .route("/api/access/manifest", get(access::get_manifest))
        .route("/api/app/manifest", get(app_manifest::get_app_manifest))
        .merge(medbrains_clinical_scores::router())
        .merge(medbrains_clinical_ops::router())
        .route("/api/vte-assessments", post(vte::create_vte_assessment))
        .route(
            "/api/patients/{patient_id}/vte-assessments",
            get(vte::list_vte_assessments),
        )
        .merge(medbrains_setup::router())
        // ── FHIR R4 read API (ABDM HIE-CM HIP role + generic interop) ──
        .route("/api/fhir/metadata", get(fhir::metadata))
        .route("/api/fhir/Patient/{id}", get(fhir::read_patient))
        .route("/api/fhir/Patient/{id}/$everything", get(fhir::patient_everything))
        .route("/api/fhir/Encounter/{id}", get(fhir::read_encounter))
        .route("/api/debug/authz-probe", get(health::authz_probe))
        .route(
            "/api/debug/e2e/canonical-fixtures",
            post(debug::seed_canonical_fixtures),
        )
        // ── Sharing API (manual per-resource grants) ─────────
        .route("/api/sharing/subjects", get(sharing::list_subjects))
        .route(
            "/api/sharing/grants",
            post(sharing::create_grant)
                .delete(sharing::revoke_grant)
                .get(sharing::list_grants),
        )
        .route("/api/sharing/granted-to-me", get(sharing::list_granted_to_me))
        .merge(medbrains_identity::router())
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/step-up", post(step_up::step_up))
        .route("/api/auth/logout-all", post(auth::logout_all))
        .route("/api/auth/change-password", post(auth::change_password))
        .route("/api/auth/mfa/enroll", post(mfa::enroll))
        .route("/api/auth/mfa/activate", post(mfa::activate))
        .route("/api/auth/mfa/disable", post(mfa::disable))
        // Phase A.1 — offline JWT revocation feed for mobile/TV/edge
        .route("/api/auth/revocations", get(auth::list_revocations))
        // Onboarding progress
        .route(
            "/api/onboarding/progress",
            get(onboarding::get_progress).put(onboarding::update_progress),
        )
        .route("/api/onboarding/setup", post(onboarding::setup))
        .route("/api/onboarding/complete", post(onboarding::complete))
        // Setup — tenant
        // Setup — generic tenant settings
        // Setup — brand entities (multi-entity branding)
        // Setup — facilities
        // Setup — locations
        // Setup — departments
        // Setup — roles
        // Setup — users
        // Server-side document rendering (epic #267)
        .route(
            "/api/documents/render",
            post(documents_render::render_document),
        )
        .route(
            "/api/documents/{id}/download",
            get(documents_render::download_document),
        )
        .route(
            "/api/documents/{id}/queue-print",
            post(documents_render::queue_print),
        )
        .route(
            "/api/documents/render/templates/{code}/preview",
            get(documents_render::preview_template),
        )
        .route(
            "/api/documents/render/templates",
            get(documents_render::list_templates),
        )
        .route(
            "/api/documents/render/templates/{code}",
            put(documents_render::save_template),
        )
        // Setup — modules
        .route("/api/setup/edition", get(onboarding::get_edition))
        .route("/api/setup/edition/apply", post(onboarding::apply_edition))
        // Setup — sequences
        // Setup — services
        .route(
            "/api/setup/services/import",
            post(catalog_import::import_services),
        )
        .route(
            "/api/admin/infra-status",
            get(infra_settings::get_infra_status),
        )
        .route(
            "/api/admin/ai-settings",
            get(infra_settings::get_ai_settings).put(infra_settings::update_ai_settings),
        )
        .route(
            "/api/admin/email-settings",
            get(infra_settings::get_email_settings).put(infra_settings::update_email_settings),
        )
        .route("/api/admin/email-log", get(infra_settings::get_email_log))
        .route(
            "/api/admin/email-test",
            post(infra_settings::send_email_test),
        )
        .route(
            "/api/admin/domain-status",
            get(infra_settings::get_domain_status),
        )
        .route(
            "/api/admin/mail/provision-domain",
            post(mail_provisioning::provision_domain),
        )
        .route(
            "/api/admin/mail/mailboxes",
            post(mail_provisioning::create_mailbox),
        )
        .route(
            "/api/admin/invitations",
            get(invitations::list).post(invitations::create),
        )
        .route("/api/admin/invitations/{id}", delete(invitations::revoke))
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
        .route(
            "/api/setup/masters/insurance-providers/import",
            post(catalog_import::import_insurance_providers),
        )
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
            "/api/opd/appointments/{id}/complete",
            put(appointments::complete_appointment),
        )
        .route(
            "/api/opd/appointments/{id}/no-show",
            put(appointments::mark_appointment_no_show),
        )
        .route(
            "/api/opd/procedure-catalog/import",
            post(catalog_import::import_procedure_catalog),
        )
        .merge(medbrains_platform::router())
        .merge(medbrains_telehealth::router())
        // ── Billing ──────────────────────────────────────
        .route(
            "/api/billing/invoices",
            get(billing::list_invoices).post(billing::create_invoice),
        )
        // Interim MUST be before {id} to avoid matching "interim" as a UUID
        .route(
            "/api/billing/invoices/interim",
            post(billing::create_interim_invoice),
        )
        .route(
            "/api/billing/invoices/{id}",
            get(billing::get_invoice).put(billing::update_invoice),
        )
        .route(
            "/api/billing/invoices/{id}/items",
            post(billing::add_invoice_item),
        )
        .route(
            "/api/billing/invoices/{id}/items/{iid}",
            delete(billing::remove_invoice_item),
        )
        .route(
            "/api/billing/invoices/{id}/issue",
            post(billing::issue_invoice),
        )
        .route(
            "/api/billing/invoices/{id}/cancel",
            post(billing::cancel_invoice),
        )
        .route(
            "/api/billing/invoices/{id}/close-zero",
            post(billing::close_zero_invoice),
        )
        .route(
            "/api/billing/invoices/{id}/payments",
            get(billing::list_payments).post(billing::record_payment),
        )
        .route(
            "/api/billing/charge-master",
            get(billing::list_charge_master).post(billing::create_charge_master),
        )
        .route(
            "/api/billing/charge-master/import",
            post(catalog_import::import_charge_master),
        )
        .route(
            "/api/billing/charge-master/{id}",
            put(billing::update_charge_master)
                .delete(billing::delete_charge_master),
        )
        .route(
            "/api/billing/packages",
            get(billing::list_packages).post(billing::create_package),
        )
        .route(
            "/api/billing/packages/{id}",
            get(billing::get_package)
                .put(billing::update_package)
                .delete(billing::delete_package),
        )
        .route(
            "/api/billing/rate-plans",
            get(billing::list_rate_plans).post(billing::create_rate_plan),
        )
        .route(
            "/api/billing/rate-plans/{id}",
            get(billing::get_rate_plan)
                .put(billing::update_rate_plan)
                .delete(billing::delete_rate_plan),
        )
        .route(
            "/api/billing/invoices/{id}/discounts",
            get(billing::list_discounts).post(billing::add_discount),
        )
        .route(
            "/api/billing/invoices/{id}/discounts/{did}",
            delete(billing::remove_discount),
        )
        .route(
            "/api/billing/refunds",
            get(billing::list_refunds).post(billing::create_refund),
        )
        .route(
            "/api/billing/credit-notes",
            get(billing::list_credit_notes).post(billing::create_credit_note),
        )
        .route(
            "/api/billing/credit-notes/{id}/apply",
            post(billing::apply_credit_note),
        )
        .route(
            "/api/billing/invoices/{id}/receipts",
            get(billing::list_receipts).post(billing::generate_receipt),
        )
        .route(
            "/api/billing/insurance-claims",
            get(billing::list_insurance_claims).post(billing::create_insurance_claim),
        )
        .route(
            "/api/billing/insurance-claims/{id}",
            get(billing::get_insurance_claim).put(billing::update_insurance_claim),
        )
        .route(
            "/api/billing/auto-charge",
            post(billing::trigger_auto_charge),
        )
        // ── Billing Advances ─────────────────────────────
        .route(
            "/api/billing/advances",
            get(billing::list_advances).post(billing::create_advance),
        )
        .route(
            "/api/billing/advances/{id}/adjust",
            post(billing::adjust_advance),
        )
        .route(
            "/api/billing/advances/{id}/refund",
            post(billing::refund_advance),
        )
        // ── Billing Corporates ───────────────────────────
        .route(
            "/api/billing/corporates",
            get(billing::list_corporates).post(billing::create_corporate),
        )
        .route(
            "/api/billing/corporates/{id}",
            get(billing::get_corporate).put(billing::update_corporate),
        )
        .route(
            "/api/billing/corporates/{id}/enrollments",
            get(billing::list_enrollments).post(billing::create_enrollment),
        )
        .route(
            "/api/billing/corporates/{cid}/enrollments/{eid}",
            delete(billing::delete_enrollment),
        )
        .route(
            "/api/billing/corporates/{id}/invoices",
            get(billing::list_corporate_invoices),
        )
        // ── Billing Reports ──────────────────────────────
        .route(
            "/api/billing/reports/summary",
            get(billing::report_summary),
        )
        .route(
            "/api/billing/reports/department-revenue",
            get(billing::report_department_revenue),
        )
        .route(
            "/api/billing/reports/collection-efficiency",
            get(billing::report_collection_efficiency),
        )
        .route(
            "/api/billing/reports/aging",
            get(billing::report_aging),
        )
        .route(
            "/api/billing/reports/daily",
            get(billing::report_daily),
        )
        .route(
            "/api/billing/reports/doctor-revenue",
            get(billing::report_doctor_revenue),
        )
        .route(
            "/api/billing/reports/insurance-panel",
            get(billing::report_insurance_panel),
        )
        .route(
            "/api/billing/reports/reconciliation",
            get(billing::report_reconciliation),
        )
        // ── Billing Day Close ──────────────────────────────
        .route(
            "/api/billing/day-closes",
            get(billing::list_day_closes).post(billing::create_day_close),
        )
        .route(
            "/api/billing/day-closes/{id}/verify",
            post(billing::verify_day_close),
        )
        // ── Billing Write-Offs ─────────────────────────────
        .route(
            "/api/billing/write-offs",
            get(billing::list_write_offs).post(billing::create_write_off),
        )
        .route(
            "/api/billing/write-offs/{id}/approve",
            post(billing::approve_write_off),
        )
        // ── Billing TPA Rate Cards ─────────────────────────
        .route(
            "/api/billing/tpa-rate-cards",
            get(billing::list_tpa_rate_cards).post(billing::create_tpa_rate_card),
        )
        .route(
            "/api/billing/tpa-rate-cards/{id}",
            put(billing::update_tpa_rate_card).delete(billing::delete_tpa_rate_card),
        )
        // ── Billing Clone & Audit ──────────────────────────
        .route(
            "/api/billing/invoices/{id}/clone",
            post(billing::clone_invoice),
        )
        .route(
            "/api/billing/audit-log",
            get(billing::list_audit_log),
        )
        // ── Billing Phase 3 — Exchange Rates ─────────────
        .route(
            "/api/billing/exchange-rates",
            get(billing::list_exchange_rates).post(billing::create_exchange_rate),
        )
        // ── Billing Phase 3 — Invoice Print & Threshold ──
        .route(
            "/api/billing/invoices/{id}/print-data",
            get(billing::get_invoice_print_data),
        )
        .route(
            "/api/billing/threshold-check/{encounter_id}",
            get(billing::check_billing_threshold),
        )
        .route(
            "/api/billing/scheme-rate",
            get(billing::get_scheme_rate_for_charge),
        )
        // ── Billing Phase 3 — Credit Patients ────────────
        .route(
            "/api/billing/credit-patients",
            get(billing::list_credit_patients).post(billing::create_credit_patient),
        )
        // Static route MUST be before {id} to avoid "aging" matching as UUID
        .route(
            "/api/billing/credit-patients/aging",
            get(billing::report_credit_aging),
        )
        .route(
            "/api/billing/credit-patients/{id}",
            put(billing::update_credit_patient),
        )
        // ── Billing Phase 3 — Dual Insurance ─────────────
        .route(
            "/api/billing/invoices/{id}/dual-insurance",
            get(billing::get_dual_insurance_status)
                .post(billing::coordinate_dual_insurance),
        )
        .route(
            "/api/billing/insurance-claims/{id}/reimbursement-docs",
            post(billing::generate_reimbursement_docs)
                .put(billing::update_reimbursement_docs),
        )
        // ── Billing Phase 3 — GL Accounts ────────────────
        .route(
            "/api/billing/gl-accounts",
            get(billing::list_gl_accounts).post(billing::create_gl_account),
        )
        .route(
            "/api/billing/gl-accounts/{id}",
            put(billing::update_gl_account),
        )
        // ── Billing Phase 3 — Journal Entries ────────────
        .route(
            "/api/billing/journal-entries",
            get(billing::list_journal_entries).post(billing::create_journal_entry),
        )
        .route(
            "/api/billing/journal-entries/{id}",
            get(billing::get_journal_entry),
        )
        .route(
            "/api/billing/journal-entries/{id}/post",
            post(billing::post_journal_entry),
        )
        .route(
            "/api/billing/journal-entries/{id}/reverse",
            post(billing::reverse_journal_entry),
        )
        // ── Billing Phase 3 — Bank Reconciliation ────────
        .route(
            "/api/billing/bank-transactions",
            get(billing::list_bank_transactions),
        )
        // Static routes MUST be before {id}
        .route(
            "/api/billing/bank-transactions/import",
            post(billing::import_bank_transactions),
        )
        .route(
            "/api/billing/bank-transactions/auto-reconcile",
            post(billing::auto_reconcile),
        )
        .route(
            "/api/billing/bank-transactions/{id}/match",
            post(billing::match_bank_transaction),
        )
        // ── TPA reconciliation (priority #4) ─────────────
        .route(
            "/api/billing/bank-transactions/auto-match",
            post(billing::auto_match_bank_transactions),
        )
        .route(
            "/api/billing/insurance-receivables/aging",
            get(billing::insurance_receivables_aging),
        )
        // NHCX webhook history — read-only audit log of received callbacks
        .route(
            "/api/integrations/nhcx/callbacks",
            get(nhcx_callback::list_callbacks),
        )
        // ── Billing Phase 3 — TDS ───────────────────────
        .route(
            "/api/billing/tds",
            get(billing::list_tds_deductions).post(billing::create_tds_deduction),
        )
        .route(
            "/api/billing/tds/{id}/deposit",
            post(billing::deposit_tds),
        )
        .route(
            "/api/billing/tds/{id}/certificate",
            post(billing::issue_tds_certificate),
        )
        // ── Billing Phase 3 — GST Returns ────────────────
        .route(
            "/api/billing/gst-returns",
            get(billing::list_gstr_summaries),
        )
        // Static route MUST be before {id}
        .route(
            "/api/billing/gst-returns/generate",
            post(billing::generate_gstr_summary),
        )
        .route(
            "/api/billing/gst-returns/{id}/file",
            post(billing::file_gstr),
        )
        .route(
            "/api/billing/reports/hsn-summary",
            get(billing::report_hsn_summary),
        )
        // ── Billing Phase 3 — Financial MIS & P&L ───────
        .route(
            "/api/billing/reports/financial-mis",
            get(billing::report_financial_mis),
        )
        .route(
            "/api/billing/reports/profit-loss",
            get(billing::report_profit_loss),
        )
        // ── Billing Phase 3 — ERP Export ─────────────────
        .route(
            "/api/billing/erp/export",
            post(billing::export_to_erp),
        )
        .route(
            "/api/billing/erp/exports",
            get(billing::list_erp_exports),
        )
        .route(
            "/api/billing/copay/calculate",
            post(billing::copay_calculation),
        )
        .route(
            "/api/billing/er-invoice",
            post(billing::er_fast_invoice),
        )
        // ── Billing Concessions ─────────────────────────
        .route(
            "/api/billing/concessions",
            get(billing::list_concessions).post(billing::create_concession),
        )
        .route(
            "/api/billing/concessions/auto-rules",
            get(billing::get_auto_concession_rules)
                .put(billing::update_auto_concession_rules),
        )
        .route(
            "/api/billing/concessions/{id}/approve",
            put(billing::approve_concession),
        )
        .route(
            "/api/billing/concessions/{id}/reject",
            put(billing::reject_concession),
        )
        // ── Payment Gateway ─────────────────────────────
        .merge(medbrains_payment_gateway::router())
        // ── OAuth connect (common token module) ──────────
        .route("/api/oauth/providers", get(oauth::list_oauth_providers))
        .route(
            "/api/oauth/{provider}/authorize",
            get(oauth::oauth_authorize),
        )
        .route("/api/oauth/{provider}/exchange", post(oauth::oauth_exchange))
        .route(
            "/api/oauth/connections/{provider}",
            delete(oauth::oauth_disconnect),
        )
        // ── Lab ──────────────────────────────────────────
        .merge(medbrains_lab::router())
        .route(
            "/api/lab/catalog/import",
            post(catalog_import::import_lab_catalog),
        )
        .merge(medbrains_radiology::router())
        // ── Pharmacy ────────────────────────────────────
        .merge(medbrains_pharmacy::router())
        .route(
            "/api/pharmacy/catalog/import",
            post(catalog_import::import_pharmacy_catalog),
        )
        .route(
            "/api/pharmacy/ward-stock",
            get(ward_stock::list_ward_stock),
        )
        .route("/api/pharmacy/ward-stock/par", post(ward_stock::set_ward_par))
        .route(
            "/api/pharmacy/ward-stock/replenish",
            post(ward_stock::replenish_ward),
        )
        .route(
            "/api/pharmacy/ward-stock/consume",
            post(ward_stock::consume_ward_stock),
        )
        // ── Pharmacy Finance (credit notes + store indents) ──
        .merge(medbrains_pharmacy_finance::router())
        // ── Pharmacy Safety ──────────────────────────────
        .merge(medbrains_pharmacy_safety::router())
        // ── Pharmacy Payments ────────────────────────────
        .route(
            "/api/pharmacy/payments",
            get(pharmacy_payments::list_payments).post(pharmacy_payments::create_payment),
        )
        .route(
            "/api/pharmacy/payments/{id}/reconcile",
            put(pharmacy_payments::reconcile_payment),
        )
        .route(
            "/api/pharmacy/payments/auto-reconcile",
            post(pharmacy_payments::auto_reconcile_upi),
        )
        .route(
            "/api/pharmacy/payments/day-reconciliation",
            get(pharmacy_payments::day_reconciliation),
        )
        .route(
            "/api/pharmacy/settlements",
            get(pharmacy_payments::get_settlement),
        )
        .route(
            "/api/pharmacy/settlements/{id}/close",
            put(pharmacy_payments::close_settlement),
        )
        .route(
            "/api/pharmacy/settlements/{id}/verify",
            put(pharmacy_payments::verify_settlement),
        )
        // ── ABDM (Phase 11): HFR registration + gateway HIP relay ─
        .route(
            "/api/abdm/hfr",
            get(abdm::hfr::list_registrations).post(abdm::hfr::register),
        )
        .route(
            "/api/abdm/hfr/tenant",
            get(abdm::hfr::get_tenant_facility),
        )
        .route(
            "/api/abdm/abha/status",
            get(abdm::abha::status),
        )
        .route(
            "/api/abdm/abha/session",
            post(abdm::abha::create_session),
        )
        .route(
            "/api/abdm/abha/public-certificate",
            post(abdm::abha::public_certificate),
        )
        .route(
            "/api/abdm/abha/login/request-otp",
            post(abdm::abha::request_login_otp),
        )
        .route(
            "/api/abdm/abha/login/verify",
            post(abdm::abha::verify_login_otp),
        )
        .route(
            "/api/abdm/gateway/callback",
            post(abdm::hip_relay::receive_callback),
        )
        .route(
            "/api/abdm/gateway/callbacks/pending",
            get(abdm::hip_relay::list_pending_callbacks),
        )
        .route(
            "/api/abdm/gateway/callbacks/{id}/ack",
            put(abdm::hip_relay::ack_callback),
        )
        // ── Pharmacy Improvements: Repeats ─────────────────
        .route(
            "/api/pharmacy/prescriptions/{prescription_id}/repeat-eligibility",
            get(pharmacy_repeats::check_eligibility),
        )
        .route(
            "/api/pharmacy/prescriptions/{prescription_id}/repeats",
            get(pharmacy_repeats::list_repeats_for_rx)
                .post(pharmacy_repeats::dispense_repeat),
        )
        // ── Pharmacy Finance: Cash Drawer ──────────────────
        .route(
            "/api/pharmacy/cash-drawers",
            get(pharmacy_cash_drawer::list_drawers)
                .post(pharmacy_cash_drawer::open_drawer),
        )
        .route(
            "/api/pharmacy/cash-drawers/me/active",
            get(pharmacy_cash_drawer::get_my_active_drawer),
        )
        .route(
            "/api/pharmacy/cash-drawers/{id}/close",
            put(pharmacy_cash_drawer::close_drawer),
        )
        // ── Nurse Activities: MAR (canonical ipd_medication_administration) ──
        .merge(medbrains_ipd::router())
        .merge(medbrains_nursing::router())
        // ── Clinical offline-mode REST adapters (Phase 7) ─────────────
        // Mirror endpoints for the four CRDT hooks. Same data the edge
        // node holds in Loro containers — surfaced here for tenants
        // running in REST mode.
        .route(
            "/api/clinical/handoff-entries/shifts/{shift_id}",
            get(clinical_offline::list_handoff_entries)
                .post(clinical_offline::create_handoff_entry),
        )
        .route(
            "/api/clinical/triage-entries/visits/{visit_id}",
            get(clinical_offline::list_triage_entries)
                .post(clinical_offline::create_triage_entry),
        )
        .route(
            "/api/clinical/patient-notes/{patient_id}",
            get(clinical_offline::get_patient_notes)
                .put(clinical_offline::update_patient_notes),
        )
        .route(
            "/api/clinical/nursing-shift-notes/{shift_id}",
            get(clinical_offline::get_nursing_shift_notes)
                .put(clinical_offline::update_nursing_shift_notes),
        )
        // ── Pharmacy Improvements: Substitution + Counseling + Coverage
        .route(
            "/api/pharmacy/substitutions",
            post(pharmacy_dispense_ops::create_substitution),
        )
        .route(
            "/api/pharmacy/substitutions/item/{item_id}",
            get(pharmacy_dispense_ops::list_substitutions_for_item),
        )
        .route(
            "/api/pharmacy/counseling",
            post(pharmacy_dispense_ops::create_counseling),
        )
        .route(
            "/api/pharmacy/counseling/order/{order_id}",
            get(pharmacy_dispense_ops::list_counseling_for_order),
        )
        .route(
            "/api/pharmacy/coverage-checks",
            post(pharmacy_dispense_ops::create_coverage_check),
        )
        .route(
            "/api/pharmacy/coverage-checks/order/{order_id}",
            get(pharmacy_dispense_ops::list_coverage_for_order),
        )
        // ── Pharmacy Finance: Petty Cash + Float Movements ─
        .route(
            "/api/pharmacy/petty-cash",
            get(pharmacy_petty_cash::list_petty_cash)
                .post(pharmacy_petty_cash::create_petty_cash),
        )
        .route(
            "/api/pharmacy/petty-cash/{id}/decide",
            put(pharmacy_petty_cash::decide_petty_cash),
        )
        .route(
            "/api/pharmacy/cash-float-movements",
            get(pharmacy_petty_cash::list_float_movements)
                .post(pharmacy_petty_cash::create_float_movement),
        )
        // ── Pharmacy Finance: Free Dispensing + Overrides + Suppliers + Margins
        .route(
            "/api/pharmacy/free-dispensings",
            get(pharmacy_free_dispensing::list_free_dispensings)
                .post(pharmacy_free_dispensing::approve_free_dispensing),
        )
        .route(
            "/api/pharmacy/cashier-overrides",
            get(pharmacy_free_dispensing::list_cashier_overrides)
                .post(pharmacy_free_dispensing::create_cashier_override),
        )
        .route(
            "/api/pharmacy/supplier-payments",
            get(pharmacy_free_dispensing::list_supplier_payments)
                .post(pharmacy_free_dispensing::create_supplier_payment),
        )
        .route(
            "/api/pharmacy/supplier-payments/{id}/pay",
            put(pharmacy_free_dispensing::pay_supplier),
        )
        .route(
            "/api/pharmacy/drug-margins/daily",
            get(pharmacy_free_dispensing::list_margins),
        )
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
        .route("/api/ai/chat", post(ai::chat))
        .route("/api/ai/whispers", get(ai::whispers))
        // ── VPN platform — device enrollment (RFC-VPN-PLATFORM) ─
        .merge(medbrains_vpn::router())
        .route("/api/ai/conversations", get(ai::list_conversations))
        .route(
            "/api/ai/conversations/{id}/messages",
            get(ai::conversation_messages),
        )
        // ── IPD Phase 2: Wards, Bed Dashboard, Reports, Templates ─
        // Registered BEFORE /api/ipd/admissions/{id} to avoid path collision
        .merge(medbrains_microsite::router())
        .merge(medbrains_specialty::router())
        .merge(medbrains_ancillary::router())
        .merge(medbrains_home_health::router())
        // ── Case-sheet digitization (B2 ingestion) ──
        .route(
            "/api/case-sheets/scans",
            get(case_sheet_scan::list_scans).post(case_sheet_scan::create_scan),
        )
        .route(
            "/api/case-sheets/scans/{id}",
            get(case_sheet_scan::get_scan),
        )
        .route(
            "/api/case-sheets/scans/{id}/submit",
            post(case_sheet_scan::submit_scan),
        )
        .route(
            "/api/case-sheets/scans/{id}/parse-result",
            post(case_sheet_scan::parse_result),
        )
        .route(
            "/api/case-sheets/scans/{id}/review",
            put(case_sheet_scan::save_review),
        )
        .route(
            "/api/case-sheets/scans/{id}/commit",
            post(case_sheet_scan::commit_scan),
        )
        // ── IPD Admissions ──────────────────────────────────
        // ── IPD Clinical Expansion ─────────────────────────
        // ── IPD Phase 2b: IP Types, Checklists, Reservations, Clinical Docs, etc. ──
        // ── IPD Phase 3a: Cross-module reads ────────────────
        // ── IPD post-discharge workflow (Track 1A.bis.4) ──
        .route(
            "/api/ipd/admissions/{id}/discharge-workflow",
            get(ipd_post_discharge::get_discharge_workflow),
        )
        .route(
            "/api/ipd/admissions/{id}/discharge-workflow/step",
            post(ipd_post_discharge::update_discharge_step),
        )
        .route(
            "/api/ipd/admissions/{id}/dama",
            get(ipd_post_discharge::get_dama)
                .post(ipd_post_discharge::record_dama),
        )
        .route(
            "/api/ipd/post-discharge",
            get(ipd_post_discharge::list_post_discharge),
        )
        .route(
            "/api/ipd/post-discharge/{id}/survey/send",
            post(ipd_post_discharge::send_survey),
        )
        .route(
            "/api/ipd/mortality-reviews",
            get(ipd_post_discharge::list_mortality_reviews)
                .post(ipd_post_discharge::create_mortality_review),
        )
        .route(
            "/api/ipd/mortality-reviews/{id}/submit",
            post(ipd_post_discharge::submit_mortality_review),
        )
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
        .route(
            "/api/hr/payroll/structures",
            get(payroll::list_salary_structures).post(payroll::upsert_salary_structure),
        )
        .route(
            "/api/hr/payroll/runs",
            get(payroll::list_payroll_runs).post(payroll::create_payroll_run),
        )
        .route(
            "/api/hr/payroll/runs/{id}/finalize",
            post(payroll::finalize_payroll_run),
        )
        .route("/api/hr/payroll/payslips", get(payroll::list_payslips))
        // ── BME / CMMS ───────────────────────────────────────
        .merge(medbrains_bme::router())
        // ── Unified Assets & Stores ─────────────────────────
        .merge(medbrains_assets::router())
        .route(
            "/api/materials/requisitions",
            get(materials::list_requisitions),
        )
        .route("/api/materials/inventory", get(materials::list_inventory))
        .route("/api/materials/analytics", get(materials::materials_analytics))
        .merge(medbrains_lms::router())
        // ── MRD (Medical Records Department) ────────────────────
        .merge(medbrains_mrd::router())
        // ── Consent Management ───────────────────────────────
        .merge(medbrains_consent::router())
        // ── Camp Management ───────────────────────────────────
        .merge(medbrains_camp::router())
        .merge(medbrains_ambulance::router())
        .merge(medbrains_care_mgmt::router())
        // ── Communication Hub ─────────────────────────────────
        .merge(medbrains_communications::router())
        .merge(medbrains_analytics::router())
        .merge(medbrains_facilities::router())
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
        .route(
            "/api/orders/basket/check",
            post(order_basket::check_basket),
        )
        .route(
            "/api/orders/basket/sign",
            post(order_basket::sign_basket),
        )
        .route(
            "/api/orders/basket/drafts/{encounter_id}",
            get(order_basket::get_draft)
                .put(order_basket::save_draft)
                .delete(order_basket::delete_draft),
        )
        .route(
            "/api/orders/basket/preview-cost",
            post(order_basket::preview_cost),
        )
        .route(
            "/api/orders/basket/previous/{patient_id}",
            get(order_basket::carry_forward),
        )
        // ── Doctor Packages (admin) ─────────────────────────
        .route(
            "/api/admin/doctor-packages",
            get(doctor_packages::list_packages).post(doctor_packages::create_package),
        )
        .route(
            "/api/admin/doctor-packages/{id}",
            get(doctor_packages::get_package).put(doctor_packages::update_package),
        )
        .route(
            "/api/admin/doctor-packages/{id}/inclusions",
            post(doctor_packages::add_inclusion),
        )
        .route(
            "/api/admin/doctor-packages/{pid}/inclusions/{iid}",
            delete(doctor_packages::remove_inclusion),
        )
        // ── Patient Packages ────────────────────────────────
        .route(
            "/api/patient-packages/subscribe",
            post(patient_packages::subscribe),
        )
        .route(
            "/api/patient-packages/patient/{patient_id}",
            get(patient_packages::list_for_patient),
        )
        .route(
            "/api/patient-packages/{sub_id}/consume",
            post(patient_packages::consume),
        )
        .route(
            "/api/patient-packages/{sub_id}/refund",
            post(patient_packages::refund),
        )
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
        .route("/api/news", get(news::list_active))
        .route(
            "/api/admin/news",
            get(news::list_all).post(news::create_article),
        )
        .route(
            "/api/admin/news/{id}",
            put(news::update_article).delete(news::delete_article),
        )
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
        .route(
            "/api/admin/device-pairing-tokens",
            post(device_pairing::mint_pairing_token),
        )
        .route(
            "/api/admin/paired-devices",
            get(device_pairing::list_paired_devices),
        )
        .route(
            "/api/admin/paired-devices/{id}",
            delete(device_pairing::revoke_paired_device),
        )
        // S3 presigned upload / download URL endpoints
        .route("/api/upload/presign", post(upload::presign_upload))
        .route("/api/upload/download-url", get(upload::presign_download))
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
            "/api/public/kiosk/checkin",
            post(appointments::kiosk_checkin),
        )
        .route(
            "/api/public/radiology/viewer/{token}",
            get(radiology::validate_share_link),
        );

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
        .merge(reminder_routes)
        .with_state(state)
}

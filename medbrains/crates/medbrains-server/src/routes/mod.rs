pub mod abdm;
pub mod access;
pub mod app_manifest;
pub mod vte;
pub mod admin;
pub mod admin_simulator;
pub mod ai;
pub mod analytics;
pub mod appointments;
pub mod assets;
pub mod audit;
pub mod auth;
pub mod billing;
pub mod bme;
pub mod catalog_import;
pub mod client_errors;
pub mod clinical_offline;
pub mod cms;
pub mod communications;
pub mod consent;
pub mod coverage;
pub mod debug;
pub mod device_pairing;
pub mod devices;
pub mod doctor_packages;
pub mod documents_render;
pub mod email_verification;
pub mod fhir;
pub mod health;
pub mod hr;
pub mod infra_settings;
pub mod invitations;
pub mod mail_provisioning;
pub mod ipd_post_discharge;
pub mod it_security;
pub mod materials;
pub mod mfa;
pub mod mrd;
pub use medbrains_server_core::nabh_evidence;
// scheduling routes moved to the medbrains-scheduling leaf; re-exported so
// reports.rs (which reuses scheduling helpers) keeps resolving crate::routes::scheduling.
pub use medbrains_scheduling::scheduling;
pub use medbrains_telehealth::cds;
pub use medbrains_platform::ckb;
pub mod nabh_indicators;
pub mod news;
pub mod nhcx_callback;
pub mod nhcx_onboarding;
pub use medbrains_server_core::notifications;
pub use medbrains_identity::sso;
pub use medbrains_server_core::step_up;
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
// billing/lab/pharmacy/patients/appointments reach token helpers via crate::routes::tokens
pub use medbrains_tokens as tokens;
pub mod oauth;
pub mod onboarding;
pub mod orchestration;
pub mod order_basket;
pub mod order_sets;
pub mod ot;
pub mod patient_packages;
pub mod payment_gateway;
pub mod payroll;
pub mod pharmacy_cash_drawer;
pub mod pharmacy_dispense_ops;
pub mod pharmacy_finance;
pub mod pharmacy_free_dispensing;
pub mod pharmacy_payments;
pub mod pharmacy_petty_cash;
pub mod pharmacy_repeats;
pub mod pharmacy_safety;
pub mod print_data;
pub mod print_data_academic;
pub mod print_data_admin;
pub mod print_data_billing;
pub mod print_data_bme;
pub mod print_data_clinical;
pub mod print_data_consent;
pub mod print_data_hr;
pub mod print_data_medicolegal;
pub mod print_data_mrd;
pub mod print_data_quality;
pub mod print_data_regulatory;
pub mod print_data_surgical;
pub mod quality;
pub mod regulatory;
pub mod reports;
pub mod security;
pub mod setup;
pub mod sso_login;

pub mod case_sheet_scan;
pub mod vpn;
pub mod ward_stock;
pub mod sharing;
pub mod signed_documents;
pub mod specialty_interventional;
pub mod specialty_other;
pub mod tv;
pub mod upload;
pub mod ws;

use axum::{
    Router,
    middleware::{from_fn, from_fn_with_state},
    routing::{delete, get, patch, post, put},
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
        .route("/api/public/cms/posts", get(cms::public_list_posts))
        .route("/api/public/cms/posts/featured", get(cms::public_featured_posts))
        .route("/api/public/cms/posts/{slug}", get(cms::public_get_post))
        .route("/api/public/cms/posts/{post_id}/view", post(cms::public_record_view))
        .route("/api/public/cms/pages/{slug}", get(cms::public_get_page))
        .route("/api/public/cms/subscribe", post(cms::public_subscribe))
        .route("/api/public/cms/confirm/{token}", get(cms::public_confirm_subscription))
        .route("/api/public/cms/unsubscribe/{token}", get(cms::public_unsubscribe))
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
        .route(
            "/api/access-groups",
            get(setup::list_access_groups).post(setup::create_access_group),
        )
        .route(
            "/api/access-groups/{id}",
            put(setup::update_access_group).delete(setup::delete_access_group),
        )
        .route(
            "/api/access-groups/{id}/members",
            get(setup::list_access_group_members).post(setup::add_access_group_member),
        )
        .route(
            "/api/access-groups/{group_id}/members/{user_id}",
            delete(setup::remove_access_group_member),
        )
        .route(
            "/api/setup/users/{id}/visible-screens",
            get(setup::list_visible_screens),
        )
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
        .route(
            "/api/setup/tenant",
            get(setup::get_tenant).put(setup::update_tenant),
        )
        .route("/api/setup/tenant/geo", put(setup::update_tenant_geo_with_presets))
        .route("/api/setup/compliance", post(setup::create_compliance))
        // Setup — generic tenant settings
        .route(
            "/api/setup/settings",
            get(setup::get_settings).put(setup::update_setting),
        )
        .route(
            "/api/setup/device-settings",
            get(setup::get_secure_device_settings).put(setup::update_secure_device_setting),
        )
        // Setup — brand entities (multi-entity branding)
        .route("/api/setup/brand-entities", get(setup::list_brand_entities).post(setup::create_brand_entity))
        .route("/api/setup/brand-entities/{id}", put(setup::update_brand_entity).delete(setup::delete_brand_entity))
        // Setup — facilities
        .route(
            "/api/setup/facilities",
            get(setup::list_facilities).post(setup::create_facility),
        )
        .route(
            "/api/setup/facilities/{id}",
            put(setup::update_facility).delete(setup::delete_facility),
        )
        // Setup — locations
        .route(
            "/api/setup/locations",
            get(setup::list_locations).post(setup::create_location),
        )
        .route(
            "/api/setup/locations/{id}",
            put(setup::update_location).delete(setup::delete_location),
        )
        .route(
            "/api/setup/locations/directory",
            get(setup::list_location_directory),
        )
        .route(
            "/api/setup/locations/{id}/staff",
            get(setup::list_location_staff).post(setup::assign_location_staff),
        )
        .route(
            "/api/setup/locations/{id}/staff/{user_id}",
            delete(setup::remove_location_staff),
        )
        // Setup — departments
        .route(
            "/api/setup/departments",
            get(setup::list_departments).post(setup::create_department),
        )
        .route(
            "/api/setup/departments/{id}",
            put(setup::update_department).delete(setup::delete_department),
        )
        // Setup — roles
        .route(
            "/api/setup/roles",
            get(setup::list_roles).post(setup::create_role),
        )
        .route(
            "/api/setup/roles/{id}",
            put(setup::update_role).delete(setup::delete_role),
        )
        .route(
            "/api/setup/roles/{id}/permissions",
            put(setup::update_role_permissions),
        )
        .route(
            "/api/setup/roles/{id}/field-access",
            put(setup::update_role_field_access),
        )
        .route(
            "/api/setup/roles/{id}/widget-access",
            put(setup::update_role_widget_access),
        )
        // Setup — users
        .route(
            "/api/setup/users",
            get(setup::list_users).post(setup::create_user),
        )
        .route(
            "/api/setup/doctors",
            get(setup::list_doctors),
        )
        .route(
            "/api/setup/users/{id}",
            put(setup::update_user).delete(setup::delete_user),
        )
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
        .route(
            "/api/setup/users/{id}/reset-password",
            post(setup::reset_user_password),
        )
        .route(
            "/api/setup/users/{id}/access-matrix",
            put(setup::update_user_access_matrix),
        )
        // Setup — modules
        .route("/api/setup/modules", get(setup::list_modules))
        .route("/api/setup/modules/{code}", put(setup::update_module))
        .route("/api/setup/edition", get(onboarding::get_edition))
        .route("/api/setup/edition/apply", post(onboarding::apply_edition))
        // Setup — sequences
        .route(
            "/api/setup/sequences",
            get(setup::list_sequences).post(setup::create_sequence),
        )
        .route(
            "/api/setup/sequences/{seq_type}",
            put(setup::update_sequence).delete(setup::delete_sequence),
        )
        // Setup — services
        .route(
            "/api/setup/services",
            get(setup::list_services).post(setup::create_service),
        )
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
        .route(
            "/api/setup/services/{id}",
            put(setup::update_service).delete(setup::delete_service),
        )
        // Setup — bed types
        .route(
            "/api/setup/bed-types",
            get(setup::list_bed_types).post(setup::create_bed_type),
        )
        .route(
            "/api/setup/bed-types/{id}",
            put(setup::update_bed_type).delete(setup::delete_bed_type),
        )
        // Setup — tax categories
        .route(
            "/api/setup/tax-categories",
            get(setup::list_tax_categories).post(setup::create_tax_category),
        )
        .route(
            "/api/setup/tax-categories/{id}",
            put(setup::update_tax_category).delete(setup::delete_tax_category),
        )
        // Setup — payment methods
        .route(
            "/api/setup/payment-methods",
            get(setup::list_payment_methods).post(setup::create_payment_method),
        )
        .route(
            "/api/setup/payment-methods/{id}",
            put(setup::update_payment_method).delete(setup::delete_payment_method),
        )
        // Setup — branding
        .route(
            "/api/setup/branding",
            get(setup::get_branding).put(setup::update_branding),
        )
        // Setup — module master data seeding
        .route(
            "/api/setup/module-masters",
            post(setup::seed_module_masters),
        )
        // Setup — CSV import
        .route("/api/setup/locations/import", post(setup::import_locations))
        .route("/api/setup/departments/import", post(setup::import_departments))
        .route("/api/setup/users/import", post(setup::import_users))
        // Setup — user-facility assignments
        .route(
            "/api/setup/users/{id}/facilities",
            get(setup::list_user_facilities).put(setup::assign_user_facilities),
        )
        // Setup — auto-create compliance checklist
        .route(
            "/api/setup/facilities/{id}/auto-compliance",
            post(setup::auto_create_compliance),
        )
        // Setup — print templates
        .route(
            "/api/setup/print-templates",
            get(setup::get_print_templates).put(setup::upsert_print_template),
        )
        // Setup — clinical masters (religions, occupations, relations)
        .route(
            "/api/setup/masters/religions",
            get(setup::list_master_religions).post(setup::create_master_religion),
        )
        .route(
            "/api/setup/masters/religions/{id}",
            put(setup::update_master_religion).delete(setup::delete_master_religion),
        )
        .route(
            "/api/setup/masters/occupations",
            get(setup::list_master_occupations).post(setup::create_master_occupation),
        )
        .route(
            "/api/setup/masters/occupations/{id}",
            put(setup::update_master_occupation).delete(setup::delete_master_occupation),
        )
        .route(
            "/api/setup/masters/relations",
            get(setup::list_master_relations).post(setup::create_master_relation),
        )
        .route(
            "/api/setup/masters/relations/{id}",
            put(setup::update_master_relation).delete(setup::delete_master_relation),
        )
        // Setup — insurance providers
        .route(
            "/api/setup/masters/insurance-providers",
            get(setup::list_insurance_providers).post(setup::create_insurance_provider),
        )
        .route(
            "/api/setup/masters/insurance-providers/import",
            post(catalog_import::import_insurance_providers),
        )
        .route(
            "/api/setup/masters/insurance-providers/{id}",
            put(setup::update_insurance_provider).delete(setup::delete_insurance_provider),
        )
        // Setup — bulk / template / health / config
        .route("/api/setup/users/bulk", post(setup::bulk_create_users))
        .route(
            "/api/setup/departments/template",
            post(setup::seed_department_template),
        )
        .route(
            "/api/setup/completeness",
            get(setup::completeness_check),
        )
        .route("/api/setup/health", get(setup::system_health))
        .route(
            "/api/setup/config/export",
            get(setup::export_config),
        )
        .route(
            "/api/setup/config/import",
            post(setup::import_config),
        )
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
        .route(
            "/api/payments/create-order",
            post(payment_gateway::create_order),
        )
        .route("/api/payments/pos-sale", post(payment_gateway::pos_sale))
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
        .route(
            "/api/payments/virtual-account",
            post(payment_gateway::create_virtual_account),
        )
        .route(
            "/api/payments/verify",
            post(payment_gateway::verify_payment),
        )
        .route(
            "/api/payments/{id}/status",
            get(payment_gateway::get_payment_status),
        )
        .route(
            "/api/payments/upi-qr",
            post(payment_gateway::generate_upi_qr),
        )
        .route(
            "/api/payments/refund",
            post(payment_gateway::initiate_refund),
        )
        .route(
            "/api/payments/razorpay/status",
            get(payment_gateway::razorpay_status),
        )
        .route(
            "/api/payments/providers",
            get(payment_gateway::list_payment_providers),
        )
        .route(
            "/api/payments/terminals",
            get(payment_gateway::list_payment_terminals)
                .post(payment_gateway::create_payment_terminal),
        )
        .route(
            "/api/payments/terminals/{id}",
            put(payment_gateway::update_payment_terminal)
                .delete(payment_gateway::delete_payment_terminal),
        )
        .route(
            "/api/payments/recon-summary",
            get(payment_gateway::payment_recon_summary),
        )
        .route(
            "/api/payments/exceptions",
            get(payment_gateway::list_payment_exceptions),
        )
        .route(
            "/api/payments/exceptions/{id}",
            put(payment_gateway::resolve_payment_exception),
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
        .route(
            "/api/pharmacy/credit-notes",
            get(pharmacy_finance::list_credit_notes).post(pharmacy_finance::create_credit_note),
        )
        .route(
            "/api/pharmacy/credit-notes/{id}",
            get(pharmacy_finance::get_credit_note),
        )
        .route(
            "/api/pharmacy/credit-notes/{id}/approve",
            put(pharmacy_finance::approve_credit_note),
        )
        .route(
            "/api/pharmacy/credit-notes/{id}/settle",
            put(pharmacy_finance::settle_credit_note),
        )
        .route(
            "/api/pharmacy/credit-notes/{id}/cancel",
            put(pharmacy_finance::cancel_credit_note),
        )
        .route(
            "/api/pharmacy/store-indents",
            get(pharmacy_finance::list_store_indents).post(pharmacy_finance::create_store_indent),
        )
        .route(
            "/api/pharmacy/store-indents/{id}/approve",
            put(pharmacy_finance::approve_store_indent),
        )
        .route(
            "/api/pharmacy/store-indents/{id}/issue",
            put(pharmacy_finance::issue_store_indent),
        )
        .route(
            "/api/pharmacy/store-indents/{id}/receive",
            put(pharmacy_finance::receive_store_indent),
        )
        .route(
            "/api/pharmacy/patient-orders/{patient_id}",
            get(pharmacy_finance::list_patient_orders_for_return),
        )
        .route(
            "/api/pharmacy/pos/lookup",
            get(pharmacy_finance::lookup_pos_sale),
        )
        // ── Pharmacy Safety ──────────────────────────────
        .route(
            "/api/pharmacy/recalls",
            get(pharmacy_safety::list_recalls).post(pharmacy_safety::create_recall),
        )
        .route(
            "/api/pharmacy/recalls/{id}/complete",
            put(pharmacy_safety::complete_recall),
        )
        .route(
            "/api/pharmacy/recalls/{id}/affected-patients",
            get(pharmacy_safety::get_recall_affected_patients),
        )
        .route(
            "/api/pharmacy/destruction",
            get(pharmacy_safety::list_destructions).post(pharmacy_safety::create_destruction),
        )
        .route(
            "/api/pharmacy/destruction/{id}/certificate",
            get(pharmacy_safety::get_destruction_certificate),
        )
        .route(
            "/api/pharmacy/substitutes/{drug_id}",
            get(pharmacy_safety::list_substitutes),
        )
        .route(
            "/api/pharmacy/substitutes",
            post(pharmacy_safety::create_substitute),
        )
        .route(
            "/api/pharmacy/emergency-kits",
            get(pharmacy_safety::list_kits).post(pharmacy_safety::create_kit),
        )
        .route(
            "/api/pharmacy/emergency-kits/{id}/check",
            put(pharmacy_safety::check_kit),
        )
        .route(
            "/api/pharmacy/emergency-kits/{id}/restock",
            put(pharmacy_safety::restock_kit),
        )
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
        .route(
            "/api/quality/indicators",
            get(quality::list_indicators).post(quality::create_indicator),
        )
        .route(
            "/api/quality/indicator-values",
            get(quality::list_indicator_values).post(quality::record_indicator_value),
        )
        .route(
            "/api/quality/documents",
            get(quality::list_documents).post(quality::create_document),
        )
        .route(
            "/api/quality/documents/{id}",
            get(quality::get_document),
        )
        .route(
            "/api/quality/documents/{id}/status",
            patch(quality::update_document_status),
        )
        .route(
            "/api/quality/documents/{id}/acknowledge",
            post(quality::acknowledge_document),
        )
        .route(
            "/api/quality/incidents",
            get(quality::list_incidents).post(quality::create_incident),
        )
        .route(
            "/api/quality/incidents/{id}",
            get(quality::get_incident).patch(quality::update_incident),
        )
        .route(
            "/api/quality/capa",
            get(quality::list_capa).post(quality::create_capa),
        )
        .route(
            "/api/quality/capa/{id}",
            patch(quality::update_capa),
        )
        .route(
            "/api/quality/committees",
            get(quality::list_committees).post(quality::create_committee),
        )
        .route(
            "/api/quality/meetings",
            get(quality::list_meetings).post(quality::create_meeting),
        )
        .route(
            "/api/quality/meetings/{id}",
            patch(quality::update_meeting),
        )
        .route(
            "/api/quality/action-items",
            get(quality::list_action_items).post(quality::create_action_item),
        )
        .route(
            "/api/quality/standards",
            get(quality::list_standards).post(quality::create_standard),
        )
        .route(
            "/api/quality/compliance",
            get(quality::list_compliance).post(quality::update_compliance),
        )
        .route(
            "/api/quality/audits",
            get(quality::list_audits).post(quality::create_audit),
        )
        .route(
            "/api/quality/audits/{id}",
            get(quality::get_audit).patch(quality::update_audit),
        )
        .route(
            "/api/quality/indicators/{id}/calculate",
            post(quality::calculate_indicator),
        )
        .route(
            "/api/quality/documents/{id}/pending-acks",
            get(quality::list_pending_acks),
        )
        .route(
            "/api/quality/committees/{id}/auto-schedule",
            post(quality::auto_schedule_meetings),
        )
        .route(
            "/api/quality/accreditation/{body}/evidence",
            get(quality::compile_evidence),
        )
        // ── Quality Extended Analytics ───────────────────
        .route(
            "/api/quality/audits/schedule",
            post(quality::schedule_audits),
        )
        .route(
            "/api/quality/audits/{id}/findings",
            get(quality::list_audit_findings).post(quality::create_audit_finding),
        )
        .route(
            "/api/quality/capas/overdue",
            get(quality::list_overdue_capas),
        )
        .route(
            "/api/quality/committees/dashboard",
            get(quality::committee_dashboard),
        )
        .route(
            "/api/quality/mortality-reviews",
            post(quality::create_mortality_review),
        )
        .route(
            "/api/quality/incidents/sentinel",
            get(quality::list_sentinel_events),
        )
        .route(
            "/api/quality/analytics/psi",
            get(quality::patient_safety_indicators),
        )
        .route(
            "/api/quality/analytics/scorecard",
            get(quality::department_scorecard),
        )
        // ── Regulatory & Compliance ──────────────────────
        // Dashboard
        .route(
            "/api/regulatory/dashboard",
            get(regulatory::dashboard),
        )
        .route(
            "/api/regulatory/dashboard/department/{id}",
            get(regulatory::department_dashboard),
        )
        .route(
            "/api/regulatory/dashboard/gaps",
            get(regulatory::dashboard_gaps),
        )
        // Checklists
        .route(
            "/api/regulatory/checklists",
            get(regulatory::list_checklists).post(regulatory::create_checklist),
        )
        .route(
            "/api/regulatory/checklists/{id}",
            get(regulatory::get_checklist).put(regulatory::update_checklist),
        )
        .route(
            "/api/regulatory/checklists/{id}/items",
            post(regulatory::batch_checklist_items),
        )
        .route(
            "/api/regulatory/checklists/{checklist_id}/items/{item_id}",
            put(regulatory::update_checklist_item),
        )
        // ADR Reports
        .route(
            "/api/regulatory/adr-reports",
            get(regulatory::list_adr_reports).post(regulatory::create_adr_report),
        )
        .route(
            "/api/regulatory/adr-reports/{id}",
            get(regulatory::get_adr_report).put(regulatory::update_adr_report),
        )
        .route(
            "/api/regulatory/adr-reports/{id}/submit",
            post(regulatory::submit_adr_to_pvpi),
        )
        // Materiovigilance
        .route(
            "/api/regulatory/materiovigilance",
            get(regulatory::list_mv_reports).post(regulatory::create_mv_report),
        )
        .route(
            "/api/regulatory/materiovigilance/{id}",
            get(regulatory::get_mv_report).put(regulatory::update_mv_report),
        )
        .route(
            "/api/regulatory/materiovigilance/{id}/submit",
            post(regulatory::submit_mv_to_cdsco),
        )
        // PCPNDT Forms
        .route(
            "/api/regulatory/pcpndt-forms",
            get(regulatory::list_pcpndt_forms).post(regulatory::create_pcpndt_form),
        )
        .route(
            "/api/regulatory/pcpndt-forms/{id}",
            get(regulatory::get_pcpndt_form).put(regulatory::update_pcpndt_form),
        )
        .route(
            "/api/regulatory/pcpndt-forms/quarterly",
            get(regulatory::pcpndt_quarterly_summary),
        )
        // Compliance Calendar
        .route(
            "/api/regulatory/calendar",
            get(regulatory::list_calendar).post(regulatory::create_calendar_event),
        )
        .route(
            "/api/regulatory/calendar/{id}",
            put(regulatory::update_calendar_event),
        )
        .route(
            "/api/regulatory/calendar/overdue",
            get(regulatory::overdue_calendar),
        )
        // ── Regulatory Extended ─────────────────────────
        .route(
            "/api/regulatory/checklists/{id}/auto-populate",
            post(regulatory::auto_populate_checklist),
        )
        .route(
            "/api/regulatory/submissions",
            get(regulatory::list_submissions).post(regulatory::create_submission),
        )
        .route(
            "/api/regulatory/mock-surveys",
            get(regulatory::list_mock_surveys).post(regulatory::create_mock_survey),
        )
        .route(
            "/api/regulatory/staff-credentials",
            get(regulatory::staff_credentials),
        )
        .route(
            "/api/regulatory/licenses/dashboard",
            get(regulatory::license_dashboard),
        )
        .route(
            "/api/regulatory/nabl/documents",
            get(regulatory::nabl_document_tracking),
        )
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
        .route("/api/vpn/enroll", post(vpn::enroll))
        .route("/api/vpn/status", get(vpn::status))
        .route("/api/vpn/devices/{id}/revoke", post(vpn::revoke))
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
        .route(
            "/api/nabh/indicators",
            get(nabh_indicators::get_indicators),
        )
        // ── Operation Theatre ──────────────────────────────
        .route(
            "/api/ot/rooms",
            get(ot::list_rooms).post(ot::create_room),
        )
        .route(
            "/api/ot/rooms/{id}",
            put(ot::update_room),
        )
        .route(
            "/api/ot/bookings",
            get(ot::list_bookings).post(ot::create_booking),
        )
        .route(
            "/api/ot/bookings/{id}",
            get(ot::get_booking).put(ot::update_booking),
        )
        .route(
            "/api/ot/bookings/{id}/status",
            put(ot::update_booking_status),
        )
        .route(
            "/api/ot/bookings/{booking_id}/preop",
            get(ot::get_preop).post(ot::create_preop).put(ot::update_preop),
        )
        .route(
            "/api/ot/bookings/{booking_id}/preop-handoff",
            get(ot::get_preop_handoff).put(ot::upsert_preop_handoff),
        )
        .route(
            "/api/ot/bookings/{booking_id}/checklists",
            get(ot::get_checklists).post(ot::create_checklist),
        )
        .route(
            "/api/ot/bookings/{booking_id}/checklists/{checklist_id}",
            put(ot::update_checklist),
        )
        .route(
            "/api/ot/bookings/{booking_id}/case-record",
            get(ot::get_case_record).post(ot::create_case_record).put(ot::update_case_record),
        )
        .route(
            "/api/ot/bookings/{booking_id}/anesthesia",
            get(ot::get_anesthesia).post(ot::create_anesthesia).put(ot::update_anesthesia),
        )
        .route(
            "/api/ot/bookings/{booking_id}/postop",
            get(ot::get_postop).post(ot::create_postop).put(ot::update_postop),
        )
        .route(
            "/api/ot/bookings/{booking_id}/postop-handoff",
            get(ot::get_postop_handoff).put(ot::upsert_postop_handoff),
        )
        .route(
            "/api/ot/surgeon-preferences",
            get(ot::list_surgeon_preferences).post(ot::create_surgeon_preference),
        )
        .route(
            "/api/ot/surgeon-preferences/{id}",
            put(ot::update_surgeon_preference).delete(ot::delete_surgeon_preference),
        )
        .route(
            "/api/ot/schedule",
            get(ot::get_schedule),
        )
        .route(
            "/api/ot/analytics/utilization",
            get(ot::ot_utilization),
        )
        .route(
            "/api/ot/analytics/surgeon-caseload",
            get(ot::get_surgeon_caseload),
        )
        .route(
            "/api/ot/analytics/anesthesia-complications",
            get(ot::list_anesthesia_complications),
        )
        .merge(medbrains_blood_bank::router())
        .merge(medbrains_cssd::router())
        .merge(medbrains_emergency::router())
        .merge(medbrains_diet::router())
        // ── HR & Staff Management ───────────────────────────
        .route(
            "/api/hr/designations",
            get(hr::list_designations).post(hr::create_designation),
        )
        .route(
            "/api/hr/designations/{id}",
            put(hr::update_designation),
        )
        .route(
            "/api/hr/me/profile",
            get(hr::get_my_profile).put(hr::update_my_profile),
        )
        .route(
            "/api/hr/employees",
            get(hr::list_employees).post(hr::create_employee),
        )
        .route(
            "/api/hr/employees/{id}",
            get(hr::get_employee).put(hr::update_employee),
        )
        .route(
            "/api/hr/employees/{id}/credentials",
            get(hr::list_credentials).post(hr::create_credential),
        )
        .route(
            "/api/hr/employees/{id}/credentials/{cid}",
            put(hr::update_credential),
        )
        .route(
            "/api/hr/employees/{id}/leave-balances",
            get(hr::list_leave_balances),
        )
        .route(
            "/api/hr/employees/{id}/training-records",
            get(hr::list_training_records),
        )
        .route(
            "/api/hr/employees/{id}/appraisals",
            get(hr::list_appraisals),
        )
        .route(
            "/api/hr/employees/{id}/statutory-records",
            get(hr::list_statutory_records),
        )
        .route(
            "/api/hr/shifts",
            get(hr::list_shifts).post(hr::create_shift),
        )
        .route(
            "/api/hr/shifts/{id}",
            put(hr::update_shift),
        )
        .route(
            "/api/hr/rosters",
            get(hr::list_rosters).post(hr::create_roster),
        )
        .route(
            "/api/hr/rosters/{id}/approve-swap",
            put(hr::approve_swap),
        )
        .route(
            "/api/hr/attendance",
            get(hr::list_attendance).post(hr::create_attendance),
        )
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
        .route("/api/hr/duty-hours", get(hr::list_duty_hours))
        .route("/api/hr/my-shift", get(hr::get_my_shift))
        .route("/api/hr/my-shift/start", post(hr::start_shift))
        .route("/api/hr/my-shift/extend", post(hr::extend_shift))
        .route("/api/hr/my-shift/pause", post(hr::pause_shift))
        .route("/api/hr/my-shift/resume", post(hr::resume_shift))
        .route("/api/hr/my-shift/end", post(hr::end_shift))
        .route("/api/hr/my-shift/acknowledge-fatigue", post(hr::acknowledge_fatigue))
        .route(
            "/api/hr/leaves",
            get(hr::list_leave_requests).post(hr::create_leave_request),
        )
        .route(
            "/api/hr/leaves/{id}/action",
            put(hr::leave_action),
        )
        .route(
            "/api/hr/leaves/{id}/cancel",
            put(hr::cancel_leave),
        )
        .route(
            "/api/hr/on-call",
            get(hr::list_on_call).post(hr::create_on_call),
        )
        .route(
            "/api/hr/training-programs",
            get(hr::list_training_programs).post(hr::create_training_program),
        )
        .route(
            "/api/hr/training-records",
            post(hr::create_training_record),
        )
        .route(
            "/api/hr/appraisals",
            post(hr::create_appraisal),
        )
        .route(
            "/api/hr/statutory-records",
            post(hr::create_statutory_record),
        )
        .route(
            "/api/hr/training/compliance",
            get(hr::training_compliance),
        )
        // ── BME / CMMS ───────────────────────────────────────
        .route(
            "/api/bme/equipment",
            get(bme::list_equipment).post(bme::create_equipment),
        )
        .route(
            "/api/bme/equipment/{id}",
            get(bme::get_equipment).put(bme::update_equipment),
        )
        .route(
            "/api/bme/pm-schedules",
            get(bme::list_pm_schedules).post(bme::create_pm_schedule),
        )
        .route(
            "/api/bme/pm-schedules/{id}",
            put(bme::update_pm_schedule),
        )
        .route(
            "/api/bme/work-orders",
            get(bme::list_work_orders).post(bme::create_work_order),
        )
        .route(
            "/api/bme/work-orders/{id}",
            get(bme::get_work_order),
        )
        .route(
            "/api/bme/work-orders/{id}/status",
            put(bme::update_work_order_status),
        )
        .route(
            "/api/bme/calibrations",
            get(bme::list_calibrations).post(bme::create_calibration),
        )
        // ── Unified Assets & Stores ─────────────────────────
        .route("/api/assets", get(assets::list_assets))
        .route(
            "/api/assets/categories",
            get(assets::list_asset_categories).post(assets::create_asset_category),
        )
        .route(
            "/api/assets/categories/{id}",
            put(assets::update_asset_category),
        )
        .route(
            "/api/assets/store-categories",
            get(assets::list_store_categories).post(assets::create_store_category),
        )
        .route(
            "/api/assets/store-categories/{id}",
            put(assets::update_store_category),
        )
        .route(
            "/api/assets/classifications",
            post(assets::upsert_asset_classification),
        )
        .route(
            "/api/materials/requisitions",
            get(materials::list_requisitions),
        )
        .route("/api/materials/inventory", get(materials::list_inventory))
        .route("/api/materials/analytics", get(materials::materials_analytics))
        .route(
            "/api/assets/movements",
            get(assets::list_asset_movements).post(assets::create_asset_movement),
        )
        .route(
            "/api/assets/movements/{id}/complete",
            put(assets::complete_asset_movement),
        )
        .route(
            "/api/assets/movements/{id}/reject",
            put(assets::reject_asset_movement),
        )
        .route(
            "/api/bme/calibrations/{id}",
            put(bme::update_calibration),
        )
        .route(
            "/api/bme/contracts",
            get(bme::list_contracts).post(bme::create_contract),
        )
        .route(
            "/api/bme/contracts/{id}",
            put(bme::update_contract),
        )
        .route(
            "/api/bme/breakdowns",
            get(bme::list_breakdowns).post(bme::create_breakdown),
        )
        .route(
            "/api/bme/breakdowns/{id}/status",
            put(bme::update_breakdown_status),
        )
        .route(
            "/api/bme/vendor-evaluations",
            get(bme::list_vendor_evaluations).post(bme::create_vendor_evaluation),
        )
        .route(
            "/api/bme/stats",
            get(bme::get_bme_stats),
        )
        .route(
            "/api/bme/analytics/mtbf",
            get(bme::get_mtbf_analytics),
        )
        .route(
            "/api/bme/analytics/uptime",
            get(bme::get_uptime_analytics),
        )
        .merge(medbrains_lms::router())
        // ── MRD (Medical Records Department) ────────────────────
        .route(
            "/api/mrd/records",
            get(mrd::list_records).post(mrd::create_record),
        )
        .route(
            "/api/mrd/records/{id}",
            get(mrd::get_record).put(mrd::update_record),
        )
        .route(
            "/api/mrd/records/{id}/movements",
            get(mrd::list_movements),
        )
        .route(
            "/api/mrd/records/{id}/issue",
            post(mrd::issue_record),
        )
        .route(
            "/api/mrd/records/{record_id}/movements/{id}/return",
            post(mrd::return_record),
        )
        .route(
            "/api/mrd/births",
            get(mrd::list_births).post(mrd::create_birth),
        )
        .route(
            "/api/mrd/births/{id}",
            get(mrd::get_birth),
        )
        .route(
            "/api/mrd/deaths",
            get(mrd::list_deaths).post(mrd::create_death),
        )
        .route(
            "/api/mrd/deaths/{id}",
            get(mrd::get_death),
        )
        .route(
            "/api/mrd/retention-policies",
            get(mrd::list_retention_policies).post(mrd::create_retention_policy),
        )
        .route(
            "/api/mrd/retention-policies/{id}",
            put(mrd::update_retention_policy),
        )
        .route(
            "/api/mrd/storage-locations",
            get(mrd::list_storage_locations).post(mrd::create_storage_location),
        )
        .route(
            "/api/mrd/storage-locations/{id}",
            put(mrd::update_storage_location),
        )
        .route(
            "/api/mrd/case-sheets",
            get(mrd::list_case_sheet_packets),
        )
        .route(
            "/api/mrd/case-sheets/from-opd/{encounter_id}",
            post(mrd::generate_opd_case_sheet_packet),
        )
        .route(
            "/api/mrd/case-sheets/from-ipd/{admission_id}",
            post(mrd::generate_ipd_case_sheet_packet),
        )
        .route(
            "/api/mrd/case-sheets/{id}",
            get(mrd::get_case_sheet_packet),
        )
        .route(
            "/api/mrd/case-sheets/{id}/pages",
            get(mrd::list_case_sheet_pages),
        )
        .route(
            "/api/mrd/case-sheets/{packet_id}/pages/{page_id}/status",
            put(mrd::update_case_sheet_page_status),
        )
        .route(
            "/api/mrd/case-sheets/{id}/completeness",
            get(mrd::get_case_sheet_completeness),
        )
        .route(
            "/api/mrd/case-sheets/{id}/print",
            post(mrd::print_case_sheet_packet),
        )
        .route(
            "/api/mrd/case-sheets/{id}/file",
            post(mrd::file_case_sheet_packet),
        )
        .route(
            "/api/mrd/stats/morbidity-mortality",
            get(mrd::stats_morbidity_mortality),
        )
        .route(
            "/api/mrd/stats/admission-discharge",
            get(mrd::stats_admission_discharge),
        )
        .route(
            "/api/mrd/form-records",
            get(mrd::list_form_records),
        )
        .route(
            "/api/mrd/form-records/{id}/complete",
            post(mrd::complete_form_record),
        )
        .route(
            "/api/mrd/form-records/{id}/verify",
            post(mrd::verify_form_record),
        )
        .route(
            "/api/mrd/form-records/{id}/attach-document",
            post(mrd::attach_form_document),
        )
        // ── Consent Management ───────────────────────────────
        .route(
            "/api/consent/templates",
            get(consent::list_templates).post(consent::create_template),
        )
        .route(
            "/api/consent/templates/{id}",
            get(consent::get_template)
                .put(consent::update_template)
                .delete(consent::delete_template),
        )
        .route(
            "/api/consent/audit",
            get(consent::list_audit),
        )
        .route(
            "/api/consent/audit/patient/{patient_id}",
            get(consent::patient_audit),
        )
        .route(
            "/api/consent/verify",
            post(consent::verify_consent),
        )
        .route(
            "/api/consent/verify/patient/{patient_id}",
            get(consent::patient_summary),
        )
        .route(
            "/api/consent/revoke",
            post(consent::revoke_consent),
        )
        .route(
            "/api/consent/signatures",
            get(consent::list_signatures).post(consent::create_signature),
        )
        .route(
            "/api/consent/signatures/{id}",
            get(consent::get_signature).delete(consent::delete_signature),
        )
        // ── Camp Management ───────────────────────────────────
        .merge(medbrains_camp::router())
        .route(
            "/api/camp/camps/{camp_id}/asset-candidates",
            get(assets::list_camp_asset_candidates),
        )
        .route(
            "/api/camp/camps/{camp_id}/asset-reservations",
            get(assets::list_camp_asset_reservations).post(assets::create_camp_asset_reservation),
        )
        .route(
            "/api/camp/asset-reservations/{id}/issue",
            put(assets::issue_camp_asset_reservation),
        )
        .route(
            "/api/camp/asset-reservations/{id}/return",
            put(assets::return_camp_asset_reservation),
        )
        .route(
            "/api/camp/asset-reservations/{id}/cancel",
            put(assets::cancel_camp_asset_reservation),
        )
        .merge(medbrains_ambulance::router())
        .merge(medbrains_care_mgmt::router())
        // ── Communication Hub ─────────────────────────────────
        .route(
            "/api/communications/templates",
            get(communications::list_templates).post(communications::create_template),
        )
        .route(
            "/api/communications/templates/{id}",
            put(communications::update_template),
        )
        .route(
            "/api/communications/messages",
            get(communications::list_messages).post(communications::create_message),
        )
        .route(
            "/api/communications/messages/{id}",
            get(communications::get_message),
        )
        .route(
            "/api/communications/messages/{id}/status",
            put(communications::update_message_status),
        )
        .route(
            "/api/communications/clinical",
            get(communications::list_clinical_messages).post(communications::create_clinical_message),
        )
        .route(
            "/api/communications/clinical/{id}",
            get(communications::get_clinical_message),
        )
        .route(
            "/api/communications/clinical/{id}/acknowledge",
            put(communications::acknowledge_clinical_message),
        )
        .route(
            "/api/communications/alerts",
            get(communications::list_critical_alerts).post(communications::create_critical_alert),
        )
        .route(
            "/api/communications/alerts/{id}/acknowledge",
            put(communications::acknowledge_alert),
        )
        .route(
            "/api/communications/alerts/{id}/resolve",
            put(communications::resolve_alert),
        )
        .route(
            "/api/communications/complaints",
            get(communications::list_complaints).post(communications::create_complaint),
        )
        .route(
            "/api/communications/complaints/{id}",
            put(communications::update_complaint),
        )
        .route(
            "/api/communications/complaints/{id}/resolve",
            put(communications::resolve_complaint),
        )
        .route(
            "/api/communications/feedback",
            get(communications::list_feedback).post(communications::create_feedback),
        )
        .route(
            "/api/communications/feedback/stats",
            get(communications::get_feedback_stats),
        )
        .merge(medbrains_analytics::router())
        .merge(medbrains_facilities::router())
        // ── Security Department ──────────────────────────────────
        .route(
            "/api/security/zones",
            get(security::list_zones)
                .post(security::create_zone),
        )
        .route(
            "/api/security/zones/{id}",
            put(security::update_zone),
        )
        .route(
            "/api/security/access-logs",
            get(security::list_access_logs)
                .post(security::create_access_log),
        )
        .route(
            "/api/security/cards",
            get(security::list_access_cards)
                .post(security::create_access_card),
        )
        .route(
            "/api/security/cards/{id}",
            put(security::update_access_card),
        )
        .route(
            "/api/security/cards/{id}/deactivate",
            put(security::deactivate_access_card),
        )
        .route(
            "/api/security/cameras",
            get(security::list_cameras)
                .post(security::create_camera),
        )
        .route(
            "/api/security/cameras/{id}",
            put(security::update_camera),
        )
        .route(
            "/api/security/incidents",
            get(security::list_incidents)
                .post(security::create_incident),
        )
        .route(
            "/api/security/incidents/{id}",
            get(security::get_incident)
                .put(security::update_incident),
        )
        .route(
            "/api/security/patient-tags",
            get(security::list_patient_tags)
                .post(security::create_patient_tag),
        )
        .route(
            "/api/security/patient-tags/{id}/deactivate",
            put(security::deactivate_patient_tag),
        )
        .route(
            "/api/security/tag-alerts",
            get(security::list_tag_alerts),
        )
        .route(
            "/api/security/tag-alerts/{id}/resolve",
            put(security::resolve_tag_alert),
        )
        .route(
            "/api/security/debriefs",
            get(security::list_debriefs)
                .post(security::create_debrief),
        )
        .route(
            "/api/security/debriefs/{id}",
            get(security::get_debrief),
        )
        // ── Specialty Clinical: Oncology depth (staging + radiation) ──
        .route(
            "/api/specialty/oncology/staging",
            get(specialty_other::list_cancer_stagings)
                .post(specialty_other::create_cancer_staging),
        )
        .route(
            "/api/specialty/oncology/radiation",
            get(specialty_other::list_radiation_sessions)
                .post(specialty_other::create_radiation_session),
        )
        // ── Specialty Clinical: Cath Lab ──
        .route(
            "/api/specialty/cath-lab/procedures",
            get(specialty_interventional::list_cath_procedures)
                .post(specialty_interventional::create_cath_procedure),
        )
        .route(
            "/api/specialty/cath-lab/procedures/{id}",
            get(specialty_interventional::get_cath_procedure)
                .put(specialty_interventional::update_cath_procedure),
        )
        .route(
            "/api/specialty/cath-lab/procedures/{procedure_id}/hemodynamics",
            get(specialty_interventional::list_hemodynamics)
                .post(specialty_interventional::create_hemodynamic),
        )
        .route(
            "/api/specialty/cath-lab/procedures/{procedure_id}/devices",
            get(specialty_interventional::list_cath_devices)
                .post(specialty_interventional::create_cath_device),
        )
        .route(
            "/api/specialty/cath-lab/procedures/{procedure_id}/stemi-timeline",
            get(specialty_interventional::list_stemi_timeline)
                .post(specialty_interventional::create_stemi_event),
        )
        .route(
            "/api/specialty/cath-lab/procedures/{procedure_id}/post-monitoring",
            get(specialty_interventional::list_post_monitoring)
                .post(specialty_interventional::create_post_monitoring),
        )
        // ── Specialty Clinical: Endoscopy ──
        .route(
            "/api/specialty/endoscopy/procedures",
            get(specialty_interventional::list_endoscopy_procedures)
                .post(specialty_interventional::create_endoscopy_procedure),
        )
        .route(
            "/api/specialty/endoscopy/procedures/{id}",
            put(specialty_interventional::update_endoscopy_procedure),
        )
        .route(
            "/api/specialty/endoscopy/scopes",
            get(specialty_interventional::list_scopes)
                .post(specialty_interventional::create_scope),
        )
        .route(
            "/api/specialty/endoscopy/scopes/{id}",
            put(specialty_interventional::update_scope),
        )
        .route(
            "/api/specialty/endoscopy/reprocessing",
            get(specialty_interventional::list_reprocessing)
                .post(specialty_interventional::create_reprocessing),
        )
        .route(
            "/api/specialty/endoscopy/procedures/{procedure_id}/biopsies",
            get(specialty_interventional::list_biopsy_specimens)
                .post(specialty_interventional::create_biopsy_specimen),
        )
        // ── Specialty Clinical: PMR / Audiology ──
        .route(
            "/api/specialty/pmr/rehab-plans",
            get(specialty_other::list_rehab_plans)
                .post(specialty_other::create_rehab_plan),
        )
        .route(
            "/api/specialty/pmr/rehab-plans/{plan_id}/sessions",
            get(specialty_other::list_rehab_sessions)
                .post(specialty_other::create_rehab_session),
        )
        .route(
            "/api/specialty/pmr/audiology",
            get(specialty_other::list_audiology_tests)
                .post(specialty_other::create_audiology_test),
        )
        .route(
            "/api/specialty/pmr/psychometric",
            get(specialty_other::list_psychometric_tests)
                .post(specialty_other::create_psychometric_test),
        )
        // ── Specialty Clinical: Palliative / Mortuary / Nuclear Medicine ──
        .route(
            "/api/specialty/palliative/dnr",
            get(specialty_other::list_dnr_orders)
                .post(specialty_other::create_dnr_order),
        )
        .route(
            "/api/specialty/palliative/dnr/{id}/revoke",
            put(specialty_other::revoke_dnr_order),
        )
        .route(
            "/api/specialty/palliative/pain",
            get(specialty_other::list_pain_assessments)
                .post(specialty_other::create_pain_assessment),
        )
        .route(
            "/api/specialty/mortuary/records",
            get(specialty_other::list_mortuary_records)
                .post(specialty_other::create_mortuary_record),
        )
        .route(
            "/api/specialty/mortuary/records/{id}",
            put(specialty_other::update_mortuary_record),
        )
        .route(
            "/api/specialty/nuclear-med/sources",
            get(specialty_other::list_nuclear_sources)
                .post(specialty_other::create_nuclear_source),
        )
        .route(
            "/api/specialty/nuclear-med/administrations",
            get(specialty_other::list_nuclear_administrations)
                .post(specialty_other::create_nuclear_administration),
        )
        // ── Specialty Clinical: Other Specialties ──
        .route(
            "/api/specialty/templates",
            get(specialty_other::list_specialty_templates)
                .post(specialty_other::create_specialty_template),
        )
        .route(
            "/api/specialty/records",
            get(specialty_other::list_specialty_records)
                .post(specialty_other::create_specialty_record),
        )
        .route(
            "/api/specialty/dialysis/sessions",
            get(specialty_other::list_dialysis_sessions)
                .post(specialty_other::create_dialysis_session),
        )
        .route(
            "/api/specialty/dialysis/sessions/{id}",
            put(specialty_other::update_dialysis_session),
        )
        .route(
            "/api/specialty/chemo/protocols",
            get(specialty_other::list_chemo_protocols)
                .post(specialty_other::create_chemo_protocol),
        )
        .route(
            "/api/specialty/chemo/protocols/{id}",
            put(specialty_other::update_chemo_protocol),
        )
        .route(
            "/api/specialty/chemo/anthracycline-cumulative",
            get(specialty_other::anthracycline_cumulative),
        )
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
        .route(
            "/api/order-sets/templates",
            get(order_sets::list_templates).post(order_sets::create_template),
        )
        .route(
            "/api/order-sets/templates/{id}",
            get(order_sets::get_template)
                .put(order_sets::update_template)
                .delete(order_sets::delete_template),
        )
        .route(
            "/api/order-sets/templates/{id}/items",
            post(order_sets::add_item),
        )
        .route(
            "/api/order-sets/templates/{tid}/items/{iid}",
            put(order_sets::update_item)
                .delete(order_sets::delete_item),
        )
        .route(
            "/api/order-sets/templates/{id}/new-version",
            post(order_sets::create_new_version),
        )
        .route(
            "/api/order-sets/templates/{id}/approve",
            put(order_sets::approve_template),
        )
        .route(
            "/api/order-sets/templates/{id}/versions",
            get(order_sets::list_versions),
        )
        .route(
            "/api/order-sets/suggest",
            get(order_sets::suggest_templates),
        )
        .route(
            "/api/order-sets/activate",
            post(order_sets::activate_order_set),
        )
        .route(
            "/api/order-sets/activations",
            get(order_sets::list_activations),
        )
        .route(
            "/api/order-sets/activations/{id}",
            get(order_sets::get_activation),
        )
        .route(
            "/api/order-sets/analytics",
            get(order_sets::get_analytics),
        )
        .route(
            "/api/order-sets/analytics/{template_id}",
            get(order_sets::get_template_analytics),
        )
        .merge(medbrains_community_health::router())
        .merge(medbrains_scheduling::router())
        // ── Clinical & Operational Analytics ────────────────────
        .route(
            "/api/analytics/revenue/department",
            get(analytics::dept_revenue),
        )
        .route(
            "/api/analytics/revenue/doctor",
            get(analytics::doctor_revenue),
        )
        .route(
            "/api/analytics/ipd/census",
            get(analytics::ipd_census),
        )
        .route(
            "/api/analytics/lab/tat",
            get(analytics::lab_tat),
        )
        .route(
            "/api/analytics/pharmacy/sales",
            get(analytics::pharmacy_sales),
        )
        .route(
            "/api/analytics/ot/utilization",
            get(analytics::ot_utilization),
        )
        .route(
            "/api/analytics/er/volume",
            get(analytics::er_volume),
        )
        .route(
            "/api/analytics/clinical/indicators",
            get(analytics::clinical_indicators),
        )
        .route(
            "/api/analytics/opd/footfall",
            get(analytics::opd_footfall),
        )
        .route(
            "/api/analytics/bed/occupancy",
            get(analytics::bed_occupancy),
        )
        .route(
            "/api/analytics/export",
            get(analytics::export_csv),
        )
        // ── Governed Reports Command Center ───────────────────
        .route("/api/reports/catalog", get(reports::catalog))
        .route("/api/reports/{id}/data", get(reports::data))
        // ── Print Data (clinical) ─────────────────────────────
        .route(
            "/api/print-data/prescription/{encounter_id}",
            get(print_data::get_prescription_print_data),
        )
        .route(
            "/api/print-data/lab-report/{order_id}",
            get(print_data::get_lab_report_print_data),
        )
        .route(
            "/api/print-data/radiology-report/{order_id}",
            get(print_data::get_radiology_report_print_data),
        )
        .route(
            "/api/print-data/patient-card/{patient_id}",
            get(print_data::get_patient_card_print_data),
        )
        .route(
            "/api/print-data/culture-sensitivity/{order_id}",
            get(print_data::get_culture_sensitivity_print_data),
        )
        .route(
            "/api/print-data/histopath-report/{order_id}",
            get(print_data::get_histopath_report_print_data),
        )
        .route(
            "/api/print-data/crossmatch-report/{request_id}",
            get(print_data::get_crossmatch_report_print_data),
        )
        .route(
            "/api/print-data/component-slip/{issue_id}",
            get(print_data::get_component_slip_print_data),
        )
        .route(
            "/api/print-data/investigation-requisition/{order_id}",
            get(print_data::get_investigation_requisition_print_data),
        )
        .route(
            "/api/print-data/wristband/{admission_id}",
            get(print_data_clinical::get_wristband_print_data),
        )
        .route(
            "/api/print-data/opd-certificate/{certificate_id}",
            get(print_data_clinical::get_opd_certificate_print_data),
        )
        .route(
            "/api/print-data/opd-consent/{consent_id}",
            get(print_data_clinical::get_opd_consent_print_data),
        )
        .route(
            "/api/print-data/appointment-slip/{appointment_id}",
            get(print_data_clinical::get_appointment_slip_print_data),
        )
        .route(
            "/api/print-data/death-certificate/{admission_id}",
            get(print_data_clinical::get_death_certificate_print_data),
        )
        .route(
            "/api/print-data/discharge/{admission_id}",
            get(print_data_clinical::get_discharge_print_data),
        )
        .route(
            "/api/print-data/token-slip/{token_id}",
            get(print_data_clinical::get_token_slip_print_data),
        )
        .route(
            "/api/print-data/visitor-pass/{pass_id}",
            get(print_data_clinical::get_visitor_pass_print_data),
        )
        .route(
            "/api/print-data/treatment-chart/{admission_id}",
            get(print_data_clinical::get_treatment_chart_print_data),
        )
        .route(
            "/api/print-data/transfer-summary/{transfer_id}",
            get(print_data_clinical::get_transfer_summary_print_data),
        )
        .route(
            "/api/print-data/patient-education/{material_id}",
            get(print_data_clinical::get_patient_education_print_data),
        )
        .route(
            "/api/print-data/registration-card/{patient_id}",
            get(print_data_clinical::get_registration_card_print_data),
        )
        .route(
            "/api/print-data/infant-wristband/{newborn_id}",
            get(print_data_clinical::get_infant_wristband_print_data),
        )
        // ── Print Data (billing) ──────────────────────────────
        .route(
            "/api/print-data/receipt/{payment_id}",
            get(print_data_billing::get_receipt_print_data),
        )
        .route(
            "/api/print-data/estimate/{invoice_id}",
            get(print_data_billing::get_estimate_print_data),
        )
        .route(
            "/api/print-data/credit-note/{id}",
            get(print_data_billing::get_credit_note_print_data),
        )
        .route(
            "/api/print-data/tds-certificate/{id}",
            get(print_data_billing::get_tds_certificate_print_data),
        )
        .route(
            "/api/print-data/gst-invoice/{invoice_id}",
            get(print_data_billing::get_gst_invoice_print_data),
        )
        .route(
            "/api/print-data/opd-bill/{invoice_id}",
            get(print_data_billing::get_opd_bill_print_data),
        )
        .route(
            "/api/print-data/ipd-interim-bill/{admission_id}",
            get(print_data_billing::get_ipd_interim_bill_print_data),
        )
        .route(
            "/api/print-data/ipd-final-bill/{invoice_id}",
            get(print_data_billing::get_ipd_final_bill_print_data),
        )
        .route(
            "/api/print-data/admission-consolidated-bill/{admission_id}",
            get(print_data_billing::get_admission_consolidated_bill_print_data),
        )
        .route(
            "/api/print-data/advance-receipt/{payment_id}",
            get(print_data_billing::get_advance_receipt_print_data),
        )
        .route(
            "/api/print-data/refund-receipt/{refund_id}",
            get(print_data_billing::get_refund_receipt_print_data),
        )
        .route(
            "/api/print-data/insurance-preauth/{request_id}",
            get(print_data_billing::get_insurance_preauth_print_data),
        )
        .route(
            "/api/print-data/cashless-claim/{claim_id}",
            get(print_data_billing::get_cashless_claim_print_data),
        )
        .route(
            "/api/print-data/package-estimate/{estimate_id}",
            get(print_data_billing::get_package_estimate_print_data),
        )
        .route(
            "/api/print-data/package-bill/{package_bill_id}",
            get(print_data_billing::get_package_bill_print_data),
        )
        .route(
            "/api/print-data/insurance-claim/{claim_id}",
            get(print_data_billing::get_insurance_claim_print_data),
        )
        // ── Print Data (consent forms) ───────────────────────────
        .route(
            "/api/print-data/consent/general/{admission_id}",
            get(print_data_consent::get_general_consent_print_data),
        )
        .route(
            "/api/print-data/consent/surgical/{booking_id}",
            get(print_data_consent::get_surgical_consent_print_data),
        )
        .route(
            "/api/print-data/consent/anesthesia/{booking_id}",
            get(print_data_consent::get_anesthesia_consent_print_data),
        )
        .route(
            "/api/print-data/consent/blood/{admission_id}",
            get(print_data_consent::get_blood_consent_print_data),
        )
        .route(
            "/api/print-data/consent/hiv/{patient_id}",
            get(print_data_consent::get_hiv_consent_print_data),
        )
        .route(
            "/api/print-data/consent/ama/{admission_id}",
            get(print_data_consent::get_ama_consent_print_data),
        )
        .route(
            "/api/print-data/consent/photo/{patient_id}",
            get(print_data_consent::get_photo_consent_print_data),
        )
        .route(
            "/api/print-data/consent/dnr/{admission_id}",
            get(print_data_consent::get_dnr_consent_print_data),
        )
        .route(
            "/api/print-data/consent/organ-donation/{patient_id}",
            get(print_data_consent::get_organ_donation_consent_print_data),
        )
        .route(
            "/api/print-data/consent/research/{enrollment_id}",
            get(print_data_consent::get_research_consent_print_data),
        )
        .route(
            "/api/print-data/consent/abdm/{patient_id}",
            get(print_data_consent::get_abdm_consent_print_data),
        )
        .route(
            "/api/print-data/consent/teaching/{admission_id}",
            get(print_data_consent::get_teaching_consent_print_data),
        )
        // ── Print Data (MRD forms) ───────────────────────────────
        .route(
            "/api/print-data/mrd/progress-note/{admission_id}",
            get(print_data_mrd::get_progress_note_print_data),
        )
        .route(
            "/api/print-data/mrd/nursing-assessment/{admission_id}",
            get(print_data_mrd::get_nursing_assessment_print_data),
        )
        .route(
            "/api/print-data/mrd/mar/{admission_id}",
            get(print_data_mrd::get_mar_print_data),
        )
        .route(
            "/api/print-data/mrd/vitals-chart/{admission_id}",
            get(print_data_mrd::get_vitals_chart_print_data),
        )
        .route(
            "/api/print-data/mrd/io-chart/{admission_id}",
            get(print_data_mrd::get_io_chart_print_data),
        )
        .route(
            "/api/print-data/mrd/discharge-checklist/{admission_id}",
            get(print_data_mrd::get_discharge_checklist_print_data),
        )
        // ── Print Data (Phase 3: Clinical Charts) ───────────────
        .route(
            "/api/print-data/fluid-balance-chart/{admission_id}",
            get(print_data_mrd::get_fluid_balance_chart_print_data),
        )
        .route(
            "/api/print-data/pain-assessment/{admission_id}",
            get(print_data_mrd::get_pain_assessment_print_data),
        )
        .route(
            "/api/print-data/fall-risk-assessment/{admission_id}",
            get(print_data_mrd::get_fall_risk_assessment_print_data),
        )
        .route(
            "/api/print-data/pressure-ulcer-risk/{admission_id}",
            get(print_data_mrd::get_pressure_ulcer_risk_print_data),
        )
        .route(
            "/api/print-data/gcs-chart/{admission_id}",
            get(print_data_mrd::get_gcs_chart_print_data),
        )
        .route(
            "/api/print-data/transfusion-requisition/{request_id}",
            get(print_data_mrd::get_transfusion_requisition_print_data),
        )
        // ── Print Data (Phase 3: Surgical & OT) ─────────────────
        .route(
            "/api/print-data/case-sheet-cover/{admission_id}",
            get(print_data_surgical::get_case_sheet_cover_print_data),
        )
        .route(
            "/api/print-data/preop-assessment/{admission_id}",
            get(print_data_surgical::get_preop_assessment_print_data),
        )
        .route(
            "/api/print-data/surgical-safety-checklist/{surgery_id}",
            get(print_data_surgical::get_surgical_safety_checklist_print_data),
        )
        .route(
            "/api/print-data/anesthesia-record/{surgery_id}",
            get(print_data_surgical::get_anesthesia_record_print_data),
        )
        .route(
            "/api/print-data/operation-notes/{surgery_id}",
            get(print_data_surgical::get_operation_notes_print_data),
        )
        .route(
            "/api/print-data/postop-orders/{surgery_id}",
            get(print_data_surgical::get_postop_orders_print_data),
        )
        .route(
            "/api/print-data/transfusion-monitoring/{transfusion_id}",
            get(print_data_surgical::get_transfusion_monitoring_print_data),
        )
        // ── Print Data (Phase 3: Medico-Legal) ──────────────────
        .route(
            "/api/print-data/ama-form/{admission_id}",
            get(print_data_medicolegal::get_ama_form_print_data),
        )
        .route(
            "/api/print-data/mlc-register/{case_id}",
            get(print_data_medicolegal::get_mlc_register_print_data),
        )
        .route(
            "/api/print-data/mlc-police-intimation/{intimation_id}",
            get(print_data_medicolegal::get_mlc_police_intimation_print_data),
        )
        .route(
            "/api/print-data/wound-certificate/{case_id}",
            get(print_data_medicolegal::get_wound_certificate_print_data),
        )
        .route(
            "/api/print-data/age-estimation/{case_id}",
            get(print_data_medicolegal::get_age_estimation_print_data),
        )
        .route(
            "/api/print-data/death-declaration/{patient_id}",
            get(print_data_medicolegal::get_death_declaration_print_data),
        )
        .route(
            "/api/print-data/mlc-documentation/{case_id}",
            get(print_data_medicolegal::get_mlc_documentation_print_data),
        )
        // ── Print Data (Phase 3: Quality & Safety) ──────────────
        .route(
            "/api/print-data/incident-report/{incident_id}",
            get(print_data_quality::get_incident_report_print_data),
        )
        .route(
            "/api/print-data/rca-template/{incident_id}",
            get(print_data_quality::get_rca_template_print_data),
        )
        .route(
            "/api/print-data/capa-form/{capa_id}",
            get(print_data_quality::get_capa_form_print_data),
        )
        .route(
            "/api/print-data/adr-report/{report_id}",
            get(print_data_quality::get_adr_report_print_data),
        )
        .route(
            "/api/print-data/transfusion-reaction/{reaction_id}",
            get(print_data_quality::get_transfusion_reaction_print_data),
        )
        // ── Phase 4: Clinical Delivery Prints ─────────────────────
        .route(
            "/api/print-data/opd-prescription/{encounter_id}",
            get(print_data_clinical::get_opd_prescription_print_data),
        )
        .route(
            "/api/print-data/lab-report-full/{order_id}",
            get(print_data_clinical::get_lab_report_full_print_data),
        )
        .route(
            "/api/print-data/cumulative-lab-report/{patient_id}",
            get(print_data_clinical::get_cumulative_lab_report_print_data),
        )
        .route(
            "/api/print-data/radiology-report-full/{order_id}",
            get(print_data_clinical::get_radiology_report_full_print_data),
        )
        // Phase 4 billing prints already registered above (credit-note, package-bill, insurance-claim, tds-certificate)
        // ── Phase 4: Regulatory Prints ─────────────────────────────
        .route(
            "/api/print-data/nabh-quality-report/{period}",
            get(print_data_regulatory::get_nabh_quality_report_print_data),
        )
        .route(
            "/api/print-data/nmc-compliance-report/{period}",
            get(print_data_regulatory::get_nmc_compliance_report_print_data),
        )
        .route(
            "/api/print-data/nabl-quality-report/{period}",
            get(print_data_regulatory::get_nabl_quality_report_print_data),
        )
        .route(
            "/api/print-data/spcb-bmw-returns/{quarter}",
            get(print_data_regulatory::get_spcb_bmw_returns_print_data),
        )
        .route(
            "/api/print-data/peso-compliance/{year}",
            get(print_data_regulatory::get_peso_compliance_print_data),
        )
        .route(
            "/api/print-data/drug-license-report/{license_id}",
            get(print_data_regulatory::get_drug_license_report_print_data),
        )
        .route(
            "/api/print-data/pcpndt-report/{period}",
            get(print_data_regulatory::get_pcpndt_report_print_data),
        )
        .route(
            "/api/print-data/birth-register/{period}",
            get(print_data_regulatory::get_birth_register_print_data),
        )
        .route(
            "/api/print-data/death-register/{period}",
            get(print_data_regulatory::get_death_register_print_data),
        )
        .route(
            "/api/print-data/mlc-register-summary/{period}",
            get(print_data_regulatory::get_mlc_register_summary_print_data),
        )
        .route(
            "/api/print-data/aebas-attendance/{period}",
            get(print_data_regulatory::get_aebas_attendance_print_data),
        )
        .route(
            "/api/print-data/nmc-narf-assessment/{year}",
            get(print_data_regulatory::get_nmc_narf_assessment_print_data),
        )
        // ── Phase 4: Admin & Procurement Prints ─────────────────────
        .route(
            "/api/print-data/indent-form/{indent_id}",
            get(print_data_admin::get_indent_form_print_data),
        )
        .route(
            "/api/print-data/purchase-order/{po_id}",
            get(print_data_admin::get_purchase_order_print_data),
        )
        .route(
            "/api/print-data/grn/{grn_id}",
            get(print_data_admin::get_grn_print_data),
        )
        .route(
            "/api/print-data/material-issue-voucher/{voucher_id}",
            get(print_data_admin::get_material_issue_voucher_print_data),
        )
        .route(
            "/api/print-data/stock-transfer-note/{transfer_id}",
            get(print_data_admin::get_stock_transfer_note_print_data),
        )
        .route(
            "/api/print-data/ndps-register/{period}",
            get(print_data_admin::get_ndps_register_print_data),
        )
        .route(
            "/api/print-data/drug-expiry-alert/{store_id}",
            get(print_data_admin::get_drug_expiry_alert_print_data),
        )
        .route(
            "/api/print-data/equipment-condemnation/{condemnation_id}",
            get(print_data_admin::get_equipment_condemnation_print_data),
        )
        .route(
            "/api/print-data/work-order/{work_order_id}",
            get(print_data_admin::get_work_order_print_data),
        )
        .route(
            "/api/print-data/pm-checklist/{pm_id}",
            get(print_data_admin::get_pm_checklist_print_data),
        )
        // ══════════════════════════════════════════════════════════
        // PHASE 5: Admin/HR, BME, Blood Bank, OT, Clinical Forms
        // ══════════════════════════════════════════════════════════
        // ── Phase 5: Admin/HR Forms ───────────────────────────────
        .route(
            "/api/print-data/employee-id-card/{employee_id}",
            get(print_data_hr::get_employee_id_card_print_data),
        )
        .route(
            "/api/print-data/duty-roster/{department_id}/{period}",
            get(print_data_hr::get_duty_roster_print_data),
        )
        .route(
            "/api/print-data/leave-application/{leave_id}",
            get(print_data_hr::get_leave_application_print_data),
        )
        .route(
            "/api/print-data/staff-attendance/{department_id}/{month}/{year}",
            get(print_data_hr::get_staff_attendance_print_data),
        )
        .route(
            "/api/print-data/training-certificate/{training_id}",
            get(print_data_hr::get_training_certificate_print_data),
        )
        .route(
            "/api/print-data/staff-credentials/{employee_id}",
            get(print_data_hr::get_staff_credentials_print_data),
        )
        .route(
            "/api/print-data/visitor-register/{date}",
            get(print_data_hr::get_visitor_register_print_data),
        )
        // ── Phase 5: BME/Engineering Forms ────────────────────────
        .route(
            "/api/print-data/amc-contract/{contract_id}",
            get(print_data_bme::get_amc_contract_print_data),
        )
        .route(
            "/api/print-data/calibration-certificate/{calibration_id}",
            get(print_data_bme::get_calibration_certificate_print_data),
        )
        .route(
            "/api/print-data/equipment-breakdown/{breakdown_id}",
            get(print_data_bme::get_equipment_breakdown_print_data),
        )
        .route(
            "/api/print-data/equipment-history/{equipment_id}",
            get(print_data_bme::get_equipment_history_print_data),
        )
        .route(
            "/api/print-data/mgps-log/{date}/{shift}",
            get(print_data_bme::get_mgps_log_print_data),
        )
        .route(
            "/api/print-data/water-quality/{test_id}",
            get(print_data_bme::get_water_quality_print_data),
        )
        .route(
            "/api/print-data/dg-ups-log/{equipment_id}/{date}",
            get(print_data_bme::get_dg_ups_log_print_data),
        )
        .route(
            "/api/print-data/fire-inspection/{inspection_id}",
            get(print_data_bme::get_fire_inspection_print_data),
        )
        .route(
            "/api/print-data/materiovigilance/{report_id}",
            get(print_data_bme::get_materiovigilance_print_data),
        )
        .route(
            "/api/print-data/fire-mock-drill/{drill_id}",
            get(print_data_bme::get_fire_mock_drill_print_data),
        )
        // ── Phase 5: Blood Bank & OT Forms ────────────────────────
        .route(
            "/api/print-data/ot-register/{ot_id}/{date}",
            get(print_data_clinical::get_ot_register_print_data),
        )
        .route(
            "/api/print-data/blood-donor-form/{donor_id}",
            get(print_data_clinical::get_blood_donor_form_print_data),
        )
        .route(
            "/api/print-data/cross-match-requisition/{requisition_id}",
            get(print_data_clinical::get_cross_match_requisition_print_data),
        )
        // ── Phase 5: Clinical/Identity Forms ──────────────────────
        // appointment-slip already registered above
        .route(
            "/api/print-data/dpdp-consent/{consent_id}",
            get(print_data_clinical::get_dpdp_consent_print_data),
        )
        .route(
            "/api/print-data/video-consent/{video_consent_id}",
            get(print_data_clinical::get_video_consent_print_data),
        )
        .route(
            "/api/print-data/restraint-documentation/{restraint_id}",
            get(print_data_clinical::get_restraint_documentation_print_data),
        )
        // ══════════════════════════════════════════════════════════
        // PHASE 6: ACADEMIC/SPECIALTY FORMS & BRANDING
        // ══════════════════════════════════════════════════════════
        // -- Phase 6: Academic/Medical College Forms --
        .route(
            "/api/print-data/student-admission-form/{admission_id}",
            get(print_data_academic::get_student_admission_form),
        )
        .route(
            "/api/print-data/intern-rotation-schedule/{schedule_id}",
            get(print_data_academic::get_intern_rotation_schedule),
        )
        .route(
            "/api/print-data/pg-logbook-entry/{entry_id}",
            get(print_data_academic::get_pg_logbook_entry),
        )
        .route(
            "/api/print-data/internal-assessment-marks/{assessment_id}",
            get(print_data_academic::get_internal_assessment_marks),
        )
        .route(
            "/api/print-data/exam-hall-ticket/{ticket_id}",
            get(print_data_academic::get_exam_hall_ticket),
        )
        .route(
            "/api/print-data/osce-scoring-sheet/{exam_id}/{station_number}",
            get(print_data_academic::get_osce_scoring_sheet),
        )
        .route(
            "/api/print-data/simulation-debriefing/{session_id}",
            get(print_data_academic::get_simulation_debriefing),
        )
        .route(
            "/api/print-data/cme-certificate/{certificate_id}",
            get(print_data_academic::get_cme_certificate),
        )
        .route(
            "/api/print-data/iec-approval-certificate/{approval_id}",
            get(print_data_academic::get_iec_approval_certificate),
        )
        .route(
            "/api/print-data/research-proposal-form/{proposal_id}",
            get(print_data_academic::get_research_proposal_form),
        )
        .route(
            "/api/print-data/hostel-allotment-order/{order_id}",
            get(print_data_academic::get_hostel_allotment_order),
        )
        .route(
            "/api/print-data/anti-ragging-undertaking/{undertaking_id}",
            get(print_data_academic::get_anti_ragging_undertaking),
        )
        .route(
            "/api/print-data/disability-accommodation-plan/{plan_id}",
            get(print_data_academic::get_disability_accommodation_plan),
        )
        .route(
            "/api/print-data/internship-completion-certificate/{certificate_id}",
            get(print_data_academic::get_internship_completion_certificate),
        )
        .route(
            "/api/print-data/service-bond-agreement/{bond_id}",
            get(print_data_academic::get_service_bond_agreement),
        )
        .route(
            "/api/print-data/stipend-payment-advice/{advice_id}",
            get(print_data_academic::get_stipend_payment_advice),
        )
        // -- Phase 6: Hospital Branding --
        .route(
            "/api/print-data/hospital-branding",
            get(print_data_academic::get_hospital_branding),
        )
        // ── Multi-Hospital Management ──────────────────────────────────
        .merge(medbrains_admin::router())
        // ── CMS & Blog ──────────────────────────────────────────────
        // Dashboard
        .route(
            "/api/cms/dashboard",
            get(cms::get_dashboard_stats),
        )
        // Categories
        .route(
            "/api/cms/categories",
            get(cms::list_categories).post(cms::create_category),
        )
        .route(
            "/api/cms/categories/tree",
            get(cms::list_categories_tree),
        )
        .route(
            "/api/cms/categories/{id}",
            get(cms::get_category)
                .put(cms::update_category)
                .delete(cms::delete_category),
        )
        // Tags
        .route(
            "/api/cms/tags",
            get(cms::list_tags).post(cms::create_tag),
        )
        .route(
            "/api/cms/tags/{id}",
            get(cms::get_tag)
                .put(cms::update_tag)
                .delete(cms::delete_tag),
        )
        .route(
            "/api/cms/tags/bulk-delete",
            post(cms::bulk_delete_tags),
        )
        // Authors
        .route(
            "/api/cms/authors",
            get(cms::list_authors).post(cms::create_author),
        )
        .route(
            "/api/cms/authors/{id}",
            get(cms::get_author)
                .put(cms::update_author)
                .delete(cms::delete_author),
        )
        // Media Library
        .route(
            "/api/cms/media",
            get(cms::list_media).post(cms::create_media),
        )
        .route(
            "/api/cms/media/{id}",
            get(cms::get_media)
                .put(cms::update_media)
                .delete(cms::delete_media),
        )
        // Posts
        .route(
            "/api/cms/posts",
            get(cms::list_posts).post(cms::create_post),
        )
        .route(
            "/api/cms/posts/{id}",
            get(cms::get_post)
                .put(cms::update_post)
                .delete(cms::delete_post),
        )
        // Post Workflow
        .route(
            "/api/cms/posts/{id}/submit-review",
            post(cms::submit_post_for_review),
        )
        .route(
            "/api/cms/posts/{id}/review",
            post(cms::review_post),
        )
        .route(
            "/api/cms/posts/{id}/medical-review",
            post(cms::medical_review_post),
        )
        .route(
            "/api/cms/posts/{id}/publish",
            post(cms::publish_post),
        )
        .route(
            "/api/cms/posts/{id}/schedule",
            post(cms::schedule_post),
        )
        .route(
            "/api/cms/posts/{id}/archive",
            post(cms::archive_post),
        )
        .route(
            "/api/cms/posts/{id}/unarchive",
            post(cms::unarchive_post),
        )
        // Post Revisions
        .route(
            "/api/cms/posts/{post_id}/revisions",
            get(cms::list_post_revisions),
        )
        .route(
            "/api/cms/posts/{post_id}/revisions/{revision_number}",
            get(cms::get_post_revision),
        )
        .route(
            "/api/cms/posts/{post_id}/revisions/{revision_number}/restore",
            post(cms::restore_post_revision),
        )
        // Post Analytics
        .route(
            "/api/cms/posts/{id}/analytics",
            get(cms::get_post_analytics),
        )
        .route(
            "/api/cms/analytics/top-posts",
            get(cms::list_top_posts),
        )
        // Subscribers
        .route(
            "/api/cms/subscribers",
            get(cms::list_subscribers),
        )
        .route(
            "/api/cms/subscribers/{id}",
            get(cms::get_subscriber).delete(cms::delete_subscriber),
        )
        .route(
            "/api/cms/subscribers/export",
            get(cms::export_subscribers),
        )
        // Pages
        .route(
            "/api/cms/pages",
            get(cms::list_pages).post(cms::create_page),
        )
        .route(
            "/api/cms/pages/{id}",
            get(cms::get_page)
                .put(cms::update_page)
                .delete(cms::delete_page),
        )
        // Settings
        .route(
            "/api/cms/settings",
            get(cms::get_settings).put(cms::update_settings),
        )
        // Menus
        .route(
            "/api/cms/menus",
            get(cms::list_menus),
        )
        .route(
            "/api/cms/menus/{location}",
            get(cms::get_menu).put(cms::update_menu),
        )
        // ── TV Displays & Queue ──────────────────────────────────
        .route(
            "/api/tv/displays",
            get(tv::list_displays).post(tv::create_display),
        )
        .route(
            "/api/tv/displays/{id}",
            get(tv::get_display)
                .put(tv::update_display)
                .delete(tv::delete_display),
        )
        .route(
            "/api/tv/tokens",
            get(tv::list_tokens).post(tv::create_token),
        )
        .route(
            "/api/tv/tokens/{id}/call",
            post(tv::call_token),
        )
        .route(
            "/api/tv/tokens/{id}/complete",
            post(tv::complete_token),
        )
        .route(
            "/api/tv/tokens/{id}/no-show",
            post(tv::no_show_token),
        )
        .route(
            "/api/tv/queue/{department_id}",
            get(tv::get_queue_state),
        )
        .route(
            "/api/tv/announcements",
            post(tv::broadcast_announcement),
        )
        // Specialty queue displays
        .route(
            "/api/tv/queue/pharmacy",
            get(tv::get_pharmacy_queue),
        )
        .route(
            "/api/tv/queue/lab",
            get(tv::get_lab_queue),
        )
        .route(
            "/api/tv/queue/radiology/{modality}",
            get(tv::get_radiology_queue),
        )
        .route(
            "/api/tv/queue/er",
            get(tv::get_er_queue),
        )
        .route(
            "/api/tv/queue/billing",
            get(tv::get_billing_queue),
        )
        .route(
            "/api/tv/queue/beds/{ward_type}",
            get(tv::get_bed_availability),
        )
        .route(
            "/api/tv/queue/analytics/{department_id}",
            get(tv::get_queue_analytics),
        )
        .route(
            "/api/tv/queue/metrics/{department_id}",
            get(tv::get_queue_metrics),
        )
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
        .route("/api/break-glass", post(it_security::start_break_glass).get(it_security::list_break_glass))
        .route("/api/break-glass/{id}", get(it_security::get_break_glass))
        .route("/api/break-glass/{id}/end", post(it_security::end_break_glass))
        .route("/api/break-glass/{id}/review", post(it_security::review_break_glass))
        // ── IT Security: Clinical Access Monitor ─────────────────────
        .route("/api/sensitive-patients", get(it_security::list_sensitive_patients).post(it_security::create_sensitive_patient))
        .route("/api/sensitive-patients/{id}", delete(it_security::delete_sensitive_patient))
        .route("/api/access-alerts", get(it_security::list_access_alerts))
        .route("/api/access-alerts/{id}/acknowledge", post(it_security::acknowledge_access_alert))
        // ── IT Security: Stock Disposal ──────────────────────────────
        .route("/api/disposals", get(it_security::list_disposals).post(it_security::create_disposal))
        .route("/api/disposals/{id}", get(it_security::get_disposal))
        .route("/api/disposals/{id}/items", get(it_security::get_disposal_items))
        .route("/api/disposals/{id}/approve", post(it_security::approve_disposal))
        .route("/api/disposals/{id}/execute", post(it_security::execute_disposal))
        // ── IT Security: TAT Tracking ────────────────────────────────
        .route("/api/tat/benchmarks", get(it_security::list_tat_benchmarks).post(it_security::create_tat_benchmark))
        .route("/api/tat/records", get(it_security::list_tat_records).post(it_security::start_tat_record))
        .route("/api/tat/records/{id}/complete", post(it_security::complete_tat_record))
        .route("/api/tat/dashboard", get(it_security::tat_dashboard))
        // ── IT Security: Data Migration ──────────────────────────────
        .route("/api/migrations", get(it_security::list_migrations).post(it_security::create_migration))
        .route("/api/migrations/{id}", get(it_security::get_migration))
        .route("/api/migrations/{id}/cancel", post(it_security::cancel_migration))
        // ── IT Security: EOD Digest ──────────────────────────────────
        .route("/api/digest/subscription", get(it_security::get_my_digest_subscription).post(it_security::upsert_digest_subscription))
        .route("/api/digest/history", get(it_security::list_digest_history))
        // ── IT Security: Data Quality ────────────────────────────────
        .route("/api/data-quality/rules", get(it_security::list_dq_rules).post(it_security::create_dq_rule))
        .route("/api/data-quality/issues", get(it_security::list_dq_issues))
        .route("/api/data-quality/issues/{id}/resolve", post(it_security::resolve_dq_issue))
        .route("/api/data-quality/dashboard", get(it_security::dq_dashboard))
        // ── IT Security: CERT-In Compliance ──────────────────────────
        .route("/api/security-incidents", get(it_security::list_security_incidents).post(it_security::create_security_incident))
        .route("/api/security-incidents/{id}", get(it_security::get_security_incident).patch(it_security::update_security_incident))
        .route("/api/security-incidents/{id}/cert-in", post(it_security::report_to_cert_in))
        .route("/api/security-incidents/{id}/updates", get(it_security::get_incident_updates).post(it_security::add_incident_update))
        .route("/api/vulnerabilities", get(it_security::list_vulnerabilities).post(it_security::create_vulnerability))
        .route("/api/vulnerabilities/{id}", patch(it_security::update_vulnerability))
        .route("/api/compliance-requirements", get(it_security::list_compliance_requirements))
        .route("/api/compliance-requirements/{id}", patch(it_security::update_compliance_requirement))
        // ── IT Security: System Health & Monitoring ──────────────────
        .route("/api/system-health", get(it_security::system_health_dashboard))
        .route("/api/backups", get(it_security::list_backups))
        // ── IT Security: Onboarding Wizard ───────────────────────────
        .route("/api/it-onboarding/progress", get(it_security::get_onboarding_progress).post(it_security::update_onboarding_progress))
        .route("/api/it-onboarding/complete-step", post(it_security::complete_onboarding_step))
        .route("/api/it-onboarding/complete", post(it_security::complete_onboarding))
        // ── IT Security: Incentive Configuration ─────────────────────
        .route("/api/incentive-plans", get(it_security::list_incentive_plans).post(it_security::create_incentive_plan))
        .route("/api/incentive-plans/{id}/rules", get(it_security::get_incentive_plan_rules).post(it_security::add_incentive_rule))
        .route("/api/incentive-assignments", get(it_security::list_doctor_incentive_assignments).post(it_security::assign_incentive_plan))
        .route("/api/incentive-calculations", get(it_security::list_incentive_calculations).post(it_security::calculate_incentive))
        .route("/api/incentive-calculations/{id}/approve", post(it_security::approve_incentive))
        .route("/api/incentive-calculations/{id}/paid", post(it_security::mark_incentive_paid))
        // ── Device Integration ───────────────────────────────────────
        // Adapter catalog (global knowledge base)
        .route("/api/devices/manufacturers", get(devices::list_manufacturers))
        .route("/api/devices/catalog", get(devices::list_adapter_catalog))
        .route("/api/devices/catalog/{adapter_code}", get(devices::get_adapter))
        .route("/api/devices/catalog/{adapter_code}/preview-config", get(devices::preview_config))
        // Device instances (per-tenant CRUD)
        .route("/api/devices/instances", get(devices::list_device_instances).post(devices::create_device_instance))
        .route("/api/devices/instances/{id}", get(devices::get_device_instance).put(devices::update_device_instance).delete(devices::decommission_device))
        .route("/api/devices/instances/{id}/test", post(devices::test_device_connection))
        .route("/api/devices/instances/{id}/regenerate-config", post(devices::regenerate_config))
        .route("/api/devices/instances/{id}/messages", get(devices::list_device_messages))
        .route("/api/devices/instances/{id}/config-history", get(devices::list_config_history))
        // Routing rules
        .route("/api/devices/routing-rules", get(devices::list_routing_rules).post(devices::create_routing_rule))
        .route("/api/devices/routing-rules/{id}", put(devices::update_routing_rule).delete(devices::delete_routing_rule))
        // Bridge agents
        .route("/api/devices/agents", get(devices::list_bridge_agents))
        // Device data ingest (bridge agent calls)
        .route("/api/device-ingest/{module}", post(devices::ingest_device_data))
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
    let bridge_routes = Router::new()
        .route("/api/bridge/register", post(devices::register_bridge_agent))
        .route("/api/bridge/heartbeat", post(devices::bridge_heartbeat));

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

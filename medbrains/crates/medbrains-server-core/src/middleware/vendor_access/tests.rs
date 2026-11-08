//! The pure halves of MedBrains access: what a scope opens, what a masked
//! session sees, which addresses are vendor addresses, and how refusals are
//! counted.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use super::{
    CONFIG_SCOPE, domains_from, is_config_edit, is_valid_scope, mask_value, permissions_for_scope,
    refusal_due,
};
use medbrains_core::access::catalogue::{all_codes, module_of};
use serde_json::{Value, json};
use uuid::Uuid;

fn scope(entries: &[&str]) -> Vec<String> {
    entries.iter().map(|e| (*e).to_owned()).collect()
}

/// Every module at once, plus configuration only: the widest grant possible.
fn widest() -> Vec<String> {
    let mut modules: Vec<String> = all_codes()
        .iter()
        .map(|c| module_of(c).to_owned())
        .collect();
    modules.sort();
    modules.dedup();
    modules.push(CONFIG_SCOPE.to_owned());
    permissions_for_scope(&modules)
}

/// Asserts none of `codes` is carried by the widest possible grant.
fn never_granted(codes: &[&str]) {
    let all = widest();
    for code in codes {
        assert!(all_codes().contains(code), "{code} is not a real code");
        assert!(!all.iter().any(|c| c == code), "{code} was granted");
    }
}

/// The rule itself: everything a grant carries is a read, or one of the
/// named configuration edits — nothing else, however wide the scope.
#[test]
fn every_carried_code_is_a_read_or_a_named_config_edit() {
    for code in widest() {
        let action = code.rsplit('.').next().unwrap_or_default();
        assert!(
            ["list", "view", "read", "search", "view_own"].contains(&action)
                || is_config_edit(&code),
            "{code} is carried but is neither a read nor a named edit"
        );
    }
}

/// Credentials outlive the session that made them.
#[test]
fn no_grant_makes_a_credential() {
    never_granted(&[
        "admin.api_keys.create",
        "admin.signature_credentials.issue",
        "admin.tv_displays.tokens",
        "admin.tv_displays.create",
        "devices.pairing.token.create",
        "devices.machines.approve",
        "admin.connected_apps.manage",
        "admin.users.create",
        "admin.roles.update",
        "vpn.enroll",
    ]);
}

/// An outbound channel keeps sending after the grant ends.
#[test]
fn no_grant_opens_an_outbound_channel() {
    never_granted(&[
        "admin.webhooks.manage",
        "integration.create",
        "integration.update",
        "integration.execute",
        "communications.messages.create",
        "communications.config.manage",
        "marketing.outreach.send",
        "marketing.outreach.dispatch",
        "marketing.campaigns.manage",
    ]);
}

/// Something the system runs later acts after the grant ends.
#[test]
fn no_grant_sets_up_a_scheduled_or_system_action() {
    never_granted(&[
        "automation.manage",
        "automation.activate",
        "automation.run",
        "flows.publish",
        "flows.build",
        "integration.pipelines.toggle",
        "admin.outbox.retry",
        "admin.system_state.manage",
        "admin.db_topology.manage",
        "storage.restore",
        "storage.sweep.trigger",
        "audit.processors.manage",
        "admin.backup.manage",
        "audit.break_glass.start",
        "security.vendor_access.grant",
    ]);
}

/// Reads that expose secrets or payloads stay closed even though they read.
#[test]
fn no_grant_reads_keys_endpoints_or_raw_payloads() {
    never_granted(&[
        "admin.api_keys.list",
        "admin.webhooks.list",
        "admin.connected_apps.view",
        "admin.outbox.view",
        "admin.users.list",
    ]);
}

/// A module scope only reads, and only that module.
#[test]
fn a_module_scope_reads_only_that_module() {
    let codes = permissions_for_scope(&scope(&["lab"]));
    assert!(!codes.is_empty());
    assert!(codes.iter().all(|c| c.starts_with("lab.")), "{codes:?}");
    assert!(
        !codes
            .iter()
            .any(|c| c.ends_with(".create") || c.ends_with(".manage"))
    );
}

/// Configuration only is admin reads plus the master-data edits.
#[test]
fn configuration_only_is_admin_reads_and_master_data() {
    let codes = permissions_for_scope(&scope(&[CONFIG_SCOPE]));
    assert!(
        codes
            .iter()
            .any(|c| c == "admin.settings.departments.update")
    );
    assert!(codes.iter().all(|c| c.starts_with("admin.")));
    assert!(!codes.iter().any(|c| c == "admin.settings.general.manage"));
    for edit in codes.iter().filter(|c| is_config_edit(c)) {
        assert!(
            all_codes().contains(&edit.as_str()),
            "{edit} does not exist"
        );
    }
}

/// A scope entry that opens nothing is refused.
#[test]
fn an_unknown_scope_entry_is_refused() {
    assert!(is_valid_scope(&scope(&["opd", CONFIG_SCOPE])));
    assert!(!is_valid_scope(&scope(&["opd", "opdd"])));
    assert!(!is_valid_scope(&scope(&["vpn"])));
    assert!(!is_valid_scope(&[]));
}

/// Serialises `value` after masking, for "is this string anywhere" checks.
fn masked(mut value: Value) -> String {
    mask_value(&mut value).expect("mask");
    value.to_string()
}

/// Keeps ids, statuses, timestamps, counts and flags; masks everything else,
/// whatever it is called.
#[test]
fn a_masked_answer_keeps_only_safe_shapes() {
    let id = "6f1c0a52-0000-4000-8000-000000000001";
    let mut answer = json!({
        "data": [{
            "id": id, "patient_id": id, "uhid": "MB-00042", "abha_id": "12-3456",
            "first_name": "Lakshmi", "name": "Lakshmi Raman", "displayName": "Lakshmi R",
            "patient_label": "Lakshmi Raman (MB-00042)", "label": "Bed 4 - Lakshmi",
            "status": "active", "created_at": "2026-11-08T10:00:00Z", "is_active": true,
            "notes": "Husband Ravi called", "age_years": 41, "event_count": 3,
            "department_name": "Cardiology", "visit_type": "Lakshmi",
        }],
        "meta": { "total": 1, "page": 1, "limit": 50 }
    });
    mask_value(&mut answer).expect("mask");
    let row = &answer["data"][0];
    for key in [
        "uhid",
        "abha_id",
        "first_name",
        "name",
        "displayName",
        "patient_label",
        "label",
        "notes",
        "age_years",
        "department_name",
        "visit_type",
    ] {
        assert_eq!(row[key], "[MASKED]", "{key}");
    }
    assert_eq!(row["id"], id);
    assert_eq!(row["patient_id"], id);
    assert_eq!(row["status"], "active");
    assert_eq!(row["created_at"], "2026-11-08T10:00:00Z");
    assert_eq!(row["is_active"], true);
    assert_eq!(row["event_count"], 3);
    assert_eq!(answer["meta"]["total"], 1);
}

/// The immunisation due list (`patients/immunization_schedule.rs`): child's
/// name, phone, UHID and date of birth.
#[test]
fn the_immunisation_due_list_is_masked() {
    let out = masked(
        json!([{ "patient_id": Uuid::nil(), "name": "Baby Kavya Suresh",
        "uhid": "MB-77", "phone": "9876500001", "date_of_birth": "2025-02-01",
        "vaccine": "Pentavalent", "dose_label": "Dose 2", "due_on": "2026-11-10",
        "state": "overdue" }]),
    );
    for leak in ["Kavya", "9876500001", "MB-77", "2025-02-01", "Pentavalent"] {
        assert!(!out.contains(leak), "{leak} leaked: {out}");
    }
    assert!(out.contains("overdue") && out.contains("2026-11-10"));
}

/// The early-warning context (`nursing/nurse_ews.rs`): a `patient_label`
/// built from the name and UHID, an age in months, the obstetric flag.
#[test]
fn the_ews_context_is_masked() {
    let out = masked(json!({ "encounter_id": Uuid::nil(), "age_months": 410,
        "obstetric": true, "patient_label": "Meena Pillai (MB-00881)",
        "admission_id": Uuid::nil(), "tool_override": "news2" }));
    for leak in ["Meena", "MB-00881", "410", "true"] {
        assert!(!out.contains(leak), "{leak} leaked: {out}");
    }
}

/// Form F (`print-data/pcpndt_form_f.rs`): the woman's name, husband or
/// father, address, phone, living children, LMP, referring doctor.
#[test]
fn pcpndt_form_f_is_masked() {
    let out = masked(json!({
        "clinic": { "name": "Sunrise Imaging", "address": "12 MG Road" },
        "woman": { "name": "Anita Devi", "uhid": "MB-5", "age_years": 29,
                   "husband_or_father": "Ramesh Kumar", "address": "4 Lake View",
                   "phone": "9876500002", "living_sons": 1, "living_daughters": 2,
                   "last_menstrual_period": "01 Sep 2026", "weeks_of_pregnancy": 9 },
        "referral": { "self_referred": false, "referred_by": "Dr Suman Rao",
                      "referring_doctor_registration": "KMC-1234" }
    }));
    for leak in [
        "Anita",
        "Ramesh",
        "Lake View",
        "9876500002",
        "Sep 2026",
        "Suman",
        "KMC-1234",
    ] {
        assert!(!out.contains(leak), "{leak} leaked: {out}");
    }
}

/// An error body can name the patient it refused, so it is masked too.
#[test]
fn an_error_body_is_masked() {
    let out = masked(json!({ "error": "bad request",
        "message": "Patient Lakshmi Raman is marked deceased" }));
    assert!(!out.contains("Lakshmi"), "{out}");
    assert!(out.contains("bad request"));
}

/// A restricted clinical record is withheld whole.
#[test]
fn a_restricted_record_is_withheld_whole() {
    let out = masked(json!([{ "icd_code": "B20", "description": "HIV disease" }]));
    assert!(!out.contains("B20") && !out.contains("HIV"), "{out}");
}

/// The host after the last `@`, trimmed, without a trailing dot, and its
/// subdomains: the parse half (the SQL half is `app_email_is_vendor`).
#[test]
fn the_domain_list_is_normalised_and_hosted_adds_the_seed_admin() {
    assert_eq!(
        domains_from(" @MedBrains.in. , ", false),
        vec!["medbrains.in"]
    );
    assert_eq!(domains_from("", false), Vec::<String>::new());
    assert_eq!(
        domains_from("medbrains.in", true),
        vec!["medbrains.in", "medbrains.localhost"]
    );
}

/// One refusal row per account per minute, carrying how many it stood for.
#[test]
fn refusals_are_written_once_a_minute_with_a_count() {
    let mut seen = HashMap::new();
    let key = (Uuid::nil(), Uuid::nil());
    let t0 = Instant::now();
    assert_eq!(refusal_due(&mut seen, key, t0), Some(0));
    assert_eq!(
        refusal_due(&mut seen, key, t0 + Duration::from_secs(1)),
        None
    );
    assert_eq!(
        refusal_due(&mut seen, key, t0 + Duration::from_secs(2)),
        None
    );
    assert_eq!(
        refusal_due(&mut seen, key, t0 + Duration::from_secs(61)),
        Some(2)
    );
}

/// A response with `content_type` and `body`, for the guard tests.
fn answer(status: u16, content_type: &str, body: &'static str) -> axum::response::Response {
    axum::response::Response::builder()
        .status(status)
        .header("content-type", content_type)
        .body(axum::body::Body::from(body))
        .expect("response")
}

/// The body of `response`, as text.
async fn text_of(response: axum::response::Response) -> String {
    let bytes = axum::body::to_bytes(response.into_body(), 1 << 20)
        .await
        .expect("body");
    String::from_utf8_lossy(&bytes).into_owned()
}

/// Files and live streams are refused under every grant, masked or not.
#[tokio::test]
async fn files_and_streams_are_refused_under_any_grant() {
    for masked in [true, false] {
        for kind in ["application/pdf", "text/event-stream", "image/png", "text/csv"] {
            let out = super::mask::guard_response(answer(200, kind, "x"), masked).await;
            assert_eq!(out.status(), 403, "{kind} masked={masked}");
        }
    }
}

/// Unmasked JSON passes untouched; masked JSON and masked error bodies are
/// masked.
#[tokio::test]
async fn json_passes_unmasked_and_is_masked_when_masked_even_on_error() {
    let body = r#"{"name":"Lakshmi Raman","status":"active"}"#;
    let open = super::mask::guard_response(answer(200, "application/json", body), false).await;
    assert_eq!(text_of(open).await, body);
    let shut = super::mask::guard_response(answer(200, "application/json", body), true).await;
    let shut = text_of(shut).await;
    assert!(!shut.contains("Lakshmi") && shut.contains("active"), "{shut}");
    let error = r#"{"error":"conflict","message":"Lakshmi Raman already has a bed"}"#;
    let refused = super::mask::guard_response(answer(409, "application/json", error), true).await;
    assert_eq!(refused.status(), 409);
    assert!(!text_of(refused).await.contains("Lakshmi"));
}

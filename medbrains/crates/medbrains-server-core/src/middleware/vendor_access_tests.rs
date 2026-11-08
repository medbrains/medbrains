//! The pure halves of MedBrains access: what a scope opens, and what a masked
//! session sees.

use super::{CONFIG_SCOPE, is_valid_scope, mask_value, permissions_for_scope};
use serde_json::json;

fn scope(entries: &[&str]) -> Vec<String> {
    entries.iter().map(|e| (*e).to_owned()).collect()
}

/// A module scope opens that module's codes and nothing outside it.
#[test]
fn a_module_scope_opens_only_that_module() {
    let codes = permissions_for_scope(&scope(&["lab"]));
    assert!(!codes.is_empty());
    assert!(codes.iter().all(|c| c.starts_with("lab.")), "{codes:?}");
}

/// No scope, however wide, carries the codes that would let a grant widen or
/// outlive itself: granting access, making accounts or keys, break-glass.
#[test]
fn no_scope_carries_the_codes_that_widen_a_grant() {
    let all = permissions_for_scope(&scope(&["admin", "security", "audit", "devices", "vpn"]));
    for banned in [
        "security.vendor_access.grant",
        "security.vendor_access.approve_unmasked",
        "admin.users.create",
        "admin.roles.update",
        "admin.api_keys.create",
        "audit.break_glass.start",
        "devices.machines.approve",
        "vpn.enroll",
    ] {
        assert!(!all.iter().any(|c| c == banned), "{banned} was granted");
    }
}

/// Configuration only is the admin module, less what touches patient records.
#[test]
fn configuration_only_is_admin_without_patient_payloads() {
    let codes = permissions_for_scope(&scope(&[CONFIG_SCOPE]));
    assert!(codes.iter().any(|c| c.starts_with("admin.settings.")));
    assert!(codes.iter().all(|c| c.starts_with("admin.")));
    assert!(!codes.iter().any(|c| c.starts_with("admin.history_import")));
    assert!(!codes.iter().any(|c| c.starts_with("admin.users.")));
}

/// A scope entry that opens nothing is refused, so a typo is never a grant
/// that silently does nothing — or one later code makes mean something.
#[test]
fn an_unknown_scope_entry_is_refused() {
    assert!(is_valid_scope(&scope(&["opd", CONFIG_SCOPE])));
    assert!(!is_valid_scope(&scope(&["opd", "opdd"])));
    assert!(!is_valid_scope(&scope(&["vpn"])));
    assert!(!is_valid_scope(&[]));
}

/// A masked session sees ids and statuses, never who the patient is.
#[test]
fn a_masked_answer_keeps_ids_and_hides_identity() {
    let mut answer = json!({
        "data": [{
            "id": "6f1c0a52-0000-4000-8000-000000000001",
            "uhid": "MB-00042",
            "first_name": "Lakshmi",
            "last_name": "Raman",
            "phone": "9876543210",
            "date_of_birth": "1980-02-01",
            "status": "active",
            "department_name": "Cardiology",
            "notes": "Husband Ravi called",
            "attenders": [{ "relationship": "spouse", "name": "Ward 3" }],
        }],
        "meta": { "total": 1 }
    });
    let touched = mask_value(&mut answer).expect("mask");
    let row = &answer["data"][0];
    assert!(touched >= 6, "{touched}");
    for key in [
        "uhid",
        "first_name",
        "last_name",
        "phone",
        "date_of_birth",
        "notes",
    ] {
        assert_eq!(row[key], "[MASKED]", "{key}");
    }
    assert_eq!(row["attenders"][0]["relationship"], "[MASKED]");
    assert_eq!(row["id"], "6f1c0a52-0000-4000-8000-000000000001");
    assert_eq!(row["status"], "active");
    assert_eq!(row["department_name"], "Cardiology");
    assert_eq!(answer["meta"]["total"], 1);
}

/// A restricted clinical record (here an HIV code) is withheld whole, not just
/// stripped of its name: its existence is the disclosure.
#[test]
fn a_restricted_record_is_withheld_whole() {
    let mut answer = json!([{ "icd_code": "B20", "description": "HIV disease" }]);
    mask_value(&mut answer).expect("mask");
    assert!(answer[0].is_string(), "{answer}");
}

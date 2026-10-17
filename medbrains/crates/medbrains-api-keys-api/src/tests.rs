use super::{refuse_escalation, service_username};
use medbrains_server_core::middleware::auth::Claims;
use uuid::Uuid;

fn claims(role: &str, permissions: &[&str]) -> Claims {
    Claims {
        sub: Uuid::nil(),
        tenant_id: Uuid::nil(),
        role: role.to_owned(),
        permissions: permissions.iter().map(|p| (*p).to_owned()).collect(),
        department_ids: Vec::new(),
        perm_version: 0,
        paired_device_id: None,
        exp: 0,
    }
}

#[test]
fn a_key_cannot_be_granted_what_its_creator_lacks() {
    let clerk = claims("billing_clerk", &["admin.api_keys.create", "billing.view"]);
    let error = refuse_escalation(&clerk, &["billing.view".into(), "opd.prescribe".into()])
        .expect_err("a clerk minted a key that can prescribe");
    assert!(
        error.to_string().contains("opd.prescribe"),
        "the refusal must name what was missing, or nobody can fix it: {error}",
    );
}

#[test]
fn a_key_may_carry_what_its_creator_holds() {
    let clerk = claims("billing_clerk", &["billing.view", "billing.create"]);
    assert!(refuse_escalation(&clerk, &["billing.view".into()]).is_ok());
}

#[test]
fn bypass_roles_may_grant_without_enumerating() {
    // Their `permissions` is empty by design — the role short-circuits
    // every check — so a naive subset test would refuse them everything.
    let admin = claims("hospital_admin", &[]);
    assert!(refuse_escalation(&admin, &["opd.prescribe".into()]).is_ok());
}

#[test]
fn service_usernames_satisfy_the_username_constraint() {
    let id = Uuid::from_u128(0x1234_5678_9abc_def0_1234_5678_9abc_def0);
    for name in [
        "Lab Integration",
        "  Billing  Sync  ",
        "X-Ray/PACS bridge",
        "日本語",
        "!!!",
    ] {
        let username = service_username(name, id);
        assert!(
            username
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'),
            "`{username}` (from `{name}`) breaks chk_users_username_pattern",
        );
        assert!(
            username.starts_with("svc_"),
            "{username} is not marked as a service account"
        );
    }
}

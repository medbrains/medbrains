//! Who may change an account's Kanidm link, and telling the account's holder when it changes.

use std::collections::HashSet;

use medbrains_kernel::{Claims, Tx, authz::BYPASS_ROLES};
use medbrains_notifications::{NewNotification, create_notification};
use medbrains_server_core::{error::AppError, permissions::resolve_permissions, state::AppState};
use uuid::Uuid;

/// The account a link change is aimed at, as read and locked in the change's own transaction.
pub(super) struct Target {
    pub(super) email: Option<String>,
    /// The provider and subject it is linked to now, if any.
    pub(super) idp_id: Option<Uuid>,
    pub(super) subject: Option<String>,
    /// An administrator's account (a bypass role, or any `admin.*` power): it links only to a Kanidm person in
    /// the high-privilege group, whoever makes the link.
    pub(super) needs_high_privilege: bool,
}

/// What the target account reaches beyond its permission codes that the caller does not: each is a way in the
/// codes alone do not show.
#[derive(Debug, Default, Clone, Copy)]
pub(super) struct ExtraScope {
    /// An access group the caller is not in.
    groups: bool,
    /// A department the caller is not scoped to, or no department limit when the caller has one.
    departments: bool,
    /// A care-team or other relationship (an active `relation_tuples` row) the caller does not hold.
    relations: bool,
    /// An open break-glass session.
    break_glass: bool,
}

/// Why a non-administrator may not change the link of this account, or `None` when they may. Whoever controls
/// the Kanidm person controls the account, so a link must never hand the caller more than they already hold:
/// not an administrator's account, not one that signs clinical records, no `admin.*` power, no code, group,
/// department or relationship the caller lacks, and not an account inside break-glass.
fn link_refusal(
    caller_permissions: &[String],
    target_role: &str,
    target_permissions: &[String],
    scope: ExtraScope,
) -> Option<&'static str> {
    let held: HashSet<&str> = caller_permissions.iter().map(String::as_str).collect();
    if BYPASS_ROLES.contains(&target_role) {
        Some("Only an administrator may link an administrator's account.")
    } else if target_permissions.iter().any(|code| is_signing(code)) {
        Some("Only an administrator may link an account that signs clinical records.")
    } else if !target_permissions
        .iter()
        .all(|code| !is_admin_power(code) && held.contains(code.as_str()))
    {
        Some("This account holds permissions you do not. Ask an administrator to link it.")
    } else {
        scope_refusal(scope)
    }
}

/// The refusal for scope the target holds and the caller does not, if any.
const fn scope_refusal(scope: ExtraScope) -> Option<&'static str> {
    if scope.break_glass {
        Some("This account is in an open break-glass session. Ask an administrator to link it.")
    } else if scope.groups || scope.departments || scope.relations {
        Some(
            "This account reaches access groups, departments or care teams you do not. Ask an \
             administrator to link it.",
        )
    } else {
        None
    }
}

/// True for an `admin.*` code that changes something. Read-only ones (`.read`, `.list`, `.view`) are not
/// powers: every clinical role holds `admin.settings.read`, so counting them would leave IT unable to link
/// any member of staff, and the subset rule already keeps them to codes the caller holds.
fn is_admin_power(code: &str) -> bool {
    code.starts_with("admin.")
        && ![".read", ".list", ".view"]
            .iter()
            .any(|read| code.ends_with(read))
}

/// True for a code that puts the holder's signature on a record: `sign`, `cosign`, `co_sign` and the like as
/// its action. Taking over such an account forges a clinician's signature.
fn is_signing(code: &str) -> bool {
    let action = code.rsplit('.').next().unwrap_or(code);
    matches!(action, "sign" | "cosign" | "countersign") || action.ends_with("_sign")
}

/// Whether a link to `requested` must be written, given the account's link now. Re-pointing a linked account
/// is refused: an administrator removes the link first, so a takeover is never one quiet step.
pub(super) fn needs_link_write(
    current: Option<(Option<Uuid>, &str)>,
    requested: (Uuid, &str),
) -> Result<bool, AppError> {
    match current {
        None => Ok(true),
        Some((provider, subject)) if provider == Some(requested.0) && subject == requested.1 => {
            Ok(false)
        }
        Some(_) => Err(AppError::Conflict(
            "This account is already linked to another sign-in person. Remove that link first."
                .to_owned(),
        )),
    }
}

/// What `target` reaches that `caller` does not, in one round trip: access groups, departments, active
/// relationships (care teams, attending, ward) and an open break-glass. A department answer that is missing
/// counts as more, so a fault refuses.
async fn extra_scope(tx: &mut Tx, caller: Uuid, target: Uuid) -> Result<ExtraScope, AppError> {
    let row = sqlx::query_as::<_, (bool, Option<bool>, bool, bool)>(EXTRA_SCOPE_SQL)
        .bind(caller)
        .bind(target)
        .fetch_one(&mut **tx)
        .await?;
    Ok(ExtraScope {
        groups: row.0,
        departments: row.1.unwrap_or(true),
        relations: row.2,
        break_glass: row.3,
    })
}

/// `$1` the caller, `$2` the target. An empty `department_ids` means "every department".
const EXTRA_SCOPE_SQL: &str = "SELECT \
    EXISTS (SELECT 1 FROM access_group_members t \
            JOIN access_groups g ON g.id = t.group_id AND g.is_active AND g.deleted_at IS NULL \
            WHERE t.user_id = $2 AND t.deleted_at IS NULL AND (t.expires_at IS NULL OR t.expires_at > now()) \
              AND NOT EXISTS (SELECT 1 FROM access_group_members c WHERE c.user_id = $1 \
                  AND c.group_id = t.group_id AND c.deleted_at IS NULL \
                  AND (c.expires_at IS NULL OR c.expires_at > now()))), \
    (SELECT cardinality(c.department_ids) > 0 \
            AND (cardinality(t.department_ids) = 0 OR NOT t.department_ids <@ c.department_ids) \
       FROM users c, users t WHERE c.id = $1 AND t.id = $2), \
    EXISTS (SELECT 1 FROM relation_tuples t WHERE t.subject_type = 'user' AND t.subject_id = $2::text \
              AND t.status = 'active' AND t.deleted_at IS NULL AND (t.expires_at IS NULL OR t.expires_at > now()) \
              AND NOT EXISTS (SELECT 1 FROM relation_tuples c WHERE c.subject_type = 'user' \
                  AND c.subject_id = $1::text AND c.status = 'active' AND c.deleted_at IS NULL \
                  AND (c.expires_at IS NULL OR c.expires_at > now()) AND c.object_type = t.object_type \
                  AND c.object_id = t.object_id AND c.relation = t.relation)), \
    EXISTS (SELECT 1 FROM break_glass_events b WHERE b.user_id = $2 AND b.is_active \
              AND b.expires_at > now())";

/// Reads and locks the target account, and refuses the change unless the caller is an administrator or
/// [`link_refusal`] finds nothing.
pub(super) async fn guard_target(
    state: &AppState,
    tx: &mut Tx,
    claims: &Claims,
    user_id: Uuid,
) -> Result<Target, AppError> {
    let (role, email, idp_id, subject) = sqlx::query_as::<
        _,
        (String, Option<String>, Option<Uuid>, Option<String>),
    >(
        "SELECT role::text, email, idp_id, external_subject FROM users WHERE id = $1 FOR UPDATE",
    )
    .bind(user_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let is_bypass = BYPASS_ROLES.contains(&role.as_str());
    let target_permissions = if is_bypass {
        Vec::new()
    } else {
        resolve_permissions(&state.db, claims.tenant_id, user_id, &role).await?
    };
    if !is_admin(claims) {
        let scope = extra_scope(tx, claims.sub, user_id).await?;
        if let Some(reason) = link_refusal(&claims.permissions, &role, &target_permissions, scope) {
            return Err(AppError::ForbiddenReason(reason.to_owned()));
        }
    }
    Ok(Target {
        email,
        idp_id,
        subject,
        needs_high_privilege: is_bypass || target_permissions.iter().any(|c| is_admin_power(c)),
    })
}

/// True for a caller with a bypass role: an administrator.
pub(super) fn is_admin(claims: &Claims) -> bool {
    BYPASS_ROLES.contains(&claims.role.as_str())
}

/// The in-app notice the account's holder gets when its link is made (`linked`) or removed.
pub(super) const fn holder_notice(user_id: Uuid, linked: bool) -> NewNotification<'static> {
    let (title, body) = if linked {
        (
            "Your account was linked to a sign-in",
            "Your MedBrains account can now be signed in to through the hospital's sign-in service. \
             If you did not expect this, tell IT at once.",
        )
    } else {
        (
            "Your account's sign-in link was removed",
            "Your MedBrains account can no longer be signed in to through the hospital's sign-in \
             service. If you did not expect this, tell IT at once.",
        )
    };
    NewNotification {
        user_id,
        kind: "warning",
        title,
        body: Some(body),
        category: Some("Security"),
        entity_type: Some("user"),
        entity_id: Some(user_id),
        action_url: None,
    }
}

/// Tells the account's holder of a link change: in the app, and by email when the account has an address (the
/// outbox sends it when email is configured). In the change's own transaction; returns the notice's id for the
/// caller to publish live after commit.
pub(super) async fn notify_holder(
    tx: &mut Tx,
    tenant_id: Uuid,
    user_id: Uuid,
    email: Option<&str>,
    linked: bool,
) -> Result<Uuid, AppError> {
    let notice = holder_notice(user_id, linked);
    let (title, body) = (notice.title, notice.body.unwrap_or_default());
    let id = create_notification(tx, tenant_id, notice).await?;
    if let Some(to) = email.filter(|to| !to.is_empty()) {
        medbrains_outbox::queue::queue_on(
            tx,
            medbrains_outbox::queue::OutboxRow {
                tenant_id,
                aggregate_type: "user",
                aggregate_id: Some(user_id),
                event_type: "email.account_link",
                payload: serde_json::json!({
                    "to": to,
                    "subject": title,
                    "html": format!("<p>{body}</p>"),
                    "text": body,
                }),
                idempotency_key: None,
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("queue link email: {e}")))?;
    }
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::{ExtraScope, holder_notice, is_signing, link_refusal, needs_link_write};
    use uuid::Uuid;

    fn codes(list: &[&str]) -> Vec<String> {
        list.iter().map(|&c| c.to_owned()).collect()
    }

    /// The refusal a non-administrator gets for this target, with no extra scope.
    fn refused(caller: &[String], role: &str, target: &[String]) -> Option<&'static str> {
        link_refusal(caller, role, target, ExtraScope::default())
    }

    /// A non-administrator may link only an account that holds nothing they do not, and no `admin.*` at all.
    #[test]
    fn a_link_never_hands_the_caller_more_than_they_hold() {
        let it_officer = codes(&[
            "admin.users.link_identity",
            "opd.visit.view",
            "lab.result.view",
        ]);
        let nurse = codes(&["opd.visit.view"]);
        assert_eq!(refused(&it_officer, "nurse", &nurse), None);
        assert!(
            refused(
                &it_officer,
                "doctor",
                &codes(&["opd.visit.view", "pharmacy.dispense"])
            )
            .is_some()
        );
        // Holding the admin code yourself does not make an admin's account linkable.
        assert!(
            refused(
                &it_officer,
                "it_security_officer",
                &codes(&["admin.users.link_identity"])
            )
            .is_some()
        );
        assert!(refused(&it_officer, "hospital_admin", &[]).is_some());
        assert!(refused(&it_officer, "super_admin", &[]).is_some());
        assert_eq!(refused(&it_officer, "receptionist", &[]), None);
        // A read-only admin code every clinical role has is no power; a write one is, even when IT holds it.
        let with_settings = codes(&["opd.visit.view", "admin.settings.read"]);
        let mut it_reader = it_officer.clone();
        it_reader.extend(codes(&["admin.settings.read", "admin.users.create"]));
        assert_eq!(refused(&it_reader, "nurse", &with_settings), None);
        assert!(refused(&it_officer, "nurse", &with_settings).is_some());
        assert!(refused(&it_reader, "nurse", &codes(&["admin.users.create"])).is_some());
    }

    /// An account that signs clinical records is never linked by a non-administrator, even one who signs too.
    #[test]
    fn a_signing_account_needs_an_administrator() {
        let signer = codes(&["opd.visit.view", "clinical_notes.sign"]);
        assert_eq!(
            refused(&signer, "doctor", &signer),
            Some("Only an administrator may link an account that signs clinical records.")
        );
        for code in [
            "doctor.signature.co_sign",
            "clinical_notes.cosign",
            "opd.consents.sign",
        ] {
            assert!(is_signing(code), "{code}");
        }
        for code in [
            "case_mgmt.assignments.create",
            "doctor.signature.verify",
            "consent.signatures.list",
        ] {
            assert!(!is_signing(code), "{code}");
        }
    }

    /// Codes are not the whole of an account: a group, department, relationship or break-glass it holds and
    /// the caller does not refuses the link.
    #[test]
    fn scope_beyond_the_callers_refuses_the_link() {
        let it = codes(&["admin.users.link_identity", "opd.visit.view"]);
        let nurse = codes(&["opd.visit.view"]);
        let each = [
            ExtraScope {
                groups: true,
                ..ExtraScope::default()
            },
            ExtraScope {
                departments: true,
                ..ExtraScope::default()
            },
            ExtraScope {
                relations: true,
                ..ExtraScope::default()
            },
            ExtraScope {
                break_glass: true,
                ..ExtraScope::default()
            },
        ];
        for scope in each {
            assert!(
                link_refusal(&it, "nurse", &nurse, scope).is_some(),
                "{scope:?}"
            );
        }
        assert_eq!(
            link_refusal(&it, "nurse", &nurse, ExtraScope::default()),
            None
        );
    }

    /// Linking the same person again changes nothing; linking a linked account to anyone else is refused.
    #[test]
    fn a_linked_account_is_never_re_pointed() {
        let kanidm = Uuid::from_u128(1);
        let azure = Uuid::from_u128(2);
        let alice = "11111111-1111-1111-1111-111111111111";
        let mallory = "22222222-2222-2222-2222-222222222222";
        assert!(needs_link_write(None, (kanidm, alice)).is_ok_and(|write| write));
        assert!(
            needs_link_write(Some((Some(kanidm), alice)), (kanidm, alice))
                .is_ok_and(|write| !write)
        );
        assert!(needs_link_write(Some((Some(kanidm), alice)), (kanidm, mallory)).is_err());
        assert!(needs_link_write(Some((Some(azure), alice)), (kanidm, alice)).is_err());
    }

    /// The holder is told which change happened, as a security notice about their own account.
    #[test]
    fn the_holder_is_told_of_a_link_and_of_its_removal() {
        let user = Uuid::from_u128(3);
        let made = holder_notice(user, true);
        let removed = holder_notice(user, false);
        assert_eq!((made.user_id, made.entity_id), (user, Some(user)));
        assert!(made.title.contains("linked"));
        assert!(removed.title.contains("removed"));
        assert_eq!(made.category, Some("Security"));
    }
}

//! The account a Kanidm link change is aimed at, and telling the account's holder when it changes.

use medbrains_kernel::{Claims, Tx, authz::BYPASS_ROLES};
use medbrains_notifications::{NewNotification, create_notification};
use medbrains_server_core::{
    error::AppError, os_identity::needs_high_privilege, permissions::resolve_permissions,
    state::AppState,
};
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

/// Reads and locks the target account, and whether it is an administrator's (see [`Target`]). The caller is
/// an administrator already ([`crate::require_identity_admin`]).
pub(super) async fn read_target(
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
    let target_permissions = if BYPASS_ROLES.contains(&role.as_str()) {
        Vec::new()
    } else {
        resolve_permissions(&state.db, claims.tenant_id, user_id, &role).await?
    };
    Ok(Target {
        email,
        idp_id,
        subject,
        needs_high_privilege: needs_high_privilege(&role, &target_permissions),
    })
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
    use super::{holder_notice, needs_link_write};
    use uuid::Uuid;

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

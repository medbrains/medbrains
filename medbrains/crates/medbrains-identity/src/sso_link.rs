//! Linking a MedBrains account to a person in the OS's own Kanidm, by hand. Kanidm's email is never trusted to
//! link (anyone who may make a person can give it any address), so an existing member of staff who signs in
//! through Kanidm is linked here by an administrator, who picks the Kanidm person by name and UUID. The UUID is
//! the `sub` MedBrains receives, so it is what is stored.

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use medbrains_core::permissions::admin::users::LINK_IDENTITY;
use medbrains_kernel::{Actor, Claims, Tx, require_permission};
use medbrains_notifications::publish_notification;
use medbrains_server_core::{
    error::AppError,
    os_identity::{KANIDM_CODE, SETUP_ADMIN_SQL},
    state::AppState,
};

mod directory;
mod target;

use directory::{read_directory, require_high_privilege_person};
use target::{guard_target, holder_notice, is_admin, needs_link_write, notify_holder};

/// At most this many people come back from a search: enough to find one, never a whole directory dump.
const MAX_PEOPLE: usize = 50;
/// The longest search text taken.
const MAX_QUERY_CHARS: usize = 64;

/// A Kanidm person, as the link picker shows them.
#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct KanidmPerson {
    pub uuid: String,
    pub name: String,
    pub display_name: Option<String>,
    pub mail: Option<String>,
    /// The MedBrains account this person is already linked to, if any.
    pub linked_username: Option<String>,
}

/// A MedBrains account's link to Kanidm, if it has one.
#[derive(Debug, Serialize)]
pub struct SsoLink {
    pub provider_id: Uuid,
    pub subject: String,
}

#[derive(Debug, Deserialize)]
pub struct PeopleQuery {
    pub q: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LinkRequest {
    /// The Kanidm person's UUID.
    pub subject: String,
}

/// The id of this hospital's Kanidm provider. Only the id: where Kanidm is reached is pinned by the server
/// (`os_identity`), never read from the row. `NotFound` when Kanidm is not set up.
async fn kanidm_provider(tx: &mut Tx) -> Result<Uuid, AppError> {
    sqlx::query_scalar::<_, Uuid>("SELECT id FROM identity_providers WHERE code = $1 LIMIT 1")
        .bind(KANIDM_CODE)
        .fetch_optional(&mut **tx)
        .await?
        .ok_or(AppError::NotFound)
}

/// True for a Kanidm UUID: what a subject must look like before it is stored.
fn is_subject(value: &str) -> bool {
    Uuid::parse_str(value).is_ok_and(|uuid| uuid.hyphenated().to_string() == value)
}

/// The people in Kanidm's answer whose name, display name or mail holds `query`, at most `MAX_PEOPLE`.
fn matching_people(answer: &serde_json::Value, query: &str) -> Vec<KanidmPerson> {
    let query = query.to_lowercase();
    let first = |attrs: &serde_json::Value, key: &str| {
        attrs
            .get(key)
            .and_then(|v| v.get(0))
            .and_then(|v| v.as_str())
            .map(str::to_owned)
    };
    answer
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|entry| {
            let attrs = entry.get("attrs")?;
            Some(KanidmPerson {
                uuid: first(attrs, "uuid")?,
                name: first(attrs, "name")?,
                display_name: first(attrs, "displayname"),
                mail: first(attrs, "mail"),
                linked_username: None,
            })
        })
        .filter(|p| {
            query.is_empty()
                || [Some(&p.name), p.display_name.as_ref(), p.mail.as_ref()]
                    .into_iter()
                    .flatten()
                    .any(|field| field.to_lowercase().contains(&query))
        })
        .take(MAX_PEOPLE)
        .collect()
}

/// GET /api/admin/identity/kanidm/people?q= — Kanidm people to link to, with any account each is linked to.
pub async fn list_kanidm_people(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Query(query): Query<PeopleQuery>,
) -> Result<Json<Vec<KanidmPerson>>, AppError> {
    require_permission(&claims, LINK_IDENTITY)?;
    let text: String = query
        .q
        .unwrap_or_default()
        .chars()
        .take(MAX_QUERY_CHARS)
        .collect();
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let provider_id = kanidm_provider(&mut tx).await?;
    let answer = read_directory("/v1/person").await?;
    let mut people = matching_people(&answer, &text);
    let uuids: Vec<String> = people.iter().map(|p| p.uuid.clone()).collect();
    let linked = sqlx::query_as::<_, (String, String)>(
        "SELECT external_subject, username FROM users WHERE idp_id = $1 AND external_subject = ANY($2)",
    )
    .bind(provider_id)
    .bind(&uuids)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;
    for person in &mut people {
        person.linked_username = linked
            .iter()
            .find(|(s, _)| *s == person.uuid)
            .map(|(_, u)| u.clone());
    }
    Ok(Json(people))
}

/// GET /api/admin/users/{id}/sso-link — the account's link to Kanidm, or null.
pub async fn get_link(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<Option<SsoLink>>, AppError> {
    require_permission(&claims, LINK_IDENTITY)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let link = sqlx::query_as::<_, (Option<Uuid>, Option<String>)>(
        "SELECT idp_id, external_subject FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;
    Ok(Json(match link {
        (Some(provider_id), Some(subject)) => Some(SsoLink {
            provider_id,
            subject,
        }),
        _ => None,
    }))
}

/// Writes one audit row for a link change, in the change's own transaction.
async fn audit_link(
    tx: &mut Tx,
    claims: &Claims,
    user_id: Uuid,
    action: &str,
    details: &serde_json::Value,
) -> Result<(), AppError> {
    medbrains_kernel::audit(
        tx,
        &medbrains_kernel::audit::AuditEntry {
            tenant_id: claims.tenant_id,
            user_id: Some(claims.sub),
            action,
            entity_type: "user",
            entity_id: Some(user_id),
            old_values: None,
            new_values: Some(details),
            ip_address: None,
        },
    )
    .await?;
    Ok(())
}

/// PUT /api/admin/users/{id}/sso-link — links the account to this Kanidm person. Audited.
pub async fn set_link(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Json(req): Json<LinkRequest>,
) -> Result<Json<SsoLink>, AppError> {
    require_permission(&claims, LINK_IDENTITY)?;
    if !is_subject(&req.subject) {
        return Err(AppError::BadRequest(
            "That is not a Kanidm person's ID.".to_owned(),
        ));
    }
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let target = guard_target(&state, &mut tx, &claims, user_id).await?;
    let provider_id = kanidm_provider(&mut tx).await?;
    let current = target.subject.as_deref().map(|s| (target.idp_id, s));
    if !needs_link_write(current, (provider_id, &req.subject))? {
        tx.commit().await?;
        return Ok(Json(SsoLink {
            provider_id,
            subject: req.subject,
        }));
    }
    let taken = sqlx::query_scalar::<_, String>(
        "SELECT username FROM users WHERE idp_id = $1 AND external_subject = $2 AND id <> $3",
    )
    .bind(provider_id)
    .bind(&req.subject)
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;
    if let Some(other) = taken {
        return Err(AppError::Conflict(format!(
            "This Kanidm person is already linked to {other}. Unlink it there first."
        )));
    }
    if target.needs_high_privilege {
        require_high_privilege_person(&req.subject).await?;
    }
    // A linked account signs in through Kanidm only, so its local password goes: a password left beside the
    // link would be a second way in that Kanidm's second step and lockout never see. The setup administrator
    // keeps theirs as the named break-glass (os/README.md).
    sqlx::query(&format!(
        "UPDATE users u SET idp_id = $2, external_subject = $3, perm_version = u.perm_version + 1, \
         password_hash = CASE WHEN {SETUP_ADMIN_SQL} THEN u.password_hash END, \
         updated_at = now() WHERE u.id = $1"
    ))
    .bind(user_id)
    .bind(provider_id)
    .bind(&req.subject)
    .execute(&mut *tx)
    .await
    .map_err(already_linked)?;
    let details =
        serde_json::json!({ "provider_id": provider_id, "external_subject": req.subject });
    audit_link(&mut tx, &claims, user_id, "sso_link", &details).await?;
    let notice = notify_holder(
        &mut tx,
        claims.tenant_id,
        user_id,
        target.email.as_deref(),
        true,
    )
    .await?;
    tx.commit().await?;
    publish_notification(
        &state,
        claims.tenant_id,
        notice,
        &holder_notice(user_id, true),
    );
    Ok(Json(SsoLink {
        provider_id,
        subject: req.subject,
    }))
}

/// A race the check above lost: another account took the same Kanidm person first. A 409 in plain words.
fn already_linked(error: sqlx::Error) -> AppError {
    match &error {
        sqlx::Error::Database(db) if db.constraint() == Some("uq_users_idp_subject") => {
            AppError::Conflict(
                "This Kanidm person was just linked to another account. Unlink it there first."
                    .to_owned(),
            )
        }
        _ => error.into(),
    }
}

/// DELETE /api/admin/users/{id}/sso-link — removes the account's link to Kanidm.
///
/// Only an administrator may remove a link, since removing one is how an account is re-pointed. Audited, and
/// the holder is told. An account with no password of its own cannot sign in afterwards until it is linked again or given one.
pub async fn remove_link(
    Extension(claims): Extension<Claims>,
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, LINK_IDENTITY)?;
    let mut tx = medbrains_kernel::begin(&state.db, Actor::from_claims(&claims)).await?;
    let target = guard_target(&state, &mut tx, &claims, user_id).await?;
    if target.subject.is_none() {
        tx.commit().await?;
        return Ok(Json(serde_json::json!({ "unlinked": false })));
    }
    if !is_admin(&claims) {
        return Err(AppError::Forbidden);
    }
    let previous = sqlx::query_as::<_, (Option<Uuid>, Option<String>)>(
        "UPDATE users u SET idp_id = NULL, external_subject = NULL, perm_version = u.perm_version + 1, \
         updated_at = now() FROM users old WHERE u.id = $1 AND old.id = u.id \
         RETURNING old.idp_id, old.external_subject",
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    let details = serde_json::json!({ "provider_id": previous.0, "external_subject": previous.1 });
    audit_link(&mut tx, &claims, user_id, "sso_unlink", &details).await?;
    let notice = notify_holder(
        &mut tx,
        claims.tenant_id,
        user_id,
        target.email.as_deref(),
        false,
    )
    .await?;
    tx.commit().await?;
    publish_notification(
        &state,
        claims.tenant_id,
        notice,
        &holder_notice(user_id, false),
    );
    Ok(Json(serde_json::json!({ "unlinked": true })))
}

#[cfg(test)]
mod tests {
    use super::{is_subject, matching_people};

    /// Only a hyphenated UUID is stored as a subject, so a typo cannot link an account to nobody.
    #[test]
    fn only_a_kanidm_uuid_is_a_subject() {
        assert!(is_subject("026c6e42-4127-4946-9c6e-841b0670998b"));
        assert!(!is_subject("026C6E42-4127-4946-9C6E-841B0670998B"));
        assert!(!is_subject("asha_admin"));
        assert!(!is_subject(""));
    }

    /// A search matches name, display name or mail, case aside, and drops entries without a name or UUID.
    #[test]
    fn a_search_matches_name_display_name_or_mail() {
        let answer = serde_json::json!([
            { "attrs": { "name": ["ward_nurse"], "displayname": ["Ward Nurse"], "uuid": ["11111111-1111-1111-1111-111111111111"] } },
            { "attrs": { "name": ["lab_tech"], "mail": ["lab@hospital.test"], "uuid": ["22222222-2222-2222-2222-222222222222"] } },
            { "attrs": { "displayname": ["No name"], "uuid": ["33333333-3333-3333-3333-333333333333"] } },
        ]);
        assert_eq!(matching_people(&answer, "").len(), 2);
        assert_eq!(matching_people(&answer, "NURSE")[0].name, "ward_nurse");
        assert_eq!(
            matching_people(&answer, "hospital.test")[0].name,
            "lab_tech"
        );
        assert!(matching_people(&answer, "nobody").is_empty());
    }
}

//! One person across the hospitals of a group: records LINKED, never merged.
//!
//! Each hospital keeps its own patient and UHID. A link says only that two
//! records are the same person (`group_patient_links.person_id`). Matching
//! runs in order of certainty:
//!
//! 1. a verified ABHA number held at both hospitals — linked;
//! 2. the same Aadhaar number, compared as an HMAC keyed with the GROUP
//!    (`patient_group_fingerprints`; the number itself is never stored) —
//!    linked;
//! 3. a probable match by the duplicate check's Fellegi-Sunter score
//!    (`medbrains_server_services::patient_match`) — queued for a person to
//!    decide, never linked by itself.
//!
//! Nothing is linked unless the group's management declared that its
//! hospitals share records (`hospital_groups.share_clinical_records`, the
//! legal-entity determination row level security already honours). Only
//! identity crosses hospitals here, masked by the viewer's field access;
//! another hospital's clinical record is reached through the consent paths
//! (ABDM, transfers), never through a link. Every link, unlink and decision
//! is on the audit trail (`audit_trigger_func`).

use axum::Json;
use axum::extract::{Extension, Path, Query, State};
use chrono::{DateTime, Utc};
use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::middleware::field_access;
use medbrains_server_core::state::AppState;
use medbrains_server_services::patient_match::MatchResult;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::filter_match_result;
use super::group_identity_store::{self as store, Group};

/// A record of the same person at another hospital of the group.
#[derive(Debug, Serialize)]
pub struct GroupRecord {
    pub link_id: Uuid,
    pub hospital: String,
    /// `abha` / `aadhaar` / `probabilistic` / `manual`.
    pub match_method: String,
    pub linked_at: DateTime<Utc>,
    #[serde(flatten)]
    pub patient: MatchResult,
}

/// A probable match waiting for a decision.
#[derive(Debug, Serialize)]
pub struct GroupCandidate {
    pub candidate_id: Uuid,
    pub hospital: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    /// The record at this hospital the match was found for.
    pub local_patient_id: Uuid,
    #[serde(flatten)]
    pub patient: MatchResult,
}

#[derive(Debug, Serialize)]
pub struct GroupIdentity {
    /// The hospital is in a group whose hospitals share records.
    pub sharing: bool,
    pub group_name: Option<String>,
    pub links: Vec<GroupRecord>,
    pub candidates: Vec<GroupCandidate>,
}

#[derive(Debug, Serialize)]
pub struct ScanOutcome {
    pub linked: usize,
    pub queued: usize,
}

#[derive(Debug, Deserialize)]
pub struct DecisionRequest {
    /// `link` or `reject`.
    pub decision: String,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UnlinkRequest {
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct QueueQuery {
    pub status: Option<String>,
}

const MIN_REASON: usize = 5;

fn reason(text: Option<&str>) -> Result<String, AppError> {
    let r = text.map(str::trim).unwrap_or_default();
    if r.chars().count() < MIN_REASON {
        return Err(AppError::BadRequest(
            "Say why, in a few words — the reason stays on the record".to_owned(),
        ));
    }
    Ok(r.to_owned())
}

/// The group, refusing when records are not shared.
fn sharing(group: Option<Group>) -> Result<Group, AppError> {
    match group {
        None => Err(AppError::BadRequest(
            "This hospital is not part of a hospital group".to_owned(),
        )),
        Some(g) if !g.share_clinical_records => Err(AppError::Conflict(format!(
            "{} does not share records between its hospitals. Management must turn on record \
             sharing for the group before records can be linked.",
            g.name
        ))),
        Some(g) => Ok(g),
    }
}

/// `GET /api/patients/{id}/group-identity` — the same person's records at the
/// group's other hospitals, and the matches waiting for review.
///
/// # Errors
/// 403 without `patients.group_identity.view` or access to the patient.
pub async fn get_group_identity(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<GroupIdentity>, AppError> {
    require_permission(&claims, permissions::patients::group_identity::VIEW)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let restricted = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let group = store::group(&mut tx, claims.tenant_id).await?;
    let shares = group.as_ref().is_some_and(|g| g.share_clinical_records);
    let (links, candidates) = if shares {
        (
            store::links_of(&mut tx, patient_id).await?,
            store::candidates_of(&mut tx, claims.tenant_id, patient_id).await?,
        )
    } else {
        (Vec::new(), Vec::new())
    };
    tx.commit().await?;
    Ok(Json(GroupIdentity {
        sharing: shares,
        group_name: group.map(|g| g.name),
        links: links
            .into_iter()
            .map(|mut l| {
                l.patient = filter_match_result(l.patient, &restricted);
                l
            })
            .collect(),
        candidates: candidates
            .into_iter()
            .map(|mut c| {
                c.patient = filter_match_result(c.patient, &restricted);
                c
            })
            .collect(),
    }))
}

/// `POST /api/patients/{id}/group-identity/scan` — look for this patient at
/// the group's other hospitals: link the certain matches, queue the probable.
///
/// # Errors
/// 403 without `patients.group_identity.link` or access to the patient;
/// 409 when the group does not share records.
pub async fn scan_group_identity(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(patient_id): Path<Uuid>,
) -> Result<Json<ScanOutcome>, AppError> {
    require_permission(&claims, permissions::patients::group_identity::LINK)?;
    medbrains_authz_gate::require_patient_access(&state, &claims, patient_id).await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let group = sharing(store::group(&mut tx, claims.tenant_id).await?)?;
    let me = store::Local {
        group_id: group.id,
        tenant_id: claims.tenant_id,
        patient_id,
        user_id: claims.sub,
    };
    let outcome = store::scan(&mut tx, &me).await?;
    tx.commit().await?;
    Ok(Json(outcome))
}

/// `GET /api/patients/group-identity/candidates` — the group's review queue
/// as this hospital sees it, newest first.
///
/// # Errors
/// 403 without `patients.group_identity.link`; 409 when the group does not
/// share records.
pub async fn list_candidates(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<QueueQuery>,
) -> Result<Json<Vec<GroupCandidate>>, AppError> {
    require_permission(&claims, permissions::patients::group_identity::LINK)?;
    let status = q.status.as_deref().unwrap_or("pending");
    if !matches!(status, "pending" | "linked" | "rejected") {
        return Err(AppError::BadRequest(
            "status is pending, linked or rejected".into(),
        ));
    }
    let restricted = field_access::resolve_restricted_fields(
        &state.db,
        claims.tenant_id,
        claims.sub,
        &claims.role,
    )
    .await?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sharing(store::group(&mut tx, claims.tenant_id).await?)?;
    let rows = store::queue(&mut tx, claims.tenant_id, status).await?;
    tx.commit().await?;
    Ok(Json(
        rows.into_iter()
            .map(|mut c| {
                c.patient = filter_match_result(c.patient, &restricted);
                c
            })
            .collect(),
    ))
}

/// `POST /api/patients/group-identity/candidates/{id}/decide` — link a
/// probable match, or reject it (with a reason).
///
/// # Errors
/// 403 without `patients.group_identity.link`; 404 for a candidate this
/// hospital cannot see; 409 when it was already decided or records are not
/// shared.
pub async fn decide_candidate(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DecisionRequest>,
) -> Result<Json<GroupCandidate>, AppError> {
    require_permission(&claims, permissions::patients::group_identity::LINK)?;
    let link = match body.decision.as_str() {
        "link" => true,
        "reject" => false,
        _ => return Err(AppError::BadRequest("decision is link or reject".into())),
    };
    let why = if link {
        body.reason.as_deref().map(str::trim).map(str::to_owned)
    } else {
        Some(reason(body.reason.as_deref())?)
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let group = sharing(store::group(&mut tx, claims.tenant_id).await?)?;
    let who = (group.id, claims.sub, claims.tenant_id);
    let decided = store::decide(&mut tx, who, id, link, why.as_deref()).await?;
    tx.commit().await?;
    Ok(Json(decided))
}

/// `POST /api/patients/group-identity/links/{id}/unlink` — undo a wrong link.
/// The record leaves the person; the row stays, with who, when and why.
///
/// # Errors
/// 403 without `patients.group_identity.link`; 404 for a link this hospital
/// cannot see or one already undone.
pub async fn unlink(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UnlinkRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::patients::group_identity::LINK)?;
    let why = reason(Some(&body.reason))?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    sharing(store::group(&mut tx, claims.tenant_id).await?)?;
    store::unlink(&mut tx, id, claims.sub, &why).await?;
    tx.commit().await?;
    Ok(Json(serde_json::json!({ "unlinked": id })))
}

#[cfg(test)]
mod tests {
    use super::{Group, reason, sharing};
    use uuid::Uuid;

    fn group(shares: bool) -> Group {
        Group {
            id: Uuid::new_v4(),
            name: "Sunrise Hospitals".to_owned(),
            share_clinical_records: shares,
        }
    }

    /// Given a group whose management has not declared record sharing,
    /// When anyone tries to link, Then it is refused, naming the group and
    /// what has to change; a hospital in no group is refused too.
    #[test]
    fn nothing_links_unless_the_group_shares_records() {
        assert!(sharing(None).is_err());
        let refused = sharing(Some(group(false))).map(|g| g.id);
        assert!(
            matches!(&refused, Err(e) if e.to_string().contains("Sunrise Hospitals")),
            "{refused:?}"
        );
        assert!(sharing(Some(group(true))).is_ok());
    }

    #[test]
    fn a_rejection_or_an_unlink_needs_a_reason() {
        assert!(reason(None).is_err());
        assert!(reason(Some("  no ")).is_err());
        assert_eq!(
            reason(Some(" different father's name ")).ok().as_deref(),
            Some("different father's name")
        );
    }
}

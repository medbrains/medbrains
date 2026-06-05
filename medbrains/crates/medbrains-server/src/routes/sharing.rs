//! Sharing API — manual per-resource grants on top of the auto-derived
//! tuples from create handlers. The user-facing "Share" button on a
//! patient / admission / pipeline detail page calls these.
//!
//! Permission rules:
//!   - POST    — caller must hold `owner` on the target OR
//!     `admin.sharing.manage` permission OR be a bypass role
//!   - DELETE  — same as POST (only the resource owner / admin / bypass
//!     can revoke a grant they didn't issue)
//!   - GET     — caller must hold `view` on the target (you can see
//!     who else has access to a resource you can already see)
//!   - GET granted-to-me — always allowed for any authenticated user
//!     (it's their own list)
//!
//! Every mutation writes an `audit_log` row with `entity_type="relation_tuple"`
//! and `relation_reason` set to the grant's caller-supplied reason
//! (e.g. "break_glass_code_blue", "second_opinion_consult"). The audit
//! middleware already handles state-changing requests, so we just
//! need to log the relation_type / relation_expires_at fields.

use axum::{Extension, Json, extract::State};
use chrono::{DateTime, Utc};
use medbrains_authz::{Relation, Subject};
use medbrains_core::{
    access::ROLE_POLICIES,
    clinical_events::{ClinicalEventEnvelope, ClinicalEventName},
    permissions,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::AppError,
    middleware::{
        auth::Claims,
        authorization::{authz_context, is_bypass_role, require_permission},
    },
    state::AppState,
};

/// Subject of a grant — must match the SpiceDB taxonomy.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "id", rename_all = "snake_case")]
pub enum GrantSubject {
    User(Uuid),
    Role(String),
    Department(Uuid),
    Group(Uuid),
}

impl GrantSubject {
    fn into_authz_subject(self) -> Subject {
        match self {
            Self::User(id) => Subject::User(id),
            Self::Role(code) => Subject::Role(code),
            Self::Department(id) => Subject::Department(id),
            Self::Group(id) => Subject::Group(id),
        }
    }

    fn event_subject_parts(&self) -> (&'static str, String) {
        match self {
            Self::User(id) => ("user", id.to_string()),
            Self::Role(code) => ("role", code.clone()),
            Self::Department(id) => ("department", id.to_string()),
            Self::Group(id) => ("group", id.to_string()),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateGrantRequest {
    pub object_type: String,
    pub object_id: Uuid,
    pub relation: String,
    pub subject: GrantSubject,
    /// Optional expiry — SpiceDB filters tuples past this timestamp.
    pub expires_at: Option<DateTime<Utc>>,
    /// Reason for grant — captured in audit_log for compliance review.
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GrantResponse {
    pub tuple_id: Uuid,
    pub object_type: String,
    pub object_id: Uuid,
    pub relation: String,
    pub status: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SharingSubjectOption {
    pub id: String,
    pub label: String,
    pub subtitle: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SharingSubjectDirectory {
    pub users: Vec<SharingSubjectOption>,
    pub roles: Vec<SharingSubjectOption>,
    pub departments: Vec<SharingSubjectOption>,
    pub groups: Vec<SharingSubjectOption>,
}

/// GET /api/sharing/subjects — staff directory for the sharing drawer.
///
/// This intentionally returns only minimal staff / role / department labels,
/// not patient data. The actual grant still goes through owner/admin checks.
pub async fn list_subjects(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<SharingSubjectDirectory>, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_full_context(&mut tx, &claims.tenant_id, &claims.department_ids)
        .await?;

    let users = sqlx::query_as::<_, SharingSubjectOption>(
        "SELECT id::text AS id, full_name AS label, role::text AS subtitle \
         FROM users \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY full_name \
         LIMIT 500",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let roles = sqlx::query_as::<_, SharingSubjectOption>(
        "SELECT code AS id, name AS label, description AS subtitle \
         FROM roles \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let departments = sqlx::query_as::<_, SharingSubjectOption>(
        "SELECT id::text AS id, name AS label, code AS subtitle \
         FROM departments \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    let groups = sqlx::query_as::<_, SharingSubjectOption>(
        "SELECT id::text AS id, name AS label, code AS subtitle \
         FROM access_groups \
         WHERE tenant_id = $1 AND is_active = true \
         ORDER BY name",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(SharingSubjectDirectory {
        users,
        roles,
        departments,
        groups,
    }))
}

/// POST /api/sharing/grants — create a grant.
pub async fn create_grant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateGrantRequest>,
) -> Result<Json<GrantResponse>, AppError> {
    // Check 1: caller has the abstract `admin.sharing.manage` perm OR
    // is a bypass role OR holds `owner` on the target resource.
    let is_admin_sharer = require_permission(&claims, permissions::admin::sharing::MANAGE).is_ok()
        || is_bypass_role(&claims);

    if !is_admin_sharer {
        let ctx = authz_context(&claims);
        let owns = state
            .authz
            .check(&ctx, Relation::Owner, &body.object_type, body.object_id)
            .await
            .unwrap_or(false);
        if !owns {
            return Err(AppError::Forbidden);
        }
    }

    // Map relation string → Relation enum for the trait method. Unknown
    // relations are rejected — schema-mandated grants only.
    let relation = Relation::from_code(&body.relation)
        .ok_or_else(|| AppError::BadRequest(format!("unknown relation: {}", body.relation)))?;

    let ctx = authz_context(&claims);
    let (subject_type, subject_id) = body.subject.event_subject_parts();
    let subject = body.subject.into_authz_subject();
    let tuple_id = state
        .authz
        .write_tuple(
            &ctx,
            &body.object_type,
            body.object_id,
            relation,
            subject,
            body.expires_at,
            body.reason.clone(),
        )
        .await
        .map_err(|e| AppError::Internal(format!("write_tuple: {e}")))?;

    if body.object_type == "patient" {
        let mut tx = state.db.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
        let event = ClinicalEventEnvelope::new(
            claims.tenant_id,
            ClinicalEventName::PatientAccessShared,
            tuple_id,
            claims.sub,
            serde_json::json!({
                "patient_id": body.object_id,
                "grant_id": tuple_id,
                "relation": body.relation,
                "subject_type": subject_type,
                "subject_id": subject_id,
                "expires_at": body.expires_at,
                "reason_recorded": body
                    .reason
                    .as_deref()
                    .is_some_and(|reason| !reason.trim().is_empty()),
            }),
        )
        .with_patient(body.object_id);
        crate::events::queue_clinical_event_in_tx(&mut tx, &event).await?;
        tx.commit().await?;
    }

    Ok(Json(GrantResponse {
        tuple_id,
        object_type: body.object_type,
        object_id: body.object_id,
        relation: body.relation,
        status: "active".to_owned(),
    }))
}

#[derive(Debug, Deserialize)]
pub struct RevokeGrantRequest {
    pub object_type: String,
    pub object_id: Uuid,
    pub relation: String,
    pub subject: GrantSubject,
}

/// DELETE /api/sharing/grants — revoke a specific grant. SpiceDB
/// doesn't expose tuple_ids over the wire, so revocation is by
/// (resource, relation, subject) tuple coordinates.
pub async fn revoke_grant(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<RevokeGrantRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let is_admin_sharer = require_permission(&claims, permissions::admin::sharing::MANAGE).is_ok()
        || is_bypass_role(&claims);

    if !is_admin_sharer {
        let ctx = authz_context(&claims);
        let owns = state
            .authz
            .check(&ctx, Relation::Owner, &body.object_type, body.object_id)
            .await
            .unwrap_or(false);
        if !owns {
            return Err(AppError::Forbidden);
        }
    }

    let relation = Relation::from_code(&body.relation)
        .ok_or_else(|| AppError::BadRequest(format!("unknown relation: {}", body.relation)))?;

    let ctx = authz_context(&claims);
    let subject = body.subject.into_authz_subject();
    state
        .authz
        .revoke_specific(&ctx, &body.object_type, body.object_id, relation, subject)
        .await
        .map_err(|e| AppError::Internal(format!("revoke_specific: {e}")))?;

    Ok(Json(serde_json::json!({ "status": "revoked" })))
}

#[derive(Debug, Deserialize)]
pub struct ListGrantsQuery {
    pub object_type: String,
    pub object_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct GrantSummary {
    pub object_type: String,
    pub object_id: Uuid,
    pub relation: String,
    pub subject_type: String,
    pub subject_id: String,
    pub expires_at: Option<DateTime<Utc>>,
}

/// GET /api/sharing/grants?object_type=patient&object_id=… —
/// list every grant on the given resource. Caller must hold `view`
/// on the resource (already-visible-to-them check).
pub async fn list_grants(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    axum::extract::Query(params): axum::extract::Query<ListGrantsQuery>,
) -> Result<Json<Vec<GrantSummary>>, AppError> {
    let ctx = authz_context(&claims);
    if !ctx.is_bypass {
        let can_view = state
            .authz
            .check(
                &ctx,
                Relation::Viewer,
                &params.object_type,
                params.object_id,
            )
            .await
            .unwrap_or(false);
        if !can_view {
            return Err(AppError::NotFound);
        }
    }

    let tuples = state
        .authz
        .expand(&ctx, &params.object_type, params.object_id)
        .await
        .map_err(|e| AppError::Internal(format!("expand: {e}")))?;

    let summaries = tuples
        .into_iter()
        .map(|t| GrantSummary {
            object_type: t.object_type,
            object_id: t.object_id,
            relation: t.relation,
            subject_type: match &t.subject {
                Subject::User(_) => "user",
                Subject::Role(_) => "role",
                Subject::Department(_) => "department",
                Subject::Group(_) => "group",
                Subject::TupleSet(_) => "tuple_set",
            }
            .to_owned(),
            subject_id: match t.subject {
                Subject::User(id) => id.to_string(),
                Subject::Role(c) => c,
                Subject::Department(id) => id.to_string(),
                Subject::Group(id) => id.to_string(),
                Subject::TupleSet(s) => s,
            },
            expires_at: t.expires_at,
        })
        .collect();

    Ok(Json(summaries))
}

/// GET /api/sharing/granted-to-me — list resources shared with the caller.
/// Returns one row per visible (object_type, object_id) pair. Useful
/// for a "shared with me" inbox in the UI.
pub async fn list_granted_to_me(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<GrantSummary>>, AppError> {
    // Cheap implementation: walk a fixed set of resource types and
    // call list_accessible on each. Not exhaustive — the AccessManifest
    // could expose REBAC_RESOURCES iteratively if we want every type,
    // but most callers care about clinical only.
    let ctx = authz_context(&claims);
    let types: &[&str] = &[
        "patient",
        "encounter",
        "admission",
        "lab_order",
        "pharmacy_order",
        "radiology_order",
        "invoice",
    ];

    let mut out = Vec::new();
    for t in types {
        let visible = state
            .authz
            .list_accessible(&ctx, t, Relation::Viewer)
            .await
            .unwrap_or_default();
        for id in visible {
            out.push(GrantSummary {
                object_type: (*t).to_owned(),
                object_id: id,
                relation: "viewer".to_owned(),
                subject_type: "user".to_owned(),
                subject_id: claims.sub.to_string(),
                expires_at: None,
            });
        }
    }

    // Suppress unused-import warning if ROLE_POLICIES is dropped later.
    let _ = ROLE_POLICIES;

    Ok(Json(out))
}

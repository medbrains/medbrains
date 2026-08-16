//! The request-type catalog — what a hospital can be asked for.
//!
//! This is the module that makes the platform's central claim true. The engine
//! has always supported request types with no code behind them; until now the
//! only way to create one was to write SQL, which is not "no code" in any
//! sense an administrator would accept.
//!
//! A type created here is immediately raisable: the catalog row, its form
//! fields and a single-stage approval chain are written in one transaction, so
//! there is never a moment where the catalog offers something that cannot be
//! decided.
//!
//! # What this deliberately does not do
//!
//! No multi-stage chain editor. A visual designer for quorum, witnesses,
//! escalation and conditional branching is a real surface and a poor first
//! one — most types need one approver, and a half-built designer invites
//! chains nobody can reason about. Multi-stage types are still created through
//! a migration or a seed script until that designer exists, and
//! [`create_type`] refuses rather than silently flattening a request for one.

use axum::{
    Json,
    extract::{Path, State},
};
use medbrains_approvals_core::ApproverRule;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

/// Managing what can be requested is an access-control decision: a type is a
/// route by which people ask for things, and inventing one changes who can ask
/// for what.
const MANAGE: &str = "security.access.manage";

#[derive(Debug, Serialize)]
pub struct RequestTypeSummary {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub module: String,
    pub description: Option<String>,
    pub is_active: bool,
    /// `None` means approving is itself the outcome — no code runs. This is
    /// the config-only case, and the catalog shows it because "what happens
    /// when this is approved" is the first question an administrator asks.
    pub effect_key: Option<String>,
    pub field_count: i64,
    pub open_requests: i64,
}

#[derive(Debug, Serialize)]
pub struct RequestTypeField {
    pub key: String,
    pub label: String,
    pub field_type: String,
    pub is_required: bool,
    pub options: serde_json::Value,
    pub sort_order: i32,
}

#[derive(Debug, Serialize)]
pub struct RequestTypeDetail {
    #[serde(flatten)]
    pub summary: RequestTypeSummary,
    pub requires_justification: bool,
    pub max_duration_hours: Option<i32>,
    pub fields: Vec<RequestTypeField>,
    /// Rendered for display — "Anyone with facilities.manage". The chain is not
    /// editable here; see the module comment.
    pub approver_summary: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NewRequestType {
    pub code: String,
    pub name: String,
    pub module: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default = "yes")]
    pub requires_justification: bool,
    #[serde(default)]
    pub max_duration_hours: Option<i32>,
    /// Left unset for a config-only type. Naming one that no server implements
    /// is refused — see [`create_type`].
    #[serde(default)]
    pub effect_key: Option<String>,
    #[serde(default)]
    pub fields: Vec<NewField>,
    /// Who decides. One stage only, for now.
    pub approver_rule: serde_json::Value,
}

const fn yes() -> bool {
    true
}

#[derive(Debug, Deserialize)]
pub struct NewField {
    pub key: String,
    pub label: String,
    /// text | number | date | select | boolean | user | department | attachment
    pub field_type: String,
    #[serde(default)]
    pub is_required: bool,
    #[serde(default)]
    pub options: Option<serde_json::Value>,
}

/// Everything a hospital can be asked for.
///
/// # Errors
/// 403 without `security.access.manage`; database errors otherwise.
pub async fn list_types(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
) -> Result<Json<Vec<RequestTypeSummary>>, AppError> {
    require_permission(&claims, MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // The counts come from the same query rather than one per row: a catalog
    // of forty types would otherwise be eighty round trips to render a list.
    let rows = sqlx::query(
        "SELECT t.id, t.code, t.name, t.module, t.description, t.is_active, t.effect_key, \
                (SELECT count(*) FROM request_type_fields f \
                  WHERE f.request_type_id = t.id AND f.deleted_at IS NULL) AS field_count, \
                (SELECT count(*) FROM approval_requests r \
                  WHERE r.request_type_id = t.id AND r.status = 'pending' \
                    AND r.deleted_at IS NULL) AS open_requests \
         FROM request_types t \
         WHERE t.deleted_at IS NULL \
         ORDER BY t.module, t.name",
    )
    .fetch_all(&mut *tx)
    .await?;

    let out = rows
        .iter()
        .map(|row| {
            Ok(RequestTypeSummary {
                id: row.try_get("id")?,
                code: row.try_get("code")?,
                name: row.try_get("name")?,
                module: row.try_get("module")?,
                description: row.try_get("description")?,
                is_active: row.try_get("is_active")?,
                effect_key: row.try_get("effect_key")?,
                field_count: row.try_get("field_count")?,
                open_requests: row.try_get("open_requests")?,
            })
        })
        .collect::<Result<Vec<_>, sqlx::Error>>()?;
    tx.commit().await?;
    Ok(Json(out))
}

/// One type, with its form.
///
/// # Errors
/// 403 without the permission, 404 when the code is unknown here.
pub async fn get_type(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
    Path(code): Path<String>,
) -> Result<Json<RequestTypeDetail>, AppError> {
    require_permission(&claims, MANAGE)?;
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let row = sqlx::query(
        "SELECT t.id, t.code, t.name, t.module, t.description, t.is_active, t.effect_key, \
                t.requires_justification, t.max_duration_hours, \
                (SELECT count(*) FROM request_type_fields f \
                  WHERE f.request_type_id = t.id AND f.deleted_at IS NULL) AS field_count, \
                (SELECT count(*) FROM approval_requests r \
                  WHERE r.request_type_id = t.id AND r.status = 'pending' \
                    AND r.deleted_at IS NULL) AS open_requests, \
                (SELECT s.approver_rule FROM approval_workflow_steps s \
                   JOIN approval_workflows w ON w.id = s.workflow_id \
                  WHERE w.request_type_id = t.id AND w.is_active \
                    AND s.deleted_at IS NULL ORDER BY w.version DESC, s.seq LIMIT 1) AS rule \
         FROM request_types t \
         WHERE t.code = $1 AND t.deleted_at IS NULL",
    )
    .bind(&code)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    let id: Uuid = row.try_get("id")?;
    let field_rows = sqlx::query(
        "SELECT key, label, field_type, is_required, options, sort_order \
         FROM request_type_fields \
         WHERE request_type_id = $1 AND deleted_at IS NULL ORDER BY sort_order",
    )
    .bind(id)
    .fetch_all(&mut *tx)
    .await?;

    let rule: Option<serde_json::Value> = row.try_get("rule")?;
    let detail = RequestTypeDetail {
        summary: RequestTypeSummary {
            id,
            code: row.try_get("code")?,
            name: row.try_get("name")?,
            module: row.try_get("module")?,
            description: row.try_get("description")?,
            is_active: row.try_get("is_active")?,
            effect_key: row.try_get("effect_key")?,
            field_count: row.try_get("field_count")?,
            open_requests: row.try_get("open_requests")?,
        },
        requires_justification: row.try_get("requires_justification")?,
        max_duration_hours: row.try_get("max_duration_hours")?,
        fields: field_rows
            .iter()
            .map(|f| {
                Ok(RequestTypeField {
                    key: f.try_get("key")?,
                    label: f.try_get("label")?,
                    field_type: f.try_get("field_type")?,
                    is_required: f.try_get("is_required")?,
                    options: f.try_get("options")?,
                    sort_order: f.try_get("sort_order")?,
                })
            })
            .collect::<Result<Vec<_>, sqlx::Error>>()?,
        approver_summary: rule.as_ref().and_then(describe_rule),
    };
    tx.commit().await?;
    Ok(Json(detail))
}

/// Create a request type, its form and its single approval stage.
///
/// One transaction. A type whose chain failed to write would sit in the
/// catalog offering a request nobody could decide, and that failure would
/// surface to whoever tried to raise it rather than to whoever created it.
///
/// # Errors
/// 403 without the permission, 409 when the code already exists, 422 when the
/// approver rule is unreadable or the effect key is not implemented here.
pub async fn create_type(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<Claims>,
    Json(body): Json<NewRequestType>,
) -> Result<Json<RequestTypeSummary>, AppError> {
    require_permission(&claims, MANAGE)?;

    // Parsed before anything is written. A rule the server cannot read would
    // otherwise be discovered by the first person to raise the request, and
    // the failure would look like theirs.
    let rule = ApproverRule::parse(&body.approver_rule)
        .map_err(|error| AppError::BadRequest(format!("approver rule: {error}")))?;
    if !rule.is_human() {
        return Err(AppError::BadRequest(
            "external and automatic stages cannot be created here yet — they need a chain editor"
                .to_owned(),
        ));
    }

    // An effect_key nothing implements would collect approvals and then do
    // nothing, while everybody involved believed it had worked. Better to
    // refuse at creation, where a person is present to read why.
    if let Some(key) = body.effect_key.as_deref() {
        if !crate::registry_for(&state).can_satisfy(Some(key)) {
            return Err(AppError::BadRequest(format!(
                "no effect named '{key}' is implemented on this server; leave it unset for a \
                 request where the approval itself is the outcome"
            )));
        }
    }

    let code = body.code.trim().to_lowercase();
    if code.is_empty() || !code.contains('.') {
        // `module.thing`, so the catalog groups and a reader can tell what a
        // code belongs to without a lookup.
        return Err(AppError::BadRequest(
            "code must look like 'module.thing', e.g. 'facilities.parking_pass'".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let type_id: Uuid = sqlx::query_scalar(
        "INSERT INTO request_types \
           (tenant_id, code, name, module, description, requires_justification, \
            max_duration_hours, effect_key, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         ON CONFLICT (tenant_id, code) WHERE deleted_at IS NULL DO NOTHING \
         RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(&code)
    .bind(body.name.trim())
    .bind(body.module.trim())
    .bind(body.description.as_deref())
    .bind(body.requires_justification)
    .bind(body.max_duration_hours)
    .bind(body.effect_key.as_deref())
    .bind(claims.sub)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| AppError::Conflict(format!("a request type '{code}' already exists")))?;

    for (index, field) in body.fields.iter().enumerate() {
        sqlx::query(
            "INSERT INTO request_type_fields \
               (tenant_id, request_type_id, key, label, field_type, is_required, options, \
                sort_order) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        )
        .bind(claims.tenant_id)
        .bind(type_id)
        .bind(field.key.trim())
        .bind(field.label.trim())
        .bind(&field.field_type)
        .bind(field.is_required)
        .bind(field.options.clone().unwrap_or(serde_json::json!({})))
        .bind(i32::try_from(index).unwrap_or(i32::MAX))
        .execute(&mut *tx)
        .await?;
    }

    let workflow_id: Uuid = sqlx::query_scalar(
        "INSERT INTO approval_workflows \
           (tenant_id, request_type_id, code, name, version, created_by) \
         VALUES ($1, $2, $3, $4, 1, $5) RETURNING id",
    )
    .bind(claims.tenant_id)
    .bind(type_id)
    .bind(format!("{code}.default"))
    .bind(format!("{} — approval", body.name.trim()))
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO approval_workflow_steps \
           (tenant_id, workflow_id, seq, name, approver_rule, quorum) \
         VALUES ($1, $2, 1, 'Approval', $3, 1)",
    )
    .bind(claims.tenant_id)
    .bind(workflow_id)
    .bind(&body.approver_rule)
    .execute(&mut *tx)
    .await?;

    sqlx::query("UPDATE request_types SET default_workflow_id = $2 WHERE id = $1")
        .bind(type_id)
        .bind(workflow_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(RequestTypeSummary {
        id: type_id,
        code,
        name: body.name.trim().to_owned(),
        module: body.module.trim().to_owned(),
        description: body.description,
        is_active: true,
        effect_key: body.effect_key,
        field_count: i64::try_from(body.fields.len()).unwrap_or(i64::MAX),
        open_requests: 0,
    }))
}

/// A stored rule, in words.
///
/// Shown rather than the raw JSON, because an administrator deciding whether a
/// chain is right should not have to read a rule engine's serialisation.
fn describe_rule(raw: &serde_json::Value) -> Option<String> {
    Some(match ApproverRule::parse(raw).ok()? {
        ApproverRule::Role { role } => format!("Anyone with the {role} role"),
        ApproverRule::Permission { permission } => format!("Anyone with '{permission}'"),
        ApproverRule::ReportingManager => "The requester's reporting manager".to_owned(),
        ApproverRule::DepartmentHead {
            department_id: None,
        } => "The head of the requester's department".to_owned(),
        ApproverRule::DepartmentHead { .. } => "The head of a named department".to_owned(),
        ApproverRule::DesignationLevelAtLeast { level } => {
            format!("Anyone at designation level {level} or above")
        }
        ApproverRule::NamedUser { .. } => "One named person".to_owned(),
        ApproverRule::External { provider } => format!("Decided externally by {provider}"),
        ApproverRule::Automatic { reason } => format!("Automatic: {reason}"),
    })
}

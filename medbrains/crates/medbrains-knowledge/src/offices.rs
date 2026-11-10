//! Approval by named offices (RFC-SOP-FLOWS §9.3).

use medbrains_core::permissions;
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;

use crate::adapter::Tx;
use crate::engine::area_of;
use crate::flow_switches;
use crate::model::{Area, KnowledgeChangeSet};
use crate::store;

/// The offices whose approval a set needs, in order; empty for areas any
/// approver may sign alone. Flow switch changes need the quality officer,
/// and for a clinical flow the medical superintendent as well
/// (RFC-SOP-FLOWS §9.3). Two approvals by two people, each for their office,
/// rather than the approvals engine's quorum: the change set already carries
/// its approver, four-eyes CHECK and audit trail, so a second approver column
/// keeps one place where approval lives.
pub(crate) async fn offices(
    tx: &mut Tx<'_>,
    claims: &Claims,
    set: &KnowledgeChangeSet,
) -> Result<&'static [&'static str], AppError> {
    if area_of(set)? != Area::FlowSwitches {
        return Ok(&[]);
    }
    require_permission(claims, permissions::flows::PUBLISH)?;
    let items = store::load_items(tx, claims.tenant_id, set.id).await?;
    let clinical = items.iter().any(|i| {
        i.after
            .as_ref()
            .and_then(|a| a.get("flow_code"))
            .and_then(serde_json::Value::as_str)
            .and_then(flow_switches::clinical)
            .unwrap_or(true)
    });
    Ok(if clinical {
        CLINICAL_OFFICES
    } else {
        &CLINICAL_OFFICES[..1]
    })
}

const CLINICAL_OFFICES: &[&str] = &["quality_officer", "medical_superintendent"];

fn office_name(code: &str) -> String {
    code.replace('_', " ")
}

/// Record one office's approval; the set is approved once every office has.
/// An office is a role, not a permission, so bypass roles do not stand in.
pub(crate) async fn approve_as_office(
    tx: &mut Tx<'_>,
    claims: &Claims,
    set: &KnowledgeChangeSet,
    offices: &[&str],
    note: Option<&str>,
) -> Result<(), AppError> {
    let names = offices
        .iter()
        .map(|o| office_name(o))
        .collect::<Vec<_>>()
        .join(" and the ");
    if !offices.contains(&claims.role.as_str()) {
        return Err(AppError::ForbiddenReason(format!(
            "This switch change is approved by the {names}"
        )));
    }
    if set.approver_id == Some(claims.sub) {
        return Err(AppError::Conflict(
            "You have already approved this change".to_owned(),
        ));
    }
    if set.approver_role.as_deref() == Some(claims.role.as_str()) {
        let waiting = offices
            .iter()
            .find(|o| **o != claims.role)
            .map_or(String::new(), |o| office_name(o));
        return Err(AppError::Conflict(format!(
            "The {} has already approved; waiting for the {waiting}",
            office_name(&claims.role)
        )));
    }
    let complete = set.approver_id.is_some() || offices.len() == 1;
    let sql = if set.approver_id.is_none() {
        "UPDATE knowledge_change_sets SET approver_id = $3, approver_role = $4, approved_at = now(), \
                decision_note = $5, status = CASE WHEN $6 THEN 'approved' ELSE status END \
          WHERE tenant_id = $1 AND id = $2"
    } else {
        "UPDATE knowledge_change_sets SET second_approver_id = $3, second_approver_role = $4, \
                second_approved_at = now(), decision_note = COALESCE($5, decision_note), \
                status = CASE WHEN $6 THEN 'approved' ELSE status END \
          WHERE tenant_id = $1 AND id = $2"
    };
    sqlx::query(sql)
        .bind(claims.tenant_id)
        .bind(set.id)
        .bind(claims.sub)
        .bind(&claims.role)
        .bind(note)
        .bind(complete)
        .execute(&mut **tx)
        .await?;
    Ok(())
}

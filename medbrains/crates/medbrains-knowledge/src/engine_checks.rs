//! The checks the change-set service makes before it opens a transaction:
//! the shape of a new set, the status filter, and which code applying an area needs.
//!
//! Split from `engine.rs` so the service reads as the order of operations.

use medbrains_core::permissions;
use medbrains_server_core::error::AppError;

use crate::model::{Area, NewKnowledgeChangeSet, Op};

/// Refuse a new set an area cannot take: switches and the locale profile are
/// only ever changed, and every set needs a title and a reason.
pub(crate) fn check_new_set(body: &NewKnowledgeChangeSet) -> Result<(), AppError> {
    let update_only = match body.area {
        Area::FlowSwitches => Some("Switch settings are changed, never added or removed"),
        Area::LocaleProfile => Some("A locale profile is changed, never added or removed"),
        Area::DrugInteractions | Area::CriticalValueRules => None,
    };
    if let Some(message) = update_only
        && body.items.iter().any(|i| i.op != Op::Update)
    {
        return Err(AppError::BadRequest(message.to_owned()));
    }
    if body.title.trim().is_empty() || body.reason.trim().is_empty() {
        return Err(AppError::BadRequest(
            "A title and a reason are required".to_owned(),
        ));
    }
    Ok(())
}

/// The statuses a list filter names. `status` may name several,
/// comma-separated ("previewed,approved"), so a screen counts what waits in
/// one call instead of filtering a capped list.
pub(crate) fn parse_statuses(status: &str) -> Vec<String> {
    status
        .split(',')
        .map(|p| p.trim().to_owned())
        .filter(|p| !p.is_empty())
        .collect()
}

/// The code applying a set of `area` needs on top of `apply`, if any.
pub(crate) const fn apply_area_permission(area: Area) -> Option<&'static str> {
    match area {
        Area::FlowSwitches => Some(permissions::flows::PUBLISH),
        // Switching a hospital's country switches its regulatory rules: only
        // the hospital administrator applies it, after a second person approved.
        Area::LocaleProfile => Some(permissions::admin::locale_profile::UPDATE),
        Area::DrugInteractions | Area::CriticalValueRules => None,
    }
}

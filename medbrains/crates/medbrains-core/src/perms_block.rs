//! `PermsBlock` — the standard `_perms` field embedded on every
//! list/detail response row. Frontend hook `useResourcePerm(row)`
//! reads it directly; no extra round trip per button.
//!
//! Computed by handlers via `state.authz.bulk_check(...)` from the
//! caller's `AuthzContext` once per page.

use serde::Serialize;

#[derive(Debug, Default, Clone, Copy, Serialize)]
pub struct PermsBlock {
    pub view: bool,
    pub edit: bool,
    pub delete: bool,
    pub share: bool,
    pub approve: bool,
}

impl PermsBlock {
    /// Bypass roles see and do everything.
    #[must_use]
    pub const fn all() -> Self {
        Self {
            view: true,
            edit: true,
            delete: true,
            share: true,
            approve: true,
        }
    }

    /// Build a `PermsBlock` by querying the bulk-check map for each
    /// of the five canonical relations against `(object_type, id)`.
    /// Missing entries default to `false`.
    #[must_use]
    pub fn from_lookups(
        object_type: &str,
        id: uuid::Uuid,
        view: bool,
        edit: bool,
        delete: bool,
        share: bool,
        approve: bool,
    ) -> Self {
        let _ = (object_type, id);
        Self {
            view,
            edit,
            delete,
            share,
            approve,
        }
    }
}

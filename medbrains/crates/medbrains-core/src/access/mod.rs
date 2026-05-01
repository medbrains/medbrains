//! `access` — single source of truth for everything authorization.
//!
//! Five tables, all const, all compile-time validated:
//!
//! ```text
//!   ROLES          : &[BuiltInRole]   — 16 seeded roles + their permission grants
//!   GROUPS         : &[DefaultGroup]  — 8 seeded access groups
//!   ROLE_POLICIES  : &[RolePolicy]    — mandatory dept type, default groups, min perm set per role
//!   SCREENS        : &[ScreenDef]     — every navigable screen + its required permission
//!   REBAC_RESOURCES: &[ResourceDef]   — every Zanzibar object type + relations + permissions
//! ```
//!
//! `permissions` codes (the 660 strings) stay in `medbrains-core::permissions`
//! because handlers reference them as typed constants (`permissions::patients::LIST`).
//! A CI check (`make check-permissions-sync`) enforces parity between the
//! Rust hierarchy and `packages/types/src/permissions.ts`.
//!
//! Anything that used to live in `seed/mod.rs::BUILT_IN_ROLES` /
//! `seed/mod.rs::DEFAULT_GROUPS` now lives here. The seed code reads
//! from these tables; the manifest-API endpoint serves them to the
//! frontend; and the rebac backfill / spicedb-schema generator reads
//! `REBAC_RESOURCES`.
//!
//! Adding a new role? One change: append to `ROLES` in `roles.rs`.
//! Adding a new group? One change: append to `GROUPS` in `groups.rs`.
//! Adding a new screen? One change: append to `SCREENS` in `screens.rs`.

pub mod groups;
pub mod policies;
pub mod resources;
pub mod roles;
pub mod screens;

pub use groups::{DEFAULT_GROUPS, DefaultGroup};
pub use policies::{ROLE_POLICIES, RolePolicy};
pub use resources::{REBAC_RESOURCES, RebacRelation, ResourceDef};
pub use roles::{BUILT_IN_ROLES, BuiltInRole};
pub use screens::{SCREENS, ScreenDef};

use serde::Serialize;

/// Snapshot of the access manifest for the runtime API
/// (`GET /api/access/manifest`). The frontend caches this in Zustand
/// after login so the user-create drawer / sharing UI / role editor
/// all read from one place.
#[derive(Debug, Clone, Serialize)]
pub struct AccessManifest {
    pub roles: Vec<RoleView>,
    pub groups: Vec<GroupView>,
    pub screens: Vec<ScreenView>,
    pub policies: Vec<PolicyView>,
    pub resources: Vec<ResourceView>,
    pub permission_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct RoleView {
    pub code: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub permission_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct GroupView {
    pub code: &'static str,
    pub name: &'static str,
    pub description: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScreenView {
    pub code: &'static str,
    pub label: &'static str,
    pub route: &'static str,
    pub module: &'static str,
    pub required_permission: Option<&'static str>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PolicyView {
    pub role: &'static str,
    pub mandatory_dept_types: Vec<&'static str>,
    pub default_groups: Vec<&'static str>,
    pub allow_multiple_depts: bool,
    pub min_perm_set: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResourceView {
    pub object_type: &'static str,
    pub relations: Vec<&'static str>,
    pub permissions: Vec<&'static str>,
}

/// Build a manifest snapshot for the API. Pure compile-time data —
/// safe to call repeatedly with no DB hit.
#[must_use]
pub fn build_manifest() -> AccessManifest {
    AccessManifest {
        roles: BUILT_IN_ROLES
            .iter()
            .map(|r| RoleView {
                code: r.code,
                name: r.name,
                description: r.description,
                permission_count: r.permissions.len(),
            })
            .collect(),
        groups: DEFAULT_GROUPS
            .iter()
            .map(|g| GroupView {
                code: g.code,
                name: g.name,
                description: g.description,
            })
            .collect(),
        screens: SCREENS
            .iter()
            .map(|s| ScreenView {
                code: s.code,
                label: s.label,
                route: s.route,
                module: s.module,
                required_permission: s.required_permission,
            })
            .collect(),
        policies: ROLE_POLICIES
            .iter()
            .map(|p| PolicyView {
                role: p.role,
                mandatory_dept_types: p.mandatory_dept_types.to_vec(),
                default_groups: p.default_groups.to_vec(),
                allow_multiple_depts: p.allow_multiple_depts,
                min_perm_set: p.min_perm_set.to_vec(),
            })
            .collect(),
        resources: REBAC_RESOURCES
            .iter()
            .map(|r| ResourceView {
                object_type: r.object_type,
                relations: r.relations.iter().map(|x| x.name).collect(),
                permissions: r.permissions.to_vec(),
            })
            .collect(),
        permission_count: crate::permissions::PERMISSION_COUNT,
    }
}

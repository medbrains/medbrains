//! `medbrains-authz` — unified Zanzibar-style sharing engine.
//!
//! Layer 6 of the access stack (below JWT → typed perms → roles+access_matrix
//! → resolve formula → 7 helpers + dept scoping). Per-record fine-grained
//! grants over ~95 entity types via a single `relation_tuples` Postgres
//! table (see migration 129).
//!
//! Design choice: Postgres-native, NOT SpiceDB or OpenFGA. See RFC-INFRA-2026-002 §A.
//!
//! Trait `AuthzBackend` keeps the swap path open if scale ever demands it.

pub mod backend_pg;
pub mod backend_test;
pub mod caveat;
pub mod error;
pub mod registry;
pub mod relations;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub use error::AuthzError;
pub use relations::Relation;

/// One sharing tuple — the unit the engine reads/writes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationTuple {
    pub tuple_id: Uuid,
    pub tenant_id: Uuid,
    pub object_type: String,
    pub object_id: Uuid,
    pub relation: String,
    pub subject: Subject,
    pub caveat: Option<serde_json::Value>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub status: TupleStatus,
    pub granted_by: Uuid,
    pub granted_at: chrono::DateTime<chrono::Utc>,
    pub granted_reason: Option<String>,
    pub source: TupleSource,
    pub derived_from: Option<String>,
}

/// Subject — the principal being granted access. Five kinds.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", content = "id", rename_all = "snake_case")]
pub enum Subject {
    User(Uuid),
    Role(String),
    Department(Uuid),
    Group(Uuid),
    /// Zanzibar userset rewrite — `<object_type>:<object_id>#<relation>`.
    /// Resolves to "any user that holds <relation> on <object_type>:<object_id>".
    TupleSet(String),
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TupleStatus {
    Active,
    Revoked,
    Superseded,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TupleSource {
    /// Operator-issued grant via the share API.
    Explicit,
    /// Auto-emitted by a DB trigger on an existing assignment column
    /// (e.g. `encounters.attending_physician_id`).
    Derived,
}

/// The context we evaluate against — pulled from JWT claims at request scope.
/// Bypass roles short-circuit before the backend is even called.
#[derive(Debug, Clone)]
pub struct AuthzContext {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub department_ids: Vec<Uuid>,
    pub is_bypass: bool,
}

/// Backend trait — Postgres in production, in-memory in tests.
#[async_trait]
pub trait AuthzBackend: Send + Sync {
    /// "Does subject hold relation on object?" — the hot path.
    /// Caller passes the AuthzContext from JWT + the target object.
    async fn check(
        &self,
        ctx: &AuthzContext,
        relation: Relation,
        object_type: &str,
        object_id: Uuid,
    ) -> Result<bool, AuthzError>;

    /// "List subjects who hold any relation on this object." — for share UI.
    async fn expand(
        &self,
        ctx: &AuthzContext,
        object_type: &str,
        object_id: Uuid,
    ) -> Result<Vec<RelationTuple>, AuthzError>;

    /// "List objects of a type the user can reach." — for filtered list views.
    async fn list_accessible(
        &self,
        ctx: &AuthzContext,
        object_type: &str,
        relation: Relation,
    ) -> Result<Vec<Uuid>, AuthzError>;

    /// Write a new explicit tuple. Source = `explicit`.
    async fn write_tuple(
        &self,
        ctx: &AuthzContext,
        object_type: &str,
        object_id: Uuid,
        relation: Relation,
        subject: Subject,
        expires_at: Option<chrono::DateTime<chrono::Utc>>,
        reason: Option<String>,
    ) -> Result<Uuid, AuthzError>;

    /// Revoke a tuple by id (soft delete: status='revoked', audit-friendly).
    async fn revoke_tuple(
        &self,
        ctx: &AuthzContext,
        tuple_id: Uuid,
    ) -> Result<(), AuthzError>;
}

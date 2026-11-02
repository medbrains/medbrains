//! Who a verified token says is calling. Plain data: verifying the token and
//! reading it from a request are the web layer's job, above the kernel.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// JWT claims embedded in every authenticated request.
///
/// `permissions` is **NOT** part of the wire JWT — that field is
/// populated post-decode by the auth middleware via a lookup keyed on
/// `(role, perm_version)`. Inlining 100+ permission codes inflated the
/// access-token cookie past Chrome's 4 KB cap.
///
/// `#[serde(skip_serializing, default)]` keeps the field out of the
/// JWT payload but lets the rest of the codebase keep reading
/// `claims.permissions` unchanged.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: Uuid,
    pub tenant_id: Uuid,
    pub role: String,
    #[serde(skip_serializing, default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub department_ids: Vec<Uuid>,
    #[serde(default)]
    pub perm_version: i32,
    /// Set when this token was issued to a paired device rather than to a
    /// person at a browser.
    ///
    /// A device token is not the same kind of credential as a session cookie.
    /// It lives for weeks on hardware that gets lost, lent and stolen, so it
    /// carries the device it was minted for and every request re-checks that
    /// the device is still one this tenant admits. Without that, revoking a
    /// lost tablet changes a row and nothing else.
    ///
    /// Absent on every user token, and absent from tokens minted before this
    /// existed — which is why it is optional rather than a breaking claim.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paired_device_id: Option<Uuid>,
    /// Set when the request is made by an AI agent on the user's behalf
    /// (RFC 8693 `act`). Authorization still evaluates as `sub` — every
    /// permission, `ReBAC` and RLS rule is the user's, so the agent can never
    /// exceed them — but every audit and access row written for the request
    /// records the agent too (RFC-AUTHZ-2026-001 §2A.5). Only minted
    /// in-process by the assistant's tools; absent on every token a person
    /// holds.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub act: Option<ActingAgent>,
    pub exp: usize,
}

/// What kind of non-human actor is acting for the user.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActorKind {
    AiAgent,
}

/// The actor half of a delegated request: which agent, which model, which run.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ActingAgent {
    pub kind: ActorKind,
    /// Stable agent name, set by the assistant that minted the token.
    pub agent: String,
    pub model: String,
    /// One assistant turn.
    pub run_id: Uuid,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conversation_id: Option<Uuid>,
}

impl ActingAgent {
    /// The JSON stored in `audit_log.acting_agent` / `access_log.acting_agent`.
    #[must_use]
    pub fn to_audit_json(&self) -> serde_json::Value {
        serde_json::to_value(self).unwrap_or(serde_json::Value::Null)
    }
}

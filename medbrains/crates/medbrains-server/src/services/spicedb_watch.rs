//! SpiceDB Watch API → BridgePusher pipeline.
//!
//! Tails the SpiceDB `WatchService.Watch` stream, converts each
//! relationship update into a list of [`InvalidationKey`]s, and hands
//! them to a [`BridgePusher`] for fan-out to per-tenant edge nodes.
//!
//! Phase 9. The actual gRPC stream consumption is wired in `main.rs`
//! against `medbrains_authz::SpiceDbBackend`. This module focuses on
//! the translation layer (Watch event → InvalidationKey) — that's
//! the part that needs unit-testable correctness, and it's what
//! changes if SpiceDB ever ships a new event shape.

use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use super::bridge_pusher::{BridgePusher, InvalidationKey};

/// Subset of `authzed.api.v1.RelationshipUpdate` we consume. Any
/// relation change (TOUCH/CREATE/DELETE) is treated identically:
/// the cached decisions for the affected (object, subject) pair are
/// invalidated.
#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct WatchedUpdate {
    pub operation: WatchedOperation,
    pub relationship: WatchedRelationship,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum WatchedOperation {
    Touch,
    Create,
    Delete,
    /// Defensive fallback for unknown values from a future SpiceDB
    /// release — we still invalidate.
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct WatchedRelationship {
    pub resource: WatchedObject,
    pub relation: String,
    pub subject:  WatchedSubject,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct WatchedObject {
    pub object_type: String,
    pub object_id:   String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct WatchedSubject {
    pub object: WatchedObject,
    /// Optional sub-relation (e.g., `team#member`). Ignored at this
    /// layer — the cache key only carries the principal.
    #[serde(default)]
    pub optional_relation: String,
}

/// Convert one Watch event into a flat list of cache keys to drop.
///
/// SpiceDB models permissions as `(object) relation (subject)`. Our
/// cache keys are flat: `(tenant_id, user_id, object_type, object_id,
/// action)`. The mapping rule:
///
/// 1. The subject must be a `user:<uuid>` reference. Group / role /
///    team subjects have no direct cache representation — they fan
///    out at the cloud's check-time, so a relationship change on a
///    group member affects every user in that group transitively.
///    For the MVP we ignore non-user subjects and rely on the cache
///    TTL to age them out. This is documented as a known limitation.
/// 2. The action is the SpiceDB relation name. The edge cache stores
///    one entry per (object, action) pair, so we emit one
///    InvalidationKey for the relation that changed.
/// 3. The tenant id is parsed off the resource's tenant prefix if
///    present (`<tenant_uuid>/<obj_type>:<obj_id>`); otherwise we
///    use a configured default tenant. SpiceDB doesn't enforce a
///    namespace prefix natively — we use a convention.
pub fn updates_to_keys(
    updates: &[WatchedUpdate],
    default_tenant: Uuid,
) -> Vec<InvalidationKey> {
    let mut out = Vec::with_capacity(updates.len());
    for upd in updates {
        let Some(user_id) = parse_user_subject(&upd.relationship.subject) else {
            continue;
        };
        let (tenant_id, object_type) =
            parse_resource_namespace(&upd.relationship.resource.object_type, default_tenant);
        out.push(InvalidationKey {
            tenant_id,
            user_id,
            object_type,
            object_id: upd.relationship.resource.object_id.clone(),
            action: upd.relationship.relation.clone(),
        });
    }
    out
}

fn parse_user_subject(subject: &WatchedSubject) -> Option<Uuid> {
    if subject.object.object_type != "user" {
        return None;
    }
    Uuid::parse_str(&subject.object.object_id).ok()
}

/// Resource object_types may be prefixed with `tenant_<uuid>/` to
/// scope them; if not, fall back to `default_tenant`. Splitting on
/// the first `/` is sufficient — the tail is the actual object_type
/// the schema declared.
fn parse_resource_namespace(raw: &str, default_tenant: Uuid) -> (Uuid, String) {
    if let Some((prefix, rest)) = raw.split_once('/') {
        if let Some(uuid_str) = prefix.strip_prefix("tenant_") {
            if let Ok(t) = Uuid::parse_str(uuid_str) {
                return (t, rest.to_owned());
            }
        }
    }
    (default_tenant, raw.to_owned())
}

/// Wraps a [`BridgePusher`] + a configured default tenant. The
/// `process_batch()` method is the single entry point streaming
/// callers use.
#[derive(Clone)]
pub struct SpiceDbWatchHandler {
    pusher: BridgePusher,
    default_tenant: Uuid,
}

impl std::fmt::Debug for SpiceDbWatchHandler {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SpiceDbWatchHandler")
            .field("default_tenant", &self.default_tenant)
            .finish()
    }
}

impl SpiceDbWatchHandler {
    pub fn new(pusher: BridgePusher, default_tenant: Uuid) -> Self {
        Self { pusher, default_tenant }
    }

    pub fn pusher(&self) -> &BridgePusher {
        &self.pusher
    }

    pub async fn process_batch(&self, updates: Vec<WatchedUpdate>) -> super::bridge_pusher::PushOutcome {
        let keys = updates_to_keys(&updates, self.default_tenant);
        self.pusher.push_invalidate(keys).await
    }
}

/// Convenience for the main.rs wire-up: packages `pusher` and
/// `handler` together so the gRPC stream-consuming task can be a
/// short closure.
pub fn build(default_tenant: Uuid) -> (BridgePusher, Arc<SpiceDbWatchHandler>) {
    let pusher = BridgePusher::new();
    let handler = Arc::new(SpiceDbWatchHandler::new(pusher.clone(), default_tenant));
    (pusher, handler)
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
mod tests {
    use super::*;

    fn user_update(action: &str, user_id: Uuid, tenant_prefix: Option<Uuid>) -> WatchedUpdate {
        let object_type = match tenant_prefix {
            Some(t) => format!("tenant_{t}/patient"),
            None => "patient".to_owned(),
        };
        WatchedUpdate {
            operation: WatchedOperation::Touch,
            relationship: WatchedRelationship {
                resource: WatchedObject { object_type, object_id: "p1".into() },
                relation: action.to_owned(),
                subject: WatchedSubject {
                    object: WatchedObject {
                        object_type: "user".into(),
                        object_id: user_id.to_string(),
                    },
                    optional_relation: String::new(),
                },
            },
        }
    }

    #[test]
    fn user_subject_with_tenant_prefix() {
        let user = Uuid::new_v4();
        let tenant = Uuid::new_v4();
        let default_tenant = Uuid::new_v4();
        let keys = updates_to_keys(&[user_update("read", user, Some(tenant))], default_tenant);
        assert_eq!(keys.len(), 1);
        assert_eq!(keys[0].tenant_id, tenant);
        assert_eq!(keys[0].user_id, user);
        assert_eq!(keys[0].object_type, "patient");
        assert_eq!(keys[0].action, "read");
    }

    #[test]
    fn no_prefix_falls_back_to_default_tenant() {
        let user = Uuid::new_v4();
        let default_tenant = Uuid::new_v4();
        let keys = updates_to_keys(&[user_update("write", user, None)], default_tenant);
        assert_eq!(keys.len(), 1);
        assert_eq!(keys[0].tenant_id, default_tenant);
        assert_eq!(keys[0].object_type, "patient");
    }

    #[test]
    fn group_subject_is_skipped_until_walk() {
        let default_tenant = Uuid::new_v4();
        let upd = WatchedUpdate {
            operation: WatchedOperation::Create,
            relationship: WatchedRelationship {
                resource: WatchedObject { object_type: "patient".into(), object_id: "p1".into() },
                relation: "viewer".into(),
                subject: WatchedSubject {
                    object: WatchedObject {
                        object_type: "team".into(),
                        object_id: "cardiology".into(),
                    },
                    optional_relation: "member".into(),
                },
            },
        };
        let keys = updates_to_keys(&[upd], default_tenant);
        assert!(keys.is_empty(), "non-user subjects must be skipped (covered by TTL aging)");
    }

    #[test]
    fn delete_op_still_emits_invalidation() {
        let user = Uuid::new_v4();
        let default_tenant = Uuid::new_v4();
        let mut upd = user_update("read", user, None);
        upd.operation = WatchedOperation::Delete;
        let keys = updates_to_keys(&[upd], default_tenant);
        assert_eq!(keys.len(), 1, "DELETE must still invalidate the cached entry");
    }

    #[test]
    fn unknown_operation_still_emits() {
        // Defensive: a future SpiceDB op shape lands as Unknown but
        // we still invalidate.
        let user = Uuid::new_v4();
        let default_tenant = Uuid::new_v4();
        let mut upd = user_update("read", user, None);
        upd.operation = WatchedOperation::Unknown;
        let keys = updates_to_keys(&[upd], default_tenant);
        assert_eq!(keys.len(), 1);
    }

    #[test]
    fn invalid_user_uuid_skipped() {
        let default_tenant = Uuid::new_v4();
        let upd = WatchedUpdate {
            operation: WatchedOperation::Touch,
            relationship: WatchedRelationship {
                resource: WatchedObject { object_type: "patient".into(), object_id: "p1".into() },
                relation: "read".into(),
                subject: WatchedSubject {
                    object: WatchedObject { object_type: "user".into(), object_id: "not-a-uuid".into() },
                    optional_relation: String::new(),
                },
            },
        };
        let keys = updates_to_keys(&[upd], default_tenant);
        assert!(keys.is_empty());
    }

    #[tokio::test]
    async fn handler_routes_through_pusher() {
        let user = Uuid::new_v4();
        let tenant = Uuid::new_v4();
        let (pusher, handler) = build(Uuid::new_v4());

        // No sink registered for this tenant — outcome should record
        // it as `unknown_tenants` not `failed_tenants`.
        let outcome = handler
            .process_batch(vec![user_update("read", user, Some(tenant))])
            .await;
        assert_eq!(outcome.unknown_tenants, 1);
        assert_eq!(outcome.delivered_tenants, 0);
        let _ = pusher; // pusher kept alive by handler clone
    }
}

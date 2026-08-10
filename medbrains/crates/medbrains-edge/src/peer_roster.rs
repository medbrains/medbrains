//! The set of peers a device may talk to while it cannot reach the server.
//!
//! Allowing devices to dial each other makes every device a server, and a
//! server has to decide who may connect. On the edge box that decision is a
//! database lookup. On a phone in a field tent there is no database and no
//! network — which is precisely when peer-to-peer sync is worth having.
//!
//! So the roster is cached, the way [`AuthzCache`](crate::AuthzCache) caches
//! authorisation: the server issues the list of admitted peers for a tenant,
//! the device keeps it, and it expires. The rules below are the ones that keep
//! a cache from becoming a way to grant access the server never gave.
//!
//! Two properties matter more than convenience:
//!
//! * **It can only narrow, never widen.** A device may refuse a peer the server
//!   admitted; it may never admit one the server did not.
//! * **It expires closed.** A stale roster admits nobody. A lost tablet revoked
//!   on Monday must not still be admitted by a phone that has been offline
//!   since Sunday — beyond the staleness window, the device stops trusting its
//!   own list rather than trusting it forever.

use std::collections::HashMap;

use uuid::Uuid;

use crate::peer_admission::{Admission, PeerBinding, RefusalReason, admit};

/// How long a roster may be trusted without a refresh.
///
/// A camp day is the unit here: long enough to cover a shift with no signal,
/// short enough that a revocation issued in the morning takes effect by the
/// next. Beyond it the device refuses peers rather than guessing.
pub const ROSTER_MAX_AGE_SECONDS: i64 = 16 * 60 * 60;

#[derive(Debug, Clone)]
pub struct PeerRoster {
    tenant_id: Uuid,
    /// Issued by the server, in epoch seconds.
    issued_at: i64,
    by_node_id: HashMap<String, PeerBinding>,
}

impl PeerRoster {
    pub fn new(tenant_id: Uuid, issued_at: i64, peers: Vec<(String, PeerBinding)>) -> Self {
        Self {
            tenant_id,
            issued_at,
            by_node_id: peers.into_iter().collect(),
        }
    }

    pub const fn tenant_id(&self) -> Uuid {
        self.tenant_id
    }

    /// Seconds since the server issued this roster.
    ///
    /// Clamped at zero: a device whose clock is ahead of the server's must not
    /// compute a negative age and conclude its roster is fresher than new.
    pub const fn age_seconds(&self, now: i64) -> i64 {
        let age = now - self.issued_at;
        if age < 0 { 0 } else { age }
    }

    pub const fn is_stale(&self, now: i64) -> bool {
        self.age_seconds(now) > ROSTER_MAX_AGE_SECONDS
    }

    pub fn len(&self) -> usize {
        self.by_node_id.len()
    }

    pub fn is_empty(&self) -> bool {
        self.by_node_id.is_empty()
    }

    /// Decide whether a dialling peer may open a session.
    ///
    /// Delegates to [`admit`] once the roster itself is trusted, so a peer faces
    /// exactly the same checks on a phone as on the edge box. A second, laxer
    /// copy of that rule is how the two ends drift apart.
    pub fn admit_peer(&self, node_id: &str, claimed_tenant: Uuid, now: i64) -> Admission {
        if self.is_stale(now) {
            // Fail closed. An expired roster is not evidence of anything.
            return Admission::Refuse(RefusalReason::NotPaired);
        }
        if claimed_tenant != self.tenant_id {
            return Admission::Refuse(RefusalReason::TenantMismatch);
        }
        admit(self.by_node_id.get(node_id), claimed_tenant)
    }
}

#[cfg(test)]
#[allow(clippy::expect_used, clippy::unwrap_used)]
mod tests {
    use super::*;

    const NOW: i64 = 1_800_000_000;

    fn binding(tenant: Uuid, status: &str, revoked: bool) -> PeerBinding {
        PeerBinding {
            device_instance_id: Uuid::new_v4(),
            tenant_id: tenant,
            device_status: status.to_owned(),
            revoked,
        }
    }

    fn roster(tenant: Uuid, issued_at: i64) -> PeerRoster {
        PeerRoster::new(
            tenant,
            issued_at,
            vec![
                ("peer-active".to_owned(), binding(tenant, "active", false)),
                ("peer-revoked".to_owned(), binding(tenant, "active", true)),
                (
                    "peer-retired".to_owned(),
                    binding(tenant, "decommissioned", false),
                ),
            ],
        )
    }

    #[test]
    fn a_fresh_roster_admits_an_active_peer() {
        let tenant = Uuid::new_v4();
        let r = roster(tenant, NOW);
        assert!(matches!(
            r.admit_peer("peer-active", tenant, NOW),
            Admission::Admit { .. }
        ));
    }

    #[test]
    fn an_unknown_peer_is_refused_even_on_a_fresh_roster() {
        let tenant = Uuid::new_v4();
        assert_eq!(
            roster(tenant, NOW).admit_peer("stranger", tenant, NOW),
            Admission::Refuse(RefusalReason::NotPaired)
        );
    }

    #[test]
    fn a_revoked_peer_stays_refused_offline() {
        // The roster carries revocation, so a lost tablet is refused by peers
        // that cannot reach the server to ask.
        let tenant = Uuid::new_v4();
        assert_eq!(
            roster(tenant, NOW).admit_peer("peer-revoked", tenant, NOW),
            Admission::Refuse(RefusalReason::Revoked)
        );
    }

    #[test]
    fn a_stale_roster_admits_nobody() {
        // The property that stops a cache becoming a permanent grant. A device
        // offline since Sunday must not still admit a peer revoked on Monday.
        let tenant = Uuid::new_v4();
        let old = roster(tenant, NOW - ROSTER_MAX_AGE_SECONDS - 1);
        assert_eq!(
            old.admit_peer("peer-active", tenant, NOW),
            Admission::Refuse(RefusalReason::NotPaired),
            "an expired roster is not evidence of anything"
        );
    }

    #[test]
    fn a_roster_exactly_at_the_limit_is_still_trusted() {
        // The boundary is inclusive so a device does not lose sync one second
        // early, mid-shift, for no reason it can explain.
        let tenant = Uuid::new_v4();
        let edge = roster(tenant, NOW - ROSTER_MAX_AGE_SECONDS);
        assert!(matches!(
            edge.admit_peer("peer-active", tenant, NOW),
            Admission::Admit { .. }
        ));
    }

    #[test]
    fn a_clock_ahead_of_the_server_does_not_read_as_fresher_than_new() {
        // A device whose clock is wrong must not compute a negative age and
        // conclude its roster can never expire.
        let tenant = Uuid::new_v4();
        let r = roster(tenant, NOW + 10_000);
        assert_eq!(r.age_seconds(NOW), 0);
        assert!(!r.is_stale(NOW));
    }

    #[test]
    fn a_peer_from_another_tenant_is_refused() {
        let tenant = Uuid::new_v4();
        assert_eq!(
            roster(tenant, NOW).admit_peer("peer-active", Uuid::new_v4(), NOW),
            Admission::Refuse(RefusalReason::TenantMismatch)
        );
    }

    #[test]
    fn an_empty_roster_admits_nobody_rather_than_everybody() {
        // The fail-open shape of this mistake is catastrophic, so it is pinned.
        let tenant = Uuid::new_v4();
        let empty = PeerRoster::new(tenant, NOW, vec![]);
        assert!(empty.is_empty());
        assert_eq!(
            empty.admit_peer("peer-active", tenant, NOW),
            Admission::Refuse(RefusalReason::NotPaired)
        );
    }

    #[test]
    fn the_roster_cannot_widen_what_the_server_granted() {
        // A device may refuse a peer the server admitted; it may never admit
        // one the server did not. Everything not in the list is refused, and
        // the per-peer checks are the same ones the edge applies.
        let tenant = Uuid::new_v4();
        let r = roster(tenant, NOW);
        for node in ["peer-revoked", "peer-retired", "not-in-list"] {
            assert!(
                matches!(r.admit_peer(node, tenant, NOW), Admission::Refuse(_)),
                "{node} must not be admitted"
            );
        }
    }
}

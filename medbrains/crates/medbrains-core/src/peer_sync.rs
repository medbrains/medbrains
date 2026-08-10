//! The roster a node uses to admit peers while it cannot reach the server.
//!
//! An edge appliance and a phone both face the same question — may this key
//! open a sync session? — and both have to answer it offline. Neither carries a
//! database, so the server issues them a signed-off list of the keys it has
//! paired and they decide locally against that.
//!
//! These types live here rather than in either consumer because both ends must
//! read exactly the same shape. A roster the server writes and a roster the
//! device parses that have drifted apart is a device admitting peers the
//! hospital retired.
//!
//! What the roster deliberately does **not** contain is a decision. It carries
//! the same facts the database holds — which device, which tenant, what status
//! — and the admission rule is applied to them in one place. Shipping
//! pre-computed verdicts would put a second, quieter copy of that rule on every
//! device.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// What the store knows about a node key that presented itself.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PeerBinding {
    pub device_instance_id: Uuid,
    pub tenant_id: Uuid,
    /// `device_instances.status` as text.
    pub device_status: String,
    pub revoked: bool,
}

/// One entry as it travels: the key, and what it is bound to.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PeerRosterEntry {
    pub node_id: String,
    #[serde(flatten)]
    pub binding: PeerBinding,
}

/// A tenant's paired peers as of `issued_at`.
///
/// `issued_at` is the whole security story of this document. A roster carries
/// no expiry of its own because the holder decides how stale is too stale — an
/// edge box on hospital wifi refreshes constantly, a phone at a camp may not
/// for a day — and a document that declared its own lifetime would let a
/// captured one argue for a longer one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PeerRosterDoc {
    pub tenant_id: Uuid,
    /// Epoch seconds, from the server's clock.
    pub issued_at: i64,
    pub peers: Vec<PeerRosterEntry>,
}

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::{PeerBinding, PeerRosterDoc, PeerRosterEntry};
    use uuid::Uuid;

    /// The server writes this document and devices parse it. If the two ever
    /// disagree about its shape, a device stops admitting peers the hospital
    /// paired — or worse, keeps admitting ones it retired. Pinning the exact
    /// wire form is the cheapest way to notice.
    #[test]
    fn the_wire_shape_survives_a_round_trip() {
        let tenant = Uuid::new_v4();
        let doc = PeerRosterDoc {
            tenant_id: tenant,
            issued_at: 1_800_000_000,
            peers: vec![PeerRosterEntry {
                node_id: "abc123".to_owned(),
                binding: PeerBinding {
                    device_instance_id: Uuid::new_v4(),
                    tenant_id: tenant,
                    device_status: "active".to_owned(),
                    revoked: false,
                },
            }],
        };

        let json = serde_json::to_value(&doc).expect("serialise");
        // `flatten` is easy to get wrong in a way nothing else notices: the
        // binding's fields must sit beside `node_id`, not nested under it.
        let peer = &json["peers"][0];
        assert_eq!(peer["node_id"], "abc123");
        assert_eq!(peer["device_status"], "active");
        assert!(peer.get("binding").is_none(), "binding must be flattened");

        let back: PeerRosterDoc = serde_json::from_value(json).expect("deserialise");
        assert_eq!(back, doc);
    }

    /// A roster with no peers is the state a freshly provisioned hospital is in,
    /// and it must parse rather than fail — a node that cannot read its roster
    /// falls back to admitting nobody for the wrong reason.
    #[test]
    fn an_empty_roster_is_a_valid_roster() {
        let json = serde_json::json!({
            "tenant_id": Uuid::nil(),
            "issued_at": 0,
            "peers": [],
        });
        let doc: PeerRosterDoc = serde_json::from_value(json).expect("deserialise");
        assert!(doc.peers.is_empty());
    }
}

//! Deciding whether a peer may speak the sync protocol.
//!
//! A peer-to-peer transport hands you a public key and tells you the far end
//! holds the matching private key. That is all it tells you. It does not say the
//! device is one this hospital admitted, that it is still in service, or which
//! tenant's data it may touch.
//!
//! Treating "cryptographically valid" as "authorised" is how a transport
//! quietly becomes an authorisation system. This module keeps them apart: the
//! transport proves possession of a key, and admission is decided here against
//! a device the hospital paired and can revoke.
//!
//! Pure on purpose — no I/O — so the rule can be tested exhaustively and read
//! in one sitting. The caller does the lookup; this decides what it means.

use uuid::Uuid;

use crate::sync::Frame;

/// What the store knows about a node key that presented itself.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PeerBinding {
    pub device_instance_id: Uuid,
    pub tenant_id: Uuid,
    /// `device_instances.status` as text.
    pub device_status: String,
    pub revoked: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Admission {
    /// Admitted, and every frame is scoped to this tenant.
    Admit {
        tenant_id: Uuid,
        device_id: Uuid,
    },
    Refuse(RefusalReason),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RefusalReason {
    /// The key is valid and belongs to nobody we know.
    NotPaired,
    /// The key was bound and has since been retired.
    Revoked,
    /// The device is paired but not in service.
    DeviceNotActive,
    /// The peer claims a tenant its device does not belong to.
    TenantMismatch,
}

/// Statuses in which a device may sync.
///
/// Only `active`. A device that is `degraded`, `maintenance`, `disconnected` or
/// `decommissioned` is one somebody has said something about, and a decommissioned
/// tablet that turns up on the network is the exact case this exists to stop.
/// `pending_setup`, `configuring` and `testing` are also refused: a device still
/// being provisioned should not be exchanging patient records.
fn is_in_service(status: &str) -> bool {
    status == "active"
}

/// Decide whether a peer may open a session.
///
/// `claimed_tenant` is what the peer says in its `Hello`. It is checked against
/// the binding rather than trusted, because a paired device presenting another
/// tenant's id is either misconfigured or probing.
pub fn admit(binding: Option<&PeerBinding>, claimed_tenant: Uuid) -> Admission {
    let Some(binding) = binding else {
        return Admission::Refuse(RefusalReason::NotPaired);
    };
    if binding.revoked {
        return Admission::Refuse(RefusalReason::Revoked);
    }
    if !is_in_service(&binding.device_status) {
        return Admission::Refuse(RefusalReason::DeviceNotActive);
    }
    if binding.tenant_id != claimed_tenant {
        return Admission::Refuse(RefusalReason::TenantMismatch);
    }
    Admission::Admit {
        tenant_id: binding.tenant_id,
        device_id: binding.device_instance_id,
    }
}

/// What a refused peer is told.
///
/// Deliberately the same sentence for every reason. A peer probing for access
/// learns whether a key is unknown, retired or merely out of service if the
/// messages differ, and that difference is enough to map a hospital's fleet.
/// The specific reason goes to the operator's log, not down the wire.
pub const fn refusal_message() -> &'static str {
    "this device is not admitted for sync"
}

/// Whether a handshake names a tenant other than the one the peer was admitted
/// for.
///
/// Admission establishes which device is calling and, from its binding, which
/// hospital it belongs to. The handshake then states a tenant again — and a
/// device whose key is bound to one hospital must not reach another's records
/// by naming it. Only `Hello` carries a tenant; every later frame is scoped by
/// the session that handshake opened.
pub fn names_other_tenant(frame: &Frame, admitted: Uuid) -> bool {
    matches!(frame, Frame::Hello { tenant_id, .. } if *tenant_id != admitted)
}

#[cfg(test)]
#[allow(clippy::expect_used, clippy::unwrap_used)]
mod tests {
    use super::*;

    fn binding(status: &str, tenant: Uuid) -> PeerBinding {
        PeerBinding {
            device_instance_id: Uuid::new_v4(),
            tenant_id: tenant,
            device_status: status.to_owned(),
            revoked: false,
        }
    }

    #[test]
    fn an_unknown_key_is_refused() {
        // Cryptographically valid and completely unknown. This is the default
        // case for anyone who can reach the transport at all.
        assert_eq!(
            admit(None, Uuid::new_v4()),
            Admission::Refuse(RefusalReason::NotPaired)
        );
    }

    #[test]
    fn an_active_paired_device_is_admitted() {
        let tenant = Uuid::new_v4();
        let b = binding("active", tenant);
        assert_eq!(
            admit(Some(&b), tenant),
            Admission::Admit {
                tenant_id: tenant,
                device_id: b.device_instance_id
            }
        );
    }

    #[test]
    fn a_revoked_key_is_refused_even_while_the_device_is_active() {
        // Revocation is the emergency stop: a lost tablet is revoked long
        // before anyone gets round to changing its status.
        let tenant = Uuid::new_v4();
        let mut b = binding("active", tenant);
        b.revoked = true;
        assert_eq!(
            admit(Some(&b), tenant),
            Admission::Refuse(RefusalReason::Revoked)
        );
    }

    #[test]
    fn a_decommissioned_device_is_refused() {
        // The case this exists for: a retired tablet that reappears on the
        // network still holding a valid key.
        let tenant = Uuid::new_v4();
        assert_eq!(
            admit(Some(&binding("decommissioned", tenant)), tenant),
            Admission::Refuse(RefusalReason::DeviceNotActive)
        );
    }

    #[test]
    fn a_device_still_being_provisioned_is_refused() {
        let tenant = Uuid::new_v4();
        for status in ["pending_setup", "configuring", "testing"] {
            assert_eq!(
                admit(Some(&binding(status, tenant)), tenant),
                Admission::Refuse(RefusalReason::DeviceNotActive),
                "{status} must not exchange patient records"
            );
        }
    }

    #[test]
    fn a_device_out_of_service_is_refused() {
        let tenant = Uuid::new_v4();
        for status in ["degraded", "disconnected", "maintenance"] {
            assert_eq!(
                admit(Some(&binding(status, tenant)), tenant),
                Admission::Refuse(RefusalReason::DeviceNotActive),
                "{status} is a device somebody has said something about"
            );
        }
    }

    #[test]
    fn a_paired_device_cannot_claim_another_tenant() {
        // The cross-tenant probe. The key is real and the device is in service;
        // it simply does not belong to the tenant whose data it asked for.
        let b = binding("active", Uuid::new_v4());
        assert_eq!(
            admit(Some(&b), Uuid::new_v4()),
            Admission::Refuse(RefusalReason::TenantMismatch)
        );
    }

    #[test]
    fn an_unknown_status_is_refused_rather_than_allowed() {
        // Fail closed. A status added later must not be admitted by default
        // just because this code has not been taught about it.
        let tenant = Uuid::new_v4();
        assert_eq!(
            admit(Some(&binding("some_future_status", tenant)), tenant),
            Admission::Refuse(RefusalReason::DeviceNotActive)
        );
    }

    #[test]
    fn every_refusal_says_the_same_thing_on_the_wire() {
        // Differing messages would let a prober tell an unknown key from a
        // revoked one, which is enough to map a hospital's fleet.
        assert_eq!(refusal_message(), "this device is not admitted for sync");
    }

    /// The hole this closes: admission proves *which* device is calling, but
    /// the handshake states a tenant again. Without this, a device paired to
    /// one hospital could open a session against another simply by naming it.
    #[test]
    fn a_handshake_may_not_name_a_tenant_the_peer_is_not_admitted_for() {
        let admitted = Uuid::new_v4();
        let somebody_else = Uuid::new_v4();

        let honest = Frame::Hello {
            protocol: crate::PROTOCOL_VERSION,
            device_id: Uuid::new_v4(),
            tenant_id: admitted,
        };
        assert!(!names_other_tenant(&honest, admitted));

        let crossing = Frame::Hello {
            protocol: crate::PROTOCOL_VERSION,
            device_id: Uuid::new_v4(),
            tenant_id: somebody_else,
        };
        assert!(names_other_tenant(&crossing, admitted));
    }

    /// Only the handshake carries a tenant. Later frames are scoped by the
    /// session, so treating them as tenant claims would refuse honest traffic.
    #[test]
    fn a_later_frame_carries_no_tenant_claim() {
        let admitted = Uuid::new_v4();
        let push = Frame::Push {
            doc_id: "d".to_owned(),
            update_b64: String::new(),
        };
        assert!(!names_other_tenant(&push, admitted));
    }
}

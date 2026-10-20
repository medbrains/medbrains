//! Who may collect which lane (#4885).
//!
//! A lane is the department a charge is collected by. A desk holds the
//! `billing.collect.<lane>` codes for its own lanes; the central cashier
//! holds `billing.collect.cross` and collects every lane. A bill may carry
//! several lanes (a visit's shared bill: registration + consultation); the
//! caller must hold every one of them.

use medbrains_core::permissions::billing::collect;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::is_bypass_role;

/// The seven lanes and the code that collects each.
pub const LANES: [(&str, &str); 7] = [
    ("registration", collect::REGISTRATION),
    ("opd", collect::OPD),
    ("lab", collect::LAB),
    ("radiology", collect::RADIOLOGY),
    ("emergency", collect::EMERGENCY),
    ("ipd", collect::IPD),
    ("pharmacy", collect::PHARMACY),
];

/// Every code that lets a caller collect anything.
pub const ANY_COLLECT: [&str; 8] = [
    collect::REGISTRATION,
    collect::OPD,
    collect::LAB,
    collect::RADIOLOGY,
    collect::EMERGENCY,
    collect::IPD,
    collect::PHARMACY,
    collect::CROSS,
];

/// Whether `lane` is one of the seven.
#[must_use]
pub fn is_lane(lane: &str) -> bool {
    LANES.iter().any(|(name, _)| *name == lane)
}

/// Permission membership on the caller's own token — a set lookup, never a
/// fault, so there is no third outcome to keep.
fn holds(claims: &Claims, code: &str) -> bool {
    claims.permissions.iter().any(|p| p == code)
}

/// Whether the caller collects every lane.
#[must_use]
pub fn collects_all(claims: &Claims) -> bool {
    is_bypass_role(claims) || holds(claims, collect::CROSS)
}

/// Whether the caller may collect `lane`.
#[must_use]
pub fn may_collect_lane(claims: &Claims, lane: &str) -> bool {
    collects_all(claims)
        || LANES
            .iter()
            .any(|(name, code)| *name == lane && holds(claims, code))
}

/// Whether the caller may collect a bill carrying `lanes`.
#[must_use]
pub fn may_collect_bill(claims: &Claims, lanes: &[String]) -> bool {
    lanes.iter().all(|lane| may_collect_lane(claims, lane))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn claims(role: &str, permissions: &[&str]) -> Claims {
        Claims {
            sub: uuid::Uuid::nil(),
            tenant_id: uuid::Uuid::nil(),
            role: role.to_owned(),
            permissions: permissions.iter().map(|p| (*p).to_owned()).collect(),
            department_ids: Vec::new(),
            perm_version: 0,
            paired_device_id: None,
            exp: 0,
        }
    }

    #[test]
    fn a_lab_desk_collects_lab_bills_only() {
        let lab = claims("lab_technician", &[collect::LAB]);
        assert!(may_collect_bill(&lab, &["lab".to_owned()]));
        assert!(!may_collect_bill(&lab, &["pharmacy".to_owned()]));
        assert!(!may_collect_bill(
            &lab,
            &["lab".to_owned(), "opd".to_owned()]
        ));
    }

    #[test]
    fn cross_and_bypass_collect_every_lane() {
        let cashier = claims("billing_clerk", &[collect::CROSS]);
        let admin = claims("hospital_admin", &[]);
        for (lane, _) in LANES {
            assert!(may_collect_lane(&cashier, lane));
            assert!(may_collect_lane(&admin, lane));
        }
        assert!(!is_lane("together"));
    }
}

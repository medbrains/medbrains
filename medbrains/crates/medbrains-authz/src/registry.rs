//! Entity registry — declares which entity types support sharing and
//! which relations are valid per type. Phase 3 starter set; Phase 3.2
//! will populate the full ~95 entity types via `medbrains-core` exports.
//!
//! Future move: this stays a thin in-crate registry pointing at
//! `medbrains-core::sharing::registry::ENTITIES` once that module lands
//! (so all 95 `EntityShareSpec` entries are in one place with the rest of
//! the domain types).

use crate::Relation;

/// Per-entity sharing spec. Static — declared at compile time.
#[derive(Debug, Clone, Copy)]
pub struct EntityShareSpec {
    pub object_type: &'static str,
    pub allowed_relations: &'static [Relation],
    /// Parent `object_type` — sharing this object cascades viewer-tier
    /// access down to children. None = leaf object.
    pub inherits_from: Option<&'static str>,
    /// Catalog tables read by all bypass roles only — engine refuses
    /// to write tuples for these types.
    pub bypass_only: bool,
}

/// Lookup an entity by `object_type` code. Returns None if not registered.
pub fn lookup(object_type: &str) -> Option<&'static EntityShareSpec> {
    ENTITIES.iter().find(|e| e.object_type == object_type)
}

/// Phase 3 starter set. Six high-value entities the plan explicitly
/// targets for `apply_shared_visibility` rollout:
///   dashboards, forms, screens, `lab_orders`, encounters, `surgery_bookings`
/// Phase 3.2 expands to the full ~95.
pub static ENTITIES: &[EntityShareSpec] = &[
    EntityShareSpec {
        object_type: "patient",
        allowed_relations: &[
            Relation::Owner,
            Relation::Editor,
            Relation::Viewer,
            Relation::AttendingPhysician,
            Relation::Consultant,
            Relation::Nurse,
        ],
        inherits_from: None,
        bypass_only: false,
    },
    EntityShareSpec {
        object_type: "encounter",
        allowed_relations: &[
            Relation::Owner,
            Relation::Editor,
            Relation::Viewer,
            Relation::AttendingPhysician,
            Relation::Consultant,
            Relation::Nurse,
            Relation::ReferredTo,
        ],
        inherits_from: Some("patient"),
        bypass_only: false,
    },
    EntityShareSpec {
        object_type: "lab_order",
        allowed_relations: &[
            Relation::Owner,
            Relation::Editor,
            Relation::Viewer,
            Relation::Phlebotomist,
        ],
        inherits_from: Some("encounter"),
        bypass_only: false,
    },
    EntityShareSpec {
        object_type: "surgery_booking",
        allowed_relations: &[
            Relation::Owner,
            Relation::Editor,
            Relation::Viewer,
            Relation::Approver,
        ],
        inherits_from: Some("encounter"),
        bypass_only: false,
    },
    // IPD admissions link the admitting ward/department via a raw `ward_member`
    // grant (see medbrains-ipd `create_admission`). Without this entry that grant
    // fails `UnknownObjectType` and every admission 500s.
    EntityShareSpec {
        object_type: "admission",
        allowed_relations: &[
            Relation::Owner,
            Relation::Editor,
            Relation::Viewer,
            Relation::AttendingPhysician,
            Relation::Nurse,
        ],
        inherits_from: Some("encounter"),
        bypass_only: false,
    },
    EntityShareSpec {
        object_type: "dashboard",
        allowed_relations: &[Relation::Owner, Relation::Editor, Relation::Viewer],
        inherits_from: None,
        bypass_only: false,
    },
    EntityShareSpec {
        object_type: "form",
        allowed_relations: &[Relation::Owner, Relation::Editor, Relation::Viewer],
        inherits_from: None,
        bypass_only: false,
    },
    EntityShareSpec {
        object_type: "screen",
        allowed_relations: &[Relation::Owner, Relation::Editor, Relation::Viewer],
        inherits_from: None,
        bypass_only: false,
    },
    // Organisational membership containers — routes write raw `member` tuples
    // (`department:{id}#member@user`, `access_group:{id}#member@user`) to record
    // a user's department/group membership (see medbrains-setup `create_user`,
    // medbrains-ipd `dept_member` grants). Without these entries every such grant
    // fails `UnknownObjectType`; create_user swallows it best-effort, so the
    // membership tuple is silently never written (broken ReBAC), and other call
    // sites 500 (cf. the `admission` fix).
    EntityShareSpec {
        object_type: "department",
        allowed_relations: &[Relation::Owner, Relation::Editor, Relation::Viewer],
        inherits_from: None,
        bypass_only: false,
    },
    EntityShareSpec {
        object_type: "access_group",
        allowed_relations: &[Relation::Owner, Relation::Editor, Relation::Viewer],
        inherits_from: None,
        bypass_only: false,
    },
    // Object-level ReBAC `check(...)` targets in the radiology / pharmacy / billing
    // detail routes. Unregistered, `check()` returns UnknownObjectType which the
    // routes mask with `.unwrap_or(false)` — silently denying every non-bypass
    // role and making any share grant fail. Register them so the checks/grants
    // work. The clinical orders inherit `encounter` like their sibling `lab_order`
    // (encounter-viewer cascades to the order); `invoice` is a standalone billing
    // entity.
    EntityShareSpec {
        object_type: "radiology_order",
        allowed_relations: &[Relation::Owner, Relation::Editor, Relation::Viewer],
        inherits_from: Some("encounter"),
        bypass_only: false,
    },
    EntityShareSpec {
        object_type: "pharmacy_order",
        allowed_relations: &[Relation::Owner, Relation::Editor, Relation::Viewer],
        inherits_from: Some("encounter"),
        bypass_only: false,
    },
    EntityShareSpec {
        object_type: "invoice",
        allowed_relations: &[Relation::Owner, Relation::Editor, Relation::Viewer],
        inherits_from: None,
        bypass_only: false,
    },
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lookup_known() {
        assert!(lookup("patient").is_some());
        assert!(lookup("encounter").is_some());
    }

    #[test]
    fn lookup_unknown() {
        assert!(lookup("not_a_thing").is_none());
    }

    #[test]
    fn encounter_inherits_from_patient() {
        let e = lookup("encounter").unwrap();
        assert_eq!(e.inherits_from, Some("patient"));
    }

    #[test]
    fn admission_is_registered() {
        // Regression: create_admission grants a raw ward_member tuple on this
        // object_type; if it's unregistered, every admission 500s.
        let a = lookup("admission").expect("admission must be registered");
        assert_eq!(a.inherits_from, Some("encounter"));
        assert!(!a.bypass_only);
    }

    #[test]
    fn membership_container_types_are_registered() {
        // create_user / dept_member grants write `member` tuples on these; if
        // unregistered the grant fails and the membership is silently never set.
        for t in ["department", "access_group"] {
            let spec = lookup(t).unwrap_or_else(|| panic!("{t} must be registered"));
            assert!(!spec.bypass_only, "{t} must allow explicit grants");
        }
    }

    /// Every object_type any `grant_raw(...)` caller uses must be registered,
    /// or the grant fails at runtime (500 or a silently-swallowed membership).
    /// The known set as of this test — extend when a new grant site lands.
    #[test]
    fn all_granted_object_types_are_registered() {
        for t in ["patient", "encounter", "admission", "department", "access_group"] {
            assert!(lookup(t).is_some(), "grant_raw object_type {t} not registered");
        }
    }

    /// Every object_type used in an authz `check(...)` must be registered too, or
    /// the check errors (masked by `unwrap_or(false)`) and silently denies every
    /// non-bypass role. Extend when a new object-level check lands.
    #[test]
    fn all_checked_object_types_are_registered() {
        for t in ["invoice", "radiology_order", "pharmacy_order", "lab_order"] {
            assert!(lookup(t).is_some(), "checked object_type {t} not registered");
        }
    }
}

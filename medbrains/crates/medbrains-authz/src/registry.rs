//! Entity registry — declares which entity types support sharing and
//! which relations are valid per type. Phase 3 starter set; Phase 3.2
//! will populate the full ~95 entity types via `medbrains-core` exports.
//!
//! Future move: this stays a thin in-crate registry pointing at
//! `medbrains-core::sharing::registry::ENTITIES` once that module lands
//! (so all 95 EntityShareSpec entries are in one place with the rest of
//! the domain types).

use crate::Relation;

/// Per-entity sharing spec. Static — declared at compile time.
#[derive(Debug, Clone, Copy)]
pub struct EntityShareSpec {
    pub object_type: &'static str,
    pub allowed_relations: &'static [Relation],
    /// Parent object_type — sharing this object cascades viewer-tier
    /// access down to children. None = leaf object.
    pub inherits_from: Option<&'static str>,
    /// Catalog tables read by all bypass roles only — engine refuses
    /// to write tuples for these types.
    pub bypass_only: bool,
}

/// Lookup an entity by object_type code. Returns None if not registered.
pub fn lookup(object_type: &str) -> Option<&'static EntityShareSpec> {
    ENTITIES.iter().find(|e| e.object_type == object_type)
}

/// Phase 3 starter set. Six high-value entities the plan explicitly
/// targets for `apply_shared_visibility` rollout:
///   dashboards, forms, screens, lab_orders, encounters, surgery_bookings
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
}

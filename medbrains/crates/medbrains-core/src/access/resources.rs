//! Rebac resource definitions — single source for the SpiceDB schema.
//!
//! Each entry corresponds to one `definition X { … }` block in
//! `infra/spicedb/schema.zed`. The codegen script reads this table
//! and emits the zed file; manual edits to schema.zed are
//! overwritten.

#[derive(Debug, Clone)]
pub struct ResourceDef {
    /// Object type as written in SpiceDB (`patient`, `lab_order`, etc.)
    /// and emitted as `definition X { ... }`.
    pub object_type: &'static str,
    /// Human-readable label for the manifest API.
    pub label: &'static str,
    /// Relations on this resource. Each becomes a `relation X: …` line.
    pub relations: &'static [RebacRelation],
    /// Computed permissions (`permission view = owner + …`). Order
    /// matters for the codegen output but doesn't affect resolution.
    pub permissions: &'static [&'static str],
}

#[derive(Debug, Clone)]
pub struct RebacRelation {
    pub name: &'static str,
    /// Subject types this relation accepts, e.g. `&["user"]` or
    /// `&["user", "department#member"]`.
    pub subject_types: &'static [&'static str],
}

const USER: &[&str] = &["user"];
const USER_OR_DEPT: &[&str] = &["user", "department#member"];
const USER_OR_GROUP: &[&str] = &["user", "access_group#member"];

pub const REBAC_RESOURCES: &[ResourceDef] = &[
    ResourceDef {
        object_type: "patient",
        label: "Patient",
        relations: &[
            RebacRelation { name: "owner", subject_types: USER },
            RebacRelation { name: "attending", subject_types: USER },
            RebacRelation { name: "dept_member", subject_types: USER_OR_DEPT },
            RebacRelation { name: "group_member", subject_types: USER_OR_GROUP },
            RebacRelation { name: "viewer", subject_types: USER },
            RebacRelation { name: "editor", subject_types: USER },
        ],
        permissions: &["view", "edit", "delete", "share"],
    },
    ResourceDef {
        object_type: "encounter",
        label: "Encounter / OPD Visit",
        relations: &[
            RebacRelation { name: "owner", subject_types: USER },
            RebacRelation { name: "attending", subject_types: USER },
            RebacRelation { name: "dept_member", subject_types: USER_OR_DEPT },
            RebacRelation { name: "group_member", subject_types: USER_OR_GROUP },
            RebacRelation { name: "viewer", subject_types: USER },
            RebacRelation { name: "editor", subject_types: USER },
        ],
        permissions: &["view", "edit", "delete", "share"],
    },
    ResourceDef {
        object_type: "admission",
        label: "Admission / IPD",
        relations: &[
            RebacRelation { name: "attending", subject_types: USER },
            RebacRelation { name: "dept_member", subject_types: USER_OR_DEPT },
            RebacRelation { name: "ward_member", subject_types: USER_OR_DEPT },
            RebacRelation { name: "group_member", subject_types: USER_OR_GROUP },
            RebacRelation { name: "viewer", subject_types: USER },
            RebacRelation { name: "editor", subject_types: USER },
        ],
        permissions: &["view", "edit", "discharge", "share"],
    },
    ResourceDef {
        object_type: "lab_order",
        label: "Lab Order",
        relations: &[
            RebacRelation { name: "ordering_provider", subject_types: USER },
            RebacRelation { name: "dept_member", subject_types: USER_OR_DEPT },
            RebacRelation { name: "group_member", subject_types: USER_OR_GROUP },
            RebacRelation { name: "viewer", subject_types: USER },
            RebacRelation { name: "editor", subject_types: USER },
        ],
        permissions: &["view", "edit", "cancel", "add_results", "share"],
    },
    ResourceDef {
        object_type: "pharmacy_order",
        label: "Pharmacy Order",
        relations: &[
            RebacRelation { name: "prescriber", subject_types: USER },
            RebacRelation { name: "dept_member", subject_types: USER_OR_DEPT },
            RebacRelation { name: "group_member", subject_types: USER_OR_GROUP },
            RebacRelation { name: "viewer", subject_types: USER },
            RebacRelation { name: "editor", subject_types: USER },
        ],
        permissions: &["view", "edit", "dispense", "cancel", "share"],
    },
    ResourceDef {
        object_type: "radiology_order",
        label: "Radiology Order",
        relations: &[
            RebacRelation { name: "ordering_provider", subject_types: USER },
            RebacRelation { name: "dept_member", subject_types: USER_OR_DEPT },
            RebacRelation { name: "group_member", subject_types: USER_OR_GROUP },
            RebacRelation { name: "viewer", subject_types: USER },
            RebacRelation { name: "editor", subject_types: USER },
        ],
        permissions: &["view", "edit", "share"],
    },
    ResourceDef {
        object_type: "invoice",
        label: "Billing Invoice",
        relations: &[
            RebacRelation { name: "owner", subject_types: USER },
            RebacRelation { name: "dept_member", subject_types: USER_OR_DEPT },
            RebacRelation { name: "viewer", subject_types: USER },
            RebacRelation { name: "editor", subject_types: USER },
        ],
        permissions: &["view", "edit", "record_payment", "cancel", "share"],
    },
    ResourceDef {
        object_type: "opd_queue_entry",
        label: "OPD Queue Token",
        relations: &[
            RebacRelation { name: "doctor", subject_types: USER },
            RebacRelation { name: "dept_member", subject_types: USER_OR_DEPT },
            RebacRelation { name: "group_member", subject_types: USER_OR_GROUP },
        ],
        permissions: &["view", "call_next"],
    },
    ResourceDef {
        object_type: "clinical_document",
        label: "Clinical Document",
        relations: &[
            RebacRelation { name: "owner", subject_types: USER },
            RebacRelation { name: "patient_attending", subject_types: USER },
            RebacRelation { name: "dept_member", subject_types: USER_OR_DEPT },
            RebacRelation { name: "viewer", subject_types: USER },
            RebacRelation { name: "editor", subject_types: USER },
        ],
        permissions: &["view", "edit", "sign", "delete"],
    },
    ResourceDef {
        object_type: "pipeline",
        label: "Integration Pipeline",
        relations: &[
            RebacRelation { name: "creator", subject_types: USER },
            RebacRelation { name: "runner", subject_types: USER_OR_GROUP },
            RebacRelation { name: "viewer", subject_types: USER_OR_GROUP },
        ],
        permissions: &["view", "edit", "run", "delete"],
    },
];

//! Role-policy table — the rules that go beyond a flat permission list.
//!
//! For each built-in role, declares:
//!  - which department types it MUST belong to (rejection if violated)
//!  - which default groups it auto-acquires at user-create time
//!  - whether the user can be assigned to multiple departments
//!  - the minimum permission set every user with the role MUST hold
//!    (sanity-check at startup; existing users who fall below get a warn log)
//!
//! Adding / changing a policy: edit this file. `seed::seed_role_policies`
//! reads from `ROLE_POLICIES`; `setup::create_user` enforces it.

#[derive(Debug, Clone)]
pub struct RolePolicy {
    pub role: &'static str,
    /// Department types the user must have at least one of. Empty = no constraint.
    pub mandatory_dept_types: &'static [&'static str],
    /// Group codes auto-added when a user with this role is created.
    pub default_groups: &'static [&'static str],
    /// Whether the user can be assigned to more than one department.
    pub allow_multiple_depts: bool,
    /// Minimum permission codes every user with this role must hold.
    pub min_perm_set: &'static [&'static str],
}

pub const ROLE_POLICIES: &[RolePolicy] = &[
    RolePolicy {
        role: "super_admin",
        mandatory_dept_types: &[],
        default_groups: &[],
        allow_multiple_depts: true,
        min_perm_set: &[], // bypass — no constraints
    },
    RolePolicy {
        role: "hospital_admin",
        mandatory_dept_types: &[],
        default_groups: &["integrations_admin", "mlc_signatories", "data_exporters"],
        allow_multiple_depts: true,
        min_perm_set: &[], // bypass
    },
    RolePolicy {
        role: "doctor",
        mandatory_dept_types: &["clinical"],
        default_groups: &["code_blue_team"],
        allow_multiple_depts: true,
        min_perm_set: &["dashboard.view", "patients.view", "patients.list"],
    },
    RolePolicy {
        role: "nurse",
        mandatory_dept_types: &["clinical"],
        default_groups: &["code_blue_team"],
        allow_multiple_depts: true,
        min_perm_set: &["dashboard.view", "patients.view", "ipd.admissions.list"],
    },
    RolePolicy {
        role: "receptionist",
        mandatory_dept_types: &["front_office", "clinical"],
        default_groups: &[],
        allow_multiple_depts: true,
        min_perm_set: &["dashboard.view", "patients.create"],
    },
    RolePolicy {
        role: "lab_technician",
        mandatory_dept_types: &["lab"],
        default_groups: &[],
        allow_multiple_depts: false,
        min_perm_set: &["dashboard.view", "lab.orders.list"],
    },
    RolePolicy {
        role: "pharmacist",
        mandatory_dept_types: &["pharmacy"],
        default_groups: &[],
        allow_multiple_depts: false,
        min_perm_set: &["dashboard.view", "pharmacy.orders.list"],
    },
    RolePolicy {
        role: "billing_clerk",
        mandatory_dept_types: &["billing"],
        default_groups: &[],
        allow_multiple_depts: false,
        min_perm_set: &["dashboard.view", "billing.invoices.list"],
    },
    RolePolicy {
        role: "housekeeping_staff",
        mandatory_dept_types: &[],
        default_groups: &[],
        allow_multiple_depts: true,
        min_perm_set: &["dashboard.view"],
    },
    RolePolicy {
        role: "facilities_manager",
        mandatory_dept_types: &[],
        default_groups: &["integrations_admin"],
        allow_multiple_depts: true,
        min_perm_set: &["dashboard.view"],
    },
    RolePolicy {
        role: "audit_officer",
        mandatory_dept_types: &[],
        default_groups: &["data_exporters"],
        allow_multiple_depts: true,
        min_perm_set: &["dashboard.view"],
    },
    RolePolicy {
        role: "quality_officer",
        mandatory_dept_types: &[],
        default_groups: &[],
        allow_multiple_depts: true,
        min_perm_set: &["dashboard.view"],
    },
    RolePolicy {
        role: "occ_health_officer",
        mandatory_dept_types: &[],
        default_groups: &[],
        allow_multiple_depts: true,
        min_perm_set: &["dashboard.view"],
    },
    RolePolicy {
        role: "utilization_reviewer",
        mandatory_dept_types: &[],
        default_groups: &[],
        allow_multiple_depts: true,
        min_perm_set: &["dashboard.view"],
    },
    RolePolicy {
        role: "case_manager",
        mandatory_dept_types: &[],
        default_groups: &[],
        allow_multiple_depts: true,
        min_perm_set: &["dashboard.view"],
    },
    RolePolicy {
        role: "scheduling_admin",
        mandatory_dept_types: &[],
        default_groups: &[],
        allow_multiple_depts: true,
        min_perm_set: &["dashboard.view"],
    },
];

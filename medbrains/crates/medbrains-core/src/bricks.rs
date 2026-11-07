//! The app bricks: one row per module a tenant can switch on or off.
//!
//! The single source for every place that names one: the seed list, the edition presets, the web
//! menu tags and the server's module checks. See `docs/architecture/MODULE-BRICKS.md`.
//!
//! A brick's `id` is the `module_config.code` the server checks with `require_module_enabled`.
//! `permission_groups` are permission-code prefixes (`pharmacy`, `specialty.dental`): a code
//! belongs to the brick whose longest prefix matches it. Groups that belong to no brick are
//! listed in [`BASE_PLATE`] or [`NOT_YET_BRICKS`], so `scripts/check_bricks.py` can fail on a
//! group nobody placed.

/// One app brick.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Brick {
    /// The module code, as stored in `module_config.code`.
    pub id: &'static str,
    /// The name shown in setup, the Modules screen and the launcher.
    pub name: &'static str,
    /// Bricks that must be on for this one to work.
    pub depends_on: &'static [&'static str],
    /// Permission-code prefixes this brick owns.
    pub permission_groups: &'static [&'static str],
    /// A licensed add-on: off until an operator enables it, whatever the edition.
    pub add_on: bool,
    /// Editions (`tenants.hospital_type`) that start with it on. `None` means every edition.
    pub editions: Option<&'static [&'static str]>,
}

/// Every named edition, standalone clinics included.
const EVERY_EDITION: &[&str] = &[
    "multi_specialty",
    "medical_college",
    "eye_hospital",
    "dental_college",
    "district_hospital",
    "community_health",
    "primary_health",
    "standalone_clinic",
];
/// The full editions, with every app.
const FULL: &[&str] = &["multi_specialty", "medical_college"];
/// Government and public editions: broad clinical care, no elective specialties.
const PUBLIC: &[&str] = &[
    "multi_specialty",
    "medical_college",
    "district_hospital",
    "community_health",
    "primary_health",
];

/// Builds a brick row; keeps the table below one line of intent per brick.
const fn brick(
    id: &'static str,
    name: &'static str,
    depends_on: &'static [&'static str],
    permission_groups: &'static [&'static str],
    editions: Option<&'static [&'static str]>,
) -> Brick {
    Brick {
        id,
        name,
        depends_on,
        permission_groups,
        add_on: false,
        editions,
    }
}

/// Every app brick. Order is the order setup and the Modules screen show them.
#[rustfmt::skip]
pub const BRICKS: &[Brick] = &[
    brick("registration", "Patient Registration", &[], &["patients", "front_office", "consent"], None),
    brick("billing", "Billing & Finance", &["registration"], &["billing", "insurance", "patient_packages", "doctor_payouts"], None),
    brick("opd", "OPD / Outpatient", &["registration"], &["opd", "doctor", "scheduling", "order_basket", "order_sets", "clinical_notes", "notes", "care_view", "chronic"], Some(EVERY_EDITION)),
    brick("ipd", "IPD / Inpatient", &["registration"], &["ipd", "bedside", "icu", "case_mgmt", "ur", "mrd"], Some(PUBLIC)),
    brick("lab", "Laboratory (LIS)", &["registration"], &["lab"], Some(EVERY_EDITION)),
    brick("pharmacy", "Pharmacy", &["registration"], &["pharmacy", "pharmacy_finance", "pharmacy_improvements"], Some(EVERY_EDITION)),
    brick("radiology", "Radiology (RIS)", &["registration"], &["radiology"], Some(PUBLIC)),
    brick("blood_bank", "Blood Bank", &["registration", "lab"], &["blood_bank"], Some(FULL)),
    brick("ot", "Operation Theatre", &["registration", "ipd"], &["ot", "cssd"], Some(&["multi_specialty", "medical_college", "eye_hospital", "dental_college"])),
    brick("emergency", "Emergency / Casualty", &["registration"], &["emergency", "ambulance"], Some(PUBLIC)),
    brick("nursing", "Nursing Station", &["registration", "ipd"], &["nurse", "infection_control"], Some(PUBLIC)),
    brick("diet", "Diet & Nutrition", &["registration", "ipd"], &["diet"], Some(FULL)),
    brick("hr", "Human Resources", &[], &["hr", "lms"], Some(FULL)),
    brick("inventory", "Inventory & Stores", &[], &["inventory", "indent", "procurement", "assets", "bme"], Some(FULL)),
    brick("reports", "Reports & Analytics", &[], &["analytics", "command_center", "quality", "regulatory", "retrospective"], Some(FULL)),
    brick("maternity", "Maternity", &["registration", "ipd"], &["specialty.maternity"], Some(PUBLIC)),
    brick("ophthalmology", "Ophthalmology", &["registration", "opd"], &["specialty.ophthalmology"], Some(&["multi_specialty", "medical_college", "eye_hospital"])),
    brick("dental", "Dental", &["registration", "opd"], &["specialty.dental"], Some(&["multi_specialty", "medical_college", "dental_college"])),
    brick("cath_lab", "Cath Lab", &["registration", "ipd"], &["specialty.cath_lab"], Some(FULL)),
    brick("endoscopy", "Endoscopy", &["registration", "opd"], &["specialty.endoscopy"], Some(FULL)),
    brick("psychiatry", "Psychiatry", &["registration", "opd"], &["specialty.psychiatry"], Some(FULL)),
    brick("palliative", "Palliative Care", &["registration", "opd"], &["specialty.palliative", "specialty.ltc"], Some(FULL)),
    brick("pmr", "Physical Medicine & Rehabilitation", &["registration", "opd"], &["specialty.pmr"], Some(FULL)),
    brick("specialty_other", "Other Specialties", &["registration", "opd"], &["specialty.other", "specialty.health_packages", "specialty.clinical_trials"], Some(FULL)),
    brick("flow", "MedBrains Flow", &["opd"], &["flow", "flows", "automation"], Some(&[])),
    Brick { id: "companion", name: "Patient Companion", depends_on: &["registration"], permission_groups: &[], add_on: true, editions: Some(&[]), },
];

/// Permission groups every install carries, because the platform needs them whatever apps are
/// on: sign-in, the dashboard shell, administration, audit, devices and shared services.
pub const BASE_PLATE: &[&str] = &[
    "dashboard",
    "admin",
    "audit",
    "security",
    "storage",
    "integration",
    "devices",
    "display",
    "health",
    "vpn",
    "terminology",
    "knowledge",
    "forms",
    "communications",
    "documents",
    "facilities",
    "ai",
    "ckb",
    "qa",
    "specialty",
];

/// Groups that are apps in their own right but have no module switch yet. Each one is a brick
/// still to be made; until then it is on for every tenant.
pub const NOT_YET_BRICKS: &[&str] = &[
    "abdm",
    "uhi",
    "camp",
    "marketing",
    "research",
    "home_health",
    "occ_health",
    "housekeeping",
];

/// The brick with this id.
#[must_use]
pub fn find(id: &str) -> Option<&'static Brick> {
    BRICKS.iter().find(|brick| brick.id == id)
}

/// Whether a brick starts on for an edition. Unknown editions get every non-add-on brick, the
/// safe default the onboarding presets already used.
#[must_use]
pub fn on_for_edition(brick: &Brick, edition: &str) -> bool {
    if brick.add_on {
        return false;
    }
    let known = BRICKS
        .iter()
        .any(|b| b.editions.is_some_and(|e| e.contains(&edition)));
    brick.editions.is_none_or(|editions| editions.contains(&edition) || !known)
}

/// The bricks `picked` needs, itself included, each once, dependencies first. Unknown ids are
/// skipped. Bounded by the table: every brick is visited at most once.
#[must_use]
pub fn with_dependencies(picked: &[&str]) -> Vec<&'static str> {
    let mut out: Vec<&'static str> = Vec::with_capacity(BRICKS.len());
    let mut stack: Vec<(&'static Brick, bool)> = picked
        .iter()
        .rev()
        .filter_map(|id| find(id))
        .map(|b| (b, false))
        .collect();
    while let Some((brick, expanded)) = stack.pop() {
        if out.contains(&brick.id) {
            continue;
        }
        if expanded {
            out.push(brick.id);
            continue;
        }
        stack.push((brick, true));
        stack.extend(
            brick
                .depends_on
                .iter()
                .rev()
                .filter_map(|id| find(id))
                .filter(|d| !out.contains(&d.id))
                .map(|d| (d, false)),
        );
    }
    out
}

/// The bricks that would break if `id` were switched off: those that depend on it, directly or
/// through another brick.
#[must_use]
pub fn dependents(id: &str) -> Vec<&'static str> {
    BRICKS
        .iter()
        .filter(|brick| brick.id != id && with_dependencies(&[brick.id]).contains(&id))
        .map(|brick| brick.id)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{
        BASE_PLATE, BRICKS, NOT_YET_BRICKS, dependents, find, on_for_edition, with_dependencies,
    };

    #[test]
    fn ids_are_unique_and_dependencies_exist() {
        for (at, brick) in BRICKS.iter().enumerate() {
            assert!(
                BRICKS[..at].iter().all(|b| b.id != brick.id),
                "{} twice",
                brick.id
            );
            for dep in brick.depends_on {
                assert!(find(dep).is_some(), "{} depends on unknown {dep}", brick.id);
            }
        }
    }

    /// A cycle would make a brick impossible to switch off; every brick must reach a root.
    #[test]
    fn dependencies_have_no_cycle() {
        for brick in BRICKS {
            let order = with_dependencies(&[brick.id]);
            for (at, id) in order.iter().enumerate() {
                let needs = find(id).map_or(&[][..], |b| b.depends_on);
                assert!(
                    needs.iter().all(|d| order[..at].contains(d)),
                    "cycle through {id}"
                );
            }
        }
    }

    #[test]
    fn each_permission_group_has_one_place() {
        let mut seen: Vec<&str> = BASE_PLATE.iter().chain(NOT_YET_BRICKS).copied().collect();
        for group in BRICKS.iter().flat_map(|b| b.permission_groups) {
            assert!(!seen.contains(group), "{group} placed twice");
            seen.push(group);
        }
    }

    /// Owner's example: a standalone pharmacy gets Pharmacy and only what it needs.
    #[test]
    fn a_pharmacy_brings_registration_and_nothing_else() {
        assert_eq!(
            with_dependencies(&["pharmacy"]),
            vec!["registration", "pharmacy"]
        );
        assert_eq!(
            with_dependencies(&["ot", "pharmacy"]),
            vec!["registration", "ipd", "ot", "pharmacy"]
        );
    }

    #[test]
    fn switching_off_registration_names_what_breaks() {
        let broken = dependents("registration");
        assert!(broken.contains(&"pharmacy") && broken.contains(&"ot"));
        assert_eq!(dependents("ot"), Vec::<&str>::new());
        assert!(dependents("ipd").contains(&"nursing"));
    }

    /// Mirrors the presets onboarding used before this table existed.
    #[test]
    fn editions_match_the_old_presets() {
        let on = |edition: &str| -> Vec<&str> {
            BRICKS
                .iter()
                .filter(|b| on_for_edition(b, edition))
                .map(|b| b.id)
                .collect()
        };
        assert_eq!(
            on("standalone_clinic"),
            vec!["registration", "billing", "opd", "lab", "pharmacy"]
        );
        assert!(
            on("eye_hospital").contains(&"ophthalmology")
                && !on("eye_hospital").contains(&"dental")
        );
        assert!(on("unknown_edition").contains(&"dental"));
        assert!(!on("multi_specialty").contains(&"companion"));
    }
}

//! The app bricks: one row per module a tenant can switch on or off.
//!
//! The single source for every place that names one: the seed list, the edition presets, the web
//! menu tags and the server's module checks. See `docs/architecture/MODULE-BRICKS.md`.
//!
//! A brick's `id` is the `module_config.code` the server checks with `require_module_enabled`
//! (one handler) or `gated` (a whole router).
//! `permission_groups` are permission-code prefixes (`pharmacy`, `specialty.dental`): a code
//! belongs to the brick whose longest prefix matches it. Groups that belong to no brick are
//! listed in [`BASE_PLATE`] or [`NOT_YET_BRICKS`], so `scripts/check_bricks.py` can fail on a
//! group nobody placed.

use crate::permissions as p;

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
    /// The Settings sections (`pages/admin/settings.tsx` tab values) this brick plugs in; they
    /// are hidden while it is off.
    pub settings: &'static [&'static str],
    /// The panels it plugs into other bricks' screens (`apps/web/src/components/panels`).
    pub panels: &'static [Panel],
}

/// A panel one brick shows inside another brick's screen, such as Lab's orders tab on the
/// patient record. The host screen never imports it: it is downloaded and shown only while its
/// brick is on and the viewer holds `permission`, and left out otherwise, never greyed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Panel {
    /// Where it plugs in: `patient.tabs` (a patient record tab) or `opd.encounter` (an action
    /// on the OPD encounter).
    pub slot: &'static str,
    /// The web registry key of its component.
    pub id: &'static str,
    /// The permission its first call needs.
    pub permission: &'static str,
}

/// Lab's orders tab on the patient record.
const LAB_PANELS: &[Panel] = &[Panel {
    slot: "patient.tabs",
    id: "lab.patient_orders",
    permission: p::lab::orders::LIST,
}];
/// Radiology's imaging tab on the patient record.
const RADIOLOGY_PANELS: &[Panel] = &[Panel {
    slot: "patient.tabs",
    id: "radiology.patient_imaging",
    permission: p::radiology::orders::LIST,
}];
/// Billing's tab on the patient record, and the bill on the OPD encounter.
const BILLING_PANELS: &[Panel] = &[
    Panel {
        slot: "patient.tabs",
        id: "billing.patient_bills",
        permission: p::billing::invoices::LIST,
    },
    Panel {
        slot: "opd.encounter",
        id: "billing.encounter_bill",
        permission: p::billing::invoices::LIST,
    },
];
/// Sending an OPD patient to Emergency.
const EMERGENCY_PANELS: &[Panel] = &[Panel {
    slot: "opd.encounter",
    id: "emergency.er_visit",
    permission: p::emergency::visits::CREATE,
}];

/// The version of the brick manifest schema written to the web (`BRICK_MANIFEST_VERSION`).
/// Raise it when a manifest field is added, removed or changes meaning.
pub const MANIFEST_VERSION: u32 = 1;

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
        settings: &[],
        panels: &[],
    }
}

impl Brick {
    /// The same brick with the Settings sections it plugs in; keeps a table row one line.
    #[must_use]
    pub const fn with_settings(self, settings: &'static [&'static str]) -> Self {
        Self { settings, ..self }
    }

    /// The same brick with the panels it plugs into other bricks' screens.
    #[must_use]
    pub const fn with_panels(self, panels: &'static [Panel]) -> Self {
        Self { panels, ..self }
    }
}

/// Every app brick. Order is the order setup and the Modules screen show them.
#[rustfmt::skip]
pub const BRICKS: &[Brick] = &[
    brick("registration", "Patient Registration", &[], &["patients", "front_office", "consent"], None),
    brick("billing", "Billing & Finance", &["registration"], &["billing", "insurance", "patient_packages", "doctor_payouts"], None).with_settings(&["billing", "payment-terminals", "payment-exceptions"]).with_panels(BILLING_PANELS),
    brick("opd", "OPD / Outpatient", &["registration"], &["opd", "doctor", "scheduling", "order_basket", "clinical_notes", "notes", "chronic"], Some(EVERY_EDITION)).with_settings(&["consultation-templates"]),
    brick("ipd", "IPD / Inpatient", &["registration"], &["ipd", "bedside", "icu", "case_mgmt", "ur", "mrd"], Some(PUBLIC)).with_settings(&["bed-types", "early-warning"]),
    brick("lab", "Laboratory (LIS)", &["registration"], &["lab"], Some(EVERY_EDITION)).with_settings(&["critical-values"]).with_panels(LAB_PANELS),
    brick("pharmacy", "Pharmacy", &["registration"], &["pharmacy", "pharmacy_finance", "pharmacy_improvements"], Some(EVERY_EDITION)).with_settings(&["drug-interactions"]),
    brick("radiology", "Radiology (RIS)", &["registration"], &["radiology"], Some(PUBLIC)).with_panels(RADIOLOGY_PANELS),
    brick("blood_bank", "Blood Bank", &["registration", "lab"], &["blood_bank"], Some(FULL)),
    brick("ot", "Operation Theatre", &["registration", "ipd"], &["ot", "cssd"], Some(&["multi_specialty", "medical_college", "eye_hospital", "dental_college"])),
    brick("emergency", "Emergency / Casualty", &["registration"], &["emergency", "ambulance"], Some(PUBLIC)).with_panels(EMERGENCY_PANELS),
    brick("nursing", "Nursing Station", &["registration", "ipd"], &["nurse"], Some(PUBLIC)),
    brick("diet", "Diet & Nutrition", &["registration", "ipd"], &["diet"], Some(FULL)),
    brick("hr", "Human Resources", &[], &["hr", "lms"], Some(FULL)),
    brick("inventory", "Inventory & Stores", &[], &["inventory", "indent", "procurement", "assets", "bme"], Some(FULL)),
    brick("reports", "Reports & Analytics", &[], &["analytics", "command_center", "retrospective"], Some(FULL)),
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
    Brick { id: "companion", name: "Patient Companion", depends_on: &["registration"], permission_groups: &[], add_on: true, editions: Some(&[]), settings: &[], panels: &[] },
];

/// A background job that serves only some bricks.
///
/// It runs while at least one hospital on this server has one of `bricks` on, and stops when none
/// has (see `docs/architecture/MODULE-BRICKS.md`). Jobs every install needs whatever its bricks
/// stay in the server's `PLATFORM_JOBS`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BrickJob {
    /// The job's name in logs and on the Modules screen.
    pub id: &'static str,
    /// What it does, in the words the Modules screen shows.
    pub label: &'static str,
    /// The bricks it serves; any one of them on is enough. Patient-safety jobs list every brick
    /// whose patients they protect, so switching one off never silences another's escalations.
    pub bricks: &'static [&'static str],
    /// The machine actor it runs as (`job:<id>`): the name its audit rows and authz decisions
    /// carry. Declared now; enforcing it through the kernel is the follow-up in MODULE-BRICKS.md.
    pub actor: &'static str,
    /// The least permissions its passes need, as permission constants (a typo does not build).
    pub permissions: &'static [&'static str],
}

/// Every brick-owned background job. `scripts/check_bricks.py` fails on a job the server starts
/// that is neither here nor a platform job.
#[rustfmt::skip]
pub const BRICK_JOBS: &[BrickJob] = &[
    BrickJob { id: "opd_auto_close", label: "Close finished OPD visits", bricks: &["opd"], actor: "job:opd_auto_close", permissions: &[p::opd::queue::VIEW, p::opd::visit::UPDATE] },
    BrickJob { id: "appointment_reminders", label: "Appointment reminder SMS", bricks: &["opd"], actor: "job:appointment_reminders", permissions: &[p::opd::appointment::LIST, p::communications::messages::CREATE] },
    BrickJob { id: "prescription_expiry", label: "Prescription expiry notices", bricks: &["opd", "ipd", "emergency", "pharmacy"], actor: "job:prescription_expiry", permissions: &[p::pharmacy::prescriptions::VIEW, p::communications::messages::CREATE] },
    BrickJob { id: "verbal_order_escalation", label: "Unsigned verbal orders escalate", bricks: &["opd", "ipd", "emergency"], actor: "job:verbal_order_escalation", permissions: &[p::pharmacy::prescriptions::VIEW, p::communications::alerts::CREATE] },
    BrickJob { id: "room_rent", label: "Daily room rent", bricks: &["ipd"], actor: "job:room_rent", permissions: &[p::ipd::admissions::VIEW, p::billing::invoices::UPDATE] },
    BrickJob { id: "mrd_file_requests", label: "Late MRD file requests", bricks: &["ipd"], actor: "job:mrd_file_requests", permissions: &[p::mrd::file_request::SUPERVISE, p::mrd::file_request::CREATE] },
    BrickJob { id: "nurse_call_escalation", label: "Unanswered nurse calls escalate", bricks: &["ipd", "nursing"], actor: "job:nurse_call_escalation", permissions: &[p::ipd::admissions::VIEW, p::communications::alerts::CREATE] },
    BrickJob { id: "ews_escalation", label: "Early-warning scores escalate", bricks: &["ipd", "nursing", "emergency"], actor: "job:ews_escalation", permissions: &[p::nurse::ews::VIEW, p::communications::alerts::CREATE] },
    BrickJob { id: "restraint_observation_escalation", label: "Restraint checks escalate", bricks: &["ipd", "emergency", "psychiatry"], actor: "job:restraint_observation_escalation", permissions: &[p::nurse::restraint::VIEW, p::communications::alerts::CREATE] },
    BrickJob { id: "critical_alert_escalation", label: "Critical results escalate", bricks: &["lab", "radiology"], actor: "job:critical_alert_escalation", permissions: &[p::lab::results::CRITICAL_CALL, p::communications::alerts::CREATE] },
    BrickJob { id: "calibration_lock", label: "Lock overdue calibrations", bricks: &["inventory", "lab", "radiology"], actor: "job:calibration_lock", permissions: &[p::bme::calibration::MANAGE, p::bme::equipment::UPDATE] },
    BrickJob { id: "pacs_sync", label: "PACS study sync", bricks: &["radiology"], actor: "job:pacs_sync", permissions: &[p::radiology::studies::RECONCILE] },
    BrickJob { id: "unbilled_orders", label: "Unbilled orders sweep", bricks: &["billing"], actor: "job:unbilled_orders", permissions: &[p::billing::charge_attention::VIEW, p::billing::charge_attention::RESOLVE] },
    BrickJob { id: "preauth_sweep", label: "Pre-authorisation sweep", bricks: &["billing"], actor: "job:preauth_sweep", permissions: &[p::insurance::prior_auth::LIST, p::billing::charge_attention::RESOLVE] },
    BrickJob { id: "hrms_pull", label: "HRMS staff pull", bricks: &["hr"], actor: "job:hrms_pull", permissions: &[p::hr::employees::CREATE, p::hr::employees::UPDATE] },
    BrickJob { id: "flow_aggregate", label: "Flow minute aggregates", bricks: &["flow"], actor: "job:flow_aggregate", permissions: &[p::flow::VIEW, p::flow::MANAGE] },
];

/// The jobs that serve brick `id`.
#[must_use]
pub fn jobs_for(id: &str) -> Vec<&'static BrickJob> {
    BRICK_JOBS
        .iter()
        .filter(|job| job.bricks.contains(&id))
        .collect()
}

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
    // Legal and patient-safety duties every facility carries, whatever apps it runs: DPDP,
    // PCPNDT and ADR reporting; incident reporting (IPSG); infection control and biomedical
    // waste (BMW Rules 2016). Switching off Reports or Nursing must not switch these off.
    "regulatory",
    "quality",
    "infection_control",
    // Order sets serve OPD, admission and pre-operative care alike, so no one app owns them:
    // an IPD-only hospital still authors its admission and theatre sets.
    "order_sets",
    // The care view is the ward worklist: IPD and nursing work from it, so it stays when the
    // EMR is switched off (an IPD-only hospital still needs its ward list).
    "care_view",
    // The hospital's emblem and name in the header and on printed cards: every screen and
    // print shows them, whatever apps are on.
    "branding",
    // A signer's own signature: every app with a Sign button needs it, so no one app owns it.
    "signatures",
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
    brick
        .editions
        .is_none_or(|editions| editions.contains(&edition) || !known)
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
        BASE_PLATE, BRICK_JOBS, BRICKS, NOT_YET_BRICKS, dependents, find, jobs_for, on_for_edition,
        with_dependencies,
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

    /// A Settings section hides with its brick, so two owners would leave it shown or hidden
    /// by whichever was read last.
    #[test]
    fn each_settings_section_has_one_brick() {
        let mut seen: Vec<&str> = Vec::new();
        for key in BRICKS.iter().flat_map(|b| b.settings) {
            assert!(!seen.contains(key), "{key} claimed twice");
            seen.push(key);
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

    #[test]
    fn every_brick_job_names_real_bricks_once() {
        for (at, job) in BRICK_JOBS.iter().enumerate() {
            assert!(
                BRICK_JOBS[..at].iter().all(|j| j.id != job.id),
                "{} twice",
                job.id
            );
            assert!(!job.bricks.is_empty(), "{} serves no brick", job.id);
            assert_eq!(job.actor, format!("job:{}", job.id), "{} actor", job.id);
            assert!(
                !job.permissions.is_empty(),
                "{} declares no permission",
                job.id
            );
            for brick in job.bricks {
                assert!(
                    find(brick).is_some(),
                    "{} names unknown brick {brick}",
                    job.id
                );
            }
        }
        assert!(jobs_for("ipd").iter().any(|j| j.id == "room_rent"));
        assert_eq!(jobs_for("registration"), Vec::<&super::BrickJob>::new());
    }
}

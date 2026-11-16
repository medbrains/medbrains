//! Screen registry — every navigable page mapped to its required permission.
//!
//! Adding or changing a screen: edit this file. `navigation.ts` is still written by hand for apps
//! not yet converted, and `scripts/check_nav_drift.py` keeps it in line with this table. A
//! screen that names its app `brick` is a converted app's side-panel screen: the web reads it
//! from `packages/types/src/app-screens.generated.ts`, which `render_ts` writes and a test keeps
//! current, and its route opens only while the hospital has that app on.

#[derive(Debug, Clone)]
pub struct ScreenDef {
    /// Unique stable code (e.g. "patients.list", "admin.users").
    pub code: &'static str,
    /// Human-readable label (i18n key for the frontend).
    pub label: &'static str,
    /// Frontend route path, e.g. "/patients".
    pub route: &'static str,
    /// Module the screen belongs to, e.g. "patients", "lab", "admin".
    pub module: &'static str,
    /// Permission code the user must hold to navigate to this screen.
    /// `None` = always-visible (e.g. `/dashboard` for any authenticated user).
    pub required_permission: Option<&'static str>,
    /// Icon identifier used by the sidebar nav. Maps to a Tabler-icon
    /// name on the frontend.
    pub icon: &'static str,
    /// The `nav` translation key of its side-panel entry, for converted apps.
    pub nav_key: Option<&'static str>,
    /// The app brick (`module_config.code`) whose side panel lists this screen, for converted
    /// apps; `None` for screens not yet in an app's panel.
    pub brick: Option<&'static str>,
    /// Permissions of which any one also shows the entry, on top of `required_permission`.
    pub any_of: &'static [&'static str],
}

/// Anyone holding one of these sees the OPD queue entry: every OPD role, from the doctor to the
/// nurse who only records vitals. `required_permission` must be held as well.
const OPD_QUEUE_ANY_OF: &[&str] = &[
    "opd.queue.list",
    "opd.queue.view",
    "opd.visit.create",
    "opd.visit.update",
    "opd.token.manage",
    "opd.appointment.list",
    "opd.referrals.list",
    "opd.referrals.create",
    "opd.vitals.list",
    "opd.vitals.create",
    "opd.diagnoses.list",
    "opd.diagnoses.create",
    "opd.diagnoses.update",
    "opd.diagnoses.delete",
    "opd.procedures.list",
    "opd.procedures.create",
    "opd.procedures.cancel",
    "opd.certificates.list",
    "opd.certificates.create",
    "opd.certificates.print",
    "opd.certificates.reprint",
    "opd.certificates.void",
    "opd.reminders.list",
    "opd.reminders.create",
    "opd.reminders.update",
    "opd.feedback.list",
    "opd.feedback.create",
    "opd.consents.list",
    "opd.consents.create",
    "opd.consents.sign",
    "opd.consents.print",
    "opd.consents.reprint",
    "opd.consents.revoke",
    "opd.schedule.list",
    "opd.schedule.manage",
    "nurse.vitals.record",
];

/// Every navigable screen, one row each.
#[rustfmt::skip]
pub const SCREENS: &[ScreenDef] = &[
    ScreenDef { code: "dashboard", label: "Dashboard", route: "/dashboard", module: "dashboard", required_permission: Some("dashboard.view"), icon: "IconDashboard", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "patients", label: "Patients", route: "/patients", module: "patients", required_permission: Some("patients.list"), icon: "IconUsers", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "opd", label: "OPD", route: "/opd", module: "opd", required_permission: Some("opd.queue.list"), icon: "IconStethoscope", nav_key: Some("opdQueue"), brick: Some("opd"), any_of: OPD_QUEUE_ANY_OF },
    ScreenDef { code: "ipd", label: "IPD", route: "/ipd", module: "ipd", required_permission: Some("ipd.admissions.list"), icon: "IconBed", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "icu", label: "ICU", route: "/icu", module: "icu", required_permission: Some("icu.flowsheets.list"), icon: "IconHeartbeat", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "emergency", label: "Emergency", route: "/emergency", module: "emergency", required_permission: Some("emergency.visits.list"), icon: "IconAmbulance", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "lab", label: "Lab", route: "/lab", module: "lab", required_permission: Some("lab.orders.list"), icon: "IconTestPipe", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "radiology", label: "Radiology", route: "/radiology", module: "radiology", required_permission: Some("radiology.orders.list"), icon: "IconScan", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "blood-bank", label: "Blood Bank", route: "/blood-bank", module: "blood_bank", required_permission: Some("blood_bank.donors.list"), icon: "IconDroplet", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "pharmacy", label: "Pharmacy", route: "/pharmacy", module: "pharmacy", required_permission: Some("pharmacy.prescriptions.list"), icon: "IconPill", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "billing", label: "Billing", route: "/billing", module: "billing", required_permission: Some("billing.invoices.list"), icon: "IconFileInvoice", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "indent", label: "Indent / Stores", route: "/indent", module: "indent", required_permission: Some("indent.list"), icon: "IconBoxSeam", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "procurement", label: "Procurement", route: "/procurement", module: "procurement", required_permission: Some("procurement.vendors.list"), icon: "IconTruck", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "diet-kitchen", label: "Diet & Kitchen", route: "/diet-kitchen", module: "diet", required_permission: Some("diet.orders.list"), icon: "IconSalad", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "cssd", label: "CSSD", route: "/cssd", module: "cssd", required_permission: Some("cssd.instruments.list"), icon: "IconStack2", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "quality", label: "Quality", route: "/quality", module: "quality", required_permission: Some("quality.indicators.list"), icon: "IconCertificate", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "infection-control", label: "Infection Control", route: "/infection-control", module: "infection_control", required_permission: Some("infection_control.surveillance.list"), icon: "IconVirus", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "regulatory", label: "Regulatory", route: "/regulatory", module: "regulatory", required_permission: Some("regulatory.dashboard.view"), icon: "IconShield", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "privacy-compliance", label: "Privacy & CERT-In", route: "/privacy-compliance", module: "regulatory", required_permission: Some("regulatory.dpdp.view"), icon: "IconUserShield", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "front-office", label: "Front Office", route: "/front-office", module: "front_office", required_permission: Some("front_office.queue.list"), icon: "IconBuildingCommunity", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "facilities", label: "Facilities", route: "/facilities", module: "facilities", required_permission: Some("facilities.gas.list"), icon: "IconBuildingBank", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "hr", label: "HR", route: "/hr", module: "hr", required_permission: Some("hr.employees.list"), icon: "IconUserCog", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "consent", label: "Consent", route: "/consent", module: "consent", required_permission: Some("consent.templates.list"), icon: "IconWriting", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "camp", label: "Camps", route: "/camp", module: "camp", required_permission: Some("camp.list"), icon: "IconCampfire", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "lms", label: "LMS", route: "/lms", module: "lms", required_permission: Some("lms.my_learning.view"), icon: "IconBook", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "admin-users", label: "Users", route: "/admin/users", module: "admin", required_permission: Some("admin.users.list"), icon: "IconUsers", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "admin-roles", label: "Roles", route: "/admin/roles", module: "admin", required_permission: Some("admin.roles.list"), icon: "IconLockAccess", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "admin-groups", label: "Groups", route: "/admin/groups", module: "admin", required_permission: Some("admin.users.list"), icon: "IconUsersGroup", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "admin-sso", label: "Single Sign-On", route: "/admin/sso", module: "admin", required_permission: Some("admin.settings.general.manage"), icon: "IconLockSquareRounded", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "admin-integration", label: "Integration Hub", route: "/admin/integration-hub", module: "admin", required_permission: Some("integration.list"), icon: "IconPlug", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "admin-devices", label: "Devices", route: "/admin/devices", module: "admin", required_permission: Some("devices.list"), icon: "IconDevices", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "admin-settings", label: "Settings", route: "/admin/settings", module: "admin", required_permission: Some("admin.settings.general.manage"), icon: "IconSettings", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "setup-center", label: "Setup Center", route: "/setup", module: "admin", required_permission: Some("admin.settings.general.manage"), icon: "IconChecklist", nav_key: None, brick: None, any_of: &[] },
    ScreenDef { code: "opd.appointments", label: "Appointments", route: "/opd/appointments", module: "opd", required_permission: Some("opd.appointment.list"), icon: "IconCalendar", nav_key: Some("appointments"), brick: Some("opd"), any_of: &[] },
    ScreenDef { code: "opd.telemedicine", label: "Telemedicine", route: "/telemedicine", module: "opd", required_permission: Some("opd.queue.view"), icon: "IconVideo", nav_key: Some("telemedicine"), brick: Some("opd"), any_of: &[] },
    ScreenDef { code: "opd.signoffs", label: "Doctor sign-offs", route: "/doctor/signoffs", module: "opd", required_permission: Some("doctor.signoffs.view_own"), icon: "IconSignature", nav_key: Some("doctorSignoffs"), brick: Some("opd"), any_of: &[] },
    ScreenDef { code: "opd.chronic_care", label: "Chronic care", route: "/chronic-care", module: "opd", required_permission: Some("chronic.enrollments.list"), icon: "IconReportMedical", nav_key: Some("chronicCare"), brick: Some("opd"), any_of: &[] },
];

/// The web copy of the converted apps' side-panel screens and every brick's name, as a
/// TypeScript module. Strings go out through `{:?}`, so a quote in a name cannot break the file.
#[must_use]
pub fn render_ts() -> String {
    let mut out = String::from(
        "// Generated from crates/medbrains-core/src/access/screens.rs; do not edit.\n\
         // Regenerate: UPDATE_APP_SCREENS=1 cargo test -p medbrains-core access::screens\n\n\
         /** One entry in a converted app's side panel. */\n\
         export interface AppScreen {\n  brick: string;\n  path: string;\n  labelKey: string;\n  icon: string;\n  permission: string;\n  anyOf: readonly string[];\n}\n\n\
         /** Every side-panel screen of every converted app, in panel order. */\n\
         export const APP_SCREENS: readonly AppScreen[] = [\n",
    );
    out.extend(SCREENS.iter().filter_map(|s| {
        Some(format!(
            "  {{ brick: {:?}, path: {:?}, labelKey: {:?}, icon: {:?}, permission: {:?}, anyOf: {:?} }},\n",
            s.brick?, s.route, s.nav_key?, s.icon, s.required_permission?, s.any_of
        ))
    }));
    out.push_str(
        "];\n\n/** Each app brick's display name, by `module_config.code`. */\n\
         export const BRICK_NAMES: Readonly<Record<string, string>> = {\n",
    );
    out.extend(
        crate::bricks::BRICKS
            .iter()
            .map(|b| format!("  {:?}: {:?},\n", b.id, b.name)),
    );
    out.push_str("};\n");
    out
}

#[cfg(test)]
mod tests {
    use super::{SCREENS, render_ts};
    use crate::access::catalogue::all_codes;
    use crate::bricks::find;

    const GENERATED: &str = "../../packages/types/src/app-screens.generated.ts";

    #[test]
    fn routes_are_unique_and_permissions_are_real() {
        for (at, screen) in SCREENS.iter().enumerate() {
            assert!(
                SCREENS[..at].iter().all(|s| s.route != screen.route),
                "{} twice",
                screen.route
            );
            for code in screen.required_permission.iter().chain(screen.any_of) {
                assert!(
                    all_codes().contains(code),
                    "{} names unknown {code}",
                    screen.route
                );
            }
        }
    }

    /// A panel screen the web cannot place would be dropped from the menu without a word.
    #[test]
    fn each_panel_screen_names_a_brick_a_label_and_a_permission() {
        for screen in SCREENS.iter().filter(|s| s.brick.is_some()) {
            let brick = screen.brick.unwrap_or_default();
            assert!(
                find(brick).is_some(),
                "{} names unknown brick {brick}",
                screen.route
            );
            assert!(screen.nav_key.is_some(), "{} has no nav_key", screen.route);
            assert!(
                screen.required_permission.is_some(),
                "{} has no permission",
                screen.route
            );
        }
    }

    /// The web reads the generated copy; a stale copy would show screens this table no longer lists.
    #[test]
    fn the_web_copy_is_current() -> std::io::Result<()> {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(GENERATED);
        if std::env::var_os("UPDATE_APP_SCREENS").is_some() {
            std::fs::write(&path, render_ts())?;
        }
        let committed = std::fs::read_to_string(&path)?;
        assert_eq!(
            committed,
            render_ts(),
            "run UPDATE_APP_SCREENS=1 cargo test -p medbrains-core access::screens"
        );
        Ok(())
    }
}

//! The screens each app brick lists in its side panel, the single source for the web launcher and
//! the route guard (`docs/architecture/MODULE-BRICKS.md`).
//!
//! A screen belongs to one brick ([`crate::bricks::BRICKS`]) and opens only for a person holding
//! its permission: the panel leaves out screens they may not open rather than greying them. The
//! permission is the Rust constant, so a typo does not build. `render_ts` writes the web copy,
//! `packages/types/src/app-screens.generated.ts`; a test fails when that copy is stale.

use crate::permissions;

/// One entry in an app's side panel.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Screen {
    /// The brick (`module_config.code`) the screen belongs to.
    pub brick: &'static str,
    /// The web route, absolute.
    pub path: &'static str,
    /// The `nav` translation key for its label.
    pub label_key: &'static str,
    /// The `@tabler/icons-react` component name.
    pub icon: &'static str,
    /// The permission that opens it.
    pub permission: &'static str,
}

/// Every screen of every converted app, in panel order. Apps not yet converted keep their entries
/// in the web's `config/navigation.ts` until their pass.
#[rustfmt::skip]
pub const SCREENS: &[Screen] = &[
    Screen { brick: "opd", path: "/opd", label_key: "opdQueue", icon: "IconStethoscope", permission: permissions::opd::queue::LIST },
    Screen { brick: "opd", path: "/opd/appointments", label_key: "appointments", icon: "IconCalendar", permission: permissions::opd::appointment::LIST },
    Screen { brick: "opd", path: "/telemedicine", label_key: "telemedicine", icon: "IconVideo", permission: permissions::opd::queue::VIEW },
    Screen { brick: "opd", path: "/doctor/signoffs", label_key: "doctorSignoffs", icon: "IconSignature", permission: permissions::doctor::signoffs::VIEW_OWN },
    Screen { brick: "opd", path: "/order-sets", label_key: "orderSets", icon: "IconListDetails", permission: permissions::order_sets::templates::LIST },
    Screen { brick: "opd", path: "/chronic-care", label_key: "chronicCare", icon: "IconReportMedical", permission: permissions::chronic::enrollments::LIST },
];

/// The web copy of [`SCREENS`] as a TypeScript module, written by the test below.
#[must_use]
pub fn render_ts() -> String {
    let mut out = String::from(
        "// Generated from crates/medbrains-core/src/app_screens.rs; do not edit.\n\
         // Regenerate: UPDATE_APP_SCREENS=1 cargo test -p medbrains-core app_screens\n\n\
         /** One entry in an app's side panel. */\n\
         export interface AppScreen {\n  brick: string;\n  path: string;\n  labelKey: string;\n  icon: string;\n  permission: string;\n}\n\n\
         /** Every screen of every converted app, in panel order. */\n\
         export const APP_SCREENS: readonly AppScreen[] = [\n",
    );
    out.extend(SCREENS.iter().map(|s| {
        format!(
            "  {{ brick: \"{}\", path: \"{}\", labelKey: \"{}\", icon: \"{}\", permission: \"{}\" }},\n",
            s.brick, s.path, s.label_key, s.icon, s.permission
        )
    }));
    out.push_str("];\n\n/** Each app brick's display name, by `module_config.code`. */\nexport const BRICK_NAMES: Readonly<Record<string, string>> = {\n");
    out.extend(
        crate::bricks::BRICKS
            .iter()
            .map(|b| format!("  {}: \"{}\",\n", b.id, b.name)),
    );
    out.push_str("};\n");
    out
}

#[cfg(test)]
mod tests {
    use super::{SCREENS, render_ts};
    use crate::bricks::find;

    const GENERATED: &str = "../../packages/types/src/app-screens.generated.ts";

    #[test]
    fn each_screen_belongs_to_a_brick_and_has_one_path() {
        for (at, screen) in SCREENS.iter().enumerate() {
            assert!(
                find(screen.brick).is_some(),
                "{} names unknown brick {}",
                screen.path,
                screen.brick
            );
            assert!(
                screen.path.starts_with('/'),
                "{} is not absolute",
                screen.path
            );
            assert!(
                SCREENS[..at].iter().all(|s| s.path != screen.path),
                "{} twice",
                screen.path
            );
        }
    }

    /// The web reads the generated copy; a stale copy would show screens the server no longer lists.
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
            "run UPDATE_APP_SCREENS=1 cargo test -p medbrains-core app_screens"
        );
        Ok(())
    }
}

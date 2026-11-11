//! What this screen's look is set to: theme and motion, kept in the screen user's own directory
//! on the data partition. A missing or damaged file means the defaults, never a failure.

use gtk4 as gtk;
use gtk4::gdk;

/// The screen's settings file.
const PREFS_FILE: &str = "/var/lib/kiosk/shell-prefs";
/// The look, with colours that depend on the theme in `theme-*.css`.
const STYLE: &str = include_str!("style.css");
const DARK: &str = include_str!("theme-dark.css");
const LIGHT: &str = include_str!("theme-light.css");
/// The face and size for everything GTK draws, popovers included.
const FONT: &str = "MedBrains Sans 11";

/// The screen's settings.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Prefs {
    pub(crate) light: bool,
    pub(crate) reduce_motion: bool,
}

/// Reads settings from the file's text. Dark, with motion, unless it says otherwise.
fn parse(text: &str) -> Prefs {
    let has = |line: &str| text.lines().any(|found| found.trim() == line);
    Prefs {
        light: has("theme=light"),
        reduce_motion: has("motion=reduced"),
    }
}

/// The file's text for these settings.
fn render(prefs: Prefs) -> String {
    let theme = if prefs.light { "light" } else { "dark" };
    let motion = if prefs.reduce_motion {
        "reduced"
    } else {
        "full"
    };
    format!("theme={theme}\nmotion={motion}\n")
}

/// The saved settings.
pub(crate) fn load() -> Prefs {
    parse(&std::fs::read_to_string(PREFS_FILE).unwrap_or_default())
}

/// Saves settings. A failure costs only the choice after the next restart, so it is logged.
pub(crate) fn save(prefs: Prefs) {
    if let Err(error) = std::fs::write(PREFS_FILE, render(prefs)) {
        gtk::glib::g_warning!(
            "medbrains-shell",
            "could not save the screen's settings: {error}"
        );
    }
}

/// Applies settings to the whole display, at start and on every change.
pub(crate) fn apply(prefs: Prefs, css: &gtk::CssProvider) {
    let tokens = if prefs.light { LIGHT } else { DARK };
    css.load_from_string(&format!("{tokens}\n{STYLE}"));
    if let Some(settings) = gtk::Settings::default() {
        settings.set_gtk_application_prefer_dark_theme(!prefs.light);
        settings.set_gtk_enable_animations(!prefs.reduce_motion);
        settings.set_gtk_font_name(Some(FONT));
    }
    if let Some(display) = gdk::Display::default() {
        gtk::style_context_add_provider_for_display(
            &display,
            css,
            gtk::STYLE_PROVIDER_PRIORITY_APPLICATION,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::{Prefs, parse, render};

    #[test]
    fn dark_with_motion_is_the_default_and_damage_falls_back_to_it() {
        let default = Prefs {
            light: false,
            reduce_motion: false,
        };
        assert_eq!(parse(""), default);
        assert_eq!(parse("garbage\n\0"), default);
    }

    #[test]
    fn settings_survive_being_written_and_read() {
        for light in [true, false] {
            for reduce_motion in [true, false] {
                let prefs = Prefs {
                    light,
                    reduce_motion,
                };
                assert_eq!(parse(&render(prefs)), prefs);
            }
        }
    }
}

//! The MedBrains OS screen (OS-BUILD-PLAN S3.1): one full-screen GTK window inside `cage`.
//! It asks the setup service what this machine is, then shows first boot or the desktop.

mod api;
mod apps;
mod child;
mod desktop;
mod display;
mod dock;
mod netmenu;
mod join;
mod main_address;
mod network;
mod power;
mod prefs;
mod running;
mod settings;
mod setup;
mod timezone;
mod topbar;
mod ui;
mod webapp;
mod webview;
mod widgets;
mod wifi_panel;

use std::time::Duration;

use gtk4 as gtk;
use gtk4::prelude::{ApplicationExt, ApplicationExtManual, GtkWindowExt, SettingsExt, WidgetExt};
use gtk4::{gio, glib};

/// How soon to ask again while the service is starting.
const STARTUP_RETRY: Duration = Duration::from_secs(1);
/// How many tries before the wait is called a fault.
const STARTUP_PATIENCE: u32 = 30;

/// Shows the desktop in place of whatever the window held. Setup is dropped, not hidden: its
/// fields still hold the password that was typed.
fn show_desktop(stack: &gtk::Stack, css: &gtk::CssProvider, role: &str) {
    stack.add_named(&desktop::build(css, role), Some("desktop"));
    stack.set_visible_child_name("desktop");
    if let Some(setup) = stack.child_by_name("setup") {
        stack.remove(&setup);
    }
}

/// Shows first boot; finishing it moves on to the desktop.
fn show_setup(stack: &gtk::Stack, css: &gtk::CssProvider) {
    let (target, theme) = (stack.clone(), css.clone());
    // Asks which role setup gave it, rather than assuming: joining and a new hospital both end here.
    let flow = setup::build(move || route_after_setup(target.clone(), theme.clone()));
    stack.add_named(&flow, Some("setup"));
    stack.set_visible_child_name("setup");
    if let Some(child) = flow.visible_child() {
        child.child_focus(gtk::DirectionType::TabForward);
    }
}

/// Shows the desktop for the role setup has just written, trying again until the service says.
fn route_after_setup(stack: gtk::Stack, css: gtk::CssProvider) {
    api::fetch_state(move |result| match result {
        Ok(state) if state.set_up => show_desktop(&stack, &css, &state.role),
        _ => {
            glib::timeout_add_local_once(STARTUP_RETRY, move || route_after_setup(stack, css));
        }
    });
}

/// The sentence while waiting for the setup service, by how long it has been.
const fn starting_words(tries: u32) -> &'static str {
    if tries < STARTUP_PATIENCE {
        "Starting…"
    } else {
        "This machine's setup service isn't answering. Still trying. If this stays, restart the machine."
    }
}

/// Asks what this machine is, until the service answers, saying so if that takes too long.
fn route(stack: gtk::Stack, css: gtk::CssProvider, words: gtk::Label, tries: u32) {
    api::fetch_state(move |result| match result {
        Ok(state) if state.set_up => show_desktop(&stack, &css, &state.role),
        Ok(_) => show_setup(&stack, &css),
        Err(_) => {
            words.set_label(starting_words(tries));
            glib::timeout_add_local_once(STARTUP_RETRY, move || {
                route(stack, css, words, tries.saturating_add(1));
            });
        }
    });
}

/// Turns off GTK's inspector keys (Ctrl+Shift+I and D). It edits the running screen from the screen
/// itself, which nobody at a hospital machine should have. A machine with no such setting has no
/// such keys, and asking for a missing one would end the program.
fn disable_inspector() {
    const SCHEMA: &str = "org.gtk.gtk4.Settings.Debug";
    const KEY: &str = "enable-inspector-keybinding";
    let known = gio::SettingsSchemaSource::default()
        .and_then(|source| source.lookup(SCHEMA, true))
        .is_some_and(|schema| schema.has_key(KEY));
    if known && gio::Settings::new(SCHEMA).set_boolean(KEY, false).is_err() {
        glib::g_warning!("medbrains-shell", "could not turn off the inspector keys");
    }
}

/// Builds the window and routes it.
fn activate(app: &gtk::Application) {
    disable_inspector();
    let css = gtk::CssProvider::new();
    prefs::apply(prefs::load(), &css);
    let stack = ui::stack();
    stack.add_css_class("wallpaper");
    let starting = ui::label("Starting…", "title");
    starting.set_halign(gtk::Align::Center);
    stack.add_named(&starting, Some("starting"));
    let window = gtk::ApplicationWindow::builder()
        .application(app)
        .child(&stack)
        .build();
    window.fullscreen();
    window.present();
    route(stack, css, starting, 0);
}

/// Runs the screen. No arguments are read: this runs only as the appliance's screen.
fn main() -> glib::ExitCode {
    display::set_scale();
    let app = gtk::Application::builder()
        .application_id("in.medbrains.Shell")
        .flags(gio::ApplicationFlags::NON_UNIQUE)
        .build();
    app.connect_activate(activate);
    app.run_with_args::<&str>(&[])
}

#[cfg(test)]
mod tests {
    use super::{STARTUP_PATIENCE, starting_words};

    /// A service that never answers must not look like a machine still starting.
    #[test]
    fn a_long_wait_is_called_a_fault() {
        assert_eq!(starting_words(0), "Starting…");
        assert!(starting_words(STARTUP_PATIENCE).contains("isn't answering"));
    }
}

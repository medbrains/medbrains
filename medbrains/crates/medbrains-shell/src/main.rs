//! The MedBrains OS screen (OS-BUILD-PLAN S3.1): one full-screen GTK window inside `cage`.
//! It asks the setup service what this machine is, then shows first boot or the desktop.

mod api;
mod desktop;
mod join;
mod network;
mod setup;
mod topbar;
mod ui;
mod webapp;

use std::time::Duration;

use gtk4 as gtk;
use gtk4::prelude::{ApplicationExt, ApplicationExtManual, GtkWindowExt, WidgetExt};
use gtk4::{gio, glib};

/// How soon to ask again while the service is starting.
const STARTUP_RETRY: Duration = Duration::from_secs(1);
/// The look, with the colours of `packages/design-system` at the top as tokens.
const STYLE: &str = include_str!("style.css");

/// Shows the desktop in place of whatever the window held. Setup is dropped, not hidden: its
/// fields still hold the password that was typed.
fn show_desktop(stack: &gtk::Stack) {
    stack.add_named(&desktop::build(), Some("desktop"));
    stack.set_visible_child_name("desktop");
    if let Some(setup) = stack.child_by_name("setup") {
        stack.remove(&setup);
    }
}

/// Shows first boot; finishing it moves on to the desktop.
fn show_setup(stack: &gtk::Stack) {
    let target = stack.clone();
    let flow = setup::build(move || show_desktop(&target));
    stack.add_named(&flow, Some("setup"));
    stack.set_visible_child_name("setup");
    if let Some(child) = flow.visible_child() {
        child.child_focus(gtk::DirectionType::TabForward);
    }
}

/// Asks what this machine is, until the service answers.
fn route(stack: gtk::Stack) {
    api::fetch_state(move |result| match result {
        Ok(state) if state.set_up => show_desktop(&stack),
        Ok(_) => show_setup(&stack),
        Err(_) => {
            glib::timeout_add_local_once(STARTUP_RETRY, move || route(stack));
        }
    });
}

/// Builds the window and routes it.
fn activate(app: &gtk::Application) {
    let css = gtk::CssProvider::new();
    css.load_from_string(STYLE);
    if let Some(display) = gtk::gdk::Display::default() {
        gtk::style_context_add_provider_for_display(
            &display,
            &css,
            gtk::STYLE_PROVIDER_PRIORITY_APPLICATION,
        );
    }
    if let Some(settings) = gtk::Settings::default() {
        settings.set_gtk_application_prefer_dark_theme(true);
    }
    let stack = gtk::Stack::new();
    let starting = ui::label("Starting…", "title");
    starting.set_halign(gtk::Align::Center);
    stack.add_named(&starting, Some("starting"));
    let window = gtk::ApplicationWindow::builder()
        .application(app)
        .child(&stack)
        .build();
    window.fullscreen();
    window.present();
    route(stack);
}

/// Runs the screen. No arguments are read: this runs only as the appliance's screen.
fn main() -> glib::ExitCode {
    let app = gtk::Application::builder()
        .application_id("in.medbrains.Shell")
        .flags(gio::ApplicationFlags::NON_UNIQUE)
        .build();
    app.connect_activate(activate);
    app.run_with_args::<&str>(&[])
}

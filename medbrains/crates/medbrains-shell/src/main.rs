//! The MedBrains OS screen (OS-BUILD-PLAN S3.1): one full-screen GTK window inside `cage`.
//! It asks the setup service what this machine is, then shows first boot or the desktop.

mod api;
mod desktop;
mod display;
mod network;
mod prefs;
mod settings;
mod setup;
mod timezone;
mod topbar;
mod ui;
mod webapp;
mod widgets;

use std::time::Duration;

use gtk4 as gtk;
use gtk4::prelude::{ApplicationExt, ApplicationExtManual, GtkWindowExt, WidgetExt};
use gtk4::{gio, glib};

/// How soon to ask again while the service is starting.
const STARTUP_RETRY: Duration = Duration::from_secs(1);

/// Shows the desktop in place of whatever the window held. Setup is dropped, not hidden: its
/// fields still hold the password that was typed.
fn show_desktop(stack: &gtk::Stack, css: &gtk::CssProvider) {
    stack.add_named(&desktop::build(css), Some("desktop"));
    stack.set_visible_child_name("desktop");
    if let Some(setup) = stack.child_by_name("setup") {
        stack.remove(&setup);
    }
}

/// Shows first boot; finishing it moves on to the desktop.
fn show_setup(stack: &gtk::Stack, css: &gtk::CssProvider) {
    let (target, theme) = (stack.clone(), css.clone());
    let flow = setup::build(move || show_desktop(&target, &theme));
    stack.add_named(&flow, Some("setup"));
    stack.set_visible_child_name("setup");
    if let Some(child) = flow.visible_child() {
        child.child_focus(gtk::DirectionType::TabForward);
    }
}

/// Asks what this machine is, until the service answers.
fn route(stack: gtk::Stack, css: gtk::CssProvider) {
    api::fetch_state(move |result| match result {
        Ok(state) if state.set_up => show_desktop(&stack, &css),
        Ok(_) => show_setup(&stack, &css),
        Err(_) => {
            glib::timeout_add_local_once(STARTUP_RETRY, move || route(stack, css));
        }
    });
}

/// Builds the window and routes it.
fn activate(app: &gtk::Application) {
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
    route(stack, css);
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

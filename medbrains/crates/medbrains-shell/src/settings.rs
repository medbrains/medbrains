//! Settings: appearance, network, time zone and what this machine is.

use gtk4 as gtk;
use gtk4::prelude::{BoxExt, ToggleButtonExt, WidgetExt};

use crate::{main_address, network, prefs, timezone, ui, updates};

/// The dark/light choice and the motion switch, applied and saved at once.
fn appearance(css: &gtk::CssProvider) -> gtk::Box {
    let saved = prefs::load();
    let body = ui::column(ui::GAP / 2);
    let choice = ui::row(ui::GAP / 2);
    let dark = gtk::ToggleButton::with_label("Dark");
    let light = gtk::ToggleButton::with_label("Light");
    light.set_group(Some(&dark));
    dark.set_active(!saved.light);
    light.set_active(saved.light);
    choice.append(&dark);
    choice.append(&light);
    body.append(&ui::label("Theme", ""));
    body.append(&choice);
    let motion_row = ui::row(ui::GAP);
    let motion_title = ui::label("Reduce motion", "");
    motion_title.set_hexpand(true);
    let motion = gtk::Switch::builder().active(saved.reduce_motion).build();
    ui::set_name(&motion, "Reduce motion");
    motion_row.append(&motion_title);
    motion_row.append(&motion);
    body.append(&motion_row);

    let (css, reading_light, reading_motion) = (css.clone(), light.clone(), motion.clone());
    let changed = move || {
        let chosen = prefs::Prefs {
            light: reading_light.is_active(),
            reduce_motion: reading_motion.is_active(),
        };
        prefs::apply(chosen, &css);
        prefs::save(chosen);
    };
    let on_toggle = changed.clone();
    light.connect_toggled(move |_| on_toggle());
    motion.connect_state_set(move |_, _| {
        // The switch's own state moves first only after this returns, so defer the read.
        let later = changed.clone();
        gtk::glib::idle_add_local_once(later);
        gtk::glib::Propagation::Proceed
    });
    body
}

/// The Settings page.
pub(crate) fn page(css: &gtk::CssProvider, role: &str) -> gtk::Widget {
    let body = ui::column(ui::GAP);
    body.append(&ui::label("Appearance", "heading"));
    body.append(&appearance(css));
    body.append(&ui::label("Time", "heading"));
    body.append(&timezone::chooser());
    body.append(&ui::label("Network", "heading"));
    body.append(&network::panel(None));
    body.append(&ui::label("Updates", "heading"));
    body.append(&updates::panel());
    if role == "node" {
        body.append(&ui::label("Main machine", "heading"));
        body.append(&main_address::panel());
    }
    body.append(&ui::label("This machine", "heading"));
    let version = std::fs::read_to_string("/etc/os-release").unwrap_or_default();
    let image = version
        .lines()
        .find_map(|line| line.strip_prefix("IMAGE_VERSION="));
    let image = image.map(|value| value.trim_matches('"'));
    body.append(&ui::label(
        &format!("Image version: {}", image.unwrap_or("unknown")),
        "",
    ));
    let page = ui::page("Settings", "", &body, &ui::row(0));
    page.add_css_class("solid");
    page
}

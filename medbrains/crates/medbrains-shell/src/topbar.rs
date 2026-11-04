//! The top bar's two menus: the clock with its calendar, and power.

use gtk4 as gtk;
use gtk4::glib;
use gtk4::prelude::{BoxExt, ButtonExt, PopoverExt, WidgetExt};
use serde_json::json;

use crate::{api, ui};

/// The calendar panel the clock opens, with the time zone and any clock warning.
pub(crate) fn clock_button() -> (gtk::MenuButton, gtk::Label) {
    let panel = ui::column(ui::GAP / 2);
    panel.append(&gtk::Calendar::new());
    let zone = glib::DateTime::now_local()
        .map(|now| now.timezone_abbreviation().to_string())
        .unwrap_or_default();
    panel.append(&ui::label(&format!("Time zone: {zone}"), "muted"));
    let warning = ui::label(
        "This machine has not confirmed the time with a time server, so the time may be wrong.",
        "problem",
    );
    warning.set_max_width_chars(36);
    warning.set_visible(false);
    panel.append(&warning);
    let popover = gtk::Popover::builder().child(&panel).build();
    let button = gtk::MenuButton::builder()
        .popover(&popover)
        .always_show_arrow(false)
        .build();
    ui::set_name(&button, "Date and time");
    (button, warning)
}

/// The power menu: both actions ask first, because this may be the hospital's main machine.
pub(crate) fn power_button() -> gtk::MenuButton {
    let panel = ui::column(ui::GAP / 2);
    let restart = ui::button("Restart…", "");
    let off = ui::button("Power off…", "");
    panel.append(&restart);
    panel.append(&off);
    let popover = gtk::Popover::builder().child(&panel).build();
    let button = gtk::MenuButton::builder()
        .popover(&popover)
        .icon_name("system-shutdown-symbolic")
        .always_show_arrow(false)
        .build();
    ui::set_name(&button, "Power");
    let detail = "Everyone using MedBrains on this machine is disconnected until it is back.";
    for (control, question, yes, action) in [
        (&restart, "Restart this machine?", "Restart", "restart"),
        (&off, "Power off this machine?", "Power off", "off"),
    ] {
        let source = popover.clone();
        control.connect_clicked(move |control| {
            source.popdown();
            ui::confirm(control, question, detail, yes, move || {
                api::post("/power", &json!({ "action": action }), |_| {});
            });
        });
    }
    button
}

/// Redraws the clock only if its text has changed, so an idle screen repaints nothing.
pub(crate) fn set_clock(clock: &gtk::MenuButton) {
    if let Some(text) = clock_text() {
        if clock.label().as_deref() != Some(text.as_str()) {
            clock.set_label(&text);
        }
    }
}

/// The clock's text, or nothing if the system cannot say.
fn clock_text() -> Option<String> {
    let now = glib::DateTime::now_local().ok()?;
    Some(now.format("%a %-d %b  %H:%M").ok()?.to_string())
}

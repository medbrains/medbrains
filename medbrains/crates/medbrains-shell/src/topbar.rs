//! The top bar's two menus: the clock with its calendar, and power.

use std::cell::Cell;
use std::rc::Rc;

use gtk4 as gtk;
use gtk4::glib;
use gtk4::prelude::{BoxExt, ButtonExt, PopoverExt, WidgetExt};
use serde_json::json;

use crate::{api, ui};

/// Wide enough for the longer question and both its answers.
const POWER_MENU_WIDTH: i32 = 288;

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

/// The power menu. Both actions ask first, inside the menu, because this may be the hospital's
/// main machine. No separate window: `cage` did not show a dialog window, and its modal grab
/// then blocked all input.
pub(crate) fn power_button() -> gtk::MenuButton {
    let choose = ui::column(ui::GAP / 2);
    let restart = ui::button("Restart…", "");
    let off = ui::button("Power off…", "");
    choose.append(&restart);
    choose.append(&off);
    let ask = ui::column(ui::GAP / 2);
    ask.set_visible(false);
    let question = ui::label("", "heading");
    question.set_max_width_chars(32);
    let detail = ui::label(
        "Everyone using MedBrains on this machine is disconnected until it is back.",
        "",
    );
    detail.set_max_width_chars(32);
    let answers = ui::row(ui::GAP / 2);
    let cancel = ui::button("Cancel", "");
    let accept = ui::button("", "destructive-action");
    answers.append(&cancel);
    answers.append(&accept);
    ask.append(&question);
    ask.append(&detail);
    ask.append(&answers);
    let panel = ui::column(0);
    // Its widest from the start: a menu that grows once open runs off the screen's edge.
    panel.set_width_request(POWER_MENU_WIDTH);
    panel.append(&choose);
    panel.append(&ask);
    // Moved inward, because `cage` does not slide a menu back on screen by itself.
    let popover = gtk::Popover::builder()
        .child(&panel)
        .has_arrow(false)
        .build();
    popover.set_offset(-POWER_MENU_WIDTH / 2, 0);
    let button = gtk::MenuButton::builder()
        .popover(&popover)
        .icon_name("system-shutdown-symbolic")
        .always_show_arrow(false)
        .build();
    ui::set_name(&button, "Power");

    let action = Rc::new(Cell::new("restart"));
    for (control, words, yes, verb) in [
        (&restart, "Restart this machine?", "Restart", "restart"),
        (&off, "Power off this machine?", "Power off", "off"),
    ] {
        let (choose, ask, question, cancel, accept, action) = (
            choose.clone(),
            ask.clone(),
            question.clone(),
            cancel.clone(),
            accept.clone(),
            Rc::clone(&action),
        );
        control.connect_clicked(move |_| {
            question.set_label(words);
            accept.set_label(yes);
            action.set(verb);
            choose.set_visible(false);
            ask.set_visible(true);
            cancel.grab_focus();
        });
    }
    let source = popover.clone();
    cancel.connect_clicked(move |_| source.popdown());
    let source = popover.clone();
    accept.connect_clicked(move |_| {
        source.popdown();
        api::post("/power", &json!({ "action": action.get() }), |_| {});
    });
    // Closing by any route, including Escape, starts again from the two choices.
    popover.connect_closed(move |_| {
        ask.set_visible(false);
        choose.set_visible(true);
    });
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

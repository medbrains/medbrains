//! The power menu and what happens after it. Both actions ask first, inside the menu, because this
//! may be the hospital's main machine. No separate window: `cage` did not show a dialog window, and
//! its modal grab then blocked all input. The screen always says how it went.

use std::cell::Cell;
use std::rc::Rc;

use gtk4 as gtk;
use gtk4::prelude::{BoxExt, ButtonExt, PopoverExt, WidgetExt};
use serde_json::json;

use crate::{api, ui};

/// Wide enough for the longer question and both its answers.
const MENU_WIDTH: i32 = 288;

/// The sentence once the machine has accepted a power action.
pub(crate) const fn accepted_words(action: &str) -> &'static str {
    match action.as_bytes() {
        b"off" => "Powering off. This can take a minute.",
        _ => "Restarting. This can take a minute, and the desktop comes back by itself.",
    }
}

/// The sentence if the machine is still on after it accepted.
pub(crate) const fn stuck_words(action: &str) -> &'static str {
    match action.as_bytes() {
        b"off" => "This machine has not powered off after 2 minutes. Use its power button.",
        _ => "This machine has not restarted after 2 minutes. Use its power button.",
    }
}

/// The menu's button. `accepted` runs with the action once the machine has taken it.
pub(crate) fn button(accepted: Rc<dyn Fn(&'static str)>) -> gtk::MenuButton {
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
    let problem = ui::label("", "problem");
    problem.set_max_width_chars(32);
    let answers = ui::row(ui::GAP / 2);
    let cancel = ui::button("Cancel", "");
    let accept = ui::button("", "destructive-action");
    answers.append(&cancel);
    answers.append(&accept);
    ask.append(&question);
    ask.append(&detail);
    ask.append(&problem);
    ask.append(&answers);
    let panel = ui::column(0);
    // Its widest from the start: a menu that grows once open runs off the screen's edge.
    panel.set_width_request(MENU_WIDTH);
    panel.append(&choose);
    panel.append(&ask);
    // Moved inward, because `cage` does not slide a menu back on screen by itself.
    let popover = gtk::Popover::builder()
        .child(&panel)
        .has_arrow(false)
        .build();
    popover.set_offset(-MENU_WIDTH / 2, 0);
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
    let (source, words) = (popover.clone(), problem.clone());
    accept.connect_clicked(move |control| {
        control.set_sensitive(false);
        words.set_label("");
        let verb = action.get();
        let (source, words, control, accepted) = (
            source.clone(),
            words.clone(),
            control.clone(),
            Rc::clone(&accepted),
        );
        api::post("/power", &json!({ "action": verb }), move |result| {
            control.set_sensitive(true);
            match result {
                Ok(_) => {
                    source.popdown();
                    accepted(verb);
                }
                // Stays in the menu, so the refusal is seen where the person is looking.
                Err(failure) => words.set_label(&failure.text()),
            }
        });
    });
    // Closing by any route, including Escape, starts again from the two choices.
    popover.connect_closed(move |_| {
        problem.set_label("");
        ask.set_visible(false);
        choose.set_visible(true);
    });
    button
}

#[cfg(test)]
mod tests {
    use super::{accepted_words, stuck_words};

    /// A restart under a VM host can simply stop, so the screen must never look frozen or blank.
    #[test]
    fn each_action_says_what_is_happening_and_what_to_do_if_it_sticks() {
        assert!(accepted_words("restart").contains("comes back by itself"));
        assert!(accepted_words("off").starts_with("Powering off"));
        assert!(stuck_words("restart").contains("power button"));
        assert!(stuck_words("off").contains("power button"));
    }
}

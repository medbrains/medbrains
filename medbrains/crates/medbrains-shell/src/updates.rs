//! Settings' Updates panel: what this machine runs, what waits, how the last one went, and the few
//! things a person can do about it. A restart always asks first, inside the panel.

use gtk4 as gtk;
use gtk4::prelude::{BoxExt, ButtonExt, EditableExt, WidgetExt};
use serde_json::json;

use crate::api::{self, UpdateStatus};
use crate::ui;

const POLL_SECONDS: u32 = 5;
const WHEN_FORMAT: &str = "%e %b %Y, %H:%M";

/// A time for the screen, or nothing if it can't be shown.
fn when(seconds: i64) -> String {
    gtk::glib::DateTime::from_unix_local(seconds)
        .and_then(|time| time.format(WHEN_FORMAT))
        .map_or_else(|_| String::new(), |text| text.trim().to_owned())
}

/// One line about the last attempt and the last look, or nothing if neither has happened. The look is shown
/// so a channel that stops answering, or is held back, is noticed.
pub(crate) fn last_words(status: &UpdateStatus) -> String {
    let mut words = Vec::new();
    if let Some(last) = &status.last {
        words.push(format!("Last result: {} ({})", last.words, when(last.at)));
    }
    if let Some(checked) = status.checked {
        words.push(format!("Last looked for updates: {}.", when(checked)));
    }
    words.join(" ")
}

/// What the top bar shows, if anything, and whether it is a warning. Nothing when all is well. An alarm
/// comes first: a security fix waiting too long, or a system that failed its seal check.
pub(crate) fn chip_words(status: &UpdateStatus) -> Option<(&'static str, bool)> {
    if !status.alarm.is_empty() {
        return Some(if status.stage == "waiting" && status.security {
            ("Security fix overdue", true)
        } else {
            ("System damaged", true)
        });
    }
    if status.stage == "waiting" {
        return Some(if status.security {
            ("Security fix ready", true)
        } else {
            ("Update ready", false)
        });
    }
    if status.stage == "fault" {
        return Some(("Updates need attention", true));
    }
    let went_wrong = status
        .last
        .as_ref()
        .is_some_and(|last| matches!(last.result.as_str(), "rolled_back" | "failed"));
    went_wrong.then_some(("Last update failed", true))
}

/// The panel's controls, kept together so the poll can update them.
#[derive(Clone)]
struct Panel {
    version: gtk::Label,
    headline: gtk::Label,
    summary: gtk::Label,
    last: gtk::Label,
    problem: gtk::Label,
    check: gtk::Button,
    usb: gtk::Button,
    apply: gtk::Button,
    retry: gtk::Button,
    back: gtk::Button,
}

impl Panel {
    /// Shows one answer. Each control appears only when the machine would accept it.
    fn show(&self, status: &UpdateStatus) {
        self.version
            .set_label(&format!("This machine runs version {}.", status.current));
        self.headline.set_label(&status.headline);
        self.summary.set_label(&status.summary);
        self.summary.set_visible(!status.summary.is_empty());
        self.last.set_label(&last_words(status));
        self.check
            .set_visible(status.can_install && !status.url.is_empty());
        self.usb.set_visible(status.can_install);
        self.apply.set_visible(status.can_apply);
        let failed = status
            .last
            .as_ref()
            .is_some_and(|last| matches!(last.result.as_str(), "rolled_back" | "went_back"));
        self.retry.set_visible(status.can_install && failed);
        self.back.set_visible(status.can_go_back);
        self.back
            .set_label(&format!("Go back to version {}…", status.previous));
    }
}

/// Reads the machine's answer into the panel.
fn refresh(panel: &Panel) {
    let panel = panel.clone();
    api::fetch_updates(move |result| match result {
        Ok(status) => panel.show(&status),
        Err(failure) => panel.problem.set_label(&failure.text()),
    });
}

/// Sends an action. The problem line says why, if the machine refuses.
fn send_action(action: &'static str, problem: &gtk::Label) {
    problem.set_label("");
    let words = problem.clone();
    api::post(
        "/update/action",
        &json!({ "action": action }),
        move |result| {
            if let Err(failure) = result {
                words.set_label(&failure.text());
            }
        },
    );
}

/// Opens the restart question for one action, with the words it asks.
type Ask = std::rc::Rc<dyn Fn(&'static str, &str)>;

/// A question that asks before a restart. Returns its box and a way to open it for one action.
fn confirmation(problem: &gtk::Label) -> (gtk::Box, Ask) {
    let ask = ui::column(ui::GAP / 2);
    ask.set_visible(false);
    let question = ui::label("", "heading");
    let answers = ui::row(ui::GAP / 2);
    let cancel = ui::button("Cancel", "");
    let accept = ui::button("Restart now", "destructive-action");
    answers.append(&cancel);
    answers.append(&accept);
    ask.append(&question);
    ask.append(&answers);
    let action = std::rc::Rc::new(std::cell::Cell::new("apply"));
    let hide = ask.clone();
    cancel.connect_clicked(move |_| hide.set_visible(false));
    let (hide, chosen, words) = (ask.clone(), std::rc::Rc::clone(&action), problem.clone());
    accept.connect_clicked(move |_| {
        hide.set_visible(false);
        send_action(chosen.get(), &words);
    });
    let (show, question_label) = (ask.clone(), question);
    let open = move |verb: &'static str, text: &str| {
        action.set(verb);
        question_label.set_label(text);
        show.set_visible(true);
        cancel.grab_focus();
    };
    (ask, std::rc::Rc::new(open))
}

/// The address and quiet-window fields, with their Save button.
fn settings_form(problem: &gtk::Label) -> gtk::Box {
    let form = ui::column(ui::GAP / 2);
    let address = gtk::Entry::builder()
        .placeholder_text("Update address, https://…")
        .build();
    ui::set_name(&address, "Update address");
    let window = gtk::Entry::builder()
        .placeholder_text("Quiet window, such as 02:00-04:00")
        .build();
    ui::set_name(&window, "Quiet window");
    let save = ui::button("Save update settings", "");
    form.append(&ui::label(
        "Leave the address empty and this machine never looks for updates. Leave the window empty and only a person starts an update's restart.",
        "muted",
    ));
    form.append(&address);
    form.append(&window);
    form.append(&save);
    let (read_address, read_window) = (address.clone(), window.clone());
    api::fetch_updates(move |result| {
        if let Ok(status) = result {
            read_address.set_text(&status.url);
            read_window.set_text(&status.window);
        }
    });
    let words = problem.clone();
    save.connect_clicked(move |_| {
        words.set_label("");
        let body = json!({ "address": address.text().as_str(), "window": window.text().as_str() });
        let shown = words.clone();
        api::post("/update/settings", &body, move |result| {
            if let Err(failure) = result {
                shown.set_label(&failure.text());
            }
        });
    });
    form
}

/// The panel. Polls only while it is on screen.
pub(crate) fn panel() -> gtk::Box {
    let root = ui::column(ui::GAP / 2);
    let panel = Panel {
        version: ui::label("", ""),
        headline: ui::label("", ""),
        summary: ui::label("", "muted"),
        last: ui::label("", "muted"),
        problem: ui::label("", "problem"),
        check: ui::button("Look for updates", ""),
        usb: ui::button("Install from a USB stick", ""),
        apply: ui::button("Restart to update…", "suggested-action"),
        retry: ui::button("Try that version again", ""),
        back: ui::button("", ""),
    };
    for line in [
        &panel.version,
        &panel.headline,
        &panel.summary,
        &panel.last,
        &panel.problem,
    ] {
        root.append(line);
    }
    let actions = ui::row(ui::GAP / 2);
    for control in [
        &panel.apply,
        &panel.check,
        &panel.usb,
        &panel.retry,
        &panel.back,
    ] {
        control.set_visible(false);
        actions.append(control);
    }
    root.append(&actions);
    let (ask, open) = confirmation(&panel.problem);
    root.append(&ask);
    root.append(&settings_form(&panel.problem));
    let words = panel.problem.clone();
    panel
        .check
        .connect_clicked(move |_| send_action("install", &words));
    let words = panel.problem.clone();
    panel
        .usb
        .connect_clicked(move |_| send_action("usb", &words));
    let words = panel.problem.clone();
    panel
        .retry
        .connect_clicked(move |_| send_action("install-retry", &words));
    let ask_apply = std::rc::Rc::clone(&open);
    panel.apply.connect_clicked(move |_| {
        ask_apply(
            "apply",
            "Restart this machine now? Everyone using it is disconnected until it is back.",
        );
    });
    panel.back.connect_clicked(move |_| {
        open("go-back", "Go back to the previous version? The machine restarts, and everyone using it is disconnected until it is back.");
    });
    refresh(&panel);
    let (watching, on_screen) = (panel, root.clone());
    gtk::glib::timeout_add_seconds_local(POLL_SECONDS, move || {
        if on_screen.is_mapped() {
            refresh(&watching);
        }
        gtk::glib::ControlFlow::Continue
    });
    root
}

#[cfg(test)]
mod tests {
    use super::chip_words;
    use crate::api::{UpdateLast, UpdateStatus};

    /// A status at `stage`.
    fn status(stage: &str, security: bool) -> UpdateStatus {
        UpdateStatus {
            stage: stage.to_owned(),
            security,
            ..UpdateStatus::default()
        }
    }

    /// The top bar stays quiet unless a person has something to know.
    #[test]
    fn the_top_bar_speaks_only_when_needed() {
        assert_eq!(chip_words(&status("idle", false)), None);
        assert_eq!(
            chip_words(&status("waiting", false)),
            Some(("Update ready", false))
        );
        assert_eq!(
            chip_words(&status("waiting", true)),
            Some(("Security fix ready", true))
        );
        assert_eq!(
            chip_words(&status("fault", false)),
            Some(("Updates need attention", true))
        );
        let mut failed = status("idle", false);
        failed.last = Some(UpdateLast {
            result: "rolled_back".to_owned(),
            ..UpdateLast::default()
        });
        assert_eq!(chip_words(&failed), Some(("Last update failed", true)));
        failed.last = Some(UpdateLast {
            result: "good".to_owned(),
            ..UpdateLast::default()
        });
        assert_eq!(chip_words(&failed), None);
        let mut overdue = status("waiting", true);
        overdue.alarm = "A security fix has waited more than three days.".to_owned();
        assert_eq!(chip_words(&overdue), Some(("Security fix overdue", true)));
        let mut damaged = status("idle", false);
        damaged.alarm = "The system partition failed its seal check.".to_owned();
        assert_eq!(chip_words(&damaged), Some(("System damaged", true)));
    }
}

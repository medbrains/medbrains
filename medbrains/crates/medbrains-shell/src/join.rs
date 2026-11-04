//! "Connecting to my hospital": finds main machines through the agent, asks to join one, and shows
//! the code a person checks against the main machine. The agent holds the key; this only asks it.

use std::cell::{Cell, RefCell};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::rc::Rc;
use std::time::Duration;

use gtk4 as gtk;
use gtk4::prelude::{BoxExt, ButtonExt, CheckButtonExt, EditableExt, WidgetExt};
use gtk4::{gio, glib};
use serde_json::{Value, json};

use crate::api;
use crate::network;
use crate::ui;

const AGENT_SOCKET: &str = "/run/medbrains-agent/control.sock";
const AGENT_TIMEOUT: Duration = Duration::from_secs(5);
/// How often the list of main machines is refreshed while it is on screen.
const LIST_EVERY: Duration = Duration::from_secs(2);
/// How often a waiting machine looks for the decision.
const STATUS_EVERY: Duration = Duration::from_secs(1);
const NOT_ANSWERING: &str = "This machine's agent is not answering. Try again in a moment.";
const NAME_NEEDED: &str = "Give this machine a name first, such as Reception 1.";

/// One line of JSON to the agent, and one back.
fn ask_agent(request: &Value) -> Option<Value> {
    let mut stream = UnixStream::connect(AGENT_SOCKET).ok()?;
    stream.set_read_timeout(Some(AGENT_TIMEOUT)).ok()?;
    stream.set_write_timeout(Some(AGENT_TIMEOUT)).ok()?;
    writeln!(stream, "{request}").ok()?;
    let mut line = String::new();
    BufReader::new(stream).read_line(&mut line).ok()?;
    serde_json::from_str(&line).ok()
}

/// Asks the agent on a worker thread, so the screen never waits on it.
fn agent(request: Value, done: impl FnOnce(Option<Value>) + 'static) {
    glib::spawn_future_local(async move {
        done(gio::spawn_blocking(move || ask_agent(&request)).await.ok().flatten());
    });
}

/// What a final state means, in words. `None` while there is more to wait for.
fn decision_words(state: &str) -> Option<&'static str> {
    match state {
        "rejected" => Some("The main machine refused this machine. Ask your administrator."),
        "expired" => Some("Nobody approved this machine in time. Go back and ask again."),
        "dropped" => Some("Newer requests pushed this one out of the list. Choose the main machine to ask again."),
        "unreachable" => Some("The main machine could not be reached. Check the cable and try again."),
        _ => None,
    }
}

/// The name and id of each main machine in the agent's answer.
fn found_machines(answer: &Value) -> Vec<(String, String)> {
    let list = answer.get("found").and_then(Value::as_array);
    list.into_iter()
        .flatten()
        .filter_map(|machine| {
            let id = machine.get("id")?.as_str()?.to_owned();
            let name = machine.get("name").and_then(Value::as_str).unwrap_or("Main machine");
            let address = machine.pointer("/addresses/0").and_then(Value::as_str).unwrap_or("");
            Some((format!("{name}  {address}"), id))
        })
        .collect()
}

/// The parts of the page that change.
#[derive(Clone)]
struct Parts {
    name: gtk::Entry,
    display: gtk::CheckButton,
    list: gtk::Box,
    problem: gtk::Label,
    choosing: gtk::Box,
    waiting: gtk::Box,
    code: gtk::Label,
    status: gtk::Label,
    finished: Rc<dyn Fn()>,
    /// What the list shows now.
    shown: Rc<RefCell<Option<Vec<(String, String)>>>>,
}

impl Parts {
    /// Asks the agent to join this machine, then waits for the decision.
    fn join(&self, id: String) {
        let name = self.name.text().trim().to_owned();
        if name.is_empty() {
            self.problem.set_label(NAME_NEEDED);
            return;
        }
        let kind = if self.display.is_active() { "display" } else { "workstation" };
        let request = json!({ "op": "join", "id": id, "name": name, "kind": kind });
        let parts = self.clone();
        agent(request, move |answer| match answer {
            Some(answer) if answer.get("ok").is_some() => {
                parts.problem.set_label("");
                parts.choosing.set_visible(false);
                parts.waiting.set_visible(true);
                parts.status.set_label("Connecting to the main machine…");
                parts.poll_decision();
            }
            answer => {
                let error = answer.as_ref().and_then(|a| a.get("error")).and_then(Value::as_str);
                parts.problem.set_label(error.unwrap_or(NOT_ANSWERING));
            }
        });
    }

    /// Follows the request until it is decided.
    fn poll_decision(&self) {
        let parts = self.clone();
        let again = Rc::new(Cell::new(true));
        glib::timeout_add_local(STATUS_EVERY, move || {
            let (parts, again_now) = (parts.clone(), Rc::clone(&again));
            agent(json!({ "op": "status" }), move |answer| {
                if again_now.get() && parts.show_status(answer.as_ref()) {
                    again_now.set(false);
                }
            });
            if again.get() { glib::ControlFlow::Continue } else { glib::ControlFlow::Break }
        });
    }

    /// Shows how the request stands. True once nothing more will change.
    fn show_status(&self, answer: Option<&Value>) -> bool {
        let Some(answer) = answer else {
            self.status.set_label(NOT_ANSWERING);
            return false;
        };
        if let Some(code) = answer.get("code").and_then(Value::as_str) {
            self.code.set_label(code);
        }
        let state = answer.get("state").and_then(Value::as_str).unwrap_or("");
        if state == "approved" {
            self.finish();
            return true;
        }
        if let Some(words) = decision_words(state) {
            // Back to choosing, with the reason, so a person can simply try again.
            self.problem.set_label(words);
            self.waiting.set_visible(false);
            self.choosing.set_visible(true);
            refresh_while_shown(self);
            return true;
        }
        if state == "pending" {
            self.status.set_label(
                "Check that the main machine shows these digits, then type them there to approve \
                 this machine. If they differ, do not approve it.",
            );
        }
        false
    }

    /// Approved: the setup service makes this machine a node.
    fn finish(&self) {
        self.status.set_label("Approved. Starting…");
        let parts = self.clone();
        api::post("/node/finish", &json!({}), move |result| match result {
            Ok(_) => (parts.finished)(),
            Err(failure) => parts.status.set_label(&failure.text()),
        });
    }

    /// Replaces the list of main machines with `machines`, one button each. Only when it changed:
    /// a button rebuilt under the pointer or the keyboard focus would swallow the press.
    fn show_list(&self, machines: Vec<(String, String)>) {
        if self.shown.replace(Some(machines.clone())).as_ref() == Some(&machines) {
            return;
        }
        while let Some(child) = self.list.first_child() {
            self.list.remove(&child);
        }
        if machines.is_empty() {
            self.list.append(&ui::label(
                "Looking for main machines on this network… If none appear, type its address below.",
                "muted",
            ));
        }
        for (words, id) in machines {
            let button = ui::button(&words, "");
            let parts = self.clone();
            button.connect_clicked(move |_| parts.join(id.clone()));
            self.list.append(&button);
        }
    }
}

/// The machine-type choice; returns the display option, since workstation is the rest.
fn type_choice(form: &gtk::Box) -> gtk::CheckButton {
    let workstation = gtk::CheckButton::with_label("Workstation: people sign in and work here");
    let display = gtk::CheckButton::with_label("Display: shows a board, nobody signs in");
    display.set_group(Some(&workstation));
    workstation.set_active(true);
    form.append(&workstation);
    form.append(&display);
    display
}

/// The fallback for a network with no multicast: type the main machine's address.
fn address_row(form: &gtk::Box, parts: &Parts) {
    let address = network::field(form, "Or type the main machine's address", "192.168.1.20");
    let find = ui::button("Find", "");
    form.append(&find);
    let parts = parts.clone();
    find.connect_clicked(move |_| {
        let request = json!({ "op": "find", "address": address.text().to_string() });
        let parts = parts.clone();
        agent(request, move |answer| {
            let error = answer.as_ref().and_then(|a| a.get("error")).and_then(Value::as_str);
            match (error, answer.as_ref().map(found_machines)) {
                (None, Some(machines)) => {
                    parts.problem.set_label("");
                    parts.show_list(machines);
                }
                (error, _) => parts.problem.set_label(error.unwrap_or(NOT_ANSWERING)),
            }
        });
    });
}

/// Keeps the list current while it is on screen. A typed address stays in the agent's list too,
/// so it survives each refresh.
fn refresh_while_shown(parts: &Parts) {
    let parts = parts.clone();
    glib::timeout_add_local(LIST_EVERY, move || {
        if !parts.choosing.is_visible() {
            return glib::ControlFlow::Break;
        }
        if parts.choosing.is_mapped() {
            let parts = parts.clone();
            agent(json!({ "op": "discover" }), move |answer| {
                if let Some(answer) = answer {
                    parts.show_list(found_machines(&answer));
                }
            });
        }
        glib::ControlFlow::Continue
    });
}

/// Builds the page. `finished` runs once this machine is a node.
pub(crate) fn page(actions: &gtk::Box, finished: Rc<dyn Fn()>) -> gtk::Widget {
    let body = ui::column(ui::GAP);
    let choosing = ui::column(ui::GAP / 2);
    let name = network::field(&choosing, "A name for this machine", "Reception 1");
    let display = type_choice(&choosing);
    choosing.append(&ui::label("Main machines on this network", "heading"));
    let list = ui::column(ui::GAP / 2);
    choosing.append(&list);
    let problem = ui::label("", "problem");
    let waiting = ui::column(ui::GAP / 2);
    let code = ui::label("", "title");
    let status = ui::label("", "");
    waiting.append(&code);
    waiting.append(&status);
    waiting.set_visible(false);
    let parts = Parts {
        name, display, list, problem: problem.clone(), choosing: choosing.clone(),
        waiting: waiting.clone(), code, status, finished, shown: Rc::default(),
    };
    parts.show_list(Vec::new());
    address_row(&choosing, &parts);
    body.append(&choosing);
    body.append(&problem);
    body.append(&waiting);
    refresh_while_shown(&parts);
    let words = "Choose your hospital's main machine. It will show a code, and a person approves \
                 this machine there.";
    ui::page("Connecting to my hospital", words, &body, actions)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{decision_words, found_machines};

    /// This is the agent's real answer; a renamed field would otherwise show an empty list.
    #[test]
    fn the_list_is_read_from_the_agents_answer() {
        let answer = json!({ "found": [
            { "id": "abc", "name": "City Hospital", "addresses": ["192.168.1.20:7844"] }
        ]});
        assert_eq!(
            found_machines(&answer),
            vec![("City Hospital  192.168.1.20:7844".to_owned(), "abc".to_owned())]
        );
        assert!(found_machines(&json!({ "error": "x" })).is_empty());
    }

    /// Waiting and an unknown state must not read as a refusal, nor a refusal as waiting.
    #[test]
    fn only_final_refusals_have_words() {
        for state in ["rejected", "expired", "dropped", "unreachable"] {
            assert!(decision_words(state).is_some(), "{state}");
        }
        for state in ["pending", "connecting", "approved", "idle", ""] {
            assert!(decision_words(state).is_none(), "{state}");
        }
    }
}

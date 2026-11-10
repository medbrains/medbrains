//! Settings on a node: where to look for the main machine. Normally nobody needs this, since mDNS
//! follows the main machine by its key. On a network that blocks multicast, a person types the new
//! address; the agent takes it only if the same key answers there.

use gtk4 as gtk;
use gtk4::prelude::{BoxExt, ButtonExt, EditableExt};
use serde_json::{Value, json};

use crate::join::agent;
use crate::{network, ui};

const NOT_ANSWERING: &str = "This machine's agent is not answering. Try again in a moment.";
const SAVED: &str = "Saved. This machine now looks there, and reconnects in a few seconds.";

/// The sentence for what the agent knows about the main machine.
fn main_words(answer: &Value) -> Option<String> {
    let hospital = answer.get("hospital")?.as_str()?;
    let address = answer.pointer("/addresses/0").and_then(Value::as_str).unwrap_or("not known");
    Some(format!("Joined to {hospital}. Last address: {address}"))
}

/// The sentence for what became of a typed address.
fn result_words(answer: Option<&Value>) -> &str {
    match answer {
        Some(answer) if answer.get("ok").is_some() => SAVED,
        Some(answer) => answer.get("error").and_then(Value::as_str).unwrap_or(NOT_ANSWERING),
        None => NOT_ANSWERING,
    }
}

/// The panel: what this machine joined, and a place to type where it went.
pub(crate) fn panel() -> gtk::Box {
    let body = ui::column(ui::GAP / 2);
    let current = ui::label("", "muted");
    body.append(&current);
    body.append(&ui::label(
        "This machine finds the main machine by itself. Type an address only if it says it cannot \
         reach it and your network blocks that search.",
        "muted",
    ));
    let address = network::field(&body, "Main machine's address", "192.168.1.20");
    let apply = ui::button("Use this address", "");
    let result = ui::label("", "");
    body.append(&apply);
    body.append(&result);

    let show_current = current.clone();
    agent(json!({ "op": "main" }), move |answer| {
        let words = answer.as_ref().and_then(main_words);
        show_current.set_label(&words.unwrap_or_else(|| NOT_ANSWERING.to_owned()));
    });
    apply.connect_clicked(move |_| {
        let request = json!({ "op": "readdress", "address": address.text().to_string() });
        let (result, current) = (result.clone(), current.clone());
        result.set_label("Asking that address…");
        agent(request, move |answer| {
            result.set_label(result_words(answer.as_ref()));
            agent(json!({ "op": "main" }), move |answer| {
                if let Some(words) = answer.as_ref().and_then(main_words) {
                    current.set_label(&words);
                }
            });
        });
    });
    body
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{NOT_ANSWERING, SAVED, main_words, result_words};

    /// These are the agent's real answers; a renamed field would otherwise show nothing.
    #[test]
    fn the_agents_answers_become_sentences() {
        let joined = json!({ "hospital": "City", "addresses": ["192.168.1.20:7844"] });
        assert_eq!(
            main_words(&joined).as_deref(),
            Some("Joined to City. Last address: 192.168.1.20:7844")
        );
        assert_eq!(main_words(&json!({ "error": "x" })), None);
    }

    /// A refused address must be said, never reported as saved.
    #[test]
    fn only_an_accepted_address_says_saved() {
        assert_eq!(result_words(Some(&json!({ "ok": true }))), SAVED);
        assert_eq!(result_words(Some(&json!({ "error": "A different machine" }))), "A different machine");
        assert_eq!(result_words(None), NOT_ANSWERING);
    }
}

//! The network panel, shared by first boot and Settings: what is plugged in, what can be
//! reached, and a fixed address that undoes itself unless confirmed.

use std::cell::Cell;
use std::rc::Rc;
use std::time::Duration;

use gtk4 as gtk;
use gtk4::glib;
use gtk4::prelude::{
    AccessibleExtManual, BoxExt, ButtonExt, Cast, EditableExt, EntryExt, ListModelExt, WidgetExt,
};
use serde_json::json;

use crate::api::{self, Network};
use crate::ui;

/// How often the panel re-checks while it is on screen.
const CHECK_EVERY: Duration = Duration::from_secs(10);

/// The widgets the panel keeps updating.
#[derive(Clone)]
struct Panel {
    root: gtk::Box,
    cable: gtk::Label,
    addresses: gtk::Label,
    local: gtk::Label,
    internet: gtk::Label,
    wifi: gtk::Label,
    message: gtk::Label,
    interface: gtk::DropDown,
    names: gtk::StringList,
    automatic: gtk::Button,
    /// Shown while a new address waits to be confirmed.
    waiting: gtk::Box,
    countdown: gtk::Label,
    /// Which wait is current, so an old countdown stops counting.
    wait: Rc<Cell<u64>>,
}

/// One "name: value" line of the status block.
fn status_line(parent: &gtk::Box, name: &str) -> gtk::Label {
    let line = ui::row(ui::GAP);
    let title = ui::label(name, "muted");
    title.set_width_chars(16);
    let value = ui::label("Checking…", "");
    line.append(&title);
    line.append(&value);
    parent.append(&line);
    value
}

/// An entry with a visible label that a screen reader announces with it.
pub(crate) fn field(parent: &gtk::Box, name: &str, hint: &str) -> gtk::Entry {
    let title = ui::label(name, "");
    let entry = gtk::Entry::new();
    entry.set_placeholder_text(Some(hint));
    entry.update_relation(&[gtk::accessible::Relation::LabelledBy(&[title.upcast_ref()])]);
    parent.append(&title);
    parent.append(&entry);
    entry
}

/// Words for a cable state, across every link.
fn cable_words(network: &Network) -> String {
    if network.links.is_empty() {
        return "No network card found.".to_owned();
    }
    let words = network.links.iter().map(|link| {
        format!(
            "{}: {}",
            link.name,
            if link.cable { "connected" } else { "no cable" }
        )
    });
    words.collect::<Vec<_>>().join(", ")
}

/// Every address on every link, or a plain word if there are none.
fn address_words(network: &Network) -> String {
    let all: Vec<&str> = network
        .links
        .iter()
        .flat_map(|l| &l.addresses)
        .map(String::as_str)
        .collect();
    if all.is_empty() {
        "No address yet.".to_owned()
    } else {
        all.join(", ")
    }
}

/// The Wi-Fi sentence: true whichever it is.
const fn wifi_words(has_card: bool) -> &'static str {
    if has_card {
        "This machine has a Wi-Fi card, but joining Wi-Fi is not available in this version. Use a cable."
    } else {
        "This machine has no Wi-Fi card. Use a cable."
    }
}

impl Panel {
    /// Shows one check's result.
    fn show(&self, network: &Network) {
        self.cable.set_label(&cable_words(network));
        self.addresses.set_label(&address_words(network));
        let local = if network.gateway.is_some() {
            network.local
        } else {
            Some(false)
        };
        self.local.set_label(&ui::reach_words(
            local,
            "Gateway answers.",
            "No gateway answers.",
        ));
        self.internet.set_label(&ui::reach_words(
            network.internet,
            "Reachable.",
            "Not reachable. That is fine: setup does not need it.",
        ));
        self.wifi.set_label(wifi_words(network.wifi));
        self.automatic.set_visible(network.fixed);
        let names: Vec<&str> = network
            .links
            .iter()
            .map(|link| link.name.as_str())
            .collect();
        let current = self.names.n_items();
        if current as usize != names.len() {
            self.names.splice(0, current, &names);
        }
    }

    /// Asks for a check now.
    fn check(&self) {
        let panel = self.clone();
        api::check_network(move |result| match result {
            Ok(network) => panel.show(&network),
            Err(failure) => panel.message.set_label(&failure.text()),
        });
    }

    /// Sends the fixed address form.
    fn apply(&self, address: &str, gateway: &str, dns: &str) {
        let interface = self
            .names
            .string(self.interface.selected())
            .unwrap_or_default();
        let body = json!({ "interface": interface.as_str(), "address": address, "gateway": gateway, "dns": dns });
        let panel = self.clone();
        api::post("/network/fixed", &body, move |result| match result {
            Ok(answer) => {
                let seconds = answer
                    .get("confirm_within_seconds")
                    .and_then(serde_json::Value::as_u64);
                panel.message.set_label("");
                panel.start_waiting(seconds.unwrap_or(0));
            }
            Err(failure) => panel.message.set_label(&failure.text()),
        });
    }

    /// Shows the confirm-or-undo row and counts down with the service's own timer.
    fn start_waiting(&self, seconds: u64) {
        self.waiting.set_visible(true);
        let wait = self.wait.get() + 1;
        self.wait.set(wait);
        let left = Cell::new(seconds);
        self.countdown.set_label(&undo_words(seconds));
        let panel = self.clone();
        glib::timeout_add_seconds_local(1, move || {
            if panel.wait.get() != wait {
                return glib::ControlFlow::Break;
            }
            left.set(left.get().saturating_sub(1));
            panel.countdown.set_label(&undo_words(left.get()));
            if left.get() == 0 {
                panel.waiting.set_visible(false);
                panel
                    .message
                    .set_label("The address was undone, because nobody confirmed it.");
                panel.check();
                return glib::ControlFlow::Break;
            }
            glib::ControlFlow::Continue
        });
        self.check();
    }

    /// Ends the wait by asking the service to do one of its network actions.
    fn settle(&self, path: &'static str, done_words: &'static str) {
        self.wait.set(self.wait.get() + 1);
        self.waiting.set_visible(false);
        let panel = self.clone();
        api::post(path, &json!({}), move |result| {
            panel
                .message
                .set_label(&result.map_or_else(|f| f.text(), |_| done_words.to_owned()));
            panel.check();
        });
    }
}

/// The countdown sentence.
fn undo_words(seconds: u64) -> String {
    format!("Keep this address? If you do nothing, it is undone in {seconds} seconds.")
}

/// The fixed address form, whose fields the panel reads when it is sent.
fn fixed_form(panel: &Panel) -> gtk::Expander {
    let form = ui::column(ui::GAP / 2);
    form.append(&ui::label("Network card", ""));
    form.append(&panel.interface);
    let address = field(&form, "Address with prefix", "192.168.1.20/24");
    let gateway = field(&form, "Gateway (optional)", "192.168.1.1");
    let dns = field(&form, "DNS (optional)", "192.168.1.1");
    let apply = ui::button("Use this address", "");
    form.append(&apply);
    form.append(&panel.waiting);
    form.append(&panel.automatic);
    let sender = panel.clone();
    apply.connect_clicked(move |_| {
        sender.apply(&address.text(), &gateway.text(), &dns.text());
    });
    gtk::Expander::builder()
        .label("Use a fixed address")
        .child(&form)
        .build()
}

/// Builds the panel. It checks while it is on screen and stays silent otherwise.
pub(crate) fn panel() -> gtk::Box {
    let root = ui::column(ui::GAP);
    let status = ui::column(ui::GAP / 2);
    let names = gtk::StringList::new(&[]);
    let keep = ui::button("Keep it", "suggested-action");
    let undo = ui::button("Undo", "");
    let waiting = ui::column(ui::GAP / 2);
    let countdown = ui::label("", "");
    let choices = ui::row(ui::GAP);
    choices.append(&keep);
    choices.append(&undo);
    waiting.append(&countdown);
    waiting.append(&choices);
    waiting.set_visible(false);
    let message = ui::label("", "problem");
    let panel = Panel {
        cable: status_line(&status, "Cable"),
        addresses: status_line(&status, "Addresses"),
        local: status_line(&status, "Local network"),
        internet: status_line(&status, "Internet"),
        wifi: status_line(&status, "Wi-Fi"),
        interface: gtk::DropDown::new(Some(names.clone()), gtk::Expression::NONE),
        automatic: ui::button("Go back to an automatic address", ""),
        message: message.clone(),
        names,
        waiting,
        countdown,
        wait: Rc::new(Cell::new(0)),
        root: root.clone(),
    };
    root.append(&status);
    root.append(&fixed_form(&panel));
    root.append(&message);
    let refresh = ui::button("Check again", "");
    refresh.set_halign(gtk::Align::Start);
    root.append(&refresh);

    let target = panel.clone();
    refresh.connect_clicked(move |_| target.check());
    let target = panel.clone();
    keep.connect_clicked(move |_| target.settle("/network/confirm", "The address is kept."));
    let target = panel.clone();
    undo.connect_clicked(move |_| target.settle("/network/undo", "The address was undone."));
    let target = panel.clone();
    panel.automatic.connect_clicked(move |_| {
        target.settle(
            "/network/automatic",
            "The machine is back on an automatic address.",
        );
    });
    let target = panel.clone();
    root.connect_map(move |_| target.check());
    let target = panel;
    glib::timeout_add_local(CHECK_EVERY, move || {
        if target.root.is_mapped() {
            target.check();
        }
        glib::ControlFlow::Continue
    });
    root
}

#[cfg(test)]
mod tests {
    use super::{address_words, cable_words, wifi_words};
    use crate::api::{Link, Network};

    #[test]
    fn the_status_is_said_plainly_for_each_link() {
        let link = |name: &str, cable, address: &[&str]| Link {
            name: name.to_owned(),
            cable,
            addresses: address.iter().map(|a| (*a).to_owned()).collect(),
        };
        let network = Network {
            links: vec![link("en0", true, &["10.0.2.15"]), link("en1", false, &[])],
            ..Network::default()
        };
        assert_eq!(cable_words(&network), "en0: connected, en1: no cable");
        assert_eq!(address_words(&network), "10.0.2.15");
        assert_eq!(cable_words(&Network::default()), "No network card found.");
        assert_eq!(address_words(&Network::default()), "No address yet.");
    }

    /// The owner asked for this to be plain: never imply Wi-Fi works.
    #[test]
    fn wifi_is_never_promised() {
        assert!(wifi_words(false).contains("no Wi-Fi card"));
        assert!(wifi_words(true).contains("not available"));
    }
}

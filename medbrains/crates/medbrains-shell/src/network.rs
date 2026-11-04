//! The network panel, the one menu that first boot, Settings and the top bar all show: wired links,
//! Wi-Fi, what can be reached, and a fixed address that undoes itself unless confirmed.

use std::cell::{Cell, RefCell};
use std::rc::Rc;
use std::time::Duration;

use gtk4 as gtk;
use gtk4::glib;
use gtk4::prelude::{
    AccessibleExtManual, BoxExt, ButtonExt, Cast, EditableExt, EntryExt, ListModelExt, WidgetExt,
};
use serde_json::json;

use crate::api::{self, Network};
use crate::netmenu::Wired;
use crate::{ui, wifi_panel};

/// How often the panel re-checks while it is on screen.
const CHECK_EVERY: Duration = Duration::from_secs(10);

/// The widgets the panel keeps updating.
#[derive(Clone)]
struct Panel {
    root: gtk::Box,
    wired: Wired,
    /// Reachability, in the full panel only; the top bar's menu leaves it to Settings.
    local: gtk::Label,
    internet: gtk::Label,
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

impl Panel {
    /// Shows one check's result.
    fn show(&self, network: &Network) {
        if network.fault {
            self.message
                .set_label("This machine couldn't read its own network state.");
        }
        self.wired.show(network);
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
        self.automatic.set_visible(network.fixed);
        let names: Vec<&str> = network
            .links
            .iter()
            .filter(|link| link.kind != "wifi")
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
                panel.report_undo();
                return glib::ControlFlow::Break;
            }
            glib::ControlFlow::Continue
        });
        self.check();
    }

    /// Says what became of an unconfirmed address, from what the machine reports, not from the
    /// countdown having ended.
    fn report_undo(&self) {
        let panel = self.clone();
        api::check_network(move |result| {
            let words = match &result {
                Ok(network) if network.unconfirmed => {
                    "The address could not be undone. Restart the machine to undo it."
                }
                Ok(_) => "The address was undone, because nobody confirmed it.",
                Err(_) => "This machine isn't answering, so it isn't clear what address it has.",
            };
            panel.message.set_label(words);
            if let Ok(network) = &result {
                panel.show(network);
            }
        });
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

/// The parts that exist only to make the panel: the status lines and the confirm row.
fn waiting_row(keep: &gtk::Button, undo: &gtk::Button, countdown: &gtk::Label) -> gtk::Box {
    let waiting = ui::column(ui::GAP / 2);
    let choices = ui::row(ui::GAP);
    choices.append(keep);
    choices.append(undo);
    waiting.append(countdown);
    waiting.append(&choices);
    waiting.set_visible(false);
    waiting
}

/// Builds the panel. With `settings_link` it is the top bar's short menu, ending in a link to the
/// full settings; without, it is the full panel with reachability too. It checks while on screen
/// and stays silent otherwise.
pub(crate) fn panel(settings_link: Option<Rc<dyn Fn()>>) -> gtk::Box {
    let root = ui::column(ui::GAP);
    root.add_css_class("network-panel");
    let status = ui::column(ui::GAP / 2);
    let names = gtk::StringList::new(&[]);
    let keep = ui::button("Keep it", "suggested-action");
    let undo = ui::button("Undo", "");
    let countdown = ui::label("", "");
    let waiting = waiting_row(&keep, &undo, &countdown);
    let message = ui::label("", "problem");
    let local = status_line(&status, "Local network");
    let internet = status_line(&status, "Internet");
    let recheck: Rc<RefCell<Option<Panel>>> = Rc::default();
    let again = Rc::clone(&recheck);
    let wired = Wired::new(Rc::new(move || {
        if let Some(panel) = again.borrow().as_ref() {
            panel.check();
        }
    }));
    let panel = Panel {
        root: root.clone(),
        wired: wired.clone(),
        local,
        internet,
        interface: gtk::DropDown::new(Some(names.clone()), gtk::Expression::NONE),
        automatic: ui::button("Go back to an automatic address", ""),
        message: message.clone(),
        names,
        waiting,
        countdown,
        wait: Rc::new(Cell::new(0)),
    };
    *recheck.borrow_mut() = Some(panel.clone());
    if settings_link.is_none() {
        root.append(&status);
    }
    root.append(&wired.root);
    root.append(&wifi_panel::section());
    root.append(&fixed_form(&panel));
    root.append(&message);
    let actions = ui::row(ui::GAP);
    let refresh = ui::button("Check again", "");
    actions.append(&refresh);
    if let Some(open) = settings_link {
        let link = ui::button("Network settings…", "");
        link.connect_clicked(move |_| open());
        actions.append(&link);
    }
    root.append(&actions);

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

//! The Wi-Fi part of the network menu: on or off, the list, joining and forgetting. It says the
//! true state at each point: no card, software not answering, off, nothing in range, or the list.

use std::cell::RefCell;
use std::rc::Rc;
use std::time::Duration;

use gtk4 as gtk;
use gtk4::glib;
use gtk4::prelude::{BoxExt, ButtonExt, EditableExt, WidgetExt};
use serde_json::json;

use crate::api::{self, Wifi, WifiNetwork};
use crate::ui;

/// How often the list is read while it is on screen.
const POLL_EVERY: Duration = Duration::from_secs(3);

/// The widgets the section keeps updating.
#[derive(Clone)]
struct Section {
    root: gtk::Box,
    power_row: gtk::Box,
    power: gtk::Switch,
    words: gtk::Label,
    list: gtk::Box,
    result: gtk::Label,
    /// Shown while a password is wanted. Kept out of the list, so a refresh can't wipe it.
    asking: gtk::Box,
    asking_title: gtk::Label,
    password: gtk::PasswordEntry,
    asking_for: Rc<RefCell<String>>,
    /// What the list last showed, so an unchanged list isn't rebuilt under the person's focus.
    shown: Rc<RefCell<Vec<WifiNetwork>>>,
}

/// The sentence for what the machine's Wi-Fi can do, or `None` if the list should show.
fn state_words(wifi: &Wifi) -> Option<&'static str> {
    if !wifi.hardware {
        Some("This machine has no Wi-Fi card. Use a cable.")
    } else if wifi.fault {
        Some("This machine has a Wi-Fi card, but its Wi-Fi software isn't answering.")
    } else if !wifi.powered {
        Some("Wi-Fi is off.")
    } else if wifi.networks.is_empty() {
        Some(if wifi.scanning {
            "Looking for networks."
        } else {
            "No networks in range."
        })
    } else {
        None
    }
}

/// The sentence for the latest attempt to join.
fn attempt_words(wifi: &Wifi) -> String {
    let attempt = &wifi.attempt;
    match attempt.state.as_str() {
        "connecting" => format!("Joining {}.", attempt.ssid),
        "connected" => format!("Joined {}.", attempt.ssid),
        "failed" => format!("Could not join {}. {}", attempt.ssid, attempt.words),
        _ => String::new(),
    }
}

/// The icon for a signal strength.
const fn signal_icon(signal: u8) -> &'static str {
    match signal {
        0..=19 => "network-wireless-signal-none-symbolic",
        20..=39 => "network-wireless-signal-weak-symbolic",
        40..=59 => "network-wireless-signal-ok-symbolic",
        60..=79 => "network-wireless-signal-good-symbolic",
        _ => "network-wireless-signal-excellent-symbolic",
    }
}

/// What a screen reader says for a network, and what its row shows after the name.
fn network_words(network: &WifiNetwork) -> String {
    let lock = if network.secured { "secured" } else { "open" };
    let state = if network.connected {
        ", connected"
    } else if network.saved {
        ", saved"
    } else {
        ""
    };
    format!(
        "{}, signal {} percent, {lock}{state}",
        network.ssid, network.signal
    )
}

impl Section {
    /// Reads the state now.
    fn refresh(&self) {
        let section = self.clone();
        api::fetch_wifi(move |result| match result {
            Ok(wifi) => section.show(&wifi),
            Err(failure) => {
                section.words.set_label(&failure.text());
                section.words.set_visible(true);
            }
        });
    }

    /// Shows one reading.
    fn show(&self, wifi: &Wifi) {
        self.power_row.set_visible(wifi.hardware && !wifi.fault);
        if self.power.is_active() != wifi.powered {
            self.power.set_active(wifi.powered);
        }
        let words = state_words(wifi);
        self.words.set_label(words.unwrap_or_default());
        self.words.set_visible(words.is_some());
        let result = attempt_words(wifi);
        ui::set_warning(&self.result, wifi.attempt.state == "failed");
        self.result.set_label(&result);
        self.result.set_visible(!result.is_empty());
        if *self.shown.borrow() != wifi.networks {
            self.fill_list(&wifi.networks);
            self.shown.borrow_mut().clone_from(&wifi.networks);
        }
    }

    /// Rebuilds the list.
    fn fill_list(&self, networks: &[WifiNetwork]) {
        while let Some(row) = self.list.first_child() {
            self.list.remove(&row);
        }
        for network in networks {
            self.list.append(&self.network_row(network));
        }
    }

    /// One network: signal, name, lock, state, and Forget if it is saved.
    fn network_row(&self, network: &WifiNetwork) -> gtk::Box {
        let row = ui::row(ui::GAP / 2);
        let body = ui::row(ui::GAP / 2);
        body.append(&gtk::Image::from_icon_name(signal_icon(network.signal)));
        let name = ui::line(
            &network.ssid,
            if network.connected { "heading" } else { "" },
        );
        name.set_hexpand(true);
        body.append(&name);
        if network.connected {
            body.append(&ui::line("Connected", "muted"));
        } else if network.saved {
            body.append(&ui::line("Saved", "muted"));
        }
        if network.secured {
            body.append(&gtk::Image::from_icon_name("changes-prevent-symbolic"));
        }
        let choose = gtk::Button::builder().child(&body).hexpand(true).build();
        ui::set_name(&choose, &network_words(network));
        let (section, chosen) = (self.clone(), network.clone());
        choose.connect_clicked(move |_| section.choose(&chosen));
        row.append(&choose);
        if network.saved {
            let forget = ui::button("Forget", "");
            let (section, ssid) = (self.clone(), network.ssid.clone());
            forget.connect_clicked(move |_| {
                let after = section.clone();
                api::post("/wifi/forget", &json!({ "ssid": ssid }), move |result| {
                    after.report(result.map(|_| ()).map_err(|f| f.text()));
                });
            });
            row.append(&forget);
        }
        row
    }

    /// Acts on a network being chosen: join it, or ask for its password first.
    fn choose(&self, network: &WifiNetwork) {
        if network.connected {
            return;
        }
        if network.enterprise {
            self.result
                .set_label("This network needs an enterprise login, which isn't available yet.");
            self.result.set_visible(true);
        } else if network.secured && !network.saved {
            *self.asking_for.borrow_mut() = network.ssid.clone();
            self.asking_title
                .set_label(&format!("Password for {}", network.ssid));
            self.password.set_text("");
            self.asking.set_visible(true);
            self.password.grab_focus();
        } else {
            self.join(&network.ssid, "");
        }
    }

    /// Asks the service to join. The result arrives through `refresh`.
    fn join(&self, ssid: &str, password: &str) {
        self.asking.set_visible(false);
        self.password.set_text("");
        let section = self.clone();
        let body = json!({ "ssid": ssid, "password": password });
        api::post("/wifi/connect", &body, move |result| {
            section.report(result.map(|_| ()).map_err(|f| f.text()));
        });
    }

    /// Shows a refusal, or reads the new state.
    fn report(&self, result: Result<(), String>) {
        if let Err(words) = result {
            self.result.set_label(&words);
            self.result.set_visible(true);
            ui::set_warning(&self.result, true);
        }
        self.refresh();
    }

    /// Starts a scan.
    fn scan(&self) {
        let section = self.clone();
        api::post("/wifi/scan", &json!({}), move |result| {
            section.report(result.map(|_| ()).map_err(|f| f.text()));
        });
    }
}

/// The password row, hidden until a network wants one. The password goes to the service only.
fn password_row(section: &Section, connect: &gtk::Button, cancel: &gtk::Button) {
    let actions = ui::row(ui::GAP / 2);
    actions.append(cancel);
    actions.append(connect);
    section.asking.append(&section.asking_title);
    section.asking.append(&section.password);
    section.asking.append(&actions);
    section.asking.set_visible(false);
    let target = section.clone();
    connect.connect_clicked(move |_| {
        let ssid = target.asking_for.borrow().clone();
        target.join(&ssid, &target.password.text());
    });
    let target = section.clone();
    section.password.connect_activate(move |_| {
        let ssid = target.asking_for.borrow().clone();
        target.join(&ssid, &target.password.text());
    });
    let target = section.clone();
    cancel.connect_clicked(move |_| {
        target.password.set_text("");
        target.asking.set_visible(false);
    });
}

/// Builds the section. It reads Wi-Fi's state only while it is on screen.
pub(crate) fn section() -> gtk::Box {
    let root = ui::column(ui::GAP / 2);
    let power_row = ui::row(ui::GAP);
    let title = ui::line("Wi-Fi", "heading");
    title.set_hexpand(true);
    let scan = ui::button("Scan", "");
    let power = gtk::Switch::builder().valign(gtk::Align::Center).build();
    ui::set_name(&power, "Wi-Fi on or off");
    power_row.append(&title);
    power_row.append(&scan);
    power_row.append(&power);
    let section = Section {
        root: root.clone(),
        power_row: power_row.clone(),
        power: power.clone(),
        words: ui::label("Checking Wi-Fi.", "muted"),
        list: ui::column(ui::GAP / 4),
        result: ui::label("", ""),
        asking: ui::column(ui::GAP / 2),
        asking_title: ui::line("", "heading"),
        password: gtk::PasswordEntry::builder().show_peek_icon(true).build(),
        asking_for: Rc::default(),
        shown: Rc::default(),
    };
    power_row.set_visible(false);
    let (connect, cancel) = (
        ui::button("Join", "suggested-action"),
        ui::button("Cancel", ""),
    );
    password_row(&section, &connect, &cancel);
    root.append(&power_row);
    root.append(&section.words);
    root.append(&section.list);
    root.append(&section.asking);
    root.append(&section.result);

    let target = section.clone();
    scan.connect_clicked(move |_| target.scan());
    let target = section.clone();
    power.connect_state_set(move |_, on| {
        let after = target.clone();
        api::post("/wifi/power", &json!({ "on": on }), move |result| {
            after.report(result.map(|_| ()).map_err(|f| f.text()));
        });
        glib::Propagation::Proceed
    });
    let target = section.clone();
    root.connect_map(move |_| {
        target.refresh();
        target.scan();
    });
    glib::timeout_add_local(POLL_EVERY, move || {
        if section.root.is_mapped() {
            section.refresh();
        }
        glib::ControlFlow::Continue
    });
    root
}

#[cfg(test)]
mod tests {
    use super::{Wifi, WifiNetwork, attempt_words, network_words, signal_icon, state_words};
    use crate::api::WifiAttempt;

    /// The owner's rule: a machine with no card says so, and a fault never looks like empty air.
    #[test]
    fn each_state_says_what_is_true() {
        let wifi = |hardware, fault, powered| Wifi {
            hardware,
            fault,
            powered,
            ..Wifi::default()
        };
        assert!(
            state_words(&wifi(false, false, false)).is_some_and(|w| w.contains("no Wi-Fi card"))
        );
        assert!(
            state_words(&wifi(true, true, false)).is_some_and(|w| w.contains("isn't answering"))
        );
        assert_eq!(
            state_words(&wifi(true, false, false)),
            Some("Wi-Fi is off.")
        );
        assert_eq!(
            state_words(&wifi(true, false, true)),
            Some("No networks in range.")
        );
        let with_list = Wifi {
            networks: vec![WifiNetwork::default()],
            ..wifi(true, false, true)
        };
        assert_eq!(state_words(&with_list), None);
    }

    #[test]
    fn the_result_of_joining_is_said_plainly() {
        let with = |state: &str, words: &str| Wifi {
            attempt: WifiAttempt {
                ssid: "Ward".to_owned(),
                state: state.to_owned(),
                words: words.to_owned(),
            },
            ..Wifi::default()
        };
        assert_eq!(attempt_words(&with("connecting", "")), "Joining Ward.");
        assert_eq!(attempt_words(&with("connected", "")), "Joined Ward.");
        assert_eq!(
            attempt_words(&with("failed", "The password may be wrong.")),
            "Could not join Ward. The password may be wrong."
        );
        assert_eq!(attempt_words(&Wifi::default()), "");
    }

    #[test]
    fn signal_and_lock_are_said_in_words_too() {
        assert!(signal_icon(5).contains("none"));
        assert!(signal_icon(95).contains("excellent"));
        let network = WifiNetwork {
            ssid: "Ward".to_owned(),
            secured: true,
            saved: true,
            signal: 60,
            ..WifiNetwork::default()
        };
        assert_eq!(
            network_words(&network),
            "Ward, signal 60 percent, secured, saved"
        );
    }
}

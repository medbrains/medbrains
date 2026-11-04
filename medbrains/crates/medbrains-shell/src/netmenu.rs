//! The network menu in the top bar, and the Ethernet part of it. The icon shows the link really in
//! use; the panel is the same `network::panel` that first boot and Settings show.

use std::cell::RefCell;
use std::rc::Rc;

use gtk4 as gtk;
use gtk4::prelude::{BoxExt, ButtonExt, PopoverExt, WidgetExt};
use serde_json::json;

use crate::api::{self, Link, Network};
use crate::{network, ui};

/// Tall enough for several sections; past this the panel scrolls, on any screen.
const PANEL_HEIGHT: i32 = 560;
const PANEL_WIDTH: i32 = 420;

/// The icon for the link in use, or for there being none.
pub(crate) fn icon_name(network: &Network) -> &'static str {
    let by_route = network.default_link.as_ref();
    let in_use = network
        .links
        .iter()
        .find(|link| by_route.is_some_and(|name| *name == link.name))
        .or_else(|| {
            network
                .links
                .iter()
                .find(|link| link.cable && !link.addresses.is_empty())
        });
    match in_use.map(|link| link.kind.as_str()) {
        Some("wifi") => "network-wireless-symbolic",
        Some(_) => "network-wired-symbolic",
        None => "network-wired-disconnected-symbolic",
    }
}

/// One wired link in words: its state, address and speed.
fn link_words(link: &Link) -> String {
    if !link.cable {
        return "No cable".to_owned();
    }
    let address = link
        .addresses
        .first()
        .map_or("no address yet", String::as_str);
    match link.speed_mbps {
        Some(speed) => format!("Connected, {address}, {speed} Mb/s"),
        None => format!("Connected, {address}"),
    }
}

/// What the Ethernet section last drew, to tell if it needs drawing again.
fn signature(network: &Network) -> String {
    let links = wired_links(network).map(|link| format!("{}={}", link.name, link_words(link)));
    let default_link = network.default_link.as_deref().unwrap_or_default();
    let preferred = network.preferred.as_deref().unwrap_or_default();
    format!(
        "{}|{default_link}|{preferred}",
        links.collect::<Vec<_>>().join(";")
    )
}

/// The wired links.
fn wired_links(network: &Network) -> impl Iterator<Item = &Link> {
    network.links.iter().filter(|link| link.kind != "wifi")
}

/// The Ethernet section: each wired link, and a choice of which to try first if there are several.
#[derive(Clone)]
pub(crate) struct Wired {
    pub(crate) root: gtk::Box,
    list: gtk::Box,
    message: gtk::Label,
    drawn: Rc<RefCell<String>>,
    /// Runs after a change, so the panel reads the new state.
    changed: Rc<dyn Fn()>,
}

impl Wired {
    /// Builds the section, empty until `show`.
    pub(crate) fn new(changed: Rc<dyn Fn()>) -> Self {
        let root = ui::column(ui::GAP / 2);
        let list = ui::column(ui::GAP / 2);
        let message = ui::label("", "problem");
        root.append(&ui::line("Ethernet", "heading"));
        root.append(&list);
        root.append(&message);
        Self {
            root,
            list,
            message,
            drawn: Rc::default(),
            changed,
        }
    }

    /// Shows one reading. An unchanged list isn't rebuilt under the person's focus.
    pub(crate) fn show(&self, network: &Network) {
        let now = signature(network);
        if *self.drawn.borrow() == now {
            return;
        }
        *self.drawn.borrow_mut() = now;
        while let Some(row) = self.list.first_child() {
            self.list.remove(&row);
        }
        let several = wired_links(network).count() > 1;
        if !several && wired_links(network).next().is_none() {
            self.list.append(&ui::label(
                "This machine has no wired network card.",
                "muted",
            ));
        }
        for link in wired_links(network) {
            self.list.append(&self.link_row(link, network, several));
        }
    }

    /// One wired link, with a way to choose it if there is a choice to make.
    fn link_row(&self, link: &Link, network: &Network, several: bool) -> gtk::Box {
        let row = ui::row(ui::GAP);
        let words = ui::column(0);
        words.set_hexpand(true);
        let in_use = network.default_link.as_deref() == Some(link.name.as_str());
        let name = if in_use {
            format!("{} (in use)", link.name)
        } else {
            link.name.clone()
        };
        words.append(&ui::line(&name, ""));
        words.append(&ui::label(&link_words(link), "muted"));
        row.append(&words);
        if several {
            let chosen = network.preferred.as_deref() == Some(link.name.as_str());
            let choose = if chosen {
                ui::button("Stop preferring", "")
            } else {
                ui::button("Use this link", "")
            };
            let target = if chosen {
                String::new()
            } else {
                link.name.clone()
            };
            let (message, changed) = (self.message.clone(), Rc::clone(&self.changed));
            choose.connect_clicked(move |_| {
                let (message, changed) = (message.clone(), Rc::clone(&changed));
                api::post(
                    "/network/prefer",
                    &json!({ "interface": target }),
                    move |result| {
                        message.set_label(&result.map_or_else(|f| f.text(), |_| String::new()));
                        changed();
                    },
                );
            });
            row.append(&choose);
        }
        row
    }
}

/// The top bar's menu button around `face`, opening the shared panel. `open_settings` is its link
/// to the full network settings.
pub(crate) fn button(face: &gtk::Box, open_settings: Rc<dyn Fn()>) -> gtk::MenuButton {
    let popover = gtk::Popover::new();
    let source = popover.clone();
    let panel = network::panel(Some(Rc::new(move || {
        source.popdown();
        open_settings();
    })));
    let scroller = gtk::ScrolledWindow::builder()
        .child(&panel)
        .hscrollbar_policy(gtk::PolicyType::Never)
        .min_content_width(PANEL_WIDTH)
        .min_content_height(PANEL_HEIGHT)
        .build();
    popover.set_child(Some(&scroller));
    let button = gtk::MenuButton::builder()
        .popover(&popover)
        .child(face)
        .always_show_arrow(false)
        .build();
    ui::set_name(&button, "Network");
    button
}

#[cfg(test)]
mod tests {
    use super::{Link, Network, icon_name, link_words, signature};

    /// Builds a link.
    fn link(name: &str, kind: &str, cable: bool, address: &[&str]) -> Link {
        Link {
            name: name.to_owned(),
            kind: kind.to_owned(),
            cable,
            addresses: address.iter().map(|a| (*a).to_owned()).collect(),
            speed_mbps: None,
        }
    }

    /// The icon must show the link in use, so a pulled cable on Wi-Fi still shows Wi-Fi.
    #[test]
    fn the_icon_shows_the_link_the_route_really_uses() {
        let both = vec![
            link("en0", "ethernet", false, &[]),
            link("wlan0", "wifi", true, &["10.0.0.5"]),
        ];
        let network = Network {
            links: both,
            default_link: Some("wlan0".to_owned()),
            ..Network::default()
        };
        assert_eq!(icon_name(&network), "network-wireless-symbolic");
        assert_eq!(
            icon_name(&Network::default()),
            "network-wired-disconnected-symbolic"
        );
    }

    #[test]
    fn a_link_says_its_state_address_and_speed() {
        assert_eq!(link_words(&link("en0", "ethernet", false, &[])), "No cable");
        let mut up = link("en0", "ethernet", true, &["10.0.2.15"]);
        assert_eq!(link_words(&up), "Connected, 10.0.2.15");
        up.speed_mbps = Some(1000);
        assert_eq!(link_words(&up), "Connected, 10.0.2.15, 1000 Mb/s");
        assert_eq!(
            link_words(&link("en0", "ethernet", true, &[])),
            "Connected, no address yet"
        );
    }

    /// Only a real change redraws, or focus would jump while someone is choosing.
    #[test]
    fn the_section_redraws_only_for_a_real_change() {
        let network = |cable| Network {
            links: vec![
                link("en0", "ethernet", cable, &[]),
                link("wlan0", "wifi", true, &[]),
            ],
            ..Network::default()
        };
        assert_eq!(signature(&network(true)), signature(&network(true)));
        assert_ne!(signature(&network(true)), signature(&network(false)));
    }
}

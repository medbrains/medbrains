//! Small builders shared by every screen, and the words that describe the machine. The
//! words are plain functions so they can be tested without a display.

use gtk4 as gtk;
use gtk4::prelude::{AccessibleExtManual, BoxExt, Cast, IsA, WidgetExt};

use crate::api::{Machine, Network};

/// Space between controls. Carbon's 8px mini-unit, doubled.
pub(crate) const GAP: i32 = 16;
/// Width of a form on the setup screens.
const FORM_WIDTH: i32 = 640;
/// Longest line of text, in characters, so a sentence wraps instead of widening its card.
const MEASURE: i32 = 64;
const KIB: u64 = 1024;
const MIB: u64 = KIB * KIB;
const GIB: u64 = KIB * MIB;

/// Text with a style class, wrapping, left-aligned.
pub(crate) fn label(text: &str, class: &str) -> gtk::Label {
    let label = gtk::Label::builder()
        .label(text)
        .wrap(true)
        .max_width_chars(MEASURE)
        .xalign(0.0)
        .build();
    if !class.is_empty() {
        label.add_css_class(class);
    }
    label
}

/// A push button with text.
pub(crate) fn button(text: &str, class: &str) -> gtk::Button {
    let button = gtk::Button::with_label(text);
    if !class.is_empty() {
        button.add_css_class(class);
    }
    button
}

/// A button showing only an icon. It still has a name for a screen reader and a tooltip.
pub(crate) fn icon_button(icon: &str, name: &str) -> gtk::Button {
    let button = gtk::Button::from_icon_name(icon);
    set_name(&button, name);
    button
}

/// Gives a control a tooltip and the name a screen reader says.
pub(crate) fn set_name(widget: &(impl IsA<gtk::Widget> + IsA<gtk::Accessible>), name: &str) {
    widget.set_tooltip_text(Some(name));
    widget.update_property(&[gtk::accessible::Property::Label(name)]);
}

/// A vertical box.
pub(crate) fn column(spacing: i32) -> gtk::Box {
    gtk::Box::new(gtk::Orientation::Vertical, spacing)
}

/// A horizontal box.
pub(crate) fn row(spacing: i32) -> gtk::Box {
    gtk::Box::new(gtk::Orientation::Horizontal, spacing)
}

/// A titled page of the setup flow: heading, body, then a row of buttons, centred.
pub(crate) fn page(title: &str, intro: &str, body: &gtk::Box, actions: &gtk::Box) -> gtk::Widget {
    let form = column(GAP);
    form.add_css_class("card");
    form.set_width_request(FORM_WIDTH);
    form.set_halign(gtk::Align::Center);
    form.set_valign(gtk::Align::Center);
    form.append(&label(title, "title"));
    if !intro.is_empty() {
        form.append(&label(intro, ""));
    }
    form.append(body);
    actions.set_halign(gtk::Align::End);
    form.append(actions);
    let scroller = gtk::ScrolledWindow::builder()
        .child(&form)
        .hscrollbar_policy(gtk::PolicyType::Never)
        .build();
    scroller.upcast()
}

/// A number of bytes in the unit people use for it.
pub(crate) fn size_words(bytes: u64) -> String {
    if bytes >= GIB {
        format!("{:.1} GB", bytes as f64 / GIB as f64)
    } else {
        format!("{} MB", bytes / MIB)
    }
}

/// How long the machine has been on.
pub(crate) fn uptime_words(seconds: u64) -> String {
    let (days, hours, minutes) = (
        seconds / 86_400,
        seconds % 86_400 / 3_600,
        seconds % 3_600 / 60,
    );
    match (days, hours) {
        (0, 0) => format!("{minutes} min"),
        (0, _) => format!("{hours} h {minutes} min"),
        _ => format!("{days} d {hours} h"),
    }
}

/// The overall health of the services, in one sentence.
pub(crate) fn system_words(system: &str, main_ready: bool, set_up: bool) -> &'static str {
    match (system, set_up && !main_ready) {
        ("degraded", _) => "A service has a problem.",
        (_, true) => "MedBrains is starting.",
        ("running", false) => "All services are running.",
        _ => "The machine is starting.",
    }
}

/// How much memory is in use.
pub(crate) fn memory_words(machine: &Machine) -> String {
    let used = machine
        .memory_total_kb
        .saturating_sub(machine.memory_available_kb);
    format!(
        "{} of {} in use",
        size_words(used * KIB),
        size_words(machine.memory_total_kb * KIB)
    )
}

/// The top bar's short word for the network.
pub(crate) fn network_words(network: &Network) -> String {
    let with_address = network.links.iter().find(|link| !link.addresses.is_empty());
    match with_address {
        Some(link) if link.cable => link.addresses.first().cloned().unwrap_or_default(),
        _ if network.links.iter().any(|link| link.cable) => "Cable in, no address".to_owned(),
        _ if network.links.is_empty() => "No network card".to_owned(),
        _ => "No cable".to_owned(),
    }
}

/// A reachability answer: not asked yet, yes, or no.
pub(crate) fn reach_words(answer: Option<bool>, yes: &str, no: &str) -> String {
    match answer {
        None => "Checking…".to_owned(),
        Some(true) => yes.to_owned(),
        Some(false) => no.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::{network_words, reach_words, size_words, system_words, uptime_words};
    use crate::api::{Link, Network};

    /// Builds a network with one link.
    fn one_link(cable: bool, addresses: &[&str]) -> Network {
        let addresses = addresses.iter().map(|a| (*a).to_owned()).collect();
        Network {
            links: vec![Link {
                name: "en0".to_owned(),
                cable,
                addresses,
            }],
            ..Network::default()
        }
    }

    /// A pulled cable must read as a pulled cable, and a stale address must not hide it.
    #[test]
    fn the_top_bar_tells_a_pulled_cable_from_a_missing_address() {
        assert_eq!(network_words(&one_link(true, &["10.0.2.15"])), "10.0.2.15");
        assert_eq!(network_words(&one_link(false, &["10.0.2.15"])), "No cable");
        assert_eq!(network_words(&one_link(true, &[])), "Cable in, no address");
        assert_eq!(network_words(&Network::default()), "No network card");
    }

    /// A degraded machine must never read as healthy, whatever else is true.
    #[test]
    fn a_problem_is_never_reported_as_running() {
        assert_eq!(
            system_words("degraded", true, true),
            "A service has a problem."
        );
        assert_eq!(
            system_words("running", false, true),
            "MedBrains is starting."
        );
        assert_eq!(
            system_words("running", true, true),
            "All services are running."
        );
        assert_eq!(
            system_words("running", false, false),
            "All services are running."
        );
        assert_eq!(
            system_words("starting", true, true),
            "The machine is starting."
        );
    }

    #[test]
    fn figures_are_said_in_everyday_units() {
        assert_eq!(size_words(1024 * 1024 * 300), "300 MB");
        assert_eq!(size_words(1024 * 1024 * 1024 * 3 / 2), "1.5 GB");
        assert_eq!(uptime_words(125), "2 min");
        assert_eq!(uptime_words(3_725), "1 h 2 min");
        assert_eq!(uptime_words(90_000), "1 d 1 h");
        assert_eq!(reach_words(None, "y", "n"), "Checking…");
        assert_eq!(reach_words(Some(false), "y", "n"), "n");
    }
}

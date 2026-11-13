//! Small builders shared by every screen, and the words that describe the machine. The
//! words are plain functions so they can be tested without a display.

use gtk4 as gtk;
use gtk4::prelude::{AccessibleExtManual, BoxExt, Cast, IsA, WidgetExt};

use crate::api::{Machine, Network};

/// Space between controls. Carbon's 8px mini-unit, doubled.
pub(crate) const GAP: i32 = 16;
/// Width of a form on the setup screens.
pub(crate) const FORM_WIDTH: i32 = 640;
/// Longest line of text, in characters, so a sentence wraps instead of widening its card.
const MEASURE: i32 = 64;
/// How long a page takes to fade in.
const FADE_MS: u32 = 160;
/// The crab, the design system's mascot, as `os/shell-tokens.py` draws it in the brand colours.
const CRAB: &[u8] = include_bytes!("../assets/crab.svg");
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

/// Text that stays on one line, for bars and values.
pub(crate) fn line(text: &str, class: &str) -> gtk::Label {
    let label = label(text, class);
    label.set_wrap(false);
    label
}

/// The mascot at a size. It only decorates, so a screen reader passes over it, and a picture that
/// will not load leaves an empty space, never an error.
pub(crate) fn mascot(size: i32) -> gtk::Image {
    let image = gtk::Image::builder()
        .pixel_size(size)
        .accessible_role(gtk::AccessibleRole::Presentation)
        .build();
    image.add_css_class("mascot");
    let picture = gtk::gdk::Texture::from_bytes(&gtk::glib::Bytes::from_static(CRAB));
    if let Ok(texture) = picture {
        image.set_paintable(Some(&texture));
    }
    image
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

/// A stack that fades between its pages, in the time motion rules allow. `gtk-enable-animations`
/// turns this off too, for people who ask for less motion.
pub(crate) fn stack() -> gtk::Stack {
    gtk::Stack::builder()
        .transition_type(gtk::StackTransitionType::Crossfade)
        .transition_duration(FADE_MS)
        .build()
}

/// Marks a widget as a warning, or not.
pub(crate) fn set_warning(widget: &impl IsA<gtk::Widget>, warning: bool) {
    if warning {
        widget.add_css_class("warning");
    } else {
        widget.remove_css_class("warning");
    }
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
    form.set_margin_top(GAP);
    form.set_margin_bottom(GAP);
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

/// The big word on the health widget.
pub(crate) fn health_word(machine: &Machine, main_ready: bool) -> &'static str {
    if machine.system == "degraded" || !machine.failed.is_empty() {
        "Needs attention"
    } else if machine.system == "running" && main_ready {
        "Healthy"
    } else {
        "Starting"
    }
}

/// The greeting's plain sentence. It names what failed, so a person can say it on the phone.
pub(crate) fn status_sentence(machine: &Machine, main_ready: bool, disk: &str) -> String {
    match machine.failed.as_slice() {
        [] if machine.system == "degraded" => "A service on this machine has a problem.".to_owned(),
        [] if machine.system == "running" && main_ready => crate::topbar::disk_warning(disk)
            .map_or_else(
                || "Everything is running normally.".to_owned(),
                |warning| format!("MedBrains is running. {warning}."),
            ),
        [] => "This machine is starting.".to_owned(),
        [one] => format!("This service has a problem: {one}"),
        many => format!("These services have a problem: {}", many.join(", ")),
    }
}

/// The greeting's sentence for a node that cannot reach its main machine, which matters more than
/// anything else it could say.
pub(crate) const fn unreachable_sentence(role: &str, main_ready: bool) -> Option<&'static str> {
    match (role.as_bytes(), main_ready) {
        (b"node", false) => {
            Some("Cannot reach the main machine. This machine keeps trying by itself.")
        }
        _ => None,
    }
}

/// The word for the clock's state in the Network widget, and whether it is a warning.
pub(crate) fn clock_words(clock: &str) -> (&'static str, bool) {
    match clock {
        "verified" => ("Verified", false),
        "checking" => ("Checking", false),
        _ => ("Not confirmed", true),
    }
}

/// How much memory is in use.
pub(crate) fn memory_words(machine: &Machine) -> String {
    let used = memory_used_kb(machine) * KIB;
    format!(
        "{} of {}",
        size_words(used),
        size_words(machine.memory_total_kb * KIB)
    )
}

/// Memory in use, in kB, counted the way `free` does.
const fn memory_used_kb(machine: &Machine) -> u64 {
    machine
        .memory_total_kb
        .saturating_sub(machine.memory_available_kb)
}

/// Memory in use, from 0 to 1, for the widget's bars.
pub(crate) fn memory_fraction(machine: &Machine) -> f64 {
    if machine.memory_total_kb == 0 {
        return 0.0;
    }
    memory_used_kb(machine) as f64 / machine.memory_total_kb as f64
}

/// The top bar's short word for the network.
pub(crate) fn network_words(network: &Network) -> String {
    if network.fault {
        return "Network unknown".to_owned();
    }
    let with_address = network.links.iter().find(|link| !link.addresses.is_empty());
    match with_address {
        Some(link) if link.cable => "Connected".to_owned(),
        _ if network.links.iter().any(|link| link.cable) => "Cable in, no address".to_owned(),
        _ if network.links.is_empty() => "No network card".to_owned(),
        _ if network.links.iter().all(|link| link.kind == "wifi") => "Not connected".to_owned(),
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
    use super::{
        clock_words, health_word, network_words, reach_words, size_words, status_sentence,
    };
    use crate::api::{Link, Machine, Network};

    /// Builds a network with one link.
    fn one_link(cable: bool, addresses: &[&str]) -> Network {
        let addresses = addresses.iter().map(|a| (*a).to_owned()).collect();
        Network {
            links: vec![Link {
                name: "en0".to_owned(),
                kind: "ethernet".to_owned(),
                cable,
                addresses,
                speed_mbps: None,
            }],
            ..Network::default()
        }
    }

    /// A pulled cable must read as a pulled cable, and a stale address must not hide it.
    #[test]
    fn the_top_bar_tells_a_pulled_cable_from_a_missing_address() {
        assert_eq!(network_words(&one_link(true, &["10.0.2.15"])), "Connected");
        assert_eq!(network_words(&one_link(false, &["10.0.2.15"])), "No cable");
        assert_eq!(network_words(&one_link(true, &[])), "Cable in, no address");
        assert_eq!(network_words(&Network::default()), "No network card");
        let unknown = Network {
            fault: true,
            ..Network::default()
        };
        assert_eq!(network_words(&unknown), "Network unknown");
    }

    /// Builds a machine in a given state.
    fn machine(system: &str, failed: &[&str]) -> Machine {
        Machine {
            system: system.to_owned(),
            failed: failed.iter().map(|name| (*name).to_owned()).collect(),
            ..Machine::default()
        }
    }

    /// A degraded machine must never read as healthy, and must say what failed.
    #[test]
    fn only_a_node_cut_off_says_it_cannot_reach_the_main_machine() {
        assert!(super::unreachable_sentence("node", false).is_some());
        assert!(super::unreachable_sentence("node", true).is_none());
        assert!(super::unreachable_sentence("main", false).is_none());
    }

    #[test]
    fn a_problem_is_named_and_never_reported_as_healthy() {
        let broken = machine("degraded", &["medbrains-front.service"]);
        assert_eq!(health_word(&broken, true), "Needs attention");
        assert_eq!(
            status_sentence(&broken, true, "encrypted-tpm2"),
            "This service has a problem: medbrains-front.service"
        );
        let two = machine("degraded", &["a.service", "b.service"]);
        assert_eq!(
            status_sentence(&two, true, "encrypted-tpm2"),
            "These services have a problem: a.service, b.service"
        );
        assert_eq!(
            health_word(&machine("degraded", &[]), true),
            "Needs attention"
        );
        assert_eq!(health_word(&machine("running", &[]), true), "Healthy");
        assert_eq!(health_word(&machine("running", &[]), false), "Starting");
        assert_eq!(
            status_sentence(&machine("starting", &[]), true, "encrypted-tpm2"),
            "This machine is starting."
        );
        assert_eq!(
            status_sentence(&machine("running", &[]), true, "encrypted-tpm2"),
            "Everything is running normally."
        );
        assert_eq!(
            status_sentence(&machine("running", &[]), true, "unencrypted-chosen"),
            "MedBrains is running. This disk is not encrypted."
        );
    }

    /// Red seconds after boot is what the owner saw: only a real failure may warn.
    #[test]
    fn only_a_real_clock_failure_warns() {
        assert_eq!(clock_words("verified"), ("Verified", false));
        assert_eq!(clock_words("checking"), ("Checking", false));
        assert_eq!(clock_words("unconfirmed"), ("Not confirmed", true));
        assert_eq!(clock_words(""), ("Not confirmed", true));
    }

    #[test]
    fn figures_are_said_in_everyday_units() {
        assert_eq!(size_words(1024 * 1024 * 300), "300 MB");
        assert_eq!(size_words(1024 * 1024 * 1024 * 3 / 2), "1.5 GB");
        assert_eq!(reach_words(None, "y", "n"), "Checking…");
        assert_eq!(reach_words(Some(false), "y", "n"), "n");
    }
}

//! The top bar: who this machine is, the clock with its calendar, what is true right now, power.

use std::cell::RefCell;
use std::rc::Rc;

use gtk4 as gtk;
use gtk4::glib;
use gtk4::prelude::{BoxExt, WidgetExt};

use crate::api::{Network, State};
use crate::{netmenu, power, timezone, ui};

/// The logo, staged by `os/build.sh`.
const LOGO: &str = "/usr/share/medbrains/shell/logo.svg";
/// How often the clock is redrawn. Its text changes once a minute.
const CLOCK_SECONDS: u32 = 5;
/// What this machine is. Only one role exists so far.
const ROLE: &str = "Main machine";

/// What is on screen below the bar.
#[derive(Debug, Clone, Copy)]
pub(crate) enum Screen<'a> {
    Desktop,
    Launcher,
    App { name: &'a str, reloads: bool },
}

/// The parts of the bar that change after they are built.
#[derive(Clone)]
pub(crate) struct TopBar {
    pub(crate) root: gtk::CenterBox,
    pub(crate) home: gtk::Button,
    pub(crate) close: gtk::Button,
    pub(crate) reload: gtk::Button,
    name: gtk::Label,
    role: gtk::Label,
    day: gtk::Label,
    time: gtk::Label,
    zone: gtk::Label,
    clock_note: gtk::Label,
    /// The zone's name, because GLib's idea of "local" is read once and setup may change it.
    zone_name: Rc<RefCell<String>>,
    firewall_dot: gtk::Box,
    firewall_words: gtk::Label,
    disk: gtk::Box,
    disk_words: gtk::Label,
    network_icon: gtk::Image,
    network_words: gtk::Label,
}

/// A small icon, with words beside it.
fn chip(icon: &gtk::Image, words: &gtk::Label) -> gtk::Box {
    let chip = ui::row(6);
    chip.add_css_class("chip");
    chip.append(icon);
    chip.append(words);
    chip
}

/// The warning for the data disk, if it needs one. Anything not known to be encrypted gets one, so
/// a record nobody could read does not pass for a protected disk.
fn disk_warning(disk: &str) -> Option<&'static str> {
    match disk {
        "encrypted-tpm2" | "encrypted-tpm2-pin" => None,
        "unencrypted-chosen" => Some("This disk is not encrypted"),
        _ => Some("Disk protection unknown"),
    }
}

/// The word for the firewall, which `/state` checks by asking nftables.
const fn firewall_words(on: bool) -> &'static str {
    if on { "Firewall on" } else { "Firewall off" }
}

/// What the clock's panel says about whether the time can be trusted.
const fn clock_note(clock: &str) -> &'static str {
    match clock.as_bytes() {
        b"verified" => "The time is confirmed by an authenticated time server.",
        b"checking" => "Checking the time with a time server.",
        _ => "This machine could not confirm the time with a time server, so it may be wrong.",
    }
}

impl TopBar {
    /// Builds the bar and starts its clock.
    pub(crate) fn new(
        open_settings: Rc<dyn Fn()>,
        power_accepted: Rc<dyn Fn(&'static str)>,
    ) -> Self {
        let root = gtk::CenterBox::new();
        root.add_css_class("topbar");

        let left = ui::row(ui::GAP / 2 + 4);
        let close = ui::icon_button("window-close-symbolic", "Close (Ctrl+W)");
        let home = ui::icon_button("go-home-symbolic", "Home (Alt+Home)");
        let reload = ui::icon_button("view-refresh-symbolic", "Reload (F5)");
        for control in [&close, &home, &reload] {
            control.set_visible(false);
            left.append(control);
        }
        let logo = gtk::Image::from_file(LOGO);
        logo.set_pixel_size(20);
        let name = ui::line("MedBrains", "heading");
        let role = ui::line(ROLE, "muted");
        left.append(&logo);
        left.append(&name);
        left.append(&role);

        let right = ui::row(ui::GAP);
        let firewall_dot = ui::column(0);
        firewall_dot.add_css_class("dot");
        firewall_dot.set_valign(gtk::Align::Center);
        let firewall_words = ui::line("", "");
        let network_icon = gtk::Image::from_icon_name(netmenu::icon_name(&Network::default()));
        let network_words = ui::line("", "");
        let firewall = chip(
            &gtk::Image::from_icon_name("security-high-symbolic"),
            &firewall_words,
        );
        firewall.prepend(&firewall_dot);
        right.append(&firewall);
        let disk_words = ui::line("", "");
        let disk = chip(&gtk::Image::from_icon_name("drive-harddisk-symbolic"), &disk_words);
        let disk_dot = ui::column(0);
        disk_dot.add_css_class("dot");
        disk_dot.set_valign(gtk::Align::Center);
        ui::set_warning(&disk_dot, true);
        disk.prepend(&disk_dot);
        disk.set_visible(false);
        right.append(&disk);
        right.append(&netmenu::button(
            &chip(&network_icon, &network_words),
            open_settings,
        ));
        right.append(&power::button(power_accepted));

        let zone_name = Rc::new(RefCell::new("UTC".to_owned()));
        let (day, time) = (ui::line("", ""), ui::line("", "heading"));
        let (zone, clock_note) = (ui::label("", "muted"), ui::label("", "muted"));
        clock_note.set_max_width_chars(36);
        root.set_start_widget(Some(&left));
        root.set_center_widget(Some(&clock_button(
            &zone_name,
            &day,
            &time,
            &zone,
            &clock_note,
        )));
        root.set_end_widget(Some(&right));
        let bar = Self {
            root,
            home,
            close,
            reload,
            name,
            role,
            day,
            time,
            zone,
            clock_note,
            zone_name,
            firewall_dot,
            firewall_words,
            disk,
            disk_words,
            network_icon,
            network_words,
        };
        bar.draw_clock();
        let ticking = bar.clone();
        glib::timeout_add_seconds_local(CLOCK_SECONDS, move || {
            ticking.draw_clock();
            glib::ControlFlow::Continue
        });
        bar
    }

    /// Shows what is on screen in place of the machine's role, with the controls that apply.
    /// `Apps` is the launcher, which has Home only; `App` also offers Close, and Reload if it
    /// is a web view.
    pub(crate) fn show_screen(&self, screen: Screen<'_>) {
        let (title, can_close, can_reload) = match screen {
            Screen::Desktop => (ROLE, false, false),
            Screen::Launcher => ("Apps", false, false),
            Screen::App { name, reloads } => (name, true, reloads),
        };
        self.home.set_visible(!matches!(screen, Screen::Desktop));
        self.close.set_visible(can_close);
        self.reload.set_visible(can_reload);
        self.role.set_label(title);
    }

    /// Shows one poll of the machine.
    pub(crate) fn show(&self, state: &State) {
        if !state.hospital.is_empty() {
            self.name.set_label(&state.hospital);
        }
        self.firewall_words
            .set_label(firewall_words(state.firewall));
        ui::set_warning(&self.firewall_dot, !state.firewall);
        let warning = disk_warning(&state.disk);
        self.disk.set_visible(warning.is_some());
        self.disk_words.set_label(warning.unwrap_or_default());
        self.network_icon
            .set_icon_name(Some(netmenu::icon_name(&state.network)));
        self.network_words
            .set_label(&ui::network_words(&state.network));
        self.clock_note.set_label(clock_note(&state.clock));
        let changed = *self.zone_name.borrow() != state.timezone;
        if changed {
            state.timezone.clone_into(&mut self.zone_name.borrow_mut());
            // GTK's calendar marks today from the process's zone, so that must follow too.
            timezone::export_for_children();
            self.draw_clock();
        }
    }

    /// Redraws the clock only if its text has changed, so an idle screen repaints nothing.
    fn draw_clock(&self) {
        let zone_name = self.zone_name.borrow();
        let Some(now) = zoned_now(&zone_name) else {
            return;
        };
        let text = |format: &str| {
            now.format(format)
                .map(|t| t.to_string())
                .unwrap_or_default()
        };
        let (day, time) = (text("%a %-d %b"), text("%H:%M"));
        if self.time.label() != time.as_str() {
            self.time.set_label(&time);
        }
        if self.day.label() != day.as_str() {
            self.day.set_label(&day);
        }
        self.zone.set_label(&format!(
            "Time zone: {zone_name} ({})",
            now.timezone_abbreviation()
        ));
    }
}

/// Now, in a named zone. GLib's "local" is read once, and setup may have changed the zone since.
fn zoned_now(zone_name: &str) -> Option<glib::DateTime> {
    let zone = glib::TimeZone::from_identifier(Some(zone_name)).unwrap_or_else(glib::TimeZone::utc);
    glib::DateTime::now(&zone).ok()
}

/// The clock's button and its panel: the calendar, the zone, and whether the time is confirmed.
fn clock_button(
    zone_name: &Rc<RefCell<String>>,
    day: &gtk::Label,
    time: &gtk::Label,
    zone: &gtk::Label,
    note: &gtk::Label,
) -> gtk::MenuButton {
    let panel = ui::column(ui::GAP / 2);
    let calendar = gtk::Calendar::new();
    // Each time it opens: today is the machine's, wherever the person last browsed to.
    let names = Rc::clone(zone_name);
    calendar.connect_map(move |calendar| {
        if let Some(now) = zoned_now(&names.borrow()) {
            calendar.select_day(&now);
        }
    });
    panel.append(&calendar);
    panel.append(zone);
    panel.append(note);
    let popover = gtk::Popover::builder().child(&panel).build();
    let face = ui::row(ui::GAP / 2);
    face.append(day);
    face.append(time);
    let button = gtk::MenuButton::builder()
        .popover(&popover)
        .child(&face)
        .always_show_arrow(false)
        .build();
    ui::set_name(&button, "Date and time");
    button
}

#[cfg(test)]
mod tests {
    use super::{clock_note, disk_warning, firewall_words};

    /// Only a disk known to be encrypted goes without a warning.
    #[test]
    fn a_disk_not_known_to_be_encrypted_gets_a_warning() {
        assert_eq!(disk_warning("encrypted-tpm2"), None);
        assert_eq!(disk_warning("encrypted-tpm2-pin"), None);
        assert_eq!(disk_warning("unencrypted-chosen"), Some("This disk is not encrypted"));
        assert_eq!(disk_warning("unknown"), Some("Disk protection unknown"));
        assert_eq!(disk_warning(""), Some("Disk protection unknown"));
    }

    /// The honesty rule: nothing here may claim more than the check behind it.
    #[test]
    fn the_status_says_only_what_was_checked() {
        assert_eq!(firewall_words(true), "Firewall on");
        assert_eq!(firewall_words(false), "Firewall off");
        assert!(clock_note("checking").starts_with("Checking"));
        assert!(clock_note("unconfirmed").contains("may be wrong"));
        assert!(clock_note("").contains("may be wrong"));
    }
}

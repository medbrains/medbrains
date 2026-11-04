//! The top bar: who this machine is, the clock with its calendar, what is true right now, power.

use std::cell::{Cell, RefCell};
use std::rc::Rc;

use gtk4 as gtk;
use gtk4::glib;
use gtk4::prelude::{BoxExt, ButtonExt, PopoverExt, WidgetExt};
use serde_json::json;

use crate::api::{self, State};
use crate::ui;

/// The logo, staged by `os/build.sh`.
const LOGO: &str = "/usr/share/medbrains/shell/logo.svg";
/// Wide enough for the longer question and both its answers.
const POWER_MENU_WIDTH: i32 = 288;
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

/// The icon for the network's state.
const fn network_icon_name(has_address: bool) -> &'static str {
    if has_address {
        "network-wired-symbolic"
    } else {
        "network-wired-disconnected-symbolic"
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
    pub(crate) fn new() -> Self {
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
        let network_icon = gtk::Image::from_icon_name(network_icon_name(false));
        let network_words = ui::line("", "");
        let firewall = chip(
            &gtk::Image::from_icon_name("security-high-symbolic"),
            &firewall_words,
        );
        firewall.prepend(&firewall_dot);
        right.append(&firewall);
        right.append(&chip(&network_icon, &network_words));
        right.append(&power_button());

        let (day, time) = (ui::line("", ""), ui::line("", "heading"));
        let (zone, clock_note) = (ui::label("", "muted"), ui::label("", "muted"));
        clock_note.set_max_width_chars(36);
        root.set_start_widget(Some(&left));
        root.set_center_widget(Some(&clock_button(&day, &time, &zone, &clock_note)));
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
            zone_name: Rc::new(RefCell::new("UTC".to_owned())),
            firewall_dot,
            firewall_words,
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
        let has_address = state
            .network
            .links
            .iter()
            .any(|l| l.cable && !l.addresses.is_empty());
        self.network_icon
            .set_icon_name(Some(network_icon_name(has_address)));
        self.network_words
            .set_label(&ui::network_words(&state.network));
        self.clock_note.set_label(clock_note(&state.clock));
        let changed = *self.zone_name.borrow() != state.timezone;
        if changed {
            state.timezone.clone_into(&mut self.zone_name.borrow_mut());
            self.draw_clock();
        }
    }

    /// Redraws the clock only if its text has changed, so an idle screen repaints nothing.
    fn draw_clock(&self) {
        let zone_name = self.zone_name.borrow();
        let zone = glib::TimeZone::from_identifier(Some(zone_name.as_str()))
            .unwrap_or_else(glib::TimeZone::utc);
        let Ok(now) = glib::DateTime::now(&zone) else {
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

/// The clock's button and its panel: the calendar, the zone, and whether the time is confirmed.
fn clock_button(
    day: &gtk::Label,
    time: &gtk::Label,
    zone: &gtk::Label,
    note: &gtk::Label,
) -> gtk::MenuButton {
    let panel = ui::column(ui::GAP / 2);
    panel.append(&gtk::Calendar::new());
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

/// The power menu. Both actions ask first, inside the menu, because this may be the hospital's
/// main machine. No separate window: `cage` did not show a dialog window, and its modal grab
/// then blocked all input.
fn power_button() -> gtk::MenuButton {
    let choose = ui::column(ui::GAP / 2);
    let restart = ui::button("Restart…", "");
    let off = ui::button("Power off…", "");
    choose.append(&restart);
    choose.append(&off);
    let ask = ui::column(ui::GAP / 2);
    ask.set_visible(false);
    let question = ui::label("", "heading");
    question.set_max_width_chars(32);
    let detail = ui::label(
        "Everyone using MedBrains on this machine is disconnected until it is back.",
        "",
    );
    detail.set_max_width_chars(32);
    let answers = ui::row(ui::GAP / 2);
    let cancel = ui::button("Cancel", "");
    let accept = ui::button("", "destructive-action");
    answers.append(&cancel);
    answers.append(&accept);
    ask.append(&question);
    ask.append(&detail);
    ask.append(&answers);
    let panel = ui::column(0);
    // Its widest from the start: a menu that grows once open runs off the screen's edge.
    panel.set_width_request(POWER_MENU_WIDTH);
    panel.append(&choose);
    panel.append(&ask);
    // Moved inward, because `cage` does not slide a menu back on screen by itself.
    let popover = gtk::Popover::builder()
        .child(&panel)
        .has_arrow(false)
        .build();
    popover.set_offset(-POWER_MENU_WIDTH / 2, 0);
    let button = gtk::MenuButton::builder()
        .popover(&popover)
        .icon_name("system-shutdown-symbolic")
        .always_show_arrow(false)
        .build();
    ui::set_name(&button, "Power");

    let action = Rc::new(Cell::new("restart"));
    for (control, words, yes, verb) in [
        (&restart, "Restart this machine?", "Restart", "restart"),
        (&off, "Power off this machine?", "Power off", "off"),
    ] {
        let (choose, ask, question, cancel, accept, action) = (
            choose.clone(),
            ask.clone(),
            question.clone(),
            cancel.clone(),
            accept.clone(),
            Rc::clone(&action),
        );
        control.connect_clicked(move |_| {
            question.set_label(words);
            accept.set_label(yes);
            action.set(verb);
            choose.set_visible(false);
            ask.set_visible(true);
            cancel.grab_focus();
        });
    }
    let source = popover.clone();
    cancel.connect_clicked(move |_| source.popdown());
    let source = popover.clone();
    accept.connect_clicked(move |_| {
        source.popdown();
        api::post("/power", &json!({ "action": action.get() }), |_| {});
    });
    // Closing by any route, including Escape, starts again from the two choices.
    popover.connect_closed(move |_| {
        ask.set_visible(false);
        choose.set_visible(true);
    });
    button
}

#[cfg(test)]
mod tests {
    use super::{clock_note, firewall_words, network_icon_name};

    /// The honesty rule: nothing here may claim more than the check behind it.
    #[test]
    fn the_status_says_only_what_was_checked() {
        assert_eq!(firewall_words(true), "Firewall on");
        assert_eq!(firewall_words(false), "Firewall off");
        assert!(clock_note("checking").starts_with("Checking"));
        assert!(clock_note("unconfirmed").contains("may be wrong"));
        assert!(clock_note("").contains("may be wrong"));
        assert!(network_icon_name(false).contains("disconnected"));
    }
}

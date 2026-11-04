//! The desktop after setup: wallpaper, top bar, dock, launcher, widgets, and the two apps.
//! Nothing here shows patient data: it speaks only about the machine.

use std::cell::Cell;
use std::rc::Rc;
use std::time::Duration;

use gtk4 as gtk;
use gtk4::glib;
use gtk4::prelude::{BoxExt, ButtonExt, EditableExt, FlowBoxChildExt, WidgetExt};

use crate::api::{self, State};
use crate::topbar::{clock_button, power_button, set_clock};
use crate::{network, ui, webapp::WebApp};

/// How often the bar and widgets ask the machine for its state.
const REFRESH_EVERY: Duration = Duration::from_secs(10);
/// How often the clock is redrawn. Its text changes once a minute.
const CLOCK_SECONDS: u32 = 5;
/// The logo for the MedBrains tile and dock icon, staged by `os/build.sh`.
const LOGO: &str = "/usr/share/medbrains/shell/logo.svg";

/// An app on this machine. Only ones that exist are listed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum App {
    MedBrains,
    Settings,
}

/// Every app, in launcher order.
const APPS: [App; 2] = [App::MedBrains, App::Settings];

impl App {
    /// The name on its tile, also what search matches.
    const fn title(self) -> &'static str {
        match self {
            Self::MedBrains => "MedBrains",
            Self::Settings => "Settings",
        }
    }

    /// Its page in the desktop's stack.
    const fn page(self) -> &'static str {
        match self {
            Self::MedBrains => "medbrains",
            Self::Settings => "settings",
        }
    }

    /// Its icon, at the given size.
    fn image(self, size: i32) -> gtk::Image {
        let image = match self {
            Self::MedBrains => gtk::Image::from_file(LOGO),
            Self::Settings => gtk::Image::from_icon_name("emblem-system-symbolic"),
        };
        image.set_pixel_size(size);
        image
    }
}

/// True when a launcher search should show this name. An empty search shows everything.
fn matches_search(title: &str, query: &str) -> bool {
    title
        .to_lowercase()
        .contains(query.trim().to_lowercase().as_str())
}

/// The parts of the desktop that change after they are built.
#[derive(Clone)]
struct Desktop {
    content: gtk::Stack,
    home_button: gtk::Button,
    brand: gtk::Label,
    title: gtk::Label,
    network_status: gtk::Label,
    clock: gtk::MenuButton,
    clock_warning: gtk::Label,
    health: gtk::Label,
    memory: gtk::Label,
    uptime: gtk::Label,
    network_widget: gtk::Label,
    disk_words: gtk::Label,
    disk_level: gtk::LevelBar,
    medbrains: WebApp,
    /// Whether the server answered at the last poll.
    medbrains_ready: Rc<Cell<bool>>,
    /// True once MedBrains has been asked for and is waiting for the server.
    opening: Rc<Cell<bool>>,
}

impl Desktop {
    /// Goes back to the wallpaper. Apps stay as they were.
    fn go_home(&self) {
        self.content.set_visible_child_name("home");
        self.home_button.set_visible(false);
        self.brand.set_visible(true);
        self.title.set_label("");
    }

    /// Opens an app, full size. MedBrains waits for its server rather than failing.
    fn open(&self, app: App) {
        self.content.set_visible_child_name(app.page());
        self.home_button.set_visible(true);
        self.brand.set_visible(false);
        self.title.set_label(app.title());
        if app != App::MedBrains {
            return;
        }
        if self.medbrains_ready.get() {
            self.medbrains.open();
            self.medbrains.focus();
        } else {
            self.opening.set(true);
            self.medbrains.show_starting();
        }
    }

    /// Shows the launcher with its search empty and focused.
    fn show_launcher(&self) {
        self.content.set_visible_child_name("launcher");
        self.home_button.set_visible(true);
        self.brand.set_visible(false);
        self.title.set_label("Apps");
    }

    /// Shows one poll of the machine.
    fn show(&self, state: &State) {
        let machine = &state.machine;
        self.network_status
            .set_label(&ui::network_words(&state.network));
        self.health.set_label(ui::system_words(
            &machine.system,
            state.main_ready,
            state.set_up,
        ));
        self.memory.set_label(&ui::memory_words(machine));
        self.uptime.set_label(&format!(
            "On for {}, load {}",
            ui::uptime_words(machine.uptime_seconds),
            machine.load
        ));
        let gateway = state.network.gateway.as_deref().unwrap_or("none");
        self.network_widget.set_label(&format!(
            "{}\nGateway: {gateway}",
            ui::network_words(&state.network)
        ));
        self.disk_words.set_label(&format!(
            "{} of {} used",
            ui::size_words(machine.disk_used),
            ui::size_words(machine.disk_total)
        ));
        if machine.disk_total > 0 {
            self.disk_level
                .set_value(machine.disk_used as f64 / machine.disk_total as f64);
        }
        self.clock_warning.set_visible(!state.clock_synced);
        if state.clock_synced {
            self.clock.remove_css_class("warning");
        } else {
            self.clock.add_css_class("warning");
        }
        self.medbrains_ready.set(state.main_ready);
        if state.main_ready && self.opening.replace(false) {
            self.medbrains.open();
        }
    }

    /// Asks the machine now; a failure says so rather than leaving old figures up.
    fn refresh(&self) {
        let desktop = self.clone();
        api::fetch_state(move |result| match result {
            Ok(state) => desktop.show(&state),
            Err(failure) => desktop.health.set_label(&failure.text()),
        });
    }
}

/// A titled card on the wallpaper.
fn widget_card(title: &str, body: &gtk::Box) -> gtk::Box {
    let card = ui::column(ui::GAP / 2);
    card.add_css_class("widget");
    card.append(&ui::label(title, "muted"));
    card.append(body);
    card
}

/// The launcher page: search over a grid of tiles for what actually exists.
fn launcher_page(desktop: &Rc<Desktop>) -> gtk::Box {
    let page = ui::column(ui::GAP);
    page.add_css_class("launcher");
    let search = gtk::SearchEntry::builder()
        .placeholder_text("Search apps")
        .halign(gtk::Align::Center)
        .width_request(320)
        .build();
    let grid = gtk::FlowBox::builder()
        .selection_mode(gtk::SelectionMode::None)
        .halign(gtk::Align::Center)
        .valign(gtk::Align::Start)
        .max_children_per_line(6)
        .build();
    for app in APPS {
        let body = ui::column(ui::GAP / 2);
        body.append(&app.image(64));
        body.append(&ui::label(app.title(), ""));
        let tile = gtk::Button::builder().child(&body).build();
        tile.add_css_class("tile");
        let target = Rc::clone(desktop);
        tile.connect_clicked(move |_| target.open(app));
        grid.insert(&tile, -1);
    }
    let filter_text = search.clone();
    grid.set_filter_func(move |child| {
        let index = child.index() as usize;
        APPS.get(index)
            .is_some_and(|app| matches_search(app.title(), &filter_text.text()))
    });
    let changed = grid.clone();
    search.connect_search_changed(move |_| changed.invalidate_filter());
    let target = Rc::clone(desktop);
    search.connect_activate(move |entry| {
        if let Some(app) = APPS
            .into_iter()
            .find(|app| matches_search(app.title(), &entry.text()))
        {
            target.open(app);
        }
    });
    let target = Rc::clone(desktop);
    search.connect_stop_search(move |entry| {
        entry.set_text("");
        target.go_home();
    });
    page.append(&search);
    page.append(&grid);
    page
}

/// The dock: the launcher and each app.
fn dock(desktop: &Rc<Desktop>) -> gtk::Box {
    let dock = ui::row(ui::GAP / 2);
    dock.add_css_class("dock");
    dock.set_halign(gtk::Align::Center);
    dock.set_valign(gtk::Align::End);
    let launcher = ui::icon_button("view-app-grid-symbolic", "All apps");
    let target = Rc::clone(desktop);
    launcher.connect_clicked(move |_| target.show_launcher());
    dock.append(&launcher);
    for app in APPS {
        let button = gtk::Button::builder().child(&app.image(40)).build();
        ui::set_name(&button, app.title());
        let target = Rc::clone(desktop);
        button.connect_clicked(move |_| target.open(app));
        dock.append(&button);
    }
    dock
}

/// Settings: the network panel and what this machine is.
fn settings_page() -> gtk::Widget {
    let body = ui::column(ui::GAP);
    body.append(&ui::label("Network", "heading"));
    body.append(&network::panel());
    body.append(&ui::label("This machine", "heading"));
    let version = std::fs::read_to_string("/etc/os-release").unwrap_or_default();
    let image = version
        .lines()
        .find_map(|line| line.strip_prefix("IMAGE_VERSION="));
    let image = image.map(|value| value.trim_matches('"'));
    body.append(&ui::label(
        &format!("Image version: {}", image.unwrap_or("unknown")),
        "",
    ));
    ui::page("Settings", "", &body, &ui::row(0))
}

/// Builds the whole desktop and starts its timers.
pub(crate) fn build() -> gtk::Box {
    let root = ui::column(0);
    let bar = gtk::CenterBox::new();
    bar.add_css_class("topbar");
    let left = ui::row(ui::GAP / 2);
    let right = ui::row(ui::GAP / 2);
    let home_button = gtk::Button::builder()
        .icon_name("go-home-symbolic")
        .visible(false)
        .build();
    ui::set_name(&home_button, "Home");
    let title = ui::label("", "heading");
    let brand = ui::label("MedBrains", "heading");
    let network_status = ui::label("", "");
    let (clock, clock_warning) = clock_button();
    let health = ui::label("Checking…", "");
    let memory = ui::label("", "");
    let uptime = ui::label("", "muted");
    let network_widget = ui::label("", "");
    let disk_words = ui::label("", "");
    let disk_level = gtk::LevelBar::builder()
        .min_value(0.0)
        .max_value(1.0)
        .build();
    let content = gtk::Stack::new();
    content.set_vexpand(true);
    let desktop = Rc::new(Desktop {
        content: content.clone(),
        home_button: home_button.clone(),
        brand: brand.clone(),
        title: title.clone(),
        network_status: network_status.clone(),
        clock: clock.clone(),
        clock_warning,
        health: health.clone(),
        memory: memory.clone(),
        uptime: uptime.clone(),
        network_widget: network_widget.clone(),
        disk_words: disk_words.clone(),
        disk_level: disk_level.clone(),
        medbrains: WebApp::new(),
        medbrains_ready: Rc::default(),
        opening: Rc::default(),
    });
    left.append(&brand);
    left.append(&home_button);
    left.append(&title);
    right.append(&network_status);
    right.append(&power_button());
    bar.set_start_widget(Some(&left));
    bar.set_center_widget(Some(&clock));
    bar.set_end_widget(Some(&right));
    root.append(&bar);

    let home = gtk::Overlay::new();
    home.add_css_class("wallpaper");
    let widgets = ui::column(ui::GAP);
    widgets.set_halign(gtk::Align::End);
    widgets.set_valign(gtk::Align::Start);
    widgets.set_margin_top(ui::GAP);
    widgets.set_margin_end(ui::GAP);
    let health_body = ui::column(ui::GAP / 4);
    health_body.append(&health);
    health_body.append(&memory);
    health_body.append(&uptime);
    widgets.append(&widget_card("Machine health", &health_body));
    let network_body = ui::column(0);
    network_body.append(&network_widget);
    widgets.append(&widget_card("Network", &network_body));
    let disk_body = ui::column(ui::GAP / 4);
    disk_body.append(&disk_words);
    disk_body.append(&disk_level);
    widgets.append(&widget_card("Data disk", &disk_body));
    home.add_overlay(&widgets);
    let dock_bar = dock(&desktop);
    dock_bar.set_margin_bottom(ui::GAP);
    home.add_overlay(&dock_bar);
    home.set_child(Some(&ui::column(0)));

    content.add_named(&home, Some("home"));
    content.add_named(&launcher_page(&desktop), Some("launcher"));
    content.add_named(&desktop.medbrains.root, Some(App::MedBrains.page()));
    content.add_named(&settings_page(), Some(App::Settings.page()));
    root.append(&content);

    let target = Rc::clone(&desktop);
    home_button.connect_clicked(move |_| target.go_home());

    let target = Rc::clone(&desktop);
    target.refresh();
    let ticking = Rc::clone(&target);
    glib::timeout_add_local(REFRESH_EVERY, move || {
        ticking.refresh();
        glib::ControlFlow::Continue
    });
    set_clock(&clock);
    glib::timeout_add_seconds_local(CLOCK_SECONDS, move || {
        set_clock(&clock);
        glib::ControlFlow::Continue
    });
    root
}

#[cfg(test)]
mod tests {
    use super::{APPS, App, matches_search};

    #[test]
    fn search_ignores_case_and_space_and_empty_shows_everything() {
        assert!(matches_search("MedBrains", "med"));
        assert!(matches_search("MedBrains", " BRAINS "));
        assert!(matches_search("Settings", ""));
        assert!(!matches_search("Settings", "med"));
    }

    /// The owner's rule: tiles only for what exists.
    #[test]
    fn the_launcher_lists_only_the_apps_that_exist() {
        assert_eq!(APPS, [App::MedBrains, App::Settings]);
    }
}

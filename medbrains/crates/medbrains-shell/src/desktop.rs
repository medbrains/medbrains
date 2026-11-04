//! The desktop after setup: wallpaper, greeting, widgets, dock, launcher and the two apps.
//! Nothing here shows patient data: it speaks only about the machine.

use std::rc::Rc;
use std::time::Duration;

use gtk4 as gtk;
use gtk4::glib;
use gtk4::prelude::{BoxExt, ButtonExt, EditableExt, FlowBoxChildExt, WidgetExt};

use crate::api::{self, State};
use crate::topbar::{LOGO, TopBar};
use crate::widgets::Widgets;
use crate::{settings, ui, webapp::WebApp};

/// How often the bar and widgets ask the machine for its state.
const REFRESH_EVERY: Duration = Duration::from_secs(10);

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
            Self::Settings => gtk::Image::from_icon_name("preferences-system-symbolic"),
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
    bar: TopBar,
    widgets: Widgets,
    greeting_name: gtk::Label,
    greeting_status: gtk::Label,
    medbrains: WebApp,
    running: gtk::Box,
}

impl Desktop {
    /// Goes back to the wallpaper. Apps stay as they were.
    fn go_home(&self) {
        self.content.set_visible_child_name("home");
        self.bar.show_app(None);
    }

    /// Opens an app, full size.
    fn open(&self, app: App) {
        self.content.set_visible_child_name(app.page());
        self.bar.show_app(Some(app.title()));
        if app == App::MedBrains {
            self.medbrains.open();
            self.running.add_css_class("running");
        }
    }

    /// Shows the launcher with its search empty and focused.
    fn show_launcher(&self) {
        self.content.set_visible_child_name("launcher");
        self.bar.show_app(Some("Apps"));
    }

    /// Shows one poll of the machine.
    fn show(&self, state: &State) {
        self.bar.show(state);
        self.widgets.show(state);
        if !state.hospital.is_empty() {
            self.greeting_name.set_label(&state.hospital);
        }
        let attention = !state.machine.failed.is_empty() || state.machine.system == "degraded";
        self.greeting_status
            .set_label(&ui::status_sentence(&state.machine, state.main_ready));
        ui::set_warning(&self.greeting_status, attention);
    }

    /// Asks the machine now. A failure says so, rather than leaving old figures up.
    fn refresh(&self) {
        let desktop = self.clone();
        api::fetch_state(move |result| match result {
            Ok(state) => desktop.show(&state),
            Err(failure) => {
                desktop.greeting_status.set_label(&failure.text());
                ui::set_warning(&desktop.greeting_status, true);
            }
        });
    }
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

/// One dock entry: a tile, its label under it, and an optional running marker.
fn dock_app(icon: &gtk::Image, title: &str, brand: bool, marker: &gtk::Box) -> gtk::Button {
    let tile = gtk::CenterBox::new();
    tile.add_css_class("dock-tile");
    if brand {
        tile.add_css_class("brand");
    }
    tile.set_center_widget(Some(icon));
    let body = ui::column(4);
    body.append(&tile);
    let words = ui::label(title, "dock-label");
    words.set_xalign(0.5);
    body.append(&words);
    marker.add_css_class("running-dot");
    marker.set_halign(gtk::Align::Center);
    body.append(marker);
    let button = gtk::Button::builder().child(&body).build();
    button.add_css_class("dock-app");
    ui::set_name(&button, title);
    button
}

/// The dock: all apps, a line, then each app.
fn dock(desktop: &Rc<Desktop>) -> gtk::Box {
    let dock = ui::row(10);
    dock.add_css_class("dock");
    dock.set_halign(gtk::Align::Center);
    dock.set_valign(gtk::Align::End);
    dock.set_margin_bottom(18);
    let grid = gtk::Image::from_icon_name("view-grid-symbolic");
    grid.set_pixel_size(24);
    let launcher = dock_app(&grid, "Apps", false, &ui::column(0));
    let target = Rc::clone(desktop);
    launcher.connect_clicked(move |_| target.show_launcher());
    dock.append(&launcher);
    let line = ui::column(0);
    line.add_css_class("dock-sep");
    dock.append(&line);
    for app in APPS {
        let marker = if app == App::MedBrains {
            desktop.running.clone()
        } else {
            ui::column(0)
        };
        let size = if app == App::MedBrains { 40 } else { 24 };
        let button = dock_app(
            &app.image(size),
            app.title(),
            app == App::MedBrains,
            &marker,
        );
        let target = Rc::clone(desktop);
        button.connect_clicked(move |_| target.open(app));
        dock.append(&button);
    }
    dock
}

/// The greeting at the wallpaper's lower left.
fn greeting(name: &gtk::Label, status: &gtk::Label) -> gtk::Box {
    let greeting = ui::column(4);
    greeting.set_halign(gtk::Align::Start);
    greeting.set_valign(gtk::Align::End);
    greeting.set_margin_start(64);
    greeting.set_margin_bottom(150);
    greeting.append(name);
    greeting.append(status);
    greeting
}

/// Builds the whole desktop and starts its timer. `css` is what Settings re-themes.
pub(crate) fn build(css: &gtk::CssProvider) -> gtk::Box {
    let root = ui::column(0);
    root.add_css_class("wallpaper");
    let content = ui::stack();
    content.set_vexpand(true);
    let greeting_name = ui::label("MedBrains", "greeting-name");
    let greeting_status = ui::label("This machine is starting.", "greeting-status");
    let bar = TopBar::new();
    let desktop = Rc::new(Desktop {
        content: content.clone(),
        bar: bar.clone(),
        widgets: Widgets::new(),
        greeting_name: greeting_name.clone(),
        greeting_status: greeting_status.clone(),
        medbrains: WebApp::new(),
        running: ui::column(0),
    });
    root.append(&bar.root);

    let home = gtk::Overlay::new();
    home.set_child(Some(&ui::column(0)));
    home.add_overlay(&greeting(&greeting_name, &greeting_status));
    home.add_overlay(&desktop.widgets.root);
    home.add_overlay(&dock(&desktop));

    content.add_named(&home, Some("home"));
    content.add_named(&launcher_page(&desktop), Some("launcher"));
    content.add_named(&desktop.medbrains.root, Some(App::MedBrains.page()));
    content.add_named(&settings::page(css), Some(App::Settings.page()));
    root.append(&content);

    let target = Rc::clone(&desktop);
    bar.home.connect_clicked(move |_| target.go_home());
    desktop.refresh();
    let ticking = Rc::clone(&desktop);
    glib::timeout_add_local(REFRESH_EVERY, move || {
        ticking.refresh();
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

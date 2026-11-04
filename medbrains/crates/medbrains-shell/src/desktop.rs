//! The desktop after setup: wallpaper, greeting, widgets, dock, launcher and the two apps.
//! Nothing here shows patient data: it speaks only about the machine.

use std::rc::Rc;
use std::time::Duration;

use gtk4 as gtk;
use gtk4::glib;
use gtk4::prelude::{BoxExt, ButtonExt, EditableExt, FlowBoxChildExt, WidgetExt};

use crate::api::{self, State};
use crate::apps::{self, App};
use crate::topbar::TopBar;
use crate::widgets::Widgets;
use crate::{settings, ui, webapp::WebApp};

/// How often the bar and widgets ask the machine for its state.
const REFRESH_EVERY: Duration = Duration::from_secs(10);

/// How many apps the dock shows. The launcher lists them all.
const DOCK_APPS: usize = 6;
const BRAND_ICON_SIZE: i32 = 40;
const DOCK_ICON_SIZE: i32 = 24;
const TILE_ICON_SIZE: i32 = 64;

/// An app's image: a theme icon by name, or a file by path.
fn app_image(app: &App, size: i32) -> gtk::Image {
    let image = if app.icon.starts_with('/') {
        gtk::Image::from_file(&app.icon)
    } else {
        gtk::Image::from_icon_name(&app.icon)
    };
    image.set_pixel_size(size);
    image
}

/// The page name for an app in the desktop's stack.
fn page_name(app: &App) -> String {
    format!("app-{}", app.id)
}

/// One app and the parts of the desktop that show it.
struct Entry {
    app: App,
    /// Its view, for an app that opens a URL. Settings has none.
    web: Option<WebApp>,
    /// The dot under its dock tile.
    running: gtk::Box,
    /// Where its tiles say its unit isn't running: the dock's and the launcher's.
    notes: [gtk::Label; 2],
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
    entries: Rc<Vec<Entry>>,
}

impl Desktop {
    /// Goes back to the wallpaper. Apps stay as they were.
    fn go_home(&self) {
        self.content.set_visible_child_name("home");
        self.bar.show_app(None);
    }

    /// Opens an app, full size.
    fn open(&self, index: usize) {
        let Some(entry) = self.entries.get(index) else {
            return;
        };
        self.content.set_visible_child_name(&page_name(&entry.app));
        self.bar.show_app(Some(&entry.app.name));
        if let Some(web) = &entry.web {
            web.open();
            entry.running.add_css_class("running");
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

    /// Asks systemd about every app's unit, in one call, and updates their tiles.
    fn refresh_units(&self) {
        let with_units: Vec<usize> = (0..self.entries.len())
            .filter(|i| self.entries[*i].app.unit.is_some())
            .collect();
        let units = with_units
            .iter()
            .filter_map(|i| self.entries[*i].app.unit.clone())
            .collect();
        let entries = Rc::clone(&self.entries);
        api::fetch_unit_states(units, move |states| {
            for (index, state) in with_units.iter().zip(&states) {
                for note in &entries[*index].notes {
                    let words = apps::unit_words(state);
                    note.set_label(words);
                    note.set_visible(!words.is_empty());
                }
            }
        });
    }

    /// Asks the machine now. A failure says so, rather than leaving old figures up.
    fn refresh(&self) {
        self.refresh_units();
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
    for (index, entry) in desktop.entries.iter().enumerate() {
        let body = ui::column(ui::GAP / 2);
        body.append(&app_image(&entry.app, TILE_ICON_SIZE));
        let name = ui::line(&entry.app.name, "");
        name.set_xalign(0.5);
        body.append(&name);
        body.append(&entry.notes[0]);
        let tile = gtk::Button::builder().child(&body).build();
        tile.add_css_class("tile");
        let target = Rc::clone(desktop);
        tile.connect_clicked(move |_| target.open(index));
        grid.insert(&tile, -1);
    }
    let (filter_text, filtered) = (search.clone(), Rc::clone(&desktop.entries));
    grid.set_filter_func(move |child| {
        let index = child.index() as usize;
        filtered
            .get(index)
            .is_some_and(|e| matches_search(&e.app.name, &filter_text.text()))
    });
    let changed = grid.clone();
    search.connect_search_changed(move |_| changed.invalidate_filter());
    let target = Rc::clone(desktop);
    search.connect_activate(move |entry| {
        let found = target
            .entries
            .iter()
            .position(|e| matches_search(&e.app.name, &entry.text()));
        if let Some(index) = found {
            target.open(index);
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
fn dock_app(
    icon: &gtk::Image,
    title: &str,
    brand: bool,
    marker: &gtk::Box,
    note: Option<&gtk::Label>,
) -> gtk::Button {
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
    if let Some(note) = note {
        note.set_xalign(0.5);
        body.append(note);
    }
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
    let launcher = dock_app(&grid, "Apps", false, &ui::column(0), None);
    let target = Rc::clone(desktop);
    launcher.connect_clicked(move |_| target.show_launcher());
    dock.append(&launcher);
    let line = ui::column(0);
    line.add_css_class("dock-sep");
    dock.append(&line);
    for (index, entry) in desktop.entries.iter().enumerate().take(DOCK_APPS) {
        let size = if entry.app.accent {
            BRAND_ICON_SIZE
        } else {
            DOCK_ICON_SIZE
        };
        let image = app_image(&entry.app, size);
        let button = dock_app(
            &image,
            &entry.app.name,
            entry.app.accent,
            &entry.running,
            Some(&entry.notes[1]),
        );
        let target = Rc::clone(desktop);
        button.connect_clicked(move |_| target.open(index));
        dock.append(&button);
    }
    dock
}

/// This machine's apps, each with its page's parts ready and its view not yet made.
fn load_entries(role: &str) -> Vec<Entry> {
    let note = || {
        let note = ui::line("", "dock-label");
        note.set_visible(false);
        note
    };
    apps::load(role)
        .into_iter()
        .map(|app| Entry {
            web: WebApp::new(&app),
            running: ui::column(0),
            notes: [note(), note()],
            app,
        })
        .collect()
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
pub(crate) fn build(css: &gtk::CssProvider, role: &str) -> gtk::Box {
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
        entries: Rc::new(load_entries(role)),
    });
    root.append(&bar.root);

    let home = gtk::Overlay::new();
    home.set_child(Some(&ui::column(0)));
    home.add_overlay(&greeting(&greeting_name, &greeting_status));
    home.add_overlay(&desktop.widgets.root);
    home.add_overlay(&dock(&desktop));

    content.add_named(&home, Some("home"));
    content.add_named(&launcher_page(&desktop), Some("launcher"));
    for entry in desktop.entries.iter() {
        let name = page_name(&entry.app);
        match &entry.web {
            Some(web) => content.add_named(&web.root, Some(&name)),
            None => content.add_named(&settings::page(css), Some(&name)),
        };
    }
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
    use super::matches_search;

    #[test]
    fn search_ignores_case_and_space_and_empty_shows_everything() {
        assert!(matches_search("MedBrains", "med"));
        assert!(matches_search("MedBrains", " BRAINS "));
        assert!(matches_search("Settings", ""));
        assert!(!matches_search("Settings", "med"));
    }
}

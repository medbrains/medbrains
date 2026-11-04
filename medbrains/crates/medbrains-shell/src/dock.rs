//! The dock and the launcher: a tile for each app this machine has.

use std::rc::Rc;

use gtk4 as gtk;
use gtk4::glib;
use gtk4::prelude::{BoxExt, ButtonExt, EditableExt, FlowBoxChildExt, PopoverExt, WidgetExt};

use crate::apps::App;
use crate::desktop::Desktop;
use crate::ui;

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

/// True when a launcher search should show this name. An empty search shows everything.
fn matches_search(title: &str, query: &str) -> bool {
    title
        .to_lowercase()
        .contains(query.trim().to_lowercase().as_str())
}

/// The launcher page: search over a grid of tiles for what actually exists.
pub(crate) fn launcher_page(desktop: &Rc<Desktop>) -> gtk::Box {
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
pub(crate) fn dock(desktop: &Rc<Desktop>) -> gtk::Box {
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
        add_tile_menu(&button, desktop, index);
        dock.append(&button);
    }
    dock
}

/// A dock tile's menu: Open and Close, on a right click, a long press or the keyboard's menu key.
fn add_tile_menu(tile: &gtk::Button, desktop: &Rc<Desktop>, index: usize) {
    let panel = ui::column(ui::GAP / 4);
    let open = ui::button("Open", "");
    let close = ui::button("Close", "");
    panel.append(&open);
    panel.append(&close);
    let menu = gtk::Popover::builder().child(&panel).build();
    menu.set_parent(tile);
    let (target, source) = (Rc::clone(desktop), menu.clone());
    open.connect_clicked(move |_| {
        source.popdown();
        target.open(index);
    });
    let (target, source) = (Rc::clone(desktop), menu.clone());
    close.connect_clicked(move |_| {
        source.popdown();
        target.close(index);
    });
    // Close means nothing for an app that isn't open, so it says so by being unavailable.
    let (target, closing, shown) = (Rc::clone(desktop), close, menu.clone());
    let show = Rc::new(move || {
        closing.set_sensitive(target.running.borrow().is_open(index));
        shown.popup();
    });
    let right_click = gtk::GestureClick::builder()
        .button(gtk::gdk::BUTTON_SECONDARY)
        .build();
    let trigger = Rc::clone(&show);
    right_click.connect_pressed(move |_, _, _, _| trigger());
    tile.add_controller(right_click);
    let long_press = gtk::GestureLongPress::new();
    let trigger = Rc::clone(&show);
    long_press.connect_pressed(move |_, _, _| trigger());
    tile.add_controller(long_press);
    let keys = gtk::ShortcutController::new();
    let action = gtk::CallbackAction::new(move |_, _| {
        show();
        glib::Propagation::Stop
    });
    if let Some(trigger) = gtk::ShortcutTrigger::parse_string("Menu|<Shift>F10") {
        keys.add_shortcut(gtk::Shortcut::new(Some(trigger), Some(action)));
    }
    tile.add_controller(keys);
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

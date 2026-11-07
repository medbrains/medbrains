//! The desktop after setup: wallpaper, greeting, widgets, dock, launcher and the two apps.
//! Nothing here shows patient data: it speaks only about the machine.

use std::cell::RefCell;
use std::rc::{Rc, Weak};
use std::time::Duration;

use gtk4 as gtk;
use gtk4::glib;
use gtk4::prelude::{BoxExt, ButtonExt, EventControllerExt, WidgetExt};

use crate::api::{self, State};
use crate::apps::{self, App};
use crate::running::Running;
use crate::topbar::{Screen, TopBar};
use crate::widgets::Widgets;
use crate::{dock, power, settings, ui, webapp::WebApp};

/// How long a restart or power off may take before the screen says it hasn't happened.
const POWER_PATIENCE: Duration = Duration::from_secs(120);
/// How often the bar and widgets ask the machine for its state.
const REFRESH_EVERY: Duration = Duration::from_secs(10);

/// The page name for an app in the desktop's stack.
fn page_name(app: &App) -> String {
    format!("app-{}", app.id)
}

/// One app and the parts of the desktop that show it.
pub(crate) struct Entry {
    pub(crate) app: App,
    /// Its view, for an app that opens a URL. Settings has none.
    web: Option<WebApp>,
    /// The dot under its dock tile.
    pub(crate) running: gtk::Box,
    /// Where its tiles say its unit isn't running: the dock's and the launcher's.
    pub(crate) notes: [gtk::Label; 2],
}

/// The parts of the desktop that change after they are built.
#[derive(Clone)]
pub(crate) struct Desktop {
    content: gtk::Stack,
    bar: TopBar,
    widgets: Widgets,
    greeting_name: gtk::Label,
    greeting_status: gtk::Label,
    pub(crate) entries: Rc<Vec<Entry>>,
    pub(crate) running: Rc<RefCell<Running>>,
    /// The sentence shown during a restart or power off.
    power_words: gtk::Label,
}

impl Desktop {
    /// Goes back to the wallpaper. Apps stay as they were.
    pub(crate) fn go_home(&self) {
        self.running.borrow_mut().home();
        self.content.set_visible_child_name("home");
        self.bar.show_screen(Screen::Desktop);
    }

    /// Opens an app, full size, or switches back to it.
    pub(crate) fn open(&self, index: usize) {
        let Some(entry) = self.entries.get(index) else {
            return;
        };
        self.running.borrow_mut().open(index);
        self.content.set_visible_child_name(&page_name(&entry.app));
        let reloads = entry.web.is_some();
        self.bar.show_screen(Screen::App {
            name: &entry.app.name,
            reloads,
        });
        entry.running.add_css_class("running");
        if let Some(web) = &entry.web {
            web.open();
        }
    }

    /// Closes an app. A web view may ask about unsaved changes first, so it finishes in `closed`.
    pub(crate) fn close(&self, index: usize) {
        let Some(entry) = self.entries.get(index) else {
            return;
        };
        match &entry.web {
            Some(web) => web.close(),
            None => self.closed(index),
        }
    }

    /// Records that an app has gone.
    pub(crate) fn closed(&self, index: usize) {
        let was_showing = self.running.borrow().showing() == Some(index);
        self.running.borrow_mut().close(index);
        if let Some(entry) = self.entries.get(index) {
            entry.running.remove_css_class("running");
        }
        if was_showing {
            self.go_home();
        }
    }

    /// Puts the keyboard on the screen now showing. The closed view held the focus when it was
    /// destroyed, and without this Tab did nothing afterwards.
    fn focus_screen(&self) {
        if let Some(page) = self.content.visible_child() {
            page.child_focus(gtk::DirectionType::TabForward);
        }
    }

    /// Opens Settings, for the network menu's link.
    fn open_settings(&self) {
        let found = self.entries.iter().position(|entry| entry.web.is_none());
        if let Some(index) = found {
            self.open(index);
        }
    }

    /// Takes the screen once the machine has accepted a power action, so it can't look frozen. The
    /// words change if the machine is somehow still on after the limit.
    fn show_power(&self, action: &'static str) {
        self.power_words.set_label(power::accepted_words(action));
        self.content.set_visible_child_name("power");
        self.bar.show_screen(Screen::Desktop);
        let words = self.power_words.clone();
        glib::timeout_add_local_once(POWER_PATIENCE, move || {
            words.set_label(power::stuck_words(action));
        });
    }

    /// Closes the app on screen, if one is.
    fn close_showing(&self) {
        let showing = self.running.borrow().showing();
        if let Some(index) = showing {
            self.close(index);
        }
    }

    /// Reloads the app on screen, if it has a view.
    fn reload_showing(&self) {
        let showing = self.running.borrow().showing();
        if let Some(web) = showing.and_then(|index| self.entries[index].web.as_ref()) {
            web.reload();
        }
    }

    /// Switches to the next open app, if there is one.
    fn switch_next(&self) {
        let next = self.running.borrow().next();
        if let Some(index) = next {
            self.open(index);
        }
    }

    /// Shows the launcher with its search empty and focused.
    pub(crate) fn show_launcher(&self) {
        self.running.borrow_mut().home();
        self.content.set_visible_child_name("launcher");
        self.bar.show_screen(Screen::Launcher);
    }

    /// Shows one poll of the machine.
    fn show(&self, state: &State) {
        self.bar.show(state);
        self.widgets.show(state);
        if !state.hospital.is_empty() {
            self.greeting_name.set_label(&state.hospital);
        }
        let cut_off = ui::unreachable_sentence(&state.role, state.main_ready);
        let attention = cut_off.is_some()
            || !state.machine.failed.is_empty()
            || state.machine.system == "degraded";
        let sentence = cut_off.map_or_else(
            || ui::status_sentence(&state.machine, state.main_ready, &state.disk),
            str::to_owned,
        );
        self.greeting_status.set_label(&sentence);
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

/// The keyboard's window controls. Captured before the page, or it would take F5 and Ctrl+W.
fn shortcuts(desktop: &Rc<Desktop>) -> gtk::ShortcutController {
    let keys = gtk::ShortcutController::new();
    keys.set_scope(gtk::ShortcutScope::Global);
    keys.set_propagation_phase(gtk::PropagationPhase::Capture);
    let bind = |trigger: &str, action: fn(&Desktop)| {
        let target = Rc::clone(desktop);
        let callback = gtk::CallbackAction::new(move |_, _| {
            action(&target);
            glib::Propagation::Stop
        });
        if let Some(trigger) = gtk::ShortcutTrigger::parse_string(trigger) {
            keys.add_shortcut(gtk::Shortcut::new(Some(trigger), Some(callback)));
        }
    };
    bind("<Control>w", Desktop::close_showing);
    bind("F5", Desktop::reload_showing);
    bind("Super_L|Super_R|<Alt>Home", Desktop::go_home);
    bind("<Alt>Tab|<Control>Tab", Desktop::switch_next);
    keys
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
    // These controls are built before the desktop they act on, so they find it through this cell.
    let late: Rc<RefCell<Weak<Desktop>>> = Rc::default();
    let settings_target = Rc::clone(&late);
    let power_target = Rc::clone(&late);
    let bar = TopBar::new(
        Rc::new(move || {
            if let Some(desktop) = settings_target.borrow().upgrade() {
                desktop.open_settings();
            }
        }),
        Rc::new(move |action| {
            if let Some(desktop) = power_target.borrow().upgrade() {
                desktop.show_power(action);
            }
        }),
    );
    let desktop = Rc::new(Desktop {
        content: content.clone(),
        bar: bar.clone(),
        widgets: Widgets::new(),
        greeting_name: greeting_name.clone(),
        greeting_status: greeting_status.clone(),
        entries: Rc::new(load_entries(role)),
        running: Rc::default(),
        power_words: ui::label("", "title"),
    });
    *late.borrow_mut() = Rc::downgrade(&desktop);
    for (index, entry) in desktop.entries.iter().enumerate() {
        if let Some(web) = &entry.web {
            let target = Rc::downgrade(&desktop);
            web.on_closed(move || {
                if let Some(desktop) = target.upgrade() {
                    desktop.closed(index);
                    desktop.focus_screen();
                }
            });
        }
    }
    root.append(&bar.root);

    let home = gtk::Overlay::new();
    home.set_child(Some(&ui::column(0)));
    home.add_overlay(&greeting(&greeting_name, &greeting_status));
    home.add_overlay(&desktop.widgets.root);
    home.add_overlay(&dock::dock(&desktop));

    content.add_named(&home, Some("home"));
    let power_page = ui::column(0);
    power_page.add_css_class("app-status");
    power_page.set_valign(gtk::Align::Center);
    power_page.set_halign(gtk::Align::Center);
    power_page.append(&desktop.power_words);
    content.add_named(&power_page, Some("power"));
    content.add_named(&dock::launcher_page(&desktop), Some("launcher"));
    for entry in desktop.entries.iter() {
        let name = page_name(&entry.app);
        match &entry.web {
            Some(web) => content.add_named(&web.root, Some(&name)),
            None => content.add_named(&settings::page(css, role), Some(&name)),
        };
    }
    root.append(&content);

    let target = Rc::clone(&desktop);
    bar.home.connect_clicked(move |_| target.go_home());
    let target = Rc::clone(&desktop);
    bar.close.connect_clicked(move |_| target.close_showing());
    let target = Rc::clone(&desktop);
    bar.reload.connect_clicked(move |_| target.reload_showing());
    root.add_controller(shortcuts(&desktop));
    desktop.refresh();
    let ticking = Rc::clone(&desktop);
    glib::timeout_add_local(REFRESH_EVERY, move || {
        ticking.refresh();
        glib::ControlFlow::Continue
    });
    root
}

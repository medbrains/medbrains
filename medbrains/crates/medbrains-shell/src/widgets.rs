//! The machine widgets on the wallpaper. They speak only about the machine: no patient data.

use std::cell::RefCell;
use std::collections::VecDeque;
use std::rc::Rc;

use gtk4 as gtk;
use gtk4::prelude::{BoxExt, Cast, WidgetExt};

use crate::api::State;
use crate::ui;

/// How many memory samples the bars show. Bounded: the history never grows.
const BARS: usize = 12;
/// Height of a full bar.
const BAR_HEIGHT: f64 = 34.0;
/// A bar is always this tall, so an empty one still reads as a bar.
const BAR_MIN: i32 = 2;

/// A card with a small title.
fn card(title: &str, body: &gtk::Box) -> gtk::Box {
    let card = ui::column(ui::GAP / 2);
    card.add_css_class("widget");
    card.append(&ui::label(title, "widget-title"));
    card.append(body);
    card
}

/// One "name, value" row. The value right-aligns, as in the design.
fn value_row(body: &gtk::Box, name: &str, class: &str) -> gtk::Label {
    let row = ui::row(ui::GAP);
    let name = ui::line(name, "");
    name.set_hexpand(true);
    let value = ui::line("", class);
    value.set_xalign(1.0);
    row.append(&name);
    row.append(&value);
    body.append(&row);
    value
}

/// The heights of the bars for a history of fractions, oldest first.
fn bar_heights(history: &VecDeque<f64>) -> Vec<i32> {
    history
        .iter()
        .map(|used| ((used * BAR_HEIGHT) as i32).max(BAR_MIN))
        .collect()
}

/// Adds a sample, dropping the oldest once full.
fn push_sample(history: &mut VecDeque<f64>, sample: f64) {
    if history.len() == BARS {
        history.pop_front();
    }
    history.push_back(sample);
}

/// The widgets, kept so each poll can update them.
#[derive(Clone)]
pub(crate) struct Widgets {
    pub(crate) root: gtk::Box,
    word: gtk::Label,
    failed: gtk::Label,
    bars: Vec<gtk::Box>,
    history: Rc<RefCell<VecDeque<f64>>>,
    memory: gtk::Label,
    address: gtk::Label,
    gateway: gtk::Label,
    time: gtk::Label,
    disk_used: gtk::Label,
    disk_total: gtk::Label,
    disk_level: gtk::LevelBar,
}

impl Widgets {
    /// Builds the column of cards.
    pub(crate) fn new() -> Self {
        let health = ui::column(ui::GAP / 2);
        let word = ui::label("Starting", "big");
        let failed = ui::label("", "problem");
        failed.set_visible(false);
        failed.set_max_width_chars(36);
        let graph = ui::row(3);
        graph.set_height_request(BAR_HEIGHT as i32);
        let bars: Vec<gtk::Box> = (0..BARS)
            .map(|_| {
                let bar = ui::column(0);
                bar.add_css_class("bar");
                bar.set_valign(gtk::Align::End);
                bar.set_hexpand(true);
                bar.set_height_request(BAR_MIN);
                graph.append(&bar);
                bar
            })
            .collect();
        health.append(&word);
        health.append(&failed);
        health.append(&graph);
        let memory = value_row(&health, "Memory", "muted");

        let network = ui::column(ui::GAP / 4);
        let address = value_row(&network, "Address", "number");
        let gateway = value_row(&network, "Gateway", "number");
        let time = value_row(&network, "Time", "muted");

        let storage = ui::column(ui::GAP / 2);
        let amount = ui::row(ui::GAP / 2);
        let disk_used = ui::line("", "big");
        let disk_total = ui::line("", "muted");
        disk_total.set_valign(gtk::Align::Baseline);
        amount.append(&disk_used);
        amount.append(&disk_total);
        let disk_level = gtk::LevelBar::builder()
            .min_value(0.0)
            .max_value(1.0)
            .build();
        storage.append(&amount);
        storage.append(&disk_level);

        let root = ui::column(12);
        root.set_halign(gtk::Align::End);
        root.set_valign(gtk::Align::Start);
        root.set_margin_top(24);
        root.set_margin_end(24);
        root.set_width_request(316);
        root.append(&card("Machine health", &health));
        root.append(&card("Network", &network));
        root.append(&card("Storage", &storage));
        Self {
            root,
            word,
            failed,
            bars,
            history: Rc::default(),
            memory,
            address,
            gateway,
            time,
            disk_used,
            disk_total,
            disk_level,
        }
    }

    /// Shows one poll of the machine.
    pub(crate) fn show(&self, state: &State) {
        let machine = &state.machine;
        self.word
            .set_label(ui::health_word(machine, state.main_ready));
        let attention = !machine.failed.is_empty();
        ui::set_warning(&self.word, attention);
        self.failed.set_label(&machine.failed.join(", "));
        self.failed.set_visible(attention);
        self.memory.set_label(&ui::memory_words(machine));
        push_sample(&mut self.history.borrow_mut(), ui::memory_fraction(machine));
        let heights = bar_heights(&self.history.borrow());
        for (bar, height) in self.bars.iter().zip(heights) {
            bar.set_height_request(height);
        }
        let address = state
            .network
            .links
            .iter()
            .find_map(|link| link.addresses.first());
        self.address
            .set_label(address.map_or("None", String::as_str));
        self.gateway
            .set_label(state.network.gateway.as_deref().unwrap_or("None"));
        let (words, warning) = ui::clock_words(&state.clock);
        self.time.set_label(words);
        ui::set_warning(self.time.upcast_ref::<gtk::Widget>(), warning);
        self.disk_used.set_label(&ui::size_words(machine.disk_used));
        self.disk_total
            .set_label(&format!("of {} used", ui::size_words(machine.disk_total)));
        if machine.disk_total > 0 {
            self.disk_level
                .set_value(machine.disk_used as f64 / machine.disk_total as f64);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{BARS, VecDeque, bar_heights, push_sample};

    /// A desktop runs for months, so the history must stay bounded.
    #[test]
    fn the_history_never_grows_past_its_bars() {
        let mut history = VecDeque::new();
        for sample in 0..BARS * 3 {
            push_sample(&mut history, sample as f64);
        }
        assert_eq!(history.len(), BARS);
        assert_eq!(history.front().copied(), Some((BARS * 2) as f64));
    }

    #[test]
    fn bars_scale_with_use_and_never_vanish() {
        let history: VecDeque<f64> = [0.0, 0.5, 1.0].into_iter().collect();
        assert_eq!(bar_heights(&history), [2, 17, 34]);
    }
}

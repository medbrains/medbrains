//! The time zone chooser, shared by first boot and Settings. The service keeps the setting.

use gtk4 as gtk;
use gtk4::glib;
use gtk4::prelude::{BoxExt, Cast, ListModelExt, StaticType};
use serde_json::json;

use crate::{api, ui};

/// The setting the shell's child processes read for the time zone.
const LOCALTIME_LINK: &str = "/var/lib/medbrains-settings/localtime";

/// `TZ`'s value for the zone a setting's link points at: the bare name, which is the form WebKit's
/// time zone library accepts. Its sandbox can't see the setting itself, only `/usr`, so its pages
/// would otherwise show UTC.
fn tz_value(link_target: &str) -> Option<&str> {
    link_target.strip_prefix("/usr/share/zoneinfo/")
}

/// Tells processes started from now on which zone to use. A page already open keeps the old
/// one until the machine restarts.
pub(crate) fn export_for_children() {
    let target = std::fs::read_link(LOCALTIME_LINK).unwrap_or_default();
    if let Some(value) = target.to_str().and_then(tz_value) {
        if glib::setenv("TZ", value, true).is_err() {
            glib::g_warning!("medbrains-shell", "could not set the time zone for an app");
        }
    }
}

/// Position of `current` in the list, or the first entry.
fn position_of(zones: &[String], current: &str) -> u32 {
    zones.iter().position(|zone| zone == current).unwrap_or(0) as u32
}

/// Builds the chooser: a searchable list set to the machine's current zone.
pub(crate) fn chooser() -> gtk::Box {
    let root = ui::column(ui::GAP / 2);
    let title = ui::label("Time zone", "");
    let names = gtk::StringList::new(&[]);
    let search = gtk::PropertyExpression::new(
        gtk::StringObject::static_type(),
        None::<&gtk::Expression>,
        "string",
    );
    let list = gtk::DropDown::builder()
        .model(&names)
        .expression(&search)
        .enable_search(true)
        .search_match_mode(gtk::StringFilterMatchMode::Substring)
        .build();
    gtk4::prelude::AccessibleExtManual::update_relation(
        &list,
        &[gtk::accessible::Relation::LabelledBy(&[title.upcast_ref()])],
    );
    let problem = ui::label("", "problem");
    root.append(&title);
    root.append(&list);
    root.append(&problem);

    let (source, chosen, report) = (names.clone(), list.clone(), problem);
    api::fetch_state(move |state| {
        let current = state.map_or_else(|_| String::new(), |state| state.timezone);
        api::fetch_timezones(move |zones| {
            let zones = zones.unwrap_or_default();
            let refs: Vec<&str> = zones.iter().map(String::as_str).collect();
            source.splice(0, source.n_items(), &refs);
            chosen.set_selected(position_of(&zones, &current));
            let names = source.clone();
            chosen.connect_selected_notify(move |list| {
                let zone = names.string(list.selected()).unwrap_or_default();
                let report = report.clone();
                api::post(
                    "/timezone",
                    &json!({ "zone": zone.as_str() }),
                    move |result| {
                        report.set_label(&result.map_or_else(|f| f.text(), |_| String::new()));
                    },
                );
            });
        });
    });
    root
}

#[cfg(test)]
mod tests {
    use super::{position_of, tz_value};

    /// A wrong link must not reach the environment of a page's process.
    #[test]
    fn only_a_real_zone_file_becomes_tz() {
        assert_eq!(
            tz_value("/usr/share/zoneinfo/Asia/Kolkata"),
            Some("Asia/Kolkata")
        );
        assert_eq!(tz_value("/etc/passwd"), None);
        assert_eq!(tz_value(""), None);
    }

    #[test]
    fn the_list_opens_on_the_current_zone() {
        let zones = ["Asia/Dubai".to_owned(), "Asia/Kolkata".to_owned()];
        assert_eq!(position_of(&zones, "Asia/Kolkata"), 1);
        assert_eq!(position_of(&zones, "Nowhere"), 0);
    }
}

//! First boot: Network, Updates, the main question, three fields, Review. Nothing is final
//! until Review, and every screen after the first has Back.

use std::cell::RefCell;
use std::rc::Rc;

use gtk4 as gtk;
use gtk4::prelude::{AccessibleExtManual, BoxExt, ButtonExt, Cast, EditableExt, WidgetExt};
use serde_json::json;

use crate::api::{self, Failure};
use crate::join;
use crate::network;
use crate::timezone;
use crate::ui;

/// The setup screens.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Step {
    Network,
    Time,
    Updates,
    Purpose,
    Connecting,
    Details,
    Review,
}

impl Step {
    /// The screen's name in the stack.
    const fn name(self) -> &'static str {
        match self {
            Self::Network => "network",
            Self::Time => "time",
            Self::Updates => "updates",
            Self::Purpose => "purpose",
            Self::Connecting => "connecting",
            Self::Details => "details",
            Self::Review => "review",
        }
    }

    /// Where Back goes. Only the first screen has none.
    const fn back(self) -> Option<Self> {
        match self {
            Self::Network => None,
            Self::Time => Some(Self::Network),
            Self::Updates => Some(Self::Time),
            Self::Purpose => Some(Self::Updates),
            Self::Connecting | Self::Details => Some(Self::Purpose),
            Self::Review => Some(Self::Details),
        }
    }
}

/// What the flow carries between screens.
#[derive(Clone)]
struct Flow {
    stack: gtk::Stack,
    /// The three fields as last accepted, held only until they reach the service.
    draft: Rc<RefCell<(String, String, String)>>,
}

impl Flow {
    /// Shows a screen. The stack moves the focus into it, so the keyboard follows; moving it
    /// again here would skip the first field.
    fn go(&self, step: Step) {
        self.stack.set_visible_child_name(step.name());
    }

    /// The button row for a screen: Back if it has one, then `extra`.
    fn actions(&self, step: Step, extra: Option<&gtk::Button>) -> gtk::Box {
        let actions = ui::row(ui::GAP);
        if let Some(previous) = step.back() {
            let back = ui::button("Back", "");
            let flow = self.clone();
            back.connect_clicked(move |_| flow.go(previous));
            actions.append(&back);
        }
        if let Some(extra) = extra {
            actions.append(extra);
        }
        actions
    }

    /// A Continue button that moves to the next screen.
    fn continue_to(&self, next: Step) -> gtk::Button {
        let button = ui::button("Continue", "suggested-action");
        let flow = self.clone();
        button.connect_clicked(move |_| flow.go(next));
        button
    }
}

/// The network screen.
fn network_page(flow: &Flow) -> gtk::Widget {
    let next = flow.continue_to(Step::Time);
    let actions = flow.actions(Step::Network, Some(&next));
    let intro = "On a cable there is nothing to do here. No internet is fine.";
    ui::page("Network", intro, &network::panel(None), &actions)
}

/// The time zone screen. Asia/Kolkata unless changed; changing it takes effect at once.
fn time_page(flow: &Flow) -> gtk::Widget {
    let next = flow.continue_to(Step::Updates);
    let actions = flow.actions(Step::Time, Some(&next));
    let words = "The clock sets itself when this machine can reach a time server.";
    ui::page("Time zone", words, &timezone::chooser(), &actions)
}

/// The updates screen. It says what is true: there is nothing to install from yet.
fn updates_page(flow: &Flow) -> gtk::Widget {
    let next = flow.continue_to(Step::Purpose);
    let actions = flow.actions(Step::Updates, Some(&next));
    let words = "Installing updates is not available in this version. \
                 This machine stays on the software it came with.";
    ui::page("Updates", words, &ui::column(0), &actions)
}

/// A large choice with a sentence under it.
fn choice(title: &str, detail: &str) -> gtk::Button {
    let body = ui::column(ui::GAP / 4);
    body.append(&ui::label(title, "heading"));
    body.append(&ui::label(detail, "muted"));
    let button = gtk::Button::builder().child(&body).build();
    button.add_css_class("choice");
    button
}

/// The main question.
fn purpose_page(flow: &Flow) -> gtk::Widget {
    let body = ui::column(ui::GAP);
    let new_hospital = choice(
        "Setting up a new hospital",
        "This becomes the main machine.",
    );
    let connecting = choice(
        "Connecting to my hospital",
        "This machine joins a main machine.",
    );
    body.append(&new_hospital);
    body.append(&connecting);
    let target = flow.clone();
    new_hospital.connect_clicked(move |_| target.go(Step::Details));
    let target = flow.clone();
    connecting.connect_clicked(move |_| target.go(Step::Connecting));
    let actions = flow.actions(Step::Purpose, None);
    ui::page("What are you doing with this machine?", "", &body, &actions)
}

/// Finds a main machine and asks to join it.
fn connecting_page(flow: &Flow, finished: Rc<dyn Fn()>) -> gtk::Widget {
    let actions = flow.actions(Step::Connecting, None);
    join::page(&actions, finished)
}

/// Adds the line under a field that holds its rule, and turns red if the rule is broken.
fn field_note(form: &gtk::Box) -> gtk::Label {
    let note = ui::label("", "muted");
    form.append(&note);
    note
}

/// Shows the service's words: as plain rules on an empty form, as problems on a filled one.
fn show_rules(failure: &Failure, notes: &[(&str, gtk::Label)], as_problems: bool) {
    let Failure::Problems(problems) = failure else {
        return;
    };
    for (name, note) in notes {
        let words = problems
            .iter()
            .find(|(key, _)| key == name)
            .map(|(_, words)| words.as_str());
        if let Some(words) = words {
            note.set_label(words);
        }
        if as_problems && words.is_some() {
            note.add_css_class("problem");
        } else {
            note.remove_css_class("problem");
        }
    }
}

/// The three fields. The rules on screen come from the service, the same ones it enforces.
fn details_page(flow: &Flow, review: Rc<dyn Fn()>) -> gtk::Widget {
    let form = ui::column(ui::GAP / 2);
    let hospital = network::field(&form, "Hospital name", "City Hospital");
    let hospital_note = field_note(&form);
    let username = network::field(&form, "Username", "asha");
    let username_note = field_note(&form);
    let title = ui::label("Password", "");
    let password = gtk::PasswordEntry::builder().show_peek_icon(true).build();
    password.update_relation(&[gtk::accessible::Relation::LabelledBy(&[title.upcast_ref()])]);
    form.append(&title);
    form.append(&password);
    let password_note = field_note(&form);
    let notes = Rc::new([
        ("hospital", hospital_note),
        ("username", username_note),
        ("password", password_note),
    ]);

    let hint_notes = Rc::clone(&notes);
    let empty = json!({ "hospital": "", "username": "", "password": "" });
    api::post("/hospital/check", &empty, move |result| {
        if let Err(failure) = result {
            show_rules(&failure, &*hint_notes, false);
        }
    });

    let next = ui::button("Continue", "suggested-action");
    let actions = flow.actions(Step::Details, Some(&next));
    let target = flow.clone();
    next.connect_clicked(move |_| {
        let fields = (
            hospital.text().to_string(),
            username.text().to_string(),
            password.text().to_string(),
        );
        let body = json!({ "hospital": fields.0, "username": fields.1, "password": fields.2 });
        let (flow, notes, review) = (target.clone(), Rc::clone(&notes), Rc::clone(&review));
        api::post("/hospital/check", &body, move |result| match result {
            Ok(_) => {
                *flow.draft.borrow_mut() = fields;
                review();
                flow.go(Step::Review);
            }
            Err(failure) => show_rules(&failure, &*notes, true),
        });
    });
    ui::page(
        "Your new hospital",
        "Everything else can be changed later.",
        &form,
        &actions,
    )
}

/// The last screen before anything changes, and how it updates its summary.
fn review_page(flow: &Flow, finished: Rc<dyn Fn()>) -> (gtk::Widget, Rc<dyn Fn()>) {
    let body = ui::column(ui::GAP / 2);
    let name = ui::label("", "");
    let user = ui::label("", "");
    let problem = ui::label("", "problem");
    body.append(&name);
    body.append(&user);
    body.append(&ui::label(
        "Password: as you typed it. Go back to see it.",
        "",
    ));
    body.append(&problem);
    let start = ui::button("Start the main machine", "suggested-action");
    let actions = flow.actions(Step::Review, Some(&start));

    let target = flow.clone();
    let sending = start.clone();
    start.connect_clicked(move |_| {
        let (hospital, username, password) = target.draft.borrow().clone();
        let body = json!({ "hospital": hospital, "username": username, "password": password });
        sending.set_sensitive(false);
        let (flow, finished, problem, sending) = (
            target.clone(),
            Rc::clone(&finished),
            problem.clone(),
            sending.clone(),
        );
        api::post("/hospital", &body, move |result| match result {
            Ok(_) => {
                *flow.draft.borrow_mut() = Default::default();
                finished();
            }
            // It may have got further than the answer says. Reads the truth before saying anything,
            // so a machine already set up moves on rather than offering a dead end.
            Err(failure) => api::fetch_state(move |state| {
                if state.is_ok_and(|state| state.set_up) {
                    *flow.draft.borrow_mut() = Default::default();
                    finished();
                } else {
                    problem.set_label(&failure.text());
                    sending.set_sensitive(true);
                }
            }),
        });
    });

    let source = flow.clone();
    let refresh: Rc<dyn Fn()> = Rc::new(move || {
        let draft = source.draft.borrow();
        name.set_label(&format!("Hospital: {}", draft.0));
        user.set_label(&format!("Username: {}", draft.1));
    });
    let words = "Check this. After this step the machine starts as your hospital's main machine.";
    (ui::page("Review", words, &body, &actions), refresh)
}

/// Builds the whole flow. `finished` runs once the service has started the main machine.
pub(crate) fn build(finished: impl Fn() + 'static) -> gtk::Stack {
    let stack = ui::stack();
    let flow = Flow {
        stack: stack.clone(),
        draft: Rc::default(),
    };
    let finished: Rc<dyn Fn()> = Rc::new(finished);
    let (review, refresh) = review_page(&flow, Rc::clone(&finished));
    stack.add_named(&network_page(&flow), Some(Step::Network.name()));
    stack.add_named(&time_page(&flow), Some(Step::Time.name()));
    stack.add_named(&updates_page(&flow), Some(Step::Updates.name()));
    stack.add_named(&purpose_page(&flow), Some(Step::Purpose.name()));
    stack.add_named(&connecting_page(&flow, finished), Some(Step::Connecting.name()));
    stack.add_named(&details_page(&flow, refresh), Some(Step::Details.name()));
    stack.add_named(&review, Some(Step::Review.name()));
    stack
}

#[cfg(test)]
mod tests {
    use super::Step;

    /// Every screen after the first must have a way back, and the connecting dead end
    /// must lead back to the question, or a person is stuck there.
    #[test]
    fn back_walks_the_flow_and_only_the_first_screen_has_none() {
        assert_eq!(Step::Network.back(), None);
        assert_eq!(Step::Connecting.back(), Some(Step::Purpose));
        assert_eq!(Step::Details.back(), Some(Step::Purpose));
        let mut step = Step::Review;
        let mut hops = 0;
        while let Some(previous) = step.back() {
            step = previous;
            hops += 1;
        }
        assert_eq!((step, hops), (Step::Network, 5));
    }
}

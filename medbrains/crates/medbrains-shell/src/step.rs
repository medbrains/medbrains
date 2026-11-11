//! The setup flow's screens, their order, and the branded strip that shows where a person is.

use gtk4 as gtk;
use gtk4::prelude::{BoxExt, WidgetExt};

use crate::ui;

/// The setup screens.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Step {
    Network,
    Time,
    Updates,
    Purpose,
    Connecting,
    Details,
    Review,
    Authenticator,
}

/// How many places the strip over the flow counts. The two answers to the main question share one.
const PLACES: u8 = 7;
/// The mascot's size in the strip over each step.
const MASCOT_SIZE: i32 = 48;

impl Step {
    /// Every screen, so a stack page's name can be read back as a step.
    const ALL: [Self; 8] = [
        Self::Network,
        Self::Time,
        Self::Updates,
        Self::Purpose,
        Self::Connecting,
        Self::Details,
        Self::Review,
        Self::Authenticator,
    ];

    /// The step a stack page's name stands for.
    fn from_name(name: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|step| step.name() == name)
    }

    /// Where this screen sits in the flow, counting from one, for the strip over it.
    const fn place(self) -> u8 {
        match self {
            Self::Network => 1,
            Self::Time => 2,
            Self::Updates => 3,
            Self::Purpose => 4,
            Self::Connecting | Self::Details => 5,
            Self::Review => 6,
            Self::Authenticator => 7,
        }
    }

    /// The strip's words for this screen.
    fn place_words(self) -> String {
        format!("Step {} of {PLACES}", self.place())
    }

    /// The screen's name in the stack.
    pub(crate) const fn name(self) -> &'static str {
        match self {
            Self::Network => "network",
            Self::Time => "time",
            Self::Updates => "updates",
            Self::Purpose => "purpose",
            Self::Connecting => "connecting",
            Self::Details => "details",
            Self::Review => "review",
            Self::Authenticator => "authenticator",
        }
    }

    /// Where Back goes. Only the first screen has none.
    pub(crate) const fn back(self) -> Option<Self> {
        match self {
            Self::Network => None,
            Self::Time => Some(Self::Network),
            Self::Updates => Some(Self::Time),
            Self::Purpose => Some(Self::Updates),
            Self::Connecting | Self::Details => Some(Self::Purpose),
            Self::Review => Some(Self::Details),
            Self::Authenticator => Some(Self::Review),
        }
    }
}

/// The strip over every step: the mascot, where this screen is in the flow, and a blue bar that
/// fills as it goes. It follows the stack, so no screen has to remember to update it.
pub(crate) fn strip(stack: &gtk::Stack) -> gtk::Box {
    let strip = ui::column(ui::GAP / 2);
    strip.add_css_class("setup-strip");
    strip.set_halign(gtk::Align::Center);
    strip.set_width_request(ui::FORM_WIDTH);
    let top = ui::row(ui::GAP);
    let words = ui::column(0);
    words.set_valign(gtk::Align::Center);
    words.append(&ui::line("Set up MedBrains", "eyebrow"));
    let place = ui::line("", "muted");
    words.append(&place);
    top.append(&ui::mascot(MASCOT_SIZE));
    top.append(&words);
    let progress = gtk::ProgressBar::new();
    ui::set_name(&progress, "Setup progress");
    strip.append(&top);
    strip.append(&progress);
    let show = move |stack: &gtk::Stack| {
        let step = stack
            .visible_child_name()
            .and_then(|name| Step::from_name(&name));
        if let Some(step) = step {
            place.set_label(&step.place_words());
            progress.set_fraction(f64::from(step.place()) / f64::from(PLACES));
        }
    };
    show(stack);
    stack.connect_visible_child_name_notify(show);
    strip
}

#[cfg(test)]
mod tests {
    use super::{PLACES, Step};

    /// Every screen after the first must have a way back, and the connecting dead end
    /// must lead back to the question, or a person is stuck there.
    #[test]
    fn back_walks_the_flow_and_only_the_first_screen_has_none() {
        assert_eq!(Step::Network.back(), None);
        assert_eq!(Step::Connecting.back(), Some(Step::Purpose));
        assert_eq!(Step::Details.back(), Some(Step::Purpose));
        assert_eq!(Step::Authenticator.back(), Some(Step::Review));
        let mut step = Step::Authenticator;
        let mut hops = 0;
        while let Some(previous) = step.back() {
            step = previous;
            hops += 1;
        }
        assert_eq!((step, hops), (Step::Network, 6));
    }

    /// The strip must never count backwards as a person goes forward, and must reach its end.
    #[test]
    fn the_strip_counts_up_along_the_flow_to_its_last_place() {
        for step in Step::ALL {
            assert_eq!(Step::from_name(step.name()), Some(step));
            if let Some(previous) = step.back() {
                assert!(previous.place() < step.place(), "{step:?}");
            }
        }
        assert_eq!(Step::Network.place_words(), "Step 1 of 7");
        assert_eq!(Step::Authenticator.place(), PLACES);
        assert_eq!(Step::from_name("nowhere"), None);
    }
}

//! The first administrator's authenticator app, the last setup screen: a QR code and its secret as text, then one
//! code to prove the phone has it. Kanidm makes the secret; the setup service turns it into the QR code.

use std::cell::RefCell;
use std::rc::Rc;

use gtk4 as gtk;
use gtk4::prelude::{
    AccessibleExtManual, BoxExt, ButtonExt, Cast, DrawingAreaExtManual, EditableExt, EntryExt,
    WidgetExt,
};
use serde_json::Value;

use crate::setup::{Flow, start_machine};
use crate::step::Step;
use crate::ui;

/// How many modules of white the QR code keeps around it, as its standard asks.
const QR_QUIET: usize = 4;
/// The QR code's size on screen. Large enough for a phone held at arm's length.
const QR_PIXELS: i32 = 240;
const CODE_DIGITS: i32 = 6;

/// The QR code, drawn black on white whatever the theme: a phone's camera needs that contrast.
fn qr_view(modules: Rc<RefCell<Vec<Vec<bool>>>>) -> gtk::DrawingArea {
    let area = gtk::DrawingArea::builder()
        .content_width(QR_PIXELS)
        .content_height(QR_PIXELS)
        .halign(gtk::Align::Start)
        .build();
    ui::set_name(&area, "QR code for your authenticator app");
    // A failed draw leaves it blank until the next one; there is nothing better to do.
    area.set_draw_func(move |_, cr, width, height| {
        paint_qr(cr, &modules.borrow(), width.min(height)).ok();
    });
    area
}

/// Paints the modules, with their quiet zone, into a square `side` pixels across.
fn paint_qr(
    cr: &gtk::cairo::Context,
    modules: &[Vec<bool>],
    side: i32,
) -> Result<(), gtk::cairo::Error> {
    let cell = f64::from(side) / (modules.len() + 2 * QR_QUIET) as f64;
    let at = |n: usize| (n + QR_QUIET) as f64 * cell;
    cr.set_source_rgb(1.0, 1.0, 1.0);
    cr.paint()?;
    cr.set_source_rgb(0.0, 0.0, 0.0);
    for (y, row) in modules.iter().enumerate() {
        for (x, _) in row.iter().enumerate().filter(|(_, dark)| **dark) {
            cr.rectangle(at(x), at(y), cell, cell);
        }
    }
    cr.fill()
}

/// Fills the authenticator step from the setup service's answer.
type Fill = Rc<dyn Fn(&Value)>;

/// The authenticator step: the QR code and the secret, then one code to prove the phone has it. The returned
/// function fills it from the setup service's answer.
pub(crate) fn page(flow: &Flow, finished: Rc<dyn Fn()>) -> (gtk::Widget, Fill) {
    let body = ui::column(ui::GAP / 2);
    let modules = Rc::new(RefCell::new(Vec::new()));
    let qr = qr_view(Rc::clone(&modules));
    body.append(&qr);
    body.append(&ui::label(
        "Can't scan it? Type this key into the app instead:",
        "",
    ));
    let secret = ui::label("", "");
    secret.set_selectable(true);
    body.append(&secret);
    let title = ui::label("6-digit code from the app", "");
    let code = gtk::Entry::builder()
        .max_length(CODE_DIGITS)
        .input_purpose(gtk::InputPurpose::Digits)
        .build();
    code.update_relation(&[gtk::accessible::Relation::LabelledBy(&[title.upcast_ref()])]);
    body.append(&title);
    body.append(&code);
    let problem = ui::label("", "problem");
    body.append(&problem);
    let confirm = ui::button("Confirm and start", "suggested-action");
    let actions = flow.actions(Step::Authenticator, Some(&confirm));

    // A wrong code keeps the same QR code: the person types the next one.
    let (entry, button, shown) = (code.clone(), confirm.clone(), problem.clone());
    let failed: Rc<dyn Fn(&str)> = Rc::new(move |words: &str| {
        shown.set_label(words);
        entry.set_text("");
        button.set_sensitive(true);
    });
    // The secret leaves the screen once it is saved.
    let (secret_shown, grid) = (secret.clone(), Rc::clone(&modules));
    let done: Rc<dyn Fn()> = Rc::new(move || {
        secret_shown.set_label("");
        grid.borrow_mut().clear();
        finished();
    });
    let (target, entry, button, shown) =
        (flow.clone(), code.clone(), confirm.clone(), problem.clone());
    let send = Rc::new(move || {
        button.set_sensitive(false);
        shown.set_label("");
        start_machine(&target, &entry.text(), Rc::clone(&done), Rc::clone(&failed));
    });
    let clicked = Rc::clone(&send);
    confirm.connect_clicked(move |_| clicked());
    code.connect_activate(move |_| send());

    let enrol: Rc<dyn Fn(&Value)> = Rc::new(move |totp: &Value| {
        let rows = totp["qr"].as_array().map(Vec::as_slice).unwrap_or_default();
        *modules.borrow_mut() = rows
            .iter()
            .map(|row| {
                row.as_str()
                    .unwrap_or_default()
                    .chars()
                    .map(|c| c == '1')
                    .collect()
            })
            .collect();
        qr.queue_draw();
        secret.set_label(totp["secret"].as_str().unwrap_or_default());
        problem.set_label("");
        code.set_text("");
        confirm.set_sensitive(true);
    });
    let words = "Your login needs a second step. Install an authenticator app on your phone if you have none, \
                 such as Google Authenticator, Microsoft Authenticator or FreeOTP. Scan this code with it, then \
                 type the 6 digits it shows. You will need the app each time you sign in as this administrator.";
    (
        ui::page("Set up your authenticator app", words, &body, &actions),
        enrol,
    )
}

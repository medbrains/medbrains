//! Rich answers: the model shows a tool result as a widget from the closed
//! catalogue ([`medbrains_core::ai_widgets`]) instead of retyping it.
//!
//! The tools put what they fetched on the turn's [`Shelf`] — exactly what the
//! user may see: redacted (restricted classes withheld) and read back. The
//! `show` tool builds the widget from the shelf, never from the model's
//! words, and hands it to the stream ([`Widgets`]). The model is told only
//! that it was shown.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(clippy::redundant_pub_crate, reason = "unreachable_pub is denied workspace-wide")]

use std::collections::HashMap;
use std::sync::{Arc, Mutex, PoisonError};

use medbrains_core::ai_redact::Redacted;
use medbrains_core::ai_widgets::{Widget, build};
use serde_json::Value;

use super::redaction;

/// Most results one turn keeps for widgets.
const MAX_SHELVED: usize = 16;

/// What this turn's tools fetched, by source: the `call_api` path as the model
/// wrote it, or `patient_overview`.
pub(super) type Shelf = Arc<Mutex<HashMap<String, Value>>>;
/// Widgets built this turn, waiting for the stream to send them.
pub(super) type Widgets = Arc<Mutex<Vec<Widget>>>;

/// Keep `data` for widgets as the user would see it: through this turn's
/// redaction (so a withheld class stays withheld) and read back.
pub(super) fn shelve(shelf: &Shelf, session: &redaction::Session, source: &str, data: &Value) {
    let seen = redaction::for_model(session, &data.to_string());
    let shown = redaction::for_user(session, seen.for_model());
    let Ok(value) = serde_json::from_str::<Value>(&shown) else {
        return; // withheld whole, or not JSON: nothing to show
    };
    let mut shelf = shelf.lock().unwrap_or_else(PoisonError::into_inner);
    if shelf.len() < MAX_SHELVED || shelf.contains_key(source) {
        shelf.insert(source.to_owned(), value);
    }
}

#[derive(serde::Deserialize)]
pub(super) struct ShowArgs {
    kind: String,
    source: String,
    #[serde(default)]
    title: String,
}

/// Show a fetched result as a widget on the user's screen.
pub(super) struct ShowTool {
    pub(super) session: redaction::Session,
    pub(super) shelf: Shelf,
    pub(super) widgets: Widgets,
}

impl ShowTool {
    /// What the model is told: shown (and how big), or why not.
    fn show(&self, args: &ShowArgs) -> String {
        let data = self
            .shelf
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .get(args.source.trim())
            .cloned();
        let Some(data) = data else {
            return format!(
                "Not shown: no result was fetched from {:?} this turn. Use the exact path you \
                 passed to call_api, or patient_overview.",
                args.source
            );
        };
        match build(&args.kind, &args.title, &data) {
            Ok(widget) => {
                let size = match &widget {
                    Widget::Kpis { tiles, .. } => tiles.len(),
                    Widget::Table { total_rows, .. } => *total_rows,
                    Widget::Chart { rows, .. } => rows.len(),
                    Widget::List { items, .. } => items.len(),
                };
                self.widgets
                    .lock()
                    .unwrap_or_else(PoisonError::into_inner)
                    .push(widget);
                format!("Shown to the user as a {} ({size} entries).", args.kind)
            }
            Err(e) => format!("Not shown: {e}."),
        }
    }
}

impl rig::tool::Tool for ShowTool {
    const NAME: &'static str = "show";
    type Error = std::convert::Infallible;
    type Args = ShowArgs;
    type Output = Redacted;

    fn description(&self) -> String {
        "Show data you fetched this turn as a widget on the user's screen, built from the \
        fetched data itself: kind 'kpis' (headline numbers), 'table' (rows), 'chart' (numbers \
        over a label column, e.g. a trend), 'list' (items with a status). source = the exact \
        path you passed to call_api, or 'patient_overview'. After showing, write at most one \
        sentence and do not repeat the widget's numbers."
            .to_owned()
    }

    fn parameters(&self) -> Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "kind": { "type": "string", "enum": ["kpis", "table", "chart", "list"] },
                "source": { "type": "string", "description": "The call_api path, or patient_overview" },
                "title": { "type": "string", "description": "A short title, e.g. Today's billing" }
            },
            "required": ["kind", "source"]
        })
    }

    fn call(
        &self,
        _context: &mut rig::tool::ToolContext,
        args: Self::Args,
    ) -> impl Future<Output = Result<Self::Output, Self::Error>> + Send {
        std::future::ready(Ok(redaction::for_model(&self.session, &self.show(&args))))
    }
}

/// Every widget built since the last call, to send now.
pub(super) fn drain(widgets: &Widgets) -> Vec<Widget> {
    std::mem::take(&mut *widgets.lock().unwrap_or_else(PoisonError::into_inner))
}

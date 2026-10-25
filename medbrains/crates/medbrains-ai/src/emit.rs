//! The assistant's stream, frame by frame: guarded, re-hydrated text, tool
//! chips, widgets and the guard's notice, as AG-UI events ([`super::agui`]).

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use std::sync::{Arc, Mutex, PoisonError};

use axum::response::sse::Event;
use medbrains_core::ai_guard::{AnswerGuard, resolve_or_hide};
use medbrains_core::ai_redact::StreamRehydrator;
use rig::message::{ToolCall, ToolResult, ToolResultContent};
use rig::streaming::{Item, StreamEvent};
use rig_agent::agent::MultiTurnStreamItem;
use uuid::Uuid;

use super::agui::{Agui, CUSTOM_GUARD, CUSTOM_RESET, CUSTOM_WIDGET};
use super::kept::Kept;
use super::{redaction, show, sse};

/// One AG-UI event as an SSE frame.
pub(super) fn ag(event: &Agui<'_>) -> Result<Event, std::convert::Infallible> {
    sse(&serde_json::to_value(event).unwrap_or_default())
}

/// The chip for a tool the assistant is running: start, its arguments (read
/// back for the user, sent whole, not char by char), end.
fn tool_call_events(
    session: &redaction::Session,
    tool_call: &ToolCall,
    parent: &str,
) -> [Result<Event, std::convert::Infallible>; 3] {
    let raw = serde_json::Value::Object(tool_call.function.arguments.clone()).to_string();
    let id = tool_call.id.to_string();
    [
        ag(&Agui::ToolCallStart {
            tool_call_id: id.clone(),
            tool_call_name: tool_call.function.name.to_string(),
            parent_message_id: parent,
        }),
        ag(&Agui::ToolCallArgs {
            tool_call_id: id.clone(),
            delta: redaction::for_user(session, &raw),
        }),
        ag(&Agui::ToolCallEnd { tool_call_id: id }),
    ]
}

/// A tool's (redacted) output: a record the guard may let the answer restate,
/// and read back for the user's chip.
fn tool_result_event(
    guard: &Mutex<AnswerGuard>,
    session: &redaction::Session,
    tool_result: &ToolResult,
    message_id: &str,
) -> Result<Event, std::convert::Infallible> {
    let text = tool_result.content.iter().find_map(|c| match c {
        ToolResultContent::Text(t) => Some(t.text.clone()),
        _ => None,
    });
    let content = text.map_or_else(String::new, |t| {
        guard
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .add_record(&t);
        redaction::for_user(session, &t)
    });
    ag(&Agui::ToolCallResult {
        message_id,
        tool_call_id: tool_result.call.to_string(),
        content,
    })
}

/// Tokens for the whole turn (every model call), for the cost readout.
/// rig counts cached tokens inside `input_tokens`; the frame reports the
/// uncached part apart, as the providers bill it.
fn usage_frame(u: &rig::completion::Usage) -> serde_json::Value {
    let read = u.cached_input_tokens.unwrap_or_default();
    let write = u.cache_creation_input_tokens.unwrap_or_default();
    serde_json::json!({
        "input": u.input_tokens.unwrap_or_default().saturating_sub(read + write),
        "output": u.output_tokens.unwrap_or_default(),
        "cacheRead": read,
        "cacheWrite": write,
    })
}

/// Pass `chunk` through the guard and re-hydrate what passed for the user.
fn shown_text(
    guard: &Mutex<AnswerGuard>,
    session: &redaction::Session,
    shown: &mut StreamRehydrator,
    answer: &mut String,
    chunk: &str,
) -> String {
    let passed = guard
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .push(chunk);
    answer.push_str(&passed);
    // Read back through the map; anything the map did not know stays hidden.
    session.lock().map_or_else(
        |_| String::new(),
        |r| resolve_or_hide(&shown.push(&passed, r.map())),
    )
}

pub(super) type Frames = Vec<Result<Event, std::convert::Infallible>>;

/// The turn's output as it streams: guarded, re-hydrated text, tool chips,
/// widgets, and what is stored once the run ends.
pub(super) struct Emitter {
    guard: Arc<Mutex<AnswerGuard>>,
    session: redaction::Session,
    widgets: show::Widgets,
    message_id: String,
    /// What the model wrote that the guard passed, in placeholders (stored).
    answer: String,
    shown: StreamRehydrator,
    usage: Option<serde_json::Value>,
    text_open: bool,
    failed: bool,
    /// What is stored with the answer besides its text.
    kept: Kept,
}

impl Emitter {
    pub(super) fn new(
        guard: Arc<Mutex<AnswerGuard>>,
        session: redaction::Session,
        widgets: show::Widgets,
    ) -> Self {
        Self {
            guard,
            session,
            widgets,
            message_id: Uuid::new_v4().to_string(),
            answer: String::new(),
            shown: StreamRehydrator::default(),
            usage: None,
            text_open: false,
            failed: false,
            kept: Kept::default(),
        }
    }

    /// The answer the guard passed, in placeholders (what is stored).
    pub(super) fn answer(&self) -> &str {
        &self.answer
    }

    pub(super) const fn session(&self) -> &redaction::Session {
        &self.session
    }

    pub(super) const fn usage(&self) -> Option<&serde_json::Value> {
        self.usage.as_ref()
    }

    /// A cited source, kept with the answer.
    pub(super) fn source(&mut self, source: serde_json::Value) {
        self.kept.sources.push(source);
    }

    /// Everything kept with the answer besides its text, for `ai_messages.parts`.
    pub(super) fn parts(&self, elapsed_ms: u128, model: &str) -> serde_json::Value {
        self.kept.to_json(self.usage.as_ref(), elapsed_ms, model)
    }

    /// The provider failed: the run ends with `RUN_ERROR`.
    pub(super) const fn failed(&self) -> bool {
        self.failed
    }

    /// `text` (already guarded and re-hydrated) as AG-UI text events.
    fn text(&mut self, text: &str) -> Frames {
        let mut out = Frames::new();
        if text.is_empty() {
            return out;
        }
        if !self.text_open {
            self.text_open = true;
            out.push(ag(&Agui::TextMessageStart {
                message_id: &self.message_id,
                role: "assistant",
            }));
        }
        out.push(ag(&Agui::TextMessageContent {
            message_id: &self.message_id,
            delta: text,
        }));
        out
    }

    /// The frames for one item of rig's stream.
    pub(super) fn item<E: std::fmt::Display>(
        &mut self,
        item: Result<MultiTurnStreamItem, E>,
    ) -> Frames {
        match item {
            Ok(MultiTurnStreamItem::StreamAssistantItem(Item::Event(StreamEvent::Text {
                text,
                ..
            }))) => {
                // Only sentences the guard passes are stored or shown.
                let text = shown_text(
                    &self.guard,
                    &self.session,
                    &mut self.shown,
                    &mut self.answer,
                    &text,
                );
                self.text(&text)
            }
            Ok(MultiTurnStreamItem::ToolCall { tool_call }) => {
                tool_call_events(&self.session, &tool_call, &self.message_id).into()
            }
            Ok(MultiTurnStreamItem::ToolResult { tool_result }) => {
                self.kept.step(&tool_result);
                let mut out = vec![tool_result_event(
                    &self.guard,
                    &self.session,
                    &tool_result,
                    &self.message_id,
                )];
                // Built from the shelf by `show`, never from the model's words.
                for (source, widget) in show::drain(&self.widgets) {
                    let value = serde_json::to_value(&widget).unwrap_or_default();
                    self.kept.widget(&source, &value);
                    out.push(ag(&Agui::Custom {
                        name: CUSTOM_WIDGET,
                        value,
                    }));
                }
                out
            }
            Ok(MultiTurnStreamItem::ModelTurnRetried { .. }) => {
                // The attempt the guard rejected: the screen drops it, and the
                // guard judges the next attempt afresh.
                self.guard
                    .lock()
                    .unwrap_or_else(PoisonError::into_inner)
                    .restart();
                self.answer.clear();
                self.shown = StreamRehydrator::default();
                self.kept.retried = true;
                vec![ag(&Agui::Custom {
                    name: CUSTOM_RESET,
                    value: serde_json::Value::Null,
                })]
            }
            Ok(MultiTurnStreamItem::FinalResponse(r)) => {
                self.usage = Some(usage_frame(&r.usage));
                Frames::new()
            }
            Ok(_) => Frames::new(),
            Err(e) => {
                // The provider's error text is not shown: it can echo input.
                // RUN_ERROR is terminal, so the turn stops here.
                tracing::warn!(target: "ai", error = %e, "assistant stream error");
                self.failed = true;
                Frames::new()
            }
        }
    }

    /// What the guard still held, the end of the text, and its notice —
    /// said, never silent, before the run ends.
    pub(super) fn finish(&mut self) -> Frames {
        let (passed, notices) = {
            let mut g = self.guard.lock().unwrap_or_else(PoisonError::into_inner);
            (g.finish(), g.notices())
        };
        self.answer.push_str(&passed);
        let rest = self.session.lock().map_or_else(
            |_| String::new(),
            |r| {
                resolve_or_hide(&format!(
                    "{}{}",
                    self.shown.push(&passed, r.map()),
                    self.shown.finish(r.map())
                ))
            },
        );
        let mut out = self.text(&rest);
        if self.text_open {
            out.push(ag(&Agui::TextMessageEnd {
                message_id: &self.message_id,
            }));
        }
        self.kept.notices = notices.iter().map(|n| (*n).to_owned()).collect();
        if !notices.is_empty() {
            tracing::info!(target: "ai", removed = notices.len(), "answer guard removed text");
            out.push(ag(&Agui::Custom {
                name: CUSTOM_GUARD,
                value: serde_json::json!({ "notices": notices }),
            }));
        }
        out
    }
}

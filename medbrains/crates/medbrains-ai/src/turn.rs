//! One assistant turn: build the agent through the model gateway, stream the
//! answer through the answer guard, persist it.
//!
//! The model sees only redacted text; the user sees the answer re-hydrated on
//! the server; the stored answer stays redacted. A tool-free answer the guard
//! would cut is retried once ([`GuardRetry`]); the user's screen is told to
//! drop what it showed of the rejected attempt.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(clippy::redundant_pub_crate, reason = "unreachable_pub is denied workspace-wide")]

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, PoisonError};

use axum::response::sse::Event;
use futures::StreamExt as _;
use medbrains_core::ai_guard::{AnswerGuard, MAX_ANSWER_TOKENS};
use medbrains_core::ai_redact::{PLACEHOLDER_NOTE, Redacted, StreamRehydrator};
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::{error::AppError, state::AppState};
use rig_agent::agent::{AgentHook, HookContext, ModelTurnAction, ModelTurnFinished, MultiTurnStreamItem};
use rig::message::{AssistantContent, ToolCall, ToolResult, ToolResultContent};
use rig::streaming::{Item, StreamEvent};
use uuid::Uuid;

use super::{
    AiConfig, CallApiTool, DraftPrescriptionTool, DrugSafetyTool, KbHit, ListApisTool,
    PatientOverviewTool, RequestPatientTool, SYSTEM_PROMPT, SseBody, redaction, show, sse,
    store_turn,
};

/// Model calls one turn may make: the first, tool continuations (the old
/// `multi_turn(8)`), and the one guard retry.
const MAX_MODEL_CALLS: usize = 10;

/// What the turn's tools act with: the redaction session, the caller (with
/// the AI actor set) and the patient the turn is grounded on.
pub(super) struct ToolDeps {
    pub(super) session: redaction::Session,
    pub(super) state: AppState,
    pub(super) claims: Claims,
    pub(super) grounded_patient: Option<Uuid>,
    pub(super) agent_json: serde_json::Value,
}

/// One assistant turn's inputs, already redacted.
pub(super) struct Turn {
    /// Checks the answer, sentence by sentence; shared with [`GuardRetry`].
    pub(super) guard: Arc<Mutex<AnswerGuard>>,
    /// The redacted page context: what the answer may restate.
    pub(super) context: String,
    /// The turn's context block (if any), then the user's message.
    pub(super) prompt: Redacted,
    pub(super) history: Vec<rig::message::Message>,
    pub(super) state: AppState,
    pub(super) tenant_id: Uuid,
    pub(super) conversation_id: Uuid,
    pub(super) kb_hits: Vec<KbHit>,
    pub(super) session: redaction::Session,
}

/// Build the assistant on the gateway's model for `cfg` and stream `turn`.
/// The system prompt is fixed bytes for every turn and tenant — tools + it
/// are the cached prefix.
pub(super) fn stream_answer(
    cfg: &AiConfig,
    deps: &ToolDeps,
    turn: Turn,
) -> Result<SseBody, AppError> {
    let preamble = Redacted::fixed(SYSTEM_PROMPT).join("\n\n", &Redacted::fixed(PLACEHOLDER_NOTE));
    let shelf = show::Shelf::default();
    let widgets = show::Widgets::default();
    let agent = rig_agent::AgentBuilder::new(medbrains_server_services::llm::completion_model(cfg)?)
        .preamble(preamble.for_model())
        .max_tokens(u64::from(MAX_ANSWER_TOKENS))
        .default_max_turns(MAX_MODEL_CALLS)
        .add_hook(GuardRetry {
            guard: Arc::clone(&turn.guard),
            retried: AtomicBool::new(false),
        })
        .tool(DrugSafetyTool {
            session: Arc::clone(&deps.session),
            db: deps.state.db.clone(),
            tenant_id: deps.claims.tenant_id,
            department_ids: deps.claims.department_ids.clone(),
            patient_id: deps.grounded_patient,
            user_id: deps.claims.sub,
            agent: deps.agent_json.clone(),
        })
        .tool(DraftPrescriptionTool {
            session: Arc::clone(&deps.session),
            db: deps.state.db.clone(),
            tenant_id: deps.claims.tenant_id,
            department_ids: deps.claims.department_ids.clone(),
            patient_id: deps.grounded_patient,
            user_id: deps.claims.sub,
            agent: deps.agent_json.clone(),
        })
        .tool(PatientOverviewTool {
            session: Arc::clone(&deps.session),
            state: deps.state.clone(),
            claims: deps.claims.clone(),
            shelf: Arc::clone(&shelf),
        })
        .tool(CallApiTool {
            session: Arc::clone(&deps.session),
            state: deps.state.clone(),
            claims: deps.claims.clone(),
            shelf: Arc::clone(&shelf),
        })
        .tool(RequestPatientTool)
        .tool(ListApisTool {
            session: Arc::clone(&deps.session),
        })
        .tool(show::ShowTool {
            session: Arc::clone(&deps.session),
            shelf,
            widgets: Arc::clone(&widgets),
        })
        .build();
    Ok(Box::pin(run_turn(agent, turn, widgets)))
}

/// Retries a finished, tool-free answer once when the guard would cut any
/// of it: a second sample often says the same thing without the clinical
/// suggestion or unsupported figure, so less is removed from what the user
/// sees. Never a second retry; never a turn that called a tool.
struct GuardRetry {
    guard: Arc<Mutex<AnswerGuard>>,
    retried: AtomicBool,
}

impl GuardRetry {
    fn decide(&self, content: &[AssistantContent]) -> ModelTurnAction {
        let text: String = content
            .iter()
            .filter_map(|c| match c {
                AssistantContent::Text(t) => Some(t.text.as_str()),
                _ => None,
            })
            .collect();
        let calls_tool = content
            .iter()
            .any(|c| matches!(c, AssistantContent::ToolCall(_)));
        if text.is_empty() || calls_tool || self.retried.load(Ordering::Relaxed) {
            return ModelTurnAction::continue_run();
        }
        // A poisoned guard still holds its records; it is read, not trusted blind.
        let would_cut = self
            .guard
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .would_remove(&text);
        if would_cut {
            self.retried.store(true, Ordering::Relaxed);
            ModelTurnAction::repeat()
        } else {
            ModelTurnAction::continue_run()
        }
    }
}

impl AgentHook for GuardRetry {
    fn on_model_turn_finished(
        &self,
        _ctx: &HookContext,
        event: ModelTurnFinished<'_>,
    ) -> impl Future<Output = ModelTurnAction> + Send {
        std::future::ready(self.decide(event.content))
    }
}

/// The chip for a tool the assistant is running, its arguments read back
/// for the user.
fn tool_call_frame(
    session: &redaction::Session,
    tool_call: &ToolCall,
) -> Result<Event, std::convert::Infallible> {
    let raw = serde_json::Value::Object(tool_call.function.arguments.clone()).to_string();
    let args = redaction::for_user(session, &raw);
    sse(&serde_json::json!({
        "type": "tool",
        "toolCall": {
            "id": tool_call.id.to_string(),
            "name": tool_call.function.name,
            "args": serde_json::from_str::<serde_json::Value>(&args)
                .unwrap_or(serde_json::Value::String(args)),
            "status": "running"
        }
    }))
}

/// A tool's (redacted) output: a record the guard may let the answer restate,
/// and read back for the user's chip.
fn tool_result_frame(
    guard: &Mutex<AnswerGuard>,
    session: &redaction::Session,
    tool_result: &ToolResult,
) -> Result<Event, std::convert::Infallible> {
    let text = tool_result.content.iter().find_map(|c| match c {
        ToolResultContent::Text(t) => Some(t.text.clone()),
        _ => None,
    });
    let result: Option<serde_json::Value> = text.map(|t| {
        guard
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .add_record(&t);
        let t = redaction::for_user(session, &t);
        serde_json::from_str(&t).unwrap_or(serde_json::Value::String(t))
    });
    let id = tool_result.call.to_string();
    sse(&serde_json::json!({ "type": "tool_result", "id": id, "result": result }))
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
    session
        .lock()
        .map_or_else(|_| String::new(), |r| shown.push(&passed, r.map()))
}

/// Stream one assistant turn and persist the result.
fn run_turn(
    agent: rig_agent::Agent,
    turn: Turn,
    widgets: show::Widgets,
) -> impl futures::Stream<Item = Result<Event, std::convert::Infallible>> {
    let Turn {
        guard,
        context,
        prompt,
        history,
        state,
        tenant_id,
        conversation_id,
        kb_hits,
        session,
    } = turn;
    guard
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .add_record(&context);
    async_stream::stream! {
        // Emit the retrieved KB entries as grounding sources (cited in the UI).
        for (i, hit) in kb_hits.iter().enumerate() {
            yield sse(&serde_json::json!({
                "type": "source",
                "source": {
                    "id": format!("kb-{i}"),
                    "title": hit.term,
                    "url": hit.source_url,
                    "snippet": hit.snippet,
                }
            }));
        }

        let mut answer = String::new();
        let mut usage = None;
        let mut shown = StreamRehydrator::default();
        let mut chunks = agent
            .prompt(prompt.for_model())
            .history(history)
            .max_turns(MAX_MODEL_CALLS)
            .stream();
        while let Some(item) = chunks.next().await {
            match item {
                Ok(MultiTurnStreamItem::StreamAssistantItem(Item::Event(StreamEvent::Text {
                    text, ..
                }))) => {
                    // Only sentences the guard passes are stored or shown.
                    let text = shown_text(&guard, &session, &mut shown, &mut answer, &text);
                    if !text.is_empty() {
                        yield sse(&serde_json::json!({ "type": "text", "text": text }));
                    }
                }
                Ok(MultiTurnStreamItem::ToolCall { tool_call }) => {
                    yield tool_call_frame(&session, &tool_call);
                }
                Ok(MultiTurnStreamItem::ToolResult { tool_result }) => {
                    yield tool_result_frame(&guard, &session, &tool_result);
                    // Built from the shelf by `show`, never from the model's words.
                    for widget in show::drain(&widgets) {
                        yield sse(&serde_json::json!({ "type": "widget", "widget": widget }));
                    }
                }
                Ok(MultiTurnStreamItem::ModelTurnRetried { .. }) => {
                    // The attempt the guard rejected: the screen drops it, and
                    // the guard judges the next attempt afresh.
                    guard.lock().unwrap_or_else(PoisonError::into_inner).restart();
                    answer.clear();
                    shown = StreamRehydrator::default();
                    yield sse(&serde_json::json!({ "type": "reset" }));
                }
                Ok(MultiTurnStreamItem::FinalResponse(r)) => usage = Some(usage_frame(&r.usage)),
                Ok(_) => {}
                Err(e) => {
                    // The provider's error text is not shown: it can echo input.
                    tracing::warn!(target: "ai", error = %e, "assistant stream error");
                    yield sse(&serde_json::json!({
                        "type": "error",
                        "message": "The AI could not finish this answer. Try again."
                    }));
                }
            }
        }
        let (passed, notices) = {
            let mut g = guard.lock().unwrap_or_else(PoisonError::into_inner);
            (g.finish(), g.notices())
        };
        answer.push_str(&passed);
        let rest = session.lock().map_or_else(
            |_| String::new(),
            |r| format!("{}{}", shown.push(&passed, r.map()), shown.finish(r.map())),
        );
        if !rest.is_empty() {
            yield sse(&serde_json::json!({ "type": "text", "text": rest }));
        }
        // Said, never silent: what the guard removed and why.
        if !notices.is_empty() {
            tracing::info!(target: "ai", removed = notices.len(), "answer guard removed text");
            yield sse(&serde_json::json!({ "type": "guard", "notices": notices }));
        }

        // Stored as the model wrote it — in placeholders — with the map.
        if let Err(e) =
            store_turn(&state, tenant_id, conversation_id, "assistant", &answer, &session).await
        {
            tracing::error!(error = %e, "failed to persist assistant turn");
        }

        yield sse(&serde_json::json!({
            "type": "done",
            "conversationId": conversation_id,
            "usage": usage,
        }));
    }
}

#[cfg(test)]
mod tests {
    use super::{AnswerGuard, GuardRetry};
    use rig_agent::agent::ModelTurnAction;
    use rig::message::{AssistantContent, Text};
    use std::sync::atomic::AtomicBool;
    use std::sync::{Arc, Mutex};

    fn retry() -> GuardRetry {
        let mut g = AnswerGuard::new("What does she have?");
        g.add_record("Hb 8.2 g/dL (L)");
        GuardRetry {
            guard: Arc::new(Mutex::new(g)),
            retried: AtomicBool::new(false),
        }
    }

    fn said(text: &str) -> Vec<AssistantContent> {
        vec![AssistantContent::Text(Text::from(text))]
    }

    #[test]
    fn an_answer_the_guard_would_cut_is_retried_once_only() {
        let hook = retry();
        let cut = said("This is consistent with iron-deficiency anaemia.");
        assert!(matches!(hook.decide(&cut), ModelTurnAction::Retry(_)));
        assert!(matches!(hook.decide(&cut), ModelTurnAction::Continue));
    }

    #[test]
    fn a_clean_answer_is_not_retried() {
        let hook = retry();
        assert!(matches!(
            hook.decide(&said("Hb 8.2 g/dL is recorded, flagged low.")),
            ModelTurnAction::Continue
        ));
    }
}

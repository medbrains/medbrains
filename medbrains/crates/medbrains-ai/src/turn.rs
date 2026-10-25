//! One assistant turn: build the agent through the model gateway, stream the
//! answer through the answer guard, persist it.
//!
//! The model sees only redacted text; the user sees the answer re-hydrated on
//! the server; the stored answer stays redacted. A tool-free answer the guard
//! would cut is retried once ([`GuardRetry`]); the user's screen is told to
//! drop what it showed of the rejected attempt.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, PoisonError};

use axum::response::sse::Event;
use futures::StreamExt as _;
use medbrains_core::ai_guard::{AnswerGuard, MAX_ANSWER_TOKENS};
use medbrains_core::ai_redact::{PLACEHOLDER_NOTE, Redacted};
use medbrains_core::permissions;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::{error::AppError, state::AppState};
use rig::message::AssistantContent;
use rig_agent::agent::{AgentHook, HookContext, ModelTurnAction, ModelTurnFinished};
use uuid::Uuid;

use super::agui::{Agui, CUSTOM_SOURCE};
use super::emit::{Emitter, ag};
use super::{
    AiConfig, CallApiTool, DraftPrescriptionTool, DrugSafetyTool, KbHit, ListApisTool,
    PatientOverviewTool, RequestPatientTool, SYSTEM_PROMPT, SseBody, aggregate_tool, query,
    redaction, show, store_turn,
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
    /// The AI actor's run (the audit trail's id): AG-UI's `runId`.
    pub(super) run_id: Uuid,
    /// The model answering, kept with the answer.
    pub(super) model: String,
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
    let agent =
        rig_agent::AgentBuilder::new(medbrains_server_services::llm::completion_model(cfg)?)
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
            .tool(aggregate_tool::AggregateTool {
                session: Arc::clone(&deps.session),
                state: deps.state.clone(),
                claims: deps.claims.clone(),
                shelf: Arc::clone(&shelf),
            })
            .tool(show::ShowTool {
                session: Arc::clone(&deps.session),
                shelf: Arc::clone(&shelf),
                widgets: Arc::clone(&widgets),
            });
    // Only holders see the tool at all: the model never plans around a query
    // it would be refused.
    let agent = if require_permission(&deps.claims, permissions::ai::assistant::QUERY).is_ok() {
        agent.tool(query::QueryTool {
            session: Arc::clone(&deps.session),
            state: deps.state.clone(),
            claims: deps.claims.clone(),
            shelf,
            attempts: std::sync::atomic::AtomicU8::new(0),
        })
    } else {
        agent
    }
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
        run_id,
        model,
        kb_hits,
        session,
    } = turn;
    guard
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .add_record(&context);
    let (thread, run) = (conversation_id.to_string(), run_id.to_string());
    let mut emit = Emitter::new(guard, session, widgets);
    let started = std::time::Instant::now();
    async_stream::stream! {
        yield ag(&Agui::RunStarted { thread_id: thread.clone(), run_id: run.clone() });
        // The retrieved KB entries, as grounding sources (cited in the UI).
        for (i, hit) in kb_hits.iter().enumerate() {
            let value = serde_json::json!({
                "id": format!("kb-{i}"),
                "title": hit.term,
                "url": hit.source_url,
                "snippet": hit.snippet,
            });
            emit.source(value.clone());
            yield ag(&Agui::Custom { name: CUSTOM_SOURCE, value });
        }
        let mut chunks = agent
            .prompt(prompt.for_model())
            .history(history)
            .max_turns(MAX_MODEL_CALLS)
            .stream();
        while let Some(item) = chunks.next().await {
            for frame in emit.item(item) {
                yield frame;
            }
            if emit.failed() {
                break;
            }
        }
        for frame in emit.finish() {
            yield frame;
        }
        // Stored as the model wrote it — in placeholders — with the map.
        if let Err(e) =
            store_turn(&state, tenant_id, conversation_id, "assistant", emit.answer(), emit.session(),
                Some(&emit.parts(started.elapsed().as_millis(), &model)),).await
        {
            tracing::error!(error = %e, "failed to persist assistant turn");
        }
        if emit.failed() {
            yield ag(&Agui::RunError {
                message: "The AI could not finish this answer. Try again.",
            });
        } else {
            yield ag(&Agui::RunFinished {
                thread_id: thread,
                run_id: run,
                result: serde_json::json!({ "usage": emit.usage() }),
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{AnswerGuard, GuardRetry};
    use rig::message::{AssistantContent, Text};
    use rig_agent::agent::ModelTurnAction;
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

//! The bricks' typed actions as the assistant's tools (`docs/architecture/ACTIONS.md`).
//!
//! One tool per registered action: its name is the action id with `_` for `.`, its
//! description the action's reviewed summary, its parameters the action's input schema.
//! A call runs through the kernel broker as `Invoker::Assistant` for the signed-in person,
//! so the broker, never the model, decides access. A refusal reaches the user as what it
//! is: could not check, not allowed, or needs your confirmation.

// `pub` here would trip the workspace's denied `unreachable_pub`; `pub(super)`
// is the narrowest visibility the parent module can use.
#![expect(
    clippy::redundant_pub_crate,
    reason = "unreachable_pub is denied workspace-wide"
)]

use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, OnceLock};

use medbrains_health_services::actions::ACTIONS;
use medbrains_kernel::Actor;
use medbrains_kernel::action::{ActionDef, ActionError, Invoker, Refusal};
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::{error::AppError, state::AppState};
use rig::message::ToolName;
use rig::tool::{DynamicTool, ToolOutput};
use serde_json::{Value, json};

use super::{UNKNOWN_FOR_MODEL, redaction, show};

/// What running one action comes to.
pub type ActionFuture = Pin<Box<dyn Future<Output = Result<Value, ActionError<AppError>>> + Send>>;

/// Runs an action by id: `medbrains_server::actions::run_action`, which sits above
/// this crate, so `main` hands it down here (as it does the router for `call_api`).
pub type ActionRunner = fn(AppState, Claims, Invoker, &'static str, Value) -> ActionFuture;

/// Set once by `main`. Unset, every action answers "could not check", never "no".
pub static ACTION_RUNNER: OnceLock<ActionRunner> = OnceLock::new();

/// The catalogue endpoints an action replaces, and the tool to use instead. With typed
/// actions on, `call_api` and `list_apis` no longer reach them.
// ponytail: only the endpoints the three actions cover; the rest of the registration and
// OPD reads stay in the catalogue until their own actions exist.
const REPLACED: &[(&str, &str)] = &[
    ("/api/patients", "patients_find"),
    ("/api/patients/{id}", "patients_summary"),
    ("/api/opd/queue", "opd_queue_today"),
];

/// The tool name for `def`: provider tool names allow no `.`.
pub(super) fn tool_name(def: &ActionDef) -> String {
    def.id.replace('.', "_")
}

/// The action tool that replaces `path` (concrete, or a catalogue template), if any.
pub(super) fn replaced_by(path: &str) -> Option<&'static str> {
    let path = path
        .split('?')
        .next()
        .unwrap_or_default()
        .trim_end_matches('/');
    REPLACED
        .iter()
        .find(|(template, _)| same_route(template, path))
        .map(|(_, tool)| *tool)
}

/// Whether `path` is the route `template`, a `{…}` segment matching any one segment.
fn same_route(template: &str, path: &str) -> bool {
    let (t, p): (Vec<&str>, Vec<&str>) = (template.split('/').collect(), path.split('/').collect());
    t.len() == p.len()
        && t.iter()
            .zip(&p)
            .all(|(t, p)| t == p || (t.starts_with('{') && !p.is_empty()))
}

/// What the user and the model are told for a refusal. `Unknown` is never a no.
pub(super) fn refusal_reply(refusal: Refusal) -> Value {
    let (kind, message) = match refusal {
        Refusal::Unknown => (
            "unknown",
            "I couldn't check that right now. Try again shortly.",
        ),
        Refusal::ModuleOff | Refusal::Denied => ("not_allowed", "You're not allowed to see this."),
        Refusal::NeedsConfirmation(_) => ("needs_confirmation", "This needs your confirmation."),
    };
    json!({ "refused": kind, "message": message })
}

/// What the model is told when the action ran and failed.
fn failure_reply(err: &AppError) -> Value {
    match err {
        AppError::NotFound | AppError::Forbidden | AppError::ForbiddenReason(_) => json!({
            "refused": "not_allowed",
            "message": "Not available to you (no permission, or no such record).",
        }),
        AppError::BadRequest(why) => json!({ "error": format!("Wrong input: {why}") }),
        other => {
            tracing::warn!(error = %other, "assistant action failed");
            json!({ "refused": "unknown", "message": UNKNOWN_FOR_MODEL })
        }
    }
}

/// What one turn's action tools act with.
#[derive(Clone)]
pub(super) struct ActionDeps {
    pub(super) session: redaction::Session,
    pub(super) state: AppState,
    /// The person's claims, with `act` naming this assistant run.
    pub(super) claims: Claims,
    pub(super) shelf: show::Shelf,
}

/// Every registered action as a tool for this turn.
pub(super) fn action_tools(deps: &ActionDeps) -> Vec<DynamicTool> {
    ACTIONS
        .iter()
        .filter_map(|def| action_tool(def, deps.clone()))
        .collect()
}

/// `def` as a tool; `None` (logged) if its declaration cannot make one.
fn action_tool(def: &'static ActionDef, deps: ActionDeps) -> Option<DynamicTool> {
    let schema = serde_json::from_str::<Value>(def.input);
    let (Ok(name), Ok(schema)) = (ToolName::new(tool_name(def)), schema) else {
        tracing::error!(
            action = def.id,
            "action has no usable tool name or input schema"
        );
        return None;
    };
    let deps = Arc::new(deps);
    Some(DynamicTool::new(name, def.summary, schema, move |input| {
        let deps = Arc::clone(&deps);
        Box::pin(async move { Ok(ToolOutput::text(run(&deps, def, input).await)) })
    }))
}

/// Run `def` for the person behind the claims and phrase the outcome for the model.
async fn run(deps: &ActionDeps, def: &'static ActionDef, input: Value) -> String {
    let Some(runner) = ACTION_RUNNER.get() else {
        tracing::error!("assistant action runner not set");
        return reply(deps, &refusal_reply(Refusal::Unknown));
    };
    let invoker = Invoker::Assistant {
        on_behalf_of: Actor::from_claims(&deps.claims),
    };
    let ran = runner(
        deps.state.clone(),
        deps.claims.clone(),
        invoker,
        def.id,
        input,
    )
    .await;
    match ran {
        Ok(out) => {
            show::shelve(&deps.shelf, &deps.session, &tool_name(def), &out);
            let compact = medbrains_core::ai_widgets::compact_for_model(&out);
            reply(deps, &json!({ "ok": compact }))
        }
        Err(ActionError::Refused(refusal)) => reply(deps, &refusal_reply(refusal)),
        Err(ActionError::Failed(err)) => reply(deps, &failure_reply(&err)),
    }
}

/// `value` through this turn's redaction, as the model may see it.
fn reply(deps: &ActionDeps, value: &Value) -> String {
    redaction::for_model(&deps.session, &value.to_string())
        .for_model()
        .to_owned()
}

#[cfg(test)]
mod tests {
    use medbrains_kernel::action::{EffectClass, Refusal};

    use super::{refusal_reply, replaced_by};

    #[test]
    fn each_refusal_says_what_it_is() {
        let kind = |r| refusal_reply(r)["refused"].clone();
        assert_eq!(kind(Refusal::Unknown), "unknown");
        assert_eq!(kind(Refusal::Denied), "not_allowed");
        assert_eq!(kind(Refusal::ModuleOff), "not_allowed");
        let confirm = Refusal::NeedsConfirmation(EffectClass::Write);
        assert_eq!(kind(confirm), "needs_confirmation");
        let unknown = refusal_reply(Refusal::Unknown)["message"].to_string();
        assert!(unknown.contains("couldn't check") && !unknown.contains("not allowed"));
    }

    #[test]
    fn only_the_endpoints_an_action_covers_are_replaced() {
        assert_eq!(
            replaced_by("/api/patients?search=ravi"),
            Some("patients_find")
        );
        let id = "/api/patients/6f1c2a4e-0000-4000-8000-000000000001";
        assert_eq!(replaced_by(id), Some("patients_summary"));
        assert_eq!(replaced_by("/api/patients/{id}"), Some("patients_summary"));
        assert_eq!(
            replaced_by("/api/opd/queue?department_id=x"),
            Some("opd_queue_today")
        );
        assert_eq!(replaced_by("/api/patients/{patient_id}/allergies"), None);
        assert_eq!(replaced_by("/api/opd/queue/wait-estimate"), None);
        assert_eq!(replaced_by("/api/lab/orders"), None);
    }
}

//! Runs a typed action by id (`docs/architecture/ACTIONS.md`): the one entry
//! point the assistant calls (`run_action_owned`), and a person's surface can
//! too. No HTTP route reaches it yet.

use std::future::Future;

use medbrains_health_services::actions::find_action;
use medbrains_kernel::Outcome;
use medbrains_kernel::action::{ActionError, ActionGate, Call, Invoker, act};
use medbrains_server_core::middleware::entitlement::module_entitlement;
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;
use crate::middleware::auth::Claims;
use crate::state::AppState;

/// The module switch the broker asks: the tenant's `module_config`, cached.
struct Entitlements<'a>(&'a PgPool);

impl ActionGate for Entitlements<'_> {
    /// Whether `module` is on, `Unknown` when `module_config` could not be read.
    fn module(&self, tenant_id: Uuid, module: &str) -> impl Future<Output = Outcome> + Send {
        module_entitlement(self.0, tenant_id, module)
    }
}

/// `patients.find` input.
#[derive(serde::Deserialize)]
struct FindInput {
    query: String,
}

/// `patients.summary` input.
#[derive(serde::Deserialize)]
struct SummaryInput {
    patient_id: Uuid,
}

/// `opd.queue.today` input.
#[derive(serde::Deserialize)]
struct QueueInput {
    department_id: Option<Uuid>,
}

/// Run action `id` for `claims` as `invoker`, from JSON input to JSON output.
///
/// # Errors
/// `Failed(NotFound)` for an id no brick publishes and `Failed(BadRequest)` for
/// input of the wrong shape, both before any check; otherwise as `act`.
pub async fn run_action(
    state: &AppState,
    claims: &Claims,
    invoker: Invoker,
    id: &str,
    input: Value,
) -> Result<Value, ActionError<AppError>> {
    let def = find_action(id).ok_or(ActionError::Failed(AppError::NotFound))?;
    let call = Call {
        pool: &state.db,
        def,
        claims,
        invoker,
    };
    let gate = Entitlements(call.pool);
    match def.id {
        "patients.find" => {
            let FindInput { query } = parse(input)?;
            let rows = act(&gate, call, async |tx| {
                medbrains_patients::actions::find(tx, state, claims, &query).await
            });
            reply(rows.await?)
        }
        "patients.summary" => {
            let SummaryInput { patient_id } = parse(input)?;
            let one = act(&gate, call, async |tx| {
                medbrains_patients::actions::summary(tx, state, claims, patient_id).await
            });
            reply(one.await?)
        }
        "opd.queue.today" => {
            let QueueInput { department_id } = parse(input)?;
            let params = medbrains_opd::ListQueueQuery {
                department_id,
                ..Default::default()
            };
            let rows = act(&gate, call, async |tx| {
                medbrains_opd::queue_rows(tx, claims, &params).await
            });
            reply(rows.await?)
        }
        _ => Err(ActionError::Failed(AppError::NotFound)),
    }
}

/// [`run_action`] over owned arguments, as the assistant's tools call it
/// (`medbrains_ai::ACTION_RUNNER`, set in `main`).
pub fn run_action_owned(
    state: AppState,
    claims: Claims,
    invoker: Invoker,
    id: &'static str,
    input: Value,
) -> medbrains_ai::ActionFuture {
    Box::pin(async move { run_action(&state, &claims, invoker, id, input).await })
}

/// Read an action's input, refusing a malformed one as a bad request.
fn parse<T: DeserializeOwned>(input: Value) -> Result<T, ActionError<AppError>> {
    serde_json::from_value(input)
        .map_err(|err| ActionError::Failed(AppError::BadRequest(format!("action input: {err}"))))
}

/// An action's output as JSON.
fn reply<T: Serialize>(output: T) -> Result<Value, ActionError<AppError>> {
    serde_json::to_value(output)
        .map_err(|err| ActionError::Failed(AppError::Internal(format!("action output: {err}"))))
}

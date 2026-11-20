//! Actions: a typed operation a brick publishes, and the one broker that runs it.
//!
//! RFC-AI-NATIVE-OS §7.2 and §7.4. A brick declares each operation once, as an
//! [`ActionDef`]. [`act`] runs it for a person, or for the assistant acting for
//! one, with the same checks in the same order every time:
//!
//! 1. the module is on for the tenant ([`ActionGate::module`]), else refused;
//! 2. the effect is one the invoker may cause unconfirmed: the assistant only
//!    [`EffectClass::Read`] and [`EffectClass::Draft`] for now;
//! 3. the permission ([`ActionGate::permission`]): allow, deny or unknown, and
//!    unknown never runs;
//! 4. the handler, inside one unit of work ([`work`]);
//! 5. one audit row per decision, allowed or not.
//!
//! The kernel names no module. A module is an opaque string and the layer
//! above answers whether it is on, so the registry of actions lives there too.

use std::future::Future;

pub use medbrains_authz::classification::DataClass;
use serde::Serialize;
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

use crate::audit::AuditEntry;
use crate::authz::permission_outcome;
use crate::{Actor, Claims, KernelError, Outcome, Tx, audit, work};

/// What running an action can change. The class, never the call site, decides
/// whether the assistant may run it without a person confirming.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EffectClass {
    /// Reads within the caller's access; changes nothing.
    Read,
    /// Prepares something a person accepts item by item.
    Draft,
    /// Changes a record.
    Write,
    /// Moves money.
    Money,
    /// Changes someone's treatment. Never an assistant action, only a draft a
    /// licensed professional signs (RFC-AI-NATIVE-OS §7.2).
    Critical,
    /// Drives hardware: a printer, an analyser.
    Device,
    /// Sends data out of the box.
    Egress,
}

/// Who asked for the action.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Invoker {
    /// The signed-in person, directly.
    Person,
    /// The assistant, always for a person: it holds no authority of its own.
    Assistant { on_behalf_of: Actor },
}

/// One action, declared once by the brick that owns it.
#[derive(Debug, Clone, Copy)]
pub struct ActionDef {
    /// Stable id: what audit rows and, later, the assistant call it by.
    pub id: &'static str,
    /// The owning brick's module code. Opaque here; the gate says if it is on.
    pub module: &'static str,
    pub effect: EffectClass,
    /// The permission code the caller must hold.
    pub permission: &'static str,
    /// The classes of data it returns, so a model router can keep them local.
    pub data_classes: &'static [DataClass],
    /// One reviewed sentence; never generated text. The assistant's tool description.
    pub summary: &'static str,
    /// The JSON Schema of the input object: the assistant's tool parameters.
    pub input: &'static str,
}

/// Why the broker refused. Every refusal is decided before the handler runs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum Refusal {
    #[error("this module is switched off")]
    ModuleOff,
    /// A later PR adds the confirmation flow; until then the answer is no.
    #[error("a person must confirm this")]
    NeedsConfirmation(EffectClass),
    #[error("not allowed")]
    Denied,
    /// A check could not be answered: retryable, never reported as a no.
    #[error("could not check")]
    Unknown,
}

impl Refusal {
    /// The outcome recorded in the audit row.
    const fn code(self) -> &'static str {
        match self {
            Self::ModuleOff => "module_off",
            Self::NeedsConfirmation(_) => "needs_confirmation",
            Self::Denied => "deny",
            Self::Unknown => "unknown",
        }
    }
}

/// An action that did not complete: refused before it ran, or failed running.
#[derive(Debug, thiserror::Error)]
pub enum ActionError<E> {
    #[error("refused: {0}")]
    Refused(Refusal),
    #[error("{0}")]
    Failed(E),
}

/// What the broker asks of the layer above. Injected, so the kernel names no
/// module and a test can stand in for an outage.
pub trait ActionGate: Sync {
    /// Whether `module` is on for the tenant; `Unknown` when it could not be read.
    fn module(&self, tenant_id: Uuid, module: &str) -> impl Future<Output = Outcome> + Send;

    /// Whether `claims` hold `permission`; the session's resolved set by default.
    fn permission(&self, claims: &Claims, permission: &str) -> Outcome {
        permission_outcome(claims, permission)
    }
}

/// One request to run an action.
#[derive(Debug, Clone, Copy)]
pub struct Call<'a> {
    pub pool: &'a PgPool,
    pub def: &'a ActionDef,
    /// The person's claims: the assistant is checked as the person it acts for.
    pub claims: &'a Claims,
    pub invoker: Invoker,
}

/// Run `call` through every check in order (see the module docs), then
/// `handler` and its audit row in one unit of work.
///
/// # Errors
/// [`ActionError::Refused`] when a check said no or could not answer, and the
/// handler did not run; [`ActionError::Failed`] when the handler, the unit of
/// work or its audit row failed, and nothing was committed.
pub async fn act<G, O, E, F>(gate: &G, call: Call<'_>, handler: F) -> Result<O, ActionError<E>>
where
    G: ActionGate,
    E: From<KernelError>,
    F: AsyncFnOnce(&mut Tx) -> Result<O, E>,
{
    let actor = Actor::from_claims(call.claims);
    if let Some(refusal) = refusal(gate, &call, actor).await {
        record_refusal(&call, actor, refusal).await;
        return Err(ActionError::Refused(refusal));
    }
    let values = audit_values(&call, actor, "allow");
    work(call.pool, actor, async |tx| {
        let output = handler(tx).await?;
        audit(tx, &entry(&call, actor, &values)).await?;
        Ok(output)
    })
    .await
    .map_err(ActionError::Failed)
}

/// The first check that does not allow `call`, in broker order; `None` when all allow.
async fn refusal<G: ActionGate>(gate: &G, call: &Call<'_>, actor: Actor) -> Option<Refusal> {
    if let Invoker::Assistant { on_behalf_of } = call.invoker
        && on_behalf_of != actor
    {
        return Some(Refusal::Denied); // the assistant may only act for these claims' owner
    }
    match gate.module(actor.tenant_id, call.def.module).await {
        Outcome::Allow => {}
        Outcome::Deny => return Some(Refusal::ModuleOff),
        Outcome::Unknown => return Some(Refusal::Unknown),
    }
    let unconfirmed = matches!(call.def.effect, EffectClass::Read | EffectClass::Draft);
    if matches!(call.invoker, Invoker::Assistant { .. }) && !unconfirmed {
        return Some(Refusal::NeedsConfirmation(call.def.effect));
    }
    match gate.permission(call.claims, call.def.permission) {
        Outcome::Allow => None,
        Outcome::Deny => Some(Refusal::Denied),
        Outcome::Unknown => Some(Refusal::Unknown),
    }
}

/// Audit a refusal in a unit of work of its own. The refusal stands either way:
/// an audit store that cannot be written is logged, never turned into a run.
async fn record_refusal(call: &Call<'_>, actor: Actor, refusal: Refusal) {
    let values = audit_values(call, actor, refusal.code());
    let written: Result<(), KernelError> = work(call.pool, actor, async |tx| {
        audit(tx, &entry(call, actor, &values)).await
    })
    .await;
    if let Err(err) = written {
        tracing::error!(target: "audit", error = %err, action = call.def.id, outcome = refusal.code(),
            "a refused action could not be audited");
    }
}

/// The audit row's values: what ran, its effect, who asked, for whom, and the outcome.
fn audit_values(call: &Call<'_>, actor: Actor, outcome: &str) -> Value {
    let (invoker, acting_user, on_behalf_of) = match call.invoker {
        Invoker::Person => ("person", Some(actor.user_id), None),
        Invoker::Assistant { on_behalf_of } => ("assistant", None, Some(on_behalf_of.user_id)),
    };
    json!({
        "effect": call.def.effect,
        "invoker": invoker,
        "acting_user": acting_user,
        "on_behalf_of": on_behalf_of,
        "agent": call.claims.act.as_ref().map(crate::ActingAgent::to_audit_json),
        "outcome": outcome,
    })
}

/// The audit entry for `call`, attributed to the person the action ran for.
const fn entry<'a>(call: &Call<'_>, actor: Actor, values: &'a Value) -> AuditEntry<'a> {
    AuditEntry {
        tenant_id: actor.tenant_id,
        user_id: Some(actor.user_id),
        action: call.def.id,
        entity_type: "action",
        entity_id: None,
        old_values: None,
        new_values: Some(values),
        ip_address: None,
    }
}

#[cfg(test)]
mod tests {
    #![allow(clippy::expect_used, clippy::panic)]

    use std::sync::atomic::{AtomicUsize, Ordering};

    use super::{
        ActionDef, ActionError, ActionGate, Call, EffectClass, Invoker, Outcome, Refusal, act,
    };
    use crate::{Actor, Claims, KernelError};
    use uuid::Uuid;

    /// A gate whose two answers the test picks.
    struct Fake {
        module: Outcome,
        permission: Outcome,
    }

    impl ActionGate for Fake {
        async fn module(&self, _: Uuid, _: &str) -> Outcome {
            self.module
        }
        fn permission(&self, _: &Claims, _: &str) -> Outcome {
            self.permission
        }
    }

    const fn def(effect: EffectClass) -> ActionDef {
        ActionDef {
            id: "test.thing",
            module: "test",
            effect,
            permission: "test.thing.view",
            data_classes: &[],
            summary: "A thing.",
            input: r#"{"type":"object"}"#,
        }
    }

    fn claims() -> Claims {
        Claims {
            sub: Uuid::new_v4(),
            tenant_id: Uuid::new_v4(),
            role: "clerk".to_owned(),
            permissions: Vec::new(),
            department_ids: Vec::new(),
            perm_version: 0,
            paired_device_id: None,
            act: None,
            exp: 0,
        }
    }

    /// Runs `def` through the broker against a database that is not there, and
    /// counts handler calls. Refusals reach no database; their audit write fails
    /// and is logged, which is the point: the refusal still stands.
    async fn run(gate: &Fake, def: &ActionDef, invoker: Invoker) -> (Refusal, usize) {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgres://nobody@127.0.0.1:1/none")
            .expect("lazy pool");
        pool.close().await;
        let claims = claims();
        let invoker = match invoker {
            Invoker::Assistant { .. } => Invoker::Assistant {
                on_behalf_of: Actor::from_claims(&claims),
            },
            Invoker::Person => Invoker::Person,
        };
        let calls = AtomicUsize::new(0);
        let call = Call {
            pool: &pool,
            def,
            claims: &claims,
            invoker,
        };
        let result = act(gate, call, async |_| {
            calls.fetch_add(1, Ordering::SeqCst);
            Ok::<(), KernelError>(())
        })
        .await;
        let refusal = match result {
            Err(ActionError::Refused(refusal)) => refusal,
            other => panic!("expected a refusal, got {other:?}"),
        };
        (refusal, calls.load(Ordering::SeqCst))
    }

    const ALLOW: Fake = Fake {
        module: Outcome::Allow,
        permission: Outcome::Allow,
    };

    #[tokio::test]
    async fn a_switched_off_module_is_refused_before_anything_else() {
        let gate = Fake {
            module: Outcome::Deny,
            permission: Outcome::Allow,
        };
        let got = run(&gate, &def(EffectClass::Read), Invoker::Person).await;
        assert_eq!(got, (Refusal::ModuleOff, 0));
    }

    #[tokio::test]
    async fn an_unreadable_module_switch_is_unknown_not_off() {
        let gate = Fake {
            module: Outcome::Unknown,
            permission: Outcome::Allow,
        };
        let got = run(&gate, &def(EffectClass::Read), Invoker::Person).await;
        assert_eq!(got, (Refusal::Unknown, 0));
    }

    #[tokio::test]
    async fn the_assistant_needs_a_person_for_anything_past_read_and_draft() {
        let assistant = Invoker::Assistant {
            on_behalf_of: Actor::system(Uuid::nil()),
        };
        for effect in [
            EffectClass::Write,
            EffectClass::Money,
            EffectClass::Critical,
            EffectClass::Device,
            EffectClass::Egress,
        ] {
            let got = run(&ALLOW, &def(effect), assistant).await;
            assert_eq!(got, (Refusal::NeedsConfirmation(effect), 0), "{effect:?}");
        }
    }

    #[tokio::test]
    async fn the_assistant_cannot_act_for_someone_other_than_the_claims_owner() {
        let pool = sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgres://nobody@127.0.0.1:1/none")
            .expect("lazy pool");
        pool.close().await;
        let claims = claims();
        let stranger = Actor::system(claims.tenant_id);
        let invoker = Invoker::Assistant {
            on_behalf_of: stranger,
        };
        let read = def(EffectClass::Read);
        let call = Call {
            pool: &pool,
            def: &read,
            claims: &claims,
            invoker,
        };
        let result = act(&ALLOW, call, async |_| Ok::<(), KernelError>(())).await;
        assert!(matches!(result, Err(ActionError::Refused(Refusal::Denied))));
    }

    #[tokio::test]
    async fn an_unknown_permission_never_runs_and_stays_unknown() {
        let gate = Fake {
            module: Outcome::Allow,
            permission: Outcome::Unknown,
        };
        let got = run(&gate, &def(EffectClass::Read), Invoker::Person).await;
        assert_eq!(got, (Refusal::Unknown, 0));
    }

    #[tokio::test]
    async fn a_denied_permission_never_runs() {
        let gate = Fake {
            module: Outcome::Allow,
            permission: Outcome::Deny,
        };
        for invoker in [
            Invoker::Person,
            Invoker::Assistant {
                on_behalf_of: Actor::system(Uuid::nil()),
            },
        ] {
            let got = run(&gate, &def(EffectClass::Read), invoker).await;
            assert_eq!(got, (Refusal::Denied, 0));
        }
    }

    #[test]
    fn the_default_permission_check_is_three_valued() {
        let mut who = claims();
        who.permissions = vec!["test.thing.view".to_owned()];
        assert_eq!(
            super::permission_outcome(&who, "test.thing.view"),
            Outcome::Allow
        );
        assert_eq!(super::permission_outcome(&who, "test.other"), Outcome::Deny);
        who.tenant_id = Uuid::nil();
        assert_eq!(
            super::permission_outcome(&who, "test.thing.view"),
            Outcome::Unknown
        );
    }
}

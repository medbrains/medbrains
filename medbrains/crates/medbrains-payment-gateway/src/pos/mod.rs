//! Card machines at the counter (#4874): one trait every way of reaching a
//! machine implements, and the one state machine every answer goes through.
//!
//! A sale is a `payment_gateway_transactions` row with a `terminal_id`. The
//! counter starts it, a provider carries it to the machine, and whatever the
//! machine says — approved, declined, timed out, cancelled — is turned into a
//! [`Step`] by [`next_step`] and applied by [`sale::apply`]. Approval settles
//! through P0's exactly-once [`crate::settle::settle_capture`], so a second
//! answer for the same sale (a re-poll, a bridge that reports twice) posts
//! nothing more.
//!
//! Providers:
//! * [`pinelabs`] — Pine Labs Plutus Cloud (push + poll).
//! * [`ezetap`] — Razorpay POS (Ezetap push-to-pay), inferred.
//! * [`bridge`] — a machine wired to a counter PC, driven by the site bridge.
//! * [`simulator`] — a pretend machine, dev and test only.

pub mod bridge;
pub mod ezetap;
pub mod pinelabs;
pub mod sale;
pub mod simulator;
pub mod undo;
pub mod view;

use std::sync::LazyLock;
use std::time::Duration;

use async_trait::async_trait;
use axum::{Extension, Json, extract::State};
use medbrains_core::payment::PaymentTerminal;
use medbrains_core::permissions;
use medbrains_core::secrets::{SecretError, SecretResolver};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;
use serde::Serialize;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

/// How long the counter waits for the patient at the machine before the sale
/// is closed as unanswered. Pine Labs' own auto-cancel is five minutes
/// (`AutoCancelDurationInMinutes`); a minute over it lets its answer land.
pub const ANSWER_WITHIN_SECS: i64 = 6 * 60;
/// Inferred: long enough for a slow provider, short enough that the cashier
/// is not left watching a spinner.
const CALL_TIMEOUT: Duration = Duration::from_secs(15);

static HTTP: LazyLock<reqwest::Client> = LazyLock::new(reqwest::Client::new);

pub(crate) fn http() -> &'static reqwest::Client {
    &HTTP
}

/// What a provider needs to reach the machine.
pub struct Ctx<'a> {
    pub secrets: &'a dyn SecretResolver,
    pub db: &'a PgPool,
    pub tenant_id: Uuid,
    pub terminal: &'a PaymentTerminal,
}

/// A sale to run on the machine.
#[derive(Debug, Clone, Copy)]
pub struct SaleAsk {
    pub txn_id: Uuid,
    pub amount_paise: i64,
}

/// The machine approved the card.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Approval {
    /// The provider's reference for the payment; filed on the bill.
    pub reference: String,
    /// What it approved, when it says — less than asked is a partial approval.
    pub approved_paise: Option<i64>,
    pub card_last4: Option<String>,
    pub auth_code: Option<String>,
    pub payload: Value,
}

/// Where the sale stands at the machine.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SaleState {
    /// Sent; the patient has not finished (or not started) at the machine.
    Waiting,
    Approved(Approval),
    /// Declined, in the bank's or the machine's words.
    Declined(String),
    /// The machine gave up waiting for the card.
    TimedOut,
    Cancelled,
}

/// Why a provider could not do what was asked.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PosError {
    /// The machine or its cloud cannot be reached; nothing was charged.
    Offline(String),
    /// A definite no (bad credentials, unknown device, refused request).
    Refused(String),
    /// This provider cannot do it through MedBrains.
    Unsupported(&'static str),
}

impl PosError {
    pub fn words(&self) -> String {
        match self {
            Self::Offline(w) | Self::Refused(w) => w.clone(),
            Self::Unsupported(w) => (*w).to_owned(),
        }
    }
}

#[async_trait]
pub trait PosProvider: Send + Sync {
    /// Send the sale to the machine; the provider's reference for it.
    async fn start(&self, ctx: &Ctx<'_>, sale: SaleAsk) -> Result<String, PosError>;
    async fn status(&self, ctx: &Ctx<'_>, reference: &str) -> Result<SaleState, PosError>;
    async fn cancel(&self, ctx: &Ctx<'_>, reference: &str) -> Result<(), PosError>;
    /// Refund or void an approved sale; the provider's refund id.
    async fn refund(
        &self,
        _ctx: &Ctx<'_>,
        _reference: &str,
        _amount_paise: i64,
    ) -> Result<String, PosError> {
        Err(PosError::Unsupported(
            "This card machine's provider takes no refunds through MedBrains — \
             void or refund it from the machine's own menu",
        ))
    }
    /// Is the machine there?
    async fn ping(&self, ctx: &Ctx<'_>) -> Result<(), PosError>;
}

/// POS providers a terminal can name, with the connection each uses.
pub const CLOUD_PROVIDERS: &[(&str, &str)] = &[
    ("pinelabs", "Pine Labs Plutus Cloud"),
    ("razorpay_pos", "Razorpay POS (Ezetap)"),
    (simulator::PROVIDER, "Simulator (test machine)"),
];
/// Device adapters the site bridge has. Real ECR protocols per brand join
/// this list as the bridge gains them.
pub const BRIDGE_ADAPTERS: &[(&str, &str)] = &[(simulator::PROVIDER, "Simulator (test machine)")];

#[derive(Debug, Serialize)]
pub struct Choice {
    code: &'static str,
    label: &'static str,
}

#[derive(Debug, Serialize)]
pub struct TerminalProviders {
    cloud: Vec<Choice>,
    bridge_adapters: Vec<Choice>,
    simulator_enabled: bool,
}

/// `GET /api/payments/terminal-providers` — what a card machine can be
/// reached through here (the simulator only where it may run).
pub async fn list_terminal_providers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<TerminalProviders>, AppError> {
    require_permission(&claims, permissions::billing::terminals::MANAGE)?;
    let simulator_enabled = simulator::enabled(state.secret_resolver.as_ref()).await;
    let keep = |list: &[(&'static str, &'static str)]| -> Vec<Choice> {
        list.iter()
            .filter(|(code, _)| simulator_enabled || *code != simulator::PROVIDER)
            .map(|&(code, label)| Choice { code, label })
            .collect()
    };
    Ok(Json(TerminalProviders {
        cloud: keep(CLOUD_PROVIDERS),
        bridge_adapters: keep(BRIDGE_ADAPTERS),
        simulator_enabled,
    }))
}

/// The provider that reaches this terminal's machine.
pub fn provider_for(terminal: &PaymentTerminal) -> Option<Box<dyn PosProvider>> {
    if terminal.connection == "bridge" {
        return Some(Box::new(bridge::Bridge));
    }
    match terminal.provider.as_str() {
        "pinelabs" => Some(Box::new(pinelabs::PineLabs)),
        "razorpay_pos" => Some(Box::new(ezetap::Ezetap)),
        simulator::PROVIDER => Some(Box::new(simulator::Simulator)),
        _ => None,
    }
}

/// A transaction scoped to one hospital's rows, for a provider's own reads.
pub(crate) async fn scoped(
    db: &PgPool,
    tenant_id: Uuid,
) -> Result<sqlx::Transaction<'static, sqlx::Postgres>, PosError> {
    let fault = |e: String| PosError::Offline(format!("The sale could not be read: {e}"));
    let mut tx = db.begin().await.map_err(|e| fault(e.to_string()))?;
    medbrains_db::pool::set_tenant_context(&mut tx, &tenant_id)
        .await
        .map_err(|e| fault(e.to_string()))?;
    Ok(tx)
}

/// A per-hospital secret (`medbrains/{env}/{tenant}/{name}`); a missing one is
/// a refusal naming what to set, an unreadable store a fault.
pub(crate) async fn tenant_secret(
    secrets: &dyn SecretResolver,
    tenant_id: Uuid,
    name: &str,
) -> Result<String, PosError> {
    let env = std::env::var("MEDBRAINS_ENV").unwrap_or_else(|_| "dev".to_owned());
    match secrets
        .get(&format!("medbrains/{env}/{tenant_id}/{name}"))
        .await
    {
        Ok(v) if !v.is_empty() => Ok(v),
        Ok(_) | Err(SecretError::NotFound(_)) => Err(PosError::Refused(format!(
            "The card machine's provider is not set up: '{name}' is missing"
        ))),
        Err(e) => Err(PosError::Offline(format!(
            "The payment keys could not be read: {e}"
        ))),
    }
}

/// A test stand-in's base URL, when one is set (a secret, never a stray env).
pub(crate) async fn base_override(secrets: &dyn SecretResolver, key: &str) -> Option<String> {
    secrets
        .get(key)
        .await
        .ok()
        .filter(|v| !v.is_empty())
        .map(|v| v.trim_end_matches('/').to_owned())
}

/// POST JSON to a provider and read its JSON answer.
pub(crate) async fn post_json(url: &str, body: &Value) -> Result<Value, PosError> {
    let resp = http()
        .post(url)
        .timeout(CALL_TIMEOUT)
        .json(body)
        .send()
        .await
        .map_err(|e| {
            PosError::Offline(format!("The card machine's provider did not answer: {e}"))
        })?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if status.is_server_error() {
        return Err(PosError::Offline(format!("The provider answered {status}")));
    }
    if !status.is_success() {
        let short: String = text.chars().take(200).collect();
        return Err(PosError::Refused(format!(
            "The provider refused it ({status}): {short}"
        )));
    }
    serde_json::from_str(&text)
        .map_err(|e| PosError::Offline(format!("The provider's answer was unreadable: {e}")))
}

/// What to do with a sale after hearing from (or not hearing from) the machine.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Step {
    /// Still at the machine; `waiting` once the machine has it.
    Keep {
        waiting: bool,
    },
    Settle(Approval),
    Fail {
        code: &'static str,
        why: String,
    },
    Expire(String),
}

pub const NO_ANSWER: &str = "No answer from the card machine in time. Check the machine's \
                             last slip before trying again — if it shows approved, the payment \
                             will still post when the machine reports it";

/// The one state machine: an answer (or the lack of one) to a step.
/// `overdue` is whether the sale has outlived [`ANSWER_WITHIN_SECS`].
pub fn next_step(answer: Result<SaleState, PosError>, overdue: bool) -> Step {
    match answer {
        Ok(SaleState::Approved(a)) => Step::Settle(a),
        Ok(SaleState::Declined(why)) => Step::Fail {
            code: "declined",
            why,
        },
        Ok(SaleState::Cancelled) => Step::Fail {
            code: "cancelled",
            why: "Cancelled — no money was taken".to_owned(),
        },
        Ok(SaleState::TimedOut) => Step::Expire(
            "The machine timed out waiting for the card — no money was taken".to_owned(),
        ),
        Err(PosError::Refused(why)) => Step::Fail {
            code: "refused",
            why,
        },
        Ok(SaleState::Waiting) | Err(_) if overdue => Step::Expire(NO_ANSWER.to_owned()),
        Ok(SaleState::Waiting) => Step::Keep { waiting: true },
        // A blip reaching the provider: keep asking until the sale is overdue.
        Err(_) => Step::Keep { waiting: false },
    }
}

#[cfg(test)]
mod tests {
    use super::{Approval, PosError, SaleState, Step, next_step};

    fn approval() -> Approval {
        Approval {
            reference: "PTR-1".to_owned(),
            approved_paise: None,
            card_last4: Some("4242".to_owned()),
            auth_code: Some("A1".to_owned()),
            payload: serde_json::Value::Null,
        }
    }

    #[test]
    fn an_approval_settles_even_when_it_comes_late() {
        assert_eq!(
            next_step(Ok(SaleState::Approved(approval())), false),
            Step::Settle(approval())
        );
        assert_eq!(
            next_step(Ok(SaleState::Approved(approval())), true),
            Step::Settle(approval())
        );
    }

    #[test]
    fn a_decline_or_cancel_fails_with_its_reason_and_posts_nothing() {
        let declined = next_step(Ok(SaleState::Declined("Insufficient funds".into())), false);
        assert_eq!(
            declined,
            Step::Fail {
                code: "declined",
                why: "Insufficient funds".into()
            }
        );
        assert!(matches!(
            next_step(Ok(SaleState::Cancelled), false),
            Step::Fail {
                code: "cancelled",
                ..
            }
        ));
        assert!(matches!(
            next_step(Ok(SaleState::TimedOut), false),
            Step::Expire(_)
        ));
    }

    #[test]
    fn waiting_and_blips_keep_the_sale_open_until_it_is_overdue() {
        assert_eq!(
            next_step(Ok(SaleState::Waiting), false),
            Step::Keep { waiting: true }
        );
        let blip = Err(PosError::Offline("timeout".into()));
        assert_eq!(
            next_step(blip.clone(), false),
            Step::Keep { waiting: false }
        );
        assert_eq!(
            next_step(blip, true),
            Step::Expire(super::NO_ANSWER.to_owned())
        );
        assert_eq!(
            next_step(Ok(SaleState::Waiting), true),
            Step::Expire(super::NO_ANSWER.to_owned())
        );
    }

    #[test]
    fn a_refusal_fails_at_once() {
        let refused = next_step(Err(PosError::Refused("Unknown device".into())), false);
        assert_eq!(
            refused,
            Step::Fail {
                code: "refused",
                why: "Unknown device".into()
            }
        );
    }
}

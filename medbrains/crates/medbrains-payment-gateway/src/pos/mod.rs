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
//! * [`ezetap`] — Razorpay POS (Ezetap push-to-pay).
//! * [`bridge`] — a machine wired to a counter PC, driven by the site bridge.
//! * [`simulator`] — a pretend machine, dev and test only.

pub mod bridge;
pub mod ezetap;
pub mod pinelabs;
pub mod resolve;
pub mod sale;
pub mod simulator;
pub mod start;
mod step;
pub mod undo;
pub mod view;

pub use step::{NO_ANSWER, Step, UNKNOWN, cancelled, next_step};

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
use serde::{Deserialize, Serialize};
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

/// What the patient may pay with at the machine, as the cashier chose it.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Tender {
    Card,
    /// UPI taken on the machine (its dynamic QR or collect request).
    Upi,
    /// Whichever the patient uses at the machine.
    #[default]
    Either,
}

impl Tender {
    /// The word kept on the sale row.
    pub const fn word(self) -> &'static str {
        match self {
            Self::Card => "card",
            Self::Upi => "upi",
            Self::Either => "either",
        }
    }

    /// The payment mode to post when the provider does not say how it was
    /// paid: what the cashier asked for, card when they left it open.
    pub fn fallback_method(word: Option<&str>) -> &'static str {
        if word == Some("upi") { "upi" } else { "card" }
    }
}

/// A sale to run on the machine.
#[derive(Debug, Clone, Copy)]
pub struct SaleAsk {
    pub txn_id: Uuid,
    pub amount_paise: i64,
    pub tender: Tender,
}

/// The machine approved the payment.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Approval {
    /// The provider's reference for the payment; filed on the bill.
    pub reference: String,
    /// What it approved, when it says — less than asked is a partial approval.
    pub approved_paise: Option<i64>,
    pub card_last4: Option<String>,
    pub auth_code: Option<String>,
    /// The bank's retrieval reference number — what settlement files match on.
    pub rrn: Option<String>,
    /// How it was paid, in the provider's word (`CARD`, `UPI`…), when it says.
    pub method: Option<String>,
    pub payload: Value,
}

/// Where the sale stands at the machine.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SaleState {
    /// Sent; the patient has not finished (or not started) at the machine —
    /// or the provider said something that is not a definite outcome.
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
    /// Stop the sale on the machine. `Ok` only when the provider confirmed
    /// it; a machine that is still taking the card answers `Refused`.
    async fn cancel(
        &self,
        ctx: &Ctx<'_>,
        reference: &str,
        amount_paise: i64,
    ) -> Result<(), PosError>;
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

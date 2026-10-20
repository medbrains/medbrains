//! Online payments over any provider (#4884): one trait every online
//! gateway implements, mirroring the card machines' [`crate::pos`].
//!
//! Checkout, a counter's dynamic UPI QR, a payment link, a refund, a payout
//! and the provider's webhook all go through [`OnlineProvider`]. Nothing here
//! posts money: what a provider says is turned into a [`ProviderEvent`] and
//! settled by [`crate::settle`], the single exactly-once path, so a hospital
//! changing provider changes no posting rule.
//!
//! Providers:
//! * [`razorpay`] — orders + Standard Checkout, QR Codes, Payment Links,
//!   refunds; payouts through RazorpayX.
//! * [`cashfree`] — PG orders (JS SDK session), UPI QR on an order, Payment
//!   Links, refunds.
//! * [`phonepe`] — PG Standard Checkout v2 (hosted redirect), refunds.
//! * [`payu`] — hash-signed hosted checkout (form post), refunds.
//!
//! What each can do is its [`Capabilities`]; screens offer only those, and
//! the server answers 422 for anything else.

pub mod cashfree;
pub mod choose;
mod http;
pub mod keys;
pub mod payu;
pub mod phonepe;
pub mod razorpay;
pub mod settings;
pub mod webhook;

pub use choose::{Chosen, OnlineError};
pub use keys::Keys;

use async_trait::async_trait;
use axum::http::HeaderMap;
use medbrains_doctor_payouts::provider::{PayoutRequest, Sent};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

/// What a provider needs for one call: the hospital's keys and where the
/// provider is (its real host, or a stand-in in tests).
pub struct Ctx<'a> {
    pub keys: &'a Keys,
    pub base: String,
}

/// Why a provider could not do what was asked.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProviderError {
    /// No answer, a timeout, a 5xx or a rate limit: whether it acted is
    /// unknown. The only error a fallback provider is offered for.
    Unavailable(String),
    /// A definite no, in the provider's words.
    Refused(String),
    /// The hospital's keys for it are not set; names what is missing.
    NotSetUp(String),
    /// This provider cannot do it (a capability it lacks).
    Unsupported(&'static str),
    /// A webhook whose signature does not verify.
    BadSignature,
}

impl ProviderError {
    pub fn words(&self) -> String {
        match self {
            Self::Unavailable(w) | Self::Refused(w) | Self::NotSetUp(w) => w.clone(),
            Self::Unsupported(c) => format!("This payment provider has no {c}"),
            Self::BadSignature => "webhook signature verification failed".to_owned(),
        }
    }
}

/// What a provider can do through MedBrains. Every flag is a promise the
/// implementation keeps; a screen offers only what is `true`.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[allow(clippy::struct_excessive_bools)]
pub struct Capabilities {
    /// An online checkout the cashier opens for the patient.
    pub checkout: bool,
    /// A single-use UPI QR for the amount due, confirmed by the provider.
    pub dynamic_qr: bool,
    pub payment_links: bool,
    /// Refund less than the whole payment.
    pub partial_refund: bool,
    /// More than one refund against one payment.
    pub multiple_refunds: bool,
    /// Send money out (to a UPI ID or bank account).
    pub payouts: bool,
    /// A UPI request pushed to the patient's UPI ID.
    pub upi_collect: bool,
    /// Card EMI inside the provider's checkout.
    pub emi: bool,
}

impl Capabilities {
    /// Whether the named capability is on; unknown names are off.
    pub fn has(&self, name: &str) -> bool {
        match name {
            "checkout" => self.checkout,
            "dynamic_qr" => self.dynamic_qr,
            "payment_links" => self.payment_links,
            "partial_refund" => self.partial_refund,
            "multiple_refunds" => self.multiple_refunds,
            "payouts" => self.payouts,
            "upi_collect" => self.upi_collect,
            "emi" => self.emi,
            _ => false,
        }
    }
}

/// A key the hospital sets for a provider.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct KeyField {
    pub name: &'static str,
    pub label: &'static str,
    /// Never shown back once stored.
    pub secret: bool,
    pub required: bool,
}

/// What the browser opens to take the payment.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Checkout {
    /// Razorpay Standard Checkout (`checkout.js`) on this order.
    RazorpayJs { key_id: String, order_id: String },
    /// Cashfree's JS SDK (`cashfree.js` v3) on this payment session.
    CashfreeJs { session_id: String, mode: String },
    /// A hosted page to open (PhonePe Standard Checkout).
    Redirect { url: String },
    /// A form to post to the provider's page (PayU hosted checkout).
    FormPost {
        action: String,
        fields: std::collections::BTreeMap<String, String>,
    },
}

/// An order the provider made, and how the browser pays it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Opened {
    /// The provider's order reference; the row's `gateway_order_id`.
    pub order_ref: String,
    pub checkout: Checkout,
}

/// A payment row to open a checkout for.
#[derive(Debug, Clone)]
pub struct CheckoutAsk<'a> {
    pub txn_id: Uuid,
    pub tenant_id: Uuid,
    pub amount_paise: i64,
    pub description: &'a str,
    pub phone: Option<&'a str>,
    /// Where the patient's browser returns after a hosted page.
    pub return_url: Option<&'a str>,
}

/// What the browser said the patient paid, to be checked before anything
/// is believed (Razorpay's signed handler result).
#[derive(Debug, Clone, Default)]
pub struct ClientProof<'a> {
    pub order_ref: &'a str,
    pub payment_id: Option<&'a str>,
    pub signature: Option<&'a str>,
}

/// Where a payment stands, in the provider's own record.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PaymentState {
    Paid,
    /// Authorised, attempted or not yet attempted.
    Pending,
    Failed(String),
}

/// The provider's record of an order's payment — the amount and method that
/// get posted, never the browser's.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentRecord {
    pub state: PaymentState,
    pub payment_id: String,
    pub amount_paise: Option<i64>,
    pub method: Option<String>,
}

/// A single-use UPI QR for a payment row.
#[derive(Debug, Clone)]
pub struct QrAsk<'a> {
    pub txn_id: Uuid,
    pub tenant_id: Uuid,
    pub amount_paise: i64,
    pub description: &'a str,
    /// When it stops taking payment (Unix seconds).
    pub close_by: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QrMade {
    pub order_ref: String,
    /// An image URL or a `data:` URI.
    pub image_url: String,
    pub close_by: i64,
}

/// A hosted payment link for a payment row.
#[derive(Debug, Clone)]
pub struct LinkAsk<'a> {
    pub txn_id: Uuid,
    pub tenant_id: Uuid,
    pub amount_paise: i64,
    pub description: &'a str,
    /// When the link stops working (Unix seconds).
    pub expire_by: Option<i64>,
    pub contact: Option<&'a str>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinkMade {
    pub order_ref: String,
    pub url: String,
}

/// A refund to make, once.
#[derive(Debug, Clone)]
pub struct RefundAsk<'a> {
    pub txn_id: Uuid,
    pub order_ref: &'a str,
    pub payment_id: &'a str,
    pub amount_paise: i64,
    /// The same for the same intent ([`crate::refund::refund_receipt`]): the
    /// provider rejects a repeat, so a retry never refunds twice.
    pub idempotency_key: &'a str,
    pub reason: &'a str,
}

/// How a payment came in.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Via {
    Checkout,
    Link,
    Qr,
}

/// A provider's verified word, normalised.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProviderEvent {
    /// Money is in: a checkout capture, a paid link or a credited QR.
    Captured {
        via: Via,
        payment_id: String,
        amount_paise: Option<i64>,
        method: Option<String>,
        /// The provider's own order to ask for the method when the notice
        /// does not say how it was paid (a Cashfree link).
        lookup: Option<String>,
    },
    Failed {
        code: Option<String>,
        reason: Option<String>,
    },
    Refunded {
        refund_id: String,
        amount_paise: i64,
        reason: Option<String>,
    },
    RefundFailed {
        refund_id: String,
        amount_paise: i64,
    },
    PayoutDone {
        reference: String,
        utr: Option<String>,
    },
    PayoutFailed {
        reference: String,
        reason: String,
    },
    /// The payer disputed it with their bank; finance answers it.
    Dispute {
        payment_id: String,
        amount_paise: Option<i64>,
        reason: String,
    },
    /// Verified, but nothing MedBrains acts on.
    Ignored(String),
}

/// A verified webhook: its dedupe id and what it says.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Notice {
    pub event_id: String,
    pub event: ProviderEvent,
}

/// Which payment row an (unverified) webhook is about.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Located {
    Order(String),
    /// About something MedBrains never made (a dashboard-made order).
    NotOurs,
    Unreadable,
}

#[async_trait]
pub trait OnlineProvider: Send + Sync {
    fn code(&self) -> &'static str;
    fn label(&self) -> &'static str;
    fn capabilities(&self) -> Capabilities;
    fn key_fields(&self) -> &'static [KeyField];
    /// The provider's host for test or live keys.
    fn api_base(&self, live: bool) -> &'static str;

    async fn create_checkout(
        &self,
        ctx: &Ctx<'_>,
        ask: &CheckoutAsk<'_>,
    ) -> Result<Opened, ProviderError>;
    /// Check what the browser reported. Providers whose browser result is
    /// unsigned have nothing to check: [`Self::fetch_payment`] decides.
    fn verify_payment(&self, _keys: &Keys, _proof: &ClientProof<'_>) -> Result<(), ProviderError> {
        Ok(())
    }
    /// The provider's record of the order's payment.
    async fn fetch_payment(
        &self,
        ctx: &Ctx<'_>,
        proof: &ClientProof<'_>,
    ) -> Result<PaymentRecord, ProviderError>;
    async fn create_dynamic_qr(
        &self,
        _ctx: &Ctx<'_>,
        _ask: &QrAsk<'_>,
    ) -> Result<QrMade, ProviderError> {
        Err(ProviderError::Unsupported("dynamic_qr"))
    }
    async fn create_payment_link(
        &self,
        _ctx: &Ctx<'_>,
        _ask: &LinkAsk<'_>,
    ) -> Result<LinkMade, ProviderError> {
        Err(ProviderError::Unsupported("payment_links"))
    }
    /// Refund (part of) a payment; the provider's refund id.
    async fn refund(&self, ctx: &Ctx<'_>, ask: &RefundAsk<'_>) -> Result<String, ProviderError>;
    async fn payout(&self, _ctx: &Ctx<'_>, _req: &PayoutRequest) -> Sent {
        Sent::Refused("This payment provider sends no payouts through MedBrains".to_owned())
    }
    /// The order an incoming webhook is about, read before its signature
    /// can be checked (the hospital, and so its secret, follows from it).
    fn locate(&self, headers: &HeaderMap, body: &str) -> Located;
    /// Verify the webhook's signature and normalise it.
    fn parse_webhook(
        &self,
        keys: &Keys,
        headers: &HeaderMap,
        body: &str,
    ) -> Result<Notice, ProviderError>;
    /// Do the keys work? A cheap authenticated call.
    async fn ping(&self, ctx: &Ctx<'_>) -> Result<(), ProviderError>;
}

/// Every online provider MedBrains implements.
pub const PROVIDERS: [&'static dyn OnlineProvider; 4] = [
    &razorpay::Razorpay,
    &cashfree::Cashfree,
    &phonepe::PhonePe,
    &payu::PayU,
];

/// The provider with this code.
pub fn provider_for(code: &str) -> Option<&'static dyn OnlineProvider> {
    PROVIDERS.into_iter().find(|p| p.code() == code)
}

/// The provider's word for a payment, as `received` for settling.
pub fn received(amount_paise: Option<i64>, credited: bool) -> crate::settle::Received {
    use crate::settle::{Received, rupees};
    match amount_paise {
        Some(p) if credited => Received::Credited(rupees(p)),
        Some(p) => Received::Exactly(rupees(p)),
        None => Received::AsRequested,
    }
}

/// A header's value as text.
pub(crate) fn header<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|v| v.to_str().ok())
}

#[cfg(test)]
pub(crate) fn test_headers(pairs: &[(&'static str, String)]) -> HeaderMap {
    pairs
        .iter()
        .filter_map(|(k, v)| {
            axum::http::HeaderValue::from_str(v)
                .ok()
                .map(|v| (axum::http::HeaderName::from_static(k), v))
        })
        .collect()
}

/// A JSON field as a string, whether the provider sent a string or a number.
pub(crate) fn text(v: &Value) -> Option<String> {
    v.as_str()
        .map(ToOwned::to_owned)
        .or_else(|| v.as_i64().map(|n| n.to_string()))
        .filter(|s| !s.is_empty())
}

/// Rupees as a provider writes them (`"22.00"` or `22`) to paise.
pub(crate) fn paise_of(v: &Value) -> Option<i64> {
    use rust_decimal::prelude::ToPrimitive;
    let rupees: rust_decimal::Decimal = match v {
        Value::String(s) => s.parse().ok()?,
        Value::Number(n) => n.to_string().parse().ok()?,
        _ => return None,
    };
    (rupees * rust_decimal::Decimal::ONE_HUNDRED)
        .round()
        .to_i64()
}

/// Paise as rupees with two decimals, as Cashfree and PayU take amounts.
pub(crate) fn rupees_text(paise: i64) -> String {
    crate::settle::rupees(paise).to_string()
}

#[cfg(test)]
#[path = "online_tests.rs"]
mod tests;

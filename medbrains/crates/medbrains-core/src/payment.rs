use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// The outbox event that makes a payment link — through the hospital's
/// online provider — for a payment row needing nothing more (a home
/// delivery); handled by `medbrains_payment_gateway::payment_link::PaymentLinkHandler`.
/// The name predates other providers and is kept: queued rows carry it.
pub const PAYMENT_LINK_EVENT: &str = "payment.razorpay.create_link";

/// Payment gateway transaction record — maps to `payment_gateway_transactions` table.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PaymentGatewayTransaction {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub invoice_id: Option<Uuid>,
    pub pharmacy_pos_sale_id: Option<Uuid>,
    pub gateway: String,
    pub gateway_order_id: String,
    pub gateway_payment_id: Option<String>,
    pub gateway_signature: Option<String>,
    pub amount: rust_decimal::Decimal,
    pub currency: String,
    pub status: String,
    pub payment_method: Option<String>,
    pub upi_vpa: Option<String>,
    pub card_last4: Option<String>,
    pub card_network: Option<String>,
    pub bank_name: Option<String>,
    pub wallet: Option<String>,
    pub error_code: Option<String>,
    pub error_description: Option<String>,
    pub refund_id: Option<String>,
    pub refund_amount: Option<rust_decimal::Decimal>,
    pub notes: serde_json::Value,
    pub webhook_payload: Option<serde_json::Value>,
    pub verified_at: Option<DateTime<Utc>>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// The card machine a counter card sale ran on.
    #[sqlx(default)]
    pub terminal_id: Option<Uuid>,
    /// The card network's approval code, from the machine.
    #[sqlx(default)]
    pub card_auth_code: Option<String>,
}

/// A payment device bolted to a billing place — maps to `payment_terminals`.
/// A hospital runs several providers + POS/QR/soundbox devices at once; this
/// registry resolves which devices a cashier's counter can use at pay time.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PaymentTerminal {
    pub id: Uuid,
    pub tenant_id: Uuid,
    pub provider: String,
    pub kind: String,
    pub terminal_code: Option<String>,
    /// Bank whose MID the device sits under (SBI / Canara / TMB / …). The
    /// integration is `provider` (the TSP); this is just the acquiring bank.
    pub acquiring_bank: Option<String>,
    /// The counter (station) the machine sits at.
    pub station_id: Option<Uuid>,
    pub station_name: Option<String>,
    pub location_id: Option<Uuid>,
    pub label: String,
    pub mode: String,
    /// `cloud` (the provider's API) or `bridge` (wired to a counter PC).
    pub connection: String,
    /// Bridge only: the device adapter and where the machine is plugged in.
    pub adapter: Option<String>,
    pub device_address: Option<String>,
    pub last_seen_at: Option<DateTime<Utc>>,
    /// `online`, `offline`, or `unknown` when it has never answered.
    pub status: String,
    pub last_error: Option<String>,
    pub is_active: bool,
    pub retired_at: Option<DateTime<Utc>>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Response returned when a gateway order is created.
///
/// Sprint A change: `status` carries the queued state. New flow returns
/// `{ status: "pending_gateway", order_id: "" }` immediately and the
/// frontend polls `GET /api/payments/{transaction_id}/status` to learn
/// the gateway-issued `order_id` + `key_id` once the outbox worker has
/// successfully posted to Razorpay.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrderResponse {
    pub transaction_id: Uuid,
    pub order_id: String,
    pub amount: rust_decimal::Decimal,
    pub currency: String,
    pub key_id: String,
    /// "`pending_gateway`" | "created" | "captured" | "failed"
    #[serde(default)]
    pub status: String,
    /// The provider that made the order (`razorpay`, `cashfree`…).
    #[serde(default)]
    pub provider: String,
    /// How the browser pays it: `{ kind: razorpay_js | cashfree_js |
    /// redirect | form_post, … }`.
    #[serde(default)]
    pub checkout: Option<serde_json::Value>,
}

/// The browser's word that a checkout finished, to be checked with the
/// provider: Razorpay's signed handler result (its `razorpay_*` names are
/// accepted), or just the payment row for a provider whose result is unsigned.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct VerifyPaymentRequest {
    #[serde(default)]
    pub transaction_id: Option<Uuid>,
    #[serde(default, alias = "razorpay_order_id")]
    pub order_id: Option<String>,
    #[serde(default, alias = "razorpay_payment_id")]
    pub payment_id: Option<String>,
    #[serde(default, alias = "razorpay_signature")]
    pub signature: Option<String>,
}

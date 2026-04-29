use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
}

/// Response returned when a gateway order is created.
///
/// Sprint A change: `status` carries the queued state. New flow returns
/// `{ status: "pending_gateway", order_id: "" }` immediately and the
/// frontend polls `GET /api/payments/{transaction_id}/status` to learn
/// the gateway-issued order_id + key_id once the outbox worker has
/// successfully posted to Razorpay.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOrderResponse {
    pub transaction_id: Uuid,
    pub order_id: String,
    pub amount: rust_decimal::Decimal,
    pub currency: String,
    pub key_id: String,
    /// "pending_gateway" | "created" | "captured" | "failed"
    #[serde(default)]
    pub status: String,
}

/// Frontend request to verify a completed payment.
#[derive(Debug, Clone, Deserialize)]
pub struct VerifyPaymentRequest {
    pub razorpay_order_id: String,
    pub razorpay_payment_id: String,
    pub razorpay_signature: String,
}

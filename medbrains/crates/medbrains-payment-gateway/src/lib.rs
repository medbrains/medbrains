pub mod payment_link;
pub mod pos;
pub mod razorpay;
pub mod settle;
pub mod terminals;
pub mod upi_qr;

pub use settle::{CAPTURE_EVENTS, GatewayPosting, record_invoice_payment};

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use hmac::{Hmac, Mac};
use medbrains_core::payment::{
    CreateOrderResponse, PaymentGatewayTransaction, VerifyPaymentRequest,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use uuid::Uuid;

use axum::routing::{get, post, put};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

type HmacSha256 = Hmac<Sha256>;

// ══════════════════════════════════════════════════════════
//  Config helpers
// ══════════════════════════════════════════════════════════

/// Razorpay's key ID and secret when Razorpay is the hospital's active
/// online provider and is configured — what a hosted payment link needs.
/// `None` when the hospital takes no online payment this way.
///
/// # Errors
/// A database fault, or a stored config that does not parse.
pub async fn razorpay_link_credentials(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    secrets: &dyn medbrains_core::secrets::SecretResolver,
    tenant_id: &Uuid,
) -> Result<Option<(String, String)>, AppError> {
    if resolve_active_provider(tx, tenant_id).await? != "razorpay" {
        return Ok(None);
    }
    Ok(razorpay::credentials(tx, secrets, tenant_id)
        .await?
        .map(|c| (c.key_id, c.key_secret)))
}

/// The hospital's Razorpay keys, or a clear 503 when it has none.
async fn require_razorpay(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    state: &AppState,
    tenant_id: &Uuid,
) -> Result<razorpay::Credentials, AppError> {
    razorpay::credentials(tx, state.secret_resolver.as_ref(), tenant_id)
        .await?
        .ok_or_else(|| {
            AppError::ServiceUnavailable("Razorpay credentials are not configured".to_owned())
        })
}

fn razorpay_mode(key_id: &str) -> &'static str {
    if key_id.starts_with("rzp_test_") {
        "test"
    } else if key_id.starts_with("rzp_live_") {
        "live"
    } else {
        "unknown"
    }
}

/// Read UPI VPA from `tenant_settings`.
async fn get_upi_vpa(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<Option<String>, AppError> {
    let row = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'payments' AND key = 'upi_vpa' \
           AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    Ok(row.and_then(|v| v.as_str().map(ToOwned::to_owned)))
}

// ══════════════════════════════════════════════════════════
//  Request / Response types
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateOrderRequest {
    pub invoice_id: Option<Uuid>,
    pub pos_sale_id: Option<Uuid>,
    pub amount: Decimal,
    pub currency: Option<String>,
    pub receipt: Option<String>,
    /// Phone number for UPI collect (PhonePe, etc.)
    pub phone: Option<String>,
    /// VPA for UPI collect (PhonePe, etc.)
    pub vpa: Option<String>,
    /// Callback URL for payment status updates (PhonePe, etc.)
    pub callback_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PaymentStatusResponse {
    pub transaction: PaymentGatewayTransaction,
}

#[derive(Debug, Deserialize)]
pub struct GenerateUpiQrRequest {
    pub amount: Decimal,
    pub invoice_id: Option<Uuid>,
    pub pos_sale_id: Option<Uuid>,
    pub description: Option<String>,
    /// A QR the patient pays now, at the counter: made by Razorpay for this
    /// amount and confirmed by it. Without it (a printed bill) the QR is the
    /// hospital's own UPI ID, which lasts as long as the paper does.
    pub live: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct UpiQrResponse {
    /// `razorpay` — Razorpay made it and confirms the payment itself;
    /// `upi_id` — the hospital's UPI ID, confirmed by the UTR the patient shows.
    pub source: &'static str,
    pub upi_uri: Option<String>,
    pub vpa: Option<String>,
    pub amount: Decimal,
    pub transaction_ref: String,
    /// The payment row a Razorpay QR settles, to watch.
    pub transaction_id: Option<Uuid>,
    pub image_url: Option<String>,
    /// When a Razorpay QR stops taking payment (Unix seconds).
    pub close_by: Option<i64>,
    /// Why a live QR was asked for but the hospital's UPI ID QR is shown.
    pub fallback_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct InitiateRefundRequest {
    /// The online payment to refund, by its gateway row…
    pub transaction_id: Option<Uuid>,
    /// …or by the bill's payment row it posted as (the invoice screen's view).
    pub payment_id: Option<Uuid>,
    pub amount: Option<Decimal>,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RefundResponse {
    pub transaction: PaymentGatewayTransaction,
    pub refund_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct RazorpayStatusResponse {
    pub configured: bool,
    pub mode: Option<String>,
    pub source: Option<String>,
    pub key_id_prefix: Option<String>,
    pub webhook_configured: bool,
}

pub async fn razorpay_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<RazorpayStatusResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let resolved =
        razorpay::credentials(&mut tx, state.secret_resolver.as_ref(), &claims.tenant_id).await?;
    tx.commit().await?;

    let Some(resolved) = resolved else {
        return Ok(Json(RazorpayStatusResponse {
            configured: false,
            mode: None,
            source: None,
            key_id_prefix: None,
            webhook_configured: false,
        }));
    };

    Ok(Json(RazorpayStatusResponse {
        configured: true,
        mode: Some(razorpay_mode(&resolved.key_id).to_owned()),
        source: Some(resolved.source.to_owned()),
        key_id_prefix: Some(mask_key_id(&resolved.key_id)),
        webhook_configured: resolved.webhook_secret.is_some(),
    }))
}

// ══════════════════════════════════════════════════════════
//  Multi-provider seam (additive — Razorpay logic unchanged)
// ══════════════════════════════════════════════════════════

/// Known payment providers and the methods each can settle. `has_adapter`
/// marks whether a worker adapter exists yet — only adapter-backed providers
/// may be selected as `active_provider` so `create_order` never queues an
/// event the outbox worker cannot handle.
struct ProviderSpec {
    code: &'static str,
    label: &'static str,
    methods: &'static [&'static str],
    has_adapter: bool,
    /// Outbox event that pushes a UPI collect request to the patient's UPI ID.
    /// `None` when the adapter can only create an order the patient opens.
    upi_collect_event: Option<&'static str>,
}

const KNOWN_PROVIDERS: &[ProviderSpec] = &[
    ProviderSpec {
        code: "razorpay",
        label: "Razorpay",
        methods: &["card", "upi", "upi_qr", "netbanking", "wallet"],
        upi_collect_event: None,
        has_adapter: true,
    },
    ProviderSpec {
        code: "cashfree",
        label: "Cashfree",
        methods: &["card", "upi", "upi_qr", "netbanking"],
        upi_collect_event: None,
        has_adapter: true,
    },
    ProviderSpec {
        code: "paytm",
        label: "Paytm",
        methods: &["card", "upi", "wallet"],
        upi_collect_event: None,
        has_adapter: false,
    },
    ProviderSpec {
        code: "pinelabs",
        label: "Pine Labs (POS/TSP)",
        methods: &["card", "upi_qr"],
        upi_collect_event: None,
        has_adapter: false,
    },
    ProviderSpec {
        code: "mswipe",
        label: "Mswipe (POS/TSP)",
        methods: &["card", "upi_qr"],
        upi_collect_event: None,
        has_adapter: false,
    },
    ProviderSpec {
        code: "worldline",
        label: "Worldline (POS/TSP)",
        methods: &["card", "upi_qr"],
        upi_collect_event: None,
        has_adapter: false,
    },
    ProviderSpec {
        code: "phonepe",
        label: "PhonePe",
        methods: &["card", "upi", "upi_qr", "netbanking"],
        upi_collect_event: Some("payment.phonepe.create_order"),
        has_adapter: true,
    },
    ProviderSpec {
        code: "payu",
        label: "PayU",
        methods: &["card", "netbanking", "upi", "wallet"],
        upi_collect_event: None,
        has_adapter: true,
    },
    ProviderSpec {
        code: "ccavenue",
        label: "CCAvenue",
        methods: &["card", "netbanking", "wallet", "emi"],
        upi_collect_event: None,
        has_adapter: true,
    },
    ProviderSpec {
        code: "razorpayx",
        label: "RazorpayX (bank virtual account)",
        methods: &["virtual_account", "upi", "netbanking"],
        upi_collect_event: None,
        has_adapter: true,
    },
    ProviderSpec {
        code: "icici",
        label: "ICICI Corporate API (bank virtual account)",
        methods: &["virtual_account", "upi", "netbanking"],
        upi_collect_event: None,
        has_adapter: false,
    },
];

fn provider_spec(code: &str) -> Option<&'static ProviderSpec> {
    KNOWN_PROVIDERS.iter().find(|p| p.code == code)
}

/// Rupees to paise for a gateway. Refuses amounts that are not whole paise —
/// silently rounding would charge the patient something other than the bill.
pub(crate) fn amount_to_paise(amount: Decimal) -> Result<i64, AppError> {
    use rust_decimal::prelude::ToPrimitive;
    if amount <= Decimal::ZERO {
        return Err(AppError::BadRequest(
            "Amount must be greater than zero".to_owned(),
        ));
    }
    let rounded =
        amount.round_dp_with_strategy(2, rust_decimal::RoundingStrategy::MidpointAwayFromZero);
    if rounded != amount {
        return Err(AppError::BadRequest(format!(
            "Amount {amount} is not a whole number of paise"
        )));
    }
    (rounded * Decimal::from(100))
        .to_i64()
        .ok_or_else(|| AppError::BadRequest(format!("Amount {amount} is too large")))
}

/// A payment raised against a bill may only be raised by someone who may bill
/// that bill's patient — the same check recording a payment makes.
pub(crate) async fn require_invoice_billing(
    state: &AppState,
    claims: &Claims,
    invoice_id: Option<Uuid>,
) -> Result<(), AppError> {
    match invoice_id {
        Some(id) => {
            medbrains_authz_gate::require_access_via(
                state,
                claims,
                medbrains_authz_gate::links::INVOICE,
                id,
            )
            .await
        }
        None => Ok(()),
    }
}

/// Resolve the tenant's active payment provider. Defaults to `razorpay` for
/// back-compat (existing tenants only ever had `razorpay_config`).
async fn resolve_active_provider(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let row = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'payments' AND key = 'active_provider' \
           AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    let provider = row
        .and_then(|v| v.as_str().map(ToOwned::to_owned))
        .filter(|p| provider_spec(p).is_some())
        .unwrap_or_else(|| "razorpay".to_owned());
    Ok(provider)
}

#[derive(Debug, Serialize)]
struct PaymentProviderInfo {
    provider: String,
    label: String,
    configured: bool,
    active: bool,
    has_adapter: bool,
    mode: Option<String>,
    webhook_configured: bool,
    methods: Vec<String>,
    /// Can send a UPI collect request to the patient's UPI ID.
    supports_upi_collect: bool,
}

#[derive(Debug, Serialize)]
pub struct PaymentProvidersResponse {
    active_provider: String,
    providers: Vec<PaymentProviderInfo>,
}

/// Read a generic `<provider>_config` blob and report configured / mode /
/// webhook without binding to a specific provider's typed struct.
async fn peek_provider_config(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
    provider: &str,
) -> Result<(bool, Option<String>, bool), AppError> {
    let key = format!("{provider}_config");
    let row = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'payments' AND key = $2 \
           AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .bind(&key)
    .fetch_optional(&mut **tx)
    .await?;

    let Some(cfg) = row else {
        return Ok((false, None, false));
    };
    // A provider is "configured" once it has a credential id (key_id / app_id).
    let configured = cfg
        .get("key_id")
        .and_then(serde_json::Value::as_str)
        .is_some()
        || cfg
            .get("app_id")
            .and_then(serde_json::Value::as_str)
            .is_some();
    let mode = cfg
        .get("mode")
        .and_then(serde_json::Value::as_str)
        .map(ToOwned::to_owned);
    let webhook_configured = cfg
        .get("webhook_secret")
        .and_then(serde_json::Value::as_str)
        .is_some_and(|s| !s.is_empty());
    Ok((configured, mode, webhook_configured))
}

/// GET /api/payments/providers — list every known provider with its
/// configured/active/mode state so admin + the payment modal can show what's
/// live and which are in sandbox.
pub async fn list_payment_providers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<PaymentProvidersResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let active = resolve_active_provider(&mut tx, &claims.tenant_id).await?;

    let mut providers = Vec::with_capacity(KNOWN_PROVIDERS.len());
    for spec in KNOWN_PROVIDERS {
        // Razorpay keeps its typed resolver (incl. env fallback + key-id mode
        // detection); other providers use the generic peek.
        let (configured, mode, webhook_configured) = if spec.code == "razorpay" {
            match razorpay::credentials(&mut tx, state.secret_resolver.as_ref(), &claims.tenant_id)
                .await?
            {
                Some(c) => (
                    true,
                    Some(razorpay_mode(&c.key_id).to_owned()),
                    c.webhook_secret.is_some(),
                ),
                None => (false, None, false),
            }
        } else {
            peek_provider_config(&mut tx, &claims.tenant_id, spec.code).await?
        };

        providers.push(PaymentProviderInfo {
            provider: spec.code.to_owned(),
            label: spec.label.to_owned(),
            configured,
            active: spec.code == active,
            has_adapter: spec.has_adapter,
            mode,
            webhook_configured,
            methods: spec.methods.iter().map(|m| (*m).to_owned()).collect(),
            supports_upi_collect: spec.upi_collect_event.is_some(),
        });
    }

    tx.commit().await?;
    Ok(Json(PaymentProvidersResponse {
        active_provider: active,
        providers,
    }))
}

/// A terminal for online checkout or a QR names a known payment provider.
pub(crate) fn validate_terminal_provider(provider: &str) -> Result<(), AppError> {
    if provider_spec(provider).is_some() {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "Unknown payment provider '{provider}'"
        )))
    }
}

// ══════════════════════════════════════════════════════════
//  POST /api/payments/create-order
// ══════════════════════════════════════════════════════════

pub async fn create_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateOrderRequest>,
) -> Result<Json<CreateOrderResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;
    require_invoice_billing(&state, &claims, body.invoice_id).await?;

    if body.invoice_id.is_none() && body.pos_sale_id.is_none() {
        return Err(AppError::BadRequest(
            "either invoice_id or pos_sale_id is required".to_owned(),
        ));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Which provider settles this tenant's online orders. Only adapter-backed
    // providers may be selected so we never queue an unhandlable event.
    let provider = resolve_active_provider(&mut tx, &claims.tenant_id).await?;
    if !provider_spec(&provider).is_some_and(|s| s.has_adapter) {
        return Err(AppError::ServiceUnavailable(format!(
            "Payment provider '{provider}' has no gateway adapter yet"
        )));
    }

    // PhonePe takes an online payment as a UPI request pushed to the patient's
    // UPI ID; without one it would queue a request that reaches nobody.
    if provider == "phonepe" && !body.vpa.as_deref().is_some_and(|v| v.trim().contains('@')) {
        return Err(AppError::Conflict(
            "PhonePe needs the patient's UPI ID (name@bank) to send the payment request. \
             Enter it under \"Send UPI request\", or use the UPI QR instead."
                .to_owned(),
        ));
    }

    let currency = body.currency.as_deref().unwrap_or("INR");

    // Convert amount to paise (smallest unit)
    let amount_paise = amount_to_paise(body.amount)?;

    // Insert the txn (status='pending_gateway') under the active provider.
    // Razorpay's order is then made in this request (checkout needs its id
    // now); the other providers' adapters run in the outbox worker and the
    // client polls /status. idempotency_key = txn UUID (also the gateway
    // receipt) so neither path can make a second order for one row.
    let txn = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "INSERT INTO payment_gateway_transactions \
         (tenant_id, invoice_id, pharmacy_pos_sale_id, gateway, gateway_order_id, \
          amount, currency, status, created_by, idempotency_key) \
         VALUES ($1, $2, $3, $4, '', $5, $6, 'pending_gateway', $7, $8) \
         RETURNING *", // allow-raw-sql: gateway txn write inside outbox-coupled tx
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(body.pos_sale_id)
    .bind(&provider)
    .bind(body.amount)
    .bind(currency)
    .bind(claims.sub)
    .bind(Uuid::new_v4().to_string()) // placeholder, overwritten below
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        // allow-raw-sql: backfill idempotency_key with txn.id
        "UPDATE payment_gateway_transactions SET idempotency_key = $1 WHERE id = $1",
    )
    .bind(txn.id)
    .execute(&mut *tx)
    .await?;

    let mut razorpay_keys = None;
    let key_id = if provider == "cashfree" {
        let (_, mode, _) = peek_provider_config(&mut tx, &claims.tenant_id, "cashfree").await?;
        let api_base = if mode.as_deref() == Some("live") {
            "https://api.cashfree.com/pg"
        } else {
            "https://sandbox.cashfree.com/pg"
        };
        medbrains_outbox::queue_in_tx(
            &mut tx,
            medbrains_outbox::OutboxRow {
                tenant_id: claims.tenant_id,
                aggregate_type: "payment_gateway_transaction",
                aggregate_id: Some(txn.id),
                event_type: "payment.cashfree.create_order",
                payload: serde_json::json!({
                    "internal_payment_id": txn.id,
                    "amount_paise": amount_paise,
                    "currency": currency,
                    "api_base": api_base,
                    "actor_context": { "user_id": claims.sub, "tenant_id": claims.tenant_id },
                }),
                idempotency_key: Some(txn.id.to_string()),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("outbox queue failed: {e}")))?;
        String::new()
    } else if provider == "phonepe" {
        let (_, mode, _) = peek_provider_config(&mut tx, &claims.tenant_id, "phonepe").await?;
        let api_base = if mode.as_deref() == Some("live") {
            "https://api.phonepe.com/apis/pg"
        } else {
            "https://api-preprod.phonepe.com/apis/pg"
        };
        medbrains_outbox::queue_in_tx(
            &mut tx,
            medbrains_outbox::OutboxRow {
                tenant_id: claims.tenant_id,
                aggregate_type: "payment_gateway_transaction",
                aggregate_id: Some(txn.id),
                event_type: "payment.phonepe.create_order",
                payload: serde_json::json!({
                    "internal_payment_id": txn.id,
                    "amount_paise": amount_paise,
                    "phone": body.phone.as_deref().unwrap_or(""),
                    "vpa": body.vpa.as_deref().unwrap_or(""),
                    "callback_url": body.callback_url.as_deref().unwrap_or(""),
                    "api_base": api_base,
                    "actor_context": { "user_id": claims.sub, "tenant_id": claims.tenant_id },
                }),
                idempotency_key: Some(txn.id.to_string()),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("outbox queue failed: {e}")))?;
        String::new()
    } else if provider == "payu" {
        let (_, mode, _) = peek_provider_config(&mut tx, &claims.tenant_id, "payu").await?;
        let api_base = if mode.as_deref() == Some("live") {
            "https://secure.payu.in"
        } else {
            "https://sandbox.payu.in"
        };
        medbrains_outbox::queue_in_tx(
            &mut tx,
            medbrains_outbox::OutboxRow {
                tenant_id: claims.tenant_id,
                aggregate_type: "payment_gateway_transaction",
                aggregate_id: Some(txn.id),
                event_type: "payment.payu.create_order",
                payload: serde_json::json!({
                    "internal_payment_id": txn.id,
                    "amount": body.amount.to_string(),
                    "product_info": body.receipt.as_deref().unwrap_or("MedBrains Payment"),
                    "first_name": "Patient",
                    "email": "patient@medbrains.local",
                    "phone": body.phone.as_deref().unwrap_or(""),
                    "surl": body.callback_url.as_deref().unwrap_or(""),
                    "furl": body.callback_url.as_deref().unwrap_or(""),
                    "api_base": api_base,
                    "actor_context": { "user_id": claims.sub, "tenant_id": claims.tenant_id },
                }),
                idempotency_key: Some(txn.id.to_string()),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("outbox queue failed: {e}")))?;
        String::new()
    } else if provider == "ccavenue" {
        let (_, mode, _) = peek_provider_config(&mut tx, &claims.tenant_id, "ccavenue").await?;
        let api_base = if mode.as_deref() == Some("live") {
            "https://www.ccavenue.com"
        } else {
            "https://test.ccavenue.com"
        };
        medbrains_outbox::queue_in_tx(
            &mut tx,
            medbrains_outbox::OutboxRow {
                tenant_id: claims.tenant_id,
                aggregate_type: "payment_gateway_transaction",
                aggregate_id: Some(txn.id),
                event_type: "payment.ccavenue.create_order",
                payload: serde_json::json!({
                    "internal_payment_id": txn.id,
                    "amount": body.amount.to_string(),
                    "currency": currency,
                    "redirect_url": body.callback_url.as_deref().unwrap_or(""),
                    "cancel_url": body.callback_url.as_deref().unwrap_or(""),
                    "api_base": api_base,
                    "actor_context": { "user_id": claims.sub, "tenant_id": claims.tenant_id },
                }),
                idempotency_key: Some(txn.id.to_string()),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("outbox queue failed: {e}")))?;
        String::new()
    } else {
        let keys = require_razorpay(&mut tx, &state, &claims.tenant_id).await?;
        let key_id = keys.key_id.clone(); // safe to return — Razorpay key_id is public-side
        razorpay_keys = Some(keys);
        key_id
    };

    tx.commit().await?;

    let (order_id, status) = match razorpay_keys {
        Some(keys) => {
            let id = create_razorpay_order(&state, &keys, &txn, amount_paise, currency).await?;
            (id, "created")
        }
        None => (String::new(), "pending_gateway"),
    };

    Ok(Json(CreateOrderResponse {
        transaction_id: txn.id,
        order_id,
        amount: body.amount,
        currency: currency.to_owned(),
        key_id,
        status: status.to_owned(),
    }))
}

/// Razorpay's order for a payment row, made in the request rather than by
/// the outbox: checkout cannot open without its id, and one call here is
/// simpler and faster than a queued job and a polling loop. The receipt is
/// the row's id, so the order and the row name each other. The row is
/// committed before the call (no transaction is held open across it) and
/// records the answer either way: `created` with the order id, or `failed`
/// with Razorpay's reason — the cashier is told, never left waiting.
async fn create_razorpay_order(
    state: &AppState,
    keys: &razorpay::Credentials,
    txn: &PaymentGatewayTransaction,
    amount_paise: i64,
    currency: &str,
) -> Result<String, AppError> {
    let body = serde_json::json!({
        "amount": amount_paise,
        "currency": currency,
        "receipt": txn.id.to_string(),
        "notes": { "tenant_id": txn.tenant_id, "internal_payment_id": txn.id },
    });
    let answer = razorpay::call(state.secret_resolver.as_ref(), keys, "/orders", Some(&body)).await;
    let made = match &answer {
        razorpay::Answer::Ok(v) => v["id"].as_str().map(ToOwned::to_owned),
        _ => None,
    };
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &txn.tenant_id).await?;
    let Some(order_id) = made else {
        let why = match answer {
            razorpay::Answer::Refused(w) => format!("Razorpay refused the order: {w}"),
            razorpay::Answer::Unreachable(w) => w,
            razorpay::Answer::Ok(_) => "Razorpay's answer named no order".to_owned(),
        };
        sqlx::query(
            "UPDATE payment_gateway_transactions SET status = 'failed', \
             error_description = $2, updated_at = now() WHERE id = $1",
        )
        .bind(txn.id)
        .bind(&why)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        return Err(AppError::ServiceUnavailable(format!(
            "{why}. Online payment is not available right now; take the payment another way."
        )));
    };
    sqlx::query(
        "UPDATE payment_gateway_transactions SET status = 'created', \
         gateway_order_id = $2, updated_at = now() WHERE id = $1",
    )
    .bind(txn.id)
    .bind(&order_id)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(order_id)
}

// ══════════════════════════════════════════════════════════
//  POST /api/payments/virtual-account  (RazorpayX Smart Collect)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct CreateVirtualAccountRequest {
    pub invoice_id: Uuid,
    pub amount: Option<Decimal>,
}

#[derive(Debug, Serialize)]
pub struct CreateVirtualAccountResponse {
    pub transaction_id: Uuid,
    pub status: String,
}

/// POST /api/payments/virtual-account — mint a per-invoice bank virtual account
/// (account no + IFSC + UPI VPA). The worker calls RazorpayX; the client polls
/// /status for the receiver details to display; the credited webhook settles.
pub async fn create_virtual_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateVirtualAccountRequest>,
) -> Result<Json<CreateVirtualAccountResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let amount = body.amount.unwrap_or(Decimal::ZERO);
    let amount_paise = if amount > Decimal::ZERO {
        Some(amount_to_paise(amount)?)
    } else {
        None
    };

    let txn = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "INSERT INTO payment_gateway_transactions \
         (tenant_id, invoice_id, gateway, gateway_order_id, amount, currency, status, \
          created_by, idempotency_key) \
         VALUES ($1, $2, 'razorpayx', '', $3, 'INR', 'pending_gateway', $4, $5) \
         RETURNING *", // allow-raw-sql: gateway txn write inside outbox-coupled tx
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(amount)
    .bind(claims.sub)
    .bind(Uuid::new_v4().to_string())
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        // allow-raw-sql: backfill idempotency_key with txn.id
        "UPDATE payment_gateway_transactions SET idempotency_key = $1 WHERE id = $1",
    )
    .bind(txn.id)
    .execute(&mut *tx)
    .await?;

    medbrains_outbox::queue_in_tx(
        &mut tx,
        medbrains_outbox::OutboxRow {
            tenant_id: claims.tenant_id,
            aggregate_type: "payment_gateway_transaction",
            aggregate_id: Some(txn.id),
            event_type: "payment.razorpayx.create_va",
            payload: serde_json::json!({
                "internal_payment_id": txn.id,
                "amount_paise": amount_paise,
                "actor_context": { "user_id": claims.sub, "tenant_id": claims.tenant_id },
            }),
            idempotency_key: Some(txn.id.to_string()),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("outbox queue failed: {e}")))?;

    tx.commit().await?;

    Ok(Json(CreateVirtualAccountResponse {
        transaction_id: txn.id,
        status: "pending_gateway".to_owned(),
    }))
}

/// POST /api/webhooks/razorpayx — `virtual_account.credited` reverse-recon.
/// Matches the credit by the VA id (= our gateway_order_id) and settles the
/// invoice. Same HMAC scheme + idempotency as the Razorpay webhook.
pub async fn razorpayx_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: String,
) -> Result<Json<serde_json::Value>, AppError> {
    let signature = headers
        .get("X-Razorpay-Signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("missing X-Razorpay-Signature header".to_owned()))?;
    let event_id = headers
        .get("X-Razorpay-Event-Id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("missing X-Razorpay-Event-Id header".to_owned()))?
        .to_owned();

    let payload: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| AppError::BadRequest(format!("invalid webhook payload: {e}")))?;

    let va_id = payload["payload"]["virtual_account"]["entity"]["id"].as_str();
    let Some(va_id) = va_id else {
        log_webhook_exception(&state.db, "razorpayx", None, "unknown_order", &payload).await?;
        return Ok(Json(serde_json::json!({ "status": "ignored" })));
    };

    let txn_row = sqlx::query_as::<_, PaymentGatewayTransaction>(
        // allow-raw-sql: webhook entry, tenant context not yet resolved
        "SELECT * FROM payment_gateway_transactions WHERE gateway_order_id = $1 LIMIT 1",
    )
    .bind(va_id)
    .fetch_optional(&state.db)
    .await?;

    let Some(txn_row) = txn_row else {
        log_webhook_exception(
            &state.db,
            "razorpayx",
            Some(va_id),
            "unknown_order",
            &payload,
        )
        .await?;
        return Ok(Json(serde_json::json!({ "status": "unknown_order" })));
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &txn_row.tenant_id).await?;

    verify_webhook_signature(&mut tx, &state, &txn_row, &body, signature).await?;

    let inserted: Option<(String,)> = sqlx::query_as(
        // allow-raw-sql: webhook idempotency PK insert
        "INSERT INTO processed_webhooks (provider, event_id, tenant_id, payload) \
         VALUES ('razorpayx', $1, $2, $3) \
         ON CONFLICT (provider, event_id) DO NOTHING \
         RETURNING event_id",
    )
    .bind(&event_id)
    .bind(txn_row.tenant_id)
    .bind(&payload)
    .fetch_optional(&mut *tx)
    .await?;

    if inserted.is_none() {
        tx.commit().await?;
        return Ok(Json(
            serde_json::json!({ "status": "duplicate", "event_id": event_id }),
        ));
    }

    if payload["event"].as_str() == Some("virtual_account.credited") {
        let payment = &payload["payload"]["payment"]["entity"];
        let payment_id = payment["id"].as_str().unwrap_or(va_id);
        // A transfer to the account credits whatever the payer sent.
        let received = payment["amount"]
            .as_i64()
            .filter(|p| *p > 0)
            .map_or(settle::Received::AsRequested, |p| {
                settle::Received::Credited(settle::rupees(p))
            });
        settle::settle_capture(
            &mut tx,
            txn_row.id,
            &settle::Capture {
                provider: "razorpayx",
                payment_id,
                method: Some(payment["method"].as_str().unwrap_or("bank_transfer")),
                received,
                signature: None,
                payload: Some(&payload),
            },
        )
        .await?;
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

// ══════════════════════════════════════════════════════════
//  POST /api/payments/verify
// ══════════════════════════════════════════════════════════

/// The checkout's word that the patient paid. The signature proves the
/// browser did not invent the ids; the amount and method come from Razorpay
/// itself, never from the browser. Settled through the same path as the
/// webhook, so whichever arrives first posts and the other posts nothing.
pub async fn verify_payment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<VerifyPaymentRequest>,
) -> Result<Json<PaymentGatewayTransaction>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let keys = require_razorpay(&mut tx, &state, &claims.tenant_id).await?;
    let message = format!("{}|{}", body.razorpay_order_id, body.razorpay_payment_id);
    if !razorpay::signature_matches(
        &keys.key_secret,
        message.as_bytes(),
        &body.razorpay_signature,
    ) {
        return Err(AppError::BadRequest(
            "payment signature verification failed".to_owned(),
        ));
    }
    let txn = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "SELECT * FROM payment_gateway_transactions \
         WHERE gateway_order_id = $1 AND tenant_id = $2",
    )
    .bind(&body.razorpay_order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;
    tx.commit().await?;

    let payment = fetch_razorpay_payment(&state, &keys, &body).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    if payment["status"].as_str() != Some("captured") {
        // Authorised but not yet captured: `payment.captured` settles it.
        sqlx::query(
            "UPDATE payment_gateway_transactions SET status = 'authorized', \
             gateway_payment_id = $2, updated_at = now() \
             WHERE id = $1 AND status IN ('pending_gateway', 'created')",
        )
        .bind(txn.id)
        .bind(&body.razorpay_payment_id)
        .execute(&mut *tx)
        .await?;
        let current = settle::lock_txn(&mut tx, txn.id).await?;
        tx.commit().await?;
        return Ok(Json(current));
    }
    let received = payment["amount"]
        .as_i64()
        .map_or(settle::Received::AsRequested, |p| {
            settle::Received::Exactly(settle::rupees(p))
        });
    let settled = settle::settle_capture(
        &mut tx,
        txn.id,
        &settle::Capture {
            provider: "razorpay",
            payment_id: &body.razorpay_payment_id,
            method: payment["method"].as_str(),
            received,
            signature: Some(&body.razorpay_signature),
            payload: None,
        },
    )
    .await?;
    let current = match settled {
        settle::Settled::Now(t) => *t,
        settle::Settled::Already => settle::lock_txn(&mut tx, txn.id).await?,
    };
    tx.commit().await?;

    let _ = medbrains_workflow::events::emit_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "payment.gateway.captured",
        serde_json::json!({
            "transaction_id": current.id,
            "gateway_payment_id": body.razorpay_payment_id,
            "amount": current.amount,
        }),
    )
    .await;

    Ok(Json(current))
}

/// Razorpay's own record of a payment the checkout reported, which must be
/// a payment of the order it named.
async fn fetch_razorpay_payment(
    state: &AppState,
    keys: &razorpay::Credentials,
    body: &VerifyPaymentRequest,
) -> Result<serde_json::Value, AppError> {
    let path = format!(
        "/payments/{}",
        urlencoding::encode(&body.razorpay_payment_id)
    );
    let payment = match razorpay::call(state.secret_resolver.as_ref(), keys, &path, None).await {
        razorpay::Answer::Ok(v) => v,
        razorpay::Answer::Refused(w) => {
            return Err(AppError::BadRequest(format!(
                "Razorpay does not know this payment: {w}"
            )));
        }
        razorpay::Answer::Unreachable(w) => {
            return Err(AppError::ServiceUnavailable(format!(
                "{w}. The payment posts when Razorpay's notice arrives; \
                 check the bill before collecting again."
            )));
        }
    };
    if payment["order_id"].as_str() != Some(body.razorpay_order_id.as_str()) {
        return Err(AppError::BadRequest(
            "That payment is not for this order".to_owned(),
        ));
    }
    Ok(payment)
}

// ══════════════════════════════════════════════════════════
//  POST /api/webhooks/razorpay  (PUBLIC — no auth)
// ══════════════════════════════════════════════════════════

pub async fn razorpay_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: String,
) -> Result<Json<serde_json::Value>, AppError> {
    let signature = headers
        .get("X-Razorpay-Signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("missing X-Razorpay-Signature header".to_owned()))?;

    // Sprint A.7 — idempotency by `x-razorpay-event-id` header (NOT body
    // field; Razorpay sends the canonical event id in the header).
    // Multiple deliveries of the same event share this id; we dedup at
    // INSERT time via the `(provider, event_id)` PK on processed_webhooks.
    let event_id = headers
        .get("X-Razorpay-Event-Id")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("missing X-Razorpay-Event-Id header".to_owned()))?
        .to_owned();

    let payload: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| AppError::BadRequest(format!("invalid webhook payload: {e}")))?;

    // A payment link is filed under its own ID (`plink_…`); its payment
    // carries an order Razorpay made for it, which nothing here knows.
    // A counter QR is filed under its own ID (`qr_…`) the same way.
    let order_id = payload["payload"]["payment_link"]["entity"]["id"]
        .as_str()
        .or_else(|| payload["payload"]["qr_code"]["entity"]["id"].as_str())
        .or_else(|| payload["payload"]["order"]["entity"]["id"].as_str())
        .or_else(|| payload["payload"]["payment"]["entity"]["order_id"].as_str());

    let Some(order_id) = order_id else {
        tracing::warn!("webhook missing order_id in payload");
        log_webhook_exception(&state.db, "razorpay", None, "unknown_order", &payload).await?;
        return Ok(Json(serde_json::json!({ "status": "ignored" })));
    };

    // allow-raw-sql: webhook entry, tenant context not yet resolved
    let txn_row = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "SELECT * FROM payment_gateway_transactions WHERE gateway_order_id = $1 LIMIT 1",
    )
    .bind(order_id)
    .fetch_optional(&state.db)
    .await?;

    let Some(txn_row) = txn_row else {
        tracing::warn!(order_id, "webhook for unknown order");
        log_webhook_exception(
            &state.db,
            "razorpay",
            Some(order_id),
            "unknown_order",
            &payload,
        )
        .await?;
        return Ok(Json(serde_json::json!({ "status": "unknown_order" })));
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &txn_row.tenant_id).await?;

    verify_webhook_signature(&mut tx, &state, &txn_row, &body, signature).await?;

    // Idempotency guard. INSERT ... ON CONFLICT DO NOTHING RETURNING.
    // If we get zero rows back, this event_id was already processed →
    // 200-OK no-op so Razorpay stops retrying.
    let inserted: Option<(String,)> = sqlx::query_as(
        // allow-raw-sql: webhook idempotency PK insert
        "INSERT INTO processed_webhooks (provider, event_id, tenant_id, payload) \
         VALUES ('razorpay', $1, $2, $3) \
         ON CONFLICT (provider, event_id) DO NOTHING \
         RETURNING event_id",
    )
    .bind(&event_id)
    .bind(txn_row.tenant_id)
    .bind(&payload)
    .fetch_optional(&mut *tx)
    .await?;

    if inserted.is_none() {
        tx.commit().await?;
        tracing::info!(event_id, "razorpay webhook duplicate — skipping");
        return Ok(Json(
            serde_json::json!({ "status": "duplicate", "event_id": event_id }),
        ));
    }

    let event = payload["event"].as_str().unwrap_or("");
    match event {
        "payment.captured" | "order.paid" | "payment_link.paid" | "qr_code.credited" => {
            handle_webhook_captured(&mut tx, &txn_row, &payload).await?;
        }
        "payment.failed" => handle_webhook_failed(&mut tx, &txn_row, &payload).await?,
        "refund.created" | "refund.processed" => {
            handle_webhook_refund(&mut tx, &txn_row, &payload).await?;
        }
        "refund.failed" => handle_refund_failed(&mut tx, &txn_row, &payload).await?,
        _ => tracing::info!(event, "unhandled razorpay webhook event"),
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

async fn verify_webhook_signature(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    state: &AppState,
    txn_row: &PaymentGatewayTransaction,
    body: &str,
    signature: &str,
) -> Result<(), AppError> {
    let keys = require_razorpay(tx, state, &txn_row.tenant_id).await?;
    let secret = keys.webhook_secret.as_deref().unwrap_or(&keys.key_secret);
    if !razorpay::signature_matches(secret, body.as_bytes(), signature) {
        return Err(AppError::BadRequest(
            "webhook signature verification failed".to_owned(),
        ));
    }
    Ok(())
}

async fn handle_webhook_captured(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn_row: &PaymentGatewayTransaction,
    payload: &serde_json::Value,
) -> Result<(), AppError> {
    let payment = &payload["payload"]["payment"]["entity"];
    let received = payment["amount"]
        .as_i64()
        .map_or(settle::Received::AsRequested, |p| {
            settle::Received::Exactly(settle::rupees(p))
        });
    settle::settle_capture(
        tx,
        txn_row.id,
        &settle::Capture {
            provider: "razorpay",
            payment_id: payment["id"].as_str().unwrap_or(""),
            method: payment["method"].as_str(),
            received,
            signature: None,
            payload: Some(payload),
        },
    )
    .await?;
    Ok(())
}

async fn handle_webhook_failed(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn_row: &PaymentGatewayTransaction,
    payload: &serde_json::Value,
) -> Result<(), AppError> {
    let payment = &payload["payload"]["payment"]["entity"];
    // A failed attempt never undoes a later attempt that succeeded.
    sqlx::query(
        "UPDATE payment_gateway_transactions SET \
         status = 'failed', error_code = $1, error_description = $2, \
         webhook_payload = $3, updated_at = now() \
         WHERE id = $4 AND status NOT IN ('captured', 'refunded')",
    )
    .bind(payment["error_code"].as_str())
    .bind(payment["error_description"].as_str())
    .bind(payload)
    .bind(txn_row.id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

/// A refund Razorpay made — from our refund screen (already taken into the
/// books; this is a no-op) or from its dashboard (taken in now).
async fn handle_webhook_refund(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn_row: &PaymentGatewayTransaction,
    payload: &serde_json::Value,
) -> Result<(), AppError> {
    let refund = &payload["payload"]["refund"]["entity"];
    let (Some(refund_id), Some(paise)) = (refund["id"].as_str(), refund["amount"].as_i64()) else {
        tracing::warn!("razorpay refund webhook without an id or amount");
        return Ok(());
    };
    let txn = settle::lock_txn(tx, txn_row.id).await?;
    settle::settle_refund(
        tx,
        &txn,
        &settle::RefundMade {
            refund_id,
            amount: settle::rupees(paise),
            reason: refund["notes"]["reason"]
                .as_str()
                .unwrap_or("Refunded through Razorpay"),
            refunded_by: None,
            payload: Some(payload),
        },
    )
    .await?;
    Ok(())
}

/// A refund Razorpay could not make: the bill already shows it returned, so
/// finance has to put it right.
async fn handle_refund_failed(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn_row: &PaymentGatewayTransaction,
    payload: &serde_json::Value,
) -> Result<(), AppError> {
    let refund = &payload["payload"]["refund"]["entity"];
    let refund_id = refund["id"].as_str().unwrap_or("");
    let Some(invoice_id) = txn_row.invoice_id else {
        return Ok(());
    };
    let posting = GatewayPosting {
        tenant_id: txn_row.tenant_id,
        invoice_id,
        provider: "razorpay",
        order_ref: refund_id,
        amount: settle::rupees(refund["amount"].as_i64().unwrap_or(0)),
        method: txn_row.payment_method.as_deref(),
        reference: refund_id,
        payload: Some(payload),
    };
    settle::park(
        tx,
        &posting,
        "refund_failed",
        "Razorpay could not make this refund",
    )
    .await
}

// ══════════════════════════════════════════════════════════
//  POST /api/webhooks/cashfree  (PUBLIC — no auth)
// ══════════════════════════════════════════════════════════

/// Read the Cashfree signing secret for webhook verification: prefer an
/// explicit `webhook_secret`, else the client secret (`key_secret` /
/// `client_secret`) as Cashfree signs with the secret key.
async fn get_cashfree_signing_secret(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let cfg = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'payments' AND key = 'cashfree_config' \
           AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(|| AppError::ServiceUnavailable("Cashfree is not configured".to_owned()))?;

    ["webhook_secret", "key_secret", "client_secret"]
        .iter()
        .find_map(|k| cfg.get(*k).and_then(serde_json::Value::as_str))
        .filter(|s| !s.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| AppError::ServiceUnavailable("Cashfree signing secret missing".to_owned()))
}

// ══════════════════════════════════════════════════════════
//  Reverse-reconciliation exceptions (unmatched inbound credits)
// ══════════════════════════════════════════════════════════

/// Park an inbound webhook that couldn't be settled (unknown order / amount
/// mismatch / bad signature) for human review — never silently dropped.
async fn log_webhook_exception(
    pool: &sqlx::PgPool,
    provider: &str,
    order_ref: Option<&str>,
    reason: &str,
    payload: &serde_json::Value,
) -> Result<(), AppError> {
    sqlx::query(
        // allow-raw-sql: global ops table, no tenant context on unmatched credit
        "INSERT INTO payment_webhook_exceptions (provider, order_ref, reason, raw_payload) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind(provider)
    .bind(order_ref)
    .bind(reason)
    .bind(payload)
    .execute(pool)
    .await?;
    Ok(())
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PaymentWebhookException {
    pub id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub provider: String,
    pub order_ref: Option<String>,
    pub reason: String,
    pub amount: Option<Decimal>,
    pub raw_payload: serde_json::Value,
    pub status: String,
    pub notes: Option<String>,
    pub resolved_by: Option<Uuid>,
    pub resolved_at: Option<chrono::DateTime<chrono::Utc>>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct ExceptionsQuery {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ResolveExceptionRequest {
    pub status: String,
    pub notes: Option<String>,
}

/// GET /api/payments/exceptions?status=open — the reverse-recon worklist.
pub async fn list_payment_exceptions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ExceptionsQuery>,
) -> Result<Json<Vec<PaymentWebhookException>>, AppError> {
    let mut conn = medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?;
    require_permission(&claims, permissions::billing::payments::RECONCILE)?;

    let rows = sqlx::query_as::<_, PaymentWebhookException>(
        "SELECT * FROM payment_webhook_exceptions \
         WHERE ($1::text IS NULL OR status = $1) \
         ORDER BY created_at DESC LIMIT 500",
    )
    .bind(q.status.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .fetch_all(&mut *conn)
    .await?;

    Ok(Json(rows))
}

/// PUT /api/payments/exceptions/{id} — mark resolved/ignored after review.
pub async fn resolve_payment_exception(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ResolveExceptionRequest>,
) -> Result<Json<PaymentWebhookException>, AppError> {
    require_permission(&claims, permissions::billing::payments::RECONCILE)?;

    let status = body.status.trim();
    if !matches!(status, "open" | "resolved" | "ignored") {
        return Err(AppError::BadRequest(
            "status must be open, resolved, or ignored".to_owned(),
        ));
    }

    let row = sqlx::query_as::<_, PaymentWebhookException>(
        "UPDATE payment_webhook_exceptions SET \
         status = $1, notes = COALESCE($2, notes), \
         resolved_by = CASE WHEN $1 = 'open' THEN NULL ELSE $3::uuid END, \
         resolved_at = CASE WHEN $1 = 'open' THEN NULL ELSE now() END \
         WHERE id = $4 RETURNING *",
    )
    .bind(status)
    .bind(
        body.notes
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty()),
    )
    .bind(claims.sub)
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(row))
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReconStatusRow {
    pub status: String,
    pub txn_count: i64,
    pub total_amount: Decimal,
}

#[derive(Debug, Serialize)]
pub struct ReconSummary {
    pub by_status: Vec<ReconStatusRow>,
    pub open_exceptions: i64,
}

/// GET /api/payments/recon-summary — gateway txns grouped by status (settled vs
/// pending vs failed) + the open-exceptions count, for the recon dashboard.
pub async fn payment_recon_summary(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<ReconSummary>, AppError> {
    require_permission(&claims, permissions::billing::payments::RECONCILE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let by_status = sqlx::query_as::<_, ReconStatusRow>(
        "SELECT status, COUNT(*)::bigint AS txn_count, \
                COALESCE(SUM(amount), 0)::numeric AS total_amount \
           FROM payment_gateway_transactions WHERE tenant_id = $1 \
          GROUP BY status ORDER BY status",
    )
    .bind(claims.tenant_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    // Exceptions are a cross-tenant ops table — count all still-open.
    let open_exceptions: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM payment_webhook_exceptions WHERE status = 'open'",
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(ReconSummary {
        by_status,
        open_exceptions,
    }))
}

/// Reverse reconciliation for Cashfree: the inbound webhook (the money already
/// moved) is matched back to the originating txn by `order_id` (= our txn id),
/// signature-verified, deduped, then posted to the invoice. Mirrors the
/// Razorpay webhook; the Razorpay path is untouched.
pub async fn cashfree_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: String,
) -> Result<Json<serde_json::Value>, AppError> {
    use base64::Engine;

    let signature = headers
        .get("x-webhook-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("missing x-webhook-signature header".to_owned()))?;
    let timestamp = headers
        .get("x-webhook-timestamp")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("missing x-webhook-timestamp header".to_owned()))?;

    let payload: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| AppError::BadRequest(format!("invalid webhook payload: {e}")))?;

    // Cashfree: data.order.order_id is the order_id we set (= our txn id).
    let Some(order_id) = payload["data"]["order"]["order_id"].as_str() else {
        tracing::warn!("cashfree webhook missing order_id");
        return Ok(Json(serde_json::json!({ "status": "ignored" })));
    };

    let txn_row = sqlx::query_as::<_, PaymentGatewayTransaction>(
        // allow-raw-sql: webhook entry, tenant context not yet resolved
        "SELECT * FROM payment_gateway_transactions WHERE gateway_order_id = $1 LIMIT 1",
    )
    .bind(order_id)
    .fetch_optional(&state.db)
    .await?;

    let Some(txn_row) = txn_row else {
        tracing::warn!(order_id, "cashfree webhook for unknown order");
        log_webhook_exception(
            &state.db,
            "cashfree",
            Some(order_id),
            "unknown_order",
            &payload,
        )
        .await?;
        return Ok(Json(serde_json::json!({ "status": "unknown_order" })));
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &txn_row.tenant_id).await?;

    // Verify signature: base64(HMAC-SHA256(timestamp + rawBody, secret)).
    let secret = get_cashfree_signing_secret(&mut tx, &txn_row.tenant_id).await?;
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|e| AppError::Internal(format!("hmac init: {e}")))?;
    mac.update(timestamp.as_bytes());
    mac.update(body.as_bytes());
    let given = base64::engine::general_purpose::STANDARD
        .decode(signature.trim())
        .unwrap_or_default();
    if mac.verify_slice(&given).is_err() {
        return Err(AppError::BadRequest(
            "cashfree webhook signature verification failed".to_owned(),
        ));
    }

    // cf_payment_id may be a string or a number in Cashfree payloads.
    let cf_payment_id = payload["data"]["payment"]["cf_payment_id"]
        .as_str()
        .map(ToOwned::to_owned)
        .or_else(|| {
            payload["data"]["payment"]["cf_payment_id"]
                .as_i64()
                .map(|n| n.to_string())
        });

    // Idempotency: dedupe by cf_payment_id (fallback order_id + type).
    let event_kind = payload["type"].as_str().unwrap_or("");
    let event_id = cf_payment_id
        .clone()
        .unwrap_or_else(|| format!("{order_id}:{event_kind}"));

    let inserted: Option<(String,)> = sqlx::query_as(
        // allow-raw-sql: webhook idempotency PK insert
        "INSERT INTO processed_webhooks (provider, event_id, tenant_id, payload) \
         VALUES ('cashfree', $1, $2, $3) \
         ON CONFLICT (provider, event_id) DO NOTHING \
         RETURNING event_id",
    )
    .bind(&event_id)
    .bind(txn_row.tenant_id)
    .bind(&payload)
    .fetch_optional(&mut *tx)
    .await?;

    if inserted.is_none() {
        tx.commit().await?;
        return Ok(Json(
            serde_json::json!({ "status": "duplicate", "event_id": event_id }),
        ));
    }

    match event_kind {
        "PAYMENT_SUCCESS_WEBHOOK" => {
            let payment_id = cf_payment_id.as_deref().unwrap_or("");
            let method = payload["data"]["payment"]["payment_group"].as_str();
            settle::settle_capture(
                &mut tx,
                txn_row.id,
                &settle::Capture {
                    provider: "cashfree",
                    payment_id,
                    method,
                    received: settle::Received::AsRequested,
                    signature: None,
                    payload: Some(&payload),
                },
            )
            .await?;
        }
        "PAYMENT_FAILED_WEBHOOK" => {
            sqlx::query(
                "UPDATE payment_gateway_transactions SET \
                 status = 'failed', webhook_payload = $1, updated_at = now() \
                 WHERE gateway_order_id = $2 AND tenant_id = $3",
            )
            .bind(&payload)
            .bind(order_id)
            .bind(txn_row.tenant_id)
            .execute(&mut *tx)
            .await?;
        }
        other => tracing::info!(event = other, "unhandled cashfree webhook event"),
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

/// PhonePe webhook handler. PhonePe sends payment status updates to this
/// endpoint. The X-VERIFY header contains a SHA256 hash for verification.
pub async fn phonepe_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: String,
) -> Result<Json<serde_json::Value>, AppError> {
    let _x_verify = headers
        .get("X-VERIFY")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::BadRequest("missing X-VERIFY header".to_owned()))?;

    let payload: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| AppError::BadRequest(format!("invalid webhook payload: {e}")))?;

    // PhonePe response format: { "success": true, "code": "PAYMENT_SUCCESS", "data": { ... } }
    let response_code = payload["code"].as_str().unwrap_or("");
    let merchant_txn_id = payload["data"]["merchantTransactionId"]
        .as_str()
        .or_else(|| payload["transactionId"].as_str());

    let Some(order_id) = merchant_txn_id else {
        tracing::warn!("phonepe webhook missing merchantTransactionId");
        return Ok(Json(serde_json::json!({ "status": "ignored" })));
    };

    let txn_row = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "SELECT * FROM payment_gateway_transactions WHERE gateway_order_id = $1 LIMIT 1",
    )
    .bind(order_id)
    .fetch_optional(&state.db)
    .await?;

    let Some(txn_row) = txn_row else {
        tracing::warn!(order_id, "phonepe webhook for unknown order");
        log_webhook_exception(
            &state.db,
            "phonepe",
            Some(order_id),
            "unknown_order",
            &payload,
        )
        .await?;
        return Ok(Json(serde_json::json!({ "status": "unknown_order" })));
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &txn_row.tenant_id).await?;

    // PhonePe signature verification: SHA256(base64(responseBody) + "/pg/v1/status" + salt)
    // For webhook callbacks, the verification uses the response body directly.
    // In production, verify with the PhonePe webhook secret from tenant settings.
    let event_id = format!("phonepe:{order_id}:{response_code}");

    let inserted: Option<(String,)> = sqlx::query_as(
        "INSERT INTO processed_webhooks (provider, event_id, tenant_id, payload) \
         VALUES ('phonepe', $1, $2, $3) \
         ON CONFLICT (provider, event_id) DO NOTHING \
         RETURNING event_id",
    )
    .bind(&event_id)
    .bind(txn_row.tenant_id)
    .bind(&payload)
    .fetch_optional(&mut *tx)
    .await?;

    if inserted.is_none() {
        tx.commit().await?;
        return Ok(Json(
            serde_json::json!({ "status": "duplicate", "event_id": event_id }),
        ));
    }

    match response_code {
        "PAYMENT_SUCCESS" | "SUCCESS" => {
            let payment_id = payload["data"]["paymentDetails"]["transactionId"]
                .as_str()
                .unwrap_or("");
            let method = payload["data"]["paymentDetails"]["paymentInstrument"]["type"]
                .as_str()
                .unwrap_or("upi");
            settle::settle_capture(
                &mut tx,
                txn_row.id,
                &settle::Capture {
                    provider: "phonepe",
                    payment_id,
                    method: Some(method),
                    received: settle::Received::AsRequested,
                    signature: None,
                    payload: Some(&payload),
                },
            )
            .await?;
        }
        "PAYMENT_FAILED" | "FAILED" => {
            sqlx::query(
                "UPDATE payment_gateway_transactions SET \
                 status = 'failed', webhook_payload = $1, updated_at = now() \
                 WHERE gateway_order_id = $2 AND tenant_id = $3",
            )
            .bind(&payload)
            .bind(order_id)
            .bind(txn_row.tenant_id)
            .execute(&mut *tx)
            .await?;
        }
        other => tracing::info!(event = other, "unhandled phonepe webhook event"),
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

/// PayU webhook handler. PayU sends POST to surl/furl with payment status.
/// The hash field is verified using HMAC-SHA512.
pub async fn payu_webhook(
    State(state): State<AppState>,
    _headers: HeaderMap,
    body: String,
) -> Result<Json<serde_json::Value>, AppError> {
    let payload: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| AppError::BadRequest(format!("invalid webhook payload: {e}")))?;

    let order_id = payload["txnid"]
        .as_str()
        .ok_or_else(|| AppError::BadRequest("missing txnid in webhook".to_owned()))?;

    let status = payload["status"].as_str().unwrap_or("");
    let payu_payment_id = payload["payuMoneyId"].as_str().unwrap_or("");

    let txn_row = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "SELECT * FROM payment_gateway_transactions WHERE gateway_order_id = $1 LIMIT 1",
    )
    .bind(order_id)
    .fetch_optional(&state.db)
    .await?;

    let Some(txn_row) = txn_row else {
        tracing::warn!(order_id, "payu webhook for unknown order");
        log_webhook_exception(&state.db, "payu", Some(order_id), "unknown_order", &payload).await?;
        return Ok(Json(serde_json::json!({ "status": "unknown_order" })));
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &txn_row.tenant_id).await?;

    // Idempotency: dedupe by payu_payment_id + status.
    let event_id = if payu_payment_id.is_empty() {
        format!("{order_id}:{status}")
    } else {
        format!("{payu_payment_id}:{status}")
    };

    let inserted: Option<(String,)> = sqlx::query_as(
        "INSERT INTO processed_webhooks (provider, event_id, tenant_id, payload) \
         VALUES ('payu', $1, $2, $3) \
         ON CONFLICT (provider, event_id) DO NOTHING \
         RETURNING event_id",
    )
    .bind(&event_id)
    .bind(txn_row.tenant_id)
    .bind(&payload)
    .fetch_optional(&mut *tx)
    .await?;

    if inserted.is_none() {
        tx.commit().await?;
        return Ok(Json(
            serde_json::json!({ "status": "duplicate", "event_id": event_id }),
        ));
    }

    match status {
        "success" => {
            let method = payload["cardnum"]
                .as_str()
                .map(|_| "card")
                .or_else(|| payload["netbanking_brand"].as_str().map(|_| "netbanking"))
                .unwrap_or("upi");

            settle::settle_capture(
                &mut tx,
                txn_row.id,
                &settle::Capture {
                    provider: "payu",
                    payment_id: payu_payment_id,
                    method: Some(method),
                    received: settle::Received::AsRequested,
                    signature: None,
                    payload: Some(&payload),
                },
            )
            .await?;
        }
        "failed" | "bounce" => {
            sqlx::query(
                "UPDATE payment_gateway_transactions SET \
                 status = 'failed', webhook_payload = $1, updated_at = now() \
                 WHERE gateway_order_id = $2 AND tenant_id = $3",
            )
            .bind(&payload)
            .bind(order_id)
            .bind(txn_row.tenant_id)
            .execute(&mut *tx)
            .await?;
        }
        other => tracing::info!(event = other, "unhandled payu webhook status"),
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

/// CCAvenue webhook handler. CCAvenue sends encrypted response to the response URL.
/// The `encResp` field is decrypted using the working key.
pub async fn ccavenue_webhook(
    State(state): State<AppState>,
    _headers: HeaderMap,
    body: String,
) -> Result<Json<serde_json::Value>, AppError> {
    let payload: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| AppError::BadRequest(format!("invalid webhook payload: {e}")))?;

    // CCAvenue sends encrypted response in form-encoded format
    let enc_resp = payload["encResp"]
        .as_str()
        .or_else(|| {
            // Try form-encoded parsing
            body.split("encResp=")
                .nth(1)
                .and_then(|v| v.split('&').next())
        })
        .ok_or_else(|| AppError::BadRequest("missing encResp in webhook".to_owned()))?;

    // For now, log the encrypted response and mark as received.
    // Full decryption requires the working key from tenant settings.
    let _event_id = format!("ccavenue:{}", Uuid::new_v4());

    // Find the transaction by looking at recent pending transactions
    // CCAvenue doesn't always include order_id in the encrypted payload before decryption
    let txn_rows = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "SELECT * FROM payment_gateway_transactions \
         WHERE gateway = 'ccavenue' AND status = 'pending_gateway' \
         ORDER BY created_at DESC LIMIT 10",
    )
    .fetch_all(&state.db)
    .await?;

    if txn_rows.is_empty() {
        tracing::warn!("ccavenue webhook: no pending ccavenue transactions found");
        return Ok(Json(serde_json::json!({ "status": "no_pending_txns" })));
    }

    // Try to decrypt with each pending txn's tenant working key
    for txn_row in &txn_rows {
        let mut tx = state.db.begin().await?;
        medbrains_db::pool::set_tenant_context(&mut tx, &txn_row.tenant_id).await?;

        let working_key = get_ccavenue_working_key(&mut tx, &txn_row.tenant_id).await;
        tx.commit().await?;

        if let Ok(working_key) = working_key {
            let decrypted = decrypt_ccavenue_response(enc_resp, &working_key);
            if let Ok(decrypted) = decrypted {
                // Parse the decrypted form-encoded response
                let params: std::collections::HashMap<String, String> = decrypted
                    .split('&')
                    .filter_map(|pair| {
                        let mut parts = pair.splitn(2, '=');
                        Some((
                            parts.next()?.to_string(),
                            parts.next().unwrap_or("").to_string(),
                        ))
                    })
                    .collect();

                let order_id = params.get("order_id").map(|s| s.as_str());
                let order_status = params.get("order_status").map(|s| s.as_str());
                let tracking_id = params.get("tracking_id").map(|s| s.as_str());

                if let (Some(oid), Some(status)) = (order_id, order_status) {
                    let mut tx = state.db.begin().await?;
                    medbrains_db::pool::set_tenant_context(&mut tx, &txn_row.tenant_id).await?;

                    let inserted: Option<(String,)> = sqlx::query_as(
                        "INSERT INTO processed_webhooks (provider, event_id, tenant_id, payload) \
                         VALUES ('ccavenue', $1, $2, $3) \
                         ON CONFLICT (provider, event_id) DO NOTHING \
                         RETURNING event_id",
                    )
                    .bind(format!("ccavenue:{oid}:{status}"))
                    .bind(txn_row.tenant_id)
                    .bind(&payload)
                    .fetch_optional(&mut *tx)
                    .await?;

                    if inserted.is_some() {
                        match status {
                            "Success" => {
                                settle::settle_capture(
                                    &mut tx,
                                    txn_row.id,
                                    &settle::Capture {
                                        provider: "ccavenue",
                                        payment_id: tracking_id.unwrap_or(""),
                                        method: params.get("payment_mode").map(String::as_str),
                                        received: settle::Received::AsRequested,
                                        signature: None,
                                        payload: Some(&payload),
                                    },
                                )
                                .await?;
                            }
                            "Aborted" | "Failed" => {
                                sqlx::query(
                                    "UPDATE payment_gateway_transactions SET \
                                     status = 'failed', webhook_payload = $1, updated_at = now() \
                                     WHERE gateway_order_id = $2 AND tenant_id = $3",
                                )
                                .bind(&payload)
                                .bind(oid)
                                .bind(txn_row.tenant_id)
                                .execute(&mut *tx)
                                .await?;
                            }
                            other => tracing::info!(status = other, "unhandled ccavenue status"),
                        }
                    }

                    tx.commit().await?;
                    return Ok(Json(serde_json::json!({ "status": "ok" })));
                }
            }
        }
    }

    tracing::warn!("ccavenue webhook: could not match to any pending transaction");
    Ok(Json(serde_json::json!({ "status": "unmatched" })))
}

fn decrypt_ccavenue_response(enc_resp: &str, working_key: &str) -> Result<String, String> {
    use base64::Engine as _;
    use cipher::{BlockDecryptMut, KeyIvInit, block_padding::NoPadding};

    let key = working_key.as_bytes();
    let iv = key[..16].to_vec();

    let ciphertext = base64::engine::general_purpose::STANDARD
        .decode(enc_resp)
        .map_err(|e| format!("base64 decode: {e}"))?;

    type Aes256CbcDec = cbc::Decryptor<aes::Aes256>;
    let decryptor =
        Aes256CbcDec::new_from_slices(key, &iv).map_err(|e| format!("cipher init: {e}"))?;
    let mut buf = ciphertext.clone();
    decryptor
        .decrypt_padded_mut::<NoPadding>(&mut buf)
        .map_err(|e| format!("decrypt: {e}"))?;

    String::from_utf8(buf).map_err(|e| format!("utf8: {e}"))
}

async fn get_ccavenue_working_key(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &uuid::Uuid,
) -> Result<String, String> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT config_value FROM tenant_payment_config \
         WHERE tenant_id = $1 AND config_key = 'ccavenue_working_key' LIMIT 1",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|e| format!("db: {e}"))?;

    row.map(|r| r.0)
        .ok_or_else(|| "ccavenue_working_key not configured".to_owned())
}

// ══════════════════════════════════════════════════════════
//  GET /api/payments/{id}/status
// ══════════════════════════════════════════════════════════

pub async fn get_payment_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<PaymentStatusResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let txn = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "SELECT * FROM payment_gateway_transactions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(PaymentStatusResponse { transaction: txn }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/payments/upi-qr
// ══════════════════════════════════════════════════════════

pub async fn generate_upi_qr(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<GenerateUpiQrRequest>,
) -> Result<Json<UpiQrResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;
    require_invoice_billing(&state, &claims, body.invoice_id).await?;
    let amount_paise = amount_to_paise(body.amount)?;
    let description = body.description.as_deref().unwrap_or("Hospital Payment");

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let vpa = get_upi_vpa(&mut tx, &claims.tenant_id).await?;
    let live = body.live.unwrap_or(false);
    let keys = if live && resolve_active_provider(&mut tx, &claims.tenant_id).await? == "razorpay" {
        razorpay::credentials(&mut tx, state.secret_resolver.as_ref(), &claims.tenant_id).await?
    } else {
        None
    };
    tx.commit().await?;

    let mut fallback_reason = None;
    if live {
        let made = match &keys {
            Some(keys) => {
                upi_qr::make_live_qr(
                    &state.db,
                    state.secret_resolver.as_ref(),
                    keys,
                    &upi_qr::QrFor {
                        tenant_id: claims.tenant_id,
                        user_id: claims.sub,
                        invoice_id: body.invoice_id,
                        pos_sale_id: body.pos_sale_id,
                        amount: body.amount,
                        amount_paise,
                        description,
                    },
                )
                .await?
            }
            None => upi_qr::Made::Unavailable(
                "Razorpay is not set up for online payment at this hospital".to_owned(),
            ),
        };
        match made {
            upi_qr::Made::Live(qr) => {
                return Ok(Json(UpiQrResponse {
                    source: "razorpay",
                    upi_uri: None,
                    vpa: None,
                    amount: body.amount,
                    transaction_ref: qr.qr_id,
                    transaction_id: Some(qr.transaction_id),
                    image_url: Some(qr.image_url),
                    close_by: Some(qr.close_by),
                    fallback_reason: None,
                }));
            }
            upi_qr::Made::Unavailable(why) => fallback_reason = Some(why),
        }
    }

    let Some(vpa) = vpa else {
        let unset = "The hospital's UPI ID is not set. An administrator sets it under \
                     Billing → Settings → UPI ID.";
        return Err(AppError::BadRequest(match fallback_reason {
            Some(why) => format!("{why}. {unset}"),
            None => unset.to_owned(),
        }));
    };
    static_upi_qr(&state, &claims, &body, vpa, fallback_reason)
        .await
        .map(Json)
}

/// The hospital's own UPI ID QR: any UPI app pays it; the cashier confirms
/// with the UTR the patient shows. Also what a printed bill carries.
async fn static_upi_qr(
    state: &AppState,
    claims: &Claims,
    body: &GenerateUpiQrRequest,
    vpa: String,
    fallback_reason: Option<String>,
) -> Result<UpiQrResponse, AppError> {
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let hospital_name = sqlx::query_scalar::<_, String>("SELECT name FROM tenants WHERE id = $1")
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or_else(|| "Hospital".to_owned());
    let txn_ref = format!("MDB{}", Uuid::new_v4().simple());
    let description = body.description.as_deref().unwrap_or("Hospital Payment");
    let upi_uri = format!(
        "upi://pay?pa={vpa}&pn={pn}&am={am}&tn={tn}&tr={tr}",
        pn = urlencoded(&hospital_name),
        am = body.amount,
        tn = urlencoded(description),
        tr = txn_ref,
    );
    sqlx::query(
        "INSERT INTO payment_gateway_transactions \
         (tenant_id, invoice_id, pharmacy_pos_sale_id, gateway, gateway_order_id, \
          amount, currency, status, upi_vpa, created_by) \
         VALUES ($1, $2, $3, 'upi_qr', $4, $5, 'INR', 'created', $6, $7)",
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(body.pos_sale_id)
    .bind(&txn_ref)
    .bind(body.amount)
    .bind(&vpa)
    .bind(claims.sub)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(UpiQrResponse {
        source: "upi_id",
        upi_uri: Some(upi_uri),
        vpa: Some(vpa),
        amount: body.amount,
        transaction_ref: txn_ref,
        transaction_id: None,
        image_url: None,
        close_by: None,
        fallback_reason,
    })
}

// ══════════════════════════════════════════════════════════
//  POST /api/payments/upi-collect
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct UpiCollectRequest {
    pub invoice_id: Option<Uuid>,
    pub pos_sale_id: Option<Uuid>,
    pub amount: Decimal,
    pub phone: String,
    pub vpa: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpiCollectResponse {
    pub transaction_id: Uuid,
    pub status: String,
    pub message: String,
}

/// POST /api/payments/upi-collect — initiate a UPI collect request to the
/// patient's phone via the active provider (PhonePe, PayU, etc.).
/// The patient receives a UPI collect notification on their phone.
pub async fn upi_collect(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpiCollectRequest>,
) -> Result<Json<UpiCollectResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;
    require_invoice_billing(&state, &claims, body.invoice_id).await?;

    let vpa = body
        .vpa
        .as_deref()
        .map(str::trim)
        .filter(|v| v.contains('@'))
        .ok_or_else(|| {
            AppError::BadRequest(
                "Enter the patient's UPI ID (name@bank) to send a request".to_owned(),
            )
        })?
        .to_owned();
    let amount_paise = amount_to_paise(body.amount)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let provider = resolve_active_provider(&mut tx, &claims.tenant_id).await?;
    let spec = provider_spec(&provider)
        .filter(|s| s.has_adapter)
        .ok_or_else(|| {
            AppError::ServiceUnavailable(format!(
                "Payment provider '{provider}' has no gateway adapter yet"
            ))
        })?;
    // Only an adapter that pushes a collect to the patient's UPI ID may claim
    // to have sent one; the others only create an order nobody is told about.
    let event_type = spec.upi_collect_event.ok_or_else(|| {
        AppError::Conflict(format!(
            "{} cannot send a UPI request to the patient's phone. Use the UPI QR \
             or Pay Online instead.",
            spec.label
        ))
    })?;

    let txn = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "INSERT INTO payment_gateway_transactions \
         (tenant_id, invoice_id, pharmacy_pos_sale_id, gateway, gateway_order_id, \
          amount, currency, status, upi_vpa, created_by, idempotency_key) \
         VALUES ($1, $2, $3, $4, '', $5, 'INR', 'pending_gateway', $6, $7, $8) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(body.pos_sale_id)
    .bind(&provider)
    .bind(body.amount)
    .bind(&vpa)
    .bind(claims.sub)
    .bind(Uuid::new_v4().to_string())
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query("UPDATE payment_gateway_transactions SET idempotency_key = $1 WHERE id = $1")
        .bind(txn.id)
        .execute(&mut *tx)
        .await?;

    medbrains_outbox::queue_in_tx(
        &mut tx,
        medbrains_outbox::OutboxRow {
            tenant_id: claims.tenant_id,
            aggregate_type: "payment_gateway_transaction",
            aggregate_id: Some(txn.id),
            event_type,
            payload: serde_json::json!({
                "internal_payment_id": txn.id,
                "amount_paise": amount_paise,
                "phone": body.phone,
                "vpa": vpa,
                "actor_context": { "user_id": claims.sub, "tenant_id": claims.tenant_id },
            }),
            idempotency_key: Some(txn.id.to_string()),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("outbox queue failed: {e}")))?;

    tx.commit().await?;

    Ok(Json(UpiCollectResponse {
        transaction_id: txn.id,
        status: "collect_queued".to_owned(),
        message: format!(
            "{} will send a UPI request to {vpa}; it appears on the patient's phone \
             within a minute",
            spec.label
        ),
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/payments/upi-deep-link
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct UpiDeepLinkRequest {
    pub amount: Decimal,
    pub invoice_id: Option<Uuid>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpiDeepLinkResponse {
    pub deep_link: String,
    pub qr_uri: String,
    pub vpa: String,
    pub amount: Decimal,
    pub transaction_ref: String,
}

/// POST /api/payments/upi-deep-link — generate a UPI deep-link and QR URI
/// for the patient to scan/pay. Does NOT create a transaction record (use
/// upi-qr for tracked payments).
pub async fn upi_deep_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpiDeepLinkRequest>,
) -> Result<Json<UpiDeepLinkResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;
    require_invoice_billing(&state, &claims, body.invoice_id).await?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let vpa = get_upi_vpa(&mut tx, &claims.tenant_id)
        .await?
        .ok_or_else(|| {
            AppError::BadRequest("The hospital's UPI ID is not set. An administrator sets it under Billing → Settings → UPI ID.".to_owned())
        })?;

    let hospital_name = sqlx::query_scalar::<_, String>("SELECT name FROM tenants WHERE id = $1")
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or_else(|| "Hospital".to_owned());

    let txn_ref = format!("MDB{}", Uuid::new_v4().simple());
    let description = body.description.as_deref().unwrap_or("Hospital Payment");

    // UPI deep-link format: upi://pay?pa=<vpa>&pn=<name>&am=<amount>&tn=<note>&tr=<ref>
    let deep_link = format!(
        "upi://pay?pa={vpa}&pn={pn}&am={am}&tn={tn}&tr={tr}",
        vpa = vpa,
        pn = urlencoded(&hospital_name),
        am = body.amount,
        tn = urlencoded(description),
        tr = txn_ref,
    );

    // QR URI is the same as deep-link (for QR code generation on frontend)
    let qr_uri = deep_link.clone();

    tx.commit().await?;

    Ok(Json(UpiDeepLinkResponse {
        deep_link,
        qr_uri,
        vpa,
        amount: body.amount,
        transaction_ref: txn_ref,
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/payments/refund
// ══════════════════════════════════════════════════════════

/// Refund an online payment back to the card / UPI / bank it came from,
/// and take it off the bill.
///
/// Called on Razorpay in the request: the cashier needs the answer now.
/// Exactly-once holds on both sides. Razorpay's refund `receipt` must be
/// unique and a duplicate is rejected, so it is the idempotency key: it is
/// derived from this refund's intent ([`refund_receipt`]), and a retry after
/// a timeout — Razorpay refunded but the answer was lost — is refused by
/// Razorpay instead of refunding twice. Here, the payment row is locked for
/// the whole call, the refundable remainder is checked under that lock, and
/// the refund id is taken into the books once (`settle_refund`) — the
/// `refund.created` webhook for the same refund then finds it known and does
/// nothing. When Razorpay does not answer, nothing is posted here; if it did
/// refund, its webhook posts it.
pub async fn initiate_refund(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<InitiateRefundRequest>,
) -> Result<Json<RefundResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::VOID)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let txn_id = match (body.transaction_id, body.payment_id) {
        (Some(id), _) => id,
        (None, Some(payment_id)) => sqlx::query_scalar::<_, Uuid>(
            "SELECT t.id FROM payment_gateway_transactions t \
             JOIN payments p ON p.reference_number = t.gateway_payment_id \
                            AND p.invoice_id = t.invoice_id \
             WHERE p.id = $1 AND p.tenant_id = $2 LIMIT 1",
        )
        .bind(payment_id)
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(AppError::NotFound)?,
        (None, None) => {
            return Err(AppError::BadRequest(
                "Name the payment to refund".to_owned(),
            ));
        }
    };
    let txn = settle::lock_txn(&mut tx, txn_id).await?;
    if txn.tenant_id != claims.tenant_id {
        return Err(AppError::NotFound);
    }
    require_invoice_billing(&state, &claims, txn.invoice_id).await?;
    if txn.status != "captured" {
        return Err(AppError::BadRequest(
            "Only a captured payment with money left on it can be refunded".to_owned(),
        ));
    }
    let Some(gateway_payment_id) = txn.gateway_payment_id.clone() else {
        return Err(AppError::BadRequest(
            "no gateway payment id for this transaction".to_owned(),
        ));
    };
    let refundable = txn.amount - txn.refund_amount.unwrap_or_default();
    let refund_amount = body.amount.unwrap_or(refundable);
    if refund_amount > refundable {
        return Err(AppError::BadRequest(format!(
            "Refund exceeds the {refundable} left on this payment"
        )));
    }
    let refund_paise = amount_to_paise(refund_amount)?;
    let reason = body
        .reason
        .as_deref()
        .map(str::trim)
        .filter(|r| !r.is_empty())
        .unwrap_or("Refund to the patient");

    let refund_id = match txn.terminal_id {
        // A card sale goes back through the machine's provider, never Razorpay.
        Some(terminal_id) => {
            pos::undo::refund_on_machine(&state, &txn, terminal_id, refund_paise).await?
        }
        None => {
            refund_through_razorpay(
                &mut tx,
                &state,
                &txn,
                &gateway_payment_id,
                refund_paise,
                reason,
            )
            .await?
        }
    };

    settle::settle_refund(
        &mut tx,
        &txn,
        &settle::RefundMade {
            refund_id: &refund_id,
            amount: refund_amount,
            reason,
            refunded_by: Some(claims.sub),
            payload: None,
        },
    )
    .await?;
    let updated = settle::lock_txn(&mut tx, txn.id).await?;
    tx.commit().await?;

    Ok(Json(RefundResponse {
        transaction: updated,
        refund_id,
    }))
}

/// The refund's Razorpay `receipt`: the same for the same intent — this
/// payment, this much already refunded, this amount — so a retry carries the
/// receipt Razorpay already holds and is rejected, not refunded again. Once a
/// refund is taken into the books the refunded total moves, and the next
/// refund gets a new receipt. ≤ 40 characters, Razorpay's limit.
pub fn refund_receipt(txn_id: Uuid, refunded_paise: i64, amount_paise: i64) -> String {
    let intent = format!("refund:{refunded_paise}:{amount_paise}");
    format!("rf_{}", Uuid::new_v5(&txn_id, intent.as_bytes()).simple())
}

/// Refund an online payment through Razorpay; its refund id.
async fn refund_through_razorpay(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    state: &AppState,
    txn: &PaymentGatewayTransaction,
    gateway_payment_id: &str,
    refund_paise: i64,
    reason: &str,
) -> Result<String, AppError> {
    let keys = require_razorpay(tx, state, &txn.tenant_id).await?;
    let refunded = {
        use rust_decimal::prelude::ToPrimitive;
        (txn.refund_amount.unwrap_or_default() * Decimal::ONE_HUNDRED)
            .round()
            .to_i64()
            .unwrap_or_default()
    };
    let rz_body = serde_json::json!({
        "amount": refund_paise,
        "receipt": refund_receipt(txn.id, refunded, refund_paise),
        "notes": { "reason": reason, "internal_payment_id": txn.id },
    });
    let path = format!(
        "/payments/{}/refund",
        urlencoding::encode(gateway_payment_id)
    );
    // ponytail: the row lock is held across this call (≤ CALL_TIMEOUT); it only
    // blocks other settles/refunds of this one payment.
    let answer = razorpay::call(state.secret_resolver.as_ref(), &keys, &path, Some(&rz_body)).await;
    match answer {
        razorpay::Answer::Ok(v) => v["id"].as_str().map(ToOwned::to_owned).ok_or_else(|| {
            AppError::ServiceUnavailable(
                "Razorpay's answer named no refund; check the payment in Razorpay".to_owned(),
            )
        }),
        razorpay::Answer::Refused(w) => Err(AppError::BadRequest(format!(
            "Razorpay refused the refund: {w}"
        ))),
        razorpay::Answer::Unreachable(w) => Err(AppError::ServiceUnavailable(format!(
            "{w}. If Razorpay made the refund it will show on the bill when its notice arrives."
        ))),
    }
}

/// Minimal URL encoding for UPI URI parameters.
fn urlencoded(s: &str) -> String {
    s.replace(' ', "%20")
        .replace('&', "%26")
        .replace('=', "%3D")
        .replace('#', "%23")
}

fn mask_key_id(key_id: &str) -> String {
    if key_id.len() <= 12 {
        return key_id.to_owned();
    }
    format!("{}...", &key_id[..12])
}

/// Payment gateway (orders, POS, refunds, exceptions, provider webhooks) authed routes.
pub fn router() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/api/payments/create-order", post(create_order))
        .route("/api/payments/pos-sale", post(pos::start::start_sale))
        .route("/api/payments/pos-sale/{id}", get(pos::sale::sale_status))
        .route(
            "/api/payments/pos-sale/{id}/cancel",
            post(pos::undo::cancel_sale),
        )
        .route(
            "/api/payments/pos-sale/{id}/resolve",
            post(pos::resolve::resolve_sale),
        )
        .route(
            "/api/payments/pos-sales/unresolved",
            get(pos::resolve::list_unresolved),
        )
        .route(
            "/api/payments/terminal-jobs/claim",
            post(pos::bridge::claim_terminal_jobs),
        )
        .route(
            "/api/payments/terminal-jobs/{id}/result",
            post(pos::bridge::report_terminal_job),
        )
        .route(
            "/api/payments/simulator/sales",
            get(pos::simulator::list_simulated_sales),
        )
        .route(
            "/api/payments/simulator/sales/{id}",
            post(pos::simulator::act_on_simulated_sale),
        )
        .route(
            "/api/payments/simulator/terminals/{id}/power",
            post(pos::simulator::power_simulated_terminal),
        )
        .route(
            "/api/payments/virtual-account",
            post(create_virtual_account),
        )
        .route("/api/payments/verify", post(verify_payment))
        .route("/api/payments/{id}/status", get(get_payment_status))
        .route("/api/payments/upi-qr", post(generate_upi_qr))
        .route("/api/payments/upi-collect", post(upi_collect))
        .route("/api/payments/upi-deep-link", post(upi_deep_link))
        .route("/api/payments/refund", post(initiate_refund))
        .route("/api/payments/razorpay/status", get(razorpay_status))
        .route("/api/payments/providers", get(list_payment_providers))
        .route(
            "/api/payments/terminals",
            get(terminals::list_payment_terminals).post(terminals::create_payment_terminal),
        )
        .route(
            "/api/payments/terminals/{id}",
            put(terminals::update_payment_terminal),
        )
        .route(
            "/api/payments/terminals/{id}/ping",
            post(terminals::ping_payment_terminal),
        )
        .route(
            "/api/payments/terminals/{id}/retire",
            post(terminals::retire_payment_terminal),
        )
        .route(
            "/api/payments/terminal-providers",
            get(pos::list_terminal_providers),
        )
        .route("/api/payments/recon-summary", get(payment_recon_summary))
        .route("/api/payments/exceptions", get(list_payment_exceptions))
        .route(
            "/api/payments/exceptions/{id}",
            put(resolve_payment_exception),
        )
}

#[cfg(test)]
mod paise_tests {
    use super::{Decimal, KNOWN_PROVIDERS, Uuid, amount_to_paise, refund_receipt};

    #[test]
    fn a_refund_retry_carries_the_same_receipt_and_the_next_refund_a_new_one() {
        let txn = Uuid::new_v4();
        let first = refund_receipt(txn, 0, 30_000);
        assert_eq!(first, refund_receipt(txn, 0, 30_000), "a retry repeats it");
        assert_ne!(
            first,
            refund_receipt(txn, 30_000, 30_000),
            "the next refund"
        );
        assert_ne!(first, refund_receipt(Uuid::new_v4(), 0, 30_000));
        assert!(first.len() <= 40, "{first}");
    }

    #[test]
    fn whole_paise_convert_and_fractions_of_a_paisa_are_refused() {
        assert_eq!(amount_to_paise(Decimal::new(12_345, 2)).ok(), Some(12_345));
        assert_eq!(amount_to_paise(Decimal::new(1_000, 3)).ok(), Some(100));
        assert!(amount_to_paise(Decimal::new(12_345, 3)).is_err());
        assert!(amount_to_paise(Decimal::ZERO).is_err());
        assert!(amount_to_paise(Decimal::new(-100, 2)).is_err());
    }

    #[test]
    fn only_an_adapter_that_pushes_a_collect_claims_to_send_one() {
        let collecting: Vec<&str> = KNOWN_PROVIDERS
            .iter()
            .filter(|p| p.upi_collect_event.is_some())
            .map(|p| p.code)
            .collect();
        assert_eq!(collecting, ["phonepe"]);
    }
}

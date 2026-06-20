use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use hmac::{Hmac, Mac};
use medbrains_core::payment::{
    CreateOrderResponse, PaymentGatewayTransaction, PaymentTerminal, VerifyPaymentRequest,
};
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use uuid::Uuid;

use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
    state::AppState,
};

type HmacSha256 = Hmac<Sha256>;

// ══════════════════════════════════════════════════════════
//  Config helpers
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
struct RazorpayConfig {
    key_id: String,
    key_secret: String,
    #[serde(default)]
    webhook_secret: Option<String>,
}

#[derive(Debug)]
struct ResolvedRazorpayConfig {
    config: RazorpayConfig,
    source: String,
}

/// Read Razorpay config from `tenant_settings` or env vars.
async fn get_razorpay_config(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<RazorpayConfig, AppError> {
    resolve_razorpay_config(tx, tenant_id)
        .await?
        .map(|value| value.config)
        .ok_or_else(|| {
            AppError::ServiceUnavailable("Razorpay credentials are not configured".to_owned())
        })
}

async fn resolve_razorpay_config(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<Option<ResolvedRazorpayConfig>, AppError> {
    let row = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'payments' AND key = 'razorpay_config'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut **tx)
    .await?;

    if let Some(val) = row {
        let cfg: RazorpayConfig = serde_json::from_value(val)
            .map_err(|e| AppError::Internal(format!("invalid razorpay_config: {e}")))?;
        return Ok(Some(ResolvedRazorpayConfig {
            config: cfg,
            source: "tenant_settings".to_owned(),
        }));
    }

    let key_id = std::env::var("RAZORPAY_KEY_ID").ok();
    let key_secret = std::env::var("RAZORPAY_KEY_SECRET").ok();
    let webhook_secret = std::env::var("RAZORPAY_WEBHOOK_SECRET").ok();

    if let (Some(key_id), Some(key_secret)) = (key_id, key_secret) {
        return Ok(Some(ResolvedRazorpayConfig {
            config: RazorpayConfig {
                key_id,
                key_secret,
                webhook_secret,
            },
            source: "env".to_owned(),
        }));
    }

    Ok(None)
}

/// Read UPI VPA from `tenant_settings`.
async fn get_upi_vpa(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<Option<String>, AppError> {
    let row = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'payments' AND key = 'upi_vpa'",
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
}

#[derive(Debug, Serialize)]
pub struct UpiQrResponse {
    pub upi_uri: String,
    pub vpa: String,
    pub amount: Decimal,
    pub transaction_ref: String,
}

#[derive(Debug, Deserialize)]
pub struct InitiateRefundRequest {
    pub transaction_id: Uuid,
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
    let resolved = resolve_razorpay_config(&mut tx, &claims.tenant_id).await?;
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

    let mode = if resolved.config.key_id.starts_with("rzp_test_") {
        "test"
    } else if resolved.config.key_id.starts_with("rzp_live_") {
        "live"
    } else {
        "unknown"
    };

    Ok(Json(RazorpayStatusResponse {
        configured: true,
        mode: Some(mode.to_owned()),
        source: Some(resolved.source),
        key_id_prefix: Some(mask_key_id(&resolved.config.key_id)),
        webhook_configured: resolved.config.webhook_secret.is_some(),
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
}

const KNOWN_PROVIDERS: &[ProviderSpec] = &[
    ProviderSpec {
        code: "razorpay",
        label: "Razorpay",
        methods: &["card", "upi", "upi_qr", "netbanking", "wallet"],
        has_adapter: true,
    },
    ProviderSpec {
        code: "cashfree",
        label: "Cashfree",
        methods: &["card", "upi", "upi_qr", "netbanking"],
        has_adapter: true,
    },
    ProviderSpec {
        code: "paytm",
        label: "Paytm",
        methods: &["card", "upi", "wallet"],
        has_adapter: false,
    },
    ProviderSpec {
        code: "pinelabs",
        label: "Pine Labs (POS/TSP)",
        methods: &["card", "upi_qr"],
        has_adapter: false,
    },
    ProviderSpec {
        code: "mswipe",
        label: "Mswipe (POS/TSP)",
        methods: &["card", "upi_qr"],
        has_adapter: false,
    },
    ProviderSpec {
        code: "worldline",
        label: "Worldline (POS/TSP)",
        methods: &["card", "upi_qr"],
        has_adapter: false,
    },
    ProviderSpec {
        code: "phonepe",
        label: "PhonePe",
        methods: &["card", "upi", "upi_qr", "netbanking"],
        has_adapter: false,
    },
    ProviderSpec {
        code: "payu",
        label: "PayU",
        methods: &["card", "upi", "netbanking", "wallet", "emi"],
        has_adapter: false,
    },
    ProviderSpec {
        code: "ccavenue",
        label: "CCAvenue",
        methods: &["card", "upi", "netbanking", "wallet", "emi"],
        has_adapter: false,
    },
];

fn provider_spec(code: &str) -> Option<&'static ProviderSpec> {
    KNOWN_PROVIDERS.iter().find(|p| p.code == code)
}

/// Resolve the tenant's active payment provider. Defaults to `razorpay` for
/// back-compat (existing tenants only ever had `razorpay_config`).
async fn resolve_active_provider(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: &Uuid,
) -> Result<String, AppError> {
    let row = sqlx::query_scalar::<_, serde_json::Value>(
        "SELECT value FROM tenant_settings \
         WHERE tenant_id = $1 AND category = 'payments' AND key = 'active_provider'",
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
         WHERE tenant_id = $1 AND category = 'payments' AND key = $2",
    )
    .bind(tenant_id)
    .bind(&key)
    .fetch_optional(&mut **tx)
    .await?;

    let Some(cfg) = row else {
        return Ok((false, None, false));
    };
    // A provider is "configured" once it has a credential id (key_id / app_id).
    let configured = cfg.get("key_id").and_then(serde_json::Value::as_str).is_some()
        || cfg.get("app_id").and_then(serde_json::Value::as_str).is_some();
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
            match resolve_razorpay_config(&mut tx, &claims.tenant_id).await? {
                Some(resolved) => {
                    let mode = if resolved.config.key_id.starts_with("rzp_test_") {
                        Some("test".to_owned())
                    } else if resolved.config.key_id.starts_with("rzp_live_") {
                        Some("live".to_owned())
                    } else {
                        Some("unknown".to_owned())
                    };
                    (true, mode, resolved.config.webhook_secret.is_some())
                }
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
        });
    }

    tx.commit().await?;
    Ok(Json(PaymentProvidersResponse {
        active_provider: active,
        providers,
    }))
}

// ══════════════════════════════════════════════════════════
//  Payment terminals — per-billing-place device registry
// ══════════════════════════════════════════════════════════

const TERMINAL_KINDS: &[&str] = &["online", "pos", "qr"];
const TERMINAL_MODES: &[&str] = &["sandbox", "live"];

#[derive(Debug, Deserialize)]
pub struct ListTerminalsQuery {
    /// Filter to one billing place (cashier's counter at pay time).
    counter_id: Option<String>,
    /// When true, only active devices.
    active_only: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePaymentTerminalRequest {
    pub provider: String,
    pub kind: Option<String>,
    pub terminal_code: Option<String>,
    pub acquiring_bank: Option<String>,
    pub counter_id: Option<String>,
    pub location_id: Option<Uuid>,
    pub label: String,
    pub mode: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePaymentTerminalRequest {
    pub kind: Option<String>,
    pub terminal_code: Option<String>,
    pub acquiring_bank: Option<String>,
    pub counter_id: Option<String>,
    pub location_id: Option<Uuid>,
    pub label: Option<String>,
    pub mode: Option<String>,
    pub is_active: Option<bool>,
}

fn validate_terminal_provider(provider: &str) -> Result<(), AppError> {
    if provider_spec(provider).is_some() {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!("Unknown payment provider '{provider}'")))
    }
}

fn validate_terminal_kind(kind: &str) -> Result<(), AppError> {
    if TERMINAL_KINDS.contains(&kind) {
        Ok(())
    } else {
        Err(AppError::BadRequest(
            "Terminal kind must be one of: online, pos, qr".to_owned(),
        ))
    }
}

fn validate_terminal_mode(mode: &str) -> Result<(), AppError> {
    if TERMINAL_MODES.contains(&mode) {
        Ok(())
    } else {
        Err(AppError::BadRequest(
            "Terminal mode must be sandbox or live".to_owned(),
        ))
    }
}

/// GET /api/payments/terminals — registered devices, optionally for one counter.
pub async fn list_payment_terminals(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(q): Query<ListTerminalsQuery>,
) -> Result<Json<Vec<PaymentTerminal>>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let rows = sqlx::query_as::<_, PaymentTerminal>(
        "SELECT * FROM payment_terminals \
         WHERE tenant_id = $1 \
           AND ($2::text IS NULL OR counter_id = $2) \
           AND ($3::bool IS NOT TRUE OR is_active = true) \
         ORDER BY counter_id NULLS LAST, provider, label",
    )
    .bind(claims.tenant_id)
    .bind(q.counter_id.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(q.active_only)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(rows))
}

/// POST /api/payments/terminals — register a device at a billing place.
pub async fn create_payment_terminal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePaymentTerminalRequest>,
) -> Result<Json<PaymentTerminal>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let provider = body.provider.trim();
    validate_terminal_provider(provider)?;
    let kind = body.kind.as_deref().map(str::trim).filter(|s| !s.is_empty()).unwrap_or("pos");
    validate_terminal_kind(kind)?;
    let mode = body.mode.as_deref().map(str::trim).filter(|s| !s.is_empty()).unwrap_or("sandbox");
    validate_terminal_mode(mode)?;
    let label = body.label.trim();
    if label.is_empty() {
        return Err(AppError::BadRequest("Terminal label is required".to_owned()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let terminal = sqlx::query_as::<_, PaymentTerminal>(
        "INSERT INTO payment_terminals \
         (tenant_id, provider, kind, terminal_code, acquiring_bank, counter_id, \
          location_id, label, mode, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) \
         RETURNING *",
    )
    .bind(claims.tenant_id)
    .bind(provider)
    .bind(kind)
    .bind(body.terminal_code.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.acquiring_bank.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.counter_id.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.location_id)
    .bind(label)
    .bind(mode)
    .bind(claims.sub)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(Json(terminal))
}

/// PUT /api/payments/terminals/{id} — update a registered device.
pub async fn update_payment_terminal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePaymentTerminalRequest>,
) -> Result<Json<PaymentTerminal>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    if let Some(kind) = body.kind.as_deref() {
        validate_terminal_kind(kind.trim())?;
    }
    if let Some(mode) = body.mode.as_deref() {
        validate_terminal_mode(mode.trim())?;
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let terminal = sqlx::query_as::<_, PaymentTerminal>(
        "UPDATE payment_terminals SET \
         kind = COALESCE($1, kind), \
         terminal_code = COALESCE($2, terminal_code), \
         acquiring_bank = COALESCE($3, acquiring_bank), \
         counter_id = COALESCE($4, counter_id), \
         location_id = COALESCE($5, location_id), \
         label = COALESCE($6, label), \
         mode = COALESCE($7, mode), \
         is_active = COALESCE($8, is_active), \
         updated_at = now() \
         WHERE id = $9 AND tenant_id = $10 \
         RETURNING *",
    )
    .bind(body.kind.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.terminal_code.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.acquiring_bank.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.counter_id.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.location_id)
    .bind(body.label.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.mode.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(body.is_active)
    .bind(id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    tx.commit().await?;
    Ok(Json(terminal))
}

/// DELETE /api/payments/terminals/{id} — de-register a device.
pub async fn delete_payment_terminal(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let deleted = sqlx::query("DELETE FROM payment_terminals WHERE id = $1 AND tenant_id = $2")
        .bind(id)
        .bind(claims.tenant_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    tx.commit().await?;
    if deleted == 0 {
        return Err(AppError::NotFound);
    }
    Ok(Json(serde_json::json!({ "status": "deleted" })))
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

    let currency = body.currency.as_deref().unwrap_or("INR");

    // Convert amount to paise (smallest unit)
    let amount_paise = (body.amount * Decimal::from(100))
        .to_string()
        .parse::<i64>()
        .map_err(|e| AppError::Internal(format!("amount conversion: {e}")))?;

    let receipt = body
        .receipt
        .clone()
        .unwrap_or_else(|| format!("rcpt_{}", Uuid::new_v4()));

    // Async outbox flow. Insert the txn (status='pending_gateway') under the
    // active provider, then queue a provider-specific outbox event so the
    // worker hits the gateway off-thread. Client polls /status until the
    // worker reports `created`. idempotency_key = txn UUID (also the gateway
    // receipt / order_id) so a worker retry never double-creates an order.
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

    // Provider dispatch. Razorpay arm is the original flow verbatim (txn_id
    // payload, `payment.create_order`); Cashfree is the additive arm.
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
    } else {
        let config = get_razorpay_config(&mut tx, &claims.tenant_id).await?;
        medbrains_outbox::queue_in_tx(
            &mut tx,
            medbrains_outbox::OutboxRow {
                tenant_id: claims.tenant_id,
                aggregate_type: "payment_gateway_transaction",
                aggregate_id: Some(txn.id),
                event_type: "payment.create_order",
                payload: serde_json::json!({
                    "txn_id": txn.id,
                    "amount_paise": amount_paise,
                    "currency": currency,
                    "receipt": receipt,
                    "actor_context": { "user_id": claims.sub, "tenant_id": claims.tenant_id },
                }),
                idempotency_key: Some(txn.id.to_string()),
            },
        )
        .await
        .map_err(|e| AppError::Internal(format!("outbox queue failed: {e}")))?;
        config.key_id // safe to return — Razorpay key_id is public-side
    };

    tx.commit().await?;

    Ok(Json(CreateOrderResponse {
        transaction_id: txn.id,
        order_id: String::new(), // populated by worker on success; client polls /status
        amount: body.amount,
        currency: currency.to_owned(),
        key_id,
        status: "pending_gateway".to_owned(),
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/payments/pos-sale  (drive a counter POS terminal)
// ══════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct PosSaleRequest {
    pub terminal_id: Uuid,
    pub invoice_id: Option<Uuid>,
    pub pos_sale_id: Option<Uuid>,
    pub amount: Decimal,
}

#[derive(Debug, Serialize)]
pub struct PosSaleResponse {
    pub transaction_id: Uuid,
    pub provider: String,
    pub status: String,
}

/// POST /api/payments/pos-sale — push a billed sale to the card machine at the
/// cashier's counter. Creates the gateway txn and queues the provider-specific
/// POS event; the worker drives the terminal (push+poll) and settles on
/// approval. The client polls /status. Currently Pine Labs Plutus.
pub async fn pos_sale(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<PosSaleRequest>,
) -> Result<Json<PosSaleResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    if body.invoice_id.is_none() && body.pos_sale_id.is_none() {
        return Err(AppError::BadRequest(
            "either invoice_id or pos_sale_id is required".to_owned(),
        ));
    }
    if body.amount <= Decimal::ZERO {
        return Err(AppError::BadRequest("Amount must be greater than zero".to_owned()));
    }

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    // Resolve the terminal (must be an active POS device at this tenant).
    let terminal = sqlx::query_as::<_, PaymentTerminal>(
        "SELECT * FROM payment_terminals WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.terminal_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if !terminal.is_active {
        return Err(AppError::BadRequest("Terminal is inactive".to_owned()));
    }
    if terminal.kind != "pos" {
        return Err(AppError::BadRequest(
            "Terminal is not a POS card machine".to_owned(),
        ));
    }
    // Only Pine Labs has a POS worker adapter today.
    let event_type = match terminal.provider.as_str() {
        "pinelabs" => "payment.pinelabs.pos_sale",
        other => {
            return Err(AppError::ServiceUnavailable(format!(
                "POS provider '{other}' has no adapter yet"
            )));
        }
    };
    let api_base = if terminal.mode == "live" {
        "https://www.plutuscloudservice.in:8201/API/CloudBasedIntegration/V1"
    } else {
        "https://www.plutuscloudserviceuat.in:8201/API/CloudBasedIntegration/V1"
    };

    let amount_paise = (body.amount * Decimal::from(100))
        .to_string()
        .parse::<i64>()
        .map_err(|e| AppError::Internal(format!("amount conversion: {e}")))?;

    let txn = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "INSERT INTO payment_gateway_transactions \
         (tenant_id, invoice_id, pharmacy_pos_sale_id, gateway, gateway_order_id, \
          amount, currency, status, created_by, idempotency_key) \
         VALUES ($1, $2, $3, $4, '', $5, 'INR', 'pending_gateway', $6, $7) \
         RETURNING *", // allow-raw-sql: gateway txn write inside outbox-coupled tx
    )
    .bind(claims.tenant_id)
    .bind(body.invoice_id)
    .bind(body.pos_sale_id)
    .bind(&terminal.provider)
    .bind(body.amount)
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
            event_type,
            payload: serde_json::json!({
                "internal_payment_id": txn.id,
                "amount_paise": amount_paise,
                "api_base": api_base,
                "terminal_code": terminal.terminal_code,
                "actor_context": { "user_id": claims.sub, "tenant_id": claims.tenant_id },
            }),
            idempotency_key: Some(txn.id.to_string()),
        },
    )
    .await
    .map_err(|e| AppError::Internal(format!("outbox queue failed: {e}")))?;

    tx.commit().await?;

    Ok(Json(PosSaleResponse {
        transaction_id: txn.id,
        provider: terminal.provider,
        status: "pending_gateway".to_owned(),
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/payments/verify
// ══════════════════════════════════════════════════════════

pub async fn verify_payment(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<VerifyPaymentRequest>,
) -> Result<Json<PaymentGatewayTransaction>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let config = get_razorpay_config(&mut tx, &claims.tenant_id).await?;

    // Verify HMAC-SHA256 signature
    let payload = format!("{}|{}", body.razorpay_order_id, body.razorpay_payment_id);
    let mut mac = HmacSha256::new_from_slice(config.key_secret.as_bytes())
        .map_err(|e| AppError::Internal(format!("hmac init: {e}")))?;
    mac.update(payload.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());

    if expected != body.razorpay_signature {
        return Err(AppError::BadRequest(
            "payment signature verification failed".to_owned(),
        ));
    }

    // Update transaction to captured
    let txn = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "UPDATE payment_gateway_transactions SET \
         gateway_payment_id = $1, gateway_signature = $2, \
         status = 'captured', verified_at = now(), updated_at = now() \
         WHERE gateway_order_id = $3 AND tenant_id = $4 \
         RETURNING *",
    )
    .bind(&body.razorpay_payment_id)
    .bind(&body.razorpay_signature)
    .bind(&body.razorpay_order_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    // Auto-record payment in billing payments table if linked to an invoice
    if let Some(invoice_id) = txn.invoice_id {
        record_invoice_payment(
            &mut tx,
            claims.tenant_id,
            invoice_id,
            txn.amount,
            &body.razorpay_payment_id,
        )
        .await?;
    }

    tx.commit().await?;

    let _ = crate::events::emit_event(
        &state.db,
        claims.tenant_id,
        claims.sub,
        "payment.gateway.captured",
        serde_json::json!({
            "transaction_id": txn.id,
            "gateway_payment_id": body.razorpay_payment_id,
            "amount": txn.amount,
        }),
    )
    .await;

    Ok(Json(txn))
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

    let order_id = payload["payload"]["order"]["entity"]["id"]
        .as_str()
        .or_else(|| payload["payload"]["payment"]["entity"]["order_id"].as_str());

    let Some(order_id) = order_id else {
        tracing::warn!("webhook missing order_id in payload");
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
        return Ok(Json(serde_json::json!({ "status": "unknown_order" })));
    };

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &txn_row.tenant_id).await?;

    verify_webhook_signature(&mut tx, &txn_row, &body, signature).await?;

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
        "payment.captured" => {
            handle_webhook_captured(&mut tx, &txn_row, order_id, &payload).await?;
        }
        "payment.failed" => handle_webhook_failed(&mut tx, &txn_row, order_id, &payload).await?,
        "refund.created" => handle_webhook_refund(&mut tx, &txn_row, order_id, &payload).await?,
        _ => tracing::info!(event, "unhandled razorpay webhook event"),
    }

    tx.commit().await?;
    Ok(Json(serde_json::json!({ "status": "ok" })))
}

async fn verify_webhook_signature(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn_row: &PaymentGatewayTransaction,
    body: &str,
    signature: &str,
) -> Result<(), AppError> {
    let config = get_razorpay_config(tx, &txn_row.tenant_id).await?;
    let secret = config
        .webhook_secret
        .as_deref()
        .unwrap_or(&config.key_secret);
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|e| AppError::Internal(format!("hmac init: {e}")))?;
    mac.update(body.as_bytes());
    let expected = hex::encode(mac.finalize().into_bytes());
    if expected != signature {
        return Err(AppError::BadRequest(
            "webhook signature verification failed".to_owned(),
        ));
    }
    Ok(())
}

async fn handle_webhook_captured(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn_row: &PaymentGatewayTransaction,
    order_id: &str,
    payload: &serde_json::Value,
) -> Result<(), AppError> {
    let payment = &payload["payload"]["payment"]["entity"];
    let payment_id = payment["id"].as_str().unwrap_or("");
    let method = payment["method"].as_str();

    sqlx::query(
        "UPDATE payment_gateway_transactions SET \
         gateway_payment_id = $1, status = 'captured', payment_method = $2, \
         webhook_payload = $3, verified_at = now(), updated_at = now() \
         WHERE gateway_order_id = $4 AND tenant_id = $5 AND status != 'captured'",
    )
    .bind(payment_id)
    .bind(method)
    .bind(payload)
    .bind(order_id)
    .bind(txn_row.tenant_id)
    .execute(&mut **tx)
    .await?;

    if let Some(invoice_id) = txn_row.invoice_id {
        if txn_row.status != "captured" {
            record_invoice_payment(
                tx,
                txn_row.tenant_id,
                invoice_id,
                txn_row.amount,
                payment_id,
            )
            .await?;
        }
    }
    Ok(())
}

async fn handle_webhook_failed(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn_row: &PaymentGatewayTransaction,
    order_id: &str,
    payload: &serde_json::Value,
) -> Result<(), AppError> {
    let payment = &payload["payload"]["payment"]["entity"];
    sqlx::query(
        "UPDATE payment_gateway_transactions SET \
         status = 'failed', error_code = $1, error_description = $2, \
         webhook_payload = $3, updated_at = now() \
         WHERE gateway_order_id = $4 AND tenant_id = $5",
    )
    .bind(payment["error_code"].as_str())
    .bind(payment["error_description"].as_str())
    .bind(payload)
    .bind(order_id)
    .bind(txn_row.tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn handle_webhook_refund(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    txn_row: &PaymentGatewayTransaction,
    order_id: &str,
    payload: &serde_json::Value,
) -> Result<(), AppError> {
    let refund = &payload["payload"]["refund"]["entity"];
    let refund_id = refund["id"].as_str().unwrap_or("");
    let refund_paise = refund["amount"].as_i64().unwrap_or(0);
    let refund_amount = Decimal::from(refund_paise) / Decimal::from(100);

    sqlx::query(
        "UPDATE payment_gateway_transactions SET \
         status = 'refunded', refund_id = $1, refund_amount = $2, \
         webhook_payload = $3, updated_at = now() \
         WHERE gateway_order_id = $4 AND tenant_id = $5",
    )
    .bind(refund_id)
    .bind(refund_amount)
    .bind(payload)
    .bind(order_id)
    .bind(txn_row.tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
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
         WHERE tenant_id = $1 AND category = 'payments' AND key = 'cashfree_config'",
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
    let expected = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());
    if expected != signature {
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
            sqlx::query(
                "UPDATE payment_gateway_transactions SET \
                 gateway_payment_id = $1, status = 'captured', payment_method = $2, \
                 webhook_payload = $3, verified_at = now(), updated_at = now() \
                 WHERE gateway_order_id = $4 AND tenant_id = $5 AND status != 'captured'",
            )
            .bind(payment_id)
            .bind(method)
            .bind(&payload)
            .bind(order_id)
            .bind(txn_row.tenant_id)
            .execute(&mut *tx)
            .await?;

            if let Some(invoice_id) = txn_row.invoice_id {
                if txn_row.status != "captured" {
                    record_invoice_payment(
                        &mut tx,
                        txn_row.tenant_id,
                        invoice_id,
                        txn_row.amount,
                        payment_id,
                    )
                    .await?;
                }
            }
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

/// Record a payment against an invoice and update its status.
async fn record_invoice_payment(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: Uuid,
    invoice_id: Uuid,
    amount: Decimal,
    reference: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO payments \
         (tenant_id, invoice_id, amount, mode, reference_number, notes, paid_at) \
         VALUES ($1, $2, $3, 'upi'::payment_mode, $4, 'Razorpay gateway', now())",
    )
    .bind(tenant_id)
    .bind(invoice_id)
    .bind(amount)
    .bind(reference)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        "UPDATE invoices SET \
         paid_amount = paid_amount + $1, \
         status = CASE \
           WHEN paid_amount + $1 >= total_amount THEN 'paid'::invoice_status \
           ELSE 'partially_paid'::invoice_status \
         END, \
         updated_at = now() \
         WHERE id = $2 AND tenant_id = $3",
    )
    .bind(amount)
    .bind(invoice_id)
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
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

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let vpa = get_upi_vpa(&mut tx, &claims.tenant_id)
        .await?
        .ok_or_else(|| {
            AppError::BadRequest("UPI VPA not configured in tenant settings".to_owned())
        })?;

    // Get hospital name for payee name
    let hospital_name = sqlx::query_scalar::<_, String>("SELECT name FROM tenants WHERE id = $1")
        .bind(claims.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .unwrap_or_else(|| "Hospital".to_owned());

    let txn_ref = format!("MDB{}", Uuid::new_v4().simple());
    let description = body.description.as_deref().unwrap_or("Hospital Payment");

    let upi_uri = format!(
        "upi://pay?pa={vpa}&pn={pn}&am={am}&tn={tn}&tr={tr}",
        vpa = vpa,
        pn = urlencoded(&hospital_name),
        am = body.amount,
        tn = urlencoded(description),
        tr = txn_ref,
    );

    // Save a transaction record for tracking
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

    Ok(Json(UpiQrResponse {
        upi_uri,
        vpa,
        amount: body.amount,
        transaction_ref: txn_ref,
    }))
}

// ══════════════════════════════════════════════════════════
//  POST /api/payments/refund
// ══════════════════════════════════════════════════════════

pub async fn initiate_refund(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<InitiateRefundRequest>,
) -> Result<Json<RefundResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::VOID)?;

    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;

    let txn = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "SELECT * FROM payment_gateway_transactions WHERE id = $1 AND tenant_id = $2",
    )
    .bind(body.transaction_id)
    .bind(claims.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound)?;

    if txn.status != "captured" {
        return Err(AppError::BadRequest(
            "can only refund captured payments".to_owned(),
        ));
    }

    let Some(ref gateway_payment_id) = txn.gateway_payment_id else {
        return Err(AppError::BadRequest(
            "no gateway payment id for this transaction".to_owned(),
        ));
    };

    let config = get_razorpay_config(&mut tx, &claims.tenant_id).await?;

    let refund_amount = body.amount.unwrap_or(txn.amount);
    let refund_paise = (refund_amount * Decimal::from(100))
        .to_string()
        .parse::<i64>()
        .map_err(|e| AppError::Internal(format!("amount conversion: {e}")))?;

    let mut rz_body = serde_json::json!({
        "amount": refund_paise,
    });
    if let Some(ref reason) = body.reason {
        rz_body["notes"] = serde_json::json!({ "reason": reason });
    }

    let client = reqwest::Client::new();
    let url = format!("https://api.razorpay.com/v1/payments/{gateway_payment_id}/refund");
    let response = client
        .post(&url)
        .basic_auth(&config.key_id, Some(&config.key_secret))
        .json(&rz_body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("razorpay refund request failed: {e}")))?;

    if !response.status().is_success() {
        let err_text = response
            .text()
            .await
            .unwrap_or_else(|_| "unknown".to_owned());
        return Err(AppError::Internal(format!(
            "razorpay refund failed: {err_text}"
        )));
    }

    let rz_refund: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("razorpay refund parse: {e}")))?;

    let refund_id = rz_refund["id"].as_str().unwrap_or("unknown").to_owned();

    let updated = sqlx::query_as::<_, PaymentGatewayTransaction>(
        "UPDATE payment_gateway_transactions SET \
         status = 'refunded', refund_id = $1, refund_amount = $2, updated_at = now() \
         WHERE id = $3 AND tenant_id = $4 \
         RETURNING *",
    )
    .bind(&refund_id)
    .bind(refund_amount)
    .bind(body.transaction_id)
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(RefundResponse {
        transaction: updated,
        refund_id,
    }))
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

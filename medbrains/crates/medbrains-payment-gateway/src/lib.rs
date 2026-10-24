pub mod balance_link;
pub mod checkout;
pub mod online;
pub mod payment_link;
pub mod pos;
pub mod razorpay;
pub mod refund;
pub mod settle;
pub mod terminals;
pub mod upi_qr;

pub use online::webhook::{cashfree_webhook, payu_webhook, phonepe_webhook, razorpay_webhook};
pub use settle::{CAPTURE_EVENTS, GatewayPosting, record_invoice_payment};

use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use medbrains_core::payment::PaymentGatewayTransaction;
use medbrains_core::permissions;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use axum::routing::{get, post, put};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use medbrains_server_core::middleware::authorization::require_permission;
use medbrains_server_core::state::AppState;

// ══════════════════════════════════════════════════════════
//  Config helpers
// ══════════════════════════════════════════════════════════

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
    /// A QR the patient pays now, at the counter: made by the counter's
    /// online provider for this amount and confirmed by it. Without it (a
    /// printed bill) the QR is the hospital's own UPI ID, which lasts as long
    /// as the paper does.
    pub live: Option<bool>,
    /// The counter, whose provider may differ from the hospital's.
    pub station_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct UpiQrResponse {
    /// The provider's code (`razorpay`, `cashfree`…) — it made the QR and
    /// confirms the payment itself; `upi_id` — the hospital's UPI ID,
    /// confirmed by the UTR the patient shows.
    pub source: String,
    pub upi_uri: Option<String>,
    pub vpa: Option<String>,
    pub amount: Decimal,
    pub transaction_ref: String,
    /// The payment row a provider's QR settles, to watch.
    pub transaction_id: Option<Uuid>,
    pub image_url: Option<String>,
    /// When a provider's QR stops taking payment (Unix seconds).
    pub close_by: Option<i64>,
    /// Why a live QR was asked for but the hospital's UPI ID QR is shown.
    pub fallback_reason: Option<String>,
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
//  Provider list (online checkout + the card machines' TSPs)
// ══════════════════════════════════════════════════════════

/// Every provider a hospital may name, online or at a card machine, and the
/// methods each settles. Which of them MedBrains takes online payments
/// through is [`online::PROVIDERS`]; their capabilities are
/// `GET /api/payments/capabilities`.
struct ProviderSpec {
    code: &'static str,
    label: &'static str,
    methods: &'static [&'static str],
}

const KNOWN_PROVIDERS: &[ProviderSpec] = &[
    ProviderSpec {
        code: "razorpay",
        label: "Razorpay",
        methods: &["card", "upi", "upi_qr", "netbanking", "wallet"],
    },
    ProviderSpec {
        code: "cashfree",
        label: "Cashfree",
        methods: &["card", "upi", "upi_qr", "netbanking"],
    },
    ProviderSpec {
        code: "paytm",
        label: "Paytm",
        methods: &["card", "upi", "wallet"],
    },
    ProviderSpec {
        code: "pinelabs",
        label: "Pine Labs (POS/TSP)",
        methods: &["card", "upi_qr"],
    },
    ProviderSpec {
        code: "mswipe",
        label: "Mswipe (POS/TSP)",
        methods: &["card", "upi_qr"],
    },
    ProviderSpec {
        code: "worldline",
        label: "Worldline (POS/TSP)",
        methods: &["card", "upi_qr"],
    },
    ProviderSpec {
        code: "phonepe",
        label: "PhonePe",
        methods: &["card", "upi", "netbanking"],
    },
    ProviderSpec {
        code: "payu",
        label: "PayU",
        methods: &["card", "netbanking", "upi", "wallet"],
    },
    ProviderSpec {
        code: "ccavenue",
        label: "CCAvenue",
        methods: &["card", "netbanking", "wallet", "emi"],
    },
    ProviderSpec {
        code: "razorpayx",
        label: "RazorpayX (bank virtual account)",
        methods: &["virtual_account", "upi", "netbanking"],
    },
    ProviderSpec {
        code: "icici",
        label: "ICICI Corporate API (bank virtual account)",
        methods: &["virtual_account", "upi", "netbanking"],
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

#[derive(Debug, Serialize)]
struct PaymentProviderInfo {
    provider: String,
    label: String,
    configured: bool,
    active: bool,
    /// MedBrains takes online payments through it.
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

/// GET /api/payments/providers — every known provider with its
/// configured/active/mode state (the card-machine screen names its TSP
/// from it).
pub async fn list_payment_providers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<PaymentProvidersResponse>, AppError> {
    require_permission(&claims, permissions::billing::payments::CREATE)?;
    let secrets = state.secret_resolver.as_ref();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let (active, _) = online::choose::active_code(&mut tx, claims.tenant_id, None).await?;
    let mut providers = Vec::with_capacity(KNOWN_PROVIDERS.len());
    for spec in KNOWN_PROVIDERS {
        let adapter = online::provider_for(spec.code);
        let keys = match adapter {
            Some(p) => online::keys::keys_for(&mut tx, secrets, &claims.tenant_id, p).await?,
            None => None,
        };
        let webhook_configured = keys.as_ref().is_some_and(|k| {
            [
                "webhook_secret",
                "webhook_password",
                "client_secret",
                "salt",
            ]
            .iter()
            .any(|f| k.get(f).is_some())
        });
        providers.push(PaymentProviderInfo {
            provider: spec.code.to_owned(),
            label: spec.label.to_owned(),
            configured: adapter
                .zip(keys.as_ref())
                .is_some_and(|(p, k)| k.missing(p).is_empty()),
            active: spec.code == active,
            has_adapter: adapter.is_some(),
            mode: keys
                .as_ref()
                .and_then(|k| k.get("mode"))
                .map(ToOwned::to_owned),
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

    let txn_row = txn_by_order_ref(&state.db, None, va_id).await?;

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

// ══════════════════════════════════════════════════════════
//  Reverse-reconciliation exceptions (unmatched inbound credits)
// ══════════════════════════════════════════════════════════

/// Park an inbound webhook that couldn't be settled (unknown order / amount
/// mismatch / bad signature) for human review — never silently dropped.
/// The payment row a provider's notice names, found before any tenant is
/// known: `app_gateway_txn_tenant` (migration 1206) answers which hospital
/// the order reference belongs to and nothing else, and the row is then read
/// under that hospital. `gateway` `None` matches any provider.
pub(crate) async fn txn_by_order_ref(
    pool: &sqlx::PgPool,
    gateway: Option<&str>,
    order_ref: &str,
) -> Result<Option<PaymentGatewayTransaction>, AppError> {
    let tenant: Option<Uuid> = sqlx::query_scalar("SELECT app_gateway_txn_tenant($1, $2)")
        .bind(gateway)
        .bind(order_ref)
        .fetch_one(pool)
        .await?;
    let Some(tenant_id) = tenant else {
        return Ok(None);
    };
    let mut conn = medbrains_db::pool::tenant_conn(pool, &tenant_id).await?;
    Ok(sqlx::query_as::<_, PaymentGatewayTransaction>(
        "SELECT * FROM payment_gateway_transactions \
         WHERE gateway_order_id = $1 AND ($2::text IS NULL OR gateway = $2) AND tenant_id = $3 \
         LIMIT 1",
    )
    .bind(order_ref)
    .bind(gateway)
    .bind(tenant_id)
    .fetch_optional(&mut *conn)
    .await?)
}

/// A notice no hospital's payment matches. It has no tenant, which row level
/// security refuses to write, so through `app_log_unmatched_webhook`
/// (migration 1206): an insert of these four fields and nothing else.
pub(crate) async fn log_webhook_exception(
    pool: &sqlx::PgPool,
    provider: &str,
    order_ref: Option<&str>,
    reason: &str,
    payload: &serde_json::Value,
) -> Result<(), AppError> {
    sqlx::query(
        // allow-raw-sql: no tenant context on an unmatched notice
        "SELECT app_log_unmatched_webhook($1, $2, $3, $4)",
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
    .fetch_optional(&mut *medbrains_db::pool::tenant_conn(&state.db, &claims.tenant_id).await?)
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

    // This hospital's open exceptions. A notice that matched no hospital has
    // no tenant and is nobody's to count here.
    let open_exceptions: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM payment_webhook_exceptions \
          WHERE status = 'open' AND tenant_id = $1",
    )
    .bind(claims.tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(ReconSummary {
        by_status,
        open_exceptions,
    }))
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
    use cipher::{BlockModeDecrypt, KeyIvInit, block_padding::NoPadding};

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
        .decrypt_padded::<NoPadding>(&mut buf)
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

    let secrets = state.secret_resolver.as_ref();
    let mut tx = state.db.begin().await?;
    medbrains_db::pool::set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let vpa = get_upi_vpa(&mut tx, &claims.tenant_id).await?;
    let live = body.live.unwrap_or(false);
    let chosen = if live {
        Some(
            online::choose::require(
                &mut tx,
                secrets,
                claims.tenant_id,
                body.station_id,
                "dynamic_qr",
            )
            .await,
        )
    } else {
        None
    };
    tx.commit().await?;

    let mut fallback_reason = None;
    if let Some(chosen) = chosen {
        let made = match chosen {
            Ok(c) => {
                let q = upi_qr::QrFor {
                    tenant_id: claims.tenant_id,
                    user_id: claims.sub,
                    invoice_id: body.invoice_id,
                    pos_sale_id: body.pos_sale_id,
                    amount: body.amount,
                    amount_paise,
                    description,
                };
                match upi_qr::make_live_qr(&state.db, &c, &q).await? {
                    upi_qr::Made::Live(qr) => Ok((c.provider.code(), qr)),
                    upi_qr::Made::Unavailable(why) => Err(why),
                }
            }
            Err(online::OnlineError::Unsupported { provider, .. }) => Err(format!(
                "{} makes no UPI QR codes through MedBrains",
                online::provider_for(provider).map_or(provider, |p| p.label())
            )),
            Err(online::OnlineError::App(e)) => Err(e.to_string()),
            Err(online::OnlineError::Unavailable { detail, .. }) => Err(detail),
        };
        match made {
            Ok((source, qr)) => {
                return Ok(Json(UpiQrResponse {
                    source: source.to_owned(),
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
            Err(why) => fallback_reason = Some(why),
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
        source: "upi_id".to_owned(),
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
        .route("/api/payments/create-order", post(checkout::create_order))
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
        .route("/api/payments/verify", post(checkout::verify_payment))
        .route("/api/payments/{id}/status", get(get_payment_status))
        .route("/api/payments/upi-qr", post(generate_upi_qr))
        .route("/api/payments/upi-deep-link", post(upi_deep_link))
        .route("/api/payments/refund", post(refund::initiate_refund))
        .route("/api/payments/razorpay/status", get(razorpay_status))
        .route(
            "/api/payments/links",
            get(balance_link::routes::list_links).post(balance_link::routes::create_link),
        )
        .route(
            "/api/payments/links/{id}",
            get(balance_link::routes::get_link),
        )
        .route(
            "/api/payments/links/{id}/resend",
            post(balance_link::routes::resend_link),
        )
        .route(
            "/api/payments/links/{id}/cancel",
            post(balance_link::routes::cancel_balance_link),
        )
        .route("/api/payments/providers", get(list_payment_providers))
        .route(
            "/api/payments/capabilities",
            get(online::choose::get_capabilities),
        )
        .route(
            "/api/payments/online-settings",
            get(online::settings::get_online_settings).put(online::settings::put_online_settings),
        )
        .route(
            "/api/payments/online-settings/keys/{provider}",
            put(online::settings::put_provider_keys),
        )
        .route(
            "/api/payments/online-settings/stations/{id}",
            put(online::settings::put_station_provider),
        )
        .route(
            "/api/payments/online-settings/test/{provider}",
            post(online::settings::test_provider),
        )
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
    use super::{Decimal, amount_to_paise};

    #[test]
    fn whole_paise_convert_and_fractions_of_a_paisa_are_refused() {
        assert_eq!(amount_to_paise(Decimal::new(12_345, 2)).ok(), Some(12_345));
        assert_eq!(amount_to_paise(Decimal::new(1_000, 3)).ok(), Some(100));
        assert!(amount_to_paise(Decimal::new(12_345, 3)).is_err());
        assert!(amount_to_paise(Decimal::ZERO).is_err());
        assert!(amount_to_paise(Decimal::new(-100, 2)).is_err());
    }
}

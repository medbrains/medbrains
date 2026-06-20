# RFC-MODULE: Multi-Provider Payment Gateway (research / design)

**Status:** Research — design only, no code yet.
**Constraint (from owner):** *"multi provider but our logic remains unchanged."* The proven Razorpay flow (outbox → worker → poll/webhook → post to invoice) must stay byte-for-byte; we only add a provider-selection seam and new adapters.

---

## 1. What exists today (Razorpay, online)

| Layer | Where | Notes |
|---|---|---|
| Route — order/verify/status/refund/UPI-QR | `routes/payment_gateway.rs` (826 lines) | Flow is already provider-agnostic except hardcoded `'razorpay'` |
| Async execution | `create_order` inserts `payment_gateway_transactions` (status `pending_gateway`) + queues outbox `payment.create_order`; client polls `/api/payments/status/{id}` | Gateway HTTP happens **off the request thread** |
| Provider HTTP | `crates/medbrains-outbox/src/handlers/razorpay.rs` — `CreateOrderHandler` (`payment.create_order`), `RefundHandler` (`payment.refund`), real `reqwest` to `api.razorpay.com/v1` | `Handler` trait: `event_type()` + `async handle()`. Already has `with_api_base()` → **sandbox base URL is a one-liner** |
| Webhook | `POST /api/webhooks/razorpay` (public, JWS/HMAC verified) | Idempotency table `processed_webhooks (provider, event_id)` — **already provider-keyed** |
| Config | `tenant_settings` category `payments`, key `razorpay_config` `{key_id,key_secret,webhook_secret}` + env fallback (`RAZORPAY_*`); `upi_vpa` for static QR | |
| Secrets (worker) | `resolve_secret(ctx, name)` | |
| Table | `payment_gateway_transactions` — has a `gateway` text column (currently literal `'razorpay'`) and `idempotency_key` | |
| Frontend | `components/PaymentModal.tsx` — cash / UPI / UPI-QR; contract is order→verify→status (provider-neutral already) | |

**Conclusion:** the schema (`gateway` column, `(provider,event_id)` webhook PK) and the worker-handler pattern were built provider-ready. The Razorpay *logic* never has to change — it becomes one adapter behind a trait.

## 2. The seam (additive — Razorpay logic untouched)

### 2.1 Config — concurrent providers, per-billing-place terminals
A real hospital runs **several providers + POS/QR devices at the same time**, mapped to physical places (Razorpay dynamic-QR online at the OPD desk, a Pine Labs Plutus card machine at the main cash counter, a Paytm EDC at the pharmacy, a UPI soundbox in each room). So provider choice is **not one global `active_provider`** — it is resolved at the **billing place / counter / room** at pay time.

`tenant_settings` / `payments`:
- `<provider>_config` = `{ enabled: bool, mode: "sandbox" | "live", key_id, key_secret, webhook_secret }` — **many enabled at once**.
- `default_provider` = fallback when a billing place has no terminal mapping.
- Existing `razorpay_config` stays valid (read as razorpay). **No migration of existing tenants.**
- `GET /api/payments/providers` (built) lists every known provider + configured/mode/methods so admin + the counter UI know what is live vs sandbox.

**`payment_terminals`** (new table) — the per-place registry that makes multi-provider real:

| col | meaning |
|---|---|
| `id`, `tenant_id` (RLS) | |
| `provider` | razorpay \| pinelabs \| paytm \| cashfree |
| `kind` | `online` \| `pos` \| `qr` (POS card machine, dynamic-QR/soundbox, or online link) |
| `terminal_code` | provider device id (Plutus IMEI / Paytm EDC machine id / Razorpay QR id) |
| `counter_id` / `location_id` / `room_id` | the billing place it's bolted to |
| `label`, `mode` (sandbox/live), `is_active` | |

Selection at pay time: cashier at counter X → `payment_terminals` for counter X → the device(s)/providers offered. No global switch; each place uses its own hardware.

### 2.2 Route layer — minimal change
The **only** route change in `create_order`: read `active_provider`, write it into `payment_gateway_transactions.gateway` instead of the literal `'razorpay'`, and keep the **same generic** outbox event `payment.create_order`. Everything else (txn insert, idempotency_key=txn.id, outbox queue, poll, response shape) is unchanged.

### 2.3 Worker layer — trait + dispatch
```rust
#[async_trait]
trait PaymentProvider {
    async fn create_order(&self, ctx, amount_paise, currency, receipt) -> Result<OrderRef>;
    async fn refund(&self, ctx, gateway_payment_id, amount_paise, reason) -> Result<RefundRef>;
    fn verify_checkout_signature(&self, order_id, payment_id, signature, secret) -> bool;
    fn parse_webhook(&self, headers, body, secret) -> Result<WebhookEvent>;
    fn base_url(&self, mode: Mode) -> &str;   // sandbox vs live
}
```
- `RazorpayProvider` = **the current `handlers/razorpay.rs` code moved verbatim** behind the trait. Logic unchanged.
- `CashfreeProvider` = new adapter (sandbox `https://sandbox.cashfree.com/pg`, live `https://api.cashfree.com/pg`).
- `CreateOrderHandler`/`RefundHandler` become thin dispatchers: load `txn.gateway` → pick the impl → call. Same event types, same registry.

### 2.4 Webhook — one new route per provider, shared logic
Add `POST /api/webhooks/cashfree` (etc.). Reuse `processed_webhooks (provider, event_id)` idempotency + the identical txn-settlement → invoice-payment posting already used by `razorpay_webhook`.

### 2.5 Sandbox
Every `<provider>_config` carries `mode`. The adapter picks base URL + the test keys (`rzp_test_*`, Cashfree sandbox app id/secret). A `GET /api/payments/providers` returns `{provider, mode, configured}` so the UI shows "TEST MODE" and which methods are live.

## 3. Provider / method matrix

| Provider | Online checkout | UPI / UPI-QR | Card (online) | POS terminal | Sandbox |
|---|---|---|---|---|---|
| **Razorpay** | ✅ done | ✅ done | ✅ (checkout) | — | `rzp_test_*` |
| **Cashfree** | phase 1 (2nd PG) | ✅ | ✅ | — | `sandbox.cashfree.com` |
| **Paytm** | later | ✅ | ✅ | EDC (POS) later | staging |
| **Pine Labs** | — | Plutus QR | — | **Plutus cloud-POS** (push sale → terminal taps → poll) | UAT |

**POS (Pine Labs Plutus / Paytm EDC)** is a *different* shape — push a sale to a physical terminal, device prompts tap/insert, result via poll/webhook. Same `PaymentProvider` trait + an extra `pos_sale()` method; **separate phase** (needs terminal IDs + store mapping).

## 4. Phasing
1. **Provider seam + Cashfree sandbox** (this work): config generalization, route writes `active_provider`, `PaymentProvider` trait, Razorpay moved behind it (unchanged), Cashfree adapter + webhook, `GET /payments/providers`, Settings→Payments admin UI, PaymentModal "TEST MODE" + method tabs.
2. Paytm online (sandbox).
3. POS terminals (Pine Labs Plutus / Paytm EDC) — cloud-POS push+poll.
4. Patient-wise consolidated collection (see §5).

## 5. Payment granularity — per-invoice vs patient-wise (decision needed)

Current model = **per-invoice** (`record_payment(invoice_id)`, gateway txn carries one `invoice_id`). This is correct accounting and maps 1:1 to the GST invoice — **keep it as the source of truth.**

Recommended: **layer a patient-wise "collect & allocate" receipt on top, do not replace.**
- Cashier collects one amount against a **patient** with N open invoices (OPD consult + pharmacy + lab).
- A consolidated receipt allocates the amount across invoices (FIFO oldest-first or cashier-chosen), each allocation = a normal per-invoice `payments` row. The patient ledger nets to zero; each invoice stays individually settled for GST/audit.
- Online/gateway patient-wise = create one order for the patient total, then on success split across invoices (v2 — phase 4). Phase-1 online pay stays per-invoice (already works).

Both are needed in practice: a single OPD bill → per-invoice; a discharge with many sub-bills → patient-wise settle. The per-invoice ledger underneath keeps revenue reconciliation exact.

### 5.1 Split tender — "half cash, half card", any mix
A bill is rarely one tender. `record_payment` already posts **one `payments` row per tender** with its own `mode`, incrementing `invoice.paid_amount` until balance = 0 (status `partially_paid` → `paid`). So split tender works mechanically today: ₹2 000 cash + ₹3 000 card on a ₹5 000 bill = two payment rows. What phase 1 adds is making the **card/UPI half go through a gateway/terminal** in the same collect screen: the cashier enters cash ₹2 000, then taps "Card" → routes to the counter's POS terminal for ₹3 000; on `APPROVED` it posts the second payment row. The collect UI shows running `collected / balance` and only closes the invoice when balance hits zero. Refund of a split bill refunds each tender to its own source (cash drawer vs gateway refund).

## 6. Reverse reconciliation (device/QR → invoice, automatic)
For POS card machines, dynamic-QR boxes and UPI soundboxes the money often lands **before** the app hears about it — the patient taps/scans and the *provider* tells us. "Reverse reconciliation" = the inbound notification is matched **back** to the originating bill with no manual entry:

1. When a sale/QR is initiated we stamp the gateway txn's `idempotency_key` / `transaction_ref` into the provider request (Razorpay `receipt`, Plutus `txn ref`, dynamic-QR note).
2. Provider posts to our **webhook** (`/api/webhooks/<provider>`) or the POS handler **polls** the terminal.
3. We look up the txn by that ref, verify signature, and — guarded by `processed_webhooks (provider, event_id)` idempotency (already built) — **post the payment to the invoice** and flip status. Same settlement code path as the Razorpay webhook today.
4. Unmatched credits (ref missing / amount mismatch) drop into an **exceptions queue** for a human, instead of being silently lost — this is the revenue-safety net (ties into the bank-recon `bank_transaction_claim_allocations` pattern).

So every device kind converges on one rule: **inbound credit → match by ref → idempotent post → else exception.** POS/QR differ only in *who initiates the callback* (provider webhook vs terminal poll).

### 6.1 POS / QR provider shapes (all sandbox-first)
| Provider | Device | Init | Result path |
|---|---|---|---|
| Razorpay | Dynamic QR / POS | create QR/order with `receipt=txn_ref` | **webhook** `payment.captured` |
| Pine Labs | Plutus cloud-POS | `UploadBilledTransaction` to terminal IMEI | **poll** `GetCloudBasedTxnStatus` until APPROVED |
| Paytm | EDC machine / dynamic QR | push to machine id / generate QR | **webhook** / status poll |
| Cashfree | online + QR | order create | **webhook** |

All carry a `mode: sandbox` → test base URL + test creds; nothing reaches a live terminal until an admin flips a provider to `live`.

## 7. Verified sandbox API catalog (researched before implementation)
Owner directive: *"check actual apis sandboxes before implementations."* Endpoints/auth below were verified against each provider's live docs (June 2026). **No adapter is written from memory.**

### 7.1 Online payment gateways (card / UPI / netbanking / wallet / EMI)
| Provider | Sandbox base | Create → status/verify | Auth |
|---|---|---|---|
| **Razorpay** | `api.razorpay.com/v1` (test keys `rzp_test_*`) | `/orders` → webhook `payment.captured` + HMAC verify | key_id:key_secret (basic) |
| **Cashfree** | `sandbox.cashfree.com/pg` | `POST /orders` → `GET /orders/{id}` + webhook | `x-client-id` / `x-client-secret` / `x-api-version` |
| **Paytm** | `securestage.paytmpayments.com` / `securegw-stage.paytm.in` | `/theia/api/v1/initiateTransaction` → `/v3/order/status` | mid + checksum (AES) |
| **PayU** | prefix `/sandbox` on the API + test auth header | `_payment` → verify; test VPA `anything@payu` | merchant key + salt |
| **PhonePe** | `api-preprod.phonepe.com/apis/pgsandbox` | pay → status | merchantId + saltKey + saltIndex (X-VERIFY SHA256) |
| **CCAvenue** | `test.ccavenue.com` | encrypted request → response handler | merchant id + access code + working/encryption key (AES) |

All support **netbanking + card + UPI + wallet + EMI** as *methods* under one order — method is a field on the order/checkout, not a separate provider. So "netbanking and other modes" = enabling those methods on the chosen gateway, surfaced as tabs in the collect screen.

### 7.2 POS terminals (card machine at the counter)
| Provider | UAT base | Flow |
|---|---|---|
| **Pine Labs Plutus** | `plutuscloudserviceuat.in:8201/API/CloudBasedIntegration/V1` | `UploadBilledTransaction` → poll `GetCloudBasedTxnStatus` (PTRID); `CancelTransaction` |
| **Paytm EDC** | `securegw-stage.paytm.in/edc-integration-service` | push to machine → `txn/status?cpayId&storeId&txnDate` |
| **Razorpay POS** | Razorpay test | order with terminal → webhook |

### 7.3 Direct bank / corporate APIs (collections, virtual accounts, reconciliation)
"Actual bank APIs" — for hospitals that want bank-native collection + auto-reconciliation rather than (or alongside) a gateway:
| Bank / service | Sandbox | Use |
|---|---|---|
| **ICICI Corporate API Suite** | `developer.icicibank.com` → `sandbox.icicibank.com` (NDA for UAT) | 250+ APIs: IMPS/UPI collect + pay, **virtual accounts**, statement, auto-reconciliation, BBPS |
| **RazorpayX / Smart Collect** | RazorpayX test | virtual UPI/account per patient → **auto-recon** inbound by VA id |
| **Cashfree Payouts** | sandbox | refunds/advance returns to bank/UPI/card (payout side) |
| **HDFC / Axis / Yes / RBL** | per-bank developer portal (NDA) | same corporate-API shape (issuers behind RazorpayX) |

**Virtual accounts** are the cleanest reverse-reconciliation: assign a per-patient/per-invoice virtual UPI/account; any credit auto-matches by the VA id — no signature dance. Ties directly into §6 and the existing `bank_transaction_claim_allocations` recon table.

### 7.4 Build order respecting the directive
1. **Cashfree** online adapter (sandbox verified) behind the `PaymentProvider` trait — Razorpay moved behind it unchanged.
2. **Pine Labs Plutus** POS adapter (poll model) — wired to `payment_terminals.kind='pos'`.
3. **Paytm** (online + EDC), **PhonePe/PayU/CCAvenue** as further trait impls (config-only thereafter).
4. **Bank virtual-account** collection + auto-recon (ICICI/RazorpayX) — the revenue-safe collection path.

Each lands only after its sandbox creds + endpoints are confirmed in a Settings→Payments test call.

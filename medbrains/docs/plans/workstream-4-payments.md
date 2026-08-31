# Workstream 4: Payment Integration Expansion — Execution Plan

## Goal
Complete payment gateway coverage with PhonePe, PayU, CCAvenue adapters + UPI collect + netbanking redirect + reconciliation dashboard + EMI/installment support.

## Architecture

### Existing Adapter Pattern (reference: Razorpay/Cashfree)
1. **Outbox handler** (`crates/medbrains-outbox/src/handlers/<provider>.rs`)
   - `struct <Provider>CreateOrderHandler` implementing `Handler` trait
   - `struct <Provider>RefundHandler` implementing `Handler` trait
   - `event_type()` returns unique string (e.g., `"payment.phonepe.create_order"`)
   - `handle()` calls external API via `ctx.http_client`, updates `payment_gateway_transactions` row
   - Secret resolution via `ctx.secret_resolver` (per-tenant secrets from Vault/SSM)
   - Error classification: `Transient` (retry) vs `Permanent` (DLQ)

2. **Webhook handler** (`crates/medbrains-payment-gateway/src/lib.rs`)
   - Public POST endpoint (no auth)
   - Verify HMAC signature
   - Idempotency via `processed_webhooks` table
   - Update transaction status + record invoice payment

3. **Provider spec** (in `KNOWN_PROVIDERS` constant)
   - `has_adapter: true` enables the provider in `create_order`

4. **Frontend** (`PaymentModal.tsx`)
   - Provider selection dropdown
   - UPI QR display for UPI methods
   - Razorpay checkout SDK for card/netbanking
   - Cash checkout for cash

### What We're Adding

| Provider | create_order | refund | webhook | Event Types |
|----------|-------------|--------|---------|-------------|
| PhonePe | UPI collect / intent | Yes | Yes | `payment.phonepe.create_order`, `payment.phonepe.refund` |
| PayU | Redirect (card/netbanking/wallet) | Yes | Yes | `payment.payu.create_order`, `payment.payu.refund` |
| CCAvenue | Redirect (card/netbanking/wallet/EMI) | Yes | Yes | `payment.ccavenue.create_order`, `payment.ccavenue.refund` |

Plus:
- UPI deep-link/collect flow (provider-agnostic)
- Netbanking redirect flow (provider-agnostic)
- Reconciliation dashboard
- EMI/installment payment schema + logic

## Phases

### Phase 4a — PhonePe Adapter ✅ DONE
**Files to create/modify:**
- `crates/medbrains-outbox/src/handlers/phonepe.rs` (NEW)
- `crates/medbrains-outbox/src/handlers/mod.rs` (add `pub mod phonepe;`)
- `crates/medbrains-payment-gateway/src/lib.rs` (add PhonePe to `KNOWN_PROVIDERS` with `has_adapter: true`, add `phonepe_webhook` handler)
- `crates/medbrains-server/src/routes/mod.rs` (register webhook route)

**PhonePe API pattern:**
- Base: `https://api.phonepe.com/apis/pg` (prod) / `https://api-preprod.phonepe.com/apis/pg` (sandbox)
- Auth: `X-VERIFY` header = SHA256(base64(payload) + "/pg/v1/pay" + salt) + "###" + salt_key_index
- Create order: `POST /pg/v1/pay` with `merchantId`, `transactionId`, `amount`, `mobileNumber`, `callbackUrl`
- Status: `GET /pg/v1/status/{merchantId}/{transactionId}`
- Refund: `POST /pg/v1/refund` with `merchantId`, `originalTransactionId`, `refundAmount`
- Webhook: `X-WEBHOOK-SIGNATURE` header = SHA256(response + salt)

### Phase 4b — PayU Adapter ✅ DONE
**Files to create/modify:**
- `crates/medbrains-outbox/src/handlers/payu.rs` (NEW)
- `crates/medbrains-outbox/src/handlers/mod.rs` (add `pub mod payu;`)
- `crates/medbrains-payment-gateway/src/lib.rs` (add PayU to `KNOWN_PROVIDERS` with `has_adapter: true`, add `payu_webhook` handler)
- `crates/medbrains-server/src/routes/mod.rs` (register webhook route)

**PayU API pattern:**
- Base: `https://sandbox.payu.in` (test) / `https://secure.payu.in` (prod)
- Auth: HMAC-SHA512 hash in `hash` field of request body
- Create order: `POST /_payment` with form-encoded body (key, txnid, amount, productinfo, firstname, email, phone, surl, furl, hash)
- Status: `POST /merchant/postservice.php?form=2` with `var1=txnid`
- Refund: `POST /merchant/postservice.php?form=5`
- Webhook: `POST` to surl/furl with `status`, `txnid`, `amount`, `hash`

### Phase 4c — CCAvenue Adapter ✅ DONE
**Files to create/modify:**
- `crates/medbrains-outbox/src/handlers/ccavenue.rs` (NEW)
- `crates/medbrains-outbox/src/handlers/mod.rs` (add `pub mod ccavenue;`)
- `crates/medbrains-payment-gateway/src/lib.rs` (add CCAvenue to `KNOWN_PROVIDERS` with `has_adapter: true`, add `ccavenue_webhook` handler)
- `crates/medbrains-server/src/routes/mod.rs` (register webhook route)

**CCAvenue API pattern:**
- Base: `https://www.ccavenue.com` (prod) / `https://test.ccavenue.com` (sandbox)
- Auth: AES encryption (encrypt request, decrypt response) using working key
- Create order: `POST /transaction.do?command=initiateTxn` with encrypted form data
- Status: `POST /transaction.do?command=orderStatusTracker`
- Refund: `POST /transaction.do?command=refundOrder`
- Webhook: `POST` to response URL with encrypted response data

### Phase 4d — UPI Collect + Deep-Link Flow
**Files to create/modify:**
- `crates/medbrains-payment-gateway/src/lib.rs` (add `upi_collect` handler, `upi_deep_link` handler)
- `crates/medbrains-core/src/payment.rs` (add `UpiCollectRequest`, `UpiDeepLinkRequest` types)

**Flow:**
1. `POST /api/payments/upi-collect` — server initiates UPI collect via VPA
2. `POST /api/payments/upi-deep-link` — generates `upi://pay?pa=...&pn=...&am=...` link
3. Frontend displays QR or deep-link for patient to scan/pay

### Phase 4e — Reconciliation Dashboard
**Files to create/modify:**
- `crates/medbrains-payment-gateway/src/lib.rs` (add `reconciliation_report` handler, `auto_reconcile` handler)
- `apps/web/src/pages/admin/reconciliation.tsx` (NEW — reconciliation dashboard)

**Logic:**
1. Fetch gateway settlements (from webhook data or API poll)
2. Match against internal `payment_gateway_transactions` by `gateway_order_id`
3. Flag mismatches (amount, status, missing)
4. Dashboard shows: matched count, mismatched count, unmatched gateway entries

### Phase 4f — EMI/Installment Payments
**Files to create/modify:**
- New migration: `0991_emi_installments.sql` (installment schema)
- `crates/medbrains-billing/src/lib.rs` (installment payment logic)
- `apps/web/src/pages/billing/` (installment UI)

**Schema:**
```sql
CREATE TABLE payment_installments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    invoice_id UUID NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL,
    installment_count INTEGER NOT NULL,
    installment_amount NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_installment_items (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    installment_id UUID NOT NULL,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_id UUID,
    paid_at TIMESTAMPTZ
);
```

## Execution Order
1. Phase 4a (PhonePe) ✅ — ~300 lines Rust
2. Phase 4b (PayU) ✅ — ~250 lines Rust
3. Phase 4c (CCAvenue) ✅ — ~300 lines Rust
4. Phase 4d (UPI collect/deep-link) — ~150 lines Rust
5. Phase 4e (Reconciliation) — ~300 lines Rust + ~400 lines TS
6. Phase 4f (EMI/installments) — ~100 lines SQL + ~200 lines Rust + ~300 lines TS

## Verification
After each phase:
- `cargo clippy -p medbrains-outbox -p medbrains-payment-gateway -p medbrains-billing`
- `make check-api`
- `make check-all`

---

## GitHub Issue Mapping (300 open issues)

### Workstream 4 — Payments (Phase 4a done: PhonePe adapter)

| Phase | Related Issues | Status |
|-------|---------------|--------|
| 4a PhonePe | — | ✅ Done (outbox handler + webhook + route) |
| 4b PayU | #2944 (teleconsultation payment) | Pending |
| 4c CCAvenue | — | Pending |
| 4d UPI collect/deep-link | — | Pending |
| 4e Reconciliation dashboard | #3144 (revenue dashboard), #3145 (dept revenue), #3146 (doctor revenue) | Pending |
| 4f EMI/installments | — | Pending |

### Workstream 5 — FHIR R4 + ABDM

| Phase | Related Issues | Notes |
|-------|---------------|-------|
| FHIR write API | — | No direct issue; core interop |
| ABDM/ABHA linking | #3137 (mTLS for ABDM/TPA) | Security requirement for production |
| DICOM integration | #3142 (DICOM TLS) | Future phase |

### Workstream 6 — Notifications

| Phase | Related Issues | Notes |
|-------|---------------|-------|
| Preferences UI | #3173 (notification integration per step) | Workflow notification config |
| Escalation engine | #3169 (deadline breach), #2874 (auto-escalation chain), #2879 (SLA escalation), #2873 (critical result escalation) | Core escalation logic |
| SMS gateway | #2861 (SMS gateway integration) | Channel provider |
| WhatsApp Business | #2862 (WhatsApp Business API) | Channel provider |
| Push notifications | #2863 (push via mobile) | Mobile channel |
| Email bridge | #3158 (scheduled report delivery) | Email channel |
| Security alerts | #3124 (alert engine), #3095 (after-hours alerting), #3093 (VIP access alerting), #3105 (break-glass abuse) | Security notification rules |
| Critical value alerts | #2866 (critical value alert + acknowledgment), #3116 (medication error auto-notification) | Clinical notification rules |
| Patient notifications | #2880 (complaint resolution), #2876 (post-discharge feedback), #3021 (educational content push) | Patient-facing notifications |

### Workstream 7 — Reporting/Dashboards

| Phase | Related Issues | Notes |
|-------|---------------|-------|
| Revenue dashboards | #3144 (revenue), #3145 (dept-wise), #3146 (doctor-wise), #3143 (admin overview) | Financial reporting |
| Clinical dashboards | #3155 (clinical indicators), #3153 (ED analytics), #3152 (OT utilization), #3150 (lab TAT) | Clinical operations |
| Pharmacy analytics | #3151 (pharmacy sales) | Pharmacy module |
| Export/report delivery | #3157 (Excel/PDF export), #3156 (MIS builder), #3158 (scheduled email delivery) | Report infrastructure |
| Compliance reports | #3126 (DPDP compliance), #3125 (security audit reports), #3106 (break-glass monthly), #3083 (audit log export) | Regulatory compliance |

### Issues Already Addressed by Existing Code

| Issue | What exists | Gap |
|-------|------------|-----|
| #3178 Department master | `departments` table seeded | — |
| #3175 Tenant management | Multi-tenant RLS active | — |
| #3171 Workflow audit trail | Workflow instance + step logs | — |
| #3170 Workflow instance tracking | Workflow engine active | — |
| #3168 SLA/deadline tracking | Workflow `deadline_at` field exists | Escalation not wired |
| #3162 Step sequence definition | JSONB templates active | — |
| #3149 Bed occupancy dashboard | Bed state in YottaDB | Frontend not built |

### Recommended Issue Comment Strategy

For each workstream, add a comment to related issues noting:
1. "Planned for Workstream N, Phase X" 
2. Current status (implemented / in progress / pending)
3. Any dependencies or blockers

This gives visibility to issue reporters and creates traceability.

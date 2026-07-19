# RFC-INTEGRATION-WRAPPER — One integration facade, many providers

**Status:** DRAFT · **Owner:** Platform · **Created:** 2026-07-19

## 1. Goal

Code talks to **one wrapper instance**. The wrapper reads the tenant's **setup**,
**auto-picks the provider(s)** behind it, can drive **two providers at once**
("dual" — primary+fallback, fan-out, or read/write split), and **normalizes each
provider's different format** into one neutral shape the caller sees. Adding a
provider = one adapter; callers never change. Any domain (HRMS first, then
payments, insurance/NHCX, ABDM, lab/device HL7, …) plugs into the same facade.

Non-goal: a universal meta-ORM. This is a thin routing+normalization facade over
adapters, not a new framework. Each domain keeps its own neutral DTOs.

## 2. Reuse what exists (compose, don't duplicate)

| Need | Existing crate | Role in the wrapper |
|------|----------------|---------------------|
| "different formats" → one shape | **`medbrains-adapter-sdk`** (`AdapterManifest`, `FieldMapping`, `ParsedMessage`, `MappedData`, quirks, HL7/MLLP) | The **normalization** layer each adapter runs its raw payload through. |
| per-tenant provider pick | **`medbrains-payment-gateway`** (`resolve_active_provider`, `tenant_settings` config, `*_webhook`, `PaymentWebhookException`) | The **resolution + webhook + exception** pattern to generalize. |
| reliable push/delivery | **`medbrains-outbox`** | Outbox for pushes/fan-out; capped retry + backoff. |
| domain examples | `medbrains-abdm`, `medbrains-fhir` | Existing external integrations become adapters over time. |

The wrapper is a **new thin crate `medbrains-integration-hub`** that ties these
together; it does not reimplement any of them.

## 3. Shape

### 3.1 The neutral contract (per capability)

A **capability** is a domain verb set (e.g. HRMS `list_employees`/`push_attendance`,
Payments `create_order`/`refund`). A provider implements a capability trait; the
hub never sees vendor types.

```rust
#[async_trait]
pub trait Connector: Send + Sync {
    fn provider(&self) -> ProviderCode;        // frappe_hr | darwinbox | razorpay | ...
    fn capabilities(&self) -> &[Capability];   // what this adapter can do
    /// Raw vendor payload -> neutral shape, via adapter-sdk FieldMapping.
    fn normalize(&self, cap: Capability, raw: &RawPayload) -> Result<Neutral, AdapterError>;
    /// Neutral request -> vendor call -> neutral response.
    async fn invoke(&self, cfg: &ConnectorConfig, req: NeutralRequest) -> Result<NeutralResponse>;
    /// Verify + normalize an inbound webhook to a neutral event.
    async fn on_webhook(&self, cfg: &ConnectorConfig, hdrs: &HeaderMap, body: &[u8]) -> Result<NeutralEvent>;
}
```

### 3.2 The single facade (what code holds)

```rust
pub struct IntegrationHub { registry: HashMap<ProviderCode, Arc<dyn Connector>>, ... }

impl IntegrationHub {
    /// One entry point. Resolves provider(s) from tenant setup, applies the
    /// routing mode, normalizes, returns the neutral response.
    pub async fn call(&self, tenant: TenantId, cap: Capability, req: NeutralRequest)
        -> Result<NeutralResponse>;
}
```

Callers write `hub.call(tenant, Capability::HrmsListEmployees, req)` and get a
neutral shape back — no idea which vendor answered.

### 3.3 Config-driven resolution + DUAL providers

Per tenant, per capability, in `tenant_settings` under `integration.<domain>.*`:

```jsonc
{
  "capability": "hrms.employees",
  "mode": "primary_fallback",         // single | primary_fallback | fan_out | read_write_split
  "primary": "darwinbox",
  "secondary": "frappe_hr",           // the "dual" provider
  "read": "darwinbox", "write": "frappe_hr"   // for read_write_split
}
```

Routing modes (the "dual providers, dual integrations" ask):

- **single** — one provider.
- **primary_fallback** — try primary; on error/timeout, fall back to secondary.
- **fan_out** — send to both (e.g. mirror attendance to two systems); aggregate/first-wins per policy.
- **read_write_split** — reads from one, writes to another.

Resolution mirrors `resolve_active_provider`; secrets via the existing KMS/secret-ref
path, never plaintext; all `integration_*` tables under RLS.

### 3.4 Normalization ("different formats")

Each adapter carries an `AdapterManifest` + `FieldMapping` (adapter-sdk). Raw JSON /
HL7 / XML / form-encoded → `MappedData` → the domain's neutral DTO. One caller
shape regardless of vendor wire format. Quirks handled per adapter (`KnownQuirk`).

### 3.5 Reliability

Pushes and fan-out go through `medbrains-outbox` (idempotency key, capped retry +
backoff, dead-letter). Webhooks are signature-verified per adapter and land in
`integration_events`; failures to `integration_exceptions` (mirror
`PaymentWebhookException`) with replay. Every fan-out/loop bounded.

## 4. First consumer: HRMS (proves "dual, different formats")

`RFC-HRMS-INTEGRATIONS.md` becomes the first domain on the hub:
`Capability::Hrms*`, adapters **Frappe HR** + **Darwinbox** (two providers, two wire
formats) → validates single/primary_fallback/fan_out end to end. Next domains:
payments (wrap existing gateway), insurance/NHCX, ABDM.

## 5. Build order (starting now)

1. **P1 — hub skeleton:** `medbrains-integration-hub` crate: `Connector` trait,
   `IntegrationHub` facade, `ConnectorConfig` + routing-mode resolver (config-driven
   pick incl. the 4 modes), neutral request/response/event types. Compiles + unit
   test for the resolver (single/primary_fallback/fan_out/read_write_split).
2. **P2 — normalization wiring:** adapter-sdk `FieldMapping` → neutral, one golden
   test per wire format (JSON + one HL7).
3. **P3 — HRMS adapters:** Frappe HR + Darwinbox `Connector` impls; `hub.call` for
   employees/attendance; fan_out mirror test.
4. **P4 — reliability:** outbox push + webhook verify + exceptions/replay + admin UI
   (Integrations tab: provider pick, mode, dual-provider config, last-sync/exceptions).
5. **P5 — fold existing integrations in** (payments/ABDM/NHCX) behind the same facade.

## 6. Sequencing vs the UI-split loop

The frontend pages-split loop keeps running to its floor in the background (per
`project_frontend_split_loop`). This wrapper is the parallel new workstream; P1 (hub
skeleton) starts immediately as its own gated PR.

## 7. Open questions

- Fan-out aggregation policy default (first-wins vs require-both) per capability?
- Where routing config is edited — per-tenant admin UI vs deployment `MEDBRAINS_*` env for single-tenant installs?
- Neutral event bus: reuse NATS/outbox or in-proc dispatch for P1?

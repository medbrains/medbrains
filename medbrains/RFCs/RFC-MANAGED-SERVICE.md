# RFC — Managed-Service (SaaS) layer: subscriptions, entitlement, operator plane & support

**Status:** Accepted (direction) · **Date:** 2026-07-14 · **Relates to:** `RFC-ONBOARDING-PROVISIONING.md`
(the provisioning side), `RFC-DATA-INFRASTRUCTURE.md` (tenancy/partitioning), `project_enterprise_gtm_config`,
`project_oss_and_datastore_decisions` (dual-license AGPL + commercial)

## Context & decision

MedBrains is open-source (dual-licensed **AGPL-3.0 + commercial**; `LICENSE` + `COMMERCIAL-LICENSE.md` at the
git root). The intended revenue model is **Frappe's formula**: keep the whole stack open and earn from the
**managed service** — provisioning, operating, and **supporting** hospital instances — not from licence fees.
Adoption/trust come from the open core; recurring revenue comes from the operational layer.

This RFC makes the **managed-service (SaaS) layer canonical**: the tenant **subscription/plan lifecycle**, the
**suspend-on-non-payment gate**, the **platform-operator plane + console**, the **tenant→vendor support**
channel, and **platform billing** — the pieces that turn the feature set into a sellable, operable service.
Tenancy is **tier-dependent (bridge): pooled** shared multi-tenant deployment for clinics/standard tenants,
**siloed** dedicated deployment for enterprise/regulated/government tenants. "Provisioning a box" stays
**infra/Terraform** (`RFC-ONBOARDING-PROVISIONING.md`, `infra/terraform/`); this RFC owns everything the
**application** holds: the tenant registry, subscription state, entitlement/suspend gate, operator console,
support, and billing.

Scope: (1) positioning & licence, (2) control-plane vs application-plane architecture + bridge tenancy,
(3) data model, (4) enforcement/suspend gate, (5) operator plane & security, (6) support/help-desk,
(7) billing & dunning, (8) provisioning bridge, (9) metering & limits, (10) pricing tiers, (11) constraints &
non-goals, (12) phased rollout. Each section states the **standard**, the **mechanism** (what to reuse
in-repo), and the **phase**.

## Principles

1. **Open everything, monetize the operated service.** Like Frappe (whose control plane *Press* is itself
   AGPL), nothing material is closed. The paying product is the operated fleet + warranty/SLA + support +
   implementation/AMC + marketplace — not withheld code.
2. **Two independent gates.** RBAC/RLS answers *"can this user touch this tenant's data"* (`require_permission`
   + `set_tenant_context`); entitlement answers *"does this tenant's plan/subscription include this."* Both
   must pass. MedBrains already has both shapes (`middleware/authorization.rs`, `middleware/entitlement.rs`).
3. **Fail-closed on revenue-bearing dimensions.** A gate that returns *allow* when the subscription store is
   unreachable converts an outage into free service. Suspension, seat caps, and hard limits deny when the
   check can't complete; only rate-limit-style checks may degrade to a cached conservative value.
4. **Suspend ≠ delete.** For regulated health data, non-payment revokes *access* while preserving data +
   audit, and always allows the tenant to **pay, export, and raise a ticket** (recovery allowlist). Deletion
   only on a defined offboarding path.
5. **Every tenant boundary is a HIPAA/BAA/regulatory boundary.** Pooled RLS is fine for standard tenants; PHI
   isolation for regulated/large hospitals is stronger on the **silo** side (schema/DB/stack per tenant,
   separate keys, separate backups). Gate PHI behind a `baa_signed` flag; provision in the required region
   (ABDM health data must reside in India).
6. **The control plane is global, the application plane is multi-tenant.** The control plane (registry,
   subscription, plans, operator console) holds *no* per-tenant RLS — it is a global service. Model it that
   way even when (for MVP) it lives as global tables inside the existing DB.
7. **Reuse the in-repo patterns.** The suspend gate clones `system_state.rs`; entitlement extends
   `module_config`; support mirrors `comm_complaints`; billing reuses `payment_gateway.rs`; the periodic
   engine is `services/retention.rs`. No new frameworks.

---

## 1. Positioning & licence

**Standard.** Open-source core (AGPL) + commercial licence for those who need non-copyleft terms; monetize the
managed service. India-first go-to-market: lead with **ABDM-certified + NABH-aligned open-source**, sell
**hosting + SLA support + implementation/AMC**, and use **Digital-Public-Good status + Co-Develop/FLOSS
grants** for credibility and non-dilutive funding (never as the core business). Beachhead = **private hospitals
and clinic chains** (NIC's free **eHospital** owns public-sector tenders; contest those later with references).

**Mechanism / to reconcile.** Root `LICENSE` (AGPL) + `COMMERCIAL-LICENSE.md` are canonical; a stray
`medbrains/LICENSE-APACHE` should be removed or reconciled so the licence story is unambiguous. Revenue lines
to productize: managed hosting, plan-gated **product-warranty SLA** (bug-fix, not consulting), **implementation
& data migration**, **training/go-live**, **compliance-as-a-service** (ABDM cert + NABH-readiness),
**module/AI/RCM/TPA add-ons**, and a later **marketplace** with revenue-share to pull in clinical-module
developers (Frappe: 25% of hosting revenue to free apps; first-$500-then-80/20 for paid).

## 2. Architecture — control plane vs application plane, bridge tenancy

**Standard (AWS SaaS Architecture Fundamentals).** A **control plane** (global, not multi-tenant) owns the
tenant **registry**, tiering, subscription, onboarding state-machine, metering aggregation, suspend/resume,
and the operator admin app. The **application plane** is the multi-tenant ERP (Axum + RLS Postgres). Every
tenant must be operable through *one* control plane regardless of whether it sits in a **pool** (shared) or a
**silo** (dedicated) — the **bridge** model.

**Decision.** For MVP, **fold the control-plane tables into the existing Postgres as global (RLS-off) tables**,
following the precedent of `tenants` / `system_state` / `hospital_groups` (already global, no RLS). Design the
registry so it can later be **extracted** into a standalone control-plane service, and so it already records a
`deployment(kind = pool | silo, endpoint, region)` per tenant. Map **plan tier → deployment kind → existing
`hospital-package` Terraform tier**: clinic/standard → pool (shared cloud, ap-south-1); enterprise/regulated/gov
→ silo (dedicated cloud / on-prem / sovereign MeghRaj/ESDS), gated by `baa_signed` + residency.

**Mechanism.** Pooled path reuses `onboarding.rs` (tenant INSERT + `set_tenant_context` RLS). Silo path
triggers `infra/terraform/modules/hospital-package/` (see §8). The control plane propagates suspend/resume/
plan changes to each deployment via the existing **transactional outbox** (`medbrains-outbox`) or
`LISTEN/NOTIFY`, mirroring how `system_state` broadcasts cache invalidation.

## 3. Data model

**Standard (Stripe subscription object).** A `tenant_subscription` row per tenant carrying the Stripe-style
state machine + local operational fields:

- `status` enum: `trialing | active | past_due | suspended | canceled` (past_due = grace window; suspended =
  access revoked; canceled = terminated).
- `plan_code`, `current_period_start`, `current_period_end`, `trial_end`, `cancel_at_period_end` (bool),
  `cancel_at`, `canceled_at`, `ended_at`.
- Local: `grace_until` (timestamptz — how long access is honored while past_due), `suspended_at`,
  `provider` + `provider_ref` (gateway subscription id).

Plus a **`subscription_plan`** catalog: `plan_code → tier, deployment_kind (pool|silo), price_axis
(per_bed|per_user|flat), limits (beds, seats, usage dims), allowed edition/module codes, sla_tier
(bronze|silver|gold)`. And on the tenant registry: `deployment_id`, `baa_signed` (bool), `region`.

**Mechanism.** `tenant_subscription` is a global (RLS-off) table like `tenants`; the lifecycle shape is
directly templated on **`patient_package_subscriptions`** (`migrations/0034_billing.sql:589` — same
active/suspended/expired + metering pattern). **Plan → module entitlement extends the existing `module_config`
+ `is_module_enabled_for_edition`** rather than duplicating it: a plan's `allowed module codes` seed/adjust
`module_config.status`, and `require_module_enabled` (already shipped, #3844–#3847) enforces per-request. Clean
new migration file (no patches), highest today is `0265_*`.

## 4. Enforcement — the suspend gate (the earn lever)

**Standard.** Model suspension as an **entitlement state with a recovery allowlist**, evaluated at the API
boundary, **fail-closed**. A suspended/unpaid/canceled tenant may reach only: login/logout, billing (view/pay/
update-card), data-export, and support — everything else returns **402 Payment Required** / 403.

**Mechanism.** New `middleware/subscription.rs::require_subscription_active`, a near-clone of
**`middleware/system_state.rs`**: post-auth (so `Claims.tenant_id` is present), a ~60s per-process cache with
webhook/outbox invalidation, a static route allowlist, and a 402/403 short-circuit. Wire it as one global
`.layer(from_fn_with_state(...))` adjacent to `system_state_layer` at `routes/mod.rs:7794` (and mirror onto the
reminder-routes stack `:7854`). It is a **per-tenant licensing gate** — like `entitlement.rs`, it is **NOT**
bypassed by `super_admin`/`hospital_admin` (a delinquent tenant's own admin can't self-exempt). This composes
*on top of* RBAC + RLS (two-gate model).

## 5. Operator plane & security

**Standard.** A real **platform-operator** identity, global and separate from any tenant admin, living in the
control plane. The console provides: tenant list/registry, per-tenant health + usage, suspend/resume, plan/tier
change, onboarding status, **impersonation** (short-TTL, scoped, on-screen banner, separately audited), and a
full audit trail. Least privilege + centralized audit are non-negotiable (the Okta cross-tenant-impersonation
breach is the cautionary tale).

**Mechanism / fix.** Today there is **no** platform-operator role — per-tenant `super_admin` is minted at
onboarding, yet `routes/multi_hospital.rs` (`require_super_admin`, `list_groups`, `:83-135`) already treats
`super_admin` as "platform operator," so any customer's own admin passes cross-tenant checks. **This RFC
mandates closing that over-privilege**: introduce a distinct `platform_operator` principal (a new role and/or a
dedicated platform tenant with `group_id IS NULL` cross-tenant authority), tighten the `multi_hospital.rs`
checks to require it, and never let a tenant `super_admin` resolve cross-tenant. Impersonation issues a
short-TTL scoped "operator-on-behalf-of tenant X" token, logged distinctly from real tenant activity, with a UI
banner. The console is a global (RLS-off) surface guarded harder than any tenant app.

## 6. Support / help-desk

**Standard.** A tenant→vendor ticketing channel with status/priority/**SLA**/assignment/escalation, plan-gated
SLA tiers (Bronze/Silver/Gold), and **unlimited agents (no per-seat)** — support is a bundled/warranty earn,
not a seat tax.

**Mechanism.** Mirror **`comm_complaints`** (`migrations/0046_communication.sql:65`) — it is already a
full-featured ticket table (status enum, `severity`, `escalation_level/history`, `sla_hours/deadline/breached`,
`assigned_to/at`, `resolution_notes`, `satisfaction_score`). Swap the patient-shaped `complainant_*`/`patient_id`
columns for `raised_by_user_id` + `tenant_id`; follow the `routes/communications.rs` handler pattern
(`list/create/update/resolve`, `GRV-`-style codes). SLA targets by plan tier (e.g. Standard: Critical 1h/4h;
Premium: 30m/2h). Optionally reuse the open-source-helpdesk framing (Frappe Helpdesk precedent).

## 7. Billing & dunning

**Standard.** Recurring subscription charges; **delegate retries to the gateway** (never roll your own — card
networks cap retries, ~Visa 15 / Mastercard 35 per 30 days); dunning = `active → past_due (grace) → suspended`,
where the *payment retry* is the gateway's job and the *grace length + access decision* is ours. Prefer daily
microbilling + monthly invoice; support a **prepaid wallet** + card; free trial + small free-credit grant.
Pricing axes are **per-bed (IPD) / per-user (OPD) / flat**, SaaS *or* licence+AMC (10–15%/yr India norm), with
module/AI/compliance add-ons.

**Mechanism.** Reuse `routes/payment_gateway.rs` (Razorpay/RazorpayX/Cashfree + webhooks at
`routes/mod.rs:315-317`). Gateway webhooks (`payment_failed`, `subscription.updated`) drive the
`tenant_subscription` transitions and invalidate the gate cache; the daily **`services/retention.rs`** pass
sweeps `past_due` rows past `grace_until` → `suspended`. Platform (tenant→vendor) billing is *separate* from
patient care billing (`billing.rs`) — do not conflate the two invoice streams.

## 8. Provisioning bridge

**Standard.** One operator action provisions a tenant into the correct plane for its tier. Region-aware for
residency.

**Mechanism (design; build in P8).** `POST /api/admin/tenants` (platform-operator only): for a **pool** plan,
reuse `onboarding.rs` init/setup (tenant INSERT + seed + `mail_provisioning.rs` for domain/mailbox); for a
**silo** plan, trigger the `hospital-package` Terraform (the aspirational path already noted in
`infra/terraform/README.md`: "Terraform = platform, runtime = tenants"). This complements the two-audience
flow in `RFC-ONBOARDING-PROVISIONING.md` (IT/Terraform + business wizard) — the operator bridge is the vendor
initiating either path on a customer's behalf.

## 9. Metering & limits

**Standard.** **Seats** enforced at the state-changing action (member activation/invite-accept) via an atomic
tenant-scoped `COUNT(*) WHERE status='active'` before INSERT — never at login. **Beds** as the hospital billing
axis. Per-dimension **overage policy enum** (`block | throttle | bill`); soft caps alert/throttle (~80%), hard
caps stop until upgrade/next cycle. Keep catalog identifiers identical across plan catalog, metering, and
gateway metadata to prevent drift. Reconcile nightly.

**Mechanism.** Durable counts in a `tenant_usage`/`quotas` table (Postgres); hot-path counters can use the
future Dragonfly/Redis layer (`RFC-DATA-INFRASTRUCTURE.md`). Metering aggregation runs on the analytics/
retention path, off the OLTP hot path.

## 10. Pricing tiers (recommended)

| Tier | Target | Plane / hosting | Price axis (benchmarked) | SLA |
|---|---|---|---|---|
| **Community** | Self-hosters, credibility | Self / on-prem (AGPL) | Free | Community forum |
| **Clinic SaaS** | Solo / small clinic (OPD) | Pool, shared cloud ap-south-1 | ~$20–30/user·mo or per-bed (cf. Bahmni Lite $20, Insta $25) | Bronze (business-hours) |
| **Hospital Cloud** | 50–150 beds | Silo, dedicated cloud | ₹500–1500/bed·mo *or* licence ₹12–25L + AMC 12–15% (cf. Arko) | Silver, 99.9% |
| **Enterprise / Gov** | 150+ beds, chains, public | Silo, on-prem / sovereign (MeghRaj/ESDS) | Custom per-bed + AMC (cf. KareXpert quote) | Gold, 99.99%, dedicated AM |

**Cross-tier upsells:** implementation & migration (one-time), training/go-live, ABDM certification,
NABH-readiness consulting, AI/RCM/TPA/analytics modules (module add-ons gated via `module_config`).

## 11. Constraints & non-goals

- **Clean migration files, no patch-on-patch** (house rule). Highest today `0265_*`.
- **Local Postgres is down** this session (docker `medbrains-postgres-1`, port 5435) — new migrations validate
  in CI or once PG returns; do not ship an unvalidated migration blind.
- Keep **RLS discipline**: `make check-rls` / `make check-tenant-leak` green; control-plane tables are global
  (RLS-off) by design, like `tenants`.
- **Suspend ≠ delete** — PHI retention + export allowed while suspended.
- **Non-goal:** provisioning the actual compute/box (that is `infra/terraform` + `RFC-ONBOARDING-PROVISIONING`).
  This RFC's app scope = registry, subscription, gate, operator console, support, billing.

## 12. Phased rollout (each its own PR, approved individually)

- **P2 — Subscription foundation.** `tenant_subscription` + `subscription_plan` migration; core types; plan
  catalog seed; operator status read/write endpoints. (Migration validates when PG is up.)
- **P3 — Suspend gate.** `middleware/subscription.rs::require_subscription_active` cloned from
  `system_state.rs` + recovery allowlist + pure-decision unit tests + wire as global layer.
- **P4 — Operator identity.** `platform_operator` principal; close `multi_hospital.rs` over-privilege;
  cross-tenant tenant registry read surface.
- **P5 — Operator console UI.** List / health / usage / suspend-resume / plan-change (new `pages/admin` or a
  platform surface; gated by `platform_operator`).
- **P6 — Support module.** Full-stack tenant→vendor tickets mirroring `comm_complaints`.
- **P7 — Billing & dunning.** Gateway subscription charge + webhook → state machine + retention-pass sweep.
- **P8 — Provisioning bridge.** `POST /api/admin/tenants` (pool via onboarding; silo via Terraform trigger).

## Verification (per phase)

`SQLX_OFFLINE=true CARGO_TARGET_DIR=/tmp/mb-target cargo clippy 0` + unit tests (pure decision fns, like
`entitlement.rs`), `pnpm typecheck+build`, `biome`, `make check-api` + `make check-rls`/`check-tenant-leak`;
migrations validated on dev PG (`docker exec medbrains-postgres-1 psql`) or CI. **End-to-end acceptance:**
create a tenant, set its subscription `suspended` → the gate 402/403s everything except the recovery allowlist
(login, billing/pay, export, support); set `active` → full access restored; a tenant `super_admin` **cannot**
reach any `platform_operator` cross-tenant endpoint.

## Sources (external, consulted 2026-07-14)

- Frappe Cloud / Press (model, object graph, pricing, dunning, support): github.com/frappe/press,
  frappe.io/cloud/pricing, docs.frappe.io/cloud/what-are-benches-and-bench-groups,
  docs.frappe.io/cloud/billing/billing-cycle, frappe.io/support-sla, frappe.io/helpdesk/pricing.
- SaaS engineering: AWS SaaS Lens (Silo/Pool/Bridge), AWS SaaS Architecture Fundamentals (control-plane vs
  application-plane), AWS Prescriptive Guidance (single control plane for many tenants), Stripe Billing
  (subscription object, Smart Retries, dunning), multi-tenant-saas.com (subscription & plan enforcement),
  Neon (HIPAA multi-tenancy).
- Healthcare GTM/pricing: Bahmni/Bahmni-Lite, OpenEMR, OpenMRS service-providers, Arko HMS, Insta by Practo,
  KareXpert; ABDM (abdm.gov.in), NABH digital-health standards, DPGA/Co-Develop; NIC eHospital.

# RFC-AI-CLINICAL-COPILOT — MedBrains AI Clinical Copilot ("the crab")

**Status**: Draft
**Priority**: P1 (cross-cutting; ships in phases)
**Platform**: Web first → Mobile (React Native) → TV/ambient later
**Owner**: —
**Supersedes/complements**: RFC-MODULE-clinical-knowledge-base, RFC-INFRA-2026-002 (offline/on-prem), the approved AI-component plan (`/Users/apple/.claude/plans/wild-zooming-whale.md`)

---

## 1. Thesis — the market white space MedBrains already occupies

The 2025–2026 clinical-AI market has **bifurcated** into five lanes, each with a single moat:

| Lane | Leaders | The one moat |
|---|---|---|
| Ambient scribes | Abridge · Microsoft Dragon Copilot · Suki · Nabla · Ambience | **linked-evidence provenance** (Abridge) / **ambient order staging** (Suki) |
| Grounded Q&A | OpenEvidence · UpToDate Expert AI · Glass Health | **cite-only-vetted-sources, refuse-if-no-evidence** |
| EHR-native agents | Epic (Art / Cosmos / In-Basket ART) · Oracle Health Clinical AI Agent | **own the workflow surface + a population-scale model** |
| Patient agents | Hippocratic AI | **safety architecture** (a constellation of supervising LLMs) |
| Multimodal models | Google Med-Gemini / MedLM · AWS HealthScribe | **read scans/ECGs / FHIR-native API** |

**No incumbent occupies the intersection**: *agentic + grounded + provenance-linked + on-prem + multilingual + **regulation-enforcing**, for emerging-market hospitals.* And decisively — **no incumbent enforces regulation at the tool layer.** They *warn*; none *blocks* a Schedule-X dispense that lacks a duplicate record / NDPS register entry.

MedBrains already sits in that intersection because it holds the substrate the incumbents lack:

- **Regulatory invariants coded into the endpoints** — DDI + allergy (`evaluate_medication_safety_in_tx`), NDPS / Schedule-H/H1/X enforcement, `flag_notifiable_diagnosis`, critical-value alerts.
- **111-permission RBAC + transaction-scoped RLS** = the human-in-the-loop / "read-only vs can-act" governance regulators now require (US ONC HTI-1; India DPDP Rules 2025).
- **A 50+ event clinical bus** (`crates/medbrains-core/src/clinical_events.rs` + `routes/ws.rs`) = the proactive-copilot substrate.
- **Per-tenant `rig` LLM + secret store** (`routes/ai.rs::resolve_config`) = on-prem / bring-your-own-model, already parameterised.
- **SHA-256 tamper-chained audit** (`medbrains-db/src/audit.rs`) = the provenance substrate. **i18n en/ta/hi/ar** = the multilingual base.

## 2. Positioning — a guardian, not a scribe

The mascot brief says the brain-crab *"guards, never drops its claws, always alert."* That is the product, not decoration. The copilot is a **clinical safety Sentinel**: it grounds every claim in evidence, runs every *action* it stages through the same regulatory engine that guards the manual path, and **visibly refuses** when it cannot ground a claim or would violate a rule.

**Differentiators (each wired to an existing asset):**

1. **Guarded agentic actions** — the crab stages an order (Rx / lab / referral), but the stage is passed through `evaluate_medication_safety_in_tx` / NDPS / Schedule-X / dose limits; a violation **blocks + cites the rule + audits the attempt**. *No incumbent does this — the compliance moat.*
2. **Grounded + agentic fused** — cite the evidence (RAG over the Clinical KB + the tenant's own chart, RLS-scoped) **and** stage the order that follows, one traceable chain. *Everyone does one or the other.*
3. **Provenance everywhere** — every AI-generated field carries a source pointer (chart fact / citation / transcript span) stored in the audit chain.
4. **Proactive whispers on the event bus** — subscribe to `lab.result.posted`, `pharmacy.ndps.movement.created`, `emergency.code_blue.activated`, a fresh-Rx DDI → surface as inline crab nudges during the encounter, rendered as `custom` widgets via the `UnifiedResponse` slot.
5. **On-prem + sovereign + multilingual** — self-hosted-model toggle (reuse `resolve_config`), DPDP-native per-interaction consent tied to ABHA, code-mixed Indian-language ASR.
6. **Honest refusal + calibrated confidence** — the crab's poses already map to states; add a **refusal state** for "no grounded evidence."

## 3. Asset map (what we build on — verified in-repo)

### 3.1 LLM backend
- `crates/medbrains-server/src/routes/ai.rs` — `resolve_config(state, tenant_id)` reads `tenant_settings` (category `ai`, key `config`) → provider/model/`api_key_secret`; key via `SecretResolver`; default Claude Sonnet 4.6 (`rig`). Today: `extract<T>` (structured) only, Anthropic only — **no streaming, no chat**. Extend the `cfg.provider` match for on-prem (Ollama/vLLM).
- `crates/medbrains-server/src/routes/custom_code.rs` — `ai_generate_code` + a code-exec sandbox + Rust→WASM (`compile_rust`) for clinical-logic plugins.

### 3.2 Clinical event bus (proactive substrate)
- `crates/medbrains-core/src/clinical_events.rs` — 50+ versioned `ClinicalEventName`s (patient/OPD/lab/radiology/pharmacy/IPD/billing/quality/indent); `ClinicalEventEnvelope` carries `tenant_id, patient_id?, encounter_id?, admission_id?, department_id?, payload` with per-event payload validation.
- `crates/medbrains-server/src/routes/ws.rs` — `QueueBroadcaster` (tokio broadcast, per-department + global); already drives TV/queue. **Reuse for whispers.**
- `apps/web/src/components/clinical-event-store.ts` + `ClinicalEventProvider.tsx` — frontend subscription.

### 3.3 Agentic tool surface (candidate tools — all RLS + permission-gated)
| Module | Endpoint | Purpose | Invariant reused |
|---|---|---|---|
| OPD | `POST /api/opd/encounters` | create encounter | `opd.encounter.create` |
| OPD | `POST /api/opd/prescriptions` | draft Rx | **DDI+allergy** `evaluate_medication_safety_in_tx` |
| Pharmacy | `POST /api/pharmacy/orders` | dispense | **Schedule-X duplicate, NDPS register, allergy** |
| Pharmacy | `GET /api/pharmacy/check-interactions` | DDI/allergy lookup | safety seam |
| Pharmacy | `GET /api/pharmacy/catalog` | formulary + dose limits | renal/hepatic/max-dose |
| Lab | `POST /api/lab/orders` | order tests | dept workflow |
| Lab | `GET /api/lab/critical-alerts` | unacked critical values | audit |
| IPD | `GET /api/ipd/admissions/{id}/summary` | admission snapshot | context |
| IPD | `POST /api/ipd/progress-notes` | draft note | audited |
| Billing | `GET /api/billing/invoices?patient_id=` | outstanding balance | RLS |
| CDS | `POST /api/cds/flag-notifiable-diagnosis` | IDSP/notifiable check | regulatory seam |

### 3.4 Frontend context injection
- `apps/web/src/hooks/usePatientContext.ts` → `PatientContext` (allergies, meds, diagnoses). Each screen passes a `ChatContext` (patient/encounter/admission/order ids) via `useAiAssistant().ask(prompt, context)` → `useAiChat` → `SendOptions.context`. Already wired end-to-end (mock).

### 3.5 Safety / PHI seams
- `crates/medbrains-db/src/audit.rs` — SHA-256 hash-chained audit (`prev_hash → hash`), per-action old/new values + correlation id; HTTP audit middleware. RLS via `set_tenant_context`. **No PHI redaction yet — net-new (§5).**

### 3.6 i18n / voice
- `apps/web/src/i18n.ts` — react-i18next, 16 namespaces, en/ta/hi/ar (ar RTL). **No voice yet**; telemedicine (`routes/telemedicine.rs`) is the future ambient hook.

### 3.7 Frontend AI component seam (already shipped — PRs #3547–#3549)
- `apps/web/src/components/ai/*` — `CrabMascot`/`CrabLottie`; `useAiChat` + swappable **`ChatTransport`** (`AsyncIterable<ChatChunk>`); **`UnifiedResponse`** (parts: markdown/code/reasoning/tool/sources/image/**custom**-by-kind); `AiChatPanel`; global `AiAssistantMount` + `useAiAssistant()`; `AskAiButton`; `AiInlinePanel`; `⌘K` "Ask AI".

## 4. Architecture

### 4.1 Transport — SSE for the turn, WebSocket for push, job+poll for durable
| Need | Transport | Rationale |
|---|---|---|
| Live chat + token stream + normal agentic turn (<~60s) | **SSE** (`axum::response::sse`) | Rides the **existing HTTP auth/RLS/audit middleware** (JWT header, `set_tenant_context`, `require_permission`, `AuditLogger`) — the exact pipeline a WS upgrade would bypass. Industry standard (OpenAI/Anthropic). `rig` streaming maps to the SSE event stream. |
| Proactive whispers (server-initiated) | **WebSocket** — reuse `routes/ws.rs` | Not tied to a request; WS + broadcaster already exist. |
| Durable / multi-minute agent runs (survive tab close) | **Async job + poll**, or resumable SSE | Decouple work from connection: `POST → run_id` (background task / outbox / NATS) → poll `GET /api/ai/runs/{id}` **or** reconnect SSE keyed by `run_id` with `Last-Event-ID`. |

**Decision: SSE first, resumable-by-`run_id` from day one** (so it doubles as the long-running path); whispers on the existing WS later. The `ChatTransport` seam means the frontend is transport-agnostic — `SseTransport` / `WsTransport` / `PollingTransport` all satisfy the same contract.

### 4.2 Endpoint & wire format
- `POST /api/ai/chat` → `Sse<Stream<Event>>`. Request: `{ messages, context, run_id? }`. Auth = normal JWT middleware; body validated; `set_tenant_context`; `require_permission(ai.assistant.use)`.
- SSE events mirror the existing `ChatChunk` union: `text`, `reasoning`, `tool` (staged action), `source` (citation), `done`, `error`. Each `text`/`source` may carry a provenance pointer.
- `GET /api/ai/runs/{id}` — poll status/result for durable runs (idempotent; `Last-Event-ID` resume on the SSE variant).
- Conversation persistence: `ai_conversations` + `ai_messages` (migration `0NNN_ai_chat.sql`, `tenant_id` + RLS via `rls_for_tenant_t`).

### 4.3 Guarded tool registry (the differentiator)
- A backend tool registry maps each candidate endpoint (§3.3) to a tool schema. The agent may **stage** a tool call; the frontend renders it as a `tool` part (a confirm card). On confirm, the server executes the tool **through the real endpoint** — so `evaluate_medication_safety_in_tx` / NDPS / Schedule-X / dose guards run exactly as on the manual path, gated by the caller's permissions, and audited. A violation returns a blocked result + the cited rule; the crab surfaces the refusal.
- "read-only vs can-act": `ai.assistant.use` (chat/read) vs `ai.assistant.act` (may stage tools) mapped onto the 111-permission RBAC; every act is a permission-gated, audited, reversible stage-then-sign.

### 4.4 Conversation history, context assembly & "spilling" (compaction)

**Tables** (extend §4.2, all `tenant_id` + RLS):
- `ai_conversations` — `id, tenant_id, owner_user_id, title, patient_id?, encounter_id?, admission_id?, visibility ('private'|'shared'|'group'|'department'), model, last_message_at, archived_at?, created_at, updated_at`.
- `ai_messages` — `id, tenant_id, conversation_id, role, parts jsonb, token_count, provenance jsonb, created_at`.
- `ai_conversation_summaries` — `id, conversation_id, up_to_message_id, summary, token_count` (the compaction).
- `ai_message_embeddings` — `message_id, embedding vector` (pgvector, semantic recall).
- `ai_conversation_shares` — see §4.5.

**Per-turn context assembly** — token-budgeted, then PHI-redacted before egress:
1. Versioned **system prompt**.
2. **Live clinical context** (allergies / meds / vitals) from `usePatientContext` → `ChatContext` — injected **fresh every turn, never trusted from stale history**.
3. **Rolling summary** (compacted old turns).
4. **Recent window** — last K verbatim turns.
5. **Semantic recall** — top-M relevant past turns/summaries via pgvector for the current query.
6. **RAG grounding** for the query (Clinical KB + tenant chart, RLS-scoped).

Budget = `model_context − reserved_output − pinned`; fill 3→6 until budget.

**"Spilling" (overflow):** when a thread exceeds the budget, the oldest turns are **summarized into `ai_conversation_summaries`** and dropped from the prompt — but **retained in `ai_messages`** (medico-legal record) and indexed in `ai_message_embeddings` for recall. Context spills into a *summary + semantic index*, never blindly truncated; live clinical facts (step 2) are re-injected fresh so they are never summarized away or allowed to go stale.

### 4.5 Access & sharing — user / group / department, PHI-guarded

- **Default private** to `owner_user_id`.
- **Share** to specific **users**, a **group** (reuse `access_groups` / `access_group_members`), a **department**, or a **role**; per-share permission **view** vs **contribute**.
- **Hard PHI guard (non-negotiable):** a patient-scoped conversation (`patient_id` set) is only viewable/shareable to principals who **also** hold per-patient access — the same `require_patient_viewer` ReBAC gate added in the deepsec fix (#3536). **Sharing never bypasses patient need-to-know** (VIP / psychiatric / staff-as-patient). Effective access = `(owner ∪ shares) ∩ patient-access`. A share to a principal lacking patient access is rejected, not silently granted.
- Every share / unshare / view is **audited** (the SHA-256 chain).
- **Organization ("grid"):** My threads · By patient (care-team shared) · By group · Department · Recent / Pinned / Archived.
- **Retention & DPDP:** clinical threads retained per medico-legal policy; DPDP right-to-erasure honored (redact/delete on request with an audit tombstone); controlled-substance-related threads flagged for longer retention.

## 5. Safety / regulatory / PHI (mandatory)

- **PHI redaction seam** (`medbrains-core`, net-new): de-identify (names/UHID/IDs/DOB) **before** any external-LLM egress; per-tenant `tenant_settings('ai').assistant_enabled` **opt-in**; on-prem model path skips egress entirely.
- **DPDP-native consent**: standalone, plain-language, purpose-scoped consent per tenant (and, where patient-facing, per-interaction), tied to ABHA; recorded in the audit chain. Blanket consent is invalid under DPDP Rules 2025.
- **Human-in-the-loop + kill switch**: no autonomous ordering; every action is stage-then-sign; a tenant-level assistant kill switch (disable `ai.assistant.*`).
- **Grounding + refusal**: cite-only-vetted-sources (Clinical KB + tenant chart, RLS-scoped); refuse if no grounded evidence (cuts the 10–20% medical-hallucination rate the literature reports).
- **Audit**: every AI query, staged action, and outcome logged via `AuditLogger` (the provenance chain).
- **India norms**: NDPS / D&C Schedule H/H1/X enforced at the tool layer; notifiable-disease via `flag_notifiable_diagnosis`; ABDM/ABHA harmonised consent.

## 6. Enterprise features & governance

**AI admin console** (per tenant, IT/admin-gated): enable/disable per tenant · dept · role; model + provider selection (incl. on-prem); allowed-tools allowlist; per-tenant/user **spend caps + token quotas**; **kill switch**; consent + retention policy; an **approved-model registry with an eval gate** before any model rollout.

**Security & data control:** SSO (OIDC/SAML — see the SSO/AD-groups work) + the 111-permission RBAC + transaction-scoped RLS; tamper-audit; secret store + **BYO-key / BYO-model**; **DLP on egress** (block PHI/secrets leaving, prompt-injection defenses, output filters); **data residency** (on-prem / region pin); the PHI-redaction seam (§5).

**Compliance & transparency:** DPDP / ABDM / HIPAA-posture; retention + **legal hold**; DPDP **right-to-erasure**; consent capture; **audit export**; HTI-1 transparency (expose inputs / logic / model per answer to the clinician).

**Reliability & scale:** per-tenant isolation; **rate limits + quotas**; **fallback models** + graceful degradation (cache-only / cheaper tier when a budget or latency ceiling is hit); OpenTelemetry observability (data-infra RFC); SLOs.

**Usage, cost & quality analytics:** per-tenant/user/dept **token + ₹ dashboards**, chargeback, anomaly/abuse detection; a **feedback loop** (👍/👎 + corrections → an eval set); a **red-team / eval suite** run before model rollout; grounding/citation + hallucination monitoring.

## 7. Memory architecture (durable, cross-conversation)

Beyond conversation history (§4.4), enterprise memory = governed, cross-thread knowledge, retrieved via pgvector scoped by access:

- **Personal memory** (per user, RLS-owned): preferences (note style, default department, language), recurring context.
- **Org / tenant memory** (shared, admin-curated + versioned): hospital protocols, formulary preferences, local guidelines, templates — the tenant's institutional knowledge.
- **Patient memory** (per patient, care-team, **ReBAC-guarded**): a durable running problem-list / clinical summary any *authorized* thread can draw on; audited; PHI-governed.
- **Governance (the discipline):** **explicit, confirmed writes** — the assistant proposes "remember X"; a user/admin confirms (no silent capture, and never silent PHI). Every memory is **typed**, audited, and **erasable** (DPDP); org memory is admin-approved + versioned. (Mirrors this repo's own file-memory model: one typed fact, an index, governed writes.)
- **Recall:** pgvector over `(personal ∪ org ∪ patient-access)` memories, filtered by the same ReBAC as sharing (§4.5).

## 8. Cost optimization — "ponytail for tokens" (the cheapest thing that works)

A cost ladder; stop at the first rung that answers:
1. **Don't call the LLM** — deterministic/rule answers, FAQ, or a **semantic response-cache** hit (freshness- + patient-scope-guarded) → zero tokens.
2. **Prompt caching** — cache the system prompt + org memory + tool schemas + stable RAG context (Anthropic prompt cache, ~5-min TTL) so multi-turn threads reuse them cheaply. The single biggest win.
3. **Model routing / tiering** — a cheap model (Haiku) routes/classifies + answers simple Q&A; mid (Sonnet) for most; expensive (Opus) **only** for hard clinical reasoning. Tier chosen per turn.
4. **Retrieve, don't stuff** — RAG the *relevant* context (§4.4), never dump the whole chart/history.
5. **Compact** — the §4.4 "spill" (summarize old turns) shrinks input tokens.
6. **Bound output** — `max_tokens`, stop sequences, stream + early-stop; structured tool schemas over prose (caveman-terse prompts).
7. **Batch** the non-interactive work — proactive whispers, bulk summaries, embeddings via the **batch API (~50% cheaper)**; cache + incrementally index embeddings.
8. **Per-tenant/user spend caps** — a hard ₹/token budget; when hit, **degrade gracefully** (cache-only or cheapest tier), the `budget.remaining()` pattern, not a hard failure.
9. **On-prem model** for high volume + sovereignty — the marginal-cost-zero optimizer (reuse `resolve_config`).

Each LLM call carries a `// cost:` rationale (tier chosen + why) so inference cost is a first-class, reviewable decision — the ponytail/caveman ethos applied to the model itself.

## 9. Phasing (each a focused, gated PR)

1. **Backend chat (SSE, resumable)** — `POST /api/ai/chat` on `rig` streaming; `ai_conversations`/`ai_messages` + RLS; PHI-redaction seam + tenant opt-in + audit; swap `MockTransport` → `SseTransport`. *(Foundation.)*
2. **Grounded citations** — RAG over Clinical KB + tenant chart (RLS-scoped) → `Sources` parts; refuse-if-empty; the refusal pose.
3. **Guarded tool registry** — map ~10 endpoints (§3.3) as tools; stage-then-sign behind `ai.assistant.act` + the existing regulatory guards + audit; `custom` confirm/result widgets. *(The differentiator.)*
4. **Proactive whispers** — assistant subscribes to the clinical event bus (§3.2) → inline nudges + `custom` widgets (DDI table, K⁺-trend card).
5. **Multimodal + voice + on-prem** — "explain this" on lab/ECG/report; ambient scribe → SOAP draft into the encounter (vernacular ASR); on-prem model toggle in AI settings.

**Cross-cutting from Phase 1** (not a separate phase): the cost ladder (§8) — prompt caching, model routing, spend caps — and the enterprise governance (§6) — admin console, quotas, kill switch, audit/analytics — are built incrementally alongside each phase, not bolted on after. **Memory (§7)** lands with Phase 2 (personal + org) and Phase 3 (patient memory, ReBAC-guarded).

## 10. Verification

- **P1**: `POST /api/ai/chat` streams tokens end-to-end over SSE under the normal auth/RLS/audit middleware; a unit test proves the redactor strips PHI before egress; tenant opt-in gates the assistant; `audit_log` records each call; drop-and-resume via `Last-Event-ID` continues a run. `make check-api`/`check-types`, `cargo clippy`, `pnpm typecheck`/`build`.
- **P3 (guarded tools)**: staging a Schedule-X dispense without a duplicate record is **blocked with the cited rule + audited** (the regulatory-enforcement claim), and an allowed order stages → signs → posts through the real endpoint under the caller's permissions.
- **P4**: a `lab.result.posted` critical value produces an inline whisper within the open thread.
- **Frontend**: the crab shows the refusal state when ungrounded; a11y (keyboard, focus, aria); Storybook covers the new `custom` widgets.

## 11. Open decisions

- **RAG store** for grounding — pgvector in the existing Postgres vs a dedicated store (Meilisearch is already speced for full-text). Recommend **pgvector** first (single source of truth, RLS-scoped).
- **Voice/ASR provider** for the vernacular scribe (on-prem Whisper vs a managed API) — gate on the on-prem/sovereignty requirement.
- **Tool-confirm granularity** — per-action confirm vs a batch "sign all staged" for a plan.
- **Memory write policy** — always-confirm vs auto-propose-with-review; org-memory approval workflow.
- **Model-routing thresholds** — what routes to Haiku vs Sonnet vs Opus (a classifier vs heuristics); the accuracy/cost trade for clinical turns (bias to the stronger model on anything clinical-decision).
- **Semantic response-cache invalidation** — freshness TTL + the rule for busting the cache when the underlying chart/labs change (patient-scoped cache keys).

## 12. References

Research sources (SOTA scan, mid-2026): Abridge, Microsoft Dragon Copilot (Ignite 2025), Suki ambient order staging, Nabla, Ambience, OpenEvidence, UpToDate Expert AI, Glass Health, Epic Art/Cosmos/In-Basket ART, Oracle Health Clinical AI Agent, Hippocratic AI (Polaris), Google Med-Gemini/MedLM, AWS HealthScribe; agentic guardrails / kill switches (Becker's, AWS HITL); hallucination/RAG/citation-enforced prompting (MDPI, npj Digital Medicine); FDA PCCP/SaMD; India DPDP Act 2023 + DPDP Rules 2025, ABDM/ABHA/NDHM, NDPS/CDSCO Schedule H/H1/X; Eka Care + NVIDIA offline multilingual scribe; on-prem open medical LLMs (vLLM/TGI). Full URL list in the research brief accompanying this RFC.

# RFC: AI-native MedBrains OS: one assistant across every app, driver, connector and machine

**Status:** Proposed, for the owner to decide. Research and design only; nothing here is built by
this RFC.
**Date:** 2026-11-18.
**Parent:** `RFC-HOSPITAL-OS.md` (§8f, §8h, §8p, §8j).
**Builds on:** `RFC-AI-NATIVE.md` (AI is another user, the six AI layers, kernel compliance
primitives), `RFCs/RFC-AUTHZ-2026-001-Design-and-Grammar.md` (three outcomes, data classes,
delegation modes), `RFC-OS-ECOSYSTEM.md` (draft PR #6085: WIT plugin contracts, one manifest, signed
extensions, the payment OS service), `docs/OS-PRINCIPLES.md`, the AI UI seam rules (AI output
labelled, accepted per item by a person, with provenance).
**Changes, if accepted:** `RFC-AI-NATIVE.md` layer 3 ("an MCP server generated from
`docs/openapi.json`") and `RFC-HOSPITAL-OS.md` §8f item 1 and §8h phase AI5 ("agents through MCP
tools"). MCP stays, but only at an outside gateway (§7.9). Every other rule in those documents
stands.

**How to read the evidence labels.** Each claim from outside is marked **established** (shipped,
standardised, or replicated), **emerging** (published or in preview, not yet replicated or
generally available) or **speculative** (announced, leaked, or our own inference). Numbers in
brackets are sources in §12.

---

## 0. Summary

The owner asked for a Siri-like assistant, Claude-class, that works across every app, driver,
connector and machine on MedBrains OS, and asked for something better and more secure than MCP.

**The finding.** Nobody, including Apple, Google and Microsoft, has a complete answer to "an AI
that acts across a whole OS safely". What the strongest systems share is not a protocol. It is a
shape:

1. **Typed, declared actions** that apps publish to the OS (Apple App Intents, Android
   AppFunctions) instead of letting a model drive screens [36][40].
2. **A deterministic enforcement point** outside the model, checking every call (Windows' MCP proxy
   and agent workspace, AWS AgentCore's Cedar gateway) [41][18].
3. **The model kept out of the control path for untrusted data**: a planner that never reads
   untrusted text, and an interpreter that tracks where every value came from (Google DeepMind's
   CaMeL, Microsoft's FIDES). These are the only published defences that hold their guarantees by
   construction rather than by detection [19][20].
4. **Attested or local compute** for sensitive data (Apple Private Cloud Compute, Google Private AI
   Compute) [35][44].

**On MCP, a push-back.** MCP is not insecure in itself; it is a discovery and transport protocol,
and its 2026-07-28 revision fixed real authorization problems [1][3]. Its documented attacks (tool
poisoning, rug pulls, injection through tool results, token passthrough, malicious servers in the
wild) come from two things MCP does not provide: a capability model, and a separation between what
the model reads and what it may do [32][33][34]. Those are exactly what an OS must own. So MCP is
the wrong **core** and an acceptable **edge**: outside agents may connect, but only through a
hardened gateway that turns their calls into our typed actions.

**The recommendation, in one paragraph.** Every app, driver and connector declares **actions** in
its signed manifest: typed WIT interfaces with an effect class (read, draft, write, money,
clinical, device, egress) and the data classes they touch. The assistant never calls an app
directly. It produces a **plan** (a small, bounded, typed program of action calls) from the user's
request alone; a Rust **plan interpreter** in the kernel runs it, labelling every value with its
source, integrity and data class; untrusted text is read only by a **quarantined model** with no
actions that returns typed values; and the **action broker** checks every call with the existing
three-outcome authorization, a short-lived **task grant** (a delegation object, the authz house
pattern), information-flow rules and the consent gate, before anything runs. Writes become
drafts or need a confirmation the model cannot phrase; money and clinical actions need the person
who is accountable. Models run on the box by default; cloud models, Claude among them, are chosen
per data class behind the existing provider trait. Outside agents (MCP, A2A) come in only through a
gateway onto the same broker.

---

## 1. Goals and non-goals

### Goals

- One assistant that can find, explain, draft and (with confirmation) do things across every
  MedBrains app, driver, connector and node, by voice or text, on web, desktop, mobile and kiosk.
- Security that holds **by construction**: an injected instruction in a scanned letter, a lab
  comment or an outside tool's output must not be able to make the assistant do something the user
  did not ask for, even when the model is fooled.
- No new authority: the assistant can never do more than the user it acts for, and usually less.
- Fit the law the codebase already has: three outcomes, data classes decide denial, permissions
  first, the service layer is the guard, every function on a constrained surface bounded.
- No lock-in: any model, local or hosted, behind one interface; Claude is an option, not a
  dependency.

### Non-goals

- AI deciding anything clinical (diagnosis, order, prescription, dose, triage, discharge). It
  drafts; a named clinician signs (`RFC-AI-NATIVE.md` §1, unchanged).
- AI deciding access. Authorization stays deterministic.
- A new wire protocol. Actions are WIT interfaces under the ecosystem RFC's existing contract
  rules; outside, we speak MCP, A2A, OAuth and FHIR as they are.
- Screen-driving agents for clinical or financial actions.

---

## 2. Survey 1: OS-level intent and action systems

| System | What apps expose | Where the model runs | Security model | Status | Label |
|---|---|---|---|---|---|
| **Apple App Intents + Apple Intelligence** | Typed intents and entities in Swift, declared in the app binary; Siri and Shortcuts call them | On-device foundation model (about 3B parameters) and Private Cloud Compute (PCC) for larger requests [37][35]. In 2026 Apple confirmed Gemini-based models behind the next Siri, running on PCC [38] | PCC: stateless processing, no privileged runtime access, devices send data only to nodes whose software measurements are published in a transparency log and attested [35] | App Intents shipped since iOS 16; PCC since 2024. The "personal context" Siri slipped through 2026; WWDC 2026 put App Intents at the centre of Siri [39] | Established (App Intents, PCC); emerging (agentic Siri across apps) |
| **Android AppFunctions** | Functions annotated in Jetpack, discoverable and executable by callers holding a platform permission | Gemini (device and cloud) | Caller needs the `EXECUTE_APP_FUNCTIONS` permission; apps declare what they expose; Google describes it as the on-device counterpart of MCP tools [40] | Android 16+, experimental API; Gemini integration in limited preview through 2026 [40] | Emerging |
| **Windows agentic features** | MCP servers packaged as "agent connectors" in an on-device registry; computer-use agents | Local and cloud | Connector calls go through an OS MCP proxy that does consent, audit and containment; agents run under their own accounts in a separate session ("agent workspace"); default policy demands packaging, identity, provenance, containment and consent for connectors [41] | MCP on Windows and the registry in public preview from Nov 2025; agent workspace in preview; one 2026 report says the execution containers are now generally available (not confirmed by Microsoft documentation we read) [41] | Emerging |
| **ChromeOS → Android desktop ("Aluminium")** | Android app surfaces; Gemini at OS level, a context-aware pointer that suggests actions [42] | Gemini | Inherits Android's model | Devices announced for late 2026; details from press and leaks [42] | Speculative |
| **Linux desktops** | Third-party assistants (for example Newelle on GNOME) acting as MCP clients; desktop-control MCP servers using portals and accessibility APIs [43] | Local (llama.cpp) or cloud | No OS-level mediation: each assistant's own judgement; KDE projects are cautious about AI | Community projects | Emerging, and weakest |

**What this tells us.**

- **Established:** the two vendors with the most mature systems (Apple, Google) both chose **typed,
  declared actions** over screen control for app integration [36][40].
- **Emerging:** Microsoft is the first to put a **mediating proxy** between agents and tools at the
  OS level, with identity and audit per connector, which is the closest public analogue to what
  this RFC proposes [41]. Its own documentation warns that agents can still be misled by content
  they read [41].
- **Gap:** none of them publishes a control/data-flow defence against injection at OS level. They
  rely on permission prompts, containment and model training. That gap is where MedBrains can
  lead, because a hospital OS has a much smaller, typed action set than a consumer OS.

---

## 3. Survey 2: agent protocols

| Protocol | Purpose | Typing | Auth | Capability scoping | Sandboxing | Audit | Transport | Maturity, adoption | Label |
|---|---|---|---|---|---|---|---|---|---|
| **MCP** 2026-07-28 [1][2] | Model ↔ tools, resources, prompts | JSON Schema 2020-12 for inputs and outputs | OAuth 2.1 resource server; RFC 9207 issuer check; Client ID Metadata Documents (dynamic registration deprecated); no token passthrough [1][3] | OAuth scopes, coarse; progressive step-up recommended [3] | None in the protocol; left to hosts [3] | OpenTelemetry trace propagation conventions; no audit format [1] | Stateless JSON-RPC over stdio or Streamable HTTP; sessions removed; tasks and MCP Apps are extensions [1] | Very wide; under the Linux Foundation's Agentic AI Foundation since Dec 2025 [8] | Established |
| **A2A** (Agent2Agent) [5][6][10] | Agent ↔ agent task hand-off | Agent cards and task messages in JSON | OAuth/OIDC, mTLS; signed agent cards in v1.0 [10] | Per-agent skills | None | Task history | HTTP, JSON-RPC, streaming | Google, Apr 2025; Linux Foundation Jun 2025; v1.0 reported Mar 2026; AAIF hosted project Aug 2026 [5][6][10] | Established (governance); emerging (v1.0 features) |
| **ACP** (IBM, BeeAI) [7] | Agent ↔ agent | REST | — | — | — | — | REST | Merged into A2A (Aug 2025); repository archived [7] | Retired |
| **AGNTCY** [11] | Agent directory, identity, messaging (Cisco-led) | Schemas for agent records | Identity service | — | — | — | Various | Separate Linux Foundation project [11] | Emerging |
| **OpenAI Apps SDK / Agents SDK** [64] | Apps inside ChatGPT; agent orchestration library | Apps SDK is built on MCP | MCP's | MCP's | Host's | Host's | MCP | Vendor products, not standards | Established (as products) |
| **AP2** (Agent Payments Protocol) [9] | Proving a person authorised an agent's purchase | Signed "mandates" as verifiable credentials (SD-JWT) | Credential signatures | Per mandate (cart, amount) | — | Mandate chain is the audit | Extension to A2A/MCP | Google, Sep 2025, many payment partners; later governance reports unverified [9] | Emerging |
| **IETF agent identity work** [12][13][14][15] | Agent authentication and delegation on top of OAuth and WIMSE workload identity | JWT / X.509 | OAuth token exchange, transaction tokens, WIMSE identifiers | Attenuating tokens (tools and argument constraints, derived offline) [14] | — | Delegation chains [15] | — | Internet-Drafts only; the OAuth WG rechartered in 2026 with agent-on-behalf-of work in scope; transaction tokens near IESG submission [12][13] | Emerging |

**Comparison in one line each.**

- **MCP:** the best discovery and transport for "a model uses a tool"; gives you OAuth and schemas,
  not capabilities, provenance or isolation.
- **A2A:** right for agent-to-agent hand-off across organisations (an insurer's agent, a
  reference lab's agent); not for an agent calling the OS.
- **ACP:** folded into A2A; ignore.
- **AGNTCY:** directory and identity ideas worth watching; not needed inside one hospital.
- **OpenAI Apps SDK:** MCP with a UI layer; a distribution channel, not an architecture.
- **AP2:** the one idea worth borrowing now: a **signed, specific record of what the person
  authorised** (a mandate) that travels with the action. We do the same for money (§7.6).
- **IETF drafts:** the direction (short-lived, audience-bound, attenuable, delegation chains) is
  clear and matches our design; the wire formats are not settled.

### Documented attacks on agent protocols

| Attack | What happened | Source | Label |
|---|---|---|---|
| Tool poisoning | Hidden instructions in a tool's description made an agent leak data from another tool (a WhatsApp history demo) | [32] | Established |
| Injection through tool results | A malicious public GitHub issue made an agent using the GitHub MCP server copy private repository data into a public pull request | [33] | Established |
| Rug pull | A server changes its tool definitions after approval; widely described, few confirmed in the wild | [32][34] | Emerging |
| Token passthrough, confused deputy, SSRF, mix-up | The spec now forbids passthrough and gives mandatory mitigations for each [3] | [3] | Established |
| Malicious and vulnerable servers | A backdoored email MCP package copied mail to an attacker (Sep 2025); dozens of CVEs in MCP servers and clients, including remote code execution in widely downloaded tools, through 2026 [34] | [34] | Established |

The pattern: **every one of these works because the model's context is also its control channel,
and the client trusts whatever tools it was given.** A typed action broker with provenance tracking
closes the first; a signed, pinned catalogue closes the second.

---

## 4. Survey 3: prompt-injection-resistant architectures

Most results below use AgentDojo, a benchmark of agent tasks (email, banking, travel, workspace)
with injected attacks in tool outputs [23].

| Design | Idea | Measured result | Weakness | Label |
|---|---|---|---|---|
| **Dual LLM** (Willison, 2023) [25] | A privileged model plans with tools; a quarantined model reads untrusted text and returns opaque variables | Not benchmarked as published | Values from the quarantined model can still steer arguments | Established (pattern) |
| **CaMeL** (Google DeepMind, 2025) [19] | The planner writes a program from the user's request only; a custom interpreter runs it, tracks capabilities (provenance and allowed readers) on every value, and enforces policies before each tool call | AgentDojo: 77% of tasks solved **with provable security**, against 84% for an undefended agent [19] | Needs policies per tool; costs some utility; "provable" means the stated policies hold, not that every harm is prevented | Emerging (strong) |
| **FIDES** (Microsoft, 2025) [20] | Information-flow control: confidentiality and integrity labels on every value; the planner sees hidden variables; deterministic policy checks before actions | AgentDojo: with policies on, **all** injection attacks stopped; with reasoning models it completed more tasks than a basic planner [20] | Policies must be written; label creep can block legitimate work | Emerging (strong) |
| **Progent** (2025) [21] | Programmable privilege policies on tool calls (which tools, which argument values) | AgentDojo attack success 39.9% → 1.0%, utility 79.4% → 76.3% [21] | Policies partly generated by a model; protects calls, not flows | Emerging |
| **Plan-then-execute and related patterns** [24] | Fix the set of tool calls before reading untrusted data; six patterns compared | Analysis, not one benchmark | Arguments can still be shaped by untrusted data [24] | Emerging |
| **Meta "Agents Rule of Two"** [26] | A session may combine at most two of: untrusted input, sensitive data or systems, state change or outside communication; otherwise a person approves | Design rule, not benchmarked | Meta itself calls it a floor, not a finish line [26] | Established (as guidance) |
| **Spotlighting** (Microsoft, 2024) [22] | Mark untrusted text (delimiters, encoding) so the model can tell it apart | Attack success from over 50% to under 2% on GPT models [22] | A prompting defence; adaptive attacks break this class [27] | Established (weak alone) |
| **Detectors and task-alignment checks** (for example Task Shield [31]) | A model judges whether each call serves the user's goal | Low attack rates on static benchmarks [31] | 12 published defences of this kind were broken at 71–100% attack success by adaptive attackers [27] | Weak against adaptive attackers |

**What the evidence supports.**

1. **Only system-level designs survive adaptive attackers.** The "attacker moves second" study
   broke every prompting, filtering and detection defence it tried [27]. CaMeL and FIDES are not
   in that set because their guarantee does not depend on the model resisting the text
   (established reasoning, emerging evidence).
2. **They are not complete.** AgentDojo is static, and a 2026 benchmark argues it overstates
   robustness [28]. "Agent data injection" disguises malicious data as trusted metadata and
   bypasses defences that look for instructions [29]. A 2026 analysis argues that prompt injection
   may never be fully preventable, because an attacker can make a forbidden flow look legitimate
   in context [30]. So information-flow control must be paired with **effect limits** and
   **confirmations the model cannot phrase**.
3. **Hospitals help.** A small, typed action set with known data classes is exactly where CaMeL-
   and FIDES-style policies are cheapest to write. A general consumer assistant cannot enumerate
   its actions; we can.

---

## 5. Survey 4 and 5: capabilities, authorization, isolation, compute

### 5.1 Capability and authorization technology

| Technology | What it gives | Fit for MedBrains | Label |
|---|---|---|---|
| Object capabilities | Authority comes only from references you were handed; no ambient authority | The WebAssembly component model is built this way; our hosts already follow it (ecosystem RFC §3.1) | Established |
| Macaroons [17] | Bearer tokens anyone can narrow by adding caveats; HMAC, so the verifier holds the root key | Fine inside one box; shared-secret verification is a weakness across machines | Established |
| Biscuit [17] | Public-key tokens with offline attenuation and Datalog policies | Strong fit for node-to-node grants; non-IETF format and a logic engine to carry [15] | Established (technology), niche adoption |
| UCAN [17] | Decentralised, attenuable delegation chains | Built for peer-to-peer; still 1.0 release candidate | Emerging |
| IETF attenuating agent tokens [14] | JWS tokens listing tools and argument constraints; children derived offline must be narrower | Same idea as Biscuit in a familiar format; a 2026 draft | Emerging |
| OAuth 2.1, RFC 8693 token exchange, RFC 9396 rich authorization requests, RFC 9449 DPoP, RFC 9700 security BCP [16] | Audience-bound, short-lived, sender-constrained tokens; an `act` (actor) claim for delegation; structured per-transaction details | Right for anything crossing a machine or an organisation. RFC 8693's `act` claim matches our `ActingAgent` | Established |
| Transaction tokens [13] | Short-lived, call-chain-scoped tokens inside a trust domain | Good model for broker → service hops; near standardisation | Emerging |
| Cedar / OPA [18][65] | Policy languages; Cedar is designed for automated analysis, and AWS uses it to gate agent tool calls with arguments, default-deny, and to hide always-denied tools from listings [18] | Tempting, but we already have one authorization engine and a law that two engines must agree (authz §0.9). A second engine for agents breaks that | Established |

### 5.2 Isolation and execution

| Option | Fit | Label |
|---|---|---|
| WebAssembly components (WASI 0.3, ratified Jun 2026, async in the component model) [46] | Capability-based by construction; the ecosystem RFC already chose it for drivers and on-box connectors. Actions from extensions are just more exports of the same component | Established (0.2), emerging (0.3) |
| Firecracker / gVisor microVMs [47] | Strong isolation for arbitrary code an agent writes and runs | Not needed: our assistant does not run generated code. Keep for any future "code interpreter" feature | Established |
| Landlock, seccomp, systemd sandboxing [47] | The second wall around each host process | Already the plan (ecosystem RFC §6.2) | Established |

### 5.3 Confidential computing for cloud models

| Offering | What is attested | Can MedBrains use it today? | Label |
|---|---|---|---|
| Apple PCC [35] | Node software measured, published in a transparency log, verified by the device before sending | Only for Apple's own features on Apple devices | Established |
| Google Private AI Compute [44] | SEV-SNP and TPU enclaves, attested by the client | Only for Google's own features | Emerging |
| Anthropic confidential inference [45] | A research design (trusted model loader in a trusted VM) and a joint whitepaper; no generally available product we could confirm | Not yet | Speculative for production use |
| Cloud confidential GPU VMs (several vendors) | VM and GPU attestation | Only if we host the model ourselves in the cloud | Emerging |

**Consequence:** today no hosted frontier model, Claude included, offers attested inference a
hospital can verify. So "attested cloud" is a tier we design for and do not yet have (§7.7).

### 5.4 On-device models for an 8–16 GB box

| Task | Candidates (choose by our eval, not brand) | Label |
|---|---|---|
| Speech to text | whisper.cpp (already in `medbrains-dictation`); Gemma 4 edge models accept short audio [48] | Established (Whisper) |
| Planning, short drafting, summarisation | Open 4–8B instruction models at 4-bit (Gemma 4, Qwen3, Llama, Phi families) [48][49] | Established |
| Medical text and images | MedGemma (4B multimodal, 27B text) as a candidate for coding help and summaries [50] | Emerging (needs our eval) |
| ICD / SNOMED / LOINC coding | Retrieval over our terminology tables plus a small model choosing among candidates; the code list comes from the tables, never from the model | Established pattern |

---

## 6. Survey 6 and 7: agentic-OS research, screen agents, regulation

### 6.1 Agentic-OS research

- **AIOS** [51]: an "agent kernel" with a scheduler, context, memory, storage, tool and access
  managers. Useful vocabulary; its access manager is coarse. Our kernel already has the pieces it
  proposes, with real authorization (emerging research).
- **MemGPT / Letta** [52]: the model manages its own memory tiers. **Push-back:** memory the model
  writes is untrusted data that later reads back as context, which is a persistent injection
  channel. In a hospital, memory about patients is the record, not a model notebook (§7.12).
- **Anthropic computer use and agent patterns** [53][55]: computer use (2024) drives screens;
  Anthropic's later engineering advice moves tool-heavy work into code the agent runs against
  typed APIs, cutting context and cost [55]. Both say the same thing for us: typed APIs beat
  screen-driving where they exist.

### 6.2 UI grounding against API grounding

| | Screen agents (computer use) | Typed actions (intents) |
|---|---|---|
| Reliability | Top agents now pass the human baseline on OSWorld-Verified, around 85–90% task success by 2026 aggregator boards [54] | Deterministic once the plan is right; failures are typed |
| What a 10% failure means | One wrong click in ten tasks | Not applicable |
| Injection exposure | Everything on screen is read, including patient text | Only what the plan routes to the quarantined model |
| Authorization | Whatever the screen lets the user do; cannot be narrowed per task | Per action, per record, per task grant |
| Audit | Screenshots and clicks | Structured action rows |
| Fit | Legacy systems with no API (a payer portal) | Everything MedBrains owns |

**Position (strong):** clinical and financial actions never go through a screen agent. A screen
agent may be offered later, read-only or draft-only, for outside legacy portals, inside a contained
session like Windows' agent workspace.

### 6.3 Healthcare regulation

| Jurisdiction | What applies to an assistant | Label |
|---|---|---|
| **EU AI Act** (Reg. 2024/1689) [56] | AI that is, or is a safety component of, a medical device under MDR is high-risk (Annex I): risk management, data governance, logging, transparency, human oversight, accuracy. The 2026 Digital Omnibus agreement moves Annex III high-risk duties to Dec 2027 and Annex I to Aug 2028 [56]. Documentation aids that are not devices are not high-risk by that route, but transparency duties (telling people they deal with AI, marking generated content) still apply | Established (law), emerging (new dates, pending formal adoption) |
| **US FDA** [57] | The Jan 2026 revised clinical decision support guidance widens enforcement discretion (single recommendations, risk scores, time-critical support) but does not address generative AI directly. A function that a clinician cannot independently review stays a device | Established |
| **US ONC/HHS** [63] | HTI-5 (Oct 2026) removed HTI-1's AI transparency (source attributes) criteria from certification; HIPAA has no AI-specific rule. Transparency now comes from contracts and our own model cards | Established |
| **India CDSCO** [58] | Final guidance on medical device software (Jul 2026): classification by intended use and risk under MDR 2017, no separate AI class; AI needs evaluation in representative populations and settings; cloud hosting does not exempt | Established (per law-firm and consultancy summaries; read the circular before relying on details) |
| **India DPDP Act and Rules 2025** [59] | Rules notified Nov 2025, main duties phased in over 18 months (to about May 2027): notice, consent, purpose limits, security safeguards, breach reporting | Established |
| **India AI Governance Guidelines** (MeitY, Nov 2025) [60] | Voluntary principles (trust, people first, accountability, understandable by design, safety); sector regulators enforce | Established (as guidance) |
| **ICMR guidelines for AI in health** (2023) [61] | Human oversight, accountability, consent, data privacy, validation | Established (not re-read this session) |
| **NABH / ABDM** | No AI-specific standard found. NABH's existing record, consent and patient-identification standards apply to anything the assistant writes | Gap |
| **WHO** [62] | 2024 guidance on large multi-modal models: risks of wrong or biased output and automation bias; calls for regulator approval and audits after deployment. No guidance on agents found | Established |

**The line every regulator draws, in our words:** an assistant that helps a person **record,
find, schedule, bill or explain administrative facts** is not a medical device in any of these
regimes, as long as it does not suggest a diagnosis or treatment the clinician did not state.
The moment it suggests what to do for a patient, it is presumed to be one. The architecture
therefore splits actions by **effect class** and the UX by **who is accountable**, and the
regulatory classification follows the effect class (§7.2).

---

## 7. Recommended architecture

### 7.1 Shape

```
 voice / text / screen context (typed ids, not screenshots)
        │
        ▼
 ┌──────────────┐  user request + action schemas only     ┌────────────────────┐
 │ Planner model│ ─────────────────────────────────────▶  │ Plan (typed, ≤16   │
 │ (privileged) │   never sees retrieved or outside text  │ steps, no loops)   │
 └──────────────┘                                         └─────────┬──────────┘
                                                                    ▼
 ┌──────────────────────── kernel: plan interpreter (Rust) ─────────────────────┐
 │ every value carries a label: sources · integrity (trusted/untrusted)         │
 │                              · data class · allowed readers                  │
 │   step ──▶ ACTION BROKER (deterministic policy enforcement point)            │
 │             1 task grant valid?  2 user authz (kernel::authz, 3 outcomes)    │
 │             3 feature scope ∩ user ∩ grant   4 flow rules on argument labels │
 │             5 consent gate (purpose)  6 effect class → confirmation needed?  │
 │             7 audit row (always)                                              │
 │   untrusted text ──▶ Quarantined model (no actions) ──▶ typed value, labelled │
 └───────────────────────────────────┬──────────────────────────────────────────┘
                                     ▼
     app services (in-process) · drivers and connectors (Wasm hosts) · nodes
     (medbrains-agent)  ·  AI gateway ⇄ outside MCP / A2A agents
```

Everything inside the kernel box is code we wrote, reviewed and can test without a model. The
models are outside it: they propose, they never decide.

### 7.2 The intent and action model

**An action is a typed function an app, driver or connector publishes to the OS.** Declared once,
in the manifest the ecosystem RFC already defines, as a WIT interface. Our own bricks declare
theirs the same way, in Rust, compiled in.

| Field | Meaning |
|---|---|
| `id` | `<publisher>.<brick>.<verb>`, e.g. `medbrains.opd.book-appointment` |
| `version` | semver; the interface is `medbrains:action@1`; a host that does not know an interface refuses to load it (ecosystem RFC §7) |
| `summary` | one reviewed sentence; generated text is never accepted from a request (tool-poisoning defence) |
| `input`, `output` | WIT record types; identifiers are typed (`patient-id`, `encounter-id`), never free strings |
| `effect` | one of `read`, `draft`, `write`, `money`, `clinical`, `device`, `egress` (table below) |
| `permission` | the Rust permission code the action requires (Permissions First: defined before the action) |
| `resource` | which argument names the record checked per call (no unscoped checks, authz §0.3) |
| `dataClasses` | highest data class read and returned |
| `slots` | per argument: may it be filled from untrusted-derived values? (`trusted-only`, `confirm-if-untrusted`, `any`) |
| `idempotency` | key the broker uses so a retried plan never double-books or double-charges |
| `limits` | rows returned, time budget; the broker enforces the smaller of this and the hospital's |
| `reversible` | how it is undone (amend path, cancel, refund) |

| Effect class | Example | Default rule |
|---|---|---|
| `read` | "who is waiting for Dr Rao" | Allowed within the user's access; results go to the screen, not back to the planner |
| `draft` | registration form filled from an ID card; OPD note from dictation | Lands as a draft; a person accepts per item (existing AI seam) |
| `write` | book or move an appointment; issue a token | Confirmation card generated by the broker from the typed arguments |
| `money` | create a bill; request a payment through the payment OS service | Confirmation with a signed mandate and step-up (§7.6) |
| `clinical` | any order, prescription, diagnosis, dose, triage, discharge | **Not available to the assistant as an action.** Only `draft` into the clinician's sign flow |
| `device` | print a wristband, send an order to an analyser | Confirmation; never from untrusted-derived arguments |
| `egress` | send data outside the box (SMS, insurer, ABDM) | Egress guard + consent + confirmation; never in a session that read untrusted text without a person (Rule of Two) |

The assistant has no `admin` effect: it cannot change permissions, roles, settings, extensions or
policies. That list is closed in the kernel.

**Why curated actions and not every API route.** `docs/openapi.json` has 2,909 operations. Exposing
them all (the current layer 3 plan) gives the planner a huge, untyped-by-effect surface and makes
tool choice worse. Actions are fewer (tens per brick), each one maps to an existing **service-layer**
function (authz rule 4: the service layer is the guard, not HTTP), and each one was written by a
person who decided its effect class. A check (`check-action-catalogue`, proposed) fails CI if an
action's permission does not exist in Rust or its service function bypasses `require()`.

### 7.3 Agent identity and delegation

The assistant acts **for** a user, under the authz RFC's delegation mode (§2A.5), with the house
pattern: **delegation is an object**, not a flag.

| Piece | Design | Why |
|---|---|---|
| Subject | The existing `ActingAgent` (kind, agent, model, run id, conversation) on every call; audit rows already carry it | Built; generalise it to every AI path |
| **Task grant** | A row the broker writes when a plan is accepted for running: granter = user, grantee = this run, actions = the plan's action ids, resources = the record ids the plan names (or "within this encounter"), expiry = minutes (default 10, never past the user's session), single-use for each `write`, `money`, `device` and `egress` step | Least privilege per task, not per feature; revocable; auditable; one place to look |
| Effective authority | user's permissions ∩ the feature's declared scope ∩ the task grant, checked per call | The AI can never exceed the user, and usually has far less |
| Holder binding | In the box, the grant id is bound server-side to the user's session; it is never a bearer token the model sees | A leaked id in a model transcript is useless |
| Across machines (nodes, outside agents) | RFC 8693 token exchange at `medbrains-oauth`: audience-bound, minutes-long, DPoP-bound access tokens whose `act` claim names the agent [16] | Established standards; no passthrough of user tokens (MCP security rule) [3] |
| Offline attenuation (later) | Biscuit or the IETF attenuating-token format for node-to-node grants that must be narrowed without calling home (**DECIDE 4**) | Not needed until phase 5 |
| Clinical accountability | Never delegation. Clinical drafts use the **countersignature** mode: the record is not final until the clinician signs (authz §2A.5 (4)) | Accountability stays with the clinician; matches `RFC-AI-NATIVE` §1 |

### 7.4 The policy enforcement point

One **action broker** in the kernel, deterministic, before every action, with no model in the loop.

1. **Grant:** valid, unexpired, names this action and this resource. Expired or missing → deny.
2. **User authorization:** the existing `kernel::authz` check on the resource (ReBAC through
   SpiceDB where it applies, permissions, RLS, break-glass relations). Three outcomes. **Unknown is
   held and shown as "could not check", never as "none"** (authz §0.8).
3. **Scope intersection:** the feature's declared permission set.
4. **Flow rules:** each argument's label against the action's `slots`. An untrusted-derived
   `patient-id`, `amount`, `recipient` or `destination` is refused or turned into a confirmation.
5. **Consent gate:** purpose of use against the patient's consent (`medbrains-consent`, three
   outcomes).
6. **Effect class → confirmation:** decides whether the step pauses for a person (§7.6).
7. **Audit:** one row per decision, allowed or not (§7.8).

**Why reuse authz and not add Cedar or OPA.** The authz RFC forbids two engines that could
disagree (§0.9). Cedar's real advantage, analysability, is already a goal of our own grammar (§2B).
The action broker adds only what is new: grants, flow labels, effect classes. **Strength:** strong
(existing law), not a performance claim.

### 7.5 The injection defence

**Choice: a CaMeL/FIDES-style plan interpreter with information-flow labels, plus Meta's Rule of
Two as a session rule, plus spotlighting as a cheap extra layer that nothing relies on.**

| Element | Design |
|---|---|
| Planner input | The user's words, the typed screen context (ids and screen name, not record text), and the action catalogue the grant allows. Never retrieved records, documents, lab comments, outside tool output or memory |
| Plan | A typed JSON plan: steps of action calls whose arguments are literals or references to earlier outputs; at most 16 steps; no loops or recursion (Power of Ten); validated against the WIT types before anything runs. Not Python: a smaller language is easier to prove bounded (**DECIDE 8**) |
| Labels | Every value: source records, integrity (trusted = typed output of our own service; untrusted = free text from people outside the session, documents, outside systems, model output), data class, allowed readers |
| Quarantined model | Reads untrusted text, has no actions, returns only a value of a declared type (enum, number, date, id from a candidate list the interpreter supplies). Its output is labelled untrusted |
| Answers to the user | Rendered by the interpreter into the screen from typed results, with sources. They do not flow back into the planner |
| Rule of Two check | Before running, the interpreter computes whether the plan combines untrusted input, sensitive data (class above `routine`) and a state change or egress. If all three, the step where they meet requires a person |
| Re-planning | If a plan needs content to decide its next step, it ends; the user sees the result and asks again. The planner never sees the content |

**Why this and not the alternatives.**

- **Evidence for it:** CaMeL kept 77% of tasks against 84% undefended on AgentDojo with security
  that holds by construction [19]; FIDES stopped all AgentDojo injections with policies on [20];
  Progent showed that argument-level tool policies cut attacks from 39.9% to 1.0% [21].
- **Evidence against the alternatives:** every prompting, filtering and detection defence tested by
  adaptive attackers fell at 71–100% [27]. Those make good alarms, not walls.
- **Why it suits us:** the cost of these designs is writing policies per tool. Our actions are few,
  typed, and already carry permissions and data classes, so most policies are generated from the
  manifest (`slots`, `effect`, `dataClasses`).

**Honest limits (keep them in the threat model):**

1. Static benchmarks overstate robustness [28]; we build our own hospital injection suite and test
   it with adaptive attacks (phase 0 exit).
2. Data disguised as trusted metadata can still mislead [29]. Mitigation: integrity comes from
   **where a value came from**, not what it looks like; only typed outputs of our own services are
   trusted.
3. A clever context can make a forbidden flow look normal [30]. Mitigation: effect limits and
   confirmations the model cannot write (§7.6) are the last line, and they are deterministic.
4. A fooled planner can still misread the user's own request. That is an accuracy problem, handled
   by the confirmation card showing the exact typed action.

### 7.6 Confirmation UX rules

The broker, not the model, writes every confirmation. It is built from the typed arguments, in
plain words, with the data's sources, so the model cannot phrase its way past it.

| Effect | Confirmation | Extra |
|---|---|---|
| `read`, routine data | None | Results labelled "found by the assistant", with sources |
| `read`, `sensitive` and above | None beyond the user's own access; tombstones and masks apply exactly as for the person (authz §3) | Tombstone hits by the assistant are audit events like any other |
| `draft` | Accept, edit or reject per item (existing AI seam); nothing pre-ticked | Clinical drafts: section-by-section accept, then the normal sign flow |
| `write` | One card: "Book Anita Sharma (UHID …) with Dr Rao, Thu 10:30. [Book] [Change] [Cancel]" | Undo shown after; bulk writes (more than one record) always list every record |
| `money` | Card with amount, payer, purpose; a **signed mandate** (AP2's idea) recording exactly what the person approved | Step-up (PIN or device biometric) above a hospital-set amount or always (**DECIDE 6**); the payment OS service, never the assistant, collects |
| `device` | Card naming the device and what it will do | Never from untrusted-derived arguments |
| `egress` | Card naming destination, purpose, data classes | Egress guard and consent; Rule of Two |
| `clinical` | Not an action. The assistant opens the clinician's own form with the draft filled and labelled | The clinician signs as today |
| Voice | Every write is confirmed on a screen by an authenticated person; a spoken "yes" is never enough | Voice is not authentication |

Every confirmation is accessible: keyboard operable, at least 24 px targets, never colour alone,
both themes (project law).

### 7.7 Model routing by data class

| Data class reaching the model | Allowed models | Today |
|---|---|---|
| `routine` (no patient data: menus, help, schedules without names) | Local, or hospital-approved cloud | Possible now |
| `identifying`, `sensitive` | Local; cloud only after redaction (`ai_redact`, fail closed), with the hospital's consent record, a data-processing agreement and the egress allowlist | Possible now, redacted |
| `restricted`, `confidential`, `sealed` | **Local only** | Possible now |
| Any class, unredacted, in the cloud | Only on an **attested** endpoint whose software measurement the box verifies (PCC-style) | Not available from any hosted frontier provider we could confirm [45]; designed, not offered |

- The **planner** sees no record content, so it can run on a stronger model, local or cloud, with
  little data risk; it still sees the user's words, which may name a patient, so those are
  redacted for cloud planners.
- The **quarantined model** reads record text, so it follows the table strictly; usually local.
- **Claude without lock-in:** Claude is reached through the existing provider trait and the
  existing workload-identity path (`medbrains-anthropic-auth`, no API key). Prompts, plans, evals
  and action schemas are ours; switching provider is a setting, re-qualified by `medbrains-ai-eval`
  before use.
- Models are signed files installed by change set, as `RFC-AI-NATIVE` layer 1 already says.

### 7.8 Audit and provenance

| Record | Contents | Where |
|---|---|---|
| `ai.plan` | run id, user, model and prompt version, redacted request hash, plan hash, grant id | kernel audit (hash-chained) |
| `ai.action` | per step: action id and version, resource, decision (allow, deny, unknown), which check decided, labels of arguments, confirmation id if any | kernel audit |
| `ai.confirmed` / `ai.decided` | who confirmed, what the card said (hash), accept, edit or reject, edit distance | kernel audit; generalises `ai_suggestion_outcomes` |
| Mandate | signed record of a money approval | billing, linked from the audit row |
| On the record | "AI suggested, accepted by X" mark on every field that came from a draft | the record itself |

No prompt text or patient identifiers in AI logs (existing rule). The hospital can answer: what did
the assistant do, for whom, on whose authority, from what data, and who approved it.

### 7.9 Interop: outside agents only through a gateway

One **AI gateway** service, run by the connector host under the ecosystem RFC's rules (signed
manifest, egress guard, revoke button).

| Direction | Design |
|---|---|
| **Inbound MCP** (an approved outside assistant calls MedBrains) | An MCP server facade over the action catalogue, not over OpenAPI. Tools = the actions the hospital enabled for that connected app. OAuth 2.1 per the 2026-07-28 spec: RFC 9207 issuer check, client ID metadata documents, audience-bound tokens, no passthrough [1][3]. Every call becomes a broker call with the app's grant. Writes become drafts in a person's AI inbox. Results carry labels in `_meta` |
| **Outbound MCP** (our assistant uses an outside source: drug reference, payer rules) | Outside servers are **data sources only**: their output goes to the quarantined model, never the planner. Tool definitions are pinned by hash at approval; any change needs re-approval (rug-pull defence). No patient data leaves without the egress guard and consent |
| **A2A** (agent-to-agent with insurers, reference labs, other hospitals) | Later. Signed agent cards verified; tasks map to connector capabilities (`claims`, `lab-orders-out`, `exchange`); the same broker and egress guard |
| **OS assistants** (Siri, Gemini, Windows) on staff devices | Expose only non-PHI navigation intents ("open my OPD queue") through App Intents and AppFunctions, or none (**DECIDE 5**). Patient data must not enter a platform assistant's context |

### 7.10 Voice and screen context across surfaces

- **Screen context is data, not pixels.** The shell publishes a typed context (screen id, patient,
  encounter, selection) to the assistant. No screenshots; no screen scraping.
- **Speech stays on the box** (whisper.cpp exists). Wake word and speech recognition run locally.
- **Voice is never authentication.** Anything beyond `read` needs an on-screen confirmation by a
  signed-in person.

| Surface | Assistant |
|---|---|
| Web, desktop | Full, as the signed-in user |
| Mobile (native) | Full, as the user; confirmations use the platform's biometric step-up for `money` |
| Kiosk (patient-facing) | A separate **patient-mode** action set (check-in, queue status, directions, pay own bill through the payment service); patient identity by the existing kiosk flows; no staff actions (**DECIDE 9**) |
| TV boards | None. Nobody there can confirm anything (unchanged from `RFC-AI-NATIVE`) |
| OS console (operators) | Operations help only (`RFC-HOSPITAL-OS` §8h), no patient data |

### 7.11 Extensions and nodes

- **Drivers and connectors export actions** as WIT functions in the same component, declared in the
  same manifest, approved on the same consent screen ("this driver lets the assistant print
  wristbands on Printer 2"). The host enforces them like any other call.
- **Community extensions cannot expose `money`, `device` or `egress` actions to the assistant**
  until certified (**DECIDE 11**).
- **Nodes** (`medbrains-agent`) run actions locally for their devices; the broker on the main
  machine decides, and the node receives a token-exchanged, audience-bound grant per call.

### 7.12 What not to do

| Don't | Why |
|---|---|
| Let the AI decide or change access | Authorization must be deterministic and testable; the AI is a subject, not an authority |
| Use a screen-driving agent for clinical or financial actions | 85–90% task success is a failure every few tasks, and the screen is the largest injection surface |
| Feed retrieved records, documents or outside tool output to the planner | That is the injection channel every documented attack uses |
| Let the model write its own confirmations | A fooled model writes a convincing one |
| Generate tools from every API route | Too large a surface; effect classes need a person's judgement |
| Pass user tokens through to outside services | Forbidden by the MCP spec for good reason [3] |
| Keep long-term model "memory" about patients | Memory is a persistent injection channel and a second, unaudited record |
| Ship a second policy engine for agents | Breaks "both backends must agree" |
| Trust a detector or classifier as the wall | Adaptive attackers broke all twelve tested [27] |
| Send unredacted PHI to a cloud model without attestation | No hospital can verify what happens to it |
| Let voice confirm a write | Voice can be spoofed and is not tied to a signed-in person |

---

## 8. What MedBrains already has (and what this RFC adds)

| Need | Exists today | Added by this RFC |
|---|---|---|
| Acting-for identity | `ActingAgent` in `medbrains-kernel/src/claims.rs`, written to audit and access logs | Task grants; token exchange for cross-machine |
| Assistant tool calls | `medbrains-ai`: in-process dispatch through the real router, GET-only allowlist (`AI_ROUTER`), per-route permission checks, patient grounding | The action catalogue replaces the GET allowlist; the plan interpreter replaces free tool-calling |
| Authorization | `kernel::authz` (three outcomes), SpiceDB ReBAC, data classes, `check-authz-collapse` | Broker checks for grants, flow labels, effect classes |
| Redaction, provider choice | `ai_redact` (fail closed), provider trait, Anthropic by workload identity | Routing table by data class; attested tier designed |
| Manifest, signing, Wasm hosts | Connected-app manifest (`mcp-tool` kind), Ed25519 signing, WIT plan in the ecosystem RFC | `actions` field and `medbrains:action@1` interface |
| Consent, egress | `medbrains-consent` (three outcomes), egress guard design (ecosystem §6.5) | Consent and egress checks inside the broker |
| AI UI | `AiLabel`, `AiOrb`, accept per item, `check-ai-label` | Broker-written confirmation cards on every surface |
| Evaluation | `medbrains-ai-eval` (golden cases, leak and no-clinical graders) | A hospital injection suite with adaptive attacks |
| Money | Payment OS service (ecosystem §4) | Signed mandates for AI-prepared payments |

---

## 9. Phased plan

| Phase | Scope | Exit (each ends on a screen or a check) |
|---|---|---|
| **A0 Specification** | Action manifest schema and `medbrains:action@1` WIT; threat model and failure table (§10); a hospital injection suite in `medbrains-ai-eval` (scanned letters, lab comments, outside replies carrying attacks), run with adaptive attacks | Suite runs in CI against the current assistant and records its baseline |
| **A1 Read actions** | Action catalogue for registration, OPD and queue reads; broker with grants and authz; replaces the GET allowlist; skill 1 | A user without the permission gets "not allowed", an outage gets "could not check", both proven on screen; suite shows no unauthorised reads |
| **A2 Plans and drafts** | Plan interpreter, labels, quarantined model, Rule of Two check; drafts through the AI seam; skills 2 and 4 | Injection suite: zero unauthorised actions under adaptive attack; utility measured and published |
| **A3 Confirmed writes and money** | Broker-written confirmation cards on web, desktop, native; mandates and step-up; skills 3 and 5; kiosk patient mode | Each skill used on screen by its role; double-submit proven idempotent; payment collected only by the payment service |
| **A4 Gateway** | Inbound MCP facade (reads and drafts) for approved connected apps; outbound MCP as data sources with pinned definitions; A2A spike | A malicious test MCP server cannot cause any action; a changed tool definition is blocked until re-approved |
| **A5 Extensions and nodes** | Actions exported by Wasm drivers and connectors; node grants by token exchange; attenuable offline tokens if **DECIDE 4** says so; OS-assistant bridges if **DECIDE 5** says so | A certified driver's action runs from the assistant through the host, audited end to end |

### First five assistant skills for a small hospital (registration and OPD only)

| # | Skill | Effect | Confirmation | Regulatory risk | Other risk |
|---|---|---|---|---|---|
| 1 | **Find and open**: "open Anita Sharma's last visit", "who is waiting for Dr Rao" | `read` | None | **Low** (administrative) | Wrong patient opened: show two identifiers (IPSG patient ID) on every result |
| 2 | **Register from a document or voice**: fill the registration form from an ID card, ABHA card or the clerk's speech | `draft` | Accept per field | **Low** (administrative); DPDP notice and consent unchanged | Duplicate or wrong identity: the existing duplicate check runs before save; ID image never leaves the box |
| 3 | **Book, move or cancel an appointment; issue a token** | `write` | Card per booking | **Low** | Double booking: idempotency key; bulk moves list every patient |
| 4 | **OPD note from the doctor's dictation**: a case-sheet draft by section, from what the doctor said | `draft` (clinical documentation) | Accept per section, then the doctor signs | **Medium**: a documentation aid, not a device, only while it adds nothing the doctor did not say; written classification under CDSCO's 2026 guidance before release (`RFC-AI-NATIVE` Q8) | Made-up content: grounded-claim grader; no suggestions of diagnosis or treatment |
| 5 | **Prepare the OPD bill and request payment** from the visit, packages and tariff | `money` (draft bill, then payment request) | Card + mandate; step-up per **DECIDE 6** | **Low** (regulatory) | **High** (financial): only the payment OS service collects; refunds stay human |

Not in the first five, deliberately: prescription drafting, lab or imaging order suggestions,
triage, discharge, anything on IPD. Each is high regulatory risk and waits for the SaMD
classification and its own eval bar.

---

## 10. Failure table (class A)

| Failure | What the user sees | What the system does |
|---|---|---|
| Model unreachable or too slow | "The assistant is not available; use the screen as usual" | No partial plan runs; manual path unchanged |
| Plan fails type validation | "I could not turn that into a safe action; try rephrasing" | Nothing runs; audit row |
| Authz or consent returns unknown | "Could not check access to this record right now" | Step held, never treated as "no record" |
| Grant expired mid-plan | "This request timed out; ask again" | Remaining steps refused |
| Untrusted value reaches a `trusted-only` slot | Confirmation card naming where the value came from, or refusal | Audit row with labels |
| Quarantined model returns a value outside the declared type | "I could not read that document reliably" | Value discarded |
| Action provider (driver, connector) traps or times out | "Printer 2 did not answer" | Outcome `unknown`, held for a person (ecosystem §3.1) |
| Duplicate submission | The first result | Idempotency key returns the first outcome |
| Kill switch on | Assistant controls disappear | The call is never made |

---

## 11. Decisions for the owner

**DECIDE 1. The core.** Adopt typed actions + action broker + plan interpreter as the OS AI core,
with MCP only at the outside gateway. This changes `RFC-AI-NATIVE` layer 3 and `RFC-HOSPITAL-OS`
§8f item 1 and AI5. *Recommended: yes.*

**DECIDE 2. Curated catalogue.** Actions written and reviewed per brick (tens each), rather than
generated from all 2,909 API operations. *Recommended: curated, with a CI check tying each to a
Rust permission and a service function.*

**DECIDE 3. Cloud models before attestation exists.** Redacted-only cloud (recommended), or also
allow identifying data to a contracted cloud provider under a DPA without attestation?

**DECIDE 4. Cross-machine tokens.** RFC 8693 token exchange only (recommended for now), or add
Biscuit or the IETF attenuating-token format for offline node-to-node narrowing in phase A5?

**DECIDE 5. Platform assistants.** Expose nothing to Siri, Gemini and Windows, or only non-PHI
navigation intents? *Recommended: nothing until A5, then navigation only.*

**DECIDE 6. Money step-up.** Step-up authentication on every AI-prepared payment request, or only
above an amount the hospital sets?

**DECIDE 7. Red team and pass bar.** Who attacks the assistant before each phase exit (an outside
firm or our own team), and what attack success rate blocks a release (recommended: zero
unauthorised actions; utility is reported, not gated)?

**DECIDE 8. Plan language.** Typed JSON plans with no loops (recommended) or a restricted Python
like CaMeL's (more expressive, harder to bound)?

**DECIDE 9. Kiosk patient mode.** On or off by default for a new hospital?

**DECIDE 10. Clinical documentation classification.** Who signs the CDSCO classification for skill
4 (same open question as `RFC-AI-NATIVE` Q8)?

**DECIDE 11. Community extensions.** May community-tier extensions expose any actions to the
assistant, or only certified ones? *Recommended: community `read` and `draft` only.*

**DECIDE 12. Name.** What the assistant is called on screen (a name is a product decision; "the
assistant" until then).

### Open research questions (not decisions)

- How much utility a JSON plan language loses against CaMeL's Python on our own tasks.
- Whether a 4–8B local planner is good enough for skills 1–3, measured on our eval.
- How to label documents from inside the hospital (another department's note): trusted record,
  untrusted text, or a third integrity level.

---

## 12. Sources

Accessed 2026-11-18 unless stated. Labels in the text say how much weight each carries.

1. MCP specification 2026-07-28, changelog. https://modelcontextprotocol.io/specification/2026-07-28/changelog (2026-07-28)
2. MCP blog, "The 2026-07-28 specification". https://blog.modelcontextprotocol.io/posts/2026-07-28/ (2026-07-28)
3. MCP security best practices (2026-07-28). https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices
4. MCP specification 2025-11-25, changelog. https://modelcontextprotocol.io/specification/2025-11-25/changelog (2025-11-25)
5. Agentic AI Foundation, "A2A joins AAIF". https://aaif.io/blog/a2a-joins-aaif (2026-08-17)
6. Linux Foundation, Agent2Agent project launch. https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents (2025-06-23)
7. IBM Research, Agent Communication Protocol (now part of A2A). https://research.ibm.com/projects/agent-communication-protocol (2025-08)
8. Constellation Research, Agentic AI Foundation launches with MCP. https://www.constellationr.com/insights/news/agentic-ai-foundation-launches-mcp-other-ai-agent-standards (2025-12)
9. Spark, Google AP2 research note (secondary). https://www.spark.money/research/google-ap2-agent-payment-protocol (2025-09)
10. Let's Data Science, A2A v1.0 and signed agent cards (secondary). https://letsdatascience.com/news/a2a-solidifies-cross-vendor-agent-interoperability-53400ea4 (2026)
11. IntuitionLabs, Agentic AI Foundation and open standards (secondary). https://intuitionlabs.ai/articles/agentic-ai-foundation-open-standards (2026)
12. IETF draft-klrc-aiagent-auth-03, AI agent authentication and authorization. https://www.ietf.org/archive/id/draft-klrc-aiagent-auth-03.html (2026-07)
13. IETF draft-ietf-oauth-transaction-tokens. https://datatracker.ietf.org/doc/html/draft-ietf-oauth-transaction-tokens (2026-07)
14. IETF draft-niyikiza-oauth-attenuating-agent-tokens-01. https://www.ietf.org/archive/id/draft-niyikiza-oauth-attenuating-agent-tokens-01.html (2026-06-15)
15. IETF draft-asor-wimse-agent-delegation-chain-01. https://www.ietf.org/archive/id/draft-asor-wimse-agent-delegation-chain-01.html (2026-09)
16. OAuth standards: RFC 8693 token exchange https://www.rfc-editor.org/rfc/rfc8693 (2020-01); RFC 9396 rich authorization requests https://www.rfc-editor.org/rfc/rfc9396 (2023-05); RFC 9449 DPoP https://www.rfc-editor.org/rfc/rfc9449 (2023-09); RFC 9700 OAuth security BCP https://www.rfc-editor.org/rfc/rfc9700 (2025-01); RFC 9207 issuer identification https://www.rfc-editor.org/rfc/rfc9207 (2022-03)
17. Capability tokens: Biscuit https://www.biscuitsec.org/; Macaroons (NDSS 2014) https://research.google/pubs/macaroons-cookies-with-contextual-caveats-for-decentralized-authorization-in-the-cloud/; UCAN specification https://github.com/ucan-wg/spec (1.0.0-rc.1)
18. AWS Security Blog, why AgentCore Policy chose Cedar. https://aws.amazon.com/blogs/security/why-policy-in-amazon-bedrock-agentcore-chose-cedar-for-securing-agentic-workflows/ ; AgentCore Policy docs https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/policy.html (2025-12 onward)
19. Debenedetti et al., "Defeating Prompt Injections by Design" (CaMeL). https://arxiv.org/abs/2503.18813 (v2 2025-06-24)
20. Costa et al., "Securing AI Agents with Information-Flow Control" (FIDES). https://arxiv.org/abs/2505.23643 ; https://www.microsoft.com/en-us/research/publication/securing-ai-agents-with-information-flow-control/ (2025)
21. Shi et al., "Progent: Programmable Privilege Control for LLM Agents". https://arxiv.org/abs/2504.11703 (2025)
22. Hines et al., "Defending Against Indirect Prompt Injection Attacks With Spotlighting". https://arxiv.org/abs/2403.14720 (2024-03-20)
23. Debenedetti et al., "AgentDojo". https://arxiv.org/abs/2406.13352 (2024)
24. Beurer-Kellner et al., "Design Patterns for Securing LLM Agents against Prompt Injections". https://arxiv.org/abs/2506.08837 (2025-06)
25. Willison, "The Dual LLM pattern". https://simonwillison.net/2023/Apr/25/dual-llm-pattern/ (2023-04-25)
26. Meta AI, "Agents Rule of Two". https://ai.meta.com/blog/practical-ai-agent-security/ (2025-10-31)
27. Nasr, Carlini et al., "The Attacker Moves Second". https://arxiv.org/abs/2510.09023 (2025-10-10)
28. "AgentDyn: a dynamic open-ended benchmark". https://arxiv.org/abs/2602.03117 (2026-02)
29. Choi et al., "Agent Data Injection Attacks are Realistic Threats to AI Agents". https://arxiv.org/abs/2607.05120 (2026-07-06)
30. Abdelnabi and Bagdasarian, "AI Agents May Always Fall for Prompt Injections". https://arxiv.org/abs/2605.17634 (2026-05-17, v2 2026-11-15)
31. Jia et al., "The Task Shield". https://arxiv.org/abs/2412.16682 (2024-12; not re-read this session)
32. Invariant Labs, MCP tool poisoning attacks. https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks (2025-04)
33. Invariant Labs, GitHub MCP exploited. https://invariantlabs.ai/blog/mcp-github-vulnerability (2025-05)
34. UpGuard, MCP security incidents (secondary index). https://upguard.com/blog/mcp-security-incidents (2026)
35. Apple Security Research, Private Cloud Compute. https://security.apple.com/blog/private-cloud-compute/ (2024-06-10)
36. Apple, App Intents documentation. https://developer.apple.com/documentation/appintents
37. Apple Machine Learning Research, foundation models 2025 update. https://machinelearning.apple.com/research/apple-foundation-models-2025-updates (2025-06)
38. MacRumors, Apple confirms Gemini for next-generation Siri. https://www.macrumors.com/2026/01/12/google-gemini-next-generation-siri/ (2026-01-12)
39. TechCabal, WWDC 2026 announcements (secondary). https://techcabal.com/2026/06/08/wwdc-2026-announcements/ (2026-06-08)
40. Android Developers, AppFunctions overview. https://developer.android.com/ai/appfunctions ; 9to5Google https://9to5google.com/2026/02/25/android-appfunctions-gemini/ (2026-02-25)
41. Microsoft, Securing AI agents on Windows. https://learn.microsoft.com/en-us/windows/security/book/operating-system-agentic-security ; https://blogs.windows.com/windowsexperience/2025/10/16/securing-ai-agents-on-windows/ (2025-10-16); Ignite 2025 developer post https://blogs.windows.com/windowsdeveloper/2025/11/18/ignite-2025-furthering-windows-as-the-premier-platform-for-developers-governed-by-security (2025-11-18)
42. The Next Web, Googlebook and the ChromeOS successor (secondary). https://thenextweb.com/news/google-killed-the-chromebook-its-replacement-turns-your-cursor-into-an-ai-agent (2026)
43. Phoronix, Newelle GNOME assistant adds MCP. https://www.phoronix.com/news/GNOME-AI-Newelle-MCP-Server (2026-01)
44. The Register, Google Private AI Compute. https://www.theregister.com/2025/11/12/google_touts_private_ai_compute/ (2025-11-12)
45. Anthropic, Confidential inference via trusted virtual machines. https://www.anthropic.com/research/confidential-inference-trusted-vms (2025-06)
46. Bytecode Alliance, WASI 0.3. https://bytecodealliance.org/articles/WASI-0.3 ; https://wasi.dev/releases (2026-06-11)
47. Firecracker (NSDI 2020) https://www.usenix.org/conference/nsdi20/presentation/agache ; gVisor https://gvisor.dev/ ; Landlock https://docs.kernel.org/userspace-api/landlock.html
48. The Next Web, Gemma 4 launch. https://thenextweb.com/news/google-gemma-4-open-models-apache-2-launch (2026-04-02)
49. Qwen team, Qwen3. https://qwenlm.github.io/blog/qwen3/ (2025-04)
50. Google Health AI Developer Foundations, MedGemma. https://developers.google.com/health-ai-developer-foundations/medgemma (2025)
51. Mei et al., "AIOS: LLM Agent Operating System". https://arxiv.org/abs/2403.16971 (2024, revised)
52. Packer et al., "MemGPT". https://arxiv.org/abs/2310.08560 (2023); Letta https://www.letta.com/
53. Anthropic, computer use. https://www.anthropic.com/news/3-5-models-and-computer-use (2024-10-22)
54. Yutori, OSWorld-Verified leaderboard (aggregator). https://yutori.com/leaderboards/osworld-verified.md (2026-08-07); OSWorld paper https://arxiv.org/abs/2404.07972 (2024)
55. Anthropic Engineering, code execution with MCP. https://www.anthropic.com/engineering/code-execution-with-mcp (2025-11-04)
56. EU AI Act, Regulation (EU) 2024/1689. https://eur-lex.europa.eu/eli/reg/2024/1689/oj ; Gibson Dunn on the Digital Omnibus agreement https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines/ (2026-05)
57. Covington, FDA revised CDS guidance. https://www.cov.com/en/news-and-insights/insights/2026/01/5-key-takeaways-from-fdas-revised-clinical-decision-support-cds-software-guidance (2026-01)
58. Emergo by UL, CDSCO finalises medical device software guidance. https://www.emergobyul.com/news/india-cdsco-finalizes-guidance-medical-device-software (2026-07-30)
59. PIB, Digital Personal Data Protection Rules 2025. https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf (2025-11)
60. Khaitan & Co, India AI Governance Guidelines note. https://www.khaitanco.com/sites/default/files/2025-11/ERGO%20-%20India%20AI%20Governance%20Guidelines%20-%2011%20November%202025.pdf (2025-11-11)
61. ICMR, Ethical guidelines for AI in biomedical research and healthcare. https://main.icmr.nic.in/sites/default/files/upload_documents/Ethical_Guidelines_AI_Healthcare_2023.pdf (2023; not re-read this session)
62. WHO, guidance on large multi-modal models. https://www.who.int/news/item/18-01-2024-who-releases-ai-ethics-and-governance-guidance-for-large-multi-modal-models (2024-01-18)
63. McGuireWoods, HHS finalises HTI-5. https://www.mcguirewoods.com/client-resources/alerts/2026/10/hhs-finalizes-hti-5-narrowing-health-it-certification-and-deferring-information-blocking-changes/ (2026-10)
64. OpenAI, apps in ChatGPT and the Apps SDK. https://openai.com/index/introducing-apps-in-chatgpt/ (2025-10; not re-read this session)
65. Cutler et al., "Cedar: a new language for expressive, fast, safe, and analyzable authorization". https://arxiv.org/abs/2403.04651 (2024)

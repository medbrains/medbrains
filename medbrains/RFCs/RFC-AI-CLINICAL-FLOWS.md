# RFC: AI in clinical flows, voice first

| | |
|---|---|
| Status | **Plan, waiting for the owner.** No code in this PR |
| Date | 2026-11-12 |
| Builds on | `RFCs/modules/RFC-MODULE-ai-dictation.md` (slice 1, built), `RFCs/RFC-AI-NATIVE.md` (F0/F1), `RFCs/RFC-HOSPITAL-OS.md` §8b, §8f, §8h, §8o, §8p, `docs/OS-PRINCIPLES.md`, `../RFCs/RFC-AUTHZ-2026-001-Design-and-Grammar.md` (§0, §2A.5 acting-for), `../RFCs/RFC-AI-CLINICAL-COPILOT.md`, `../RFCs/RFC-NATIVE-MOBILE.md` |
| Owner direction | 2026-11-12: make MedBrains easy for doctors; most doctors prefer **voice notes**. AI is an **OS and kernel service**, not a per-app feature |

This RFC is the plan for where AI enters the clinical day and how it is built so every app and
surface gets it the same way. Where it differs from `RFC-AI-NATIVE.md` it is newer on the clinical
flows and on the kernel AI interface; that RFC's six rules (§1) still hold.

---

## 1. Goals and non-goals

**Goals**

1. **A doctor's time per patient goes down, never up.** Measured, per consult, against the same
   doctor's typed baseline (§11).
2. **Voice is the main input on every clinical surface** that writes notes: web, iOS, Android.
3. **AI is one OS service behind one kernel interface.** Every app, brick, surface and outside
   assistant reaches a model only through `kernel::ai` (§5). Permissions, consent, redaction, audit,
   labels, rate limits and "drafts only" are enforced there once (complete mediation).
4. **Local first.** Speech and language models run on the hospital's own machine. Nothing leaves
   the hospital unless the hospital opts in, per feature, with a data-processing agreement.
5. **Safe by construction.** AI drafts; a named clinician accepts, edits or rejects every part; a
   dictated medicine goes through the same allergy, interaction, dose and schedule checks as a typed
   one; negations, numbers and drug names are checked mechanically, not trusted.

**Non-goals**

- No AI-placed order, prescription, dose, diagnosis, triage level or discharge. Ever.
- No auto-sign, no pre-ticked accept, no "accept all" for clinical sections.
- No diagnostic suggestions the clinician did not say (that would make this a medical device under
  the Medical Devices Rules 2017; see the dictation RFC §4).
- No AI on TV boards or kiosks (nobody there can accept a draft).
- No training models on patient data inside MedBrains.
- Ambient recording of the patient's voice is **not** in the first slices; it needs per-visit
  consent (§8) and its own SaMD note.

---

## 2. What exists today (checked on `origin/main`, 2026-11-12)

| Area | Built | Missing |
|---|---|---|
| OPD dictation, web | `apps/web/src/components/Clinical/dictation/` (`DictationPanel`, `DictationReview`, `useRecorder`, `dictated-rx-store`, `save-reviewed-draft`); record in browser or upload, ≤10 min, ≤24 MB; review per section beside the transcript; medicines offered to the prescription pad | Live feedback while speaking; "not clearly heard" markers; negation, number and drug-name checks; investigations and follow-up as structured lines; any IPD, nursing or discharge use |
| Server | `crates/medbrains-dictation`: `SpeechToText` trait, whisper.cpp `whisper-server` local (default) or OpenAI-compatible cloud (off by default, https only); transcript redacted (`ai_redact`) then drafted by local Ollama (`llm::extract_with`); `ai_suggestion_outcomes` (append-only, edit distance and ratio); purge every 15 min | Whisper segment timestamps and confidence are not requested (`response_format=json`, no `verbose_json`); no vocabulary prompt; one blocking call after the recording ends; dictation calls the model from its own crate, not through a kernel AI service |
| Data and retention | Migration `1419_ai_dictation.sql`: audio in `dictation_audio` (no audit, real DELETE at save or after 24 h); transcript and draft in `dictation_content` (kept only with a saved note) | Per-hospital retention setting; patient consent record for ambient |
| Permissions | `opd.dictation.use`, `admin.settings.dictation.manage`, `ai.assistant.use`, `ai.assistant.query` | Codes for IPD, nursing, discharge, ambient, AI governance (§7) |
| Coding | Model proposes ICD-10, shape-checked, shown "suggested, verify" | Codes looked up from the terminology tables (ICD-10, SNOMED CT) instead of model text |
| AI UI | `AiLabel`, `AiOrb`, `AiDraftInsert`, `make check-ai-label` | Native (SwiftUI, Compose) AI label and accept/edit/reject kit |
| Native | Doctor `ConsultationView`, `IpdRoundsView`; nurse `ShiftHandoverView` (iOS `apps/ios/MedBrainsStaff/Features/`, Android `app-staff/.../doctor`, `.../nurse`); `Features/Notes` is sticky notes | No microphone permission, no recording, no dictation on either platform |
| OS | `medbrains-server.service` sandboxed with systemd (`ProtectSystem=strict`, `MemoryMax=3G`, syscall filter); signed A/B updates designed (`os/update-keys/` empty); budgets in `crates/medbrains-os-test/budgets.json` | No AI service in the image; no hardware probe (§8p HW1); no model store; no AppArmor profiles in `os/` yet |
| Kernel | `medbrains-kernel`: audit, authz (three outcomes), bounds, claims with `ActingAgent`, config, events, store | No `kernel::ai` module (RFC-HOSPITAL-OS §8h names it; not built) |

The gap that matters most: dictation works on one web screen, on one flow, with its own model
calls. Doing the same for IPD, nursing, discharge and native by copying that crate would give four
model paths, four redaction call sites and four audit shapes. This RFC moves the mechanism into the
OS and the kernel first, then adds flows on top.

---

## 3. What the research says (claim, evidence, strength)

| Claim | Evidence | Strength |
|---|---|---|
| Ambient scribes save some time, less than marketed | UCLA three-arm RCT, 238 physicians (Lukac et al., NEJM AI, 2025-11): one product cut time-in-note 9.5% vs control, the other showed no significant change; burnout scores improved in both. https://pubmed.ncbi.nlm.nih.gov/41497288/ . Stepped-wedge trial (Afshar et al., NEJM AI 2025): about 0.36 h less documentation per day | Strong (RCT, single site); moderate for the second (secondary summary) |
| Drafts carry errors; omission is the commonest | 70% of 44 draft notes had at least one error, omissions most common (Biro et al., JMIR 2025, https://www.jmir.org/2025/1/e64993) | Strong |
| Whisper-class models invent text, more often in pauses | ~1% of transcriptions contained phrases not in the audio, 38% of those harmful (Koenecke et al., "Careless Whisper", FAccT 2024, https://arxiv.org/abs/2402.08021) | Strong |
| Negation drops happen ("no chest pain" → "chest pain") | Reported in NHS commentary | Weak; we treat it as real because it is cheap to check |
| Indian-accented English and Indian languages are harder for ASR | Svarah (Indian English, https://github.com/AI4Bharat/Svarah), Lahaja (Hindi, CC-BY-4.0, https://arxiv.org/abs/2408.11440), Vistaar benchmark suite | Strong |
| Consults in India are very short | ~2 minutes average primary-care consult (Irving et al., BMJ Open 2017) | Moderate |
| Code-mixed Hindi/Tamil/Telugu with English is the norm in OPD | Vendor material (Indian scribe products) | Weak; no public clinical code-mixed benchmark exists. We must build our own test set |
| Large vendors keep audio for 30–90 days | One US vendor: customer-configured, one health system uses 30 days; Microsoft's documentation: up to 90 days, configurable | Strong (vendor docs) |
| Cloud speech is cheap per minute | Sarvam ₹30/hour (https://sarvam.ai/api-pricing); Deepgram Nova-3 Medical from $0.0077/min streaming | Strong (price pages, 2025-26) |

What doctors dislike, consistently: reviewing long, padded notes; waiting for the draft; errors
they must hunt for; a tool that is slower than typing for a two-minute consult. What they like:
not typing history; a note that reads like theirs. Design consequences, used below: **short notes
in the hospital's sections, draft ready within seconds of stopping, every risky token highlighted,
every sentence traceable to what was said.**

Licences (to verify against each repository's LICENSE and model card before shipping a file):
whisper.cpp, faster-whisper, Whisper weights: MIT. AI4Bharat IndicConformer and the Vistaar
fine-tuned Whisper models: MIT per their repositories. NVIDIA Parakeet-TDT-0.6B-v2: CC-BY-4.0
(attribution, commercial use allowed; English only). Canary and Parakeet v3 multilingual: not
confirmed. Training sets carry their own licences (Lahaja is CC-BY-4.0).

---

## 4. Where voice saves clicks: the four journeys

### 4.1 OPD consult (doctor, 2–10 minutes)

| Step today | With voice | Saved |
|---|---|---|
| Type complaint, history, examination | Tap **Dictate** (or the hardware/keyboard shortcut), speak while examining, tap **Stop** | Most typing |
| Pick diagnoses from a search | Diagnoses drafted with codes looked up from ICD-10/SNOMED tables | 1 search per diagnosis |
| Build each medicine line (drug, dose, frequency, duration, route) | Each spoken medicine becomes a draft line; **Add to pad** opens it on the prescription pad, where the usual checks run | 5 fields per line |
| Order investigations | Spoken tests become draft order-basket lines; doctor confirms in the basket | 1 search per test |
| Set follow-up | "Review in 5 days" becomes a draft follow-up date the doctor confirms | 1 date pick |
| Sign | Unchanged: the doctor signs on the case sheet | — |

Batch mode stays: the doctor dictates after the patient leaves if they prefer. Ambient mode (both
voices) is phase V5 and needs the patient's consent.

### 4.2 IPD round (doctor, 1–3 minutes per bed)

Today: open the patient, type a progress note, adjust orders. With voice: on the round list
(`IpdRoundsView`, web IPD round screen), **Dictate** per bed; the draft fills the progress note
(SOAP), with "stop", "start" and "change" medicine lines going to the order screen as drafts.
Saved: one typed note per bed. The phone is the natural device here (§10.2).

### 4.3 Discharge summary (doctor or resident)

Most of a discharge summary is already in the record: diagnoses, procedures, results, medicines.
So the draft is **built from the stay's coded records** (no voice needed), and voice adds what is
not recorded: the course in hospital and advice. Every sentence cites its source record or "you
said". The consultant finalises through the existing `ipd.discharge_summary.finalize` path.

### 4.4 Nursing handover (nurse, end of shift)

Today: a handover form per patient. With voice: the nurse speaks the handover per patient in SBAR
order; the draft fills the handover form fields; the receiving nurse sees it labelled as AI-drafted
and accepted by the named outgoing nurse. Vitals and MAR facts are pulled from the chart, not from
speech, so a misheard number cannot overwrite a charted one.

---

## 5. Architecture: AI as an OS service with one kernel interface

```
 web / iOS / Android / desktop / outside MCP client
        │  audio, text (never a model call)
        ▼
 medbrains-server  ──►  brick (dictation, discharge, handover …)
                          │  domain: prompts, section schemas, consent rule, redaction list
                          ▼
                     kernel::ai  (mechanism: gate, audit, budget, label, draft-only)
                          │  unix socket, bounded queue
                          ▼
                medbrains-ai.service (OS)  — speech: whisper.cpp / ONNX Runtime
                                           — language: llama.cpp (GGUF)
                                           — optional cloud adapter (per-hospital opt-in)
```

### 5.1 The OS AI service (`medbrains-ai.service`)

An OS service like PostgreSQL or the update service, present on every image, **off until the
setup wizard or the admin turns it on** (owner question 3).

| Concern | Design |
|---|---|
| Process | One systemd service, its own user, reached only over a unix socket by `medbrains-server` (no TCP port, so no SSRF class like the address checks in dictation settings §5) |
| Sandbox | Same systemd hardening as `medbrains-server.service` (`ProtectSystem=strict`, `PrivateNetwork=yes` unless the cloud adapter is on, `NoNewPrivileges`, syscall filter), plus an AppArmor profile: read-only on the model directory, no network, no access to the database socket. The OS has no AppArmor profiles yet; this service's is written with the first one |
| Resources | `MemoryMax` from the hardware probe (e.g. 6 GB on a 16 GB box), `CPUWeight` **lower** than the server and PostgreSQL (the server is 200; AI gets 50), `Nice=10`, `IOSchedulingClass=idle` for model loads. The clinical server is never starved: under memory pressure the AI service is the one the OOM killer picks (`OOMScoreAdjust=500`) |
| Scheduling | One queue, two lanes: **interactive** (a clinician is waiting: transcribe, draft) and **batch** (summaries, back-fills). Bounded: at most N interactive jobs (N from the probe, 1 on CPU-only) and a queue of 16; job 17 is refused with "busy, try again" rather than queued for minutes. Each job has a deadline; a missed deadline returns `Unknown`, never a partial draft |
| Hardware | The device-capability probe (RFC-HOSPITAL-OS §8p HW1) runs at service start and records CPU features, RAM, GPU (NVIDIA via CUDA, AMD/Intel via Vulkan), NPU (Intel/AMD via OpenVINO/ONNX EPs, Snapdragon QNN, Hailo on Pi). **CPU is the baseline**; accelerators are used when present, never required |
| Models | Files, not packages: signed, with a model card, installed through the signed OS update channel or an offline bundle, verified (signature + hash) at load; unsigned files are refused. They live on the **encrypted data partition** (`/var/lib/medbrains-ai/models/`), not the system partition |
| Updates | A model change is a change set (RFC-HOSPITAL-OS §8h rule 3): it must pass `medbrains-ai-eval` for each feature using it before it is offered; the old model stays until the new one passes on the machine (A/B for models) |
| Health | Health screen line: "AI: ready / loading / busy / off / failed", queue depth, p90 latency, model versions. Quiet when healthy |

**Image size.** The system partition budget is 1,300 MB (`budgets.json`, `system_disk_used_mb`)
and the image is at about 1,292 MB. So **no model and no runtime weight ships on the system
partition.** The service binary (whisper.cpp and llama.cpp, linked, CPU builds) is the only system
partition cost, target ≤ 8 MB; if that does not fit, it ships on the data partition too, as an
optional OS component verified the same way. Models are optional downloads or an offline USB
bundle (RFC-HOSPITAL-OS §8b: "optional large downloads, such as AI models, stay optional").

Approximate model sizes (to be measured; Q = quantised):

| Model | Disk | RAM in use | Use |
|---|---|---|---|
| Whisper small (ggml) | ~0.5 GB | ~1 GB | CPU baseline, English |
| Whisper large-v3-turbo (Q5) | ~0.6 GB | ~1.5–2 GB | Better Indian English, multilingual; GPU/NPU preferred |
| IndicConformer (per language) | to measure | to measure | Hindi, Tamil, Telugu (phase V6) |
| 3–4B instruction model (Q4 GGUF) | ~2–2.5 GB | ~3 GB | Structuring into sections |

Hardware floor: transcription only on a Pi-5-class 8 GB box (slow, phase V2 measures it);
transcription plus drafting needs 16 GB RAM (the "hospital edge" kit, §8p). Owner question 5.

### 5.2 The kernel interface (`kernel::ai`)

The kernel holds mechanism, not medicine (`make check-kernel-no-domain` bans words such as
patient, consent, clinical, opd). So the interface is generic and the domain parts are passed in
by the brick above it.

```rust
// sketch, not code to merge
kernel::ai::transcribe(&mut tx, &Capability, Audio)            -> Outcome<Draft<Transcript>>
kernel::ai::extract::<T: JsonSchema>(&mut tx, &Capability, Redacted<Text>) -> Outcome<Draft<T>>
kernel::ai::summarise(&mut tx, &Capability, Redacted<Text>)   -> Outcome<Draft<Text>>
kernel::ai::decide(&mut tx, DraftId, Decision /* accept | edit(text) | reject */) -> Outcome<Accepted<T>>
```

| Enforced once, in the kernel | How |
|---|---|
| Permission | A `Capability` is declared statically by the brick (name, the permission code it needs, data class it touches, purpose). The kernel checks the caller's claims hold that permission: `Allow`, `Deny` or `Unknown`, never a bool |
| Basis to process (consent, in domain words) | The capability carries a `basis` check the brick implements (e.g. "this visit has an ambient-recording consent"). The kernel calls it and refuses on `Deny` and on `Unknown` |
| Redaction | Text inputs are typed `Redacted<Text>`; the only constructor is the redaction function (`ai_redact`, fail closed). A raw `String` does not compile into a model call. `make check-llm-redaction` keeps the type the only path |
| Acting-for | Every call writes the `act` claim (`ActingAgent`: kind, model, run) to the audit row (authz §2A.5). The AI acts **for** the clinician, never **as** them |
| Audit | `ai.suggested` (capability, model, prompt version, input hash, sizes, timings; no words) and `ai.decided` (who, outcome, edit distance) rows, generalising `ai_suggestion_outcomes` |
| Drafts only | Output type is `Draft<T>`. The only way to a record is `decide()`, which needs a human actor (`ActorKind::User`, not an agent or service) and returns `Accepted<T>`; record writers in bricks take `Accepted<T>`, so an unreviewed draft cannot be saved by mistake |
| Label | `Draft<T>` and `Accepted<T>` serialise with an `ai` provenance block; the web seam and native kits render `AiLabel` from it; `check-ai-label` extends to native |
| Rate limits | Per user and per tenant token buckets (e.g. 30 interactive calls per user per 10 min), and the service's bounded queue; refusal says "busy", not "failed" |
| Kill switch | Hospital-wide and per-capability switches read in the kernel; off means the call is never made |
| Egress | Only the cloud adapter can leave the box, only if the hospital turned it on for that capability, only to the allowlist (`check-egress-allowlist`) |

Domain stays above the kernel: prompts, section schemas, the medicine/negation guards (§6), the
consent rule, the identifier list for redaction, ICD/SNOMED lookup. They live in
`medbrains-dictation` (renamed in scope to the voice brick) and `medbrains-health-services`.

`medbrains-dictation` moves onto `kernel::ai` in phase V0: its `stt.rs` and `llm::extract_with`
calls become kernel calls, its settings become the AI service's settings. Behaviour unchanged.

### 5.3 MCP

The same kernel interface is what the MCP server (RFC-HOSPITAL-OS §8f M1, RFC-AI-NATIVE layer 3)
exposes. An approved outside assistant (any vendor) signs in as a connected app (OAuth, revocable)
acting for a named user, and its calls go through the same capabilities, permissions, basis checks,
redaction and audit. Its writes are `Draft<T>` only; a person decides in MedBrains. Outside clients
get no raw audio and no transcript unless the capability allows it and the hospital approved that
app for it.

### 5.4 Device side

| Surface | Capture | On-device model | Result path |
|---|---|---|---|
| Web | `MediaRecorder` (opus/webm), as today; adds 15 s chunk upload while recording (V1b) | None in V1; WebGPU Whisper is a later option | Server → `kernel::ai` |
| iOS | `AVAudioEngine`, AAC/opus, `NSMicrophoneUsageDescription` | Optional later: on-device Whisper (Core ML) or Apple's on-device speech for live captions only | Audio or on-device transcript → server → `kernel::ai` (a device transcript is still a draft input, never a record) |
| Android | `AudioRecord`/`MediaRecorder`, `RECORD_AUDIO` | Optional later: whisper.cpp/ONNX on device | Same |

A device never calls a language model directly and never writes a note from a device-made draft:
the server structures, the kernel gates, the clinician decides on the screen.

### 5.5 Speech engine choices

| Option | Licence | Runs on | Cost | Fit |
|---|---|---|---|---|
| **whisper.cpp** (current) | MIT | CPU, Metal, CUDA, Vulkan | Hardware only | Default. Supports a `prompt` for vocabulary and `verbose_json` segments |
| faster-whisper (CTranslate2) | MIT | CPU, CUDA | Hardware only | Faster on NVIDIA; Python runtime adds weight; later option |
| IndicConformer / Vistaar IndicWhisper | MIT per repo (verify weights) | CPU/GPU (ONNX or PyTorch) | Hardware only | Hindi, Tamil, Telugu and others; V6 |
| Parakeet-TDT-0.6B-v2 | CC-BY-4.0 | GPU best | Hardware only | English only; candidate if it beats Whisper on our Indian-English set |
| Cloud: Sarvam, Deepgram medical, others | Commercial | Their cloud | ₹30/h (Sarvam); $0.0077/min (Deepgram streaming) | Opt-in per hospital, per capability, DPA, data in India where required |

Cost at 100 consults a day, 2 minutes of dictation each (200 min/day): local ₹0 beyond the box;
Sarvam about ₹100/day; Deepgram about $1.5/day. Language model local only by default.

Choice is made by our own evaluation set (§11), not by brand: Indian-English clinical dictations,
then code-mixed sets per language, recorded with consent from staff volunteers reading synthetic
scripts in real OPD noise.

---

## 6. Safety rules

| # | Rule | Mechanism |
|---|---|---|
| S1 | AI drafts, a clinician approves every part | `Draft<T>` / `decide()` (§5.2); section-by-section accept; nothing pre-ticked; no accept-all on clinical sections |
| S2 | Every AI field is labelled, on every surface, before and after acceptance | `ai` provenance block → `AiLabel` on web, the native kits' label; `check-ai-label` (web, then native) |
| S3 | A dictated medicine meets every check a typed one meets | Medicines are only ever offered to the prescription pad, which runs allergy, DDI, dose, duplication, schedule (H/H1/X, NDPS) and stewardship checks (`evaluate_medication_safety_in_tx`); dictation never writes a prescription (slice 1 already) |
| S4 | Drug names, doses and numbers must be in what was said | Deterministic guard after drafting: each medicine name, dose and number in the draft must fuzzy-match a span of the transcript; if not, the line is marked **"not in what you said"** and cannot be accepted without an edit |
| S5 | Negations survive | Guard: negation cues in the transcript (no, not, denies, nil, absent, negative for, without; and per language, e.g. "nahi", "illai", "ledu") and the finding they govern must appear negated in the draft; a dropped negation marks the sentence **"check: negation"** |
| S6 | Every sentence is traceable | The model returns, per section, the transcript quote it used; the server checks the quote is a substring of the transcript (cheap grounding); a section with no verified quote is marked **"not found in what you said"**. Tapping a sentence jumps to its place in the transcript and audio while the audio exists |
| S7 | "Not heard" is shown, not guessed | Request `verbose_json` segments from whisper; segments with low average log-probability or high no-speech probability are underlined **"unclear"** in the transcript; the draft banner counts them. Long silences are cut before transcription (the "Careless Whisper" failure is worst in pauses) |
| S8 | Codes come from the terminology, not the model | The model gives the diagnosis words; ICD-10 / SNOMED CT codes come from a lookup in the terminology tables and are shown "suggested, verify"; no code is invented |
| S9 | Never auto-sign | Accepted text reaches the note as a draft; signing is the existing step, by the clinician |
| S10 | Charted facts beat speech | Vitals, MAR and results are pulled from the record; a spoken number that conflicts is flagged, never written over the record |
| S11 | Failure is visible | Every failure has a plain message and the manual path (§9 failure table); an empty draft is never shown as "nothing said" |
| S12 | Evaluated before use | A model or prompt reaches users only after passing `medbrains-ai-eval` for its capability, including negation, drug/dose, omission and code-mixed cases |

---

## 7. Permissions first

Defined in Rust (`crates/medbrains-core/src/permissions.rs`, with `///` docs), generated to TS,
granted in `access/roles.rs`, before any handler or screen. Proposed:

| Code | First doc sentence (UI label) | Granted to | Phase |
|---|---|---|---|
| `opd.dictation.use` | exists | doctor | built |
| `admin.settings.dictation.manage` | exists; becomes the AI service settings for voice | (bypass) | built |
| `ipd.dictation.use` | Dictate ward round notes. | doctor | V3 |
| `ipd.handover.dictation.use` | Dictate a nursing handover. | nurse | V3 |
| `ipd.discharge_summary.ai_draft` | Draft a discharge summary with AI. | doctor | V4 |
| `opd.ambient.use` | Record the consultation with consent. | doctor | V5 |
| `opd.ambient_consent.record` | Record a patient's recording consent. | doctor, nurse, front office | V5 |
| `ai.governance.view` | See AI suggestion outcomes. | (bypass); custom clinical-safety role | V1 |
| `admin.ai.service.manage` | Manage the AI service and models. | (bypass) | V0 |

Every voice panel also needs the write permission of the record it fills (`clinical_notes.write`,
`ipd.progress_notes.create`, `ipd.handover.create`, `ipd.discharge_summary.create`); medicine and
order lines need the pad's and the basket's own permissions (`clinical.order_basket.draft`). Each
call checks patient access (`require_patient_access`, 404 when denied). A capability's permission is
the narrowest that fits (AI-NATIVE §1, least privilege). For PHI, each code is proven with a key
that lacks it (403).

---

## 8. Consent, retention and deletion

**Dictation (doctor's voice).** The doctor dictates about a patient they are treating; the recording
exists only to draft that note. Covered by the hospital's treatment notice at registration; the
patient-facing notice must say notes may be dictated and transcribed on the hospital's own machine.
To confirm with counsel against the DPDP Act 2023 and Rules 2025 (notice and consent duties apply
from about May 2027; consent managers from November 2026).

**Ambient (patient's voice, V5).** Explicit consent per visit, before recording:

- asked by the doctor or front office in the patient's language, recorded as a consent record
  (who asked, how: verbal witnessed or signed on the tablet; owner question 2), revocable at any
  time during the visit, which stops and deletes the recording;
- a refusal changes nothing about care; the doctor dictates or types;
- the recording screen shows "Recording, patient consented at 10:42" for the whole visit;
- minors and patients without capacity: consent from the guardian; Mental Healthcare Act 2017
  settings default to ambient off.

The ICMR 2023 ethical guidelines for AI in healthcare (patient may refuse AI, accountability,
transparency) are met by the same mechanism.

**Retention** (unchanged from slice 1 by default):

| What | Default | Hospital setting |
|---|---|---|
| Audio | Deleted when the review is saved or rejected; purge after 24 h if abandoned | Owner question 6: allow a dispute window (e.g. up to 30 days, the shortest vendor practice) or never |
| Transcript and draft | Kept with the saved note as provenance; deleted on reject / 24 h | Same retention as the note |
| Signed note | The legal record; retained per medical-record rules (at least 3 years per IMC Regulations 2002 §1.3.1; NMC 2023 text to verify; longer per hospital policy and MLC rules) | — |
| Suggestion outcomes | Kept (governance), append-only | — |
| On-device audio | Encrypted (iOS Data Protection complete; Android encrypted file), deleted after upload; never in backups; ≤ 5 queued, ≤ 24 h, then deleted with a notice | — |

Deletion is a real DELETE (no tombstone, no audit copy of the words); WAL and backups age out per
the backup runbook (dictation RFC §3).

---

## 9. Offline behaviour and failure table (flight rules)

The AI service is on the hospital's LAN, so an internet outage does not stop it. What can fail:

| Failure | Detect | Effect | What the system does | What the clinician sees |
|---|---|---|---|---|
| AI service down | socket refused / health check | No drafts | Kernel returns `Unknown`; audio kept 24 h for retry; server unaffected | "Voice notes are not available right now. Your recording is kept; try again, or type." |
| Model slow / queue full | deadline, queue bound | Late draft | Job refused at queue bound; deadline miss → `Unknown`, never a partial draft | "Busy, your recording is kept. Try again in a minute." |
| Model loading after update | service state | Delay | Interactive lane waits ≤ 10 s then refuses | "Voice notes are starting up." |
| Wrong language detected / low confidence overall | language id, mean confidence | Bad draft | No draft; transcript shown with "unclear" spans | "Much of this was unclear. Check the transcript or dictate again." |
| No speech | whisper no-speech | Nothing | No draft | "No speech was heard." |
| Hallucinated / ungrounded sentence | S6 quote check | Wrong text | Sentence marked | "Not found in what you said" |
| Drug/dose not in transcript | S4 guard | Wrong Rx | Line blocked until edited | "Not in what you said" |
| Memory pressure | cgroup `MemoryMax`, OOM | AI killed | systemd restarts it; server keeps running (higher weight, lower OOM score) | As "AI service down" |
| Disk full on data partition | free-space check before load / upload | No new recordings | Upload refused before recording starts | "This machine is low on space; voice notes are paused. Tell IT." |
| Unsigned or tampered model | signature check at load | No model | Refused, previous model kept | Health screen: "Model refused: signature" |
| LAN down (device) | request failure | Not sent | Native: encrypted local queue (bounded); web: kept in memory only, never stored in the browser | "Not sent yet, will send when connected" (native) / "Not sent, try again" (web) |
| Cloud adapter down (opt-in hospitals) | timeout | No cloud | Falls back to local if a local model is installed; else as "service down" | Same as local failure |
| Kill switch off | config | No AI | Controls hidden; manual form unchanged | Nothing AI-related shown |

Fault injection before V2 ships: kill the AI service mid-job, fill the data partition, load a bad
model signature, run 3× the interactive bound, cut the LAN on a phone mid-upload. Each must land in
the row above.

---

## 10. UI plan, per surface

Common to all surfaces: one record button with a text label and the elapsed time (never colour
alone); states **idle → recording → sending → processing → review → saved**, plus **error**,
**offline/queued**, **busy**, **permission-denied (hidden)**, **AI off (hidden)**; `AiLabel` on
every drafted part; accept / edit / reject per section and per line; flags from §6 as text badges
with an icon (`tone="warning"`), never colour alone; the transcript beside the draft with "unclear"
spans underlined and named for screen readers; reduced motion replaces the pulsing dot with a
static one.

### 10.1 Web (OPD consult, IPD round, handover, discharge)

| Item | Plan |
|---|---|
| Placement | OPD: the existing `DictationPanel` on the Consultation tab (unchanged place). IPD round: a dictate button per row of the round list and on the progress-note editor. Handover: on each patient card of the handover screen. Discharge: "Draft with AI" in the discharge summary editor header |
| Layout | Review: two columns ≥ 1024 px (draft sections left, transcript right), stacked below; medicines and orders as lines under the Plan section, each with **Add to pad** / **Add to basket** |
| Components | Seam only: `Card`, `Button` (tone), `Badge`, `Alert`, `TextArea`, `AiLabel`, `Modal` (full-screen review on narrow screens); no new primitive except a `TranscriptSpan` (`Text` with `aria-describedby` for "unclear") added to the seam |
| States | recording (status region, clock, Stop); processing ("Drafting, you can keep working"); review; error (step that failed + Try again + Type instead); busy; not-sent (retry, audio held in memory); permission-denied and AI-off render nothing |
| Data | TanStack mutations as today; chunk uploads in V1b; review saved through the record's normal draft save |
| Permissions | Panel gated on the dictation code **and** the record's write code (`useHasAllPermissions`); no query issued without them |
| A11y | Keyboard shortcut to start/stop (announced, configurable, not a single key); focus moves to the review heading when the draft arrives; `role="status"` live region for state changes; ≥ 24 px targets (web rule); visible 2 px focus |
| Safety | Flags S4–S7 visible on the section; a blocked medicine line cannot be added until edited; signed state unchanged |

### 10.2 iOS (SwiftUI) and Android (Compose), in lockstep

| Item | Plan |
|---|---|
| Placement | Doctor: `ConsultationView` (toolbar mic button + bottom record bar), `IpdRoundsView` (per-bed mic). Nurse: `ShiftHandoverView` (per-patient mic). Gated at runtime by permission, per the one-app-per-audience rule |
| Layout | Record bar pinned to the bottom (thumb reach): big Record/Stop, clock, Cancel. Review is a full-screen sheet: sections as cards, accept/reject per card, edit inline; transcript in a second tab |
| Components | MedBrainsUI / Compose kit: new `AiLabel` and `AiDraftCard` (accept/edit/reject) components shared by every feature, not per screen |
| States | As common; offline: "Saved on this phone, will send when connected" with the queue count; mic permission refused by the OS: explanation + "Open Settings"; app backgrounded while recording: recording continues only with the system recording indicator, stops at 10 min |
| Targets | ≥ 44 pt / 48 dp everywhere; Record ≥ 64 pt |
| A11y | VoiceOver/TalkBack labels ("Start dictation", "Stop, 1 minute 20 seconds"); haptic on start/stop; Dynamic Type; no colour-only flags |
| Constraints | Bounded queue (5 recordings, 24 h), audio deleted after upload, memory flat over a shift (DEVICE-CONSTRAINED rules), long-session journey test (sign in once, dictate on 5 beds with Back and tab switches) |

### 10.3 Desktop, TV, kiosk

Desktop uses the web plan. TV and kiosk: no AI controls (nobody can accept a draft there).

---

## 11. Budgets and metrics

| Budget | Target | Note |
|---|---|---|
| Draft ready after Stop, 2 min dictation, p90 | ≤ 15 s on the hospital-edge kit; ≤ 45 s CPU-only | Chunked transcription while speaking (V1b) brings transcription to ≈ 0 after Stop; drafting dominates |
| Transcript ready after Stop, p90 | ≤ 5 s with chunking | |
| AI service memory | within its `MemoryMax`; server memory budgets unchanged | `budgets.json` adds `ai_service_mb` |
| System partition | +0 MB of models; ≤ 8 MB binary | Stays ≤ 1,300 MB |
| Cost | ₹0 per consult locally | Cloud opt-in shown per month on the settings screen |

| Metric | Source | Goal |
|---|---|---|
| Time per consult (encounter open → note signed) | encounter and note timestamps | Lower than the doctor's own typed baseline |
| Dictation start → saved | `dictation_sessions` (exists) | Falling |
| Clicks/keystrokes per note | client counter on the review (counts only) | Fewer than typed |
| Edit ratio per section | `ai_suggestion_outcomes.edit_ratio` (exists) | Falling; alarm if a model update raises it |
| Rejection rate, flag rate (S4–S7), "unclear" rate | outcomes and flags | Watched per model and per language |
| Adoption | sessions per doctor per week | Rising without mandates |
| Safety events | incident reports tagged AI | Zero tolerated; each one a DECISIONS failure row |

A KPI tile ("Voice notes this week") on the management dashboard, gated by `ai.governance.view`.

---

## 12. Phases (each one PR, each ending on a screen)

| Phase | Scope | Exit |
|---|---|---|
| **V0 Kernel and OS service** | `kernel::ai` (transcribe, extract, decide; Capability, Draft/Accepted types, audit rows, rate limits, kill switch); `medbrains-ai.service` with systemd + AppArmor, unix socket, bounded queue, probe, models on the data partition; dictation moved onto it, behaviour unchanged; `admin.ai.service.manage` + health screen line | `check-kernel-no-domain` green; failure table rows 1–3, 7–9 injected and passing; dictation e2e unchanged |
| **V1 Safer OPD dictation (recommended first slice)** | On the existing web OPD panel: whisper `verbose_json` + "unclear" spans; vocabulary prompt from the hospital formulary and the doctor's frequent drugs; S4 drug/dose guard, S5 negation guard, S6 quote check; codes from the terminology lookup (S8); investigations → basket lines and follow-up date drafts; `ai.governance.view` + outcomes KPI tile | Eval set (≥ 100 synthetic Indian-English dictations incl. negations and doses) passes the bar; on-screen check as a doctor; edit ratio and time measured on a pilot |
| V1b | Chunked upload while recording (latency) | p90 budget met |
| **V2 Native doctor** | iOS + Android OPD consult dictation with the shared AI kit, encrypted bounded queue | Long-session journey green on both; 44 pt; memory flat |
| **V3 IPD round + nursing handover** | `ipd.dictation.use`, `ipd.handover.dictation.use`; web + native | On screen as doctor and nurse |
| **V4 Discharge summary draft** | From coded stay records + dictated course; per-sentence sources | Finalised through the existing path; eval bar |
| **V5 Ambient OPD** | Consent record + `opd.ambient.use`; both voices, speaker labels; written SaMD classification first | Consent refused path tested; SaMD note signed |
| **V6 Indian languages** | Hindi, Tamil, Telugu, code-mixed; note written in English with the original transcript kept | Per-language eval sets pass |
| V7 MCP | Kernel AI capabilities exposed to approved outside assistants | 403 proven for a capability the app lacks |

**Why V0 before V1.** V0 is small if it only moves the existing calls (the mechanism already exists
in `medbrains-dictation`), and building V1's guards on top of the kernel means IPD, handover, native
and MCP inherit them instead of copying them. V1 is the smallest slice a doctor notices. If the owner
wants that win sooner, V1 can land first inside `medbrains-dictation` and V0 moves it afterwards, at
the cost of one extra move. Owner question 1.

---

## 13. Open questions for the owner

1. **Order:** V0 (kernel + OS service) before V1 (safer OPD dictation), or V1 first for a visible win?
2. **Ambient consent:** verbal consent witnessed and recorded by staff, or signed on a tablet per visit?
3. **AI service default:** on or off on a new install? (Recommended: off until the wizard step "Voice notes: install models".)
4. **Cloud:** allow cloud speech (e.g. an Indian provider) as an opt-in in V1, or local only until V6?
5. **Hardware floor:** is a CPU-only box acceptable for transcription only, with drafting requiring the 16 GB edge kit?
6. **Audio dispute window:** keep audio only until save (current), or allow a hospital-set window up to 30 days?
7. **Note language:** for Indian-language dictation, the note in English, in the spoken language, or both?
8. **Who sees AI governance** (outcomes, edit rates per doctor): a clinical-safety role only, or department heads too?
9. **SaMD review for ambient (V5):** an outside regulatory consultant or an internal clinical-safety lead?
10. **Evaluation recordings:** may staff volunteers record synthetic scripts in real OPDs to build the Indian-English and code-mixed test sets?
11. **Model downloads:** who approves the first model files (each is a large download and a licence check)?

---

## 14. Decisions

None yet: everything above is a proposal until the owner answers §13. Rows go into
`docs/DECISIONS.md` as each is agreed.

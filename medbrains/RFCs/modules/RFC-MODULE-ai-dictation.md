# RFC-MODULE: AI notes from dictation

| | |
|---|---|
| Status | Slice 1 built (OPD consultation, doctor's voice only) |
| Crate | `crates/medbrains-dictation` |
| Screen | OPD encounter → Consultation tab → "Dictate this consultation"; Settings → Dictation |
| Permissions | `opd.dictation.use` (doctor), `admin.settings.dictation.manage` (admin) |
| Migration | `1419_ai_dictation.sql` |

## 1. Why

Typing is the biggest burden that paperless records put on doctors. The rule
for this module: **a doctor's time per patient must not go up.** Dictation
lets the doctor speak the consultation; a draft appears in the note's own
sections; the doctor accepts, edits or rejects each one and signs as always.

## 2. Scope of slice 1

In:

- OPD consultation only, the doctor's own voice, recorded in the browser
  (MediaRecorder) or uploaded as a file. At most 10 minutes and 24 MB.
- Speech to text behind a provider trait (`stt.rs`):
  - **local** (default): a whisper.cpp `whisper-server` on the hospital's
    own machine; its address is a tenant setting;
  - **cloud** (off by default): an OpenAI-compatible
    `/v1/audio/transcriptions` service, used only when an admin turns it on,
    https only, with the key read only from this tenant's own dictation
    secrets (`medbrains/<env>/<tenant>/dictation-<name>`).
- Structuring through the existing AI layer (`medbrains-server-services::llm`):
  the transcript is redacted with this patient's identifiers
  (`medbrains_ai::session_for`, `ai_redact`), sent to the **local** Ollama
  model (never the tenant's assistant provider), and re-hydrated. The draft
  is laid out in the consultation note's sections: Subjective (complaint +
  history), Objective (examination), Assessment (diagnoses, with ICD-10 codes
  marked "suggested, verify"), Plan.
- Medicines become draft lines the doctor accepts one by one onto the
  prescription pad (Prescriptions tab → "Add dictated medicines"). They are
  prescribed there, through the existing allergy, interaction, dose,
  duplication, schedule and stewardship checks. Dictation never writes a
  prescription.
- Review: the draft beside the transcript, each section editable, each
  accepted or rejected. Save puts the accepted text into the doctor's
  consultation note through the normal draft save (marked AI-assisted, the
  acceptance audited there); the doctor signs on the case sheet as always.
  Nothing is filed automatically.

Out (later slices):

- **Ambient / patient-voice mode** (recording the conversation, not the
  doctor's dictation). It records the patient, so it needs the patient's
  informed consent under DPDP before it is built. Not in slice 1.
- Slice 2: nursing notes, ward rounds (IPD), Indian-language handling
  (Hindi, Tamil and code-mixed speech; transliteration into the note),
  streaming transcription while the doctor speaks, a KPI tile from the
  measurements below.

## 3. Data, privacy and retention (DPDP Act 2023)

| What | Where | Kept |
|---|---|---|
| Session metadata | `dictation_sessions` (audited: status, adapter, model, sizes, times; no words) | Kept |
| Recording | `dictation_audio` (separate table, no audit trigger, no soft delete) | Deleted when the review is saved or everything is rejected, when the transcript is too long to use, or by the purge pass 24 hours after an abandoned recording |
| Transcript and draft | `dictation_content` (separate table, no audit trigger, no soft delete) | Kept with a saved note, as provenance; deleted when everything is rejected, and by the purge for any session not saved after 24 hours |
| Decisions | `ai_suggestion_outcomes` (no audit trigger: it holds suggestion text; append-only: a trigger refuses any change but a soft delete, and any physical delete) | Kept: AI-governance records (suggested text, final text, accepted / edited / rejected, word edit distance and ratio, model, who, when) |
| Use | `audit_log` actions `dictation_used`, `dictation_recordings_purged`, `dictation_settings_saved` | Kept (hash-chained); counts and ids only, never words |

The purge (`purge.rs`) runs every 15 minutes on the worker pool. It lists
tenants from `tenants`, then counts and deletes each tenant's expired data in
its own kernel unit of work as the system actor (tenant context set, so it
sees that tenant's rows under RLS whatever role the pool is), writing one
`dictation_recordings_purged` audit row for each tenant that had something
to purge. A tenant that fails is logged and skipped; the pass carries on.
Each pass logs `held_past_limit`, `purged`, `tenants` and `tenants_failed`,
even when zero, so a stuck purge shows as a count that never falls.

Deleted rows still sit in PostgreSQL's write-ahead log and in base backups
until those age out: a recording or transcript deleted here is gone from the
live database at once, and from WAL archives and backups only after the
backup retention period (set in the backup runbook). Backups are encrypted at
rest and restored only under the recovery procedure; a restore older than 24
hours is followed by a purge pass before the system is used.

- Purpose limitation: the recording exists only to draft this note.
- Nothing leaves the hospital by default: both the speech server and the
  model are local. Turning the cloud service on is an admin decision, audited
  (`dictation_settings_saved`), and the settings screen warns that recordings
  will leave the hospital and should only go to a service with a DPA that
  keeps data in India.
- The model never sees identifiers: the transcript passes through `ai_redact`
  (fail closed: if it cannot be made safe, nothing is sent and the doctor is
  told so). Restricted clinical classes are withheld from the model; the
  doctor still sees them in the transcript.

## 4. Regulatory position (CDSCO SaMD)

Dictation is a **documentation aid, not a diagnostic device**. It writes down
what the doctor said; it does not interpret, diagnose or recommend. ICD-10
codes are shown as "suggested, verify", medicines are suggestions on the
prescription pad, and every section needs the doctor's explicit acceptance.
The doctor decides and signs. Under the Medical Devices Rules 2017 software
that only records and formats a clinician's own words is not intended for
diagnosis or treatment decisions; if a later slice adds clinical suggestions
the doctor did not say, that position must be reassessed first.

## 5. Permissions and access

- `opd.dictation.use` — granted to the built-in `doctor` role. The panel also
  needs `clinical_notes.write` (it saves into the note) and is hidden without
  both.
- `admin.settings.dictation.manage` — no built-in role; admins hold it by
  bypass, and it can be granted to a custom role.
- Per record: every call checks patient access through the existing gate
  (`require_patient_access`); a doctor with no access gets 404, never a hint
  that the visit exists. A session is its creator's alone (404 for anyone
  else). Only the visit's own doctor dictates on it (admins excepted), and only
  while the visit is open.
- Settings are written only through `/api/admin/dictation/settings`. Every
  generic writer (the settings route and the config import) calls one check,
  `medbrains_server_core::settings_guard::refuse_own_endpoint_category`,
  and refuses the `dictation` category; the config export leaves it out. The
  local speech and model addresses must be loopback or private (RFC 1918,
  IPv6 unique-local) IP literals or `localhost`. Link-local addresses are
  refused altogether (cloud metadata and credential services: 169.254.169.254,
  169.254.170.2), and so is `fd00:ec2::254`. A stored value that fails
  validation is read as the local defaults with the cloud off. The speech
  client follows no redirect and uses no proxy. The model call goes through
  rig's client, which offers neither setting; it carries no credential and its
  address is held to the same rule.

## 5a. Bounds

- Upload: 24 MB, enforced by the route's body limit; held as one buffer (the
  multipart form, with the stored audio a slice of it).
- `duration_ms` is the browser's measure: used for the KPI only, never as a
  bound.
- One dictation at a time per doctor (a unique index on `processing`); a
  session stuck in `processing` for 5 minutes is released as interrupted.
- Speech server answer: at most 1 MB read. Transcript: at most 100,000
  characters, else the session fails as too long and the recording is deleted.
- Speech call 120 s, model call 90 s.
- A tenant that has turned AI off (`ai.config.assistant_enabled = false`)
  still gets transcripts, but nothing is drafted.

## 6. Failure modes

| Failure | Status | What the doctor sees |
|---|---|---|
| Speech server down / times out (120 s) / errors | `stt_failed` | "Speech-to-text is not available, so nothing was transcribed. Type the note as usual, or try again." Recording kept 24 h for "Try again" |
| Recording has no speech | `no_speech` | "No speech was heard in the recording. Nothing was drafted." |
| Model down / times out (90 s) / errors | `llm_failed` | The transcript, and "the note could not be drafted from it: the model is not available" |
| Model answers with nothing | `llm_failed` (`llm_empty`) | As above: an empty draft is never shown as if nothing was said |
| Transcript cannot be redacted | `llm_failed` (`llm_unsafe`) | "could not be made safe to send … nothing was sent" |
| Transcript too long | `stt_failed` (`transcript_too_long`) | "too long to draft a note from, so it was deleted" |
| AI turned off for the hospital | `llm_failed` (`ai_disabled`) | The transcript, and "AI drafting is turned off" |
| A dictation already processing | 409 | "Your last dictation is still being transcribed" |

## 7. Measurement

- `dictation_sessions.started_at` (upload time minus the recording's length)
  and `saved_at`: time from dictation start to save. Also in the
  `dictation_used` audit row as `seconds_from_start`.
- `ai_suggestion_outcomes.edit_ratio` per section: words changed divided by
  the suggestion's words (0 = taken as written).

## 8. Endpoints

| Method | Path | Permission |
|---|---|---|
| POST | `/api/opd/encounters/{id}/dictations?duration_ms=&source=` (body: the audio) | `opd.dictation.use` + patient access |
| POST | `/api/opd/dictations/{id}/retry` | as above, own session |
| POST | `/api/opd/dictations/{id}/review` | as above, own session |
| GET, PUT | `/api/admin/dictation/settings` | `admin.settings.dictation.manage` |

## 9. Setup on the hospital's machine

Nothing is downloaded by MedBrains. Model and binary downloads are approved by
the owner separately; these are the commands to run once approved.

whisper.cpp speech server (CPU is enough for dictation; `ffmpeg` lets it read
the browser's webm/opus):

```sh
brew install ffmpeg            # or: apt-get install -y ffmpeg
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
cmake -B build && cmake --build build -j --config Release
sh ./models/download-ggml-model.sh small.en     # or: medium for Indian English accents
./build/bin/whisper-server -m models/ggml-small.en.bin \
  --host 127.0.0.1 --port 8178 --convert
```

Local model (Ollama):

```sh
curl -fsSL https://ollama.com/install.sh | sh   # macOS: brew install ollama
ollama pull llama3.2
ollama serve                                    # listens on 127.0.0.1:11434
```

Then Settings → Dictation: speech-to-text server `http://127.0.0.1:8178`,
local model server `http://127.0.0.1:11434`, model `llama3.2` (these are also
the defaults). For the cloud service, put its key in the secret store as
`medbrains/<env>/<tenant id>/dictation-<name>` and enter only `<name>`. Check with a dictation on a test visit.

## 10. Tests

- Integration (`crates/medbrains-server/tests/ai_dictation_test.rs`, fake
  whisper and fake model servers): happy path with edit sizes, recording
  deleted at save and transcript kept, audit row; speech server down and a
  retry; model down; cloud adapter configured but disabled is never called;
  every section rejected files nothing; a dictated medicine still meets the
  allergy check; no access → 404 and no session, nurse → 403; abandoned
  recording purged after 24 hours; settings refuse an http cloud and default
  to local.
- Unit: adapter choice, multipart body, layout into sections, ICD shape,
  word edit distance.
- Vitest: `DictationPanel.test.tsx`, `dictatedRx.test.ts`.
- Playwright: `e2e/journeys/ai-dictation.spec.ts` (upload path, fakes).

# MedBrains extension protocol, version 1

An extension is a separate service — any language, any host — that a hospital lets into its
MedBrains. It never touches the database. It signs in as itself, calls the API with exactly the
permissions the hospital granted, and is told about events with signed webhooks. Revoking it cuts
it off on its next call.

This is phase E1 of RFC-HOSPITAL-OS §8g. SDKs: TypeScript [`@medbrains/sdk`](../../packages/sdk)
(with the `medbrains ext` CLI) and Python [`medbrains-sdk`](../../sdks/python).

## 1. The life of an extension

1. **Write a manifest** (`medbrains ext init` makes one). It says what the extension does and what
   it needs — §3.
2. **The hospital registers it.** An admin pastes the manifest into **Admin → Connected apps →
   Register app**. The server validates it and shows the client ID, client secret and (if the
   manifest has events) the webhook signing secret **once**. Only Argon2/SHA-256 hashes are kept.
3. **The hospital approves it** after reading its privacy label (permissions, data classes, where
   data goes). Until then the extension cannot sign in. Nobody can approve an app with
   permissions they do not hold themselves.
4. **The extension signs in and calls the API** — §4.
5. **The hospital can revoke it** at any time. Its live tokens are revoked in the same transaction
   and its event deliveries stop. A revoked app is registered again, never re-approved.
6. **Rotate secret** issues a new client secret; the old secret and every live token stop at once.

## 2. Versioning

The protocol is versioned as a whole (`manifestVersion: 1`, this document). Additions that cannot
break a v1 extension (a new readable resource, a new event, a new optional manifest field) land in
v1. Anything else is v2, with both served side by side for a deprecation window
(OS-PRINCIPLES §4, stable interfaces).

## 3. The manifest

One manifest for every kind of extension — background service, SMART app, MCP tool, WASM block
(RFC-HOSPITAL-OS §8f item 3). JSON Schema: [`manifest.schema.json`](manifest.schema.json).
Examples: [`fixtures/valid/`](fixtures/valid).

| Field | Required | Meaning |
|---|---|---|
| `manifestVersion` | yes | `1` |
| `kind` | yes | `service`, `smart-app`, `mcp-tool` or `wasm-block` (blocks install through the store, phase K4 — not registrable as apps) |
| `name`, `purpose` | yes | `purpose` is one sentence, what it does for the hospital |
| `publisher` | yes | `{ name, url?, contact? }` |
| `version` | yes | semantic version |
| `permissions` | yes | MedBrains permission codes, 1–50. No wildcards, no bypass roles. The extension gets these and nothing else — no role |
| `reads` | no | FHIR R4 resources it reads: `Patient`, `Encounter`, `Observation` |
| `events` | no | event names it wants as webhooks |
| `dataClasses` | yes | `routine`, `sensitive`, `identifying`, `restricted`, `confidential`, `sealed` |
| `sendsDataTo` | no | `[{ name, url, purpose }]` — where hospital data goes. Say the country |
| `webhookUrl` | no | public HTTPS address for events |
| `redirectUris` | no | HTTPS, for SMART app launch (later phase) |
| `inputSchema`, `outputSchema` | no | JSON Schema objects, for MCP tools and blocks |

Rules the schema cannot express, enforced at registration (and by `medbrains ext validate`,
except the event-name check, which needs the server):

- each `reads` entry needs its permission: `Patient` → `patients.view`, `Encounter` →
  `opd.queue.view`, `Observation` → `lab.orders.view`;
- `events` need a `webhookUrl`, and each must be an event MedBrains sends;
- an extension that reads or receives anything must list `sendsDataTo`;
- `webhookUrl` must be public HTTPS — not localhost or a private address.

Every problem is reported at once. The server answers `400` with the list.

## 4. Signing in and calling the API

OAuth 2.0 client credentials (RFC 6749 §4.4), the SMART Backend Services shape.

```
POST /api/oauth/token
Authorization: Basic base64(client_id:client_secret)      (or client_id/client_secret in the form)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials[&scope=patients.view]
```

```json
{ "access_token": "mb_live_…", "token_type": "Bearer", "expires_in": 900, "scope": "patients.view" }
```

- Tokens live **15 minutes**. Reuse one until a minute before it expires; the SDKs do this.
- `scope` may narrow the grant (space-separated permission codes). Asking for anything not granted
  is `invalid_scope`, never silently trimmed. `system/<Resource>.read` scopes are accepted and
  ignored — FHIR access follows from permissions.
- Errors (RFC 6749 §5.2): `invalid_client` 401 (unknown client or wrong secret — never says
  which), `unauthorized_client` 400 (right secret, but pending approval or revoked),
  `unsupported_grant_type` 400, `invalid_scope` 400, `slow_down` 429 (more than 20 live tokens —
  reuse yours), `temporarily_unavailable` 503 (the hospital could not decide — retry with
  backoff; it is **never** reported as a credential failure). Every answer is `Cache-Control:
  no-store`.
- The endpoint allows 5 requests a minute per IP, because each costs an Argon2 hash.

Call the API with `Authorization: Bearer <access_token>`. Every call goes through the same checks as
MedBrains' own code: the permission, then per-record access (a patient must be shared with the
extension — Patient → Share access, granting its service identity), consent, field redaction and audit — with the
extension's own identity as the actor. Answers:

| Status | Meaning |
|---|---|
| `401` | token expired, revoked or rotated — sign in again; if that is refused, you were revoked |
| `403` | the extension lacks the permission |
| `404` | no such record, **or** a record the extension may not see (indistinguishable on purpose) |
| `429` | over the per-token rate limit (600 a minute) |
| `503` | the hospital could not decide (authorisation backend down) — retry; never treat as "no data" |

### Endpoints in v1

| Method | Path | Permission |
|---|---|---|
| `GET` | `/api/fhir/metadata` | none (CapabilityStatement) |
| `GET` | `/api/fhir/Patient/{id}` | `patients.view` |
| `GET` | `/api/fhir/Encounter/{id}` | `opd.queue.view` |
| `GET` | `/api/fhir/Observation/{id}` | `lab.orders.view` |

Responses are FHIR R4 JSON (`application/fhir+json`), NRCeS/ABDM profiles where they apply.

## 5. Events (signed webhooks)

The manifest's `events` are the subscription: the hospital approves them with the app, so an
extension cannot widen what it is told about without a new registration. Deliveries start at
approval and stop at revocation.

```
POST <webhookUrl>
Content-Type: application/json
X-MedBrains-Event: patient.created
X-MedBrains-Delivery: 7b0e…            (same as body.id)
X-MedBrains-Signature: t=1700000000,v1=<hex>

{ "id": "7b0e…", "type": "patient.created", "created_at": "…", "data": { "patient_id": "…" } }
```

- **Signature:** `v1` is hex HMAC-SHA256, keyed with the webhook signing secret, over
  `"<t>.<raw body>"`. Verify against the raw bytes, with a constant-time compare. Test vector:
  secret `secret`, `t=1700000000`, body `{"a":1}` →
  `49f24e537407743fa4a0242bb63b94b9a47ee99cbbe071ccd8a22550ae411686`.
- **Replay window:** refuse a `t` more than 5 minutes from your clock.
- **Idempotency:** `id` is the same on every retry of one delivery. Store it and ignore repeats.
- **Minimal data:** `data` carries identifiers, numbers and statuses only — never names or clinical
  text. Read details through the API, under your permissions.
- **Answer fast.** `2xx` is delivered. `5xx`, `429` or no answer is retried with backoff, up to 10
  attempts, then given up (shown as *gave up* in Connected apps). Any other `4xx` is a refusal and
  is not retried.

## 6. Security properties a hospital can rely on

- The extension holds exactly its manifest's permissions; a role change elsewhere never widens it.
- Secrets are shown once and stored hashed; a lost secret is rotated, not recovered.
- Revocation and rotation take effect on the next call (the token is checked against the database
  on every request).
- Every token issued, every approval, revocation and rotation is in the hash-chained audit log;
  every API call is in the token's usage log.
- A fault is never a permission: an outage is `503`, never `200`, never "invalid credentials".

## 7. Not in v1

FHIR search and write (C3), CDS Hooks (C4, E4), SMART app launch inside MedBrains, signed JWT client
assertions (`private_key_jwt`), the public registry and `ext publish` (E2), certification (E3),
SDKs beyond TypeScript and Python (E3).

## 8. Conformance

`medbrains ext test` runs the suite against the local mock; `medbrains ext test --url <sandbox>`
with `MEDBRAINS_CLIENT_ID` / `MEDBRAINS_CLIENT_SECRET` (and `MEDBRAINS_PATIENT_ID` for a real read)
runs it against a hospital. It checks: the manifest validates, metadata is public, a wrong secret
is refused, credentials give a token, an ungranted read is `403`, a shared Patient reads, and (mock
only) revocation refuses the next call.

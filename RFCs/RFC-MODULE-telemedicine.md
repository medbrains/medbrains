# RFC-MODULE: Telemedicine — multi-provider video + calendar + comms

**Status:** Foundation shipped (Jitsi + external-link + provider model); API adapters OAuth-pending.
**Pattern:** mirrors the payment multi-provider seam — a provider field + per-tenant config + adapters behind the outbox-handler trait. Build what works without creds now; register OAuth-gated providers as `has_adapter=false` until a tenant connects their account.

## 1. Data model (`tele_consultations`, migrations 0167–0168)
`id, tenant_id (RLS), appointment_id?, encounter_id?, patient_id, doctor_id, room_id (unique/tenant), provider, meeting_url?, status, scheduled_at/started_at/ended_at, doctor_notes, cancel_reason`.
- `provider` ∈ `jitsi | external | zoom | google_meet | teams`.
- `meeting_url` — authoritative join link for externally/API-created meetings; Jitsi derives `<video_base>/<room_id>` (base in `tenant_settings` telemedicine/video_base, default `meet.jit.si`).
- Lifecycle: `scheduled → waiting → in_progress → completed | cancelled | no_show` (start/end stamped).

## 2. What works **without** OAuth (shipped / near-term)
- **Jitsi** — auto room, zero creds, embeddable iframe. Default.
- **External link** — doctor pastes a Zoom/Meet/Teams link they made manually; stored in `meeting_url`. Covers every platform today with no API.
- **Universal calendar** — generate an **`.ics`** (RFC 5545) for the consult: opens in Google/Outlook/Apple Calendar. Plus a **Google Calendar template URL** (`calendar.google.com/calendar/render?action=TEMPLATE&...`). No OAuth.
- **Comms** — send the join link via the existing notifications/email/WhatsApp pipeline (outbox). No new provider.

## 3. Full API integration (OAuth-gated — verified from provider docs)
Each needs the **hospital** to connect its own account (per-tenant OAuth); tokens live in the secret store (like payment creds). Adapters follow the outbox-handler pattern (`handlers/<provider>.rs`), event `meeting.<provider>.create`.

| Provider | Endpoint (verified) | Auth | Returns |
|---|---|---|---|
| **Zoom** | `POST https://api.zoom.us/v2/users/{userId}/meetings` | Server-to-Server OAuth: `POST /oauth/token?grant_type=account_credentials&account_id=…` (Basic client_id:secret); scope `meeting:write:admin` | `join_url` + `start_url` |
| **Google Meet** | Calendar API `POST /calendar/v3/calendars/{calId}/events?conferenceDataVersion=1` with `conferenceData.createRequest{requestId, conferenceSolutionKey.type:"hangoutsMeet"}` | OAuth2 (Workspace), scope `calendar.events` + refresh token | `conferenceData.entryPoints[].uri` (Meet link) |
| **MS Teams** | Graph `POST /v1.0/users/{id}/onlineMeetings` (or `/me/onlineMeetings`) | OAuth2 / app perm `OnlineMeetings.ReadWrite.All` (Azure AD app per tenant) | `joinUrl` |

**Calendar sync (2-way)** — same OAuth gives calendar create/update:
- **Google Calendar** — `events.insert/patch` (the Meet call already creates the event).
- **Microsoft (Outlook)** — Graph `POST /users/{id}/events` with `isOnlineMeeting:true, onlineMeetingProvider:"teamsForBusiness"` (creates event + Teams link in one call).

**Comms providers** (Slack / MS Teams channel / email) — for notifying staff, reuse the existing outbox comms; Slack via incoming webhook, Teams via connector webhook, email via SMTP — all already in the comms pipeline.

## 4. OAuth seam (per-tenant connect)
- `tenant_settings` category `telemedicine`: `<provider>_oauth { client_id, client_secret, account_id|tenant_id|refresh_token, mode }`; secrets in the resolver.
- Admin → Settings → Telemedicine: "Connect Zoom / Google / Microsoft" (OAuth consent), `GET /api/telemedicine/providers` lists configured + `has_adapter`.
- `create_tele_consultation` gains a `provider` param gated on `has_adapter` (mirrors `create_order`); for an OAuth provider it queues `meeting.<provider>.create` → worker hits the API → stores `meeting_url`. Client polls /status.

## 5. Build order
1. **Foundation** (done): model + Jitsi + external-link + lifecycle + join info.
2. `.ics` + Google-Calendar-link (frontend, no OAuth) + email the link via comms.
3. **Zoom** S2S-OAuth adapter (most self-contained — no user-redirect OAuth; account-level token) → mock-tested.
4. **Google Meet** (Calendar API) + **MS Teams** (Graph) adapters — need the redirect-OAuth connect flow + token refresh.
5. Admin connect UI + `/telemedicine/providers`.

Sources: [Zoom Meetings API](https://developers.zoom.us/docs/api/meetings/) · [Zoom S2S OAuth](https://developers.zoom.us/docs/internal-apps/s2s-oauth/) · [Google Calendar create events](https://developers.google.com/workspace/calendar/api/guides/create-events) · [MS Graph permissions](https://learn.microsoft.com/en-us/graph/permissions-reference).

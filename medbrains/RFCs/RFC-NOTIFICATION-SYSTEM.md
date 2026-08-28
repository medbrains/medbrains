# RFC — First-class notification system across web, mobile, TV, kiosk & IoT

**Status:** Accepted (direction) · **Date:** 2026-07-14 · **Relates to:** `project_constrained_surface_porting`,
`project_live_activity_island`, `RFC-ACCESS-RESOLUTION-GRAPH.md` (recipients respect patient access)

## Context & decision

Notifications are the **connective tissue of the whole fleet** — a lab critical value must reach the doctor's
phone, a called token must flash on the OPD TV *and* the kiosk, an emergency code must broadcast to every
board, a cold-chain breach from an IoT sensor must page the BME, a task assignment must wake the nurse app.
Today MedBrains has only a **pull-only in-app store**: `notifications` table (`0158`) + `create_notification`
helper (`routes/notifications.rs`) + list/unread/mark-read. There is **no real-time delivery and no push** —
`routes/ws.rs` has a `QueueBroadcaster` scaffold whose socket handlers are literal placeholders (`// Placeholder
- we need to add broadcaster to state`), never wired to `AppState`; `paired_devices` has no push token; no
Expo/FCM dependency exists. So a created notification never actually reaches any device.

**Decision.** Build a **first-class notification system**: one server-side **NotificationHub** that every
notification flows through, delivered live over **WebSocket** to connected surfaces (web bell, mobile, TV,
kiosk) and via **Expo push** to backgrounded mobile, with **topic fan-out** (user, department, board,
emergency, device) folding in the existing TV `QueueBroadcaster`. `create_notification` stays the single
choke point — every module that already calls it gets real-time + push for free. Built to the constrained-
device LAW (bounded channels, capped reconnect+jitter, zero leaks) since the consumers are TVs/kiosks/phones.

## Principles

1. **One choke point.** All notifications flow through `create_notification(NewNotification)`; it persists
   (durable, catch-up) **and** publishes to the hub (live). No module publishes to sockets directly.
2. **Persist then deliver.** The DB row is the source of truth (offline catch-up via `list_notifications`);
   real-time is best-effort on top. A dropped socket never loses a notification — it's fetched on reconnect
   with a `since` cursor.
3. **Topic fan-out, not per-connection queries.** The hub broadcasts to topics; a surface subscribes to the
   topics it needs (its user, its department, its board, `emergency`). O(subscribers), no per-event DB scan.
4. **Recipients respect access.** A notification's audience is resolved server-side (user / role / department /
   board); patient-linked notifications honour the access graph (RFC-ACCESS-RESOLUTION-GRAPH) — never leak PHI
   to a board or an unrelated user.
5. **Constrained-device LAW** (`docs/DEVICE-CONSTRAINED-RULES.md`): bounded broadcast channels with lag-drop,
   capped WS reconnect with backoff+jitter, pause when backgrounded, teardown every socket/task, render
   last-good, never a blank board.

## Architecture

### Server — the NotificationHub (`AppState`)
A `NotificationHub` (tokio `broadcast` per topic, bounded ~256, lag-drop) held in `AppState`:
- **Topics:** `user:{id}`, `department:{id}`, `board:{surface}` (opd/lab/pharmacy/…), `emergency` (global),
  `device:{id}`. The existing `ws.rs::QueueBroadcaster` (per-department + announcements) **folds into** the hub
  as `department:*` + `emergency` topics — one broadcaster, not two.
- **Publish:** `create_notification` (after the DB insert) resolves the audience → publishes a
  `NotificationEvent {id, kind, title, body, category, entity, action_url, topics}` to the relevant topics.
- **Envelope reuse:** the clinical-event/outbox path (`events.rs`) and emergency codes already fan out; wire
  them to publish notification events rather than inventing a parallel bus.

### Transports
- **WebSocket `/api/ws/notifications`** (authed, replaces the placeholder handlers): on connect, the socket
  subscribes to `user:{claims.sub}` + the surface's declared topics (department/board/emergency); streams
  `NotificationEvent`s; heartbeats; on reconnect the client pulls missed rows via `GET
  /api/notifications?since=`. Bounded, capped-reconnect, backgrounded-pause on device.
- **Expo push** (mobile, backgrounded / not connected): a new `device_push_tokens` table (user_id, surface,
  expo_token, platform, revoked) registered by the Expo apps via `expo-notifications`; the hub, on a
  `user:*` event with no live socket, sends via the Expo Push API (`expo-server-sdk`) — batched, receipt-checked.
- **TV/kiosk**: subscribe to `board:{surface}` + `emergency` (no per-user auth needed for public boards; token-
  only privacy per `token-board-surfaces.ts`).
- **IoT/device-bridge**: `devices.rs` ingest of a critical value / sensor alarm calls `create_notification`
  (targeting the responsible role/user + `device:{id}`), so IoT alerts ride the same hub.

## Per-surface consumers
- **Web** — the notification bell subscribes to `/api/ws/notifications`, live-prepends, updates the unread badge;
  falls back to the existing poll if the socket drops.
- **Mobile (Expo)** — `@medbrains/mobile-shell` gains a `useNotifications()` hook: WS when foregrounded, Expo
  push when backgrounded, a notification center screen, deep-link via `action_url`. Bounded list (FlatList).
- **TV** — boards already poll; add a `board:*`/`emergency` socket for instant token-called + code broadcasts,
  keeping the `TvFeedStatusBanner` last-good fail-safe.
- **Kiosk** — token-called + wayfinding announcements over the same board socket.
- **IoT** — device-bridge critical values surface as notifications to the on-call role.

## Phased rollout (each its own PR)
- **P1 — Hub + live web.** `NotificationHub` in `AppState`; authed `/api/ws/notifications`; `create_notification`
  publishes; fold `QueueBroadcaster` in. Unit-test the pure audience→topics resolution + bounded-channel drop.
- **P2 — Web bell consumer.** Subscribe the bell to the socket (live + poll fallback), reconnect w/ backoff.
- **P3 — Mobile in-app.** `mobile-shell useNotifications()` + notification center (WS foreground), FlatList.
- **P4 — Expo push.** `device_push_tokens` + registration + Expo Push send path for backgrounded users.
- **P5 — TV/kiosk topics.** Board sockets for token-called + emergency codes; retire the placeholder handlers.
- **P6 — IoT.** device-bridge critical value → `create_notification` → on-call.
- **P7 — Preferences.** Per-user/-surface mute/category prefs; quiet hours; escalation (already partly in
  `verbal_order_escalation.rs`).

## Constraints & non-goals
- Persist-then-deliver — never rely on the socket for durability; DB row + `since` cursor is the contract.
- Bounded everything (LAW): broadcast channels lag-drop, WS reconnect capped+jitter, no unbounded in-memory
  fan-out lists; flat memory on boards over uptime.
- Recipient resolution respects RBAC + the access graph; token-only privacy on public boards.
- Non-goal (now): SMS/email/WhatsApp channels (a later transport behind the same hub), rich per-user routing
  rules engine.
- Live PG + SpiceDB are up for testing; the WS path validates against the running backend (`:3000`).

## Verification
Per PR: `cargo clippy 0` + hub unit tests (audience→topics, bounded drop, reconnect cursor); `pnpm typecheck+
build`, `biome`, `make check-api`. End-to-end: create a notification for user U in department D → U's open web
bell receives it live over `/api/ws/notifications`; a TV subscribed to `board:opd` gets a token-called instantly;
U backgrounded on mobile gets an Expo push; reconnect replays missed rows via `?since=`. Device PRs tick the
Power-of-Ten checklist (bounded, teardown, capped reconnect, last-good render).

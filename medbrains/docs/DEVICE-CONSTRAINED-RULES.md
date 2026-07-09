# Constrained-Device Rules — the "Power of Ten" for TV / kiosk / mobile / IoT / edge

**These rules are LAW.** They govern every line of code that runs on a constrained surface — the same
spirit as NASA/JPL's *Power of Ten* for flight software. Waiting-room TVs, self-check-in kiosks, ward
tablets, phones, wayfinding boards, edge gateways and IoT sensors are **low-end, small-memory devices
that run for weeks without a restart**. A leak that is invisible on a workstation kills a board
overnight; an unbounded list that is fine on a laptop OOM-crashes a ₹6,000 Android TV stick. Write for
the smallest device, not your dev machine.

## Scope — who must obey

Applies to every surface whose device-catalog `class` is **not** `ui-desktop`/web:

| Class | Surfaces | Runtime |
|---|---|---|
| `ui-display` | all `TV-*` boards | React Native (Android TV) |
| `ui-touch` | `Desktop-Kiosk`, wayfinding | RN / kiosk-mode browser |
| `ui-mobile` | all `Mobile-*` | React Native + Paper |
| `headless-edge` | edge gateway, device bridge | Rust daemon |
| `headless-iot` | cold-chain / environment sensors, adapters | firmware / bridge |

The web workstation (`ui-desktop`) has headroom and is exempt from the memory-budget rules (but not
from the reuse rule). **Before writing any device screen or feature, read this doc and run the
pre-code checklist at the bottom.**

---

## The Ten Rules

### 1. Bound everything. No unbounded growth — ever.
Every loop, list, queue, buffer, cache, and retry has a **fixed, declared upper bound**. Offline
outboxes and message buffers are capped with an eviction policy (drop-oldest / spill-to-disk). No
recursion, or a hard depth cap. If a value can grow with uptime or data, it has a ceiling and a test
that proves the ceiling holds.

### 2. Hold no unbounded data in memory. Virtualize lists; cap caches.
Never `.map()` a large array into a `ScrollView`. Every list ≥ ~20 rows uses `FlatList`/`FlashList`
with `windowSize`, `removeClippedSubviews`, `getItemLayout`, and `maxToRenderPerBatch` set. Fetch slim
list DTOs (the `*ListItem` projection pattern), never the full record set. Image/query caches are
size-capped with TTL; images are downscaled to display size before caching.

### 3. Clean up everything you start. Zero leaks.
Every `setInterval`, `setTimeout`, subscription, event listener, WebSocket, and animation has a
matching teardown in the same scope (`useEffect` cleanup, `AbortController`, `removeListener`). This is
the #1 killer on low-RAM devices. A screen must return to its mount-time memory after unmount. No
retained closures over large objects.

### 4. Bound the network. Timeout, cap retries, back off.
Every request has a timeout, a **capped** retry count, and exponential backoff **with jitter**.
WebSocket/SSE reconnect uses capped backoff — never a tight reconnect loop. Polling intervals are
bounded and pause when the screen is backgrounded/hidden. No request without an error path.

### 5. Keep the JS thread free. No heavy work in render or gestures.
No large synchronous loops, JSON parsing, or sorting inside `render`, scroll handlers, or gesture
callbacks. Debounce/throttle inputs. Animations run on the **native driver** (`useNativeDriver: true`)
and honour `prefers-reduced-motion` / Reduce Motion. Target a steady 60fps; jank is a defect.

### 6. Minimize re-renders. Memoize; subscribe to slices.
`React.memo` presentational components; `useMemo`/`useCallback` for derived data and handlers; stable
`key`s; **no inline object/array/function props** in hot paths. Read Zustand/stores with **selectors**
(subscribe to the slice you use, not the whole store). A list row must not re-render when a sibling
changes.

### 7. Efficient structures up front — DSA is mandatory here, not optional.
`Map`/`Set` indexes over repeated `.find`/`.includes`; batch with SQL `ANY`/`IN`; precompute lookups
outside loops; O(n·log n) or better on any path touched per-frame or per-item. On the web this is
"measured"; **on constrained surfaces it is required and reviewed.**

### 8. Share, never copy. One codebase per form-factor, config-driven.
All shared logic comes from `@medbrains/*` (`device-catalog`, `design-system/tokens`, `mobile-shell`,
`ui-mobile`, `schemas`, `types`). **No per-platform copy-paste** — a TV board and a kiosk are the same
build differentiated by the boot **manifest** (surface × location × user), not forks. Colour comes from
the Carbon tokens; devices diverge on form-factor (`deviceTheme(factor)`), never on palette.

### 9. Small bundle, fast cold start.
Lazy-load screens/routes (`React.lazy` / dynamic import). **Audit every dependency before adding it** —
a heavy lib is a permanent tax on every device; prefer a few lines over a package. Tree-shake; cap font
and asset sizes; ship only the fonts a surface needs. Cold start must meet the per-surface budget below.

### 10. Fail safe. Degrade gracefully. Never a blank board.
An **error boundary wraps every screen** — one crash must not kill the app or blank a public board.
Validate all inputs at the boundary (Zod). Offline-first: render last-good cached state, never an empty
screen or a spinner-forever. Handle every error path — **no swallowed errors, no unhandled promise
rejections**. Assert invariants in dev; degrade (not crash) in prod.

---

## Memory & startup budgets (steady-state ceilings)

| Surface | JS heap ceiling | Cold start | Notes |
|---|---|---|---|
| `TV-*` board | **≤ 120 MB** | ≤ 4 s | runs for weeks; must be flat over uptime |
| `Desktop-Kiosk` | ≤ 150 MB | ≤ 4 s | touch, single-purpose |
| `Mobile-*` | ≤ 200 MB | ≤ 2.5 s | shares device RAM with the OS + other apps |
| `headless-edge` | ≤ 128 MB RSS | n/a | Rust; RSS flat over weeks; bounded SQLite buffer |
| `headless-iot` | as low as KBs | n/a | firmware; fixed buffers, no dynamic alloc in the loop |

**Memory must be flat over uptime.** A board that climbs 2 MB/hour is a leak — profile before ship.

## Headless (edge / IoT) additional rules
Bounded local buffer with **backpressure** (reject/spill when full, never grow unbounded);
**idempotent** retries (dedupe by key); a **watchdog / heartbeat** so a stuck process is detected and
restarted; **no dynamic allocation in the hot loop** (pre-allocate; fixed-size ring buffers); survive
network loss + reconnect without leaking sockets or file handles.

---

## Pre-code checklist (run before writing a device screen/feature)

- [ ] Every list is virtualized (`FlatList`/`FlashList` + `getItemLayout`), fed by a slim DTO.
- [ ] Every timer/socket/listener/subscription has a teardown in the same scope.
- [ ] Every network call has timeout + capped retry + backoff; polling pauses when hidden.
- [ ] No unbounded array/queue/cache; caps + eviction declared.
- [ ] Store reads use selectors; hot components are memoized; no inline props in lists.
- [ ] Shared logic imported from `@medbrains/*`; nothing copy-pasted across surfaces.
- [ ] Every screen has an error boundary + an offline last-good render.
- [ ] No new heavy dependency without an audit; screens lazy-loaded.
- [ ] Profiled: JS heap under the surface budget and **flat over a 30-min soak**.

## Enforcement
Referenced as law from `CLAUDE.md` and the [DESIGN-RULES index](./DESIGN-RULES.md). A device PR that
adds a screen/feature must tick the checklist in its description; reviewers reject unbounded memory,
un-torn-down effects, non-virtualized lists, copy-pasted logic, and un-budgeted bundles. Pairs with the
DSA/reuse memory rule (`feedback_dsa_reuse_constrained_surfaces`).

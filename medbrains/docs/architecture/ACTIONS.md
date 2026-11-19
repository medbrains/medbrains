# Actions: what a brick lets a person or the assistant do

An **action** is one typed operation a brick publishes: find a patient, read today's OPD queue.
It is declared once, and one broker in the kernel runs it, for a person or for the assistant
acting for a person, with the same checks in the same order. Spec:
`RFCs/RFC-AI-NATIVE-OS.md` §7.2 (the action model) and §7.4 (the policy enforcement point).

This is the Rust-native first step. Vendor bricks declare theirs later as WIT interfaces in a
manifest (`RFCs/RFC-OS-ECOSYSTEM.md`); the broker and its checks stay the same.

## The pieces

| Piece | Where | Knows hospitals? |
|---|---|---|
| `ActionDef`, `EffectClass`, `Invoker`, `Refusal`, the broker `act()` | `crates/medbrains-kernel/src/action.rs` | No. A module is an opaque string, and whether it is on is asked of an injected `ActionGate` |
| The registry `ACTIONS` and `find_action(id)` | `crates/medbrains-health-services/src/actions.rs` | Yes: each row names a brick and a permission |
| The service functions the actions wrap | the brick's crate (`medbrains-patients::actions`, `medbrains_opd::queue_rows`) | Yes |
| `run_action(state, claims, invoker, id, json)` | `crates/medbrains-server/src/actions.rs` | Dispatches by id; reads the module switch from `module_config` |

The registry is in health services, not next to `bricks.rs` in `medbrains-core`, because
`ActionDef` is a kernel type and core sits below the kernel; and not in the kernel, because a row
names a brick (`scripts/check_kernel_no_domain.py`).

## Effect classes

| Class | Means | The assistant, today |
|---|---|---|
| `read` | reads within the caller's access, changes nothing | runs |
| `draft` | prepares something a person accepts item by item | runs |
| `write` | changes a record | refused: needs confirmation |
| `money` | moves money | refused: needs confirmation |
| `critical` | changes someone's treatment (the RFC's `clinical` class; the kernel keeps hospital words out) | refused: needs confirmation; it will **never** get a confirmation path, only drafts a clinician signs |
| `device` | drives hardware | refused: needs confirmation |
| `egress` | sends data out of the box | refused: needs confirmation |

A person runs any class their permissions allow. The class is declared on the action, never chosen
at the call site.

## The broker's order

`medbrains_kernel::action::act(gate, call, handler)`:

1. **The assistant acts for these claims' owner.** An `Invoker::Assistant { on_behalf_of }` whose
   person is not the claims' owner is refused (`Denied`).
2. **The module is on.** `ActionGate::module`: off is `ModuleOff`, unreadable is `Unknown`.
3. **The effect is allowed for the invoker.** The assistant gets `NeedsConfirmation(effect)` for
   anything past `read` and `draft`.
4. **The permission is held.** `ActionGate::permission`, by default the session's resolved
   permissions: deny is `Denied`; a lost context is `Unknown`, which never runs and is never shown
   as a no.
5. **The handler runs** inside one kernel unit of work (`kernel::work`: tenant RLS and the acting
   user set).
6. **One audit row per decision**, allowed or not: action id as `action`, entity type `action`,
   and in `new_values` the effect, the invoker (`person` or `assistant`), the acting user, the
   on-behalf-of user, the agent (`Claims::act`) and the outcome (`allow`, `deny`,
   `module_off`, `needs_confirmation`, `unknown`). An allowed run's row commits with the work; a
   refusal is recorded in a unit of its own, and if that write fails the refusal still stands and
   the failure is logged.

A record-level check (is this patient in the caller's reach?) stays in the service function, as on
the screen: `patients.summary` calls `require_patient_access` and answers `NotFound` for a patient
out of reach.

## The actions so far

| Id | Brick | Effect | Permission | Wraps |
|---|---|---|---|---|
| `patients.find` | `registration` | read | `patients.find` | the desk lookup, `GET /api/patients/find` (same function) |
| `patients.summary` | `registration` | read | `patients.view` | `GET /api/patients/{id}`'s record check, load and field masking |
| `opd.queue.today` | `opd` | read | `opd.queue.list` | `GET /api/opd/queue` for today (same function) |

## How a brick adds one

1. The permission exists in `crates/medbrains-core/src/permissions.rs` (Permissions First). Reuse
   the one the equivalent screen uses; a new one follows the full Permissions First order.
2. The service function takes the caller's connection (`&mut PgConnection`), so the HTTP handler
   and the broker share it. Move the handler's body into it rather than copying it.
3. Add the `ActionDef` row to `ACTIONS`, with a `permissions::…` constant, never a string.
4. Add its arm to `run_action`, with a typed input.
5. `python3 scripts/check_actions.py` (in `make check-all`) and the registry's test fail on a
   module that is not a brick, a permission that is not a constant, or a repeated id.
6. An integration test in `crates/medbrains-server/tests/actions_test.rs` for the allowed path and
   a refusal.

## What comes next

- **The assistant uses actions** (PR 2): the assistant's tool layer calls `run_action` with
  `Invoker::Assistant` instead of the GET allowlist in `medbrains-ai/src/catalog.rs`, and shows
  `Unknown` as "could not check".
- **Task grants and confirmations** (later): the broker checks a grant before step 2, and
  `NeedsConfirmation` becomes a confirmation card the broker builds from the typed arguments.
- **Vendor actions**: the same `ActionDef`, declared in a manifest and run through the Wasm host.

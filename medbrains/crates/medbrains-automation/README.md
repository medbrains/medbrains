# Workflow automation

Visual workflow automation for MedBrains, built on [r8r] — a separate project
with its own repository, tests and release cadence, consumed here as a package.

The split is deliberate. r8r is a general-purpose engine; these crates are the
part that makes running one inside a hospital system safe.

| Crate | Owns |
|---|---|
| `medbrains-automation` | The rules: whose authority a workflow runs with, what it may reach, what it may consume. No axum, no storage. |
| `medbrains-automation-store` | Four `automation_*` tables, tenant-scoped, RLS-enforced. |
| `medbrains-automation-api` | The HTTP surface, permission-gated. |

## The rule that matters

**A workflow can never do more than the person who armed it.**

A schedule firing at 03:00 has no user behind it, so something has to decide
what it may read. Letting it act without limit would make saving a workflow a
way around the permission system — anyone who could build one could read any
patient in the tenant.

Instead, activation *lends* the workflow the activator's permissions:

* `POST /workflows/{id}/activate` refuses a permission set larger than the
  caller holds, naming what was missing.
* The graph is checked against that authority at activation, while somebody is
  looking at the screen — not at 03:00.
* Editing a workflow deactivates it and drops its authority. The permissions
  were lent to the workflow somebody reviewed, and a changed graph is not that
  workflow.
* `run_as_user_id` records under whose authority a run happened, so an audit
  does not have to infer it.

`medbrains-automation::engine::required_permission` is the map from node type
to the permission it demands. A node that only reshapes JSON needs nothing — it
can only touch what an earlier, checked node fetched.

## Blast radius

Automation is a bolt-on. The hospital must keep running if it is switched off.

* Its four tables are referenced by nothing in the clinical schema. Dropping
  them removes the feature and touches nothing else.
* `Guard` caps concurrent executions (default 4). A runaway schedule makes
  automation slow, not the hospital — it cannot exhaust the connection pool.
* r8r forbids `unsafe` and denies `unwrap`/`expect`/`panic`/indexing outside
  tests, so a workflow cannot take the process down.
* Execution history is retained, not kept: a run's payload is whatever flowed
  through the workflow, which here can be clinical data.

## Where it runs

Same server or its own, as the customer requires. `Deployment` chooses; the
engine, nodes, store and router are identical either way.

**Embedded** — nest the router in `medbrains-server`:

```rust
let automation = Arc::new(medbrains_automation::engine::Automation::new(
    Deployment::Embedded,
    Guard::new(4),
    Arc::new(store_backed_credentials),
)?);

app = app.nest(
    "/api/automation",
    medbrains_automation_api::router()
        .with_state(AutomationState::new(pool.clone(), automation)),
);
```

Requests arrive already authenticated and tenant-scoped by the middleware that
guards every other route.

**Standalone** — not yet built, and deliberately so.

`auth_middleware` takes the full `AppState`, so a separate server would either
have to construct all of MedBrains, or validate tokens itself. The second is
the dangerous one: a hospital system with two subtly different token validators
is how an authentication bypass gets written.

The right move is to extract token validation from `medbrains-server-core` into
a small crate both can depend on. That is a change to shared code and a
decision for whoever owns auth, so it is left open rather than guessed at.

## Still to do

* **Permission sync.** `medbrains-core::permissions::automation` adds four
  codes. Their mirrors in `packages/types/src/permissions.ts` and the
  `PERMISSION_COUNT` constant (777 → 781) have not been updated — the count
  tracks the frontend array, and moving one without the other is worse than
  moving neither.
* **The submodule pointer.** r8r sits at `../r8r`, currently gitignored.
  Once it has a remote:
  `git rm -r --cached r8r && git submodule add <url> r8r`
* **Scheduler and webhooks.** The store and engine support both; nothing wires
  the tick loop or the inbound route yet.
* **Native nodes.** Every clinical read currently goes over the FHIR API. In
  the embedded deployment a node could call the service layer in-process —
  faster, and no second token — which is what `Deployment::allows_in_process_access`
  is there to gate.

[r8r]: ../../r8r

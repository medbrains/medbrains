# RFC-MODULE: Central Approvals & Requests Platform

Status: **Draft** · Owner: platform · Created 2026-08-11

A pluggable, metadata-driven approval platform — one admin console, one request
model, one engine — modelled on Microsoft 365 Admin Center (roles, scopes,
Privileged Identity Management, access reviews), Frappe (DocType + Workflow as
data), and Odoo (configurable Approval Categories).

**The design goal is not "migrate sixteen tables". It is that the seventeenth
request type needs no code at all.**

---

## 1. Where we are

Sixteen independent request/approval implementations exist:

```
antibiotic_stewardship_requests   bedside_nurse_requests      blood_requests
camp_approval_items               co_signature_requests       crossmatch_requests
device_pairing_requests           iam_access_requests         leave_requests
pharmacy_transfer_requests        pre_authorization_requests  prior_auth_requests
restricted_drug_approvals         roi_requests                stock_disposal_requests
transport_requests
```

Fifteen have `status`, ten have `requested_by`, and past that they agree on
nothing. Four state machines are in use and two disagree on the word for the
same outcome — `rejected` (IAM) versus `denied` (antibiotics).

Every one of them re-derives its own controls, and most get it wrong.

`iam_access_requests` is the reference: it refuses a reviewer who is the
requester or the target, gates elevated permissions behind a bypass role,
time-boxes grants, and supports revocation.

`leave_requests` has a two-stage HOD → admin chain and three defects:

1. **The chain is skippable.** The update is `WHERE id = $1 AND tenant_id = $2`
   with no constraint on current status, and the stage comes from a
   caller-supplied `action`. `approve_admin` on a `draft` reaches `approved`
   without the HOD stage ever happening.
2. **Self-approval is possible.** No requester ≠ approver check exists, and one
   permission (`hr.leave.approve`) authorises both stages.
3. **Terminal states are not terminal.** A decided request can be decided again.

The HOD stage is decorative in a second way: `departments` has **no head
column**, so nothing resolves who the HOD is — the code stamps whoever clicked.

**What we cannot reuse.** `workflow_templates` (code, name, version, steps
JSONB) exists but holds **zero rows**; it models clinical step sequences, not
authority. `form_fields` is an orphan stub whose `form_id`, `field_master_id`
and `section_id` point at tables that do not exist, with no FK constraints —
there is no form builder. Both primitives must be built.

## 2. The shape of the answer

Three products solve this the same way, and it is not with a table per request
type:

- **Frappe** — a DocType defines the record; a Workflow defines states and
  transitions, with the allowed role on each transition. Both are *data*.
- **Odoo** — an Approval Category defines a request type: which fields it has,
  the minimum number of approvers, whether the manager must approve.
- **Microsoft Admin Center / PIM** — roles are *eligible* rather than granted;
  activation requires justification, has a maximum duration, and may require
  approval. Access reviews recertify periodically.

The common idea: **the request type is configuration, and code appears only
where something real must happen.**

That is the whole design. A hospital administrator adding "request a parking
pass" should not need a deployment. A developer adding "dispense a Schedule X
drug" writes one effect implementation and nothing else.

## 3. Layers

```
┌─ Admin Center ─────────────────────────────────────────────────┐
│  Request catalog · Workflow designer · Approver rules          │
│  Delegations · Access reviews · Audit                          │
│  Employee: "My requests"   Approver: "Awaiting me"             │
└────────────────────────────────────────────────────────────────┘
┌─ Platform — data-defined, no deploy ───────────────────────────┐
│  request_types          what can be asked for  (Odoo Category) │
│  request_type_fields    the form schema        (Frappe DocType)│
│  approval_workflows     states + transitions   (Frappe Workflow)│
│  approver_rules         who decides each step                  │
│  approval_policies      conditions → which workflow applies    │
└────────────────────────────────────────────────────────────────┘
┌─ Engine — pure core + ports ───────────────────────────────────┐
│  state machine · controls · quorum · witness · SLA · escalation│
│  ports: Directory · Repository · Clock · Notifier · Effect     │
└────────────────────────────────────────────────────────────────┘
┌─ Plugins — code, only where an effect is real ─────────────────┐
│  iam.grant   hr.leave   pharmacy.ndps   insurance.nhcx   …     │
└────────────────────────────────────────────────────────────────┘
```

Dependency direction is strict: **domains depend on the engine; the engine
depends on no domain.** Handlers are registered at the composition root
(`medbrains-server`), so the engine never names a domain crate.

## 4. Extensibility tiers

This is what "pluggable" has to mean in practice:

| tier | added by | deploy | example |
|---|---|---|---|
| **0 — config only** | admin, in the UI | no | parking pass, ID card, equipment, travel |
| **1 — config + existing effect** | admin, in the UI | no | any access grant reusing `iam.grant` |
| **2 — new effect plugin** | developer, one impl | yes | `pharmacy.ndps_dispense`, `stock.disposal` |
| **3 — external decider** | developer, one adapter | yes | insurer pre-auth over NHCX |

Most new types are tier 0 or 1. Sixteen existing domains are tier 2. Only
pre-authorisation is tier 3.

## 5. Plug points

Three, not one — because the domains genuinely differ in three ways.

```rust
/// What actually happens. The only plug point most domains need.
#[async_trait]
trait ApprovalEffect: Send + Sync {
    /// Domain preconditions — blood compatibility, stock on hand, an
    /// attendance record that contradicts the leave. Runs before the request
    /// is raised, and again before the final approval commits, because the
    /// world moves in between.
    async fn validate(&self, tx: &mut Tx, req: &Request) -> Result<(), AppError>;

    /// Runs inside the deciding transaction, so an effect that fails rolls the
    /// approval back with it. A permission grant that half-applies is worse
    /// than one that never applied.
    async fn on_approved(&self, tx: &mut Tx, req: &Request) -> Result<(), AppError>;
    async fn on_rejected(&self, tx: &mut Tx, req: &Request) -> Result<(), AppError>;
    async fn on_revoked(&self, tx: &mut Tx, req: &Request) -> Result<(), AppError>;
}

/// Who may decide, beyond the built-in rules of §6.
trait ApproverResolver: Send + Sync {
    fn resolve(&self, ctx: &StepContext) -> Result<Vec<UserId>, AppError>;
}

/// A decision that arrives from outside, asynchronously.
///
/// Pre-authorisation is decided by an insurer, not a person: the request is
/// submitted, and `nhcx_response_at` / `nhcx_response_payload` arrive later by
/// webhook. Without this, a human-only chain would have to be faked with a
/// clerk pretending to be the payer, and the audit trail would say so.
#[async_trait]
trait ExternalDecider: Send + Sync {
    async fn submit(&self, tx: &mut Tx, req: &Request) -> Result<ExternalRef, AppError>;
    fn interpret(&self, payload: &serde_json::Value) -> Result<Decision, AppError>;
}
```

## 6. Approver rules

Resolved when a step **activates**, not when the request is raised — an
approver who leaves mid-chain must not hold it up.

| rule | resolution |
|---|---|
| `role` | any active holder of the role |
| `permission` | any user whose effective permissions include the code |
| `reporting_manager` | walk `employees.reporting_to` from the requester |
| `department_head` | the department's designated head |
| `designation_level_at_least` | rank gate; also what escalation climbs |
| `named_user` | a specific person |
| `external` | an `ExternalDecider` adapter |
| `automatic` | policy threshold — auto-approve below a limit |

`departments` gains `head_employee_id`. Deriving the head from
`designations.level` is a fallback, not the answer: two consultants at the same
level are ambiguous, and a hospital knows who runs the department.

`automatic` is deliberately a *rule*, so that an auto-approval is still a
recorded decision with a reason, not an absence of one.

## 7. Data model

### `request_types` — the catalog
`code, name, module, icon, description, is_active, raise_permission,
requires_justification, requires_attachment, max_duration, effect_key,
default_workflow_id`

`effect_key` is nullable. A tier-0 type has none: it is approved, and the
approval itself is the outcome.

### `request_type_fields` — the form, as data
`request_type_id, key, label, field_type, required, options, validation,
sort_order, section`

Rendered by one dynamic form component. This is the Frappe DocType idea, and it
is what makes tier 0 possible.

### `approval_workflows` / `approval_workflow_steps` — versioned chains
`code, name, version, is_active, effective_from` /
`workflow_id, seq, name, approver_rule (JSONB), quorum, requires_witness,
sla_hours, escalation (JSONB), allow_delegate`

Versioned because a policy edited next month must not rewrite what happened
last month.

### `approval_requests` — the request
`kind (→ request_types.code), subject_type, subject_id, requester_id,
on_behalf_of_id, reason, payload (JSONB), workflow_version_id, status,
current_step_seq, sla_due_at, decided_at, expires_at`

One vocabulary: **rejected**, never denied.

### `approval_steps` — the chain, materialised per request
Resolved at creation so the trail is readable years later.

### `approval_step_assignees` — resolved approvers
`step_id, user_id, via_delegation_id`

Written when a step activates. **This is what makes the inbox a scan rather
than a rule evaluation per row** — see §9.

### `approval_decisions` — append-only
`step_id, actor_id, decision, note, witnessed_by, signed_at, signature_ref`

No updates, no deletes. A reversal is a new decision on a new step.

### `approval_delegations`
`delegator_id, delegate_id, kinds[], starts_at, ends_at, reason`

A delegate acts **as themselves**; the decision records the delegate and the
delegation it was exercised under, never the delegator as actor.

### `access_reviews` / `access_review_items` — the PIM idea
Periodic recertification of standing grants. `iam_access_requests` already
time-boxes with `requested_expires_at`; a review campaign is the same question
asked on a schedule. Without it, "temporary" access becomes permanent quietly.

## 8. Controls, enforced once

In the pure core (§10), so every one is exhaustively testable without a
database, and no domain can forget one:

- **Segregation of duties** — requester and subject may never decide.
  Configurable per type only to make it *stricter*.
- **No stage skipping** — every decision updates
  `WHERE current_step_seq = $expected AND status = 'pending'`. A stale or
  out-of-order decision touches zero rows and returns a conflict. This is also
  the concurrency guard when two approvers click at once.
- **Terminal immutability** — decisions append-only; terminal requests refuse
  further transitions.
- **Quorum** — `n` of `m` on one step. NDPS dual-lock and clinical
  co-signature are expressed with it rather than special-cased.
- **Witness** — forces `witnessed_by`, distinct from the actor. Schedule X.
- **Elevation** — a type may declare payloads needing a bypass role, as IAM
  does today for elevated permission codes.

## 9. Scale

The inbox is the hot path — every employee opens it, and it must not evaluate
approver rules per candidate row.

- Approvers are **resolved once at step activation** into
  `approval_step_assignees`. The inbox is then
  `WHERE tenant_id = ? AND user_id = ? AND status = 'pending'` on a composite
  index: an index scan, not a rule engine.
- Escalation is **one periodic sweep** over an index on `sla_due_at`, not a
  timer per request.
- Chains are bounded — maximum steps per workflow, maximum assignees per step —
  so a misconfigured rule cannot fan out without limit.
- Counts for badges come from a single grouped query, not N per type.

## 10. Crates

Per the split-by-module rule, and with a hard purity boundary:

```
medbrains-approvals-core     no sqlx, no axum. Types, state machine, controls,
                             quorum, SLA arithmetic. Pure and exhaustively
                             unit-testable.
  src/state.rs               transitions
  src/controls.rs            SoD, skip, terminal, quorum, witness, elevation
  src/policy.rs              condition → workflow selection
  src/rules.rs               approver rule evaluation (over a Directory port)

medbrains-approvals-db       repositories, migrations, the guarded update
medbrains-approvals          orchestration; defines the three plug traits
medbrains-approvals-api      axum routes
```

Ports (`Directory`, `Repository`, `Clock`, `Notifier`) are traits in core, so
the state machine can be tested with fakes and no container.

## 11. Endpoints

```
POST   /api/approvals/requests                 raise
GET    /api/approvals/requests                 filter
GET    /api/approvals/requests/{id}            detail + chain + decisions
POST   /api/approvals/requests/{id}/decide     approve | reject + note
POST   /api/approvals/requests/{id}/cancel     requester withdraws
POST   /api/approvals/requests/{id}/revoke     after the fact
GET    /api/approvals/inbox                    awaiting me, incl. delegated
GET    /api/approvals/mine                     what I asked for
GET/PUT /api/approvals/types[/{code}]          the catalog
GET/PUT /api/approvals/workflows[/{id}]        the designer
POST   /api/approvals/delegations
POST   /api/approvals/reviews                  start a recertification campaign
POST   /api/approvals/external/{provider}      webhook for tier-3 deciders
```

## 12. Surfaces

**Admin Center** (`/admin/approvals`) — catalog, workflow designer, approver
rules, delegations, access reviews, audit. One console, Microsoft-style.

**Everyone** (`/approvals`) — *Awaiting me* and *My requests*, with one shared
decision component so every type is decided the same way.

**Mobile** — inbox and a decision sheet. An approval that waits for someone to
reach a desk is why paper chits still exist.

## 13. Sequencing

1. Core crate: state machine + controls, pure, fully tested. No DB.
2. Platform tables + engine + the generic API.
3. Admin Center: catalog and workflow designer. **Tier 0 works here** — the
   platform is useful before a single domain migrates.
4. `hr.leave` and `iam.access` as the first tier-2 plugins: real chains, and
   leave carries the three defects.
5. Clinical co-sign, restricted drugs, NDPS — quorum and witness.
6. Stock, transfer, disposal, transport, camp gates, device pairing, ROI.
7. Pre-authorisation as the tier-3 proof.
8. `denied` → `rejected` at each domain's cutover.

`bedside_nurse_requests` is **excluded**: `pending → acknowledged →
in_progress → completed` is a task being performed, not authority being
granted. Forcing it in would make "approve" mean two things.

The three HR leave defects are small and independent of this programme; they
should be fixed on their own rather than waiting for it.

## 14. Open questions

1. Is a rejected request re-openable, or must it be raised afresh? Re-raising
   audits more cleanly; re-opening is kinder to the requester.
2. Does `department_head` need history — should a leave approved last year show
   who held the post then?
3. Auto-approval thresholds are genuinely useful and are also how controls
   quietly disappear. Which types, and what ceiling?

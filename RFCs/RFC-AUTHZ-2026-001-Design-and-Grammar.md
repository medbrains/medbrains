# MedBrain Authorization Design & Grammar

**v3.** Merges the v2 design with the relation-grammar work of 2026-08-16.
Narrowed to the constraints of a hospital system: PHI, multi-facility tenancy,
care-team relationships, consent, emergency access, and audit.

v2 answered *what the model is*. v3 adds *the language it is written in* — §2A
(what SpiceDB's grammar can and cannot say), §2B (the custom grammar that covers
the rest), §2C (how both stay extensible across 67 modules). §16 records what is
actually built, with evidence, so the programme can be resumed without
re-deriving it.

## What changed from the draft

| Draft | This doc |
|---|---|
| 14 React patterns + 15 Rust patterns | 6 React surfaces, 7 Rust surfaces |
| `can("patient:update")` | every check carries a **resource** — no global verbs |
| `boolean` return | tri-state + grant provenance + audit record |
| HTTP middleware as the guard | **service layer** is the guard; HTTP is one caller |
| Permission strings | generated enums/unions from one schema |
| Staff-only subjects | staff, patients, proxies, service accounts (§1) |
| show/hide | six denial modes, resolved from data class (§3) |
| — | four Kleene combinators; separation of duties (§6.7, §12) |
| — | caveats, outbox, degraded mode, meta-authz, migrations |
| — | **relation grammar and its blind spots (§2A)** |
| — | **a custom grammar as the single source (§2B)** |
| — | **extensibility: closed kernel, open data (§2C)** |

Decorator, command objects, and the component factory are dropped. Component
registry survives only as the **module manifest** (menus/dashboards), where it
genuinely earns its place.

---

## 0. Non-negotiables

1. **The server is the only authority.** Every React check is cosmetic. If a
   handler trusts a client-supplied permission, that is a reportable breach, not
   a bug.
2. **Deny by default.** Backend timeout, schema miss, unknown action → deny.
   Never `unwrap_or(true)`. The one bounded exception is degraded mode (§7),
   which is a written policy, not a fallback in a match arm.
3. **No unscoped checks.** `patient:update` is meaningless. `update` on
   `patient:456` is a decision. Make the unscoped form unrepresentable.
4. **Every PHI decision is auditable.** Who, what, which patient, when, allowed
   or not, which relation granted it, purpose-of-use, request id. Denials and
   tombstone views are audited too — those are the interesting ones.
5. **Emergency access exists and is loud.** Clinicians will hit a wall at 3am
   with a crashing patient. Give them a documented break-glass path instead of a
   shared admin login.
6. **Denial mode is decided by data class, not by the developer at the call
   site.** Otherwise the same HIV result is masked in one panel and hidden in
   another.
7. **Cloaking is systemic or it is nothing.** A sealed record that still shows
   up in a count, an export, or a push notification is not sealed.
8. **A fault is not a refusal.** *(added v3 — see §16.3.)* An authorization
   error must never inherit the disguise a denial wears. Denials answer 404 so
   as not to be an existence oracle; an outage answering 404 tells a clinician
   the record does not exist. Three outcomes, always: allow, deny, unknown.
9. **The two backends must agree.** *(added v3 — see §2A.6.)* A policy whose
   answer depends on which engine responded is not a policy. Divergence must be
   unrepresentable, not merely checked.

---

## 1. Subjects

Four classes, not one. They are different subject types in the schema, not roles
on `user`.

| Subject | Established by | Notes |
|---|---|---|
| **Staff** | HR/identity feed | facility- and department-scoped; shift-bounded |
| **Patient** | portal enrolment | self-access; can be narrower than staff access |
| **Proxy** | guardian, POA, caregiver delegation | time- and scope-bounded, revocable |
| **Service** | HL7/FHIR partners, jobs, ML pipelines | no interactive session; export is separate |

Two traps:

- **Age-out.** A guardian's access to a minor's record must lapse at the
  statutory age, and in many jurisdictions certain categories (reproductive,
  mental health, substance use) become self-access earlier. This is a caveat on
  the proxy relation plus a scheduled sweep — not something to bolt on later.
- **Custody and revocation.** Two guardians, one revoked by court order. The
  schema needs proxy access to be individually revocable, which means proxy is a
  relation per-person, never "the guardians of this patient."

**Session facility scope.** A consultant working across two hospitals needs an
active-facility switch in the session. Without it every check silently spans
both, and the audit log can't say which hat they were wearing.

**Service accounts.** Bulk export is the main exfiltration path. It gets its own
permission, rate limits, and an alert — never inherited from `view`.

---

## 2. Schema, caveats, codegen

The schema is the source of truth. Generate the Rust enums and TS unions from it
in CI — nobody hand-types a permission string.

```zed
definition user {}
definition service_account {}

definition organization {
  relation member: user
  relation admin:  user
}

definition facility {
  relation parent:    organization
  relation clinician: user
  relation registrar: user

  permission administer = parent->admin
}

definition department {
  relation facility: facility
  relation member:   user
  relation head:     user
}

caveat within_window(now int, expires_at int) {
  now < expires_at
}

caveat on_shift(now int, shift_start int, shift_end int) {
  now >= shift_start && now < shift_end
}

definition patient {
  relation facility:           facility
  relation treating_physician: user
  relation care_team:          user | department#member with on_shift
  relation break_glass:        user with within_window
  relation proxy:              user with within_window
  relation self:               user
  relation consent_withheld:   user        // patient-directed opt-out

  permission view =
      (self + proxy + treating_physician + care_team
       + break_glass + facility->registrar)
      - consent_withheld

  permission update =
      (treating_physician + care_team + break_glass)
      - consent_withheld

  permission view_restricted =          // psych, HIV, substance use, VIP
      treating_physician + break_glass

  permission export = nil               // granted only via service_account
}
```

Notes that matter clinically:

- **Caveats for conditions, native expiry for time.** SpiceDB ≥1.49 has
  `optional_expires_at` on the relationship; use it for TTL rather than a
  `within_window` caveat, and keep caveats for genuine predicates. A
  `break_glass` grant with neither silently becomes permanent access.
- `consent_withheld` as a **subtraction** is how patient-directed restrictions
  actually work. Bolt it on later and you rewrite every permission.
- `on_shift` on `care_team` is how you stop a ward's whole roster from holding
  standing access to every chart they ever touched.
- `view_restricted` is separate from `view` because redaction is not show/hide —
  see §3.
- **Compound rules over one resource get a name here, not a `canAny([...])` in a
  component.** A named permission is one check, one audit row naming the
  granting relation, and one place to change. See §6.7.

Codegen output:

```rust
pub enum PatientAction { View, Update, ViewRestricted, Export }
```

```ts
export type PatientAction =
  | "view" | "update" | "view_restricted" | "export";
```

---

## 2A. The relation grammar

Everything the graph layer can express, and — more importantly — what it cannot.
This section exists because the blind spots are what §2B has to cover.

### 2A.1 Two kinds of statement

Everything reduces to these, and conflating them is the origin of most
vocabulary confusion:

| | | |
|---|---|---|
| **`relation`** | a *stored fact* — an edge written into the tuple store | "Dr Rao is the prescriber of prescription 42" |
| **`permission`** | a *computed expression* — never stored, derived at check time | "who may edit this?" |

`owner` is a relation. `can_edit` is a permission. `billing_viewer` in the
current Rust enum is a permission wearing a relation's clothes, which is why it
has no counterpart in the schema.

### 2A.2 Subject forms — what may sit on the right of a relation

| Form | Syntax | Meaning |
|---|---|---|
| Direct | `relation owner: user` | one subject type |
| Type union | `relation subject: user \| service_account` | several subject types |
| **Subject-set** | `relation dept_member: department#member` | *everyone related to that department by `member`* — indirection, no tuple copying |
| Wildcard | `relation viewer: user:*` | everyone. **Used zero times, correctly** |
| Caveated | `relation viewer: user with on_shift` | the edge exists but only counts when a predicate passes |

The `#` form is what makes department and group access work at all. Without it
every department member needs a tuple per resource.

### 2A.3 Operators

| Op | Name | Meaning | Uses today |
|---|---|---|---|
| `+` | union | any of these | 28 |
| `&` | intersection | all of these | **0** in a permission |
| `-` | exclusion | these, except those | **0** |
| `->` | arrow | traverse to a related object and ask *its* permission | 14 |

### 2A.4 What the operators buy

| Capability | Construct |
|---|---|
| **Inheritance** | arrow — a child follows its parent |
| **Retention** | union with a local relation: `view = prescriber + encounter->view` keeps the prescriber's access after the encounter closes |
| **Separation of duties** | exclusion — *not expressible today, `-` is unused* |
| **Dual control** | intersection — *not expressible today* |
| **Conditional access** | caveat |
| **Expiry** | native `optional_expires_at`, not a caveat |

### 2A.5 "On behalf of" — there is no keyword

The graph layer has **no built-in delegation**. It is modelled, and there are
four constructions that mean four different things:

1. **Subject-set through a delegation object.** Make the delegation a resource
   with a granter, grantee, scope and expiry; then `relation editor: user |
   delegation#grantee`. Correct when delegation must be revocable and auditable
   — in a hospital, always.
2. **Caveated relation carrying context.** `relation editor: user with
   acting_for`, request supplies `{on_behalf_of: <uuid>}`. Correct when the
   authority is ambient rather than granted per record.
3. **A separate permission.** `edit` vs `edit_as_delegate`, so the audit row
   records *which was used*. Correct when accountability differs.
4. **Not a relation at all.** Countersignature is a **state machine** — the
   registrar may write; the record is simply not final until the attending
   signs. Modelling that as a permission is the classic mistake.

**House pattern: (1), with (3) for anything clinical.** Delegation is an object
because it needs a granter, a scope, an expiry, revocation and an audit trail —
and none of those fit on a flag.

The five acting-for modes, and who is accountable — this table is the point of
the whole section:

| Mode | Who acts | Accountable | Example |
|---|---|---|---|
| **Delegation** | B with A's authority | **A** | attending lets a registrar order under their name |
| **Proxy** | B in their own name, for A's data | **B** | parent accessing a child's record |
| **Impersonation** | B appearing *as* A | **B**, and it must be unmissable in the log | support reproducing a bug |
| **Countersignature** | B acts, invalid until A signs | **both** | resident's note; verbal order |
| **Transcription** | B records what A said | **A** clinically, **B** for accuracy | verbal order in an emergency |

If impersonation is logged as the impersonated user, the audit trail is fiction.

### 2A.6 Blind spots — what the grammar structurally cannot say

1. **Sequence.** "B may sign only after A has." State, not a graph edge.
2. **Cardinality.** "any two of three pharmacists"; "a witness who is not the
   administering nurse."
3. **Purpose.** Treatment vs payment vs research vs break-glass — only via a
   caveat threaded through every call.
4. **Negative facts.** "This patient has refused this clinician" needs exclusion
   against a live list.
5. **Obligations.** The answer is not allow/deny but *"allow, but log it
   specifically, mask these four fields, and expire in four hours."*

---

## 2B. The custom grammar

The graph layer answers *relationship* questions. A policy grammar answers the
rest, and — the reason to build it rather than hand-reconcile — **it becomes the
single source that generates both engines.**

### 2B.1 Nouns

| Noun | Carries |
|---|---|
| **Subject** | kind: staff / patient / proxy / service |
| **Acting-for** | granter, grantee, scope, expiry, and which of the five modes (§2A.5) |
| **Resource** | type, id, and **data class** (§3) |
| **Action** | the verb: view, amend, dispense, witness, release |
| **Context** | time, shift, location, device, network, purpose, emergency state |
| **Relation set** | whatever the graph answered — *an input to the decision, not the decision* |

### 2B.2 Operators beyond `+ & - ->`

| Operator | Expresses |
|---|---|
| `requires` | an **obligation**, not a condition — `dispense requires witness(≠ actor)` |
| `at_least N of [...]` | cardinality |
| `after` | sequence / state predicate |
| `unless` | negation **with a named reason**, so the denial is explainable |
| `for_purpose` | binds a rule to a purpose-of-use |
| `degrades_to` | what happens when a dependency is unavailable — declared once, not reinvented per call site |
| `escalates_to` | the break-glass path, with its review consequence attached |

### 2B.3 The output is not a boolean

A **Decision**: outcome (allow / deny / **unknown**), the grant that permitted
it, the data class, and any **obligations**.

Obligations are first-class and today are scattered across handlers:
audit-this-specifically, mask-these-fields, require-second-signature,
time-box-the-session, notify-the-patient.

Denial mode is derived from the class, never chosen at the call site (§3).

### 2B.4 What it generates

| Target | Today |
|---|---|
| `infra/spicedb/schema.zed` | hand-written |
| `crates/medbrains-authz/src/relations.rs` | hand-written — **diverges, see §16.4** |
| `crates/medbrains-core/src/permissions.rs` | hand-written, 897 codes |
| `packages/types/src/permissions.ts` | already generated from Rust |

With one source, `implies()` is derived from each `permission` line, so the
Postgres fallback and the graph engine **cannot** disagree. The parity checks in
§16 become unnecessary — divergence becomes unrepresentable rather than
detected.

### 2B.5 Open decisions — these gate the syntax

1. **Where does it run** — codegen at build time (fast, static, auditable) or a
   runtime evaluator (dynamic, tenant-customisable, slower)?
2. **Authored by engineers or by a compliance officer?** Decides whether it
   looks like Rust or like a sentence.
3. **Per-tenant override, or one policy for all deployments?**
4. **Text in git, or rows in a table with a UI?** Git gives review and history; a
   table gives the hospital self-service.

**Recommendation (assumption in force until overridden): a text grammar in git,
compiled at build time, with caveat/context predicates evaluated at runtime.**
It kills the divergence class permanently, keeps the hot path fast, and
per-tenant variation rides on caveats rather than on forked policy.

---

## 2C. Extensibility

A grammar scales when the **kernel is small and closed, and everything else is
data**. The test for every construct: *can a new one be added by editing a
policy file only?* If adding a module means touching the evaluator, it will not
survive 67 of them.

### 2C.1 What changes, and what absorbs it

| Change | Extension point |
|---|---|
| New resource type (a module ships) | declare it — engine untouched |
| New verb (`release`, `unseal`) | verbs are data, not evaluator variants |
| New relation | generates its enum variant *and* its schema line together |
| New condition (a regulation lands) | predicate registry (§2C.2) |
| New data class / denial mode | table entry |
| New role | composition of existing verbs, never a new concept |
| New tenant with different rules | caveat parameters, not a forked policy |
| New surface (TV, kiosk) | a subject kind, not its own rules |

### 2C.2 The mechanisms

1. **Composition over enumeration.** 897 permission codes should be *derived*
   from `resource × action`, not hand-listed. Adding a resource yields its whole
   permission family. Hand-listing is why 105 codes once existed in Rust that
   the admin UI could not grant.
2. **Namespacing by module.** Each of the 67 modules owns a file; the compiler
   merges and rejects cross-module redefinition.
3. **Aliases with a deprecation window.** How `attending_physician` → `attending`
   gets fixed without a flag day: both resolve, the old warns, a date removes
   it. Without this, renames never happen and the vocabulary calcifies — which
   is exactly the state described in §16.4.
4. **A typed predicate registry.** The escape hatch. Register a named predicate
   with a declared signature rather than forking the language. Without an escape
   hatch people bypass the system; with an untyped one you get chaos.
5. **Rules carry their own test fixtures.** Each rule declares expected
   allow/deny cases inline. At 67 modules nobody holds the interactions in their
   head, so adding a rule must add its proof. **Highest-leverage item here.**
6. **Static analysis at compile time** — unreachable rules, shadowed rules, two
   rules that can both fire with opposite outcomes, a permission no role can
   hold, a relation nothing writes.

### 2C.3 The trap to avoid up front

**Forward compatibility must fail closed.** An older engine meeting an unknown
construct must **deny**, never skip. A grammar that silently ignores unknown
clauses downgrades security on every deployment that has not updated — and it
will look like it is working.

**Version every policy and stamp decisions with it.** An audit row from March
must be explicable under March's rules. **Additive-only semantics between
versions:** a new construct never changes what an existing rule means.

### 2C.4 The closed kernel

Deliberately small, because changing any of it later is expensive:

- The three outcomes — allow / deny / unknown.
- The combinators — how outcomes merge (§6.7).
- The Decision shape — outcome, grant, class, obligations.
- The five acting-for modes. Fixed because they are about *accountability*, and
  an open set means nobody can answer "who is responsible".
- Denial mode derived from class, never chosen.

### 2C.5 Scale in the other sense

- **Tuple growth.** ~3,400 today; a real hospital is millions. Derived tuples
  must be reproducible from FKs rather than stored forever.
- **One round trip per screen.** Bulk-check and list-filter, never N checks in a
  loop.
- **Deletion.** There is already an orphan tuple pointing at a non-existent
  encounter (§16.5). At millions of rows, absent lifecycle rules that becomes
  the dominant cost and a correctness hazard.

---

## 3. Data classification and denial modes

Classification is declared once per field/record type. Mode is derived from it.
Developers never pick a mode at the call site.

| Class | Mode | User sees | Leaks |
|---|---|---|---|
| `routine` | **Disabled** | Control visible, inert, reason on hover | Action (so record) exists |
| `sensitive` | **Tombstone** | "Restricted — 3 notes" + request button | Existence, count, timestamps |
| `identifying` | **Masked** | `DOB 19**` | Schema; sometimes the answer by elimination |
| `restricted` | **Server-redacted** | Lock placeholder; field absent from payload | Field name only |
| `confidential` | **Hidden** | Not rendered | Often inferable — numbering gaps, totals |
| `sealed` | **Cloaked** | Absent from lists, search, counts, exports; 404 direct | Nothing, if consistent |

Three rules:

1. **Masking is the leaky one.** "Test: HIV — result restricted" discloses that
   the test was ordered, which is usually the disclosure. Masking is for
   identifiers, rarely for clinical values.
2. **Hidden is a UI decision; cloaked is a query-layer decision.** Cloaking must
   hold across search, census totals, printed discharge summaries, HL7 outbound,
   push notifications, and "recently viewed." It cannot be implemented in a
   component.
3. **Tombstone views are audit events.** Repeated tombstone hits on a VIP chart
   is the cheapest early-warning signal you will get.

**403 vs 404.** "You may not view patient 456" confirms patient 456 exists. For
`confidential` and `sealed`, return 404. Everything else, 403 with a reason code.

**Configuration decides *whether*; the class decides *how*.** A configured
field-access level is narrowed to the class floor, never loosened. `routine` has
**no floor** deliberately — an unclassified field must never be silently hidden
more than configured.

---

## 4. Rust core — one trait

```rust
#[async_trait]
pub trait PermissionChecker: Send + Sync {
    async fn check(
        &self,
        ctx: &AccessContext,
        action: Action,
        resource: &ResourceRef,
    ) -> Result<Decision, AuthzError>;

    /// One round trip for a whole screen or list page.
    async fn check_many(
        &self,
        ctx: &AccessContext,
        checks: &[(Action, ResourceRef)],
    ) -> Result<Vec<Decision>, AuthzError>;

    /// "Which patients may this user see?" — for list queries.
    async fn lookup_resources(
        &self,
        ctx: &AccessContext,
        action: Action,
        resource_type: &'static str,
    ) -> Result<ResourceIdSet, AuthzError>;

    async fn require(
        &self,
        ctx: &AccessContext,
        action: Action,
        resource: &ResourceRef,
    ) -> Result<Grant, AuthzError> {
        match self.check(ctx, action, resource).await {
            Ok(d) if d.allowed => Ok(d.grant),
            Ok(d)  => Err(AuthzError::Denied(d.into_audit())),
            Err(e) => Err(e.fail_closed()),   // never leaks as "allow"
        }
    }
}
```

```rust
pub struct AccessContext {
    pub subject:      SubjectRef,      // user:123 | service:hl7-in
    pub session:      SessionId,
    pub facility:     FacilityId,      // active facility, not "all mine"
    pub purpose:      PurposeOfUse,    // Treatment | Payment | Operations
                                       // | Research | BreakGlass
    pub break_glass:  Option<BreakGlassToken>,
    pub consistency:  Consistency,
    pub caveat_ctx:   CaveatContext,   // now, shift bounds
    pub request_id:   RequestId,
}

pub struct Decision {
    pub allowed:    bool,
    pub grant:      Grant,       // which relation granted it — for the audit row
    pub class:      DataClass,   // drives denial mode on the client
    pub checked_at: ZedToken,
}
```

`AuthzError::Denied` and `AuthzError::Unavailable` must stay distinguishable
internally (one is a decision, one is an outage) and identical on the wire.

**Not every `Err` is an outage.** A refusal delivered as an error is still a
refusal, and a misconfiguration is neither. The mapping is fixed:

| Error | Outcome | Why |
|---|---|---|
| `Forbidden`, `CaveatFailed` | **Deny** | the engine evaluated and said no |
| `UnknownObjectType`, `InvalidRelation`, `ExpansionDepthExceeded` | **Deny** | our bug; retrying never fixes a missing registry entry, and 503 sends an operator to inspect healthy infrastructure |
| `Backend`, `Other` | **Unknown** | genuinely could not ask; the only retryable case |

Implementations: `SpiceDbChecker`, `StubChecker` (deterministic test fixtures),
and `RecordingChecker` wrapping either — so audit is impossible to forget rather
than something each call site remembers.

---

## 5. Consistency and relationship writes

### 5.1 Consistency

A doctor removed from a care team at discharge who can still read the chart for
a cache window is a compliance finding.

| Operation | Consistency |
|---|---|
| Reads of PHI | `at_least_as_fresh(zedtoken on the patient row)` |
| Writes / clinical actions | `fully_consistent` |
| Revocation, discharge, consent change | `fully_consistent`, then bump stored zedtoken |
| Menu/module visibility | `minimize_latency` (cosmetic) |

> Operational note: `zed` at default consistency returns **false** for a
> just-written grant. Use `--consistency-full` when verifying by hand, or you
> will chase a phantom bug.

### 5.2 The dual-write problem

Admission commits to Postgres, the tuple write fails, and the team that just
admitted the patient cannot open the chart. The inverse on discharge is worse:
access that should have ended, didn't.

- Relationship writes go through a **transactional outbox** in the same Postgres
  transaction as the clinical write.
- A relay publishes to the graph engine and records the returned ZedToken back
  onto the aggregate.
- Writes are **idempotent** so replay is safe.
- A reconciler walks recent clinical state vs. the graph nightly and alerts on
  drift. Revocation drift is a page, not a ticket.

**`relation_tuples` is the write-ahead store; the graph engine is an index built
from it.** Anything that writes grants directly to the index — including
backfills — creates rows the Postgres fallback cannot see and that vanish when
the index is rebuilt. See §16.5.

---

## 6. Rust surfaces — seven

**The service layer is the guard, not HTTP.** HL7/FHIR ingest, scheduled jobs,
the Tauri IPC bridge, and the admin CLI all bypass Axum. If authorization lives
only in middleware, those paths are unprotected.

### 6.1 `require()` inside the service — the primary API

```rust
impl PatientService {
    pub async fn update(
        &self,
        ctx: &AccessContext,
        id: PatientId,
        patch: PatientPatch,
    ) -> Result<Patient, Error> {
        let grant = self.authz
            .require(ctx, Action::Patient(Update), &id.as_ref())
            .await?;

        self.repo.update(id, patch, grant.audit_ref()).await
    }
}
```

Every public service method takes `&AccessContext` first. Make it a lint. It is
the single habit that keeps this system honest.

### 6.2 Axum extractor — the path-parameter case

```rust
async fn update_patient(
    Authorized { ctx, resource: patient }: Authorized<Patient, Update>,
    Json(patch): Json<PatientPatch>,
) -> Result<Json<Patient>, ApiError> { … }
```

Don't contort it for body-derived or multi-resource operations — fall back to
`require()` in the service.

### 6.3 Middleware — authentication, active facility, purpose-of-use

Middleware establishes *who*, *which facility*, and rejects requests with no
purpose-of-use. It does not make the resource decision.

### 6.4 `lookup_resources()` — lists and search

Never fetch 500 patients and filter. Two workable shapes:

- **Pre-filter:** push the visible-id set into the SQL/search `WHERE`. Correct
  pagination and counts. Degrades when the set is huge.
- **Scoped lookup:** narrow by facility + ward in SQL first, then check the page.

Post-filtering search results breaks pagination and totals, and a `sealed`
record that affects a count is not cloaked. Decide this **before** picking the
search stack — retrofitting authz into an index is a rewrite.

**A list must never render an outage as emptiness.** An unanswerable scope
refuses the whole list; it does not return zero rows. A blank ward reads as a
fact about the ward.

### 6.5 Policy objects — where business rules exceed ReBAC

```rust
impl PatientPolicy<'_> {
    pub async fn can_amend_signed_note(
        &self, ctx: &AccessContext, note: &Note,
    ) -> Result<bool, AuthzError> {
        Ok(self.authz.check(ctx, Update, &note.into()).await?.allowed
           && note.signed_at.elapsed() < Duration::hours(24))
    }
}
```

The graph answers *relationship* questions. Policies answer *state and time*
questions. Don't encode "note locks after signing" in the schema. In v3 these
become `after` / `requires` clauses in the custom grammar (§2B.2) rather than
hand-written policy objects.

### 6.6 Break-glass

```rust
let token = self.break_glass
    .open(ctx, patient_id, reason /* free text, required */)
    .await?;   // writes an expiring relationship, audit row,
               // notifies privacy officer + attending
```

Normal `require()` then succeeds via the `break_glass` relation, and every
downstream audit row names that grant. A review queue is a product requirement.

The audit label must **not** carry the free-text reason — it may name a patient.

Macros (`#[require_permission(...)]`) — defer. They hide the `ctx` plumbing you
want visible while the model is still moving.

### 6.7 Combining checks

**Same resource → the schema (§2). Different resources → the call site.**

A `canAny(["patient:update", "patient:admin"], patient)` in a component is an
unnamed permission: unauditable, and changing it means grepping React. Name it
in the schema instead. Call-site combinators exist only for questions the graph
cannot express in one permission — those spanning two resources.

```rust
let ok = authz.all(ctx, &[
    (Update, patient.as_ref()),
    (Create, encounter.orders()),
]).await?;

let ok = authz.any(ctx, &[
    (Update, patient.as_ref()),
    (Amend,  note.as_ref()),
]).await?;

let ok = authz.all(ctx, &required)
              .except(ctx, &blocked)
              .await?;
```

All of these ride on `check_many` — one round trip, never a loop of `check()`.

Bulk resource actions ("discharge all 12 of these") use `filter`:

```rust
let permitted = authz.filter(ctx, Discharge, &patient_ids).await?;
// proceed on `permitted`, report the remainder explicitly
```

Partial success with a visible report beats both silent skipping and a blanket
refusal.

**Three-valued logic.** Checks are tri-state — `Ok(allowed)`, `Ok(denied)`,
`Err(Unavailable)` — so combinators are Kleene, not boolean:

| | resolves to |
|---|---|
| **`all`** | `deny` if any `deny`; else `unknown` if any `unknown`; else `allow` |
| **`any`** | `allow` if any `allow`; else `unknown` if any `unknown`; else `deny` |
| **`none`** ≡ ¬`any` | `deny` if any `allow`; else `unknown` if any `unknown`; else `allow` |
| **`not_all`** ≡ ¬`all` | `allow` if any `deny`; else `unknown` if any `unknown`; else `deny` |

`none` and `not_all` collapse into each other under boolean logic and diverge
here. Keep both, name them explicitly, and note the invariant that holds across
all four: **no combinator ever produces `allow` from `unknown` alone.** An outage
must not manufacture a positive from a negative.

Two rules that follow, and they are the reason this section exists:

1. **Never collapse `unknown` to `false` before negation.** `!can(x)` where the
   check errored yields `true`, and "not permitted to see restricted data"
   becomes "show it." This is the most likely path from an outage to a
   disclosure.
2. **Collapse once, at the boundary.** Compose in three values; `require()` (or
   degraded mode, §7) resolves `unknown` to deny.

**A multi-branch check must not short-circuit on `unknown`.** `any([Unknown,
Allow]) == Allow` — a clinician with a real grant on one branch must still get
through when another branch is unwell. Only a definite `Allow` returns early.

**`none()` may gate a denial path, never a disclosure path.** It is a negative
check returning a positive result, so it tends to sit in front of a reveal —
which is exactly where rule 1 fails open. Legitimate: showing a request-access
panel, routing to break-glass, hiding a shortcut. Illegitimate: anything that
renders data or enables a write. For the one case where `none()` is genuinely
load-bearing, see §12.

---

## 7. Degraded mode

"Fail closed and page" is right for compliance and wrong for patient safety if
it means a ward cannot open charts during an outage. Decide now, in writing, not
during the incident.

**v3 correction.** The premise of this section was partly wrong. The durable
backend already falls back to Postgres on a graph-engine error, and
`relation_tuples` is the *source of truth*, not a cache. A graph outage
therefore costs latency, not correctness, and `unknown` only arises when
**Postgres itself** is unavailable — at which point the request is failing
anyway. **A degraded-mode cache is not needed and should not be built**; it
would add a stale copy of data already held authoritatively.

What remains true and required:

- The **fallback must enforce the same policy** as the index. It currently does
  not (§16.4) — that is the real degraded-mode bug.
- Entering and leaving a degraded state pages, and is visible in the UI banner —
  clinicians should know the system is running on a slower path.
- Any grant made under exceptional conditions is flagged and lands in the same
  review queue as break-glass.

---

## 8. The client contract

One endpoint, called once per screen:

```
POST /authz/checks
{ "purpose": "treatment",
  "facility": "facility:kmc",
  "checks": [
    { "action": "patient:update", "resource": "patient:456" },
    { "action": "order:create",   "resource": "encounter:99" }
  ]
}
→ { "results": { "patient:update@patient:456":
                 { "allowed": true, "class": "routine" } },
    "zedtoken": "…", "ttl": 60 }
```

The client never asks "what are my permissions?" globally. It asks about the
objects on the screen it is rendering. Keeps scoping honest and the payload
small enough for React Native and the TV client.

List rows carry capabilities inline so tables don't fan out:

```json
{ "id": "patient:456", "name": "…", "_can": ["view", "update"] }
```

Redactions carry their class so the client cannot under-protect:

```json
{ "_redacted": [
    { "field": "hiv_status",  "mode": "redact",    "requestable": true },
    { "field": "psych_notes", "mode": "tombstone", "count": 3 }
] }
```

Sealed records appear nowhere in any of the above, and direct access is 404.

---

## 9. React surfaces — six

### 9.1 `usePermission(action, resource)` — tri-state

```tsx
const { allowed, loading, mode } = usePermission("patient:update", patientId);
```

Returns `loading`, not `false`, while unresolved. Rendering `false` first makes
buttons flicker — in a clinical UI that reads as a broken system and generates
support calls. Reads from a `PermissionProvider` hydrated by the screen-level
bulk check, so the hook is synchronous after first paint.

### 9.2 `<Can>` — mode comes from the server

```tsx
<Can action="patient:update" resource={patientId}
     reason="Only the care team can edit this chart">
  <SaveButton />
</Can>
```

No `mode` prop. The class in the check result decides disabled / tombstone /
hidden. Defaulting everything to hidden is the most common mistake in HMS UI:
clinicians who can't see an action assume the feature doesn't exist and call
support.

### 9.3 `<PermissionButton>` — actions

`<Can>` plus 403 handling: when the server denies what the client thought was
allowed (stale cache, access revoked mid-shift), show the denial, refresh the
permission cache, offer break-glass where `requestable`.

### 9.4 `<RequirePermission>` — routes

```tsx
<Route path="/patients/:id" element={
  <RequirePermission action="patient:view" resource={useParam("id")}
                     onDeny={<BreakGlassPrompt />}>
    <PatientChart />
  </RequirePermission>
} />
```

For `sealed`, `onDeny` renders the generic 404 page — not a denial page.

### 9.5 `<Protected>` — field-level

```tsx
<Protected field="hiv_status" />
// mode resolved from the server-declared class, never passed in
```

Restricted values never reach the client. Sending the value and hiding it in CSS
is a breach waiting for a devtools screenshot. Tombstone renders emit an audit
beacon.

### 9.6 `usePermissions()` — combinators

Same shapes as §6.7, reading the prefetched map, synchronous after first paint:

```tsx
const { all, any, filter } = usePermissions();

const canSubmit = all([
  ["patient:update", patientId],
  ["order:create",   encounterId],
]);   // → "allow" | "deny" | "loading"
```

`loading` propagates exactly as `unknown` does server-side — which is why these
return tri-state rather than a boolean. Same-resource compounds still belong in
the schema; if you find yourself writing `any([...])` over one patient, add a
named permission.

**A control's gate must match the permission its call requires.** A tab gated on
`.list` containing a button that needs `.create` shows a read-only user an
action the server will refuse — the UI promising what authorization denies.

**Module manifest** (the one registry worth keeping) drives menus and dashboard
tiles: `{ id, component, action, resource_type, facility_scoped }` — resolved by
a single bulk check at login.

Dropped from the draft: HOC (use `<Can>`), component metadata, factory.

---

## 10. Tauri / React Native / TV

- **Ward tablets and the TV board** are shared-space devices. Permission cache is
  keyed to the session and cleared on blur/idle, not on logout alone.
- **Offline (Tauri, RN):** ship a signed capability bundle with a short expiry
  (minutes for PHI reads). Writes queue locally and are **re-authorized on
  sync** — the offline check is provisional, and the UI must be able to show
  "rejected on sync."
- Never let an offline client be the sole authority for a break-glass grant.
- Sealed records are never included in an offline bundle.
- **Reads gate the query, not just the control** — a screen without the
  permission must not issue the fetch at all.

---

## 11. Meta-authorization and audit

Who grants roles is itself an authz question, and delegation without constraint
is a privilege-escalation path.

- Granting a relation requires a permission on the *target scope*, and a
  department head cannot grant beyond their own department.
- Sensitive grants (org admin, export, audit-log read) require four-eyes.
- **Reading the audit log is a permission**, and audit-log reads are themselves
  audited. Privacy officers are subject to review too.
- Break-glass review queue has an SLA and an owner. An unreviewed queue converts
  break-glass into an unlogged bypass within a month.
- Audit rows are append-only, retained per policy, and exportable for
  investigation.
- **Machine identity is identity.** An API key resolves to a service account
  that can be attributed, scoped and revoked — never to a borrowed human
  session, and never to a surface that assumes one.

---

## 12. Separation of duties

The genuine "none-of" case, and it belongs in the schema as **exclusion** — one
named permission with an audit trail — not as a client-side negation.

```zed
definition medication_order {
  relation ordered_by: user
  relation pharmacist: facility#pharmacist
  relation supervisor: facility#clinician

  // the verifier must not be the orderer
  permission verify  = pharmacist - ordered_by
  permission approve = supervisor - ordered_by
}
```

Where this applies in MedBrain:

- **Medication verification** and controlled-substance dispensing — orderer ≠
  verifier ≠ dispenser.
- **Incident reports** — the reporter cannot close their own report.
- **Credentialing** — no self-approval of privileges.
- **Staff-as-patient** — a clinician must not appear on their own care team;
  combine with `confidential` classification (§3), since colleague-curiosity is
  the most common inappropriate-access pattern in any hospital.
- **The four-eyes grants in §11** — the same mechanism, applied to authorization
  itself.

Two requirements that make it operationally useful:

1. **A distinct reason code.** "You hold a conflicting role" and "you lack
   access" need opposite remediation — one is escalate-to-a-colleague, the other
   is request-access. Collapsing both into a generic 403 sends the user down the
   wrong path and teaches them to file support tickets.
2. **SoD denials go to the review queue.** A clinician repeatedly attempting to
   verify their own orders is a signal, whether it is a workflow problem or a
   person problem. Either way someone should see it.

API-level `none()` (§6.7) remains only for **cross-resource** conflicts the
schema cannot reach:

```rust
// this user must hold no ordering right on any order in the batch
let clean = authz.none(ctx, &order_refs.map(|o| (Ordered, o))).await?;
```

One caution: SoD rules are the ones staff will route around under time pressure
— a single night pharmacist, a rural facility with one supervisor. Design the
break-glass path for SoD *deliberately* (§6.6), or people will invent one by
sharing logins.

**Exclusion (`-`) is used zero times in the current schema, so none of the above
is enforceable today.** It is the single highest-value grammar construct not yet
in use.

---

## 13. Schema migration and testing

- `zed validate` assertions in CI, run against every PR. An authz schema without
  a test matrix is a schema nobody can safely change.
- The matrix covers, per resource type: treating physician, care-team member
  on-shift and off-shift, same-facility non-team, other-facility, patient, proxy
  before and after age-out, revoked proxy, break-glass active and expired,
  consent-withheld, service account.
- Permission changes with live relationships need **dual-read** (evaluate old and
  new, log divergence, then cut over) and a backfill plan.
- Caveat changes are schema changes — same process.
- **A test that skips silently is worse than no test.** Graph-engine smoke tests
  gated on an env var report "passed" when they ran nothing. Assert the gate.

---

## 14. Anti-patterns to lint for

- `user.role === "doctor"` anywhere in `src/` — roles are a graph concern.
- A service method without `&AccessContext`.
- `.check()` inside a `.map()` over a list (N+1 → `check_many`), including
  `all`/`any` implemented as a loop.
- `any([...])` or an exclusion list assembled over a **single** resource — that
  is a missing named permission (§2).
- Negating a check to decide whether to *reveal* something. Reveal decisions come
  from the server's `class`, never from `!allowed`.
- `none()` gating a render or a write rather than a denial path (§6.7).
- A separation-of-duties rule expressed as a client-side negation instead of a
  schema exclusion (§12).
- Any `unwrap_or(false)` / `?? false` / `.is_ok()` on an authorization result —
  enforced by `make check-authz-collapse` (§16.3).
- A `mode` prop passed by a component author.
- Caching an *allow* longer than the deny TTL.
- Break-glass without a reason string.
- A caveated relation written without its expiry context.
- 403 on a `sealed` resource.
- A backfill or migration writing grants **directly to the index** rather than
  through the durable store (§16.5).
- A relation name that exists on one side of the codegen only (§16.4).

---

## 15. Build order

1. **Schema + caveats + codegen + trait + `StubChecker`.** Wire `require()`
   through three services end to end. Data classes declared.
2. **Graph engine + audit wrapper + outbox + zedtoken storage.** Relationship
   writes on admission, care-team assignment, shift, discharge, consent.
3. **Extractor + `/authz/checks` + React provider, `usePermission`, `<Can>`,
   `<Protected>`.** One screen fully converted, all six denial modes exercised.
4. **Break-glass + review queue + degraded-mode policy.** Before any real PHI is
   in the system.
5. **Separation of duties** wherever medication or approval workflows exist.
   Ships with the first workflow that needs it, not after.
6. **Bulk/lookup for lists and search, cloaking across every surface, module
   manifest.**
7. **Patient portal and proxy subjects.** Second subject class, own test matrix.
8. **Offline bundles; meta-authz four-eyes; macros if still worth it.**

Phases 1–2 are the whole architecture. Everything after is ergonomics — except
phases 4 and 5, which are safety.

**v3 insertion — phase 0: the grammar (§2B).** Because every phase above
otherwise hand-writes a vocabulary that has already diverged once (§16.4).

---

## 16. Implementation state

What is actually built, with evidence. Kept current so the programme can be
resumed without re-deriving it.

### 16.1 Built and verified

| Piece | Evidence |
|---|---|
| Kleene core — `all`/`any`/`none`/`not_all`, `Outcome`, `Decision` | 44 tests; invariant test that no combinator makes `allow` from `unknown` |
| `Authorized<P>` / `AllOf` / `AnyOf` extractors | — |
| `AccessContext` — subject kinds, purpose, freshness, facility, request id | — |
| Permission codegen Rust → TS; 897 codes, 33 role templates at parity | `make check-permissions` |
| Data classes + denial modes; all 49 redactable fields classified | `make check-field-classes`, proven by planting an unclassified constant |
| Field access narrows to the class floor; `routine` has no floor | 5 tests, one of which caught a floor that would have hidden unclassified fields |
| Graph engine v1.56, GHSA-4vrg-r928-h5vv closed | — |
| Schema 21 definitions, arrows proven live (grant, cascade on revoke, prescriber retains own) | — |
| Unguarded routes 154 → 0 | three buckets, each with written reasons |
| Mobile staff screens gated 7 → 16 of 26 | reads gate the query via `enabled:` |

### 16.2 Standing rule

**Permissions first.** Every feature defines its permission in Rust *before* any
handler, page or button. The TS catalogue is generated, never hand-edited. Every
authorization defect found in the 2026-08-15 audit came from this being done
last.

### 16.3 The outage-vs-refusal class — closed

`Outcome::Unknown` existed in exactly one file: the one defining it. Every call
site collapsed errors with `.unwrap_or(false)`, so a fault inherited the
disguise a refusal wears.

- **31 sites swept.** A first pass found 11 — the grep window was three lines and
  the call chains are longer. **A CI check closes the class, not a better grep:**
  `make check-authz-collapse`.
- **Six were duplicate copies** of an existing public function — deleted, not
  fixed six times.
- **Worst instance:** the AI copilot's grounding gate used `.is_ok()`, so a
  database fault produced a fluent clinical answer with the patient's chart
  silently missing from it. Every other instance made data *disappear*; that one
  made data *appear*.
- **Second worst:** `list_accessible` → `unwrap_or_default()` rendered an
  **empty ward list** on a database fault.

### 16.4 Open: the two vocabularies

`schema.zed` has 13 subject relations. The Rust `Relation` enum has 13 codes.
**Only 3 overlap** — `owner`, `editor`, `viewer`.

| Direction | Consequence |
|---|---|
| In schema, not in enum — `attending`, `creator`, `dept_member`, `doctor`, `group_member`, `ordering_provider`, `patient_attending`, `prescriber`, `runner`, `ward_member` | `PgAuthzBackend::check` expands via `implied_by()` and matches enum codes only, so these are **invisible to the Postgres path**. Proven live: **365 `dept_member` tuples the fallback can never match.** |
| In enum, not in schema — `attending_physician`, `consultant`, `nurse`, `phlebotomist`, `referred_to`, `followup_assignee`, `approver`, `auditor`, `billing_viewer`, `billing_editor` | the graph engine rejects unknown relations, so a tuple with these lands in Postgres and **fails forever in the outbox**. Latent: all 10 are referenced in code; live data uses only `owner` and `dept_member`, so it has not bitten yet. |

`attending_physician` vs `attending` is almost certainly one concept under two
names. `make check-relation-parity` measures the gap; it is **deliberately not
in `check-all`** until parity is reached, because wiring a failing check into
the gate teaches people to ignore the gate.

**This is the case for §2B.** Two hand-written vocabularies diverged; a third
hand-written reconciliation would diverge again.

### 16.5 Backfill and tuple lifecycle

- `rebac-backfill` wrote **straight to the index**, never touching
  `relation_tuples`. Rewritten to insert with `source='derived'`,
  `derived_from=<fk column>`, `sync_status='pending'` so the outbox syncs the
  index. The schema had anticipated this (`rt_derived_idx`) with **zero rows
  using it**.
- Its dry run counted *source rows* and over-reported — 364 promised where the
  true answer was 1. It now runs the real insert and rolls back, so the
  rehearsal cannot disagree with the performance.
- `encounters.created_by → owner` was declared in the schema and implemented
  nowhere. Added; it is the only user-subject edge an encounter has, since
  `doctor_id` is null on all 364.
- **729 tuples written**, dry run matching exactly.
- **Open — lifecycle.** An orphan `dept_member` tuple points at an encounter that
  does not exist. Grants are not revoked when their object is deleted.

### 16.6 Nested-route IDOR — the parent id bound and discarded

Distinct from a missing record check, and not fixed by adding one.

```rust
Path((_admission_id, item_id)): Path<(Uuid, Uuid)>
"UPDATE admission_checklists SET … WHERE id = $1 AND tenant_id = $2"
```

The parent is accepted, underscore-prefixed and never used, so
`PUT /api/ipd/admissions/{A}/checklist/{item}` updates an item belonging to
admission **B**. Tenant is the only constraint.

- The parent segment provides **no** authorization, so guarding the parent alone
  would not have closed it — the child is reachable through any parent.
- **The audit row records the URL.** It says the clinician acted on admission A
  while the write landed on B. An investigation reads a confidently wrong
  answer. This is the consequence that outlasts the bug.

**13 handlers repo-wide**: ipd 5, facilities 3 (ICU device removal, bundle
checks), opd 2 (`update_consultation`, `delete_diagnosis`), documents, mrd,
doctor-packages. `make check-parent-id-scoping` gates the class; not in
`check-all` until the remaining 8 are fixed.

**ipd's 5 are closed.** Each got the parent bound, the statement scoped, *and*
`require_admission_access` — scoping only makes the URL honest, it does not
decide who may act. `list_restraint_checks` needed a different shape:
`restraint_monitoring_logs` has no `admission_id`, so it scopes via `EXISTS` on
the parent doc rather than inventing a column.

Verified by `PREPARE` against the live schema, not by the compiler — these are
runtime `query_as` strings, so placeholder numbering (including a `$13`) is
invisible to `cargo check` and a mistake would be a 500.

### 16.7 UI element gates

192 suspected → **4 real**, after filtering one-hop delegation (108 child
components inside guarded parents) and the settings tab registry (18). The 4
were one defect: **tab gated on `.list`, button needs `.create`.** Fixed in
Departments, Facilities and Locations settings.

### 16.8 Patient access, now designed rather than accidental

Two rules had divided by *which crate served the endpoint*. `patient_consents`
returned 404 via `/patients/:id/consents` and 200 via the consent module — same
table, same clinician. **`list_patient_allergies` was direct-only**, so a
clinician treating via an encounter got 404 on allergies while able to read the
drug timeline.

Now: **clinical reads** encounter-reachable (patient record, allergies, consents,
visits, consultations, lab orders, documents, timeline); **financial** direct-only
(insurance, invoices); **writes** unchanged (direct `Editor`).

---

## Open questions

- **The four grammar decisions (§2B.5)** — runtime vs codegen, author audience,
  per-tenant override, git vs table. These gate the syntax.
- **Role `field_access_defaults`** — 0 of 33 roles configured. Which roles stop
  seeing which fields is a clinical decision, not a technical one.
- **DPDP Act / ABDM.** If MedBrain integrates with ABDM, consent artifacts are
  externally managed by a consent manager, which likely makes `consent_withheld`
  a **synced projection** rather than your own source of truth — with all the
  staleness questions that implies. Confirm against current ABDM specs before the
  schema hardens.
- **Retention vs. erasure.** Audit rows must survive; some erasure rights say
  otherwise. Needs a legal answer, then a schema answer.
- **Tenancy shape.** Single hospital vs. a group with cross-facility referrals
  changes §2 substantially. The current schema assumes a group.

# RFC — Access resolution as a graph (who can see a patient record)

**Status:** Accepted (direction) · **Date:** 2026-07-14 · **Extends:** `RFC-PATIENT-ACCESS-CONTROL.md`

## Context & decision

"When a patient comes in, who gets to see their record?" is not a flat permission check — it is a
**reachability question over a graph**. A user reaches a patient's record through a *chain* of relationships:
they are the attending; or they are in the treating **department**; or they are on a **care-team group**; or
they are linked to one of the patient's **encounters** or **admissions**, which in turn belong to the patient.
This RFC makes that graph, and the algorithm that traverses it, explicit — so the "who can see" rules are one
well-specified **DSA** (bounded graph traversal with memoization), not scattered ad-hoc checks.

**Decision.** Model access as reachability over the `relation_tuples` graph plus two implicit edge kinds
(relation **implication** and clinical **object hierarchy**), resolved by a **bounded BFS with a visited-set
(the dynamic-programming memo)**. Rank paths by trust strength where a "why" is needed (Dijkstra-style). This
replaces the current flat single-hop PG check and fixes patient-level document access (the care team reaches
the patient *through* its encounters/admissions, so it need not be patient-linked directly).

## The graph

**Vertices**
- Subjects: `user`, `department`, `access_group` (care team / tumor board / on-call rotation).
- Objects: `patient` → `encounter` → `admission` (clinical hierarchy), plus `invoice`, `lab_order`, …

**Edges** (all tenant-scoped; an edge "grants" a relation on an object)
1. **Direct grant** — a `relation_tuples` row: `subject —relation→ object` (owner/editor/viewer/attending/
   dept_member/ward_member/group_member/viewer).
2. **Implication** — `owner ⇒ editor ⇒ viewer`, `attending ⇒ editor ⇒ viewer`, `consultant ⇒ viewer`
   (`relations.rs::implies`). A grant of a stronger relation satisfies a weaker request.
3. **Subject expansion** — `department —member→ user`, `access_group —member→ user`, and the 7-layer
   department hierarchy (campus→building→floor→department). A dept/group grant reaches all its members.
4. **Object hierarchy** — `admission —belongs_to→ encounter —belongs_to→ patient`. Seeing the patient is
   reachable from a grant on *any* of the patient's encounters or admissions. **This is the edge the flat
   check is missing**, and the one that makes care-team → patient-document access work.

## The algorithm (bounded BFS + DP memo)

`can_view(U, target)`:
```
if U.is_bypass: return true                      # super_admin / hospital_admin = universal source
seen = {}                                         # DP memo — a subgraph resolved once
frontier = expand(target)                         # start from the object; add its hierarchy parents
for depth in 0..MAX_DEPTH (=6):                   # bounded — no unbounded traversal
    for node in frontier (dedup via seen):        # visited-set kills cycles (group-in-group)
        if direct_or_implied_grant(U, node): return true
        frontier += subject_expansions(node) + hierarchy_parents(node)
return false                                      # fail-closed
```
- **DP / memoization** = the `seen` set: each department, group, or object is expanded at most once per
  request, so overlapping subproblems (the same department checked for many objects) cost O(1) after the first.
- **Bounded** = `MAX_DEPTH` + `seen` guarantee termination and flat cost regardless of graph shape (Power of
  Ten: bound every traversal).
- **Trust ranking (optional, Dijkstra-style)** — when the UI must show *why* access was granted, run the same
  traversal as a min-cost search with edge weights (direct=0, department=1, group=2, break-glass=3) and return
  the lowest-cost justifying path.

### `can_view_patient(U, P)` — the concrete rule set (main rules)
1. Direct/implied grant on `patient:P` (owner, attending, viewer, dept_member@P, group_member@P). **OR**
2. ∃ encounter `E` of `P` where `can_view(U, E)` (treating department / attending / explicit). **OR**
3. ∃ admission `A` of `P` where `can_view(U, A)` (ward/dept member / attending / explicit). **OR**
4. A **break-glass** time-boxed grant on `patient:P` (audited). **OR**
5. `U.is_bypass`.
Rules 2–3 are the object-hierarchy traversal; they bound the encounter/admission fan-out with a recent-window
`LIMIT` so a patient with a long history stays O(bounded).

## Implementation

- **In-Postgres** (`backend_pg.rs`): a `WITH RECURSIVE` CTE over `relation_tuples` implements the BFS —
  `UNION` is the visited-set, the recursion depth is `MAX_DEPTH`. Replaces the four flat `EXISTS` queries with
  one traversal; the object-hierarchy join (`admissions.encounter_id`, `encounters.patient_id`) adds rules 2–3.
- **In-memory** (`backend_test.rs`): the same BFS as plain Rust (explicit `VecDeque` + `HashSet` memo) — the
  reference implementation, unit-tested for multi-hop cases (dept→admission→encounter→patient; nested groups;
  cycle safety; depth bound).
- **SpiceDB** already resolves this natively (its schema's `permission view = …` is exactly this reachability);
  the durable backend keeps SpiceDB as the fast path and the recursive-CTE PG as the fallback — the two must
  agree, verified by a differential test.

## Non-goals / constraints
- Not a general shortest-path engine — reachability first; trust-ranking (Dijkstra) is opt-in for explainability.
- Bounded always: `MAX_DEPTH=6`, recent-window `LIMIT` on encounter/admission fan-out, `seen` memo mandatory.
- Fail-closed; `NotFound` not `Forbidden`; layers on top of RBAC + RLS.
- Validate against the live SpiceDB+PG (both up) with the differential + multi-hop unit tests before rollout.

## Phased
- **G1** — reference BFS + `can_view_patient` object-hierarchy rules in `backend_test.rs` (in-memory) + unit
  tests. Pure DSA, fully testable, no DB.
- **G2** — `backend_pg.rs` recursive-CTE `check` (implication + subject expansion + object hierarchy),
  behind the same trait; differential test vs in-memory + vs SpiceDB.
- **G3** — `require_patient_access` uses `can_view_patient`, unblocking patient-keyed **document** enforcement
  (case sheets, MRD detail, generated/ingested docs).
- **G4** — trust-ranked "why can this user see this patient" for the audit/console; break-glass edge.

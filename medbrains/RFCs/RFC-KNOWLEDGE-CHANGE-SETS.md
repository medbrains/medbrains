# RFC: Knowledge change sets

Status: DRAFT, awaiting approval · Owner: Domnic Amalan S · 2026-10-31

## 1. Problem

The clinical knowledge a hospital runs on (drug interactions, the formulary, critical lab
values, codes, prices, roles) is edited row by row, live, with no preview and no way back.

- Deleting a drug interaction today silently stops every future warning for that pair. Nobody
  sees that 14 patients on the ward are taking both drugs.
- `pharmacy_catalog`, `drug_interactions`, `critical_value_rules`, `lab_test_catalog`,
  `charge_master`, `departments`, `roles` and `tenant_settings` keep **no history at all**.
- The allergy cross-reactivity classes are a constant in Rust (`medbrains-core/src/allergy.rs:29`),
  so a hospital cannot correct them and nobody can audit a change to them.
- The two dry-run tools that exist (`config_transfer.rs`, setup workbook) show *what* changes,
  never *who or what is affected*, and cannot roll back.

Idea borrowed from Open Ontologies (MIT): plan a change, see its blast radius, apply it, keep a
proof an auditor can re-check without trusting us. Built natively in Rust + PostgreSQL; no second
system for hospitals to run.

## 2. What a user can do

1. **Draft** a change set: one or more edits to one knowledge area, with a reason.
2. **Preview** its impact before anything is live: counts and examples of the patients, orders,
   prescriptions, users and rules it affects, each with a severity.
3. **Approve**: a second person approves safety-critical areas (author ≠ approver).
4. **Apply** it atomically: all items or none.
5. **Roll back** an applied change set as a new, previewed change set.
6. **Prove** it: download a proof file that an auditor can verify offline.

## 3. Design

### 3.1 Tables (tenant-scoped, FORCE RLS, soft delete)

- `knowledge_change_sets`: `id, tenant_id, area, title, reason, status, author_id, approver_id,
  created_at, previewed_at, approved_at, applied_at, rolled_back_by_set_id, base_hash, proof_hash,
  impact jsonb`.
  Status: `draft → previewed → approved → applied → rolled_back`, or `rejected`, or `stale`
  (the live data changed after preview).
- `knowledge_change_items`: `id, change_set_id, target_kind, target_key, op (create|update|delete),
  before jsonb, after jsonb, seq`.

`before` is captured at preview and re-checked at apply. If live data no longer equals `before`,
apply refuses and the set becomes `stale` (no silent overwrite).

### 3.2 Adapters, one per data shape

Each knowledge kind registers an adapter with four operations: `read_current`, `validate`,
`apply` (inside the caller's transaction) and `impact`. The research found eight shapes; v1 covers
the first six.

| Shape | Examples | How impact is found |
|---|---|---|
| Rows joined by FK | `pharmacy_catalog`, `lab_test_catalog`, `departments` | follow FKs, one batched query per referencing table |
| Rows joined by text code | `drug_interactions` (drug names), `critical_value_rules` (test code), `charge_master` (charge code) | value-match queries |
| JSONB documents | `roles.permissions`, `users.access_matrix`, `workflow_templates.steps` | JSON-path diff; for permissions, recompute effective access with `resolve_permissions` for affected users |
| Key/value config | `tenant_settings` | per-key diff; impact lists the features that read the key |
| Already versioned | `order_set_templates` | use its own version + approve flow; the change set wraps it |
| Release replace | `icd10_catalogue` | set-against-set diff by release; impact = live diagnoses using removed codes |
| Global reference data | `cds_*`, `snomed_*` | out of scope v1 (platform-level, not per hospital) |
| Rules in code | allergy `CLASSES` | moved to a table first (phase 5), then a normal adapter |

### 3.3 Impact is measured, bounded and fast

- Preview runs the edits inside a transaction, computes impact, then **rolls back** (the pattern
  the setup workbook already uses). Nothing is ever half-applied.
- Each impact query returns a **count plus at most 20 examples**, never an unbounded list. One
  batched query per relation (`ANY($1)`), never one per item.
- Impact carries a severity: `safety` (a warning or block stops firing), `access` (someone gains
  or loses access), `money` (a price changes on open bills), `info`.
- Example for removing a drug interaction:
  "**Safety:** 14 active prescriptions on 3 wards would stop warning about warfarin + aspirin."

### 3.4 Apply, rollback, drift

- Apply: one transaction; re-check every `before`; run adapter `apply`; write one audit row per
  item plus one for the set through `AuditLogger::log` (hash-chained, append-only).
- Rollback: build the inverse items from `before`/`after`; it is itself a change set, so it is
  previewed and approved like any other. If an item drifted since, the rollback shows it and stops.

### 3.5 Proof an auditor can re-check

`proof_hash = sha256(canonical JSON of: set metadata, every item's before/after, the impact
report, approvals, base_hash)`. The proof file (JSON) contains that input, the hash, and the
`audit_log` row ids with their chain hashes. An auditor recomputes the hash and checks the audit
chain (`verify_chain_for_tenant` already exists). No trust in MedBrains needed.

### 3.6 The existing edit screens

Phase by phase, each area's existing save button becomes **Propose change**, which creates a
one-item change set. Safety areas then require approval; low-risk areas may self-apply. Direct
write routes for an area are closed only after its adapter ships, so nothing breaks in between.

## 4. Permissions (defined in Rust first)

- `knowledge.change_sets.list`: see change sets and history
- `knowledge.change_sets.create`: draft and preview
- `knowledge.change_sets.approve`: approve someone else's set
- `knowledge.change_sets.apply`: apply an approved set
- `knowledge.change_sets.rollback`: start a rollback

Adding an item for an area also requires that area's existing manage permission (for example
`pharmacy.stock.manage` for the formulary). Approval never lets someone approve their own set.

## 5. Screens (UI plan, to agree before build)

**Admin → Knowledge changes** (new page)
- **List:** title, area, status, author, approver, applied date, impact summary chips.
  Filters: area, status, date.
- **Editor:** pick area; edit rows in a table with each changed cell highlighted (old → new);
  add, edit, remove rows; reason required.
- **Impact panel:** grouped by severity with counts and up to 20 examples, each linking to the
  record. Safety items shown first.
- **Approve:** a second person sees the same diff and impact, then approves or rejects with a note.
- **History:** applied sets with **Roll back** and **Download proof**.

States: loading; empty ("No changes yet"); stale ("Live data changed since preview, preview
again"); error with retry (never shown as "no impact"); no permission (nothing fetched).
Meaning is never shown by colour alone; keyboard-operable throughout.

## 6. Phases (each ends on the screen)

1. **Engine + drug interactions + critical-value rules.** Both are text-keyed, safety-critical
   and have no history today. Full flow: draft, preview, approve, apply, rollback, proof.
2. **Formulary and lab catalogue** (FK-joined rows).
3. **Roles, permissions, per-user access** (JSONB; access impact via `resolve_permissions`).
4. **Settings, prices, departments** (key/value and FK rows).
5. **ICD releases, allergy classes moved into a table, order-set integration.**

## 7. Acceptance scenarios (phase 1)

- Given an active interaction warfarin + aspirin and 14 active prescriptions with both, when a
  pharmacist drafts its removal and previews, then the impact shows "Safety: 14 active
  prescriptions on 3 wards would stop warning" with up to 20 examples.
- Given that draft, when its author tries to approve it, then approval is refused (author cannot
  approve their own set).
- Given an approved set, when someone edits the same interaction directly before apply, then
  apply refuses and the set becomes `stale`.
- Given an applied set, when rolled back, then the interaction is active again, warnings fire
  again, and both the change and the rollback appear in the audit chain.
- Given a downloaded proof, when an auditor recomputes the hash offline, then it matches
  `proof_hash`, and the referenced audit rows verify in the chain.
- Given a user without `knowledge.change_sets.list`, when they open the page, then no request
  for change sets is made.

## 8. Not in scope

Global reference data (`cds_*`, SNOMED), cross-hospital change sets, scheduled (future-dated)
apply, and AI-suggested changes. Each can follow once phase 1 proves the engine.

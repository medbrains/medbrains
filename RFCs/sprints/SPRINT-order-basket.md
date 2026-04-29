# Sprint Plan — Order Basket (cross-module ad-hoc order batching)

**Status:** Draft (architecture)
**Date:** 2026-04-28
**Depends on:** SPRINT-A-outbox.md (outbox infra), Active Visit / Workspace primitives (other chat's sprint)
**Related:** existing `routes/order_sets.rs` (templates), `routes/pharmacy.rs::create_order`, `routes/lab.rs::create_order`, `routes/radiology.rs::create_order`, `routes/diet.rs::create_diet_order`

## Context

OpenMRS 3 has a single workspace pattern called **Order Basket** — clinician opens it once during an encounter, adds drug + lab + radiology + procedure + diet + referral orders across modules, sees drug-interaction / duplicate-test / dose-range warnings inline, signs once, and all orders commit atomically to the active visit.

Today MedBrains has each order type behind its own button: "New Prescription", "Order Lab", "Order X-ray", "Diet Order". That means:
- Clinician clicks 4-5 separate buttons per visit
- Drug-drug + drug-allergy + duplicate-test checks run **per-order** instead of across the whole basket — misses interactions between a drug and a lab being added in the same session
- No atomic guarantee — if the lab order fails, the prescription was already saved
- No "review before signing" workflow — each order is committed on submit, no take-back

Order basket fixes all four. **Important: this is NOT the same as `order_sets`.** Order sets = pre-defined templates ("post-cardiac-surgery orders"). Order basket = per-encounter ad-hoc cart. They integrate (basket can import a template as starting items) but are separate concerns.

## Scope

### In
- `<OrderBasketWorkspace />` — slide-in workspace (depends on workspace primitive from other chat)
- `orderBasketStore` Zustand slice — basket items live in client state until signed
- 6 picker tabs inside basket: Drug, Lab, Radiology, Procedure, Diet, Referral
- "Import from Order Set" — pre-fills basket from an `order_sets` template
- Inline pre-sign warnings: drug-drug interaction, drug-allergy, duplicate test (already ordered today), dose range, LASA
- Severity-based UX: **WARN** (yellow, non-blocking) vs **BLOCK** (red, requires override reason)
- Single backend endpoint `POST /api/orders/basket/sign` — atomic commit across modules, returns array of created order IDs
- Optional draft persistence — basket saved server-side keyed to active encounter so clinician can switch device
- Tests: 8 integration scenarios

### Out
- New order types beyond the 6 listed (e.g., dressing change order, referral letters in HL7 format)
- Co-signer workflow (junior fills, senior signs) — Phase 2
- Multi-encounter basket (orders spanning multiple visits) — anti-pattern, never
- Rich CDS reasoning UI ("why is this interaction severe?") — Phase 2
- Replacement of existing single-order endpoints — they stay (mobile/legacy use)

## Real-world hospital use cases

| # | Scenario | Today | After basket |
|---|----------|-------|--------------|
| OB.1 | OPD encounter — diabetic patient, 2 drugs + HbA1c + lipid panel + foot pulse procedure | 4 separate buttons, 4 round-trips, no inter-order check | One basket workspace, all 4 added, sign once, basket flags metformin–contrast interaction (lipid panel + planned CT next week) |
| OB.2 | IPD admission — cardiac unit standard orders | Manual replication of 12 items each time | Import "Cardiac admission" order set → adds 12 items → clinician adds 1 custom Rx → sign once |
| OB.3 | Cancer chemo cycle | 6 drugs across 3 days, each via separate Rx | Basket holds whole cycle, dose-banded by BSA, signed once with chemo-specific override flow |
| OB.4 | ER trauma | Imaging + 4 drugs + 3 labs in 30 seconds | Basket prefilled by trauma protocol order set, doctor reviews + signs in 2 clicks |
| OB.5 | Drug interaction during basket build | Existing flow lets you save Rx 1, then save Rx 2 — interaction check fires on 2nd save, but Rx 1 is already in pharmacy queue | Basket holds both, runs interaction check pre-sign, doctor switches one drug before any pharmacy queue write |
| OB.6 | Junior doctor draft, senior reviews | No mechanism today | Junior fills basket, saves as draft, senior opens patient → sees basket → adds/removes → signs (Phase 2 attribution) |
| OB.7 | Patient already had today's CBC | Duplicate lab ordered, lab desk catches manually | Basket warns "CBC ordered 2h ago, status: collected" — clinician removes the duplicate |
| OB.8 | NDPS Schedule X drug in basket | Same single-Rx flow but no special handling | Basket flags Schedule X — requires duplicate paper Rx + serial number capture before sign |

These map to: ambulatory chronic care (OB.1, OB.7), inpatient (OB.2), oncology (OB.3), emergency (OB.4), routine safety (OB.5, OB.7, OB.8), team workflows (OB.6).

## Architecture

### Client-side basket = Zustand store, NOT a server-side draft

Basket lives in `apps/web/src/stores/orderBasketStore.ts` (client). Reasons:
- Survives page nav within the same session
- Zero round-trips while building
- Server doesn't store half-formed clinical data
- Atomic commit happens at sign time, not incrementally

Optional **named-draft persistence** (Phase 2 within this sprint if time): a small `order_basket_drafts` table keyed by `(tenant_id, encounter_id, owner_user_id)` storing the basket items JSONB. Used only for "Save as draft" + cross-device hand-off. Sign-time still hits the atomic endpoint — drafts are not orders.

### Item shape (client + server identical)

```ts
type BasketItem =
  | { kind: 'drug',      drug_id, dose, frequency, route, duration_days, indication?, is_prn?, instructions?, taper_schedule?, srl_no_for_schedule_x? }
  | { kind: 'lab',       test_id, priority: 'routine'|'stat', indication?, container_pref? }
  | { kind: 'radiology', modality, study_id, body_part, contrast?, indication?, priority }
  | { kind: 'procedure', procedure_id, indication?, scheduled_at? }
  | { kind: 'diet',      diet_template_id, instructions?, start_at? }
  | { kind: 'referral',  to_specialty_id | to_external_provider, reason, priority };
```

### Single atomic sign endpoint

```
POST /api/orders/basket/sign
Body: {
  encounter_id: Uuid,
  items: BasketItem[],
  warnings_acknowledged: [{ code, override_reason }],
}
Response: {
  created: [{ order_type, order_id, module_specific_id, ... }],
  warnings: [{ code, severity, message }],  // non-blocking, returned for audit
}
```

Implementation: opens **one Postgres transaction**, dispatches each item to its existing handler logic (refactored to take `&mut tx` instead of opening its own), calls each module's existing `create_*` flow within the same tx, commits atomically. If any item fails → entire basket rolls back, client gets 4xx with the failing item index.

Reuses existing `pharmacy::create_order`, `lab::create_order`, `radiology::create_order`, `diet::create_diet_order`. Refactor: each gets a sibling `create_order_in_tx(&mut tx, ...)` that takes an existing transaction. The HTTP handler becomes a thin wrapper that opens its own tx and calls the in-tx variant.

### CDS pre-sign check endpoint

```
POST /api/orders/basket/check
Body: { encounter_id, patient_id, items: BasketItem[] }
Response: {
  warnings: [
    { code: 'DRUG_INTERACTION_SEVERE', severity: 'BLOCK', message, refs: [item_idx_a, item_idx_b], detail },
    { code: 'DUPLICATE_LAB_TODAY',     severity: 'WARN',  message, refs: [item_idx], existing_order_id },
    { code: 'DOSE_OUT_OF_RANGE',       severity: 'WARN',  message, refs: [item_idx], min, max, given },
    { code: 'LASA_PAIR',                severity: 'WARN',  message, refs: [item_idx_a, item_idx_b] },
    { code: 'SCHEDULE_X_REQUIRES_PAPER', severity: 'BLOCK', message, refs: [item_idx] },
    { code: 'RENAL_DOSE_ADJUST_NEEDED', severity: 'WARN',  message, refs: [item_idx] },
  ]
}
```

Called every time the basket changes. Debounced 500ms client-side. Reuses existing CDS engine in `crates/medbrains-server/src/routes/cds.rs` (or similar — confirm path).

**Severity rules:**
- `WARN` — yellow inline banner per affected row. User can sign without action, audit logs the warning.
- `BLOCK` — red inline. User must enter `override_reason` before sign button enables. Reason logged with the order.

## Schema additions

Migration `131_order_basket.sql` (or next free number):

```sql
-- Optional: named drafts for cross-device hand-off
CREATE TABLE order_basket_drafts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  encounter_id    uuid NOT NULL,
  owner_user_id   uuid NOT NULL REFERENCES users(id),
  items           jsonb NOT NULL,              -- BasketItem[]
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, encounter_id, owner_user_id)
);

-- Audit: every basket sign captures the whole batch + warnings
CREATE TABLE order_basket_signatures (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenants(id),
  encounter_id             uuid NOT NULL,
  signed_by                uuid NOT NULL REFERENCES users(id),
  signed_at                timestamptz NOT NULL DEFAULT now(),
  items_count              int  NOT NULL,
  items_snapshot           jsonb NOT NULL,            -- frozen copy of basket at sign time
  warnings_returned        jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings_acknowledged    jsonb NOT NULL DEFAULT '[]'::jsonb,
  override_reasons         jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_order_ids        jsonb NOT NULL,             -- [{order_type, order_id}]
  client_session_id        text,                       -- helps correlate with offline mobile
  device_id                text
);

-- RLS
ALTER TABLE order_basket_drafts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_basket_drafts     FORCE  ROW LEVEL SECURITY;
CREATE POLICY order_basket_drafts_tenant ON order_basket_drafts
  USING (tenant_id::text = current_setting('app.tenant_id', true));

ALTER TABLE order_basket_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_basket_signatures FORCE  ROW LEVEL SECURITY;
CREATE POLICY order_basket_signatures_tenant ON order_basket_signatures
  USING (tenant_id::text = current_setting('app.tenant_id', true));

CREATE INDEX order_basket_drafts_encounter_idx
  ON order_basket_drafts (tenant_id, encounter_id);
CREATE INDEX order_basket_signatures_encounter_idx
  ON order_basket_signatures (tenant_id, encounter_id, signed_at DESC);

-- Triggers
CREATE TRIGGER order_basket_drafts_updated
  BEFORE UPDATE ON order_basket_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

`order_basket_signatures` is the audit anchor — NABH/JCI auditors can see every batch sign with timestamps, warnings shown, overrides, and resulting orders. Nothing else changes — pharmacy/lab/radiology/diet tables keep their own audit trails.

## Backend changes

### Refactor existing single-order handlers

Each of these gets a `_in_tx` sibling that takes `&mut Transaction<'_, Postgres>`:

| Existing | New sibling |
|----------|-------------|
| `routes/pharmacy.rs::create_order` (multi-item, already takes vec) | `pharmacy::create_order_in_tx` |
| `routes/lab.rs::create_order` | `lab::create_order_in_tx` |
| `routes/radiology.rs::create_order` | `radiology::create_order_in_tx` |
| `routes/diet.rs::create_diet_order` | `diet::create_diet_order_in_tx` |
| (procedures, referrals — confirm if dedicated routes exist; if not, add per-item logic in basket handler) | — |

The HTTP handler becomes:
```rust
pub async fn create_order(state, claims, body) -> Result<Json<...>, AppError> {
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;
    let result = create_order_in_tx(&mut tx, &claims, body).await?;
    tx.commit().await?;
    Ok(Json(result))
}
```

This is a small, mechanical refactor — touches ~6 files, no behavior change.

### New crate module — `routes/order_basket.rs`

```rust
pub async fn check_basket(state, claims, body) -> Result<Json<CheckResponse>, AppError> { ... }
pub async fn sign_basket(state, claims, body) -> Result<Json<SignResponse>, AppError> {
    let mut tx = state.db.begin().await?;
    set_tenant_context(&mut tx, &claims.tenant_id).await?;
    // run CDS one final time inside tx (defense in depth)
    let warnings = cds::check_basket_in_tx(&mut tx, ...).await?;
    if has_blocking_warnings(&warnings, &body.warnings_acknowledged) {
        return Err(AppError::Validation(...));
    }
    let mut created = vec![];
    for (idx, item) in body.items.iter().enumerate() {
        let id = match item.kind {
            Drug      => pharmacy::create_order_in_tx(&mut tx, ...).await?,
            Lab       => lab::create_order_in_tx(&mut tx, ...).await?,
            Radiology => radiology::create_order_in_tx(&mut tx, ...).await?,
            Diet      => diet::create_diet_order_in_tx(&mut tx, ...).await?,
            Procedure => /* existing procedure flow, in-tx */,
            Referral  => /* existing referral flow, in-tx */,
        }.map_err(|e| AppError::BasketItemFailed { index: idx, source: Box::new(e) })?;
        created.push(...);
    }
    sqlx::query!("INSERT INTO order_basket_signatures (...) VALUES (...)", ...).execute(&mut *tx).await?;
    tx.commit().await?;
    // Optionally: outbox-queue any side-effect events (SMS to patient, fax to ext lab, HL7 outbound)
    Ok(Json(SignResponse { created, warnings }))
}
pub async fn save_draft(state, claims, body) -> ...   // upsert order_basket_drafts
pub async fn get_draft(state, claims, encounter_id) -> ...
pub async fn delete_draft(state, claims, draft_id) -> ...
```

### Outbox integration (depends on Sprint A)

After successful sign, queue side-effects via the new outbox:
- `sms.prescription_to_patient` (Rx summary SMS)
- `fax.lab_requisition_external` (if outsourced lab)
- `hl7.lab_order_outbound` (when HL7 outbound lands Phase 2)
- `pharmacy_dispense_queue.notify` (in-app notification to pharmacy)

These are side-effects, not orders — they queue post-commit, never block the sign.

## Frontend changes

### Zustand store

```ts
// apps/web/src/stores/orderBasketStore.ts
interface OrderBasketState {
  encounterId: string | null;
  items: BasketItem[];
  warnings: Warning[];
  warningsAcknowledged: { code: string; override_reason: string }[];
  isChecking: boolean;
  isSigning: boolean;
  // actions
  setEncounter: (id: string) => void;
  addItem: (item: BasketItem) => void;
  updateItem: (idx: number, item: BasketItem) => void;
  removeItem: (idx: number) => void;
  importOrderSet: (templateId: string) => Promise<void>;
  acknowledgeWarning: (code: string, reason: string) => void;
  runCheck: () => Promise<void>;     // debounced
  sign: () => Promise<SignResponse>;
  clear: () => void;
  saveDraft: () => Promise<void>;
  loadDraft: (encounterId: string) => Promise<void>;
}
```

### Workspace component

```tsx
// apps/web/src/components/Patient/OrderBasketWorkspace.tsx
export function OrderBasketWorkspace() {
  const basket = useOrderBasketStore();
  const activeVisit = useActiveVisitStore();  // from other chat's sprint

  return (
    <Workspace title={`Order Basket (${basket.items.length})`} ...>
      <Tabs defaultValue="drug">
        <Tabs.List>
          <Tabs.Tab value="drug">Drug</Tabs.Tab>
          <Tabs.Tab value="lab">Lab</Tabs.Tab>
          <Tabs.Tab value="radiology">Radiology</Tabs.Tab>
          <Tabs.Tab value="procedure">Procedure</Tabs.Tab>
          <Tabs.Tab value="diet">Diet</Tabs.Tab>
          <Tabs.Tab value="referral">Referral</Tabs.Tab>
          <Tabs.Tab value="from-set">From Order Set</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="drug"><DrugPickerForm onAdd={basket.addItem} /></Tabs.Panel>
        <Tabs.Panel value="lab"><LabPickerForm onAdd={basket.addItem} /></Tabs.Panel>
        {/* ...etc... */}
      </Tabs>

      <Divider my="md" />

      <BasketItemList
        items={basket.items}
        warnings={basket.warnings}
        onUpdate={basket.updateItem}
        onRemove={basket.removeItem}
      />

      <WarningsPanel
        warnings={basket.warnings}
        acknowledged={basket.warningsAcknowledged}
        onAcknowledge={basket.acknowledgeWarning}
      />

      <Group justify="flex-end" mt="md">
        <Button variant="subtle" onClick={basket.saveDraft}>Save draft</Button>
        <Button variant="default" onClick={basket.clear}>Clear</Button>
        <Button
          color="primary"
          loading={basket.isSigning}
          disabled={basket.items.length === 0 || hasUnacknowledgedBlocks(basket.warnings, basket.warningsAcknowledged)}
          onClick={() => basket.sign().then(showSignSuccess)}
        >
          Sign all ({basket.items.length})
        </Button>
      </Group>
    </Workspace>
  );
}
```

### Basket chip (entry point)

`<OrderBasketChip />` mounted in `<ActiveVisitBar />` (depends on other chat's sprint). Shows item count badge, opens the workspace on click. Only renders when active visit is open.

### Item list row

```tsx
<BasketItemRow item={item} warnings={warningsForItem(idx, warnings)}>
  {item.kind === 'drug'      && <DrugRow drug={item} onEdit={...} />}
  {item.kind === 'lab'       && <LabRow ... />}
  {item.kind === 'radiology' && <RadiologyRow ... />}
  {/* ... */}
  <RowActions onEdit={...} onRemove={...} />
  {warnings.map(w => <InlineWarning warning={w} />)}
</BasketItemRow>
```

Yellow tint for `WARN`, red border + "override required" badge for `BLOCK`.

### Drug picker integration

Drug picker `DrugPickerForm` reuses existing `<DrugSearchSelect>` (already in components). Adds dose/frequency/route/duration/indication fields. Pre-fills indication from active diagnosis if there's one ICD-10 attached to the visit.

### Frontend acceptance criteria touchpoints

- `basket.runCheck` debounced 500ms after any item change
- `basket.sign` is the **only** path to commit — no individual order saves while basket is open (other order buttons hidden when basket has 1+ items)
- Basket survives page nav within same session (Zustand persist plugin to sessionStorage, NOT localStorage)
- On encounter close, basket auto-clears
- "Save draft" hits `/api/order-basket/drafts` upsert
- On reopen workspace, fetches draft for `(encounter_id, current_user)` and pre-loads

## CDS rule coverage

The `/api/orders/basket/check` endpoint composes existing checks. None of these are new:

| Code | Severity | Source |
|------|----------|--------|
| `DRUG_INTERACTION_SEVERE` | BLOCK | existing CDS engine, drug-drug check |
| `DRUG_INTERACTION_MODERATE` | WARN | existing CDS engine |
| `DRUG_ALLERGY` | BLOCK | existing patient_allergies cross-check |
| `DUPLICATE_LAB_TODAY` | WARN | new SQL query: `SELECT 1 FROM lab_orders WHERE patient_id=$1 AND test_id=$2 AND ordered_at::date = current_date` |
| `DOSE_OUT_OF_RANGE` | WARN | existing pharmacy_safety dose validator |
| `LASA_PAIR` | WARN | existing pharmacy LASA flag check, applied across basket |
| `SCHEDULE_X_REQUIRES_PAPER` | BLOCK | existing pharmacy schedule check |
| `RENAL_DOSE_ADJUST_NEEDED` | WARN | existing renal-dose calculator |
| `PREGNANCY_CATEGORY_X` | BLOCK | existing pregnancy CDS rule |

What's new in this sprint: the **composer** that runs all of them across the basket (not just per-item) and returns a unified warnings list with item-index references.

## Tests — by use case

| Use case | Test name | Setup | Assertion |
|----------|-----------|-------|-----------|
| OB.1 happy path | `basket_sign_creates_orders_atomically` | 4 items: drug, lab, lab, radiology | All 4 created in one tx, `order_basket_signatures` row written |
| OB.5 interaction block | `basket_blocks_severe_interaction_until_overridden` | Warfarin + new NSAID | `runCheck` returns `DRUG_INTERACTION_SEVERE` BLOCK; sign fails; after `acknowledgeWarning('DRUG_INTERACTION_SEVERE', 'monitoring INR daily')`, sign succeeds |
| OB.7 duplicate lab | `basket_warns_duplicate_lab_today` | CBC ordered 2h ago, basket adds CBC | `DUPLICATE_LAB_TODAY` WARN; sign succeeds (non-blocking); audit captures warning |
| Atomic rollback | `basket_one_failed_item_rolls_back_all` | 3 items, mock pharmacy::create_order_in_tx to fail on item 2 | No orders created; tx rolled back; client gets 4xx with `BasketItemFailed { index: 2 }` |
| OB.2 from set | `basket_imports_order_set_template` | Cardiac admission template with 12 items | After `importOrderSet`, basket has 12 items with template defaults |
| OB.8 schedule X | `basket_blocks_schedule_x_without_paper_serial` | Morphine in basket | BLOCK until `srl_no_for_schedule_x` filled; pharmacy_orders row carries the serial |
| Draft save/load | `basket_draft_round_trips` | Save draft → reload page → load draft for encounter | Items match; warnings re-run on load |
| Session isolation | `basket_clears_on_encounter_close` | Open basket, end visit | Basket clears; draft (if saved) remains in DB |

Tests live in `crates/medbrains-server/tests/integration/order_basket/`.

## Acceptance criteria

1. **Atomic commit**: 4-item basket signs as one Postgres tx; if any item fails, no orders persist; client sees `BasketItemFailed` with the index.
2. **Cross-basket CDS**: drug-drug interaction between item 1 and item 3 is detected (per-order flow today wouldn't catch this).
3. **Block + override**: severe interaction blocks sign; entering override reason unblocks; reason persisted in `order_basket_signatures.override_reasons`.
4. **Duplicate-test detection**: lab ordered earlier today triggers WARN with reference to existing order.
5. **Schedule X**: morphine requires paper serial number before sign enables.
6. **Order set import**: importing a 12-item template populates basket with defaults; user can edit each item before sign.
7. **Draft persistence**: save draft → close browser → reopen → draft loads for active encounter + current user.
8. **Audit row**: every successful sign writes `order_basket_signatures` with full snapshot, warnings, overrides, created order IDs.
9. **No regression**: existing single-order endpoints (`POST /api/pharmacy/orders`, `POST /api/lab/orders`, etc.) continue to work for mobile + legacy clients.
10. **Outbox side-effects**: post-sign SMS to patient + pharmacy notification queued via outbox, not blocking the response.
11. CI gates: `cargo clippy --all-targets -- -D warnings`, `pnpm typecheck`, `pnpm build`, `make check-api`, all 8 tests green.

## Effort estimate

| Task | Hours |
|------|-------|
| Migration `131_order_basket.sql` + tests | 4 |
| Refactor existing 4 handlers to expose `_in_tx` siblings | 6 |
| `routes/order_basket.rs` — check + sign + draft CRUD | 12 |
| CDS composer (`cds::check_basket_in_tx`) | 8 |
| `orderBasketStore` Zustand slice + sessionStorage persist | 6 |
| `<OrderBasketWorkspace>` + 6 picker tabs (drug, lab, rad, procedure, diet, referral) | 16 |
| `<BasketItemRow>` + warnings panel + override-reason flow | 8 |
| `<OrderBasketChip />` mounted in active visit bar | 2 |
| "Import from Order Set" integration with existing `order_sets` flow | 4 |
| Outbox side-effects (post-sign SMS, pharmacy notify) | 4 |
| Tests (integration suite, 8 scenarios) | 12 |
| Wire-up: hide single-order buttons when basket has items, banner copy, i18n strings | 4 |
| **Total** | **~86h ≈ 2 dev-weeks** |

## Risks + mitigations

| Risk | Mitigation |
|------|-----------|
| `_in_tx` refactor breaks single-order endpoints | Each refactored handler keeps the original signature as a thin wrapper; integration tests for both paths |
| Atomic tx holds locks too long for 20-item baskets | LIMIT items to 30 per basket; refuse larger; all order creates are short queries |
| CDS composer becomes a god-function | Compose from existing per-rule checks; one rule per file under `crates/medbrains-server/src/cds/rules/` |
| Client basket diverges from server snapshot at sign time | Server runs `check_basket_in_tx` again inside the sign tx; if BLOCK warnings appear that weren't acknowledged, fail the sign |
| Draft + active basket conflict (user has both) | On workspace open, if draft exists AND in-memory basket has items → modal "You have a saved draft, load it (replaces current) or keep current (discards draft)?" |
| Schedule X paper serial requirement varies by state | Configurable per tenant via existing pharmacy settings; default = required |
| Order set import bypasses CDS | Items go through `runCheck` after import like any other addition |

## Dependencies + sequencing

This sprint is gated by **two** prior sprints:

1. **Sprint A — outbox** (durable side-effects) — without it, post-sign SMS / pharmacy notification can fail silently
2. **Workspace primitive + Active Visit + Patient Banner** (other chat's sprint) — without it, the basket has no host

Order: Sprint A → Workspace/ActiveVisit (other chat) → **this sprint**.

## Critical files

### New
- `medbrains/crates/medbrains-db/src/migrations/131_order_basket.sql`
- `medbrains/crates/medbrains-server/src/routes/order_basket.rs`
- `medbrains/crates/medbrains-server/src/cds/basket_check.rs`
- `medbrains/apps/web/src/stores/orderBasketStore.ts`
- `medbrains/apps/web/src/components/Patient/OrderBasketWorkspace.tsx`
- `medbrains/apps/web/src/components/Patient/OrderBasketChip.tsx`
- `medbrains/apps/web/src/components/Patient/BasketItemRow.tsx`
- `medbrains/apps/web/src/components/Patient/WarningsPanel.tsx`
- `medbrains/apps/web/src/components/Patient/pickers/{Drug,Lab,Radiology,Procedure,Diet,Referral}PickerForm.tsx`
- `medbrains/crates/medbrains-server/tests/integration/order_basket/`

### Modified
- `medbrains/crates/medbrains-server/src/routes/pharmacy.rs` (add `create_order_in_tx`)
- `medbrains/crates/medbrains-server/src/routes/lab.rs` (add `create_order_in_tx`)
- `medbrains/crates/medbrains-server/src/routes/radiology.rs` (add `create_order_in_tx`)
- `medbrains/crates/medbrains-server/src/routes/diet.rs` (add `create_diet_order_in_tx`)
- `medbrains/crates/medbrains-server/src/routes/mod.rs` (register new routes)
- `medbrains/packages/api/src/client.ts` (add `checkBasket`, `signBasket`, `saveBasketDraft`, `getBasketDraft`)
- `medbrains/packages/types/src/index.ts` (BasketItem types)
- `medbrains/crates/medbrains-core/src/permissions.rs` (add `clinical.order_basket.{sign, draft}`)
- `medbrains/packages/types/src/permissions.ts` (mirror)

### Reused (no rebuild)
- `DrugSearchSelect`, `LabTestSearchSelect`, `DepartmentSelect` — existing components
- `order_sets.rs` template flow — basket calls `OrderSetActivation` to expand a template
- CDS engine rules — composed across basket rather than per-order
- Outbox (post Sprint A) for side-effects
- `useActiveVisit`, `useWorkspace` hooks (post other chat's sprint)
- `set_tenant_context`, `update_updated_at()`, `AppError`, `Claims`

## Verification — end-to-end

1. Start a visit on a real patient
2. Open Order Basket workspace
3. Add 2 drugs (warfarin + naproxen) → see `DRUG_INTERACTION_SEVERE` BLOCK
4. Add CBC + LFT
5. Try to sign → fails with override required
6. Enter override reason on warfarin/naproxen interaction
7. Sign → all 4 orders created, single `order_basket_signatures` row written
8. Verify pharmacy queue shows both Rx, lab queue shows CBC + LFT
9. Verify post-sign SMS queued in `outbox_events`
10. Save a basket as draft, switch device (re-login on another browser), reopen patient → draft loads
11. End the visit → basket clears (draft remains in DB but no longer auto-loads since visit closed)
12. Run integration tests: `cargo test -p medbrains-server --test integration order_basket`

## Branch + PR plan

- Branch: `feature/order-basket` (off `master`, after Sprint A merged AND workspace/active-visit sprint merged)
- Single PR, ~86h work
- PR title: *Order basket — atomic cross-module order signing*
- PR body cites: this plan, OpenMRS 3 reference (`https://o3.openmrs.org/openmrs/spa/patient/.../chart/Medications`), and acceptance criteria
- Reviewer focus: (a) atomic tx correctness, (b) CDS rule composition, (c) `_in_tx` refactor backwards compat, (d) draft + warning re-check at sign time

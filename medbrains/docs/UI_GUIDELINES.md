<div align="center">

# MedBrains UI Guidelines

### Signature Spectrum design system

`#3A2E8C` → `#5B4BC4` → `#C85B7E` → `#E8895A`

*Calm dense console · standard primitives · one reserved hero moment*

</div>

---

These rules **supersede** the "Forest + Copper" and "Experian" sections in
`CLAUDE.md`. When a rule conflicts with a Mantine default, the rule wins. When
unsure, copy a screen that already follows these (OPD encounter, pharmacy order,
cashier counter).

**Three layers — always know which one you're in:**

| Layer | What | Mood |
|-------|------|------|
| **Console** | lists, forms, tables, settings — 95% of screens | calm, dense, neutral |
| **`ui/` primitives** | the standard components everything is built from | consistent |
| **Signature** | the full gradient — hero moments only | high energy, rare |

---

## 1 · Color

### Palette — the only brand colors

| Role | Token | Hex | Use |
|------|-------|-----|-----|
| Primary | `blue[5]` / `primary` | `#5B4BC4` | primary buttons, active state, focus, key icons |
| Primary deep | `blue[7]` | `#3A2E8C` | gradient anchor, pressed |
| Link | `blue[6]` | `#463AA8` | text links — **AAA** on white |
| Accent | `cinnabar[5]` | `#C85B7E` | reserved highlight — changed value, one hero KPI |
| Accent text | — | `#A33E4F` | accent as readable text — **AA** on white |
| Text | `--mb-fg` | `#1A1A2E` | body + headings (never `#000`) |
| Muted text | `--mb-fg-muted` | `#5F6B7A` | supporting copy |
| Border | `--mb-border` | `#D5DBDB` | hairlines, always 1px |
| Canvas | — | `#FFFFFF` | page background |
| Panel | `--mb-bg-subtle` | `#F4F5F8` | subtle surfaces, rails, zebra |

**Status** — only these, only for status: `--mb-success-*`, `--mb-warning-*`,
`--mb-danger-*`, `--mb-info-*`. Clinical dots use `--ss-stable/caution/critical/info`.

### Rules

- **Token, never raw hex** in component code (`--mb-*`, `--ss-*`,
  `var(--mantine-color-*)`). Legacy `--fc-*` aliases resolve but add no new uses.
- **Color is information, not decoration.** Neutral is the default state.
- **No module rainbow** — modules don't each get a hue. Chrome stays neutral; the
  active item is the single indigo accent.
- **Accent is rare** — a changed value, an unread count, one hero KPI. Never an
  ordinary button fill.

### The gradient

`--mb-accent-gradient` = `--ss-gradient` = the 4-stop spectrum.

| ✅ Allowed | ❌ Never |
|-----------|---------|
| primary filled buttons (indigo segment only) | flat fills behind body text |
| thin accent bars (page header top, login) | card / table-row backgrounds |
| `SignatureHero` surfaces | every button |
| ECG loader & top progress | white text over the coral half |

White text on the gradient **only** over the blue/purple half.

---

## 2 · Typography

- **All sans** — Inter Tight. No serif (Fraunces retired from chrome).
- **JetBrains Mono** for metadata only: UHIDs, timestamps, codes, money in dense
  tables, eyebrow labels.
- Scale: `h1` 24/700 · `h2` 20/600 · `h3` 18/600 · body 14 · caption 12 · eyebrow 11.
- Eyebrow: 11px mono, uppercase, `c="dimmed"`, `fw={700}`.
- Line length ≤ 75ch for prose. Numbers in tables right-aligned, mono, tabular.

---

## 3 · Components — build from `@/components/ui`

Import our primitives, **not** raw `@mantine/core`, for these:

| Need | Use | Notes |
|------|-----|-------|
| Button | `ui/Button` | `tone="primary\|secondary\|ghost\|danger\|subtle-danger"` — never raw `variant`+`color` |
| Icon button | `ui/IconButton` | `tone="default\|primary\|danger\|success"`; `aria-label` **required** |
| Status chip | `ui/Badge` | `tone="neutral\|primary\|success\|warning\|danger\|info\|accent"` |
| Inline notice | `ui/Alert` | `tone="info\|success\|warning\|danger\|neutral"`; tone accent bar + console style |
| Toast | `ui/toast` | `toast.success/error/warning/info(msg, {title?})` — not raw `notifications.show` |
| Surface | `ui/Card` | border-first, no resting shadow |
| Text input | `ui/Input` `NumberField` `PasswordField` `TextArea` | |
| Select | `ui/Select` | |
| Toggle | `ui/Switch` | sm by default |
| Checkbox | `ui/Checkbox` | sm by default |
| Inline view switch | `ui/SegmentedControl` | 2–4 options; Tabs for page sections |
| Icon tile | `ui/ThemeIcon` | `tone="neutral\|primary\|success\|warning\|danger\|info"`; decorative only |
| Divider | `ui/Divider` | always the hairline rule colour |
| Data grid | `DataTable` | columns + loading/empty — the default for lists |
| Ad-hoc table | `ui/Table` | bespoke layouts; compound `Table.Thead/Tr/Th`, hover rows, no column borders |
| Tooltip | `ui/Tooltip` | a hint, never the only place info lives |
| Modal | `ui/Modal` | short self-contained tasks; centered, dimmed |
| Drawer | `ui/Drawer` | work *alongside* content (order basket); right by default |
| Titled section | `ui/Panel` | eyebrow title + content |
| Hero header | `ui/SignatureHero` | flagship clinical writers ONLY |

Reuse, don't re-invent: `PageHeader`, `DataTable`, `FormModal`,
`PaymentCollectPanel`, `PatientContextBanner`, `OperationalSignal`.

**Buttons** — one **primary** per view (the main action); everything else
`secondary` (bordered) or `ghost` (text); destructive = `danger`/`subtle-danger`.
Don't stack many filled buttons — a column of `secondary` reads as a clean menu.

**Badges** — clean squared pill, **no leading dot, no forced mono-uppercase**,
semantic tone only. Pair clinical dots with a text label.

**Cards** — `withBorder`, `sm` radius, **no resting shadow**. Hover = subtle
border/bg shift, not a lift or glow. Clickable cards use `.clickable-card`.

---

## 4 · Layout & density

- **Squared** corners (`sm`), **1px hairlines**, flat — no glows/drop-shadows on
  ordinary chrome.
- **One nav hierarchy on screen.** A detail view with its own side pane → the
  global sidebar **auto-collapses to the 56px icon rail**. Never two 240px rails.
- **Side pane = navigation only.** Actions → content-top toolbar. Context → header.
- **No accordions for primary nav** — grouped sections expanded, every item one
  click, active item always visible.
- **Don't waste the top** — no duplicate headers (title + banner both showing the
  patient). One identity source per screen.
- **Tables** — `highlightOnHover`, no column borders, mono numeric cells, dense rows.
- **Surfaces by task**:

  | Pattern | When |
  |---------|------|
  | Right **drawer** | work done *alongside* content (order basket) |
  | **Modal** | short, self-contained task |
  | **Bottom sheet** | mobile app only — never web console |

---

## 5 · Interaction & motion

- **Motion is feedback, not flourish.** Animate to explain a state change; never
  loop decoration (except ECG/top-progress, which signal liveness).
- Transitions ≤ 200ms, ease-out. Respect `prefers-reduced-motion` — kill non-essential motion.
- **Every action has a state**: hover, active/pressed, focus-visible, disabled,
  loading. Don't ship a button with only the resting state.
- **Optimistic where safe, confirmed where not.** Destructive/irreversible →
  confirm with a modal that names the consequence.
- Hover effects must have a non-hover equivalent (touch/keyboard can't hover).

---

## 6 · States

| State | Rule |
|-------|------|
| Loading | ECG loader is the default Mantine `Loader`. Page = `PageSkeleton`. Route change = top progress bar. Skeletons over spinners for known layouts. |
| Empty | short dimmed line / `EmptyState` — say what's missing **and** the next action. Never a blank panel. |
| Error | typed, user-friendly message; never a raw stack trace; offer a retry. |
| Partial / stale | show what you have, mark what's loading; don't blank the screen on refetch. |
| Disabled | disable with a reason (tooltip / helper text), not silently. |

---

## 7 · Accessibility (non-negotiable — clinical software)

- **Contrast**: body & UI ≥ AA (4.5:1). Links use `#463AA8` (AAA). Accent-as-text
  uses `#A33E4F` (AA) — the raw `#C85B7E` is for fills/dots, not text.
- **Never color alone** to carry meaning — pair with icon, label, or text-decoration
  (discontinued = strike *and* red, not red alone).
- **Focus is always visible** — keep the indigo focus ring; never `outline: none`
  without a replacement.
- **Keyboard-complete** — every action reachable and operable by keyboard; logical
  tab order; `Esc` closes overlays; focus trapped in modals, restored on close.
- **Labels** — every input has a real label (not placeholder-only). Icon-only
  buttons get `aria-label`.
- **Targets** ≥ 36px. **Live regions** for async results (toasts, validation).
- **Don't disable zoom**; layouts survive 200% text.

---

## 8 · Forms

- **Label above field.** Mark **optional**, not required (clinical forms are
  mostly required). Group related fields with `ui/Panel`.
- **Validate on blur / submit**, not per keystroke. Error text below the field,
  danger tone, names the fix.
- **One primary submit.** Disable while submitting, show `loading`, block double-submit.
- RHF + Zod; dotted field names flatten via `flatZodResolver`; `Controller` for
  custom inputs (plain `register()` breaks `fill()` in Playwright).
- Preserve user input on error — never clear a form on a failed submit.

---

## 9 · Content & microcopy

- **Sentence case** everywhere (buttons, headers, labels) — not Title Case, not ALL CAPS (eyebrows excepted).
- Buttons are **verbs** — "Issue invoice", "Add medicine", not "Submit"/"OK".
- Plain clinical language; expand abbreviations on first use; units explicit.
- Errors say what happened + what to do. No "Oops" / blame / stack traces.
- Numbers: ₹ with `en-IN` grouping; dates per locale store; metric stored, localized on display.

---

## 10 · Signature surfaces — reserve the energy

`SignatureHero` (full-spectrum gradient header) is **only** for flagship clinical
*writers* — where a clinician composes something:

> Prescription writer · Vitals recorder · Pharmacy medicine-order form

Everywhere else → flat `PageHeader` (it already carries a thin gradient accent
bar). The hero loses meaning if it's on every page.

---

## 11 · Clinical patterns (made-for-us)

- **Safety info persists** — allergies, MLC, deceased, outstanding balance live in
  `PatientContextBanner`, visible while working. Never bury in a scrolling tab.
- **Semantic strike-through** carries meaning: `.ssDiscontinued` (struck, critical
  red) = stopped drug; `.ssAmended` (struck, caution amber) = changed. Use
  `prescriptionStatusClass(item.item_status)`.
- **Regulatory badges stay** (Schedule H, controlled, LASA, GST type) — information,
  exempt from "reduce color".
- **Emergency code colors are fixed** (blue/red/pink/black/yellow/orange) — never
  themed, identical on every deployment.

---

## 12 · Permissions & guards (still mandatory)

- Every page: `useRequirePermission(P.MODULE.LIST/VIEW)` at the top.
- Gate actions with `useHasPermission`; gate a permission-locked query's `enabled`
  on that permission too.

---

<div align="center">

### Quick "don't" list

</div>

> ❌ serif headings  ·  ❌ raw hex in components  ·  ❌ module-rainbow buttons/pills
> ❌ gradient behind body text  ·  ❌ two full left rails  ·  ❌ accordions for nav
> ❌ leading dot / mono-uppercase badges  ·  ❌ `SignatureHero` on ordinary pages
> ❌ modal for the order basket  ·  ❌ bottom sheets on web  ·  ❌ resting card shadows
> ❌ color as the only signal  ·  ❌ `outline: none` without a focus replacement
> ❌ placeholder as label  ·  ❌ Title Case / "Submit" buttons

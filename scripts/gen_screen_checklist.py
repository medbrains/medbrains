#!/usr/bin/env python3
"""
Generate per-screen field-by-field walkthrough checklists.

For each page under apps/web/src/pages/**/*.tsx, this emits a Markdown
file at medbrains/docs/audit/screens/<rel-path>.md containing one
checkbox per interactive element (form field, table column header,
modal, button, filter). A human walks the screen, ticks each item
that works, files the rest in docs/audit/issues.md.

The generator is deliberately AST-light — it greps with line context
and outputs URLs back to the source, so the tester can click straight
to the offending JSX.

Usage:
    python3 scripts/gen_screen_checklist.py
    python3 scripts/gen_screen_checklist.py --pages opd.tsx ipd.tsx
    python3 scripts/gen_screen_checklist.py --top 20  # only top-20 dense pages

Outputs:
    medbrains/docs/audit/screens/<page>.md   one per page
    medbrains/docs/audit/screens/_index.md   roll-up
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MEDBRAINS = REPO_ROOT / "medbrains"
PAGES_DIR = MEDBRAINS / "apps" / "web" / "src" / "pages"
OUT_DIR = MEDBRAINS / "docs" / "audit" / "screens"
AUDIT_JSON = MEDBRAINS / "docs" / "audit" / "screen-backend.json"

# ── Pattern catalog — interactive elements we want a tester to verify ──

# Each pattern matches once per occurrence; line-anchored to keep
# false positives manageable.
RE_USEFORM = re.compile(r"useForm\s*<")
RE_INPUT = re.compile(
    r"<\s*(TextInput|NumberInput|PasswordInput|Textarea|Select|MultiSelect"
    r"|DateInput|DateTimePicker|TimeInput|Checkbox|Switch|Radio|RadioGroup"
    r"|FileInput|ColorInput|JsonInput|Slider|Rating|PinInput|ChipGroup"
    r"|Autocomplete|TagsInput)\b"
)
RE_INPUT_LABEL = re.compile(
    r'<\s*(?:TextInput|NumberInput|PasswordInput|Textarea|Select|MultiSelect'
    r'|DateInput|DateTimePicker|TimeInput|Checkbox|Switch|Radio|RadioGroup'
    r'|FileInput|ColorInput|JsonInput|Autocomplete|TagsInput)\b[^>]*?'
    r'\blabel\s*=\s*(?:"([^"]+)"|\{`([^`]+)`\}|\{[^}]*?\bt\("[^"]*",\s*"([^"]+)"\))'
)
RE_BUTTON = re.compile(r"<\s*Button\b")
RE_BUTTON_LABEL = re.compile(
    r'<\s*Button\b[^>]*>\s*([^<{]{2,60}?)\s*</', re.DOTALL
)
RE_ACTION_ICON = re.compile(r"<\s*ActionIcon\b")
RE_ACTION_ICON_LABEL = re.compile(
    r'<\s*ActionIcon\b[^>]*?(?:aria-label|title)\s*=\s*(?:"([^"]+)"|\{`([^`]+)`\})'
)
RE_MENU_ITEM = re.compile(r"<\s*Menu\.Item\b")
RE_MENU_ITEM_LABEL = re.compile(
    r'<\s*Menu\.Item\b[^>]*>\s*([^<{]{1,80}?)\s*</', re.DOTALL
)
RE_TABLE = re.compile(r"<\s*(?:Table|DataTable)(?=[\s>])")
RE_TH = re.compile(r"<\s*Table\.Th\b[^>]*>\s*([^<{]{1,40}?)\s*</")
RE_DATATABLE_COL = re.compile(r'\{\s*key\s*:\s*"([^"]+)"\s*,\s*label\s*:\s*"([^"]+)"')
RE_TABS_TAB = re.compile(
    r'<\s*Tabs\.Tab\b[^>]*\bvalue\s*=\s*"([^"]+)"[^>]*>\s*([^<{]{1,60}?)\s*</'
)
RE_MODAL = re.compile(r"<\s*Modal\b")
RE_MODAL_TITLE = re.compile(r'<\s*Modal\b[^>]*\btitle\s*=\s*"([^"]+)"')
RE_DRAWER = re.compile(r"<\s*Drawer\b")
RE_DRAWER_TITLE = re.compile(r'<\s*Drawer\b[^>]*\btitle\s*=\s*"([^"]+)"')
RE_USEQUERY = re.compile(r'useQuery[^(]*\(\s*\{[^}]*?queryKey\s*:\s*\[\s*"([^"]+)"')
RE_USEMUTATION = re.compile(r"useMutation\s*\(")
RE_API_CALL = re.compile(r"api\.(\w+)")
RE_GUARD = re.compile(r"useRequirePermission\(\s*([^)\s,]+)")
RE_TODO = re.compile(r"//\s*(TODO|FIXME|XXX|HACK)\b", re.IGNORECASE)
RE_PLACEHOLDER = re.compile(r'\bplaceholder\s*=\s*"([^"]*)"')
RE_DISABLED_HARD = re.compile(r"\bdisabled\s*=\s*\{?\s*true\s*\}?\b")
RE_NO_OP = re.compile(r"onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}")


@dataclass
class PageReport:
    rel_path: str
    abs_path: Path
    lines: int
    guard: str | None
    api_methods: list[str] = field(default_factory=list)
    use_form_count: int = 0
    use_query_keys: list[str] = field(default_factory=list)
    use_mutation_count: int = 0
    inputs: list[tuple[int, str, str]] = field(default_factory=list)  # (line, kind, label)
    buttons: list[tuple[int, str]] = field(default_factory=list)  # (line, label)
    action_icons: list[tuple[int, str]] = field(default_factory=list)  # (line, label)
    menu_items: list[tuple[int, str]] = field(default_factory=list)  # (line, label)
    tables: list[tuple[int, list[str]]] = field(default_factory=list)  # (line, headers)
    datatable_cols: list[tuple[str, str]] = field(default_factory=list)  # (key, label)
    tabs: list[tuple[str, str]] = field(default_factory=list)  # (value, label)
    modals: list[tuple[int, str]] = field(default_factory=list)  # (line, title)
    drawers: list[tuple[int, str]] = field(default_factory=list)  # (line, title)
    placeholders: list[tuple[int, str]] = field(default_factory=list)
    todos: list[tuple[int, str]] = field(default_factory=list)
    suspicious: list[str] = field(default_factory=list)


def scan_page(path: Path) -> PageReport:
    src = path.read_text(errors="replace")
    lines = src.split("\n")
    rel = str(path.relative_to(PAGES_DIR))
    rep = PageReport(rel_path=rel, abs_path=path, lines=len(lines), guard=None)

    g = RE_GUARD.search(src)
    rep.guard = g.group(1).strip() if g else None
    rep.api_methods = sorted({m.group(1) for m in RE_API_CALL.finditer(src)})
    rep.use_form_count = len(list(RE_USEFORM.finditer(src)))
    rep.use_query_keys = sorted({m.group(1) for m in RE_USEQUERY.finditer(src)})
    rep.use_mutation_count = len(list(RE_USEMUTATION.finditer(src)))

    # Inputs — tag each with line number + kind + nearby label if any.
    for m in RE_INPUT.finditer(src):
        ln = src[: m.start()].count("\n") + 1
        kind = m.group(1)
        label = ""
        # Look forward up to 200 chars for a label= within this tag
        chunk = src[m.start() : m.start() + 400]
        lm = RE_INPUT_LABEL.search(chunk)
        if lm:
            label = lm.group(1) or lm.group(2) or lm.group(3) or ""
        rep.inputs.append((ln, kind, label))

    # Buttons
    for m in RE_BUTTON.finditer(src):
        ln = src[: m.start()].count("\n") + 1
        chunk = src[m.start() : m.start() + 300]
        lm = RE_BUTTON_LABEL.search(chunk)
        label = (lm.group(1).strip() if lm else "").replace("\n", " ")
        if not label or len(label) > 80:
            label = f"<button @ line {ln}>"
        rep.buttons.append((ln, label))

    for m in RE_ACTION_ICON.finditer(src):
        ln = src[: m.start()].count("\n") + 1
        chunk = src[m.start() : m.start() + 400]
        lm = RE_ACTION_ICON_LABEL.search(chunk)
        label = (lm.group(1) or lm.group(2)) if lm else ""
        rep.action_icons.append((ln, label or f"<action icon @ line {ln}>"))

    for m in RE_MENU_ITEM.finditer(src):
        ln = src[: m.start()].count("\n") + 1
        chunk = src[m.start() : m.start() + 500]
        lm = RE_MENU_ITEM_LABEL.search(chunk)
        label = (lm.group(1).strip() if lm else "").replace("\n", " ")
        rep.menu_items.append((ln, label or f"<menu item @ line {ln}>"))

    # Tables — find each <Table>/<DataTable>, harvest headers
    for m in RE_TABLE.finditer(src):
        ln = src[: m.start()].count("\n") + 1
        # Look forward 4000 chars for Table.Th tags
        chunk = src[m.start() : m.start() + 4000]
        ths = [hm.group(1).strip() for hm in RE_TH.finditer(chunk)]
        rep.tables.append((ln, ths[:30]))

    # DataTable columns array — `columns = [{key, label, render}, ...]`
    for cm in RE_DATATABLE_COL.finditer(src):
        rep.datatable_cols.append((cm.group(1), cm.group(2)))

    for tm in RE_TABS_TAB.finditer(src):
        rep.tabs.append((tm.group(1), tm.group(2).strip()))

    for mm in RE_MODAL.finditer(src):
        ln = src[: mm.start()].count("\n") + 1
        chunk = src[mm.start() : mm.start() + 400]
        tm = RE_MODAL_TITLE.search(chunk)
        title = tm.group(1) if tm else f"<modal @ line {ln}>"
        rep.modals.append((ln, title))

    for dm in RE_DRAWER.finditer(src):
        ln = src[: dm.start()].count("\n") + 1
        chunk = src[dm.start() : dm.start() + 400]
        tm = RE_DRAWER_TITLE.search(chunk)
        title = tm.group(1) if tm else f"<drawer @ line {ln}>"
        rep.drawers.append((ln, title))

    for pm in RE_PLACEHOLDER.finditer(src):
        if pm.group(1) == "":
            ln = src[: pm.start()].count("\n") + 1
            rep.placeholders.append((ln, "(empty placeholder)"))

    for tm in RE_TODO.finditer(src):
        ln = src[: tm.start()].count("\n") + 1
        line_text = lines[ln - 1].strip() if ln - 1 < len(lines) else ""
        rep.todos.append((ln, line_text[:120]))

    if RE_DISABLED_HARD.search(src):
        rep.suspicious.append("hardcoded `disabled={true}` somewhere")
    if RE_NO_OP.search(src):
        rep.suspicious.append("no-op `onClick={() => {}}` somewhere")
    if rep.api_methods and rep.use_mutation_count == 0 and len(rep.use_query_keys) == 0 and "onboarding" not in rel:
        rep.suspicious.append("api refs without useQuery/useMutation")
    if not rep.guard and rep.api_methods and "onboarding" not in rel and rel != "login.tsx" and rel != "landing.tsx":
        rep.suspicious.append("no useRequirePermission guard")

    return rep


# ── Markdown rendering ────────────────────────────────────────────


def src_link(rel_path: str, line: int | None = None) -> str:
    """GitHub-style relative link to the source file (works in VS Code)."""
    target = f"../../../apps/web/src/pages/{rel_path}"
    if line:
        target += f"#L{line}"
    return target


def render_page(rep: PageReport) -> str:
    o = []
    o.append(f"# `{rep.rel_path}` walkthrough")
    o.append("")
    o.append(
        f"_Source: [`apps/web/src/pages/{rep.rel_path}`]({src_link(rep.rel_path)}) "
        f"({rep.lines} lines). Guard: `{rep.guard or '—'}`. "
        f"API methods: {len(rep.api_methods)}. useForm: {rep.use_form_count}. "
        f"Tables: {len(rep.tables)}. Modals: {len(rep.modals) + len(rep.drawers)}._"
    )
    o.append("")
    o.append(
        "Tick each box that **works as expected** when you walk the page in a browser. "
        "Anything you can't tick → file in `../issues.md` with the line number, then "
        "fix and come back to tick it. Severity rubric: **P0** blocks core flow, "
        "**P1** broken UX with workaround, **P2** cosmetic."
    )
    o.append("")

    # ── Page-level basics ────────────────────────────────────
    o.append("## Page-level")
    o.append("")
    o.append("- [ ] Page renders without `console.error`")
    o.append("- [ ] Network tab shows no 4xx/5xx on initial load")
    o.append("- [ ] Desktop viewport has no overlapping text, clipped buttons, or broken table layout")
    o.append("- [ ] Mobile/tablet viewport has no overlapping text, clipped buttons, or unusable controls")
    o.append(f"- [ ] Permission guard `{rep.guard or '(none)'}` redirects unauthorised user to /dashboard")
    o.append("- [ ] Loading skeleton / spinner shown while data loads")
    o.append("- [ ] Empty state visible when there are zero rows")
    o.append("- [ ] Page title in browser tab is correct")
    o.append("- [ ] Breadcrumb / nav highlights this page")
    o.append("")

    if rep.suspicious:
        o.append("### ⚠ Static analysis flags")
        for s in rep.suspicious:
            o.append(f"- `{s}`")
        o.append("")

    # ── Tabs ────────────────────────────────────────────────
    if rep.tabs:
        o.append("## Tabs")
        o.append("")
        for value, label in rep.tabs:
            o.append(f"- [ ] Tab **{label}** (`{value}`) — clicking activates the panel + loads its data without console error")
            o.append(f"- [ ] Tab **{label}** (`{value}`) — all visible filters/actions inside the tab produce a visible result")
            o.append(f"- [ ] Tab **{label}** (`{value}`) — leaving and returning preserves or intentionally resets state")
        o.append("")

    # ── Tables ──────────────────────────────────────────────
    if rep.tables or rep.datatable_cols:
        o.append("## Tables / lists")
        o.append("")
        if rep.datatable_cols:
            o.append(f"### DataTable columns ({len(rep.datatable_cols)})")
            for key, label in rep.datatable_cols[:50]:
                o.append(f"- [ ] Column **{label}** (`{key}`) renders without `undefined` / `[object Object]`")
            if len(rep.datatable_cols) > 50:
                o.append(f"- [ ] _… {len(rep.datatable_cols) - 50} more columns — review remaining_")
            o.append("")
        for i, (ln, ths) in enumerate(rep.tables):
            if not ths:
                continue
            o.append(f"### `<Table>` @ line {ln}")
            for th in ths:
                if th:
                    o.append(f"  - [ ] Header **{th}** column shows correct value for at least one row")
            o.append(f"  - [ ] Sortable column actually sorts (if interactive)")
            o.append(f"  - [ ] Pagination / load-more works (if applicable)")
            o.append("")
            if i >= 10:
                o.append(f"_… {len(rep.tables) - 10} more tables — list capped to keep checklist usable_")
                break

    # ── Modals + Drawers ────────────────────────────────────
    if rep.modals or rep.drawers:
        o.append("## Modals / Drawers")
        o.append("")
        for ln, title in rep.modals:
            o.append(f"### Modal — _{title}_ @ [line {ln}]({src_link(rep.rel_path, ln)})")
            o.append(f"- [ ] Opens on trigger")
            o.append(f"- [ ] Required-field validation fires when fields blank")
            o.append(f"- [ ] Submit returns 2xx and shows success toast")
            o.append(f"- [ ] Closes after success")
            o.append(f"- [ ] List refetches and shows the new row")
            o.append(f"- [ ] Cancel button discards changes without warning if untouched, with confirm if dirty")
            o.append(f"- [ ] Server-side validation errors surface inline at the field, not just a banner")
            o.append("")
        for ln, title in rep.drawers:
            o.append(f"### Drawer — _{title}_ @ [line {ln}]({src_link(rep.rel_path, ln)})")
            o.append(f"- [ ] Opens on trigger")
            o.append(f"- [ ] All inner tabs activate without error")
            o.append(f"- [ ] Submit returns 2xx and toast confirms")
            o.append(f"- [ ] Closes via Esc + Cancel + ✕")
            o.append("")

    # ── Inputs ──────────────────────────────────────────────
    if rep.inputs:
        o.append(f"## Form inputs ({len(rep.inputs)})")
        o.append("")
        for ln, kind, label in rep.inputs[:200]:
            human = label or f"<{kind} @ line {ln}>"
            o.append(f"- [ ] **{human}** (`{kind}`, [line {ln}]({src_link(rep.rel_path, ln)})) — accepts input, default value sensible, persists after refresh")
        if len(rep.inputs) > 200:
            o.append(f"- [ ] _… {len(rep.inputs) - 200} more fields — list capped at 200_")
        o.append("")

    # ── Buttons / actions ───────────────────────────────────
    if rep.buttons or rep.action_icons or rep.menu_items:
        o.append(
            f"## Buttons / actions (`<Button>`: {len(rep.buttons)}, "
            f"`<ActionIcon>`: {len(rep.action_icons)}, `<Menu.Item>`: {len(rep.menu_items)})"
        )
        o.append("")
        for ln, label in rep.buttons[:80]:
            label_clean = label.strip() or f"<button line {ln}>"
            o.append(
                f"- [ ] **{label_clean}** ([line {ln}]({src_link(rep.rel_path, ln)})) — click path works: disabled state correct, expected API/nav/modal/toast fires, and final row/status/value visibly changes"
            )
            o.append(
                f"- [ ] **{label_clean}** ([line {ln}]({src_link(rep.rel_path, ln)})) — failure path works: validation/server error is shown clearly and does not leave stale loading state"
            )
        if len(rep.buttons) > 80:
            o.append(f"- [ ] _… {len(rep.buttons) - 80} more buttons — list capped at 80_")
        for ln, label in rep.action_icons[:80]:
            o.append(
                f"- [ ] Action icon **{label}** ([line {ln}]({src_link(rep.rel_path, ln)})) — expected row action works, confirmation appears for destructive action, result is visible after refetch"
            )
        if len(rep.action_icons) > 80:
            o.append(f"- [ ] _… {len(rep.action_icons) - 80} more action icons — list capped at 80_")
        for ln, label in rep.menu_items[:120]:
            o.append(
                f"- [ ] Menu action **{label}** ([line {ln}]({src_link(rep.rel_path, ln)})) — visible only when allowed, click triggers expected modal/API/nav, and result is visible"
            )
        if len(rep.menu_items) > 120:
            o.append(f"- [ ] _… {len(rep.menu_items) - 120} more menu actions — list capped at 120_")
        o.append("")

    # ── API + permissions ───────────────────────────────────
    if rep.api_methods:
        o.append(f"## API methods used ({len(rep.api_methods)})")
        o.append("")
        for m in rep.api_methods[:40]:
            o.append(f"- [ ] `api.{m}` — request goes out, 2xx response, no schema mismatch in browser console")
        if len(rep.api_methods) > 40:
            o.append(f"- [ ] _… {len(rep.api_methods) - 40} more methods_")
        o.append("")

    # ── Static-analysis follow-ups ──────────────────────────
    if rep.placeholders:
        o.append("## ⚠ Empty placeholders")
        o.append("")
        for ln, _ in rep.placeholders:
            o.append(f"- [ ] [line {ln}]({src_link(rep.rel_path, ln)}) — set a meaningful placeholder")
        o.append("")

    if rep.todos:
        o.append("## ⚠ TODOs / FIXMEs")
        o.append("")
        for ln, text in rep.todos[:20]:
            o.append(f"- [ ] [line {ln}]({src_link(rep.rel_path, ln)}) — `{text}`")
        o.append("")

    o.append("---")
    o.append("")
    o.append(
        "_Generated by `scripts/gen_screen_checklist.py`. Re-run after any "
        "change to the page to refresh — checkboxes are NOT preserved across "
        "regenerations, so commit your ticks before regenerating._"
    )

    return "\n".join(o)


def render_index(reports: list[PageReport]) -> str:
    o = []
    o.append("# Screen walkthrough — index")
    o.append("")
    o.append(
        f"Generated by `scripts/gen_screen_checklist.py`. {len(reports)} pages. "
        f"Walk top-down by domain priority (clinical → ops → admin → onboarding)."
    )
    o.append("")

    by_dir: dict[str, list[PageReport]] = {}
    for r in reports:
        top = r.rel_path.split("/", 1)[0] if "/" in r.rel_path else "_root"
        by_dir.setdefault(top, []).append(r)

    o.append("## Pages by domain")
    o.append("")
    for d in sorted(by_dir):
        rs = sorted(by_dir[d], key=lambda r: -r.lines)
        o.append(f"### `{d}/` ({len(rs)} pages)")
        o.append("")
        o.append("| Page | Lines | Guard | Inputs | Tables | Modals | Buttons | Suspicious |")
        o.append("|---|---:|---|---:|---:|---:|---:|---|")
        for r in rs:
            sus = "; ".join(r.suspicious) if r.suspicious else "—"
            md_link = (r.rel_path + ".md").replace("/", "/")
            o.append(
                f"| [`{r.rel_path}`]({md_link}) | {r.lines} | `{r.guard or '—'}` | "
                f"{len(r.inputs)} | {len(r.tables)} | {len(r.modals) + len(r.drawers)} | "
                f"{len(r.buttons) + len(r.action_icons) + len(r.menu_items)} | {sus} |"
            )
        o.append("")

    return "\n".join(o)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", nargs="*", help="Limit to specific page filenames")
    ap.add_argument("--top", type=int, default=0, help="Only top-N pages by line count")
    args = ap.parse_args()

    files = sorted(PAGES_DIR.rglob("*.tsx"))
    if args.pages:
        wanted = set(args.pages)
        files = [f for f in files if f.name in wanted or str(f.relative_to(PAGES_DIR)) in wanted]

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    reports: list[PageReport] = []
    for f in files:
        try:
            rep = scan_page(f)
            reports.append(rep)
        except Exception as e:  # noqa: BLE001
            print(f"WARN: failed to scan {f}: {e}", file=sys.stderr)

    if args.top:
        reports = sorted(reports, key=lambda r: -r.lines)[: args.top]

    for rep in reports:
        out = OUT_DIR / (rep.rel_path + ".md")
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(render_page(rep))

    (OUT_DIR / "_index.md").write_text(render_index(reports))

    # Stats summary
    total_inputs = sum(len(r.inputs) for r in reports)
    total_buttons = sum(len(r.buttons) for r in reports)
    total_action_icons = sum(len(r.action_icons) for r in reports)
    total_menu_items = sum(len(r.menu_items) for r in reports)
    total_tables = sum(len(r.tables) for r in reports)
    total_modals = sum(len(r.modals) + len(r.drawers) for r in reports)
    print(
        f"checklists: {len(reports)} pages → {total_inputs} inputs, "
        f"{total_buttons} buttons, {total_action_icons} action icons, "
        f"{total_menu_items} menu actions, {total_tables} tables, "
        f"{total_modals} modals/drawers. Output: {OUT_DIR.relative_to(REPO_ROOT)}/"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

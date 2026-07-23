#!/usr/bin/env python3
"""UI permission gate vs backend enforcement.

`useHasPermission(P.X.Y)` decides whether a control is rendered. It only means
anything if some handler refuses the request when the same code is absent —
otherwise the gate is decoration, and worse, it is usually wrong in the
direction that hides the control from the people who are actually authorised.

Two were exactly that, both fixed rather than recorded:

    camp.followups.manage        gated the schedule button and the
                                 completed/missed buttons, while the handlers
                                 check followups.schedule and followups.outcome
                                 respectively. No role grants `manage`, so a
                                 camp coordinator holding both real permissions
                                 saw an empty actions column.
    specialty.other.chemo.manage gated "New Protocol"; the chemo handlers check
                                 specialty.other.records.create. Same shape —
                                 the dialysis and oncology tabs each have their
                                 own enforced code, chemo never got one.

Both were invisible because super_admin and hospital_admin bypass every check,
so the buttons worked for whoever was testing.

Enforcement is taken as any reference to the constant from a handler crate,
not only from inside a `require_permission(...)` argument list. Reading the
argument list alone is too narrow: `medbrains-tv` routes its six
admin.tv_displays.* codes through a local `require()` wrapper, nurse.dashboard
.view sits in a `&[&str]` batch constant, and pharmacy.dispensing.void is
returned from a match arm — all three look unenforced and none is.

The files that only *enumerate* codes are excluded, or every constant would
count as enforced: the permission manifest itself, the built-in role templates,
the seed, and the generated load test.

Exit codes:
    0  UI gates without an enforcing handler match what is recorded
    1  A new one appeared
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
MEDBRAINS = REPO_ROOT / "medbrains"
RUST_PERMISSIONS = MEDBRAINS / "crates" / "medbrains-core" / "src" / "permissions.rs"
TS_PERMISSIONS = MEDBRAINS / "packages" / "types" / "src" / "permissions.ts"
CRATES = MEDBRAINS / "crates"
WEB_SRC = MEDBRAINS / "apps" / "web" / "src"

# Codes the UI gates on that no handler enforces, with the reason it is not a
# hole. Removing an entry is always welcome; a new one fails.
RECORDED_UNENFORCED = {
    # GET /api/procurement/vendor-performance enforces procurement.vendors.list;
    # the page additionally requires performance.view before showing the tab.
    # The UI is the stricter of the two, so no one reaches data they could not
    # already read — but the extra gate is the UI's alone.
    "procurement.performance.view",
}

UI_REF = re.compile(r"\bP\.((?:[A-Z_0-9]+\.)+[A-Z_0-9]+)\b")
RUST_REF = re.compile(r"(?:[a-z_0-9]+::)+[A-Z_0-9]+")

# Files that list permission codes without enforcing any of them.
CATALOGUES = (
    "medbrains-core/src/permissions.rs",
    "medbrains-core/src/access/roles.rs",
    "medbrains-loadtest/src/generated.rs",
)


def rust_constants() -> dict[str, str]:
    """Full path (`camp::followups::SCHEDULE`) to code.

    Resolved by path rather than by the trailing identifier: `MANAGE` alone
    names 143 different constants.
    """
    stack: list[str] = []
    resolved: dict[str, str] = {}
    for line in RUST_PERMISSIONS.read_text(encoding="utf-8").splitlines():
        opened = re.match(r"\s*pub mod ([a-z_0-9]+)\s*\{", line)
        if opened:
            stack.append(opened.group(1))
            continue
        const = re.match(r'\s*pub const ([A-Z_0-9]+):\s*&str\s*=\s*"([^"]+)"', line)
        if const:
            resolved["::".join([*stack, const.group(1)])] = const.group(2)
        for _ in range(line.count("}")):
            if stack:
                stack.pop()
    return resolved


def enforced_codes(consts: dict[str, str]) -> set[str]:
    found: set[str] = set()
    for path in sorted(CRATES.rglob("*.rs")):
        relative = str(path.relative_to(CRATES))
        if "/tests/" in str(path) or relative in CATALOGUES:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for token in RUST_REF.findall(text):
            if "permissions::" in token:
                token = token[token.index("permissions::") + len("permissions::") :]
            if token in consts:
                found.add(consts[token])
                continue
            # `use ...::permissions::admin::tv_displays;` then `tv_displays::LIST`
            # — the leading modules are gone, so match on the tail. Only when it
            # is unambiguous: `MANAGE` alone names 143 constants.
            suffixed = {v for k, v in consts.items() if k.endswith("::" + token)}
            if len(suffixed) == 1:
                found |= suffixed
        # Codes written as a literal rather than through the constant.
        for literal in re.findall(r'require_\w*permission\w*\([^)]*"([a-z_]+(?:\.[a-z_0-9]+)+)"', text):
            found.add(literal)
    return found


def ts_constants() -> dict[str, str]:
    """`P` path (`CAMP.FOLLOWUPS_SCHEDULE`) to code."""
    text = TS_PERMISSIONS.read_text(encoding="utf-8")
    body = text[text.index("export const P = {") :]
    stack: list[str] = []
    resolved: dict[str, str] = {}
    for line in body.splitlines():
        opened = re.match(r"\s*([A-Z_0-9]+):\s*\{", line)
        if opened:
            stack.append(opened.group(1))
        for const in re.finditer(r'([A-Z_0-9]+):\s*"([^"]+)"', line):
            resolved[".".join([*stack, const.group(1)])] = const.group(2)
        for _ in range(line.count("}")):
            if stack:
                stack.pop()
    return resolved


def ui_gates(ts: dict[str, str]) -> dict[str, set[str]]:
    gates: dict[str, set[str]] = {}
    for path in sorted([*WEB_SRC.rglob("*.tsx"), *WEB_SRC.rglob("*.ts")]):
        for match in UI_REF.finditer(path.read_text(encoding="utf-8", errors="ignore")):
            code = ts.get(match.group(1))
            if code:
                gates.setdefault(code, set()).add(path.name)
    return gates


def main() -> int:
    for required in (RUST_PERMISSIONS, TS_PERMISSIONS):
        if not required.exists():
            print(f"ERROR: {required} not found", file=sys.stderr)
            return 2

    consts = rust_constants()
    ts = ts_constants()
    if not consts or not ts:
        print("ERROR: parsed no permission constants — the patterns broke", file=sys.stderr)
        return 2

    enforced = enforced_codes(consts)
    gates = ui_gates(ts)
    if not enforced or not gates:
        print("ERROR: parsed no permission usage — the patterns broke", file=sys.stderr)
        return 2

    failures = [
        f"{code} — gated in {sorted(where)[:3]}, enforced by no handler"
        for code, where in sorted(gates.items())
        if code not in enforced and code not in RECORDED_UNENFORCED
    ]

    print(
        f"permission codes enforced by a handler: {len(enforced)} | "
        f"gated in the UI: {len(gates)}"
    )

    if failures:
        print(f"\n=== {len(failures)} UI GATE NO HANDLER ENFORCES ===")
        for failure in failures:
            print(f"  ✗ {failure}")
        print(
            "\nThe control is hidden from whoever lacks this code while the request "
            "succeeds or fails on a different one, so the gate hides it from the "
            "people who are authorised. Gate on the code the handler checks, add "
            "the check to the handler, or record it with the reason."
        )
        return 1

    print("✓ UI permission gates match what handlers enforce.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

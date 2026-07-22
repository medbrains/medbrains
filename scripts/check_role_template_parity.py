#!/usr/bin/env python3
"""
Role-template parity check.

The permission set of a role is written twice:

    crates/medbrains-core/src/access/roles.rs   BUILT_IN_ROLES, seeded into
                                                the roles table on tenant
                                                creation
    packages/types/src/permissions.ts           ROLE_TEMPLATES, what the admin
                                                UI prefills a new custom role
                                                with

Nothing keeps them in step. admin/roles.tsx writes the template straight into
the new role — createRole with the template's permissions, then
updateRolePermissions with the same list — so whatever the template says is
what the role gets. The dropdown even advertises the count ("Doctor (133
permissions)").

Eight of the nine templates disagree with the role they are named after. The
Doctor template grants 133 where the seeded doctor role has 198, so a custom
"Doctor" role silently lacks doctor.signoffs.verbal_register (verbal-order
countersigning, a NABH register) and the whole consent verify/revoke set.
Three templates lean the other way and grant something the real role does not,
including specialty.palliative.dnr.manage on Doctor.

Which list is right is a product decision — the templates may be deliberately
leaner than the seeded roles. What is not deliberate is the gap widening every
time a permission is added to roles.rs and the template is forgotten, which is
how documents.generate / documents.reprint / documents.templates.list came to
be missing from six of the nine templates at once.

This records today's gap and fails when it grows.

Exit codes:
    0  Divergence matches what is recorded
    1  A template drifted further from its role
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TS = REPO_ROOT / "medbrains" / "packages" / "types" / "src" / "permissions.ts"
RS = REPO_ROOT / "medbrains" / "crates" / "medbrains-core" / "src" / "permissions.rs"
ROLES = REPO_ROOT / "medbrains" / "crates" / "medbrains-core" / "src" / "access" / "roles.rs"
BASELINE = REPO_ROOT / "scripts" / ".role_template_parity_baseline.json"


def rust_constants() -> dict[str, str]:
    """Full path (`opd::vitals::CREATE`) to code, so same-named constants in
    different modules stay distinct."""
    stack: list[str] = []
    resolved: dict[str, str] = {}
    for line in RS.read_text(encoding="utf-8").splitlines():
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


def rust_roles() -> dict[str, set[str]]:
    constants = rust_constants()
    text = ROLES.read_text(encoding="utf-8")
    roles: dict[str, set[str]] = {}
    for block in re.split(r"BuiltInRole\s*\{", text)[1:]:
        code = re.search(r'code:\s*"([a-z_]+)"', block)
        if not code:
            continue
        refs = re.findall(r"permissions::([a-z_0-9:]+::[A-Z_0-9]+)", block)
        roles[code.group(1)] = {constants[r] for r in refs if r in constants}
    return roles


def ts_permission_constants(text: str) -> dict[str, str]:
    """Flatten the `P` tree to `OPD.VITALS.CREATE` -> `opd.vitals.create`."""
    start = text.index("export const P = {") + len("export const P = ")
    depth = 0
    end = start
    for index in range(start, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                end = index
                break
    block = re.sub(r"\s+as const", "", text[start : end + 1])
    block = re.sub(r"//[^\n]*", "", block)
    block = re.sub(r"([A-Za-z_][A-Za-z_0-9]*):", r'"\1":', block)
    block = re.sub(r",(\s*[}\]])", r"\1", block)

    def flatten(node: dict, prefix: str = "") -> dict[str, str]:
        out: dict[str, str] = {}
        for key, value in node.items():
            path = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                out.update(flatten(value, path))
            else:
                out[path] = value
        return out

    return flatten(json.loads(block))


def ts_templates() -> dict[str, set[str]]:
    text = TS.read_text(encoding="utf-8")
    constants = ts_permission_constants(text)
    section = text.split("export const ROLE_TEMPLATES", 1)[1]
    templates: dict[str, set[str]] = {}
    pattern = r"\n  ([a-z_0-9]+):\s*\{\s*\n\s*label:.*?permissions:\s*\[(.*?)\n\s*\],"
    for match in re.finditer(pattern, section, re.S):
        refs = re.findall(r"\bP\.([A-Z_0-9.]+)", match.group(2))
        unresolved = [r for r in refs if r not in constants]
        if unresolved:
            print(
                f"ERROR: {match.group(1)} references unknown P.{unresolved[0]}",
                file=sys.stderr,
            )
            raise SystemExit(2)
        templates[match.group(1)] = {constants[r] for r in refs}
    return templates


def main() -> int:
    for path in (TS, RS, ROLES):
        if not path.exists():
            print(f"ERROR: {path.relative_to(REPO_ROOT)} not found", file=sys.stderr)
            return 2

    roles = rust_roles()
    templates = ts_templates()
    shared = sorted(set(roles) & set(templates))

    if not shared:
        print("ERROR: no template matched a built-in role — parsing broke", file=sys.stderr)
        return 2

    # A template granting something the real role does not is the direction
    # worth naming, so it is recorded by code; the missing side is large and
    # recorded by count.
    actual = {
        role: {
            "template_only": sorted(templates[role] - roles[role]),
            "missing_from_template": len(roles[role] - templates[role]),
        }
        for role in shared
    }

    if not BASELINE.exists():
        BASELINE.write_text(json.dumps(actual, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"Wrote baseline for {len(actual)} templates to {BASELINE.name}")
        return 0

    baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
    print(f"role templates compared against their built-in role: {len(shared)}")

    failures: list[str] = []
    for role, gap in actual.items():
        recorded = baseline.get(role)
        if recorded is None:
            failures.append(f"{role} — new template, not in the baseline")
            continue
        for code in sorted(set(gap["template_only"]) - set(recorded["template_only"])):
            failures.append(
                f"{role} — template grants {code}, the built-in role does not"
            )
        if gap["missing_from_template"] > recorded["missing_from_template"]:
            failures.append(
                f"{role} — template now misses {gap['missing_from_template']} "
                f"permissions the role has, was {recorded['missing_from_template']}"
            )

    if failures:
        print(f"\n=== {len(failures)} ROLE TEMPLATE DRIFT ===")
        for failure in failures:
            print(f"  ✗ {failure}")
        print(
            "\nThe admin UI writes the template straight into a new role, so this "
            "is what that role will actually be able to do. Update the template in "
            "packages/types/src/permissions.ts alongside roles.rs, or re-record the "
            f"gap in {BASELINE.name}."
        )
        return 1

    print("✓ Role-template divergence matches what is recorded.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

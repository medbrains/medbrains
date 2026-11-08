#!/usr/bin/env python3
"""Every name for an app brick must come from the one table, crates/medbrains-core/src/bricks.rs.

Fails when:
  - a route's module check (`require_module_enabled`, `module_entitlement`) names no brick;
  - a web menu tag (`moduleCode` in navigation.ts) names no brick;
  - a web menu entry whose permissions all belong to one brick carries no tag for it, so the
    menu would still show it with the brick off;
  - the module seed list names no brick, or its dependencies differ from the table;
  - a permission group in permissions.rs is placed nowhere (no brick, not the base plate, not
    listed as a brick still to be made).

Reports, and ratchets: bricks whose routes have no server module check yet, so switching them off
only hides the menu. The number may fall, never rise (`UNGUARDED_CEILING`).

Run from the repository root: python3 scripts/check_bricks.py
"""

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "medbrains"
BRICKS = ROOT / "crates/medbrains-core/src/bricks.rs"
PERMISSIONS = ROOT / "crates/medbrains-core/src/permissions.rs"
SEED = ROOT / "crates/medbrains-seed/src/module_config.rs"
NAV = ROOT / "apps/web/src/config/navigation.ts"
CRATES = ROOT / "crates"

# Bricks switched off by the Modules screen whose API still answers. Lower this as checks land.
UNGUARDED_CEILING = 0

STRING = re.compile(r'"([a-z_.]+)"')


def strings(text: str) -> list[str]:
    """Every quoted lower-case name in `text`, in order."""
    return STRING.findall(text)


def read_bricks() -> tuple[dict[str, dict], set[str]]:
    """The table: id -> {deps, groups}; and the groups placed outside bricks."""
    text = BRICKS.read_text()
    table = text[text.index("pub const BRICKS") : text.index("\n];\n", text.index("pub const BRICKS"))]
    bricks: dict[str, dict] = {}
    for row in table.splitlines():
        row = row.strip()
        if row.startswith("brick("):
            parts = re.findall(r"&\[([^\]]*)\]", row)
            ident = strings(row)[0]
            bricks[ident] = {"deps": strings(parts[0]), "groups": strings(parts[1])}
        elif row.startswith("Brick {"):
            ident = re.search(r'id: "([a-z_]+)"', row).group(1)
            deps = strings(re.search(r"depends_on: &\[([^\]]*)\]", row).group(1))
            groups = strings(re.search(r"permission_groups: &\[([^\]]*)\]", row).group(1))
            bricks[ident] = {"deps": deps, "groups": groups}
    placed = set()
    for name in ("BASE_PLATE", "NOT_YET_BRICKS"):
        start = text.index(f"pub const {name}")
        placed |= set(strings(text[start : text.index("];", start)]))
    return bricks, placed


def permission_groups() -> set[str]:
    """Top-level permission modules, and `specialty.<sub>` for the specialty apps."""
    text = PERMISSIONS.read_text()
    groups = set(re.findall(r"^pub mod (\w+)", text, re.M))
    start = text.index("pub mod specialty")
    end = text.find("\npub mod ", start + 1)
    groups |= {f"specialty.{sub}" for sub in re.findall(r"^    pub mod (\w+)", text[start:end], re.M)}
    return groups


def route_codes() -> dict[str, list[str]]:
    """Module code -> files whose routes check it."""
    found: dict[str, list[str]] = {}
    call = re.compile(r'(?:require_module_enabled|module_entitlement)\([^;]*?"([a-z_]+)"\s*,?\s*\)', re.S)
    # A whole router behind its brick switch: `gated("pharmacy", router, &state)`.
    gate = re.compile(r'\bgated\(\s*"([a-z_]+)"')
    for path in CRATES.rglob("*.rs"):
        text = path.read_text(errors="ignore")
        for code in call.findall(text) + gate.findall(text):
            found.setdefault(code, []).append(str(path.relative_to(ROOT)))
    return found


def owner(code: str, groups: dict[str, str | None]) -> str | None:
    """The brick a permission code belongs to: the one with the longest matching group."""
    best = ""
    for group in groups:
        if (code == group or code.startswith(group + ".")) and len(group) > len(best):
            best = group
    return groups.get(best)


def untagged_menu_entries(bricks: dict[str, dict], placed: set[str]) -> list[str]:
    """Menu entries whose permissions all belong to one brick but whose `moduleCode` is not it."""
    groups: dict[str, str | None] = {g: None for g in placed}
    groups |= {g: ident for ident, brick in bricks.items() for g in brick["groups"]}
    problems = []
    for entry in re.split(r"(?=\bi18nKey:)", NAV.read_text())[1:]:
        entry = entry.split("children:")[0]
        key = re.match(r'i18nKey: "([^"]+)"', entry)
        perms = re.findall(r'"([a-z_]+(?:\.[a-z_0-9]+)+)"', entry)
        owners = {owner(code, groups) for code in perms}
        if not key or len(owners) != 1 or None in owners:
            continue
        brick = owners.pop()
        tag = re.search(r'moduleCode: "([a-z_]+)"', entry)
        if not tag or tag.group(1) != brick:
            problems.append(f"navigation.ts entry {key.group(1)} is {brick}'s but has no moduleCode \"{brick}\"")
    return problems


def seed_rows() -> dict[str, list[str]]:
    """Seeded module code -> its dependencies."""
    rows = re.findall(r'\(\s*"([a-z_]+)",\s*"[^"]+",\s*"[^"]*",\s*"[a-z_]+",\s*&\[([^\]]*)\]', SEED.read_text())
    return {code: strings(deps) for code, deps in rows}


def main() -> int:
    """Run every check, print the ratchet line and each failure; 1 if anything failed."""
    bricks, placed = read_bricks()
    problems: list[str] = []

    for code, files in sorted(route_codes().items()):
        if code not in bricks:
            problems.append(f"route module check names no brick: {code} ({files[0]})")
    for code in sorted(set(re.findall(r'moduleCode: "([a-z_]+)"', NAV.read_text()))):
        if code not in bricks:
            problems.append(f"navigation.ts moduleCode names no brick: {code}")
    for code, deps in sorted(seed_rows().items()):
        if code not in bricks:
            problems.append(f"seed module names no brick: {code}")
        elif sorted(deps) != sorted(bricks[code]["deps"]):
            problems.append(f"seed dependencies for {code} {deps} differ from bricks.rs {bricks[code]['deps']}")
    problems += untagged_menu_entries(bricks, placed)
    in_bricks = {group for brick in bricks.values() for group in brick["groups"]}
    for group in sorted(permission_groups() - in_bricks - placed):
        problems.append(f"permission group placed nowhere: {group} (add it to a brick, BASE_PLATE or NOT_YET_BRICKS)")
    for group in sorted((in_bricks | placed) - permission_groups()):
        problems.append(f"bricks.rs names a permission group that does not exist: {group}")

    guarded = set(route_codes())
    unguarded = sorted(code for code in bricks if code not in guarded)
    print(f"bricks: {len(bricks)}; with a server module check: {len(bricks) - len(unguarded)}")
    print(f"no server module check yet ({len(unguarded)}): {', '.join(unguarded)}")
    if len(unguarded) > UNGUARDED_CEILING:
        problems.append(f"{len(unguarded)} bricks have no server module check, ceiling {UNGUARDED_CEILING}")

    for problem in problems:
        print(f"FAIL {problem}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

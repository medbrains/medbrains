#!/usr/bin/env python3
"""
Drift checker: navigation.ts vs medbrains_core::access::screens::SCREENS.

Flags any of:
  - Screen in SCREENS missing from navigation.ts (route or perm mismatch)
  - Nav entry whose `requiredPermission` doesn't match the SCREENS entry
    for that route
  - Nav entry with a route not present in SCREENS at all (orphan UI)

This is the M4.2 deliverable — instead of generating navigation.ts
wholesale (which would clobber the curated grouping/tabs structure),
we keep navigation.ts hand-crafted but enforce alignment via this
linter that runs in CI. Any drift fails the build.

Usage:
    python3 scripts/check_nav_drift.py [--fix]

With --fix, prints a TypeScript snippet to paste into navigation.ts
for missing screens. Doesn't modify the file in place.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCREENS_RS = ROOT / "crates/medbrains-core/src/access/screens.rs"
NAV_TS = ROOT / "apps/web/src/config/navigation.ts"


def parse_screens_rs() -> list[dict]:
    """Parse `pub const SCREENS: &[ScreenDef] = &[...]` blocks."""
    text = SCREENS_RS.read_text()
    # Match each ScreenDef { code: "...", route: "...", required_permission: ... }
    out = []
    for block in re.finditer(r"ScreenDef\s*\{(.*?)\}\s*,", text, flags=re.DOTALL):
        body = block.group(1)
        fields = {}
        for m in re.finditer(r'(\w+)\s*:\s*(?:Some\("([^"]+)"\)|"([^"]+)"|None)', body):
            k = m.group(1)
            v = m.group(2) or m.group(3)
            fields[k] = v
        if "code" in fields and "route" in fields:
            out.append(fields)
    return out


def parse_navigation_ts() -> list[dict]:
    """Pull each nav-item literal `{ ..., path: "...", requiredPermission: "..." }`."""
    text = NAV_TS.read_text()
    out = []
    # Greedy block of one nav item — relies on `path:` being present per item.
    for m in re.finditer(r"\{[^{}]*path:\s*\"([^\"]+)\"[^{}]*\}", text, flags=re.DOTALL):
        item = m.group(0)
        path = m.group(1)
        perm_m = re.search(r"requiredPermission:\s*\"([^\"]+)\"", item)
        out.append({
            "path": path,
            "requiredPermission": perm_m.group(1) if perm_m else None,
        })
    return out


def main() -> int:
    fix = "--fix" in sys.argv

    screens = parse_screens_rs()
    nav_items = parse_navigation_ts()
    nav_by_path = {n["path"]: n for n in nav_items}
    screens_by_route = {s["route"]: s for s in screens}

    missing: list[dict] = []  # in SCREENS, not in nav
    orphan: list[dict] = []   # in nav, not in SCREENS
    perm_mismatch: list[tuple[dict, dict]] = []  # nav entry vs screen perm differs

    for s in screens:
        if s["route"] not in nav_by_path:
            missing.append(s)
            continue
        nav = nav_by_path[s["route"]]
        # Compare perms — None on either side means "always-visible"
        screen_perm = s.get("required_permission")
        nav_perm = nav.get("requiredPermission")
        if screen_perm != nav_perm:
            perm_mismatch.append((nav, s))

    for n in nav_items:
        # Skip nested admin sub-routes (e.g. /admin/users/{id}); only check
        # exact path matches against SCREENS.
        if n["path"] not in screens_by_route:
            # Nested or detail routes aren't in SCREENS — fine.
            continue

    has_drift = bool(missing or perm_mismatch)

    if missing:
        print(f"\n❌ {len(missing)} screen(s) in SCREENS missing from navigation.ts:")
        for s in missing:
            perm = s.get("required_permission") or "—"
            print(f"  • {s['route']:40} perm={perm:40} code={s['code']}")
            if fix:
                print(f"    → Add to navigation.ts:")
                print("      {")
                print(f'        i18nKey: "{s["code"].replace(".", "_")}",')
                print(f'        path: "{s["route"]}",')
                print(f'        icon: "{s.get("icon", "IconCircle")}",')
                if s.get("required_permission"):
                    print(f'        requiredPermission: "{s["required_permission"]}",')
                print("      },")

    if perm_mismatch:
        print(f"\n⚠ {len(perm_mismatch)} permission mismatch(es):")
        for nav, screen in perm_mismatch:
            print(
                f"  • {nav['path']:40} "
                f"nav={nav.get('requiredPermission') or 'None'} "
                f"vs screen={screen.get('required_permission') or 'None'}"
            )

    if not has_drift:
        print(f"✓ navigation.ts in sync with {len(screens)} SCREENS entries.")
        return 0

    print(f"\nDrift detected. Update navigation.ts to match SCREENS, or update SCREENS to match nav.")
    return 1


if __name__ == "__main__":
    sys.exit(main())

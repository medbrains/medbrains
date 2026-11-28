#!/usr/bin/env python3
"""
Drift checker: the web menu vs medbrains_core::access::screens::SCREENS.

The menu (`navigation.ts`) is built from the generated copy of SCREENS
(`app-screens.generated.ts`), so the registry is the one place a screen is
added. Flags any of:
  - Screen in SCREENS missing from the menu (route or perm mismatch)
  - Menu entry whose permission doesn't match the SCREENS entry for that route
  - A menu entry written by hand in navigation.ts instead of in SCREENS: it
    would sit in no app's side panel and the route would not know its app
    (a section heading with `children:`, such as Administration, is allowed)

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
APP_SCREENS_TS = ROOT / "packages/types/src/app-screens.generated.ts"
APP_SCREEN_RE = re.compile(
    r'\{ brick: (?:"[^"]+"|null), path: "([^"]+)", labelKey: "[^"]+", icon: "[^"]+", '
    r'permission: (?:"([^"]+)"|null), anyOf: \[([^\]]*)\], group: "\w+" \}'
)


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


def hand_written_entries() -> list[str]:
    """Paths of menu items written as literals in navigation.ts, section headings aside."""
    text = NAV_TS.read_text()
    items = re.finditer(r"\{[^{}]*path:\s*\"([^\"]+)\"[^{}]*\}", text, flags=re.DOTALL)
    return [m.group(1) for m in items if "children:" not in m.group(0)]


def parse_navigation_ts() -> list[dict]:
    """Pull each nav-item literal `{ ..., path: "...", requiredPermission... }`.

    Nav items declare their gate either as a single `requiredPermission` or as
    an any-of list `requiredPermissions: [...]`. Only the singular form was
    read, so every plural entry looked ungated and was reported as a mismatch
    against its SCREENS permission (17 of 101 nav items use the plural form).
    """
    text = NAV_TS.read_text()
    out = []
    # Greedy block of one nav item — relies on `path:` being present per item.
    for m in re.finditer(r"\{[^{}]*path:\s*\"([^\"]+)\"[^{}]*\}", text, flags=re.DOTALL):
        item = m.group(0)
        path = m.group(1)
        if "children:" in item:
            continue  # a section heading; its pages come from the registry
        perm_m = re.search(r"requiredPermission:\s*\"([^\"]+)\"", item)
        any_of_m = re.search(r"requiredPermissions:\s*\[(.*?)\]", item, flags=re.DOTALL)
        any_of = re.findall(r'"([^"]+)"', any_of_m.group(1)) if any_of_m else []
        out.append({
            "path": path,
            "requiredPermission": perm_m.group(1) if perm_m else None,
            "requiredPermissions": any_of,
        })
    out.extend(
        {"path": path, "requiredPermission": perm or None, "requiredPermissions": re.findall(r'"([^"]+)"', any_of)}
        for path, perm, any_of in parse_app_screens_ts()
    )
    return out


def parse_app_screens_ts() -> list[tuple[str, str, str]]:
    """Every registry screen's path, permission and any-of list, from the generated copy."""
    return APP_SCREEN_RE.findall(APP_SCREENS_TS.read_text())


def main() -> int:
    """Fail when a SCREENS row has no menu entry, or its menu entry asks for another permission."""
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
        # An any-of list satisfies the screen as long as it contains the
        # screen's permission — the nav item is reachable by anyone who can
        # open the screen.
        if screen_perm and screen_perm in nav.get("requiredPermissions", []):
            continue
        if screen_perm != nav_perm:
            perm_mismatch.append((nav, s))

    for n in nav_items:
        # Skip nested admin sub-routes (e.g. /admin/users/{id}); only check
        # exact path matches against SCREENS.
        if n["path"] not in screens_by_route:
            # Nested or detail routes aren't in SCREENS — fine.
            continue

    hand_written = hand_written_entries()
    has_drift = bool(missing or perm_mismatch or hand_written)

    if hand_written:
        print(f"\n❌ {len(hand_written)} menu entr(y/ies) written by hand in navigation.ts:")
        for path in hand_written:
            print(f"  • {path}: add it to SCREENS in screens.rs and run generate_app_screens.py")

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

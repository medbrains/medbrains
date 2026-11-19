#!/usr/bin/env python3
"""Every typed action names a real brick, a real permission constant and its own id.

The registry is crates/medbrains-health-services/src/actions.rs (docs/architecture/ACTIONS.md).
Fails when an action's `module` is not a brick in bricks.rs, its `permission` is not a
`permissions::…` constant defined in permissions.rs (a string literal would compile and grant
nothing anyone can hold), or two actions share an id.

Run from the repository root: python3 scripts/check_actions.py [--self-test]
"""

import re
import sys
from pathlib import Path

from check_bricks import PERMISSIONS, ROOT, read_bricks

ACTIONS = ROOT / "crates/medbrains-health-services/src/actions.rs"
ROW = re.compile(r"ActionDef \{(.*?)\n    \}", re.S)


def permission_paths(text: str) -> set[str]:
    """Every `a::b::CONST` path that permissions.rs defines, from its module nesting."""
    paths, stack = set(), []
    for line in text.splitlines():
        depth = (len(line) - len(line.lstrip())) // 4
        if module := re.match(r"\s*pub mod (\w+) \{", line):
            del stack[depth:]
            stack.append(module.group(1))
        elif const := re.match(r"\s*pub const (\w+): &str", line):
            paths.add("::".join(stack[:depth] + [const.group(1)]))
    return paths


def rows(text: str) -> list[dict[str, str]]:
    """Each `ActionDef { … }` row's id, module and permission expression."""
    found = []
    for body in ROW.findall(text.split("#[cfg(test)]", 1)[0]):
        field = lambda name: (re.search(rf"\b{name}: ([^,\n]+),", body) or [None, ""])[1].strip()
        found.append({"id": field("id"), "module": field("module"), "permission": field("permission")})
    return found


def problems(actions: list[dict[str, str]], bricks: set[str], perms: set[str]) -> list[str]:
    """A failure line for each action that breaks a rule."""
    out, seen = [], set()
    for action in actions:
        ident = action["id"].strip('"')
        if ident in seen:
            out.append(f"{ident}: declared twice")
        seen.add(ident)
        if action["module"].strip('"') not in bricks:
            out.append(f"{ident}: module {action['module']} is not a brick in bricks.rs")
        path = action["permission"].removeprefix("permissions::")
        if path == action["permission"] or path not in perms:
            out.append(f"{ident}: permission {action['permission']} is not a constant in permissions.rs")
    return out


def self_test() -> int:
    """Prove each rule fails on the row it exists for."""
    perms = permission_paths("pub mod a {\n    pub const X: &str = \"a.x\";\n    pub mod b {\n        pub const Y: &str = \"a.b.y\";\n    }\n}\n")
    assert perms == {"a::X", "a::b::Y"}, perms
    good = {"id": '"a.x"', "module": '"registration"', "permission": "permissions::a::b::Y"}
    assert not problems([good], {"registration"}, perms)
    assert problems([good, good], {"registration"}, perms) == ["a.x: declared twice"]
    assert "not a brick" in problems([good | {"module": '"nope"'}], {"registration"}, perms)[0]
    assert "not a constant" in problems([good | {"permission": '"a.b.y"'}], {"registration"}, perms)[0]
    assert "not a constant" in problems([good | {"permission": "permissions::a::Z"}], {"registration"}, perms)[0]
    print("✓ self-test passed")
    return 0


def main() -> int:
    """Check the registry; 1 on any failure."""
    if "--self-test" in sys.argv:
        return self_test()
    actions = rows(ACTIONS.read_text())
    failures = problems(actions, set(read_bricks()[0]), permission_paths(PERMISSIONS.read_text()))
    if not actions:
        failures.append(f"no ActionDef rows found in {ACTIONS.relative_to(ROOT)}")
    for failure in failures:
        print(f"FAIL {failure}")
    if not failures:
        print(f"✓ {len(actions)} actions: each names a brick, a permission constant and its own id")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Every router the server mounts, and the brick switch (if any) in front of it.

Reads `crates/medbrains-server/src/routes/mod.rs` and, for every `.merge(...)`, reports the
router, its crate, the path prefixes it serves, the brick that gates it today and the permission
groups its code names. Writes `docs/architecture/BRICK-ROUTER-INVENTORY.md`.

`--check` fails when:
  - the checked-in table is stale;
  - a router is merged with no `gated(...)` in front of it and is not listed in
    `scripts/brick_ungated_merges.txt` (the ratchet: today's ungated routers);
  - the ratchet lists a router that is now gated or gone, so the list only shrinks.

Run from `medbrains/`: python3 scripts/brick_router_inventory.py [--write | --check | --self-test]
"""

import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT.parent / "scripts"))
from check_bricks import owner, read_bricks  # noqa: E402  (the one brick-table reader)

MOD_RS = ROOT / "crates/medbrains-server/src/routes/mod.rs"
CRATES = ROOT / "crates"
DOC = ROOT / "docs/architecture/BRICK-ROUTER-INVENTORY.md"
RATCHET = ROOT / "scripts/brick_ungated_merges.txt"

CALL = re.compile(r"\b((?:[a-z_0-9]+::)+[a-z_0-9]+)\(\)")
MODULE_CHECK = re.compile(r'(?:require_module_enabled|module_entitlement)\([^;]*?"([a-z_]+)"\s*,?\s*\)', re.S)
PERMISSION = re.compile(r"\bpermissions::(specialty::[a-z_0-9]+|[a-z_0-9]+)::")
PATH = re.compile(r'"(/[a-z][^"]*)"')
# How deep a router may hand on to another router function before the scan stops.
MAX_DEPTH = 3


def close_of(text: str, at: int, pair: str = "()") -> int:
    """Index just past the bracket that closes the one opened at `at`; strings are skipped."""
    depth, quoted = 0, False
    for index in range(at, len(text)):
        char = text[index]
        if char == '"' and text[index - 1] != "\\":
            quoted = not quoted
        elif not quoted and char == pair[0]:
            depth += 1
        elif not quoted and char == pair[1]:
            depth -= 1
            if depth == 0:
                return index + 1
    return len(text)


def source_of(call: str) -> tuple[str, Path | None]:
    """The crate a router call lives in and the file that defines its function."""
    *modules, _ = call.split("::")
    if modules[0].startswith("medbrains_"):
        crate, src = modules[0].replace("_", "-"), CRATES / modules[0].replace("_", "-") / "src"
        modules = modules[1:]
    else:
        crate, src = "medbrains-server", MOD_RS.parent
    stem = src.joinpath(*modules)
    for path in (stem.with_suffix(".rs"), stem / "mod.rs", src / "lib.rs"):
        if modules or path.name == "lib.rs":
            if path.is_file():
                return crate, path
    return crate, None


def body_of(path: Path, function: str) -> str:
    """The body of `fn function` in `path`, or in a sibling file when `path` only re-exports it."""
    siblings = sorted(path.parent.rglob("*.rs")) if path.name in ("lib.rs", "mod.rs") else []
    for file in [path, *siblings]:
        text = file.read_text(errors="ignore")
        found = re.search(rf"\bfn {function}\b[^{{;]*\{{", text)
        if found:
            return text[found.end() - 1 : close_of(text, found.end() - 1, "{}")]
    return ""


def constant_paths(body: str, path: Path) -> list[str]:
    """Route paths a router names through `const NAME: &str = "/..."` beside it."""
    crate = "\n".join(f.read_text(errors="ignore") for f in sorted(path.parent.rglob("*.rs")))
    known = dict(re.findall(r'const ([A-Z_0-9]+): &str =\s*"(/[^"]*)"', crate))
    return [known[name] for name in re.findall(r"\b([A-Z][A-Z_0-9]+)\b", body) if name in known]


def paths_of(call: str, depth: int = 0) -> list[str]:
    """Every route path a router call serves, following the routers it hands on to."""
    _, path = source_of(call)
    if path is None:
        return []
    body = body_of(path, call.split("::")[-1])
    paths = PATH.findall(body) + constant_paths(body, path)
    module = "::".join(call.split("::")[:-1])
    for inner in re.findall(r"\b((?:[a-z_0-9]+::)*[a-z_0-9]+)\(\)", body) if depth < MAX_DEPTH else []:
        candidate = f"{module}::{inner.removeprefix('crate::').removeprefix('self::')}"
        if candidate != call and body_of(source_of(candidate)[1] or path, inner.split("::")[-1]).count(".route("):
            paths += paths_of(candidate, depth + 1)
    return paths


def prefixes(paths: list[str]) -> list[str]:
    """Distinct two-segment prefixes (`/api/pharmacy`), most routes first."""
    return [p for p, _ in Counter("/".join(p.split("/")[:3]) for p in paths).most_common()]


def scope_text(path: Path | None) -> str:
    """The code a router's handlers live in: its own file, or its whole crate for `lib.rs`."""
    if path is None:
        return ""
    files = sorted(path.parent.rglob("*.rs")) if path.name == "lib.rs" else [path]
    return "\n".join(f.read_text(errors="ignore") for f in files)


def rows() -> list[dict]:
    """One row per `.merge(...)` in the server's router, in file order."""
    text = MOD_RS.read_text()
    bricks, placed = read_bricks()
    groups: dict[str, str | None] = {g: None for g in placed}
    groups |= {g: ident for ident, brick in bricks.items() for g in brick["groups"]}
    gates = [(m.start(), close_of(text, m.start() + 5), m.group(1)) for m in re.finditer(r'\bgated\(\s*"([a-z_]+)"', text)]
    out = []
    for merge in re.finditer(r"\.merge\(", text):
        argument = text[merge.end() : close_of(text, merge.end() - 1) - 1]
        call = next(iter(CALL.findall(argument)), None)
        first = argument.strip().split("(")[0].split(".")[0].strip()
        if call is None or (first != "gated" and re.fullmatch(r"[a-z_]+", first)) or first.startswith("Router::new"):
            out.append({"router": first or "Router::new()", "kind": "structural"})
            continue
        own = re.match(r'\s*gated\(\s*"([a-z_]+)"', argument)
        inside = next((code for start, end, code in gates if start < merge.start() < end), None)
        gate = own.group(1) if own else inside
        crate, path = source_of(call)
        scope = scope_text(path)
        checks = Counter(MODULE_CHECK.findall(scope))
        perms = Counter(m.replace("::", ".") for m in PERMISSION.findall(scope))
        owners = Counter(owner(group, groups) or "base" for group in perms.elements() if owner(group, groups) or group in groups)
        out.append({
            "router": f"{call}()", "kind": "router", "crate": crate,
            "prefixes": prefixes(paths_of(call)), "gate": gate, "checks": dict(checks),
            "permissions": [g for g, _ in perms.most_common(3)],
            "owner": owners.most_common(1)[0][0] if owners else "none",
        })
    return out


def gate_cell(row: dict) -> str:
    """How a row is gated: at the merge, by handler checks, or not at all."""
    if row["gate"]:
        return f"**{row['gate']}** (merge)"
    if row["checks"]:
        return ", ".join(f"{code} ({n} handler checks)" for code, n in sorted(row["checks"].items()))
    return "NONE"


def render(table: list[dict]) -> str:
    """The checked-in Markdown table."""
    routers = [r for r in table if r["kind"] == "router"]
    gated = [r for r in routers if r["gate"]]
    partial = [r for r in routers if not r["gate"] and r["checks"]]
    direct = len(re.findall(r"\.route\(", MOD_RS.read_text()))
    gate_calls = len(re.findall(r"\bgated\(", MOD_RS.read_text()))
    lines = [
        "# Brick router inventory",
        "",
        "Generated by `scripts/brick_router_inventory.py --write` from `crates/medbrains-server/src/routes/mod.rs`.",
        "Do not edit by hand; `make check-bricks` fails when it is stale.",
        "",
        f"- `.merge(...)` calls: **{len(table)}**, of which {len(table) - len(routers)} only join routers built in the same file.",
        f"- Routers merged: **{len(routers)}**. Behind a brick switch at the merge (`gated`): **{len(gated)}**"
        f" (from {gate_calls} `gated(...)` calls).",
        f"- Not gated at the merge, but some handlers check a brick themselves: **{len(partial)}**.",
        f"- No brick switch at all: **{len(routers) - len(gated) - len(partial)}**.",
        f"- Routes written directly in `mod.rs` with `.route(...)`, none behind a brick switch: **{direct}**.",
        "",
        "**Owner** is the brick whose permission groups the router's code names most (`base` = base plate or a",
        "group that is not a brick yet, `none` = no permission constant found). It is a hint for gating, not a decision.",
        "",
        "Rows are in `mod.rs` order. No line numbers: any added line would make the table stale.",
        "",
        "| Router | Crate | Prefixes | Gate today | Permission groups | Owner |",
        "|---|---|---|---|---|---|",
    ]
    for row in routers:
        shown = ", ".join(f"`{p}`" for p in row["prefixes"][:4]) + (f" +{len(row['prefixes']) - 4}" if len(row["prefixes"]) > 4 else "")
        lines.append(
            f"| `{row['router']}` | {row['crate']} | {shown or 'none found'} | {gate_cell(row)} "
            f"| {', '.join(row['permissions']) or 'none'} | {row['owner']} |"
        )
    return "\n".join(lines) + "\n"


def ratchet_problems(table: list[dict]) -> list[str]:
    """Ungated routers the ratchet does not list, and listed routers that no longer are ungated."""
    listed = [line.strip() for line in RATCHET.read_text().splitlines() if line.strip() and not line.startswith("#")]
    ungated = [r["router"] for r in table if r["kind"] == "router" and not r["gate"]]
    new = [f"new ungated router merge: {r} (put it behind gated(...), or ask the owner)" for r in sorted(set(ungated) - set(listed))]
    stale = [f"{RATCHET.name} lists {r}, which is gated or gone: remove the line" for r in sorted(set(listed) - set(ungated))]
    return new + stale


def self_test() -> int:
    """The bracket scan and prefix fold, on fixed input."""
    assert close_of('a(b(")"), c) d', 1) == 12
    assert prefixes(["/api/ot/rooms", "/api/ot/rooms/{id}", "/api/cssd/x"]) == ["/api/ot", "/api/cssd"]
    assert gate_cell({"gate": None, "checks": {}}) == "NONE"
    print("brick_router_inventory self-test: ok")
    return 0


def main() -> int:
    """Write the table, or check it and the ratchet; 1 on any failure."""
    if "--self-test" in sys.argv:
        return self_test()
    table = rows()
    text = render(table)
    if "--write" in sys.argv:
        DOC.write_text(text)
    problems = ratchet_problems(table)
    if "--check" in sys.argv and DOC.read_text() != text:
        problems.append(f"{DOC.relative_to(ROOT)} is stale: run python3 scripts/brick_router_inventory.py --write")
    print(text.split("\n\n")[2])
    for problem in problems:
        print(f"FAIL {problem}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""A brick does not depend on another brick, and the exceptions only shrink.

    python3 scripts/check_brick_edges.py              # check (CI)
    python3 scripts/check_brick_edges.py --print      # today's forbidden edges, baseline format
    python3 scripts/check_brick_edges.py --self-test

`bricks/crates.txt` gives every workspace crate a class. From each crate's
`Cargo.toml` (runtime, build and dev dependencies, target tables included) this
finds the `medbrains-*` edges that the split forbids:

- `brick-brick`   a brick's crate depends on a crate of a different brick
                  (multi-brick and not-yet-brick crates count as bricks);
- `base-domain`   a kernel/base crate depends on a brick or a shared health service;
- `shared-brick`  a shared health service depends on a brick.

It fails on an edge that is not in `scripts/brick_edges.baseline.txt`, on a
baseline line whose edge is gone (delete the line: the list only shrinks), and
on a crate with no line in `crates.txt`. There is no `--update`: an edge is
removed from the baseline by hand, and adding one needs the owner.

Dependencies are read from manifests, so an edge hidden behind a re-export of a
third crate is not seen; cross-brick SQL has its own report.
"""

from __future__ import annotations

import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLASSES = ROOT / "bricks" / "crates.txt"
BASELINE = ROOT / "scripts" / "brick_edges.baseline.txt"
MANIFESTS = ("crates/*/Cargo.toml", "apps/**/Cargo.toml", "os/**/Cargo.toml", "tools/**/Cargo.toml")

BASE = {"kernel", "base"}
SHARED = "shared-health-service"
DOMAIN_KINDS = {"brick", "multi-brick", "not-yet-brick"}
OTHER = {"shell", "tooling", "native-os"}


def is_domain(cls: str) -> bool:
    """Whether a class is brick code: a brick, a crate serving several, or a brick to be."""
    return cls.split(":", 1)[0] in DOMAIN_KINDS


def rule_for(src: str, dst: str) -> str | None:
    """The rule an edge between two classes breaks, or None when it is allowed."""
    if is_domain(src) and is_domain(dst) and src.split(":", 1)[1] != dst.split(":", 1)[1]:
        return "brick-brick"
    if src in BASE and (is_domain(dst) or dst == SHARED):
        return "base-domain"
    if src == SHARED and is_domain(dst):
        return "shared-brick"
    return None


def dependency_tables(manifest: dict):
    """Each `(kind, table)` of a manifest, with `[target.*]` tables folded in; build counts as runtime."""
    for scope in [manifest, *manifest.get("target", {}).values()]:
        for key, kind in (("dependencies", "runtime"), ("build-dependencies", "runtime"), ("dev-dependencies", "dev")):
            yield kind, scope.get(key, {})


def crate_deps(manifest: dict) -> set[tuple[str, str]]:
    """`(kind, crate)` for every workspace dependency, following `package =` renames."""
    deps = set()
    for kind, table in dependency_tables(manifest):
        for name, spec in table.items():
            name = spec.get("package", name) if isinstance(spec, dict) else name
            if name.startswith("medbrains-"):
                deps.add((kind, name))
    return deps


def load_graph() -> dict[str, set[tuple[str, str]]]:
    """Every workspace crate and its `medbrains-*` dependencies, read from the manifests."""
    graph = {}
    for pattern in MANIFESTS:
        for path in sorted(ROOT.glob(pattern)):
            if {"node_modules", "target"} & set(path.parts):
                continue
            manifest = tomllib.loads(path.read_text(encoding="utf-8"))
            if "package" in manifest:
                graph[manifest["package"]["name"]] = crate_deps(manifest)
    return graph


def read_classes(text: str) -> dict[str, str]:
    """`crates.txt` as crate -> class; an unknown class is an error, not a silent pass."""
    classes = {}
    for line in text.splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        crate, cls = line.split()
        kind, _, brick = cls.partition(":")
        if (kind in DOMAIN_KINDS) != bool(brick) or kind not in BASE | {SHARED} | DOMAIN_KINDS | OTHER:
            raise SystemExit(f"✗ bricks/crates.txt: unknown class '{cls}' for {crate}")
        classes[crate] = cls
    return classes


def forbidden_edges(graph: dict[str, set[tuple[str, str]]], classes: dict[str, str]) -> set[str]:
    """Baseline-format lines for every edge that breaks a rule; unclassified crates are skipped."""
    edges = set()
    for crate, deps in graph.items():
        for kind, dep in deps:
            if crate in classes and dep in classes and dep in graph and crate != dep:
                rule = rule_for(classes[crate], classes[dep])
                if rule:
                    edges.add(f"{rule} {kind} {crate} {dep}")
    return edges


def read_baseline(text: str) -> set[str]:
    """The allowed edges: every line of the baseline that is not blank or a comment."""
    return {" ".join(line.split()) for line in text.splitlines() if line.strip() and not line.startswith("#")}


def problems(graph, classes: dict[str, str], baseline: set[str]) -> list[str]:
    """Every reason to fail: unclassified or vanished crates, new edges, stale baseline lines."""
    live = forbidden_edges(graph, classes)
    out = [f"{crate}: no line in bricks/crates.txt (give it a class)" for crate in sorted(graph.keys() - classes.keys())]
    out += [f"{crate}: in bricks/crates.txt but not in the workspace (delete the line)" for crate in sorted(classes.keys() - graph.keys())]
    out += [f"new edge: {edge}  (remove the dependency; do not add it to the baseline)" for edge in sorted(live - baseline)]
    out += [f"gone: {edge}  (delete this line from scripts/brick_edges.baseline.txt)" for edge in sorted(baseline - live)]
    return out


def self_test() -> int:
    """Prove each rule fails on the violation it exists for, and only that."""
    classes = read_classes("k kernel\nb base\ns shared-health-service\no brick:opd\no2 brick:opd\np brick:pharmacy\n"
                           "m multi-brick:a,b\nn not-yet-brick:camp\nsh shell\n")
    manifest = tomllib.loads('[dependencies]\nmedbrains-a = "1"\nserde = "1"\nx = { package = "medbrains-b" }\n'
                             '[dev-dependencies]\nmedbrains-c = "1"\n[target."cfg(unix)".build-dependencies]\nmedbrains-d = "1"\n')
    assert crate_deps(manifest) == {("runtime", "medbrains-a"), ("runtime", "medbrains-b"), ("dev", "medbrains-c"), ("runtime", "medbrains-d")}
    ok = {"k": set(), "b": {("runtime", "k")}, "s": {("runtime", "b")}, "o": {("runtime", "s"), ("runtime", "o2")},
          "o2": set(), "p": {("runtime", "s")}, "m": set(), "n": set(), "sh": {("runtime", "o"), ("runtime", "p")}}
    assert not problems(ok, classes, set())
    for crate, dep, kind, rule in (("o", "p", "runtime", "brick-brick"), ("o", "p", "dev", "brick-brick"), ("n", "m", "runtime", "brick-brick"),
                                   ("m", "o", "runtime", "brick-brick"), ("b", "o", "runtime", "base-domain"), ("k", "s", "runtime", "base-domain"),
                                   ("s", "p", "dev", "shared-brick")):
        bad = {**ok, crate: ok[crate] | {(kind, dep)}}
        line = f"{rule} {kind} {crate} {dep}"
        assert problems(bad, classes, set()) == [f"new edge: {line}  (remove the dependency; do not add it to the baseline)"], (crate, dep)
        assert not problems(bad, classes, read_baseline(f"# why\n{line}\n"))
        # The edge is gone but its line stayed: the list must shrink with the code.
        assert problems(ok, classes, {line})[0].startswith(f"gone: {line}")
    assert problems({**ok, "new": set()}, classes, set()) == ["new: no line in bricks/crates.txt (give it a class)"]
    assert problems({c: d for c, d in ok.items() if c != "n"}, classes, set())[0].startswith("n: in bricks/crates.txt but not")
    for bad_class in ("brick", "base:opd", "bricks:opd"):
        try:
            read_classes(f"a {bad_class}\n")
        except SystemExit:
            continue
        raise AssertionError(bad_class)
    print("✓ self-test passed")
    return 0


def main() -> int:
    """Check the workspace against the classes and the baseline; 1 on any problem."""
    if "--self-test" in sys.argv:
        return self_test()
    graph, classes = load_graph(), read_classes(CLASSES.read_text(encoding="utf-8"))
    if "--print" in sys.argv:
        print("\n".join(sorted(forbidden_edges(graph, classes))))
        return 0
    baseline = read_baseline(BASELINE.read_text(encoding="utf-8"))
    found = problems(graph, classes, baseline)
    if found:
        print("✗ brick edges (docs/architecture/MODULE-BRICKS.md, bricks/crates.txt):")
        for line in found:
            print(f"  {line}")
        return 1
    print(f"✓ {len(graph)} crates classified; {len(baseline)} baselined brick edges, none new")
    return 0


if __name__ == "__main__":
    sys.exit(main())

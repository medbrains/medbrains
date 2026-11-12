#!/usr/bin/env python3
"""A database query inside a loop is one round trip per row (ratchet).

    python3 scripts/check_query_in_loop.py                    # triage report
    python3 scripts/check_query_in_loop.py --check            # CI: fail on new sites
    python3 scripts/check_query_in_loop.py --update-baseline  # after fixing some
    python3 scripts/check_query_in_loop.py --self-test

A ward list of 100 patients that looks each one up separately makes 100 round
trips where one `ANY($1)`, `JOIN` or CTE would do. Tests seeded with three rows
never notice; a real hospital does (#5462).

A *site* is one `sqlx::query*` call (function or macro) that sits inside the
body of a `for`/`while`/`loop` block or an `.iter().map(..)`-style closure,
in non-test code under `crates/*/src`. Each site is triaged:

    real       a read inside a loop in a request handler: the N+1 this hunts
    write      an insert/update/delete per item: batchable with UNNEST, but the
               row count is usually the size of one form, not of a table
    background seed, migration, worker, job, simulator or CLI: off the request
               path, so the loop costs a job seconds, not a clinician a wait

The baseline holds the per-function site counts when the check arrived;
`--check` fails when a function gains a site, and reports functions that lost
theirs so the baseline can shrink. The per-request proof is the query budget
test (`crates/medbrains-server/tests/query_budget_test.rs`): this script finds
suspects, the test proves a list stays flat.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CRATES = os.path.join(ROOT, "crates")
BASELINE = os.path.join(ROOT, "scripts", "query_in_loop.baseline.json")

# One level of nested parentheses: `(a, f(b))`.
ARGS = r"\((?:[^()]|\([^()]*\))*\)"
LOOP_HEAD = re.compile(
    r"\bfor\s+[^;{}]+?\s+in\s+[^;{]+\{"
    r"|\bwhile\b[^;{]*\{"
    r"|\bloop\s*\{"
    # rows.iter().map(..), ids.into_iter().enumerate().map(..),
    # stream::iter(ids).then(..): any adapters between source and closure.
    r"|(?:\.(?:iter|into_iter|iter_mut|par_iter)\(\)|\bstream::iter" + ARGS + r")"
    r"(?:\s*\.\w+" + ARGS + r")*?"
    r"\s*\.(?:map|for_each|filter_map|flat_map|then|and_then|fold|try_fold|try_for_each|"
    r"for_each_concurrent)\s*\("
)
QUERY = re.compile(r"\bsqlx::query(?:_as|_scalar|_with|_as_with|_scalar_with)?(?:!|::<|\()")
WRITE = re.compile(r"\b(?:INSERT|UPDATE|DELETE)\b|\.execute\(")
FN = re.compile(r"\bfn\s+([A-Za-z_][A-Za-z0-9_]*)")
# `impl X {`, `impl<T> Tr for X<T> {`, `trait X {`: the name a method is keyed under.
IMPL = re.compile(
    r"\b(?:impl\b(?:\s*<[^{;]*?>)?\s+(?:[^{;]*?\bfor\s+)?|trait\s+)([A-Za-z_]\w*)[^{;]*\{"
)
BACKGROUND = re.compile(
    r"(?:^|[/_-])(?:seed\w*|migrat\w*|workers?|jobs?|cron|backfill|simulator|loadtest|bin|cli|"
    r"bench|scheduler|listener|outbox|replay|daemon)(?:[/_.-]|$)"
)
RAW = re.compile(r'(?<![A-Za-z0-9_])b?r(#*)"')
CHAR = re.compile(r"'(?:\\.|\\u\{[0-9a-fA-F]+\}|[^\\'])'")
TEST_MOD = re.compile(r"#\[cfg\(test\)\]\s*(?:pub\s+)?mod\s+\w+\s*\{")


def rust_files() -> list[str]:
    """Every non-vendored Rust source file under `crates/*/src`."""
    out = []
    for crate in sorted(os.listdir(CRATES)):
        src = os.path.join(CRATES, crate, "src")
        for dirpath, _, files in os.walk(src):
            out.extend(os.path.join(dirpath, f) for f in sorted(files) if f.endswith(".rs"))
    return out


def mask(src: str) -> str:
    """`src` with comments and string/char contents blanked, offsets kept.

    Loop heads and braces are then found in code only: a doc comment saying
    "for a patient in the ward {" or SQL carrying `{where}` holes is not a loop.
    """
    out = list(src)
    i, n = 0, len(src)

    def blank(a: int, b: int) -> None:
        """Space out `src[a:b]`, keeping newlines so line numbers still match."""
        for k in range(a, min(b, n)):
            if out[k] != "\n":
                out[k] = " "

    while i < n:
        c = src[i]
        if src.startswith("//", i):
            j = src.find("\n", i)
            j = n if j < 0 else j
            blank(i, j)
            i = j
        elif src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            blank(i, j)
            i = j
        elif (m := RAW.match(src, i)) is not None:
            j = src.find('"' + m.group(1), m.end())
            j = n if j < 0 else j
            blank(m.end(), j)
            i = j + 1 + len(m.group(1))
        elif c == '"':
            j = i + 1
            while j < n and src[j] != '"':
                j += 2 if src[j] == "\\" else 1
            blank(i + 1, j)
            i = j + 1
        elif c == "'" and (m := CHAR.match(src, i)) is not None:
            blank(i + 1, m.end() - 1)
            i = m.end()
        else:
            i += 1
    return "".join(out)


def block_end(code: str, open_at: int) -> int:
    """Index of the bracket closing the one at `open_at` in masked `code`."""
    opener = code[open_at]
    closer = {"{": "}", "(": ")"}[opener]
    depth = 0
    for i in range(open_at, len(code)):
        if code[i] == opener:
            depth += 1
        elif code[i] == closer:
            depth -= 1
            if depth == 0:
                return i
    return len(code)


def strip_tests(code: str) -> str:
    """Blank out `#[cfg(test)] mod … { }` in masked `code`: test loops don't count."""
    for m in reversed(list(TEST_MOD.finditer(code))):
        end = block_end(code, m.end() - 1)
        code = code[: m.start()] + " " * (end + 1 - m.start()) + code[end + 1 :]
    return code


def triage(rel: str, call: str) -> str:
    """Classify one site as `real`, `write` or `background` (see module doc).

    A read in a helper with no handler signature still counts as `real`: the
    helpers are what the handlers call per row.
    """
    if BACKGROUND.search(rel.lower()):
        return "background"
    return "write" if WRITE.search(call) else "real"


def loop_spans(code: str) -> list[tuple[int, int]]:
    """`(start, end)` of every loop body and iterator closure in masked `code`."""
    return [(m.end(), block_end(code, m.end() - 1)) for m in LOOP_HEAD.finditer(code)]


def owner_of(code: str, at: int) -> str:
    """The function enclosing offset `at`, as `Type::fn` inside an impl or trait.

    Bare `fn` names collide: two `impl` blocks in one file can each have a
    `list`, and the ratchet would merge their counts.
    """
    fns = [m for m in FN.finditer(code, 0, at)]
    if not fns:
        return "<module>"
    fn = fns[-1]
    impls = [
        m.group(1)
        for m in IMPL.finditer(code, 0, fn.start())
        if block_end(code, m.end() - 1) > fn.start()
    ]
    return f"{impls[-1]}::{fn.group(1)}" if impls else fn.group(1)


def scan() -> list[tuple[str, int, str, str]]:
    """Every site as `(file, line, enclosing fn, verdict)`."""
    sites = []
    for path in rust_files():
        rel = os.path.relpath(path, ROOT)
        src = open(path, encoding="utf-8").read()
        code = strip_tests(mask(src))
        spans = loop_spans(code)
        for q in QUERY.finditer(code):
            if not any(s <= q.start() <= e for s, e in spans):
                continue
            name = owner_of(code, q.start())
            verdict = triage(rel, src[q.start() : q.start() + 600])
            sites.append((rel, src.count("\n", 0, q.start()) + 1, name, verdict))
    return sites


def per_function(sites: list[tuple[str, int, str, str]]) -> dict[str, int]:
    """Site count keyed `file::fn` — the unit the ratchet holds steady."""
    return dict(sorted(Counter(f"{s[0]}::{s[2]}" for s in sites).items()))


def sites_in(code_text: str) -> int:
    """Query sites inside loops in one snippet (the self-test's probe)."""
    code = strip_tests(mask(code_text))
    spans = loop_spans(code)
    return sum(any(s <= q.start() <= e for s, e in spans) for q in QUERY.finditer(code))


def self_test() -> None:
    """Fail if the scanner stops telling a loop body from text that mentions one."""
    assert sites_in("for id in ids { sqlx::query(\"SELECT 1\").fetch_one(&mut *tx).await?; }") == 1
    assert sites_in("let v: Vec<_> = rows.iter().map(|r| sqlx::query!(\"x\")).collect();") == 1
    assert sites_in("/// for a patient in the ward {\nfn f() { sqlx::query(\"SELECT {x}\"); }") == 0
    assert sites_in("let s = \"for x in y {\"; sqlx::query(\"a\");") == 0
    assert sites_in("#[cfg(test)]\nmod tests { fn t() { for a in b { sqlx::query(\"q\"); } } }") == 0
    assert sites_in("ids.into_iter().enumerate().map(|(i, id)| sqlx::query(\"q\"))") == 1
    assert sites_in("stream::iter(ids).then(|id| async move { sqlx::query(\"q\") })") == 1
    assert sites_in("rows.iter().filter(|r| r.ok(1)).map(|r| sqlx::query(\"q\"))") == 1
    two = "impl A { fn list() {} }\nimpl<T> Tr for B<T> { fn list() { x } }"
    assert owner_of(mask(two), two.index("x")) == "B::list"
    assert owner_of(mask(two), two.index("{} }")) == "A::list"
    print("self-test passed")


def main() -> int:
    """Report, check against, or rewrite the baseline."""
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--update-baseline", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        self_test()
        return 0
    sites = scan()
    counts = per_function(sites)

    if args.update_baseline:
        with open(BASELINE, "w", encoding="utf-8") as fh:
            json.dump(counts, fh, indent=1)
            fh.write("\n")
        print(f"baseline written: {len(sites)} sites in {len(counts)} functions")
        return 0

    if not args.check:
        for rel, line, name, verdict in sites:
            print(f"{verdict:10} {rel}:{line}  {name}")
        tally = Counter(s[3] for s in sites)
        print(f"\n{len(sites)} sites: " + ", ".join(f"{k} {v}" for k, v in sorted(tally.items())))
        return 0

    with open(BASELINE, encoding="utf-8") as fh:
        baseline: dict[str, int] = json.load(fh)
    grew = {k: v for k, v in counts.items() if v > baseline.get(k, 0)}
    shrank = {k for k, v in baseline.items() if counts.get(k, 0) < v}
    for key, n in grew.items():
        print(f"NEW  {key}: {n} queries in a loop (baseline {baseline.get(key, 0)}) — "
              "batch with ANY($1), a JOIN or a CTE")
    for key in sorted(shrank):
        print(f"FIXED  {key} — shrink the baseline (--update-baseline)")
    if grew:
        return 1
    print(f"query-in-loop: {len(sites)} sites, none new")
    return 0


if __name__ == "__main__":
    sys.exit(main())

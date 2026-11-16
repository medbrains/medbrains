#!/usr/bin/env python3
"""Rust functions and files may only shrink (ratchet, class A size rules).

    python3 scripts/check_rust_size.py                 # CI: fail when anything grew
    python3 scripts/check_rust_size.py FILE...         # the edit hook: only these files
    python3 scripts/check_rust_size.py --tighten       # write the lower numbers after a refactor
    python3 scripts/check_rust_size.py --update        # owner only: accept today's numbers
    python3 scripts/check_rust_size.py --self-test

Rules (docs/SOFTWARE-CLASSES.md): a function body is at most 60 lines of code and a file at most
300. It measures non-test code under crates/*/src: tests/ is left out, and so is each item a
`#[cfg(test)]` applies to (a module's braces, one fn, impl or `use`), and a file under
`#![cfg(test)]`; code after a test module still counts. Strings, character literals and comments
(nested block comments too) are removed before braces are counted, so `format!("{}")` cannot skew
a length; blank and comment-only lines are not counted. `extern "C" fn`, `default fn` and body
text on the line of the opening brace count. Known limit: lines inside a multi-line string count
as blank, which can only undercount.

Today's code breaks these many times, so each file has a baseline: the lines its functions run
over 60 and its length if over 300. A file fails when either grows. Totals, not counts, so
splitting a long function passes and a new long function fails. `--tighten` only lowers numbers;
raising one takes `--update`, the owner's call. A file moved with git keeps its allowance where
main's history is present (ponytail: CI's shallow checkout has none, so a move there needs
`--update`; fetch the history if moves become common). This is the Rust twin of check_web_size.py.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
BASELINE = os.path.join(ROOT, "scripts", "rust_size.baseline.json")
MAX_FUNCTION_LINES = 60
MAX_FILE_LINES = 300
FN_RE = re.compile(
    r"^\s*(?:pub(?:\([^)]*\))?\s+)?(?:default\s+)?(?:const\s+)?(?:async\s+)?(?:unsafe\s+)?"
    r'(?:extern\s+(?:"[^"]*"\s*)?)?fn\s+\w+'
)
# A string, raw string or char literal; anything else starting with ' is a lifetime.
LITERAL_RE = re.compile(
    r'b?r(#*)"(?:.|\n)*?"\1|b?"(?:\\.|[^"\\])*"|b?\'(?:\\u\{[0-9a-fA-F]+\}|\\.|[^\\\'\n])\'',
    re.DOTALL,
)


def block_comment_end(text: str, i: int) -> int:
    """The index just past the block comment opening at `i`; Rust block comments nest."""
    depth, n = 0, len(text)
    while i < n:
        pair = text[i : i + 2]
        if pair == "/*":
            depth, i = depth + 1, i + 2
        elif pair == "*/":
            depth, i = depth - 1, i + 2
            if depth == 0:
                return i
        else:
            i += 1
    return n


def strip(text: str) -> str:
    """The source with comments, strings and char literals blanked, line breaks kept.

    A scanner, not one regex, because block comments nest and a regex cannot count depth.
    """
    out, i, n = [], 0, len(text)
    while i < n:
        if text.startswith("//", i):
            j = text.find("\n", i)
            i = n if j < 0 else j
            continue
        if text.startswith("/*", i):
            j = block_comment_end(text, i)
        else:
            m = LITERAL_RE.match(text, i) if text[i] in "\"'br" else None
            if m is None or (text[i] in "br" and i and (text[i - 1].isalnum() or text[i - 1] == "_")):
                out.append(text[i])
                i += 1
                continue
            j = m.end()
        out.append("\n" * text.count("\n", i, j))
        i = j
    return "".join(out)


def item_end(code: str, i: int) -> int:
    """The index just past the item starting at `i`: its closing brace, or its `;` outside brackets."""
    braces = parens = 0
    for j in range(i, len(code)):
        c = code[j]
        if c in "([":
            parens += 1
        elif c in ")]":
            parens -= 1
        elif c == "{":
            braces += 1
        elif c == "}":
            braces -= 1
            if braces == 0:
                return j + 1
        elif c == ";" and braces == 0 and parens == 0:
            return j + 1
    return len(code)


def non_test_lines(code: str) -> list[str]:
    """The stripped lines with each `#[cfg(test)]` item blanked: a module, fn, impl or use.

    Only the item the attribute applies to is skipped, so code after a test module still counts.
    A file-wide `#![cfg(test)]` is test code throughout.
    """
    if "#![cfg(test)]" in code:
        return []
    marker = "#[cfg(test)]"
    while (i := code.find(marker)) >= 0:
        j = item_end(code, i + len(marker))
        code = code[:i] + "\n" * code.count("\n", i, j) + code[j:]
    return code.split("\n")


def body_lines(lines: list[str], start: int, end: int) -> int:
    """Code lines in a body from the `{` on line `start` to the `}` on line `end`.

    Text after the opening brace counts, so `fn a() { x` on one line is one body line.
    """
    after = lines[start].split("{", 1)[1]
    if start == end:
        return 1 if after.rstrip().rstrip("}").strip() else 0
    return (1 if after.strip() else 0) + sum(1 for line in lines[start + 1 : end] if line.strip())


def function_excess(lines: list[str]) -> int:
    """The total lines of code that functions run over the limit; a nested fn counts with its parent."""
    excess, i = 0, 0
    while i < len(lines):
        if not FN_RE.match(lines[i]):
            i += 1
            continue
        depth, start, j = 0, None, i
        while j < len(lines):
            depth += lines[j].count("{") - lines[j].count("}")
            if start is None and "{" in lines[j]:
                start = j
            if start is None and lines[j].rstrip().endswith(";"):
                break  # a declaration with no body
            if start is not None and depth <= 0:
                break
            j += 1
        if start is not None:
            excess += max(0, body_lines(lines, start, min(j, len(lines) - 1)) - MAX_FUNCTION_LINES)
        i = j + 1
    return excess


def measure_file(path: str) -> dict[str, int]:
    """One file's numbers: function lines over 60, and its code lines if over 300."""
    with open(path, encoding="utf-8", errors="ignore") as fh:
        lines = non_test_lines(strip(fh.read()))
    code_lines = sum(1 for line in lines if line.strip())
    return {
        "function_lines": function_excess(lines),
        "file_lines": code_lines if code_lines > MAX_FILE_LINES else 0,
    }


def rust_files() -> list[str]:
    """Every tracked .rs file under crates/*/src, relative to ROOT."""
    out = subprocess.run(["git", "ls-files", "crates"], cwd=ROOT, capture_output=True, text=True, check=True)
    return [f for f in out.stdout.split() if f.endswith(".rs") and "/src/" in f and "/tests/" not in f]


def measure(files: list[str]) -> dict[str, dict[str, int]]:
    """Today's numbers for `files`, keeping only files over a limit."""
    result = {}
    for f in files:
        entry = measure_file(os.path.join(ROOT, f))
        if any(entry.values()):
            result[f] = entry
    return result


def grown(now: dict, base: dict) -> list[str]:
    """Each number above its baseline; a file with no baseline has none allowed."""
    return [
        f"{f}: {k} {v} (allowed {base.get(f, {}).get(k, 0)})"
        for f, entry in sorted(now.items())
        for k, v in entry.items()
        if v > base.get(f, {}).get(k, 0)
    ]


def tightened(now: dict, base: dict) -> dict:
    """The baseline with every number lowered to today's where today's is lower."""
    out = {}
    for f, entry in base.items():
        lower = {k: min(v, now.get(f, {}).get(k, 0)) for k, v in entry.items()}
        if any(lower.values()):
            out[f] = lower
    return out


def relative(arg: str) -> str | None:
    """`arg` relative to ROOT when it is a measured Rust file, else None."""
    rel = os.path.relpath(os.path.realpath(arg), ROOT)
    ok = rel.startswith("crates" + os.sep) and rel.endswith(".rs") and "/src/" in rel and "/tests/" not in rel
    return rel if ok else None


def renames() -> dict[str, str]:
    """New path → old path for files this branch moved, against its merge base with main."""
    base = subprocess.run(["git", "merge-base", "HEAD", "origin/main"], cwd=ROOT, capture_output=True, text=True)
    if base.returncode != 0:
        return {}
    diff = subprocess.run(["git", "diff", "-M", "--relative", "--name-status", base.stdout.strip(), "--", "crates"],
                          cwd=ROOT, capture_output=True, text=True, check=False)
    moved = {}
    for line in diff.stdout.splitlines():
        parts = line.split("\t")
        if parts[0].startswith("R") and len(parts) == 3:
            moved[parts[2]] = parts[1]
    return moved


def load_baseline(must_exist: bool) -> dict[str, dict[str, int]]:
    """The saved baseline, with each moved file's allowance carried to its new path."""
    if not os.path.exists(BASELINE):
        if must_exist:
            raise SystemExit(f"no baseline at {BASELINE}: the owner creates it with --update")
        return {}
    with open(BASELINE, encoding="utf-8") as fh:
        base = json.load(fh)
    return carry(base, renames())


def carry(base: dict, moved: dict[str, str]) -> dict:
    """`base` with each moved file's allowance copied to its new path, so a `git mv` is not growth."""
    for new, old in moved.items():
        if old in base and new not in base:
            base[new] = base[old]
    return base


def excess_of(src: str) -> int:
    """Function lines over the limit in a source sample, for the self-test."""
    return function_excess(non_test_lines(strip(src)))


def self_test() -> None:
    """The counting rules on small samples; each review finding has a case that failed before its fix."""
    long_body = "\n".join(f"    let x{n} = {n};" for n in range(70))
    src = f'fn a() {{\n    let s = format!("{{}} }} {{");\n{long_body}\n}}\nfn b();\n'
    assert excess_of(src) == 71 - 60, "braces in strings must not count; the 71 lines are"
    assert excess_of("fn short() {\n    1\n}\n") == 0
    assert excess_of("fn t() {\n" + long_body + "\n}\n") > 0
    with_test = "fn a() {}\n#[cfg(test)]\nmod tests {\n" + long_body + "\n}\n"
    assert not any(line.strip() for line in non_test_lines(strip(with_test))[1:]), "test modules are left out"
    after_test = "#[cfg(test)]\nmod tests {\n    fn x() {}\n}\nfn real() {\n" + long_body + "\n}\n"
    assert excess_of(after_test) == 10, "code after a test module counts"
    test_fn = "#[cfg(test)]\nfn helper(x: [u8; 4]) {\n" + long_body + "\n}\nfn real() {\n" + long_body + "\n}\n"
    assert excess_of(test_fn) == 10, "only the one cfg(test) fn is skipped"
    assert excess_of("#[cfg(test)]\nuse std::fmt;\nfn real() {\n" + long_body + "\n}\n") == 10
    assert excess_of('pub extern "C" fn c() {\n' + long_body + "\n}\n") == 10, "extern \"C\" fn counts"
    assert excess_of("extern fn c() {\n" + long_body + "\n}\n") == 10, "extern fn counts"
    assert excess_of("default fn d() {\n" + long_body + "\n}\n") == 10, "default fn counts"
    nested = "fn n() {\n    /* a /* b */ } */\n" + long_body + "\n}\n"
    assert excess_of(nested) == 10, "a nested block comment ends at its own */"
    assert strip("/* a\n/* b */\n*/x").count("\n") == 2, "comments keep their line breaks"
    same_line = "fn s() { let first = 0;\n" + long_body + "\n}\n"
    assert excess_of(same_line) == 11, "body text on the opening line counts"
    assert excess_of("fn l<'a>(x: &'a str) -> char {\n" + long_body + "\n    let c = '}';\n}\n") == 11, "lifetimes are not char literals"
    base = {"a.rs": {"function_lines": 500, "file_lines": 900}}
    assert grown({"a.rs": {"function_lines": 450, "file_lines": 900}}, base) == []
    assert grown({"b.rs": {"function_lines": 1, "file_lines": 0}}, base)
    assert tightened({}, base) == {}
    moved = carry(dict(base), {"c.rs": "a.rs"})
    assert grown({"c.rs": {"function_lines": 500, "file_lines": 900}}, moved) == [], "a moved file keeps its allowance"
    print("rust-size self-test: ok")


def main(argv: list[str]) -> int:
    """Check, tighten or rewrite the baseline, for all Rust files or the ones given."""
    if "--self-test" in argv:
        self_test()
        return 0
    args = [a for a in argv if not a.startswith("--")]
    if args and ("--update" in argv or "--tighten" in argv):
        raise SystemExit("--update and --tighten work on every file; give no file names")
    files = sorted({f for f in map(relative, args) if f}) if args else rust_files()
    base = load_baseline(must_exist="--update" not in argv)
    now = measure(files)
    if "--update" in argv or "--tighten" in argv:
        new = now if "--update" in argv else tightened(now, base)
        with open(BASELINE, "w", encoding="utf-8") as fh:
            json.dump(dict(sorted(new.items())), fh, indent=1)
            fh.write("\n")
        print(f"rust-size: baseline {'rewritten' if '--update' in argv else 'tightened'}, {len(new)} files")
        return 0
    problems = grown(now, base)
    for p in problems:
        print(f"GREW  {p}: split the function or file; never raise the baseline to pass")
    if problems:
        return 1
    print(f"rust-size: {len(files)} files checked, nothing grew")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

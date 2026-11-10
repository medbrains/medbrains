#!/usr/bin/env python3
"""Every function added or changed in a diff must have a doc comment.

    python3 medbrains/scripts/check_docs_on_new_functions.py [base]   # default origin/main
    python3 medbrains/scripts/check_docs_on_new_functions.py --self-test

ENGINEERING.md, "Document Everything". Only added lines are checked, so the
existing code gets documented as it is touched rather than all at once.
Tests and generated files are exempt; their names and sources say what they do.
"""

import re
import subprocess
import sys
from pathlib import Path

RUST = re.compile(r"^\s*(pub(\([^)]*\))?\s+)?(const\s+)?(async\s+)?(unsafe\s+)?fn\s+\w+")
TS = re.compile(
    r"^\s*(export\s+)?(default\s+)?(async\s+)?function\s+\w+"
    r"|^\s*(export\s+)?const\s+\w+\s*(:[^=]+)?=\s*(async\s+)?(\([^)]*\)|\w+)\s*(:[^=]+)?=>"
)
SWIFT = re.compile(r"^\s*((public|private|internal|fileprivate|open|static|override|mutating)\s+)*func\s+\w+")
KOTLIN = re.compile(r"^\s*((public|private|internal|protected|override|suspend|inline)\s+)*fun\s+(<[^>]+>\s+)?[\w.]+\(")
PYTHON = re.compile(r"^\s*(async\s+)?def\s+\w+")

# The doc comment marker for each language; Python's docstring sits below the def.
LANGUAGES = {
    ".rs": (RUST, ("///", "//!")),
    ".ts": (TS, ("*/", "//")),
    ".tsx": (TS, ("*/", "//")),
    ".swift": (SWIFT, ("///", "*/")),
    ".kt": (KOTLIN, ("*/", "//")),
    ".py": (PYTHON, ()),
}
ATTRIBUTE = re.compile(r"^\s*(#\[|@)")
EXEMPT_PATH = re.compile(
    r"(^|/)(tests?|e2e|__tests__|androidTest|vendor|node_modules|generated|build\.rs$)"
    r"|\.(test|spec)\.tsx?$|Tests?\.(swift|kt)$|_test\.py$|(^|/)test_[^/]*\.py$"
    r"|(^|/)apps/(mobile-[^/]*|tv)/|^r8r/|packages/types/src/permissions\.ts$"
)
TRAIT_IMPL = re.compile(r"^\s*impl\b.*\bfor\b")


def has_doc(lines: list[str], index: int, suffix: str) -> bool:
    """Whether the function at `index` carries a doc comment for its language."""
    if suffix == ".py":
        # A signature may span lines; the docstring follows the line ending in ":".
        for i in range(index, min(index + 12, len(lines))):
            if lines[i].rstrip().endswith(":"):
                following = lines[i + 1].strip() if i + 1 < len(lines) else ""
                return following.startswith(('"""', "'''"))
        return False
    i = index - 1
    while i >= 0 and ATTRIBUTE.match(lines[i]):
        i -= 1
    return i >= 0 and lines[i].strip().startswith(LANGUAGES[suffix][1]) or (
        i >= 0 and lines[i].strip().endswith("*/")
    )


def is_exempt_rust(lines: list[str], index: int) -> bool:
    """A test, or a trait method documented by its trait, needs no comment of its own."""
    if any("#[test]" in line or "#[tokio::test" in line for line in lines[max(0, index - 3) : index]):
        return True
    for i in range(index - 1, -1, -1):
        if re.match(r"^(impl|mod|pub mod|trait|pub trait)\b", lines[i]):
            return bool(TRAIT_IMPL.match(lines[i]) or re.match(r"^(pub )?mod tests?\b", lines[i]))
    return False


def undocumented(lines: list[str], added: set[int], suffix: str) -> list[int]:
    """1-based numbers of added lines that declare a function with no doc comment."""
    pattern = LANGUAGES[suffix][0]
    found = []
    for number in sorted(added):
        index = number - 1
        if index >= len(lines) or not pattern.match(lines[index]):
            continue
        if suffix == ".rs" and is_exempt_rust(lines, index):
            continue
        if not has_doc(lines, index, suffix):
            found.append(number)
    return found


def added_lines(base: str) -> dict[str, set[int]]:
    """Map each changed file to the line numbers the diff from `base` adds."""
    diff = subprocess.run(
        ["git", "diff", "--unified=0", "--no-color", f"{base}...HEAD"],
        capture_output=True, text=True, check=True,
    ).stdout
    result: dict[str, set[int]] = {}
    path = None
    for line in diff.splitlines():
        if line.startswith("+++ "):
            path = line[6:] if line.startswith("+++ b/") else None
        elif line.startswith("@@") and path:
            match = re.search(r"\+(\d+)(?:,(\d+))?", line)
            start, count = int(match.group(1)), int(match.group(2) or 1)
            result.setdefault(path, set()).update(range(start, start + count))
    return result


def self_test() -> None:
    """Fail loudly if the detection above stops telling documented from undocumented."""
    rust = ["/// Adds.", "#[inline]", "pub fn add() {}", "fn bare() {}", "impl Foo for Bar {", "    fn t() {}", "}"]
    assert undocumented(rust, {3, 4, 6}, ".rs") == [4]
    assert undocumented(["mod tests {", "    fn helper() {}", "}"], {2}, ".rs") == []
    ts = ["/** Adds. */", "export function add() {}", "export const bare = (a: number) => a;", "const x = 1;"]
    assert undocumented(ts, {2, 3, 4}, ".ts") == [3]
    py = ["def good(", "    a,", "):", '    """Doc."""', "def bad():", "    return 1"]
    assert undocumented(py, {1, 5}, ".py") == [5]
    swift = ["/// Adds.", "public func add() {}", "func bare() {}"]
    assert undocumented(swift, {2, 3}, ".swift") == [3]
    kotlin = ["/** Adds. */", "@Composable", "fun Add() {}", "private fun bare() {}"]
    assert undocumented(kotlin, {3, 4}, ".kt") == [4]
    assert EXEMPT_PATH.search("apps/web/src/a.test.ts") and not EXEMPT_PATH.search("apps/web/src/a.ts")
    print("self-test passed")


def main() -> int:
    """Report every undocumented function the diff adds; non-zero if any."""
    if "--self-test" in sys.argv:
        self_test()
        return 0
    base = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
    failures = []
    for path, added in added_lines(base).items():
        suffix = Path(path).suffix
        if suffix not in LANGUAGES or EXEMPT_PATH.search(path) or not Path(path).exists():
            continue
        lines = Path(path).read_text(encoding="utf-8").splitlines()
        failures += [f"{path}:{number}" for number in undocumented(lines, added, suffix)]
    for failure in failures:
        print(f"no doc comment: {failure}")
    if failures:
        print(f"\n{len(failures)} function(s) need a doc comment saying what it does and why.")
        return 1
    print("every new function is documented")
    return 0


if __name__ == "__main__":
    sys.exit(main())

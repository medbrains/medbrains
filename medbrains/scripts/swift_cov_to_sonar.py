#!/usr/bin/env python3
"""Turn a SwiftPM llvm-cov JSON export into SonarQube's generic coverage XML.

SonarCloud reads Swift coverage only in its generic format, and `swift test
--enable-code-coverage` writes llvm-cov's JSON. Usage:

    swift_cov_to_sonar.py <codecov.json> <repo-root> <out.xml>

Only files under the repository's `Sources/` folders are kept, so test files and
dependencies never count. Paths are written relative to the repository root.
"""

import json
import sys
from pathlib import Path
from xml.sax.saxutils import quoteattr


def covered_lines(segments: list) -> dict[int, bool]:
    """Line -> covered, from llvm-cov segments [line, col, count, has_count, is_entry, ...].

    A line counts when a counted segment starts on it; covered when any such segment ran.
    """
    lines: dict[int, bool] = {}
    for seg in segments:
        line, count, has_count = seg[0], seg[2], seg[3]
        if has_count:
            lines[line] = lines.get(line, False) or count > 0
    return lines


def to_xml(export: dict, root: Path) -> str:
    """The generic coverage XML for every `Sources/` file in an llvm-cov export."""
    out = ['<coverage version="1">']
    for f in export["data"][0]["files"]:
        path = Path(f["filename"]).resolve()
        if "/Sources/" not in path.as_posix():
            continue
        rel = path.relative_to(root.resolve()).as_posix()
        out.append(f"  <file path={quoteattr(rel)}>")
        for line, hit in sorted(covered_lines(f["segments"]).items()):
            out.append(f'    <lineToCover lineNumber="{line}" covered="{str(hit).lower()}"/>')
        out.append("  </file>")
    out.append("</coverage>")
    return "\n".join(out) + "\n"


def self_check() -> None:
    """One run line and one never-run line must come out as covered and uncovered."""
    segs = [[3, 1, 2, True, True], [3, 9, 0, True, False], [5, 1, 0, True, True], [6, 1, 0, False, False]]
    assert covered_lines(segs) == {3: True, 5: False}


if __name__ == "__main__":
    self_check()
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    src, repo, dst = sys.argv[1], Path(sys.argv[2]), sys.argv[3]
    Path(dst).write_text(to_xml(json.loads(Path(src).read_text()), repo))

#!/usr/bin/env python3
"""Check source file lengths against a configurable line cap."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys


DEFAULT_SUFFIXES = {".rs", ".ts", ".tsx", ".scss"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Report files whose line counts exceed the configured maximum."
    )
    parser.add_argument(
        "paths",
        nargs="+",
        help="Files or directories to scan.",
    )
    parser.add_argument(
        "--max-lines",
        type=int,
        default=450,
        help="Maximum allowed line count per file.",
    )
    parser.add_argument(
        "--suffix",
        action="append",
        dest="suffixes",
        help="Limit scanning to a file suffix. Can be passed multiple times.",
    )
    return parser.parse_args()


def iter_source_files(paths: list[str], suffixes: set[str]) -> list[Path]:
    files: list[Path] = []
    for raw_path in paths:
        path = Path(raw_path)
        if not path.exists():
            raise FileNotFoundError(f"Path does not exist: {path}")
        if path.is_file():
            if path.suffix in suffixes:
                files.append(path)
            continue
        files.extend(
            file_path
            for file_path in path.rglob("*")
            if file_path.is_file() and file_path.suffix in suffixes
        )
    return sorted(files)


def count_lines(path: Path) -> int:
    with path.open("r", encoding="utf-8") as handle:
        return sum(1 for _ in handle)


def main() -> int:
    args = parse_args()
    suffixes = set(args.suffixes or DEFAULT_SUFFIXES)

    try:
        source_files = iter_source_files(args.paths, suffixes)
    except FileNotFoundError as error:
        print(error, file=sys.stderr)
        return 2

    offenders: list[tuple[int, Path]] = []
    for source_file in source_files:
        line_count = count_lines(source_file)
        if line_count > args.max_lines:
            offenders.append((line_count, source_file))

    if not offenders:
        print(
            f"All {len(source_files)} checked files are at or below {args.max_lines} lines."
        )
        return 0

    print(f"Found {len(offenders)} files over {args.max_lines} lines:")
    for line_count, source_file in offenders:
        print(f"{line_count:>5}  {source_file}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

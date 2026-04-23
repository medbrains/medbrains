#!/usr/bin/env python3
"""
QA Coverage Report — reads YAML test cases and reports coverage matrix.

Usage: python3 qa/coverage-report.py
"""

import os
import sys
import yaml
from pathlib import Path
from collections import Counter

QA_DIR = Path(__file__).parent / "test-cases"

def load_test_cases():
    cases = []
    for yml_file in sorted(QA_DIR.glob("*.yml")):
        with open(yml_file) as f:
            data = yaml.safe_load(f)
        module = data.get("module", yml_file.stem)
        for test in data.get("tests", []):
            test["_module"] = module
            test["_file"] = yml_file.name
            cases.append(test)
    return cases

def check_file_exists(test_file):
    if not test_file:
        return False
    # Extract file path (before ::)
    path = test_file.split("::")[0]
    return os.path.exists(path)

def main():
    cases = load_test_cases()
    if not cases:
        print("No test cases found in qa/test-cases/")
        sys.exit(1)

    # Stats
    total = len(cases)
    by_layer = Counter(c.get("layer", "?") for c in cases)
    by_priority = Counter(c.get("priority", "?") for c in cases)
    by_module = Counter(c["_module"] for c in cases)

    automated = [c for c in cases if c.get("automated")]
    manual = [c for c in cases if not c.get("automated")]
    with_file = [c for c in automated if c.get("test_file")]
    file_exists = [c for c in with_file if check_file_exists(c["test_file"])]

    print("=" * 60)
    print("  MedBrains QA Coverage Report")
    print("=" * 60)
    print()

    print(f"  Total test cases:  {total}")
    print(f"  Automated:         {len(automated)} ({len(automated)*100//total}%)")
    print(f"  Manual:            {len(manual)}")
    print(f"  With test file:    {len(with_file)}")
    print(f"  File exists:       {len(file_exists)}")
    print()

    # By layer
    print("  By Layer:")
    for layer, count in sorted(by_layer.items()):
        bar = "█" * (count * 2)
        print(f"    {layer:8s}  {count:3d}  {bar}")
    print()

    # By priority
    print("  By Priority:")
    for prio, count in sorted(by_priority.items()):
        bar = "█" * (count * 2)
        print(f"    {prio:4s}  {count:3d}  {bar}")
    print()

    # By module
    print("  By Module:")
    for mod, count in sorted(by_module.items()):
        auto = sum(1 for c in cases if c["_module"] == mod and c.get("automated"))
        print(f"    {mod:15s}  {count:3d} cases  ({auto} automated)")
    print()

    # Missing automation
    missing = [c for c in cases if c.get("automated") and c.get("test_file") and not check_file_exists(c["test_file"])]
    if missing:
        print("  Missing Test Files (automated but file not found):")
        for c in missing:
            print(f"    [{c['id']}] {c['test_file']}")
        print()

    # Not yet automated P0s
    p0_manual = [c for c in cases if c.get("priority") == "P0" and not c.get("automated")]
    if p0_manual:
        print("  P0 Cases Not Yet Automated:")
        for c in p0_manual:
            print(f"    [{c['id']}] {c['summary']}")
        print()

    print("=" * 60)

if __name__ == "__main__":
    main()

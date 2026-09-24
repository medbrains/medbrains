#!/usr/bin/env python3
"""Per-platform native test report: one table per run, with failure text.

  scripts/native_test_report.py ios  <bundle.xcresult>
  scripts/native_test_report.py android <androidTest-results dir>

A run is read before anything is called passing; a combined count hides
which platform failed and why.
"""
import glob
import json
import os
import subprocess
import sys
import xml.etree.ElementTree as ET


def ios(bundle: str) -> int:
    raw = subprocess.run(["xcrun", "xcresulttool", "get", "test-results", "tests", "--path", bundle], capture_output=True, text=True).stdout
    data = json.loads(raw or "{}")
    rows = []

    def walk(node, suite=""):
        kind = node.get("nodeType")
        name = node.get("name", "")
        if kind == "Test Case":
            rows.append((suite, name, node.get("result", "?"), node.get("duration", ""), [c.get("name", "") for c in node.get("children", []) if c.get("nodeType") == "Failure Message"]))
        for c in node.get("children", []):
            walk(c, name if kind == "Test Suite" else suite)

    for n in data.get("testNodes", []):
        walk(n)
    return table("iOS", rows)


def android(results_dir: str) -> int:
    rows = []
    for f in glob.glob(os.path.join(results_dir, "**", "*.xml"), recursive=True):
        for tc in ET.parse(f).getroot().iter("testcase"):
            fails = [(x.text or "").strip().split("\n")[0] for x in tc.findall("failure")]
            rows.append((tc.get("classname", "").split(".")[-1], tc.get("name"), "Failed" if fails else "Passed", f"{float(tc.get('time', 0)):.1f}s", fails))
    return table("Android", rows)


def table(platform: str, rows) -> int:
    print(f"\n{platform}: {len(rows)} tests, {sum(1 for r in rows if r[2] != 'Passed')} failed")
    # A run that executed nothing is not a pass. Gradle's connectedAndroidTest
    # exits 0 when its installer fails on a freshly wiped emulator: BUILD
    # SUCCESSFUL, empty results, no app on the device. Read as green twice
    # before it was caught by hand, so the report refuses to be the last word.
    if not rows:
        print(f"    ↳ NO TESTS RAN. An empty result is a failed run, not a clean one.\n"
              f"      Check the device is booted and the APKs installed; "
              f"`adb shell am instrument -w <pkg>.test/androidx.test.runner.AndroidJUnitRunner` "
              f"reports the install error that the build swallows.")
        return 1
    print(f"{'suite':<24} {'test':<62} {'result':<8} {'time':>7}")
    for suite, name, result, dur, fails in sorted(rows):
        print(f"{suite[:24]:<24} {name[:62]:<62} {result:<8} {str(dur)[:7]:>7}")
        for msg in fails:
            print(f"    ↳ {msg[:200]}")
    return 1 if any(r[2] != "Passed" for r in rows) else 0


if __name__ == "__main__":
    sys.exit({"ios": ios, "android": android}[sys.argv[1]](sys.argv[2]))

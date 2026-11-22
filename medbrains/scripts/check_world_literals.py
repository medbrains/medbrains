#!/usr/bin/env python3
"""India assumptions outside the India pack only ever go down (ratchet, #5935).

    python3 scripts/check_world_literals.py            # check (CI)
    python3 scripts/check_world_literals.py --update   # record an improvement
    python3 scripts/check_world_literals.py --count    # live total, one line
    python3 scripts/check_world_literals.py --report   # per-file triage list
    python3 scripts/check_world_literals.py --self-test

RFC-WORLD-READY §5.3. MedBrains' core assumes no country; India is one country
pack. Every rupee sign, `en-IN`, `Asia/Kolkata`, `+91`, Aadhaar, GST or NABH
literal in product code is a place a Dubai hospital silently becomes Indian.
Some are correct India rules: they move into the India pack, they do not vanish.

This counts matching lines per file and per pattern in product code (crates,
the web app, packages, iOS, Android), compared with
`scripts/world_literals.baseline.json`:

- a (file, pattern) count above its baseline FAILS; a new file starts at zero;
- a count below its baseline passes, with a note to run `--update`;
- `--update` refuses to record any rise. Raising the baseline is an owner
  decision: a hand edit of the JSON, reviewed by the owner (CODEOWNERS), with a
  DECISIONS.md row in the same PR.

Tests, fixtures, generated files and the outgoing React Native apps are
excluded by path. ALLOW lists the places an India literal is correct; adding
an entry needs a DECISIONS.md row in the same PR.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASELINE = ROOT / "scripts/world_literals.baseline.json"
SCAN = ["crates", "apps/web/src", "packages", "apps/ios", "apps/android"]
SUFFIXES = {".rs", ".ts", ".tsx", ".js", ".jsx", ".swift", ".kt"}

# Paths where an India literal is correct. Each needs a reason and a DECISIONS.md row.
ALLOW = {
    "packs/in/": "the India country pack itself (RFC-WORLD-READY §3.2)",
    "crates/medbrains-abdm/": "India's national health exchange adapter (ABDM)",
    "crates/medbrains-nhcx-callback/": "India's claims exchange adapter (NHCX)",
    "crates/medbrains-core/src/nhcx": "NHCX wire types; NHCX keeps its own IST clock by spec",
    "crates/medbrains-server/src/routes/abdm/": "ABDM HTTP routes, part of the ABDM adapter",
    "crates/medbrains-server/src/routes/nhcx_onboarding.rs": "NHCX participant onboarding, part of the NHCX adapter",
    "crates/medbrains-outbox/src/handlers/nhcx/": "NHCX outbox delivery, part of the NHCX adapter",
}

# Not product code: tests, fixtures, generated output, build trees, outgoing React Native.
EXCLUDED = re.compile(
    r"(^|/)(tests?|e2e|__tests__|__mocks__|mocks|fixtures|__fixtures__|androidTest|testkit"
    r"|generated|node_modules|target|dist|build|\.build|\.sqlx|[^/]*UITests|[^/]*Tests)/"
    r"|\.(test|spec|stories)\.[jt]sx?$|\.d\.ts$|\.generated\.|_test\.rs$|(^|/)tests?_[^/]*\.rs$"
    r"|Tests?\.(swift|kt)$|fixtures?[^/]*$"
    r"|^packages/(mobile-shell|ui-mobile|edge-rn-bindings|uniffi-rn-plugin|e2e-mobile)/"
    r"|^packages/types/src/permissions\.ts$"
)

STATES = (
    "Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chhattisgarh|Goa|Gujarat|Haryana"
    "|Himachal Pradesh|Jharkhand|Karnataka|Kerala|Madhya Pradesh|Maharashtra|Manipur"
    "|Meghalaya|Mizoram|Nagaland|Odisha|Punjab|Rajasthan|Sikkim|Tamil Nadu|Telangana"
    "|Tripura|Uttar Pradesh|Uttarakhand|West Bengal|Andaman and Nicobar|Chandigarh"
    "|Dadra and Nagar Haveli|Daman and Diu|Delhi|Jammu and Kashmir|Ladakh|Lakshadweep"
    "|Puducherry"
)
WORD = r"(?<![A-Za-z]){}(?![A-Za-z])"  # a word, where `_` and digits still separate

PATTERNS = {
    "rupee sign": re.compile(r"₹|\\u\{?20[bB]9"),
    "INR": re.compile(WORD.format("INR")),
    "en-IN": re.compile(r"\ben[-_]IN\b"),
    "Asia/Kolkata or +05:30": re.compile(r"Asia/(Kolkata|Calcutta)|\+05:30"),
    "bare toLocaleString()": re.compile(r"\.toLocale(Date|Time)?String\(\s*\)"),
    "new Intl. outside the format helpers": re.compile(r"\bnew Intl\."),
    "+91": re.compile(r"\+91(?![\d.])|\+91(?=\d{10}\b)"),
    "Aadhaar": re.compile(WORD.format("(?i:aadh?aa?r)")),
    "PIN code": re.compile(WORD.format("(?i:pin[ _-]?codes?)")),
    "Indian state names": re.compile(rf"\b({STATES})\b"),
    "GST (CGST/SGST/IGST/GSTIN)": re.compile(WORD.format("(?i:[csi]gst|utgst|gstin)")),
    "NDPS/CDSCO/Schedule H/H1/X": re.compile(
        WORD.format("(?i:ndps|cdsco)") + r"|\b(?i:schedule)[ _-]?(?:H1|H|X|h1|h|x)\b"
    ),
    "NABH": re.compile(WORD.format("(?i:nabh)")),
    "lakh/crore": re.compile(WORD.format("(?i:lakhs?|crores?)")),
}
# `new Intl.` belongs in the format helpers (RFC §4.1); everywhere else is a local copy.
INTL_HOME = "packages/utils/src/format/"


def allowed(rel: str) -> bool:
    """Whether a path is one of the places an India literal is correct."""
    return any(rel.startswith(prefix) for prefix in ALLOW)


def count_text(text: str, rel: str = "") -> dict[str, int]:
    """Matching lines per pattern in one file's text; zero counts left out."""
    out: dict[str, int] = {}
    for name, pattern in PATTERNS.items():
        if name.startswith("new Intl.") and rel.startswith(INTL_HOME):
            continue
        if not pattern.search(text):  # most files match nothing; skip the line split
            continue
        n = sum(1 for line in text.splitlines() if pattern.search(line))
        if n:
            out[name] = n
    return out


def product_files():
    """Every scanned product source file as (path, repo-relative posix path).

    Excluded directories are pruned during the walk, so node_modules and build
    trees are never read.
    """
    for top in SCAN:
        for folder, dirs, names in os.walk(ROOT / top):
            base = Path(folder).relative_to(ROOT).as_posix()
            dirs[:] = sorted(d for d in dirs if not EXCLUDED.search(f"{base}/{d}/"))
            for name in sorted(names):
                rel = f"{base}/{name}"
                if Path(name).suffix in SUFFIXES and not EXCLUDED.search(rel):
                    yield Path(folder) / name, rel


def measure() -> dict[str, dict[str, int]]:
    """Per file, per pattern counts across product code outside the allow-list."""
    out: dict[str, dict[str, int]] = {}
    for path, rel in product_files():
        if allowed(rel):
            continue
        counts = count_text(path.read_text(encoding="utf-8", errors="replace"), rel)
        if counts:
            out[rel] = counts
    return out


def totals(data: dict[str, dict[str, int]]) -> tuple[int, int]:
    """(matching lines, files) across a measurement or a baseline."""
    return sum(sum(c.values()) for c in data.values()), len(data)


def compare(now: dict, base: dict) -> tuple[list[str], list[str]]:
    """(rises, falls) between today's counts and the baseline, as readable lines."""
    rises, falls = [], []
    for rel in sorted(set(now) | set(base)):
        for name in sorted(set(now.get(rel, {})) | set(base.get(rel, {}))):
            before, after = base.get(rel, {}).get(name, 0), now.get(rel, {}).get(name, 0)
            line = f"{rel}: {name} {before} -> {after}"
            if after > before:
                rises.append(line)
            elif after < before:
                falls.append(line)
    return rises, falls


def self_test() -> None:
    """Fail if the patterns stop telling an India assumption from ordinary code."""
    c = count_text
    assert c('const fee = `₹${amount}`;') == {"rupee sign": 1}
    assert c('currency: "INR",') == {"INR": 1}
    assert c("const INR_SYMBOL = 1;\nlet x = MINR;") == {"INR": 1}
    assert c("toLocaleString('en-IN')") == {"en-IN": 1}
    assert c('let tz = "Asia/Kolkata";\nlet o = "+05:30";') == {"Asia/Kolkata or +05:30": 2}
    assert c("n.toLocaleString()") == {"bare toLocaleString()": 1}
    assert c("n.toLocaleString(locale)") == {}
    assert c("new Intl.NumberFormat(l)") == {"new Intl. outside the format helpers": 1}
    assert c("new Intl.NumberFormat(l)", INTL_HOME + "money.ts") == {}
    assert c('phone: "+91 98765 43210"') == {"+91": 1}
    assert c('let v = "+9198765432"; let w = 1+910;') == {}
    assert c('let x = "+919876543210";') == {"+91": 1}
    assert c("aadhaar_number\nAadhar card\nAADHAAR") == {"Aadhaar": 3}
    assert c("pincode: string\npinCode\nPIN code\nspinCode") == {"PIN code": 3}
    assert c('state: "Tamil Nadu"\nGoal: 1\nGoa') == {"Indian state names": 2}
    assert c("cgst_amount\nGSTIN\nbigstring\nigst") == {"GST (CGST/SGST/IGST/GSTIN)": 3}
    assert c("ndps_register\nSchedule H1\nschedule_x\nScheduleXYZ") == {"NDPS/CDSCO/Schedule H/H1/X": 3}
    assert c("NABH chapter\nnabh_ref\nnabhx") == {"NABH": 2}
    assert c("5 lakh\nCrores\nlakhs") == {"lakh/crore": 3}
    assert c('let s = "\\u{20B9}";') == {"rupee sign": 1}
    assert c("fn total(a: u32) -> u32 { a }") == {}
    assert allowed("crates/medbrains-abdm/src/lib.rs") and not allowed("crates/medbrains-billing/x.rs")
    assert EXCLUDED.search("crates/medbrains-x/tests/a.rs") and EXCLUDED.search("apps/web/src/a.test.tsx")
    assert EXCLUDED.search("apps/ios/MedBrainsStaffUITests/A.swift")
    assert EXCLUDED.search("packages/types/src/print-data.generated.ts")
    assert EXCLUDED.search("crates/x/src/tests_rules.rs") and EXCLUDED.search("crates/s/src/camp_fixtures.rs")
    assert not EXCLUDED.search("apps/web/src/pages/billing.tsx")
    assert not EXCLUDED.search("crates/medbrains-billing/src/attests.rs")
    base = {"a.ts": {"INR": 2}}
    assert compare({"a.ts": {"INR": 3}}, base)[0] == ["a.ts: INR 2 -> 3"]
    assert compare({"b.ts": {"NABH": 1}}, base)[0] == ["b.ts: NABH 0 -> 1"]
    assert compare({"a.ts": {"INR": 1}}, base) == ([], ["a.ts: INR 2 -> 1"])
    print("self-test passed")


def main() -> int:
    """Compare today's counts with the baseline; any rise fails, `--update` only lowers."""
    if "--self-test" in sys.argv:
        self_test()
        return 0
    now = measure()
    lines, files = totals(now)
    if "--count" in sys.argv:
        print(f"{lines} lines in {files} files")
        return 0
    if "--report" in sys.argv:
        for rel, counts in sorted(now.items(), key=lambda kv: -sum(kv[1].values())):
            print(f"{sum(counts.values()):4}  {rel}")
        print(f"\n{lines} lines in {files} files")
        return 0
    base = json.loads(BASELINE.read_text(encoding="utf-8")) if BASELINE.exists() else {}
    rises, falls = compare(now, base)
    if rises and base:
        print("world literals rose: use the locale profile and the format helpers, or move the rule into the India pack.")
        for r in rises:
            print(f"  {r}")
        if "--update" in sys.argv:
            print("--update records improvements only; raising the baseline is an owner decision.")
        return 1
    if "--update" in sys.argv:  # a missing baseline is seeded from the code as it stands
        BASELINE.write_text(json.dumps(now, indent=1, sort_keys=True) + "\n", encoding="utf-8")
        print(f"world-literals: baseline written, {lines} lines in {files} files")
        return 0
    if falls:
        print(f"improved in {len({f.split(':')[0] for f in falls})} files. Run with --update to lock it in.")
    base_lines, base_files = totals(base)
    print(f"world-literals: {lines} lines in {files} files (baseline {base_lines} in {base_files}), none new")
    return 0


if __name__ == "__main__":
    sys.exit(main())

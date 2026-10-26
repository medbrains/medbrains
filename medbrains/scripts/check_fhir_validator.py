#!/usr/bin/env python3
"""Run the official HL7 FHIR validator over the bundles our builders produce.

    python3 scripts/check_fhir_validator.py              # PR run: -tx n/a
    python3 scripts/check_fhir_validator.py --tx https://tx.fhir.org/r4   # nightly

Steps:
  1. Fetch validator_cli.jar and the NRCeS IG package (ndhm.in#6.5.0, which
     holds the ABDM *and* NHCX profiles), each pinned by sha256 and cached.
  2. Have the Rust tests write golden bundles (`NRCES_BUNDLE_DIR`): the 8
     ABDM record types from medbrains-fhir and the NHCX bundles from
     medbrains-facilities, all synthetic data. Cargo waits on build_guard.
  3. Add the negative fixtures (`expect-fail-*`): third-party examples known
     to be non-conformant, and a bundle a test broke on purpose.
  4. Validate; then judge: any error in a golden fails, any warning not on
     the allow-list (`fhir_validator_allowlist.json`, each with a reason)
     fails, and every negative fixture must carry at least one error.

Java is needed only here (CI and a developer's machine), never in the product.
The bundles are synthetic: tx.fhir.org sees nothing real on the nightly run.
"""

from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # medbrains/
VALIDATOR = {
    "name": "validator_cli-6.3.11.jar",
    "url": "https://github.com/hapifhir/org.hl7.fhir.core/releases/download/6.3.11/validator_cli.jar",
    "sha256": "7c676c0e9d317d1790b5a72b888a7b49d93692180d9ad6cf943d4652fce7d2e6",
}
# The same package `scripts/nrces_profile_fixture.py` extracted profiles.json
# from. NRCeS serves only its current release at this URL (packages.fhir.org
# repacks it, with another hash), so when 7.0 ships the fetch fails on the
# hash: that is the cue to re-pin, re-extract and re-validate, not to bypass.
IG = {
    "name": "ndhm.in-6.5.0.tgz",
    "url": "https://nrces.in/ndhm/fhir/r4/package.tgz",
    "sha256": "41fa99955adbd1983a235d7c7136b30f423ce34ff541d86b354d95b7704527d4",
}
NEGATIVE_DIR = ROOT / "crates/medbrains-fhir/tests/fhir-negative"
ALLOWLIST = ROOT / "scripts/fhir_validator_allowlist.json"
# One golden at least per ABDM hiType profile, per NHCX message we send, and
# the CapabilityStatement.
EXPECTED = [
    "-OPConsultRecord", "-PrescriptionRecord", "-DiagnosticReportRecord",
    "-DischargeSummaryRecord", "-ImmunizationRecord", "-WellnessRecord",
    "-HealthDocumentRecord", "-InvoiceRecord",
    "nhcx-eligibility", "nhcx-preauth", "nhcx-claim", "nhcx-task-search", "nhcx-task-reprocess",
    "nhcx-task-payment-ack", "nhcx-communication", "capability-statement",
]
FILE_EXT = "http://hl7.org/fhir/StructureDefinition/operationoutcome-file"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def fetch(spec: dict, cache: Path) -> Path:
    path = cache / spec["name"]
    if not path.exists() or sha256(path) != spec["sha256"]:
        print(f"fetching {spec['url']}")
        tmp = path.with_suffix(".part")
        with urllib.request.urlopen(spec["url"], timeout=300) as r, tmp.open("wb") as f:
            shutil.copyfileobj(r, f)
        tmp.replace(path)
    got = sha256(path)
    if got != spec["sha256"]:
        sys.exit(f"{spec['name']}: sha256 {got} != pinned {spec['sha256']}")
    return path


def emit_goldens(out: Path) -> None:
    env = {**os.environ, "NRCES_BUNDLE_DIR": str(out), "SQLX_OFFLINE": "true"}
    runs = [
        ["cargo", "test", "-q", "-p", "medbrains-fhir", "--lib", "nrces::"],
        ["cargo", "test", "-q", "-p", "medbrains-facilities", "--lib", "nhcx_golden"],
        ["cargo", "test", "-q", "-p", "medbrains-nhcx-callback", "--lib", "payment_ack"],
        ["cargo", "test", "-q", "-p", "medbrains-fhir-api", "--lib", "capability"],
    ]
    guard = ROOT / "scripts/build_guard.sh"
    for cmd in runs:
        if guard.exists() and not os.environ.get("CI"):
            subprocess.run(["bash", str(guard), "--wait"], cwd=ROOT, check=True)
        subprocess.run(cmd, cwd=ROOT, env=env, check=True)


def issues_by_file(report: dict) -> dict[str, list[dict]]:
    outcomes = (
        [e["resource"] for e in report.get("entry", [])]
        if report.get("resourceType") == "Bundle"
        else [report]
    )
    out: dict[str, list[dict]] = {}
    for oo in outcomes:
        name = next(
            (Path(x["valueString"]).name for x in oo.get("extension", []) if x["url"] == FILE_EXT),
            "?",
        )
        out[name] = oo.get("issue", [])
    return out


def message(issue: dict) -> str:
    return issue.get("details", {}).get("text", "") or issue.get("diagnostics", "")


def allowed(rules: list[dict], file: str, issue: dict) -> dict | None:
    """The allow-list entry covering this issue. An error can be allowed only
    by an `offline` entry (a code the validator cannot resolve without a
    terminology server), and those apply only to an offline run."""
    severity = "error" if issue["severity"] in ("error", "fatal") else "warning"
    return next(
        (
            r
            for r in rules
            if r["match"] in message(issue)
            and r.get("severity", "warning") == severity
            and fnmatch.fnmatch(file, r.get("files", "*"))
        ),
        None,
    )


def judge(by_file: dict[str, list[dict]], rules: list[dict]) -> list[str]:
    failures: list[str] = []
    used: set[int] = set()
    for file, issues in sorted(by_file.items()):
        errors = [i for i in issues if i["severity"] in ("error", "fatal")]
        if file.startswith("expect-fail-"):
            real = [e for e in errors if allowed(rules, file, e) is None]
            verdict = "refused" if real else "ACCEPTED"
            print(f"  {file}: {len(real)} errors ({verdict}, as it must be)")
            if not real:
                failures.append(f"{file}: a known-bad bundle passed — the gate does not bite")
            continue
        flagged = [i for i in issues if i["severity"] in ("error", "fatal", "warning")]
        new = []
        for i in flagged:
            rule = allowed(rules, file, i)
            if rule is None:
                new.append(i)
            else:
                used.add(id(rule))
        print(f"  {file}: {len(errors)} errors, {len(flagged) - len(errors)} warnings"
              f" ({len(new)} not on the allow-list)")
        for i in new:
            where = ",".join(i.get("expression", []))
            failures.append(f"{file}: {i['severity']}: {message(i)} @ {where}")
    for r in rules:
        if id(r) not in used:
            print(f"  note: allow-list entry not seen this run: {r['match']!r}")
    return failures


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("--tx", default="n/a", help="terminology server (n/a = offline)")
    ap.add_argument("--out", default=str(ROOT / "target/fhir-golden"))
    ap.add_argument("--no-emit", action="store_true", help="reuse bundles already in --out")
    args = ap.parse_args()

    cache = Path(os.environ.get("FHIR_VALIDATOR_CACHE", Path.home() / ".cache/medbrains-fhir"))
    cache.mkdir(parents=True, exist_ok=True)
    jar, ig = fetch(VALIDATOR, cache), fetch(IG, cache)

    out = Path(args.out)
    if not args.no_emit:
        shutil.rmtree(out, ignore_errors=True)
        out.mkdir(parents=True)
        emit_goldens(out)
    for f in sorted(NEGATIVE_DIR.glob("*.json")):
        shutil.copy(f, out / f"expect-fail-{f.name}")
    bundles = sorted(out.glob("*.json"))
    goldens = [b for b in bundles if not b.name.startswith("expect-fail-")]
    missing = [k for k in EXPECTED if not any(k in b.name for b in goldens)]
    if missing:
        print(f"no golden bundle was written for: {', '.join(missing)}")
        return 1

    report = out.parent / "fhir-validator-report.json"
    report.unlink(missing_ok=True)
    # A fresh temp dir per run: the validator keeps its terminology cache under
    # java.io.tmpdir, shared machine-wide, and a tx.fhir.org session id cached
    # there by an earlier run expires and then reads as errors.
    tmp = out.parent / "fhir-validator-tmp"
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    cmd = ["java", f"-Djava.io.tmpdir={tmp}", "-jar", str(jar), *map(str, bundles),
           "-version", "4.0.1", "-ig", str(ig), "-tx", args.tx, "-output", str(report)]
    print(f"validating {len(bundles)} bundles ({len(goldens)} golden), tx={args.tx}")
    subprocess.run(cmd, check=False, stdout=subprocess.DEVNULL)
    if not report.exists():
        print("validator produced no report")
        return 1
    offline = args.tx == "n/a"
    rules = [r for r in json.loads(ALLOWLIST.read_text())["allow"]
             if offline or not r.get("offline")]
    failures = judge(issues_by_file(json.loads(report.read_text())), rules)
    for f in failures:
        print(f"FAIL {f}")
    print("fhir validator: " + ("FAILED" if failures else "ok"))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Build the advisory bundle a release ships, for installs that never call out.

    python3 scripts/build_advisory_bundle.py > advisories.json

Reads the exact crate (Cargo.lock) and npm (pnpm-lock.yaml) versions this
release is built from, asks OSV (RustSec + GitHub Advisory Database) which of
them have advisories, and writes what the server's dependency check reads from
MEDBRAINS_ADVISORY_BUNDLE (default /usr/share/medbrains/advisories.json):

    {"generated_at": "...", "advisories": [{"ecosystem", "name", "version",
      "id", "summary", "severity", "fixed"}]}

The check reports a bundle older than 30 days as stale. Exits non-zero if OSV
cannot be reached: a bundle built from a failed lookup would read as "no
vulnerabilities". Parsing mirrors crates/medbrains-security-intel/build.rs.
"""

from __future__ import annotations

import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OSV = "https://api.osv.dev"
BATCH = 1000


def cargo_packages() -> set[tuple[str, str, str]]:
    out = set()
    for block in (ROOT / "Cargo.lock").read_text().split("[[package]]")[1:]:
        fields = {}
        for line in block.splitlines():
            if " = \"" in line:
                k, v = line.split(" = ", 1)
                fields[k.strip()] = v.strip().strip('"')
        if fields.get("source", "").startswith("registry+"):
            out.add(("crates.io", fields["name"], fields["version"]))
    return out


def npm_packages() -> set[tuple[str, str, str]]:
    lock = ROOT / "pnpm-lock.yaml"
    if not lock.exists():
        return set()
    section = lock.read_text().split("\npackages:\n", 1)
    out = set()
    for line in section[1].splitlines() if len(section) == 2 else []:
        if line and not line.startswith(" "):
            break
        if not line.startswith("  ") or line.startswith("   "):
            continue
        key = line.strip().rstrip(":").strip("'").split("(", 1)[0]
        name, _, version = key.rpartition("@")
        if name:
            out.add(("npm", name, version))
    return out


def post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        OSV + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def get(path: str) -> dict:
    with urllib.request.urlopen(OSV + path, timeout=60) as r:
        return json.load(r)


def fixed_version(detail: dict, name: str) -> str | None:
    for affected in detail.get("affected", []):
        if affected.get("package", {}).get("name") != name:
            continue
        for rng in affected.get("ranges", []):
            for event in rng.get("events", []):
                if "fixed" in event:
                    return event["fixed"]
    return None


def informational(detail: dict, name: str) -> str | None:
    for affected in detail.get("affected", []):
        if affected.get("package", {}).get("name") == name:
            return (affected.get("database_specific") or {}).get("informational")
    return None


def main() -> int:
    packages = sorted(cargo_packages() | npm_packages())
    hits = []
    for i in range(0, len(packages), BATCH):
        chunk = packages[i : i + BATCH]
        queries = [{"package": {"ecosystem": e, "name": n}, "version": v} for e, n, v in chunk]
        results = post("/v1/querybatch", {"queries": queries})["results"]
        if len(results) != len(chunk):
            print("OSV reply did not match the query", file=sys.stderr)
            return 1
        for pkg, result in zip(chunk, results):
            hits += [(pkg, v["id"]) for v in result.get("vulns", [])]
    details: dict[str, dict] = {}
    advisories = []
    for (eco, name, version), vid in hits:
        detail = details.setdefault(vid, get(f"/v1/vulns/{vid}"))
        advisories.append({
            "ecosystem": eco,
            "name": name,
            "version": version,
            "id": vid,
            "summary": detail.get("summary", ""),
            "severity": detail.get("database_specific", {}).get("severity"),
            # RustSec notices (unmaintained, unsound) carry no severity.
            "informational": informational(detail, name),
            "fixed": fixed_version(detail, name),
        })
    json.dump(
        {"generated_at": datetime.now(timezone.utc).isoformat(), "advisories": advisories},
        sys.stdout,
        indent=1,
    )
    print(f"{len(packages)} packages, {len(advisories)} advisories", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())

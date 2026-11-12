#!/usr/bin/env python3
"""Committed-secrets guard — fail if a live credential is tracked in git.

Closes the spirit of #155 (P0): the repo must hold no live secrets. Secrets are
sourced from the SecretResolver (env / file / AWS Secrets Manager); .env files
with secrets are gitignored. This blocks regressions — an AWS key, GitHub PAT,
private key, or Slack/Google token committed by accident fails CI.

High-confidence patterns only (near-zero false positives). Third-party vendored
fixtures and lock/example files are excluded.

It also guards against the Red Hat consulting breach (2025, #5501): details of a hospital's
network do not belong in a public repo. Private IPv4 addresses (RFC 1918 and 100.64/10) and
hostnames on internal suffixes (.local, .lan, .internal, .corp, .intranet, .home.arpa) are
ratcheted against a baseline of the examples already here: a new one fails. Write examples with
RFC 5737 addresses (192.0.2.x, 198.51.100.x, 203.0.113.x) and RFC 2606 names (hospital.example),
which are never flagged. Customer names come from MEDBRAINS_CUSTOMER_NAMES (one per line, a CI
secret, never in the repo); any hit fails and the log names the file, not the customer.
Policy: docs/security/partner-documents.md.

  python3 scripts/check_secrets.py                      # wired into `make check-secrets` and CI
  python3 scripts/check_secrets.py --self-test
  python3 scripts/check_secrets.py --update-baseline    # only after review: each new entry is an example
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT.parent
BASELINE = ROOT / "scripts" / ".network_identifiers_baseline.json"

# path substrings / suffixes that are not our secrets
SKIP_DIRS = ("vendor/", "node_modules/", ".sqlx/", "target/")
SKIP_SUFFIXES = (".example", ".sample", ".lock")
SKIP_NAMES = {
    "pnpm-lock.yaml", "package-lock.json", "Cargo.lock", "check_secrets.py",
    ".network_identifiers_baseline.json",
}

PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("AWS access key", re.compile(r"AKIA[0-9A-Z]{16}")),
    ("GitHub PAT", re.compile(r"ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}")),
    ("private key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("Slack token", re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}")),
    ("Google API key", re.compile(r"AIza[0-9A-Za-z_-]{35}")),
]


_OCTET = r"(?:25[0-5]|2[0-4]\d|1?\d?\d)"
PRIVATE_IP = re.compile(
    rf"(?<![\w.])(10(?:\.{_OCTET}){{3}}|172\.(?:1[6-9]|2\d|3[01])(?:\.{_OCTET}){{2}}"
    rf"|192\.168(?:\.{_OCTET}){{2}}|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])(?:\.{_OCTET}){{2}})"
    r"(?![\w.]*\d)"
)
INTERNAL_HOST = re.compile(
    r"(?<![\w.-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+"
    r"(?:local|lan|internal|corp|intranet|home\.arpa))(?![\w-]|\.\w)"
)


def network_identifiers(text: str) -> set[str]:
    """Returns every private IPv4 address and internal-suffix hostname in a text."""
    return set(PRIVATE_IP.findall(text)) | set(INTERNAL_HOST.findall(text))


def customer_hits(text: str, names: list[str]) -> list[int]:
    """Returns the 1-based index of each customer name found, matched case-insensitively."""
    lower = text.lower()
    return [
        n
        for n, name in enumerate(names, 1)
        if re.search(rf"(?<![a-z0-9]){re.escape(name.lower())}(?![a-z0-9])", lower)
    ]


def new_identifiers(found: dict[str, set[str]], baseline: dict[str, list[str]]) -> list[str]:
    """Lists every identifier in a file that the baseline does not hold for that file."""
    return [
        f"  {path}: {value}"
        for path, values in sorted(found.items())
        for value in sorted(values - set(baseline.get(path, [])))
    ]


def scan_network(update: bool) -> list[str]:
    """Scans every tracked file in the repository for network identifiers and customer names."""
    names = [n.strip() for n in os.environ.get("MEDBRAINS_CUSTOMER_NAMES", "").splitlines() if n.strip()]
    found: dict[str, set[str]] = {}
    findings: list[str] = []
    for rel in tracked_files(REPO):
        if is_skipped(rel):
            continue
        try:
            text = (REPO / rel).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        if values := network_identifiers(text):
            found[rel] = values
        findings += [f"  {rel}: customer name, entry {n} of MEDBRAINS_CUSTOMER_NAMES" for n in customer_hits(text, names)]
    if update:
        BASELINE.write_text(json.dumps({k: sorted(v) for k, v in sorted(found.items())}, indent=1) + "\n")
        return findings
    baseline = json.loads(BASELINE.read_text()) if BASELINE.exists() else {}
    return findings + new_identifiers(found, baseline)


def self_test() -> None:
    """Checks the network patterns against values that must and must not match."""
    hit = "ssh 10.20.30.40 or http://192.168.1.20:8178 or 172.16.0.0/12 or ris.hospital-a.lan"
    assert network_identifiers(hit) == {"10.20.30.40", "192.168.1.20", "172.16.0.0", "ris.hospital-a.lan"}
    miss = "192.0.2.10 203.0.113.5 8.8.8.8 172.32.0.1 v10.0.0.1 1.10.0.0.5 hospital.example localStorage"
    assert network_identifiers(miss) == set(), network_identifiers(miss)
    assert network_identifiers("pacs.local, idm.medbrains.local.") == {"pacs.local", "idm.medbrains.local"}
    assert customer_hits("Deployed at Acme General.", ["acme general", "zeta"]) == [1]
    assert customer_hits("acmegeneral", ["acme general"]) == []
    assert new_identifiers({"a": {"10.0.0.1", "10.0.0.2"}}, {"a": ["10.0.0.1"]}) == ["  a: 10.0.0.2"]
    assert new_identifiers({"a": {"10.0.0.1"}}, {"a": ["10.0.0.1"]}) == []


def tracked_files(root: Path = ROOT) -> list[str]:
    """Lists the files git tracks under a directory, relative to it."""
    out = subprocess.run(
        ["git", "ls-files"], cwd=root, capture_output=True, text=True, check=True
    )
    return out.stdout.splitlines()


def is_skipped(path: str) -> bool:
    """True for vendored, generated and lock files, which are not ours to scan."""
    if any(d in path for d in SKIP_DIRS):
        return True
    if path.endswith(SKIP_SUFFIXES):
        return True
    return Path(path).name in SKIP_NAMES


def main() -> int:
    """Runs the secrets scan, then the network scan, and exits 1 if either finds anything."""
    if "--self-test" in sys.argv:
        self_test()
        print("check-secrets: self-test OK")
        return 0
    network = scan_network("--update-baseline" in sys.argv)
    findings: list[str] = []
    for rel in tracked_files():
        if is_skipped(rel):
            continue
        full = ROOT / rel
        try:
            text = full.read_text(encoding="utf-8", errors="ignore")
        except (OSError, ValueError):
            continue
        for label, pattern in PATTERNS:
            for lineno, line in enumerate(text.splitlines(), 1):
                if pattern.search(line):
                    findings.append(f"  {rel}:{lineno}: possible {label}")

    if findings:
        print("Committed secrets detected — rotate + remove them, source from the secret backend:\n")
        print("\n".join(findings))
        print(
            "\nNever commit live credentials. Use env / the SecretResolver "
            "(env / file / AWS Secrets Manager). If this is a non-secret false positive, "
            "exclude the file in scripts/check_secrets.py."
        )
        return 1

    if network:
        print("Hospital network details or customer names in the public repo (#5501):\n")
        print("\n".join(network))
        print(
            "\nRemove them: a site's addresses, hostnames and names live only in encrypted, need-to-know"
            " storage (docs/security/partner-documents.md). For an example, use 192.0.2.x or"
            " hospital.example. A reviewed example may be added with --update-baseline."
        )
        return 1

    print("check-secrets: OK. No live credentials, new network details or customer names tracked in git.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

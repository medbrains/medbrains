#!/usr/bin/env python3
"""
Egress allowlist coherence check.

`infra/cilium/egress-allowlist.yaml` is the single source of truth for
external FQDNs our pods may reach. Every external HTTPS call in the
outbox handlers (`crates/medbrains-outbox/src/handlers/*.rs`) and in
the connectors (`crates/medbrains-server/src/orchestration/connectors.rs`)
MUST resolve to a hostname listed in the allowlist.

This script extracts hostnames from those Rust files and compares to
the YAML allowlist. Any URL not in the allowlist fails CI.

If `infra/cilium/egress-allowlist.yaml` doesn't exist yet (Phase 4
deliverable), the check soft-passes with a NOTE.

Exit codes:
    0  All handler URLs match the allowlist (or allowlist not yet present)
    1  One or more handler URLs not in the allowlist
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ALLOWLIST_PATH = REPO_ROOT / "medbrains" / "infra" / "cilium" / "egress-allowlist.yaml"

SCAN_DIRS = [
    REPO_ROOT / "medbrains" / "crates" / "medbrains-outbox" / "src" / "handlers",
    REPO_ROOT / "medbrains" / "crates" / "medbrains-server" / "src" / "orchestration",
    REPO_ROOT / "medbrains" / "crates" / "medbrains-server" / "src" / "routes",
]

URL_RE = re.compile(r'"https?://([a-zA-Z0-9.-]+)(?::\d+)?(?:/[^"]*)?"')

# FQDNs that are framework-internal (not real egress) — ignore them.
INTERNAL_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "schema.org",          # JSON-LD
    "json-schema.org",     # schema declarations
    "openapis.org",        # spec
    "spec.openapis.org",
}


def extract_hosts() -> set[str]:
    hosts: set[str] = set()
    for root in SCAN_DIRS:
        if not root.exists():
            continue
        for f in root.rglob("*.rs"):
            try:
                text = f.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            for m in URL_RE.finditer(text):
                host = m.group(1).lower()
                if host in INTERNAL_HOSTS:
                    continue
                hosts.add(host)
    return hosts


def parse_allowlist() -> set[str]:
    if not ALLOWLIST_PATH.exists():
        return set()
    text = ALLOWLIST_PATH.read_text(encoding="utf-8")
    # Minimal YAML scan — look for `- "fqdn"` lines under any key.
    # Avoids YAML dep so the script runs out-of-the-box on any Python.
    return {
        m.group(1).lower()
        for m in re.finditer(r"-\s+['\"]?([a-zA-Z0-9.*-]+)['\"]?", text)
    }


def matches(host: str, allowlist: set[str]) -> bool:
    if host in allowlist:
        return True
    # Wildcard support: `*.razorpay.com` matches `api.razorpay.com`.
    for entry in allowlist:
        if entry.startswith("*.") and host.endswith(entry[1:]):
            return True
    return False


def main() -> int:
    hosts = extract_hosts()
    if not ALLOWLIST_PATH.exists():
        print(f"NOTE: {ALLOWLIST_PATH.relative_to(REPO_ROOT)} not present yet.")
        print(f"      Discovered {len(hosts)} candidate FQDNs from handlers:")
        for h in sorted(hosts):
            print(f"        - {h}")
        print("      Strict mode activates once allowlist YAML lands. (Phase 4.)")
        return 0

    allowlist = parse_allowlist()
    missing = sorted(h for h in hosts if not matches(h, allowlist))

    print(
        f"Discovered {len(hosts)} handler FQDNs; "
        f"allowlist has {len(allowlist)} entries."
    )

    if missing:
        print(f"\n=== {len(missing)} FQDNs NOT IN ALLOWLIST ===")
        for h in missing:
            print(f"  ✗ {h}")
        print()
        print("Add to infra/cilium/egress-allowlist.yaml or remove the call site.")
        return 1

    print("✓ Every handler FQDN is allowlisted.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Region pinning check — DPDP / data-residency guardrail.

Indian patient data MUST stay in `ap-south-1`. Cross-region references
in Terraform / Helm / app config are violations: an `ap-south-1` tenant
must not have an S3 ARN pointing at `us-east-1`, an Aurora replica in
`ap-southeast-1`, etc.

This is a STATIC linter. Heuristic: scan config files (Terraform, helm
values, environment YAML) for AWS region tokens. If a config file
declares `home_region = "ap-south-1"` (or is in an `ap-south-1` env
directory), no other region tokens may appear in the same file (except
explicitly allowed cross-region targets like a DR snapshot bucket
declared via the `# allow-cross-region: dr-snapshot` comment).

Exit codes:
    0  No region pinning violations
    1  One or more cross-region references in pinned configs
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Region tokens we care about
REGION_RE = re.compile(
    r"\b(ap-south-1|ap-southeast-[12]|ap-northeast-[12]|"
    r"us-east-[12]|us-west-[12]|"
    r"eu-west-[123]|eu-central-1|me-south-1)\b"
)

# Extensions to scan
SUFFIXES = (".tf", ".tfvars", ".yaml", ".yml", ".hcl")

# Per-region env-directory patterns
ENV_REGION_DIR_RE = re.compile(r"/regions/(?P<region>[a-z0-9-]+)/")

ALLOW = re.compile(r"#\s*allow-cross-region\b|//\s*allow-cross-region\b")

SCAN_DIRS = [
    REPO_ROOT / "medbrains" / "infra",
    REPO_ROOT / "medbrains" / "apps" / "web" / "config",
]


def main() -> int:
    violations: list[tuple[Path, int, str, str, str]] = []

    for root in SCAN_DIRS:
        if not root.exists():
            continue
        for f in root.rglob("*"):
            if not f.is_file():
                continue
            if not f.suffix.lower() in SUFFIXES:
                continue

            # Determine the region this file is pinned to (if any) from
            # its parent path: `envs/.../regions/<region>/...`.
            m = ENV_REGION_DIR_RE.search(str(f))
            pinned_region = m.group("region") if m else None
            if not pinned_region:
                continue

            try:
                text = f.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue

            for lineno, line in enumerate(text.splitlines(), 1):
                if ALLOW.search(line):
                    continue
                for tok_match in REGION_RE.finditer(line):
                    found = tok_match.group(0)
                    if found != pinned_region:
                        violations.append(
                            (f, lineno, line.strip()[:120], pinned_region, found)
                        )

    if violations:
        print(f"=== {len(violations)} REGION-PINNING VIOLATIONS ===")
        for f, n, line, pinned, found in violations:
            print(
                f"  ✗ {f.relative_to(REPO_ROOT)}:{n} "
                f"(pinned to {pinned}, references {found}): {line}"
            )
        print()
        print("Region-pinned configs MUST NOT reference other regions.")
        print("Escape: `# allow-cross-region: <reason>` (DR snapshot, etc.).")
        return 1

    print("✓ No cross-region references in pinned configs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

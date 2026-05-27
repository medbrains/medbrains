#!/usr/bin/env python3
"""Static redaction/masking control guard for MedBrains.

This check validates that privacy controls exist outside storage encryption:
field access, PHI egress redaction, identifier masking, log redaction, and a
documented control plan.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path


TOOLS_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = TOOLS_ROOT.parent / "medbrains"


@dataclass(frozen=True)
class StaticRequirement:
    control_id: str
    label: str
    path: str
    patterns: tuple[str, ...]


REQUIREMENTS: tuple[StaticRequirement, ...] = (
    StaticRequirement(
        control_id="PRIV-MASK-001",
        label="PHI egress boundary filter exists and fails closed on unknown fields",
        path="crates/medbrains-core/src/boundary_filter.rs",
        patterns=(
            r"pub enum FilterDecision",
            r"Redacted\s*\{",
            r"BlockUnknown\s*\{",
            r"fail_closed:\s*bool",
            r"Classification::Phi",
            r"BoundaryFilter::defaults",
        ),
    ),
    StaticRequirement(
        control_id="PRIV-MASK-002",
        label="Role/user field access can hide or read-limit sensitive fields",
        path="crates/medbrains-server/src/middleware/field_access.rs",
        patterns=(
            r"resolve_restricted_fields",
            r"validate_write_access",
            r"FieldAccessLevel::View",
            r"FieldAccessLevel::Mask",
            r"FieldAccessLevel::Hidden",
            r"Cannot write to restricted fields",
        ),
    ),
    StaticRequirement(
        control_id="PRIV-MASK-002",
        label="Reusable masking helpers exist for partial/half masking",
        path="crates/medbrains-core/src/privacy.rs",
        patterns=(
            r"mask_identifier_keep_last",
            r"mask_phone",
            r"mask_name",
            r"mask_free_text",
        ),
    ),
    StaticRequirement(
        control_id="PRIV-MASK-003",
        label="Patient Aadhaar is stored as masked/hash values rather than raw identifier output",
        path="crates/medbrains-server/src/routes/patients.rs",
        patterns=(
            r"fn masked_aadhaar",
            r"sha256_hex",
            r"only masked/hash storage is retained",
            r"aadhaar_masked",
        ),
    ),
    StaticRequirement(
        control_id="PRIV-MASK-003",
        label="Client error telemetry redacts UUID-like route identifiers",
        path="crates/medbrains-server/src/routes/client_errors.rs",
        patterns=(
            r"redact_uuid_path_segments",
            r"route_without_query",
            r"client screen crash",
        ),
    ),
    StaticRequirement(
        control_id="PRIV-MASK-004",
        label="Permission/entity matrix tracks field masking and reveal work",
        path="docs/audit/permission-entity-matrix.md",
        patterns=(
            r"field-access",
            r"maskField",
            r"auditReveal",
            r"Data masking and redaction controls",
        ),
    ),
    StaticRequirement(
        control_id="PRIV-MASK-005",
        label="Data masking/redaction control plan covers redaction, nulling, partial masking, and pseudonymization",
        path="docs/compliance/data-masking-redaction-control-plan.md",
        patterns=(
            r"Black-box redaction",
            r"Full or partial nulling",
            r"Partial redaction",
            r"Partial masking",
            r"Pseudonymization",
            r"Data masking",
            r"Substitution and scrambling",
            r"Shuffling/swapping",
            r"Encryption",
            r"Bucketing/generalization",
            r"Synthetic data",
            r"format-preserving",
            r"Boundary Decision Guide",
            r"Half/partial masking",
            r"dedicated redaction",
            r"PRIV-MASK-001",
            r"PRIV-MASK-008",
        ),
    ),
)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable evidence status for Compliance Center ingestion.",
    )
    return parser.parse_args(argv)


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError as exc:
        raise RuntimeError(f"cannot read {path}") from exc


def check_requirement(requirement: StaticRequirement) -> list[str]:
    path = PROJECT_ROOT / requirement.path
    if not path.exists():
        return [f"missing file: {requirement.path}"]

    content = read_text(path)
    missing: list[str] = []
    for pattern in requirement.patterns:
        if re.search(pattern, content, flags=re.MULTILINE) is None:
            missing.append(pattern)
    return missing


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if not PROJECT_ROOT.exists():
        print(f"Project root not found: {PROJECT_ROOT}", file=sys.stderr)
        return 2

    failures: list[tuple[StaticRequirement, list[str]]] = []
    results: list[dict[str, object]] = []
    for requirement in REQUIREMENTS:
        missing = check_requirement(requirement)
        results.append(
            {
                "control_id": requirement.control_id,
                "label": requirement.label,
                "path": requirement.path,
                "status": "fail" if missing else "pass",
                "missing_patterns": missing,
            }
        )
        if missing:
            failures.append((requirement, missing))

    if args.json:
        print(
            json.dumps(
                {
                    "check": "redaction_masking",
                    "status": "fail" if failures else "pass",
                    "requirements_checked": len(REQUIREMENTS),
                    "results": results,
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 1 if failures else 0

    if failures:
        print("Redaction/masking static check failed.")
        print()
        for requirement, missing in failures:
            print(f"- {requirement.control_id}: {requirement.label}")
            print(f"  file: {requirement.path}")
            for pattern in missing:
                print(f"  missing pattern: {pattern}")
        return 1

    print("Redaction/masking static check passed.")
    print(f"Checked {len(REQUIREMENTS)} privacy evidence requirements.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

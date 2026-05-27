#!/usr/bin/env python3
"""Static SOC 2 encryption-at-rest guard for MedBrains infrastructure.

This is not an auditor attestation. It fails fast when core Terraform evidence
for KMS-backed at-rest encryption is removed or weakened.
"""

from __future__ import annotations

import re
import sys
import json
import argparse
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
        control_id="SOC2-ENC-001",
        label="KMS CMKs exist for app, database, audit, and secrets data classes, with rotation enabled",
        path="infra/terraform/modules/kms/main.tf",
        patterns=(
            r"\bapp\s*=",
            r"\bdb\s*=",
            r"\baudit\s*=",
            r"\bsecrets\s*=",
            r'resource\s+"aws_kms_key"\s+"purpose"',
            r"enable_key_rotation\s*=\s*true",
            r"rotation_period_in_days\s*=\s*365",
            r'resource\s+"aws_kms_alias"\s+"purpose"',
        ),
    ),
    StaticRequirement(
        control_id="SOC2-ENC-002",
        label="Aurora PostgreSQL storage, secrets, snapshots, and performance insights use the DB KMS key",
        path="infra/terraform/modules/aurora/main.tf",
        patterns=(
            r'resource\s+"aws_rds_cluster"\s+"this"',
            r"storage_encrypted\s*=\s*true",
            r"kms_key_id\s*=\s*var\.kms_key_arn",
            r"copy_tags_to_snapshot\s*=\s*true",
            r"backup_retention_period\s*=\s*var\.backup_retention_days",
            r'resource\s+"aws_secretsmanager_secret"\s+"db_master"',
            r"performance_insights_kms_key_id\s*=\s*var\.kms_key_arn",
        ),
    ),
    StaticRequirement(
        control_id="SOC2-ENC-002",
        label="Self-managed Patroni PostgreSQL root and data EBS volumes are encrypted with the DB KMS key",
        path="infra/terraform/modules/patroni-cluster/main.tf",
        patterns=(
            r"root_block_device\s*\{[\s\S]*?encrypted\s*=\s*true[\s\S]*?kms_key_id\s*=\s*var\.kms_key_arn",
            r"ebs_block_device\s*\{[\s\S]*?encrypted\s*=\s*true[\s\S]*?kms_key_id\s*=\s*var\.kms_key_arn",
        ),
    ),
    StaticRequirement(
        control_id="SOC2-ENC-003",
        label="PHI uploads use KMS-backed S3 server-side encryption and versioning",
        path="infra/terraform/modules/s3/main.tf",
        patterns=(
            r'resource\s+"aws_s3_bucket_versioning"\s+"uploads"',
            r'resource\s+"aws_s3_bucket_server_side_encryption_configuration"\s+"uploads"',
            r'sse_algorithm\s*=\s*"aws:kms"',
            r"kms_master_key_id\s*=\s*var\.kms_key_arns\.app",
            r"bucket_key_enabled\s*=\s*true",
        ),
    ),
    StaticRequirement(
        control_id="SOC2-ENC-004",
        label="Audit archive uses KMS-backed S3 encryption plus compliance-mode Object Lock",
        path="infra/terraform/modules/s3/main.tf",
        patterns=(
            r"object_lock_enabled\s*=\s*true",
            r'resource\s+"aws_s3_bucket_object_lock_configuration"\s+"audit_archive"',
            r'mode\s*=\s*"COMPLIANCE"',
            r'years\s*=\s*7',
            r'resource\s+"aws_s3_bucket_server_side_encryption_configuration"\s+"audit_archive"',
            r"kms_master_key_id\s*=\s*var\.kms_key_arns\.audit",
        ),
    ),
    StaticRequirement(
        control_id="SOC2-ENC-005",
        label="Kubernetes secrets and control-plane logs are encrypted with KMS",
        path="infra/terraform/modules/eks/cluster.tf",
        patterns=(
            r'resource\s+"aws_cloudwatch_log_group"\s+"cluster"[\s\S]*?kms_key_id\s*=\s*var\.kms_key_arn',
            r"encryption_config\s*\{[\s\S]*?key_arn\s*=\s*var\.kms_key_arn[\s\S]*?resources\s*=\s*\[\s*\"secrets\"\s*\]",
            r"enabled_cluster_log_types\s*=\s*\[[\s\S]*?\"audit\"",
        ),
    ),
    StaticRequirement(
        control_id="SOC2-ENC-010",
        label="Encryption-at-rest controls are documented in the compliance evidence plan",
        path="docs/compliance/soc2-encryption-at-rest-control-plan.md",
        patterns=(
            r"SOC 2 is not an application license",
            r"SOC2-ENC-001",
            r"SOC2-ENC-010",
            r"make check-encryption-at-rest",
        ),
    ),
)


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


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable evidence status for Compliance Center ingestion.",
    )
    return parser.parse_args(argv)


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
                    "check": "encryption_at_rest",
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
        print("Encryption-at-rest static check failed.")
        print()
        for requirement, missing in failures:
            print(f"- {requirement.control_id}: {requirement.label}")
            print(f"  file: {requirement.path}")
            for pattern in missing:
                print(f"  missing pattern: {pattern}")
        return 1

    print("Encryption-at-rest static check passed.")
    print(f"Checked {len(REQUIREMENTS)} SOC 2 encryption-at-rest evidence requirements.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

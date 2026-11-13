"""Refuse a deploy plan that would create, replace or destroy real infrastructure.

A routine deploy onto an existing host only re-runs the bootstrap upload
(null_resource) and may retag resources. A plan that wants a new EC2, a new
EIP or to drop a bucket means the env is wrong (a missing .env once turned an
attach deploy into a brand-new starter server) — stop before it applies.

    terraform show -json plan.tfplan | python3 plan_guard.py
Set ALLOW_INFRA_CHANGES=1 for genuine infrastructure work.
"""

import json
import os
import sys

# Bookkeeping resources a deploy legitimately replaces every time.
ROUTINE = {"null_resource", "terraform_data"}


def blocked_changes(plan: dict) -> list[str]:
    out = []
    for rc in plan.get("resource_changes", []):
        actions = set(rc["change"]["actions"])
        if rc["type"] in ROUTINE or actions <= {"no-op", "read", "update"}:
            continue
        out.append(f"{'/'.join(rc['change']['actions']):>16}  {rc['address']}")
    return out


def main() -> int:
    blocked = blocked_changes(json.load(sys.stdin))
    if not blocked:
        print("==> plan guard: only routine deploy changes")
        return 0
    print("\nRefusing: this plan creates/replaces/destroys real infrastructure:")
    print("\n".join(blocked))
    if os.environ.get("ALLOW_INFRA_CHANGES") == "1":
        print("ALLOW_INFRA_CHANGES=1 set — continuing.")
        return 0
    print("Check the env (tier, .env). For intended infra work: ALLOW_INFRA_CHANGES=1")
    return 1


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        rc = lambda t, a, addr="x": {"type": t, "address": addr, "change": {"actions": a}}
        assert not blocked_changes({"resource_changes": [
            rc("null_resource", ["delete", "create"]), rc("aws_kms_key", ["update"])]})
        assert blocked_changes({"resource_changes": [rc("aws_instance", ["create"])]})
        assert blocked_changes({"resource_changes": [rc("aws_s3_bucket", ["delete"])]})
        print("plan_guard self-test OK")
        sys.exit(0)
    sys.exit(main())

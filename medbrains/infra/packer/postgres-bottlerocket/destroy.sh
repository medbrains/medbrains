#!/usr/bin/env bash
# Sprint B helper — Packer doesn't have a `destroy` command, so this
# script deregisters the AMI(s) we built and deletes the backing EBS
# snapshots.
#
# Usage:
#   ./destroy.sh                        # destroy ALL medbrains-postgres-* AMIs in ap-south-1
#   ./destroy.sh ami-0123abc            # destroy ONE specific AMI
#   ./destroy.sh --region us-east-1     # different region
#   ./destroy.sh --dry-run              # show what would happen, change nothing

set -euo pipefail

REGION="ap-south-1"
DRY_RUN=""
TARGETS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --region) REGION="$2"; shift 2 ;;
        --dry-run) DRY_RUN="echo [DRY-RUN]"; shift ;;
        ami-*) TARGETS+=("$1"); shift ;;
        -h|--help)
            sed -n '2,15p' "$0"
            exit 0
            ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
done

# If no specific AMIs given, find all medbrains-postgres-* we own
if [[ ${#TARGETS[@]} -eq 0 ]]; then
    mapfile -t TARGETS < <(aws ec2 describe-images \
        --region "$REGION" \
        --owners self \
        --filters "Name=tag:medbrains-image,Values=postgres-*" \
        --query 'Images[].ImageId' \
        --output text | tr '\t' '\n' | grep -v '^$' || true)
fi

if [[ ${#TARGETS[@]} -eq 0 ]]; then
    echo "No medbrains-postgres-* AMIs found in $REGION."
    exit 0
fi

echo "Region:    $REGION"
echo "AMIs:      ${TARGETS[*]}"
echo

for ami in "${TARGETS[@]}"; do
    echo "=== $ami ==="

    # Resolve the snapshot(s) backing this AMI
    SNAPS=$(aws ec2 describe-images \
        --region "$REGION" \
        --image-ids "$ami" \
        --query 'Images[0].BlockDeviceMappings[?Ebs!=null].Ebs.SnapshotId' \
        --output text)

    NAME=$(aws ec2 describe-images \
        --region "$REGION" \
        --image-ids "$ami" \
        --query 'Images[0].Name' \
        --output text 2>/dev/null || echo "(unknown)")

    echo "  Name:      $NAME"
    echo "  Snapshots: ${SNAPS:-(none)}"

    # Deregister the AMI first (so the snapshots are deletable)
    $DRY_RUN aws ec2 deregister-image \
        --region "$REGION" \
        --image-id "$ami"

    # Then delete each backing snapshot
    for snap in $SNAPS; do
        [[ -z "$snap" ]] && continue
        $DRY_RUN aws ec2 delete-snapshot \
            --region "$REGION" \
            --snapshot-id "$snap"
    done

    echo "  ✓ destroyed"
    echo
done

echo "Done. Final inventory:"
aws ec2 describe-images \
    --region "$REGION" \
    --owners self \
    --filters "Name=tag:medbrains-image,Values=postgres-*" \
    --query 'Images[].[ImageId,Name,CreationDate]' \
    --output table

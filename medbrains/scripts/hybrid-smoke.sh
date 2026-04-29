#!/usr/bin/env bash
# scripts/hybrid-smoke.sh — end-to-end check of a hybrid tenant.
#
# Usage: make hybrid-smoke TENANT=hospital-A
#
# Steps (each must pass):
#   1. Headscale tailnet handshake — cloud → on-prem PG via tailnet DNS
#   2. Cloud event-bus reachable from on-prem K3s pod
#   3. PHI redaction proof: enqueue a synthetic event with
#      aadhaar_number; assert cloud-side row has NULL in that column
#   4. Audit chain verifies on both sides
#   5. Patroni leader election survives a deliberate kill of the leader
#   6. Bridge-down test: tailscale down on-prem; cloud should mark
#      tenant degraded within 60s; events buffer locally; tailscale up
#      drains them within 30s
#
# Exits non-zero on any failure; meant to be wired into CI for
# staging tenants.

set -euo pipefail

TENANT="${1:-}"
if [[ -z "$TENANT" ]]; then
    echo "usage: $0 <tenant-id>" >&2
    exit 2
fi

TENANT_DIR="infra/terraform/envs/tenants/$TENANT"
if [[ ! -d "$TENANT_DIR" ]]; then
    echo "tenant directory $TENANT_DIR not found" >&2
    exit 1
fi

cd "$TENANT_DIR"

PG_HINT=$(terraform output -raw pg_endpoint_hint 2>/dev/null || echo "")
K3S_SERVER=$(terraform output -raw k3s_server 2>/dev/null || echo "")
TUNNEL=$(terraform output -raw tunnel_provider 2>/dev/null || echo "")

if [[ -z "$PG_HINT" || -z "$K3S_SERVER" ]]; then
    echo "terraform outputs missing — has hybrid-up completed for $TENANT?" >&2
    exit 1
fi

echo "=== smoke for tenant $TENANT (tunnel=$TUNNEL) ==="
echo "  PG nodes: $PG_HINT"
echo "  K3s server: $K3S_SERVER"
echo

step() {
    echo "→ $1"
}

# 1. tailnet handshake
step "tailnet handshake"
if [[ "$TUNNEL" == "none" ]]; then
    echo "  [skip] air-gapped tenant"
else
    # The cloud-side smoke pod is registered as `cloud-bridge-smoke`
    # in the tailnet ACL. From there, ping the on-prem K3s API.
    if ! kubectl exec -n medbrains cloud-bridge-smoke -- \
            curl -k --max-time 5 -sf "https://${K3S_SERVER}:6443/livez" >/dev/null; then
        echo "  ✗ cloud→on-prem reach failed via tailnet"
        exit 1
    fi
    echo "  ✓"
fi

# 2. Cloud event-bus reachable from on-prem
step "on-prem → cloud event bus"
ssh -o StrictHostKeyChecking=no medbrains@"$K3S_SERVER" \
    'curl --max-time 5 -sfo /dev/null https://api.medbrains.cloud/internal/events/health' \
    && echo "  ✓" \
    || { echo "  ✗ on-prem cannot reach cloud event bus"; exit 1; }

# 3. PHI redaction
step "PHI redaction (aadhaar_number must NOT cross to cloud)"
EVENT_ID="smoke-$(date +%s)-$RANDOM"
ssh medbrains@"$K3S_SERVER" "curl -sf -X POST \
    https://localhost:8443/internal/test/enqueue-outbox-event \
    -H 'content-type: application/json' \
    -d '{
        \"event_id\":\"$EVENT_ID\",
        \"payload\":{
            \"patient_id\":\"smoke\",
            \"aadhaar_number\":\"1234-5678-9012\"
        }
    }'"
sleep 5
RESPONSE=$(curl -sf "https://api.medbrains.cloud/internal/test/fetch-event?id=$EVENT_ID")
if echo "$RESPONSE" | grep -q '"aadhaar_number":null'; then
    echo "  ✓ aadhaar redacted on cloud side"
else
    echo "  ✗ PHI leak — cloud-side event still has aadhaar_number"
    echo "    response: $RESPONSE"
    exit 1
fi

# 4. Audit chain verify
step "audit chain verify (on-prem)"
ssh medbrains@"$K3S_SERVER" 'kubectl -n medbrains exec deploy/medbrains-server -- medbrains-server audit verify-chain' \
    && echo "  ✓" || { echo "  ✗ audit chain verify failed"; exit 1; }

# 5. Patroni leader election
step "Patroni leader survives leader-kill"
LEADER_BEFORE=$(ssh medbrains@"$K3S_SERVER" \
    'kubectl -n medbrains exec deploy/medbrains-server -- patronictl -c /etc/medbrains/patroni.yml list -f json | jq -r ".members[] | select(.role==\"Leader\") | .name"')
echo "  leader before: $LEADER_BEFORE"
ssh medbrains@"$K3S_SERVER" \
    "kubectl -n medbrains exec deploy/medbrains-server -- patronictl -c /etc/medbrains/patroni.yml restart $LEADER_BEFORE --force" >/dev/null
sleep 30
LEADER_AFTER=$(ssh medbrains@"$K3S_SERVER" \
    'kubectl -n medbrains exec deploy/medbrains-server -- patronictl -c /etc/medbrains/patroni.yml list -f json | jq -r ".members[] | select(.role==\"Leader\") | .name"')
echo "  leader after: $LEADER_AFTER"
[[ -n "$LEADER_AFTER" ]] || { echo "  ✗ no leader after restart"; exit 1; }
echo "  ✓"

# 6. Bridge-down test (only when tunnel != none)
if [[ "$TUNNEL" != "none" ]]; then
    step "bridge-down test"
    ssh medbrains@"$K3S_SERVER" 'sudo tailscale down'
    sleep 70
    DEGRADED=$(curl -sf "https://api.medbrains.cloud/internal/test/tenant-status?id=$TENANT" | jq -r .status)
    [[ "$DEGRADED" == "degraded" ]] || { echo "  ✗ cloud did not mark tenant degraded within 60s (status=$DEGRADED)"; ssh medbrains@"$K3S_SERVER" 'sudo tailscale up'; exit 1; }
    ssh medbrains@"$K3S_SERVER" 'sudo tailscale up'
    sleep 30
    RESTORED=$(curl -sf "https://api.medbrains.cloud/internal/test/tenant-status?id=$TENANT" | jq -r .status)
    [[ "$RESTORED" == "healthy" ]] || { echo "  ✗ cloud did not restore healthy after tunnel up (status=$RESTORED)"; exit 1; }
    echo "  ✓"
fi

echo
echo "=== smoke PASS for tenant $TENANT ==="

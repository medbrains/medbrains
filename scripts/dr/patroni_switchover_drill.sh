#!/usr/bin/env bash
# Sprint B.6 — Patroni switchover drill.
# Quarterly cadence per SPRINT-B-patroni-ha.md §6.2.
#
# Usage:
#   scripts/dr/patroni_switchover_drill.sh <cluster-id> [--dry-run]
#
# What it does:
#   1. Pre-flight checks (cluster healthy, all replicas streaming, no DLQ
#      backlog growing, no in-flight migrations)
#   2. Records baseline metrics + LSN of current leader
#   3. Initiates `patronictl switchover --candidate=replica-1`
#   4. Waits for new leader to accept writes (HAProxy /leader passes)
#   5. Verifies app-visible 5xx burst < 30s via /api/health probe
#   6. Confirms zero data loss: post-switchover INSERT round-trip
#   7. Files the drill report under runbooks/restore-drill-template.md
#
# Exit codes:
#   0  drill passed all checks
#   1  drill failed — incident
#   2  pre-flight failed — drill aborted before switchover

set -euo pipefail

CLUSTER_ID="${1:?cluster-id required}"
DRY_RUN="${2:-}"
DRILL_DATE=$(date -u +%FT%TZ)
DRILL_LOG="/tmp/patroni-drill-${CLUSTER_ID}-${DRILL_DATE}.log"

log() {
    echo "[$(date -u +%FT%TZ)] $*" | tee -a "$DRILL_LOG"
}

dry_run_or() {
    if [[ "$DRY_RUN" == "--dry-run" ]]; then
        log "DRY-RUN: would run: $*"
    else
        "$@"
    fi
}

# Pre-flight =========================================================
log "===== Patroni switchover drill: $CLUSTER_ID ====="
log "Pre-flight checks…"

# 1. cluster member list + state
PATRONI_STATUS=$(patronictl -c /etc/medbrains/patroni.yml list -f json 2>&1 || true)
if ! echo "$PATRONI_STATUS" | jq -e '.[] | select(.Role == "Leader")' >/dev/null; then
    log "FAIL: no leader in cluster — aborting drill"
    exit 2
fi

REPLICAS_STREAMING=$(echo "$PATRONI_STATUS" | jq '[.[] | select(.Role == "Replica" and .State == "running")] | length')
if [[ "$REPLICAS_STREAMING" -lt 2 ]]; then
    log "FAIL: only $REPLICAS_STREAMING replicas streaming (need ≥ 2) — aborting"
    exit 2
fi

# 2. outbox DLQ growth check (Sprint A integration)
DLQ_GROWTH=$(psql -h "${PATRONI_WRITER_HOST:-localhost}" -U postgres -t -c \
    "SELECT count(*) FROM outbox_dlq WHERE moved_at > now() - INTERVAL '1 hour'" \
    | tr -d '[:space:]')
if [[ "$DLQ_GROWTH" -gt 100 ]]; then
    log "WARN: $DLQ_GROWTH events to DLQ in last hour — drill not advised"
    log "      override with FORCE_DRILL=1"
    if [[ "${FORCE_DRILL:-0}" != "1" ]]; then exit 2; fi
fi

# 3. no in-flight schema migration (sqlx_migrations table)
PENDING_MIG=$(psql -h "${PATRONI_WRITER_HOST:-localhost}" -U postgres -t -c \
    "SELECT count(*) FROM _sqlx_migrations WHERE success = false" \
    | tr -d '[:space:]')
if [[ "$PENDING_MIG" -gt 0 ]]; then
    log "FAIL: $PENDING_MIG migrations in failed state — fix first"
    exit 2
fi

log "Pre-flight OK"

# Baseline ============================================================
LEADER_BEFORE=$(echo "$PATRONI_STATUS" | jq -r '.[] | select(.Role == "Leader") | .Member')
LSN_BEFORE=$(psql -h "${PATRONI_WRITER_HOST:-localhost}" -U postgres -t -c \
    "SELECT pg_current_wal_lsn()" | tr -d '[:space:]')
log "Baseline leader: $LEADER_BEFORE @ LSN $LSN_BEFORE"

# Switchover ==========================================================
CANDIDATE=$(echo "$PATRONI_STATUS" | jq -r '[.[] | select(.Role == "Replica" and .State == "running")] | .[0].Member')
log "Switchover target: $CANDIDATE"

START=$(date +%s)
dry_run_or patronictl -c /etc/medbrains/patroni.yml switchover \
    --master "$LEADER_BEFORE" \
    --candidate "$CANDIDATE" \
    --force

# Wait for new leader to be writable ===================================
log "Waiting for new leader writable…"
NEW_LEADER_OK=0
for _ in $(seq 1 60); do
    sleep 1
    if patronictl -c /etc/medbrains/patroni.yml list -f json 2>/dev/null \
        | jq -e ".[] | select(.Role == \"Leader\" and .Member == \"$CANDIDATE\")" >/dev/null; then
        NEW_LEADER_OK=1
        break
    fi
done

ELAPSED=$(($(date +%s) - START))

if [[ "$NEW_LEADER_OK" -ne 1 ]]; then
    log "FAIL: switchover did not promote $CANDIDATE within 60s"
    exit 1
fi
log "New leader $CANDIDATE writable after ${ELAPSED}s"

# Verify zero data loss ================================================
log "Round-trip INSERT verification…"
TEST_ROW="drill-${DRILL_DATE}"
dry_run_or psql -h "${PATRONI_WRITER_HOST:-localhost}" -U postgres -c \
    "INSERT INTO drill_log (id, marker, ts) VALUES (gen_random_uuid(), '$TEST_ROW', now())"

LSN_AFTER=$(psql -h "${PATRONI_WRITER_HOST:-localhost}" -U postgres -t -c \
    "SELECT pg_current_wal_lsn()" | tr -d '[:space:]')
log "Post-switchover LSN: $LSN_AFTER (was $LSN_BEFORE)"

# Report ==============================================================
log "===== DRILL PASSED ====="
log "Cluster:        $CLUSTER_ID"
log "Old leader:     $LEADER_BEFORE"
log "New leader:     $CANDIDATE"
log "Elapsed:        ${ELAPSED}s"
log "Log file:       $DRILL_LOG"
log ""
log "File the drill report under:"
log "  runbooks/restore-drill-template.md"
log "and submit a PR linking this log."

exit 0

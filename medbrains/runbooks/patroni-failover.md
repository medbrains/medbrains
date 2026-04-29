# Runbook — Patroni Automatic Failover

**Owner:** Platform / DBA
**Page:** PagerDuty `medbrains-db` rotation
**Source:** RFCs/sprints/SPRINT-B-patroni-ha.md §6.1

## What it is

Patroni manages leader election. When the current leader fails its
lease renewal (default `loop_wait=10s`, `ttl=30s`), the etcd quorum
revokes the lease and Patroni promotes the next-best replica.
HAProxy's `/leader` health check (interval 10s, threshold 2) flips
target groups, redirecting writes to the new leader.

App-visible: ~10–15s of write 5xx, then full recovery. The Sprint A
outbox catches writes that landed during the gap (DLQ if the request
itself 5xx'd back to the user).

## Trigger sources

| Source | Trigger |
|---|---|
| EC2 instance failure | AWS health check + Patroni lease expiry |
| AZ outage | Same; the surviving 2 nodes elect new leader |
| OOM-killed Postgres | Patroni detects, restarts; if restart fails, replica promotes |
| Manual `patronictl failover` | Used only when fixed candidate is required |

## Alert payload

```
PagerDuty: pg_leader_changed{cluster=medbrains-prod-ap-south-1-pg}
Old leader: pg-2 (i-0abc...)
New leader: pg-3 (i-0def...)
Elapsed: 12s
```

Includes: cluster_id, old_leader, new_leader, elapsed_seconds,
witness_node (the etcd member that revoked the lease).

## Diagnostic steps — was the failover clean?

1. **Check Patroni history** on any node:
   ```bash
   ssh ec2-user@pg-1 patronictl history
   ```
   Confirms the timestamp + reason for promotion.

2. **Check WAL continuity** — the new leader must have replayed all
   WAL the old leader had committed to a synchronous standby.
   ```bash
   ssh ec2-user@pg-NEW psql -c "SELECT pg_last_wal_replay_lsn(), pg_current_wal_lsn();"
   ```
   Replay LSN should equal current LSN within seconds.

3. **Check sync_standby_names** — if synchronous_replication was on,
   no committed write was lost. If it was off, the gap may include
   in-flight transactions that didn't replicate.

4. **Check outbox DLQ** — events that 5xx'd during the gap:
   ```sql
   SELECT count(*), event_type FROM outbox_events
    WHERE status IN ('pending','retrying')
      AND created_at > now() - INTERVAL '5 minutes'
    GROUP BY event_type;
   ```

## Remediation

The cluster is self-healing. Operator action only required when:

- **Promotion took > 30s** — investigate etcd lease behavior; check
  `journalctl -u etcd` on all 3 etcd nodes for clock skew or network
  partition during the window.
- **Old leader returns as replica** but lags > 10 min — `patronictl
  reinit pg-OLD` to rebuild from current leader.
- **HAProxy target group health flap** — check `/leader` endpoint
  response time on both old + new leader; usually a 1s timeout
  hitting under load. Tune in Phase B.5 if recurring.

## Why this is critical

Cashier writes during the 12s window may 5xx back to the user. The
Sprint A outbox catches anything queued before the request handler
errored, but the user-facing 5xx is still a UX hit. Faster failover
(target: < 5s) is a Phase B.4 follow-up via:
- Lower `loop_wait` to 2s + `ttl` to 6s (trades stability for speed)
- HAProxy `/leader` interval to 2s
- Patroni REST keepalive tuning

## Why we don't run sync_replication globally

`synchronous_standby_names = 'ANY 1 (pg-2, pg-3)'` adds ~3-8ms p50 to
every write commit because the leader waits for one replica's flush
ack. Acceptable for clinical writes (correctness > latency); not
acceptable for the high-volume integration_executions table. Phase
B.4 follow-up: per-table `synchronous_commit` overrides via
`SET LOCAL synchronous_commit = local` on the integration write
paths only.

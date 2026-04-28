# Runbook — Audit Chain Verification

**Owner:** Platform / Compliance
**Page:** PagerDuty `medbrains-audit` rotation
**Source:** RFC-INFRA-2026-002 Phase 2

## ⚠️ Known issue — legacy rows un-verifiable

Rows written by the original `AuditLogger::log()` (pre-RFC-INFRA-2026-002)
included `old_values` and `new_values` JSON in the hash input. Postgres
stores those columns as JSONB which normalizes the JSON (sorts keys,
strips whitespace). Reading back JSONB produces a string that does NOT
match the originally-hashed string, so verify-chain ALWAYS reports the
chain as broken at the first row with non-null JSON.

**This is a known pre-existing design flaw, not tampering.**

Phase 2.5 fix options (open):
1. Add a `hash_input_canonical TEXT` column that stores the exact bytes
   hashed; verify reads from there.
2. Switch the hash-input format to canonical JSON (sorted keys) for both
   write and verify; do a one-shot migration to recompute hashes.
3. Drop JSON values from the hash input entirely; chain only secures
   metadata + prev_hash.

Until the fix lands, treat the cron alert as informational for legacy
tenants. The new HTTP middleware path (`log_http`) hashes the metadata
only (no JSON) and is verifiable today.

## What it is

Each tenant has a single SHA-256 hash chain over its `audit_log` rows.
The chain is a legal record under HIPAA / DPDP / DISHA / GDPR. A break in
the chain — recomputed hash diverging from stored — is a P0: it implies
either tampering, partial commit during deploy, or a code bug that
inserted a row outside `AuditLogger::log` / `log_http`.

A verifier runs hourly per tenant and writes results to
`audit_chain_verifications`. Any row with `valid = false` triggers a
PagerDuty alert.

## Trigger sources

| Source | Trigger |
|---|---|
| Cron | Hourly Kubernetes CronJob (`medbrains-audit-verify`) |
| Pre-deploy gate | CI runs verify-chain on prod replica before applying migrations |
| Post-deploy gate | CI runs verify-chain after deploy completes |
| Manual | On-call: `kubectl exec medbrains-server -- /app/medbrains-server audit verify-chain --tenant=<uuid>` |

## Alert payload

```
audit_chain_break_total{tenant=<uuid>} > 0
```

Includes: tenant_id, broken_at (audit_log.id), rows_checked,
duration_ms.

## Diagnostic steps

1. **Identify the break point.** Query
   `SELECT * FROM audit_chain_verifications WHERE tenant_id = $1 AND valid = false ORDER BY started_at DESC LIMIT 5;`
   Note `broken_at`.

2. **Inspect surrounding rows.**
   ```sql
   SELECT id, action, entity_type, entity_id, prev_hash, hash, created_at
   FROM audit_log
   WHERE tenant_id = $1
     AND created_at BETWEEN
       (SELECT created_at FROM audit_log WHERE id = $2) - INTERVAL '1 hour'
       AND
       (SELECT created_at FROM audit_log WHERE id = $2) + INTERVAL '5 minutes'
   ORDER BY created_at;
   ```
   The break is the first row whose stored hash != recomputed hash.

3. **Classify the break.**

   - **Trigger insert with NULL hash, then HTTP middleware insert with the
     same correlation_id**: dedup race — fix is to widen the dedup window
     in `audit_trigger_func()` from 5s to 15s.

   - **Out-of-order writes** (clock skew across replicas): row inserted
     with `created_at` earlier than the chain head's `created_at`. Fix
     is to use a monotonic sequence column instead of timestamp for chain
     ordering. Plan migration.

   - **Manual SQL insert outside `AuditLogger`**: someone ran an `INSERT
     INTO audit_log` directly. Identify by `hash IS NULL` rows or rows
     where `prev_hash` doesn't match the previous row's `hash`. **This
     is the case that needs immediate code-path fix.**

   - **Tamper**: stored `hash` was modified post-insert. Cross-reference
     with the daily S3 Object Lock archive (`s3://medbrains-audit-archive-<region>/<tenant>/<date>.ndjson.gz`)
     — the archived row is the legal canonical version. Restore guidance
     in `runbooks/audit-restore.md`.

## Remediation

The chain is **not** repaired automatically. Manual repair process:

1. Confirm root cause from step 3 above.
2. Snapshot the tenant's audit_log to S3 with timestamp marker (additional
   to the regular daily archive).
3. If safe: run `medbrains-server audit repair-chain --tenant=<uuid>
   --confirm` (ships in Phase 2.5; until then file an incident ticket
   and engage Platform).
4. Verify post-repair via fresh `verify-chain` run.
5. Open an incident report referencing the broken_at id and root cause.

## Why this is critical

A broken chain means a court-ordered audit trail dump cannot be proven
authentic. Best practice: do not delete the broken row. The S3 archive
is the legal source of truth — repair makes the live table match the
archive, not the other way round.

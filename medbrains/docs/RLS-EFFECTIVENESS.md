# RFC — Row-level security is inert for the role the app connects as

**Status:** finding, awaiting a decision
**Date:** 2026-07-23
**Found by:** static sweep (axis `o`), confirmed against a live PostgreSQL server

---

## Summary

Every tenant-scoped table declares a row-level security policy, and the server
sets `app.tenant_id` per request for the policies to read. Neither of those is
in question. What does not hold is the step between them:

> PostgreSQL does not apply a row-level security policy to the table's **owner**
> unless the table also declares `FORCE ROW LEVEL SECURITY`.

733 tables declare `ENABLE ROW LEVEL SECURITY`. 85 add `FORCE`. The application
connects as `POSTGRES_USER` (`medbrains`), which owns every table. For the
remaining **648 tables, the policies never run**.

`set_tenant_context` is not the problem — it does exactly what it says. There is
simply no `SET ROLE` anywhere in `apply_context`, so the session stays the owner.

## Reproduction

Against a scratch database built by applying all 248 migrations in order, owned
by a `NOSUPERUSER` role (a *weaker* case than the shipped superuser):

```sql
-- two hospitals, one patient each
SELECT set_config('app.tenant_id', '<hospital A>', false);

SELECT count(*) FROM patients;                        -- 2   ← both hospitals
UPDATE patients SET last_name = 'HACKED'
  WHERE uhid = '<hospital B patient>';                -- 1   ← wrote across tenants

ALTER TABLE public.patients FORCE ROW LEVEL SECURITY;

SELECT count(*) FROM patients;                        -- 1   ← correct
UPDATE patients SET last_name = 'HACKED2'
  WHERE uhid = '<hospital B patient>';                -- 0   ← correct
```

`patients` is the core PHI table. It is readable *and writable* across tenants
today, and so are the other 647.

## Why it has not surfaced

Isolation still holds wherever a query names `tenant_id` itself, and most do —
of 178 `UPDATE`/`DELETE` statements, 61 carry an explicit tenant predicate or
take no caller-supplied id at all. The exposure is the remaining **71 writes
keyed only on an id from the request path**, of the form

```sql
UPDATE cssd_instruments SET ... WHERE id = $1
```

Reaching another tenant's row requires knowing its UUID, so this is not
enumerable — but it is not isolated either, and the code plainly intends RLS to
be what isolates it.

## Options

### 1. Connect as a role that does not own the tables — recommended

Create a login role, grant it DML on the schema, and point `DATABASE_URL` at it.
Verified on the same scratch database, with **no** `FORCE` and no schema change:

| | owner (today) | non-owner role |
|---|---|---|
| `SELECT` under context A | all rows | own tenant only |
| cross-tenant `UPDATE` by id | 1 row written | 0 rows |
| `INSERT` into own tenant | succeeds | succeeds |

The policies are already correct; they just need a role that honours them.
Migrations, seeding, and the retention jobs keep running as the owner, which is
what they need — those legitimately work across tenants and before any context
exists.

Cost: one role, one `GRANT`, one connection string. No migration, no code
change, and none of the 71 writes need touching.

### 2. Add `FORCE ROW LEVEL SECURITY` to the 648 — not recommended

Measured, not assumed: with `FORCE`, an `INSERT` carrying no `app.tenant_id`
fails outright —

```
new row violates row-level security policy for table "patients"
```

That is precisely what tenant creation, seeding, and the migration-embedded
seed inserts do, since a tenant's first row necessarily predates its own
context. This option cannot ship without reworking those paths first.

### 3. Add explicit `tenant_id` predicates to the 71 writes

Correct as defence-in-depth and worth doing eventually, but it is 71 edits that
option 1 makes redundant, and it leaves every future write depending on the
author remembering.

## Recommendation

Take option 1, then option 3 opportunistically as those files are touched.
Option 2 only if something forces the app to keep connecting as the owner.

## Not addressed here

- The **66 tenant-scoped tables with no policy at all** — a separate gap, and
  one that option 1 does not close.
- Whether the deployed environments connect as the owner. This RFC establishes
  it for the shipped `docker-compose.yml` and `.env.example` only.

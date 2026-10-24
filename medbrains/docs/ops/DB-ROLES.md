# Database roles

Every tenant table has a row level security policy. Postgres skips those
policies for a **superuser**, a role with **BYPASSRLS**, and the **owner** of a
table (unless the table has `FORCE ROW LEVEL SECURITY`). An install that
connects as the owner has policies that read as present and do nothing:
isolation between hospitals rests on every query remembering its own
`WHERE tenant_id = $1`.

So the server uses three connections:

| Variable | Role | Used for | RLS |
|---|---|---|---|
| `DATABASE_URL` | `medbrains_app` (migration 0981) | every request | **applies**. No tenant set = no rows |
| `MIGRATION_DATABASE_URL` | the owner (`medbrains`) | migrations and seeding at boot, then closed | bypassed (owner) |
| `WORKER_DATABASE_URL` | `medbrains_outbox_worker` (migration 0984) | outbox, scheduler, escalation passes, `medbrains-archive` | bypassed (BYPASSRLS) |

`medbrains_app` and `medbrains_outbox_worker` may read and write rows and do
nothing else: no DDL, no ownership, no creating roles. The migrations create
them `LOGIN` **without a password**, so they cannot log in until somebody sets
one. Nothing did, so every install still connected as the owner.

Other consumers of the env file:

- `medbrains-pg-backup` dumps over `MIGRATION_DATABASE_URL` when there is no
  container. `pg_dump` refuses a table whose policy would filter it, and
  `medbrains_app` is filtered by design.
- `medbrains-archive` sweeps every tenant, so it uses `WORKER_DATABASE_URL`.
- Reference-data loaders (`scripts/seed_world_geo.py`,
  `medbrains/scripts/import_lgd_districts.py`) write tables `medbrains_app` may
  only read since migration 1200 (geography, regulatory bodies, CDS knowledge
  base, event registries). Point them at `MIGRATION_DATABASE_URL`.

Every public table has row level security except the global ones listed in
`crates/medbrains-server/tests/rls_gap_tables_test.rs` (`GLOBAL_TABLES`, mirrored
in `scripts/check_rls.py`). `make check-rls` and that test fail on a new table
that is neither.

## Boot check

After migrations, the server runs:

```sql
SELECT current_user, rolsuper, rolbypassrls,
       EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tableowner = current_user)
FROM pg_roles WHERE rolname = current_user;
```

If any of the three is true, it logs an **ERROR**: `DATABASE_URL connects as a role that
row level security does not apply to`. It keeps booting, because refusing to start would
turn an existing install into an outage. When the request pool is correct, it logs
`request pool is subject to row level security` at INFO.

## How installs get the roles

`deploy/standalone/db-roles.sh` does this. `install.sh` sources it, and you can
also run it on its own:

1. It reads the owner URL from `MIGRATION_DATABASE_URL`, or from `DATABASE_URL`
   if the install has not been split yet.
2. It creates both roles **if they do not exist yet**, with the same attributes
   the migrations give them. Then it sets `LOGIN PASSWORD` on both. If the env
   file already names a role, that role keeps its existing password, so a re-run
   changes nothing. Grants stay with migrations 0981/0984.
3. It runs that SQL as the owner. On the dedicated host this goes through
   `docker exec` into `medbrains-postgres`. On a reused host Postgres it goes
   over the owner URL, and falls back to `sudo -u postgres` if the owner cannot
   create a BYPASSRLS role.
4. It logs in as each role over TCP with the new password. Only if both logins
   work does it write all three URLs. All three share the owner's host, port,
   database and options. If anything fails, the env file is left unchanged.

Why install.sh creates the roles instead of waiting for migrations: migrations
only run when the server boots, and the server boots on whatever the env file
names. Waiting would mean the first boot connects as the owner and a second
step switches it later. Creating the roles first (idempotently, the same way the
migrations do) means the first boot already connects as `medbrains_app`. Then
0981/0984 take the `ELSE` branch and apply the grants.

What `install.sh` does in each case:

| Env file | Action |
|---|---|
| new (first install) | splits into three roles |
| already split (`MIGRATION_DATABASE_URL` set) | re-runs: keeps passwords, re-derives URLs (attach port changes are picked up) |
| existing single-role install | **does not switch** and prints a NOTE. Switch on purpose: `DB_ROLE_SPLIT=1`, or the steps below |

With attach and `ATTACH_REUSE_POSTGRES=1`, `ATTACH_DATABASE_URL` is the owner.
`install.sh` writes it to whichever key holds the owner.

## Switching an existing install (one time)

You need the host, root, `psql`, and migrations at 0984 or later. These steps
were written for the attach host (host Postgres, `sudo -u postgres` works). On
the dedicated docker host they are the same, because the script uses the
container automatically.

```bash
# 0. Ship the two changed kit files to the host (from the repo).
scp deploy/standalone/db-roles.sh deploy/standalone/medbrains-pg-backup <host>:/tmp/

# On the host:
# 1. Back up the env (it holds every credential; keep it root-only).
STAMP=$(date +%Y%m%d-%H%M%S)
sudo cp -p /etc/medbrains/env /etc/medbrains/env.pre-roles.$STAMP

# 2. Preconditions. Expect: version >= 984; both roles present with
#    rolsuper=f, app bypassrls=f, worker bypassrls=t; 0 tables the app cannot read.
sudo -u postgres psql -d medbrains -tAc "SELECT max(version) FROM _sqlx_migrations"
sudo -u postgres psql -d medbrains -tAc \
  "SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles
   WHERE rolname IN ('medbrains_app','medbrains_outbox_worker')"
sudo -u postgres psql -d medbrains -tAc \
  "SELECT count(*) FROM pg_tables WHERE schemaname='public'
   AND NOT has_table_privilege('medbrains_app', format('%I.%I',schemaname,tablename), 'SELECT')"

# 3. Backups must dump as the owner after the switch. Install the new script first.
sudo install -m 0755 /tmp/medbrains-pg-backup /usr/local/bin/medbrains-pg-backup

# 4. Set the passwords and rewrite the env. Prints role names only, never a secret.
sudo bash /tmp/db-roles.sh /etc/medbrains/env

# 5. Restart.
sudo systemctl restart medbrains-server
```

### Verify

```bash
# Requests now come from medbrains_app. Workers come from medbrains_outbox_worker.
sudo -u postgres psql -d medbrains -tAc \
  "SELECT usename, count(*) FROM pg_stat_activity WHERE datname='medbrains' GROUP BY 1"
# The superuser check, for the role DATABASE_URL now names. Expect: f|f
sudo -u postgres psql -d medbrains -tAc \
  "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname='medbrains_app'"
# Boot check (servers built with it): expect the INFO line, no ERROR.
sudo journalctl -u medbrains-server --since "-5 min" | grep -E 'row level security'
# Nothing the app role is refused.
sudo journalctl -u medbrains-server --since "-5 min" | grep -i 'permission denied' || echo none
curl -fsS https://<host>/api/health
# Tonight's backup, or now:
sudo systemctl start medbrains-pg-backup.service && sudo journalctl -u medbrains-pg-backup -n 20
```

Then sign in as a clinician and check that the patient list, a patient chart
and the OPD queue show their usual rows. Under RLS, if a screen loses its rows,
the query that feeds it is not setting the tenant. Fix the query. Do not roll
the role back for that.

A `medbrains-archive` binary older than this change still reads
`DATABASE_URL`. Under RLS it finds nothing and reports success. The next
deploy's binary uses `WORKER_DATABASE_URL`.

### Rollback

```bash
sudo cp -p /etc/medbrains/env.pre-roles.$STAMP /etc/medbrains/env
sudo systemctl restart medbrains-server
```

That brings back the single owner URL. The role passwords can stay because they
are unused. To remove them as well:
`sudo -u postgres psql -d medbrains -c "ALTER ROLE medbrains_app PASSWORD NULL; ALTER ROLE medbrains_outbox_worker PASSWORD NULL"`.
The new `medbrains-pg-backup` also works with a single URL, so leave it in place.

## Local development

`.env.example` uses all three URLs, and both roles use the password `medbrains_dev`.
Run this once per dev database (after `make db`, before `make dev-backend`):

```bash
make dev-db-roles
```

It creates the roles if migrations have not created them yet, and sets the dev
password. Test it with `bash deploy/standalone/test-db-roles.sh`. The test runs
against the dev Postgres, sets random passwords while it runs, and restores the
dev passwords on exit.

# Running the Rust database tests

Tests that need PostgreSQL get a private, migrated database each, on a real PostgreSQL 17,
connected as the role production uses (`medbrains_app`), so row level security is really on.
Decision: `docs/DECISIONS.md`, 2026-11-16.

## Once per machine

PostgreSQL 17 from Homebrew (`/opt/homebrew/opt/postgresql@17`). Then, from `medbrains/`:

```sh
make test-db            # starts or reuses the test cluster, prints its URL
```

It is one cluster per machine, shared by every worktree and agent:

- data in `~/.local/share/medbrains-test-pg` (outside the repo), log in `server.log` there
- `127.0.0.1:54317` only, durability off (`fsync`, `full_page_writes`)
- auth: the superuser `medbrains` needs the fixed test password `medbrains_test`; only
  `medbrains_app` and `medbrains_outbox_worker` (the migrations' two login roles, which have no
  password) are trusted on loopback. The unix socket sits in the 0700 data dir. `pg_hba.conf` is
  rewritten on every `make test-db`
- a marker database, `medbrains_test_cluster`, which the helper insists on
- never Docker, never the dev database (5435), never `infra/.env`
- `bash scripts/test_db.sh stop` stops it; `make test-db` again starts it in under a second

Another server: set `MEDBRAINS_TEST_PG` to a superuser URL on its `postgres` database. The helper
refuses it unless it is on loopback, is not the dev port 5435, and has a `medbrains_test_cluster`
database: it creates, migrates and drops databases, and must never do that to a dev or live
cluster. `MEDBRAINS_TEST_PG_ALLOW_ANY=1` overrides, deliberately. The two app roles must be able to
log in without a password (trust on loopback for those two only), as in CI.

## Running

```sh
make test-db
bash scripts/build_guard.sh --wait && SQLX_OFFLINE=true cargo test -p medbrains-db --test tenant_conn --test tenant_walls
```

No `--ignored`, no `DATABASE_URL`. If the server is down the tests **fail** with
`no test PostgreSQL at … Run make test-db`. They never skip: a skipped safety test reports the
same as a passing one.

## Timings (M-series Mac, 347 migrations, 88 MB template)

| | |
|---|---|
| First test after a migration change (builds the template) | about 5 s |
| Every later test (copy + drop) | about 1.2 s |
| `tenant_conn` (11 tests, in parallel) | 10 s warm, 17 s cold |

## Writing one

```rust
use medbrains_db_migrations::testing::{APP_ROLE, add_patient, add_tenant, fresh_db};

#[tokio::test]
async fn the_request_role_sees_only_its_hospital() {
    let db = fresh_db().await.expect("test database"); // dropped with `db`
    let owner = db.owner().await.expect("owner pool"); // fixtures, as the schema owner
    let tenant = add_tenant(&owner, "FIRST").await.expect("tenant");
    add_patient(&owner, tenant, "UH-1").await.expect("patient");
    let app = db.connect(APP_ROLE).await.expect("request role"); // what you assert through
    // ...
}
```

- Add `medbrains-db-migrations = { path = "../medbrains-db-migrations", features = ["testing"] }`
  under `[dev-dependencies]`. Never as a normal dependency: every migration would rebuild you.
- Assert through `APP_ROLE` (or `WORKER_ROLE` for background passes), not the owner, which is a
  superuser and skips row level security. `connect` checks, every time, that `APP_ROLE` is
  NOSUPERUSER NOBYPASSRLS (and the worker NOSUPERUSER BYPASSRLS): roles are cluster-wide, so one
  `ALTER ROLE` anywhere would otherwise make every RLS test a superuser's.
- An isolation test must put a victim row in **every** table it attacks and assert each one is
  non-empty (`tenant_walls.rs`). Counting rows over all tables lets an empty table pass.
- `db.url(role)` gives a URL for code that builds its own pool, e.g.
  `medbrains_db::pool::create_pool_with_config`.
- No clean-up code and no shared fixtures: the database is yours alone and is dropped after.

## How it works

1. The migrations' fingerprint (version + checksum of every embedded migration) names a template,
   `mb_tpl_<hash>`. The first test to need it builds it as `mb_build_<hash>` under an advisory
   lock, then renames it, so a template that exists is complete. The newest 3 are kept for
   other worktrees; older ones are dropped.
2. Each test runs `CREATE DATABASE mb_t_<secs>_<pid>_<n> TEMPLATE mb_tpl_<hash>`.
   If another worktree trimmed the template in between, it is rebuilt and the copy retried once.
3. Dropping the `TestDb` drops the copy (`WITH (FORCE)`), panics included. Copies older than an
   hour that nobody is connected to (a killed run) are swept by the next test. Only names matching
   `^mb_(t|tpl)_[0-9a-z_]+$` are ever formatted into DDL.

A session connected to a template (say `psql` left open on `mb_tpl_…`) makes every copy fail with
"source database is being accessed by other users". Close it.

## The server's integration suite: a database per runner slot

`crates/medbrains-server/tests/` is one binary of about a thousand tests that share one seeded
hospital, and some of them change hospital-wide settings. They cannot each have a database
(seeding one costs more than the test), and they cannot share one in parallel.

- `cargo test -p medbrains-server --test integration`: unchanged. One database (`DATABASE_URL`,
  the dev database by default), one test at a time.
- `cargo nextest run`: every test is a process, and nextest gives each running test a slot
  number no other running test has (`NEXTEST_TEST_GLOBAL_SLOT`, from 0; see
  <https://nexte.st/docs/configuration/env-vars/>). The harness asks
  `testing::slot_db(run id, slot)` for "this slot's database": the first test in a slot copies
  the template under an advisory lock (`mb_t_<secs>_<run>_s<slot>`), the next ones find it by
  name. `DATABASE_URL` is not used; the test cluster (`make test-db`) is.
- Slots = nextest's `test-threads` (`-j`). CI's `ci` profile uses 4.
- Connections: a slot's pools open at most 10 each (`SLOT_POOL_MAX` in `tests/common.rs`), and
  one more holds the database open, so the stale sweep cannot drop it mid-test. 21 per slot at
  worst; keep slots x 21 under the server's `max_connections` (100 on CI, 300 on the test
  cluster).
- Nothing drops a slot's database at the end of a run: nextest has no end-of-run hook. It is
  swept like any copy, by the first test database made more than an hour later. On CI the runner
  is thrown away.

## CI

`scripts/ci_postgres.sh` (used by the Rust test, coverage and E2E jobs) trusts the two app roles on
loopback (the superuser and the E2E server keep their password), creates the marker database and
exports `MEDBRAINS_TEST_PG`, so the converted tests run in the ordinary `cargo nextest` step.

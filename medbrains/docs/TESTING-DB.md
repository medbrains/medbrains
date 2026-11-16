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
- `127.0.0.1:54317` only, trust auth, durability off (`fsync`, `full_page_writes`)
- never Docker, never the dev database (5435), never `infra/.env`
- `bash scripts/test_db.sh stop` stops it; `make test-db` again starts it in under a second

Another server: set `MEDBRAINS_TEST_PG` to a superuser URL on its `postgres` database. The roles
the migrations create must be able to log in without a password (trust on loopback), as in CI.

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
  superuser and skips row level security.
- `db.url(role)` gives a URL for code that builds its own pool, e.g.
  `medbrains_db::pool::create_pool_with_config`.
- No clean-up code and no shared fixtures: the database is yours alone and is dropped after.

## How it works

1. The migrations' fingerprint (version + checksum of every embedded migration) names a template,
   `mb_tpl_<hash>`. The first test to need it builds it as `mb_build_<hash>` under an advisory
   lock, then renames it, so a template that exists is complete. The newest 3 are kept for
   other worktrees; older ones are dropped.
2. Each test runs `CREATE DATABASE mb_t_<secs>_<pid>_<n> TEMPLATE mb_tpl_<hash>`.
3. Dropping the `TestDb` drops the copy (`WITH (FORCE)`), panics included. Copies older than an
   hour that nobody is connected to (a killed run) are swept by the next test.

A session connected to a template (say `psql` left open on `mb_tpl_…`) makes every copy fail with
"source database is being accessed by other users". Close it.

## CI

`scripts/ci_postgres.sh` (used by the Rust test, coverage and E2E jobs) adds loopback trust and
exports `MEDBRAINS_TEST_PG`, so the converted tests run in the ordinary `cargo nextest` step.

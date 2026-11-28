# Two hospitals on one Mac

`scripts/dev/two_hospitals.sh` runs two fully separate MedBrains installs side
by side, so anything that moves between hospitals (a referral, a transfer, an
ABDM consent exchange) can be tried on a laptop before any cloud account is
involved. Each hospital has its own PostgreSQL 17 cluster, its own debug server
with its own JWT pair, and its own web dev server. They share nothing.

| | Web | API | PostgreSQL |
|---|---|---|---|
| Hospital A | http://hospital-a.localhost:5181 | 127.0.0.1:3101 | 55431 |
| Hospital B | http://hospital-b.localhost:5182 | 127.0.0.1:3102 | 55432 |

Both sign in as `admin` / `admin123` (the development seed). The ports avoid the
normal dev stack (5432, 5435, 5436, 54317, 3000, 5173), so it can run alongside.

## Needs

- `brew install postgresql@17`
- `pnpm install` in `medbrains/` (the script builds the web app's workspace
  packages on first start)
- the server binary, built once. Check the machine is free first:

```bash
cd medbrains
bash scripts/build_guard.sh --wait
SQLX_OFFLINE=true CARGO_TARGET_DIR=/tmp/mb-target-two-hosp \
  cargo build -p medbrains-server --bin medbrains-server
```

The script never starts cargo itself. Point it at another binary with
`SERVER_BIN=/path/to/medbrains-server`.

## Run

```bash
scripts/dev/two_hospitals.sh start    # first start runs every migration: a few minutes
scripts/dev/two_hospitals.sh status
scripts/dev/two_hospitals.sh stop     # data is kept
scripts/dev/two_hospitals.sh reset    # stop and delete both installs
```

Data and logs live in `$TWO_HOSP_HOME`, by default `/tmp/mb-two-hosp/state`.
Each hospital has its own `server.log`, `web.log` and `postgres.log` there. To
use psql on a hospital, run
`PGPASSWORD=medbrains_dev psql -h 127.0.0.1 -p 55431 -U medbrains medbrains`.
Use port 55432 for Hospital B.

## How it is set up

- **Separate host names.** Browsers keep one cookie jar per host and ignore the
  port. On a single host, signing in to B would sign A out.
- **No SpiceDB.** With `SPICEDB_ENDPOINT` unset, each server uses the
  Postgres-native authz backend. A shared SpiceDB would merge both hospitals'
  relations.
- **No repo `.env`.** Each server runs from its own state directory with a clean
  environment, so the repo's `.env` and `config.toml` are never read.
- **CORS is a placeholder.** The browser reaches each API through its Vite proxy
  on the same origin, so CORS is never used. The server refuses a non-HTTPS
  `CORS_ORIGIN`, so the script sets a placeholder HTTPS one.
- **Each server knows its own address.** `MEDBRAINS_PUBLIC_BASE_URL` is set to
  each server's own address. This is where an ABDM health-information push
  meant for that hospital would land.
- **Messages are simulated.** SMS, WhatsApp and email go to the message
  simulator (Admin, Message Simulator), never out.
- **PDFs are optional.** To render PDFs, set `GOTENBERG_URL` (for example to a
  running rustenberg).

Use invented patients only. Never load real records into either hospital.

## What it is for

It is for testing a patient record that leaves A and arrives at B. Today the
code has no path that does this end to end between two installs. See the
2026-11-28 findings in issue #6289. This setup is the bench those changes will
be proven on.

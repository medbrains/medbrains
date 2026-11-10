---
title: Run MedBrains locally
sidebar_position: 2
description: "Run the MedBrains server, database and web app on your own machine for development: prerequisites, make targets, first sign-in, and running this docs site."
---

# Run MedBrains locally

**You need:** macOS or Linux, Docker, Rust via `rustup`, Node 24 and pnpm 10.
The first Rust build is large: 16 GB of RAM and about 60 GB of free disk are
recommended.

## Start the server

```bash
git clone https://github.com/medbrains/medbrains.git
cd medbrains/medbrains
cp .env.example .env
make db              # PostgreSQL and supporting services in Docker
make dev-db-roles    # the app's database roles
make dev-backend     # builds and runs the server on :3000; migrations run on start
```

## Start the web app

In a second terminal:

```bash
cd medbrains/medbrains
pnpm install
pnpm dev:web         # http://localhost:5173
```

**Sign in** with hospital code `DEFAULT` and username `admin`. In
development the password is shown on the sign-in page under "Dev
credentials". Set `MEDBRAINS_SEED_ADMIN_PASSWORD` before the first start to
choose your own, and `MEDBRAINS_SEED_DEMO_DATA=true` for sample data.

`make dev` starts everything at once behind a local HTTPS proxy. Run
`make help` for every target.

:::warning One cargo build at a time
Run `scripts/build_guard.sh` before any `cargo build`, `check`, `test` or
`clippy`. Two builds at once thrash the machine. Build only the crate you
changed: `cargo clippy -p <crate>`.
:::

## Run this docs site

```bash
pnpm --filter @medbrains/docs dev      # http://localhost:3010/help/
pnpm --filter @medbrains/docs build    # fails on any broken link
```

`build:public` builds it for `docs.medbrains.in`, at the root path.

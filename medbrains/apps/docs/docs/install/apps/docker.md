---
title: Try MedBrains with Docker
sidebar_label: Docker (trials)
sidebar_position: 3
description: "Run MedBrains in containers for a trial with the on-prem compose kit on Linux, Windows or macOS: build the image, start it, and why it is not for real data."
---

# Try MedBrains with Docker

**Who:** someone evaluating MedBrains on a laptop or a test server.
**You need:** Docker with Compose v2, Git, and Node 24 with pnpm 10 (to build the web app).

:::caution Trials only
The on-prem compose kit starts the server in development mode: it makes
temporary sign-in keys at every start and uses built-in development values for
the data keys. Do not put patient data in it. For a real hospital use the
[OS appliance](/install/os/) or the [Linux server kit](/install/apps/server/).
:::

## 1. Get the image

The release workflow pushes the server image to
`ghcr.io/medbrains/medbrains:<version>` when a release is published. For
v3.33.0 that job failed, so no image exists for it; build the image yourself:

```bash
git clone https://github.com/medbrains/medbrains.git
cd medbrains/medbrains
docker build -t medbrains-server:local -f Dockerfile .
```

The first build compiles the whole server and takes a long time.

## 2. Build the web app and start

```bash
pnpm install --frozen-lockfile
pnpm --filter @medbrains/web build
cd deploy/onprem
cp .env.example .env              # then set POSTGRES_PASSWORD in .env
docker compose --env-file .env up -d
```

Only the Caddy front publishes ports (80 and 443). PostgreSQL and the server
are reachable only inside the compose network.

## Check it worked

```bash
docker compose ps                                  # every service "running"
docker compose logs medbrains-server | tail -20
```

Open `https://localhost`. Accept the local certificate warning.

## If it fails

| What you see | What to do |
|---|---|
| `set POSTGRES_PASSWORD` | Set it in `.env` |
| `set WEB_DIST` | Build the web app first (step 2), or point `WEB_DIST` at an unpacked `medbrains-web-dist.tar.gz` |
| Everyone is signed out after a restart | Expected in this kit: the sign-in keys are temporary |

**Deeper:** [`deploy/onprem/README.md`](https://github.com/medbrains/medbrains/blob/main/medbrains/deploy/onprem/README.md).

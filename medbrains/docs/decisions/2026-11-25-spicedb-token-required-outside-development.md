---
date: 2026-11-25
title: SPICEDB_ENDPOINT without SPICEDB_TOKEN refuses to start outside development
status: decided
area: security
---

## What

`AppConfig::spicedb` (`medbrains-server-core/src/config/spicedb.rs`) returns `SPICEDB_TOKEN`, or — only when
`MEDBRAINS_ENV=development` (the same rule the JWT pair follows) — the local key `devsecret`.
Any other mode, including an unknown one, refuses to start with a message naming the fix.

This is a security change: the owner reads it before merge.

## Why

The server fell back to `devsecret`, which is public in this repository, whenever the token was
unset: a production SpiceDB started with that key would be reachable by anyone, and one started
with a real key would refuse the server, which then ran on the Postgres backend without saying so.

## Rejected

- A separate dev flag: `MEDBRAINS_ENV=development` already is the explicit switch, and the dev
  scripts set `SPICEDB_TOKEN` themselves.
- A preflight finding only: preflight runs after the SpiceDB connection is made, so the token would
  already have been sent.

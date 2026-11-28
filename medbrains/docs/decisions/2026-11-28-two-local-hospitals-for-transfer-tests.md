---
date: 2026-11-28
title: Inter-hospital transfers are tested on two separate local installs
status: decided
area: interop
---
## What

Inter-hospital transfer testing runs on two separate local installs (`scripts/dev/two_hospitals.sh`, guide `docs/dev/two-hospitals.md`). Each hospital has its own PostgreSQL 17 cluster, its own debug server with its own JWT pair, and its own Vite server on its own host name (`hospital-a.localhost`, `hospital-b.localhost`). Neither uses SpiceDB; both run the Postgres-native authz backend.

## Why

The owner asked to prove a paperless A-to-B transfer on this Mac, free, before any AWS spend. Browsers keep one cookie jar per host, so two ports on one host would sign one hospital out. A shared SpiceDB would merge the two hospitals' relations.

## Rejected

Two tenants in one database: that is the same-install multi-hospital case, not a transfer between installs. Docker: local development went native on 2026-11-16. A cloud pair: it needs the owner's approval for the spend.

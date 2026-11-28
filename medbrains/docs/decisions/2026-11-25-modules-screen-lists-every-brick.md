---
date: 2026-11-25
title: The Modules screen lists every brick the server serves, set up or not
status: decided
area: bricks
---

## What

`GET /api/setup/modules` returns one row per brick in `medbrains_core::bricks::BRICKS`, then any
other stored row. A brick with no `module_config` row is listed with status `available` and a nil
id. Each row carries `on`: what the module check (`effective_outcome`) answers for it, its
dependencies included. The card says "On", "On (never set up)" or "Off". Switching a brick writes
its row with an upsert, so a brick that was never set up can be switched off from the screen.

## Why

A missing row counts as on for the server, but the screen only drew stored rows and drew
`available` as Off. Seven specialties had no card and could not be switched off from the app, so a
hospital could not be cut down to Registration + OPD without SQL.

## Rejected

- Seeding a row for every brick per tenant: it changes every existing hospital's data to fix a
  read, and a brick added later would have the same gap again.
- A separate "set up" flag in the response: `available` and no row already mean the same thing to
  the module check, so the status says enough.

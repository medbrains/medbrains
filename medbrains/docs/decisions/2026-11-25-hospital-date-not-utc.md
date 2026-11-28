---
date: 2026-11-25
title: "Today" is the hospital's date, and a check refuses new UTC dates
status: decided
area: platform
---

## What

Rust code that needs today's date reads the hospital's date:
`medbrains_server_core::hospital_time::tenant_local_today`, or `CURRENT_DATE` inside a
tenant transaction or on a `tenant_conn` (both set the hospital's `TimeZone`).
`scripts/check_utc_today.py` (CI and `make check-utc-today`) fails a new
`Utc::now().date_naive()` or `chrono::Local` outside `hospital_time.rs` unless the line says
`// utc-date: <reason>`. The 60 sites left when it landed are counted per file in
`scripts/utc_today.baseline.json` and may only fall (`--tighten` after a fix).

## Why

The UTC date is yesterday's in India from 00:00 to 05:30. At 66 sites that meant a CSSD
pack that expired yesterday was accepted, a consent valid until yesterday read valid, a
newborn's lab result got the wrong reference band, a patient's age was a year short on
their birthday, OT and queue boards opened on yesterday and the kiosk refused today's
appointments. `chrono::Local` is the server's zone, which need not be the hospital's.

## Rejected

- Fixing every site in one pull request: too large to review; the safety and money sites go
  first in small pull requests and the baseline holds the rest.
- A per-site allowlist instead of counts: line numbers move with every edit; counts per file
  are what the other ratchets in `scripts/` use.

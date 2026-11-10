---
title: Modules, flags and runtime settings
sidebar_position: 4
description: "How MedBrains turns modules on and off per hospital with bricks, how tenant settings layer, how config loads from environment variables, and why no flags."
---

# Modules, flags and runtime settings

## Modules (bricks)

Every module is a **brick**, defined once in
`crates/medbrains-core/src/bricks.rs`: its id, name, the bricks it depends on,
its permission groups, whether it is an add-on, and the editions it ships in.
The brick id is the value stored in `module_config.code` for each hospital.

| Piece | Where | What it does |
|---|---|---|
| Brick table | `medbrains-core/src/bricks.rs` | The single list of modules and their dependencies |
| Server gate | `medbrains-server-core/src/middleware/entitlement.rs` | `gated(code, router, state)` wraps a module's routes: **403** while the brick is off, **503** while its status cannot be read. A brick is on only when it and everything it needs are on |
| Switch rules | same file, `switch_blockers` | Refuses a switch that would leave a brick without what it needs |
| Admin screen | `apps/web/src/pages/admin/settings/ModulesSettings.tsx` | **Admin** → **Settings** → **Modules** |
| Menu | `apps/web/src/config/navigation.ts` | Hides a switched-off module's menu |
| Check | `make check-bricks` | Every module name comes from `bricks.rs` |

## Feature flags

There is no separate feature-flag system. A capability is a brick (per
hospital), a permission (per role or user), or a tenant setting.

## Tenant settings

Hospital settings live in the `tenant_settings` table, as `category/key`
paths. Read them through `medbrains-kernel/src/config.rs` (`setting_in`), or
the wrappers in `medbrains-server-core/src/tenant_config.rs`, which fall back
to a default. Writes go through `settings_guard.rs`. Today only the
hospital-wide scope is read; the narrower layers (campus, building, floor,
department, user) are planned.

## Server configuration

`crates/medbrains-server-core/src/config.rs` loads, later winning:

1. compiled defaults;
2. `config.toml` (copy `config.toml.example`);
3. environment variables, with `.env` loaded first.

Other crates also read variables directly. Every one is in the
[environment variables](/developer/reference/env-vars/) table, generated from
the code.

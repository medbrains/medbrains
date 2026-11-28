---
date: 2026-11-23
title: The role-access journey reads the menu one app panel at a time
status: decided
area: testing
---

## What

`e2e/journeys/role-access.spec.ts` takes the menu from `APP_SCREENS` (the registry the menu is built from) and reads the side panel once for the core screens and once inside each app the role has a screen in. It no longer reads `docs/testing/nav-menu.json`.

## Why

The launcher replaced the whole-menu sidebar on 2026-11-17: the panel lists one app. The journey still expected every screen in one panel, so it failed for every role, and the exported menu file it compared against was last generated before the screen registry existed.

## Rejected

- Regenerating `nav-menu.json` and keeping the one-panel read: the panel would still show one app.
- Reading the launcher tiles only: a tile is an app, not a screen, so a missing screen inside an app would pass.

---
title: MedBrains architecture
sidebar_label: Architecture
sidebar_position: 1
description: "MedBrains architecture on one page: a Rust Axum server, PostgreSQL with row-level security per hospital, React and Mantine web, native apps and the OS box."
---

# Architecture

MedBrains is one server, one database, and several kinds of screen.

| Part | Built with | Where |
|---|---|---|
| Server | Rust (edition 2024), Axum, Tokio | `medbrains/crates/` (about 119 crates, split by department) |
| Database | PostgreSQL 17, SQLx with compile-time checked queries | `medbrains/crates/medbrains-db-migrations/` |
| Web app | React 19, TypeScript, Mantine, TanStack Query, Zustand | `medbrains/apps/web/` |
| Native apps | SwiftUI (iOS) and Jetpack Compose (Android) | `medbrains/apps/ios/`, `medbrains/apps/android/` |
| OS box | Debian stable, the server, PostgreSQL, a native screen | `medbrains/os/` |
| Docs | Docusaurus (this site) | `medbrains/apps/docs/` |

## The rules that shape it

- **One server, many hospitals.** Every hospital-scoped table has a
  `tenant_id` and PostgreSQL row-level security. Each request sets its tenant
  inside its transaction, and the app connects as a non-owner role, so a query
  that forgets its tenant returns nothing rather than everything.
- **SQL checked at compile time.** A query that does not match the schema does
  not build. Offline metadata lives in `.sqlx/`.
- **Permissions first.** Every action has a permission defined in Rust before
  any handler or screen. See [permissions](/developer/reference/permissions/).
- **A fault is not a refusal.** Authorization has three outcomes: allow, deny
  and unknown. An outage is never shown as an empty list.
- **The kernel.** Apps reach shared concerns (tenancy, authorization, audit,
  configuration, sequences, storage) only through `medbrains-kernel`, and the
  kernel holds nothing about hospitals. CI enforces both.

The full design is in
[`ENGINEERING.md`](https://github.com/medbrains/medbrains/blob/main/ENGINEERING.md)
and the RFCs under `RFCs/`.

## Next

[Run MedBrains locally](/developer/run-locally/).

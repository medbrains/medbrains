---
title: Permissions for developers
sidebar_position: 6
description: "How a MedBrains permission is defined in Rust, generated to TypeScript, granted to built-in roles and checked in the server and the UI, in that order."
---

# Permissions

Every feature defines its permission **before** any handler, page or button.
Rust is the single source of truth.

| Step | Where | Command or call |
|---|---|---|
| 1. Define | `crates/medbrains-core/src/permissions.rs`, with a `///` doc comment. The first sentence becomes the UI label | — |
| 2. Generate | `packages/types/src/permissions.ts` (never hand-edit) | `python3 scripts/generate_permissions_ts.py` |
| 3. Grant | `crates/medbrains-core/src/access/roles.rs` | the compiler checks the reference |
| 4. Guard the server | the handler or service | `require_permission(&claims, permissions::…)`, or `Authorized<R>` / `AllOf` / `AnyOf` |
| 5. Gate the UI | the route and each mutating control | `useRequirePermission`, `useHasPermission` |
| 6. Prove | — | `make check-permissions`, `make check-role-templates` |

A missing permission is created, never borrowed from a nearby one. A fault in
an authorization check is never collapsed into "denied".

The full rules, including the four axes every module must satisfy, are in
[`ENGINEERING.md`](https://github.com/medbrains/medbrains/blob/main/ENGINEERING.md)
and `RFCs/RFC-AUTHZ-2026-001-Design-and-Grammar.md`.

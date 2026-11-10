---
title: Developer reference
sidebar_label: Overview
sidebar_position: 1
description: "MedBrains engineering reference: CI/CD workflows, ratchets and quality gates, modules and settings, environment variables, OS build, permissions and the API."
---

# Developer reference

Factual pages, each naming its source of truth.

| Page | Source of truth |
|---|---|
| [CI/CD](/developer/reference/ci-cd/) | `.github/workflows/` |
| [Ratchets and quality gates](/developer/reference/ratchets/) | `medbrains/scripts/check_*.py` and their baselines |
| [Modules, flags and settings](/developer/reference/modules-and-settings/) | `crates/medbrains-core/src/bricks.rs`, `tenant_settings` |
| [Environment variables](/developer/reference/env-vars/) | Generated from the crates and `.env.example` |
| [OS build](/developer/reference/os-build/) | `medbrains/os/README.md`, `medbrains/Makefile` |
| [Permissions](/developer/reference/permissions/) | `crates/medbrains-core/src/permissions.rs` |
| [API reference](/developer/reference/api/) | Generated from `docs/openapi.json` |

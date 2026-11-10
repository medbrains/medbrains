---
title: CI/CD workflows
sidebar_position: 2
description: "Every MedBrains GitHub Actions workflow: triggers, jobs, which jobs block a merge, the smart-CI path rule, draft pull requests and the signed release flow."
---

# CI/CD

Source of truth: `.github/workflows/` at the repository root. The old copies
under `medbrains/.github/workflows/` never ran and are gone. This page should
be generated from the workflow files later.

## Workflows

| Workflow | Runs on | Jobs |
|---|---|---|
| `ci.yml` (CI) | Push to `main`/`master`; pull requests (opened, synchronize, reopened, ready for review). Ignores `*.md`, `*.png`, `*.excalidraw` | What changed; Audit checks (RLS, sharing, egress, PCI); Every new function is documented (PRs); API + UI contracts; Rust format; Web typecheck, lint, test, build; Web lint; Rust clippy; Schema + tenancy; Rust tests |
| `security.yml` | Push, pull requests, daily | cargo audit, cargo deny, pnpm audit, website audit, secrets scan (TruffleHog), dependency review, CodeQL, SBOM; OSV, Checkov and zizmor report only |
| `sonarqube.yml` | Push and PRs to `main` | SonarQube Cloud analysis (skips until `SONAR_TOKEN` is set) |
| `release.yml` | Tags `v*`, manual | Build server, build web, Docker image, release, desktop |
| `desktop.yml` | Called by release, manual | Desktop builds per OS and architecture |
| `fhir-validator.yml` | PRs touching FHIR/NHCX code, nightly, manual | HL7 validator over ABDM and NHCX bundles |
| `spicedb-validate.yml` | Changes to `infra/spicedb/schema.zed` | `zed validate`, apply to the dev cluster |
| `publish-sdks.yml` | Manual | Publish the TypeScript SDK to npm and the Python SDK to PyPI |
| `claude-signin-check.yml` | Manual | Check Claude API access from Actions |

## What blocks a merge

In `ci.yml`, jobs **without** `continue-on-error` block: audit checks,
function docs, API + UI contracts, and the web job. Rust format, web lint,
Rust clippy, schema + tenancy and Rust tests run with `continue-on-error`:
they are the backlog, shown but not blocking. Sonar is not a required check.

:::note
`medbrains/.github/BRANCH_PROTECTION.md` lists required check names that no
longer match today's jobs, and branch protection is documented but not
evidenced as enforced. Treat the list above, read from `ci.yml`, as current.
:::

## Smart CI

The **What changed** job diffs the PR and sets two outputs:

| Output | True when a change touches |
|---|---|
| `rust` | `crates/`, `Cargo.toml`/`Cargo.lock`, `.sqlx/`, toolchain, rustfmt, deny or clippy config |
| `web` | `apps/web/`, `packages/`, `package.json`, pnpm files, `turbo.json`, `biome.json`, `.nvmrc`, `tsconfig` |

Rust jobs run only when `rust` is true; web jobs only when `web` is true.
**A skipped job counts as passing** for required checks. A change to `ci.yml`
itself, a new branch, a force-push or a diff that cannot be computed runs
everything. Workflow-level `paths` filters were rejected: a required check
whose workflow never starts blocks the merge forever.

**Draft pull requests skip CI.** The contracts and build jobs do not run on a
draft; marking it ready for review runs everything.

## Releases

1. A maintainer pushes a tag `vX.Y.Z`. Only a tag publishes a release.
2. The workflow builds the server and web app and a multi-arch Docker image
   (pushed to GHCR, signed keyless with cosign, with provenance and an SBOM).
3. It writes the notes from the version's section of `CHANGELOG.md`, makes a
   source SBOM, the tarballs `medbrains-server-linux-x64.tar.gz` and
   `medbrains-web-dist.tar.gz`, and a signed `SHA256SUMS`.
4. It creates a **draft** GitHub release (a pre-release for `-alpha`, `-beta`
   or `-rc` tags). A maintainer reviews and publishes it.
5. Desktop builds run in the tag-only `release` environment, which holds the
   signing secrets: `TAURI_SIGNING_PRIVATE_KEY`,
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, `APPLE_CERTIFICATE`,
   `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`,
   `APPLE_PASSWORD`, `APPLE_TEAM_ID`, `WINDOWS_CERTIFICATE`,
   `WINDOWS_CERTIFICATE_PASSWORD`.

A release is not a deploy: production is built with `cargo zigbuild` on the
operator's machine. How to verify a release:
`medbrains/docs/SECURITY-RELEASE-PROCESS.md`.

## Run the checks locally

See [tests, checks and hooks](/developer/tests-and-hooks/). Every
`make check-*` target is listed by `make help`.

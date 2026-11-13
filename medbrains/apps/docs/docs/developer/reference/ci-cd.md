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
2. The workflow builds the server, web app, OS images, every native Android
   app (`apps/android/app-*`, APK and AAB), every iOS app (`apps/ios`), and the
   desktop client for macOS (universal `.dmg`), Windows (`.msi`, `.exe`) and
   Linux (`.AppImage`, `.deb`, `.rpm`).
3. It writes the notes from the version's section of `CHANGELOG.md`, makes a
   source SBOM, the tarballs `medbrains-server-linux-x64.tar.gz` and
   `medbrains-web-dist.tar.gz`, and a signed `SHA256SUMS`.
4. It creates a **draft** GitHub release (a pre-release for `-alpha`, `-beta`
   or `-rc` tags). The desktop job then uploads its installers, updater
   signatures and `latest.json`, and the last job (`release-files`) adds them to
   `SHA256SUMS`, re-signs it and appends a "which file for which device" table
   to the notes. A maintainer reviews and publishes the draft.
5. Publishing the draft builds the multi-arch Docker image, pushes it to GHCR
   (tagged `X.Y.Z` and `X.Y`, never by commit), signs it keyless with cosign,
   attests its provenance and adds its signed SBOM to the release. A tag push
   or a manual run never pushes an image.
6. Signing secrets live only in the tag-only `release` environment; a manual
   run joins no environment, builds everything unsigned and publishes nothing.
   Each platform signs only when its secrets are all set, and otherwise ships
   its files with `-unsigned` in the name:

   | Platform | Secrets |
   |---|---|
   | Android (APK + AAB) | `ANDROID_KEYSTORE_B64` (base64 keystore), `ANDROID_KEYSTORE_PASSWORD` (also the key's password), `ANDROID_KEY_ALIAS` |
   | iOS (App Store `.ipa`) | `APPLE_DIST_CERT_P12` (base64 Apple Distribution `.p12`), `APPLE_DIST_CERT_PASSWORD`, `APPLE_TEAM_ID`, `APPLE_PROFILE_STAFF` and `APPLE_PROFILE_PATIENT` (base64 App Store provisioning profiles for `com.medbrains.staff` and `com.medbrains.patient`; the patient one must carry HealthKit). Nothing is uploaded to App Store Connect. |
   | Desktop updater | `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` |
   | macOS desktop | `APPLE_CERTIFICATE` (base64 Developer ID Application `.p12`), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`; notarization with `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY_P8` (App Store Connect API key, `.p8` contents) or `APPLE_ID` + `APPLE_PASSWORD` (app-specific password) |
   | Windows desktop | `WINDOWS_CERTIFICATE` (base64 `.pfx`), `WINDOWS_CERTIFICATE_PASSWORD` |
   | OS image | `OS_PCR_KEY`, `OS_PCR_CERT` |

   Linux desktop packages carry no code signature; `SHA256SUMS` and the
   provenance attestation cover them.
7. Every app carries the one product version, `[workspace.package] version` in
   `medbrains/Cargo.toml` (`make release` checks it), never a number typed per
   app. Android `versionName` and iOS `CFBundleShortVersionString` are that
   version; Android `versionCode` and iOS `CFBundleVersion` are
   major×10000 + minor×100 + patch (3.33.0 → 33300), so they rise with every
   release; minor and patch stay below 100. The desktop takes the crate's
   `version.workspace`. `scripts/app_version.sh` prints both numbers and fails
   a tag that names another version (a `-rc` tag counts as its version).

A release is not a deploy: production is built with `cargo zigbuild` on the
operator's machine. How to verify a release:
`medbrains/docs/SECURITY-RELEASE-PROCESS.md`.

## Run the checks locally

See [tests, checks and hooks](/developer/tests-and-hooks/). Every
`make check-*` target is listed by `make help`.

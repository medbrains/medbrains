---
title: Releases, branches and support
sidebar_label: Releases and support
sidebar_position: 5
description: "How MedBrains is versioned and released: SemVer, release and hotfix branches, security fix deadlines, rollout rings, and how long each major is supported."
---

# Releases, branches and support

**Who:** hospital IT planning upgrades, and contributors choosing a branch.

## Version numbers

MedBrains uses [Semantic Versioning](https://semver.org): `MAJOR.MINOR.PATCH`.
Nothing that an extension or a hospital relies on breaks inside a major
version. Pre-releases are named `-rc.N`, `-beta.N` and `-alpha.N`. The first
release was **3.33.0**; there was no 1.x or 2.x.

## Branches

| Branch | What it is |
|---|---|
| `main` | the default branch. The public docs site is built from it |
| `release/X.Y.Z` | the next version being prepared, for example `release/3.34.0`. Pull requests for it target this branch |
| `hotfix/…` | an urgent fix to a released version |
| `release/X.Y` | an emergency fix to an older major, branched from its last tag and tagged `vX.Y.(Z+1)` |

A release is a signed tag, `vX.Y.Z`. The release workflow builds, signs and
publishes every file from that tag. See
[release signing](/operate/release-signing/).

## When releases come

There is no fixed calendar yet. Security fixes have fixed deadlines, counted
from when the severity is confirmed:

| Severity | Fixed release within |
|---|---|
| Critical | 72 hours |
| High | 7 days |
| Medium | 30 days |
| Low | the next release |

## How a release reaches hospitals

| Ring | Who | Moves on after |
|---|---|---|
| Canary | sites that volunteered, and the project's own installs | 48 hours with no problem (24 for a security release) |
| Beta | hospitals that opted into early updates | 7 days (2 for a security release) |
| Stable | everyone else | — |

A problem in one ring stops the rollout. Rings are run by hand today; the
release notes say which ring a release is in. Updates are applied when the
hospital chooses, by default overnight after the backups.

## How long a version is supported

Each major version has a published end-of-support date, and that date can only
move later, never earlier. CI enforces this. Only the latest minor of a
supported major gets fixes: move from 3.33 to 3.34 freely, since nothing breaks
inside a major.

The dates are in
[COMPATIBILITY.md, section 4](https://github.com/medbrains/medbrains/blob/main/medbrains/docs/COMPATIBILITY.md#4-end-of-support-dates).

**Deeper:** [security release process](https://github.com/medbrains/medbrains/blob/main/medbrains/docs/SECURITY-RELEASE-PROCESS.md).

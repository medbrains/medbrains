---
date: 2026-11-28
title: Trial CircleCI's open-source plan for the two heavy Rust checks
status: decided
area: engineering
---
## What

Run Rust clippy and Rust tests on CircleCI's open-source plan (large Linux VMs) alongside GitHub, with the same commands as ci.yml, for one week. GitHub's ci.yml stays the required gate. Releases, signing and anything holding a secret never run on CircleCI; builds from forked PRs are off in the CircleCI project settings.

## Why

GitHub Free runs about 20 jobs at once and the Rust jobs are the heaviest, so PR checks queue for hours. The open-source plan gives 400,000 credits a month for Linux, Arm and Docker. The week measures credit use per run and whether running jobs in parallel shortens the queue, before any check moves.

## Rejected

Jenkins: a server to keep, plugin advisories, and every workflow rewritten. Moving all CI to CircleCI: releases and the boot-signing key would leave GitHub. A self-hosted GitHub runner: kept as the next step if the trial's credits fall short, for our own branches only.

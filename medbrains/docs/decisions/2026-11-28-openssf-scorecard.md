---
date: 2026-11-28
title: OpenSSF Scorecard scores the repository weekly and on every push to main
status: decided
area: engineering
---
## What

`.github/workflows/scorecard.yml` runs `ossf/scorecard-action` weekly, on every push to the default branch (`main`) and when branch protection changes. It publishes the result to api.scorecard.dev for the README badge, uploads the SARIF to code scanning and keeps it as a workflow artifact for five days. Every action is pinned to a full commit SHA, the checkout keeps no credentials and the workflow is read-only apart from the job's `security-events` and `id-token` writes.

## Why

The repository is public and hospitals will run what it builds, so the supply-chain practices behind it (pinned actions, branch protection, signed releases, review, token permissions) should be measured in public rather than claimed. The owner approved adding it on 2026-11-28.

## Rejected

Running the Scorecard CLI by hand: a one-off number goes stale and nobody sees it. Triggering on the release branches: Scorecard scores the default branch only, and the action refuses to publish from any other. Fixing the low checks in the same change: each is its own decision and its own review.

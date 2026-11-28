---
date: 2026-11-28
title: Send the existing coverage reports to Codecov for per-PR coverage comments
status: decided
area: engineering
---
## What

The SonarQube workflow already builds Rust, web and Android coverage. It now also uploads those same files to Codecov (free for open source), signing in with the run's OIDC token so no Codecov secret is stored. Codecov's statuses are informational and an upload failure never fails the run.

## Why

The owner installed the Codecov app on the repository. A coverage comment on each PR shows which changed lines no test runs, where review can see it, without adding a new coverage build.

## Rejected

A separate coverage job for Codecov: it would rebuild the whole workspace a second time. Blocking statuses: coverage numbers move with unrelated changes, and the gate stays ci.yml. A stored CODECOV_TOKEN: OIDC needs no secret.

---
date: 2026-11-28
title: Every change runs one complete local gate before it is pushed
status: decided
area: engineering
---
## What

Every change runs one complete local gate after its last edit, using the commands CI runs (fmt, clippy on all targets, the server build, the touched crates' tests with a time limit, the repo's ratchet and evidence scripts, and the web checks), then pushes. The PR body names the commands and their results.

## Why

Between 25 and 28 November many PRs failed CI on things a local run would have caught: formatting, clippy in test modules, `unreachable_pub`, decision headers, missing doc comments, the kernel boundary and an uncast aggregate. Each miss cost a full CI run in a jammed queue, a fix and another run, and shared target dirs reported passes that were not real. One proper pass costs far less than several guesses.

## Rejected

Checking only the crate that changed, or relying on CI to find what is left: that is what produced the repeated failures. Running the full gate after every edit: it wastes the same machine time the rule exists to save.

---
date: 2026-11-23
title: The server shell has a ceiling on lines and on its own routes
status: decided
area: architecture
---

## What

`make check-shell-size` measures `crates/medbrains-server/src`: every line of every `.rs`
file, and every `.route(` call. On 2026-11-23 that is 39,726 lines and 199 route calls (162 in
`routes/mod.rs`, 37 in the appointments, UHI, ABDM and debug routers that live in the shell).
A number above `scripts/shell_size.baseline.txt` fails. A number below it passes, and the PR
that moved the code out lowers the file with `--update`, which cannot raise it.

This also stops an ordinary fix that adds lines to shell code (ABDM, UHI, the patient portal
and appointments still live there). Such a PR has to take at least as many lines out, or put
the new code in the owning crate.

## Why

The agreed split ends with the server as about 3,000 lines that mount what bricks publish.
About 29,700 of its lines are domain code today. Each move out is wasted if new code lands in
the same place in the meantime.

## Rejected

- Failing on any difference from the baseline, drops included: every PR that touches the shell
  would edit the same two lines of one file, and they would conflict with each other.
- An allowlist of "real shell" files with the rest counted: it needs agreement on the list
  first, and the total falls the same way.
- Counting code lines only: then a comment is free, and the count stops matching `wc -l`.
- Two more keys in `size_budgets.json`: its `--update` accepts growth, which this must not.

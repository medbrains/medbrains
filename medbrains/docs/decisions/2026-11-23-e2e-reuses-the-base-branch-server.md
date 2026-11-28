---
date: 2026-11-23
title: E2E reuses the base branch's server when a pull request changes none of its inputs
status: decided
area: ci
---

## What

`e2e.yml`'s "Build the server" job names the server's inputs in one list, `SERVER_INPUTS`
(`crates`, `vendor`, the Cargo files, the toolchain file, `.cargo`, `.sqlx`, `pnpm-lock.yaml`,
`docs/openapi.json`, `packages/privacy/dpdp-notice.json`), and keys the built binary on git's
hashes of them.

- A push to `main` or `release/**` builds the server as before, restoring nothing, and saves
  the binary under that key.
- A pull request restores a binary with exactly that key and, on a hit, skips the build. It
  never saves.
- After every build, a step reads cargo's own list of the files the binary was compiled from
  (`target/debug/medbrains-server.d`) and fails if one is outside `SERVER_INPUTS`.

## Why

The job ran on every pull request the suite ran on, whatever the pull request changed, and
took 8 to 12 minutes (52 runs on 2026-11-22 and 23: median 9 min 37 s). The Playwright shards
wait for it. Most pull requests change no Rust, so most of those builds produced a binary the
base branch had already built from the same files. The dependency cache did not help: 2 of
those 52 runs restored one, and they still took over 9 minutes, because the time is in the
workspace's own crates.

Only a push saves, so the cache a pull request reads was built from merged code by a run that
restored nothing, and a pull request cannot write one for another to read.

## Rejected

- **Keying on `crates/` and the Cargo files only**, as ci.yml's "What changed" does. The
  server also compiles in `vendor/` (patched sqlx), `docs/openapi.json`, the privacy notice and,
  through a build script, `pnpm-lock.yaml`. A hand-kept list goes stale, which is why the
  check against cargo's list exists.
- **Letting pull requests save too.** It would help a second push to a Rust pull request, at
  about 200 MB a save against a 10 GB limit that is already 80% used.
- **Checking the restored binary's inputs file by file.** More code than the list plus the
  check, for the same answer.

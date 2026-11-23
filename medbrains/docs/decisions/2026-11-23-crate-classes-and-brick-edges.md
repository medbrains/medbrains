---
date: 2026-11-23
title: Every crate has a class, and brick to brick crate edges only shrink
status: decided
area: architecture
---

## What

`medbrains/bricks/crates.txt` gives each of the 166 workspace crates one class: kernel or base,
shared health service, one brick, several bricks, a brick to be, the shell, tooling, or native/OS.
`make check-brick-edges` fails on a new `Cargo.toml` edge (runtime, build or dev) from one
brick's crate to another brick's, from a base crate to a domain crate, or from a shared health
service to a brick. The 34 such edges that exist today are in
`scripts/brick_edges.baseline.txt`; a line is deleted when its edge is cut, and adding one
needs the owner.

The owner classed four crates as shared health services, not as one brick's: queue tokens
(`medbrains-tokens`), facilities, care management (`medbrains-care-mgmt`) and clinical scores.
That alone takes 8 edges off the brick to brick list (6 into tokens, 2 into clinical scores).

A brick listed in another's `depends_on` is still not allowed as a crate dependency.

Four dependency lines nothing used were removed: `medbrains-opd` on lab and on radiology,
`medbrains-pharmacy-fulfilment` on tokens, `medbrains-ai` on patients.

## Why

The split into kernel, bricks and a thin shell was agreed before more brick switches are built.
Nothing stopped a new brick to brick edge, so each week of other work could add one. A brick
that links another cannot be built, tested or switched off alone.

## Rejected

- Making tokens one brick's crate (registration) and adding a queue port for the other five
  callers: the crate already serves five bricks, so it is a shared service in fact.
- Letting `depends_on` permit the crate edge: it would make every declared dependency a link,
  and the order basket would link four bricks.
- An `--update` flag on the check: the baseline is short enough to edit by hand, and a flag
  that can add lines is how a ratchet stops being one.
- Reading edges from `cargo metadata`: it needs the toolchain and the network in a job that
  has neither; the manifests say the same thing.

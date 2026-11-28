---
date: 2026-11-28
title: At most 30 open pull requests, 10 waiting on the owner
status: decided
area: engineering
---
## What

Pull request guidelines in ENGINEERING.md: at most 30 open PRs and 10 waiting on the owner, above which only security and release-branch fixes are opened; one change per PR; every open PR waits on one named thing; a PR unmoved for seven days is triaged; stacks at most two deep; at most five drafts.

## Why

On 26 November 126 PRs were open, most waiting for a read. Each one conflicted with the others, reran CI whenever the base moved, and jammed a CI queue shared with every other PR. The owner: "why 110 PRs open, that is not good".

## Rejected

No limit, relying on review speed to keep up: that is what produced the pile-up. Closing old PRs automatically: closing needs the owner's yes per PR.

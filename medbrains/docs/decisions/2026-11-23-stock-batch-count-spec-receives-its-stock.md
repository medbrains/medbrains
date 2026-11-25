---
date: 2026-11-23
title: The stock batch-count spec receives the stock it reads
status: decided
area: testing
---

## What

`e2e/crud/pharmacy-stock-batch-count.spec.ts` creates its own medicine and batch with `receiveStock` and searches for that medicine by name.

## Why

It searched for any item named FEFO that another spec had stocked. In a hospital where that spec had not run yet (each worker has its own hospital) there was none, and the spec failed on an empty stock list.

## Rejected

- Ordering the specs so the stock journeys run first: workers and shards split files, so order is not kept.

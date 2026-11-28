---
date: 2026-11-23
title: The phlebotomy queue says it is empty, or that it did not load
status: decided
area: testing
---

## What

The phlebotomy tab's table says "No draws in the queue" when the queue is empty and "Could not load the draw queue" when the request failed.

## Why

It showed the table's default "No data found" in both cases, so a failed load read as an empty queue (authorization rule 6: a list must never render an outage as emptiness), and `e2e/crud/lab-phlebotomist-assign.spec.ts`, which accepts an explicit empty queue, failed in a hospital with no draws.

## Rejected

- Loosening the spec to accept "No data found": the screen would still show an outage as an empty queue.

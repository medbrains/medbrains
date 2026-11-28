---
date: 2026-11-26
title: A payment webhook writes nothing a signature has not verified
status: proposed
area: payments
---

## What

Every online provider's webhook (`receive` in `medbrains-payment-gateway`, shared by Razorpay,
Cashfree, PhonePe and PayU) now refuses an empty body or one over 64 KiB with 400 before anything
else, and no longer files a notice that names no order in `payment_webhook_exceptions`: it is
logged and answered 200 `ignored`, as before. A notice for an order no hospital made is still filed
(migration 1206, pinned by `an_unknown_order_is_filed_not_refused`), now bounded by
the 64 KiB cap.

## Why

The signature is checked with the hospital's own secret, found from the order the notice names, and
it already ran before any settlement or status change. But a body naming no order cannot be
verified by anyone, and was written, up to the 2 MB body limit, into a table no hospital's screen
can read (no tenant, so row level security hides it): an unauthenticated way to grow the database.

## Rejected

- 400 for every notice that names no order: valid provider events without an order (settlements,
  account events) would be retried for a day and could get the webhook disabled.
- Trying every hospital's secret on an unmatched notice: unbounded work per unsigned request.
- Rate-limiting the webhook routes: providers send bursts from a few addresses; a limit could drop
  real payment notices.

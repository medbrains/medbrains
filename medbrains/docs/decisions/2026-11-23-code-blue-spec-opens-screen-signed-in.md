---
date: 2026-11-23
title: The code-blue linkage opens its screen through navigateTo
status: decided
area: testing
---

## What

`e2e/linkages/code-blue.spec.ts` opens `/nurse?tab=code-blue` with `navigateTo`, which signs the
browser in again when its stored session can no longer be used. It is the only linkage spec that
opens a page.

## Why

The spec signs three staff in over the API and then used a bare `page.goto`. On the local daily
run of 2026-11-22 and 2026-11-23 it failed on the sign-in screen each time.

The cause is in the test harness, read from the code (not reproduced): the browser starts from a
stored session whose access token the server accepts for 15 minutes, and the harness cannot
refresh it. Sign-in is made by the test runner's API client and the refresh by a browser page
with a different `User-Agent` and `Accept-Language`; the server compares a fingerprint of those
two headers on refresh and refuses a mismatch with 401. A test that runs more than 15 minutes
after set-up therefore lands on sign-in after a full page load. An earlier version of this record
blamed a cookie jar shared between two local ports; the code does not support that.

No end-to-end test covers "reload with an expired access token" in a real browser, with or
without this change. Reading the session code for this fix found a product risk that is tracked
separately: several tabs refreshing at the same moment can end every tab's session.

## Rejected

- Changing how the local run names its hosts: the spec would still be the one linkage that cannot recover a lost session.

---
date: 2026-11-23
title: The code-blue linkage opens its screen through navigateTo
status: decided
area: testing
---

## What

`e2e/linkages/code-blue.spec.ts` opens `/nurse?tab=code-blue` with `navigateTo`, which signs the browser in again when its stored session is gone, as every other linkage spec does.

## Why

The spec signs three staff in over the API and then used a bare `page.goto`. On the local daily
run of 2026-11-22 and 2026-11-23 it failed on the sign-in screen each time: the trace shows the
browser's `/api/auth/me` going out with no access cookie and the refresh refused with 401. The
cause of the lost cookie is not proven. The likely one is that locally the web app and the server
share a host name (127.0.0.1 on two ports), so their cookies share a jar; CI serves the web app
as localhost and the test passes there.

## Rejected

- Changing how the local run names its hosts: the spec would still be the one linkage that cannot recover a lost session.

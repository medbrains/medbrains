---
date: 2026-11-26
title: SSO start and resend-verification answer 404 and 401, not 500
status: decided
area: security
---

## What

`GET /api/auth/sso/{provider_id}/authorize` (and the SSO callback, through the same lookup) answers
404 for an unknown or inactive provider. `POST /api/auth/resend-verification` moves to the protected
router: 401 without a session, 403 without the CSRF header, and it works for a signed-in user.

## Why

Two recurring failure shapes. `sso_provider_for_login` returns one composite row, not a set, so an
unknown id came back as a row of NULLs that failed to decode (500). Resend reads `Extension<Claims>`
but was mounted on the public router, where nothing inserts it, so it answered 500 to everyone and
the "resend" button on the verify-email banner never worked; the same mistake was fixed for
onboarding earlier. Resend takes no address, so it cannot reveal whether one exists.

## Rejected

- A migration making `sso_provider_for_login` return `SETOF`: a schema change for what one `WHERE`
  in the only caller fixes.

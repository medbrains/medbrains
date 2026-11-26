---
date: 2026-11-26
title: A cookie session is refreshed only from the app's own origin
status: proposed
area: security
---

## What

`POST /api/auth/refresh` refuses (403) a request that carries the refresh cookie when the browser's
`Sec-Fetch-Site` header says another origin started it (anything but `same-origin` or `none`). A
request without the header (native apps, which send the token in the body; older browsers) is
treated as before. The web client, which calls `/api/auth/refresh` on its own origin, is unchanged.

## Why

Refresh sits outside the CSRF middleware and cannot use its double-submit: the `csrf_token`
cookie expires with the 15-minute access token, which is exactly when a refresh is asked for.
`SameSite=Lax` keeps the cookie off cross-site requests, but another origin on the same site (a
sibling subdomain such as a hospital's own website) still gets it sent, so a page there could
rotate a signed-in person's session, and two such requests at once trip refresh-token reuse
detection and sign them out.

## Rejected

- Requiring `X-CSRF-Token` on refresh: the CSRF cookie is gone by then, so every web refresh would fail.
- Lengthening the CSRF cookie to the refresh token's 7 days and adding the header to the client:
  more moving parts across server and client for the same protection.
- An `Origin` check against `CORS_ORIGIN`: the allow-list lives in `main.rs`, not in the handler, and
  every browser that sends `Origin` on a POST also sends `Sec-Fetch-Site`.

---
date: 2026-11-23
title: An administrator no longer issues or uploads anybody's signature
status: decided
area: documents
---

## What

`POST /api/admin/signature-credentials` is retired: it answers 410 Gone, with a plain message, to
everyone, and makes nothing. Its web control (the upload, the image URL field and "Generate
default Ed25519 credential" in Admin, Doctors) and its client method are removed, and so is the
permission `admin.signature_credentials.issue`. An administrator keeps the list and Revoke
(`admin.signature_credentials.list` / `.revoke`), to withdraw a compromised signature; the doctor
then sees "Your signature was withdrawn on <date>: <reason>. Set a new one." in the set-up
dialog, read from `GET /api/signatures/my-credentials?include_past=true`.

A withdrawal does not lock the doctor out: they set a new signature the next time they sign.
When a signer sets a new signature, every credential of theirs that could still sign is ended,
not only the default.

Credentials an administrator issued before this stay valid and keep signing. Nothing is
invalidated or migrated.

## Why

Owner decision, 2026-11-23: nobody, an administrator or the system, may create, upload or draw
a signature for another person. Each signer sets their own (`2026-11-23-signers-set-their-own-signature`).

## Rejected

- 403 Forbidden: an administrator passes every permission check, so "forbidden" would be untrue,
  and it suggests some permission would bring the route back. 410 says the operation is gone.
- Removing the route (405 or 404): an older client would get an answer with no explanation.
- Invalidating credentials administrators issued earlier: hospitals sign with them today, and a
  doctor's records would stop being signable until each one set a new signature.
- Keeping the permission "for later": a permission nothing guards is dead, and it could be granted.

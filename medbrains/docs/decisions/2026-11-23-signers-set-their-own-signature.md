---
date: 2026-11-23
title: A signer sets up their own signature, in their own session, after a step-up
status: decided
area: documents
---

## What

`POST /api/signatures/my-credentials` (permission `signatures.own.manage`, held by exactly the
roles that hold `doctor.signature.sign` or `nurse.signature.sign`) makes the caller's signing
key and stores their signature image, or none. The signer is the session's user: the body is
`{ image }` only and a body naming any other field is refused. It needs the same fresh
password step-up as signing. The image is checked on the server by its first bytes (PNG, JPEG
or WebP, at most 750 KB). Replacing ends the earlier signature (`valid_until = now()`, no
longer the default) without revoking it, and writes one audit row (`signature_set` or
`signature_replaced`). The key pair is made by the one function the admin route also calls.

## Why

Owner decision, 2026-11-23: a signature is the signer's word, so nobody, an administrator or
the system, may create, upload or draw one for another person. A doctor with no signature met
a dead end ("an administrator must issue you a credential") at the moment they needed to sign.

## Rejected

- Letting the admin screen keep uploading the image for the doctor: that is a signature made
  by somebody else. Its retirement is a separate, owner-read change.
- Trusting the browser's file type or size check: the server is the trust boundary.
- Marking the replaced signature revoked: revoked means withdrawn as compromised, and the
  verify screen would then flag every record signed with it.
- A typed name in a script font: that is handwriting made by the system, not by the signer.

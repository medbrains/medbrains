---
date: 2026-11-23
title: A check that cites a file as evidence must cite compiled code
status: decided
area: compliance
---

## What

Failure, and its fix. `scripts/check_redaction_masking.py` (control PRIV-MASK-003) proved
"Aadhaar is stored masked and hashed" and "client error reports redact identifiers" by
finding function names in `crates/medbrains-server/src/routes/patients.rs` and
`routes/client_errors.rs`. Neither file was declared as a module, so neither was compiled:
the check passed on text that never ran, and would have kept passing if the real code had
lost its masking.

The two files are deleted with the other dead code in the shell. The check now reads the code
that runs: `crates/medbrains-patients/src/lib.rs` and `crates/medbrains-client-errors/src/lib.rs`,
and for the second it looks for the call that applies the redaction, not only its definition.

Still open: `scripts/check_cert_readiness.py` counts `routes/abdm/signature.rs`, an empty file,
as evidence of an ABDM signature verifier.

## Why

The real code moved to its own crates in the server split and the old files stayed behind.
A text search cannot tell a file the compiler reads from one it does not.

## Rejected

- Keeping the two files so the check stays green: that keeps the false proof.
- Dropping the two requirements from the check: the controls are real and the code exists.
- Making every evidence check prove its file is compiled (walk `mod` declarations): right, but
  it is a change to every evidence script, not part of deleting dead code.

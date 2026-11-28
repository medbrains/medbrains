---
date: 2026-11-28
title: The Pingora front's TLS uses aws-lc-rs with hybrid post-quantum key exchange first
status: decided
area: os
---

## What

`medbrains-front` (the OS HTTPS front) and `medbrains-proxy` build their TLS on rustls's
`aws_lc_rs` provider instead of `ring`. `crates/medbrains-proxy/Cargo.toml` turns on the rustls
features `aws_lc_rs` and `prefer-post-quantum` itself, so the server offers X25519MLKEM768 first,
then X25519, P-256 and P-384. Both binaries install that provider as the process default before
Pingora runs, and the front's acceptor names it explicitly. Jira MB-113, refs #6289.

No new crate: aws-lc-rs and the rustls feature were already in `Cargo.lock` (the server's own
outbound HTTPS uses them), and `Cargo.lock` is unchanged.

## Why

A client offering only the hybrid group (`openssl s_client -tls1_3 -groups X25519MLKEM768`) was
refused with alert 40, because `ring` has no ML-KEM. Traffic recorded today can be decrypted
once a large enough quantum computer exists; patient records outlive that horizon. Hybrid
X25519MLKEM768 is what current browsers and OpenSSL 3.5+ offer by default, so most clients now
get post-quantum protection with no change on their side.

Setting the feature in this crate, not relying on another crate turning it on, means a
dependency change elsewhere cannot silently move ML-KEM down the list. A test
(`the_front_prefers_hybrid_post_quantum`) fails if it does.

## Rejected

- Leaving `ring`: ring 0.17 has no ML-KEM, so the front would stay classical-only.
- Pure ML-KEM (`MLKEM768`) without X25519: if ML-KEM falls to new cryptanalysis the session
  falls with it, and few clients offer it. The hybrid is at least as strong as X25519 alone.
- Dropping X25519 and P-256: older browsers and devices still offer only these.
- Patching Pingora to swap providers: it already uses the process default when one is
  installed; installing ours first does it without touching the vendored crate.
- The `fips` feature: not asked for, and it narrows the groups and suites further.

`ring` stays in the build because `pingora-rustls` depends on it; it no longer does any TLS
here. Pingora's outbound connections to back ends also use the process default, so they
move to aws-lc-rs too.

# Vendored crates

Each directory is a crates.io release with a small patch, wired in through
`[patch.crates-io]` in `../Cargo.toml`. Re-vendor by unpacking the new
release here and re-applying the change below (for pingora the change is
also recorded as a `.patch` against the pristine crate).

| crate | change | why |
|---|---|---|
| `pingora-core-0.9.0` | (1) `derivative` dependency removed; `PeerOptions` gets a hand-written `Debug` with the same fields (the three hook closures are skipped, as upstream marks them `Debug = "ignore"`). (2) `l4/stream.rs`: "unbuffered" `BufStream`s use a 1-byte read buffer instead of 0. Diff: `pingora-core-0.9.0.patch`. | (1) `derivative` is unmaintained (RUSTSEC-2024-0388). (2) tokio 1.54 asserts a non-zero `BufReader` capacity, so pingora's 0 panicked on every accepted connection; a 1-byte buffer is bypassed by every read, so behaviour is unchanged. Drop (2) once upstream stops passing 0. |
| `sqlx-0.8.6`, `sqlx-macros-core-0.8.6` | `Cargo.toml` only: the `sqlx-mysql` dependency and every `sqlx-mysql?/…` feature are removed; `mysql = []` stays as an empty feature. macros-core gains a `check-cfg` list. Sources are byte-identical to crates.io. | Keeps `sqlx-mysql`, and with it `rsa` (RUSTSEC-2023-0071, no fix), out of `Cargo.lock`; we only use Postgres. |

# Vendored crates

Each directory is a crates.io release with a small patch, wired in through
`[patch.crates-io]` in `../Cargo.toml`. Re-vendor by unpacking the new
release here and re-applying the change below (for pingora the change is
also recorded as a `.patch` against the pristine crate).

| crate | change | why |
|---|---|---|
| `pingora-core-0.9.1` | `derivative` dependency removed; `PeerOptions` gets a hand-written `Debug` with the same fields (the three hook closures are skipped, as upstream marks them `Debug = "ignore"`). Diff: `pingora-core-0.9.1.patch`. | `derivative` is unmaintained (RUSTSEC-2024-0388). 0.9.1 fixed the zero-capacity buffer panic upstream, so that earlier patch is gone. |
| `sqlx-0.8.6`, `sqlx-macros-core-0.8.6` | `Cargo.toml` only: the `sqlx-mysql` dependency and every `sqlx-mysql?/…` feature are removed; `mysql = []` stays as an empty feature. macros-core gains a `check-cfg` list. Sources are byte-identical to crates.io. | Keeps `sqlx-mysql`, and with it `rsa` (RUSTSEC-2023-0071, no fix), out of `Cargo.lock`; we only use Postgres. |

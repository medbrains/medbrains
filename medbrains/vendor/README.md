# Vendored crates

Each directory is a crates.io release with a small patch, wired in through
`[patch.crates-io]` in `../Cargo.toml`. Re-vendor by unpacking the new
release here and re-applying the change below (for pingora the change is
also recorded as a `.patch` against the pristine crate).

| crate | change | why |
|---|---|---|
| `pingora-core-0.9.1` | `derivative` dependency removed; `PeerOptions` gets a hand-written `Debug` with the same fields (the three hook closures are skipped, as upstream marks them `Debug = "ignore"`). HTTP/1 server `write_timeout()` takes the larger of the minimum-send-rate timeout and `write_timeout`, where upstream used the rate alone. Diff: `pingora-core-0.9.1.patch`. | `derivative` is unmaintained (RUSTSEC-2024-0388). 0.9.1 fixed the zero-capacity buffer panic upstream, so that earlier patch is gone. Upstream's rate gave a small write 1 s whatever the write timeout said, so a short Wi-Fi stall cut a response off; `medbrains-front`'s `site_tests.rs` stalls 2 s to prove the fix. |
| `sqlx-0.8.6`, `sqlx-macros-core-0.8.6` | `Cargo.toml` only: the `sqlx-mysql` and `sqlx-sqlite` dependencies and every `sqlx-mysql?/…` and `sqlx-sqlite?/…` feature are removed; `mysql`, `sqlite`, `sqlite-unbundled`, `sqlite-preupdate-hook` and `regexp` stay as empty features, and the `libsqlite3-sys` dev-dependencies are dropped. macros-core gains a `check-cfg` list. Sources are byte-identical to crates.io. | Keeps `sqlx-mysql`, and with it `rsa` (RUSTSEC-2023-0071, no fix), out of `Cargo.lock`; we only use Postgres. Keeps `sqlx-sqlite` and its `libsqlite3-sys` 0.30 out too: `links = "sqlite3"` allows one copy, and `medbrains-bridge` needs rusqlite 0.41 / `libsqlite3-sys` 0.39 for RUSTSEC-2026-0459. |

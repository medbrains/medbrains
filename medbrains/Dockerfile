# syntax=docker/dockerfile:1.7
# Multi-stage build for medbrains-server.
# Final image is distroless — no shell, no package manager, minimal attack surface.

# ── Stage 1: Cargo Chef plan ─────────────────────────────────────────────
# The Rust version MUST match `channel` in rust-toolchain.toml; CI's
# "Dockerfile matches the toolchain" job fails when they differ. Bump the tag
# and the digest together (`docker buildx imagetools inspect rust:<v>-bookworm`).
FROM rust:1.99.1-bookworm@sha256:e6f2cff35d0f309acf8433b4f05878ed77092602c5065cc81801177da0bb3a9c AS chef
WORKDIR /app
RUN cargo install cargo-chef --locked --version 0.1.78

# What cargo needs to resolve the workspace: every member's manifest (two live
# under apps/) and the [patch] crates in vendor/. rust-toolchain.toml is left
# out on purpose: copied in, rustup would quietly fetch the pinned toolchain
# and hide a stale base image instead of failing the version check above.
FROM chef AS planner
COPY Cargo.toml Cargo.lock ./
COPY .cargo/ .cargo/
COPY vendor/ vendor/
COPY crates/ crates/
COPY apps/edge/ apps/edge/
COPY apps/desktop/src-tauri/ apps/desktop/src-tauri/
RUN cargo chef prepare --recipe-path recipe.json

# ── Stage 2: build deps with caching, then build server ──────────────────
FROM chef AS builder
WORKDIR /app
ENV SQLX_OFFLINE=true

# Build deps from recipe — this layer is cached unless deps change.
# OpenSSL is vendored (medbrains-crypto, medbrains-server), so no libssl-dev;
# libz-ng-sys and aws-lc-sys build with cmake, which the base image lacks.
RUN apt-get update && apt-get install -y --no-install-recommends cmake \
    && rm -rf /var/lib/apt/lists/*
COPY --from=planner /app/recipe.json recipe.json
COPY .cargo/ .cargo/
COPY vendor/ vendor/
RUN cargo chef cook --locked --release --recipe-path recipe.json --bin medbrains-server

# Now copy real source and build. Non-test code also embeds
# docs/openapi.json and packages/privacy/dpdp-notice.json.
COPY Cargo.toml Cargo.lock ./
COPY crates/ crates/
COPY apps/edge/ apps/edge/
COPY apps/desktop/src-tauri/ apps/desktop/src-tauri/
COPY .sqlx/ .sqlx/
COPY docs/openapi.json docs/openapi.json
COPY packages/privacy/ packages/privacy/
# The release profile already strips the binary.
RUN cargo build --locked --release --bin medbrains-server

# ── Stage 3: distroless runtime ──────────────────────────────────────────
# Debian 12, the same glibc the bookworm builder links against.
FROM gcr.io/distroless/cc-debian12:nonroot@sha256:9dac0a79194e45a7da0158a9c6da57b217585af0786db3845d1f0ec1a0dd182f AS runtime
WORKDIR /app

COPY --from=builder /app/target/release/medbrains-server /app/medbrains-server

# Default port (overridable via PORT env)
EXPOSE 3000

# Drop privileges (distroless nonroot = uid/gid 65532)
USER nonroot:nonroot

# Health probe via /api/health (Kubernetes does the actual probing)
ENTRYPOINT ["/app/medbrains-server"]

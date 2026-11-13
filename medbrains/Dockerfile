# syntax=docker/dockerfile:1.7
# Multi-stage build for medbrains-server.
# Final image is distroless — no shell, no package manager, minimal attack surface.

# ── Stage 1: Cargo Chef plan ─────────────────────────────────────────────
# Same toolchain as rust-toolchain.toml, so rustup does not download a second one mid-build;
# pinned by digest so a re-pushed tag cannot change what we compile with.
FROM rust:1.100.0-bookworm@sha256:ade39a710ef85f3506cffcfec3e8a24ba090badef1dff2fb798f71d878833fea AS chef
WORKDIR /app
RUN cargo install cargo-chef --locked --version 0.1.78

FROM chef AS planner
COPY Cargo.toml Cargo.lock rustfmt.toml rust-toolchain.toml ./
COPY crates/ crates/
COPY .sqlx/ .sqlx/
RUN cargo chef prepare --recipe-path recipe.json

# ── Stage 2: build deps with caching, then build server ──────────────────
FROM chef AS builder
WORKDIR /app

# Build deps from recipe — this layer is cached unless deps change
COPY --from=planner /app/recipe.json recipe.json
RUN apt-get update && apt-get install -y --no-install-recommends \
        pkg-config \
        libssl-dev \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN cargo chef cook --locked --release --recipe-path recipe.json --bin medbrains-server

# Now copy real source and build
COPY Cargo.toml Cargo.lock rustfmt.toml rust-toolchain.toml ./
COPY crates/ crates/
COPY .sqlx/ .sqlx/
ENV SQLX_OFFLINE=true
RUN cargo build --locked --release --bin medbrains-server \
    && strip target/release/medbrains-server

# ── Stage 3: distroless runtime ──────────────────────────────────────────
FROM gcr.io/distroless/cc-debian12:nonroot AS runtime
WORKDIR /app

# Copy server binary
COPY --from=builder /app/target/release/medbrains-server /app/medbrains-server

# Default port (overridable via PORT env)
EXPOSE 3000

# Drop privileges (distroless nonroot = uid/gid 65532)
USER nonroot:nonroot

# Health probe via /api/health (Kubernetes does the actual probing)
ENTRYPOINT ["/app/medbrains-server"]

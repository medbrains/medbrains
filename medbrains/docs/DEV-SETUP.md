# Local development without Docker (macOS)

`make dev` runs the dev services as plain macOS processes. Docker is no longer
needed for day-to-day work. `docker-compose.yml` and `make dev-docker` stay as a
fallback until this has been used for a while.

| Service | Runs as | Listens on (127.0.0.1 only) | Data |
|---|---|---|---|
| PostgreSQL 17 | Homebrew `postgresql@17` | **5436** (Docker used 5435, the test cluster uses 54317) | `~/.local/share/medbrains-dev/pg17` |
| SpiceDB v1.56.0 | official release binary | gRPC 50051, HTTP API 8453, metrics 9091 | the `spicedb` database in the cluster above |
| rustenberg | the PDF renderer from the rustenberg repo (Gotenberg-compatible) | 3005 (Gotenberg's old dev port) | none |
| Stalwart v0.15.5 | official release binary | SMTP 1587 / 1465, IMAPS 1993, admin + JMAP https 8086 | `~/.local/share/medbrains-dev/stalwart` |
| Headscale v0.23.0 (opt-in) | official release binary | 8089, STUN 3478/udp | `~/.local/share/medbrains-dev/headscale` |
| Orthanc, WHO ICD-API, Kiwi TCMS + MariaDB (opt-in) | Apple `container` 1.7.1 | 8042 + 4242, 8382, 9080 | `container` volumes `medbrains-*` |

Logs are in `~/.local/share/medbrains-dev/logs/`. Set `MEDBRAINS_DEV_HOME` to
move the whole tree.

## 1. Install (once)

Everything comes from the project's own release page, at a pinned version, and
is checked before it is installed. Binaries go to `~/.local/share/medbrains-dev/bin`.

```sh
brew install postgresql@17
B=~/.local/share/medbrains-dev/bin; mkdir -p "$B"
W=$(mktemp -d) && cd "$W"

# SpiceDB, the version docker-compose.yml pins; checked against the release's checksums.txt
gh release download v1.56.0 -R authzed/spicedb -p 'spicedb_1.56.0_darwin_arm64.tar.gz' -p checksums.txt
grep darwin_arm64.tar.gz checksums.txt | shasum -a 256 -c
tar -xzf spicedb_1.56.0_darwin_arm64.tar.gz spicedb && install -m 0755 spicedb "$B/"

# Headscale 0.23.0, as compose; checksums.txt again
gh release download v0.23.0 -R juanfont/headscale -p 'headscale_0.23.0_darwin_arm64' -p checksums.txt
grep 'headscale_0.23.0_darwin_arm64$' checksums.txt | shasum -a 256 -c
install -m 0755 headscale_0.23.0_darwin_arm64 "$B/headscale"

# Stalwart v0.15.5, signed with Sigstore (see below for why not v1)
gh release download v0.15.5 -R stalwartlabs/stalwart -p 'stalwart-aarch64-apple-darwin.tar.gz*'
# expected sha256: cac0eab57a5c5844efa7e4bc206842a5532af11c9f5ff7cf023775bcdbf4b33a
shasum -a 256 stalwart-aarch64-apple-darwin.tar.gz
tar -xzf stalwart-aarch64-apple-darwin.tar.gz && install -m 0755 stalwart "$B/"

# rustenberg (needs Google Chrome or Chromium installed; it finds Chrome in /Applications)
(cd ~/Projects/rustenberg && cargo build --release)   # run scripts/build_guard.sh --wait first
install -m 0755 ~/Projects/rustenberg/target/release/rustenberg "$B/"
```

The Stalwart `.sigstore.json` bundle can be checked with
`cosign verify-blob --bundle … --certificate-identity https://github.com/stalwartlabs/stalwart/.github/workflows/ci.yml@refs/tags/v0.15.5 --certificate-oidc-issuer https://token.actions.githubusercontent.com`
if cosign is installed. Without cosign, the digest in the bundle and the
signature against its certificate's key can be checked with `openssl dgst -verify`.

**Why Stalwart v0.15.5 and not v1.x:** v0.16 removed the `/api/principal` REST
API and `--init`, which `crates/medbrains-mail-provisioning` and the compose
entrypoint depend on. compose's `stalwart:latest` now pulls v1.x and has the
same problem; pinning it is a separate change.

**Mail ports:** macOS lets a normal user bind a port below 1024 only on the
wildcard address, not on 127.0.0.1. So Stalwart listens on 1587/1465/1993 and
the pf rules forward the usual ports on loopback. Run once (it also does the
80/443 forward for the proxy):

```sh
sudo make dev-pf-setup
```

The seeded tenant mail config says port 587, which then reaches Stalwart.

### Extras: Apple `container`

Only for Orthanc, the WHO ICD-API and Kiwi, which ship as Linux images only.
Install the signed package from github.com/apple/container/releases (1.7.1):

```sh
gh release download 1.7.1 -R apple/container -p 'container-1.7.1-installer-signed.pkg'
pkgutil --check-signature container-1.7.1-installer-signed.pkg
# must read: Developer ID Installer: Apple Inc. - Containerization (UPBK2H6LZM), notarized
sudo installer -pkg container-1.7.1-installer-signed.pkg -target /
container system start
```

## 2. Daily use

```sh
make dev            # core four + backend + web + proxy (https://medbrains.localhost)
make dev-status     # which services are up
make dev-stop       # stop them; data is kept
make db             # just the core four, no app
make dev-backend    # core four + backend only
make dev-extras     # Orthanc, ICD-API, Kiwi (Apple container)
make dev-extras-stop
make dev-vpn        # Headscale
make db-shell       # psql on the native database
make db-reset       # drop and recreate medbrains + spicedb (mail is kept)
```

Every start is idempotent: a running service is left alone, and each target
waits until its services answer.

The Makefile passes `DATABASE_URL`, `MIGRATION_DATABASE_URL`,
`WORKER_DATABASE_URL` (port 5436) and `GOTENBERG_URL=http://127.0.0.1:3005`
to the server. These win over `.env`, because the server's `dotenvy` never
overrides a variable already set, so **an existing `.env` that still says 5435
keeps working with `make dev`**. If you run the server by hand, change the
three database URLs in `.env` to port 5436, as `.env.example` now shows.

The ICD-11 search uses the local ICD-API, which is now an extra: run
`make dev-extras` (or `make icd-up`) when you need it.

## 3. Moving the Docker database across

The old dev data is in Docker's `pgdata` volume. To copy it into the native
cluster, start Docker postgres and run the import:

```sh
docker compose up -d postgres
make dev-import-docker      # refuses if the native DB already has tables; FORCE_IMPORT=true replaces it
docker compose stop postgres
```

It runs `pg_dump` inside the Docker container (read-only) and restores into
the native cluster, together with the spicedb database and the roles. The
Docker volume is never changed or removed, and the dump file is kept in
`~/.local/share/medbrains-dev/`.

## 4. Falling back to Docker

```sh
make dev-stop
make dev-docker      # the previous stack: postgres on 5435, gotenberg, ICD-API in Docker
```

`make dev-docker` needs `.env` on port 5435 (its old value) because it passes
no database URLs.

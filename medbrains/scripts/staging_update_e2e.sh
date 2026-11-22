#!/usr/bin/env bash
# Proves an update on a staging box before it reaches a hospital: installs FROM
# with the release's own install.sh, records a day's work, updates to TO the same
# way with a tab left open, rolls back and forward, and checks the work each time.
#   scripts/staging_update_e2e.sh v3.35.4 v3.35.5
#   TO_SERVER=<arm64 server> TO_WEB=<web dist> TO_KIT=<deploy/standalone> TO_VERSION=x.y.z \
#     scripts/staging_update_e2e.sh v3.35.5 local    # FROM's other binaries are reused
# The box is Debian trixie arm64 with systemd (2 CPU, 2 GB), installed in attach mode
# against a throwaway PostgreSQL 17; attach mode installs no Pingora, so a socat on
# the box stands in for the hospital's proxy, published on loopback only. Results,
# screenshots, logs and generated passwords stay in STAGING_RUN_DIR; nothing secret
# is printed. Needs docker, gh and node_modules in medbrains/.
set -Eeuo pipefail

FROM="${1:?usage: staging_update_e2e.sh <from-tag> <to-tag|local>}"
TO="${2:?usage: staging_update_e2e.sh <from-tag> <to-tag|local>}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="${STAGING_CACHE:-$HOME/.cache/medbrains-staging}"
RUN="${STAGING_RUN_DIR:-/tmp/medbrains-staging/$(date -u +%Y%m%dT%H%M%SZ)}"
PORT="${STAGING_PORT:-39080}"
NAME="${STAGING_NAME:-mbstg$$}"
BOX="$NAME-box" PG="$NAME-pg" NET="$NAME-net"
IMAGE=medbrains-staging-box:trixie-1
# Not under /var/lib/medbrains: install.sh step 2 chowns that tree to the
# service user, and step 5 then refuses the staged files as not root's.
STAGE_ROOT=/root/medbrains-releases

# Records one step's outcome for the final table and prints it.
record() { printf '%s\t%s\t%s\n' "$@" | tee -a "$RUN/results.tsv"; }

# Runs a step: PASS when the command succeeds, FAIL (with its log) when not.
step() {
    local name="$1" log="$RUN/logs/$1.log" last; shift
    if "$@" > "$log" 2>&1; then
        record "$name" PASS "$(tail -1 "$log" | cut -c1-100)"
    else
        last="$(grep -v '^\s*$' "$log" | tail -1 | cut -c1-100)"
        record "$name" FAIL "logs/$name.log: ${last//|/\\|}"
    fi
}

# Waits while the host is busy, so a run never piles onto a build (load from uptime).
wait_for_quiet_host() {
    local load
    for _ in $(seq 1 60); do
        load="$(uptime | awk -F'load averages?: ' '{print $2}' | awk -F'[ ,]+' '{print int($1)}')"
        [[ "$load" -lt "${STAGING_MAX_LOAD:-12}" ]] && return 0
        echo "host load $load; waiting"; sleep 20
    done
}

# Downloads a published release's arm64 server bins, web dist and kit once, checked against SHA256SUMS.
fetch_release() {
    local tag="$1" dir="$CACHE/$1"
    [[ -f "$dir/.ok" ]] && return 0
    mkdir -p "$dir/bins" "$dir/web" "$dir/kit"
    gh release download "$tag" -R medbrains/medbrains -D "$dir" --clobber \
        -p medbrains-server-bins-linux-arm64.tar.gz -p medbrains-web-dist.tar.gz -p SHA256SUMS
    (cd "$dir" && grep -E ' \*?medbrains-(server-bins-linux-arm64|web-dist)\.tar\.gz$' SHA256SUMS | shasum -a 256 -c -)
    tar -xzf "$dir/medbrains-server-bins-linux-arm64.tar.gz" -C "$dir/bins"
    tar -xzf "$dir/medbrains-web-dist.tar.gz" -C "$dir/web" --strip-components 1
    git -C "$HERE/.." archive "$tag:medbrains/deploy/standalone" | tar -x -C "$dir/kit"
    touch "$dir/.ok"
}

# Builds the box image once: systemd plus what install.sh step 1 and the backup unit fetch.
build_image() {
    docker image inspect "$IMAGE" >/dev/null 2>&1 && return 0
    docker build -t "$IMAGE" - <<'DOCKERFILE'
FROM debian:trixie
RUN apt-get update && apt-get install -y --no-install-recommends systemd systemd-sysv dbus ca-certificates \
      curl gnupg lsb-release openssl age postgresql-client iproute2 socat procps unzip \
 && curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip -o /tmp/a.zip \
 && unzip -q /tmp/a.zip -d /tmp && /tmp/aws/install && rm -rf /tmp/a.zip /tmp/aws /var/lib/apt/lists/*
STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
DOCKERFILE
}

# Starts the throwaway Postgres and the box on a private network; only the proxy stand-in is published.
start_box() {
    local pw; pw="$(openssl rand -hex 16)"
    printf '%s' "$pw" > "$RUN/secrets/pg"
    docker network create "$NET" >/dev/null
    docker run -d --name "$PG" --network "$NET" -e POSTGRES_USER=medbrains -e POSTGRES_DB=medbrains \
        -e POSTGRES_PASSWORD="$pw" postgres:17-alpine >/dev/null
    # Privileged only so systemd can run as PID 1 in this throwaway container.
    docker run -d --name "$BOX" --hostname staging-box --network "$NET" --privileged --cgroupns=private \
        --tmpfs /run --tmpfs /run/lock --cpus 2 --memory 2g -p "127.0.0.1:$PORT:8080" "$IMAGE" >/dev/null
    for _ in $(seq 1 60); do docker exec "$PG" pg_isready -q -U medbrains 2>/dev/null && break; sleep 1; done
    docker exec "$BOX" systemctl is-system-running --wait >/dev/null 2>&1 || true
    docker exec -d "$BOX" socat TCP-LISTEN:8080,fork,reuseaddr TCP:127.0.0.1:3000
}

# Copies a release into the box as install.sh wants it: root's, writable by nobody else.
stage() {
    local label="$1" bins="$2" web="$3" kit="$4" s="$STAGE_ROOT/$1"
    docker exec "$BOX" install -d -m 0700 "$s" "/opt/kit-$label"
    docker cp "$kit/." "$BOX:/opt/kit-$label/" && docker cp "$web/." "$BOX:$s/medbrains-web"
    for b in medbrains-server medbrains-archive medbrains-proxy medbrains-edge; do docker cp "$bins/$b" "$BOX:$s/$b"; done
    docker exec "$BOX" sh -c "chown -R root:root $s /opt/kit-$label && chmod -R go-w $s /opt/kit-$label"
}

# Runs a staged release's own install.sh, the same command a hospital update runs.
install_release() {
    local url; url="postgres://medbrains:$(cat "$RUN/secrets/pg")@$PG:5432/medbrains"
    docker exec "$BOX" env ATTACH_MODE=1 ATTACH_DATABASE_URL="$url" MEDBRAINS_STAGE="$STAGE_ROOT/$1" \
        bash "/opt/kit-$1/install.sh" staging.invalid ops@staging.invalid
    check_running "$1"
}

# Checks the box serves label's server binary and web build, and the server is healthy.
check_running() {
    local label="$1" want_bin want_web got_web
    want_bin="$(docker exec "$BOX" sha256sum "$STAGE_ROOT/$label/medbrains-server" | cut -d' ' -f1)"
    docker exec "$BOX" sha256sum /usr/local/bin/medbrains-server | grep -q "$want_bin"
    want_web="$(grep -o 'assets/index-[^"]*\.js' "$(web_dir "$label")/index.html" | head -1)"
    for _ in $(seq 1 60); do
        got_web="$(curl -fsS "http://127.0.0.1:$PORT/" 2>/dev/null | grep -o 'assets/index-[^"]*\.js' | head -1 || true)"
        [[ "$got_web" == "$want_web" ]] && curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null && return 0
        sleep 2
    done
    echo "expected $label (web $want_web), served web '$got_web'" >&2 && return 1
}

# Checks every hashed file of FROM's web build is still served, so a tab opened before the update can load its screens.
old_chunks_kept() {
    local gone total
    total="$(find "$(web_dir "$FROM")/assets" -type f | wc -l | tr -d ' ')"
    gone="$(docker exec "$BOX" ls /var/www/medbrains/assets/ | sort \
        | comm -13 - <(find "$(web_dir "$FROM")/assets" -type f | sed "s|.*/||" | sort) | wc -l | tr -d ' ')"
    echo "$gone of $total FROM web files gone after the update"
    [[ "$gone" == 0 ]]
}

# Prints the host-side web dist directory of a release label.
web_dir() { if [[ "$1" == local ]]; then echo "$TO_WEB"; else echo "$CACHE/$1/web"; fi; }

# The real rollback: the host helper install.sh writes (.prev binaries and the previous web tree).
rollback() { docker exec "$BOX" medbrains-rollback && check_running "$FROM"; }

# Runs one phase of the Playwright driver against the box.
phase() {
    local test="$1" label="$2" version="$3" shows=""
    # Does the web build serving this phase ($4) show the server version on System health?
    [[ -n "${4:-}" ]] && grep -rqs 'Different releases' "$(web_dir "$4")/assets" && shows=1
    (cd "$HERE" && STAGING_RUN="$RUN" STAGING_LABEL="$label" STAGING_EXPECT_VERSION="$version" STAGING_WEB_SHOWS_VERSION="$shows" \
        E2E_BASE_URL="http://127.0.0.1:$PORT" E2E_BACKEND_URL="http://127.0.0.1:$PORT" \
        STAGING_NAME="$NAME" STAGING_RUN_DIR="$RUN" STAGING_PORT="$PORT" STAGING_CACHE="$CACHE" \
        TO_LABEL="$TO_LABEL" TO_WEB="$TO_WEB" STAGING_UPDATE_CMD="$HERE/scripts/staging_update_e2e.sh __update __update" \
        node_modules/.bin/playwright test -c apps/web/e2e/staging/playwright.staging.config.ts -g "(^| )$test\$")
}

# Saves the box's logs and removes its containers, network and volumes (the image is kept as a cache).
cleanup() {
    [[ -d "$RUN/logs" ]] || return 0
    docker exec "$BOX" journalctl --no-pager -u medbrains-server > "$RUN/logs/server-journal.log" 2>&1 || true
    docker logs "$PG" > "$RUN/logs/postgres.log" 2>&1 || true
    [[ -n "${STAGING_KEEP:-}" ]] && { echo "kept: $BOX $PG $NET"; return 0; }
    docker rm -f -v "$BOX" "$PG" >/dev/null 2>&1 || true
    docker network rm "$NET" >/dev/null 2>&1 || true
}

# Prints the PASS/FAIL table and exits non-zero on any FAIL.
report() {
    printf '\n| Step | Result | Detail |\n|---|---|---|\n'
    awk -F'\t' '{ printf "| %s | %s | %s |\n", $1, $2, $3 }' "$RUN/results.tsv"
    printf '\nRun directory: %s\n' "$RUN"
    ! grep -q $'\tFAIL\t' "$RUN/results.tsv"
}

# Runs a step only when step $1 passed; otherwise records it as skipped (its result would mean nothing).
step_after() {
    local need="$1"; shift
    if grep -q "^$need"$'\tPASS' "$RUN/results.tsv"; then step "$@"; else record "$1" SKIP "$need failed"; fi
}

# Stops the run when an earlier step failed that every later step needs.
need_pass() { grep -q $'\tFAIL\t' "$RUN/results.tsv" && { report; exit 1; }; return 0; }

# Re-entry from the old-tab phase: performs the update while that tab is open.
if [[ "$FROM" == __update ]]; then
    install_release "$TO_LABEL" > "$RUN/logs/update.log" 2>&1
    exit
fi

mkdir -p "$RUN/logs" "$RUN/shots" "$RUN/secrets" && chmod 700 "$RUN/secrets" && : > "$RUN/results.tsv"
trap cleanup EXIT
wait_for_quiet_host
TO_LABEL="$TO" EXPECT_TO="${TO_VERSION:-${TO#v}}"
step "fetch-$FROM" fetch_release "$FROM"
if [[ "$TO" == local ]]; then
    : "${TO_SERVER:?local TO needs TO_SERVER}" "${TO_WEB:?local TO needs TO_WEB}" "${TO_KIT:?local TO needs TO_KIT}"
    TO_BINS="$RUN/local-bins" && mkdir -p "$TO_BINS" && cp "$TO_SERVER" "$TO_BINS/medbrains-server"
    cp "$CACHE/$FROM/bins/"medbrains-{archive,proxy,edge} "$TO_BINS/"
else
    step "fetch-$TO" fetch_release "$TO"
    TO_BINS="$CACHE/$TO/bins" TO_WEB="$CACHE/$TO/web" TO_KIT="$CACHE/$TO/kit"
fi
step build-image build_image
step start-box start_box
step "stage-$FROM" stage "$FROM" "$CACHE/$FROM/bins" "$CACHE/$FROM/web" "$CACHE/$FROM/kit"
step "stage-$TO_LABEL" stage "$TO_LABEL" "$TO_BINS" "$TO_WEB" "$TO_KIT"
need_pass
step "install-$FROM" install_release "$FROM"
docker exec "$BOX" cat /etc/medbrains/initial-admin-password > "$RUN/secrets/admin-initial" || true
need_pass
step seed-registration-opd phase setup seed ""
step "baseline-$FROM" phase baseline baseline "" "$FROM"
need_pass
step "update-to-$TO_LABEL-with-open-tab" phase oldtab update "$EXPECT_TO"
step "check-running-$TO_LABEL" check_running "$TO_LABEL"
step "old-tab-files-kept" old_chunks_kept
step "flows-after-update" phase verify after-update "$EXPECT_TO" "$TO_LABEL"
step "rollback-to-$FROM" rollback
step_after "rollback-to-$FROM" "flows-after-rollback" phase verify after-rollback "${FROM#v}" "$FROM"
step "rollforward-to-$TO_LABEL" install_release "$TO_LABEL"
step "flows-after-rollforward" phase verify after-rollforward "$EXPECT_TO" "$TO_LABEL"
report

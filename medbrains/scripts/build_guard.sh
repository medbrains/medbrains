#!/usr/bin/env bash
# Check whether it is safe to start a cargo build.
#
#   scripts/build_guard.sh            # report; exit 1 if something is running
#   scripts/build_guard.sh --reap     # also stop jobs that are clearly stale
#   scripts/build_guard.sh --wait     # block until the machine is free
#   scripts/build_guard.sh --target-dir   # print this worktree's cargo target dir
#   scripts/build_guard.sh --targets      # list the per-worktree target dirs
#   scripts/build_guard.sh --targets --delete   # remove those whose worktree is gone
#
# ## One target directory per worktree
#
#   export CARGO_TARGET_DIR="$(scripts/build_guard.sh --target-dir)"
#
# Cargo names a workspace crate's artefacts by its path inside the workspace
# and calls them fresh when no source file is newer than the last build. Two
# worktrees in one target directory therefore take each other's builds: a test
# ran, and passed or failed, against the other worktree's code (2026-11-22).
# So each worktree builds in /tmp/mb-target/wt-<hash of its path>, the
# directory records its owner in `.mb-worktree`, and the guard refuses an
# exported CARGO_TARGET_DIR that another worktree owns. MB_SHARED_TARGET_OK=1
# overrides, for a directory you know holds nothing of this workspace's.
# A full copy is about 40 GB: `--targets` shows them, `--delete` clears the
# ones left behind by removed worktrees.
#
# This workspace is ~119 crates and 1200 dependencies. One `cargo check` pulls
# the machine to a load average of 4 and a full build takes half an hour. Two
# at once do not take twice as long — they thrash, and on a laptop they can
# take the machine down entirely.
#
# ## Why this is not just `pkill cargo`
#
# Because not every cargo process is disposable, and guessing wrong is
# expensive. A release cross-compile for the deploy box is thirty-five minutes
# of somebody's afternoon; killing it to save ninety seconds is a bad trade
# made silently.
#
# So jobs are classified, and **nothing is killed unless it is clearly safe and
# `--reap` was asked for**:
#
#   agent      CARGO_TARGET_DIR under /tmp/mb-target, and a check/test/clippy.
#              Disposable: it is a verification run that can simply be redone.
#   operator   a release build, anything with --target (a cross-compile), or
#              anything outside this workspace. Never killed, never waited on
#              silently — reported so a human decides.
#   serving    a `cargo run` whose program is up and which compiles nothing:
#              a dev server. Listed, never counted as a build, never stopped.
#   stale      burning no CPU for minutes. Probably wedged, but "probably" is
#              not enough to kill without being asked.
#
# The distinction exists because it was got wrong once: two of the operator's
# builds were killed to unblock an agent's, which was not the agent's call to
# make.

set -uo pipefail

MODE="report" DELETE=0
for arg in "$@"; do
    case "$arg" in
        --reap) MODE="reap" ;;
        --wait) MODE="wait" ;;
        --target-dir) MODE="target-dir" ;;
        --targets) MODE="targets" ;;
        --delete) DELETE=1 ;;
        -h|--help) sed -n '2,57p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    esac
done

# Agents' builds live under here, one directory per worktree. MB_TARGET_ROOT moves it (tests).
AGENT_TARGET="${MB_TARGET_ROOT:-/tmp/mb-target}"
OWNER_FILE=".mb-worktree"

# Print the worktree a build started here belongs to: the checkout around the
# current directory, else the one this script is in.
worktree_root() {
    git rev-parse --show-toplevel 2>/dev/null ||
        git -C "$(dirname "$0")" rev-parse --show-toplevel
}

# Print the cargo target directory this worktree must build in, and record the
# worktree as its owner. Unset, or the root every worktree once shared, becomes
# this worktree's own directory. A directory another worktree owns is refused:
# cargo would link that worktree's code into this one's tests without a word.
target_dir() {
    local top dir owner
    top="$(worktree_root)" || { echo "build_guard: not in a git checkout" >&2; return 1; }
    dir="${CARGO_TARGET_DIR:-}"
    if [[ -z "$dir" || "${dir%/}" == "$AGENT_TARGET" ]]; then
        dir="$AGENT_TARGET/wt-$(printf %s "$top" | git hash-object --stdin | cut -c1-12)"
    fi
    [[ "$dir" == /* ]] || dir="$PWD/$dir"
    owner="$(cat "$dir/$OWNER_FILE" 2>/dev/null || true)"
    if [[ -n "$owner" && "$owner" != "$top" && -z "${MB_SHARED_TARGET_OK:-}" ]]; then
        {
            echo "build_guard: REFUSED: $dir"
            echo "  belongs to another worktree: $owner"
            echo "  this worktree:               $top"
            echo "  Two worktrees in one target directory run each other's code."
            echo "  Unset CARGO_TARGET_DIR, or: export CARGO_TARGET_DIR=\"\$($0 --target-dir)\""
            echo "  MB_SHARED_TARGET_OK=1 overrides, if you know why that is safe."
        } >&2
        return 1
    fi
    [[ -n "$owner" ]] || { mkdir -p "$dir" && echo "$top" > "$dir/$OWNER_FILE"; } || return 1
    echo "$dir"
}

# List every per-worktree target directory with its size, age and owner, and
# with --delete remove those whose worktree no longer exists. A directory with
# no owner file is listed and kept: nothing proves it is unused.
list_targets() {
    local dir owner state now freed=0
    now="$(date +%s)"
    printf "  %6s %5s  %-8s %s\n" size age state worktree
    for dir in "$AGENT_TARGET"/wt-*/; do
        [[ -d "$dir" ]] || continue
        dir="${dir%/}"
        owner="$(cat "$dir/$OWNER_FILE" 2>/dev/null || true)"
        state="live"
        [[ -n "$owner" ]] || state="unowned"
        [[ -z "$owner" || -d "$owner" ]] || state="orphan"
        printf "  %6s %4sd  %-8s %s\n" "$(du -sh "$dir" | cut -f1 | tr -d ' ')" \
            "$(( (now - $(stat -f %m "$dir" 2>/dev/null || stat -c %Y "$dir")) / 86400 ))" \
            "$state" "${owner:-?}  ($dir)"
        [[ "$state" == "orphan" ]] || continue
        freed=$((freed + 1))
        (( DELETE )) && rm -rf "$dir"
    done
    if (( DELETE )); then
        echo "removed $freed orphan target dir(s)"
    else
        echo "$freed orphan target dir(s); --targets --delete removes them"
    fi
    [[ ! -d "$AGENT_TARGET/debug" ]] ||
        echo "  $AGENT_TARGET/debug is the old shared cache; remove it once no build uses it"
}

case "$MODE" in
    target-dir) target_dir; exit ;;
    targets) list_targets; exit ;;
esac

# An exported CARGO_TARGET_DIR is what the build about to start will use. It
# must be this worktree's own, or the build may not start.
if [[ -n "${CARGO_TARGET_DIR:-}" && -z "${MB_SHARED_TARGET_OK:-}" ]]; then
    own="$(target_dir)" || exit 1
    if [[ "$own" != "${CARGO_TARGET_DIR%/}" && "$own" != "$PWD/${CARGO_TARGET_DIR%/}" ]]; then
        echo "build_guard: REFUSED: CARGO_TARGET_DIR=$CARGO_TARGET_DIR is shared by every worktree." >&2
        echo "  Use this worktree's own: export CARGO_TARGET_DIR=\"$own\"" >&2
        exit 1
    fi
fi
# No CPU for this long and it is not building anything.
STALE_CPU_THRESHOLD="0.5"
STALE_MIN_ELAPSED_SEC=180

# Elapsed comes from ps as [[dd-]hh:]mm:ss.
elapsed_seconds() {
    local raw="$1" days=0
    [[ "$raw" == *-* ]] && { days="${raw%%-*}"; raw="${raw#*-}"; }
    local IFS=:
    read -ra parts <<< "$raw"
    local total=0
    for part in "${parts[@]}"; do total=$((10#$total * 60 + 10#$part)); done
    echo $((total + days * 86400))
}

# Every process below `$1`, one pid per line.
descendants() {
    local child
    for child in $(pgrep -P "$1" 2>/dev/null); do
        echo "$child"
        descendants "$child"
    done
}

# A `cargo run` whose program is running and which compiles nothing is
# serving, not building: no compiler beneath it, no build lock held. A dev
# server left up — this project's or another's — must not hold every build
# in the queue for as long as it runs.
is_serving() {
    local pid="$1" child
    local -a kids=()
    while read -r child; do kids+=("$child"); done < <(descendants "$pid")
    (( ${#kids[@]} > 0 )) || return 1
    for child in "${kids[@]}"; do
        ps -o command= -p "$child" 2>/dev/null | grep -qE 'rustc|build-script|cc1|ld( |$)' && return 1
    done
    return 0
}

classify() {
    local command="$1" cpu="$2" elapsed="$3" pid="$4"
    if [[ "$command" == *"cargo run"* ]] && is_serving "$pid"; then
        echo "serving"; return
    fi
    # Operator work first: a false "agent" reading is the expensive mistake.
    if [[ "$command" == *"--release"* || "$command" == *"--target "* || "$command" == *"--target="* ]]; then
        echo "operator"; return
    fi
    # The target directory is usually exported rather than written on the
    # command line, so the command string alone misclassifies almost every
    # agent build as unknown. `ps eww` shows the process's real environment.
    local env_target=""
    env_target="$(ps eww -p "$4" 2>/dev/null | tr ' ' '\n' | grep -m1 '^CARGO_TARGET_DIR=' || true)"
    if [[ "$command" != *"$AGENT_TARGET"* && "$env_target" != "CARGO_TARGET_DIR=$AGENT_TARGET" &&
          "$env_target" != "CARGO_TARGET_DIR=$AGENT_TARGET/"* ]]; then
        echo "unknown"; return
    fi
    if (( elapsed > STALE_MIN_ELAPSED_SEC )) && awk "BEGIN{exit !($cpu < $STALE_CPU_THRESHOLD)}"; then
        echo "stale"; return
    fi
    echo "agent"
}

scan() {
    FOUND=0 REAPABLE=()
    # shellcheck disable=SC2009  # pgrep cannot print elapsed time and CPU.
    while read -r pid etime pcpu rest; do
        [[ -z "${pid:-}" ]] && continue
        local seconds kind
        seconds="$(elapsed_seconds "$etime")"
        kind="$(classify "$rest" "$pcpu" "$seconds" "$pid")"
        # Shown, so the reader sees it, but it does not hold the queue.
        [[ "$kind" == "serving" ]] || FOUND=$((FOUND + 1))
        printf "  %-9s pid %-7s %5ss  %4s%%cpu  %s\n" \
            "$kind" "$pid" "$seconds" "$pcpu" "${rest:0:80}"
        [[ "$kind" == "stale" ]] && REAPABLE+=("$pid")
    done < <(ps -eo pid,etime,pcpu,command 2>/dev/null |
             grep -E '(^| )(cargo|rustc)( |$)|cargo (check|build|test|clippy)' |
             grep -v grep | grep -v build_guard)
}

# Disk matters as much as CPU here: the two target directories hold 61 GB
# between them, and a build that fills the volume corrupts its own cache.
disk_note() {
    local avail
    avail="$(df -g /tmp 2>/dev/null | awk 'NR==2{print $4}')"
    [[ -z "$avail" ]] && return
    if (( avail < 20 )); then
        echo "  WARNING: only ${avail}GB free on /tmp — a full build needs headroom."
        echo "           $0 --targets lists the per-worktree target dirs; --delete clears orphans."
    fi
}

scan
if (( FOUND == 0 )); then
    echo "nothing building — safe to start"
    disk_note
    exit 0
fi

echo
if [[ "$MODE" == "wait" ]]; then
    echo "waiting for the machine to be free..."
    while (( FOUND > 0 )); do
        sleep 20
        scan >/dev/null
    done
    echo "clear — safe to start"
    exit 0
fi

if [[ "$MODE" == "reap" && ${#REAPABLE[@]} -gt 0 ]]; then
    echo "stopping ${#REAPABLE[@]} stale job(s): ${REAPABLE[*]}"
    # TERM, not KILL: cargo removes its lock file on the way out, and a build
    # killed with -9 leaves a lock that blocks the next run with a message
    # about "waiting for file lock" that explains nothing.
    kill -TERM "${REAPABLE[@]}" 2>/dev/null
    sleep 2
    scan
    (( FOUND == 0 )) && { echo "clear — safe to start"; exit 0; }
fi

echo "NOT safe to start — something is already building."
echo "  operator/unknown jobs are never stopped automatically; ask before killing one."
echo "  --wait to block until clear, --reap to stop only the stale ones."
disk_note
exit 1

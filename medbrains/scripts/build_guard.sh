#!/usr/bin/env bash
# Check whether it is safe to start a cargo build.
#
#   scripts/build_guard.sh            # report; exit 1 if something is running
#   scripts/build_guard.sh --reap     # also stop jobs that are clearly stale
#   scripts/build_guard.sh --wait     # block until the machine is free
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
#   agent      CARGO_TARGET_DIR=/tmp/mb-target, and a check/test/clippy.
#              Disposable: it is a verification run that can simply be redone.
#   operator   a release build, anything with --target (a cross-compile), or
#              anything outside this workspace. Never killed, never waited on
#              silently — reported so a human decides.
#   stale      burning no CPU for minutes. Probably wedged, but "probably" is
#              not enough to kill without being asked.
#
# The distinction exists because it was got wrong once: two of the operator's
# builds were killed to unblock an agent's, which was not the agent's call to
# make.

set -uo pipefail

MODE="report"
for arg in "$@"; do
    case "$arg" in
        --reap) MODE="reap" ;;
        --wait) MODE="wait" ;;
        -h|--help) sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    esac
done

AGENT_TARGET="/tmp/mb-target"
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

classify() {
    local command="$1" cpu="$2" elapsed="$3" pid="$4"
    # Operator work first: a false "agent" reading is the expensive mistake.
    if [[ "$command" == *"--release"* || "$command" == *"--target "* || "$command" == *"--target="* ]]; then
        echo "operator"; return
    fi
    # The target directory is usually exported rather than written on the
    # command line, so the command string alone misclassifies almost every
    # agent build as unknown. `ps eww` shows the process's real environment.
    local env_target=""
    env_target="$(ps eww -p "$4" 2>/dev/null | tr ' ' '\n' | grep -m1 '^CARGO_TARGET_DIR=' || true)"
    if [[ "$command" != *"$AGENT_TARGET"* && "$env_target" != "CARGO_TARGET_DIR=$AGENT_TARGET" ]]; then
        echo "unknown"; return
    fi
    if (( elapsed > STALE_MIN_ELAPSED_SEC )) && awk "BEGIN{exit !($cpu < $STALE_CPU_THRESHOLD)}"; then
        echo "stale"; return
    fi
    echo "agent"
}

scan() {
    FOUND=0 REAPABLE=()
    while read -r pid etime pcpu rest; do
        [[ -z "${pid:-}" ]] && continue
        local seconds kind
        seconds="$(elapsed_seconds "$etime")"
        kind="$(classify "$rest" "$pcpu" "$seconds" "$pid")"
        FOUND=$((FOUND + 1))
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
        echo "           cargo clean --target-dir $AGENT_TARGET, or remove old artefacts."
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

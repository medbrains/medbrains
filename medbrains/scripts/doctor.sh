#!/usr/bin/env bash
# make doctor — find the traps that waste an afternoon before they do.
#
# Read-only: it reports each problem with the command that fixes it and
# never runs that command itself (no sudo, no rm, no reset). Exit 1 when
# anything needs attention.
set -uo pipefail
cd "$(dirname "$0")/.."

MIN_FREE_GB=20
problems=0
ok() { printf '  ok    %s\n' "$1"; }
bad() { printf '  FIX   %s\n        -> %s\n' "$1" "$2"; problems=$((problems + 1)); }

echo "MedBrains doctor ($(pwd))"

# 1. Caches owned by root (an earlier `sudo pnpm`/`sudo make`) block Vite.
root_owned=$(find . -maxdepth 6 -path '*/node_modules/.vite*' ! -user "$(id -un)" -prune -print 2>/dev/null | sort -u)
if [ -n "$root_owned" ]; then
  bad "caches not owned by $(id -un): $(echo "$root_owned" | tr '\n' ' ')" \
      "sudo rm -rf $(echo "$root_owned" | tr '\n' ' ')"
else
  ok "no root-owned .vite caches"
fi

# 2. Disk: a build that fills the volume corrupts its own cache.
free_gb=$(df -g . 2>/dev/null | awk 'NR==2 {print $4}')
if [ -n "${free_gb:-}" ] && [ "$free_gb" -lt "$MIN_FREE_GB" ]; then
  bad "only ${free_gb} GB free (want ${MIN_FREE_GB})" "rm -rf /tmp/mb-target target/debug/incremental"
else
  ok "${free_gb:-?} GB free"
fi

# 3. Local master drifting from origin (pre-squash commits, or just behind).
if git fetch -q origin master 2>/dev/null; then
  ahead=$(git rev-list --count origin/master..master 2>/dev/null || echo 0)
  behind=$(git rev-list --count master..origin/master 2>/dev/null || echo 0)
  if [ "$ahead" -gt 0 ] || [ "$behind" -gt 0 ]; then
    bad "local master is $ahead ahead / $behind behind origin/master" \
        "branch from origin/master, or: git branch -f master origin/master (when master is not checked out)"
  else
    ok "local master matches origin/master"
  fi
else
  bad "could not fetch origin" "check the network / gh auth, then re-run"
fi

# 4. Another cargo job running: two at once thrash the machine.
if bash scripts/build_guard.sh >/dev/null 2>&1; then
  ok "build_guard: machine free"
else
  bad "build_guard: a cargo job is running" "bash scripts/build_guard.sh --wait && <your cargo command>"
fi

# 5. .env and the database it names.
if [ -f .env ]; then
  ok ".env present"
  db_url=$(grep -E '^DATABASE_URL=' .env | tail -1 | cut -d= -f2-)
  if [ -z "$db_url" ]; then
    bad "DATABASE_URL missing from .env" "copy it from .env.example"
  elif command -v pg_isready >/dev/null && pg_isready -q -d "$db_url"; then
    ok "database reachable"
  else
    bad "database at DATABASE_URL not reachable" "make db   (docker compose up -d postgres)"
  fi
else
  bad ".env missing" "cp .env.example .env"
fi

echo
if [ "$problems" -eq 0 ]; then echo "All clear."; else echo "$problems thing(s) to fix."; fi
[ "$problems" -eq 0 ]

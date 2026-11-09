#!/usr/bin/env bash
# Build the web app, serve the build with `vite preview`, and run the perf
# harness (startup-shift.perf.spec.ts) against it and the backend on :3000.
#   PERF_PROJECT=perf|perf-webkit  (default perf = headless Chromium)
#   PERF_SHIFT_MINUTES=30           length of the shift loop
#   PERF_OUT=perf-result.json       where the numbers are written
set -euo pipefail
cd "$(dirname "$0")/../.."
PORT=4173
pnpm exec vite build
pnpm exec vite preview --port "$PORT" --strictPort &
preview=$!
trap 'kill "$preview" 2>/dev/null || true' EXIT
until curl -fs -o /dev/null "http://localhost:$PORT/login"; do sleep 1; done
E2E_BASE_URL="http://localhost:$PORT" PERF_OUT="${PERF_OUT:-perf-result.json}" \
  pnpm exec playwright test --project="${PERF_PROJECT:-perf}" --reporter=line

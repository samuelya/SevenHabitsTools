#!/usr/bin/env bash
# Usage: scripts/web/e2e-local.sh [--no-build] [playwright args...]
#   e.g. scripts/web/e2e-local.sh e2e/paradigms-transition.spec.ts
#        scripts/web/e2e-local.sh --no-build e2e/habits.spec.ts --project=mobile-ar
# Runs Playwright from the current checkout's src/web against that checkout's own build, served on
# a free private port. `npm run e2e` alone serves on 4300 with reuseExistingServer, so in a
# worktree it can silently test another worktree's build. Uses the line reporter and prints only
# the tail of the output; the server is stopped on exit. Exit code is Playwright's.
set -euo pipefail

web="$(git rev-parse --show-toplevel)/src/web"
cd "$web"

build=1
if [[ "${1:-}" == "--no-build" ]]; then
  build=0
  shift
fi

[[ -d node_modules ]] || npm ci --silent
log=$(mktemp "${TMPDIR:-/tmp}/e2e-local.XXXXXX")
if (( build )); then
  npm run build >"$log" 2>&1 || { echo "Build failed:"; tail -30 "$log"; exit 1; }
fi
[[ -d dist/web/browser ]] || { echo "No build in dist/web/browser; run without --no-build." >&2; exit 1; }

port=$(node -e 'const s=require("net").createServer().listen(0,()=>{console.log(s.address().port);s.close()})')
node e2e/static-server.mjs dist/web/browser "$port" >"$log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true; rm -f "$log"' EXIT
for _ in $(seq 1 40); do
  curl -s -o /dev/null "http://localhost:$port/" && break
  sleep 0.25
done

set +e
PLAYWRIGHT_BASE_URL="http://localhost:$port" npx playwright test --reporter=line "$@" 2>&1 | tail -n "${E2E_TAIL:-60}"
status=${PIPESTATUS[0]}
set -e
exit "$status"

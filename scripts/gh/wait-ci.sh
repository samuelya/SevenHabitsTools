#!/usr/bin/env bash
# Usage: scripts/gh/wait-ci.sh <pr-number>
# Waits for a PR's CI in one blocking call, instead of a sleep/poll loop that costs a turn per check.
# Prints one line per check that is not green, plus the tail of the first failed job's log.
# Exit 0: all green (skipped counts as green). Exit 1: a check failed or was cancelled.
# Run it with a long Bash timeout (up to 600000 ms); if that runs out, run it again.
#
# When run from the PR's own branch, it first waits until the PR head is this checkout's HEAD, so a
# fresh push is never judged by the previous commit's green checks.
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

pr="${1:?PR number required}"
require_number "$pr"
repo="$OWNER/$REPO"

head_branch=$(gh pr view "$pr" -R "$repo" --json headRefName --jq .headRefName)
if [[ "$(git branch --show-current 2>/dev/null)" == "$head_branch" ]]; then
  local_sha=$(git rev-parse HEAD)
  for _ in $(seq 1 30); do
    [[ "$(gh pr view "$pr" -R "$repo" --json headRefOid --jq .headRefOid)" == "$local_sha" ]] && break
    sleep 5
  done
fi

# Checks can take a few seconds to register after a push.
for _ in $(seq 1 12); do
  gh pr checks "$pr" -R "$repo" --json name --jq length >/dev/null 2>&1 && break
  sleep 5
done

gh pr checks "$pr" -R "$repo" --watch --fail-fast --interval 20 >/dev/null 2>&1 || true

bad=$(gh pr checks "$pr" -R "$repo" --json name,bucket,link \
  --jq '.[] | select(.bucket != "pass" and .bucket != "skipping") | "\(.bucket)\t\(.name)\t\(.link)"')
if [[ -z "$bad" ]]; then
  echo "CI green on PR #$pr."
  exit 0
fi

echo "CI not green on PR #$pr:"
echo "$bad"
run_id=$(grep -m1 -oE 'actions/runs/[0-9]+' <<<"$bad" | cut -d/ -f3 || true)
if [[ -n "$run_id" ]] && grep -q '^fail' <<<"$bad"; then
  echo "--- last 40 lines of the failed job log (run $run_id) ---"
  gh run view "$run_id" -R "$repo" --log-failed 2>/dev/null | tail -40 || true
fi
exit 1

#!/usr/bin/env bash
# Usage: scripts/gh/round.sh <issue> failed|passed|escalation <n>/<m> <model> [details|-] [--dry-run]
#   failed      posts "Round n/m failed on <model>" + details (what failed, planned fix)
#   passed      posts "Round n/m passed on <model>" + details (verified SHA, evidence)
#   escalation  posts "Escalation: n/m rounds failed on <model>" + details (each round, root cause)
# Details come from the 5th argument, or from stdin when it is "-". --dry-run prints the comment.
# One canonical first line, so scripts/gh/team-metrics.sh counts rounds instead of guessing at
# hand-written variants (four formats across six issues broke the failed-round metric, #207).
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

dry=0
args=()
for a in "$@"; do [[ "$a" == "--dry-run" ]] && dry=1 || args+=("$a"); done
set -- "${args[@]}"

issue="${1:?issue number required}"; require_number "$issue"
kind="${2:?failed|passed|escalation required}"
round="${3:?round required, e.g. 1/2}"
model="${4:?model required, e.g. claude-sonnet-5}"
details="${5:-}"
[[ "$round" =~ ^[0-9]+/[0-9]+$ ]] || { echo "Round must look like n/m, got: '$round'" >&2; exit 1; }
[[ "$model" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Model must be a plain id, got: '$model'" >&2; exit 1; }
[[ "$details" == "-" ]] && details=$(cat)

case "$kind" in
  failed)     head="Round $round failed on $model" ;;
  passed)     head="Round $round passed on $model" ;;
  escalation) head="Escalation: $round rounds failed on $model" ;;
  *) echo "Kind must be failed, passed or escalation, got: '$kind'" >&2; exit 1 ;;
esac

body="$head"
[[ -n "$details" ]] && body+=$'\n\n'"$details"
if (( dry )); then printf '%s\n' "$body"; exit 0; fi
gh issue comment "$issue" -R "$OWNER/$REPO" --body "$body"

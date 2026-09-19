#!/usr/bin/env bash
# Usage: scripts/gh/team-metrics.sh [--weeks N]   (default 2)
# One read-only call that prints the numbers an ecosystem review (/eco-review) needs, so the review
# never rediscovers them:
#   1. Tokens by model and by role, and the most expensive agent runs (turns, context per turn),
#      from the local Claude Code transcripts in ~/.claude/projects/<this project>/.
#   2. Merged PRs in the window with their round history (failed-round comments and escalation
#      labels on the linked issues, tester bugs filed against the PR).
#   3. Derived rates: merged PRs/week, input tokens processed per merged PR, failed-round rate,
#      escalation rate, bugs per PR, average CI minutes.
# "Input processed" = uncached + cache write + cache read tokens: what every turn re-sends. It is
# the number to drive down (fewer turns, smaller context); cache reads are cheaper per token but
# dominate the volume.
set -euo pipefail
source "$(dirname "$0")/_lib.sh"

weeks=2
while (( $# )); do
  case "$1" in
    --weeks) weeks="${2:?--weeks needs a number}"; require_number "$weeks"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 64 ;;
  esac
done
since=$(date -u -v-"$((weeks*7))"d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "$((weeks*7)) days ago" +%Y-%m-%dT%H:%M:%SZ)
day=${since%%T*}
# The main checkout, even when run from a worktree: transcripts and guard.log live under it.
root=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
proj="$HOME/.claude/projects/$(sed 's#[/.]#-#g' <<<"$root")"
echo "Window: last $weeks week(s), since $since"
echo

echo "=== 1. Tokens (transcripts under $proj)"
input_total=$(python3 - "$proj" "$since" <<'PY'
import sys, json, glob, os, re, collections, statistics
proj, since = sys.argv[1], sys.argv[2]
files = glob.glob(os.path.join(proj, "*.jsonl")) + glob.glob(os.path.join(proj, "*", "subagents", "*.jsonl"))
ROLES = (("tester", "tester"), (r"frontend|^afe\b|^afc\b|^afe-|^afc-", "frontend-coder"),
         (r"backend|^abe-|^abc-", "backend-coder"), (r"business|^aba-", "business-analyst"),
         (r"^acoder-", "coder"), ("guide", "claude-code-guide"), ("review", "code-review"))
def role(agent):
    if not agent: return "lead"
    for pat, name in ROLES:
        if re.search(pat, agent): return name
    return "other-agent"
# One API request is stored as several streamed records sharing requestId; keep the max per field.
req = {}
for f in files:
    try: fh = open(f, encoding="utf-8", errors="replace")
    except OSError: continue
    with fh:
        for line in fh:
            if '"usage"' not in line: continue
            try: r = json.loads(line)
            except ValueError: continue
            if r.get("type") != "assistant" or (r.get("timestamp") or "") < since: continue
            m = r.get("message") or {}; u = m.get("usage") or {}
            k = r.get("requestId") or r.get("uuid")
            vals = [u.get("input_tokens", 0), u.get("cache_creation_input_tokens", 0), u.get("cache_read_input_tokens", 0), u.get("output_tokens", 0)]
            cur = req.setdefault(k, {"model": m.get("model", "?"), "agent": r.get("agentId") or "", "v": [0, 0, 0, 0]})
            cur["v"] = [max(a, b) for a, b in zip(cur["v"], vals)]
by_model = collections.defaultdict(lambda: [0, 0, 0, 0]); by_role = collections.defaultdict(lambda: [0, 0, 0, 0, 0])
runs = collections.defaultdict(lambda: {"ctx": [], "out": 0})
for x in req.values():
    v = x["v"]; rl = role(x["agent"])
    for i in range(4): by_model[x["model"]][i] += v[i]; by_role[rl][i] += v[i]
    by_role[rl][4] += 1
    run = runs[x["agent"] or "lead sessions"]; run["ctx"].append(v[0] + v[1] + v[2]); run["out"] += v[3]; run["role"] = rl
def k(n): return f"{n/1000:,.0f}k"
print(f"{'model':<26}{'uncached in':>13}{'cache write':>13}{'cache read':>14}{'output':>10}")
for mdl, v in sorted(by_model.items(), key=lambda x: -sum(x[1])):
    print(f"{mdl:<26}{k(v[0]):>13}{k(v[1]):>13}{k(v[2]):>14}{k(v[3]):>10}")
print(); print(f"{'role':<26}{'turns':>7}{'input processed':>17}{'cache write':>13}{'output':>10}{'avg ctx/turn':>14}")
for rl, v in sorted(by_role.items(), key=lambda x: -(x[1][0] + x[1][1] + x[1][2])):
    inp = v[0] + v[1] + v[2]
    print(f"{rl:<26}{v[4]:>7}{k(inp):>17}{k(v[1]):>13}{k(v[3]):>10}{k(inp / max(v[4], 1)):>14}")
print(); print("Most expensive runs (by input processed):")
print(f"{'agent':<40}{'role':<17}{'turns':>6}{'median ctx':>12}{'max ctx':>10}{'input processed':>17}{'output':>9}")
for a, r in sorted(runs.items(), key=lambda x: -sum(x[1]["ctx"]))[:8]:
    c = r["ctx"]; print(f"{a[:39]:<40}{r['role']:<17}{len(c):>6}{k(statistics.median(c)):>12}{k(max(c)):>10}{k(sum(c)):>17}{k(r['out']):>9}")
print(f"TOTAL_INPUT_PROCESSED {sum(sum(r['ctx']) for r in runs.values())}")
PY
)
echo "$input_total" | grep -v '^TOTAL_INPUT_PROCESSED'
input_total=$(grep '^TOTAL_INPUT_PROCESSED' <<<"$input_total" | cut -d' ' -f2)
echo

echo "=== 2. Merged PRs since $day"
json=$(gql -f q="repo:$OWNER/$REPO is:pr is:merged merged:>=$day" -f query='
  query($q: String!) { search(query: $q, type: ISSUE, first: 100) { nodes { ... on PullRequest {
    number title createdAt mergedAt comments { totalCount } files { totalCount }
    closingIssuesReferences(first: 5) { nodes { number labels(first: 20) { nodes { name } }
      comments(last: 60) { nodes { body } } } } } } } }')
bugs=$(gh issue list -R "$OWNER/$REPO" --state all --label type:bug --limit 200 --search "created:>=$day" --json body --jq '[.[].body | scan("PR #([0-9]+)")[]] ' 2>/dev/null || echo '[]')
jq -r --argjson bugs "$bugs" '
  .data.search.nodes[] | select(.number != null)
  | .number as $n
  | (.closingIssuesReferences.nodes) as $is
  | ([$is[].comments.nodes[].body | select(test("^Round [0-9]+/2 failed"; "i"))] | length) as $rounds
  | ([$is[].labels.nodes[].name | select(startswith("escalated:") or . == "needs-owner")] | unique | join(" ")) as $esc
  | ([$bugs[] | select(. == ($n | tostring))] | length) as $b
  | "#\(.number)  \(.title[0:80])\n    issues: \([$is[].number] | map(tostring) | join(",") | if . == "" then "-" else . end) | files \(.files.totalCount) | comments \(.comments.totalCount) | \(((((.mergedAt|fromdate)-(.createdAt|fromdate))/360)|round)/10)h open | failed rounds \($rounds) | bugs \($b)\(if $esc != "" then " | \($esc)" else "" end)",
    "ROW\t\($rounds)\t\($b)\t\(if $esc != "" then 1 else 0 end)"
' <<<"$json" > /tmp/team-metrics.$$ || true
grep -v '^ROW' /tmp/team-metrics.$$
count=$(grep -c '^ROW' /tmp/team-metrics.$$ || true)
rounds_total=$(awk -F'\t' '/^ROW/{s+=$2} END{print s+0}' /tmp/team-metrics.$$)
bugs_total=$(awk -F'\t' '/^ROW/{s+=$3} END{print s+0}' /tmp/team-metrics.$$)
escalated=$(awk -F'\t' '/^ROW/{s+=$4} END{print s+0}' /tmp/team-metrics.$$)
rm -f /tmp/team-metrics.$$
echo

echo "=== 3. Guard hook blocks since $day (.claude/guard.log: count, rule [role])"
if [[ -f "$root/.claude/guard.log" ]]; then
  awk -F'\t' -v s="$since" '$1 >= s {r[$3" ["$2"]"]++} END {for (k in r) printf "%4d  %s\n", r[k], k}' "$root/.claude/guard.log" | sort -rn | head -20
else
  echo "(no blocks logged)"
fi
echo

echo "=== 4. Rates"
ci=$(gh run list -R "$OWNER/$REPO" --workflow app.yml --event pull_request --limit 40 --json createdAt,updatedAt \
  --jq "[.[] | select(.createdAt >= \"$since\") | ((.updatedAt|fromdate)-(.createdAt|fromdate))/60] | if length>0 then (add/length*10|round)/10 else 0 end")
# Arithmetic in python: an awk program inside $(...) loses its braces under some shells and then
# blocks reading stdin.
calc() { python3 -c "import sys; print($1)"; }
if (( count > 0 )); then
  per_pr=$(calc "f'{$input_total/$count/1e6:.1f}M'"); rounds_pr=$(calc "f'{$rounds_total/$count:.2f}'"); bugs_pr=$(calc "f'{$bugs_total/$count:.2f}'")
else
  per_pr=n/a; rounds_pr=n/a; bugs_pr=n/a
fi
echo "merged PRs: $count ($(calc "f'{$count/$weeks:.1f}'")/week)"
echo "input tokens processed per merged PR: $per_pr"
echo "failed rounds per PR: $rounds_pr   escalated PRs: $escalated   tester bugs per PR: $bugs_pr"
echo "average PR CI run: ${ci} min"

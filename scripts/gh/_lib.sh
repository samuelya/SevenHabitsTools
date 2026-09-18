# Shared helpers for scripts/gh/*.sh. Source it; don't run it.

OWNER="samuelya"
REPO="SevenHabitsTools"

# gh api graphql with retries on rate-limit responses only, with a growing wait.
gql() {
  local attempt out
  for attempt in 1 2 3 4; do
    if out=$(gh api graphql "$@" 2>&1); then
      printf '%s' "$out"
      return 0
    fi
    if grep -qi 'rate limit' <<<"$out" && (( attempt < 4 )); then
      echo "GitHub rate limit hit; retrying in $(( attempt * 20 ))s..." >&2
      sleep $(( attempt * 20 ))
      continue
    fi
    grep -o 'gh: .*' <<<"$out" >&2 || echo "$out" >&2
    return 1
  done
}

require_number() {
  [[ "$1" =~ ^[0-9]+$ ]] || { echo "Expected a number, got: '$1'" >&2; exit 1; }
}

# Drops HTML comments (invisible on GitHub, so nobody reading the issue sees them either)
# and collapses runs of blank lines.
clean_md() {
  perl -0pe 's/<!--.*?-->//gs; s/\r//g; s/\n{3,}/\n\n/g'
}

#!/usr/bin/env bash
# Usage: scripts/gh/set-status.sh <issue-number> "<Status option name>"
set -euo pipefail

OWNER="samuelya"
REPO="SevenHabitsTools"
PROJECT_TITLE="Seven Habits Tools"

issue="${1:?issue number required}"
status="${2:?status name required (Backlog|Ready|In progress|In review|Done)}"

project_number=$(gh project list --owner "$OWNER" --format json \
  --jq ".projects[] | select(.title == \"$PROJECT_TITLE\") | .number")
[[ -n "$project_number" ]] || { echo "Project '$PROJECT_TITLE' not found" >&2; exit 1; }

project_id=$(gh project view "$project_number" --owner "$OWNER" --format json --jq .id)

field_json=$(gh project field-list "$project_number" --owner "$OWNER" --format json \
  --jq '.fields[] | select(.name == "Status")')
field_id=$(jq -r .id <<<"$field_json")
option_id=$(jq -r --arg s "$status" '.options[] | select(.name == $s) | .id' <<<"$field_json")
[[ -n "$option_id" ]] || { echo "Status option '$status' not found" >&2; exit 1; }

issue_url="https://github.com/$OWNER/$REPO/issues/$issue"
item_id=$(gh project item-list "$project_number" --owner "$OWNER" --limit 500 --format json \
  --jq ".items[] | select(.content.url == \"$issue_url\") | .id")

if [[ -z "$item_id" ]]; then
  item_id=$(gh project item-add "$project_number" --owner "$OWNER" --url "$issue_url" --format json --jq .id)
fi

gh project item-edit --id "$item_id" --project-id "$project_id" \
  --field-id "$field_id" --single-select-option-id "$option_id" >/dev/null

echo "#$issue -> $status"

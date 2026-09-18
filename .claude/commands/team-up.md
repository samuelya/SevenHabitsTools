---
name: team-up
description: Readiness check for the Seven Habits Tools agent team (business-analyst, backend-coder, frontend-coder, tester) before an implementation session
---

# Team up — Seven Habits Tools

Run this at the start of an implementation session.

1. `gh auth status`: confirm the scopes include `repo` and `project`.
2. Confirm the four team definitions exist in `.claude/agents/custom/` (`business-analyst`, `backend-coder`, `frontend-coder`, `tester`) and read each one's `model:` line.
3. List open escalations and report them to the owner first. Run once per label:
   `gh issue list -R samuelya/SevenHabitsTools --label needs-owner`, then `--label escalated:opus`, then `--label escalated:fable`.
4. List open PRs (`gh pr list -R samuelya/SevenHabitsTools`) and leftover worktrees (`git worktree list`). Flag any worktree whose PR is already merged.
5. Print a table with the columns: agent | definition file | default model | escalation tiers.

Pipeline reminder:
- The owner picks an issue.
- `backend-coder` or `frontend-coder` implements it in its own worktree and opens a PR.
- The owner runs `/code-review` (effort scaled to risk); the coder fixes the findings.
- `tester` verifies the reviewed PR; bugs count as a failed round.
- The owner merges.

Escalation is 2 rounds per tier: Sonnet → Opus → Fable → owner (see `CLAUDE.md`). `business-analyst` curates the backlog independently.

Status names are case-sensitive: `scripts/gh/set-status.sh <issue> "In progress"` (options: `Backlog`, `Ready`, `In progress`, `In review`, `Done`).

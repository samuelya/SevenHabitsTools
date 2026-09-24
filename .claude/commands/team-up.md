---
name: team-up
description: Readiness check for the Seven Habits Tools agent team (business-analyst, backend-coder, frontend-coder, tester) before an implementation session
---

# Team up — Seven Habits Tools

Run this at the start of an implementation session. One Bash call for the reads, then one table.

1. `gh auth status`: scopes include `repo` and `project`.
2. `.claude/agents/custom/`: the four definitions exist (`business-analyst`, `backend-coder`, `frontend-coder`, `tester`); read each one's `model:` line only (`grep -m1 '^model:'`).
3. Guard hook installed: `.claude/settings.json` has a `PreToolUse` entry for `Bash` pointing at `.claude/hooks/guard-bash.sh`, and the script is executable. If not, the mechanical rules are unenforced: say so first.
4. Open escalations, reported to the owner first: `gh issue list -R samuelya/SevenHabitsTools --label needs-owner`, then `--label escalated:opus`, then `--label escalated:fable`.
5. Open PRs (`gh pr list -R samuelya/SevenHabitsTools`) and leftover worktrees (`git worktree list`): flag any worktree whose PR is merged, and offer to remove it.
6. This session's model: the lead runs on Opus by default (`.claude/settings.json`); switch to Fable with `/model` only for an escalation or a design decision, and back afterwards.
7. Print a table: agent | default model | escalation tiers.

Pipeline reminder: owner picks an issue → coder (own worktree, one round) → PR → owner runs `/code-review` (effort scaled to risk) → fresh coder fixes findings → tester (feature PRs; skipped for small fixes, see CLAUDE.md "Tester scope") → owner merges. Coders run on Opus 5.5 (CLAUDE.md "Coder model"); escalation is 2 rounds per tier, Opus 5.5 → Fable → owner. The tester runs on Sonnet. `business-analyst` curates the backlog independently on Opus 5.5.

Status names are case-sensitive: `scripts/gh/set-status.sh <issue> "In progress"` (`Backlog`, `Ready`, `In progress`, `In review`, `Done`).

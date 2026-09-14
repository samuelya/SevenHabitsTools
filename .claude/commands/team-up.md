---
name: team-up
description: Register the Seven Habits Tools agent team (business-analyst, backend-coder, frontend-coder, tester) in ruflo and verify it is ready
---

# Team up — Seven Habits Tools

Ruflo agent registrations expire, so run this at the start of every implementation session.

1. Load the ruflo MCP tools with ToolSearch: `select:mcp__claude-flow__swarm_init,mcp__claude-flow__swarm_status,mcp__claude-flow__agent_spawn,mcp__claude-flow__agent_list,mcp__claude-flow__memory_search`.
2. `swarm_init` with topology `hierarchical`, maxAgents `6`, strategy `specialized`.
3. `agent_spawn` four times (skip any already listed by `agent_list`):
   - `business-analyst` — type `researcher`, model `inherit` (runs `claude-fable-5-1`), capabilities: book research, issue specs, backlog grooming
   - `backend-coder` — type `coder`, model `sonnet` (escalates to opus → fable), capabilities: .NET 10 API, YARP, OAuth BFF, Bicep, GitHub Actions
   - `frontend-coder` — type `coder`, model `sonnet` (escalates to opus → fable), capabilities: Angular, Material, signals, IndexedDB, Transloco RTL, PWA
   - `tester` — type `tester`, model `sonnet` (opus for escalated or risky PRs), capabilities: acceptance testing, Playwright, RTL/mobile checks, bug reports
4. `memory_search` query `sevenhabits escalation` (namespace `agents`) — confirm the four charters, the pipeline entry and `sevenhabits-escalation-policy` exist. If any are missing, store them from `.claude/agents/custom/*.md` and the Escalation block in `CLAUDE.md`.
5. `gh auth status` — confirm scopes include `repo` and `project`.
6. List open escalations: `gh issue list -R samuelya/SevenHabitsTools --label needs-owner --label escalated:opus --label escalated:fable` (run once per label) and report them to the owner first.
7. Print a table: agent | ruflo registered | definition file | default model.

Pipeline reminder: owner picks an issue → `backend-coder`/`frontend-coder` (own worktree, PR) → `tester` (bugs = failed round) → owner runs `/code-review` and merges. Escalation: 3 rounds per tier, Sonnet → Opus → Fable → owner (see `CLAUDE.md`). `business-analyst` curates the backlog independently.

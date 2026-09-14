---
name: team-up
description: Register the Seven Habits Tools agent team (business-analyst, backend-coder, frontend-coder, tester) in ruflo and verify it is ready
---

# Team up — Seven Habits Tools

Ruflo agent registrations expire, so run this at the start of every implementation session.

1. Load the ruflo MCP tools with ToolSearch: `select:mcp__claude-flow__swarm_init,mcp__claude-flow__swarm_status,mcp__claude-flow__agent_spawn,mcp__claude-flow__agent_list,mcp__claude-flow__memory_search`.
2. `swarm_init` with topology `hierarchical`, maxAgents `6`, strategy `specialized`.
3. `agent_spawn` four times (skip any already listed by `agent_list`):
   - `business-analyst` — type `researcher`, capabilities: book research, issue specs, backlog grooming
   - `backend-coder` — type `coder`, capabilities: .NET 10 API, YARP, OAuth BFF, Bicep, GitHub Actions
   - `frontend-coder` — type `coder`, capabilities: Angular, Material, signals, IndexedDB, Transloco RTL, PWA
   - `tester` — type `tester`, capabilities: acceptance testing, Playwright, RTL/mobile checks, bug reports
4. `memory_search` query `sevenhabits` (namespace `agents`) — confirm the four charters and the pipeline entry exist. If missing, store them from `.claude/agents/custom/*.md`.
5. `gh auth status` — confirm scopes include `repo` and `project`.
6. Print a table: agent | ruflo registered | definition file | model.

Pipeline reminder: owner picks an issue → `backend-coder`/`frontend-coder` (own worktree, PR) → `tester` (bugs back to coder) → owner runs `/code-review` and merges. `business-analyst` curates the backlog independently.

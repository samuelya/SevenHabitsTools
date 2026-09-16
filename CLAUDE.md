# Seven Habits Tools — Claude Code Configuration

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER add a `Co-Authored-By` trailer to commits. The Claude Code Bash tool may suggest one in its default commit-message template; ignore it.
- Keep files under 500 lines
- Validate input at system boundaries

## Seven Habits Tools — Team

Run `/team-up` at the start of each implementation session (readiness check: gh auth, open escalations, open PRs, leftover worktrees).
Read the pinned GitHub issue "Architecture & conventions (read first)" before any work.

| Agent | Model | Owns | Never |
|---|---|---|---|
| `business-analyst` | claude-fable-5-1 | GitHub backlog: issues, epics, sub-issues, Project fields, "BA log" | edits code, closes issues |
| `backend-coder` | claude-sonnet-5 (escalates) | `src/api/**`, `src/api.Tests/**`, `infra/**`, `.github/workflows/**` | touches `src/web`, merges |
| `frontend-coder` | claude-sonnet-5 (escalates) | `src/web/**` | touches api/infra, merges |
| `tester` | claude-sonnet-5 (Opus for escalated/risky PRs) | PR verification, `type:bug` issues | fixes code, merges |

Agent definitions live in `.claude/agents/custom/`.

Pipeline: owner picks an issue → coder in its own worktree (`feat/<issue>-<slug>`) → PR `Closes #n` → owner runs `/code-review` → coder fixes findings → `tester` (bugs → failed round) → owner merges.

**Review before test.** The review runs before the tester, because a rejected review makes the tester's round worthless. Don't spend a full verification matrix on code a review is likely to send back.

**Escalation (lead-run; agents can't change their own model):**
- **Failed round:** CI red after "done", tester files bugs, or the coder is stuck. The coder comments `Round <n>/3 failed on <model>` on the issue and fixes it on the same branch.
- **3 attempts per tier.** Ladder: Sonnet ×3 → **Opus** ×3 (label `escalated:opus`) → **Fable** ×3 (label `escalated:fable`) → **owner** (label `needs-owner`). After a tier's 3rd failure, the coder comments `Escalation: 3/3 rounds failed…`, messages `team-lead` and stops. The lead starts a fresh agent with `model` set to the next tier, on the same branch and worktree, pointing it at those comments.
- **Early escalation:** the owner may escalate before the 3rd round when a coder is clearly struggling or burning tokens. The lead stops the agent and records the round history on the issue.
- **Tester:** Sonnet by default. Opus when the issue is `escalated:*`, the PR touches security or data integrity, or a Sonnet run was inconclusive.
- **Owner escalation (`needs-owner`)** for permission-blocked actions (Azure roles, deploys, secrets, global toolchain), changes to approved decisions, and scope or cost changes.
- **Record of rounds:** the round and escalation comments on the issue, plus the tester's checklist on the PR, are the record.

Status updates: `scripts/gh/set-status.sh <issue> "<Status>"`. Shared config (`CLAUDE.md`, `.claude/`, `.gitignore`, root files) is lead-only and changes via PR (`main` is protected: PR required, 5 required CI checks, no bypass).

## Cost discipline (lead-run)

Token cost is a first-class constraint: the owner pays per token and has hit a monthly limit. A long-lived agent is the main cost driver, because every turn resends its whole history and an idle gap expires the cache, re-billing it in full.

- **One issue at a time by default.** Parallel issues cause conflicts, rebases and re-checks; each is an extra round. Run two only when they share no files.
- **Fresh agent per round.** A coder or tester does one round, hands off and stops. The lead starts a new agent for the next round, pointed at the issue and the tester's PR comment. GitHub is the shared memory, so those comments must be good enough to continue from.
- **Short messages.** Detail goes in the issue or PR comment; agent-to-agent and agent-to-lead messages are at most 5 lines. The lead reports to the owner only decisions, failures, merge-ready PRs and things needing a choice, not every acknowledgement.
- **Cap the rounds.** After two failed rounds on one issue, escalate a tier or split the rest into a follow-up issue instead of iterating.
- **Model tiers.** Sonnet by default. Opus only for data-integrity or security work, or an escalation.
- **Test cadence.** Targeted tests while iterating; the full unit and e2e suites once before hand-off, and again only for the delta after a rebase.
- **Never duplicate CI.** CI already runs lint, unit, build and e2e on every push. The tester relies on it and spends its round on the acceptance criteria and what CI cannot do (RTL, keyboard, offline, two tabs, exploratory). Re-running the same suite locally and then checking `gh pr checks` pays twice for one answer.
- **Scale review effort to risk.** `/code-review medium` for a small bug fix; `high`/`max` only for data integrity, security, migrations or sync. A re-review targets the delta plus the files it touches, not the whole PR again.
- **Design check before coding.** Anything touching platform or browser semantics (IndexedDB versioning, Web Locks, storage eviction, service workers) gets a three-sentence "why this works in the failure case the issue describes" comment on the issue *before* implementation. A wrong premise costs a whole round; the comment costs almost nothing.
- **Bundle disjoint small bugs.** Two or three small bugs on non-overlapping files go in one branch and one PR: one review, one test matrix, one merge.
- **Work in bursts.** Finish an issue and stop its agents rather than leaving several idle for hours.

## Working in parallel

- One writer per worktree; every writing agent gets its own worktree and a non-overlapping file scope.
- Read-only research may run concurrently and report findings to the lead.
- Only the lead reconciles overlapping changes to shared files; coders rebase onto `origin/main` when another PR lands first.
- Testers verify an exact commit SHA and re-check that the PR head has not moved before posting a verdict.
- Named agents coordinate with `SendMessage` (the coder hands off to its tester by name; blockers go to `team-lead`). Don't poll; agents message back.

## Build & Test

- ALWAYS run tests after code changes and verify the build before committing.
- Web (`src/web`): `npm ci && npm run lint && npm test -- --watch=false && npm run build && npm run e2e` (see `src/web/docs/testing.md`).
- API (`src/api`): `dotnet build -warnaserror && dotnet test`.
- CI and required checks: see `docs/ci.md`.

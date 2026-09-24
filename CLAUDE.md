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

Run `/team-up` at the start of each implementation session (gh auth, guard hook, open escalations, open PRs, leftover worktrees). Run `/eco-review` every two weeks or ten merged PRs: it measures tokens and quality (`scripts/gh/team-metrics.sh`), compares with the last review on the "Ecosystem review log" issue, and proposes at most three changes.
Read the pinned GitHub issue "Architecture & conventions (read first)" before any work.

| Agent | Model | Owns | Never |
|---|---|---|---|
| `business-analyst` | claude-opus-5-5 (Fable when the lead starts it for an epic's design) | GitHub backlog: issues, epics, sub-issues, Project fields, "BA log" | edits code, closes issues |
| `backend-coder` | claude-sonnet-5; claude-opus-5-5 first on risky issues (see Model routing); escalates | `src/api/**`, `src/api.Tests/**`, `infra/**`, `.github/workflows/**` | touches `src/web`, merges |
| `frontend-coder` | claude-sonnet-5; claude-opus-5-5 first on risky issues (see Model routing); escalates | `src/web/**` | touches api/infra, merges |
| `tester` | claude-sonnet-5 (Opus 5.5 for escalated/risky PRs) | PR verification, `type:bug` issues | fixes code, merges |
| lead (this session) | claude-opus-5-5; `/model` Fable only for an escalation or a design decision, then back | orchestration, `/code-review`, merges on the owner's say-so | codes in an agent's worktree |

Agent definitions live in `.claude/agents/custom/`. They are short on purpose: this file is in every agent's context, so shared rules live here, once.

**Guard hook.** `.claude/hooks/guard-bash.sh` (wired in `.claude/settings.json`, `PreToolUse` on `Bash`) blocks the mechanical rules for every agent and the lead at zero token cost: global toolchain changes and `sudo`, `git stash`, pushes to `main`, `--no-verify`, `gh pr merge` and `gh issue/pr close` (the owner's steps; subagents are blocked outright, and the lead prefixes `OWNER_MERGE=1` when the owner asked for the merge), `gh issue view`/`gh pr view` without `--json` (use the scripts), `gh pr checks --watch`/`gh run watch`/poll loops and a backgrounded `wait-ci.sh` (use `wait-ci.sh` in the foreground), bare `npm run e2e`/`npx playwright test` (use `e2e-local.sh`), `tail` of 200+ lines and `sleep` of 30 s+. It ignores heredoc bodies and `--body`/`-m` payloads, so docs may mention these commands. A blocked call is not a failure: do what the message says.

Pipeline: owner picks an issue → coder in its own worktree (`feat/<issue>-<slug>`) → PR `Closes #n` → owner runs `/code-review` → fresh coder fixes findings → `tester` (Sonnet) runs CI and the tests and posts failures (bugs → failed round) → fresh coder fixes → owner merges.

**Review before test.** A rejected review makes the tester's round worthless, so the review runs first and the tester only sees reviewed code.

**Tester scope.** The tester runs for new features and exercises, and for any PR touching data (model, migration, storage, import/export, sync) or security. It is skipped for small fixes: `type:bug` or docs PRs of a few files with no data or security change, where review plus green CI is enough and the lead reads the CI result with `wait-ci.sh`. The lead decides per PR and says which in the merge note.

**Agent start gate.** Before starting any agent against a worktree, check `ListAgents`, not memory of an earlier report. If the previous agent for that issue/worktree still shows `running`, that is the answer: don't spawn a second one. Wait for it to go idle, or message it and wait for its reply. Two coders in one worktree overwrite each other's uncommitted changes; a tester started against a coder still pushing verifies a stale commit. If a duplicate is started anyway and stops itself on detecting a live writer, don't restart it: keep whichever has real progress and `TaskStop` the other.

**Tester start gate.** Start the tester only once the coder's round is closed on the exact PR head it will verify. If the lead sent that coder anything after its "done" report, wait for its next report (or `gh pr view <pr> --json headRefOid` for a new SHA) before spawning. If the head moves mid-run, `TaskStop` the tester and restart it on the final SHA.

**Model routing (lead-run, at the coder's first round).** Start the coder on Opus 5.5 (`model: "opus"`) when the issue touches data (model, migration, storage, import/export, sync) or security, needs a design check (list under Cost discipline), or is size L; otherwise on its Sonnet default. The 4 weeks to 2026-09-24 put every failed round on such issues (#122, #147, #148, #165, #234), each burning two Sonnet rounds before the Opus escalation, while small fixes passed first time on Sonnet; Opus 5.5 costs about 30% more per run at this team's cache-heavy mix, so it pays only where a Sonnet round is likely to fail. The lead names the chosen model and reason in the start message; the coder's `round.sh` comment records it.

**Escalation (lead-run; agents can't change their own model):**
- **Failed round:** CI red after "done", tester files bugs, or the coder is stuck. The coder posts `scripts/gh/round.sh <issue> failed <n>/2 <model> "<what failed, planned fix>"` (the canonical comment the metrics count; never hand-write it) and fixes it on the same branch.
- **2 attempts per tier.** Sonnet ×2 → **Opus 5.5** ×2 (label `escalated:opus`) → **Fable** ×2 (label `escalated:fable`) → **owner** (label `needs-owner`). After a tier's 2nd failure the coder posts `scripts/gh/round.sh <issue> escalation 2/2 <model> "…"`, messages `team-lead` and stops; the lead starts a fresh agent with `model` set to the next tier, same branch and worktree, pointed at those comments. An issue routed to Opus 5.5 starts at that tier: Opus ×2 → Fable ×2 → owner, and `escalated:opus` is not added for routing alone.
- **Skip round 2 when round 1 failed on a clear scope/approach miss** rather than a fixable bug: a same-tier retry will repeat the mistake.
- **Early escalation:** the owner may cut a round short when a coder is clearly struggling or burning tokens; the lead stops the agent and records the round history on the issue.
- **Tester:** Sonnet by default; Opus 5.5 when the issue is `escalated:*`, the PR touches security or data integrity, or a Sonnet run was inconclusive. Rounds belong to the coder: a clear failure is recorded once and sent back, never re-tested on Opus.
- **Owner escalation (`needs-owner`)** for permission-blocked actions (Azure roles, deploys, secrets, global toolchain), changes to approved decisions, and scope or cost changes.
- **Record of rounds:** the round and escalation comments on the issue, plus the tester's checklist on the PR, are the record.
- **Every coder run ends with a `round.sh` comment** (`passed`, `failed`, `review-fix`, `polish`, `escalation`), not just the failures: `team-metrics.sh` prints coder runs from the transcripts next to the round comments per merged PR, so an unrecorded run shows as a gap (#212: 4 runs, 107M tokens, 0 comments).

Status updates: `scripts/gh/set-status.sh <issue> "<Status>"`, Status exactly one of `Backlog`, `Ready`, `In progress`, `In review`, `Done`. Reading GitHub: `scripts/gh/issue-context.sh <n>` and `scripts/gh/pr-context.sh <pr>` (one call each, nothing truncated); sub-issues: `scripts/gh/link-sub-issue.sh <parent> <child>`; CI: `scripts/gh/wait-ci.sh <pr>` (foreground only, Bash timeout 600000, never `run_in_background` — backgrounding it ends your turn and the round sits idle on a green PR; exit 0 green, 1 failed, **2 still running: run it again**). Shared config (`CLAUDE.md`, `.claude/`, `.gitignore`, root files) is lead-only and changes via PR (`main` is protected: PR required, 5 required CI checks, no bypass).

## Cost discipline (lead-run)

Token cost is a first-class constraint: the owner pays per token and has hit a monthly limit. A long-lived agent is the main cost driver, because every turn resends its whole history and an idle gap expires the cache, re-billing it in full.

- **Context × turns is the cost.** The week before 2026-09-19, one coder run made 809 model calls at a median 473k-token context (peak 966k) and processed 396M input tokens; the tester averaged 111k per turn and the lead 278k. Two hard caps hold this down: `maxTurns` in each agent's frontmatter (coders 300, tester 150, BA 100; a capped run returns partial output and the lead resumes it or starts a fresh agent from the WIP commit) and `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=30` in `.claude/settings.json` (compaction at 30% of the window, for the lead and every subagent). Agents keep context small by reading narrowly, batching independent calls in one turn, and committing WIP checkpoints so a cap loses nothing. `/eco-review` watches whether these move the numbers without raising failed rounds.
- **One issue at a time by default.** Run two only when they share no files.
- **Fresh agent per round.** A coder or tester does one round, hands off and stops. The lead starts a new agent for the next round, pointed at the issue and the PR comment. GitHub is the shared memory, so those comments must be good enough to continue from.
- **Fix rounds read less.** A fresh agent on a fix round reads the issue, the PR context and the files the findings name; not the architecture issue or the playbook again. Post `/code-review` findings as a PR comment (not only a message), then start a fresh agent for the fix. Resume the original coder only if it is still `running` when the review lands.
- **Don't let a round sit idle.** The prompt cache expires after a gap (about an hour normally, ~5 minutes in usage overage) and the next message re-bills the whole context. Send follow-ups as soon as they are ready.
- **Short messages.** Detail goes in the issue or PR comment; agent-to-agent and agent-to-lead messages are at most 5 lines. The lead reports to the owner only decisions, failures, merge-ready PRs and things needing a choice.
- **Cap the rounds.** Two attempts per tier is the ceiling; escalate a tier or split the rest into a follow-up issue instead of iterating further.
- **Model tiers.** Sonnet 5 for coders (except risky issues, see Model routing) and the tester; Opus 5.5 for the lead and the BA; Fable only for escalations, design decisions and an epic's BA design. Switch the lead with `/model` per task, not per session.
- **Test cadence (owner, 2026-09-24).** Coders write the tests but don't run them: they run only lint and the type check or build (web: `npm run lint` plus `npm run build` or `tsc --noEmit`; API: `dotnet build -warnaserror`), push and hand off without waiting on CI. Test output is large and a coder on a big context pays for every line of it. The tester, on Sonnet, runs `wait-ci.sh`, reads the failures narrowly and posts them as one PR comment for the next coder round. A red CI caught this way goes back as a `review-fix` round and does not count against the tier's two attempts; failed acceptance criteria and filed bugs still do.
- **Never duplicate CI.** The tester relies on CI and spends its round on the acceptance criteria and what CI cannot do (RTL, keyboard, offline, two tabs, exploratory). If CI is red, the tester posts the failing tests (name, file, one-line error) and stops: that is its whole round.
- **Scale review effort to risk.** `/code-review medium` for a small bug fix; `high`/`max` only for data integrity, security, migrations or sync. A re-review targets the delta plus the files it touches.
- **Design check before coding.** Anything touching platform or browser semantics (IndexedDB versioning, Web Locks, storage eviction, service workers, router/component-reuse for a stateful in-page editor or wizard, focus and timing after DOM changes: CDK focus trap, `afterNextRender`, animation end; layout sizing: definite vs content-based heights, the real scroll container, overflow containment) gets a three-sentence "why this works in the failure case the issue describes" comment on the issue before implementation. A wrong premise costs a whole round (#139 IndexedDB reopen; #187 sibling routes recreating the page on every open/close, three rounds before review caught it; #174 three rounds on when a drawer becomes focusable); the comment costs almost nothing.
- **Measure the premise, don't argue it.** A design check about layout, sizing or timing gives before/after numbers taken from the running app in the issue's failure case, not an argument from spec semantics (#213: two reasoned CSS design checks, both wrong, 2 failed rounds and an Opus escalation on an S issue; the measured third passed twice).
- **Bundle disjoint small bugs.** Two or three small bugs on non-overlapping files go in one branch and one PR.
- **Hand back what the team can't verify.** Some things cannot be checked from this machine: platform-specific rendering (classic scrollbars on Windows/Linux, Safari and iOS behaviour), real devices, print and PDF output, anything whose evidence is a screenshot this CLI cannot attach, and any paid or external service. An agent that hits one **says so plainly** — what it could not verify, why, and what the owner should look at — instead of building a proxy for it or spending a round trying to simulate it. The lead collects these into an **"Owner check"** list in the merge note and the owner tests manually; a round is never spent on something only the owner can see. A "verified" that rests on a proxy is worse than an honest gap, because it buys false confidence: #234 shipped `scrollbar-gutter: stable` for a layout jump that is invisible on macOS and in headless Chromium, and the tester correctly refused to claim it.
- **The owner sees it working before polish rounds.** Once CI is green and the feature does what the issue asked, hand the PR to the owner *before* spending another round on low-severity findings. The owner may not care about some of them, and that is far cheaper to learn before the round than after. Unfixed findings go on the PR as a list; the ones the owner wants become scope for the next issue. A high-severity finding — wrong data, lost work, a broken primary flow — is still fixed first, without asking.
- **No rediscovery.** Anything two agents had to work out goes into the docs they read (`testing.md`, the playbook, agent definitions), not into lead memory, which subagents never see.
- **Work in bursts.** Finish an issue and stop its agents rather than leaving several idle for hours.

## Working in parallel

- One writer per worktree; every writing agent gets its own worktree and a non-overlapping file scope.
- Read-only research may run concurrently and report findings to the lead.
- Only the lead reconciles overlapping changes to shared files; coders rebase onto `origin/main` when another PR lands first.
- Testers verify an exact commit SHA and re-check that the PR head has not moved before posting a verdict.
- Named agents coordinate with `SendMessage` (blockers go to `team-lead`). Don't poll; agents message back.

## Build & Test

- ALWAYS run tests after code changes and verify the build before committing.
- Web (`src/web`): `npm ci && npm run lint && npm test -- --watch=false && npm run build && npm run e2e` (see `src/web/docs/testing.md`).
- API (`src/api`): `dotnet build -warnaserror && dotnet test`.
- CI and required checks: see `docs/ci.md`.

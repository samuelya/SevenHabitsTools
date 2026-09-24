---
name: eco-review
description: Periodic review of the agent development ecosystem. Measures token use and quality over the last window, compares with the previous review, and proposes at most three evidence-backed changes.
---

# Ecosystem review — Seven Habits Tools

Run every two weeks or every ten merged PRs, on Opus. Budget: about 15 turns. The numbers come from one script; never read transcripts, and read an agent definition or doc only when you are about to propose an edit to it.

## 1. Measure (one call)
`scripts/gh/team-metrics.sh --weeks 2` (add `--weeks 4` for a monthly look). Sections: tokens by model and role, the most expensive agent runs (turns, median and max context per turn), merged PRs with round history, guard-hook blocks by rule, and the rates.

## 2. Compare with the previous review
Find the log: `gh issue list -R samuelya/SevenHabitsTools --search "Ecosystem review log in:title" --state all --json number --jq '.[0].number'`, then `scripts/gh/issue-context.sh <n>`; the newest comment is the previous scorecard. Build this window's scorecard next to it:

| metric | previous | now |
|---|---|---|
| merged PRs / week | | |
| input tokens processed per merged PR | | |
| avg context per turn: coder / tester / lead | | |
| median turns per coder run; runs that hit `maxTurns` | | |
| failed rounds per PR; escalated PRs; tester bugs per PR | | |
| share of tokens on Opus + Fable | | |
| CI minutes per PR run | | |
| context budget: `wc -c CLAUDE.md .claude/agents/custom/*.md src/web/docs/exercise-playbook.md` | | |

## 3. Diagnose the three most expensive runs
For each: its issue (`scripts/gh/issue-context.sh`), turns, median context, whether it ended by `maxTurns`, and the round comments. Classify the cost: (a) large tool outputs kept in context (test results, whole files, page dumps); (b) retries or rediscovery; (c) spec ambiguity or a wrong premise; (d) an issue too big for one run; (e) legitimate size. One line each.

## 4. Check the levers (answer each yes/no with the number)
- A rule in CLAUDE.md or an agent definition with no incident or number behind it: delete it.
- A hook rule that fired in neither of the last two windows: delete it; one that fires often: is the underlying instruction wrong, or the agents working around it?
- A prose rule agents keep breaking: turn it into a hook or a script.
- The most-read docs grew (playbook, architecture issue #1): split must-read from reference.
- `maxTurns` hit often with partial output: issues too big, send that to the business-analyst; never hit: lower the cap.
- `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`: did median context per turn fall without more failed rounds? Keep; if failed rounds rose, raise the percentage one step.
- Every Opus or Fable run maps to an escalation, a design decision, a review or a risk-routed first round (CLAUDE.md "Model routing"); otherwise the model policy leaked. Compare failed rounds and tokens per PR on Opus-routed issues with the Sonnet-first escalations before 2026-09-24 (#122, #147, #148, #165, #234).
- A round that failed on a "design fact" (platform semantics): is it on the design-check list?

## 5. Propose at most three changes
Each: symptom (with its number) → change → expected effect (a number) → how the next review measures it. Prefer hook or script over doc over prose. No rule without a symptom; no change that cannot be measured next time.

## 6. Record and hand over
Post one comment on the log issue: the scorecard, the diagnosis and the proposals. Tell the owner the three proposals in at most ten lines and ask which to implement. Implement the picked ones through a PR (shared config is lead-only; `main` is protected). Note the PR number on the log issue so the next review can check the effect.

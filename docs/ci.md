# CI: required checks

## Why `pull_request` has no `paths` filter

`app.yml` and `infra.yml` used to trigger on `pull_request` only for
`src/**` / `infra/**` (plus their own workflow file). A PR touching only
docs, `scripts/`, `.claude/` or root files never started the workflow, so a
GitHub branch ruleset requiring that workflow's checks would leave them
stuck as "expected" forever — GitHub only treats a **skipped** job as
satisfying a required check, never a workflow that **never ran**.

Both workflows now run on every `pull_request`, and each has a `detect` job
that narrows what actually needs to build:

- **`app.yml` → `Detect projects`** outputs `api` and `web`. On
  `pull_request`, each is `true` only when the project exists **and** its
  files (or `app.yml` itself) changed against the PR base, via
  `git diff --name-only origin/$GITHUB_BASE_REF...HEAD` after a checkout
  with `fetch-depth: 0`. `API build and test` and
  `Web lint, test, build and e2e` still gate on
  `if: needs.detect.outputs.<x> == 'true'`, so they show as **skipped**
  (not missing) on a docs-only PR.
- **`infra.yml` → `Detect infra changes`** outputs `infra` the same way,
  gating `Lint and build Bicep`.

`push` to `main` and `workflow_dispatch` are unchanged: `push` keeps its
`paths` filter (so a docs-only merge still starts no image build or
deploy), and on both events `detect` skips the diff and reports today's
existence-only outputs (a project counts as present if its files exist,
full stop).

## Job names required by the "Protect main" ruleset

The ruleset's required status checks reference these job `name:` values
exactly. Each is called out with a comment in the workflow above the job.
Renaming any of them means updating the ruleset in the same change:

- `Detect projects` (`app.yml`)
- `Detect infra changes` (`infra.yml`)
- `API build and test` (`app.yml`)
- `Web lint, test, build and e2e` (`app.yml`)
- `Lint and build Bicep` (`infra.yml`)

Both `detect` jobs must be required too, not just the jobs they gate. When
a `detect` job fails, the jobs that `need` it are **skipped**, not failed —
and GitHub treats a skipped job as satisfying a required check. If
`Detect projects` / `Detect infra changes` themselves weren't required, a
bug in the detection script could make every downstream job show as
skipped and let a PR merge with nothing actually built, tested or linted.

## Adding a new required job

1. Add the job (or a step in an existing job) and give it a clear, stable
   `name:`.
2. If it should only run for a subset of PRs, gate it on a `detect`
   output the same way `api`/`web`/`infra` do — never rely on the
   `pull_request` trigger's `paths` filter, since there isn't one.
3. Make sure the job reports **skipped**, not missing, when its condition
   is false, so it can be marked required without blocking unrelated PRs.
4. Ask the owner to add the job's `name:` to the "Protect main" ruleset's
   required status checks (an agent cannot change ruleset settings).

# End-to-end testing (Playwright)

This is the harness the testing bar in the architecture issue (#1 §9) requires: a smoke pass at
360×800 (mobile) and 1280×800 (desktop), in `en` and `ar`, with an accessibility scan on every
visited page. It runs once here; feature PRs only add a spec file under `e2e/`.

## Commands for agents (copy these; don't rediscover them)

| Need | Command |
| --- | --- |
| Targeted unit tests while iterating (about 4 s) | `npm test -- --include='**/<feature>/**/*.spec.ts'` (repeat `--include` for more globs). Tests run through the Angular builder, so use `npm test`, not `npx vitest`. |
| E2E in a worktree | `scripts/web/e2e-local.sh [--no-build] [spec files or Playwright args]` from the worktree root. It builds, serves this worktree's build on a free port, runs the line reporter and prints the tail. |
| Wait for CI after a push | `scripts/gh/wait-ci.sh <pr>`: one blocking call that prints only the checks that aren't green, plus the failed log tail. Don't use sleep/poll loops. |

- **Never run bare `npm run e2e` in a worktree.** Its built-in server uses port 4300 with
  `reuseExistingServer`, so it can silently test another worktree's build.
- **Read failures narrowly.** The line reporter's error message is usually enough. Don't `Read`
  `test-results/**` files whole (the page snapshots run to about 50 KB); `grep` them for the
  element or message you need.
- **Pipe long output through `tail -40`**, not `tail -200`/`-400`.

## Running the suite locally against a PR

The tester checks out the PR branch in its own detached worktree per §10 of the architecture
issue. From that worktree:

```sh
cd src/web
npm ci
npx playwright install chromium   # one-time per machine; browsers are cached under ~/.cache
npm run build                     # or: npm start, then set PLAYWRIGHT_BASE_URL (see below)
npm run e2e
```

`npm run e2e` builds nothing itself — it serves whatever is already in `dist/web/browser`
(`e2e/static-server.mjs`, a small static file server with the same SPA-fallback and caching rules
as the production nginx config) and points Playwright's four projects (`mobile-en`, `mobile-ar`,
`desktop-en`, `desktop-ar`) at it. Run `npm run build` first, or point at an already-running
server instead of the built-in one:

```sh
PLAYWRIGHT_BASE_URL=http://localhost:4200 npm run e2e   # e.g. against `npm start`
```

After a run:

- `npx playwright show-report` opens the HTML report (`playwright-report/`, gitignored).
- Failed tests keep a trace; `npx playwright show-trace test-results/<test>/trace.zip` opens it.
- `npm run e2e -- --project=mobile-ar` runs a single project; `--grep <text>` filters by title.

In CI, the `web` job in `app.yml` runs this after `npm run build`, installs only the Chromium
browser (no other browsers, no system packages), and uploads the HTML report and traces as an
artifact when the job fails.

## Chromium only

The four projects all use Chromium to keep CI fast. If a feature needs cross-browser coverage
later, add `webkit`/`firefox` variants of the affected projects rather than switching everything
over — see `playwright.config.ts`.

## Served behind the production Content-Security-Policy

`e2e/static-server.mjs` sends the same `Content-Security-Policy` header production does
(`SecurityHeadersMiddleware.Headers`, `src/api/Middleware/SecurityHeadersMiddleware.cs` — kept in
sync by hand as a literal in the server, since `src/web` cannot depend on `src/api`). This is
deliberate: `ng serve` and a plainer static server are both more permissive than production, which
is exactly how issue #118 (production stylesheet stuck on `media="print"` because the CSP blocks
the critical-CSS `onload`) went undetected until it shipped. Running behind the real CSP here means
the same class of bug fails in this suite instead.

Three `smoke.spec.ts` assertions guard against this regressing: the global stylesheet actually
applies (icon font, via `document.fonts`), no `securitypolicyviolation` fires on load
(`cspViolations` fixture), and the served `index.html` has no `<link rel="stylesheet">` with
`media="print"` or an inline `onload` handler. #118 disabled
`optimization.styles.inlineCritical` for the production build configuration in `angular.json` to
fix this; the rest of the suite, including the accessibility scans, already ran behind this CSP
and found no violations caused by #118's broken stylesheet.

## Fixtures (`e2e/fixtures.ts`)

- `seedDocument(doc)` — writes `doc` (merged onto a minimal valid document) to IndexedDB
  (`sevenhabits` / `documents` / `current`), the schema `IndexedDbAdapter` (issue #35) reads from.
- `setLanguage(lang)` — seeds `settings.language` (`'en' | 'ar'`, per issue #28's data model), read
  by `LanguageStore`/`LanguageSync` on the next load — the app renders `lang`/its direction from
  first paint, no separate switch step needed in a spec that just wants to start already in `ar`.
- `goOffline()` — `context.setOffline(true)`. An offline smoke assertion needs issue #27 (PWA) for
  a service worker to cache the lazy feature chunks; `smoke.spec.ts` has a `test.fixme` for this
  pointing at #27.

`seedDocument`/`setLanguage` write through a `page.addInitScript`, which Playwright reruns on
*every* navigation of that page, including `page.reload()`. Both fixtures seed only once per call
(a `sessionStorage` marker their script checks before writing and sets after — #157): the first
navigation after the call still seeds, but a later reload of the same page is left alone and shows
whatever the app itself actually persisted, not a re-planted copy of the seed. A spec that seeds,
reloads and asserts the data is still there is therefore a genuine persistence check. Call
`seedDocument`/`setLanguage` again for a fresh value instead of relying on a reload to reseed, and
use `context.newPage()` (not `page.reload()`) when a test wants a page with no seed init script at
all — e.g. a genuinely fresh second tab in a multi-tab spec (`multi-tab.spec.ts`).

## Adding a spec for a new feature

Add `e2e/<feature>.spec.ts` importing `test`/`expect` from `./fixtures` instead of
`@playwright/test` directly, so the feature gets `seedDocument`/`setLanguage`/`goOffline` for
free. It runs against all four projects automatically — no changes to `playwright.config.ts`
should be needed. Add an `AxeBuilder` scan (see `smoke.spec.ts`) for any newly visited page.

# End-to-end testing (Playwright)

This is the harness the testing bar in the architecture issue (#1 §9) requires: a smoke pass at
360×800 (mobile) and 1280×800 (desktop), in `en` and `ar`, with an accessibility scan on every
visited page. It runs once here; feature PRs only add a spec file under `e2e/`.

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

## Fixtures (`e2e/fixtures.ts`)

- `seedDocument(doc)` — writes `doc` (merged onto a minimal valid document) to IndexedDB
  (`sevenhabits` / `documents` / `current`), the schema issue #35 (IndexedDB adapter) specifies.
  **#35 hasn't landed yet**: the app still runs on the no-op storage adapter and never reads this
  seed. Specs that need a seed to survive a reload are `test.fixme`, pointing at #35; unskip them
  once #35 merges.
- `setLanguage(lang)` — seeds `settings.language` (`'en' | 'ar'`, per issue #28's data model).
  **#28 hasn't landed yet**: there is no language switcher or Transloco, so the app always renders
  `en`/`ltr` regardless of this seed. Specs asserting the UI actually changed language are
  `test.fixme`, pointing at #28.
- `goOffline()` — `context.setOffline(true)`. An offline smoke assertion needs issue #27 (PWA) for
  a service worker to cache the lazy feature chunks; `smoke.spec.ts` has a `test.fixme` for this
  pointing at #27.

## Adding a spec for a new feature

Add `e2e/<feature>.spec.ts` importing `test`/`expect` from `./fixtures` instead of
`@playwright/test` directly, so the feature gets `seedDocument`/`setLanguage`/`goOffline` for
free. It runs against all four projects automatically — no changes to `playwright.config.ts`
should be needed. Add an `AxeBuilder` scan (see `smoke.spec.ts`) for any newly visited page.

# Exercise playbook

How every habit exercise (Paradigms, Habits 1–7, Interdependence) is built. Read this instead of
re-deriving the approach from the kit, the registries and the store. It records decisions that
are already made; follow it, and if the issue really needs something it doesn't cover, say so on
the issue before building.

**Reference implementation:** `features/paradigms-transition/` (#51), the list type. Start a new
exercise by copying it (`cp -r src/app/features/paradigms-transition src/app/features/<exerciseId>`
plus its `e2e/paradigms-transition.spec.ts`), then rename and edit the copies. Don't write the
files from scratch: it costs far more output tokens and turns for the same result.

Background, only if you need it: `data-model.md` (store, records, registry), `testing.md`, pinned
issue #1 (§6 JSON rules, §7 frontend conventions, §9 testing bar).

## 1. Naming (one exercise = one feature)

| Thing                  | Convention                                                                                          | Example (#51)                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `exerciseId`           | `<habit>-<slug>`, kebab-case                                                                        | `paradigms-transition`                        |
| Folder                 | `src/app/features/<exerciseId>/` (flat: the i18n loader only handles one level)                     | `features/paradigms-transition/`              |
| Files                  | `<slug>.model.ts`, `<slug>.logic.ts`, `<slug>.routes.ts`, `<slug>-page.ts`, specs next to them      | `transition.model.ts`                         |
| Route                  | `habits/<habit>/<slug>` (`buildRoutes()` sorts longer paths first, so it wins over `habits/:habit`) | `habits/paradigms/transition`                 |
| Model key              | the `exerciseId`                                                                                    | `paradigms-transition`                        |
| Document path          | `habits.<habit>.<camelCaseName>`, as given in the issue's "Data model"                              | `habits.paradigms.scripts`                    |
| Transloco scope        | the `exerciseId`; in templates use the camelCase alias Transloco derives from it                    | `paradigmsTransition.step.title`              |
| Route title key        | root scope `titles.<exerciseId>` in `public/assets/i18n/{en,ar}.json`                               | `titles.paradigms-transition`                 |
| Hub title/summary keys | `habits` scope: `exercises.<exerciseId>.title` / `.summary` in `features/habits/i18n/{en,ar}.json`  | `habits.exercises.paradigms-transition.title` |
| Short title            | the *value* of the route title key and the hub title key, written ≤ 3 words (§8) — there is no separate `shortTitleKey` registry field yet; both keys already carry the short form and the chrome (top app bar, hub card) reads them as-is. A distinct field is deferred to #218 | `titles.paradigms-perception` = "Notice your paradigm" |
| Guide key              | exercise's own Transloco scope, `guide` (§8) — `translateObjectSignal('guide', undefined, '<exerciseId>')`                                          | `paradigmsPerception.guide`                   |

The hub page renders the title/summary in the `habits` scope, and shell code renders route titles
in the root scope. A key placed in the exercise's own scope throws there (`ThrowingMissingHandler`, #149/#162).

## 2. Wiring checklist (four registrations, one line each)

1. `<slug>.model.ts`: `registerModel({ key, path, defaults, validate })` **and**
   `registerExercise({ exerciseId, habit, titleKey, summaryKey, icon, route })`. Both at module
   load, with the idempotent guard used in `shared/exercise-kit/exercise-kit.model.ts`. This file
   is in the initial bundle: types, defaults, validators and registrations only, with no component
   or service imports.
2. `src/app/model-registry.ts`: add `import './features/<exerciseId>/<slug>.model';`.
3. `src/app/route-registry.ts`: `{ path: 'habits/<habit>/<slug>', loadChildren: () => import(...) }`.
4. `<slug>.routes.ts`: one route, `title: 'titles.<exerciseId>'`,
   `providers: [provideTranslocoScope('<exerciseId>')]` **plus
   `provideTranslocoScope('exercise-kit')`** if the page uses any kit component (`ExerciseList`,
   `ExerciseDetail`, `DoneToggle`, `ExercisePromptCard`, `ReflectionEditor`, `GuidedStepper`) —
   those components read their own generic-chrome strings (`exerciseKit.*`) from that scope, not
   the exercise's own one, and a route that omits it throws (`ThrowingMissingHandler`, #51).

Plus the i18n files: `features/<exerciseId>/i18n/{en,ar}.json`, the root `titles` key and the
`habits` scope hub keys (§1). `exercise-registry-routes.spec.ts` already proves the route resolves.

**Adding a model needs no `schemaVersion` bump and no migration.** An absent slice falls back to
`defaults()` (`featureStore`), and `validateDocument()` skips absent slices. Bump and add a
migration only when you change the stored shape of a model that has already shipped.

## 3. Data rules

- **Records:** anything the user adds, edits or deletes on its own is a record (`BaseRecord`: `id`,
  `createdAt`, `updatedAt`, `deletedAt?`). Create with `newRecord(fields, clock.now())`, delete with
  `softDelete()`, list with `isLive()`. Issue data models list the domain fields only; the base
  fields are always implied.
- **Nested value objects:** parts that are only ever edited through their parent (the rows of one
  audit, the 3 change attempts in a worksheet) are plain objects inside the parent record, with
  no timestamps. The parent is the merge unit. Give them a `key` only if the UI needs a stable
  `track` value.
- **Never store translated text.** Built-in options (areas, chapters, sources, enums) are stored as
  a stable key (`'work'`, `'h1'`) and translated at render. Store free text only for what the user
  typed, e.g. a custom area name: `{ key?: string; name?: string }`, where exactly one is set.
- **`validate()` checks structure, not business rules.** Check types, required fields, arrays and
  enum membership. Leave out ranges, lengths and "required when X" rules: those belong to form
  validation and pure logic. A failing `validate()` makes bootstrap report the whole document
  `corrupt`, so an over-strict validator locks the user out of their data. Reuse the shared guards
  in `core/data/record-validators.ts` (the reference PR extracts `isBaseRecord`,
  `isOptionalString`, `isOneOf`, `isArrayOf` from `exercise-kit.model.ts`); don't hand-roll them
  per feature.
- **Dates:** a user-entered date is an ISO date string (`YYYY-MM-DD`). Timestamps come from the
  injected `CLOCK`, never `new Date()` in a feature.
- **Access:** only the page (container) component, or one small feature service, calls
  `featureStore<T>(key)`. Presentational components take `input()`s and emit `output()`s.

## 4. The three exercise types

Pick the one the issue describes; a bigger exercise may combine two (e.g. an assessment whose
records contain a list).

| Type                                                  | Stored value                                                  | Kit components                                                                                                                          | Done toggle enabled when                                  | Guide example (§8)                    |
| ----------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------- |
| **Worksheet**: fixed steps filled once                | one record, `defaults: () => null`, created on the first edit | `ExercisePage` (body only, no `[editor]`) + `GuidedStepper`/`GuidedStepContent`, `ExercisePromptCard`, `ReflectionEditor`, `DoneToggle` | `isComplete(record)` is true (pure, in `<slug>.logic.ts`) | one example card per step             |
| **List**: items the user adds/edits/deletes           | `T[]` of records, `defaults: () => []`                        | `ExercisePage` (focus mode) + `ExerciseList`, `ExercisePromptCard`, `DoneToggle` — not `ExerciseDetail`, superseded by §5               | at least one live item passes `isItemComplete(item)`      | one item card per item type/branch    |
| **Assessment**: repeatable, dated, compared over time | `T[]` of dated records (`date`), `defaults: () => []`         | `ExercisePage` (focus mode for a new/edited assessment) + `GuidedStepper` or a form, a result view, `DoneToggle`                        | at least one saved assessment exists                      | one filled assessment                 |

- **Done is always an explicit user action** through `DoneToggle` → `ExerciseProgress.markDone()`.
  Never mark done automatically. Reopening is allowed, and a new assessment doesn't reopen.
- **"Enabled when" in the table above** is `DoneToggle`'s `disabled` input (`!<condition>`), added
  by #51: it only gates "Mark done", never "Reopen" — a page passes its own pure `<slug>.logic.ts`
  predicate over its `featureStore` value, computed the same way the summary card's counts are.
- **Assessment history and comparison:** newest first; compare the latest with the previous one.
  Shared pure helpers go in `shared/exercise-kit/assessment-history.logic.ts` (created by the first
  assessment PR, #49/#50), not copied per feature.
- **Hub progress** comes for free from `registerExercise()` plus `DoneToggle`. Don't edit the hub
  page for a normal exercise.

## 5. Page layout

Every exercise page's template is `app-exercise-page`: one visually hidden `h1` for the title, an
`[intro]` slot for `ExercisePromptCard`, a body, an optional `[editor]` slot (list/assessment
only) and a `[footer]` slot for the summary and `DoneToggle`. Full mechanics — the split-mode
grid's height contract, list selection as a route param, focus management, counts and the delete
pattern — are in `exercise-layout.md`; read it before laying out a new exercise page, it settles
those decisions so building another one needs none of its own.

**The prompt card and the guide, in short (§8 has the full definition of done):**

- `ExercisePromptCard`'s visible part is always the one-paragraph prompt plus, once the exercise
  has one, a "Read more" button; its expandable part (behind "About this exercise") is "Why this
  matters" then a `From: <chapter>` line, in that order. On desktop/tablet it starts expanded and
  collapses once the exercise has been started; on handset it always starts collapsed regardless —
  the visible part alone must carry what a first-time phone user needs.
- "Read more" opens `ExerciseGuide`, a `MatDialog`: full-screen below `HANDSET_QUERY`, centred and
  capped at 560px above it. Four sections, same headings on every exercise: In short, How to do it
  (numbered), An example (§4's "Guide example" column), Afterwards.

## 6. Component and logic split

- `<slug>-page.ts`: the container. It reads `featureStore`, calls `ExerciseProgress`, and passes
  plain values down.
- Presentational parts in the same folder (`<slug>-item-form.ts`, `<slug>-summary.ts`).
- `<slug>.logic.ts`: every calculation and rule (completeness, balance, deltas, overdue, counts)
  as pure functions taking plain data and a `now` argument where time matters.
- Forms: reactive or signal forms with `mat-form-field` + `mat-error`. Required-when-X rules live in
  logic functions that both the form and `isItemComplete()` use. **`<mat-error>` only renders once
  its field reports a Material `errorState`, which needs a real `NgControl`** (reactive or
  template-driven forms) — a plain signal-driven form (an `input()`/`(input)` pair, no
  `[formControl]`/`ngModel`) never gets one, so its own required-field message has to be a plain
  `<p role="alert">` next to the field instead (#51's `transition-item-form.html`).
  `exercise-layout.md`'s "Forms" paragraph covers `cdkTextareaAutosize`, touch targets,
  reveal-hints and initial focus — don't re-derive those here.
- **Reactive labels (translating an enum for a plain-data mapper):** when the page translates a
  fixed set of options (e.g. an enum) to hand pre-translated labels to a pure `<slug>.logic.ts`
  mapper (so that function stays testable without a translation service), do it with
  `translateSignal`, not `transloco.translate()` read inside a `computed()`. A `computed` that
  calls `translate()` without reading any signal runs exactly once and then never again — the
  exercise's scope loads over HTTP and only once something asks for it, so a cold load (reload, a
  deep link) can freeze the label at the raw key, and switching language afterwards never
  re-translates it either (#51's PR review). `translateSignal` instead subscribes to
  `TranslocoService.selectTranslate()`, which re-emits once the scope arrives and again on every
  language change:

  ```ts
  // One `translateSignal` call per enum, keys relative to the exercise's own scope, named
  // explicitly — see the pitfall below.
  private readonly sourceLabels = translateSignal(
    SCRIPT_SOURCES.map((source) => `source.${source}`),
    undefined,
    '<exerciseId>',
  );
  // `labelsFrom` (a pure function in `<slug>.logic.ts`) falls back to `''` per index — see the
  // second pitfall below.
  private readonly labels = computed(() => labelsFrom(SCRIPT_SOURCES, this.sourceLabels()));
  ```

  **Pitfall: always pass the scope explicitly, with keys relative to it.** A route that also
  provides `exercise-kit` (§2) registers two scopes, and `translateSignal`'s default scope
  resolution (unlike `TranslocoPipe`, which loads every registered scope and then translates the
  fully-aliased key) just picks the _last_-registered one — silently resolving your keys against
  `exercise-kit` instead. Pass the exercise's scope as the third argument and drop the camelCase
  alias prefix from the keys (`source.family`, not `paradigmsTransition.source.family`); the scope
  argument supplies it. Test this with a spec that switches `TranslocoService.setActiveLang()`
  after the page has rendered and asserts the rendered label changed (a scope preloaded
  synchronously, as `provideTranslocoTesting()` does, won't otherwise catch a frozen `computed`).

  **Pitfall: `translateSignal` with an array key starts at `['']`, not one empty string per
  key** (`node_modules/@jsverse/transloco/fesm2022/jsverse-transloco.mjs`'s `toSignal` call). So on
  a cold load, before the scope arrives, every index past 0 reads as `undefined` and a naive
  `this.sourceLabels()[index]` renders the literal text "undefined" in the list subtitle. Have the
  mapping function (`labelsFrom` above) fall back to `''` per index, and unit-test that
  before-load shape directly (`labelsFrom(SCRIPT_SOURCES, [''])`) rather than relying on a spec's
  synchronously preloaded scope to reproduce it (#51's PR follow-up).

- **List item selection state:** don't bind `aria-selected` on a `mat-list-item` button (axe's
  `aria-allowed-attr` disallows it outside `role="option"`/`"tab"`/etc.), and don't bind
  `aria-current` either — `MatListItem`'s own host binding owns that attribute and silently
  overwrites a template binding back to absent unless the host is an `<a>`. Use `aria-pressed`
  (#51's fix in `exercise-list.html`).
- Styling: logical CSS only (`margin-inline-start`, `inset-inline`). Mobile first at 360 px;
  touch targets ≥ 44 px. Sliders and ratings need a visible numeric value and an accessible label.
- Cross-feature data: never import another feature's folder. Shared entities (`shared.roles`,
  `shared.relationships`) are read through their own `core/` or `shared/` owner once it exists.
  Until then the integration is a follow-up issue, not a speculative hook.

## 7. Tests (what each exercise ships)

| File                       | Covers                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<slug>.model.spec.ts`     | registration exists; `defaults()` and a fully filled record pass `validate()`; a wrong shape fails; a document containing the slice passes `validateDocument()` (this is the export/import guarantee)                                                                                                                                                                                                                                         |
| `<slug>.logic.spec.ts`     | every pure function, edge cases included (empty, boundaries, tombstoned items)                                                                                                                                                                                                                                                                                                                                                                |
| `<slug>-page.spec.ts`      | creating, editing, deleting and completing through the page with a fixed `CLOCK`; a list exercise's selection is a route param (§5), so drive it through a real `Router` — `RouterTestingHarness`, mounting `<slug>.routes.ts` at its own `<EXERCISE_ID>_ROUTE` prefix (`[{ path: <EXERCISE_ID>_ROUTE, children: <slug>Routes }]`), not the harness root, or the nesting-depth bug `exercise-layout.md` describes goes uncaught — see `transition-page.spec.ts` |
| `e2e/<exerciseId>.spec.ts` | one happy path from the hub: open the exercise, fill it, reload, data still there, hub shows done. Plus an axe scan. The Playwright projects already run it at 360/1280 in `en`/`ar`; don't loop over them yourself                                                                                                                                                                                                                           |

- Seed data in e2e with `seedDocument()` from `e2e/fixtures.ts`, not by clicking through setup.
- When a hub gets its first exercise, `e2e/habits.spec.ts`'s empty-state test must point to a hub
  that still has none.
- The tester still spends its round on what CI can't check (RTL look, keyboard, screen reader,
  offline, one manual export → import). It doesn't re-run the suites.

## 8. Definition of done

Every new exercise ships all of this — the reference is `paradigms-perception` plus the kit files
below (#212/#235). Where an item isn't literally new code (the short title), it's a value or
convention to follow, not a component to add.

| Ships | Where (reference file) |
| --- | --- |
| **Short title:** the route title (`titles.<exerciseId>`) and hub title (`habits.exercises.<exerciseId>.title`) values are each ≤ 3 words, since chrome (top app bar, hub card) renders them as-is — no separate registry field yet (§1; a `shortTitleKey` field is deferred to #218) | `perception.model.ts`'s `registerExercise()`; `public/assets/i18n/en.json`'s `titles.paradigms-perception`; `features/habits/i18n/en.json`'s `exercises.paradigms-perception.title` |
| `doneChecklist(exercise, labels)` in `<slug>.logic.ts`, reducing the same per-item `met` map `isComplete()` reduces, so the gate button and the checklist it shows can never disagree — gate its rendering on `checklistLoaded(labels)`, the same load gate as the guide row below (`translateSignal` starts array keys at `['']`, so a naive read renders blank rows on a first, uncached visit) | `perception.logic.ts`'s `checklistMet()`, `doneChecklist()`, `checklistLoaded()`, `isComplete()` |
| `DoneToggle`'s `checklist` input (the only gate message since #215 removed `disabledHint`). The gated button is `disabledInteractive` + `aria-disabled`, so it stays focusable and screen readers announce the checklist. A list/assessment exercise's checklist describes its item closest to passing: `closestMet()` in `shared/exercise-kit/done-checklist.logic.ts` | `done-toggle.ts`'s `checklist` input; `perception-page.html`'s `<app-done-toggle [checklist]="checklist()">`; `transition.logic.ts`'s `doneChecklist()` for a list |
| A `guide` block in the exercise's own i18n scope — `inShort`, `howTo` (numbered steps), `examples` (§4's "Guide example" column: one card per step/item type/branch), `afterwards` — read with `translateObjectSignal` and gated on real content (`howTo.length`, since the signal starts at an empty object before the scope loads) | `features/paradigms-perception/i18n/en.json`'s `guide` key; `perception-page.ts`'s `guideContent`; `exercise-guide.ts`/`.html` |
| A `label`/`prompt`/`placeholder` triple per free-text field: `mat-label` = a short noun, a `<p class="field-prompt">` above the field = the question, `placeholder` = a worked example — never the only label | `perception-page.html`'s `step1.firstView.{label,prompt,placeholder}` and every other field |
| "Back" hidden on step 1, "Next" hidden on the last step — `GuidedStepper` already does this; nothing a page adds | `guided-stepper.html`/`.ts` |
| No zero counter anywhere on the page: a worksheet shows no step-count summary at all (the checklist is the only progress indicator); a list/assessment's own count card only renders once its total is non-zero | `perception-page.html`'s footer (no summary card, only `<app-done-toggle [checklist]>`); `exercise-layout.md`'s "Counts are plural-correct" |
| The intro card collapsed once started — and, on handset, collapsed on every visit regardless of `isStarted()`, since the mandated copy for a worksheet's intro can alone push the first field past an 800px viewport at 360px width | `perception-page.ts`'s `collapsedByDefault` (`started() OR handset()`); `exercise-prompt-card.ts`'s `collapsedByDefault` input |

### Writing the strings

The writing standard — English register, the Arabic فصحى/عامية split, the glossary — is
`CONTENT.md`'s "Writing standard" section (#227; that PR is the lead's, not a coder's, since
`CONTENT.md` is a root file). Its "Key-suffix boundary" subsection has the full precedence order
(#251); in short, by last key segment:

- **فصحى** (formal): a key ending `label`, `title`, `stepLabel`, `stepTitle`, `legend`, `button`,
  `kind.*`, `status.*`.
- **عامية مصرية** (colloquial): a key ending `prompt`, `placeholder`, `hint`, `intro`, `text`,
  `whyItMatters`, `checklist.*`, `guide.*`, `empty*`.

Don't guess at a key that matches more than one row — `CONTENT.md`'s rule 1 (last-segment suffix
wins) already settles it: `guide.examples[].title` and `guide.examples[].fields[].label` are both
فصحى, because `title`/`label` is the key's last segment even though it sits inside `guide.*`.

Both keep `CONTENT.md`'s content rule (original paraphrase, never book text beyond a short term).

### The BA's counterpart

An exercise issue is not `Ready` until its guide text and field placeholders are written in the
issue body (the "Content" section shape #212 used), not left for the coder to invent. The
business-analyst agent definition needs its own issue body template updated to require this — a
lead PR against `.claude/agents/custom/business-analyst.md`, not part of this playbook.

## 9. PR

`feat: <exercise> (#<issue>)`. Keep the "Design (SOLID)" section short: list only what deviates
from this playbook, and why. Include 360 px screenshots in `en` and `ar`.

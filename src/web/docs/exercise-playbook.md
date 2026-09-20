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

| Type                                                  | Stored value                                                  | Kit components                                                                                                                          | Done toggle enabled when                                  |
| ----------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Worksheet**: fixed steps filled once                | one record, `defaults: () => null`, created on the first edit | `ExercisePage` (body only, no `[editor]`) + `GuidedStepper`/`GuidedStepContent`, `ExercisePromptCard`, `ReflectionEditor`, `DoneToggle` | `isComplete(record)` is true (pure, in `<slug>.logic.ts`) |
| **List**: items the user adds/edits/deletes           | `T[]` of records, `defaults: () => []`                        | `ExercisePage` (focus mode) + `ExerciseList`, `ExercisePromptCard`, `DoneToggle` — not `ExerciseDetail`, superseded by §5               | at least one live item passes `isItemComplete(item)`      |
| **Assessment**: repeatable, dated, compared over time | `T[]` of dated records (`date`), `defaults: () => []`         | `ExercisePage` (focus mode for a new/edited assessment) + `GuidedStepper` or a form, a result view, `DoneToggle`                        | at least one saved assessment exists                      |

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

The pattern issue #184 introduced and #187 (the reference implementation) proved out. Read this
before laying out a new exercise page — it settles the layout decisions so building another one
needs none of its own.

**The scaffold.** Every exercise page's template is `app-exercise-page`, never a bare `<h1>` plus
ad hoc markup:

```html
<app-exercise-page
  [title]="'<exerciseId>.prompt.title' | transloco"
  [editing]="hasDetail()"
  [editorTitle]="(isNewItem() ? '<exerciseId>.editor.newTitle' : '<exerciseId>.editor.editTitle') | transloco"
  [editorStatus]="editorStatus()"
  (editorClosed)="closeDetail()"
>
  <app-exercise-prompt-card intro [prompt]="..." [chapterReference]="..." [whyItMatters]="..." />

  <!-- body: the list (or the stepper, for a worksheet) -->

  <div editor><!-- the item form, only while editing --></div>

  <div footer><!-- summary + app-done-toggle --></div>
</app-exercise-page>
```

- **One title, no exceptions.** The page renders no `<h1 class="page-heading">` of its own — the
  scaffold's own visually hidden `h1` (from `title()`) is the only one, and the toolbar shows it.
  `ExercisePromptCard` takes no `title` input any more; don't add one back.
- **The intro card** goes in the `[intro]` slot, without binding `expanded`: it defaults to
  expanded on entry and the scaffold collapses it itself on entering focus mode (`editing()`
  turning `true`) — the page doesn't manage this. The user's own toggle still works at any time.
- **Focus mode** is `editing()`, computed from the same thing that decides whether the editor
  slot has content (`hasDetail()` for a list; a worksheet has no focus mode at all — see below).
  Below `HANDSET_QUERY` it's a full-screen panel over everything, including the bottom
  navigation; at or above it, the intro collapses, the body shrinks to a compact column and the
  editor takes the rest of the width. The editor column scrolls on its own there (`overflow-y:
  auto` on `.editor-panel`, `min-block-size: 0` so it doesn't grow the grid row past the viewport)
  so the footer never overlaps it — issue #213 found the earlier "no scroll of its own" version
  let a tall editor grow the row past the viewport, putting the sticky footer over the last field.
  Both breakpoints share the same editor header (back/close button, `editorTitle()`, an
  `aria-live` "Saved"/"Saving…" status) — the kit builds it; the page only supplies the three
  inputs above.
- **`editorStatus()`:** `'saved'` once `hasDetail()` — this page's `store.update()` calls are
  synchronous, so every applied edit (including creating the item) is "saved" the instant it
  lands; `null` otherwise. Only compute `'saving'` if a feature's own persistence genuinely has a
  pending-write state to report (none does yet).
- **The footer slot** holds the summary and `app-done-toggle`, always. On handset it's not
  rendered at all while `editing()` (`showFooter`, the kit's own computed) — never conditionally
  hide it yourself. On desktop it's a bar at the bottom edge of the page area, and that needs one
  line of SCSS from the page itself:

  ```scss
  // <slug>-page.scss
  :host {
    display: flex;
    flex-direction: column;
    min-block-size: 100%;
  }
  ```

  The kit fills that host (`flex: 1 1 auto`) and takes up a short page's free space with
  `margin-block-start: auto` on the footer; `position: sticky` only pins it once the page is long
  enough to scroll. A percentage `min-block-size` cannot carry the height down the chain on its
  own — it resolves against the parent's `height` _property_, which is `auto` for a host that is
  merely stretched, so it silently computes to `auto` and every level below collapses to content
  height (issue #193: the footer floated under the last row on any short page). The shell's
  `.page` is a flex item with a definite used height, which is why `min-block-size: 100%` still
  works on the page's _own_ host.
- **Worksheet pages** use the same scaffold for the intro/body/footer slots but never bind
  `editing` (it stays `false`) and never project anything into `[editor]` — the stepper body _is_
  the editing surface, with no separate focus mode. Nothing else in this section applies to them.

**The list (`ExerciseList`).** Labels are the exercise's own scope, never generic "exercises"
wording:

```html
<app-exercise-list
  [items]="items()"
  [selectedId]="itemId()"
  [searchLabel]="'<exerciseId>.list.searchLabel' | transloco"
  [emptyMessage]="'<exerciseId>.list.empty' | transloco"
  [noMatchMessage]="'<exerciseId>.list.noMatch' | transloco"
  (itemSelected)="select($event)"
/>
```

Keys: `list.searchLabel`, `list.empty` (shown with zero items), `list.noMatch` (shown once a
search matches nothing — falls back to `list.empty` if omitted). Search and sort only render once
the list has `LIST_TOOLS_MIN_ITEMS` (6) items (`exercise-list.logic.ts`) — a short list starts
straight with rows, no empty toolbar above them.

The "add" button sits above the list, is ≥ 44 px tall, and goes full width below 600 px with
`inline-size: 100%` — **not** `align-self: stretch`: everything projected into the body lands in
the scaffold's `.content-slot`, a plain block, where every `align-self` is inert (issue #195 —
the button shipped as a 142 px pill inside a 328 px column).

**Selection is a route param, not a page signal — on _one_ route, not a sibling pair.** The
editor is an optional trailing URL segment, matched by `optionalParamMatcher`
(`core/routing/optional-param-matcher.ts`) so that `<base>` and `<base>/<itemId>` are the same
route config:

```ts
export default [
  {
    matcher: optionalParamMatcher('itemId'),
    title: 'titles.<exerciseId>',
    providers: [provideTranslocoScope('<exerciseId>'), provideTranslocoScope('exercise-kit')],
    component: <Slug>Page,
  },
] satisfies Routes;
```

**Never two siblings (`''` and `':itemId'`) pointing at the same page**, however natural that
looks: Angular's default `RouteReuseStrategy` reuses a component only while
`future.routeConfig === curr.routeConfig`, so a sibling pair destroys and rebuilds the whole page
on every open _and_ every close. That takes the kit's focus-restore-on-close with it (the new
instance never saw the editor open), resets `ExerciseList`'s search and sort, re-expands the intro
card the kit had just collapsed, and leaves any async work started by the closing action (a
delete's Undo snackbar) running on a component about to be destroyed. One route with the matcher
makes open/close the same kind of navigation as `/user/1` → `/user/2`: same config, same instance,
a new param value (issue #187, which had to undo the sibling version).

`itemId = input<string | null>(null)` binds to `:itemId` through `withComponentInputBinding()`
(`app.config.ts`) — the same mechanism `HabitHubPage.habit` already uses for `:habit`. Two things
every page gets wrong the first time:

- **`unmatchedInputBehavior` defaults to `'alwaysUndefined'`:** with no trailing segment there is
  no `:itemId` param at all, so the router calls `setInput('itemId', undefined)`, not "leave the
  `null` default alone". Guard with `id != null`, not `id !== null`, anywhere you check for "no
  selection" — an `!== null` check silently treats `undefined` as a real id and can misfire (a
  page that redirects on an unrecognised id would otherwise redirect on _every_ plain list visit).
- **Navigate absolutely, never `relativeTo: this.route`.** A page's own route is lazily mounted
  under the `ROUTE_REGISTRY` entry for it, and relative navigation's `'../'` counts route _config_
  nesting: it either throws resolving through a route with no segment of its own to walk back up
  from (`NG04005`) or silently builds a URL tree that matches nothing and falls through to the
  app's wildcard-redirects-home route — and a unit test that mounts the routes shallower than the
  real registry won't catch it
  (only `RouterTestingHarness` wrapped in the _same_ nesting `transition-page.spec.ts` uses will).
  Export the exercise's own mounted path as a constant (`<slug>.model.ts`'s
  `<EXERCISE_ID>_ROUTE`, reused by `registerExercise({ route: ... })` so the two can't drift) and
  navigate with `router.navigate([\`/${<EXERCISE_ID>_ROUTE}\`, ...])` for every "select"/"add"/
  "close" action.
- **An id that isn't a live item — a typo'd deep link, or one just tombstoned by a delete —
  redirects to the list**, in one `effect()` keyed on `itemId()`, guarded by the `!= null` check
  above.
- The back gesture, reload and deep links then come for free: they're just the browser's own
  history and URL handling over a real route, nothing the page has to implement.

**Who moves focus, and when.** The kit owns the editor's opening and closing focus; the feature
owns only what happens while the editor stays open. Mark the editor's first field with
`appEditorInitialFocus` and stop there — the marker registers itself with `ExercisePage` through
`EDITOR_FOCUS_HOST`, so it works from inside a nested presentational form's template just as well
as from the page's own (issue #187; it used to be a `contentChild` query, which could not see into
a nested component's view and quietly did nothing there). `ExercisePage` focuses that field when
the editor opens, restores focus to whatever opened it when the editor closes, and traps focus
inside the full-screen panel on handset. A feature that also focuses the same field on open is a
second writer for one moment, ordered only by the accident of `queueMicrotask` running after
`afterNextRender`.

Two transitions the kit cannot see, which the editor form does own:

- **Switching to a different item while the editor stays open** (the compact desktop list stays
  clickable in focus mode, reusing the same form instance). React to the record's id _changing_,
  not to its first value, in the same place that resets per-item UI state (touched fields, etc.).
  Defer the `.focus()` call with `queueMicrotask` rather than calling it inline: focusing a real
  `matInput` re-enters change detection (Material's `FocusMonitor` reacts to the native `focus`
  event), which can abort the rest of _that_ tick's render — including a signal write earlier in
  the very same effect (`transition-item-form.spec.ts`'s "does not carry a touched error" test is
  the regression guard).
- **A field revealed by a choice** (Rewrite/Stop revealing the new-script field). Use
  `afterNextRender`, since that field genuinely isn't in the DOM yet when the effect runs, and
  fire only on the `false` → `true` transition: opening an item that is _already_ in the revealed
  state is the kit's open-focus moment, not a reveal.

Both are "react to a change of value, not to a value" — `script()` is a new object on every
keystroke, so a plain `effect` would re-focus constantly. `transition-item-form.ts`'s local
`onChange(source, react)` helper is the shape to copy.

**Delete, with Undo.** See "Deleting entries" below — the shared pattern every list/assessment
exercise wires the same way.

**Counts are plural-correct.** Every rendered count (a summary card, a "N scripts named" caption)
goes through `appPlural` (`core/i18n/plural.pipe.ts`), not a plain `TranslocoPipe` interpolation:

```html
{{ '<exerciseId>.summary.total' | appPlural: summary().total }}</exerciseId>
```

The key's JSON becomes an object of `Intl.PluralRules` categories (`one`/`other` covers `en`
fully; `ar` needs `zero`/`one`/`two`/`few`/`many`/`other` to be fully correct) with `other` as the
required fallback — `appPlural` picks `<key>.<category>` for the active language's category and
count, falling back to `<key>.other` when a specific category isn't defined for that key.

A component whose *only* Transloco binding is `appPlural` (a counts card, typically) must still
re-render on a language switch, and it is the pipe that marks it for check — it listens to
`langChanges$` as well as the cold-load event, because a language the user has already visited is
cached and fires no load event at all. If you write another pipe or helper that renders
translations outside `TranslocoPipe`/`translateSignal`, it needs both too: an `OnPush` component
whose inputs didn't change is otherwise skipped, and its text stays in the previous language
(issue #187; `transition-summary.spec.ts`'s en → ar → en test is the guard).

**`DoneToggle`'s `disabledHint`.** Pass one whenever `disabled()` can be true, so the user learns
_why_ "Mark done" is unavailable instead of finding a silently inert button:

```html
<app-done-toggle ... [disabledHint]="'<exerciseId>.summary.doneHint' | transloco" />
```

**Forms.** `cdkTextareaAutosize` (`@angular/cdk/text-field`) on every free-text `<textarea>`, with
`cdkAutosizeMinRows="3" cdkAutosizeMaxRows="10"` — a fixed two-row box makes writing feel cramped;
growing with the text doesn't. Every interactive control (toggle groups included) needs a ≥ 44 px
touch target; a `mat-button-toggle-group`'s default height is 40 px, fixed the same way
`ExerciseList` fixes its own sort toggle: `--mat-button-toggle-height: 44px;` scoped to the
group's own container, not set globally. **That exact token** — Material 2's
`--mat-standard-button-toggle-height` doesn't exist in the installed Material and setting it is
silently inert, which is how both this form and the kit's list shipped at 40 px (issue #194).
Measure a touch-target fix in the running app; a custom property that no longer exists fails
quietly. A toggle group whose choice reveals more fields
(Rewrite/Stop revealing the new-script sentence, say) gets a one-line hint under the group stating
what each choice does, and moves focus into the first revealed field the same way the delete
button above is deferred — an `afterNextRender` triggered by an `effect()` tracking the
"revealed" transition (`false` → `true`), not every re-render while already revealed.

**Deleting entries** (issue #203). Every list/assessment exercise deletes an item the same way —
a shared pattern in `shared/exercise-kit/`, not something each feature re-implements:

- **Bin icon + swipe, on the shared list components.** `ExerciseList` and `AssessmentHistoryList`
  both take an opt-in `deletable` input (off by default) and emit `deleteRequested(id)`. Each row
  is a wrapper `<div>` — never the row's own `<button mat-list-item>`, which can't nest a second
  `<button>` inside it — holding the existing row button and a trailing, always-visible bin
  `<button>` as siblings:

  ```html
  <div class="exercise-list__row" appSwipeToDelete [appSwipeToDeleteDisabled]="!isRowDeletable(item)"
       (swiped)="requestDelete(item)">
    <button mat-list-item ...>...</button>
    @if (isRowDeletable(item)) {
      <button type="button" class="exercise-list__delete"
              [attr.aria-label]="'exerciseKit.list.deleteAria' | transloco: { item: item.title }"
              (click)="requestDelete(item)">
        <mat-icon aria-hidden="true">delete</mat-icon>
      </button>
    }
  </div>
  ```

  A row can opt itself out even when the list is deletable: `ExerciseListItem.deletable` (default
  `true`) is for a list whose rows aren't one-to-one with what a delete removes —
  `paradigms-teach`'s ten chapter rows are fixed, so a chapter with no entry yet has nothing to
  delete (`toListItem()` sets `deletable: false` for it) and gets neither a bin button nor a swipe.

- **`SwipeToDeleteDirective`** (`shared/exercise-kit/swipe-to-delete.directive.ts`), applied to the
  row wrapper: Pointer Events with `touch-action: pan-y` on the host, touch only (a mouse/pen drag
  leaves desktop gestures alone — that's what the bin button is for). It only ever tracks a gesture
  once `|dx| > |dy|` (`isHorizontalGesture`, `swipe-to-delete.logic.ts`), so the browser's own
  vertical scroll keeps working and a vertical drag is never mistaken for a swipe attempt. A swipe
  commits (`isSwipeToDelete`) once it's travelled past `swipeThreshold()` (30% of the row's own
  width, floor 80px) *toward the row's own start edge* — left in LTR, right in Arabic RTL, read
  from `getComputedStyle(row).direction`, never a hardcoded sign. A committed swipe snaps the row
  back (skipped under `prefers-reduced-motion`) and emits `swiped`; it also suppresses the `click`
  the pointer-up produces on the row's own button, through a **capture-phase** listener registered
  on the wrapper — a bubble-phase `(click)` binding would run *after* the button's own click
  handler has already fired, too late to stop it. Disable it per row with
  `appSwipeToDeleteDisabled` (bound to `!isRowDeletable(item)`), not by omitting the attribute.

- **`DeleteWithUndo`** (`shared/exercise-kit/delete-with-undo.ts`), injected by the page: the one
  confirm → delete → undo flow every exercise's bin button and swipe share, so a page never
  re-implements the dialog or the snackbar wiring itself.

  ```ts
  protected onItemDeleted(id: string): void {
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('<exerciseId>.list.deleted'),
      undoLabel: this.transloco.translate('<exerciseId>.list.undo'),
      onConfirm: () => this.store.update((items) => removeItem(items, id, this.clock.now())),
      onUndo: () => this.store.update((items) => restoreItem(items, id, this.clock.now())),
    });
  }
  ```

  `confirmAndDelete()` opens the one shared `DeleteConfirmDialog` (lazy-loaded the same way
  `ImportConfirmDialog` is, through a `DELETE_CONFIRM_DIALOG_LOADER` injection token seam) —
  destructive styling on Delete, Cancel focused by default, Escape/backdrop both cancel (Angular
  Material's own default, no extra wiring). The dialog carries no per-feature data and reads its
  copy from the **root** i18n scope (`deleteConfirm.*`), the same root-not-feature-scope choice
  `ImportConfirmDialog` makes, since `AppDialog.open()` opens it from the root environment
  injector — the trigger's own aria-label already named the item, so the dialog's own copy stays
  generic. Only on an explicit confirm does it call `onConfirm()` and open the "Deleted — Undo"
  snackbar through `AppSnackbar`, wiring Undo to `onUndo()`.

  `removeItem()`/`restoreItem()` (pure functions alongside the feature's other mutators in
  `<slug>.logic.ts`) are `softDelete()`/clear-the-tombstone-and-`touch()`, exactly
  `removeScript()`/`restoreScript()`'s shape from before this issue — never a hard delete
  (architecture issue #1 §6). The editor closes on delete for free for a normal list/assessment
  exercise: the deleted id is no longer live, so the same "id isn't live, redirect to the list"
  effect (§5, above) handles it, no separate close call needed. A feature whose selection isn't
  keyed by the deleted record's own id — `paradigms-teach`'s chapter rows stay valid `:itemId`s
  whether or not they have an entry — has to close the editor itself in `onConfirm` when the
  deleted entry was the one open, since that redirect effect has nothing to catch there.

- **Tests.** Unit-test `removeItem()`/`restoreItem()` in `<slug>.logic.spec.ts` like any other
  mutator. In a page spec, provide a fake `DeleteWithUndo` (`{ provide: DeleteWithUndo, useValue:
  fakeDeleteWithUndo() }`) that just records each call's options rather than the real one, which
  loads `@angular/material/dialog` through a dynamic `import()` — the same `NG0205`-after-teardown
  risk documented for `AppSnackbar` above. Drive confirm/Undo in the test by calling the captured
  `onConfirm()`/`onUndo()` directly; the dialog and the snackbar wiring are `DeleteWithUndo`'s own
  spec's job, not every page's. `SwipeToDeleteDirective`'s own spec sets every input it reads
  (`appSwipeToDeleteDisabled`, the host's `direction`) *before* the fixture's one `detectChanges()`
  call, not by mutating a plain field and calling `detectChanges()` a second time — this project's
  zoneless change detection only re-checks a template binding on an explicit
  `detectChanges()`/scheduler tick that follows a real change, and a second `detectChanges()` after
  mutating a plain (non-signal) host field doesn't reliably trigger one.

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
  `<p role="alert">` next to the field instead (#51's `transition-item-form.html`). §5's own
  "Forms" paragraph covers `cdkTextareaAutosize`, touch targets, reveal-hints and initial focus —
  don't re-derive those here.
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
| `<slug>-page.spec.ts`      | creating, editing, deleting and completing through the page with a fixed `CLOCK`; a list exercise's selection is a route param (§5), so drive it through a real `Router` — `RouterTestingHarness`, mounting `<slug>.routes.ts` at its own `<EXERCISE_ID>_ROUTE` prefix (`[{ path: <EXERCISE_ID>_ROUTE, children: <slug>Routes }]`), not the harness root, or the nesting-depth bug §5 describes goes uncaught — see `transition-page.spec.ts` |
| `e2e/<exerciseId>.spec.ts` | one happy path from the hub: open the exercise, fill it, reload, data still there, hub shows done. Plus an axe scan. The Playwright projects already run it at 360/1280 in `en`/`ar`; don't loop over them yourself                                                                                                                                                                                                                           |

- Seed data in e2e with `seedDocument()` from `e2e/fixtures.ts`, not by clicking through setup.
- When a hub gets its first exercise, `e2e/habits.spec.ts`'s empty-state test must point to a hub
  that still has none.
- The tester still spends its round on what CI can't check (RTL look, keyboard, screen reader,
  offline, one manual export → import). It doesn't re-run the suites.

## 8. PR

`feat: <exercise> (#<issue>)`. Keep the "Design (SOLID)" section short: list only what deviates
from this playbook, and why. Include 360 px screenshots in `en` and `ar`.

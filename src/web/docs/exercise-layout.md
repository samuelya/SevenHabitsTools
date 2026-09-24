# Exercise page layout

The detail behind `exercise-playbook.md` §5 "Page layout": the scaffold, the list, selection
routing, focus management, counts, forms and the delete pattern. Split out of the playbook
(#214) because the playbook alone was already over the 500-line limit; read the playbook first —
it settles what an exercise ships and links here only for this section's own mechanics.

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
- **The intro card** goes in the `[intro]` slot. It defaults to expanded on entry (owner decision,
  #184) but **starts collapsed on handset regardless** (`exercise-playbook.md`'s "Definition of
  done", #212's shipped resolution): the mandated copy for a worksheet's intro alone can run past
  an 800px viewport at 360px width, so "expanded when not started" and "first input visible
  without scrolling at 360×800" can't both hold there. Pass `[collapsedByDefault]` as the page's
  own `isStarted()` OR'd with the handset breakpoint (`HANDSET_QUERY`); desktop/tablet keeps the
  literal "expanded until the first edit" rule. The scaffold also collapses the card itself on
  entering focus mode (`editing()` turning `true`) for a list/assessment page — the page doesn't
  manage that transition. The user's own toggle still works at any time, on any breakpoint.
- **Focus mode** is `editing()`, computed from the same thing that decides whether the editor
  slot has content (`hasDetail()` for a list; a worksheet has no focus mode at all — see below).
  Below `HANDSET_QUERY` it's a full-screen panel over everything, including the bottom
  navigation; at or above it, the intro collapses, the body shrinks to a compact column and the
  editor takes the rest of the width. Neither column can grow the split grid past the viewport and
  reopen issue #213 (a tall editor doing that put the sticky footer over the last field; a tall
  body/history column does it too, review round 1) — but that grid needs a *definite* height for
  either column's own overflow rule to mean anything: a `1fr`/`auto` track only distributes real
  free space once its container has one, and every page's own `:host` sets only a *floor*
  (`min-block-size: 100%`, on purpose, so a short page's footer still reaches `.page`'s bottom,
  issue #193). That height comes from `.page`, the shell's one scroll container, in CSS only:
  while the split grid is up, `ExercisePage` marks its own host `.fills-page`, and `shell.scss`'s
  `.page > *:has(> .fills-page)` rule gives the routed page host `block-size: 100%` of `.page`'s
  content box; `min-block-size: 0` on the host and on the grid then lets the chain shrink to it.
  **So the page's own host must be a flex column filling `.page` (the footer-slot SCSS below) and
  `<app-exercise-page>` must be that host's own child.** Miss that contract and the rule stops
  matching, which is *not* one single fallback (both measured at 1280x800, empty history, a
  3149px-tall form, review round 3):
  - **No `:has()` support**, scaffold still the routed host's own child: the host keeps its own
    `min-block-size: 100%` floor and the scaffold is still stretched to it, so the grid keeps a
    definite height while the content fits (a 597px editor column). Only the *ceiling* is gone, so
    a column taller than `.page` grows the host and the page scrolls — the pre-#213 layout.
  - **The scaffold nested deeper** (a `<div>`/`<section>` around it, as `/dev/kit` deliberately
    has): the wrapper has no floor of its own, the grid is content-sized, and since the editor
    panel is absolutely positioned and contributes nothing, row 1 is sized by the *body* column
    alone — the editor gets clipped to the history list's height (a 190px panel around that
    3149px form). Only the row floor below keeps that usable, so don't rely on this shape.

  Don't reintroduce a measured height: round 2 of #213 measured the *layout viewport* with
  `ViewportRuler` and was wrong by `.page`'s 16px padding on every open, wrong again by its scroll
  offset when an item was opened after scrolling the list, and never recomputed at all for the
  offline indicator, the read-only banner or the PWA install banner, which appear and disappear
  above the toolbar at runtime. A percentage of `.page` handles all four as plain relayout. With
  the grid genuinely bounded, `.editor-panel` is `position: absolute; inset: 0` inside the grid's
  own `position: relative` (both grid lines spelled out), so it makes no content contribution to
  row 1's sizing and scrolls internally (`overflow-y: auto`) instead of growing it; `.body` is
  stretched to fill row 1 (`align-items: stretch`) with `min-block-size: 0` (lifting the grid
  item's default content-based minimum) plus `overflow-y: auto`/`overflow-x: clip`, so it scrolls
  in place instead of overflowing the now-real row. Either way the footer never overlaps the
  column — and in split mode the footer is `position: static`, not the flow layout's sticky: its
  row already sits at the bottom of a bounded scaffold, and where the scaffold *isn't* bounded
  sticky lifted the bar back over the live editor, which is #213's original symptom.
  **Row 1 has a floor** (`--split-row-floor: 16rem`, `grid-template-rows: minmax(…, 1fr) auto`,
  plus `min-block-size: calc(floor + 1rem)` on the scaffold). Bounding the grid to `.page` makes a
  *short* page area the mirror-image failure: the footer row plus the gap eat the whole grid, row 1
  and the `inset: 0` panel collapse to 0 (measured at 900x220 and 844x210) and the bounded grid
  leaves no page scroll to escape with — reachable on a landscape phone above `HANDSET_QUERY` once
  the keyboard shrinks the viewport. Below the floor the scaffold overflows `.page` and the page
  scrolls again. The floor is measured (`.editor-header` 57px + `.editor-body` padding 2x16px +
  two 76px Material fields = 241px, rounded up); keep it a fixed length — `min-content` pulls the
  history column's own max-content contribution back through the `1fr` track and overshoots
  `.page` by that much on every ordinary open. Both breakpoints
  share the same editor header (back/close button, `editorTitle()`, an `aria-live`
  "Saved"/"Saving…" status) — the kit builds it; the page only supplies the three
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

**The prompt card (`ExercisePromptCard`).** Visible part, always shown: the one-paragraph prompt
and, once the exercise offers one, a "Read more" button (issue #212) opening `ExerciseGuide` (see
below). Expandable part, behind the existing "About this exercise" toggle: "Why this matters" and
a `From: <chapter>` labelled line, in that order — the chapter reference is last, not first. The
card takes already-translated strings from the exercise's own scope, never keys: its own
`exercise-kit` scope only owns the generic chrome ("About this exercise", "Read more", "Why this
matters", "From: {{chapter}}").

**The "Read more" guide (`ExerciseGuide`).** A `MatDialog` (via `AppDialog`, lazy-loaded) opened
with `viewContainerRef` set to the "Read more" button's own view container, so it inherits the
route's own scope providers instead of the root injector. Full-screen (`width/height: 100%`,
`maxWidth: 100vw`) below `HANDSET_QUERY`, centred and capped at 560px wide above it; CDK's own
`restoreFocus` (on by default) returns focus to "Read more" on close with no extra code, and the
overlay pane's own stacking context sits above the shell with no `position: fixed`/`z-index` of
this component's own. It renders four sections with the same headings on every exercise, from the
`guide` key of the exercise's own i18n scope: In short, How to do it (numbered), An example (one
read-only card per step for a worksheet, one per item type for a list, one filled assessment for
an assessment type — playbook §4), Afterwards. The example values and the field placeholders
agree (same scenario, same wording) — write them together.

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
count, falling back to `<key>.other` when a specific category isn't defined for that key. A
worksheet exercise (playbook §4) shows no such count card at all — the checklist and the gate
button are the only progress indicator (playbook's "Definition of done", #212's "no zero counter
is shown anywhere on the page"); only a list/assessment page renders one, and only once its total
is non-zero.

A component whose *only* Transloco binding is `appPlural` (a counts card, typically) must still
re-render on a language switch, and it is the pipe that marks it for check — it listens to
`langChanges$` as well as the cold-load event, because a language the user has already visited is
cached and fires no load event at all. If you write another pipe or helper that renders
translations outside `TranslocoPipe`/`translateSignal`, it needs both too: an `OnPush` component
whose inputs didn't change is otherwise skipped, and its text stays in the previous language
(issue #187; `transition-summary.spec.ts`'s en → ar → en test is the guard).

**`DoneToggle`'s `disabledHint`.** For an exercise built before #212, pass one whenever
`disabled()` can be true, so the user learns _why_ "Mark done" is unavailable instead of finding a
silently inert button:

```html
<app-done-toggle ... [disabledHint]="'<exerciseId>.summary.doneHint' | transloco" />
```

A **new** exercise passes `checklist` instead (playbook's "Definition of done") — the richer
alternative that lists which required items are still unmet, not just that some are; don't pass
both.

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
  exercise: the deleted id is no longer live, so the redirect-to-the-list effect described above
  (under "Selection is a route param") handles it, no separate close call needed. A feature whose
  selection isn't keyed by the deleted record's own id — `paradigms-teach`'s chapter rows stay
  valid `:itemId`s whether or not they have an entry — has to close the editor itself in
  `onConfirm` when the deleted entry was the one open, since that redirect effect has nothing to
  catch there.

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

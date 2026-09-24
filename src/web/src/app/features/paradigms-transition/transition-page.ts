import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { translateSignal, TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
import { CLOCK } from '../../core/time/clock';
import { DeleteWithUndo } from '../../shared/exercise-kit/delete-with-undo';
import { DoneToggle } from '../../shared/exercise-kit/done-toggle/done-toggle';
import { ExerciseList } from '../../shared/exercise-kit/exercise-list/exercise-list';
import { ExercisePage } from '../../shared/exercise-kit/exercise-page/exercise-page';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { TransitionItemForm } from './transition-item-form';
import { TransitionSummary } from './transition-summary';
import {
  addScript,
  CHECKLIST_KEYS,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  editScript,
  isComplete,
  labelsFrom,
  liveScripts,
  removeScript,
  restoreScript,
  summarize,
  toListItem,
} from './transition.logic';
import {
  SCRIPT_EFFECTS,
  SCRIPT_SOURCES,
  Script,
  ScriptFields,
  TRANSITION_MODEL_KEY,
  TRANSITION_ROUTE,
} from './transition.model';

/** Every new script starts here; the user edits it straight away in the opened detail form. */
const DEFAULT_FIELDS: ScriptFields = {
  text: '',
  source: 'family',
  effect: 'mixed',
  decision: 'keep',
};

/** Transition-person reflection (issue #51): the reference "list" exercise every later exercise
 * copies (`src/web/docs/exercise-playbook.md`). The container: it reads `featureStore`, calls
 * `ExerciseProgress`, and passes plain values down to `ExerciseList`/`TransitionItemForm`/
 * `TransitionSummary` — none of which inject the store or a service.
 *
 * **Routing (issue #187, owner decision on #184: option (b)):** the selected script is the
 * optional trailing URL segment `:itemId` (`transition.routes.ts`), bound to `itemId` through
 * `withComponentInputBinding()` — not a page-local signal. That's what makes the mobile editor a
 * real navigation: the phone's back gesture closes it, a reload with `:itemId` in the URL reopens
 * it, and every "select"/"add"/"close" action below is a `Router.navigate()`, not a local
 * `.set()`. It is one route with an `optionalParamMatcher`, *not* a `''`/`':itemId'` sibling
 * pair, so opening and closing the editor is a param change on a route the router keeps rather
 * than a swap between two configs that destroys and rebuilds this page (and with it the kit's
 * focus-restore state, the list's search text and the intro card's collapsed state) each time.
 * Navigation is always the *absolute* `TRANSITION_ROUTE` (`goTo()`), never relative to
 * `this.route` — see `goTo()`'s own doc comment for why relative navigation doesn't work here.
 */
@Component({
  selector: 'app-transition-page',
  imports: [
    DoneToggle,
    ExerciseList,
    ExercisePage,
    ExercisePromptCard,
    MatButtonModule,
    MatIconModule,
    TransitionItemForm,
    TransitionSummary,
    TranslocoPipe,
  ],
  templateUrl: './transition-page.html',
  styleUrl: './transition-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransitionPage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly deleteWithUndo = inject(DeleteWithUndo);
  private readonly store = featureStore<Script[]>(TRANSITION_MODEL_KEY);
  protected readonly progress = inject(ExerciseProgress);

  /** The `:itemId` route param, bound through `withComponentInputBinding` — absent while the URL
   * has no trailing segment, i.e. while the list, not a script, is showing. */
  readonly itemId = input<string | null>(null);

  // `translateSignal` (not `transloco.translate()` read inside a `computed`): the scope loads
  // over HTTP and only once something asks for it, and a `computed` that calls `translate()`
  // without reading a signal evaluates exactly once, so a cold load can freeze it on the raw key
  // and a later language switch never re-runs it. `translateSignal` instead subscribes to
  // Transloco's own `selectTranslate()` stream, so it emits again once the scope arrives and
  // again on every language change (review finding on #51's PR — see the playbook's "Reactive
  // labels" section for the pattern every exercise should copy).
  // The scope is named explicitly, with keys relative to it, rather than left to ambient
  // `TRANSLOCO_SCOPE` resolution: this route also provides `exercise-kit` (playbook §2), and
  // `translateSignal` (unlike `TranslocoPipe`, which loads every registered scope and then
  // translates the fully-aliased key) picks the *last*-registered scope when none is given, which
  // resolved these keys against the wrong one.
  private readonly sourceLabels = translateSignal(
    SCRIPT_SOURCES.map((source) => `source.${source}`),
    undefined,
    'paradigms-transition',
  );
  private readonly effectLabels = translateSignal(
    SCRIPT_EFFECTS.map((effect) => `effect.${effect}`),
    undefined,
    'paradigms-transition',
  );
  // `labelsFrom` falls back to `''` for a missing index — `translateSignal` with an array key
  // starts at `['']` (fesm2022/jsverse-transloco.mjs), not one empty string per key, so every
  // index past 0 is `undefined` until the scope loads.
  private readonly labels = computed(() =>
    labelsFrom(SCRIPT_SOURCES, this.sourceLabels(), SCRIPT_EFFECTS, this.effectLabels()),
  );

  protected readonly scripts = computed(() => liveScripts(this.store.value()));
  protected readonly items = computed(() =>
    this.scripts().map((script) => toListItem(script, this.labels())),
  );
  protected readonly selectedScript = computed(
    () => this.scripts().find((script) => script.id === this.itemId()) ?? null,
  );
  protected readonly hasDetail = computed(() => this.selectedScript() !== null);
  /** Drives the editor header's title (issue #187's acceptance criteria): a script created but
   * never typed into yet is still "new", even though it already exists in the document. */
  protected readonly isNewScript = computed(() => !this.selectedScript()?.text.trim());
  /** This page's `store.update()` is always synchronous (in-memory; the debounced write to disk
   * is a separate, lower layer — `DocumentPersistence`), so there's no "saving" state to show:
   * every applied change is "saved" the instant it lands (playbook's "Page layout" section). */
  protected readonly editorStatus = computed<'saved' | 'saving' | null>(() =>
    this.hasDetail() ? 'saved' : null,
  );
  /** `null` until the first script exists (issue #215): no "0 scripts named" card next to the
   * list's own empty-state text. */
  protected readonly summary = computed(() =>
    this.scripts().length > 0 ? summarize(this.store.value()) : null,
  );
  protected readonly readyToMarkDone = computed(() => isComplete(this.store.value()));

  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    'paradigms-transition',
  );
  /** `null` until the scope has loaded, so `DoneToggle` never renders blank rows on a cold visit
   * (`perception-page.ts`'s same gate). */
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistLabels());
    return checklistLoaded(labels) ? doneChecklist(this.store.value(), labels) : null;
  });

  protected readonly done = this.progress.isDone(TRANSITION_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(TRANSITION_MODEL_KEY);

  constructor() {
    // An `:itemId` that isn't a live script — a typo'd/stale deep link, or one this same effect
    // just tombstoned by deleting it — redirects to the list (issue #187's acceptance criteria).
    // Deleting and then navigating away explicitly would race this: this single effect covers
    // both a bad id from the start and one that goes bad while open.
    //
    // `id != null` (not `!== null`): `withComponentInputBinding()`'s default
    // `unmatchedInputBehavior` is `'alwaysUndefined'`, so closing the editor — a URL with no
    // trailing segment, and therefore no `itemId` param — calls `setInput('itemId', undefined)`
    // rather than leaving this input's own `null` default alone. `undefined` is just as much
    // "no id" as `null` is.
    effect(() => {
      const id = this.itemId();
      if (id != null && !this.scripts().some((script) => script.id === id)) {
        this.goToList();
      }
    });
  }

  /** Absolute, not `router.navigate([...], { relativeTo: this.route })`: relative navigation's
   * `'../'` counts route *config* nesting, and this feature's routes are lazily mounted under the
   * `ROUTE_REGISTRY`'s own `habits/paradigms/transition` entry, so `'../'` resolves against a
   * route that contributes no segment to walk back up from — Angular either throws (`NG04005`) or
   * silently builds a URL tree that matches nothing and falls through to the app's
   * wildcard-redirects-home route (only caught by `e2e/paradigms-transition.spec.ts` against the
   * real `ROUTE_REGISTRY`; the unit tests' shallower mounting hid it). `TRANSITION_ROUTE` is
   * exactly the URL `registerExercise()` already advertises for this exercise, so it can't drift
   * from where this feature is actually mounted. */
  private goTo(commands: readonly string[]): void {
    void this.router.navigate([`/${TRANSITION_ROUTE}`, ...commands]);
  }

  private goToList(): void {
    this.goTo([]);
  }

  protected select(id: string): void {
    this.goTo([id]);
  }

  protected closeDetail(): void {
    this.goToList();
  }

  protected onAddScript(): void {
    const now = this.clock.now();
    let createdId: string | null = null;
    const applied = this.store.update((scripts) => {
      const next = addScript(scripts, DEFAULT_FIELDS, now);
      createdId = next[next.length - 1].id;
      return next;
    });
    if (applied && createdId) {
      this.goTo([createdId]);
    }
  }

  protected onItemChanged(id: string, fields: Partial<ScriptFields>): void {
    this.store.update((scripts) => editScript(scripts, id, fields));
  }

  protected onItemDeleted(id: string): void {
    // The redirect effect above closes the editor once the delete lands (the id is no longer a
    // live script) — this only owns confirm, the tombstone itself, and Undo (playbook's "Deleting
    // entries"; `DeleteWithUndo` is the shared confirm → delete → undo flow issue #203 introduced).
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('paradigmsTransition.list.deleted'),
      undoLabel: this.transloco.translate('paradigmsTransition.list.undo'),
      onConfirm: () => this.store.update((scripts) => removeScript(scripts, id, this.clock.now())),
      onUndo: () => this.store.update((scripts) => restoreScript(scripts, id, this.clock.now())),
    });
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(TRANSITION_MODEL_KEY);
    } else {
      this.progress.markDone(TRANSITION_MODEL_KEY);
    }
  }
}

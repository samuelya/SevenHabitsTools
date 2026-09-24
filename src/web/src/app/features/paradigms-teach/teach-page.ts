import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
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
import { TeachItemForm } from './teach-item-form';
import { TeachSummary } from './teach-summary';
import {
  canMarkDone,
  draftFor,
  entryForChapter,
  labelsFrom,
  removeEntry,
  restoreEntry,
  summarize,
  toListItem,
  upsertEntry,
} from './teach.logic';
import {
  isTeachChapter,
  TEACH_CHAPTERS,
  TEACH_MODEL_KEY,
  TEACH_ROUTE,
  TEACH_STATUSES,
  TeachEntry,
  TeachEntryFields,
} from './teach.model';

/** Teach-to-learn tracker (issue #52): one row per book chapter, always shown — unlike
 * `paradigms-transition`'s arbitrary add-your-own list, `TEACH_CHAPTERS` is fixed, so there's no
 * "add" action and the selected item's id is the chapter key itself, not a record id. A chapter's
 * entry is created lazily, the first time its editor is edited (`teach.logic.ts`'s
 * `upsertEntry()`).
 *
 * **Routing:** same `optionalParamMatcher('itemId')` pattern as the reference implementation
 * (`paradigms-transition`, `exercise-layout.md`) — `itemId` is the chapter key, so opening/closing the
 * editor is a param change on one route, not a sibling-route rebuild. This page also reads a
 * `chapter` *query* param, which `?chapter=<habitId>` hub-action links
 * (`shared/exercise-kit/hub-action-registry.ts`) set to pre-select a chapter; the constructor
 * effect below turns a valid one into a real navigation to `itemId`, so every other concern
 * (redirect-on-bad-id, focus, back/reload) only has to handle the one case.
 */
@Component({
  selector: 'app-teach-page',
  imports: [
    DoneToggle,
    ExerciseList,
    ExercisePage,
    ExercisePromptCard,
    TeachItemForm,
    TeachSummary,
    TranslocoPipe,
  ],
  templateUrl: './teach-page.html',
  styleUrl: './teach-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeachPage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly deleteWithUndo = inject(DeleteWithUndo);
  private readonly store = featureStore<TeachEntry[]>(TEACH_MODEL_KEY);
  protected readonly progress = inject(ExerciseProgress);

  /** The `:itemId` route param — the selected chapter key, absent while the list, not a chapter,
   * is showing. Bound through `withComponentInputBinding`. */
  readonly itemId = input<string | null>(null);
  /** The `?chapter=` query param a "teach this" hub-action link sets. Only ever consulted to
   * redirect into `itemId` (constructor effect below); the page's own state always reads from
   * `itemId`, never this. */
  readonly chapter = input<string | null>(null);

  // `translateSignal`, not `transloco.translate()` inside a `computed` — see the playbook's
  // "Reactive labels" section for why, and `paradigms-transition`'s own `TransitionPage` for the
  // pattern this copies. The scope is named explicitly since this route also provides
  // `exercise-kit` (playbook §2), which `translateSignal` would otherwise resolve against.
  private readonly chapterLabels = translateSignal(
    TEACH_CHAPTERS.map((chapter) => `chapter.${chapter}`),
    undefined,
    'paradigms-teach',
  );
  private readonly statusLabels = translateSignal(
    TEACH_STATUSES.map((status) => `status.${status}`),
    undefined,
    'paradigms-teach',
  );
  private readonly overdueLabel = translateSignal('list.overdue', undefined, 'paradigms-teach');
  private readonly labels = computed(() =>
    labelsFrom(
      TEACH_CHAPTERS,
      this.chapterLabels(),
      TEACH_STATUSES,
      this.statusLabels(),
      this.overdueLabel(),
    ),
  );

  protected readonly entries = computed(() => this.store.value());
  protected readonly items = computed(() =>
    TEACH_CHAPTERS.map((chapter) =>
      toListItem(
        chapter,
        entryForChapter(this.entries(), chapter),
        this.labels(),
        this.clock.now(),
      ),
    ),
  );
  protected readonly selectedChapter = computed(() => {
    const id = this.itemId();
    return id != null && isTeachChapter(id) ? id : null;
  });
  protected readonly selectedEntry = computed(() => {
    const chapter = this.selectedChapter();
    return chapter ? entryForChapter(this.entries(), chapter) : undefined;
  });
  protected readonly hasDetail = computed(() => this.selectedChapter() !== null);
  protected readonly draft = computed<TeachEntryFields | null>(() => {
    const chapter = this.selectedChapter();
    return chapter ? draftFor(chapter, this.selectedEntry(), this.clock.now()) : null;
  });
  /** Drives the editor header's title: a chapter with no entry yet, or one whose key idea is
   * still blank, is "new" even though a record may already exist for it. */
  protected readonly isNewEntry = computed(() => !this.draft()?.keyIdea.trim());
  /** This page's `store.update()` is always synchronous, so there's no "saving" state to show
   * (playbook's "Page layout" section). */
  protected readonly editorStatus = computed<'saved' | 'saving' | null>(() =>
    this.hasDetail() ? 'saved' : null,
  );
  protected readonly summary = computed(() => summarize(this.entries(), this.clock.now()));
  protected readonly readyToMarkDone = computed(() => canMarkDone(this.entries()));

  protected readonly done = this.progress.isDone(TEACH_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(TEACH_MODEL_KEY);

  constructor() {
    effect(() => {
      const id = this.itemId();
      if (id != null) {
        // An id that isn't one of the fixed chapter keys — a typo'd/stale deep link — redirects
        // to the list, the same "id isn't valid" guard `paradigms-transition` uses for a
        // tombstoned record (`exercise-layout.md`).
        if (!isTeachChapter(id)) {
          this.goToList();
        }
        return;
      }
      // No path selection yet: a "teach this" hub-action link's `?chapter=` becomes the real
      // selection, dropping the query param (a plain `navigate()` without `queryParamsHandling`
      // replaces it) so the URL settles on the same shape a direct chapter click would produce.
      // `replaceUrl: true`: this transient `?chapter=` URL never itself needs to be a back-button
      // stop — without it, the phone's back gesture lands right back on `?chapter=h1`, which this
      // same effect immediately re-navigates away from, so "back" would look like a no-op.
      // Landing here always came from somewhere real (a hub link), so one real back step should
      // return there, not to this exercise's own bare list the user never actually visited.
      const chapter = this.chapter();
      if (chapter != null && isTeachChapter(chapter)) {
        this.goTo([chapter], { replaceUrl: true });
      }
    });
  }

  /** Absolute, not relative to `this.route` — see `paradigms-transition`'s `goTo()` doc comment
   * for why relative navigation doesn't work from a lazily-mounted feature route. */
  private goTo(commands: readonly string[], options?: { replaceUrl?: boolean }): void {
    void this.router.navigate([`/${TEACH_ROUTE}`, ...commands], options);
  }

  private goToList(): void {
    this.goTo([]);
  }

  protected select(chapter: string): void {
    this.goTo([chapter]);
  }

  protected closeDetail(): void {
    this.goToList();
  }

  protected onItemChanged(fields: Partial<TeachEntryFields>): void {
    const chapter = this.selectedChapter();
    if (!chapter) {
      return;
    }
    this.store.update((entries) => upsertEntry(entries, chapter, fields, this.clock.now()));
  }

  /** Confirm → delete → undo (issue #203's shared pattern, playbook's "Deleting entries").
   * `chapterId` is `ExerciseList`'s row id — the chapter key here, not a record id, since every
   * chapter is always a row whether or not it has an entry yet (`toListItem()`'s own doc comment).
   * A chapter with no entry has nothing to delete: `ExerciseList` never offers a bin button or
   * swipe for that row (`deletable: false`), and this bails the same way if it's ever reached by
   * another path. Unlike every other exercise, deleting doesn't make the id itself stop
   * resolving — the chapter is still a valid `:itemId` — so the redirect effect above can't close
   * the editor on its own; this closes it explicitly exactly when the deleted entry was the one
   * open, leaving the chapter free to be filled in again from a blank editor. */
  protected onEntryDeleted(chapterId: string): void {
    if (!isTeachChapter(chapterId)) {
      return;
    }
    const entry = entryForChapter(this.entries(), chapterId);
    if (!entry) {
      return;
    }
    const id = entry.id;
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('paradigmsTeach.list.deleted'),
      undoLabel: this.transloco.translate('paradigmsTeach.list.undo'),
      onConfirm: () => {
        this.store.update((entries) => removeEntry(entries, id, this.clock.now()));
        if (this.selectedChapter() === chapterId) {
          this.goToList();
        }
      },
      onUndo: () => this.store.update((entries) => restoreEntry(entries, id, this.clock.now())),
    });
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(TEACH_MODEL_KEY);
    } else {
      this.progress.markDone(TEACH_MODEL_KEY);
    }
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
import { isLive, newRecord } from '../../core/data/record';
import { CLOCK } from '../../core/time/clock';
import { DeleteWithUndo } from '../../shared/exercise-kit/delete-with-undo';
import { DoneToggle } from '../../shared/exercise-kit/done-toggle/done-toggle';
import type { ExerciseGuideSample } from '../../shared/exercise-kit/exercise-guide/exercise-guide';
import { exerciseGuideSignal } from '../../shared/exercise-kit/exercise-guide/exercise-guide-signal';
import { ExerciseList } from '../../shared/exercise-kit/exercise-list/exercise-list';
import { ExercisePage } from '../../shared/exercise-kit/exercise-page/exercise-page';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { introCollapsedByDefault } from '../../shared/exercise-kit/exercise-prompt-card/intro-collapsed';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { NEW_ITEM_ID, recordDraft } from '../../shared/exercise-kit/record-draft';
import { InspirationFilters } from './inspiration-filters';
import { InspirationItemForm } from './inspiration-item-form';
import { InspirationSummary } from './inspiration-summary';
import {
  CHECKLIST_KEYS,
  InspirationFilter,
  allTags,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  editFields,
  editInspiration,
  filtered,
  inspirationFromExample,
  isComplete,
  isDraftWorthSaving,
  isStarted,
  labelsFrom,
  liveSampleOf,
  normaliseTag,
  removeInspiration,
  restoreInspiration,
  summarize,
  toListItem,
} from './inspiration.logic';
import {
  INSPIRATION_KINDS,
  INSPIRATION_MODEL_KEY,
  INSPIRATION_ROUTE,
  Inspiration,
  InspirationFields,
  InspirationKind,
} from './inspiration.model';

/** A new item's draft (issue #217): a record on the first typed text in the line or its source. */
const DEFAULT_FIELDS: InspirationFields = { text: '', kind: 'saying', tags: [] };

/**
 * Your collection (issue #63): a list exercise copied from `TransitionPage` (routing, draft before
 * record, samples and delete-with-undo work the same way). The container: it reads `featureStore`,
 * owns the filter state and passes plain values down. The collection also feeds Your mission
 * through the mission-inputs registry (`inspiration.model.ts`), not through this page.
 */
@Component({
  selector: 'app-inspiration-page',
  imports: [
    DoneToggle,
    ExerciseList,
    ExercisePage,
    ExercisePromptCard,
    InspirationFilters,
    InspirationItemForm,
    InspirationSummary,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
  ],
  templateUrl: './inspiration-page.html',
  styleUrl: './inspiration-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspirationPage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly deleteWithUndo = inject(DeleteWithUndo);
  private readonly store = featureStore<readonly Inspiration[]>(INSPIRATION_MODEL_KEY);

  protected readonly progress = inject(ExerciseProgress);
  protected readonly guideContent = exerciseGuideSignal(INSPIRATION_MODEL_KEY);

  /** The `:itemId` route param (`withComponentInputBinding`). */
  readonly itemId = input<string | null>(null);

  protected readonly started = computed(() => isStarted(this.store.value()));
  protected readonly collapsedByDefault = introCollapsedByDefault(this.started);

  // Labels: `translateSignal` with the scope named, keys relative to it (playbook §6).
  private readonly kindLabels = translateSignal(
    INSPIRATION_KINDS.map((kind) => `kind.${kind}`),
    undefined,
    INSPIRATION_MODEL_KEY,
  );
  private readonly exampleLabel = translateSignal('list.example', undefined, INSPIRATION_MODEL_KEY);
  private readonly favouriteLabel = translateSignal(
    'list.favouriteButton',
    undefined,
    INSPIRATION_MODEL_KEY,
  );
  private readonly unfavouriteLabel = translateSignal(
    'list.unfavouriteButton',
    undefined,
    INSPIRATION_MODEL_KEY,
  );
  private readonly labels = computed(() =>
    labelsFrom(
      this.kindLabels(),
      this.exampleLabel(),
      this.favouriteLabel(),
      this.unfavouriteLabel(),
    ),
  );

  protected readonly live = computed(() => this.store.value().filter(isLive));
  protected readonly tags = computed(() => allTags(this.store.value()));

  protected readonly kindFilter = signal<InspirationKind | null>(null);
  protected readonly favouritesOnly = signal(false);
  private readonly selectedTag = signal<string | null>(null);
  /** The tag filter, dropped once no live item carries that tag any more (the chip is gone). */
  protected readonly tagFilter = computed(() => {
    const tag = this.selectedTag();
    return tag !== null && this.tags().includes(tag) ? tag : null;
  });
  private readonly filter = computed<InspirationFilter>(() => ({
    kind: this.kindFilter(),
    tag: this.tagFilter(),
    favouritesOnly: this.favouritesOnly(),
    // The kit's own search box searches the rows (text, kind and source).
    query: '',
  }));
  protected readonly items = computed(() =>
    filtered(this.store.value(), this.filter()).map((item) => toListItem(item, this.labels())),
  );

  protected readonly draft = recordDraft<Inspiration>({
    itemId: this.itemId,
    records: this.live,
    create: () => newRecord(DEFAULT_FIELDS, this.clock.now()),
    isWorthSaving: isDraftWorthSaving,
    save: (record) => this.store.update((list) => [...list, record]),
    update: (id, fields) => this.store.update((list) => editInspiration(list, id, fields)),
    navigate: (segment, options) => this.goTo(segment === null ? [] : [segment], options),
    now: () => this.clock.now(),
  });

  protected readonly summary = computed(() => summarize(this.store.value()));
  protected readonly readyToMarkDone = computed(() => isComplete(this.store.value()));
  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    INSPIRATION_MODEL_KEY,
  );
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistLabels());
    return checklistLoaded(labels) ? doneChecklist(this.store.value(), labels) : null;
  });

  protected readonly done = this.progress.isDone(INSPIRATION_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(INSPIRATION_MODEL_KEY);

  /** Absolute navigation, for the reason `TransitionPage.goTo()` gives. */
  private goTo(commands: readonly string[], options?: { replaceUrl?: boolean }): void {
    void this.router.navigate([`/${INSPIRATION_ROUTE}`, ...commands], options);
  }

  protected select(id: string): void {
    this.goTo([id]);
  }

  protected closeDetail(): void {
    this.goTo([]);
  }

  protected onAdd(): void {
    this.draft.start();
  }

  protected onTagFilterChange(tag: string | null): void {
    this.selectedTag.set(tag === null ? null : normaliseTag(tag));
  }

  /** "Try this example" (issue #232): a real item flagged `sample`. An untouched one already tried
   * opens instead of a copy. */
  protected onExampleTried(sample: ExerciseGuideSample): void {
    const fields = inspirationFromExample(sample);
    if (fields === null) {
      return;
    }
    const options = { replaceUrl: this.itemId() === NEW_ITEM_ID };
    const existing = liveSampleOf(this.store.value(), fields);
    if (existing) {
      this.goTo([existing.id], options);
      return;
    }
    const record: Inspiration = { ...newRecord(fields, this.clock.now()), sample: true };
    if (this.store.update((list) => [...list, record])) {
      this.goTo([record.id], options);
    }
  }

  /** Cleaned before `draft.edit()`: the draft path merges fields as they come (playbook §6). */
  protected onItemChanged(id: string, edit: Partial<InspirationFields>): void {
    this.draft.edit(id, editFields(edit));
  }

  /** The row's star. Rows are saved records, so this is a plain store edit. */
  protected onFavouriteToggled(id: string): void {
    const item = this.live().find((candidate) => candidate.id === id);
    if (item) {
      this.store.update((list) =>
        editInspiration(list, id, editFields({ favourite: !item.favourite })),
      );
    }
  }

  protected onItemDeleted(id: string): void {
    if (this.draft.owns(id)) {
      this.draft.discard();
      return;
    }
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('h2Inspiration.list.deleted'),
      undoLabel: this.transloco.translate('h2Inspiration.list.undo'),
      onConfirm: () => this.store.update((list) => removeInspiration(list, id, this.clock.now())),
      onUndo: () => this.store.update((list) => restoreInspiration(list, id, this.clock.now())),
    });
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(INSPIRATION_MODEL_KEY);
    } else {
      this.progress.markDone(INSPIRATION_MODEL_KEY);
    }
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { translateSignal, TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { DocumentStore } from '../../core/data/document.store';
import { featureStore } from '../../core/data/feature-store';
import { newRecord } from '../../core/data/record';
import { CLOCK } from '../../core/time/clock';
import { AssessmentHistoryList } from '../../shared/exercise-kit/assessment-history-list/assessment-history-list';
import {
  localDateString,
  sortedByDateDesc,
} from '../../shared/exercise-kit/assessment-history.logic';
import { DeleteWithUndo } from '../../shared/exercise-kit/delete-with-undo';
import { DoneToggle } from '../../shared/exercise-kit/done-toggle/done-toggle';
import { ExercisePage } from '../../shared/exercise-kit/exercise-page/exercise-page';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { introCollapsedByDefault } from '../../shared/exercise-kit/exercise-prompt-card/intro-collapsed';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { recordDraft } from '../../shared/exercise-kit/record-draft';
import { builtInLabelsFrom, displayName, restoreAsset } from './pc-balance-assets.logic';
import { PcBalanceAuditForm, PcReflectionChange } from './pc-balance-audit-form';
import { PcBalanceSummary } from './pc-balance-summary';
import {
  auditAverageBalance,
  CHECKLIST_KEYS,
  checklistLabelsFrom,
  checklistLoaded,
  doneChecklist,
  editAudit,
  isComplete,
  liveAudits,
  newAuditFields,
  removeAsset,
  removeAudit,
  restoreAudit,
  summarize,
  isStarted,
  isDraftWorthSaving,
} from './pc-balance.logic';
import {
  PC_BALANCE_MODEL_KEY,
  PC_BALANCE_ROUTE,
  PC_BUILT_IN_ASSET_KEYS,
  PcAsset,
  PcAudit,
  PcAuditFields,
} from './pc-balance.model';

/**
 * P/PC balance audit (issue #49): the reference **assessment** exercise (playbook §4) — a
 * repeatable, dated record with a nested asset list, compared over time through the shared
 * `assessment-history.logic.ts` (created by this PR, reused by #50's maturity continuum). The
 * container: it reads `featureStore`, calls `ExerciseProgress`, and passes plain values down to
 * `AssessmentHistoryList`/`PcBalanceAuditForm`/`PcBalanceSummary` — none of which inject the store
 * or a service.
 *
 * **Routing**, same pattern issue #187 set for the list type: the selected audit is the optional
 * trailing URL segment `:itemId` (`pc-balance.routes.ts`), one route with `optionalParamMatcher`,
 * never a `''`/`':itemId'` sibling pair. Every audit stays editable (issue #49's implementation
 * notes), so selecting a past audit from the history opens the same editor a new one does.
 *
 * **Draft before record (issue #217):** "New audit" opens the reserved `NEW_ITEM_ID` segment on
 * an in-memory draft (`recordDraft()`), stored on the first real input (`isDraftWorthSaving()`),
 * after which the URL moves to the real id — `TransitionPage`'s same pattern. While it is a draft
 * the reflection skips its debounce (`[unsaved]`), so no edit is pending when the editor closes.
 */
@Component({
  selector: 'app-pc-balance-page',
  imports: [
    AssessmentHistoryList,
    DoneToggle,
    ExercisePage,
    ExercisePromptCard,
    MatButtonModule,
    MatIconModule,
    PcBalanceAuditForm,
    PcBalanceSummary,
    TranslocoPipe,
  ],
  templateUrl: './pc-balance-page.html',
  styleUrl: './pc-balance-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PcBalancePage {
  private readonly clock = inject(CLOCK);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly deleteWithUndo = inject(DeleteWithUndo);
  private readonly store = featureStore<PcAudit[]>(PC_BALANCE_MODEL_KEY);
  private readonly documentStore = inject(DocumentStore);
  /** Any live record (issue #216), from the same pure predicate the registry's `isStarted` uses. */
  protected readonly started = computed(() => isStarted(this.store.value()));
  /** Read once by `ExercisePromptCard` at mount: collapsed once started, always on a phone. */
  protected readonly collapsedByDefault = introCollapsedByDefault(this.started);
  protected readonly progress = inject(ExerciseProgress);

  /** The `:itemId` route param, bound through `withComponentInputBinding` — absent while the URL
   * has no trailing segment, i.e. while the history, not an audit, is showing. */
  readonly itemId = input<string | null>(null);

  protected readonly audits = computed(() => liveAudits(this.store.value()));
  protected readonly history = computed(() => sortedByDateDesc(this.audits()));
  protected readonly historyItems = computed(() =>
    this.history().map((audit) => ({
      id: audit.id,
      date: audit.date,
      subtitle: balanceSubtitle(auditAverageBalance(audit)),
    })),
  );
  // Reactive labels (playbook §6): a cold load or a language switch updates the suggested chips
  // and the built-in asset titles. `null` until the scope has loaded, so the form (and a remove
  // confirm) never shows a blank chip or "Remove ?" (the checklist's same gate).
  private readonly builtInAssetLabels = translateSignal(
    PC_BUILT_IN_ASSET_KEYS.map((key) => `asset.${key}`),
    undefined,
    'paradigms-pc-balance',
  );
  protected readonly builtInLabels = computed(() => builtInLabelsFrom(this.builtInAssetLabels()));
  /** Bumped each time the store refuses an edit (a read-only tab), so the form drops its own copy
   * of the assets and shows the stored ones again (#222's same rule). The store's own count, so an
   * edit that doesn't land for another reason (an Undo after its audit was deleted) doesn't reset
   * the audit that is open. */
  protected readonly refusedEdits = this.documentStore.refusedEdits;
  protected readonly draft = recordDraft<PcAudit>({
    itemId: this.itemId,
    records: this.audits,
    // Read when the draft opens: the latest audit's assets, sliders reset (`newAuditFields`).
    create: () => {
      const now = this.clock.now();
      return newRecord(newAuditFields(this.history()[0] ?? null, localDateString(now)), now);
    },
    isWorthSaving: isDraftWorthSaving,
    save: (record) => this.store.update((audits) => [...audits, record]),
    update: (id, fields) => this.store.update((audits) => editAudit(audits, id, fields)),
    navigate: (segment, options) => this.goTo(segment === null ? [] : [segment], options),
    now: () => this.clock.now(),
  });
  /** `null` until the first audit exists (issue #215): no "0 audits taken" card next to the
   * history's own empty-state text. */
  protected readonly summary = computed(() =>
    this.audits().length > 0 ? summarize(this.store.value()) : null,
  );
  protected readonly readyToMarkDone = computed(() => isComplete(this.store.value()));

  // Scope named explicitly (playbook §6 "Reactive labels": this route also provides
  // `exercise-kit`).
  private readonly checklistLabels = translateSignal(
    CHECKLIST_KEYS.map((key) => `checklist.${key}`),
    undefined,
    'paradigms-pc-balance',
  );
  /** `null` until the scope has loaded, so `DoneToggle` never renders blank rows on a cold visit
   * (`perception-page.ts`'s same gate). */
  protected readonly checklist = computed(() => {
    const labels = checklistLabelsFrom(this.checklistLabels());
    return checklistLoaded(labels) ? doneChecklist(this.store.value(), labels) : null;
  });

  protected readonly done = this.progress.isDone(PC_BALANCE_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(PC_BALANCE_MODEL_KEY);

  /** Absolute, not relative to `this.route` — see `TransitionPage.goTo()`'s doc comment for why
   * relative navigation doesn't resolve against this feature's lazily mounted route. */
  private goTo(commands: readonly string[], options?: { replaceUrl?: boolean }): void {
    void this.router.navigate([`/${PC_BALANCE_ROUTE}`, ...commands], options);
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

  /** Opens the editor on an in-memory draft; nothing is stored yet (issue #217). */
  protected onNewAudit(): void {
    this.draft.start();
  }

  /** The first real input saves a draft (`recordDraft()`), which then moves the URL to its id. */
  protected onAuditChanged(id: string, fields: Partial<PcAuditFields>): void {
    this.draft.edit(id, fields);
  }

  /** Removing an asset holding a rating or action: confirm → remove → undo (issue #223), the
   * shared pattern with asset-specific wording, and Undo putting it back where it was. A read-only
   * tab is refused up front: no confirm, no "Asset removed" for an edit that can't land. */
  protected async onAssetRemoveRequested(
    id: string,
    key: string,
    form: PcBalanceAuditForm,
  ): Promise<void> {
    if (!this.documentStore.isWriter()) {
      this.documentStore.reportRefusedEdit();
      return;
    }
    const assets = this.assetsOf(id);
    const index = assets.findIndex((asset) => asset.key === key);
    if (index === -1) {
      form.cancelAssetRemoval(key);
      return;
    }
    const removed = assets[index];
    const name = displayName(removed, this.builtInLabels() ?? {});
    let confirmed = false;
    await this.deleteWithUndo.confirmAndDelete({
      confirm: {
        title: this.transloco.translate('paradigmsPcBalance.form.removeConfirmTitle', { name }),
        body: this.transloco.translate('paradigmsPcBalance.form.removeConfirmBody'),
        confirmLabel: this.transloco.translate('paradigmsPcBalance.form.removeConfirmButton'),
      },
      deletedMessage: this.transloco.translate('paradigmsPcBalance.form.assetRemoved'),
      undoLabel: this.transloco.translate('paradigmsPcBalance.history.undo'),
      onConfirm: () => {
        confirmed = true;
        this.onAuditChanged(id, { assets: removeAsset(this.assetsOf(id), key) });
      },
      onUndo: () =>
        this.onAuditChanged(id, { assets: restoreAsset(this.assetsOf(id), removed, index) }),
    });
    if (!confirmed) {
      form.cancelAssetRemoval(key);
    }
  }

  /** The assets of audit `id` as they stand now: the open audit's (stored or draft), else the
   * stored one's, for an Undo tapped after the editor closed. */
  private assetsOf(id: string): readonly PcAsset[] {
    const selected = this.draft.selected();
    if (selected?.id === id) {
      return selected.assets;
    }
    return this.audits().find((audit) => audit.id === id)?.assets ?? [];
  }

  /** Always reports an outcome, so the reflection never sits on "Saving…". On an unsaved draft
   * each keystroke arrives here at once (the form's `immediate`), so it is never "Saved" until the
   * draft is stored (issue #217). */
  protected onReflectionChanged(change: PcReflectionChange, form: PcBalanceAuditForm): void {
    const landed = this.draft.edit(change.auditId, { reflection: change.reflection });
    form.reportReflectionSaveOutcome(change.auditId, landed);
  }

  /** Confirm → delete → undo (issue #203's shared pattern, playbook's "Deleting entries"). */
  protected onAuditDeleted(id: string): void {
    void this.deleteWithUndo.confirmAndDelete({
      deletedMessage: this.transloco.translate('paradigmsPcBalance.history.deleted'),
      undoLabel: this.transloco.translate('paradigmsPcBalance.history.undo'),
      onConfirm: () => this.store.update((audits) => removeAudit(audits, id, this.clock.now())),
      onUndo: () => this.store.update((audits) => restoreAudit(audits, id, this.clock.now())),
    });
  }

  protected onToggleDone(): void {
    if (this.done()) {
      this.progress.reopen(PC_BALANCE_MODEL_KEY);
    } else {
      this.progress.markDone(PC_BALANCE_MODEL_KEY);
    }
  }
}

/** A signed number only (no translated words), so it needs no reactive re-evaluation on a
 * language switch (architecture issue #1 §7: Western numerals by default). */
function balanceSubtitle(averageBalance: number | null): string | undefined {
  return averageBalance === null ? undefined : `${averageBalance > 0 ? '+' : ''}${averageBalance}`;
}

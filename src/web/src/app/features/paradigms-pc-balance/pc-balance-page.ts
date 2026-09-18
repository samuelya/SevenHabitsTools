import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { featureStore } from '../../core/data/feature-store';
import { CLOCK } from '../../core/time/clock';
import { AssessmentHistoryList } from '../../shared/exercise-kit/assessment-history-list/assessment-history-list';
import {
  localDateString,
  sortedByDateDesc,
} from '../../shared/exercise-kit/assessment-history.logic';
import { DoneToggle } from '../../shared/exercise-kit/done-toggle/done-toggle';
import { ExercisePage } from '../../shared/exercise-kit/exercise-page/exercise-page';
import { ExercisePromptCard } from '../../shared/exercise-kit/exercise-prompt-card/exercise-prompt-card';
import { ExerciseProgress } from '../../shared/exercise-kit/exercise-progress.service';
import { PcBalanceAuditForm } from './pc-balance-audit-form';
import { PcBalanceSummary } from './pc-balance-summary';
import {
  addAudit,
  auditAverageBalance,
  canMarkDone,
  editAudit,
  liveAudits,
  newAuditFields,
  summarize,
} from './pc-balance.logic';
import { PC_BALANCE_MODEL_KEY, PC_BALANCE_ROUTE, PcAudit, PcAuditFields } from './pc-balance.model';

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
  private readonly store = featureStore<PcAudit[]>(PC_BALANCE_MODEL_KEY);
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
  protected readonly selectedAudit = computed(
    () => this.audits().find((audit) => audit.id === this.itemId()) ?? null,
  );
  protected readonly hasDetail = computed(() => this.selectedAudit() !== null);
  /** This page's `store.update()` is always synchronous, so there's no "saving" state to show —
   * see the playbook's "Page layout" section. */
  protected readonly editorStatus = computed<'saved' | 'saving' | null>(() =>
    this.hasDetail() ? 'saved' : null,
  );
  protected readonly summary = computed(() => summarize(this.store.value()));
  protected readonly readyToMarkDone = computed(() => canMarkDone(this.store.value()));

  protected readonly done = this.progress.isDone(PC_BALANCE_MODEL_KEY);
  protected readonly completedAt = this.progress.completedAt(PC_BALANCE_MODEL_KEY);

  constructor() {
    // An `:itemId` that isn't a live audit redirects to the history (issue #187's pattern). Guard
    // `id != null`, not `id !== null`: `withComponentInputBinding()`'s default
    // `unmatchedInputBehavior` is `'alwaysUndefined'`, so closing the editor sets `itemId` to
    // `undefined`, not this input's own `null` default.
    effect(() => {
      const id = this.itemId();
      if (id != null && !this.audits().some((audit) => audit.id === id)) {
        this.goToList();
      }
    });
  }

  /** Absolute, not relative to `this.route` — see `TransitionPage.goTo()`'s doc comment for why
   * relative navigation doesn't resolve against this feature's lazily mounted route. */
  private goTo(commands: readonly string[]): void {
    void this.router.navigate([`/${PC_BALANCE_ROUTE}`, ...commands]);
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

  protected onNewAudit(): void {
    const now = this.clock.now();
    const latest = this.history()[0] ?? null;
    const fields: PcAuditFields = newAuditFields(latest, localDateString(now));
    let createdId: string | null = null;
    const applied = this.store.update((audits) => {
      const next = addAudit(audits, fields, now);
      createdId = next[next.length - 1].id;
      return next;
    });
    if (applied && createdId) {
      this.goTo([createdId]);
    }
  }

  protected onAuditChanged(id: string, fields: Partial<PcAuditFields>): void {
    this.store.update((audits) => editAudit(audits, id, fields));
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

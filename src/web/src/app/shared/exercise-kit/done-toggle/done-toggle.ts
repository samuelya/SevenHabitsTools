import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../../core/i18n/locale.pipe';

/** One line of the "to mark done" checklist (issue #212's "Gate as a checklist"): a page's own
 * `<slug>.logic.ts` (e.g. `doneChecklist()`) reduces the same list `isComplete()` does, so the
 * gate button and the list it shows here can never disagree. */
export interface DoneChecklistItem {
  readonly label: string;
  readonly met: boolean;
}

/**
 * Marks an exercise done or reopens it (issue #30). Purely presentational: `done`/`completedAt`
 * are inputs, `toggled` a single output — the caller (through `ExerciseProgress`) decides whether a
 * toggle means `markDone()` or `reopen()`, based on the `done` it just passed in.
 *
 * `disabled` (issue #51) only gates the "Mark done" button — a list exercise whose done rule is
 * "at least one item is complete" passes `!canMarkDone` here rather than hiding the control.
 * Reopening stays available regardless: it undoes a past action, not one gated by current data.
 *
 * `disabledHint` (issue #185) renders next to a disabled "Mark done" button, linked to it with
 * `aria-describedby`, so the user learns *why* it's unavailable instead of a silently inert
 * button. `checklist` (issue #212) is the richer alternative: while "Mark done" is disabled, it
 * renders the still-unmet items under "To mark done:", also linked with `aria-describedby`, and
 * disappears once every item is met (or the exercise is done) — `disabledHint` keeps working
 * unchanged for the exercises that still just pass a single hint string.
 */
@Component({
  selector: 'app-done-toggle',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe, AppDatePipe],
  templateUrl: './done-toggle.html',
  styleUrl: './done-toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoneToggle {
  private static nextInstanceId = 0;

  readonly done = input.required<boolean>();
  readonly completedAt = input<string | null>(null);
  readonly disabled = input(false);
  readonly disabledHint = input<string | null>(null);
  readonly checklist = input<readonly DoneChecklistItem[] | null>(null);
  readonly toggled = output<void>();

  /** Own instance id, so two `DoneToggle`s on the same page (e.g. the dev kit demo) don't collide
   * on the same `id`s for `aria-describedby` to point at. */
  private readonly instanceId = DoneToggle.nextInstanceId++;
  protected readonly hintId = `done-toggle-hint-${this.instanceId}`;
  protected readonly checklistId = `done-toggle-checklist-${this.instanceId}`;

  /** Only while "Mark done" is disabled, and only until every item is met (or the exercise is
   * done) — the list never lingers pointlessly next to an enabled button (issue #212's own
   * acceptance criteria). */
  protected readonly unmetChecklist = computed(() => {
    if (this.done() || !this.disabled()) {
      return null;
    }
    const items = this.checklist();
    return items !== null && items.some((item) => !item.met) ? items : null;
  });

  protected readonly describedBy = computed(() => {
    const ids: string[] = [];
    if (this.disabled() && this.disabledHint() !== null) {
      ids.push(this.hintId);
    }
    if (this.unmetChecklist() !== null) {
      ids.push(this.checklistId);
    }
    return ids.length > 0 ? ids.join(' ') : null;
  });
}

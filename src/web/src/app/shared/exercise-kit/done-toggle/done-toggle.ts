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
 * The button stays focusable while gated (`disabledInteractive` + `aria-disabled`, not the native
 * `disabled` attribute — issue #215): a natively disabled button is skipped by Tab and most screen
 * readers never announce its description, so the checklist below would only be reachable by
 * accident. A click on it is swallowed here, since `disabledInteractive` alone doesn't stop one.
 *
 * `checklist` (issue #212): while "Mark done" is gated, it renders the still-unmet items under
 * "To mark done:", linked to the button with `aria-describedby`, and disappears once every item
 * is met (or the exercise is done). Every exercise passes one (#215 removed the older single
 * `disabledHint` string).
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
  readonly checklist = input<readonly DoneChecklistItem[] | null>(null);
  readonly toggled = output<void>();

  /** Own instance id, so two `DoneToggle`s on the same page (e.g. the dev kit demo) don't collide
   * on the same `id`s for `aria-describedby` to point at. */
  private readonly instanceId = DoneToggle.nextInstanceId++;
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

  protected readonly describedBy = computed(() =>
    this.unmetChecklist() !== null ? this.checklistId : null,
  );

  protected onMarkDone(): void {
    if (!this.disabled()) {
      this.toggled.emit();
    }
  }
}

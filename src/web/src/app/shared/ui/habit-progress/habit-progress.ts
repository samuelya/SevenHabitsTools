import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { progressPercentage } from '../../../core/habits/habit-list.logic';

/** A habit's progress (issues #219, #220): a small ring plus its already-translated "2 of 5" text.
 * Presentational; the habits list and Today both render it. The ring is decorative, since the text
 * says the same thing. */
@Component({
  selector: 'app-habit-progress',
  imports: [MatProgressSpinnerModule],
  template: `
    <mat-progress-spinner
      class="habit-progress-ring"
      mode="determinate"
      diameter="32"
      strokeWidth="3"
      [value]="percentage()"
      aria-hidden="true"
    />
    <span class="habit-progress-count">{{ label() }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .habit-progress-count {
      color: var(--mat-sys-on-surface-variant, gray);
      font-size: 0.75rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabitProgress {
  readonly done = input.required<number>();
  readonly total = input.required<number>();
  /** The translated count, e.g. "2 of 5 done". */
  readonly label = input.required<string>();

  protected readonly percentage = computed(() => progressPercentage(this.done(), this.total()));
}

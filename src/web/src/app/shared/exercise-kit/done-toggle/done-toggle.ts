import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../../core/i18n/locale.pipe';

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
 * button.
 */
@Component({
  selector: 'app-done-toggle',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe, AppDatePipe],
  templateUrl: './done-toggle.html',
  styleUrl: './done-toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoneToggle {
  private static nextHintId = 0;

  readonly done = input.required<boolean>();
  readonly completedAt = input<string | null>(null);
  readonly disabled = input(false);
  readonly disabledHint = input<string | null>(null);
  readonly toggled = output<void>();

  /** Own instance id, so two `DoneToggle`s on the same page (e.g. the dev kit demo) don't collide
   * on the same `id` for `aria-describedby` to point at. */
  protected readonly hintId = `done-toggle-hint-${DoneToggle.nextHintId++}`;
}

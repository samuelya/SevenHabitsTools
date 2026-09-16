import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../../core/i18n/locale.pipe';

/**
 * Marks an exercise done or reopens it (issue #30). Purely presentational: `done`/`completedAt`
 * are inputs, `toggled` a single output — the caller (through `ExerciseProgress`) decides whether a
 * toggle means `markDone()` or `reopen()`, based on the `done` it just passed in.
 */
@Component({
  selector: 'app-done-toggle',
  imports: [MatButtonModule, MatIconModule, TranslocoPipe, AppDatePipe],
  templateUrl: './done-toggle.html',
  styleUrl: './done-toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoneToggle {
  readonly done = input.required<boolean>();
  readonly completedAt = input<string | null>(null);
  readonly toggled = output<void>();
}

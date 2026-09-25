import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppPluralPipe } from '../../core/i18n/plural.pipe';
import { DayState, DaySummary } from './language.logic';

/**
 * The listening-day area above the list (issue #54): "Start listening" before any day; while one
 * runs, the banner with the hours left and "End day"; once it has ended, its summary card and
 * "New day". Purely presentational: the page derives `state` from the clock and handles the
 * outputs.
 *
 * Screen readers: the banner sits in a live region that is always in the DOM, so starting a day
 * (the banner's `<p>` being added) is announced once. The region only relays additions: the
 * hourly change of the hours-left number rewrites the existing text node, which isn't announced,
 * and a minute tick that leaves the number alone doesn't touch the DOM at all. The number stays
 * readable in browse mode.
 */
@Component({
  selector: 'app-language-day',
  imports: [AppPluralPipe, MatButtonModule, MatCardModule, MatIconModule, TranslocoPipe],
  templateUrl: './language-day.html',
  styleUrl: './language-day.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageDay {
  readonly state = input.required<DayState>();
  /** The ended day's counts; `null` while a day runs or before the first one. */
  readonly summary = input<DaySummary | null>(null);
  readonly dayStarted = output<void>();
  readonly dayEnded = output<string>();

  protected readonly hoursLeft = computed(() => {
    const state = this.state();
    return state.kind === 'running' ? state.hoursLeft : null;
  });

  protected onEnd(): void {
    const state = this.state();
    if (state.kind === 'running') {
      this.dayEnded.emit(state.day.id);
    }
  }
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../core/i18n/locale.pipe';
import { HabitId } from '../../core/habits/habits';
import { parseIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import {
  AreaDelta,
  deltaFor,
  displayName,
  overallProfile,
  removedAreas,
  suggestedHabits,
} from './maturity.logic';
import { MaturityArea, MaturityAssessment, MaturityLevel } from './maturity.model';

/** One area's row in the delta list. */
interface AreaDeltaRow {
  readonly area: MaturityArea;
  readonly delta: AreaDelta | null;
}

/**
 * The read-only result for the assessment being edited (issue #50's acceptance criteria): the
 * overall profile, its suggested habits to focus on, and — once a previous assessment exists — the
 * per-area delta and any area that was in the previous assessment but not this one. Purely
 * presentational and reactive to every keystroke in the sibling `MaturityAssessmentForm`, since
 * both read the same `assessment` the page passes down.
 */
@Component({
  selector: 'app-maturity-result',
  imports: [AppDatePipe, RouterLink, TranslocoPipe],
  templateUrl: './maturity-result.html',
  styleUrl: './maturity-result.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaturityResult {
  readonly assessment = input.required<MaturityAssessment>();
  readonly previous = input<MaturityAssessment | null>(null);
  readonly builtInLabels = input.required<Record<string, string>>();
  readonly profileLabels = input.required<Record<MaturityLevel, string>>();

  protected readonly profile = computed(() => overallProfile(this.assessment().areas));
  protected readonly suggestions = computed(() => suggestedHabits(this.profile()));
  protected readonly areaDeltas = computed<readonly AreaDeltaRow[]>(() =>
    this.assessment().areas.map((area) => ({
      area,
      delta: deltaFor(area, this.previous()?.areas ?? null),
    })),
  );
  protected readonly removed = computed(() =>
    removedAreas(this.assessment().areas, this.previous()?.areas ?? null),
  );

  protected readonly displayValue = (area: MaturityArea): string =>
    displayName(area, this.builtInLabels());

  protected habitNumber(id: HabitId): string {
    return id.slice(1);
  }

  protected localDate(date: string): Date {
    return parseIsoDate(date);
  }
}

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  FACTOR_KEYS,
  MAX_RATING,
  chosenCentre,
  deltas,
  isTied,
  principleLabels,
  ranked,
} from './centres.logic';
import { CentreAssessment, CentreKey, PrincipleKey } from './centres.model';

/**
 * A saved assessment, read-only (issue #60): the centres ranked as bars (and a tie at the top
 * named), the four factor answers under the centre they were written about, the chosen principles and, with a previous assessment, what changed since.
 * Presentational: "Edit" is emitted and the page decides what it does.
 */
@Component({
  selector: 'app-centres-result',
  imports: [MatButtonModule, MatChipsModule, MatIconModule, TranslocoPipe],
  templateUrl: './centres-result.html',
  styleUrl: './centres-result.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CentresResult {
  readonly assessment = input.required<CentreAssessment>();
  /** The live assessment before this one, `null` for the first. */
  readonly previous = input<CentreAssessment | null>(null);
  readonly centreLabels = input.required<Readonly<Record<CentreKey, string>>>();
  readonly principleKeyLabels = input.required<Readonly<Record<PrincipleKey, string>>>();
  /** The centres tied at the top as one phrase in the current language ("Work and Money"). */
  readonly tiedList = input('');
  readonly editRequested = output<void>();

  protected readonly total = MAX_RATING;
  protected readonly bars = computed(() =>
    ranked(this.assessment()).map((entry) => ({
      ...entry,
      percent: (entry.rating / MAX_RATING) * 100,
    })),
  );
  /** The centre a tie was settled on, `null` without a tie. */
  protected readonly tiedChoice = computed(() =>
    isTied(this.assessment()) ? chosenCentre(this.assessment()) : null,
  );
  /** The centre the answers were written about, even if it's no longer top. */
  protected readonly factorsCentre = computed(() => this.assessment().factorsCentre ?? null);
  protected readonly factors = computed(() => {
    const factors = this.assessment().factors ?? {};
    return FACTOR_KEYS.map((factor) => ({ factor, text: factors[factor] ?? '' })).filter(
      (entry) => entry.text.trim() !== '',
    );
  });
  protected readonly principles = computed(() =>
    principleLabels(this.assessment(), this.principleKeyLabels()),
  );
  /** `null` without a previous assessment: the section isn't shown. */
  protected readonly changes = computed(() => {
    const previous = this.previous();
    return previous === null ? null : deltas(this.assessment(), previous);
  });
}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { RATINGS } from './centres.logic';
import { CentreKey, CentreRating } from './centres.model';

/** One centre (issue #60): its title, its one-line description and the 0–3 rating as a toggle
 * group labelled by the title. Presentational: it emits the choice and the page stores it. */
@Component({
  selector: 'app-centre-card',
  imports: [MatButtonToggleModule, TranslocoPipe],
  templateUrl: './centre-card.html',
  styleUrl: './centre-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CentreCard {
  readonly centre = input.required<CentreKey>();
  /** `null` while unrated: no toggle is pressed. */
  readonly rating = input<CentreRating | null>(null);
  readonly ratingChange = output<CentreRating>();

  protected readonly ratings = RATINGS;

  protected onChange(event: MatButtonToggleChange): void {
    this.ratingChange.emit(event.value as CentreRating);
  }
}

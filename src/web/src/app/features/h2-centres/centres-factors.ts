import { TextFieldModule } from '@angular/cdk/text-field';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioChange, MatRadioModule } from '@angular/material/radio';
import { TranslocoPipe } from '@jsverse/transloco';
import { FACTOR_KEYS } from './centres.logic';
import { CentreFactors, CentreKey, FactorKey } from './centres.model';

export interface FactorChange {
  readonly factor: FactorKey;
  readonly text: string;
}

/** One of the centres tied at the top, already translated. */
export interface TiedCentre {
  readonly centre: CentreKey;
  readonly label: string;
}

/** Step 2 of an assessment (issue #60): the top centre named, a choice between the centres tied
 * at the top, and its four factor fields with label / prompt / placeholder; the one-line note
 * instead when nothing is rated above 0. Presentational: it emits each edit and the pick, and the
 * page stores them. */
@Component({
  selector: 'app-centres-factors',
  imports: [MatFormFieldModule, MatInputModule, MatRadioModule, TextFieldModule, TranslocoPipe],
  templateUrl: './centres-factors.html',
  styleUrl: './centres-factors.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CentresFactors {
  /** The top centre's translated title, `null` when every rating is 0. */
  readonly centreLabel = input<string | null>(null);
  /** The centre the answers are about. */
  readonly centre = input<CentreKey | null>(null);
  /** Every centre sharing the top rating; a choice is offered when there are two or more. */
  readonly tied = input<readonly TiedCentre[]>([]);
  /** The tied centres as one phrase in the current language ("Work and Money"). */
  readonly tiedList = input('');
  /** The answers written about `centre`. */
  readonly factors = input<CentreFactors | undefined>(undefined);
  readonly factorChange = output<FactorChange>();
  readonly centreChange = output<CentreKey>();

  protected readonly factorKeys = FACTOR_KEYS;

  protected onCentreChange(event: MatRadioChange): void {
    this.centreChange.emit(event.value as CentreKey);
  }

  protected onInput(factor: FactorKey, event: Event): void {
    this.factorChange.emit({ factor, text: (event.target as HTMLTextAreaElement).value });
  }
}

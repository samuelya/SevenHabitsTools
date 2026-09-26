import { TextFieldModule } from '@angular/cdk/text-field';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { FACTOR_KEYS } from './centres.logic';
import { CentreFactors, FactorKey } from './centres.model';

export interface FactorChange {
  readonly factor: FactorKey;
  readonly text: string;
}

/** Step 2 of an assessment (issue #60): the top centre named, and its four factor fields with
 * label / prompt / placeholder; the one-line note instead when nothing is rated above 0.
 * Presentational: it emits each edit and the page stores it. */
@Component({
  selector: 'app-centres-factors',
  imports: [MatFormFieldModule, MatInputModule, TextFieldModule, TranslocoPipe],
  templateUrl: './centres-factors.html',
  styleUrl: './centres-factors.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CentresFactors {
  /** The top centre's translated title, `null` when every rating is 0. */
  readonly centreLabel = input<string | null>(null);
  readonly factors = input<CentreFactors | undefined>(undefined);
  readonly factorChange = output<FactorChange>();

  protected readonly factorKeys = FACTOR_KEYS;

  protected onInput(factor: FactorKey, event: Event): void {
    this.factorChange.emit({ factor, text: (event.target as HTMLTextAreaElement).value });
  }
}

import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { LineAdd, clearsInput } from './mission-line-add';
import { OwnLine, SuggestionRow } from './mission.logic';

/**
 * Steps 1 and 2 (issue #61): a source's suggestions as toggle buttons (`aria-pressed`), then the
 * user's own words as a chip grid. Presentational: `ns` picks the step's strings (`step1`/`step2`),
 * and every change goes to the page as an output.
 */
@Component({
  selector: 'app-mission-chips',
  imports: [MatButtonModule, MatChipsModule, MatFormFieldModule, MatIconModule, TranslocoPipe],
  templateUrl: './mission-chips.html',
  styleUrl: './mission-chips.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissionChips {
  readonly ns = input.required<'step1' | 'step2'>();
  readonly suggestions = input.required<readonly SuggestionRow[]>();
  readonly own = input.required<readonly OwnLine[]>();
  readonly toggled = output<string>();
  readonly added = output<LineAdd>();
  readonly removed = output<number>();

  protected readonly separatorKeys = [ENTER, COMMA] as const;

  protected onAdd(event: MatChipInputEvent): void {
    this.added.emit({
      text: event.value,
      settle: (outcome) => {
        if (clearsInput(outcome)) {
          event.chipInput.clear();
        }
      },
    });
  }
}

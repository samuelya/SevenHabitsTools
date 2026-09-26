import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { TextFieldModule } from '@angular/cdk/text-field';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { addValue, removeValue, speakerSlot } from './long-view.logic';
import { LongViewAnswer } from './long-view.model';

/**
 * One prompt of a long view (issue #58), rendered from its key alone: the funeral's "Who's
 * speaking" field, the answer with its label / prompt / placeholder, and the "Values you hear"
 * chip grid. Presentational: it emits each edit and the page stores it.
 */
@Component({
  selector: 'app-long-view-prompt',
  imports: [
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TextFieldModule,
    TranslocoPipe,
  ],
  templateUrl: './long-view-prompt.html',
  styleUrl: './long-view-prompt.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LongViewPrompt {
  readonly answer = input.required<LongViewAnswer>();
  readonly textChange = output<string>();
  readonly speakerChange = output<string>();
  readonly valuesChange = output<readonly string[]>();

  protected readonly separatorKeys = [ENTER, COMMA] as const;
  protected readonly promptKey = computed(() => this.answer().promptKey);
  /** `speaker.family` etc. for a funeral prompt, `null` for every other scenario. */
  protected readonly slot = computed(() => speakerSlot(this.promptKey()));
  /** A DOM-safe id stem, unique per prompt on the page. */
  protected readonly idStem = computed(() => `long-view-${this.promptKey().replace('.', '-')}`);

  protected onText(event: Event): void {
    this.textChange.emit((event.target as HTMLTextAreaElement).value);
  }

  protected onSpeaker(event: Event): void {
    this.speakerChange.emit((event.target as HTMLInputElement).value);
  }

  protected onValueAdded(event: MatChipInputEvent): void {
    const values = this.answer().values;
    const next = addValue(values, event.value);
    event.chipInput.clear();
    if (next !== values) {
      this.valuesChange.emit(next);
    }
  }

  protected onValueRemoved(value: string): void {
    this.valuesChange.emit(removeValue(this.answer().values, value));
  }
}

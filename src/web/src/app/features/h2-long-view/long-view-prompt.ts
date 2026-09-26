import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { TextFieldModule } from '@angular/cdk/text-field';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  addValue,
  isDuplicateValue,
  removeValue,
  speakerName,
  speakerSlot,
} from './long-view.logic';
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
  /** The stored speaker, `null` when absent (`speakerName()`, the readout's rule too). */
  protected readonly speaker = computed(() => speakerName(this.answer()));
  /** What the user typed after emptying the speaker field (blank, so stored as absent): the field
   * keeps it until blur, which shows the slot label again. */
  protected readonly blankSpeaker = signal<string | null>(null);
  /** The value the last add refused as a duplicate; its text stays in the field. */
  protected readonly duplicate = signal<string | null>(null);

  protected onText(event: Event): void {
    this.textChange.emit((event.target as HTMLTextAreaElement).value);
  }

  protected onSpeaker(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.blankSpeaker.set(value.trim() === '' ? value : null);
    this.speakerChange.emit(value);
  }

  protected onValueAdded(event: MatChipInputEvent): void {
    const values = this.answer().values;
    if (isDuplicateValue(values, event.value)) {
      this.duplicate.set(event.value.trim());
      return;
    }
    const next = addValue(values, event.value);
    this.duplicate.set(null);
    event.chipInput.clear();
    if (next !== values) {
      this.valuesChange.emit(next);
    }
  }

  protected onValueTyped(): void {
    this.duplicate.set(null);
  }

  protected onValueRemoved(value: string): void {
    this.valuesChange.emit(removeValue(this.answer().values, value));
  }
}

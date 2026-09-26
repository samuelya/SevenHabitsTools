import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { PROMPTS, answerFor, speakerSlot } from './long-view.logic';
import { LongView } from './long-view.model';

/** A saved long view, read-only (issue #58): every answer with its values and the reflection,
 * plus "Edit" and "Redo". Presentational: the page decides what either does. */
@Component({
  selector: 'app-long-view-readout',
  imports: [MatButtonModule, MatChipsModule, MatIconModule, TranslocoPipe],
  templateUrl: './long-view-readout.html',
  styleUrl: './long-view-readout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LongViewReadout {
  readonly view = input.required<LongView>();
  readonly editRequested = output<void>();
  readonly redoRequested = output<void>();

  protected readonly answers = computed(() => {
    const view = this.view();
    return PROMPTS[view.scenario].map((key) => ({
      ...answerFor(view, key),
      slot: speakerSlot(key),
    }));
  });
}

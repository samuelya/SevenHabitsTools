import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { LineAdd, clearsInput } from './mission-line-add';

/**
 * One of step 4's two free lists (issue #61, "To be" or "To do"): short lines with add and
 * remove, at most `max`. A refused line keeps its text in the field and shows the hint.
 * Presentational: `kind` picks the strings (`be`/`do`), changes go to the page as outputs.
 */
@Component({
  selector: 'app-mission-lines',
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, TranslocoPipe],
  templateUrl: './mission-lines.html',
  styleUrl: './mission-lines.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissionLines {
  readonly kind = input.required<'be' | 'do'>();
  readonly lines = input.required<readonly string[]>();
  readonly max = input.required<number>();
  readonly added = output<LineAdd>();
  readonly removed = output<number>();

  protected readonly text = signal('');
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  protected readonly full = computed(() => this.lines().length >= this.max());

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
  }

  protected add(): void {
    this.added.emit({
      text: this.text(),
      settle: (outcome) => {
        if (clearsInput(outcome)) {
          this.text.set('');
          // `[value]` last rendered '' too, so the binding alone would leave the typed text.
          this.field().nativeElement.value = '';
        }
      },
    });
  }
}

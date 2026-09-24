import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { isValidIsoDate } from '../assessment-history.logic';

/**
 * An assessment's editable date (issue #226), shared by every **assessment** exercise's editor: a
 * native `<input type="date">` (typable from the keyboard, announced as a date by screen readers)
 * in an outlined Material field. Purely presentational: `date` is the stored `YYYY-MM-DD`,
 * `dateChanged` emits a new one for the page to store through its usual edit path.
 *
 * Only a real calendar date is ever emitted (`isValidIsoDate`): a cleared or impossible value is
 * dropped, so the stored date keeps its previous value, and the input is put back to that stored
 * date on blur — the field never shows a date that isn't the one stored. A refused edit (a
 * read-only tab, `refusedEdits` bumped) puts it back at once, for the same reason: the `[value]`
 * binding alone wouldn't, since the bound value never changed.
 */
@Component({
  selector: 'app-assessment-date-field',
  imports: [MatFormFieldModule, MatInputModule],
  templateUrl: './assessment-date-field.html',
  styleUrl: './assessment-date-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssessmentDateField {
  private readonly injector = inject(Injector);

  /** The stored `YYYY-MM-DD`. */
  readonly date = input.required<string>();
  /** The field's translated label, the feature's own wording. */
  readonly label = input.required<string>();
  /** How many edits the page's store has refused (a read-only tab). */
  readonly refusedEdits = input(0);
  readonly dateChanged = output<string>();

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('dateInput');

  constructor() {
    let refused = untracked(this.refusedEdits);
    effect(() => {
      if (this.refusedEdits() !== refused) {
        refused = this.refusedEdits();
        afterNextRender(() => this.showStoredDate(), { injector: this.injector });
      }
    });
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (isValidIsoDate(value) && value !== this.date()) {
      this.dateChanged.emit(value);
    }
  }

  /** Leaving the field with a cleared or partial value shows the stored date again. */
  protected onBlur(): void {
    this.showStoredDate();
  }

  private showStoredDate(): void {
    const element = this.field().nativeElement;
    if (element.value !== this.date()) {
      element.value = this.date();
    }
  }
}

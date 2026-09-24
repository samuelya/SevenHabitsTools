import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
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
 * The value is committed when the user leaves the field (blur, or Enter), not on every `input`:
 * Chromium fires `input` *and* `change` for each segment typed, so typing 31 Aug over 25 Sep
 * passes through 2026-09-03 and years 0002…2026 on the way, and each of those would be stored.
 * A `change` while the input isn't focused (a picker that doesn't leave focus on the field) is
 * committed at once, since no blur will follow.
 *
 * Only a real calendar date no later than `max` is ever emitted (`isValidIsoDate`): a cleared,
 * impossible or future value is dropped, so the stored date keeps its previous value, and the
 * input is put back to that stored date — the field never shows a date that isn't the one
 * stored. A stored date that is itself invalid (an imported `''`) is never written back: the
 * input stays as the user left it. A refused edit (a read-only tab, `refusedEdits` bumped) puts
 * the stored date back at once, for the same reason: the `[value]` binding alone wouldn't, since
 * the bound value never changed.
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
  /** The latest date allowed (`YYYY-MM-DD`, today): a mistyped future year would otherwise make
   * the assessment the "latest" for good. `null` for no limit. */
  readonly max = input<string | null>(null);
  /** How many edits the page's store has refused (a read-only tab). */
  readonly refusedEdits = input(0);
  readonly dateChanged = output<string>();

  /** The stored date when it is a real one, else empty (the browser would blank it anyway). */
  protected readonly shownDate = computed(() => (isValidIsoDate(this.date()) ? this.date() : ''));

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('dateInput');

  constructor() {
    // The baseline is the first value the effect sees, i.e. the bound one, not the default.
    let refused: number | undefined;
    effect(() => {
      const count = this.refusedEdits();
      if (refused !== undefined && count !== refused) {
        afterNextRender(() => this.showStoredDate(), { injector: this.injector });
      }
      refused = count;
    });
  }

  protected onChange(): void {
    const element = this.field().nativeElement;
    if (element.ownerDocument.activeElement !== element) {
      this.commit();
    }
  }

  /** Leaving the field stores a valid new date, or shows the stored one again. */
  protected onBlur(): void {
    this.commit();
  }

  protected commit(): void {
    const value = this.field().nativeElement.value;
    if (this.isAllowed(value)) {
      if (value !== this.date()) {
        this.dateChanged.emit(value);
      }
    } else {
      this.showStoredDate();
    }
  }

  private isAllowed(value: string): boolean {
    const max = this.max();
    return isValidIsoDate(value) && (max === null || value <= max);
  }

  private showStoredDate(): void {
    const element = this.field().nativeElement;
    if (isValidIsoDate(this.date()) && element.value !== this.date()) {
      element.value = this.date();
    }
  }
}

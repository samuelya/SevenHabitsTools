import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Signal,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { CommitmentStatus } from '../../shared/commitments/commitments.model';
import {
  isValidIsoDate,
  localDateString,
  parseIsoDate,
} from '../../shared/exercise-kit/assessment-history.logic';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
import { affectable, canMakePromise, controlChange, statusesFor } from './circle.logic';
import {
  CONCERN_CONTROLS,
  Concern,
  ConcernControl,
  ConcernFields,
  ConcernStatus,
} from './circle.model';

/** The promise made from a concern, as the form shows it: its status and where to open it. */
export interface ConcernPromise {
  readonly status: CommitmentStatus;
  /** Absolute URL of the promise on the Promises page. */
  readonly link: string;
}

/**
 * The form for one concern (issue #53): the concern, how much is up to the user, what they wish
 * they had and could be, then either a first step with a date and a promise (branch A) or a line
 * on letting it go (branch B), and a status from that branch. Purely presentational: `changed`
 * emits the edited field(s) for the page to persist, `promiseRequested` asks the page to make a
 * promise from the first step.
 *
 * Focus: the kit focuses the concern field when the editor opens (`appEditorInitialFocus`); this
 * form only refocuses it when the page switches to a different concern with the editor open, as
 * `transition-item-form.ts` does.
 */
@Component({
  selector: 'app-circle-item-form',
  imports: [
    CdkTextareaAutosize,
    EditorInitialFocus,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './circle-item-form.html',
  styleUrl: './circle-item-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CircleItemForm {
  readonly concern = input.required<Concern>();
  /** The live promise made from this concern, `null` when there is none (or it was deleted). */
  readonly promise = input<ConcernPromise | null>(null);
  readonly changed = output<Partial<ConcernFields>>();
  readonly deleted = output<void>();
  readonly promiseRequested = output<void>();

  protected readonly controls = CONCERN_CONTROLS;
  protected readonly branchA = computed(() => affectable(this.concern().control));
  protected readonly statuses = computed(() => statusesFor(this.concern().control));
  protected readonly showMakePromise = computed(() =>
    canMakePromise(this.concern(), this.promise() !== null),
  );
  /** The stored due date as a `Date`, `null` when absent or not a real date. */
  protected readonly dueDate = computed(() => {
    const date = this.concern().dueDate;
    return date !== undefined && isValidIsoDate(date) ? parseIsoDate(date) : null;
  });

  private readonly titleField = viewChild<ElementRef<HTMLTextAreaElement>>('titleField');
  private readonly touchedFields = signal<ReadonlySet<string>>(new Set());

  constructor() {
    // Reused across selections: reset the touched errors when the id changes, and move focus to
    // the concern field (the first render is the kit's open-focus moment, not ours).
    onChange(
      computed(() => this.concern().id),
      (_id, previous) => {
        this.touchedFields.set(new Set());
        if (previous !== undefined) {
          queueMicrotask(() => this.titleField()?.nativeElement.focus());
        }
      },
    );
  }

  /** Whether `field` has been blurred at least once, gating its `role="alert"` error. */
  protected isTouched(field: string): boolean {
    return this.touchedFields().has(field);
  }

  protected touch(field: string): void {
    if (!this.touchedFields().has(field)) {
      this.touchedFields.update((fields) => new Set(fields).add(field));
    }
  }

  protected blank(text: string | undefined): boolean {
    return !text?.trim();
  }

  protected onTextInput(field: 'title' | 'have' | 'be' | 'firstStep' | 'letGoNote', event: Event) {
    this.changed.emit({ [field]: (event.target as HTMLTextAreaElement).value });
  }

  protected onControlChange(control: ConcernControl): void {
    this.changed.emit(controlChange(this.concern(), control));
  }

  protected onStatusChange(status: ConcernStatus): void {
    this.changed.emit({ status });
  }

  /** A picked or typed valid date is stored; a cleared field clears it; an unparsable one changes
   * nothing (`commitments-item-form.ts`'s same rule). */
  protected onDueDateChange(event: MatDatepickerInputEvent<Date>, field: HTMLInputElement): void {
    if (event.value) {
      this.changed.emit({ dueDate: localDateString(event.value) });
    } else if (field.value.trim() === '') {
      this.changed.emit({ dueDate: '' });
    }
  }
}

/** Runs `react` only when `source()` changes, with the previous value (`undefined` at first). */
function onChange<T>(source: Signal<T>, react: (value: T, previous: T | undefined) => void): void {
  let previous: T | undefined;
  effect(() => {
    const value = source();
    if (previous !== undefined && value === previous) {
      return;
    }
    const before = previous;
    previous = value;
    react(value, before);
  });
}

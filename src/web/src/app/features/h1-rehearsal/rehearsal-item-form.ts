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
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { CommitmentStatus } from '../../shared/commitments/commitments.model';
import {
  isValidIsoDate,
  localDateString,
  parseIsoDate,
} from '../../shared/exercise-kit/assessment-history.logic';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';
import { RehearsalFollowUpForm } from './rehearsal-follow-up';
import { sceneWritten } from './rehearsal.logic';
import { Rehearsal, RehearsalFields, RehearsalFollowUp } from './rehearsal.model';

/** The promise made from a rehearsal, as the form shows it: its status and where to open it. */
export interface RehearsalPromise {
  readonly status: CommitmentStatus;
  /** Absolute URL of the promise on the Promises page. */
  readonly link: string;
}

type TextField = 'trigger' | 'usualReaction' | 'cost' | 'chosenResponse' | 'promise';

/**
 * The form for one rehearsal (issue #55), four parts in order: the moment and when, what usually
 * happens and what it costs, the new response as a short scene, and the promise; then, once the
 * date has come, the "Afterwards" section (`RehearsalFollowUpForm`). Purely presentational:
 * `changed` emits the edited field(s) for the page to persist as the user types, `followUpSaved`
 * the follow-up on its own Save.
 *
 * Focus: the kit focuses the moment field when the editor opens (`appEditorInitialFocus`); this
 * form only refocuses it when the page switches to a different rehearsal with the editor open, as
 * `transition-item-form.ts` does.
 */
@Component({
  selector: 'app-rehearsal-item-form',
  imports: [
    CdkTextareaAutosize,
    EditorInitialFocus,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    RehearsalFollowUpForm,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './rehearsal-item-form.html',
  styleUrl: './rehearsal-item-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RehearsalItemForm {
  readonly rehearsal = input.required<Rehearsal>();
  /** The live promise made from this rehearsal, `null` when there is none (or it was deleted). */
  readonly promise = input<RehearsalPromise | null>(null);
  /** Whether the "Afterwards" section shows: the date is today or earlier. */
  readonly followUpOpen = input(false);
  readonly changed = output<Partial<RehearsalFields>>();
  readonly followUpSaved = output<RehearsalFollowUp>();
  readonly deleted = output<void>();

  /** The stored date as a `Date`, `null` when absent or not a real date. */
  protected readonly expectedOn = computed(() => {
    const date = this.rehearsal().expectedOn;
    return date !== undefined && isValidIsoDate(date) ? parseIsoDate(date) : null;
  });

  private readonly triggerField = viewChild<ElementRef<HTMLTextAreaElement>>('triggerField');
  private readonly touchedFields = signal<ReadonlySet<string>>(new Set());

  constructor() {
    // Reused across selections: reset the touched errors when the id changes, and move focus to
    // the moment field (the first render is the kit's open-focus moment, not ours).
    onChange(
      computed(() => this.rehearsal().id),
      (_id, previous) => {
        this.touchedFields.set(new Set());
        if (previous !== undefined) {
          queueMicrotask(() => this.triggerField()?.nativeElement.focus());
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

  /** The scene's required message: shown once the field was left without a scene long enough to
   * count (issue #55). */
  protected readonly sceneMissing = computed(
    () => this.isTouched('chosenResponse') && !sceneWritten(this.rehearsal().chosenResponse),
  );

  protected onTextInput(field: TextField, event: Event): void {
    this.changed.emit({ [field]: (event.target as HTMLTextAreaElement).value });
  }

  /** A picked or typed valid date is stored; a cleared field clears it; an unparsable one changes
   * nothing (`commitments-item-form.ts`'s same rule). */
  protected onDateChange(event: MatDatepickerInputEvent<Date>, field: HTMLInputElement): void {
    if (event.value) {
      this.changed.emit({ expectedOn: localDateString(event.value) });
    } else if (field.value.trim() === '') {
      this.changed.emit({ expectedOn: '' });
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

import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  Signal,
  afterNextRender,
  computed,
  effect,
  inject,
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
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../../core/i18n/locale.pipe';
import type { CommitmentEdit } from '../../shared/commitments/commitments.logic';
import {
  COMMITMENT_RECIPIENTS,
  Commitment,
  CommitmentRecipient,
  CommitmentResolution,
} from '../../shared/commitments/commitments.model';
import { localDateString, parseIsoDate } from '../../shared/exercise-kit/assessment-history.logic';
import { EditorInitialFocus } from '../../shared/exercise-kit/exercise-page/editor-initial-focus.directive';

/**
 * The editor for one promise (issue #57): the promise, who it's to, the due date and, in the
 * footer, the status buttons (Kept, Broken, Withdraw; Reopen once resolved). Broken reveals the
 * repair note and moves focus to it. Presentational: `commitment` is the current value; every edit
 * is emitted at once for the page to save through `CommitmentsService` (autosave, no Save step).
 * The promise's own fields are read-only once it is resolved: the shared service only edits them
 * while it is open.
 *
 * Focus: the kit focuses the promise field when the editor opens (`appEditorInitialFocus`); this
 * form moves focus only when the user switches to another promise with the editor open, and to
 * the repair note when Broken reveals it.
 */
@Component({
  selector: 'app-commitments-item-form',
  imports: [
    AppDatePipe,
    CdkTextareaAutosize,
    EditorInitialFocus,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './commitments-item-form.html',
  styleUrl: './commitments-item-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommitmentsItemForm {
  private readonly injector = inject(Injector);

  readonly commitment = input.required<Commitment>();
  /** `false` for an unsaved draft: there is nothing to resolve until the promise is written. */
  readonly canResolve = input(true);
  /** "From: Your influence", or `''` for a promise made here. */
  readonly sourceLine = input('');
  /** The source exercise's route, when it has one to link to. */
  readonly sourceRoute = input<string | null>(null);

  readonly changed = output<CommitmentEdit>();
  readonly resolved = output<CommitmentResolution>();
  readonly reopened = output<void>();
  readonly deleted = output<void>();

  protected readonly recipients = COMMITMENT_RECIPIENTS;
  protected readonly isOpen = computed(() => this.commitment().status === 'open');
  protected readonly isBroken = computed(() => this.commitment().status === 'broken');
  protected readonly dueDate = computed(() => {
    const date = this.commitment().dueDate;
    return date ? parseIsoDate(date) : null;
  });

  private readonly textField = viewChild<ElementRef<HTMLTextAreaElement>>('textField');
  private readonly repairNoteField = viewChild<ElementRef<HTMLTextAreaElement>>('repairNoteField');
  private readonly touchedFields = signal<ReadonlySet<string>>(new Set());

  constructor() {
    onChange(
      computed(() => this.commitment().id),
      (_id, previous) => {
        this.touchedFields.set(new Set());
        if (previous !== undefined) {
          // Another promise with the editor already open (see `TransitionItemForm` for why this
          // is a microtask rather than a direct call).
          queueMicrotask(() => this.textField()?.nativeElement.focus());
        }
      },
    );
    // Broken reveals the repair note behind an `@if`: focus it once it has rendered. Only on the
    // change to Broken on the same promise, not when opening one that is already broken.
    onChange(
      computed(() => `${this.commitment().id}:${this.isBroken()}`),
      (state, previous) => {
        if (state.endsWith(':true') && previous === state.replace(/:true$/, ':false')) {
          afterNextRender(() => this.repairNoteField()?.nativeElement.focus(), {
            injector: this.injector,
          });
        }
      },
    );
  }

  protected isTouched(field: string): boolean {
    return this.touchedFields().has(field);
  }

  protected touch(field: string): void {
    if (!this.touchedFields().has(field)) {
      this.touchedFields.update((fields) => new Set(fields).add(field));
    }
  }

  protected onTextInput(event: Event): void {
    this.changed.emit({ text: (event.target as HTMLTextAreaElement).value });
  }

  protected onToWhomChange(toWhom: CommitmentRecipient): void {
    this.changed.emit({ toWhom });
  }

  protected onPersonNameInput(event: Event): void {
    this.changed.emit({ personName: (event.target as HTMLInputElement).value });
  }

  /** A picked or typed valid date is stored; a cleared field clears it; a date that doesn't parse
   * changes nothing. */
  protected onDueDateChange(event: MatDatepickerInputEvent<Date>, input: HTMLInputElement): void {
    if (event.value) {
      this.changed.emit({ dueDate: localDateString(event.value) });
    } else if (input.value.trim() === '') {
      this.changed.emit({ dueDate: '' });
    }
  }

  protected onRepairNoteInput(event: Event): void {
    this.changed.emit({ repairNote: (event.target as HTMLTextAreaElement).value });
  }

  protected localDate(date: string): Date {
    return parseIsoDate(date);
  }
}

/** Runs `react` only when `source()` changes, with the previous value (`undefined` at first). */
function onChange<T>(source: Signal<T>, react: (value: T, previous: T | undefined) => void): void {
  let previous: T | undefined;
  let first = true;
  effect(() => {
    const value = source();
    if (!first && value === previous) {
      return;
    }
    const before = first ? undefined : previous;
    first = false;
    previous = value;
    react(value, before);
  });
}

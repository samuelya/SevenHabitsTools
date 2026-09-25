import { TextFieldModule } from '@angular/cdk/text-field';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { CHECKIN_QUESTIONS, CheckIn, CheckInAnswers, CheckInQuestion } from './challenge.model';

/** What "Save check-in" hands the page. */
export interface CheckInSubmission {
  readonly answers: CheckInAnswers;
  readonly note: string;
}

const NO_ANSWERS: CheckInAnswers = {
  influence: false,
  promise: false,
  response: false,
  noBlame: false,
};

/**
 * Tonight's check-in (issue #56): four yes/no questions as slide toggles labelled by their prompt,
 * an optional note, and "Save check-in". Edits stay local until saved; the form resets to what is
 * stored whenever the day or the stored check-in changes (a save, another tab, local midnight).
 * "Saved. See you tomorrow." shows while the stored check-in matches the form, so it never claims a
 * save the store refused. Presentational.
 */
@Component({
  selector: 'app-challenge-checkin-form',
  imports: [MatButtonModule, MatInputModule, MatSlideToggleModule, TextFieldModule, TranslocoPipe],
  templateUrl: './challenge-checkin-form.html',
  styleUrl: './challenge-checkin-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChallengeCheckinForm {
  /** The stored check-in for `date`, if any. */
  readonly checkin = input<CheckIn | undefined>(undefined);
  readonly date = input.required<string>();
  readonly saved = output<CheckInSubmission>();

  protected readonly questions = CHECKIN_QUESTIONS;
  private readonly stored = computed(() => ({
    date: this.date(),
    answers: this.checkin()?.answers ?? NO_ANSWERS,
    note: this.checkin()?.note ?? '',
  }));
  protected readonly answers = linkedSignal(() => this.stored().answers);
  protected readonly note = linkedSignal(() => this.stored().note);

  /** Stored and unchanged since. */
  protected readonly isSaved = computed(() => {
    const checkin = this.checkin();
    if (!checkin?.answers) {
      return false;
    }
    const answers = this.answers();
    return (
      CHECKIN_QUESTIONS.every((q) => answers[q] === checkin.answers?.[q]) &&
      this.note().trim() === (checkin.note ?? '').trim()
    );
  });

  protected onToggle(question: CheckInQuestion, checked: boolean): void {
    this.answers.update((answers) => ({ ...answers, [question]: checked }));
  }

  protected onNoteInput(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  protected save(): void {
    this.saved.emit({ answers: this.answers(), note: this.note() });
  }
}
